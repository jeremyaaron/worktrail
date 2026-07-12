import { randomUUID } from 'node:crypto';

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { createDb, createPool } from '../src/db/client.js';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../src/errors/app-error.js';
import { createRepositories, type Repositories } from '../src/repositories/index.js';
import { ProjectCycleService } from '../src/services/project-cycle-service.js';

const workspaceIds = new Set<string>();
let pool: ReturnType<typeof createPool>;
let db: ReturnType<typeof createDb>;
let repositories: Repositories;
let nextWorkItemNumber = 1;

function now() {
  return new Date('2026-07-09T12:00:00.000Z');
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

async function createFixture(role: 'owner' | 'maintainer' | 'contributor' = 'owner') {
  const timestamp = now();
  const workspaceId = randomUUID();
  const actorId = randomUUID();
  const projectId = randomUUID();
  workspaceIds.add(workspaceId);

  await repositories.workspaces.create({
    id: workspaceId,
    name: 'Cycle Test Workspace',
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
    name: 'Cycle Test Project',
    description: 'Project for cycle service tests.',
    status: 'active',
    createdAt: timestamp,
    updatedAt: timestamp
  });

  const service = new ProjectCycleService({
    actor: {
      workspaceId,
      memberId: actorId,
      role
    },
    repositories,
    db,
    clock: now
  });

  return {
    workspaceId,
    actorId,
    projectId,
    service
  };
}

async function createHistoricalCycle(
  fixture: Awaited<ReturnType<typeof createFixture>>,
  input: {
    name: string;
    status: 'completed' | 'canceled';
    startDate: string;
    endDate: string;
  }
) {
  return repositories.projectCycles.create({
    id: randomUUID(),
    workspaceId: fixture.workspaceId,
    projectId: fixture.projectId,
    name: input.name,
    goal: '',
    status: input.status,
    startDate: input.startDate,
    endDate: input.endDate,
    targetPoints: null,
    archivedAt: null,
    archivedById: null,
    createdAt: now(),
    updatedAt: now()
  });
}

beforeAll(() => {
  pool = createPool();
  db = createDb(pool);
  repositories = createRepositories(db);
});

afterEach(async () => {
  await cleanupAllWorkspaces();
});

afterAll(async () => {
  await cleanupAllWorkspaces();
  await pool.end();
});

describe('ProjectCycleService', () => {
  it('creates, lists, updates, archives, and reactivates cycles', async () => {
    const fixture = await createFixture('maintainer');

    const cycle = await fixture.service.createProjectCycle(fixture.projectId, {
      name: 'v0.2.1 Cycle Planning',
      goal: 'Ship cycle planning foundation.',
      status: 'planned',
      startDate: '2026-07-13',
      endDate: '2026-07-24',
      targetPoints: 24
    });

    expect(cycle).toMatchObject({
      name: 'v0.2.1 Cycle Planning',
      goal: 'Ship cycle planning foundation.',
      status: 'planned',
      startDate: '2026-07-13',
      endDate: '2026-07-24',
      targetPoints: 24,
      isArchived: false,
      archivedAt: null
    });

    await expect(fixture.service.listProjectCycles(fixture.projectId)).resolves.toEqual([
      expect.objectContaining({ id: cycle.id })
    ]);

    const updated = await fixture.service.updateProjectCycle(fixture.projectId, cycle.id, {
      name: 'v0.2.1 Cycle Planning Updated',
      goal: 'Commit cycle planning scope.',
      status: 'active',
      targetPoints: 26
    });

    expect(updated).toMatchObject({
      name: 'v0.2.1 Cycle Planning Updated',
      goal: 'Commit cycle planning scope.',
      status: 'active',
      targetPoints: 26
    });

    const archived = await fixture.service.archiveProjectCycle(fixture.projectId, cycle.id);
    expect(archived.isArchived).toBe(true);
    expect(archived.archivedAt).toEqual(expect.any(String));

    await expect(fixture.service.listProjectCycles(fixture.projectId)).resolves.toEqual([]);
    await expect(
      fixture.service.listProjectCycles(fixture.projectId, { includeArchived: true })
    ).resolves.toHaveLength(1);

    const reactivated = await fixture.service.reactivateProjectCycle(fixture.projectId, cycle.id);
    expect(reactivated.isArchived).toBe(false);
    expect(reactivated.archivedAt).toBeNull();
  });

  it('rejects duplicate names, active conflicts, and planned-active overlap', async () => {
    const fixture = await createFixture();

    const active = await fixture.service.createProjectCycle(fixture.projectId, {
      name: 'Current cycle',
      status: 'active',
      startDate: '2026-07-01',
      endDate: '2026-07-10'
    });

    await expect(
      fixture.service.createProjectCycle(fixture.projectId, {
        name: 'CURRENT CYCLE',
        startDate: '2026-07-15',
        endDate: '2026-07-20'
      })
    ).rejects.toBeInstanceOf(ConflictError);

    await expect(
      fixture.service.createProjectCycle(fixture.projectId, {
        name: 'Second active',
        status: 'active',
        startDate: '2026-07-15',
        endDate: '2026-07-20'
      })
    ).rejects.toBeInstanceOf(ConflictError);

    await expect(
      fixture.service.createProjectCycle(fixture.projectId, {
        name: 'Overlapping planned',
        status: 'planned',
        startDate: '2026-07-09',
        endDate: '2026-07-20'
      })
    ).rejects.toBeInstanceOf(ConflictError);

    await expect(
      fixture.service.updateProjectCycle(fixture.projectId, active.id, {
        startDate: '2026-07-11',
        endDate: '2026-07-10'
      })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('allows completed and canceled cycles to overlap historical windows', async () => {
    const fixture = await createFixture();

    const completed = await createHistoricalCycle(fixture, {
      name: 'Completed cycle',
      status: 'completed',
      startDate: '2026-07-01',
      endDate: '2026-07-10'
    });

    const canceled = await createHistoricalCycle(fixture, {
      name: 'Canceled cycle',
      status: 'canceled',
      startDate: '2026-07-01',
      endDate: '2026-07-10'
    });

    expect(completed.status).toBe('completed');
    expect(canceled.status).toBe('canceled');
  });

  it('allows metadata corrections but rejects status changes on completed cycles', async () => {
    const fixture = await createFixture();
    const completed = await createHistoricalCycle(fixture, {
      name: 'Completed cycle',
      status: 'completed',
      startDate: '2026-06-01',
      endDate: '2026-06-12'
    });

    await expect(
      fixture.service.updateProjectCycle(fixture.projectId, completed.id, {
        name: 'Corrected completed cycle'
      })
    ).resolves.toMatchObject({ name: 'Corrected completed cycle', status: 'completed' });
    await expect(
      fixture.service.updateProjectCycle(fixture.projectId, completed.id, { status: 'active' })
    ).rejects.toMatchObject({ message: 'Completed cycle status cannot be changed.' });
  });

  it('allows contributors to read cycles but rejects cycle writes', async () => {
    const ownerFixture = await createFixture();
    const cycle = await ownerFixture.service.createProjectCycle(ownerFixture.projectId, {
      name: 'Readable cycle',
      startDate: '2026-07-13',
      endDate: '2026-07-24'
    });

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

    const contributorService = new ProjectCycleService({
      actor: {
        workspaceId: ownerFixture.workspaceId,
        memberId: contributorId,
        role: 'contributor'
      },
      repositories,
      db,
      clock: now
    });

    await expect(contributorService.getProjectCycle(ownerFixture.projectId, cycle.id)).resolves.toMatchObject({
      id: cycle.id
    });
    await expect(
      contributorService.createProjectCycle(ownerFixture.projectId, {
        name: 'Rejected',
        startDate: '2026-08-01',
        endDate: '2026-08-12'
      })
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('rejects writes under archived projects and archived cycles', async () => {
    const fixture = await createFixture();
    const cycle = await fixture.service.createProjectCycle(fixture.projectId, {
      name: 'Archived project cycle',
      startDate: '2026-07-13',
      endDate: '2026-07-24'
    });

    const archived = await fixture.service.archiveProjectCycle(fixture.projectId, cycle.id);

    await expect(
      fixture.service.updateProjectCycle(fixture.projectId, archived.id, {
        name: 'Cannot rename archived cycle'
      })
    ).rejects.toBeInstanceOf(ConflictError);

    await repositories.projects.update(fixture.projectId, {
      status: 'archived',
      updatedAt: now()
    });

    await expect(
      fixture.service.createProjectCycle(fixture.projectId, {
        name: 'Blocked project write',
        startDate: '2026-08-01',
        endDate: '2026-08-12'
      })
    ).rejects.toBeInstanceOf(ConflictError);
    await expect(
      fixture.service.reactivateProjectCycle(fixture.projectId, archived.id)
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('validates assignable cycle references without leaking cross-project ids', async () => {
    const fixture = await createFixture();
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
    const cycle = await fixture.service.createProjectCycle(fixture.projectId, {
      name: 'Assignable cycle',
      startDate: '2026-07-13',
      endDate: '2026-07-24'
    });

    await expect(fixture.service.validateAssignableCycle(fixture.projectId, cycle.id)).resolves.toMatchObject({
      id: cycle.id
    });
    await expect(fixture.service.validateAssignableCycle(otherProjectId, cycle.id)).rejects.toBeInstanceOf(
      NotFoundError
    );

    await fixture.service.archiveProjectCycle(fixture.projectId, cycle.id);
    await expect(fixture.service.validateAssignableCycle(fixture.projectId, cycle.id)).rejects.toBeInstanceOf(
      ValidationError
    );
  });

  it('builds cycle review progress, health, risk sections, and recent movement', async () => {
    const fixture = await createFixture();
    const cycle = await fixture.service.createProjectCycle(fixture.projectId, {
      name: 'Current cycle',
      status: 'active',
      startDate: '2026-07-01',
      endDate: '2026-07-12',
      targetPoints: 5
    });
    const blocker = await createWorkItem(fixture, {
      cycleId: cycle.id,
      title: 'Resolve dependency',
      status: 'in_progress',
      priority: 'urgent',
      estimatePoints: 3,
      updatedAt: new Date('2026-07-01T12:00:00.000Z')
    });
    const blocked = await createWorkItem(fixture, {
      cycleId: cycle.id,
      title: 'Blocked cycle work',
      status: 'blocked',
      priority: 'high',
      dueDate: '2026-07-08',
      estimatePoints: 3
    });
    await createWorkItem(fixture, {
      cycleId: cycle.id,
      title: 'Unassigned unestimated work',
      status: 'ready',
      priority: 'medium',
      assigneeId: null,
      estimatePoints: null
    });
    await createWorkItem(fixture, {
      cycleId: cycle.id,
      title: 'Completed work',
      status: 'done',
      priority: 'low',
      estimatePoints: 2
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

    const review = await fixture.service.getCycleReview(fixture.projectId, cycle.id);

    expect(review.project.id).toBe(fixture.projectId);
    expect(review.cycle.id).toBe(cycle.id);
    expect(review.scopedWorkQuery).toEqual({ cycleId: cycle.id, sort: 'priority_desc' });
    expect(review.progress).toMatchObject({
      totalCount: 4,
      openCount: 3,
      doneCount: 1,
      blockedCount: 1,
      dependencyBlockedCount: 1,
      committedEstimatePoints: 8,
      completedEstimatePoints: 2,
      unestimatedCount: 1,
      targetPoints: 5
    });
    expect(review.health.health).toBe('blocked');
    expect(review.health.reasons.map((reason) => reason.key)).toEqual(
      expect.arrayContaining([
        'blocked_work',
        'dependency_blocked',
        'cycle_over_target',
        'overdue_work',
        'unassigned_active',
        'stale_in_progress',
        'unestimated_work'
      ])
    );
    expect(review.scopeBreakdown.statusCounts.blocked).toBe(1);
    expect(review.scopeBreakdown.priorityCounts.urgent).toBe(1);
    expect(review.scopeBreakdown.dependency.dependencyBlockedCount).toBe(1);
    expect(review.riskSections.map((section) => section.type)).toEqual([
      'blocked',
      'dependency_blocked',
      'overdue',
      'due_soon',
      'unassigned_active',
      'stale_in_progress',
      'blocking_open_work',
      'unestimated',
      'over_target'
    ]);
    expect(review.riskSections.find((section) => section.type === 'over_target')).toMatchObject({
      count: 1,
      query: { cycleId: cycle.id, sort: 'priority_desc' }
    });
    expect(review.recentlyChangedWork).toHaveLength(4);
  });

  it('returns healthy, complete, and inactive cycle review health states', async () => {
    const fixture = await createFixture();
    const healthy = await fixture.service.createProjectCycle(fixture.projectId, {
      name: 'Healthy cycle',
      status: 'planned',
      startDate: '2026-07-01',
      endDate: '2026-07-12',
      targetPoints: 10
    });
    await createWorkItem(fixture, {
      cycleId: healthy.id,
      title: 'Ready estimated work',
      status: 'ready',
      estimatePoints: 3
    });
    const completed = await createHistoricalCycle(fixture, {
      name: 'Completed historical cycle',
      status: 'completed',
      startDate: '2026-06-01',
      endDate: '2026-06-12'
    });
    const canceled = await createHistoricalCycle(fixture, {
      name: 'Canceled historical cycle',
      status: 'canceled',
      startDate: '2026-05-01',
      endDate: '2026-05-12'
    });

    await expect(fixture.service.getCycleReview(fixture.projectId, healthy.id)).resolves.toMatchObject({
      health: { health: 'healthy', reasons: [] }
    });
    await expect(fixture.service.getCycleReview(fixture.projectId, completed.id)).resolves.toMatchObject({
      health: { health: 'complete' }
    });
    await expect(fixture.service.getCycleReview(fixture.projectId, canceled.id)).resolves.toMatchObject({
      health: { health: 'inactive' }
    });

    const archived = await fixture.service.archiveProjectCycle(fixture.projectId, healthy.id);
    await expect(fixture.service.getCycleReview(fixture.projectId, archived.id)).resolves.toMatchObject({
      health: { health: 'inactive' }
    });
  });
});

async function createWorkItem(
  fixture: Awaited<ReturnType<typeof createFixture>>,
  input: {
    cycleId: string;
    title: string;
    status?: 'backlog' | 'ready' | 'in_progress' | 'blocked' | 'done' | 'canceled';
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    assigneeId?: string | null;
    dueDate?: string | null;
    estimatePoints?: number | null;
    updatedAt?: Date;
  }
) {
  const id = randomUUID();
  const timestamp = now();
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
    assigneeId: input.assigneeId === undefined ? fixture.actorId : input.assigneeId,
    reporterId: fixture.actorId,
    milestoneId: null,
    cycleId: input.cycleId,
    boardPosition: 0,
    dueDate: input.dueDate ?? null,
    estimatePoints: input.estimatePoints === undefined ? 1 : input.estimatePoints,
    createdAt: timestamp,
    updatedAt: input.updatedAt ?? timestamp
  });
}
