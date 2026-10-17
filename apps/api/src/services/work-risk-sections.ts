import type {
  CycleReviewRiskSectionDto,
  CycleReviewRiskType,
  MilestoneReviewRiskSectionDto,
  MilestoneReviewRiskType,
  PlanningRiskItemDto,
  ProjectStatusReportRiskSnapshotV2Dto,
  WorkItemParentDto,
  WorkItemPriority,
  WorkItemQuery
} from '@worktrail/contracts';

import {
  createRiskTimeWindow,
  distinctWorkItems,
  isActiveUnassignedWorkItemStatus,
  isDueSoonDueDate,
  isOpenWorkItemStatus,
  isOverdueDueDate,
  isStaleInProgressStatus,
} from '../domain/work-risk-policy.js';
import type { Member, Milestone, WorkItemEvaluation, WorkItemEvaluationFacts } from '../repositories/types.js';
import type { Repositories } from '../repositories/index.js';
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
  description: (scope: 'project' | 'milestone' | 'cycle') => string;
  query: WorkItemQuery;
  filter: (workItem: WorkItemEvaluationFacts, context: WorkRiskEvaluationContext) => boolean;
  sort: (left: WorkItemEvaluationFacts, right: WorkItemEvaluationFacts) => number;
}

const workRiskSectionDefinitions: WorkRiskSectionDefinition<MilestoneReviewRiskType>[] = [
  {
    type: 'blocked',
    title: 'Blocked work',
    description: (scope) => `Work items in this ${scope} currently marked blocked.`,
    query: { status: 'blocked', sort: 'priority_desc' },
    filter: (workItem) => isOpenWorkItem(workItem) && workItem.status === 'blocked',
    sort: compareByPriorityThenUpdatedDesc
  },
  {
    type: 'dependency_blocked',
    title: 'Dependency blocked',
    description: (scope) => `Work items in this ${scope} waiting on open blockers.`,
    query: { dependency: 'dependency_blocked', sort: 'priority_desc' },
    filter: (workItem, context) =>
      isOpenWorkItem(workItem) && context.dependencyBlockedIds.has(workItem.id),
    sort: compareByPriorityThenUpdatedDesc
  },
  {
    type: 'overdue',
    title: 'Overdue work',
    description: (scope) => `Open work in this ${scope} past its due date.`,
    query: { dueDateState: 'overdue', sort: 'due_date_asc' },
    filter: (workItem, context) =>
      isOpenWorkItem(workItem) && isOverdueDueDate(workItem.dueDate, context.today),
    sort: compareByDueDateThenPriority
  },
  {
    type: 'due_soon',
    title: 'Due soon',
    description: (scope) => `Open work in this ${scope} due within the planning window.`,
    query: { dueDateState: 'due_soon', sort: 'due_date_asc' },
    filter: (workItem, context) =>
      isOpenWorkItem(workItem) &&
      isDueSoonDueDate(workItem.dueDate, context.today, context.dueSoonEnd),
    sort: compareByDueDateThenPriority
  },
  {
    type: 'unassigned_active',
    title: 'Unassigned active work',
    description: (scope) => `Ready or in-progress ${scope} work without an assignee.`,
    query: { workRisk: 'unassigned_active', sort: 'priority_desc' },
    filter: (workItem) =>
      workItem.assigneeId === null && isActiveUnassignedWorkItemStatus(workItem.status),
    sort: compareByPriorityThenUpdatedDesc
  },
  {
    type: 'stale_in_progress',
    title: 'Stale in-progress work',
    description: (scope) => `In-progress ${scope} work that has not changed recently.`,
    query: { workRisk: 'stale_in_progress', sort: 'updated_asc' },
    filter: (workItem, context) =>
      isStaleInProgressStatus(workItem.status, workItem.updatedAt, context.staleCutoff),
    sort: compareByUpdatedAsc
  },
  {
    type: 'blocking_open_work',
    title: 'Blocking open work',
    description: (scope) => `Work in this ${scope} blocking other open work items.`,
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
    description: (scope) => `Open ${scope} work without an estimate.`,
    query: { workState: 'open', estimateState: 'unestimated', sort: 'priority_desc' },
    filter: (workItem) => isOpenWorkItem(workItem) && workItem.estimatePoints === null,
    sort: compareByPriorityThenUpdatedDesc
  }
];

export function riskContextFromEvaluation(workItems: WorkItemEvaluation[], now: Date): WorkRiskEvaluationContext {
  return createWorkRiskEvaluationContext({ now,
    dependencyBlockedWorkItems: workItems.filter(item => item.dependencyBlocked),
    blockingOpenWorkItems: workItems.filter(item => item.blockingOpenWork) });
}

export function createWorkRiskEvaluationContext(input: {
  now: Date;
  dependencyBlockedWorkItems: WorkItemEvaluationFacts[];
  blockingOpenWorkItems: WorkItemEvaluationFacts[];
}): WorkRiskEvaluationContext {
  return {
    ...createRiskTimeWindow(input.now),
    dependencyBlockedIds: new Set(input.dependencyBlockedWorkItems.map((workItem) => workItem.id)),
    blockingOpenWorkIds: new Set(input.blockingOpenWorkItems.map((workItem) => workItem.id))
  };
}

export function selectMilestoneReviewRiskSections(input: {
  milestoneId?: string;
  workItems: WorkItemEvaluationFacts[];
  context: WorkRiskEvaluationContext;
}): SelectedRiskSection<MilestoneReviewRiskSectionDto>[] {
  const boardOrder = new Map(input.workItems.map((item, index) => [item.id, index]));
  return workRiskSectionDefinitions.map((definition) => {
    const matchingItems = selectRiskSectionWorkItems(input.workItems, definition, input.context);
    // Planning historically uses board order for these two previews; scoped reviews use risk priority.
    if (input.milestoneId === undefined && ['blocked', 'unassigned_active'].includes(definition.type)) {
      matchingItems.sort((left, right) => boardOrder.get(left.id)! - boardOrder.get(right.id)!);
    }

    return {
      type: definition.type,
      title: definition.title,
      description: definition.description(input.milestoneId === undefined ? 'project' : 'milestone'),
      count: matchingItems.length,
      countUnit: 'work_items',
      query: { ...(input.milestoneId === undefined ? {} : { milestoneId: input.milestoneId }), ...definition.query },
      items: matchingItems.slice(0, riskSectionPreviewLimit)
    };
  });
}

export function selectCycleReviewRiskSections(input: {
  cycleId: string;
  workItems: WorkItemEvaluationFacts[];
  context: WorkRiskEvaluationContext;
  isOverTarget: boolean;
}): SelectedRiskSection<CycleReviewRiskSectionDto>[] {
  const sections = cycleRiskSectionDefinitions.map((definition) => {
    const matchingItems = selectRiskSectionWorkItems(input.workItems, definition, input.context);

    return {
      type: definition.type,
      title: definition.title,
      description: definition.description('cycle'),
      count: matchingItems.length,
      countUnit: 'work_items' as const,
      query: { cycleId: input.cycleId, ...definition.query },
      items: matchingItems.slice(0, riskSectionPreviewLimit)
    };
  });

  const overTargetItems = input.isOverTarget
    ? distinctWorkItems(input.workItems)
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
      countUnit: 'scope_conditions',
      query: { cycleId: input.cycleId, sort: 'priority_desc' },
      items: overTargetItems
    }
  ];
}

export function selectProjectStatusReportRiskSnapshots(input: {
  workItems: WorkItemEvaluationFacts[];
  context: WorkRiskEvaluationContext;
}): SelectedRiskSection<ProjectStatusReportRiskSnapshotV2Dto>[] {
  return workRiskSectionDefinitions.map((definition) => {
    const matchingItems = selectRiskSectionWorkItems(input.workItems, definition, input.context);

    return {
      type: definition.type,
      title: definition.title,
      count: matchingItems.length,
      countUnit: 'work_items',
      query: { ...definition.query },
      items: matchingItems.slice(0, riskSectionPreviewLimit)
    };
  });
}


export type SelectedRiskSection<T> = Omit<T, "items"> & { items: WorkItemEvaluationFacts[] };
export interface RiskReferences {
  memberById: Map<string, Member>;
  milestoneById: Map<string, Milestone>;
  parentByChildId: Map<string, WorkItemParentDto>;
}

export function enrichRiskItems(items: WorkItemEvaluationFacts[], references: RiskReferences): PlanningRiskItemDto[] {
  return toPlanningRiskItems(items, references.memberById, references.milestoneById, references.parentByChildId);
}

export async function loadRiskReferences(items: WorkItemEvaluationFacts[], repositories: Repositories): Promise<RiskReferences> {
  const selected = distinctWorkItems(items);
  const members = await repositories.members.listByIds([...new Set(selected.flatMap(item => item.assigneeId === null ? [] : [item.assigneeId]))]);
  const milestones = await repositories.milestones.listByIds([...new Set(selected.flatMap(item => item.milestoneId === null ? [] : [item.milestoneId]))]);
  return { memberById: new Map(members.map(member => [member.id, member])), milestoneById: new Map(milestones.map(milestone => [milestone.id, milestone])),
    parentByChildId: await loadPlanningRiskParents(selected, repositories) };
}

export function createMilestoneReviewRiskSections(input: Parameters<typeof selectMilestoneReviewRiskSections>[0] & RiskReferences): MilestoneReviewRiskSectionDto[] {
  return selectMilestoneReviewRiskSections(input).map(section => ({ ...section, items: toPlanningRiskItems(section.items, input.memberById, input.milestoneById, input.parentByChildId) }));
}

export function createCycleReviewRiskSections(input: Parameters<typeof selectCycleReviewRiskSections>[0] & RiskReferences): CycleReviewRiskSectionDto[] {
  return selectCycleReviewRiskSections(input).map(section => ({ ...section, items: toPlanningRiskItems(section.items, input.memberById, input.milestoneById, input.parentByChildId) }));
}

export function createProjectStatusReportRiskSnapshots(input: Parameters<typeof selectProjectStatusReportRiskSnapshots>[0] & RiskReferences): ProjectStatusReportRiskSnapshotV2Dto[] {
  return selectProjectStatusReportRiskSnapshots(input).map(section => ({ ...section, items: toPlanningRiskItems(section.items, input.memberById, input.milestoneById, input.parentByChildId) }));
}

export function toPlanningRiskItems(
  workItems: WorkItemEvaluationFacts[],
  memberById: Map<string, Member>,
  milestoneById: Map<string, Milestone>,
  parentByChildId: Map<string, WorkItemParentDto>
): PlanningRiskItemDto[] {
  return workItems.map((workItem) => {
    const assignedMember =
      workItem.assigneeId === null ? null : memberById.get(workItem.assigneeId) ?? null;
    const assignee = assignedMember?.workspaceId === workItem.workspaceId ? assignedMember : null;
    const assignedMilestone =
      workItem.milestoneId === null ? null : milestoneById.get(workItem.milestoneId) ?? null;
    const milestone = assignedMilestone?.workspaceId === workItem.workspaceId && assignedMilestone.projectId === workItem.projectId ? assignedMilestone : null;

    return {
      id: workItem.id,
      displayKey: workItem.displayKey,
      title: workItem.title,
      status: workItem.status,
      priority: workItem.priority,
      assignee: assignee === null ? null : toMemberDto(assignee),
      dueDate: workItem.dueDate,
      milestone: milestone === null ? null : toMilestoneDto(milestone),
      updatedAt: workItem.updatedAt.toISOString(),
      parent: parentByChildId.get(workItem.id) ?? null
    };
  });
}

export async function loadPlanningRiskParents(
  workItems: WorkItemEvaluationFacts[],
  repositories: Repositories
): Promise<Map<string, WorkItemParentDto>> {
  const workItemIds = [...new Set(workItems.map((workItem) => workItem.id))];

  if (workItemIds.length === 0) {
    return new Map();
  }

  const parentRecords = await repositories.workItems.listParentsForChildren(workItemIds);
  const childById = new Map(workItems.map(item => [item.id, item]));

  return new Map(
    parentRecords.filter(({ childWorkItemId, parent }) => {
      const child = childById.get(childWorkItemId);
      return child?.workspaceId === parent.workspaceId && child.projectId === parent.projectId;
    }).map(({ childWorkItemId, parent }) => [
      childWorkItemId,
      {
        id: parent.id,
        projectId: parent.projectId,
        displayKey: parent.displayKey,
        title: parent.title,
        type: parent.type,
        status: parent.status
      }
    ])
  );
}

export function compareByDueDateThenPriority(left: WorkItemEvaluationFacts, right: WorkItemEvaluationFacts): number {
  const dueDateCompare = (left.dueDate ?? '').localeCompare(right.dueDate ?? '');

  if (dueDateCompare !== 0) {
    return dueDateCompare;
  }

  return priorityRank[right.priority] - priorityRank[left.priority];
}

export function compareByUpdatedAsc(left: WorkItemEvaluationFacts, right: WorkItemEvaluationFacts): number {
  return left.updatedAt.getTime() - right.updatedAt.getTime();
}

function selectRiskSectionWorkItems(
  workItems: WorkItemEvaluationFacts[],
  definition: WorkRiskSectionDefinition<string>,
  context: WorkRiskEvaluationContext
): WorkItemEvaluationFacts[] {
  return distinctWorkItems(workItems).filter((workItem) => definition.filter(workItem, context)).sort(definition.sort);
}

function isOpenWorkItem(workItem: WorkItemEvaluationFacts): boolean {
  return isOpenWorkItemStatus(workItem.status);
}

function compareByPriorityThenUpdatedDesc(left: WorkItemEvaluationFacts, right: WorkItemEvaluationFacts): number {
  const priorityCompare = priorityRank[right.priority] - priorityRank[left.priority];

  if (priorityCompare !== 0) {
    return priorityCompare;
  }

  return right.updatedAt.getTime() - left.updatedAt.getTime();
}
