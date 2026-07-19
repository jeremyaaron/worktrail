import {
  CdkDrag,
  type CdkDragDrop,
  CdkDragHandle,
  CdkDropList
} from '@angular/cdk/drag-drop';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import type {
  MoveWorkItemOnBoardRequest,
  ProjectDto,
  WorkItemListItemDto,
  WorkItemStatus
} from '@worktrail/contracts';

import { CurrentUserService } from '../../core/current-user.service';
import { WorktrailApiService } from '../../core/worktrail-api.service';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { ErrorPanelComponent } from '../../shared/ui/error-panel.component';
import { LoadingIndicatorComponent } from '../../shared/ui/loading-indicator.component';
import { workItemChildSummaryLabel } from '../../shared/work-items/work-item-hierarchy-display';

const statuses: WorkItemStatus[] = [
  'backlog',
  'ready',
  'in_progress',
  'blocked',
  'done',
  'canceled'
];
const terminalStatuses = new Set<WorkItemStatus>(['done', 'canceled']);

@Component({
  selector: 'app-work-item-board-page',
  imports: [
    CdkDrag,
    CdkDragHandle,
    CdkDropList,
    EmptyStateComponent,
    ErrorPanelComponent,
    LoadingIndicatorComponent,
    RouterLink
  ],
  template: `
    <section class="page-header">
      <div>
        <p class="eyebrow">Board</p>
        <h1>Project board</h1>
        <p>Move work through the workflow with status menus.</p>
      </div>
    </section>

    @if (isArchivedProject()) {
      <section class="notice" aria-label="Archived project">
        <strong>Archived project</strong>
        <p>Project work is read-only until it is reactivated in settings.</p>
      </section>
    }

    @if (transitionError()) {
      <app-error-panel
        title="Board move failed"
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

            <div
              class="card-stack"
              cdkDropList
              [id]="dropListId(status)"
              [cdkDropListData]="status"
              [cdkDropListConnectedTo]="dropListIds()"
              [cdkDropListDisabled]="isArchivedProject()"
              (cdkDropListDropped)="dropCard($event)"
            >
              @if ((itemsByStatus().get(status)?.length ?? 0) === 0) {
                <app-empty-state
                  title="No cards"
                  message="Work items in this status will appear here."
                />
              } @else {
                @for (item of itemsByStatus().get(status) ?? []; track item.id) {
                  <article
                    class="work-card"
                    cdkDrag
                    [cdkDragData]="item"
                    [cdkDragDisabled]="!canMoveItem(item) || transitioningWorkItemId() === item.id"
                  >
                    <div class="work-card__heading">
                      <div class="work-card__controls">
                        <span class="work-key">{{ item.displayKey }}</span>
                        <button
                          type="button"
                          class="drag-handle"
                          cdkDragHandle
                          [disabled]="!canMoveItem(item) || transitioningWorkItemId() === item.id"
                          [attr.aria-label]="'Drag ' + item.displayKey"
                        >
                          Move
                        </button>
                      </div>
                      <a
                        [routerLink]="['/work-items', item.id]"
                        [queryParams]="detailQueryParams()"
                      >
                        {{ item.title }}
                      </a>
                      <span class="priority-pill" [attr.data-priority]="item.priority">
                        {{ formatToken(item.priority) }}
                      </span>
                    </div>

                    <p>
                      <span class="type-pill">{{ formatToken(item.type) }}</span>
                      @if (item.milestone !== null) {
                        <span class="milestone-pill">{{ item.milestone.name }}</span>
                      }
                      @if (item.cycle !== null) {
                        <span class="cycle-pill">{{ item.cycle.name }}</span>
                      }
                      <span
                        class="assignee-pill"
                        [class.assignee-pill--empty]="item.assignee === null"
                        [class.assignee-pill--inactive]="item.assignee?.isActive === false"
                      >
                        {{ item.assignee === null ? 'Unassigned' : memberDisplayName(item.assignee) }}
                      </span>
                    </p>

                    <div class="work-card__hierarchy">
                      @if (item.parent; as parent) {
                        <a
                          class="hierarchy-pill"
                          [routerLink]="['/work-items', parent.id]"
                          [queryParams]="detailQueryParams()"
                        >
                          Child of {{ parent.displayKey }}
                        </a>
                      } @else if (item.childSummary; as childSummary) {
                        <span class="hierarchy-pill">{{ childSummaryLabel(childSummary) }}</span>
                      }
                    </div>

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
                        [disabled]="!canMoveItem(item) || transitioningWorkItemId() === item.id"
                        (change)="transitionCard(item, $event)"
                      >
                        @for (targetStatus of statuses; track targetStatus) {
                          <option [value]="targetStatus" [selected]="targetStatus === item.status">
                            {{ formatToken(targetStatus) }}
                          </option>
                        }
                      </select>
                    </label>

                    @if (isTerminalMoveReadOnly(item)) {
                      <p class="permission-note">Only owners and maintainers can reopen done or canceled work items.</p>
                    }
                  </article>
                }
              }
            </div>
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

    .permission-note {
      color: #64748b;
      font-size: 0.75rem;
      font-weight: 700;
      line-height: 1.4;
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

    .notice {
      display: grid;
      gap: 4px;
      margin-bottom: 18px;
      border: 1px solid #fed7aa;
      border-radius: 8px;
      padding: 14px;
      background: #fff7ed;
      color: #9a3412;
    }

    .notice p {
      margin: 0;
      color: #9a3412;
      font-size: 0.875rem;
      line-height: 1.5;
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
      min-height: 142px;
    }

    .work-card {
      display: grid;
      gap: 10px;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 12px;
      background: #ffffff;
    }

    .work-card.cdk-drag-disabled {
      cursor: default;
    }

    .cdk-drag-preview {
      box-sizing: border-box;
      border: 1px solid #bfdbfe;
      border-radius: 8px;
      box-shadow: 0 14px 28px rgb(15 23 42 / 18%);
      background: #ffffff;
    }

    .cdk-drag-placeholder {
      border: 1px dashed #93c5fd;
      background: #eff6ff;
      opacity: 0.72;
    }

    .cdk-drop-list-dragging .work-card:not(.cdk-drag-placeholder) {
      transition: transform 150ms ease;
    }

    .work-card__heading {
      display: grid;
      gap: 6px;
    }

    .work-card__controls {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }

    .work-key {
      width: fit-content;
      border: 1px solid #c7d2fe;
      border-radius: 999px;
      padding: 2px 7px;
      background: #eef2ff;
      color: #3730a3;
      font-size: 0.6875rem;
      font-weight: 900;
    }

    .milestone-pill {
      width: fit-content;
      border: 1px solid #bbf7d0;
      border-radius: 999px;
      padding: 2px 7px;
      background: #f0fdf4;
      color: #166534;
      font-size: 0.75rem;
      font-weight: 800;
    }

    .cycle-pill {
      width: fit-content;
      border: 1px solid #bfdbfe;
      border-radius: 999px;
      padding: 2px 7px;
      background: #eff6ff;
      color: #1d4ed8;
      font-size: 0.75rem;
      font-weight: 800;
    }

    .work-card a {
      color: #1d4ed8;
      font-size: 0.875rem;
      font-weight: 800;
      line-height: 1.35;
      overflow-wrap: anywhere;
      text-decoration: none;
    }

    .drag-handle {
      min-height: 26px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 3px 8px;
      background: #ffffff;
      color: #475569;
      font: inherit;
      font-size: 0.6875rem;
      font-weight: 900;
      cursor: grab;
    }

    .drag-handle:active {
      cursor: grabbing;
    }

    .drag-handle:disabled {
      cursor: not-allowed;
      opacity: 0.64;
    }

    .priority-pill,
    .type-pill,
    .assignee-pill,
    .labels span,
    .hierarchy-pill {
      width: fit-content;
      border: 1px solid #cbd5e1;
      border-radius: 999px;
      padding: 2px 7px;
      color: #475569;
      font-size: 0.6875rem;
      font-weight: 800;
      text-transform: capitalize;
    }

    .work-card .hierarchy-pill {
      min-height: 22px;
      border-color: #bae6fd;
      background: #f0f9ff;
      color: #0369a1;
      font-size: 0.6875rem;
      line-height: 1.35;
      text-decoration: none;
      text-transform: none;
    }

    .work-card__hierarchy {
      display: flex;
      align-items: flex-start;
      min-height: 22px;
    }

    .work-card a.hierarchy-pill:hover {
      border-color: #7dd3fc;
      text-decoration: underline;
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

    .assignee-pill--inactive {
      border-color: #e2e8f0;
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
  private readonly currentUser = inject(CurrentUserService);
  private readonly route = inject(ActivatedRoute);

  readonly statuses = statuses;
  readonly childSummaryLabel = workItemChildSummaryLabel;
  readonly projectId = computed(() => this.route.snapshot.paramMap.get('projectId') ?? '');
  readonly project = signal<ProjectDto | null>(null);
  readonly workItems = signal<WorkItemListItemDto[]>([]);
  readonly isLoading = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly transitionError = signal<string | null>(null);
  readonly transitioningWorkItemId = signal<string | null>(null);
  readonly isArchivedProject = computed(() => this.project()?.status === 'archived');
  readonly canReopenTerminalWorkItems = computed(() => {
    const actor = this.currentUser.selectedMember();
    return actor?.role === 'owner' || actor?.role === 'maintainer';
  });
  readonly dropListIds = computed(() => statuses.map((status) => this.dropListId(status)));

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
    this.loadProject();
    this.loadWorkItems();
  }

  loadProject(): void {
    this.api.getProject(this.projectId()).subscribe({
      next: (project) => {
        this.project.set(project);
      },
      error: () => {
        this.project.set(null);
      }
    });
  }

  loadWorkItems(): void {
    this.isLoading.set(true);
    this.loadError.set(null);

    this.api.listProjectBoardWorkItems(this.projectId()).subscribe({
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

    if (!this.canMoveItem(item)) {
      select.value = item.status;
      if (this.isTerminalMoveReadOnly(item)) {
        this.transitionError.set('Only owners and maintainers can reopen done or canceled work items.');
      }
      return;
    }

    if (status === item.status) {
      return;
    }

    this.moveItemOnBoard(item, {
      status,
      beforeWorkItemId: null,
      afterWorkItemId: null
    }, {
      onError: () => {
        select.value = item.status;
      }
    });
  }

  dropCard(event: CdkDragDrop<WorkItemStatus, WorkItemStatus, WorkItemListItemDto>): void {
    const item = event.item.data;
    const status = event.container.data;

    if (!this.canMoveItem(item)) {
      if (this.isTerminalMoveReadOnly(item)) {
        this.transitionError.set('Only owners and maintainers can reopen done or canceled work items.');
      }
      return;
    }

    if (event.previousContainer === event.container && event.previousIndex === event.currentIndex) {
      return;
    }

    const destinationItems = (this.itemsByStatus().get(status) ?? []).filter(
      (candidate) => candidate.id !== item.id
    );
    const destinationIndex = Math.max(0, Math.min(event.currentIndex, destinationItems.length));
    const beforeWorkItemId =
      destinationIndex === 0 ? null : destinationItems[destinationIndex - 1]?.id ?? null;
    const afterWorkItemId =
      destinationIndex >= destinationItems.length ? null : destinationItems[destinationIndex]?.id ?? null;

    this.moveItemOnBoard(
      item,
      {
        status,
        beforeWorkItemId,
        afterWorkItemId
      },
      { destinationIndex }
    );
  }

  dropListId(status: WorkItemStatus): string {
    return `board-column-${status}`;
  }

  formatToken(value: string): string {
    return value.replaceAll('_', ' ');
  }

  detailQueryParams(): { returnUrl: string } {
    return { returnUrl: `/projects/${this.projectId()}/board` };
  }

  memberDisplayName(member: WorkItemListItemDto['assignee']): string {
    if (member === null) {
      return 'Unassigned';
    }

    return member.isActive ? member.name : `${member.name} (inactive)`;
  }

  canMoveItem(item: WorkItemListItemDto): boolean {
    return !this.isArchivedProject() && !this.isTerminalMoveReadOnly(item);
  }

  isTerminalMoveReadOnly(item: WorkItemListItemDto): boolean {
    return terminalStatuses.has(item.status) && !this.canReopenTerminalWorkItems();
  }

  private moveItemOnBoard(
    item: WorkItemListItemDto,
    request: MoveWorkItemOnBoardRequest,
    options: { destinationIndex?: number; onError?: () => void } = {}
  ): void {
    const previousWorkItems = this.workItems();
    this.transitionError.set(null);
    this.transitioningWorkItemId.set(item.id);

    if (options.destinationIndex !== undefined) {
      this.workItems.set(
        this.moveWorkItemInMemory(previousWorkItems, item.id, request.status, options.destinationIndex)
      );
    } else if (request.status !== item.status) {
      this.workItems.set(this.moveWorkItemInMemory(previousWorkItems, item.id, request.status, 0));
    }

    this.api.moveWorkItemOnBoard(item.id, request).subscribe({
      next: () => {
        this.transitioningWorkItemId.set(null);
        this.loadWorkItems();
      },
      error: () => {
        options.onError?.();
        this.workItems.set(previousWorkItems);
        this.transitionError.set('The board move was rejected.');
        this.transitioningWorkItemId.set(null);
      }
    });
  }

  private moveWorkItemInMemory(
    workItems: WorkItemListItemDto[],
    workItemId: string,
    status: WorkItemStatus,
    destinationIndex: number
  ): WorkItemListItemDto[] {
    const movingItem = workItems.find((item) => item.id === workItemId);

    if (movingItem === undefined) {
      return workItems;
    }

    const columns = new Map<WorkItemStatus, WorkItemListItemDto[]>();

    for (const columnStatus of statuses) {
      columns.set(columnStatus, []);
    }

    for (const item of workItems) {
      if (item.id !== workItemId) {
        columns.get(item.status)?.push(item);
      }
    }

    const destinationItems = columns.get(status) ?? [];
    const insertionIndex = Math.max(0, Math.min(destinationIndex, destinationItems.length));
    destinationItems.splice(insertionIndex, 0, { ...movingItem, status });
    columns.set(status, destinationItems);

    return statuses.flatMap((columnStatus) => columns.get(columnStatus) ?? []);
  }
}
