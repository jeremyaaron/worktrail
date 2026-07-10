import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import type {
  CycleReviewRiskSectionDto,
  CycleReviewScopeBreakdownDto,
  DeliveryHealthReasonDto,
  DeliveryHealthState,
  PlanningRiskItemDto,
  ProjectCycleReviewDto,
  WorkItemPriority,
  WorkItemQuery,
  WorkItemStatus
} from '@worktrail/contracts';
import { Subscription } from 'rxjs';

import { CyclesApi } from '../../core/api/cycles-api';
import {
  cycleDateRangeLabel,
  cycleHealthLabel,
  cycleStatusLabel
} from '../../shared/cycles/cycle-display';
import {
  deliveryHealthReasonLabel,
  deliveryHealthSeverityTone,
  deliveryHealthTone
} from '../../shared/delivery-health/delivery-health-display';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { ErrorPanelComponent } from '../../shared/ui/error-panel.component';
import { LoadingIndicatorComponent } from '../../shared/ui/loading-indicator.component';
import { routerLinkQueryParamsFromWorkItemQuery } from '../work-items/query/work-item-query-serialization';

const visibleRiskItemLimit = 4;
const workItemStatuses: WorkItemStatus[] = [
  'backlog',
  'ready',
  'in_progress',
  'blocked',
  'done',
  'canceled'
];
const workItemPriorities: WorkItemPriority[] = ['urgent', 'high', 'medium', 'low'];
const statusLabels: Record<WorkItemStatus, string> = {
  backlog: 'Backlog',
  ready: 'Ready',
  in_progress: 'In progress',
  blocked: 'Blocked',
  done: 'Done',
  canceled: 'Canceled'
};
const priorityLabels: Record<WorkItemPriority, string> = {
  urgent: 'Urgent',
  high: 'High',
  medium: 'Medium',
  low: 'Low'
};

interface BreakdownMetric {
  label: string;
  value: number;
}

@Component({
  selector: 'app-project-cycle-review-page',
  imports: [EmptyStateComponent, ErrorPanelComponent, LoadingIndicatorComponent, RouterLink],
  template: `
    <section class="cycle-review-page">
      @if (isLoading()) {
        <app-loading-indicator label="Loading cycle review" />
      } @else if (error()) {
        <app-error-panel
          [title]="errorTitle()"
          [message]="error() ?? ''"
          (retry)="loadReview()"
        />
      } @else if (review(); as review) {
        <section class="review-header">
          <div>
            <p class="eyebrow">Cycle review · Live view</p>
            <h1>{{ review.cycle.name }}</h1>
            <div class="review-meta">
              <span>{{ review.project.key }}</span>
              <span>{{ review.project.name }}</span>
              <span>{{ statusLabel(review.cycle.status) }}</span>
              <span>{{ dateRangeLabel(review) }}</span>
              @if (review.cycle.isArchived) {
                <span class="review-meta__archived">Archived</span>
              }
            </div>
            <p class="review-copy">{{ review.cycle.goal || 'No cycle goal provided.' }}</p>
          </div>

          <div class="review-actions">
            <a [routerLink]="['/projects', projectId(), 'planning']">Back to Planning</a>
            <a
              class="review-actions__primary"
              [routerLink]="['/projects', projectId(), 'work-items']"
              [queryParams]="scopedWorkQueryParams(review.scopedWorkQuery)"
            >
              Open cycle work
            </a>
          </div>
        </section>

        @if (review.project.status === 'archived' || review.cycle.isArchived) {
          <section class="notice" aria-label="Read-only cycle review">
            <strong>Read-only review</strong>
            <p>Archived project and cycle data remains readable from this page.</p>
          </section>
        }

        <section class="summary-grid" aria-label="Cycle progress summary">
          <article>
            <span>Complete</span>
            <strong>{{ completionPercent(review) }}%</strong>
          </article>
          <article>
            <span>Total</span>
            <strong>{{ review.progress.totalCount }}</strong>
          </article>
          <article>
            <span>Open</span>
            <strong>{{ review.progress.openCount }}</strong>
          </article>
          <article>
            <span>Done</span>
            <strong>{{ review.progress.doneCount }}</strong>
          </article>
          <article>
            <span>Blocked</span>
            <strong>{{ review.progress.blockedCount }}</strong>
          </article>
          <article>
            <span>Target</span>
            <strong>{{ review.progress.targetPoints ?? 'None' }}</strong>
          </article>
        </section>

        <div class="review-layout">
          <section class="panel" aria-labelledby="cycle-health-heading">
            <div class="panel-heading">
              <div>
                <p class="eyebrow">Health</p>
                <h2 id="cycle-health-heading">{{ healthLabel(review.health.health) }}</h2>
              </div>
              <span class="health-pill" [attr.data-tone]="healthTone(review.health.health)">
                {{ healthLabel(review.health.health) }}
              </span>
            </div>

            <span class="progress-bar" aria-hidden="true">
              <span [style.width.%]="completionPercent(review)"></span>
            </span>

            @if (review.health.reasons.length === 0) {
              <div class="compact-empty">
                <strong>No cycle risks found</strong>
                <span>This cycle has no surfaced delivery-health reasons.</span>
              </div>
            } @else {
              <div class="reason-list" aria-label="Cycle health reasons">
                @for (reason of topReasons(review.health.reasons); track reason.key + reason.message) {
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

          <section class="panel" aria-labelledby="cycle-estimate-heading">
            <div class="panel-heading">
              <div>
                <p class="eyebrow">Estimate</p>
                <h2 id="cycle-estimate-heading">Target progress</h2>
              </div>
              <span class="health-pill" [attr.data-tone]="targetTone(review)">
                {{ targetVarianceLabel(review) }}
              </span>
            </div>

            <span class="progress-bar progress-bar--estimate" aria-hidden="true">
              <span [style.width.%]="estimatePercent(review)"></span>
            </span>

            <dl class="breakdown-list breakdown-list--wide">
              <div>
                <dt>Committed</dt>
                <dd>{{ review.progress.committedEstimatePoints }}</dd>
              </div>
              <div>
                <dt>Completed</dt>
                <dd>{{ review.progress.completedEstimatePoints }}</dd>
              </div>
              <div>
                <dt>Target</dt>
                <dd>{{ review.progress.targetPoints ?? 'None' }}</dd>
              </div>
              <div>
                <dt>Unestimated</dt>
                <dd>{{ review.progress.unestimatedCount }}</dd>
              </div>
            </dl>
          </section>
        </div>

        <section class="panel" aria-labelledby="scope-breakdown-heading">
          <div class="panel-heading">
            <div>
              <p class="eyebrow">Scope</p>
              <h2 id="scope-breakdown-heading">Breakdown</h2>
            </div>
          </div>

          <div class="scope-grid">
            <section class="breakdown-section">
              <h3>Status</h3>
              <dl class="breakdown-list">
                @for (metric of statusBreakdown(review.scopeBreakdown); track metric.label) {
                  <div>
                    <dt>{{ metric.label }}</dt>
                    <dd>{{ metric.value }}</dd>
                  </div>
                }
              </dl>
            </section>

            <section class="breakdown-section">
              <h3>Priority</h3>
              <dl class="breakdown-list">
                @for (metric of priorityBreakdown(review.scopeBreakdown); track metric.label) {
                  <div>
                    <dt>{{ metric.label }}</dt>
                    <dd>{{ metric.value }}</dd>
                  </div>
                }
              </dl>
            </section>

            <section class="breakdown-section breakdown-section--wide">
              <h3>Ownership, dates, and dependencies</h3>
              <dl class="breakdown-list breakdown-list--wide">
                @for (metric of planningBreakdown(review.scopeBreakdown); track metric.label) {
                  <div>
                    <dt>{{ metric.label }}</dt>
                    <dd>{{ metric.value }}</dd>
                  </div>
                }
              </dl>
            </section>
          </div>
        </section>

        <section class="panel" aria-labelledby="risk-sections-heading">
          <div class="panel-heading">
            <div>
              <p class="eyebrow">Risks</p>
              <h2 id="risk-sections-heading">Needs attention</h2>
            </div>
            <span>{{ totalRiskCount(review) }} items</span>
          </div>

          @if (review.riskSections.length === 0) {
            <div class="compact-empty">
              <strong>No risk sections</strong>
              <span>Current cycle work has no surfaced risk categories.</span>
            </div>
          } @else {
            <div class="risk-section-list">
              @for (section of review.riskSections; track section.type) {
                <section class="risk-section" [attr.aria-labelledby]="riskHeadingId(section)">
                  <div class="section-heading">
                    <div>
                      <h3 [id]="riskHeadingId(section)">{{ section.title }}</h3>
                      <p>{{ section.description }}</p>
                    </div>
                    <a
                      [routerLink]="['/projects', projectId(), 'work-items']"
                      [queryParams]="scopedWorkQueryParams(section.query)"
                    >
                      Open work
                    </a>
                  </div>

                  @if (section.items.length === 0) {
                    <div class="compact-empty">
                      <strong>No matching work</strong>
                      <span>This section has no item previews.</span>
                    </div>
                  } @else {
                    <div class="risk-list">
                      @for (item of visibleRiskItems(section); track item.id) {
                        <a
                          class="work-row"
                          [routerLink]="['/work-items', item.id]"
                          [queryParams]="detailQueryParams()"
                        >
                          <span class="work-row__title">
                            <strong>{{ item.displayKey }} · {{ item.title }}</strong>
                            <small>
                              {{ workStatusLabel(item.status) }} · {{ priorityLabel(item.priority) }}
                              · {{ item.assignee?.name ?? 'Unassigned' }}
                            </small>
                          </span>
                          <span class="work-row__meta">
                            <small>{{ item.dueDate === null ? 'No due date' : 'Due ' + formatDate(item.dueDate) }}</small>
                            <small>Updated {{ formatDateTime(item.updatedAt) }}</small>
                          </span>
                        </a>
                      }
                      @if (hiddenRiskItemCount(section) > 0) {
                        <a
                          class="risk-more"
                          [routerLink]="['/projects', projectId(), 'work-items']"
                          [queryParams]="scopedWorkQueryParams(section.query)"
                        >
                          View {{ hiddenRiskItemCount(section) }} more
                        </a>
                      }
                    </div>
                  }
                </section>
              }
            </div>
          }
        </section>

        <section class="panel" aria-labelledby="recent-work-heading">
          <div class="panel-heading">
            <div>
              <p class="eyebrow">Movement</p>
              <h2 id="recent-work-heading">Recently changed work</h2>
            </div>
            <span>{{ review.recentlyChangedWork.length }} items</span>
          </div>

          @if (review.recentlyChangedWork.length === 0) {
            <div class="compact-empty">
              <strong>No recent movement</strong>
              <span>Work item updates in this cycle will appear here.</span>
            </div>
          } @else {
            <div class="risk-list">
              @for (item of review.recentlyChangedWork; track item.id) {
                <a
                  class="work-row"
                  [routerLink]="['/work-items', item.id]"
                  [queryParams]="detailQueryParams()"
                >
                  <span class="work-row__title">
                    <strong>{{ item.displayKey }} · {{ item.title }}</strong>
                    <small>
                      {{ workStatusLabel(item.status) }} · {{ priorityLabel(item.priority) }}
                      · {{ item.assignee?.name ?? 'Unassigned' }}
                    </small>
                  </span>
                  <span class="work-row__meta">
                    <small>{{ item.dueDate === null ? 'No due date' : 'Due ' + formatDate(item.dueDate) }}</small>
                    <small>Updated {{ formatDateTime(item.updatedAt) }}</small>
                  </span>
                </a>
              }
            </div>
          }
        </section>
      } @else {
        <app-empty-state
          title="Cycle review unavailable"
          message="No cycle review data was returned for this route."
        />
      }
    </section>
  `,
  styles: `
    .cycle-review-page {
      display: grid;
      gap: 20px;
    }

    .review-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 24px;
    }

    .eyebrow {
      margin: 0 0 8px;
      color: #64748b;
      font-size: 0.75rem;
      font-weight: 800;
      letter-spacing: 0;
      text-transform: uppercase;
    }

    h1,
    h2,
    h3,
    p,
    dl,
    dd {
      margin: 0;
    }

    h1 {
      color: #111827;
      font-size: clamp(1.75rem, 4vw, 2.5rem);
      line-height: 1.05;
    }

    h2 {
      color: #111827;
      font-size: 1.125rem;
      line-height: 1.2;
    }

    h3 {
      color: #111827;
      font-size: 0.95rem;
      line-height: 1.35;
    }

    .review-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 12px;
      color: #475569;
      font-size: 0.8125rem;
      font-weight: 700;
    }

    .review-meta span {
      border: 1px solid #cbd5e1;
      border-radius: 999px;
      padding: 4px 10px;
      background: #ffffff;
    }

    .review-meta__archived {
      border-color: #fecaca !important;
      color: #991b1b;
    }

    .review-copy {
      max-width: 760px;
      margin-top: 14px;
      color: #475569;
      line-height: 1.6;
    }

    .review-actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 8px;
    }

    .review-actions a {
      display: inline-flex;
      align-items: center;
      min-height: 38px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 0 14px;
      background: #ffffff;
      color: #111827;
      font-size: 0.875rem;
      font-weight: 800;
      text-decoration: none;
    }

    .review-actions__primary {
      border-color: #2563eb !important;
      background: #2563eb !important;
      color: #ffffff !important;
    }

    .notice {
      border: 1px solid #fed7aa;
      border-radius: 8px;
      padding: 14px 16px;
      background: #fff7ed;
      color: #7c2d12;
    }

    .notice strong {
      display: block;
      margin-bottom: 4px;
      font-size: 0.875rem;
    }

    .notice p {
      color: #9a3412;
      font-size: 0.875rem;
      line-height: 1.5;
    }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(6, minmax(0, 1fr));
      gap: 12px;
    }

    .summary-grid article,
    .panel {
      border: 1px solid #dbe4ef;
      border-radius: 8px;
      background: #ffffff;
      box-shadow: 0 1px 2px rgb(15 23 42 / 0.04);
    }

    .summary-grid article {
      display: grid;
      gap: 8px;
      padding: 16px;
    }

    .summary-grid span,
    .panel-copy {
      color: #64748b;
      font-size: 0.8125rem;
      font-weight: 700;
    }

    .summary-grid strong {
      color: #111827;
      font-size: 1.5rem;
      line-height: 1;
    }

    .panel {
      display: grid;
      gap: 16px;
      padding: 18px;
    }

    .review-layout,
    .scope-grid {
      display: grid;
      gap: 14px;
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .panel-heading {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }

    .health-pill {
      border: 1px solid #cbd5e1;
      border-radius: 999px;
      padding: 4px 10px;
      background: #f8fafc;
      color: #475569;
      font-size: 0.75rem;
      font-weight: 800;
    }

    .health-pill[data-tone='positive'] {
      border-color: #86efac;
      background: #f0fdf4;
      color: #166534;
    }

    .health-pill[data-tone='warning'] {
      border-color: #fde68a;
      background: #fffbeb;
      color: #92400e;
    }

    .health-pill[data-tone='critical'] {
      border-color: #fecaca;
      background: #fff1f2;
      color: #9f1239;
    }

    .progress-bar {
      display: block;
      height: 8px;
      overflow: hidden;
      border-radius: 999px;
      background: #e2e8f0;
    }

    .progress-bar span {
      display: block;
      height: 100%;
      border-radius: inherit;
      background: #2563eb;
    }

    .progress-bar--estimate span {
      background: #0f766e;
    }

    .reason-list {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .reason-chip {
      border: 1px solid #cbd5e1;
      border-radius: 999px;
      padding: 5px 10px;
      background: #f8fafc;
      color: #334155;
      font-size: 0.75rem;
      font-weight: 800;
      text-decoration: none;
    }

    .reason-chip[data-tone='positive'] {
      border-color: #86efac;
      background: #f0fdf4;
      color: #166534;
    }

    .reason-chip[data-tone='warning'] {
      border-color: #fde68a;
      background: #fffbeb;
      color: #92400e;
    }

    .reason-chip[data-tone='critical'] {
      border-color: #fecaca;
      background: #fff1f2;
      color: #9f1239;
    }

    .compact-empty {
      display: grid;
      gap: 4px;
      border: 1px dashed #cbd5e1;
      border-radius: 8px;
      padding: 14px;
      background: #f8fafc;
      color: #475569;
    }

    .compact-empty strong {
      color: #111827;
      font-size: 0.875rem;
    }

    .compact-empty span {
      color: #64748b;
      font-size: 0.8125rem;
      font-weight: 700;
      line-height: 1.4;
    }

    .breakdown-section,
    .risk-section {
      display: grid;
      gap: 12px;
      min-width: 0;
    }

    .breakdown-section--wide {
      grid-column: 1 / -1;
    }

    .breakdown-list {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }

    .breakdown-list--wide {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }

    .breakdown-list div {
      min-width: 0;
      border: 1px solid #e5e7eb;
      border-radius: 7px;
      padding: 10px;
      background: #f8fafc;
    }

    dt {
      color: #64748b;
      font-size: 0.72rem;
      font-weight: 800;
      letter-spacing: 0;
      text-transform: uppercase;
    }

    dd {
      color: #111827;
      font-size: 1.15rem;
      font-weight: 900;
      line-height: 1.2;
      overflow-wrap: anywhere;
    }

    .risk-section-list,
    .risk-list {
      display: grid;
      gap: 10px;
    }

    .risk-section {
      border-top: 1px solid #e5e7eb;
      padding-top: 14px;
    }

    .risk-section:first-child {
      border-top: 0;
      padding-top: 0;
    }

    .section-heading {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
    }

    .section-heading p {
      margin-top: 4px;
      color: #64748b;
      font-size: 0.875rem;
      line-height: 1.5;
    }

    .section-heading a,
    .risk-more {
      display: inline-flex;
      flex: 0 0 auto;
      align-items: center;
      min-height: 32px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 0 10px;
      background: #ffffff;
      color: #1e3a5f;
      font-size: 0.8125rem;
      font-weight: 800;
      text-decoration: none;
    }

    .work-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 12px;
      align-items: center;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 12px;
      background: #ffffff;
      color: inherit;
      text-decoration: none;
    }

    .work-row:hover,
    .section-heading a:hover,
    .risk-more:hover,
    .reason-chip:hover {
      border-color: #94a3b8;
      background: #f8fafc;
    }

    .work-row__title,
    .work-row__meta {
      display: grid;
      gap: 4px;
      min-width: 0;
    }

    .work-row__title strong {
      color: #111827;
      font-size: 0.875rem;
      line-height: 1.35;
      overflow-wrap: anywhere;
    }

    .work-row small {
      color: #64748b;
      font-size: 0.78rem;
      font-weight: 700;
      line-height: 1.35;
    }

    .work-row__meta {
      text-align: right;
    }

    @media (max-width: 900px) {
      .review-header {
        display: grid;
      }

      .review-actions {
        justify-content: flex-start;
      }

      .summary-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .review-layout,
      .scope-grid {
        grid-template-columns: 1fr;
      }

      .breakdown-list--wide {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    @media (max-width: 560px) {
      .summary-grid,
      .breakdown-list,
      .breakdown-list--wide {
        grid-template-columns: 1fr;
      }

      .section-heading,
      .work-row {
        display: grid;
      }

      .work-row__meta {
        text-align: left;
      }
    }
  `
})
export class ProjectCycleReviewPageComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly cyclesApi = inject(CyclesApi);
  private routeSubscription: Subscription | null = null;

  readonly projectId = signal('');
  readonly cycleId = signal('');
  readonly review = signal<ProjectCycleReviewDto | null>(null);
  readonly isLoading = signal(true);
  readonly error = signal<string | null>(null);
  readonly errorTitle = signal('Cycle review unavailable');

  ngOnInit(): void {
    this.routeSubscription = this.route.paramMap.subscribe((params) => {
      this.projectId.set(params.get('projectId') ?? '');
      this.cycleId.set(params.get('cycleId') ?? '');
      this.loadReview();
    });
  }

  ngOnDestroy(): void {
    this.routeSubscription?.unsubscribe();
  }

  loadReview(): void {
    const projectId = this.projectId();
    const cycleId = this.cycleId();

    if (projectId === '' || cycleId === '') {
      this.review.set(null);
      this.isLoading.set(false);
      this.error.set('Cycle review route is missing required identifiers.');
      return;
    }

    this.isLoading.set(true);
    this.error.set(null);
    this.errorTitle.set('Cycle review unavailable');

    this.cyclesApi.getCycleReview(projectId, cycleId).subscribe({
      next: (review) => {
        this.review.set(review);
        this.isLoading.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.review.set(null);
        this.errorTitle.set(this.toErrorTitle(error));
        this.error.set(this.toErrorMessage(error));
        this.isLoading.set(false);
      }
    });
  }

  completionPercent(review: ProjectCycleReviewDto): number {
    if (review.progress.totalCount === 0) {
      return 0;
    }

    return Math.round((review.progress.doneCount / review.progress.totalCount) * 100);
  }

  estimatePercent(review: ProjectCycleReviewDto): number {
    if (review.progress.committedEstimatePoints === 0) {
      return 0;
    }

    return Math.min(
      100,
      Math.round(
        (review.progress.completedEstimatePoints / review.progress.committedEstimatePoints) * 100
      )
    );
  }

  statusLabel(status: ProjectCycleReviewDto['cycle']['status']): string {
    return cycleStatusLabel(status);
  }

  dateRangeLabel(review: ProjectCycleReviewDto): string {
    return cycleDateRangeLabel(review.cycle);
  }

  healthLabel(health: DeliveryHealthState): string {
    return cycleHealthLabel(health);
  }

  healthTone(health: DeliveryHealthState): string {
    return deliveryHealthTone(health);
  }

  severityTone(severity: DeliveryHealthReasonDto['severity']): string {
    return deliveryHealthSeverityTone(severity);
  }

  topReasons(reasons: DeliveryHealthReasonDto[]): DeliveryHealthReasonDto[] {
    return reasons.slice(0, 4);
  }

  reasonLabel(reason: DeliveryHealthReasonDto): string {
    return deliveryHealthReasonLabel(reason);
  }

  reasonQueryParams(reason: DeliveryHealthReasonDto): Record<string, string> | null {
    if (reason.query === null) {
      return null;
    }

    return this.scopedWorkQueryParams(reason.query);
  }

  statusBreakdown(scope: CycleReviewScopeBreakdownDto): BreakdownMetric[] {
    return workItemStatuses.map((status) => ({
      label: statusLabels[status],
      value: scope.statusCounts[status]
    }));
  }

  priorityBreakdown(scope: CycleReviewScopeBreakdownDto): BreakdownMetric[] {
    return workItemPriorities.map((priority) => ({
      label: priorityLabels[priority],
      value: scope.priorityCounts[priority]
    }));
  }

  planningBreakdown(scope: CycleReviewScopeBreakdownDto): BreakdownMetric[] {
    return [
      { label: 'Assigned', value: scope.assignedCount },
      { label: 'Unassigned', value: scope.unassignedCount },
      { label: 'Overdue', value: scope.dueDate.overdueCount },
      { label: 'Due soon', value: scope.dueDate.dueSoonCount },
      { label: 'Later', value: scope.dueDate.laterCount },
      { label: 'No due date', value: scope.dueDate.noneCount },
      { label: 'Dependency blocked', value: scope.dependency.dependencyBlockedCount },
      { label: 'Blocking open work', value: scope.dependency.blockingOpenWorkCount }
    ];
  }

  totalRiskCount(review: ProjectCycleReviewDto): number {
    return review.riskSections.reduce((total, section) => total + section.count, 0);
  }

  riskHeadingId(section: CycleReviewRiskSectionDto): string {
    return `cycle-risk-${section.type}`;
  }

  visibleRiskItems(section: CycleReviewRiskSectionDto): PlanningRiskItemDto[] {
    return section.items.slice(0, visibleRiskItemLimit);
  }

  hiddenRiskItemCount(section: CycleReviewRiskSectionDto): number {
    return Math.max(section.count - visibleRiskItemLimit, 0);
  }

  detailQueryParams(): { returnUrl: string } {
    return { returnUrl: `/projects/${this.projectId()}/cycles/${this.cycleId()}` };
  }

  targetVarianceLabel(review: ProjectCycleReviewDto): string {
    const target = review.progress.targetPoints;

    if (target === null) {
      return 'No target';
    }

    const variance = review.progress.committedEstimatePoints - target;

    if (variance > 0) {
      return `${variance} over target`;
    }

    if (variance < 0) {
      return `${Math.abs(variance)} under target`;
    }

    return 'On target';
  }

  targetTone(review: ProjectCycleReviewDto): string {
    const target = review.progress.targetPoints;

    if (target === null) {
      return 'neutral';
    }

    return review.progress.committedEstimatePoints > target ? 'warning' : 'positive';
  }

  workStatusLabel(status: WorkItemStatus): string {
    return statusLabels[status];
  }

  priorityLabel(priority: WorkItemPriority): string {
    return priorityLabels[priority];
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
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    }).format(new Date(value));
  }

  scopedWorkQueryParams(query: WorkItemQuery): Record<string, string> | null {
    return routerLinkQueryParamsFromWorkItemQuery(query, 'project');
  }

  private toErrorTitle(error: HttpErrorResponse): string {
    if (error.status === 404) {
      return 'Cycle review not found';
    }

    if (error.status === 403) {
      return 'Cycle review restricted';
    }

    return 'Cycle review unavailable';
  }

  private toErrorMessage(error: HttpErrorResponse): string {
    if (error.status === 404) {
      return 'The selected cycle could not be found.';
    }

    if (error.status === 403) {
      return 'You do not have permission to view this cycle review.';
    }

    const message = (error.error as { error?: { message?: string } } | null)?.error?.message;
    return message ?? 'Cycle review could not be loaded.';
  }
}
