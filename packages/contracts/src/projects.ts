import type { SnapshotRiskItemV1Dto, SnapshotHealthState, SnapshotHealthReasonV1Dto, SnapshotHealthReasonV2Dto, SnapshotProjectHealthV1Dto, SnapshotProjectHealthV2Dto, SnapshotWorkItemQueryV1, SnapshotWorkItemQueryV2 } from './snapshot-policy.js';
import type {
  DeliveryHealthState,
  ProjectDeliveryHealthDto
} from './health.js';
import type { MemberDto } from './members.js';
import type { WorkItemStatus } from './work-items.js';

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

export interface ProjectStatusReportMilestoneSnapshotV1Dto {
  id: string;
  name: string;
  status: 'planned' | 'active' | 'completed' | 'canceled';
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
  health: SnapshotHealthState;
  reasons: SnapshotHealthReasonV1Dto[];
}

export type ProjectStatusReportLinkType =
  | 'project_work'
  | 'milestone_review'
  | 'cycle_review'
  | 'work_item';

export interface ProjectStatusReportLinkV1Dto {
  type: ProjectStatusReportLinkType;
  label: string;
  projectId: string;
  query?: SnapshotWorkItemQueryV1;
  milestoneId?: string;
  cycleId?: string;
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

export interface ProjectStatusReportRiskSnapshotV1Dto {
  type: ProjectStatusReportRiskType;
  title: string;
  count: number;
  query: SnapshotWorkItemQueryV1;
  items: SnapshotRiskItemV1Dto[];
}

export interface ProjectStatusReportCycleSnapshotV1Dto {
  id: string;
  name: string;
  goal: string;
  status: 'planned' | 'active' | 'completed' | 'canceled';
  startDate: string;
  endDate: string;
  targetPoints: number | null;
  committedEstimatePoints: number;
  completedEstimatePoints: number;
  openWorkCount: number;
  blockedWorkCount: number;
  dependencyBlockedWorkCount: number;
  unestimatedWorkCount: number;
  health: SnapshotHealthState;
  reasons: SnapshotHealthReasonV1Dto[];
  links: ProjectStatusReportLinkV1Dto[];
}

export interface ProjectStatusReportSnapshotV1Dto {
  snapshotVersion: 1;
  generatedAt: string;
  project: {
    id: string;
    key: string;
    name: string;
    status: 'active' | 'archived';
  };
  health: SnapshotProjectHealthV1Dto;
  counts: ProjectStatusReportCountSnapshotDto;
  milestones: ProjectStatusReportMilestoneSnapshotV1Dto[];
  cycle?: ProjectStatusReportCycleSnapshotV1Dto | null;
  risks: ProjectStatusReportRiskSnapshotV1Dto[];
  recentWork: SnapshotRiskItemV1Dto[];
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

export interface ProjectStatusReportLinkV2Dto extends Omit<ProjectStatusReportLinkV1Dto, 'query'> { query?: SnapshotWorkItemQueryV2; }
export interface ProjectStatusReportMilestoneSnapshotV2Dto extends Omit<ProjectStatusReportMilestoneSnapshotV1Dto, 'reasons'> { reasons: SnapshotHealthReasonV2Dto[]; }
export interface ProjectStatusReportRiskSnapshotV2Dto extends Omit<ProjectStatusReportRiskSnapshotV1Dto, 'query'> { query: SnapshotWorkItemQueryV2; countUnit: 'work_items'; }
export interface ProjectStatusReportCycleSnapshotV2Dto extends Omit<ProjectStatusReportCycleSnapshotV1Dto, 'reasons' | 'links'> { reasons: SnapshotHealthReasonV2Dto[]; links: ProjectStatusReportLinkV2Dto[]; }
export interface ProjectStatusReportSnapshotV2Dto extends Omit<ProjectStatusReportSnapshotV1Dto, 'snapshotVersion' | 'health' | 'milestones' | 'cycle' | 'risks'> {
  snapshotVersion: 2;
  health: SnapshotProjectHealthV2Dto;
  milestones: ProjectStatusReportMilestoneSnapshotV2Dto[];
  cycle?: ProjectStatusReportCycleSnapshotV2Dto | null;
  risks: ProjectStatusReportRiskSnapshotV2Dto[];
}
export type ProjectStatusReportMilestoneSnapshotDto = ProjectStatusReportMilestoneSnapshotV1Dto | ProjectStatusReportMilestoneSnapshotV2Dto;
export type ProjectStatusReportLinkDto = ProjectStatusReportLinkV1Dto | ProjectStatusReportLinkV2Dto;
export type ProjectStatusReportRiskSnapshotDto = ProjectStatusReportRiskSnapshotV1Dto | ProjectStatusReportRiskSnapshotV2Dto;
export type ProjectStatusReportCycleSnapshotDto = ProjectStatusReportCycleSnapshotV1Dto | ProjectStatusReportCycleSnapshotV2Dto;
export type ProjectStatusReportSnapshotDto = ProjectStatusReportSnapshotV1Dto | ProjectStatusReportSnapshotV2Dto;
