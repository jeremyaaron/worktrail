import { and, eq, sql } from 'drizzle-orm';

import type { WorktrailDb } from '../db/client.js';
import { projects, workItems } from '../db/schema.js';
import type { NewProject, Project } from './types.js';

export interface UpdateProjectInput {
  key?: string;
  name?: string;
  description?: string;
  status?: Project['status'];
  updatedAt: Date;
}

export function createProjectRepository(db: WorktrailDb) {
  return {
    async create(input: NewProject) {
      const [project] = await db.insert(projects).values(input).returning();
      return project;
    },

    async findById(id: string) {
      const [project] = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
      return project ?? null;
    },

    async findByIdForShare(id: string) {
      const [project] = await db
        .select()
        .from(projects)
        .where(eq(projects.id, id))
        .limit(1)
        .for('share');
      return project ?? null;
    },

    async findByWorkspaceKey(workspaceId: string, key: string) {
      const [project] = await db
        .select()
        .from(projects)
        .where(and(eq(projects.workspaceId, workspaceId), eq(projects.key, key)))
        .limit(1);
      return project ?? null;
    },

    async hasWorkItems(id: string) {
      const [row] = await db
        .select({ id: workItems.id })
        .from(workItems)
        .where(eq(workItems.projectId, id))
        .limit(1);
      return row !== undefined;
    },

    async listByWorkspace(workspaceId: string) {
      return db.select().from(projects).where(eq(projects.workspaceId, workspaceId));
    },

    async updateStatus(id: string, status: Project['status'], updatedAt: Date) {
      const [project] = await db
        .update(projects)
        .set({ status, updatedAt })
        .where(eq(projects.id, id))
        .returning();
      return project ?? null;
    },

    async update(id: string, input: UpdateProjectInput) {
      const [project] = await db.update(projects).set(input).where(eq(projects.id, id)).returning();
      return project ?? null;
    },

    async allocateWorkItemNumber(id: string, updatedAt: Date) {
      const [project] = await db
        .update(projects)
        .set({
          nextWorkItemNumber: sql`${projects.nextWorkItemNumber} + 1`,
          updatedAt
        })
        .where(eq(projects.id, id))
        .returning();
      return project ?? null;
    }
  };
}
