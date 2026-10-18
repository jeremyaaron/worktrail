
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import type { MilestoneDto, MilestoneStatus } from '@worktrail/contracts';
import { formatCycleDate } from '../../../shared/cycles/cycle-display';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { ErrorPanelComponent } from '../../../shared/ui/error-panel.component';
import { LoadingIndicatorComponent } from '../../../shared/ui/loading-indicator.component';
export interface MilestoneUpdateRequest { milestone: MilestoneDto; name: string; description: string; status: string; targetDate: string; }
@Component({
selector: 'app-milestone-manager', imports: [ReactiveFormsModule, RouterLink, EmptyStateComponent, ErrorPanelComponent, LoadingIndicatorComponent],
  template: `<section class="milestone-panel" aria-labelledby="milestones-heading">
          <div class="panel-heading">
            <div>
              <h2 id="milestones-heading">Milestones</h2>

            </div>
            <span>{{ milestones.length }} total</span>
          </div>

          @if (isLoadingMilestones) {
            <app-loading-indicator label="Loading milestones" />
          } @else if (milestoneLoadError) {
            <app-error-panel [message]="milestoneLoadError" (retry)="retryLoad.emit()" />
          } @else if (milestones.length === 0) {
            <app-empty-state
              title="No milestones yet"
              message="Create a milestone to start grouping delivery targets."
            />
          } @else {
            <div class="milestone-list" aria-label="Project milestones">
              @for (milestone of milestones; track milestone.id) {
                <article
                  class="milestone-row"
                  [class.milestone-row--archived]="milestone.isArchived"
                >
                  <div class="milestone-row__title">
                    <h3><a [routerLink]="['/projects',projectId,'milestones',milestone.id]">{{ milestone.name }}</a></h3>
                    <p>{{ milestone.description || 'No description provided.' }}</p>
                  </div>

                  <div class="milestone-row__meta">
                    <span class="status-pill" [class.status-pill--archived]="milestone.isArchived">
                      {{ milestone.isArchived ? 'archived' : formatToken(milestone.status) }}
                    </span>
                    <span>{{ milestone.targetDate === null ? 'No target date' : formatDate(milestone.targetDate) }}</span>
                    <span>Updated {{ formatDateTime(milestone.updatedAt) }}</span>
                  </div>

                  @if (canManageMilestones) {
 <details class="record-edit"><summary>Edit {{ milestone.name }}</summary><div class="milestone-row__fields">
                      <label>
                        <span>Name</span>
                        <input
                          #milestoneName
                          type="text"
                          [value]="milestone.name"
                          [disabled]="writeBlocked"
                        />
                      </label>

                      <label>
                        <span>Description</span>
                        <textarea
                          #milestoneDescription
                          rows="2"
                          [disabled]="writeBlocked"
                        >{{ milestone.description }}</textarea>
                      </label>

                      <label>
                        <span>Status</span>
                        <select
                          #milestoneStatus

                          [disabled]="writeBlocked"
                        >
                          @for (status of milestoneStatuses; track status) {
                            <option [value]="status" [selected]="status === milestone.status">{{ formatToken(status) }}</option>
                          }
                        </select>
                      </label>

                      <label>
                        <span>Target date</span>
                        <input
                          #milestoneTargetDate
                          type="date"
                          [value]="milestone.targetDate ?? ''"
                          [disabled]="writeBlocked"
                        />
                      </label>
                    </div>

                    <div class="milestone-actions">
                      <button
                        type="button"
                        [disabled]="writeBlocked"
                        (click)="update.emit({milestone, name:milestoneName.value, description:milestoneDescription.value, status:milestoneStatus.value, targetDate:milestoneTargetDate.value})"
                      >
                        {{ isMutating(milestone) ? 'Saving...' : 'Save' }}
                      </button>

                      @if (milestone.isArchived) {
                        <button
                          type="button"
                          [disabled]="writeBlocked"
                          (click)="reactivate.emit(milestone)"
                        >
                          Reactivate
                        </button>
                      } @else {
                        <button
                          type="button"
                          class="danger-button"
                          [disabled]="writeBlocked"
                          (click)="archive.emit(milestone)"
                        >
                          Archive
                        </button>
                      }
                    </div></details>
                  }
 @if (mutationErrors[milestone.id]) { <p class="field-error" role="alert">{{ mutationErrors[milestone.id] }}</p> }
 @if (mutationMessages[milestone.id]) { <p class="success-message" role="status">{{ mutationMessages[milestone.id] }}</p> }
                </article>
              }
            </div>
          }
@if (canManageMilestones) {
            <details class="create-disclosure" [open]="hasSubmittedCreate"><summary>Create milestone</summary><form class="milestone-form" [formGroup]="milestoneForm" (ngSubmit)="create.emit()" novalidate>
              <fieldset [disabled]="writeBlocked"><label for="milestone-name">Name</label>
              <input
                id="milestone-name"
                type="text"
                formControlName="name"
                autocomplete="off"
                [attr.aria-invalid]="showMilestoneNameError()"
                aria-describedby="milestone-name-error"
              />
              @if (showMilestoneNameError()) {
                <p id="milestone-name-error" class="field-error">Milestone name is required.</p>
              }

              <label for="milestone-description">Description</label>
              <textarea id="milestone-description" rows="3" formControlName="description"></textarea>

              <div class="milestone-form__grid">
                <label>
                  <span>Status</span>
                  <select formControlName="status">
                    @for (status of milestoneStatuses; track status) {
                      <option [value]="status">{{ formatToken(status) }}</option>
                    }
                  </select>
                </label>

                <label>
                  <span>Target date</span>
                  <input type="date" formControlName="targetDate" />
                </label>
              </div>

              <button type="submit" [disabled]="isCreatingMilestone">
                {{ isCreatingMilestone ? 'Creating...' : 'Create milestone' }}
              </button>
            </fieldset></form></details>
          }

          @if (createError) {
            <p class="field-error">{{ createError }}</p>
          }

@if (successMessage) {<p class="success-message" role="status">{{ successMessage }}</p>}
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

    button {
      min-height: 36px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 8px 12px;
      background: #ffffff;
      color: #1f2937;
      font: inherit;
      font-size: 0.875rem;
      font-weight: 700;
      text-decoration: none;
    }

    button:not(:disabled):hover {
      border-color: #94a3b8;
      background: #f8fafc;
      cursor: pointer;
    }

    button[type="submit"] {
      border-color: #1d4ed8;
      background: #2563eb;
      color: #ffffff;
    }

    button[type="submit"]:not(:disabled):hover {
      background: #1d4ed8;
    }

    button:disabled {
      cursor: not-allowed;
      opacity: 0.6;
    }

    .danger-button {
      border-color: #fecaca;
      color: #991b1b;
    }

    .status-pill {
      display: inline-flex;
      align-items: center;
      min-height: 24px;
      border: 1px solid #cbd5e1;
      border-radius: 999px;
      padding: 3px 8px;
      color: #334155;
      font-size: 0.75rem;
      font-weight: 800;
      text-transform: uppercase;
    }

    .status-pill {
      margin-left: 6px;
      border-color: #bbf7d0;
      color: #166534;
    }

    .status-pill--archived {
      border-color: #cbd5e1;
      color: #64748b;
    }

    .panel-heading {
      display: flex;
      align-items: start;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 18px;
    }

    .panel-heading > span {
      color: #64748b;
      font-size: 0.8125rem;
      font-weight: 800;
    }

    .milestone-form {
      display: grid;
      gap: 10px;
      margin-bottom: 18px;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 14px;
      background: #f8fafc;
    }

    .milestone-form__grid,
    .milestone-row__fields {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }

    label {
      display: grid;
      gap: 6px;
      color: #334155;
      font-size: 0.8125rem;
      font-weight: 800;
    }

    label span {
      color: #475569;
    }

    input,
    select,
    textarea {
      width: 100%;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 8px 10px;
      background: #ffffff;
      color: #111827;
      font: inherit;
      font-size: 0.875rem;
    }

    textarea {
      resize: vertical;
    }

    input:disabled,
    select:disabled,
    textarea:disabled {
      background: #f8fafc;
      color: #64748b;
    }

    .field-error {
      color: #b91c1c;
      font-size: 0.8125rem;
      font-weight: 700;
    }

    .success-message {
      color: #166534;
      font-size: 0.8125rem;
      font-weight: 800;
    }

    .milestone-list {
      display: grid;
      gap: 12px;
    }

    .milestone-row {
      display: grid;
      gap: 12px;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 14px;
      background: #ffffff;
    }

    .milestone-row--archived {
      background: #f8fafc;
    }

    .milestone-row__title {
      display: grid;
      gap: 4px;
    }

    .milestone-row__meta,
    .milestone-actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }

    .record-edit .milestone-actions {
      margin-top: 12px;
    }

    .milestone-row__meta {
      color: #64748b;
      font-size: 0.8125rem;
      font-weight: 700;
    }

    @media (max-width: 900px) {
      .milestone-form__grid,
      .milestone-row__fields {
        grid-template-columns: 1fr;
      }
    } :host {display:block;} fieldset {display:grid;gap:10px;border:0;padding:0;margin:0;min-width:0;} details {border-top:1px solid #e5e7eb;padding-top:12px;} summary {cursor:pointer;font-weight:700;padding:8px 0;} .create-disclosure {margin-top:20px;} .milestone-form {border:0;background:transparent;padding:12px 0;margin:0;} a {color:#1d4ed8;} p,h3,summary {overflow-wrap:anywhere;}`
})
export class MilestoneManagerComponent {
  @Input({ required: true }) projectId = '';
  @Input({ required: true }) milestoneForm!: FormGroup;
  @Input() milestones: MilestoneDto[] = [];
  @Input() milestoneStatuses: MilestoneStatus[] = ['planned', 'active', 'completed', 'canceled'];
  @Input() canManageMilestones = false;
  @Input() isLoadingMilestones = false;
  @Input() isCreatingMilestone = false;
  @Input() hasSubmittedCreate = false;
  @Input() mutatingMilestoneId: string | null = null;
  @Input() milestoneLoadError: string | null = null;
  @Input() createError: string | null = null;
  @Input() successMessage: string | null = null;
  @Input() mutationErrors: Record<string, string> = {};
  @Input() mutationMessages: Record<string, string> = {};
  @Input() writeBlocked = false;
  @Output() readonly create = new EventEmitter<void>();
  @Output() readonly retryLoad = new EventEmitter<void>();
  @Output() readonly update = new EventEmitter<MilestoneUpdateRequest>();
  @Output() readonly archive = new EventEmitter<MilestoneDto>();
  @Output() readonly reactivate = new EventEmitter<MilestoneDto>();
  isMutating(milestone: MilestoneDto): boolean {
    return this.mutatingMilestoneId === milestone.id;
  }

  showMilestoneNameError(): boolean {
    const control = this.milestoneForm.controls['name'];
    return control.invalid && (control.touched || this.hasSubmittedCreate);
  }

  formatToken(value: string): string {
    return value.replaceAll('_', ' ');
  }

  formatDateTime(value: string): string {
    return new Intl.DateTimeFormat('en', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(new Date(value));
  }
  formatDate(value: string): string { return formatCycleDate(value); }
}
