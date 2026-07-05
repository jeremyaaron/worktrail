import type {
  NotificationDto,
  NotificationListResponse,
  NotificationStateFilter,
  NotificationUnreadCountResponse,
  UpdateNotificationReadStateRequest
} from '@worktrail/contracts';
import { randomUUID } from 'node:crypto';

import type { ActorContext } from '../domain/actor.js';
import type { NotificationType } from '../domain/constants.js';
import { NotFoundError } from '../errors/app-error.js';
import type { Repositories } from '../repositories/index.js';
import type {
  Comment,
  Member,
  NewNotification,
  Notification,
  Project,
  WorkItem,
  WorkItemRelationship
} from '../repositories/types.js';
import { toMemberDto } from './dto.js';

export interface NotificationServiceContext {
  actor: ActorContext;
  repositories: Repositories;
  clock?: () => Date;
  idGenerator?: () => string;
}

export class NotificationService {
  private readonly clock: () => Date;
  private readonly idGenerator: () => string;

  constructor(private readonly context: NotificationServiceContext) {
    this.clock = context.clock ?? (() => new Date());
    this.idGenerator = context.idGenerator ?? randomUUID;
  }

  async listNotifications(state: NotificationStateFilter): Promise<NotificationListResponse> {
    const [notifications, unreadCount] = await Promise.all([
      this.context.repositories.notifications.listByRecipient({
        workspaceId: this.context.actor.workspaceId,
        recipientMemberId: this.context.actor.memberId,
        state,
        limit: 100
      }),
      this.getUnreadCountValue()
    ]);

    return {
      items: await Promise.all(notifications.map((notification) => this.toNotificationDto(notification))),
      unreadCount
    };
  }

  async getUnreadCount(): Promise<NotificationUnreadCountResponse> {
    return {
      unreadCount: await this.getUnreadCountValue()
    };
  }

  async updateReadState(
    notificationId: string,
    input: UpdateNotificationReadStateRequest
  ): Promise<NotificationDto> {
    const notification = await this.context.repositories.notifications.setReadState({
      id: notificationId,
      workspaceId: this.context.actor.workspaceId,
      recipientMemberId: this.context.actor.memberId,
      readAt: input.read ? this.clock() : null
    });

    if (notification === null) {
      throw new NotFoundError('Notification not found.');
    }

    return this.toNotificationDto(notification);
  }

  async markAllRead(): Promise<NotificationUnreadCountResponse> {
    await this.context.repositories.notifications.markAllRead({
      workspaceId: this.context.actor.workspaceId,
      recipientMemberId: this.context.actor.memberId,
      readAt: this.clock()
    });

    return this.getUnreadCount();
  }

  async recordWorkItemCreated(input: {
    repositories: Repositories;
    workItem: WorkItem;
    activityEventId: string | null;
    timestamp: Date;
  }): Promise<void> {
    await this.watchMembers({
      repositories: input.repositories,
      workItem: input.workItem,
      memberIds: [input.workItem.reporterId, input.workItem.assigneeId],
      timestamp: input.timestamp
    });

    if (input.workItem.assigneeId === null) {
      return;
    }

    await this.createNotifications({
      repositories: input.repositories,
      workItem: input.workItem,
      activityEventId: input.activityEventId,
      timestamp: input.timestamp,
      type: 'assignment',
      recipientMemberIds: [input.workItem.assigneeId],
      sourceEventKey: `work-item:${input.workItem.id}:created:assignment`,
      summary: `${input.workItem.displayKey} was assigned to you.`,
      metadata: { assigneeId: input.workItem.assigneeId }
    });
  }

  async recordWorkItemStatusChanged(input: {
    repositories: Repositories;
    workItem: WorkItem;
    previousStatus: WorkItem['status'];
    activityEventId: string | null;
    timestamp: Date;
  }): Promise<void> {
    const watcherIds = await input.repositories.workItemWatchers.listActiveMemberIdsByWorkItem(input.workItem.id);

    await this.createNotifications({
      repositories: input.repositories,
      workItem: input.workItem,
      activityEventId: input.activityEventId,
      timestamp: input.timestamp,
      type: 'watched_status_change',
      recipientMemberIds: watcherIds,
      sourceEventKey: `work-item:${input.workItem.id}:status:${input.timestamp.toISOString()}`,
      summary: `${input.workItem.displayKey} moved from ${input.previousStatus} to ${input.workItem.status}.`,
      metadata: {
        previousStatus: input.previousStatus,
        status: input.workItem.status
      }
    });
  }

  async recordWorkItemAssigneeChanged(input: {
    repositories: Repositories;
    workItem: WorkItem;
    previousAssigneeId: string | null;
    activityEventId: string | null;
    timestamp: Date;
  }): Promise<void> {
    await this.watchMembers({
      repositories: input.repositories,
      workItem: input.workItem,
      memberIds: [input.workItem.assigneeId],
      timestamp: input.timestamp
    });

    const assignmentRecipientIds = input.workItem.assigneeId === null ? [] : [input.workItem.assigneeId];
    await this.createNotifications({
      repositories: input.repositories,
      workItem: input.workItem,
      activityEventId: input.activityEventId,
      timestamp: input.timestamp,
      type: 'assignment',
      recipientMemberIds: assignmentRecipientIds,
      sourceEventKey: `work-item:${input.workItem.id}:assignee:${input.timestamp.toISOString()}:assignment`,
      summary: `${input.workItem.displayKey} was assigned to you.`,
      metadata: {
        previousAssigneeId: input.previousAssigneeId,
        assigneeId: input.workItem.assigneeId
      }
    });

    const watcherIds = await input.repositories.workItemWatchers.listActiveMemberIdsByWorkItem(input.workItem.id);
    await this.createNotifications({
      repositories: input.repositories,
      workItem: input.workItem,
      activityEventId: input.activityEventId,
      timestamp: input.timestamp,
      type: 'watched_assignee_change',
      recipientMemberIds: watcherIds,
      excludeMemberIds: assignmentRecipientIds,
      sourceEventKey: `work-item:${input.workItem.id}:assignee:${input.timestamp.toISOString()}:watchers`,
      summary: `${input.workItem.displayKey} assignment changed.`,
      metadata: {
        previousAssigneeId: input.previousAssigneeId,
        assigneeId: input.workItem.assigneeId
      }
    });
  }

  async recordCommentCreated(input: {
    repositories: Repositories;
    workItem: WorkItem;
    comment: Comment;
    mentionedMemberIds: string[];
    activityEventId: string | null;
    timestamp: Date;
  }): Promise<void> {
    const mentionRecipientIds = [...new Set(input.mentionedMemberIds)];
    await this.createNotifications({
      repositories: input.repositories,
      workItem: input.workItem,
      activityEventId: input.activityEventId,
      timestamp: input.timestamp,
      type: 'mention',
      recipientMemberIds: mentionRecipientIds,
      sourceEventKey: `comment:${input.comment.id}:mention`,
      summary: `You were mentioned on ${input.workItem.displayKey}.`,
      metadata: { commentId: input.comment.id }
    });

    const watcherIds = await input.repositories.workItemWatchers.listActiveMemberIdsByWorkItem(input.workItem.id);
    await this.createNotifications({
      repositories: input.repositories,
      workItem: input.workItem,
      activityEventId: input.activityEventId,
      timestamp: input.timestamp,
      type: 'watched_comment',
      recipientMemberIds: watcherIds,
      excludeMemberIds: mentionRecipientIds,
      sourceEventKey: `comment:${input.comment.id}:watched`,
      summary: `${input.workItem.displayKey} has a new comment.`,
      metadata: { commentId: input.comment.id }
    });
  }

  async recordRelationshipChanged(input: {
    repositories: Repositories;
    relationship: WorkItemRelationship;
    sourceWorkItem: WorkItem;
    targetWorkItem: WorkItem;
    action: 'added' | 'removed';
    activityEventId: string | null;
    timestamp: Date;
  }): Promise<void> {
    if (input.relationship.relationshipType === 'blocks') {
      await this.createRelationshipWatcherNotification({
        ...input,
        workItem: input.sourceWorkItem,
        sourceEventKey: `relationship:${input.relationship.id}:${input.action}:source-watchers`
      });

      const targetWatcherIds = await input.repositories.workItemWatchers.listActiveMemberIdsByWorkItem(
        input.targetWorkItem.id
      );
      await this.createNotifications({
        repositories: input.repositories,
        workItem: input.targetWorkItem,
        activityEventId: input.activityEventId,
        timestamp: input.timestamp,
        type: input.action === 'added' ? 'dependency_blocker_added' : 'dependency_blocker_removed',
        recipientMemberIds: [input.targetWorkItem.assigneeId, ...targetWatcherIds],
        sourceEventKey: `relationship:${input.relationship.id}:${input.action}:dependency`,
        summary:
          input.action === 'added'
            ? `${input.sourceWorkItem.displayKey} is blocking ${input.targetWorkItem.displayKey}.`
            : `${input.sourceWorkItem.displayKey} no longer blocks ${input.targetWorkItem.displayKey}.`,
        metadata: this.relationshipMetadata(input)
      });
      return;
    }

    await this.createRelationshipWatcherNotification({
      ...input,
      workItem: input.sourceWorkItem,
      sourceEventKey: `relationship:${input.relationship.id}:${input.action}:source-watchers`
    });
    await this.createRelationshipWatcherNotification({
      ...input,
      workItem: input.targetWorkItem,
      sourceEventKey: `relationship:${input.relationship.id}:${input.action}:target-watchers`
    });
  }

  private async getUnreadCountValue(): Promise<number> {
    return this.context.repositories.notifications.unreadCount({
      workspaceId: this.context.actor.workspaceId,
      recipientMemberId: this.context.actor.memberId
    });
  }

  private async createRelationshipWatcherNotification(input: {
    repositories: Repositories;
    relationship: WorkItemRelationship;
    sourceWorkItem: WorkItem;
    targetWorkItem: WorkItem;
    workItem: WorkItem;
    action: 'added' | 'removed';
    activityEventId: string | null;
    timestamp: Date;
    sourceEventKey: string;
  }): Promise<void> {
    const watcherIds = await input.repositories.workItemWatchers.listActiveMemberIdsByWorkItem(input.workItem.id);

    await this.createNotifications({
      repositories: input.repositories,
      workItem: input.workItem,
      activityEventId: input.activityEventId,
      timestamp: input.timestamp,
      type: 'watched_relationship_change',
      recipientMemberIds: watcherIds,
      sourceEventKey: input.sourceEventKey,
      summary:
        input.action === 'added'
          ? `${input.workItem.displayKey} has a new relationship.`
          : `${input.workItem.displayKey} had a relationship removed.`,
      metadata: this.relationshipMetadata(input)
    });
  }

  private relationshipMetadata(input: {
    relationship: WorkItemRelationship;
    sourceWorkItem: WorkItem;
    targetWorkItem: WorkItem;
    action: 'added' | 'removed';
  }): Record<string, unknown> {
    return {
      relationshipId: input.relationship.id,
      relationshipType: input.relationship.relationshipType,
      action: input.action,
      sourceWorkItemId: input.sourceWorkItem.id,
      sourceDisplayKey: input.sourceWorkItem.displayKey,
      targetWorkItemId: input.targetWorkItem.id,
      targetDisplayKey: input.targetWorkItem.displayKey
    };
  }

  private async watchMembers(input: {
    repositories: Repositories;
    workItem: WorkItem;
    memberIds: Array<string | null>;
    timestamp: Date;
  }): Promise<void> {
    const activeMemberIds = await this.activeRecipientIds(input.repositories, input.memberIds);

    await Promise.all(
      activeMemberIds.map((memberId) =>
        input.repositories.workItemWatchers.watch({
          id: this.idGenerator(),
          workspaceId: input.workItem.workspaceId,
          workItemId: input.workItem.id,
          memberId,
          watchedAt: input.timestamp,
          unwatchedAt: null,
          createdAt: input.timestamp,
          updatedAt: input.timestamp
        })
      )
    );
  }

  private async createNotifications(input: {
    repositories: Repositories;
    workItem: WorkItem;
    activityEventId: string | null;
    timestamp: Date;
    type: NotificationType;
    recipientMemberIds: Array<string | null>;
    excludeMemberIds?: string[];
    sourceEventKey: string;
    summary: string;
    metadata: Record<string, unknown>;
  }): Promise<void> {
    const excluded = new Set(input.excludeMemberIds ?? []);
    const recipientIds = (await this.activeRecipientIds(input.repositories, input.recipientMemberIds)).filter(
      (memberId) => !excluded.has(memberId) && memberId !== this.context.actor.memberId
    );

    const notifications: NewNotification[] = recipientIds.map((recipientMemberId) => ({
      id: this.idGenerator(),
      workspaceId: input.workItem.workspaceId,
      recipientMemberId,
      actorMemberId: this.context.actor.memberId,
      projectId: input.workItem.projectId,
      workItemId: input.workItem.id,
      activityEventId: input.activityEventId,
      notificationType: input.type,
      summary: input.summary,
      metadata: input.metadata,
      sourceEventKey: input.sourceEventKey,
      readAt: null,
      createdAt: input.timestamp
    }));

    await input.repositories.notifications.createManyIgnoringDuplicates(notifications);
  }

  private async activeRecipientIds(
    repositories: Repositories,
    memberIds: Array<string | null>
  ): Promise<string[]> {
    const candidateIds = [...new Set(memberIds.filter((memberId): memberId is string => memberId !== null))];

    if (candidateIds.length === 0) {
      return [];
    }

    const activeMembers = (await repositories.members.listByWorkspace(this.context.actor.workspaceId)).filter(
      (member) => member.isActive
    );
    const activeMemberIds = new Set(activeMembers.map((member) => member.id));
    return candidateIds.filter((memberId) => activeMemberIds.has(memberId));
  }

  private async toNotificationDto(notification: Notification): Promise<NotificationDto> {
    const [actor, project, workItem] = await Promise.all([
      this.optionalMember(notification.actorMemberId),
      this.optionalProject(notification.projectId),
      this.optionalWorkItem(notification.workItemId)
    ]);

    return {
      id: notification.id,
      type: notification.notificationType,
      summary: notification.summary,
      actor: actor === null ? null : toMemberDto(actor),
      project:
        project === null
          ? null
          : {
              id: project.id,
              key: project.key,
              name: project.name
            },
      workItem:
        workItem === null
          ? null
          : {
              id: workItem.id,
              displayKey: workItem.displayKey,
              title: workItem.title,
              status: workItem.status
            },
      metadata: notification.metadata,
      readAt: notification.readAt?.toISOString() ?? null,
      createdAt: notification.createdAt.toISOString()
    };
  }

  private async optionalMember(memberId: string | null): Promise<Member | null> {
    if (memberId === null) {
      return null;
    }

    const member = await this.context.repositories.members.findById(memberId);
    return member !== null && member.workspaceId === this.context.actor.workspaceId ? member : null;
  }

  private async optionalProject(projectId: string | null): Promise<Project | null> {
    if (projectId === null) {
      return null;
    }

    const project = await this.context.repositories.projects.findById(projectId);
    return project !== null && project.workspaceId === this.context.actor.workspaceId ? project : null;
  }

  private async optionalWorkItem(workItemId: string | null): Promise<WorkItem | null> {
    if (workItemId === null) {
      return null;
    }

    const workItem = await this.context.repositories.workItems.findById(workItemId);
    return workItem !== null && workItem.workspaceId === this.context.actor.workspaceId ? workItem : null;
  }
}
