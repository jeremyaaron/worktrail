import type pg from 'pg';

import { assertOwnedDatabase } from '../../../../scripts/verification/ownership.mjs';

const dependentTables = [
  'notifications', 'comment_mentions', 'project_cycle_closeouts', 'project_status_reports',
  'workspace_activity_events', 'activity_events', 'comments', 'work_item_watchers',
  'work_item_attachments', 'work_item_relationships', 'saved_work_views'
] as const;

export async function cleanupWorkspace(pool: pg.Pool, workspaceId: string): Promise<void> {
  await assertOwnedDatabase(process.env, pool);
  for (const table of dependentTables) {
    await pool.query(`delete from ${table} where workspace_id = $1`, [workspaceId]);
  }
  await pool.query(
    'delete from work_item_labels where work_item_id in (select id from work_items where workspace_id = $1)',
    [workspaceId]
  );
  await pool.query('update work_items set parent_work_item_id = null where workspace_id = $1', [workspaceId]);
  for (const table of ['work_items', 'labels', 'project_cycles', 'milestones', 'projects', 'members'] as const) {
    await pool.query(`delete from ${table} where workspace_id = $1`, [workspaceId]);
  }
  await pool.query('delete from workspaces where id = $1', [workspaceId]);
}
