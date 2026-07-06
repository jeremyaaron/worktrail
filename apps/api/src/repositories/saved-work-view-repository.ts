import type { SavedWorkViewScope } from '@worktrail/contracts';
import { and, desc, eq, isNull, or, sql } from 'drizzle-orm';

import type { WorktrailDb } from '../db/client.js';
import { savedWorkViews } from '../db/schema.js';
import type { NewSavedWorkView, SavedWorkView } from './types.js';

export interface UpdateSavedWorkViewInput {
  name?: string;
  query?: Record<string, unknown>;
  updatedAt: Date;
}

export interface SavedWorkViewScopeInput {
  workspaceId: string;
  ownerMemberId?: string;
  scope: SavedWorkViewScope;
  projectId?: string;
}

function scopeConditions(input: Omit<SavedWorkViewScopeInput, 'ownerMemberId'>) {
  return input.scope === 'project'
    ? and(eq(savedWorkViews.scope, 'project'), eq(savedWorkViews.projectId, input.projectId ?? ''))
    : and(eq(savedWorkViews.scope, 'workspace'), isNull(savedWorkViews.projectId));
}

export function createSavedWorkViewRepository(db: WorktrailDb) {
  return {
    async create(input: NewSavedWorkView) {
      const [savedView] = await db.insert(savedWorkViews).values(input).returning();
      return savedView;
    },

    async findById(id: string) {
      const [savedView] = await db
        .select()
        .from(savedWorkViews)
        .where(eq(savedWorkViews.id, id))
        .limit(1);
      return savedView ?? null;
    },

    async listPersonal(workspaceId: string, ownerMemberId: string) {
      return db
        .select()
        .from(savedWorkViews)
        .where(
          and(
            eq(savedWorkViews.workspaceId, workspaceId),
            eq(savedWorkViews.scope, 'workspace'),
            isNull(savedWorkViews.projectId),
            eq(savedWorkViews.ownerMemberId, ownerMemberId),
            eq(savedWorkViews.visibility, 'personal')
          )
        )
        .orderBy(desc(savedWorkViews.updatedAt));
    },

    async listVisible(
      inputOrWorkspaceId: SavedWorkViewScopeInput | string,
      maybeOwnerMemberId?: string
    ): Promise<SavedWorkView[]> {
      const input =
        typeof inputOrWorkspaceId === 'string'
          ? {
              workspaceId: inputOrWorkspaceId,
              ownerMemberId: maybeOwnerMemberId ?? '',
              scope: 'workspace' as const
            }
          : inputOrWorkspaceId;

      return db
        .select()
        .from(savedWorkViews)
        .where(
          and(
            eq(savedWorkViews.workspaceId, input.workspaceId),
            scopeConditions(input),
            or(
              and(
                eq(savedWorkViews.ownerMemberId, input.ownerMemberId ?? ''),
                eq(savedWorkViews.visibility, 'personal')
              ),
              eq(savedWorkViews.visibility, 'workspace')
            )
          )
        )
        .orderBy(desc(savedWorkViews.updatedAt));
    },

    async findPersonalByOwnerAndName(
      inputOrWorkspaceId:
        | {
            workspaceId: string;
            ownerMemberId: string;
            scope: SavedWorkViewScope;
            projectId?: string;
            name: string;
          }
        | string,
      maybeOwnerMemberId?: string,
      maybeName?: string
    ): Promise<SavedWorkView | null> {
      const input =
        typeof inputOrWorkspaceId === 'string'
          ? {
              workspaceId: inputOrWorkspaceId,
              ownerMemberId: maybeOwnerMemberId ?? '',
              scope: 'workspace' as const,
              name: maybeName ?? ''
            }
          : inputOrWorkspaceId;

      const [savedView] = await db
        .select()
        .from(savedWorkViews)
        .where(
          and(
            eq(savedWorkViews.workspaceId, input.workspaceId),
            scopeConditions(input),
            eq(savedWorkViews.ownerMemberId, input.ownerMemberId),
            eq(savedWorkViews.visibility, 'personal'),
            sql`lower(${savedWorkViews.name}) = ${input.name.toLowerCase()}`
          )
        )
        .limit(1);
      return savedView ?? null;
    },

    async findSharedByName(input: {
      workspaceId: string;
      scope: SavedWorkViewScope;
      projectId?: string;
      name: string;
    }) {
      const [savedView] = await db
        .select()
        .from(savedWorkViews)
        .where(
          and(
            eq(savedWorkViews.workspaceId, input.workspaceId),
            scopeConditions(input),
            eq(savedWorkViews.visibility, 'workspace'),
            sql`lower(${savedWorkViews.name}) = ${input.name.toLowerCase()}`
          )
        )
        .limit(1);
      return savedView ?? null;
    },

    async findWorkspaceByName(workspaceId: string, name: string) {
      return this.findSharedByName({ workspaceId, scope: 'workspace', name });
    },

    async findByOwnerAndName(workspaceId: string, ownerMemberId: string, name: string) {
      return this.findPersonalByOwnerAndName(workspaceId, ownerMemberId, name);
    },

    async update(id: string, input: UpdateSavedWorkViewInput): Promise<SavedWorkView | null> {
      const [savedView] = await db
        .update(savedWorkViews)
        .set(input)
        .where(eq(savedWorkViews.id, id))
        .returning();
      return savedView ?? null;
    },

    async delete(id: string) {
      const [savedView] = await db
        .delete(savedWorkViews)
        .where(eq(savedWorkViews.id, id))
        .returning();
      return savedView ?? null;
    }
  };
}
