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

function actorHeaders(input: { workspaceId: string; memberId: string; role: string }) {
  return {
    'x-worktrail-workspace-id': input.workspaceId,
    'x-worktrail-member-id': input.memberId,
    'x-worktrail-role': input.role
  };
}

async function cleanupWorkspace(workspaceId: string) {
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

describe('work item API', () => {
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

  it('supports workspace work item filters, search, labels, and sorts', async () => {
    const fixture = await createFixture('owner');
    const milestone = await createMilestone(fixture);
    const urgent = await createWorkItem(fixture, {
      title: 'Needle urgent backend work',
      priority: 'urgent',
      status: 'blocked',
      milestoneId: milestone.id,
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
          milestone: { id: milestone.id }
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

  it('searches and filters by milestone, reporter, due date state, and board order', async () => {
    const fixture = await createFixture('owner');
    const milestone = await createMilestone(fixture);
    const dueSoon = await createWorkItem(fixture, {
      title: 'Launch checklist',
      description: 'Contains a planning keyword.',
      status: 'ready',
      reporterId: fixture.actorId,
      milestoneId: milestone.id,
      dueDate: '2026-07-06',
      boardPosition: 2048
    });
    const overdue = await createWorkItem(fixture, {
      title: 'Overdue board item',
      description: 'Different description.',
      status: 'ready',
      reporterId: fixture.actorId,
      milestoneId: null,
      dueDate: '2026-07-03',
      boardPosition: 1024
    });

    await request(app)
      .get(`/api/projects/${fixture.projectId}/work-items`)
      .query({
        milestoneId: milestone.id,
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
          dueDate: '2026-07-06'
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
