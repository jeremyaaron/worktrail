import { describe, expect, expectTypeOf, it } from 'vitest';

import type {
  ActivityEventDto,
  BulkUpdateWorkItemsAction,
  BulkUpdateWorkItemsErrorDto,
  BulkUpdateWorkItemsRequest,
  BulkUpdateWorkItemsResponseDto,
  MemberDto,
  WorkItemListItemDto
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

const workItem = {
  id: 'work-item-id',
  workspaceId: 'workspace-id',
  projectId: 'project-id',
  itemNumber: 12,
  displayKey: 'WT-12',
  title: 'Prepare QA batch',
  type: 'task',
  status: 'ready',
  priority: 'high',
  assignee: member,
  reporter: member,
  labels: [
    {
      id: 'label-id',
      name: 'qa',
      color: '#2563eb',
      isArchived: false,
      archivedAt: null
    }
  ],
  milestone: {
    id: 'milestone-id',
    workspaceId: 'workspace-id',
    projectId: 'project-id',
    name: 'July release',
    description: '',
    status: 'active',
    targetDate: '2026-07-31',
    isArchived: false,
    archivedAt: null,
    createdAt: '2026-07-05T00:00:00.000Z',
    updatedAt: '2026-07-05T00:00:00.000Z'
  },
  boardPosition: 1000,
  dueDate: '2026-07-20',
  estimatePoints: 3,
  dependencyBlocked: false,
  openBlockerCount: 0,
  openBlockedWorkCount: 0,
  createdAt: '2026-07-05T00:00:00.000Z',
  updatedAt: '2026-07-05T00:00:00.000Z'
} satisfies WorkItemListItemDto;

describe('work item bulk update contracts', () => {
  it('supports every explicit bulk update action shape', () => {
    const actions = [
      { type: 'set_assignee', assigneeId: member.id },
      { type: 'clear_assignee' },
      { type: 'set_priority', priority: 'urgent' },
      { type: 'set_milestone', milestoneId: 'milestone-id' },
      { type: 'clear_milestone' },
      { type: 'set_due_date', dueDate: '2026-07-24' },
      { type: 'clear_due_date' },
      { type: 'add_labels', labelIds: ['label-id'] },
      { type: 'remove_labels', labelIds: ['label-id'] },
      { type: 'transition_status', status: 'in_progress' }
    ] satisfies BulkUpdateWorkItemsAction[];

    const request = {
      workItemIds: [workItem.id],
      action: actions[0]
    } satisfies BulkUpdateWorkItemsRequest;

    expect(actions.map((action) => action.type)).toEqual([
      'set_assignee',
      'clear_assignee',
      'set_priority',
      'set_milestone',
      'clear_milestone',
      'set_due_date',
      'clear_due_date',
      'add_labels',
      'remove_labels',
      'transition_status'
    ]);
    expect(request.workItemIds).toEqual([workItem.id]);
    expectTypeOf(actions).toMatchTypeOf<BulkUpdateWorkItemsAction[]>();
    expectTypeOf(request).toMatchTypeOf<BulkUpdateWorkItemsRequest>();
  });

  it('supports updated, unchanged, and failed result rows', () => {
    const error = {
      code: 'WORKFLOW_TRANSITION_ERROR',
      message: 'The requested status transition is not allowed.'
    } satisfies BulkUpdateWorkItemsErrorDto;

    const response = {
      requestedCount: 3,
      succeededCount: 1,
      unchangedCount: 1,
      failedCount: 1,
      results: [
        {
          workItemId: workItem.id,
          displayKey: workItem.displayKey,
          status: 'updated',
          workItem,
          error: null
        },
        {
          workItemId: 'unchanged-work-item-id',
          displayKey: 'WT-13',
          status: 'unchanged',
          workItem,
          error: null
        },
        {
          workItemId: 'failed-work-item-id',
          displayKey: 'WT-14',
          status: 'failed',
          workItem: null,
          error
        }
      ]
    } satisfies BulkUpdateWorkItemsResponseDto;

    expect(response.requestedCount).toBe(3);
    expect(response.results.map((result) => result.status)).toEqual(['updated', 'unchanged', 'failed']);
    expect(response.results[2]?.error?.code).toBe('WORKFLOW_TRANSITION_ERROR');
    expectTypeOf(response).toMatchTypeOf<BulkUpdateWorkItemsResponseDto>();
  });

  it('includes due date changes in work item activity events', () => {
    const event = {
      id: 'activity-id',
      workspaceId: 'workspace-id',
      projectId: 'project-id',
      workItemId: workItem.id,
      actor: member,
      eventType: 'work_item.due_date_changed',
      summary: 'Due date changed.',
      previousValue: { dueDate: '2026-07-20' },
      newValue: { dueDate: '2026-07-24' },
      metadata: {},
      createdAt: '2026-07-05T00:00:00.000Z'
    } satisfies ActivityEventDto;

    expect(event.eventType).toBe('work_item.due_date_changed');
    expectTypeOf(event).toMatchTypeOf<ActivityEventDto>();
  });
});
