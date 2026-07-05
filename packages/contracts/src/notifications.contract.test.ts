import { describe, expect, expectTypeOf, it } from 'vitest';

import type {
  CommentDto,
  CreateCommentRequest,
  MemberDto,
  NotificationDto,
  NotificationListResponse,
  WorkItemWatchStateDto
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

describe('notification contracts', () => {
  it('supports actor-scoped notification list responses', () => {
    const notification = {
      id: 'notification-id',
      type: 'mention',
      summary: 'Avery mentioned you on WT-12.',
      actor: member,
      project: {
        id: 'project-id',
        key: 'WT',
        name: 'Worktrail'
      },
      workItem: {
        id: 'work-item-id',
        displayKey: 'WT-12',
        title: 'Route important updates to collaborators',
        status: 'in_progress'
      },
      metadata: {
        commentId: 'comment-id'
      },
      readAt: null,
      createdAt: '2026-07-05T00:00:00.000Z'
    } satisfies NotificationDto;

    const response = {
      items: [notification],
      unreadCount: 1
    } satisfies NotificationListResponse;

    expect(response.items[0]?.type).toBe('mention');
    expectTypeOf(response).toMatchTypeOf<NotificationListResponse>();
  });

  it('supports watch state with member-backed watcher rows', () => {
    const watchState = {
      isWatchedByCurrentActor: true,
      watcherCount: 1,
      watchers: [
        {
          id: 'watcher-id',
          member,
          watchedAt: '2026-07-05T00:00:00.000Z'
        }
      ]
    } satisfies WorkItemWatchStateDto;

    expect(watchState.watcherCount).toBe(1);
    expectTypeOf(watchState).toMatchTypeOf<WorkItemWatchStateDto>();
  });

  it('keeps comment mentions optional on create and explicit on response', () => {
    const request: CreateCommentRequest = {
      body: 'Can you review this?'
    };

    const response = {
      id: 'comment-id',
      workspaceId: 'workspace-id',
      projectId: 'project-id',
      workItemId: 'work-item-id',
      author: member,
      body: 'Can you review this?',
      mentions: [member],
      isEdited: false,
      isDeleted: false,
      editedAt: null,
      deletedAt: null,
      deletedBy: null,
      createdAt: '2026-07-05T00:00:00.000Z',
      updatedAt: '2026-07-05T00:00:00.000Z'
    } satisfies CommentDto;

    expect(request.mentionMemberIds).toBeUndefined();
    expect(response.mentions).toHaveLength(1);
    expectTypeOf(response.mentions).toMatchTypeOf<MemberDto[]>();
  });
});
