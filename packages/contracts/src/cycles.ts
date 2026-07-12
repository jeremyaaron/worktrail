import type { DeliveryHealthReasonDto, DeliveryHealthState } from './health.js';
import type { MemberDto } from './members.js';
import type { ProjectDto } from './projects.js';
import type { PlanningRiskItemDto } from './planning.js';
import type { WorkItemPriority, WorkItemQuery, WorkItemStatus } from './work-items.js';

export type ProjectCycleStatus = 'planned' | 'active' | 'completed' | 'canceled';
export type CreatableProjectCycleStatus = Extract<ProjectCycleStatus, 'planned' | 'active'>;
export type MutableProjectCycleStatus = Extract<
  ProjectCycleStatus,
  'planned' | 'active' | 'canceled'
>;

export interface ProjectCycleDto {
  id: string;
  workspaceId: string;
  projectId: string;
  name: string;
  goal: string;
  status: ProjectCycleStatus;
  startDate: string;
  endDate: string;
  targetPoints: number | null;
  isArchived: boolean;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectCycleRequest {
  name: string;
  goal?: string;
  status?: CreatableProjectCycleStatus;
  startDate: string;
  endDate: string;
  targetPoints?: number | null;
}

export interface UpdateProjectCycleRequest {
  name?: string;
  goal?: string;
  status?: MutableProjectCycleStatus;
  startDate?: string;
  endDate?: string;
  targetPoints?: number | null;
}

export interface ProjectCycleCloseoutItemSnapshotDto {
  id: string;
  displayKey: string;
  title: string;
  status: WorkItemStatus;
  priority: WorkItemPriority;
  assignee: Pick<MemberDto, 'id' | 'name'> | null;
  estimatePoints: number | null;
  dependencyBlocked: boolean;
}

export interface ProjectCycleCloseoutCountsDto {
  totalCount: number;
  completedCount: number;
  canceledCount: number;
  unfinishedCount: number;
  retainedCount: number;
  movedCount: number;
  committedEstimatePoints: number;
  completedEstimatePoints: number;
  unfinishedEstimatePoints: number;
  unestimatedUnfinishedCount: number;
}

export type ProjectCycleCloseoutDestinationDto =
  | {
      kind: 'cycle';
      cycle: Pick<ProjectCycleDto, 'id' | 'name' | 'startDate' | 'endDate'>;
    }
  | { kind: 'unplanned'; cycle: null }
  | { kind: 'none'; cycle: null };

export interface ProjectCycleCloseoutSnapshotDto {
  snapshotVersion: 1;
  project: Pick<ProjectDto, 'id' | 'key' | 'name'>;
  cycle: Pick<
    ProjectCycleDto,
    'id' | 'name' | 'goal' | 'startDate' | 'endDate' | 'targetPoints'
  > & { status: 'active' };
  closedAt: string;
  closedBy: Pick<MemberDto, 'id' | 'name'>;
  health: CycleReviewHealthDto;
  counts: ProjectCycleCloseoutCountsDto;
  destination: ProjectCycleCloseoutDestinationDto;
  items: {
    completed: ProjectCycleCloseoutItemSnapshotDto[];
    canceled: ProjectCycleCloseoutItemSnapshotDto[];
    unfinished: ProjectCycleCloseoutItemSnapshotDto[];
  };
}

export interface ProjectCycleCloseoutDto {
  id: string;
  workspaceId: string;
  projectId: string;
  cycleId: string;
  closedAt: string;
  closedBy: MemberDto;
  destinationCycleId: string | null;
  snapshot: ProjectCycleCloseoutSnapshotDto;
}

export interface ProjectCycleCloseoutDestinationOptionDto {
  cycle: ProjectCycleDto;
}

export interface ProjectCycleCloseoutPreviewDto {
  project: ProjectDto;
  cycle: ProjectCycleDto;
  generatedAt: string;
  health: CycleReviewHealthDto;
  counts: Omit<ProjectCycleCloseoutCountsDto, 'movedCount'>;
  unfinishedItems: ProjectCycleCloseoutItemSnapshotDto[];
  eligibleDestinations: ProjectCycleCloseoutDestinationOptionDto[];
}

export interface CloseProjectCycleRequest {
  destinationCycleId: string | null;
}

export interface CloseProjectCycleResultDto {
  applied: boolean;
  cycle: ProjectCycleDto;
  closeout: ProjectCycleCloseoutDto;
  movedItemCount: number;
  retainedItemCount: number;
}

export type CycleReviewRiskType =
  | 'blocked'
  | 'dependency_blocked'
  | 'overdue'
  | 'due_soon'
  | 'unassigned_active'
  | 'stale_in_progress'
  | 'unestimated'
  | 'over_target'
  | 'blocking_open_work';

export interface CycleReviewProgressDto {
  totalCount: number;
  openCount: number;
  doneCount: number;
  blockedCount: number;
  dependencyBlockedCount: number;
  committedEstimatePoints: number;
  completedEstimatePoints: number;
  unestimatedCount: number;
  targetPoints: number | null;
}

export interface CycleReviewScopeBreakdownDto {
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

export interface CycleReviewRiskSectionDto {
  type: CycleReviewRiskType;
  title: string;
  description: string;
  count: number;
  query: WorkItemQuery;
  items: PlanningRiskItemDto[];
}

export interface CycleReviewHealthDto {
  health: DeliveryHealthState;
  reasons: DeliveryHealthReasonDto[];
}

export interface ProjectCycleReviewDto {
  project: ProjectDto;
  cycle: ProjectCycleDto;
  progress: CycleReviewProgressDto;
  health: CycleReviewHealthDto;
  scopedWorkQuery: WorkItemQuery;
  scopeBreakdown: CycleReviewScopeBreakdownDto;
  riskSections: CycleReviewRiskSectionDto[];
  recentlyChangedWork: PlanningRiskItemDto[];
  closeout: ProjectCycleCloseoutDto | null;
}
