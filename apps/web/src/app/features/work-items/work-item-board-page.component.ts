import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import type { WorkItemListItemDto, WorkItemStatus } from '@worktrail/contracts';

import { WorktrailApiService } from '../../core/worktrail-api.service';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { ErrorPanelComponent } from '../../shared/ui/error-panel.component';
import { LoadingIndicatorComponent } from '../../shared/ui/loading-indicator.component';

const statuses: WorkItemStatus[] = [
  'backlog',
  'ready',
  'in_progress',
  'blocked',
  'done',
  'canceled'
];

@Component({
  selector: 'app-work-item-board-page',
  imports: [EmptyStateComponent, ErrorPanelComponent, LoadingIndicatorComponent, RouterLink],
  template: `
    <section class="page-header">
      <div>
        <p class="eyebrow">Board</p>
        <h1>Project board</h1>
        <p>Move work through the workflow with status menus.</p>
      </div>

      <nav aria-label="Project work navigation">
        <a [routerLink]="['/projects', projectId(), 'work-items']">List</a>
        <a [routerLink]="['/projects', projectId(), 'work-items', 'new']">Create work item</a>
      </nav>
    </section>

    @if (transitionError()) {
      <app-error-panel
        title="Status not changed"
        [message]="transitionError() ?? ''"
        (retry)="loadWorkItems()"
      />
    }

    @if (isLoading()) {
      <app-loading-indicator label="Loading board" />
    } @else if (loadError()) {
      <app-error-panel [message]="loadError() ?? ''" (retry)="loadWorkItems()" />
    } @else {
      <section class="board" aria-label="Project board">
        @for (status of statuses; track status) {
          <section class="board-column" [attr.aria-label]="formatToken(status)">
            <header>
              <h2>{{ formatToken(status) }}</h2>
              <span>{{ itemsByStatus().get(status)?.length ?? 0 }}</span>
            </header>

            @if ((itemsByStatus().get(status)?.length ?? 0) === 0) {
              <app-empty-state
                title="No cards"
                message="Work items in this status will appear here."
              />
            } @else {
              <div class="card-stack">
                @for (item of itemsByStatus().get(status) ?? []; track item.id) {
                  <article class="work-card">
                    <div class="work-card__heading">
                      <a [routerLink]="['/work-items', item.id]">{{ item.title }}</a>
                      <span class="priority-pill" [attr.data-priority]="item.priority">
                        {{ formatToken(item.priority) }}
                      </span>
                    </div>

                    <p>
                      <span class="type-pill">{{ formatToken(item.type) }}</span>
                      <span class="assignee-pill" [class.assignee-pill--empty]="item.assignee === null">
                        {{ item.assignee?.name ?? 'Unassigned' }}
                      </span>
                    </p>

                    @if (item.labels.length > 0) {
                      <div class="labels" aria-label="Labels">
                        @for (label of item.labels; track label.id) {
                          <span [style.border-color]="label.color ?? '#cbd5e1'">{{ label.name }}</span>
                        }
                      </div>
                    }

                    <label>
                      <span>Status</span>
                      <select
                        [value]="item.status"
                        [disabled]="transitioningWorkItemId() === item.id"
                        (change)="transitionCard(item, $event)"
                      >
                        @for (targetStatus of statuses; track targetStatus) {
                          <option [value]="targetStatus" [selected]="targetStatus === item.status">
                            {{ formatToken(targetStatus) }}
                          </option>
                        }
                      </select>
                    </label>
                  </article>
                }
              </div>
            }
          </section>
        }
      </section>
    }
  `,
  styles: `
    :host {
      display: block;
      width: min(1680px, calc(100vw - 48px));
      margin-left: calc((100% - min(1680px, calc(100vw - 48px))) / 2);
    }

    .page-header {
      display: flex;
      justify-content: space-between;
      gap: 20px;
      align-items: flex-start;
      margin-bottom: 20px;
    }

    .eyebrow {
      margin: 0 0 6px;
      color: #64748b;
      font-size: 0.75rem;
      font-weight: 800;
      letter-spacing: 0;
      text-transform: uppercase;
    }

    h1,
    h2,
    p {
      margin: 0;
    }

    h1 {
      color: #111827;
      font-size: 1.75rem;
      line-height: 1.2;
    }

    .page-header p {
      margin-top: 8px;
      color: #64748b;
      font-size: 0.875rem;
      line-height: 1.5;
    }

    nav {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 8px;
    }

    nav a {
      min-height: 38px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 9px 14px;
      color: #1f2937;
      font-size: 0.875rem;
      font-weight: 800;
      text-decoration: none;
    }

    .board {
      display: grid;
      grid-template-columns: repeat(6, minmax(190px, 1fr));
      gap: 12px;
      overflow-x: auto;
      padding-bottom: 8px;
    }

    .board-column {
      display: grid;
      align-content: start;
      gap: 10px;
      min-width: 0;
      border: 1px solid #dbe3ea;
      border-radius: 8px;
      padding: 10px;
      background: #f8fafc;
    }

    .board-column header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }

    h2 {
      color: #111827;
      font-size: 0.875rem;
      line-height: 1.35;
      text-transform: capitalize;
    }

    header span {
      display: inline-grid;
      place-items: center;
      min-width: 24px;
      height: 24px;
      border-radius: 999px;
      background: #e2e8f0;
      color: #334155;
      font-size: 0.75rem;
      font-weight: 800;
    }

    .card-stack {
      display: grid;
      gap: 10px;
    }

    .work-card {
      display: grid;
      gap: 10px;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 12px;
      background: #ffffff;
    }

    .work-card__heading {
      display: grid;
      gap: 6px;
    }

    .work-card a {
      color: #1d4ed8;
      font-size: 0.875rem;
      font-weight: 800;
      line-height: 1.35;
      overflow-wrap: anywhere;
      text-decoration: none;
    }

    .priority-pill,
    .type-pill,
    .assignee-pill,
    .labels span {
      width: fit-content;
      border: 1px solid #cbd5e1;
      border-radius: 999px;
      padding: 2px 7px;
      color: #475569;
      font-size: 0.6875rem;
      font-weight: 800;
      text-transform: capitalize;
    }

    .work-card p {
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
      color: #64748b;
      font-size: 0.8125rem;
      line-height: 1.45;
      overflow-wrap: anywhere;
    }

    .type-pill {
      background: #eef2ff;
      color: #3730a3;
      border-color: #c7d2fe;
    }

    .assignee-pill--empty {
      background: #f8fafc;
      color: #64748b;
    }

    .priority-pill[data-priority='low'] {
      background: #f8fafc;
      color: #475569;
    }

    .priority-pill[data-priority='medium'] {
      background: #fefce8;
      color: #854d0e;
      border-color: #fde68a;
    }

    .priority-pill[data-priority='high'] {
      background: #fff7ed;
      color: #c2410c;
      border-color: #fed7aa;
    }

    .priority-pill[data-priority='urgent'] {
      background: #fef2f2;
      color: #b91c1c;
      border-color: #fecaca;
    }

    .labels {
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
    }

    label {
      display: grid;
      gap: 5px;
      color: #334155;
      font-size: 0.75rem;
      font-weight: 800;
    }

    select {
      width: 100%;
      min-height: 34px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 0 8px;
      background: #ffffff;
      color: #111827;
      font: inherit;
      font-size: 0.8125rem;
    }

    @media (max-width: 980px) {
      :host {
        width: 100%;
        margin-left: 0;
      }

      .page-header {
        flex-direction: column;
      }

      nav {
        justify-content: flex-start;
      }
    }
  `
})
export class WorkItemBoardPageComponent implements OnInit {
  private readonly api = inject(WorktrailApiService);
  private readonly route = inject(ActivatedRoute);

  readonly statuses = statuses;
  readonly projectId = computed(() => this.route.snapshot.paramMap.get('projectId') ?? '');
  readonly workItems = signal<WorkItemListItemDto[]>([]);
  readonly isLoading = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly transitionError = signal<string | null>(null);
  readonly transitioningWorkItemId = signal<string | null>(null);

  readonly itemsByStatus = computed(() => {
    const grouped = new Map<WorkItemStatus, WorkItemListItemDto[]>();

    for (const status of statuses) {
      grouped.set(status, []);
    }

    for (const item of this.workItems()) {
      grouped.get(item.status)?.push(item);
    }

    return grouped;
  });

  ngOnInit(): void {
    this.loadWorkItems();
  }

  loadWorkItems(): void {
    this.isLoading.set(true);
    this.loadError.set(null);

    this.api.listWorkItems(this.projectId(), { sort: 'priority_desc' }).subscribe({
      next: (workItems) => {
        this.workItems.set(workItems);
        this.isLoading.set(false);
      },
      error: () => {
        this.loadError.set('Board work items could not be loaded from the API.');
        this.isLoading.set(false);
      }
    });
  }

  transitionCard(item: WorkItemListItemDto, event: Event): void {
    const select = event.target as HTMLSelectElement;
    const status = select.value as WorkItemStatus;

    if (status === item.status) {
      return;
    }

    this.transitionError.set(null);
    this.transitioningWorkItemId.set(item.id);

    this.api.transitionWorkItem(item.id, { status }).subscribe({
      next: () => {
        this.transitioningWorkItemId.set(null);
        this.loadWorkItems();
      },
      error: () => {
        select.value = item.status;
        this.transitionError.set('The requested status transition was rejected.');
        this.transitioningWorkItemId.set(null);
      }
    });
  }

  formatToken(value: string): string {
    return value.replaceAll('_', ' ');
  }
}
