import type {
  CycleReviewRiskSectionDto,
  CycleReviewRiskType,
  MilestoneReviewRiskSectionDto,
  MilestoneReviewRiskType,
  PlanningRiskItemDto,
  ProjectStatusReportRiskSnapshotDto,
  WorkItemPriority,
  WorkItemQuery
} from '@worktrail/contracts';

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
import type { Member, Milestone, WorkItem } from '../repositories/types.js';
import { toMemberDto, toMilestoneDto } from './dto.js';

const riskSectionPreviewLimit = 5;

const priorityRank: Record<WorkItemPriority, number> = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1
};

export interface WorkRiskEvaluationContext {
  today: string;
  dueSoonEnd: string;
  staleCutoff: Date;
  dependencyBlockedIds: Set<string>;
  blockingOpenWorkIds: Set<string>;
}

interface WorkRiskSectionDefinition<RiskType extends string = MilestoneReviewRiskType> {
  type: RiskType;
  title: string;
  description: string;
  query: WorkItemQuery;
  filter: (workItem: WorkItem, context: WorkRiskEvaluationContext) => boolean;
  sort: (left: WorkItem, right: WorkItem) => number;
}

const workRiskSectionDefinitions: WorkRiskSectionDefinition<MilestoneReviewRiskType>[] = [
  {
    type: 'blocked',
    title: 'Blocked work',
    description: 'Work items in this milestone currently marked blocked.',
    query: { status: 'blocked', sort: 'priority_desc' },
    filter: (workItem) => isOpenWorkItem(workItem) && workItem.status === 'blocked',
    sort: compareByPriorityThenUpdatedDesc
  },
  {
    type: 'dependency_blocked',
    title: 'Dependency blocked',
    description: 'Work items in this milestone waiting on open blockers.',
    query: { dependency: 'dependency_blocked', sort: 'priority_desc' },
    filter: (workItem, context) =>
      isOpenWorkItem(workItem) && context.dependencyBlockedIds.has(workItem.id),
    sort: compareByPriorityThenUpdatedDesc
  },
  {
    type: 'overdue',
    title: 'Overdue work',
    description: 'Open work in this milestone past its due date.',
    query: { dueDateState: 'overdue', sort: 'due_date_asc' },
    filter: (workItem, context) =>
      isOpenWorkItem(workItem) && isOverdueDueDate(workItem.dueDate, context.today),
    sort: compareByDueDateThenPriority
  },
  {
    type: 'due_soon',
    title: 'Due soon',
    description: 'Open work in this milestone due within the planning window.',
    query: { dueDateState: 'due_soon', sort: 'due_date_asc' },
    filter: (workItem, context) =>
      isOpenWorkItem(workItem) &&
      isDueSoonDueDate(workItem.dueDate, context.today, context.dueSoonEnd),
    sort: compareByDueDateThenPriority
  },
  {
    type: 'unassigned_active',
    title: 'Unassigned active work',
    description: 'Ready or in-progress milestone work without an assignee.',
    query: { workRisk: 'unassigned_active', sort: 'priority_desc' },
    filter: (workItem) =>
      workItem.assigneeId === null && isActiveUnassignedWorkItemStatus(workItem.status),
    sort: compareByPriorityThenUpdatedDesc
  },
  {
    type: 'stale_in_progress',
    title: 'Stale in-progress work',
    description: 'In-progress milestone work that has not changed recently.',
    query: { workRisk: 'stale_in_progress', sort: 'updated_asc' },
    filter: (workItem, context) =>
      isStaleInProgressStatus(workItem.status, workItem.updatedAt, context.staleCutoff),
    sort: compareByUpdatedAsc
  },
  {
    type: 'blocking_open_work',
    title: 'Blocking open work',
    description: 'Work in this milestone blocking other open work items.',
    query: { dependency: 'blocking_open_work', sort: 'priority_desc' },
    filter: (workItem, context) =>
      isOpenWorkItem(workItem) && context.blockingOpenWorkIds.has(workItem.id),
    sort: compareByPriorityThenUpdatedDesc
  }
];

const cycleRiskSectionDefinitions: WorkRiskSectionDefinition<CycleReviewRiskType>[] = [
  ...workRiskSectionDefinitions,
  {
    type: 'unestimated',
    title: 'Unestimated work',
    description: 'Open cycle work without an estimate.',
    query: { workState: 'open', sort: 'priority_desc' },
    filter: (workItem) => isOpenWorkItem(workItem) && workItem.estimatePoints === null,
    sort: compareByPriorityThenUpdatedDesc
  }
];

export function createWorkRiskEvaluationContext(input: {
  now: Date;
  dependencyBlockedWorkItems: WorkItem[];
  blockingOpenWorkItems: WorkItem[];
}): WorkRiskEvaluationContext {
  return {
    today: toDateString(input.now),
    dueSoonEnd: toDateString(addDays(input.now, dueSoonWindowDays)),
    staleCutoff: addDays(input.now, -staleInProgressDays),
    dependencyBlockedIds: new Set(input.dependencyBlockedWorkItems.map((workItem) => workItem.id)),
    blockingOpenWorkIds: new Set(input.blockingOpenWorkItems.map((workItem) => workItem.id))
  };
}

export function createMilestoneReviewRiskSections(input: {
  milestoneId: string;
  workItems: WorkItem[];
  memberById: Map<string, Member>;
  milestoneById: Map<string, Milestone>;
  context: WorkRiskEvaluationContext;
}): MilestoneReviewRiskSectionDto[] {
  return workRiskSectionDefinitions.map((definition) => {
    const matchingItems = selectRiskSectionWorkItems(input.workItems, definition, input.context);

    return {
      type: definition.type,
      title: definition.title,
      description: definition.description,
      count: matchingItems.length,
      query: { milestoneId: input.milestoneId, ...definition.query },
      items: toPlanningRiskItems(
        matchingItems.slice(0, riskSectionPreviewLimit),
        input.memberById,
        input.milestoneById
      )
    };
  });
}

export function createCycleReviewRiskSections(input: {
  cycleId: string;
  workItems: WorkItem[];
  memberById: Map<string, Member>;
  milestoneById: Map<string, Milestone>;
  context: WorkRiskEvaluationContext;
  isOverTarget: boolean;
}): CycleReviewRiskSectionDto[] {
  const sections = cycleRiskSectionDefinitions.map((definition) => {
    const matchingItems = selectRiskSectionWorkItems(input.workItems, definition, input.context);

    return {
      type: definition.type,
      title: definition.title,
      description: definition.description,
      count: matchingItems.length,
      query: { cycleId: input.cycleId, ...definition.query },
      items: toPlanningRiskItems(
        matchingItems.slice(0, riskSectionPreviewLimit),
        input.memberById,
        input.milestoneById
      )
    };
  });

  const overTargetItems = input.isOverTarget
    ? input.workItems
        .filter(isOpenWorkItem)
        .sort(compareByPriorityThenUpdatedDesc)
        .slice(0, riskSectionPreviewLimit)
    : [];

  return [
    ...sections,
    {
      type: 'over_target',
      title: 'Over target',
      description: 'Estimated cycle scope exceeds the target points.',
      count: input.isOverTarget ? 1 : 0,
      query: { cycleId: input.cycleId, sort: 'priority_desc' },
      items: toPlanningRiskItems(overTargetItems, input.memberById, input.milestoneById)
    }
  ];
}

export function createProjectStatusReportRiskSnapshots(input: {
  workItems: WorkItem[];
  memberById: Map<string, Member>;
  milestoneById: Map<string, Milestone>;
  context: WorkRiskEvaluationContext;
}): ProjectStatusReportRiskSnapshotDto[] {
  return workRiskSectionDefinitions.map((definition) => {
    const matchingItems = selectRiskSectionWorkItems(input.workItems, definition, input.context);

    return {
      type: definition.type,
      title: definition.title,
      count: matchingItems.length,
      query: { ...definition.query },
      items: toPlanningRiskItems(
        matchingItems.slice(0, riskSectionPreviewLimit),
        input.memberById,
        input.milestoneById
      )
    };
  });
}

export function toPlanningRiskItems(
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

export function compareByDueDateThenPriority(left: WorkItem, right: WorkItem): number {
  const dueDateCompare = (left.dueDate ?? '').localeCompare(right.dueDate ?? '');

  if (dueDateCompare !== 0) {
    return dueDateCompare;
  }

  return priorityRank[right.priority] - priorityRank[left.priority];
}

export function compareByUpdatedAsc(left: WorkItem, right: WorkItem): number {
  return left.updatedAt.getTime() - right.updatedAt.getTime();
}

function selectRiskSectionWorkItems(
  workItems: WorkItem[],
  definition: WorkRiskSectionDefinition<string>,
  context: WorkRiskEvaluationContext
): WorkItem[] {
  return workItems.filter((workItem) => definition.filter(workItem, context)).sort(definition.sort);
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
