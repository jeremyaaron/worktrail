import { eq } from 'drizzle-orm';

import type { WorktrailDb } from '../db/client.js';
import { projects } from '../db/schema.js';
import type { NewProject, Project } from './types.js';

export interface UpdateProjectInput {
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
    }
  };
}
