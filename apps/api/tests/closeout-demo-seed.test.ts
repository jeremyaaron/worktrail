import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';

import { createDb, createPool } from '../src/db/client.js';
import { seedHistoricalCloseoutDemo } from '../src/db/closeout-demo-seed.js';
import { members, projects, workspaces } from '../src/db/schema.js';
import { cleanupWorkspace } from './support/workspace-fixtures.js';

const pool = createPool();
const db = createDb(pool);
const workspaceId = randomUUID();

afterAll(async () => {
  await cleanupWorkspace(pool, workspaceId);
  await pool.end();
});

describe('historical closeout demo seed', () => {
  it('stores twelve complete v1/v2 commitments separately from changed current work and preserves history on reseed', async () => {
    const projectId = randomUUID();
    const maintainerId = randomUUID();
    const contributorId = randomUUID();
    const now = new Date('2026-05-01T12:00:00.000Z');
    await db.insert(workspaces).values({ id: workspaceId, name: 'Historical demo verification', createdAt: now, updatedAt: now });
    await db.insert(members).values([
      { id: maintainerId, workspaceId, name: 'Morgan Maintainer', email: 'morgan@example.com', role: 'maintainer', createdAt: now, updatedAt: now },
      { id: contributorId, workspaceId, name: 'Casey Contributor', email: 'casey@example.com', role: 'contributor', createdAt: now, updatedAt: now }
    ]);
    await db.insert(projects).values({ id: projectId, workspaceId, key: 'LAB', name: 'Cycle Closeout Lab', status: 'active', createdAt: now, updatedAt: now });
    const input = { db, workspaceId, projectId, maintainerId, contributorId };
    await seedHistoricalCloseoutDemo(input);
    const before = await pool.query('select snapshot from project_cycle_closeouts where workspace_id = $1 order by cycle_id', [workspaceId]);
    expect(before.rows.map(row => row.snapshot.snapshotVersion)).toEqual([1, 2]);
    for (const row of before.rows) {
      expect(row.snapshot.items.unfinished).toHaveLength(12);
      expect(row.snapshot.items.unfinished[11].title).toBe('Original carryover commitment 12');
      expect(row.snapshot.items.unfinished[0]).toMatchObject({ status: 'ready', estimatePoints: 2 });
    }
    const current = await pool.query('select title, status, estimate_points, cycle_id from work_items where workspace_id = $1 order by item_number', [workspaceId]);
    expect(current.rows).toHaveLength(12);
    expect(current.rows[0]).toMatchObject({ title: 'Revised follow-through 1', status: 'done', estimate_points: 8, cycle_id: null });
    await seedHistoricalCloseoutDemo(input);
    const after = await pool.query('select snapshot from project_cycle_closeouts where workspace_id = $1 order by cycle_id', [workspaceId]);
    expect(after.rows).toEqual(before.rows);
  });
});
