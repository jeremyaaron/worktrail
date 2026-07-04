import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import type {
  ProjectDto,
  ProjectNavigationSummaryDto,
  ProjectStatus,
  WorkspaceCapabilitiesDto
} from '@worktrail/contracts';

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
        @if (!canCreateProjects()) {
          <p class="permission-note">Owners and maintainers can create projects. Contributors can view existing projects.</p>
        }
        <form [formGroup]="createProjectForm" (ngSubmit)="createProject()" novalidate>
          <label for="project-name">Name</label>
          <input
            id="project-name"
            type="text"
            formControlName="name"
            autocomplete="off"
            [readonly]="!canCreateProjects()"
            [attr.aria-invalid]="showNameError()"
            aria-describedby="project-name-error"
          />
          @if (showNameError()) {
            <p id="project-name-error" class="field-error">Project name is required.</p>
          }

          <label for="project-key">Key</label>
          <input
            id="project-key"
            type="text"
            formControlName="key"
            autocomplete="off"
            maxlength="8"
            [readonly]="!canCreateProjects()"
            [attr.aria-invalid]="showKeyError()"
            aria-describedby="project-key-help project-key-error"
          />
          <p id="project-key-help" class="field-help">Optional. Use 2-8 letters or numbers, or leave blank to generate one.</p>
          @if (showKeyError()) {
            <p id="project-key-error" class="field-error">Project key must be 2-8 letters or numbers.</p>
          }

          <label for="project-description">Description</label>
          <textarea
            id="project-description"
            rows="4"
            formControlName="description"
            [readonly]="!canCreateProjects()"
          ></textarea>

          @if (createError()) {
            <app-error-panel
              title="Project not created"
              [message]="createError() ?? ''"
              (retry)="createProject()"
            />
          }

          @if (createSuccess()) {
            <p class="success-message">Project created.</p>
          }

          <button type="submit" [disabled]="!canCreateProjects() || isCreating()">
            {{ isCreating() ? 'Creating...' : 'Create project' }}
          </button>
        </form>
      </section>

      <section class="list-panel" aria-labelledby="project-list-heading">
        <div class="list-toolbar">
          <div>
            <h2 id="project-list-heading">Projects</h2>
            <p>{{ filteredSummaries().length }} shown of {{ projectSummaries().length }}</p>
          </div>

          <div class="list-toolbar__controls">
            <label class="search-control" for="project-search">
              <span>Search</span>
              <input
                id="project-search"
                type="search"
                autocomplete="off"
                placeholder="Name or key"
                [value]="searchTerm()"
                (input)="searchTerm.set($any($event.target).value)"
              />
            </label>

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
        </div>

        @if (isLoading()) {
          <app-loading-indicator label="Loading projects" />
        } @else if (error()) {
          <app-error-panel [message]="error() ?? ''" (retry)="loadProjects()" />
        } @else if (projectSummaries().length === 0) {
          <app-empty-state
            title="No projects yet"
            message="Use the create form to add the first project."
          />
        } @else if (filteredSummaries().length === 0) {
          <app-empty-state
            title="No projects match these filters"
            message="Adjust search or status to continue."
          />
        } @else {
          <section class="project-list" aria-label="Projects">
            @for (summary of filteredSummaries(); track summary.project.id) {
              @if (showArchivedDivider(summary, $index)) {
                <h3 class="archive-divider">Archived projects</h3>
              }
              <article
                class="project-row"
                [class.project-row--archived]="summary.project.status === 'archived'"
              >
                <div class="project-row__main">
                  @let project = summary.project;
                  <span class="project-key">{{ project.key }}</span>
                  <h3>
                    <a [routerLink]="['/projects', project.id]">{{ project.name }}</a>
                  </h3>
                  <p>{{ project.description || 'No description provided.' }}</p>

                  <dl class="summary-strip" [attr.aria-label]="project.name + ' work summary'">
                    <div>
                      <dt>Open</dt>
                      <dd>{{ summary.openWorkItemCount }}</dd>
                    </div>
                    <div>
                      <dt>Blocked</dt>
                      <dd>{{ summary.blockedWorkItemCount }}</dd>
                    </div>
                    <div>
                      <dt>Overdue</dt>
                      <dd>{{ summary.overdueWorkItemCount }}</dd>
                    </div>
                    <div>
                      <dt>Updated</dt>
                      <dd>{{ formatDate(summary.updatedAt) }}</dd>
                    </div>
                  </dl>
                </div>

                <div class="project-row__meta">
                  <span [class.project-row__status--archived]="project.status === 'archived'">
                    {{ project.status }}
                  </span>
                  <a [routerLink]="['/projects', project.id, 'work-items']">Work items</a>
                  <a [routerLink]="['/projects', project.id, 'board']">Board</a>
                  <a [routerLink]="['/projects', project.id, 'planning']">Planning</a>
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
    .field-help,
    .permission-note,
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

    input[readonly],
    textarea[readonly] {
      background: #f8fafc;
      color: #64748b;
    }

    #project-key {
      text-transform: uppercase;
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
      align-items: flex-start;
    }

    .list-toolbar__controls {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 10px;
      align-items: end;
    }

    .search-control {
      display: grid;
      gap: 4px;
      min-width: 180px;
    }

    .search-control span {
      color: #334155;
      font-size: 0.75rem;
      font-weight: 800;
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

    .archive-divider {
      margin-top: 6px;
      border-top: 1px solid #e5e7eb;
      padding-top: 16px;
      color: #64748b;
      font-size: 0.8125rem;
      text-transform: uppercase;
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

    .project-row--archived {
      background: #f8fafc;
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

    .summary-strip {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin: 14px 0 0;
    }

    .summary-strip div {
      min-width: 76px;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      padding: 8px 10px;
      background: #f8fafc;
    }

    .summary-strip dt {
      color: #64748b;
      font-size: 0.6875rem;
      font-weight: 800;
      text-transform: uppercase;
    }

    .summary-strip dd {
      margin: 2px 0 0;
      color: #111827;
      font-size: 0.875rem;
      font-weight: 900;
    }

    .project-row__status--archived {
      color: #9a3412;
    }

    @media (max-width: 860px) {
      .project-layout,
      .project-row {
        grid-template-columns: 1fr;
      }

      .list-toolbar,
      .list-toolbar__controls {
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

  readonly projectSummaries = signal<ProjectNavigationSummaryDto[]>([]);
  readonly capabilities = signal<WorkspaceCapabilitiesDto | null>(null);
  readonly statusFilter = signal<ProjectStatusFilter>('all');
  readonly searchTerm = signal('');
  readonly isLoading = signal(false);
  readonly isCreating = signal(false);
  readonly hasSubmittedCreate = signal(false);
  readonly error = signal<string | null>(null);
  readonly createError = signal<string | null>(null);
  readonly capabilitiesError = signal<string | null>(null);
  readonly createSuccess = signal(false);
  readonly canCreateProjects = computed(() => this.capabilities()?.canCreateProjects === true);

  readonly filteredSummaries = computed(() => {
    const filter = this.statusFilter();
    const search = this.searchTerm().trim().toLowerCase();

    return this.projectSummaries().filter((summary) => {
      const project = summary.project;
      const matchesStatus = filter === 'all' || project.status === filter;
      const matchesSearch =
        search === '' ||
        project.name.toLowerCase().includes(search) ||
        project.key.toLowerCase().includes(search);

      return matchesStatus && matchesSearch;
    });
  });

  readonly createProjectForm = this.formBuilder.nonNullable.group({
    key: ['', [Validators.pattern(/^[A-Za-z0-9]{2,8}$/)]],
    name: ['', [Validators.required]],
    description: ['']
  });

  ngOnInit(): void {
    this.loadProjects();
    this.loadCapabilities();
  }

  loadProjects(): void {
    this.isLoading.set(true);
    this.error.set(null);

    this.api.listProjectNavigationSummaries().subscribe({
      next: (summaries) => {
        this.projectSummaries.set(summaries);
        this.isLoading.set(false);
      },
      error: () => {
        this.error.set('Projects could not be loaded from the API.');
        this.isLoading.set(false);
      }
    });
  }

  loadCapabilities(): void {
    this.capabilitiesError.set(null);

    this.api.getWorkspaceCapabilities().subscribe({
      next: (capabilities) => {
        this.capabilities.set(capabilities);
      },
      error: () => {
        this.capabilitiesError.set('Workspace permissions could not be loaded from the API.');
      }
    });
  }

  createProject(): void {
    this.hasSubmittedCreate.set(true);
    this.createError.set(null);
    this.createSuccess.set(false);

    if (!this.canCreateProjects()) {
      this.createError.set('Only owners and maintainers can create projects.');
      return;
    }

    if (this.createProjectForm.invalid) {
      this.createProjectForm.markAllAsTouched();
      return;
    }

    const formValue = this.createProjectForm.getRawValue();
    const key = formValue.key.trim().toUpperCase();
    this.isCreating.set(true);

    this.api
      .createProject({
        ...(key === '' ? {} : { key }),
        name: formValue.name.trim(),
        description: formValue.description.trim()
      })
      .subscribe({
        next: (project) => {
          this.projectSummaries.set([
            this.toNavigationSummary(project),
            ...this.projectSummaries()
          ]);
          this.statusFilter.set('active');
          this.searchTerm.set('');
          this.createProjectForm.reset({ key: '', name: '', description: '' });
          this.hasSubmittedCreate.set(false);
          this.isCreating.set(false);
          this.createSuccess.set(true);
        },
        error: (error: unknown) => {
          this.createError.set(this.toErrorMessage(error, 'The project could not be created.'));
          this.isCreating.set(false);
        }
      });
  }

  showNameError(): boolean {
    const control = this.createProjectForm.controls.name;
    return control.invalid && (control.touched || this.hasSubmittedCreate());
  }

  showKeyError(): boolean {
    const control = this.createProjectForm.controls.key;
    return control.invalid && (control.touched || this.hasSubmittedCreate());
  }

  showArchivedDivider(summary: ProjectNavigationSummaryDto, index: number): boolean {
    if (summary.project.status !== 'archived') {
      return false;
    }

    const previous = this.filteredSummaries()[index - 1];
    return previous === undefined || previous.project.status !== 'archived';
  }

  formatDate(value: string): string {
    return new Intl.DateTimeFormat('en', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(new Date(value));
  }

  private toNavigationSummary(project: ProjectDto): ProjectNavigationSummaryDto {
    return {
      project,
      openWorkItemCount: 0,
      blockedWorkItemCount: 0,
      overdueWorkItemCount: 0,
      updatedAt: project.updatedAt
    };
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
