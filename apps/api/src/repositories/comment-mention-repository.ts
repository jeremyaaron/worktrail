import { asc, eq, inArray } from 'drizzle-orm';

import type { WorktrailDb } from '../db/client.js';
import { commentMentions } from '../db/schema.js';
import type { NewCommentMention } from './types.js';

export function createCommentMentionRepository(db: WorktrailDb) {
  return {
    async createMany(input: NewCommentMention[]) {
      if (input.length === 0) {
        return [];
      }

      return db.insert(commentMentions).values(input).returning();
    },

    async listByComment(commentId: string) {
      return db
        .select()
        .from(commentMentions)
        .where(eq(commentMentions.commentId, commentId))
        .orderBy(asc(commentMentions.createdAt), asc(commentMentions.memberId));
    },

    async listByComments(commentIds: string[]) {
      if (commentIds.length === 0) {
        return [];
      }

      return db
        .select()
        .from(commentMentions)
        .where(inArray(commentMentions.commentId, commentIds))
        .orderBy(asc(commentMentions.createdAt), asc(commentMentions.memberId));
    }
  };
}
