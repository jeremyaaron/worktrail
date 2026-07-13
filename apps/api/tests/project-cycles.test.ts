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
let nextWorkItemNumber = 1;

function now() {
  return new Date('2026-07-09T12:00:00.000Z');
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
  await pool.query('delete from project_cycles where workspace_id = $1', [workspaceId]);
  await pool.query('delete from milestones where workspace_id = $1', [workspaceId]);
  await pool.query('delete from project_status_reports where workspace_id = $1', [workspaceId]);
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
    name: 'Cycle API Test Workspace',
    createdAt: timestamp,
    updatedAt: timestamp
  });

  await repositories.members.create({
    id: actorId,
    workspaceId,
    name: 'Cycle API Actor',
    email: `${actorId}@example.com`,
    role,
    isActive: true,
    createdAt: timestamp,
    updatedAt: timestamp
  });

  await repositories.projects.create({
    id: projectId,
    workspaceId,
    key: 'CY',
    nextWorkItemNumber: 1,
    name: 'Cycle API Test Project',
    description: 'Project for cycle endpoint tests.',
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

describe('project cycles API', () => {
  it('lists active cycles by default and supports archived/status filters', async () => {
    const fixture = await createFixture();
    const planned = await repositories.projectCycles.create({
      id: randomUUID(),
      workspaceId: fixture.workspaceId,
      projectId: fixture.projectId,
      name: 'Upcoming cycle',
      goal: '',
      status: 'planned',
      startDate: '2026-07-13',
      endDate: '2026-07-24',
      targetPoints: 24,
      archivedAt: null,
      archivedById: null,
      createdAt: now(),
      updatedAt: now()
    });
    const archived = await repositories.projectCycles.create({
      id: randomUUID(),
      workspaceId: fixture.workspaceId,
      projectId: fixture.projectId,
      name: 'Archived cycle',
      goal: '',
      status: 'canceled',
      startDate: '2026-06-01',
      endDate: '2026-06-12',
      targetPoints: null,
      archivedAt: now(),
      archivedById: fixture.actorId,
      createdAt: now(),
      updatedAt: now()
    });

    await request(app)
      .get(`/api/projects/${fixture.projectId}/cycles`)
      .set(fixture.headers)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual([
          expect.objectContaining({
            id: planned.id,
            name: 'Upcoming cycle',
            status: 'planned',
            startDate: '2026-07-13',
            endDate: '2026-07-24',
            targetPoints: 24,
            isArchived: false,
            archivedAt: null
          })
        ]);
      });

    await request(app)
      .get(`/api/projects/${fixture.projectId}/cycles`)
      .query({ includeArchived: 'true', status: 'canceled' })
      .set(fixture.headers)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual([
          expect.objectContaining({
            id: archived.id,
            name: 'Archived cycle',
            status: 'canceled',
            isArchived: true
          })
        ]);
      });
  });

  it('creates, gets, updates, archives, and reactivates cycles', async () => {
    const fixture = await createFixture('maintainer');

    const createResponse = await request(app)
      .post(`/api/projects/${fixture.projectId}/cycles`)
      .set(fixture.headers)
      .send({
        name: 'v0.2.1 Cycle Planning',
        goal: 'Ship cycle planning foundation.',
        status: 'planned',
        startDate: '2026-07-13',
        endDate: '2026-07-24',
        targetPoints: 24
      })
      .expect(201);

    expect(createResponse.body).toMatchObject({
      name: 'v0.2.1 Cycle Planning',
      goal: 'Ship cycle planning foundation.',
      status: 'planned',
      startDate: '2026-07-13',
      endDate: '2026-07-24',
      targetPoints: 24,
      isArchived: false,
      archivedAt: null
    });

    await request(app)
      .get(`/api/projects/${fixture.projectId}/cycles/${createResponse.body.id}`)
      .set(fixture.headers)
      .expect(200)
      .expect(({ body }) => {
        expect(body.id).toBe(createResponse.body.id);
      });

    await request(app)
      .patch(`/api/projects/${fixture.projectId}/cycles/${createResponse.body.id}`)
      .set(fixture.headers)
      .send({
        name: 'v0.2.1 Cycle Planning Updated',
        goal: 'Commit current cycle scope.',
        status: 'active',
        targetPoints: 26
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          name: 'v0.2.1 Cycle Planning Updated',
          goal: 'Commit current cycle scope.',
          status: 'active',
          targetPoints: 26
        });
      });

    await request(app)
      .post(`/api/projects/${fixture.projectId}/cycles/${createResponse.body.id}/archive`)
      .set(fixture.headers)
      .expect(200)
      .expect(({ body }) => {
        expect(body.isArchived).toBe(true);
        expect(body.archivedAt).toEqual(expect.any(String));
      });

    await request(app)
      .post(`/api/projects/${fixture.projectId}/cycles/${createResponse.body.id}/reactivate`)
      .set(fixture.headers)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          id: createResponse.body.id,
          isArchived: false,
          archivedAt: null
        });
      });
  });

  it('rejects contributor writes, archived project writes, active conflicts, and overlaps', async () => {
    const ownerFixture = await createFixture();
    const active = await request(app)
      .post(`/api/projects/${ownerFixture.projectId}/cycles`)
      .set(ownerFixture.headers)
      .send({
        name: 'Current cycle',
        status: 'active',
        startDate: '2026-07-01',
        endDate: '2026-07-12'
      })
      .expect(201);

    await request(app)
      .post(`/api/projects/${ownerFixture.projectId}/cycles`)
      .set(ownerFixture.headers)
      .send({
        name: 'Second active',
        status: 'active',
        startDate: '2026-07-13',
        endDate: '2026-07-24'
      })
      .expect(409)
      .expect(({ body }) => {
        expect(body.error.code).toBe('CONFLICT');
      });

    await request(app)
      .post(`/api/projects/${ownerFixture.projectId}/cycles`)
      .set(ownerFixture.headers)
      .send({
        name: 'Overlapping planned',
        status: 'planned',
        startDate: '2026-07-10',
        endDate: '2026-07-20'
      })
      .expect(409);

    const contributorId = randomUUID();
    await repositories.members.create({
      id: contributorId,
      workspaceId: ownerFixture.workspaceId,
      name: 'Contributor',
      email: `${contributorId}@example.com`,
      role: 'contributor',
      isActive: true,
      createdAt: now(),
      updatedAt: now()
    });
    const contributorHeaders = actorHeaders({
      workspaceId: ownerFixture.workspaceId,
      memberId: contributorId,
      role: 'contributor'
    });

    await request(app)
      .get(`/api/projects/${ownerFixture.projectId}/cycles/${active.body.id}`)
      .set(contributorHeaders)
      .expect(200);

    await request(app)
      .post(`/api/projects/${ownerFixture.projectId}/cycles`)
      .set(contributorHeaders)
      .send({
        name: 'Contributor cycle',
        startDate: '2026-08-01',
        endDate: '2026-08-12'
      })
      .expect(403);

    await repositories.projects.update(ownerFixture.projectId, {
      status: 'archived',
      updatedAt: now()
    });

    await request(app)
      .patch(`/api/projects/${ownerFixture.projectId}/cycles/${active.body.id}`)
      .set(ownerFixture.headers)
      .send({ name: 'Blocked update' })
      .expect(409);
  });

  it('reserves completed status for closeout while allowing completed-cycle metadata corrections', async () => {
    const fixture = await createFixture();

    await request(app)
      .post(`/api/projects/${fixture.projectId}/cycles`)
      .set(fixture.headers)
      .send({
        name: 'Invalid completed creation',
        status: 'completed',
        startDate: '2026-06-01',
        endDate: '2026-06-12'
      })
      .expect(400);

    const active = await request(app)
      .post(`/api/projects/${fixture.projectId}/cycles`)
      .set(fixture.headers)
      .send({
        name: 'Active cycle',
        status: 'active',
        startDate: '2026-07-01',
        endDate: '2026-07-12'
      })
      .expect(201);

    await request(app)
      .patch(`/api/projects/${fixture.projectId}/cycles/${active.body.id}`)
      .set(fixture.headers)
      .send({ status: 'completed' })
      .expect(400);

    const historical = await repositories.projectCycles.create({
      id: randomUUID(),
      workspaceId: fixture.workspaceId,
      projectId: fixture.projectId,
      name: 'Historical completed cycle',
      goal: '',
      status: 'completed',
      startDate: '2026-06-01',
      endDate: '2026-06-12',
      targetPoints: null,
      archivedAt: null,
      archivedById: null,
      createdAt: now(),
      updatedAt: now()
    });

    await request(app)
      .patch(`/api/projects/${fixture.projectId}/cycles/${historical.id}`)
      .set(fixture.headers)
      .send({ name: 'Corrected historical name' })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({ name: 'Corrected historical name', status: 'completed' });
      });

    await request(app)
      .patch(`/api/projects/${fixture.projectId}/cycles/${historical.id}`)
      .set(fixture.headers)
      .send({ status: 'active' })
      .expect(409);
  });

  it('returns cycle review data and hides cross-project ids', async () => {
    const fixture = await createFixture();
    const cycleResponse = await request(app)
      .post(`/api/projects/${fixture.projectId}/cycles`)
      .set(fixture.headers)
      .send({
        name: 'Review cycle',
        status: 'active',
        startDate: '2026-07-01',
        endDate: '2026-07-12',
        targetPoints: 2
      })
      .expect(201);
    const blocked = await createWorkItem(fixture, cycleResponse.body.id, {
      title: 'Blocked review work',
      status: 'blocked',
      priority: 'high',
      dueDate: '2026-07-08',
      estimatePoints: 3
    });
    const blocker = await createWorkItem(fixture, cycleResponse.body.id, {
      title: 'Open blocker',
      status: 'in_progress',
      priority: 'urgent',
      estimatePoints: 2,
      updatedAt: new Date('2026-07-01T12:00:00.000Z')
    });
    await repositories.workItemRelationships.create({
      id: randomUUID(),
      workspaceId: fixture.workspaceId,
      relationshipType: 'blocks',
      sourceWorkItemId: blocker.id,
      targetWorkItemId: blocked.id,
      createdById: fixture.actorId,
      createdAt: now()
    });

    await request(app)
      .get(`/api/projects/${fixture.projectId}/cycles/${cycleResponse.body.id}/review`)
      .set(fixture.headers)
      .expect(200)
      .expect(({ body }) => {
        expect(body.project.id).toBe(fixture.projectId);
        expect(body.cycle.id).toBe(cycleResponse.body.id);
        expect(body.progress).toMatchObject({
          totalCount: 2,
          openCount: 2,
          blockedCount: 1,
          dependencyBlockedCount: 1,
          committedEstimatePoints: 5,
          completedEstimatePoints: 0,
          targetPoints: 2
        });
        expect(body.health.health).toBe('blocked');
        expect(body.scopedWorkQuery).toEqual({
          cycleId: cycleResponse.body.id,
          sort: 'priority_desc'
        });
        expect(body.riskSections.map((section: { type: string }) => section.type)).toContain('over_target');
      });

    const otherProjectId = randomUUID();
    await repositories.projects.create({
      id: otherProjectId,
      workspaceId: fixture.workspaceId,
      key: 'OC',
      nextWorkItemNumber: 1,
      name: 'Other cycle project',
      description: '',
      status: 'active',
      createdAt: now(),
      updatedAt: now()
    });

    await request(app)
      .get(`/api/projects/${otherProjectId}/cycles/${cycleResponse.body.id}`)
      .set(fixture.headers)
      .expect(404);
  });
});

async function createWorkItem(
  fixture: Awaited<ReturnType<typeof createFixture>>,
  cycleId: string,
  input: {
    title: string;
    status?: 'backlog' | 'ready' | 'in_progress' | 'blocked' | 'done' | 'canceled';
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    dueDate?: string | null;
    estimatePoints?: number | null;
    updatedAt?: Date;
  }
) {
  const id = randomUUID();
  const itemNumber = nextWorkItemNumber;
  nextWorkItemNumber += 1;

  return repositories.workItems.create({
    id,
    workspaceId: fixture.workspaceId,
    projectId: fixture.projectId,
    title: input.title,
    description: '',
    itemNumber,
    displayKey: `CY-${itemNumber}`,
    type: 'story',
    status: input.status ?? 'ready',
    priority: input.priority ?? 'medium',
    assigneeId: fixture.actorId,
    reporterId: fixture.actorId,
    milestoneId: null,
    cycleId,
    boardPosition: itemNumber * 1024,
    dueDate: input.dueDate ?? null,
    estimatePoints: input.estimatePoints === undefined ? 1 : input.estimatePoints,
    createdAt: now(),
    updatedAt: input.updatedAt ?? now()
  });
}
