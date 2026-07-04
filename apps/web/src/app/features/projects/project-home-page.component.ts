import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import type { ProjectSummaryDto, WorkItemStatus } from '@worktrail/contracts';

import { WorktrailApiService } from '../../core/worktrail-api.service';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { ErrorPanelComponent } from '../../shared/ui/error-panel.component';
import { LoadingIndicatorComponent } from '../../shared/ui/loading-indicator.component';

const statusLabels: Record<WorkItemStatus, string> = {
  backlog: 'Backlog',
  ready: 'Ready',
  in_progress: 'In progress',
  blocked: 'Blocked',
  done: 'Done',
  canceled: 'Canceled'
};

@Component({
  selector: 'app-project-home-page',
  imports: [EmptyStateComponent, ErrorPanelComponent, LoadingIndicatorComponent, RouterLink],
  template: `
    @if (isLoading()) {
      <app-loading-indicator label="Loading project summary" />
    } @else if (error()) {
      <app-error-panel [message]="error() ?? ''" (retry)="loadSummary()" />
    } @else if (summary(); as summary) {
      <section class="project-header">
        <div>
          <p class="eyebrow">Project</p>
          <h1>{{ summary.project.name }}</h1>
          <div class="project-meta-pills">
            <span>{{ summary.project.key }}</span>
            <span [class.project-meta-pills__status--archived]="summary.project.status === 'archived'">
              {{ summary.project.status }}
            </span>
          </div>
          <p class="project-copy">
            {{ summary.project.description || 'No description provided.' }}
          </p>
        </div>

        <div class="project-actions">
          <a [routerLink]="['/projects', projectId(), 'work-items']">Work items</a>
          <a [routerLink]="['/projects', projectId(), 'board']">Board</a>
          <a [routerLink]="['/projects', projectId(), 'settings']">Settings</a>
          @if (summary.project.status === 'active') {
            <a class="project-actions__primary" [routerLink]="['/projects', projectId(), 'work-items', 'new']">
              Create work item
            </a>
          }
        </div>
      </section>

      @if (summary.project.status === 'archived') {
        <section class="notice" aria-label="Archived project">
          <strong>Archived project</strong>
          <p>Project work is read-only until it is reactivated in settings.</p>
        </section>
      }

      <section class="summary-grid" aria-label="Work item status counts">
        @for (count of summary.countsByStatus; track count.status) {
          <article class="status-tile" [attr.data-status]="count.status">
            <span>{{ statusLabel(count.status) }}</span>
            <strong>{{ count.count }}</strong>
          </article>
        }
      </section>

      <section class="home-grid">
        <section class="panel" aria-labelledby="recent-work-heading">
          <div class="panel__heading">
            <h2 id="recent-work-heading">Recently updated</h2>
            <a [routerLink]="['/projects', projectId(), 'work-items']">View all</a>
          </div>

          @if (summary.recentWorkItems.length === 0) {
            <app-empty-state
              title="No work items yet"
              message="Create the first work item from this project."
            />
          } @else {
            <div class="recent-list">
              @for (item of summary.recentWorkItems; track item.id) {
                <a class="recent-row" [routerLink]="['/work-items', item.id]">
                  <span>
                    <strong>{{ item.displayKey }}</strong>
                    {{ item.title }}
                  </span>
                  <small>{{ statusLabel(item.status) }} · {{ formatDate(item.updatedAt) }}</small>
                </a>
              }
            </div>
          }
        </section>

        <section class="panel" aria-labelledby="project-meta-heading">
          <div class="panel__heading">
            <h2 id="project-meta-heading">Project state</h2>
          </div>

          <dl class="meta-list">
            <div>
              <dt>Status</dt>
              <dd>{{ summary.project.status }}</dd>
            </div>
            <div>
              <dt>Created</dt>
              <dd>{{ formatDate(summary.project.createdAt) }}</dd>
            </div>
            <div>
              <dt>Updated</dt>
              <dd>{{ formatDate(summary.project.updatedAt) }}</dd>
            </div>
          </dl>
        </section>
      </section>
    }
  `,
  styles: `
    .project-header {
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
    p,
    dl,
    dd {
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

    .project-copy {
      margin-top: 8px;
      color: #64748b;
      font-size: 0.875rem;
      line-height: 1.5;
    }

    .project-meta-pills {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 10px;
    }

    .project-meta-pills span {
      border: 1px solid #bfdbfe;
      border-radius: 999px;
      padding: 3px 9px;
      background: #eff6ff;
      color: #1e3a8a;
      font-size: 0.75rem;
      font-weight: 900;
      text-transform: uppercase;
    }

    .project-meta-pills span:last-child {
      border-color: #bbf7d0;
      background: #f0fdf4;
      color: #166534;
      text-transform: capitalize;
    }

    .project-meta-pills__status--archived {
      border-color: #fed7aa !important;
      background: #fff7ed !important;
      color: #9a3412 !important;
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

    .notice p {
      margin: 0;
      color: #9a3412;
      font-size: 0.875rem;
      line-height: 1.5;
    }

    .project-actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 8px;
    }

    .project-actions a,
    .panel__heading a {
      min-height: 36px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 8px 12px;
      color: #1f2937;
      font-size: 0.875rem;
      font-weight: 800;
      text-decoration: none;
    }

    .project-actions a:hover,
    .panel__heading a:hover {
      border-color: #94a3b8;
      background: #f8fafc;
    }

    .project-actions__primary {
      border-color: #1f4f99 !important;
      background: #1f4f99;
      color: #ffffff !important;
    }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(6, minmax(0, 1fr));
      gap: 10px;
      margin-bottom: 18px;
    }

    .status-tile {
      border: 1px solid #e5e7eb;
      border-top-width: 4px;
      border-radius: 8px;
      padding: 14px;
      background: #ffffff;
    }

    .status-tile span {
      display: block;
      color: #64748b;
      font-size: 0.75rem;
      font-weight: 800;
    }

    .status-tile strong {
      display: block;
      margin-top: 8px;
      color: #111827;
      font-size: 1.75rem;
      line-height: 1;
    }

    .status-tile[data-status='backlog'] {
      border-top-color: #94a3b8;
    }

    .status-tile[data-status='ready'] {
      border-top-color: #06b6d4;
    }

    .status-tile[data-status='in_progress'] {
      border-top-color: #2563eb;
    }

    .status-tile[data-status='blocked'] {
      border-top-color: #f97316;
    }

    .status-tile[data-status='done'] {
      border-top-color: #10b981;
    }

    .status-tile[data-status='canceled'] {
      border-top-color: #64748b;
    }

    .home-grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(240px, 320px);
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

    .panel__heading {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }

    .panel__heading a {
      display: inline-flex;
      align-items: center;
      min-height: 32px;
      padding: 6px 10px;
      color: #1d4ed8;
    }

    .recent-list {
      display: grid;
      gap: 8px;
    }

    .recent-row {
      display: grid;
      gap: 4px;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 12px;
      color: #111827;
      text-decoration: none;
    }

    .recent-row:hover {
      border-color: #bfdbfe;
      background: #f8fafc;
    }

    .recent-row span {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      font-size: 0.875rem;
      font-weight: 800;
      line-height: 1.35;
    }

    .recent-row strong {
      border: 1px solid #c7d2fe;
      border-radius: 999px;
      padding: 2px 7px;
      background: #eef2ff;
      color: #3730a3;
      font-size: 0.6875rem;
      font-weight: 900;
    }

    .recent-row small,
    dt {
      color: #64748b;
      font-size: 0.75rem;
      font-weight: 800;
    }

    .meta-list {
      display: grid;
      gap: 12px;
    }

    .meta-list div {
      display: grid;
      gap: 4px;
    }

    dd {
      color: #111827;
      font-size: 0.875rem;
      font-weight: 700;
      text-transform: capitalize;
    }

    @media (max-width: 900px) {
      .project-header,
      .home-grid {
        grid-template-columns: 1fr;
      }

      .project-actions {
        justify-content: flex-start;
      }

      .summary-grid {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
    }

    @media (max-width: 560px) {
      .summary-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
  `
})
export class ProjectHomePageComponent implements OnInit {
  private readonly api = inject(WorktrailApiService);
  private readonly route = inject(ActivatedRoute);

  readonly summary = signal<ProjectSummaryDto | null>(null);
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);
  readonly projectId = computed(() => this.route.snapshot.paramMap.get('projectId') ?? '');

  ngOnInit(): void {
    this.loadSummary();
  }

  loadSummary(): void {
    this.isLoading.set(true);
    this.error.set(null);

    this.api.getProjectSummary(this.projectId()).subscribe({
      next: (summary) => {
        this.summary.set(summary);
        this.isLoading.set(false);
      },
      error: () => {
        this.error.set('Project summary could not be loaded from the API.');
        this.isLoading.set(false);
      }
    });
  }

  statusLabel(status: WorkItemStatus): string {
    return statusLabels[status];
  }

  formatDate(value: string): string {
    return new Intl.DateTimeFormat('en', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(new Date(value));
  }
}
