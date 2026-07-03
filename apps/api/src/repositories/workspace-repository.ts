import { eq } from 'drizzle-orm';

import type { WorktrailDb } from '../db/client.js';
import { workspaces } from '../db/schema.js';
import type { NewWorkspace } from './types.js';

export function createWorkspaceRepository(db: WorktrailDb) {
  return {
    async create(input: NewWorkspace) {
      const [workspace] = await db.insert(workspaces).values(input).returning();
      return workspace;
    },

    async findById(id: string) {
      const [workspace] = await db.select().from(workspaces).where(eq(workspaces.id, id)).limit(1);
      return workspace ?? null;
    }
  };
}

