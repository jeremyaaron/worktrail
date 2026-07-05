import type { MemberDto } from './members.js';
import type { WorkItemQuery } from './work-items.js';

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
