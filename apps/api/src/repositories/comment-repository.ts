import { asc, eq } from 'drizzle-orm';

import type { RepositoryExecutor } from '../db/client.js';
import { comments } from '../db/schema.js';
import type { Comment, NewComment } from './types.js';

export interface UpdateCommentInput {
  body: string;
  bodyFormat?: Comment['bodyFormat'];
  editedAt: Date;
  updatedAt: Date;
}

export function createCommentRepository(db: RepositoryExecutor) {
  return {
    async create(input: NewComment) {
      const [comment] = await db.insert(comments).values(input).returning();
      return comment;
    },

    async findById(id: string) {
      const [comment] = await db.select().from(comments).where(eq(comments.id, id)).limit(1);
      return comment ?? null;
    },

    async findByIdForUpdate(id: string) {
      const [comment] = await db
        .select()
        .from(comments)
        .where(eq(comments.id, id))
        .for('update');
      return comment ?? null;
    },

    async findByWorkItem(workItemId: string) {
      return db
        .select()
        .from(comments)
        .where(eq(comments.workItemId, workItemId))
        .orderBy(asc(comments.createdAt));
    },

    async updateContent(id: string, input: UpdateCommentInput) {
      const [comment] = await db.update(comments).set(input).where(eq(comments.id, id)).returning();
      return comment ?? null;
    },

    async softDelete(id: string, input: { deletedAt: Date; deletedById: string; updatedAt: Date }) {
      const [comment] = await db.update(comments).set(input).where(eq(comments.id, id)).returning();
      return comment ?? null;
    }
  };
}
