import { and, eq, ilike } from 'drizzle-orm';

import type { WorktrailDb } from '../db/client.js';
import { workItems } from '../db/schema.js';
import type { NewWorkItem, WorkItem } from './types.js';

export interface WorkItemFilters {
  status?: WorkItem['status'];
  assigneeId?: string;
  type?: WorkItem['type'];
  priority?: WorkItem['priority'];
  search?: string;
}

export function createWorkItemRepository(db: WorktrailDb) {
  return {
    async create(input: NewWorkItem) {
      const [workItem] = await db.insert(workItems).values(input).returning();
      return workItem;
    },

    async findById(id: string) {
      const [workItem] = await db.select().from(workItems).where(eq(workItems.id, id)).limit(1);
      return workItem ?? null;
    },

    async listByProject(projectId: string, filters: WorkItemFilters = {}) {
      const conditions = [eq(workItems.projectId, projectId)];

      if (filters.status !== undefined) {
        conditions.push(eq(workItems.status, filters.status));
      }

      if (filters.assigneeId !== undefined) {
        conditions.push(eq(workItems.assigneeId, filters.assigneeId));
      }

      if (filters.type !== undefined) {
        conditions.push(eq(workItems.type, filters.type));
      }

      if (filters.priority !== undefined) {
        conditions.push(eq(workItems.priority, filters.priority));
      }

      if (filters.search !== undefined && filters.search.trim() !== '') {
        conditions.push(ilike(workItems.title, `%${filters.search.trim()}%`));
      }

      return db
        .select()
        .from(workItems)
        .where(and(...conditions));
    },

    async updateStatus(id: string, status: WorkItem['status'], updatedAt: Date) {
      const [workItem] = await db
        .update(workItems)
        .set({ status, updatedAt })
        .where(eq(workItems.id, id))
        .returning();
      return workItem ?? null;
    }
  };
}

