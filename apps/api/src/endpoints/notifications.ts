import type {
  NotificationDto,
  NotificationListResponse,
  NotificationStateFilter,
  NotificationUnreadCountResponse,
  UpdateNotificationReadStateRequest
} from '@worktrail/contracts';
import { z } from 'zod';

import type { EndpointHandler } from '../http/app-request.js';
import type { Repositories } from '../repositories/index.js';
import { NotificationService } from '../services/notification-service.js';
import { parseWithSchema } from '../validation/parse.js';

const notificationIdParamSchema = z.object({
  notificationId: z.string().uuid()
});

const listNotificationsQuerySchema = z.object({
  state: z.enum(['unread', 'all']).optional()
});

const updateNotificationReadStateSchema = z.object({
  read: z.boolean()
}) satisfies z.ZodType<UpdateNotificationReadStateRequest>;

export interface NotificationHandlerOptions {
  repositories: Repositories;
}

export function listNotificationsHandler(
  options: NotificationHandlerOptions
): EndpointHandler<NotificationListResponse> {
  return async (request) => {
    const query = parseWithSchema(listNotificationsQuerySchema, request.query);
    const service = new NotificationService({
      actor: request.actor,
      repositories: options.repositories
    });

    return {
      status: 200,
      body: await service.listNotifications((query.state ?? 'unread') as NotificationStateFilter)
    };
  };
}

export function getUnreadNotificationCountHandler(
  options: NotificationHandlerOptions
): EndpointHandler<NotificationUnreadCountResponse> {
  return async (request) => {
    const service = new NotificationService({
      actor: request.actor,
      repositories: options.repositories
    });

    return {
      status: 200,
      body: await service.getUnreadCount()
    };
  };
}

export function updateNotificationReadStateHandler(
  options: NotificationHandlerOptions
): EndpointHandler<NotificationDto> {
  return async (request) => {
    const { notificationId } = parseWithSchema(notificationIdParamSchema, request.params);
    const input = parseWithSchema(updateNotificationReadStateSchema, request.body);
    const service = new NotificationService({
      actor: request.actor,
      repositories: options.repositories
    });

    return {
      status: 200,
      body: await service.updateReadState(notificationId, input)
    };
  };
}

export function markAllNotificationsReadHandler(
  options: NotificationHandlerOptions
): EndpointHandler<NotificationUnreadCountResponse> {
  return async (request) => {
    const service = new NotificationService({
      actor: request.actor,
      repositories: options.repositories
    });

    return {
      status: 200,
      body: await service.markAllRead()
    };
  };
}
