import type {
  MyWorkDashboardDto,
  MyWorkSummaryCountDto,
  WorkItemQuery,
  WorkspaceWorkItemListItemDto
} from '@worktrail/contracts';

import type { ActorContext } from '../domain/actor.js';
import {
  addDays,
  dueSoonWindowDays,
  staleInProgressDays,
  toDateString
} from '../domain/work-risk-policy.js';
import { NotFoundError } from '../errors/app-error.js';
import type { Repositories } from '../repositories/index.js';
import { toMemberDto } from './dto.js';
import { WorkItemService } from './work-item-service.js';

const dashboardLimit = 8;
const activeWorkflowStatuses = new Set(['in_progress', 'blocked']);

export interface MyWorkServiceContext {
  actor: ActorContext;
  repositories: Repositories;
  clock?: () => Date;
}

export class MyWorkService {
  private readonly clock: () => Date;
  private readonly workItems: WorkItemService;

  constructor(private readonly context: MyWorkServiceContext) {
    this.clock = context.clock ?? (() => new Date());
    this.workItems = new WorkItemService({
      actor: context.actor,
      repositories: context.repositories
    });
  }

  async getDashboard(): Promise<MyWorkDashboardDto> {
    const actor = await this.context.repositories.members.findById(this.context.actor.memberId);

    if (actor === null || actor.workspaceId !== this.context.actor.workspaceId) {
      throw new NotFoundError('Actor not found.');
    }

    const assignedOpenQuery = this.withDefaults({
      assigneeId: this.context.actor.memberId,
      workState: 'open',
      sort: 'updated_desc'
    });
    const reportedOpenQuery = this.withDefaults({
      reporterId: this.context.actor.memberId,
      workState: 'open',
      sort: 'updated_desc'
    });
    const blockedQuery = this.withDefaults({
      blocked: true,
      sort: 'priority_desc'
    });
    const dependencyBlockedAssignedQuery = this.withDefaults({
      assigneeId: this.context.actor.memberId,
      workState: 'open',
      dependency: 'dependency_blocked',
      sort: 'priority_desc'
    });
    const recentlyUpdatedQuery = this.withDefaults({
      workState: 'open',
      sort: 'updated_desc'
    });

    const [
      assignedOpen,
      reportedOpen,
      blockedWork,
      dependencyBlockedAssigned,
      recentlyUpdatedOpen
    ] = await Promise.all([
      this.workItems.listWorkspaceWorkItems(assignedOpenQuery),
      this.workItems.listWorkspaceWorkItems(reportedOpenQuery),
      this.workItems.listWorkspaceWorkItems(blockedQuery),
      this.workItems.listWorkspaceWorkItems(dependencyBlockedAssignedQuery),
      this.workItems.listWorkspaceWorkItems(recentlyUpdatedQuery)
    ]);

    const dueSoon = assignedOpen.filter((item) => this.isDueSoon(item));
    const overdue = assignedOpen.filter((item) => this.isOverdue(item));
    const staleAssigned = assignedOpen.filter((item) => this.isStaleAssigned(item));
    const blockedRelevant = blockedWork.filter((item) => this.isRelevantToActor(item));
    const recentlyUpdated = recentlyUpdatedOpen.filter((item) => this.isRelevantToActor(item));

    return {
      actor: toMemberDto(actor),
      summaryCounts: [
        this.toSummaryCount('assigned_open', 'Assigned open', assignedOpen.length, assignedOpenQuery),
        this.toSummaryCount(
          'due_soon',
          'Due soon',
          dueSoon.length,
          this.withDefaults({
            assigneeId: this.context.actor.memberId,
            dueDateState: 'due_soon',
            sort: 'due_date_asc'
          })
        ),
        this.toSummaryCount(
          'overdue',
          'Overdue',
          overdue.length,
          this.withDefaults({
            assigneeId: this.context.actor.memberId,
            dueDateState: 'overdue',
            sort: 'due_date_asc'
          })
        ),
        this.toSummaryCount('blocked', 'Blocked', blockedRelevant.length, blockedQuery),
        this.toSummaryCount(
          'dependency_blocked',
          'Dependency blocked',
          dependencyBlockedAssigned.length,
          dependencyBlockedAssignedQuery
        ),
        this.toSummaryCount(
          'stale_assigned',
          'Stale assigned',
          staleAssigned.length,
          this.withDefaults({
            assigneeId: this.context.actor.memberId,
            workState: 'open',
            sort: 'updated_asc'
          })
        ),
        this.toSummaryCount('reported_open', 'Reported open', reportedOpen.length, reportedOpenQuery)
      ],
      assignedToMe: assignedOpen.slice(0, dashboardLimit),
      dueSoonOrOverdue: [...overdue, ...dueSoon]
        .sort(compareByDueDateThenUpdated)
        .slice(0, dashboardLimit),
      blockedRelevant: blockedRelevant.slice(0, dashboardLimit),
      dependencyBlockedAssigned: dependencyBlockedAssigned.slice(0, dashboardLimit),
      reportedByMe: reportedOpen.slice(0, dashboardLimit),
      recentlyUpdated: recentlyUpdated.slice(0, dashboardLimit)
    };
  }

  private withDefaults(query: WorkItemQuery): WorkItemQuery {
    return {
      archivedProjects: 'exclude',
      ...query
    };
  }

  private toSummaryCount(
    key: MyWorkSummaryCountDto['key'],
    label: string,
    count: number,
    query: WorkItemQuery
  ): MyWorkSummaryCountDto {
    return { key, label, count, query };
  }

  private isRelevantToActor(item: WorkspaceWorkItemListItemDto): boolean {
    return item.assignee?.id === this.context.actor.memberId || item.reporter.id === this.context.actor.memberId;
  }

  private isDueSoon(item: WorkspaceWorkItemListItemDto): boolean {
    if (item.dueDate === null || this.isOverdue(item)) {
      return false;
    }

    const dueSoonEnd = toDateString(addDays(this.clock(), dueSoonWindowDays));
    return item.dueDate <= dueSoonEnd;
  }

  private isOverdue(item: WorkspaceWorkItemListItemDto): boolean {
    return item.dueDate !== null && item.dueDate < toDateString(this.clock());
  }

  private isStaleAssigned(item: WorkspaceWorkItemListItemDto): boolean {
    if (!activeWorkflowStatuses.has(item.status)) {
      return false;
    }

    return new Date(item.updatedAt).getTime() < addDays(this.clock(), -staleInProgressDays).getTime();
  }
}

function compareByDueDateThenUpdated(
  left: WorkspaceWorkItemListItemDto,
  right: WorkspaceWorkItemListItemDto
): number {
  const dueDateCompare = (left.dueDate ?? '').localeCompare(right.dueDate ?? '');

  if (dueDateCompare !== 0) {
    return dueDateCompare;
  }

  return right.updatedAt.localeCompare(left.updatedAt);
}
