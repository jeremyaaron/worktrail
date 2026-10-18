import { randomUUID } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest';
import { createDb, createPool } from '../src/db/client.js';
import * as schema from '../src/db/schema.js';
import { createRepositories, type Repositories } from '../src/repositories/index.js';
import { createPersistence, type Persistence } from '../src/repositories/persistence.js';
import { MyWorkService } from '../src/services/my-work-service.js';
import { PortfolioService } from '../src/services/portfolio-service.js';
import { PlanningService } from '../src/services/planning-service.js';
import { MilestoneReviewService } from '../src/services/milestone-review-service.js';
import { ProjectCycleService } from '../src/services/project-cycle-service.js';
import { WorkItemQueryService } from '../src/services/work-item-query-service.js';
import { ProjectCycleCloseoutService } from '../src/services/project-cycle-closeout-service.js';
import { createAggregateFixture } from './support/aggregate-fixture.js';
import { cleanupWorkspace } from './support/workspace-fixtures.js';

let pool: ReturnType<typeof createPool>, db: ReturnType<typeof createDb>;
const workspaceIds = new Set<string>();
beforeAll(() => { pool = createPool(); db = createDb(pool); });
afterEach(async () => { for (const id of workspaceIds) await cleanupWorkspace(pool, id); workspaceIds.clear(); });
afterAll(async () => pool.end());
async function fixture() {
  const id = randomUUID(); workspaceIds.add(id);
  const f = await createAggregateFixture(db, id, 1);
  return { ...f, repositories: createRepositories(db), persistence: createPersistence(db), clock: () => f.now };
}

it('projects only evaluation facts and preserves cross-project/terminal dependency membership', async () => {
  const id = randomUUID(); workspaceIds.add(id);
  const f = await createAggregateFixture(db, id, 2);
  await db.insert(schema.workItemRelationships).values({ id: randomUUID(), workspaceId: id,
    sourceWorkItemId: f.work[0]!.id, targetWorkItemId: f.work[60]!.id,
    relationshipType: 'blocks', createdById: f.actor.memberId, createdAt: f.now });
  const repositories = createRepositories(db);
  const projectRows = await repositories.workItems.listEvaluationByProject(f.projects[1]!.id);
  const workspaceRows = await repositories.workItems.listEvaluationByWorkspace(id);
  expect(projectRows).toHaveLength(60);
  expect(workspaceRows).toHaveLength(120);
  for (const row of workspaceRows.map(record => record.workItem)) {
    for (const omitted of ['description', 'descriptionFormat', 'type', 'boardPosition']) expect(row).not.toHaveProperty(omitted);
    const index = f.work.findIndex(item => item.id === row.id), local = index % 60;
    expect(row.dependencyBlocked).toBe(index === 60 || (local > 0 && !['done', 'canceled'].includes(f.work[index - 1]!.status!)));
    expect(row.blockingOpenWork).toBe(local < 59 && !['done', 'canceled'].includes(f.work[index + 1]!.status!));
  }
  expect(projectRows.find(row => row.id === f.work[60]!.id)?.dependencyBlocked).toBe(true);
});

it('keeps My Work counts and ordered eight-row previews equal to complete hydrated query results', async () => {
  const f = await fixture();
  const service = new WorkItemQueryService(f);
  const assigned = await service.listWorkspaceWorkItems({ assigneeId: f.actor.memberId, workState: 'open' });
  const reported = await service.listWorkspaceWorkItems({ reporterId: f.actor.memberId, workState: 'open' });
  const relevant = (item: typeof assigned[number]) => item.assignee?.id === f.actor.memberId || item.reporter.id === f.actor.memberId;
  const blocked = (await service.listWorkspaceWorkItems({ blocked: true, sort: 'priority_desc' })).filter(relevant);
  const dependency = await service.listWorkspaceWorkItems({ assigneeId: f.actor.memberId, workState: 'open', dependency: 'dependency_blocked', sort: 'priority_desc' });
  const recent = (await service.listWorkspaceWorkItems({ workState: 'open' })).filter(relevant);
  const clock = vi.fn(() => f.now);
  const dashboard = await new MyWorkService({ ...f, clock }).getDashboard();
  expect(clock).toHaveBeenCalledOnce();
  expect(dashboard.assignedToMe).toEqual(assigned.slice(0, 8));
  expect(dashboard.reportedByMe).toEqual(reported.slice(0, 8));
  expect(dashboard.blockedRelevant).toEqual(blocked.slice(0, 8));
  expect(dashboard.dependencyBlockedAssigned).toEqual(dependency.slice(0, 8));
  expect(dashboard.recentlyUpdated).toEqual(recent.slice(0, 8));
  const overdue = assigned.filter(item => item.dueDate !== null && item.dueDate < '2026-10-17');
  const dueSoon = assigned.filter(item => item.dueDate !== null && item.dueDate >= '2026-10-17' && item.dueDate <= '2026-10-24');
  const stale = assigned.filter(item => ['in_progress', 'blocked'].includes(item.status) && new Date(item.updatedAt).getTime() < f.now.getTime() - 7 * 86400000);
  expect(dashboard.dueSoonOrOverdue).toEqual([...overdue, ...dueSoon].sort((left, right) =>
    left.dueDate!.localeCompare(right.dueDate!) || right.updatedAt.localeCompare(left.updatedAt)).slice(0, 8));
  for (const [key, expected] of [['overdue', overdue.length], ['due_soon', dueSoon.length], ['stale_assigned', stale.length]] as const) {
    expect(dashboard.summaryCounts.find(count => count.key === key)?.count).toBe(expected);
  }
  expect(dashboard.summaryCounts.find(count => count.key === 'assigned_open')?.count).toBe(assigned.length);
  expect(dashboard.summaryCounts.find(count => count.key === 'blocked')?.count).toBe(blocked.length);
  expect(dashboard.summaryCounts.find(count => count.key === 'reported_open')?.count).toBe(reported.length);
  expect(assigned.length).toBeGreaterThan(8);
});

it('preserves complete scope and exact counts while enriching only five-row risks and eight-row movement', async () => {
  const f = await fixture(), projectId = f.projects[0]!.id;
  const clock = vi.fn(() => f.now);
  const planning = await new PlanningService({ ...f, clock }).getProjectPlanningSummary(projectId);
  expect(clock).toHaveBeenCalledOnce();
  expect(planning.deliveryHealth.openWorkCount).toBe(36);
  expect(planning.deliveryHealth.blockedWorkCount).toBe(12);
  expect(planning.blockedWork).toHaveLength(5);
  expect(planning.blockedWork.map(item => item.displayKey)).toEqual(['AG0-3', 'AG0-8', 'AG0-13', 'AG0-18', 'AG0-23']);
  const milestone = await new MilestoneReviewService(f).getMilestoneReview(projectId, f.milestones[0]!.id);
  expect(milestone.progress.totalCount).toBe(60);
  expect(milestone.progress.blockedCount).toBe(12);
  expect(milestone.riskSections.find(section => section.type === 'blocked')).toMatchObject({ count: 12, countUnit: 'work_items' });
  expect(milestone.riskSections.every(section => section.items.length <= 5)).toBe(true);
  expect(milestone.recentlyChangedWork).toHaveLength(8);
  const cycle = await new ProjectCycleService(f).getCycleReview(projectId, f.cycles[0]!.id);
  expect(cycle.progress.totalCount).toBe(20);
  expect(cycle.progress).toEqual(planning.activeCycle?.progress);
  expect(cycle.health).toEqual(planning.activeCycle?.health);
  expect(cycle.riskSections.every(section => section.items.length <= 5)).toBe(true);
  expect(cycle.recentlyChangedWork).toHaveLength(8);
  expect(cycle.scopeBreakdown.statusCounts.ready).toBe(4);
  for (const item of [...milestone.recentlyChangedWork, ...cycle.recentlyChangedWork]) {
    expect(item.milestone?.id).toBe(f.milestones[0]!.id);
    if (item.displayKey !== 'AG0-1') expect(item.parent?.displayKey).toBe('AG0-1');
  }
});

it.each(['my-work', 'portfolio', 'planning', 'milestone', 'cycle'] as const)('keeps %s evaluation and enrichment in one snapshot without root repository escapes', async name => {
  const f = await fixture(), projectId = f.projects[0]!.id;
  const read = (context: typeof f) => {
    switch (name) {
      case 'my-work': return new MyWorkService(context).getDashboard();
      case 'portfolio': return new PortfolioService(context).getPortfolio();
      case 'planning': return new PlanningService(context).getProjectPlanningSummary(projectId);
      case 'milestone': return new MilestoneReviewService(context).getMilestoneReview(projectId, f.milestones[0]!.id);
      case 'cycle': return new ProjectCycleService(context).getCycleReview(projectId, f.cycles[0]!.id);
    }
  };
  const before = await read(f);
  let calls = 0;
  const persistence: Persistence = { write: f.persistence.write, readConsistent: callback => f.persistence.readConsistent(async scope => {
    calls++;
    await scope.repositories.workItems.countByProjectQuery(projectId);
    await f.persistence.write(async ({ repositories }) => {
      for (const member of f.members) await repositories.members.update(member.id, { name: 'Changed member', updatedAt: new Date() });
      await repositories.milestones.update(f.milestones[0]!.id, { name: 'Changed milestone', updatedAt: new Date() });
      await repositories.workItems.update(f.work[0]!.id, { title: 'Changed parent', status: 'done', updatedAt: new Date() });
    });
    return callback(scope);
  }) };
  const forbiddenRoot = new Proxy({} as Repositories, { get() { throw new Error('Root repository escape'); } });
  expect(await read({ ...f, persistence, repositories: forbiddenRoot })).toEqual(before);
  expect(calls).toBe(1);
  expect(JSON.stringify(await read(f))).not.toBe(JSON.stringify(before));
});

it('selects one latest report per project with stable ties, ignores older malformed snapshots and excludes narratives', async () => {
  const f = await fixture(), projectId = f.projects[0]!.id;
  const latest = await f.repositories.projectStatusReports.findLatestByProject(projectId);
  const lowId = '00000000-0000-4000-8000-000000000001';
  const highId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
  await f.repositories.projectStatusReports.create({ ...latest!, id: lowId });
  await f.repositories.projectStatusReports.create({ ...latest!, id: highId });
  await db.execute(sql`insert into project_status_reports
    (id, workspace_id, project_id, author_member_id, title, status_date, summary, snapshot, published_at, created_at)
    values (${randomUUID()}, ${f.workspaceId}, ${projectId}, ${f.actor.memberId}, 'Old invalid', '2026-01-01', 'Never selected',
      '{"snapshotVersion":999}'::jsonb, '2026-01-01', '2026-01-01')`);
  const selected = await f.repositories.projectStatusReports.listLatestByProjects([projectId]);
  expect(selected).toHaveLength(1);
  expect(selected[0]?.id).toBe(highId);
  expect(selected[0]).not.toHaveProperty('summary');
  expect((await f.repositories.projectStatusReports.findLatestByProject(projectId))?.id).toBe(highId);
  const portfolio = await new PortfolioService(f).getPortfolio();
  expect(portfolio.projects[0]?.report.latestReport?.id).toBe(highId);
  await db.update(schema.projectStatusReports).set({ snapshot: { ...latest!.snapshot, project: { ...latest!.snapshot.project, id: randomUUID() } } })
    .where(eq(schema.projectStatusReports.id, highId));
  await expect(new PortfolioService(f).getPortfolio()).rejects.toMatchObject({ code: 'CONFLICT' });
});

it('does not truncate boards or immutable closeout evidence to aggregate preview bounds', async () => {
  const f = await fixture(), projectId = f.projects[0]!.id, cycleId = f.cycles[0]!.id;
  const board = await new WorkItemQueryService(f).listProjectBoardWorkItems(projectId);
  expect(board).toHaveLength(60);
  const closed = await new ProjectCycleCloseoutService(f).close(projectId, cycleId, { destinationCycleId: null });
  expect(closed.closeout.snapshot.counts.totalCount).toBe(20);
  expect(Object.values(closed.closeout.snapshot.items).flat()).toHaveLength(20);
  const review = await new ProjectCycleService(f).getCycleReview(projectId, cycleId);
  expect(review.closeout?.snapshot).toEqual(closed.closeout.snapshot);
  const replay = await new ProjectCycleCloseoutService(f).close(projectId, cycleId, { destinationCycleId: null });
  expect(replay.applied).toBe(false);
  expect(replay.closeout.snapshot).toEqual(closed.closeout.snapshot);
});
