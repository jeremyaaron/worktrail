import type { WorkItemQuery } from './work-items.js';

export interface ApiHealthResponse {
  status: 'ok';
  service: 'worktrail-api';
  checkedAt: string;
}

export interface ApiReadinessResponse {
  status: 'ready';
  service: 'worktrail-api';
  checks: {
    database: 'ok';
  };
  checkedAt: string;
}

export interface ApiReadinessFailureResponse {
  error: {
    code: 'READINESS_FAILED';
    message: string;
    checks: {
      database: 'failed';
    };
  };
}

export type DeliveryHealthState = 'healthy' | 'at_risk' | 'blocked' | 'complete' | 'inactive';
export type DeliveryHealthSeverity = 'info' | 'warning' | 'critical';
export type DeliveryHealthReasonKey =
  | 'all_work_done'
  | 'blocked_work'
  | 'blocking_open_work'
  | 'completed_with_open_work'
  | 'dependency_blocked'
  | 'due_soon'
  | 'empty_active_milestone'
  | 'inactive_milestone'
  | 'open_work'
  | 'overdue_work'
  | 'stale_in_progress'
  | 'target_date_past'
  | 'unassigned_active'
  | 'unmilestoned_risk';

export interface DeliveryHealthReasonDto {
  key: DeliveryHealthReasonKey;
  severity: DeliveryHealthSeverity;
  message: string;
  count: number;
  query: WorkItemQuery | null;
}

export interface ProjectDeliveryHealthDto {
  health: DeliveryHealthState;
  activeMilestoneCount: number;
  healthyMilestoneCount: number;
  atRiskMilestoneCount: number;
  blockedMilestoneCount: number;
  completeMilestoneCount: number;
  inactiveMilestoneCount: number;
  openWorkCount: number;
  blockedWorkCount: number;
  dependencyBlockedWorkCount: number;
  blockingOpenWorkCount: number;
  overdueWorkCount: number;
  dueSoonWorkCount: number;
  unassignedActiveWorkCount: number;
  staleInProgressWorkCount: number;
  unmilestonedActiveRiskCount: number;
  reasons: DeliveryHealthReasonDto[];
}
