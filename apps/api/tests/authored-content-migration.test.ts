import { readMigrationFiles } from 'drizzle-orm/migrator';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import type pg from 'pg';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createPool } from '../src/db/client.js';

const migrations = readMigrationFiles({
  migrationsFolder: fileURLToPath(new URL('../drizzle', import.meta.url))
});
const formatMigrationIndex = 19;
let pool: ReturnType<typeof createPool>;
let client: pg.PoolClient;
let schema: string;

async function applyMigrations(start: number, end: number): Promise<void> {
  for (const migration of migrations.slice(start, end)) {
    for (const statement of migration.sql) {
      // Generated foreign keys name public explicitly; isolate only that schema qualifier.
      await client.query(statement.replaceAll('"public".', `"${schema}".`));
    }
  }
}

async function insertLegacyRecords(): Promise<void> {
  const ids = Array.from({ length: 8 }, () => randomUUID());
  const [workspace, author, mentionedMember, project, cycle, item, comment, deletedComment] = ids;
  const timestamp = '2026-07-21T12:00:00.123Z';
  await client.query('insert into workspaces (id, name, created_at, updated_at) values ($1, $2, $3, $3)',
    [workspace, 'Legacy content', timestamp]);
  for (const id of [author, mentionedMember]) {
    await client.query(`insert into members
      (id, workspace_id, name, email, role, created_at, updated_at)
      values ($1, $2, 'Legacy author', $3, 'owner', $4, $4)`,
      [id, workspace, `${id}@example.com`, timestamp]);
  }
  await client.query(`insert into projects
    (id, workspace_id, key, name, status, created_at, updated_at)
    values ($1, $2, 'LEG', 'Legacy project', 'active', $3, $3)`, [project, workspace, timestamp]);
  await client.query(`insert into project_cycles
    (id, workspace_id, project_id, name, status, start_date, end_date, created_at, updated_at)
    values ($1, $2, $3, 'Legacy cycle', 'completed', '2026-07-01', '2026-07-14', $4, $4)`,
    [cycle, workspace, project, timestamp]);
  await client.query(`insert into work_items
    (id, workspace_id, project_id, title, description, item_number, display_key, type, status,
     priority, reporter_id, assignee_id, cycle_id, created_at, updated_at)
    values ($1, $2, $3, 'Legacy work', $4, 1, 'LEG-1', 'task', 'ready', 'medium', $5, $6, $7, $8, $8)`,
    [item, workspace, project, `  # Literal **source**\r\n${'oversized\r\n'.repeat(1_200)}  `,
      author, mentionedMember, cycle, timestamp]);
  for (const [id, body, deletedAt, deletedBy] of [
    [comment, '  **Literal comment**\r\n', null, null],
    [deletedComment, `  # Deleted\r\n${'legacy\r'.repeat(2_000)}`, timestamp, author]
  ]) {
    await client.query(`insert into comments
      (id, workspace_id, project_id, work_item_id, author_id, body, edited_at, deleted_at,
       deleted_by_id, created_at, updated_at)
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $7, $7)`,
      [id, workspace, project, item, author, body, timestamp, deletedAt, deletedBy]);
  }
  await client.query(`insert into comment_mentions
    (comment_id, member_id, workspace_id, work_item_id, created_at) values ($1, $2, $3, $4, $5)`,
    [comment, mentionedMember, workspace, item, timestamp]);
  await client.query(`insert into activity_events
    (id, workspace_id, project_id, work_item_id, actor_id, event_type, summary, created_at)
    values ($1, $2, $3, $4, $5, 'comment.added', 'Legacy discussion', $6)`,
    [randomUUID(), workspace, project, item, author, timestamp]);
  const snapshot = JSON.stringify({ snapshotVersion: 1, legacy: { source: '# Captured\r\n', item } });
  await client.query(`insert into project_status_reports
    (id, workspace_id, project_id, author_member_id, title, status_date, summary, snapshot,
     published_at, created_at) values ($1, $2, $3, $4, 'Legacy report', '2026-07-21', $5, $6, $7, $7)`,
    [randomUUID(), workspace, project, author, '**Stored report**\r\n', snapshot, timestamp]);
  await client.query(`insert into project_cycle_closeouts
    (id, workspace_id, project_id, cycle_id, closed_by_member_id, snapshot, closed_at, created_at)
    values ($1, $2, $3, $4, $5, $6, $7, $7)`,
    [randomUUID(), workspace, project, cycle, author, snapshot, timestamp]);
}

async function captureLegacyRecords(): Promise<Record<string, unknown>> {
  const result: Record<string, unknown> = {};
  for (const table of [
    'workspaces', 'members', 'projects', 'project_cycles', 'work_items', 'comments',
    'comment_mentions', 'activity_events', 'project_status_reports', 'project_cycle_closeouts'
  ]) {
    const rows = await client.query(`select to_jsonb(record) - 'description_format' - 'body_format'
      as record from "${schema}"."${table}" record
      order by (to_jsonb(record) - 'description_format' - 'body_format')::text`);
    result[table] = rows.rows.map((row: { record: unknown }) => row.record);
  }
  return result;
}

async function expectRejectedStatement(statement: string, code: string): Promise<void> {
  await client.query('savepoint invalid_format');
  try {
    await expect(client.query(statement)).rejects.toMatchObject({ code });
  } finally {
    await client.query('rollback to savepoint invalid_format');
    await client.query('release savepoint invalid_format');
  }
}

beforeAll(() => {
  pool = createPool();
});

beforeEach(async () => {
  client = await pool.connect();
  schema = `authored_content_${randomUUID().replaceAll('-', '')}`;
  await client.query('begin');
  await client.query(`create schema "${schema}"`);
  await client.query('select set_config($1, $2, true)', ['search_path', `${schema},public`]);
});

afterEach(async () => {
  if (client !== undefined) {
    try {
      await client.query('rollback');
    } finally {
      client.release();
    }
  }
});

afterAll(async () => {
  await pool.end();
});

describe('authored-content migration compatibility', () => {
  it('upgrades real pre-column rows without changing source, ownership, history, or snapshots', async () => {
    await applyMigrations(0, formatMigrationIndex);
    await insertLegacyRecords();
    const before = await captureLegacyRecords();

    await applyMigrations(formatMigrationIndex, formatMigrationIndex + 1);

    expect(await captureLegacyRecords()).toEqual(before);
    expect((await client.query('select description_format from work_items')).rows)
      .toEqual([{ description_format: 'plain_text' }]);
    expect((await client.query('select body_format from comments')).rows)
      .toEqual([{ body_format: 'plain_text' }, { body_format: 'plain_text' }]);
  });

  it('applies the full fresh migration chain with defaults and finite non-null format constraints', async () => {
    await applyMigrations(0, formatMigrationIndex + 1);
    await insertLegacyRecords();
    expect((await client.query('select description_format from work_items')).rows)
      .toEqual([{ description_format: 'plain_text' }]);
    expect((await client.query('select body_format from comments')).rows)
      .toEqual([{ body_format: 'plain_text' }, { body_format: 'plain_text' }]);
    await client.query("update work_items set description_format = 'markdown_v1'");
    await client.query("update comments set body_format = 'markdown_v1'");
    expect((await client.query('select description_format from work_items')).rows)
      .toEqual([{ description_format: 'markdown_v1' }]);
    expect((await client.query('select body_format from comments')).rows)
      .toEqual([{ body_format: 'markdown_v1' }, { body_format: 'markdown_v1' }]);
    for (const [table, field] of [['work_items', 'description_format'], ['comments', 'body_format']]) {
      await expectRejectedStatement(`update ${table} set ${field} = 'unknown'`, '23514');
      await expectRejectedStatement(`update ${table} set ${field} = null`, '23502');
    }
  });
});
