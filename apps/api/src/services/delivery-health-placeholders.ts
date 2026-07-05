import type { PlanningReviewDto, ProjectDeliveryHealthDto } from '@worktrail/contracts';

export function createDefaultProjectDeliveryHealth(): ProjectDeliveryHealthDto {
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

export function createEmptyPlanningReview(): PlanningReviewDto {
  return {
    needsAttention: [],
    upcoming: [],
    recentlyChanged: []
  };
}
