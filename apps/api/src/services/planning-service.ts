import type {
  PlanningRiskItemDto,
  ProjectPlanningSummaryDto
} from '@worktrail/contracts';

import type { ActorContext } from '../domain/actor.js';
import type { WorkItemPriority } from '../domain/constants.js';
import {
  addDays,
  dueSoonWindowDays,
  isActiveUnassignedWorkItemStatus,
  isDueSoonDueDate,
  isOpenWorkItemStatus,
  isOverdueDueDate,
  isStaleInProgressStatus,
  staleInProgressDays,
  toDateString
} from '../domain/work-risk-policy.js';
import { NotFoundError } from '../errors/app-error.js';
import type { Repositories } from '../repositories/index.js';
import type { Member, Milestone, Project, WorkItem } from '../repositories/types.js';
import { DeliveryHealthService } from './delivery-health-service.js';
import { toMemberDto, toMilestoneDto, toProjectDto } from './dto.js';

const priorityRank: Record<WorkItemPriority, number> = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1
};

export interface PlanningServiceContext {
  actor: ActorContext;
  repositories: Repositories;
  clock?: () => Date;
}

export class PlanningService {
  private readonly clock: () => Date;

  constructor(private readonly context: PlanningServiceContext) {
    this.clock = context.clock ?? (() => new Date());
  }

  async getProjectPlanningSummary(projectId: string): Promise<ProjectPlanningSummaryDto> {
    const project = await this.requireProject(projectId);
    const [
      workItems,
      dependencyBlockedWorkItems,
      blockingOpenWorkItems,
      milestones,
      members
    ] = await Promise.all([
      this.context.repositories.workItems.listByProject(projectId, { sort: 'board_order' }),
      this.context.repositories.workItems.listByProject(projectId, {
        dependency: 'dependency_blocked',
        sort: 'priority_desc'
      }),
      this.context.repositories.workItems.listByProject(projectId, {
        dependency: 'blocking_open_work',
        sort: 'priority_desc'
      }),
      this.context.repositories.milestones.listByProject(projectId, { includeArchived: true }),
      this.context.repositories.members.listByWorkspace(this.context.actor.workspaceId)
    ]);

    const now = this.clock();
    const today = toDateString(now);
    const dueSoonEnd = toDateString(addDays(now, dueSoonWindowDays));
    const staleCutoff = addDays(now, -staleInProgressDays);
    const healthSummary = new DeliveryHealthService().derive({
      project,
      workItems,
      dependencyBlockedWorkItems,
      blockingOpenWorkItems,
      milestones,
      now
    });
    const memberById = new Map(members.map((member) => [member.id, member]));
    const milestoneById = new Map(milestones.map((milestone) => [milestone.id, milestone]));

    return {
      project: toProjectDto(project),
      deliveryHealth: healthSummary.deliveryHealth,
      milestoneProgress: healthSummary.milestoneProgress,
      planningReview: healthSummary.planningReview,
      blockedWork: this.toRiskItems(
        workItems.filter((workItem) => workItem.status === 'blocked'),
        memberById,
        milestoneById
      ),
      overdueWork: this.toRiskItems(
        workItems
          .filter((workItem) => isOpenWorkItem(workItem) && isOverdue(workItem, today))
          .sort(compareByDueDateThenPriority),
        memberById,
        milestoneById
      ),
      dueSoonWork: this.toRiskItems(
        workItems
          .filter((workItem) => isOpenWorkItem(workItem) && isDueSoon(workItem, today, dueSoonEnd))
          .sort(compareByDueDateThenPriority),
        memberById,
        milestoneById
      ),
      unassignedActiveWork: this.toRiskItems(
        workItems.filter(
          (workItem) =>
            workItem.assigneeId === null && isActiveUnassignedWorkItemStatus(workItem.status)
        ),
        memberById,
        milestoneById
      ),
      staleInProgressWork: this.toRiskItems(
        workItems
          .filter(
            (workItem) =>
              isStaleInProgressStatus(workItem.status, workItem.updatedAt, staleCutoff)
          )
          .sort((left, right) => left.updatedAt.getTime() - right.updatedAt.getTime()),
        memberById,
        milestoneById
      ),
      dependencyBlockedWork: this.toRiskItems(
        dependencyBlockedWorkItems.filter((workItem) => isOpenWorkItem(workItem)),
        memberById,
        milestoneById
      ),
      blockingOpenWork: this.toRiskItems(
        blockingOpenWorkItems.filter((workItem) => isOpenWorkItem(workItem)),
        memberById,
        milestoneById
      )
    };
  }

  private async requireProject(projectId: string): Promise<Project> {
    const project = await this.context.repositories.projects.findById(projectId);

    if (project === null || project.workspaceId !== this.context.actor.workspaceId) {
      throw new NotFoundError('Project not found.');
    }

    return project;
  }

  private toRiskItems(
    workItems: WorkItem[],
    memberById: Map<string, Member>,
    milestoneById: Map<string, Milestone>
  ): PlanningRiskItemDto[] {
    return workItems.map((workItem) => {
      const assignee =
        workItem.assigneeId === null ? null : memberById.get(workItem.assigneeId) ?? null;
      const milestone =
        workItem.milestoneId === null ? null : milestoneById.get(workItem.milestoneId) ?? null;

      return {
        id: workItem.id,
        displayKey: workItem.displayKey,
        title: workItem.title,
        status: workItem.status,
        priority: workItem.priority,
        assignee: assignee === null ? null : toMemberDto(assignee),
        dueDate: workItem.dueDate,
        milestone: milestone === null ? null : toMilestoneDto(milestone),
        updatedAt: workItem.updatedAt.toISOString()
      };
    });
  }
}

function isOpenWorkItem(workItem: WorkItem): boolean {
  return isOpenWorkItemStatus(workItem.status);
}

function isOverdue(workItem: WorkItem, today: string): boolean {
  return isOverdueDueDate(workItem.dueDate, today);
}

function isDueSoon(workItem: WorkItem, today: string, dueSoonEnd: string): boolean {
  return isDueSoonDueDate(workItem.dueDate, today, dueSoonEnd);
}

function compareByDueDateThenPriority(left: WorkItem, right: WorkItem): number {
  const dueDateCompare = (left.dueDate ?? '').localeCompare(right.dueDate ?? '');

  if (dueDateCompare !== 0) {
    return dueDateCompare;
  }

  return priorityRank[right.priority] - priorityRank[left.priority];
}
