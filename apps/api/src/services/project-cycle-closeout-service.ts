import type {
  ProjectCycleCloseoutCountsDto,
  ProjectCycleCloseoutItemSnapshotDto,
  ProjectCycleCloseoutPreviewDto,
  WorkItemPriority,
  WorkItemStatus
} from '@worktrail/contracts';

import type { WorktrailDb } from '../db/client.js';
import type { ActorContext } from '../domain/actor.js';
import { canManageProjectCycles } from '../domain/permissions.js';
import { isTerminalWorkItemStatus } from '../domain/work-risk-policy.js';
import { ConflictError, ForbiddenError, NotFoundError } from '../errors/app-error.js';
import type { Repositories } from '../repositories/index.js';
import type { Member, Project, ProjectCycle, WorkItem } from '../repositories/types.js';
import { createCycleEvaluation } from './cycle-review-model.js';
import { toProjectCycleDto, toProjectDto } from './dto.js';
import { createWorkRiskEvaluationContext } from './work-risk-sections.js';

export interface ProjectCycleCloseoutServiceContext {
  actor: ActorContext;
  repositories: Repositories;
  db?: WorktrailDb;
  clock?: () => Date;
  idGenerator?: () => string;
}

const unfinishedStatusRank: Record<WorkItemStatus, number> = {
  backlog: 1,
  ready: 2,
  in_progress: 3,
  blocked: 4,
  done: 0,
  canceled: 0
};

const priorityRank: Record<WorkItemPriority, number> = {
  low: 1,
  medium: 2,
  high: 3,
  urgent: 4
};

export class ProjectCycleCloseoutService {
  private readonly clock: () => Date;

  constructor(private readonly context: ProjectCycleCloseoutServiceContext) {
    this.clock = context.clock ?? (() => new Date());
  }

  async preview(projectId: string, cycleId: string): Promise<ProjectCycleCloseoutPreviewDto> {
    this.assertCanCloseCycles();

    const project = await this.requireProject(projectId);
    this.assertProjectWritable(project);

    const cycle = await this.requireProjectCycle(projectId, cycleId);
    this.assertCycleCloseable(cycle);

    const [scopedWorkItems, dependencyBlockedWorkItems, blockingOpenWorkItems, members, cycles] =
      await Promise.all([
        this.context.repositories.workItems.listByProject(projectId, {
          cycleId,
          sort: 'board_order'
        }),
        this.context.repositories.workItems.listByProject(projectId, {
          cycleId,
          dependency: 'dependency_blocked',
          sort: 'priority_desc'
        }),
        this.context.repositories.workItems.listByProject(projectId, {
          cycleId,
          dependency: 'blocking_open_work',
          sort: 'priority_desc'
        }),
        this.context.repositories.members.listByWorkspace(this.context.actor.workspaceId),
        this.context.repositories.projectCycles.listByProject(projectId, {
          includeArchived: true
        })
      ]);
    const now = this.clock();
    const evaluationContext = createWorkRiskEvaluationContext({
      now,
      dependencyBlockedWorkItems,
      blockingOpenWorkItems
    });
    const evaluation = createCycleEvaluation({
      cycle,
      scopedWorkItems,
      context: evaluationContext
    });
    const memberById = new Map(members.map((member) => [member.id, member]));
    const completedItems = scopedWorkItems.filter((item) => item.status === 'done');
    const canceledItems = scopedWorkItems.filter((item) => item.status === 'canceled');
    const unfinishedItems = scopedWorkItems
      .filter((item) => !isTerminalWorkItemStatus(item.status))
      .sort(compareUnfinishedWorkItems);

    return {
      project: toProjectDto(project),
      cycle: toProjectCycleDto(cycle),
      generatedAt: now.toISOString(),
      health: evaluation.health,
      counts: createPreviewCounts({
        scopedWorkItems,
        completedItems,
        canceledItems,
        unfinishedItems
      }),
      unfinishedItems: unfinishedItems.map((item) =>
        toCloseoutItemSnapshot(item, memberById, evaluationContext.dependencyBlockedIds)
      ),
      eligibleDestinations: cycles
        .filter(
          (candidate) =>
            candidate.id !== cycleId &&
            candidate.status === 'planned' &&
            candidate.archivedAt === null
        )
        .sort(compareDestinationCycles)
        .map((candidate) => ({ cycle: toProjectCycleDto(candidate) }))
    };
  }

  private assertCanCloseCycles(): void {
    if (!canManageProjectCycles(this.context.actor)) {
      throw new ForbiddenError('Only owners and maintainers can close cycles.');
    }
  }

  private async requireProject(projectId: string): Promise<Project> {
    const project = await this.context.repositories.projects.findById(projectId);

    if (project === null || project.workspaceId !== this.context.actor.workspaceId) {
      throw new NotFoundError('Project not found.');
    }

    return project;
  }

  private async requireProjectCycle(projectId: string, cycleId: string): Promise<ProjectCycle> {
    const cycle = await this.context.repositories.projectCycles.findById(cycleId);

    if (
      cycle === null ||
      cycle.workspaceId !== this.context.actor.workspaceId ||
      cycle.projectId !== projectId
    ) {
      throw new NotFoundError('Project cycle not found.');
    }

    return cycle;
  }

  private assertProjectWritable(project: Project): void {
    if (project.status === 'archived') {
      throw new ConflictError('Archived projects are read-only.');
    }
  }

  private assertCycleCloseable(cycle: ProjectCycle): void {
    if (cycle.archivedAt !== null) {
      throw new ConflictError('Archived cycles cannot be closed.');
    }

    if (cycle.status !== 'active') {
      throw new ConflictError('Only active cycles can be closed.');
    }
  }
}

function createPreviewCounts(input: {
  scopedWorkItems: WorkItem[];
  completedItems: WorkItem[];
  canceledItems: WorkItem[];
  unfinishedItems: WorkItem[];
}): Omit<ProjectCycleCloseoutCountsDto, 'movedCount'> {
  return {
    totalCount: input.scopedWorkItems.length,
    completedCount: input.completedItems.length,
    canceledCount: input.canceledItems.length,
    unfinishedCount: input.unfinishedItems.length,
    retainedCount: input.completedItems.length + input.canceledItems.length,
    committedEstimatePoints: sumEstimatePoints(input.scopedWorkItems),
    completedEstimatePoints: sumEstimatePoints(input.completedItems),
    unfinishedEstimatePoints: sumEstimatePoints(input.unfinishedItems),
    unestimatedUnfinishedCount: input.unfinishedItems.filter(
      (item) => item.estimatePoints === null
    ).length
  };
}

function toCloseoutItemSnapshot(
  workItem: WorkItem,
  memberById: Map<string, Member>,
  dependencyBlockedIds: Set<string>
): ProjectCycleCloseoutItemSnapshotDto {
  const assignee =
    workItem.assigneeId === null ? null : (memberById.get(workItem.assigneeId) ?? null);

  return {
    id: workItem.id,
    displayKey: workItem.displayKey,
    title: workItem.title,
    status: workItem.status,
    priority: workItem.priority,
    assignee: assignee === null ? null : { id: assignee.id, name: assignee.name },
    estimatePoints: workItem.estimatePoints,
    dependencyBlocked: dependencyBlockedIds.has(workItem.id)
  };
}

function compareUnfinishedWorkItems(left: WorkItem, right: WorkItem): number {
  const statusDifference = unfinishedStatusRank[right.status] - unfinishedStatusRank[left.status];

  if (statusDifference !== 0) {
    return statusDifference;
  }

  const priorityDifference = priorityRank[right.priority] - priorityRank[left.priority];

  if (priorityDifference !== 0) {
    return priorityDifference;
  }

  const displayKeyDifference = left.displayKey.localeCompare(right.displayKey, undefined, {
    numeric: true,
    sensitivity: 'base'
  });

  return displayKeyDifference !== 0 ? displayKeyDifference : left.id.localeCompare(right.id);
}

function compareDestinationCycles(left: ProjectCycle, right: ProjectCycle): number {
  const startDateDifference = left.startDate.localeCompare(right.startDate);

  if (startDateDifference !== 0) {
    return startDateDifference;
  }

  const nameDifference = left.name.localeCompare(right.name, undefined, { sensitivity: 'base' });
  return nameDifference !== 0 ? nameDifference : left.id.localeCompare(right.id);
}

function sumEstimatePoints(items: WorkItem[]): number {
  return items.reduce((total, item) => total + (item.estimatePoints ?? 0), 0);
}
