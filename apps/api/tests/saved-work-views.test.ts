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

  return {
    workspaceId,
    actorId,
    otherMemberId,
    contributorId,
    headers: actorHeaders({ workspaceId, memberId: actorId, role: 'owner' }),
    otherHeaders: actorHeaders({ workspaceId, memberId: otherMemberId, role: 'maintainer' }),
    contributorHeaders: actorHeaders({
      workspaceId,
      memberId: contributorId,
      role: 'contributor'
    })
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
