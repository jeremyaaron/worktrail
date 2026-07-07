import { desc, eq } from 'drizzle-orm';

import type { WorktrailDb } from '../db/client.js';
import { projectStatusReports } from '../db/schema.js';
import type { NewProjectStatusReport } from './types.js';

export function createProjectStatusReportRepository(db: WorktrailDb) {
  return {
    async create(input: NewProjectStatusReport) {
      const [report] = await db.insert(projectStatusReports).values(input).returning();
      return report;
    },

    async findById(reportId: string) {
      const [report] = await db
        .select()
        .from(projectStatusReports)
        .where(eq(projectStatusReports.id, reportId))
        .limit(1);
      return report ?? null;
    },

    async listByProject(projectId: string) {
      return db
        .select()
        .from(projectStatusReports)
        .where(eq(projectStatusReports.projectId, projectId))
        .orderBy(desc(projectStatusReports.publishedAt), desc(projectStatusReports.createdAt));
    },

    async findLatestByProject(projectId: string) {
      const [report] = await db
        .select()
        .from(projectStatusReports)
        .where(eq(projectStatusReports.projectId, projectId))
        .orderBy(desc(projectStatusReports.publishedAt), desc(projectStatusReports.createdAt))
        .limit(1);
      return report ?? null;
    }
  };
}
