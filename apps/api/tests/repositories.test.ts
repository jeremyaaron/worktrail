import { randomUUID } from 'node:crypto';

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { createDb, createPool } from '../src/db/client.js';
import { createRepositories, withRepositoriesTransaction, type Repositories } from '../src/repositories/index.js';

const workspaceIds = new Set<string>();
let pool: ReturnType<typeof createPool>;
let db: ReturnType<typeof createDb>;
let repositories: Repositories;

function now() {
  return new Date('2026-07-03T12:00:00.000Z');
}

function ids() {
  const workspaceId = randomUUID();
  workspaceIds.add(workspaceId);

  return {
    workspaceId,
    ownerId: randomUUID(),
    contributorId: randomUUID(),
    projectId: randomUUID(),
    labelId: randomUUID(),
    workItemId: randomUUID(),
    commentId: randomUUID(),
    activityEventId: randomUUID()
  };
}

async function cleanupWorkspace(workspaceId: string) {
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

async function createRepositoryGraph(repos: Repositories, id = ids()) {
  const timestamp = now();

  const workspace = await repos.workspaces.create({
    id: id.workspaceId,
    name: 'Repository Test Workspace',
    createdAt: timestamp,
    updatedAt: timestamp
  });

  const owner = await repos.members.create({
    id: id.ownerId,
    workspaceId: id.workspaceId,
    name: 'Repository Owner',
    email: `${id.ownerId}@example.com`,
    role: 'owner',
    isActive: true,
    createdAt: timestamp,
    updatedAt: timestamp
  });

  const contributor = await repos.members.create({
    id: id.contributorId,
    workspaceId: id.workspaceId,
    name: 'Repository Contributor',
    email: `${id.contributorId}@example.com`,
    role: 'contributor',
    isActive: true,
    createdAt: timestamp,
    updatedAt: timestamp
  });

  const project = await repos.projects.create({
    id: id.projectId,
    workspaceId: id.workspaceId,
    key: 'RT',
    nextWorkItemNumber: 2,
    name: 'Repository Project',
    description: 'Repository integration test project.',
    status: 'active',
    createdAt: timestamp,
    updatedAt: timestamp
  });

  const label = await repos.labels.create({
    id: id.labelId,
    workspaceId: id.workspaceId,
    projectId: id.projectId,
    name: 'backend',
    color: '#059669',
    createdAt: timestamp,
    updatedAt: timestamp
  });

  const workItem = await repos.workItems.create({
    id: id.workItemId,
    workspaceId: id.workspaceId,
    projectId: id.projectId,
    itemNumber: 1,
    displayKey: 'RT-1',
    title: 'Repository work item',
    description: 'Created by repository tests.',
    type: 'task',
    status: 'ready',
    priority: 'high',
    assigneeId: id.contributorId,
    reporterId: id.ownerId,
    dueDate: '2026-07-10',
    estimatePoints: 5,
    createdAt: timestamp,
    updatedAt: timestamp
  });

  const comment = await repos.comments.create({
    id: id.commentId,
    workspaceId: id.workspaceId,
    projectId: id.projectId,
    workItemId: id.workItemId,
    authorId: id.ownerId,
    body: 'Repository comment',
    editedAt: null,
    deletedAt: null,
    deletedById: null,
    createdAt: timestamp,
    updatedAt: timestamp
  });

  const activityEvent = await repos.activityEvents.create({
    id: id.activityEventId,
    workspaceId: id.workspaceId,
    projectId: id.projectId,
    workItemId: id.workItemId,
    actorId: id.ownerId,
    eventType: 'work_item.created',
    summary: 'Repository Owner created this work item.',
    previousValue: null,
    newValue: { status: 'ready' },
    metadata: {},
    createdAt: timestamp
  });

  return {
    id,
    workspace,
    owner,
    contributor,
    project,
    label,
    workItem,
    comment,
    activityEvent
  };
}

async function createRepositoryWorkItem(
  repos: Repositories,
  graph: Awaited<ReturnType<typeof createRepositoryGraph>>,
  input: {
    id?: string;
    itemNumber: number;
    status?: 'backlog' | 'ready' | 'in_progress' | 'blocked' | 'done' | 'canceled';
    title?: string;
  }
) {
  const timestamp = now();

  return repos.workItems.create({
    id: input.id ?? randomUUID(),
    workspaceId: graph.id.workspaceId,
    projectId: graph.id.projectId,
    itemNumber: input.itemNumber,
    displayKey: `RT-${input.itemNumber}`,
    title: input.title ?? `Repository work item ${input.itemNumber}`,
    description: 'Created by repository relationship tests.',
    type: 'task',
    status: input.status ?? 'ready',
    priority: 'medium',
    assigneeId: graph.id.contributorId,
    reporterId: graph.id.ownerId,
    dueDate: null,
    estimatePoints: null,
    createdAt: timestamp,
    updatedAt: timestamp
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

describe('Drizzle repositories', () => {
  it('creates and reads projects, members, labels, work items, comments, and activity', async () => {
    const graph = await createRepositoryGraph(repositories);

    await expect(repositories.workspaces.findById(graph.id.workspaceId)).resolves.toMatchObject({
      id: graph.id.workspaceId,
      name: 'Repository Test Workspace'
    });
    await expect(repositories.members.findById(graph.id.ownerId)).resolves.toMatchObject({
      id: graph.id.ownerId,
      role: 'owner'
    });
    await expect(repositories.projects.findById(graph.id.projectId)).resolves.toMatchObject({
      id: graph.id.projectId,
      status: 'active'
    });
    await expect(repositories.labels.findById(graph.id.labelId)).resolves.toMatchObject({
      id: graph.id.labelId,
      name: 'backend'
    });
    await expect(repositories.workItems.findById(graph.id.workItemId)).resolves.toMatchObject({
      id: graph.id.workItemId,
      status: 'ready'
    });

    const comments = await repositories.comments.findByWorkItem(graph.id.workItemId);
    expect(comments).toHaveLength(1);
    expect(comments[0]?.body).toBe('Repository comment');

    const activity = await repositories.activityEvents.findByWorkItem(graph.id.workItemId);
    expect(activity).toHaveLength(1);
    expect(activity[0]?.eventType).toBe('work_item.created');
  });

  it('filters work items by status, assignee, type, priority, and title search', async () => {
    const graph = await createRepositoryGraph(repositories);

    await expect(
      repositories.workItems.listByProject(graph.id.projectId, {
        status: 'ready',
        assigneeId: graph.id.contributorId,
        type: 'task',
        priority: 'high',
        search: 'repository'
      })
    ).resolves.toHaveLength(1);

    await expect(
      repositories.workItems.listByProject(graph.id.projectId, {
        status: 'blocked'
      })
    ).resolves.toHaveLength(0);
  });

  it('updates project and work item statuses', async () => {
    const graph = await createRepositoryGraph(repositories);
    const updatedAt = new Date('2026-07-04T12:00:00.000Z');

    await expect(repositories.projects.updateStatus(graph.id.projectId, 'archived', updatedAt)).resolves.toMatchObject({
      id: graph.id.projectId,
      status: 'archived'
    });
    await expect(repositories.workItems.updateStatus(graph.id.workItemId, 'in_progress', updatedAt)).resolves.toMatchObject({
      id: graph.id.workItemId,
      status: 'in_progress'
    });
  });

  it('binds repositories to a transaction', async () => {
    const id = ids();
    const graph = await withRepositoriesTransaction(db, async (transactionRepositories) =>
      createRepositoryGraph(transactionRepositories, id)
    );

    expect(graph.workspace.id).toBe(id.workspaceId);
    await expect(repositories.workItems.findById(id.workItemId)).resolves.toMatchObject({
      id: id.workItemId,
      title: 'Repository work item'
    });
  });

  it('creates, finds, lists, and deletes work item relationships', async () => {
    const graph = await createRepositoryGraph(repositories);
    const target = await createRepositoryWorkItem(repositories, graph, { itemNumber: 2 });
    const createdAt = now();

    const relationship = await repositories.workItemRelationships.create({
      id: randomUUID(),
      workspaceId: graph.id.workspaceId,
      relationshipType: 'blocks',
      sourceWorkItemId: graph.id.workItemId,
      targetWorkItemId: target.id,
      createdById: graph.id.ownerId,
      createdAt
    });

    expect(relationship).toMatchObject({
      workspaceId: graph.id.workspaceId,
      relationshipType: 'blocks',
      sourceWorkItemId: graph.id.workItemId,
      targetWorkItemId: target.id,
      createdById: graph.id.ownerId
    });

    await expect(repositories.workItemRelationships.findById(relationship.id)).resolves.toMatchObject({
      id: relationship.id
    });

    await expect(
      repositories.workItemRelationships.findBetween({
        workspaceId: graph.id.workspaceId,
        relationshipType: 'blocks',
        sourceWorkItemId: graph.id.workItemId,
        targetWorkItemId: target.id
      })
    ).resolves.toMatchObject({ id: relationship.id });

    await expect(repositories.workItemRelationships.listForWorkItem(graph.id.workItemId)).resolves.toHaveLength(1);
    await expect(repositories.workItemRelationships.listForWorkItem(target.id)).resolves.toHaveLength(1);
    await expect(
      repositories.workItemRelationships.listForWorkItems([graph.id.workItemId, target.id])
    ).resolves.toHaveLength(1);

    await expect(repositories.workItemRelationships.delete(relationship.id)).resolves.toMatchObject({
      id: relationship.id
    });
    await expect(repositories.workItemRelationships.findById(relationship.id)).resolves.toBeNull();
  });

  it('supports canonical related-work duplicate lookup', async () => {
    const graph = await createRepositoryGraph(repositories);
    const target = await createRepositoryWorkItem(repositories, graph, { itemNumber: 2 });
    const [sourceWorkItemId, targetWorkItemId] = [graph.id.workItemId, target.id].sort();

    const relationship = await repositories.workItemRelationships.create({
      id: randomUUID(),
      workspaceId: graph.id.workspaceId,
      relationshipType: 'relates_to',
      sourceWorkItemId,
      targetWorkItemId,
      createdById: graph.id.ownerId,
      createdAt: now()
    });

    await expect(
      repositories.workItemRelationships.findBetween({
        workspaceId: graph.id.workspaceId,
        relationshipType: 'relates_to',
        sourceWorkItemId,
        targetWorkItemId
      })
    ).resolves.toMatchObject({ id: relationship.id });
  });

  it('detects direct and multi-hop blocking cycles', async () => {
    const graph = await createRepositoryGraph(repositories);
    const second = await createRepositoryWorkItem(repositories, graph, { itemNumber: 2 });
    const third = await createRepositoryWorkItem(repositories, graph, { itemNumber: 3 });
    const fourth = await createRepositoryWorkItem(repositories, graph, { itemNumber: 4 });

    await repositories.workItemRelationships.create({
      id: randomUUID(),
      workspaceId: graph.id.workspaceId,
      relationshipType: 'blocks',
      sourceWorkItemId: graph.id.workItemId,
      targetWorkItemId: second.id,
      createdById: graph.id.ownerId,
      createdAt: now()
    });
    await repositories.workItemRelationships.create({
      id: randomUUID(),
      workspaceId: graph.id.workspaceId,
      relationshipType: 'blocks',
      sourceWorkItemId: second.id,
      targetWorkItemId: third.id,
      createdById: graph.id.ownerId,
      createdAt: now()
    });

    await expect(
      repositories.workItemRelationships.wouldCreateBlockingCycle({
        workspaceId: graph.id.workspaceId,
        sourceWorkItemId: second.id,
        targetWorkItemId: graph.id.workItemId
      })
    ).resolves.toBe(true);

    await expect(
      repositories.workItemRelationships.wouldCreateBlockingCycle({
        workspaceId: graph.id.workspaceId,
        sourceWorkItemId: third.id,
        targetWorkItemId: graph.id.workItemId
      })
    ).resolves.toBe(true);

    await expect(
      repositories.workItemRelationships.wouldCreateBlockingCycle({
        workspaceId: graph.id.workspaceId,
        sourceWorkItemId: third.id,
        targetWorkItemId: fourth.id
      })
    ).resolves.toBe(false);
  });

  it('aggregates open blocker and open blocked-work counts', async () => {
    const graph = await createRepositoryGraph(repositories);
    const openBlocker = await createRepositoryWorkItem(repositories, graph, {
      itemNumber: 2,
      status: 'in_progress'
    });
    const terminalBlocker = await createRepositoryWorkItem(repositories, graph, {
      itemNumber: 3,
      status: 'done'
    });
    const openDownstream = await createRepositoryWorkItem(repositories, graph, {
      itemNumber: 4,
      status: 'blocked'
    });
    const terminalDownstream = await createRepositoryWorkItem(repositories, graph, {
      itemNumber: 5,
      status: 'canceled'
    });

    for (const relationship of [
      {
        sourceWorkItemId: openBlocker.id,
        targetWorkItemId: graph.id.workItemId
      },
      {
        sourceWorkItemId: terminalBlocker.id,
        targetWorkItemId: graph.id.workItemId
      },
      {
        sourceWorkItemId: graph.id.workItemId,
        targetWorkItemId: openDownstream.id
      },
      {
        sourceWorkItemId: graph.id.workItemId,
        targetWorkItemId: terminalDownstream.id
      }
    ]) {
      await repositories.workItemRelationships.create({
        id: randomUUID(),
        workspaceId: graph.id.workspaceId,
        relationshipType: 'blocks',
        sourceWorkItemId: relationship.sourceWorkItemId,
        targetWorkItemId: relationship.targetWorkItemId,
        createdById: graph.id.ownerId,
        createdAt: now()
      });
    }

    const counts = await repositories.workItemRelationships.listDependencyCounts([
      graph.id.workItemId,
      openDownstream.id,
      terminalDownstream.id
    ]);

    expect(counts.get(graph.id.workItemId)).toEqual({
      workItemId: graph.id.workItemId,
      openBlockerCount: 1,
      openBlockedWorkCount: 1
    });
    expect(counts.get(openDownstream.id)).toEqual({
      workItemId: openDownstream.id,
      openBlockerCount: 1,
      openBlockedWorkCount: 0
    });
    expect(counts.get(terminalDownstream.id)).toEqual({
      workItemId: terminalDownstream.id,
      openBlockerCount: 1,
      openBlockedWorkCount: 0
    });
    await expect(repositories.workItemRelationships.listDependencyCounts([])).resolves.toEqual(new Map());
  });
});
