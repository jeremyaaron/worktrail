import type {
  NotificationDto,
  NotificationListResponse,
  NotificationStateFilter,
  NotificationUnreadCountResponse,
  UpdateNotificationReadStateRequest
} from '@worktrail/contracts';

import type { ActorContext } from '../domain/actor.js';
import { NotFoundError } from '../errors/app-error.js';
import type { Repositories } from '../repositories/index.js';
import type { Member, Notification, Project, WorkItem } from '../repositories/types.js';
import { toMemberDto } from './dto.js';

export interface NotificationServiceContext {
  actor: ActorContext;
  repositories: Repositories;
  clock?: () => Date;
}

export class NotificationService {
  private readonly clock: () => Date;

  constructor(private readonly context: NotificationServiceContext) {
    this.clock = context.clock ?? (() => new Date());
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

  private async getUnreadCountValue(): Promise<number> {
    return this.context.repositories.notifications.unreadCount({
      workspaceId: this.context.actor.workspaceId,
      recipientMemberId: this.context.actor.memberId
    });
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
