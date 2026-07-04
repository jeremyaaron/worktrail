import { randomUUID } from 'node:crypto';

import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { createExpressApp } from '../src/adapters/express/server.js';
import { createDb, createPool } from '../src/db/client.js';
import { createRepositories, type Repositories } from '../src/repositories/index.js';
import { MyWorkService } from '../src/services/my-work-service.js';

const workspaceIds = new Set<string>();
let pool: ReturnType<typeof createPool>;
let db: ReturnType<typeof createDb>;
let repositories: Repositories;
let app: ReturnType<typeof createExpressApp>;

function now() {
  return new Date('2026-07-04T12:00:00.000Z');
}

function staleUpdatedAt() {
  return new Date('2026-06-20T12:00:00.000Z');
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

async function createFixture() {
  const timestamp = now();
  const workspaceId = randomUUID();
  const actorId = randomUUID();
  const otherMemberId = randomUUID();
  const projectId = randomUUID();
  const otherProjectId = randomUUID();
  const archivedProjectId = randomUUID();
  workspaceIds.add(workspaceId);

  await repositories.workspaces.create({
    id: workspaceId,
    name: 'My Work Test Workspace',
    createdAt: timestamp,
    updatedAt: timestamp
  });

  await repositories.members.create({
    id: actorId,
    workspaceId,
    name: 'My Work Actor',
    email: `${actorId}@example.com`,
    role: 'owner',
    isActive: true,
    createdAt: timestamp,
    updatedAt: timestamp
  });

  await repositories.members.create({
    id: otherMemberId,
    workspaceId,
    name: 'My Work Teammate',
    email: `${otherMemberId}@example.com`,
    role: 'contributor',
    isActive: true,
    createdAt: timestamp,
    updatedAt: timestamp
  });

  for (const project of [
    { id: projectId, key: 'MW', name: 'My Work Project', status: 'active' as const },
    { id: otherProjectId, key: 'OPS', name: 'Operations Project', status: 'active' as const },
    { id: archivedProjectId, key: 'OLD', name: 'Archived Project', status: 'archived' as const }
  ]) {
    await repositories.projects.create({
      id: project.id,
      workspaceId,
      key: project.key,
      nextWorkItemNumber: 1,
      name: project.name,
      description: 'Project for My Work tests.',
      status: project.status,
      createdAt: timestamp,
      updatedAt: timestamp
    });
  }

  return {
    workspaceId,
    actorId,
    otherMemberId,
    projectId,
    otherProjectId,
    archivedProjectId,
    actor: {
      workspaceId,
      memberId: actorId,
      role: 'owner' as const
    },
    headers: actorHeaders({ workspaceId, memberId: actorId, role: 'owner' })
  };
}

let nextItemNumber = 1;

async function createWorkItem(
  fixture: Awaited<ReturnType<typeof createFixture>>,
  input: {
    title: string;
    projectId?: string;
    status?: 'backlog' | 'ready' | 'in_progress' | 'blocked' | 'done' | 'canceled';
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    assigneeId?: string | null;
    reporterId?: string;
    dueDate?: string | null;
    updatedAt?: Date;
  }
) {
  const itemNumber = nextItemNumber;
  nextItemNumber += 1;
  const projectId = input.projectId ?? fixture.projectId;

  return repositories.workItems.create({
    id: randomUUID(),
    workspaceId: fixture.workspaceId,
    projectId,
    title: input.title,
    description: '',
    itemNumber,
    displayKey: `${projectId === fixture.otherProjectId ? 'OPS' : projectId === fixture.archivedProjectId ? 'OLD' : 'MW'}-${itemNumber}`,
    type: 'task',
    status: input.status ?? 'backlog',
    priority: input.priority ?? 'medium',
    assigneeId: input.assigneeId === undefined ? fixture.actorId : input.assigneeId,
    reporterId: input.reporterId ?? fixture.otherMemberId,
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
  nextItemNumber = 1;
  await cleanupAllWorkspaces();
});

afterAll(async () => {
  await cleanupAllWorkspaces();
  await pool.end();
});

describe('My Work dashboard', () => {
  it('returns actor-scoped counts and limited sections with an injectable clock', async () => {
    const fixture = await createFixture();
    const assignedDueSoon = await createWorkItem(fixture, {
      title: 'Assigned due soon',
      status: 'backlog',
      dueDate: '2026-07-07',
      updatedAt: new Date('2026-07-03T12:00:00.000Z')
    });
    const assignedOverdueStale = await createWorkItem(fixture, {
      title: 'Assigned overdue stale',
      status: 'in_progress',
      dueDate: '2026-07-01',
      updatedAt: staleUpdatedAt()
    });
    const assignedBlockedStale = await createWorkItem(fixture, {
      title: 'Assigned blocked stale',
      status: 'blocked',
      priority: 'urgent',
      dueDate: '2026-07-06',
      updatedAt: staleUpdatedAt()
    });
    const reportedBlocked = await createWorkItem(fixture, {
      title: 'Reported blocked',
      status: 'blocked',
      priority: 'high',
      assigneeId: fixture.otherMemberId,
      reporterId: fixture.actorId,
      dueDate: '2026-07-05',
      updatedAt: new Date('2026-07-03T13:00:00.000Z')
    });
    const reportedReady = await createWorkItem(fixture, {
      title: 'Reported ready',
      status: 'ready',
      assigneeId: fixture.otherMemberId,
      reporterId: fixture.actorId,
      updatedAt: new Date('2026-07-02T12:00:00.000Z')
    });
    await createWorkItem(fixture, {
      title: 'Done assigned work',
      status: 'done',
      dueDate: '2026-07-01'
    });
    await createWorkItem(fixture, {
      title: 'Archived assigned work',
      projectId: fixture.archivedProjectId,
      status: 'ready',
      dueDate: '2026-07-08'
    });

    const service = new MyWorkService({
      actor: fixture.actor,
      repositories,
      clock: now
    });
    const dashboard = await service.getDashboard();

    expect(dashboard.actor).toMatchObject({
      id: fixture.actorId,
      name: 'My Work Actor',
      role: 'owner'
    });
    expect(dashboard.summaryCounts).toEqual([
      {
        key: 'assigned_open',
        label: 'Assigned open',
        count: 3,
        query: {
          archivedProjects: 'exclude',
          assigneeId: fixture.actorId,
          workState: 'open',
          sort: 'updated_desc'
        }
      },
      {
        key: 'due_soon',
        label: 'Due soon',
        count: 2,
        query: {
          archivedProjects: 'exclude',
          assigneeId: fixture.actorId,
          dueDateState: 'due_soon',
          sort: 'due_date_asc'
        }
      },
      {
        key: 'overdue',
        label: 'Overdue',
        count: 1,
        query: {
          archivedProjects: 'exclude',
          assigneeId: fixture.actorId,
          dueDateState: 'overdue',
          sort: 'due_date_asc'
        }
      },
      {
        key: 'blocked',
        label: 'Blocked',
        count: 2,
        query: {
          archivedProjects: 'exclude',
          blocked: true,
          sort: 'priority_desc'
        }
      },
      {
        key: 'stale_assigned',
        label: 'Stale assigned',
        count: 2,
        query: {
          archivedProjects: 'exclude',
          assigneeId: fixture.actorId,
          workState: 'open',
          sort: 'updated_asc'
        }
      },
      {
        key: 'reported_open',
        label: 'Reported open',
        count: 2,
        query: {
          archivedProjects: 'exclude',
          reporterId: fixture.actorId,
          workState: 'open',
          sort: 'updated_desc'
        }
      }
    ]);
    expect(dashboard.assignedToMe.map((item) => item.id)).toEqual([
      assignedDueSoon.id,
      assignedOverdueStale.id,
      assignedBlockedStale.id
    ]);
    expect(dashboard.dueSoonOrOverdue.map((item) => item.id)).toEqual([
      assignedOverdueStale.id,
      assignedBlockedStale.id,
      assignedDueSoon.id
    ]);
    expect(dashboard.blockedRelevant.map((item) => item.id)).toEqual([
      assignedBlockedStale.id,
      reportedBlocked.id
    ]);
    expect(dashboard.recentlyUpdated.map((item) => item.id)).toEqual([
      reportedBlocked.id,
      assignedDueSoon.id,
      reportedReady.id,
      assignedOverdueStale.id,
      assignedBlockedStale.id
    ]);
    expect(dashboard.assignedToMe.every((item) => item.project.status === 'active')).toBe(true);
  });

  it('returns empty dashboard sections when the actor has no relevant work', async () => {
    const fixture = await createFixture();

    const dashboard = await new MyWorkService({
      actor: fixture.actor,
      repositories,
      clock: now
    }).getDashboard();

    expect(dashboard.summaryCounts.map((count) => count.count)).toEqual([0, 0, 0, 0, 0, 0]);
    expect(dashboard.assignedToMe).toEqual([]);
    expect(dashboard.dueSoonOrOverdue).toEqual([]);
    expect(dashboard.blockedRelevant).toEqual([]);
    expect(dashboard.recentlyUpdated).toEqual([]);
  });

  it('serves My Work through the API', async () => {
    const fixture = await createFixture();
    await createWorkItem(fixture, {
      title: 'Endpoint visible work',
      status: 'ready',
      dueDate: '2026-07-07'
    });

    await request(app)
      .get('/api/my-work')
      .set(fixture.headers)
      .expect(200)
      .expect(({ body }) => {
        expect(body.actor).toMatchObject({ id: fixture.actorId });
        expect(body.summaryCounts.find((count: { key: string }) => count.key === 'assigned_open')).toMatchObject({
          count: 1
        });
        expect(body.assignedToMe).toEqual([
          expect.objectContaining({
            title: 'Endpoint visible work',
            project: expect.objectContaining({ key: 'MW' })
          })
        ]);
      });
  });
});
