import { describe, expect, it } from 'vitest';

import type { ProjectCycle, WorkItem } from '../src/repositories/types.js';
import { createCycleEvaluation } from '../src/services/cycle-review-model.js';
import { createWorkRiskEvaluationContext } from '../src/services/work-risk-sections.js';

const ids = {
  workspace: '00000000-0000-4000-8000-000000000201',
  project: '00000000-0000-4000-8000-000000000202',
  cycle: '00000000-0000-4000-8000-000000000203',
  member: '00000000-0000-4000-8000-000000000204',
  blocker: '00000000-0000-4000-8000-000000000205',
  blocked: '00000000-0000-4000-8000-000000000206',
  ready: '00000000-0000-4000-8000-000000000207',
  done: '00000000-0000-4000-8000-000000000208'
};

const cycle = {
  id: ids.cycle,
  workspaceId: ids.workspace,
  projectId: ids.project,
  name: 'Current cycle',
  goal: 'Verify shared cycle evaluation.',
  status: 'active',
  startDate: '2026-07-01',
  endDate: '2026-07-12',
  targetPoints: 5,
  archivedAt: null,
  archivedById: null,
  createdAt: new Date('2026-07-01T12:00:00.000Z'),
  updatedAt: new Date('2026-07-01T12:00:00.000Z')
} satisfies ProjectCycle;

const workItems = [
  createWorkItem({
    id: ids.blocker,
    itemNumber: 1,
    title: 'Resolve dependency',
    status: 'in_progress',
    priority: 'urgent',
    estimatePoints: 3,
    updatedAt: new Date('2026-07-01T12:00:00.000Z')
  }),
  createWorkItem({
    id: ids.blocked,
    itemNumber: 2,
    title: 'Blocked cycle work',
    status: 'blocked',
    priority: 'high',
    dueDate: '2026-07-08',
    estimatePoints: 3
  }),
  createWorkItem({
    id: ids.ready,
    itemNumber: 3,
    title: 'Unassigned unestimated work',
    status: 'ready',
    assigneeId: null,
    estimatePoints: null
  }),
  createWorkItem({
    id: ids.done,
    itemNumber: 4,
    title: 'Completed work',
    status: 'done',
    priority: 'low',
    estimatePoints: 2
  })
];

describe('cycle review model', () => {
  it('derives deterministic progress, health, and scope from a fixed risk context', () => {
    const context = createWorkRiskEvaluationContext({
      now: new Date('2026-07-10T12:00:00.000Z'),
      dependencyBlockedWorkItems: [workItems[1]!],
      blockingOpenWorkItems: [workItems[0]!]
    });

    const evaluation = createCycleEvaluation({ cycle, scopedWorkItems: workItems, context });

    expect(evaluation.progress).toEqual({
      totalCount: 4,
      openCount: 3,
      doneCount: 1,
      blockedCount: 1,
      dependencyBlockedCount: 1,
      committedEstimatePoints: 8,
      completedEstimatePoints: 2,
      unestimatedCount: 1,
      targetPoints: 5
    });
    expect(evaluation.health.health).toBe('blocked');
    expect(evaluation.health.reasons.map((reason) => reason.key)).toEqual([
      'blocked_work',
      'dependency_blocked',
      'cycle_over_target',
      'overdue_work',
      'unassigned_active',
      'stale_in_progress',
      'unestimated_work'
    ]);
    expect(evaluation.scopeBreakdown).toMatchObject({
      statusCounts: { ready: 1, in_progress: 1, blocked: 1, done: 1 },
      priorityCounts: { low: 1, medium: 1, high: 1, urgent: 1 },
      assignedCount: 3,
      unassignedCount: 1,
      dueDate: { overdueCount: 1, noneCount: 3 },
      dependency: { dependencyBlockedCount: 1, blockingOpenWorkCount: 1 }
    });
    expect(evaluation.isOverTarget).toBe(true);
  });
});

function createWorkItem(input: {
  id: string;
  itemNumber: number;
  title: string;
  status: WorkItem['status'];
  priority?: WorkItem['priority'];
  assigneeId?: string | null;
  dueDate?: string | null;
  estimatePoints: number | null;
  updatedAt?: Date;
}): WorkItem {
  const timestamp = new Date('2026-07-10T12:00:00.000Z');

  return {
    id: input.id,
    workspaceId: ids.workspace,
    projectId: ids.project,
    title: input.title,
    description: '',
    itemNumber: input.itemNumber,
    displayKey: `CY-${input.itemNumber}`,
    type: 'story',
    status: input.status,
    priority: input.priority ?? 'medium',
    assigneeId: input.assigneeId === undefined ? ids.member : input.assigneeId,
    reporterId: ids.member,
    milestoneId: null,
    cycleId: ids.cycle,
    parentWorkItemId: null,
    boardPosition: 0,
    dueDate: input.dueDate ?? null,
    estimatePoints: input.estimatePoints,
    createdAt: timestamp,
    updatedAt: input.updatedAt ?? timestamp
  };
}
