import { randomUUID } from 'node:crypto';

import type { ProjectStatusReportSnapshotDto } from '@worktrail/contracts';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { createDb, createPool } from '../src/db/client.js';
import { createRepositories, type Repositories } from '../src/repositories/index.js';

const workspaceIds = new Set<string>();
const timestamp = new Date('2026-07-23T12:00:00.000Z');

let pool: ReturnType<typeof createPool>;
let repositories: Repositories;

beforeAll(() => {
  pool = createPool();
  repositories = createRepositories(createDb(pool));
});

afterEach(async () => {
  vi.restoreAllMocks();

  for (const workspaceId of workspaceIds) {
    await cleanupWorkspace(workspaceId);
  }
  workspaceIds.clear();
});

afterAll(async () => {
  for (const workspaceId of workspaceIds) {
    await cleanupWorkspace(workspaceId);
  }
  await pool.end();
});

describe('Quick Find repository', () => {
  it('searches every approved field with deterministic match metadata', async () => {
    const graph = await createSearchGraph({
      key: 'FIND',
      workspaceName: 'Field Coverage Workspace',
      term: 'Findable'
    });

    const keyResult = await repositories.quickFind.searchWorkspace({
      workspaceId: graph.workspaceId,
      query: 'FIND',
      groupLimit: 5
    });
    expect(keyResult.projects.items[0]).toMatchObject({
      project: { id: graph.projectId },
      match: { field: 'project_key', mode: 'exact', excerpt: null }
    });
    expect(keyResult.workItems.items[0]).toMatchObject({
      workItem: { id: graph.workItemId },
      match: { field: 'work_item_key', mode: 'prefix', excerpt: null }
    });

    const workItemKeyResult = await repositories.quickFind.searchWorkspace({
      workspaceId: graph.workspaceId,
      query: 'FIND-1',
      groupLimit: 5
    });
    expect(workItemKeyResult.workItems.items[0]?.match).toEqual({
      field: 'work_item_key',
      mode: 'exact',
      excerpt: null
    });

    const primaryResult = await repositories.quickFind.searchWorkspace({
      workspaceId: graph.workspaceId,
      query: 'Findable',
      groupLimit: 5
    });
    expect(primaryResult.projects.items[0]?.match).toEqual({
      field: 'project_name',
      mode: 'prefix',
      excerpt: null
    });
    expect(primaryResult.workItems.items[0]?.match).toEqual({
      field: 'work_item_title',
      mode: 'prefix',
      excerpt: null
    });
    expect(primaryResult.milestones.items[0]?.match).toEqual({
      field: 'milestone_name',
      mode: 'prefix',
      excerpt: null
    });
    expect(primaryResult.cycles.items[0]?.match).toEqual({
      field: 'cycle_name',
      mode: 'prefix',
      excerpt: null
    });
    expect(primaryResult.reports.items[0]).toMatchObject({
      report: { health: 'at_risk' },
      match: { field: 'report_title', mode: 'prefix', excerpt: null }
    });
    expect(primaryResult.attachments.items[0]?.match).toEqual({
      field: 'attachment_file_name',
      mode: 'prefix',
      excerpt: null
    });

    await expectMatch({
      workspaceId: graph.workspaceId,
      query: 'project-narrative-token',
      group: 'projects',
      field: 'project_description'
    });
    await expectMatch({
      workspaceId: graph.workspaceId,
      query: 'work-narrative-token',
      group: 'workItems',
      field: 'work_item_description'
    });
    await expectMatch({
      workspaceId: graph.workspaceId,
      query: 'milestone-narrative-token',
      group: 'milestones',
      field: 'milestone_description'
    });
    await expectMatch({
      workspaceId: graph.workspaceId,
      query: 'report-narrative-token',
      group: 'reports',
      field: 'report_summary'
    });

    const exactCycle = await repositories.quickFind.searchWorkspace({
      workspaceId: graph.workspaceId,
      query: 'Findable cycle',
      groupLimit: 5
    });
    expect(exactCycle.cycles.items[0]?.match.mode).toBe('exact');

    const exactAttachment = await repositories.quickFind.searchWorkspace({
      workspaceId: graph.workspaceId,
      query: 'Findable-evidence.txt',
      groupLimit: 5
    });
    expect(exactAttachment.attachments.items[0]?.match.mode).toBe('exact');
  });

  it('orders relevance, lifecycle, stable ties, and limit-plus-one truncation', async () => {
    const workspaceId = await createWorkspace('Rank Matrix Workspace');
    const projects = await Promise.all([
      createProject(workspaceId, {
        key: 'RANK',
        name: 'Zulu exact key',
        description: '',
        status: 'active'
      }),
      createProject(workspaceId, {
        key: 'RANKX',
        name: 'Zulu key prefix',
        description: '',
        status: 'active'
      }),
      createProject(workspaceId, {
        key: 'RA1',
        name: 'RANK',
        description: '',
        status: 'active'
      }),
      createProject(workspaceId, {
        key: 'RA2',
        name: 'RANK',
        description: '',
        status: 'active'
      }),
      createProject(workspaceId, {
        key: 'RA3',
        name: 'RANK',
        description: '',
        status: 'archived'
      }),
      createProject(workspaceId, {
        key: 'RA4',
        name: 'RANK Alpha',
        description: '',
        status: 'active'
      }),
      createProject(workspaceId, {
        key: 'RA5',
        name: 'Alpha RANK',
        description: '',
        status: 'active'
      }),
      createProject(workspaceId, {
        key: 'RA6',
        name: 'Zulu narrative',
        description: 'Contains RANK in narrative.',
        status: 'active'
      }),
      createProject(workspaceId, {
        key: 'ARCH',
        name: 'Archived exact identity',
        description: '',
        status: 'archived'
      })
    ]);
    const activeExactNameIds = projects
      .filter((project) => project.name === 'RANK' && project.status === 'active')
      .map((project) => project.id)
      .sort();

    const result = await repositories.quickFind.searchWorkspace({
      workspaceId,
      query: 'RANK',
      groupLimit: 25
    });

    expect(result.projects.items.map((item) => item.project.id)).toEqual([
      projects[0]!.id,
      projects[1]!.id,
      ...activeExactNameIds,
      projects[4]!.id,
      projects[5]!.id,
      projects[6]!.id,
      projects[7]!.id
    ]);
    expect(result.projects.items.map((item) => item.match.mode)).toEqual([
      'exact',
      'prefix',
      'exact',
      'exact',
      'exact',
      'prefix',
      'substring',
      'substring'
    ]);
    expect(result.projects.items.at(-1)?.match).toMatchObject({
      field: 'project_description',
      mode: 'substring'
    });
    expect(result.projects.hasMore).toBe(false);

    const bounded = await repositories.quickFind.searchWorkspace({
      workspaceId,
      query: 'RANK',
      groupLimit: 2
    });
    expect(bounded.projects.items.map((item) => item.project.id)).toEqual([
      projects[0]!.id,
      projects[1]!.id
    ]);
    expect(bounded.projects.hasMore).toBe(true);

    const archivedIdentity = await repositories.quickFind.searchWorkspace({
      workspaceId,
      query: 'ARCH',
      groupLimit: 5
    });
    expect(archivedIdentity.projects.items[0]).toMatchObject({
      project: { id: projects[8]!.id, status: 'archived' },
      match: { field: 'project_key', mode: 'exact' }
    });
  });

  it('isolates every group, executes six bounded statements, and omits attachment secrets', async () => {
    const first = await createSearchGraph({
      key: 'TEN1',
      workspaceName: 'First Tenant Workspace',
      term: 'tenantproof'
    });
    const second = await createSearchGraph({
      key: 'TEN2',
      workspaceName: 'Second Tenant Workspace',
      term: 'tenantproof'
    });
    const querySpy = vi.spyOn(pool, 'query');

    const result = await repositories.quickFind.searchWorkspace({
      workspaceId: first.workspaceId,
      query: 'tenantproof',
      groupLimit: 5
    });

    expect(querySpy).toHaveBeenCalledTimes(6);
    expect(Object.values(result).every((group) => group.items.length === 1)).toBe(true);

    for (const group of Object.values(result)) {
      for (const item of group.items) {
        expect(item.project.id).toBe(first.projectId);
        expect(item.project.id).not.toBe(second.projectId);
      }
    }

    const serialized = JSON.stringify(result.attachments);
    expect(serialized).not.toContain(first.attachmentStorageKey);
    expect(serialized).not.toContain(first.attachmentChecksum);
    expect(serialized).not.toContain(first.memberId);
    expect(serialized).not.toContain('storageKey');
    expect(serialized).not.toContain('checksum');
    expect(serialized).not.toContain('uploader');
  });

  it('rejects invalid limits before querying and rejects malformed report health coherently', async () => {
    const graph = await createSearchGraph({
      key: 'FAIL',
      workspaceName: 'Failure Workspace',
      term: 'failureproof'
    });
    const querySpy = vi.spyOn(pool, 'query');

    await expect(
      repositories.quickFind.searchWorkspace({
        workspaceId: graph.workspaceId,
        query: 'failureproof',
        groupLimit: 0
      })
    ).rejects.toThrow('Quick Find group limit');
    expect(querySpy).not.toHaveBeenCalled();

    querySpy.mockRestore();
    await pool.query(
      `update project_status_reports
       set snapshot = '{"health":{"health":"unknown"}}'::jsonb
       where id = $1`,
      [graph.reportId]
    );

    await expect(
      repositories.quickFind.searchWorkspace({
        workspaceId: graph.workspaceId,
        query: 'failureproof',
        groupLimit: 5
      })
    ).rejects.toThrow('Stored project status report health is invalid.');
  });
});

async function expectMatch(input: {
  workspaceId: string;
  query: string;
  group: 'projects' | 'workItems' | 'milestones' | 'reports';
  field:
    | 'project_description'
    | 'work_item_description'
    | 'milestone_description'
    | 'report_summary';
}) {
  const result = await repositories.quickFind.searchWorkspace({
    workspaceId: input.workspaceId,
    query: input.query,
    groupLimit: 5
  });
  const item = result[input.group].items[0];

  expect(item?.match.field).toBe(input.field);
  expect(item?.match.mode).toBe('substring');
  expect(item?.match.excerpt).toContain(input.query);
}

async function createSearchGraph(input: {
  key: string;
  workspaceName: string;
  term: string;
}) {
  const workspaceId = await createWorkspace(input.workspaceName);
  const memberId = randomUUID();
  const project = await createProject(workspaceId, {
    key: input.key,
    name: `${input.term} project`,
    description: `Only project-narrative-token appears in this project description.`,
    status: 'active'
  });

  await repositories.members.create({
    id: memberId,
    workspaceId,
    name: `${input.term} owner`,
    email: `${memberId}@example.com`,
    role: 'owner',
    isActive: true,
    deactivatedAt: null,
    deactivatedById: null,
    createdAt: timestamp,
    updatedAt: timestamp
  });

  const workItemId = randomUUID();
  await repositories.workItems.create({
    id: workItemId,
    workspaceId,
    projectId: project.id,
    title: `${input.term} work item`,
    description: `Only work-narrative-token appears in this work item description.`,
    itemNumber: 1,
    displayKey: `${input.key}-1`,
    type: 'story',
    status: 'in_progress',
    priority: 'high',
    assigneeId: null,
    reporterId: memberId,
    milestoneId: null,
    cycleId: null,
    parentWorkItemId: null,
    boardPosition: 1,
    dueDate: null,
    estimatePoints: 3,
    createdAt: timestamp,
    updatedAt: timestamp
  });

  await repositories.milestones.create({
    id: randomUUID(),
    workspaceId,
    projectId: project.id,
    name: `${input.term} milestone`,
    description: `Only milestone-narrative-token appears in this milestone description.`,
    status: 'active',
    targetDate: '2026-08-15',
    archivedAt: null,
    archivedById: null,
    createdAt: timestamp,
    updatedAt: timestamp
  });

  await repositories.projectCycles.create({
    id: randomUUID(),
    workspaceId,
    projectId: project.id,
    name: `${input.term} cycle`,
    goal: 'Cycle goal is deliberately not searchable.',
    status: 'active',
    startDate: '2026-07-20',
    endDate: '2026-08-02',
    targetPoints: 20,
    archivedAt: null,
    archivedById: null,
    createdAt: timestamp,
    updatedAt: timestamp
  });

  const reportId = randomUUID();
  await repositories.projectStatusReports.create({
    id: reportId,
    workspaceId,
    projectId: project.id,
    authorMemberId: memberId,
    title: `${input.term} report`,
    statusDate: '2026-07-23',
    summary: `Only report-narrative-token appears in this published summary.`,
    highlights: 'Highlights are deliberately not searchable.',
    risks: 'Risks are deliberately not searchable.',
    nextSteps: 'Next steps are deliberately not searchable.',
    snapshot: reportSnapshot(project, 'at_risk'),
    publishedAt: timestamp,
    createdAt: timestamp
  });

  const attachmentId = randomUUID();
  const attachmentStorageKey = randomHex();
  const attachmentChecksum = randomHex();
  await repositories.workItemAttachments.create({
    id: attachmentId,
    workspaceId,
    projectId: project.id,
    workItemId,
    uploaderMemberId: memberId,
    fileName: `${input.term}-evidence.txt`,
    mediaType: 'text/plain',
    byteSize: 128,
    checksumSha256: attachmentChecksum,
    storageKey: attachmentStorageKey,
    createdAt: timestamp
  });

  return {
    workspaceId,
    memberId,
    projectId: project.id,
    workItemId,
    reportId,
    attachmentId,
    attachmentStorageKey,
    attachmentChecksum
  };
}

async function createWorkspace(name: string): Promise<string> {
  const workspaceId = randomUUID();
  workspaceIds.add(workspaceId);
  await repositories.workspaces.create({
    id: workspaceId,
    name,
    createdAt: timestamp,
    updatedAt: timestamp
  });
  return workspaceId;
}

async function createProject(
  workspaceId: string,
  input: {
    key: string;
    name: string;
    description: string;
    status: 'active' | 'archived';
  }
) {
  const project = await repositories.projects.create({
    id: randomUUID(),
    workspaceId,
    key: input.key,
    nextWorkItemNumber: 2,
    name: input.name,
    description: input.description,
    status: input.status,
    createdAt: timestamp,
    updatedAt: timestamp
  });

  if (project === undefined) {
    throw new Error('Quick Find test project was not created.');
  }

  return project;
}

function reportSnapshot(
  project: { id: string; key: string; name: string; status: 'active' | 'archived' },
  health: 'healthy' | 'at_risk'
): ProjectStatusReportSnapshotDto {
  return {
    snapshotVersion: 1,
    generatedAt: timestamp.toISOString(),
    project: {
      id: project.id,
      key: project.key,
      name: project.name,
      status: project.status
    },
    health: {
      health,
      activeMilestoneCount: 1,
      healthyMilestoneCount: 0,
      atRiskMilestoneCount: health === 'at_risk' ? 1 : 0,
      blockedMilestoneCount: 0,
      completeMilestoneCount: 0,
      inactiveMilestoneCount: 0,
      openWorkCount: 1,
      blockedWorkCount: 0,
      dependencyBlockedWorkCount: 0,
      blockingOpenWorkCount: 0,
      overdueWorkCount: 0,
      dueSoonWorkCount: 0,
      unassignedActiveWorkCount: 1,
      staleInProgressWorkCount: 0,
      unmilestonedActiveRiskCount: 0,
      reasons: []
    },
    counts: {
      openWorkCount: 1,
      blockedWorkCount: 0,
      dependencyBlockedWorkCount: 0,
      blockingOpenWorkCount: 0,
      overdueWorkCount: 0,
      dueSoonWorkCount: 0,
      unassignedActiveWorkCount: 1,
      staleInProgressWorkCount: 0
    },
    milestones: [],
    risks: [],
    recentWork: []
  };
}

async function cleanupWorkspace(workspaceId: string): Promise<void> {
  await pool.query('delete from work_item_attachments where workspace_id = $1', [workspaceId]);
  await pool.query('delete from project_status_reports where workspace_id = $1', [workspaceId]);
  await pool.query('delete from work_items where workspace_id = $1', [workspaceId]);
  await pool.query('delete from project_cycles where workspace_id = $1', [workspaceId]);
  await pool.query('delete from milestones where workspace_id = $1', [workspaceId]);
  await pool.query('delete from projects where workspace_id = $1', [workspaceId]);
  await pool.query('delete from members where workspace_id = $1', [workspaceId]);
  await pool.query('delete from workspaces where id = $1', [workspaceId]);
}

function randomHex(): string {
  return randomUUID().replaceAll('-', '').repeat(2);
}
