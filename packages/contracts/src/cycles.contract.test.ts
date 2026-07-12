import { describe, expect, expectTypeOf, it } from 'vitest';

import type {
  ActivityEventType,
  CreateProjectCycleRequest,
  CycleReviewRiskSectionDto,
  CycleReviewRiskType,
  CycleReviewScopeBreakdownDto,
  DeliveryHealthReasonDto,
  DeliveryHealthState,
  MemberDto,
  MilestoneDto,
  PlanningRiskItemDto,
  ProjectCycleDto,
  ProjectCycleReviewDto,
  ProjectCycleStatus,
  ProjectDto,
  ProjectPlanningCycleSummaryDto,
  UpdateProjectCycleRequest,
  WorkItemQuery
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

const cycle = {
  id: 'cycle-id',
  workspaceId: project.workspaceId,
  projectId: project.id,
  name: 'v0.2.1 Cycle Planning',
  goal: 'Commit and review cycle planning scope.',
  status: 'active',
  startDate: '2026-07-06',
  endDate: '2026-07-17',
  targetPoints: 24,
  isArchived: false,
  archivedAt: null,
  createdAt: '2026-07-05T00:00:00.000Z',
  updatedAt: '2026-07-06T00:00:00.000Z'
} satisfies ProjectCycleDto;

const scopedWorkQuery = {
  cycleId: cycle.id,
  sort: 'priority_desc'
} satisfies WorkItemQuery;

const riskItem = {
  id: 'work-item-id',
  displayKey: 'WT-42',
  title: 'Wire cycle filters through saved views',
  status: 'in_progress',
  priority: 'high',
  assignee: member,
  dueDate: '2026-07-10',
  milestone,
  updatedAt: '2026-07-06T00:00:00.000Z'
} satisfies PlanningRiskItemDto;

const progress = {
  totalCount: 6,
  openCount: 4,
  doneCount: 2,
  blockedCount: 1,
  dependencyBlockedCount: 1,
  committedEstimatePoints: 21,
  completedEstimatePoints: 8,
  unestimatedCount: 1,
  targetPoints: cycle.targetPoints
};

const health = {
  health: 'at_risk',
  reasons: [
    {
      key: 'blocked_work',
      severity: 'warning',
      message: '1 work item is blocked.',
      count: 1,
      query: {
        cycleId: cycle.id,
        status: 'blocked',
        sort: 'priority_desc'
      }
    }
  ]
} satisfies {
  health: DeliveryHealthState;
  reasons: DeliveryHealthReasonDto[];
};

describe('cycle contracts', () => {
  it('supports project cycle DTOs and create/update request shapes', () => {
    const statuses = [
      'planned',
      'active',
      'completed',
      'canceled'
    ] satisfies ProjectCycleStatus[];
    const createRequest = {
      name: cycle.name,
      goal: cycle.goal,
      status: 'planned',
      startDate: cycle.startDate,
      endDate: cycle.endDate,
      targetPoints: cycle.targetPoints
    } satisfies CreateProjectCycleRequest;
    const updateRequest = {
      status: 'active',
      targetPoints: 26
    } satisfies UpdateProjectCycleRequest;

    expect(statuses).toEqual(['planned', 'active', 'completed', 'canceled']);
    expect(createRequest.startDate).toBe('2026-07-06');
    expect(updateRequest.targetPoints).toBe(26);
    expectTypeOf(cycle).toMatchTypeOf<ProjectCycleDto>();
    expectTypeOf(createRequest).toMatchTypeOf<CreateProjectCycleRequest>();
    expectTypeOf(updateRequest).toMatchTypeOf<UpdateProjectCycleRequest>();
  });

  it('supports cycle review summaries, risk sections, and query links', () => {
    const scopeBreakdown = {
      statusCounts: {
        backlog: 0,
        ready: 1,
        in_progress: 2,
        blocked: 1,
        done: 2,
        canceled: 0
      },
      priorityCounts: {
        low: 0,
        medium: 2,
        high: 3,
        urgent: 1
      },
      assignedCount: 5,
      unassignedCount: 1,
      dueDate: {
        overdueCount: 1,
        dueSoonCount: 2,
        laterCount: 1,
        noneCount: 2
      },
      dependency: {
        dependencyBlockedCount: 1,
        blockingOpenWorkCount: 1
      }
    } satisfies CycleReviewScopeBreakdownDto;
    const riskSection = {
      type: 'blocked',
      title: 'Blocked work',
      description: 'Work currently blocked in this cycle.',
      count: 1,
      query: {
        cycleId: cycle.id,
        status: 'blocked',
        sort: 'priority_desc'
      },
      items: [riskItem]
    } satisfies CycleReviewRiskSectionDto;
    const review = {
      project,
      cycle,
      progress,
      health,
      scopedWorkQuery,
      scopeBreakdown,
      riskSections: [riskSection],
      recentlyChangedWork: [riskItem],
      closeout: null
    } satisfies ProjectCycleReviewDto;

    expect(review.progress.committedEstimatePoints).toBe(21);
    expect(review.health.health).toBe('at_risk');
    expect(review.scopeBreakdown.dependency.dependencyBlockedCount).toBe(1);
    expect(review.riskSections[0]?.query.cycleId).toBe(cycle.id);
  });

  it('supports planning cycle summaries and cycle activity event types', () => {
    const summary = {
      cycle,
      progress,
      health,
      scopedWorkQuery,
      closeout: null
    } satisfies ProjectPlanningCycleSummaryDto;
    const riskTypes = [
      'blocked',
      'dependency_blocked',
      'overdue',
      'due_soon',
      'unassigned_active',
      'stale_in_progress',
      'unestimated',
      'over_target',
      'blocking_open_work'
    ] satisfies CycleReviewRiskType[];
    const eventType = 'work_item.cycle_changed' satisfies ActivityEventType;

    expect(summary.scopedWorkQuery.cycleId).toBe(cycle.id);
    expect(riskTypes).toContain('over_target');
    expect(eventType).toBe('work_item.cycle_changed');
  });
});
