import type {
  ActivityEventDto,
  CommentDto,
  LabelDto,
  MemberDto,
  MilestoneDto,
  ProjectDto,
  RecentWorkItemDto,
  WorkItemDetailDto,
  WorkItemListItemDto
} from '@worktrail/contracts';

import type {
  ActivityEvent,
  Comment,
  Label,
  Member,
  Milestone,
  Project,
  WorkItem
} from '../repositories/types.js';

function toNullableRecord(value: Record<string, unknown> | null): Record<string, unknown> | null {
  return value;
}

export function toMemberDto(member: Member): MemberDto {
  return {
    id: member.id,
    workspaceId: member.workspaceId,
    name: member.name,
    email: member.email,
    role: member.role,
    isActive: member.isActive
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

export function toCommentDto(comment: Comment, author: Member, deletedBy: Member | null = null): CommentDto {
  const isDeleted = comment.deletedAt !== null;

  return {
    id: comment.id,
    workspaceId: comment.workspaceId,
    projectId: comment.projectId,
    workItemId: comment.workItemId,
    author: toMemberDto(author),
    body: isDeleted ? '' : comment.body,
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

export function toWorkItemListItemDto(input: {
  workItem: WorkItem;
  assignee: Member | null;
  reporter: Member;
  labels: Label[];
  milestone?: Milestone | null;
}): WorkItemListItemDto {
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
    createdAt: input.workItem.createdAt.toISOString(),
    updatedAt: input.workItem.updatedAt.toISOString()
  };
}

export function toWorkItemDetailDto(input: {
  workItem: WorkItem;
  assignee: Member | null;
  reporter: Member;
  labels: Label[];
  milestone?: Milestone | null;
  comments: CommentDto[];
  activity: ActivityEventDto[];
}): WorkItemDetailDto {
  return {
    ...toWorkItemListItemDto(input),
    description: input.workItem.description,
    comments: input.comments,
    activity: input.activity
  };
}
