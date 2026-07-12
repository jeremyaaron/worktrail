import type {
  CloseProjectCycleRequest,
  CloseProjectCycleResultDto,
  ProjectCycleCloseoutCountsDto,
  ProjectCycleCloseoutDto,
  ProjectCycleCloseoutItemSnapshotDto,
  ProjectCycleCloseoutPreviewDto,
  ProjectCycleCloseoutSnapshotDto,
  WorkItemPriority,
  WorkItemStatus
} from '@worktrail/contracts';
import { randomUUID } from 'node:crypto';

import type { WorktrailDb } from '../db/client.js';
import type { ActorContext } from '../domain/actor.js';
import { canManageProjectCycles } from '../domain/permissions.js';
import { isTerminalWorkItemStatus } from '../domain/work-risk-policy.js';
import { ConflictError, ForbiddenError, NotFoundError } from '../errors/app-error.js';
import {
  type Repositories,
  withRepositoriesTransaction
} from '../repositories/index.js';
import type {
  Member,
  Project,
  ProjectCycle,
  ProjectCycleCloseout,
  WorkItem
} from '../repositories/types.js';
import { closeProjectCycleSchema } from '../validation/project-cycle.js';
import {
  assertProjectCycleCloseoutSnapshotMatchesRecord,
  parseStoredProjectCycleCloseoutSnapshot
} from '../validation/project-cycle-closeout-snapshot.js';
import { parseWithSchema } from '../validation/parse.js';
import { createCycleEvaluation } from './cycle-review-model.js';
import { toMemberDto, toProjectCycleDto, toProjectDto } from './dto.js';
import { createWorkItemCycleChangedActivity } from './work-item-cycle-activity.js';
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
  private readonly idGenerator: () => string;

  constructor(private readonly context: ProjectCycleCloseoutServiceContext) {
    this.clock = context.clock ?? (() => new Date());
    this.idGenerator = context.idGenerator ?? randomUUID;
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

  async close(
    projectId: string,
    cycleId: string,
    input: CloseProjectCycleRequest
  ): Promise<CloseProjectCycleResultDto> {
    const body = parseWithSchema(closeProjectCycleSchema, input);
    this.assertCanCloseCycles();

    return this.withWriteRepositories(async (repositories) => {
      const sourceCycle = await repositories.projectCycles.findByIdForUpdate(cycleId);

      if (
        sourceCycle === null ||
        sourceCycle.workspaceId !== this.context.actor.workspaceId ||
        sourceCycle.projectId !== projectId
      ) {
        throw new NotFoundError('Project cycle not found.');
      }

      const existing = await repositories.projectCycleCloseouts.findByCycleId(cycleId);

      if (existing !== null) {
        const replay = await this.toCloseResult(existing, sourceCycle, false, repositories);

        if (existing.destinationCycleId !== body.destinationCycleId) {
          throw new ConflictError('Cycle was already closed with a different destination.');
        }

        return replay;
      }

      const project = await this.requireProjectWithRepositories(projectId, repositories);
      this.assertProjectWritable(project);
      this.assertCycleCloseable(sourceCycle);

      const destinationCycle = await this.resolveDestination(
        projectId,
        cycleId,
        body.destinationCycleId,
        repositories
      );
      const scopedWorkItems = await repositories.workItems.listByCycleForUpdate(projectId, cycleId);
      const unfinishedItems = scopedWorkItems
        .filter((item) => !isTerminalWorkItemStatus(item.status))
        .sort(compareUnfinishedWorkItems);

      if (unfinishedItems.length === 0 && destinationCycle !== null) {
        throw new ConflictError('A destination cannot be selected when the cycle has no unfinished work.');
      }

      const dependencyBlockedWorkItems = await repositories.workItems.listByProject(projectId, {
        cycleId,
        dependency: 'dependency_blocked',
        sort: 'priority_desc'
      });
      const blockingOpenWorkItems = await repositories.workItems.listByProject(projectId, {
        cycleId,
        dependency: 'blocking_open_work',
        sort: 'priority_desc'
      });
      const members = await repositories.members.listByWorkspace(this.context.actor.workspaceId);
      const actor = members.find((member) => member.id === this.context.actor.memberId);

      if (actor === undefined) {
        throw new NotFoundError('Member not found.');
      }

      const closedAt = this.clock();
      const evaluationContext = createWorkRiskEvaluationContext({
        now: closedAt,
        dependencyBlockedWorkItems,
        blockingOpenWorkItems
      });
      const evaluation = createCycleEvaluation({
        cycle: sourceCycle,
        scopedWorkItems,
        context: evaluationContext
      });
      const memberById = new Map(members.map((member) => [member.id, member]));
      const completedItems = scopedWorkItems
        .filter((item) => item.status === 'done')
        .sort(compareSnapshotWorkItems);
      const canceledItems = scopedWorkItems
        .filter((item) => item.status === 'canceled')
        .sort(compareSnapshotWorkItems);
      const closeoutId = this.idGenerator();
      const snapshot: ProjectCycleCloseoutSnapshotDto = {
        snapshotVersion: 1,
        project: { id: project.id, key: project.key, name: project.name },
        cycle: {
          id: sourceCycle.id,
          name: sourceCycle.name,
          goal: sourceCycle.goal,
          status: 'active',
          startDate: sourceCycle.startDate,
          endDate: sourceCycle.endDate,
          targetPoints: sourceCycle.targetPoints
        },
        closedAt: closedAt.toISOString(),
        closedBy: { id: actor.id, name: actor.name },
        health: evaluation.health,
        counts: {
          ...createPreviewCounts({
            scopedWorkItems,
            completedItems,
            canceledItems,
            unfinishedItems
          }),
          movedCount: unfinishedItems.length
        },
        destination:
          unfinishedItems.length === 0
            ? { kind: 'none', cycle: null }
            : destinationCycle === null
              ? { kind: 'unplanned', cycle: null }
              : {
                  kind: 'cycle',
                  cycle: {
                    id: destinationCycle.id,
                    name: destinationCycle.name,
                    startDate: destinationCycle.startDate,
                    endDate: destinationCycle.endDate
                  }
                },
        items: {
          completed: completedItems.map((item) =>
            toCloseoutItemSnapshot(item, memberById, evaluationContext.dependencyBlockedIds)
          ),
          canceled: canceledItems.map((item) =>
            toCloseoutItemSnapshot(item, memberById, evaluationContext.dependencyBlockedIds)
          ),
          unfinished: unfinishedItems.map((item) =>
            toCloseoutItemSnapshot(item, memberById, evaluationContext.dependencyBlockedIds)
          )
        }
      };
      const closeout = await repositories.projectCycleCloseouts.create({
        id: closeoutId,
        workspaceId: sourceCycle.workspaceId,
        projectId,
        cycleId,
        closedByMemberId: actor.id,
        destinationCycleId: destinationCycle?.id ?? null,
        snapshot,
        closedAt,
        createdAt: closedAt
      });
      const completedCycle = await repositories.projectCycles.update(cycleId, {
        status: 'completed',
        updatedAt: closedAt
      });

      if (completedCycle === null) {
        throw new NotFoundError('Project cycle not found.');
      }

      await repositories.workItems.updateCycleAssignments(
        unfinishedItems.map((item) => item.id),
        destinationCycle?.id ?? null,
        closedAt
      );
      await repositories.activityEvents.createMany([
        ...unfinishedItems.map((workItem) =>
          createWorkItemCycleChangedActivity({
            id: this.idGenerator(),
            workItem,
            previousCycle: sourceCycle,
            nextCycle: destinationCycle,
            actorId: actor.id,
            createdAt: closedAt
          })
        ),
        {
          id: this.idGenerator(),
          workspaceId: sourceCycle.workspaceId,
          projectId,
          workItemId: null,
          actorId: actor.id,
          eventType: 'cycle.closed',
          summary: createCycleClosedSummary(sourceCycle, destinationCycle, unfinishedItems.length),
          previousValue: { cycleId, status: 'active' },
          newValue: { cycleId, status: 'completed' },
          metadata: {
            closeoutId,
            destinationCycleId: destinationCycle?.id ?? null,
            movedItemCount: unfinishedItems.length,
            retainedItemCount: completedItems.length + canceledItems.length
          },
          createdAt: closedAt
        }
      ]);

      return {
        applied: true,
        cycle: toProjectCycleDto(completedCycle),
        closeout: this.toCloseoutDto(closeout, actor),
        movedItemCount: snapshot.counts.movedCount,
        retainedItemCount: snapshot.counts.retainedCount
      };
    });
  }

  private async withWriteRepositories<T>(
    callback: (repositories: Repositories) => Promise<T>
  ): Promise<T> {
    if (this.context.db === undefined) {
      return callback(this.context.repositories);
    }

    return withRepositoriesTransaction(this.context.db, callback);
  }

  private async resolveDestination(
    projectId: string,
    sourceCycleId: string,
    destinationCycleId: string | null,
    repositories: Repositories
  ): Promise<ProjectCycle | null> {
    if (destinationCycleId === null) {
      return null;
    }

    if (destinationCycleId === sourceCycleId) {
      throw new ConflictError('A cycle cannot carry unfinished work into itself.');
    }

    const destination = await repositories.projectCycles.findByIdForUpdate(destinationCycleId);

    if (
      destination === null ||
      destination.workspaceId !== this.context.actor.workspaceId ||
      destination.projectId !== projectId
    ) {
      throw new NotFoundError('Destination cycle not found.');
    }

    if (destination.archivedAt !== null || destination.status !== 'planned') {
      throw new ConflictError('Destination cycle must be planned and not archived.');
    }

    return destination;
  }

  private async toCloseResult(
    closeout: ProjectCycleCloseout,
    cycle: ProjectCycle,
    applied: boolean,
    repositories: Repositories
  ): Promise<CloseProjectCycleResultDto> {
    if (
      closeout.workspaceId !== cycle.workspaceId ||
      closeout.projectId !== cycle.projectId ||
      closeout.cycleId !== cycle.id ||
      cycle.status !== 'completed'
    ) {
      throw new ConflictError('Stored cycle closeout is inconsistent with the source cycle.');
    }

    const actor = await repositories.members.findById(closeout.closedByMemberId);

    if (actor === null) {
      throw new ConflictError('Stored cycle closeout references a missing member.');
    }

    const dto = this.toCloseoutDto(closeout, actor);
    return {
      applied,
      cycle: toProjectCycleDto(cycle),
      closeout: dto,
      movedItemCount: dto.snapshot.counts.movedCount,
      retainedItemCount: dto.snapshot.counts.retainedCount
    };
  }

  private toCloseoutDto(closeout: ProjectCycleCloseout, actor: Member): ProjectCycleCloseoutDto {
    const snapshot = parseStoredProjectCycleCloseoutSnapshot(closeout.snapshot);
    assertProjectCycleCloseoutSnapshotMatchesRecord(snapshot, closeout);

    return {
      id: closeout.id,
      workspaceId: closeout.workspaceId,
      projectId: closeout.projectId,
      cycleId: closeout.cycleId,
      closedAt: closeout.closedAt.toISOString(),
      closedBy: toMemberDto(actor),
      destinationCycleId: closeout.destinationCycleId,
      snapshot
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

  private async requireProjectWithRepositories(
    projectId: string,
    repositories: Repositories
  ): Promise<Project> {
    const project = await repositories.projects.findById(projectId);

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

function compareSnapshotWorkItems(left: WorkItem, right: WorkItem): number {
  const displayKeyDifference = left.displayKey.localeCompare(right.displayKey, undefined, {
    numeric: true,
    sensitivity: 'base'
  });
  return displayKeyDifference !== 0 ? displayKeyDifference : left.id.localeCompare(right.id);
}

function createCycleClosedSummary(
  source: ProjectCycle,
  destination: ProjectCycle | null,
  movedCount: number
): string {
  if (movedCount === 0) {
    return `Cycle ${source.name} closed with no unfinished work.`;
  }

  const itemLabel = movedCount === 1 ? 'item' : 'items';
  return destination === null
    ? `Cycle ${source.name} closed; ${movedCount} ${itemLabel} returned to unplanned work.`
    : `Cycle ${source.name} closed; ${movedCount} ${itemLabel} moved to ${destination.name}.`;
}

function sumEstimatePoints(items: WorkItem[]): number {
  return items.reduce((total, item) => total + (item.estimatePoints ?? 0), 0);
}
