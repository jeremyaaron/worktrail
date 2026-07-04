import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import type { ProjectDto } from '@worktrail/contracts';

import { WorktrailApiService } from '../../core/worktrail-api.service';
import { ErrorPanelComponent } from '../../shared/ui/error-panel.component';
import { LoadingIndicatorComponent } from '../../shared/ui/loading-indicator.component';

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
          <p>This project remains readable. Reactivate it before making workflow changes.</p>
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
              [attr.aria-invalid]="showNameError()"
              aria-describedby="project-name-error"
            />
            @if (showNameError()) {
              <p id="project-name-error" class="field-error">Project name is required.</p>
            }

            <label for="project-description">Description</label>
            <textarea id="project-description" rows="5" formControlName="description"></textarea>

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

            <button type="submit" [disabled]="isSaving()">
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

          @if (project.status === 'archived') {
            <button type="button" [disabled]="isCommandRunning()" (click)="reactivateProject()">
              {{ isCommandRunning() ? 'Reactivating...' : 'Reactivate project' }}
            </button>
          } @else {
            <button
              type="button"
              class="danger-button"
              [disabled]="isCommandRunning()"
              (click)="archiveProject()"
            >
              {{ isCommandRunning() ? 'Archiving...' : 'Archive project' }}
            </button>
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
    .field-help {
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

    input {
      text-transform: uppercase;
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
    }
  `
})
export class ProjectSettingsPageComponent implements OnInit {
  private readonly api = inject(WorktrailApiService);
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
  readonly saveSuccess = signal(false);
  readonly projectId = computed(() => this.route.snapshot.paramMap.get('projectId') ?? '');

  readonly settingsForm = this.formBuilder.nonNullable.group({
    key: ['', [Validators.required, Validators.pattern(/^[A-Za-z0-9]{2,8}$/)]],
    name: ['', [Validators.required]],
    description: ['']
  });

  ngOnInit(): void {
    this.loadProject();
  }

  loadProject(): void {
    this.isLoading.set(true);
    this.loadError.set(null);
    this.api.getProject(this.projectId()).subscribe({
      next: (project) => {
        this.applyProject(project);
        this.isLoading.set(false);
      },
      error: () => {
        this.loadError.set('Project settings could not be loaded from the API.');
        this.isLoading.set(false);
      }
    });
  }

  saveSettings(): void {
    this.hasSubmittedSave.set(true);
    this.saveError.set(null);
    this.saveSuccess.set(false);

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
          this.isSaving.set(false);
          this.hasSubmittedSave.set(false);
          this.saveSuccess.set(true);
        },
        error: () => {
          this.saveError.set('Project settings could not be saved.');
          this.isSaving.set(false);
        }
      });
  }

  archiveProject(): void {
    this.commandError.set(null);
    this.isCommandRunning.set(true);
    this.api.archiveProject(this.projectId()).subscribe({
      next: (project) => {
        this.applyProject(project);
        this.isCommandRunning.set(false);
      },
      error: () => {
        this.commandError.set('Project could not be archived.');
        this.isCommandRunning.set(false);
      }
    });
  }

  reactivateProject(): void {
    this.commandError.set(null);
    this.isCommandRunning.set(true);
    this.api.reactivateProject(this.projectId()).subscribe({
      next: (project) => {
        this.applyProject(project);
        this.isCommandRunning.set(false);
      },
      error: () => {
        this.commandError.set('Project could not be reactivated.');
        this.isCommandRunning.set(false);
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

  private applyProject(project: ProjectDto): void {
    this.project.set(project);
    this.settingsForm.setValue({
      key: project.key,
      name: project.name,
      description: project.description
    });
  }
}
