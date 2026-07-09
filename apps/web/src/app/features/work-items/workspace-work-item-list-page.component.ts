import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import type {
  ArchivedProjectMode,
  DependencyFilter,
  DueDateState,
  LabelDto,
  MemberDto,
  MilestoneDto,
  ProjectNavigationSummaryDto,
  SavedWorkViewDto,
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
import { ClipboardService } from '../../shared/clipboard.service';
import { downloadBlob, fileNameFromContentDisposition } from '../../shared/download-file';
import {
  dependencyFilterLabel,
  filterPillLabel,
  projectBadge,
  projectTitle,
  workItemMetadata,
  workItemPriorityLabel,
  workItemStatusLabel
} from '../../shared/work-items/work-item-display';
import { ActiveFilterChipsComponent } from './components/active-filter-chips.component';
import { PinnedSavedViewsComponent } from './components/pinned-saved-views.component';
import { SavedViewsToolbarComponent } from './components/saved-views-toolbar.component';
import { WorkItemFilterPanelComponent } from './components/work-item-filter-panel.component';
import { WorkItemResultListComponent } from './components/work-item-result-list.component';
import { unassignedAssigneeValue } from './query/work-item-filter-options';
import { WorkListQueryStore } from './state/work-list-query.store';
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
const dependencyOptions: Array<{ label: string; value: DependencyFilter }> = [
  { label: dependencyFilterLabel('dependency_blocked'), value: 'dependency_blocked' },
  { label: dependencyFilterLabel('blocking_open_work'), value: 'blocking_open_work' }
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
  dependency: string;
  workRisk: string;
  archivedProjects: string;
  sort: string;
}

@Component({
  selector: 'app-workspace-work-item-list-page',
  imports: [
    ActiveFilterChipsComponent,
    PinnedSavedViewsComponent,
    ReactiveFormsModule,
    RouterLink,
    SavedViewsToolbarComponent,
    WorkItemFilterPanelComponent,
    WorkItemResultListComponent
  ],
  template: `
    <section class="page-header">
      <div>
        <p class="eyebrow">Workspace</p>
        <h1>Work items</h1>
        <p>Find work across projects, owners, priorities, and due dates.</p>
      </div>

      <div class="header-actions">
        <button type="button" class="secondary-action" [disabled]="isCopyingViewLink()" (click)="copyViewLink()">
          {{ isCopyingViewLink() ? 'Copying...' : 'Copy link' }}
        </button>
        <button
          type="button"
          class="secondary-action"
          title="Export the applied workspace filters as CSV"
          aria-label="Export applied workspace filters as CSV"
          [disabled]="isExporting()"
          (click)="exportCsv()"
        >
          {{ isExporting() ? 'Exporting...' : 'Export CSV' }}
        </button>
        <a class="primary-action" routerLink="/work-items/new">Create work item</a>
        @if (copyLinkStatus()) {
          <span class="copy-link-status" aria-live="polite">{{ copyLinkStatus() }}</span>
        }
      </div>
    </section>

    @if (exportError()) {
      <p class="inline-error export-error">{{ exportError() }}</p>
    }

    <app-pinned-saved-views
      [sharedViews]="pinnedWorkspaceSavedViews()"
      [personalViews]="pinnedPersonalSavedViews()"
      (open)="openSavedView($event)"
    />

    <app-saved-views-toolbar
      [personalViews]="personalSavedViews()"
      [sharedViews]="workspaceSavedViews()"
      [canManageSharedViews]="canManageWorkspaceSavedViews()"
      [draftNames]="savedViewDraftNames()"
      [isLoading]="isSavedViewLoading()"
      [isSaving]="isSavingView()"
      [loadError]="savedViewLoadError()"
      [mutationError]="savedViewMutationError()"
      querySummaryScope="workspace"
      emptyMessage="Save the current filters to reuse this workspace view."
      sharedHelper="Owners and maintainers manage shared saved views."
      (savePersonal)="saveCurrentViewName($event)"
      (saveWorkspace)="saveWorkspaceViewName($event)"
      (open)="openSavedView($event)"
      (rename)="renameSavedView($event)"
      (updateQuery)="updateSavedViewQuery($event)"
      (pinChange)="setSavedViewPinned($event.savedView, $event.isPinned)"
      (delete)="deleteSavedView($event)"
      (draftNameChange)="setSavedViewDraftName($event.savedViewId, $event.name)"
    />

    <app-work-item-filter-panel [formGroup]="filterForm" (apply)="applyFilters()">
      <label filterCore class="filters__search">
        <span>Search</span>
        <input type="search" formControlName="search" placeholder="Key, title, or description" />
      </label>

      <label filterCore>
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

      <label filterCore>
        <span>Status</span>
        <select formControlName="status">
          <option value="">All statuses</option>
          @for (status of statuses; track status) {
            <option [value]="status">{{ workItemStatusLabel(status) }}</option>
          }
        </select>
      </label>

      <label filterCore>
        <span>State</span>
        <select formControlName="workState">
          <option value="">Any state</option>
          @for (state of workStates; track state.value) {
            <option [value]="state.value">{{ state.label }}</option>
          }
        </select>
      </label>

      <label filterAdvanced>
        <span>Assignee</span>
        <select formControlName="assigneeId">
          <option value="">Any assignee</option>
          <option [value]="unassignedAssigneeValue">Unassigned</option>
          @for (member of assigneeFilterMembers(); track member.id) {
            <option [value]="member.id">{{ memberDisplayName(member) }}</option>
          }
        </select>
      </label>

      <label filterAdvanced>
        <span>Reporter</span>
        <select formControlName="reporterId">
          <option value="">Any reporter</option>
          @for (member of reporterFilterMembers(); track member.id) {
            <option [value]="member.id">{{ memberDisplayName(member) }}</option>
          }
        </select>
      </label>

      <label filterAdvanced>
        <span>Type</span>
        <select formControlName="type">
          <option value="">All types</option>
          @for (type of types; track type) {
            <option [value]="type">{{ formatToken(type) }}</option>
          }
        </select>
      </label>

      <label filterAdvanced>
        <span>Label</span>
        <select formControlName="labelId">
          <option value="">All labels</option>
          @for (label of labels(); track label.id) {
            <option [value]="label.id">{{ label.name }}</option>
          }
        </select>
      </label>

      <label filterAdvanced>
        <span>Milestone</span>
        <select formControlName="milestoneId">
          <option value="">All milestones</option>
          @for (milestone of milestones(); track milestone.id) {
            <option [value]="milestone.id">{{ milestone.name }}</option>
          }
        </select>
      </label>

      <label filterAdvanced>
        <span>Priority</span>
        <select formControlName="priority">
          <option value="">All priorities</option>
          @for (priority of priorities; track priority) {
            <option [value]="priority">{{ workItemPriorityLabel(priority) }}</option>
          }
        </select>
      </label>

      <label filterAdvanced>
        <span>Due date</span>
        <select formControlName="dueDateState">
          <option value="">Any due date</option>
          @for (state of dueDateStates; track state.value) {
            <option [value]="state.value">{{ state.label }}</option>
          }
        </select>
      </label>

      <label filterAdvanced>
        <span>Blocked</span>
        <select formControlName="blocked">
          <option value="">Any blocker state</option>
          @for (option of blockedOptions; track option.value) {
            <option [value]="option.value">{{ option.label }}</option>
          }
        </select>
      </label>

      <label filterAdvanced>
        <span>Dependency</span>
        <select formControlName="dependency">
          <option value="">Any dependency state</option>
          @for (option of dependencyOptions; track option.value) {
            <option [value]="option.value">{{ option.label }}</option>
          }
        </select>
      </label>

      <label filterAdvanced>
        <span>Projects</span>
        <select formControlName="archivedProjects">
          @for (mode of archivedProjectModes; track mode.value) {
            <option [value]="mode.value">{{ mode.label }}</option>
          }
        </select>
      </label>

      <label filterAdvanced>
        <span>Sort</span>
        <select formControlName="sort">
          @for (sort of sorts; track sort.value) {
            <option [value]="sort.value">{{ sort.label }}</option>
          }
        </select>
      </label>

      <div filterActions class="filter-actions">
        <button type="button" class="secondary-action" (click)="resetFilters()">Reset</button>
      </div>
    </app-work-item-filter-panel>

    <app-active-filter-chips [labels]="activeFilterLabels()" (remove)="removeActiveFilter($event)" />

    <app-work-item-result-list
      [items]="workItems()"
      mode="workspace"
      [isLoading]="isLoading()"
      [error]="error()"
      loadingLabel="Loading workspace work items"
      ariaLabel="Workspace work items"
      [emptyTitle]="activeFilterLabels().length > 0 ? 'No work items match these filters' : 'No work items found'"
      [emptyMessage]="activeFilterLabels().length > 0 ? 'Reset filters or adjust the criteria to broaden the list.' : 'Workspace work from active projects will appear here.'"
      [returnUrl]="detailReturnUrl()"
      (retry)="loadWorkItems()"
    />
  `,
  styles: `
    .page-header {
      display: flex;
      justify-content: space-between;
      gap: 20px;
      align-items: flex-start;
      margin-bottom: 20px;
    }

    .header-actions {
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

    .danger-action {
      border-color: #fecaca;
      background: #fff1f2;
      color: #991b1b;
    }

    button:disabled {
      cursor: not-allowed;
      opacity: 0.65;
    }

    .inline-error {
      margin: 0;
      color: #991b1b;
      font-size: 0.875rem;
      font-weight: 700;
      line-height: 1.5;
    }

    .export-error {
      margin-bottom: 18px;
    }

    .copy-link-status {
      align-self: center;
      color: #475569;
      font-size: 0.8125rem;
      font-weight: 800;
      line-height: 1.4;
    }

    .saved-views,
    .filters,
    .list-panel {
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      background: #ffffff;
    }

    .saved-views {
      display: grid;
      gap: 14px;
      margin-bottom: 18px;
      padding: 16px;
    }

    .saved-views__heading {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      align-items: start;
    }

    .saved-views__heading p {
      margin-top: 4px;
    }

    .saved-view-form {
      display: grid;
      grid-template-columns: minmax(220px, 1fr) auto;
      gap: 12px;
      align-items: end;
    }

    .saved-view-list {
      display: grid;
      gap: 10px;
    }

    .saved-view-row {
      display: grid;
      grid-template-columns: minmax(180px, 1fr) minmax(180px, 0.8fr) auto;
      gap: 12px;
      align-items: end;
      border-top: 1px solid #eef2f7;
      padding-top: 12px;
    }

    .saved-view-row strong {
      display: block;
      color: #111827;
      font-size: 0.875rem;
      line-height: 1.35;
    }

    .saved-view-row small {
      display: block;
      margin-top: 4px;
      color: #64748b;
      font-size: 0.75rem;
      line-height: 1.4;
    }

    .saved-view-actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 8px;
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

    @media (max-width: 1120px) {
      .filters {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }

      .saved-view-row {
        grid-template-columns: 1fr;
      }

      .saved-view-actions {
        justify-content: flex-start;
      }
    }

    @media (max-width: 760px) {
      .page-header {
        flex-direction: column;
      }

      .filters {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .saved-views__heading,
      .saved-view-form {
        display: grid;
        grid-template-columns: 1fr;
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
  private readonly clipboard = inject(ClipboardService);
  private readonly currentUser = inject(CurrentUserService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly subscriptions = new Subscription();
  private readonly queryState = WorkListQueryStore.workspace();
  private loadedProjectFilterId: string | null = null;
  private copyLinkStatusTimer: ReturnType<typeof setTimeout> | null = null;

  readonly statuses = statuses;
  readonly workStates = workStates;
  readonly types = types;
  readonly priorities = priorities;
  readonly dueDateStates = dueDateStates;
  readonly blockedOptions = blockedOptions;
  readonly dependencyOptions = dependencyOptions;
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
  readonly savedViews = signal<SavedWorkViewDto[]>([]);
  readonly personalSavedViews = computed<SavedWorkViewDto[]>(() =>
    this.sortSavedViews(
      this.savedViews().filter(
        (savedView) => savedView.scope === 'workspace' && savedView.visibility === 'personal'
      )
    )
  );
  readonly workspaceSavedViews = computed<SavedWorkViewDto[]>(() =>
    this.sortSavedViews(
      this.savedViews().filter(
        (savedView) => savedView.scope === 'workspace' && savedView.visibility === 'workspace'
      )
    )
  );
  readonly pinnedPersonalSavedViews = computed<SavedWorkViewDto[]>(() =>
    this.personalSavedViews().filter((savedView) => savedView.isPinned)
  );
  readonly pinnedWorkspaceSavedViews = computed<SavedWorkViewDto[]>(() =>
    this.workspaceSavedViews().filter((savedView) => savedView.isPinned)
  );
  readonly canManageWorkspaceSavedViews = computed(() => {
    const role = this.currentUser.selectedMember()?.role;
    return role === 'owner' || role === 'maintainer';
  });
  readonly savedViewDraftNames = signal<Record<string, string>>({});
  readonly labels = signal<LabelDto[]>([]);
  readonly milestones = signal<MilestoneDto[]>([]);
  readonly workItems = signal<WorkspaceWorkItemListItemDto[]>([]);
  readonly appliedFilterValues = this.queryState.activeFilterValues;
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);
  readonly isCopyingViewLink = signal(false);
  readonly copyLinkStatus = signal<string | null>(null);
  readonly isExporting = signal(false);
  readonly exportError = signal<string | null>(null);
  readonly isSavedViewLoading = signal(false);
  readonly savedViewLoadError = signal<string | null>(null);
  readonly isSavingView = signal(false);
  readonly savedViewMutationError = signal<string | null>(null);

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
    dependency: [''],
    workRisk: [''],
    archivedProjects: ['exclude'],
    sort: ['updated_desc']
  });

  readonly savedViewForm = this.formBuilder.nonNullable.group({
    name: ['']
  });

  ngOnInit(): void {
    if (this.currentUser.members().length === 0) {
      this.currentUser.loadMembers();
    }

    this.loadProjectSummaries();
    this.loadSavedViews();
    this.watchFilterChanges();

    this.subscriptions.add(
      this.route.queryParamMap.subscribe((params) => {
        const nextFilters = this.queryState.applyRouteQueryParams(params);
        this.filterForm.patchValue(nextFilters, { emitEvent: false });
        this.loadProjectScopedFilters(nextFilters.projectId);
        this.loadWorkItems();
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.clearCopyLinkStatusTimer();
  }

  applyFilters(): void {
    this.queryState.setPendingFilterValues(this.filterForm.getRawValue());
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: this.queryState.pendingRouterQueryParams()
    });
  }

  resetFilters(): void {
    this.filterForm.reset(this.queryState.resetPendingFilterValues(), { emitEvent: false });
    this.applyFilters();
  }

  loadWorkItems(): void {
    this.isLoading.set(true);
    this.error.set(null);

    this.api.listWorkspaceWorkItems(this.appliedQuery()).subscribe({
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

  exportCsv(): void {
    if (this.isExporting()) {
      return;
    }

    this.isExporting.set(true);
    this.exportError.set(null);

    this.api.exportWorkspaceWorkItems(this.appliedQuery()).subscribe({
      next: (response) => {
        const fileName = fileNameFromContentDisposition(
          response.headers.get('content-disposition'),
          'worktrail-workspace-work-items.csv'
        );

        downloadBlob({
          blob: response.body ?? new Blob([''], { type: 'text/csv' }),
          fileName
        });
        this.isExporting.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.exportError.set(this.toErrorMessage(error, 'CSV export could not be downloaded.'));
        this.isExporting.set(false);
      }
    });
  }

  copyViewLink(): void {
    if (this.isCopyingViewLink()) {
      return;
    }

    this.clearCopyLinkStatusTimer();
    this.isCopyingViewLink.set(true);
    this.copyLinkStatus.set(null);

    this.clipboard
      .copyText(this.currentFilteredViewUrl())
      .then(() => {
        this.copyLinkStatus.set('Link copied');
      })
      .catch(() => {
        this.copyLinkStatus.set('Link could not be copied');
      })
      .finally(() => {
        this.isCopyingViewLink.set(false);
        this.scheduleCopyLinkStatusReset();
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

  loadSavedViews(): void {
    this.isSavedViewLoading.set(true);
    this.savedViewLoadError.set(null);

    this.api.listSavedWorkViews({ scope: 'workspace' }).subscribe({
      next: (savedViews) => {
        this.savedViews.set(this.sortSavedViews(savedViews));
        this.syncSavedViewDraftNames(this.savedViews());
        this.isSavedViewLoading.set(false);
      },
      error: () => {
        this.savedViews.set([]);
        this.savedViewDraftNames.set({});
        this.savedViewLoadError.set('Saved views could not be loaded from the API.');
        this.isSavedViewLoading.set(false);
      }
    });
  }

  activeFilterLabels(): string[] {
    return this.getActiveFilterLabels();
  }

  detailReturnUrl(): string {
    return this.queryState.returnUrl('/work-items');
  }

  removeActiveFilter(label: string): void {
    const filterName = label.split(':', 1)[0];
    const updates: Partial<WorkspaceFilterFormValue> = {};

    if (filterName === 'Search') {
      updates.search = '';
    } else if (filterName === 'Project') {
      updates.projectId = '';
      updates.labelId = '';
      updates.milestoneId = '';
    } else if (filterName === 'Status') {
      updates.status = '';
    } else if (filterName === 'State') {
      updates.workState = '';
    } else if (filterName === 'Assignee') {
      updates.assigneeId = '';
    } else if (filterName === 'Reporter') {
      updates.reporterId = '';
    } else if (filterName === 'Type') {
      updates.type = '';
    } else if (filterName === 'Label') {
      updates.labelId = '';
    } else if (filterName === 'Milestone') {
      updates.milestoneId = '';
    } else if (filterName === 'Priority') {
      updates.priority = '';
    } else if (filterName === 'Due date') {
      updates.dueDateState = '';
    } else if (filterName === 'Blocked') {
      updates.blocked = '';
    } else if (filterName === 'Dependency') {
      updates.dependency = '';
    } else if (filterName === 'Projects') {
      updates.archivedProjects = 'exclude';
    } else if (filterName === 'Sort') {
      updates.sort = 'updated_desc';
    }

    this.filterForm.patchValue(updates, { emitEvent: false });
    this.applyFilters();
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

  saveCurrentView(): void {
    this.createSavedView('personal');
  }

  saveWorkspaceView(): void {
    this.createSavedView('workspace');
  }

  private createSavedView(visibility: SavedWorkViewDto['visibility']): void {
    const name = this.savedViewForm.controls.name.value.trim();

    if (name === '') {
      this.savedViewMutationError.set('Saved view name is required.');
      return;
    }

    if (visibility === 'workspace' && !this.canManageWorkspaceSavedViews()) {
      this.savedViewMutationError.set('Only owners and maintainers can manage shared saved views.');
      return;
    }

    this.isSavingView.set(true);
    this.savedViewMutationError.set(null);

    this.api
      .createSavedWorkView({
        name,
        scope: 'workspace',
        query: this.appliedQuery(),
        ...(visibility === 'workspace' ? { visibility } : {})
      })
      .subscribe({
        next: (savedView) => {
          this.savedViews.set(this.sortSavedViews([...this.savedViews(), savedView]));
          this.syncSavedViewDraftNames(this.savedViews());
          this.savedViewForm.reset({ name: '' });
          this.isSavingView.set(false);
        },
        error: (error: HttpErrorResponse) => {
          this.savedViewMutationError.set(
            this.toErrorMessage(error, 'Saved view could not be created.')
          );
          this.isSavingView.set(false);
        }
      });
  }

  saveCurrentViewName(name: string): void {
    this.savedViewForm.controls.name.setValue(name);
    this.saveCurrentView();
  }

  saveWorkspaceViewName(name: string): void {
    this.savedViewForm.controls.name.setValue(name);
    this.saveWorkspaceView();
  }

  openSavedView(savedView: SavedWorkViewDto): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: this.queryState.routerQueryParamsFromQuery(savedView.query)
    });
  }

  renameSavedView(savedView: SavedWorkViewDto): void {
    if (!this.canMutateSavedView(savedView)) {
      return;
    }

    const name = this.savedViewDraftName(savedView.id).trim();

    if (name === '') {
      this.savedViewMutationError.set('Saved view name is required.');
      return;
    }

    this.savedViewMutationError.set(null);

    this.api.updateSavedWorkView(savedView.id, { name }).subscribe({
      next: (updated) => {
        this.replaceSavedView(updated);
      },
      error: (error: HttpErrorResponse) => {
        this.savedViewMutationError.set(
          this.toErrorMessage(error, 'Saved view could not be renamed.')
        );
      }
    });
  }

  updateSavedViewQuery(savedView: SavedWorkViewDto): void {
    if (!this.canMutateSavedView(savedView)) {
      return;
    }

    this.savedViewMutationError.set(null);

    this.api.updateSavedWorkView(savedView.id, { query: this.appliedQuery() }).subscribe({
      next: (updated) => {
        this.replaceSavedView(updated);
      },
      error: (error: HttpErrorResponse) => {
        this.savedViewMutationError.set(
          this.toErrorMessage(error, 'Saved view query could not be updated.')
        );
      }
    });
  }

  setSavedViewPinned(savedView: SavedWorkViewDto, isPinned: boolean): void {
    if (!this.canMutateSavedView(savedView)) {
      return;
    }

    this.savedViewMutationError.set(null);

    this.api.updateSavedWorkView(savedView.id, { isPinned }).subscribe({
      next: (updated) => {
        this.replaceSavedView(updated);
      },
      error: (error: HttpErrorResponse) => {
        this.savedViewMutationError.set(
          this.toErrorMessage(error, 'Saved view pin state could not be updated.')
        );
      }
    });
  }

  deleteSavedView(savedView: SavedWorkViewDto): void {
    if (!this.canMutateSavedView(savedView)) {
      return;
    }

    this.savedViewMutationError.set(null);

    this.api.deleteSavedWorkView(savedView.id).subscribe({
      next: () => {
        this.savedViews.set(this.savedViews().filter((view) => view.id !== savedView.id));
        const { [savedView.id]: _removed, ...remainingDraftNames } = this.savedViewDraftNames();
        this.savedViewDraftNames.set(remainingDraftNames);
      },
      error: (error: HttpErrorResponse) => {
        this.savedViewMutationError.set(
          this.toErrorMessage(error, 'Saved view could not be deleted.')
        );
      }
    });
  }

  canMutateSavedView(savedView: SavedWorkViewDto): boolean {
    if (savedView.visibility === 'personal' || this.canManageWorkspaceSavedViews()) {
      return true;
    }

    this.savedViewMutationError.set('Only owners and maintainers can manage shared saved views.');
    return false;
  }

  savedViewDraftName(savedViewId: string): string {
    return this.savedViewDraftNames()[savedViewId] ?? '';
  }

  setSavedViewDraftName(savedViewId: string, name: string): void {
    this.savedViewDraftNames.set({
      ...this.savedViewDraftNames(),
      [savedViewId]: name
    });
  }

  savedViewQueryLabel(savedView: SavedWorkViewDto): string {
    const count = this.queryState.meaningfulFieldCount(savedView.query);

    return count === 0
      ? 'Default workspace view'
      : `${count} applied ${count === 1 ? 'filter' : 'filters'}`;
  }

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

  private appliedQuery(): WorkItemQuery {
    return this.queryState.activeQuery();
  }

  private currentFilteredViewUrl(): string {
    return this.queryState.filteredViewUrl('/work-items', window.location.origin);
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
      this.filterForm.controls.dependency,
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
      'Dependency',
      this.optionLabel(dependencyOptions, filters.dependency)
    );
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

  private sortSavedViews(savedViews: SavedWorkViewDto[]): SavedWorkViewDto[] {
    return [...savedViews].sort((left, right) => left.name.localeCompare(right.name));
  }

  private replaceSavedView(savedView: SavedWorkViewDto): void {
    this.savedViews.set(
      this.sortSavedViews(
        this.savedViews().map((current) => (current.id === savedView.id ? savedView : current))
      )
    );
    this.syncSavedViewDraftNames(this.savedViews());
  }

  private syncSavedViewDraftNames(savedViews: SavedWorkViewDto[]): void {
    this.savedViewDraftNames.set(
      Object.fromEntries(savedViews.map((savedView) => [savedView.id, savedView.name]))
    );
  }

  private scheduleCopyLinkStatusReset(): void {
    this.copyLinkStatusTimer = setTimeout(() => {
      this.copyLinkStatus.set(null);
      this.copyLinkStatusTimer = null;
    }, 2500);
  }

  private clearCopyLinkStatusTimer(): void {
    if (this.copyLinkStatusTimer !== null) {
      clearTimeout(this.copyLinkStatusTimer);
      this.copyLinkStatusTimer = null;
    }
  }

  private toErrorMessage(error: HttpErrorResponse, fallback: string): string {
    const message = (error.error as { error?: { message?: unknown } } | null)?.error?.message;

    return typeof message === 'string' ? message : fallback;
  }

  private sortMilestones(milestones: MilestoneDto[]): MilestoneDto[] {
    return [...milestones].sort((left, right) => {
      if (left.isArchived !== right.isArchived) {
        return left.isArchived ? 1 : -1;
      }

      return left.name.localeCompare(right.name);
    });
  }

  private formatDateOnly(value: string): string {
    const [year, month, day] = value.split('-').map(Number);

    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric'
    }).format(new Date(year, month - 1, day));
  }
}
