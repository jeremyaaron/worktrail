import type {
  MilestoneProgressDto,
  PlanningRiskItemDto,
  ProjectPlanningSummaryDto
} from '@worktrail/contracts';

import type { ActorContext } from '../domain/actor.js';
import type { WorkItemPriority } from '../domain/constants.js';
import { openWorkItemStatuses, terminalWorkItemStatuses } from '../domain/constants.js';
import { NotFoundError } from '../errors/app-error.js';
import type { Repositories } from '../repositories/index.js';
import type { Member, Milestone, Project, WorkItem } from '../repositories/types.js';
import { toMemberDto, toMilestoneDto, toProjectDto } from './dto.js';

const dueSoonWindowDays = 7;
const staleInProgressDays = 7;
const planningMilestoneStatuses = new Set<Milestone['status']>(['planned', 'active']);
const activeUnassignedStatuses = new Set<WorkItem['status']>(['ready', 'in_progress']);
const openStatusSet = new Set<WorkItem['status']>(openWorkItemStatuses);
const terminalStatusSet = new Set<WorkItem['status']>(terminalWorkItemStatuses);
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
    const [workItems, milestones, members] = await Promise.all([
      this.context.repositories.workItems.listByProject(projectId, { sort: 'board_order' }),
      this.context.repositories.milestones.listByProject(projectId, { includeArchived: true }),
      this.context.repositories.members.listByWorkspace(this.context.actor.workspaceId)
    ]);

    const today = toDateString(this.clock());
    const dueSoonEnd = toDateString(addDays(this.clock(), dueSoonWindowDays));
    const staleCutoff = addDays(this.clock(), -staleInProgressDays);
    const memberById = new Map(members.map((member) => [member.id, member]));
    const milestoneById = new Map(milestones.map((milestone) => [milestone.id, milestone]));

    return {
      project: toProjectDto(project),
      milestoneProgress: this.getMilestoneProgress(workItems, milestones, today),
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
            workItem.assigneeId === null && activeUnassignedStatuses.has(workItem.status)
        ),
        memberById,
        milestoneById
      ),
      staleInProgressWork: this.toRiskItems(
        workItems
          .filter(
            (workItem) =>
              workItem.status === 'in_progress' && workItem.updatedAt.getTime() < staleCutoff.getTime()
          )
          .sort((left, right) => left.updatedAt.getTime() - right.updatedAt.getTime()),
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

  private getMilestoneProgress(
    workItems: WorkItem[],
    milestones: Milestone[],
    today: string
  ): MilestoneProgressDto[] {
    return milestones
      .filter(
        (milestone) =>
          milestone.archivedAt === null && planningMilestoneStatuses.has(milestone.status)
      )
      .map((milestone) => {
        const assignedItems = workItems.filter((workItem) => workItem.milestoneId === milestone.id);

        return {
          milestone: toMilestoneDto(milestone),
          totalCount: assignedItems.length,
          doneCount: assignedItems.filter((workItem) => workItem.status === 'done').length,
          blockedCount: assignedItems.filter((workItem) => workItem.status === 'blocked').length,
          overdueCount: assignedItems.filter(
            (workItem) => isOpenWorkItem(workItem) && isOverdue(workItem, today)
          ).length
        };
      });
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
  return openStatusSet.has(workItem.status) && !terminalStatusSet.has(workItem.status);
}

function isOverdue(workItem: WorkItem, today: string): boolean {
  return workItem.dueDate !== null && workItem.dueDate < today;
}

function isDueSoon(workItem: WorkItem, today: string, dueSoonEnd: string): boolean {
  return workItem.dueDate !== null && workItem.dueDate >= today && workItem.dueDate <= dueSoonEnd;
}

function compareByDueDateThenPriority(left: WorkItem, right: WorkItem): number {
  const dueDateCompare = (left.dueDate ?? '').localeCompare(right.dueDate ?? '');

  if (dueDateCompare !== 0) {
    return dueDateCompare;
  }

  return priorityRank[right.priority] - priorityRank[left.priority];
}

function addDays(date: Date, days: number): Date {
  const nextDate = new Date(date.getTime());
  nextDate.setUTCDate(nextDate.getUTCDate() + days);
  return nextDate;
}

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}
