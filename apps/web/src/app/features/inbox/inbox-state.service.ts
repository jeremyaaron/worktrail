import { Injectable, OnDestroy, effect, inject, signal } from '@angular/core';
import type { NotificationListResponse } from '@worktrail/contracts';
import { Subscription } from 'rxjs';

import { CurrentUserService } from '../../core/current-user.service';
import { WorktrailApiService } from '../../core/worktrail-api.service';

@Injectable({ providedIn: 'root' })
export class InboxStateService implements OnDestroy {
  private readonly api = inject(WorktrailApiService);
  private readonly currentUser = inject(CurrentUserService);
  private unreadCountSubscription: Subscription | null = null;
  private lastActorId: string | null = null;

  readonly unreadCount = signal(0);
  readonly isLoadingUnreadCount = signal(false);
  readonly unreadCountError = signal<string | null>(null);

  private readonly actorRefresh = effect(() => {
    const actorId = this.currentUser.selectedMember()?.id ?? null;

    if (actorId === null) {
      this.lastActorId = null;
      this.unreadCountSubscription?.unsubscribe();
      this.unreadCountSubscription = null;
      this.unreadCount.set(0);
      this.isLoadingUnreadCount.set(false);
      this.unreadCountError.set(null);
      return;
    }

    if (actorId !== this.lastActorId) {
      this.refreshUnreadCount();
    }
  });

  ngOnDestroy(): void {
    this.actorRefresh.destroy();
    this.unreadCountSubscription?.unsubscribe();
  }

  refreshUnreadCount(): void {
    const actor = this.currentUser.selectedMember();

    if (actor === null) {
      this.unreadCount.set(0);
      this.unreadCountError.set(null);
      this.isLoadingUnreadCount.set(false);
      return;
    }

    this.lastActorId = actor.id;
    this.unreadCountSubscription?.unsubscribe();
    this.isLoadingUnreadCount.set(true);
    this.unreadCountError.set(null);

    this.unreadCountSubscription = this.api.getNotificationUnreadCount().subscribe({
      next: (response) => {
        this.unreadCount.set(response.unreadCount);
        this.isLoadingUnreadCount.set(false);
      },
      error: () => {
        this.unreadCountError.set('Unread notification count could not be loaded.');
        this.isLoadingUnreadCount.set(false);
      }
    });
  }

  syncFromNotificationList(response: NotificationListResponse): void {
    this.unreadCount.set(response.unreadCount);
    this.unreadCountError.set(null);
  }

  applyReadStateChange(previousReadAt: string | null, nextReadAt: string | null): void {
    if (previousReadAt === null && nextReadAt !== null) {
      this.unreadCount.update((count) => Math.max(0, count - 1));
    } else if (previousReadAt !== null && nextReadAt === null) {
      this.unreadCount.update((count) => count + 1);
    }
  }

  markAllReadLocally(): void {
    this.unreadCount.set(0);
    this.unreadCountError.set(null);
  }
}
