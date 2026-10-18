import { ElementRef, afterRenderEffect, signal } from '@angular/core';
import { focusWorkItemTarget } from './work-item-files-target';
import { WorkItemDetailStore } from './work-item-detail.store';
import { workItemSection } from '../../shared/navigation/work-navigation';

// One post-render target owner, sharing the record's committed context. File readiness stays with Files.
export class WorkItemSectionTarget {
  private readonly request = signal(0);
  private fulfilled = '';

  constructor(private readonly record: WorkItemDetailStore, host: ElementRef<HTMLElement>) {
    afterRenderEffect(() => {
      const item = record.workItem();
      const fragment = workItemSection(record.context.fragment());
      const key = JSON.stringify([record.context.contextKey(), fragment, this.request()]);
      if (!fragment) { this.fulfilled = ''; return; }
      if (!item || item.id !== record.workItemId() || record.isLoading() || record.departure.isConfirming() || record.departure.isDeparting() || fragment === 'files' || key === this.fulfilled) return;
      const targetId = fragment.startsWith('comment-') && !item.comments.some(comment => 'comment-' + comment.id === fragment && !comment.isDeleted)
        ? 'discussion' : fragment;
      const target = host.nativeElement.querySelector<HTMLElement>('#' + CSS.escape(targetId));
      if (target && focusWorkItemTarget(target)) this.fulfilled = key;
    });
  }

  repeat(fragment: string): void {
    if (this.record.context.fragment() !== fragment) return;
    if (fragment === 'files') this.record.requestFilesFocus();
    else this.request.update(value => value + 1);
  }
}
