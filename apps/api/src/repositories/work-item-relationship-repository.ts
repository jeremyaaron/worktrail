import { asc, eq, inArray, or, sql } from 'drizzle-orm';

import type { WorktrailDb } from '../db/client.js';
import { workItemRelationships } from '../db/schema.js';
import { riskTerminalWorkItemStatuses } from '../domain/work-risk-policy.js';
import type { NewWorkItemRelationship, WorkItemRelationship } from './types.js';

export interface RelationshipLookupInput {
  workspaceId: string;
  relationshipType: WorkItemRelationship['relationshipType'];
  sourceWorkItemId: string;
  targetWorkItemId: string;
}

export interface DependencyCountRecord {
  workItemId: string;
  openBlockerCount: number;
  openBlockedWorkCount: number;
}

export function createWorkItemRelationshipRepository(db: WorktrailDb) {
  return {
    async create(input: NewWorkItemRelationship) {
      const [relationship] = await db.insert(workItemRelationships).values(input).returning();
      return relationship;
    },

    async findById(id: string) {
      const [relationship] = await db
        .select()
        .from(workItemRelationships)
        .where(eq(workItemRelationships.id, id))
        .limit(1);
      return relationship ?? null;
    },

    async findBetween(input: RelationshipLookupInput) {
      const [relationship] = await db
        .select()
        .from(workItemRelationships)
        .where(
          sql`${workItemRelationships.workspaceId} = ${input.workspaceId}
            and ${workItemRelationships.relationshipType} = ${input.relationshipType}
            and ${workItemRelationships.sourceWorkItemId} = ${input.sourceWorkItemId}
            and ${workItemRelationships.targetWorkItemId} = ${input.targetWorkItemId}`
        )
        .limit(1);
      return relationship ?? null;
    },

    async listForWorkItem(workItemId: string) {
      return db
        .select()
        .from(workItemRelationships)
        .where(
          or(
            eq(workItemRelationships.sourceWorkItemId, workItemId),
            eq(workItemRelationships.targetWorkItemId, workItemId)
          )
        )
        .orderBy(asc(workItemRelationships.createdAt), asc(workItemRelationships.id));
    },

    async listForWorkItems(workItemIds: string[]) {
      if (workItemIds.length === 0) {
        return [];
      }

      return db
        .select()
        .from(workItemRelationships)
        .where(
          or(
            inArray(workItemRelationships.sourceWorkItemId, workItemIds),
            inArray(workItemRelationships.targetWorkItemId, workItemIds)
          )
        )
        .orderBy(asc(workItemRelationships.createdAt), asc(workItemRelationships.id));
    },

    async delete(id: string) {
      const [relationship] = await db
        .delete(workItemRelationships)
        .where(eq(workItemRelationships.id, id))
        .returning();
      return relationship ?? null;
    },

    async wouldCreateBlockingCycle(input: {
      workspaceId: string;
      sourceWorkItemId: string;
      targetWorkItemId: string;
    }) {
      const result = await db.execute<{ found: number }>(sql`
        with recursive downstream(id) as (
          select ${workItemRelationships.targetWorkItemId}
          from ${workItemRelationships}
          where ${workItemRelationships.workspaceId} = ${input.workspaceId}
            and ${workItemRelationships.relationshipType} = 'blocks'
            and ${workItemRelationships.sourceWorkItemId} = ${input.targetWorkItemId}
          union
          select relationship_edges.target_work_item_id
          from ${workItemRelationships} relationship_edges
          inner join downstream on downstream.id = relationship_edges.source_work_item_id
          where relationship_edges.workspace_id = ${input.workspaceId}
            and relationship_edges.relationship_type = 'blocks'
        )
        select 1 as found
        from downstream
        where id = ${input.sourceWorkItemId}
        limit 1
      `);

      return result.rows.length > 0;
    },

    async listDependencyCounts(workItemIds: string[]): Promise<Map<string, DependencyCountRecord>> {
      const countsByWorkItemId = new Map<string, DependencyCountRecord>();

      for (const workItemId of workItemIds) {
        countsByWorkItemId.set(workItemId, {
          workItemId,
          openBlockerCount: 0,
          openBlockedWorkCount: 0
        });
      }

      if (workItemIds.length === 0) {
        return countsByWorkItemId;
      }

      const workItemIdArray = sql.join(
        workItemIds.map((workItemId) => sql`${workItemId}::uuid`),
        sql`, `
      );
      const terminalStatuses = terminalStatusListSql();
      const result = await db.execute<{
        workItemId: string;
        openBlockerCount: number;
        openBlockedWorkCount: number;
      }>(sql`
        with requested_work_items(id) as (
          select unnest(array[${workItemIdArray}])
        )
        select
          requested_work_items.id as "workItemId",
          coalesce(count(distinct inbound.source_work_item_id) filter (
            where blocker.status not in ${terminalStatuses}
          ), 0)::int as "openBlockerCount",
          coalesce(count(distinct outbound.target_work_item_id) filter (
            where blocked.status not in ${terminalStatuses}
          ), 0)::int as "openBlockedWorkCount"
        from requested_work_items
        left join work_item_relationships inbound
          on inbound.target_work_item_id = requested_work_items.id
          and inbound.relationship_type = 'blocks'
        left join work_items blocker
          on blocker.id = inbound.source_work_item_id
        left join work_item_relationships outbound
          on outbound.source_work_item_id = requested_work_items.id
          and outbound.relationship_type = 'blocks'
        left join work_items blocked
          on blocked.id = outbound.target_work_item_id
        group by requested_work_items.id
      `);

      for (const row of result.rows) {
        countsByWorkItemId.set(row.workItemId, {
          workItemId: row.workItemId,
          openBlockerCount: row.openBlockerCount,
          openBlockedWorkCount: row.openBlockedWorkCount
        });
      }

      return countsByWorkItemId;
    }
  };
}

function terminalStatusListSql() {
  return sql.raw(`(${riskTerminalWorkItemStatuses.map((status) => `'${status}'`).join(', ')})`);
}
