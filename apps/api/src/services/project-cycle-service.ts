import type {
  CreateProjectCycleRequest,
  CycleReviewProgressDto,
  CycleReviewScopeBreakdownDto,
  DeliveryHealthReasonDto,
  DeliveryHealthState,
  ProjectCycleDto,
  ProjectCycleReviewDto,
  ProjectCycleStatus,
  UpdateProjectCycleRequest,
  WorkItemPriority,
  WorkItemStatus
} from '@worktrail/contracts';
import { randomUUID } from 'node:crypto';

import type { WorktrailDb } from '../db/client.js';
import type { ActorContext } from '../domain/actor.js';
import { workItemPriorities, workItemStatuses } from '../domain/constants.js';
import { canManageProjectCycles } from '../domain/permissions.js';
import {
  isActiveUnassignedWorkItemStatus,
  isDueSoonDueDate,
  isOpenWorkItemStatus,
  isOverdueDueDate,
  isStaleInProgressStatus
} from '../domain/work-risk-policy.js';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../errors/app-error.js';
import {
  type Repositories,
  withRepositoriesTransaction
} from '../repositories/index.js';
import type { Project, ProjectCycle, WorkItem } from '../repositories/types.js';
import {
  createProjectCycleSchema,
  type ProjectCycleListQuery,
  updateProjectCycleSchema
} from '../validation/project-cycle.js';
import { parseWithSchema } from '../validation/parse.js';
import { toProjectCycleDto, toProjectDto } from './dto.js';
import {
  createCycleReviewRiskSections,
  createWorkRiskEvaluationContext,
  toPlanningRiskItems,
  type WorkRiskEvaluationContext
} from './work-risk-sections.js';

export type ProjectCycleListOptions = ProjectCycleListQuery;

export interface ProjectCycleServiceContext {
  actor: ActorContext;
  repositories: Repositories;
  db?: WorktrailDb;
  clock?: () => Date;
  idGenerator?: () => string;
}

interface ResolvedCycleWindow {
  status: ProjectCycleStatus;
  startDate: string;
  endDate: string;
}

const recentMovementLimit = 8;

export class ProjectCycleService {
  private readonly clock: () => Date;
  private readonly idGenerator: () => string;

  constructor(private readonly context: ProjectCycleServiceContext) {
    this.clock = context.clock ?? (() => new Date());
    this.idGenerator = context.idGenerator ?? randomUUID;
  }

  async listProjectCycles(
    projectId: string,
    options: ProjectCycleListOptions = {}
  ): Promise<ProjectCycleDto[]> {
    await this.requireProject(projectId, this.context.repositories);
    const cycles = await this.context.repositories.projectCycles.listByProject(projectId, options);
    return cycles.map(toProjectCycleDto);
  }

  async getProjectCycle(projectId: string, cycleId: string): Promise<ProjectCycleDto> {
    await this.requireProject(projectId, this.context.repositories);
    const cycle = await this.requireProjectCycle(projectId, cycleId, this.context.repositories);
    return toProjectCycleDto(cycle);
  }

  async getCycleReview(projectId: string, cycleId: string): Promise<ProjectCycleReviewDto> {
    const project = await this.requireProject(projectId, this.context.repositories);
    const cycle = await this.requireProjectCycle(projectId, cycleId, this.context.repositories);
    const workItems = await this.context.repositories.workItems.listByProject(projectId, {
      sort: 'board_order'
    });
    const dependencyBlockedWorkItems = await this.context.repositories.workItems.listByProject(
      projectId,
      {
        dependency: 'dependency_blocked',
        sort: 'priority_desc'
      }
    );
    const blockingOpenWorkItems = await this.context.repositories.workItems.listByProject(
      projectId,
      {
        dependency: 'blocking_open_work',
        sort: 'priority_desc'
      }
    );
    const milestones = await this.context.repositories.milestones.listByProject(projectId, {
      includeArchived: true
    });
    const members = await this.context.repositories.members.listByWorkspace(
      this.context.actor.workspaceId
    );
    const scopedWorkItems = workItems.filter((workItem) => workItem.cycleId === cycleId);
    const now = this.clock();
    const evaluationContext = createWorkRiskEvaluationContext({
      now,
      dependencyBlockedWorkItems,
      blockingOpenWorkItems
    });
    const memberById = new Map(members.map((member) => [member.id, member]));
    const milestoneById = new Map(milestones.map((milestone) => [milestone.id, milestone]));
    const progress = createCycleProgress(cycle, scopedWorkItems, evaluationContext);
    const health = createCycleHealth(cycle, progress, scopedWorkItems, evaluationContext);

    return {
      project: toProjectDto(project),
      cycle: toProjectCycleDto(cycle),
      progress,
      health,
      scopedWorkQuery: {
        cycleId,
        sort: 'priority_desc'
      },
      scopeBreakdown: createCycleScopeBreakdown(scopedWorkItems, evaluationContext),
      riskSections: createCycleReviewRiskSections({
        cycleId,
        workItems: scopedWorkItems,
        memberById,
        milestoneById,
        context: evaluationContext,
        isOverTarget: isCycleOverTarget(progress)
      }),
      recentlyChangedWork: toPlanningRiskItems(
        [...scopedWorkItems]
          .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime())
          .slice(0, recentMovementLimit),
        memberById,
        milestoneById
      )
    };
  }

  async createProjectCycle(
    projectId: string,
    input: CreateProjectCycleRequest
  ): Promise<ProjectCycleDto> {
    const body = parseWithSchema(createProjectCycleSchema, input);

    return this.withWriteRepositories(async (repositories) => {
      this.assertCanManageCycles();
      const project = await this.requireProject(projectId, repositories);
      this.assertProjectWritable(project);

      const status = body.status ?? 'planned';
      await this.requireAvailableName(projectId, body.name, undefined, repositories);
      await this.requireLifecycleAvailable(
        projectId,
        {
          status,
          startDate: body.startDate,
          endDate: body.endDate
        },
        undefined,
        repositories
      );

      const timestamp = this.clock();
      const cycle = await repositories.projectCycles.create({
        id: this.idGenerator(),
        workspaceId: project.workspaceId,
        projectId,
        name: body.name,
        goal: body.goal ?? '',
        status,
        startDate: body.startDate,
        endDate: body.endDate,
        targetPoints: body.targetPoints ?? null,
        archivedAt: null,
        archivedById: null,
        createdAt: timestamp,
        updatedAt: timestamp
      });

      return toProjectCycleDto(cycle);
    });
  }

  async updateProjectCycle(
    projectId: string,
    cycleId: string,
    input: UpdateProjectCycleRequest
  ): Promise<ProjectCycleDto> {
    const body = parseWithSchema(updateProjectCycleSchema, input);

    return this.withWriteRepositories(async (repositories) => {
      this.assertCanManageCycles();
      const current = await this.requireProjectCycle(projectId, cycleId, repositories);
      const project = await this.requireProject(projectId, repositories);
      this.assertProjectWritable(project);
      this.assertCycleWritable(current);

      const nextWindow = this.resolveCycleWindow(current, body);

      if (body.name !== undefined && body.name.toLowerCase() !== current.name.toLowerCase()) {
        await this.requireAvailableName(projectId, body.name, current.id, repositories);
      }

      await this.requireLifecycleAvailable(projectId, nextWindow, current.id, repositories);

      const timestamp = this.clock();
      const updated = await repositories.projectCycles.update(cycleId, {
        ...(body.name === undefined ? {} : { name: body.name }),
        ...(body.goal === undefined ? {} : { goal: body.goal }),
        ...(body.status === undefined ? {} : { status: body.status }),
        ...(body.startDate === undefined ? {} : { startDate: body.startDate }),
        ...(body.endDate === undefined ? {} : { endDate: body.endDate }),
        ...(body.targetPoints === undefined ? {} : { targetPoints: body.targetPoints }),
        updatedAt: timestamp
      });

      if (updated === null) {
        throw new NotFoundError('Project cycle not found.');
      }

      return toProjectCycleDto(updated);
    });
  }

  async archiveProjectCycle(projectId: string, cycleId: string): Promise<ProjectCycleDto> {
    return this.withWriteRepositories(async (repositories) => {
      this.assertCanManageCycles();
      const current = await this.requireProjectCycle(projectId, cycleId, repositories);
      const project = await this.requireProject(projectId, repositories);
      this.assertProjectWritable(project);

      if (current.archivedAt !== null) {
        return toProjectCycleDto(current);
      }

      const timestamp = this.clock();
      const archived = await repositories.projectCycles.archive(
        cycleId,
        timestamp,
        this.context.actor.memberId
      );

      if (archived === null) {
        throw new NotFoundError('Project cycle not found.');
      }

      return toProjectCycleDto(archived);
    });
  }

  async reactivateProjectCycle(projectId: string, cycleId: string): Promise<ProjectCycleDto> {
    return this.withWriteRepositories(async (repositories) => {
      this.assertCanManageCycles();
      const current = await this.requireProjectCycle(projectId, cycleId, repositories);
      const project = await this.requireProject(projectId, repositories);
      this.assertProjectWritable(project);

      if (current.archivedAt === null) {
        return toProjectCycleDto(current);
      }

      await this.requireAvailableName(projectId, current.name, current.id, repositories);
      await this.requireLifecycleAvailable(
        projectId,
        {
          status: current.status,
          startDate: current.startDate,
          endDate: current.endDate
        },
        current.id,
        repositories
      );

      const timestamp = this.clock();
      const reactivated = await repositories.projectCycles.reactivate(cycleId, timestamp);

      if (reactivated === null) {
        throw new NotFoundError('Project cycle not found.');
      }

      return toProjectCycleDto(reactivated);
    });
  }

  async validateAssignableCycle(
    projectId: string,
    cycleId: string | null,
    repositories = this.context.repositories
  ): Promise<ProjectCycle | null> {
    if (cycleId === null) {
      return null;
    }

    const cycle = await this.requireProjectCycle(projectId, cycleId, repositories);

    if (cycle.archivedAt !== null) {
      throw new ValidationError('Cycle is archived.');
    }

    return cycle;
  }

  async findActiveCycle(projectId: string): Promise<ProjectCycleDto | null> {
    await this.requireProject(projectId, this.context.repositories);
    const cycle = await this.context.repositories.projectCycles.findActiveByProject(projectId);
    return cycle === null ? null : toProjectCycleDto(cycle);
  }

  async findUpcomingCycle(projectId: string, today: string): Promise<ProjectCycleDto | null> {
    await this.requireProject(projectId, this.context.repositories);
    const cycle = await this.context.repositories.projectCycles.findUpcomingByProject(projectId, today);
    return cycle === null ? null : toProjectCycleDto(cycle);
  }

  async findRecentlyCompletedCycle(
    projectId: string,
    today: string
  ): Promise<ProjectCycleDto | null> {
    await this.requireProject(projectId, this.context.repositories);
    const cycle = await this.context.repositories.projectCycles.findRecentlyCompletedByProject(projectId, today);
    return cycle === null ? null : toProjectCycleDto(cycle);
  }

  private async withWriteRepositories<T>(
    callback: (repositories: Repositories) => Promise<T>
  ): Promise<T> {
    if (this.context.db === undefined) {
      return callback(this.context.repositories);
    }

    return withRepositoriesTransaction(this.context.db, callback);
  }

  private assertCanManageCycles(): void {
    if (!canManageProjectCycles(this.context.actor)) {
      throw new ForbiddenError('Only owners and maintainers can manage cycles.');
    }
  }

  private async requireProject(projectId: string, repositories: Repositories): Promise<Project> {
    const project = await repositories.projects.findById(projectId);

    if (project === null || project.workspaceId !== this.context.actor.workspaceId) {
      throw new NotFoundError('Project not found.');
    }

    return project;
  }

  private async requireProjectCycle(
    projectId: string,
    cycleId: string,
    repositories: Repositories
  ): Promise<ProjectCycle> {
    const cycle = await repositories.projectCycles.findById(cycleId);

    if (
      cycle === null ||
      cycle.workspaceId !== this.context.actor.workspaceId ||
      cycle.projectId !== projectId
    ) {
      throw new NotFoundError('Project cycle not found.');
    }

    return cycle;
  }

  private assertProjectWritable(project: Project): void {
    if (project.status === 'archived') {
      throw new ConflictError('Archived projects are read-only.');
    }
  }

  private assertCycleWritable(cycle: ProjectCycle): void {
    if (cycle.archivedAt !== null) {
      throw new ConflictError('Archived cycles are read-only.');
    }
  }

  private resolveCycleWindow(
    current: ProjectCycle,
    input: UpdateProjectCycleRequest
  ): ResolvedCycleWindow {
    const window = {
      status: input.status ?? current.status,
      startDate: input.startDate ?? current.startDate,
      endDate: input.endDate ?? current.endDate
    };

    if (window.startDate > window.endDate) {
      throw new ValidationError('Cycle start date must be on or before end date.');
    }

    return window;
  }

  private async requireAvailableName(
    projectId: string,
    name: string,
    currentCycleId: string | undefined,
    repositories: Repositories
  ): Promise<void> {
    const existing = await repositories.projectCycles.findNonArchivedByProjectName(projectId, name);

    if (existing !== null && existing.id !== currentCycleId) {
      throw new ConflictError('A cycle with this name already exists.');
    }
  }

  private async requireLifecycleAvailable(
    projectId: string,
    window: ResolvedCycleWindow,
    currentCycleId: string | undefined,
    repositories: Repositories
  ): Promise<void> {
    if (window.status === 'active') {
      const active = await repositories.projectCycles.findActiveByProject(projectId);

      if (active !== null && active.id !== currentCycleId) {
        throw new ConflictError('This project already has an active cycle.');
      }
    }

    if (window.status !== 'planned' && window.status !== 'active') {
      return;
    }

    const overlapping = await repositories.projectCycles.findOverlappingPlannedOrActive(
      projectId,
      window.startDate,
      window.endDate,
      currentCycleId
    );

    if (overlapping.length > 0) {
      throw new ConflictError('Cycle date range overlaps another planned or active cycle.', {
        overlappingCycleIds: overlapping.map((cycle) => cycle.id)
      });
    }
  }
}

function createCycleProgress(
  cycle: ProjectCycle,
  scopedWorkItems: WorkItem[],
  context: WorkRiskEvaluationContext
): CycleReviewProgressDto {
  const openItems = scopedWorkItems.filter(isOpenWorkItem);
  const doneItems = scopedWorkItems.filter((workItem) => workItem.status === 'done');

  return {
    totalCount: scopedWorkItems.length,
    openCount: openItems.length,
    doneCount: doneItems.length,
    blockedCount: openItems.filter((workItem) => workItem.status === 'blocked').length,
    dependencyBlockedCount: openItems.filter((workItem) =>
      context.dependencyBlockedIds.has(workItem.id)
    ).length,
    committedEstimatePoints: sumEstimatePoints(scopedWorkItems),
    completedEstimatePoints: sumEstimatePoints(doneItems),
    unestimatedCount: openItems.filter((workItem) => workItem.estimatePoints === null).length,
    targetPoints: cycle.targetPoints
  };
}

function createCycleHealth(
  cycle: ProjectCycle,
  progress: CycleReviewProgressDto,
  scopedWorkItems: WorkItem[],
  context: WorkRiskEvaluationContext
): { health: DeliveryHealthState; reasons: DeliveryHealthReasonDto[] } {
  if (cycle.archivedAt !== null || cycle.status === 'canceled') {
    return {
      health: 'inactive',
      reasons: [
        createReason('inactive_milestone', 'info', cycle.archivedAt === null ? 'Cycle is canceled.' : 'Cycle is archived.', 1, {
          cycleId: cycle.id,
          sort: 'priority_desc'
        })
      ]
    };
  }

  if (cycle.status === 'completed') {
    return {
      health: 'complete',
      reasons: [
        createReason('all_work_done', 'info', 'Cycle is completed.', 1, {
          cycleId: cycle.id,
          sort: 'priority_desc'
        })
      ]
    };
  }

  const reasons = createActiveCycleReasons(cycle, progress, scopedWorkItems, context);
  const hasBlockedReason = reasons.some(
    (reason) => reason.key === 'blocked_work' || reason.key === 'dependency_blocked'
  );

  if (cycle.status === 'active' && hasBlockedReason) {
    return { health: 'blocked', reasons };
  }

  if (reasons.length > 0) {
    return { health: 'at_risk', reasons };
  }

  return { health: 'healthy', reasons: [] };
}

function createActiveCycleReasons(
  cycle: ProjectCycle,
  progress: CycleReviewProgressDto,
  scopedWorkItems: WorkItem[],
  context: WorkRiskEvaluationContext
): DeliveryHealthReasonDto[] {
  const openItems = scopedWorkItems.filter(isOpenWorkItem);
  const blockedCount = progress.blockedCount;
  const dependencyBlockedCount = progress.dependencyBlockedCount;
  const overdueCount = openItems.filter((workItem) =>
    isOverdueDueDate(workItem.dueDate, context.today)
  ).length;
  const dueSoonCount = openItems.filter((workItem) =>
    isDueSoonDueDate(workItem.dueDate, context.today, context.dueSoonEnd)
  ).length;
  const unassignedActiveCount = openItems.filter(
    (workItem) =>
      workItem.assigneeId === null && isActiveUnassignedWorkItemStatus(workItem.status)
  ).length;
  const staleInProgressCount = openItems.filter((workItem) =>
    isStaleInProgressStatus(workItem.status, workItem.updatedAt, context.staleCutoff)
  ).length;
  const reasons: DeliveryHealthReasonDto[] = [];

  if (blockedCount > 0) {
    reasons.push(
      createReason('blocked_work', 'critical', `${blockedCount} cycle work item${plural(blockedCount)} blocked.`, blockedCount, {
        cycleId: cycle.id,
        status: 'blocked',
        sort: 'priority_desc'
      })
    );
  }

  if (dependencyBlockedCount > 0) {
    reasons.push(
      createReason('dependency_blocked', 'critical', `${dependencyBlockedCount} cycle work item${plural(dependencyBlockedCount)} blocked by dependencies.`, dependencyBlockedCount, {
        cycleId: cycle.id,
        dependency: 'dependency_blocked',
        sort: 'priority_desc'
      })
    );
  }

  if (isCycleOverTarget(progress)) {
    const overBy = progress.committedEstimatePoints - (progress.targetPoints ?? 0);
    reasons.push(
      createReason('cycle_over_target', 'warning', `Cycle estimate is ${overBy} point${plural(overBy)} over target.`, overBy, {
        cycleId: cycle.id,
        sort: 'priority_desc'
      })
    );
  }

  if (overdueCount > 0) {
    reasons.push(
      createReason('overdue_work', 'warning', `${overdueCount} cycle work item${plural(overdueCount)} overdue.`, overdueCount, {
        cycleId: cycle.id,
        dueDateState: 'overdue',
        sort: 'due_date_asc'
      })
    );
  }

  if (dueSoonCount > 0) {
    reasons.push(
      createReason('due_soon', 'info', `${dueSoonCount} cycle work item${plural(dueSoonCount)} due soon.`, dueSoonCount, {
        cycleId: cycle.id,
        dueDateState: 'due_soon',
        sort: 'due_date_asc'
      })
    );
  }

  if (unassignedActiveCount > 0) {
    reasons.push(
      createReason('unassigned_active', 'warning', `${unassignedActiveCount} active cycle work item${plural(unassignedActiveCount)} unassigned.`, unassignedActiveCount, {
        cycleId: cycle.id,
        workRisk: 'unassigned_active',
        sort: 'priority_desc'
      })
    );
  }

  if (staleInProgressCount > 0) {
    reasons.push(
      createReason('stale_in_progress', 'warning', `${staleInProgressCount} in-progress cycle work item${plural(staleInProgressCount)} stale.`, staleInProgressCount, {
        cycleId: cycle.id,
        workRisk: 'stale_in_progress',
        sort: 'updated_asc'
      })
    );
  }

  if (progress.unestimatedCount > 0) {
    reasons.push(
      createReason('unestimated_work', 'warning', `${progress.unestimatedCount} open cycle work item${plural(progress.unestimatedCount)} unestimated.`, progress.unestimatedCount, {
        cycleId: cycle.id,
        workState: 'open',
        sort: 'priority_desc'
      })
    );
  }

  return reasons;
}

function createCycleScopeBreakdown(
  scopedWorkItems: WorkItem[],
  context: WorkRiskEvaluationContext
): CycleReviewScopeBreakdownDto {
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

function createReason(
  key: DeliveryHealthReasonDto['key'],
  severity: DeliveryHealthReasonDto['severity'],
  message: string,
  count: number,
  query: DeliveryHealthReasonDto['query']
): DeliveryHealthReasonDto {
  return {
    key,
    severity,
    message,
    count,
    query
  };
}

function isCycleOverTarget(progress: CycleReviewProgressDto): boolean {
  return progress.targetPoints !== null && progress.committedEstimatePoints > progress.targetPoints;
}

function isOpenWorkItem(workItem: WorkItem): boolean {
  return isOpenWorkItemStatus(workItem.status);
}

function sumEstimatePoints(workItems: WorkItem[]): number {
  return workItems.reduce((total, workItem) => total + (workItem.estimatePoints ?? 0), 0);
}

function plural(count: number): string {
  return count === 1 ? '' : 's';
}
