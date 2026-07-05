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

function earlier() {
  return new Date('2026-07-02T12:00:00.000Z');
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

async function createWorkspaceFixture(role: 'owner' | 'maintainer' | 'contributor' = 'owner') {
  const timestamp = now();
  const workspaceId = randomUUID();
  const actorId = randomUUID();
  workspaceIds.add(workspaceId);

  await repositories.workspaces.create({
    id: workspaceId,
    name: 'Workspace Settings Test',
    createdAt: earlier(),
    updatedAt: timestamp
  });

  await repositories.members.create({
    id: actorId,
    workspaceId,
    name: 'Workspace Actor',
    email: `${actorId}@example.com`,
    role,
    isActive: true,
    createdAt: earlier(),
    updatedAt: timestamp
  });

  return {
    workspaceId,
    actorId,
    headers: actorHeaders({ workspaceId, memberId: actorId, role })
  };
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

describe('workspace API', () => {
  it('returns the current workspace', async () => {
    const fixture = await createWorkspaceFixture('owner');

    await request(app)
      .get('/api/workspace')
      .set(fixture.headers)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({
          id: fixture.workspaceId,
          name: 'Workspace Settings Test',
          createdAt: '2026-07-02T12:00:00.000Z',
          updatedAt: '2026-07-03T12:00:00.000Z'
        });
      });
  });

  it('updates workspace name for owners and records activity', async () => {
    const fixture = await createWorkspaceFixture('owner');

    await request(app)
      .patch('/api/workspace')
      .set(fixture.headers)
      .send({ name: 'Renamed Workspace' })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          id: fixture.workspaceId,
          name: 'Renamed Workspace'
        });
      });

    const events = await repositories.workspaceActivityEvents.findByWorkspace(fixture.workspaceId);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      workspaceId: fixture.workspaceId,
      actorId: fixture.actorId,
      eventType: 'workspace.name_changed',
      previousValue: { name: 'Workspace Settings Test' },
      newValue: { name: 'Renamed Workspace' }
    });
  });

  it('rejects workspace name updates for maintainers and contributors', async () => {
    const maintainerFixture = await createWorkspaceFixture('maintainer');
    const contributorFixture = await createWorkspaceFixture('contributor');

    await request(app)
      .patch('/api/workspace')
      .set(maintainerFixture.headers)
      .send({ name: 'Maintainer Rename' })
      .expect(403)
      .expect(({ body }) => {
        expect(body.error).toEqual({
          code: 'FORBIDDEN',
          message: 'Only owners can update workspace settings.'
        });
      });

    await request(app)
      .patch('/api/workspace')
      .set(contributorFixture.headers)
      .send({ name: 'Contributor Rename' })
      .expect(403)
      .expect(({ body }) => {
        expect(body.error.code).toBe('FORBIDDEN');
      });
  });

  it('returns role-derived capabilities', async () => {
    const ownerFixture = await createWorkspaceFixture('owner');
    const maintainerFixture = await createWorkspaceFixture('maintainer');
    const contributorFixture = await createWorkspaceFixture('contributor');

    await request(app)
      .get('/api/workspace/capabilities')
      .set(ownerFixture.headers)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          actor: { id: ownerFixture.actorId, role: 'owner' },
          canManageWorkspace: true,
          canManageMembers: true,
          canCreateProjects: true,
          canManageProjects: true,
          canManageMilestones: true,
          canManageLabels: true,
          canCreateWorkItems: true
        });
        expect(body.roleSummary.owner).toContain('Owners manage workspace members');
      });

    await request(app)
      .get('/api/workspace/capabilities')
      .set(maintainerFixture.headers)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          actor: { id: maintainerFixture.actorId, role: 'maintainer' },
          canManageWorkspace: false,
          canManageMembers: false,
          canCreateProjects: true,
          canManageProjects: true,
          canManageMilestones: true,
          canManageLabels: true,
          canCreateWorkItems: true
        });
      });

    await request(app)
      .get('/api/workspace/capabilities')
      .set(contributorFixture.headers)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          actor: { id: contributorFixture.actorId, role: 'contributor' },
          canManageWorkspace: false,
          canManageMembers: false,
          canCreateProjects: false,
          canManageProjects: false,
          canManageMilestones: false,
          canManageLabels: false,
          canCreateWorkItems: true
        });
      });
  });

  it('lists workspace activity newest first with resolved actors', async () => {
    const fixture = await createWorkspaceFixture('owner');

    await repositories.workspaceActivityEvents.create({
      id: randomUUID(),
      workspaceId: fixture.workspaceId,
      actorId: fixture.actorId,
      eventType: 'member.created',
      summary: 'Workspace Actor added a member.',
      previousValue: null,
      newValue: { role: 'contributor' },
      metadata: { memberId: randomUUID() },
      createdAt: earlier()
    });
    await repositories.workspaceActivityEvents.create({
      id: randomUUID(),
      workspaceId: fixture.workspaceId,
      actorId: fixture.actorId,
      eventType: 'workspace.name_changed',
      summary: 'Workspace Actor renamed the workspace.',
      previousValue: { name: 'Workspace Settings Test' },
      newValue: { name: 'Renamed Workspace' },
      metadata: {},
      createdAt: now()
    });

    await request(app)
      .get('/api/workspace/activity')
      .set(fixture.headers)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toHaveLength(2);
        expect(body[0]).toMatchObject({
          workspaceId: fixture.workspaceId,
          actor: {
            id: fixture.actorId,
            name: 'Workspace Actor',
            role: 'owner',
            isActive: true
          },
          eventType: 'workspace.name_changed',
          previousValue: { name: 'Workspace Settings Test' },
          newValue: { name: 'Renamed Workspace' },
          metadata: {}
        });
        expect(body[1]).toMatchObject({
          eventType: 'member.created',
          newValue: { role: 'contributor' }
        });
      });
  });
});
