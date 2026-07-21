import { count, desc, eq, sql } from 'drizzle-orm';

import type { WorktrailDb } from '../db/client.js';
import { workItemAttachments } from '../db/schema.js';
import type { NewWorkItemAttachment } from './types.js';

export interface WorkItemAttachmentUsage {
  attachmentCount: number;
  aggregateBytes: number;
}

export function createWorkItemAttachmentRepository(db: WorktrailDb) {
  return {
    async create(input: NewWorkItemAttachment) {
      const [attachment] = await db.insert(workItemAttachments).values(input).returning();
      return attachment;
    },

    async findById(id: string) {
      const [attachment] = await db
        .select()
        .from(workItemAttachments)
        .where(eq(workItemAttachments.id, id))
        .limit(1);
      return attachment ?? null;
    },

    async findByIdForUpdate(id: string) {
      const [attachment] = await db
        .select()
        .from(workItemAttachments)
        .where(eq(workItemAttachments.id, id))
        .limit(1)
        .for('update');
      return attachment ?? null;
    },

    async listByWorkItem(workItemId: string) {
      return db
        .select()
        .from(workItemAttachments)
        .where(eq(workItemAttachments.workItemId, workItemId))
        .orderBy(desc(workItemAttachments.createdAt), desc(workItemAttachments.id));
    },

    async getUsageByWorkItem(workItemId: string): Promise<WorkItemAttachmentUsage> {
      const [usage] = await db
        .select({
          attachmentCount: count(),
          aggregateBytes: sql<number>`coalesce(sum(${workItemAttachments.byteSize}), 0)`.mapWith(
            Number
          )
        })
        .from(workItemAttachments)
        .where(eq(workItemAttachments.workItemId, workItemId));

      return usage ?? { attachmentCount: 0, aggregateBytes: 0 };
    },

    async deleteById(id: string) {
      const [attachment] = await db
        .delete(workItemAttachments)
        .where(eq(workItemAttachments.id, id))
        .returning();
      return attachment ?? null;
    }
  };
}
