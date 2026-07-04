export interface ApiHealthResponse {
  status: 'ok';
  service: 'worktrail-api';
}

export type MemberRole = 'owner' | 'maintainer' | 'contributor';
export type ProjectStatus = 'active' | 'archived';
export type WorkItemType = 'task' | 'bug' | 'story' | 'chore';
export type WorkItemStatus =
  | 'backlog'
  | 'ready'
  | 'in_progress'
  | 'blocked'
  | 'done'
  | 'canceled';
export type WorkItemPriority = 'low' | 'medium' | 'high' | 'urgent';
export type WorkItemSort = 'updated_desc' | 'updated_asc' | 'priority_desc' | 'priority_asc';
export type ActivityEventType =
  | 'project.name_changed'
  | 'project.description_changed'
  | 'project.archived'
  | 'project.reactivated'
  | 'label.created'
  | 'label.name_changed'
  | 'label.color_changed'
  | 'label.archived'
  | 'label.reactivated'
  | 'work_item.created'
  | 'work_item.title_changed'
  | 'work_item.description_changed'
  | 'work_item.status_changed'
  | 'work_item.assignee_changed'
  | 'work_item.priority_changed'
  | 'work_item.label_added'
  | 'work_item.label_removed'
  | 'comment.added'
  | 'comment.edited'
  | 'comment.deleted';

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
}

export interface LabelDto {
  id: string;
  name: string;
  color: string | null;
  isArchived: boolean;
  archivedAt: string | null;
}

export interface WorkItemListItemDto {
  id: string;
  workspaceId: string;
  projectId: string;
  itemNumber: number;
  displayKey: string;
  title: string;
  type: WorkItemType;
  status: WorkItemStatus;
  priority: WorkItemPriority;
  assignee: MemberDto | null;
  reporter: MemberDto;
  labels: LabelDto[];
  dueDate: string | null;
  estimatePoints: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkItemDetailDto extends WorkItemListItemDto {
  description: string;
  comments: CommentDto[];
  activity: ActivityEventDto[];
}

export interface CommentDto {
  id: string;
  workspaceId: string;
  projectId: string;
  workItemId: string;
  author: MemberDto;
  body: string;
  isEdited: boolean;
  isDeleted: boolean;
  editedAt: string | null;
  deletedAt: string | null;
  deletedBy: MemberDto | null;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityEventDto {
  id: string;
  workspaceId: string;
  projectId: string;
  workItemId: string | null;
  actor: MemberDto;
  eventType: ActivityEventType;
  summary: string;
  previousValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface CreateWorkItemRequest {
  title: string;
  description?: string;
  type: WorkItemType;
  status?: WorkItemStatus;
  priority: WorkItemPriority;
  assigneeId?: string | null;
  labelIds?: string[];
  dueDate?: string | null;
  estimatePoints?: number | null;
}

export interface UpdateWorkItemRequest {
  title?: string;
  description?: string;
  type?: WorkItemType;
  priority?: WorkItemPriority;
  assigneeId?: string | null;
  labelIds?: string[];
  dueDate?: string | null;
  estimatePoints?: number | null;
}

export interface TransitionWorkItemRequest {
  status: WorkItemStatus;
}

export interface CreateCommentRequest {
  body: string;
}

export interface CreateLabelRequest {
  name: string;
  color?: string | null;
}

export interface UpdateLabelRequest {
  name?: string;
  color?: string | null;
}

export interface UpdateCommentRequest {
  body: string;
}
