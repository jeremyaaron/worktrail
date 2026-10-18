import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { DeliveryHealthReasonDto, DeliveryHealthState, MilestoneProgressDto, ProjectPlanningSummaryDto } from '@worktrail/contracts';
import { deliveryHealthLabel, deliveryHealthReasonLabel, deliveryHealthReasonQueryParams, deliveryHealthSeverityTone, deliveryHealthTone } from '../../../shared/delivery-health/delivery-health-display';
@Component({
  selector: 'app-milestone-targets', imports: [RouterLink],
  template: `<section class="dashboard-section" aria-labelledby="milestone-progress-heading">
              <div class="section-heading">
                <h3 id="milestone-progress-heading">Milestone targets</h3>
                <span>{{ summary.milestoneProgress.length }} active</span>
              </div>

              @if (summary.milestoneProgress.length === 0) {
                <div class="compact-empty">
                  <strong>No active milestones</strong>
                  <span>Planned and active milestones will appear here once created.</span>
                </div>
              } @else {
                <div class="progress-list">
                  @for (progress of summary.milestoneProgress; track progress.milestone.id) {
                    <article
                      class="progress-row"
                    >
                      <span class="progress-row__heading">
                        <a
                          class="progress-row__heading-link"
                          [routerLink]="['/projects', projectId, 'milestones', progress.milestone.id]"
                        >
                          {{ progress.milestone.name }}
                        </a>
                        <a
                          class="progress-row__work-link reason-chip"
                          [routerLink]="['/projects', projectId, 'work-items']"
                          [queryParams]="{ milestoneId: progress.milestone.id, sort: 'due_date_asc' }"
                        >
                          Open work
                        </a>
                        <span class="health-pill" [attr.data-tone]="healthTone(progress.health)">
                          {{ healthLabel(progress.health) }}
                        </span>
                        <small>
                          {{ progress.doneCount }} of {{ progress.totalCount }} done
                        </small>
                      </span>
                      <span class="progress-bar" aria-hidden="true">
                        <span [style.width.%]="milestonePercent(progress)"></span>
                      </span>
                      <span class="progress-row__counts">
                        <span>{{ progress.blockedCount }} blocked</span>
                        <span>{{ progress.overdueCount }} overdue</span>
                      </span>
                      @if (progress.reasons.length > 0) {
                        <span class="progress-reasons">
                          @for (reason of topReasons(progress.reasons); track reason.key + reason.message) {
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
                        </span>
                      }
                    </article>
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

    .progress-reasons {
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

    .progress-list {
      display: grid;
      gap: 8px;
    }

    .progress-row {
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 12px;
      background: #ffffff;
      color: #111827;
      text-decoration: none;
    }

    .progress-row {
      display: grid;
      gap: 10px;
    }

    .progress-row__heading,
    .progress-row__counts {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }

    .progress-row__heading-link {
      color: #1d4ed8;
      font-size: 0.875rem;
      font-weight: 900;
      text-decoration: none;
    }

    .progress-row__heading-link:hover,
    .reason-chip:hover,
    .section-heading a:hover {
      background: #f8fafc;
    }

    .progress-row__heading small,
    .progress-row__counts {
      color: #64748b;
      font-size: 0.75rem;
      font-weight: 800;
    }

    .progress-bar {
      overflow: hidden;
      height: 8px;
      border-radius: 999px;
      background: #e5e7eb;
    }

    .progress-bar span {
      display: block;
      height: 100%;
      border-radius: inherit;
      background: #2563eb;
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
    }`
})
export class MilestoneTargetsComponent {
  @Input({ required: true }) projectId = '';
  @Input({ required: true }) summary!: ProjectPlanningSummaryDto;
  milestonePercent(progress: MilestoneProgressDto): number {
    if (progress.totalCount === 0) {
      return 0;
    }

    return Math.round((progress.doneCount / progress.totalCount) * 100);
  }

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
