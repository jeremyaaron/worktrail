import { and, desc, eq, or, sql } from 'drizzle-orm';

import type { WorktrailDb } from '../db/client.js';
import { savedWorkViews } from '../db/schema.js';
import type { NewSavedWorkView, SavedWorkView } from './types.js';

export interface UpdateSavedWorkViewInput {
  name?: string;
  query?: Record<string, unknown>;
  updatedAt: Date;
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
            eq(savedWorkViews.ownerMemberId, ownerMemberId),
            eq(savedWorkViews.visibility, 'personal')
          )
        )
        .orderBy(desc(savedWorkViews.updatedAt));
    },

    async listVisible(workspaceId: string, ownerMemberId: string) {
      return db
        .select()
        .from(savedWorkViews)
        .where(
          and(
            eq(savedWorkViews.workspaceId, workspaceId),
            or(
              and(
                eq(savedWorkViews.ownerMemberId, ownerMemberId),
                eq(savedWorkViews.visibility, 'personal')
              ),
              eq(savedWorkViews.visibility, 'workspace')
            )
          )
        )
        .orderBy(desc(savedWorkViews.updatedAt));
    },

    async findPersonalByOwnerAndName(workspaceId: string, ownerMemberId: string, name: string) {
      const [savedView] = await db
        .select()
        .from(savedWorkViews)
        .where(
          and(
            eq(savedWorkViews.workspaceId, workspaceId),
            eq(savedWorkViews.ownerMemberId, ownerMemberId),
            eq(savedWorkViews.visibility, 'personal'),
            sql`lower(${savedWorkViews.name}) = ${name.toLowerCase()}`
          )
        )
        .limit(1);
      return savedView ?? null;
    },

    async findWorkspaceByName(workspaceId: string, name: string) {
      const [savedView] = await db
        .select()
        .from(savedWorkViews)
        .where(
          and(
            eq(savedWorkViews.workspaceId, workspaceId),
            eq(savedWorkViews.visibility, 'workspace'),
            sql`lower(${savedWorkViews.name}) = ${name.toLowerCase()}`
          )
        )
        .limit(1);
      return savedView ?? null;
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
