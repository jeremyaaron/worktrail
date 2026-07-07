import type {
  ActivityEventDto,
  CommentDto,
  LabelDto,
  MemberDto,
  MilestoneDto,
  ProjectDto,
  RecentWorkItemDto,
  SavedWorkViewDto,
  WorkItemQuery,
  WorkspaceActivityEventDto,
  WorkspaceDto,
  WorkspaceWorkItemListItemDto,
  WorkItemDetailDto,
  WorkItemListItemDto,
  WorkItemRelationshipSummaryDto
} from '@worktrail/contracts';

import type {
  ActivityEvent,
  Comment,
  Label,
  Member,
  Milestone,
  Project,
  SavedWorkView,
  WorkItem,
  Workspace,
  WorkspaceActivityEvent
} from '../repositories/types.js';

export interface DependencyCounts {
  openBlockerCount: number;
  openBlockedWorkCount: number;
}

function toNullableRecord(value: Record<string, unknown> | null): Record<string, unknown> | null {
  return value;
}

export function emptyRelationshipSummary(): WorkItemRelationshipSummaryDto {
  return {
    blockedBy: [],
    blocks: [],
    related: [],
    dependencyBlocked: false,
    openBlockerCount: 0,
    openBlockedWorkCount: 0
  };
}

export function toMemberDto(member: Member): MemberDto {
  return {
    id: member.id,
    workspaceId: member.workspaceId,
    name: member.name,
    email: member.email,
    role: member.role,
    isActive: member.isActive,
    deactivatedAt: member.deactivatedAt?.toISOString() ?? null,
    createdAt: member.createdAt.toISOString(),
    updatedAt: member.updatedAt.toISOString()
  };
}

export function toWorkspaceDto(workspace: Workspace): WorkspaceDto {
  return {
    id: workspace.id,
    name: workspace.name,
    createdAt: workspace.createdAt.toISOString(),
    updatedAt: workspace.updatedAt.toISOString()
  };
}

export function toProjectDto(project: Project): ProjectDto {
  return {
    id: project.id,
    workspaceId: project.workspaceId,
    key: project.key,
    name: project.name,
    description: project.description,
    status: project.status,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString()
  };
}

export function toRecentWorkItemDto(workItem: {
  id: string;
  displayKey: string;
  title: string;
  status: RecentWorkItemDto['status'];
  updatedAt: Date;
}): RecentWorkItemDto {
  return {
    id: workItem.id,
    displayKey: workItem.displayKey,
    title: workItem.title,
    status: workItem.status,
    updatedAt: workItem.updatedAt.toISOString()
  };
}

export function toLabelDto(label: Label): LabelDto {
  return {
    id: label.id,
    name: label.name,
    color: label.color,
    isArchived: label.archivedAt !== null,
    archivedAt: label.archivedAt?.toISOString() ?? null
  };
}

export function toMilestoneDto(milestone: Milestone): MilestoneDto {
  return {
    id: milestone.id,
    workspaceId: milestone.workspaceId,
    projectId: milestone.projectId,
    name: milestone.name,
    description: milestone.description,
    status: milestone.status,
    targetDate: milestone.targetDate,
    isArchived: milestone.archivedAt !== null,
    archivedAt: milestone.archivedAt?.toISOString() ?? null,
    createdAt: milestone.createdAt.toISOString(),
    updatedAt: milestone.updatedAt.toISOString()
  };
}

export function toCommentDto(
  comment: Comment,
  author: Member,
  deletedBy: Member | null = null,
  mentions: Member[] = []
): CommentDto {
  const isDeleted = comment.deletedAt !== null;

  return {
    id: comment.id,
    workspaceId: comment.workspaceId,
    projectId: comment.projectId,
    workItemId: comment.workItemId,
    author: toMemberDto(author),
    body: isDeleted ? '' : comment.body,
    mentions: mentions.map(toMemberDto),
    isEdited: comment.editedAt !== null,
    isDeleted,
    editedAt: comment.editedAt?.toISOString() ?? null,
    deletedAt: comment.deletedAt?.toISOString() ?? null,
    deletedBy: deletedBy === null ? null : toMemberDto(deletedBy),
    createdAt: comment.createdAt.toISOString(),
    updatedAt: comment.updatedAt.toISOString()
  };
}

export function toActivityEventDto(event: ActivityEvent, actor: Member): ActivityEventDto {
  return {
    id: event.id,
    workspaceId: event.workspaceId,
    projectId: event.projectId,
    workItemId: event.workItemId,
    actor: toMemberDto(actor),
    eventType: event.eventType,
    summary: event.summary,
    previousValue: toNullableRecord(event.previousValue),
    newValue: toNullableRecord(event.newValue),
    metadata: event.metadata,
    createdAt: event.createdAt.toISOString()
  };
}

export function toWorkspaceActivityEventDto(
  event: WorkspaceActivityEvent,
  actor: Member
): WorkspaceActivityEventDto {
  return {
    id: event.id,
    workspaceId: event.workspaceId,
    actor: toMemberDto(actor),
    eventType: event.eventType,
    summary: event.summary,
    previousValue: toNullableRecord(event.previousValue),
    newValue: toNullableRecord(event.newValue),
    metadata: event.metadata,
    createdAt: event.createdAt.toISOString()
  };
}

export function toWorkItemListItemDto(input: {
  workItem: WorkItem;
  assignee: Member | null;
  reporter: Member;
  labels: Label[];
  milestone?: Milestone | null;
  dependencyCounts?: DependencyCounts;
}): WorkItemListItemDto {
  const dependencyCounts = input.dependencyCounts ?? {
    openBlockerCount: 0,
    openBlockedWorkCount: 0
  };

  return {
    id: input.workItem.id,
    workspaceId: input.workItem.workspaceId,
    projectId: input.workItem.projectId,
    itemNumber: input.workItem.itemNumber,
    displayKey: input.workItem.displayKey,
    title: input.workItem.title,
    type: input.workItem.type,
    status: input.workItem.status,
    priority: input.workItem.priority,
    assignee: input.assignee === null ? null : toMemberDto(input.assignee),
    reporter: toMemberDto(input.reporter),
    labels: input.labels.map(toLabelDto),
    milestone: input.milestone == null ? null : toMilestoneDto(input.milestone),
    boardPosition: input.workItem.boardPosition,
    dueDate: input.workItem.dueDate,
    estimatePoints: input.workItem.estimatePoints,
    dependencyBlocked: dependencyCounts.openBlockerCount > 0,
    openBlockerCount: dependencyCounts.openBlockerCount,
    openBlockedWorkCount: dependencyCounts.openBlockedWorkCount,
    createdAt: input.workItem.createdAt.toISOString(),
    updatedAt: input.workItem.updatedAt.toISOString()
  };
}

export function toWorkspaceWorkItemListItemDto(input: {
  workItem: WorkItem;
  assignee: Member | null;
  reporter: Member;
  labels: Label[];
  milestone?: Milestone | null;
  project: Pick<Project, 'id' | 'key' | 'name' | 'status'>;
  dependencyCounts?: DependencyCounts;
}): WorkspaceWorkItemListItemDto {
  return {
    ...toWorkItemListItemDto(input),
    project: input.project
  };
}

export function toSavedWorkViewDto(savedView: SavedWorkView, owner: Member): SavedWorkViewDto {
  return {
    id: savedView.id,
    workspaceId: savedView.workspaceId,
    projectId: savedView.projectId,
    owner: toMemberDto(owner),
    name: savedView.name,
    scope: savedView.scope,
    visibility: savedView.visibility,
    isPinned: savedView.isPinned,
    query: savedView.query as WorkItemQuery,
    createdAt: savedView.createdAt.toISOString(),
    updatedAt: savedView.updatedAt.toISOString()
  };
}

export function toWorkItemDetailDto(input: {
  workItem: WorkItem;
  assignee: Member | null;
  reporter: Member;
  labels: Label[];
  milestone?: Milestone | null;
  dependencyCounts?: DependencyCounts;
  relationships?: WorkItemRelationshipSummaryDto;
  comments: CommentDto[];
  activity: ActivityEventDto[];
}): WorkItemDetailDto {
  return {
    ...toWorkItemListItemDto(input),
    description: input.workItem.description,
    relationships: input.relationships ?? emptyRelationshipSummary(),
    comments: input.comments,
    activity: input.activity
  };
}
