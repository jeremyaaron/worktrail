import { describe, expect, expectTypeOf, it } from 'vitest';

import type {
  ActivityEventDto,
  CreateWorkItemRequest,
  MemberDto,
  PlanningRiskItemDto,
  SetWorkItemParentRequest,
  WorkItemChildSummaryDto,
  WorkItemChildrenDto,
  WorkItemHierarchyFilter,
  WorkItemListItemDto,
  WorkItemParentCandidateDto,
  WorkItemParentDto,
  WorkItemQuery
} from './index.js';

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

const parent = {
  id: 'parent-work-item-id',
  projectId: 'project-id',
  displayKey: 'WT-42',
  title: 'Deliver saved work breakdowns',
  type: 'story',
  status: 'in_progress'
} satisfies WorkItemParentDto;

const childSummary = {
  totalCount: 4,
  openCount: 2,
  doneCount: 1,
  canceledCount: 1,
  estimatedCount: 3,
  unestimatedCount: 1,
  estimatePoints: 8
} satisfies WorkItemChildSummaryDto;

const child = {
  id: 'child-work-item-id',
  workspaceId: 'workspace-id',
  projectId: 'project-id',
  itemNumber: 43,
  displayKey: 'WT-43',
  title: 'Add hierarchy query contracts',
  type: 'task',
  status: 'ready',
  priority: 'high',
  assignee: member,
  reporter: member,
  labels: [],
  milestone: null,
  cycle: null,
  boardPosition: 1024,
  dueDate: null,
  estimatePoints: 3,
  parent,
  childSummary: null,
  dependencyBlocked: false,
  openBlockerCount: 0,
  openBlockedWorkCount: 0,
  createdAt: '2026-07-05T00:00:00.000Z',
  updatedAt: '2026-07-06T00:00:00.000Z'
} satisfies WorkItemListItemDto;

describe('work item hierarchy contracts', () => {
  it('keeps parent identity shallow and child progress explicit', () => {
    expect(parent).toEqual({
      id: 'parent-work-item-id',
      projectId: 'project-id',
      displayKey: 'WT-42',
      title: 'Deliver saved work breakdowns',
      type: 'story',
      status: 'in_progress'
    });
    expect(
      childSummary.openCount + childSummary.doneCount + childSummary.canceledCount
    ).toBe(childSummary.totalCount);
    expect(childSummary.estimatedCount + childSummary.unestimatedCount).toBe(
      childSummary.totalCount
    );
    expect(childSummary.estimatePoints).toBe(8);
    expectTypeOf(parent).toMatchTypeOf<WorkItemParentDto>();
    expectTypeOf(childSummary).toMatchTypeOf<WorkItemChildSummaryDto>();
  });

  it('supports bounded children and eligible parent candidate shapes', () => {
    const children = {
      items: [child],
      totalCount: 4,
      hasMore: true
    } satisfies WorkItemChildrenDto;
    const candidate = {
      ...parent,
      priority: 'high',
      updatedAt: '2026-07-06T00:00:00.000Z'
    } satisfies WorkItemParentCandidateDto;

    expect(children.items[0]?.parent?.displayKey).toBe('WT-42');
    expect(children.hasMore).toBe(true);
    expect(candidate.priority).toBe('high');
    expectTypeOf(children).toMatchTypeOf<WorkItemChildrenDto>();
    expectTypeOf(candidate).toMatchTypeOf<WorkItemParentCandidateDto>();
  });

  it('requires an explicit nullable parent command and allows parent identity on create', () => {
    const setRequest = {
      parentWorkItemId: parent.id
    } satisfies SetWorkItemParentRequest;
    const clearRequest = {
      parentWorkItemId: null
    } satisfies SetWorkItemParentRequest;
    const createRequest = {
      title: child.title,
      type: child.type,
      priority: child.priority,
      parentWorkItemId: parent.id
    } satisfies CreateWorkItemRequest;

    expect(setRequest.parentWorkItemId).toBe(parent.id);
    expect(clearRequest.parentWorkItemId).toBeNull();
    expect(createRequest.parentWorkItemId).toBe(parent.id);
    expectTypeOf(setRequest).toMatchTypeOf<SetWorkItemParentRequest>();
    expectTypeOf(clearRequest).toMatchTypeOf<SetWorkItemParentRequest>();
    expectTypeOf(createRequest).toMatchTypeOf<CreateWorkItemRequest>();
  });

  it('supports hierarchy modes and readable exact-parent query state', () => {
    const hierarchyModes = [
      'top_level',
      'children',
      'parents'
    ] satisfies WorkItemHierarchyFilter[];
    const hierarchyQuery = {
      hierarchy: 'parents',
      status: 'in_progress'
    } satisfies WorkItemQuery;
    const exactParentQuery = {
      parentKey: parent.displayKey,
      sort: 'priority_desc'
    } satisfies WorkItemQuery;

    expect(hierarchyModes).toEqual(['top_level', 'children', 'parents']);
    expect(hierarchyQuery.hierarchy).toBe('parents');
    expect(exactParentQuery.parentKey).toBe('WT-42');
    expectTypeOf(hierarchyModes).toMatchTypeOf<WorkItemHierarchyFilter[]>();
    expectTypeOf(hierarchyQuery).toMatchTypeOf<WorkItemQuery>();
    expectTypeOf(exactParentQuery).toMatchTypeOf<WorkItemQuery>();
  });

  it('keeps planning risk parent context optional for stored snapshot compatibility', () => {
    const legacyRiskItem = {
      id: child.id,
      displayKey: child.displayKey,
      title: child.title,
      status: child.status,
      priority: child.priority,
      assignee: child.assignee,
      dueDate: child.dueDate,
      milestone: child.milestone,
      updatedAt: child.updatedAt
    } satisfies PlanningRiskItemDto;
    const hierarchyRiskItem = {
      ...legacyRiskItem,
      parent
    } satisfies PlanningRiskItemDto;

    expect('parent' in legacyRiskItem).toBe(false);
    expect(hierarchyRiskItem.parent.displayKey).toBe('WT-42');
    expectTypeOf(legacyRiskItem).toMatchTypeOf<PlanningRiskItemDto>();
    expectTypeOf(hierarchyRiskItem).toMatchTypeOf<PlanningRiskItemDto>();
  });

  it('includes parent changes in work item activity vocabulary', () => {
    const event = {
      id: 'activity-id',
      workspaceId: child.workspaceId,
      projectId: child.projectId,
      workItemId: child.id,
      actor: member,
      eventType: 'work_item.parent_changed',
      summary: 'Parent changed.',
      previousValue: { parent: null },
      newValue: { parent },
      metadata: {},
      createdAt: '2026-07-06T00:00:00.000Z'
    } satisfies ActivityEventDto;

    expect(event.eventType).toBe('work_item.parent_changed');
    expect(event.newValue.parent).toBe(parent);
    expectTypeOf(event).toMatchTypeOf<ActivityEventDto>();
  });
});
