import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import type {
  ArchivedProjectMode,
  DependencyFilter,
  DueDateState,
  LabelDto,
  MemberDto,
  MilestoneDto,
  ProjectCycleDto,
  ProjectNavigationSummaryDto,
  ResolvedWorkItemPageQuery,
  SavedWorkViewDto,
  WorkItemPageMetadataDto,
  WorkItemPageSize,
  WorkItemPriority,
  WorkItemQuery,
  WorkItemSort,
  WorkItemState,
  WorkItemStatus,
  WorkItemType,
  WorkspaceWorkItemListItemDto
} from '@worktrail/contracts';
import { Subscription } from 'rxjs';
import { recordOriginParams } from '../../shared/navigation/work-navigation';
import { workItemFilterChips, type WorkItemFilterChip } from './query/work-item-filter-labels';
import type { WorkspaceWorkItemFilterFormValue } from './query/work-item-filter-state';
import { SavedViewsStore } from './state/saved-views.store';

import { CyclesApi } from '../../core/api/cycles-api';
import { ProjectsApi } from '../../core/api/projects-api';
import { SavedViewsApi } from '../../core/api/saved-views-api';
import { WorkItemsApi } from '../../core/api/work-items-api';
import { CurrentUserService } from '../../core/current-user.service';
import { PageContext } from '../../core/navigation/page-context';
import { ClipboardService } from '../../shared/clipboard.service';
import { downloadBlob, fileNameFromContentDisposition } from '../../shared/download-file';
import { apiErrorMessageFromBody } from '../../shared/http-error-message';
import {
  dependencyFilterLabel,
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
import { WorkItemPaginationComponent } from './components/work-item-pagination.component';
import { WorkItemResultListComponent } from './components/work-item-result-list.component';
import {
  unassignedAssigneeValue,
  workItemHierarchyOptions
} from './query/work-item-filter-options';
import { defaultWorkItemPageQuery } from './query/work-item-page-query-serialization';
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

type WorkspaceFilterFormValue = WorkspaceWorkItemFilterFormValue;

@Component({
  selector: 'app-workspace-work-item-list-page',
  imports: [
    ActiveFilterChipsComponent,
    PinnedSavedViewsComponent,
    ReactiveFormsModule,
    RouterLink,
    SavedViewsToolbarComponent,
    WorkItemFilterPanelComponent,
    WorkItemPaginationComponent,
    WorkItemResultListComponent
  ],
  template: `
    <div class="work-list-page">
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
          <a class="primary-action" routerLink="/work-items/new" [queryParams]="createQueryParams()">Create work item</a>
          @if (copyLinkStatus()) {
            <span class="copy-link-status" aria-live="polite">{{ copyLinkStatus() }}</span>
          }
        </div>
      </section>

      @if (exportError()) {
        <p class="inline-error export-error">{{ exportError() }}</p>
      }

      <section class="work-list-views" aria-label="Workspace saved views">
        <app-pinned-saved-views [openedViewId]="savedViewState().id"
          [sharedViews]="pinnedWorkspaceSavedViews()"
          [personalViews]="pinnedPersonalSavedViews()"
          (open)="openSavedView($event)"
        />

        <app-saved-views-toolbar
          [personalViews]="personalSavedViews()"
          [sharedViews]="workspaceSavedViews()"
          [canManagePersonalViews]="currentActorCanManagePersonal()"
          [canManageSharedViews]="canManageWorkspaceSavedViews()"
          [openedViewId]="savedViewState().id" [viewState]="savedViewState().label"
          [contextKey]="savedViewsContextKey()" [manageableViewIds]="savedViewsState.manageableViewIds()"
          [createdRevision]="savedViewsState.createdRevision()"
          [draftNames]="savedViewDraftNames()"
          [isLoading]="isSavedViewLoading()"
          [isSaving]="isSavingView()"
          [loadError]="savedViewLoadError()"
          (retryLoad)="loadSavedViews()"
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
      </section>

      <section class="work-list-filters" aria-label="Workspace work item filters">
        <app-active-filter-chips [chips]="activeFilterChips()" (remove)="removeActiveFilter($event)" />

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

      @if (filterForm.controls.projectId.value !== '') {
        <label filterAdvanced>
          <span>Cycle</span>
          <select formControlName="cycleId">
            <option value="">All cycles</option>
            @for (cycle of cycles(); track cycle.id) {
              <option [value]="cycle.id">{{ cycle.name }}</option>
            }
          </select>
        </label>
      }

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
        <span>Work breakdown</span>
        <select formControlName="hierarchy">
          @for (option of hierarchyOptions; track option.value) {
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
        <span>Assignment</span>
        <select formControlName="assigneeState">
          <option value="">Any assignment</option>
          <option value="assigned">Assigned</option>
          <option value="unassigned">Unassigned</option>
        </select>
      </label>

      <label filterAdvanced>
        <span>Estimate</span>
        <select formControlName="estimateState">
          <option value="">Any estimate</option>
          <option value="estimated">Estimated</option>
          <option value="unestimated">Unestimated</option>
        </select>
      </label>

      <label filterAdvanced>
        <span>Risk</span>
        <select formControlName="workRisk">
          <option value="">Any risk</option>
          <option value="unassigned_active">Unassigned active</option>
          <option value="stale_in_progress">Stale in progress</option>
        </select>
      </label>
      <label filterAdvanced><span>Parent key</span><input formControlName="parentKey" maxlength="80" /></label>

      <label filterAdvanced>
        <span>Sort</span>
        <select formControlName="sort">
          @for (sort of sorts; track sort.value) {
            <option [value]="sort.value">{{ sort.label }}</option>
          }
        </select>
      </label>

      <div filterActions class="filter-actions">
        <button type="submit" class="primary-action">Apply</button>
        <button type="button" class="secondary-action" (click)="resetFilters()">Reset</button>
      </div>
        </app-work-item-filter-panel>
      </section>

      <section class="work-list-results" aria-label="Workspace work item results">
        <p class="results-status" role="status" aria-label="Work item results status">{{ resultsMessage() }}</p>

      <app-work-item-pagination [metadata]="pageMetadata()" [disabled]="isLoading()" [compact]="true"
        (pageChange)="goToPage($event)" (pageSizeChange)="changePageSize($event)" />
      <app-work-item-result-list
          [items]="workItems()"
          [metadata]="pageMetadata()"
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
        <app-work-item-pagination
          [metadata]="pageMetadata()"
          [disabled]="isLoading()"
          (pageChange)="goToPage($event)"
          (pageSizeChange)="changePageSize($event)"
        />
      </section>
    </div>
  `,
  styles: `
    .work-list-page {
      display: grid;
      gap: 14px;
    }

    .work-list-views,
    .work-list-filters,
    .work-list-results {
      display: grid;
      gap: 10px;
    }

    app-active-filter-chips,
    app-pinned-saved-views,
    app-saved-views-toolbar,
    app-work-item-filter-panel,
    app-work-item-pagination,
    app-work-item-result-list {
      display: block;
    }

    .page-header {
      display: flex;
      justify-content: space-between;
      gap: 20px;
      align-items: flex-start;
      margin-bottom: 0;
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
      margin-bottom: 0;
    }

    .copy-link-status {
      align-self: center;
      color: #475569;
      font-size: 0.8125rem;
      font-weight: 800;
      line-height: 1.4;
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
  private readonly context = new PageContext();
  @ViewChild(WorkItemResultListComponent) private resultList?: WorkItemResultListComponent;

  private readonly projectsApi = inject(ProjectsApi);
  private readonly savedViewsApi = inject(SavedViewsApi);
  private readonly workItemsApi = inject(WorkItemsApi);
  private readonly cyclesApi = inject(CyclesApi);
  private readonly clipboard = inject(ClipboardService);
  private readonly currentUser = inject(CurrentUserService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly subscriptions = new Subscription();
  private projectOptionsSubscription = new Subscription();
  private readonly queryState = WorkListQueryStore.workspace();
  private workItemsSubscription: Subscription | null = null;
  private pendingContextPageReset = false;
  private loadedProjectFilterId: string | null = null;
  private focusAfterLoadPageKey: string | null = null;
  private focusResultTimer: ReturnType<typeof setTimeout> | null = null;
  private copyLinkStatusTimer: ReturnType<typeof setTimeout> | null = null;

  readonly statuses = statuses;
  readonly workStates = workStates;
  readonly types = types;
  readonly priorities = priorities;
  readonly dueDateStates = dueDateStates;
  readonly blockedOptions = blockedOptions;
  readonly dependencyOptions = dependencyOptions;
  readonly hierarchyOptions = workItemHierarchyOptions;
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
  readonly savedViewsState = new SavedViewsStore(this.savedViewsApi, {
    scope: 'workspace', actor: () => this.currentUser.selectedMember(),

    contextKey: () => this.context.contextKey(), appliedQuery: () => this.queryState.activeQuery(),
    canManagePersonalViews: () => this.currentUser.selectedMember()?.isActive === true, canManageSharedViews: () => this.canManageWorkspaceSavedViews(),

    loadErrorMessage: 'Saved views could not be loaded from the API.'
  });
  readonly savedViewState = this.savedViewsState.viewState;
  readonly savedViewsContextKey = computed(() => this.context.contextKey());
  readonly resultsMessage = computed(() => this.queryState.resultsSummary() === null ? null :
    this.savedViewState().label + '. ' + this.queryState.resultsSummary());
  private viewOpenGeneration = 0;
  readonly savedViews = this.savedViewsState.views;
  readonly personalSavedViews = this.savedViewsState.personalViews;
  readonly workspaceSavedViews = this.savedViewsState.sharedViews;
  readonly pinnedPersonalSavedViews = this.savedViewsState.pinnedPersonalViews;
  readonly pinnedWorkspaceSavedViews = this.savedViewsState.pinnedSharedViews;
  readonly canManageWorkspaceSavedViews = computed(() => {
    const actor = this.currentUser.selectedMember();
    return actor?.isActive === true && (actor.role === 'owner' || actor.role === 'maintainer');
  });
  readonly savedViewDraftNames = this.savedViewsState.draftNames;
  readonly labels = signal<LabelDto[]>([]);
  readonly milestones = signal<MilestoneDto[]>([]);
  readonly cycles = signal<ProjectCycleDto[]>([]);
  readonly workItems = signal<WorkspaceWorkItemListItemDto[]>([]);
  readonly pageMetadata = signal<WorkItemPageMetadataDto>(emptyPageMetadata());
  readonly activePageQuery = this.queryState.activePageQuery;
  readonly appliedFilterValues = this.queryState.activeFilterValues;
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);
  readonly isCopyingViewLink = signal(false);
  readonly copyLinkStatus = signal<string | null>(null);
  readonly isExporting = signal(false);
  readonly exportError = signal<string | null>(null);
  readonly isSavedViewLoading = this.savedViewsState.isLoading;
  readonly savedViewLoadError = this.savedViewsState.loadError;
  readonly isSavingView = this.savedViewsState.isSaving;
  readonly savedViewMutationError = this.savedViewsState.mutationError;

  readonly filterForm = this.formBuilder.nonNullable.group({
    assigneeState: [''],
    estimateState: [''],
    search: [''],
    projectId: [''],
    status: [''],
    workState: [''],
    assigneeId: [''],
    reporterId: [''],
    type: [''],
    labelId: [''],
    milestoneId: [''],
    cycleId: [''],
    priority: [''],
    dueDateState: [''],
    blocked: [''],
    dependency: [''],
    workRisk: [''],
    hierarchy: [''],
    parentKey: [''],
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

    let initializedWithActor = false;
    this.context.start(() => {
      this.savedViewsState.reset(); this.viewOpenGeneration++; this.queryState.clearResults();
      this.pendingContextPageReset = false;
      this.workItemsSubscription?.unsubscribe();
      this.clearResultFocusRequest();
      this.clearCopyLinkStatusTimer();
      this.projectSummaries.set([]);
      this.labels.set([]);
      this.milestones.set([]);
      this.cycles.set([]);
      this.workItems.set([]);
      this.pageMetadata.set(emptyPageMetadata());
      this.isLoading.set(false);
      this.error.set(null);
      this.isCopyingViewLink.set(false);
      this.copyLinkStatus.set(null);
      this.isExporting.set(false);
      this.exportError.set(null);
      this.activePageQuery.set({ ...defaultWorkItemPageQuery });
      this.reloadActorContext();
      if (initializedWithActor && (this.context.query('page') !== '' || this.context.query('pageSize') !== '')) {
        this.pendingContextPageReset = true;
        const isCurrent = this.context.capture();
        void this.router.navigate([], {
          relativeTo: this.route,
          queryParams: this.queryState.routerQueryParamsForResolvedPage(defaultWorkItemPageQuery)
        }).then((navigated) => {
          if (isCurrent() && !navigated) {
            this.pendingContextPageReset = false;
            this.loadWorkItems();
          }
        });
      }
      // Initial member bootstrap must retain a deep link's paging, unlike a later actor switch.
      initializedWithActor = this.currentUser.selectedMember() !== null;
    });
    this.watchFilterChanges();

    this.subscriptions.add(
      this.context.queryParamMap$.subscribe((params) => {
        if (this.pendingContextPageReset && (params.get('page') !== null || params.get('pageSize') !== null)) return;
        this.pendingContextPageReset = false;
        const previousFilters = this.appliedFilterValues();
        const pendingFilterDraft = this.filterForm.getRawValue();
        const nextFilters = this.queryState.applyRouteQueryParams(params);
        const activePage = this.activePageQuery();
        const preservePendingFilterDraft =
          this.focusAfterLoadPageKey !== null &&
          sameFilterValues(previousFilters, nextFilters);

        if (
          this.focusAfterLoadPageKey !== null &&
          this.focusAfterLoadPageKey !== pageKey(activePage)
        ) {
          this.clearResultFocusRequest();
        }

        if (preservePendingFilterDraft) {
          this.queryState.setPendingFilterValues(pendingFilterDraft);
        } else {
          this.filterForm.patchValue(nextFilters, { emitEvent: false });
        }
        if (!this.queryState.isCanonicalPageQuery(params)) {
          void this.router.navigate([], {
            relativeTo: this.route,
            queryParams: this.queryState.activeRouterQueryParams(),
            replaceUrl: true
          });
          return;
        }
        this.loadProjectScopedFilters(nextFilters.projectId);
        this.loadWorkItems();
      })
    );
  }

  ngOnDestroy(): void {
    this.savedViewsState.destroy(); this.viewOpenGeneration++;
    this.workItemsSubscription?.unsubscribe();
    this.subscriptions.unsubscribe();
    this.projectOptionsSubscription.unsubscribe();
    this.clearResultFocusTimer();
    this.clearCopyLinkStatusTimer();
  }

  applyFilters(): void {
    this.clearResultFocusRequest();
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
    this.workItemsSubscription?.unsubscribe();
    const requestedPage = this.activePageQuery();
    const resultsGeneration = this.queryState.beginResultsLoad();
    this.isLoading.set(true);
    this.error.set(null);
    this.workItems.set([]);
    this.pageMetadata.set(emptyPageMetadata(requestedPage));

    this.workItemsSubscription = this.workItemsApi
      .listWorkspaceWorkItems(this.appliedQuery(), requestedPage).pipe(this.context.guard())
      .subscribe({
        next: (response) => {
          if (response.page !== requestedPage.page || response.pageSize !== requestedPage.pageSize) {
            if (this.focusAfterLoadPageKey === pageKey(requestedPage)) {
              this.focusAfterLoadPageKey = pageKey(response);
            }
            void this.router.navigate([], {
              relativeTo: this.route,
              queryParams: this.queryState.routerQueryParamsForResolvedPage({
                page: response.page,
                pageSize: response.pageSize
              }),
              replaceUrl: true
            });
            return;
          }

          this.workItems.set(response.items);
          this.pageMetadata.set(pageMetadataFromResponse(response));
          this.queryState.acceptResults(resultsGeneration, pageMetadataFromResponse(response), response.items.length);
          this.mergeResultLabels(response.items);
          this.isLoading.set(false);
          if (this.focusAfterLoadPageKey === pageKey(response)) {
            this.focusAfterLoadPageKey = null;
            this.scheduleResultHeadingFocus();
          }
        },
        error: () => {
          this.error.set('Workspace work items could not be loaded from the API.');
          this.isLoading.set(false);
        }
      });
  }

  goToPage(page: number): void {
    if (this.isLoading() || this.pageMetadata().totalPages === 0) {
      return;
    }

    const targetPage = Math.min(Math.max(1, page), this.pageMetadata().totalPages);
    if (targetPage === this.activePageQuery().page) {
      return;
    }

    this.requestResultHeadingFocus({
      page: targetPage,
      pageSize: this.activePageQuery().pageSize
    });
    const isCurrent = this.context.capture();
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: this.queryState.routerQueryParamsForPage(targetPage)
    }).then((navigated) => {
      if (isCurrent() && !navigated) {
        this.clearResultFocusRequest();
      }
    });
  }

  changePageSize(pageSize: WorkItemPageSize): void {
    if (
      this.isLoading() ||
      (this.activePageQuery().page === 1 && pageSize === this.activePageQuery().pageSize)
    ) {
      return;
    }

    this.requestResultHeadingFocus({ page: 1, pageSize });
    const isCurrent = this.context.capture();
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: this.queryState.routerQueryParamsForPageSize(pageSize)
    }).then((navigated) => {
      if (isCurrent() && !navigated) {
        this.clearResultFocusRequest();
      }
    });
  }

  exportCsv(): Promise<void> {
    if (this.isExporting()) {
      return Promise.resolve();
    }

    const isCurrent = this.context.capture();
    this.isExporting.set(true);
    this.exportError.set(null);

    return new Promise((resolve) => {
      this.workItemsApi.exportWorkspaceWorkItems(this.appliedQuery()).pipe(this.context.guard()).subscribe({
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
          resolve();
        },
        error: (error: HttpErrorResponse) => {
          const fallback = 'CSV export could not be downloaded.';
          this.exportError.set(fallback);
          this.isExporting.set(false);
          void apiErrorMessageFromBody(error.error, fallback).then((message) => {
            if (isCurrent()) this.exportError.set(message);
            resolve();
          });
        },
        complete: () => resolve()
      });
    });
  }

  copyViewLink(): void {
    if (this.isCopyingViewLink()) {
      return;
    }

    const isCurrent = this.context.capture();
    this.clearCopyLinkStatusTimer();
    this.isCopyingViewLink.set(true);
    this.copyLinkStatus.set(null);

    this.clipboard
      .copyText(this.currentFilteredViewUrl())
      .then(() => {
        if (isCurrent()) this.copyLinkStatus.set('Link copied');
      })
      .catch(() => {
        if (isCurrent()) this.copyLinkStatus.set('Link could not be copied');
      })
      .finally(() => {
        if (!isCurrent()) return;
        this.isCopyingViewLink.set(false);
        this.scheduleCopyLinkStatusReset();
      });
  }

  loadProjectSummaries(): void {
    this.projectsApi.listProjectNavigationSummaries().pipe(this.context.guard()).subscribe({
      next: (summaries) => {
        this.projectSummaries.set(summaries);
      },
      error: () => {
        this.projectSummaries.set([]);
      }
    });
  }

  loadSavedViews(): void { this.savedViewsState.load(); }

  activeFilterLabels(): string[] { return this.activeFilterChips().map(chip => chip.label); }

  activeFilterChips(): WorkItemFilterChip[] {
    return workItemFilterChips(this.queryState.activeQuery(), 'workspace', {
      members: this.members(), labels: this.labels(), milestones: this.milestones(), cycles: this.cycles(), projectSummaries: this.projectSummaries()
    });
  }

  createQueryParams(): { returnUrl: string } { return recordOriginParams(this.detailReturnUrl()); }

  detailReturnUrl(): string {
    return this.queryState.returnUrl('/work-items');
  }

  removeActiveFilter(key: keyof WorkItemQuery): void {
    const query = { ...this.queryState.activeQuery() };
    delete query[key];
    if (key === 'projectId') { delete query.labelId; delete query.milestoneId; delete query.cycleId; }
    void this.router.navigate([], { relativeTo: this.route, queryParams: this.queryState.routerQueryParamsFromQuery(query) });
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

  private createSavedView(visibility: SavedWorkViewDto['visibility']): void { this.savedViewsState.create(this.savedViewForm.controls.name.value, visibility, this.appliedQuery(), () => this.savedViewForm.reset({ name: '' })); }

  saveCurrentViewName(name: string): void {
    this.savedViewForm.controls.name.setValue(name);
    this.saveCurrentView();
  }

  saveWorkspaceViewName(name: string): void {
    this.savedViewForm.controls.name.setValue(name);
    this.saveWorkspaceView();
  }

  openSavedView(view: SavedWorkViewDto): void {
    if (!this.savedViewsState.canOpen(view)) return;
    this.clearResultFocusRequest();

    const request = ++this.viewOpenGeneration;
    const current = this.context.capture();
    const extras = { relativeTo: this.route, queryParams: this.queryState.routerQueryParamsFromQuery(view.query) };
    const destination = this.router.serializeUrl(this.router.createUrlTree([], extras));
    void this.router.navigate([], extras).then(accepted => {
      if (current() && request === this.viewOpenGeneration && (accepted || this.router.url === destination)) this.savedViewsState.open(view);
    });
  }

  renameSavedView(view: SavedWorkViewDto): void { this.savedViewsState.rename(view, this.savedViewsState.draftName(view.id)); }

  updateSavedViewQuery(view: SavedWorkViewDto): void { this.savedViewsState.updateQuery(view, this.appliedQuery()); }

  setSavedViewPinned(view: SavedWorkViewDto, isPinned: boolean): void { this.savedViewsState.setPinned(view, isPinned); }

  deleteSavedView(view: SavedWorkViewDto): void { this.savedViewsState.delete(view); }

  canMutateSavedView(view: SavedWorkViewDto): boolean { return this.savedViewsState.canMutate(view); }

  savedViewDraftName(id: string): string { return this.savedViewsState.draftName(id); }

  setSavedViewDraftName(id: string, name: string): void { this.savedViewsState.setDraftName(id, name); }

  savedViewQueryLabel(view: SavedWorkViewDto): string { return this.savedViewsState.queryLabel(view); }

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

  private reloadActorContext(): void {
    this.loadProjectSummaries();
    this.loadSavedViews();
    this.projectOptionsSubscription.unsubscribe();
    this.projectOptionsSubscription = new Subscription();
    this.loadedProjectFilterId = null;
    this.loadProjectScopedFilters(this.appliedFilterValues().projectId);
  }

  private requestResultHeadingFocus(pageQuery: ResolvedWorkItemPageQuery): void {
    this.clearResultFocusTimer();
    this.focusAfterLoadPageKey = pageKey(pageQuery);
  }

  private scheduleResultHeadingFocus(): void {
    this.clearResultFocusTimer();
    this.focusResultTimer = setTimeout(() => {
      this.focusResultTimer = null;
      this.resultList?.focusResultHeading();
    });
  }

  private clearResultFocusRequest(): void {
    this.focusAfterLoadPageKey = null;
    this.clearResultFocusTimer();
  }

  private clearResultFocusTimer(): void {
    if (this.focusResultTimer !== null) {
      clearTimeout(this.focusResultTimer);
      this.focusResultTimer = null;
    }
  }

  private currentFilteredViewUrl(): string {
    return this.queryState.filteredViewUrl('/work-items', window.location.origin);
  }

  private watchFilterChanges(): void {
    this.subscriptions.add(this.filterForm.valueChanges.subscribe(() => this.queryState.setPendingFilterValues(this.filterForm.getRawValue())));
    this.subscriptions.add(this.filterForm.controls.status.valueChanges.subscribe(value => { if (value) this.filterForm.patchValue({ workState: '' }, { emitEvent: false }); }));
    this.subscriptions.add(this.filterForm.controls.workState.valueChanges.subscribe(value => { if (value) this.filterForm.patchValue({ status: '' }, { emitEvent: false }); }));
    this.subscriptions.add(this.filterForm.controls.hierarchy.valueChanges.subscribe(value => { if (value) this.filterForm.patchValue({ parentKey: '' }, { emitEvent: false }); }));
    this.subscriptions.add(this.filterForm.controls.parentKey.valueChanges.subscribe(value => { if (value) this.filterForm.patchValue({ hierarchy: '' }, { emitEvent: false }); }));
    this.subscriptions.add(this.filterForm.controls.assigneeState.valueChanges.subscribe(value => { if (value === 'unassigned') this.filterForm.patchValue({ assigneeId: '' }, { emitEvent: false }); }));
    this.subscriptions.add(this.filterForm.controls.assigneeId.valueChanges.subscribe(value => { if (value && value !== '__unassigned' && this.filterForm.controls.assigneeState.value === 'unassigned') this.filterForm.patchValue({ assigneeState: '' }, { emitEvent: false }); }));
    this.subscriptions.add(this.filterForm.controls.projectId.valueChanges.subscribe(value => {
      this.filterForm.patchValue({ labelId: '', milestoneId: '', cycleId: '' }, { emitEvent: false });
      this.loadProjectScopedFilters(value);
    }));
  }

  private loadProjectScopedFilters(projectId: string): void {
    if (projectId !== this.loadedProjectFilterId) {
      this.projectOptionsSubscription.unsubscribe();
      this.projectOptionsSubscription = new Subscription();
      this.labels.set([]);
      this.milestones.set([]);
      this.cycles.set([]);
    }
    if (projectId === '') {
      this.loadedProjectFilterId = null;
      this.labels.set([]);
      this.milestones.set([]);
      this.cycles.set([]);
      return;
    }

    if (projectId === this.loadedProjectFilterId) {
      return;
    }

    this.loadedProjectFilterId = projectId;

    this.projectOptionsSubscription.add(this.projectsApi.listProjectLabels(projectId, { includeArchived: true }).pipe(this.context.guard()).subscribe({
      next: (labels) => {
        this.labels.set(this.sortLabels(labels));
      },
      error: () => {
        this.labels.set([]);
      }
    }));

    this.projectOptionsSubscription.add(this.projectsApi.listProjectMilestones(projectId, { includeArchived: true }).pipe(this.context.guard()).subscribe({
      next: (milestones) => {
        this.milestones.set(this.sortMilestones(milestones));
      },
      error: () => {
        this.milestones.set([]);
      }
    }));

    this.projectOptionsSubscription.add(this.cyclesApi.listCycles(projectId, { includeArchived: true }).pipe(this.context.guard()).subscribe({
      next: (cycles) => {
        this.cycles.set(this.sortCycles(cycles));
      },
      error: () => {
        this.cycles.set([]);
      }
    }));
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

  private sortCycles(cycles: ProjectCycleDto[]): ProjectCycleDto[] {
    return [...cycles].sort((left, right) => {
      if (left.isArchived !== right.isArchived) {
        return left.isArchived ? 1 : -1;
      }

      if (left.startDate !== right.startDate) {
        return left.startDate.localeCompare(right.startDate);
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

  currentActorCanManagePersonal(): boolean { return this.currentUser.selectedMember()?.isActive === true; }
}

function emptyPageMetadata(
  pageQuery: ResolvedWorkItemPageQuery = { page: 1, pageSize: 25 }
): WorkItemPageMetadataDto {
  return {
    ...pageQuery,
    totalCount: 0,
    totalPages: 0,
    hasPreviousPage: false,
    hasNextPage: false
  };
}

function pageMetadataFromResponse(
  response: WorkItemPageMetadataDto
): WorkItemPageMetadataDto {
  return {
    page: response.page,
    pageSize: response.pageSize,
    totalCount: response.totalCount,
    totalPages: response.totalPages,
    hasPreviousPage: response.hasPreviousPage,
    hasNextPage: response.hasNextPage
  };
}

function pageKey(pageQuery: ResolvedWorkItemPageQuery): string {
  return `${pageQuery.page}:${pageQuery.pageSize}`;
}

function sameFilterValues(
  left: WorkspaceFilterFormValue,
  right: WorkspaceFilterFormValue
): boolean {
  return Object.keys(left).every((key) => {
    const filterKey = key as keyof WorkspaceFilterFormValue;
    return left[filterKey] === right[filterKey];
  });
}
