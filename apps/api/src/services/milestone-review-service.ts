import type {
  MilestoneProgressDto,
  MilestoneReviewDto,
  MilestoneReviewRiskSectionDto,
  MilestoneReviewRiskType,
  MilestoneReviewScopeBreakdownDto,
  PlanningRiskItemDto,
  WorkItemPriority,
  WorkItemQuery,
  WorkItemStatus
} from '@worktrail/contracts';

import type { ActorContext } from '../domain/actor.js';
import {
  workItemPriorities,
  workItemStatuses
} from '../domain/constants.js';
import {
  addDays,
  dueSoonWindowDays,
  isActiveUnassignedWorkItemStatus,
  isDueSoonDueDate,
  isOpenWorkItemStatus,
  isOverdueDueDate,
  isStaleInProgressStatus,
  staleInProgressDays,
  toDateString
} from '../domain/work-risk-policy.js';
import { NotFoundError } from '../errors/app-error.js';
import type { Repositories } from '../repositories/index.js';
import type { Member, Milestone, Project, WorkItem } from '../repositories/types.js';
import { DeliveryHealthService } from './delivery-health-service.js';
import { toMemberDto, toMilestoneDto, toProjectDto } from './dto.js';

const riskSectionPreviewLimit = 5;
const recentMovementLimit = 8;

const priorityRank: Record<WorkItemPriority, number> = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1
};

const riskSectionMetadata: Record<
  MilestoneReviewRiskType,
  { title: string; description: string }
> = {
  blocked: {
    title: 'Blocked work',
    description: 'Work items in this milestone currently marked blocked.'
  },
  dependency_blocked: {
    title: 'Dependency blocked',
    description: 'Work items in this milestone waiting on open blockers.'
  },
  overdue: {
    title: 'Overdue work',
    description: 'Open work in this milestone past its due date.'
  },
  due_soon: {
    title: 'Due soon',
    description: 'Open work in this milestone due within the planning window.'
  },
  unassigned_active: {
    title: 'Unassigned active work',
    description: 'Ready or in-progress milestone work without an assignee.'
  },
  stale_in_progress: {
    title: 'Stale in-progress work',
    description: 'In-progress milestone work that has not changed recently.'
  },
  blocking_open_work: {
    title: 'Blocking open work',
    description: 'Work in this milestone blocking other open work items.'
  }
};

export interface MilestoneReviewServiceContext {
  actor: ActorContext;
  repositories: Repositories;
  clock?: () => Date;
}

interface EvaluationContext {
  today: string;
  dueSoonEnd: string;
  staleCutoff: Date;
  dependencyBlockedIds: Set<string>;
  blockingOpenWorkIds: Set<string>;
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
    const evaluationContext = createEvaluationContext({
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
      riskSections: createRiskSections({
        milestoneId,
        scopedWorkItems,
        memberById,
        milestoneById,
        context: evaluationContext
      }),
      recentlyChangedWork: toRiskItems(
        [...scopedWorkItems]
          .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime())
          .slice(0, recentMovementLimit),
        memberById,
        milestoneById
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

function createEvaluationContext(input: {
  now: Date;
  dependencyBlockedWorkItems: WorkItem[];
  blockingOpenWorkItems: WorkItem[];
}): EvaluationContext {
  return {
    today: toDateString(input.now),
    dueSoonEnd: toDateString(addDays(input.now, dueSoonWindowDays)),
    staleCutoff: addDays(input.now, -staleInProgressDays),
    dependencyBlockedIds: new Set(input.dependencyBlockedWorkItems.map((workItem) => workItem.id)),
    blockingOpenWorkIds: new Set(input.blockingOpenWorkItems.map((workItem) => workItem.id))
  };
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
  context: EvaluationContext
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

function createRiskSections(input: {
  milestoneId: string;
  scopedWorkItems: WorkItem[];
  memberById: Map<string, Member>;
  milestoneById: Map<string, Milestone>;
  context: EvaluationContext;
}): MilestoneReviewRiskSectionDto[] {
  return [
    createRiskSection(input, {
      type: 'blocked',
      query: { milestoneId: input.milestoneId, status: 'blocked', sort: 'priority_desc' },
      filter: (workItem) => isOpenWorkItem(workItem) && workItem.status === 'blocked',
      sort: compareByPriorityThenUpdatedDesc
    }),
    createRiskSection(input, {
      type: 'dependency_blocked',
      query: {
        milestoneId: input.milestoneId,
        dependency: 'dependency_blocked',
        sort: 'priority_desc'
      },
      filter: (workItem) =>
        isOpenWorkItem(workItem) && input.context.dependencyBlockedIds.has(workItem.id),
      sort: compareByPriorityThenUpdatedDesc
    }),
    createRiskSection(input, {
      type: 'overdue',
      query: { milestoneId: input.milestoneId, dueDateState: 'overdue', sort: 'due_date_asc' },
      filter: (workItem) =>
        isOpenWorkItem(workItem) && isOverdueDueDate(workItem.dueDate, input.context.today),
      sort: compareByDueDateThenPriority
    }),
    createRiskSection(input, {
      type: 'due_soon',
      query: { milestoneId: input.milestoneId, dueDateState: 'due_soon', sort: 'due_date_asc' },
      filter: (workItem) =>
        isOpenWorkItem(workItem) &&
        isDueSoonDueDate(workItem.dueDate, input.context.today, input.context.dueSoonEnd),
      sort: compareByDueDateThenPriority
    }),
    createRiskSection(input, {
      type: 'unassigned_active',
      query: {
        milestoneId: input.milestoneId,
        workRisk: 'unassigned_active',
        sort: 'priority_desc'
      },
      filter: (workItem) =>
        workItem.assigneeId === null && isActiveUnassignedWorkItemStatus(workItem.status),
      sort: compareByPriorityThenUpdatedDesc
    }),
    createRiskSection(input, {
      type: 'stale_in_progress',
      query: {
        milestoneId: input.milestoneId,
        workRisk: 'stale_in_progress',
        sort: 'updated_asc'
      },
      filter: (workItem) =>
        isStaleInProgressStatus(workItem.status, workItem.updatedAt, input.context.staleCutoff),
      sort: compareByUpdatedAsc
    }),
    createRiskSection(input, {
      type: 'blocking_open_work',
      query: {
        milestoneId: input.milestoneId,
        dependency: 'blocking_open_work',
        sort: 'priority_desc'
      },
      filter: (workItem) =>
        isOpenWorkItem(workItem) && input.context.blockingOpenWorkIds.has(workItem.id),
      sort: compareByPriorityThenUpdatedDesc
    })
  ];
}

function createRiskSection(
  input: {
    scopedWorkItems: WorkItem[];
    memberById: Map<string, Member>;
    milestoneById: Map<string, Milestone>;
  },
  section: {
    type: MilestoneReviewRiskType;
    query: WorkItemQuery;
    filter: (workItem: WorkItem) => boolean;
    sort: (left: WorkItem, right: WorkItem) => number;
  }
): MilestoneReviewRiskSectionDto {
  const matchingItems = input.scopedWorkItems.filter(section.filter).sort(section.sort);
  const metadata = riskSectionMetadata[section.type];

  return {
    type: section.type,
    title: metadata.title,
    description: metadata.description,
    count: matchingItems.length,
    query: section.query,
    items: toRiskItems(
      matchingItems.slice(0, riskSectionPreviewLimit),
      input.memberById,
      input.milestoneById
    )
  };
}

function toRiskItems(
  workItems: WorkItem[],
  memberById: Map<string, Member>,
  milestoneById: Map<string, Milestone>
): PlanningRiskItemDto[] {
  return workItems.map((workItem) => {
    const assignee =
      workItem.assigneeId === null ? null : memberById.get(workItem.assigneeId) ?? null;
    const milestone =
      workItem.milestoneId === null ? null : milestoneById.get(workItem.milestoneId) ?? null;

    return {
      id: workItem.id,
      displayKey: workItem.displayKey,
      title: workItem.title,
      status: workItem.status,
      priority: workItem.priority,
      assignee: assignee === null ? null : toMemberDto(assignee),
      dueDate: workItem.dueDate,
      milestone: milestone === null ? null : toMilestoneDto(milestone),
      updatedAt: workItem.updatedAt.toISOString()
    };
  });
}

function isOpenWorkItem(workItem: WorkItem): boolean {
  return isOpenWorkItemStatus(workItem.status);
}

function compareByPriorityThenUpdatedDesc(left: WorkItem, right: WorkItem): number {
  const priorityCompare = priorityRank[right.priority] - priorityRank[left.priority];

  if (priorityCompare !== 0) {
    return priorityCompare;
  }

  return right.updatedAt.getTime() - left.updatedAt.getTime();
}

function compareByDueDateThenPriority(left: WorkItem, right: WorkItem): number {
  const dueDateCompare = (left.dueDate ?? '').localeCompare(right.dueDate ?? '');

  if (dueDateCompare !== 0) {
    return dueDateCompare;
  }

  return priorityRank[right.priority] - priorityRank[left.priority];
}

function compareByUpdatedAsc(left: WorkItem, right: WorkItem): number {
  return left.updatedAt.getTime() - right.updatedAt.getTime();
}
