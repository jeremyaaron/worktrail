import type { ProjectPlanningCycleSummaryDto, ProjectPlanningSummaryDto } from '@worktrail/contracts';

import type { ActorContext } from '../domain/actor.js';
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
import type { Project, WorkItem } from '../repositories/types.js';
import { DeliveryHealthService } from './delivery-health-service.js';
import { toProjectDto } from './dto.js';
import { ProjectCycleService } from './project-cycle-service.js';
import {
  compareByDueDateThenPriority,
  compareByUpdatedAsc,
  loadPlanningRiskParents,
  toPlanningRiskItems
} from './work-risk-sections.js';

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
    const now = this.clock();
    const today = toDateString(now);
    const [
      workItems,
      dependencyBlockedWorkItems,
      blockingOpenWorkItems,
      milestones,
      members,
      activeCycle,
      upcomingCycle,
      recentlyCompletedCycle
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
      this.context.repositories.members.listByWorkspace(this.context.actor.workspaceId),
      this.context.repositories.projectCycles.findActiveByProject(projectId),
      this.context.repositories.projectCycles.findUpcomingByProject(projectId, today),
      this.context.repositories.projectCycles.findRecentlyCompletedByProject(projectId, today)
    ]);

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
    const parentByChildId = await loadPlanningRiskParents(
      workItems,
      this.context.repositories
    );
    const cycleService = new ProjectCycleService({
      actor: this.context.actor,
      repositories: this.context.repositories,
      clock: this.clock
    });

    return {
      project: toProjectDto(project),
      deliveryHealth: healthSummary.deliveryHealth,
      milestoneProgress: healthSummary.milestoneProgress,
      activeCycle: await this.toCycleSummary(projectId, activeCycle?.id ?? null, cycleService),
      upcomingCycle: await this.toCycleSummary(projectId, upcomingCycle?.id ?? null, cycleService),
      recentlyCompletedCycle: await this.toCycleSummary(
        projectId,
        recentlyCompletedCycle?.id ?? null,
        cycleService
      ),
      planningReview: healthSummary.planningReview,
      blockedWork: this.toRiskItems(
        workItems.filter((workItem) => workItem.status === 'blocked'),
        memberById,
        milestoneById,
        parentByChildId
      ),
      overdueWork: this.toRiskItems(
        workItems
          .filter((workItem) => isOpenWorkItem(workItem) && isOverdue(workItem, today))
          .sort(compareByDueDateThenPriority),
        memberById,
        milestoneById,
        parentByChildId
      ),
      dueSoonWork: this.toRiskItems(
        workItems
          .filter((workItem) => isOpenWorkItem(workItem) && isDueSoon(workItem, today, dueSoonEnd))
          .sort(compareByDueDateThenPriority),
        memberById,
        milestoneById,
        parentByChildId
      ),
      unassignedActiveWork: this.toRiskItems(
        workItems.filter(
          (workItem) =>
            workItem.assigneeId === null && isActiveUnassignedWorkItemStatus(workItem.status)
        ),
        memberById,
        milestoneById,
        parentByChildId
      ),
      staleInProgressWork: this.toRiskItems(
        workItems
          .filter(
            (workItem) =>
              isStaleInProgressStatus(workItem.status, workItem.updatedAt, staleCutoff)
          )
          .sort(compareByUpdatedAsc),
        memberById,
        milestoneById,
        parentByChildId
      ),
      dependencyBlockedWork: this.toRiskItems(
        dependencyBlockedWorkItems.filter((workItem) => isOpenWorkItem(workItem)),
        memberById,
        milestoneById,
        parentByChildId
      ),
      blockingOpenWork: this.toRiskItems(
        blockingOpenWorkItems.filter((workItem) => isOpenWorkItem(workItem)),
        memberById,
        milestoneById,
        parentByChildId
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

  private readonly toRiskItems = toPlanningRiskItems;

  private async toCycleSummary(
    projectId: string,
    cycleId: string | null,
    cycleService: ProjectCycleService
  ): Promise<ProjectPlanningCycleSummaryDto | null> {
    if (cycleId === null) {
      return null;
    }

    const review = await cycleService.getCycleReview(projectId, cycleId);

    return {
      cycle: review.cycle,
      progress: review.progress,
      health: review.health,
      scopedWorkQuery: review.scopedWorkQuery,
      closeout:
        review.closeout === null
          ? null
          : {
              closedAt: review.closeout.closedAt,
              closedBy: {
                id: review.closeout.closedBy.id,
                name: review.closeout.closedBy.name
              },
              counts: review.closeout.snapshot.counts,
              destination: review.closeout.snapshot.destination
            }
    };
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
