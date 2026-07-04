import { Component, OnDestroy, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { MyWorkDashboardDto, WorkspaceWorkItemListItemDto } from '@worktrail/contracts';
import { Subscription } from 'rxjs';

import { CurrentUserService } from '../../core/current-user.service';
import { WorktrailApiService } from '../../core/worktrail-api.service';
import {
  projectBadge,
  workItemMetadata,
  workItemPriorityLabel,
  workItemStatusLabel
} from '../../shared/work-items/work-item-display';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { ErrorPanelComponent } from '../../shared/ui/error-panel.component';
import { LoadingIndicatorComponent } from '../../shared/ui/loading-indicator.component';

interface DashboardSection {
  key: string;
  heading: string;
  emptyTitle: string;
  emptyMessage: string;
  items: WorkspaceWorkItemListItemDto[];
}

@Component({
  selector: 'app-my-work-page',
  imports: [EmptyStateComponent, ErrorPanelComponent, LoadingIndicatorComponent, RouterLink],
  template: `
    <section class="page-header">
      <div>
        <p class="eyebrow">My work</p>
        <h1>My work</h1>
        @if (dashboard(); as dashboard) {
          <p>{{ dashboard.actor.name }} · {{ formatRole(dashboard.actor.role) }}</p>
        } @else if (currentUser.selectedMember(); as member) {
          <p>{{ member.name }} · {{ formatRole(member.role) }}</p>
        } @else {
          <p>No active member selected.</p>
        }
      </div>

      <a class="header-action" routerLink="/work-items">Workspace work items</a>
    </section>

    @if (isLoading()) {
      <app-loading-indicator label="Loading my work" />
    } @else if (error()) {
      <app-error-panel
        title="My Work unavailable"
        [message]="error() ?? ''"
        (retry)="loadDashboard()"
      />
    } @else if (dashboard(); as dashboard) {
      <section class="summary-grid" aria-label="My Work summary">
        @for (count of dashboard.summaryCounts; track count.key) {
          <a class="summary-card" [routerLink]="['/work-items']" [queryParams]="count.query">
            <span>{{ count.label }}</span>
            <strong>{{ count.count }}</strong>
          </a>
        }
      </section>

      <section class="dashboard-grid" aria-label="My Work sections">
        @for (section of sections(); track section.key) {
          <section class="work-panel" [attr.aria-labelledby]="section.key + '-heading'">
            <div class="panel-heading">
              <h2 [id]="section.key + '-heading'">{{ section.heading }}</h2>
              <span>{{ section.items.length }}</span>
            </div>

            @if (section.items.length === 0) {
              <app-empty-state [title]="section.emptyTitle" [message]="section.emptyMessage" />
            } @else {
              <div class="work-list">
                @for (item of section.items; track item.id) {
                  <a class="work-row" [routerLink]="['/work-items', item.id]">
                    <span class="work-row__title">
                      <strong>{{ item.title }}</strong>
                      <small>
                        <span class="project-pill" [class.project-pill--archived]="item.project.status === 'archived'">
                          {{ projectBadge(item.project) }}
                        </span>
                        <span class="key-pill">{{ item.displayKey }}</span>
                        <span>{{ workItemMetadata(item) }}</span>
                      </small>
                    </span>

                    <span class="status-pill" [attr.data-status]="item.status">
                      {{ workItemStatusLabel(item.status) }}
                    </span>

                    <span class="priority-pill" [attr.data-priority]="item.priority">
                      {{ workItemPriorityLabel(item.priority) }}
                    </span>

                    <span class="planning-cell">
                      <span>{{ item.milestone?.name ?? 'No milestone' }}</span>
                      <small>{{ dueDateLabel(item) }}</small>
                    </span>

                    <span class="assignee-cell">
                      {{ item.assignee === null ? 'Unassigned' : memberDisplayName(item.assignee) }}
                    </span>

                    <span class="updated-cell">{{ formatDate(item.updatedAt) }}</span>
                  </a>
                }
              </div>
            }
          </section>
        }
      </section>
    } @else {
      <app-empty-state
        title="No active member"
        message="Select an active workspace member to load My Work."
      />
    }
  `,
  styles: `
    .page-header {
      display: flex;
      justify-content: space-between;
      gap: 20px;
      align-items: flex-start;
      margin-bottom: 20px;
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

    p {
      margin-top: 8px;
      color: #64748b;
      font-size: 0.875rem;
      line-height: 1.5;
    }

    .header-action {
      min-height: 38px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 9px 14px;
      background: #ffffff;
      color: #1f2937;
      font-size: 0.875rem;
      font-weight: 800;
      text-decoration: none;
    }

    .header-action:hover {
      border-color: #94a3b8;
      background: #f8fafc;
    }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(6, minmax(0, 1fr));
      gap: 10px;
      margin-bottom: 18px;
    }

    .summary-card {
      display: grid;
      gap: 8px;
      min-height: 92px;
      border: 1px solid #dbe3ea;
      border-radius: 8px;
      padding: 14px;
      background: #ffffff;
      color: #334155;
      text-decoration: none;
    }

    .summary-card:hover {
      border-color: #93c5fd;
      background: #f8fafc;
    }

    .summary-card span {
      color: #64748b;
      font-size: 0.75rem;
      font-weight: 900;
      line-height: 1.3;
      text-transform: uppercase;
    }

    .summary-card strong {
      color: #111827;
      font-size: 1.75rem;
      line-height: 1;
    }

    .dashboard-grid {
      display: grid;
      gap: 18px;
    }

    .work-panel {
      display: grid;
      gap: 14px;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 16px;
      background: #ffffff;
    }

    .panel-heading {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: center;
    }

    .panel-heading span {
      display: inline-grid;
      place-items: center;
      min-width: 28px;
      min-height: 28px;
      border-radius: 999px;
      background: #e8eef6;
      color: #334155;
      font-size: 0.875rem;
      font-weight: 900;
    }

    .work-list {
      display: grid;
      overflow-x: auto;
    }

    .work-row {
      display: grid;
      grid-template-columns: minmax(280px, 2fr) minmax(120px, 0.8fr) minmax(110px, 0.7fr) minmax(160px, 1fr) minmax(150px, 1fr) minmax(110px, 0.7fr);
      gap: 14px;
      min-width: 1040px;
      align-items: center;
      border-top: 1px solid #eef2f7;
      padding: 12px 10px;
      color: #334155;
      font-size: 0.875rem;
      text-decoration: none;
    }

    .work-row:hover {
      background: #f8fafc;
    }

    .work-row__title {
      display: grid;
      gap: 5px;
    }

    .work-row strong {
      color: #111827;
      line-height: 1.35;
    }

    .work-row small {
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
      align-items: center;
      color: #64748b;
      font-size: 0.75rem;
      line-height: 1.35;
    }

    .project-pill,
    .key-pill,
    .status-pill,
    .priority-pill {
      display: inline-flex;
      width: fit-content;
      min-height: 22px;
      align-items: center;
      border: 1px solid #cbd5e1;
      border-radius: 999px;
      padding: 2px 8px;
      font-size: 0.75rem;
      font-weight: 800;
    }

    .project-pill {
      border-color: #c7d2fe;
      background: #eef2ff;
      color: #3730a3;
      text-transform: uppercase;
    }

    .project-pill--archived {
      border-color: #fed7aa;
      background: #fff7ed;
      color: #9a3412;
    }

    .key-pill {
      border-color: #bfdbfe;
      background: #eff6ff;
      color: #1d4ed8;
      text-transform: uppercase;
    }

    .status-pill,
    .priority-pill {
      text-transform: capitalize;
    }

    .status-pill[data-status='backlog'] {
      background: #f8fafc;
      color: #475569;
    }

    .status-pill[data-status='ready'] {
      border-color: #a5f3fc;
      background: #ecfeff;
      color: #155e75;
    }

    .status-pill[data-status='in_progress'] {
      border-color: #bfdbfe;
      background: #eff6ff;
      color: #1d4ed8;
    }

    .status-pill[data-status='blocked'] {
      border-color: #fed7aa;
      background: #fff7ed;
      color: #c2410c;
    }

    .status-pill[data-status='done'] {
      border-color: #a7f3d0;
      background: #ecfdf5;
      color: #047857;
    }

    .status-pill[data-status='canceled'] {
      border-color: #cbd5e1;
      background: #f1f5f9;
      color: #475569;
    }

    .priority-pill[data-priority='low'] {
      background: #f8fafc;
      color: #475569;
    }

    .priority-pill[data-priority='medium'] {
      border-color: #fde68a;
      background: #fefce8;
      color: #854d0e;
    }

    .priority-pill[data-priority='high'] {
      border-color: #fed7aa;
      background: #fff7ed;
      color: #c2410c;
    }

    .priority-pill[data-priority='urgent'] {
      border-color: #fecaca;
      background: #fef2f2;
      color: #b91c1c;
    }

    .planning-cell,
    .assignee-cell,
    .updated-cell {
      display: grid;
      gap: 4px;
      align-content: center;
    }

    .planning-cell small {
      color: #64748b;
      font-size: 0.75rem;
      font-weight: 700;
    }

    @media (max-width: 1120px) {
      .summary-grid {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
    }

    @media (max-width: 760px) {
      .page-header {
        flex-direction: column;
      }

      .summary-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    @media (max-width: 520px) {
      .summary-grid {
        grid-template-columns: 1fr;
      }
    }
  `
})
export class MyWorkPageComponent implements OnDestroy {
  private readonly api = inject(WorktrailApiService);
  readonly currentUser = inject(CurrentUserService);
  private dashboardSubscription: Subscription | null = null;
  private lastActorId: string | null = null;

  readonly dashboard = signal<MyWorkDashboardDto | null>(null);
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);
  readonly sections = computed<DashboardSection[]>(() => {
    const dashboard = this.dashboard();

    if (dashboard === null) {
      return [];
    }

    return [
      {
        key: 'assigned-to-me',
        heading: 'Assigned to me',
        emptyTitle: 'No assigned work',
        emptyMessage: 'Open work assigned to this member will appear here.',
        items: dashboard.assignedToMe
      },
      {
        key: 'due-soon-or-overdue',
        heading: 'Due soon or overdue',
        emptyTitle: 'No urgent due dates',
        emptyMessage: 'Work with near or missed due dates will appear here.',
        items: dashboard.dueSoonOrOverdue
      },
      {
        key: 'blocked-relevant',
        heading: 'Blocked relevant work',
        emptyTitle: 'No relevant blockers',
        emptyMessage: 'Blocked assigned or reported work will appear here.',
        items: dashboard.blockedRelevant
      },
      {
        key: 'recently-updated',
        heading: 'Recently updated',
        emptyTitle: 'No recent work',
        emptyMessage: 'Recently updated assigned or reported work will appear here.',
        items: dashboard.recentlyUpdated
      }
    ];
  });

  private readonly actorReload = effect(() => {
    const actorId = this.currentUser.selectedMember()?.id ?? null;

    if (actorId === null) {
      this.lastActorId = null;
      this.dashboard.set(null);
      this.error.set(null);
      this.isLoading.set(false);
      this.dashboardSubscription?.unsubscribe();
      this.dashboardSubscription = null;
      return;
    }

    if (actorId !== this.lastActorId) {
      this.loadDashboard();
    }
  });

  ngOnDestroy(): void {
    this.actorReload.destroy();
    this.dashboardSubscription?.unsubscribe();
  }

  loadDashboard(): void {
    const actor = this.currentUser.selectedMember();

    if (actor === null) {
      return;
    }

    this.lastActorId = actor.id;
    this.dashboardSubscription?.unsubscribe();
    this.isLoading.set(true);
    this.error.set(null);

    this.dashboardSubscription = this.api.getMyWork().subscribe({
      next: (dashboard) => {
        this.dashboard.set(dashboard);
        this.isLoading.set(false);
      },
      error: () => {
        this.dashboard.set(null);
        this.error.set('My Work could not be loaded from the API.');
        this.isLoading.set(false);
      }
    });
  }

  projectBadge(itemProject: WorkspaceWorkItemListItemDto['project']): string {
    return projectBadge(itemProject);
  }

  workItemMetadata(item: WorkspaceWorkItemListItemDto): string {
    return workItemMetadata(item);
  }

  workItemStatusLabel = workItemStatusLabel;
  workItemPriorityLabel = workItemPriorityLabel;

  memberDisplayName(member: WorkspaceWorkItemListItemDto['assignee']): string {
    if (member === null) {
      return 'Unassigned';
    }

    return member.isActive ? member.name : `${member.name} (inactive)`;
  }

  dueDateLabel(item: WorkspaceWorkItemListItemDto): string {
    return item.dueDate === null ? 'No due date' : `Due ${this.formatDateOnly(item.dueDate)}`;
  }

  formatRole(role: string): string {
    return role
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  formatDate(value: string): string {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric'
    }).format(new Date(value));
  }

  private formatDateOnly(value: string): string {
    const [year, month, day] = value.split('-').map(Number);

    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric'
    }).format(new Date(year, month - 1, day));
  }
}
