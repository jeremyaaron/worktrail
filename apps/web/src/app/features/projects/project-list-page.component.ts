import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import type { ProjectDto, ProjectStatus } from '@worktrail/contracts';

import { WorktrailApiService } from '../../core/worktrail-api.service';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { ErrorPanelComponent } from '../../shared/ui/error-panel.component';
import { LoadingIndicatorComponent } from '../../shared/ui/loading-indicator.component';

type ProjectStatusFilter = 'all' | ProjectStatus;

@Component({
  selector: 'app-project-list-page',
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
        <p class="eyebrow">Projects</p>
        <h1>Project workspace</h1>
        <p class="page-copy">Create and open project spaces for the Worktrail MVP workflow.</p>
      </div>
    </section>

    <section class="project-layout">
      <section class="create-panel" aria-labelledby="create-project-heading">
        <h2 id="create-project-heading">Create project</h2>
        <form [formGroup]="createProjectForm" (ngSubmit)="createProject()" novalidate>
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
          <textarea id="project-description" rows="4" formControlName="description"></textarea>

          @if (createError()) {
            <app-error-panel
              title="Project not created"
              [message]="createError() ?? ''"
              (retry)="createProject()"
            />
          }

          <button type="submit" [disabled]="isCreating()">
            {{ isCreating() ? 'Creating...' : 'Create project' }}
          </button>
        </form>
      </section>

      <section class="list-panel" aria-labelledby="project-list-heading">
        <div class="list-toolbar">
          <div>
            <h2 id="project-list-heading">Projects</h2>
            <p>{{ filteredProjects().length }} shown of {{ projects().length }}</p>
          </div>

          <div class="filter-control" role="group" aria-label="Project status filter">
            @for (filter of statusFilters; track filter.value) {
              <button
                type="button"
                [class.filter-control__button--active]="statusFilter() === filter.value"
                (click)="statusFilter.set(filter.value)"
              >
                {{ filter.label }}
              </button>
            }
          </div>
        </div>

        @if (isLoading()) {
          <app-loading-indicator label="Loading projects" />
        } @else if (error()) {
          <app-error-panel [message]="error() ?? ''" (retry)="loadProjects()" />
        } @else if (projects().length === 0) {
          <app-empty-state
            title="No projects yet"
            message="Use the create form to add the first project."
          />
        } @else if (filteredProjects().length === 0) {
          <app-empty-state
            title="No projects match this filter"
            message="Switch to another project status to continue."
          />
        } @else {
          <section class="project-list" aria-label="Projects">
            @for (project of filteredProjects(); track project.id) {
              <article class="project-row">
                <div>
                  <span class="project-key">{{ project.key }}</span>
                  <h3>
                    <a [routerLink]="['/projects', project.id]">{{ project.name }}</a>
                  </h3>
                  <p>{{ project.description || 'No description provided.' }}</p>
                </div>

                <div class="project-row__meta">
                  <span [class.project-row__status--archived]="project.status === 'archived'">
                    {{ project.status }}
                  </span>
                  <a [routerLink]="['/projects', project.id, 'work-items']">Work items</a>
                  <a [routerLink]="['/projects', project.id, 'board']">Board</a>
                  <a [routerLink]="['/projects', project.id, 'settings']">Settings</a>
                </div>
              </article>
            }
          </section>
        }
      </section>
    </section>
  `,
  styles: `
    .page-header {
      display: flex;
      justify-content: space-between;
      gap: 20px;
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
    h3,
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

    h3 {
      margin-bottom: 4px;
      font-size: 1rem;
      line-height: 1.35;
    }

    .page-copy,
    .list-toolbar p,
    .project-row p {
      color: #64748b;
      font-size: 0.875rem;
      line-height: 1.5;
    }

    .project-layout {
      display: grid;
      grid-template-columns: minmax(260px, 340px) minmax(0, 1fr);
      gap: 18px;
      align-items: start;
    }

    .create-panel,
    .list-panel {
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      background: #ffffff;
    }

    .create-panel {
      padding: 18px;
    }

    form {
      display: grid;
      gap: 10px;
      margin-top: 16px;
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

    button {
      min-height: 38px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 0 14px;
      background: #ffffff;
      color: #1f2937;
      font: inherit;
      font-size: 0.875rem;
      font-weight: 800;
      cursor: pointer;
    }

    form > button {
      border-color: #1f4f99;
      background: #1f4f99;
      color: #ffffff;
    }

    button:disabled {
      cursor: not-allowed;
      opacity: 0.64;
    }

    .list-panel {
      display: grid;
      gap: 16px;
      padding: 18px;
    }

    .list-toolbar {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      align-items: center;
    }

    .filter-control {
      display: inline-flex;
      gap: 4px;
      border: 1px solid #cbd5e1;
      border-radius: 7px;
      padding: 3px;
      background: #f8fafc;
    }

    .filter-control button {
      min-height: 30px;
      border: 0;
      padding: 0 10px;
      background: transparent;
      color: #475569;
    }

    .filter-control__button--active {
      background: #dbeafe !important;
      color: #1e3a8a !important;
    }

    .project-list {
      display: grid;
      gap: 10px;
    }

    .project-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 20px;
      align-items: center;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 16px;
      background: #ffffff;
    }

    h3 a,
    .project-row__meta a {
      color: #1d4ed8;
      text-decoration: none;
    }

    h3 a:hover,
    .project-row__meta a:hover {
      text-decoration: underline;
    }

    .project-row__meta {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 10px;
      color: #475569;
      font-size: 0.8125rem;
      font-weight: 800;
      text-transform: capitalize;
    }

    .project-key {
      display: inline-flex;
      min-height: 22px;
      margin-bottom: 6px;
      border: 1px solid #bfdbfe;
      border-radius: 999px;
      padding: 2px 8px;
      background: #eff6ff;
      color: #1e3a8a;
      font-size: 0.75rem;
      font-weight: 900;
      line-height: 1.4;
    }

    .project-row__status--archived {
      color: #9a3412;
    }

    @media (max-width: 860px) {
      .project-layout,
      .project-row {
        grid-template-columns: 1fr;
      }

      .list-toolbar {
        align-items: stretch;
        flex-direction: column;
      }

      .project-row__meta {
        justify-content: flex-start;
      }
    }
  `
})
export class ProjectListPageComponent implements OnInit {
  private readonly api = inject(WorktrailApiService);
  private readonly formBuilder = inject(FormBuilder);

  readonly statusFilters: Array<{ label: string; value: ProjectStatusFilter }> = [
    { label: 'All', value: 'all' },
    { label: 'Active', value: 'active' },
    { label: 'Archived', value: 'archived' }
  ];

  readonly projects = signal<ProjectDto[]>([]);
  readonly statusFilter = signal<ProjectStatusFilter>('all');
  readonly isLoading = signal(false);
  readonly isCreating = signal(false);
  readonly hasSubmittedCreate = signal(false);
  readonly error = signal<string | null>(null);
  readonly createError = signal<string | null>(null);

  readonly filteredProjects = computed(() => {
    const filter = this.statusFilter();
    return filter === 'all'
      ? this.projects()
      : this.projects().filter((project) => project.status === filter);
  });

  readonly createProjectForm = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required]],
    description: ['']
  });

  ngOnInit(): void {
    this.loadProjects();
  }

  loadProjects(): void {
    this.isLoading.set(true);
    this.error.set(null);

    this.api.listProjects().subscribe({
      next: (projects) => {
        this.projects.set(projects);
        this.isLoading.set(false);
      },
      error: () => {
        this.error.set('Projects could not be loaded from the API.');
        this.isLoading.set(false);
      }
    });
  }

  createProject(): void {
    this.hasSubmittedCreate.set(true);
    this.createError.set(null);

    if (this.createProjectForm.invalid) {
      this.createProjectForm.markAllAsTouched();
      return;
    }

    const formValue = this.createProjectForm.getRawValue();
    this.isCreating.set(true);

    this.api
      .createProject({
        name: formValue.name.trim(),
        description: formValue.description.trim()
      })
      .subscribe({
        next: (project) => {
          this.projects.set([project, ...this.projects()]);
          this.statusFilter.set('active');
          this.createProjectForm.reset();
          this.hasSubmittedCreate.set(false);
          this.isCreating.set(false);
        },
        error: () => {
          this.createError.set('The project could not be created.');
          this.isCreating.set(false);
        }
      });
  }

  showNameError(): boolean {
    const control = this.createProjectForm.controls.name;
    return control.invalid && (control.touched || this.hasSubmittedCreate());
  }
}
