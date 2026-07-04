import { inArray, eq } from 'drizzle-orm';

import type { WorktrailDb } from '../db/client.js';
import { labels, workItemLabels } from '../db/schema.js';
import type { NewLabel } from './types.js';

export function createLabelRepository(db: WorktrailDb) {
  return {
    async create(input: NewLabel) {
      const [label] = await db.insert(labels).values(input).returning();
      return label;
    },

    async findById(id: string) {
      const [label] = await db.select().from(labels).where(eq(labels.id, id)).limit(1);
      return label ?? null;
    },

    async listByProject(projectId: string) {
      return db.select().from(labels).where(eq(labels.projectId, projectId));
    },

    async listByIds(ids: string[]) {
      if (ids.length === 0) {
        return [];
      }

      return db.select().from(labels).where(inArray(labels.id, ids));
    },

    async listByWorkItem(workItemId: string) {
      return db
        .select({
          id: labels.id,
          workspaceId: labels.workspaceId,
          projectId: labels.projectId,
          name: labels.name,
          color: labels.color,
          archivedAt: labels.archivedAt,
          archivedById: labels.archivedById,
          createdAt: labels.createdAt,
          updatedAt: labels.updatedAt
        })
        .from(labels)
        .innerJoin(workItemLabels, eq(workItemLabels.labelId, labels.id))
        .where(eq(workItemLabels.workItemId, workItemId));
    },

    async listByWorkItems(workItemIds: string[]) {
      if (workItemIds.length === 0) {
        return [];
      }

      return db
        .select({
          workItemId: workItemLabels.workItemId,
          label: {
            id: labels.id,
            workspaceId: labels.workspaceId,
            projectId: labels.projectId,
            name: labels.name,
            color: labels.color,
            archivedAt: labels.archivedAt,
            archivedById: labels.archivedById,
            createdAt: labels.createdAt,
            updatedAt: labels.updatedAt
          }
        })
        .from(workItemLabels)
        .innerJoin(labels, eq(workItemLabels.labelId, labels.id))
        .where(inArray(workItemLabels.workItemId, workItemIds));
    },

    async replaceForWorkItem(workItemId: string, labelIds: string[]) {
      await db.delete(workItemLabels).where(eq(workItemLabels.workItemId, workItemId));

      if (labelIds.length === 0) {
        return;
      }

      await db.insert(workItemLabels).values(
        labelIds.map((labelId) => ({
          workItemId,
          labelId
        }))
      );
    }
  };
}
