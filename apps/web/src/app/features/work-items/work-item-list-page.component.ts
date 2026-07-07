import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import type {
  BulkUpdateWorkItemsAction,
  BulkUpdateWorkItemsRequest,
  BulkUpdateWorkItemsResponseDto,
  BulkUpdateWorkItemsResultDto,
  DependencyFilter,
  DueDateState,
  LabelDto,
  MemberDto,
  MilestoneDto,
  ProjectDto,
  SavedWorkViewDto,
  WorkItemListItemDto,
  WorkItemPriority,
  WorkItemQuery,
  WorkItemSort,
  WorkItemStatus,
  WorkItemType
} from '@worktrail/contracts';
import { Subscription, debounceTime, distinctUntilChanged } from 'rxjs';

import { CurrentUserService } from '../../core/current-user.service';
import { WorktrailApiService } from '../../core/worktrail-api.service';
import { ClipboardService } from '../../shared/clipboard.service';
import { downloadBlob, fileNameFromContentDisposition } from '../../shared/download-file';
import { dependencyFilterLabel } from '../../shared/work-items/work-item-display';
import { ActiveFilterChipsComponent } from './components/active-filter-chips.component';
import { PinnedSavedViewsComponent } from './components/pinned-saved-views.component';
import { SavedViewsToolbarComponent } from './components/saved-views-toolbar.component';
import { WorkItemFilterPanelComponent } from './components/work-item-filter-panel.component';
import { WorkItemResultListComponent } from './components/work-item-result-list.component';
import {
  projectFormValueFromQueryParams,
  projectQueryFromFormValue,
  projectRouterQueryParamsFromQuery,
  returnUrlFromWorkItemQuery
} from './query/work-item-query-serialization';

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
const dueDateStates: Array<{ label: string; value: DueDateState }> = [
  { label: 'Overdue', value: 'overdue' },
  { label: 'Due soon', value: 'due_soon' },
  { label: 'No due date', value: 'none' }
];
const dependencyOptions: Array<{ label: string; value: DependencyFilter }> = [
  { label: 'Blocked by open work', value: 'dependency_blocked' },
  { label: 'Blocking open work', value: 'blocking_open_work' }
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
type BulkActionType = BulkUpdateWorkItemsAction['type'];

const bulkActionOptions: Array<{ label: string; value: BulkActionType }> = [
  { label: 'Assign to member', value: 'set_assignee' },
  { label: 'Clear assignee', value: 'clear_assignee' },
  { label: 'Set priority', value: 'set_priority' },
  { label: 'Set milestone', value: 'set_milestone' },
  { label: 'Clear milestone', value: 'clear_milestone' },
  { label: 'Set due date', value: 'set_due_date' },
  { label: 'Clear due date', value: 'clear_due_date' },
  { label: 'Add labels', value: 'add_labels' },
  { label: 'Remove labels', value: 'remove_labels' },
  { label: 'Transition status', value: 'transition_status' }
];

interface BulkActionFormValue {
  actionType: BulkActionType | '';
  assigneeId: string;
  priority: WorkItemPriority | '';
  milestoneId: string;
  dueDate: string;
  status: WorkItemStatus | '';
}

interface WorkItemFilterFormValue {
  search: string;
  status: string;
  assigneeId: string;
  reporterId: string;
  type: string;
  labelId: string;
  milestoneId: string;
  priority: string;
  dueDateState: string;
  dependency: string;
  sort: string;
}

const defaultFilterValues: WorkItemFilterFormValue = {
  search: '',
  status: '',
  assigneeId: '',
  reporterId: '',
  type: '',
  labelId: '',
  milestoneId: '',
  priority: '',
  dueDateState: '',
  dependency: '',
  sort: 'updated_desc'
};

@Component({
  selector: 'app-work-item-list-page',
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
        <button type="button" class="secondary-header-action" [disabled]="isCopyingViewLink()" (click)="copyViewLink()">
          {{ isCopyingViewLink() ? 'Copying...' : 'Copy link' }}
        </button>
        <button
          type="button"
          class="secondary-header-action"
          title="Export the applied project filters as CSV"
          aria-label="Export applied project filters as CSV"
          [disabled]="isExporting()"
          (click)="exportCsv()"
        >
          {{ isExporting() ? 'Exporting...' : 'Export CSV' }}
        </button>
        @if (!isArchivedProject()) {
          <a class="secondary-header-action" [routerLink]="['/projects', projectId(), 'work-items', 'import']">
            Import CSV
          </a>
          <a class="primary-action" [routerLink]="['/projects', projectId(), 'work-items', 'new']">
            Create work item
          </a>
        }
        @if (copyLinkStatus()) {
          <span class="copy-link-status" aria-live="polite">{{ copyLinkStatus() }}</span>
        }
      </nav>
    </section>

    @if (exportError()) {
      <p class="inline-error">{{ exportError() }}</p>
    }

    @if (isArchivedProject()) {
      <section class="notice" aria-label="Archived project">
        <strong>Archived project</strong>
        <p>Project work is read-only until it is reactivated in settings.</p>
      </section>
    }

    <app-pinned-saved-views
      heading="Project pinned views"
      [sharedViews]="pinnedSharedSavedViews()"
      [personalViews]="pinnedPersonalSavedViews()"
      (open)="openSavedView($event)"
    />

    <app-saved-views-toolbar
      [personalViews]="personalSavedViews()"
      [sharedViews]="sharedSavedViews()"
      [canManagePersonalViews]="canManageProjectSavedViews()"
      [canManageSharedViews]="canManageSharedProjectSavedViews()"
      [draftNames]="savedViewDraftNames()"
      [isLoading]="isSavedViewLoading()"
      [isSaving]="isSavingView()"
      [loadError]="savedViewLoadError()"
      [mutationError]="savedViewMutationError()"
      querySummaryScope="project"
      emptyMessage="Save the current filters to reuse this project view."
      sharedHelper="Owners and maintainers manage shared project views."
      readOnlyHelper="Archived project saved views are read-only."
      sharedSectionLabel="Shared project views"
      personalSectionLabel="Personal project views"
      sharedEmptyMessage="No shared project views saved."
      personalEmptyMessage="No personal project views saved."
      newViewPlaceholder="Release blockers"
      (savePersonal)="savePersonalProjectView($event)"
      (saveShared)="saveSharedProjectView($event)"
      (open)="openSavedView($event)"
      (rename)="renameSavedView($event)"
      (updateQuery)="updateSavedViewQuery($event)"
      (pinChange)="setSavedViewPinned($event.savedView, $event.isPinned)"
      (delete)="deleteSavedView($event)"
      (draftNameChange)="setSavedViewDraftName($event.savedViewId, $event.name)"
    />

    <app-work-item-filter-panel [formGroup]="filterForm" (apply)="applyFilters()">
      <label filterCore>
        <span>Search</span>
        <input type="search" formControlName="search" placeholder="Key, title, or description" />
      </label>

      <label filterCore>
        <span>Status</span>
        <select formControlName="status">
          <option value="">All statuses</option>
          @for (status of statuses; track status) {
            <option [value]="status">{{ formatToken(status) }}</option>
          }
        </select>
      </label>

      <label filterCore>
        <span>Assignee</span>
        <select formControlName="assigneeId">
          <option value="">Any assignee</option>
          @for (member of assigneeFilterMembers(); track member.id) {
            <option [value]="member.id">{{ memberDisplayName(member) }}</option>
          }
        </select>
      </label>

      <label filterCore>
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
            <option [value]="priority">{{ formatToken(priority) }}</option>
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
        <span>Dependency</span>
        <select formControlName="dependency">
          <option value="">Any dependency state</option>
          @for (option of dependencyOptions; track option.value) {
            <option [value]="option.value">{{ option.label }}</option>
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

      <div filterActions>
        <button type="button" class="secondary-action" (click)="clearFilters()">Clear</button>
      </div>
    </app-work-item-filter-panel>

    <app-active-filter-chips [labels]="activeFilterLabels()" (remove)="removeActiveFilter($event)" />

    @if (hasBulkSelection()) {
      <section class="bulk-action-bar" aria-label="Bulk work item actions">
        <div class="bulk-action-bar__summary">
          <strong>{{ selectedVisibleCount() }} selected</strong>
          <span>Apply one update to visible project work items.</span>
        </div>

        <form class="bulk-action-form" [formGroup]="bulkActionForm" (ngSubmit)="applyBulkAction()">
          <label>
            <span>Action</span>
            <select formControlName="actionType">
              <option value="">Choose action</option>
              @for (action of bulkActionOptions; track action.value) {
                <option [value]="action.value">{{ action.label }}</option>
              }
            </select>
          </label>

          @switch (bulkActionForm.controls.actionType.value) {
            @case ('set_assignee') {
              <label>
                <span>Assignee</span>
                <select formControlName="assigneeId">
                  <option value="">Choose member</option>
                  @for (member of activeMembers(); track member.id) {
                    <option [value]="member.id">{{ memberDisplayName(member) }}</option>
                  }
                </select>
              </label>
            }
            @case ('set_priority') {
              <label>
                <span>Priority</span>
                <select formControlName="priority">
                  <option value="">Choose priority</option>
                  @for (priority of priorities; track priority) {
                    <option [value]="priority">{{ formatToken(priority) }}</option>
                  }
                </select>
              </label>
            }
            @case ('set_milestone') {
              <label>
                <span>Milestone</span>
                <select formControlName="milestoneId">
                  <option value="">Choose milestone</option>
                  @for (milestone of activeMilestones(); track milestone.id) {
                    <option [value]="milestone.id">{{ milestone.name }}</option>
                  }
                </select>
              </label>
            }
            @case ('set_due_date') {
              <label>
                <span>Due date</span>
                <input type="date" formControlName="dueDate" />
              </label>
            }
            @case ('add_labels') {
              <fieldset class="bulk-labels">
                <legend>Labels</legend>
                @if (labels().length === 0) {
                  <p>No labels available in the current project work view.</p>
                } @else {
                  @for (label of labels(); track label.id) {
                    <label>
                      <input
                        type="checkbox"
                        [checked]="isBulkLabelSelected(label.id)"
                        (change)="toggleBulkLabel(label.id)"
                      />
                      <span class="label-pill" [style.border-color]="label.color ?? '#cbd5e1'">
                        {{ label.name }}
                      </span>
                    </label>
                  }
                }
              </fieldset>
            }
            @case ('remove_labels') {
              <fieldset class="bulk-labels">
                <legend>Labels</legend>
                @if (labels().length === 0) {
                  <p>No labels available in the current project work view.</p>
                } @else {
                  @for (label of labels(); track label.id) {
                    <label>
                      <input
                        type="checkbox"
                        [checked]="isBulkLabelSelected(label.id)"
                        (change)="toggleBulkLabel(label.id)"
                      />
                      <span class="label-pill" [style.border-color]="label.color ?? '#cbd5e1'">
                        {{ label.name }}
                      </span>
                    </label>
                  }
                }
              </fieldset>
            }
            @case ('transition_status') {
              <label>
                <span>Status</span>
                <select formControlName="status">
                  <option value="">Choose status</option>
                  @for (status of statuses; track status) {
                    <option [value]="status">{{ formatToken(status) }}</option>
                  }
                </select>
              </label>
            }
          }

          <div class="bulk-action-form__actions">
            <button type="submit" [disabled]="!canApplyBulkAction()">
              {{ isBulkUpdating() ? 'Applying...' : 'Apply' }}
            </button>
            <button type="button" class="secondary-action" [disabled]="isBulkUpdating()" (click)="clearSelection()">
              Clear selection
            </button>
          </div>
        </form>

        @if (bulkActionError()) {
          <p class="inline-error">{{ bulkActionError() }}</p>
        }

        @if (bulkActionResult(); as result) {
          <section class="bulk-result" aria-live="polite">
            <strong>
              {{ result.succeededCount }} updated · {{ result.unchangedCount }} unchanged ·
              {{ result.failedCount }} failed
            </strong>
            @if (result.failedCount > 0) {
              <ul>
                @for (failure of failedBulkResults(); track failure.workItemId) {
                  <li>
                    <span>{{ bulkResultLabel(failure) }}</span>
                    <small>{{ failure.error?.message ?? 'The work item could not be updated.' }}</small>
                  </li>
                }
              </ul>
            }
          </section>
        }
      </section>
    }

    <app-work-item-result-list
      [items]="workItems()"
      mode="project"
      [isLoading]="isLoading()"
      [error]="error()"
      [selectionEnabled]="canSelectWorkItems()"
      [selectedItemIds]="selectedWorkItemIds()"
      [allVisibleSelected]="isAllVisibleSelected()"
      loadingLabel="Loading work items"
      ariaLabel="Work items"
      [emptyTitle]="activeFilterLabels().length > 0 ? 'No work items match these filters' : 'No work items yet'"
      [emptyMessage]="activeFilterLabels().length > 0 ? 'Clear filters or adjust the criteria to broaden the list.' : 'Create the first work item for this project.'"
      [returnUrl]="detailReturnUrl()"
      (retry)="loadWorkItems()"
      (toggleSelection)="toggleWorkItemSelection($event)"
      (toggleAllVisibleSelection)="toggleAllVisibleSelection()"
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

    button:disabled {
      cursor: not-allowed;
      opacity: 0.65;
    }

    .inline-error {
      margin: 0 0 18px;
      color: #991b1b;
      font-size: 0.875rem;
      font-weight: 700;
      line-height: 1.5;
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

    .bulk-action-bar {
      display: grid;
      gap: 14px;
      margin-bottom: 16px;
      border: 1px solid #c7d2fe;
      border-radius: 8px;
      padding: 14px;
      background: #f8fbff;
    }

    .bulk-action-bar__summary {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: baseline;
    }

    .bulk-action-bar__summary strong {
      color: #111827;
      font-size: 0.95rem;
    }

    .bulk-action-bar__summary span {
      color: #475569;
      font-size: 0.8125rem;
      font-weight: 700;
    }

    .bulk-action-form {
      display: grid;
      grid-template-columns: minmax(180px, 0.9fr) minmax(220px, 1fr) auto;
      gap: 12px;
      align-items: end;
    }

    .bulk-action-form__actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }

    .bulk-labels {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      min-width: 0;
      margin: 0;
      border: 0;
      padding: 0;
    }

    .bulk-labels legend {
      width: 100%;
      margin-bottom: -2px;
      color: #334155;
      font-size: 0.75rem;
      font-weight: 800;
    }

    .bulk-labels label {
      display: inline-flex;
      grid-template-columns: none;
      gap: 6px;
      align-items: center;
      width: fit-content;
    }

    .bulk-labels input {
      width: 16px;
      min-height: 16px;
      height: 16px;
      margin: 0;
      padding: 0;
      accent-color: #1f4f99;
    }

    .bulk-labels p {
      margin: 0;
      color: #64748b;
      font-size: 0.8125rem;
      font-weight: 700;
    }

    .bulk-result {
      display: grid;
      gap: 8px;
      border-top: 1px solid #dbeafe;
      padding-top: 12px;
      color: #1f2937;
    }

    .bulk-result strong {
      font-size: 0.875rem;
    }

    .bulk-result ul {
      display: grid;
      gap: 6px;
      margin: 0;
      padding-left: 18px;
    }

    .bulk-result li {
      color: #991b1b;
      font-size: 0.8125rem;
      font-weight: 800;
      line-height: 1.45;
    }

    .bulk-result small {
      display: block;
      color: #7f1d1d;
      font-size: 0.78rem;
      font-weight: 700;
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
      grid-template-columns: minmax(280px, 2fr) minmax(110px, 0.8fr) minmax(140px, 1fr) minmax(150px, 1fr) minmax(100px, 0.7fr) minmax(120px, 0.8fr);
      gap: 14px;
      min-width: 980px;
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
    .milestone-pill,
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

    .milestone-pill {
      background: #f0fdf4;
      color: #166534;
      border-color: #bbf7d0;
    }

    .planning-cell {
      display: grid;
      gap: 4px;
      align-content: center;
    }

    .planning-cell small {
      color: #64748b;
      font-size: 0.75rem;
      font-weight: 700;
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

      .bulk-action-form {
        grid-template-columns: 1fr;
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
export class WorkItemListPageComponent implements OnDestroy, OnInit {
  private readonly api = inject(WorktrailApiService);
  private readonly clipboard = inject(ClipboardService);
  private readonly currentUser = inject(CurrentUserService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly subscriptions = new Subscription();
  private copyLinkStatusTimer: ReturnType<typeof setTimeout> | null = null;

  readonly statuses = statuses;
  readonly types = types;
  readonly priorities = priorities;
  readonly dueDateStates = dueDateStates;
  readonly dependencyOptions = dependencyOptions;
  readonly sorts = sorts;
  readonly bulkActionOptions = bulkActionOptions;
  readonly projectId = computed(() => this.route.snapshot.paramMap.get('projectId') ?? '');
  readonly members = computed<MemberDto[]>(() => this.currentUser.members());
  readonly activeMembers = computed<MemberDto[]>(() => this.currentUser.activeMembers());
  readonly assigneeFilterMembers = computed<MemberDto[]>(() =>
    this.membersForFilter(this.appliedFilterValues().assigneeId)
  );
  readonly reporterFilterMembers = computed<MemberDto[]>(() =>
    this.membersForFilter(this.appliedFilterValues().reporterId)
  );

  readonly project = signal<ProjectDto | null>(null);
  readonly workItems = signal<WorkItemListItemDto[]>([]);
  readonly selectedWorkItemIds = signal<string[]>([]);
  readonly selectedWorkItemIdSet = computed(() => new Set(this.selectedWorkItemIds()));
  readonly selectedWorkItems = computed<WorkItemListItemDto[]>(() =>
    this.workItems().filter((workItem) => this.selectedWorkItemIdSet().has(workItem.id))
  );
  readonly selectedVisibleCount = computed(() => this.selectedWorkItems().length);
  readonly hasBulkSelection = computed(() => this.canSelectWorkItems() && this.selectedVisibleCount() > 0);
  readonly isAllVisibleSelected = computed(() => {
    const workItems = this.workItems();
    const selectedIds = this.selectedWorkItemIdSet();

    return workItems.length > 0 && workItems.every((workItem) => selectedIds.has(workItem.id));
  });
  readonly labels = signal<LabelDto[]>([]);
  readonly milestones = signal<MilestoneDto[]>([]);
  readonly activeMilestones = computed<MilestoneDto[]>(() =>
    this.milestones().filter((milestone) => !milestone.isArchived && milestone.status !== 'completed')
  );
  readonly appliedFilterValues = signal<WorkItemFilterFormValue>({ ...defaultFilterValues });
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);
  readonly isCopyingViewLink = signal(false);
  readonly copyLinkStatus = signal<string | null>(null);
  readonly isExporting = signal(false);
  readonly exportError = signal<string | null>(null);
  readonly isArchivedProject = computed(() => this.project()?.status === 'archived');
  readonly savedViews = signal<SavedWorkViewDto[]>([]);
  readonly personalSavedViews = computed<SavedWorkViewDto[]>(() =>
    this.sortSavedViews(this.savedViews().filter((savedView) => savedView.visibility === 'personal'))
  );
  readonly sharedSavedViews = computed<SavedWorkViewDto[]>(() =>
    this.sortSavedViews(this.savedViews().filter((savedView) => savedView.visibility === 'workspace'))
  );
  readonly pinnedPersonalSavedViews = computed<SavedWorkViewDto[]>(() =>
    this.personalSavedViews().filter((savedView) => savedView.isPinned)
  );
  readonly pinnedSharedSavedViews = computed<SavedWorkViewDto[]>(() =>
    this.sharedSavedViews().filter((savedView) => savedView.isPinned)
  );
  readonly canManageProjectSavedViews = computed(() => !this.isArchivedProject());
  readonly canManageSharedProjectSavedViews = computed(() => {
    const role = this.currentUser.selectedMember()?.role;
    return this.canManageProjectSavedViews() && (role === 'owner' || role === 'maintainer');
  });
  readonly canSelectWorkItems = computed(() => {
    const role = this.currentUser.selectedMember()?.role;
    return !this.isArchivedProject() && (role === 'owner' || role === 'maintainer');
  });
  readonly savedViewDraftNames = signal<Record<string, string>>({});
  readonly isSavedViewLoading = signal(false);
  readonly savedViewLoadError = signal<string | null>(null);
  readonly isSavingView = signal(false);
  readonly savedViewMutationError = signal<string | null>(null);
  readonly selectedBulkLabelIds = signal<string[]>([]);
  readonly isBulkUpdating = signal(false);
  readonly bulkActionError = signal<string | null>(null);
  readonly bulkActionResult = signal<BulkUpdateWorkItemsResponseDto | null>(null);
  readonly failedBulkResults = computed(() =>
    this.bulkActionResult()?.results.filter((result) => result.status === 'failed') ?? []
  );

  readonly filterForm = this.formBuilder.nonNullable.group({
    search: [''],
    status: [''],
    assigneeId: [''],
    reporterId: [''],
    type: [''],
    labelId: [''],
    milestoneId: [''],
    priority: [''],
    dueDateState: [''],
    dependency: [''],
    sort: ['updated_desc']
  });

  readonly bulkActionForm = this.formBuilder.nonNullable.group({
    actionType: ['' as BulkActionType | ''],
    assigneeId: [''],
    priority: ['' as WorkItemPriority | ''],
    milestoneId: [''],
    dueDate: [''],
    status: ['' as WorkItemStatus | '']
  });

  ngOnInit(): void {
    if (this.currentUser.members().length === 0) {
      this.currentUser.loadMembers();
    }

    this.loadProject();
    this.loadMilestones();
    this.loadSavedViews();
    this.watchFilterChanges();

    this.subscriptions.add(
      this.route.queryParamMap.subscribe((params) => {
        const nextFilters = projectFormValueFromQueryParams(params);

        this.clearSelection();
        this.appliedFilterValues.set(nextFilters);
        this.filterForm.patchValue(nextFilters, { emitEvent: false });
        this.loadWorkItems();
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.clearCopyLinkStatusTimer();
  }

  applyFilters(): void {
    this.clearSelection();
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: this.queryParamsFromForm()
    });
  }

  clearFilters(): void {
    this.filterForm.reset({ ...defaultFilterValues });
    this.applyFilters();
  }

  loadWorkItems(): void {
    this.isLoading.set(true);
    this.error.set(null);

    this.api.listWorkItems(this.projectId(), this.appliedQuery()).subscribe({
      next: (workItems) => {
        this.workItems.set(workItems);
        this.pruneSelectionToVisibleRows();
        this.mergeLabels(workItems);
        this.isLoading.set(false);
      },
      error: () => {
        this.error.set('Work items could not be loaded from the API.');
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

    this.api.exportProjectWorkItems(this.projectId(), this.appliedQuery()).subscribe({
      next: (response) => {
        const fileName = fileNameFromContentDisposition(
          response.headers.get('content-disposition'),
          'worktrail-project-work-items.csv'
        );

        downloadBlob({
          blob: response.body ?? new Blob([''], { type: 'text/csv' }),
          fileName
        });
        this.isExporting.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.exportError.set(this.toExportErrorMessage(error));
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

  loadProject(): void {
    this.api.getProject(this.projectId()).subscribe({
      next: (project) => {
        this.project.set(project);
        if (project.status === 'archived') {
          this.clearSelection();
        }
      },
      error: () => {
        this.project.set(null);
      }
    });
  }

  loadMilestones(): void {
    this.api.listProjectMilestones(this.projectId(), { includeArchived: true }).subscribe({
      next: (milestones) => {
        this.milestones.set(this.sortMilestones(milestones));
      },
      error: () => {
        this.milestones.set([]);
      }
    });
  }

  loadSavedViews(): void {
    this.isSavedViewLoading.set(true);
    this.savedViewLoadError.set(null);

    this.api.listSavedWorkViews({ scope: 'project', projectId: this.projectId() }).subscribe({
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

  formatToken(value: string): string {
    return value.replaceAll('_', ' ');
  }

  formatDate(value: string): string {
    return new Intl.DateTimeFormat('en', {
      month: 'short',
      day: 'numeric'
    }).format(new Date(value));
  }

  formatDateOnly(value: string): string {
    const [year, month, day] = value.split('-').map(Number);
    return new Intl.DateTimeFormat('en', {
      month: 'short',
      day: 'numeric'
    }).format(new Date(year, month - 1, day));
  }

  activeFilterLabels(): string[] {
    return this.getActiveFilterLabels();
  }

  savePersonalProjectView(name: string): void {
    this.createSavedView('personal', name);
  }

  saveSharedProjectView(name: string): void {
    this.createSavedView('workspace', name);
  }

  openSavedView(savedView: SavedWorkViewDto): void {
    this.clearSelection();
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: projectRouterQueryParamsFromQuery(savedView.query)
    });
  }

  toggleWorkItemSelection(workItemId: string): void {
    if (!this.canSelectWorkItems()) {
      return;
    }

    const selectedIds = new Set(this.selectedWorkItemIds());

    if (selectedIds.has(workItemId)) {
      selectedIds.delete(workItemId);
    } else {
      selectedIds.add(workItemId);
    }

    this.selectedWorkItemIds.set([...selectedIds]);
    this.clearBulkFeedback();
  }

  toggleAllVisibleSelection(): void {
    if (!this.canSelectWorkItems()) {
      return;
    }

    const visibleIds = new Set(this.workItems().map((workItem) => workItem.id));

    if (visibleIds.size === 0) {
      this.clearSelection();
      return;
    }

    if (this.isAllVisibleSelected()) {
      this.selectedWorkItemIds.set(this.selectedWorkItemIds().filter((workItemId) => !visibleIds.has(workItemId)));
      this.clearBulkFeedback();
      return;
    }

    this.selectedWorkItemIds.set([...new Set([...this.selectedWorkItemIds(), ...visibleIds])]);
    this.clearBulkFeedback();
  }

  clearSelection(): void {
    this.selectedWorkItemIds.set([]);
    this.resetBulkActionState();
  }

  isBulkLabelSelected(labelId: string): boolean {
    return this.selectedBulkLabelIds().includes(labelId);
  }

  toggleBulkLabel(labelId: string): void {
    const selectedIds = new Set(this.selectedBulkLabelIds());

    if (selectedIds.has(labelId)) {
      selectedIds.delete(labelId);
    } else {
      selectedIds.add(labelId);
    }

    this.selectedBulkLabelIds.set([...selectedIds]);
    this.bulkActionError.set(null);
  }

  canApplyBulkAction(): boolean {
    return !this.isBulkUpdating() && this.toBulkUpdateRequest() !== null;
  }

  applyBulkAction(): void {
    const request = this.toBulkUpdateRequest();

    if (request === null) {
      this.bulkActionError.set('Choose a bulk action and required value.');
      return;
    }

    if (
      request.action.type === 'transition_status' &&
      request.workItemIds.length > 1 &&
      !window.confirm(`Transition ${request.workItemIds.length} selected work items?`)
    ) {
      return;
    }

    this.isBulkUpdating.set(true);
    this.bulkActionError.set(null);
    this.bulkActionResult.set(null);

    this.api.bulkUpdateProjectWorkItems(this.projectId(), request).subscribe({
      next: (result) => {
        this.bulkActionResult.set(result);
        this.selectedWorkItemIds.set(
          result.results
            .filter((itemResult) => itemResult.status === 'failed')
            .map((itemResult) => itemResult.workItemId)
        );
        this.isBulkUpdating.set(false);
        this.loadWorkItems();
      },
      error: (error: HttpErrorResponse) => {
        this.bulkActionError.set(
          this.toErrorMessage(error, 'Selected work items could not be updated.')
        );
        this.isBulkUpdating.set(false);
      }
    });
  }

  bulkResultLabel(result: BulkUpdateWorkItemsResultDto): string {
    return result.displayKey ?? `Work item ${result.workItemId}`;
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

  savedViewDraftName(savedViewId: string): string {
    return this.savedViewDraftNames()[savedViewId] ?? '';
  }

  setSavedViewDraftName(savedViewId: string, name: string): void {
    this.savedViewDraftNames.set({
      ...this.savedViewDraftNames(),
      [savedViewId]: name
    });
  }

  detailReturnUrl(): string {
    return returnUrlFromWorkItemQuery(
      `/projects/${this.projectId()}/work-items`,
      this.appliedQuery(),
      'project'
    );
  }

  removeActiveFilter(label: string): void {
    const filterName = label.split(':', 1)[0];
    const updates: Partial<WorkItemFilterFormValue> = {};

    if (filterName === 'Search') {
      updates.search = '';
    } else if (filterName === 'Status') {
      updates.status = '';
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
    } else if (filterName === 'Dependency') {
      updates.dependency = '';
    } else if (filterName === 'Sort') {
      updates.sort = 'updated_desc';
    }

    this.filterForm.patchValue(updates, { emitEvent: false });
    this.applyFilters();
  }

  memberDisplayName(member: MemberDto): string {
    return member.isActive ? member.name : `${member.name} (inactive)`;
  }

  private appliedQuery(): WorkItemQuery {
    return projectQueryFromFormValue(this.appliedFilterValues());
  }

  private createSavedView(visibility: SavedWorkViewDto['visibility'], name: string): void {
    const trimmedName = name.trim();

    if (trimmedName === '') {
      this.savedViewMutationError.set('Saved view name is required.');
      return;
    }

    if (!this.canManageProjectSavedViews()) {
      this.savedViewMutationError.set('Archived projects are read-only.');
      return;
    }

    if (visibility === 'workspace' && !this.canManageSharedProjectSavedViews()) {
      this.savedViewMutationError.set('Only owners and maintainers can manage shared saved views.');
      return;
    }

    this.isSavingView.set(true);
    this.savedViewMutationError.set(null);

    this.api
      .createSavedWorkView({
        name: trimmedName,
        scope: 'project',
        projectId: this.projectId(),
        query: this.appliedQuery(),
        ...(visibility === 'workspace' ? { visibility } : {})
      })
      .subscribe({
        next: (savedView) => {
          this.savedViews.set(this.sortSavedViews([...this.savedViews(), savedView]));
          this.syncSavedViewDraftNames(this.savedViews());
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

  private canMutateSavedView(savedView: SavedWorkViewDto): boolean {
    if (!this.canManageProjectSavedViews()) {
      this.savedViewMutationError.set('Archived projects are read-only.');
      return false;
    }

    if (savedView.visibility === 'personal' || this.canManageSharedProjectSavedViews()) {
      return true;
    }

    this.savedViewMutationError.set('Only owners and maintainers can manage shared saved views.');
    return false;
  }

  private currentFilteredViewUrl(): string {
    return new URL(
      returnUrlFromWorkItemQuery(
        `/projects/${this.projectId()}/work-items`,
        this.appliedQuery(),
        'project'
      ),
      window.location.origin
    ).toString();
  }

  private queryParamsFromForm(): Record<string, string | null> {
    return projectRouterQueryParamsFromQuery(projectQueryFromFormValue(this.filterForm.getRawValue()));
  }

  private watchFilterChanges(): void {
    this.subscriptions.add(
      this.filterForm.controls.search.valueChanges
        .pipe(debounceTime(400), distinctUntilChanged())
        .subscribe(() => this.applyFilters())
    );

    const controls = [
      this.filterForm.controls.status,
      this.filterForm.controls.assigneeId,
      this.filterForm.controls.reporterId,
      this.filterForm.controls.type,
      this.filterForm.controls.labelId,
      this.filterForm.controls.milestoneId,
      this.filterForm.controls.priority,
      this.filterForm.controls.dueDateState,
      this.filterForm.controls.dependency,
      this.filterForm.controls.sort
    ];

    for (const control of controls) {
      this.subscriptions.add(
        control.valueChanges.pipe(distinctUntilChanged()).subscribe(() => this.applyFilters())
      );
    }

    this.subscriptions.add(
      this.bulkActionForm.controls.actionType.valueChanges
        .pipe(distinctUntilChanged())
        .subscribe(() => {
          this.selectedBulkLabelIds.set([]);
          this.clearBulkFeedback();
        })
    );
  }

  private toBulkUpdateRequest(): BulkUpdateWorkItemsRequest | null {
    if (!this.hasBulkSelection()) {
      return null;
    }

    const action = this.toBulkAction(this.bulkActionForm.getRawValue());

    if (action === null) {
      return null;
    }

    return {
      workItemIds: this.selectedWorkItemIds(),
      action
    };
  }

  private toBulkAction(formValue: BulkActionFormValue): BulkUpdateWorkItemsAction | null {
    switch (formValue.actionType) {
      case 'set_assignee':
        return formValue.assigneeId === ''
          ? null
          : { type: 'set_assignee', assigneeId: formValue.assigneeId };
      case 'clear_assignee':
        return { type: 'clear_assignee' };
      case 'set_priority':
        return formValue.priority === ''
          ? null
          : { type: 'set_priority', priority: formValue.priority };
      case 'set_milestone':
        return formValue.milestoneId === ''
          ? null
          : { type: 'set_milestone', milestoneId: formValue.milestoneId };
      case 'clear_milestone':
        return { type: 'clear_milestone' };
      case 'set_due_date':
        return formValue.dueDate === '' ? null : { type: 'set_due_date', dueDate: formValue.dueDate };
      case 'clear_due_date':
        return { type: 'clear_due_date' };
      case 'add_labels':
        return this.selectedBulkLabelIds().length === 0
          ? null
          : { type: 'add_labels', labelIds: this.selectedBulkLabelIds() };
      case 'remove_labels':
        return this.selectedBulkLabelIds().length === 0
          ? null
          : { type: 'remove_labels', labelIds: this.selectedBulkLabelIds() };
      case 'transition_status':
        return formValue.status === '' ? null : { type: 'transition_status', status: formValue.status };
      default:
        return null;
    }
  }

  private clearBulkFeedback(): void {
    this.bulkActionError.set(null);
    this.bulkActionResult.set(null);
  }

  private resetBulkActionState(): void {
    this.selectedBulkLabelIds.set([]);
    this.bulkActionError.set(null);
    this.bulkActionResult.set(null);
  }

  private pruneSelectionToVisibleRows(): void {
    const visibleIds = new Set(this.workItems().map((workItem) => workItem.id));
    this.selectedWorkItemIds.set(this.selectedWorkItemIds().filter((workItemId) => visibleIds.has(workItemId)));
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

  private sortMilestones(milestones: MilestoneDto[]): MilestoneDto[] {
    return [...milestones].sort((left, right) => {
      if (left.isArchived !== right.isArchived) {
        return left.isArchived ? 1 : -1;
      }

      return left.name.localeCompare(right.name);
    });
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

  private getActiveFilterLabels(): string[] {
    const formValue = this.appliedFilterValues();
    const labels: string[] = [];

    if (formValue.search.trim() !== '') {
      labels.push(`Search: ${formValue.search.trim()}`);
    }

    this.pushLookupLabel(labels, 'Status', formValue.status, (value) => this.formatToken(value));
    this.pushLookupLabel(labels, 'Assignee', formValue.assigneeId, (value) => this.memberName(value));
    this.pushLookupLabel(labels, 'Reporter', formValue.reporterId, (value) => this.memberName(value));
    this.pushLookupLabel(labels, 'Type', formValue.type, (value) => this.formatToken(value));
    this.pushLookupLabel(labels, 'Label', formValue.labelId, (value) => this.labelName(value));
    this.pushLookupLabel(labels, 'Milestone', formValue.milestoneId, (value) => this.milestoneName(value));
    this.pushLookupLabel(labels, 'Priority', formValue.priority, (value) => this.formatToken(value));
    this.pushLookupLabel(labels, 'Due date', formValue.dueDateState, (value) => this.dueDateStateLabel(value));
    this.pushLookupLabel(labels, 'Dependency', formValue.dependency, (value) =>
      this.dependencyLabel(value)
    );

    if (formValue.sort !== 'updated_desc') {
      labels.push(`Sort: ${this.sortLabel(formValue.sort)}`);
    }

    return labels;
  }

  private pushLookupLabel(
    labels: string[],
    name: string,
    value: string,
    formatter: (value: string) => string
  ): void {
    const trimmed = value.trim();

    if (trimmed !== '') {
      labels.push(`${name}: ${formatter(trimmed)}`);
    }
  }

  private memberName(memberId: string): string {
    const member = this.members().find((item) => item.id === memberId);
    return member === undefined ? memberId : this.memberDisplayName(member);
  }

  private membersForFilter(selectedMemberId: string): MemberDto[] {
    const membersById = new Map(this.activeMembers().map((member) => [member.id, member]));
    const selectedMember = this.members().find((member) => member.id === selectedMemberId);

    if (selectedMember !== undefined) {
      membersById.set(selectedMember.id, selectedMember);
    }

    return [...membersById.values()].sort((left, right) => {
      if (left.isActive !== right.isActive) {
        return left.isActive ? -1 : 1;
      }

      return left.name.localeCompare(right.name);
    });
  }

  private labelName(labelId: string): string {
    return this.labels().find((label) => label.id === labelId)?.name ?? labelId;
  }

  private milestoneName(milestoneId: string): string {
    return this.milestones().find((milestone) => milestone.id === milestoneId)?.name ?? milestoneId;
  }

  private dueDateStateLabel(value: string): string {
    return dueDateStates.find((state) => state.value === value)?.label ?? value;
  }

  private sortLabel(value: string): string {
    return sorts.find((sort) => sort.value === value)?.label ?? value;
  }

  private dependencyLabel(value: string): string {
    return dependencyOptions.some((option) => option.value === value)
      ? dependencyFilterLabel(value as DependencyFilter)
      : value;
  }

  private toErrorMessage(error: HttpErrorResponse, fallback: string): string {
    const message = (error.error as { error?: { message?: unknown } } | null)?.error?.message;

    return typeof message === 'string' ? message : fallback;
  }

  private toExportErrorMessage(error: HttpErrorResponse): string {
    const message = error.error?.error?.message;

    return typeof message === 'string' && message.trim() !== ''
      ? message
      : 'CSV export could not be downloaded.';
  }
}
