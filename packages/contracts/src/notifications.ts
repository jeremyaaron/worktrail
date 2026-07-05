import type { MemberDto } from './members.js';
import type { WorkItemStatus } from './work-items.js';

export type NotificationType =
  | 'assignment'
  | 'mention'
  | 'watched_comment'
  | 'watched_status_change'
  | 'watched_assignee_change'
  | 'watched_relationship_change'
  | 'dependency_blocker_added'
  | 'dependency_blocker_removed';

export type NotificationStateFilter = 'unread' | 'all';

export interface NotificationProjectRefDto {
  id: string;
  key: string;
  name: string;
}

export interface NotificationWorkItemRefDto {
  id: string;
  displayKey: string;
  title: string;
  status: WorkItemStatus;
}

export interface NotificationDto {
  id: string;
  type: NotificationType;
  summary: string;
  actor: MemberDto | null;
  project: NotificationProjectRefDto | null;
  workItem: NotificationWorkItemRefDto | null;
  metadata: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationListResponse {
  items: NotificationDto[];
  unreadCount: number;
}

export interface NotificationUnreadCountResponse {
  unreadCount: number;
}

export interface UpdateNotificationReadStateRequest {
  read: boolean;
}

export interface WorkItemWatcherDto {
  id: string;
  member: MemberDto;
  watchedAt: string;
}

export interface WorkItemWatchStateDto {
  isWatchedByCurrentActor: boolean;
  watcherCount: number;
  watchers: WorkItemWatcherDto[];
}
