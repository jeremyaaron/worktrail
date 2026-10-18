import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { DeliveryHealthReasonDto, DeliveryHealthState, ProjectPlanningSummaryDto } from '@worktrail/contracts';
import { deliveryHealthLabel, deliveryHealthReasonLabel, deliveryHealthReasonQueryParams, deliveryHealthSeverityTone, deliveryHealthTone } from '../../../shared/delivery-health/delivery-health-display';
@Component({
  selector: 'app-planning-health-summary', imports: [RouterLink],
  template: `<section class="dashboard-section health-summary" aria-labelledby="delivery-health-heading">
              <div class="health-summary__heading">
                <div>
                  <p class="section-eyebrow">Delivery health</p>
                  <h3 id="delivery-health-heading">{{ healthLabel(summary.deliveryHealth.health) }}</h3>
                </div>
                <span class="health-pill" [attr.data-tone]="healthTone(summary.deliveryHealth.health)">
                  {{ healthLabel(summary.deliveryHealth.health) }}
                </span>
              </div>

              <dl class="health-counts" aria-label="Delivery health counts">
                <div>
                  <dt>Active milestones</dt>
                  <dd>{{ summary.deliveryHealth.activeMilestoneCount }}</dd>
                </div>
                <div>
                  <dt>On-track milestones</dt>
                  <dd>{{ summary.deliveryHealth.healthyMilestoneCount }}</dd>
                </div>
                <div>
                  <dt>At-risk milestones</dt>
                  <dd>{{ summary.deliveryHealth.atRiskMilestoneCount }}</dd>
                </div>
                <div>
                  <dt>Blocked milestones</dt>
                  <dd>{{ summary.deliveryHealth.blockedMilestoneCount }}</dd>
                </div>
                <div>
                  <dt>Open work</dt>
                  <dd>{{ summary.deliveryHealth.openWorkCount }}</dd>
                </div>
              </dl>

              @if (summary.deliveryHealth.reasons.length === 0) {
                <p class="quiet-empty">
                  <strong>No project delivery risks found</strong>
                  <span>Current project work has no surfaced delivery-health reasons.</span>
                </p>
              } @else {
                <div class="reason-list" aria-label="Delivery health reasons">
                  @for (reason of topReasons(summary.deliveryHealth.reasons); track reason.key + reason.message) {
                    @if (reasonQueryParams(reason); as queryParams) {
                      <a
                        class="reason-chip"
                        [attr.data-tone]="severityTone(reason.severity)"
                        [routerLink]="['/projects', projectId, 'work-items']"
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
`,
  styles: `
    h3 {
      margin: 0;
      color: #111827;
      line-height: 1.25;
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

    .dashboard-section {
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

    .health-summary__heading {
      display: flex;
      align-items: start;
      justify-content: space-between;
      gap: 12px;
    }

    .section-eyebrow {
      margin: 0 0 4px;
      color: #64748b;
      font-size: 0.72rem;
      font-weight: 900;
      letter-spacing: 0;
      text-transform: uppercase;
    }

    .health-counts {
      display: grid;
      gap: 8px;
    }

    .health-counts {
      grid-template-columns: repeat(5, minmax(0, 1fr));
      margin: 0;
    }

    .health-counts div {
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 10px;
      background: #f8fafc;
    }

    .health-counts div {
      display: grid;
      gap: 5px;
    }

    .health-counts dd {
      margin: 0;
      color: #111827;
      font-size: 1.15rem;
      font-weight: 900;
      line-height: 1;
    }

    .health-pill {
      display: inline-flex;
      align-items: center;
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

    .reason-list {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
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

    .reason-chip:hover {
      background: #f8fafc;
    }

    dt {
      color: #64748b;
      font-size: 0.72rem;
      font-weight: 900;
      text-transform: uppercase;
    }

    @media (max-width: 900px) {

      .health-counts {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    } .quiet-empty { margin: 0; color: #64748b; } .quiet-empty span { margin-left: 6px; }`
})
export class PlanningHealthSummaryComponent {
  @Input({ required: true }) projectId = '';
  @Input({ required: true }) summary!: ProjectPlanningSummaryDto;
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
    return deliveryHealthReasonQueryParams(reason, 'project');
  }
}
