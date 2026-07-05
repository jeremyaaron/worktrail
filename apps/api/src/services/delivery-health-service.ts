import type {
  DeliveryHealthReasonDto,
  DeliveryHealthSeverity,
  DeliveryHealthState,
  MilestoneProgressDto,
  PlanningReviewDto,
  PlanningReviewItemDto,
  ProjectDeliveryHealthDto,
  WorkItemQuery
} from '@worktrail/contracts';

import type { WorkItemPriority } from '../domain/constants.js';
import { openWorkItemStatuses, terminalWorkItemStatuses } from '../domain/constants.js';
import type { Milestone, Project, WorkItem } from '../repositories/types.js';
import { toMilestoneDto } from './dto.js';

const dueSoonWindowDays = 7;
const upcomingMilestoneWindowDays = 14;
const staleInProgressDays = 7;
const planningMilestoneStatuses = new Set<Milestone['status']>(['planned', 'active']);
const activeUnassignedStatuses = new Set<WorkItem['status']>(['ready', 'in_progress']);
const openStatusSet = new Set<WorkItem['status']>(openWorkItemStatuses);
const terminalStatusSet = new Set<WorkItem['status']>(terminalWorkItemStatuses);
const priorityRank: Record<WorkItemPriority, number> = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1
};
const severityRank: Record<DeliveryHealthSeverity, number> = {
  critical: 3,
  warning: 2,
  info: 1
};
const healthRank: Record<DeliveryHealthState, number> = {
  blocked: 5,
  at_risk: 4,
  healthy: 3,
  complete: 2,
  inactive: 1
};

export interface DeliveryHealthInput {
  project: Project;
  workItems: WorkItem[];
  dependencyBlockedWorkItems: WorkItem[];
  blockingOpenWorkItems: WorkItem[];
  milestones: Milestone[];
  now: Date;
}

export interface DeliveryHealthResult {
  deliveryHealth: ProjectDeliveryHealthDto;
  milestoneProgress: MilestoneProgressDto[];
  planningReview: PlanningReviewDto;
}

interface EvaluationContext {
  today: string;
  dueSoonEnd: string;
  upcomingMilestoneEnd: string;
  staleCutoff: Date;
  dependencyBlockedIds: Set<string>;
  blockingOpenWorkIds: Set<string>;
}

export class DeliveryHealthService {
  derive(input: DeliveryHealthInput): DeliveryHealthResult {
    const context = createEvaluationContext(input);
    const milestoneProgress = this.deriveMilestoneProgress(input, context);
    const deliveryHealth = this.deriveProjectDeliveryHealth(input, milestoneProgress, context);

    return {
      deliveryHealth,
      milestoneProgress,
      planningReview: this.derivePlanningReview(input, milestoneProgress, context)
    };
  }

  private deriveMilestoneProgress(
    input: DeliveryHealthInput,
    context: EvaluationContext
  ): MilestoneProgressDto[] {
    return input.milestones
      .map((milestone) => {
        const assignedItems = input.workItems.filter((workItem) => workItem.milestoneId === milestone.id);
        const openItems = assignedItems.filter(isOpenWorkItem);
        const blockedCount = openItems.filter((workItem) => workItem.status === 'blocked').length;
        const dependencyBlockedCount = openItems.filter((workItem) =>
          context.dependencyBlockedIds.has(workItem.id)
        ).length;
        const overdueCount = openItems.filter((workItem) => isOverdue(workItem, context.today)).length;
        const dueSoonCount = openItems.filter((workItem) =>
          isDueSoon(workItem, context.today, context.dueSoonEnd)
        ).length;
        const unassignedActiveCount = openItems.filter(
          (workItem) =>
            workItem.assigneeId === null && activeUnassignedStatuses.has(workItem.status)
        ).length;
        const staleInProgressCount = openItems.filter((workItem) =>
          isStaleInProgress(workItem, context.staleCutoff)
        ).length;
        const health = getMilestoneHealth({
          milestone,
          totalCount: assignedItems.length,
          openCount: openItems.length,
          blockedCount,
          dependencyBlockedCount,
          overdueCount,
          dueSoonCount,
          unassignedActiveCount,
          staleInProgressCount,
          today: context.today
        });

        return {
          milestone: toMilestoneDto(milestone),
          totalCount: assignedItems.length,
          doneCount: assignedItems.filter((workItem) => workItem.status === 'done').length,
          openCount: openItems.length,
          blockedCount,
          dependencyBlockedCount,
          overdueCount,
          dueSoonCount,
          unassignedActiveCount,
          staleInProgressCount,
          health,
          reasons: getMilestoneReasons({
            milestone,
            health,
            totalCount: assignedItems.length,
            openCount: openItems.length,
            blockedCount,
            dependencyBlockedCount,
            overdueCount,
            dueSoonCount,
            unassignedActiveCount,
            staleInProgressCount,
            today: context.today
          })
        };
      })
      .sort(compareMilestoneProgress);
  }

  private deriveProjectDeliveryHealth(
    input: DeliveryHealthInput,
    milestoneProgress: MilestoneProgressDto[],
    context: EvaluationContext
  ): ProjectDeliveryHealthDto {
    if (input.project.status === 'archived') {
      return {
        ...emptyProjectDeliveryHealth(),
        health: 'inactive',
        inactiveMilestoneCount: milestoneProgress.filter((progress) => progress.health === 'inactive').length,
        reasons: [
          createReason('inactive_milestone', 'info', 'Project is archived.', 1, null)
        ]
      };
    }

    const openWorkItems = input.workItems.filter(isOpenWorkItem);
    const dependencyBlockedWorkItems = openWorkItems.filter((workItem) =>
      context.dependencyBlockedIds.has(workItem.id)
    );
    const blockingOpenWorkItems = openWorkItems.filter((workItem) =>
      context.blockingOpenWorkIds.has(workItem.id)
    );
    const overdueWorkItems = openWorkItems.filter((workItem) => isOverdue(workItem, context.today));
    const dueSoonWorkItems = openWorkItems.filter((workItem) =>
      isDueSoon(workItem, context.today, context.dueSoonEnd)
    );
    const unassignedActiveWorkItems = openWorkItems.filter(
      (workItem) =>
        workItem.assigneeId === null && activeUnassignedStatuses.has(workItem.status)
    );
    const staleInProgressWorkItems = openWorkItems.filter((workItem) =>
      isStaleInProgress(workItem, context.staleCutoff)
    );
    const unmilestonedRiskItems = openWorkItems.filter(
      (workItem) =>
        workItem.milestoneId === null &&
        (workItem.status === 'blocked' ||
          context.dependencyBlockedIds.has(workItem.id) ||
          context.blockingOpenWorkIds.has(workItem.id) ||
          isOverdue(workItem, context.today) ||
          isDueSoon(workItem, context.today, context.dueSoonEnd) ||
          (workItem.assigneeId === null && activeUnassignedStatuses.has(workItem.status)) ||
          isStaleInProgress(workItem, context.staleCutoff))
    );
    const activeMilestones = milestoneProgress.filter((progress) =>
      ['healthy', 'at_risk', 'blocked'].includes(progress.health)
    );
    const reasons = getProjectReasons({
      blockedMilestoneCount: activeMilestones.filter((progress) => progress.health === 'blocked').length,
      atRiskMilestoneCount: activeMilestones.filter((progress) => progress.health === 'at_risk').length,
      blockedWorkCount: openWorkItems.filter((workItem) => workItem.status === 'blocked').length,
      dependencyBlockedWorkCount: dependencyBlockedWorkItems.length,
      blockingOpenWorkCount: blockingOpenWorkItems.length,
      overdueWorkCount: overdueWorkItems.length,
      dueSoonWorkCount: dueSoonWorkItems.length,
      unassignedActiveWorkCount: unassignedActiveWorkItems.length,
      staleInProgressWorkCount: staleInProgressWorkItems.length,
      unmilestonedActiveRiskCount: unmilestonedRiskItems.length
    });
    const health = getProjectHealth({
      activeMilestones,
      unmilestonedRiskItems,
      dependencyBlockedIds: context.dependencyBlockedIds,
      today: context.today,
      dueSoonEnd: context.dueSoonEnd,
      staleCutoff: context.staleCutoff
    });

    return {
      health,
      activeMilestoneCount: activeMilestones.length,
      healthyMilestoneCount: activeMilestones.filter((progress) => progress.health === 'healthy').length,
      atRiskMilestoneCount: activeMilestones.filter((progress) => progress.health === 'at_risk').length,
      blockedMilestoneCount: activeMilestones.filter((progress) => progress.health === 'blocked').length,
      completeMilestoneCount: milestoneProgress.filter((progress) => progress.health === 'complete').length,
      inactiveMilestoneCount: milestoneProgress.filter((progress) => progress.health === 'inactive').length,
      openWorkCount: openWorkItems.length,
      blockedWorkCount: openWorkItems.filter((workItem) => workItem.status === 'blocked').length,
      dependencyBlockedWorkCount: dependencyBlockedWorkItems.length,
      blockingOpenWorkCount: blockingOpenWorkItems.length,
      overdueWorkCount: overdueWorkItems.length,
      dueSoonWorkCount: dueSoonWorkItems.length,
      unassignedActiveWorkCount: unassignedActiveWorkItems.length,
      staleInProgressWorkCount: staleInProgressWorkItems.length,
      unmilestonedActiveRiskCount: unmilestonedRiskItems.length,
      reasons
    };
  }

  private derivePlanningReview(
    input: DeliveryHealthInput,
    milestoneProgress: MilestoneProgressDto[],
    context: EvaluationContext
  ): PlanningReviewDto {
    return {
      needsAttention: this.getNeedsAttention(input, milestoneProgress, context),
      upcoming: this.getUpcoming(input, milestoneProgress, context),
      recentlyChanged: this.getRecentlyChanged(input, milestoneProgress)
    };
  }

  private getNeedsAttention(
    input: DeliveryHealthInput,
    milestoneProgress: MilestoneProgressDto[],
    context: EvaluationContext
  ): PlanningReviewItemDto[] {
    const items: PlanningReviewItemDto[] = [
      ...input.workItems
        .filter(isOpenWorkItem)
        .filter(
          (workItem) =>
            workItem.status === 'blocked' ||
            context.dependencyBlockedIds.has(workItem.id) ||
            isOverdue(workItem, context.today) ||
            isStaleInProgress(workItem, context.staleCutoff) ||
            (workItem.assigneeId === null && activeUnassignedStatuses.has(workItem.status))
        )
        .map((workItem) => toWorkItemReviewItem(workItem, getWorkItemAttentionSeverity(workItem, context))),
      ...milestoneProgress
        .filter((progress) => progress.health === 'blocked' || progress.health === 'at_risk')
        .map((progress) =>
          toMilestoneReviewItem(
            input.milestones.find((milestone) => milestone.id === progress.milestone.id),
            progress.health === 'blocked' ? 'critical' : 'warning',
            `${progress.milestone.name} is ${progress.health === 'blocked' ? 'blocked' : 'at risk'}.`
          )
        )
        .filter((item): item is PlanningReviewItemDto => item !== null)
    ];

    return items.sort(comparePlanningReviewItems).slice(0, 8);
  }

  private getUpcoming(
    input: DeliveryHealthInput,
    milestoneProgress: MilestoneProgressDto[],
    context: EvaluationContext
  ): PlanningReviewItemDto[] {
    const activeMilestoneIds = new Set(
      milestoneProgress
        .filter((progress) => ['healthy', 'at_risk', 'blocked'].includes(progress.health))
        .map((progress) => progress.milestone.id)
    );
    const items: PlanningReviewItemDto[] = [
      ...input.workItems
        .filter((workItem) => isOpenWorkItem(workItem) && isDueSoon(workItem, context.today, context.dueSoonEnd))
        .map((workItem) => toWorkItemReviewItem(workItem, 'warning')),
      ...input.milestones
        .filter(
          (milestone) =>
            activeMilestoneIds.has(milestone.id) &&
            milestone.targetDate !== null &&
            milestone.targetDate >= context.today &&
            milestone.targetDate <= context.upcomingMilestoneEnd
        )
        .map((milestone) =>
          toMilestoneReviewItem(
            milestone,
            'info',
            `Target date ${milestone.targetDate}.`,
            { milestoneId: milestone.id, sort: 'due_date_asc' }
          )
        )
        .filter((item): item is PlanningReviewItemDto => item !== null)
    ];

    return items.sort(compareUpcomingReviewItems).slice(0, 8);
  }

  private getRecentlyChanged(
    input: DeliveryHealthInput,
    milestoneProgress: MilestoneProgressDto[]
  ): PlanningReviewItemDto[] {
    const activeMilestoneIds = new Set(
      milestoneProgress
        .filter((progress) => ['healthy', 'at_risk', 'blocked'].includes(progress.health))
        .map((progress) => progress.milestone.id)
    );
    const items: PlanningReviewItemDto[] = [
      ...input.workItems
        .filter(isOpenWorkItem)
        .map((workItem) => toWorkItemReviewItem(workItem, 'info')),
      ...input.milestones
        .filter((milestone) => activeMilestoneIds.has(milestone.id))
        .map((milestone) =>
          toMilestoneReviewItem(
            milestone,
            'info',
            `Updated ${milestone.updatedAt.toISOString()}.`,
            { milestoneId: milestone.id, sort: 'updated_desc' }
          )
        )
        .filter((item): item is PlanningReviewItemDto => item !== null)
    ];

    return items.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)).slice(0, 8);
  }
}

function createEvaluationContext(input: DeliveryHealthInput): EvaluationContext {
  const today = toDateString(input.now);

  return {
    today,
    dueSoonEnd: toDateString(addDays(input.now, dueSoonWindowDays)),
    upcomingMilestoneEnd: toDateString(addDays(input.now, upcomingMilestoneWindowDays)),
    staleCutoff: addDays(input.now, -staleInProgressDays),
    dependencyBlockedIds: new Set(input.dependencyBlockedWorkItems.filter(isOpenWorkItem).map((item) => item.id)),
    blockingOpenWorkIds: new Set(input.blockingOpenWorkItems.filter(isOpenWorkItem).map((item) => item.id))
  };
}

function getMilestoneHealth(input: {
  milestone: Milestone;
  totalCount: number;
  openCount: number;
  blockedCount: number;
  dependencyBlockedCount: number;
  overdueCount: number;
  dueSoonCount: number;
  unassignedActiveCount: number;
  staleInProgressCount: number;
  today: string;
}): DeliveryHealthState {
  if (input.milestone.archivedAt !== null || input.milestone.status === 'canceled') {
    return 'inactive';
  }

  if (input.milestone.status === 'completed' && input.openCount > 0) {
    return 'at_risk';
  }

  if (input.milestone.status === 'completed' || (input.totalCount > 0 && input.openCount === 0)) {
    return 'complete';
  }

  if (input.milestone.targetDate !== null && input.milestone.targetDate < input.today && input.openCount > 0) {
    return 'blocked';
  }

  if (input.blockedCount > 0 || input.dependencyBlockedCount > 0) {
    return 'blocked';
  }

  if (
    input.overdueCount > 0 ||
    input.dueSoonCount > 0 ||
    input.unassignedActiveCount > 0 ||
    input.staleInProgressCount > 0 ||
    (planningMilestoneStatuses.has(input.milestone.status) && input.totalCount === 0)
  ) {
    return 'at_risk';
  }

  return 'healthy';
}

function getMilestoneReasons(input: {
  milestone: Milestone;
  health: DeliveryHealthState;
  totalCount: number;
  openCount: number;
  blockedCount: number;
  dependencyBlockedCount: number;
  overdueCount: number;
  dueSoonCount: number;
  unassignedActiveCount: number;
  staleInProgressCount: number;
  today: string;
}): DeliveryHealthReasonDto[] {
  const milestoneQuery = (query: WorkItemQuery): WorkItemQuery => ({
    milestoneId: input.milestone.id,
    ...query
  });
  const reasons: DeliveryHealthReasonDto[] = [];

  if (input.health === 'inactive') {
    reasons.push(createReason('inactive_milestone', 'info', 'Milestone is inactive.', 1, null));
  }

  if (input.health === 'complete') {
    reasons.push(createReason('all_work_done', 'info', 'Milestone work is complete.', input.totalCount, milestoneQuery({
      workState: 'terminal',
      sort: 'updated_desc'
    })));
  }

  if (input.milestone.status === 'completed' && input.openCount > 0) {
    reasons.push(createReason(
      'completed_with_open_work',
      'warning',
      formatCount(input.openCount, 'open work item', 'open work items'),
      input.openCount,
      milestoneQuery({ workState: 'open', sort: 'priority_desc' })
    ));
  }

  if (input.milestone.targetDate !== null && input.milestone.targetDate < input.today && input.openCount > 0) {
    reasons.push(createReason(
      'target_date_past',
      'critical',
      `Target date passed with ${formatCount(input.openCount, 'open work item', 'open work items')}.`,
      input.openCount,
      milestoneQuery({ workState: 'open', sort: 'priority_desc' })
    ));
  }

  if (input.blockedCount > 0) {
    reasons.push(createReason('blocked_work', 'critical', formatCount(input.blockedCount, 'blocked work item', 'blocked work items'), input.blockedCount, milestoneQuery({
      status: 'blocked',
      sort: 'priority_desc'
    })));
  }

  if (input.dependencyBlockedCount > 0) {
    reasons.push(createReason(
      'dependency_blocked',
      'critical',
      formatCount(input.dependencyBlockedCount, 'dependency-blocked work item', 'dependency-blocked work items'),
      input.dependencyBlockedCount,
      milestoneQuery({ dependency: 'dependency_blocked', sort: 'priority_desc' })
    ));
  }

  if (input.overdueCount > 0) {
    reasons.push(createReason('overdue_work', 'warning', formatCount(input.overdueCount, 'overdue work item', 'overdue work items'), input.overdueCount, milestoneQuery({
      dueDateState: 'overdue',
      sort: 'due_date_asc'
    })));
  }

  if (input.dueSoonCount > 0) {
    reasons.push(createReason('due_soon', 'warning', formatCount(input.dueSoonCount, 'work item due soon', 'work items due soon'), input.dueSoonCount, milestoneQuery({
      dueDateState: 'due_soon',
      sort: 'due_date_asc'
    })));
  }

  if (input.unassignedActiveCount > 0) {
    reasons.push(createReason(
      'unassigned_active',
      'warning',
      formatCount(input.unassignedActiveCount, 'unassigned active work item', 'unassigned active work items'),
      input.unassignedActiveCount,
      milestoneQuery({ assigneeState: 'unassigned', workState: 'open', sort: 'priority_desc' })
    ));
  }

  if (input.staleInProgressCount > 0) {
    reasons.push(createReason(
      'stale_in_progress',
      'warning',
      formatCount(input.staleInProgressCount, 'stale in-progress work item', 'stale in-progress work items'),
      input.staleInProgressCount,
      milestoneQuery({ status: 'in_progress', sort: 'updated_asc' })
    ));
  }

  if (planningMilestoneStatuses.has(input.milestone.status) && input.totalCount === 0) {
    reasons.push(createReason('empty_active_milestone', 'warning', 'Milestone has no assigned work.', 1, null));
  }

  return reasons.sort(compareReasons);
}

function getProjectReasons(input: {
  blockedMilestoneCount: number;
  atRiskMilestoneCount: number;
  blockedWorkCount: number;
  dependencyBlockedWorkCount: number;
  blockingOpenWorkCount: number;
  overdueWorkCount: number;
  dueSoonWorkCount: number;
  unassignedActiveWorkCount: number;
  staleInProgressWorkCount: number;
  unmilestonedActiveRiskCount: number;
}): DeliveryHealthReasonDto[] {
  const reasons: DeliveryHealthReasonDto[] = [];

  if (input.blockedMilestoneCount > 0) {
    reasons.push(createReason('blocked_work', 'critical', formatCount(input.blockedMilestoneCount, 'blocked milestone', 'blocked milestones'), input.blockedMilestoneCount, null));
  }

  if (input.atRiskMilestoneCount > 0) {
    reasons.push(createReason('open_work', 'warning', formatCount(input.atRiskMilestoneCount, 'at-risk milestone', 'at-risk milestones'), input.atRiskMilestoneCount, null));
  }

  if (input.blockedWorkCount > 0) {
    reasons.push(createReason('blocked_work', 'critical', formatCount(input.blockedWorkCount, 'blocked work item', 'blocked work items'), input.blockedWorkCount, {
      status: 'blocked',
      sort: 'priority_desc'
    }));
  }

  if (input.dependencyBlockedWorkCount > 0) {
    reasons.push(createReason(
      'dependency_blocked',
      'critical',
      formatCount(input.dependencyBlockedWorkCount, 'dependency-blocked work item', 'dependency-blocked work items'),
      input.dependencyBlockedWorkCount,
      { dependency: 'dependency_blocked', sort: 'priority_desc' }
    ));
  }

  if (input.blockingOpenWorkCount > 0) {
    reasons.push(createReason(
      'blocking_open_work',
      'warning',
      formatCount(input.blockingOpenWorkCount, 'work item blocking open work', 'work items blocking open work'),
      input.blockingOpenWorkCount,
      { dependency: 'blocking_open_work', sort: 'priority_desc' }
    ));
  }

  if (input.overdueWorkCount > 0) {
    reasons.push(createReason('overdue_work', 'warning', formatCount(input.overdueWorkCount, 'overdue work item', 'overdue work items'), input.overdueWorkCount, {
      dueDateState: 'overdue',
      sort: 'due_date_asc'
    }));
  }

  if (input.dueSoonWorkCount > 0) {
    reasons.push(createReason('due_soon', 'warning', formatCount(input.dueSoonWorkCount, 'work item due soon', 'work items due soon'), input.dueSoonWorkCount, {
      dueDateState: 'due_soon',
      sort: 'due_date_asc'
    }));
  }

  if (input.unassignedActiveWorkCount > 0) {
    reasons.push(createReason(
      'unassigned_active',
      'warning',
      formatCount(input.unassignedActiveWorkCount, 'unassigned active work item', 'unassigned active work items'),
      input.unassignedActiveWorkCount,
      { assigneeState: 'unassigned', workState: 'open', sort: 'priority_desc' }
    ));
  }

  if (input.staleInProgressWorkCount > 0) {
    reasons.push(createReason(
      'stale_in_progress',
      'warning',
      formatCount(input.staleInProgressWorkCount, 'stale in-progress work item', 'stale in-progress work items'),
      input.staleInProgressWorkCount,
      { status: 'in_progress', sort: 'updated_asc' }
    ));
  }

  if (input.unmilestonedActiveRiskCount > 0) {
    reasons.push(createReason(
      'unmilestoned_risk',
      'warning',
      formatCount(input.unmilestonedActiveRiskCount, 'unmilestoned risk item', 'unmilestoned risk items'),
      input.unmilestonedActiveRiskCount,
      null
    ));
  }

  return reasons.sort(compareReasons).slice(0, 5);
}

function getProjectHealth(input: {
  activeMilestones: MilestoneProgressDto[];
  unmilestonedRiskItems: WorkItem[];
  dependencyBlockedIds: Set<string>;
  today: string;
  dueSoonEnd: string;
  staleCutoff: Date;
}): DeliveryHealthState {
  if (input.activeMilestones.some((progress) => progress.health === 'blocked')) {
    return 'blocked';
  }

  if (
    input.unmilestonedRiskItems.some(
      (workItem) => workItem.status === 'blocked' || input.dependencyBlockedIds.has(workItem.id)
    )
  ) {
    return 'blocked';
  }

  if (input.activeMilestones.some((progress) => progress.health === 'at_risk')) {
    return 'at_risk';
  }

  if (
    input.unmilestonedRiskItems.some(
      (workItem) =>
        isOverdue(workItem, input.today) ||
        isDueSoon(workItem, input.today, input.dueSoonEnd) ||
        (workItem.assigneeId === null && activeUnassignedStatuses.has(workItem.status)) ||
        isStaleInProgress(workItem, input.staleCutoff)
    )
  ) {
    return 'at_risk';
  }

  return 'healthy';
}

function emptyProjectDeliveryHealth(): ProjectDeliveryHealthDto {
  return {
    health: 'healthy',
    activeMilestoneCount: 0,
    healthyMilestoneCount: 0,
    atRiskMilestoneCount: 0,
    blockedMilestoneCount: 0,
    completeMilestoneCount: 0,
    inactiveMilestoneCount: 0,
    openWorkCount: 0,
    blockedWorkCount: 0,
    dependencyBlockedWorkCount: 0,
    blockingOpenWorkCount: 0,
    overdueWorkCount: 0,
    dueSoonWorkCount: 0,
    unassignedActiveWorkCount: 0,
    staleInProgressWorkCount: 0,
    unmilestonedActiveRiskCount: 0,
    reasons: []
  };
}

function createReason(
  key: DeliveryHealthReasonDto['key'],
  severity: DeliveryHealthSeverity,
  message: string,
  count: number,
  query: WorkItemQuery | null
): DeliveryHealthReasonDto {
  return {
    key,
    severity,
    message,
    count,
    query
  };
}

function toWorkItemReviewItem(
  workItem: WorkItem,
  severity: DeliveryHealthSeverity
): PlanningReviewItemDto {
  return {
    id: workItem.id,
    kind: 'work_item',
    title: workItem.title,
    detail: `${workItem.status} · ${workItem.priority}`,
    severity,
    workItemId: workItem.id,
    milestoneId: workItem.milestoneId,
    displayKey: workItem.displayKey,
    dueDate: workItem.dueDate,
    updatedAt: workItem.updatedAt.toISOString(),
    query: null
  };
}

function toMilestoneReviewItem(
  milestone: Milestone | undefined,
  severity: DeliveryHealthSeverity,
  detail: string,
  query: WorkItemQuery | null = null
): PlanningReviewItemDto | null {
  if (milestone === undefined) {
    return null;
  }

  return {
    id: milestone.id,
    kind: 'milestone',
    title: milestone.name,
    detail,
    severity,
    workItemId: null,
    milestoneId: milestone.id,
    displayKey: null,
    dueDate: milestone.targetDate,
    updatedAt: milestone.updatedAt.toISOString(),
    query
  };
}

function getWorkItemAttentionSeverity(
  workItem: WorkItem,
  context: EvaluationContext
): DeliveryHealthSeverity {
  if (workItem.status === 'blocked' || context.dependencyBlockedIds.has(workItem.id)) {
    return 'critical';
  }

  return 'warning';
}

function isOpenWorkItem(workItem: WorkItem): boolean {
  return openStatusSet.has(workItem.status) && !terminalStatusSet.has(workItem.status);
}

function isOverdue(workItem: WorkItem, today: string): boolean {
  return workItem.dueDate !== null && workItem.dueDate < today;
}

function isDueSoon(workItem: WorkItem, today: string, dueSoonEnd: string): boolean {
  return workItem.dueDate !== null && workItem.dueDate >= today && workItem.dueDate <= dueSoonEnd;
}

function isStaleInProgress(workItem: WorkItem, staleCutoff: Date): boolean {
  return workItem.status === 'in_progress' && workItem.updatedAt.getTime() < staleCutoff.getTime();
}

function compareMilestoneProgress(left: MilestoneProgressDto, right: MilestoneProgressDto): number {
  const healthCompare = healthRank[right.health] - healthRank[left.health];

  if (healthCompare !== 0) {
    return healthCompare;
  }

  const targetDateCompare = (left.milestone.targetDate ?? '9999-12-31').localeCompare(
    right.milestone.targetDate ?? '9999-12-31'
  );

  if (targetDateCompare !== 0) {
    return targetDateCompare;
  }

  return left.milestone.name.localeCompare(right.milestone.name);
}

function compareReasons(left: DeliveryHealthReasonDto, right: DeliveryHealthReasonDto): number {
  const severityCompare = severityRank[right.severity] - severityRank[left.severity];

  if (severityCompare !== 0) {
    return severityCompare;
  }

  if (left.count !== right.count) {
    return right.count - left.count;
  }

  return left.key.localeCompare(right.key);
}

function comparePlanningReviewItems(
  left: PlanningReviewItemDto,
  right: PlanningReviewItemDto
): number {
  const severityCompare = severityRank[right.severity] - severityRank[left.severity];

  if (severityCompare !== 0) {
    return severityCompare;
  }

  return compareUpcomingReviewItems(left, right);
}

function compareUpcomingReviewItems(
  left: PlanningReviewItemDto,
  right: PlanningReviewItemDto
): number {
  const dueDateCompare = (left.dueDate ?? '9999-12-31').localeCompare(right.dueDate ?? '9999-12-31');

  if (dueDateCompare !== 0) {
    return dueDateCompare;
  }

  return right.updatedAt.localeCompare(left.updatedAt);
}

function addDays(date: Date, days: number): Date {
  const nextDate = new Date(date.getTime());
  nextDate.setUTCDate(nextDate.getUTCDate() + days);
  return nextDate;
}

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatCount(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
