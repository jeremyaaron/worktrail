import { randomUUID } from 'node:crypto';

import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { createExpressApp } from '../src/adapters/express/server.js';
import { createDb, createPool } from '../src/db/client.js';
import { createRepositories, type Repositories } from '../src/repositories/index.js';
import { PlanningService } from '../src/services/planning-service.js';

const workspaceIds = new Set<string>();
let pool: ReturnType<typeof createPool>;
let db: ReturnType<typeof createDb>;
let repositories: Repositories;
let app: ReturnType<typeof createExpressApp>;

function now() {
  return new Date('2026-07-10T12:00:00.000Z');
}

function staleUpdatedAt() {
  return new Date('2026-07-01T12:00:00.000Z');
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

async function createFixture(input: { projectStatus?: 'active' | 'archived' } = {}) {
  const timestamp = now();
  const workspaceId = randomUUID();
  const actorId = randomUUID();
  const assigneeId = randomUUID();
  const projectId = randomUUID();
  workspaceIds.add(workspaceId);

  await repositories.workspaces.create({
    id: workspaceId,
    name: 'Planning Test Workspace',
    createdAt: timestamp,
    updatedAt: timestamp
  });

  await repositories.members.create({
    id: actorId,
    workspaceId,
    name: 'Planning API Actor',
    email: `${actorId}@example.com`,
    role: 'owner',
    isActive: true,
    createdAt: timestamp,
    updatedAt: timestamp
  });

  await repositories.members.create({
    id: assigneeId,
    workspaceId,
    name: 'Planning Assignee',
    email: `${assigneeId}@example.com`,
    role: 'contributor',
    isActive: true,
    createdAt: timestamp,
    updatedAt: timestamp
  });

  await repositories.projects.create({
    id: projectId,
    workspaceId,
    key: 'PLAN',
    nextWorkItemNumber: 1,
    name: 'Planning Test Project',
    description: 'Project for planning summary tests.',
    status: input.projectStatus ?? 'active',
    createdAt: timestamp,
    updatedAt: timestamp
  });

  return {
    workspaceId,
    actorId,
    assigneeId,
    projectId,
    actor: {
      workspaceId,
      memberId: actorId,
      role: 'owner' as const
    },
    headers: actorHeaders({ workspaceId, memberId: actorId, role: 'owner' })
  };
}

async function createMilestone(
  fixture: Awaited<ReturnType<typeof createFixture>>,
  input: {
    name: string;
    status?: 'planned' | 'active' | 'completed' | 'canceled';
    targetDate?: string | null;
    archived?: boolean;
  }
) {
  return repositories.milestones.create({
    id: randomUUID(),
    workspaceId: fixture.workspaceId,
    projectId: fixture.projectId,
    name: input.name,
    description: '',
    status: input.status ?? 'active',
    targetDate: input.targetDate ?? null,
    archivedAt: input.archived === true ? now() : null,
    archivedById: input.archived === true ? fixture.actorId : null,
    createdAt: now(),
    updatedAt: now()
  });
}

let nextItemNumber = 1;

async function createWorkItem(
  fixture: Awaited<ReturnType<typeof createFixture>>,
  input: {
    title: string;
    status?: 'backlog' | 'ready' | 'in_progress' | 'blocked' | 'done' | 'canceled';
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    assigneeId?: string | null;
    milestoneId?: string | null;
    dueDate?: string | null;
    updatedAt?: Date;
  }
) {
  const itemNumber = nextItemNumber;
  nextItemNumber += 1;

  return repositories.workItems.create({
    id: randomUUID(),
    workspaceId: fixture.workspaceId,
    projectId: fixture.projectId,
    title: input.title,
    description: '',
    itemNumber,
    displayKey: `PLAN-${itemNumber}`,
    type: 'task',
    status: input.status ?? 'backlog',
    priority: input.priority ?? 'medium',
    assigneeId: input.assigneeId === undefined ? fixture.assigneeId : input.assigneeId,
    reporterId: fixture.actorId,
    milestoneId: input.milestoneId ?? null,
    boardPosition: itemNumber * 1024,
    dueDate: input.dueDate ?? null,
    estimatePoints: null,
    createdAt: now(),
    updatedAt: input.updatedAt ?? now()
  });
}

async function createBlockingRelationship(
  fixture: Awaited<ReturnType<typeof createFixture>>,
  input: {
    sourceWorkItemId: string;
    targetWorkItemId: string;
  }
) {
  return repositories.workItemRelationships.create({
    id: randomUUID(),
    workspaceId: fixture.workspaceId,
    relationshipType: 'blocks',
    sourceWorkItemId: input.sourceWorkItemId,
    targetWorkItemId: input.targetWorkItemId,
    createdById: fixture.actorId,
    createdAt: now()
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

describe('planning summary', () => {
  it('returns milestone progress and deterministic risk lists with an injectable clock', async () => {
    const fixture = await createFixture();
    const activeMilestone = await createMilestone(fixture, {
      name: 'v0.0.3',
      status: 'active',
      targetDate: '2026-07-18'
    });
    const plannedMilestone = await createMilestone(fixture, {
      name: 'v0.0.4',
      status: 'planned',
      targetDate: '2026-08-01'
    });
    await createMilestone(fixture, {
      name: 'completed target',
      status: 'completed',
      targetDate: '2026-06-01'
    });
    await createMilestone(fixture, {
      name: 'archived target',
      status: 'active',
      targetDate: '2026-07-20',
      archived: true
    });

    const blocked = await createWorkItem(fixture, {
      title: 'Blocked overdue work',
      status: 'blocked',
      priority: 'high',
      milestoneId: activeMilestone.id,
      dueDate: '2026-07-09'
    });
    const done = await createWorkItem(fixture, {
      title: 'Done old work',
      status: 'done',
      priority: 'medium',
      milestoneId: activeMilestone.id,
      dueDate: '2026-07-01'
    });
    const dueSoon = await createWorkItem(fixture, {
      title: 'Due soon unassigned work',
      status: 'ready',
      priority: 'urgent',
      assigneeId: null,
      milestoneId: activeMilestone.id,
      dueDate: '2026-07-14'
    });
    const stale = await createWorkItem(fixture, {
      title: 'Stale in-progress work',
      status: 'in_progress',
      priority: 'low',
      milestoneId: plannedMilestone.id,
      updatedAt: staleUpdatedAt()
    });
    const dependencyBlocker = await createWorkItem(fixture, {
      title: 'Blocking open dependency',
      status: 'ready',
      priority: 'high'
    });
    const dependencyBlocked = await createWorkItem(fixture, {
      title: 'Dependency-blocked delivery work',
      status: 'in_progress',
      priority: 'urgent'
    });
    await createBlockingRelationship(fixture, {
      sourceWorkItemId: dependencyBlocker.id,
      targetWorkItemId: dependencyBlocked.id
    });
    await createWorkItem(fixture, {
      title: 'Canceled old work',
      status: 'canceled',
      priority: 'urgent',
      milestoneId: plannedMilestone.id,
      dueDate: '2026-07-01'
    });

    const service = new PlanningService({
      actor: fixture.actor,
      repositories,
      clock: now
    });
    const summary = await service.getProjectPlanningSummary(fixture.projectId);

    expect(summary.project.id).toBe(fixture.projectId);
    expect(summary.deliveryHealth).toEqual({
      health: 'healthy',
      activeMilestoneCount: 0,
      healthyMilestoneCount: 0,
      atRiskMilestoneCount: 0,
      blockedMilestoneCount: 0,
      completeMilestoneCount: 0,
      inactiveMilestoneCount: 0,
      openWorkCount: 0,
      blockedWorkCount: 0,
      dependencyBlockedWorkCount: 0,
      blockingOpenWorkCount: 0,
      overdueWorkCount: 0,
      dueSoonWorkCount: 0,
      unassignedActiveWorkCount: 0,
      staleInProgressWorkCount: 0,
      unmilestonedActiveRiskCount: 0,
      reasons: []
    });
    expect(summary.planningReview).toEqual({
      needsAttention: [],
      upcoming: [],
      recentlyChanged: []
    });
    expect(summary.milestoneProgress).toEqual([
      {
        milestone: expect.objectContaining({ id: activeMilestone.id, name: 'v0.0.3' }),
        totalCount: 3,
        doneCount: 1,
        openCount: 2,
        blockedCount: 1,
        dependencyBlockedCount: 0,
        overdueCount: 1,
        dueSoonCount: 0,
        unassignedActiveCount: 0,
        staleInProgressCount: 0,
        health: 'healthy',
        reasons: []
      },
      {
        milestone: expect.objectContaining({ id: plannedMilestone.id, name: 'v0.0.4' }),
        totalCount: 2,
        doneCount: 0,
        openCount: 1,
        blockedCount: 0,
        dependencyBlockedCount: 0,
        overdueCount: 0,
        dueSoonCount: 0,
        unassignedActiveCount: 0,
        staleInProgressCount: 0,
        health: 'healthy',
        reasons: []
      }
    ]);
    expect(summary.blockedWork.map((item) => item.id)).toEqual([blocked.id]);
    expect(summary.overdueWork.map((item) => item.id)).toEqual([blocked.id]);
    expect(summary.dueSoonWork.map((item) => item.id)).toEqual([dueSoon.id]);
    expect(summary.unassignedActiveWork.map((item) => item.id)).toEqual([dueSoon.id]);
    expect(summary.staleInProgressWork.map((item) => item.id)).toEqual([stale.id]);
    expect(summary.dependencyBlockedWork.map((item) => item.id)).toEqual([dependencyBlocked.id]);
    expect(summary.blockingOpenWork.map((item) => item.id)).toEqual([dependencyBlocker.id]);
    expect(summary.blockedWork[0]).toMatchObject({
      assignee: expect.objectContaining({ id: fixture.assigneeId }),
      milestone: expect.objectContaining({ id: activeMilestone.id }),
      dueDate: '2026-07-09'
    });
    expect(summary.dependencyBlockedWork[0]).toMatchObject({
      assignee: expect.objectContaining({ id: fixture.assigneeId }),
      milestone: null
    });
    expect(summary.overdueWork.find((item) => item.id === done.id)).toBeUndefined();
  });

  it('serves planning summaries for archived projects', async () => {
    const fixture = await createFixture({ projectStatus: 'archived' });
    const milestone = await createMilestone(fixture, {
      name: 'archived project milestone',
      status: 'active',
      targetDate: '2026-07-18'
    });
    await createWorkItem(fixture, {
      title: 'Archived project readable item',
      status: 'blocked',
      milestoneId: milestone.id
    });

    await request(app)
      .get(`/api/projects/${fixture.projectId}/planning-summary`)
      .set(fixture.headers)
      .expect(200)
      .expect(({ body }) => {
        expect(body.project).toMatchObject({
          id: fixture.projectId,
          status: 'archived'
        });
        expect(body.milestoneProgress).toEqual([
          expect.objectContaining({
            milestone: expect.objectContaining({ id: milestone.id }),
            totalCount: 1,
            blockedCount: 1
          })
        ]);
        expect(body.blockedWork).toEqual([
          expect.objectContaining({
            title: 'Archived project readable item'
          })
        ]);
      });
  });
});
