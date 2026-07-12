import { eq } from 'drizzle-orm';

import type { WorktrailDb } from '../db/client.js';
import { projectCycleCloseouts } from '../db/schema.js';
import type { NewProjectCycleCloseout } from './types.js';

export function createProjectCycleCloseoutRepository(db: WorktrailDb) {
  return {
    async create(input: NewProjectCycleCloseout) {
      const [closeout] = await db.insert(projectCycleCloseouts).values(input).returning();
      return closeout;
    },

    async findByCycleId(cycleId: string) {
      const [closeout] = await db
        .select()
        .from(projectCycleCloseouts)
        .where(eq(projectCycleCloseouts.cycleId, cycleId))
        .limit(1);
      return closeout ?? null;
    }
  };
}
