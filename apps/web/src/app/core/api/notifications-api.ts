import { Injectable, inject } from '@angular/core';
import type {
  NotificationDto,
  NotificationListResponse,
  NotificationStateFilter,
  NotificationUnreadCountResponse,
  UpdateNotificationReadStateRequest
} from '@worktrail/contracts';
import type { Observable } from 'rxjs';

import { ApiClient } from './api-client';

@Injectable({ providedIn: 'root' })
export class NotificationsApi {
  private readonly api = inject(ApiClient);

  listNotifications(state: NotificationStateFilter = 'unread'): Observable<NotificationListResponse> {
    return this.api.get<NotificationListResponse>('/notifications', {
      params: { state }
    });
  }

  getUnreadCount(): Observable<NotificationUnreadCountResponse> {
    return this.api.get<NotificationUnreadCountResponse>('/notifications/unread-count');
  }

  updateReadState(
    notificationId: string,
    input: UpdateNotificationReadStateRequest
  ): Observable<NotificationDto> {
    return this.api.patch<NotificationDto, UpdateNotificationReadStateRequest>(
      `/notifications/${notificationId}`,
      input
    );
  }

  markAllRead(): Observable<NotificationUnreadCountResponse> {
    return this.api.post<NotificationUnreadCountResponse>('/notifications/mark-all-read', {});
  }
}
