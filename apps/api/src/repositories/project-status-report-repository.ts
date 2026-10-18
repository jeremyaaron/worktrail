import { asc, desc, eq, inArray } from 'drizzle-orm';

import type { RepositoryExecutor } from '../db/client.js';
import { projectStatusReports } from '../db/schema.js';
import type { NewProjectStatusReport } from './types.js';

export function createProjectStatusReportRepository(db: RepositoryExecutor) {
  return {
    async listLatestByProjects(projectIds: string[]) {
      if (projectIds.length === 0) return [];
      // Summary consumers need selected evidence for health, not narrative source or every older snapshot.
      return db.selectDistinctOn([projectStatusReports.projectId], {
        id: projectStatusReports.id, workspaceId: projectStatusReports.workspaceId, projectId: projectStatusReports.projectId,
        title: projectStatusReports.title, statusDate: projectStatusReports.statusDate,
        authorMemberId: projectStatusReports.authorMemberId, publishedAt: projectStatusReports.publishedAt,
        createdAt: projectStatusReports.createdAt, snapshot: projectStatusReports.snapshot
      }).from(projectStatusReports).where(inArray(projectStatusReports.projectId, projectIds))
        .orderBy(asc(projectStatusReports.projectId), desc(projectStatusReports.publishedAt), desc(projectStatusReports.createdAt), desc(projectStatusReports.id));
    },
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
        .orderBy(desc(projectStatusReports.publishedAt), desc(projectStatusReports.createdAt), desc(projectStatusReports.id));
    },

    async findLatestByProject(projectId: string) {
      const [report] = await db
        .select()
        .from(projectStatusReports)
        .where(eq(projectStatusReports.projectId, projectId))
        .orderBy(desc(projectStatusReports.publishedAt), desc(projectStatusReports.createdAt), desc(projectStatusReports.id))
        .limit(1);
      return report ?? null;
    }
  };
}
