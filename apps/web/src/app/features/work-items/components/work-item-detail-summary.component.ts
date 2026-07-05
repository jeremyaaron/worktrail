import { Component, Input } from '@angular/core';
import type { WorkItemDetailDto } from '@worktrail/contracts';

import { memberDisplayName } from '../../../shared/display/member-display';
import {
  workItemMetadata,
  workItemPriorityLabel,
  workItemStatusLabel
} from '../../../shared/work-items/work-item-display';

@Component({
  selector: 'app-work-item-detail-summary',
  template: `
    <section class="summary" aria-label="Work item summary">
      <div class="summary__title">
        <p class="eyebrow">Work item</p>
        <h1>{{ item.title }}</h1>
        <p>{{ item.description || 'No description provided.' }}</p>
      </div>

      <div class="summary__facts" aria-label="Current work item state">
        <span class="key-pill">{{ item.displayKey }}</span>
        <span class="status-pill" [attr.data-status]="item.status">
          {{ workItemStatusLabel(item.status) }}
        </span>
        <span class="priority-pill" [attr.data-priority]="item.priority">
          {{ workItemPriorityLabel(item.priority) }}
        </span>
        <span>{{ workItemMetadata(item) }}</span>
      </div>

      <dl class="summary__grid">
        <div>
          <dt>Assignee</dt>
          <dd>{{ item.assignee === null ? 'Unassigned' : memberDisplayName(item.assignee) }}</dd>
        </div>
        <div>
          <dt>Milestone</dt>
          <dd>{{ item.milestone?.name ?? 'No milestone' }}</dd>
        </div>
        <div>
          <dt>Due date</dt>
          <dd>{{ item.dueDate === null ? 'No due date' : formatDateOnly(item.dueDate) }}</dd>
        </div>
        <div>
          <dt>Dependency</dt>
          <dd>{{ dependencyLabel(item) }}</dd>
        </div>
      </dl>

      <div class="summary__labels" aria-label="Labels">
        @if (item.labels.length === 0) {
          <span class="muted-pill">No labels</span>
        } @else {
          @for (label of item.labels; track label.id) {
            <span
              class="label-pill"
              [class.label-pill--archived]="label.isArchived"
              [style.border-color]="label.color ?? '#cbd5e1'"
            >
              {{ label.name }}
            </span>
          }
        }
      </div>
    </section>
  `,
  styles: `
    .summary {
      display: grid;
      gap: 14px;
    }

    .summary__title {
      display: grid;
      gap: 8px;
    }

    .eyebrow,
    h1,
    p,
    dl,
    dd {
      margin: 0;
    }

    .eyebrow {
      color: #64748b;
      font-size: 0.75rem;
      font-weight: 800;
      letter-spacing: 0;
      text-transform: uppercase;
    }

    h1 {
      color: #111827;
      font-size: 1.75rem;
      line-height: 1.2;
    }

    p {
      color: #64748b;
      font-size: 0.875rem;
      line-height: 1.5;
    }

    .summary__facts,
    .summary__labels {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      align-items: center;
      color: #64748b;
      font-size: 0.8125rem;
      font-weight: 800;
    }

    .summary__grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 10px;
    }

    .summary__grid div {
      display: grid;
      gap: 4px;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 10px;
      background: #f8fafc;
    }

    dt {
      color: #64748b;
      font-size: 0.72rem;
      font-weight: 900;
      text-transform: uppercase;
    }

    dd {
      color: #111827;
      font-size: 0.875rem;
      font-weight: 800;
      line-height: 1.35;
    }

    .key-pill,
    .status-pill,
    .priority-pill,
    .label-pill,
    .muted-pill {
      display: inline-flex;
      width: fit-content;
      min-height: 22px;
      align-items: center;
      border: 1px solid #cbd5e1;
      border-radius: 999px;
      padding: 2px 8px;
      font-size: 0.75rem;
      font-weight: 800;
    }

    .key-pill {
      border-color: #bfdbfe;
      background: #eff6ff;
      color: #1d4ed8;
      text-transform: uppercase;
    }

    .status-pill,
    .priority-pill {
      text-transform: capitalize;
    }

    .status-pill[data-status='backlog'],
    .priority-pill[data-priority='low'],
    .muted-pill {
      background: #f8fafc;
      color: #475569;
    }

    .status-pill[data-status='ready'] {
      border-color: #a5f3fc;
      background: #ecfeff;
      color: #155e75;
    }

    .status-pill[data-status='in_progress'] {
      border-color: #bfdbfe;
      background: #eff6ff;
      color: #1d4ed8;
    }

    .status-pill[data-status='blocked'],
    .priority-pill[data-priority='high'] {
      border-color: #fed7aa;
      background: #fff7ed;
      color: #c2410c;
    }

    .status-pill[data-status='done'] {
      border-color: #a7f3d0;
      background: #ecfdf5;
      color: #047857;
    }

    .status-pill[data-status='canceled'] {
      border-color: #cbd5e1;
      background: #f1f5f9;
      color: #475569;
    }

    .priority-pill[data-priority='medium'] {
      border-color: #fde68a;
      background: #fefce8;
      color: #854d0e;
    }

    .priority-pill[data-priority='urgent'] {
      border-color: #fecaca;
      background: #fef2f2;
      color: #b91c1c;
    }

    .label-pill {
      background: #ffffff;
      color: #334155;
    }

    .label-pill--archived {
      background: #f8fafc;
      color: #64748b;
      text-decoration: line-through;
    }

    @media (max-width: 860px) {
      .summary__grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    @media (max-width: 520px) {
      .summary__grid {
        grid-template-columns: 1fr;
      }
    }
  `
})
export class WorkItemDetailSummaryComponent {
  @Input({ required: true }) item!: WorkItemDetailDto;

  memberDisplayName = memberDisplayName;
  workItemMetadata = workItemMetadata;
  workItemPriorityLabel = workItemPriorityLabel;
  workItemStatusLabel = workItemStatusLabel;

  dependencyLabel(item: WorkItemDetailDto): string {
    if (item.relationships.openBlockerCount > 0) {
      return `Blocked by ${item.relationships.openBlockerCount}`;
    }

    if (item.relationships.openBlockedWorkCount > 0) {
      return `Blocks ${item.relationships.openBlockedWorkCount}`;
    }

    return 'No open dependency signals';
  }

  formatDateOnly(value: string): string {
    const [year, month, day] = value.split('-').map(Number);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(new Date(year, month - 1, day));
  }
}
