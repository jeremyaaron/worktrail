import { randomUUID } from 'node:crypto';

import type { CommentDto, UpdateCommentRequest } from '@worktrail/contracts';
import { sql } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { createExpressApp } from '../src/adapters/express/server.js';
import { createDb, createPool, type WorktrailDb } from '../src/db/client.js';
import { createRepositories, type Repositories } from '../src/repositories/index.js';
import { CommentService } from '../src/services/comment-service.js';
import { cleanupWorkspace as cleanupOwnedWorkspace } from './support/workspace-fixtures.js';

const workspaceIds = new Set<string>();
let pool: ReturnType<typeof createPool>;
let db: ReturnType<typeof createDb>;
let repositories: Repositories;
let app: ReturnType<typeof createExpressApp>;

function now() {
  return new Date('2026-07-03T12:00:00.000Z');
}

function actorHeaders(input: { workspaceId: string; memberId: string; role: string }) {
  return {
    'x-worktrail-workspace-id': input.workspaceId,
    'x-worktrail-member-id': input.memberId,
    'x-worktrail-role': input.role
  };
}

async function cleanupWorkspace(workspaceId: string) {
  await cleanupOwnedWorkspace(pool, workspaceId);
}

async function cleanupAllWorkspaces() {
  for (const workspaceId of workspaceIds) {
    await cleanupWorkspace(workspaceId);
  }
  workspaceIds.clear();
}

async function createFixture(role: 'owner' | 'maintainer' | 'contributor' = 'owner') {
  const timestamp = now();
  const workspaceId = randomUUID();
  const actorId = randomUUID();
  const contributorId = randomUUID();
  const inactiveMemberId = randomUUID();
  const projectId = randomUUID();
  workspaceIds.add(workspaceId);

  await repositories.workspaces.create({
    id: workspaceId,
    name: 'Comments Test Workspace',
    createdAt: timestamp,
    updatedAt: timestamp
  });

  for (const member of [
    { id: actorId, role, name: 'Comment Actor', isActive: true },
    { id: contributorId, role: 'contributor' as const, name: 'Comment Contributor', isActive: true },
    { id: inactiveMemberId, role: 'contributor' as const, name: 'Inactive Contributor', isActive: false }
  ]) {
    await repositories.members.create({
      id: member.id,
      workspaceId,
      name: member.name,
      email: `${member.id}@example.com`,
      role: member.role,
      isActive: member.isActive ?? true,
      createdAt: timestamp,
      updatedAt: timestamp
    });
  }

  await repositories.projects.create({
    id: projectId,
    workspaceId,
    key: 'CA',
    nextWorkItemNumber: 2,
    name: 'Comments Test Project',
    description: 'Project for comment and activity endpoint tests.',
    status: 'active',
    createdAt: timestamp,
    updatedAt: timestamp
  });

  return {
    workspaceId,
    actorId,
    contributorId,
    inactiveMemberId,
    projectId,
    headers: actorHeaders({ workspaceId, memberId: actorId, role }),
    contributorHeaders: actorHeaders({
      workspaceId,
      memberId: contributorId,
      role: 'contributor'
    })
  };
}

async function createWorkItem(fixture: Awaited<ReturnType<typeof createFixture>>) {
  return repositories.workItems.create({
    id: randomUUID(),
    workspaceId: fixture.workspaceId,
    projectId: fixture.projectId,
    itemNumber: 1,
    displayKey: 'CA-1',
    title: 'Commented work item',
    description: 'Work item with collaboration history.',
    type: 'task',
    status: 'ready',
    priority: 'medium',
    assigneeId: fixture.contributorId,
    reporterId: fixture.actorId,
    dueDate: null,
    estimatePoints: null,
    createdAt: now(),
    updatedAt: now()
  });
}

async function createComment(
  fixture: Awaited<ReturnType<typeof createFixture>>, workItemId: string,
  overrides: Partial<Parameters<typeof repositories.comments.create>[0]> = {}
) {
  return repositories.comments.create({
    id: randomUUID(), workspaceId: fixture.workspaceId, projectId: fixture.projectId,
    workItemId, authorId: fixture.actorId, body: 'Original source',
    createdAt: now(), updatedAt: now(), ...overrides
  });
}

function createService(
  fixture: Awaited<ReturnType<typeof createFixture>>,
  overrides: Partial<ConstructorParameters<typeof CommentService>[0]> = {}
) {
  return new CommentService({
    actor: { workspaceId: fixture.workspaceId, memberId: fixture.actorId, role: 'owner' },
    repositories, db, ...overrides
  });
}

beforeAll(() => {
  pool = createPool();
  db = createDb(pool);
  repositories = createRepositories(db);
  app = createExpressApp({ repositories, db });
});

afterEach(async () => {
  vi.restoreAllMocks();
  await cleanupAllWorkspaces();
});

afterAll(async () => {
  await cleanupAllWorkspaces();
  await pool.end();
});

describe('authored comment writes', () => {
  it.each(['plain_text', 'markdown_v1'] as const)('preserves whitespace and normalizes %s source', async (bodyFormat) => {
    const fixture = await createFixture();
    const item = await createWorkItem(fixture);
    const response = await request(app).post(`/api/work-items/${item.id}/comments`).set(fixture.headers)
      .send({ body: '  **literal**\r\n\tcode  \r', bodyFormat }).expect(201);
    expect(response.body).toMatchObject({ body: '  **literal**\n\tcode  \n', bodyFormat, mentions: [] });
    await request(app).patch(`/api/comments/${response.body.id}`).set(fixture.headers)
      .send({ body: '  new\r\nsource  ' }).expect(200)
      .expect(({ body }) => expect(body).toMatchObject({ body: '  new\nsource  ', bodyFormat, isEdited: true }));
    expect(await repositories.commentMentions.listByComment(response.body.id)).toEqual([]);
  });

  it.each([null, 'html', '', 1])('rejects unknown/null comment formats: %j', async (bodyFormat) => {
    const fixture = await createFixture();
    const item = await createWorkItem(fixture);
    const comment = await createComment(fixture, item.id);
    await request(app).post(`/api/work-items/${item.id}/comments`).set(fixture.headers)
      .send({ body: 'Source', bodyFormat }).expect(400);
    await request(app).patch(`/api/comments/${comment.id}`).set(fixture.headers)
      .send({ body: comment.body, bodyFormat }).expect(400);
    expect(await repositories.comments.findById(comment.id)).toEqual(comment);
    expect(await repositories.activityEvents.findByWorkItem(item.id)).toEqual([]);
  });

  it.each([undefined, null, 1, '', ' \r\n\t '])('rejects missing, non-string, or newly blank source: %j', async (body) => {
    const fixture = await createFixture();
    const item = await createWorkItem(fixture);
    const comment = await createComment(fixture, item.id);
    await request(app).post(`/api/work-items/${item.id}/comments`).set(fixture.headers)
      .send({ body, bodyFormat: 'markdown_v1' }).expect(400);
    await request(app).patch(`/api/comments/${comment.id}`).set(fixture.headers)
      .send({ body, bodyFormat: 'markdown_v1' }).expect(400);
    expect(await repositories.comments.findById(comment.id)).toEqual(comment);
  });

  it.each(['x'.repeat(10_000), '\u{1f600}'.repeat(5_000), `x${'\r\n'.repeat(9_999)}`])(
    'accepts normalized UTF-16 limits on create and edit (%#)', async (body) => {
      const fixture = await createFixture();
      const item = await createWorkItem(fixture);
      const response = await request(app).post(`/api/work-items/${item.id}/comments`).set(fixture.headers)
        .send({ body, bodyFormat: 'markdown_v1' }).expect(201);
      expect(response.body.body).toBe(body.replace(/\r\n/g, '\n'));
      const comment = await createComment(fixture, item.id);
      await request(app).patch(`/api/comments/${comment.id}`).set(fixture.headers)
        .send({ body }).expect(200)
        .expect(({ body: result }) => expect(result.body).toBe(response.body.body));
    }
  );

  it('enforces source limits and non-whitespace policy through direct services as well as endpoints', async () => {
    const fixture = await createFixture();
    const item = await createWorkItem(fixture);
    const comment = await createComment(fixture, item.id);
    for (const body of [`${'\u{1f600}'.repeat(5_000)}x`, ' \r\n\t ']) {
      const response = await request(app).post(`/api/work-items/${item.id}/comments`).set(fixture.headers)
        .send({ body }).expect(400);
      expect(response.body.error).toMatchObject({ code: 'VALIDATION_ERROR', details: {
        field: 'body', reason: body.length > 10_000 ? 'source_too_long' : 'empty_source'
      } });
      expect(response.body.error.details).not.toHaveProperty('body');
      expect(JSON.stringify(response.body)).not.toContain(body);
      if (body.length > 10_000) {
        expect(response.body.error.details.maximumCodeUnits).toBe(10_000);
      }
      await request(app).patch(`/api/comments/${comment.id}`).set(fixture.headers).send({ body }).expect(400);
      await expect(createService(fixture).addComment(item.id, { body })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
      await expect(createService(fixture).updateComment(comment.id, { body })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    }
    expect(await repositories.comments.findByWorkItem(item.id)).toEqual([comment]);
    expect(await repositories.activityEvents.findByWorkItem(item.id)).toEqual([]);
    const direct = await createService(fixture).addComment(item.id, { body: '  **literal**\r\n' });
    expect(direct).toMatchObject({ body: '  **literal**\n', bodyFormat: 'plain_text' });
  });

  it.each([null, now()])('preserves historical bytes, edit state, and row versions on equivalent no-ops (%#)', async (editedAt) => {
    const fixture = await createFixture();
    const item = await createWorkItem(fixture);
    const comment = await createComment(fixture, item.id, { body: '  source\r\n', editedAt, bodyFormat: 'markdown_v1' });
    const versions = () => pool.query('select ctid::text, xmin::text from comments where id = $1', [comment.id]);
    const before = (await versions()).rows;
    for (const content of [{ body: '  source\n' }, { body: comment.body, bodyFormat: 'markdown_v1' }]) {
      await request(app).patch(`/api/comments/${comment.id}`).set(fixture.headers).send(content).expect(200)
        .expect(({ body }) => expect(body).toMatchObject({ body: comment.body, bodyFormat: 'markdown_v1',
          isEdited: editedAt !== null, editedAt: editedAt?.toISOString() ?? null,
          updatedAt: comment.updatedAt.toISOString() }));
    }
    expect((await versions()).rows).toEqual(before);
    expect(await repositories.comments.findById(comment.id)).toEqual(comment);
    expect(await repositories.activityEvents.findByWorkItem(item.id)).toEqual([]);
  });

  it.each([' \r\n\t ', `${'x'.repeat(10_001)}\r\n`])('grandfathers unchanged blank or oversized legacy source (%#)', async (body) => {
    const fixture = await createFixture();
    const item = await createWorkItem(fixture);
    const comment = await createComment(fixture, item.id, { body });
    await request(app).patch(`/api/comments/${comment.id}`).set(fixture.headers)
      .send({ body: body.replace('\r\n', '\n') }).expect(200);
    expect(await repositories.comments.findById(comment.id)).toEqual(comment);
    await request(app).patch(`/api/comments/${comment.id}`).set(fixture.headers)
      .send({ body, bodyFormat: 'markdown_v1' }).expect(400);
    expect(await repositories.activityEvents.findByWorkItem(item.id)).toEqual([]);
    await request(app).patch(`/api/comments/${comment.id}`).set(fixture.headers)
      .send({ body: 'Short valid source', bodyFormat: 'markdown_v1' }).expect(200);
    expect(await repositories.comments.findById(comment.id)).toMatchObject({ body: 'Short valid source', bodyFormat: 'markdown_v1' });
    expect(await repositories.activityEvents.findByWorkItem(item.id)).toHaveLength(1);
  });

  it('allows normalized-limit conversion while retaining historical CRLF bytes', async () => {
    const fixture = await createFixture();
    const item = await createWorkItem(fixture);
    const body = `x${'\r\n'.repeat(9_999)}`;
    const comment = await createComment(fixture, item.id, { body });
    await request(app).patch(`/api/comments/${comment.id}`).set(fixture.headers)
      .send({ body: body.replace(/\r\n/g, '\n'), bodyFormat: 'markdown_v1' }).expect(200)
      .expect(({ body: result }) => expect(result).toMatchObject({ body, bodyFormat: 'markdown_v1', isEdited: true }));
    expect(await repositories.activityEvents.findByWorkItem(item.id)).toEqual([
      expect.objectContaining({ summary: 'Comment format changed.', previousValue: null, newValue: null,
        metadata: { commentId: comment.id, previousBodyFormat: 'plain_text', newBodyFormat: 'markdown_v1' } })
    ]);
  });

  it('rolls back content and edit timestamps if the activity write fails', async () => {
    const fixture = await createFixture();
    const item = await createWorkItem(fixture);
    const comment = await createComment(fixture, item.id);
    await expect(db.transaction(async (tx) => {
      const transactionRepositories = createRepositories(tx as unknown as WorktrailDb);
      vi.spyOn(transactionRepositories.activityEvents, 'create')
        .mockRejectedValue(new Error('Simulated activity failure'));
      return createService(fixture, { db: undefined, repositories: transactionRepositories })
        .updateComment(comment.id, { body: 'Changed source', bodyFormat: 'markdown_v1' });
    })).rejects.toThrow('Simulated activity failure');
    expect(await repositories.comments.findById(comment.id)).toEqual(comment);
    expect(await repositories.activityEvents.findByWorkItem(item.id)).toEqual([]);
  });

  it('preserves explicit mentions and deduplicated notifications through edits, conversions, and no-ops', async () => {
    const fixture = await createFixture();
    const item = await createWorkItem(fixture);
    await repositories.workItemWatchers.watch({ id: randomUUID(), workspaceId: fixture.workspaceId,
      workItemId: item.id, memberId: fixture.contributorId, watchedAt: now(), unwatchedAt: null,
      createdAt: now(), updatedAt: now() });
    const created = await request(app).post(`/api/work-items/${item.id}/comments`).set(fixture.headers)
      .send({ body: '**Private original source**', bodyFormat: 'markdown_v1',
        mentionMemberIds: [fixture.contributorId, fixture.contributorId, fixture.actorId] }).expect(201);
    const mentions = await repositories.commentMentions.listByComment(created.body.id);
    const notifications = await repositories.notifications.listByRecipient({ workspaceId: fixture.workspaceId,
      recipientMemberId: fixture.contributorId, state: 'all' });
    expect(notifications).toEqual([expect.objectContaining({ notificationType: 'mention' })]);
    for (const content of [
      { body: created.body.body, bodyFormat: 'plain_text' },
      { body: '## Private replacement source', bodyFormat: 'markdown_v1' },
      { body: '## Private replacement source' }
    ]) {
      await request(app).patch(`/api/comments/${created.body.id}`).set(fixture.headers)
        .send({ ...content, mentionMemberIds: [fixture.inactiveMemberId] }).expect(200);
    }
    expect(await repositories.commentMentions.listByComment(created.body.id)).toEqual(mentions);
    expect(await repositories.notifications.listByRecipient({ workspaceId: fixture.workspaceId,
      recipientMemberId: fixture.contributorId, state: 'all' })).toEqual(notifications);
    const events = (await repositories.activityEvents.findByWorkItem(item.id))
      .filter((event) => event.eventType === 'comment.edited');
    expect(events).toHaveLength(2);
    expect(events).toContainEqual(expect.objectContaining({ summary: 'Comment format changed.',
      metadata: { commentId: created.body.id, previousBodyFormat: 'markdown_v1', newBodyFormat: 'plain_text' },
      previousValue: null, newValue: null }));
    expect(events).toContainEqual(expect.objectContaining({ metadata: {
      commentId: created.body.id, previousBodyFormat: 'plain_text', newBodyFormat: 'markdown_v1'
    } }));
    expect(JSON.stringify(events)).not.toContain('Private');
    const detail = await request(app).get(`/api/work-items/${item.id}`).set(fixture.headers).expect(200);
    const list = await request(app).get(`/api/work-items/${item.id}/comments`).set(fixture.headers).expect(200);
    expect(detail.body.comments).toEqual(list.body);
    expect(list.body[0]).toMatchObject({ bodyFormat: 'markdown_v1', isEdited: true,
      mentions: expect.arrayContaining([expect.objectContaining({ id: fixture.contributorId })]) });
  });

  it('does not infer recipients from formatting syntax or member-like source text', async () => {
    const fixture = await createFixture();
    const item = await createWorkItem(fixture);
    const created = await request(app).post(`/api/work-items/${item.id}/comments`).set(fixture.headers)
      .send({ body: `@${fixture.contributorId} [mention](https://example.com) **@Comment Contributor**`,
        bodyFormat: 'markdown_v1' }).expect(201);
    expect(created.body.mentions).toEqual([]);
    expect(await repositories.commentMentions.listByComment(created.body.id)).toEqual([]);
    expect(await repositories.notifications.listByRecipient({ workspaceId: fixture.workspaceId,
      recipientMemberId: fixture.contributorId, state: 'all' })).toEqual([]);
  });

  it('keeps tenant, role, inactive-actor, archived, and deleted checks ahead of no-op/conversion writes', async () => {
    const fixture = await createFixture();
    const foreign = await createFixture();
    const item = await createWorkItem(fixture);
    const comment = await createComment(fixture, item.id);
    const inactiveHeaders = actorHeaders({ workspaceId: fixture.workspaceId,
      memberId: fixture.inactiveMemberId, role: 'contributor' });
    for (const content of [{ body: comment.body }, { body: comment.body, bodyFormat: 'markdown_v1' }]) {
      await request(app).patch(`/api/comments/${comment.id}`).set(foreign.headers).send(content).expect(404);
      await request(app).patch(`/api/comments/${comment.id}`).set(fixture.contributorHeaders).send(content).expect(403);
      await request(app).patch(`/api/comments/${comment.id}`).set(inactiveHeaders).send(content).expect(403);
    }
    await request(app).post(`/api/work-items/${item.id}/comments`).set(inactiveHeaders)
      .send({ body: 'Inactive writer', bodyFormat: 'markdown_v1' }).expect(403);
    await request(app).delete(`/api/comments/${comment.id}`).set(foreign.headers).expect(404);
    await request(app).delete(`/api/comments/${comment.id}`).set(fixture.contributorHeaders).expect(403);
    await request(app).delete(`/api/comments/${comment.id}`).set(inactiveHeaders).expect(403);
    await repositories.projects.update(fixture.projectId, { status: 'archived', updatedAt: now() });
    await request(app).patch(`/api/comments/${comment.id}`).set(fixture.headers)
      .send({ body: comment.body }).expect(409);
    await request(app).patch(`/api/comments/${comment.id}`).set(fixture.headers)
      .send({ body: comment.body, bodyFormat: 'markdown_v1' }).expect(409);
    expect(await repositories.comments.findById(comment.id)).toEqual(comment);
    await repositories.projects.update(fixture.projectId, { status: 'active', updatedAt: now() });
    await request(app).delete(`/api/comments/${comment.id}`).set(fixture.headers).expect(200);
    await request(app).patch(`/api/comments/${comment.id}`).set(fixture.headers)
      .send({ body: comment.body }).expect(409);
  });

  type CommentWrite = UpdateCommentRequest | 'delete';

  async function queuedWrites(
    fixture: Awaited<ReturnType<typeof createFixture>>, commentId: string,
    firstInput: CommentWrite, secondInput: CommentWrite
  ) {
    const perform = (service: CommentService, input: CommentWrite) => input === 'delete'
      ? service.deleteComment(commentId) : service.updateComment(commentId, input);
    let release!: () => void;
    let ready!: (pid: number) => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const locked = new Promise<number>((resolve) => { ready = resolve; });
    const first = db.transaction(async (tx) => {
      const { rows } = await tx.execute(sql`select pg_backend_pid() as pid`);
      const result = await perform(createService(fixture, {
        db: undefined, repositories: createRepositories(tx as unknown as WorktrailDb),
        clock: () => new Date('2026-07-04T00:00:00Z')
      }), firstInput);
      ready(Number(rows[0]?.pid));
      await gate;
      return result;
    });
    let second: Promise<CommentDto> | undefined;
    try {
      const pid = await Promise.race([locked, first.then(() => { throw new Error('Writer ended early.'); })]);
      second = perform(createService(fixture, { clock: () => new Date('2026-07-05T00:00:00Z') }), secondInput);
      void second.catch(() => undefined);
      // Release the first writer only after PostgreSQL confirms the second is blocked on its lock.
      await vi.waitFor(async () => {
        const waiting = await pool.query(`select pid from pg_stat_activity where datname = current_database()
          and wait_event_type = 'Lock' and $1 = any(pg_blocking_pids(pid))`, [pid]);
        expect(waiting.rows.length).toBeGreaterThan(0);
      }, { timeout: 5_000, interval: 10 });
    } finally {
      release();
      await Promise.allSettled([first, second]);
    }
    return Promise.allSettled([first, second!]);
  }

  it('resolves a queued omitted format against the newly committed comment pair', async () => {
    const fixture = await createFixture();
    const item = await createWorkItem(fixture);
    const comment = await createComment(fixture, item.id);
    const outcomes = await queuedWrites(fixture, comment.id,
      { body: 'First writer', bodyFormat: 'markdown_v1' }, { body: 'Second writer' });
    expect(outcomes.map((outcome) => outcome.status)).toEqual(['fulfilled', 'fulfilled']);
    expect(await repositories.comments.findById(comment.id)).toMatchObject({
      body: 'Second writer', bodyFormat: 'markdown_v1'
    });
    const events = await repositories.activityEvents.findByWorkItem(item.id);
    expect(events).toHaveLength(2);
    expect(events).toContainEqual(expect.objectContaining({ createdAt: new Date('2026-07-05T00:00:00Z'),
      metadata: { commentId: comment.id } }));
  });

  it('makes a queued equivalent edit a no-op preserving the first edit timestamps', async () => {
    const fixture = await createFixture();
    const item = await createWorkItem(fixture);
    const comment = await createComment(fixture, item.id);
    const [first, second] = await queuedWrites(fixture, comment.id,
      { body: 'Same\nsource', bodyFormat: 'markdown_v1' }, { body: 'Same\r\nsource' });
    expect(first.status).toBe('fulfilled');
    expect(second).toEqual(first);
    expect(await repositories.comments.findById(comment.id)).toMatchObject({
      editedAt: new Date('2026-07-04T00:00:00Z'), updatedAt: new Date('2026-07-04T00:00:00Z')
    });
    expect(await repositories.activityEvents.findByWorkItem(item.id)).toHaveLength(1);
  });

  it.each(['edit', 'delete'] as const)('rejects a queued %s after deletion and preserves retained source', async (operation) => {
    const fixture = await createFixture();
    const item = await createWorkItem(fixture);
    const comment = await createComment(fixture, item.id, { body: 'Retained private source',
      bodyFormat: 'markdown_v1', editedAt: now() });
    const [first, second] = await queuedWrites(fixture, comment.id, 'delete',
      operation === 'delete' ? 'delete' : { body: 'Attempted resurrection', bodyFormat: 'plain_text' });
    expect(first).toMatchObject({ status: 'fulfilled', value: { body: '', bodyFormat: 'plain_text', isDeleted: true } });
    expect(second).toMatchObject({ status: 'rejected', reason: { code: 'CONFLICT' } });
    expect(await repositories.comments.findById(comment.id)).toMatchObject({ body: comment.body,
      bodyFormat: 'markdown_v1', editedAt: comment.editedAt, deletedAt: new Date('2026-07-04T00:00:00Z'),
      updatedAt: new Date('2026-07-04T00:00:00Z') });
    expect(await repositories.activityEvents.findByWorkItem(item.id)).toEqual([
      expect.objectContaining({ eventType: 'comment.deleted' })
    ]);
    const detail = await request(app).get(`/api/work-items/${item.id}`).set(fixture.headers).expect(200);
    const list = await request(app).get(`/api/work-items/${item.id}/comments`).set(fixture.headers).expect(200);
    expect(detail.body.comments).toEqual(list.body);
    expect(list.body[0]).toMatchObject({ body: '', bodyFormat: 'plain_text', isDeleted: true, isEdited: true });
    expect(JSON.stringify(detail.body)).not.toContain(comment.body);
  });

  it('deletes the current pair after a queued edit without discarding edit metadata', async () => {
    const fixture = await createFixture();
    const item = await createWorkItem(fixture);
    const comment = await createComment(fixture, item.id);
    const outcomes = await queuedWrites(fixture, comment.id,
      { body: 'Edited before deletion', bodyFormat: 'markdown_v1' }, 'delete');
    expect(outcomes.map((outcome) => outcome.status)).toEqual(['fulfilled', 'fulfilled']);
    expect(await repositories.comments.findById(comment.id)).toMatchObject({
      body: 'Edited before deletion', bodyFormat: 'markdown_v1',
      editedAt: new Date('2026-07-04T00:00:00Z'), deletedAt: new Date('2026-07-05T00:00:00Z')
    });
    const events = await repositories.activityEvents.findByWorkItem(item.id);
    expect(events.map((event) => event.eventType).sort()).toEqual(['comment.deleted', 'comment.edited']);
    expect(JSON.stringify(events)).not.toContain('Edited before deletion');
  });
});

describe('comments and activity API', () => {
  it('returns persisted formats on detail and comment reads, with plain-text tombstones', async () => {
    const fixture = await createFixture('owner');
    const workItem = await createWorkItem(fixture);
    expect(workItem.descriptionFormat).toBe('plain_text');

    const description = '  # Persisted description\r\n';
    await repositories.workItems.update(workItem.id, {
      description,
      descriptionFormat: 'markdown_v1',
      updatedAt: now()
    });
    const plainComment = await repositories.comments.create({
      id: randomUUID(),
      workspaceId: fixture.workspaceId,
      projectId: fixture.projectId,
      workItemId: workItem.id,
      authorId: fixture.actorId,
      body: '**Still literal**',
      createdAt: now(),
      updatedAt: now()
    });
    expect(plainComment.bodyFormat).toBe('plain_text');
    const markdownComment = await repositories.comments.create({
      id: randomUUID(),
      workspaceId: fixture.workspaceId,
      projectId: fixture.projectId,
      workItemId: workItem.id,
      authorId: fixture.actorId,
      body: '  **Markdown source**\r\n',
      bodyFormat: 'markdown_v1',
      createdAt: now(),
      updatedAt: now()
    });
    const deletedComment = await repositories.comments.create({
      id: randomUUID(),
      workspaceId: fixture.workspaceId,
      projectId: fixture.projectId,
      workItemId: workItem.id,
      authorId: fixture.actorId,
      body: 'Private deleted source',
      bodyFormat: 'markdown_v1',
      deletedAt: now(),
      deletedById: fixture.actorId,
      createdAt: now(),
      updatedAt: now()
    });

    const detail = await request(app).get(`/api/work-items/${workItem.id}`)
      .set(fixture.headers).expect(200);
    const comments = await request(app).get(`/api/work-items/${workItem.id}/comments`)
      .set(fixture.headers).expect(200);
    expect(detail.body.description).toBe(description);
    expect(detail.body.descriptionFormat).toBe('markdown_v1');
    expect(detail.body.comments).toEqual(comments.body);
    expect(comments.body).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: plainComment.id, body: '**Still literal**', bodyFormat: 'plain_text' }),
      expect.objectContaining({
        id: markdownComment.id, body: markdownComment.body, bodyFormat: 'markdown_v1'
      }),
      expect.objectContaining({
        id: deletedComment.id, body: '', bodyFormat: 'plain_text', isDeleted: true
      })
    ]));
    expect(JSON.stringify(detail.body)).not.toContain('Private deleted source');
    expect((await repositories.comments.findById(deletedComment.id))?.bodyFormat).toBe('markdown_v1');

    const updated = await repositories.comments.updateContent(markdownComment.id, {
      body: 'Repository update retains format', editedAt: now(), updatedAt: now()
    });
    expect(updated?.bodyFormat).toBe('markdown_v1');
    const converted = await repositories.comments.updateContent(markdownComment.id, {
      body: updated!.body, bodyFormat: 'plain_text', editedAt: now(), updatedAt: now()
    });
    expect(converted?.bodyFormat).toBe('plain_text');
    const list = await request(app).get(`/api/projects/${fixture.projectId}/work-items`)
      .set(fixture.headers).expect(200);
    expect(list.body.items[0]).not.toHaveProperty('description');
    expect(list.body.items[0]).not.toHaveProperty('descriptionFormat');
  });

  it('adds comments with author details and records comment activity', async () => {
    const fixture = await createFixture('owner');
    const workItem = await createWorkItem(fixture);
    await repositories.workItemWatchers.watch({
      id: randomUUID(),
      workspaceId: fixture.workspaceId,
      workItemId: workItem.id,
      memberId: fixture.contributorId,
      watchedAt: now(),
      unwatchedAt: null,
      createdAt: now(),
      updatedAt: now()
    });

    const response = await request(app)
      .post(`/api/work-items/${workItem.id}/comments`)
      .set(fixture.headers)
      .send({ body: '  This should be recorded.  ' })
      .expect(201);

    expect(response.body).toMatchObject({
      workspaceId: fixture.workspaceId,
      projectId: fixture.projectId,
      workItemId: workItem.id,
      author: { id: fixture.actorId, name: 'Comment Actor' },
      body: '  This should be recorded.  ',
      bodyFormat: 'plain_text'
    });
    expect(response.body.createdAt).toEqual(expect.any(String));

    const comments = await repositories.comments.findByWorkItem(workItem.id);
    expect(comments).toHaveLength(1);
    expect(comments[0]?.body).toBe('  This should be recorded.  ');

    const activity = await repositories.activityEvents.findByWorkItem(workItem.id);
    expect(activity).toHaveLength(1);
    expect(activity[0]).toMatchObject({
      eventType: 'comment.added',
      actorId: fixture.actorId,
      metadata: { commentId: response.body.id }
    });
    await expect(
      repositories.notifications.listByRecipient({
        workspaceId: fixture.workspaceId,
        recipientMemberId: fixture.contributorId,
        state: 'all'
      })
    ).resolves.toEqual([
      expect.objectContaining({
        notificationType: 'watched_comment',
        workItemId: workItem.id,
        metadata: { commentId: response.body.id }
      })
    ]);
  });

  it('adds comments with deduped mentions and returns mention metadata', async () => {
    const fixture = await createFixture('owner');
    const workItem = await createWorkItem(fixture);
    await repositories.workItemWatchers.watch({
      id: randomUUID(),
      workspaceId: fixture.workspaceId,
      workItemId: workItem.id,
      memberId: fixture.contributorId,
      watchedAt: now(),
      unwatchedAt: null,
      createdAt: now(),
      updatedAt: now()
    });

    const response = await request(app)
      .post(`/api/work-items/${workItem.id}/comments`)
      .set(fixture.headers)
      .send({
        body: 'Mentioning the contributor and myself.',
        mentionMemberIds: [fixture.contributorId, fixture.contributorId, fixture.actorId]
      })
      .expect(201);

    expect(response.body.mentions).toHaveLength(2);
    expect(response.body.mentions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: fixture.actorId, name: 'Comment Actor' }),
        expect.objectContaining({ id: fixture.contributorId, name: 'Comment Contributor' })
      ])
    );

    const mentions = await repositories.commentMentions.listByComment(response.body.id);
    expect(mentions.map((mention) => mention.memberId).sort()).toEqual(
      [fixture.actorId, fixture.contributorId].sort()
    );

    await request(app)
      .get(`/api/work-items/${workItem.id}/comments`)
      .set(fixture.headers)
      .expect(200)
      .expect(({ body }) => {
        expect(body[0].mentions).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ id: fixture.actorId }),
            expect.objectContaining({ id: fixture.contributorId })
          ])
        );
      });

    await request(app)
      .get(`/api/work-items/${workItem.id}`)
      .set(fixture.headers)
      .expect(200)
      .expect(({ body }) => {
        expect(body.comments[0].mentions).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ id: fixture.actorId }),
            expect.objectContaining({ id: fixture.contributorId })
          ])
        );
      });

    await expect(
      repositories.notifications.unreadCount({
        workspaceId: fixture.workspaceId,
        recipientMemberId: fixture.actorId
      })
    ).resolves.toBe(0);
    await expect(
      repositories.notifications.listByRecipient({
        workspaceId: fixture.workspaceId,
        recipientMemberId: fixture.contributorId,
        state: 'all'
      })
    ).resolves.toEqual([
      expect.objectContaining({
        notificationType: 'mention',
        workItemId: workItem.id,
        metadata: { commentId: response.body.id }
      })
    ]);
  });

  it('lists comments in creation order', async () => {
    const fixture = await createFixture('owner');
    const workItem = await createWorkItem(fixture);

    await repositories.comments.create({
      id: randomUUID(),
      workspaceId: fixture.workspaceId,
      projectId: fixture.projectId,
      workItemId: workItem.id,
      authorId: fixture.actorId,
      body: 'First comment',
      createdAt: new Date('2026-07-03T12:01:00.000Z'),
      updatedAt: new Date('2026-07-03T12:01:00.000Z')
    });
    await repositories.comments.create({
      id: randomUUID(),
      workspaceId: fixture.workspaceId,
      projectId: fixture.projectId,
      workItemId: workItem.id,
      authorId: fixture.contributorId,
      body: 'Second comment',
      createdAt: new Date('2026-07-03T12:02:00.000Z'),
      updatedAt: new Date('2026-07-03T12:02:00.000Z')
    });

    await request(app)
      .get(`/api/work-items/${workItem.id}/comments`)
      .set(fixture.headers)
      .expect(200)
      .expect(({ body }) => {
        expect(body.map((comment: { body: string }) => comment.body)).toEqual([
          'First comment',
          'Second comment'
        ]);
        expect(body[1]).toMatchObject({
          author: { id: fixture.contributorId, name: 'Comment Contributor' },
          mentions: []
        });
      });
  });

  it('rejects inactive and cross-workspace comment mentions', async () => {
    const fixture = await createFixture('owner');
    const otherFixture = await createFixture('owner');
    const workItem = await createWorkItem(fixture);

    for (const mentionMemberId of [fixture.inactiveMemberId, otherFixture.actorId]) {
      await request(app)
        .post(`/api/work-items/${workItem.id}/comments`)
        .set(fixture.headers)
        .send({
          body: 'Invalid mention.',
          mentionMemberIds: [mentionMemberId]
        })
        .expect(400)
        .expect(({ body }) => {
          expect(body.error.code).toBe('VALIDATION_ERROR');
          expect(body.error.message).toBe('Mentioned members must be active workspace members.');
        });
    }

    await expect(repositories.comments.findByWorkItem(workItem.id)).resolves.toEqual([]);
  });

  it('keeps legacy comment creation requests compatible without mention IDs', async () => {
    const fixture = await createFixture('owner');
    const workItem = await createWorkItem(fixture);

    await request(app)
      .post(`/api/work-items/${workItem.id}/comments`)
      .set(fixture.headers)
      .send({ body: 'Legacy body-only request.' })
      .expect(201)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          body: 'Legacy body-only request.',
          mentions: []
        });
      });
  });

  it('updates comments for owners and authors and records edit activity without body text', async () => {
    const fixture = await createFixture('owner');
    const workItem = await createWorkItem(fixture);
    const comment = await repositories.comments.create({
      id: randomUUID(),
      workspaceId: fixture.workspaceId,
      projectId: fixture.projectId,
      workItemId: workItem.id,
      authorId: fixture.contributorId,
      body: 'Original body',
      createdAt: now(),
      updatedAt: now()
    });

    await request(app)
      .patch(`/api/comments/${comment.id}`)
      .set(fixture.headers)
      .send({ body: 'Owner edited body.' })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          id: comment.id,
          body: 'Owner edited body.',
          isEdited: true,
          isDeleted: false,
          editedAt: expect.any(String),
          deletedAt: null,
          deletedBy: null
        });
      });

    const authorComment = await repositories.comments.create({
      id: randomUUID(),
      workspaceId: fixture.workspaceId,
      projectId: fixture.projectId,
      workItemId: workItem.id,
      authorId: fixture.contributorId,
      body: 'Contributor body',
      createdAt: now(),
      updatedAt: now()
    });

    await request(app)
      .patch(`/api/comments/${authorComment.id}`)
      .set(fixture.contributorHeaders)
      .send({ body: 'Contributor edited own body.' })
      .expect(200)
      .expect(({ body }) => {
        expect(body.body).toBe('Contributor edited own body.');
      });

    const activity = await repositories.activityEvents.findByWorkItem(workItem.id);
    const editedEvents = activity.filter((event) => event.eventType === 'comment.edited');
    expect(editedEvents).toHaveLength(2);
    expect(editedEvents[0]).toMatchObject({
      previousValue: null,
      newValue: null,
      metadata: { commentId: expect.any(String) }
    });
    expect(JSON.stringify(editedEvents)).not.toContain('Owner edited body.');
    expect(JSON.stringify(editedEvents)).not.toContain('Original body');
  });

  it('rejects contributor edits to other members comments', async () => {
    const fixture = await createFixture('owner');
    const workItem = await createWorkItem(fixture);
    const comment = await repositories.comments.create({
      id: randomUUID(),
      workspaceId: fixture.workspaceId,
      projectId: fixture.projectId,
      workItemId: workItem.id,
      authorId: fixture.actorId,
      body: 'Owner-authored comment',
      createdAt: now(),
      updatedAt: now()
    });

    await request(app)
      .patch(`/api/comments/${comment.id}`)
      .set(fixture.contributorHeaders)
      .send({ body: 'Unauthorized edit.' })
      .expect(403)
      .expect(({ body }) => {
        expect(body.error.code).toBe('FORBIDDEN');
      });
  });

  it('soft-deletes comments as tombstones and rejects repeated lifecycle writes', async () => {
    const fixture = await createFixture('maintainer');
    const workItem = await createWorkItem(fixture);
    const comment = await repositories.comments.create({
      id: randomUUID(),
      workspaceId: fixture.workspaceId,
      projectId: fixture.projectId,
      workItemId: workItem.id,
      authorId: fixture.contributorId,
      body: 'Sensitive body that should be hidden',
      createdAt: now(),
      updatedAt: now()
    });

    await request(app)
      .delete(`/api/comments/${comment.id}`)
      .set(fixture.headers)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          id: comment.id,
          body: '',
          isDeleted: true,
          isEdited: false,
          deletedAt: expect.any(String),
          deletedBy: { id: fixture.actorId }
        });
      });

    await request(app)
      .get(`/api/work-items/${workItem.id}/comments`)
      .set(fixture.headers)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual([
          expect.objectContaining({
            id: comment.id,
            body: '',
            isDeleted: true,
            deletedBy: expect.objectContaining({ id: fixture.actorId })
          })
        ]);
      });

    await request(app)
      .patch(`/api/comments/${comment.id}`)
      .set(fixture.headers)
      .send({ body: 'Should not edit deleted comment.' })
      .expect(409)
      .expect(({ body }) => {
        expect(body.error.code).toBe('CONFLICT');
      });

    await request(app)
      .delete(`/api/comments/${comment.id}`)
      .set(fixture.headers)
      .expect(409)
      .expect(({ body }) => {
        expect(body.error.code).toBe('CONFLICT');
      });

    const activity = await repositories.activityEvents.findByWorkItem(workItem.id);
    const deletedEvent = activity.find((event) => event.eventType === 'comment.deleted');
    expect(deletedEvent).toMatchObject({
      previousValue: null,
      newValue: null,
      metadata: { commentId: comment.id }
    });
    expect(JSON.stringify(deletedEvent)).not.toContain('Sensitive body');
  });

  it('returns comments and activity on work item detail', async () => {
    const fixture = await createFixture('owner');
    const workItem = await createWorkItem(fixture);
    const comment = await repositories.comments.create({
      id: randomUUID(),
      workspaceId: fixture.workspaceId,
      projectId: fixture.projectId,
      workItemId: workItem.id,
      authorId: fixture.actorId,
      body: 'Detail page comment',
      createdAt: now(),
      updatedAt: now()
    });
    await repositories.activityEvents.create({
      id: randomUUID(),
      workspaceId: fixture.workspaceId,
      projectId: fixture.projectId,
      workItemId: workItem.id,
      actorId: fixture.actorId,
      eventType: 'comment.added',
      summary: 'Comment added.',
      previousValue: null,
      newValue: null,
      metadata: { commentId: comment.id },
      createdAt: now()
    });

    await request(app)
      .get(`/api/work-items/${workItem.id}`)
      .set(fixture.headers)
      .expect(200)
      .expect(({ body }) => {
        expect(body.comments).toEqual([
          expect.objectContaining({
            id: comment.id,
            body: 'Detail page comment',
            author: expect.objectContaining({ id: fixture.actorId })
          })
        ]);
        expect(body.activity).toEqual([
          expect.objectContaining({
            eventType: 'comment.added',
            actor: expect.objectContaining({ id: fixture.actorId }),
            metadata: { commentId: comment.id }
          })
        ]);
      });
  });

  it('returns work item and project activity timelines', async () => {
    const fixture = await createFixture('owner');
    const workItem = await createWorkItem(fixture);
    const eventId = randomUUID();

    await repositories.activityEvents.create({
      id: eventId,
      workspaceId: fixture.workspaceId,
      projectId: fixture.projectId,
      workItemId: workItem.id,
      actorId: fixture.actorId,
      eventType: 'work_item.created',
      summary: 'Work item created.',
      previousValue: null,
      newValue: { status: 'ready' },
      metadata: {},
      createdAt: now()
    });

    for (const path of [
      `/api/work-items/${workItem.id}/activity`,
      `/api/projects/${fixture.projectId}/activity`
    ]) {
      await request(app)
        .get(path)
        .set(fixture.headers)
        .expect(200)
        .expect(({ body }) => {
          expect(body).toEqual([
            expect.objectContaining({
              id: eventId,
              eventType: 'work_item.created',
              actor: expect.objectContaining({ id: fixture.actorId }),
              newValue: { status: 'ready' }
            })
          ]);
        });
    }
  });

  it('rejects empty comments and scopes comment reads to the actor workspace', async () => {
    const fixture = await createFixture('owner');
    const otherFixture = await createFixture('owner');
    const workItem = await createWorkItem(fixture);

    await request(app)
      .post(`/api/work-items/${workItem.id}/comments`)
      .set(fixture.headers)
      .send({ body: '   ' })
      .expect(400)
      .expect(({ body }) => {
        expect(body.error.code).toBe('VALIDATION_ERROR');
      });

    await request(app).get(`/api/work-items/${workItem.id}/comments`).set(otherFixture.headers).expect(404);
    await request(app).get(`/api/work-items/${workItem.id}/activity`).set(otherFixture.headers).expect(404);
  });

  it('rejects comment writes under archived projects', async () => {
    const fixture = await createFixture('owner');
    const workItem = await createWorkItem(fixture);
    const comment = await repositories.comments.create({
      id: randomUUID(),
      workspaceId: fixture.workspaceId,
      projectId: fixture.projectId,
      workItemId: workItem.id,
      authorId: fixture.actorId,
      body: 'Archived project comment',
      createdAt: now(),
      updatedAt: now()
    });

    await repositories.projects.update(fixture.projectId, {
      status: 'archived',
      updatedAt: now()
    });

    await request(app)
      .post(`/api/work-items/${workItem.id}/comments`)
      .set(fixture.headers)
      .send({ body: 'Should not be added.' })
      .expect(409)
      .expect(({ body }) => {
        expect(body.error.code).toBe('CONFLICT');
      });

    await request(app)
      .patch(`/api/comments/${comment.id}`)
      .set(fixture.headers)
      .send({ body: 'Should not be edited.' })
      .expect(409)
      .expect(({ body }) => {
        expect(body.error.code).toBe('CONFLICT');
      });

    await request(app)
      .delete(`/api/comments/${comment.id}`)
      .set(fixture.headers)
      .expect(409)
      .expect(({ body }) => {
        expect(body.error.code).toBe('CONFLICT');
      });
  });
});
