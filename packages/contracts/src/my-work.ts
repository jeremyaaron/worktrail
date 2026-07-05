import type { MemberDto } from './members.js';
import type { WorkItemQuery, WorkspaceWorkItemListItemDto } from './work-items.js';

export interface MyWorkSummaryCountDto {
  key:
    | 'assigned_open'
    | 'due_soon'
    | 'overdue'
    | 'blocked'
    | 'dependency_blocked'
    | 'stale_assigned'
    | 'reported_open';
  label: string;
  count: number;
  query: WorkItemQuery;
}

export interface MyWorkDashboardDto {
  actor: MemberDto;
  summaryCounts: MyWorkSummaryCountDto[];
  assignedToMe: WorkspaceWorkItemListItemDto[];
  dueSoonOrOverdue: WorkspaceWorkItemListItemDto[];
  blockedRelevant: WorkspaceWorkItemListItemDto[];
  dependencyBlockedAssigned: WorkspaceWorkItemListItemDto[];
  recentlyUpdated: WorkspaceWorkItemListItemDto[];
}
