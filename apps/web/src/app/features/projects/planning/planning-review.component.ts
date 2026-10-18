
import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { DeliveryHealthReasonDto, PlanningReviewItemDto, PlanningRiskItemDto, ProjectPlanningSummaryDto, WorkItemStatus, WorkItemQuery } from '@worktrail/contracts';
import { dueSoonWindowDays, snapshotCountLabel, staleInProgressDays } from '@worktrail/contracts';
import { formatCycleDate } from '../../../shared/cycles/cycle-display';
import { deliveryHealthSeverityTone, workItemQueryToRouterQueryParams } from '../../../shared/delivery-health/delivery-health-display';
import { recordOriginParams } from '../../../shared/navigation/work-navigation';
import { WorkItemParentPillComponent } from '../../../shared/work-items/work-item-parent-pill.component';
import { CycleSummaryPanelComponent } from './cycle-summary-panel.component';
import { MilestoneTargetsComponent } from './milestone-targets.component';
import { PlanningHealthSummaryComponent } from './planning-health-summary.component';
import { populatedRiskSections } from './risk-display';
const visibleRiskItemLimit = 5;
const workItemStatusLabels: Record<WorkItemStatus, string> = { backlog: 'Backlog', ready: 'Ready', in_progress: 'In progress', blocked: 'Blocked', done: 'Done', canceled: 'Canceled' };
interface PlanningRiskSection {
  title: string;
  description: string;
  items: PlanningRiskItemDto[];
  count: number;
  emptyTitle: string;
  emptyMessage: string;
  query: WorkItemQuery;
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
selector: 'app-planning-review', imports: [RouterLink, WorkItemParentPillComponent, CycleSummaryPanelComponent, PlanningHealthSummaryComponent, MilestoneTargetsComponent],
  template: `
<section class="summary-panel" aria-labelledby="planning-summary-heading">
 <h2 id="planning-summary-heading">Planning dashboard</h2>
 <app-planning-health-summary [projectId]="projectId" [summary]="summary" />
 <app-cycle-summary-panel [projectId]="projectId" [summary]="summary" [canManageCycles]="canManageCycles" />
 <section aria-labelledby="planning-risks-heading">
  <div class="section-heading"><h3 id="planning-risks-heading">Project risks</h3><span>{{ totalRiskCount(summary) }} risk signals</span></div>
  @if (riskSections().length === 0) { <p class="quiet-empty">No project work risks found.</p> }
<div class="risk-section-list">
              @for (section of riskSections(); track section.title) {
                <section class="dashboard-section" [attr.aria-labelledby]="riskHeadingId(section)">
                  <div class="section-heading">
                    <div>
                      <h3 [id]="riskHeadingId(section)">{{ section.title }}</h3>
                      <p>{{ section.description }}</p><span>{{ countLabel(section) }}</span>
                    </div>
                    @if (section.queryParams) {
                      <a
                        [routerLink]="['/projects', projectId, 'work-items']"
                        [queryParams]="section.queryParams"
                      >
                        View list
                      </a>
                    }
                  </div>

                  @if (section.items.length === 0) {
                    <div class="compact-empty">
                      <span>No previews available for {{ countLabel(section) }}.</span>
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
                              <app-work-item-parent-pill [parent]="item.parent" />
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
                            [routerLink]="['/projects', projectId, 'work-items']"
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
 </section>
 <app-milestone-targets [projectId]="projectId" [summary]="summary" />
<div class="review-section-list">
              @for (section of reviewSections(); track section.title) {
                <details class="review-disclosure"><summary [id]="reviewHeadingId(section)">{{ section.title }} · {{ section.items.length }} items</summary>

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
                            [routerLink]="['/projects', projectId, 'work-items']"
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
                </details>
              }
            </div>

</section>`,
  styles: `
    h2,
    h3 {
      margin: 0;
      color: #111827;
      line-height: 1.25;
    }

    h2 {
      font-size: 1rem;
    }

    h3 {
      font-size: 0.95rem;
    }

    p {
      margin: 0;
      color: #64748b;
      font-size: 0.875rem;
      line-height: 1.5;
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

    .section-heading {
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

    .risk-list,
    .review-list {
      display: grid;
      gap: 8px;
    }

    .risk-row,
    .review-row {
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 12px;
      background: #ffffff;
      color: #111827;
      text-decoration: none;
    }

    .review-row:hover,
    .risk-row:hover,
    .risk-more:hover,
    .section-heading a:hover {
      background: #f8fafc;
    }

    .review-row small {
      color: #64748b;
      font-size: 0.75rem;
      font-weight: 800;
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

      .risk-row,
      .review-row {
        grid-template-columns: 1fr;
      }
    }
 .summary-panel {display:grid;gap:20px;} .review-disclosure {border-top:1px solid #e5e7eb;padding-top:12px;}
 summary {cursor:pointer;font-weight:700;padding:8px 0;} .quiet-empty {padding:12px 0;} :host {display:block;}
 a,strong,small,p {overflow-wrap:anywhere;}
 `
})
export class PlanningReviewComponent {
  @Input({ required: true }) projectId = '';
  @Input({ required: true }) summary!: ProjectPlanningSummaryDto;
  @Input() canManageCycles = false;
  @Input() originFragment: string | null = null;
  riskSections(): PlanningRiskSection[] {
    const summary = this.summary;

    if (summary === null) {
      return [];
    }

    const sections: PlanningRiskSection[] = [
      {
        title: 'Blocked work',
        description: 'Items that need intervention before delivery can continue.',
        items: summary.blockedWork,
        count: summary.deliveryHealth.blockedWorkCount,
        emptyTitle: 'No blocked work',
        emptyMessage: 'No work items are currently blocked.',
        query: { status: 'blocked', sort: 'priority_desc' }
      },
      {
        title: 'Overdue work',
        description: 'Open project work with due dates before today (UTC).',
        items: summary.overdueWork,
        count: summary.deliveryHealth.overdueWorkCount,
        emptyTitle: 'No overdue work',
        emptyMessage: 'Open due dates are not past their target date.',
        query: { dueDateState: 'overdue', sort: 'due_date_asc' }
      },
      {
        title: 'Due soon',
        description: `Open project work due today through the next ${dueSoonWindowDays} days (UTC).`,
        items: summary.dueSoonWork,
        count: summary.deliveryHealth.dueSoonWorkCount,
        emptyTitle: 'Nothing due soon',
        emptyMessage: 'No open work is due within the next week.',
        query: { dueDateState: 'due_soon', sort: 'due_date_asc' }
      },
      {
        title: 'Dependency blocked work',
        description: 'Open items blocked by upstream work that is not done.',
        items: summary.dependencyBlockedWork,
        count: summary.deliveryHealth.dependencyBlockedWorkCount,
        emptyTitle: 'No dependency-blocked work',
        emptyMessage: 'No open work is waiting on upstream dependencies.',
        query: { dependency: 'dependency_blocked', sort: 'priority_desc' }
      },
      {
        title: 'Blocking open work',
        description: 'Open items currently blocking downstream work.',
        items: summary.blockingOpenWork,
        count: summary.deliveryHealth.blockingOpenWorkCount,
        emptyTitle: 'No work blocking dependencies',
        emptyMessage: 'No open work is blocking other open items.',
        query: { dependency: 'blocking_open_work', sort: 'priority_desc' }
      },
      {
        title: 'Unassigned active work',
        description: 'Ready or in-progress items without an owner.',
        items: summary.unassignedActiveWork,
        count: summary.deliveryHealth.unassignedActiveWorkCount,
        emptyTitle: 'No unassigned active work',
        emptyMessage: 'Ready and in-progress work all has an assignee.',
        query: { workRisk: 'unassigned_active', sort: 'priority_desc' }
      },
      {
        title: 'Stale in-progress work',
        description: `In-progress project work unchanged for more than ${staleInProgressDays} days.`,
        items: summary.staleInProgressWork,
        count: summary.deliveryHealth.staleInProgressWorkCount,
        emptyTitle: 'No stale in-progress work',
        emptyMessage: 'In-progress work has recent activity.',
        query: { workRisk: 'stale_in_progress', sort: 'updated_asc' }
      }
    ];

    return populatedRiskSections(sections).map(section => ({ ...section, queryParams: workItemQueryToRouterQueryParams(section.query, 'project') ?? undefined }));
  }
  reviewSections(): PlanningReviewSection[] {
    const summary = this.summary;

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
    ].filter(section => section.items.length > 0);
  }
  countLabel(section: PlanningRiskSection): string { return snapshotCountLabel({ count: section.count, countUnit: 'work_items' }); }
  formatToken(value: string): string {
    return value.replaceAll('_', ' ');
  }

  statusLabel(status: WorkItemStatus): string {
    return workItemStatusLabels[status];
  }

  totalRiskCount(summary: ProjectPlanningSummaryDto): number {
    return (
      summary.deliveryHealth.blockedWorkCount +
      summary.deliveryHealth.overdueWorkCount +
      summary.deliveryHealth.dueSoonWorkCount +
      summary.deliveryHealth.dependencyBlockedWorkCount +
      summary.deliveryHealth.blockingOpenWorkCount +
      summary.deliveryHealth.unassignedActiveWorkCount +
      summary.deliveryHealth.staleInProgressWorkCount
    );
  }

  riskHeadingId(section: PlanningRiskSection): string {
    return `risk-${section.title.toLowerCase().replaceAll(' ', '-')}`;
  }

  reviewHeadingId(section: PlanningReviewSection): string {
    return `review-${section.title.toLowerCase().replaceAll(' ', '-')}`;
  }

  severityTone(severity: DeliveryHealthReasonDto['severity']): string {
    return deliveryHealthSeverityTone(severity);
  }

  visibleRiskItems(section: PlanningRiskSection): PlanningRiskItemDto[] {
    return section.items.slice(0, visibleRiskItemLimit);
  }

  hiddenRiskItemCount(section: PlanningRiskSection): number {
    return Math.max(section.count - Math.min(section.items.length, visibleRiskItemLimit), 0);
  }

  reviewWorkItemLink(item: PlanningReviewItemDto): string[] | null {
    return item.workItemId === null ? null : ['/work-items', item.workItemId];
  }

  reviewMilestoneLink(item: PlanningReviewItemDto): string[] | null {
    return item.kind === 'milestone' && item.milestoneId !== null
      ? ['/projects', this.projectId, 'milestones', item.milestoneId]
      : null;
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

  formatDateTime(value: string): string {
    return new Intl.DateTimeFormat('en', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(new Date(value));
  }
  detailQueryParams(): { returnUrl: string } { return recordOriginParams(`/projects/${this.projectId}/planning?view=review`, this.originFragment); }
  formatDate(value: string): string { return formatCycleDate(value); }
}
