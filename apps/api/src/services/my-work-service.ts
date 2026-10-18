import type {
  MyWorkDashboardDto,
  MyWorkSummaryCountDto,
  WorkItemQuery,
  WorkspaceWorkItemListItemDto
} from '@worktrail/contracts';

import { assertPersistence, type Persistence } from '../repositories/persistence.js';
import type { ActorContext } from '../domain/actor.js';
import {
  createRiskTimeWindow,
  isOpenWorkItemStatus,
  isOverdueDueDate,
  isDueSoonDueDate
} from '../domain/work-risk-policy.js';
import { NotFoundError } from '../errors/app-error.js';
import type { Repositories } from '../repositories/index.js';
import { toMemberDto } from './dto.js';
import { WorkItemHydrator } from './work-item-hydrator.js';
import type { WorkItemEvaluation } from '../repositories/types.js';

const dashboardLimit = 8;
const activeWorkflowStatuses = new Set(['in_progress', 'blocked']);

export interface MyWorkServiceContext {
  actor: ActorContext;
  repositories: Repositories;
  persistence: Persistence;
  clock?: () => Date;
}

export class MyWorkService {
  private readonly clock: () => Date;

  constructor(private readonly context: MyWorkServiceContext) {
    assertPersistence(context.persistence);
    this.clock = context.clock ?? (() => new Date());
  }

  async getDashboard(): Promise<MyWorkDashboardDto> {
    return this.context.persistence.readConsistent((scope) =>
      new MyWorkService({ ...this.context, ...scope }).getDashboardInScope()
    );
  }

  private async getDashboardInScope(): Promise<MyWorkDashboardDto> {
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

    const window = createRiskTimeWindow(this.clock());
    const records = await this.context.repositories.workItems.listEvaluationByWorkspace(this.context.actor.workspaceId);
    const items = records.map(record => record.workItem);
    const relevant = (item: WorkItemEvaluation) => item.assigneeId === actor.id || item.reporterId === actor.id;
    const assignedOpen = items.filter(item => item.assigneeId === actor.id && isOpenWorkItemStatus(item.status));
    const reportedOpen = items.filter(item => item.reporterId === actor.id && isOpenWorkItemStatus(item.status));
    const priority = { urgent: 4, high: 3, medium: 2, low: 1 };
    const comparePriority = (left: WorkItemEvaluation, right: WorkItemEvaluation) =>
      priority[right.priority] - priority[left.priority] || right.updatedAt.getTime() - left.updatedAt.getTime();
    // Stable sort retains the repository's project/key/number/ID tie-breakers.
    const blockedRelevant = items.filter(item => item.status === 'blocked' && relevant(item)).sort(comparePriority);
    const dependencyBlockedAssigned = assignedOpen.filter(item => item.dependencyBlocked).sort(comparePriority);
    const dueSoon = assignedOpen.filter(item => isDueSoonDueDate(item.dueDate, window.today, window.dueSoonEnd));
    const overdue = assignedOpen.filter(item => isOverdueDueDate(item.dueDate, window.today));
    const staleAssigned = assignedOpen.filter(item => activeWorkflowStatuses.has(item.status) && item.updatedAt < window.staleCutoff);
    const recentlyUpdated = items.filter(item => isOpenWorkItemStatus(item.status) && relevant(item));
    const selected = {
      assignedToMe: assignedOpen.slice(0, dashboardLimit),
      dueSoonOrOverdue: [...overdue, ...dueSoon].sort(compareByDueDateThenUpdated).slice(0, dashboardLimit),
      blockedRelevant: blockedRelevant.slice(0, dashboardLimit),
      dependencyBlockedAssigned: dependencyBlockedAssigned.slice(0, dashboardLimit),
      reportedByMe: reportedOpen.slice(0, dashboardLimit),
      recentlyUpdated: recentlyUpdated.slice(0, dashboardLimit)
    };
    const ids = [...new Set(Object.values(selected).flat().map(item => item.id))];
    const previews = await new WorkItemHydrator(this.context.repositories).workspace(
      await this.context.repositories.workItems.listWorkspaceSummariesByIds(actor.workspaceId, ids)
    );
    const byId = new Map(previews.map(item => [item.id, item]));
    const hydrate = (rows: WorkItemEvaluation[]): WorkspaceWorkItemListItemDto[] => rows.map(row => {
      const item = byId.get(row.id);
      if (!item) throw new NotFoundError('Dashboard work item not found.');
      return item;
    });

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
      assignedToMe: hydrate(selected.assignedToMe),
      dueSoonOrOverdue: hydrate(selected.dueSoonOrOverdue),
      blockedRelevant: hydrate(selected.blockedRelevant),
      dependencyBlockedAssigned: hydrate(selected.dependencyBlockedAssigned),
      reportedByMe: hydrate(selected.reportedByMe),
      recentlyUpdated: hydrate(selected.recentlyUpdated)
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

}

function compareByDueDateThenUpdated(
  left: WorkItemEvaluation,
  right: WorkItemEvaluation
): number {
  const dueDateCompare = (left.dueDate ?? '').localeCompare(right.dueDate ?? '');

  if (dueDateCompare !== 0) {
    return dueDateCompare;
  }

  return right.updatedAt.getTime() - left.updatedAt.getTime();
}
