import { describe, expect, it } from 'vitest';

import { DeliveryHealthService } from '../src/services/delivery-health-service.js';
import type { Milestone, Project, WorkItem } from '../src/repositories/types.js';

const now = new Date('2026-07-10T12:00:00.000Z');
const workspaceId = '10000000-0000-4000-8000-000000000001';
const projectId = '10000000-0000-4000-8000-000000000201';
const memberId = '10000000-0000-4000-8000-000000000101';

const baseProject: Project = {
  id: projectId,
  workspaceId,
  key: 'PLAN',
  nextWorkItemNumber: 1,
  name: 'Planning project',
  description: '',
  status: 'active',
  createdAt: now,
  updatedAt: now
};

function milestone(input: Partial<Milestone> & Pick<Milestone, 'id' | 'name'>): Milestone {
  return {
    id: input.id,
    workspaceId,
    projectId,
    name: input.name,
    description: input.description ?? '',
    status: input.status ?? 'active',
    targetDate: input.targetDate ?? null,
    archivedAt: input.archivedAt ?? null,
    archivedById: input.archivedById ?? null,
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now
  };
}

function workItem(input: Partial<WorkItem> & Pick<WorkItem, 'id' | 'title'>): WorkItem {
  const itemNumber = Number(input.id.replace(/\D/g, '').slice(-4)) || 1;

  return {
    id: input.id,
    workspaceId,
    projectId,
    title: input.title,
    description: input.description ?? '',
    itemNumber,
    displayKey: input.displayKey ?? `PLAN-${itemNumber}`,
    type: input.type ?? 'task',
    status: input.status ?? 'ready',
    priority: input.priority ?? 'medium',
    assigneeId: input.assigneeId === undefined ? memberId : input.assigneeId,
    reporterId: input.reporterId ?? memberId,
    milestoneId: input.milestoneId ?? null,
    boardPosition: input.boardPosition ?? itemNumber * 1024,
    dueDate: input.dueDate ?? null,
    estimatePoints: input.estimatePoints ?? null,
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now
  };
}

function derive(input: {
  project?: Project;
  milestones?: Milestone[];
  workItems?: WorkItem[];
  dependencyBlockedWorkItems?: WorkItem[];
  blockingOpenWorkItems?: WorkItem[];
}) {
  return new DeliveryHealthService().derive({
    project: input.project ?? baseProject,
    milestones: input.milestones ?? [],
    workItems: input.workItems ?? [],
    dependencyBlockedWorkItems: input.dependencyBlockedWorkItems ?? [],
    blockingOpenWorkItems: input.blockingOpenWorkItems ?? [],
    now
  });
}

describe('DeliveryHealthService', () => {
  it('marks an empty active project healthy while marking an empty active milestone at risk', () => {
    const emptyMilestone = milestone({
      id: '10000000-0000-4000-8000-000000000301',
      name: 'Empty milestone'
    });

    const result = derive({ milestones: [emptyMilestone] });

    expect(result.deliveryHealth.health).toBe('at_risk');
    expect(result.deliveryHealth.activeMilestoneCount).toBe(1);
    expect(result.deliveryHealth.atRiskMilestoneCount).toBe(1);
    expect(result.milestoneProgress[0]).toMatchObject({
      health: 'at_risk',
      totalCount: 0,
      reasons: [
        expect.objectContaining({
          key: 'empty_active_milestone',
          severity: 'warning',
          query: null
        })
      ]
    });

    expect(derive({}).deliveryHealth).toMatchObject({
      health: 'healthy',
      activeMilestoneCount: 0,
      reasons: []
    });
  });

  it('derives complete and inactive milestone states before risk states', () => {
    const completeMilestone = milestone({
      id: '10000000-0000-4000-8000-000000000302',
      name: 'Complete milestone',
      status: 'completed',
      targetDate: '2026-07-01'
    });
    const canceledMilestone = milestone({
      id: '10000000-0000-4000-8000-000000000303',
      name: 'Canceled milestone',
      status: 'canceled'
    });
    const archivedMilestone = milestone({
      id: '10000000-0000-4000-8000-000000000304',
      name: 'Archived milestone',
      archivedAt: now,
      archivedById: memberId
    });
    const completedWork = workItem({
      id: '10000000-0000-4000-8000-000000000401',
      title: 'Done work',
      status: 'done',
      milestoneId: completeMilestone.id,
      dueDate: '2026-07-01'
    });

    const result = derive({
      milestones: [completeMilestone, canceledMilestone, archivedMilestone],
      workItems: [completedWork]
    });

    expect(result.milestoneProgress.map((progress) => [progress.milestone.name, progress.health]))
      .toEqual([
        ['Complete milestone', 'complete'],
        ['Archived milestone', 'inactive'],
        ['Canceled milestone', 'inactive']
      ]);
    expect(result.deliveryHealth.completeMilestoneCount).toBe(1);
    expect(result.deliveryHealth.inactiveMilestoneCount).toBe(2);
  });

  it('treats completed milestones with open work as at risk', () => {
    const completedMilestone = milestone({
      id: '10000000-0000-4000-8000-000000000305',
      name: 'Completed with reopened work',
      status: 'completed'
    });
    const reopenedWork = workItem({
      id: '10000000-0000-4000-8000-000000000402',
      title: 'Reopened work',
      status: 'ready',
      milestoneId: completedMilestone.id
    });

    const result = derive({
      milestones: [completedMilestone],
      workItems: [reopenedWork]
    });

    expect(result.milestoneProgress[0]).toMatchObject({
      health: 'at_risk',
      openCount: 1,
      reasons: [
        expect.objectContaining({
          key: 'completed_with_open_work',
          query: {
            milestoneId: completedMilestone.id,
            workState: 'open',
            sort: 'priority_desc'
          }
        })
      ]
    });
  });

  it('marks blocked milestone health for target-date, manual-blocked, and dependency-blocked reasons', () => {
    const blockedMilestone = milestone({
      id: '10000000-0000-4000-8000-000000000306',
      name: 'Blocked milestone',
      targetDate: '2026-07-09'
    });
    const blocked = workItem({
      id: '10000000-0000-4000-8000-000000000403',
      title: 'Manually blocked work',
      status: 'blocked',
      priority: 'high',
      milestoneId: blockedMilestone.id,
      dueDate: '2026-07-09'
    });
    const dependencyBlocked = workItem({
      id: '10000000-0000-4000-8000-000000000404',
      title: 'Dependency blocked work',
      status: 'ready',
      priority: 'urgent',
      milestoneId: blockedMilestone.id
    });

    const result = derive({
      milestones: [blockedMilestone],
      workItems: [blocked, dependencyBlocked],
      dependencyBlockedWorkItems: [dependencyBlocked]
    });

    expect(result.milestoneProgress[0]).toMatchObject({
      health: 'blocked',
      openCount: 2,
      blockedCount: 1,
      dependencyBlockedCount: 1,
      overdueCount: 1
    });
    expect(result.milestoneProgress[0].reasons).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'target_date_past', severity: 'critical' }),
      expect.objectContaining({
        key: 'blocked_work',
        query: {
          milestoneId: blockedMilestone.id,
          status: 'blocked',
          sort: 'priority_desc'
        }
      }),
      expect.objectContaining({
        key: 'dependency_blocked',
        query: {
          milestoneId: blockedMilestone.id,
          dependency: 'dependency_blocked',
          sort: 'priority_desc'
        }
      })
    ]));
    expect(result.deliveryHealth.health).toBe('blocked');
    expect(result.deliveryHealth.blockedMilestoneCount).toBe(1);
  });

  it('marks due-soon, unassigned, and stale in-progress milestone work at risk', () => {
    const atRiskMilestone = milestone({
      id: '10000000-0000-4000-8000-000000000307',
      name: 'At-risk milestone',
      targetDate: '2026-07-20'
    });
    const dueSoon = workItem({
      id: '10000000-0000-4000-8000-000000000405',
      title: 'Due soon work',
      status: 'ready',
      assigneeId: null,
      milestoneId: atRiskMilestone.id,
      dueDate: '2026-07-15'
    });
    const stale = workItem({
      id: '10000000-0000-4000-8000-000000000406',
      title: 'Stale work',
      status: 'in_progress',
      milestoneId: atRiskMilestone.id,
      updatedAt: new Date('2026-07-01T12:00:00.000Z')
    });

    const result = derive({
      milestones: [atRiskMilestone],
      workItems: [dueSoon, stale]
    });

    expect(result.milestoneProgress[0]).toMatchObject({
      health: 'at_risk',
      dueSoonCount: 1,
      unassignedActiveCount: 1,
      staleInProgressCount: 1
    });
    expect(result.milestoneProgress[0].reasons.map((reason) => reason.key)).toEqual(expect.arrayContaining([
      'due_soon',
      'unassigned_active',
      'stale_in_progress'
    ]));
  });

  it('rolls unmilestoned active risk into project health and leaves unsupported reason links null', () => {
    const unmilestonedBlocked = workItem({
      id: '10000000-0000-4000-8000-000000000407',
      title: 'Unmilestoned dependency blocked work',
      status: 'ready',
      milestoneId: null
    });

    const result = derive({
      workItems: [unmilestonedBlocked],
      dependencyBlockedWorkItems: [unmilestonedBlocked]
    });

    expect(result.deliveryHealth).toMatchObject({
      health: 'blocked',
      openWorkCount: 1,
      dependencyBlockedWorkCount: 1,
      unmilestonedActiveRiskCount: 1
    });
    expect(result.deliveryHealth.reasons).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'dependency_blocked',
        query: {
          dependency: 'dependency_blocked',
          sort: 'priority_desc'
        }
      }),
      expect.objectContaining({
        key: 'unmilestoned_risk',
        query: null
      })
    ]));
  });

  it('marks archived projects inactive without deriving active project risk', () => {
    const archivedProject: Project = {
      ...baseProject,
      status: 'archived'
    };
    const openWork = workItem({
      id: '10000000-0000-4000-8000-000000000408',
      title: 'Open archived work',
      status: 'blocked'
    });

    const result = derive({
      project: archivedProject,
      workItems: [openWork]
    });

    expect(result.deliveryHealth).toMatchObject({
      health: 'inactive',
      openWorkCount: 0,
      blockedWorkCount: 0,
      reasons: [
        expect.objectContaining({
          key: 'inactive_milestone',
          message: 'Project is archived.'
        })
      ]
    });
  });

  it('builds deterministic planning review sections with limits and sorting', () => {
    const attentionMilestone = milestone({
      id: '10000000-0000-4000-8000-000000000308',
      name: 'Attention milestone',
      targetDate: '2026-07-12',
      updatedAt: new Date('2026-07-09T12:00:00.000Z')
    });
    const blocked = workItem({
      id: '10000000-0000-4000-8000-000000000409',
      title: 'Blocked first',
      status: 'blocked',
      priority: 'urgent',
      milestoneId: attentionMilestone.id,
      dueDate: '2026-07-09',
      updatedAt: new Date('2026-07-08T12:00:00.000Z')
    });
    const dueSoon = workItem({
      id: '10000000-0000-4000-8000-000000000410',
      title: 'Upcoming work',
      status: 'ready',
      priority: 'low',
      milestoneId: attentionMilestone.id,
      dueDate: '2026-07-11',
      updatedAt: new Date('2026-07-10T10:00:00.000Z')
    });
    const recent = workItem({
      id: '10000000-0000-4000-8000-000000000411',
      title: 'Recently changed',
      status: 'in_progress',
      milestoneId: attentionMilestone.id,
      updatedAt: new Date('2026-07-10T11:00:00.000Z')
    });

    const result = derive({
      milestones: [attentionMilestone],
      workItems: [blocked, dueSoon, recent]
    });

    expect(result.planningReview.needsAttention).toHaveLength(2);
    expect(result.planningReview.needsAttention[0]).toMatchObject({
      kind: 'work_item',
      title: 'Blocked first',
      severity: 'critical'
    });
    expect(result.planningReview.upcoming.map((item) => item.title)).toEqual([
      'Upcoming work',
      'Attention milestone'
    ]);
    expect(result.planningReview.recentlyChanged.map((item) => item.title).slice(0, 3)).toEqual([
      'Recently changed',
      'Upcoming work',
      'Attention milestone'
    ]);
  });
});
