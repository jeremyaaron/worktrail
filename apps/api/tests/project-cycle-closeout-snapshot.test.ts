import type { ProjectCycleCloseoutSnapshotDto } from '@worktrail/contracts';
import { describe, expect, it } from 'vitest';

import { ConflictError, ValidationError } from '../src/errors/app-error.js';
import {
  assertProjectCycleCloseoutSnapshotMatchesRecord,
  parseRequestedProjectCycleCloseoutSnapshot,
  parseStoredProjectCycleCloseoutSnapshot
} from '../src/validation/project-cycle-closeout-snapshot.js';

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

const validSnapshot = {
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
} satisfies ProjectCycleCloseoutSnapshotDto;

describe('project cycle closeout snapshot validation', () => {
  it('parses a strict, internally consistent version 1 snapshot', () => {
    expect(parseStoredProjectCycleCloseoutSnapshot(validSnapshot)).toEqual(validSnapshot);
  });

  it.each([
    ['unsupported version', { ...validSnapshot, snapshotVersion: 2 }],
    [
      'invalid project id',
      { ...validSnapshot, project: { ...validSnapshot.project, id: 'not-a-uuid' } }
    ],
    [
      'non-active source status',
      { ...validSnapshot, cycle: { ...validSnapshot.cycle, status: 'completed' } }
    ],
    [
      'invalid source date',
      { ...validSnapshot, cycle: { ...validSnapshot.cycle, startDate: '07/01/2026' } }
    ],
    ['invalid close timestamp', { ...validSnapshot, closedAt: 'July 14' }],
    ['unknown top-level field', { ...validSnapshot, unexpected: true }]
  ])('rejects stored snapshots with %s', (_label, value) => {
    expect(() => parseStoredProjectCycleCloseoutSnapshot(value)).toThrowError(ConflictError);
  });

  it('rejects category status and count inconsistencies', () => {
    const invalidCategory = {
      ...validSnapshot,
      items: {
        ...validSnapshot.items,
        completed: [{ ...validSnapshot.items.completed[0], status: 'ready' }]
      }
    };
    const invalidCount = {
      ...validSnapshot,
      counts: { ...validSnapshot.counts, totalCount: 5, retainedCount: 3 }
    };

    expect(() => parseStoredProjectCycleCloseoutSnapshot(invalidCategory)).toThrowError(
      ConflictError
    );
    expect(() => parseStoredProjectCycleCloseoutSnapshot(invalidCount)).toThrowError(
      ConflictError
    );
  });

  it('rejects estimate totals and destination semantics that do not match item state', () => {
    const invalidEstimate = {
      ...validSnapshot,
      counts: { ...validSnapshot.counts, unfinishedEstimatePoints: 8 }
    };
    const invalidDestination = {
      ...validSnapshot,
      destination: { kind: 'none', cycle: null }
    };

    expect(() => parseStoredProjectCycleCloseoutSnapshot(invalidEstimate)).toThrowError(
      ConflictError
    );
    expect(() => parseStoredProjectCycleCloseoutSnapshot(invalidDestination)).toThrowError(
      ConflictError
    );
  });

  it('uses validation errors for requested snapshots', () => {
    expect(() =>
      parseRequestedProjectCycleCloseoutSnapshot({ ...validSnapshot, snapshotVersion: 2 })
    ).toThrowError(ValidationError);
  });

  it('validates snapshot identity against relational closeout ownership', () => {
    const parsed = parseStoredProjectCycleCloseoutSnapshot(validSnapshot);

    expect(() =>
      assertProjectCycleCloseoutSnapshotMatchesRecord(parsed, {
        projectId: ids.project,
        cycleId: ids.sourceCycle,
        destinationCycleId: ids.destinationCycle
      })
    ).not.toThrow();

    expect(() =>
      assertProjectCycleCloseoutSnapshotMatchesRecord(parsed, {
        projectId: '00000000-0000-4000-8000-000000000999',
        cycleId: ids.sourceCycle,
        destinationCycleId: null
      })
    ).toThrowError(ConflictError);
  });
});
