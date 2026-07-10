import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import type { DeliveryHealthState, ProjectCycleReviewDto, WorkItemQuery } from '@worktrail/contracts';
import { Subscription } from 'rxjs';

import { CyclesApi } from '../../core/api/cycles-api';
import {
  cycleDateRangeLabel,
  cycleHealthLabel,
  cycleStatusLabel
} from '../../shared/cycles/cycle-display';
import { deliveryHealthTone } from '../../shared/delivery-health/delivery-health-display';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { ErrorPanelComponent } from '../../shared/ui/error-panel.component';
import { LoadingIndicatorComponent } from '../../shared/ui/loading-indicator.component';
import { routerLinkQueryParamsFromWorkItemQuery } from '../work-items/query/work-item-query-serialization';

@Component({
  selector: 'app-project-cycle-review-page',
  imports: [EmptyStateComponent, ErrorPanelComponent, LoadingIndicatorComponent, RouterLink],
  template: `
    <section class="cycle-review-page">
      @if (isLoading()) {
        <app-loading-indicator label="Loading cycle review" />
      } @else if (error()) {
        <app-error-panel
          title="Cycle review unavailable"
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
            <p class="panel-copy">No cycle health reasons surfaced.</p>
          } @else {
            <div class="reason-list" aria-label="Cycle health reasons">
              @for (reason of review.health.reasons.slice(0, 4); track reason.key + reason.message) {
                <span class="reason-chip">{{ reason.message }}</span>
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
    p {
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

    this.cyclesApi.getCycleReview(projectId, cycleId).subscribe({
      next: (review) => {
        this.review.set(review);
        this.isLoading.set(false);
      },
      error: () => {
        this.review.set(null);
        this.error.set('Cycle review could not be loaded.');
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

  scopedWorkQueryParams(query: WorkItemQuery): Record<string, string> | null {
    return routerLinkQueryParamsFromWorkItemQuery(query, 'project');
  }
}
