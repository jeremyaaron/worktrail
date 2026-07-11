import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { PortfolioLinkDto, PortfolioProjectRowDto } from '@worktrail/contracts';

import {
  formatDate,
  healthLabel,
  healthTone,
  portfolioLinkQueryParams,
  reportFreshnessLabel,
  reportFreshnessTone
} from './portfolio-display';

@Component({
  selector: 'app-portfolio-project-comparison',
  imports: [RouterLink],
  template: `
    <section class="project-panel" aria-labelledby="portfolio-projects-heading">
      <div class="panel-heading">
        <h2 id="portfolio-projects-heading">Project comparison</h2>
        <span>{{ rows().length }} active</span>
      </div>

      <div class="project-list">
        @for (row of rows(); track row.project.id) {
          <article class="project-row">
            <div class="project-main">
              <div>
                <a class="project-name" [routerLink]="row.links.overview.route">
                  {{ row.project.name }}
                </a>
                <span>{{ row.project.key }} · Updated {{ formatDate(row.updatedAt) }}</span>
              </div>

              <span class="tone-pill" [attr.data-tone]="healthTone(row.deliveryHealth.health)">
                {{ healthLabel(row.deliveryHealth.health) }}
              </span>
            </div>

            <div class="row-section row-section--wide" aria-label="Delivery health reasons">
              @if (row.deliveryHealth.reasons.length === 0) {
                <span class="muted">No delivery health reasons.</span>
              } @else {
                @for (reason of row.deliveryHealth.reasons.slice(0, 2); track reason.key) {
                  <span class="reason">{{ reason.message }}</span>
                }
              }
            </div>

            <div class="metric-grid" aria-label="Work counts">
              <span><strong>{{ row.openWorkItemCount }}</strong> open</span>
              <span><strong>{{ row.blockedWorkItemCount }}</strong> blocked</span>
              <span><strong>{{ row.dependencyBlockedWorkItemCount }}</strong> dependency</span>
              <span><strong>{{ row.overdueWorkItemCount }}</strong> overdue</span>
            </div>

            <div class="row-section" aria-label="Report freshness">
              <span
                class="tone-pill"
                [attr.data-tone]="reportFreshnessTone(row.report.freshness)"
              >
                {{ reportFreshnessLabel(row.report.freshness) }}
              </span>
              @if (row.report.latestReport === null) {
                <span class="muted">No published report.</span>
              } @else {
                <span>{{ row.report.latestReport.title }}</span>
                <span class="muted">
                  {{ row.report.daysSincePublished }} days old · {{ row.report.latestReport.author.name }}
                </span>
              }
            </div>

            <div class="row-section" aria-label="Planning context">
              @if (row.planning.activeMilestone === null && row.planning.activeCycle === null) {
                <span class="muted">No active planning focus.</span>
              } @else {
                @if (row.planning.activeMilestone; as milestone) {
                  <span>
                    Milestone: {{ milestone.name }} · {{ healthLabel(milestone.health) }}
                  </span>
                  <span class="muted">
                    {{ milestone.openCount }} open · Target {{ formatDate(milestone.targetDate) }}
                  </span>
                }
                @if (row.planning.activeCycle; as cycle) {
                  <span>Cycle: {{ cycle.name }} · {{ healthLabel(cycle.health) }}</span>
                  <span class="muted">
                    {{ cycle.openWorkCount }} open · Ends {{ formatDate(cycle.endDate) }}
                  </span>
                }
              }
            </div>

            <nav class="row-actions" aria-label="Portfolio project links">
              @for (link of visibleLinks(row); track link.label + link.route) {
                <a [routerLink]="link.route" [queryParams]="linkQueryParams(link)">
                  {{ link.label }}
                </a>
              }
            </nav>
          </article>
        }
      </div>
    </section>
  `,
  styles: `
    .project-panel {
      overflow: hidden;
      border: 1px solid #dbe3ef;
      border-radius: 8px;
      background: #ffffff;
    }

    .panel-heading,
    .project-row,
    .project-main,
    .metric-grid,
    .row-actions {
      display: grid;
      gap: 12px;
    }

    .panel-heading {
      grid-template-columns: 1fr auto;
      align-items: center;
      border-bottom: 1px solid #e5edf6;
      padding: 14px 16px;
    }

    h2 {
      margin: 0;
      color: #111827;
      font-size: 1rem;
      line-height: 1.3;
    }

    .panel-heading span,
    .muted,
    .project-main span,
    .row-section span {
      color: #52637a;
      font-size: 0.84rem;
      line-height: 1.4;
    }

    .project-row {
      grid-template-columns: minmax(180px, 1.1fr) minmax(180px, 1fr) minmax(210px, 0.9fr) minmax(180px, 0.9fr) minmax(190px, 1fr) minmax(180px, 0.8fr);
      align-items: start;
      border-bottom: 1px solid #edf2f7;
      padding: 16px;
    }

    .project-row:last-child {
      border-bottom: 0;
    }

    .project-main,
    .row-section {
      min-width: 0;
    }

    .project-main,
    .row-section {
      align-content: start;
    }

    .project-main div,
    .row-section {
      display: grid;
      gap: 6px;
    }

    .project-name {
      color: #111827;
      font-weight: 850;
      line-height: 1.3;
      text-decoration: none;
    }

    .project-name:hover,
    .row-actions a:hover {
      text-decoration: underline;
    }

    .tone-pill {
      width: fit-content;
      border-radius: 999px;
      padding: 4px 8px;
      background: #e5e7eb;
      color: #374151;
      font-size: 0.78rem;
      font-weight: 850;
    }

    .tone-pill[data-tone='positive'] {
      background: #dcfce7;
      color: #166534;
    }

    .tone-pill[data-tone='warning'] {
      background: #fef3c7;
      color: #92400e;
    }

    .tone-pill[data-tone='critical'] {
      background: #fee2e2;
      color: #991b1b;
    }

    .tone-pill[data-tone='info'] {
      background: #e0f2fe;
      color: #075985;
    }

    .reason {
      color: #334155;
      font-weight: 700;
    }

    .metric-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .metric-grid span {
      display: grid;
      gap: 2px;
      border-radius: 6px;
      background: #f8fafc;
      padding: 8px;
      color: #52637a;
      font-size: 0.78rem;
      font-weight: 700;
    }

    .metric-grid strong {
      color: #111827;
      font-size: 1rem;
    }

    .row-actions {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .row-actions a {
      min-height: 32px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 7px 8px;
      color: #1d4ed8;
      font-size: 0.8rem;
      font-weight: 800;
      line-height: 1.25;
      text-align: center;
      text-decoration: none;
    }

    @media (max-width: 1320px) {
      .project-row {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    @media (max-width: 720px) {
      .panel-heading,
      .project-row,
      .row-actions {
        grid-template-columns: 1fr;
      }
    }
  `
})
export class PortfolioProjectComparisonComponent {
  readonly rows = input.required<PortfolioProjectRowDto[]>();

  protected readonly formatDate = formatDate;
  protected readonly healthLabel = healthLabel;
  protected readonly healthTone = healthTone;
  protected readonly reportFreshnessLabel = reportFreshnessLabel;
  protected readonly reportFreshnessTone = reportFreshnessTone;

  visibleLinks(row: PortfolioProjectRowDto): PortfolioLinkDto[] {
    return [
      row.links.overview,
      row.links.work,
      row.links.planning,
      row.links.reports,
      row.links.latestReport,
      row.links.activeMilestone,
      row.links.activeCycle,
      row.blockedWorkItemCount > 0 ? row.links.blockedWork : undefined,
      row.dependencyBlockedWorkItemCount > 0 ? row.links.dependencyBlockedWork : undefined,
      row.overdueWorkItemCount > 0 ? row.links.overdueWork : undefined,
      row.staleInProgressWorkItemCount > 0 ? row.links.staleWork : undefined
    ].filter((link): link is PortfolioLinkDto => link !== undefined);
  }

  linkQueryParams(link: PortfolioLinkDto): Record<string, string> | null {
    return portfolioLinkQueryParams(link);
  }
}
