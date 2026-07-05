import { Component, OnDestroy, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { NotificationDto, NotificationStateFilter } from '@worktrail/contracts';
import { Subscription } from 'rxjs';

import { extractApiErrorMessage } from '../../core/api/api-error';
import { CurrentUserService } from '../../core/current-user.service';
import { WorktrailApiService } from '../../core/worktrail-api.service';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { ErrorPanelComponent } from '../../shared/ui/error-panel.component';
import { LoadingIndicatorComponent } from '../../shared/ui/loading-indicator.component';
import { InboxStateService } from './inbox-state.service';

@Component({
  selector: 'app-inbox-page',
  imports: [EmptyStateComponent, ErrorPanelComponent, LoadingIndicatorComponent, RouterLink],
  template: `
    <section class="page-header">
      <div>
        <p class="eyebrow">Inbox</p>
        <h1>Inbox</h1>
        <p>{{ headerCopy() }}</p>
      </div>

      <button
        type="button"
        class="header-action"
        [disabled]="isMarkingAllRead() || inboxState.unreadCount() === 0"
        (click)="markAllRead()"
      >
        {{ isMarkingAllRead() ? 'Marking...' : 'Mark all read' }}
      </button>
    </section>

    <section class="view-tabs" aria-label="Inbox views">
      <button
        type="button"
        [class.view-tabs__button--active]="stateFilter() === 'unread'"
        (click)="setStateFilter('unread')"
      >
        Unread
        @if (inboxState.unreadCount() > 0) {
          <span>{{ inboxState.unreadCount() }}</span>
        }
      </button>
      <button
        type="button"
        [class.view-tabs__button--active]="stateFilter() === 'all'"
        (click)="setStateFilter('all')"
      >
        All
      </button>
    </section>

    @if (isLoading()) {
      <app-loading-indicator label="Loading inbox" />
    } @else if (error()) {
      <app-error-panel title="Inbox unavailable" [message]="error() ?? ''" (retry)="loadNotifications()" />
    } @else if (notifications().length === 0) {
      <app-empty-state [title]="emptyTitle()" [message]="emptyMessage()" />
    } @else {
      <section class="notification-list" aria-label="Notifications">
        @for (notification of notifications(); track notification.id) {
          <article class="notification-card" [class.notification-card--read]="notification.readAt !== null">
            <div class="notification-card__main">
              <div class="notification-card__title-row">
                <span class="type-pill">{{ notificationTypeLabel(notification.type) }}</span>
                @if (notification.readAt === null) {
                  <span class="unread-dot" aria-label="Unread notification"></span>
                }
                <time>{{ formatDateTime(notification.createdAt) }}</time>
              </div>

              <h2>{{ notification.summary }}</h2>

              <p>
                @if (notification.actor !== null) {
                  <span>{{ memberDisplayName(notification.actor) }}</span>
                } @else {
                  <span>System</span>
                }
                @if (notification.project !== null) {
                  <span> · {{ notification.project.key }}</span>
                }
              </p>

              @if (notification.workItem !== null) {
                <a
                  class="work-item-link"
                  [routerLink]="['/work-items', notification.workItem.id]"
                  [queryParams]="{ returnUrl: '/inbox' }"
                >
                  <strong>{{ notification.workItem.displayKey }}</strong>
                  <span>{{ notification.workItem.title }}</span>
                </a>
              }
            </div>

            <div class="notification-card__actions">
              <button
                type="button"
                [disabled]="mutatingNotificationId() === notification.id"
                (click)="toggleReadState(notification)"
              >
                {{ readActionLabel(notification) }}
              </button>
            </div>
          </article>
        }
      </section>
    }
  `,
  styles: `
    .page-header {
      display: flex;
      justify-content: space-between;
      gap: 20px;
      align-items: flex-start;
      margin-bottom: 18px;
    }

    .eyebrow {
      margin: 0 0 6px;
      color: #64748b;
      font-size: 0.75rem;
      font-weight: 800;
      letter-spacing: 0;
      text-transform: uppercase;
    }

    h1,
    h2,
    p {
      margin: 0;
    }

    h1 {
      color: #111827;
      font-size: 1.75rem;
      line-height: 1.2;
    }

    .page-header p:not(.eyebrow) {
      margin-top: 8px;
      color: #64748b;
      font-size: 0.875rem;
      line-height: 1.5;
    }

    .header-action,
    .view-tabs button,
    .notification-card__actions button {
      min-height: 36px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 0 12px;
      background: #ffffff;
      color: #1f2937;
      font: inherit;
      font-size: 0.875rem;
      font-weight: 800;
    }

    .header-action:not(:disabled):hover,
    .view-tabs button:hover,
    .notification-card__actions button:not(:disabled):hover {
      border-color: #94a3b8;
      background: #f8fafc;
      cursor: pointer;
    }

    button:disabled {
      opacity: 0.58;
      cursor: not-allowed;
    }

    .view-tabs {
      display: flex;
      gap: 8px;
      margin-bottom: 18px;
    }

    .view-tabs button {
      display: inline-flex;
      gap: 8px;
      align-items: center;
    }

    .view-tabs__button--active {
      border-color: #1f4f99;
      background: #e8eef6;
      color: #183b73;
    }

    .view-tabs span {
      display: inline-grid;
      place-items: center;
      min-width: 20px;
      min-height: 20px;
      border-radius: 999px;
      padding: 0 6px;
      background: #dc2626;
      color: #ffffff;
      font-size: 0.75rem;
      font-weight: 900;
    }

    .notification-list {
      display: grid;
      gap: 12px;
    }

    .notification-card {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 16px;
      border: 1px solid #dbe3ea;
      border-radius: 8px;
      padding: 16px;
      background: #ffffff;
    }

    .notification-card--read {
      background: #f8fafc;
    }

    .notification-card__main {
      display: grid;
      gap: 10px;
      min-width: 0;
    }

    .notification-card__title-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }

    .type-pill {
      display: inline-flex;
      min-height: 22px;
      align-items: center;
      border: 1px solid #bfdbfe;
      border-radius: 999px;
      padding: 2px 8px;
      background: #eff6ff;
      color: #1d4ed8;
      font-size: 0.75rem;
      font-weight: 900;
    }

    .unread-dot {
      width: 9px;
      height: 9px;
      border-radius: 999px;
      background: #dc2626;
    }

    time,
    .notification-card p {
      color: #64748b;
      font-size: 0.8125rem;
      line-height: 1.45;
    }

    .notification-card h2 {
      color: #111827;
      font-size: 1rem;
      line-height: 1.35;
    }

    .work-item-link {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      width: fit-content;
      color: #1d4ed8;
      font-size: 0.875rem;
      font-weight: 700;
      text-decoration: none;
    }

    .work-item-link:hover {
      text-decoration: underline;
    }

    .work-item-link strong {
      text-transform: uppercase;
    }

    .notification-card__actions {
      display: flex;
      align-items: flex-start;
    }

    @media (max-width: 760px) {
      .page-header,
      .notification-card {
        grid-template-columns: 1fr;
      }

      .page-header {
        display: grid;
      }

      .header-action,
      .notification-card__actions button {
        width: 100%;
      }
    }
  `
})
export class InboxPageComponent implements OnDestroy {
  private readonly api = inject(WorktrailApiService);
  private readonly currentUser = inject(CurrentUserService);
  readonly inboxState = inject(InboxStateService);
  private notificationsSubscription: Subscription | null = null;
  private mutationSubscription: Subscription | null = null;
  private markAllReadSubscription: Subscription | null = null;
  private lastActorId: string | null = null;

  readonly stateFilter = signal<NotificationStateFilter>('unread');
  readonly notifications = signal<NotificationDto[]>([]);
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);
  readonly mutatingNotificationId = signal<string | null>(null);
  readonly isMarkingAllRead = signal(false);

  private readonly actorReload = effect(() => {
    const actorId = this.currentUser.selectedMember()?.id ?? null;

    if (actorId === null) {
      this.lastActorId = null;
      this.notifications.set([]);
      this.error.set(null);
      this.isLoading.set(false);
      this.notificationsSubscription?.unsubscribe();
      this.notificationsSubscription = null;
      return;
    }

    if (actorId !== this.lastActorId) {
      this.loadNotifications();
    }
  });

  ngOnDestroy(): void {
    this.actorReload.destroy();
    this.notificationsSubscription?.unsubscribe();
    this.mutationSubscription?.unsubscribe();
    this.markAllReadSubscription?.unsubscribe();
  }

  setStateFilter(state: NotificationStateFilter): void {
    if (this.stateFilter() === state) {
      return;
    }

    this.stateFilter.set(state);
    this.loadNotifications();
  }

  loadNotifications(): void {
    const actor = this.currentUser.selectedMember();

    if (actor === null) {
      return;
    }

    this.lastActorId = actor.id;
    this.notificationsSubscription?.unsubscribe();
    this.isLoading.set(true);
    this.error.set(null);

    this.notificationsSubscription = this.api.listNotifications(this.stateFilter()).subscribe({
      next: (response) => {
        this.notifications.set(response.items);
        this.inboxState.syncFromNotificationList(response);
        this.isLoading.set(false);
      },
      error: (error) => {
        this.notifications.set([]);
        this.error.set(extractApiErrorMessage(error, 'Inbox notifications could not be loaded.'));
        this.isLoading.set(false);
      }
    });
  }

  toggleReadState(notification: NotificationDto): void {
    const previousReadAt = notification.readAt;
    const nextRead = previousReadAt === null;
    this.mutationSubscription?.unsubscribe();
    this.mutatingNotificationId.set(notification.id);
    this.error.set(null);

    this.mutationSubscription = this.api
      .updateNotificationReadState(notification.id, { read: nextRead })
      .subscribe({
        next: (updated) => {
          this.applyUpdatedNotification(updated, previousReadAt);
          this.mutatingNotificationId.set(null);
        },
        error: (error) => {
          this.error.set(extractApiErrorMessage(error, 'Notification read state could not be updated.'));
          this.mutatingNotificationId.set(null);
        }
      });
  }

  markAllRead(): void {
    if (this.inboxState.unreadCount() === 0) {
      return;
    }

    this.markAllReadSubscription?.unsubscribe();
    this.isMarkingAllRead.set(true);
    this.error.set(null);

    this.markAllReadSubscription = this.api.markAllNotificationsRead().subscribe({
      next: (response) => {
        this.inboxState.syncFromNotificationList({ items: [], unreadCount: response.unreadCount });
        this.notifications.update((items) =>
          this.stateFilter() === 'unread'
            ? []
            : items.map((item) => ({
                ...item,
                readAt: item.readAt ?? new Date().toISOString()
              }))
        );
        this.isMarkingAllRead.set(false);
      },
      error: (error) => {
        this.error.set(extractApiErrorMessage(error, 'Notifications could not be marked read.'));
        this.isMarkingAllRead.set(false);
      }
    });
  }

  headerCopy(): string {
    const count = this.inboxState.unreadCount();
    return count === 0 ? 'No unread notifications.' : `${count} unread notification${count === 1 ? '' : 's'}.`;
  }

  emptyTitle(): string {
    return this.stateFilter() === 'unread' ? 'No unread notifications' : 'No notifications yet';
  }

  emptyMessage(): string {
    return this.stateFilter() === 'unread'
      ? 'New mentions, assignments, watched work, and dependency updates will appear here.'
      : 'Notifications from watched work, mentions, assignments, and dependencies will appear here.';
  }

  readActionLabel(notification: NotificationDto): string {
    if (this.mutatingNotificationId() === notification.id) {
      return notification.readAt === null ? 'Marking...' : 'Updating...';
    }

    return notification.readAt === null ? 'Mark read' : 'Mark unread';
  }

  notificationTypeLabel(type: NotificationDto['type']): string {
    return type
      .split('_')
      .map((part) => part[0].toUpperCase() + part.slice(1))
      .join(' ');
  }

  memberDisplayName(member: NotificationDto['actor']): string {
    if (member === null) {
      return 'System';
    }

    return member.isActive ? member.name : `${member.name} (inactive)`;
  }

  formatDateTime(value: string): string {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    }).format(new Date(value));
  }

  private applyUpdatedNotification(updated: NotificationDto, previousReadAt: string | null): void {
    this.inboxState.applyReadStateChange(previousReadAt, updated.readAt);

    this.notifications.update((items) => {
      if (this.stateFilter() === 'unread' && updated.readAt !== null) {
        return items.filter((item) => item.id !== updated.id);
      }

      return items.map((item) => (item.id === updated.id ? updated : item));
    });
  }
}
