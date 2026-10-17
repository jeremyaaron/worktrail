import { and, asc, desc, eq, gte, inArray, isNull, lte, ne, or, sql } from 'drizzle-orm';

import type { RepositoryExecutor } from '../db/client.js';
import { projectCycles } from '../db/schema.js';
import type { NewProjectCycle, ProjectCycle } from './types.js';

export interface ProjectCycleListOptions {
  includeArchived?: boolean;
  status?: ProjectCycle['status'];
}

export interface UpdateProjectCycleInput {
  name?: string;
  goal?: string;
  status?: ProjectCycle['status'];
  startDate?: string;
  endDate?: string;
  targetPoints?: number | null;
  archivedAt?: Date | null;
  archivedById?: string | null;
  updatedAt: Date;
}

export function createProjectCycleRepository(db: RepositoryExecutor) {
  return {
    async findScheduleConflicts(workspaceId?: string) {
      const result = await db.execute<{
        projectId: string; projectKey: string; leftCycleId: string; rightCycleId: string;
        dateOverlap: boolean; activeConflict: boolean;
      }>(sql`
        select a.project_id as "projectId", p.key as "projectKey",
          a.id as "leftCycleId", b.id as "rightCycleId",
          (a.start_date <= b.end_date and a.end_date >= b.start_date) as "dateOverlap",
          (a.status = 'active' and b.status = 'active') as "activeConflict"
        from project_cycles a
        join project_cycles b on a.project_id = b.project_id and a.workspace_id = b.workspace_id and a.id < b.id
        join projects p on p.id = a.project_id and p.workspace_id = a.workspace_id
        where a.archived_at is null and b.archived_at is null
          and a.status in ('planned', 'active') and b.status in ('planned', 'active')
          and ((a.start_date <= b.end_date and a.end_date >= b.start_date) or (a.status = 'active' and b.status = 'active'))
          and ${workspaceId === undefined ? sql`true` : sql`a.workspace_id = ${workspaceId}`}
        order by a.project_id, a.id, b.id
      `);
      return result.rows;
    },

    async create(input: NewProjectCycle) {
      const [cycle] = await db.insert(projectCycles).values(input).returning();
      return cycle;
    },

    async findById(id: string) {
      const [cycle] = await db
        .select()
        .from(projectCycles)
        .where(eq(projectCycles.id, id))
        .limit(1);
      return cycle ?? null;
    },

    async findByIdForUpdate(id: string) {
      const [cycle] = await db
        .select()
        .from(projectCycles)
        .where(eq(projectCycles.id, id))
        .limit(1)
        .for('update');
      return cycle ?? null;
    },

    async findManyByIdsForUpdate(ids: readonly string[]) {
      if (ids.length === 0) return [];
      return db.select().from(projectCycles).where(inArray(projectCycles.id, [...new Set(ids)]))
        .orderBy(asc(projectCycles.id)).for('update');
    },

    async listByIds(ids: string[]) {
      if (ids.length === 0) return [];
      return db.select().from(projectCycles).where(inArray(projectCycles.id, [...new Set(ids)]));
    },

    async findActiveByProject(projectId: string): Promise<ProjectCycle | null> {
      const [cycle] = await db
        .select()
        .from(projectCycles)
        .where(
          and(
            eq(projectCycles.projectId, projectId),
            eq(projectCycles.status, 'active'),
            isNull(projectCycles.archivedAt)
          )
        )
        .orderBy(asc(projectCycles.startDate), asc(projectCycles.name))
        .limit(1);
      return cycle ?? null;
    },

    async findNonArchivedByProjectName(projectId: string, name: string): Promise<ProjectCycle | null> {
      const [cycle] = await db
        .select()
        .from(projectCycles)
        .where(
          and(
            eq(projectCycles.projectId, projectId),
            isNull(projectCycles.archivedAt),
            sql`lower(${projectCycles.name}) = ${name.toLowerCase()}`
          )
        )
        .limit(1);
      return cycle ?? null;
    },

    async findUpcomingByProject(projectId: string, today: string) {
      const [cycle] = await db
        .select()
        .from(projectCycles)
        .where(
          and(
            eq(projectCycles.projectId, projectId),
            eq(projectCycles.status, 'planned'),
            gte(projectCycles.startDate, today),
            isNull(projectCycles.archivedAt)
          )
        )
        .orderBy(asc(projectCycles.startDate), asc(projectCycles.name))
        .limit(1);
      return cycle ?? null;
    },

    async findRecentlyCompletedByProject(projectId: string, today: string) {
      const [cycle] = await db
        .select()
        .from(projectCycles)
        .where(
          and(
            eq(projectCycles.projectId, projectId),
            eq(projectCycles.status, 'completed'),
            lte(projectCycles.endDate, today),
            isNull(projectCycles.archivedAt)
          )
        )
        .orderBy(desc(projectCycles.endDate), asc(projectCycles.name))
        .limit(1);
      return cycle ?? null;
    },

    async findOverlappingPlannedOrActive(
      projectId: string,
      startDate: string,
      endDate: string,
      excludeCycleId?: string
    ) {
      const conditions = [
        eq(projectCycles.projectId, projectId),
        isNull(projectCycles.archivedAt),
        or(eq(projectCycles.status, 'planned'), eq(projectCycles.status, 'active')),
        lte(projectCycles.startDate, endDate),
        gte(projectCycles.endDate, startDate)
      ];

      if (excludeCycleId !== undefined) {
        conditions.push(ne(projectCycles.id, excludeCycleId));
      }

      return db
        .select()
        .from(projectCycles)
        .where(and(...conditions))
        .orderBy(asc(projectCycles.startDate), asc(projectCycles.name));
    },

    async listByProject(projectId: string, input: ProjectCycleListOptions = {}) {
      const conditions = [eq(projectCycles.projectId, projectId)];

      if (input.includeArchived !== true) {
        conditions.push(isNull(projectCycles.archivedAt));
      }

      if (input.status !== undefined) {
        conditions.push(eq(projectCycles.status, input.status));
      }

      return db
        .select()
        .from(projectCycles)
        .where(and(...conditions))
        .orderBy(asc(projectCycles.startDate), asc(projectCycles.name));
    },

    async update(id: string, input: UpdateProjectCycleInput) {
      const [cycle] = await db
        .update(projectCycles)
        .set(input)
        .where(eq(projectCycles.id, id))
        .returning();
      return cycle ?? null;
    },

    async archive(id: string, archivedAt: Date, archivedById: string) {
      const [cycle] = await db
        .update(projectCycles)
        .set({ archivedAt, archivedById, updatedAt: archivedAt })
        .where(eq(projectCycles.id, id))
        .returning();
      return cycle ?? null;
    },

    async reactivate(id: string, updatedAt: Date) {
      const [cycle] = await db
        .update(projectCycles)
        .set({ archivedAt: null, archivedById: null, updatedAt })
        .where(eq(projectCycles.id, id))
        .returning();
      return cycle ?? null;
    }
  };
}
