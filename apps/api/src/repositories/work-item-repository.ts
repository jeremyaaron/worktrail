import type { WorkItemQuery } from '@worktrail/contracts';
import {
  and,
  aliasedTable,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  ne,
  or,
  sql,
  type SQL
} from 'drizzle-orm';

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
  cycleId?: string | null;
  parentWorkItemId?: string | null;
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

export interface EligibleParentCandidateInput {
  workItem: WorkItem;
  search?: string;
  limit: number;
}

export interface WorkItemChildSummaryRecord {
  totalCount: number;
  openCount: number;
  doneCount: number;
  canceledCount: number;
  estimatedCount: number;
  unestimatedCount: number;
  estimatePoints: number;
}

const maximumParentCandidateLimit = 20;

function terminalRankSql(): SQL {
  return sql`case when ${workItems.status} in ('done', 'canceled') then 1 else 0 end`;
}

function priorityRankSql(): SQL {
  return sql`case ${workItems.priority}
    when 'urgent' then 4
    when 'high' then 3
    when 'medium' then 2
    when 'low' then 1
    else 0
  end`;
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

    async findManyByIdsForUpdate(ids: string[]) {
      const sortedIds = [...new Set(ids)].sort((left, right) => left.localeCompare(right));

      if (sortedIds.length === 0) {
        return [];
      }

      return db
        .select()
        .from(workItems)
        .where(inArray(workItems.id, sortedIds))
        .orderBy(asc(workItems.id))
        .for('update');
    },

    async listChildren(parentWorkItemId: string, limit: number) {
      return db
        .select()
        .from(workItems)
        .where(eq(workItems.parentWorkItemId, parentWorkItemId))
        .orderBy(
          asc(terminalRankSql()),
          desc(priorityRankSql()),
          asc(workItems.boardPosition),
          asc(workItems.itemNumber),
          asc(workItems.id)
        )
        .limit(Math.max(0, limit));
    },

    async hasChildren(parentWorkItemId: string) {
      const [child] = await db
        .select({ id: workItems.id })
        .from(workItems)
        .where(eq(workItems.parentWorkItemId, parentWorkItemId))
        .limit(1);
      return child !== undefined;
    },

    async listEligibleParentCandidates(input: EligibleParentCandidateInput) {
      const search = input.search?.trim();
      const conditions = [
        eq(workItems.projectId, input.workItem.projectId),
        ne(workItems.id, input.workItem.id),
        isNull(workItems.parentWorkItemId)
      ];

      if (search !== undefined && search !== '') {
        const pattern = `%${search}%`;
        conditions.push(or(ilike(workItems.displayKey, pattern), ilike(workItems.title, pattern))!);
      }

      const keyMatchOrder = search === undefined || search === ''
        ? []
        : [
            desc(sql`case
              when lower(${workItems.displayKey}) = lower(${search}) then 2
              when lower(${workItems.displayKey}) like lower(${`${search}%`}) then 1
              else 0
            end`)
          ];

      return db
        .select()
        .from(workItems)
        .where(and(...conditions))
        .orderBy(
          asc(terminalRankSql()),
          ...keyMatchOrder,
          desc(workItems.updatedAt),
          asc(workItems.itemNumber),
          asc(workItems.id)
        )
        .limit(Math.min(maximumParentCandidateLimit, Math.max(0, input.limit)));
    },

    async listParentsForChildren(workItemIds: string[]) {
      const uniqueIds = [...new Set(workItemIds)];

      if (uniqueIds.length === 0) {
        return [];
      }

      const parentWorkItems = aliasedTable(workItems, 'parent_work_items');
      return db
        .select({
          childWorkItemId: workItems.id,
          parent: parentWorkItems
        })
        .from(workItems)
        .innerJoin(parentWorkItems, eq(parentWorkItems.id, workItems.parentWorkItemId))
        .where(inArray(workItems.id, uniqueIds))
        .orderBy(asc(workItems.id));
    },

    async summarizeChildren(parentWorkItemIds: string[]) {
      const uniqueIds = [...new Set(parentWorkItemIds)];

      if (uniqueIds.length === 0) {
        return [];
      }

      const rows = await db
        .select({
          parentWorkItemId: workItems.parentWorkItemId,
          totalCount: count(),
          openCount: sql<number>`count(*) filter (
            where ${workItems.status} not in ('done', 'canceled')
          )`.mapWith(Number),
          doneCount: sql<number>`count(*) filter (
            where ${workItems.status} = 'done'
          )`.mapWith(Number),
          canceledCount: sql<number>`count(*) filter (
            where ${workItems.status} = 'canceled'
          )`.mapWith(Number),
          estimatedCount: sql<number>`count(*) filter (
            where ${workItems.estimatePoints} is not null
          )`.mapWith(Number),
          unestimatedCount: sql<number>`count(*) filter (
            where ${workItems.estimatePoints} is null
          )`.mapWith(Number),
          estimatePoints: sql<number>`coalesce(sum(${workItems.estimatePoints}), 0)`.mapWith(Number)
        })
        .from(workItems)
        .where(inArray(workItems.parentWorkItemId, uniqueIds))
        .groupBy(workItems.parentWorkItemId)
        .orderBy(asc(workItems.parentWorkItemId));

      return rows.map((row) => ({
        parentWorkItemId: row.parentWorkItemId!,
        summary: {
          totalCount: row.totalCount,
          openCount: row.openCount,
          doneCount: row.doneCount,
          canceledCount: row.canceledCount,
          estimatedCount: row.estimatedCount,
          unestimatedCount: row.unestimatedCount,
          estimatePoints: row.estimatePoints
        } satisfies WorkItemChildSummaryRecord
      }));
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

    async listByCycleForUpdate(projectId: string, cycleId: string) {
      return db
        .select()
        .from(workItems)
        .where(and(eq(workItems.projectId, projectId), eq(workItems.cycleId, cycleId)))
        .orderBy(asc(workItems.id))
        .for('update');
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
    },

    async updateCycleAssignments(
      ids: string[],
      cycleId: string | null,
      updatedAt: Date
    ) {
      if (ids.length === 0) {
        return [];
      }

      const updated = await db
        .update(workItems)
        .set({ cycleId, updatedAt })
        .where(inArray(workItems.id, ids))
        .returning();

      return updated.sort((left, right) => left.id.localeCompare(right.id));
    }
  };
}
