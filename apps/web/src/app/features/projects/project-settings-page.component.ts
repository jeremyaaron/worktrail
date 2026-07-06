import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import type { ActivityEventDto, LabelDto, ProjectDto } from '@worktrail/contracts';

import { CurrentUserService } from '../../core/current-user.service';
import { WorktrailApiService } from '../../core/worktrail-api.service';
import { ErrorPanelComponent } from '../../shared/ui/error-panel.component';
import { LoadingIndicatorComponent } from '../../shared/ui/loading-indicator.component';

const projectActivityEventLabels: Partial<Record<ActivityEventDto['eventType'], string>> = {
  'saved_view.created': 'Shared project view created',
  'saved_view.name_changed': 'Shared project view renamed',
  'saved_view.query_changed': 'Shared project view filters updated',
  'saved_view.updated': 'Shared project view updated',
  'saved_view.deleted': 'Shared project view deleted'
};

@Component({
  selector: 'app-project-settings-page',
  imports: [ErrorPanelComponent, LoadingIndicatorComponent, ReactiveFormsModule, RouterLink],
  template: `
    <section class="page-header">
      <div>
        <p class="eyebrow">Project settings</p>
        <h1>{{ project()?.name ?? 'Project settings' }}</h1>
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
        <a [routerLink]="['/projects', projectId(), 'planning']">Planning</a>
      </nav>
    </section>

    @if (isLoading()) {
      <app-loading-indicator label="Loading project settings" />
    } @else if (loadError()) {
      <app-error-panel [message]="loadError() ?? ''" (retry)="loadProject()" />
    } @else if (project(); as project) {
      @if (project.status === 'archived') {
        <section class="notice" aria-label="Archived project">
          <strong>Archived project</strong>
          <p>Archived projects are read-only.</p>
        </section>
      } @else if (!canManageProject()) {
        <section class="notice" aria-label="Read-only settings">
          <strong>Read-only settings</strong>
          <p>Only owners and maintainers can update project settings.</p>
        </section>
      }

      <section class="settings-grid">
        <section class="panel" aria-labelledby="metadata-heading">
          <div>
            <h2 id="metadata-heading">Metadata</h2>
            <p>Project keys are short identifiers used in work item references.</p>
          </div>

          <form [formGroup]="settingsForm" (ngSubmit)="saveSettings()" novalidate>
            <label for="project-key">Key</label>
            <input
              id="project-key"
              type="text"
              formControlName="key"
              autocomplete="off"
              maxlength="8"
              [readonly]="!canManageProject()"
              [attr.aria-invalid]="showKeyError()"
              aria-describedby="project-key-help project-key-error"
            />
            <p id="project-key-help" class="field-help">Use 2-8 letters or numbers.</p>
            @if (showKeyError()) {
              <p id="project-key-error" class="field-error">Project key must be 2-8 letters or numbers.</p>
            }

            <label for="project-name">Name</label>
            <input
              id="project-name"
              type="text"
              formControlName="name"
              autocomplete="off"
              [readonly]="!canManageProject()"
              [attr.aria-invalid]="showNameError()"
              aria-describedby="project-name-error"
            />
            @if (showNameError()) {
              <p id="project-name-error" class="field-error">Project name is required.</p>
            }

            <label for="project-description">Description</label>
            <textarea
              id="project-description"
              rows="5"
              formControlName="description"
              [readonly]="!canManageProject()"
            ></textarea>

            @if (saveError()) {
              <app-error-panel
                title="Settings not saved"
                [message]="saveError() ?? ''"
                (retry)="saveSettings()"
              />
            }

            @if (saveSuccess()) {
              <p class="success-message">Project settings saved.</p>
            }

            <button type="submit" [disabled]="!canManageProject() || isSaving()">
              {{ isSaving() ? 'Saving...' : 'Save settings' }}
            </button>
          </form>
        </section>

        <section class="panel" aria-labelledby="lifecycle-heading">
          <div>
            <h2 id="lifecycle-heading">Lifecycle</h2>
            <p>Archive projects when work should be retained but no longer actively changed.</p>
          </div>

          @if (commandError()) {
            <app-error-panel
              title="Project status not changed"
              [message]="commandError() ?? ''"
              (retry)="project.status === 'archived' ? reactivateProject() : archiveProject()"
            />
          }

          @if (!canManageProjectLifecycle()) {
            <p class="permission-note">Only owners and maintainers can archive and reactivate projects.</p>
          }

          @if (project.status === 'archived') {
            <button
              type="button"
              [disabled]="!canManageProjectLifecycle() || isCommandRunning()"
              (click)="reactivateProject()"
            >
              {{ isCommandRunning() ? 'Reactivating...' : 'Reactivate project' }}
            </button>
          } @else {
            <button
              type="button"
              class="danger-button"
              [disabled]="!canManageProjectLifecycle() || isCommandRunning()"
              (click)="archiveProject()"
            >
              {{ isCommandRunning() ? 'Archiving...' : 'Archive project' }}
            </button>
          }
        </section>

        <section class="panel label-panel" aria-labelledby="labels-heading">
          <div>
            <h2 id="labels-heading">Labels</h2>
            <p>Create and maintain the project taxonomy used by work items.</p>
          </div>

          @if (!canManageLabels()) {
            <p class="permission-note">Only owners and maintainers can manage labels.</p>
          }

          <form class="label-create-form" [formGroup]="labelForm" (ngSubmit)="createLabel()" novalidate>
            <label for="label-name">Name</label>
            <input
              id="label-name"
              type="text"
              formControlName="name"
              autocomplete="off"
              [readonly]="!canManageLabels()"
              [attr.aria-invalid]="showLabelNameError()"
              aria-describedby="label-name-error"
            />
            @if (showLabelNameError()) {
              <p id="label-name-error" class="field-error">Label name is required.</p>
            }

            <label for="label-color">Color</label>
            <input id="label-color" type="color" formControlName="color" />

            <button type="submit" [disabled]="!canManageLabels() || isLabelMutating()">
              {{ isLabelMutating() ? 'Saving...' : 'Create label' }}
            </button>
          </form>

          @if (labelMutationError()) {
            <app-error-panel
              title="Label change failed"
              [message]="labelMutationError() ?? ''"
              (retry)="loadLabels()"
            />
          }

          @if (labelSuccess()) {
            <p class="success-message">{{ labelSuccess() }}</p>
          }

          @if (isLoadingLabels()) {
            <app-loading-indicator label="Loading labels" />
          } @else if (labelLoadError()) {
            <app-error-panel [message]="labelLoadError() ?? ''" (retry)="loadLabels()" />
          } @else if (labels().length === 0) {
            <section class="empty-labels">
              <h3>No labels yet</h3>
              <p>Create the first label for this project.</p>
            </section>
          } @else {
            <div class="label-list" aria-label="Project labels">
              @for (label of labels(); track label.id) {
                <article class="label-row" [class.label-row--archived]="label.isArchived">
                  <span class="label-swatch" [style.background]="label.color ?? '#e2e8f0'"></span>
                  <input
                    #labelName
                    type="text"
                    [value]="label.name"
                    [readonly]="!canManageLabels()"
                    [disabled]="isLabelMutating()"
                  />
                  <input
                    #labelColor
                    type="color"
                    [value]="label.color ?? '#64748b'"
                    [disabled]="!canManageLabels() || isLabelMutating()"
                    aria-label="Label color"
                  />
                  <span class="label-state">{{ label.isArchived ? 'Archived' : 'Active' }}</span>

                  <div class="label-actions">
                    <button
                      type="button"
                      [disabled]="!canManageLabels() || isLabelMutating()"
                      (click)="updateLabel(label, labelName.value, labelColor.value)"
                    >
                      Save
                    </button>

                    @if (label.isArchived) {
                      <button
                        type="button"
                        [disabled]="!canManageLabels() || isLabelMutating()"
                        (click)="reactivateLabel(label)"
                      >
                        Reactivate
                      </button>
                    } @else {
                      <button
                        type="button"
                        class="danger-button"
                        [disabled]="!canManageLabels() || isLabelMutating()"
                        (click)="archiveLabel(label)"
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

        <section class="panel activity-panel" aria-labelledby="activity-heading">
          <div>
            <h2 id="activity-heading">Project activity</h2>
            <p>Project, label, milestone, and shared saved-view changes appear here.</p>
          </div>

          @if (activityLoadError()) {
            <app-error-panel [message]="activityLoadError() ?? ''" (retry)="loadActivity()" />
          } @else if (activity().length === 0) {
            <section class="empty-labels">
              <h3>No project activity yet</h3>
              <p>Settings, labels, milestones, and shared saved views will appear here.</p>
            </section>
          } @else {
            <ol class="activity-list">
              @for (event of activity(); track event.id) {
                <li>
                  <strong>{{ event.summary }}</strong>
                  <span>{{ event.actor.name }} · {{ formatEventType(event) }} · {{ formatDateTime(event.createdAt) }}</span>
                </li>
              }
            </ol>
          }
        </section>
      </section>
    }
  `,
  styles: `
    .page-header {
      display: flex;
      justify-content: space-between;
      gap: 20px;
      align-items: flex-start;
      margin-bottom: 22px;
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
    p {
      margin: 0;
    }

    h1 {
      color: #111827;
      font-size: 1.75rem;
      line-height: 1.2;
    }

    h2 {
      color: #111827;
      font-size: 1rem;
      line-height: 1.35;
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
      font-weight: 800;
      text-decoration: none;
    }

    nav a:hover,
    button:hover:not(:disabled) {
      border-color: #94a3b8;
      background: #f8fafc;
    }

    .key-pill,
    .status-pill {
      display: inline-flex;
      align-items: center;
      min-height: 24px;
      margin-top: 10px;
      border-radius: 999px;
      padding: 3px 9px;
      font-size: 0.75rem;
      font-weight: 900;
    }

    .key-pill {
      border: 1px solid #bfdbfe;
      background: #eff6ff;
      color: #1e3a8a;
    }

    .status-pill {
      margin-left: 6px;
      border: 1px solid #bbf7d0;
      background: #f0fdf4;
      color: #166534;
      text-transform: capitalize;
    }

    .status-pill--archived {
      border-color: #fed7aa;
      background: #fff7ed;
      color: #9a3412;
    }

    .notice {
      display: grid;
      gap: 4px;
      margin-bottom: 18px;
      border: 1px solid #fed7aa;
      border-radius: 8px;
      padding: 14px;
      background: #fff7ed;
      color: #9a3412;
    }

    .notice p,
    .panel > div p,
    .field-help,
    .permission-note {
      color: #64748b;
      font-size: 0.875rem;
      line-height: 1.5;
    }

    .settings-grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(260px, 340px);
      gap: 18px;
      align-items: start;
    }

    .label-panel,
    .activity-panel {
      grid-column: 1 / -1;
    }

    .panel {
      display: grid;
      gap: 16px;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 18px;
      background: #ffffff;
    }

    form {
      display: grid;
      gap: 10px;
    }

    .label-create-form {
      grid-template-columns: minmax(180px, 1fr) 120px auto;
      align-items: end;
    }

    label {
      color: #334155;
      font-size: 0.8125rem;
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
      font-size: 0.875rem;
    }

    input:not([type='color']) {
      text-transform: uppercase;
    }

    .label-create-form input:not([type='color']),
    .label-row input:not([type='color']) {
      text-transform: none;
    }

    input[type='color'] {
      min-height: 38px;
      padding: 4px;
    }

    input:focus,
    textarea:focus {
      border-color: #1d4ed8;
      outline: 2px solid #bfdbfe;
      outline-offset: 0;
    }

    .field-error {
      color: #b91c1c;
      font-size: 0.8125rem;
    }

    .success-message {
      color: #166534;
      font-size: 0.875rem;
      font-weight: 800;
    }

    form > button {
      justify-self: start;
      border-color: #1f4f99;
      background: #1f4f99;
      color: #ffffff;
    }

    .label-create-form > button {
      justify-self: stretch;
    }

    .empty-labels {
      border: 1px dashed #cbd5e1;
      border-radius: 8px;
      padding: 18px;
      background: #f8fafc;
    }

    .empty-labels h3 {
      margin: 0 0 6px;
      color: #111827;
      font-size: 1rem;
    }

    .empty-labels p {
      color: #64748b;
      font-size: 0.875rem;
    }

    .label-list {
      display: grid;
      gap: 10px;
    }

    .activity-list {
      display: grid;
      gap: 10px;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .activity-list li {
      display: grid;
      gap: 5px;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 12px;
      background: #ffffff;
    }

    .activity-list strong {
      color: #334155;
      font-size: 0.875rem;
      line-height: 1.5;
    }

    .activity-list span {
      color: #64748b;
      font-size: 0.75rem;
      font-weight: 700;
    }

    .label-row {
      display: grid;
      grid-template-columns: 18px minmax(160px, 1fr) 92px auto auto;
      gap: 10px;
      align-items: center;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 10px;
      background: #ffffff;
    }

    .label-row--archived {
      background: #f8fafc;
      opacity: 0.78;
    }

    .label-swatch {
      width: 14px;
      height: 14px;
      border-radius: 4px;
    }

    .label-state {
      color: #64748b;
      font-size: 0.75rem;
      font-weight: 900;
      text-transform: uppercase;
    }

    .label-actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 8px;
    }

    .danger-button {
      border-color: #dc2626;
      color: #991b1b;
    }

    button {
      cursor: pointer;
    }

    button:disabled {
      cursor: not-allowed;
      opacity: 0.64;
    }

    @media (max-width: 820px) {
      .page-header,
      .settings-grid {
        grid-template-columns: 1fr;
      }

      .page-header {
        display: grid;
      }

      nav {
        justify-content: flex-start;
      }

      .label-create-form,
      .label-row {
        grid-template-columns: 1fr;
      }

      .label-actions {
        justify-content: flex-start;
      }
    }
  `
})
export class ProjectSettingsPageComponent implements OnInit {
  private readonly api = inject(WorktrailApiService);
  private readonly currentUser = inject(CurrentUserService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);

  readonly project = signal<ProjectDto | null>(null);
  readonly isLoading = signal(false);
  readonly isSaving = signal(false);
  readonly isCommandRunning = signal(false);
  readonly hasSubmittedSave = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly saveError = signal<string | null>(null);
  readonly commandError = signal<string | null>(null);
  readonly labels = signal<LabelDto[]>([]);
  readonly isLoadingLabels = signal(false);
  readonly isLabelMutating = signal(false);
  readonly hasSubmittedLabel = signal(false);
  readonly labelLoadError = signal<string | null>(null);
  readonly labelMutationError = signal<string | null>(null);
  readonly labelSuccess = signal<string | null>(null);
  readonly saveSuccess = signal(false);
  readonly activity = signal<ActivityEventDto[]>([]);
  readonly activityLoadError = signal<string | null>(null);
  readonly projectId = computed(() => this.route.snapshot.paramMap.get('projectId') ?? '');
  readonly canManageProjectLifecycle = computed(() => {
    const actor = this.currentUser.selectedMember();
    return actor?.role === 'owner' || actor?.role === 'maintainer';
  });
  readonly canManageProject = computed(
    () => this.project()?.status === 'active' && this.canManageProjectLifecycle()
  );
  readonly canManageLabels = this.canManageProject;

  readonly settingsForm = this.formBuilder.nonNullable.group({
    key: ['', [Validators.required, Validators.pattern(/^[A-Za-z0-9]{2,8}$/)]],
    name: ['', [Validators.required]],
    description: ['']
  });

  readonly labelForm = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required]],
    color: ['#2563eb']
  });

  constructor() {
    effect(() => {
      this.canManageProject();
      this.syncReadOnlyState();
    });
  }

  ngOnInit(): void {
    if (this.currentUser.members().length === 0) {
      this.currentUser.loadMembers();
    }

    this.loadProject();
  }

  loadProject(): void {
    this.isLoading.set(true);
    this.loadError.set(null);
    this.api.getProject(this.projectId()).subscribe({
      next: (project) => {
        this.applyProject(project);
        this.loadLabels();
        this.loadActivity();
        this.isLoading.set(false);
      },
      error: () => {
        this.loadError.set('Project settings could not be loaded from the API.');
        this.isLoading.set(false);
      }
    });
  }

  loadLabels(): void {
    this.isLoadingLabels.set(true);
    this.labelLoadError.set(null);
    this.api.listProjectLabels(this.projectId(), { includeArchived: true }).subscribe({
      next: (labels) => {
        this.labels.set(this.sortLabels(labels));
        this.isLoadingLabels.set(false);
      },
      error: () => {
        this.labelLoadError.set('Project labels could not be loaded from the API.');
        this.isLoadingLabels.set(false);
      }
    });
  }

  loadActivity(): void {
    this.activityLoadError.set(null);
    this.api.listProjectActivity(this.projectId()).subscribe({
      next: (activity) => {
        this.activity.set(activity);
      },
      error: () => {
        this.activityLoadError.set('Project activity could not be loaded from the API.');
      }
    });
  }

  saveSettings(): void {
    this.hasSubmittedSave.set(true);
    this.saveError.set(null);
    this.saveSuccess.set(false);

    if (!this.canManageProject()) {
      this.saveError.set(
        this.project()?.status === 'archived'
          ? 'Archived projects are read-only.'
          : 'Only owners and maintainers can update project settings.'
      );
      return;
    }

    if (this.settingsForm.invalid) {
      this.settingsForm.markAllAsTouched();
      return;
    }

    const formValue = this.settingsForm.getRawValue();
    this.isSaving.set(true);
    this.api
      .updateProject(this.projectId(), {
        key: formValue.key.trim().toUpperCase(),
        name: formValue.name.trim(),
        description: formValue.description.trim()
      })
      .subscribe({
        next: (project) => {
          this.applyProject(project);
          this.loadActivity();
          this.isSaving.set(false);
          this.hasSubmittedSave.set(false);
          this.saveSuccess.set(true);
        },
        error: (error: unknown) => {
          this.saveError.set(this.toErrorMessage(error, 'Project settings could not be saved.'));
          this.isSaving.set(false);
        }
      });
  }

  archiveProject(): void {
    this.commandError.set(null);

    if (!this.canManageProjectLifecycle()) {
      this.commandError.set('Only owners and maintainers can archive projects.');
      return;
    }

    this.isCommandRunning.set(true);
    this.api.archiveProject(this.projectId()).subscribe({
      next: (project) => {
        this.applyProject(project);
        this.loadActivity();
        this.isCommandRunning.set(false);
      },
      error: (error: unknown) => {
        this.commandError.set(this.toErrorMessage(error, 'Project could not be archived.'));
        this.isCommandRunning.set(false);
      }
    });
  }

  reactivateProject(): void {
    this.commandError.set(null);

    if (!this.canManageProjectLifecycle()) {
      this.commandError.set('Only owners and maintainers can reactivate projects.');
      return;
    }

    this.isCommandRunning.set(true);
    this.api.reactivateProject(this.projectId()).subscribe({
      next: (project) => {
        this.applyProject(project);
        this.loadActivity();
        this.isCommandRunning.set(false);
      },
      error: (error: unknown) => {
        this.commandError.set(this.toErrorMessage(error, 'Project could not be reactivated.'));
        this.isCommandRunning.set(false);
      }
    });
  }

  createLabel(): void {
    this.hasSubmittedLabel.set(true);
    this.labelMutationError.set(null);
    this.labelSuccess.set(null);

    if (!this.canManageLabels()) {
      this.labelMutationError.set(
        this.project()?.status === 'archived'
          ? 'Archived projects are read-only.'
          : 'Only owners and maintainers can manage labels.'
      );
      return;
    }

    if (this.labelForm.invalid) {
      this.labelForm.markAllAsTouched();
      return;
    }

    const formValue = this.labelForm.getRawValue();
    this.isLabelMutating.set(true);
    this.api
      .createLabel(this.projectId(), {
        name: formValue.name.trim(),
        color: formValue.color
      })
      .subscribe({
        next: (label) => {
          this.upsertLabel(label);
          this.loadActivity();
          this.labelForm.reset({ name: '', color: '#2563eb' });
          this.hasSubmittedLabel.set(false);
          this.isLabelMutating.set(false);
          this.labelSuccess.set('Label created.');
        },
        error: (error: unknown) => {
          this.labelMutationError.set(this.toErrorMessage(error, 'Label could not be created.'));
          this.isLabelMutating.set(false);
        }
      });
  }

  updateLabel(label: LabelDto, name: string, color: string): void {
    this.labelMutationError.set(null);
    this.labelSuccess.set(null);

    if (!this.canManageLabels()) {
      this.labelMutationError.set(
        this.project()?.status === 'archived'
          ? 'Archived projects are read-only.'
          : 'Only owners and maintainers can manage labels.'
      );
      return;
    }

    const nextName = name.trim();

    if (nextName === '') {
      this.labelMutationError.set('Label name is required.');
      return;
    }

    this.isLabelMutating.set(true);
    this.api
      .updateLabel(label.id, {
        name: nextName,
        color
      })
      .subscribe({
        next: (updated) => {
          this.upsertLabel(updated);
          this.loadActivity();
          this.isLabelMutating.set(false);
          this.labelSuccess.set('Label saved.');
        },
        error: (error: unknown) => {
          this.labelMutationError.set(this.toErrorMessage(error, 'Label could not be saved.'));
          this.isLabelMutating.set(false);
        }
      });
  }

  archiveLabel(label: LabelDto): void {
    this.labelMutationError.set(null);
    this.labelSuccess.set(null);

    if (!this.canManageLabels()) {
      this.labelMutationError.set(
        this.project()?.status === 'archived'
          ? 'Archived projects are read-only.'
          : 'Only owners and maintainers can manage labels.'
      );
      return;
    }

    this.isLabelMutating.set(true);
    this.api.archiveLabel(label.id).subscribe({
      next: (updated) => {
        this.upsertLabel(updated);
        this.loadActivity();
        this.isLabelMutating.set(false);
        this.labelSuccess.set('Label archived.');
      },
      error: (error: unknown) => {
        this.labelMutationError.set(this.toErrorMessage(error, 'Label could not be archived.'));
        this.isLabelMutating.set(false);
      }
    });
  }

  reactivateLabel(label: LabelDto): void {
    this.labelMutationError.set(null);
    this.labelSuccess.set(null);

    if (!this.canManageLabels()) {
      this.labelMutationError.set(
        this.project()?.status === 'archived'
          ? 'Archived projects are read-only.'
          : 'Only owners and maintainers can manage labels.'
      );
      return;
    }

    this.isLabelMutating.set(true);
    this.api.reactivateLabel(label.id).subscribe({
      next: (updated) => {
        this.upsertLabel(updated);
        this.loadActivity();
        this.isLabelMutating.set(false);
        this.labelSuccess.set('Label reactivated.');
      },
      error: (error: unknown) => {
        this.labelMutationError.set(this.toErrorMessage(error, 'Label could not be reactivated.'));
        this.isLabelMutating.set(false);
      }
    });
  }

  showKeyError(): boolean {
    const control = this.settingsForm.controls.key;
    return control.invalid && (control.touched || this.hasSubmittedSave());
  }

  showNameError(): boolean {
    const control = this.settingsForm.controls.name;
    return control.invalid && (control.touched || this.hasSubmittedSave());
  }

  showLabelNameError(): boolean {
    const control = this.labelForm.controls.name;
    return control.invalid && (control.touched || this.hasSubmittedLabel());
  }

  formatEventType(event: ActivityEventDto): string {
    return projectActivityEventLabels[event.eventType] ?? this.formatToken(event.eventType.replace('.', ' '));
  }

  formatDateTime(value: string): string {
    return new Intl.DateTimeFormat('en', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    }).format(new Date(value));
  }

  private formatToken(value: string): string {
    return value.replaceAll('_', ' ');
  }

  private applyProject(project: ProjectDto): void {
    this.project.set(project);
    this.settingsForm.setValue({
      key: project.key,
      name: project.name,
      description: project.description
    });
    this.syncReadOnlyState();
  }

  private upsertLabel(label: LabelDto): void {
    const labelsById = new Map(this.labels().map((item) => [item.id, item]));
    labelsById.set(label.id, label);
    this.labels.set(this.sortLabels([...labelsById.values()]));
  }

  private sortLabels(labels: LabelDto[]): LabelDto[] {
    return [...labels].sort((left, right) => {
      if (left.isArchived !== right.isArchived) {
        return left.isArchived ? 1 : -1;
      }

      return left.name.localeCompare(right.name);
    });
  }

  private syncReadOnlyState(): void {
    const options = { emitEvent: false };

    if (this.canManageProject()) {
      this.settingsForm.enable(options);
      this.labelForm.enable(options);
    } else {
      this.settingsForm.disable(options);
      this.labelForm.disable(options);
    }
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
