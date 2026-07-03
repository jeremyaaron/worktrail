import type {
  MemberDto,
  ProjectDto,
  RecentWorkItemDto
} from '@worktrail/contracts';

import type { Member, Project } from '../repositories/types.js';

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

