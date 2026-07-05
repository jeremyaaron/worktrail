import { Component, OnInit, computed, inject, signal } from '@angular/core';
import {
  ActivatedRoute,
  RouterLink,
  RouterLinkActive,
  RouterOutlet
} from '@angular/router';
import type { DeliveryHealthState, ProjectSummaryDto } from '@worktrail/contracts';

import { WorktrailApiService } from '../../../core/worktrail-api.service';
import {
  deliveryHealthLabel,
  deliveryHealthTone
} from '../../../shared/delivery-health/delivery-health-display';
import { ErrorPanelComponent } from '../../../shared/ui/error-panel.component';
import { LoadingIndicatorComponent } from '../../../shared/ui/loading-indicator.component';

interface ProjectSectionLink {
  label: string;
  commands: unknown[];
  exact: boolean;
}

@Component({
  selector: 'app-project-shell',
  imports: [
    ErrorPanelComponent,
    LoadingIndicatorComponent,
    RouterLink,
    RouterLinkActive,
    RouterOutlet
  ],
  template: `
    <section class="project-shell" aria-label="Project workspace">
      <header class="project-shell__header">
        @if (isLoading()) {
          <app-loading-indicator label="Loading project" />
        } @else if (error()) {
          <app-error-panel
            title="Project unavailable"
            [message]="error() ?? ''"
            (retry)="loadProjectSummary()"
          />
        } @else if (summary(); as summary) {
          <div class="project-shell__identity">
            <p class="project-shell__eyebrow">Project</p>
            <div class="project-shell__title-row">
              <h1>{{ summary.project.name }}</h1>
              <span class="project-shell__key">{{ summary.project.key }}</span>
              <span
                class="project-shell__status"
                [attr.data-status]="summary.project.status"
              >
                {{ projectStatusLabel(summary.project.status) }}
              </span>
              <span
                class="project-shell__health"
                [attr.data-tone]="healthTone(summary.deliveryHealth.health)"
              >
                {{ healthLabel(summary.deliveryHealth.health) }}
              </span>
            </div>
            @if (summary.project.description.trim() !== '') {
              <p class="project-shell__description">{{ summary.project.description }}</p>
            }
          </div>

          <div class="project-shell__actions">
            <a [routerLink]="['/projects', projectId(), 'work-items']">Open work</a>
            @if (summary.project.status === 'active') {
              <a
                class="project-shell__primary-action"
                [routerLink]="['/projects', projectId(), 'work-items', 'new']"
              >
                Create
              </a>
            }
          </div>

          @if (summary.project.status === 'archived') {
            <div class="project-shell__notice" aria-label="Archived project">
              <strong>Archived project</strong>
              <span>Work is read-only until the project is reactivated in settings.</span>
            </div>
          }
        }
      </header>

      <nav class="project-shell__nav" aria-label="Project sections">
        @for (section of sections(); track section.label) {
          <a
            [routerLink]="section.commands"
            routerLinkActive="project-shell__nav-link--active"
            [routerLinkActiveOptions]="{ exact: section.exact }"
          >
            {{ section.label }}
          </a>
        }
      </nav>

      <div class="project-shell__content">
        <router-outlet />
      </div>
    </section>
  `,
  styles: `
    .project-shell {
      display: grid;
      gap: 18px;
    }

    .project-shell__header {
      display: grid;
      gap: 16px;
      border: 1px solid #d7e0ea;
      border-radius: 8px;
      padding: 18px;
      background: #ffffff;
    }

    .project-shell__identity {
      display: grid;
      gap: 8px;
      min-width: 0;
    }

    .project-shell__eyebrow {
      margin: 0;
      color: #64748b;
      font-size: 0.75rem;
      font-weight: 800;
      letter-spacing: 0;
      text-transform: uppercase;
    }

    .project-shell__title-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      min-width: 0;
    }

    .project-shell__title-row h1 {
      margin: 0;
      color: #111827;
      font-size: clamp(1.35rem, 2vw, 1.85rem);
      line-height: 1.15;
      overflow-wrap: anywhere;
    }

    .project-shell__key,
    .project-shell__status,
    .project-shell__health {
      display: inline-flex;
      align-items: center;
      min-height: 26px;
      border: 1px solid #cbd5e1;
      border-radius: 999px;
      padding: 3px 9px;
      color: #334155;
      font-size: 0.75rem;
      font-weight: 800;
      white-space: nowrap;
    }

    .project-shell__key {
      background: #f8fafc;
    }

    .project-shell__status[data-status='archived'] {
      border-color: #d1d5db;
      background: #f3f4f6;
      color: #4b5563;
    }

    .project-shell__health[data-tone='positive'] {
      border-color: #86efac;
      background: #f0fdf4;
      color: #166534;
    }

    .project-shell__health[data-tone='warning'] {
      border-color: #fcd34d;
      background: #fffbeb;
      color: #92400e;
    }

    .project-shell__health[data-tone='critical'] {
      border-color: #fca5a5;
      background: #fef2f2;
      color: #991b1b;
    }

    .project-shell__health[data-tone='info'] {
      border-color: #93c5fd;
      background: #eff6ff;
      color: #1d4ed8;
    }

    .project-shell__health[data-tone='neutral'] {
      border-color: #cbd5e1;
      background: #f8fafc;
      color: #475569;
    }

    .project-shell__description {
      max-width: 72ch;
      margin: 0;
      color: #475569;
      font-size: 0.9rem;
      line-height: 1.45;
    }

    .project-shell__actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }

    .project-shell__actions a {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 36px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 7px 12px;
      background: #ffffff;
      color: #1e3a5f;
      font-size: 0.875rem;
      font-weight: 800;
      text-decoration: none;
    }

    .project-shell__actions a:hover {
      border-color: #94a3b8;
      background: #f8fafc;
    }

    .project-shell__actions .project-shell__primary-action {
      border-color: #1f4f99;
      background: #1f4f99;
      color: #ffffff;
    }

    .project-shell__notice {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      border: 1px solid #d1d5db;
      border-radius: 7px;
      padding: 10px 12px;
      background: #f8fafc;
      color: #475569;
      font-size: 0.875rem;
      line-height: 1.4;
    }

    .project-shell__notice strong {
      color: #111827;
    }

    .project-shell__nav {
      display: flex;
      gap: 6px;
      overflow-x: auto;
      border-bottom: 1px solid #d7e0ea;
    }

    .project-shell__nav a {
      display: inline-flex;
      align-items: center;
      min-height: 40px;
      border-bottom: 3px solid transparent;
      padding: 0 10px;
      color: #475569;
      font-size: 0.875rem;
      font-weight: 800;
      text-decoration: none;
      white-space: nowrap;
    }

    .project-shell__nav a:hover,
    .project-shell__nav-link--active {
      border-bottom-color: #1f4f99;
      color: #183b73;
    }

    .project-shell__content {
      min-width: 0;
    }

    @media (min-width: 860px) {
      .project-shell__header {
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: start;
      }

      .project-shell__notice {
        grid-column: 1 / -1;
      }

      .project-shell__actions {
        justify-content: flex-end;
      }
    }
  `
})
export class ProjectShellComponent implements OnInit {
  private readonly api = inject(WorktrailApiService);
  private readonly route = inject(ActivatedRoute);

  readonly summary = signal<ProjectSummaryDto | null>(null);
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);
  readonly projectId = computed(() => this.route.snapshot.paramMap.get('projectId') ?? '');
  readonly sections = computed<ProjectSectionLink[]>(() => [
    { label: 'Overview', commands: ['/projects', this.projectId()], exact: true },
    { label: 'Work', commands: ['/projects', this.projectId(), 'work-items'], exact: false },
    { label: 'Board', commands: ['/projects', this.projectId(), 'board'], exact: false },
    { label: 'Planning', commands: ['/projects', this.projectId(), 'planning'], exact: false },
    { label: 'Settings', commands: ['/projects', this.projectId(), 'settings'], exact: false }
  ]);

  ngOnInit(): void {
    this.loadProjectSummary();
  }

  loadProjectSummary(): void {
    this.isLoading.set(true);
    this.error.set(null);

    this.api.getProjectSummary(this.projectId()).subscribe({
      next: (summary) => {
        this.summary.set(summary);
        this.isLoading.set(false);
      },
      error: () => {
        this.summary.set(null);
        this.error.set('Project summary could not be loaded from the API.');
        this.isLoading.set(false);
      }
    });
  }

  projectStatusLabel(status: ProjectSummaryDto['project']['status']): string {
    return status === 'archived' ? 'Archived' : 'Active';
  }

  healthLabel(state: DeliveryHealthState): string {
    return deliveryHealthLabel(state);
  }

  healthTone(state: DeliveryHealthState): string {
    return deliveryHealthTone(state);
  }
}
