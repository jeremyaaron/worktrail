import { and, asc, desc, eq, gte, isNull, lte, ne, or, sql } from 'drizzle-orm';

import type { WorktrailDb } from '../db/client.js';
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

export function createProjectCycleRepository(db: WorktrailDb) {
  return {
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

    async findActiveByProject(projectId: string) {
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

    async findNonArchivedByProjectName(projectId: string, name: string) {
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
