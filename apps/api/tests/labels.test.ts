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
  await pool.query('delete from activity_events where workspace_id = $1', [workspaceId]);
  await pool.query('delete from comments where workspace_id = $1', [workspaceId]);
  await pool.query(
    'delete from work_item_labels where work_item_id in (select id from work_items where workspace_id = $1)',
    [workspaceId]
  );
  await pool.query('delete from labels where workspace_id = $1', [workspaceId]);
  await pool.query('delete from work_items where workspace_id = $1', [workspaceId]);
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

async function createFixture(role: 'owner' | 'maintainer' | 'contributor' = 'owner') {
  const timestamp = now();
  const workspaceId = randomUUID();
  const actorId = randomUUID();
  const projectId = randomUUID();
  workspaceIds.add(workspaceId);

  await repositories.workspaces.create({
    id: workspaceId,
    name: 'Label Test Workspace',
    createdAt: timestamp,
    updatedAt: timestamp
  });

  await repositories.members.create({
    id: actorId,
    workspaceId,
    name: 'Label API Actor',
    email: `${actorId}@example.com`,
    role,
    isActive: true,
    createdAt: timestamp,
    updatedAt: timestamp
  });

  await repositories.projects.create({
    id: projectId,
    workspaceId,
    key: 'LB',
    nextWorkItemNumber: 2,
    name: 'Label Test Project',
    description: 'Project for label endpoint tests.',
    status: 'active',
    createdAt: timestamp,
    updatedAt: timestamp
  });

  return {
    workspaceId,
    actorId,
    projectId,
    headers: actorHeaders({ workspaceId, memberId: actorId, role })
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

describe('labels API', () => {
  it('lists active labels by default and archived labels when requested', async () => {
    const fixture = await createFixture();
    const activeLabel = await repositories.labels.create({
      id: randomUUID(),
      workspaceId: fixture.workspaceId,
      projectId: fixture.projectId,
      name: 'backend',
      color: '#059669',
      archivedAt: null,
      archivedById: null,
      createdAt: now(),
      updatedAt: now()
    });
    const archivedLabel = await repositories.labels.create({
      id: randomUUID(),
      workspaceId: fixture.workspaceId,
      projectId: fixture.projectId,
      name: 'deprecated',
      color: '#64748b',
      archivedAt: now(),
      archivedById: fixture.actorId,
      createdAt: now(),
      updatedAt: now()
    });

    await request(app)
      .get(`/api/projects/${fixture.projectId}/labels`)
      .set(fixture.headers)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual([
          {
            id: activeLabel.id,
            name: 'backend',
            color: '#059669',
            isArchived: false,
            archivedAt: null
          }
        ]);
      });

    await request(app)
      .get(`/api/projects/${fixture.projectId}/labels`)
      .query({ includeArchived: 'true' })
      .set(fixture.headers)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ id: activeLabel.id, isArchived: false }),
            expect.objectContaining({ id: archivedLabel.id, isArchived: true })
          ])
        );
      });
  });

  it('creates, updates, archives, and reactivates labels with activity', async () => {
    const fixture = await createFixture();

    const createResponse = await request(app)
      .post(`/api/projects/${fixture.projectId}/labels`)
      .set(fixture.headers)
      .send({ name: 'backend', color: '#059669' })
      .expect(201);

    expect(createResponse.body).toMatchObject({
      name: 'backend',
      color: '#059669',
      isArchived: false,
      archivedAt: null
    });

    await request(app)
      .patch(`/api/labels/${createResponse.body.id}`)
      .set(fixture.headers)
      .send({ name: 'api', color: null })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({ name: 'api', color: null });
      });

    await request(app)
      .post(`/api/labels/${createResponse.body.id}/archive`)
      .set(fixture.headers)
      .expect(200)
      .expect(({ body }) => {
        expect(body.isArchived).toBe(true);
        expect(body.archivedAt).toEqual(expect.any(String));
      });

    await request(app)
      .get(`/api/projects/${fixture.projectId}/labels`)
      .set(fixture.headers)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual([]);
      });

    await request(app)
      .post(`/api/labels/${createResponse.body.id}/reactivate`)
      .set(fixture.headers)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({ name: 'api', isArchived: false, archivedAt: null });
      });

    const activity = await repositories.activityEvents.findByProject(fixture.projectId);
    expect(activity.map((event) => event.eventType)).toEqual(
      expect.arrayContaining([
        'label.created',
        'label.name_changed',
        'label.color_changed',
        'label.archived',
        'label.reactivated'
      ])
    );
  });

  it('rejects duplicate active label names and reactivation conflicts', async () => {
    const fixture = await createFixture();

    const archivedLabel = await repositories.labels.create({
      id: randomUUID(),
      workspaceId: fixture.workspaceId,
      projectId: fixture.projectId,
      name: 'backend',
      color: '#64748b',
      archivedAt: now(),
      archivedById: fixture.actorId,
      createdAt: now(),
      updatedAt: now()
    });

    await request(app)
      .post(`/api/projects/${fixture.projectId}/labels`)
      .set(fixture.headers)
      .send({ name: 'Backend', color: '#059669' })
      .expect(201);

    await request(app)
      .post(`/api/projects/${fixture.projectId}/labels`)
      .set(fixture.headers)
      .send({ name: 'backend', color: '#2563eb' })
      .expect(409)
      .expect(({ body }) => {
        expect(body.error.code).toBe('CONFLICT');
      });

    await request(app)
      .post(`/api/labels/${archivedLabel.id}/reactivate`)
      .set(fixture.headers)
      .expect(409)
      .expect(({ body }) => {
        expect(body.error.code).toBe('CONFLICT');
      });
  });

  it('rejects label writes under archived projects', async () => {
    const fixture = await createFixture();
    const label = await repositories.labels.create({
      id: randomUUID(),
      workspaceId: fixture.workspaceId,
      projectId: fixture.projectId,
      name: 'backend',
      color: '#059669',
      archivedAt: null,
      archivedById: null,
      createdAt: now(),
      updatedAt: now()
    });

    await repositories.projects.update(fixture.projectId, {
      status: 'archived',
      updatedAt: now()
    });

    await request(app)
      .post(`/api/projects/${fixture.projectId}/labels`)
      .set(fixture.headers)
      .send({ name: 'frontend', color: '#2563eb' })
      .expect(409);

    await request(app)
      .patch(`/api/labels/${label.id}`)
      .set(fixture.headers)
      .send({ name: 'api' })
      .expect(409);

    await request(app).post(`/api/labels/${label.id}/archive`).set(fixture.headers).expect(409);
  });

  it('keeps archived labels attached but rejects archived label assignment', async () => {
    const fixture = await createFixture();
    const label = await repositories.labels.create({
      id: randomUUID(),
      workspaceId: fixture.workspaceId,
      projectId: fixture.projectId,
      name: 'legacy',
      color: '#64748b',
      archivedAt: null,
      archivedById: null,
      createdAt: now(),
      updatedAt: now()
    });
    const workItem = await repositories.workItems.create({
      id: randomUUID(),
      workspaceId: fixture.workspaceId,
      projectId: fixture.projectId,
      itemNumber: 1,
      displayKey: 'LB-1',
      title: 'Existing labeled work item',
      description: '',
      type: 'task',
      status: 'ready',
      priority: 'medium',
      assigneeId: fixture.actorId,
      reporterId: fixture.actorId,
      dueDate: null,
      estimatePoints: null,
      createdAt: now(),
      updatedAt: now()
    });

    await repositories.labels.replaceForWorkItem(workItem.id, [label.id]);

    await request(app).post(`/api/labels/${label.id}/archive`).set(fixture.headers).expect(200);

    await request(app)
      .get(`/api/work-items/${workItem.id}`)
      .set(fixture.headers)
      .expect(200)
      .expect(({ body }) => {
        expect(body.labels).toEqual([
          expect.objectContaining({
            id: label.id,
            name: 'legacy',
            isArchived: true
          })
        ]);
      });

    await request(app)
      .post(`/api/projects/${fixture.projectId}/work-items`)
      .set(fixture.headers)
      .send({
        title: 'Rejected archived label assignment',
        type: 'task',
        priority: 'medium',
        labelIds: [label.id]
      })
      .expect(400)
      .expect(({ body }) => {
        expect(body.error.code).toBe('VALIDATION_ERROR');
      });
  });
});
