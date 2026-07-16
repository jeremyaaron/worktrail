import type {
  MilestoneProgressDto,
  MilestoneReviewDto,
  MilestoneReviewScopeBreakdownDto,
  WorkItemPriority,
  WorkItemStatus
} from '@worktrail/contracts';

import type { ActorContext } from '../domain/actor.js';
import {
  workItemPriorities,
  workItemStatuses
} from '../domain/constants.js';
import {
  isDueSoonDueDate,
  isOpenWorkItemStatus,
  isOverdueDueDate,
} from '../domain/work-risk-policy.js';
import { NotFoundError } from '../errors/app-error.js';
import type { Repositories } from '../repositories/index.js';
import type { Milestone, Project, WorkItem } from '../repositories/types.js';
import { DeliveryHealthService } from './delivery-health-service.js';
import { toMilestoneDto, toProjectDto } from './dto.js';
import {
  createMilestoneReviewRiskSections,
  createWorkRiskEvaluationContext,
  loadPlanningRiskParents,
  toPlanningRiskItems
} from './work-risk-sections.js';

const recentMovementLimit = 8;

export interface MilestoneReviewServiceContext {
  actor: ActorContext;
  repositories: Repositories;
  clock?: () => Date;
}

export class MilestoneReviewService {
  private readonly clock: () => Date;

  constructor(private readonly context: MilestoneReviewServiceContext) {
    this.clock = context.clock ?? (() => new Date());
  }

  async getMilestoneReview(
    projectId: string,
    milestoneId: string
  ): Promise<MilestoneReviewDto> {
    const project = await this.requireProject(projectId);
    const [
      workItems,
      dependencyBlockedWorkItems,
      blockingOpenWorkItems,
      milestones,
      members
    ] = await Promise.all([
      this.context.repositories.workItems.listByProject(projectId, { sort: 'board_order' }),
      this.context.repositories.workItems.listByProject(projectId, {
        dependency: 'dependency_blocked',
        sort: 'priority_desc'
      }),
      this.context.repositories.workItems.listByProject(projectId, {
        dependency: 'blocking_open_work',
        sort: 'priority_desc'
      }),
      this.context.repositories.milestones.listByProject(projectId, { includeArchived: true }),
      this.context.repositories.members.listByWorkspace(this.context.actor.workspaceId)
    ]);
    const milestone = milestones.find((item) => item.id === milestoneId);

    if (milestone === undefined || milestone.projectId !== projectId) {
      throw new NotFoundError('Milestone not found.');
    }

    const now = this.clock();
    const evaluationContext = createWorkRiskEvaluationContext({
      now,
      dependencyBlockedWorkItems,
      blockingOpenWorkItems
    });
    const healthSummary = new DeliveryHealthService().derive({
      project,
      workItems,
      dependencyBlockedWorkItems,
      blockingOpenWorkItems,
      milestones,
      now
    });
    const memberById = new Map(members.map((member) => [member.id, member]));
    const milestoneById = new Map(milestones.map((candidate) => [candidate.id, candidate]));
    const scopedWorkItems = workItems.filter((workItem) => workItem.milestoneId === milestoneId);
    const parentByChildId = await loadPlanningRiskParents(
      scopedWorkItems,
      this.context.repositories
    );
    const progress =
      healthSummary.milestoneProgress.find((item) => item.milestone.id === milestoneId) ??
      createEmptyMilestoneProgress(milestone);

    return {
      project: toProjectDto(project),
      milestone: toMilestoneDto(milestone),
      progress,
      scopedWorkQuery: {
        milestoneId,
        sort: 'priority_desc'
      },
      scopeBreakdown: createScopeBreakdown(scopedWorkItems, evaluationContext),
      riskSections: createMilestoneReviewRiskSections({
        milestoneId,
        workItems: scopedWorkItems,
        memberById,
        milestoneById,
        parentByChildId,
        context: evaluationContext
      }),
      recentlyChangedWork: toPlanningRiskItems(
        [...scopedWorkItems]
          .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime())
          .slice(0, recentMovementLimit),
        memberById,
        milestoneById,
        parentByChildId
      )
    };
  }

  private async requireProject(projectId: string): Promise<Project> {
    const project = await this.context.repositories.projects.findById(projectId);

    if (project === null || project.workspaceId !== this.context.actor.workspaceId) {
      throw new NotFoundError('Project not found.');
    }

    return project;
  }
}

function createEmptyMilestoneProgress(milestone: Milestone): MilestoneProgressDto {
  return {
    milestone: toMilestoneDto(milestone),
    totalCount: 0,
    doneCount: 0,
    openCount: 0,
    blockedCount: 0,
    dependencyBlockedCount: 0,
    overdueCount: 0,
    dueSoonCount: 0,
    unassignedActiveCount: 0,
    staleInProgressCount: 0,
    health: 'inactive',
    reasons: []
  };
}

function createScopeBreakdown(
  scopedWorkItems: WorkItem[],
  context: ReturnType<typeof createWorkRiskEvaluationContext>
): MilestoneReviewScopeBreakdownDto {
  const statusCounts = Object.fromEntries(
    workItemStatuses.map((status) => [status, 0])
  ) as Record<WorkItemStatus, number>;
  const priorityCounts = Object.fromEntries(
    workItemPriorities.map((priority) => [priority, 0])
  ) as Record<WorkItemPriority, number>;
  const dueDate = {
    overdueCount: 0,
    dueSoonCount: 0,
    laterCount: 0,
    noneCount: 0
  };
  let assignedCount = 0;
  let unassignedCount = 0;
  let dependencyBlockedCount = 0;
  let blockingOpenWorkCount = 0;

  for (const workItem of scopedWorkItems) {
    statusCounts[workItem.status] += 1;
    priorityCounts[workItem.priority] += 1;

    if (workItem.assigneeId === null) {
      unassignedCount += 1;
    } else {
      assignedCount += 1;
    }

    if (workItem.dueDate === null) {
      dueDate.noneCount += 1;
    } else if (isOpenWorkItem(workItem) && isOverdueDueDate(workItem.dueDate, context.today)) {
      dueDate.overdueCount += 1;
    } else if (
      isOpenWorkItem(workItem) &&
      isDueSoonDueDate(workItem.dueDate, context.today, context.dueSoonEnd)
    ) {
      dueDate.dueSoonCount += 1;
    } else {
      dueDate.laterCount += 1;
    }

    if (isOpenWorkItem(workItem) && context.dependencyBlockedIds.has(workItem.id)) {
      dependencyBlockedCount += 1;
    }

    if (isOpenWorkItem(workItem) && context.blockingOpenWorkIds.has(workItem.id)) {
      blockingOpenWorkCount += 1;
    }
  }

  return {
    statusCounts,
    priorityCounts,
    assignedCount,
    unassignedCount,
    dueDate,
    dependency: {
      dependencyBlockedCount,
      blockingOpenWorkCount
    }
  };
}

function isOpenWorkItem(workItem: WorkItem): boolean {
  return isOpenWorkItemStatus(workItem.status);
}
