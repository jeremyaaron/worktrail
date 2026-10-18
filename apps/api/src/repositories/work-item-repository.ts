import type { WorkItemPageSize, WorkItemQuery } from '@worktrail/contracts';
import {
  and,
  aliasedTable,
  asc,
  count,
  desc,
  eq,
  getTableColumns,
  ilike,
  inArray,
  isNull,
  ne,
  or,
  sql,
  type SQL
} from 'drizzle-orm';

import type { RepositoryExecutor } from '../db/client.js';
import { projects, workItems } from '../db/schema.js';
import {
  buildProjectWorkItemConditions,
  buildProjectWorkItemOrderBy,
  buildWorkspaceWorkItemConditions,
  buildWorkspaceWorkItemOrderBy,
  dependencyConditions,
  type ProjectWorkItemQuery
} from './work-item-query-builder.js';
import type { NewWorkItem, Project, WorkItem, WorkItemSummary } from './types.js';

export type WorkItemFilters = ProjectWorkItemQuery;

export interface UpdateWorkItemInput {
  title?: string;
  description?: string;
  descriptionFormat?: WorkItem['descriptionFormat'];
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

export interface WorkspaceWorkItemSummaryRecord {
  workItem: WorkItemSummary;
  project: WorkspaceWorkItemRecord['project'];
}

const { description: _description, descriptionFormat: _descriptionFormat, ...summaryColumns } = getTableColumns(workItems);
const evaluationColumns = {
  id: workItems.id, workspaceId: workItems.workspaceId, projectId: workItems.projectId,
  parentWorkItemId: workItems.parentWorkItemId, milestoneId: workItems.milestoneId, cycleId: workItems.cycleId,
  displayKey: workItems.displayKey, title: workItems.title, status: workItems.status, priority: workItems.priority,
  assigneeId: workItems.assigneeId, reporterId: workItems.reporterId, dueDate: workItems.dueDate,
  estimatePoints: workItems.estimatePoints, createdAt: workItems.createdAt, updatedAt: workItems.updatedAt,
  itemNumber: workItems.itemNumber,
  dependencyBlocked: dependencyConditions('dependency_blocked')[0]!.mapWith(Boolean),
  blockingOpenWork: dependencyConditions('blocking_open_work')[0]!.mapWith(Boolean)
};

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

export interface WorkItemPageWindow {
  limit: WorkItemPageSize;
  offset: number;
}

const maximumParentCandidateLimit = 20;
const repositoryPageSizes = new Set<number>(
  [10, 25, 50, 100] as const satisfies readonly WorkItemPageSize[]
);

function assertPageWindow(window: WorkItemPageWindow): void {
  if (!Number.isSafeInteger(window.limit) || !repositoryPageSizes.has(window.limit)) {
    throw new RangeError('Work item page limit must be 10, 25, 50, or 100.');
  }

  if (!Number.isSafeInteger(window.offset) || window.offset < 0) {
    throw new RangeError('Work item page offset must be a nonnegative integer.');
  }
}

function assertFinitePositiveLimit(limit: number): void {
  if (!Number.isSafeInteger(limit) || limit <= 0) {
    throw new RangeError('Work item query limit must be a positive integer.');
  }
}

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

export function createWorkItemRepository(db: RepositoryExecutor) {
  return {
    async listEvaluationByProject(projectId: string) {
      return db.select(evaluationColumns).from(workItems)
        .where(and(...buildProjectWorkItemConditions(projectId)))
        .orderBy(...buildProjectWorkItemOrderBy('board_order'));
    },

    async listEvaluationByWorkspace(workspaceId: string) {
      return db.select({ workItem: evaluationColumns, project: {
        id: projects.id, key: projects.key, name: projects.name, status: projects.status
      } }).from(workItems).innerJoin(projects, eq(projects.id, workItems.projectId))
        .where(and(...buildWorkspaceWorkItemConditions(workspaceId)))
        .orderBy(...buildWorkspaceWorkItemOrderBy('updated_desc'));
    },

    async listWorkspaceSummariesByIds(workspaceId: string, ids: string[]) {
      if (ids.length === 0) return [];
      return db.select({ workItem: summaryColumns, project: {
        id: projects.id, key: projects.key, name: projects.name, status: projects.status
      } }).from(workItems).innerJoin(projects, eq(projects.id, workItems.projectId))
        .where(and(...buildWorkspaceWorkItemConditions(workspaceId), inArray(workItems.id, [...new Set(ids)])));
    },
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
          parent: {
            id: parentWorkItems.id,
            workspaceId: parentWorkItems.workspaceId,
            projectId: parentWorkItems.projectId,
            displayKey: parentWorkItems.displayKey,
            title: parentWorkItems.title,
            type: parentWorkItems.type,
            status: parentWorkItems.status
          }
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
      // Complete internal domain read; interactive HTTP lists use listPageByProject.
      const conditions = buildProjectWorkItemConditions(projectId, filters);
      const orderBy = buildProjectWorkItemOrderBy(filters.sort);

      return db
        .select()
        .from(workItems)
        .where(and(...conditions))
        .orderBy(...orderBy);
    },

    async countByProjectQuery(projectId: string, filters: WorkItemFilters = {}) {
      const conditions = buildProjectWorkItemConditions(projectId, filters);
      const [result] = await db
        .select({ value: count() })
        .from(workItems)
        .where(and(...conditions));

      return result?.value ?? 0;
    },

    async listPageByProject(
      projectId: string,
      filters: WorkItemFilters,
      window: WorkItemPageWindow
    ) {
      assertPageWindow(window);
      const conditions = buildProjectWorkItemConditions(projectId, filters);
      const orderBy = buildProjectWorkItemOrderBy(filters.sort);

      return db
        .select(summaryColumns)
        .from(workItems)
        .where(and(...conditions))
        .orderBy(...orderBy)
        .limit(window.limit)
        .offset(window.offset);
    },

    async listByProjectForBoard(projectId: string) {
      const conditions = buildProjectWorkItemConditions(projectId);

      return db
        .select(summaryColumns)
        .from(workItems)
        .where(and(...conditions))
        .orderBy(...buildProjectWorkItemOrderBy('board_order'));
    },

    async listByProjectForExport(
      projectId: string,
      filters: WorkItemFilters,
      limit: number
    ) {
      assertFinitePositiveLimit(limit);
      const conditions = buildProjectWorkItemConditions(projectId, filters);
      const orderBy = buildProjectWorkItemOrderBy(filters.sort);

      return db
        .select(summaryColumns)
        .from(workItems)
        .where(and(...conditions))
        .orderBy(...orderBy)
        .limit(limit);
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
      // Complete internal domain read; interactive HTTP lists use listPageByWorkspace.
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

    async countByWorkspaceQuery(workspaceId: string, filters: WorkItemQuery = {}) {
      const conditions = buildWorkspaceWorkItemConditions(workspaceId, filters);
      const [result] = await db
        .select({ value: count() })
        .from(workItems)
        .innerJoin(projects, eq(projects.id, workItems.projectId))
        .where(and(...conditions));

      return result?.value ?? 0;
    },

    async listPageByWorkspace(
      workspaceId: string,
      filters: WorkItemQuery,
      window: WorkItemPageWindow
    ): Promise<WorkspaceWorkItemSummaryRecord[]> {
      assertPageWindow(window);
      const conditions = buildWorkspaceWorkItemConditions(workspaceId, filters);
      const orderBy = buildWorkspaceWorkItemOrderBy(filters.sort);

      return db
        .select({
          workItem: summaryColumns,
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
        .orderBy(...orderBy)
        .limit(window.limit)
        .offset(window.offset);
    },

    async listByWorkspaceForExport(
      workspaceId: string,
      filters: WorkItemQuery,
      limit: number
    ): Promise<WorkspaceWorkItemSummaryRecord[]> {
      assertFinitePositiveLimit(limit);
      const conditions = buildWorkspaceWorkItemConditions(workspaceId, filters);
      const orderBy = buildWorkspaceWorkItemOrderBy(filters.sort);

      return db
        .select({
          workItem: summaryColumns,
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
        .orderBy(...orderBy)
        .limit(limit);
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

    async compactBoardPositions(projectId: string, status: WorkItem['status'], excludeWorkItemId?: string) {
      const items = (await this.listByProjectAndStatusForBoard(projectId, status)).filter(({ id }) => id !== excludeWorkItemId);
      const compacted: WorkItem[] = [];
      const positions = new Map(items.map((item, index) => [item.id, (index + 1) * 1024]));
      // Callers hold the board key and the complete target row set. Keep update order canonical too.
      for (const item of [...items].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0)) {
        const boardPosition = positions.get(item.id)!;
        const [updated] = await db
          .update(workItems)
          .set({ boardPosition })
          .where(eq(workItems.id, item.id))
          .returning();

        if (updated !== undefined) {
          compacted.push(updated);
        }
      }

      return compacted.sort((a, b) => a.boardPosition - b.boardPosition);
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
