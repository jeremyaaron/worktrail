import type { DeliveryHealthReasonDto, DeliveryHealthSeverity, DeliveryHealthState, ProjectDeliveryHealthDto } from './health.js';
import type { MemberDto } from './members.js';
import type { ProjectDto } from './projects.js';
import type { WorkItemPriority, WorkItemQuery, WorkItemStatus } from './work-items.js';

export type MilestoneStatus = 'planned' | 'active' | 'completed' | 'canceled';
export type PlanningReviewItemKind = 'work_item' | 'milestone' | 'activity';
export type MilestoneReviewRiskType =
  | 'blocked'
  | 'dependency_blocked'
  | 'overdue'
  | 'due_soon'
  | 'unassigned_active'
  | 'stale_in_progress'
  | 'blocking_open_work';

export interface MilestoneDto {
  id: string;
  workspaceId: string;
  projectId: string;
  name: string;
  description: string;
  status: MilestoneStatus;
  targetDate: string | null;
  isArchived: boolean;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMilestoneRequest {
  name: string;
  description?: string;
  status?: MilestoneStatus;
  targetDate?: string | null;
}

export interface UpdateMilestoneRequest {
  name?: string;
  description?: string;
  status?: MilestoneStatus;
  targetDate?: string | null;
}

export interface MilestoneProgressDto {
  milestone: MilestoneDto;
  totalCount: number;
  doneCount: number;
  openCount: number;
  blockedCount: number;
  dependencyBlockedCount: number;
  overdueCount: number;
  dueSoonCount: number;
  unassignedActiveCount: number;
  staleInProgressCount: number;
  health: DeliveryHealthState;
  reasons: DeliveryHealthReasonDto[];
}

export interface PlanningRiskItemDto {
  id: string;
  displayKey: string;
  title: string;
  status: WorkItemStatus;
  priority: WorkItemPriority;
  assignee: MemberDto | null;
  dueDate: string | null;
  milestone: MilestoneDto | null;
  updatedAt: string;
}

export interface PlanningReviewItemDto {
  id: string;
  kind: PlanningReviewItemKind;
  title: string;
  detail: string;
  severity: DeliveryHealthSeverity;
  workItemId: string | null;
  milestoneId: string | null;
  displayKey: string | null;
  dueDate: string | null;
  updatedAt: string;
  query: WorkItemQuery | null;
}

export interface PlanningReviewDto {
  needsAttention: PlanningReviewItemDto[];
  upcoming: PlanningReviewItemDto[];
  recentlyChanged: PlanningReviewItemDto[];
}

export interface ProjectPlanningSummaryDto {
  project: ProjectDto;
  deliveryHealth: ProjectDeliveryHealthDto;
  milestoneProgress: MilestoneProgressDto[];
  planningReview: PlanningReviewDto;
  blockedWork: PlanningRiskItemDto[];
  overdueWork: PlanningRiskItemDto[];
  dueSoonWork: PlanningRiskItemDto[];
  unassignedActiveWork: PlanningRiskItemDto[];
  staleInProgressWork: PlanningRiskItemDto[];
  dependencyBlockedWork: PlanningRiskItemDto[];
  blockingOpenWork: PlanningRiskItemDto[];
}

export interface MilestoneReviewScopeBreakdownDto {
  statusCounts: Record<WorkItemStatus, number>;
  priorityCounts: Record<WorkItemPriority, number>;
  assignedCount: number;
  unassignedCount: number;
  dueDate: {
    overdueCount: number;
    dueSoonCount: number;
    laterCount: number;
    noneCount: number;
  };
  dependency: {
    dependencyBlockedCount: number;
    blockingOpenWorkCount: number;
  };
}

export interface MilestoneReviewRiskSectionDto {
  type: MilestoneReviewRiskType;
  title: string;
  description: string;
  count: number;
  query: WorkItemQuery;
  items: PlanningRiskItemDto[];
}

export interface MilestoneReviewDto {
  project: ProjectDto;
  milestone: MilestoneDto;
  progress: MilestoneProgressDto;
  scopedWorkQuery: WorkItemQuery;
  scopeBreakdown: MilestoneReviewScopeBreakdownDto;
  riskSections: MilestoneReviewRiskSectionDto[];
  recentlyChangedWork: PlanningRiskItemDto[];
}
