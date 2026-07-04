import { asc, eq } from 'drizzle-orm';

import type { WorktrailDb } from '../db/client.js';
import { comments } from '../db/schema.js';
import type { NewComment } from './types.js';

export interface UpdateCommentInput {
  body: string;
  editedAt: Date;
  updatedAt: Date;
}

export function createCommentRepository(db: WorktrailDb) {
  return {
    async create(input: NewComment) {
      const [comment] = await db.insert(comments).values(input).returning();
      return comment;
    },

    async findById(id: string) {
      const [comment] = await db.select().from(comments).where(eq(comments.id, id)).limit(1);
      return comment ?? null;
    },

    async findByWorkItem(workItemId: string) {
      return db
        .select()
        .from(comments)
        .where(eq(comments.workItemId, workItemId))
        .orderBy(asc(comments.createdAt));
    },

    async updateBody(id: string, input: UpdateCommentInput) {
      const [comment] = await db.update(comments).set(input).where(eq(comments.id, id)).returning();
      return comment ?? null;
    },

    async softDelete(id: string, input: { deletedAt: Date; deletedById: string; updatedAt: Date }) {
      const [comment] = await db.update(comments).set(input).where(eq(comments.id, id)).returning();
      return comment ?? null;
    }
  };
}
