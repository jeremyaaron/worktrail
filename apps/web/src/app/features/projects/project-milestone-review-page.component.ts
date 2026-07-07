import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import type { MilestoneReviewDto } from '@worktrail/contracts';
import { Subscription } from 'rxjs';

import { WorktrailApiService } from '../../core/worktrail-api.service';
import { ErrorPanelComponent } from '../../shared/ui/error-panel.component';
import { LoadingIndicatorComponent } from '../../shared/ui/loading-indicator.component';

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
            <span>{{ formatToken(review.milestone.status) }}</span>
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

      <section class="panel" aria-labelledby="review-health-heading">
        <p class="panel-eyebrow">Health</p>
        <h2 id="review-health-heading">{{ formatToken(review.progress.health) }}</h2>
        <p>
          {{ review.progress.reasons.length }}
          {{ review.progress.reasons.length === 1 ? 'reason' : 'reasons' }} surfaced for this milestone.
        </p>
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
    p {
      margin: 0;
    }

    h1 {
      color: #111827;
      font-size: clamp(1.6rem, 2vw, 2.25rem);
      line-height: 1.1;
    }

    h2 {
      color: #111827;
      font-size: 1.1rem;
      line-height: 1.3;
    }

    .review-meta,
    .review-actions {
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

    .review-actions a {
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

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 12px;
      margin-bottom: 20px;
    }

    .summary-grid article,
    .panel {
      border: 1px solid #dbe4ef;
      border-radius: 8px;
      padding: 16px;
      background: #ffffff;
      box-shadow: 0 12px 28px rgba(15, 23, 42, 0.04);
    }

    .summary-grid span {
      display: block;
      color: #64748b;
      font-size: 0.78rem;
      font-weight: 800;
    }

    .summary-grid strong {
      display: block;
      margin-top: 6px;
      color: #111827;
      font-size: 1.6rem;
      line-height: 1;
    }

    .panel p:not(.panel-eyebrow) {
      margin-top: 8px;
      color: #475569;
      line-height: 1.5;
    }

    @media (max-width: 900px) {
      .review-header {
        grid-template-columns: 1fr;
      }

      .review-actions {
        justify-content: flex-start;
      }

      .summary-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    @media (max-width: 560px) {
      .summary-grid {
        grid-template-columns: 1fr;
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
    return Object.fromEntries(
      Object.entries(query).filter(([, value]) => value !== undefined && value !== null)
    );
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

  formatToken(value: string): string {
    return value.replaceAll('_', ' ');
  }
}
