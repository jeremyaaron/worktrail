import type { WorkItemQuery } from '@worktrail/contracts';
import { and, asc, count, desc, eq } from 'drizzle-orm';

import type { WorktrailDb } from '../db/client.js';
import { projects, workItems } from '../db/schema.js';
import {
  buildProjectWorkItemConditions,
  buildProjectWorkItemOrderBy,
  buildWorkspaceWorkItemConditions,
  buildWorkspaceWorkItemOrderBy,
  type ProjectWorkItemQuery
} from './work-item-query-builder.js';
import type { NewWorkItem, Project, WorkItem } from './types.js';

export type WorkItemFilters = ProjectWorkItemQuery;

export interface UpdateWorkItemInput {
  title?: string;
  description?: string;
  type?: WorkItem['type'];
  status?: WorkItem['status'];
  priority?: WorkItem['priority'];
  assigneeId?: string | null;
  milestoneId?: string | null;
  boardPosition?: number;
  dueDate?: string | null;
  estimatePoints?: number | null;
  updatedAt: Date;
}

export interface MoveWorkItemInput {
  status: WorkItem['status'];
  boardPosition: number;
  updatedAt: Date;
}

export interface WorkspaceWorkItemRecord {
  workItem: WorkItem;
  project: Pick<Project, 'id' | 'key' | 'name' | 'status'>;
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

    async listByProjectAndStatusForBoard(projectId: string, status: WorkItem['status']) {
      return db
        .select()
        .from(workItems)
        .where(and(eq(workItems.projectId, projectId), eq(workItems.status, status)))
        .orderBy(asc(workItems.boardPosition), asc(workItems.itemNumber), asc(workItems.id));
    },

    async getTopBoardPosition(projectId: string, status: WorkItem['status']) {
      const [workItem] = await db
        .select({ boardPosition: workItems.boardPosition })
        .from(workItems)
        .where(and(eq(workItems.projectId, projectId), eq(workItems.status, status)))
        .orderBy(asc(workItems.boardPosition), asc(workItems.itemNumber), asc(workItems.id))
        .limit(1);
      return workItem?.boardPosition ?? null;
    },

    async listByProject(projectId: string, filters: WorkItemFilters = {}) {
      const conditions = buildProjectWorkItemConditions(projectId, filters);
      const orderBy = buildProjectWorkItemOrderBy(filters.sort);

      return db
        .select()
        .from(workItems)
        .where(and(...conditions))
        .orderBy(...orderBy);
    },

    async listByWorkspace(
      workspaceId: string,
      filters: WorkItemQuery = {}
    ): Promise<WorkspaceWorkItemRecord[]> {
      const conditions = buildWorkspaceWorkItemConditions(workspaceId, filters);
      const orderBy = buildWorkspaceWorkItemOrderBy(filters.sort);

      return db
        .select({
          workItem: workItems,
          project: {
            id: projects.id,
            key: projects.key,
            name: projects.name,
            status: projects.status
          }
        })
        .from(workItems)
        .innerJoin(projects, eq(projects.id, workItems.projectId))
        .where(and(...conditions))
        .orderBy(...orderBy);
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

    async updateStatus(
      id: string,
      status: WorkItem['status'],
      updatedAt: Date,
      boardPosition?: number
    ) {
      const [workItem] = await db
        .update(workItems)
        .set({
          status,
          ...(boardPosition === undefined ? {} : { boardPosition }),
          updatedAt
        })
        .where(eq(workItems.id, id))
        .returning();
      return workItem ?? null;
    },

    async moveOnBoard(id: string, input: MoveWorkItemInput) {
      const [workItem] = await db
        .update(workItems)
        .set({
          status: input.status,
          boardPosition: input.boardPosition,
          updatedAt: input.updatedAt
        })
        .where(eq(workItems.id, id))
        .returning();
      return workItem ?? null;
    },

    async compactBoardPositions(projectId: string, status: WorkItem['status']) {
      const items = await this.listByProjectAndStatusForBoard(projectId, status);
      const compacted: WorkItem[] = [];

      for (const [index, item] of items.entries()) {
        const boardPosition = (index + 1) * 1024;
        const [updated] = await db
          .update(workItems)
          .set({ boardPosition })
          .where(eq(workItems.id, item.id))
          .returning();

        if (updated !== undefined) {
          compacted.push(updated);
        }
      }

      return compacted;
    },

    async update(id: string, input: UpdateWorkItemInput) {
      const [workItem] = await db.update(workItems).set(input).where(eq(workItems.id, id)).returning();
      return workItem ?? null;
    }
  };
}
