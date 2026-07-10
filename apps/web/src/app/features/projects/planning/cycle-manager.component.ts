import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import type { ProjectCycleDto, ProjectCycleStatus } from '@worktrail/contracts';

import {
  cycleDateRangeLabel,
  cycleStatusLabel
} from '../../../shared/cycles/cycle-display';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { ErrorPanelComponent } from '../../../shared/ui/error-panel.component';
import { LoadingIndicatorComponent } from '../../../shared/ui/loading-indicator.component';

export interface CycleUpdateRequest {
  cycle: ProjectCycleDto;
  name: string;
  goal: string;
  status: string;
  startDate: string;
  endDate: string;
  targetPoints: string;
}

@Component({
  selector: 'app-cycle-manager',
  imports: [
    EmptyStateComponent,
    ErrorPanelComponent,
    LoadingIndicatorComponent,
    ReactiveFormsModule,
    RouterLink
  ],
  template: `
    <section class="panel cycle-panel" aria-labelledby="cycles-heading">
      <div class="panel-heading">
        <div>
          <h2 id="cycles-heading">Cycles</h2>
          <p>Plan timeboxed delivery windows for scoped project work.</p>
        </div>
        <span>{{ cycles.length }} total</span>
      </div>

      @if (canManageCycles) {
        <form class="cycle-form" [formGroup]="cycleForm" (ngSubmit)="create.emit()" novalidate>
          <label for="cycle-name">Name</label>
          <input
            id="cycle-name"
            type="text"
            formControlName="name"
            autocomplete="off"
            [attr.aria-invalid]="showCycleNameError()"
            aria-describedby="cycle-name-error"
          />
          @if (showCycleNameError()) {
            <p id="cycle-name-error" class="field-error">Cycle name is required.</p>
          }

          <label for="cycle-goal">Goal</label>
          <textarea id="cycle-goal" rows="3" formControlName="goal"></textarea>

          <div class="cycle-form__grid">
            <label>
              <span>Status</span>
              <select formControlName="status">
                @for (status of cycleStatuses; track status) {
                  <option [value]="status">{{ cycleStatusLabel(status) }}</option>
                }
              </select>
            </label>

            <label>
              <span>Start date</span>
              <input type="date" formControlName="startDate" />
            </label>

            <label>
              <span>End date</span>
              <input type="date" formControlName="endDate" />
            </label>

            <label>
              <span>Target points</span>
              <input type="number" min="1" max="999" step="1" formControlName="targetPoints" />
            </label>
          </div>

          @if (cycleSuccessMessage) {
            <p class="success-message">{{ cycleSuccessMessage }}</p>
          }

          <button type="submit" [disabled]="isCreatingCycle">
            {{ isCreatingCycle ? 'Creating...' : 'Create cycle' }}
          </button>
        </form>
      }

      @if (cycleCreateError) {
        <p class="field-error">{{ cycleCreateError }}</p>
      }

      @if (cycleMutationError) {
        <app-error-panel
          title="Cycle change failed"
          [message]="cycleMutationError"
          (retry)="retryLoad.emit()"
        />
      }

      @if (isLoadingCycles) {
        <app-loading-indicator label="Loading cycles" />
      } @else if (cycleLoadError) {
        <app-error-panel [message]="cycleLoadError" (retry)="retryLoad.emit()" />
      } @else if (cycles.length === 0) {
        <app-empty-state
          title="No cycles yet"
          message="Create a cycle to start planning timeboxed work."
        />
      } @else {
        <div class="cycle-list" aria-label="Project cycles">
          @for (cycle of cycles; track cycle.id) {
            <article class="cycle-row" [class.cycle-row--archived]="cycle.isArchived">
              <div class="cycle-row__header">
                <div class="cycle-row__title">
                  <h3>{{ cycle.name }}</h3>
                  <p>{{ cycle.goal || 'No goal provided.' }}</p>
                </div>

                <div class="cycle-row__links">
                  <a [routerLink]="['/projects', projectId, 'cycles', cycle.id]">Review</a>
                  <a
                    [routerLink]="['/projects', projectId, 'work-items']"
                    [queryParams]="{ cycleId: cycle.id, sort: 'priority_desc' }"
                  >
                    Work
                  </a>
                </div>
              </div>

              <div class="cycle-row__meta">
                <span class="status-pill" [class.status-pill--archived]="cycle.isArchived">
                  {{ cycle.isArchived ? 'archived' : cycleStatusLabel(cycle.status) }}
                </span>
                <span>{{ cycleDateRangeLabel(cycle) }}</span>
                <span>{{ cycle.targetPoints === null ? 'No target' : cycle.targetPoints + ' target points' }}</span>
                <span>Updated {{ formatDateTime(cycle.updatedAt) }}</span>
              </div>

              @if (canManageCycles) {
                <div class="cycle-row__fields">
                  <label>
                    <span>Name</span>
                    <input #cycleName type="text" [value]="cycle.name" [disabled]="isMutatingCycle(cycle)" />
                  </label>

                  <label>
                    <span>Goal</span>
                    <textarea #cycleGoal rows="2" [disabled]="isMutatingCycle(cycle)">{{ cycle.goal }}</textarea>
                  </label>

                  <label>
                    <span>Status</span>
                    <select #cycleStatus [value]="cycle.status" [disabled]="isMutatingCycle(cycle)">
                      @for (status of cycleStatuses; track status) {
                        <option [value]="status">{{ cycleStatusLabel(status) }}</option>
                      }
                    </select>
                  </label>

                  <label>
                    <span>Start date</span>
                    <input
                      #cycleStartDate
                      type="date"
                      [value]="cycle.startDate"
                      [disabled]="isMutatingCycle(cycle)"
                    />
                  </label>

                  <label>
                    <span>End date</span>
                    <input
                      #cycleEndDate
                      type="date"
                      [value]="cycle.endDate"
                      [disabled]="isMutatingCycle(cycle)"
                    />
                  </label>

                  <label>
                    <span>Target points</span>
                    <input
                      #cycleTargetPoints
                      type="number"
                      min="1"
                      max="999"
                      step="1"
                      [value]="cycle.targetPoints ?? ''"
                      [disabled]="isMutatingCycle(cycle)"
                    />
                  </label>
                </div>

                <div class="cycle-actions">
                  <button
                    type="button"
                    [disabled]="isMutatingCycle(cycle)"
                    (click)="update.emit({
                      cycle,
                      name: cycleName.value,
                      goal: cycleGoal.value,
                      status: cycleStatus.value,
                      startDate: cycleStartDate.value,
                      endDate: cycleEndDate.value,
                      targetPoints: cycleTargetPoints.value
                    })"
                  >
                    {{ isMutatingCycle(cycle) ? 'Saving...' : 'Save' }}
                  </button>

                  @if (cycle.isArchived) {
                    <button
                      type="button"
                      [disabled]="isMutatingCycle(cycle)"
                      (click)="reactivate.emit(cycle)"
                    >
                      Reactivate
                    </button>
                  } @else {
                    <button
                      type="button"
                      class="danger-button"
                      [disabled]="isMutatingCycle(cycle)"
                      (click)="archive.emit(cycle)"
                    >
                      Archive
                    </button>
                  }
                </div>
              }
            </article>
          }
        </div>
      }
    </section>
  `,
  styles: `
    .panel {
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 18px;
      background: #ffffff;
    }

    .panel-heading {
      display: flex;
      align-items: start;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 18px;
    }

    .panel-heading > span,
    .cycle-row__meta {
      color: #64748b;
      font-size: 0.8125rem;
      font-weight: 800;
    }

    h2,
    h3,
    p {
      margin: 0;
    }

    h2 {
      color: #111827;
      font-size: 1rem;
      line-height: 1.25;
    }

    h3 {
      color: #111827;
      font-size: 0.95rem;
      line-height: 1.25;
    }

    p {
      color: #64748b;
      font-size: 0.875rem;
      line-height: 1.5;
    }

    .cycle-form {
      display: grid;
      gap: 10px;
      margin-bottom: 18px;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 14px;
      background: #f8fafc;
    }

    .cycle-form__grid,
    .cycle-row__fields {
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
    }

    button:not(:disabled):hover {
      border-color: #94a3b8;
      background: #f8fafc;
      cursor: pointer;
    }

    button[type='submit'] {
      border-color: #1d4ed8;
      background: #2563eb;
      color: #ffffff;
    }

    button[type='submit']:not(:disabled):hover {
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

    .cycle-list {
      display: grid;
      gap: 12px;
    }

    .cycle-row {
      display: grid;
      gap: 12px;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 14px;
      background: #ffffff;
    }

    .cycle-row--archived {
      background: #f8fafc;
    }

    .cycle-row__title {
      display: grid;
      gap: 4px;
    }

    .cycle-row__header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
    }

    .cycle-row__links,
    .cycle-row__meta,
    .cycle-actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }

    .cycle-row__links {
      justify-content: flex-end;
    }

    .cycle-row__links a {
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

    .cycle-row__links a:hover {
      background: #f8fafc;
    }

    .status-pill {
      display: inline-flex;
      align-items: center;
      min-height: 24px;
      border: 1px solid #bbf7d0;
      border-radius: 999px;
      padding: 3px 8px;
      color: #166534;
      font-size: 0.75rem;
      font-weight: 800;
      text-transform: uppercase;
    }

    .status-pill--archived {
      border-color: #cbd5e1;
      color: #64748b;
    }

    @media (max-width: 900px) {
      .cycle-form__grid,
      .cycle-row__fields {
        grid-template-columns: 1fr;
      }

      .cycle-row__header {
        display: grid;
      }

      .cycle-row__links {
        justify-content: flex-start;
      }
    }
  `
})
export class CycleManagerComponent {
  @Input({ required: true }) cycleForm!: FormGroup;
  @Input({ required: true }) projectId = '';
  @Input() cycles: ProjectCycleDto[] = [];
  @Input() cycleStatuses: ProjectCycleStatus[] = [];
  @Input() canManageCycles = false;
  @Input() isLoadingCycles = false;
  @Input() isCreatingCycle = false;
  @Input() hasSubmittedCycleCreate = false;
  @Input() mutatingCycleId: string | null = null;
  @Input() cycleLoadError: string | null = null;
  @Input() cycleCreateError: string | null = null;
  @Input() cycleMutationError: string | null = null;
  @Input() cycleSuccessMessage: string | null = null;

  @Output() readonly create = new EventEmitter<void>();
  @Output() readonly retryLoad = new EventEmitter<void>();
  @Output() readonly update = new EventEmitter<CycleUpdateRequest>();
  @Output() readonly archive = new EventEmitter<ProjectCycleDto>();
  @Output() readonly reactivate = new EventEmitter<ProjectCycleDto>();

  showCycleNameError(): boolean {
    const control = this.cycleForm.get('name');
    return Boolean(control?.invalid && (control.touched || this.hasSubmittedCycleCreate));
  }

  isMutatingCycle(cycle: ProjectCycleDto): boolean {
    return this.mutatingCycleId === cycle.id;
  }

  cycleStatusLabel(status: ProjectCycleStatus): string {
    return cycleStatusLabel(status);
  }

  cycleDateRangeLabel(cycle: Pick<ProjectCycleDto, 'startDate' | 'endDate'>): string {
    return cycleDateRangeLabel(cycle);
  }

  formatDateTime(value: string): string {
    return new Intl.DateTimeFormat('en', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(new Date(value));
  }
}
