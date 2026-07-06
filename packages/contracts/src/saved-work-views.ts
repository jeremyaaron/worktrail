import type { MemberDto } from './members.js';
import type { WorkItemQuery } from './work-items.js';

export type SavedWorkViewVisibility = 'personal' | 'workspace';
export type SavedWorkViewScope = 'workspace' | 'project';

export interface SavedWorkViewDto {
  id: string;
  workspaceId: string;
  projectId: string | null;
  owner: MemberDto;
  name: string;
  scope: SavedWorkViewScope;
  visibility: SavedWorkViewVisibility;
  query: WorkItemQuery;
  createdAt: string;
  updatedAt: string;
}

export interface ListSavedWorkViewsQuery {
  scope?: SavedWorkViewScope;
  projectId?: string;
}

export interface CreateSavedWorkViewRequest {
  name: string;
  query: WorkItemQuery;
  scope?: SavedWorkViewScope;
  projectId?: string;
  visibility?: SavedWorkViewVisibility;
}

export interface UpdateSavedWorkViewRequest {
  name?: string;
  query?: WorkItemQuery;
}
