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

async function createFixture(role: 'owner' | 'maintainer' | 'contributor' = 'owner') {
  const timestamp = now();
  const workspaceId = randomUUID();
  const actorId = randomUUID();
  const projectId = randomUUID();
  workspaceIds.add(workspaceId);

  await repositories.workspaces.create({
    id: workspaceId,
    name: 'Milestone Test Workspace',
    createdAt: timestamp,
    updatedAt: timestamp
  });

  await repositories.members.create({
    id: actorId,
    workspaceId,
    name: 'Milestone API Actor',
    email: `${actorId}@example.com`,
    role,
    isActive: true,
    createdAt: timestamp,
    updatedAt: timestamp
  });

  await repositories.projects.create({
    id: projectId,
    workspaceId,
    key: 'MS',
    nextWorkItemNumber: 1,
    name: 'Milestone Test Project',
    description: 'Project for milestone endpoint tests.',
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

describe('milestones API', () => {
  it('lists active milestones by default and supports archived/status filters', async () => {
    const fixture = await createFixture();
    const planned = await repositories.milestones.create({
      id: randomUUID(),
      workspaceId: fixture.workspaceId,
      projectId: fixture.projectId,
      name: 'v0.0.3',
      description: 'Next planning target.',
      status: 'planned',
      targetDate: '2026-07-18',
      archivedAt: null,
      archivedById: null,
      createdAt: now(),
      updatedAt: now()
    });
    const archived = await repositories.milestones.create({
      id: randomUUID(),
      workspaceId: fixture.workspaceId,
      projectId: fixture.projectId,
      name: 'legacy target',
      description: '',
      status: 'canceled',
      targetDate: null,
      archivedAt: now(),
      archivedById: fixture.actorId,
      createdAt: now(),
      updatedAt: now()
    });

    await request(app)
      .get(`/api/projects/${fixture.projectId}/milestones`)
      .set(fixture.headers)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual([
          expect.objectContaining({
            id: planned.id,
            name: 'v0.0.3',
            status: 'planned',
            targetDate: '2026-07-18',
            isArchived: false,
            archivedAt: null
          })
        ]);
      });

    await request(app)
      .get(`/api/projects/${fixture.projectId}/milestones`)
      .query({ includeArchived: 'true', status: 'canceled' })
      .set(fixture.headers)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual([
          expect.objectContaining({
            id: archived.id,
            name: 'legacy target',
            status: 'canceled',
            isArchived: true
          })
        ]);
      });
  });

  it('creates, updates, archives, and reactivates milestones with activity', async () => {
    const fixture = await createFixture('maintainer');

    const createResponse = await request(app)
      .post(`/api/projects/${fixture.projectId}/milestones`)
      .set(fixture.headers)
      .send({
        name: 'v0.0.3',
        description: 'Planning release.',
        status: 'planned',
        targetDate: '2026-07-18'
      })
      .expect(201);

    expect(createResponse.body).toMatchObject({
      name: 'v0.0.3',
      description: 'Planning release.',
      status: 'planned',
      targetDate: '2026-07-18',
      isArchived: false,
      archivedAt: null
    });

    await request(app)
      .patch(`/api/milestones/${createResponse.body.id}`)
      .set(fixture.headers)
      .send({
        name: 'v0.0.3 Planning',
        description: 'Planning and ordering release.',
        status: 'active',
        targetDate: '2026-07-19'
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          name: 'v0.0.3 Planning',
          description: 'Planning and ordering release.',
          status: 'active',
          targetDate: '2026-07-19'
        });
      });

    await request(app)
      .post(`/api/milestones/${createResponse.body.id}/archive`)
      .set(fixture.headers)
      .expect(200)
      .expect(({ body }) => {
        expect(body.isArchived).toBe(true);
        expect(body.archivedAt).toEqual(expect.any(String));
      });

    await request(app)
      .post(`/api/milestones/${createResponse.body.id}/reactivate`)
      .set(fixture.headers)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          name: 'v0.0.3 Planning',
          isArchived: false,
          archivedAt: null
        });
      });

    const activity = await repositories.activityEvents.findByProject(fixture.projectId);
    expect(activity.map((event) => event.eventType)).toEqual(
      expect.arrayContaining([
        'milestone.created',
        'milestone.name_changed',
        'milestone.description_changed',
        'milestone.status_changed',
        'milestone.target_date_changed',
        'milestone.archived',
        'milestone.reactivated'
      ])
    );
  });

  it('rejects duplicate active milestone names and reactivation conflicts', async () => {
    const fixture = await createFixture();
    const archivedMilestone = await repositories.milestones.create({
      id: randomUUID(),
      workspaceId: fixture.workspaceId,
      projectId: fixture.projectId,
      name: 'v0.0.3',
      description: '',
      status: 'planned',
      targetDate: null,
      archivedAt: now(),
      archivedById: fixture.actorId,
      createdAt: now(),
      updatedAt: now()
    });

    await request(app)
      .post(`/api/projects/${fixture.projectId}/milestones`)
      .set(fixture.headers)
      .send({ name: 'V0.0.3', status: 'active' })
      .expect(201);

    await request(app)
      .post(`/api/projects/${fixture.projectId}/milestones`)
      .set(fixture.headers)
      .send({ name: 'v0.0.3', status: 'planned' })
      .expect(409)
      .expect(({ body }) => {
        expect(body.error.code).toBe('CONFLICT');
      });

    await request(app)
      .post(`/api/milestones/${archivedMilestone.id}/reactivate`)
      .set(fixture.headers)
      .expect(409)
      .expect(({ body }) => {
        expect(body.error.code).toBe('CONFLICT');
      });
  });

  it('allows contributors to read milestones but rejects milestone writes', async () => {
    const fixture = await createFixture('contributor');

    await repositories.milestones.create({
      id: randomUUID(),
      workspaceId: fixture.workspaceId,
      projectId: fixture.projectId,
      name: 'Readable target',
      description: '',
      status: 'active',
      targetDate: null,
      archivedAt: null,
      archivedById: null,
      createdAt: now(),
      updatedAt: now()
    });

    await request(app)
      .get(`/api/projects/${fixture.projectId}/milestones`)
      .set(fixture.headers)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toHaveLength(1);
      });

    await request(app)
      .post(`/api/projects/${fixture.projectId}/milestones`)
      .set(fixture.headers)
      .send({ name: 'Rejected target' })
      .expect(403)
      .expect(({ body }) => {
        expect(body.error.code).toBe('FORBIDDEN');
      });
  });

  it('rejects milestone writes under archived projects', async () => {
    const fixture = await createFixture();
    const milestone = await repositories.milestones.create({
      id: randomUUID(),
      workspaceId: fixture.workspaceId,
      projectId: fixture.projectId,
      name: 'v0.0.3',
      description: '',
      status: 'planned',
      targetDate: null,
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
      .post(`/api/projects/${fixture.projectId}/milestones`)
      .set(fixture.headers)
      .send({ name: 'Blocked target' })
      .expect(409);

    await request(app)
      .patch(`/api/milestones/${milestone.id}`)
      .set(fixture.headers)
      .send({ name: 'Blocked rename' })
      .expect(409);

    await request(app)
      .post(`/api/milestones/${milestone.id}/archive`)
      .set(fixture.headers)
      .expect(409);
  });
});
