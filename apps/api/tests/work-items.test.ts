import { randomUUID } from 'node:crypto';

import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { createExpressApp } from '../src/adapters/express/server.js';
import { createDb, createPool } from '../src/db/client.js';
import { createRepositories, type Repositories } from '../src/repositories/index.js';
import { WorkItemService } from '../src/services/work-item-service.js';

const workspaceIds = new Set<string>();
let pool: ReturnType<typeof createPool>;
let db: ReturnType<typeof createDb>;
let repositories: Repositories;
let app: ReturnType<typeof createExpressApp>;

function now() {
  return new Date('2026-07-03T12:00:00.000Z');
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
  await pool.query('update work_items set parent_work_item_id = null where workspace_id = $1', [
    workspaceId
  ]);
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
  const maintainerId = randomUUID();
  const contributorId = randomUUID();
  const inactiveMemberId = randomUUID();
  const projectId = randomUUID();
  const frontendLabelId = randomUUID();
  const backendLabelId = randomUUID();
  workspaceIds.add(workspaceId);

  await repositories.workspaces.create({
    id: workspaceId,
    name: 'Work Item Test Workspace',
    createdAt: timestamp,
    updatedAt: timestamp
  });

  for (const member of [
    { id: actorId, role, name: 'API Actor' },
    { id: maintainerId, role: 'maintainer' as const, name: 'API Maintainer' },
    { id: contributorId, role: 'contributor' as const, name: 'API Contributor' }
  ]) {
    await repositories.members.create({
      id: member.id,
      workspaceId,
      name: member.name,
      email: `${member.id}@example.com`,
      role: member.role,
      isActive: true,
      createdAt: timestamp,
      updatedAt: timestamp
    });
  }

  await repositories.members.create({
    id: inactiveMemberId,
    workspaceId,
    name: 'API Inactive Contributor',
    email: `${inactiveMemberId}@example.com`,
    role: 'contributor',
    isActive: false,
    deactivatedAt: new Date('2026-06-28T12:00:00.000Z'),
    deactivatedById: actorId,
    createdAt: timestamp,
    updatedAt: timestamp
  });

  await repositories.projects.create({
    id: projectId,
    workspaceId,
    key: 'WI',
    nextWorkItemNumber: 2,
    name: 'Work Item Test Project',
    description: 'Project for work item endpoint tests.',
    status: 'active',
    createdAt: timestamp,
    updatedAt: timestamp
  });

  await repositories.labels.create({
    id: frontendLabelId,
    workspaceId,
    projectId,
    name: 'frontend',
    color: '#2563eb',
    createdAt: timestamp,
    updatedAt: timestamp
  });
  await repositories.labels.create({
    id: backendLabelId,
    workspaceId,
    projectId,
    name: 'backend',
    color: '#059669',
    createdAt: timestamp,
    updatedAt: timestamp
  });

  return {
    workspaceId,
    actorId,
    maintainerId,
    contributorId,
    inactiveMemberId,
    projectId,
    frontendLabelId,
    backendLabelId,
    nextFixtureWorkItemNumber: 1,
    headers: actorHeaders({ workspaceId, memberId: actorId, role })
  };
}

async function createWorkItem(fixture: Awaited<ReturnType<typeof createFixture>>, overrides = {}) {
  const itemNumber = fixture.nextFixtureWorkItemNumber++;

  return repositories.workItems.create({
    id: randomUUID(),
    workspaceId: fixture.workspaceId,
    projectId: fixture.projectId,
    itemNumber,
    displayKey: `WI-${itemNumber}`,
    title: 'Existing work item',
    description: 'Existing description.',
    type: 'task',
    status: 'ready',
    priority: 'medium',
    assigneeId: fixture.contributorId,
    reporterId: fixture.actorId,
    dueDate: null,
    estimatePoints: null,
    createdAt: now(),
    updatedAt: now(),
    ...overrides
  });
}

async function createMilestone(
  fixture: Awaited<ReturnType<typeof createFixture>>,
  overrides: Partial<Parameters<typeof repositories.milestones.create>[0]> = {}
) {
  return repositories.milestones.create({
    id: randomUUID(),
    workspaceId: fixture.workspaceId,
    projectId: fixture.projectId,
    name: 'v0.0.3',
    description: 'Planning milestone.',
    status: 'active',
    targetDate: '2026-07-18',
    archivedAt: null,
    archivedById: null,
    createdAt: now(),
    updatedAt: now(),
    ...overrides
  });
}

async function createProjectCycle(
  fixture: Awaited<ReturnType<typeof createFixture>>,
  overrides: Partial<Parameters<typeof repositories.projectCycles.create>[0]> = {}
) {
  return repositories.projectCycles.create({
    id: randomUUID(),
    workspaceId: fixture.workspaceId,
    projectId: fixture.projectId,
    name: 'Cycle 1',
    goal: 'Complete the next reference workflow.',
    status: 'active',
    startDate: '2026-07-01',
    endDate: '2026-07-12',
    targetPoints: 24,
    archivedAt: null,
    archivedById: null,
    createdAt: now(),
    updatedAt: now(),
    ...overrides
  });
}

async function createProject(
  fixture: Awaited<ReturnType<typeof createFixture>>,
  overrides: Partial<Parameters<typeof repositories.projects.create>[0]> = {}
) {
  return repositories.projects.create({
    id: randomUUID(),
    workspaceId: fixture.workspaceId,
    key: 'OPS',
    nextWorkItemNumber: 1,
    name: 'Operations',
    description: 'Additional project for workspace query tests.',
    status: 'active',
    createdAt: now(),
    updatedAt: now(),
    ...overrides
  });
}

function createService(
  fixture: Awaited<ReturnType<typeof createFixture>>,
  overrides: Partial<ConstructorParameters<typeof WorkItemService>[0]> = {}
) {
  return new WorkItemService({
    actor: {
      workspaceId: fixture.workspaceId,
      memberId: fixture.actorId,
      role: 'owner'
    },
    repositories,
    db,
    ...overrides
  });
}

beforeAll(() => {
  pool = createPool();
  db = createDb(pool);
  repositories = createRepositories(db);
  app = createExpressApp({ repositories, db });
});

afterEach(async () => {
  vi.restoreAllMocks();
  await cleanupAllWorkspaces();
});

afterAll(async () => {
  await cleanupAllWorkspaces();
  await pool.end();
});

describe('work item API', () => {
  it('returns default, explicit, partial, stale, and empty project pages in one read transaction', async () => {
    const fixture = await createFixture('owner');
    await Promise.all(
      Array.from({ length: 27 }, (_, index) =>
        createWorkItem(fixture, {
          title: `Paged work item ${index + 1}`,
          boardPosition: (index + 1) * 1024
        })
      )
    );
    const transactionSpy = vi.spyOn(db, 'transaction');
    const service = createService(fixture);

    const firstPage = await service.listWorkItemPage(fixture.projectId);
    const secondPage = await service.listWorkItemPage(
      fixture.projectId,
      { sort: 'updated_asc' },
      { page: 2, pageSize: 10 }
    );
    const stalePage = await service.listWorkItemPage(
      fixture.projectId,
      { sort: 'updated_asc' },
      { page: 99, pageSize: 10 }
    );
    const emptyPage = await service.listWorkItemPage(
      fixture.projectId,
      { status: 'done' },
      { page: 99, pageSize: 25 }
    );

    expect(firstPage).toMatchObject({
      page: 1,
      pageSize: 25,
      totalCount: 27,
      totalPages: 2,
      hasPreviousPage: false,
      hasNextPage: true
    });
    expect(firstPage.items).toHaveLength(25);
    expect(secondPage).toMatchObject({
      page: 2,
      pageSize: 10,
      totalCount: 27,
      totalPages: 3,
      hasPreviousPage: true,
      hasNextPage: true
    });
    expect(secondPage.items.map(({ itemNumber }) => itemNumber)).toEqual(
      Array.from({ length: 10 }, (_, index) => index + 11)
    );
    expect(stalePage).toMatchObject({
      page: 3,
      pageSize: 10,
      totalCount: 27,
      totalPages: 3,
      hasPreviousPage: true,
      hasNextPage: false
    });
    expect(stalePage.items.map(({ itemNumber }) => itemNumber)).toEqual([21, 22, 23, 24, 25, 26, 27]);
    expect(emptyPage).toEqual({
      items: [],
      page: 1,
      pageSize: 25,
      totalCount: 0,
      totalPages: 0,
      hasPreviousPage: false,
      hasNextPage: false
    });
    expect(transactionSpy).toHaveBeenCalledTimes(4);
    expect(transactionSpy.mock.calls.every((call) =>
      expect.objectContaining({
        isolationLevel: 'repeatable read',
        accessMode: 'read only'
      }).asymmetricMatch(call[1])
    )).toBe(true);
  });

  it('uses repository-only paging and enriches only returned page ids', async () => {
    const fixture = await createFixture('owner');
    await Promise.all(
      Array.from({ length: 16 }, (_, index) =>
        createWorkItem(fixture, { title: `Fallback page item ${index + 1}` })
      )
    );
    const listPageSpy = vi.spyOn(repositories.workItems, 'listPageByProject');
    const labelSpy = vi.spyOn(repositories.labels, 'listByWorkItems');
    const dependencySpy = vi.spyOn(repositories.workItemRelationships, 'listDependencyCounts');
    const parentSpy = vi.spyOn(repositories.workItems, 'listParentsForChildren');
    const childSummarySpy = vi.spyOn(repositories.workItems, 'summarizeChildren');
    const service = createService(fixture, { db: undefined });

    const page = await service.listWorkItemPage(
      fixture.projectId,
      { sort: 'updated_asc' },
      { page: 2, pageSize: 10 }
    );
    const pageIds = page.items.map(({ id }) => id);

    expect(page.items.map(({ itemNumber }) => itemNumber)).toEqual([11, 12, 13, 14, 15, 16]);
    expect(listPageSpy).toHaveBeenCalledWith(
      fixture.projectId,
      { sort: 'updated_asc' },
      { limit: 10, offset: 10 }
    );
    expect(labelSpy).toHaveBeenCalledWith(pageIds);
    expect(dependencySpy).toHaveBeenCalledWith(pageIds);
    expect(parentSpy).toHaveBeenCalledWith(pageIds);
    expect(childSummarySpy).toHaveBeenCalledWith(pageIds);
  });

  it('authorizes project scope before exposing page counts', async () => {
    const fixture = await createFixture('owner');
    await createWorkItem(fixture);
    const countSpy = vi.spyOn(repositories.workItems, 'countByProjectQuery');
    const service = new WorkItemService({
      actor: {
        workspaceId: randomUUID(),
        memberId: randomUUID(),
        role: 'owner'
      },
      repositories
    });

    await expect(service.listWorkItemPage(fixture.projectId)).rejects.toMatchObject({
      code: 'NOT_FOUND'
    });
    expect(countSpy).not.toHaveBeenCalled();
  });

  it('returns workspace page context across active and archived projects', async () => {
    const fixture = await createFixture('owner');
    const milestone = await createMilestone(fixture);
    const cycle = await createProjectCycle(fixture);
    const parent = await createWorkItem(fixture, {
      title: 'Workspace rich parent',
      milestoneId: milestone.id,
      cycleId: cycle.id
    });
    await repositories.labels.replaceForWorkItem(parent.id, [fixture.backendLabelId]);
    const child = await createWorkItem(fixture, {
      title: 'Workspace rich child',
      parentWorkItemId: parent.id
    });
    const blocker = await createWorkItem(fixture, {
      title: 'Workspace blocker',
      status: 'in_progress'
    });
    await repositories.workItemRelationships.create({
      id: randomUUID(),
      workspaceId: fixture.workspaceId,
      relationshipType: 'blocks',
      sourceWorkItemId: blocker.id,
      targetWorkItemId: child.id,
      createdById: fixture.actorId,
      createdAt: now()
    });
    const archivedProject = await createProject(fixture, {
      key: 'ARC',
      status: 'archived'
    });
    const archived = await createWorkItem(fixture, {
      projectId: archivedProject.id,
      itemNumber: 1,
      displayKey: 'ARC-1',
      title: 'Workspace archived item'
    });
    const otherWorkspace = await createFixture('owner');
    await createWorkItem(otherWorkspace, { title: 'Hidden workspace item' });

    const page = await createService(fixture).listWorkspaceWorkItemPage(
      { archivedProjects: 'include', sort: 'updated_asc' },
      { page: 1, pageSize: 10 }
    );

    expect(page).toMatchObject({
      page: 1,
      pageSize: 10,
      totalCount: 4,
      totalPages: 1,
      hasPreviousPage: false,
      hasNextPage: false
    });
    expect(page.items.find(({ id }) => id === parent.id)).toMatchObject({
      labels: [{ id: fixture.backendLabelId }],
      milestone: { id: milestone.id },
      cycle: { id: cycle.id },
      childSummary: { totalCount: 1 },
      project: { id: fixture.projectId, status: 'active' }
    });
    expect(page.items.find(({ id }) => id === child.id)).toMatchObject({
      parent: { id: parent.id },
      dependencyBlocked: true,
      openBlockerCount: 1
    });
    expect(page.items.find(({ id }) => id === archived.id)).toMatchObject({
      project: { id: archivedProject.id, status: 'archived' }
    });
  });

  it('returns complete fixed-order project boards beyond the interactive page maximum', async () => {
    const fixture = await createFixture('owner');
    await Promise.all(
      Array.from({ length: 101 }, (_, index) =>
        createWorkItem(fixture, {
          title: `Board service item ${index + 1}`,
          status: 'ready',
          boardPosition: (index + 1) * 1024
        })
      )
    );

    const items = await createService(fixture).listProjectBoardWorkItems(fixture.projectId);

    expect(items).toHaveLength(101);
    expect(items.map(({ itemNumber }) => itemNumber)).toEqual(
      Array.from({ length: 101 }, (_, index) => index + 1)
    );
  });

  it('creates work items with labels and records creation activity', async () => {
    const fixture = await createFixture('owner');

    const response = await request(app)
      .post(`/api/projects/${fixture.projectId}/work-items`)
      .set(fixture.headers)
      .send({
        title: 'Create API work item',
        description: 'Created through the work item API.',
        type: 'story',
        priority: 'high',
        assigneeId: fixture.contributorId,
        labelIds: [fixture.frontendLabelId],
        dueDate: '2026-07-12',
        estimatePoints: 5
      })
      .expect(201);

    expect(response.body).toMatchObject({
      projectId: fixture.projectId,
      itemNumber: 2,
      displayKey: 'WI-2',
      title: 'Create API work item',
      type: 'story',
      status: 'backlog',
      priority: 'high',
      assignee: { id: fixture.contributorId },
      reporter: { id: fixture.actorId },
      labels: [{ id: fixture.frontendLabelId, name: 'frontend' }],
      boardPosition: 1024,
      dueDate: '2026-07-12',
      estimatePoints: 5
    });

    const activity = await repositories.activityEvents.findByWorkItem(response.body.id);
    expect(activity).toHaveLength(1);
    expect(activity[0]?.eventType).toBe('work_item.created');
    await expect(repositories.workItemWatchers.listActiveMemberIdsByWorkItem(response.body.id)).resolves.toEqual(
      expect.arrayContaining([fixture.actorId, fixture.contributorId])
    );
    await expect(
      repositories.notifications.listByRecipient({
        workspaceId: fixture.workspaceId,
        recipientMemberId: fixture.contributorId,
        state: 'all'
      })
    ).resolves.toMatchObject([
      {
        notificationType: 'assignment',
        actorMemberId: fixture.actorId,
        workItemId: response.body.id,
        summary: 'WI-2 was assigned to you.'
      }
    ]);
    await expect(
      repositories.notifications.unreadCount({
        workspaceId: fixture.workspaceId,
        recipientMemberId: fixture.actorId
      })
    ).resolves.toBe(0);

    const secondResponse = await request(app)
      .post(`/api/projects/${fixture.projectId}/work-items`)
      .set(fixture.headers)
      .send({
        title: 'Create second API work item',
        type: 'task',
        priority: 'medium'
      })
      .expect(201);

    expect(secondResponse.body).toMatchObject({
      itemNumber: 3,
      displayKey: 'WI-3',
      title: 'Create second API work item',
      boardPosition: 0
    });

    const project = await repositories.projects.findById(fixture.projectId);
    expect(project?.nextWorkItemNumber).toBe(4);
  });

  it('keeps display keys stable after project metadata changes', async () => {
    const fixture = await createFixture('owner');
    const workItem = await createWorkItem(fixture);

    await request(app)
      .patch(`/api/projects/${fixture.projectId}`)
      .set(fixture.headers)
      .send({
        name: 'Renamed Work Item Test Project',
        description: 'Project metadata changed after work item creation.'
      })
      .expect(200);

    await request(app)
      .get(`/api/work-items/${workItem.id}`)
      .set(fixture.headers)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          itemNumber: 1,
          displayKey: 'WI-1'
        });
      });
  });

  it('enriches and filters two-level work hierarchy with bounded batch reads', async () => {
    const fixture = await createFixture('owner');
    const milestone = await createMilestone(fixture);
    const cycle = await createProjectCycle(fixture);
    const parent = await createWorkItem(fixture, {
      title: 'Release parent',
      priority: 'urgent',
      estimatePoints: 13
    });
    const openChild = await createWorkItem(fixture, {
      title: 'Blocked child implementation',
      status: 'blocked',
      priority: 'high',
      parentWorkItemId: parent.id,
      milestoneId: milestone.id,
      cycleId: cycle.id,
      estimatePoints: 3
    });
    const doneChild = await createWorkItem(fixture, {
      title: 'Completed child',
      status: 'done',
      parentWorkItemId: parent.id,
      estimatePoints: 5
    });
    const canceledChild = await createWorkItem(fixture, {
      title: 'Canceled child',
      status: 'canceled',
      parentWorkItemId: parent.id,
      estimatePoints: null
    });
    const unrelated = await createWorkItem(fixture, { title: 'Unrelated top-level work' });
    const blocker = await createWorkItem(fixture, { title: 'Open dependency blocker' });

    await repositories.workItemRelationships.create({
      id: randomUUID(),
      workspaceId: fixture.workspaceId,
      relationshipType: 'blocks',
      sourceWorkItemId: blocker.id,
      targetWorkItemId: openChild.id,
      createdById: fixture.actorId,
      createdAt: now()
    });

    const parentReads = vi.spyOn(repositories.workItems, 'listParentsForChildren');
    const summaryReads = vi.spyOn(repositories.workItems, 'summarizeChildren');
    const listResponse = await request(app)
      .get(`/api/projects/${fixture.projectId}/work-items`)
      .set(fixture.headers)
      .expect(200);

    expect(parentReads).toHaveBeenCalledTimes(1);
    expect(summaryReads).toHaveBeenCalledTimes(1);
    expect(listResponse.body.find((item: { id: string }) => item.id === parent.id)).toMatchObject({
      parent: null,
      childSummary: {
        totalCount: 3,
        openCount: 1,
        doneCount: 1,
        canceledCount: 1,
        estimatedCount: 2,
        unestimatedCount: 1,
        estimatePoints: 8
      }
    });
    expect(listResponse.body.find((item: { id: string }) => item.id === openChild.id)).toMatchObject({
      parent: {
        id: parent.id,
        projectId: fixture.projectId,
        displayKey: parent.displayKey,
        title: parent.title,
        type: parent.type,
        status: parent.status
      },
      childSummary: null
    });
    expect(listResponse.body.find((item: { id: string }) => item.id === unrelated.id)).toMatchObject({
      parent: null,
      childSummary: null
    });

    const topLevel = await request(app)
      .get(`/api/projects/${fixture.projectId}/work-items`)
      .query({ hierarchy: 'top_level' })
      .set(fixture.headers)
      .expect(200);
    expect(topLevel.body.map((item: { id: string }) => item.id)).toEqual(
      expect.arrayContaining([parent.id, unrelated.id, blocker.id])
    );
    expect(topLevel.body).toHaveLength(3);

    const children = await request(app)
      .get(`/api/projects/${fixture.projectId}/work-items`)
      .query({ hierarchy: 'children' })
      .set(fixture.headers)
      .expect(200);
    expect(children.body.map((item: { id: string }) => item.id)).toEqual(
      expect.arrayContaining([openChild.id, doneChild.id, canceledChild.id])
    );
    expect(children.body).toHaveLength(3);

    const parents = await request(app)
      .get(`/api/projects/${fixture.projectId}/work-items`)
      .query({ hierarchy: 'parents' })
      .set(fixture.headers)
      .expect(200);
    expect(parents.body.map((item: { id: string }) => item.id)).toEqual([parent.id]);

    const exactChildren = await request(app)
      .get(`/api/projects/${fixture.projectId}/work-items`)
      .query({ parentKey: parent.displayKey.toLowerCase() })
      .set(fixture.headers)
      .expect(200);
    expect(exactChildren.body).toHaveLength(3);

    await request(app)
      .get(`/api/projects/${fixture.projectId}/work-items`)
      .query({ parentKey: 'WI-999' })
      .set(fixture.headers)
      .expect(200)
      .expect([]);

    const composed = await request(app)
      .get(`/api/projects/${fixture.projectId}/work-items`)
      .query({
        parentKey: parent.displayKey,
        status: 'blocked',
        assigneeId: fixture.contributorId,
        milestoneId: milestone.id,
        cycleId: cycle.id,
        dependency: 'dependency_blocked',
        search: 'implementation',
        sort: 'priority_desc'
      })
      .set(fixture.headers)
      .expect(200);
    expect(composed.body.map((item: { id: string }) => item.id)).toEqual([openChild.id]);

    const workspaceChildren = await request(app)
      .get('/api/work-items')
      .query({
        projectId: fixture.projectId,
        parentKey: parent.displayKey,
        archivedProjects: 'include'
      })
      .set(fixture.headers)
      .expect(200);
    expect(workspaceChildren.body).toHaveLength(3);
    expect(workspaceChildren.body[0]).toMatchObject({
      project: { id: fixture.projectId },
      parent: { id: parent.id }
    });

    const archivedProject = await createProject(fixture, {
      key: 'ARC',
      status: 'archived'
    });
    const archivedParent = await repositories.workItems.create({
      id: randomUUID(),
      workspaceId: fixture.workspaceId,
      projectId: archivedProject.id,
      itemNumber: 1,
      displayKey: 'ARC-1',
      title: 'Archived parent',
      description: '',
      type: 'task',
      status: 'done',
      priority: 'medium',
      assigneeId: null,
      reporterId: fixture.actorId,
      parentWorkItemId: null,
      boardPosition: 1024,
      dueDate: null,
      estimatePoints: null,
      createdAt: now(),
      updatedAt: now()
    });
    const archivedChild = await repositories.workItems.create({
      id: randomUUID(),
      workspaceId: fixture.workspaceId,
      projectId: archivedProject.id,
      itemNumber: 2,
      displayKey: 'ARC-2',
      title: 'Archived child',
      description: '',
      type: 'task',
      status: 'done',
      priority: 'medium',
      assigneeId: null,
      reporterId: fixture.actorId,
      parentWorkItemId: archivedParent.id,
      boardPosition: 2048,
      dueDate: null,
      estimatePoints: null,
      createdAt: now(),
      updatedAt: now()
    });
    const archivedChildren = await request(app)
      .get('/api/work-items')
      .query({ archivedProjects: 'only', hierarchy: 'children' })
      .set(fixture.headers)
      .expect(200);
    expect(archivedChildren.body.map((item: { id: string }) => item.id)).toEqual([
      archivedChild.id
    ]);

    parentReads.mockClear();
    summaryReads.mockClear();
    await request(app)
      .get(`/api/work-items/${parent.id}`)
      .set(fixture.headers)
      .expect(200)
      .expect(({ body }) => {
        expect(body.childSummary).toMatchObject({ totalCount: 3, estimatePoints: 8 });
      });
    expect(parentReads).toHaveBeenCalledTimes(1);
    expect(summaryReads).toHaveBeenCalledTimes(1);

    await request(app)
      .get(`/api/work-items/${openChild.id}`)
      .set(fixture.headers)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          parent: { id: parent.id, displayKey: parent.displayKey },
          childSummary: null
        });
      });
  });

  it('creates child work atomically under open or terminal parents without hierarchy notifications', async () => {
    const fixture = await createFixture('owner');
    const terminalParent = await createWorkItem(fixture, {
      title: 'Terminal release parent',
      status: 'done'
    });
    const service = createService(fixture);

    const child = await service.createWorkItem(fixture.projectId, {
      title: 'First child',
      type: 'story',
      priority: 'high',
      assigneeId: fixture.contributorId,
      parentWorkItemId: terminalParent.id
    });
    expect(child).toMatchObject({
      parent: {
        id: terminalParent.id,
        displayKey: terminalParent.displayKey,
        title: terminalParent.title,
        status: 'done'
      },
      childSummary: null
    });
    await expect(repositories.workItems.findById(child.id)).resolves.toMatchObject({
      parentWorkItemId: terminalParent.id
    });

    const [createdActivity] = await repositories.activityEvents.findByWorkItem(child.id);
    expect(createdActivity).toMatchObject({
      eventType: 'work_item.created',
      newValue: {
        status: 'backlog',
        parent: {
          id: terminalParent.id,
          displayKey: terminalParent.displayKey,
          title: terminalParent.title
        }
      },
      metadata: {
        parent: {
          id: terminalParent.id,
          displayKey: terminalParent.displayKey,
          title: terminalParent.title
        }
      }
    });
    await expect(
      repositories.notifications.listByRecipient({
        workspaceId: fixture.workspaceId,
        recipientMemberId: fixture.contributorId,
        state: 'all'
      })
    ).resolves.toMatchObject([{ notificationType: 'assignment', workItemId: child.id }]);

    const secondChild = await service.createWorkItem(fixture.projectId, {
      title: 'Second child',
      type: 'task',
      priority: 'medium',
      parentWorkItemId: terminalParent.id
    });
    expect(secondChild.parent?.id).toBe(terminalParent.id);
    await expect(repositories.workItems.hasChildren(terminalParent.id)).resolves.toBe(true);
    await expect(repositories.activityEvents.findByWorkItem(terminalParent.id)).resolves.toEqual([]);
  });

  it('rejects invalid parents during child creation', async () => {
    const fixture = await createFixture('owner');
    const service = createService(fixture);
    const topLevel = await createWorkItem(fixture, { title: 'Top-level parent' });
    const child = await createWorkItem(fixture, {
      title: 'Existing child',
      parentWorkItemId: topLevel.id
    });
    const otherProject = await createProject(fixture, { key: 'ALT' });
    const crossProjectParent = await createWorkItem(fixture, {
      projectId: otherProject.id,
      itemNumber: 1,
      displayKey: 'ALT-1',
      title: 'Cross-project parent'
    });
    const otherWorkspace = await createFixture('owner');
    const crossWorkspaceParent = await createWorkItem(otherWorkspace, {
      title: 'Cross-workspace parent'
    });
    const input = {
      title: 'Rejected child',
      type: 'task' as const,
      priority: 'medium' as const
    };

    await expect(
      service.createWorkItem(fixture.projectId, { ...input, parentWorkItemId: randomUUID() })
    ).rejects.toMatchObject({ code: 'NOT_FOUND', message: 'Parent work item not found.' });
    await expect(
      service.createWorkItem(fixture.projectId, {
        ...input,
        parentWorkItemId: crossProjectParent.id
      })
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      message: 'Parent work must belong to the same project.'
    });
    await expect(
      service.createWorkItem(fixture.projectId, {
        ...input,
        parentWorkItemId: crossWorkspaceParent.id
      })
    ).rejects.toMatchObject({ code: 'NOT_FOUND', message: 'Parent work item not found.' });
    await expect(
      service.createWorkItem(fixture.projectId, { ...input, parentWorkItemId: child.id })
    ).rejects.toMatchObject({
      code: 'CONFLICT',
      message: 'A child work item cannot contain child work.'
    });
    await expect(
      createService(fixture, { idGenerator: () => topLevel.id }).createWorkItem(
        fixture.projectId,
        { ...input, parentWorkItemId: topLevel.id }
      )
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      message: 'A work item cannot be its own parent.'
    });

    await repositories.projects.updateStatus(fixture.projectId, 'archived', now());
    await expect(
      service.createWorkItem(fixture.projectId, { ...input, parentWorkItemId: topLevel.id })
    ).rejects.toMatchObject({ code: 'CONFLICT', message: 'Archived projects are read-only.' });
  });

  it('sets, replaces, clears, and idempotently replays parent commands with stable activity', async () => {
    const fixture = await createFixture('owner');
    const current = await createWorkItem(fixture, { title: 'Reparented work' });
    const firstParent = await createWorkItem(fixture, { title: 'First parent' });
    const secondParent = await createWorkItem(fixture, {
      title: 'Second parent',
      status: 'canceled'
    });
    const timestamp = new Date('2026-07-14T18:00:00.000Z');
    const service = createService(fixture, { clock: () => timestamp });

    await expect(
      service.setParent(current.id, { parentWorkItemId: firstParent.id })
    ).resolves.toMatchObject({ parent: { id: firstParent.id } });
    let events = await repositories.activityEvents.findByWorkItem(current.id);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      eventType: 'work_item.parent_changed',
      previousValue: { parent: null },
      newValue: {
        parent: {
          id: firstParent.id,
          displayKey: firstParent.displayKey,
          title: firstParent.title
        }
      },
      metadata: {}
    });

    const afterSet = await repositories.workItems.findById(current.id);
    await service.setParent(current.id, { parentWorkItemId: firstParent.id });
    expect((await repositories.workItems.findById(current.id))?.updatedAt).toEqual(
      afterSet?.updatedAt
    );
    expect(await repositories.activityEvents.findByWorkItem(current.id)).toHaveLength(1);

    await expect(
      service.setParent(current.id, { parentWorkItemId: secondParent.id })
    ).resolves.toMatchObject({ parent: { id: secondParent.id } });
    events = await repositories.activityEvents.findByWorkItem(current.id);
    expect(events).toHaveLength(2);
    expect(events).toContainEqual(
      expect.objectContaining({
        previousValue: {
          parent: {
            id: firstParent.id,
            displayKey: firstParent.displayKey,
            title: firstParent.title
          }
        },
        newValue: {
          parent: {
            id: secondParent.id,
            displayKey: secondParent.displayKey,
            title: secondParent.title
          }
        }
      })
    );

    await expect(
      service.setParent(current.id, { parentWorkItemId: null })
    ).resolves.toMatchObject({ parent: null });
    events = await repositories.activityEvents.findByWorkItem(current.id);
    expect(events).toHaveLength(3);
    expect(events).toContainEqual(
      expect.objectContaining({
        previousValue: {
          parent: {
            id: secondParent.id,
            displayKey: secondParent.displayKey,
            title: secondParent.title
          }
        },
        newValue: { parent: null }
      })
    );
    await service.setParent(current.id, { parentWorkItemId: null });
    expect(await repositories.activityEvents.findByWorkItem(current.id)).toHaveLength(3);

    const notifications = await pool.query<{ count: string }>(
      'select count(*)::text as count from notifications where workspace_id = $1',
      [fixture.workspaceId]
    );
    expect(notifications.rows[0]?.count).toBe('0');
  });

  it('rejects invalid, deep, and archived reparenting commands', async () => {
    const fixture = await createFixture('owner');
    const service = createService(fixture);
    const current = await createWorkItem(fixture, { title: 'Current item' });
    const topLevel = await createWorkItem(fixture, { title: 'Valid top-level item' });
    const proposedChild = await createWorkItem(fixture, {
      title: 'Proposed child parent',
      parentWorkItemId: topLevel.id
    });
    const container = await createWorkItem(fixture, { title: 'Container item' });
    await createWorkItem(fixture, { title: 'Container child', parentWorkItemId: container.id });
    const otherProject = await createProject(fixture, { key: 'EXT' });
    const crossProject = await createWorkItem(fixture, {
      projectId: otherProject.id,
      itemNumber: 1,
      displayKey: 'EXT-1',
      title: 'Cross-project item'
    });
    const otherWorkspace = await createFixture('owner');
    const crossWorkspace = await createWorkItem(otherWorkspace, { title: 'Cross-workspace item' });

    await expect(service.setParent(current.id, { parentWorkItemId: current.id })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      message: 'A work item cannot be its own parent.'
    });
    await expect(service.setParent(current.id, { parentWorkItemId: randomUUID() })).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: 'Parent work item not found.'
    });
    await expect(service.setParent(current.id, { parentWorkItemId: crossProject.id })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      message: 'Parent work must belong to the same project.'
    });
    await expect(service.setParent(current.id, { parentWorkItemId: crossWorkspace.id })).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: 'Parent work item not found.'
    });
    await expect(service.setParent(crossWorkspace.id, { parentWorkItemId: topLevel.id })).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: 'Work item not found.'
    });
    await expect(service.setParent(current.id, { parentWorkItemId: proposedChild.id })).rejects.toMatchObject({
      code: 'CONFLICT',
      message: 'A child work item cannot contain child work.'
    });
    await expect(service.setParent(container.id, { parentWorkItemId: topLevel.id })).rejects.toMatchObject({
      code: 'CONFLICT',
      message: 'Work with children cannot be assigned a parent.'
    });

    await repositories.projects.updateStatus(fixture.projectId, 'archived', now());
    await expect(service.setParent(current.id, { parentWorkItemId: topLevel.id })).rejects.toMatchObject({
      code: 'CONFLICT',
      message: 'Archived projects are read-only.'
    });
  });

  it('rolls back a parent update when activity persistence fails', async () => {
    const fixture = await createFixture('owner');
    const current = await createWorkItem(fixture, { title: 'Rollback current' });
    const parent = await createWorkItem(fixture, { title: 'Rollback parent' });
    const duplicateActivityId = randomUUID();
    await repositories.activityEvents.create({
      id: duplicateActivityId,
      workspaceId: fixture.workspaceId,
      projectId: fixture.projectId,
      workItemId: current.id,
      actorId: fixture.actorId,
      eventType: 'work_item.created',
      summary: 'Existing activity.',
      previousValue: null,
      newValue: { status: current.status },
      metadata: {},
      createdAt: now()
    });
    const service = createService(fixture, { idGenerator: () => duplicateActivityId });

    await expect(
      service.setParent(current.id, { parentWorkItemId: parent.id })
    ).rejects.toMatchObject({ cause: { code: '23505' } });
    await expect(repositories.workItems.findById(current.id)).resolves.toMatchObject({
      parentWorkItemId: null
    });
    await expect(repositories.activityEvents.findByWorkItem(current.id)).resolves.toHaveLength(1);
  });

  it('serializes inverse concurrent parent assignments without creating a cycle', async () => {
    const fixture = await createFixture('owner');
    const first = await createWorkItem(fixture, { title: 'Concurrent first' });
    const second = await createWorkItem(fixture, { title: 'Concurrent second' });
    const service = createService(fixture);

    const results = await Promise.allSettled([
      service.setParent(first.id, { parentWorkItemId: second.id }),
      service.setParent(second.id, { parentWorkItemId: first.id })
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(results.find((result) => result.status === 'rejected')).toMatchObject({
      reason: { code: 'CONFLICT' }
    });

    const [storedFirst, storedSecond] = await Promise.all([
      repositories.workItems.findById(first.id),
      repositories.workItems.findById(second.id)
    ]);
    expect(
      storedFirst?.parentWorkItemId === second.id && storedSecond?.parentWorkItemId === null ||
      storedSecond?.parentWorkItemId === first.id && storedFirst?.parentWorkItemId === null
    ).toBe(true);
  });

  it('serializes child creation against assigning its proposed parent beneath other work', async () => {
    const fixture = await createFixture('owner');
    const proposedParent = await createWorkItem(fixture, { title: 'Contended parent' });
    const otherParent = await createWorkItem(fixture, { title: 'Other parent' });
    const service = createService(fixture);

    const results = await Promise.allSettled([
      service.createWorkItem(fixture.projectId, {
        title: 'Concurrent child',
        type: 'task',
        priority: 'medium',
        parentWorkItemId: proposedParent.id
      }),
      service.setParent(proposedParent.id, { parentWorkItemId: otherParent.id })
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(results.find((result) => result.status === 'rejected')).toMatchObject({
      reason: { code: 'CONFLICT' }
    });

    const storedParent = await repositories.workItems.findById(proposedParent.id);
    const hasChildren = await repositories.workItems.hasChildren(proposedParent.id);
    expect(
      storedParent?.parentWorkItemId === otherParent.id && !hasChildren ||
      storedParent?.parentWorkItemId === null && hasChildren
    ).toBe(true);
  });

  it('creates, sets, replays, and clears hierarchy through the API', async () => {
    const fixture = await createFixture('owner');
    const parent = await createWorkItem(fixture, { title: 'HTTP parent' });

    const created = await request(app)
      .post(`/api/projects/${fixture.projectId}/work-items`)
      .set(fixture.headers)
      .send({
        title: 'HTTP child',
        type: 'task',
        priority: 'medium',
        parentWorkItemId: parent.id
      })
      .expect(201);
    expect(created.body.parent).toMatchObject({ id: parent.id, displayKey: parent.displayKey });
    fixture.nextFixtureWorkItemNumber += 1;

    const topLevel = await createWorkItem(fixture, { title: 'HTTP reparented item' });
    await request(app)
      .put(`/api/work-items/${topLevel.id}/parent`)
      .set(fixture.headers)
      .send({ parentWorkItemId: parent.id })
      .expect(200)
      .expect(({ body }) => {
        expect(body.parent).toMatchObject({ id: parent.id });
      });

    const afterSet = await repositories.workItems.findById(topLevel.id);
    await request(app)
      .put(`/api/work-items/${topLevel.id}/parent`)
      .set(fixture.headers)
      .send({ parentWorkItemId: parent.id })
      .expect(200);
    expect((await repositories.workItems.findById(topLevel.id))?.updatedAt).toEqual(
      afterSet?.updatedAt
    );
    expect(await repositories.activityEvents.findByWorkItem(topLevel.id)).toHaveLength(1);

    await request(app)
      .put(`/api/work-items/${topLevel.id}/parent`)
      .set(fixture.headers)
      .send({ parentWorkItemId: null })
      .expect(200)
      .expect(({ body }) => {
        expect(body.parent).toBeNull();
      });
  });

  it('lists bounded children and eligible parent candidates through the API', async () => {
    const fixture = await createFixture('owner');
    const parent = await createWorkItem(fixture, { title: 'Children endpoint parent' });
    const high = await createWorkItem(fixture, {
      title: 'High child',
      priority: 'high',
      parentWorkItemId: parent.id
    });
    const medium = await createWorkItem(fixture, {
      title: 'Medium child',
      priority: 'medium',
      parentWorkItemId: parent.id
    });
    await createWorkItem(fixture, {
      title: 'Done child',
      status: 'done',
      priority: 'urgent',
      parentWorkItemId: parent.id
    });

    await request(app)
      .get(`/api/work-items/${parent.id}/children`)
      .query({ limit: 2 })
      .set(fixture.headers)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({ totalCount: 3, hasMore: true });
        expect(body.items.map((item: { id: string }) => item.id)).toEqual([high.id, medium.id]);
        expect(body.items[0]).toMatchObject({
          parent: { id: parent.id },
          childSummary: null
        });
      });

    await request(app)
      .get(`/api/work-items/${high.id}/children`)
      .set(fixture.headers)
      .expect(200)
      .expect({ items: [], totalCount: 0, hasMore: false });

    const current = await createWorkItem(fixture, { title: 'Candidate target' });
    const matching = await createWorkItem(fixture, {
      title: 'Candidate alpha',
      status: 'in_progress',
      priority: 'high'
    });
    const populated = await createWorkItem(fixture, { title: 'Candidate populated' });
    await createWorkItem(fixture, {
      title: 'Candidate nested',
      parentWorkItemId: populated.id
    });
    const otherProject = await createProject(fixture, { key: 'CAN' });
    await createWorkItem(fixture, {
      projectId: otherProject.id,
      itemNumber: 1,
      displayKey: 'CAN-1',
      title: 'Candidate other project'
    });

    await request(app)
      .get(`/api/work-items/${current.id}/parent-candidates`)
      .query({ search: '  Candidate  ' })
      .set(fixture.headers)
      .expect(200)
      .expect(({ body }) => {
        const ids = body.map((item: { id: string }) => item.id);
        expect(ids).toContain(matching.id);
        expect(ids).toContain(populated.id);
        expect(ids).not.toContain(current.id);
        expect(ids).not.toContain(high.id);
        expect(body).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id: matching.id,
              priority: 'high',
              updatedAt: expect.any(String)
            })
          ])
        );
      });

    await request(app)
      .get(`/api/work-items/${parent.id}/parent-candidates`)
      .set(fixture.headers)
      .expect(200)
      .expect([]);
  });

  it('rejects malformed hierarchy endpoint requests', async () => {
    const fixture = await createFixture('owner');
    const workItem = await createWorkItem(fixture);

    await request(app)
      .post(`/api/projects/${fixture.projectId}/work-items`)
      .set(fixture.headers)
      .send({
        title: 'Malformed parent',
        type: 'task',
        priority: 'medium',
        parentWorkItemId: 'not-a-uuid'
      })
      .expect(400);

    for (const body of [
      {},
      { parentWorkItemId: 'not-a-uuid' },
      { parentWorkItemId: null, unexpected: true }
    ]) {
      await request(app)
        .put(`/api/work-items/${workItem.id}/parent`)
        .set(fixture.headers)
        .send(body)
        .expect(400);
    }

    for (const limit of ['0', '101', '1.5', 'many']) {
      await request(app)
        .get(`/api/work-items/${workItem.id}/children`)
        .query({ limit })
        .set(fixture.headers)
        .expect(400);
    }

    await request(app)
      .get(`/api/work-items/${workItem.id}/parent-candidates`)
      .query({ search: 'x'.repeat(121) })
      .set(fixture.headers)
      .expect(400);
    await request(app).get('/api/work-items/not-a-uuid/children').set(fixture.headers).expect(400);
  });

  it('maps hierarchy domain errors and preserves workspace isolation through the API', async () => {
    const fixture = await createFixture('owner');
    const current = await createWorkItem(fixture, { title: 'Hierarchy error target' });
    const parent = await createWorkItem(fixture, { title: 'Hierarchy error parent' });
    const child = await createWorkItem(fixture, {
      title: 'Hierarchy error child',
      parentWorkItemId: parent.id
    });
    const otherProject = await createProject(fixture, { key: 'ERR' });
    const crossProject = await createWorkItem(fixture, {
      projectId: otherProject.id,
      itemNumber: 1,
      displayKey: 'ERR-1',
      title: 'Cross-project hierarchy item'
    });
    const otherWorkspace = await createFixture('owner');
    const hidden = await createWorkItem(otherWorkspace, { title: 'Hidden hierarchy item' });

    await request(app)
      .put(`/api/work-items/${current.id}/parent`)
      .set(fixture.headers)
      .send({ parentWorkItemId: current.id })
      .expect(400)
      .expect(({ body }) => {
        expect(body.error).toMatchObject({
          code: 'VALIDATION_ERROR',
          message: 'A work item cannot be its own parent.'
        });
      });
    await request(app)
      .put(`/api/work-items/${current.id}/parent`)
      .set(fixture.headers)
      .send({ parentWorkItemId: randomUUID() })
      .expect(404)
      .expect(({ body }) => {
        expect(body.error.code).toBe('NOT_FOUND');
      });
    await request(app)
      .put(`/api/work-items/${current.id}/parent`)
      .set(fixture.headers)
      .send({ parentWorkItemId: crossProject.id })
      .expect(400)
      .expect(({ body }) => {
        expect(body.error).toMatchObject({
          code: 'VALIDATION_ERROR',
          message: 'Parent work must belong to the same project.'
        });
      });
    await request(app)
      .put(`/api/work-items/${current.id}/parent`)
      .set(fixture.headers)
      .send({ parentWorkItemId: child.id })
      .expect(409)
      .expect(({ body }) => {
        expect(body.error).toMatchObject({
          code: 'CONFLICT',
          message: 'A child work item cannot contain child work.'
        });
      });

    await request(app)
      .get(`/api/work-items/${hidden.id}/children`)
      .set(fixture.headers)
      .expect(404);
    await request(app)
      .get(`/api/work-items/${hidden.id}/parent-candidates`)
      .set(fixture.headers)
      .expect(404);
    await request(app)
      .put(`/api/work-items/${hidden.id}/parent`)
      .set(fixture.headers)
      .send({ parentWorkItemId: null })
      .expect(404);

    await repositories.projects.updateStatus(fixture.projectId, 'archived', now());
    await request(app)
      .get(`/api/work-items/${current.id}/parent-candidates`)
      .set(fixture.headers)
      .expect(200);
    await request(app)
      .put(`/api/work-items/${current.id}/parent`)
      .set(fixture.headers)
      .send({ parentWorkItemId: parent.id })
      .expect(409)
      .expect(({ body }) => {
        expect(body.error).toMatchObject({
          code: 'CONFLICT',
          message: 'Archived projects are read-only.'
        });
      });
  });

  it('creates work items with milestone assignment and returns milestone DTOs', async () => {
    const fixture = await createFixture('owner');
    const milestone = await createMilestone(fixture);

    await request(app)
      .post(`/api/projects/${fixture.projectId}/work-items`)
      .set(fixture.headers)
      .send({
        title: 'Milestone assigned item',
        type: 'story',
        priority: 'high',
        milestoneId: milestone.id
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          title: 'Milestone assigned item',
          milestone: {
            id: milestone.id,
            name: 'v0.0.3',
            status: 'active',
            targetDate: '2026-07-18',
            isArchived: false
          }
        });
      });
  });

  it('creates work items with cycle assignment and returns cycle DTOs', async () => {
    const fixture = await createFixture('owner');
    const cycle = await createProjectCycle(fixture);

    await request(app)
      .post(`/api/projects/${fixture.projectId}/work-items`)
      .set(fixture.headers)
      .send({
        title: 'Cycle assigned item',
        type: 'story',
        priority: 'high',
        cycleId: cycle.id
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          title: 'Cycle assigned item',
          cycle: {
            id: cycle.id,
            name: 'Cycle 1',
            status: 'active',
            startDate: '2026-07-01',
            endDate: '2026-07-12',
            targetPoints: 24,
            isArchived: false
          }
        });
      });
  });

  it('rejects invalid work item creation requests', async () => {
    const fixture = await createFixture('owner');

    await request(app)
      .post(`/api/projects/${fixture.projectId}/work-items`)
      .set(fixture.headers)
      .send({ title: '', type: 'task', priority: 'high' })
      .expect(400)
      .expect(({ body }) => {
        expect(body.error.code).toBe('VALIDATION_ERROR');
      });
  });

  it('rejects work item creation with inactive assignees', async () => {
    const fixture = await createFixture('owner');

    await request(app)
      .post(`/api/projects/${fixture.projectId}/work-items`)
      .set(fixture.headers)
      .send({
        title: 'Rejected inactive assignee',
        type: 'task',
        priority: 'medium',
        assigneeId: fixture.inactiveMemberId
      })
      .expect(400)
      .expect(({ body }) => {
        expect(body.error).toEqual({
          code: 'VALIDATION_ERROR',
          message: 'Assignee must be an active workspace member.'
        });
      });

    const project = await repositories.projects.findById(fixture.projectId);
    expect(project?.nextWorkItemNumber).toBe(2);
  });

  it('allows work item creation without an assignee', async () => {
    const fixture = await createFixture('owner');

    await request(app)
      .post(`/api/projects/${fixture.projectId}/work-items`)
      .set(fixture.headers)
      .send({
        title: 'Unassigned work item',
        type: 'task',
        priority: 'medium',
        assigneeId: null
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body.assignee).toBeNull();
      });
  });

  it('previews work item CSV imports without creating work items', async () => {
    const fixture = await createFixture('owner');
    const milestone = await createMilestone(fixture);

    await request(app)
      .post(`/api/projects/${fixture.projectId}/work-items/imports/preview`)
      .set(fixture.headers)
      .send({
        csv: [
          'title,type,status,priority,assignee_email,reporter_email,label_names,milestone_name,due_date,estimate_points',
          `"Imported API row",task,ready,high,${fixture.contributorId}@example.com,,backend,${milestone.name},2026-07-12,5`
        ].join('\n')
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          totalRows: 1,
          validRows: 1,
          invalidRows: 0,
          errors: [],
          warnings: [],
          rows: [
            {
              rowNumber: 2,
              title: 'Imported API row',
              type: 'task',
              status: 'ready',
              priority: 'high',
              assigneeEmail: `${fixture.contributorId}@example.com`,
              reporterEmail: `${fixture.actorId}@example.com`,
              labelNames: ['backend'],
              milestoneName: milestone.name,
              dueDate: '2026-07-12',
              estimatePoints: 5
            }
          ]
        });
      });

    const workItems = await repositories.workItems.listByProject(fixture.projectId);
    expect(workItems).toHaveLength(0);
  });

  it('returns validation previews for invalid work item CSV import rows', async () => {
    const fixture = await createFixture('owner');

    await request(app)
      .post(`/api/projects/${fixture.projectId}/work-items/imports/preview`)
      .set(fixture.headers)
      .send({
        csv: [
          'title,type,status,priority,assignee_email,label_names,due_date,estimate_points',
          ',feature,unknown,extreme,inactive@example.com,missing,2026-02-31,-1'
        ].join('\n')
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.totalRows).toBe(1);
        expect(body.validRows).toBe(0);
        expect(body.invalidRows).toBe(1);
        expect(body.rows).toEqual([]);
        expect(body.errors).toEqual([
          {
            rowNumber: 2,
            field: 'title',
            message: 'CSV field "title" is required.'
          },
          {
            rowNumber: 2,
            field: 'type',
            message: 'CSV field "type" must be one of task, bug, story, chore.'
          },
          {
            rowNumber: 2,
            field: 'status',
            message: 'CSV field "status" must be one of backlog, ready, in_progress, blocked, done, canceled.'
          },
          {
            rowNumber: 2,
            field: 'priority',
            message: 'CSV field "priority" must be one of low, medium, high, urgent.'
          },
          {
            rowNumber: 2,
            field: 'assignee_email',
            message: 'Member "inactive@example.com" was not found.'
          },
          {
            rowNumber: 2,
            field: 'label_names',
            message: 'Label "missing" was not found.'
          },
          {
            rowNumber: 2,
            field: 'due_date',
            message: 'CSV field "due_date" must be a valid YYYY-MM-DD date.'
          },
          {
            rowNumber: 2,
            field: 'estimate_points',
            message: 'CSV field "estimate_points" must be a non-negative integer.'
          }
        ]);
      });

    const workItems = await repositories.workItems.listByProject(fixture.projectId);
    expect(workItems).toHaveLength(0);
  });

  it('rejects malformed work item CSV import preview requests', async () => {
    const fixture = await createFixture('owner');

    await request(app)
      .post(`/api/projects/${fixture.projectId}/work-items/imports/preview`)
      .set(fixture.headers)
      .send({ csv: 42 })
      .expect(400)
      .expect(({ body }) => {
        expect(body.error.code).toBe('VALIDATION_ERROR');
        expect(body.error.message).toBe('Request validation failed.');
      });
  });

  it('rejects work item CSV import previews for missing and archived projects', async () => {
    const fixture = await createFixture('owner');

    await request(app)
      .post(`/api/projects/${randomUUID()}/work-items/imports/preview`)
      .set(fixture.headers)
      .send({ csv: 'title,type,priority\nMissing project import,task,medium\n' })
      .expect(404)
      .expect(({ body }) => {
        expect(body.error).toEqual({
          code: 'NOT_FOUND',
          message: 'Project not found.'
        });
      });

    await repositories.projects.update(fixture.projectId, {
      status: 'archived',
      updatedAt: now()
    });

    await request(app)
      .post(`/api/projects/${fixture.projectId}/work-items/imports/preview`)
      .set(fixture.headers)
      .send({ csv: 'title,type,priority\nArchived import,task,medium\n' })
      .expect(409)
      .expect(({ body }) => {
        expect(body.error).toEqual({
          code: 'CONFLICT',
          message: 'Archived projects are read-only.'
        });
      });
  });

  it('applies work item CSV imports through the API', async () => {
    const fixture = await createFixture('owner');
    const milestone = await createMilestone(fixture);

    await request(app)
      .post(`/api/projects/${fixture.projectId}/work-items/imports`)
      .set(fixture.headers)
      .send({
        csv: [
          'title,description,type,status,priority,assignee_email,reporter_email,label_names,milestone_name,due_date,estimate_points',
          `"Imported API apply row",Created through CSV import,story,ready,high,${fixture.contributorId}@example.com,${fixture.maintainerId}@example.com,"backend,frontend",${milestone.name},2026-07-12,5`
        ].join('\n')
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body.createdCount).toBe(1);
        expect(body.workItems).toHaveLength(1);
        expect(body.workItems[0]).toMatchObject({
          projectId: fixture.projectId,
          itemNumber: 2,
          displayKey: 'WI-2',
          title: 'Imported API apply row',
          description: 'Created through CSV import',
          type: 'story',
          status: 'ready',
          priority: 'high',
          assignee: { id: fixture.contributorId },
          reporter: { id: fixture.maintainerId },
          labels: expect.arrayContaining([
            expect.objectContaining({ id: fixture.backendLabelId, name: 'backend' }),
            expect.objectContaining({ id: fixture.frontendLabelId, name: 'frontend' })
          ]),
          milestone: { id: milestone.id, name: milestone.name },
          boardPosition: 1024,
          dueDate: '2026-07-12',
          estimatePoints: 5
        });
      });

    const workItems = await repositories.workItems.listByProject(fixture.projectId);
    expect(workItems).toHaveLength(1);
    expect(workItems[0]).toMatchObject({
      itemNumber: 2,
      displayKey: 'WI-2',
      reporterId: fixture.maintainerId
    });

    const activity = await repositories.activityEvents.findByWorkItem(workItems[0]!.id);
    expect(activity).toHaveLength(1);
    expect(activity[0]).toMatchObject({
      actorId: fixture.actorId,
      eventType: 'work_item.created'
    });
  });

  it('rejects invalid work item CSV import apply requests without partial writes', async () => {
    const fixture = await createFixture('owner');

    await request(app)
      .post(`/api/projects/${fixture.projectId}/work-items/imports`)
      .set(fixture.headers)
      .send({
        csv: [
          'title,type,priority,label_names',
          'Valid first row,task,medium,backend',
          'Invalid second row,bug,high,missing-label'
        ].join('\n')
      })
      .expect(400)
      .expect(({ body }) => {
        expect(body.error.code).toBe('VALIDATION_ERROR');
        expect(body.error.message).toBe('CSV import validation failed.');
        expect(body.error.details).toMatchObject({
          totalRows: 2,
          validRows: 1,
          invalidRows: 1,
          errors: [
            {
              rowNumber: 3,
              field: 'label_names',
              message: 'Label "missing-label" was not found.'
            }
          ]
        });
      });

    const workItems = await repositories.workItems.listByProject(fixture.projectId);
    expect(workItems).toHaveLength(0);

    const project = await repositories.projects.findById(fixture.projectId);
    expect(project?.nextWorkItemNumber).toBe(2);
  });

  it('rejects work item CSV import apply under archived projects', async () => {
    const fixture = await createFixture('owner');
    await repositories.projects.update(fixture.projectId, {
      status: 'archived',
      updatedAt: now()
    });

    await request(app)
      .post(`/api/projects/${fixture.projectId}/work-items/imports`)
      .set(fixture.headers)
      .send({ csv: 'title,type,priority\nArchived import,task,medium\n' })
      .expect(409)
      .expect(({ body }) => {
        expect(body.error).toEqual({
          code: 'CONFLICT',
          message: 'Archived projects are read-only.'
        });
      });
  });

  it('exports filtered project work items as CSV', async () => {
    const fixture = await createFixture('owner');
    const cycle = await createProjectCycle(fixture, {
      name: 'CSV export cycle'
    });
    const ready = await createWorkItem(fixture, {
      title: 'Exported, ready work',
      status: 'ready',
      priority: 'urgent',
      assigneeId: fixture.contributorId,
      reporterId: fixture.maintainerId,
      cycleId: cycle.id,
      dueDate: '2026-07-12',
      estimatePoints: 8,
      createdAt: new Date('2026-07-01T12:00:00.000Z'),
      updatedAt: new Date('2026-07-03T12:00:00.000Z')
    });
    await repositories.labels.replaceForWorkItem(ready.id, [fixture.backendLabelId]);
    await createWorkItem(fixture, {
      title: 'Blocked unrelated export work',
      status: 'blocked',
      updatedAt: new Date('2026-07-04T12:00:00.000Z')
    });

    await request(app)
      .get(`/api/projects/${fixture.projectId}/work-items/export`)
      .query({ status: 'ready' })
      .set(fixture.headers)
      .expect(200)
      .expect('Content-Type', /text\/csv/)
      .expect('Content-Disposition', 'attachment; filename="worktrail-wi-work-items.csv"')
      .expect(({ text }) => {
        expect(text).toBe(
          [
            'project_key,display_key,title,type,status,priority,assignee_name,assignee_email,reporter_name,reporter_email,label_names,milestone_name,cycle_name,due_date,estimate_points,created_at,updated_at,parent_key,parent_title',
            `WI,${ready.displayKey},"Exported, ready work",task,ready,urgent,API Contributor,${fixture.contributorId}@example.com,API Maintainer,${fixture.maintainerId}@example.com,backend,,CSV export cycle,2026-07-12,8,2026-07-01T12:00:00.000Z,2026-07-03T12:00:00.000Z,,`,
            ''
          ].join('\n')
        );
      });
  });

  it('exports dependency-filtered project and workspace work items as CSV', async () => {
    const fixture = await createFixture('owner');
    const blocker = await createWorkItem(fixture, {
      title: 'CSV export blocker',
      status: 'in_progress',
      updatedAt: new Date('2026-07-02T12:00:00.000Z')
    });
    const blocked = await createWorkItem(fixture, {
      title: 'CSV export dependency blocked',
      status: 'ready',
      updatedAt: new Date('2026-07-03T12:00:00.000Z')
    });
    const unrelated = await createWorkItem(fixture, {
      title: 'CSV export unrelated',
      status: 'ready',
      updatedAt: new Date('2026-07-04T12:00:00.000Z')
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

    await request(app)
      .get(`/api/projects/${fixture.projectId}/work-items/export`)
      .query({ dependency: 'dependency_blocked' })
      .set(fixture.headers)
      .expect(200)
      .expect(({ text }) => {
        expect(text).toContain(`WI,${blocked.displayKey},CSV export dependency blocked`);
        expect(text).not.toContain(`WI,${blocker.displayKey},CSV export blocker`);
        expect(text).not.toContain(`WI,${unrelated.displayKey},CSV export unrelated`);
      });

    await request(app)
      .get('/api/work-items/export')
      .query({ dependency: 'blocking_open_work' })
      .set(fixture.headers)
      .expect(200)
      .expect(({ text }) => {
        expect(text).toContain(`WI,${blocker.displayKey},CSV export blocker`);
        expect(text).not.toContain(`WI,${blocked.displayKey},CSV export dependency blocked`);
        expect(text).not.toContain(`WI,${unrelated.displayKey},CSV export unrelated`);
      });
  });

  it('exports parent context through project and workspace hierarchy filters', async () => {
    const fixture = await createFixture('owner');
    const parent = await createWorkItem(fixture, {
      title: 'CSV hierarchy parent',
      status: 'in_progress'
    });
    const child = await createWorkItem(fixture, {
      title: 'CSV hierarchy child',
      status: 'ready',
      parentWorkItemId: parent.id
    });
    await createWorkItem(fixture, {
      title: 'CSV hierarchy unrelated',
      status: 'ready'
    });

    await request(app)
      .get(`/api/projects/${fixture.projectId}/work-items/export`)
      .query({ parentKey: parent.displayKey })
      .set(fixture.headers)
      .expect(200)
      .expect(({ text }) => {
        expect(text).toContain(`WI,${child.displayKey},CSV hierarchy child`);
        expect(text).toContain(`,${parent.displayKey},CSV hierarchy parent\n`);
        expect(text).not.toContain(`WI,${parent.displayKey},CSV hierarchy parent`);
        expect(text).not.toContain('CSV hierarchy unrelated');
      });

    await request(app)
      .get('/api/work-items/export')
      .query({ hierarchy: 'children' })
      .set(fixture.headers)
      .expect(200)
      .expect(({ text }) => {
        expect(text).toContain(`WI,${child.displayKey},CSV hierarchy child`);
        expect(text).toContain(`,${parent.displayKey},CSV hierarchy parent\n`);
        expect(text).not.toContain(`WI,${parent.displayKey},CSV hierarchy parent`);
        expect(text).not.toContain('CSV hierarchy unrelated');
      });
  });

  it('exports header-only CSV for empty project work item results', async () => {
    const fixture = await createFixture('owner');
    await createWorkItem(fixture, {
      title: 'Only existing export work',
      status: 'ready'
    });

    await request(app)
      .get(`/api/projects/${fixture.projectId}/work-items/export`)
      .query({ status: 'done' })
      .set(fixture.headers)
      .expect(200)
      .expect('Content-Type', /text\/csv/)
      .expect(({ text }) => {
        expect(text).toBe(
          'project_key,display_key,title,type,status,priority,assignee_name,assignee_email,reporter_name,reporter_email,label_names,milestone_name,cycle_name,due_date,estimate_points,created_at,updated_at,parent_key,parent_title\n'
        );
      });
  });

  it('exports workspace work items with filters and archived project modes', async () => {
    const fixture = await createFixture('owner');
    const archivedProject = await createProject(fixture, {
      key: 'OLD',
      name: 'Archived Operations',
      status: 'archived'
    });
    const activeItem = await createWorkItem(fixture, {
      title: 'Shared export active work',
      status: 'ready',
      updatedAt: new Date('2026-07-03T12:00:00.000Z')
    });
    const archivedItem = await createWorkItem(fixture, {
      projectId: archivedProject.id,
      itemNumber: 1,
      displayKey: 'OLD-1',
      title: 'Shared export archived work',
      status: 'ready',
      updatedAt: new Date('2026-07-04T12:00:00.000Z')
    });

    await request(app)
      .get('/api/work-items/export')
      .query({ search: 'shared export', archivedProjects: 'include' })
      .set(fixture.headers)
      .expect(200)
      .expect('Content-Type', /text\/csv/)
      .expect('Content-Disposition', 'attachment; filename="worktrail-work-items.csv"')
      .expect(({ text }) => {
        expect(text).toContain(`OLD,${archivedItem.displayKey},Shared export archived work`);
        expect(text).toContain(`WI,${activeItem.displayKey},Shared export active work`);
      });

    await request(app)
      .get('/api/work-items/export')
      .query({ search: 'shared export', archivedProjects: 'only' })
      .set(fixture.headers)
      .expect(200)
      .expect(({ text }) => {
        expect(text).toContain(`OLD,${archivedItem.displayKey},Shared export archived work`);
        expect(text).not.toContain(`WI,${activeItem.displayKey},Shared export active work`);
      });
  });

  it('lists workspace work items across active projects by default', async () => {
    const fixture = await createFixture('owner');
    const otherProject = await createProject(fixture);
    const archivedProject = await createProject(fixture, {
      key: 'OLD',
      name: 'Archived Operations',
      status: 'archived'
    });
    const activeItem = await createWorkItem(fixture, {
      title: 'Active project work',
      updatedAt: new Date('2026-07-03T12:00:00.000Z')
    });
    const otherProjectItem = await createWorkItem(fixture, {
      projectId: otherProject.id,
      itemNumber: 1,
      displayKey: 'OPS-1',
      title: 'Other active project work',
      updatedAt: new Date('2026-07-02T12:00:00.000Z')
    });
    await createWorkItem(fixture, {
      projectId: archivedProject.id,
      itemNumber: 1,
      displayKey: 'OLD-1',
      title: 'Archived project work',
      updatedAt: new Date('2026-07-04T12:00:00.000Z')
    });

    await request(app)
      .get('/api/work-items')
      .set(fixture.headers)
      .expect(200)
      .expect(({ body }) => {
        expect(body.map((item: { displayKey: string }) => item.displayKey)).toEqual([
          activeItem.displayKey,
          otherProjectItem.displayKey
        ]);
        expect(body[0]).toMatchObject({
          displayKey: activeItem.displayKey,
          project: {
            id: fixture.projectId,
            key: 'WI',
            name: 'Work Item Test Project',
            status: 'active'
          }
        });
        expect(body.every((item: { project: { status: string } }) => item.project.status === 'active')).toBe(
          true
        );
      });
  });

  it('supports workspace work item filters, search, labels, cycles, and sorts', async () => {
    const fixture = await createFixture('owner');
    const milestone = await createMilestone(fixture);
    const cycle = await createProjectCycle(fixture);
    const urgent = await createWorkItem(fixture, {
      title: 'Needle urgent backend work',
      priority: 'urgent',
      status: 'blocked',
      milestoneId: milestone.id,
      cycleId: cycle.id,
      dueDate: '2026-07-05',
      updatedAt: new Date('2026-07-02T12:00:00.000Z')
    });
    const low = await createWorkItem(fixture, {
      title: 'Needle low frontend work',
      priority: 'low',
      status: 'ready',
      assigneeId: null,
      dueDate: '2026-07-10',
      updatedAt: new Date('2026-07-03T12:00:00.000Z')
    });
    await repositories.labels.replaceForWorkItem(urgent.id, [fixture.backendLabelId]);
    await repositories.labels.replaceForWorkItem(low.id, [fixture.frontendLabelId]);

    await request(app)
      .get('/api/work-items')
      .query({
        search: 'needle',
        labelId: fixture.backendLabelId,
        milestoneId: milestone.id,
        cycleId: cycle.id,
        sort: 'priority_desc'
      })
      .set(fixture.headers)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toHaveLength(1);
        expect(body[0]).toMatchObject({
          id: urgent.id,
          displayKey: urgent.displayKey,
          labels: [{ id: fixture.backendLabelId, name: 'backend' }],
          milestone: { id: milestone.id },
          cycle: { id: cycle.id }
        });
      });

    await request(app)
      .get('/api/work-items')
      .query({ search: 'needle', assigneeState: 'unassigned' })
      .set(fixture.headers)
      .expect(200)
      .expect(({ body }) => {
        expect(body.map((item: { id: string }) => item.id)).toEqual([low.id]);
        expect(body[0].assignee).toBeNull();
      });

    await request(app)
      .get('/api/work-items')
      .query({ search: 'needle', sort: 'priority_desc' })
      .set(fixture.headers)
      .expect(200)
      .expect(({ body }) => {
        expect(body.map((item: { id: string }) => item.id)).toEqual([urgent.id, low.id]);
      });
  });

  it('supports workspace dependency filters', async () => {
    const fixture = await createFixture('owner');
    const openBlocker = await createWorkItem(fixture, {
      title: 'Workspace open blocker',
      status: 'in_progress'
    });
    const terminalBlocker = await createWorkItem(fixture, {
      title: 'Workspace terminal blocker',
      status: 'done'
    });
    const dependencyBlocked = await createWorkItem(fixture, {
      title: 'Workspace dependency blocked',
      status: 'ready'
    });
    const terminalOnlyBlocked = await createWorkItem(fixture, {
      title: 'Workspace terminal-only blocked',
      status: 'canceled'
    });

    for (const relationship of [
      { sourceWorkItemId: openBlocker.id, targetWorkItemId: dependencyBlocked.id },
      { sourceWorkItemId: terminalBlocker.id, targetWorkItemId: terminalOnlyBlocked.id }
    ]) {
      await repositories.workItemRelationships.create({
        id: randomUUID(),
        workspaceId: fixture.workspaceId,
        relationshipType: 'blocks',
        sourceWorkItemId: relationship.sourceWorkItemId,
        targetWorkItemId: relationship.targetWorkItemId,
        createdById: fixture.actorId,
        createdAt: now()
      });
    }

    await request(app)
      .get('/api/work-items')
      .query({ dependency: 'dependency_blocked' })
      .set(fixture.headers)
      .expect(200)
      .expect(({ body }) => {
        expect(body.map((item: { id: string }) => item.id)).toEqual([dependencyBlocked.id]);
        expect(body[0]).toMatchObject({
          dependencyBlocked: true,
          openBlockerCount: 1
        });
      });

    await request(app)
      .get('/api/work-items')
      .query({ dependency: 'blocking_open_work' })
      .set(fixture.headers)
      .expect(200)
      .expect(({ body }) => {
        expect(body.map((item: { id: string }) => item.id)).toEqual([openBlocker.id]);
        expect(body[0]).toMatchObject({
          openBlockedWorkCount: 1
        });
      });
  });

  it('supports archived project inclusion modes for workspace work item queries', async () => {
    const fixture = await createFixture('owner');
    const archivedProject = await createProject(fixture, {
      key: 'OLD',
      name: 'Archived Operations',
      status: 'archived'
    });
    const activeItem = await createWorkItem(fixture, {
      title: 'Shared discovery active work',
      updatedAt: new Date('2026-07-03T12:00:00.000Z')
    });
    const archivedItem = await createWorkItem(fixture, {
      projectId: archivedProject.id,
      itemNumber: 1,
      displayKey: 'OLD-1',
      title: 'Shared discovery archived work',
      updatedAt: new Date('2026-07-04T12:00:00.000Z')
    });

    await request(app)
      .get('/api/work-items')
      .query({ search: 'shared discovery', archivedProjects: 'include' })
      .set(fixture.headers)
      .expect(200)
      .expect(({ body }) => {
        expect(body.map((item: { id: string }) => item.id)).toEqual([archivedItem.id, activeItem.id]);
      });

    await request(app)
      .get('/api/work-items')
      .query({ search: 'shared discovery', archivedProjects: 'only' })
      .set(fixture.headers)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toHaveLength(1);
        expect(body[0]).toMatchObject({
          id: archivedItem.id,
          project: { id: archivedProject.id, status: 'archived' }
        });
      });
  });

  it('keeps inactive historical assignees visible in workspace work item results', async () => {
    const fixture = await createFixture('owner');
    const workItem = await createWorkItem(fixture, {
      title: 'Inactive historical assignee work',
      assigneeId: fixture.inactiveMemberId
    });

    await request(app)
      .get('/api/work-items')
      .query({ assigneeId: fixture.inactiveMemberId })
      .set(fixture.headers)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toHaveLength(1);
        expect(body[0]).toMatchObject({
          id: workItem.id,
          assignee: {
            id: fixture.inactiveMemberId,
            isActive: false
          }
        });
      });
  });

  it('rejects invalid workspace work item query combinations', async () => {
    const fixture = await createFixture('owner');

    await request(app)
      .get('/api/work-items')
      .query({ blocked: 'true', status: 'ready' })
      .set(fixture.headers)
      .expect(400)
      .expect(({ body }) => {
        expect(body.error).toEqual({
          code: 'VALIDATION_ERROR',
          message: 'Blocked work item queries cannot specify another status.'
        });
      });

    await request(app)
      .get('/api/work-items')
      .query({ assigneeState: 'unassigned', assigneeId: fixture.contributorId })
      .set(fixture.headers)
      .expect(400)
      .expect(({ body }) => {
        expect(body.error).toEqual({
          code: 'VALIDATION_ERROR',
          message: 'Unassigned work item queries cannot specify an assignee.'
        });
      });

    await request(app)
      .get('/api/work-items')
      .query({ workState: 'open', status: 'ready' })
      .set(fixture.headers)
      .expect(400)
      .expect(({ body }) => {
        expect(body.error).toEqual({
          code: 'VALIDATION_ERROR',
          message: 'Work item queries cannot specify both status and work state.'
        });
      });
  });

  it('rejects work item creation under archived projects', async () => {
    const fixture = await createFixture('owner');
    await repositories.projects.update(fixture.projectId, {
      status: 'archived',
      updatedAt: now()
    });

    await request(app)
      .post(`/api/projects/${fixture.projectId}/work-items`)
      .set(fixture.headers)
      .send({
        title: 'Rejected archived project work item',
        type: 'task',
        priority: 'medium'
      })
      .expect(409)
      .expect(({ body }) => {
        expect(body.error.code).toBe('CONFLICT');
        expect(body.error.message).toBe('Archived projects are read-only.');
      });

    const project = await repositories.projects.findById(fixture.projectId);
    expect(project?.nextWorkItemNumber).toBe(2);
  });

  it('lists and filters project work items', async () => {
    const fixture = await createFixture('owner');
    const ready = await createWorkItem(fixture, {
      title: 'Filtered ready work item',
      status: 'ready',
      priority: 'urgent',
      assigneeId: fixture.contributorId
    });
    await repositories.labels.replaceForWorkItem(ready.id, [fixture.frontendLabelId]);
    await createWorkItem(fixture, {
      title: 'Blocked unrelated work item',
      status: 'blocked',
      priority: 'low',
      assigneeId: fixture.maintainerId
    });

    await request(app)
      .get(`/api/projects/${fixture.projectId}/work-items`)
      .query({
        status: 'ready',
        assigneeId: fixture.contributorId,
        type: 'task',
        labelId: fixture.frontendLabelId,
        priority: 'urgent',
        search: 'filtered',
        sort: 'priority_desc'
      })
      .set(fixture.headers)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toHaveLength(1);
        expect(body[0]).toMatchObject({
          id: ready.id,
          title: 'Filtered ready work item',
          labels: [{ id: fixture.frontendLabelId }]
        });
      });
  });

  it('filters project work items by milestone-scoped work risk', async () => {
    const fixture = await createFixture('owner');
    const milestone = await createMilestone(fixture);
    const otherMilestone = await createMilestone(fixture, {
      name: 'Later milestone'
    });
    const unassignedActive = await createWorkItem(fixture, {
      title: 'Unassigned active milestone work',
      status: 'ready',
      assigneeId: null,
      milestoneId: milestone.id,
      updatedAt: new Date('2026-07-02T12:00:00.000Z')
    });
    const staleInProgress = await createWorkItem(fixture, {
      title: 'Stale in-progress milestone work',
      status: 'in_progress',
      milestoneId: milestone.id,
      updatedAt: new Date('2026-06-20T12:00:00.000Z')
    });
    await createWorkItem(fixture, {
      title: 'Unassigned backlog is not active',
      status: 'backlog',
      assigneeId: null,
      milestoneId: milestone.id,
      updatedAt: new Date('2026-07-02T12:00:00.000Z')
    });
    await createWorkItem(fixture, {
      title: 'Unassigned active work in another milestone',
      status: 'ready',
      assigneeId: null,
      milestoneId: otherMilestone.id,
      updatedAt: new Date('2026-07-02T12:00:00.000Z')
    });
    await createWorkItem(fixture, {
      title: 'Recent in-progress milestone work',
      status: 'in_progress',
      milestoneId: milestone.id,
      updatedAt: new Date()
    });

    await request(app)
      .get(`/api/projects/${fixture.projectId}/work-items`)
      .query({
        milestoneId: milestone.id,
        workRisk: 'unassigned_active',
        sort: 'priority_desc'
      })
      .set(fixture.headers)
      .expect(200)
      .expect(({ body }) => {
        expect(body.map((item: { id: string }) => item.id)).toEqual([unassignedActive.id]);
        expect(body[0]).toMatchObject({
          assignee: null,
          milestone: { id: milestone.id },
          status: 'ready'
        });
      });

    await request(app)
      .get(`/api/projects/${fixture.projectId}/work-items`)
      .query({
        milestoneId: milestone.id,
        workRisk: 'stale_in_progress',
        sort: 'updated_asc'
      })
      .set(fixture.headers)
      .expect(200)
      .expect(({ body }) => {
        expect(body.map((item: { id: string }) => item.id)).toEqual([staleInProgress.id]);
        expect(body[0]).toMatchObject({
          milestone: { id: milestone.id },
          status: 'in_progress'
        });
      });
  });

  it('bulk updates selected project work items', async () => {
    const fixture = await createFixture('maintainer');
    const first = await createWorkItem(fixture, {
      title: 'First bulk priority item',
      priority: 'medium'
    });
    const second = await createWorkItem(fixture, {
      title: 'Second bulk priority item',
      priority: 'low'
    });

    await request(app)
      .post(`/api/projects/${fixture.projectId}/work-items/bulk-update`)
      .set(fixture.headers)
      .send({
        workItemIds: [first.id, second.id],
        action: {
          type: 'set_priority',
          priority: 'urgent'
        }
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          requestedCount: 2,
          succeededCount: 2,
          unchangedCount: 0,
          failedCount: 0
        });
        expect(body.results).toEqual([
          expect.objectContaining({
            workItemId: first.id,
            displayKey: first.displayKey,
            status: 'updated',
            workItem: expect.objectContaining({ id: first.id, priority: 'urgent' }),
            error: null
          }),
          expect.objectContaining({
            workItemId: second.id,
            displayKey: second.displayKey,
            status: 'updated',
            workItem: expect.objectContaining({ id: second.id, priority: 'urgent' }),
            error: null
          })
        ]);
      });

    await expect(repositories.workItems.findById(first.id)).resolves.toMatchObject({ priority: 'urgent' });
    await expect(repositories.workItems.findById(second.id)).resolves.toMatchObject({ priority: 'urgent' });
  });

  it('rejects invalid bulk update request shapes', async () => {
    const fixture = await createFixture('owner');
    const workItem = await createWorkItem(fixture);
    const validUuid = randomUUID();

    const invalidRequests = [
      {
        name: 'empty work item ids',
        body: {
          workItemIds: [],
          action: { type: 'set_priority', priority: 'high' }
        }
      },
      {
        name: 'too many work item ids',
        body: {
          workItemIds: Array.from({ length: 51 }, () => randomUUID()),
          action: { type: 'set_priority', priority: 'high' }
        }
      },
      {
        name: 'duplicate work item ids',
        body: {
          workItemIds: [workItem.id, workItem.id],
          action: { type: 'set_priority', priority: 'high' }
        }
      },
      {
        name: 'invalid action type',
        body: {
          workItemIds: [workItem.id],
          action: { type: 'replace_everything' }
        }
      },
      {
        name: 'invalid action value',
        body: {
          workItemIds: [workItem.id],
          action: { type: 'set_priority', priority: 'highest' }
        }
      },
      {
        name: 'duplicate label ids',
        body: {
          workItemIds: [workItem.id],
          action: { type: 'add_labels', labelIds: [validUuid, validUuid] }
        }
      },
      {
        name: 'invalid due date',
        body: {
          workItemIds: [workItem.id],
          action: { type: 'set_due_date', dueDate: '07/19/2026' }
        }
      }
    ];

    for (const invalidRequest of invalidRequests) {
      await request(app)
        .post(`/api/projects/${fixture.projectId}/work-items/bulk-update`)
        .set(fixture.headers)
        .send(invalidRequest.body)
        .expect(400)
        .expect(({ body }) => {
          expect(body.error.code, invalidRequest.name).toBe('VALIDATION_ERROR');
          expect(body.error.message, invalidRequest.name).toBe('Request validation failed.');
        });
    }
  });

  it('supports clear assignee, milestone, cycle, label, and clear due date bulk actions', async () => {
    const fixture = await createFixture('owner');
    const milestone = await createMilestone(fixture);
    const cycle = await createProjectCycle(fixture);
    const assigneeItem = await createWorkItem(fixture, {
      assigneeId: fixture.contributorId
    });
    const milestoneItem = await createWorkItem(fixture, {
      milestoneId: null
    });
    const cycleItem = await createWorkItem(fixture, {
      cycleId: null
    });
    const dueDateItem = await createWorkItem(fixture, {
      dueDate: '2026-07-19'
    });
    const labelItem = await createWorkItem(fixture);

    await request(app)
      .post(`/api/projects/${fixture.projectId}/work-items/bulk-update`)
      .set(fixture.headers)
      .send({
        workItemIds: [assigneeItem.id],
        action: { type: 'clear_assignee' }
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.results[0]).toMatchObject({
          status: 'updated',
          workItem: { id: assigneeItem.id, assignee: null }
        });
      });

    await request(app)
      .post(`/api/projects/${fixture.projectId}/work-items/bulk-update`)
      .set(fixture.headers)
      .send({
        workItemIds: [cycleItem.id],
        action: { type: 'set_cycle', cycleId: cycle.id }
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.results[0]).toMatchObject({
          status: 'updated',
          workItem: { id: cycleItem.id, cycle: { id: cycle.id } }
        });
      });

    await request(app)
      .post(`/api/projects/${fixture.projectId}/work-items/bulk-update`)
      .set(fixture.headers)
      .send({
        workItemIds: [cycleItem.id],
        action: { type: 'clear_cycle' }
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.results[0]).toMatchObject({
          status: 'updated',
          workItem: { id: cycleItem.id, cycle: null }
        });
      });

    await request(app)
      .post(`/api/projects/${fixture.projectId}/work-items/bulk-update`)
      .set(fixture.headers)
      .send({
        workItemIds: [milestoneItem.id],
        action: { type: 'set_milestone', milestoneId: milestone.id }
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.results[0]).toMatchObject({
          status: 'updated',
          workItem: { id: milestoneItem.id, milestone: { id: milestone.id } }
        });
      });

    await request(app)
      .post(`/api/projects/${fixture.projectId}/work-items/bulk-update`)
      .set(fixture.headers)
      .send({
        workItemIds: [milestoneItem.id],
        action: { type: 'clear_milestone' }
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.results[0]).toMatchObject({
          status: 'updated',
          workItem: { id: milestoneItem.id, milestone: null }
        });
      });

    await request(app)
      .post(`/api/projects/${fixture.projectId}/work-items/bulk-update`)
      .set(fixture.headers)
      .send({
        workItemIds: [dueDateItem.id],
        action: { type: 'clear_due_date' }
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.results[0]).toMatchObject({
          status: 'updated',
          workItem: { id: dueDateItem.id, dueDate: null }
        });
      });

    await request(app)
      .post(`/api/projects/${fixture.projectId}/work-items/bulk-update`)
      .set(fixture.headers)
      .send({
        workItemIds: [labelItem.id],
        action: { type: 'add_labels', labelIds: [fixture.frontendLabelId, fixture.backendLabelId] }
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.results[0]).toMatchObject({
          status: 'updated',
          workItem: {
            id: labelItem.id,
            labels: expect.arrayContaining([
              expect.objectContaining({ id: fixture.frontendLabelId }),
              expect.objectContaining({ id: fixture.backendLabelId })
            ])
          }
        });
      });

    await request(app)
      .post(`/api/projects/${fixture.projectId}/work-items/bulk-update`)
      .set(fixture.headers)
      .send({
        workItemIds: [labelItem.id],
        action: { type: 'remove_labels', labelIds: [fixture.frontendLabelId] }
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.results[0]).toMatchObject({
          status: 'updated',
          workItem: {
            id: labelItem.id,
            labels: [expect.objectContaining({ id: fixture.backendLabelId })]
          }
        });
      });

    await expect(repositories.workItems.findById(assigneeItem.id)).resolves.toMatchObject({
      assigneeId: null
    });
    await expect(repositories.workItems.findById(milestoneItem.id)).resolves.toMatchObject({
      milestoneId: null
    });
    await expect(repositories.workItems.findById(cycleItem.id)).resolves.toMatchObject({
      cycleId: null
    });
    await expect(repositories.workItems.findById(dueDateItem.id)).resolves.toMatchObject({
      dueDate: null
    });
    await expect(repositories.labels.listByWorkItem(labelItem.id)).resolves.toEqual([
      expect.objectContaining({ id: fixture.backendLabelId })
    ]);
  });

  it('records due date activity for bulk updates', async () => {
    const fixture = await createFixture('owner');
    const workItem = await createWorkItem(fixture, {
      dueDate: '2026-07-12'
    });

    await request(app)
      .post(`/api/projects/${fixture.projectId}/work-items/bulk-update`)
      .set(fixture.headers)
      .send({
        workItemIds: [workItem.id],
        action: {
          type: 'set_due_date',
          dueDate: '2026-07-19'
        }
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          requestedCount: 1,
          succeededCount: 1,
          unchangedCount: 0,
          failedCount: 0
        });
        expect(body.results[0]).toMatchObject({
          status: 'updated',
          workItem: {
            id: workItem.id,
            dueDate: '2026-07-19'
          }
        });
      });

    const activity = await repositories.activityEvents.findByWorkItem(workItem.id);
    expect(activity).toEqual([
      expect.objectContaining({
        eventType: 'work_item.due_date_changed',
        summary: 'Due date changed.',
        previousValue: { dueDate: '2026-07-12' },
        newValue: { dueDate: '2026-07-19' }
      })
    ]);
  });

  it('does not update timestamps, activity, or notifications for unchanged bulk rows', async () => {
    const fixture = await createFixture('owner');
    const updatedAt = new Date('2026-07-01T12:00:00.000Z');
    const workItem = await createWorkItem(fixture, {
      priority: 'high',
      updatedAt
    });

    await request(app)
      .post(`/api/projects/${fixture.projectId}/work-items/bulk-update`)
      .set(fixture.headers)
      .send({
        workItemIds: [workItem.id],
        action: {
          type: 'set_priority',
          priority: 'high'
        }
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          requestedCount: 1,
          succeededCount: 1,
          unchangedCount: 1,
          failedCount: 0
        });
        expect(body.results[0]).toMatchObject({
          workItemId: workItem.id,
          status: 'unchanged',
          error: null
        });
      });

    await expect(repositories.workItems.findById(workItem.id)).resolves.toMatchObject({
      priority: 'high',
      updatedAt
    });
    await expect(repositories.activityEvents.findByWorkItem(workItem.id)).resolves.toEqual([]);
    await expect(
      repositories.notifications.listByRecipient({
        workspaceId: fixture.workspaceId,
        recipientMemberId: fixture.contributorId,
        state: 'all'
      })
    ).resolves.toEqual([]);
  });

  it('records assignee notifications for changed bulk assignment rows only', async () => {
    const fixture = await createFixture('owner');
    const changed = await createWorkItem(fixture, {
      title: 'Changed assignee bulk item',
      assigneeId: null
    });
    const unchanged = await createWorkItem(fixture, {
      title: 'Unchanged assignee bulk item',
      assigneeId: fixture.maintainerId
    });

    await request(app)
      .post(`/api/projects/${fixture.projectId}/work-items/bulk-update`)
      .set(fixture.headers)
      .send({
        workItemIds: [changed.id, unchanged.id],
        action: {
          type: 'set_assignee',
          assigneeId: fixture.maintainerId
        }
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          requestedCount: 2,
          succeededCount: 2,
          unchangedCount: 1,
          failedCount: 0
        });
        expect(body.results.map((result: { status: string }) => result.status)).toEqual([
          'updated',
          'unchanged'
        ]);
      });

    await expect(
      repositories.notifications.listByRecipient({
        workspaceId: fixture.workspaceId,
        recipientMemberId: fixture.maintainerId,
        state: 'all'
      })
    ).resolves.toMatchObject([
      {
        notificationType: 'assignment',
        workItemId: changed.id,
        summary: `${changed.displayKey} was assigned to you.`
      }
    ]);
    await expect(repositories.activityEvents.findByWorkItem(unchanged.id)).resolves.toEqual([]);
  });

  it('returns per-item failures for bulk updates with work outside the route project', async () => {
    const fixture = await createFixture('owner');
    const routeProjectItem = await createWorkItem(fixture, {
      title: 'Route project bulk item',
      priority: 'medium'
    });
    const otherProject = await createProject(fixture);
    const otherProjectItem = await createWorkItem(fixture, {
      projectId: otherProject.id,
      displayKey: 'OPS-1',
      itemNumber: 1,
      title: 'Other project bulk item',
      priority: 'medium'
    });

    await request(app)
      .post(`/api/projects/${fixture.projectId}/work-items/bulk-update`)
      .set(fixture.headers)
      .send({
        workItemIds: [routeProjectItem.id, otherProjectItem.id],
        action: {
          type: 'set_priority',
          priority: 'high'
        }
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          requestedCount: 2,
          succeededCount: 1,
          unchangedCount: 0,
          failedCount: 1
        });
        expect(body.results).toEqual([
          expect.objectContaining({
            workItemId: routeProjectItem.id,
            displayKey: routeProjectItem.displayKey,
            status: 'updated',
            error: null
          }),
          expect.objectContaining({
            workItemId: otherProjectItem.id,
            displayKey: null,
            status: 'failed',
            workItem: null,
            error: {
              code: 'NOT_IN_PROJECT',
              message: 'Work item is not part of this project.'
            }
          })
        ]);
      });

    await expect(repositories.workItems.findById(routeProjectItem.id)).resolves.toMatchObject({
      priority: 'high'
    });
    await expect(repositories.workItems.findById(otherProjectItem.id)).resolves.toMatchObject({
      priority: 'medium'
    });
  });

  it('rejects bulk updates for contributors and archived projects', async () => {
    const contributorFixture = await createFixture('contributor');
    const contributorItem = await createWorkItem(contributorFixture);

    await request(app)
      .post(`/api/projects/${contributorFixture.projectId}/work-items/bulk-update`)
      .set(contributorFixture.headers)
      .send({
        workItemIds: [contributorItem.id],
        action: {
          type: 'set_priority',
          priority: 'high'
        }
      })
      .expect(403)
      .expect(({ body }) => {
        expect(body.error).toMatchObject({
          code: 'FORBIDDEN',
          message: 'Only owners and maintainers can bulk update work items.'
        });
      });

    const archivedFixture = await createFixture('owner');
    const archivedItem = await createWorkItem(archivedFixture);
    await repositories.projects.update(archivedFixture.projectId, {
      status: 'archived',
      updatedAt: now()
    });

    await request(app)
      .post(`/api/projects/${archivedFixture.projectId}/work-items/bulk-update`)
      .set(archivedFixture.headers)
      .send({
        workItemIds: [archivedItem.id],
        action: {
          type: 'set_priority',
          priority: 'high'
        }
      })
      .expect(409)
      .expect(({ body }) => {
        expect(body.error).toMatchObject({
          code: 'CONFLICT',
          message: 'Archived projects are read-only.'
        });
      });
  });

  it('rejects invalid bulk action references before item updates', async () => {
    const fixture = await createFixture('owner');
    const workItem = await createWorkItem(fixture, {
      priority: 'medium'
    });

    const invalidRequests = [
      {
        action: {
          type: 'set_assignee',
          assigneeId: fixture.inactiveMemberId
        },
        message: 'Assignee must be an active workspace member.'
      },
      {
        action: {
          type: 'set_milestone',
          milestoneId: randomUUID()
        },
        message: 'Milestone is invalid for this project.'
      },
      {
        action: {
          type: 'set_cycle',
          cycleId: randomUUID()
        },
        message: 'Cycle is invalid for this project.'
      },
      {
        action: {
          type: 'add_labels',
          labelIds: [randomUUID()]
        },
        message: 'One or more labels are invalid for this project.'
      }
    ];

    for (const invalidRequest of invalidRequests) {
      await request(app)
        .post(`/api/projects/${fixture.projectId}/work-items/bulk-update`)
        .set(fixture.headers)
        .send({
          workItemIds: [workItem.id],
          action: invalidRequest.action
        })
        .expect(400)
        .expect(({ body }) => {
          expect(body.error).toMatchObject({
            code: 'VALIDATION_ERROR',
            message: invalidRequest.message
          });
        });
    }

    await expect(repositories.workItems.findById(workItem.id)).resolves.toMatchObject({
      priority: 'medium'
    });
  });

  it('returns item-level failures for invalid bulk status transitions', async () => {
    const fixture = await createFixture('owner');
    const done = await createWorkItem(fixture, {
      status: 'done'
    });
    const ready = await createWorkItem(fixture, {
      status: 'ready'
    });

    await request(app)
      .post(`/api/projects/${fixture.projectId}/work-items/bulk-update`)
      .set(fixture.headers)
      .send({
        workItemIds: [done.id, ready.id],
        action: {
          type: 'transition_status',
          status: 'blocked'
        }
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          requestedCount: 2,
          succeededCount: 1,
          unchangedCount: 0,
          failedCount: 1
        });
        expect(body.results).toEqual([
          expect.objectContaining({
            workItemId: done.id,
            displayKey: done.displayKey,
            status: 'failed',
            workItem: null,
            error: {
              code: 'WORKFLOW_TRANSITION_ERROR',
              message: 'The requested status transition is not allowed.'
            }
          }),
          expect.objectContaining({
            workItemId: ready.id,
            displayKey: ready.displayKey,
            status: 'updated',
            workItem: expect.objectContaining({
              id: ready.id,
              status: 'blocked'
            }),
            error: null
          })
        ]);
      });

    await expect(repositories.workItems.findById(done.id)).resolves.toMatchObject({ status: 'done' });
    await expect(repositories.workItems.findById(ready.id)).resolves.toMatchObject({
      status: 'blocked'
    });
  });

  it('supports project dependency filters', async () => {
    const fixture = await createFixture('owner');
    const openBlocker = await createWorkItem(fixture, {
      title: 'Project open blocker',
      status: 'in_progress'
    });
    const terminalBlocker = await createWorkItem(fixture, {
      title: 'Project terminal blocker',
      status: 'done'
    });
    const dependencyBlocked = await createWorkItem(fixture, {
      title: 'Project dependency blocked',
      status: 'ready'
    });
    const terminalOnlyBlocked = await createWorkItem(fixture, {
      title: 'Project terminal-only blocked',
      status: 'canceled'
    });

    for (const relationship of [
      { sourceWorkItemId: openBlocker.id, targetWorkItemId: dependencyBlocked.id },
      { sourceWorkItemId: terminalBlocker.id, targetWorkItemId: terminalOnlyBlocked.id }
    ]) {
      await repositories.workItemRelationships.create({
        id: randomUUID(),
        workspaceId: fixture.workspaceId,
        relationshipType: 'blocks',
        sourceWorkItemId: relationship.sourceWorkItemId,
        targetWorkItemId: relationship.targetWorkItemId,
        createdById: fixture.actorId,
        createdAt: now()
      });
    }

    await request(app)
      .get(`/api/projects/${fixture.projectId}/work-items`)
      .query({ dependency: 'dependency_blocked' })
      .set(fixture.headers)
      .expect(200)
      .expect(({ body }) => {
        expect(body.map((item: { id: string }) => item.id)).toEqual([dependencyBlocked.id]);
        expect(body[0]).toMatchObject({
          dependencyBlocked: true,
          openBlockerCount: 1
        });
      });

    await request(app)
      .get(`/api/projects/${fixture.projectId}/work-items`)
      .query({ dependency: 'blocking_open_work' })
      .set(fixture.headers)
      .expect(200)
      .expect(({ body }) => {
        expect(body.map((item: { id: string }) => item.id)).toEqual([openBlocker.id]);
        expect(body[0]).toMatchObject({
          openBlockedWorkCount: 1
        });
      });
  });

  it('searches and filters by milestone, cycle, reporter, due date state, and board order', async () => {
    const fixture = await createFixture('owner');
    const milestone = await createMilestone(fixture);
    const cycle = await createProjectCycle(fixture);
    const {
      rows: [dates]
    } = await pool.query<{ dueSoon: string; overdue: string }>(
      `select
        (current_date + interval '1 day')::date::text as "dueSoon",
        (current_date - interval '1 day')::date::text as "overdue"`
    );
    const dueSoon = await createWorkItem(fixture, {
      title: 'Launch checklist',
      description: 'Contains a planning keyword.',
      status: 'ready',
      reporterId: fixture.actorId,
      milestoneId: milestone.id,
      cycleId: cycle.id,
      dueDate: dates.dueSoon,
      boardPosition: 2048
    });
    const overdue = await createWorkItem(fixture, {
      title: 'Overdue board item',
      description: 'Different description.',
      status: 'ready',
      reporterId: fixture.actorId,
      milestoneId: null,
      cycleId: null,
      dueDate: dates.overdue,
      boardPosition: 1024
    });

    await request(app)
      .get(`/api/projects/${fixture.projectId}/work-items`)
      .query({
        milestoneId: milestone.id,
        cycleId: cycle.id,
        reporterId: fixture.actorId,
        dueDateState: 'due_soon',
        search: 'planning keyword',
        sort: 'due_date_asc'
      })
      .set(fixture.headers)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toHaveLength(1);
        expect(body[0]).toMatchObject({
          id: dueSoon.id,
          milestone: { id: milestone.id },
          cycle: { id: cycle.id },
          dueDate: dates.dueSoon
        });
      });

    await request(app)
      .get(`/api/projects/${fixture.projectId}/work-items`)
      .query({ search: overdue.displayKey })
      .set(fixture.headers)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toHaveLength(1);
        expect(body[0].id).toBe(overdue.id);
      });

    await request(app)
      .get(`/api/projects/${fixture.projectId}/work-items`)
      .query({ status: 'ready', sort: 'board_order' })
      .set(fixture.headers)
      .expect(200)
      .expect(({ body }) => {
        expect(body.map((item: { id: string }) => item.id)).toEqual([overdue.id, dueSoon.id]);
      });
  });

  it('returns work item detail scoped to the actor workspace', async () => {
    const fixture = await createFixture('owner');
    const otherFixture = await createFixture('owner');
    const workItem = await createWorkItem(fixture);
    await repositories.labels.replaceForWorkItem(workItem.id, [fixture.backendLabelId]);

    await request(app)
      .get(`/api/work-items/${workItem.id}`)
      .set(fixture.headers)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          id: workItem.id,
          description: 'Existing description.',
          labels: [{ id: fixture.backendLabelId }]
        });
      });

    await request(app).get(`/api/work-items/${workItem.id}`).set(otherFixture.headers).expect(404);
  });

  it('creates, lists, returns, and deletes work item relationships through the API', async () => {
    const fixture = await createFixture('owner');
    const source = await createWorkItem(fixture, {
      title: 'API blocker',
      status: 'in_progress'
    });
    const target = await createWorkItem(fixture, {
      title: 'API blocked work',
      status: 'ready'
    });

    const createResponse = await request(app)
      .post(`/api/work-items/${source.id}/relationships`)
      .set(fixture.headers)
      .send({
        relationshipType: 'blocks',
        targetWorkItemId: target.id
      })
      .expect(201);

    expect(createResponse.body).toMatchObject({
      relationshipType: 'blocks',
      sourceWorkItemId: source.id,
      targetWorkItemId: target.id,
      sourceWorkItem: { id: source.id, displayKey: source.displayKey },
      targetWorkItem: { id: target.id, displayKey: target.displayKey },
      createdBy: { id: fixture.actorId }
    });

    await request(app)
      .get(`/api/work-items/${source.id}/relationships`)
      .set(fixture.headers)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          dependencyBlocked: false,
          openBlockerCount: 0,
          openBlockedWorkCount: 1
        });
        expect(body.blocks).toHaveLength(1);
        expect(body.blocks[0]).toMatchObject({
          relationshipType: 'blocks',
          direction: 'outbound',
          workItem: { id: target.id }
        });
      });

    await request(app)
      .get(`/api/work-items/${target.id}`)
      .set(fixture.headers)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          id: target.id,
          dependencyBlocked: true,
          openBlockerCount: 1,
          relationships: {
            dependencyBlocked: true,
            openBlockerCount: 1,
            openBlockedWorkCount: 0
          }
        });
        expect(body.relationships.blockedBy).toHaveLength(1);
      });

    await request(app)
      .delete(`/api/work-items/${target.id}/relationships/${createResponse.body.id}`)
      .set(fixture.headers)
      .expect(204);

    await expect(repositories.workItemRelationships.findById(createResponse.body.id)).resolves.toBeNull();
    const activity = await repositories.activityEvents.findByWorkItem(target.id);
    expect(activity.at(-1)).toMatchObject({
      eventType: 'work_item.relationship_removed',
      summary: `Removed blocker ${source.displayKey}.`
    });
  });

  it('rejects invalid relationship requests, duplicates, and cycles through the API', async () => {
    const fixture = await createFixture('owner');
    const first = await createWorkItem(fixture, { status: 'ready' });
    const second = await createWorkItem(fixture, { status: 'ready' });
    const third = await createWorkItem(fixture, { status: 'ready' });

    await request(app)
      .post(`/api/work-items/${first.id}/relationships`)
      .set(fixture.headers)
      .send({
        relationshipType: 'depends_on',
        targetWorkItemId: second.id
      })
      .expect(400)
      .expect(({ body }) => {
        expect(body.error.code).toBe('VALIDATION_ERROR');
      });

    await request(app)
      .post(`/api/work-items/${first.id}/relationships`)
      .set(fixture.headers)
      .send({
        relationshipType: 'blocks',
        targetWorkItemId: first.id
      })
      .expect(400)
      .expect(({ body }) => {
        expect(body.error).toMatchObject({
          code: 'VALIDATION_ERROR',
          message: 'Cannot relate a work item to itself.'
        });
      });

    await request(app)
      .post(`/api/work-items/${first.id}/relationships`)
      .set(fixture.headers)
      .send({
        relationshipType: 'blocks',
        targetWorkItemId: second.id
      })
      .expect(201);
    await request(app)
      .post(`/api/work-items/${second.id}/relationships`)
      .set(fixture.headers)
      .send({
        relationshipType: 'blocks',
        targetWorkItemId: third.id
      })
      .expect(201);

    await request(app)
      .post(`/api/work-items/${first.id}/relationships`)
      .set(fixture.headers)
      .send({
        relationshipType: 'blocks',
        targetWorkItemId: second.id
      })
      .expect(409)
      .expect(({ body }) => {
        expect(body.error).toMatchObject({
          code: 'CONFLICT',
          message: 'That relationship already exists.'
        });
      });

    await request(app)
      .post(`/api/work-items/${third.id}/relationships`)
      .set(fixture.headers)
      .send({
        relationshipType: 'blocks',
        targetWorkItemId: first.id
      })
      .expect(400)
      .expect(({ body }) => {
        expect(body.error).toMatchObject({
          code: 'VALIDATION_ERROR',
          message: 'This relationship would create a blocking cycle.'
        });
      });

    await request(app)
      .delete(`/api/work-items/${first.id}/relationships/${randomUUID()}`)
      .set(fixture.headers)
      .expect(404)
      .expect(({ body }) => {
        expect(body.error).toMatchObject({
          code: 'NOT_FOUND',
          message: 'Relationship not found.'
        });
      });
  });

  it('rejects relationship writes under archived projects and for unauthorized contributors', async () => {
    const fixture = await createFixture('owner');
    const source = await createWorkItem(fixture);
    const archivedProject = await createProject(fixture, {
      key: 'ARCH',
      status: 'archived'
    });
    const archivedTarget = await createWorkItem(fixture, {
      projectId: archivedProject.id
    });

    await request(app)
      .post(`/api/work-items/${source.id}/relationships`)
      .set(fixture.headers)
      .send({
        relationshipType: 'blocks',
        targetWorkItemId: archivedTarget.id
      })
      .expect(409)
      .expect(({ body }) => {
        expect(body.error).toMatchObject({
          code: 'CONFLICT',
          message: 'Relationships cannot be changed for archived projects.'
        });
      });

    const contributorFixture = await createFixture('contributor');
    const actorAssigned = await createWorkItem(contributorFixture, {
      assigneeId: contributorFixture.actorId
    });
    const otherAssigned = await createWorkItem(contributorFixture, {
      assigneeId: contributorFixture.maintainerId
    });
    const target = await createWorkItem(contributorFixture);

    await request(app)
      .post(`/api/work-items/${actorAssigned.id}/relationships`)
      .set(contributorFixture.headers)
      .send({
        relationshipType: 'blocks',
        targetWorkItemId: target.id
      })
      .expect(201);

    await request(app)
      .post(`/api/work-items/${otherAssigned.id}/relationships`)
      .set(contributorFixture.headers)
      .send({
        relationshipType: 'blocks',
        targetWorkItemId: target.id
      })
      .expect(403)
      .expect(({ body }) => {
        expect(body.error).toMatchObject({
          code: 'FORBIDDEN',
          message: 'You do not have permission to update this work item.'
        });
      });
  });

  it('updates editable fields and records activity', async () => {
    const fixture = await createFixture('owner');
    const workItem = await createWorkItem(fixture, {
      title: 'Before title',
      description: 'Before description.',
      priority: 'medium',
      assigneeId: fixture.contributorId
    });
    await repositories.labels.replaceForWorkItem(workItem.id, [fixture.frontendLabelId]);

    await request(app)
      .patch(`/api/work-items/${workItem.id}`)
      .set(fixture.headers)
      .send({
        title: 'After title',
        description: 'After description.',
        priority: 'urgent',
        assigneeId: fixture.maintainerId,
        labelIds: [fixture.backendLabelId],
        dueDate: '2026-07-20',
        estimatePoints: 8
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          id: workItem.id,
          title: 'After title',
          description: 'After description.',
          priority: 'urgent',
          assignee: { id: fixture.maintainerId },
          labels: [{ id: fixture.backendLabelId }],
          dueDate: '2026-07-20',
          estimatePoints: 8
        });
      });

    const activity = await repositories.activityEvents.findByWorkItem(workItem.id);
    expect(activity.map((event) => event.eventType)).toEqual(
      expect.arrayContaining([
        'work_item.title_changed',
        'work_item.description_changed',
        'work_item.priority_changed',
        'work_item.assignee_changed',
        'work_item.label_added',
        'work_item.label_removed'
      ])
    );
    await expect(repositories.workItemWatchers.listActiveMemberIdsByWorkItem(workItem.id)).resolves.toEqual(
      expect.arrayContaining([fixture.maintainerId])
    );
    await expect(
      repositories.notifications.listByRecipient({
        workspaceId: fixture.workspaceId,
        recipientMemberId: fixture.maintainerId,
        state: 'all'
      })
    ).resolves.toEqual([
      expect.objectContaining({
        notificationType: 'assignment',
        workItemId: workItem.id,
        summary: 'WI-1 was assigned to you.'
      })
    ]);
  });

  it('rejects work item updates to inactive assignees', async () => {
    const fixture = await createFixture('owner');
    const workItem = await createWorkItem(fixture);

    await request(app)
      .patch(`/api/work-items/${workItem.id}`)
      .set(fixture.headers)
      .send({ assigneeId: fixture.inactiveMemberId })
      .expect(400)
      .expect(({ body }) => {
        expect(body.error).toEqual({
          code: 'VALIDATION_ERROR',
          message: 'Assignee must be an active workspace member.'
        });
      });

    const unchanged = await repositories.workItems.findById(workItem.id);
    expect(unchanged?.assigneeId).toBe(fixture.contributorId);
  });

  it('preserves existing inactive assignees and exposes inactive member state', async () => {
    const fixture = await createFixture('owner');
    const workItem = await createWorkItem(fixture, {
      assigneeId: fixture.inactiveMemberId,
      title: 'Historically assigned item'
    });

    await request(app)
      .get(`/api/work-items/${workItem.id}`)
      .set(fixture.headers)
      .expect(200)
      .expect(({ body }) => {
        expect(body.assignee).toMatchObject({
          id: fixture.inactiveMemberId,
          isActive: false,
          deactivatedAt: '2026-06-28T12:00:00.000Z'
        });
        expect(body.reporter).toMatchObject({
          id: fixture.actorId,
          isActive: true
        });
      });

    await request(app)
      .get(`/api/projects/${fixture.projectId}/work-items`)
      .query({ assigneeId: fixture.inactiveMemberId })
      .set(fixture.headers)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toHaveLength(1);
        expect(body[0]).toMatchObject({
          id: workItem.id,
          assignee: {
            id: fixture.inactiveMemberId,
            isActive: false
          }
        });
      });

    await request(app)
      .patch(`/api/work-items/${workItem.id}`)
      .set(fixture.headers)
      .send({ title: 'Historically assigned item updated' })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          title: 'Historically assigned item updated',
          assignee: {
            id: fixture.inactiveMemberId,
            isActive: false
          }
        });
      });

    await request(app)
      .patch(`/api/work-items/${workItem.id}`)
      .set(fixture.headers)
      .send({ assigneeId: fixture.inactiveMemberId })
      .expect(200)
      .expect(({ body }) => {
        expect(body.assignee).toMatchObject({
          id: fixture.inactiveMemberId,
          isActive: false
        });
      });
  });

  it('updates and clears milestone assignment with activity', async () => {
    const fixture = await createFixture('owner');
    const milestone = await createMilestone(fixture);
    const workItem = await createWorkItem(fixture);

    await request(app)
      .patch(`/api/work-items/${workItem.id}`)
      .set(fixture.headers)
      .send({ milestoneId: milestone.id })
      .expect(200)
      .expect(({ body }) => {
        expect(body.milestone).toMatchObject({ id: milestone.id, name: 'v0.0.3' });
      });

    await request(app)
      .patch(`/api/work-items/${workItem.id}`)
      .set(fixture.headers)
      .send({ milestoneId: null })
      .expect(200)
      .expect(({ body }) => {
        expect(body.milestone).toBeNull();
      });

    const activity = await repositories.activityEvents.findByWorkItem(workItem.id);
    expect(activity.map((event) => event.eventType)).toEqual([
      'work_item.milestone_changed',
      'work_item.milestone_changed'
    ]);
  });

  it('updates and clears cycle assignment with activity', async () => {
    const fixture = await createFixture('owner');
    const cycle = await createProjectCycle(fixture);
    const workItem = await createWorkItem(fixture);

    await request(app)
      .patch(`/api/work-items/${workItem.id}`)
      .set(fixture.headers)
      .send({ cycleId: cycle.id })
      .expect(200)
      .expect(({ body }) => {
        expect(body.cycle).toMatchObject({ id: cycle.id, name: 'Cycle 1' });
      });

    await request(app)
      .patch(`/api/work-items/${workItem.id}`)
      .set(fixture.headers)
      .send({ cycleId: null })
      .expect(200)
      .expect(({ body }) => {
        expect(body.cycle).toBeNull();
      });

    const activity = await repositories.activityEvents.findByWorkItem(workItem.id);
    expect(activity.map((event) => event.eventType)).toEqual([
      'work_item.cycle_changed',
      'work_item.cycle_changed'
    ]);
  });

  it('rejects archived milestone assignment but allows clearing an archived assignment', async () => {
    const fixture = await createFixture('owner');
    const archivedMilestone = await createMilestone(fixture, {
      archivedAt: now(),
      archivedById: fixture.actorId
    });
    const workItem = await createWorkItem(fixture, {
      milestoneId: archivedMilestone.id
    });

    await request(app)
      .post(`/api/projects/${fixture.projectId}/work-items`)
      .set(fixture.headers)
      .send({
        title: 'Rejected archived milestone assignment',
        type: 'task',
        priority: 'medium',
        milestoneId: archivedMilestone.id
      })
      .expect(400)
      .expect(({ body }) => {
        expect(body.error.code).toBe('VALIDATION_ERROR');
      });

    await request(app)
      .patch(`/api/work-items/${workItem.id}`)
      .set(fixture.headers)
      .send({ milestoneId: archivedMilestone.id })
      .expect(200)
      .expect(({ body }) => {
        expect(body.milestone).toMatchObject({ id: archivedMilestone.id, isArchived: true });
      });

    await request(app)
      .patch(`/api/work-items/${workItem.id}`)
      .set(fixture.headers)
      .send({ milestoneId: null })
      .expect(200)
      .expect(({ body }) => {
        expect(body.milestone).toBeNull();
      });
  });

  it('rejects archived cycle assignment but allows clearing an archived assignment', async () => {
    const fixture = await createFixture('owner');
    const archivedCycle = await createProjectCycle(fixture, {
      archivedAt: now(),
      archivedById: fixture.actorId
    });
    const workItem = await createWorkItem(fixture, {
      cycleId: archivedCycle.id
    });

    await request(app)
      .post(`/api/projects/${fixture.projectId}/work-items`)
      .set(fixture.headers)
      .send({
        title: 'Rejected archived cycle assignment',
        type: 'task',
        priority: 'medium',
        cycleId: archivedCycle.id
      })
      .expect(400)
      .expect(({ body }) => {
        expect(body.error.code).toBe('VALIDATION_ERROR');
      });

    await request(app)
      .patch(`/api/work-items/${workItem.id}`)
      .set(fixture.headers)
      .send({ cycleId: archivedCycle.id })
      .expect(200)
      .expect(({ body }) => {
        expect(body.cycle).toMatchObject({ id: archivedCycle.id, isArchived: true });
      });

    await request(app)
      .patch(`/api/work-items/${workItem.id}`)
      .set(fixture.headers)
      .send({ cycleId: null })
      .expect(200)
      .expect(({ body }) => {
        expect(body.cycle).toBeNull();
      });
  });

  it('rejects cross-project cycle assignment', async () => {
    const fixture = await createFixture('owner');
    const otherProject = await createProject(fixture);
    const otherProjectCycle = await createProjectCycle(fixture, {
      projectId: otherProject.id
    });
    const workItem = await createWorkItem(fixture);

    await request(app)
      .post(`/api/projects/${fixture.projectId}/work-items`)
      .set(fixture.headers)
      .send({
        title: 'Rejected cross-project cycle assignment',
        type: 'task',
        priority: 'medium',
        cycleId: otherProjectCycle.id
      })
      .expect(400)
      .expect(({ body }) => {
        expect(body.error).toMatchObject({
          code: 'VALIDATION_ERROR',
          message: 'Cycle is invalid for this project.'
        });
      });

    await request(app)
      .patch(`/api/work-items/${workItem.id}`)
      .set(fixture.headers)
      .send({ cycleId: otherProjectCycle.id })
      .expect(400)
      .expect(({ body }) => {
        expect(body.error).toMatchObject({
          code: 'VALIDATION_ERROR',
          message: 'Cycle is invalid for this project.'
        });
      });
  });

  it('rejects work item updates and label assignment under archived projects', async () => {
    const fixture = await createFixture('owner');
    const workItem = await createWorkItem(fixture);
    await repositories.projects.update(fixture.projectId, {
      status: 'archived',
      updatedAt: now()
    });

    await request(app)
      .patch(`/api/work-items/${workItem.id}`)
      .set(fixture.headers)
      .send({
        title: 'Should not update',
        labelIds: [fixture.backendLabelId]
      })
      .expect(409)
      .expect(({ body }) => {
        expect(body.error.code).toBe('CONFLICT');
        expect(body.error.message).toBe('Archived projects are read-only.');
      });

    const updated = await repositories.workItems.findById(workItem.id);
    expect(updated?.title).toBe('Existing work item');
    expect(await repositories.labels.listByWorkItem(workItem.id)).toHaveLength(0);
  });

  it('transitions work item status and records status activity', async () => {
    const fixture = await createFixture('maintainer');
    const workItem = await createWorkItem(fixture, { status: 'ready' });
    await repositories.workItemWatchers.watch({
      id: randomUUID(),
      workspaceId: fixture.workspaceId,
      workItemId: workItem.id,
      memberId: fixture.contributorId,
      watchedAt: now(),
      unwatchedAt: null,
      createdAt: now(),
      updatedAt: now()
    });
    await repositories.workItemWatchers.watch({
      id: randomUUID(),
      workspaceId: fixture.workspaceId,
      workItemId: workItem.id,
      memberId: fixture.inactiveMemberId,
      watchedAt: now(),
      unwatchedAt: null,
      createdAt: now(),
      updatedAt: now()
    });

    await request(app)
      .post(`/api/work-items/${workItem.id}/transitions`)
      .set(fixture.headers)
      .send({ status: 'in_progress' })
      .expect(200)
      .expect(({ body }) => {
        expect(body.status).toBe('in_progress');
      });

    const activity = await repositories.activityEvents.findByWorkItem(workItem.id);
    expect(activity[0]?.eventType).toBe('work_item.status_changed');
    await expect(
      repositories.notifications.listByRecipient({
        workspaceId: fixture.workspaceId,
        recipientMemberId: fixture.contributorId,
        state: 'all'
      })
    ).resolves.toEqual([
      expect.objectContaining({
        notificationType: 'watched_status_change',
        workItemId: workItem.id,
        metadata: { previousStatus: 'ready', status: 'in_progress' }
      })
    ]);
    await expect(
      repositories.notifications.listByRecipient({
        workspaceId: fixture.workspaceId,
        recipientMemberId: fixture.inactiveMemberId,
        state: 'all'
      })
    ).resolves.toEqual([]);
  });

  it('positions status-menu transitions at the top of the destination status', async () => {
    const fixture = await createFixture('maintainer');
    const existingReady = await createWorkItem(fixture, {
      status: 'ready',
      boardPosition: 1024
    });
    const backlog = await createWorkItem(fixture, {
      status: 'backlog',
      boardPosition: 1024
    });

    await request(app)
      .post(`/api/work-items/${backlog.id}/transitions`)
      .set(fixture.headers)
      .send({ status: 'ready' })
      .expect(200)
      .expect(({ body }) => {
        expect(body.status).toBe('ready');
        expect(body.boardPosition).toBe(0);
      });

    await request(app)
      .get(`/api/projects/${fixture.projectId}/work-items`)
      .query({ status: 'ready', sort: 'board_order' })
      .set(fixture.headers)
      .expect(200)
      .expect(({ body }) => {
        expect(body.map((item: { id: string }) => item.id)).toEqual([backlog.id, existingReady.id]);
      });
  });

  it('reorders work items within a board column without activity', async () => {
    const fixture = await createFixture('maintainer');
    const first = await createWorkItem(fixture, {
      title: 'First ready card',
      status: 'ready',
      boardPosition: 1024
    });
    const second = await createWorkItem(fixture, {
      title: 'Second ready card',
      status: 'ready',
      boardPosition: 2048
    });
    const third = await createWorkItem(fixture, {
      title: 'Third ready card',
      status: 'ready',
      boardPosition: 3072
    });

    await request(app)
      .post(`/api/work-items/${third.id}/board-move`)
      .set(fixture.headers)
      .send({
        status: 'ready',
        beforeWorkItemId: first.id,
        afterWorkItemId: second.id
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.status).toBe('ready');
        expect(body.boardPosition).toBe(1536);
      });

    await request(app)
      .get(`/api/projects/${fixture.projectId}/work-items`)
      .query({ status: 'ready', sort: 'board_order' })
      .set(fixture.headers)
      .expect(200)
      .expect(({ body }) => {
        expect(body.map((item: { id: string }) => item.id)).toEqual([
          first.id,
          third.id,
          second.id
        ]);
      });

    expect(await repositories.activityEvents.findByWorkItem(third.id)).toHaveLength(0);
  });

  it('moves work items between board columns and records one status activity', async () => {
    const fixture = await createFixture('maintainer');
    const first = await createWorkItem(fixture, { status: 'ready', boardPosition: 1024 });
    const second = await createWorkItem(fixture, { status: 'ready', boardPosition: 2048 });
    const backlog = await createWorkItem(fixture, { status: 'backlog', boardPosition: 1024 });

    await request(app)
      .post(`/api/work-items/${backlog.id}/board-move`)
      .set(fixture.headers)
      .send({
        status: 'ready',
        beforeWorkItemId: first.id,
        afterWorkItemId: second.id
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.status).toBe('ready');
        expect(body.boardPosition).toBe(1536);
      });

    const activity = await repositories.activityEvents.findByWorkItem(backlog.id);
    expect(activity.map((event) => event.eventType)).toEqual(['work_item.status_changed']);
  });

  it('rejects stale board move neighbors', async () => {
    const fixture = await createFixture('maintainer');
    const first = await createWorkItem(fixture, { status: 'ready', boardPosition: 1024 });
    await createWorkItem(fixture, { status: 'ready', boardPosition: 2048 });
    const third = await createWorkItem(fixture, { status: 'ready', boardPosition: 3072 });
    const backlog = await createWorkItem(fixture, { status: 'backlog', boardPosition: 1024 });

    await request(app)
      .post(`/api/work-items/${backlog.id}/board-move`)
      .set(fixture.headers)
      .send({
        status: 'ready',
        beforeWorkItemId: first.id,
        afterWorkItemId: third.id
      })
      .expect(400)
      .expect(({ body }) => {
        expect(body.error.code).toBe('VALIDATION_ERROR');
      });
  });

  it('compacts board positions when no rank gap exists', async () => {
    const fixture = await createFixture('maintainer');
    const first = await createWorkItem(fixture, { status: 'ready', boardPosition: 1024 });
    const second = await createWorkItem(fixture, { status: 'ready', boardPosition: 1025 });
    const backlog = await createWorkItem(fixture, { status: 'backlog', boardPosition: 1024 });

    await request(app)
      .post(`/api/work-items/${backlog.id}/board-move`)
      .set(fixture.headers)
      .send({
        status: 'ready',
        beforeWorkItemId: first.id,
        afterWorkItemId: second.id
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.status).toBe('ready');
        expect(body.boardPosition).toBe(1536);
      });

    await request(app)
      .get(`/api/projects/${fixture.projectId}/work-items`)
      .query({ status: 'ready', sort: 'board_order' })
      .set(fixture.headers)
      .expect(200)
      .expect(({ body }) => {
        expect(body.map((item: { id: string; boardPosition: number }) => [item.id, item.boardPosition]))
          .toEqual([
            [first.id, 1024],
            [backlog.id, 1536],
            [second.id, 2048]
          ]);
      });
  });

  it('rejects invalid board move transitions', async () => {
    const fixture = await createFixture('contributor');
    const done = await createWorkItem(fixture, { status: 'done', boardPosition: 1024 });

    await request(app)
      .post(`/api/work-items/${done.id}/board-move`)
      .set(fixture.headers)
      .send({ status: 'ready' })
      .expect(409)
      .expect(({ body }) => {
        expect(body.error.code).toBe('WORKFLOW_TRANSITION_ERROR');
      });
  });

  it('rejects board moves under archived projects', async () => {
    const fixture = await createFixture('maintainer');
    const workItem = await createWorkItem(fixture, { status: 'ready', boardPosition: 1024 });
    await repositories.projects.update(fixture.projectId, {
      status: 'archived',
      updatedAt: now()
    });

    await request(app)
      .post(`/api/work-items/${workItem.id}/board-move`)
      .set(fixture.headers)
      .send({ status: 'in_progress' })
      .expect(409)
      .expect(({ body }) => {
        expect(body.error.code).toBe('CONFLICT');
        expect(body.error.message).toBe('Archived projects are read-only.');
      });
  });

  it('rejects work item transitions under archived projects', async () => {
    const fixture = await createFixture('maintainer');
    const workItem = await createWorkItem(fixture, { status: 'ready' });
    await repositories.projects.update(fixture.projectId, {
      status: 'archived',
      updatedAt: now()
    });

    await request(app)
      .post(`/api/work-items/${workItem.id}/transitions`)
      .set(fixture.headers)
      .send({ status: 'in_progress' })
      .expect(409)
      .expect(({ body }) => {
        expect(body.error.code).toBe('CONFLICT');
        expect(body.error.message).toBe('Archived projects are read-only.');
      });

    const unchanged = await repositories.workItems.findById(workItem.id);
    expect(unchanged?.status).toBe('ready');
  });

  it('rejects invalid status transitions', async () => {
    const fixture = await createFixture('contributor');
    const workItem = await createWorkItem(fixture, { status: 'done' });

    await request(app)
      .post(`/api/work-items/${workItem.id}/transitions`)
      .set(fixture.headers)
      .send({ status: 'ready' })
      .expect(409)
      .expect(({ body }) => {
        expect(body.error.code).toBe('WORKFLOW_TRANSITION_ERROR');
      });
  });
});
