import { and, asc, eq, isNull, sql } from 'drizzle-orm';

import type { WorktrailDb } from '../db/client.js';
import { milestones } from '../db/schema.js';
import type { Milestone, NewMilestone } from './types.js';

export interface MilestoneListOptions {
  includeArchived?: boolean;
  status?: Milestone['status'];
}

export interface UpdateMilestoneInput {
  name?: string;
  description?: string;
  status?: Milestone['status'];
  targetDate?: string | null;
  archivedAt?: Date | null;
  archivedById?: string | null;
  updatedAt: Date;
}

export function createMilestoneRepository(db: WorktrailDb) {
  return {
    async create(input: NewMilestone) {
      const [milestone] = await db.insert(milestones).values(input).returning();
      return milestone;
    },

    async findById(id: string) {
      const [milestone] = await db.select().from(milestones).where(eq(milestones.id, id)).limit(1);
      return milestone ?? null;
    },

    async findActiveByProjectName(projectId: string, name: string) {
      const [milestone] = await db
        .select()
        .from(milestones)
        .where(
          and(
            eq(milestones.projectId, projectId),
            isNull(milestones.archivedAt),
            sql`lower(${milestones.name}) = ${name.toLowerCase()}`
          )
        )
        .limit(1);
      return milestone ?? null;
    },

    async listByProject(projectId: string, input: MilestoneListOptions = {}) {
      const conditions = [eq(milestones.projectId, projectId)];

      if (input.includeArchived !== true) {
        conditions.push(isNull(milestones.archivedAt));
      }

      if (input.status !== undefined) {
        conditions.push(eq(milestones.status, input.status));
      }

      return db
        .select()
        .from(milestones)
        .where(and(...conditions))
        .orderBy(asc(milestones.targetDate), asc(milestones.name));
    },

    async update(id: string, input: UpdateMilestoneInput) {
      const [milestone] = await db
        .update(milestones)
        .set(input)
        .where(eq(milestones.id, id))
        .returning();
      return milestone ?? null;
    },

    async archive(id: string, archivedAt: Date, archivedById: string) {
      const [milestone] = await db
        .update(milestones)
        .set({ archivedAt, archivedById, updatedAt: archivedAt })
        .where(eq(milestones.id, id))
        .returning();
      return milestone ?? null;
    },

    async reactivate(id: string, updatedAt: Date) {
      const [milestone] = await db
        .update(milestones)
        .set({ archivedAt: null, archivedById: null, updatedAt })
        .where(eq(milestones.id, id))
        .returning();
      return milestone ?? null;
    }
  };
}
