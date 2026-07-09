import { computed, signal } from '@angular/core';
import type { BulkUpdateWorkItemsResponseDto } from '@worktrail/contracts';

export interface BulkTriageItem {
  id: string;
}

export class ProjectBulkTriageStore {
  readonly isActive = signal(false);
  readonly selectedItemIds = signal<string[]>([]);
  readonly selectedItemIdSet = computed(() => new Set(this.selectedItemIds()));
  readonly isApplying = signal(false);
  readonly error = signal<string | null>(null);
  readonly result = signal<BulkUpdateWorkItemsResponseDto | null>(null);

  enter(): void {
    this.isActive.set(true);
    this.clearFeedback();
  }

  exit(): void {
    this.isActive.set(false);
    this.selectedItemIds.set([]);
    this.isApplying.set(false);
    this.clearFeedback();
  }

  selectedVisibleItems<TItem extends BulkTriageItem>(items: TItem[]): TItem[] {
    const selectedIds = this.selectedItemIdSet();
    return items.filter((item) => selectedIds.has(item.id));
  }

  selectedVisibleCount(items: BulkTriageItem[]): number {
    return this.selectedVisibleItems(items).length;
  }

  hasSelection(items: BulkTriageItem[]): boolean {
    return this.selectedVisibleCount(items) > 0;
  }

  areAllVisibleSelected(items: BulkTriageItem[]): boolean {
    const selectedIds = this.selectedItemIdSet();
    return items.length > 0 && items.every((item) => selectedIds.has(item.id));
  }

  toggleItem(itemId: string): void {
    if (!this.isActive()) {
      return;
    }

    const selectedIds = new Set(this.selectedItemIds());

    if (selectedIds.has(itemId)) {
      selectedIds.delete(itemId);
    } else {
      selectedIds.add(itemId);
    }

    this.selectedItemIds.set([...selectedIds]);
    this.clearFeedback();
  }

  toggleAllVisible(items: BulkTriageItem[]): void {
    if (!this.isActive()) {
      return;
    }

    const visibleIds = new Set(items.map((item) => item.id));

    if (visibleIds.size === 0) {
      this.clearSelection();
      return;
    }

    if (this.areAllVisibleSelected(items)) {
      this.selectedItemIds.set(this.selectedItemIds().filter((itemId) => !visibleIds.has(itemId)));
      this.clearFeedback();
      return;
    }

    this.selectedItemIds.set([...new Set([...this.selectedItemIds(), ...visibleIds])]);
    this.clearFeedback();
  }

  clearSelection(): void {
    this.selectedItemIds.set([]);
    this.isApplying.set(false);
    this.clearFeedback();
  }

  pruneSelectionToVisible(items: BulkTriageItem[]): void {
    const visibleIds = new Set(items.map((item) => item.id));
    this.selectedItemIds.set(this.selectedItemIds().filter((itemId) => visibleIds.has(itemId)));
  }

  beginApply(): void {
    this.isApplying.set(true);
    this.clearFeedback();
  }

  applySucceeded(result: BulkUpdateWorkItemsResponseDto): void {
    this.result.set(result);
    this.selectedItemIds.set(
      result.results
        .filter((itemResult) => itemResult.status === 'failed')
        .map((itemResult) => itemResult.workItemId)
    );
    this.isApplying.set(false);
  }

  applyFailed(message: string): void {
    this.error.set(message);
    this.isApplying.set(false);
  }

  clearFeedback(): void {
    this.error.set(null);
    this.result.set(null);
  }
}
