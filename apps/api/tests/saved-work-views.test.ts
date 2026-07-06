import { randomUUID } from 'node:crypto';

import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { createExpressApp } from '../src/adapters/express/server.js';
import { createDb, createPool } from '../src/db/client.js';
import { createRepositories, type Repositories } from '../src/repositories/index.js';
import { SavedWorkViewService } from '../src/services/saved-work-view-service.js';

const workspaceIds = new Set<string>();
let pool: ReturnType<typeof createPool>;
let db: ReturnType<typeof createDb>;
let repositories: Repositories;
let app: ReturnType<typeof createExpressApp>;

function now() {
  return new Date('2026-07-04T12:00:00.000Z');
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
  await pool.query('delete from saved_work_views where workspace_id = $1', [workspaceId]);
  await pool.query('delete from workspace_activity_events where workspace_id = $1', [workspaceId]);
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
  const contributorId = randomUUID();
  const projectId = randomUUID();
  const archivedProjectId = randomUUID();
  workspaceIds.add(workspaceId);

  await repositories.workspaces.create({
    id: workspaceId,
    name: 'Saved Views Test Workspace',
    createdAt: timestamp,
    updatedAt: timestamp
  });

  await repositories.members.create({
    id: actorId,
    workspaceId,
    name: 'Saved Views Actor',
    email: `${actorId}@example.com`,
    role: 'owner',
    isActive: true,
    createdAt: timestamp,
    updatedAt: timestamp
  });

  await repositories.members.create({
    id: otherMemberId,
    workspaceId,
    name: 'Saved Views Other Actor',
    email: `${otherMemberId}@example.com`,
    role: 'maintainer',
    isActive: true,
    createdAt: timestamp,
    updatedAt: timestamp
  });

  await repositories.members.create({
    id: contributorId,
    workspaceId,
    name: 'Saved Views Contributor',
    email: `${contributorId}@example.com`,
    role: 'contributor',
    isActive: true,
    createdAt: timestamp,
    updatedAt: timestamp
  });

  await repositories.projects.create({
    id: projectId,
    workspaceId,
    key: 'SVT',
    name: 'Saved Views Test Project',
    description: '',
    status: 'active',
    createdAt: timestamp,
    updatedAt: timestamp
  });

  await repositories.projects.create({
    id: archivedProjectId,
    workspaceId,
    key: 'SVA',
    name: 'Archived Saved Views Test Project',
    description: '',
    status: 'archived',
    createdAt: timestamp,
    updatedAt: timestamp
  });

  return {
    workspaceId,
    actorId,
    otherMemberId,
    contributorId,
    projectId,
    archivedProjectId,
    headers: actorHeaders({ workspaceId, memberId: actorId, role: 'owner' }),
    otherHeaders: actorHeaders({ workspaceId, memberId: otherMemberId, role: 'maintainer' }),
    contributorHeaders: actorHeaders({
      workspaceId,
      memberId: contributorId,
      role: 'contributor'
    })
  };
}

function savedViewService(input: {
  workspaceId: string;
  memberId: string;
  role: 'owner' | 'maintainer' | 'contributor';
}) {
  return new SavedWorkViewService({
    actor: {
      workspaceId: input.workspaceId,
      memberId: input.memberId,
      role: input.role
    },
    repositories,
    clock: now,
    idGenerator: randomUUID
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

describe('saved work view API', () => {
  it('lists actor personal views and workspace views while hiding other personal views', async () => {
    const fixture = await createFixture();
    const actorPersonal = await repositories.savedWorkViews.create({
      id: randomUUID(),
      workspaceId: fixture.workspaceId,
      ownerMemberId: fixture.actorId,
      name: 'My open work',
      visibility: 'personal',
      query: { assigneeId: fixture.actorId, workState: 'open' },
      createdAt: now(),
      updatedAt: new Date('2026-07-04T12:02:00.000Z')
    });
    const otherPersonal = await repositories.savedWorkViews.create({
      id: randomUUID(),
      workspaceId: fixture.workspaceId,
      ownerMemberId: fixture.otherMemberId,
      name: 'Other private view',
      visibility: 'personal',
      query: { assigneeId: fixture.otherMemberId, workState: 'open' },
      createdAt: now(),
      updatedAt: new Date('2026-07-04T12:03:00.000Z')
    });
    const workspaceView = await repositories.savedWorkViews.create({
      id: randomUUID(),
      workspaceId: fixture.workspaceId,
      ownerMemberId: fixture.otherMemberId,
      name: 'Shared blocked work',
      visibility: 'workspace',
      query: { blocked: true, archivedProjects: 'exclude', sort: 'priority_desc' },
      createdAt: now(),
      updatedAt: new Date('2026-07-04T12:04:00.000Z')
    });

    await request(app)
      .get('/api/saved-work-views')
      .set(fixture.headers)
      .expect(200)
      .expect(({ body }) => {
        expect(body.map((savedView: { id: string }) => savedView.id)).toEqual([
          workspaceView.id,
          actorPersonal.id
        ]);
        expect(body).toEqual([
          expect.objectContaining({
            id: workspaceView.id,
            owner: expect.objectContaining({ id: fixture.otherMemberId }),
            visibility: 'workspace'
          }),
          expect.objectContaining({
            id: actorPersonal.id,
            owner: expect.objectContaining({ id: fixture.actorId }),
            visibility: 'personal'
          })
        ]);
        expect(body).not.toEqual(
          expect.arrayContaining([expect.objectContaining({ id: otherPersonal.id })])
        );
      });
  });

  it('creates, normalizes, and lists personal saved views for the current actor', async () => {
    const fixture = await createFixture();

    const createResponse = await request(app)
      .post('/api/saved-work-views')
      .set(fixture.headers)
      .send({
        name: '  My open work  ',
        query: {
          assigneeId: fixture.actorId,
          workState: 'open',
          dependency: 'dependency_blocked',
          search: '   ',
          status: '',
          unexpectedFilter: 'not persisted',
          blocked: false
        }
      })
      .expect(201);

    expect(createResponse.body).toMatchObject({
      workspaceId: fixture.workspaceId,
      owner: { id: fixture.actorId },
      name: 'My open work',
      visibility: 'personal',
      query: {
        assigneeId: fixture.actorId,
        workState: 'open',
        dependency: 'dependency_blocked',
        blocked: false,
        archivedProjects: 'exclude',
        sort: 'updated_desc'
      }
    });
    expect(createResponse.body.query.search).toBeUndefined();
    expect(createResponse.body.query.status).toBeUndefined();
    expect(createResponse.body.query.unexpectedFilter).toBeUndefined();

    const persisted = await repositories.savedWorkViews.findById(createResponse.body.id);
    expect(persisted?.query).toEqual(createResponse.body.query);

    await request(app)
      .get('/api/saved-work-views')
      .set(fixture.headers)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual([expect.objectContaining({ id: createResponse.body.id })]);
      });

    await request(app).get('/api/saved-work-views').set(fixture.otherHeaders).expect(200, []);
  });

  it('allows owners and maintainers to create normalized workspace saved views', async () => {
    const fixture = await createFixture();

    const ownerResponse = await request(app)
      .post('/api/saved-work-views')
      .set(fixture.headers)
      .send({
        name: 'Shared design work',
        visibility: 'workspace',
        query: {
          labelId: randomUUID(),
          workState: 'open',
          search: '  ',
          unexpectedFilter: 'not persisted'
        }
      })
      .expect(201);

    expect(ownerResponse.body).toMatchObject({
      workspaceId: fixture.workspaceId,
      owner: { id: fixture.actorId },
      name: 'Shared design work',
      visibility: 'workspace',
      query: {
        workState: 'open',
        archivedProjects: 'exclude',
        sort: 'updated_desc'
      }
    });
    expect(ownerResponse.body.query.search).toBeUndefined();
    expect(ownerResponse.body.query.unexpectedFilter).toBeUndefined();

    const maintainerResponse = await request(app)
      .post('/api/saved-work-views')
      .set(fixture.otherHeaders)
      .send({
        name: 'Shared urgent work',
        visibility: 'workspace',
        query: { priority: 'urgent' }
      })
      .expect(201);

    expect(maintainerResponse.body).toMatchObject({
      owner: { id: fixture.otherMemberId },
      visibility: 'workspace',
      query: {
        priority: 'urgent',
        archivedProjects: 'exclude',
        sort: 'updated_desc'
      }
    });

    await request(app)
      .post('/api/saved-work-views')
      .set(fixture.contributorHeaders)
      .send({
        name: 'Contributor shared view',
        visibility: 'workspace',
        query: { workState: 'open' }
      })
      .expect(403)
      .expect(({ body }) => {
        expect(body.error).toEqual({
          code: 'FORBIDDEN',
          message: 'Only owners and maintainers can create shared saved views.'
        });
      });

    const activity = await repositories.workspaceActivityEvents.findByWorkspace(fixture.workspaceId);
    expect(activity).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actorId: fixture.actorId,
          eventType: 'saved_view.created',
          metadata: { savedViewId: ownerResponse.body.id },
          newValue: expect.objectContaining({
            name: 'Shared design work',
            visibility: 'workspace'
          })
        }),
        expect.objectContaining({
          actorId: fixture.otherMemberId,
          eventType: 'saved_view.created',
          metadata: { savedViewId: maintainerResponse.body.id }
        })
      ])
    );
  });

  it('updates and deletes owned saved views', async () => {
    const fixture = await createFixture();
    const savedView = await repositories.savedWorkViews.create({
      id: randomUUID(),
      workspaceId: fixture.workspaceId,
      ownerMemberId: fixture.actorId,
      name: 'Blocked work',
      visibility: 'personal',
      query: { blocked: true, archivedProjects: 'exclude', sort: 'priority_desc' },
      createdAt: now(),
      updatedAt: now()
    });

    await request(app)
      .patch(`/api/saved-work-views/${savedView.id}`)
      .set(fixture.headers)
      .send({
        name: 'Urgent work',
        query: {
          assigneeId: '',
          unknownFilter: 'not persisted',
          priority: 'urgent',
          workState: 'open',
          dependency: 'blocking_open_work'
        }
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          id: savedView.id,
          name: 'Urgent work',
          query: {
            priority: 'urgent',
            workState: 'open',
            dependency: 'blocking_open_work',
            archivedProjects: 'exclude',
            sort: 'updated_desc'
          }
        });
        expect(body.query.assigneeId).toBeUndefined();
        expect(body.query.unknownFilter).toBeUndefined();
      });

    await request(app)
      .delete(`/api/saved-work-views/${savedView.id}`)
      .set(fixture.headers)
      .expect(204);

    expect(await repositories.savedWorkViews.findById(savedView.id)).toBeNull();
  });

  it('pins and unpins personal saved views without activity', async () => {
    const fixture = await createFixture();
    const savedView = await repositories.savedWorkViews.create({
      id: randomUUID(),
      workspaceId: fixture.workspaceId,
      ownerMemberId: fixture.actorId,
      name: 'My pinned work',
      visibility: 'personal',
      query: { workState: 'open', archivedProjects: 'exclude', sort: 'updated_desc' },
      createdAt: now(),
      updatedAt: now()
    });

    await request(app)
      .patch(`/api/saved-work-views/${savedView.id}`)
      .set(fixture.headers)
      .send({ isPinned: true })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          id: savedView.id,
          isPinned: true
        });
      });

    expect(await repositories.savedWorkViews.findById(savedView.id)).toMatchObject({
      id: savedView.id,
      isPinned: true
    });

    await request(app)
      .patch(`/api/saved-work-views/${savedView.id}`)
      .set(fixture.headers)
      .send({ isPinned: false })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          id: savedView.id,
          isPinned: false
        });
      });

    await expect(repositories.workspaceActivityEvents.findByWorkspace(fixture.workspaceId)).resolves.toEqual([]);
    await expect(repositories.activityEvents.findByProject(fixture.projectId)).resolves.toEqual([]);
  });

  it('records shared saved view pin activity with correct permissions', async () => {
    const fixture = await createFixture();
    const sharedWorkspaceView = await repositories.savedWorkViews.create({
      id: randomUUID(),
      workspaceId: fixture.workspaceId,
      ownerMemberId: fixture.actorId,
      name: 'Workspace dependency risks',
      visibility: 'workspace',
      query: { dependency: 'dependency_blocked', archivedProjects: 'exclude', sort: 'priority_desc' },
      createdAt: now(),
      updatedAt: now()
    });
    const sharedProjectView = await repositories.savedWorkViews.create({
      id: randomUUID(),
      workspaceId: fixture.workspaceId,
      ownerMemberId: fixture.actorId,
      projectId: fixture.projectId,
      scope: 'project',
      name: 'Project release blockers',
      visibility: 'workspace',
      query: { blocked: true, sort: 'priority_desc' },
      createdAt: now(),
      updatedAt: now()
    });
    const archivedProjectView = await repositories.savedWorkViews.create({
      id: randomUUID(),
      workspaceId: fixture.workspaceId,
      ownerMemberId: fixture.actorId,
      projectId: fixture.archivedProjectId,
      scope: 'project',
      name: 'Archived release blockers',
      visibility: 'workspace',
      query: { blocked: true, sort: 'priority_desc' },
      createdAt: now(),
      updatedAt: now()
    });

    await request(app)
      .patch(`/api/saved-work-views/${sharedWorkspaceView.id}`)
      .set(fixture.otherHeaders)
      .send({ isPinned: true })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          id: sharedWorkspaceView.id,
          isPinned: true
        });
      });

    await request(app)
      .patch(`/api/saved-work-views/${sharedWorkspaceView.id}`)
      .set(fixture.otherHeaders)
      .send({ isPinned: true })
      .expect(200);

    await request(app)
      .patch(`/api/saved-work-views/${sharedWorkspaceView.id}`)
      .set(fixture.contributorHeaders)
      .send({ isPinned: false })
      .expect(403)
      .expect(({ body }) => {
        expect(body.error).toEqual({
          code: 'FORBIDDEN',
          message: 'Only owners and maintainers can manage shared saved views.'
        });
      });

    await request(app)
      .patch(`/api/saved-work-views/${sharedWorkspaceView.id}`)
      .set(fixture.headers)
      .send({ isPinned: false })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          id: sharedWorkspaceView.id,
          isPinned: false
        });
      });

    await request(app)
      .patch(`/api/saved-work-views/${sharedProjectView.id}`)
      .set(fixture.otherHeaders)
      .send({ isPinned: true })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          id: sharedProjectView.id,
          scope: 'project',
          projectId: fixture.projectId,
          isPinned: true
        });
      });

    await request(app)
      .patch(`/api/saved-work-views/${sharedProjectView.id}`)
      .set(fixture.headers)
      .send({
        name: 'Project release risk',
        isPinned: false
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          id: sharedProjectView.id,
          name: 'Project release risk',
          isPinned: false
        });
      });

    await request(app)
      .patch(`/api/saved-work-views/${archivedProjectView.id}`)
      .set(fixture.headers)
      .send({ isPinned: true })
      .expect(403)
      .expect(({ body }) => {
        expect(body.error).toEqual({
          code: 'FORBIDDEN',
          message: 'Archived projects do not allow saved view changes.'
        });
      });

    const workspaceActivity = await repositories.workspaceActivityEvents.findByWorkspace(fixture.workspaceId);
    expect(workspaceActivity).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actorId: fixture.otherMemberId,
          eventType: 'saved_view.pinned',
          summary: 'Saved Views Other Actor pinned shared view Workspace dependency risks.',
          previousValue: expect.objectContaining({
            savedViewId: sharedWorkspaceView.id,
            isPinned: false
          }),
          newValue: expect.objectContaining({
            savedViewId: sharedWorkspaceView.id,
            isPinned: true
          }),
          metadata: { savedViewId: sharedWorkspaceView.id }
        }),
        expect.objectContaining({
          actorId: fixture.actorId,
          eventType: 'saved_view.unpinned',
          summary: 'Saved Views Actor unpinned shared view Workspace dependency risks.',
          previousValue: expect.objectContaining({
            savedViewId: sharedWorkspaceView.id,
            isPinned: true
          }),
          newValue: expect.objectContaining({
            savedViewId: sharedWorkspaceView.id,
            isPinned: false
          }),
          metadata: { savedViewId: sharedWorkspaceView.id }
        })
      ])
    );
    expect(workspaceActivity.filter((event) => event.metadata.savedViewId === sharedWorkspaceView.id)).toHaveLength(2);

    const projectActivity = await repositories.activityEvents.findByProject(fixture.projectId);
    expect(projectActivity).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actorId: fixture.otherMemberId,
          eventType: 'saved_view.pinned',
          summary: 'Saved Views Other Actor pinned shared project view Project release blockers.',
          previousValue: expect.objectContaining({
            savedViewId: sharedProjectView.id,
            isPinned: false
          }),
          newValue: expect.objectContaining({
            savedViewId: sharedProjectView.id,
            isPinned: true
          }),
          metadata: {
            savedViewId: sharedProjectView.id,
            scope: 'project',
            visibility: 'workspace'
          }
        }),
        expect.objectContaining({
          actorId: fixture.actorId,
          eventType: 'saved_view.updated',
          summary: 'Saved Views Actor updated shared project view Project release risk.',
          previousValue: expect.objectContaining({
            savedViewId: sharedProjectView.id,
            name: 'Project release blockers',
            isPinned: true
          }),
          newValue: expect.objectContaining({
            savedViewId: sharedProjectView.id,
            name: 'Project release risk',
            isPinned: false
          }),
          metadata: {
            savedViewId: sharedProjectView.id,
            scope: 'project',
            visibility: 'workspace'
          }
        })
      ])
    );
  });

  it('rejects duplicate names for the same actor only', async () => {
    const fixture = await createFixture();
    const firstSavedView = await repositories.savedWorkViews.create({
      id: randomUUID(),
      workspaceId: fixture.workspaceId,
      ownerMemberId: fixture.actorId,
      name: 'Blocked work',
      visibility: 'personal',
      query: { blocked: true, archivedProjects: 'exclude', sort: 'priority_desc' },
      createdAt: now(),
      updatedAt: now()
    });
    const secondSavedView = await repositories.savedWorkViews.create({
      id: randomUUID(),
      workspaceId: fixture.workspaceId,
      ownerMemberId: fixture.actorId,
      name: 'Due soon',
      visibility: 'personal',
      query: { dueDateState: 'due_soon', archivedProjects: 'exclude', sort: 'due_date_asc' },
      createdAt: now(),
      updatedAt: now()
    });

    await request(app)
      .post('/api/saved-work-views')
      .set(fixture.headers)
      .send({
        name: 'blocked WORK',
        query: { blocked: true }
      })
      .expect(409)
      .expect(({ body }) => {
        expect(body.error).toEqual({
          code: 'CONFLICT',
          message: 'A saved view with this name already exists.'
        });
      });

    await request(app)
      .patch(`/api/saved-work-views/${secondSavedView.id}`)
      .set(fixture.headers)
      .send({ name: firstSavedView.name })
      .expect(409)
      .expect(({ body }) => {
        expect(body.error).toEqual({
          code: 'CONFLICT',
          message: 'A saved view with this name already exists.'
        });
      });

    await request(app)
      .post('/api/saved-work-views')
      .set(fixture.otherHeaders)
      .send({
        name: 'Blocked work',
        query: { blocked: true }
      })
      .expect(201);
  });

  it('scopes workspace duplicate names to the workspace and separately from personal names', async () => {
    const fixture = await createFixture();
    const otherFixture = await createFixture();

    await request(app)
      .post('/api/saved-work-views')
      .set(fixture.headers)
      .send({
        name: 'Team triage',
        visibility: 'workspace',
        query: { workState: 'open' }
      })
      .expect(201);

    await request(app)
      .post('/api/saved-work-views')
      .set(fixture.otherHeaders)
      .send({
        name: 'team TRIAGE',
        visibility: 'workspace',
        query: { blocked: true }
      })
      .expect(409)
      .expect(({ body }) => {
        expect(body.error).toEqual({
          code: 'CONFLICT',
          message: 'A saved view with this name already exists.'
        });
      });

    await request(app)
      .post('/api/saved-work-views')
      .set(fixture.headers)
      .send({
        name: 'Team triage',
        query: { assigneeId: fixture.actorId }
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body.visibility).toBe('personal');
      });

    await request(app)
      .post('/api/saved-work-views')
      .set(otherFixture.headers)
      .send({
        name: 'Team triage',
        visibility: 'workspace',
        query: { workState: 'open' }
      })
      .expect(201);
  });

  it('lists project-scoped saved views through query params without leaking workspace or other personal views', async () => {
    const fixture = await createFixture();
    const workspaceView = await repositories.savedWorkViews.create({
      id: randomUUID(),
      workspaceId: fixture.workspaceId,
      ownerMemberId: fixture.actorId,
      name: 'Workspace blockers',
      visibility: 'workspace',
      scope: 'workspace',
      projectId: null,
      query: { blocked: true, archivedProjects: 'exclude', sort: 'priority_desc' },
      createdAt: now(),
      updatedAt: new Date('2026-07-04T12:02:00.000Z')
    });
    const actorProjectPersonal = await repositories.savedWorkViews.create({
      id: randomUUID(),
      workspaceId: fixture.workspaceId,
      ownerMemberId: fixture.actorId,
      name: 'My project work',
      visibility: 'personal',
      scope: 'project',
      projectId: fixture.projectId,
      query: { assigneeId: fixture.actorId },
      createdAt: now(),
      updatedAt: new Date('2026-07-04T12:03:00.000Z')
    });
    const otherProjectPersonal = await repositories.savedWorkViews.create({
      id: randomUUID(),
      workspaceId: fixture.workspaceId,
      ownerMemberId: fixture.otherMemberId,
      name: 'Other project work',
      visibility: 'personal',
      scope: 'project',
      projectId: fixture.projectId,
      query: { assigneeId: fixture.otherMemberId },
      createdAt: now(),
      updatedAt: new Date('2026-07-04T12:04:00.000Z')
    });
    const sharedProjectView = await repositories.savedWorkViews.create({
      id: randomUUID(),
      workspaceId: fixture.workspaceId,
      ownerMemberId: fixture.otherMemberId,
      name: 'Shared project view',
      visibility: 'workspace',
      scope: 'project',
      projectId: fixture.projectId,
      query: { status: 'ready', sort: 'board_order' },
      createdAt: now(),
      updatedAt: new Date('2026-07-04T12:05:00.000Z')
    });

    await request(app)
      .get('/api/saved-work-views')
      .set(fixture.headers)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual([
          expect.objectContaining({
            id: workspaceView.id,
            scope: 'workspace',
            projectId: null
          })
        ]);
      });

    await request(app)
      .get(`/api/saved-work-views?scope=project&projectId=${fixture.projectId}`)
      .set(fixture.headers)
      .expect(200)
      .expect(({ body }) => {
        expect(body.map((savedView: { id: string }) => savedView.id)).toEqual([
          sharedProjectView.id,
          actorProjectPersonal.id
        ]);
        expect(body).toEqual([
          expect.objectContaining({
            id: sharedProjectView.id,
            scope: 'project',
            projectId: fixture.projectId,
            visibility: 'workspace'
          }),
          expect.objectContaining({
            id: actorProjectPersonal.id,
            scope: 'project',
            projectId: fixture.projectId,
            visibility: 'personal'
          })
        ]);
        expect(body).not.toEqual(
          expect.arrayContaining([expect.objectContaining({ id: otherProjectPersonal.id })])
        );
      });
  });

  it('validates project-scoped saved view list query params', async () => {
    const fixture = await createFixture();
    const otherFixture = await createFixture();

    await request(app)
      .get(`/api/saved-work-views?projectId=${fixture.projectId}`)
      .set(fixture.headers)
      .expect(400)
      .expect(({ body }) => {
        expect(body.error).toEqual({
          code: 'VALIDATION_ERROR',
          message: 'Workspace saved views do not accept a project id.'
        });
      });

    await request(app)
      .get('/api/saved-work-views?scope=project')
      .set(fixture.headers)
      .expect(400)
      .expect(({ body }) => {
        expect(body.error).toEqual({
          code: 'VALIDATION_ERROR',
          message: 'Project saved views require a project id.'
        });
      });

    await request(app)
      .get(`/api/saved-work-views?scope=project&projectId=${randomUUID()}`)
      .set(fixture.headers)
      .expect(404)
      .expect(({ body }) => {
        expect(body.error).toEqual({
          code: 'NOT_FOUND',
          message: 'Project not found.'
        });
      });

    await request(app)
      .get(`/api/saved-work-views?scope=project&projectId=${otherFixture.projectId}`)
      .set(fixture.headers)
      .expect(404)
      .expect(({ body }) => {
        expect(body.error).toEqual({
          code: 'NOT_FOUND',
          message: 'Project not found.'
        });
      });
  });

  it('creates, mutates, and protects project-scoped saved views through endpoints', async () => {
    const fixture = await createFixture();

    await request(app)
      .post('/api/saved-work-views')
      .set(fixture.headers)
      .send({
        name: 'Project triage',
        visibility: 'workspace',
        query: { blocked: true }
      })
      .expect(201);

    const ownerCreateResponse = await request(app)
      .post('/api/saved-work-views')
      .set(fixture.headers)
      .send({
        name: 'Project triage',
        scope: 'project',
        projectId: fixture.projectId,
        visibility: 'workspace',
        query: {
          projectId: randomUUID(),
          archivedProjects: 'only',
          status: 'ready',
          sort: 'board_order'
        }
      })
      .expect(201);

    expect(ownerCreateResponse.body).toMatchObject({
      workspaceId: fixture.workspaceId,
      owner: { id: fixture.actorId },
      name: 'Project triage',
      scope: 'project',
      projectId: fixture.projectId,
      visibility: 'workspace',
      query: {
        status: 'ready',
        sort: 'board_order'
      }
    });
    expect(ownerCreateResponse.body.query.projectId).toBeUndefined();
    expect(ownerCreateResponse.body.query.archivedProjects).toBeUndefined();

    await request(app)
      .post('/api/saved-work-views')
      .set(fixture.otherHeaders)
      .send({
        name: 'project TRIAGE',
        scope: 'project',
        projectId: fixture.projectId,
        visibility: 'workspace',
        query: { priority: 'urgent' }
      })
      .expect(409)
      .expect(({ body }) => {
        expect(body.error).toEqual({
          code: 'CONFLICT',
          message: 'A saved view with this name already exists.'
        });
      });

    await request(app)
      .post('/api/saved-work-views')
      .set(fixture.otherHeaders)
      .send({
        name: 'Maintainer project view',
        scope: 'project',
        projectId: fixture.projectId,
        visibility: 'workspace',
        query: { priority: 'high' }
      })
      .expect(201);

    await request(app)
      .post('/api/saved-work-views')
      .set(fixture.contributorHeaders)
      .send({
        name: 'Contributor shared project view',
        scope: 'project',
        projectId: fixture.projectId,
        visibility: 'workspace',
        query: { workState: 'open' }
      })
      .expect(403)
      .expect(({ body }) => {
        expect(body.error).toEqual({
          code: 'FORBIDDEN',
          message: 'Only owners and maintainers can create shared saved views.'
        });
      });

    const contributorCreateResponse = await request(app)
      .post('/api/saved-work-views')
      .set(fixture.contributorHeaders)
      .send({
        name: 'My project pickup',
        scope: 'project',
        projectId: fixture.projectId,
        query: { assigneeId: fixture.contributorId }
      })
      .expect(201);

    expect(contributorCreateResponse.body).toMatchObject({
      scope: 'project',
      projectId: fixture.projectId,
      visibility: 'personal',
      owner: { id: fixture.contributorId }
    });

    await request(app)
      .post('/api/saved-work-views')
      .set(fixture.headers)
      .send({
        name: 'Archived project view',
        scope: 'project',
        projectId: fixture.archivedProjectId,
        visibility: 'workspace',
        query: { workState: 'open' }
      })
      .expect(403)
      .expect(({ body }) => {
        expect(body.error).toEqual({
          code: 'FORBIDDEN',
          message: 'Archived projects do not allow saved view changes.'
        });
      });

    await request(app)
      .get(`/api/saved-work-views?scope=project&projectId=${fixture.archivedProjectId}`)
      .set(fixture.headers)
      .expect(200, []);

    await request(app)
      .patch(`/api/saved-work-views/${ownerCreateResponse.body.id}`)
      .set(fixture.otherHeaders)
      .send({
        name: 'Project triage review',
        query: { priority: 'urgent', archivedProjects: 'include' }
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          id: ownerCreateResponse.body.id,
          name: 'Project triage review',
          scope: 'project',
          projectId: fixture.projectId,
          query: { priority: 'urgent', sort: 'updated_desc' }
        });
        expect(body.query.archivedProjects).toBeUndefined();
      });

    await request(app)
      .patch(`/api/saved-work-views/${ownerCreateResponse.body.id}`)
      .set(fixture.contributorHeaders)
      .send({ name: 'Contributor rename' })
      .expect(403);

    await request(app)
      .delete(`/api/saved-work-views/${ownerCreateResponse.body.id}`)
      .set(fixture.contributorHeaders)
      .expect(403);

    await request(app)
      .delete(`/api/saved-work-views/${ownerCreateResponse.body.id}`)
      .set(fixture.headers)
      .expect(204);

    expect(await repositories.savedWorkViews.findById(ownerCreateResponse.body.id)).toBeNull();

    const projectActivity = await repositories.activityEvents.findByProject(fixture.projectId);
    expect(projectActivity).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actorId: fixture.actorId,
          eventType: 'saved_view.created',
          metadata: {
            savedViewId: ownerCreateResponse.body.id,
            scope: 'project',
            visibility: 'workspace'
          }
        }),
        expect.objectContaining({
          actorId: fixture.otherMemberId,
          eventType: 'saved_view.updated',
          metadata: {
            savedViewId: ownerCreateResponse.body.id,
            scope: 'project',
            visibility: 'workspace'
          }
        }),
        expect.objectContaining({
          actorId: fixture.actorId,
          eventType: 'saved_view.deleted',
          metadata: {
            savedViewId: ownerCreateResponse.body.id,
            scope: 'project',
            visibility: 'workspace'
          }
        })
      ])
    );
  });

  it('supports project-scoped saved view service behavior without leaking workspace views', async () => {
    const fixture = await createFixture();
    const ownerService = savedViewService({
      workspaceId: fixture.workspaceId,
      memberId: fixture.actorId,
      role: 'owner'
    });
    const maintainerService = savedViewService({
      workspaceId: fixture.workspaceId,
      memberId: fixture.otherMemberId,
      role: 'maintainer'
    });
    const contributorService = savedViewService({
      workspaceId: fixture.workspaceId,
      memberId: fixture.contributorId,
      role: 'contributor'
    });

    const workspaceView = await ownerService.createSavedView({
      name: 'Workspace blockers',
      visibility: 'workspace',
      query: { blocked: true }
    });
    const sharedProjectView = await ownerService.createSavedView({
      name: 'Ready for QA',
      scope: 'project',
      projectId: fixture.projectId,
      visibility: 'workspace',
      query: {
        projectId: randomUUID(),
        archivedProjects: 'only',
        status: 'ready',
        sort: 'board_order'
      }
    });
    const contributorPersonalProjectView = await contributorService.createSavedView({
      name: 'My project pickup',
      scope: 'project',
      projectId: fixture.projectId,
      query: {
        assigneeId: fixture.contributorId,
        workState: 'open',
        archivedProjects: 'include'
      }
    });

    expect(sharedProjectView).toMatchObject({
      workspaceId: fixture.workspaceId,
      projectId: fixture.projectId,
      scope: 'project',
      visibility: 'workspace',
      query: {
        status: 'ready',
        sort: 'board_order'
      }
    });
    expect(sharedProjectView.query.projectId).toBeUndefined();
    expect(sharedProjectView.query.archivedProjects).toBeUndefined();

    await expect(ownerService.listSavedViews()).resolves.toEqual([
      expect.objectContaining({
        id: workspaceView.id,
        scope: 'workspace',
        projectId: null
      })
    ]);

    await expect(
      ownerService.listSavedViews({ scope: 'project', projectId: fixture.projectId })
    ).resolves.toEqual([
      expect.objectContaining({
        id: sharedProjectView.id,
        scope: 'project',
        visibility: 'workspace'
      })
    ]);

    await expect(
      contributorService.listSavedViews({ scope: 'project', projectId: fixture.projectId })
    ).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: sharedProjectView.id }),
        expect.objectContaining({ id: contributorPersonalProjectView.id })
      ])
    );

    await expect(
      contributorService.createSavedView({
        name: 'Contributor shared project view',
        scope: 'project',
        projectId: fixture.projectId,
        visibility: 'workspace',
        query: { workState: 'open' }
      })
    ).rejects.toMatchObject({
      status: 403,
      message: 'Only owners and maintainers can create shared saved views.'
    });

    await maintainerService.updateSavedView(sharedProjectView.id, {
      name: 'Ready for QA review',
      query: { priority: 'urgent', archivedProjects: 'include' }
    });

    await expect(
      contributorService.updateSavedView(sharedProjectView.id, { name: 'Contributor rename' })
    ).rejects.toMatchObject({
      status: 403,
      message: 'Only owners and maintainers can manage shared saved views.'
    });

    const projectActivity = await repositories.activityEvents.findByProject(fixture.projectId);
    expect(projectActivity).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actorId: fixture.actorId,
          eventType: 'saved_view.created',
          summary: 'Saved Views Actor created shared project view Ready for QA.',
          metadata: {
            savedViewId: sharedProjectView.id,
            scope: 'project',
            visibility: 'workspace'
          }
        }),
        expect.objectContaining({
          actorId: fixture.otherMemberId,
          eventType: 'saved_view.updated',
          summary: 'Saved Views Other Actor updated shared project view Ready for QA review.',
          previousValue: expect.objectContaining({
            name: 'Ready for QA',
            scope: 'project',
            projectId: fixture.projectId
          }),
          newValue: expect.objectContaining({
            name: 'Ready for QA review',
            scope: 'project',
            projectId: fixture.projectId
          })
        })
      ])
    );
    await expect(repositories.workspaceActivityEvents.findByWorkspace(fixture.workspaceId)).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          metadata: { savedViewId: workspaceView.id }
        })
      ])
    );

    await expect(
      ownerService.createSavedView({
        name: 'Archived project view',
        scope: 'project',
        projectId: fixture.archivedProjectId,
        visibility: 'workspace',
        query: { workState: 'open' }
      })
    ).rejects.toMatchObject({
      status: 403,
      message: 'Archived projects do not allow saved view changes.'
    });
  });

  it('allows owners and maintainers to update and delete workspace views but blocks contributors', async () => {
    const fixture = await createFixture();

    const createResponse = await request(app)
      .post('/api/saved-work-views')
      .set(fixture.headers)
      .send({
        name: 'Shared blockers',
        visibility: 'workspace',
        query: { blocked: true }
      })
      .expect(201);

    await request(app)
      .get('/api/saved-work-views')
      .set(fixture.contributorHeaders)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual([
          expect.objectContaining({
            id: createResponse.body.id,
            visibility: 'workspace'
          })
        ]);
      });

    await request(app)
      .patch(`/api/saved-work-views/${createResponse.body.id}`)
      .set(fixture.otherHeaders)
      .send({
        name: 'Shared urgent blockers',
        query: {
          priority: 'urgent',
          dependency: 'dependency_blocked',
          unexpectedFilter: 'not persisted'
        }
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          id: createResponse.body.id,
          owner: { id: fixture.actorId },
          name: 'Shared urgent blockers',
          visibility: 'workspace',
          query: {
            priority: 'urgent',
            dependency: 'dependency_blocked',
            archivedProjects: 'exclude',
            sort: 'updated_desc'
          }
        });
        expect(body.query.unexpectedFilter).toBeUndefined();
      });

    await request(app)
      .patch(`/api/saved-work-views/${createResponse.body.id}`)
      .set(fixture.contributorHeaders)
      .send({ name: 'Contributor rename' })
      .expect(403)
      .expect(({ body }) => {
        expect(body.error).toEqual({
          code: 'FORBIDDEN',
          message: 'Only owners and maintainers can manage shared saved views.'
        });
      });

    await request(app)
      .delete(`/api/saved-work-views/${createResponse.body.id}`)
      .set(fixture.contributorHeaders)
      .expect(403);

    await request(app)
      .delete(`/api/saved-work-views/${createResponse.body.id}`)
      .set(fixture.headers)
      .expect(204);

    expect(await repositories.savedWorkViews.findById(createResponse.body.id)).toBeNull();

    const activity = await repositories.workspaceActivityEvents.findByWorkspace(fixture.workspaceId);
    expect(activity).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actorId: fixture.actorId,
          eventType: 'saved_view.created',
          metadata: { savedViewId: createResponse.body.id }
        }),
        expect.objectContaining({
          actorId: fixture.otherMemberId,
          eventType: 'saved_view.updated',
          previousValue: expect.objectContaining({ name: 'Shared blockers' }),
          newValue: expect.objectContaining({ name: 'Shared urgent blockers' }),
          metadata: { savedViewId: createResponse.body.id }
        }),
        expect.objectContaining({
          actorId: fixture.actorId,
          eventType: 'saved_view.deleted',
          previousValue: expect.objectContaining({
            name: 'Shared urgent blockers',
            visibility: 'workspace'
          }),
          newValue: null,
          metadata: { savedViewId: createResponse.body.id }
        })
      ])
    );
  });

  it('hides saved views from other actors on update and delete', async () => {
    const fixture = await createFixture();
    const savedView = await repositories.savedWorkViews.create({
      id: randomUUID(),
      workspaceId: fixture.workspaceId,
      ownerMemberId: fixture.actorId,
      name: 'My open work',
      visibility: 'personal',
      query: { assigneeId: fixture.actorId, workState: 'open' },
      createdAt: now(),
      updatedAt: now()
    });

    await request(app)
      .patch(`/api/saved-work-views/${savedView.id}`)
      .set(fixture.otherHeaders)
      .send({ name: 'Renamed by another actor' })
      .expect(404)
      .expect(({ body }) => {
        expect(body.error).toEqual({
          code: 'NOT_FOUND',
          message: 'Saved view not found.'
        });
      });

    await request(app)
      .delete(`/api/saved-work-views/${savedView.id}`)
      .set(fixture.otherHeaders)
      .expect(404);

    expect(await repositories.savedWorkViews.findById(savedView.id)).toMatchObject({
      id: savedView.id,
      name: 'My open work'
    });
  });

  it('rejects invalid saved query payloads but allows stale references', async () => {
    const fixture = await createFixture();
    const savedView = await repositories.savedWorkViews.create({
      id: randomUUID(),
      workspaceId: fixture.workspaceId,
      ownerMemberId: fixture.actorId,
      name: 'Existing saved view',
      visibility: 'personal',
      query: { archivedProjects: 'exclude', sort: 'updated_desc' },
      createdAt: now(),
      updatedAt: now()
    });

    await request(app)
      .post('/api/saved-work-views')
      .set(fixture.headers)
      .send({
        name: 'Invalid query',
        query: {
          blocked: true,
          status: 'ready'
        }
      })
      .expect(400)
      .expect(({ body }) => {
        expect(body.error).toEqual({
          code: 'VALIDATION_ERROR',
          message: 'Blocked work item queries cannot specify another status.'
        });
      });

    await request(app)
      .patch(`/api/saved-work-views/${savedView.id}`)
      .set(fixture.headers)
      .send({
        query: {
          status: 'ready',
          workState: 'open'
        }
      })
      .expect(400)
      .expect(({ body }) => {
        expect(body.error).toEqual({
          code: 'VALIDATION_ERROR',
          message: 'Work item queries cannot specify both status and work state.'
        });
      });

    await request(app)
      .post('/api/saved-work-views')
      .set(fixture.headers)
      .send({
        name: 'Invalid dependency query',
        query: {
          dependency: 'blocked_by_anything'
        }
      })
      .expect(400)
      .expect(({ body }) => {
        expect(body.error.code).toBe('VALIDATION_ERROR');
      });

    const staleLabelId = randomUUID();

    await request(app)
      .post('/api/saved-work-views')
      .set(fixture.headers)
      .send({
        name: 'Stale label reference',
        query: {
          labelId: staleLabelId
        }
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body.query).toMatchObject({
          labelId: staleLabelId,
          archivedProjects: 'exclude',
          sort: 'updated_desc'
        });
      });
  });
});
