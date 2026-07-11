import { Component, OnInit, computed, inject, signal } from '@angular/core';
import type { PortfolioDto } from '@worktrail/contracts';

import { WorktrailApiService } from '../../core/worktrail-api.service';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { ErrorPanelComponent } from '../../shared/ui/error-panel.component';
import { LoadingIndicatorComponent } from '../../shared/ui/loading-indicator.component';
import { PortfolioAttentionSectionsComponent } from './portfolio-attention-sections.component';
import { PortfolioProjectComparisonComponent } from './portfolio-project-comparison.component';
import { formatDateTime } from './portfolio-display';
import { PortfolioSummaryStripComponent } from './portfolio-summary-strip.component';

@Component({
  selector: 'app-portfolio-page',
  imports: [
    EmptyStateComponent,
    ErrorPanelComponent,
    LoadingIndicatorComponent,
    PortfolioAttentionSectionsComponent,
    PortfolioProjectComparisonComponent,
    PortfolioSummaryStripComponent
  ],
  template: `
    <section class="page-header">
      <div>
        <p class="eyebrow">Portfolio</p>
        <h1>Portfolio review</h1>
        <p>
          Workspace-level project health, communication freshness, and current execution context.
        </p>
        @if (portfolio(); as portfolio) {
          <span>
            Generated {{ formatGeneratedAt(portfolio.generatedAt) }} · Report freshness threshold:
            {{ portfolio.reportFreshnessThresholdDays }} days
          </span>
        }
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
        <div class="portfolio-layout">
          <app-portfolio-summary-strip [summary]="portfolio.summary" />
          <app-portfolio-attention-sections [attention]="portfolio.attention" />
          <app-portfolio-project-comparison [rows]="portfolio.projects" />
        </div>
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
    .page-header span {
      display: block;
      margin-top: 8px;
      color: #52637a;
      font-size: 0.95rem;
      line-height: 1.5;
    }

    .portfolio-layout {
      display: grid;
      gap: 18px;
    }

    @media (max-width: 860px) {
      .page-header {
        display: block;
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
    return formatDateTime(value);
  }
}
