import type { Express } from 'express';

import {
  getUnreadNotificationCountHandler,
  listNotificationsHandler,
  markAllNotificationsReadHandler,
  updateNotificationReadStateHandler
} from '../../../endpoints/notifications.js';
import { adaptEndpoint } from '../handler-adapter.js';
import { adapterOptions, type ExpressRouteContext } from './context.js';

export function registerNotificationRoutes(app: Express, context: ExpressRouteContext): void {
  const options = adapterOptions(context);

  app.get(
    '/api/notifications',
    adaptEndpoint(listNotificationsHandler({ persistence: context.persistence, repositories: context.repositories }), options)
  );
  app.get(
    '/api/notifications/unread-count',
    adaptEndpoint(getUnreadNotificationCountHandler({ persistence: context.persistence, repositories: context.repositories }), options)
  );
  app.patch(
    '/api/notifications/:notificationId',
    adaptEndpoint(updateNotificationReadStateHandler({ persistence: context.persistence, repositories: context.repositories }), options)
  );
  app.post(
    '/api/notifications/mark-all-read',
    adaptEndpoint(markAllNotificationsReadHandler({ persistence: context.persistence, repositories: context.repositories }), options)
  );
}
