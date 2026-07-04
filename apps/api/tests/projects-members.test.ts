import { randomUUID } from 'node:crypto';

import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { createExpressApp } from '../src/adapters/express/server.js';
import { createDb, createPool } from '../src/db/client.js';
import { createRepositories, type Repositories } from '../src/repositories/index.js';
import type { NewProject } from '../src/repositories/types.js';

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

async function createWorkspaceFixture(role: 'owner' | 'maintainer' | 'contributor' = 'owner') {
  const timestamp = now();
  const workspaceId = randomUUID();
  const actorId = randomUUID();
  const maintainerId = randomUUID();
  const contributorId = randomUUID();
  workspaceIds.add(workspaceId);

  await repositories.workspaces.create({
    id: workspaceId,
    name: 'Phase 5 Test Workspace',
    createdAt: timestamp,
    updatedAt: timestamp
  });

  await repositories.members.create({
    id: actorId,
    workspaceId,
    name: 'API Actor',
    email: `${actorId}@example.com`,
    role,
    isActive: true,
    createdAt: timestamp,
    updatedAt: timestamp
  });

  await repositories.members.create({
    id: maintainerId,
    workspaceId,
    name: 'API Maintainer',
    email: `${maintainerId}@example.com`,
    role: 'maintainer',
    isActive: true,
    createdAt: timestamp,
    updatedAt: timestamp
  });

  await repositories.members.create({
    id: contributorId,
    workspaceId,
    name: 'API Contributor',
    email: `${contributorId}@example.com`,
    role: 'contributor',
    isActive: true,
    createdAt: timestamp,
    updatedAt: timestamp
  });

  return {
    workspaceId,
    actorId,
    maintainerId,
    contributorId,
    headers: actorHeaders({ workspaceId, memberId: actorId, role })
  };
}

async function createProject(input: Partial<NewProject> & { workspaceId: string }) {
  const timestamp = now();
  return repositories.projects.create({
    id: input.id ?? randomUUID(),
    workspaceId: input.workspaceId,
    key: input.key ?? 'PM',
    nextWorkItemNumber: input.nextWorkItemNumber ?? 3,
    name: input.name ?? 'API Test Project',
    description: input.description ?? 'Created for endpoint tests.',
    status: input.status ?? 'active',
    createdAt: input.createdAt ?? timestamp,
    updatedAt: input.updatedAt ?? timestamp
  });
}

beforeAll(() => {
  pool = createPool();
  db = createDb(pool);
  repositories = createRepositories(db);
  app = createExpressApp({ repositories });
});

afterEach(async () => {
  await cleanupAllWorkspaces();
});

afterAll(async () => {
  await cleanupAllWorkspaces();
  await pool.end();
});

describe('members API', () => {
  it('returns workspace members for the current actor workspace', async () => {
    const fixture = await createWorkspaceFixture('owner');

    await request(app)
      .get('/api/members')
      .set(fixture.headers)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toHaveLength(3);
        expect(body).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id: fixture.actorId,
              workspaceId: fixture.workspaceId,
              role: 'owner',
              isActive: true
            })
          ])
        );
      });
  });
});

describe('projects API', () => {
  it('lists projects for the current actor workspace', async () => {
    const fixture = await createWorkspaceFixture('owner');
    const project = await createProject({ workspaceId: fixture.workspaceId });

    await request(app)
      .get('/api/projects')
      .set(fixture.headers)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toHaveLength(1);
        expect(body[0]).toMatchObject({
          id: project.id,
          workspaceId: fixture.workspaceId,
          name: 'API Test Project',
          status: 'active'
        });
        expect(body[0].createdAt).toBe('2026-07-03T12:00:00.000Z');
      });
  });

  it('creates a project with validation and actor workspace scoping', async () => {
    const fixture = await createWorkspaceFixture('owner');

    await request(app)
      .post('/api/projects')
      .set(fixture.headers)
      .send({ name: 'Created Through API', description: 'Created by endpoint test.' })
      .expect(201)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          workspaceId: fixture.workspaceId,
          name: 'Created Through API',
          description: 'Created by endpoint test.',
          status: 'active'
        });
      });

    const projects = await repositories.projects.listByWorkspace(fixture.workspaceId);
    expect(projects.map((project) => project.name)).toContain('Created Through API');
  });

  it('rejects invalid project creation requests', async () => {
    const fixture = await createWorkspaceFixture('owner');

    await request(app)
      .post('/api/projects')
      .set(fixture.headers)
      .send({ name: '' })
      .expect(400)
      .expect(({ body }) => {
        expect(body.error.code).toBe('VALIDATION_ERROR');
      });
  });

  it('returns project detail and 404s across workspace boundaries', async () => {
    const fixture = await createWorkspaceFixture('owner');
    const otherFixture = await createWorkspaceFixture('owner');
    const project = await createProject({ workspaceId: fixture.workspaceId });

    await request(app)
      .get(`/api/projects/${project.id}`)
      .set(fixture.headers)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({ id: project.id, workspaceId: fixture.workspaceId });
      });

    await request(app).get(`/api/projects/${project.id}`).set(otherFixture.headers).expect(404);
  });

  it('allows maintainers to archive and reactivate projects', async () => {
    const fixture = await createWorkspaceFixture('maintainer');
    const project = await createProject({ workspaceId: fixture.workspaceId });

    await request(app)
      .patch(`/api/projects/${project.id}`)
      .set(fixture.headers)
      .send({ status: 'archived' })
      .expect(200)
      .expect(({ body }) => {
        expect(body.status).toBe('archived');
      });

    await request(app)
      .patch(`/api/projects/${project.id}`)
      .set(fixture.headers)
      .send({ status: 'active' })
      .expect(200)
      .expect(({ body }) => {
        expect(body.status).toBe('active');
      });
  });

  it('rejects contributor project archive requests', async () => {
    const fixture = await createWorkspaceFixture('contributor');
    const project = await createProject({ workspaceId: fixture.workspaceId });

    await request(app)
      .patch(`/api/projects/${project.id}`)
      .set(fixture.headers)
      .send({ status: 'archived' })
      .expect(403)
      .expect(({ body }) => {
        expect(body.error.code).toBe('FORBIDDEN');
      });
  });

  it('returns project summary with status counts and recent work items', async () => {
    const fixture = await createWorkspaceFixture('owner');
    const project = await createProject({ workspaceId: fixture.workspaceId });
    const timestamp = now();

    await repositories.workItems.create({
      id: randomUUID(),
      workspaceId: fixture.workspaceId,
      projectId: project.id,
      itemNumber: 1,
      displayKey: 'PM-1',
      title: 'Ready summary item',
      description: '',
      type: 'task',
      status: 'ready',
      priority: 'high',
      assigneeId: fixture.actorId,
      reporterId: fixture.actorId,
      dueDate: null,
      estimatePoints: null,
      createdAt: timestamp,
      updatedAt: new Date('2026-07-03T12:05:00.000Z')
    });
    await repositories.workItems.create({
      id: randomUUID(),
      workspaceId: fixture.workspaceId,
      projectId: project.id,
      itemNumber: 2,
      displayKey: 'PM-2',
      title: 'Done summary item',
      description: '',
      type: 'task',
      status: 'done',
      priority: 'medium',
      assigneeId: fixture.actorId,
      reporterId: fixture.actorId,
      dueDate: null,
      estimatePoints: null,
      createdAt: timestamp,
      updatedAt: new Date('2026-07-03T12:10:00.000Z')
    });

    await request(app)
      .get(`/api/projects/${project.id}/summary`)
      .set(fixture.headers)
      .expect(200)
      .expect(({ body }) => {
        expect(body.project.id).toBe(project.id);
        expect(body.countsByStatus).toEqual(
          expect.arrayContaining([
            { status: 'ready', count: 1 },
            { status: 'done', count: 1 },
            { status: 'backlog', count: 0 }
          ])
        );
        expect(body.recentWorkItems[0]).toMatchObject({
          title: 'Done summary item',
          status: 'done'
        });
      });
  });

  it('returns project labels scoped to the actor workspace', async () => {
    const fixture = await createWorkspaceFixture('owner');
    const otherFixture = await createWorkspaceFixture('owner');
    const project = await createProject({ workspaceId: fixture.workspaceId });

    await repositories.labels.create({
      id: randomUUID(),
      workspaceId: fixture.workspaceId,
      projectId: project.id,
      name: 'backend',
      color: '#059669',
      createdAt: now(),
      updatedAt: now()
    });

    await request(app)
      .get(`/api/projects/${project.id}/labels`)
      .set(fixture.headers)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual([
          {
            id: expect.any(String),
            name: 'backend',
            color: '#059669',
            isArchived: false,
            archivedAt: null
          }
        ]);
      });

    await request(app).get(`/api/projects/${project.id}/labels`).set(otherFixture.headers).expect(404);
  });
});
