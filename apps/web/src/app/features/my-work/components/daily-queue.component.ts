import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { MyWorkSummaryCountDto, WorkspaceWorkItemListItemDto } from '@worktrail/contracts';

import {
  projectBadge,
  workItemMetadata,
  workItemPriorityLabel,
  workItemStatusLabel
} from '../../../shared/work-items/work-item-display';
import { workItemChildSummaryLabel } from '../../../shared/work-items/work-item-hierarchy-display';

export interface DailyQueueReason {
  key: MyWorkSummaryCountDto['key'];
  label: string;
  tone: 'critical' | 'warning' | 'info';
}

export interface DailyQueueItem {
  item: WorkspaceWorkItemListItemDto;
  reasons: DailyQueueReason[];
}

@Component({
  selector: 'app-daily-queue',
  imports: [RouterLink],
  template: `
    <section class="queue-panel" aria-labelledby="daily-queue-heading">
      <div class="panel-heading">
        <div>
          <p class="section-eyebrow">Needs attention</p>
          <h2 id="daily-queue-heading">{{ heading }}</h2>
        </div>
        <span>{{ items.length }}</span>
      </div>

      @if (items.length === 0) {
        <div class="compact-empty">
          <strong>{{ emptyTitle }}</strong>
          <span>{{ emptyMessage }}</span>
        </div>
      } @else {
        <div class="queue-list">
          @for (queueItem of items; track queueItem.item.id) {
            <a
              class="queue-row"
              [routerLink]="['/work-items', queueItem.item.id]"
              [queryParams]="detailQueryParams()"
            >
              <span class="queue-row__main">
                <strong>{{ queueItem.item.title }}</strong>
                <small>
                  <span class="project-pill" [class.project-pill--archived]="queueItem.item.project.status === 'archived'">
                    {{ projectBadge(queueItem.item.project) }}
                  </span>
                  <span class="key-pill">{{ queueItem.item.displayKey }}</span>
                  @if (queueItem.item.parent; as parent) {
                    <span class="hierarchy-pill">Child of {{ parent.displayKey }}</span>
                  } @else if (queueItem.item.childSummary; as childSummary) {
                    <span class="hierarchy-pill">{{ childSummaryLabel(childSummary) }}</span>
                  }
                  @if (queueItem.item.openBlockerCount > 0) {
                    <span class="dependency-pill">Blocked by {{ queueItem.item.openBlockerCount }}</span>
                  }
                  @if (queueItem.item.openBlockedWorkCount > 0) {
                    <span class="dependency-pill">Blocks {{ queueItem.item.openBlockedWorkCount }}</span>
                  }
                  <span>{{ workItemMetadata(queueItem.item) }}</span>
                </small>
              </span>

              <span class="queue-reasons">
                @for (reason of queueItem.reasons; track reason.key) {
                  <span class="reason-pill" [attr.data-tone]="reason.tone">{{ reason.label }}</span>
                }
              </span>

              <span class="queue-row__planning">
                <span>{{ queueItem.item.milestone?.name ?? 'No milestone' }}</span>
                <small>{{ dueDateLabel(queueItem.item) }}</small>
              </span>

              <span class="status-pill" [attr.data-status]="queueItem.item.status">
                {{ workItemStatusLabel(queueItem.item.status) }}
              </span>

              <span class="priority-pill" [attr.data-priority]="queueItem.item.priority">
                {{ workItemPriorityLabel(queueItem.item.priority) }}
              </span>
            </a>
          }
        </div>
      }
    </section>
  `,
  styles: `
    .queue-panel {
      display: grid;
      gap: 14px;
      border: 1px solid #dbe3ea;
      border-radius: 8px;
      padding: 16px;
      background: #ffffff;
    }

    .panel-heading {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: flex-start;
    }

    .section-eyebrow {
      margin: 0 0 4px;
      color: #64748b;
      font-size: 0.72rem;
      font-weight: 900;
      letter-spacing: 0;
      text-transform: uppercase;
    }

    h2 {
      margin: 0;
      color: #111827;
      font-size: 1rem;
      line-height: 1.35;
    }

    .panel-heading > span {
      display: inline-grid;
      place-items: center;
      min-width: 28px;
      min-height: 28px;
      border-radius: 999px;
      background: #e8eef6;
      color: #334155;
      font-size: 0.875rem;
      font-weight: 900;
    }

    .queue-list {
      display: grid;
      gap: 8px;
    }

    .queue-row {
      display: grid;
      grid-template-columns: minmax(260px, 1.8fr) minmax(170px, 1fr) minmax(140px, 0.9fr) minmax(110px, auto) minmax(100px, auto);
      gap: 12px;
      align-items: center;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 12px;
      color: #334155;
      font-size: 0.875rem;
      text-decoration: none;
    }

    .queue-row:hover {
      background: #f8fafc;
    }

    .queue-row__main,
    .queue-row__planning {
      display: grid;
      gap: 5px;
      min-width: 0;
    }

    .queue-row strong {
      color: #111827;
      line-height: 1.35;
    }

    .queue-row small {
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
      align-items: center;
      color: #64748b;
      font-size: 0.75rem;
      line-height: 1.35;
    }

    .queue-reasons {
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
    }

    .project-pill,
    .key-pill,
    .dependency-pill,
    .hierarchy-pill,
    .status-pill,
    .priority-pill,
    .reason-pill {
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

    .project-pill {
      border-color: #c7d2fe;
      background: #eef2ff;
      color: #3730a3;
      text-transform: uppercase;
    }

    .project-pill--archived {
      border-color: #fed7aa;
      background: #fff7ed;
      color: #9a3412;
    }

    .key-pill {
      border-color: #bfdbfe;
      background: #eff6ff;
      color: #1d4ed8;
      text-transform: uppercase;
    }

    .hierarchy-pill {
      border-color: #bae6fd;
      background: #f0f9ff;
      color: #0369a1;
    }

    .reason-pill[data-tone='critical'] {
      border-color: #fecaca;
      background: #fef2f2;
      color: #b91c1c;
    }

    .reason-pill[data-tone='warning'] {
      border-color: #fde68a;
      background: #fefce8;
      color: #854d0e;
    }

    .reason-pill[data-tone='info'] {
      border-color: #bfdbfe;
      background: #eff6ff;
      color: #1d4ed8;
    }

    .status-pill,
    .priority-pill {
      text-transform: capitalize;
    }

    .status-pill[data-status='backlog'],
    .priority-pill[data-priority='low'] {
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

    .compact-empty {
      display: grid;
      gap: 4px;
      border: 1px dashed #cbd5e1;
      border-radius: 8px;
      padding: 12px;
      background: #f8fafc;
    }

    .compact-empty strong {
      color: #111827;
      font-size: 0.875rem;
    }

    .compact-empty span {
      color: #64748b;
      font-size: 0.8125rem;
      line-height: 1.4;
    }

    @media (max-width: 960px) {
      .queue-row {
        grid-template-columns: 1fr;
      }
    }
  `
})
export class DailyQueueComponent {
  @Input({ required: true }) items: DailyQueueItem[] = [];
  @Input() returnUrl: string | null = null;
  @Input() heading = 'Next actions';
  @Input() emptyTitle = 'No attention needed';
  @Input() emptyMessage = 'Assigned work with delivery risk signals will appear here.';

  projectBadge = projectBadge;
  workItemMetadata = workItemMetadata;
  workItemStatusLabel = workItemStatusLabel;
  workItemPriorityLabel = workItemPriorityLabel;
  childSummaryLabel = workItemChildSummaryLabel;

  detailQueryParams(): { returnUrl: string } | null {
    return this.returnUrl === null ? null : { returnUrl: this.returnUrl };
  }

  dueDateLabel(item: WorkspaceWorkItemListItemDto): string {
    return item.dueDate === null ? 'No due date' : `Due ${this.formatDateOnly(item.dueDate)}`;
  }

  private formatDateOnly(value: string): string {
    const [year, month, day] = value.split('-').map(Number);

    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric'
    }).format(new Date(year, month - 1, day));
  }
}
