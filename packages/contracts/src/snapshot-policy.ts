// Historical query and health shapes do not inherit future live-contract changes.
export interface SnapshotWorkItemQueryV1 {
  projectId?: string;
  status?: 'backlog' | 'ready' | 'in_progress' | 'blocked' | 'done' | 'canceled';
  workState?: 'open' | 'terminal';
  assigneeId?: string;
  assigneeState?: 'assigned' | 'unassigned';
  reporterId?: string;
  type?: 'task' | 'bug' | 'story' | 'chore';
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  labelId?: string;
  milestoneId?: string;
  cycleId?: string;
  dueDateState?: 'overdue' | 'due_soon' | 'none';
  blocked?: boolean;
  dependency?: 'dependency_blocked' | 'blocking_open_work';
  workRisk?: 'unassigned_active' | 'stale_in_progress';
  archivedProjects?: 'exclude' | 'include' | 'only';
  search?: string;
  sort?: 'updated_desc' | 'updated_asc' | 'priority_desc' | 'priority_asc' | 'due_date_asc' | 'created_desc' | 'board_order';
}

export interface SnapshotWorkItemQueryV2 extends SnapshotWorkItemQueryV1 {
  hierarchy?: 'top_level' | 'children' | 'parents';
  parentKey?: string;
  estimateState?: 'estimated' | 'unestimated';
}

export type SnapshotHealthState = 'healthy' | 'at_risk' | 'blocked' | 'complete' | 'inactive';
export type SnapshotHealthReasonKey =
  | 'all_work_done' | 'blocked_work' | 'blocking_open_work' | 'completed_with_open_work'
  | 'dependency_blocked' | 'due_soon' | 'empty_active_milestone' | 'inactive_milestone'
  | 'open_work' | 'overdue_work' | 'stale_in_progress' | 'target_date_past'
  | 'unassigned_active' | 'unestimated_work' | 'cycle_over_target' | 'unmilestoned_risk';

export interface SnapshotHealthReasonV1Dto {
  key: SnapshotHealthReasonKey;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  count: number;
  query: SnapshotWorkItemQueryV1 | null;
}

export interface SnapshotHealthReasonV2Dto extends Omit<SnapshotHealthReasonV1Dto, 'query'> {
  query: SnapshotWorkItemQueryV2 | null;
  countUnit: 'work_items' | 'milestones' | 'scope_conditions' | 'estimate_points';
}

export interface SnapshotProjectHealthV1Dto {
  health: SnapshotHealthState;
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
  reasons: SnapshotHealthReasonV1Dto[];
}

export interface SnapshotProjectHealthV2Dto extends Omit<SnapshotProjectHealthV1Dto, 'reasons'> {
  reasons: SnapshotHealthReasonV2Dto[];
}

export interface SnapshotCycleHealthV1Dto {
  health: SnapshotHealthState;
  reasons: SnapshotHealthReasonV1Dto[];
}

export interface SnapshotCycleHealthV2Dto extends Omit<SnapshotCycleHealthV1Dto, 'reasons'> {
  reasons: SnapshotHealthReasonV2Dto[];
}

export type HealthReasonReadDto = SnapshotHealthReasonV1Dto | SnapshotHealthReasonV2Dto;

export interface SnapshotMemberV1Dto {
  id: string; workspaceId: string; name: string; email: string;
  role: 'owner' | 'maintainer' | 'contributor'; isActive: boolean;
  deactivatedAt: string | null; createdAt: string; updatedAt: string;
}
export interface SnapshotMilestoneV1Dto {
  id: string; workspaceId: string; projectId: string; name: string; description: string;
  status: 'planned' | 'active' | 'completed' | 'canceled'; targetDate: string | null;
  isArchived: boolean; archivedAt: string | null; createdAt: string; updatedAt: string;
}
export interface SnapshotParentV1Dto {
  id: string; projectId: string; displayKey: string; title: string;
  type: NonNullable<SnapshotWorkItemQueryV1['type']>; status: NonNullable<SnapshotWorkItemQueryV1['status']>;
}
export interface SnapshotRiskItemV1Dto {
  id: string; displayKey: string; title: string;
  status: NonNullable<SnapshotWorkItemQueryV1['status']>; priority: NonNullable<SnapshotWorkItemQueryV1['priority']>;
  assignee: SnapshotMemberV1Dto | null; dueDate: string | null; milestone: SnapshotMilestoneV1Dto | null;
  updatedAt: string; parent?: SnapshotParentV1Dto | null;
}
export interface SnapshotCloseoutItemV1Dto {
  id: string; displayKey: string; title: string;
  status: NonNullable<SnapshotWorkItemQueryV1['status']>; priority: NonNullable<SnapshotWorkItemQueryV1['priority']>;
  assignee: { id: string; name: string } | null; estimatePoints: number | null; dependencyBlocked: boolean;
}

export function snapshotCountLabel(value: { count: number; countUnit?: SnapshotHealthReasonV2Dto['countUnit'] }): string {
  if (value.countUnit === undefined) return String(value.count);
  const nouns = {
    work_items: ['work item', 'work items'], milestones: ['milestone', 'milestones'],
    scope_conditions: ['scope condition', 'scope conditions'], estimate_points: ['estimate point', 'estimate points']
  };
  return `${value.count} ${nouns[value.countUnit][value.count === 1 ? 0 : 1]}`;
}

export function snapshotRiskCountLabel(value: { count: number; countUnit?: SnapshotHealthReasonV2Dto['countUnit'] }): string {
  return value.countUnit === undefined ? `${value.count} matching work item${value.count === 1 ? '' : 's'}` : snapshotCountLabel(value);
}
