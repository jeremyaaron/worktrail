import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { sql } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { createDb, createPool } from '../src/db/client.js';
import { createRepositories } from '../src/repositories/index.js';
import { createPersistence, withTransactionScope, type Persistence, type PersistenceScope } from '../src/repositories/persistence.js';
import { AttachmentService } from '../src/services/attachment-service.js';
import { CommentService } from '../src/services/comment-service.js';
import { LabelService } from '../src/services/label-service.js';
import { MilestoneService } from '../src/services/milestone-service.js';
import { NotificationService } from '../src/services/notification-service.js';
import { ProjectService } from '../src/services/project-service.js';
import { ProjectCycleService } from '../src/services/project-cycle-service.js';
import { ProjectCycleCloseoutService } from '../src/services/project-cycle-closeout-service.js';
import { ProjectStatusReportService } from '../src/services/project-status-report-service.js';
import { SavedWorkViewService } from '../src/services/saved-work-view-service.js';
import { WorkItemService } from '../src/services/work-item-service.js';
import { WorkItemCsvImportService } from '../src/services/work-item-csv-import-service.js';
import { WorkItemRelationshipService } from '../src/services/work-item-relationship-service.js';
import { WorkItemWatcherService } from '../src/services/work-item-watcher-service.js';
import type { AttachmentObjectStore } from '../src/storage/attachment-object-store.js';
import { cleanupWorkspace } from './support/workspace-fixtures.js';

let pool: ReturnType<typeof createPool>;
let db: ReturnType<typeof createDb>;
let repositories: ReturnType<typeof createRepositories>;
const workspaceIds = new Set<string>();
const timestamp = new Date('2026-10-17T12:00:00Z');

async function fixture() {
  const workspaceId = randomUUID();
  workspaceIds.add(workspaceId);
  await repositories.workspaces.create({ id: workspaceId, name: 'Project coordination', createdAt: timestamp, updatedAt: timestamp });
  const member = await repositories.members.create({ id: randomUUID(), workspaceId, name: 'Owner', email: 'owner@example.test',
    role: 'owner', isActive: true, createdAt: timestamp, updatedAt: timestamp });
  const projects = [];
  for (const key of ['GATE', 'OTHER']) projects.push(await repositories.projects.create({
    id: randomUUID(), workspaceId, key, name: key, status: 'active', createdAt: timestamp, updatedAt: timestamp
  }));
  const project = projects[0]!;
  const actor = { workspaceId, memberId: member.id, role: 'owner' as const };
  const context = { actor, repositories, persistence: createPersistence(db), clock: () => timestamp };
  const source = await repositories.projectCycles.create({ id: randomUUID(), workspaceId, projectId: project.id,
    name: 'Active', status: 'active', startDate: '2026-10-01', endDate: '2026-10-07', createdAt: timestamp, updatedAt: timestamp });
  const destination = await repositories.projectCycles.create({ id: randomUUID(), workspaceId, projectId: project.id,
    name: 'Next', status: 'planned', startDate: '2026-10-08', endDate: '2026-10-14', createdAt: timestamp, updatedAt: timestamp });
  const label = await repositories.labels.create({ id: randomUUID(), workspaceId, projectId: project.id, name: 'Label', color: '#117744',
    createdAt: timestamp, updatedAt: timestamp });
  const milestone = await repositories.milestones.create({ id: randomUUID(), workspaceId, projectId: project.id, name: 'Milestone',
    status: 'planned', createdAt: timestamp, updatedAt: timestamp });
  const work = new WorkItemService(context);
  const item = await work.createWorkItem(project.id, { title: 'Task', type: 'task', priority: 'medium', status: 'ready', cycleId: source.id });
  const parent = await work.createWorkItem(project.id, { title: 'Parent', type: 'story', priority: 'medium' });
  const other = await work.createWorkItem(projects[1]!.id, { title: 'Other project task', type: 'task', priority: 'medium' });
  const relationship = await repositories.workItemRelationships.create({ id: randomUUID(), workspaceId, relationshipType: 'relates_to',
    sourceWorkItemId: item.id, targetWorkItemId: other.id, createdById: member.id, createdAt: timestamp });
  const comment = await repositories.comments.create({ id: randomUUID(), workspaceId, projectId: project.id, workItemId: item.id,
    authorId: member.id, body: 'Original', createdAt: timestamp, updatedAt: timestamp });
  const view = await new SavedWorkViewService(context).createSavedView({ name: 'Personal', scope: 'project', projectId: project.id, query: {} });
  const objects = new Map<string, Uint8Array>();
  const objectStore: AttachmentObjectStore = {
    initialize: async () => undefined,
    put: async (key, bytes) => { objects.set(key, bytes); },
    get: async (key) => objects.get(key) ?? null,
    remove: async (key) => objects.delete(key) ? 'removed' : 'missing'
  };
  const bytes = Buffer.from('Owned test file');
  const attachment = await repositories.workItemAttachments.create({ id: randomUUID(), workspaceId, projectId: project.id, workItemId: item.id,
    uploaderMemberId: member.id, fileName: 'test.txt', mediaType: 'text/plain', byteSize: bytes.length,
    checksumSha256: createHash('sha256').update(bytes).digest('hex'), storageKey: 'a'.repeat(64), createdAt: timestamp });
  objects.set(attachment!.storageKey, bytes);
  return { context, actor, project, projects, source, destination, item, parent, other, label, milestone,
    relationship, comment, view, objectStore, attachment: attachment! };
}

type Fixture = Awaited<ReturnType<typeof fixture>>;

// The first operation has persisted but not committed. Release only after observing a real advisory wait.
async function queued<T, U>(firstCommand: (scope: PersistenceScope) => Promise<T>, secondCommand: () => Promise<U>) {
  let release!: () => void;
  let ready!: (pid: number) => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const locked = new Promise<number>((resolve) => { ready = resolve; });
  const first = db.transaction((tx) => withTransactionScope(tx, 'write', async (scope) => {
    await tx.execute(sql`set local lock_timeout = '4s'`);
    await tx.execute(sql`set local statement_timeout = '8s'`);
    const { rows } = await tx.execute(sql`select pg_backend_pid() as pid`);
    const result = await firstCommand(scope);
    ready(Number(rows[0]?.pid));
    await gate;
    return result;
  }), { isolationLevel: 'read committed', accessMode: 'read write' });
  void first.catch(() => undefined);
  let second: Promise<U> | undefined;
  try {
    const pid = await Promise.race([locked, first.then(() => { throw new Error('First writer ended before the gate.'); })]);
    second = secondCommand();
    void second.catch(() => undefined);
    await vi.waitFor(async () => {
      const waiting = await pool.query(`select pid from pg_stat_activity where datname = current_database()
        and wait_event_type = 'Lock' and wait_event = 'advisory' and $1 = any(pg_blocking_pids(pid))`, [pid]);
      expect(waiting.rows.length).toBeGreaterThan(0);
    }, { timeout: 3_000, interval: 10 });
  } finally {
    release();
    await Promise.allSettled([first, second]);
  }
  return Promise.allSettled([first, second!]);
}

async function barrier(scope: PersistenceScope, f: Fixture, mode: 'shared' | 'exclusive', projectId = f.project.id) {
  await scope.locks.projects([{ workspaceId: f.actor.workspaceId, projectId, mode }]);
}

// Keep one connection open while proving another command completes before its lock is released.
async function whileHeld(f: Fixture, mode: 'shared' | 'exclusive', command: () => Promise<unknown>) {
  let release!: () => void;
  let ready!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const locked = new Promise<void>((resolve) => { ready = resolve; });
  const first = db.transaction((tx) => withTransactionScope(tx, 'write', async (scope) => {
    await barrier(scope, f, mode);
    ready();
    await gate;
  }));
  void first.catch(() => undefined);
  let second: Promise<unknown> | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([locked, first.then(() => { throw new Error('Lock holder ended early.'); })]);
    second = command();
    await Promise.race([second, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Independent command waited on the held project gate.')), 3_000);
    })]);
  } finally {
    clearTimeout(timer);
    release();
    await Promise.allSettled([first, second]);
  }
}

const participants = [
  ['project.update', 'exclusive'], ['project.archive', 'exclusive'], ['project.reactivate', 'exclusive'],
  ['cycle.create', 'exclusive'], ['cycle.update', 'exclusive'], ['cycle.archive', 'exclusive'], ['cycle.reactivate', 'exclusive'], ['cycle.closeout', 'exclusive'],
  ['label.create', 'exclusive'], ['label.update', 'exclusive'], ['label.archive', 'exclusive'], ['label.reactivate', 'exclusive'],
  ['milestone.create', 'exclusive'], ['milestone.update', 'exclusive'], ['milestone.archive', 'exclusive'], ['milestone.reactivate', 'exclusive'],
  ['work.create', 'shared'], ['work.patch', 'shared'], ['work.status', 'shared'], ['work.board', 'shared'], ['work.parent', 'shared'],
  ['work.bulk', 'shared'], ['work.import', 'shared'], ['relationship.create', 'shared'], ['relationship.delete', 'shared'],
  ['comment.create', 'shared'], ['comment.update', 'shared'], ['comment.delete', 'shared'], ['attachment.upload', 'shared'], ['attachment.remove', 'shared'],
  ['watch', 'shared'], ['unwatch', 'shared'], ['report.publish', 'shared'],
  ['view.create', 'shared'], ['view.rename', 'shared'], ['view.query', 'shared'], ['view.pin', 'shared'], ['view.delete', 'shared']
] as const;
type Participant = typeof participants[number][0];

async function execute(name: Participant, f: Fixture): Promise<unknown> {
  const project = new ProjectService(f.context), cycles = new ProjectCycleService(f.context);
  const labels = new LabelService(f.context), milestones = new MilestoneService(f.context);
  const work = new WorkItemService(f.context), comments = new CommentService(f.context);
  const relationships = new WorkItemRelationshipService(f.context), views = new SavedWorkViewService(f.context);
  const attachments = new AttachmentService({ ...f.context, objectStore: f.objectStore });
  switch (name) {
    case 'project.update': return project.updateProject(f.project.id, { name: 'New name' });
    case 'project.archive': return project.archiveProject(f.project.id);
    case 'project.reactivate': return project.reactivateProject(f.project.id);
    case 'cycle.create': return cycles.createProjectCycle(f.project.id, { name: 'Later', startDate: '2026-11-01', endDate: '2026-11-07' });
    case 'cycle.update': return cycles.updateProjectCycle(f.project.id, f.source.id, { goal: 'New goal' });
    case 'cycle.archive': return cycles.archiveProjectCycle(f.project.id, f.source.id);
    case 'cycle.reactivate': return cycles.reactivateProjectCycle(f.project.id, f.source.id);
    case 'cycle.closeout': return new ProjectCycleCloseoutService(f.context).close(f.project.id, f.source.id, { destinationCycleId: f.destination.id });
    case 'label.create': return labels.createLabel(f.project.id, { name: 'New label' });
    case 'label.update': return labels.updateLabel(f.label.id, { name: 'New label' });
    case 'label.archive': return labels.archiveLabel(f.label.id);
    case 'label.reactivate': return labels.reactivateLabel(f.label.id);
    case 'milestone.create': return milestones.createMilestone(f.project.id, { name: 'New milestone' });
    case 'milestone.update': return milestones.updateMilestone(f.milestone.id, { name: 'New milestone' });
    case 'milestone.archive': return milestones.archiveMilestone(f.milestone.id);
    case 'milestone.reactivate': return milestones.reactivateMilestone(f.milestone.id);
    case 'work.create': return work.createWorkItem(f.project.id, { title: 'Created', type: 'task', priority: 'medium' });
    case 'work.patch': return work.updateWorkItem(f.item.id, { description: 'Edited' });
    case 'work.status': return work.transitionWorkItem(f.item.id, { status: 'in_progress' });
    case 'work.board': return work.moveWorkItemOnBoard(f.item.id, { status: 'in_progress' });
    case 'work.parent': return work.setParent(f.item.id, { parentWorkItemId: f.parent.id });
    case 'work.bulk': return work.bulkUpdateWorkItems(f.project.id, { workItemIds: [f.item.id], action: { type: 'set_priority', priority: 'high' } });
    case 'work.import': return new WorkItemCsvImportService(f.context).apply(f.project.id, 'title,type,priority\nImported,task,medium');
    case 'relationship.create': return relationships.createRelationship(f.item.id, { targetWorkItemId: f.other.id, relationshipType: 'blocks' });
    case 'relationship.delete': return relationships.deleteRelationship(f.item.id, f.relationship.id);
    case 'comment.create': return comments.addComment(f.item.id, { body: 'New comment' });
    case 'comment.update': return comments.updateComment(f.comment.id, { body: 'Changed' });
    case 'comment.delete': return comments.deleteComment(f.comment.id);
    case 'attachment.upload': return attachments.upload(f.actor, f.item.id, { fileName: 'new.txt', declaredMediaType: 'text/plain', bytes: Buffer.from('New file') });
    case 'attachment.remove': return attachments.remove(f.actor, f.attachment.id);
    case 'watch': return new WorkItemWatcherService(f.context).watch(f.item.id);
    case 'unwatch': return new WorkItemWatcherService(f.context).unwatch(f.item.id);
    case 'report.publish': return new ProjectStatusReportService(f.context).publishProjectStatusReport(f.project.id, { title: 'Report', statusDate: '2026-10-17', summary: 'Summary' });
    case 'view.create': return views.createSavedView({ name: 'New view', scope: 'project', projectId: f.project.id, query: {} });
    case 'view.rename': return views.updateSavedView(f.view.id, { name: 'Renamed' });
    case 'view.query': return views.updateSavedView(f.view.id, { query: { status: 'ready' } });
    case 'view.pin': return views.updateSavedView(f.view.id, { isPinned: true });
    case 'view.delete': return views.deleteSavedView(f.view.id);
  }
}

describe('project coordination participation and lifecycle', () => {
  beforeAll(() => { pool = createPool(); db = createDb(pool); repositories = createRepositories(db); });
  afterEach(async () => { vi.restoreAllMocks(); for (const id of workspaceIds) await cleanupWorkspace(pool, id); workspaceIds.clear(); });
  afterAll(async () => { await pool.end(); });

  it.each(participants)('%s acquires %s project coordination before proceeding', async (name, mode) => {
    const f = await fixture();
    if (name === 'project.reactivate') await repositories.projects.updateStatus(f.project.id, 'archived', timestamp);
    if (name === 'cycle.reactivate') await repositories.projectCycles.archive(f.source.id, timestamp, f.actor.memberId);
    if (name === 'label.reactivate') await repositories.labels.archive(f.label.id, timestamp, f.actor.memberId);
    if (name === 'milestone.reactivate') await repositories.milestones.archive(f.milestone.id, timestamp, f.actor.memberId);
    const outcomes = await queued((scope) => barrier(scope, f, mode === 'shared' ? 'exclusive' : 'shared'), () => execute(name, f));
    expect(outcomes.map((outcome) => outcome.status)).toEqual(['fulfilled', 'fulfilled']);
  });

  it.each(['relationship.create', 'relationship.delete'] as const)('%s also coordinates the other project', async (name) => {
    const f = await fixture();
    const outcomes = await queued((scope) => barrier(scope, f, 'exclusive', f.projects[1]!.id), () => execute(name, f));
    expect(outcomes.map((outcome) => outcome.status)).toEqual(['fulfilled', 'fulfilled']);
  });

  it('allows unrelated project writes during exclusive coordination', async () => {
    const f = await fixture();
    await whileHeld(f, 'exclusive', () => new ProjectService(f.context).updateProject(f.projects[1]!.id, { name: 'Independent' }));
    expect((await repositories.projects.findById(f.projects[1]!.id))?.name).toBe('Independent');
  });

  it('allows ordinary writes to share the same project gate', async () => {
    const f = await fixture();
    await whileHeld(f, 'shared', () => new WorkItemService(f.context).updateWorkItem(f.item.id, { title: 'Compatible' }));
    expect((await repositories.workItems.findById(f.item.id))?.title).toBe('Compatible');
  });

  it('keeps workspace saved views outside project coordination', async () => {
    const f = await fixture();
    await whileHeld(f, 'exclusive', async () => {
      const service = new SavedWorkViewService(f.context);
      const view = await service.createSavedView({ scope: 'workspace', name: 'Workspace', query: {} });
      await service.updateSavedView(view.id, { name: 'Workspace renamed', isPinned: true });
      await service.deleteSavedView(view.id);
    });
  });

  it('keeps Inbox read-state independent of project coordination', async () => {
    const f = await fixture();
    const notification = await repositories.notifications.create({ id: randomUUID(), workspaceId: f.actor.workspaceId,
      projectId: f.project.id, workItemId: f.item.id, actorMemberId: f.actor.memberId, recipientMemberId: f.actor.memberId,
      notificationType: 'mention', sourceEventKey: randomUUID(), summary: 'Mention', metadata: {}, readAt: null, createdAt: timestamp });
    await whileHeld(f, 'exclusive', async () => {
      const service = new NotificationService(f.context);
      expect((await service.updateReadState(notification.id, { read: true })).readAt).not.toBeNull();
      await service.updateReadState(notification.id, { read: false });
      expect(await service.markAllRead()).toEqual({ unreadCount: 0 });
    });
  });

  it.each(participants.filter(([, mode]) => mode === 'shared'))('%s rereads project state after a queued archive', async (name) => {
    const f = await fixture();
    const before = await repositories.workItems.listByProject(f.project.id);
    const events = await repositories.activityEvents.findByWorkItem(f.item.id);
    const outcomes = await queued((scope) => new ProjectService({ ...f.context, ...scope }).archiveProject(f.project.id), () => execute(name, f));
    expect(outcomes[0].status).toBe('fulfilled');
    if (name === 'work.bulk') {
      expect(outcomes[1]).toMatchObject({ status: 'fulfilled', value: { failedCount: 1, succeededCount: 0,
        results: [{ status: 'failed', error: { code: 'VALIDATION_ERROR', message: 'Archived projects are read-only.' } }] } });
    } else {
      expect(outcomes[1]).toMatchObject({ status: 'rejected', reason: { code: name.startsWith('view.') ? 'FORBIDDEN' : 'CONFLICT' } });
    }
    expect(await repositories.workItems.listByProject(f.project.id)).toEqual(before);
    expect(await repositories.activityEvents.findByWorkItem(f.item.id)).toEqual(events);
    expect(await f.objectStore.get(f.attachment.storageKey)).not.toBeNull();
  });

  it.each(['overlap', 'touching', 'name', 'active'] as const)('serializes competing planned/active creations (%s)', async (kind) => {
    const f = await fixture();
    const first = { name: 'First', startDate: '2026-11-01', endDate: '2026-11-07' };
    const second = { name: kind === 'name' ? 'FIRST' : 'Second', status: kind === 'active' ? 'active' as const : 'planned' as const,
      startDate: kind === 'touching' ? '2026-11-07' : kind === 'name' || kind === 'active' ? '2026-12-01' : '2026-11-03', endDate: '2026-12-07' };
    if (kind === 'active') await repositories.projectCycles.update(f.source.id, { status: 'canceled', updatedAt: timestamp });
    const outcomes = await queued((scope) => new ProjectCycleService({ ...f.context, ...scope }).createProjectCycle(f.project.id,
      { ...first, ...(kind === 'active' ? { status: 'active' as const } : {}) }),
    () => new ProjectCycleService(f.context).createProjectCycle(f.project.id, second));
    expect(outcomes[0].status).toBe('fulfilled');
    expect(outcomes[1]).toMatchObject({ status: 'rejected', reason: { code: 'CONFLICT' } });
  });

  it.each(['update', 'reactivate'] as const)('validates %s against a concurrently committed creation', async (operation) => {
    const f = await fixture();
    const candidate = await repositories.projectCycles.create({ id: randomUUID(), workspaceId: f.actor.workspaceId, projectId: f.project.id,
      name: 'Candidate', status: 'planned', startDate: operation === 'reactivate' ? '2026-12-01' : '2026-11-01',
      endDate: operation === 'reactivate' ? '2026-12-07' : '2026-11-07', createdAt: timestamp, updatedAt: timestamp,
      archivedAt: operation === 'reactivate' ? timestamp : null });
    const outcomes = await queued((scope) => new ProjectCycleService({ ...f.context, ...scope }).createProjectCycle(f.project.id,
      { name: 'Competitor', startDate: '2026-12-01', endDate: '2026-12-07' }),
    () => operation === 'update'
      ? new ProjectCycleService(f.context).updateProjectCycle(f.project.id, candidate.id, { startDate: '2026-12-07', endDate: '2026-12-14' })
      : new ProjectCycleService(f.context).reactivateProjectCycle(f.project.id, candidate.id));
    expect(outcomes[0].status).toBe('fulfilled');
    expect(outcomes[1]).toMatchObject({ status: 'rejected', reason: { code: 'CONFLICT' } });
  });

  it('rereads completed state after closeout instead of resurrecting a queued cycle edit', async () => {
    const f = await fixture();
    const outcomes = await queued((scope) => new ProjectCycleCloseoutService({ ...f.context, ...scope })
      .close(f.project.id, f.source.id, { destinationCycleId: f.destination.id }),
    () => new ProjectCycleService(f.context).updateProjectCycle(f.project.id, f.source.id, { status: 'active' }));
    expect(outcomes[0].status).toBe('fulfilled');
    expect(outcomes[1]).toMatchObject({ status: 'rejected', reason: { code: 'CONFLICT' } });
    expect((await repositories.projectCycles.findById(f.source.id))?.status).toBe('completed');
    const replay = await new ProjectCycleCloseoutService(f.context).close(f.project.id, f.source.id, { destinationCycleId: f.destination.id });
    expect(replay.applied).toBe(false);
    expect(replay.movedItemCount).toBe(1);
  });

  it('includes a committed assignment in the closeout snapshot and carry-forward scope', async () => {
    const f = await fixture();
    const outcomes = await queued((scope) => new WorkItemService({ ...f.context, ...scope }).updateWorkItem(f.parent.id, { cycleId: f.source.id }),
      () => new ProjectCycleCloseoutService(f.context).close(f.project.id, f.source.id, { destinationCycleId: f.destination.id }));
    expect(outcomes.map((outcome) => outcome.status)).toEqual(['fulfilled', 'fulfilled']);
    expect((await repositories.workItems.findById(f.parent.id))?.cycleId).toBe(f.destination.id);
    expect((await repositories.workItems.findById(f.item.id))?.cycleId).toBe(f.destination.id);
    expect((await repositories.projectCycleCloseouts.findByCycleId(f.source.id))?.snapshot.counts.movedCount).toBe(2);
  });

  it.each(['assignment', 'status'] as const)('excludes a waiting %s write from closeout enumeration and preserves replay', async (operation) => {
    const f = await fixture();
    const outcomes = await queued((scope) => new ProjectCycleCloseoutService({ ...f.context, ...scope })
      .close(f.project.id, f.source.id, { destinationCycleId: f.destination.id }),
    () => operation === 'assignment'
      ? new WorkItemService(f.context).updateWorkItem(f.parent.id, { cycleId: f.destination.id })
      : new WorkItemService(f.context).transitionWorkItem(f.item.id, { status: 'in_progress' }));
    expect(outcomes.map((outcome) => outcome.status)).toEqual(['fulfilled', 'fulfilled']);
    const record = await repositories.projectCycleCloseouts.findByCycleId(f.source.id);
    expect(record?.snapshot.counts.movedCount).toBe(1);
    const replay = await new ProjectCycleCloseoutService(f.context).close(f.project.id, f.source.id, { destinationCycleId: f.destination.id });
    expect(replay.applied).toBe(false);
    expect(replay.movedItemCount).toBe(1);
    expect(await repositories.projectCycleCloseouts.findByCycleId(f.source.id)).toEqual(record);
  });

  it('rejects closeout queued behind a cancellation', async () => {
    const f = await fixture();
    const outcomes = await queued((scope) => new ProjectCycleService({ ...f.context, ...scope })
      .updateProjectCycle(f.project.id, f.source.id, { status: 'canceled' }),
    () => new ProjectCycleCloseoutService(f.context).close(f.project.id, f.source.id, { destinationCycleId: f.destination.id }));
    expect(outcomes[0].status).toBe('fulfilled');
    expect(outcomes[1]).toMatchObject({ status: 'rejected', reason: { code: 'CONFLICT' } });
    expect(await repositories.projectCycleCloseouts.findByCycleId(f.source.id)).toBeNull();
    expect((await repositories.workItems.findById(f.item.id))?.cycleId).toBe(f.source.id);
  });

  it.each(['label', 'milestone'] as const)('revalidates a %s archived while its assignment waited', async (kind) => {
    const f = await fixture();
    const outcomes = await queued<unknown, unknown>((scope) => kind === 'label'
      ? new LabelService({ ...f.context, ...scope }).archiveLabel(f.label.id)
      : new MilestoneService({ ...f.context, ...scope }).archiveMilestone(f.milestone.id),
    () => new WorkItemService(f.context).updateWorkItem(f.item.id,
      kind === 'label' ? { labelIds: [f.label.id] } : { milestoneId: f.milestone.id }));
    expect(outcomes[0].status).toBe('fulfilled');
    expect(outcomes[1]).toMatchObject({ status: 'rejected', reason: { code: 'VALIDATION_ERROR' } });
    expect((await repositories.workItems.findById(f.item.id))?.milestoneId).toBeNull();
    expect(await repositories.labels.listByWorkItem(f.item.id)).toEqual([]);
  });

  it.each(['active', 'name'] as const)('maps the real PostgreSQL %s unique backstop after rollback', async (kind) => {
    const f = await fixture();
    const persistence: Persistence = {
      ...f.context.persistence,
      write: (callback) => f.context.persistence.write((scope) => {
        if (kind === 'active') vi.spyOn(scope.repositories.projectCycles, 'findActiveByProject').mockResolvedValue(null);
        else vi.spyOn(scope.repositories.projectCycles, 'findNonArchivedByProjectName').mockResolvedValue(null);
        return callback(scope);
      })
    };
    const before = await repositories.projectCycles.listByProject(f.project.id);
    await expect(new ProjectCycleService({ ...f.context, persistence }).createProjectCycle(f.project.id, {
      name: kind === 'name' ? 'ACTIVE' : 'Another active', status: kind === 'active' ? 'active' : 'planned',
      startDate: '2026-12-01', endDate: '2026-12-07'
    })).rejects.toMatchObject({ code: 'CONFLICT', status: 409 });
    expect(await repositories.projectCycles.listByProject(f.project.id)).toEqual(before);
  });

  it('revalidates archived state before a waiting ordinary edit and rolls back its evidence', async () => {
    const f = await fixture();
    const before = await repositories.workItems.findById(f.item.id);
    const events = await repositories.activityEvents.findByWorkItem(f.item.id);
    const outcomes = await queued((scope) => new ProjectService({ ...f.context, ...scope }).archiveProject(f.project.id),
      () => new WorkItemService(f.context).updateWorkItem(f.item.id, { title: 'Rejected after archive' }));
    expect(outcomes[1]).toMatchObject({ status: 'rejected', reason: { code: 'CONFLICT' } });
    expect(await repositories.workItems.findById(f.item.id)).toEqual(before);
    expect(await repositories.activityEvents.findByWorkItem(f.item.id)).toEqual(events);
  });

  it('reports legacy inclusive overlaps without changing schedules or including historical/archived cycles', async () => {
    const f = await fixture();
    const overlap = await repositories.projectCycles.create({ id: randomUUID(), workspaceId: f.actor.workspaceId, projectId: f.project.id,
      name: 'Legacy overlap', status: 'planned', startDate: '2026-10-07', endDate: '2026-10-07', createdAt: timestamp, updatedAt: timestamp });
    for (const status of ['completed', 'canceled', 'planned'] as const) {
      await repositories.projectCycles.create({ id: randomUUID(), workspaceId: f.actor.workspaceId, projectId: f.project.id,
        name: `Historical ${status}`, status, startDate: '2026-10-01', endDate: '2026-10-14', createdAt: timestamp, updatedAt: timestamp,
        archivedAt: status === 'planned' ? timestamp : null });
    }
    const before = await repositories.projectCycles.listByProject(f.project.id, { includeArchived: true });
    const conflicts = await f.context.persistence.readConsistent(({ repositories: scoped }) => scoped.projectCycles.findScheduleConflicts(f.actor.workspaceId));
    expect(conflicts).toEqual([expect.objectContaining({ projectId: f.project.id, dateOverlap: true, activeConflict: false })]);
    expect([conflicts[0]?.leftCycleId, conflicts[0]?.rightCycleId].sort()).toEqual([f.source.id, overlap.id].sort());
    expect(await repositories.projectCycles.listByProject(f.project.id, { includeArchived: true })).toEqual(before);
    expect(await repositories.projectCycles.findScheduleConflicts(randomUUID())).toEqual([]);
    const { stdout } = await promisify(execFile)(process.execPath,
      ['--import', 'tsx', 'src/db/cycle-diagnostics.ts', `--workspace-id=${f.actor.workspaceId}`], { timeout: 5_000 });
    expect(JSON.parse(stdout)).toEqual({ readOnly: true, conflictCount: 1, conflicts });
    expect(await repositories.projectCycles.listByProject(f.project.id, { includeArchived: true })).toEqual(before);
  });
});
