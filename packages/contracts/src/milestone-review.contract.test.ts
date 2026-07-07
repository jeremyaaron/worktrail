import { describe, expect, expectTypeOf, it } from 'vitest';

import type {
  MemberDto,
  MilestoneDto,
  MilestoneReviewDto,
  MilestoneReviewRiskSectionDto,
  MilestoneReviewRiskType,
  MilestoneReviewScopeBreakdownDto,
  PlanningRiskItemDto,
  ProjectDto,
  WorkItemQuery,
  WorkItemRiskFilter
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
  workspaceId: 'workspace-id',
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
  workspaceId: 'workspace-id',
  projectId: project.id,
  name: 'July release',
  description: 'Release readiness milestone.',
  status: 'active',
  targetDate: '2026-07-31',
  isArchived: false,
  archivedAt: null,
  createdAt: '2026-07-05T00:00:00.000Z',
  updatedAt: '2026-07-05T00:00:00.000Z'
} satisfies MilestoneDto;

const riskItem = {
  id: 'work-item-id',
  displayKey: 'WT-12',
  title: 'Resolve release blocker',
  status: 'blocked',
  priority: 'high',
  assignee: member,
  dueDate: '2026-07-20',
  milestone,
  updatedAt: '2026-07-06T00:00:00.000Z'
} satisfies PlanningRiskItemDto;

describe('milestone review contracts', () => {
  it('supports the derived milestone review response shape', () => {
    const scopedWorkQuery = {
      milestoneId: milestone.id,
      sort: 'priority_desc'
    } satisfies WorkItemQuery;
    const scopeBreakdown = {
      statusCounts: {
        backlog: 0,
        ready: 1,
        in_progress: 1,
        blocked: 1,
        done: 2,
        canceled: 0
      },
      priorityCounts: {
        low: 0,
        medium: 2,
        high: 2,
        urgent: 1
      },
      assignedCount: 4,
      unassignedCount: 1,
      dueDate: {
        overdueCount: 1,
        dueSoonCount: 1,
        laterCount: 2,
        noneCount: 1
      },
      dependency: {
        dependencyBlockedCount: 1,
        blockingOpenWorkCount: 1
      }
    } satisfies MilestoneReviewScopeBreakdownDto;
    const riskSection = {
      type: 'blocked',
      title: 'Blocked work',
      description: 'Work items currently blocked in this milestone.',
      count: 1,
      query: {
        milestoneId: milestone.id,
        status: 'blocked',
        sort: 'priority_desc'
      },
      items: [riskItem]
    } satisfies MilestoneReviewRiskSectionDto;
    const response = {
      project,
      milestone,
      progress: {
        milestone,
        totalCount: 5,
        doneCount: 2,
        openCount: 3,
        blockedCount: 1,
        dependencyBlockedCount: 1,
        overdueCount: 1,
        dueSoonCount: 1,
        unassignedActiveCount: 1,
        staleInProgressCount: 1,
        health: 'at_risk',
        reasons: [
          {
            key: 'blocked_work',
            severity: 'warning',
            message: '1 work item is blocked.',
            count: 1,
            query: riskSection.query
          }
        ]
      },
      scopedWorkQuery,
      scopeBreakdown,
      riskSections: [riskSection],
      recentlyChangedWork: [riskItem]
    } satisfies MilestoneReviewDto;

    expect(response.project.key).toBe('WT');
    expect(response.progress.health).toBe('at_risk');
    expect(response.scopeBreakdown.statusCounts.blocked).toBe(1);
    expect(response.riskSections[0]?.type).toBe('blocked');
    expect(response.recentlyChangedWork[0]?.displayKey).toBe('WT-12');
    expectTypeOf(response).toMatchTypeOf<MilestoneReviewDto>();
  });

  it('supports milestone review risk types and work-risk query filters', () => {
    const riskTypes = [
      'blocked',
      'dependency_blocked',
      'overdue',
      'due_soon',
      'unassigned_active',
      'stale_in_progress',
      'blocking_open_work'
    ] satisfies MilestoneReviewRiskType[];
    const workRiskFilters = [
      'unassigned_active',
      'stale_in_progress'
    ] satisfies WorkItemRiskFilter[];
    const query = {
      milestoneId: milestone.id,
      workRisk: 'unassigned_active',
      sort: 'priority_desc'
    } satisfies WorkItemQuery;

    expect(riskTypes).toContain('stale_in_progress');
    expect(workRiskFilters).toEqual(['unassigned_active', 'stale_in_progress']);
    expect(query.workRisk).toBe('unassigned_active');
    expectTypeOf(query.workRisk).toMatchTypeOf<WorkItemRiskFilter | undefined>();
  });
});
