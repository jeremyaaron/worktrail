import { randomUUID } from 'node:crypto';

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { createDb, createPool } from '../src/db/client.js';
import { createRepositories } from '../src/repositories/index.js';
import { createPersistence, type Persistence, type PersistenceScope } from '../src/repositories/persistence.js';
import { CommentService } from '../src/services/comment-service.js';
import { LabelService } from '../src/services/label-service.js';
import { MilestoneService } from '../src/services/milestone-service.js';
import { ProjectService } from '../src/services/project-service.js';
import { ProjectStatusReportService } from '../src/services/project-status-report-service.js';
import { SavedWorkViewService } from '../src/services/saved-work-view-service.js';
import { WorkItemCsvExportService } from '../src/services/work-item-csv-export-service.js';
import { WorkItemCsvImportService } from '../src/services/work-item-csv-import-service.js';
import { WorkItemService } from '../src/services/work-item-service.js';
import { WorkItemWatcherService } from '../src/services/work-item-watcher-service.js';
import { cleanupWorkspace } from './support/workspace-fixtures.js';

let pool: ReturnType<typeof createPool>;
let db: ReturnType<typeof createDb>;
let repositories: ReturnType<typeof createRepositories>;
let persistence: Persistence;
const workspaceIds = new Set<string>();

async function fixture() {
  const workspaceId = randomUUID();
  const memberId = randomUUID();
  const timestamp = new Date('2026-10-17T12:00:00Z');
  workspaceIds.add(workspaceId);
  await repositories.workspaces.create({ id: workspaceId, name: 'Persistence boundary', createdAt: timestamp, updatedAt: timestamp });
  const member = await repositories.members.create({
    id: memberId, workspaceId, name: 'Owner', email: `${memberId}@example.test`,
    role: 'owner', isActive: true, createdAt: timestamp, updatedAt: timestamp
  });
  const project = await repositories.projects.create({
    id: randomUUID(), workspaceId, key: 'SCOPE', name: 'Scope project',
    description: '', status: 'active', createdAt: timestamp, updatedAt: timestamp
  });
  const actor = { workspaceId, memberId, role: 'owner' as const };
  const context = { actor, repositories, persistence };
  const item = await new WorkItemService(context).createWorkItem(project.id, { title: 'Scoped item', type: 'task', priority: 'medium' });
  return { context, project, member, item };
}

function injectedContext(context: Awaited<ReturnType<typeof fixture>>['context'], inject: (scope: PersistenceScope) => void) {
  const injected: Persistence = {
    write: (callback) => persistence.write(async (scope) => { inject(scope); return callback(scope); }),
    readConsistent: (callback) => persistence.readConsistent(async (scope) => { inject(scope); return callback(scope); })
  };
  return { ...context, persistence: injected };
}

describe('real persistence boundaries', () => {
  beforeAll(() => {
    pool = createPool(process.env.DATABASE_URL!);
    db = createDb(pool);
    repositories = createRepositories(db);
    persistence = createPersistence(db);
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    for (const id of workspaceIds) await cleanupWorkspace(pool, id);
    workspaceIds.clear();
  });
  afterAll(async () => { await pool.end(); });

  it.each(['metadata', 'archive', 'reactivate'] as const)('rolls back project %s when activity persistence fails', async (operation) => {
    const { context, project } = await fixture();
    if (operation === 'reactivate') await new ProjectService(context).archiveProject(project.id);
    const before = await repositories.projects.findById(project.id);
    const eventsBefore = await repositories.activityEvents.findByProject(project.id);
    const service = new ProjectService(injectedContext(context, (scope) => {
      vi.spyOn(scope.repositories.activityEvents, 'create').mockRejectedValue(new Error('activity failure'));
    }));
    const action = operation === 'metadata' ? service.updateProject(project.id, { name: 'Changed', description: 'Changed' })
      : operation === 'archive' ? service.archiveProject(project.id) : service.reactivateProject(project.id);
    await expect(action).rejects.toThrow('activity failure');
    expect(await repositories.projects.findById(project.id)).toEqual(before);
    expect(await repositories.activityEvents.findByProject(project.id)).toEqual(eventsBefore);
  });

  it.each(['create', 'update', 'delete'] as const)('rolls back shared saved-view %s when audit persistence fails', async (operation) => {
    const { context } = await fixture();
    const input = { name: 'Shared', scope: 'workspace' as const, visibility: 'workspace' as const, query: {} };
    const view = operation === 'create' ? null : await new SavedWorkViewService(context).createSavedView(input);
    const before = await new SavedWorkViewService(context).listSavedViews();
    const service = new SavedWorkViewService(injectedContext(context, (scope) => {
      vi.spyOn(scope.repositories.workspaceActivityEvents, 'create').mockRejectedValue(new Error('audit failure'));
    }));
    const action = operation === 'create' ? service.createSavedView(input)
      : operation === 'update' ? service.updateSavedView(view!.id, { name: 'Changed' }) : service.deleteSavedView(view!.id);
    await expect(action).rejects.toThrow('audit failure');
    expect(await new SavedWorkViewService(context).listSavedViews()).toEqual(before);
  });

  it.each(['label', 'milestone'] as const)('rolls back %s administration with its activity', async (kind) => {
    const { context, project } = await fixture();
    const modified = injectedContext(context, (scope) => {
      vi.spyOn(scope.repositories.activityEvents, 'create').mockRejectedValue(new Error('activity failure'));
    });
    const action = kind === 'label'
      ? new LabelService(modified).createLabel(project.id, { name: 'Design', color: '#112233' })
      : new MilestoneService(modified).createMilestone(project.id, { name: 'Release' });
    await expect(action).rejects.toThrow('activity failure');
    expect(await repositories.labels.listByProject(project.id)).toEqual([]);
    expect(await repositories.milestones.listByProject(project.id)).toEqual([]);
  });

  it.each(['watch', 'unwatch'] as const)('rolls back %s if response hydration fails after the write', async (operation) => {
    const { context, item } = await fixture();
    if (operation === 'unwatch') await new WorkItemWatcherService(context).watch(item.id);
    const before = await repositories.workItemWatchers.listActiveByWorkItem(item.id);
    const service = new WorkItemWatcherService(injectedContext(context, (scope) => {
      vi.spyOn(scope.repositories.workItemWatchers, 'listActiveByWorkItem').mockRejectedValue(new Error('hydration failure'));
    }));
    await expect(service[operation](item.id)).rejects.toThrow('hydration failure');
    expect(await repositories.workItemWatchers.listActiveByWorkItem(item.id)).toEqual(before);
  });

  it.each(['comment', 'assignment'] as const)('rolls back %s state, mentions, watchers, activity and notifications together', async (operation) => {
    const { context, item, project } = await fixture();
    const timestamp = new Date();
    const recipient = await repositories.members.create({
      id: randomUUID(), workspaceId: context.actor.workspaceId,
      name: 'Recipient', email: `${randomUUID()}@example.test`, role: 'contributor', isActive: true,
      createdAt: timestamp, updatedAt: timestamp
    });
    const beforeWatchers = await repositories.workItemWatchers.listActiveByWorkItem(item.id);
    const beforeEvents = await repositories.activityEvents.findByWorkItem(item.id);
    const beforeItem = await repositories.workItems.findById(item.id);
    const modified = injectedContext(context, (scope) => {
      const original = scope.repositories.notifications.createManyIgnoringDuplicates;
      vi.spyOn(scope.repositories.notifications, 'createManyIgnoringDuplicates').mockImplementation(async (rows) => {
        await original(rows);
        throw new Error('notification failure');
      });
    });
    const action = operation === 'comment'
      ? new CommentService(modified).addComment(item.id, { body: 'Mention recipient', mentionMemberIds: [recipient.id] })
      : new WorkItemService(modified).updateWorkItem(item.id, { assigneeId: recipient.id });
    await expect(action)
      .rejects.toThrow('notification failure');
    expect(await repositories.workItems.findById(item.id)).toEqual(beforeItem);
    expect(await repositories.comments.findByWorkItem(item.id)).toEqual([]);
    expect(await repositories.activityEvents.findByWorkItem(item.id)).toEqual(beforeEvents);
    expect(await repositories.workItemWatchers.listActiveByWorkItem(item.id)).toEqual(beforeWatchers);
    const rows = await pool.query('select * from comment_mentions where workspace_id = $1', [project.workspaceId]);
    expect(rows.rows).toEqual([]);
    expect(await repositories.notifications.listByRecipient({ workspaceId: project.workspaceId, recipientMemberId: recipient.id, state: 'all' })).toEqual([]);
  });

  it('keeps count, window and reference hydration in one repeatable-read snapshot across an external commit', async () => {
    const { context, item, project, member } = await fixture();
    await persistence.readConsistent(async (scope) => {
      expect(await scope.repositories.workItems.countByProjectQuery(project.id, {})).toBe(1);
      await repositories.members.update(member.id, { name: 'Committed externally', updatedAt: new Date() });
      await new WorkItemService(context).createWorkItem(project.id, { title: 'Second item', type: 'task', priority: 'medium' });
      const page = await new WorkItemService({ ...context, ...scope }).listWorkItemPage(project.id);
      expect(page.totalCount).toBe(1);
      expect(page.items).toHaveLength(1);
      expect(page.items[0]).toMatchObject({ id: item.id, reporter: { name: 'Owner' } });
    });
    const current = await new WorkItemService(context).listWorkItemPage(project.id);
    expect(current.totalCount).toBe(2);
    expect(current.items[0]?.reporter.name).toBe('Committed externally');
  });

  it('enforces read-only at PostgreSQL even for direct repository writes', async () => {
    const { project } = await fixture();
    await expect(persistence.readConsistent((scope) => scope.repositories.projects.update(project.id, { name: 'Forbidden', updatedAt: new Date() })))
      .rejects.toMatchObject({ cause: { code: '25006' } });
    expect((await repositories.projects.findById(project.id))?.name).toBe('Scope project');
  });

  it.each(['shared', 'exclusive'] as const)('holds %s advisory coordination until commit', async (mode) => {
    const { project } = await fixture();
    const identity = JSON.stringify(['worktrail', 'project', project.workspaceId, project.id]);
    await persistence.write(async (scope) => {
      await scope.locks.projects([{ workspaceId: project.workspaceId, projectId: project.id, mode }]);
      const exclusive = await pool.query('select pg_try_advisory_xact_lock(hashtextextended($1, 0)) as locked', [identity]);
      expect(exclusive.rows[0]?.locked).toBe(false);
      const shared = await pool.query('select pg_try_advisory_xact_lock_shared(hashtextextended($1, 0)) as locked', [identity]);
      expect(shared.rows[0]?.locked).toBe(mode === 'shared');
    });
    const afterCommit = await pool.query('select pg_try_advisory_xact_lock(hashtextextended($1, 0)) as locked', [identity]);
    expect(afterCommit.rows[0]?.locked).toBe(true);
    await expect(persistence.write(async (scope) => {
      await scope.locks.projects([{ workspaceId: project.workspaceId, projectId: project.id, mode }]);
      throw new Error('abort');
    })).rejects.toThrow('abort');
    const afterRollback = await pool.query('select pg_try_advisory_xact_lock(hashtextextended($1, 0)) as locked', [identity]);
    expect(afterRollback.rows[0]?.locked).toBe(true);
  });

  it('reuses enclosing scopes for import, export and report cycle helpers without savepoints', async () => {
    const { context, project } = await fixture();
    await repositories.projectCycles.create({
      id: randomUUID(), workspaceId: project.workspaceId, projectId: project.id,
      name: 'Current cycle', status: 'active', startDate: '2026-10-01', endDate: '2026-10-31',
      createdAt: new Date(), updatedAt: new Date()
    });
    const transaction = vi.spyOn(db, 'transaction');
    await new WorkItemCsvImportService(context).apply(project.id, 'title,type,priority\nImported,task,medium');
    expect(transaction).toHaveBeenCalledTimes(1);
    transaction.mockClear();
    const exported = await new WorkItemCsvExportService(context).exportProjectWorkItems(project.id);
    expect(exported.csv).toContain('Imported');
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(transaction.mock.calls[0]?.[1]).toEqual({ isolationLevel: 'repeatable read', accessMode: 'read only' });
    transaction.mockClear();
    const published = await new ProjectStatusReportService(context).publishProjectStatusReport(project.id, {
      title: 'Scoped report', summary: 'Summary', statusDate: '2026-10-17'
    });
    expect(published.snapshot.cycle?.name).toBe('Current cycle');
    expect(transaction).toHaveBeenCalledTimes(1);
  });
});
