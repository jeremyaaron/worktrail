import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type {
  DeliveryHealthReasonDto,
  DeliveryHealthState,
  ProjectPlanningCycleSummaryDto,
  ProjectPlanningSummaryDto
} from '@worktrail/contracts';

import {
  cycleDateRangeLabel,
  cycleHealthLabel
} from '../../../shared/cycles/cycle-display';
import {
  deliveryHealthReasonLabel, deliveryHealthReasonQueryParams,
  deliveryHealthTone,
  workItemQueryToRouterQueryParams
} from '../../../shared/delivery-health/delivery-health-display';

@Component({
  selector: 'app-cycle-summary-panel',
  imports: [RouterLink],
  template: `
    <section class="dashboard-section" aria-labelledby="cycle-summary-heading">
      <div class="section-heading">
        <h3 id="cycle-summary-heading">Cycle execution</h3>
        <span>{{ cycleSummaryCount() }} visible</span>
      </div>

      <div class="cycle-summary-grid">
        @if (!summary?.activeCycle) {
          <div class="no-active-cycle">
            <strong>No active cycle</strong>
            <a [routerLink]="['/projects', projectId, 'work-items']" [queryParams]="{cycleId:'none', workState:'open', sort:'priority_desc'}">Open unplanned work</a>
            @if (canManageCycles) {<a [routerLink]="['/projects',projectId,'planning']" [queryParams]="{view:'cycles'}" fragment="cycles-heading">Manage cycles</a>}
          </div>
        }
          @if (summary?.activeCycle; as activeCycle) {
            <article class="cycle-summary-card cycle-summary-card--active" aria-label="Active cycle execution">
              <p class="section-eyebrow">Active cycle</p>
              <h4>{{ activeCycle.cycle.name }}</h4>
              <span class="health-pill" [attr.data-tone]="healthTone(activeCycle.health.health)">
                {{ cycleHealthLabel(activeCycle.health.health) }}
              </span>
              <p>{{ cycleDateRangeLabel(activeCycle.cycle) }}</p>
              <p>{{ activeCycle.cycle.goal }}</p>
              <p>{{ cycleProgressLabel(activeCycle) }}</p>
              <p class="closeout-readiness" role="status" aria-label="Closeout readiness">
                @if (activeCycle.progress.openCount === 0) { All work is finished. Ready for closeout. }
                @else { {{ activeCycle.progress.openCount }} unfinished work items · {{ activeCycle.progress.unestimatedCount }} unestimated }
              </p>
              @if (activeCycle.health.reasons.length > 0) {
                <div class="cycle-reasons" aria-label="Active cycle risks">
                  @for (reason of activeCycle.health.reasons; track reason.key) {
                    @if (reasonQueryParams(reason); as query) {<a [routerLink]="['/projects',projectId,'work-items']" [queryParams]="query">{{ reasonLabel(reason) }}</a>}
                    @else {<span>{{ reasonLabel(reason) }}</span>}
                  }
                </div>
              }
              <div class="cycle-summary-card__actions">
                <a [routerLink]="['/projects', projectId, 'cycles', activeCycle.cycle.id]">Review</a>
                <a
                  [routerLink]="['/projects', projectId, 'work-items']"
                  [queryParams]="cycleWorkQueryParams(activeCycle)"
                >
                  Open work
                </a>
                @if (canManageCycles && !activeCycle.cycle.isArchived && activeCycle.cycle.status === 'active') {
                  <a
                    [routerLink]="[
                      '/projects',
                      projectId,
                      'cycles',
                      activeCycle.cycle.id,
                      'closeout'
                    ]"
                  >
                    Close
                  </a>
                }
              </div>
            </article>
          }

          @if (summary?.upcomingCycle; as upcomingCycle) {
            <article class="cycle-summary-card">
              <p class="section-eyebrow">Upcoming cycle</p>
              <h4>{{ upcomingCycle.cycle.name }}</h4>
              <span class="health-pill" [attr.data-tone]="healthTone(upcomingCycle.health.health)">
                {{ cycleHealthLabel(upcomingCycle.health.health) }}
              </span>
              <p>{{ cycleDateRangeLabel(upcomingCycle.cycle) }}</p>
              <p>{{ cycleProgressLabel(upcomingCycle) }}</p>
              <div class="cycle-summary-card__actions">
                <a [routerLink]="['/projects', projectId, 'cycles', upcomingCycle.cycle.id]">Review</a>
                <a
                  [routerLink]="['/projects', projectId, 'work-items']"
                  [queryParams]="cycleWorkQueryParams(upcomingCycle)"
                >
                  Open work
                </a>
              </div>
            </article>
          }

          @if (summary?.recentlyCompletedCycle; as completedCycle) {
            <article class="cycle-summary-card">
              <p class="section-eyebrow">Recently completed</p>
              <h4>{{ completedCycle.cycle.name }}</h4>
              <span class="health-pill" [attr.data-tone]="healthTone(completedCycle.health.health)">
                {{ cycleHealthLabel(completedCycle.health.health) }}
              </span>
              <p>{{ cycleDateRangeLabel(completedCycle.cycle) }}</p>
              @if (completedCycle.closeout; as closeout) {
                <p class="closeout-result">
                  Closed {{ formatCloseDate(closeout.closedAt) }} by {{ closeout.closedBy.name }}.<br />
                  {{ closeout.counts.movedCount }} moved · {{ closeout.counts.retainedCount }} retained ·
                  {{ closeoutDestinationLabel(completedCycle) }}
                </p>
              } @else {
                <p>{{ cycleProgressLabel(completedCycle) }}</p>
              }
              <div class="cycle-summary-card__actions">
                <a [routerLink]="['/projects', projectId, 'cycles', completedCycle.cycle.id]">Review</a>
                <a
                  [routerLink]="['/projects', projectId, 'work-items']"
                  [queryParams]="cycleWorkQueryParams(completedCycle)"
                >
                  Open work
                </a>
              </div>
            </article>
          }
        </div>
    </section>
  `,
  styles: `
    .dashboard-section {
      display: grid;
      gap: 12px;
      border-top: 1px solid #e5e7eb;
      padding-top: 16px;
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

    h3,
    h4,
    p {
      margin: 0;
    }

    h3 {
      color: #111827;
      font-size: 0.95rem;
      line-height: 1.25;
    }

    h4 {
      color: #111827;
      font-size: 0.9rem;
      line-height: 1.25;
    }

    p {
      color: #64748b;
      font-size: 0.875rem;
      line-height: 1.5;
    }

    .cycle-summary-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }

    .cycle-summary-card {
      display: grid;
      gap: 9px;
      border-top: 1px solid #e5e7eb;
      padding: 12px 0;
    }

    .cycle-summary-card__actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .cycle-summary-card__actions a {
      display: inline-flex;
      align-items: center;
      min-height: 32px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 6px 10px;
      color: #1d4ed8;
      font-size: 0.8125rem;
      font-weight: 800;
      text-decoration: none;
    }

    .cycle-summary-card__actions a:hover {
      background: #f8fafc;
    }

    .closeout-result {
      color: #334155;
      font-size: 0.8125rem;
    }

    .section-eyebrow {
      margin: 0 0 4px;
      color: #64748b;
      font-size: 0.72rem;
      font-weight: 900;
      letter-spacing: 0;
      text-transform: uppercase;
    }

    .health-pill {
      display: inline-flex;
      align-items: center;
      width: fit-content;
      min-height: 26px;
      border: 1px solid #cbd5e1;
      border-radius: 999px;
      padding: 3px 9px;
      background: #f8fafc;
      color: #334155;
      font-size: 0.72rem;
      font-weight: 900;
      white-space: nowrap;
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
      background: #fef2f2;
      color: #991b1b;
    }

    .health-pill[data-tone='info'] {
      border-color: #93c5fd;
      background: #eff6ff;
      color: #1e40af;
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

    .cycle-summary-card--active, .no-active-cycle {grid-column:1 / -1;}
    .no-active-cycle, .cycle-reasons {display:flex;flex-wrap:wrap;gap:12px;align-items:center;}
    .cycle-summary-card--active h4 {font-size:1.125rem;}
    .closeout-readiness {color:#334155;font-weight:700;}
    a {color:#1d4ed8;} p,h4,a {overflow-wrap:anywhere;}
    @media (max-width: 900px) {
      .cycle-summary-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    @media (max-width: 560px) {
      .cycle-summary-grid {
        grid-template-columns: 1fr;
      }
    }
  `
})
export class CycleSummaryPanelComponent {
  @Input({ required: true }) projectId = '';
  @Input() summary: ProjectPlanningSummaryDto | null = null;
  @Input() canManageCycles = false;

  reasonLabel = deliveryHealthReasonLabel;
  reasonQueryParams(reason: DeliveryHealthReasonDto): Record<string, string> | null { return deliveryHealthReasonQueryParams(reason, 'project'); }
  cycleSummaryCount(): number {
    return [
      this.summary?.activeCycle ?? null,
      this.summary?.upcomingCycle ?? null,
      this.summary?.recentlyCompletedCycle ?? null
    ].filter((cycle) => cycle !== null).length;
  }

  cycleWorkQueryParams(summary: ProjectPlanningCycleSummaryDto): Record<string, string> | null {
    return workItemQueryToRouterQueryParams(summary.scopedWorkQuery, 'project');
  }

  cycleProgressLabel(summary: ProjectPlanningCycleSummaryDto): string {
    const target =
      summary.progress.targetPoints === null
        ? 'no target'
        : `${summary.progress.targetPoints} target points`;

    return `${summary.progress.doneCount} of ${summary.progress.totalCount} done · ${summary.progress.openCount} open · ${summary.progress.committedEstimatePoints} estimated points · ${target}`;
  }

  cycleDateRangeLabel(cycle: ProjectPlanningCycleSummaryDto['cycle']): string {
    return cycleDateRangeLabel(cycle);
  }

  cycleHealthLabel(state: DeliveryHealthState): string {
    return cycleHealthLabel(state);
  }

  healthTone(state: DeliveryHealthState): string {
    return deliveryHealthTone(state);
  }

  closeoutDestinationLabel(summary: ProjectPlanningCycleSummaryDto): string {
    const destination = summary.closeout?.destination;

    if (destination?.kind === 'cycle') {
      return destination.cycle.name;
    }

    if (destination?.kind === 'unplanned') {
      return 'returned to unplanned work';
    }

    return 'no carryover';
  }

  formatCloseDate(value: string): string {
    return new Intl.DateTimeFormat('en', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(new Date(value));
  }
}
