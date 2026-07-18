import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { WorkItemParentDto } from '@worktrail/contracts';

import { workItemStatusLabel } from '../../../shared/work-items/work-item-display';

@Component({
  selector: 'app-work-item-parent-context',
  imports: [RouterLink],
  template: `
    <div class="parent-context" aria-label="Parent work item">
      <span class="parent-context__label">Child of</span>
      <a
        [routerLink]="['/work-items', parent().id]"
        [queryParams]="returnUrl() === null ? null : { returnUrl: returnUrl() }"
      >
        {{ parent().displayKey }} {{ parent().title }}
      </a>
      <span class="parent-context__status" [attr.data-status]="parent().status">
        {{ workItemStatusLabel(parent().status) }}
      </span>
    </div>
  `,
  styles: `
    .parent-context {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 7px;
      color: #475569;
      font-size: 0.8125rem;
    }

    .parent-context__label {
      font-weight: 800;
    }

    a {
      color: #1d4ed8;
      font-weight: 800;
      text-decoration: none;
    }

    a:hover,
    a:focus-visible {
      text-decoration: underline;
    }

    .parent-context__status {
      min-height: 22px;
      border: 1px solid #cbd5e1;
      border-radius: 999px;
      padding: 2px 8px;
      background: #f8fafc;
      color: #475569;
      font-size: 0.72rem;
      font-weight: 800;
    }

    .parent-context__status[data-status='done'] {
      border-color: #a7f3d0;
      background: #ecfdf5;
      color: #047857;
    }

    .parent-context__status[data-status='canceled'] {
      background: #f1f5f9;
    }
  `
})
export class WorkItemParentContextComponent {
  readonly parent = input.required<WorkItemParentDto>();
  readonly returnUrl = input<string | null>(null);
  readonly workItemStatusLabel = workItemStatusLabel;
}
