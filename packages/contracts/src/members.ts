export type MemberRole = 'owner' | 'maintainer' | 'contributor';

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
