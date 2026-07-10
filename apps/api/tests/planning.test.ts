import { randomUUID } from 'node:crypto';

import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { createExpressApp } from '../src/adapters/express/server.js';
import { createDb, createPool } from '../src/db/client.js';
import { createRepositories, type Repositories } from '../src/repositories/index.js';
import { MilestoneReviewService } from '../src/services/milestone-review-service.js';
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

async function createProjectCycle(
  fixture: Awaited<ReturnType<typeof createFixture>>,
  input: {
    name: string;
    status?: 'planned' | 'active' | 'completed' | 'canceled';
    startDate: string;
    endDate: string;
    targetPoints?: number | null;
  }
) {
  return repositories.projectCycles.create({
    id: randomUUID(),
    workspaceId: fixture.workspaceId,
    projectId: fixture.projectId,
    name: input.name,
    goal: `${input.name} delivery goal.`,
    status: input.status ?? 'planned',
    startDate: input.startDate,
    endDate: input.endDate,
    targetPoints: input.targetPoints ?? null,
    archivedAt: null,
    archivedById: null,
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
    cycleId?: string | null;
    dueDate?: string | null;
    estimatePoints?: number | null;
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
    cycleId: input.cycleId ?? null,
    boardPosition: itemNumber * 1024,
    dueDate: input.dueDate ?? null,
    estimatePoints: input.estimatePoints ?? null,
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
    expect(summary.deliveryHealth).toMatchObject({
      health: 'blocked',
      activeMilestoneCount: 2,
      atRiskMilestoneCount: 1,
      blockedMilestoneCount: 1,
      completeMilestoneCount: 1,
      inactiveMilestoneCount: 1,
      openWorkCount: 5,
      blockedWorkCount: 1,
      dependencyBlockedWorkCount: 1,
      blockingOpenWorkCount: 1,
      overdueWorkCount: 1,
      dueSoonWorkCount: 1,
      unassignedActiveWorkCount: 1,
      staleInProgressWorkCount: 1,
      unmilestonedActiveRiskCount: 2
    });
    expect(summary.deliveryHealth.reasons).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'blocked_work',
        severity: 'critical',
        query: { status: 'blocked', sort: 'priority_desc' }
      }),
      expect.objectContaining({
        key: 'dependency_blocked',
        severity: 'critical',
        query: { dependency: 'dependency_blocked', sort: 'priority_desc' }
      }),
      expect.objectContaining({
        key: 'unmilestoned_risk',
        query: null
      })
    ]));
    expect(summary.planningReview.needsAttention).toEqual(expect.arrayContaining([
      expect.objectContaining({
        workItemId: blocked.id,
        title: 'Blocked overdue work',
        severity: 'critical'
      }),
      expect.objectContaining({
        workItemId: dependencyBlocked.id,
        title: 'Dependency-blocked delivery work',
        severity: 'critical'
      }),
      expect.objectContaining({
        milestoneId: activeMilestone.id,
        title: 'v0.0.3',
        severity: 'critical'
      }),
      expect.objectContaining({
        milestoneId: plannedMilestone.id,
        title: 'v0.0.4',
        severity: 'warning'
      })
    ]));
    expect(summary.planningReview.upcoming).toEqual(expect.arrayContaining([
      expect.objectContaining({
        workItemId: dueSoon.id,
        title: 'Due soon unassigned work'
      }),
      expect.objectContaining({
        milestoneId: activeMilestone.id,
        title: 'v0.0.3'
      })
    ]));
    expect(summary.planningReview.recentlyChanged.length).toBeGreaterThan(0);
    expect(summary.milestoneProgress).toEqual([
      {
        milestone: expect.objectContaining({ id: activeMilestone.id, name: 'v0.0.3' }),
        totalCount: 3,
        doneCount: 1,
        openCount: 2,
        blockedCount: 1,
        dependencyBlockedCount: 0,
        overdueCount: 1,
        dueSoonCount: 1,
        unassignedActiveCount: 1,
        staleInProgressCount: 0,
        health: 'blocked',
        reasons: expect.arrayContaining([
          expect.objectContaining({
            key: 'blocked_work',
            query: {
              milestoneId: activeMilestone.id,
              status: 'blocked',
              sort: 'priority_desc'
            }
          }),
          expect.objectContaining({
            key: 'due_soon',
            query: {
              milestoneId: activeMilestone.id,
              dueDateState: 'due_soon',
              sort: 'due_date_asc'
            }
          })
        ])
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
        staleInProgressCount: 1,
        health: 'at_risk',
        reasons: [
          expect.objectContaining({
            key: 'stale_in_progress',
            query: {
              milestoneId: plannedMilestone.id,
              status: 'in_progress',
              sort: 'updated_asc'
            }
          })
        ]
      },
      {
        milestone: expect.objectContaining({ name: 'completed target' }),
        totalCount: 0,
        doneCount: 0,
        openCount: 0,
        blockedCount: 0,
        dependencyBlockedCount: 0,
        overdueCount: 0,
        dueSoonCount: 0,
        unassignedActiveCount: 0,
        staleInProgressCount: 0,
        health: 'complete',
        reasons: [
          expect.objectContaining({
            key: 'all_work_done'
          })
        ]
      },
      {
        milestone: expect.objectContaining({ name: 'archived target' }),
        totalCount: 0,
        doneCount: 0,
        openCount: 0,
        blockedCount: 0,
        dependencyBlockedCount: 0,
        overdueCount: 0,
        dueSoonCount: 0,
        unassignedActiveCount: 0,
        staleInProgressCount: 0,
        health: 'inactive',
        reasons: [
          expect.objectContaining({
            key: 'inactive_milestone'
          })
        ]
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

  it('includes active, upcoming, and recently completed cycle summaries', async () => {
    const fixture = await createFixture();
    const activeCycle = await createProjectCycle(fixture, {
      name: 'Active cycle',
      status: 'active',
      startDate: '2026-07-08',
      endDate: '2026-07-15',
      targetPoints: 8
    });
    const upcomingCycle = await createProjectCycle(fixture, {
      name: 'Upcoming cycle',
      status: 'planned',
      startDate: '2026-07-20',
      endDate: '2026-07-27'
    });
    const completedCycle = await createProjectCycle(fixture, {
      name: 'Completed cycle',
      status: 'completed',
      startDate: '2026-06-20',
      endDate: '2026-06-27'
    });
    await createWorkItem(fixture, {
      title: 'Active cycle blocked work',
      status: 'blocked',
      cycleId: activeCycle.id,
      estimatePoints: 5
    });
    await createWorkItem(fixture, {
      title: 'Active cycle complete work',
      status: 'done',
      cycleId: activeCycle.id,
      estimatePoints: 3
    });

    const service = new PlanningService({
      actor: fixture.actor,
      repositories,
      clock: now
    });
    const summary = await service.getProjectPlanningSummary(fixture.projectId);

    expect(summary.activeCycle).toMatchObject({
      cycle: { id: activeCycle.id, name: 'Active cycle' },
      progress: {
        totalCount: 2,
        openCount: 1,
        doneCount: 1,
        blockedCount: 1,
        committedEstimatePoints: 8,
        completedEstimatePoints: 3,
        targetPoints: 8
      },
      health: {
        health: 'blocked',
        reasons: expect.arrayContaining([
          expect.objectContaining({
            key: 'blocked_work',
            query: { cycleId: activeCycle.id, status: 'blocked', sort: 'priority_desc' }
          })
        ])
      },
      scopedWorkQuery: { cycleId: activeCycle.id, sort: 'priority_desc' }
    });
    expect(summary.upcomingCycle).toMatchObject({
      cycle: { id: upcomingCycle.id, name: 'Upcoming cycle' },
      progress: { totalCount: 0, openCount: 0, committedEstimatePoints: 0 },
      health: { health: 'healthy' },
      scopedWorkQuery: { cycleId: upcomingCycle.id, sort: 'priority_desc' }
    });
    expect(summary.recentlyCompletedCycle).toMatchObject({
      cycle: { id: completedCycle.id, name: 'Completed cycle' },
      health: { health: 'complete' },
      scopedWorkQuery: { cycleId: completedCycle.id, sort: 'priority_desc' }
    });
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
        expect(body.deliveryHealth).toMatchObject({
          health: 'inactive'
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

  it('derives milestone review scope, risk sections, and recent movement', async () => {
    const fixture = await createFixture();
    const milestone = await createMilestone(fixture, {
      name: 'release review',
      status: 'active',
      targetDate: '2026-07-18'
    });
    const otherMilestone = await createMilestone(fixture, {
      name: 'future review',
      status: 'planned',
      targetDate: '2026-08-01'
    });
    const blocked = await createWorkItem(fixture, {
      title: 'Blocked overdue milestone work',
      status: 'blocked',
      priority: 'high',
      milestoneId: milestone.id,
      dueDate: '2026-07-09',
      updatedAt: new Date('2026-07-09T12:00:00.000Z')
    });
    const dependencyBlocked = await createWorkItem(fixture, {
      title: 'Dependency-blocked milestone work',
      status: 'in_progress',
      priority: 'urgent',
      milestoneId: milestone.id,
      updatedAt: staleUpdatedAt()
    });
    const openBlocker = await createWorkItem(fixture, {
      title: 'Milestone blocker for other work',
      status: 'ready',
      priority: 'high',
      milestoneId: milestone.id,
      updatedAt: new Date('2026-07-08T12:00:00.000Z')
    });
    const dueSoonUnassigned = await createWorkItem(fixture, {
      title: 'Due soon unassigned milestone work',
      status: 'ready',
      priority: 'medium',
      assigneeId: null,
      milestoneId: milestone.id,
      dueDate: '2026-07-14',
      updatedAt: new Date('2026-07-07T12:00:00.000Z')
    });
    const done = await createWorkItem(fixture, {
      title: 'Done milestone work',
      status: 'done',
      priority: 'low',
      milestoneId: milestone.id,
      dueDate: '2026-08-01',
      updatedAt: new Date('2026-07-06T12:00:00.000Z')
    });
    const externalBlocker = await createWorkItem(fixture, {
      title: 'External blocker',
      status: 'ready',
      priority: 'high',
      milestoneId: otherMilestone.id
    });
    const externalBlocked = await createWorkItem(fixture, {
      title: 'External blocked work',
      status: 'ready',
      priority: 'medium',
      milestoneId: otherMilestone.id
    });
    await createBlockingRelationship(fixture, {
      sourceWorkItemId: externalBlocker.id,
      targetWorkItemId: dependencyBlocked.id
    });
    await createBlockingRelationship(fixture, {
      sourceWorkItemId: openBlocker.id,
      targetWorkItemId: externalBlocked.id
    });

    const service = new MilestoneReviewService({
      actor: fixture.actor,
      repositories,
      clock: now
    });
    const review = await service.getMilestoneReview(fixture.projectId, milestone.id);

    expect(review.project.id).toBe(fixture.projectId);
    expect(review.milestone.id).toBe(milestone.id);
    expect(review.scopedWorkQuery).toEqual({
      milestoneId: milestone.id,
      sort: 'priority_desc'
    });
    expect(review.progress).toMatchObject({
      totalCount: 5,
      doneCount: 1,
      openCount: 4,
      blockedCount: 1,
      dependencyBlockedCount: 1,
      overdueCount: 1,
      dueSoonCount: 1,
      unassignedActiveCount: 1,
      staleInProgressCount: 1,
      health: 'blocked'
    });
    expect(review.scopeBreakdown).toMatchObject({
      statusCounts: {
        backlog: 0,
        ready: 2,
        in_progress: 1,
        blocked: 1,
        done: 1,
        canceled: 0
      },
      priorityCounts: {
        low: 1,
        medium: 1,
        high: 2,
        urgent: 1
      },
      assignedCount: 4,
      unassignedCount: 1,
      dueDate: {
        overdueCount: 1,
        dueSoonCount: 1,
        laterCount: 1,
        noneCount: 2
      },
      dependency: {
        dependencyBlockedCount: 1,
        blockingOpenWorkCount: 1
      }
    });
    expect(review.riskSections.map((section) => section.type)).toEqual([
      'blocked',
      'dependency_blocked',
      'overdue',
      'due_soon',
      'unassigned_active',
      'stale_in_progress',
      'blocking_open_work'
    ]);
    expect(review.riskSections).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'blocked',
        count: 1,
        query: {
          milestoneId: milestone.id,
          status: 'blocked',
          sort: 'priority_desc'
        },
        items: [expect.objectContaining({ id: blocked.id, milestone: expect.objectContaining({ id: milestone.id }) })]
      }),
      expect.objectContaining({
        type: 'dependency_blocked',
        count: 1,
        query: {
          milestoneId: milestone.id,
          dependency: 'dependency_blocked',
          sort: 'priority_desc'
        },
        items: [expect.objectContaining({ id: dependencyBlocked.id })]
      }),
      expect.objectContaining({
        type: 'unassigned_active',
        count: 1,
        query: {
          milestoneId: milestone.id,
          workRisk: 'unassigned_active',
          sort: 'priority_desc'
        },
        items: [expect.objectContaining({ id: dueSoonUnassigned.id, assignee: null })]
      }),
      expect.objectContaining({
        type: 'stale_in_progress',
        count: 1,
        query: {
          milestoneId: milestone.id,
          workRisk: 'stale_in_progress',
          sort: 'updated_asc'
        },
        items: [expect.objectContaining({ id: dependencyBlocked.id })]
      }),
      expect.objectContaining({
        type: 'blocking_open_work',
        count: 1,
        items: [expect.objectContaining({ id: openBlocker.id })]
      })
    ]));
    expect(review.recentlyChangedWork.map((item) => item.id)).toEqual([
      blocked.id,
      openBlocker.id,
      dueSoonUnassigned.id,
      done.id,
      dependencyBlocked.id
    ]);
  });

  it('serves milestone review responses from the planning endpoint', async () => {
    const fixture = await createFixture({ projectStatus: 'archived' });
    const milestone = await createMilestone(fixture, {
      name: 'archived review',
      status: 'active',
      targetDate: '2026-07-18',
      archived: true
    });
    await createWorkItem(fixture, {
      title: 'Archived project review work',
      status: 'blocked',
      milestoneId: milestone.id
    });

    await request(app)
      .get(`/api/projects/${fixture.projectId}/milestones/${milestone.id}/review`)
      .set(fixture.headers)
      .expect(200)
      .expect(({ body }) => {
        expect(body.project).toMatchObject({
          id: fixture.projectId,
          status: 'archived'
        });
        expect(body.milestone).toMatchObject({
          id: milestone.id,
          isArchived: true
        });
        expect(body.progress).toMatchObject({
          totalCount: 1,
          blockedCount: 1
        });
        expect(body.riskSections).toHaveLength(7);
      });
  });

  it('rejects milestone review for milestones outside the route project', async () => {
    const fixture = await createFixture();
    const otherProjectId = randomUUID();

    await repositories.projects.create({
      id: otherProjectId,
      workspaceId: fixture.workspaceId,
      key: 'OTHER',
      nextWorkItemNumber: 1,
      name: 'Other Planning Project',
      description: '',
      status: 'active',
      createdAt: now(),
      updatedAt: now()
    });
    const otherMilestone = await repositories.milestones.create({
      id: randomUUID(),
      workspaceId: fixture.workspaceId,
      projectId: otherProjectId,
      name: 'Other milestone',
      description: '',
      status: 'active',
      targetDate: null,
      archivedAt: null,
      archivedById: null,
      createdAt: now(),
      updatedAt: now()
    });
    const service = new MilestoneReviewService({
      actor: fixture.actor,
      repositories,
      clock: now
    });

    await expect(service.getMilestoneReview(fixture.projectId, otherMilestone.id)).rejects.toThrow(
      'Milestone not found.'
    );
  });

  it('returns an empty milestone review with deterministic zero-count sections', async () => {
    const fixture = await createFixture();
    const milestone = await createMilestone(fixture, {
      name: 'empty review milestone',
      status: 'active',
      targetDate: '2026-07-18'
    });

    await request(app)
      .get(`/api/projects/${fixture.projectId}/milestones/${milestone.id}/review`)
      .set(fixture.headers)
      .expect(200)
      .expect(({ body }) => {
        expect(body.progress).toMatchObject({
          totalCount: 0,
          doneCount: 0,
          openCount: 0
        });
        expect(body.scopeBreakdown).toMatchObject({
          statusCounts: {
            backlog: 0,
            ready: 0,
            in_progress: 0,
            blocked: 0,
            done: 0,
            canceled: 0
          },
          priorityCounts: {
            low: 0,
            medium: 0,
            high: 0,
            urgent: 0
          },
          assignedCount: 0,
          unassignedCount: 0,
          dueDate: {
            overdueCount: 0,
            dueSoonCount: 0,
            laterCount: 0,
            noneCount: 0
          },
          dependency: {
            dependencyBlockedCount: 0,
            blockingOpenWorkCount: 0
          }
        });
        expect(body.riskSections).toHaveLength(7);
        expect(body.riskSections.every((section: { count: number; items: unknown[] }) =>
          section.count === 0 && section.items.length === 0
        )).toBe(true);
        expect(body.recentlyChangedWork).toEqual([]);
      });
  });

  it('caps milestone review recent movement at the eight most recently updated items', async () => {
    const fixture = await createFixture();
    const milestone = await createMilestone(fixture, {
      name: 'recent movement review',
      status: 'active'
    });
    const created = [];

    for (let index = 0; index < 10; index += 1) {
      const day = String(index + 1).padStart(2, '0');
      created.push(
        await createWorkItem(fixture, {
          title: `Recent movement ${index + 1}`,
          status: 'ready',
          milestoneId: milestone.id,
          updatedAt: new Date(`2026-07-${day}T12:00:00.000Z`)
        })
      );
    }

    const service = new MilestoneReviewService({
      actor: fixture.actor,
      repositories,
      clock: now
    });
    const review = await service.getMilestoneReview(fixture.projectId, milestone.id);

    expect(review.recentlyChangedWork.map((item) => item.id)).toEqual(
      created
        .slice(2)
        .reverse()
        .map((item) => item.id)
    );
  });

  it('hides milestone review projects from other workspaces', async () => {
    const visibleFixture = await createFixture();
    const hiddenFixture = await createFixture();
    const hiddenMilestone = await createMilestone(hiddenFixture, {
      name: 'hidden milestone',
      status: 'active'
    });

    await request(app)
      .get(`/api/projects/${hiddenFixture.projectId}/milestones/${hiddenMilestone.id}/review`)
      .set(visibleFixture.headers)
      .expect(404)
      .expect(({ body }) => {
        expect(body.error).toEqual({
          code: 'NOT_FOUND',
          message: 'Project not found.'
        });
      });
  });
});
