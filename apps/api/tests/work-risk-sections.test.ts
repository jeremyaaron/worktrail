import { describe, expect, it } from 'vitest';

import type { Member, Milestone, WorkItem } from '../src/repositories/types.js';
import {
  createCycleReviewRiskSections,
  createMilestoneReviewRiskSections,
  createProjectStatusReportRiskSnapshots,
  createWorkRiskEvaluationContext
} from '../src/services/work-risk-sections.js';

const timestamp = new Date('2026-07-10T12:00:00.000Z');

const member = {
  id: 'member-1',
  workspaceId: 'workspace-1',
  name: 'Avery Owner',
  email: 'avery@example.com',
  role: 'owner',
  isActive: true,
  deactivatedAt: null,
  deactivatedById: null,
  createdAt: timestamp,
  updatedAt: timestamp
} satisfies Member;

const milestone = {
  id: 'milestone-1',
  workspaceId: 'workspace-1',
  projectId: 'project-1',
  name: 'Beta readiness',
  description: '',
  status: 'active',
  targetDate: '2026-07-18',
  archivedAt: null,
  archivedById: null,
  createdAt: timestamp,
  updatedAt: timestamp
} satisfies Milestone;

describe('work risk sections', () => {
  it('builds aligned milestone-scoped and project-wide risk sections', () => {
    const blocked = createWorkItem({
      id: 'blocked-1',
      title: 'Blocked launch checklist',
      status: 'blocked',
      priority: 'high',
      dueDate: '2026-07-09'
    });
    const dependencyBlocked = createWorkItem({
      id: 'dependency-1',
      title: 'Waiting on identity provider',
      status: 'in_progress',
      priority: 'urgent',
      dueDate: '2026-07-12',
      updatedAt: new Date('2026-07-01T12:00:00.000Z')
    });
    const unassigned = createWorkItem({
      id: 'unassigned-1',
      title: 'Assign release notes',
      status: 'ready',
      priority: 'medium',
      assigneeId: null
    });
    const blocker = createWorkItem({
      id: 'blocker-1',
      title: 'Finalize API contract',
      status: 'in_progress',
      priority: 'high'
    });
    const done = createWorkItem({
      id: 'done-1',
      title: 'Closed implementation task',
      status: 'done',
      priority: 'low'
    });
    const workItems = [blocked, dependencyBlocked, unassigned, blocker, done];
    const context = createWorkRiskEvaluationContext({
      now: timestamp,
      dependencyBlockedWorkItems: [dependencyBlocked],
      blockingOpenWorkItems: [blocker]
    });
    const memberById = new Map([[member.id, member]]);
    const milestoneById = new Map([[milestone.id, milestone]]);

    const reviewSections = createMilestoneReviewRiskSections({
      milestoneId: milestone.id,
      workItems,
      memberById,
      milestoneById,
      context
    });
    const cycleSections = createCycleReviewRiskSections({
      cycleId: 'cycle-1',
      workItems,
      memberById,
      milestoneById,
      context,
      isOverTarget: true
    });
    const reportRisks = createProjectStatusReportRiskSnapshots({
      workItems,
      memberById,
      milestoneById,
      context
    });

    const expectedTypes = [
      'blocked',
      'dependency_blocked',
      'overdue',
      'due_soon',
      'unassigned_active',
      'stale_in_progress',
      'blocking_open_work'
    ];
    expect(reviewSections.map((section) => section.type)).toEqual(expectedTypes);
    expect(reportRisks.map((risk) => risk.type)).toEqual(expectedTypes);
    expect(cycleSections.map((section) => section.type)).toEqual([
      ...expectedTypes,
      'unestimated',
      'over_target'
    ]);
    expect(reviewSections.find((section) => section.type === 'blocked')).toMatchObject({
      count: 1,
      query: { milestoneId: milestone.id, status: 'blocked', sort: 'priority_desc' },
      items: [
        expect.objectContaining({
          id: blocked.id,
          assignee: expect.objectContaining({ id: member.id }),
          milestone: expect.objectContaining({ id: milestone.id })
        })
      ]
    });
    expect(reportRisks.find((risk) => risk.type === 'blocked')).toMatchObject({
      count: 1,
      query: { status: 'blocked', sort: 'priority_desc' }
    });
    expect(reviewSections.find((section) => section.type === 'stale_in_progress')).toMatchObject({
      count: 1,
      items: [expect.objectContaining({ id: dependencyBlocked.id })]
    });
    expect(reportRisks.find((risk) => risk.type === 'unassigned_active')).toMatchObject({
      count: 1,
      items: [expect.objectContaining({ id: unassigned.id, assignee: null })]
    });
    expect(cycleSections.find((section) => section.type === 'over_target')).toMatchObject({
      count: 1,
      query: { cycleId: 'cycle-1', sort: 'priority_desc' }
    });
  });
});

function createWorkItem(input: Partial<WorkItem> & Pick<WorkItem, 'id' | 'title'>): WorkItem {
  return {
    id: input.id,
    workspaceId: 'workspace-1',
    projectId: 'project-1',
    title: input.title,
    description: '',
    itemNumber: 1,
    displayKey: `WT-${input.id}`,
    type: 'story',
    status: input.status ?? 'ready',
    priority: input.priority ?? 'medium',
    assigneeId: input.assigneeId === undefined ? member.id : input.assigneeId,
    reporterId: member.id,
    milestoneId: input.milestoneId === undefined ? milestone.id : input.milestoneId,
    cycleId: input.cycleId ?? null,
    parentWorkItemId: input.parentWorkItemId ?? null,
    boardPosition: 0,
    dueDate: input.dueDate ?? null,
    estimatePoints: null,
    createdAt: input.createdAt ?? timestamp,
    updatedAt: input.updatedAt ?? timestamp
  };
}
