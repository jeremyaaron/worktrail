import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { WorkItemChildrenDto, WorkItemDetailDto } from '@worktrail/contracts';

import { WorktrailApiService } from '../../../core/worktrail-api.service';
import { memberDisplayName } from '../../../shared/display/member-display';
import { workItemStatusLabel } from '../../../shared/work-items/work-item-display';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { ErrorPanelComponent } from '../../../shared/ui/error-panel.component';
import { LoadingIndicatorComponent } from '../../../shared/ui/loading-indicator.component';

const childRowLimit = 8;

@Component({
  selector: 'app-work-item-child-work',
  imports: [EmptyStateComponent, ErrorPanelComponent, LoadingIndicatorComponent, RouterLink],
  template: `
    <section class="child-work" aria-labelledby="child-work-heading">
      <div class="child-work__heading">
        <div>
          <p class="eyebrow">Work breakdown</p>
          <h2 id="child-work-heading">Child work</h2>
        </div>

        <div class="child-work__actions">
          @if (!readOnly()) {
            <a
              [routerLink]="['/projects', item().projectId, 'work-items', 'new']"
              [queryParams]="{ parentWorkItemId: item().id, returnUrl: detailUrl() }"
            >
              Add child work item
            </a>
          }
          <a
            [routerLink]="['/projects', item().projectId, 'work-items']"
            [queryParams]="{ parentKey: item().displayKey }"
          >
            View all child work
          </a>
        </div>
      </div>

      @if (item().childSummary; as summary) {
        <dl class="child-summary" aria-label="Direct child work summary">
          <div>
            <dt>Total</dt>
            <dd>{{ summary.totalCount }}</dd>
          </div>
          <div>
            <dt>Open</dt>
            <dd>{{ summary.openCount }}</dd>
          </div>
          <div>
            <dt>Done</dt>
            <dd>{{ summary.doneCount }}</dd>
          </div>
          <div>
            <dt>Canceled</dt>
            <dd>{{ summary.canceledCount }}</dd>
          </div>
          <div>
            <dt>Estimated</dt>
            <dd>{{ summary.estimatedCount }}</dd>
          </div>
          <div>
            <dt>Unestimated</dt>
            <dd>{{ summary.unestimatedCount }}</dd>
          </div>
          <div>
            <dt>Child points</dt>
            <dd>{{ summary.estimatePoints }}</dd>
          </div>
        </dl>
      }

      @if (isLoading()) {
        <app-loading-indicator label="Loading child work" />
      } @else if (loadError()) {
        <app-error-panel
          title="Child work unavailable"
          [message]="loadError() ?? ''"
          (retry)="loadChildren()"
        />
      } @else if (children().items.length === 0) {
        <app-empty-state
          title="No child work found"
          message="The child summary changed, but no direct child rows are currently available."
        />
      } @else {
        <div class="child-list" aria-label="Direct child work items">
          @for (child of children().items; track child.id) {
            <a
              class="child-row"
              [routerLink]="['/work-items', child.id]"
              [queryParams]="{ returnUrl: detailUrl() }"
            >
              <span class="child-row__identity">
                <span class="child-key">{{ child.displayKey }}</span>
                <strong>{{ child.title }}</strong>
              </span>
              <span class="status" [attr.data-status]="child.status">
                {{ workItemStatusLabel(child.status) }}
              </span>
              <span>{{ child.assignee === null ? 'Unassigned' : memberDisplayName(child.assignee) }}</span>
              <span>{{ child.estimatePoints === null ? 'Unestimated' : child.estimatePoints + ' points' }}</span>
            </a>
          }
        </div>

        @if (children().hasMore || children().totalCount > children().items.length) {
          <p class="bounded-note">
            Showing {{ children().items.length }} of {{ children().totalCount }} direct children.
          </p>
        }
      }
    </section>
  `,
  styles: `
    .child-work {
      display: grid;
      gap: 14px;
      margin-bottom: 18px;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 18px;
      background: #ffffff;
    }

    .child-work__heading,
    .child-work__actions,
    .child-row,
    .child-row__identity {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .child-work__heading {
      justify-content: space-between;
      align-items: flex-start;
    }

    .child-work__actions {
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 8px;
    }

    .eyebrow,
    h2,
    dl,
    p {
      margin: 0;
    }

    .eyebrow {
      margin-bottom: 4px;
      color: #64748b;
      font-size: 0.72rem;
      font-weight: 900;
      text-transform: uppercase;
    }

    h2 {
      color: #111827;
      font-size: 1.05rem;
    }

    .child-work__actions a {
      min-height: 36px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 8px 12px;
      background: #ffffff;
      color: #1f2937;
      font-size: 0.8125rem;
      font-weight: 800;
      text-decoration: none;
    }

    .child-summary {
      display: grid;
      grid-template-columns: repeat(7, minmax(76px, 1fr));
      gap: 8px;
    }

    .child-summary div {
      display: grid;
      gap: 4px;
      min-width: 0;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      padding: 9px;
      background: #f8fafc;
    }

    dt {
      color: #64748b;
      font-size: 0.68rem;
      font-weight: 900;
      text-transform: uppercase;
    }

    dd {
      margin: 0;
      color: #111827;
      font-size: 0.95rem;
      font-weight: 900;
    }

    .child-list {
      display: grid;
      border-top: 1px solid #e5e7eb;
    }

    .child-row {
      display: grid;
      grid-template-columns: minmax(260px, 1.7fr) minmax(100px, 0.6fr) minmax(140px, 0.8fr) minmax(90px, 0.5fr);
      min-height: 48px;
      border-bottom: 1px solid #e5e7eb;
      padding: 9px 6px;
      color: #475569;
      font-size: 0.8125rem;
      text-decoration: none;
    }

    .child-row:hover,
    .child-row:focus-visible {
      background: #f8fafc;
    }

    .child-row__identity {
      min-width: 0;
    }

    .child-row strong {
      min-width: 0;
      color: #111827;
      line-height: 1.35;
      overflow-wrap: anywhere;
    }

    .child-key,
    .status {
      width: fit-content;
      min-height: 22px;
      border: 1px solid #cbd5e1;
      border-radius: 999px;
      padding: 2px 8px;
      background: #f8fafc;
      color: #475569;
      font-size: 0.72rem;
      font-weight: 800;
      white-space: nowrap;
    }

    .child-key {
      border-color: #c7d2fe;
      background: #eef2ff;
      color: #3730a3;
    }

    .status[data-status='done'] {
      border-color: #a7f3d0;
      background: #ecfdf5;
      color: #047857;
    }

    .status[data-status='blocked'] {
      border-color: #fed7aa;
      background: #fff7ed;
      color: #c2410c;
    }

    .bounded-note {
      color: #64748b;
      font-size: 0.75rem;
      line-height: 1.4;
    }

    @media (max-width: 900px) {
      .child-summary {
        grid-template-columns: repeat(4, minmax(76px, 1fr));
      }

      .child-row {
        grid-template-columns: minmax(0, 1fr) auto;
      }

      .child-row > span:nth-child(n + 3) {
        display: none;
      }
    }

    @media (max-width: 600px) {
      .child-work__heading {
        align-items: stretch;
        flex-direction: column;
      }

      .child-work__actions {
        justify-content: flex-start;
      }

      .child-summary {
        grid-template-columns: repeat(2, minmax(76px, 1fr));
      }

      .child-row__identity {
        align-items: flex-start;
        flex-direction: column;
      }
    }
  `
})
export class WorkItemChildWorkComponent {
  private readonly api = inject(WorktrailApiService);
  private requestId = 0;
  private loadedSignature = '';

  readonly item = input.required<WorkItemDetailDto>();
  readonly readOnly = input(false);
  readonly children = signal<WorkItemChildrenDto>({ items: [], totalCount: 0, hasMore: false });
  readonly isLoading = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly detailUrl = computed(() => `/work-items/${this.item().id}`);
  readonly memberDisplayName = memberDisplayName;
  readonly workItemStatusLabel = workItemStatusLabel;

  constructor() {
    effect(() => {
      const item = this.item();
      const summary = item.childSummary;
      const signature = summary === null
        ? `${item.id}:none`
        : `${item.id}:${summary.totalCount}:${summary.openCount}:${summary.doneCount}:${summary.canceledCount}:${summary.estimatedCount}:${summary.unestimatedCount}:${summary.estimatePoints}`;

      if (signature === this.loadedSignature) {
        return;
      }

      this.loadedSignature = signature;

      if (summary === null) {
        this.requestId += 1;
        this.children.set({ items: [], totalCount: 0, hasMore: false });
        this.isLoading.set(false);
        this.loadError.set(null);
        return;
      }

      this.loadChildren();
    });
  }

  loadChildren(): void {
    if (this.item().childSummary === null) {
      return;
    }

    const workItemId = this.item().id;
    const requestId = ++this.requestId;
    this.isLoading.set(true);
    this.loadError.set(null);

    this.api.listWorkItemChildren(workItemId, childRowLimit).subscribe({
      next: (children) => {
        if (requestId !== this.requestId || workItemId !== this.item().id) {
          return;
        }

        this.children.set(children);
        this.isLoading.set(false);
      },
      error: () => {
        if (requestId !== this.requestId || workItemId !== this.item().id) {
          return;
        }

        this.loadError.set('Direct child work could not be loaded from the API.');
        this.isLoading.set(false);
      }
    });
  }
}
