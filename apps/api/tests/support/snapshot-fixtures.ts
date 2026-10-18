import type { ProjectCycleCloseoutSnapshotV1Dto, ProjectCycleCloseoutSnapshotV2Dto, ProjectStatusReportDetailDto, ProjectStatusReportSnapshotV1Dto, ProjectStatusReportSnapshotV2Dto, SnapshotHealthReasonV1Dto, MemberDto, MilestoneDto, PlanningRiskItemDto, ProjectDto, WorkItemQuery } from '@worktrail/contracts';

const ids = {
  project: '00000000-0000-4000-8000-000000000101',
  sourceCycle: '00000000-0000-4000-8000-000000000102',
  destinationCycle: '00000000-0000-4000-8000-000000000103',
  member: '00000000-0000-4000-8000-000000000104',
  done: '00000000-0000-4000-8000-000000000105',
  canceled: '00000000-0000-4000-8000-000000000106',
  ready: '00000000-0000-4000-8000-000000000107',
  blocked: '00000000-0000-4000-8000-000000000108'
};

export const goldenCloseoutV1 = {
  snapshotVersion: 1,
  project: {
    id: ids.project,
    key: 'WT',
    name: 'Worktrail App'
  },
  cycle: {
    id: ids.sourceCycle,
    name: 'Operations Cycle 1',
    goal: 'Close the current operations window.',
    status: 'active',
    startDate: '2026-07-01',
    endDate: '2026-07-14',
    targetPoints: 10
  },
  closedAt: '2026-07-14T16:00:00.000Z',
  closedBy: {
    id: ids.member,
    name: 'Morgan Maintainer'
  },
  health: {
    health: 'blocked',
    reasons: [
      {
        key: 'dependency_blocked',
        severity: 'critical',
        message: '1 cycle work item blocked by dependencies.',
        count: 1,
        query: {
          cycleId: ids.sourceCycle,
          dependency: 'dependency_blocked',
          sort: 'priority_desc'
        }
      }
    ]
  },
  counts: {
    totalCount: 4,
    completedCount: 1,
    canceledCount: 1,
    unfinishedCount: 2,
    retainedCount: 2,
    movedCount: 2,
    committedEstimatePoints: 8,
    completedEstimatePoints: 3,
    unfinishedEstimatePoints: 5,
    unestimatedUnfinishedCount: 1
  },
  destination: {
    kind: 'cycle',
    cycle: {
      id: ids.destinationCycle,
      name: 'Operations Cycle 2',
      startDate: '2026-07-15',
      endDate: '2026-07-28'
    }
  },
  items: {
    completed: [
      {
        id: ids.done,
        displayKey: 'WT-1',
        title: 'Completed work',
        status: 'done',
        priority: 'high',
        assignee: { id: ids.member, name: 'Morgan Maintainer' },
        estimatePoints: 3,
        dependencyBlocked: false
      }
    ],
    canceled: [
      {
        id: ids.canceled,
        displayKey: 'WT-2',
        title: 'Canceled work',
        status: 'canceled',
        priority: 'low',
        assignee: null,
        estimatePoints: null,
        dependencyBlocked: false
      }
    ],
    unfinished: [
      {
        id: ids.ready,
        displayKey: 'WT-3',
        title: 'Carry forward',
        status: 'ready',
        priority: 'medium',
        assignee: { id: ids.member, name: 'Morgan Maintainer' },
        estimatePoints: 5,
        dependencyBlocked: false
      },
      {
        id: ids.blocked,
        displayKey: 'WT-4',
        title: 'Dependency blocked carryover',
        status: 'blocked',
        priority: 'urgent',
        assignee: null,
        estimatePoints: null,
        dependencyBlocked: true
      }
    ]
  }
} satisfies ProjectCycleCloseoutSnapshotV1Dto;

const project = {
  id: 'project-id',
  workspaceId: 'workspace-id',
  key: 'WT',
  name: 'Worktrail App',
  description: 'Project management reference app.',
  status: 'active',
  createdAt: '2026-07-05T00:00:00.000Z',
  updatedAt: '2026-07-05T00:00:00.000Z'
} satisfies ProjectDto;

const author = {
  id: 'member-id',
  workspaceId: project.workspaceId,
  name: 'Avery Owner',
  email: 'avery@example.com',
  role: 'owner',
  isActive: true,
  deactivatedAt: null,
  createdAt: '2026-07-05T00:00:00.000Z',
  updatedAt: '2026-07-05T00:00:00.000Z'
} satisfies MemberDto;

const milestone = {
  id: 'milestone-id',
  workspaceId: project.workspaceId,
  projectId: project.id,
  name: 'July release',
  description: 'Release readiness milestone.',
  status: 'active',
  targetDate: '2026-07-31',
  isArchived: false,
  archivedAt: null,
  createdAt: '2026-07-05T00:00:00.000Z',
  updatedAt: '2026-07-06T00:00:00.000Z'
} satisfies MilestoneDto;

const riskQuery = {
  status: 'blocked',
  sort: 'priority_desc'
} satisfies WorkItemQuery;

const healthReason = {
  key: 'blocked_work',
  severity: 'critical',
  message: '1 blocked work item needs attention.',
  count: 1,
  query: riskQuery
} satisfies SnapshotHealthReasonV1Dto;

const riskItem = {
  id: 'work-item-id',
  displayKey: 'WT-42',
  title: 'Stabilize status report publish flow',
  status: 'blocked',
  priority: 'high',
  assignee: author,
  dueDate: '2026-07-20',
  milestone,
  updatedAt: '2026-07-06T00:00:00.000Z',
  parent: {
    id: 'parent-work-item-id',
    projectId: project.id,
    displayKey: 'WT-40',
    title: 'Coordinate status reporting',
    type: 'story',
    status: 'in_progress'
  }
} satisfies PlanningRiskItemDto;

export const goldenReportV1 = {
  snapshotVersion: 1,
  generatedAt: '2026-07-07T12:00:00.000Z',
  project: {
    id: project.id,
    key: project.key,
    name: project.name,
    status: project.status
  },
  health: {
    health: 'blocked',
    activeMilestoneCount: 1,
    healthyMilestoneCount: 0,
    atRiskMilestoneCount: 0,
    blockedMilestoneCount: 1,
    completeMilestoneCount: 0,
    inactiveMilestoneCount: 0,
    openWorkCount: 8,
    blockedWorkCount: 1,
    dependencyBlockedWorkCount: 1,
    blockingOpenWorkCount: 1,
    overdueWorkCount: 1,
    dueSoonWorkCount: 2,
    unassignedActiveWorkCount: 1,
    staleInProgressWorkCount: 1,
    unmilestonedActiveRiskCount: 0,
    reasons: [healthReason]
  },
  counts: {
    openWorkCount: 8,
    blockedWorkCount: 1,
    dependencyBlockedWorkCount: 1,
    blockingOpenWorkCount: 1,
    overdueWorkCount: 1,
    dueSoonWorkCount: 2,
    unassignedActiveWorkCount: 1,
    staleInProgressWorkCount: 1
  },
  milestones: [
    {
      id: milestone.id,
      name: milestone.name,
      status: milestone.status,
      targetDate: milestone.targetDate,
      totalCount: 10,
      openCount: 8,
      doneCount: 2,
      blockedCount: 1,
      dependencyBlockedCount: 1,
      overdueCount: 1,
      dueSoonCount: 2,
      unassignedActiveCount: 1,
      staleInProgressCount: 1,
      health: 'blocked',
      reasons: [healthReason]
    }
  ],
  risks: [
    {
      type: 'blocked',
      title: 'Blocked Work',
      count: 1,
      query: riskQuery,
      items: [riskItem]
    }
  ],
  recentWork: [riskItem]
} satisfies ProjectStatusReportSnapshotV1Dto;

export function goldenCloseoutV2(): ProjectCycleCloseoutSnapshotV2Dto {
  const old = structuredClone(goldenCloseoutV1);
  return { ...old, snapshotVersion: 2, health: { ...old.health, reasons: [
    ...old.health.reasons.map(reason => ({ ...reason, countUnit: 'work_items' as const })),
    { key: 'unestimated_work', severity: 'warning', message: '1 open cycle work item unestimated.',
      count: 1, countUnit: 'work_items', query: { cycleId: old.cycle.id, workState: 'open', estimateState: 'unestimated', sort: 'priority_desc' } }
  ] } };
}

export function goldenReportRecord(overrides: Partial<ProjectStatusReportDetailDto> = {}) {
  return {
    id: 'report-id',
    workspaceId: project.workspaceId,
    projectId: project.id,
    title: 'Worktrail App weekly status',
    statusDate: '2026-07-07',
    health: 'blocked',
    author,
    publishedAt: '2026-07-07T12:05:00.000Z',
    createdAt: '2026-07-07T12:05:00.000Z',
    project,
    summary: 'Project is blocked by release readiness work.',
    highlights: 'Report publishing is available.',
    risks: 'The deployment path still needs review.',
    nextSteps: 'Resolve the blocked release work.',
    snapshot: goldenReportV1,
    ...overrides
  } satisfies ProjectStatusReportDetailDto;
}

export function goldenReportV2(): ProjectStatusReportSnapshotV2Dto {
  const old = structuredClone(goldenReportV1);
  const closeout = goldenCloseoutV2();
  return { ...old, snapshotVersion: 2,
    health: { ...old.health, reasons: old.health.reasons.map(reason => ({ ...reason, countUnit: 'work_items' as const })) },
    milestones: old.milestones.map(milestone => ({ ...milestone, reasons: milestone.reasons.map(reason => ({ ...reason, countUnit: 'work_items' as const })) })),
    risks: old.risks.map(risk => ({ ...risk, countUnit: 'work_items' as const })),
    cycle: { ...closeout.cycle, committedEstimatePoints: 8, completedEstimatePoints: 3,
      openWorkCount: 2, blockedWorkCount: 1, dependencyBlockedWorkCount: 1, unestimatedWorkCount: 1,
      health: closeout.health.health, reasons: closeout.health.reasons,
      links: [{ type: 'project_work', label: 'Open unestimated cycle work', projectId: old.project.id,
        query: { cycleId: closeout.cycle.id, workState: 'open', estimateState: 'unestimated', sort: 'priority_desc' } }] }
  };
}
