export interface ApiHealthResponse {
  status: 'ok';
  service: 'worktrail-api';
  checkedAt: string;
}

export interface ApiReadinessResponse {
  status: 'ready';
  service: 'worktrail-api';
  checks: {
    database: 'ok';
  };
  checkedAt: string;
}

export interface ApiReadinessFailureResponse {
  error: {
    code: 'READINESS_FAILED';
    message: string;
    checks: {
      database: 'failed';
    };
  };
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
export type MilestoneStatus = 'planned' | 'active' | 'completed' | 'canceled';
export type WorkItemRelationshipType = 'blocks' | 'relates_to';
export type DueDateState = 'overdue' | 'due_soon' | 'none';
export type ArchivedProjectMode = 'exclude' | 'include' | 'only';
export type AssigneeState = 'assigned' | 'unassigned';
export type WorkItemState = 'open' | 'terminal';
export type DependencyFilter = 'dependency_blocked' | 'blocking_open_work';
export type WorkItemSort =
  | 'updated_desc'
  | 'updated_asc'
  | 'priority_desc'
  | 'priority_asc'
  | 'due_date_asc'
  | 'created_desc'
  | 'board_order';
export interface WorkItemQuery {
  projectId?: string;
  status?: WorkItemStatus;
  workState?: WorkItemState;
  assigneeId?: string;
  assigneeState?: AssigneeState;
  reporterId?: string;
  type?: WorkItemType;
  priority?: WorkItemPriority;
  labelId?: string;
  milestoneId?: string;
  dueDateState?: DueDateState;
  blocked?: boolean;
  dependency?: DependencyFilter;
  archivedProjects?: ArchivedProjectMode;
  search?: string;
  sort?: WorkItemSort;
}
export type ActivityEventType =
  | 'project.name_changed'
  | 'project.description_changed'
  | 'project.archived'
  | 'project.reactivated'
  | 'milestone.created'
  | 'milestone.name_changed'
  | 'milestone.description_changed'
  | 'milestone.status_changed'
  | 'milestone.target_date_changed'
  | 'milestone.archived'
  | 'milestone.reactivated'
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
  | 'work_item.milestone_changed'
  | 'work_item.label_added'
  | 'work_item.label_removed'
  | 'work_item.relationship_added'
  | 'work_item.relationship_removed'
  | 'comment.added'
  | 'comment.edited'
  | 'comment.deleted';
export type WorkspaceActivityEventType =
  | 'member.created'
  | 'member.name_changed'
  | 'member.email_changed'
  | 'member.role_changed'
  | 'member.deactivated'
  | 'member.reactivated'
  | 'workspace.name_changed'
  | 'project.created';

export interface MemberDto {
  id: string;
  workspaceId: string;
  name: string;
  email: string;
  role: MemberRole;
  isActive: boolean;
  deactivatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMemberRequest {
  name: string;
  email: string;
  role: MemberRole;
}

export interface UpdateMemberRequest {
  name?: string;
  email?: string;
  role?: MemberRole;
}

export interface WorkspaceDto {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateWorkspaceRequest {
  name: string;
}

export interface WorkspaceCapabilitiesDto {
  actor: MemberDto;
  canManageWorkspace: boolean;
  canManageMembers: boolean;
  canCreateProjects: boolean;
  canManageProjects: boolean;
  canManageMilestones: boolean;
  canManageLabels: boolean;
  canCreateWorkItems: boolean;
  roleSummary: {
    owner: string;
    maintainer: string;
    contributor: string;
  };
}

export interface WorkspaceActivityEventDto {
  id: string;
  workspaceId: string;
  actor: MemberDto;
  eventType: WorkspaceActivityEventType;
  summary: string;
  previousValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
  createdAt: string;
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

export interface ProjectNavigationSummaryDto {
  project: ProjectDto;
  openWorkItemCount: number;
  blockedWorkItemCount: number;
  overdueWorkItemCount: number;
  updatedAt: string;
}

export interface LabelDto {
  id: string;
  name: string;
  color: string | null;
  isArchived: boolean;
  archivedAt: string | null;
}

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
  milestone: MilestoneDto | null;
  boardPosition: number;
  dueDate: string | null;
  estimatePoints: number | null;
  dependencyBlocked: boolean;
  openBlockerCount: number;
  openBlockedWorkCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface WorkItemDetailDto extends WorkItemListItemDto {
  description: string;
  relationships: WorkItemRelationshipSummaryDto;
  comments: CommentDto[];
  activity: ActivityEventDto[];
}

export interface WorkspaceWorkItemListItemDto extends WorkItemListItemDto {
  project: Pick<ProjectDto, 'id' | 'key' | 'name' | 'status'>;
}

export interface WorkItemRelationshipWorkItemDto {
  id: string;
  workspaceId: string;
  projectId: string;
  project: Pick<ProjectDto, 'id' | 'key' | 'name' | 'status'>;
  displayKey: string;
  title: string;
  status: WorkItemStatus;
  priority: WorkItemPriority;
  assignee: MemberDto | null;
}

export interface WorkItemRelationshipItemDto {
  id: string;
  relationshipType: WorkItemRelationshipType;
  direction: 'inbound' | 'outbound' | 'related';
  workItem: WorkItemRelationshipWorkItemDto;
  createdBy: MemberDto;
  createdAt: string;
}

export interface WorkItemRelationshipSummaryDto {
  blockedBy: WorkItemRelationshipItemDto[];
  blocks: WorkItemRelationshipItemDto[];
  related: WorkItemRelationshipItemDto[];
  dependencyBlocked: boolean;
  openBlockerCount: number;
  openBlockedWorkCount: number;
}

export interface CreateWorkItemRelationshipRequest {
  relationshipType: WorkItemRelationshipType;
  targetWorkItemId: string;
}

export interface WorkItemRelationshipDto {
  id: string;
  relationshipType: WorkItemRelationshipType;
  sourceWorkItemId: string;
  targetWorkItemId: string;
  sourceWorkItem: WorkItemRelationshipWorkItemDto;
  targetWorkItem: WorkItemRelationshipWorkItemDto;
  createdBy: MemberDto;
  createdAt: string;
}

export interface WorkItemCsvImportPreviewRequest {
  csv: string;
}

export interface WorkItemCsvImportApplyRequest {
  csv: string;
}

export interface WorkItemCsvImportErrorDto {
  rowNumber: number | null;
  field: string | null;
  message: string;
}

export interface WorkItemCsvImportWarningDto {
  rowNumber: number | null;
  field: string | null;
  message: string;
}

export interface WorkItemCsvImportPreviewRowDto {
  rowNumber: number;
  title: string;
  type: WorkItemType;
  status: WorkItemStatus;
  priority: WorkItemPriority;
  assigneeEmail: string | null;
  reporterEmail: string;
  labelNames: string[];
  milestoneName: string | null;
  dueDate: string | null;
  estimatePoints: number | null;
}

export interface WorkItemCsvImportPreviewDto {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  errors: WorkItemCsvImportErrorDto[];
  warnings: WorkItemCsvImportWarningDto[];
  rows: WorkItemCsvImportPreviewRowDto[];
}

export interface WorkItemCsvImportApplyDto {
  createdCount: number;
  workItems: WorkItemListItemDto[];
}

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

export type SavedWorkViewVisibility = 'personal';

export interface SavedWorkViewDto {
  id: string;
  workspaceId: string;
  owner: MemberDto;
  name: string;
  visibility: SavedWorkViewVisibility;
  query: WorkItemQuery;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSavedWorkViewRequest {
  name: string;
  query: WorkItemQuery;
}

export interface UpdateSavedWorkViewRequest {
  name?: string;
  query?: WorkItemQuery;
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
  milestoneId?: string | null;
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
  milestoneId?: string | null;
  dueDate?: string | null;
  estimatePoints?: number | null;
}

export interface TransitionWorkItemRequest {
  status: WorkItemStatus;
}

export interface MoveWorkItemOnBoardRequest {
  status: WorkItemStatus;
  beforeWorkItemId?: string | null;
  afterWorkItemId?: string | null;
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
  blockedCount: number;
  overdueCount: number;
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

export interface ProjectPlanningSummaryDto {
  project: ProjectDto;
  milestoneProgress: MilestoneProgressDto[];
  blockedWork: PlanningRiskItemDto[];
  overdueWork: PlanningRiskItemDto[];
  dueSoonWork: PlanningRiskItemDto[];
  unassignedActiveWork: PlanningRiskItemDto[];
  staleInProgressWork: PlanningRiskItemDto[];
  dependencyBlockedWork: PlanningRiskItemDto[];
  blockingOpenWork: PlanningRiskItemDto[];
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
