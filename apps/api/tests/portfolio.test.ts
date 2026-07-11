import type { ProjectStatusReportSnapshotDto } from '@worktrail/contracts';
import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { createDb, createPool } from '../src/db/client.js';
import type { MemberRole, ProjectStatus, WorkItemStatus } from '../src/domain/constants.js';
import type { ActorContext } from '../src/domain/actor.js';
import { createRepositories, type Repositories } from '../src/repositories/index.js';
import type { NewProject } from '../src/repositories/types.js';
import { PortfolioService } from '../src/services/portfolio-service.js';

const workspaceIds = new Set<string>();
let pool: ReturnType<typeof createPool>;
let db: ReturnType<typeof createDb>;
let repositories: Repositories;
let nextWorkItemNumber = 1;

function now() {
  return new Date('2026-07-10T12:00:00.000Z');
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

async function createFixture(role: MemberRole = 'owner') {
  const timestamp = now();
  const workspaceId = randomUUID();
  const actorId = randomUUID();
  const contributorId = randomUUID();
  workspaceIds.add(workspaceId);

  await repositories.workspaces.create({
    id: workspaceId,
    name: 'Portfolio Test Workspace',
    createdAt: timestamp,
    updatedAt: timestamp
  });

  await repositories.members.create({
    id: actorId,
    workspaceId,
    name: 'Portfolio Actor',
    email: `${actorId}@example.com`,
    role,
    isActive: true,
    createdAt: timestamp,
    updatedAt: timestamp
  });

  await repositories.members.create({
    id: contributorId,
    workspaceId,
    name: 'Portfolio Contributor',
    email: `${contributorId}@example.com`,
    role: 'contributor',
    isActive: true,
    createdAt: timestamp,
    updatedAt: timestamp
  });

  return {
    workspaceId,
    actorId,
    contributorId,
    actor: {
      workspaceId,
      memberId: actorId,
      role
    } satisfies ActorContext
  };
}

async function createProject(input: Partial<NewProject> & { workspaceId: string }) {
  const timestamp = now();
  return repositories.projects.create({
    id: input.id ?? randomUUID(),
    workspaceId: input.workspaceId,
    key: input.key ?? 'PF',
    nextWorkItemNumber: input.nextWorkItemNumber ?? 1,
    name: input.name ?? 'Portfolio Project',
    description: input.description ?? 'Created for portfolio tests.',
    status: input.status ?? 'active',
    createdAt: input.createdAt ?? timestamp,
    updatedAt: input.updatedAt ?? timestamp
  });
}

async function createMilestone(input: {
  workspaceId: string;
  projectId: string;
  name: string;
  targetDate?: string | null;
}) {
  return repositories.milestones.create({
    id: randomUUID(),
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    name: input.name,
    description: '',
    status: 'active',
    targetDate: input.targetDate ?? '2026-07-18',
    archivedAt: null,
    archivedById: null,
    createdAt: now(),
    updatedAt: now()
  });
}

async function createCycle(input: { workspaceId: string; projectId: string; name: string }) {
  return repositories.projectCycles.create({
    id: randomUUID(),
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    name: input.name,
    goal: 'Complete the current execution window.',
    status: 'active',
    startDate: '2026-07-01',
    endDate: '2026-07-14',
    targetPoints: 8,
    archivedAt: null,
    archivedById: null,
    createdAt: now(),
    updatedAt: now()
  });
}

async function createWorkItem(input: {
  workspaceId: string;
  projectId: string;
  reporterId: string;
  title: string;
  status?: WorkItemStatus;
  assigneeId?: string | null;
  milestoneId?: string | null;
  cycleId?: string | null;
  dueDate?: string | null;
  estimatePoints?: number | null;
  updatedAt?: Date;
}) {
  const itemNumber = nextWorkItemNumber;
  nextWorkItemNumber += 1;

  return repositories.workItems.create({
    id: randomUUID(),
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    itemNumber,
    displayKey: `PF-${itemNumber}`,
    title: input.title,
    description: '',
    type: 'task',
    status: input.status ?? 'ready',
    priority: 'high',
    assigneeId: input.assigneeId === undefined ? input.reporterId : input.assigneeId,
    reporterId: input.reporterId,
    milestoneId: input.milestoneId ?? null,
    cycleId: input.cycleId ?? null,
    boardPosition: itemNumber * 1024,
    dueDate: input.dueDate ?? null,
    estimatePoints: input.estimatePoints ?? null,
    createdAt: now(),
    updatedAt: input.updatedAt ?? now()
  });
}

async function createBlockingRelationship(input: {
  workspaceId: string;
  actorId: string;
  sourceWorkItemId: string;
  targetWorkItemId: string;
}) {
  return repositories.workItemRelationships.create({
    id: randomUUID(),
    workspaceId: input.workspaceId,
    relationshipType: 'blocks',
    sourceWorkItemId: input.sourceWorkItemId,
    targetWorkItemId: input.targetWorkItemId,
    createdById: input.actorId,
    createdAt: now()
  });
}

async function createReport(input: {
  workspaceId: string;
  project: Awaited<ReturnType<typeof createProject>>;
  authorMemberId: string;
  publishedAt: Date;
  health?: ProjectStatusReportSnapshotDto['health']['health'];
}) {
  return repositories.projectStatusReports.create({
    id: randomUUID(),
    workspaceId: input.workspaceId,
    projectId: input.project.id,
    authorMemberId: input.authorMemberId,
    title: `${input.project.name} status`,
    statusDate: input.publishedAt.toISOString().slice(0, 10),
    summary: 'Portfolio test status.',
    highlights: '',
    risks: '',
    nextSteps: '',
    snapshot: createSnapshot(input.project, input.health ?? 'healthy'),
    publishedAt: input.publishedAt,
    createdAt: input.publishedAt
  });
}

function createSnapshot(
  project: Awaited<ReturnType<typeof createProject>>,
  health: ProjectStatusReportSnapshotDto['health']['health']
): ProjectStatusReportSnapshotDto {
  return {
    snapshotVersion: 1,
    generatedAt: now().toISOString(),
    project: {
      id: project.id,
      key: project.key,
      name: project.name,
      status: project.status as ProjectStatus
    },
    health: {
      health,
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
    },
    counts: {
      openWorkCount: 0,
      blockedWorkCount: 0,
      dependencyBlockedWorkCount: 0,
      blockingOpenWorkCount: 0,
      overdueWorkCount: 0,
      dueSoonWorkCount: 0,
      unassignedActiveWorkCount: 0,
      staleInProgressWorkCount: 0
    },
    milestones: [],
    cycle: null,
    risks: [],
    recentWork: []
  };
}

function service(actor: ActorContext) {
  return new PortfolioService({ actor, repositories, clock: now });
}

beforeAll(() => {
  pool = createPool();
  db = createDb(pool);
  repositories = createRepositories(db);
});

afterEach(async () => {
  nextWorkItemNumber = 1;
  await cleanupAllWorkspaces();
});

afterAll(async () => {
  await cleanupAllWorkspaces();
  await pool.end();
});

describe('portfolio service', () => {
  it('derives active project rows, summary counts, freshness, attention, and drill-down links', async () => {
    const fixture = await createFixture('owner');
    const blockedProject = await createProject({
      workspaceId: fixture.workspaceId,
      key: 'RISK',
      name: 'Risky Project'
    });
    const healthyProject = await createProject({
      workspaceId: fixture.workspaceId,
      key: 'OK',
      name: 'Healthy Project'
    });
    const archivedProject = await createProject({
      workspaceId: fixture.workspaceId,
      key: 'OLD',
      name: 'Archived Project',
      status: 'archived'
    });
    const blockedMilestone = await createMilestone({
      workspaceId: fixture.workspaceId,
      projectId: blockedProject.id,
      name: 'Risk milestone'
    });
    const activeCycle = await createCycle({
      workspaceId: fixture.workspaceId,
      projectId: blockedProject.id,
      name: 'Risk cycle'
    });
    const blocker = await createWorkItem({
      workspaceId: fixture.workspaceId,
      projectId: blockedProject.id,
      reporterId: fixture.actorId,
      title: 'Open blocker',
      status: 'blocked',
      milestoneId: blockedMilestone.id,
      cycleId: activeCycle.id,
      dueDate: '2026-07-01',
      estimatePoints: 5,
      updatedAt: new Date('2026-07-01T12:00:00.000Z')
    });
    const blockedByDependency = await createWorkItem({
      workspaceId: fixture.workspaceId,
      projectId: blockedProject.id,
      reporterId: fixture.actorId,
      title: 'Blocked by dependency',
      status: 'ready',
      milestoneId: blockedMilestone.id,
      cycleId: activeCycle.id,
      dueDate: '2026-07-08',
      estimatePoints: 5
    });
    await createBlockingRelationship({
      workspaceId: fixture.workspaceId,
      actorId: fixture.actorId,
      sourceWorkItemId: blocker.id,
      targetWorkItemId: blockedByDependency.id
    });
    await createWorkItem({
      workspaceId: fixture.workspaceId,
      projectId: healthyProject.id,
      reporterId: fixture.actorId,
      title: 'Healthy ready work',
      status: 'ready'
    });
    await createWorkItem({
      workspaceId: fixture.workspaceId,
      projectId: archivedProject.id,
      reporterId: fixture.actorId,
      title: 'Archived project work',
      status: 'blocked'
    });
    await createReport({
      workspaceId: fixture.workspaceId,
      project: blockedProject,
      authorMemberId: fixture.actorId,
      publishedAt: new Date('2026-06-20T12:00:00.000Z'),
      health: 'blocked'
    });
    await createReport({
      workspaceId: fixture.workspaceId,
      project: healthyProject,
      authorMemberId: fixture.actorId,
      publishedAt: new Date('2026-07-05T12:00:00.000Z')
    });

    const portfolio = await service(fixture.actor).getPortfolio();

    expect(portfolio.generatedAt).toBe('2026-07-10T12:00:00.000Z');
    expect(portfolio.summary).toMatchObject({
      activeProjectCount: 2,
      blockedProjectCount: 1,
      overdueProjectCount: 1,
      dependencyPressureProjectCount: 1,
      missingOrStaleReportProjectCount: 1
    });
    expect(portfolio.projects.map((row) => row.project.key)).toEqual(['RISK', 'OK']);
    expect(portfolio.projects.some((row) => row.project.key === 'OLD')).toBe(false);

    const risky = portfolio.projects[0]!;
    expect(risky.deliveryHealth.health).toBe('blocked');
    expect(risky.report).toMatchObject({
      freshness: 'stale',
      daysSincePublished: 20,
      thresholdDays: 14
    });
    expect(risky.report.latestReport).toMatchObject({
      projectId: blockedProject.id,
      health: 'blocked',
      author: { id: fixture.actorId }
    });
    expect(risky.planning.activeMilestone).toMatchObject({
      id: blockedMilestone.id,
      name: 'Risk milestone',
      health: 'blocked'
    });
    expect(risky.planning.activeCycle).toMatchObject({
      id: activeCycle.id,
      name: 'Risk cycle',
      health: 'blocked',
      openWorkCount: 2
    });
    expect(risky.links.dependencyBlockedWork).toEqual({
      label: 'Dependency-blocked work',
      route: `/projects/${blockedProject.id}/work-items`,
      query: { dependency: 'dependency_blocked', sort: 'priority_desc' },
      queryScope: 'project'
    });

    expect(portfolio.attention.needsAttention[0]).toMatchObject({
      type: 'delivery_risk',
      project: { id: blockedProject.id },
      severity: 'critical'
    });
    expect(portfolio.attention.communicationFreshness[0]).toMatchObject({
      type: 'communication_freshness',
      project: { id: blockedProject.id },
      severity: 'info'
    });
    expect(portfolio.attention.currentExecution[0]).toMatchObject({
      type: 'current_execution',
      project: { id: blockedProject.id },
      link: { route: `/projects/${blockedProject.id}/cycles/${activeCycle.id}` }
    });
    expect(portfolio.attention.dependencyPressure[0]).toMatchObject({
      type: 'dependency_pressure',
      project: { id: blockedProject.id },
      link: { query: { dependency: 'dependency_blocked', sort: 'priority_desc' } }
    });
  });

  it('allows contributors to read portfolio and marks missing reports', async () => {
    const fixture = await createFixture('contributor');
    const project = await createProject({
      workspaceId: fixture.workspaceId,
      key: 'MISS',
      name: 'Missing Report Project'
    });

    await createWorkItem({
      workspaceId: fixture.workspaceId,
      projectId: project.id,
      reporterId: fixture.actorId,
      title: 'Open work',
      status: 'ready'
    });

    const portfolio = await service(fixture.actor).getPortfolio();

    expect(portfolio.summary).toMatchObject({
      activeProjectCount: 1,
      missingOrStaleReportProjectCount: 1
    });
    expect(portfolio.projects[0]).toMatchObject({
      project: { id: project.id, key: 'MISS' },
      report: {
        freshness: 'missing',
        latestReport: null,
        daysSincePublished: null
      }
    });
    expect(portfolio.attention.communicationFreshness[0]).toMatchObject({
      title: 'MISS has no report',
      link: { route: `/projects/${project.id}/status` }
    });
  });

  it('returns an empty portfolio for workspaces with no active projects', async () => {
    const fixture = await createFixture('owner');

    const portfolio = await service(fixture.actor).getPortfolio();

    expect(portfolio.summary).toEqual({
      activeProjectCount: 0,
      blockedProjectCount: 0,
      atRiskProjectCount: 0,
      onTrackProjectCount: 0,
      overdueProjectCount: 0,
      dependencyPressureProjectCount: 0,
      missingOrStaleReportProjectCount: 0
    });
    expect(portfolio.projects).toEqual([]);
    expect(portfolio.attention).toEqual({
      needsAttention: [],
      communicationFreshness: [],
      currentExecution: [],
      dependencyPressure: []
    });
  });
});
