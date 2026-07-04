import { randomUUID } from 'node:crypto';

import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { createExpressApp } from '../src/adapters/express/server.js';
import { createDb, createPool } from '../src/db/client.js';
import { createRepositories, type Repositories } from '../src/repositories/index.js';
import type { NewProject } from '../src/repositories/types.js';
import { ProjectService } from '../src/services/project-service.js';

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
  await pool.query('delete from saved_work_views where workspace_id = $1', [workspaceId]);
  await pool.query('delete from workspace_activity_events where workspace_id = $1', [workspaceId]);
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

let nextWorkItemNumber = 1;

async function createWorkItem(input: {
  workspaceId: string;
  projectId: string;
  reporterId: string;
  assigneeId?: string | null;
  title?: string;
  status?: 'backlog' | 'ready' | 'in_progress' | 'blocked' | 'done' | 'canceled';
  dueDate?: string | null;
  updatedAt?: Date;
}) {
  const itemNumber = nextWorkItemNumber;
  nextWorkItemNumber += 1;

  return repositories.workItems.create({
    id: randomUUID(),
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    itemNumber,
    displayKey: `NAV-${itemNumber}`,
    title: input.title ?? `Navigation item ${itemNumber}`,
    description: '',
    type: 'task',
    status: input.status ?? 'ready',
    priority: 'medium',
    assigneeId: input.assigneeId === undefined ? input.reporterId : input.assigneeId,
    reporterId: input.reporterId,
    milestoneId: null,
    boardPosition: itemNumber * 1024,
    dueDate: input.dueDate ?? null,
    estimatePoints: null,
    createdAt: now(),
    updatedAt: input.updatedAt ?? now()
  });
}

beforeAll(() => {
  pool = createPool();
  db = createDb(pool);
  repositories = createRepositories(db);
  app = createExpressApp({ repositories, db });
});

afterEach(async () => {
  nextWorkItemNumber = 1;
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

  it('creates members for owners and records workspace activity', async () => {
    const fixture = await createWorkspaceFixture('owner');

    await request(app)
      .post('/api/members')
      .set(fixture.headers)
      .send({
        name: 'New Contributor',
        email: 'New.Contributor@Example.com',
        role: 'contributor'
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          workspaceId: fixture.workspaceId,
          name: 'New Contributor',
          email: 'new.contributor@example.com',
          role: 'contributor',
          isActive: true,
          deactivatedAt: null
        });
        expect(body.createdAt).toEqual(expect.any(String));
        expect(body.updatedAt).toEqual(expect.any(String));
      });

    const members = await repositories.members.listByWorkspace(fixture.workspaceId);
    const created = members.find((member) => member.email === 'new.contributor@example.com');
    expect(created).toBeDefined();

    const activity = await repositories.workspaceActivityEvents.findByWorkspace(fixture.workspaceId);
    expect(activity).toEqual([
      expect.objectContaining({
        actorId: fixture.actorId,
        eventType: 'member.created',
        metadata: { memberId: created?.id }
      })
    ]);
  });

  it('rejects member creation for maintainers and contributors', async () => {
    const maintainerFixture = await createWorkspaceFixture('maintainer');
    const contributorFixture = await createWorkspaceFixture('contributor');

    await request(app)
      .post('/api/members')
      .set(maintainerFixture.headers)
      .send({
        name: 'Blocked Member',
        email: 'blocked.maintainer@example.com',
        role: 'contributor'
      })
      .expect(403)
      .expect(({ body }) => {
        expect(body.error).toEqual({
          code: 'FORBIDDEN',
          message: 'Only owners can manage workspace members.'
        });
      });

    await request(app)
      .post('/api/members')
      .set(contributorFixture.headers)
      .send({
        name: 'Blocked Member',
        email: 'blocked.contributor@example.com',
        role: 'contributor'
      })
      .expect(403);
  });

  it('rejects duplicate member emails case-insensitively', async () => {
    const fixture = await createWorkspaceFixture('owner');

    await request(app)
      .post('/api/members')
      .set(fixture.headers)
      .send({
        name: 'Duplicate Actor',
        email: `${fixture.actorId.toUpperCase()}@example.com`,
        role: 'contributor'
      })
      .expect(409)
      .expect(({ body }) => {
        expect(body.error).toEqual({
          code: 'CONFLICT',
          message: 'Member email is already in use.'
        });
      });
  });

  it('updates member profile and role with workspace activity', async () => {
    const fixture = await createWorkspaceFixture('owner');

    await request(app)
      .patch(`/api/members/${fixture.contributorId}`)
      .set(fixture.headers)
      .send({
        name: 'Updated Contributor',
        email: 'Updated.Contributor@Example.com',
        role: 'maintainer'
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          id: fixture.contributorId,
          name: 'Updated Contributor',
          email: 'updated.contributor@example.com',
          role: 'maintainer'
        });
      });

    const activity = await repositories.workspaceActivityEvents.findByWorkspace(fixture.workspaceId);
    expect(activity.map((event) => event.eventType)).toEqual(
      expect.arrayContaining([
        'member.name_changed',
        'member.email_changed',
        'member.role_changed'
      ])
    );
  });

  it('deactivates and reactivates members with workspace activity', async () => {
    const fixture = await createWorkspaceFixture('owner');

    await request(app)
      .post(`/api/members/${fixture.contributorId}/deactivate`)
      .set(fixture.headers)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          id: fixture.contributorId,
          isActive: false
        });
        expect(body.deactivatedAt).toEqual(expect.any(String));
      });

    await request(app)
      .post(`/api/members/${fixture.contributorId}/reactivate`)
      .set(fixture.headers)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          id: fixture.contributorId,
          isActive: true,
          deactivatedAt: null
        });
      });

    const activity = await repositories.workspaceActivityEvents.findByWorkspace(fixture.workspaceId);
    expect(activity.map((event) => event.eventType)).toEqual([
      'member.reactivated',
      'member.deactivated'
    ]);
  });

  it('protects the last active owner from demotion and deactivation', async () => {
    const fixture = await createWorkspaceFixture('owner');

    await request(app)
      .patch(`/api/members/${fixture.actorId}`)
      .set(fixture.headers)
      .send({ role: 'maintainer' })
      .expect(409)
      .expect(({ body }) => {
        expect(body.error).toEqual({
          code: 'CONFLICT',
          message: 'At least one active owner is required.'
        });
      });

    await request(app)
      .post(`/api/members/${fixture.actorId}/deactivate`)
      .set(fixture.headers)
      .expect(409)
      .expect(({ body }) => {
        expect(body.error.code).toBe('CONFLICT');
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

  it('returns project navigation summaries sorted by active status and recent work', async () => {
    const fixture = await createWorkspaceFixture('owner');
    const staleActiveProject = await createProject({
      workspaceId: fixture.workspaceId,
      key: 'STALE',
      name: 'Stale Active Project',
      updatedAt: new Date('2026-07-01T12:00:00.000Z')
    });
    const recentActiveProject = await createProject({
      workspaceId: fixture.workspaceId,
      key: 'RECENT',
      name: 'Recent Active Project',
      updatedAt: new Date('2026-07-01T12:00:00.000Z')
    });
    const emptyProject = await createProject({
      workspaceId: fixture.workspaceId,
      key: 'EMPTY',
      name: 'Empty Project',
      updatedAt: new Date('2026-07-02T12:00:00.000Z')
    });
    const archivedProject = await createProject({
      workspaceId: fixture.workspaceId,
      key: 'OLD',
      name: 'Archived Project',
      status: 'archived',
      updatedAt: new Date('2026-07-10T12:00:00.000Z')
    });

    await createWorkItem({
      workspaceId: fixture.workspaceId,
      projectId: staleActiveProject.id,
      reporterId: fixture.actorId,
      status: 'blocked',
      dueDate: '2026-07-01',
      updatedAt: new Date('2026-07-03T12:00:00.000Z')
    });
    await createWorkItem({
      workspaceId: fixture.workspaceId,
      projectId: staleActiveProject.id,
      reporterId: fixture.actorId,
      status: 'done',
      dueDate: '2026-07-01',
      updatedAt: new Date('2026-07-04T12:00:00.000Z')
    });
    await createWorkItem({
      workspaceId: fixture.workspaceId,
      projectId: recentActiveProject.id,
      reporterId: fixture.actorId,
      status: 'ready',
      dueDate: '2026-07-12',
      updatedAt: new Date('2026-07-05T12:00:00.000Z')
    });
    await createWorkItem({
      workspaceId: fixture.workspaceId,
      projectId: archivedProject.id,
      reporterId: fixture.actorId,
      status: 'blocked',
      dueDate: '2026-07-01',
      updatedAt: new Date('2026-07-11T12:00:00.000Z')
    });

    const summaries = await new ProjectService({
      actor: {
        workspaceId: fixture.workspaceId,
        memberId: fixture.actorId,
        role: 'owner'
      },
      repositories,
      clock: () => new Date('2026-07-04T12:00:00.000Z')
    }).listProjectNavigationSummaries();

    expect(summaries.map((summary) => summary.project.key)).toEqual([
      'RECENT',
      'STALE',
      'EMPTY',
      'OLD'
    ]);
    expect(summaries.find((summary) => summary.project.id === staleActiveProject.id)).toMatchObject({
      project: { id: staleActiveProject.id, status: 'active' },
      openWorkItemCount: 1,
      blockedWorkItemCount: 1,
      overdueWorkItemCount: 1,
      updatedAt: '2026-07-04T12:00:00.000Z'
    });
    expect(summaries.find((summary) => summary.project.id === emptyProject.id)).toMatchObject({
      openWorkItemCount: 0,
      blockedWorkItemCount: 0,
      overdueWorkItemCount: 0,
      updatedAt: '2026-07-02T12:00:00.000Z'
    });
    expect(summaries.find((summary) => summary.project.id === archivedProject.id)).toMatchObject({
      project: { status: 'archived' },
      openWorkItemCount: 1,
      blockedWorkItemCount: 1,
      overdueWorkItemCount: 1,
      updatedAt: '2026-07-11T12:00:00.000Z'
    });
  });

  it('serves project navigation summaries through the API', async () => {
    const fixture = await createWorkspaceFixture('owner');
    const project = await createProject({ workspaceId: fixture.workspaceId, key: 'NAV' });
    await createWorkItem({
      workspaceId: fixture.workspaceId,
      projectId: project.id,
      reporterId: fixture.actorId,
      status: 'blocked',
      updatedAt: new Date('2026-07-04T12:00:00.000Z')
    });

    await request(app)
      .get('/api/projects/navigation-summary')
      .set(fixture.headers)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual([
          expect.objectContaining({
            project: expect.objectContaining({ id: project.id, key: 'NAV' }),
            openWorkItemCount: 1,
            blockedWorkItemCount: 1,
            updatedAt: '2026-07-04T12:00:00.000Z'
          })
        ]);
      });
  });

  it('creates a project with validation and actor workspace scoping', async () => {
    const fixture = await createWorkspaceFixture('owner');

    const response = await request(app)
      .post('/api/projects')
      .set(fixture.headers)
      .send({ name: 'Created Through API', description: 'Created by endpoint test.' })
      .expect(201)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          workspaceId: fixture.workspaceId,
          key: 'CTA',
          name: 'Created Through API',
          description: 'Created by endpoint test.',
          status: 'active'
        });
      });

    const projects = await repositories.projects.listByWorkspace(fixture.workspaceId);
    expect(projects.map((project) => project.name)).toContain('Created Through API');

    const activity = await repositories.workspaceActivityEvents.findByWorkspace(fixture.workspaceId);
    expect(activity).toEqual([
      expect.objectContaining({
        actorId: fixture.actorId,
        eventType: 'project.created',
        metadata: { projectId: response.body.id },
        newValue: {
          projectId: response.body.id,
          key: 'CTA',
          name: 'Created Through API'
        }
      })
    ]);
  });

  it('allows maintainers to create projects', async () => {
    const fixture = await createWorkspaceFixture('maintainer');

    await request(app)
      .post('/api/projects')
      .set(fixture.headers)
      .send({ key: 'OPS', name: 'Operations Tracker' })
      .expect(201)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          workspaceId: fixture.workspaceId,
          key: 'OPS',
          name: 'Operations Tracker',
          status: 'active'
        });
      });
  });

  it('rejects contributor project creation requests', async () => {
    const fixture = await createWorkspaceFixture('contributor');

    await request(app)
      .post('/api/projects')
      .set(fixture.headers)
      .send({ key: 'OPS', name: 'Operations Tracker' })
      .expect(403)
      .expect(({ body }) => {
        expect(body.error).toEqual({
          code: 'FORBIDDEN',
          message: 'Only owners and maintainers can create projects.'
        });
      });

    const projects = await repositories.projects.listByWorkspace(fixture.workspaceId);
    expect(projects).toHaveLength(0);
  });

  it('accepts explicit project keys and rejects duplicates', async () => {
    const fixture = await createWorkspaceFixture('owner');

    await request(app)
      .post('/api/projects')
      .set(fixture.headers)
      .send({ key: 'OPS', name: 'Operations Tracker' })
      .expect(201)
      .expect(({ body }) => {
        expect(body.key).toBe('OPS');
      });

    await request(app)
      .post('/api/projects')
      .set(fixture.headers)
      .send({ key: 'ops', name: 'Duplicate Operations Tracker' })
      .expect(409)
      .expect(({ body }) => {
        expect(body.error.code).toBe('CONFLICT');
      });
  });

  it('generates a unique project key when the name-derived key is already used', async () => {
    const fixture = await createWorkspaceFixture('owner');
    await createProject({ workspaceId: fixture.workspaceId, key: 'CTA', name: 'Existing Project' });

    await request(app)
      .post('/api/projects')
      .set(fixture.headers)
      .send({ name: 'Created Through API' })
      .expect(201)
      .expect(({ body }) => {
        expect(body.key).toBe('CTA2');
      });
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

    await request(app)
      .post('/api/projects')
      .set(fixture.headers)
      .send({ key: '!', name: 'Invalid Key Project' })
      .expect(400)
      .expect(({ body }) => {
        expect(body.error).toEqual({
          code: 'VALIDATION_ERROR',
          message: 'Project key must be 2-8 uppercase letters or numbers.'
        });
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

  it('updates project settings and records metadata activity', async () => {
    const fixture = await createWorkspaceFixture('owner');
    const project = await createProject({ workspaceId: fixture.workspaceId });

    await request(app)
      .patch(`/api/projects/${project.id}`)
      .set(fixture.headers)
      .send({
        key: 'NEW',
        name: 'Updated API Project',
        description: 'Updated project description.'
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          key: 'NEW',
          name: 'Updated API Project',
          description: 'Updated project description.'
        });
      });

    const events = await repositories.activityEvents.findByProject(project.id);
    expect(events.map((event) => event.eventType)).toEqual(
      expect.arrayContaining(['project.name_changed', 'project.description_changed'])
    );
  });

  it('rejects duplicate project keys on update', async () => {
    const fixture = await createWorkspaceFixture('owner');
    const firstProject = await createProject({
      workspaceId: fixture.workspaceId,
      key: 'ONE',
      name: 'First Project'
    });
    const secondProject = await createProject({
      workspaceId: fixture.workspaceId,
      key: 'TWO',
      name: 'Second Project'
    });

    await request(app)
      .patch(`/api/projects/${secondProject.id}`)
      .set(fixture.headers)
      .send({ key: firstProject.key })
      .expect(409)
      .expect(({ body }) => {
        expect(body.error.code).toBe('CONFLICT');
      });
  });

  it('rejects project key updates after work items exist', async () => {
    const fixture = await createWorkspaceFixture('owner');
    const project = await createProject({ workspaceId: fixture.workspaceId, key: 'LOCKED' });

    await repositories.workItems.create({
      id: randomUUID(),
      workspaceId: fixture.workspaceId,
      projectId: project.id,
      itemNumber: 1,
      displayKey: 'LOCKED-1',
      title: 'Existing keyed work item',
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

    await request(app)
      .patch(`/api/projects/${project.id}`)
      .set(fixture.headers)
      .send({ key: 'NEXT' })
      .expect(409)
      .expect(({ body }) => {
        expect(body.error.code).toBe('CONFLICT');
      });
  });

  it('archives and reactivates projects through command endpoints with activity', async () => {
    const fixture = await createWorkspaceFixture('maintainer');
    const project = await createProject({ workspaceId: fixture.workspaceId });

    await request(app)
      .post(`/api/projects/${project.id}/archive`)
      .set(fixture.headers)
      .expect(200)
      .expect(({ body }) => {
        expect(body.status).toBe('archived');
      });

    await request(app)
      .post(`/api/projects/${project.id}/reactivate`)
      .set(fixture.headers)
      .expect(200)
      .expect(({ body }) => {
        expect(body.status).toBe('active');
      });

    const events = await repositories.activityEvents.findByProject(project.id);
    expect(events.map((event) => event.eventType)).toEqual([
      'project.reactivated',
      'project.archived'
    ]);
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
