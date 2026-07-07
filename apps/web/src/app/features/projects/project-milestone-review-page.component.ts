import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import type {
  DeliveryHealthReasonDto,
  DeliveryHealthState,
  MilestoneReviewDto,
  MilestoneReviewRiskSectionDto,
  MilestoneReviewScopeBreakdownDto,
  PlanningRiskItemDto,
  WorkItemPriority,
  WorkItemQuery,
  WorkItemStatus
} from '@worktrail/contracts';
import { Subscription } from 'rxjs';

import { WorktrailApiService } from '../../core/worktrail-api.service';
import {
  deliveryHealthLabel,
  deliveryHealthReasonLabel,
  deliveryHealthSeverityTone,
  deliveryHealthTone
} from '../../shared/delivery-health/delivery-health-display';
import { ErrorPanelComponent } from '../../shared/ui/error-panel.component';
import { LoadingIndicatorComponent } from '../../shared/ui/loading-indicator.component';

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
  selector: 'app-project-milestone-review-page',
  imports: [ErrorPanelComponent, LoadingIndicatorComponent, RouterLink],
  template: `
    @if (isLoading()) {
      <app-loading-indicator label="Loading milestone review" />
    } @else if (error()) {
      <app-error-panel [message]="error() ?? ''" (retry)="loadReview()" />
    } @else if (review(); as review) {
      <section class="review-header">
        <div>
          <p class="eyebrow">Milestone</p>
          <h1>{{ review.milestone.name }}</h1>
          <div class="review-meta">
            <span>{{ review.project.key }}</span>
            <span>{{ review.project.name }}</span>
            <span>{{ formatToken(review.milestone.status) }}</span>
            <span>{{ review.milestone.targetDate === null ? 'No target date' : 'Target ' + formatDate(review.milestone.targetDate) }}</span>
            @if (review.milestone.isArchived) {
              <span class="review-meta__archived">Archived</span>
            }
          </div>
          <p class="review-copy">
            {{ review.milestone.description || 'No description provided.' }}
          </p>
        </div>

        <div class="review-actions">
          <a [routerLink]="['/projects', projectId(), 'planning']">Back to Planning</a>
          <a
            class="review-actions__primary"
            [routerLink]="['/projects', projectId(), 'work-items']"
            [queryParams]="scopedWorkQueryParams()"
          >
            Open scoped work
          </a>
        </div>
      </section>

      @if (review.project.status === 'archived' || review.milestone.isArchived) {
        <section class="notice" aria-label="Read-only milestone review">
          <strong>Read-only review</strong>
          <p>Archived project and milestone data remains readable from this page.</p>
        </section>
      }

      <section class="summary-grid" aria-label="Milestone progress summary">
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
          <span>Dependency blocked</span>
          <strong>{{ review.progress.dependencyBlockedCount }}</strong>
        </article>
      </section>

      <div class="review-layout">
        <section class="panel health-panel" aria-labelledby="review-health-heading">
          <div class="panel-heading">
            <div>
              <p class="panel-eyebrow">Health</p>
              <h2 id="review-health-heading">{{ healthLabel(review.progress.health) }}</h2>
            </div>
            <span class="health-pill" [attr.data-tone]="healthTone(review.progress.health)">
              {{ healthLabel(review.progress.health) }}
            </span>
          </div>

          <span class="progress-bar" aria-hidden="true">
            <span [style.width.%]="completionPercent(review)"></span>
          </span>

          @if (review.progress.reasons.length === 0) {
            <div class="compact-empty">
              <strong>No milestone risks found</strong>
              <span>This milestone has no surfaced delivery-health reasons.</span>
            </div>
          } @else {
            <div class="reason-list" aria-label="Milestone health reasons">
              @for (reason of topReasons(review.progress.reasons); track reason.key + reason.message) {
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

        <section class="panel" aria-labelledby="scope-breakdown-heading">
          <div class="panel-heading">
            <div>
              <p class="panel-eyebrow">Scope</p>
              <h2 id="scope-breakdown-heading">Breakdown</h2>
            </div>
          </div>

          <div class="breakdown-section">
            <h3>Status</h3>
            <dl class="breakdown-list">
              @for (metric of statusBreakdown(review.scopeBreakdown); track metric.label) {
                <div>
                  <dt>{{ metric.label }}</dt>
                  <dd>{{ metric.value }}</dd>
                </div>
              }
            </dl>
          </div>

          <div class="breakdown-section">
            <h3>Priority</h3>
            <dl class="breakdown-list">
              @for (metric of priorityBreakdown(review.scopeBreakdown); track metric.label) {
                <div>
                  <dt>{{ metric.label }}</dt>
                  <dd>{{ metric.value }}</dd>
                </div>
              }
            </dl>
          </div>

          <div class="breakdown-section">
            <h3>Ownership, dates, and dependencies</h3>
            <dl class="breakdown-list breakdown-list--wide">
              @for (metric of planningBreakdown(review.scopeBreakdown); track metric.label) {
                <div>
                  <dt>{{ metric.label }}</dt>
                  <dd>{{ metric.value }}</dd>
                </div>
              }
            </dl>
          </div>
        </section>
      </div>

      <section class="panel" aria-labelledby="risk-sections-heading">
        <div class="panel-heading">
          <div>
            <p class="panel-eyebrow">Risks</p>
            <h2 id="risk-sections-heading">Needs attention</h2>
          </div>
          <span>{{ totalRiskCount(review) }} items</span>
        </div>

        @if (review.riskSections.length === 0) {
          <div class="compact-empty">
            <strong>No risk sections</strong>
            <span>Current milestone work has no surfaced risk categories.</span>
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
                    [queryParams]="queryParamsFromQuery(section.query)"
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
                            {{ statusLabel(item.status) }} · {{ priorityLabel(item.priority) }}
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
                        [queryParams]="queryParamsFromQuery(section.query)"
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
            <p class="panel-eyebrow">Movement</p>
            <h2 id="recent-work-heading">Recently changed work</h2>
          </div>
          <span>{{ review.recentlyChangedWork.length }} items</span>
        </div>

        @if (review.recentlyChangedWork.length === 0) {
          <div class="compact-empty">
            <strong>No recent movement</strong>
            <span>Work item updates in this milestone will appear here.</span>
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
                    {{ statusLabel(item.status) }} · {{ priorityLabel(item.priority) }}
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
    }
  `,
  styles: `
    :host {
      display: block;
    }

    .review-header {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 20px;
      align-items: start;
      margin-bottom: 24px;
    }

    .eyebrow,
    .panel-eyebrow {
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
    p {
      margin: 0;
    }

    h1,
    h2,
    h3 {
      color: #111827;
      line-height: 1.25;
    }

    h1 {
      font-size: clamp(1.6rem, 2vw, 2.25rem);
      line-height: 1.1;
      overflow-wrap: anywhere;
    }

    h2 {
      font-size: 1.1rem;
    }

    h3 {
      font-size: 0.9rem;
    }

    .review-meta,
    .review-actions,
    .reason-list {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 12px;
    }

    .review-meta span {
      border: 1px solid #cbd5e1;
      border-radius: 999px;
      padding: 4px 10px;
      background: #ffffff;
      color: #334155;
      font-size: 0.75rem;
      font-weight: 800;
    }

    .review-meta__archived {
      border-color: #fca5a5 !important;
      background: #fff1f2 !important;
      color: #991b1b !important;
    }

    .review-copy {
      max-width: 72ch;
      margin-top: 12px;
      color: #475569;
      line-height: 1.6;
    }

    .review-actions {
      justify-content: flex-end;
    }

    .review-actions a,
    .section-heading a {
      display: inline-flex;
      align-items: center;
      min-height: 38px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 0 14px;
      background: #ffffff;
      color: #111827;
      font-weight: 800;
      text-decoration: none;
    }

    .review-actions a:hover,
    .section-heading a:hover,
    .work-row:hover,
    .risk-more:hover,
    .reason-chip:hover {
      background: #f8fafc;
    }

    .review-actions__primary {
      border-color: #2563eb !important;
      background: #2563eb !important;
      color: #ffffff !important;
    }

    .notice {
      margin-bottom: 20px;
      border: 1px solid #fde68a;
      border-radius: 8px;
      padding: 14px 16px;
      background: #fffbeb;
      color: #78350f;
    }

    .notice p {
      margin-top: 4px;
      color: #92400e;
      line-height: 1.5;
    }

    .summary-grid,
    .review-layout {
      display: grid;
      gap: 12px;
      margin-bottom: 20px;
    }

    .summary-grid {
      grid-template-columns: repeat(6, minmax(0, 1fr));
    }

    .review-layout {
      grid-template-columns: minmax(280px, 0.85fr) minmax(0, 1.15fr);
    }

    .summary-grid article,
    .panel {
      border: 1px solid #dbe4ef;
      border-radius: 8px;
      padding: 16px;
      background: #ffffff;
      box-shadow: 0 12px 28px rgba(15, 23, 42, 0.04);
    }

    .panel {
      margin-bottom: 20px;
    }

    .summary-grid span,
    dt,
    .panel-heading > span {
      color: #64748b;
      font-size: 0.72rem;
      font-weight: 900;
      text-transform: uppercase;
    }

    .summary-grid strong {
      display: block;
      margin-top: 6px;
      color: #111827;
      font-size: 1.6rem;
      line-height: 1;
      overflow-wrap: anywhere;
    }

    .panel-heading,
    .section-heading {
      display: flex;
      align-items: start;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 14px;
    }

    .section-heading p {
      margin-top: 4px;
      color: #64748b;
      font-size: 0.875rem;
      line-height: 1.5;
    }

    .health-pill {
      display: inline-flex;
      align-items: center;
      min-height: 26px;
      border: 1px solid #cbd5e1;
      border-radius: 999px;
      padding: 4px 9px;
      background: #f8fafc;
      color: #334155;
      font-size: 0.75rem;
      font-weight: 900;
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
      background: #fff1f2;
      color: #991b1b;
    }

    .health-pill[data-tone='info'] {
      border-color: #93c5fd;
      background: #eff6ff;
      color: #1e40af;
    }

    .progress-bar {
      display: block;
      overflow: hidden;
      height: 8px;
      margin-bottom: 14px;
      border-radius: 999px;
      background: #e5e7eb;
    }

    .progress-bar span {
      display: block;
      height: 100%;
      border-radius: inherit;
      background: #2563eb;
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

    .breakdown-section + .breakdown-section,
    .risk-section + .risk-section {
      margin-top: 18px;
    }

    .breakdown-section h3 {
      margin-bottom: 8px;
    }

    .breakdown-list {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8px;
      margin: 0;
    }

    .breakdown-list--wide {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }

    .breakdown-list div {
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 10px;
      background: #f8fafc;
    }

    dd {
      margin: 4px 0 0;
      color: #111827;
      font-size: 1.05rem;
      font-weight: 900;
      line-height: 1;
    }

    .compact-empty {
      display: grid;
      gap: 4px;
      border: 1px dashed #cbd5e1;
      border-radius: 8px;
      padding: 14px;
      background: #f8fafc;
    }

    .compact-empty strong {
      color: #111827;
      font-size: 0.875rem;
    }

    .compact-empty span {
      color: #64748b;
      font-size: 0.8125rem;
      line-height: 1.5;
    }

    .risk-list,
    .risk-section-list {
      display: grid;
      gap: 8px;
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
      color: #111827;
      text-decoration: none;
    }

    .work-row__title,
    .work-row__meta {
      display: grid;
      gap: 4px;
      min-width: 0;
    }

    .work-row strong {
      overflow-wrap: anywhere;
      color: #111827;
      font-size: 0.875rem;
      line-height: 1.35;
    }

    .work-row small {
      color: #64748b;
      font-size: 0.75rem;
      font-weight: 800;
      line-height: 1.4;
    }

    .work-row__meta {
      justify-items: end;
      text-align: right;
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

    @media (max-width: 1100px) {
      .summary-grid {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }

      .review-layout {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 900px) {
      .review-header {
        grid-template-columns: 1fr;
      }

      .review-actions {
        justify-content: flex-start;
      }

      .breakdown-list,
      .breakdown-list--wide {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    @media (max-width: 640px) {
      .summary-grid,
      .breakdown-list,
      .breakdown-list--wide {
        grid-template-columns: 1fr;
      }

      .panel-heading,
      .section-heading,
      .work-row {
        grid-template-columns: 1fr;
      }

      .section-heading,
      .panel-heading {
        display: grid;
      }

      .work-row__meta {
        justify-items: start;
        text-align: left;
      }
    }
  `
})
export class ProjectMilestoneReviewPageComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(WorktrailApiService);
  private routeSubscription: Subscription | null = null;

  readonly review = signal<MilestoneReviewDto | null>(null);
  readonly isLoading = signal(true);
  readonly error = signal<string | null>(null);

  readonly projectId = computed(() => this.route.snapshot.paramMap.get('projectId') ?? '');
  readonly milestoneId = computed(() => this.route.snapshot.paramMap.get('milestoneId') ?? '');
  readonly scopedWorkQueryParams = computed(() => {
    const query = this.review()?.scopedWorkQuery ?? {};
    return this.queryParamsFromQuery(query);
  });

  ngOnInit(): void {
    this.routeSubscription = this.route.paramMap.subscribe(() => {
      this.loadReview();
    });
  }

  ngOnDestroy(): void {
    this.routeSubscription?.unsubscribe();
  }

  loadReview(): void {
    const projectId = this.projectId();
    const milestoneId = this.milestoneId();

    if (projectId === '' || milestoneId === '') {
      this.isLoading.set(false);
      this.error.set('Milestone review route is missing required identifiers.');
      return;
    }

    this.isLoading.set(true);
    this.error.set(null);

    this.api.getMilestoneReview(projectId, milestoneId).subscribe({
      next: (review) => {
        this.review.set(review);
        this.isLoading.set(false);
      },
      error: () => {
        this.error.set('Milestone review could not be loaded.');
        this.isLoading.set(false);
      }
    });
  }

  completionPercent(review: MilestoneReviewDto): number {
    if (review.progress.totalCount === 0) {
      return 0;
    }

    return Math.round((review.progress.doneCount / review.progress.totalCount) * 100);
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

  reasonLabel(reason: DeliveryHealthReasonDto): string {
    return deliveryHealthReasonLabel(reason);
  }

  reasonQueryParams(reason: DeliveryHealthReasonDto): Record<string, string> | null {
    return this.queryParamsFromQuery(reason.query);
  }

  statusBreakdown(scope: MilestoneReviewScopeBreakdownDto): BreakdownMetric[] {
    return workItemStatuses.map((status) => ({
      label: statusLabels[status],
      value: scope.statusCounts[status]
    }));
  }

  priorityBreakdown(scope: MilestoneReviewScopeBreakdownDto): BreakdownMetric[] {
    return workItemPriorities.map((priority) => ({
      label: priorityLabels[priority],
      value: scope.priorityCounts[priority]
    }));
  }

  planningBreakdown(scope: MilestoneReviewScopeBreakdownDto): BreakdownMetric[] {
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

  totalRiskCount(review: MilestoneReviewDto): number {
    return review.riskSections.reduce((total, section) => total + section.count, 0);
  }

  riskHeadingId(section: MilestoneReviewRiskSectionDto): string {
    return `risk-${section.type}`;
  }

  visibleRiskItems(section: MilestoneReviewRiskSectionDto): PlanningRiskItemDto[] {
    return section.items.slice(0, visibleRiskItemLimit);
  }

  hiddenRiskItemCount(section: MilestoneReviewRiskSectionDto): number {
    return Math.max(section.count - visibleRiskItemLimit, 0);
  }

  detailQueryParams(): { returnUrl: string } {
    return { returnUrl: `/projects/${this.projectId()}/milestones/${this.milestoneId()}` };
  }

  queryParamsFromQuery(query: WorkItemQuery | null): Record<string, string> | null {
    if (query === null) {
      return null;
    }

    const params = Object.fromEntries(
      Object.entries(query)
        .filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== '')
        .map(([key, value]) => [key, String(value)])
    );

    return Object.keys(params).length === 0 ? null : params;
  }

  formatToken(value: string): string {
    return value.replaceAll('_', ' ');
  }

  statusLabel(status: WorkItemStatus): string {
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
}
