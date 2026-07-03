import type {
  LabelDto,
  MemberDto,
  ProjectDto,
  RecentWorkItemDto,
  WorkItemDetailDto,
  WorkItemListItemDto
} from '@worktrail/contracts';

import type { Label, Member, Project, WorkItem } from '../repositories/types.js';

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
    name: project.name,
    description: project.description,
    status: project.status,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString()
  };
}

export function toRecentWorkItemDto(workItem: {
  id: string;
  title: string;
  status: RecentWorkItemDto['status'];
  updatedAt: Date;
}): RecentWorkItemDto {
  return {
    id: workItem.id,
    title: workItem.title,
    status: workItem.status,
    updatedAt: workItem.updatedAt.toISOString()
  };
}

export function toLabelDto(label: Label): LabelDto {
  return {
    id: label.id,
    name: label.name,
    color: label.color
  };
}

export function toWorkItemListItemDto(input: {
  workItem: WorkItem;
  assignee: Member | null;
  reporter: Member;
  labels: Label[];
}): WorkItemListItemDto {
  return {
    id: input.workItem.id,
    workspaceId: input.workItem.workspaceId,
    projectId: input.workItem.projectId,
    title: input.workItem.title,
    type: input.workItem.type,
    status: input.workItem.status,
    priority: input.workItem.priority,
    assignee: input.assignee === null ? null : toMemberDto(input.assignee),
    reporter: toMemberDto(input.reporter),
    labels: input.labels.map(toLabelDto),
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
}): WorkItemDetailDto {
  return {
    ...toWorkItemListItemDto(input),
    description: input.workItem.description
  };
}
