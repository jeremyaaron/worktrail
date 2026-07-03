import { eq } from 'drizzle-orm';

import type { WorktrailDb } from '../db/client.js';
import { labels } from '../db/schema.js';
import type { NewLabel } from './types.js';

export function createLabelRepository(db: WorktrailDb) {
  return {
    async create(input: NewLabel) {
      const [label] = await db.insert(labels).values(input).returning();
      return label;
    },

    async findById(id: string) {
      const [label] = await db.select().from(labels).where(eq(labels.id, id)).limit(1);
      return label ?? null;
    },

    async listByProject(projectId: string) {
      return db.select().from(labels).where(eq(labels.projectId, projectId));
    }
  };
}

