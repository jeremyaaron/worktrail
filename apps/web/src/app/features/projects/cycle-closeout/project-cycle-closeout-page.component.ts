import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import type {
  DeliveryHealthReasonDto,
  ProjectCycleCloseoutItemSnapshotDto,
  ProjectCycleCloseoutPreviewDto,
  WorkItemPriority,
  WorkItemStatus
} from '@worktrail/contracts';
import { Subscription } from 'rxjs';

import { CyclesApi } from '../../../core/api/cycles-api';
import { extractApiErrorMessage } from '../../../core/api/api-error';
import { cycleDateRangeLabel } from '../../../shared/cycles/cycle-display';
import {
  deliveryHealthLabel,
  deliveryHealthReasonLabel,
  deliveryHealthTone
} from '../../../shared/delivery-health/delivery-health-display';
import { ErrorPanelComponent } from '../../../shared/ui/error-panel.component';
import { LoadingIndicatorComponent } from '../../../shared/ui/loading-indicator.component';

const statusLabels: Record<WorkItemStatus, string> = {
  backlog: 'Backlog',
  ready: 'Ready',
  in_progress: 'In progress',
  blocked: 'Blocked',
  done: 'Done',
  canceled: 'Canceled'
};

const priorityLabels: Record<WorkItemPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent'
};

@Component({
  selector: 'app-project-cycle-closeout-page',
  imports: [ErrorPanelComponent, LoadingIndicatorComponent, ReactiveFormsModule, RouterLink],
  template: `
    <section class="closeout-page">
      @if (isLoading()) {
        <app-loading-indicator label="Loading cycle closeout preview" />
      } @else if (loadError()) {
        <app-error-panel
          title="Closeout preview unavailable"
          [message]="loadError() ?? ''"
          (retry)="loadPreview()"
        />
      } @else if (preview(); as preview) {
        <header class="page-header">
          <div>
            <p class="eyebrow">Cycle closeout</p>
            <h1>{{ preview.cycle.name }}</h1>
            <p class="header-meta">
              <span>{{ preview.project.key }}</span>
              <span>{{ dateRangeLabel(preview) }}</span>
              <span>{{ preview.cycle.goal || 'No cycle goal provided.' }}</span>
            </p>
          </div>
          <a [routerLink]="['/projects', projectId(), 'cycles', cycleId()]">Back to review</a>
        </header>

        <section class="metrics" aria-label="Closeout scope metrics">
          <div><span>Total</span><strong>{{ preview.counts.totalCount }}</strong></div>
          <div><span>Completed</span><strong>{{ preview.counts.completedCount }}</strong></div>
          <div><span>Canceled</span><strong>{{ preview.counts.canceledCount }}</strong></div>
          <div><span>Unfinished</span><strong>{{ preview.counts.unfinishedCount }}</strong></div>
          <div>
            <span>Committed points</span>
            <strong>{{ preview.counts.committedEstimatePoints }}</strong>
          </div>
          <div>
            <span>Unfinished points</span>
            <strong>{{ preview.counts.unfinishedEstimatePoints }}</strong>
          </div>
        </section>

        <section class="health-section" [attr.data-tone]="healthTone(preview)">
          <div class="section-heading">
            <div>
              <p class="eyebrow">Closeout health</p>
              <h2>{{ healthLabel(preview) }}</h2>
            </div>
            @if (preview.counts.unestimatedUnfinishedCount > 0) {
              <span>{{ preview.counts.unestimatedUnfinishedCount }} unestimated unfinished</span>
            }
          </div>
          @if (preview.health.reasons.length > 0) {
            <ul class="reason-list">
              @for (reason of preview.health.reasons; track reason.key) {
                <li>{{ reasonLabel(reason) }}</li>
              }
            </ul>
          } @else {
            <p class="quiet-copy">No delivery risks are present in the current cycle scope.</p>
          }
        </section>

        <section class="work-section" aria-labelledby="unfinished-heading">
          <div class="section-heading">
            <div>
              <p class="eyebrow">Carryover scope</p>
              <h2 id="unfinished-heading">Unfinished work</h2>
            </div>
            <span>{{ preview.counts.unfinishedCount }} items</span>
          </div>

          @if (preview.unfinishedItems.length === 0) {
            <p class="empty-copy">All cycle work is terminal. No work item assignments will move.</p>
          } @else {
            <div class="work-list" role="list">
              @for (item of preview.unfinishedItems; track item.id) {
                <article class="work-row" role="listitem">
                  <div class="work-row__identity">
                    <a [routerLink]="['/work-items', item.id]">{{ item.displayKey }}</a>
                    <strong>{{ item.title }}</strong>
                  </div>
                  <div class="work-row__metadata">
                    <span>{{ statusLabel(item.status) }}</span>
                    <span>{{ priorityLabel(item.priority) }}</span>
                    <span>{{ assigneeLabel(item) }}</span>
                    <span>{{ estimateLabel(item) }}</span>
                    @if (item.dependencyBlocked) {
                      <span class="dependency-signal">Dependency blocked</span>
                    }
                  </div>
                </article>
              }
            </div>
          }
        </section>

        <form class="decision-section" [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <div class="section-heading">
            <div>
              <p class="eyebrow">Closeout decision</p>
              <h2>Destination</h2>
            </div>
          </div>

          @if (preview.counts.unfinishedCount === 0) {
            <p class="decision-copy">
              Closing completes the cycle and preserves this snapshot. No work items will move.
            </p>
          } @else {
            <fieldset [disabled]="isSubmitting()">
              <legend>Choose one destination for all unfinished work</legend>
              @for (option of preview.eligibleDestinations; track option.cycle.id) {
                <label class="destination-option">
                  <input
                    type="radio"
                    formControlName="destinationCycleId"
                    [value]="option.cycle.id"
                  />
                  <span>
                    <strong>{{ option.cycle.name }}</strong>
                    <small>{{ dateRange(option.cycle) }}</small>
                  </span>
                </label>
              }
              <label class="destination-option">
                <input type="radio" formControlName="destinationCycleId" [value]="null" />
                <span>
                  <strong>Return to unplanned work</strong>
                  <small>Clear the cycle assignment. Workflow statuses remain unchanged.</small>
                </span>
              </label>
            </fieldset>
            @if (preview.eligibleDestinations.length === 0) {
              <p class="quiet-copy">No planned destination cycles are currently available.</p>
            }
            <p class="decision-copy">
              {{ preview.counts.unfinishedCount }} unfinished
              {{ preview.counts.unfinishedCount === 1 ? 'item' : 'items' }} will move to
              <strong>{{ selectedDestinationLabel(preview) }}</strong>. Completed and canceled work
              remains assigned to this cycle.
            </p>
          }

          @if (conflictError()) {
            <section class="conflict" role="alert">
              <div>
                <strong>Closeout scope changed</strong>
                <p>{{ conflictError() }}</p>
              </div>
              <button type="button" (click)="loadPreview()">Refresh preview</button>
            </section>
          } @else if (submitError()) {
            <p class="submit-error" role="alert">{{ submitError() }}</p>
          }

          <div class="form-actions">
            <a [routerLink]="['/projects', projectId(), 'cycles', cycleId()]">Cancel</a>
            <button type="submit" [disabled]="isSubmitting()">
              {{ isSubmitting() ? 'Closing...' : 'Close cycle' }}
            </button>
          </div>
        </form>
      }
    </section>
  `,
  styles: `
    :host { display: block; }
    .closeout-page { display: grid; gap: 28px; max-width: 1180px; margin: 0 auto; padding: 8px 0 48px; color: #111827; }
    .page-header, .section-heading, .form-actions, .conflict { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; }
    .page-header h1 { margin: 3px 0 8px; font-size: clamp(1.8rem, 3vw, 2.35rem); line-height: 1.12; letter-spacing: 0; }
    .page-header > a, .form-actions > a { min-height: 38px; display: inline-flex; align-items: center; color: #334155; font-size: .875rem; font-weight: 700; text-decoration: none; }
    .eyebrow { margin: 0; color: #64748b; font-size: .72rem; font-weight: 800; letter-spacing: 0; text-transform: uppercase; }
    .header-meta { display: flex; flex-wrap: wrap; gap: 8px 16px; margin: 0; color: #52637a; font-size: .9rem; }
    .metrics { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); border-block: 1px solid #dbe3ed; }
    .metrics div { display: grid; gap: 5px; min-width: 0; padding: 16px 14px; border-right: 1px solid #e5eaf0; }
    .metrics div:last-child { border-right: 0; }
    .metrics span, .work-row__metadata, .quiet-copy, .empty-copy, .decision-copy { color: #52637a; font-size: .84rem; line-height: 1.5; }
    .metrics strong { font-size: 1.35rem; }
    .health-section, .work-section, .decision-section { padding-top: 4px; }
    .health-section { border-left: 4px solid #94a3b8; padding: 16px 18px; background: #f8fafc; }
    .health-section[data-tone='positive'] { border-left-color: #059669; }
    .health-section[data-tone='warning'] { border-left-color: #d97706; }
    .health-section[data-tone='critical'] { border-left-color: #dc2626; }
    .section-heading { align-items: end; margin-bottom: 14px; }
    .section-heading h2 { margin: 3px 0 0; font-size: 1.15rem; letter-spacing: 0; }
    .section-heading > span { color: #64748b; font-size: .8rem; font-weight: 700; }
    .reason-list { display: grid; gap: 6px; margin: 10px 0 0; padding-left: 18px; color: #334155; font-size: .86rem; }
    .quiet-copy, .empty-copy { margin: 8px 0 0; }
    .work-list { border-top: 1px solid #dbe3ed; }
    .work-row { display: grid; grid-template-columns: minmax(240px, 1fr) minmax(320px, auto); gap: 18px; padding: 14px 4px; border-bottom: 1px solid #e5eaf0; }
    .work-row__identity { display: flex; align-items: baseline; gap: 10px; min-width: 0; }
    .work-row__identity a { color: #1d4ed8; font-size: .8rem; font-weight: 800; text-decoration: none; }
    .work-row__identity strong { overflow-wrap: anywhere; font-size: .92rem; }
    .work-row__metadata { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 6px 12px; }
    .dependency-signal { color: #b42318; font-weight: 800; }
    .decision-section { border-top: 1px solid #cbd5e1; padding-top: 24px; }
    fieldset { display: grid; gap: 8px; margin: 0; padding: 0; border: 0; }
    legend { margin-bottom: 10px; color: #334155; font-size: .86rem; font-weight: 700; }
    .destination-option { display: grid; grid-template-columns: 20px 1fr; align-items: center; gap: 10px; min-height: 58px; padding: 9px 12px; border: 1px solid #cbd5e1; border-radius: 6px; cursor: pointer; }
    .destination-option:has(input:checked) { border-color: #2563eb; background: #eff6ff; }
    .destination-option input { width: 16px; height: 16px; margin: 0; accent-color: #2563eb; }
    .destination-option span { display: grid; gap: 2px; min-width: 0; }
    .destination-option strong { font-size: .9rem; }
    .destination-option small { color: #52637a; font-size: .8rem; line-height: 1.35; }
    .decision-copy { margin: 14px 0 0; }
    .conflict { align-items: center; margin-top: 16px; padding: 12px 14px; border: 1px solid #f5c16c; border-radius: 6px; background: #fffbeb; color: #78350f; }
    .conflict p { margin: 3px 0 0; font-size: .83rem; }
    .conflict button, .form-actions button { min-height: 38px; border-radius: 6px; padding: 0 14px; font: inherit; font-size: .86rem; font-weight: 800; cursor: pointer; }
    .conflict button { border: 1px solid #d97706; background: #fff; color: #92400e; white-space: nowrap; }
    .submit-error { margin: 14px 0 0; color: #b42318; font-size: .86rem; font-weight: 700; }
    .form-actions { align-items: center; justify-content: flex-end; margin-top: 20px; }
    .form-actions button { min-width: 112px; border: 1px solid #1d4ed8; background: #1d4ed8; color: #fff; }
    .form-actions button:disabled, fieldset:disabled { opacity: .62; cursor: wait; }
    @media (max-width: 900px) {
      .metrics { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      .metrics div:nth-child(3) { border-right: 0; }
      .metrics div:nth-child(-n + 3) { border-bottom: 1px solid #e5eaf0; }
      .work-row { grid-template-columns: 1fr; gap: 8px; }
      .work-row__metadata { justify-content: flex-start; }
    }
    @media (max-width: 600px) {
      .closeout-page { gap: 22px; }
      .page-header { display: grid; }
      .metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .metrics div:nth-child(3) { border-right: 1px solid #e5eaf0; }
      .metrics div:nth-child(even) { border-right: 0; }
      .metrics div:nth-child(-n + 4) { border-bottom: 1px solid #e5eaf0; }
      .conflict { display: grid; }
    }
  `
})
export class ProjectCycleCloseoutPageComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly cyclesApi = inject(CyclesApi);
  private readonly formBuilder = inject(FormBuilder);
  private readonly subscriptions = new Subscription();
  private previewSubscription: Subscription | null = null;
  private closeSubscription: Subscription | null = null;

  readonly projectId = signal('');
  readonly cycleId = signal('');
  readonly preview = signal<ProjectCycleCloseoutPreviewDto | null>(null);
  readonly isLoading = signal(true);
  readonly isSubmitting = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly submitError = signal<string | null>(null);
  readonly conflictError = signal<string | null>(null);
  readonly form = this.formBuilder.group({
    destinationCycleId: this.formBuilder.control<string | null>(null)
  });

  ngOnInit(): void {
    this.subscriptions.add(
      this.route.paramMap.subscribe((params) => {
        this.projectId.set(params.get('projectId') ?? '');
        this.cycleId.set(params.get('cycleId') ?? '');
        this.loadPreview();
      })
    );
  }

  ngOnDestroy(): void {
    this.previewSubscription?.unsubscribe();
    this.closeSubscription?.unsubscribe();
    this.subscriptions.unsubscribe();
  }

  loadPreview(): void {
    const projectId = this.projectId();
    const cycleId = this.cycleId();
    this.previewSubscription?.unsubscribe();
    this.closeSubscription?.unsubscribe();
    this.closeSubscription = null;
    this.isSubmitting.set(false);
    this.form.enable({ emitEvent: false });
    this.preview.set(null);
    this.loadError.set(null);
    this.submitError.set(null);
    this.conflictError.set(null);

    if (projectId === '' || cycleId === '') {
      this.isLoading.set(false);
      this.loadError.set('Cycle closeout route is missing required identifiers.');
      return;
    }

    this.isLoading.set(true);
    this.previewSubscription = this.cyclesApi.getCloseoutPreview(projectId, cycleId).subscribe({
      next: (preview) => {
        this.preview.set(preview);
        const defaultDestination =
          preview.counts.unfinishedCount > 0
            ? (preview.eligibleDestinations[0]?.cycle.id ?? null)
            : null;
        this.form.controls.destinationCycleId.setValue(defaultDestination);

        if (preview.counts.unfinishedCount === 0) {
          this.form.controls.destinationCycleId.disable({ emitEvent: false });
        } else {
          this.form.controls.destinationCycleId.enable({ emitEvent: false });
        }

        this.isLoading.set(false);
      },
      error: (error: unknown) => {
        this.loadError.set(
          extractApiErrorMessage(error, 'The cycle closeout preview could not be loaded.')
        );
        this.isLoading.set(false);
      }
    });
  }

  submit(): void {
    const preview = this.preview();

    if (preview === null || this.isSubmitting()) {
      return;
    }

    this.isSubmitting.set(true);
    this.submitError.set(null);
    this.conflictError.set(null);
    this.form.disable({ emitEvent: false });
    const destinationCycleId =
      preview.counts.unfinishedCount === 0
        ? null
        : this.form.getRawValue().destinationCycleId;

    this.closeSubscription = this.cyclesApi
      .closeCycle(this.projectId(), this.cycleId(), { destinationCycleId })
      .subscribe({
        next: () => {
          void this.router.navigate([
            '/projects',
            this.projectId(),
            'cycles',
            this.cycleId()
          ]);
        },
        error: (error: HttpErrorResponse) => {
          const message = extractApiErrorMessage(
            error,
            'The cycle could not be closed. Refresh the preview and try again.'
          );

          if (error.status === 409) {
            this.conflictError.set(message);
          } else {
            this.submitError.set(message);
          }

          this.isSubmitting.set(false);
          if (preview.counts.unfinishedCount > 0) {
            this.form.enable({ emitEvent: false });
          }
        }
      });
  }

  dateRangeLabel(preview: ProjectCycleCloseoutPreviewDto): string {
    return cycleDateRangeLabel(preview.cycle);
  }

  dateRange(cycle: ProjectCycleCloseoutPreviewDto['eligibleDestinations'][number]['cycle']): string {
    return cycleDateRangeLabel(cycle);
  }

  healthLabel(preview: ProjectCycleCloseoutPreviewDto): string {
    return deliveryHealthLabel(preview.health.health);
  }

  healthTone(preview: ProjectCycleCloseoutPreviewDto): string {
    return deliveryHealthTone(preview.health.health);
  }

  reasonLabel(reason: DeliveryHealthReasonDto): string {
    return deliveryHealthReasonLabel(reason);
  }

  statusLabel(status: WorkItemStatus): string {
    return statusLabels[status];
  }

  priorityLabel(priority: WorkItemPriority): string {
    return priorityLabels[priority];
  }

  assigneeLabel(item: ProjectCycleCloseoutItemSnapshotDto): string {
    return item.assignee?.name ?? 'Unassigned';
  }

  estimateLabel(item: ProjectCycleCloseoutItemSnapshotDto): string {
    return item.estimatePoints === null ? 'Unestimated' : `${item.estimatePoints} points`;
  }

  selectedDestinationLabel(preview: ProjectCycleCloseoutPreviewDto): string {
    const destinationId = this.form.controls.destinationCycleId.value;
    return (
      preview.eligibleDestinations.find((option) => option.cycle.id === destinationId)?.cycle.name ??
      'unplanned work'
    );
  }
}
