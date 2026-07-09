import { describe, expect, expectTypeOf, it } from 'vitest';

import type {
  CreateSavedWorkViewRequest,
  DeliveryHealthReasonDto,
  ListSavedWorkViewsQuery,
  ProjectPlanningSummaryDto,
  SavedWorkViewDto,
  UpdateSavedWorkViewRequest,
  WorkItemQuery
} from './index.js';

describe('work item query contracts', () => {
  it('supports representative workspace discovery filters', () => {
    const query = {
      projectId: '0f8fad5b-d9cb-469f-a165-70867728950e',
      status: 'blocked',
      assigneeState: 'assigned',
      dueDateState: 'due_soon',
      dependency: 'dependency_blocked',
      workRisk: 'stale_in_progress',
      cycleId: 'c29686e0-b0ab-4ac8-901f-b9c6ca5963f9',
      archivedProjects: 'exclude',
      search: 'api',
      sort: 'priority_desc'
    } satisfies WorkItemQuery;

    expect(query).toEqual({
      projectId: '0f8fad5b-d9cb-469f-a165-70867728950e',
      status: 'blocked',
      assigneeState: 'assigned',
      dueDateState: 'due_soon',
      dependency: 'dependency_blocked',
      workRisk: 'stale_in_progress',
      cycleId: 'c29686e0-b0ab-4ac8-901f-b9c6ca5963f9',
      archivedProjects: 'exclude',
      search: 'api',
      sort: 'priority_desc'
    });
    expectTypeOf(query).toMatchTypeOf<WorkItemQuery>();
  });

  it('allows saved views and health reasons to carry the canonical query model', () => {
    const query = {
      workState: 'open',
      labelId: '7a1db469-7e07-4e7f-a581-114746f1f88d',
      sort: 'updated_desc'
    } satisfies WorkItemQuery;

    const savedView = {
      id: 'view-id',
      workspaceId: 'workspace-id',
      projectId: null,
      owner: {
        id: 'member-id',
        workspaceId: 'workspace-id',
        name: 'Avery Owner',
        email: 'avery@example.com',
        role: 'owner',
        isActive: true,
        deactivatedAt: null,
        createdAt: '2026-07-05T00:00:00.000Z',
        updatedAt: '2026-07-05T00:00:00.000Z'
      },
      name: 'Open design work',
      scope: 'workspace',
      visibility: 'workspace',
      isPinned: true,
      query,
      createdAt: '2026-07-05T00:00:00.000Z',
      updatedAt: '2026-07-05T00:00:00.000Z'
    } satisfies SavedWorkViewDto;
    const createRequest = {
      name: 'Open design work',
      scope: 'workspace',
      visibility: 'workspace',
      query
    } satisfies CreateSavedWorkViewRequest;
    const projectCreateRequest = {
      name: 'Ready for QA',
      scope: 'project',
      projectId: 'f7c0c5aa-6d66-48a3-af01-3be972c22dc6',
      visibility: 'workspace',
      query: {
        status: 'ready',
        sort: 'board_order'
      }
    } satisfies CreateSavedWorkViewRequest;
    const listRequest = {
      scope: 'project',
      projectId: 'f7c0c5aa-6d66-48a3-af01-3be972c22dc6'
    } satisfies ListSavedWorkViewsQuery;
    const updateRequest = {
      isPinned: false
    } satisfies UpdateSavedWorkViewRequest;

    const healthReason = {
      key: 'dependency_blocked',
      severity: 'critical',
      message: '2 work items are blocked by dependencies',
      count: 2,
      query
    } satisfies DeliveryHealthReasonDto;

    expect(savedView.query).toBe(query);
    expect(savedView.scope).toBe('workspace');
    expect(createRequest.visibility).toBe('workspace');
    expect(projectCreateRequest.scope).toBe('project');
    expect(listRequest.projectId).toBe(projectCreateRequest.projectId);
    expect(updateRequest.isPinned).toBe(false);
    expect(healthReason.query).toBe(query);
    expectTypeOf(savedView.query).toMatchTypeOf<WorkItemQuery>();
  });

  it('keeps planning review query links optional', () => {
    const planningSummary = {
      project: {
        id: 'project-id',
        workspaceId: 'workspace-id',
        key: 'OPS',
        name: 'Operations',
        description: '',
        status: 'active',
        createdAt: '2026-07-05T00:00:00.000Z',
        updatedAt: '2026-07-05T00:00:00.000Z'
      },
      deliveryHealth: {
        health: 'healthy',
        activeMilestoneCount: 0,
        healthyMilestoneCount: 0,
        atRiskMilestoneCount: 0,
        blockedMilestoneCount: 0,
        completeMilestoneCount: 0,
        inactiveMilestoneCount: 0,
        openWorkCount: 0,
        blockedWorkCount: 0,
        dependencyBlockedWorkCount: 0,
        blockingOpenWorkCount: 0,
        overdueWorkCount: 0,
        dueSoonWorkCount: 0,
        unassignedActiveWorkCount: 0,
        staleInProgressWorkCount: 0,
        unmilestonedActiveRiskCount: 0,
        reasons: []
      },
      milestoneProgress: [],
      activeCycle: null,
      upcomingCycle: null,
      recentlyCompletedCycle: null,
      planningReview: {
        needsAttention: [
          {
            id: 'review-item-id',
            kind: 'work_item',
            title: 'Investigate blocker',
            detail: 'blocked · high',
            severity: 'critical',
            workItemId: 'work-item-id',
            milestoneId: null,
            displayKey: 'OPS-12',
            dueDate: null,
            updatedAt: '2026-07-05T00:00:00.000Z',
            query: null
          }
        ],
        upcoming: [],
        recentlyChanged: []
      },
      blockedWork: [],
      overdueWork: [],
      dueSoonWork: [],
      unassignedActiveWork: [],
      staleInProgressWork: [],
      dependencyBlockedWork: [],
      blockingOpenWork: []
    } satisfies ProjectPlanningSummaryDto;

    expect(planningSummary.planningReview.needsAttention[0]?.query).toBeNull();
  });
});
