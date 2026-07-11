import { Component, OnInit, computed, inject, signal } from '@angular/core';
import type { PortfolioDto } from '@worktrail/contracts';

import { WorktrailApiService } from '../../core/worktrail-api.service';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { ErrorPanelComponent } from '../../shared/ui/error-panel.component';
import { LoadingIndicatorComponent } from '../../shared/ui/loading-indicator.component';

@Component({
  selector: 'app-portfolio-page',
  imports: [EmptyStateComponent, ErrorPanelComponent, LoadingIndicatorComponent],
  template: `
    <section class="page-header">
      <div>
        <p class="eyebrow">Portfolio</p>
        <h1>Portfolio review</h1>
        <p>Workspace-level project health, communication freshness, and current execution context.</p>
      </div>
    </section>

    @if (isLoading()) {
      <app-loading-indicator label="Loading portfolio" />
    } @else if (error()) {
      <app-error-panel
        title="Portfolio unavailable"
        [message]="error() ?? ''"
        (retry)="loadPortfolio()"
      />
    } @else if (portfolio(); as portfolio) {
      @if (isEmpty()) {
        <app-empty-state
          title="No active projects"
          message="Portfolio review appears here once the workspace has active projects."
        />
      } @else {
        <section class="portfolio-summary" aria-label="Portfolio summary">
          <article>
            <span>Active projects</span>
            <strong>{{ portfolio.summary.activeProjectCount }}</strong>
          </article>
          <article>
            <span>At risk</span>
            <strong>{{ portfolio.summary.atRiskProjectCount }}</strong>
          </article>
          <article>
            <span>Blocked</span>
            <strong>{{ portfolio.summary.blockedProjectCount }}</strong>
          </article>
          <article>
            <span>Reports stale or missing</span>
            <strong>{{ portfolio.summary.missingOrStaleReportProjectCount }}</strong>
          </article>
        </section>

        <section class="portfolio-preview" aria-labelledby="portfolio-preview-heading">
          <div class="section-heading">
            <h2 id="portfolio-preview-heading">Active project rows</h2>
            <span>Generated {{ formatGeneratedAt(portfolio.generatedAt) }}</span>
          </div>

          <div class="project-list">
            @for (row of portfolio.projects; track row.project.id) {
              <article class="project-row">
                <div>
                  <strong>{{ row.project.name }}</strong>
                  <span>{{ row.project.key }}</span>
                </div>
                <span class="health-pill" [attr.data-health]="row.deliveryHealth.health">
                  {{ healthLabel(row.deliveryHealth.health) }}
                </span>
                <span>{{ row.openWorkItemCount }} open</span>
                <span>{{ reportFreshnessLabel(row.report.freshness) }}</span>
              </article>
            }
          </div>
        </section>
      }
    }
  `,
  styles: `
    :host {
      display: block;
    }

    .page-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 24px;
    }

    .eyebrow {
      margin: 0 0 6px;
      color: #64748b;
      font-size: 0.78rem;
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
      font-size: 2rem;
      line-height: 1.1;
    }

    .page-header p:not(.eyebrow),
    .section-heading span {
      margin-top: 8px;
      color: #52637a;
      font-size: 0.95rem;
      line-height: 1.5;
    }

    .portfolio-summary {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
      margin-bottom: 20px;
    }

    .portfolio-summary article,
    .portfolio-preview {
      border: 1px solid #dbe3ef;
      border-radius: 8px;
      background: #ffffff;
    }

    .portfolio-summary article {
      display: grid;
      gap: 6px;
      min-height: 86px;
      padding: 16px;
    }

    .portfolio-summary span,
    .project-row span {
      color: #52637a;
      font-size: 0.85rem;
      font-weight: 650;
    }

    .portfolio-summary strong {
      color: #111827;
      font-size: 1.75rem;
      line-height: 1;
    }

    .portfolio-preview {
      overflow: hidden;
    }

    .section-heading {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      border-bottom: 1px solid #e5edf6;
      padding: 16px;
    }

    h2 {
      color: #111827;
      font-size: 1rem;
      line-height: 1.3;
    }

    .project-list {
      display: grid;
    }

    .project-row {
      display: grid;
      grid-template-columns: minmax(180px, 1fr) repeat(3, minmax(96px, max-content));
      align-items: center;
      gap: 16px;
      min-height: 68px;
      border-bottom: 1px solid #edf2f7;
      padding: 14px 16px;
    }

    .project-row:last-child {
      border-bottom: 0;
    }

    .project-row div {
      display: grid;
      gap: 4px;
    }

    .project-row strong {
      color: #111827;
      line-height: 1.3;
    }

    .health-pill {
      width: fit-content;
      border-radius: 999px;
      padding: 4px 8px;
      background: #e0f2fe;
      color: #075985;
    }

    .health-pill[data-health='at_risk'] {
      background: #fef3c7;
      color: #92400e;
    }

    .health-pill[data-health='blocked'] {
      background: #fee2e2;
      color: #991b1b;
    }

    .health-pill[data-health='complete'] {
      background: #dcfce7;
      color: #166534;
    }

    .health-pill[data-health='inactive'] {
      background: #e5e7eb;
      color: #374151;
    }

    @media (max-width: 860px) {
      .portfolio-summary,
      .project-row {
        grid-template-columns: 1fr;
      }

      .section-heading {
        display: grid;
      }
    }
  `
})
export class PortfolioPageComponent implements OnInit {
  private readonly api = inject(WorktrailApiService);

  readonly portfolio = signal<PortfolioDto | null>(null);
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);
  readonly isEmpty = computed(() => (this.portfolio()?.projects.length ?? 0) === 0);

  ngOnInit(): void {
    this.loadPortfolio();
  }

  loadPortfolio(): void {
    this.isLoading.set(true);
    this.error.set(null);

    this.api.getPortfolio().subscribe({
      next: (portfolio) => {
        this.portfolio.set(portfolio);
        this.isLoading.set(false);
      },
      error: () => {
        this.error.set('Portfolio review could not be loaded from the API.');
        this.isLoading.set(false);
      }
    });
  }

  formatGeneratedAt(value: string): string {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(new Date(value));
  }

  healthLabel(value: PortfolioDto['projects'][number]['deliveryHealth']['health']): string {
    return value
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  reportFreshnessLabel(value: PortfolioDto['projects'][number]['report']['freshness']): string {
    if (value === 'missing') {
      return 'Report missing';
    }

    return value === 'stale' ? 'Report stale' : 'Report fresh';
  }
}
