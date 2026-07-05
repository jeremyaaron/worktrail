import { Component, OnDestroy, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type {
  MyWorkDashboardDto,
  MyWorkSummaryCountDto,
  WorkspaceWorkItemListItemDto
} from '@worktrail/contracts';
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
import {
  DailyQueueComponent,
  type DailyQueueItem,
  type DailyQueueReason
} from './components/daily-queue.component';
import { MyWorkSummaryComponent } from './components/my-work-summary.component';

interface SecondaryWorkSection {
  key: string;
  heading: string;
  emptyTitle: string;
  emptyMessage: string;
  items: WorkspaceWorkItemListItemDto[];
}

const staleInProgressDays = 7;
const dueSoonWindowDays = 7;
const activeSummaryFilterLabels: Record<MyWorkSummaryCountDto['key'], string> = {
  assigned_open: 'Assigned open',
  due_soon: 'Due soon',
  overdue: 'Overdue',
  blocked: 'Blocked',
  dependency_blocked: 'Dependency blocked',
  stale_assigned: 'Stale assigned',
  reported_open: 'Reported open'
};
const priorityOrder = new Map([
  ['urgent', 0],
  ['high', 1],
  ['medium', 2],
  ['low', 3]
]);

@Component({
  selector: 'app-my-work-page',
  imports: [
    DailyQueueComponent,
    EmptyStateComponent,
    ErrorPanelComponent,
    LoadingIndicatorComponent,
    MyWorkSummaryComponent,
    RouterLink
  ],
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
      <app-my-work-summary
        [counts]="dashboard.summaryCounts"
        [activeKey]="selectedSummaryKey()"
        (select)="toggleSummaryFilter($event)"
      />

      @if (activeSummaryCount(); as selectedCount) {
        <section class="active-filter" aria-label="Active My Work filter">
          <span>Queue focus: {{ selectedCount.label }}</span>
          <a [routerLink]="['/work-items']" [queryParams]="selectedCount.query">Open full list</a>
          <button type="button" (click)="clearSummaryFilter()">Clear</button>
        </section>
      }

      <app-daily-queue
        [items]="visibleAttentionQueue()"
        [heading]="queueHeading()"
        [emptyTitle]="queueEmptyTitle()"
        [emptyMessage]="queueEmptyMessage()"
      />

      <section class="dashboard-grid" aria-label="Secondary My Work sections">
        @for (section of secondarySections(); track section.key) {
          <section class="work-panel" [attr.aria-labelledby]="section.key + '-heading'">
            <div class="panel-heading">
              <h2 [id]="section.key + '-heading'">{{ section.heading }}</h2>
              <span>{{ section.items.length }}</span>
            </div>

            @if (section.items.length === 0) {
              <div class="compact-empty">
                <strong>{{ section.emptyTitle }}</strong>
                <span>{{ section.emptyMessage }}</span>
              </div>
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
                        @if (item.openBlockerCount > 0) {
                          <span class="dependency-pill">Blocked by {{ item.openBlockerCount }}</span>
                        }
                        @if (item.openBlockedWorkCount > 0) {
                          <span class="dependency-pill">Blocks {{ item.openBlockedWorkCount }}</span>
                        }
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

    .header-action:hover,
    .active-filter a:hover,
    .active-filter button:hover {
      border-color: #94a3b8;
      background: #f8fafc;
      cursor: pointer;
    }

    .active-filter {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      margin-bottom: 14px;
      color: #334155;
      font-size: 0.8125rem;
      font-weight: 800;
    }

    .active-filter span,
    .active-filter a,
    .active-filter button {
      min-height: 30px;
      border: 1px solid #cbd5e1;
      border-radius: 999px;
      padding: 5px 10px;
      background: #ffffff;
      color: #334155;
      font: inherit;
      text-decoration: none;
    }

    .dashboard-grid {
      display: grid;
      gap: 18px;
      margin-top: 18px;
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
      gap: 8px;
    }

    .work-row {
      display: grid;
      grid-template-columns: minmax(260px, 2fr) minmax(120px, 0.8fr) minmax(110px, 0.7fr) minmax(160px, 1fr) minmax(150px, 1fr) minmax(110px, 0.7fr);
      gap: 12px;
      align-items: center;
      border: 1px solid #eef2f7;
      border-radius: 8px;
      padding: 12px;
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

    .compact-empty {
      display: grid;
      gap: 4px;
      border: 1px dashed #cbd5e1;
      border-radius: 8px;
      padding: 12px;
      background: #f8fafc;
    }

    .compact-empty strong {
      color: #111827;
      font-size: 0.875rem;
    }

    .compact-empty span {
      color: #64748b;
      font-size: 0.8125rem;
      line-height: 1.4;
    }

    @media (max-width: 760px) {
      .page-header {
        flex-direction: column;
      }

      .work-row {
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
  readonly selectedSummaryKey = signal<MyWorkSummaryCountDto['key'] | null>(null);
  readonly activeSummaryCount = computed(() => {
    const selectedKey = this.selectedSummaryKey();
    const dashboard = this.dashboard();

    if (selectedKey === null || dashboard === null) {
      return null;
    }

    return dashboard.summaryCounts.find((count) => count.key === selectedKey) ?? null;
  });
  readonly attentionQueue = computed<DailyQueueItem[]>(() => {
    const dashboard = this.dashboard();

    if (dashboard === null) {
      return [];
    }

    const dueSoonOrOverdueIds = new Set(dashboard.dueSoonOrOverdue.map((item) => item.id));
    const dependencyBlockedIds = new Set(
      dashboard.dependencyBlockedAssigned.map((item) => item.id)
    );

    return dashboard.assignedToMe
      .map((item): DailyQueueItem | null => {
        const reasons = this.queueReasons(item, dueSoonOrOverdueIds, dependencyBlockedIds);
        return reasons.length === 0 ? null : { item, reasons };
      })
      .filter((item): item is DailyQueueItem => item !== null)
      .sort((left, right) => this.compareQueueItems(left, right));
  });
  readonly visibleAttentionQueue = computed<DailyQueueItem[]>(() => {
    const selectedKey = this.selectedSummaryKey();
    const queue = this.attentionQueue();

    if (selectedKey === null || selectedKey === 'assigned_open') {
      return queue;
    }

    if (selectedKey === 'reported_open') {
      return [];
    }

    return queue.filter((queueItem) =>
      queueItem.reasons.some((reason) => reason.key === selectedKey)
    );
  });
  readonly secondarySections = computed<SecondaryWorkSection[]>(() => {
    const dashboard = this.dashboard();

    if (dashboard === null) {
      return [];
    }

    const queueIds = new Set(this.attentionQueue().map((queueItem) => queueItem.item.id));
    const reportedByMe = this.withoutIds(dashboard.reportedByMe, queueIds);
    const reportedIds = new Set(reportedByMe.map((item) => item.id));
    const recentlyUpdated = this.withoutIds(dashboard.recentlyUpdated, new Set([...queueIds, ...reportedIds]));

    return [
      {
        key: 'reported-by-me',
        heading: 'Reported by me',
        emptyTitle: 'No reported open work',
        emptyMessage: 'Open work reported by this member will appear here.',
        items: reportedByMe
      },
      {
        key: 'recently-updated',
        heading: 'Recently updated',
        emptyTitle: 'No recent work',
        emptyMessage: 'Recently updated assigned or reported work will appear here.',
        items: recentlyUpdated
      }
    ].filter((section) => section.key === 'reported-by-me' || section.items.length > 0);
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
        this.selectedSummaryKey.set(null);
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

  toggleSummaryFilter(key: MyWorkSummaryCountDto['key']): void {
    this.selectedSummaryKey.update((currentKey) => (currentKey === key ? null : key));
  }

  clearSummaryFilter(): void {
    this.selectedSummaryKey.set(null);
  }

  queueHeading(): string {
    const selectedKey = this.selectedSummaryKey();

    if (selectedKey === null) {
      return 'Next actions';
    }

    return activeSummaryFilterLabels[selectedKey];
  }

  queueEmptyTitle(): string {
    return this.selectedSummaryKey() === null ? 'No attention needed' : 'No matching queue items';
  }

  queueEmptyMessage(): string {
    if (this.selectedSummaryKey() === 'reported_open') {
      return 'Reported work is shown below as secondary context.';
    }

    return 'Assigned work with this attention signal will appear here.';
  }

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

  private queueReasons(
    item: WorkspaceWorkItemListItemDto,
    dueSoonOrOverdueIds: Set<string>,
    dependencyBlockedIds: Set<string>
  ): DailyQueueReason[] {
    const reasons: DailyQueueReason[] = [];

    if (dueSoonOrOverdueIds.has(item.id) && this.isOverdue(item)) {
      reasons.push({ key: 'overdue', label: 'Overdue', tone: 'critical' });
    } else if (dueSoonOrOverdueIds.has(item.id) && this.isDueSoon(item)) {
      reasons.push({ key: 'due_soon', label: 'Due soon', tone: 'warning' });
    }

    if (item.status === 'blocked') {
      reasons.push({ key: 'blocked', label: 'Blocked', tone: 'critical' });
    }

    if (dependencyBlockedIds.has(item.id) || item.dependencyBlocked || item.openBlockerCount > 0) {
      reasons.push({ key: 'dependency_blocked', label: 'Dependency blocked', tone: 'critical' });
    }

    if (this.isStaleInProgress(item)) {
      reasons.push({ key: 'stale_assigned', label: 'Stale', tone: 'warning' });
    }

    if (item.priority === 'urgent' && reasons.length === 0) {
      reasons.push({ key: 'assigned_open', label: 'Urgent priority', tone: 'warning' });
    }

    return reasons;
  }

  private compareQueueItems(left: DailyQueueItem, right: DailyQueueItem): number {
    const leftSeverity = this.queueSeverity(left);
    const rightSeverity = this.queueSeverity(right);

    if (leftSeverity !== rightSeverity) {
      return leftSeverity - rightSeverity;
    }

    const leftDueDate = left.item.dueDate ?? '9999-12-31';
    const rightDueDate = right.item.dueDate ?? '9999-12-31';
    const dueDateCompare = leftDueDate.localeCompare(rightDueDate);

    if (dueDateCompare !== 0) {
      return dueDateCompare;
    }

    const priorityCompare =
      (priorityOrder.get(left.item.priority) ?? 99) - (priorityOrder.get(right.item.priority) ?? 99);

    if (priorityCompare !== 0) {
      return priorityCompare;
    }

    return right.item.updatedAt.localeCompare(left.item.updatedAt);
  }

  private queueSeverity(queueItem: DailyQueueItem): number {
    if (queueItem.reasons.some((reason) => reason.tone === 'critical')) {
      return 0;
    }

    if (queueItem.reasons.some((reason) => reason.tone === 'warning')) {
      return 1;
    }

    return 2;
  }

  private withoutIds(
    items: WorkspaceWorkItemListItemDto[],
    ignoredIds: Set<string>
  ): WorkspaceWorkItemListItemDto[] {
    return items.filter((item) => !ignoredIds.has(item.id));
  }

  private isOverdue(item: WorkspaceWorkItemListItemDto): boolean {
    return item.dueDate !== null && item.dueDate < this.dateString(new Date());
  }

  private isDueSoon(item: WorkspaceWorkItemListItemDto): boolean {
    if (item.dueDate === null || this.isOverdue(item)) {
      return false;
    }

    return item.dueDate <= this.dateString(this.addDays(new Date(), dueSoonWindowDays));
  }

  private isStaleInProgress(item: WorkspaceWorkItemListItemDto): boolean {
    return (
      item.status === 'in_progress' &&
      new Date(item.updatedAt).getTime() < this.addDays(new Date(), -staleInProgressDays).getTime()
    );
  }

  private addDays(date: Date, days: number): Date {
    const nextDate = new Date(date.getTime());
    nextDate.setDate(nextDate.getDate() + days);
    return nextDate;
  }

  private dateString(date: Date): string {
    return date.toISOString().slice(0, 10);
  }
}
