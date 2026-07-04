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

async function createFixture(role: 'owner' | 'maintainer' | 'contributor' = 'owner') {
  const timestamp = now();
  const workspaceId = randomUUID();
  const actorId = randomUUID();
  const maintainerId = randomUUID();
  const contributorId = randomUUID();
  const projectId = randomUUID();
  const frontendLabelId = randomUUID();
  const backendLabelId = randomUUID();
  workspaceIds.add(workspaceId);

  await repositories.workspaces.create({
    id: workspaceId,
    name: 'Work Item Test Workspace',
    createdAt: timestamp,
    updatedAt: timestamp
  });

  for (const member of [
    { id: actorId, role, name: 'API Actor' },
    { id: maintainerId, role: 'maintainer' as const, name: 'API Maintainer' },
    { id: contributorId, role: 'contributor' as const, name: 'API Contributor' }
  ]) {
    await repositories.members.create({
      id: member.id,
      workspaceId,
      name: member.name,
      email: `${member.id}@example.com`,
      role: member.role,
      isActive: true,
      createdAt: timestamp,
      updatedAt: timestamp
    });
  }

  await repositories.projects.create({
    id: projectId,
    workspaceId,
    key: 'WI',
    nextWorkItemNumber: 2,
    name: 'Work Item Test Project',
    description: 'Project for work item endpoint tests.',
    status: 'active',
    createdAt: timestamp,
    updatedAt: timestamp
  });

  await repositories.labels.create({
    id: frontendLabelId,
    workspaceId,
    projectId,
    name: 'frontend',
    color: '#2563eb',
    createdAt: timestamp,
    updatedAt: timestamp
  });
  await repositories.labels.create({
    id: backendLabelId,
    workspaceId,
    projectId,
    name: 'backend',
    color: '#059669',
    createdAt: timestamp,
    updatedAt: timestamp
  });

  return {
    workspaceId,
    actorId,
    maintainerId,
    contributorId,
    projectId,
    frontendLabelId,
    backendLabelId,
    nextFixtureWorkItemNumber: 1,
    headers: actorHeaders({ workspaceId, memberId: actorId, role })
  };
}

async function createWorkItem(fixture: Awaited<ReturnType<typeof createFixture>>, overrides = {}) {
  const itemNumber = fixture.nextFixtureWorkItemNumber++;

  return repositories.workItems.create({
    id: randomUUID(),
    workspaceId: fixture.workspaceId,
    projectId: fixture.projectId,
    itemNumber,
    displayKey: `WI-${itemNumber}`,
    title: 'Existing work item',
    description: 'Existing description.',
    type: 'task',
    status: 'ready',
    priority: 'medium',
    assigneeId: fixture.contributorId,
    reporterId: fixture.actorId,
    dueDate: null,
    estimatePoints: null,
    createdAt: now(),
    updatedAt: now(),
    ...overrides
  });
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

describe('work item API', () => {
  it('creates work items with labels and records creation activity', async () => {
    const fixture = await createFixture('owner');

    const response = await request(app)
      .post(`/api/projects/${fixture.projectId}/work-items`)
      .set(fixture.headers)
      .send({
        title: 'Create API work item',
        description: 'Created through the work item API.',
        type: 'story',
        priority: 'high',
        assigneeId: fixture.contributorId,
        labelIds: [fixture.frontendLabelId],
        dueDate: '2026-07-12',
        estimatePoints: 5
      })
      .expect(201);

    expect(response.body).toMatchObject({
      projectId: fixture.projectId,
      itemNumber: 2,
      displayKey: 'WI-2',
      title: 'Create API work item',
      type: 'story',
      status: 'backlog',
      priority: 'high',
      assignee: { id: fixture.contributorId },
      reporter: { id: fixture.actorId },
      labels: [{ id: fixture.frontendLabelId, name: 'frontend' }],
      dueDate: '2026-07-12',
      estimatePoints: 5
    });

    const activity = await repositories.activityEvents.findByWorkItem(response.body.id);
    expect(activity).toHaveLength(1);
    expect(activity[0]?.eventType).toBe('work_item.created');

    const secondResponse = await request(app)
      .post(`/api/projects/${fixture.projectId}/work-items`)
      .set(fixture.headers)
      .send({
        title: 'Create second API work item',
        type: 'task',
        priority: 'medium'
      })
      .expect(201);

    expect(secondResponse.body).toMatchObject({
      itemNumber: 3,
      displayKey: 'WI-3',
      title: 'Create second API work item'
    });

    const project = await repositories.projects.findById(fixture.projectId);
    expect(project?.nextWorkItemNumber).toBe(4);
  });

  it('keeps display keys stable after project metadata changes', async () => {
    const fixture = await createFixture('owner');
    const workItem = await createWorkItem(fixture);

    await request(app)
      .patch(`/api/projects/${fixture.projectId}`)
      .set(fixture.headers)
      .send({
        name: 'Renamed Work Item Test Project',
        description: 'Project metadata changed after work item creation.'
      })
      .expect(200);

    await request(app)
      .get(`/api/work-items/${workItem.id}`)
      .set(fixture.headers)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          itemNumber: 1,
          displayKey: 'WI-1'
        });
      });
  });

  it('rejects invalid work item creation requests', async () => {
    const fixture = await createFixture('owner');

    await request(app)
      .post(`/api/projects/${fixture.projectId}/work-items`)
      .set(fixture.headers)
      .send({ title: '', type: 'task', priority: 'high' })
      .expect(400)
      .expect(({ body }) => {
        expect(body.error.code).toBe('VALIDATION_ERROR');
      });
  });

  it('rejects work item creation under archived projects', async () => {
    const fixture = await createFixture('owner');
    await repositories.projects.update(fixture.projectId, {
      status: 'archived',
      updatedAt: now()
    });

    await request(app)
      .post(`/api/projects/${fixture.projectId}/work-items`)
      .set(fixture.headers)
      .send({
        title: 'Rejected archived project work item',
        type: 'task',
        priority: 'medium'
      })
      .expect(409)
      .expect(({ body }) => {
        expect(body.error.code).toBe('CONFLICT');
        expect(body.error.message).toBe('Archived projects are read-only.');
      });

    const project = await repositories.projects.findById(fixture.projectId);
    expect(project?.nextWorkItemNumber).toBe(2);
  });

  it('lists and filters project work items', async () => {
    const fixture = await createFixture('owner');
    const ready = await createWorkItem(fixture, {
      title: 'Filtered ready work item',
      status: 'ready',
      priority: 'urgent',
      assigneeId: fixture.contributorId
    });
    await repositories.labels.replaceForWorkItem(ready.id, [fixture.frontendLabelId]);
    await createWorkItem(fixture, {
      title: 'Blocked unrelated work item',
      status: 'blocked',
      priority: 'low',
      assigneeId: fixture.maintainerId
    });

    await request(app)
      .get(`/api/projects/${fixture.projectId}/work-items`)
      .query({
        status: 'ready',
        assigneeId: fixture.contributorId,
        type: 'task',
        labelId: fixture.frontendLabelId,
        priority: 'urgent',
        search: 'filtered',
        sort: 'priority_desc'
      })
      .set(fixture.headers)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toHaveLength(1);
        expect(body[0]).toMatchObject({
          id: ready.id,
          title: 'Filtered ready work item',
          labels: [{ id: fixture.frontendLabelId }]
        });
      });
  });

  it('returns work item detail scoped to the actor workspace', async () => {
    const fixture = await createFixture('owner');
    const otherFixture = await createFixture('owner');
    const workItem = await createWorkItem(fixture);
    await repositories.labels.replaceForWorkItem(workItem.id, [fixture.backendLabelId]);

    await request(app)
      .get(`/api/work-items/${workItem.id}`)
      .set(fixture.headers)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          id: workItem.id,
          description: 'Existing description.',
          labels: [{ id: fixture.backendLabelId }]
        });
      });

    await request(app).get(`/api/work-items/${workItem.id}`).set(otherFixture.headers).expect(404);
  });

  it('updates editable fields and records activity', async () => {
    const fixture = await createFixture('owner');
    const workItem = await createWorkItem(fixture, {
      title: 'Before title',
      description: 'Before description.',
      priority: 'medium',
      assigneeId: fixture.contributorId
    });
    await repositories.labels.replaceForWorkItem(workItem.id, [fixture.frontendLabelId]);

    await request(app)
      .patch(`/api/work-items/${workItem.id}`)
      .set(fixture.headers)
      .send({
        title: 'After title',
        description: 'After description.',
        priority: 'urgent',
        assigneeId: fixture.maintainerId,
        labelIds: [fixture.backendLabelId],
        dueDate: '2026-07-20',
        estimatePoints: 8
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          id: workItem.id,
          title: 'After title',
          description: 'After description.',
          priority: 'urgent',
          assignee: { id: fixture.maintainerId },
          labels: [{ id: fixture.backendLabelId }],
          dueDate: '2026-07-20',
          estimatePoints: 8
        });
      });

    const activity = await repositories.activityEvents.findByWorkItem(workItem.id);
    expect(activity.map((event) => event.eventType)).toEqual(
      expect.arrayContaining([
        'work_item.title_changed',
        'work_item.description_changed',
        'work_item.priority_changed',
        'work_item.assignee_changed',
        'work_item.label_added',
        'work_item.label_removed'
      ])
    );
  });

  it('rejects work item updates and label assignment under archived projects', async () => {
    const fixture = await createFixture('owner');
    const workItem = await createWorkItem(fixture);
    await repositories.projects.update(fixture.projectId, {
      status: 'archived',
      updatedAt: now()
    });

    await request(app)
      .patch(`/api/work-items/${workItem.id}`)
      .set(fixture.headers)
      .send({
        title: 'Should not update',
        labelIds: [fixture.backendLabelId]
      })
      .expect(409)
      .expect(({ body }) => {
        expect(body.error.code).toBe('CONFLICT');
        expect(body.error.message).toBe('Archived projects are read-only.');
      });

    const updated = await repositories.workItems.findById(workItem.id);
    expect(updated?.title).toBe('Existing work item');
    expect(await repositories.labels.listByWorkItem(workItem.id)).toHaveLength(0);
  });

  it('transitions work item status and records status activity', async () => {
    const fixture = await createFixture('maintainer');
    const workItem = await createWorkItem(fixture, { status: 'ready' });

    await request(app)
      .post(`/api/work-items/${workItem.id}/transitions`)
      .set(fixture.headers)
      .send({ status: 'in_progress' })
      .expect(200)
      .expect(({ body }) => {
        expect(body.status).toBe('in_progress');
      });

    const activity = await repositories.activityEvents.findByWorkItem(workItem.id);
    expect(activity[0]?.eventType).toBe('work_item.status_changed');
  });

  it('rejects work item transitions under archived projects', async () => {
    const fixture = await createFixture('maintainer');
    const workItem = await createWorkItem(fixture, { status: 'ready' });
    await repositories.projects.update(fixture.projectId, {
      status: 'archived',
      updatedAt: now()
    });

    await request(app)
      .post(`/api/work-items/${workItem.id}/transitions`)
      .set(fixture.headers)
      .send({ status: 'in_progress' })
      .expect(409)
      .expect(({ body }) => {
        expect(body.error.code).toBe('CONFLICT');
        expect(body.error.message).toBe('Archived projects are read-only.');
      });

    const unchanged = await repositories.workItems.findById(workItem.id);
    expect(unchanged?.status).toBe('ready');
  });

  it('rejects invalid status transitions', async () => {
    const fixture = await createFixture('contributor');
    const workItem = await createWorkItem(fixture, { status: 'done' });

    await request(app)
      .post(`/api/work-items/${workItem.id}/transitions`)
      .set(fixture.headers)
      .send({ status: 'ready' })
      .expect(409)
      .expect(({ body }) => {
        expect(body.error.code).toBe('WORKFLOW_TRANSITION_ERROR');
      });
  });
});
