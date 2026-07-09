import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import type {
  CreateProjectStatusReportRequest,
  DeliveryHealthState,
  PlanningRiskItemDto,
  ProjectStatusReportDraftDto,
  ProjectStatusReportRiskSnapshotDto
} from '@worktrail/contracts';

import { WorktrailApiService } from '../../../core/worktrail-api.service';
import {
  deliveryHealthLabel,
  deliveryHealthTone
} from '../../../shared/delivery-health/delivery-health-display';
import { formatToken } from '../../../shared/display/token-format';
import { ErrorPanelComponent } from '../../../shared/ui/error-panel.component';
import { LoadingIndicatorComponent } from '../../../shared/ui/loading-indicator.component';

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

@Component({
  selector: 'app-project-status-report-draft-page',
  imports: [ErrorPanelComponent, LoadingIndicatorComponent, ReactiveFormsModule, RouterLink],
  template: `
    <section class="status-page">
      <div class="status-page__heading">
        <div>
          <p class="status-page__eyebrow">Reports</p>
          <h1>New report</h1>
        </div>
        <a class="status-page__secondary" [routerLink]="['/projects', projectId(), 'status']">
          Back to reports
        </a>
      </div>

      @if (isLoading()) {
        <app-loading-indicator label="Generating report draft" />
      } @else if (loadError()) {
        <app-error-panel
          title="Draft unavailable"
          [message]="loadError() ?? ''"
          (retry)="loadDraft()"
        />
      } @else if (draft(); as draft) {
        <form class="draft-layout" [formGroup]="draftForm" (ngSubmit)="publishReport()" novalidate>
          <section class="draft-form" aria-labelledby="draft-form-heading">
            <div class="draft-form__heading">
              <h2 id="draft-form-heading">Report narrative</h2>
              <span
                class="health-pill"
                [attr.data-tone]="healthTone(draft.snapshot.health.health)"
              >
                {{ healthLabel(draft.snapshot.health.health) }}
              </span>
            </div>

            @if (publishError()) {
              <section class="form-error" role="alert">
                {{ publishError() }}
              </section>
            }

            <label for="report-title">Title</label>
            <input
              id="report-title"
              type="text"
              formControlName="title"
              autocomplete="off"
              [attr.aria-invalid]="showTitleError()"
            />
            @if (showTitleError()) {
              <p class="field-error">Title is required and must be 120 characters or less.</p>
            }

            <label for="report-status-date">Status date</label>
            <input
              id="report-status-date"
              type="date"
              formControlName="statusDate"
              [attr.aria-invalid]="showStatusDateError()"
            />
            @if (showStatusDateError()) {
              <p class="field-error">Status date is required.</p>
            }

            <label for="report-summary">Summary</label>
            <textarea id="report-summary" rows="5" formControlName="summary"></textarea>
            @if (showSummaryError()) {
              <p class="field-error">Summary is required and must be 4000 characters or less.</p>
            }

            <label for="report-highlights">Highlights</label>
            <textarea id="report-highlights" rows="4" formControlName="highlights"></textarea>

            <label for="report-risks">Risks</label>
            <textarea id="report-risks" rows="4" formControlName="risks"></textarea>

            <label for="report-next-steps">Next steps</label>
            <textarea id="report-next-steps" rows="4" formControlName="nextSteps"></textarea>

            <div class="draft-form__actions">
              <button type="submit" [disabled]="isPublishDisabled()">
                {{ isPublishing() ? 'Publishing...' : 'Publish report' }}
              </button>
              <a class="status-page__secondary" [routerLink]="['/projects', projectId(), 'status']">
                Cancel
              </a>
            </div>
          </section>

          <aside class="snapshot-panel" aria-label="Generated snapshot">
            <section class="snapshot-card">
              <p class="status-page__eyebrow">Snapshot</p>
              <h2>{{ draft.project.name }}</h2>
              <p>Generated {{ formatDateTime(draft.snapshot.generatedAt) }}</p>
            </section>

            <section class="snapshot-card counts-card" aria-label="Work counts">
              <h3>Work counts</h3>
              <dl class="counts-grid">
                <div>
                  <dt>Open</dt>
                  <dd>{{ draft.snapshot.counts.openWorkCount }}</dd>
                </div>
                <div>
                  <dt>Blocked</dt>
                  <dd>{{ draft.snapshot.counts.blockedWorkCount }}</dd>
                </div>
                <div>
                  <dt>Overdue</dt>
                  <dd>{{ draft.snapshot.counts.overdueWorkCount }}</dd>
                </div>
                <div>
                  <dt>Due soon</dt>
                  <dd>{{ draft.snapshot.counts.dueSoonWorkCount }}</dd>
                </div>
              </dl>
            </section>

            <section class="snapshot-card" aria-labelledby="draft-milestones-heading">
              <h3 id="draft-milestones-heading">Milestones</h3>
              @if (draft.snapshot.milestones.length === 0) {
                <p>No active or planned milestones in this snapshot.</p>
              } @else {
                <div class="compact-list">
                  @for (milestone of draft.snapshot.milestones; track milestone.id) {
                    <article class="compact-row">
                      <strong>{{ milestone.name }}</strong>
                      <span>
                        {{ formatToken(milestone.status) }} ·
                        {{ milestone.openCount }} open ·
                        {{ healthLabel(milestone.health) }}
                      </span>
                    </article>
                  }
                </div>
              }
            </section>

            <section class="snapshot-card" aria-labelledby="draft-risks-heading">
              <h3 id="draft-risks-heading">Top risks</h3>
              @if (topRisks().length === 0) {
                <p>No risk sections currently have matching work.</p>
              } @else {
                <div class="compact-list">
                  @for (risk of topRisks(); track risk.type) {
                    <article class="compact-row">
                      <strong>{{ risk.title }}</strong>
                      <span>{{ risk.count }} matching work item{{ risk.count === 1 ? '' : 's' }}</span>
                    </article>
                  }
                </div>
              }
            </section>

            <section class="snapshot-card" aria-labelledby="draft-recent-heading">
              <h3 id="draft-recent-heading">Recent work</h3>
              @if (recentWork().length === 0) {
                <p>No recent work captured in this snapshot.</p>
              } @else {
                <div class="compact-list">
                  @for (item of recentWork(); track item.id) {
                    <article class="compact-row">
                      <strong>{{ item.displayKey }} · {{ item.title }}</strong>
                      <span>{{ formatToken(item.status) }} · {{ formatToken(item.priority) }}</span>
                    </article>
                  }
                </div>
              }
            </section>
          </aside>
        </form>
      }
    </section>
  `,
  styles: `
    .status-page,
    .draft-form,
    .snapshot-panel,
    .snapshot-card,
    .compact-list {
      display: grid;
      gap: 14px;
    }

    .status-page__heading,
    .draft-form__heading,
    .draft-form__actions {
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
      color: #111827;
      font-size: 1.5rem;
      line-height: 1.2;
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
      color: #64748b;
      font-size: 0.875rem;
      line-height: 1.5;
    }

    .draft-layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(280px, 360px);
      gap: 18px;
      align-items: start;
    }

    .draft-form,
    .snapshot-card {
      border: 1px solid #d7e0ea;
      border-radius: 8px;
      padding: 18px;
      background: #ffffff;
    }

    label {
      display: grid;
      gap: 6px;
      color: #334155;
      font-size: 0.875rem;
      font-weight: 800;
    }

    input,
    textarea {
      width: 100%;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 9px 10px;
      color: #111827;
      font: inherit;
      font-size: 0.9rem;
    }

    textarea {
      resize: vertical;
    }

    input[aria-invalid='true'],
    textarea[aria-invalid='true'] {
      border-color: #dc2626;
    }

    .field-error,
    .form-error {
      color: #991b1b;
      font-size: 0.82rem;
      font-weight: 700;
    }

    .form-error {
      border: 1px solid #fecaca;
      border-radius: 7px;
      padding: 10px 12px;
      background: #fff1f2;
    }

    button,
    .status-page__secondary {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 36px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 7px 12px;
      background: #ffffff;
      color: #1e3a5f;
      font: inherit;
      font-size: 0.875rem;
      font-weight: 800;
      text-decoration: none;
    }

    button {
      border-color: #1f4f99;
      background: #1f4f99;
      color: #ffffff;
      cursor: pointer;
    }

    button:disabled {
      border-color: #cbd5e1;
      background: #e2e8f0;
      color: #64748b;
      cursor: not-allowed;
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

    dt {
      color: #64748b;
      font-size: 0.72rem;
      font-weight: 800;
      letter-spacing: 0;
      text-transform: uppercase;
    }

    dd {
      color: #111827;
      font-size: 1.2rem;
      font-weight: 900;
      line-height: 1.2;
    }

    .compact-row {
      display: grid;
      gap: 3px;
      border-top: 1px solid #e5e7eb;
      padding-top: 10px;
      min-width: 0;
    }

    .compact-row:first-child {
      border-top: 0;
      padding-top: 0;
    }

    .compact-row strong,
    .compact-row span {
      min-width: 0;
      overflow-wrap: anywhere;
    }

    .compact-row strong {
      color: #111827;
      font-size: 0.875rem;
      line-height: 1.35;
    }

    .compact-row span {
      color: #64748b;
      font-size: 0.8rem;
      font-weight: 700;
      line-height: 1.35;
    }

    @media (max-width: 900px) {
      .draft-layout {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 560px) {
      .draft-form,
      .snapshot-card {
        padding: 14px;
      }

      .counts-grid {
        grid-template-columns: 1fr;
      }
    }
  `
})
export class ProjectStatusReportDraftPageComponent implements OnInit {
  private readonly api = inject(WorktrailApiService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly draft = signal<ProjectStatusReportDraftDto | null>(null);
  readonly isLoading = signal(false);
  readonly isPublishing = signal(false);
  readonly hasSubmitted = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly publishError = signal<string | null>(null);
  readonly projectId = computed(() => this.route.snapshot.paramMap.get('projectId') ?? '');
  readonly topRisks = computed<ProjectStatusReportRiskSnapshotDto[]>(() =>
    this.draft()?.snapshot.risks.filter((risk) => risk.count > 0).slice(0, 4) ?? []
  );
  readonly recentWork = computed<PlanningRiskItemDto[]>(() =>
    this.draft()?.snapshot.recentWork.slice(0, 5) ?? []
  );
  readonly draftForm = this.formBuilder.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(120)]],
    statusDate: ['', [Validators.required, Validators.pattern(isoDatePattern)]],
    summary: ['', [Validators.required, Validators.maxLength(4000)]],
    highlights: ['', [Validators.maxLength(4000)]],
    risks: ['', [Validators.maxLength(4000)]],
    nextSteps: ['', [Validators.maxLength(4000)]]
  });

  ngOnInit(): void {
    this.loadDraft();
  }

  loadDraft(): void {
    this.isLoading.set(true);
    this.loadError.set(null);
    this.publishError.set(null);
    this.draft.set(null);

    this.api.getProjectStatusReportDraft(this.projectId()).subscribe({
      next: (draft) => {
        this.draft.set(draft);
        this.draftForm.reset({
          title: draft.title,
          statusDate: draft.statusDate,
          summary: draft.summary,
          highlights: draft.highlights,
          risks: draft.risks,
          nextSteps: draft.nextSteps
        });
        this.hasSubmitted.set(false);
        this.isLoading.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.loadError.set(this.toErrorMessage(error, 'Report draft could not be generated.'));
        this.isLoading.set(false);
      }
    });
  }

  publishReport(): void {
    this.hasSubmitted.set(true);
    this.publishError.set(null);

    const draft = this.draft();

    if (draft === null) {
      return;
    }

    if (this.draftForm.invalid) {
      this.draftForm.markAllAsTouched();
      return;
    }

    this.isPublishing.set(true);
    this.api.publishProjectStatusReport(this.projectId(), this.toRequest(draft)).subscribe({
      next: (report) => {
        this.isPublishing.set(false);
        void this.router.navigate(['/projects', this.projectId(), 'status', report.id]);
      },
      error: (error: HttpErrorResponse) => {
        this.publishError.set(this.toErrorMessage(error, 'Report could not be published.'));
        this.isPublishing.set(false);
      }
    });
  }

  isPublishDisabled(): boolean {
    return this.isPublishing() || this.draftForm.invalid;
  }

  showTitleError(): boolean {
    const control = this.draftForm.controls.title;
    return control.invalid && (control.touched || this.hasSubmitted());
  }

  showStatusDateError(): boolean {
    const control = this.draftForm.controls.statusDate;
    return control.invalid && (control.touched || this.hasSubmitted());
  }

  showSummaryError(): boolean {
    const control = this.draftForm.controls.summary;
    return control.invalid && (control.touched || this.hasSubmitted());
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

  formatDateTime(value: string): string {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    }).format(new Date(value));
  }

  private toRequest(draft: ProjectStatusReportDraftDto): CreateProjectStatusReportRequest {
    const value = this.draftForm.getRawValue();

    return {
      title: value.title,
      statusDate: value.statusDate,
      summary: value.summary,
      highlights: value.highlights,
      risks: value.risks,
      nextSteps: value.nextSteps,
      snapshot: draft.snapshot
    };
  }

  private toErrorMessage(error: HttpErrorResponse, fallback: string): string {
    const message = (error.error as { error?: { message?: string } } | null)?.error?.message;
    return message ?? fallback;
  }
}
