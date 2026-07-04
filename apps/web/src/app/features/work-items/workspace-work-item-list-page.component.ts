import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import type {
  ArchivedProjectMode,
  AssigneeState,
  DueDateState,
  LabelDto,
  MemberDto,
  MilestoneDto,
  ProjectNavigationSummaryDto,
  WorkItemPriority,
  WorkItemQuery,
  WorkItemSort,
  WorkItemState,
  WorkItemStatus,
  WorkItemType,
  WorkspaceWorkItemListItemDto
} from '@worktrail/contracts';
import { Subscription, debounceTime, distinctUntilChanged } from 'rxjs';

import { CurrentUserService } from '../../core/current-user.service';
import { WorktrailApiService } from '../../core/worktrail-api.service';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { ErrorPanelComponent } from '../../shared/ui/error-panel.component';
import { LoadingIndicatorComponent } from '../../shared/ui/loading-indicator.component';
import {
  filterPillLabel,
  projectBadge,
  projectTitle,
  workItemMetadata,
  workItemPriorityLabel,
  workItemStatusLabel
} from '../../shared/work-items/work-item-display';

const unassignedAssigneeValue = '__unassigned';
const statuses: WorkItemStatus[] = [
  'backlog',
  'ready',
  'in_progress',
  'blocked',
  'done',
  'canceled'
];
const workStates: Array<{ label: string; value: WorkItemState }> = [
  { label: 'Open', value: 'open' },
  { label: 'Terminal', value: 'terminal' }
];
const types: WorkItemType[] = ['task', 'bug', 'story', 'chore'];
const priorities: WorkItemPriority[] = ['low', 'medium', 'high', 'urgent'];
const dueDateStates: Array<{ label: string; value: DueDateState }> = [
  { label: 'Overdue', value: 'overdue' },
  { label: 'Due soon', value: 'due_soon' },
  { label: 'No due date', value: 'none' }
];
const blockedOptions: Array<{ label: string; value: string }> = [
  { label: 'Blocked only', value: 'true' },
  { label: 'Not blocked', value: 'false' }
];
const archivedProjectModes: Array<{ label: string; value: ArchivedProjectMode }> = [
  { label: 'Active projects', value: 'exclude' },
  { label: 'Active and archived', value: 'include' },
  { label: 'Archived only', value: 'only' }
];
const sorts: Array<{ label: string; value: WorkItemSort }> = [
  { label: 'Updated newest', value: 'updated_desc' },
  { label: 'Updated oldest', value: 'updated_asc' },
  { label: 'Priority high to low', value: 'priority_desc' },
  { label: 'Priority low to high', value: 'priority_asc' },
  { label: 'Due date', value: 'due_date_asc' },
  { label: 'Created newest', value: 'created_desc' },
  { label: 'Board order', value: 'board_order' }
];

interface WorkspaceFilterFormValue {
  search: string;
  projectId: string;
  status: string;
  workState: string;
  assigneeId: string;
  reporterId: string;
  type: string;
  labelId: string;
  milestoneId: string;
  priority: string;
  dueDateState: string;
  blocked: string;
  archivedProjects: string;
  sort: string;
}

const defaultFilterValues: WorkspaceFilterFormValue = {
  search: '',
  projectId: '',
  status: '',
  workState: '',
  assigneeId: '',
  reporterId: '',
  type: '',
  labelId: '',
  milestoneId: '',
  priority: '',
  dueDateState: '',
  blocked: '',
  archivedProjects: 'exclude',
  sort: 'updated_desc'
};

@Component({
  selector: 'app-workspace-work-item-list-page',
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
        <p class="eyebrow">Workspace</p>
        <h1>Work items</h1>
        <p>Find work across projects, owners, priorities, and due dates.</p>
      </div>

      <a class="primary-action" routerLink="/work-items/new">Create work item</a>
    </section>

    <form class="filters" [formGroup]="filterForm" (ngSubmit)="applyFilters()">
      <label class="filters__search">
        <span>Search</span>
        <input type="search" formControlName="search" placeholder="Key, title, or description" />
      </label>

      <label>
        <span>Project</span>
        <select formControlName="projectId">
          <option value="">All projects</option>
          @for (summary of projectSummaries(); track summary.project.id) {
            <option [value]="summary.project.id">
              {{ projectTitle(summary.project) }}
            </option>
          }
        </select>
      </label>

      <label>
        <span>Status</span>
        <select formControlName="status">
          <option value="">All statuses</option>
          @for (status of statuses; track status) {
            <option [value]="status">{{ workItemStatusLabel(status) }}</option>
          }
        </select>
      </label>

      <label>
        <span>State</span>
        <select formControlName="workState">
          <option value="">Any state</option>
          @for (state of workStates; track state.value) {
            <option [value]="state.value">{{ state.label }}</option>
          }
        </select>
      </label>

      <label>
        <span>Assignee</span>
        <select formControlName="assigneeId">
          <option value="">Any assignee</option>
          <option [value]="unassignedAssigneeValue">Unassigned</option>
          @for (member of assigneeFilterMembers(); track member.id) {
            <option [value]="member.id">{{ memberDisplayName(member) }}</option>
          }
        </select>
      </label>

      <label>
        <span>Reporter</span>
        <select formControlName="reporterId">
          <option value="">Any reporter</option>
          @for (member of reporterFilterMembers(); track member.id) {
            <option [value]="member.id">{{ memberDisplayName(member) }}</option>
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
        <span>Milestone</span>
        <select formControlName="milestoneId">
          <option value="">All milestones</option>
          @for (milestone of milestones(); track milestone.id) {
            <option [value]="milestone.id">{{ milestone.name }}</option>
          }
        </select>
      </label>

      <label>
        <span>Priority</span>
        <select formControlName="priority">
          <option value="">All priorities</option>
          @for (priority of priorities; track priority) {
            <option [value]="priority">{{ workItemPriorityLabel(priority) }}</option>
          }
        </select>
      </label>

      <label>
        <span>Due date</span>
        <select formControlName="dueDateState">
          <option value="">Any due date</option>
          @for (state of dueDateStates; track state.value) {
            <option [value]="state.value">{{ state.label }}</option>
          }
        </select>
      </label>

      <label>
        <span>Blocked</span>
        <select formControlName="blocked">
          <option value="">Any blocker state</option>
          @for (option of blockedOptions; track option.value) {
            <option [value]="option.value">{{ option.label }}</option>
          }
        </select>
      </label>

      <label>
        <span>Projects</span>
        <select formControlName="archivedProjects">
          @for (mode of archivedProjectModes; track mode.value) {
            <option [value]="mode.value">{{ mode.label }}</option>
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
        <button type="button" class="secondary-action" (click)="resetFilters()">Reset</button>
      </div>
    </form>

    @if (activeFilterLabels().length > 0) {
      <section class="active-filters" aria-label="Active filters">
        @for (label of activeFilterLabels(); track label) {
          <span>{{ label }}</span>
        }
      </section>
    }

    <section class="list-panel">
      <div class="list-heading">
        <h2>{{ workItems().length }} work items</h2>
      </div>

      @if (isLoading()) {
        <app-loading-indicator label="Loading workspace work items" />
      } @else if (error()) {
        <app-error-panel [message]="error() ?? ''" (retry)="loadWorkItems()" />
      } @else if (workItems().length === 0) {
        <app-empty-state
          [title]="activeFilterLabels().length > 0 ? 'No work items match these filters' : 'No work items found'"
          [message]="activeFilterLabels().length > 0 ? 'Reset filters or adjust the criteria to broaden the list.' : 'Workspace work from active projects will appear here.'"
        />
      } @else {
        <div class="work-item-table" role="table" aria-label="Workspace work items">
          <div class="work-item-table__head" role="row">
            <span>Title</span>
            <span>Project</span>
            <span>Status</span>
            <span>Assignee</span>
            <span>Planning</span>
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
                  <span>{{ workItemMetadata(item) }}</span>
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

              <span class="project-cell">
                <span
                  class="project-pill"
                  [class.project-pill--archived]="item.project.status === 'archived'"
                >
                  {{ projectBadge(item.project) }}
                </span>
                <small>{{ item.project.name }}</small>
              </span>

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
                <span [class.muted-pill]="item.milestone === null" [class.milestone-pill]="item.milestone !== null">
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

    p {
      margin-top: 8px;
      color: #64748b;
      font-size: 0.875rem;
      line-height: 1.5;
    }

    .primary-action,
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
      grid-template-columns: repeat(5, minmax(150px, 1fr));
      gap: 12px;
      margin-bottom: 18px;
      padding: 16px;
    }

    .filters__search {
      grid-column: span 2;
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

    select:disabled {
      background: #f8fafc;
      color: #94a3b8;
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

    .active-filters {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-bottom: 14px;
    }

    .active-filters span {
      min-height: 24px;
      border: 1px solid #bfdbfe;
      border-radius: 999px;
      padding: 3px 8px;
      background: #eff6ff;
      color: #1d4ed8;
      font-size: 0.75rem;
      font-weight: 800;
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
      grid-template-columns: minmax(280px, 2fr) minmax(170px, 1fr) minmax(120px, 0.7fr) minmax(150px, 0.9fr) minmax(150px, 1fr) minmax(110px, 0.7fr) minmax(110px, 0.7fr);
      gap: 14px;
      min-width: 1160px;
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
    .milestone-pill,
    .key-pill,
    .project-pill,
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

    @media (max-width: 1120px) {
      .filters {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
    }

    @media (max-width: 760px) {
      .page-header {
        flex-direction: column;
      }

      .filters {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .filters__search {
        grid-column: span 2;
      }
    }

    @media (max-width: 560px) {
      .filters {
        grid-template-columns: 1fr;
      }

      .filters__search {
        grid-column: auto;
      }

      .filter-actions {
        align-items: stretch;
      }
    }
  `
})
export class WorkspaceWorkItemListPageComponent implements OnDestroy, OnInit {
  private readonly api = inject(WorktrailApiService);
  private readonly currentUser = inject(CurrentUserService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly subscriptions = new Subscription();
  private loadedProjectFilterId: string | null = null;

  readonly statuses = statuses;
  readonly workStates = workStates;
  readonly types = types;
  readonly priorities = priorities;
  readonly dueDateStates = dueDateStates;
  readonly blockedOptions = blockedOptions;
  readonly archivedProjectModes = archivedProjectModes;
  readonly sorts = sorts;
  readonly unassignedAssigneeValue = unassignedAssigneeValue;
  readonly members = computed<MemberDto[]>(() => this.currentUser.members());
  readonly activeMembers = computed<MemberDto[]>(() => this.currentUser.activeMembers());
  readonly assigneeFilterMembers = computed<MemberDto[]>(() =>
    this.membersForFilter(this.appliedFilterValues().assigneeId)
  );
  readonly reporterFilterMembers = computed<MemberDto[]>(() =>
    this.membersForFilter(this.appliedFilterValues().reporterId)
  );

  readonly projectSummaries = signal<ProjectNavigationSummaryDto[]>([]);
  readonly labels = signal<LabelDto[]>([]);
  readonly milestones = signal<MilestoneDto[]>([]);
  readonly workItems = signal<WorkspaceWorkItemListItemDto[]>([]);
  readonly appliedFilterValues = signal<WorkspaceFilterFormValue>({ ...defaultFilterValues });
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);

  readonly filterForm = this.formBuilder.nonNullable.group({
    search: [''],
    projectId: [''],
    status: [''],
    workState: [''],
    assigneeId: [''],
    reporterId: [''],
    type: [''],
    labelId: [''],
    milestoneId: [''],
    priority: [''],
    dueDateState: [''],
    blocked: [''],
    archivedProjects: ['exclude'],
    sort: ['updated_desc']
  });

  ngOnInit(): void {
    if (this.currentUser.members().length === 0) {
      this.currentUser.loadMembers();
    }

    this.loadProjectSummaries();
    this.watchFilterChanges();

    this.subscriptions.add(
      this.route.queryParamMap.subscribe((params) => {
        const nextFilters = this.filtersFromQueryParams(params);
        this.appliedFilterValues.set(nextFilters);
        this.filterForm.patchValue(nextFilters, { emitEvent: false });
        this.loadProjectScopedFilters(nextFilters.projectId);
        this.loadWorkItems();
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  applyFilters(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: this.queryParamsFromForm()
    });
  }

  resetFilters(): void {
    this.filterForm.reset({ ...defaultFilterValues }, { emitEvent: false });
    this.applyFilters();
  }

  loadWorkItems(): void {
    this.isLoading.set(true);
    this.error.set(null);

    this.api.listWorkspaceWorkItems(this.queryFromForm()).subscribe({
      next: (workItems) => {
        this.workItems.set(workItems);
        this.mergeResultLabels(workItems);
        this.isLoading.set(false);
      },
      error: () => {
        this.error.set('Workspace work items could not be loaded from the API.');
        this.isLoading.set(false);
      }
    });
  }

  loadProjectSummaries(): void {
    this.api.listProjectNavigationSummaries().subscribe({
      next: (summaries) => {
        this.projectSummaries.set(summaries);
      },
      error: () => {
        this.projectSummaries.set([]);
      }
    });
  }

  activeFilterLabels(): string[] {
    return this.getActiveFilterLabels();
  }

  projectBadge(project: WorkspaceWorkItemListItemDto['project']): string {
    return projectBadge(project);
  }

  projectTitle(project: ProjectNavigationSummaryDto['project']): string {
    return projectTitle(project);
  }

  workItemMetadata(item: WorkspaceWorkItemListItemDto): string {
    return workItemMetadata(item);
  }

  workItemStatusLabel = workItemStatusLabel;
  workItemPriorityLabel = workItemPriorityLabel;

  formatToken(value: string): string {
    return value.replaceAll('_', ' ');
  }

  memberDisplayName(member: MemberDto): string {
    return member.isActive ? member.name : `${member.name} (inactive)`;
  }

  dueDateLabel(item: WorkspaceWorkItemListItemDto): string {
    return item.dueDate === null ? 'No due date' : `Due ${this.formatDateOnly(item.dueDate)}`;
  }

  formatDate(value: string): string {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric'
    }).format(new Date(value));
  }

  private queryFromForm(): WorkItemQuery {
    return this.toQuery(this.filterForm.getRawValue());
  }

  private toQuery(formValue: WorkspaceFilterFormValue): WorkItemQuery {
    const assigneeId = this.optional(formValue.assigneeId);
    const blocked = this.optional(formValue.blocked);
    const archivedProjects = this.optional(formValue.archivedProjects);
    const sort = this.optional(formValue.sort);

    return {
      search: this.optional(formValue.search),
      projectId: this.optional(formValue.projectId),
      status: this.optional(formValue.status) as WorkItemStatus | undefined,
      workState: this.optional(formValue.workState) as WorkItemState | undefined,
      assigneeId: assigneeId === unassignedAssigneeValue ? undefined : assigneeId,
      assigneeState:
        assigneeId === unassignedAssigneeValue ? ('unassigned' satisfies AssigneeState) : undefined,
      reporterId: this.optional(formValue.reporterId),
      type: this.optional(formValue.type) as WorkItemType | undefined,
      labelId: this.optional(formValue.labelId),
      milestoneId: this.optional(formValue.milestoneId),
      priority: this.optional(formValue.priority) as WorkItemPriority | undefined,
      dueDateState: this.optional(formValue.dueDateState) as DueDateState | undefined,
      blocked: blocked === undefined ? undefined : blocked === 'true',
      archivedProjects:
        archivedProjects === undefined || archivedProjects === 'exclude'
          ? undefined
          : (archivedProjects as ArchivedProjectMode),
      sort: sort === undefined || sort === 'updated_desc' ? undefined : (sort as WorkItemSort)
    };
  }

  private queryParamsFromForm(): Record<string, string | null> {
    const formValue = this.filterForm.getRawValue();
    const assigneeId = this.optional(formValue.assigneeId);
    const sort = this.optional(formValue.sort) ?? 'updated_desc';
    const archivedProjects = this.optional(formValue.archivedProjects) ?? 'exclude';

    return {
      search: this.optional(formValue.search) ?? null,
      projectId: this.optional(formValue.projectId) ?? null,
      status: this.optional(formValue.status) ?? null,
      workState: this.optional(formValue.workState) ?? null,
      assigneeId: assigneeId === unassignedAssigneeValue ? null : assigneeId ?? null,
      assigneeState: assigneeId === unassignedAssigneeValue ? 'unassigned' : null,
      reporterId: this.optional(formValue.reporterId) ?? null,
      type: this.optional(formValue.type) ?? null,
      labelId: this.optional(formValue.labelId) ?? null,
      milestoneId: this.optional(formValue.milestoneId) ?? null,
      priority: this.optional(formValue.priority) ?? null,
      dueDateState: this.optional(formValue.dueDateState) ?? null,
      blocked: this.optional(formValue.blocked) ?? null,
      archivedProjects: archivedProjects === 'exclude' ? null : archivedProjects,
      sort: sort === 'updated_desc' ? null : sort
    };
  }

  private filtersFromQueryParams(params: {
    get(name: string): string | null;
  }): WorkspaceFilterFormValue {
    const status = params.get('status') ?? '';
    const assigneeId = params.get('assigneeId') ?? '';
    const assigneeState = params.get('assigneeState') ?? '';

    return {
      search: params.get('search') ?? '',
      projectId: params.get('projectId') ?? '',
      status,
      workState: status === '' ? params.get('workState') ?? '' : '',
      assigneeId: assigneeId !== '' ? assigneeId : assigneeState === 'unassigned' ? unassignedAssigneeValue : '',
      reporterId: params.get('reporterId') ?? '',
      type: params.get('type') ?? '',
      labelId: params.get('labelId') ?? '',
      milestoneId: params.get('milestoneId') ?? '',
      priority: params.get('priority') ?? '',
      dueDateState: params.get('dueDateState') ?? '',
      blocked: params.get('blocked') ?? '',
      archivedProjects: params.get('archivedProjects') ?? 'exclude',
      sort: params.get('sort') ?? 'updated_desc'
    };
  }

  private watchFilterChanges(): void {
    this.subscriptions.add(
      this.filterForm.controls.search.valueChanges
        .pipe(debounceTime(400), distinctUntilChanged())
        .subscribe(() => this.applyFilters())
    );

    this.subscriptions.add(
      this.filterForm.controls.projectId.valueChanges.pipe(distinctUntilChanged()).subscribe(() => {
        this.filterForm.patchValue({ labelId: '', milestoneId: '' }, { emitEvent: false });
        this.applyFilters();
      })
    );

    this.subscriptions.add(
      this.filterForm.controls.status.valueChanges.pipe(distinctUntilChanged()).subscribe((status) => {
        if (status !== '') {
          this.filterForm.patchValue({ workState: '' }, { emitEvent: false });
        }
        this.applyFilters();
      })
    );

    this.subscriptions.add(
      this.filterForm.controls.workState.valueChanges
        .pipe(distinctUntilChanged())
        .subscribe((workState) => {
          if (workState !== '') {
            this.filterForm.patchValue({ status: '' }, { emitEvent: false });
          }
          this.applyFilters();
        })
    );

    const controls = [
      this.filterForm.controls.assigneeId,
      this.filterForm.controls.reporterId,
      this.filterForm.controls.type,
      this.filterForm.controls.labelId,
      this.filterForm.controls.milestoneId,
      this.filterForm.controls.priority,
      this.filterForm.controls.dueDateState,
      this.filterForm.controls.blocked,
      this.filterForm.controls.archivedProjects,
      this.filterForm.controls.sort
    ];

    for (const control of controls) {
      this.subscriptions.add(
        control.valueChanges.pipe(distinctUntilChanged()).subscribe(() => this.applyFilters())
      );
    }
  }

  private loadProjectScopedFilters(projectId: string): void {
    if (projectId === '') {
      this.loadedProjectFilterId = null;
      this.labels.set([]);
      this.milestones.set([]);
      return;
    }

    if (projectId === this.loadedProjectFilterId) {
      return;
    }

    this.loadedProjectFilterId = projectId;

    this.api.listProjectLabels(projectId, { includeArchived: true }).subscribe({
      next: (labels) => {
        this.labels.set(this.sortLabels(labels));
      },
      error: () => {
        this.labels.set([]);
      }
    });

    this.api.listProjectMilestones(projectId, { includeArchived: true }).subscribe({
      next: (milestones) => {
        this.milestones.set(this.sortMilestones(milestones));
      },
      error: () => {
        this.milestones.set([]);
      }
    });
  }

  private getActiveFilterLabels(): string[] {
    const filters = this.appliedFilterValues();
    const labels: string[] = [];

    this.pushFilterLabel(labels, 'Search', filters.search);
    this.pushFilterLabel(labels, 'Project', this.projectName(filters.projectId));
    this.pushFilterLabel(labels, 'Status', filters.status === '' ? '' : workItemStatusLabel(filters.status as WorkItemStatus));
    this.pushFilterLabel(labels, 'State', this.optionLabel(workStates, filters.workState));
    this.pushFilterLabel(labels, 'Assignee', this.assigneeLabel(filters.assigneeId));
    this.pushFilterLabel(labels, 'Reporter', this.memberName(filters.reporterId));
    this.pushFilterLabel(labels, 'Type', this.formatToken(filters.type));
    this.pushFilterLabel(labels, 'Label', this.labelName(filters.labelId));
    this.pushFilterLabel(labels, 'Milestone', this.milestoneName(filters.milestoneId));
    this.pushFilterLabel(labels, 'Priority', filters.priority === '' ? '' : workItemPriorityLabel(filters.priority as WorkItemPriority));
    this.pushFilterLabel(labels, 'Due date', this.optionLabel(dueDateStates, filters.dueDateState));
    this.pushFilterLabel(labels, 'Blocked', this.optionLabel(blockedOptions, filters.blocked));
    this.pushFilterLabel(
      labels,
      'Projects',
      filters.archivedProjects === 'exclude'
        ? ''
        : this.optionLabel(archivedProjectModes, filters.archivedProjects)
    );
    this.pushFilterLabel(labels, 'Sort', filters.sort === 'updated_desc' ? '' : this.optionLabel(sorts, filters.sort));

    return labels;
  }

  private pushFilterLabel(labels: string[], label: string, value: string): void {
    if (value.trim() !== '') {
      labels.push(filterPillLabel(label, value));
    }
  }

  private projectName(projectId: string): string {
    if (projectId === '') {
      return '';
    }

    const summary = this.projectSummaries().find((item) => item.project.id === projectId);
    return summary === undefined ? projectId : projectTitle(summary.project);
  }

  private assigneeLabel(value: string): string {
    if (value === unassignedAssigneeValue) {
      return 'Unassigned';
    }

    return this.memberName(value);
  }

  private memberName(memberId: string): string {
    if (memberId === '') {
      return '';
    }

    const member = this.members().find((item) => item.id === memberId);
    return member === undefined ? memberId : this.memberDisplayName(member);
  }

  private labelName(labelId: string): string {
    if (labelId === '') {
      return '';
    }

    return this.labels().find((label) => label.id === labelId)?.name ?? labelId;
  }

  private milestoneName(milestoneId: string): string {
    if (milestoneId === '') {
      return '';
    }

    return this.milestones().find((milestone) => milestone.id === milestoneId)?.name ?? milestoneId;
  }

  private optionLabel<T extends string>(
    options: Array<{ label: string; value: T | string }>,
    value: string
  ): string {
    if (value === '') {
      return '';
    }

    return options.find((option) => option.value === value)?.label ?? value;
  }

  private membersForFilter(selectedValue: string): MemberDto[] {
    const activeMembers = this.activeMembers();
    const selectedMember = this.members().find((member) => member.id === selectedValue);

    if (selectedMember === undefined || selectedMember.isActive) {
      return activeMembers;
    }

    return [...activeMembers, selectedMember].sort((left, right) => left.name.localeCompare(right.name));
  }

  private mergeResultLabels(workItems: WorkspaceWorkItemListItemDto[]): void {
    const labelsById = new Map(this.labels().map((label) => [label.id, label]));

    for (const item of workItems) {
      for (const label of item.labels) {
        labelsById.set(label.id, label);
      }
    }

    this.labels.set(this.sortLabels([...labelsById.values()]));
  }

  private sortLabels(labels: LabelDto[]): LabelDto[] {
    return [...labels].sort((left, right) => left.name.localeCompare(right.name));
  }

  private sortMilestones(milestones: MilestoneDto[]): MilestoneDto[] {
    return [...milestones].sort((left, right) => {
      if (left.isArchived !== right.isArchived) {
        return left.isArchived ? 1 : -1;
      }

      return left.name.localeCompare(right.name);
    });
  }

  private optional(value: string): string | undefined {
    const trimmed = value.trim();
    return trimmed === '' ? undefined : trimmed;
  }

  private formatDateOnly(value: string): string {
    const [year, month, day] = value.split('-').map(Number);

    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric'
    }).format(new Date(year, month - 1, day));
  }
}
