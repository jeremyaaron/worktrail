import { Component, computed, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import type { DeliveryHealthState, PortfolioLinkDto, PortfolioProjectRowDto, PortfolioReportFreshness } from '@worktrail/contracts';
import { formatDate, healthLabel, healthTone, portfolioLinkQueryParams, reportFreshnessLabel, reportFreshnessTone } from './portfolio-display';

@Component({
  selector: 'app-portfolio-project-comparison',
  imports: [FormsModule, RouterLink],
  template: `
    <section class="project-panel" aria-labelledby="portfolio-projects-heading">
      <header class="panel-heading">
        <h2 id="portfolio-projects-heading">Project comparison</h2>
        <span role="status" aria-label="Project comparison results">{{ filteredRows().length }} of {{ rows().length }} active projects</span>
      </header>
      <div class="comparison-filters" aria-label="Project comparison filters">
        <label>Project<input type="search" placeholder="Name or key" [ngModel]="search()" (ngModelChange)="search.set($event)" /></label>
        <label>Health<select [ngModel]="health()" (ngModelChange)="health.set($event)">
          <option value="all">All health</option>
          @for (state of healthStates; track state) { <option [value]="state">{{ healthLabel(state) }}</option> }
        </select></label>
        <label>Report freshness<select [ngModel]="freshness()" (ngModelChange)="freshness.set($event)">
          <option value="all">All freshness</option><option value="fresh">Fresh</option><option value="stale">Stale</option><option value="missing">Missing</option>
        </select></label>
        <button type="button" (click)="clearFilters()">Clear filters</button>
      </div>
      <div class="project-list">
        @for (row of filteredRows(); track row.project.id) {
          <article class="project-row" [attr.aria-label]="row.project.name">
            <div class="comparison-primary">
              <div class="project-main">
                <a class="project-name" [routerLink]="row.links.overview.route">{{ row.project.name }}</a>
                <span>{{ row.project.key }} · Updated {{ formatDate(row.updatedAt) }}</span>
              </div>
              <div class="row-section" aria-label="Delivery health reasons">
                <span class="tone-pill" [attr.data-tone]="healthTone(row.deliveryHealth.health)">{{ healthLabel(row.deliveryHealth.health) }}</span>
                <span class="reason">{{ row.deliveryHealth.reasons[0]?.message ?? 'No delivery health reasons.' }}</span>
              </div>
              <div class="row-section" aria-label="Planning context">
                @if (row.planning.activeCycle; as cycle) {
                  <span>Cycle: {{ cycle.name }} · {{ healthLabel(cycle.health) }}</span>
                  <span class="muted">{{ cycle.openWorkCount }} open · Ends {{ formatDate(cycle.endDate) }}</span>
                }
                @if (row.planning.activeMilestone; as milestone) {
                  <span>Milestone: {{ milestone.name }} · {{ healthLabel(milestone.health) }}</span>
                  <span class="muted">{{ milestone.openCount }} open · Target {{ formatDate(milestone.targetDate) }}</span>
                }
                @if (!row.planning.activeCycle && !row.planning.activeMilestone) { <span class="muted">No active planning focus.</span> }
              </div>
              <div class="row-section" aria-label="Report freshness">
                <span class="tone-pill" [attr.data-tone]="reportFreshnessTone(row.report.freshness)">{{ reportFreshnessLabel(row.report.freshness) }}</span>
                @if (row.report.latestReport; as report) { <span>{{ report.title }}</span><span class="muted">{{ row.report.daysSincePublished }} days old · {{ report.author.name }}</span> }
                @else { <span class="muted">No published report.</span> }
              </div>
              @let next = nextAction(row);
              <a class="next-action" [routerLink]="next.route" [queryParams]="linkQueryParams(next)">{{ next.label }}</a>
            </div>
            <details class="secondary-details">
              <summary>Details and links</summary>
              <div class="secondary-content">
                <div class="metric-grid" aria-label="Work counts">
                  <span><strong>{{ row.openWorkItemCount }}</strong> open</span>
                  <span><strong>{{ row.blockedWorkItemCount }}</strong> blocked</span>
                  <span><strong>{{ row.dependencyBlockedWorkItemCount }}</strong> dependency</span>
                  <span><strong>{{ row.overdueWorkItemCount }}</strong> overdue</span>
                </div>
                @for (reason of row.deliveryHealth.reasons.slice(1); track $index) { <p class="reason">{{ reason.message }}</p> }
                <nav class="row-actions" aria-label="Portfolio project links">
                  @for (link of visibleLinks(row); track link.label + link.route) {
                    <a [routerLink]="link.route" [queryParams]="linkQueryParams(link)">{{ link.label }}</a>
                  }
                </nav>
              </div>
            </details>
          </article>
        } @empty { <p role="status">No projects match these filters.</p> }
      </div>
    </section>
  `,
  styles: `
    :host { display: block; min-width: 0; container-type: inline-size; }
    .panel-heading { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 8px; }
    h2 { margin: 0; font-size: 1rem; color: #111827; }
    .panel-heading > span, .muted, .project-main > span { color: #52637a; font-size: .8rem; }
    .comparison-filters { display: flex; flex-wrap: wrap; align-items: end; gap: 10px; padding: 14px 0; }
    label { display: grid; gap: 5px; flex: 1 1 160px; min-width: 0; font-size: .8rem; color: #334155; font-weight: 700; }
    input, select, button { min-width: 0; width: 100%; box-sizing: border-box; min-height: 36px; border: 1px solid #cbd5e1; border-radius: 4px; padding: 7px 10px; background: #fff; color: #17202a; font: inherit; font-size: .85rem; }
    button { width: auto; cursor: pointer; }
    .project-row { padding: 16px 0; border-top: 1px solid #dbe3ef; min-width: 0; }
    .comparison-primary { display: grid; grid-template-columns: minmax(0, 1fr); align-items: start; gap: 12px; }
    .comparison-primary > *, .secondary-content > * { min-width: 0; overflow-wrap: anywhere; }
    .project-main, .row-section { display: grid; gap: 6px; align-content: start; font-size: .82rem; line-height: 1.4; }
    .project-name { color: #111827; font-size: .95rem; font-weight: 800; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .tone-pill { width: fit-content; max-width: 100%; padding: 3px 8px; border-radius: 999px; background: #e5e7eb; color: #374151; font-size: .76rem; font-weight: 800; }
    .tone-pill[data-tone='positive'] { background: #dcfce7; color: #166534; }
    .tone-pill[data-tone='warning'] { background: #fef3c7; color: #92400e; }
    .tone-pill[data-tone='critical'] { background: #fee2e2; color: #991b1b; }
    .tone-pill[data-tone='info'] { background: #e0f2fe; color: #075985; }
    .next-action { color: #1d4ed8; font-size: .82rem; font-weight: 800; padding: 8px 0; }
    .secondary-details { margin-top: 12px; font-size: .8rem; }
    summary { cursor: pointer; color: #52637a; width: fit-content; padding: 6px 0; }
    .secondary-content { display: grid; gap: 12px; margin-top: 8px; }
    .metric-grid, .row-actions { display: flex; flex-wrap: wrap; gap: 12px; font-size: .8rem; }
    .metric-grid strong { color: #111827; }
    .row-actions a { color: #1d4ed8; padding: 6px 0; }
    .reason { margin: 0; color: #334155; }
    @container (min-width: 560px) { .comparison-primary { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    @container (min-width: 960px) { .comparison-primary { grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr) minmax(0, 1.3fr) minmax(0, 1.1fr) minmax(0, .7fr); } }
  `
})
export class PortfolioProjectComparisonComponent {
  readonly rows = input.required<PortfolioProjectRowDto[]>();
  readonly search = signal('');
  readonly health = signal<'all' | DeliveryHealthState>('all');
  readonly freshness = signal<'all' | PortfolioReportFreshness>('all');
  readonly healthStates: DeliveryHealthState[] = ['healthy', 'at_risk', 'blocked', 'complete', 'inactive'];
  readonly filteredRows = computed(() => {
    const search = this.search().normalize('NFC').trim().toLowerCase();
    return this.rows().filter(row => (!search || (row.project.name + ' ' + row.project.key).normalize('NFC').toLowerCase().includes(search)) &&
      (this.health() === 'all' || row.deliveryHealth.health === this.health()) &&
      (this.freshness() === 'all' || row.report.freshness === this.freshness()));
  });
  protected readonly formatDate = formatDate;
  protected readonly healthLabel = healthLabel;
  protected readonly healthTone = healthTone;
  protected readonly reportFreshnessLabel = reportFreshnessLabel;
  protected readonly reportFreshnessTone = reportFreshnessTone;

  clearFilters(): void { this.search.set(''); this.health.set('all'); this.freshness.set('all'); }
  nextAction(row: PortfolioProjectRowDto): PortfolioLinkDto {
    return (row.dependencyBlockedWorkItemCount > 0 ? row.links.dependencyBlockedWork : undefined) ??
      (row.blockedWorkItemCount > 0 ? row.links.blockedWork : undefined) ??
      (row.overdueWorkItemCount > 0 ? row.links.overdueWork : undefined) ??
      row.links.activeCycle ?? (row.report.freshness !== 'fresh' ? row.links.reports : undefined) ??
      row.links.latestReport ?? row.links.work;
  }
  visibleLinks(row: PortfolioProjectRowDto): PortfolioLinkDto[] {
    return [row.links.overview, row.links.work, row.links.planning, row.links.reports, row.links.latestReport,
    row.links.activeMilestone, row.links.activeCycle,
    row.blockedWorkItemCount > 0 ? row.links.blockedWork : undefined,
    row.dependencyBlockedWorkItemCount > 0 ? row.links.dependencyBlockedWork : undefined,
    row.overdueWorkItemCount > 0 ? row.links.overdueWork : undefined,
    row.staleInProgressWorkItemCount > 0 ? row.links.staleWork : undefined
    ].filter((link): link is PortfolioLinkDto => link !== undefined);
  }
  linkQueryParams(link: PortfolioLinkDto): Record<string, string> | null { return portfolioLinkQueryParams(link); }
}
