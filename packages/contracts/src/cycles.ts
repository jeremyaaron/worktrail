import type { DeliveryHealthReasonDto, DeliveryHealthState } from './health.js';
import type { ProjectDto } from './projects.js';
import type { PlanningRiskItemDto } from './planning.js';
import type { WorkItemPriority, WorkItemQuery, WorkItemStatus } from './work-items.js';

export type ProjectCycleStatus = 'planned' | 'active' | 'completed' | 'canceled';

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
  status?: ProjectCycleStatus;
  startDate: string;
  endDate: string;
  targetPoints?: number | null;
}

export interface UpdateProjectCycleRequest {
  name?: string;
  goal?: string;
  status?: ProjectCycleStatus;
  startDate?: string;
  endDate?: string;
  targetPoints?: number | null;
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

export interface ProjectCycleReviewDto {
  project: ProjectDto;
  cycle: ProjectCycleDto;
  progress: CycleReviewProgressDto;
  health: {
    health: DeliveryHealthState;
    reasons: DeliveryHealthReasonDto[];
  };
  scopedWorkQuery: WorkItemQuery;
  scopeBreakdown: CycleReviewScopeBreakdownDto;
  riskSections: CycleReviewRiskSectionDto[];
  recentlyChangedWork: PlanningRiskItemDto[];
}
