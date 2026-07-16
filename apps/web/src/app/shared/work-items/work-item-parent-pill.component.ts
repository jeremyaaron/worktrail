import { Component, input } from '@angular/core';
import type { WorkItemParentDto } from '@worktrail/contracts';

@Component({
  selector: 'app-work-item-parent-pill',
  template: `
    @if (parent(); as parent) {
      <span class="parent-pill" [title]="'Parent: ' + parent.displayKey + ' · ' + parent.title">
        Child of {{ parent.displayKey }}
      </span>
    }
  `,
  styles: `
    :host {
      display: contents;
    }

    .parent-pill {
      display: inline-flex;
      align-items: center;
      width: fit-content;
      max-width: 100%;
      min-height: 22px;
      border: 1px solid #bae6fd;
      border-radius: 999px;
      padding: 2px 8px;
      background: #f0f9ff;
      color: #0369a1;
      font-size: 0.72rem;
      font-weight: 800;
      line-height: 1.35;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  `
})
export class WorkItemParentPillComponent {
  readonly parent = input<WorkItemParentDto | null | undefined>(null);
}
