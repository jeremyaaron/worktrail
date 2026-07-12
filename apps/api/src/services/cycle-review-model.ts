import type {
  CycleReviewHealthDto,
  CycleReviewProgressDto,
  CycleReviewScopeBreakdownDto,
  DeliveryHealthReasonDto,
  WorkItemPriority,
  WorkItemStatus
} from '@worktrail/contracts';

import { workItemPriorities, workItemStatuses } from '../domain/constants.js';
import {
  isActiveUnassignedWorkItemStatus,
  isDueSoonDueDate,
  isOpenWorkItemStatus,
  isOverdueDueDate,
  isStaleInProgressStatus
} from '../domain/work-risk-policy.js';
import type { ProjectCycle, WorkItem } from '../repositories/types.js';
import type { WorkRiskEvaluationContext } from './work-risk-sections.js';

export interface CycleEvaluation {
  progress: CycleReviewProgressDto;
  health: CycleReviewHealthDto;
  scopeBreakdown: CycleReviewScopeBreakdownDto;
  isOverTarget: boolean;
}

export function createCycleEvaluation(input: {
  cycle: ProjectCycle;
  scopedWorkItems: WorkItem[];
  context: WorkRiskEvaluationContext;
}): CycleEvaluation {
  const progress = createCycleProgress(input.cycle, input.scopedWorkItems, input.context);

  return {
    progress,
    health: createCycleHealth(input.cycle, progress, input.scopedWorkItems, input.context),
    scopeBreakdown: createCycleScopeBreakdown(input.scopedWorkItems, input.context),
    isOverTarget: isCycleOverTarget(progress)
  };
}

export function createCycleProgress(
  cycle: ProjectCycle,
  scopedWorkItems: WorkItem[],
  context: WorkRiskEvaluationContext
): CycleReviewProgressDto {
  const openItems = scopedWorkItems.filter(isOpenWorkItem);
  const doneItems = scopedWorkItems.filter((workItem) => workItem.status === 'done');

  return {
    totalCount: scopedWorkItems.length,
    openCount: openItems.length,
    doneCount: doneItems.length,
    blockedCount: openItems.filter((workItem) => workItem.status === 'blocked').length,
    dependencyBlockedCount: openItems.filter((workItem) =>
      context.dependencyBlockedIds.has(workItem.id)
    ).length,
    committedEstimatePoints: sumEstimatePoints(scopedWorkItems),
    completedEstimatePoints: sumEstimatePoints(doneItems),
    unestimatedCount: openItems.filter((workItem) => workItem.estimatePoints === null).length,
    targetPoints: cycle.targetPoints
  };
}

export function createCycleHealth(
  cycle: ProjectCycle,
  progress: CycleReviewProgressDto,
  scopedWorkItems: WorkItem[],
  context: WorkRiskEvaluationContext
): CycleReviewHealthDto {
  if (cycle.archivedAt !== null || cycle.status === 'canceled') {
    return {
      health: 'inactive',
      reasons: [
        createReason(
          'inactive_milestone',
          'info',
          cycle.archivedAt === null ? 'Cycle is canceled.' : 'Cycle is archived.',
          1,
          {
            cycleId: cycle.id,
            sort: 'priority_desc'
          }
        )
      ]
    };
  }

  if (cycle.status === 'completed') {
    return {
      health: 'complete',
      reasons: [
        createReason('all_work_done', 'info', 'Cycle is completed.', 1, {
          cycleId: cycle.id,
          sort: 'priority_desc'
        })
      ]
    };
  }

  const reasons = createActiveCycleReasons(cycle, progress, scopedWorkItems, context);
  const hasBlockedReason = reasons.some(
    (reason) => reason.key === 'blocked_work' || reason.key === 'dependency_blocked'
  );

  if (cycle.status === 'active' && hasBlockedReason) {
    return { health: 'blocked', reasons };
  }

  if (reasons.length > 0) {
    return { health: 'at_risk', reasons };
  }

  return { health: 'healthy', reasons: [] };
}

export function createCycleScopeBreakdown(
  scopedWorkItems: WorkItem[],
  context: WorkRiskEvaluationContext
): CycleReviewScopeBreakdownDto {
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

export function isCycleOverTarget(progress: CycleReviewProgressDto): boolean {
  return progress.targetPoints !== null && progress.committedEstimatePoints > progress.targetPoints;
}

function createActiveCycleReasons(
  cycle: ProjectCycle,
  progress: CycleReviewProgressDto,
  scopedWorkItems: WorkItem[],
  context: WorkRiskEvaluationContext
): DeliveryHealthReasonDto[] {
  const openItems = scopedWorkItems.filter(isOpenWorkItem);
  const blockedCount = progress.blockedCount;
  const dependencyBlockedCount = progress.dependencyBlockedCount;
  const overdueCount = openItems.filter((workItem) =>
    isOverdueDueDate(workItem.dueDate, context.today)
  ).length;
  const dueSoonCount = openItems.filter((workItem) =>
    isDueSoonDueDate(workItem.dueDate, context.today, context.dueSoonEnd)
  ).length;
  const unassignedActiveCount = openItems.filter(
    (workItem) =>
      workItem.assigneeId === null && isActiveUnassignedWorkItemStatus(workItem.status)
  ).length;
  const staleInProgressCount = openItems.filter((workItem) =>
    isStaleInProgressStatus(workItem.status, workItem.updatedAt, context.staleCutoff)
  ).length;
  const reasons: DeliveryHealthReasonDto[] = [];

  if (blockedCount > 0) {
    reasons.push(
      createReason(
        'blocked_work',
        'critical',
        `${blockedCount} cycle work item${plural(blockedCount)} blocked.`,
        blockedCount,
        {
          cycleId: cycle.id,
          status: 'blocked',
          sort: 'priority_desc'
        }
      )
    );
  }

  if (dependencyBlockedCount > 0) {
    reasons.push(
      createReason(
        'dependency_blocked',
        'critical',
        `${dependencyBlockedCount} cycle work item${plural(dependencyBlockedCount)} blocked by dependencies.`,
        dependencyBlockedCount,
        {
          cycleId: cycle.id,
          dependency: 'dependency_blocked',
          sort: 'priority_desc'
        }
      )
    );
  }

  if (isCycleOverTarget(progress)) {
    const overBy = progress.committedEstimatePoints - (progress.targetPoints ?? 0);
    reasons.push(
      createReason(
        'cycle_over_target',
        'warning',
        `Cycle estimate is ${overBy} point${plural(overBy)} over target.`,
        overBy,
        {
          cycleId: cycle.id,
          sort: 'priority_desc'
        }
      )
    );
  }

  if (overdueCount > 0) {
    reasons.push(
      createReason(
        'overdue_work',
        'warning',
        `${overdueCount} cycle work item${plural(overdueCount)} overdue.`,
        overdueCount,
        {
          cycleId: cycle.id,
          dueDateState: 'overdue',
          sort: 'due_date_asc'
        }
      )
    );
  }

  if (dueSoonCount > 0) {
    reasons.push(
      createReason(
        'due_soon',
        'info',
        `${dueSoonCount} cycle work item${plural(dueSoonCount)} due soon.`,
        dueSoonCount,
        {
          cycleId: cycle.id,
          dueDateState: 'due_soon',
          sort: 'due_date_asc'
        }
      )
    );
  }

  if (unassignedActiveCount > 0) {
    reasons.push(
      createReason(
        'unassigned_active',
        'warning',
        `${unassignedActiveCount} active cycle work item${plural(unassignedActiveCount)} unassigned.`,
        unassignedActiveCount,
        {
          cycleId: cycle.id,
          workRisk: 'unassigned_active',
          sort: 'priority_desc'
        }
      )
    );
  }

  if (staleInProgressCount > 0) {
    reasons.push(
      createReason(
        'stale_in_progress',
        'warning',
        `${staleInProgressCount} in-progress cycle work item${plural(staleInProgressCount)} stale.`,
        staleInProgressCount,
        {
          cycleId: cycle.id,
          workRisk: 'stale_in_progress',
          sort: 'updated_asc'
        }
      )
    );
  }

  if (progress.unestimatedCount > 0) {
    reasons.push(
      createReason(
        'unestimated_work',
        'warning',
        `${progress.unestimatedCount} open cycle work item${plural(progress.unestimatedCount)} unestimated.`,
        progress.unestimatedCount,
        {
          cycleId: cycle.id,
          workState: 'open',
          sort: 'priority_desc'
        }
      )
    );
  }

  return reasons;
}

function createReason(
  key: DeliveryHealthReasonDto['key'],
  severity: DeliveryHealthReasonDto['severity'],
  message: string,
  count: number,
  query: DeliveryHealthReasonDto['query']
): DeliveryHealthReasonDto {
  return {
    key,
    severity,
    message,
    count,
    query
  };
}

function isOpenWorkItem(workItem: WorkItem): boolean {
  return isOpenWorkItemStatus(workItem.status);
}

function sumEstimatePoints(workItems: WorkItem[]): number {
  return workItems.reduce((total, workItem) => total + (workItem.estimatePoints ?? 0), 0);
}

function plural(count: number): string {
  return count === 1 ? '' : 's';
}
