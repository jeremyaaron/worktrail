import { randomUUID } from 'node:crypto';

import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { createExpressApp } from '../src/adapters/express/server.js';
import { createDb, createPool } from '../src/db/client.js';
import type { MemberRole, ProjectStatus, WorkItemPriority, WorkItemStatus } from '../src/domain/constants.js';
import { createRepositories, type Repositories } from '../src/repositories/index.js';
import { ProjectStatusReportService } from '../src/services/project-status-report-service.js';

const workspaceIds = new Set<string>();
let pool: ReturnType<typeof createPool>;
let db: ReturnType<typeof createDb>;
let repositories: Repositories;
let app: ReturnType<typeof createExpressApp>;
let nextItemNumber = 1;

function now() {
  return new Date('2026-07-10T12:00:00.000Z');
}

function staleUpdatedAt() {
  return new Date('2026-07-01T12:00:00.000Z');
}

function actorHeaders(input: { workspaceId: string; memberId: string; role: MemberRole }) {
  return {
    'x-worktrail-workspace-id': input.workspaceId,
    'x-worktrail-member-id': input.memberId,
    'x-worktrail-role': input.role
  };
}

async function cleanupWorkspace(workspaceId: string) {
  await pool.query('delete from notifications where workspace_id = $1', [workspaceId]);
  await pool.query('delete from comment_mentions where workspace_id = $1', [workspaceId]);
  await pool.query('delete from project_status_reports where workspace_id = $1', [workspaceId]);
  await pool.query('delete from activity_events where workspace_id = $1', [workspaceId]);
  await pool.query('delete from comments where workspace_id = $1', [workspaceId]);
  await pool.query('delete from saved_work_views where workspace_id = $1', [workspaceId]);
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

async function createFixture(
  input: { actorRole?: MemberRole; projectStatus?: ProjectStatus; projectKey?: string } = {}
) {
  const timestamp = now();
  const workspaceId = randomUUID();
  const actorId = randomUUID();
  const assigneeId = randomUUID();
  const projectId = randomUUID();
  const actorRole = input.actorRole ?? 'owner';
  workspaceIds.add(workspaceId);

  await repositories.workspaces.create({
    id: workspaceId,
    name: 'Status Report Test Workspace',
    createdAt: timestamp,
    updatedAt: timestamp
  });

  await repositories.members.create({
    id: actorId,
    workspaceId,
    name: 'Status Report Actor',
    email: `${actorId}@example.com`,
    role: actorRole,
    isActive: true,
    createdAt: timestamp,
    updatedAt: timestamp
  });

  await repositories.members.create({
    id: assigneeId,
    workspaceId,
    name: 'Status Report Assignee',
    email: `${assigneeId}@example.com`,
    role: 'contributor',
    isActive: true,
    createdAt: timestamp,
    updatedAt: timestamp
  });

  await repositories.projects.create({
    id: projectId,
    workspaceId,
    key: input.projectKey ?? 'STAT',
    nextWorkItemNumber: 1,
    name: 'Status Report Test Project',
    description: 'Project for status report service tests.',
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
      role: actorRole
    },
    headers: actorHeaders({ workspaceId, memberId: actorId, role: actorRole })
  };
}

async function createMilestone(
  fixture: Awaited<ReturnType<typeof createFixture>>,
  input: {
    name: string;
    status?: 'planned' | 'active' | 'completed' | 'canceled';
    targetDate?: string | null;
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
    archivedAt: null,
    archivedById: null,
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
    goal: `${input.name} status report goal.`,
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

async function createWorkItem(
  fixture: Awaited<ReturnType<typeof createFixture>>,
  input: {
    title: string;
    status?: WorkItemStatus;
    priority?: WorkItemPriority;
    assigneeId?: string | null;
    milestoneId?: string | null;
    cycleId?: string | null;
    dueDate?: string | null;
    estimatePoints?: number | null;
    parentWorkItemId?: string | null;
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
    displayKey: `STAT-${itemNumber}`,
    type: 'task',
    status: input.status ?? 'backlog',
    priority: input.priority ?? 'medium',
    assigneeId: input.assigneeId === undefined ? fixture.assigneeId : input.assigneeId,
    reporterId: fixture.actorId,
    milestoneId: input.milestoneId ?? null,
    cycleId: input.cycleId ?? null,
    parentWorkItemId: input.parentWorkItemId ?? null,
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

function createService(fixture: Awaited<ReturnType<typeof createFixture>>) {
  return new ProjectStatusReportService({
    actor: fixture.actor,
    repositories,
    db,
    clock: now
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

describe('project status reports', () => {
  it('generates deterministic draft copy and a project health snapshot', async () => {
    const fixture = await createFixture();
    const activeMilestone = await createMilestone(fixture, {
      name: 'v0.1.8',
      status: 'active',
      targetDate: '2026-07-18'
    });
    await createMilestone(fixture, {
      name: 'v0.1.9',
      status: 'planned',
      targetDate: '2026-08-01'
    });
    await createMilestone(fixture, {
      name: 'Completed release',
      status: 'completed',
      targetDate: '2026-07-01'
    });
    const activeCycle = await createProjectCycle(fixture, {
      name: 'Status cycle',
      status: 'active',
      startDate: '2026-07-08',
      endDate: '2026-07-15',
      targetPoints: 10
    });

    const blocker = await createWorkItem(fixture, {
      title: 'Open blocker',
      status: 'blocked',
      priority: 'urgent',
      milestoneId: activeMilestone.id,
      cycleId: activeCycle.id,
      estimatePoints: 5,
      dueDate: '2026-07-09'
    });
    const blocked = await createWorkItem(fixture, {
      title: 'Blocked by dependency',
      status: 'in_progress',
      priority: 'high',
      milestoneId: activeMilestone.id,
      cycleId: activeCycle.id,
      estimatePoints: 3,
      dueDate: '2026-07-12',
      parentWorkItemId: blocker.id
    });
    await createWorkItem(fixture, {
      title: 'Unassigned ready work',
      status: 'ready',
      priority: 'medium',
      assigneeId: null,
      milestoneId: activeMilestone.id,
      cycleId: activeCycle.id
    });
    await createWorkItem(fixture, {
      title: 'Stale implementation',
      status: 'in_progress',
      priority: 'low',
      milestoneId: activeMilestone.id,
      cycleId: activeCycle.id,
      estimatePoints: 4,
      updatedAt: staleUpdatedAt()
    });
    await createBlockingRelationship(fixture, {
      sourceWorkItemId: blocker.id,
      targetWorkItemId: blocked.id
    });

    const draft = await createService(fixture).getProjectStatusReportDraft(fixture.projectId);

    expect(draft.title).toBe('Status update - 2026-07-10');
    expect(draft.statusDate).toBe('2026-07-10');
    expect(draft.summary).toContain('4 open work items');
    expect(draft.risks).toContain('Blocked work: 1');
    expect(draft.snapshot.snapshotVersion).toBe(1);
    expect(draft.snapshot.project).toMatchObject({ id: fixture.projectId, key: 'STAT' });
    expect(draft.snapshot.counts).toMatchObject({
      openWorkCount: 4,
      blockedWorkCount: 1,
      dependencyBlockedWorkCount: 1,
      blockingOpenWorkCount: 1,
      overdueWorkCount: 1,
      dueSoonWorkCount: 1,
      unassignedActiveWorkCount: 1,
      staleInProgressWorkCount: 1
    });
    expect(draft.snapshot.milestones.map((milestone) => milestone.name)).toEqual(['v0.1.8', 'v0.1.9']);
    expect(draft.snapshot.risks.map((risk) => risk.type)).toEqual([
      'blocked',
      'dependency_blocked',
      'overdue',
      'due_soon',
      'unassigned_active',
      'stale_in_progress',
      'blocking_open_work'
    ]);
    expect(draft.snapshot.risks.find((risk) => risk.type === 'dependency_blocked')).toMatchObject({
      count: 1,
      query: { dependency: 'dependency_blocked', sort: 'priority_desc' },
      items: [
        expect.objectContaining({
          id: blocked.id,
          parent: expect.objectContaining({ id: blocker.id, displayKey: blocker.displayKey })
        })
      ]
    });
    expect(draft.snapshot.cycle).toMatchObject({
      id: activeCycle.id,
      name: 'Status cycle',
      status: 'active',
      targetPoints: 10,
      committedEstimatePoints: 12,
      completedEstimatePoints: 0,
      openWorkCount: 4,
      blockedWorkCount: 1,
      dependencyBlockedWorkCount: 1,
      unestimatedWorkCount: 1,
      health: 'blocked',
      links: expect.arrayContaining([
        expect.objectContaining({
          type: 'cycle_review',
          projectId: fixture.projectId,
          cycleId: activeCycle.id
        }),
        expect.objectContaining({
          type: 'project_work',
          projectId: fixture.projectId,
          query: { cycleId: activeCycle.id, workState: 'open', sort: 'priority_desc' }
        })
      ])
    });
    expect(draft.snapshot.cycle?.reasons).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'cycle_over_target',
        query: { cycleId: activeCycle.id, sort: 'priority_desc' }
      }),
      expect.objectContaining({
        key: 'unestimated_work',
        query: { cycleId: activeCycle.id, workState: 'open', sort: 'priority_desc' }
      })
    ]));
    expect(draft.snapshot.recentWork).toHaveLength(4);
    expect(draft.snapshot.recentWork.find((item) => item.id === blocked.id)?.parent).toMatchObject({
      id: blocker.id
    });
  });

  it('publishes, lists, and returns immutable report snapshots with activity', async () => {
    const fixture = await createFixture();
    const workItem = await createWorkItem(fixture, {
      title: 'Tracked report work',
      status: 'blocked',
      priority: 'high',
      dueDate: '2026-07-09'
    });
    const service = createService(fixture);
    const draft = await service.getProjectStatusReportDraft(fixture.projectId);
    expect(draft.snapshot.cycle).toBeNull();

    const published = await service.publishProjectStatusReport(fixture.projectId, {
      title: '  Executive weekly status  ',
      statusDate: '2026-07-10',
      summary: '  Delivery is under watch.  ',
      highlights: '  Scope is clear.  ',
      risks: '  A blocker remains.  ',
      nextSteps: '  Clear the blocker.  ',
      snapshot: draft.snapshot
    });

    await repositories.workItems.update(workItem.id, {
      status: 'done',
      updatedAt: new Date('2026-07-11T12:00:00.000Z')
    });

    const [listed] = await service.listProjectStatusReports(fixture.projectId);
    const detail = await service.getProjectStatusReport(fixture.projectId, published.id);
    const activity = await repositories.activityEvents.findByProject(fixture.projectId);
    await repositories.projects.updateStatus(
      fixture.projectId,
      'archived',
      new Date('2026-07-11T12:00:00.000Z')
    );
    const contributorService = new ProjectStatusReportService({
      actor: {
        workspaceId: fixture.workspaceId,
        memberId: fixture.assigneeId,
        role: 'contributor'
      },
      repositories,
      db,
      clock: now
    });
    const contributorList = await contributorService.listProjectStatusReports(fixture.projectId);
    const contributorDetail = await contributorService.getProjectStatusReport(
      fixture.projectId,
      published.id
    );

    expect(published.title).toBe('Executive weekly status');
    expect(published.summary).toBe('Delivery is under watch.');
    expect(published.highlights).toBe('Scope is clear.');
    expect(published.risks).toBe('A blocker remains.');
    expect(published.nextSteps).toBe('Clear the blocker.');
    expect(listed).toMatchObject({
      id: published.id,
      projectId: fixture.projectId,
      title: 'Executive weekly status',
      health: draft.snapshot.health.health
    });
    expect(detail.snapshot.counts.blockedWorkCount).toBe(1);
    expect(detail.snapshot.cycle).toBeNull();
    expect(detail.snapshot.recentWork[0]?.id).toBe(workItem.id);
    expect(activity[0]).toMatchObject({
      eventType: 'status_report.published',
      summary: 'Status report "Executive weekly status" published.',
      newValue: { reportId: published.id, title: 'Executive weekly status', statusDate: '2026-07-10' }
    });
    expect(contributorList[0]?.id).toBe(published.id);
    expect(contributorDetail.id).toBe(published.id);
    expect(contributorDetail.project.status).toBe('archived');
  });

  it('exports immutable report snapshots as Markdown without creating activity', async () => {
    const fixture = await createFixture();
    const activeCycle = await createProjectCycle(fixture, {
      name: 'Export cycle',
      status: 'active',
      startDate: '2026-07-08',
      endDate: '2026-07-15',
      targetPoints: 5
    });
    const workItem = await createWorkItem(fixture, {
      title: 'Tracked export work',
      status: 'blocked',
      priority: 'high',
      cycleId: activeCycle.id,
      estimatePoints: 3,
      dueDate: '2026-07-09'
    });
    const service = createService(fixture);
    const draft = await service.getProjectStatusReportDraft(fixture.projectId);
    const published = await service.publishProjectStatusReport(fixture.projectId, {
      title: 'Executive weekly status',
      statusDate: '2026-07-10',
      summary: 'Delivery is under watch.',
      snapshot: draft.snapshot
    });
    expect(published.snapshot.cycle).toMatchObject({
      id: activeCycle.id,
      name: 'Export cycle',
      openWorkCount: 1,
      blockedWorkCount: 1
    });
    const activityBefore = await repositories.activityEvents.findByProject(fixture.projectId);

    await repositories.workItems.update(workItem.id, {
      status: 'done',
      updatedAt: new Date('2026-07-11T12:00:00.000Z')
    });

    const exportResult = await service.exportProjectStatusReportMarkdown(
      fixture.projectId,
      published.id
    );
    const activityAfter = await repositories.activityEvents.findByProject(fixture.projectId);

    expect(exportResult.fileName).toBe(
      'worktrail-stat-2026-07-10-executive-weekly-status.md'
    );
    expect(exportResult.markdown).toContain('# Executive weekly status');
    expect(exportResult.markdown).toContain('| Blocked work | 1 |');
    expect(exportResult.markdown).toContain('## Active Cycle');
    expect(exportResult.markdown).toContain('[Export cycle]');
    expect(exportResult.markdown).toContain('Open current cycle work');
    expect(exportResult.markdown).toContain('[STAT-1 - Tracked export work]');
    expect(activityAfter).toHaveLength(activityBefore.length);
  });

  it('rejects invalid stored report snapshots on list, detail, and Markdown export', async () => {
    const fixture = await createFixture();
    const service = createService(fixture);
    const draft = await service.getProjectStatusReportDraft(fixture.projectId);
    const published = await service.publishProjectStatusReport(fixture.projectId, {
      title: 'Snapshot validation status',
      statusDate: '2026-07-10',
      summary: 'This report will be corrupted for parser coverage.',
      snapshot: draft.snapshot
    });

    await pool.query('update project_status_reports set snapshot = $1::jsonb where id = $2', [
      JSON.stringify({ ...draft.snapshot, snapshotVersion: 2 }),
      published.id
    ]);

    await request(app)
      .get(`/api/projects/${fixture.projectId}/status-reports`)
      .set(fixture.headers)
      .expect(409)
      .expect(({ body }) => {
        expect(body.error).toMatchObject({
          code: 'CONFLICT',
          message: 'Stored status report snapshot is invalid.'
        });
      });

    await request(app)
      .get(`/api/projects/${fixture.projectId}/status-reports/${published.id}`)
      .set(fixture.headers)
      .expect(409)
      .expect(({ body }) => {
        expect(body.error).toMatchObject({
          code: 'CONFLICT',
          message: 'Stored status report snapshot is invalid.'
        });
      });

    await request(app)
      .get(`/api/projects/${fixture.projectId}/status-reports/${published.id}/export.md`)
      .set(fixture.headers)
      .expect(409)
      .expect(({ body }) => {
        expect(body.error).toMatchObject({
          code: 'CONFLICT',
          message: 'Stored status report snapshot is invalid.'
        });
      });
  });

  it('accepts legacy stored report snapshots without cycle data', async () => {
    const fixture = await createFixture();
    await createWorkItem(fixture, {
      title: 'Legacy top-level report work',
      status: 'ready'
    });
    const service = createService(fixture);
    const draft = await service.getProjectStatusReportDraft(fixture.projectId);
    const published = await service.publishProjectStatusReport(fixture.projectId, {
      title: 'Legacy snapshot status',
      statusDate: '2026-07-10',
      summary: 'This report simulates an older stored snapshot.',
      snapshot: draft.snapshot
    });

    const withoutParent = <T extends { parent?: unknown }>(item: T): Omit<T, 'parent'> => {
      const { parent: _parent, ...legacyItem } = item;
      return legacyItem;
    };
    const legacySnapshot = {
      ...draft.snapshot,
      cycle: undefined,
      risks: draft.snapshot.risks.map((risk) => ({
        ...risk,
        items: risk.items.map(withoutParent)
      })),
      recentWork: draft.snapshot.recentWork.map(withoutParent)
    };
    const { cycle: _cycle, ...storedLegacySnapshot } = legacySnapshot;

    await pool.query('update project_status_reports set snapshot = $1::jsonb where id = $2', [
      JSON.stringify(storedLegacySnapshot),
      published.id
    ]);

    const detail = await service.getProjectStatusReport(fixture.projectId, published.id);
    const [listed] = await service.listProjectStatusReports(fixture.projectId);
    const exportResult = await service.exportProjectStatusReportMarkdown(fixture.projectId, published.id);

    expect(detail.snapshot.cycle).toBeUndefined();
    expect(detail.snapshot.recentWork[0]?.parent).toBeUndefined();
    expect(listed?.id).toBe(published.id);
    expect(exportResult.markdown).toContain('No active cycle captured.');
  });

  it('rejects draft and publish access for contributors and archived projects', async () => {
    const contributorFixture = await createFixture({ actorRole: 'contributor' });
    const contributorService = createService(contributorFixture);

    await expect(
      contributorService.getProjectStatusReportDraft(contributorFixture.projectId)
    ).rejects.toMatchObject({
      status: 403,
      message: 'Only owners and maintainers can publish project status reports.'
    });
    await expect(
      contributorService.publishProjectStatusReport(contributorFixture.projectId, {
        title: 'Contributor report',
        statusDate: '2026-07-10',
        summary: 'Not allowed.'
      })
    ).rejects.toMatchObject({ status: 403 });

    const archivedFixture = await createFixture({ projectStatus: 'archived', projectKey: 'ARCV' });
    const archivedService = createService(archivedFixture);

    await expect(
      archivedService.getProjectStatusReportDraft(archivedFixture.projectId)
    ).rejects.toMatchObject({
      status: 409,
      message: 'Archived projects cannot publish status reports.'
    });
    await expect(
      archivedService.publishProjectStatusReport(archivedFixture.projectId, {
        title: 'Archived report',
        statusDate: '2026-07-10',
        summary: 'Not allowed.'
      })
    ).rejects.toMatchObject({ status: 409 });
  });

  it('does not expose a status report through another project route', async () => {
    const fixture = await createFixture();
    const otherProjectId = randomUUID();
    await repositories.projects.create({
      id: otherProjectId,
      workspaceId: fixture.workspaceId,
      key: 'OTHR',
      nextWorkItemNumber: 1,
      name: 'Other Project',
      description: '',
      status: 'active',
      createdAt: now(),
      updatedAt: now()
    });

    const service = createService(fixture);
    const published = await service.publishProjectStatusReport(fixture.projectId, {
      title: 'Scoped report',
      statusDate: '2026-07-10',
      summary: 'Visible only through its owning project.'
    });

    await expect(service.getProjectStatusReport(otherProjectId, published.id)).rejects.toMatchObject({
      status: 404,
      message: 'Status report not found.'
    });
  });
});

describe('project status report API', () => {
  it('generates a draft through the Express route', async () => {
    const fixture = await createFixture();
    await createWorkItem(fixture, {
      title: 'Blocked API work',
      status: 'blocked',
      priority: 'high',
      dueDate: '2026-07-09'
    });

    await request(app)
      .get(`/api/projects/${fixture.projectId}/status-reports/draft`)
      .set(fixture.headers)
      .expect(200)
      .expect(({ body }) => {
        expect(body.project.id).toBe(fixture.projectId);
        expect(body.title).toMatch(/^Status update - \d{4}-\d{2}-\d{2}$/);
        expect(body.snapshot.snapshotVersion).toBe(1);
        expect(body.snapshot.counts.blockedWorkCount).toBe(1);
        expect(body.snapshot.risks.map((risk: { type: string }) => risk.type)).toEqual([
          'blocked',
          'dependency_blocked',
          'overdue',
          'due_soon',
          'unassigned_active',
          'stale_in_progress',
          'blocking_open_work'
        ]);
      });
  });

  it('publishes, lists newest first, and returns detail through Express routes', async () => {
    const fixture = await createFixture();
    await createWorkItem(fixture, {
      title: 'Report API work',
      status: 'blocked',
      priority: 'urgent',
      dueDate: '2026-07-09'
    });
    const draftResponse = await request(app)
      .get(`/api/projects/${fixture.projectId}/status-reports/draft`)
      .set(fixture.headers)
      .expect(200);
    const firstResponse = await request(app)
      .post(`/api/projects/${fixture.projectId}/status-reports`)
      .set(fixture.headers)
      .send({
        title: 'First status',
        statusDate: '2026-07-10',
        summary: 'First summary.',
        snapshot: draftResponse.body.snapshot
      })
      .expect(201);
    const secondResponse = await request(app)
      .post(`/api/projects/${fixture.projectId}/status-reports`)
      .set(fixture.headers)
      .send({
        title: 'Second status',
        statusDate: '2026-07-11',
        summary: 'Second summary.',
        highlights: 'Progress.',
        risks: 'Watch risk.',
        nextSteps: 'Follow up.'
      })
      .expect(201);

    await request(app)
      .get(`/api/projects/${fixture.projectId}/status-reports`)
      .set(fixture.headers)
      .expect(200)
      .expect(({ body }) => {
        expect(body.map((report: { id: string }) => report.id)).toEqual([
          secondResponse.body.id,
          firstResponse.body.id
        ]);
        expect(body[0]).toMatchObject({
          title: 'Second status',
          projectId: fixture.projectId,
          author: { id: fixture.actorId }
        });
      });

    await request(app)
      .get(`/api/projects/${fixture.projectId}/status-reports/${firstResponse.body.id}`)
      .set(fixture.headers)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          id: firstResponse.body.id,
          title: 'First status',
          summary: 'First summary.',
          snapshot: { counts: { blockedWorkCount: 1 } }
        });
      });
  });

  it('exports Markdown through Express routes for readers and archived projects', async () => {
    const fixture = await createFixture();
    await createWorkItem(fixture, {
      title: 'Report export API work',
      status: 'blocked',
      priority: 'urgent',
      dueDate: '2026-07-09'
    });
    const draftResponse = await request(app)
      .get(`/api/projects/${fixture.projectId}/status-reports/draft`)
      .set(fixture.headers)
      .expect(200);
    const publishedResponse = await request(app)
      .post(`/api/projects/${fixture.projectId}/status-reports`)
      .set(fixture.headers)
      .send({
        title: 'Executive weekly status',
        statusDate: '2026-07-10',
        summary: 'Delivery is under watch.',
        snapshot: draftResponse.body.snapshot
      })
      .expect(201);
    const exportPath = `/api/projects/${fixture.projectId}/status-reports/${publishedResponse.body.id}/export.md`;

    await request(app)
      .get(exportPath)
      .set(fixture.headers)
      .expect(200)
      .expect('Content-Type', /text\/markdown/)
      .expect(({ headers, text }) => {
        expect(headers['content-disposition']).toBe(
          'attachment; filename="worktrail-stat-2026-07-10-executive-weekly-status.md"'
        );
        expect(text).toContain('# Executive weekly status');
        expect(text).toContain('> Published snapshot.');
        expect(text).toContain('| Blocked work | 1 |');
        expect(text).toContain(
          '[Open current work](/projects/' +
            `${fixture.projectId}/work-items?status=blocked&sort=priority_desc)`
        );
        expect(text).toContain('[STAT-1 - Report export API work]');
      });

    await request(app)
      .get(exportPath)
      .set(
        actorHeaders({
          workspaceId: fixture.workspaceId,
          memberId: fixture.assigneeId,
          role: 'contributor'
        })
      )
      .expect(200)
      .expect('Content-Type', /text\/markdown/);

    await repositories.projects.updateStatus(
      fixture.projectId,
      'archived',
      new Date('2026-07-11T12:00:00.000Z')
    );

    await request(app).get(exportPath).set(fixture.headers).expect(200);
  });

  it('returns validation errors before publishing invalid bodies', async () => {
    const fixture = await createFixture();

    await request(app)
      .post(`/api/projects/${fixture.projectId}/status-reports`)
      .set(fixture.headers)
      .send({
        title: '',
        statusDate: '07/10/2026',
        summary: ''
      })
      .expect(400)
      .expect(({ body }) => {
        expect(body.error.code).toBe('VALIDATION_ERROR');
        expect(body.error.message).toBe('Request validation failed.');
      });

    const draft = await createService(fixture).getProjectStatusReportDraft(fixture.projectId);

    await request(app)
      .post(`/api/projects/${fixture.projectId}/status-reports`)
      .set(fixture.headers)
      .send({
        title: 'Invalid snapshot',
        statusDate: '2026-07-10',
        summary: 'Snapshot shape should be validated.',
        snapshot: {
          ...draft.snapshot,
          snapshotVersion: 2
        }
      })
      .expect(400)
      .expect(({ body }) => {
        expect(body.error.code).toBe('VALIDATION_ERROR');
        expect(body.error.message).toBe('Request validation failed.');
      });
  });

  it('enforces publish permissions, archived project rejection, and route scoping', async () => {
    const contributorFixture = await createFixture({ actorRole: 'contributor' });

    await request(app)
      .post(`/api/projects/${contributorFixture.projectId}/status-reports`)
      .set(contributorFixture.headers)
      .send({
        title: 'Contributor report',
        statusDate: '2026-07-10',
        summary: 'Not allowed.'
      })
      .expect(403);

    const archivedFixture = await createFixture({ projectStatus: 'archived', projectKey: 'ARCA' });

    await request(app)
      .get(`/api/projects/${archivedFixture.projectId}/status-reports/draft`)
      .set(archivedFixture.headers)
      .expect(409);

    const ownerFixture = await createFixture({ projectKey: 'SCOP' });
    const published = await request(app)
      .post(`/api/projects/${ownerFixture.projectId}/status-reports`)
      .set(ownerFixture.headers)
      .send({
        title: 'Scoped report',
        statusDate: '2026-07-10',
        summary: 'Only visible under the owning project.'
      })
      .expect(201);
    const otherProjectId = randomUUID();
    await repositories.projects.create({
      id: otherProjectId,
      workspaceId: ownerFixture.workspaceId,
      key: 'OTHR',
      nextWorkItemNumber: 1,
      name: 'Other Project',
      description: '',
      status: 'active',
      createdAt: now(),
      updatedAt: now()
    });

    await request(app)
      .get(`/api/projects/${otherProjectId}/status-reports/${published.body.id}`)
      .set(ownerFixture.headers)
      .expect(404);

    await request(app)
      .get(`/api/projects/${otherProjectId}/status-reports/${published.body.id}/export.md`)
      .set(ownerFixture.headers)
      .expect(404);

    await request(app)
      .get(`/api/projects/${ownerFixture.projectId}/status-reports/${randomUUID()}/export.md`)
      .set(ownerFixture.headers)
      .expect(404);
  });
});
