import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { eq, sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { parse } from 'csv-parse/sync';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { createDb, createPool } from '../src/db/client.js';
import * as schema from '../src/db/schema.js';
import { createRepositories } from '../src/repositories/index.js';
import { createPersistence } from '../src/repositories/persistence.js';
import { createExpressApp } from '../src/adapters/express/server.js';
import { ProjectCycleService } from '../src/services/project-cycle-service.js';
import { ProjectCycleCloseoutService } from '../src/services/project-cycle-closeout-service.js';
import { ProjectStatusReportService } from '../src/services/project-status-report-service.js';
import { createEstimateRiskFixture } from './support/estimate-risk-fixture.js';
import { goldenCloseoutV1, goldenReportV1 } from './support/snapshot-fixtures.js';
import { cleanupWorkspace } from './support/workspace-fixtures.js';
import request from './support/local-http.js';
import type { ProjectStatusReportSnapshotV1Dto } from '@worktrail/contracts';

let pool: ReturnType<typeof createPool>, db: ReturnType<typeof createDb>;
const workspaces = new Set<string>();
beforeAll(() => { pool = createPool(); db = createDb(pool); });
afterEach(async () => { for (const id of workspaces) await cleanupWorkspace(pool, id); workspaces.clear(); });
afterAll(async () => pool.end());

async function fixture() {
  const workspaceId = randomUUID(); workspaces.add(workspaceId);
  const f = await createEstimateRiskFixture(db, workspaceId);
  const context = { repositories: createRepositories(db), persistence: createPersistence(db), actor: f.actor, clock: () => f.now };
  return { ...f, context, app: createExpressApp(context), headers: { 'x-worktrail-workspace-id': workspaceId, 'x-worktrail-member-id': f.memberId } };
}

describe('estimate SQL/HTTP/export and snapshot preservation', () => {
  it.each(['estimated', 'unestimated'] as const)('applies %s consistently to project/workspace count, page, export and cycle scope', async (estimateState) => {
    const f = await fixture();
    const expected = estimateState === 'estimated' ? [f.ids.parent, f.ids.positive] : [f.ids.child, f.ids.stale];
    const query = { estimateState, cycleId: f.cycleId, workState: 'open' };
    for (const base of [`/api/projects/${f.projectId}/work-items`, '/api/work-items']) {
      const page = await request(f.app).get(base).set(f.headers).query({ ...query, pageSize: 10 }).expect(200);
      expect(page.body.totalCount).toBe(2);
      expect(page.body.items.map((item: { id: string }) => item.id).sort()).toEqual([...expected].sort());
      const exported = await request(f.app).get(`${base}/export`).set(f.headers).query(query).expect(200);
      const records = parse(exported.text, { columns: true }) as Array<{ display_key: string; estimate_points: string }>;
      expect(records.map(row => row.display_key).sort()).toEqual((estimateState === 'estimated' ? ['EST-1', 'EST-4'] : ['EST-2', 'EST-3']).sort());
      if (estimateState === 'estimated') expect(records.some(row => row.estimate_points === '0')).toBe(true);
      else expect(records.every(row => row.estimate_points === '')).toBe(true);
    }
  });
  it('ANDs estimate state with labels and parent hierarchy, without implicitly restricting terminal work', async () => {
    const f = await fixture();
    const children = await request(f.app).get(`/api/projects/${f.projectId}/work-items`).set(f.headers)
      .query({ estimateState: 'unestimated', parentKey: 'est-1', labelId: f.labelId }).expect(200);
    expect(children.body.items.map((item: { id: string }) => item.id)).toEqual([f.ids.child]);
    const all = await request(f.app).get('/api/work-items').set(f.headers).query({ estimateState: 'unestimated' }).expect(200);
    expect(all.body.totalCount).toBe(4);
    expect(all.body.items.some((item: { id: string }) => item.id === f.ids.done)).toBe(true);
  });
  it('keeps UTC due predicates independent of the PostgreSQL session timezone', async () => {
    const f = await fixture();
    for (const zone of ['Pacific/Kiritimati', 'Etc/GMT+12']) {
      await db.transaction(async tx => {
        await tx.execute(sql`select set_config('TimeZone', ${zone}, true)`);
        const repositories = createRepositories(tx);
        const overdue = await repositories.workItems.listByProject(f.projectId, { cycleId: f.cycleId, dueDateState: 'overdue' });
        expect(overdue.map(item => item.id)).toEqual([f.ids.stale]);
        const soon = await repositories.workItems.listByProject(f.projectId, { cycleId: f.cycleId, dueDateState: 'due_soon' });
        expect(soon.map(item => item.id).sort()).toEqual([f.ids.child, f.ids.positive].sort());
      }, { isolationLevel: 'repeatable read', accessMode: 'read only' });
    }
  });
  it('persists and pins exact estimate/risk/false queries in personal and shared views', async () => {
    const f = await fixture();
    for (const visibility of ['personal', 'workspace']) {
      const query = { cycleId: f.cycleId, estimateState: 'unestimated', workState: 'open', blocked: false, sort: 'priority_desc' };
      const created = await request(f.app).post('/api/saved-work-views').set(f.headers)
        .send({ name: `${visibility} estimates`, scope: 'project', projectId: f.projectId, visibility, query }).expect(201);
      const pinned = await request(f.app).patch(`/api/saved-work-views/${created.body.id}`).set(f.headers).send({ isPinned: true }).expect(200);
      expect(pinned.body).toMatchObject({ isPinned: true, query });
      expect(pinned.body.query).not.toHaveProperty('page');
      const opened = await request(f.app).get(`/api/projects/${f.projectId}/work-items`).set(f.headers).query(pinned.body.query).expect(200);
      expect(opened.body.totalCount).toBe(2);
    }
  });
  it('makes unestimated risk continuation exact and counts overlapping memberships as signals, not unique work', async () => {
    const f = await fixture();
    const review = await new ProjectCycleService(f.context).getCycleReview(f.projectId, f.cycleId);
    const unestimated = review.riskSections.find(section => section.type === 'unestimated')!;
    expect(unestimated).toMatchObject({ count: 2, countUnit: 'work_items', query: { cycleId: f.cycleId, estimateState: 'unestimated', workState: 'open' } });
    expect(unestimated.items.map(item => item.id).sort()).toEqual([f.ids.child, f.ids.stale].sort());
    const continued = await request(f.app).get(`/api/projects/${f.projectId}/work-items`).set(f.headers).query(unestimated.query).expect(200);
    expect(continued.body.totalCount).toBe(unestimated.count);
    expect(review.riskSections.every(section => !section.description.includes('milestone'))).toBe(true);
    expect(review.riskSections.find(section => section.type === 'over_target')).toMatchObject({ count: 1, countUnit: 'scope_conditions' });
    const memberships = review.riskSections.filter(section => section.countUnit === 'work_items').reduce((sum, section) => sum + section.count, 0);
    const distinct = new Set(review.riskSections.filter(section => section.countUnit === 'work_items').flatMap(section => section.items.map(item => item.id))).size;
    expect(memberships).toBeGreaterThan(distinct);
    expect(review.progress.committedEstimatePoints).toBe(5);
  });
  it('produces v2 reports/closeouts, shares precise links, and replays immutable v2 evidence after work changes', async () => {
    const f = await fixture(); const reports = new ProjectStatusReportService(f.context);
    const draft = await reports.getProjectStatusReportDraft(f.projectId);
    expect(draft.snapshot.snapshotVersion).toBe(2);
    const reason = draft.snapshot.cycle?.reasons.find(reason => reason.key === 'unestimated_work');
    expect(reason).toMatchObject({ count: 2, countUnit: 'work_items', query: { estimateState: 'unestimated', workState: 'open', cycleId: f.cycleId } });
    const published = await reports.publishProjectStatusReport(f.projectId, { ...draft });
    const result = await new ProjectCycleCloseoutService(f.context).close(f.projectId, f.cycleId, { destinationCycleId: null });
    expect(result.closeout.snapshot.snapshotVersion).toBe(2);
    const frozen = structuredClone(result.closeout.snapshot);
    await db.update(schema.workItems).set({ title: 'Changed after capture', estimatePoints: 99 }).where(eq(schema.workItems.id, f.ids.stale));
    const replay = await new ProjectCycleCloseoutService(f.context).close(f.projectId, f.cycleId, { destinationCycleId: null });
    expect(replay.applied).toBe(false); expect(replay.closeout.snapshot).toEqual(frozen);
    expect((await reports.getProjectStatusReport(f.projectId, published.id)).snapshot).toEqual(draft.snapshot);
    const markdown = await request(f.app).get(`/api/projects/${f.projectId}/status-reports/${published.id}/export.md`).set(f.headers).expect(200);
    expect(markdown.text).toContain('work item');
  });
  it('publishes a valid v1 client draft, preserves stored v1 JSONB through migration, and replays v1 closeout unchanged', async () => {
    const f = await fixture();
    const snapshot: ProjectStatusReportSnapshotV1Dto = { ...structuredClone(goldenReportV1), project: { ...goldenReportV1.project, id: f.projectId, key: 'EST' } };
    const reports = new ProjectStatusReportService(f.context);
    const published = await reports.publishProjectStatusReport(f.projectId, { title: 'Old client draft', statusDate: '2026-07-07', summary: 'Frozen v1 publication', snapshot });
    expect(published.snapshot).toEqual(snapshot);
    const closeout = structuredClone(goldenCloseoutV1);
    closeout.project.id = f.projectId; closeout.cycle.id = f.cycleId;
    closeout.closedBy = { id: f.memberId, name: 'Estimate Owner' };
    closeout.destination.cycle!.id = f.destinationId;
    closeout.health.reasons[0]!.query!.cycleId = f.cycleId;
    await db.update(schema.projectCycles).set({ status: 'completed' }).where(eq(schema.projectCycles.id, f.cycleId));
    await f.context.repositories.projectCycleCloseouts.create({ id: randomUUID(), workspaceId: f.workspaceId, projectId: f.projectId,
      cycleId: f.cycleId, closedByMemberId: f.memberId, destinationCycleId: f.destinationId, snapshot: closeout,
      closedAt: new Date(closeout.closedAt), createdAt: new Date(closeout.closedAt) });
    const before = await pool.query('select snapshot::text from project_status_reports where id = $1', [published.id]);
    await migrate(db, { migrationsFolder: fileURLToPath(new URL('../drizzle', import.meta.url)) });
    expect((await pool.query('select snapshot::text from project_status_reports where id = $1', [published.id])).rows).toEqual(before.rows);
    expect((await reports.getProjectStatusReport(f.projectId, published.id)).snapshot).toEqual(snapshot);
    const replay = await new ProjectCycleCloseoutService(f.context).close(f.projectId, f.cycleId, { destinationCycleId: f.destinationId });
    expect(replay.applied).toBe(false); expect(replay.closeout.snapshot).toEqual(closeout);
    expect(replay.closeout.snapshot.snapshotVersion).toBe(1);
  });
});
