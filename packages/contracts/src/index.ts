export interface ApiHealthResponse {
  status: 'ok';
  service: 'worktrail-api';
}

export type MemberRole = 'owner' | 'maintainer' | 'contributor';
export type ProjectStatus = 'active' | 'archived';
export type WorkItemStatus =
  | 'backlog'
  | 'ready'
  | 'in_progress'
  | 'blocked'
  | 'done'
  | 'canceled';

export interface MemberDto {
  id: string;
  workspaceId: string;
  name: string;
  email: string;
  role: MemberRole;
  isActive: boolean;
}

export interface ProjectDto {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectRequest {
  name: string;
  description?: string;
}

export interface UpdateProjectRequest {
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
  title: string;
  status: WorkItemStatus;
  updatedAt: string;
}

export interface ProjectSummaryDto {
  project: ProjectDto;
  countsByStatus: ProjectStatusCountDto[];
  recentWorkItems: RecentWorkItemDto[];
}
