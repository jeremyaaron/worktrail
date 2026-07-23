import { randomUUID } from 'node:crypto';

import type {
  ProjectCycleCloseoutSnapshotDto,
  WorkItemPageSize,
  WorkItemQuery
} from '@worktrail/contracts';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { createDb, createPool } from '../src/db/client.js';
import {
  createRepositories,
  withRepositoriesReadTransaction,
  withRepositoriesTransaction,
  type Repositories
} from '../src/repositories/index.js';

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
  await pool.query('delete from notifications where workspace_id = $1', [workspaceId]);
  await pool.query('delete from comment_mentions where workspace_id = $1', [workspaceId]);
  await pool.query('delete from project_cycle_closeouts where workspace_id = $1', [workspaceId]);
  await pool.query('delete from activity_events where workspace_id = $1', [workspaceId]);
  await pool.query('delete from comments where workspace_id = $1', [workspaceId]);
  await pool.query('delete from work_item_watchers where workspace_id = $1', [workspaceId]);
  await pool.query('delete from work_item_attachments where workspace_id = $1', [workspaceId]);
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
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    parentWorkItemId?: string | null;
    boardPosition?: number;
    estimatePoints?: number | null;
    title?: string;
    description?: string;
    type?: 'task' | 'bug' | 'story' | 'chore';
    assigneeId?: string | null;
    milestoneId?: string | null;
    cycleId?: string | null;
    dueDate?: string | null;
    projectId?: string;
    projectKey?: string;
    updatedAt?: Date;
  }
) {
  const timestamp = now();

  return repos.workItems.create({
    id: input.id ?? randomUUID(),
    workspaceId: graph.id.workspaceId,
    projectId: input.projectId ?? graph.id.projectId,
    itemNumber: input.itemNumber,
    displayKey: `${input.projectKey ?? graph.project.key}-${input.itemNumber}`,
    title: input.title ?? `Repository work item ${input.itemNumber}`,
    description: input.description ?? 'Created by repository relationship tests.',
    type: input.type ?? 'task',
    status: input.status ?? 'ready',
    priority: input.priority ?? 'medium',
    assigneeId: input.assigneeId === undefined ? graph.id.contributorId : input.assigneeId,
    reporterId: graph.id.ownerId,
    milestoneId: input.milestoneId ?? null,
    cycleId: input.cycleId ?? null,
    parentWorkItemId: input.parentWorkItemId ?? null,
    boardPosition: input.boardPosition ?? input.itemNumber * 1024,
    dueDate: input.dueDate ?? null,
    estimatePoints: input.estimatePoints ?? null,
    createdAt: timestamp,
    updatedAt: input.updatedAt ?? timestamp
  });
}

async function createRepositoryAttachment(
  repos: Repositories,
  graph: Awaited<ReturnType<typeof createRepositoryGraph>>,
  input: {
    id?: string;
    workItemId?: string;
    uploaderMemberId?: string;
    fileName?: string;
    mediaType?: string;
    byteSize?: number;
    checksumSha256?: string;
    storageKey?: string;
    createdAt?: Date;
  } = {}
) {
  return repos.workItemAttachments.create({
    id: input.id ?? randomUUID(),
    workspaceId: graph.workspace.id,
    projectId: graph.project.id,
    workItemId: input.workItemId ?? graph.workItem.id,
    uploaderMemberId: input.uploaderMemberId ?? graph.contributor.id,
    fileName: input.fileName ?? 'repository-evidence.txt',
    mediaType: input.mediaType ?? 'text/plain',
    byteSize: input.byteSize ?? 128,
    checksumSha256: input.checksumSha256 ?? 'a'.repeat(64),
    storageKey: input.storageKey ?? randomStorageKey(),
    createdAt: input.createdAt ?? now()
  });
}

function randomStorageKey(): string {
  return `${randomUUID().replaceAll('-', '')}${randomUUID().replaceAll('-', '')}`;
}

async function createRepositoryCycle(
  repos: Repositories,
  graph: Awaited<ReturnType<typeof createRepositoryGraph>>,
  input: {
    id?: string;
    name: string;
    status: 'planned' | 'active' | 'completed' | 'canceled';
    startDate: string;
    endDate: string;
  }
) {
  const timestamp = now();

  return repos.projectCycles.create({
    id: input.id ?? randomUUID(),
    workspaceId: graph.id.workspaceId,
    projectId: graph.id.projectId,
    name: input.name,
    goal: `${input.name} goal.`,
    status: input.status,
    startDate: input.startDate,
    endDate: input.endDate,
    targetPoints: 10,
    archivedAt: null,
    archivedById: null,
    createdAt: timestamp,
    updatedAt: timestamp
  });
}

function createCloseoutSnapshot(input: {
  graph: Awaited<ReturnType<typeof createRepositoryGraph>>;
  sourceCycle: Awaited<ReturnType<typeof createRepositoryCycle>>;
  destinationCycle: Awaited<ReturnType<typeof createRepositoryCycle>>;
}): ProjectCycleCloseoutSnapshotDto {
  return {
    snapshotVersion: 1,
    project: {
      id: input.graph.project.id,
      key: input.graph.project.key,
      name: input.graph.project.name
    },
    cycle: {
      id: input.sourceCycle.id,
      name: input.sourceCycle.name,
      goal: input.sourceCycle.goal,
      status: 'active',
      startDate: input.sourceCycle.startDate,
      endDate: input.sourceCycle.endDate,
      targetPoints: input.sourceCycle.targetPoints
    },
    closedAt: '2026-07-14T16:00:00.000Z',
    closedBy: {
      id: input.graph.owner.id,
      name: input.graph.owner.name
    },
    health: {
      health: 'complete',
      reasons: []
    },
    counts: {
      totalCount: 0,
      completedCount: 0,
      canceledCount: 0,
      unfinishedCount: 0,
      retainedCount: 0,
      movedCount: 0,
      committedEstimatePoints: 0,
      completedEstimatePoints: 0,
      unfinishedEstimatePoints: 0,
      unestimatedUnfinishedCount: 0
    },
    destination: {
      kind: 'cycle',
      cycle: {
        id: input.destinationCycle.id,
        name: input.destinationCycle.name,
        startDate: input.destinationCycle.startDate,
        endDate: input.destinationCycle.endDate
      }
    },
    items: {
      completed: [],
      canceled: [],
      unfinished: []
    }
  };
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

  it('creates, finds, orders, totals, and deletes work item attachments', async () => {
    const graph = await createRepositoryGraph(repositories);
    const older = await createRepositoryAttachment(repositories, graph, {
      fileName: 'duplicate.txt',
      byteSize: 100,
      createdAt: new Date('2026-07-03T10:00:00.000Z')
    });
    const sameTime = new Date('2026-07-03T11:00:00.000Z');
    const firstNewest = await createRepositoryAttachment(repositories, graph, {
      fileName: 'duplicate.txt',
      byteSize: 200,
      createdAt: sameTime
    });
    const secondNewest = await createRepositoryAttachment(repositories, graph, {
      fileName: 'other.txt',
      byteSize: 300,
      createdAt: sameTime
    });

    await expect(repositories.workItemAttachments.findById(firstNewest!.id)).resolves.toMatchObject(
      {
        fileName: 'duplicate.txt',
        byteSize: 200,
        workItemId: graph.workItem.id
      }
    );
    await expect(
      repositories.workItemAttachments.listByWorkItem(graph.workItem.id)
    ).resolves.toEqual([
      ...[firstNewest, secondNewest].sort((left, right) => right!.id.localeCompare(left!.id)),
      older
    ]);
    await expect(
      repositories.workItemAttachments.getUsageByWorkItem(graph.workItem.id)
    ).resolves.toEqual({
      attachmentCount: 3,
      aggregateBytes: 600
    });

    const emptyWorkItem = await createRepositoryWorkItem(repositories, graph, { itemNumber: 2 });
    await expect(
      repositories.workItemAttachments.getUsageByWorkItem(emptyWorkItem!.id)
    ).resolves.toEqual({
      attachmentCount: 0,
      aggregateBytes: 0
    });

    await expect(
      repositories.workItemAttachments.deleteById(firstNewest!.id)
    ).resolves.toMatchObject({
      id: firstNewest!.id,
      storageKey: firstNewest!.storageKey
    });
    await expect(repositories.workItemAttachments.findById(firstNewest!.id)).resolves.toBeNull();
    await expect(repositories.workItemAttachments.deleteById(firstNewest!.id)).resolves.toBeNull();
  });

  it('enforces attachment metadata checks, unique object keys, and restrictive work item deletion', async () => {
    const graph = await createRepositoryGraph(repositories);

    for (const invalid of [
      { input: { byteSize: 0 }, constraint: 'work_item_attachments_byte_size_check' },
      {
        input: { byteSize: 4 * 1024 * 1024 + 1 },
        constraint: 'work_item_attachments_byte_size_check'
      },
      { input: { fileName: '' }, constraint: 'work_item_attachments_file_name_check' },
      { input: { fileName: 'a'.repeat(181) }, constraint: 'work_item_attachments_file_name_check' },
      {
        input: { checksumSha256: 'A'.repeat(64) },
        constraint: 'work_item_attachments_checksum_sha256_check'
      },
      {
        input: { storageKey: '../outside' },
        constraint: 'work_item_attachments_storage_key_check'
      }
    ]) {
      await expect(
        createRepositoryAttachment(repositories, graph, invalid.input)
      ).rejects.toMatchObject({
        cause: { code: '23514', constraint: invalid.constraint }
      });
    }

    const storageKey = randomStorageKey();
    await createRepositoryAttachment(repositories, graph, { storageKey });
    await expect(
      createRepositoryAttachment(repositories, graph, { storageKey })
    ).rejects.toMatchObject({
      cause: { code: '23505', constraint: 'work_item_attachments_storage_key_unique' }
    });
    await expect(
      pool.query('delete from work_items where id = $1', [graph.workItem.id])
    ).rejects.toMatchObject({
      code: '23503',
      constraint: 'work_item_attachments_work_item_id_work_items_id_fk'
    });
  });

  it('locks attachment ownership context and accepts attachment activity values', async () => {
    const graph = await createRepositoryGraph(repositories);
    const attachment = await createRepositoryAttachment(repositories, graph);

    const locked = await withRepositoriesTransaction(db, async (transactionRepositories) => {
      const project = await transactionRepositories.projects.findByIdForShare(graph.project.id);
      const [workItem] = await transactionRepositories.workItems.findManyByIdsForUpdate([
        graph.workItem.id
      ]);
      const attachmentRecord = await transactionRepositories.workItemAttachments.findByIdForUpdate(
        attachment!.id
      );

      return { project, workItem, attachment: attachmentRecord };
    });

    expect(locked).toMatchObject({
      project: { id: graph.project.id },
      workItem: { id: graph.workItem.id },
      attachment: { id: attachment!.id }
    });
    await expect(repositories.projects.findByIdForShare(randomUUID())).resolves.toBeNull();
    await expect(
      repositories.workItemAttachments.findByIdForUpdate(randomUUID())
    ).resolves.toBeNull();

    for (const eventType of [
      'work_item.attachment_uploaded',
      'work_item.attachment_removed'
    ] as const) {
      await expect(
        repositories.activityEvents.create({
          id: randomUUID(),
          workspaceId: graph.workspace.id,
          projectId: graph.project.id,
          workItemId: graph.workItem.id,
          actorId: graph.owner.id,
          eventType,
          summary: `${eventType} repository evidence.`,
          previousValue: null,
          newValue: null,
          metadata: {},
          createdAt: now()
        })
      ).resolves.toMatchObject({ eventType });
    }
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

  it('reads exact project pages across every supported size and keeps board reads complete', async () => {
    const graph = await createRepositoryGraph(repositories);

    await Promise.all(
      Array.from({ length: 112 }, (_, index) =>
        createRepositoryWorkItem(repositories, graph, { itemNumber: index + 2 })
      )
    );

    await expect(
      repositories.workItems.countByProjectQuery(graph.project.id)
    ).resolves.toBe(113);
    await expect(
      repositories.workItems.countByWorkspaceQuery(graph.workspace.id)
    ).resolves.toBe(113);

    for (const pageSize of [10, 25, 50, 100] as const) {
      const page = await repositories.workItems.listPageByProject(
        graph.project.id,
        { sort: 'updated_asc' },
        { limit: pageSize, offset: 0 }
      );
      expect(page).toHaveLength(pageSize);
      expect(page[0]?.itemNumber).toBe(1);
      expect(page.at(-1)?.itemNumber).toBe(pageSize);
    }

    const middle = await repositories.workItems.listPageByProject(
      graph.project.id,
      { sort: 'updated_asc' },
      { limit: 25, offset: 25 }
    );
    const partialFinal = await repositories.workItems.listPageByProject(
      graph.project.id,
      { sort: 'updated_asc' },
      { limit: 50, offset: 100 }
    );
    const empty = await repositories.workItems.listPageByProject(
      graph.project.id,
      { sort: 'updated_asc' },
      { limit: 10, offset: 200 }
    );

    expect(middle.map((item) => item.itemNumber)).toEqual(
      Array.from({ length: 25 }, (_, index) => index + 26)
    );
    expect(partialFinal.map((item) => item.itemNumber)).toEqual(
      Array.from({ length: 13 }, (_, index) => index + 101)
    );
    expect(empty).toEqual([]);

    const workspacePage = await repositories.workItems.listPageByWorkspace(
      graph.workspace.id,
      { sort: 'updated_asc' },
      { limit: 10, offset: 10 }
    );
    expect(workspacePage.map(({ workItem }) => workItem.itemNumber)).toEqual(
      Array.from({ length: 10 }, (_, index) => index + 11)
    );

    const boardItems = await repositories.workItems.listByProjectForBoard(graph.project.id);
    expect(boardItems).toHaveLength(113);
    expect(boardItems.map(({ itemNumber }) => itemNumber)).toEqual(
      Array.from({ length: 113 }, (_, index) => index + 1)
    );
    await expect(
      repositories.workItems.listByProjectForExport(graph.project.id, { sort: 'updated_asc' }, 17)
    ).resolves.toHaveLength(17);
    await expect(
      repositories.workItems.listByWorkspaceForExport(
        graph.workspace.id,
        { sort: 'updated_asc' },
        19
      )
    ).resolves.toHaveLength(19);
  });

  it('applies workspace archive scope identically to counts and rows', async () => {
    const graph = await createRepositoryGraph(repositories);
    const archivedProject = await repositories.projects.create({
      id: randomUUID(),
      workspaceId: graph.workspace.id,
      key: 'AR',
      nextWorkItemNumber: 3,
      name: 'Archived Repository Project',
      description: '',
      status: 'archived',
      createdAt: now(),
      updatedAt: now()
    });

    await createRepositoryWorkItem(repositories, graph, {
      itemNumber: 1,
      projectId: archivedProject.id,
      projectKey: archivedProject.key
    });
    await createRepositoryWorkItem(repositories, graph, {
      itemNumber: 2,
      projectId: archivedProject.id,
      projectKey: archivedProject.key
    });

    const cases = [
      { filters: {}, expectedCount: 1, expectedStatus: 'active' },
      { filters: { archivedProjects: 'include' }, expectedCount: 3, expectedStatus: null },
      { filters: { archivedProjects: 'only' }, expectedCount: 2, expectedStatus: 'archived' }
    ] as const;

    for (const testCase of cases) {
      const count = await repositories.workItems.countByWorkspaceQuery(
        graph.workspace.id,
        testCase.filters
      );
      const rows = await repositories.workItems.listPageByWorkspace(
        graph.workspace.id,
        testCase.filters,
        { limit: 10, offset: 0 }
      );

      expect(count).toBe(testCase.expectedCount);
      expect(rows).toHaveLength(testCase.expectedCount);
      if (testCase.expectedStatus !== null) {
        expect(rows.every(({ project }) => project.status === testCase.expectedStatus)).toBe(true);
      }
    }
  });

  it('keeps project and workspace count/page predicates aligned across filter families', async () => {
    const graph = await createRepositoryGraph(repositories);
    const milestone = await repositories.milestones.create({
      id: randomUUID(),
      workspaceId: graph.workspace.id,
      projectId: graph.project.id,
      name: 'Repository Milestone',
      description: '',
      status: 'active',
      targetDate: '2026-08-01',
      archivedAt: null,
      archivedById: null,
      createdAt: now(),
      updatedAt: now()
    });
    const cycle = await createRepositoryCycle(repositories, graph, {
      name: 'Repository Filter Cycle',
      status: 'active',
      startDate: '2026-07-01',
      endDate: '2026-07-31'
    });

    await repositories.workItems.update(graph.workItem.id, {
      title: 'Paging filter needle',
      type: 'bug',
      milestoneId: milestone.id,
      cycleId: cycle.id,
      updatedAt: now()
    });
    await repositories.labels.replaceForWorkItem(graph.workItem.id, [graph.label.id]);

    const firstChild = await createRepositoryWorkItem(repositories, graph, {
      itemNumber: 2,
      status: 'blocked',
      assigneeId: null,
      parentWorkItemId: graph.workItem.id
    });
    const secondChild = await createRepositoryWorkItem(repositories, graph, {
      itemNumber: 3,
      status: 'blocked',
      assigneeId: null,
      parentWorkItemId: graph.workItem.id
    });
    const stale = await createRepositoryWorkItem(repositories, graph, {
      itemNumber: 4,
      status: 'in_progress',
      assigneeId: null,
      updatedAt: new Date('2020-01-01T00:00:00.000Z')
    });

    for (const child of [firstChild, secondChild]) {
      await repositories.workItemRelationships.create({
        id: randomUUID(),
        workspaceId: graph.workspace.id,
        relationshipType: 'blocks',
        sourceWorkItemId: graph.workItem.id,
        targetWorkItemId: child.id,
        createdById: graph.owner.id,
        createdAt: now()
      });
    }

    const sorted = (ids: string[]) => [...ids].sort((left, right) => left.localeCompare(right));
    const expectQuery = async (filters: WorkItemQuery, expectedIds: string[]) => {
      const projectCount = await repositories.workItems.countByProjectQuery(
        graph.project.id,
        filters
      );
      const projectRows = await repositories.workItems.listPageByProject(
        graph.project.id,
        filters,
        { limit: 100, offset: 0 }
      );
      const workspaceCount = await repositories.workItems.countByWorkspaceQuery(
        graph.workspace.id,
        filters
      );
      const workspaceRows = await repositories.workItems.listPageByWorkspace(
        graph.workspace.id,
        filters,
        { limit: 100, offset: 0 }
      );

      expect(projectCount).toBe(expectedIds.length);
      expect(sorted(projectRows.map(({ id }) => id))).toEqual(sorted(expectedIds));
      expect(workspaceCount).toBe(expectedIds.length);
      expect(sorted(workspaceRows.map(({ workItem }) => workItem.id))).toEqual(sorted(expectedIds));
    };

    await expectQuery({ status: 'ready' }, [graph.workItem.id]);
    await expectQuery({ workState: 'open' }, [
      graph.workItem.id,
      firstChild.id,
      secondChild.id,
      stale.id
    ]);
    await expectQuery({ assigneeId: graph.contributor.id }, [graph.workItem.id]);
    await expectQuery({ assigneeState: 'unassigned' }, [firstChild.id, secondChild.id, stale.id]);
    await expectQuery({ reporterId: graph.owner.id }, [
      graph.workItem.id,
      firstChild.id,
      secondChild.id,
      stale.id
    ]);
    await expectQuery({ type: 'bug' }, [graph.workItem.id]);
    await expectQuery({ priority: 'high' }, [graph.workItem.id]);
    await expectQuery({ labelId: graph.label.id }, [graph.workItem.id]);
    await expectQuery({ milestoneId: milestone.id }, [graph.workItem.id]);
    await expectQuery({ cycleId: cycle.id }, [graph.workItem.id]);
    await expectQuery({ dueDateState: 'overdue' }, [graph.workItem.id]);
    await expectQuery({ blocked: true }, [firstChild.id, secondChild.id]);
    await expectQuery({ dependency: 'dependency_blocked' }, [firstChild.id, secondChild.id]);
    await expectQuery({ dependency: 'blocking_open_work' }, [graph.workItem.id]);
    await expectQuery({ workRisk: 'unassigned_active' }, [stale.id]);
    await expectQuery({ workRisk: 'stale_in_progress' }, [stale.id]);
    await expectQuery({ hierarchy: 'top_level' }, [graph.workItem.id, stale.id]);
    await expectQuery({ hierarchy: 'children' }, [firstChild.id, secondChild.id]);
    await expectQuery({ hierarchy: 'parents' }, [graph.workItem.id]);
    await expectQuery({ parentKey: graph.workItem.displayKey }, [firstChild.id, secondChild.id]);
    await expectQuery({ search: 'filter needle' }, [graph.workItem.id]);
  });

  it('rejects unbounded, unsupported, or malformed repository windows', async () => {
    const graph = await createRepositoryGraph(repositories);

    for (const limit of [0, 20, Number.POSITIVE_INFINITY]) {
      await expect(
        repositories.workItems.listPageByProject(graph.project.id, {}, {
          limit: limit as WorkItemPageSize,
          offset: 0
        })
      ).rejects.toBeInstanceOf(RangeError);
    }
    for (const offset of [-1, 1.5, Number.POSITIVE_INFINITY]) {
      await expect(
        repositories.workItems.listPageByWorkspace(
          graph.workspace.id,
          {},
          { limit: 25, offset }
        )
      ).rejects.toBeInstanceOf(RangeError);
    }
    for (const limit of [0, -1, 1.5, Number.POSITIVE_INFINITY]) {
      await expect(
        repositories.workItems.listByProjectForExport(graph.project.id, {}, limit)
      ).rejects.toBeInstanceOf(RangeError);
      await expect(
        repositories.workItems.listByWorkspaceForExport(graph.workspace.id, {}, limit)
      ).rejects.toBeInstanceOf(RangeError);
    }
  });

  it('installs trigram search support and its three work item indexes', async () => {
    const extension = await pool.query<{ extname: string }>(
      "select extname from pg_extension where extname = 'pg_trgm'"
    );
    const indexes = await pool.query<{ indexname: string; indexdef: string }>(
      `select indexname, indexdef
       from pg_indexes
       where schemaname = 'public'
         and tablename = 'work_items'
         and indexname in (
           'work_items_display_key_trgm_idx',
           'work_items_title_trgm_idx',
           'work_items_description_trgm_idx'
         )
       order by indexname`
    );

    expect(extension.rows).toEqual([{ extname: 'pg_trgm' }]);
    expect(indexes.rows.map(({ indexname }) => indexname)).toEqual([
      'work_items_description_trgm_idx',
      'work_items_display_key_trgm_idx',
      'work_items_title_trgm_idx'
    ]);
    expect(indexes.rows.every(({ indexdef }) => indexdef.includes('USING gin'))).toBe(true);
    expect(indexes.rows.every(({ indexdef }) => indexdef.includes('gin_trgm_ops'))).toBe(true);
  });

  it('persists nullable parents and enforces hierarchy schema constraints', async () => {
    const graph = await createRepositoryGraph(repositories);
    const child = await createRepositoryWorkItem(repositories, graph, { itemNumber: 2 });

    expect(graph.workItem.parentWorkItemId).toBeNull();
    await expect(
      repositories.workItems.update(child.id, {
        parentWorkItemId: graph.workItem.id,
        updatedAt: now()
      })
    ).resolves.toMatchObject({ parentWorkItemId: graph.workItem.id });
    await expect(repositories.workItems.hasChildren(graph.workItem.id)).resolves.toBe(true);

    await expect(
      repositories.workItems.update(child.id, {
        parentWorkItemId: null,
        updatedAt: now()
      })
    ).resolves.toMatchObject({ parentWorkItemId: null });
    await expect(repositories.workItems.hasChildren(graph.workItem.id)).resolves.toBe(false);

    await expect(
      repositories.workItems.update(child.id, {
        parentWorkItemId: child.id,
        updatedAt: now()
      })
    ).rejects.toMatchObject({ cause: { code: '23514' } });
    await expect(
      repositories.workItems.update(child.id, {
        parentWorkItemId: randomUUID(),
        updatedAt: now()
      })
    ).rejects.toMatchObject({ cause: { code: '23503' } });

    await repositories.workItems.update(child.id, {
      parentWorkItemId: graph.workItem.id,
      updatedAt: now()
    });
    await expect(
      pool.query('delete from work_items where id = $1', [graph.workItem.id])
    ).rejects.toMatchObject({ code: '23503' });

    const index = await pool.query<{ indexdef: string }>(
      `select indexdef from pg_indexes
       where schemaname = 'public'
         and tablename = 'work_items'
         and indexname = 'work_items_project_id_parent_work_item_id_idx'`
    );
    expect(index.rows[0]?.indexdef).toContain('(project_id, parent_work_item_id)');

    await expect(
      repositories.activityEvents.create({
        id: randomUUID(),
        workspaceId: graph.workspace.id,
        projectId: graph.project.id,
        workItemId: child.id,
        actorId: graph.owner.id,
        eventType: 'work_item.parent_changed',
        summary: `Parent changed to ${graph.workItem.displayKey}.`,
        previousValue: null,
        newValue: { id: graph.workItem.id, displayKey: graph.workItem.displayKey },
        metadata: {},
        createdAt: now()
      })
    ).resolves.toMatchObject({ eventType: 'work_item.parent_changed' });
  });

  it('lists children in workflow, priority, board, and item order with a limit', async () => {
    const graph = await createRepositoryGraph(repositories);
    const medium = await createRepositoryWorkItem(repositories, graph, {
      itemNumber: 2,
      priority: 'medium',
      parentWorkItemId: graph.workItem.id,
      boardPosition: 1024
    });
    const highLater = await createRepositoryWorkItem(repositories, graph, {
      itemNumber: 3,
      status: 'blocked',
      priority: 'high',
      parentWorkItemId: graph.workItem.id,
      boardPosition: 2048
    });
    const highEarlier = await createRepositoryWorkItem(repositories, graph, {
      itemNumber: 4,
      status: 'backlog',
      priority: 'high',
      parentWorkItemId: graph.workItem.id,
      boardPosition: 1024
    });
    const terminal = await createRepositoryWorkItem(repositories, graph, {
      itemNumber: 5,
      status: 'done',
      priority: 'urgent',
      parentWorkItemId: graph.workItem.id,
      boardPosition: 512
    });

    const children = await repositories.workItems.listChildren(graph.workItem.id, 3);

    expect(children.map((item) => item.id)).toEqual([
      highEarlier.id,
      highLater.id,
      medium.id
    ]);
    expect(children).not.toContainEqual(expect.objectContaining({ id: terminal.id }));
    await expect(repositories.workItems.listChildren(graph.workItem.id, 0)).resolves.toEqual([]);
  });

  it('loads parents and direct child summaries in bounded sets', async () => {
    const graph = await createRepositoryGraph(repositories);
    const open = await createRepositoryWorkItem(repositories, graph, {
      itemNumber: 2,
      status: 'in_progress',
      parentWorkItemId: graph.workItem.id,
      estimatePoints: 3
    });
    const done = await createRepositoryWorkItem(repositories, graph, {
      itemNumber: 3,
      status: 'done',
      parentWorkItemId: graph.workItem.id,
      estimatePoints: 5
    });
    const canceled = await createRepositoryWorkItem(repositories, graph, {
      itemNumber: 4,
      status: 'canceled',
      parentWorkItemId: graph.workItem.id
    });

    const parents = await repositories.workItems.listParentsForChildren([
      canceled.id,
      open.id,
      open.id,
      graph.workItem.id
    ]);
    expect(parents.map((record) => record.childWorkItemId)).toEqual(
      [open.id, canceled.id].sort((left, right) => left.localeCompare(right))
    );
    expect(parents.every((record) => record.parent.id === graph.workItem.id)).toBe(true);

    await expect(
      repositories.workItems.summarizeChildren([graph.workItem.id, graph.workItem.id, done.id])
    ).resolves.toEqual([
      {
        parentWorkItemId: graph.workItem.id,
        summary: {
          totalCount: 3,
          openCount: 1,
          doneCount: 1,
          canceledCount: 1,
          estimatedCount: 2,
          unestimatedCount: 1,
          estimatePoints: 8
        }
      }
    ]);
    await expect(repositories.workItems.listParentsForChildren([])).resolves.toEqual([]);
    await expect(repositories.workItems.summarizeChildren([])).resolves.toEqual([]);
  });

  it('returns bounded same-project top-level parent candidates with deterministic ranking', async () => {
    const graph = await createRepositoryGraph(repositories);
    const child = await createRepositoryWorkItem(repositories, graph, {
      itemNumber: 2,
      parentWorkItemId: graph.workItem.id
    });
    const terminalExact = await createRepositoryWorkItem(repositories, graph, {
      itemNumber: 3,
      status: 'done',
      title: 'Terminal exact candidate'
    });
    const openTitleMatch = await createRepositoryWorkItem(repositories, graph, {
      itemNumber: 4,
      title: `References ${terminalExact.displayKey}`
    });

    const otherProject = await repositories.projects.create({
      id: randomUUID(),
      workspaceId: graph.workspace.id,
      key: 'OT',
      nextWorkItemNumber: 2,
      name: 'Other Repository Project',
      description: '',
      status: 'active',
      createdAt: now(),
      updatedAt: now()
    });
    await repositories.workItems.create({
      id: randomUUID(),
      workspaceId: graph.workspace.id,
      projectId: otherProject.id,
      itemNumber: 1,
      displayKey: 'OT-1',
      title: terminalExact.displayKey,
      description: '',
      type: 'task',
      status: 'ready',
      priority: 'medium',
      assigneeId: null,
      reporterId: graph.owner.id,
      parentWorkItemId: null,
      boardPosition: 1024,
      dueDate: null,
      estimatePoints: null,
      createdAt: now(),
      updatedAt: now()
    });

    const searchResults = await repositories.workItems.listEligibleParentCandidates({
      workItem: child,
      search: terminalExact.displayKey.toLowerCase(),
      limit: 20
    });
    expect(searchResults.map((item) => item.id)).toEqual([openTitleMatch.id, terminalExact.id]);

    for (let itemNumber = 5; itemNumber <= 26; itemNumber += 1) {
      await createRepositoryWorkItem(repositories, graph, { itemNumber });
    }

    const cappedResults = await repositories.workItems.listEligibleParentCandidates({
      workItem: graph.workItem,
      limit: 100
    });
    expect(cappedResults).toHaveLength(20);
    expect(cappedResults).not.toContainEqual(expect.objectContaining({ id: graph.workItem.id }));
    expect(cappedResults).not.toContainEqual(expect.objectContaining({ id: child.id }));
    expect(cappedResults.every((item) => item.projectId === graph.project.id)).toBe(true);
    expect(cappedResults.every((item) => item.parentWorkItemId === null)).toBe(true);
  });

  it('locks unique work item ids in stable order', async () => {
    const graph = await createRepositoryGraph(repositories);
    const second = await createRepositoryWorkItem(repositories, graph, { itemNumber: 2 });
    const third = await createRepositoryWorkItem(repositories, graph, { itemNumber: 3 });

    const locked = await withRepositoriesTransaction(db, (transactionRepositories) =>
      transactionRepositories.workItems.findManyByIdsForUpdate([
        third.id,
        graph.workItem.id,
        second.id,
        third.id
      ])
    );

    expect(locked.map((item) => item.id)).toEqual(
      [graph.workItem.id, second.id, third.id].sort((left, right) => left.localeCompare(right))
    );
    await expect(repositories.workItems.findManyByIdsForUpdate([])).resolves.toEqual([]);
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

  it('enforces read-only repository transactions', async () => {
    const workspaceId = randomUUID();

    await expect(
      withRepositoriesReadTransaction(db, (transactionRepositories) =>
        transactionRepositories.workspaces.create({
          id: workspaceId,
          name: 'Rejected Read Transaction Write',
          createdAt: now(),
          updatedAt: now()
        })
      )
    ).rejects.toMatchObject({ cause: { code: '25006' } });
    await expect(repositories.workspaces.findById(workspaceId)).resolves.toBeNull();
  });

  it('locks cycle scope and updates cycle assignments and activity in sets', async () => {
    const graph = await createRepositoryGraph(repositories);
    const sourceCycle = await createRepositoryCycle(repositories, graph, {
      name: 'Repository Cycle 1',
      status: 'active',
      startDate: '2026-07-01',
      endDate: '2026-07-14'
    });
    const destinationCycle = await createRepositoryCycle(repositories, graph, {
      name: 'Repository Cycle 2',
      status: 'planned',
      startDate: '2026-07-15',
      endDate: '2026-07-28'
    });
    const second = await createRepositoryWorkItem(repositories, graph, { itemNumber: 2 });
    const updatedAt = new Date('2026-07-14T16:00:00.000Z');

    await repositories.workItems.update(graph.workItem.id, {
      cycleId: sourceCycle.id,
      updatedAt: now()
    });
    await repositories.workItems.update(second.id, {
      cycleId: sourceCycle.id,
      updatedAt: now()
    });

    const result = await withRepositoriesTransaction(db, async (transactionRepositories) => {
      const lockedCycle = await transactionRepositories.projectCycles.findByIdForUpdate(
        sourceCycle.id
      );
      const lockedWork = await transactionRepositories.workItems.listByCycleForUpdate(
        graph.project.id,
        sourceCycle.id
      );
      const emptyUpdate = await transactionRepositories.workItems.updateCycleAssignments(
        [],
        destinationCycle.id,
        updatedAt
      );
      const updatedWork = await transactionRepositories.workItems.updateCycleAssignments(
        lockedWork.map((item) => item.id),
        destinationCycle.id,
        updatedAt
      );
      const emptyActivity = await transactionRepositories.activityEvents.createMany([]);
      const activity = await transactionRepositories.activityEvents.createMany([
        ...updatedWork.map((item) => ({
          id: randomUUID(),
          workspaceId: item.workspaceId,
          projectId: item.projectId,
          workItemId: item.id,
          actorId: graph.owner.id,
          eventType: 'work_item.cycle_changed' as const,
          summary: `Cycle changed to ${destinationCycle.name}.`,
          previousValue: { cycleId: sourceCycle.id, cycleName: sourceCycle.name },
          newValue: { cycleId: destinationCycle.id, cycleName: destinationCycle.name },
          metadata: {},
          createdAt: updatedAt
        })),
        {
          id: randomUUID(),
          workspaceId: graph.workspace.id,
          projectId: graph.project.id,
          workItemId: null,
          actorId: graph.owner.id,
          eventType: 'cycle.closed',
          summary: `${sourceCycle.name} closed.`,
          previousValue: { cycleId: sourceCycle.id, status: 'active' },
          newValue: { cycleId: sourceCycle.id, status: 'completed' },
          metadata: { destinationCycleId: destinationCycle.id },
          createdAt: updatedAt
        }
      ]);

      return { lockedCycle, lockedWork, emptyUpdate, updatedWork, emptyActivity, activity };
    });

    expect(result.lockedCycle).toMatchObject({ id: sourceCycle.id, status: 'active' });
    expect(result.lockedWork.map((item) => item.id)).toEqual(
      [graph.workItem.id, second.id].sort((left, right) => left.localeCompare(right))
    );
    expect(result.emptyUpdate).toEqual([]);
    expect(result.emptyActivity).toEqual([]);
    expect(result.updatedWork).toHaveLength(2);
    expect(result.activity).toHaveLength(3);
    expect(result.activity.map((event) => event.eventType)).toContain('cycle.closed');
    await expect(repositories.workItems.findById(graph.workItem.id)).resolves.toMatchObject({
      cycleId: destinationCycle.id,
      updatedAt
    });
  });

  it('creates immutable cycle closeout records with source uniqueness and foreign keys', async () => {
    const graph = await createRepositoryGraph(repositories);
    const sourceCycle = await createRepositoryCycle(repositories, graph, {
      name: 'Closeout Source',
      status: 'active',
      startDate: '2026-07-01',
      endDate: '2026-07-14'
    });
    const destinationCycle = await createRepositoryCycle(repositories, graph, {
      name: 'Closeout Destination',
      status: 'planned',
      startDate: '2026-07-15',
      endDate: '2026-07-28'
    });
    const snapshot = createCloseoutSnapshot({ graph, sourceCycle, destinationCycle });
    const closeoutId = randomUUID();
    const closeoutInput = {
      id: closeoutId,
      workspaceId: graph.workspace.id,
      projectId: graph.project.id,
      cycleId: sourceCycle.id,
      closedByMemberId: graph.owner.id,
      destinationCycleId: destinationCycle.id,
      snapshot,
      closedAt: new Date(snapshot.closedAt),
      createdAt: new Date(snapshot.closedAt)
    };

    await expect(repositories.projectCycleCloseouts.create(closeoutInput)).resolves.toMatchObject({
      id: closeoutId,
      cycleId: sourceCycle.id,
      destinationCycleId: destinationCycle.id
    });
    await expect(
      repositories.projectCycleCloseouts.findByCycleId(sourceCycle.id)
    ).resolves.toMatchObject({ id: closeoutId, snapshot });

    await expect(
      repositories.projectCycleCloseouts.create({ ...closeoutInput, id: randomUUID() })
    ).rejects.toMatchObject({ cause: { code: '23505' } });

    const otherSource = await createRepositoryCycle(repositories, graph, {
      name: 'Closeout Other Source',
      status: 'completed',
      startDate: '2026-06-15',
      endDate: '2026-06-28'
    });
    await expect(
      repositories.projectCycleCloseouts.create({
        ...closeoutInput,
        id: randomUUID(),
        cycleId: otherSource.id,
        destinationCycleId: randomUUID()
      })
    ).rejects.toMatchObject({ cause: { code: '23503' } });
  });

  it('creates actor-scoped notifications and updates read state', async () => {
    const graph = await createRepositoryGraph(repositories);
    const createdAt = now();
    const readAt = new Date('2026-07-03T13:00:00.000Z');
    const otherRecipientNotificationId = randomUUID();

    const notification = await repositories.notifications.create({
      id: randomUUID(),
      workspaceId: graph.id.workspaceId,
      recipientMemberId: graph.id.contributorId,
      actorMemberId: graph.id.ownerId,
      projectId: graph.id.projectId,
      workItemId: graph.id.workItemId,
      activityEventId: graph.id.activityEventId,
      notificationType: 'assignment',
      summary: 'Repository work item was assigned to you.',
      metadata: { displayKey: graph.workItem.displayKey },
      sourceEventKey: `repository-test:${graph.id.workItemId}:assignment`,
      readAt: null,
      createdAt
    });

    await repositories.notifications.create({
      id: otherRecipientNotificationId,
      workspaceId: graph.id.workspaceId,
      recipientMemberId: graph.id.ownerId,
      actorMemberId: graph.id.contributorId,
      projectId: graph.id.projectId,
      workItemId: graph.id.workItemId,
      activityEventId: null,
      notificationType: 'watched_comment',
      summary: 'Repository Contributor commented on watched work.',
      metadata: {},
      sourceEventKey: `repository-test:${graph.id.workItemId}:comment`,
      readAt: null,
      createdAt
    });

    await expect(
      repositories.notifications.listByRecipient({
        workspaceId: graph.id.workspaceId,
        recipientMemberId: graph.id.contributorId,
        state: 'unread'
      })
    ).resolves.toMatchObject([{ id: notification.id }]);

    await expect(
      repositories.notifications.unreadCount({
        workspaceId: graph.id.workspaceId,
        recipientMemberId: graph.id.contributorId
      })
    ).resolves.toBe(1);

    await expect(
      repositories.notifications.setReadState({
        id: notification.id,
        workspaceId: graph.id.workspaceId,
        recipientMemberId: graph.id.ownerId,
        readAt
      })
    ).resolves.toBeNull();

    await expect(
      repositories.notifications.setReadState({
        id: notification.id,
        workspaceId: graph.id.workspaceId,
        recipientMemberId: graph.id.contributorId,
        readAt
      })
    ).resolves.toMatchObject({ id: notification.id, readAt });

    await expect(
      repositories.notifications.unreadCount({
        workspaceId: graph.id.workspaceId,
        recipientMemberId: graph.id.contributorId
      })
    ).resolves.toBe(0);

    await expect(
      repositories.notifications.setReadState({
        id: notification.id,
        workspaceId: graph.id.workspaceId,
        recipientMemberId: graph.id.contributorId,
        readAt: null
      })
    ).resolves.toMatchObject({ id: notification.id, readAt: null });

    await expect(
      repositories.notifications.markAllRead({
        workspaceId: graph.id.workspaceId,
        recipientMemberId: graph.id.contributorId,
        readAt
      })
    ).resolves.toBe(1);

    await expect(
      repositories.notifications.unreadCount({
        workspaceId: graph.id.workspaceId,
        recipientMemberId: graph.id.ownerId
      })
    ).resolves.toBe(1);
  });

  it('creates idempotent active watchers and deactivates them on unwatch', async () => {
    const graph = await createRepositoryGraph(repositories);
    const createdAt = now();
    const unwatchedAt = new Date('2026-07-03T13:00:00.000Z');

    const watcher = await repositories.workItemWatchers.watch({
      id: randomUUID(),
      workspaceId: graph.id.workspaceId,
      workItemId: graph.id.workItemId,
      memberId: graph.id.contributorId,
      watchedAt: createdAt,
      unwatchedAt: null,
      createdAt,
      updatedAt: createdAt
    });

    const duplicate = await repositories.workItemWatchers.watch({
      id: randomUUID(),
      workspaceId: graph.id.workspaceId,
      workItemId: graph.id.workItemId,
      memberId: graph.id.contributorId,
      watchedAt: createdAt,
      unwatchedAt: null,
      createdAt,
      updatedAt: createdAt
    });

    expect(duplicate.id).toBe(watcher.id);
    await expect(repositories.workItemWatchers.listActiveByWorkItem(graph.id.workItemId)).resolves.toHaveLength(1);
    await expect(
      repositories.workItemWatchers.listActiveMemberIdsByWorkItem(graph.id.workItemId)
    ).resolves.toEqual([graph.id.contributorId]);

    await expect(
      repositories.workItemWatchers.unwatch({
        workItemId: graph.id.workItemId,
        memberId: graph.id.contributorId,
        unwatchedAt,
        updatedAt: unwatchedAt
      })
    ).resolves.toMatchObject({
      id: watcher.id,
      unwatchedAt
    });

    await expect(repositories.workItemWatchers.findActive(graph.id.workItemId, graph.id.contributorId)).resolves.toBeNull();
    await expect(
      repositories.workItemWatchers.listActiveMemberIdsByWorkItem(graph.id.workItemId)
    ).resolves.toEqual([]);
  });

  it('creates and lists comment mentions', async () => {
    const graph = await createRepositoryGraph(repositories);
    const createdAt = now();

    await expect(
      repositories.commentMentions.createMany([
        {
          commentId: graph.id.commentId,
          memberId: graph.id.contributorId,
          workspaceId: graph.id.workspaceId,
          workItemId: graph.id.workItemId,
          createdAt
        }
      ])
    ).resolves.toMatchObject([{ commentId: graph.id.commentId, memberId: graph.id.contributorId }]);

    await expect(repositories.commentMentions.createMany([])).resolves.toEqual([]);
    await expect(repositories.commentMentions.listByComment(graph.id.commentId)).resolves.toMatchObject([
      { commentId: graph.id.commentId, memberId: graph.id.contributorId }
    ]);
    await expect(repositories.commentMentions.listByComments([graph.id.commentId])).resolves.toMatchObject([
      { commentId: graph.id.commentId, memberId: graph.id.contributorId }
    ]);
    await expect(repositories.commentMentions.listByComments([])).resolves.toEqual([]);
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
