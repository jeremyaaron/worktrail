import { and, asc, count, desc, eq, ilike, sql } from 'drizzle-orm';

import type { WorktrailDb } from '../db/client.js';
import { workItemLabels, workItems } from '../db/schema.js';
import type { NewWorkItem, WorkItem } from './types.js';

export interface WorkItemFilters {
  status?: WorkItem['status'];
  assigneeId?: string;
  type?: WorkItem['type'];
  priority?: WorkItem['priority'];
  labelId?: string;
  search?: string;
  sort?:
    | 'updated_desc'
    | 'updated_asc'
    | 'priority_desc'
    | 'priority_asc'
    | 'due_date_asc'
    | 'created_desc'
    | 'board_order';
}

export interface UpdateWorkItemInput {
  title?: string;
  description?: string;
  type?: WorkItem['type'];
  status?: WorkItem['status'];
  priority?: WorkItem['priority'];
  assigneeId?: string | null;
  dueDate?: string | null;
  estimatePoints?: number | null;
  updatedAt: Date;
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

      if (filters.labelId !== undefined) {
        conditions.push(
          sql`exists (
            select 1 from ${workItemLabels}
            where ${workItemLabels.workItemId} = ${workItems.id}
            and ${workItemLabels.labelId} = ${filters.labelId}
          )`
        );
      }

      if (filters.search !== undefined && filters.search.trim() !== '') {
        conditions.push(ilike(workItems.title, `%${filters.search.trim()}%`));
      }

      const priorityRank = sql`case ${workItems.priority}
        when 'urgent' then 4
        when 'high' then 3
        when 'medium' then 2
        when 'low' then 1
        else 0
      end`;
      const orderBy =
        filters.sort === 'updated_asc'
          ? asc(workItems.updatedAt)
          : filters.sort === 'priority_desc'
            ? desc(priorityRank)
            : filters.sort === 'priority_asc'
              ? asc(priorityRank)
              : desc(workItems.updatedAt);

      return db
        .select()
        .from(workItems)
        .where(and(...conditions))
        .orderBy(orderBy);
    },

    async countByStatus(projectId: string) {
      return db
        .select({ status: workItems.status, count: count() })
        .from(workItems)
        .where(eq(workItems.projectId, projectId))
        .groupBy(workItems.status);
    },

    async listRecentByProject(projectId: string, limit = 5) {
      return db
        .select({
          id: workItems.id,
          displayKey: workItems.displayKey,
          title: workItems.title,
          status: workItems.status,
          updatedAt: workItems.updatedAt
        })
        .from(workItems)
        .where(eq(workItems.projectId, projectId))
        .orderBy(desc(workItems.updatedAt))
        .limit(limit);
    },

    async updateStatus(id: string, status: WorkItem['status'], updatedAt: Date) {
      const [workItem] = await db
        .update(workItems)
        .set({ status, updatedAt })
        .where(eq(workItems.id, id))
        .returning();
      return workItem ?? null;
    },

    async update(id: string, input: UpdateWorkItemInput) {
      const [workItem] = await db.update(workItems).set(input).where(eq(workItems.id, id)).returning();
      return workItem ?? null;
    }
  };
}
