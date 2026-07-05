import type { MemberDto } from './members.js';

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
