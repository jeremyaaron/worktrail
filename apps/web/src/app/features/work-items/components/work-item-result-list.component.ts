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
import { workItemChildSummaryLabel } from '../../../shared/work-items/work-item-hierarchy-display';

type ResultItem = WorkItemListItemDto | WorkspaceWorkItemListItemDto;

@Component({
  selector: 'app-work-item-result-list',
  imports: [EmptyStateComponent, ErrorPanelComponent, LoadingIndicatorComponent, RouterLink],
  template: `
    <section class="list-panel" [attr.data-mode]="mode" [attr.data-selection]="selectionEnabled ? 'true' : 'false'">
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
            @if (selectionEnabled) {
              <span class="selection-cell">
                <input
                  type="checkbox"
                  class="selection-checkbox"
                  aria-label="Select all visible work items"
                  [checked]="allVisibleSelected"
                  (change)="toggleAllVisibleSelection.emit()"
                />
              </span>
            }
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
            <div
              class="work-item-row"
              role="row"
              [class.work-item-row--selected]="isSelected(item.id)"
            >
              @if (selectionEnabled) {
                <span class="selection-cell">
                  <input
                    type="checkbox"
                    class="selection-checkbox"
                    [attr.aria-label]="selectionLabel(item)"
                    [checked]="isSelected(item.id)"
                    (change)="toggleSelection.emit(item.id)"
                  />
                </span>
              }
              <span class="work-item-row__title">
                <a
                  class="work-item-title-link"
                  [routerLink]="['/work-items', item.id]"
                  [queryParams]="detailQueryParams()"
                >
                  {{ item.title }}
                </a>
                <small class="row-meta">
                  <span class="key-pill">{{ item.displayKey }}</span>
                  <span class="type-pill">{{ formatToken(item.type) }}</span>
                  @if (mode === 'workspace') {
                    <span>{{ workItemMetadata(item) }}</span>
                  }
                  @if (item.parent; as parent) {
                    <a
                      class="hierarchy-link"
                      [routerLink]="['/work-items', parent.id]"
                      [queryParams]="detailQueryParams()"
                    >
                      Child of {{ parent.displayKey }}
                    </a>
                  } @else if (item.childSummary; as childSummary) {
                    <span class="hierarchy-pill">{{ childSummaryLabel(childSummary) }}</span>
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
                <span
                  [class.muted-pill]="item.cycle === null"
                  [class.cycle-pill]="item.cycle !== null"
                >
                  {{ item.cycle?.name ?? 'No cycle' }}
                </span>
                <small>{{ dueDateLabel(item) }}</small>
              </span>

              <span class="priority-pill" [attr.data-priority]="item.priority">
                {{ workItemPriorityLabel(item.priority) }}
              </span>

              <span>{{ formatDate(item.updatedAt) }}</span>
            </div>
          }
        </div>

        <div class="work-item-cards" [attr.aria-label]="ariaLabel + ' cards'">
          @for (item of items; track item.id) {
            <article
              class="work-item-card"
              [class.work-item-card--selected]="isSelected(item.id)"
            >
              <span class="work-item-card__top">
                @if (selectionEnabled) {
                  <input
                    type="checkbox"
                    class="selection-checkbox"
                    [attr.aria-label]="selectionLabel(item)"
                    [checked]="isSelected(item.id)"
                    (change)="toggleSelection.emit(item.id)"
                  />
                }
                <span class="work-item-card__heading">
                  <a
                    class="work-item-card__title-link"
                    [routerLink]="['/work-items', item.id]"
                    [queryParams]="detailQueryParams()"
                  >
                    {{ item.title }}
                  </a>
                  <span class="work-item-card__meta">
                    <span class="key-pill">{{ item.displayKey }}</span>
                    <span class="type-pill">{{ formatToken(item.type) }}</span>
                    @if (workspaceItem(item); as workspaceItem) {
                      <span
                        class="project-pill"
                        [class.project-pill--archived]="workspaceItem.project.status === 'archived'"
                      >
                        {{ projectBadge(workspaceItem.project) }}
                      </span>
                    }
                    @if (item.parent; as parent) {
                      <a
                        class="hierarchy-link"
                        [routerLink]="['/work-items', parent.id]"
                        [queryParams]="detailQueryParams()"
                      >
                        Child of {{ parent.displayKey }}
                      </a>
                    } @else if (item.childSummary; as childSummary) {
                      <span class="hierarchy-pill">{{ childSummaryLabel(childSummary) }}</span>
                    }
                  </span>
                </span>
              </span>

              <span class="work-item-card__state">
                <span class="status-pill" [attr.data-status]="item.status">
                  {{ workItemStatusLabel(item.status) }}
                </span>
                <span class="priority-pill" [attr.data-priority]="item.priority">
                  {{ workItemPriorityLabel(item.priority) }}
                </span>
              </span>

              <dl class="work-item-card__facts">
                @if (workspaceItem(item); as workspaceItem) {
                  <div>
                    <dt>Project</dt>
                    <dd>{{ workspaceItem.project.key }} · {{ workspaceItem.project.name }}</dd>
                  </div>
                }
                <div>
                  <dt>Assignee</dt>
                  <dd>{{ item.assignee === null ? 'Unassigned' : memberDisplayName(item.assignee) }}</dd>
                </div>
                <div>
                  <dt>Milestone</dt>
                  <dd>{{ item.milestone?.name ?? 'No milestone' }}</dd>
                </div>
                <div>
                  <dt>Cycle</dt>
                  <dd>{{ item.cycle?.name ?? 'No cycle' }}</dd>
                </div>
                <div>
                  <dt>Due date</dt>
                  <dd>{{ dueDateLabel(item) }}</dd>
                </div>
                <div>
                  <dt>Dependency</dt>
                  <dd>{{ dependencyLabel(item) }}</dd>
                </div>
              </dl>

              <span class="work-item-card__labels">
                @if (item.labels.length === 0) {
                  <span class="muted-pill">No labels</span>
                } @else {
                  @for (label of item.labels; track label.id) {
                    <span class="label-pill" [style.border-color]="label.color ?? '#cbd5e1'">
                      {{ label.name }}
                    </span>
                  }
                }
              </span>
            </article>
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

    .work-item-cards {
      display: none;
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

    .list-panel[data-selection='true'][data-mode='workspace'] {
      --result-columns: minmax(38px, 38px) minmax(280px, 2fr) minmax(170px, 1fr) minmax(120px, 0.7fr) minmax(150px, 0.9fr) minmax(150px, 1fr) minmax(110px, 0.7fr) minmax(110px, 0.7fr);
      --result-min-width: 1212px;
    }

    .list-panel[data-selection='true'][data-mode='project'] {
      --result-columns: minmax(38px, 38px) minmax(280px, 2fr) minmax(110px, 0.8fr) minmax(140px, 1fr) minmax(150px, 1fr) minmax(100px, 0.7fr) minmax(120px, 0.8fr);
      --result-min-width: 1032px;
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

    .work-item-row:hover,
    .work-item-row--selected,
    .work-item-card--selected {
      background: #f8fafc;
    }

    .selection-cell {
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 0;
      min-height: 22px;
    }

    .selection-checkbox {
      flex: 0 0 16px;
      width: 16px;
      min-width: 16px;
      height: 16px;
      min-height: 16px;
      margin: 0;
      padding: 0;
      accent-color: #1f4f99;
      cursor: pointer;
    }

    .work-item-row__title,
    .project-cell,
    .planning-cell,
    .work-item-card__heading {
      display: grid;
      gap: 4px;
      align-content: center;
    }

    .work-item-title-link,
    .work-item-card__title-link {
      color: #111827;
      font-weight: 800;
      line-height: 1.35;
      text-decoration: none;
    }

    .work-item-title-link:hover,
    .work-item-card__title-link:hover {
      color: #1d4ed8;
      text-decoration: underline;
    }

    .work-item-row small,
    .project-cell small,
    .planning-cell small {
      color: #64748b;
      font-size: 0.75rem;
      line-height: 1.35;
    }

    .row-meta,
    .work-item-card__meta,
    .work-item-card__state,
    .work-item-card__labels,
    .key-pill,
    .label-pill,
    .milestone-pill,
    .cycle-pill,
    .project-pill,
    .status-pill,
    .priority-pill,
    .assignee-pill,
    .type-pill,
    .muted-pill,
    .dependency-pill,
    .hierarchy-link,
    .hierarchy-pill {
      display: inline-flex;
      align-items: center;
      width: fit-content;
    }

    .row-meta {
      flex-wrap: wrap;
      gap: 5px;
    }

    .work-item-card__meta,
    .work-item-card__state,
    .work-item-card__labels {
      flex-wrap: wrap;
      gap: 6px;
      align-items: center;
    }

    .label-pill,
    .milestone-pill,
    .cycle-pill,
    .key-pill,
    .project-pill,
    .status-pill,
    .priority-pill,
    .assignee-pill,
    .type-pill,
    .muted-pill,
    .dependency-pill,
    .hierarchy-link,
    .hierarchy-pill {
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

    .cycle-pill {
      border-color: #bfdbfe;
      background: #eff6ff;
      color: #1d4ed8;
    }

    .dependency-pill {
      border-color: #fed7aa;
      background: #fff7ed;
      color: #c2410c;
    }

    .hierarchy-link,
    .hierarchy-pill {
      border-color: #bae6fd;
      background: #f0f9ff;
      color: #0369a1;
      text-decoration: none;
      text-transform: none;
    }

    .hierarchy-link:hover {
      border-color: #7dd3fc;
      text-decoration: underline;
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

    .work-item-card {
      display: grid;
      gap: 12px;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 12px;
      background: #ffffff;
      color: #334155;
      font-size: 0.875rem;
    }

    .work-item-card:hover {
      background: #f8fafc;
    }

    .work-item-card__top {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      gap: 10px;
      align-items: start;
    }

    .work-item-card__top > .selection-checkbox {
      margin-top: 2px;
    }

    .list-panel[data-selection='false'] .work-item-card__top {
      grid-template-columns: minmax(0, 1fr);
    }

    .work-item-card__facts {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
      margin: 0;
    }

    .work-item-card__facts div {
      min-width: 0;
    }

    .work-item-card__facts dt {
      color: #64748b;
      font-size: 0.7rem;
      font-weight: 900;
      text-transform: uppercase;
    }

    .work-item-card__facts dd {
      margin: 2px 0 0;
      color: #111827;
      font-size: 0.8125rem;
      font-weight: 750;
      line-height: 1.35;
      overflow-wrap: anywhere;
    }

    @media (max-width: 760px) {
      .list-panel {
        padding: 12px;
      }

      .work-item-table {
        display: none;
      }

      .work-item-cards {
        display: grid;
        gap: 10px;
      }
    }

    @media (max-width: 520px) {
      .work-item-card__facts {
        grid-template-columns: 1fr;
      }
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
  @Input() selectionEnabled = false;
  @Input() selectedItemIds: string[] = [];
  @Input() allVisibleSelected = false;
  @Output() readonly retry = new EventEmitter<void>();
  @Output() readonly toggleSelection = new EventEmitter<string>();
  @Output() readonly toggleAllVisibleSelection = new EventEmitter<void>();

  formatToken(value: string): string {
    return formatToken(value);
  }

  memberDisplayName = memberDisplayName;
  projectBadge = projectBadge;
  workItemMetadata = workItemMetadata;
  workItemPriorityLabel = workItemPriorityLabel;
  workItemStatusLabel = workItemStatusLabel;
  childSummaryLabel = workItemChildSummaryLabel;

  detailQueryParams(): { returnUrl: string } | null {
    return this.returnUrl === null ? null : { returnUrl: this.returnUrl };
  }

  isSelected(itemId: string): boolean {
    return this.selectedItemIds.includes(itemId);
  }

  selectionLabel(item: ResultItem): string {
    return `Select ${item.displayKey}`;
  }

  workspaceItem(item: ResultItem): WorkspaceWorkItemListItemDto | null {
    return 'project' in item ? item : null;
  }

  dueDateLabel(item: ResultItem): string {
    return item.dueDate === null ? 'No due date' : `Due ${this.formatDateOnly(item.dueDate)}`;
  }

  dependencyLabel(item: ResultItem): string {
    if (item.openBlockerCount > 0) {
      return `Blocked by ${item.openBlockerCount}`;
    }

    if (item.openBlockedWorkCount > 0) {
      return `Blocks ${item.openBlockedWorkCount}`;
    }

    return 'No open dependency signals';
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
