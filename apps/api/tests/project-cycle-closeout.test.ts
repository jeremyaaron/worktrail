import { randomUUID } from 'node:crypto';

import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { createExpressApp } from '../src/adapters/express/server.js';
import { createDb, createPool } from '../src/db/client.js';
import { ConflictError, ForbiddenError, NotFoundError } from '../src/errors/app-error.js';
import { createRepositories, type Repositories } from '../src/repositories/index.js';
import { ProjectCycleCloseoutService } from '../src/services/project-cycle-closeout-service.js';

const workspaceIds = new Set<string>();
let pool: ReturnType<typeof createPool>;
let db: ReturnType<typeof createDb>;
let repositories: Repositories;
let app: ReturnType<typeof createExpressApp>;
let nextWorkItemNumber = 1;

function now() {
  return new Date('2026-07-14T12:00:00.000Z');
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
  await pool.query('delete from project_cycle_closeouts where workspace_id = $1', [workspaceId]);
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
  const workspaceId = randomUUID();
  const actorId = randomUUID();
  const projectId = randomUUID();
  workspaceIds.add(workspaceId);

  await repositories.workspaces.create({
    id: workspaceId,
    name: 'Closeout Preview Workspace',
    createdAt: now(),
    updatedAt: now()
  });
  await repositories.members.create({
    id: actorId,
    workspaceId,
    name: `${role} preview actor`,
    email: `${actorId}@example.com`,
    role,
    isActive: true,
    createdAt: now(),
    updatedAt: now()
  });
  await repositories.projects.create({
    id: projectId,
    workspaceId,
    key: 'CP',
    nextWorkItemNumber: 1,
    name: 'Closeout Preview Project',
    description: 'Project for closeout preview tests.',
    status: 'active',
    createdAt: now(),
    updatedAt: now()
  });

  const actor = { workspaceId, memberId: actorId, role };

  return {
    workspaceId,
    actorId,
    projectId,
    actor,
    headers: actorHeaders(actor),
    service: new ProjectCycleCloseoutService({
      actor,
      repositories,
      db,
      clock: now
    })
  };
}

async function createCycle(
  fixture: Awaited<ReturnType<typeof createFixture>>,
  input: {
    name: string;
    status: 'planned' | 'active' | 'completed' | 'canceled';
    startDate: string;
    endDate: string;
    archived?: boolean;
  }
) {
  return repositories.projectCycles.create({
    id: randomUUID(),
    workspaceId: fixture.workspaceId,
    projectId: fixture.projectId,
    name: input.name,
    goal: `${input.name} goal.`,
    status: input.status,
    startDate: input.startDate,
    endDate: input.endDate,
    targetPoints: 10,
    archivedAt: input.archived === true ? now() : null,
    archivedById: input.archived === true ? fixture.actorId : null,
    createdAt: now(),
    updatedAt: now()
  });
}

async function createWorkItem(
  fixture: Awaited<ReturnType<typeof createFixture>>,
  input: {
    cycleId: string;
    title: string;
    status: 'backlog' | 'ready' | 'in_progress' | 'blocked' | 'done' | 'canceled';
    priority: 'low' | 'medium' | 'high' | 'urgent';
    estimatePoints: number | null;
    assigneeId?: string | null;
    updatedAt?: Date;
  }
) {
  const itemNumber = nextWorkItemNumber;
  nextWorkItemNumber += 1;

  return repositories.workItems.create({
    id: randomUUID(),
    workspaceId: fixture.workspaceId,
    projectId: fixture.projectId,
    title: input.title,
    description: '',
    itemNumber,
    displayKey: `CP-${itemNumber}`,
    type: 'task',
    status: input.status,
    priority: input.priority,
    assigneeId: input.assigneeId === undefined ? fixture.actorId : input.assigneeId,
    reporterId: fixture.actorId,
    milestoneId: null,
    cycleId: input.cycleId,
    boardPosition: itemNumber * 1024,
    dueDate: null,
    estimatePoints: input.estimatePoints,
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
  await cleanupAllWorkspaces();
});

afterAll(async () => {
  await cleanupAllWorkspaces();
  await pool.end();
});

describe('project cycle closeout preview', () => {
  it('derives ordered unfinished scope, counts, health, and eligible destinations without writes', async () => {
    const fixture = await createFixture();
    const source = await createCycle(fixture, {
      name: 'Active source',
      status: 'active',
      startDate: '2026-07-01',
      endDate: '2026-07-14'
    });
    const laterDestination = await createCycle(fixture, {
      name: 'Later destination',
      status: 'planned',
      startDate: '2026-07-29',
      endDate: '2026-08-11'
    });
    const earlierDestination = await createCycle(fixture, {
      name: 'Earlier destination',
      status: 'planned',
      startDate: '2026-07-15',
      endDate: '2026-07-28'
    });
    await createCycle(fixture, {
      name: 'Archived planned destination',
      status: 'planned',
      startDate: '2026-08-12',
      endDate: '2026-08-25',
      archived: true
    });
    await createCycle(fixture, {
      name: 'Completed destination',
      status: 'completed',
      startDate: '2026-06-01',
      endDate: '2026-06-14'
    });
    const done = await createWorkItem(fixture, {
      cycleId: source.id,
      title: 'Done work',
      status: 'done',
      priority: 'high',
      estimatePoints: 3
    });
    await createWorkItem(fixture, {
      cycleId: source.id,
      title: 'Canceled work',
      status: 'canceled',
      priority: 'low',
      estimatePoints: null
    });
    const backlog = await createWorkItem(fixture, {
      cycleId: source.id,
      title: 'Backlog carryover',
      status: 'backlog',
      priority: 'urgent',
      estimatePoints: null,
      assigneeId: null
    });
    const ready = await createWorkItem(fixture, {
      cycleId: source.id,
      title: 'Ready carryover',
      status: 'ready',
      priority: 'high',
      estimatePoints: 5
    });
    const inProgress = await createWorkItem(fixture, {
      cycleId: source.id,
      title: 'In progress carryover',
      status: 'in_progress',
      priority: 'medium',
      estimatePoints: 2,
      updatedAt: new Date('2026-07-01T12:00:00.000Z')
    });
    const blocked = await createWorkItem(fixture, {
      cycleId: source.id,
      title: 'Blocked carryover',
      status: 'blocked',
      priority: 'urgent',
      estimatePoints: null,
      assigneeId: null
    });
    await repositories.workItemRelationships.create({
      id: randomUUID(),
      workspaceId: fixture.workspaceId,
      relationshipType: 'blocks',
      sourceWorkItemId: ready.id,
      targetWorkItemId: blocked.id,
      createdById: fixture.actorId,
      createdAt: now()
    });
    const beforeUpdatedAt = new Map(
      [done, backlog, ready, inProgress, blocked].map((item) => [
        item.id,
        item.updatedAt.toISOString()
      ])
    );

    const preview = await fixture.service.preview(fixture.projectId, source.id);

    expect(preview.generatedAt).toBe(now().toISOString());
    expect(preview.project.id).toBe(fixture.projectId);
    expect(preview.cycle.id).toBe(source.id);
    expect(preview.counts).toEqual({
      totalCount: 6,
      completedCount: 1,
      canceledCount: 1,
      unfinishedCount: 4,
      retainedCount: 2,
      committedEstimatePoints: 10,
      completedEstimatePoints: 3,
      unfinishedEstimatePoints: 7,
      unestimatedUnfinishedCount: 2
    });
    expect(preview.health.health).toBe('blocked');
    expect(preview.unfinishedItems.map((item) => item.id)).toEqual([
      blocked.id,
      inProgress.id,
      ready.id,
      backlog.id
    ]);
    expect(preview.unfinishedItems[0]).toMatchObject({
      id: blocked.id,
      dependencyBlocked: true,
      assignee: null
    });
    expect(preview.unfinishedItems.find((item) => item.id === ready.id)?.assignee).toEqual({
      id: fixture.actorId,
      name: 'owner preview actor'
    });
    expect(preview.eligibleDestinations.map((item) => item.cycle.id)).toEqual([
      earlierDestination.id,
      laterDestination.id
    ]);
    await expect(repositories.projectCycleCloseouts.findByCycleId(source.id)).resolves.toBeNull();
    await expect(repositories.activityEvents.findByProject(fixture.projectId)).resolves.toEqual([]);

    const afterWork = await repositories.workItems.listByProject(fixture.projectId);
    expect(
      afterWork
        .filter((item) => beforeUpdatedAt.has(item.id))
        .every((item) => beforeUpdatedAt.get(item.id) === item.updatedAt.toISOString())
    ).toBe(true);
  });

  it('serves an empty maintainer preview through the HTTP endpoint', async () => {
    const fixture = await createFixture('maintainer');
    const source = await createCycle(fixture, {
      name: 'Empty active source',
      status: 'active',
      startDate: '2026-07-01',
      endDate: '2026-07-14'
    });

    await request(app)
      .get(`/api/projects/${fixture.projectId}/cycles/${source.id}/closeout-preview`)
      .set(fixture.headers)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          project: { id: fixture.projectId },
          cycle: { id: source.id, status: 'active' },
          counts: {
            totalCount: 0,
            completedCount: 0,
            canceledCount: 0,
            unfinishedCount: 0,
            retainedCount: 0,
            committedEstimatePoints: 0,
            completedEstimatePoints: 0,
            unfinishedEstimatePoints: 0,
            unestimatedUnfinishedCount: 0
          },
          unfinishedItems: [],
          eligibleDestinations: []
        });
      });
  });

  it('rejects contributor preview access in both service and HTTP paths', async () => {
    const fixture = await createFixture('contributor');
    const source = await createCycle(fixture, {
      name: 'Contributor source',
      status: 'active',
      startDate: '2026-07-01',
      endDate: '2026-07-14'
    });

    await expect(fixture.service.preview(fixture.projectId, source.id)).rejects.toBeInstanceOf(
      ForbiddenError
    );
    await request(app)
      .get(`/api/projects/${fixture.projectId}/cycles/${source.id}/closeout-preview`)
      .set(fixture.headers)
      .expect(403)
      .expect(({ body }) => {
        expect(body.error.message).toBe('Only owners and maintainers can close cycles.');
      });
  });

  it('rejects archived projects and archived or non-active source cycles', async () => {
    const fixture = await createFixture();
    const planned = await createCycle(fixture, {
      name: 'Planned source',
      status: 'planned',
      startDate: '2026-07-15',
      endDate: '2026-07-28'
    });
    const completed = await createCycle(fixture, {
      name: 'Completed source',
      status: 'completed',
      startDate: '2026-06-15',
      endDate: '2026-06-28'
    });
    const canceled = await createCycle(fixture, {
      name: 'Canceled source',
      status: 'canceled',
      startDate: '2026-06-01',
      endDate: '2026-06-14'
    });
    const archived = await createCycle(fixture, {
      name: 'Archived source',
      status: 'active',
      startDate: '2026-07-01',
      endDate: '2026-07-14',
      archived: true
    });

    for (const cycle of [planned, completed, canceled]) {
      await expect(fixture.service.preview(fixture.projectId, cycle.id)).rejects.toBeInstanceOf(
        ConflictError
      );
    }
    await expect(fixture.service.preview(fixture.projectId, archived.id)).rejects.toBeInstanceOf(
      ConflictError
    );

    await repositories.projects.update(fixture.projectId, { status: 'archived', updatedAt: now() });
    await expect(fixture.service.preview(fixture.projectId, archived.id)).rejects.toBeInstanceOf(
      ConflictError
    );
  });

  it('does not reveal project or cycle ids from another workspace', async () => {
    const actorFixture = await createFixture();
    const otherFixture = await createFixture();
    const otherCycle = await createCycle(otherFixture, {
      name: 'Other workspace source',
      status: 'active',
      startDate: '2026-07-01',
      endDate: '2026-07-14'
    });

    await expect(
      actorFixture.service.preview(otherFixture.projectId, otherCycle.id)
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      actorFixture.service.preview(actorFixture.projectId, otherCycle.id)
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('project cycle closeout command', () => {
  it('atomically closes into a planned cycle with an immutable snapshot and matching activity', async () => {
    const fixture = await createFixture('maintainer');
    const source = await createCycle(fixture, {
      name: 'Current delivery',
      status: 'active',
      startDate: '2026-07-01',
      endDate: '2026-07-14'
    });
    const destination = await createCycle(fixture, {
      name: 'Next delivery',
      status: 'planned',
      startDate: '2026-07-15',
      endDate: '2026-07-28'
    });
    const done = await createWorkItem(fixture, {
      cycleId: source.id,
      title: 'Delivered work',
      status: 'done',
      priority: 'high',
      estimatePoints: 3
    });
    const canceled = await createWorkItem(fixture, {
      cycleId: source.id,
      title: 'Canceled work',
      status: 'canceled',
      priority: 'low',
      estimatePoints: 1
    });
    const unfinished = await createWorkItem(fixture, {
      cycleId: source.id,
      title: 'Carry this work',
      status: 'blocked',
      priority: 'urgent',
      estimatePoints: null
    });
    await repositories.workItems.update(unfinished.id, {
      description: 'Preserve this description.',
      dueDate: '2026-07-20',
      updatedAt: new Date('2026-07-13T09:00:00.000Z')
    });

    const response = await request(app)
      .post(`/api/projects/${fixture.projectId}/cycles/${source.id}/closeout`)
      .set(fixture.headers)
      .send({ destinationCycleId: destination.id })
      .expect(200);

    expect(response.body).toMatchObject({
      applied: true,
      cycle: { id: source.id, status: 'completed' },
      movedItemCount: 1,
      retainedItemCount: 2,
      closeout: {
        cycleId: source.id,
        destinationCycleId: destination.id,
        closedBy: { id: fixture.actorId },
        snapshot: {
          snapshotVersion: 1,
          cycle: { id: source.id, status: 'active' },
          destination: { kind: 'cycle', cycle: { id: destination.id } },
          counts: {
            totalCount: 3,
            completedCount: 1,
            canceledCount: 1,
            unfinishedCount: 1,
            retainedCount: 2,
            movedCount: 1,
            committedEstimatePoints: 4,
            completedEstimatePoints: 3,
            unfinishedEstimatePoints: 0,
            unestimatedUnfinishedCount: 1
          },
          items: {
            completed: [expect.objectContaining({ id: done.id, status: 'done' })],
            canceled: [expect.objectContaining({ id: canceled.id, status: 'canceled' })],
            unfinished: [expect.objectContaining({ id: unfinished.id, status: 'blocked' })]
          }
        }
      }
    });

    const storedDone = await repositories.workItems.findById(done.id);
    const storedCanceled = await repositories.workItems.findById(canceled.id);
    const storedUnfinished = await repositories.workItems.findById(unfinished.id);
    expect(storedDone).toMatchObject({ cycleId: source.id, updatedAt: done.updatedAt });
    expect(storedCanceled).toMatchObject({ cycleId: source.id, updatedAt: canceled.updatedAt });
    expect(storedUnfinished).toMatchObject({
      cycleId: destination.id,
      description: 'Preserve this description.',
      dueDate: '2026-07-20',
      status: 'blocked',
      priority: 'urgent',
      assigneeId: fixture.actorId
    });

    const activity = await repositories.activityEvents.findByProject(fixture.projectId);
    expect(activity).toHaveLength(2);
    expect(activity.find((event) => event.eventType === 'work_item.cycle_changed')).toMatchObject({
      workItemId: unfinished.id,
      summary: `Cycle changed to ${destination.name}.`,
      previousValue: { cycleId: source.id, cycleName: source.name },
      newValue: { cycleId: destination.id, cycleName: destination.name }
    });
    expect(activity.find((event) => event.eventType === 'cycle.closed')).toMatchObject({
      workItemId: null,
      summary: `Cycle ${source.name} closed; 1 item moved to ${destination.name}.`,
      previousValue: { cycleId: source.id, status: 'active' },
      newValue: { cycleId: source.id, status: 'completed' },
      metadata: {
        closeoutId: response.body.closeout.id,
        destinationCycleId: destination.id,
        movedItemCount: 1,
        retainedItemCount: 2
      }
    });
    await expect(
      repositories.notifications.listByRecipient({
        workspaceId: fixture.workspaceId,
        recipientMemberId: fixture.actorId,
        state: 'all'
      })
    ).resolves.toEqual([]);

    await request(app)
      .get(`/api/projects/${fixture.projectId}/cycles/${source.id}/review`)
      .set(fixture.headers)
      .expect(200)
      .expect(({ body }) => {
        expect(body.closeout).toMatchObject({
          id: response.body.closeout.id,
          snapshot: { counts: { movedCount: 1, retainedCount: 2 } }
        });
      });
  });

  it('supports unplanned carryover and empty-cycle completion', async () => {
    const fixture = await createFixture();
    const source = await createCycle(fixture, {
      name: 'Unplanned carryover source',
      status: 'active',
      startDate: '2026-07-01',
      endDate: '2026-07-14'
    });
    await fixture.service.preview(fixture.projectId, source.id);
    const unfinished = await createWorkItem(fixture, {
      cycleId: source.id,
      title: 'Return to backlog planning',
      status: 'ready',
      priority: 'medium',
      estimatePoints: 2
    });

    const result = await fixture.service.close(fixture.projectId, source.id, {
      destinationCycleId: null
    });

    expect(result.closeout.snapshot.destination).toEqual({ kind: 'unplanned', cycle: null });
    await expect(repositories.workItems.findById(unfinished.id)).resolves.toMatchObject({
      cycleId: null
    });

    const emptySource = await createCycle(fixture, {
      name: 'Empty source',
      status: 'active',
      startDate: '2026-07-15',
      endDate: '2026-07-28'
    });
    const emptyResult = await fixture.service.close(fixture.projectId, emptySource.id, {
      destinationCycleId: null
    });
    expect(emptyResult).toMatchObject({ movedItemCount: 0, retainedItemCount: 0 });
    expect(emptyResult.closeout.snapshot.destination).toEqual({ kind: 'none', cycle: null });
  });

  it('returns a matching retry without duplicate writes and rejects destination changes', async () => {
    const fixture = await createFixture();
    const source = await createCycle(fixture, {
      name: 'Retry source',
      status: 'active',
      startDate: '2026-07-01',
      endDate: '2026-07-14'
    });
    await createWorkItem(fixture, {
      cycleId: source.id,
      title: 'Retry carryover',
      status: 'in_progress',
      priority: 'high',
      estimatePoints: 5
    });

    const first = await fixture.service.close(fixture.projectId, source.id, {
      destinationCycleId: null
    });
    const replay = await fixture.service.close(fixture.projectId, source.id, {
      destinationCycleId: null
    });

    expect(replay).toMatchObject({
      applied: false,
      movedItemCount: 1,
      closeout: { id: first.closeout.id }
    });
    expect(await repositories.activityEvents.findByProject(fixture.projectId)).toHaveLength(2);

    const destination = await createCycle(fixture, {
      name: 'Different destination',
      status: 'planned',
      startDate: '2026-07-15',
      endDate: '2026-07-28'
    });
    await expect(
      fixture.service.close(fixture.projectId, source.id, {
        destinationCycleId: destination.id
      })
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('validates permission, request shape, source state, and destination eligibility', async () => {
    const contributor = await createFixture('contributor');
    const contributorSource = await createCycle(contributor, {
      name: 'Contributor source',
      status: 'active',
      startDate: '2026-07-01',
      endDate: '2026-07-14'
    });
    await expect(
      contributor.service.close(contributor.projectId, contributorSource.id, {
        destinationCycleId: null
      })
    ).rejects.toBeInstanceOf(ForbiddenError);

    await request(app)
      .post(`/api/projects/${contributor.projectId}/cycles/${contributorSource.id}/closeout`)
      .set({ ...contributor.headers, 'x-worktrail-role': 'owner' })
      .send({})
      .expect(400);

    const fixture = await createFixture();
    const plannedSource = await createCycle(fixture, {
      name: 'Planned source',
      status: 'planned',
      startDate: '2026-07-01',
      endDate: '2026-07-14'
    });
    await expect(
      fixture.service.close(fixture.projectId, plannedSource.id, { destinationCycleId: null })
    ).rejects.toBeInstanceOf(ConflictError);

    const source = await createCycle(fixture, {
      name: 'Active source',
      status: 'active',
      startDate: '2026-07-01',
      endDate: '2026-07-14'
    });
    await createWorkItem(fixture, {
      cycleId: source.id,
      title: 'Needs a destination',
      status: 'backlog',
      priority: 'low',
      estimatePoints: null
    });
    const invalidDestination = await createCycle(fixture, {
      name: 'Canceled destination',
      status: 'canceled',
      startDate: '2026-07-15',
      endDate: '2026-07-28'
    });
    await expect(
      fixture.service.close(fixture.projectId, source.id, {
        destinationCycleId: invalidDestination.id
      })
    ).rejects.toBeInstanceOf(ConflictError);
    await expect(
      fixture.service.close(fixture.projectId, source.id, { destinationCycleId: source.id })
    ).rejects.toBeInstanceOf(ConflictError);

    const otherFixture = await createFixture();
    const otherDestination = await createCycle(otherFixture, {
      name: 'Other workspace destination',
      status: 'planned',
      startDate: '2026-07-15',
      endDate: '2026-07-28'
    });
    await expect(
      fixture.service.close(fixture.projectId, source.id, {
        destinationCycleId: otherDestination.id
      })
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('uses command-time scope and rolls back every closeout effect when activity insertion fails', async () => {
    const fixture = await createFixture();
    const source = await createCycle(fixture, {
      name: 'Rollback source',
      status: 'active',
      startDate: '2026-07-01',
      endDate: '2026-07-14'
    });
    await fixture.service.preview(fixture.projectId, source.id);
    const addedAfterPreview = await createWorkItem(fixture, {
      cycleId: source.id,
      title: 'Added after preview',
      status: 'ready',
      priority: 'medium',
      estimatePoints: 3
    });
    const duplicateId = randomUUID();
    const failingService = new ProjectCycleCloseoutService({
      actor: fixture.actor,
      repositories,
      db,
      clock: now,
      idGenerator: () => duplicateId
    });

    await expect(
      failingService.close(fixture.projectId, source.id, { destinationCycleId: null })
    ).rejects.toBeDefined();

    await expect(repositories.projectCycleCloseouts.findByCycleId(source.id)).resolves.toBeNull();
    await expect(repositories.projectCycles.findById(source.id)).resolves.toMatchObject({
      status: 'active'
    });
    await expect(repositories.workItems.findById(addedAfterPreview.id)).resolves.toMatchObject({
      cycleId: source.id,
      updatedAt: addedAfterPreview.updatedAt
    });
    await expect(repositories.activityEvents.findByProject(fixture.projectId)).resolves.toEqual([]);
  });

  it('serializes concurrent retries into one applied closeout', async () => {
    const fixture = await createFixture();
    const source = await createCycle(fixture, {
      name: 'Concurrent source',
      status: 'active',
      startDate: '2026-07-01',
      endDate: '2026-07-14'
    });
    await createWorkItem(fixture, {
      cycleId: source.id,
      title: 'Concurrent carryover',
      status: 'ready',
      priority: 'high',
      estimatePoints: 2
    });

    const results = await Promise.all([
      fixture.service.close(fixture.projectId, source.id, { destinationCycleId: null }),
      fixture.service.close(fixture.projectId, source.id, { destinationCycleId: null })
    ]);

    expect(results.map((result) => result.applied).sort()).toEqual([false, true]);
    expect(new Set(results.map((result) => result.closeout.id))).toHaveLength(1);
    expect(await repositories.activityEvents.findByProject(fixture.projectId)).toHaveLength(2);
  });
});
