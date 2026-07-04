import { desc, eq } from 'drizzle-orm';

import type { WorktrailDb } from '../db/client.js';
import { workspaceActivityEvents } from '../db/schema.js';
import type { NewWorkspaceActivityEvent } from './types.js';

export function createWorkspaceActivityEventRepository(db: WorktrailDb) {
  return {
    async create(input: NewWorkspaceActivityEvent) {
      const [event] = await db.insert(workspaceActivityEvents).values(input).returning();
      return event;
    },

    async findByWorkspace(workspaceId: string) {
      return db
        .select()
        .from(workspaceActivityEvents)
        .where(eq(workspaceActivityEvents.workspaceId, workspaceId))
        .orderBy(desc(workspaceActivityEvents.createdAt));
    }
  };
}
