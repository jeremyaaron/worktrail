import { and, desc, eq, isNull } from 'drizzle-orm';

import type { WorktrailDb } from '../db/client.js';
import { notifications } from '../db/schema.js';
import type { NewNotification } from './types.js';

export type NotificationStateFilter = 'unread' | 'all';

export interface ListNotificationsInput {
  workspaceId: string;
  recipientMemberId: string;
  state: NotificationStateFilter;
  limit?: number;
}

export interface NotificationReadStateInput {
  id: string;
  workspaceId: string;
  recipientMemberId: string;
  readAt: Date | null;
}

export interface NotificationActorInput {
  workspaceId: string;
  recipientMemberId: string;
}

export function createNotificationRepository(db: WorktrailDb) {
  return {
    async create(input: NewNotification) {
      const [notification] = await db.insert(notifications).values(input).returning();
      return notification;
    },

    async createMany(input: NewNotification[]) {
      if (input.length === 0) {
        return [];
      }

      return db.insert(notifications).values(input).returning();
    },

    async listByRecipient(input: ListNotificationsInput) {
      const conditions = [
        eq(notifications.workspaceId, input.workspaceId),
        eq(notifications.recipientMemberId, input.recipientMemberId)
      ];

      if (input.state === 'unread') {
        conditions.push(isNull(notifications.readAt));
      }

      return db
        .select()
        .from(notifications)
        .where(and(...conditions))
        .orderBy(desc(notifications.createdAt))
        .limit(input.limit ?? 100);
    },

    async unreadCount(input: NotificationActorInput) {
      const result = await db.$count(
        notifications,
        and(
          eq(notifications.workspaceId, input.workspaceId),
          eq(notifications.recipientMemberId, input.recipientMemberId),
          isNull(notifications.readAt)
        )
      );
      return result;
    },

    async setReadState(input: NotificationReadStateInput) {
      const [notification] = await db
        .update(notifications)
        .set({ readAt: input.readAt })
        .where(
          and(
            eq(notifications.id, input.id),
            eq(notifications.workspaceId, input.workspaceId),
            eq(notifications.recipientMemberId, input.recipientMemberId)
          )
        )
        .returning();
      return notification ?? null;
    },

    async markAllRead(input: NotificationActorInput & { readAt: Date }) {
      const updated = await db
        .update(notifications)
        .set({ readAt: input.readAt })
        .where(
          and(
            eq(notifications.workspaceId, input.workspaceId),
            eq(notifications.recipientMemberId, input.recipientMemberId),
            isNull(notifications.readAt)
          )
        )
        .returning({ id: notifications.id });
      return updated.length;
    }
  };
}
