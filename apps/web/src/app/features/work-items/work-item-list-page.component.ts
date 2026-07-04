import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import type {
  LabelDto,
  MemberDto,
  ProjectDto,
  WorkItemListItemDto,
  WorkItemPriority,
  WorkItemSort,
  WorkItemStatus,
  WorkItemType
} from '@worktrail/contracts';

import { CurrentUserService } from '../../core/current-user.service';
import { WorkItemListFilters, WorktrailApiService } from '../../core/worktrail-api.service';
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
const types: WorkItemType[] = ['task', 'bug', 'story', 'chore'];
const priorities: WorkItemPriority[] = ['low', 'medium', 'high', 'urgent'];
const sorts: Array<{ label: string; value: WorkItemSort }> = [
  { label: 'Updated newest', value: 'updated_desc' },
  { label: 'Updated oldest', value: 'updated_asc' },
  { label: 'Priority high to low', value: 'priority_desc' },
  { label: 'Priority low to high', value: 'priority_asc' }
];

@Component({
  selector: 'app-work-item-list-page',
  imports: [
    EmptyStateComponent,
    ErrorPanelComponent,
    LoadingIndicatorComponent,
    ReactiveFormsModule,
    RouterLink
  ],
  template: `
    <section class="page-header">
      <div>
        <p class="eyebrow">Work items</p>
        <h1>Project work items</h1>
        <p>Scan, filter, and open project work.</p>
      </div>

      <nav aria-label="Project work navigation">
        <a class="secondary-header-action" [routerLink]="['/projects', projectId(), 'board']">
          Board
        </a>
        <a class="secondary-header-action" [routerLink]="['/projects', projectId(), 'planning']">
          Planning
        </a>
        <a class="secondary-header-action" [routerLink]="['/projects', projectId(), 'settings']">
          Settings
        </a>
        @if (!isArchivedProject()) {
          <a class="primary-action" [routerLink]="['/projects', projectId(), 'work-items', 'new']">
            Create work item
          </a>
        }
      </nav>
    </section>

    @if (isArchivedProject()) {
      <section class="notice" aria-label="Archived project">
        <strong>Archived project</strong>
        <p>Project work is read-only until it is reactivated in settings.</p>
      </section>
    }

    <form class="filters" [formGroup]="filterForm" (ngSubmit)="applyFilters()">
      <label>
        <span>Search</span>
        <input type="search" formControlName="search" placeholder="Title search" />
      </label>

      <label>
        <span>Status</span>
        <select formControlName="status">
          <option value="">All statuses</option>
          @for (status of statuses; track status) {
            <option [value]="status">{{ formatToken(status) }}</option>
          }
        </select>
      </label>

      <label>
        <span>Assignee</span>
        <select formControlName="assigneeId">
          <option value="">Any assignee</option>
          @for (member of members(); track member.id) {
            <option [value]="member.id">{{ member.name }}</option>
          }
        </select>
      </label>

      <label>
        <span>Type</span>
        <select formControlName="type">
          <option value="">All types</option>
          @for (type of types; track type) {
            <option [value]="type">{{ formatToken(type) }}</option>
          }
        </select>
      </label>

      <label>
        <span>Label</span>
        <select formControlName="labelId">
          <option value="">All labels</option>
          @for (label of labels(); track label.id) {
            <option [value]="label.id">{{ label.name }}</option>
          }
        </select>
      </label>

      <label>
        <span>Priority</span>
        <select formControlName="priority">
          <option value="">All priorities</option>
          @for (priority of priorities; track priority) {
            <option [value]="priority">{{ formatToken(priority) }}</option>
          }
        </select>
      </label>

      <label>
        <span>Sort</span>
        <select formControlName="sort">
          @for (sort of sorts; track sort.value) {
            <option [value]="sort.value">{{ sort.label }}</option>
          }
        </select>
      </label>

      <div class="filter-actions">
        <button type="submit">Apply</button>
        <button type="button" class="secondary-action" (click)="clearFilters()">Clear</button>
      </div>
    </form>

    <section class="list-panel">
      <div class="list-heading">
        <h2>{{ workItems().length }} work items</h2>
      </div>

      @if (isLoading()) {
        <app-loading-indicator label="Loading work items" />
      } @else if (error()) {
        <app-error-panel [message]="error() ?? ''" (retry)="loadWorkItems()" />
      } @else if (workItems().length === 0) {
        <app-empty-state
          title="No work items found"
          message="Adjust the filters or create a work item for this project."
        />
      } @else {
        <div class="work-item-table" role="table" aria-label="Work items">
          <div class="work-item-table__head" role="row">
            <span>Title</span>
            <span>Status</span>
            <span>Assignee</span>
            <span>Priority</span>
            <span>Updated</span>
          </div>

          @for (item of workItems(); track item.id) {
            <a class="work-item-row" role="row" [routerLink]="['/work-items', item.id]">
              <span class="work-item-row__title">
                <strong>{{ item.title }}</strong>
                <small class="row-meta">
                  <span class="key-pill">{{ item.displayKey }}</span>
                  <span class="type-pill">{{ formatToken(item.type) }}</span>
                  @if (item.labels.length === 0) {
                    <span class="muted-pill">No labels</span>
                  } @else {
                    @for (label of item.labels; track label.id) {
                      <span class="label-pill" [style.border-color]="label.color ?? '#cbd5e1'">
                        {{ label.name }}
                      </span>
                    }
                  }
                </small>
              </span>
              <span class="status-pill" [attr.data-status]="item.status">{{ formatToken(item.status) }}</span>
              <span class="assignee-pill" [class.assignee-pill--empty]="item.assignee === null">
                {{ item.assignee?.name ?? 'Unassigned' }}
              </span>
              <span class="priority-pill" [attr.data-priority]="item.priority">
                {{ formatToken(item.priority) }}
              </span>
              <span>{{ formatDate(item.updatedAt) }}</span>
            </a>
          }
        </div>
      }
    </section>
  `,
  styles: `
    .page-header {
      display: flex;
      justify-content: space-between;
      gap: 20px;
      align-items: flex-start;
      margin-bottom: 20px;
    }

    nav {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 8px;
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

    p {
      margin-top: 8px;
      color: #64748b;
      font-size: 0.875rem;
      line-height: 1.5;
    }

    .primary-action,
    .secondary-header-action,
    button {
      min-height: 38px;
      border: 1px solid #1f4f99;
      border-radius: 6px;
      padding: 9px 14px;
      background: #1f4f99;
      color: #ffffff;
      font: inherit;
      font-size: 0.875rem;
      font-weight: 800;
      text-decoration: none;
      cursor: pointer;
    }

    .secondary-header-action {
      border-color: #cbd5e1;
      background: #ffffff;
      color: #1f2937;
    }

    .secondary-action {
      border-color: #cbd5e1;
      background: #ffffff;
      color: #1f2937;
    }

    .filters,
    .list-panel {
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      background: #ffffff;
    }

    .filters {
      display: grid;
      grid-template-columns: repeat(4, minmax(150px, 1fr));
      gap: 12px;
      margin-bottom: 18px;
      padding: 16px;
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

    label {
      display: grid;
      gap: 6px;
    }

    label span {
      color: #334155;
      font-size: 0.75rem;
      font-weight: 800;
    }

    input,
    select {
      width: 100%;
      min-height: 38px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 0 10px;
      background: #ffffff;
      color: #111827;
      font: inherit;
      font-size: 0.875rem;
    }

    input:focus,
    select:focus {
      border-color: #1d4ed8;
      outline: 2px solid #bfdbfe;
      outline-offset: 0;
    }

    .filter-actions {
      display: flex;
      gap: 8px;
      align-items: end;
    }

    .list-panel {
      display: grid;
      gap: 14px;
      padding: 16px;
    }

    .list-heading h2 {
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
      grid-template-columns: minmax(260px, 2fr) minmax(110px, 0.8fr) minmax(140px, 1fr) minmax(100px, 0.7fr) minmax(120px, 0.8fr);
      gap: 14px;
      min-width: 820px;
      align-items: center;
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

    .work-item-row__title {
      display: grid;
      gap: 4px;
    }

    .work-item-row strong {
      color: #111827;
      line-height: 1.35;
    }

    .work-item-row small {
      color: #64748b;
      font-size: 0.75rem;
      line-height: 1.35;
    }

    .row-meta,
    .key-pill,
    .label-pill,
    .status-pill,
    .priority-pill,
    .assignee-pill,
    .type-pill,
    .muted-pill {
      display: inline-flex;
      align-items: center;
      width: fit-content;
    }

    .row-meta {
      flex-wrap: wrap;
      gap: 5px;
    }

    .label-pill,
    .key-pill,
    .status-pill,
    .priority-pill,
    .assignee-pill,
    .type-pill,
    .muted-pill {
      min-height: 22px;
      border: 1px solid #cbd5e1;
      border-radius: 999px;
      padding: 2px 8px;
      font-size: 0.75rem;
      font-weight: 800;
      text-transform: capitalize;
    }

    .key-pill {
      background: #eef2ff;
      color: #3730a3;
      border-color: #c7d2fe;
      text-transform: uppercase;
    }

    .type-pill {
      background: #eef2ff;
      color: #3730a3;
      border-color: #c7d2fe;
    }

    .muted-pill,
    .assignee-pill--empty {
      background: #f8fafc;
      color: #64748b;
    }

    .status-pill[data-status='backlog'] {
      background: #f8fafc;
      color: #475569;
    }

    .status-pill[data-status='ready'] {
      background: #ecfeff;
      color: #155e75;
      border-color: #a5f3fc;
    }

    .status-pill[data-status='in_progress'] {
      background: #eff6ff;
      color: #1d4ed8;
      border-color: #bfdbfe;
    }

    .status-pill[data-status='blocked'] {
      background: #fff7ed;
      color: #c2410c;
      border-color: #fed7aa;
    }

    .status-pill[data-status='done'] {
      background: #ecfdf5;
      color: #047857;
      border-color: #a7f3d0;
    }

    .status-pill[data-status='canceled'] {
      background: #f1f5f9;
      color: #475569;
      border-color: #cbd5e1;
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

    @media (max-width: 900px) {
      .page-header {
        flex-direction: column;
      }

      .filters {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    @media (max-width: 560px) {
      .filters {
        grid-template-columns: 1fr;
      }

      .filter-actions {
        align-items: stretch;
      }
    }
  `
})
export class WorkItemListPageComponent implements OnInit {
  private readonly api = inject(WorktrailApiService);
  private readonly currentUser = inject(CurrentUserService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly statuses = statuses;
  readonly types = types;
  readonly priorities = priorities;
  readonly sorts = sorts;
  readonly projectId = computed(() => this.route.snapshot.paramMap.get('projectId') ?? '');
  readonly members = computed<MemberDto[]>(() => this.currentUser.members());

  readonly project = signal<ProjectDto | null>(null);
  readonly workItems = signal<WorkItemListItemDto[]>([]);
  readonly labels = signal<LabelDto[]>([]);
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);
  readonly isArchivedProject = computed(() => this.project()?.status === 'archived');

  readonly filterForm = this.formBuilder.nonNullable.group({
    search: [''],
    status: [''],
    assigneeId: [''],
    type: [''],
    labelId: [''],
    priority: [''],
    sort: ['updated_desc']
  });

  ngOnInit(): void {
    if (this.currentUser.members().length === 0) {
      this.currentUser.loadMembers();
    }

    this.loadProject();

    this.route.queryParamMap.subscribe((params) => {
      this.filterForm.patchValue(
        {
          search: params.get('search') ?? '',
          status: params.get('status') ?? '',
          assigneeId: params.get('assigneeId') ?? '',
          type: params.get('type') ?? '',
          labelId: params.get('labelId') ?? '',
          priority: params.get('priority') ?? '',
          sort: params.get('sort') ?? 'updated_desc'
        },
        { emitEvent: false }
      );
      this.loadWorkItems();
    });
  }

  applyFilters(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: this.queryParamsFromForm()
    });
  }

  clearFilters(): void {
    this.filterForm.reset({
      search: '',
      status: '',
      assigneeId: '',
      type: '',
      labelId: '',
      priority: '',
      sort: 'updated_desc'
    });
    this.applyFilters();
  }

  loadWorkItems(): void {
    this.isLoading.set(true);
    this.error.set(null);

    this.api.listWorkItems(this.projectId(), this.filtersFromForm()).subscribe({
      next: (workItems) => {
        this.workItems.set(workItems);
        this.mergeLabels(workItems);
        this.isLoading.set(false);
      },
      error: () => {
        this.error.set('Work items could not be loaded from the API.');
        this.isLoading.set(false);
      }
    });
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

  formatToken(value: string): string {
    return value.replaceAll('_', ' ');
  }

  formatDate(value: string): string {
    return new Intl.DateTimeFormat('en', {
      month: 'short',
      day: 'numeric'
    }).format(new Date(value));
  }

  private filtersFromForm(): WorkItemListFilters {
    const formValue = this.filterForm.getRawValue();

    return {
      search: this.optional(formValue.search),
      status: this.optional(formValue.status) as WorkItemStatus | undefined,
      assigneeId: this.optional(formValue.assigneeId),
      type: this.optional(formValue.type) as WorkItemType | undefined,
      labelId: this.optional(formValue.labelId),
      priority: this.optional(formValue.priority) as WorkItemPriority | undefined,
      sort: formValue.sort as WorkItemSort
    };
  }

  private queryParamsFromForm(): Record<string, string | null> {
    const filters = this.filtersFromForm();
    const sort = filters.sort ?? 'updated_desc';

    return {
      search: filters.search ?? null,
      status: filters.status ?? null,
      assigneeId: filters.assigneeId ?? null,
      type: filters.type ?? null,
      labelId: filters.labelId ?? null,
      priority: filters.priority ?? null,
      sort: sort === 'updated_desc' ? null : sort
    };
  }

  private optional(value: string): string | undefined {
    const trimmed = value.trim();
    return trimmed === '' ? undefined : trimmed;
  }

  private mergeLabels(workItems: WorkItemListItemDto[]): void {
    const labelsById = new Map(this.labels().map((label) => [label.id, label]));

    for (const item of workItems) {
      for (const label of item.labels) {
        labelsById.set(label.id, label);
      }
    }

    this.labels.set([...labelsById.values()].sort((left, right) => left.name.localeCompare(right.name)));
  }
}
