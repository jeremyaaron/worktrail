import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import type {
  CreateProjectCycleRequest,
  CreatableProjectCycleStatus,
  DeliveryHealthReasonDto,
  DeliveryHealthState,
  MilestoneDto,
  MilestoneProgressDto,
  MilestoneStatus,
  MutableProjectCycleStatus,
  PlanningRiskItemDto,
  PlanningReviewItemDto,
  ProjectCycleDto,
  ProjectCycleStatus,
  ProjectDto,
  ProjectPlanningSummaryDto,
  WorkItemStatus
} from '@worktrail/contracts';

import { CyclesApi } from '../../core/api/cycles-api';
import { CurrentUserService } from '../../core/current-user.service';
import { WorktrailApiService } from '../../core/worktrail-api.service';
import {
  deliveryHealthLabel,
  deliveryHealthReasonLabel,
  deliveryHealthReasonQueryParams,
  deliveryHealthSeverityTone,
  deliveryHealthTone,
  workItemQueryToRouterQueryParams
} from '../../shared/delivery-health/delivery-health-display';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { ErrorPanelComponent } from '../../shared/ui/error-panel.component';
import { LoadingIndicatorComponent } from '../../shared/ui/loading-indicator.component';
import {
  CycleManagerComponent,
  type CycleUpdateRequest
} from './planning/cycle-manager.component';
import { CycleSummaryPanelComponent } from './planning/cycle-summary-panel.component';
import { MilestoneManagerComponent } from './planning/milestone-manager.component';
import { PlanningReviewComponent } from './planning/planning-review.component';

const milestoneStatuses: MilestoneStatus[] = ['planned', 'active', 'completed', 'canceled'];
const creatableCycleStatuses: CreatableProjectCycleStatus[] = ['planned', 'active'];
const mutableCycleStatuses: MutableProjectCycleStatus[] = ['planned', 'active', 'canceled'];
const statusOrder = new Map<MilestoneStatus, number>(
  milestoneStatuses.map((status, index) => [status, index])
);
const cycleStatusOrder = new Map<ProjectCycleStatus, number>([
  ['active', 0],
  ['planned', 1],
  ['completed', 2],
  ['canceled', 3]
]);
const workItemStatusLabels: Record<WorkItemStatus, string> = {
  backlog: 'Backlog',
  ready: 'Ready',
  in_progress: 'In progress',
  blocked: 'Blocked',
  done: 'Done',
  canceled: 'Canceled'
};
type PlanningView = 'review' | 'cycles' | 'milestones';
const planningViews: { value: PlanningView; label: string }[] = [
  { value: 'review', label: 'Review' },
  { value: 'cycles', label: 'Cycles' },
  { value: 'milestones', label: 'Milestones' }
];
const visibleRiskItemLimit = 4;

interface PlanningRiskSection {
  title: string;
  description: string;
  items: PlanningRiskItemDto[];
  emptyTitle: string;
  emptyMessage: string;
  queryParams?: Record<string, string>;
}

interface PlanningReviewSection {
  title: string;
  description: string;
  items: PlanningReviewItemDto[];
  emptyTitle: string;
  emptyMessage: string;
}

@Component({
  selector: 'app-project-planning-page',
  imports: [
    EmptyStateComponent,
    ErrorPanelComponent,
    CycleManagerComponent,
    CycleSummaryPanelComponent,
    LoadingIndicatorComponent,
    MilestoneManagerComponent,
    PlanningReviewComponent,
    ReactiveFormsModule,
    RouterLink
  ],
  template: `
    <section class="page-header">
      <div>
        <p class="eyebrow">Planning · Live view</p>
        <h1>{{ project()?.name ?? 'Project planning' }}</h1>
        @if (project(); as project) {
          <p>
            <span class="key-pill">{{ project.key }}</span>
            <span [class.status-pill--archived]="project.status === 'archived'" class="status-pill">
              {{ project.status }}
            </span>
          </p>
        }
      </div>
    </section>

    @if (isLoadingProject()) {
      <app-loading-indicator label="Loading planning" />
    } @else if (projectLoadError()) {
      <app-error-panel [message]="projectLoadError() ?? ''" (retry)="loadProject()" />
    } @else if (project(); as project) {
      @if (project.status === 'archived') {
        <section class="notice" aria-label="Archived project">
          <strong>Archived project</strong>
          <p>Milestones remain readable. Reactivate the project before changing planning data.</p>
        </section>
      } @else if (!canManageMilestones()) {
        <section class="notice" aria-label="Read-only planning">
          <strong>Read-only planning</strong>
          <p>Owners and maintainers can change cycles and milestones. Contributors can review them here.</p>
        </section>
      }

      <section class="planning-report-bridge" aria-labelledby="planning-report-bridge-heading">
        <div>
          <p class="eyebrow">Live view to published snapshots</p>
          <h2 id="planning-report-bridge-heading">Turn current planning evidence into a report</h2>
          <p>
            Planning reflects the current project state. Reports preserve a published snapshot for
            stakeholders, exports, and later comparison.
          </p>
        </div>
        <nav class="planning-report-bridge__actions" aria-label="Planning report links">
          <a [routerLink]="['/projects', projectId(), 'status']">View reports</a>
          @if (canCreateReport()) {
            <a [routerLink]="['/projects', projectId(), 'status', 'new']">Draft report</a>
          }
        </nav>
      </section>

      <div class="planning-view-control" aria-label="Planning view">
        @for (view of planningViews; track view.value) {
          <button
            type="button"
            [attr.aria-pressed]="selectedPlanningView() === view.value"
            (click)="setPlanningView(view.value)"
          >
            {{ view.label }}
          </button>
        }
      </div>

      <section class="planning-grid" aria-label="Planning sections">
        @if (selectedPlanningView() === 'cycles') {
          <app-cycle-manager
            [projectId]="projectId()"
            [cycleForm]="cycleForm"
            [cycles]="cycles()"
            [creatableCycleStatuses]="creatableCycleStatuses"
            [mutableCycleStatuses]="mutableCycleStatuses"
            [canManageCycles]="canManageCycles()"
            [isLoadingCycles]="isLoadingCycles()"
            [isCreatingCycle]="isCreatingCycle()"
            [hasSubmittedCycleCreate]="hasSubmittedCycleCreate()"
            [mutatingCycleId]="mutatingCycleId()"
            [cycleLoadError]="cycleLoadError()"
            [cycleCreateError]="cycleCreateError()"
            [cycleMutationError]="cycleMutationError()"
            [cycleSuccessMessage]="cycleSuccessMessage()"
            (create)="createCycle()"
            (retryLoad)="loadCycles()"
            (update)="updateCycleFromRequest($event)"
            (archive)="archiveCycle($event)"
            (reactivate)="reactivateCycle($event)"
          />
        } @else if (selectedPlanningView() === 'milestones') {
          <app-milestone-manager>
        <section class="panel milestone-panel" aria-labelledby="milestones-heading">
          <div class="panel-heading">
            <div>
              <h2 id="milestones-heading">Milestones</h2>
              <p>Plan named delivery targets for this project.</p>
            </div>
            <span>{{ milestones().length }} total</span>
          </div>

          @if (canManageMilestones()) {
            <form class="milestone-form" [formGroup]="milestoneForm" (ngSubmit)="createMilestone()" novalidate>
              <label for="milestone-name">Name</label>
              <input
                id="milestone-name"
                type="text"
                formControlName="name"
                autocomplete="off"
                [attr.aria-invalid]="showMilestoneNameError()"
                aria-describedby="milestone-name-error"
              />
              @if (showMilestoneNameError()) {
                <p id="milestone-name-error" class="field-error">Milestone name is required.</p>
              }

              <label for="milestone-description">Description</label>
              <textarea id="milestone-description" rows="3" formControlName="description"></textarea>

              <div class="milestone-form__grid">
                <label>
                  <span>Status</span>
                  <select formControlName="status">
                    @for (status of milestoneStatuses; track status) {
                      <option [value]="status">{{ formatToken(status) }}</option>
                    }
                  </select>
                </label>

                <label>
                  <span>Target date</span>
                  <input type="date" formControlName="targetDate" />
                </label>
              </div>

              @if (successMessage()) {
                <p class="success-message">{{ successMessage() }}</p>
              }

              <button type="submit" [disabled]="isCreatingMilestone()">
                {{ isCreatingMilestone() ? 'Creating...' : 'Create milestone' }}
              </button>
            </form>
          }

          @if (createError()) {
            <p class="field-error">{{ createError() }}</p>
          }

          @if (milestoneMutationError()) {
            <app-error-panel
              title="Milestone change failed"
              [message]="milestoneMutationError() ?? ''"
              (retry)="loadMilestones()"
            />
          }

          @if (isLoadingMilestones()) {
            <app-loading-indicator label="Loading milestones" />
          } @else if (milestoneLoadError()) {
            <app-error-panel [message]="milestoneLoadError() ?? ''" (retry)="loadMilestones()" />
          } @else if (milestones().length === 0) {
            <app-empty-state
              title="No milestones yet"
              message="Create a milestone to start grouping delivery targets."
            />
          } @else {
            <div class="milestone-list" aria-label="Project milestones">
              @for (milestone of milestones(); track milestone.id) {
                <article
                  class="milestone-row"
                  [class.milestone-row--archived]="milestone.isArchived"
                >
                  <div class="milestone-row__title">
                    <h3>{{ milestone.name }}</h3>
                    <p>{{ milestone.description || 'No description provided.' }}</p>
                  </div>

                  <div class="milestone-row__meta">
                    <span class="status-pill" [class.status-pill--archived]="milestone.isArchived">
                      {{ milestone.isArchived ? 'archived' : formatToken(milestone.status) }}
                    </span>
                    <span>{{ milestone.targetDate === null ? 'No target date' : formatDate(milestone.targetDate) }}</span>
                    <span>Updated {{ formatDateTime(milestone.updatedAt) }}</span>
                  </div>

                  @if (canManageMilestones()) {
                    <div class="milestone-row__fields">
                      <label>
                        <span>Name</span>
                        <input
                          #milestoneName
                          type="text"
                          [value]="milestone.name"
                          [disabled]="isMutating(milestone)"
                        />
                      </label>

                      <label>
                        <span>Description</span>
                        <textarea
                          #milestoneDescription
                          rows="2"
                          [disabled]="isMutating(milestone)"
                        >{{ milestone.description }}</textarea>
                      </label>

                      <label>
                        <span>Status</span>
                        <select
                          #milestoneStatus
                          [value]="milestone.status"
                          [disabled]="isMutating(milestone)"
                        >
                          @for (status of milestoneStatuses; track status) {
                            <option [value]="status">{{ formatToken(status) }}</option>
                          }
                        </select>
                      </label>

                      <label>
                        <span>Target date</span>
                        <input
                          #milestoneTargetDate
                          type="date"
                          [value]="milestone.targetDate ?? ''"
                          [disabled]="isMutating(milestone)"
                        />
                      </label>
                    </div>

                    <div class="milestone-actions">
                      <button
                        type="button"
                        [disabled]="isMutating(milestone)"
                        (click)="updateMilestone(
                          milestone,
                          milestoneName.value,
                          milestoneDescription.value,
                          milestoneStatus.value,
                          milestoneTargetDate.value
                        )"
                      >
                        {{ isMutating(milestone) ? 'Saving...' : 'Save' }}
                      </button>

                      @if (milestone.isArchived) {
                        <button
                          type="button"
                          [disabled]="isMutating(milestone)"
                          (click)="reactivateMilestone(milestone)"
                        >
                          Reactivate
                        </button>
                      } @else {
                        <button
                          type="button"
                          class="danger-button"
                          [disabled]="isMutating(milestone)"
                          (click)="archiveMilestone(milestone)"
                        >
                          Archive
                        </button>
                      }
                    </div>
                  }
                </article>
              }
            </div>
          }
        </section>
          </app-milestone-manager>
        } @else {
          <app-planning-review>

        <section class="panel summary-panel" aria-labelledby="planning-summary-heading">
          <div class="panel-heading">
            <div>
              <h2 id="planning-summary-heading">Planning dashboard</h2>
              <p>Review progress, due dates, dependencies, ownership gaps, and stale active work.</p>
            </div>
            @if (planningSummary(); as summary) {
              <span>{{ totalRiskCount(summary) }} risks</span>
            }
          </div>

          @if (isLoadingSummary()) {
            <app-loading-indicator label="Loading planning dashboard" />
          } @else if (planningSummaryLoadError()) {
            <app-error-panel
              [message]="planningSummaryLoadError() ?? ''"
              (retry)="loadPlanningSummary()"
            />
          } @else if (planningSummary(); as summary) {
            <section class="dashboard-section health-summary" aria-labelledby="delivery-health-heading">
              <div class="health-summary__heading">
                <div>
                  <p class="section-eyebrow">Delivery health</p>
                  <h3 id="delivery-health-heading">{{ healthLabel(summary.deliveryHealth.health) }}</h3>
                </div>
                <span class="health-pill" [attr.data-tone]="healthTone(summary.deliveryHealth.health)">
                  {{ healthLabel(summary.deliveryHealth.health) }}
                </span>
              </div>

              <dl class="health-counts" aria-label="Delivery health counts">
                <div>
                  <dt>Active</dt>
                  <dd>{{ summary.deliveryHealth.activeMilestoneCount }}</dd>
                </div>
                <div>
                  <dt>On track</dt>
                  <dd>{{ summary.deliveryHealth.healthyMilestoneCount }}</dd>
                </div>
                <div>
                  <dt>At risk</dt>
                  <dd>{{ summary.deliveryHealth.atRiskMilestoneCount }}</dd>
                </div>
                <div>
                  <dt>Blocked</dt>
                  <dd>{{ summary.deliveryHealth.blockedMilestoneCount }}</dd>
                </div>
                <div>
                  <dt>Open work</dt>
                  <dd>{{ summary.deliveryHealth.openWorkCount }}</dd>
                </div>
              </dl>

              @if (summary.deliveryHealth.reasons.length === 0) {
                <div class="compact-empty">
                  <strong>No delivery risks found</strong>
                  <span>Current project work has no surfaced delivery-health reasons.</span>
                </div>
              } @else {
                <div class="reason-list" aria-label="Delivery health reasons">
                  @for (reason of topReasons(summary.deliveryHealth.reasons); track reason.key + reason.message) {
                    @if (reasonQueryParams(reason); as queryParams) {
                      <a
                        class="reason-chip"
                        [attr.data-tone]="severityTone(reason.severity)"
                        [routerLink]="['/projects', projectId(), 'work-items']"
                        [queryParams]="queryParams"
                      >
                        {{ reasonLabel(reason) }}
                      </a>
                    } @else {
                      <span class="reason-chip" [attr.data-tone]="severityTone(reason.severity)">
                        {{ reasonLabel(reason) }}
                      </span>
                    }
                  }
                </div>
              }
            </section>

            <app-cycle-summary-panel [projectId]="projectId()" [summary]="summary" />

            <section class="dashboard-section" aria-labelledby="milestone-progress-heading">
              <div class="section-heading">
                <h3 id="milestone-progress-heading">Milestone progress</h3>
                <span>{{ summary.milestoneProgress.length }} active</span>
              </div>

              @if (summary.milestoneProgress.length === 0) {
                <div class="compact-empty">
                  <strong>No active milestones</strong>
                  <span>Planned and active milestones will appear here once created.</span>
                </div>
              } @else {
                <div class="progress-list">
                  @for (progress of summary.milestoneProgress; track progress.milestone.id) {
                    <article
                      class="progress-row"
                    >
                      <span class="progress-row__heading">
                        <a
                          class="progress-row__heading-link"
                          [routerLink]="['/projects', projectId(), 'milestones', progress.milestone.id]"
                        >
                          {{ progress.milestone.name }}
                        </a>
                        <a
                          class="progress-row__work-link reason-chip"
                          [routerLink]="['/projects', projectId(), 'work-items']"
                          [queryParams]="{ milestoneId: progress.milestone.id, sort: 'due_date_asc' }"
                        >
                          Open work
                        </a>
                        <span class="health-pill" [attr.data-tone]="healthTone(progress.health)">
                          {{ healthLabel(progress.health) }}
                        </span>
                        <small>
                          {{ progress.doneCount }} of {{ progress.totalCount }} done
                        </small>
                      </span>
                      <span class="progress-bar" aria-hidden="true">
                        <span [style.width.%]="milestonePercent(progress)"></span>
                      </span>
                      <span class="progress-row__counts">
                        <span>{{ progress.blockedCount }} blocked</span>
                        <span>{{ progress.overdueCount }} overdue</span>
                      </span>
                      @if (progress.reasons.length > 0) {
                        <span class="progress-reasons">
                          @for (reason of topReasons(progress.reasons); track reason.key + reason.message) {
                            @if (reasonQueryParams(reason); as queryParams) {
                              <a
                                class="reason-chip"
                                [attr.data-tone]="severityTone(reason.severity)"
                                [routerLink]="['/projects', projectId(), 'work-items']"
                                [queryParams]="queryParams"
                              >
                                {{ reasonLabel(reason) }}
                              </a>
                            } @else {
                              <span class="reason-chip" [attr.data-tone]="severityTone(reason.severity)">
                                {{ reasonLabel(reason) }}
                              </span>
                            }
                          }
                        </span>
                      }
                    </article>
                  }
                </div>
              }
            </section>

            <section class="risk-metrics" aria-label="Planning risk counts">
              <a
                [routerLink]="['/projects', projectId(), 'work-items']"
                [queryParams]="{ status: 'blocked' }"
              >
                <span>Blocked</span>
                <strong>{{ summary.blockedWork.length }}</strong>
              </a>
              <a
                [routerLink]="['/projects', projectId(), 'work-items']"
                [queryParams]="{ dueDateState: 'overdue', sort: 'due_date_asc' }"
              >
                <span>Overdue</span>
                <strong>{{ summary.overdueWork.length }}</strong>
              </a>
              <a
                [routerLink]="['/projects', projectId(), 'work-items']"
                [queryParams]="{ dueDateState: 'due_soon', sort: 'due_date_asc' }"
              >
                <span>Due soon</span>
                <strong>{{ summary.dueSoonWork.length }}</strong>
              </a>
              <a
                [routerLink]="['/projects', projectId(), 'work-items']"
                [queryParams]="{ dependency: 'dependency_blocked', sort: 'priority_desc' }"
              >
                <span>Dep blocked</span>
                <strong>{{ summary.dependencyBlockedWork.length }}</strong>
              </a>
              <a
                [routerLink]="['/projects', projectId(), 'work-items']"
                [queryParams]="{ dependency: 'blocking_open_work', sort: 'priority_desc' }"
              >
                <span>Blocking</span>
                <strong>{{ summary.blockingOpenWork.length }}</strong>
              </a>
              <a
                [routerLink]="['/projects', projectId(), 'work-items']"
                [queryParams]="{ status: 'in_progress', sort: 'updated_asc' }"
              >
                <span>Stale</span>
                <strong>{{ summary.staleInProgressWork.length }}</strong>
              </a>
            </section>

            <div class="review-section-list">
              @for (section of reviewSections(); track section.title) {
                <section class="dashboard-section" [attr.aria-labelledby]="reviewHeadingId(section)">
                  <div class="section-heading">
                    <div>
                      <h3 [id]="reviewHeadingId(section)">{{ section.title }}</h3>
                      <p>{{ section.description }}</p>
                    </div>
                  </div>

                  @if (section.items.length === 0) {
                    <div class="compact-empty">
                      <strong>{{ section.emptyTitle }}</strong>
                      <span>{{ section.emptyMessage }}</span>
                    </div>
                  } @else {
                    <div class="review-list">
                      @for (item of section.items; track item.id + item.kind) {
                        @if (reviewWorkItemLink(item); as workItemLink) {
                          <a
                            class="review-row"
                            [attr.data-tone]="severityTone(item.severity)"
                            [routerLink]="workItemLink"
                            [queryParams]="detailQueryParams()"
                          >
                            <span>
                              <strong>{{ item.displayKey === null ? item.title : item.displayKey + ' · ' + item.title }}</strong>
                              <small>{{ item.detail }}</small>
                            </span>
                            <small>{{ reviewItemMeta(item) }}</small>
                          </a>
                        } @else if (reviewMilestoneLink(item); as milestoneLink) {
                          <a
                            class="review-row"
                            [attr.data-tone]="severityTone(item.severity)"
                            [routerLink]="milestoneLink"
                          >
                            <span>
                              <strong>{{ item.title }}</strong>
                              <small>{{ item.detail }}</small>
                            </span>
                            <small>{{ reviewItemMeta(item) }}</small>
                          </a>
                        } @else if (reviewQueryParams(item); as queryParams) {
                          <a
                            class="review-row"
                            [attr.data-tone]="severityTone(item.severity)"
                            [routerLink]="['/projects', projectId(), 'work-items']"
                            [queryParams]="queryParams"
                          >
                            <span>
                              <strong>{{ item.title }}</strong>
                              <small>{{ item.detail }}</small>
                            </span>
                            <small>{{ reviewItemMeta(item) }}</small>
                          </a>
                        } @else {
                          <div class="review-row" [attr.data-tone]="severityTone(item.severity)">
                            <span>
                              <strong>{{ item.title }}</strong>
                              <small>{{ item.detail }}</small>
                            </span>
                            <small>{{ reviewItemMeta(item) }}</small>
                          </div>
                        }
                      }
                    </div>
                  }
                </section>
              }
            </div>

            <div class="risk-section-list">
              @for (section of riskSections(); track section.title) {
                <section class="dashboard-section" [attr.aria-labelledby]="riskHeadingId(section)">
                  <div class="section-heading">
                    <div>
                      <h3 [id]="riskHeadingId(section)">{{ section.title }}</h3>
                      <p>{{ section.description }}</p>
                    </div>
                    @if (section.queryParams) {
                      <a
                        [routerLink]="['/projects', projectId(), 'work-items']"
                        [queryParams]="section.queryParams"
                      >
                        View list
                      </a>
                    }
                  </div>

                  @if (section.items.length === 0) {
                    <div class="compact-empty">
                      <strong>{{ section.emptyTitle }}</strong>
                      <span>{{ section.emptyMessage }}</span>
                    </div>
                  } @else {
                    <div class="risk-list">
                      @for (item of visibleRiskItems(section); track item.id) {
                        <a
                          class="risk-row"
                          [routerLink]="['/work-items', item.id]"
                          [queryParams]="detailQueryParams()"
                        >
                          <span class="risk-row__title">
                            <strong>{{ item.displayKey }} · {{ item.title }}</strong>
                            <small>
                              {{ statusLabel(item.status) }} · {{ formatToken(item.priority) }}
                              · {{ item.assignee?.name ?? 'Unassigned' }}
                            </small>
                          </span>
                          <span class="risk-row__planning">
                            @if (item.milestone === null) {
                              <span class="muted-pill">No milestone</span>
                            } @else {
                              <span class="milestone-pill">{{ item.milestone.name }}</span>
                            }
                            <small>
                              {{ item.dueDate === null ? 'No due date' : 'Due ' + formatDate(item.dueDate) }}
                            </small>
                          </span>
                        </a>
                      }
                      @if (hiddenRiskItemCount(section) > 0) {
                        @if (section.queryParams) {
                          <a
                            class="risk-more"
                            [routerLink]="['/projects', projectId(), 'work-items']"
                            [queryParams]="section.queryParams"
                          >
                            View {{ hiddenRiskItemCount(section) }} more
                          </a>
                        } @else {
                          <span class="risk-more">{{ hiddenRiskItemCount(section) }} more hidden</span>
                        }
                      }
                    </div>
                  }
                </section>
              }
            </div>
          }
        </section>
          </app-planning-review>
        }
      </section>
    }
  `,
  styles: `
    .page-header {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 20px;
      align-items: start;
      margin-bottom: 24px;
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
    h3,
    h4 {
      margin: 0;
      color: #111827;
      line-height: 1.25;
    }

    h1 {
      margin-bottom: 8px;
      font-size: 1.75rem;
    }

    h2 {
      font-size: 1rem;
    }

    h3 {
      font-size: 0.95rem;
    }

    h4 {
      font-size: 0.9rem;
    }

    p {
      margin: 0;
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

    nav a,
    button {
      min-height: 36px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 8px 12px;
      background: #ffffff;
      color: #1f2937;
      font: inherit;
      font-size: 0.875rem;
      font-weight: 700;
      text-decoration: none;
    }

    nav a:hover,
    button:not(:disabled):hover {
      border-color: #94a3b8;
      background: #f8fafc;
      cursor: pointer;
    }

    button[type="submit"] {
      border-color: #1d4ed8;
      background: #2563eb;
      color: #ffffff;
    }

    button[type="submit"]:not(:disabled):hover {
      background: #1d4ed8;
    }

    button:disabled {
      cursor: not-allowed;
      opacity: 0.6;
    }

    .danger-button {
      border-color: #fecaca;
      color: #991b1b;
    }

    .notice {
      margin-bottom: 20px;
      border: 1px solid #fed7aa;
      border-radius: 8px;
      padding: 14px 16px;
      background: #fff7ed;
    }

    .notice strong {
      display: block;
      margin-bottom: 4px;
      color: #9a3412;
      font-size: 0.875rem;
    }

    .planning-report-bridge {
      display: grid;
      gap: 14px;
      margin-bottom: 20px;
      border: 1px solid #bfdbfe;
      border-radius: 8px;
      padding: 14px 16px;
      background: #eff6ff;
    }

    .planning-view-control {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 16px;
    }

    .planning-view-control button[aria-pressed='true'] {
      border-color: #1d4ed8;
      background: #eff6ff;
      color: #1d4ed8;
    }

    .key-pill,
    .status-pill {
      display: inline-flex;
      align-items: center;
      min-height: 24px;
      border: 1px solid #cbd5e1;
      border-radius: 999px;
      padding: 3px 8px;
      color: #334155;
      font-size: 0.75rem;
      font-weight: 800;
      text-transform: uppercase;
    }

    .status-pill {
      margin-left: 6px;
      border-color: #bbf7d0;
      color: #166534;
    }

    .status-pill--archived {
      border-color: #cbd5e1;
      color: #64748b;
    }

    .planning-grid {
      display: block;
    }

    .panel {
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 18px;
      background: #ffffff;
    }

    .panel-heading {
      display: flex;
      align-items: start;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 18px;
    }

    .panel-heading > span {
      color: #64748b;
      font-size: 0.8125rem;
      font-weight: 800;
    }

    .milestone-form {
      display: grid;
      gap: 10px;
      margin-bottom: 18px;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 14px;
      background: #f8fafc;
    }

    .milestone-form__grid,
    .milestone-row__fields {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }

    label {
      display: grid;
      gap: 6px;
      color: #334155;
      font-size: 0.8125rem;
      font-weight: 800;
    }

    label span {
      color: #475569;
    }

    input,
    select,
    textarea {
      width: 100%;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 8px 10px;
      background: #ffffff;
      color: #111827;
      font: inherit;
      font-size: 0.875rem;
    }

    textarea {
      resize: vertical;
    }

    input:disabled,
    select:disabled,
    textarea:disabled {
      background: #f8fafc;
      color: #64748b;
    }

    .field-error {
      color: #b91c1c;
      font-size: 0.8125rem;
      font-weight: 700;
    }

    .success-message {
      color: #166534;
      font-size: 0.8125rem;
      font-weight: 800;
    }

    .milestone-list {
      display: grid;
      gap: 12px;
    }

    .milestone-row {
      display: grid;
      gap: 12px;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 14px;
      background: #ffffff;
    }

    .milestone-row--archived {
      background: #f8fafc;
    }

    .milestone-row__title {
      display: grid;
      gap: 4px;
    }

    .milestone-row__meta,
    .milestone-actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }

    .milestone-row__meta {
      color: #64748b;
      font-size: 0.8125rem;
      font-weight: 700;
    }

    .summary-panel {
      min-height: 220px;
    }

    .dashboard-section,
    .risk-section-list,
    .review-section-list {
      display: grid;
      gap: 12px;
    }

    .dashboard-section {
      border-top: 1px solid #e5e7eb;
      padding-top: 16px;
    }

    .dashboard-section:first-of-type {
      border-top: 0;
      padding-top: 0;
    }

    .section-heading,
    .health-summary__heading {
      display: flex;
      align-items: start;
      justify-content: space-between;
      gap: 12px;
    }

    .section-heading > span {
      color: #64748b;
      font-size: 0.8125rem;
      font-weight: 800;
    }

    .section-heading a {
      min-height: 32px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 6px 10px;
      color: #1d4ed8;
      font-size: 0.8125rem;
      font-weight: 800;
      text-decoration: none;
    }

    .section-eyebrow {
      margin: 0 0 4px;
      color: #64748b;
      font-size: 0.72rem;
      font-weight: 900;
      letter-spacing: 0;
      text-transform: uppercase;
    }

    .health-counts,
    .risk-metrics {
      display: grid;
      gap: 8px;
    }

    .health-counts {
      grid-template-columns: repeat(5, minmax(0, 1fr));
      margin: 0;
    }

    .health-counts div,
    .risk-metrics a {
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 10px;
      background: #f8fafc;
    }

    .health-counts div {
      display: grid;
      gap: 5px;
    }

    .health-counts dd {
      margin: 0;
      color: #111827;
      font-size: 1.15rem;
      font-weight: 900;
      line-height: 1;
    }

    .health-pill {
      display: inline-flex;
      align-items: center;
      min-height: 26px;
      border: 1px solid #cbd5e1;
      border-radius: 999px;
      padding: 3px 9px;
      background: #f8fafc;
      color: #334155;
      font-size: 0.72rem;
      font-weight: 900;
      white-space: nowrap;
    }

    .health-pill[data-tone='positive'] {
      border-color: #86efac;
      background: #f0fdf4;
      color: #166534;
    }

    .health-pill[data-tone='warning'] {
      border-color: #fcd34d;
      background: #fffbeb;
      color: #92400e;
    }

    .health-pill[data-tone='critical'] {
      border-color: #fca5a5;
      background: #fef2f2;
      color: #991b1b;
    }

    .health-pill[data-tone='info'] {
      border-color: #93c5fd;
      background: #eff6ff;
      color: #1e40af;
    }

    .reason-list,
    .progress-reasons {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .reason-chip {
      display: inline-flex;
      align-items: center;
      min-height: 26px;
      border: 1px solid #cbd5e1;
      border-radius: 999px;
      padding: 4px 8px;
      background: #ffffff;
      color: #334155;
      font-size: 0.75rem;
      font-weight: 800;
      line-height: 1.2;
      text-decoration: none;
    }

    .reason-chip[data-tone='critical'] {
      border-color: #fca5a5;
      color: #991b1b;
    }

    .reason-chip[data-tone='warning'] {
      border-color: #fcd34d;
      color: #92400e;
    }

    .reason-chip[data-tone='info'] {
      border-color: #93c5fd;
      color: #1e40af;
    }

    .progress-list,
    .risk-list,
    .review-list {
      display: grid;
      gap: 8px;
    }

    .progress-row,
    .risk-row,
    .review-row {
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 12px;
      background: #ffffff;
      color: #111827;
      text-decoration: none;
    }

    .progress-row {
      display: grid;
      gap: 10px;
    }

    .progress-row__heading,
    .progress-row__counts {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }

    .progress-row__heading-link {
      color: #1d4ed8;
      font-size: 0.875rem;
      font-weight: 900;
      text-decoration: none;
    }

    .progress-row__heading-link:hover,
    .reason-chip:hover,
    .review-row:hover,
    .risk-row:hover,
    .risk-more:hover,
    .section-heading a:hover {
      background: #f8fafc;
    }

    .progress-row__heading small,
    .progress-row__counts,
    .review-row small {
      color: #64748b;
      font-size: 0.75rem;
      font-weight: 800;
    }

    .progress-bar {
      overflow: hidden;
      height: 8px;
      border-radius: 999px;
      background: #e5e7eb;
    }

    .progress-bar span {
      display: block;
      height: 100%;
      border-radius: inherit;
      background: #2563eb;
    }

    .risk-metrics {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .risk-metrics a {
      display: grid;
      gap: 6px;
      color: #111827;
      text-decoration: none;
    }

    .risk-metrics span,
    dt {
      color: #64748b;
      font-size: 0.72rem;
      font-weight: 900;
      text-transform: uppercase;
    }

    .risk-metrics strong {
      color: #111827;
      font-size: 1.25rem;
      line-height: 1;
    }

    .risk-row,
    .review-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 12px;
      align-items: center;
    }

    .risk-more {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 36px;
      border: 1px dashed #cbd5e1;
      border-radius: 8px;
      color: #1d4ed8;
      font-size: 0.8125rem;
      font-weight: 800;
      text-decoration: none;
    }

    .risk-row__title,
    .risk-row__planning,
    .review-row span {
      display: grid;
      gap: 4px;
      min-width: 0;
    }

    .risk-row strong,
    .review-row strong {
      color: #111827;
      font-size: 0.875rem;
      line-height: 1.35;
    }

    .review-row {
      border-left-width: 4px;
    }

    .review-row[data-tone='critical'] {
      border-left-color: #dc2626;
    }

    .review-row[data-tone='warning'] {
      border-left-color: #f59e0b;
    }

    .review-row[data-tone='info'] {
      border-left-color: #2563eb;
    }

    .milestone-pill,
    .muted-pill {
      display: inline-flex;
      align-items: center;
      width: fit-content;
      min-height: 22px;
      border: 1px solid #bfdbfe;
      border-radius: 999px;
      padding: 2px 7px;
      color: #1e3a8a;
      font-size: 0.72rem;
      font-weight: 900;
    }

    .muted-pill {
      border-color: #cbd5e1;
      color: #64748b;
    }

    .compact-empty {
      display: grid;
      gap: 4px;
      border: 1px dashed #cbd5e1;
      border-radius: 8px;
      padding: 12px;
      background: #f8fafc;
    }

    .compact-empty strong {
      color: #111827;
      font-size: 0.875rem;
    }

    .compact-empty span {
      color: #64748b;
      font-size: 0.8125rem;
      line-height: 1.4;
    }

    @media (max-width: 900px) {
      .page-header,
      .planning-grid,
      .milestone-form__grid,
      .milestone-row__fields {
        grid-template-columns: 1fr;
      }

      nav {
        justify-content: flex-start;
      }

      .health-counts,
      .risk-metrics {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .risk-row,
      .review-row {
        grid-template-columns: 1fr;
      }
    }
  `
})
export class ProjectPlanningPageComponent implements OnDestroy, OnInit {
  private readonly api = inject(WorktrailApiService);
  private readonly cyclesApi = inject(CyclesApi);
  private readonly currentUser = inject(CurrentUserService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly subscriptions = new Subscription();

  readonly planningViews = planningViews;
  readonly selectedPlanningView = signal<PlanningView>('review');
  readonly milestoneStatuses = milestoneStatuses;
  readonly creatableCycleStatuses = creatableCycleStatuses;
  readonly mutableCycleStatuses = mutableCycleStatuses;
  readonly project = signal<ProjectDto | null>(null);
  readonly milestones = signal<MilestoneDto[]>([]);
  readonly cycles = signal<ProjectCycleDto[]>([]);
  readonly planningSummary = signal<ProjectPlanningSummaryDto | null>(null);
  readonly isLoadingProject = signal(false);
  readonly isLoadingMilestones = signal(false);
  readonly isLoadingCycles = signal(false);
  readonly isLoadingSummary = signal(false);
  readonly isCreatingMilestone = signal(false);
  readonly isCreatingCycle = signal(false);
  readonly mutatingMilestoneId = signal<string | null>(null);
  readonly mutatingCycleId = signal<string | null>(null);
  readonly hasSubmittedCreate = signal(false);
  readonly hasSubmittedCycleCreate = signal(false);
  readonly projectLoadError = signal<string | null>(null);
  readonly milestoneLoadError = signal<string | null>(null);
  readonly cycleLoadError = signal<string | null>(null);
  readonly planningSummaryLoadError = signal<string | null>(null);
  readonly createError = signal<string | null>(null);
  readonly cycleCreateError = signal<string | null>(null);
  readonly milestoneMutationError = signal<string | null>(null);
  readonly cycleMutationError = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly cycleSuccessMessage = signal<string | null>(null);
  readonly projectId = computed(() => this.route.snapshot.paramMap.get('projectId') ?? '');
  readonly isArchivedProject = computed(() => this.project()?.status === 'archived');
  readonly canManageMilestones = computed(() => {
    const member = this.currentUser.selectedMember();
    return (
      this.project()?.status === 'active' &&
      (member?.role === 'owner' || member?.role === 'maintainer')
    );
  });
  readonly canManageCycles = computed(() => this.canManageMilestones());
  readonly canCreateReport = computed(() => this.canManageMilestones());
  readonly riskSections = computed<PlanningRiskSection[]>(() => {
    const summary = this.planningSummary();

    if (summary === null) {
      return [];
    }

    const sections: PlanningRiskSection[] = [
      {
        title: 'Blocked work',
        description: 'Items that need intervention before delivery can continue.',
        items: summary.blockedWork,
        emptyTitle: 'No blocked work',
        emptyMessage: 'No work items are currently blocked.',
        queryParams: { status: 'blocked' }
      },
      {
        title: 'Overdue work',
        description: 'Open items with due dates before today.',
        items: summary.overdueWork,
        emptyTitle: 'No overdue work',
        emptyMessage: 'Open due dates are not past their target date.',
        queryParams: { dueDateState: 'overdue', sort: 'due_date_asc' }
      },
      {
        title: 'Due soon',
        description: 'Open work due within the planning window.',
        items: summary.dueSoonWork,
        emptyTitle: 'Nothing due soon',
        emptyMessage: 'No open work is due within the next week.',
        queryParams: { dueDateState: 'due_soon', sort: 'due_date_asc' }
      },
      {
        title: 'Dependency blocked work',
        description: 'Open items blocked by upstream work that is not done.',
        items: summary.dependencyBlockedWork,
        emptyTitle: 'No dependency-blocked work',
        emptyMessage: 'No open work is waiting on upstream dependencies.',
        queryParams: { dependency: 'dependency_blocked', sort: 'priority_desc' }
      },
      {
        title: 'Blocking open work',
        description: 'Open items currently blocking downstream work.',
        items: summary.blockingOpenWork,
        emptyTitle: 'No work blocking dependencies',
        emptyMessage: 'No open work is blocking other open items.',
        queryParams: { dependency: 'blocking_open_work', sort: 'priority_desc' }
      },
      {
        title: 'Unassigned active work',
        description: 'Ready or in-progress items without an owner.',
        items: summary.unassignedActiveWork,
        emptyTitle: 'No unassigned active work',
        emptyMessage: 'Ready and in-progress work all has an assignee.'
      },
      {
        title: 'Stale in-progress work',
        description: 'In-progress items that have not changed recently.',
        items: summary.staleInProgressWork,
        emptyTitle: 'No stale in-progress work',
        emptyMessage: 'In-progress work has recent activity.',
        queryParams: { status: 'in_progress', sort: 'updated_asc' }
      }
    ];

    return sections;
  });
  readonly reviewSections = computed<PlanningReviewSection[]>(() => {
    const summary = this.planningSummary();

    if (summary === null) {
      return [];
    }

    return [
      {
        title: 'Needs attention',
        description: 'Highest-priority planning items to review first.',
        items: summary.planningReview.needsAttention,
        emptyTitle: 'Nothing needs attention',
        emptyMessage: 'No planning review items need intervention.'
      },
      {
        title: 'Upcoming',
        description: 'Due-soon work and milestone targets approaching.',
        items: summary.planningReview.upcoming,
        emptyTitle: 'No upcoming review items',
        emptyMessage: 'No due-soon work or milestone targets are in the review window.'
      },
      {
        title: 'Recently changed',
        description: 'Recently updated active work and milestones.',
        items: summary.planningReview.recentlyChanged,
        emptyTitle: 'No recent changes',
        emptyMessage: 'No active planning items changed recently.'
      }
    ];
  });

  readonly milestoneForm = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required]],
    description: [''],
    status: ['planned' as MilestoneStatus],
    targetDate: ['']
  });
  readonly cycleForm = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required]],
    goal: [''],
    status: ['planned' as CreatableProjectCycleStatus],
    startDate: ['', [Validators.required]],
    endDate: ['', [Validators.required]],
    targetPoints: ['']
  });

  ngOnInit(): void {
    this.subscriptions.add(
      this.route.queryParamMap.subscribe((params) => {
        const requestedView = params.get('view');
        const nextView = this.toPlanningView(requestedView);
        this.selectedPlanningView.set(nextView);

        if (requestedView !== nextView) {
          this.persistPlanningView(nextView, true);
        }
      })
    );
    this.loadProject();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  setPlanningView(view: PlanningView): void {
    this.selectedPlanningView.set(view);
    this.persistPlanningView(view);
  }

  private persistPlanningView(view: PlanningView, replaceUrl = false): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { view },
      queryParamsHandling: 'merge',
      replaceUrl
    });
  }

  loadProject(): void {
    this.isLoadingProject.set(true);
    this.projectLoadError.set(null);
    this.api.getProject(this.projectId()).subscribe({
      next: (project) => {
        this.project.set(project);
        this.isLoadingProject.set(false);
        this.loadMilestones();
        this.loadCycles();
        this.loadPlanningSummary();
      },
      error: () => {
        this.projectLoadError.set('Project planning could not be loaded from the API.');
        this.isLoadingProject.set(false);
      }
    });
  }

  loadPlanningSummary(): void {
    this.isLoadingSummary.set(true);
    this.planningSummaryLoadError.set(null);
    this.api.getProjectPlanningSummary(this.projectId()).subscribe({
      next: (summary) => {
        this.planningSummary.set(summary);
        this.isLoadingSummary.set(false);
      },
      error: () => {
        this.planningSummaryLoadError.set('Planning dashboard could not be loaded from the API.');
        this.isLoadingSummary.set(false);
      }
    });
  }

  loadMilestones(): void {
    this.isLoadingMilestones.set(true);
    this.milestoneLoadError.set(null);
    this.api.listProjectMilestones(this.projectId(), { includeArchived: true }).subscribe({
      next: (milestones) => {
        this.milestones.set(this.sortMilestones(milestones));
        this.isLoadingMilestones.set(false);
      },
      error: () => {
        this.milestoneLoadError.set('Project milestones could not be loaded from the API.');
        this.isLoadingMilestones.set(false);
      }
    });
  }

  loadCycles(): void {
    this.isLoadingCycles.set(true);
    this.cycleLoadError.set(null);
    this.cyclesApi.listCycles(this.projectId(), { includeArchived: true }).subscribe({
      next: (cycles) => {
        this.cycles.set(this.sortCycles(cycles));
        this.isLoadingCycles.set(false);
      },
      error: () => {
        this.cycleLoadError.set('Project cycles could not be loaded from the API.');
        this.isLoadingCycles.set(false);
      }
    });
  }

  createMilestone(): void {
    this.hasSubmittedCreate.set(true);
    this.createError.set(null);
    this.milestoneMutationError.set(null);
    this.successMessage.set(null);

    if (!this.canManageMilestones()) {
      this.createError.set(this.milestonePermissionMessage());
      return;
    }

    if (this.milestoneForm.invalid) {
      this.milestoneForm.markAllAsTouched();
      return;
    }

    const formValue = this.milestoneForm.getRawValue();
    this.isCreatingMilestone.set(true);
    this.api
      .createMilestone(this.projectId(), {
        name: formValue.name.trim(),
        description: formValue.description.trim(),
        status: formValue.status,
        targetDate: formValue.targetDate === '' ? null : formValue.targetDate
      })
      .subscribe({
        next: (milestone) => {
          this.upsertMilestone(milestone);
          this.milestoneForm.reset({ name: '', description: '', status: 'planned', targetDate: '' });
          this.hasSubmittedCreate.set(false);
          this.isCreatingMilestone.set(false);
          this.successMessage.set('Milestone created.');
          this.loadPlanningSummary();
        },
        error: (error: unknown) => {
          this.createError.set(this.toErrorMessage(error, 'Milestone could not be created.'));
          this.isCreatingMilestone.set(false);
        }
      });
  }

  createCycle(): void {
    this.hasSubmittedCycleCreate.set(true);
    this.cycleCreateError.set(null);
    this.cycleMutationError.set(null);
    this.cycleSuccessMessage.set(null);

    if (!this.canManageCycles()) {
      this.cycleCreateError.set(this.cyclePermissionMessage());
      return;
    }

    if (this.cycleForm.invalid) {
      this.cycleForm.markAllAsTouched();
      return;
    }

    const formValue = this.cycleForm.getRawValue();
    const fields = this.toCycleFields({
      name: formValue.name,
      goal: formValue.goal,
      startDate: formValue.startDate,
      endDate: formValue.endDate,
      targetPoints: formValue.targetPoints
    }, 'create');

    if (fields === null) {
      return;
    }

    const request: CreateProjectCycleRequest = { ...fields, status: formValue.status };

    this.isCreatingCycle.set(true);
    this.cyclesApi.createCycle(this.projectId(), request).subscribe({
      next: (cycle) => {
        this.upsertCycle(cycle);
        this.cycleForm.reset({
          name: '',
          goal: '',
          status: 'planned',
          startDate: '',
          endDate: '',
          targetPoints: ''
        });
        this.hasSubmittedCycleCreate.set(false);
        this.isCreatingCycle.set(false);
        this.cycleSuccessMessage.set('Cycle created.');
        this.loadPlanningSummary();
      },
      error: (error: unknown) => {
        this.cycleCreateError.set(this.toErrorMessage(error, 'Cycle could not be created.'));
        this.isCreatingCycle.set(false);
      }
    });
  }

  updateMilestone(
    milestone: MilestoneDto,
    name: string,
    description: string,
    status: string,
    targetDate: string
  ): void {
    this.createError.set(null);
    this.milestoneMutationError.set(null);
    this.successMessage.set(null);

    if (!this.canManageMilestones()) {
      this.milestoneMutationError.set(this.milestonePermissionMessage());
      return;
    }

    const nextName = name.trim();

    if (nextName === '') {
      this.milestoneMutationError.set('Milestone name is required.');
      return;
    }

    this.mutatingMilestoneId.set(milestone.id);
    this.api
      .updateMilestone(milestone.id, {
        name: nextName,
        description: description.trim(),
        status: status as MilestoneStatus,
        targetDate: targetDate === '' ? null : targetDate
      })
      .subscribe({
        next: (updated) => {
          this.upsertMilestone(updated);
          this.mutatingMilestoneId.set(null);
          this.successMessage.set('Milestone saved.');
          this.loadPlanningSummary();
        },
        error: (error: unknown) => {
          this.milestoneMutationError.set(
            this.toErrorMessage(error, 'Milestone could not be saved.')
          );
          this.mutatingMilestoneId.set(null);
        }
      });
  }

  updateCycle(
    cycle: ProjectCycleDto,
    name: string,
    goal: string,
    status: string,
    startDate: string,
    endDate: string,
    targetPoints: string
  ): void {
    this.cycleCreateError.set(null);
    this.cycleMutationError.set(null);
    this.cycleSuccessMessage.set(null);

    if (!this.canManageCycles()) {
      this.cycleMutationError.set(this.cyclePermissionMessage());
      return;
    }

    const fields = this.toCycleFields({
      name,
      goal,
      startDate,
      endDate,
      targetPoints
    }, 'mutation');

    if (fields === null) {
      return;
    }

    const mutableStatus = mutableCycleStatuses.find((candidate) => candidate === status);

    if (cycle.status !== 'completed' && mutableStatus === undefined) {
      this.cycleMutationError.set('Select a valid cycle status.');
      return;
    }

    const request = {
      ...fields,
      ...(cycle.status === 'completed' ? {} : { status: mutableStatus })
    };

    this.mutatingCycleId.set(cycle.id);
    this.cyclesApi.updateCycle(this.projectId(), cycle.id, request).subscribe({
      next: (updated) => {
        this.upsertCycle(updated);
        this.mutatingCycleId.set(null);
        this.cycleSuccessMessage.set('Cycle saved.');
        this.loadPlanningSummary();
      },
      error: (error: unknown) => {
        this.cycleMutationError.set(this.toErrorMessage(error, 'Cycle could not be saved.'));
        this.mutatingCycleId.set(null);
      }
    });
  }

  updateCycleFromRequest(request: CycleUpdateRequest): void {
    this.updateCycle(
      request.cycle,
      request.name,
      request.goal,
      request.status,
      request.startDate,
      request.endDate,
      request.targetPoints
    );
  }

  archiveMilestone(milestone: MilestoneDto): void {
    this.runMilestoneCommand(
      milestone,
      'Milestone archived.',
      'Milestone could not be archived.',
      () => this.api.archiveMilestone(milestone.id)
    );
  }

  reactivateMilestone(milestone: MilestoneDto): void {
    this.runMilestoneCommand(
      milestone,
      'Milestone reactivated.',
      'Milestone could not be reactivated.',
      () => this.api.reactivateMilestone(milestone.id)
    );
  }

  archiveCycle(cycle: ProjectCycleDto): void {
    this.runCycleCommand(
      cycle,
      'Cycle archived.',
      'Cycle could not be archived.',
      () => this.cyclesApi.archiveCycle(this.projectId(), cycle.id)
    );
  }

  reactivateCycle(cycle: ProjectCycleDto): void {
    this.runCycleCommand(
      cycle,
      'Cycle reactivated.',
      'Cycle could not be reactivated.',
      () => this.cyclesApi.reactivateCycle(this.projectId(), cycle.id)
    );
  }

  isMutating(milestone: MilestoneDto): boolean {
    return this.mutatingMilestoneId() === milestone.id;
  }

  showMilestoneNameError(): boolean {
    const control = this.milestoneForm.controls.name;
    return control.invalid && (control.touched || this.hasSubmittedCreate());
  }

  formatToken(value: string): string {
    return value.replaceAll('_', ' ');
  }

  statusLabel(status: WorkItemStatus): string {
    return workItemStatusLabels[status];
  }

  milestonePercent(progress: MilestoneProgressDto): number {
    if (progress.totalCount === 0) {
      return 0;
    }

    return Math.round((progress.doneCount / progress.totalCount) * 100);
  }

  totalRiskCount(summary: ProjectPlanningSummaryDto): number {
    return (
      summary.blockedWork.length +
      summary.overdueWork.length +
      summary.dueSoonWork.length +
      summary.dependencyBlockedWork.length +
      summary.blockingOpenWork.length +
      summary.unassignedActiveWork.length +
      summary.staleInProgressWork.length
    );
  }

  riskHeadingId(section: PlanningRiskSection): string {
    return `risk-${section.title.toLowerCase().replaceAll(' ', '-')}`;
  }

  reviewHeadingId(section: PlanningReviewSection): string {
    return `review-${section.title.toLowerCase().replaceAll(' ', '-')}`;
  }

  healthLabel(state: DeliveryHealthState): string {
    return deliveryHealthLabel(state);
  }

  healthTone(state: DeliveryHealthState): string {
    return deliveryHealthTone(state);
  }

  severityTone(severity: DeliveryHealthReasonDto['severity']): string {
    return deliveryHealthSeverityTone(severity);
  }

  topReasons(reasons: DeliveryHealthReasonDto[]): DeliveryHealthReasonDto[] {
    return reasons.slice(0, 3);
  }

  visibleRiskItems(section: PlanningRiskSection): PlanningRiskItemDto[] {
    return section.items.slice(0, visibleRiskItemLimit);
  }

  hiddenRiskItemCount(section: PlanningRiskSection): number {
    return Math.max(section.items.length - visibleRiskItemLimit, 0);
  }

  reasonLabel(reason: DeliveryHealthReasonDto): string {
    return deliveryHealthReasonLabel(reason);
  }

  reasonQueryParams(reason: DeliveryHealthReasonDto): Record<string, string> | null {
    return deliveryHealthReasonQueryParams(reason, 'project');
  }

  reviewWorkItemLink(item: PlanningReviewItemDto): string[] | null {
    return item.workItemId === null ? null : ['/work-items', item.workItemId];
  }

  reviewMilestoneLink(item: PlanningReviewItemDto): string[] | null {
    return item.kind === 'milestone' && item.milestoneId !== null
      ? ['/projects', this.projectId(), 'milestones', item.milestoneId]
      : null;
  }

  detailQueryParams(): { returnUrl: string } {
    return { returnUrl: `/projects/${this.projectId()}/planning?view=review` };
  }

  reviewQueryParams(item: PlanningReviewItemDto): Record<string, string> | null {
    return workItemQueryToRouterQueryParams(item.query, 'project');
  }

  reviewItemMeta(item: PlanningReviewItemDto): string {
    if (item.dueDate !== null) {
      return `Due ${this.formatDate(item.dueDate)}`;
    }

    return this.formatDateTime(item.updatedAt);
  }

  formatDate(value: string): string {
    const [year, month, day] = value.split('-').map(Number);
    return new Intl.DateTimeFormat('en', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(new Date(year, month - 1, day));
  }

  formatDateTime(value: string): string {
    return new Intl.DateTimeFormat('en', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(new Date(value));
  }

  private runMilestoneCommand(
    milestone: MilestoneDto,
    successMessage: string,
    fallbackError: string,
    command: () => ReturnType<WorktrailApiService['archiveMilestone']>
  ): void {
    this.createError.set(null);
    this.milestoneMutationError.set(null);
    this.successMessage.set(null);

    if (!this.canManageMilestones()) {
      this.milestoneMutationError.set(this.milestonePermissionMessage());
      return;
    }

    this.mutatingMilestoneId.set(milestone.id);
    command().subscribe({
      next: (updated) => {
        this.upsertMilestone(updated);
        this.mutatingMilestoneId.set(null);
        this.successMessage.set(successMessage);
        this.loadPlanningSummary();
      },
      error: (error: unknown) => {
        this.milestoneMutationError.set(this.toErrorMessage(error, fallbackError));
        this.mutatingMilestoneId.set(null);
      }
    });
  }

  private runCycleCommand(
    cycle: ProjectCycleDto,
    successMessage: string,
    fallbackError: string,
    command: () => ReturnType<CyclesApi['archiveCycle']>
  ): void {
    this.cycleCreateError.set(null);
    this.cycleMutationError.set(null);
    this.cycleSuccessMessage.set(null);

    if (!this.canManageCycles()) {
      this.cycleMutationError.set(this.cyclePermissionMessage());
      return;
    }

    this.mutatingCycleId.set(cycle.id);
    command().subscribe({
      next: (updated) => {
        this.upsertCycle(updated);
        this.mutatingCycleId.set(null);
        this.cycleSuccessMessage.set(successMessage);
        this.loadPlanningSummary();
      },
      error: (error: unknown) => {
        this.cycleMutationError.set(this.toErrorMessage(error, fallbackError));
        this.mutatingCycleId.set(null);
      }
    });
  }

  private upsertMilestone(milestone: MilestoneDto): void {
    const milestonesById = new Map(this.milestones().map((item) => [item.id, item]));
    milestonesById.set(milestone.id, milestone);
    this.milestones.set(this.sortMilestones([...milestonesById.values()]));
  }

  private upsertCycle(cycle: ProjectCycleDto): void {
    const cyclesById = new Map(this.cycles().map((item) => [item.id, item]));
    cyclesById.set(cycle.id, cycle);
    this.cycles.set(this.sortCycles([...cyclesById.values()]));
  }

  private sortMilestones(milestones: MilestoneDto[]): MilestoneDto[] {
    return [...milestones].sort((left, right) => {
      if (left.isArchived !== right.isArchived) {
        return left.isArchived ? 1 : -1;
      }

      const statusCompare =
        (statusOrder.get(left.status) ?? 0) - (statusOrder.get(right.status) ?? 0);

      if (statusCompare !== 0) {
        return statusCompare;
      }

      const targetCompare = (left.targetDate ?? '9999-12-31').localeCompare(
        right.targetDate ?? '9999-12-31'
      );

      if (targetCompare !== 0) {
        return targetCompare;
      }

      return left.name.localeCompare(right.name);
    });
  }

  private sortCycles(cycles: ProjectCycleDto[]): ProjectCycleDto[] {
    return [...cycles].sort((left, right) => {
      if (left.isArchived !== right.isArchived) {
        return left.isArchived ? 1 : -1;
      }

      const statusCompare =
        (cycleStatusOrder.get(left.status) ?? 0) - (cycleStatusOrder.get(right.status) ?? 0);

      if (statusCompare !== 0) {
        return statusCompare;
      }

      const startCompare = left.startDate.localeCompare(right.startDate);

      if (startCompare !== 0) {
        return startCompare;
      }

      return left.name.localeCompare(right.name);
    });
  }

  private toCycleFields(
    input: {
      name: string;
      goal: string;
      startDate: string;
      endDate: string;
      targetPoints: string;
    },
    target: 'create' | 'mutation'
  ): Omit<CreateProjectCycleRequest, 'status'> | null {
    const name = input.name.trim();
    const startDate = input.startDate.trim();
    const endDate = input.endDate.trim();

    if (name === '') {
      this.setCycleValidationMessage('Cycle name is required.', target);
      return null;
    }

    if (startDate === '' || endDate === '') {
      this.setCycleValidationMessage('Cycle start and end dates are required.', target);
      return null;
    }

    if (startDate > endDate) {
      this.setCycleValidationMessage('Cycle start date must be on or before end date.', target);
      return null;
    }

    const targetPoints = this.parseCycleTargetPoints(input.targetPoints, target);

    if (targetPoints === undefined) {
      return null;
    }

    return {
      name,
      goal: input.goal.trim(),
      startDate,
      endDate,
      targetPoints
    };
  }

  private parseCycleTargetPoints(
    value: string,
    target: 'create' | 'mutation'
  ): number | null | undefined {
    const trimmed = value.trim();

    if (trimmed === '') {
      return null;
    }

    const parsed = Number(trimmed);

    if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 999) {
      this.setCycleValidationMessage(
        'Cycle target points must be a whole number from 1 to 999.',
        target
      );
      return undefined;
    }

    return parsed;
  }

  private setCycleValidationMessage(message: string, target: 'create' | 'mutation'): void {
    if (target === 'create') {
      this.cycleCreateError.set(message);
      return;
    }

    this.cycleMutationError.set(message);
  }

  private toErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse) {
      const message = (error.error as { error?: { message?: unknown } } | null)?.error?.message;

      if (typeof message === 'string' && message.trim() !== '') {
        return message;
      }
    }

    return fallback;
  }

  private milestonePermissionMessage(): string {
    return this.isArchivedProject()
      ? 'Archived projects are read-only.'
      : 'Only owners and maintainers can manage milestones.';
  }

  private cyclePermissionMessage(): string {
    return this.isArchivedProject()
      ? 'Archived projects are read-only.'
      : 'Only owners and maintainers can manage cycles.';
  }

  private toPlanningView(value: string | null): PlanningView {
    if (value === 'cycles' || value === 'milestones') {
      return value;
    }

    return 'review';
  }
}
