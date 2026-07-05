import { randomUUID } from 'node:crypto';

import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { createExpressApp } from '../src/adapters/express/server.js';
import { createDb, createPool } from '../src/db/client.js';
import { createRepositories, type Repositories } from '../src/repositories/index.js';

const workspaceIds = new Set<string>();
let pool: ReturnType<typeof createPool>;
let db: ReturnType<typeof createDb>;
let repositories: Repositories;
let app: ReturnType<typeof createExpressApp>;

function now() {
  return new Date('2026-07-05T12:00:00.000Z');
}

function actorHeaders(input: { workspaceId: string; memberId: string }) {
  return {
    'x-worktrail-workspace-id': input.workspaceId,
    'x-worktrail-member-id': input.memberId
  };
}

async function cleanupWorkspace(workspaceId: string) {
  await pool.query('delete from notifications where workspace_id = $1', [workspaceId]);
  await pool.query('delete from comment_mentions where workspace_id = $1', [workspaceId]);
  await pool.query('delete from activity_events where workspace_id = $1', [workspaceId]);
  await pool.query('delete from comments where workspace_id = $1', [workspaceId]);
  await pool.query('delete from work_item_watchers where workspace_id = $1', [workspaceId]);
  await pool.query('delete from work_item_relationships where workspace_id = $1', [workspaceId]);
  await pool.query(
    'delete from work_item_labels where work_item_id in (select id from work_items where workspace_id = $1)',
    [workspaceId]
  );
  await pool.query('delete from labels where workspace_id = $1', [workspaceId]);
  await pool.query('delete from work_items where workspace_id = $1', [workspaceId]);
  await pool.query('delete from milestones where workspace_id = $1', [workspaceId]);
  await pool.query('delete from projects where workspace_id = $1', [workspaceId]);
  await pool.query('delete from members where workspace_id = $1', [workspaceId]);
  await pool.query('delete from workspaces where id = $1', [workspaceId]);
}

async function cleanupAllWorkspaces() {
  for (const workspaceId of workspaceIds) {
    await cleanupWorkspace(workspaceId);
  }
  workspaceIds.clear();
}

async function createFixture() {
  const timestamp = now();
  const workspaceId = randomUUID();
  const actorId = randomUUID();
  const otherMemberId = randomUUID();
  const projectId = randomUUID();
  const workItemId = randomUUID();
  const activityEventId = randomUUID();
  workspaceIds.add(workspaceId);

  await repositories.workspaces.create({
    id: workspaceId,
    name: 'Notifications Test Workspace',
    createdAt: timestamp,
    updatedAt: timestamp
  });

  await repositories.members.create({
    id: actorId,
    workspaceId,
    name: 'Notifications Actor',
    email: `${actorId}@example.com`,
    role: 'owner',
    isActive: true,
    createdAt: timestamp,
    updatedAt: timestamp
  });

  await repositories.members.create({
    id: otherMemberId,
    workspaceId,
    name: 'Notifications Other Actor',
    email: `${otherMemberId}@example.com`,
    role: 'maintainer',
    isActive: true,
    createdAt: timestamp,
    updatedAt: timestamp
  });

  await repositories.projects.create({
    id: projectId,
    workspaceId,
    key: 'NTF',
    nextWorkItemNumber: 2,
    name: 'Notifications Project',
    description: 'Project for notification endpoint tests.',
    status: 'active',
    createdAt: timestamp,
    updatedAt: timestamp
  });

  await repositories.workItems.create({
    id: workItemId,
    workspaceId,
    projectId,
    itemNumber: 1,
    displayKey: 'NTF-1',
    title: 'Route relevant updates to people',
    description: 'Created by notification endpoint tests.',
    type: 'task',
    status: 'ready',
    priority: 'high',
    assigneeId: otherMemberId,
    reporterId: actorId,
    dueDate: null,
    estimatePoints: null,
    createdAt: timestamp,
    updatedAt: timestamp
  });

  await repositories.activityEvents.create({
    id: activityEventId,
    workspaceId,
    projectId,
    workItemId,
    actorId,
    eventType: 'work_item.created',
    summary: 'Notifications Actor created this work item.',
    previousValue: null,
    newValue: null,
    metadata: {},
    createdAt: timestamp
  });

  return {
    workspaceId,
    actorId,
    otherMemberId,
    projectId,
    workItemId,
    activityEventId,
    headers: actorHeaders({ workspaceId, memberId: actorId }),
    otherHeaders: actorHeaders({ workspaceId, memberId: otherMemberId })
  };
}

beforeAll(() => {
  pool = createPool();
  db = createDb(pool);
  repositories = createRepositories(db);
  app = createExpressApp({ repositories, db });
});

afterEach(async () => {
  await cleanupAllWorkspaces();
});

afterAll(async () => {
  await cleanupAllWorkspaces();
  await pool.end();
});

describe('notification API', () => {
  it('lists current actor notifications and updates read state', async () => {
    const fixture = await createFixture();
    const timestamp = now();
    const actorNotification = await repositories.notifications.create({
      id: randomUUID(),
      workspaceId: fixture.workspaceId,
      recipientMemberId: fixture.actorId,
      actorMemberId: fixture.otherMemberId,
      projectId: fixture.projectId,
      workItemId: fixture.workItemId,
      activityEventId: fixture.activityEventId,
      notificationType: 'mention',
      summary: 'Notifications Other Actor mentioned you on NTF-1.',
      metadata: { commentId: 'comment-id' },
      sourceEventKey: `test:${fixture.workItemId}:mention`,
      readAt: null,
      createdAt: timestamp
    });
    await repositories.notifications.create({
      id: randomUUID(),
      workspaceId: fixture.workspaceId,
      recipientMemberId: fixture.otherMemberId,
      actorMemberId: fixture.actorId,
      projectId: fixture.projectId,
      workItemId: fixture.workItemId,
      activityEventId: null,
      notificationType: 'assignment',
      summary: 'NTF-1 was assigned to you.',
      metadata: {},
      sourceEventKey: `test:${fixture.workItemId}:assignment`,
      readAt: null,
      createdAt: timestamp
    });

    await request(app)
      .get('/api/notifications')
      .set(fixture.headers)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          unreadCount: 1,
          items: [
            {
              id: actorNotification.id,
              type: 'mention',
              summary: 'Notifications Other Actor mentioned you on NTF-1.',
              actor: { id: fixture.otherMemberId, name: 'Notifications Other Actor' },
              project: { id: fixture.projectId, key: 'NTF', name: 'Notifications Project' },
              workItem: {
                id: fixture.workItemId,
                displayKey: 'NTF-1',
                title: 'Route relevant updates to people',
                status: 'ready'
              },
              metadata: { commentId: 'comment-id' },
              readAt: null,
              createdAt: expect.any(String)
            }
          ]
        });
      });

    await request(app)
      .get('/api/notifications/unread-count')
      .set(fixture.headers)
      .expect(200, { unreadCount: 1 });

    await request(app)
      .patch(`/api/notifications/${actorNotification.id}`)
      .set(fixture.otherHeaders)
      .send({ read: true })
      .expect(404);

    await request(app)
      .patch(`/api/notifications/${actorNotification.id}`)
      .set(fixture.headers)
      .send({ read: true })
      .expect(200)
      .expect(({ body }) => {
        expect(body.id).toBe(actorNotification.id);
        expect(body.readAt).toEqual(expect.any(String));
      });

    await request(app)
      .get('/api/notifications')
      .set(fixture.headers)
      .expect(200)
      .expect(({ body }) => {
        expect(body.unreadCount).toBe(0);
        expect(body.items).toEqual([]);
      });

    await request(app)
      .get('/api/notifications')
      .query({ state: 'all' })
      .set(fixture.headers)
      .expect(200)
      .expect(({ body }) => {
        expect(body.items).toHaveLength(1);
        expect(body.items[0].id).toBe(actorNotification.id);
      });

    await request(app)
      .patch(`/api/notifications/${actorNotification.id}`)
      .set(fixture.headers)
      .send({ read: false })
      .expect(200)
      .expect(({ body }) => {
        expect(body.readAt).toBeNull();
      });

    await request(app)
      .post('/api/notifications/mark-all-read')
      .set(fixture.headers)
      .expect(200, { unreadCount: 0 });

    await request(app)
      .get('/api/notifications/unread-count')
      .set(fixture.otherHeaders)
      .expect(200, { unreadCount: 1 });
  });
});

describe('work item watcher API', () => {
  it('watches and unwatches work items for the current actor', async () => {
    const fixture = await createFixture();

    await request(app)
      .get(`/api/work-items/${fixture.workItemId}/watchers`)
      .set(fixture.headers)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({
          isWatchedByCurrentActor: false,
          watcherCount: 0,
          watchers: []
        });
      });

    await request(app)
      .put(`/api/work-items/${fixture.workItemId}/watch`)
      .set(fixture.headers)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          isWatchedByCurrentActor: true,
          watcherCount: 1,
          watchers: [{ member: { id: fixture.actorId, name: 'Notifications Actor' } }]
        });
      });

    await request(app)
      .put(`/api/work-items/${fixture.workItemId}/watch`)
      .set(fixture.headers)
      .expect(200)
      .expect(({ body }) => {
        expect(body.watcherCount).toBe(1);
      });

    await request(app)
      .put(`/api/work-items/${fixture.workItemId}/watch`)
      .set(fixture.otherHeaders)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          isWatchedByCurrentActor: true,
          watcherCount: 2
        });
      });

    await request(app)
      .delete(`/api/work-items/${fixture.workItemId}/watch`)
      .set(fixture.headers)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          isWatchedByCurrentActor: false,
          watcherCount: 1,
          watchers: [{ member: { id: fixture.otherMemberId } }]
        });
      });
  });

  it('rejects watch changes for archived project work', async () => {
    const fixture = await createFixture();
    await repositories.projects.updateStatus(fixture.projectId, 'archived', now());

    await request(app)
      .get(`/api/work-items/${fixture.workItemId}/watchers`)
      .set(fixture.headers)
      .expect(200);

    await request(app)
      .put(`/api/work-items/${fixture.workItemId}/watch`)
      .set(fixture.headers)
      .expect(409)
      .expect(({ body }) => {
        expect(body.error).toEqual({
          code: 'CONFLICT',
          message: 'Archived projects are read-only.'
        });
      });
  });
});
