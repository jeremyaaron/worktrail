import { asc, eq } from 'drizzle-orm';

import type { WorktrailDb } from '../db/client.js';
import { comments } from '../db/schema.js';
import type { NewComment } from './types.js';

export function createCommentRepository(db: WorktrailDb) {
  return {
    async create(input: NewComment) {
      const [comment] = await db.insert(comments).values(input).returning();
      return comment;
    },

    async findByWorkItem(workItemId: string) {
      return db
        .select()
        .from(comments)
        .where(eq(comments.workItemId, workItemId))
        .orderBy(asc(comments.createdAt));
    }
  };
}
