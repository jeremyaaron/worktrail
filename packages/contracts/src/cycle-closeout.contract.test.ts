import { describe, expect, expectTypeOf, it } from 'vitest';

import type {
  ActivityEventType,
  CloseProjectCycleRequest,
  CloseProjectCycleResultDto,
  MemberDto,
  ProjectCycleCloseoutCountsDto,
  ProjectCycleCloseoutDestinationDto,
  ProjectCycleCloseoutDto,
  ProjectCycleCloseoutItemSnapshotDto,
  ProjectCycleCloseoutPreviewDto,
  ProjectCycleCloseoutSnapshotDto,
  ProjectCycleDto,
  ProjectDto
} from './index.js';

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

const member = {
  id: 'member-id',
  workspaceId: project.workspaceId,
  name: 'Morgan Maintainer',
  email: 'morgan@example.com',
  role: 'maintainer',
  isActive: true,
  deactivatedAt: null,
  createdAt: '2026-07-05T00:00:00.000Z',
  updatedAt: '2026-07-05T00:00:00.000Z'
} satisfies MemberDto;

const sourceCycle = {
  id: 'source-cycle-id',
  workspaceId: project.workspaceId,
  projectId: project.id,
  name: 'Operations Cycle 1',
  goal: 'Close the current operations window.',
  status: 'active',
  startDate: '2026-07-01',
  endDate: '2026-07-14',
  targetPoints: 20,
  isArchived: false,
  archivedAt: null,
  createdAt: '2026-06-25T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z'
} satisfies ProjectCycleDto;

const destinationCycle = {
  id: 'destination-cycle-id',
  workspaceId: project.workspaceId,
  projectId: project.id,
  name: 'Operations Cycle 2',
  goal: 'Continue unfinished operations work.',
  status: 'planned',
  startDate: '2026-07-15',
  endDate: '2026-07-28',
  targetPoints: 20,
  isArchived: false,
  archivedAt: null,
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z'
} satisfies ProjectCycleDto;

const unfinishedItem = {
  id: 'work-item-id',
  displayKey: 'WT-42',
  title: 'Carry closeout work forward',
  status: 'in_progress',
  priority: 'high',
  assignee: { id: member.id, name: member.name },
  estimatePoints: 5,
  dependencyBlocked: true
} satisfies ProjectCycleCloseoutItemSnapshotDto;

const completedItem = {
  ...unfinishedItem,
  id: 'completed-work-item-id',
  displayKey: 'WT-41',
  title: 'Implement closeout contracts',
  status: 'done',
  dependencyBlocked: false
} satisfies ProjectCycleCloseoutItemSnapshotDto;

const counts = {
  totalCount: 2,
  completedCount: 1,
  canceledCount: 0,
  unfinishedCount: 1,
  retainedCount: 1,
  movedCount: 1,
  committedEstimatePoints: 10,
  completedEstimatePoints: 5,
  unfinishedEstimatePoints: 5,
  unestimatedUnfinishedCount: 0
} satisfies ProjectCycleCloseoutCountsDto;

const destination = {
  kind: 'cycle',
  cycle: {
    id: destinationCycle.id,
    name: destinationCycle.name,
    startDate: destinationCycle.startDate,
    endDate: destinationCycle.endDate
  }
} satisfies ProjectCycleCloseoutDestinationDto;

const snapshot = {
  snapshotVersion: 1,
  project: { id: project.id, key: project.key, name: project.name },
  cycle: {
    id: sourceCycle.id,
    name: sourceCycle.name,
    goal: sourceCycle.goal,
    status: 'active',
    startDate: sourceCycle.startDate,
    endDate: sourceCycle.endDate,
    targetPoints: sourceCycle.targetPoints
  },
  closedAt: '2026-07-14T16:00:00.000Z',
  closedBy: { id: member.id, name: member.name },
  health: {
    health: 'at_risk',
    reasons: [
      {
        key: 'dependency_blocked',
        severity: 'warning',
        message: '1 open work item is dependency blocked.',
        count: 1,
        query: { cycleId: sourceCycle.id, dependency: 'dependency_blocked' }
      }
    ]
  },
  counts,
  destination,
  items: {
    completed: [completedItem],
    canceled: [],
    unfinished: [unfinishedItem]
  }
} satisfies ProjectCycleCloseoutSnapshotDto;

const closeout = {
  id: 'closeout-id',
  workspaceId: project.workspaceId,
  projectId: project.id,
  cycleId: sourceCycle.id,
  closedAt: snapshot.closedAt,
  closedBy: member,
  destinationCycleId: destinationCycle.id,
  snapshot
} satisfies ProjectCycleCloseoutDto;

describe('cycle closeout contracts', () => {
  it('supports every closeout destination discriminant', () => {
    const destinations = [
      destination,
      { kind: 'unplanned', cycle: null },
      { kind: 'none', cycle: null }
    ] satisfies ProjectCycleCloseoutDestinationDto[];

    expect(destinations.map((item) => item.kind)).toEqual(['cycle', 'unplanned', 'none']);
    expectTypeOf(destinations).toMatchTypeOf<ProjectCycleCloseoutDestinationDto[]>();
  });

  it('supports versioned closeout snapshots and persisted closeout DTOs', () => {
    expect(snapshot.snapshotVersion).toBe(1);
    expect(snapshot.counts.retainedCount).toBe(1);
    expect(snapshot.items.unfinished[0]?.dependencyBlocked).toBe(true);
    expect(closeout.destinationCycleId).toBe(destinationCycle.id);
    expectTypeOf(snapshot).toMatchTypeOf<ProjectCycleCloseoutSnapshotDto>();
    expectTypeOf(closeout).toMatchTypeOf<ProjectCycleCloseoutDto>();
  });

  it('supports closeout preview and command result shapes', () => {
    const preview = {
      project,
      cycle: sourceCycle,
      generatedAt: '2026-07-14T15:55:00.000Z',
      health: snapshot.health,
      counts: {
        totalCount: counts.totalCount,
        completedCount: counts.completedCount,
        canceledCount: counts.canceledCount,
        unfinishedCount: counts.unfinishedCount,
        retainedCount: counts.retainedCount,
        committedEstimatePoints: counts.committedEstimatePoints,
        completedEstimatePoints: counts.completedEstimatePoints,
        unfinishedEstimatePoints: counts.unfinishedEstimatePoints,
        unestimatedUnfinishedCount: counts.unestimatedUnfinishedCount
      },
      unfinishedItems: [unfinishedItem],
      eligibleDestinations: [{ cycle: destinationCycle }]
    } satisfies ProjectCycleCloseoutPreviewDto;
    const request = {
      destinationCycleId: destinationCycle.id
    } satisfies CloseProjectCycleRequest;
    const result = {
      applied: true,
      cycle: { ...sourceCycle, status: 'completed' },
      closeout,
      movedItemCount: counts.movedCount,
      retainedItemCount: counts.retainedCount
    } satisfies CloseProjectCycleResultDto;

    expect(preview.eligibleDestinations[0]?.cycle.status).toBe('planned');
    expect(request.destinationCycleId).toBe(destinationCycle.id);
    expect(result.applied).toBe(true);
    expectTypeOf(preview).toMatchTypeOf<ProjectCycleCloseoutPreviewDto>();
    expectTypeOf(request).toMatchTypeOf<CloseProjectCycleRequest>();
    expectTypeOf(result).toMatchTypeOf<CloseProjectCycleResultDto>();
  });

  it('includes the cycle closeout activity event vocabulary', () => {
    const eventType = 'cycle.closed' satisfies ActivityEventType;

    expect(eventType).toBe('cycle.closed');
  });
});
