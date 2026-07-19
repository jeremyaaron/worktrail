import type { ActivityEventDto } from './activity.js';
import type { ProjectCycleDto } from './cycles.js';
import type { MemberDto } from './members.js';
import type { MilestoneDto } from './planning.js';
import type { ProjectDto } from './projects.js';

export type WorkItemType = 'task' | 'bug' | 'story' | 'chore';
export type WorkItemStatus =
  | 'backlog'
  | 'ready'
  | 'in_progress'
  | 'blocked'
  | 'done'
  | 'canceled';
export type WorkItemPriority = 'low' | 'medium' | 'high' | 'urgent';
export type WorkItemRelationshipType = 'blocks' | 'relates_to';
export type DueDateState = 'overdue' | 'due_soon' | 'none';
export type ArchivedProjectMode = 'exclude' | 'include' | 'only';
export type AssigneeState = 'assigned' | 'unassigned';
export type WorkItemState = 'open' | 'terminal';
export type DependencyFilter = 'dependency_blocked' | 'blocking_open_work';
export type WorkItemRiskFilter = 'unassigned_active' | 'stale_in_progress';
export type WorkItemHierarchyFilter = 'top_level' | 'children' | 'parents';
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
  cycleId?: string;
  dueDateState?: DueDateState;
  blocked?: boolean;
  dependency?: DependencyFilter;
  workRisk?: WorkItemRiskFilter;
  hierarchy?: WorkItemHierarchyFilter;
  parentKey?: string;
  archivedProjects?: ArchivedProjectMode;
  search?: string;
  sort?: WorkItemSort;
}

export const workItemPageSizes = [10, 25, 50, 100] as const;
export type WorkItemPageSize = (typeof workItemPageSizes)[number];

export interface WorkItemPageQuery {
  page?: number;
  pageSize?: WorkItemPageSize;
}

export interface ResolvedWorkItemPageQuery {
  page: number;
  pageSize: WorkItemPageSize;
}

export interface WorkItemPageMetadataDto extends ResolvedWorkItemPageQuery {
  totalCount: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

export interface LabelDto {
  id: string;
  name: string;
  color: string | null;
  isArchived: boolean;
  archivedAt: string | null;
}

export interface CreateLabelRequest {
  name: string;
  color?: string | null;
}

export interface UpdateLabelRequest {
  name?: string;
  color?: string | null;
}

export interface WorkItemParentDto {
  id: string;
  projectId: string;
  displayKey: string;
  title: string;
  type: WorkItemType;
  status: WorkItemStatus;
}

export interface WorkItemChildSummaryDto {
  totalCount: number;
  openCount: number;
  doneCount: number;
  canceledCount: number;
  estimatedCount: number;
  unestimatedCount: number;
  estimatePoints: number;
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
  cycle: ProjectCycleDto | null;
  boardPosition: number;
  dueDate: string | null;
  estimatePoints: number | null;
  parent: WorkItemParentDto | null;
  childSummary: WorkItemChildSummaryDto | null;
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

export interface WorkItemListPageDto extends WorkItemPageMetadataDto {
  items: WorkItemListItemDto[];
}

export interface WorkspaceWorkItemListPageDto extends WorkItemPageMetadataDto {
  items: WorkspaceWorkItemListItemDto[];
}

export interface WorkItemChildrenDto {
  items: WorkItemListItemDto[];
  totalCount: number;
  hasMore: boolean;
}

export interface WorkItemParentCandidateDto extends WorkItemParentDto {
  priority: WorkItemPriority;
  updatedAt: string;
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

export interface CommentDto {
  id: string;
  workspaceId: string;
  projectId: string;
  workItemId: string;
  author: MemberDto;
  body: string;
  mentions: MemberDto[];
  isEdited: boolean;
  isDeleted: boolean;
  editedAt: string | null;
  deletedAt: string | null;
  deletedBy: MemberDto | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCommentRequest {
  body: string;
  mentionMemberIds?: string[];
}

export interface UpdateCommentRequest {
  body: string;
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
  cycleId?: string | null;
  dueDate?: string | null;
  estimatePoints?: number | null;
  parentWorkItemId?: string | null;
}

export interface UpdateWorkItemRequest {
  title?: string;
  description?: string;
  type?: WorkItemType;
  priority?: WorkItemPriority;
  assigneeId?: string | null;
  labelIds?: string[];
  milestoneId?: string | null;
  cycleId?: string | null;
  dueDate?: string | null;
  estimatePoints?: number | null;
}

export interface SetWorkItemParentRequest {
  parentWorkItemId: string | null;
}

export interface TransitionWorkItemRequest {
  status: WorkItemStatus;
}

export interface MoveWorkItemOnBoardRequest {
  status: WorkItemStatus;
  beforeWorkItemId?: string | null;
  afterWorkItemId?: string | null;
}

export type BulkUpdateWorkItemsAction =
  | { type: 'set_assignee'; assigneeId: string }
  | { type: 'clear_assignee' }
  | { type: 'set_priority'; priority: WorkItemPriority }
  | { type: 'set_milestone'; milestoneId: string }
  | { type: 'clear_milestone' }
  | { type: 'set_cycle'; cycleId: string }
  | { type: 'clear_cycle' }
  | { type: 'set_due_date'; dueDate: string }
  | { type: 'clear_due_date' }
  | { type: 'add_labels'; labelIds: string[] }
  | { type: 'remove_labels'; labelIds: string[] }
  | { type: 'transition_status'; status: WorkItemStatus };

export interface BulkUpdateWorkItemsRequest {
  workItemIds: string[];
  action: BulkUpdateWorkItemsAction;
}

export type BulkUpdateWorkItemsResultStatus = 'updated' | 'unchanged' | 'failed';

export type BulkUpdateWorkItemsErrorCode =
  | 'NOT_FOUND'
  | 'NOT_IN_PROJECT'
  | 'PROJECT_ARCHIVED'
  | 'FORBIDDEN'
  | 'INVALID_REFERENCE'
  | 'WORKFLOW_TRANSITION_ERROR'
  | 'VALIDATION_ERROR';

export interface BulkUpdateWorkItemsErrorDto {
  code: BulkUpdateWorkItemsErrorCode;
  message: string;
}

export interface BulkUpdateWorkItemsResultDto {
  workItemId: string;
  displayKey: string | null;
  status: BulkUpdateWorkItemsResultStatus;
  workItem: WorkItemListItemDto | null;
  error: BulkUpdateWorkItemsErrorDto | null;
}

export interface BulkUpdateWorkItemsResponseDto {
  requestedCount: number;
  succeededCount: number;
  unchangedCount: number;
  failedCount: number;
  results: BulkUpdateWorkItemsResultDto[];
}
