import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { ProjectDto } from '@worktrail/contracts';

import { WorktrailApiService } from '../../core/worktrail-api.service';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { ErrorPanelComponent } from '../../shared/ui/error-panel.component';
import { LoadingIndicatorComponent } from '../../shared/ui/loading-indicator.component';

@Component({
  selector: 'app-project-list-page',
  imports: [EmptyStateComponent, ErrorPanelComponent, LoadingIndicatorComponent, RouterLink],
  template: `
    <section class="page-heading">
      <p class="eyebrow">Projects</p>
      <h1>Project workspace</h1>
    </section>

    @if (isLoading()) {
      <app-loading-indicator label="Loading projects" />
    } @else if (error()) {
      <app-error-panel [message]="error() ?? ''" (retry)="loadProjects()" />
    } @else if (projects().length === 0) {
      <app-empty-state
        title="No projects yet"
        message="Project creation arrives in the next phase. The shell is connected to the API now."
      />
    } @else {
      <section class="project-list" aria-label="Projects">
        @for (project of projects(); track project.id) {
          <article class="project-row">
            <div>
              <h2>
                <a [routerLink]="['/projects', project.id]">{{ project.name }}</a>
              </h2>
              <p>{{ project.description || 'No description provided.' }}</p>
            </div>

            <div class="project-row__meta">
              <span [class.project-row__status--archived]="project.status === 'archived'">
                {{ project.status }}
              </span>
              <a [routerLink]="['/projects', project.id, 'work-items']">Work items</a>
              <a [routerLink]="['/projects', project.id, 'board']">Board</a>
            </div>
          </article>
        }
      </section>
    }
  `,
  styles: `
    .page-heading {
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

    h1 {
      margin: 0;
      color: #111827;
      font-size: 1.75rem;
      line-height: 1.2;
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

    h2 {
      margin: 0 0 4px;
      font-size: 1rem;
      line-height: 1.35;
    }

    h2 a,
    .project-row__meta a {
      color: #1d4ed8;
      text-decoration: none;
    }

    h2 a:hover,
    .project-row__meta a:hover {
      text-decoration: underline;
    }

    p {
      margin: 0;
      color: #64748b;
      font-size: 0.875rem;
      line-height: 1.5;
    }

    .project-row__meta {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 10px;
      color: #475569;
      font-size: 0.8125rem;
      font-weight: 700;
      text-transform: capitalize;
    }

    .project-row__status--archived {
      color: #9a3412;
    }

    @media (max-width: 720px) {
      .project-row {
        grid-template-columns: 1fr;
      }

      .project-row__meta {
        justify-content: flex-start;
      }
    }
  `
})
export class ProjectListPageComponent implements OnInit {
  private readonly api = inject(WorktrailApiService);

  readonly projects = signal<ProjectDto[]>([]);
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);

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
}
