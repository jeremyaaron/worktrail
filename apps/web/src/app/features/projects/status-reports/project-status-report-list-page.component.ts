import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import type {
  DeliveryHealthState,
  ProjectStatusReportSummaryDto,
  ProjectSummaryDto
} from '@worktrail/contracts';
import { forkJoin } from 'rxjs';

import { CurrentUserService } from '../../../core/current-user.service';
import { WorktrailApiService } from '../../../core/worktrail-api.service';
import {
  deliveryHealthLabel,
  deliveryHealthTone
} from '../../../shared/delivery-health/delivery-health-display';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { ErrorPanelComponent } from '../../../shared/ui/error-panel.component';
import { LoadingIndicatorComponent } from '../../../shared/ui/loading-indicator.component';

@Component({
  selector: 'app-project-status-report-list-page',
  imports: [
    EmptyStateComponent,
    ErrorPanelComponent,
    LoadingIndicatorComponent,
    RouterLink
  ],
  template: `
    @if (isLoading()) {
      <app-loading-indicator label="Loading status reports" />
    } @else if (error()) {
      <app-error-panel [message]="error() ?? ''" (retry)="loadStatusReports()" />
    } @else if (summary(); as summary) {
      <section class="status-page">
        <div class="status-page__heading">
          <div>
            <p class="status-page__eyebrow">Status reports</p>
            <h1>Project status</h1>
          </div>

          <div class="status-page__actions">
            @if (canCreateReport()) {
              <a
                class="status-page__primary"
                [routerLink]="['/projects', projectId(), 'status', 'new']"
              >
                Create report
              </a>
            } @else {
              <span class="status-page__locked">{{ createUnavailableMessage(summary) }}</span>
            }
          </div>
        </div>

        @if (latestReport(); as latest) {
          <article class="latest-report" aria-labelledby="latest-status-report-heading">
            <div class="latest-report__content">
              <p class="status-page__eyebrow">Latest report</p>
              <h2 id="latest-status-report-heading">
                <a [routerLink]="['/projects', projectId(), 'status', latest.id]">
                  {{ latest.title }}
                </a>
              </h2>
              <dl class="report-meta">
                <div>
                  <dt>Status date</dt>
                  <dd>{{ formatDate(latest.statusDate) }}</dd>
                </div>
                <div>
                  <dt>Published</dt>
                  <dd>{{ formatDateTime(latest.publishedAt) }}</dd>
                </div>
                <div>
                  <dt>Author</dt>
                  <dd>{{ latest.author.name }}</dd>
                </div>
              </dl>
            </div>

            <span
              class="health-pill"
              [attr.data-tone]="healthTone(latest.health)"
            >
              {{ healthLabel(latest.health) }}
            </span>
          </article>
        } @else {
          <app-empty-state
            title="No status reports"
            message="Published reports for this project will appear here."
          />
        }

        @if (previousReports().length > 0) {
          <section class="report-list" aria-labelledby="previous-status-reports-heading">
            <div class="report-list__heading">
              <h2 id="previous-status-reports-heading">Previous reports</h2>
            </div>

            <div class="report-list__items">
              @for (report of previousReports(); track report.id) {
                <a
                  class="report-row"
                  [routerLink]="['/projects', projectId(), 'status', report.id]"
                >
                  <span class="report-row__title">{{ report.title }}</span>
                  <span
                    class="health-pill"
                    [attr.data-tone]="healthTone(report.health)"
                  >
                    {{ healthLabel(report.health) }}
                  </span>
                  <span>{{ formatDate(report.statusDate) }}</span>
                  <span>{{ report.author.name }}</span>
                </a>
              }
            </div>
          </section>
        }
      </section>
    }
  `,
  styles: `
    .status-page {
      display: grid;
      gap: 18px;
    }

    .status-page__heading,
    .latest-report,
    .report-list__heading,
    .report-row {
      display: flex;
      gap: 12px;
      align-items: center;
    }

    .status-page__heading {
      flex-wrap: wrap;
      justify-content: space-between;
    }

    .status-page__eyebrow,
    h1,
    h2,
    p,
    dl,
    dd {
      margin: 0;
    }

    .status-page__eyebrow {
      color: #64748b;
      font-size: 0.75rem;
      font-weight: 800;
      letter-spacing: 0;
      text-transform: uppercase;
    }

    h1 {
      color: #111827;
      font-size: 1.5rem;
      line-height: 1.2;
    }

    h2 {
      color: #111827;
      font-size: 1.05rem;
      line-height: 1.35;
    }

    .status-page__actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      min-width: min(100%, 220px);
    }

    .status-page__primary {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 36px;
      border: 1px solid #1f4f99;
      border-radius: 6px;
      padding: 7px 12px;
      background: #1f4f99;
      color: #ffffff;
      font-size: 0.875rem;
      font-weight: 800;
      text-decoration: none;
    }

    .status-page__primary:hover {
      background: #183b73;
    }

    .status-page__locked {
      max-width: 32ch;
      color: #64748b;
      font-size: 0.875rem;
      font-weight: 700;
      line-height: 1.35;
      text-align: right;
    }

    .latest-report {
      justify-content: space-between;
      border: 1px solid #d7e0ea;
      border-radius: 8px;
      padding: 18px;
      background: #ffffff;
    }

    .latest-report__content {
      display: grid;
      gap: 10px;
      min-width: 0;
    }

    .latest-report h2 a {
      color: #0f3f8c;
      overflow-wrap: anywhere;
      text-decoration: none;
    }

    .latest-report h2 a:hover,
    .report-row:hover .report-row__title {
      text-decoration: underline;
    }

    .report-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 12px 18px;
    }

    .report-meta div {
      display: grid;
      gap: 2px;
    }

    dt {
      color: #64748b;
      font-size: 0.72rem;
      font-weight: 800;
      letter-spacing: 0;
      text-transform: uppercase;
    }

    dd {
      color: #334155;
      font-size: 0.875rem;
      font-weight: 700;
      line-height: 1.35;
    }

    .health-pill {
      display: inline-flex;
      flex: 0 0 auto;
      align-items: center;
      min-height: 26px;
      border: 1px solid #cbd5e1;
      border-radius: 999px;
      padding: 3px 9px;
      background: #f8fafc;
      color: #475569;
      font-size: 0.75rem;
      font-weight: 800;
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
      color: #1d4ed8;
    }

    .health-pill[data-tone='neutral'] {
      border-color: #cbd5e1;
      background: #f8fafc;
      color: #475569;
    }

    .report-list {
      display: grid;
      gap: 10px;
    }

    .report-list__heading h2 {
      font-size: 1rem;
    }

    .report-list__items {
      display: grid;
      border: 1px solid #d7e0ea;
      border-radius: 8px;
      overflow: hidden;
      background: #ffffff;
    }

    .report-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto minmax(86px, auto) minmax(100px, auto);
      min-height: 54px;
      border-bottom: 1px solid #e5e7eb;
      padding: 10px 12px;
      color: #475569;
      font-size: 0.85rem;
      font-weight: 700;
      text-decoration: none;
    }

    .report-row:last-child {
      border-bottom: 0;
    }

    .report-row:hover {
      background: #f8fafc;
    }

    .report-row__title {
      min-width: 0;
      color: #0f3f8c;
      overflow-wrap: anywhere;
    }

    @media (max-width: 720px) {
      .status-page__heading,
      .latest-report {
        align-items: stretch;
      }

      .status-page__actions,
      .status-page__locked {
        justify-content: flex-start;
        text-align: left;
      }

      .latest-report {
        display: grid;
      }

      .report-row {
        grid-template-columns: minmax(0, 1fr) auto;
      }

      .report-row > span:nth-child(3),
      .report-row > span:nth-child(4) {
        grid-column: 1 / -1;
      }
    }
  `
})
export class ProjectStatusReportListPageComponent implements OnInit {
  private readonly api = inject(WorktrailApiService);
  private readonly currentUser = inject(CurrentUserService);
  private readonly route = inject(ActivatedRoute);

  readonly summary = signal<ProjectSummaryDto | null>(null);
  readonly reports = signal<ProjectStatusReportSummaryDto[]>([]);
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);
  readonly projectId = computed(() => this.route.snapshot.paramMap.get('projectId') ?? '');
  readonly latestReport = computed(() => this.reports()[0] ?? null);
  readonly previousReports = computed(() => this.reports().slice(1));
  readonly canCreateReport = computed(() => {
    const role = this.currentUser.selectedMember()?.role;

    return (
      this.summary()?.project.status === 'active' &&
      (role === 'owner' || role === 'maintainer')
    );
  });

  ngOnInit(): void {
    this.loadStatusReports();
  }

  loadStatusReports(): void {
    this.isLoading.set(true);
    this.error.set(null);

    forkJoin({
      summary: this.api.getProjectSummary(this.projectId()),
      reports: this.api.listProjectStatusReports(this.projectId())
    }).subscribe({
      next: ({ summary, reports }) => {
        this.summary.set(summary);
        this.reports.set(reports);
        this.isLoading.set(false);
      },
      error: () => {
        this.summary.set(null);
        this.reports.set([]);
        this.error.set('Status reports could not be loaded from the API.');
        this.isLoading.set(false);
      }
    });
  }

  createUnavailableMessage(summary: ProjectSummaryDto): string {
    if (summary.project.status === 'archived') {
      return 'Archived projects cannot publish new reports.';
    }

    return 'Only owners and maintainers can publish reports.';
  }

  healthLabel(state: DeliveryHealthState): string {
    return deliveryHealthLabel(state);
  }

  healthTone(state: DeliveryHealthState): string {
    return deliveryHealthTone(state);
  }

  formatDate(value: string): string {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC'
    }).format(new Date(value));
  }

  formatDateTime(value: string): string {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    }).format(new Date(value));
  }
}
