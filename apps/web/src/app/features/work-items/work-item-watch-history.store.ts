import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import type {
  WorkItemWatchStateDto
} from '@worktrail/contracts';
import type { Subscription } from 'rxjs';
import { DraftDepartureCoordinator, draftRouteKey } from '../../core/navigation/draft-departure-coordinator';

import { WorkItemsApi } from '../../core/api/work-items-api';

import { WorkItemDetailStore } from './work-item-detail.store';
@Injectable()
export class WorkItemWatchHistoryStore {
  readonly record = inject(WorkItemDetailStore);
  readonly departure = inject(DraftDepartureCoordinator);
  private readonly workItemsApi = inject(WorkItemsApi);

  private readonly destroyRef = inject(DestroyRef);

  private attachmentActivitySubscription: Subscription | null = null;

  private attachmentActivityGeneration = 0;

  readonly isWatchLoading = signal(false);

  readonly isWatchUpdating = signal(false);

  readonly watchError = signal<string | null>(null);

  readonly attachmentActivityError = signal<string | null>(null);

  readonly watchState = signal<WorkItemWatchStateDto | null>(null);

  readonly watchers = computed(() => this.watchState()?.watchers ?? []);

  readonly watcherCount = computed(() => this.watchState()?.watcherCount ?? this.watchers().length);

  refreshAttachmentActivity(): void {
    const workItemId = this.record.workItemId();
    const generation = ++this.attachmentActivityGeneration;
    this.attachmentActivitySubscription?.unsubscribe();
    this.attachmentActivityError.set(null);

    this.attachmentActivitySubscription = this.workItemsApi
      .listWorkItemActivity(workItemId)
      .pipe(this.record.context.guard())
      .subscribe({
        next: (activity) => {
          if (
            generation !== this.attachmentActivityGeneration ||
            workItemId !== this.record.workItemId()
          ) {
            return;
          }

          this.record.workItem.update((workItem) =>
            workItem?.id === workItemId ? { ...workItem, activity } : workItem
          );
          this.attachmentActivitySubscription = null;
        },
        error: () => {
          if (
            generation !== this.attachmentActivityGeneration ||
            workItemId !== this.record.workItemId()
          ) {
            return;
          }

          this.attachmentActivityError.set(
            'The file changed, but the latest activity could not be loaded.'
          );
          this.attachmentActivitySubscription = null;
        }
      });
  }

  loadWatchState(): void {
    const workItemId = this.record.workItemId();
    this.isWatchLoading.set(true);
    this.watchError.set(null);

    this.workItemsApi
      .getWorkItemWatchState(workItemId)
      .pipe(this.record.context.guard())
      .subscribe({
        next: (watchState) => {
          if (workItemId !== this.record.workItemId()) {
            return;
          }

          this.watchState.set(watchState);
          this.isWatchLoading.set(false);
        },
        error: () => {
          if (workItemId !== this.record.workItemId()) {
            return;
          }

          this.watchError.set('Watch state could not be loaded from the API.');
          this.watchState.set(null);
          this.isWatchLoading.set(false);
        }
      });
  }

  toggleWatch(): void {
    if (this.record.isArchivedProject() || this.isWatchLoading() || this.isWatchUpdating()) {
      return;
    }

    const isWatched = this.watchState()?.isWatchedByCurrentActor ?? false;
    const request = isWatched
      ? this.workItemsApi.unwatchWorkItem(this.record.workItemId())
      : this.workItemsApi.watchWorkItem(this.record.workItemId());

    this.isWatchUpdating.set(true);
    this.watchError.set(null);

    request.pipe(this.record.guardContext()).subscribe({
      next: (watchState) => {
        this.watchState.set(watchState);
        this.isWatchUpdating.set(false);
      },
      error: () => {
        this.watchError.set('Watch state could not be updated.');
        this.isWatchUpdating.set(false);
      }
    });
  }

  reset(): void {
    this.attachmentActivitySubscription?.unsubscribe();
    this.attachmentActivitySubscription = null;
    this.attachmentActivityGeneration += 1;
    this.isWatchLoading.set(false);
    this.isWatchUpdating.set(false);
  }

  registerDrafts(): void {
    this.departure.register({
      category: 'Watch change', context: () => this.record.context.contextKey(),
      routeKey: () => draftRouteKey('detail', this.record.workItemId()),
      revision: () => 0, meaningful: () => false, pending: () => this.isWatchUpdating(),
      discard: () => undefined
    }, this.destroyRef);
  }

}
