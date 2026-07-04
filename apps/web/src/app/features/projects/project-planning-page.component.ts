import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import type { MilestoneDto, MilestoneStatus, ProjectDto } from '@worktrail/contracts';

import { CurrentUserService } from '../../core/current-user.service';
import { WorktrailApiService } from '../../core/worktrail-api.service';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { ErrorPanelComponent } from '../../shared/ui/error-panel.component';
import { LoadingIndicatorComponent } from '../../shared/ui/loading-indicator.component';

const milestoneStatuses: MilestoneStatus[] = ['planned', 'active', 'completed', 'canceled'];
const statusOrder = new Map<MilestoneStatus, number>(
  milestoneStatuses.map((status, index) => [status, index])
);

@Component({
  selector: 'app-project-planning-page',
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
        <p class="eyebrow">Planning</p>
        <h1>{{ project()?.name ?? 'Project planning' }}</h1>
        @if (project(); as project) {
          <p>
            <span class="key-pill">{{ project.key }}</span>
            <span [class.status-pill--archived]="project.status === 'archived'" class="status-pill">
              {{ project.status }}
            </span>
          </p>
        }
      </div>

      <nav aria-label="Project navigation">
        <a [routerLink]="['/projects', projectId()]">Overview</a>
        <a [routerLink]="['/projects', projectId(), 'work-items']">Work items</a>
        <a [routerLink]="['/projects', projectId(), 'board']">Board</a>
        <a [routerLink]="['/projects', projectId(), 'settings']">Settings</a>
      </nav>
    </section>

    @if (isLoadingProject()) {
      <app-loading-indicator label="Loading planning" />
    } @else if (projectLoadError()) {
      <app-error-panel [message]="projectLoadError() ?? ''" (retry)="loadProject()" />
    } @else if (project(); as project) {
      @if (project.status === 'archived') {
        <section class="notice" aria-label="Archived project">
          <strong>Archived project</strong>
          <p>Milestones remain readable. Reactivate the project before changing planning data.</p>
        </section>
      } @else if (!canManageMilestones()) {
        <section class="notice" aria-label="Read-only planning">
          <strong>Read-only planning</strong>
          <p>Owners and maintainers can change milestones. Contributors can review them here.</p>
        </section>
      }

      <section class="planning-grid" aria-label="Planning sections">
        <section class="panel milestone-panel" aria-labelledby="milestones-heading">
          <div class="panel-heading">
            <div>
              <h2 id="milestones-heading">Milestones</h2>
              <p>Plan named delivery targets for this project.</p>
            </div>
            <span>{{ milestones().length }} total</span>
          </div>

          @if (canManageMilestones()) {
            <form class="milestone-form" [formGroup]="milestoneForm" (ngSubmit)="createMilestone()" novalidate>
              <label for="milestone-name">Name</label>
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

              @if (createError()) {
                <p class="field-error">{{ createError() }}</p>
              }

              @if (successMessage()) {
                <p class="success-message">{{ successMessage() }}</p>
              }

              <button type="submit" [disabled]="isCreatingMilestone()">
                {{ isCreatingMilestone() ? 'Creating...' : 'Create milestone' }}
              </button>
            </form>
          }

          @if (milestoneMutationError()) {
            <app-error-panel
              title="Milestone change failed"
              [message]="milestoneMutationError() ?? ''"
              (retry)="loadMilestones()"
            />
          }

          @if (isLoadingMilestones()) {
            <app-loading-indicator label="Loading milestones" />
          } @else if (milestoneLoadError()) {
            <app-error-panel [message]="milestoneLoadError() ?? ''" (retry)="loadMilestones()" />
          } @else if (milestones().length === 0) {
            <app-empty-state
              title="No milestones yet"
              message="Create a milestone to start grouping delivery targets."
            />
          } @else {
            <div class="milestone-list" aria-label="Project milestones">
              @for (milestone of milestones(); track milestone.id) {
                <article
                  class="milestone-row"
                  [class.milestone-row--archived]="milestone.isArchived"
                >
                  <div class="milestone-row__title">
                    <h3>{{ milestone.name }}</h3>
                    <p>{{ milestone.description || 'No description provided.' }}</p>
                  </div>

                  <div class="milestone-row__fields">
                    <label>
                      <span>Name</span>
                      <input
                        #milestoneName
                        type="text"
                        [value]="milestone.name"
                        [disabled]="!canManageMilestones() || isMutating(milestone)"
                      />
                    </label>

                    <label>
                      <span>Description</span>
                      <textarea
                        #milestoneDescription
                        rows="2"
                        [disabled]="!canManageMilestones() || isMutating(milestone)"
                      >{{ milestone.description }}</textarea>
                    </label>

                    <label>
                      <span>Status</span>
                      <select
                        #milestoneStatus
                        [value]="milestone.status"
                        [disabled]="!canManageMilestones() || isMutating(milestone)"
                      >
                        @for (status of milestoneStatuses; track status) {
                          <option [value]="status">{{ formatToken(status) }}</option>
                        }
                      </select>
                    </label>

                    <label>
                      <span>Target date</span>
                      <input
                        #milestoneTargetDate
                        type="date"
                        [value]="milestone.targetDate ?? ''"
                        [disabled]="!canManageMilestones() || isMutating(milestone)"
                      />
                    </label>
                  </div>

                  <div class="milestone-row__meta">
                    <span class="status-pill" [class.status-pill--archived]="milestone.isArchived">
                      {{ milestone.isArchived ? 'archived' : formatToken(milestone.status) }}
                    </span>
                    <span>{{ milestone.targetDate === null ? 'No target date' : formatDate(milestone.targetDate) }}</span>
                    <span>Updated {{ formatDateTime(milestone.updatedAt) }}</span>
                  </div>

                  <div class="milestone-actions">
                    <button
                      type="button"
                      [disabled]="!canManageMilestones() || isMutating(milestone)"
                      (click)="updateMilestone(
                        milestone,
                        milestoneName.value,
                        milestoneDescription.value,
                        milestoneStatus.value,
                        milestoneTargetDate.value
                      )"
                    >
                      {{ isMutating(milestone) ? 'Saving...' : 'Save' }}
                    </button>

                    @if (milestone.isArchived) {
                      <button
                        type="button"
                        [disabled]="!canManageMilestones() || isMutating(milestone)"
                        (click)="reactivateMilestone(milestone)"
                      >
                        Reactivate
                      </button>
                    } @else {
                      <button
                        type="button"
                        class="danger-button"
                        [disabled]="!canManageMilestones() || isMutating(milestone)"
                        (click)="archiveMilestone(milestone)"
                      >
                        Archive
                      </button>
                    }
                  </div>
                </article>
              }
            </div>
          }
        </section>

        <section class="panel summary-panel" aria-labelledby="planning-summary-heading">
          <div class="panel-heading">
            <div>
              <h2 id="planning-summary-heading">Planning summary</h2>
              <p>Risk lists and progress signals will be added in Phase 10.</p>
            </div>
          </div>
          <app-empty-state
            title="Dashboard pending"
            message="Milestone data is ready; the planning summary UI lands in a later phase."
          />
        </section>
      </section>
    }
  `,
  styles: `
    .page-header {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 20px;
      align-items: start;
      margin-bottom: 24px;
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
    h2,
    h3 {
      margin: 0;
      color: #111827;
      line-height: 1.25;
    }

    h1 {
      margin-bottom: 8px;
      font-size: 1.75rem;
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

    nav {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 8px;
    }

    nav a,
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

    nav a:hover,
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

    .notice {
      margin-bottom: 20px;
      border: 1px solid #fed7aa;
      border-radius: 8px;
      padding: 14px 16px;
      background: #fff7ed;
    }

    .notice strong {
      display: block;
      margin-bottom: 4px;
      color: #9a3412;
      font-size: 0.875rem;
    }

    .key-pill,
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

    .planning-grid {
      display: grid;
      grid-template-columns: minmax(0, 2fr) minmax(280px, 1fr);
      gap: 16px;
      align-items: start;
    }

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

    .milestone-row__meta {
      color: #64748b;
      font-size: 0.8125rem;
      font-weight: 700;
    }

    .summary-panel {
      min-height: 220px;
    }

    @media (max-width: 900px) {
      .page-header,
      .planning-grid,
      .milestone-form__grid,
      .milestone-row__fields {
        grid-template-columns: 1fr;
      }

      nav {
        justify-content: flex-start;
      }
    }
  `
})
export class ProjectPlanningPageComponent implements OnInit {
  private readonly api = inject(WorktrailApiService);
  private readonly currentUser = inject(CurrentUserService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);

  readonly milestoneStatuses = milestoneStatuses;
  readonly project = signal<ProjectDto | null>(null);
  readonly milestones = signal<MilestoneDto[]>([]);
  readonly isLoadingProject = signal(false);
  readonly isLoadingMilestones = signal(false);
  readonly isCreatingMilestone = signal(false);
  readonly mutatingMilestoneId = signal<string | null>(null);
  readonly hasSubmittedCreate = signal(false);
  readonly projectLoadError = signal<string | null>(null);
  readonly milestoneLoadError = signal<string | null>(null);
  readonly createError = signal<string | null>(null);
  readonly milestoneMutationError = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly projectId = computed(() => this.route.snapshot.paramMap.get('projectId') ?? '');
  readonly isArchivedProject = computed(() => this.project()?.status === 'archived');
  readonly canManageMilestones = computed(() => {
    const member = this.currentUser.selectedMember();
    return (
      this.project()?.status === 'active' &&
      (member?.role === 'owner' || member?.role === 'maintainer')
    );
  });

  readonly milestoneForm = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required]],
    description: [''],
    status: ['planned' as MilestoneStatus],
    targetDate: ['']
  });

  ngOnInit(): void {
    this.loadProject();
  }

  loadProject(): void {
    this.isLoadingProject.set(true);
    this.projectLoadError.set(null);
    this.api.getProject(this.projectId()).subscribe({
      next: (project) => {
        this.project.set(project);
        this.isLoadingProject.set(false);
        this.loadMilestones();
      },
      error: () => {
        this.projectLoadError.set('Project planning could not be loaded from the API.');
        this.isLoadingProject.set(false);
      }
    });
  }

  loadMilestones(): void {
    this.isLoadingMilestones.set(true);
    this.milestoneLoadError.set(null);
    this.api.listProjectMilestones(this.projectId(), { includeArchived: true }).subscribe({
      next: (milestones) => {
        this.milestones.set(this.sortMilestones(milestones));
        this.isLoadingMilestones.set(false);
      },
      error: () => {
        this.milestoneLoadError.set('Project milestones could not be loaded from the API.');
        this.isLoadingMilestones.set(false);
      }
    });
  }

  createMilestone(): void {
    this.hasSubmittedCreate.set(true);
    this.createError.set(null);
    this.milestoneMutationError.set(null);
    this.successMessage.set(null);

    if (!this.canManageMilestones()) {
      this.createError.set('Milestones are read-only for the current project or actor.');
      return;
    }

    if (this.milestoneForm.invalid) {
      this.milestoneForm.markAllAsTouched();
      return;
    }

    const formValue = this.milestoneForm.getRawValue();
    this.isCreatingMilestone.set(true);
    this.api
      .createMilestone(this.projectId(), {
        name: formValue.name.trim(),
        description: formValue.description.trim(),
        status: formValue.status,
        targetDate: formValue.targetDate === '' ? null : formValue.targetDate
      })
      .subscribe({
        next: (milestone) => {
          this.upsertMilestone(milestone);
          this.milestoneForm.reset({ name: '', description: '', status: 'planned', targetDate: '' });
          this.hasSubmittedCreate.set(false);
          this.isCreatingMilestone.set(false);
          this.successMessage.set('Milestone created.');
        },
        error: (error: unknown) => {
          this.createError.set(this.toErrorMessage(error, 'Milestone could not be created.'));
          this.isCreatingMilestone.set(false);
        }
      });
  }

  updateMilestone(
    milestone: MilestoneDto,
    name: string,
    description: string,
    status: string,
    targetDate: string
  ): void {
    this.createError.set(null);
    this.milestoneMutationError.set(null);
    this.successMessage.set(null);

    if (!this.canManageMilestones()) {
      this.milestoneMutationError.set('Milestones are read-only for the current project or actor.');
      return;
    }

    const nextName = name.trim();

    if (nextName === '') {
      this.milestoneMutationError.set('Milestone name is required.');
      return;
    }

    this.mutatingMilestoneId.set(milestone.id);
    this.api
      .updateMilestone(milestone.id, {
        name: nextName,
        description: description.trim(),
        status: status as MilestoneStatus,
        targetDate: targetDate === '' ? null : targetDate
      })
      .subscribe({
        next: (updated) => {
          this.upsertMilestone(updated);
          this.mutatingMilestoneId.set(null);
          this.successMessage.set('Milestone saved.');
        },
        error: (error: unknown) => {
          this.milestoneMutationError.set(
            this.toErrorMessage(error, 'Milestone could not be saved.')
          );
          this.mutatingMilestoneId.set(null);
        }
      });
  }

  archiveMilestone(milestone: MilestoneDto): void {
    this.runMilestoneCommand(
      milestone,
      'Milestone archived.',
      'Milestone could not be archived.',
      () => this.api.archiveMilestone(milestone.id)
    );
  }

  reactivateMilestone(milestone: MilestoneDto): void {
    this.runMilestoneCommand(
      milestone,
      'Milestone reactivated.',
      'Milestone could not be reactivated.',
      () => this.api.reactivateMilestone(milestone.id)
    );
  }

  isMutating(milestone: MilestoneDto): boolean {
    return this.mutatingMilestoneId() === milestone.id;
  }

  showMilestoneNameError(): boolean {
    const control = this.milestoneForm.controls.name;
    return control.invalid && (control.touched || this.hasSubmittedCreate());
  }

  formatToken(value: string): string {
    return value.replaceAll('_', ' ');
  }

  formatDate(value: string): string {
    const [year, month, day] = value.split('-').map(Number);
    return new Intl.DateTimeFormat('en', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(new Date(year, month - 1, day));
  }

  formatDateTime(value: string): string {
    return new Intl.DateTimeFormat('en', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(new Date(value));
  }

  private runMilestoneCommand(
    milestone: MilestoneDto,
    successMessage: string,
    fallbackError: string,
    command: () => ReturnType<WorktrailApiService['archiveMilestone']>
  ): void {
    this.createError.set(null);
    this.milestoneMutationError.set(null);
    this.successMessage.set(null);

    if (!this.canManageMilestones()) {
      this.milestoneMutationError.set('Milestones are read-only for the current project or actor.');
      return;
    }

    this.mutatingMilestoneId.set(milestone.id);
    command().subscribe({
      next: (updated) => {
        this.upsertMilestone(updated);
        this.mutatingMilestoneId.set(null);
        this.successMessage.set(successMessage);
      },
      error: (error: unknown) => {
        this.milestoneMutationError.set(this.toErrorMessage(error, fallbackError));
        this.mutatingMilestoneId.set(null);
      }
    });
  }

  private upsertMilestone(milestone: MilestoneDto): void {
    const milestonesById = new Map(this.milestones().map((item) => [item.id, item]));
    milestonesById.set(milestone.id, milestone);
    this.milestones.set(this.sortMilestones([...milestonesById.values()]));
  }

  private sortMilestones(milestones: MilestoneDto[]): MilestoneDto[] {
    return [...milestones].sort((left, right) => {
      if (left.isArchived !== right.isArchived) {
        return left.isArchived ? 1 : -1;
      }

      const statusCompare =
        (statusOrder.get(left.status) ?? 0) - (statusOrder.get(right.status) ?? 0);

      if (statusCompare !== 0) {
        return statusCompare;
      }

      const targetCompare = (left.targetDate ?? '9999-12-31').localeCompare(
        right.targetDate ?? '9999-12-31'
      );

      if (targetCompare !== 0) {
        return targetCompare;
      }

      return left.name.localeCompare(right.name);
    });
  }

  private toErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse) {
      const message = (error.error as { error?: { message?: unknown } } | null)?.error?.message;

      if (typeof message === 'string' && message.trim() !== '') {
        return message;
      }
    }

    return fallback;
  }
}
