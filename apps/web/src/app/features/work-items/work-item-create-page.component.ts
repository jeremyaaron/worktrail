import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import type {
  CreateWorkItemRequest,
  LabelDto,
  MemberDto,
  MilestoneDto,
  ProjectDto,
  WorkItemPriority,
  WorkItemType
} from '@worktrail/contracts';

import { CurrentUserService } from '../../core/current-user.service';
import { WorktrailApiService } from '../../core/worktrail-api.service';
import { ErrorPanelComponent } from '../../shared/ui/error-panel.component';

const types: WorkItemType[] = ['task', 'bug', 'story', 'chore'];
const priorities: WorkItemPriority[] = ['low', 'medium', 'high', 'urgent'];

@Component({
  selector: 'app-work-item-create-page',
  imports: [ErrorPanelComponent, ReactiveFormsModule, RouterLink],
  template: `
    <section class="page-header">
      <div>
        <p class="eyebrow">Create work item</p>
        <h1>New project work item</h1>
        <p>Capture a scoped task, bug, story, or chore for this project.</p>
      </div>

      <a [routerLink]="['/projects', projectId(), 'work-items']">Back to list</a>
    </section>

    @if (isArchivedProject()) {
      <section class="notice" aria-label="Archived project">
        <strong>Archived project</strong>
        <p>Project work is read-only until it is reactivated in settings.</p>
      </section>
    }

    <form
      class="work-item-form"
      [class.work-item-form--readonly]="isArchivedProject()"
      [formGroup]="workItemForm"
      (ngSubmit)="createWorkItem()"
      novalidate
    >
      <label for="work-item-title">Title</label>
      <input
        id="work-item-title"
        type="text"
        formControlName="title"
        autocomplete="off"
        [attr.aria-invalid]="showTitleError()"
        aria-describedby="work-item-title-error"
      />
      @if (showTitleError()) {
        <p id="work-item-title-error" class="field-error">Title is required.</p>
      }

      <label for="work-item-description">Description</label>
      <textarea
        id="work-item-description"
        rows="5"
        formControlName="description"
      ></textarea>

      <div class="form-grid">
        <label>
          <span>Type</span>
          <select formControlName="type">
            @for (type of types; track type) {
              <option [value]="type">{{ formatToken(type) }}</option>
            }
          </select>
        </label>

        <label>
          <span>Priority</span>
          <select formControlName="priority">
            @for (priority of priorities; track priority) {
              <option [value]="priority">{{ formatToken(priority) }}</option>
            }
          </select>
        </label>

        <label>
          <span>Assignee</span>
          <select formControlName="assigneeId">
            <option value="">Unassigned</option>
            @for (member of members(); track member.id) {
              <option [value]="member.id">{{ member.name }}</option>
            }
          </select>
        </label>

        <label>
          <span>Milestone</span>
          <select formControlName="milestoneId">
            <option value="">No milestone</option>
            @for (milestone of availableMilestones(); track milestone.id) {
              <option [value]="milestone.id">{{ milestone.name }}</option>
            }
          </select>
        </label>

        <label>
          <span>Due date</span>
          <input type="date" formControlName="dueDate" />
        </label>

        <label>
          <span>Estimate</span>
          <input
            type="number"
            min="0"
            step="1"
            formControlName="estimatePoints"
          />
        </label>
      </div>

      @if (milestoneLoadError()) {
        <app-error-panel
          title="Milestones unavailable"
          [message]="milestoneLoadError() ?? ''"
          (retry)="loadProjectMilestones()"
        />
      }

      <section class="label-picker" aria-label="Labels">
        <h2>Labels</h2>
        @if (labelLoadError()) {
          <app-error-panel
            title="Labels unavailable"
            [message]="labelLoadError() ?? ''"
            (retry)="loadProjectLabels()"
          />
        } @else if (availableLabels().length === 0) {
          <p>No project labels are available.</p>
        } @else {
          <div class="label-options">
            @for (label of availableLabels(); track label.id) {
              <label class="label-option">
                <input
                  type="checkbox"
                  [checked]="isLabelSelected(label.id)"
                  [disabled]="isArchivedProject()"
                  (change)="toggleLabel(label.id, $event)"
                />
                <span [style.background]="label.color ?? '#e2e8f0'"></span>
                {{ label.name }}
              </label>
            }
          </div>
        }
      </section>

      @if (createError()) {
        <app-error-panel
          title="Work item not created"
          [message]="createError() ?? ''"
          (retry)="createWorkItem()"
        />
      }

      <div class="form-actions">
        <button type="submit" [disabled]="isArchivedProject() || isCreating()">
          {{ isCreating() ? 'Creating...' : 'Create work item' }}
        </button>
        <a [routerLink]="['/projects', projectId(), 'work-items']">Cancel</a>
      </div>
    </form>
  `,
  styles: `
    .page-header {
      display: flex;
      justify-content: space-between;
      gap: 20px;
      align-items: flex-start;
      margin-bottom: 20px;
    }

    .page-header > a,
    .form-actions a {
      min-height: 38px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 9px 14px;
      color: #1f2937;
      font-size: 0.875rem;
      font-weight: 800;
      text-decoration: none;
    }

    .eyebrow {
      margin: 0 0 6px;
      color: #64748b;
      font-size: 0.75rem;
      font-weight: 800;
      letter-spacing: 0;
      text-transform: uppercase;
    }

    h1,
    p {
      margin: 0;
    }

    h1 {
      color: #111827;
      font-size: 1.75rem;
      line-height: 1.2;
    }

    .page-header p {
      margin-top: 8px;
      color: #64748b;
      font-size: 0.875rem;
      line-height: 1.5;
    }

    .work-item-form {
      display: grid;
      gap: 12px;
      max-width: 820px;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 18px;
      background: #ffffff;
    }

    .work-item-form--readonly {
      background: #f8fafc;
    }

    .notice {
      display: grid;
      gap: 4px;
      max-width: 820px;
      margin-bottom: 18px;
      border: 1px solid #fed7aa;
      border-radius: 8px;
      padding: 14px;
      background: #fff7ed;
      color: #9a3412;
    }

    .notice p {
      margin: 0;
      color: #9a3412;
      font-size: 0.875rem;
      line-height: 1.5;
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
      outline-offset: 0;
    }

    .form-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
    }

    .label-picker {
      display: grid;
      gap: 10px;
    }

    h2 {
      margin: 0;
      color: #111827;
      font-size: 1rem;
      line-height: 1.35;
    }

    .label-picker p {
      color: #64748b;
      font-size: 0.875rem;
      line-height: 1.5;
    }

    .label-options {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }

    .label-option {
      grid-template-columns: 18px 14px minmax(0, 1fr);
      align-items: center;
      min-height: 40px;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 8px 10px;
      background: #f8fafc;
    }

    .label-option input[type='checkbox'] {
      width: 16px;
      min-height: 16px;
      height: 16px;
      margin: 0;
      padding: 0;
    }

    .label-option span {
      width: 10px;
      height: 10px;
      border-radius: 3px;
    }

    .field-error {
      color: #b91c1c;
      font-size: 0.8125rem;
      line-height: 1.4;
    }

    .form-actions {
      display: flex;
      gap: 10px;
      align-items: center;
      margin-top: 4px;
    }

    button {
      min-height: 38px;
      border: 1px solid #1f4f99;
      border-radius: 6px;
      padding: 9px 14px;
      background: #1f4f99;
      color: #ffffff;
      font: inherit;
      font-size: 0.875rem;
      font-weight: 800;
      cursor: pointer;
    }

    button:disabled {
      cursor: not-allowed;
      opacity: 0.64;
    }

    @media (max-width: 760px) {
      .page-header,
      .form-actions {
        align-items: stretch;
        flex-direction: column;
      }

      .form-grid,
      .label-options {
        grid-template-columns: 1fr;
      }
    }
  `
})
export class WorkItemCreatePageComponent implements OnInit {
  private readonly api = inject(WorktrailApiService);
  private readonly currentUser = inject(CurrentUserService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly types = types;
  readonly priorities = priorities;
  readonly members = computed<MemberDto[]>(() => this.currentUser.members());
  readonly projectId = computed(() => this.route.snapshot.paramMap.get('projectId') ?? '');
  readonly project = signal<ProjectDto | null>(null);
  readonly availableLabels = signal<LabelDto[]>([]);
  readonly availableMilestones = signal<MilestoneDto[]>([]);
  readonly selectedLabelIds = signal<string[]>([]);
  readonly isCreating = signal(false);
  readonly hasSubmitted = signal(false);
  readonly createError = signal<string | null>(null);
  readonly labelLoadError = signal<string | null>(null);
  readonly milestoneLoadError = signal<string | null>(null);
  readonly isArchivedProject = computed(() => this.project()?.status === 'archived');

  readonly workItemForm = this.formBuilder.nonNullable.group({
    title: ['', [Validators.required]],
    description: [''],
    type: ['task'],
    priority: ['medium'],
    assigneeId: [''],
    milestoneId: [''],
    dueDate: [''],
    estimatePoints: ['']
  });

  ngOnInit(): void {
    if (this.currentUser.members().length === 0) {
      this.currentUser.loadMembers();
    }

    this.loadProject();
    this.loadProjectLabels();
    this.loadProjectMilestones();
  }

  createWorkItem(): void {
    this.hasSubmitted.set(true);
    this.createError.set(null);

    if (this.isArchivedProject()) {
      return;
    }

    if (this.workItemForm.invalid) {
      this.workItemForm.markAllAsTouched();
      return;
    }

    this.isCreating.set(true);
    this.api.createWorkItem(this.projectId(), this.toRequest()).subscribe({
      next: (workItem) => {
        void this.router.navigate(['/work-items', workItem.id]);
      },
      error: () => {
        this.createError.set('The work item could not be created.');
        this.isCreating.set(false);
      }
    });
  }

  showTitleError(): boolean {
    const control = this.workItemForm.controls.title;
    return control.invalid && (control.touched || this.hasSubmitted());
  }

  formatToken(value: string): string {
    return value.replaceAll('_', ' ');
  }

  loadProjectLabels(): void {
    this.labelLoadError.set(null);
    this.api.listProjectLabels(this.projectId()).subscribe({
      next: (labels) => {
        this.availableLabels.set(labels.filter((label) => !label.isArchived));
      },
      error: () => {
        this.labelLoadError.set('Project labels could not be loaded from the API.');
      }
    });
  }

  loadProjectMilestones(): void {
    this.milestoneLoadError.set(null);
    this.api.listProjectMilestones(this.projectId()).subscribe({
      next: (milestones) => {
        this.availableMilestones.set(milestones.filter((milestone) => !milestone.isArchived));
      },
      error: () => {
        this.milestoneLoadError.set('Project milestones could not be loaded from the API.');
      }
    });
  }

  loadProject(): void {
    this.api.getProject(this.projectId()).subscribe({
      next: (project) => {
        this.project.set(project);
        this.syncReadOnlyState();
      },
      error: () => {
        this.project.set(null);
        this.syncReadOnlyState();
      }
    });
  }

  toggleLabel(labelId: string, event: Event): void {
    if (this.isArchivedProject()) {
      return;
    }

    const checked = (event.target as HTMLInputElement).checked;
    const selected = new Set(this.selectedLabelIds());

    if (checked) {
      selected.add(labelId);
    } else {
      selected.delete(labelId);
    }

    this.selectedLabelIds.set([...selected]);
  }

  isLabelSelected(labelId: string): boolean {
    return this.selectedLabelIds().includes(labelId);
  }

  private syncReadOnlyState(): void {
    if (this.isArchivedProject()) {
      this.workItemForm.disable({ emitEvent: false });
    } else {
      this.workItemForm.enable({ emitEvent: false });
    }
  }

  private toRequest(): CreateWorkItemRequest {
    const formValue = this.workItemForm.getRawValue();
    const estimate = this.normalizeEstimate(formValue.estimatePoints);

    return {
      title: formValue.title.trim(),
      description: formValue.description.trim(),
      type: formValue.type as WorkItemType,
      priority: formValue.priority as WorkItemPriority,
      assigneeId: formValue.assigneeId === '' ? null : formValue.assigneeId,
      labelIds: this.selectedLabelIds(),
      milestoneId: formValue.milestoneId === '' ? null : formValue.milestoneId,
      dueDate: formValue.dueDate === '' ? null : formValue.dueDate,
      estimatePoints: estimate === '' ? null : Number.parseInt(estimate, 10)
    };
  }

  private normalizeEstimate(value: string | number): string {
    return typeof value === 'number' ? value.toString() : value.trim();
  }
}
