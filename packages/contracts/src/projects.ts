import type {
  DeliveryHealthReasonDto,
  DeliveryHealthState,
  ProjectDeliveryHealthDto
} from './health.js';
import type { MemberDto } from './members.js';
import type { MilestoneStatus, PlanningRiskItemDto } from './planning.js';
import type { WorkItemQuery, WorkItemStatus } from './work-items.js';

export type ProjectStatus = 'active' | 'archived';

export interface ProjectDto {
  id: string;
  workspaceId: string;
  key: string;
  name: string;
  description: string;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectRequest {
  key?: string;
  name: string;
  description?: string;
}

export interface UpdateProjectRequest {
  key?: string;
  name?: string;
  description?: string;
  status?: ProjectStatus;
}

export interface ProjectStatusCountDto {
  status: WorkItemStatus;
  count: number;
}

export interface RecentWorkItemDto {
  id: string;
  displayKey: string;
  title: string;
  status: WorkItemStatus;
  updatedAt: string;
}

export interface ProjectSummaryDto {
  project: ProjectDto;
  countsByStatus: ProjectStatusCountDto[];
  recentWorkItems: RecentWorkItemDto[];
  deliveryHealth: ProjectDeliveryHealthDto;
}

export interface ProjectNavigationSummaryDto {
  project: ProjectDto;
  openWorkItemCount: number;
  blockedWorkItemCount: number;
  overdueWorkItemCount: number;
  updatedAt: string;
}

export interface ProjectStatusReportCountSnapshotDto {
  openWorkCount: number;
  blockedWorkCount: number;
  dependencyBlockedWorkCount: number;
  blockingOpenWorkCount: number;
  overdueWorkCount: number;
  dueSoonWorkCount: number;
  unassignedActiveWorkCount: number;
  staleInProgressWorkCount: number;
}

export interface ProjectStatusReportMilestoneSnapshotDto {
  id: string;
  name: string;
  status: MilestoneStatus;
  targetDate: string | null;
  totalCount: number;
  openCount: number;
  doneCount: number;
  blockedCount: number;
  dependencyBlockedCount: number;
  overdueCount: number;
  dueSoonCount: number;
  unassignedActiveCount: number;
  staleInProgressCount: number;
  health: DeliveryHealthState;
  reasons: DeliveryHealthReasonDto[];
}

export type ProjectStatusReportLinkType =
  | 'project_work'
  | 'milestone_review'
  | 'work_item';

export interface ProjectStatusReportLinkDto {
  type: ProjectStatusReportLinkType;
  label: string;
  projectId: string;
  query?: WorkItemQuery;
  milestoneId?: string;
  workItemId?: string;
}

export type ProjectStatusReportRiskType =
  | 'blocked'
  | 'dependency_blocked'
  | 'overdue'
  | 'due_soon'
  | 'unassigned_active'
  | 'stale_in_progress'
  | 'blocking_open_work';

export interface ProjectStatusReportRiskSnapshotDto {
  type: ProjectStatusReportRiskType;
  title: string;
  count: number;
  query: WorkItemQuery;
  items: PlanningRiskItemDto[];
}

export interface ProjectStatusReportSnapshotDto {
  snapshotVersion: 1;
  generatedAt: string;
  project: {
    id: string;
    key: string;
    name: string;
    status: ProjectStatus;
  };
  health: ProjectDeliveryHealthDto;
  counts: ProjectStatusReportCountSnapshotDto;
  milestones: ProjectStatusReportMilestoneSnapshotDto[];
  risks: ProjectStatusReportRiskSnapshotDto[];
  recentWork: PlanningRiskItemDto[];
}

export interface ProjectStatusReportSummaryDto {
  id: string;
  workspaceId: string;
  projectId: string;
  title: string;
  statusDate: string;
  health: DeliveryHealthState;
  author: MemberDto;
  publishedAt: string;
  createdAt: string;
}

export interface ProjectStatusReportDetailDto extends ProjectStatusReportSummaryDto {
  project: ProjectDto;
  summary: string;
  highlights: string;
  risks: string;
  nextSteps: string;
  snapshot: ProjectStatusReportSnapshotDto;
}

export interface ProjectStatusReportDraftDto {
  project: ProjectDto;
  title: string;
  statusDate: string;
  summary: string;
  highlights: string;
  risks: string;
  nextSteps: string;
  snapshot: ProjectStatusReportSnapshotDto;
}

export interface CreateProjectStatusReportRequest {
  title: string;
  statusDate: string;
  summary: string;
  highlights?: string;
  risks?: string;
  nextSteps?: string;
  snapshot?: ProjectStatusReportSnapshotDto;
}
