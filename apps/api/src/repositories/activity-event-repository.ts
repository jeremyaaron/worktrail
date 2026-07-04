import { desc, eq } from 'drizzle-orm';

import type { WorktrailDb } from '../db/client.js';
import { activityEvents } from '../db/schema.js';
import type { NewActivityEvent } from './types.js';

export function createActivityEventRepository(db: WorktrailDb) {
  return {
    async create(input: NewActivityEvent) {
      const [activityEvent] = await db.insert(activityEvents).values(input).returning();
      return activityEvent;
    },

    async findByWorkItem(workItemId: string) {
      return db
        .select()
        .from(activityEvents)
        .where(eq(activityEvents.workItemId, workItemId))
        .orderBy(desc(activityEvents.createdAt));
    },

    async findByProject(projectId: string) {
      return db
        .select()
        .from(activityEvents)
        .where(eq(activityEvents.projectId, projectId))
        .orderBy(desc(activityEvents.createdAt));
    }
  };
}

