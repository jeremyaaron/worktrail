import type { ProjectDeliveryHealthDto } from './health.js';
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
