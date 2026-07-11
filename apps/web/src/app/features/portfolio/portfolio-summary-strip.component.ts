import { Component, input } from '@angular/core';
import type { PortfolioSummaryDto } from '@worktrail/contracts';

@Component({
  selector: 'app-portfolio-summary-strip',
  template: `
    <section class="portfolio-summary" aria-label="Portfolio summary">
      @for (item of summaryItems(); track item.label) {
        <article [attr.data-tone]="item.tone">
          <span>{{ item.label }}</span>
          <strong>{{ item.value }}</strong>
        </article>
      }
    </section>
  `,
  styles: `
    .portfolio-summary {
      display: grid;
      grid-template-columns: repeat(7, minmax(0, 1fr));
      gap: 10px;
    }

    article {
      display: grid;
      gap: 6px;
      min-height: 78px;
      border: 1px solid #dbe3ef;
      border-top: 3px solid #94a3b8;
      border-radius: 8px;
      padding: 12px;
      background: #ffffff;
    }

    article[data-tone='positive'] {
      border-top-color: #16a34a;
    }

    article[data-tone='warning'] {
      border-top-color: #d97706;
    }

    article[data-tone='critical'] {
      border-top-color: #dc2626;
    }

    article[data-tone='info'] {
      border-top-color: #2563eb;
    }

    span {
      color: #52637a;
      font-size: 0.78rem;
      font-weight: 750;
      line-height: 1.25;
    }

    strong {
      color: #111827;
      font-size: 1.55rem;
      line-height: 1;
    }

    @media (max-width: 1100px) {
      .portfolio-summary {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
    }

    @media (max-width: 700px) {
      .portfolio-summary {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
  `
})
export class PortfolioSummaryStripComponent {
  readonly summary = input.required<PortfolioSummaryDto>();

  summaryItems(): Array<{ label: string; value: number; tone: string }> {
    const summary = this.summary();

    return [
      { label: 'Active', value: summary.activeProjectCount, tone: 'info' },
      { label: 'On track', value: summary.onTrackProjectCount, tone: 'positive' },
      { label: 'At risk', value: summary.atRiskProjectCount, tone: 'warning' },
      { label: 'Blocked', value: summary.blockedProjectCount, tone: 'critical' },
      { label: 'Overdue', value: summary.overdueProjectCount, tone: 'warning' },
      {
        label: 'Dependency pressure',
        value: summary.dependencyPressureProjectCount,
        tone: 'critical'
      },
      {
        label: 'Reports stale or missing',
        value: summary.missingOrStaleReportProjectCount,
        tone: 'neutral'
      }
    ];
  }
}
