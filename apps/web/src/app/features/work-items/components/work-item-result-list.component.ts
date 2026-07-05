import { Component, EventEmitter, Input, Output } from '@angular/core';
import { RouterLink } from '@angular/router';
import type {
  WorkItemListItemDto,
  WorkspaceWorkItemListItemDto
} from '@worktrail/contracts';

import { formatToken } from '../../../shared/display/token-format';
import { memberDisplayName } from '../../../shared/display/member-display';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { ErrorPanelComponent } from '../../../shared/ui/error-panel.component';
import { LoadingIndicatorComponent } from '../../../shared/ui/loading-indicator.component';
import {
  projectBadge,
  workItemMetadata,
  workItemPriorityLabel,
  workItemStatusLabel
} from '../../../shared/work-items/work-item-display';

type ResultItem = WorkItemListItemDto | WorkspaceWorkItemListItemDto;

@Component({
  selector: 'app-work-item-result-list',
  imports: [EmptyStateComponent, ErrorPanelComponent, LoadingIndicatorComponent, RouterLink],
  template: `
    <section class="list-panel" [attr.data-mode]="mode">
      <div class="list-heading">
        <h2>{{ items.length }} work items</h2>
      </div>

      @if (isLoading) {
        <app-loading-indicator [label]="loadingLabel" />
      } @else if (error !== null) {
        <app-error-panel [message]="error" (retry)="retry.emit()" />
      } @else if (items.length === 0) {
        <app-empty-state [title]="emptyTitle" [message]="emptyMessage" />
      } @else {
        <div class="work-item-table" role="table" [attr.aria-label]="ariaLabel">
          <div class="work-item-table__head" role="row">
            <span>Title</span>
            @if (mode === 'workspace') {
              <span>Project</span>
            }
            <span>Status</span>
            <span>Assignee</span>
            <span>Planning</span>
            <span>Priority</span>
            <span>Updated</span>
          </div>

          @for (item of items; track item.id) {
            <a
              class="work-item-row"
              role="row"
              [routerLink]="['/work-items', item.id]"
              [queryParams]="detailQueryParams()"
            >
              <span class="work-item-row__title">
                <strong>{{ item.title }}</strong>
                <small class="row-meta">
                  <span class="key-pill">{{ item.displayKey }}</span>
                  <span class="type-pill">{{ formatToken(item.type) }}</span>
                  @if (mode === 'workspace') {
                    <span>{{ workItemMetadata(item) }}</span>
                  }
                  @if (item.labels.length === 0) {
                    <span class="muted-pill">No labels</span>
                  } @else {
                    @for (label of item.labels; track label.id) {
                      <span class="label-pill" [style.border-color]="label.color ?? '#cbd5e1'">
                        {{ label.name }}
                      </span>
                    }
                  }
                  @if (item.openBlockerCount > 0) {
                    <span class="dependency-pill">Blocked by {{ item.openBlockerCount }}</span>
                  }
                  @if (item.openBlockedWorkCount > 0) {
                    <span class="dependency-pill">Blocks {{ item.openBlockedWorkCount }}</span>
                  }
                </small>
              </span>

              @if (workspaceItem(item); as workspaceItem) {
                <span class="project-cell">
                  <span
                    class="project-pill"
                    [class.project-pill--archived]="workspaceItem.project.status === 'archived'"
                  >
                    {{ projectBadge(workspaceItem.project) }}
                  </span>
                  <small>{{ workspaceItem.project.name }}</small>
                </span>
              }

              <span class="status-pill" [attr.data-status]="item.status">
                {{ workItemStatusLabel(item.status) }}
              </span>

              <span
                class="assignee-pill"
                [class.assignee-pill--empty]="item.assignee === null"
                [class.assignee-pill--inactive]="item.assignee?.isActive === false"
              >
                {{ item.assignee === null ? 'Unassigned' : memberDisplayName(item.assignee) }}
              </span>

              <span class="planning-cell">
                <span
                  [class.muted-pill]="item.milestone === null"
                  [class.milestone-pill]="item.milestone !== null"
                >
                  {{ item.milestone?.name ?? 'No milestone' }}
                </span>
                <small>{{ dueDateLabel(item) }}</small>
              </span>

              <span class="priority-pill" [attr.data-priority]="item.priority">
                {{ workItemPriorityLabel(item.priority) }}
              </span>

              <span>{{ formatDate(item.updatedAt) }}</span>
            </a>
          }
        </div>
      }
    </section>
  `,
  styles: `
    .list-panel {
      display: grid;
      gap: 14px;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 16px;
      background: #ffffff;
    }

    .list-heading h2 {
      margin: 0;
      color: #111827;
      font-size: 1rem;
      line-height: 1.35;
    }

    .work-item-table {
      display: grid;
      overflow-x: auto;
    }

    .work-item-table__head,
    .work-item-row {
      display: grid;
      grid-template-columns: var(--result-columns);
      gap: 14px;
      min-width: var(--result-min-width);
      align-items: center;
    }

    .list-panel[data-mode='workspace'] {
      --result-columns: minmax(280px, 2fr) minmax(170px, 1fr) minmax(120px, 0.7fr) minmax(150px, 0.9fr) minmax(150px, 1fr) minmax(110px, 0.7fr) minmax(110px, 0.7fr);
      --result-min-width: 1160px;
    }

    .list-panel[data-mode='project'] {
      --result-columns: minmax(280px, 2fr) minmax(110px, 0.8fr) minmax(140px, 1fr) minmax(150px, 1fr) minmax(100px, 0.7fr) minmax(120px, 0.8fr);
      --result-min-width: 980px;
    }

    .work-item-table__head {
      border-bottom: 1px solid #e5e7eb;
      padding: 0 10px 10px;
      color: #64748b;
      font-size: 0.75rem;
      font-weight: 800;
      text-transform: uppercase;
    }

    .work-item-row {
      border-bottom: 1px solid #eef2f7;
      padding: 12px 10px;
      color: #334155;
      font-size: 0.875rem;
      text-decoration: none;
    }

    .work-item-row:hover {
      background: #f8fafc;
    }

    .work-item-row__title,
    .project-cell,
    .planning-cell {
      display: grid;
      gap: 4px;
      align-content: center;
    }

    .work-item-row strong {
      color: #111827;
      line-height: 1.35;
    }

    .work-item-row small,
    .project-cell small,
    .planning-cell small {
      color: #64748b;
      font-size: 0.75rem;
      line-height: 1.35;
    }

    .row-meta,
    .key-pill,
    .label-pill,
    .milestone-pill,
    .project-pill,
    .status-pill,
    .priority-pill,
    .assignee-pill,
    .type-pill,
    .muted-pill,
    .dependency-pill {
      display: inline-flex;
      align-items: center;
      width: fit-content;
    }

    .row-meta {
      flex-wrap: wrap;
      gap: 5px;
    }

    .label-pill,
    .milestone-pill,
    .key-pill,
    .project-pill,
    .status-pill,
    .priority-pill,
    .assignee-pill,
    .type-pill,
    .muted-pill,
    .dependency-pill {
      min-height: 22px;
      border: 1px solid #cbd5e1;
      border-radius: 999px;
      padding: 2px 8px;
      font-size: 0.75rem;
      font-weight: 800;
      text-transform: capitalize;
    }

    .key-pill,
    .project-pill,
    .type-pill {
      border-color: #c7d2fe;
      background: #eef2ff;
      color: #3730a3;
    }

    .key-pill,
    .project-pill {
      text-transform: uppercase;
    }

    .project-pill--archived {
      border-color: #fed7aa;
      background: #fff7ed;
      color: #9a3412;
    }

    .milestone-pill {
      border-color: #bbf7d0;
      background: #f0fdf4;
      color: #166534;
    }

    .dependency-pill {
      border-color: #fed7aa;
      background: #fff7ed;
      color: #c2410c;
    }

    .muted-pill,
    .assignee-pill--empty {
      background: #f8fafc;
      color: #64748b;
    }

    .assignee-pill--inactive {
      border-color: #e2e8f0;
      background: #f8fafc;
      color: #64748b;
    }

    .status-pill[data-status='backlog'] {
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

    .status-pill[data-status='blocked'] {
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

    .priority-pill[data-priority='low'] {
      background: #f8fafc;
      color: #475569;
    }

    .priority-pill[data-priority='medium'] {
      border-color: #fde68a;
      background: #fefce8;
      color: #854d0e;
    }

    .priority-pill[data-priority='high'] {
      border-color: #fed7aa;
      background: #fff7ed;
      color: #c2410c;
    }

    .priority-pill[data-priority='urgent'] {
      border-color: #fecaca;
      background: #fef2f2;
      color: #b91c1c;
    }
  `
})
export class WorkItemResultListComponent {
  @Input({ required: true }) items: ResultItem[] = [];
  @Input() mode: 'project' | 'workspace' = 'project';
  @Input() isLoading = false;
  @Input() error: string | null = null;
  @Input() returnUrl: string | null = null;
  @Input() loadingLabel = 'Loading work items';
  @Input() emptyTitle = 'No work items found';
  @Input() emptyMessage = 'Work items will appear here.';
  @Input() ariaLabel = 'Work items';
  @Output() readonly retry = new EventEmitter<void>();

  formatToken(value: string): string {
    return formatToken(value);
  }

  memberDisplayName = memberDisplayName;
  projectBadge = projectBadge;
  workItemMetadata = workItemMetadata;
  workItemPriorityLabel = workItemPriorityLabel;
  workItemStatusLabel = workItemStatusLabel;

  detailQueryParams(): { returnUrl: string } | null {
    return this.returnUrl === null ? null : { returnUrl: this.returnUrl };
  }

  workspaceItem(item: ResultItem): WorkspaceWorkItemListItemDto | null {
    return 'project' in item ? item : null;
  }

  dueDateLabel(item: ResultItem): string {
    return item.dueDate === null ? 'No due date' : `Due ${this.formatDateOnly(item.dueDate)}`;
  }

  formatDate(value: string): string {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric'
    }).format(new Date(value));
  }

  private formatDateOnly(value: string): string {
    const [year, month, day] = value.split('-').map(Number);

    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric'
    }).format(new Date(year, month - 1, day));
  }
}
