import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { createDb, createPool } from '../src/db/client.js';
import { ValidationError } from '../src/errors/app-error.js';
import { createRepositories } from '../src/repositories/index.js';
import { createPersistence, withTransactionScope, type Persistence, type PersistenceScope } from '../src/repositories/persistence.js';
import { WorkItemService } from '../src/services/work-item-service.js';
import { WorkItemRelationshipService } from '../src/services/work-item-relationship-service.js';
import { WorkItemCsvImportService } from '../src/services/work-item-csv-import-service.js';
import { ProjectCycleService } from '../src/services/project-cycle-service.js';
import { ProjectCycleCloseoutService } from '../src/services/project-cycle-closeout-service.js';
import { CommentService } from '../src/services/comment-service.js';
import { WorkItemWatcherService } from '../src/services/work-item-watcher-service.js';
import { AttachmentService } from '../src/services/attachment-service.js';
import { InMemoryAttachmentObjectStore } from '../src/storage/in-memory-attachment-object-store.js';
import { cleanupWorkspace } from './support/workspace-fixtures.js';

let pool: ReturnType<typeof createPool>;
let db: ReturnType<typeof createDb>;
let repositories: ReturnType<typeof createRepositories>;
const workspaceIds = new Set<string>();
const timestamp = new Date('2026-10-17T12:00:00Z');

async function fixture() {
  const workspaceId = randomUUID();
  workspaceIds.add(workspaceId);
  await repositories.workspaces.create({ id: workspaceId, name: 'Command races', createdAt: timestamp, updatedAt: timestamp });
  const owner = await repositories.members.create({ id: randomUUID(), workspaceId, name: 'Owner', email: 'owner@example.test',
    role: 'owner', isActive: true, createdAt: timestamp, updatedAt: timestamp });
  const member = await repositories.members.create({ id: randomUUID(), workspaceId, name: 'Contributor', email: 'member@example.test',
    role: 'contributor', isActive: true, createdAt: timestamp, updatedAt: timestamp });
  const projects = [];
  for (const key of ['CMD', 'OTHER']) projects.push(await repositories.projects.create({ id: randomUUID(), workspaceId,
    key, name: key, status: 'active', createdAt: timestamp, updatedAt: timestamp }));
  const actor = { workspaceId, memberId: owner.id, role: 'owner' as const };
  const persistence = createPersistence(db);
  const context = { actor, repositories, persistence, clock: () => timestamp };
  const service = new WorkItemService(context);
  const items = [];
  for (let index = 0; index < 4; index++) items.push(await service.createWorkItem(projects[index === 3 ? 1 : 0]!.id,
    { title: `Item ${index}`, type: 'task', priority: 'medium', status: 'ready', assigneeId: member.id }));
  return { context, actor, member, projects, project: projects[0]!, items, item: items[0]!, service };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;

// Observe a real PostgreSQL waiter before committing the first command, rather than guessing with sleeps.
async function queued(firstCommand: (scope: PersistenceScope) => Promise<unknown>, secondCommand: () => Promise<unknown>,
  afterWait?: (scope: PersistenceScope) => Promise<void>) {
  let release!: (operation?: (scope: PersistenceScope) => Promise<void>) => void;
  let ready!: (pid: number) => void;
  const gate = new Promise<((scope: PersistenceScope) => Promise<void>) | undefined>((resolve) => { release = resolve; });
  const locked = new Promise<number>((resolve) => { ready = resolve; });
  const first = db.transaction((tx) => withTransactionScope(tx, 'write', async (scope) => {
    await tx.execute(sql`set local lock_timeout = '2s'`);
    await tx.execute(sql`set local statement_timeout = '8s'`);
    const { rows } = await tx.execute(sql`select pg_backend_pid() as pid`);
    const result = await firstCommand(scope);
    ready(Number(rows[0]?.pid));
    const operation = await gate;
    await operation?.(scope);
    return result;
  }), { isolationLevel: 'read committed', accessMode: 'read write' });
  void first.catch(() => undefined);
  let second: Promise<unknown> | undefined;
  try {
    const pid = await Promise.race([locked, first.then(() => { throw new Error('First command ended before its barrier.'); })]);
    second = secondCommand();
    void second.catch(() => undefined);
    await vi.waitFor(async () => {
      const waiting = await pool.query(`select pid from pg_stat_activity where datname = current_database()
        and wait_event_type = 'Lock' and $1 = any(pg_blocking_pids(pid))`, [pid]);
      expect(waiting.rows.length).toBeGreaterThan(0);
    }, { timeout: 3_000, interval: 10 });
    release(afterWait);
  } finally {
    release();
    await Promise.allSettled([first, second]);
  }
  return Promise.allSettled([first, second!]);
}

async function holdBoard(f: Fixture, command: () => Promise<unknown>) {
  let release!: () => void;
  let ready!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const locked = new Promise<void>((resolve) => { ready = resolve; });
  const first = f.context.persistence.write(async (scope) => {
    await scope.locks.projects([{ workspaceId: f.actor.workspaceId, projectId: f.project.id, mode: 'shared' }]);
    await scope.locks.operation({ workspaceId: f.actor.workspaceId, resourceId: f.project.id, namespace: 'board' });
    ready();
    await gate;
  });
  void first.catch(() => undefined);
  let second: Promise<unknown> | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([locked, first.then(() => { throw new Error('Board holder ended early.'); })]);
    second = command();
    await Promise.race([second, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Independent edit waited on board coordination.')), 3_000);
    })]);
  } finally {
    clearTimeout(timer);
    release();
    await Promise.allSettled([first, second]);
  }
}

async function statusEvents(id: string) {
  return (await repositories.activityEvents.findByWorkItem(id)).filter(({ eventType }) => eventType === 'work_item.status_changed')
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}

describe('authoritative work command concurrency', () => {
  beforeAll(() => { pool = createPool(); db = createDb(pool); repositories = createRepositories(db); });
  afterEach(async () => { vi.restoreAllMocks(); for (const id of workspaceIds) await cleanupWorkspace(pool, id); workspaceIds.clear(); });
  afterAll(async () => { await pool.end(); });

  it.each(['status', 'board', 'bulk'] as const)('uses the committed previous status for a waiting %s command', async (kind) => {
    const f = await fixture();
    const later = new WorkItemService({ ...f.context, clock: () => new Date(timestamp.getTime() + 120_000) });
    const outcomes = await queued((scope) => new WorkItemService({ ...f.context, ...scope, clock: () => new Date(timestamp.getTime() + 60_000) })
      .transitionWorkItem(f.item.id, { status: 'in_progress' }),
    () => kind === 'status' ? later.transitionWorkItem(f.item.id, { status: 'blocked' })
      : kind === 'board' ? later.moveWorkItemOnBoard(f.item.id, { status: 'blocked' })
        : later.bulkUpdateWorkItems(f.project.id, { workItemIds: [f.item.id], action: { type: 'transition_status', status: 'blocked' } }));
    expect(outcomes.map(({ status }) => status)).toEqual(['fulfilled', 'fulfilled']);
    expect(await statusEvents(f.item.id)).toMatchObject([
      { previousValue: { status: 'ready' }, newValue: { status: 'in_progress' } },
      { previousValue: { status: 'in_progress' }, newValue: { status: 'blocked' } }
    ]);
    const notifications = await repositories.notifications.listByRecipient({ workspaceId: f.actor.workspaceId, recipientMemberId: f.member.id, state: 'all' });
    expect(notifications.filter(({ notificationType }) => notificationType === 'watched_status_change')).toHaveLength(2);
  });

  it('rejects a now-illegal queued transition without partial activity or notifications', async () => {
    const f = await fixture();
    const outcomes = await queued((scope) => new WorkItemService({ ...f.context, ...scope }).transitionWorkItem(f.item.id, { status: 'canceled' }),
      () => f.service.transitionWorkItem(f.item.id, { status: 'blocked' }));
    expect(outcomes[0].status).toBe('fulfilled');
    expect(outcomes[1]).toMatchObject({ status: 'rejected', reason: { code: 'WORKFLOW_TRANSITION_ERROR', details: { from: 'canceled', to: 'blocked' } } });
    expect(await statusEvents(f.item.id)).toHaveLength(1);
    expect((await repositories.workItems.findById(f.item.id))?.status).toBe('canceled');
  });

  it.each(['patch', 'bulk'] as const)('compares %s field changes with locked current values', async (kind) => {
    const f = await fixture();
    const outcomes = await queued((scope) => new WorkItemService({ ...f.context, ...scope }).updateWorkItem(f.item.id, { priority: 'high' }),
      () => kind === 'patch' ? f.service.updateWorkItem(f.item.id, { priority: 'urgent' })
        : f.service.bulkUpdateWorkItems(f.project.id, { workItemIds: [f.item.id], action: { type: 'set_priority', priority: 'urgent' } }));
    expect(outcomes.map(({ status }) => status)).toEqual(['fulfilled', 'fulfilled']);
    const events = (await repositories.activityEvents.findByWorkItem(f.item.id)).filter(({ eventType }) => eventType === 'work_item.priority_changed');
    expect(events).toHaveLength(2);
    expect(events).toEqual(expect.arrayContaining([expect.objectContaining({ previousValue: { priority: 'high' }, newValue: { priority: 'urgent' } })]));
  });

  it('preserves timestamps and evidence for identical status and board commands', async () => {
    const f = await fixture();
    const before = await repositories.workItems.findById(f.item.id);
    const column = await repositories.workItems.listByProjectAndStatusForBoard(f.project.id, 'ready');
    const index = column.findIndex(({ id }) => id === f.item.id);
    const later = new WorkItemService({ ...f.context, clock: () => new Date(timestamp.getTime() + 60_000) });
    await later.transitionWorkItem(f.item.id, { status: 'ready' });
    await later.moveWorkItemOnBoard(f.item.id, { status: 'ready', beforeWorkItemId: column[index - 1]?.id ?? null, afterWorkItemId: column[index + 1]?.id ?? null });
    expect(await repositories.workItems.findById(f.item.id)).toEqual(before);
    expect(await statusEvents(f.item.id)).toEqual([]);
  });

  it('does not serialize description-only edits behind the board key', async () => {
    const f = await fixture();
    await holdBoard(f, () => f.service.updateWorkItem(f.item.id, { description: 'Independent authored source', descriptionFormat: 'markdown_v1' }));
    expect((await repositories.workItems.findById(f.item.id))?.description).toBe('Independent authored source');
  });

  it('locks the complete compaction set in ID order before the moving row', async () => {
    const f = await fixture();
    const [low, middle, moving] = f.items.slice(0, 3).sort((a, b) => a.id < b.id ? -1 : 1);
    await repositories.workItems.update(low!.id, { boardPosition: 1, updatedAt: timestamp });
    await repositories.workItems.update(middle!.id, { boardPosition: 2, updatedAt: timestamp });
    await repositories.workItems.update(moving!.id, { status: 'backlog', updatedAt: timestamp });
    const outcomes = await queued((scope) => new WorkItemService({ ...f.context, ...scope }).updateWorkItem(low!.id, { description: 'Holding the first row' }),
      () => f.service.moveWorkItemOnBoard(moving!.id, { status: 'ready', beforeWorkItemId: low!.id, afterWorkItemId: middle!.id }),
      async (scope) => { await scope.repositories.workItems.findManyByIdsForUpdate([moving!.id]); });
    expect(outcomes.map(({ status }) => status)).toEqual(['fulfilled', 'fulfilled']);
    expect((await repositories.workItems.listByProjectAndStatusForBoard(f.project.id, 'ready')).map(({ id }) => id))
      .toEqual([low!.id, moving!.id, middle!.id]);
  });

  it('revalidates stale neighbors after a competing board insertion', async () => {
    const f = await fixture();
    const column = await repositories.workItems.listByProjectAndStatusForBoard(f.project.id, 'ready');
    const [before, after, moving] = column;
    const outcomes = await queued((scope) => new WorkItemService({ ...f.context, ...scope }).createWorkItem(f.project.id,
      { title: 'New top', type: 'task', priority: 'medium', status: 'ready' }),
    () => f.service.moveWorkItemOnBoard(moving!.id, { status: 'ready', afterWorkItemId: before!.id }));
    expect(outcomes[0].status).toBe('fulfilled');
    expect(outcomes[1]).toMatchObject({ status: 'rejected', reason: { code: 'VALIDATION_ERROR' } });
    expect((await repositories.workItems.listByProjectAndStatusForBoard(f.project.id, 'ready')).map(({ id }) => id).slice(1))
      .toEqual([before!.id, after!.id, moving!.id]);
  });

  it('compacts a complete column beyond the interactive page maximum without touching timestamps', async () => {
    const f = await fixture();
    const rows = [];
    for (let index = 0; index < 102; index++) rows.push(await repositories.workItems.create({
      id: randomUUID(), workspaceId: f.actor.workspaceId, projectId: f.project.id, itemNumber: index + 10,
      displayKey: `CMD-${index + 10}`, title: `Dense ${index}`, type: 'task', status: 'blocked', priority: 'medium',
      reporterId: f.actor.memberId, boardPosition: index + 1, createdAt: timestamp, updatedAt: timestamp
    }));
    const later = new WorkItemService({ ...f.context, clock: () => new Date(timestamp.getTime() + 60_000) });
    await later.moveWorkItemOnBoard(f.item.id, { status: 'blocked', beforeWorkItemId: rows[100]!.id, afterWorkItemId: rows[101]!.id });
    const complete = await repositories.workItems.listByProjectAndStatusForBoard(f.project.id, 'blocked');
    expect(complete).toHaveLength(103);
    expect(complete.slice(-3).map(({ id }) => id)).toEqual([rows[100]!.id, f.item.id, rows[101]!.id]);
    expect(new Set(complete.map(({ boardPosition }) => boardPosition)).size).toBe(103);
    expect(complete.filter(({ id }) => id !== f.item.id).every(({ updatedAt }) => updatedAt.getTime() === timestamp.getTime())).toBe(true);
  });

  it.each(['create_first', 'parent_first'] as const)('preserves two levels under child creation versus parent assignment (%s)', async (order) => {
    const f = await fixture();
    const parent = f.items[1]!, root = f.items[2]!;
    const outcomes = await queued((scope) => order === 'create_first'
      ? new WorkItemService({ ...f.context, ...scope }).createWorkItem(f.project.id, { title: 'Child', type: 'bug', priority: 'medium', parentWorkItemId: parent.id })
      : new WorkItemService({ ...f.context, ...scope }).setParent(parent.id, { parentWorkItemId: root.id }),
    () => order === 'create_first' ? f.service.setParent(parent.id, { parentWorkItemId: root.id })
      : f.service.createWorkItem(f.project.id, { title: 'Rejected child', type: 'chore', priority: 'medium', parentWorkItemId: parent.id }));
    expect(outcomes[0].status).toBe('fulfilled');
    expect(outcomes[1]).toMatchObject({ status: 'rejected', reason: { code: 'CONFLICT' } });
    expect((await repositories.projects.findById(f.project.id))?.nextWorkItemNumber).toBe(order === 'create_first' ? 5 : 4);
  });

  it('rejects opposing parent assignments and retains a valid two-level hierarchy', async () => {
    const f = await fixture();
    const other = f.items[1]!;
    const outcomes = await queued((scope) => new WorkItemService({ ...f.context, ...scope }).setParent(f.item.id, { parentWorkItemId: other.id }),
      () => f.service.setParent(other.id, { parentWorkItemId: f.item.id }));
    expect(outcomes[1]).toMatchObject({ status: 'rejected', reason: { code: 'CONFLICT' } });
    expect((await repositories.workItems.findById(other.id))?.parentWorkItemId).toBeNull();
  });

  it('coordinates type edits with child creation without inventing parent type restrictions', async () => {
    const f = await fixture();
    const outcomes = await queued((scope) => new WorkItemService({ ...f.context, ...scope }).updateWorkItem(f.item.id, { type: 'bug' }),
      () => f.service.createWorkItem(f.project.id, { title: 'Child of a bug', type: 'story', priority: 'medium', parentWorkItemId: f.item.id }));
    expect(outcomes.map(({ status }) => status)).toEqual(['fulfilled', 'fulfilled']);
    expect((await f.service.getWorkItem(f.item.id)).childSummary?.totalCount).toBe(1);
  });

  it('allocates the counter before locking a parent and plans import locks before its row loop', async () => {
    const f = await fixture();
    const order: string[] = [];
    const persistence: Persistence = { ...f.context.persistence, write: (callback) => f.context.persistence.write((scope) => {
      const operation = scope.locks.operation.bind(scope.locks);
      vi.spyOn(scope.locks, 'operation').mockImplementation(async (request) => { order.push(request.namespace); await operation(request); });
      const allocate = scope.repositories.projects.allocateWorkItemNumber.bind(scope.repositories.projects);
      vi.spyOn(scope.repositories.projects, 'allocateWorkItemNumber').mockImplementation(async (...args) => { order.push('counter'); return allocate(...args); });
      const lock = scope.repositories.workItems.findManyByIdsForUpdate.bind(scope.repositories.workItems);
      vi.spyOn(scope.repositories.workItems, 'findManyByIdsForUpdate').mockImplementation(async (ids) => { order.push('work'); return lock(ids); });
      const insert = scope.repositories.workItems.create.bind(scope.repositories.workItems);
      vi.spyOn(scope.repositories.workItems, 'create').mockImplementation(async (input) => { order.push('insert'); return insert(input); });
      return callback(scope);
    }) };
    await new WorkItemService({ ...f.context, persistence }).createWorkItem(f.project.id,
      { title: 'Child', type: 'story', priority: 'medium', parentWorkItemId: f.item.id });
    expect(order.indexOf('hierarchy')).toBeLessThan(order.indexOf('counter'));
    expect(order.indexOf('board')).toBeLessThan(order.indexOf('counter'));
    expect(order.indexOf('counter')).toBeLessThan(order.indexOf('work'));
    order.length = 0;
    await new WorkItemCsvImportService({ ...f.context, persistence }).apply(f.project.id, 'title,type,priority\nOne,task,medium\nTwo,bug,high');
    expect(order.slice(0, 2)).toEqual(['hierarchy', 'board']);
    expect(order.filter((entry) => entry === 'insert')).toHaveLength(2);
  });

  it('serializes import and child creation without counter/parent inversions', async () => {
    const f = await fixture();
    const outcomes = await queued((scope) => new WorkItemCsvImportService({ ...f.context, ...scope })
      .apply(f.project.id, 'title,type,priority\nImported one,task,medium\nImported two,bug,high'),
    () => f.service.createWorkItem(f.project.id, { title: 'Child after import', type: 'chore', priority: 'medium', parentWorkItemId: f.item.id }));
    expect(outcomes.map(({ status }) => status)).toEqual(['fulfilled', 'fulfilled']);
    const rows = await repositories.workItems.listByProject(f.project.id);
    expect(new Set(rows.map(({ itemNumber }) => itemNumber)).size).toBe(6);
    expect((await repositories.projects.findById(f.project.id))?.nextWorkItemNumber).toBe(7);
  });

  it('returns a controlled conflict when the cycle lock set changed while waiting', async () => {
    const f = await fixture();
    const cycles = new ProjectCycleService(f.context);
    const a = await cycles.createProjectCycle(f.project.id, { name: 'A', startDate: '2026-10-01', endDate: '2026-10-07' });
    const b = await cycles.createProjectCycle(f.project.id, { name: 'B', startDate: '2026-10-08', endDate: '2026-10-14' });
    await f.service.updateWorkItem(f.item.id, { cycleId: a.id });
    const outcomes = await queued((scope) => new WorkItemService({ ...f.context, ...scope }).updateWorkItem(f.item.id, { cycleId: b.id }),
      () => f.service.updateWorkItem(f.item.id, { cycleId: null }));
    expect(outcomes[1]).toMatchObject({ status: 'rejected', reason: { code: 'CONFLICT' } });
    expect((await repositories.workItems.findById(f.item.id))?.cycleId).toBe(b.id);
  });

  it('coordinates equivalent uppercase project IDs before concurrent cycle creation', async () => {
    const f = await fixture();
    const outcomes = await queued((scope) => new ProjectCycleService({ ...f.context, ...scope }).createProjectCycle(f.project.id.toUpperCase(),
      { name: 'First', startDate: '2026-10-01', endDate: '2026-10-07' }),
    () => new ProjectCycleService(f.context).createProjectCycle(f.project.id,
      { name: 'Overlap', startDate: '2026-10-07', endDate: '2026-10-14' }));
    expect(outcomes[0].status).toBe('fulfilled');
    expect(outcomes[1]).toMatchObject({ status: 'rejected', reason: { code: 'CONFLICT' } });
  });

  it('retains uppercase work-item UUID support across PATCH, status, and board commands', async () => {
    const f = await fixture();
    const id = f.item.id.toUpperCase();
    expect((await f.service.updateWorkItem(id, { title: 'Canonical identity' })).id).toBe(f.item.id);
    expect((await f.service.transitionWorkItem(id, { status: 'in_progress' })).status).toBe('in_progress');
    expect((await f.service.moveWorkItemOnBoard(id, { status: 'blocked' })).status).toBe('blocked');
  });

  it('preserves self-link validation when both endpoints use different UUID casing', async () => {
    const f = await fixture();
    await expect(new WorkItemRelationshipService(f.context).createRelationship(f.item.id,
      { targetWorkItemId: f.item.id.toUpperCase(), relationshipType: 'blocks' }))
      .rejects.toMatchObject({ code: 'VALIDATION_ERROR', message: 'Cannot relate a work item to itself.' });
    expect(await repositories.workItemRelationships.listForWorkItem(f.item.id)).toEqual([]);
  });

  it('rolls back a failed bulk item before continuing with another explicit ID', async () => {
    const f = await fixture();
    const persistence: Persistence = { ...f.context.persistence, write: (callback) => f.context.persistence.write((scope) => {
      const create = scope.repositories.activityEvents.create.bind(scope.repositories.activityEvents);
      vi.spyOn(scope.repositories.activityEvents, 'create').mockImplementation(async (input) => {
        if (input.workItemId === f.item.id && input.eventType === 'work_item.priority_changed') throw new ValidationError('Injected evidence failure');
        return create(input);
      });
      return callback(scope);
    }) };
    const result = await new WorkItemService({ ...f.context, persistence }).bulkUpdateWorkItems(f.project.id,
      { workItemIds: [f.item.id, f.items[1]!.id], action: { type: 'set_priority', priority: 'high' } });
    expect(result).toMatchObject({ succeededCount: 1, failedCount: 1, results: [
      { status: 'failed', displayKey: f.item.displayKey, error: { code: 'VALIDATION_ERROR' } }, { status: 'updated' }
    ] });
    expect((await repositories.workItems.findById(f.item.id))?.priority).toBe('medium');
    expect((await repositories.workItems.findById(f.items[1]!.id))?.priority).toBe('high');
    expect((await repositories.activityEvents.findByWorkItem(f.item.id)).filter(({ eventType }) => eventType === 'work_item.priority_changed')).toEqual([]);
  });

  it.each(['opposing', 'disjoint_cycle', 'duplicate'] as const)('serializes dependency reachability and duplicate checks (%s)', async (kind) => {
    const f = await fixture();
    const [a, b, c, d] = f.items;
    const relationship = new WorkItemRelationshipService(f.context);
    if (kind === 'disjoint_cycle') {
      await relationship.createRelationship(b!.id, { targetWorkItemId: c!.id, relationshipType: 'blocks' });
      await relationship.createRelationship(d!.id, { targetWorkItemId: a!.id, relationshipType: 'blocks' });
    }
    const outcomes = await queued((scope) => new WorkItemRelationshipService({ ...f.context, ...scope })
      .createRelationship(a!.id, { targetWorkItemId: b!.id, relationshipType: 'blocks' }),
    () => relationship.createRelationship(kind === 'disjoint_cycle' ? c!.id : kind === 'duplicate' ? a!.id : b!.id,
      { targetWorkItemId: kind === 'disjoint_cycle' ? d!.id : kind === 'duplicate' ? b!.id : a!.id, relationshipType: 'blocks' }));
    expect(outcomes[0].status).toBe('fulfilled');
    expect(outcomes[1]).toMatchObject({ status: 'rejected', reason: { code: kind === 'duplicate' ? 'CONFLICT' : 'VALIDATION_ERROR' } });
    expect((await repositories.workItemRelationships.listForWorkItem(a!.id)).filter(({ relationshipType }) => relationshipType === 'blocks'))
      .toHaveLength(kind === 'disjoint_cycle' ? 2 : 1);
  });

  it('rereads contributor permission after an endpoint is reassigned while a relationship waits', async () => {
    const f = await fixture();
    const contributor = { ...f.context, actor: { workspaceId: f.actor.workspaceId, memberId: f.member.id, role: 'contributor' as const } };
    const outcomes = await queued((scope) => new WorkItemService({ ...f.context, ...scope }).updateWorkItem(f.item.id, { assigneeId: null }),
      () => new WorkItemRelationshipService(contributor).createRelationship(f.item.id, { targetWorkItemId: f.items[3]!.id, relationshipType: 'relates_to' }));
    expect(outcomes[1]).toMatchObject({ status: 'rejected', reason: { code: 'FORBIDDEN' } });
    expect(await repositories.workItemRelationships.listForWorkItem(f.item.id)).toEqual([]);
  });

  it('serializes relationship removal with another removal and emits evidence once', async () => {
    const f = await fixture();
    const relation = await new WorkItemRelationshipService(f.context).createRelationship(f.item.id,
      { targetWorkItemId: f.items[3]!.id, relationshipType: 'relates_to' });
    const outcomes = await queued((scope) => new WorkItemRelationshipService({ ...f.context, ...scope }).deleteRelationship(f.item.id, relation.id),
      () => new WorkItemRelationshipService(f.context).deleteRelationship(f.item.id, relation.id));
    expect(outcomes[0].status).toBe('fulfilled');
    expect(outcomes[1]).toMatchObject({ status: 'rejected', reason: { code: 'NOT_FOUND' } });
    expect((await repositories.activityEvents.findByWorkItem(f.item.id)).filter(({ eventType }) => eventType === 'work_item.relationship_removed')).toHaveLength(1);
  });

  it.each(['comment_edit', 'comment_delete', 'attachment_upload', 'attachment_remove'] as const)('keeps work-row-first ordering for %s alongside PATCH', async (kind) => {
    const f = await fixture();
    const comment = await new CommentService(f.context).addComment(f.item.id, { body: 'Comment' });
    const attachments = new AttachmentService({ ...f.context, objectStore: new InMemoryAttachmentObjectStore() });
    const file = kind === 'attachment_remove' ? await attachments.upload(f.actor, f.item.id,
      { fileName: 'remove.txt', declaredMediaType: 'text/plain', bytes: Buffer.from('Remove') }) : null;
    const outcomes = await queued((scope) => new WorkItemService({ ...f.context, ...scope }).updateWorkItem(f.item.id, { title: 'Current work title' }),
      () => kind === 'comment_edit' ? new CommentService(f.context).updateComment(comment.id, { body: 'Edited' })
        : kind === 'comment_delete' ? new CommentService(f.context).deleteComment(comment.id)
          : kind === 'attachment_remove' ? attachments.remove(f.actor, file!.id)
            : attachments.upload(f.actor, f.item.id,
            { fileName: 'proof.txt', declaredMediaType: 'text/plain', bytes: Buffer.from('Proof') }));
    expect(outcomes.map(({ status }) => status)).toEqual(['fulfilled', 'fulfilled']);
    expect((await repositories.workItems.findById(f.item.id))?.title).toBe('Current work title');
  });

  it('retains immutable closeout replay across queued bulk status changes', async () => {
    const f = await fixture();
    const cycle = await new ProjectCycleService(f.context).createProjectCycle(f.project.id,
      { name: 'Active', status: 'active', startDate: '2026-10-01', endDate: '2026-10-07' });
    await f.service.updateWorkItem(f.item.id, { cycleId: cycle.id });
    const outcomes = await queued((scope) => new ProjectCycleCloseoutService({ ...f.context, ...scope }).close(f.project.id, cycle.id, { destinationCycleId: null }),
      () => f.service.bulkUpdateWorkItems(f.project.id, { workItemIds: [f.item.id], action: { type: 'transition_status', status: 'in_progress' } }));
    expect(outcomes.map(({ status }) => status)).toEqual(['fulfilled', 'fulfilled']);
    const record = await repositories.projectCycleCloseouts.findByCycleId(cycle.id);
    expect((await new ProjectCycleCloseoutService(f.context).close(f.project.id, cycle.id, { destinationCycleId: null })).applied).toBe(false);
    expect(await repositories.projectCycleCloseouts.findByCycleId(cycle.id)).toEqual(record);
  });

  it('locks work before explicit watch writes and serializes them with automatic watchers', async () => {
    const f = await fixture();
    const member = await repositories.members.create({ id: randomUUID(), workspaceId: f.actor.workspaceId, name: 'New watcher',
      email: 'watcher@example.test', role: 'contributor', isActive: true, createdAt: timestamp, updatedAt: timestamp });
    const context = { ...f.context, actor: { ...f.actor, memberId: member.id, role: 'contributor' as const } };
    const order: string[] = [];
    const outcomes = await queued(async (scope) => {
      const lock = scope.repositories.workItems.findManyByIdsForUpdate.bind(scope.repositories.workItems);
      vi.spyOn(scope.repositories.workItems, 'findManyByIdsForUpdate').mockImplementation(async (ids) => { order.push('work'); return lock(ids); });
      const watch = scope.repositories.workItemWatchers.watch.bind(scope.repositories.workItemWatchers);
      vi.spyOn(scope.repositories.workItemWatchers, 'watch').mockImplementation(async (input) => { order.push('watch'); return watch(input); });
      return new WorkItemWatcherService({ ...context, ...scope }).watch(f.item.id);
    }, () => f.service.updateWorkItem(f.item.id, { assigneeId: member.id }));
    expect(outcomes.map(({ status }) => status)).toEqual(['fulfilled', 'fulfilled']);
    expect(order.slice(0, 2)).toEqual(['work', 'watch']);
    expect((await repositories.workItemWatchers.listActiveMemberIdsByWorkItem(f.item.id)).filter((id) => id === member.id)).toHaveLength(1);
  });
});
