import { and, asc, eq, isNull } from 'drizzle-orm';

import type { WorktrailDb } from '../db/client.js';
import { members, workItemWatchers } from '../db/schema.js';
import type { NewWorkItemWatcher } from './types.js';

export interface WatcherKeyInput {
  workItemId: string;
  memberId: string;
}

export interface UnwatchInput extends WatcherKeyInput {
  unwatchedAt: Date;
  updatedAt: Date;
}

export function createWorkItemWatcherRepository(db: WorktrailDb) {
  return {
    async watch(input: NewWorkItemWatcher) {
      const existing = await this.findActive(input.workItemId, input.memberId);

      if (existing !== null) {
        return existing;
      }

      const [watcher] = await db.insert(workItemWatchers).values(input).returning();
      return watcher;
    },

    async findActive(workItemId: string, memberId: string) {
      const [watcher] = await db
        .select()
        .from(workItemWatchers)
        .where(
          and(
            eq(workItemWatchers.workItemId, workItemId),
            eq(workItemWatchers.memberId, memberId),
            isNull(workItemWatchers.unwatchedAt)
          )
        )
        .limit(1);
      return watcher ?? null;
    },

    async listActiveByWorkItem(workItemId: string) {
      return db
        .select()
        .from(workItemWatchers)
        .where(and(eq(workItemWatchers.workItemId, workItemId), isNull(workItemWatchers.unwatchedAt)))
        .orderBy(asc(workItemWatchers.watchedAt));
    },

    async listActiveMemberIdsByWorkItem(workItemId: string) {
      const rows = await db
        .select({ memberId: workItemWatchers.memberId })
        .from(workItemWatchers)
        .innerJoin(members, eq(members.id, workItemWatchers.memberId))
        .where(
          and(
            eq(workItemWatchers.workItemId, workItemId),
            isNull(workItemWatchers.unwatchedAt),
            eq(members.isActive, true)
          )
        )
        .orderBy(asc(workItemWatchers.watchedAt));
      return rows.map((row) => row.memberId);
    },

    async unwatch(input: UnwatchInput) {
      const [watcher] = await db
        .update(workItemWatchers)
        .set({
          unwatchedAt: input.unwatchedAt,
          updatedAt: input.updatedAt
        })
        .where(
          and(
            eq(workItemWatchers.workItemId, input.workItemId),
            eq(workItemWatchers.memberId, input.memberId),
            isNull(workItemWatchers.unwatchedAt)
          )
        )
        .returning();
      return watcher ?? null;
    }
  };
}
