import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import type {
  CreateWorkItemRequest,
  LabelDto,
  MemberDto,
  MilestoneDto,
  ProjectDto,
  WorkItemDetailDto,
  WorkItemPriority,
  WorkItemType,
  WorkspaceCapabilitiesDto
} from '@worktrail/contracts';
import { Subscription, distinctUntilChanged } from 'rxjs';

import { CurrentUserService } from '../../core/current-user.service';
import { WorktrailApiService } from '../../core/worktrail-api.service';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { ErrorPanelComponent } from '../../shared/ui/error-panel.component';
import { LoadingIndicatorComponent } from '../../shared/ui/loading-indicator.component';

const types: WorkItemType[] = ['task', 'bug', 'story', 'chore'];
const priorities: WorkItemPriority[] = ['low', 'medium', 'high', 'urgent'];

@Component({
  selector: 'app-work-item-create-page',
  imports: [
    EmptyStateComponent,
    ErrorPanelComponent,
    LoadingIndicatorComponent,
    ReactiveFormsModule,
    RouterLink
  ],
  template: `
    <section class="page-header">
      <div>
        <p class="eyebrow">Create work item</p>
        <h1>{{ isProjectScoped() ? 'New project work item' : 'New work item' }}</h1>
        <p>
          {{
            isProjectScoped()
              ? 'Capture a scoped task, bug, story, or chore for this project.'
              : 'Choose a project, then capture a task, bug, story, or chore.'
          }}
        </p>
      </div>

      <a [routerLink]="returnCommands()">{{ returnLabel() }}</a>
    </section>

    @if (projectLoadError()) {
      <app-error-panel
        title="Project unavailable"
        [message]="projectLoadError() ?? ''"
        (retry)="retryProjectLoad()"
      />
    }

    @if (isArchivedProject()) {
      <section class="notice" aria-label="Archived project">
        <strong>Archived project</strong>
        <p>Project work is read-only until it is reactivated in settings.</p>
      </section>
    }

    @if (!canCreateWorkItems()) {
      <section class="notice" aria-label="Create permission unavailable">
        <strong>Create unavailable</strong>
        <p>The current actor does not have permission to create work items.</p>
      </section>
    }

    @if (createdWorkItem(); as created) {
      <section class="success-panel" aria-label="Work item created">
        <div>
          <strong>{{ created.displayKey }} created</strong>
          <p>{{ created.title }}</p>
        </div>

        <div class="success-actions">
          <a [routerLink]="['/work-items', created.id]">Open work item</a>
          <button type="button" class="secondary-action" (click)="createAnother()">Create another</button>
          <a [routerLink]="returnCommands()">{{ returnLabel() }}</a>
        </div>
      </section>
    }

    <form
      class="work-item-form"
      [class.work-item-form--readonly]="isArchivedProject() || !canCreateWorkItems()"
      [formGroup]="workItemForm"
      (ngSubmit)="createWorkItem()"
      novalidate
    >
      @if (!isProjectScoped()) {
        <label for="work-item-project">Project</label>
        @if (isProjectListLoading()) {
          <app-loading-indicator label="Loading projects" />
        } @else if (projectListError()) {
          <app-error-panel
            title="Projects unavailable"
            [message]="projectListError() ?? ''"
            (retry)="loadProjects()"
          />
        } @else if (activeProjects().length === 0) {
          <app-empty-state
            title="No active projects"
            message="Reactivate or create a project before capturing workspace work."
          />
        } @else {
          <select id="work-item-project" formControlName="projectId">
            <option value="">Select a project</option>
            @for (project of activeProjects(); track project.id) {
              <option [value]="project.id">{{ project.key }} · {{ project.name }}</option>
            }
          </select>
        }
        @if (showProjectError()) {
          <p class="field-error">Project is required.</p>
        }
      }

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
        } @else if (selectedProjectId() === '') {
          <p>Select a project to choose labels.</p>
        } @else if (availableLabels().length === 0) {
          <p>No project labels are available.</p>
        } @else {
          <div class="label-options">
            @for (label of availableLabels(); track label.id) {
              <label class="label-option">
                <input
                  type="checkbox"
                  [checked]="isLabelSelected(label.id)"
                  [disabled]="isArchivedProject() || !canCreateWorkItems()"
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
        <button type="submit" [disabled]="isCreateDisabled()">
          {{ isCreating() ? 'Creating...' : 'Create work item' }}
        </button>
        <a [routerLink]="returnCommands()">Cancel</a>
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
    .form-actions a,
    .success-actions a {
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

    .notice,
    .success-panel {
      display: grid;
      gap: 4px;
      max-width: 820px;
      margin-bottom: 18px;
      border-radius: 8px;
      padding: 14px;
    }

    .notice {
      border: 1px solid #fed7aa;
      background: #fff7ed;
      color: #9a3412;
    }

    .success-panel {
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 14px;
      align-items: center;
      border: 1px solid #bbf7d0;
      background: #f0fdf4;
      color: #166534;
    }

    .notice p,
    .success-panel p {
      margin: 0;
      font-size: 0.875rem;
      line-height: 1.5;
    }

    .notice p {
      color: #9a3412;
    }

    .success-panel p {
      color: #166534;
    }

    .success-actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 8px;
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
      margin: 0;
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

    .secondary-action {
      border-color: #cbd5e1;
      background: #ffffff;
      color: #1f2937;
    }

    button:disabled {
      cursor: not-allowed;
      opacity: 0.64;
    }

    @media (max-width: 760px) {
      .page-header,
      .form-actions,
      .success-panel {
        align-items: stretch;
        grid-template-columns: 1fr;
        flex-direction: column;
      }

      .success-actions {
        justify-content: flex-start;
      }

      .form-grid,
      .label-options {
        grid-template-columns: 1fr;
      }
    }
  `
})
export class WorkItemCreatePageComponent implements OnDestroy, OnInit {
  private readonly api = inject(WorktrailApiService);
  private readonly currentUser = inject(CurrentUserService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly subscriptions = new Subscription();
  private readonly routeProjectId = this.route.snapshot.paramMap.get('projectId') ?? '';

  readonly types = types;
  readonly priorities = priorities;
  readonly members = computed<MemberDto[]>(() => this.currentUser.activeMembers());
  readonly isProjectScoped = computed(() => this.routeProjectId !== '');
  readonly selectedProjectId = signal(this.routeProjectId);
  readonly project = signal<ProjectDto | null>(null);
  readonly activeProjects = signal<ProjectDto[]>([]);
  readonly capabilities = signal<WorkspaceCapabilitiesDto | null>(null);
  readonly availableLabels = signal<LabelDto[]>([]);
  readonly availableMilestones = signal<MilestoneDto[]>([]);
  readonly selectedLabelIds = signal<string[]>([]);
  readonly createdWorkItem = signal<WorkItemDetailDto | null>(null);
  readonly isCreating = signal(false);
  readonly hasSubmitted = signal(false);
  readonly isProjectListLoading = signal(false);
  readonly createError = signal<string | null>(null);
  readonly projectListError = signal<string | null>(null);
  readonly projectLoadError = signal<string | null>(null);
  readonly labelLoadError = signal<string | null>(null);
  readonly milestoneLoadError = signal<string | null>(null);
  readonly isArchivedProject = computed(() => this.project()?.status === 'archived');
  readonly canCreateWorkItems = computed(() => this.capabilities()?.canCreateWorkItems !== false);
  readonly isCreateDisabled = computed(
    () =>
      this.selectedProjectId() === '' ||
      this.isArchivedProject() ||
      !this.canCreateWorkItems() ||
      this.isCreating()
  );

  readonly workItemForm = this.formBuilder.nonNullable.group({
    projectId: [this.routeProjectId, [Validators.required]],
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

    this.loadCapabilities();
    this.watchProjectSelection();

    if (this.isProjectScoped()) {
      this.workItemForm.controls.projectId.setValue(this.routeProjectId, { emitEvent: false });
      this.loadProjectContext(this.routeProjectId);
    } else {
      this.loadProjects();
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  createWorkItem(): void {
    this.hasSubmitted.set(true);
    this.createError.set(null);
    this.createdWorkItem.set(null);

    if (this.selectedProjectId() === '') {
      this.workItemForm.controls.projectId.markAsTouched();
      this.createError.set('Select an active project before creating work.');
      return;
    }

    if (this.isArchivedProject() || !this.canCreateWorkItems()) {
      return;
    }

    if (this.workItemForm.invalid) {
      this.workItemForm.markAllAsTouched();
      return;
    }

    this.isCreating.set(true);
    this.api.createWorkItem(this.selectedProjectId(), this.toRequest()).subscribe({
      next: (workItem) => {
        this.createdWorkItem.set(workItem);
        this.isCreating.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.createError.set(this.toErrorMessage(error, 'The work item could not be created.'));
        this.isCreating.set(false);
      }
    });
  }

  createAnother(): void {
    const projectId = this.selectedProjectId();
    this.workItemForm.reset({
      projectId,
      title: '',
      description: '',
      type: 'task',
      priority: 'medium',
      assigneeId: '',
      milestoneId: '',
      dueDate: '',
      estimatePoints: ''
    });
    this.selectedLabelIds.set([]);
    this.hasSubmitted.set(false);
    this.createError.set(null);
    this.createdWorkItem.set(null);
  }

  showProjectError(): boolean {
    const control = this.workItemForm.controls.projectId;
    return control.invalid && (control.touched || this.hasSubmitted());
  }

  showTitleError(): boolean {
    const control = this.workItemForm.controls.title;
    return control.invalid && (control.touched || this.hasSubmitted());
  }

  formatToken(value: string): string {
    return value.replaceAll('_', ' ');
  }

  returnCommands(): string[] {
    return this.isProjectScoped()
      ? ['/projects', this.routeProjectId, 'work-items']
      : ['/my-work'];
  }

  returnLabel(): string {
    return this.isProjectScoped() ? 'Back to list' : 'Back to My Work';
  }

  loadProjects(): void {
    this.isProjectListLoading.set(true);
    this.projectListError.set(null);

    this.api.listProjects().subscribe({
      next: (projects) => {
        this.activeProjects.set(projects.filter((project) => project.status === 'active'));
        this.isProjectListLoading.set(false);
      },
      error: () => {
        this.activeProjects.set([]);
        this.projectListError.set('Projects could not be loaded from the API.');
        this.isProjectListLoading.set(false);
      }
    });
  }

  loadProjectLabels(): void {
    const projectId = this.selectedProjectId();

    this.labelLoadError.set(null);

    if (projectId === '') {
      this.availableLabels.set([]);
      return;
    }

    this.api.listProjectLabels(projectId).subscribe({
      next: (labels) => {
        this.availableLabels.set(labels.filter((label) => !label.isArchived));
      },
      error: () => {
        this.labelLoadError.set('Project labels could not be loaded from the API.');
      }
    });
  }

  loadProjectMilestones(): void {
    const projectId = this.selectedProjectId();

    this.milestoneLoadError.set(null);

    if (projectId === '') {
      this.availableMilestones.set([]);
      return;
    }

    this.api.listProjectMilestones(projectId).subscribe({
      next: (milestones) => {
        this.availableMilestones.set(milestones.filter((milestone) => !milestone.isArchived));
      },
      error: () => {
        this.milestoneLoadError.set('Project milestones could not be loaded from the API.');
      }
    });
  }

  retryProjectLoad(): void {
    const projectId = this.selectedProjectId();

    if (projectId !== '') {
      this.loadProjectContext(projectId);
    }
  }

  toggleLabel(labelId: string, event: Event): void {
    if (this.isArchivedProject() || !this.canCreateWorkItems()) {
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

  private watchProjectSelection(): void {
    this.subscriptions.add(
      this.workItemForm.controls.projectId.valueChanges
        .pipe(distinctUntilChanged())
        .subscribe((projectId) => {
          if (this.isProjectScoped()) {
            return;
          }

          this.selectedProjectId.set(projectId);
          this.selectedLabelIds.set([]);
          this.workItemForm.controls.milestoneId.setValue('', { emitEvent: false });
          this.createdWorkItem.set(null);

          if (projectId === '') {
            this.project.set(null);
            this.availableLabels.set([]);
            this.availableMilestones.set([]);
            this.syncReadOnlyState();
            return;
          }

          this.loadProjectContext(projectId);
        })
    );
  }

  private loadProjectContext(projectId: string): void {
    this.projectLoadError.set(null);

    this.api.getProject(projectId).subscribe({
      next: (project) => {
        this.project.set(project);
        this.syncReadOnlyState();
      },
      error: () => {
        this.project.set(null);
        this.projectLoadError.set('Project could not be loaded from the API.');
        this.syncReadOnlyState();
      }
    });

    this.loadProjectLabels();
    this.loadProjectMilestones();
  }

  private loadCapabilities(): void {
    this.api.getWorkspaceCapabilities().subscribe({
      next: (capabilities) => {
        this.capabilities.set(capabilities);
        this.syncReadOnlyState();
      },
      error: () => {
        this.capabilities.set(null);
        this.syncReadOnlyState();
      }
    });
  }

  private syncReadOnlyState(): void {
    if (this.isArchivedProject() || !this.canCreateWorkItems()) {
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

  private toErrorMessage(error: HttpErrorResponse, fallback: string): string {
    const message = (error.error as { error?: { message?: unknown } } | null)?.error?.message;

    return typeof message === 'string' ? message : fallback;
  }
}
