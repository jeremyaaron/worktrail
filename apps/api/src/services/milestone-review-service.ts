import type {
  MilestoneProgressDto,
  MilestoneReviewDto,
  MilestoneReviewScopeBreakdownDto,
  WorkItemPriority,
  WorkItemStatus
} from '@worktrail/contracts';

import { assertPersistence, type Persistence } from '../repositories/persistence.js';
import type { ActorContext } from '../domain/actor.js';
import {
  workItemPriorities,
  workItemStatuses
} from '../domain/constants.js';
import {
  isDueSoonDueDate,
  isOpenWorkItemStatus,
  isOverdueDueDate,
} from '../domain/work-risk-policy.js';
import { NotFoundError } from '../errors/app-error.js';
import type { Repositories } from '../repositories/index.js';
import type { Milestone, Project, WorkItemEvaluationFacts } from '../repositories/types.js';
import { DeliveryHealthService } from './delivery-health-service.js';
import { toMilestoneDto, toProjectDto } from './dto.js';
import {
  selectMilestoneReviewRiskSections,
  riskContextFromEvaluation,
  loadRiskReferences,
  enrichRiskItems
} from './work-risk-sections.js';

const recentMovementLimit = 8;

export interface MilestoneReviewServiceContext {
  actor: ActorContext;
  repositories: Repositories;
  persistence: Persistence;
  clock?: () => Date;
}

export class MilestoneReviewService {
  private readonly clock: () => Date;

  constructor(private readonly context: MilestoneReviewServiceContext) {
    assertPersistence(context.persistence);
    this.clock = context.clock ?? (() => new Date());
  }

  async getMilestoneReview(
    projectId: string,
    milestoneId: string
  ): Promise<MilestoneReviewDto> {
    return this.context.persistence.readConsistent((scope) =>
      new MilestoneReviewService({ ...this.context, ...scope }).getMilestoneReviewInScope(projectId, milestoneId)
    );
  }

  private async getMilestoneReviewInScope(
    projectId: string,
    milestoneId: string
  ): Promise<MilestoneReviewDto> {
    const project = await this.requireProject(projectId);
    const workItems = await this.context.repositories.workItems.listEvaluationByProject(projectId);
    const dependencyBlockedWorkItems = workItems.filter(item => item.dependencyBlocked);
    const blockingOpenWorkItems = workItems.filter(item => item.blockingOpenWork);
    const milestones = await this.context.repositories.milestones.listByProject(projectId, { includeArchived: true });
    const milestone = milestones.find((item) => item.id === milestoneId);

    if (milestone === undefined || milestone.projectId !== projectId) {
      throw new NotFoundError('Milestone not found.');
    }

    const now = this.clock();
    const evaluationContext = riskContextFromEvaluation(workItems, now);
    const healthSummary = new DeliveryHealthService().derive({
      project,
      workItems,
      dependencyBlockedWorkItems,
      blockingOpenWorkItems,
      milestones,
      now,
      evaluationContext
    });
    const scopedWorkItems = workItems.filter(item => item.milestoneId === milestoneId);
    const sections = selectMilestoneReviewRiskSections({ milestoneId, workItems: scopedWorkItems, context: evaluationContext });
    const recent = [...scopedWorkItems].sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime()).slice(0, recentMovementLimit);
    const references = await loadRiskReferences([...sections.flatMap(section => section.items), ...recent], this.context.repositories);
    const progress =
      healthSummary.milestoneProgress.find((item) => item.milestone.id === milestoneId) ??
      createEmptyMilestoneProgress(milestone);

    return {
      project: toProjectDto(project),
      milestone: toMilestoneDto(milestone),
      progress,
      scopedWorkQuery: {
        milestoneId,
        sort: 'priority_desc'
      },
      scopeBreakdown: createScopeBreakdown(scopedWorkItems, evaluationContext),
      riskSections: sections.map(section => ({ ...section, items: enrichRiskItems(section.items, references) })),
      recentlyChangedWork: enrichRiskItems(recent, references)
    };
  }

  private async requireProject(projectId: string): Promise<Project> {
    const project = await this.context.repositories.projects.findById(projectId);

    if (project === null || project.workspaceId !== this.context.actor.workspaceId) {
      throw new NotFoundError('Project not found.');
    }

    return project;
  }
}

function createEmptyMilestoneProgress(milestone: Milestone): MilestoneProgressDto {
  return {
    milestone: toMilestoneDto(milestone),
    totalCount: 0,
    doneCount: 0,
    openCount: 0,
    blockedCount: 0,
    dependencyBlockedCount: 0,
    overdueCount: 0,
    dueSoonCount: 0,
    unassignedActiveCount: 0,
    staleInProgressCount: 0,
    health: 'inactive',
    reasons: []
  };
}

function createScopeBreakdown(
  scopedWorkItems: WorkItemEvaluationFacts[],
  context: ReturnType<typeof riskContextFromEvaluation>
): MilestoneReviewScopeBreakdownDto {
  const statusCounts = Object.fromEntries(
    workItemStatuses.map((status) => [status, 0])
  ) as Record<WorkItemStatus, number>;
  const priorityCounts = Object.fromEntries(
    workItemPriorities.map((priority) => [priority, 0])
  ) as Record<WorkItemPriority, number>;
  const dueDate = {
    overdueCount: 0,
    dueSoonCount: 0,
    laterCount: 0,
    noneCount: 0
  };
  let assignedCount = 0;
  let unassignedCount = 0;
  let dependencyBlockedCount = 0;
  let blockingOpenWorkCount = 0;

  for (const workItem of scopedWorkItems) {
    statusCounts[workItem.status] += 1;
    priorityCounts[workItem.priority] += 1;

    if (workItem.assigneeId === null) {
      unassignedCount += 1;
    } else {
      assignedCount += 1;
    }

    if (workItem.dueDate === null) {
      dueDate.noneCount += 1;
    } else if (isOpenWorkItem(workItem) && isOverdueDueDate(workItem.dueDate, context.today)) {
      dueDate.overdueCount += 1;
    } else if (
      isOpenWorkItem(workItem) &&
      isDueSoonDueDate(workItem.dueDate, context.today, context.dueSoonEnd)
    ) {
      dueDate.dueSoonCount += 1;
    } else {
      dueDate.laterCount += 1;
    }

    if (isOpenWorkItem(workItem) && context.dependencyBlockedIds.has(workItem.id)) {
      dependencyBlockedCount += 1;
    }

    if (isOpenWorkItem(workItem) && context.blockingOpenWorkIds.has(workItem.id)) {
      blockingOpenWorkCount += 1;
    }
  }

  return {
    statusCounts,
    priorityCounts,
    assignedCount,
    unassignedCount,
    dueDate,
    dependency: {
      dependencyBlockedCount,
      blockingOpenWorkCount
    }
  };
}

function isOpenWorkItem(workItem: WorkItemEvaluationFacts): boolean {
  return isOpenWorkItemStatus(workItem.status);
}
