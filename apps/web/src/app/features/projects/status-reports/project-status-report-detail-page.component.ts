import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import type {
  DeliveryHealthReasonDto,
  DeliveryHealthState,
  ProjectStatusReportCycleSnapshotDto,
  ProjectStatusReportDetailDto,
  ProjectStatusReportRiskSnapshotDto
} from '@worktrail/contracts';

import { WorktrailApiService } from '../../../core/worktrail-api.service';
import {
  deliveryHealthLabel,
  deliveryHealthReasonLabel,
  deliveryHealthSeverityTone,
  deliveryHealthTone
} from '../../../shared/delivery-health/delivery-health-display';
import { formatToken } from '../../../shared/display/token-format';
import { ErrorPanelComponent } from '../../../shared/ui/error-panel.component';
import { LoadingIndicatorComponent } from '../../../shared/ui/loading-indicator.component';
import { ClipboardService } from '../../../shared/clipboard.service';
import { routerLinkQueryParamsFromWorkItemQuery } from '../../work-items/query/work-item-query-serialization';
import { downloadBlob, fileNameFromContentDisposition } from '../../../shared/download-file';

@Component({
  selector: 'app-project-status-report-detail-page',
  imports: [ErrorPanelComponent, LoadingIndicatorComponent, RouterLink],
  template: `
    <section class="status-page">
      <div class="status-page__heading">
        <div>
          <p class="status-page__eyebrow">Reports · Published snapshots</p>
          <h1>{{ report()?.title ?? 'Report' }}</h1>
        </div>
        <a class="status-page__secondary" [routerLink]="['/projects', projectId(), 'status']">
          Back to reports
        </a>
      </div>

      @if (isLoading()) {
        <app-loading-indicator label="Loading report" />
      } @else if (error()) {
        <app-error-panel
          title="Report unavailable"
          [message]="error() ?? ''"
          (retry)="loadReport()"
        />
      } @else if (report(); as report) {
        <section
          class="report-actions"
          aria-label="Report sharing actions"
          aria-labelledby="report-actions-heading"
        >
          <div>
            <p class="status-page__eyebrow">Share and export</p>
            <h2 id="report-actions-heading">Report actions</h2>
          </div>
          <div class="report-actions__buttons">
            <button
              type="button"
              class="status-page__action"
              [disabled]="isCopyingMarkdown()"
              (click)="copyMarkdown()"
            >
              {{ isCopyingMarkdown() ? 'Copying...' : 'Copy Markdown' }}
            </button>
            <button
              type="button"
              class="status-page__action"
              [disabled]="isDownloadingMarkdown()"
              (click)="downloadMarkdown()"
            >
              {{ isDownloadingMarkdown() ? 'Downloading...' : 'Download Markdown' }}
            </button>
            <button type="button" class="status-page__action" (click)="printReport()">
              Print
            </button>
          </div>
          @if (shareStatus(); as status) {
            <p class="share-status" [attr.data-tone]="status.tone">{{ status.message }}</p>
          }
        </section>

        <section class="snapshot-notice" aria-label="Published snapshot notice">
          <strong>Published snapshot</strong>
          <span>Values reflect the report as published. Links open current project data.</span>
        </section>

        <section class="report-hero">
          <div class="report-hero__content">
            <p class="status-page__eyebrow">{{ report.project.key }} · {{ report.project.name }}</p>
            <h2>{{ report.title }}</h2>
            <dl class="report-meta">
              <div>
                <dt>Status date</dt>
                <dd>{{ formatDate(report.statusDate) }}</dd>
              </div>
              <div>
                <dt>Published</dt>
                <dd>{{ formatDateTime(report.publishedAt) }}</dd>
              </div>
              <div>
                <dt>Author</dt>
                <dd>{{ report.author.name }}</dd>
              </div>
              <div>
                <dt>Snapshot</dt>
                <dd>{{ formatDateTime(report.snapshot.generatedAt) }}</dd>
              </div>
            </dl>
          </div>
          <span class="health-pill" [attr.data-tone]="healthTone(report.health)">
            {{ healthLabel(report.health) }}
          </span>
        </section>

        <section class="report-grid">
          <div class="report-main">
            <section class="report-card narrative-card" aria-labelledby="report-summary-heading">
              <h2 id="report-summary-heading">Summary</h2>
              <p>{{ report.summary }}</p>
            </section>

            <section class="narrative-grid" aria-label="Report narrative">
              <article class="report-card narrative-card">
                <h2>Highlights</h2>
                <p>{{ report.highlights.trim() === '' ? 'No highlights recorded.' : report.highlights }}</p>
              </article>
              <article class="report-card narrative-card">
                <h2>Risks</h2>
                <p>{{ report.risks.trim() === '' ? 'No risks recorded.' : report.risks }}</p>
              </article>
              <article class="report-card narrative-card">
                <h2>Next steps</h2>
                <p>{{ report.nextSteps.trim() === '' ? 'No next steps recorded.' : report.nextSteps }}</p>
              </article>
            </section>

            <section class="report-card" aria-labelledby="report-health-heading">
              <div class="section-heading">
                <div>
                  <p class="status-page__eyebrow">Snapshot health</p>
                  <h2 id="report-health-heading">{{ healthLabel(report.snapshot.health.health) }}</h2>
                </div>
                <span
                  class="health-pill"
                  [attr.data-tone]="healthTone(report.snapshot.health.health)"
                >
                  {{ healthLabel(report.snapshot.health.health) }}
                </span>
              </div>

              @if (report.snapshot.health.reasons.length === 0) {
                <p>No delivery-health reasons captured.</p>
              } @else {
                <div class="reason-list">
                  @for (reason of report.snapshot.health.reasons; track reason.key + reason.message) {
                    <span
                      class="reason-chip"
                      [attr.data-tone]="reasonTone(reason)"
                    >
                      {{ reasonLabel(reason) }}
                    </span>
                  }
                </div>
              }
            </section>

            @if (report.snapshot.cycle; as cycle) {
              <section class="report-card" aria-labelledby="report-cycle-heading">
                <div class="section-heading">
                  <div>
                    <p class="status-page__eyebrow">Active cycle snapshot</p>
                    <h2 id="report-cycle-heading">{{ cycle.name }}</h2>
                  </div>
                  <span class="health-pill" [attr.data-tone]="healthTone(cycle.health)">
                    {{ healthLabel(cycle.health) }}
                  </span>
                </div>

                <p>{{ cycle.goal || 'No cycle goal captured.' }}</p>

                <dl class="counts-grid cycle-counts">
                  <div>
                    <dt>Window</dt>
                    <dd>{{ formatDate(cycle.startDate) }} - {{ formatDate(cycle.endDate) }}</dd>
                  </div>
                  <div>
                    <dt>Estimate</dt>
                    <dd>{{ cycleEstimateLabel(cycle) }}</dd>
                  </div>
                  <div>
                    <dt>Open</dt>
                    <dd>{{ cycle.openWorkCount }}</dd>
                  </div>
                  <div>
                    <dt>Blocked</dt>
                    <dd>{{ cycle.blockedWorkCount }}</dd>
                  </div>
                </dl>

                @if (cycle.reasons.length === 0) {
                  <p>No active-cycle reasons captured.</p>
                } @else {
                  <div class="reason-list">
                    @for (reason of cycle.reasons; track reason.key + reason.message) {
                      <span class="reason-chip" [attr.data-tone]="reasonTone(reason)">
                        {{ reasonLabel(reason) }}
                      </span>
                    }
                  </div>
                }

                <div class="report-links">
                  <a [routerLink]="['/projects', projectId(), 'cycles', cycle.id]">Review cycle</a>
                  <a
                    [routerLink]="['/projects', projectId(), 'work-items']"
                    [queryParams]="cycleWorkQueryParams(cycle)"
                  >
                    Open current cycle work
                  </a>
                </div>
              </section>
            }

            <section class="report-card" aria-labelledby="report-milestones-heading">
              <div class="section-heading">
                <h2 id="report-milestones-heading">Milestones</h2>
              </div>
              @if (report.snapshot.milestones.length === 0) {
                <p>No active or planned milestones were captured.</p>
              } @else {
                <div class="milestone-list">
                  @for (milestone of report.snapshot.milestones; track milestone.id) {
                    <a
                      class="milestone-row"
                      [routerLink]="['/projects', projectId(), 'milestones', milestone.id]"
                    >
                      <span>
                        <strong>{{ milestone.name }}</strong>
                        <small>
                          {{ formatToken(milestone.status) }} ·
                          {{ milestone.targetDate === null ? 'No target date' : 'Target ' + formatDate(milestone.targetDate) }}
                        </small>
                      </span>
                      <span>{{ milestone.openCount }} open</span>
                      <span>{{ milestone.doneCount }} done</span>
                      <span
                        class="health-pill"
                        [attr.data-tone]="healthTone(milestone.health)"
                      >
                        {{ healthLabel(milestone.health) }}
                      </span>
                    </a>
                  }
                </div>
              }
            </section>

            <section class="report-card" aria-labelledby="report-risk-heading">
              <div class="section-heading">
                <h2 id="report-risk-heading">Risk sections</h2>
              </div>
              <div class="risk-list">
                @for (risk of report.snapshot.risks; track risk.type) {
                  <article class="risk-section">
                    <div>
                      <h3>{{ risk.title }}</h3>
                      <p>{{ risk.count }} matching work item{{ risk.count === 1 ? '' : 's' }}</p>
                    </div>
                    <a
                      [routerLink]="['/projects', projectId(), 'work-items']"
                      [queryParams]="riskQueryParams(risk)"
                    >
                      Open current work
                    </a>

                    @if (risk.items.length > 0) {
                      <div class="work-preview">
                        @for (item of risk.items; track item.id) {
                          <a
                            class="work-row"
                            [routerLink]="['/work-items', item.id]"
                            [queryParams]="workItemQueryParams()"
                          >
                            <strong>{{ item.displayKey }} · {{ item.title }}</strong>
                            <span>{{ formatToken(item.status) }} · {{ formatToken(item.priority) }}</span>
                          </a>
                        }
                      </div>
                    }
                  </article>
                }
              </div>
            </section>
          </div>

          <aside class="report-side">
            <section class="report-card counts-card" aria-labelledby="report-counts-heading">
              <h2 id="report-counts-heading">Counts</h2>
              <dl class="counts-grid">
                <div>
                  <dt>Open</dt>
                  <dd>{{ report.snapshot.counts.openWorkCount }}</dd>
                </div>
                <div>
                  <dt>Blocked</dt>
                  <dd>{{ report.snapshot.counts.blockedWorkCount }}</dd>
                </div>
                <div>
                  <dt>Dependency blocked</dt>
                  <dd>{{ report.snapshot.counts.dependencyBlockedWorkCount }}</dd>
                </div>
                <div>
                  <dt>Overdue</dt>
                  <dd>{{ report.snapshot.counts.overdueWorkCount }}</dd>
                </div>
                <div>
                  <dt>Due soon</dt>
                  <dd>{{ report.snapshot.counts.dueSoonWorkCount }}</dd>
                </div>
                <div>
                  <dt>Unassigned</dt>
                  <dd>{{ report.snapshot.counts.unassignedActiveWorkCount }}</dd>
                </div>
              </dl>
            </section>

            <section class="report-card" aria-labelledby="report-recent-heading">
              <h2 id="report-recent-heading">Recent work</h2>
              @if (report.snapshot.recentWork.length === 0) {
                <p>No recent work captured.</p>
              } @else {
                <div class="work-preview">
                  @for (item of report.snapshot.recentWork; track item.id) {
                    <a
                      class="work-row"
                      [routerLink]="['/work-items', item.id]"
                      [queryParams]="workItemQueryParams()"
                    >
                      <strong>{{ item.displayKey }} · {{ item.title }}</strong>
                      <span>{{ formatToken(item.status) }} · Updated {{ formatDateTime(item.updatedAt) }}</span>
                    </a>
                  }
                </div>
              }
            </section>
          </aside>
        </section>
      }
    </section>
  `,
  styles: `
    .status-page,
    .report-main,
    .report-side,
    .report-card,
    .risk-list,
    .work-preview,
    .milestone-list,
    .narrative-grid {
      display: grid;
      gap: 14px;
    }

    .status-page__heading,
    .report-hero,
    .section-heading,
    .milestone-row {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: center;
      justify-content: space-between;
    }

    .status-page__eyebrow,
    h1,
    h2,
    h3,
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
      max-width: 44ch;
      color: #111827;
      font-size: 1.5rem;
      line-height: 1.2;
      overflow-wrap: anywhere;
    }

    h2 {
      color: #111827;
      font-size: 1.05rem;
      line-height: 1.35;
    }

    h3 {
      color: #111827;
      font-size: 0.95rem;
      line-height: 1.35;
    }

    p {
      color: #475569;
      font-size: 0.9rem;
      line-height: 1.55;
      white-space: pre-line;
    }

    .status-page__secondary,
    .status-page__action,
    .risk-section > a {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 36px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 7px 12px;
      background: #ffffff;
      color: #1e3a5f;
      font-size: 0.875rem;
      font-weight: 800;
      text-decoration: none;
      white-space: nowrap;
    }

    .status-page__action {
      cursor: pointer;
    }

    .status-page__action:disabled {
      cursor: not-allowed;
      opacity: 0.68;
    }

    .report-actions {
      display: grid;
      gap: 8px;
      justify-items: start;
    }

    .report-actions__buttons {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      max-width: 100%;
    }

    .share-status {
      border-radius: 6px;
      padding: 7px 10px;
      font-weight: 800;
    }

    .share-status[data-tone='success'] {
      background: #f0fdf4;
      color: #166534;
    }

    .share-status[data-tone='error'] {
      background: #fef2f2;
      color: #991b1b;
    }

    .snapshot-notice {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      border: 1px solid #bfdbfe;
      border-radius: 8px;
      padding: 10px 12px;
      background: #eff6ff;
      color: #1d4ed8;
      font-size: 0.875rem;
      line-height: 1.4;
    }

    .snapshot-notice strong {
      color: #1e3a8a;
    }

    .report-hero,
    .report-card {
      border: 1px solid #d7e0ea;
      border-radius: 8px;
      padding: 18px;
      background: #ffffff;
    }

    .report-hero__content {
      display: grid;
      gap: 10px;
      min-width: 0;
    }

    .report-hero h2 {
      font-size: 1.25rem;
      overflow-wrap: anywhere;
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

    .report-grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(280px, 360px);
      gap: 18px;
      align-items: start;
    }

    .narrative-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .health-pill,
    .reason-chip {
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

    .health-pill[data-tone='positive'],
    .reason-chip[data-tone='positive'] {
      border-color: #86efac;
      background: #f0fdf4;
      color: #166534;
    }

    .health-pill[data-tone='warning'],
    .reason-chip[data-tone='warning'] {
      border-color: #fcd34d;
      background: #fffbeb;
      color: #92400e;
    }

    .health-pill[data-tone='critical'],
    .reason-chip[data-tone='critical'] {
      border-color: #fca5a5;
      background: #fef2f2;
      color: #991b1b;
    }

    .health-pill[data-tone='info'],
    .reason-chip[data-tone='info'] {
      border-color: #93c5fd;
      background: #eff6ff;
      color: #1d4ed8;
    }

    .health-pill[data-tone='neutral'],
    .reason-chip[data-tone='neutral'] {
      border-color: #cbd5e1;
      background: #f8fafc;
      color: #475569;
    }

    .reason-list {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .counts-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }

    .counts-grid div {
      border: 1px solid #e5e7eb;
      border-radius: 7px;
      padding: 10px;
      background: #f8fafc;
    }

    .counts-grid dd {
      color: #111827;
      font-size: 1.2rem;
      font-weight: 900;
    }

    .cycle-counts dd {
      font-size: 0.9rem;
      line-height: 1.35;
      overflow-wrap: anywhere;
    }

    .report-links {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .report-links a {
      display: inline-flex;
      align-items: center;
      min-height: 34px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 0 11px;
      background: #ffffff;
      color: #0f3f8c;
      font-size: 0.8125rem;
      font-weight: 800;
      text-decoration: none;
    }

    .milestone-row,
    .work-row {
      min-width: 0;
      border-top: 1px solid #e5e7eb;
      padding-top: 10px;
      color: #475569;
      text-decoration: none;
    }

    .milestone-row:first-child,
    .work-row:first-child {
      border-top: 0;
      padding-top: 0;
    }

    .milestone-row:hover strong,
    .work-row:hover strong,
    .risk-section > a:hover,
    .report-links a:hover,
    .status-page__secondary:hover,
    .status-page__action:hover:not(:disabled) {
      text-decoration: underline;
    }

    .milestone-row strong,
    .work-row strong,
    .milestone-row small,
    .work-row span {
      min-width: 0;
      overflow-wrap: anywhere;
    }

    .milestone-row strong,
    .work-row strong {
      color: #0f3f8c;
      font-size: 0.875rem;
      line-height: 1.35;
    }

    .milestone-row small,
    .work-row span {
      color: #64748b;
      font-size: 0.8rem;
      font-weight: 700;
      line-height: 1.35;
    }

    .work-row {
      display: grid;
      gap: 3px;
    }

    .risk-section {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 12px;
      border-top: 1px solid #e5e7eb;
      padding-top: 14px;
      align-items: start;
    }

    .risk-section:first-child {
      border-top: 0;
      padding-top: 0;
    }

    .risk-section .work-preview {
      grid-column: 1 / -1;
    }

    @media (max-width: 980px) {
      .report-grid,
      .narrative-grid {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 640px) {
      .status-page__heading {
        align-items: stretch;
      }

      .status-page__secondary,
      .status-page__action {
        width: 100%;
      }

      .report-actions {
        justify-items: stretch;
      }

      .report-actions__buttons {
        display: grid;
        grid-template-columns: 1fr;
      }

      .report-hero,
      .report-card {
        padding: 14px;
      }

      .risk-section {
        grid-template-columns: 1fr;
      }

      .counts-grid {
        grid-template-columns: 1fr;
      }
    }

    @media print {
      :host {
        color: #111827;
      }

      .status-page {
        display: block;
      }

      .status-page__heading,
      .report-actions,
      .share-status {
        display: none !important;
      }

      .snapshot-notice,
      .report-hero,
      .report-card {
        break-inside: avoid;
        page-break-inside: avoid;
        border-color: #cbd5e1;
        box-shadow: none;
      }

      .report-grid,
      .narrative-grid,
      .risk-section {
        display: block;
      }

      .report-main,
      .report-side,
      .risk-list,
      .work-preview,
      .milestone-list {
        display: grid;
        gap: 12px;
      }

      .report-card,
      .snapshot-notice,
      .report-hero {
        margin-bottom: 12px;
        background: #ffffff;
      }

      .report-hero,
      .section-heading,
      .milestone-row {
        align-items: flex-start;
      }

      a[href]::after {
        content: " (" attr(href) ")";
        color: #475569;
        font-size: 0.75rem;
        font-weight: 600;
        overflow-wrap: anywhere;
      }

      .milestone-row,
      .work-row,
      .risk-section > a {
        color: #111827;
      }

      .health-pill,
      .reason-chip {
        border-color: #94a3b8;
        background: #ffffff;
        color: #111827;
      }
    }
  `
})
export class ProjectStatusReportDetailPageComponent implements OnInit {
  private readonly api = inject(WorktrailApiService);
  private readonly clipboard = inject(ClipboardService);
  private readonly route = inject(ActivatedRoute);

  readonly report = signal<ProjectStatusReportDetailDto | null>(null);
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);
  readonly isCopyingMarkdown = signal(false);
  readonly isDownloadingMarkdown = signal(false);
  readonly shareStatus = signal<{ tone: 'error' | 'success'; message: string } | null>(null);
  readonly projectId = computed(() => this.route.snapshot.paramMap.get('projectId') ?? '');
  readonly reportId = computed(() => this.route.snapshot.paramMap.get('reportId') ?? '');

  ngOnInit(): void {
    this.loadReport();
  }

  loadReport(): void {
    this.isLoading.set(true);
    this.error.set(null);

    this.api.getProjectStatusReport(this.projectId(), this.reportId()).subscribe({
      next: (report) => {
        this.report.set(report);
        this.isLoading.set(false);
      },
      error: () => {
        this.report.set(null);
        this.error.set('Report could not be loaded from the API.');
        this.shareStatus.set(null);
        this.isLoading.set(false);
      }
    });
  }

  copyMarkdown(): void {
    if (this.isCopyingMarkdown()) {
      return;
    }

    this.isCopyingMarkdown.set(true);
    this.shareStatus.set(null);

    this.api.exportProjectStatusReportMarkdown(this.projectId(), this.reportId()).subscribe({
      next: (response) => {
        const blob = response.body ?? new Blob([''], { type: 'text/markdown' });

        blob
          .text()
          .then((markdown) => this.clipboard.copyText(markdown))
          .then(() => {
            this.shareStatus.set({ tone: 'success', message: 'Markdown copied.' });
          })
          .catch(() => {
            this.shareStatus.set({ tone: 'error', message: 'Markdown could not be copied.' });
          })
          .finally(() => {
            this.isCopyingMarkdown.set(false);
          });
      },
      error: () => {
        this.shareStatus.set({ tone: 'error', message: 'Markdown could not be copied.' });
        this.isCopyingMarkdown.set(false);
      }
    });
  }

  downloadMarkdown(): void {
    if (this.isDownloadingMarkdown()) {
      return;
    }

    this.isDownloadingMarkdown.set(true);
    this.shareStatus.set(null);

    this.api.exportProjectStatusReportMarkdown(this.projectId(), this.reportId()).subscribe({
      next: (response) => {
        const fileName = fileNameFromContentDisposition(
          response.headers.get('content-disposition'),
          'worktrail-status-report.md'
        );

        downloadBlob({
          blob: response.body ?? new Blob([''], { type: 'text/markdown' }),
          fileName
        });
        this.shareStatus.set({ tone: 'success', message: 'Markdown download started.' });
        this.isDownloadingMarkdown.set(false);
      },
      error: () => {
        this.shareStatus.set({ tone: 'error', message: 'Markdown could not be downloaded.' });
        this.isDownloadingMarkdown.set(false);
      }
    });
  }

  printReport(): void {
    window.print();
  }

  riskQueryParams(risk: ProjectStatusReportRiskSnapshotDto): Record<string, string> | null {
    return routerLinkQueryParamsFromWorkItemQuery(risk.query, 'project');
  }

  cycleWorkQueryParams(cycle: ProjectStatusReportCycleSnapshotDto): Record<string, string> | null {
    return routerLinkQueryParamsFromWorkItemQuery(
      { cycleId: cycle.id, workState: 'open', sort: 'priority_desc' },
      'project'
    );
  }

  workItemQueryParams(): { returnUrl: string } {
    return { returnUrl: `/projects/${this.projectId()}/status/${this.reportId()}` };
  }

  reasonLabel(reason: DeliveryHealthReasonDto): string {
    return deliveryHealthReasonLabel(reason);
  }

  reasonTone(reason: DeliveryHealthReasonDto): string {
    return deliveryHealthSeverityTone(reason.severity);
  }

  healthLabel(state: DeliveryHealthState): string {
    return deliveryHealthLabel(state);
  }

  healthTone(state: DeliveryHealthState): string {
    return deliveryHealthTone(state);
  }

  formatToken(value: string): string {
    return formatToken(value);
  }

  cycleEstimateLabel(cycle: ProjectStatusReportCycleSnapshotDto): string {
    const target = cycle.targetPoints === null ? 'no target' : `${cycle.targetPoints} target`;
    return `${cycle.completedEstimatePoints}/${cycle.committedEstimatePoints} points, ${target}`;
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
