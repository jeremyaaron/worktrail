import { Component, DestroyRef, ElementRef, afterRenderEffect, inject, output, viewChild } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { AuthoredContentEditorComponent } from '../../../shared/authored-content/authored-content-editor.component';
import { ErrorPanelComponent } from '../../../shared/ui/error-panel.component';

import { WorkItemDetailStore } from '../work-item-detail.store';
@Component({
  selector: 'app-work-item-detail-editor',
  imports: [ReactiveFormsModule, ErrorPanelComponent, AuthoredContentEditorComponent],
  template: `@if (state.isEditing()) { @if (state.workItem(); as item) {
        <section id="edit-work-item" class="panel" aria-labelledby="edit-work-item-heading">

          <h2 id="edit-work-item-heading">Edit work item</h2>

          <form
            class="detail-form"
            [formGroup]="state.detailForm"
            (ngSubmit)="state.updateWorkItem()"
            novalidate
          >
            <label for="detail-title">Title</label>
            <input
              id="detail-title" #titleInput
              type="text"
              formControlName="title"
              [attr.aria-invalid]="state.showTitleError()"
              aria-describedby="detail-title-error"
            />
            @if (state.showTitleError()) {
              <p id="detail-title-error" class="field-error">Title is required.</p>
            }

            <app-authored-content-editor
              fieldId="detail-description"
              label="Description"
              [rows]="5"
              formControlName="descriptionContent"
              [resetIdentity]="state.descriptionEditorIdentity()"
              [invalid]="state.showDescriptionError()"
              errorDescriptionIds="detail-description-error"
            />
            @if (state.showDescriptionError()) {
              <p id="detail-description-error" class="field-error">
                Changed descriptions must be 10,000 characters or fewer.
              </p>
            }

            <div class="form-grid">
              <label>
                <span>Type</span>
                <select formControlName="type">
                  @for (type of state.types; track type) {
                    <option [value]="type">{{ state.formatToken(type) }}</option>
                  }
                </select>
              </label>

              <label>
                <span>Priority</span>
                <select formControlName="priority">
                  @for (priority of state.priorities; track priority) {
                    <option [value]="priority">{{ state.formatToken(priority) }}</option>
                  }
                </select>
              </label>

              <label>
                <span>Assignee</span>
                <select formControlName="assigneeId">
                  <option value="">Unassigned</option>
                  @for (member of state.assigneeOptions(); track member.id) {
                    <option [value]="member.id">{{ state.memberDisplayName(member) }}</option>
                  }
                </select>
              </label>

              <label>
                <span>Milestone</span>
                <select formControlName="milestoneId">
                  <option value="">No milestone</option>
                  @for (milestone of state.availableMilestones(); track milestone.id) {
                    <option [value]="milestone.id">{{ milestone.name }}</option>
                  }
                </select>
              </label>

              <label>
                <span>Cycle</span>
                <select formControlName="cycleId">
                  <option value="">No cycle</option>
                  @for (cycle of state.availableCycles(); track cycle.id) {
                    <option [value]="cycle.id">{{ cycle.name }}</option>
                  }
                </select>
              </label>

              <label for="detail-estimate"><span>Estimate (points)</span>
                <input id="detail-estimate" type="number" min="0" max="2147483647" step="1"
                  (input)="state.validatePlanningInput('estimatePoints', $any($event.target).validity.badInput)" formControlName="estimatePoints"
                  [attr.aria-invalid]="state.showPlanningError('estimatePoints')" aria-describedby="detail-estimate-error" />
                @if (state.showPlanningError('estimatePoints')) {
                  <span id="detail-estimate-error" class="field-error">Enter a whole number from 0 to 2,147,483,647.</span>
                }
              </label>
              <label for="detail-due-date"><span>Due date</span>
                <input id="detail-due-date" type="date" min="0001-01-01" max="9999-12-31"
                  (input)="state.validatePlanningInput('dueDate', $any($event.target).validity.badInput)" formControlName="dueDate"
                  [attr.aria-invalid]="state.showPlanningError('dueDate')" aria-describedby="detail-due-date-error" />
                @if (state.showPlanningError('dueDate')) {
                  <span id="detail-due-date-error" class="field-error">Enter a valid calendar date.</span>
                }
              </label>
            </div>

            @if (state.milestoneLoadError()) {
              <app-error-panel
                title="Milestones unavailable"
                [message]="state.milestoneLoadError() ?? ''"
                (retry)="state.loadProjectMilestones(item.projectId)"
              />
            }

            @if (state.cycleLoadError()) {
              <app-error-panel
                title="Cycles unavailable"
                [message]="state.cycleLoadError() ?? ''"
                (retry)="state.loadProjectCycles(item.projectId)"
              />
            }

            <section class="label-editor" aria-label="Labels">
              <h3>Labels</h3>
              @if (state.labelLoadError()) {
                <app-error-panel
                  title="Labels unavailable"
                  [message]="state.labelLoadError() ?? ''"
                  (retry)="state.loadProjectLabels(item.projectId)"
                />
              } @else if (
                state.assignableLabels().length === 0 && state.archivedAttachedLabels().length === 0
              ) {
                <p>No project labels are available.</p>
              } @else {
                @if (state.assignableLabels().length > 0) {
                  <div class="label-options">
                    @for (label of state.assignableLabels(); track label.id) {
                      <label class="label-option">
                        <input
                          type="checkbox"
                          [checked]="state.isLabelSelected(label.id)"
                          [disabled]="state.isArchivedProject() || state.isUpdating()"
                          (change)="state.toggleLabel(label.id, $event)"
                        />
                        <span [style.background]="label.color ?? '#e2e8f0'"></span>
                        {{ label.name }}
                      </label>
                    }
                  </div>
                }

                @if (state.archivedAttachedLabels().length > 0) {
                  <div class="archived-labels" aria-label="Archived attached labels">
                    @for (label of state.archivedAttachedLabels(); track label.id) {
                      <span [style.border-color]="label.color ?? '#cbd5e1'">{{ label.name }}</span>
                    }
                  </div>
                }
              }
            </section>

            @if (state.updateError()) {
              <app-error-panel
                title="Update failed"
                [message]="state.updateError() ?? ''"
                (retry)="state.updateWorkItem()"
              />
            }

            @if (state.saveNotice()) { <p role="status">{{ state.saveNotice() }}</p> }
            <button type="submit" [disabled]="state.isArchivedProject() || state.isUpdating()">
              {{ state.isUpdating() ? 'Saving...' : 'Save changes' }}
            </button>
            <button
              type="button"
              class="secondary-action"
              [disabled]="state.isArchivedProject() || state.isUpdating()"
              (click)="cancel()"
            >
              Cancel
            </button>
          </form>
        </section>

} }`,
  styles: `
    h1,
h2,
h3,
p,
dl,
dd,
ol {
      margin: 0;
    }

    h2 {
      color: #111827;
      font-size: 1rem;
      line-height: 1.35;
    }

    h3 {
      color: #334155;
      font-size: 0.875rem;
      line-height: 1.35;
    }

    .label-editor p {
      margin-top: 8px;
      color: #64748b;
      font-size: 0.875rem;
      line-height: 1.5;
    }

    button,
.secondary-action {
      min-height: 38px;
      border: 1px solid #1f4f99;
      border-radius: 6px;
      padding: 9px 14px;
      background: #1f4f99;
      color: #ffffff;
      font: inherit;
      font-size: 0.875rem;
      font-weight: 800;
      text-decoration: none;
      cursor: pointer;
    }

    .secondary-action {
      border-color: #cbd5e1;
      background: #ffffff;
      color: #1f2937;
    }

    button:disabled {
      cursor: not-allowed;
      opacity: 0.64;
    }

    .panel {
      display: grid;
      min-width: 0;
      gap: 14px;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 18px;
      background: #ffffff;
    }

    app-work-item-parent-manager {
      display: block;
      margin-bottom: 18px;
    }

    .detail-form {
      display: grid;
      gap: 12px;
    }

    .form-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
    }

    label {
      display: grid;
      gap: 6px;
      color: #334155;
      font-size: 0.8125rem;
      font-weight: 800;
    }

    input,
select,
textarea {
      width: 100%;
      min-height: 38px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 8px 10px;
      background: #ffffff;
      color: #111827;
      font: inherit;
      font-size: 0.875rem;
    }

    input:focus,
select:focus,
textarea:focus {
      border-color: #1d4ed8;
      outline: 2px solid #bfdbfe;
    }

    .field-error {
      color: #b91c1c;
      font-size: 0.8125rem;
    }

    .label-editor,
.label-options {
      display: grid;
      gap: 10px;
    }

    .label-options {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .label-option {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 700;
    }

    .label-option input[type='checkbox'] {
      width: 16px;
      height: 16px;
      min-height: 16px;
      margin: 0;
      padding: 0;
      flex: 0 0 auto;
    }

    .label-option span {
      width: 12px;
      height: 12px;
      border-radius: 3px;
    }

    .archived-labels {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .archived-labels span {
      border: 1px solid #cbd5e1;
      border-radius: 999px;
      padding: 3px 8px;
      background: #f8fafc;
      color: #64748b;
      font-size: 0.75rem;
      font-weight: 800;
      text-decoration: line-through;
    }

    dt {
      color: #64748b;
      font-size: 0.75rem;
      font-weight: 800;
    }

    dd {
      color: #111827;
      font-size: 0.875rem;
      font-weight: 700;
    }

    @media (max-width: 920px) {

      .form-grid,
.label-options {
        grid-template-columns: 1fr;
      }
    }

.panel { border: 0; border-top: 1px solid #e5e7eb; border-radius: 0; padding: 20px 0; background: transparent; }
`
})
export class WorkItemDetailEditorComponent {
  readonly state = inject(WorkItemDetailStore);
  readonly closed = output<void>();
  private readonly destroyRef = inject(DestroyRef);
  async cancel(): Promise<void> {
    const isCurrent = this.state.context.capture();
    if (await this.state.requestDiscardDetailChanges() && isCurrent() && !this.destroyRef.destroyed) {
      this.closed.emit();
    }
  }
  private readonly titleInput = viewChild<ElementRef<HTMLInputElement>>('titleInput');
  constructor() { afterRenderEffect(() => this.titleInput()?.nativeElement.focus()); }
}
