import type {
  ActivityEventDto,
  BulkUpdateWorkItemsAction,
  BulkUpdateWorkItemsErrorCode,
  BulkUpdateWorkItemsRequest,
  BulkUpdateWorkItemsResponseDto,
  BulkUpdateWorkItemsResultDto,
  CommentDto,
  CreateWorkItemRequest,
  MoveWorkItemOnBoardRequest,
  TransitionWorkItemRequest,
  UpdateWorkItemRequest,
  WorkItemQuery,
  WorkItemDetailDto,
  WorkItemListItemDto,
  WorkspaceWorkItemListItemDto
} from '@worktrail/contracts';
import { randomUUID } from 'node:crypto';

import type { WorktrailDb } from '../db/client.js';
import type { ActorContext } from '../domain/actor.js';
import type { WorkItemStatus } from '../domain/constants.js';
import { canTransitionWorkItem } from '../domain/workflow.js';
import {
  AppError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
  WorkflowTransitionError
} from '../errors/app-error.js';
import {
  type Repositories,
  withRepositoriesTransaction
} from '../repositories/index.js';
import type { ProjectWorkItemQuery } from '../repositories/work-item-query-builder.js';
import type {
  ActivityEvent,
  Comment,
  Label,
  Member,
  Milestone,
  Project,
  ProjectCycle,
  WorkItem
} from '../repositories/types.js';
import {
  toActivityEventDto,
  toCommentDto,
  toWorkItemDetailDto,
  toWorkItemListItemDto,
  toWorkspaceWorkItemListItemDto
} from './dto.js';
import { NotificationService } from './notification-service.js';
import { WorkItemRelationshipService } from './work-item-relationship-service.js';

const boardPositionStep = 1024;

export type WorkItemListFilters = ProjectWorkItemQuery;

export interface WorkItemServiceContext {
  actor: ActorContext;
  repositories: Repositories;
  db?: WorktrailDb;
  clock?: () => Date;
  idGenerator?: () => string;
}

interface WorkItemBundle {
  workItem: WorkItem;
  assignee: Member | null;
  reporter: Member;
  labels: Label[];
  milestone: Milestone | null;
  cycle: ProjectCycle | null;
}

interface WorkItemDependencyCounts {
  openBlockerCount: number;
  openBlockedWorkCount: number;
}

export interface WorkItemCreationInput extends CreateWorkItemRequest {
  reporterId?: string;
}

export class WorkItemService {
  private readonly clock: () => Date;
  private readonly idGenerator: () => string;

  constructor(private readonly context: WorkItemServiceContext) {
    this.clock = context.clock ?? (() => new Date());
    this.idGenerator = context.idGenerator ?? randomUUID;
  }

  async listWorkItems(
    projectId: string,
    filters: WorkItemListFilters = {}
  ): Promise<WorkItemListItemDto[]> {
    await this.requireProject(projectId);
    const workItems = await this.context.repositories.workItems.listByProject(projectId, filters);
    return this.toListDtos(workItems, this.context.repositories);
  }

  async listWorkspaceWorkItems(
    filters: WorkItemQuery = {}
  ): Promise<WorkspaceWorkItemListItemDto[]> {
    const records = await this.context.repositories.workItems.listByWorkspace(
      this.context.actor.workspaceId,
      filters
    );
    return this.toWorkspaceListDtos(records, this.context.repositories);
  }

  async createWorkItem(projectId: string, input: CreateWorkItemRequest): Promise<WorkItemDetailDto> {
    return this.withWriteRepositories(async (repositories) => {
      return this.createWorkItemWithRepositories(projectId, input, repositories);
    });
  }

  async bulkUpdateWorkItems(
    projectId: string,
    input: BulkUpdateWorkItemsRequest
  ): Promise<BulkUpdateWorkItemsResponseDto> {
    const project = await this.requireProject(projectId);
    this.assertProjectWritable(project);
    this.assertCanBulkUpdateWorkItems();
    await this.validateBulkActionReferences(projectId, input.action, this.context.repositories);

    const results: BulkUpdateWorkItemsResultDto[] = [];

    for (const workItemId of input.workItemIds) {
      try {
        results.push(
          await this.withWriteRepositories(async (repositories) =>
            this.applyBulkActionToWorkItem({
              projectId,
              workItemId,
              action: input.action,
              repositories
            })
          )
        );
      } catch (error) {
        if (error instanceof AppError) {
          results.push({
            workItemId,
            displayKey: null,
            status: 'failed',
            workItem: null,
            error: {
              code: this.toBulkErrorCode(error),
              message: error.message
            }
          });
          continue;
        }

        throw error;
      }
    }

    const unchangedCount = results.filter((result) => result.status === 'unchanged').length;
    const failedCount = results.filter((result) => result.status === 'failed').length;

    return {
      requestedCount: input.workItemIds.length,
      succeededCount: results.length - failedCount,
      unchangedCount,
      failedCount,
      results
    };
  }

  async createWorkItemWithRepositories(
    projectId: string,
    input: WorkItemCreationInput,
    repositories: Repositories
  ): Promise<WorkItemDetailDto> {
    const timestamp = this.clock();
    const labelIds = input.labelIds ?? [];
    const reporterId = input.reporterId ?? this.context.actor.memberId;
    const project = await this.requireProjectFromRepositories(projectId, repositories);
    this.assertProjectWritable(project);
    await this.validateLabels(projectId, labelIds, repositories);
    await this.validateMilestone(projectId, input.milestoneId ?? null, repositories);
    await this.validateCycle(projectId, input.cycleId ?? null, repositories);
    await this.validateAssignee(input.assigneeId ?? null, repositories);
    await this.validateReporter(reporterId, repositories);
    const status = input.status ?? 'backlog';
    const boardPosition = await this.getTopInsertionPosition(projectId, status, repositories);
    const numberedProject = await repositories.projects.allocateWorkItemNumber(projectId, timestamp);

    if (numberedProject === null || numberedProject.workspaceId !== this.context.actor.workspaceId) {
      throw new NotFoundError('Project not found.');
    }

    this.assertProjectWritable(numberedProject);

    const itemNumber = numberedProject.nextWorkItemNumber - 1;

    const workItem = await repositories.workItems.create({
      id: this.idGenerator(),
      workspaceId: this.context.actor.workspaceId,
      projectId,
      title: input.title,
      description: input.description ?? '',
      itemNumber,
      displayKey: `${numberedProject.key}-${itemNumber}`,
      type: input.type,
      status,
      priority: input.priority,
      assigneeId: input.assigneeId ?? null,
      reporterId,
      milestoneId: input.milestoneId ?? null,
      cycleId: input.cycleId ?? null,
      boardPosition,
      dueDate: input.dueDate ?? null,
      estimatePoints: input.estimatePoints ?? null,
      createdAt: timestamp,
      updatedAt: timestamp
    });

    await repositories.labels.replaceForWorkItem(workItem.id, labelIds);
    const activityEvent = await repositories.activityEvents.create({
      id: this.idGenerator(),
      workspaceId: workItem.workspaceId,
      projectId: workItem.projectId,
      workItemId: workItem.id,
      actorId: this.context.actor.memberId,
      eventType: 'work_item.created',
      summary: 'Work item created.',
      previousValue: null,
      newValue: { status: workItem.status },
      metadata: {},
      createdAt: timestamp
    });

    await this.notificationService(repositories).recordWorkItemCreated({
      repositories,
      workItem,
      activityEventId: activityEvent.id,
      timestamp
    });

    return this.toDetailDto(workItem, repositories);
  }

  async getWorkItem(workItemId: string): Promise<WorkItemDetailDto> {
    const workItem = await this.requireWorkItem(workItemId, this.context.repositories);
    return this.toDetailDto(workItem, this.context.repositories);
  }

  async updateWorkItem(
    workItemId: string,
    input: UpdateWorkItemRequest
  ): Promise<WorkItemDetailDto> {
    return this.withWriteRepositories(async (repositories) => {
      const current = await this.requireWorkItem(workItemId, repositories);
      const project = await this.requireProjectFromRepositories(current.projectId, repositories);
      this.assertProjectWritable(project);
      const currentLabels = await repositories.labels.listByWorkItem(workItemId);
      const timestamp = this.clock();
      const nextLabelIds = input.labelIds;

      if (nextLabelIds !== undefined) {
        await this.validateLabels(current.projectId, nextLabelIds, repositories, {
          existingArchivedLabelIds: new Set(
            currentLabels.filter((label) => label.archivedAt !== null).map((label) => label.id)
          )
        });
      }

      if (input.milestoneId !== undefined) {
        await this.validateMilestone(current.projectId, input.milestoneId, repositories, {
          currentMilestoneId: current.milestoneId
        });
      }

      if (input.cycleId !== undefined) {
        await this.validateCycle(current.projectId, input.cycleId, repositories, {
          currentCycleId: current.cycleId
        });
      }

      if (input.assigneeId !== undefined) {
        await this.validateAssignee(input.assigneeId, repositories, {
          currentAssigneeId: current.assigneeId
        });
      }

      const updated = await repositories.workItems.update(workItemId, {
        ...(input.title === undefined ? {} : { title: input.title }),
        ...(input.description === undefined ? {} : { description: input.description }),
        ...(input.type === undefined ? {} : { type: input.type }),
        ...(input.priority === undefined ? {} : { priority: input.priority }),
        ...(input.assigneeId === undefined ? {} : { assigneeId: input.assigneeId }),
        ...(input.milestoneId === undefined ? {} : { milestoneId: input.milestoneId }),
        ...(input.cycleId === undefined ? {} : { cycleId: input.cycleId }),
        ...(input.dueDate === undefined ? {} : { dueDate: input.dueDate }),
        ...(input.estimatePoints === undefined ? {} : { estimatePoints: input.estimatePoints }),
        updatedAt: timestamp
      });

      if (updated === null) {
        throw new NotFoundError('Work item not found.');
      }

      if (nextLabelIds !== undefined) {
        await repositories.labels.replaceForWorkItem(workItemId, nextLabelIds);
      }

      const updateActivity = await this.recordUpdateActivity({
        current,
        updated,
        currentLabels,
        nextLabels:
          nextLabelIds === undefined ? currentLabels : await repositories.labels.listByWorkItem(workItemId),
        repositories,
        timestamp
      });

      if (current.assigneeId !== updated.assigneeId) {
        await this.notificationService(repositories).recordWorkItemAssigneeChanged({
          repositories,
          workItem: updated,
          previousAssigneeId: current.assigneeId,
          activityEventId: updateActivity.assigneeActivityEventId,
          timestamp
        });
      }

      return this.toDetailDto(updated, repositories);
    });
  }

  async transitionWorkItem(
    workItemId: string,
    input: TransitionWorkItemRequest
  ): Promise<WorkItemDetailDto> {
    return this.withWriteRepositories(async (repositories) => {
      const current = await this.requireWorkItem(workItemId, repositories);
      const project = await this.requireProjectFromRepositories(current.projectId, repositories);
      this.assertProjectWritable(project);

      if (
        !canTransitionWorkItem({
          from: current.status,
          to: input.status,
          actorRole: this.context.actor.role
        })
      ) {
        throw new WorkflowTransitionError('The requested status transition is not allowed.', {
          from: current.status,
          to: input.status
        });
      }

      const timestamp = this.clock();
      const boardPosition =
        current.status === input.status
          ? undefined
          : await this.getTopInsertionPosition(current.projectId, input.status, repositories);
      const updated = await repositories.workItems.updateStatus(
        workItemId,
        input.status,
        timestamp,
        boardPosition
      );

      if (updated === null) {
        throw new NotFoundError('Work item not found.');
      }

      if (current.status !== updated.status) {
        const activityEvent = await repositories.activityEvents.create({
          id: this.idGenerator(),
          workspaceId: updated.workspaceId,
          projectId: updated.projectId,
          workItemId: updated.id,
          actorId: this.context.actor.memberId,
          eventType: 'work_item.status_changed',
          summary: `Status changed from ${current.status} to ${updated.status}.`,
          previousValue: { status: current.status },
          newValue: { status: updated.status },
          metadata: {},
          createdAt: timestamp
        });

        await this.notificationService(repositories).recordWorkItemStatusChanged({
          repositories,
          workItem: updated,
          previousStatus: current.status,
          activityEventId: activityEvent.id,
          timestamp
        });
      }

      return this.toDetailDto(updated, repositories);
    });
  }

  async moveWorkItemOnBoard(
    workItemId: string,
    input: MoveWorkItemOnBoardRequest
  ): Promise<WorkItemDetailDto> {
    return this.withWriteRepositories(async (repositories) => {
      const current = await this.requireWorkItem(workItemId, repositories);
      const project = await this.requireProjectFromRepositories(current.projectId, repositories);
      this.assertProjectWritable(project);

      if (
        !canTransitionWorkItem({
          from: current.status,
          to: input.status,
          actorRole: this.context.actor.role
        })
      ) {
        throw new WorkflowTransitionError('The requested status transition is not allowed.', {
          from: current.status,
          to: input.status
        });
      }

      const timestamp = this.clock();
      const boardPosition = await this.computeBoardPosition({
        projectId: current.projectId,
        status: input.status,
        movingWorkItemId: current.id,
        beforeWorkItemId: input.beforeWorkItemId ?? null,
        afterWorkItemId: input.afterWorkItemId ?? null,
        repositories
      });
      const updated = await repositories.workItems.moveOnBoard(workItemId, {
        status: input.status,
        boardPosition,
        updatedAt: timestamp
      });

      if (updated === null) {
        throw new NotFoundError('Work item not found.');
      }

      if (current.status !== updated.status) {
        const activityEvent = await repositories.activityEvents.create({
          id: this.idGenerator(),
          workspaceId: updated.workspaceId,
          projectId: updated.projectId,
          workItemId: updated.id,
          actorId: this.context.actor.memberId,
          eventType: 'work_item.status_changed',
          summary: `Status changed from ${current.status} to ${updated.status}.`,
          previousValue: { status: current.status, boardPosition: current.boardPosition },
          newValue: { status: updated.status, boardPosition: updated.boardPosition },
          metadata: {},
          createdAt: timestamp
        });

        await this.notificationService(repositories).recordWorkItemStatusChanged({
          repositories,
          workItem: updated,
          previousStatus: current.status,
          activityEventId: activityEvent.id,
          timestamp
        });
      }

      return this.toDetailDto(updated, repositories);
    });
  }

  private async withWriteRepositories<T>(
    callback: (repositories: Repositories) => Promise<T>
  ): Promise<T> {
    if (this.context.db === undefined) {
      return callback(this.context.repositories);
    }

    return withRepositoriesTransaction(this.context.db, callback);
  }

  private notificationService(repositories: Repositories): NotificationService {
    return new NotificationService({
      actor: this.context.actor,
      repositories,
      clock: this.clock,
      idGenerator: this.idGenerator
    });
  }

  private assertCanBulkUpdateWorkItems(): void {
    if (this.context.actor.role !== 'owner' && this.context.actor.role !== 'maintainer') {
      throw new ForbiddenError('Only owners and maintainers can bulk update work items.');
    }
  }

  private async validateBulkActionReferences(
    projectId: string,
    action: BulkUpdateWorkItemsAction,
    repositories: Repositories
  ): Promise<void> {
    if (action.type === 'set_assignee') {
      await this.validateAssignee(action.assigneeId, repositories);
      return;
    }

    if (action.type === 'set_milestone') {
      await this.validateMilestone(projectId, action.milestoneId, repositories);
      return;
    }

    if (action.type === 'set_cycle') {
      await this.validateCycle(projectId, action.cycleId, repositories);
      return;
    }

    if (action.type === 'add_labels' || action.type === 'remove_labels') {
      await this.validateLabels(projectId, action.labelIds, repositories);
    }
  }

  private async applyBulkActionToWorkItem(input: {
    projectId: string;
    workItemId: string;
    action: BulkUpdateWorkItemsAction;
    repositories: Repositories;
  }): Promise<BulkUpdateWorkItemsResultDto> {
    const current = await input.repositories.workItems.findById(input.workItemId);

    if (current === null || current.workspaceId !== this.context.actor.workspaceId) {
      return this.toBulkFailure({
        workItemId: input.workItemId,
        displayKey: null,
        code: 'NOT_FOUND',
        message: 'Work item not found.'
      });
    }

    if (current.projectId !== input.projectId) {
      return this.toBulkFailure({
        workItemId: input.workItemId,
        displayKey: null,
        code: 'NOT_IN_PROJECT',
        message: 'Work item is not part of this project.'
      });
    }

    try {
      if (input.action.type === 'transition_status') {
        return await this.transitionBulkWorkItem(current, input.action.status, input.repositories);
      }

      return await this.updateBulkWorkItem(current, input.action, input.repositories);
    } catch (error) {
      if (error instanceof AppError) {
        return this.toBulkFailure({
          workItemId: current.id,
          displayKey: current.displayKey,
          code: this.toBulkErrorCode(error),
          message: error.message
        });
      }

      throw error;
    }
  }

  private async updateBulkWorkItem(
    current: WorkItem,
    action: Exclude<BulkUpdateWorkItemsAction, { type: 'transition_status' }>,
    repositories: Repositories
  ): Promise<BulkUpdateWorkItemsResultDto> {
    const currentLabels = await repositories.labels.listByWorkItem(current.id);
    const nextUpdate = this.toBulkWorkItemUpdate(current, currentLabels, action);

    if (nextUpdate === null) {
      return this.toBulkSuccess(current, 'unchanged', repositories);
    }

    if (nextUpdate.labelIds !== undefined) {
      await this.validateLabels(current.projectId, nextUpdate.labelIds, repositories, {
        existingArchivedLabelIds: new Set(
          currentLabels.filter((label) => label.archivedAt !== null).map((label) => label.id)
        )
      });
    }

    if (nextUpdate.patch.milestoneId !== undefined) {
      await this.validateMilestone(current.projectId, nextUpdate.patch.milestoneId, repositories, {
        currentMilestoneId: current.milestoneId
      });
    }

    if (nextUpdate.patch.cycleId !== undefined) {
      await this.validateCycle(current.projectId, nextUpdate.patch.cycleId, repositories, {
        currentCycleId: current.cycleId
      });
    }

    if (nextUpdate.patch.assigneeId !== undefined) {
      await this.validateAssignee(nextUpdate.patch.assigneeId, repositories, {
        currentAssigneeId: current.assigneeId
      });
    }

    const timestamp = this.clock();
    const updated = await repositories.workItems.update(current.id, {
      ...nextUpdate.patch,
      updatedAt: timestamp
    });

    if (updated === null) {
      throw new NotFoundError('Work item not found.');
    }

    if (nextUpdate.labelIds !== undefined) {
      await repositories.labels.replaceForWorkItem(current.id, nextUpdate.labelIds);
    }

    const updateActivity = await this.recordUpdateActivity({
      current,
      updated,
      currentLabels,
      nextLabels:
        nextUpdate.labelIds === undefined ? currentLabels : await repositories.labels.listByWorkItem(current.id),
      repositories,
      timestamp
    });

    if (current.assigneeId !== updated.assigneeId) {
      await this.notificationService(repositories).recordWorkItemAssigneeChanged({
        repositories,
        workItem: updated,
        previousAssigneeId: current.assigneeId,
        activityEventId: updateActivity.assigneeActivityEventId,
        timestamp
      });
    }

    return this.toBulkSuccess(updated, 'updated', repositories);
  }

  private toBulkWorkItemUpdate(
    current: WorkItem,
    currentLabels: Label[],
    action: Exclude<BulkUpdateWorkItemsAction, { type: 'transition_status' }>
  ): {
    patch: Partial<
      Pick<WorkItem, 'assigneeId' | 'priority' | 'milestoneId' | 'cycleId' | 'dueDate'>
    >;
    labelIds?: string[];
  } | null {
    if (action.type === 'set_assignee') {
      return current.assigneeId === action.assigneeId ? null : { patch: { assigneeId: action.assigneeId } };
    }

    if (action.type === 'clear_assignee') {
      return current.assigneeId === null ? null : { patch: { assigneeId: null } };
    }

    if (action.type === 'set_priority') {
      return current.priority === action.priority ? null : { patch: { priority: action.priority } };
    }

    if (action.type === 'set_milestone') {
      return current.milestoneId === action.milestoneId ? null : { patch: { milestoneId: action.milestoneId } };
    }

    if (action.type === 'clear_milestone') {
      return current.milestoneId === null ? null : { patch: { milestoneId: null } };
    }

    if (action.type === 'set_cycle') {
      return current.cycleId === action.cycleId ? null : { patch: { cycleId: action.cycleId } };
    }

    if (action.type === 'clear_cycle') {
      return current.cycleId === null ? null : { patch: { cycleId: null } };
    }

    if (action.type === 'set_due_date') {
      return current.dueDate === action.dueDate ? null : { patch: { dueDate: action.dueDate } };
    }

    if (action.type === 'clear_due_date') {
      return current.dueDate === null ? null : { patch: { dueDate: null } };
    }

    const currentLabelIds = currentLabels.map((label) => label.id);

    if (action.type === 'add_labels') {
      const nextLabelIds = [...new Set([...currentLabelIds, ...action.labelIds])];
      return this.haveSameIds(currentLabelIds, nextLabelIds) ? null : { patch: {}, labelIds: nextLabelIds };
    }

    const removedLabelIds = new Set(action.labelIds);
    const nextLabelIds = currentLabelIds.filter((labelId) => !removedLabelIds.has(labelId));
    return this.haveSameIds(currentLabelIds, nextLabelIds) ? null : { patch: {}, labelIds: nextLabelIds };
  }

  private async transitionBulkWorkItem(
    current: WorkItem,
    status: WorkItemStatus,
    repositories: Repositories
  ): Promise<BulkUpdateWorkItemsResultDto> {
    if (current.status === status) {
      return this.toBulkSuccess(current, 'unchanged', repositories);
    }

    if (
      !canTransitionWorkItem({
        from: current.status,
        to: status,
        actorRole: this.context.actor.role
      })
    ) {
      throw new WorkflowTransitionError('The requested status transition is not allowed.', {
        from: current.status,
        to: status
      });
    }

    const timestamp = this.clock();
    const boardPosition = await this.getTopInsertionPosition(current.projectId, status, repositories);
    const updated = await repositories.workItems.updateStatus(current.id, status, timestamp, boardPosition);

    if (updated === null) {
      throw new NotFoundError('Work item not found.');
    }

    const activityEvent = await repositories.activityEvents.create({
      id: this.idGenerator(),
      workspaceId: updated.workspaceId,
      projectId: updated.projectId,
      workItemId: updated.id,
      actorId: this.context.actor.memberId,
      eventType: 'work_item.status_changed',
      summary: `Status changed from ${current.status} to ${updated.status}.`,
      previousValue: { status: current.status },
      newValue: { status: updated.status },
      metadata: {},
      createdAt: timestamp
    });

    await this.notificationService(repositories).recordWorkItemStatusChanged({
      repositories,
      workItem: updated,
      previousStatus: current.status,
      activityEventId: activityEvent.id,
      timestamp
    });

    return this.toBulkSuccess(updated, 'updated', repositories);
  }

  private async toBulkSuccess(
    workItem: WorkItem,
    status: Extract<BulkUpdateWorkItemsResultDto['status'], 'updated' | 'unchanged'>,
    repositories: Repositories
  ): Promise<BulkUpdateWorkItemsResultDto> {
    const [workItemDto] = await this.toListDtos([workItem], repositories);

    if (workItemDto === undefined) {
      throw new NotFoundError('Work item not found.');
    }

    return {
      workItemId: workItem.id,
      displayKey: workItem.displayKey,
      status,
      workItem: workItemDto,
      error: null
    };
  }

  private toBulkFailure(input: {
    workItemId: string;
    displayKey: string | null;
    code: BulkUpdateWorkItemsErrorCode;
    message: string;
  }): BulkUpdateWorkItemsResultDto {
    return {
      workItemId: input.workItemId,
      displayKey: input.displayKey,
      status: 'failed',
      workItem: null,
      error: {
        code: input.code,
        message: input.message
      }
    };
  }

  private toBulkErrorCode(error: AppError): BulkUpdateWorkItemsErrorCode {
    if (error.code === 'WORKFLOW_TRANSITION_ERROR') {
      return 'WORKFLOW_TRANSITION_ERROR';
    }

    if (error.code === 'FORBIDDEN') {
      return 'FORBIDDEN';
    }

    if (error.code === 'NOT_FOUND') {
      return 'NOT_FOUND';
    }

    if (error.code === 'VALIDATION_ERROR') {
      return 'VALIDATION_ERROR';
    }

    return 'VALIDATION_ERROR';
  }

  private haveSameIds(left: string[], right: string[]): boolean {
    if (left.length !== right.length) {
      return false;
    }

    const rightIds = new Set(right);
    return left.every((value) => rightIds.has(value));
  }

  private async requireProject(projectId: string): Promise<Project> {
    return this.requireProjectFromRepositories(projectId, this.context.repositories);
  }

  private async requireProjectFromRepositories(
    projectId: string,
    repositories: Repositories
  ): Promise<Project> {
    const project = await repositories.projects.findById(projectId);

    if (project === null || project.workspaceId !== this.context.actor.workspaceId) {
      throw new NotFoundError('Project not found.');
    }

    return project;
  }

  private assertProjectWritable(project: Project): void {
    if (project.status === 'archived') {
      throw new ConflictError('Archived projects are read-only.');
    }
  }

  private async requireWorkItem(workItemId: string, repositories: Repositories): Promise<WorkItem> {
    const workItem = await repositories.workItems.findById(workItemId);

    if (workItem === null || workItem.workspaceId !== this.context.actor.workspaceId) {
      throw new NotFoundError('Work item not found.');
    }

    return workItem;
  }

  private async getTopInsertionPosition(
    projectId: string,
    status: WorkItemStatus,
    repositories: Repositories
  ): Promise<number> {
    const topPosition = await repositories.workItems.getTopBoardPosition(projectId, status);
    return topPosition === null ? boardPositionStep : topPosition - boardPositionStep;
  }

  private async computeBoardPosition(input: {
    projectId: string;
    status: WorkItemStatus;
    movingWorkItemId: string;
    beforeWorkItemId: string | null;
    afterWorkItemId: string | null;
    repositories: Repositories;
  }): Promise<number> {
    if (
      input.beforeWorkItemId === input.movingWorkItemId ||
      input.afterWorkItemId === input.movingWorkItemId
    ) {
      throw new ValidationError('A work item cannot be positioned relative to itself.');
    }

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const column = (
        await input.repositories.workItems.listByProjectAndStatusForBoard(input.projectId, input.status)
      ).filter((item) => item.id !== input.movingWorkItemId);

      const position = this.tryComputeBoardPosition({
        column,
        beforeWorkItemId: input.beforeWorkItemId,
        afterWorkItemId: input.afterWorkItemId
      });

      if (position !== null) {
        return position;
      }

      await input.repositories.workItems.compactBoardPositions(input.projectId, input.status);
    }

    throw new ConflictError('Board column could not be rebalanced.');
  }

  private tryComputeBoardPosition(input: {
    column: WorkItem[];
    beforeWorkItemId: string | null;
    afterWorkItemId: string | null;
  }): number | null {
    if (input.beforeWorkItemId === null && input.afterWorkItemId === null) {
      const first = input.column[0];
      return first === undefined ? boardPositionStep : first.boardPosition - boardPositionStep;
    }

    const beforeIndex =
      input.beforeWorkItemId === null
        ? -1
        : input.column.findIndex((item) => item.id === input.beforeWorkItemId);
    const afterIndex =
      input.afterWorkItemId === null
        ? input.column.length
        : input.column.findIndex((item) => item.id === input.afterWorkItemId);

    if (
      beforeIndex === -1 &&
      input.beforeWorkItemId !== null ||
      afterIndex === -1 &&
      input.afterWorkItemId !== null
    ) {
      throw new ValidationError('Board move neighbors are invalid for the target status.');
    }

    if (afterIndex !== beforeIndex + 1) {
      throw new ValidationError('Board move neighbors are stale.');
    }

    if (input.beforeWorkItemId === null) {
      const after = input.column[afterIndex];
      return after === undefined ? boardPositionStep : after.boardPosition - boardPositionStep;
    }

    const before = input.column[beforeIndex];

    if (before === undefined) {
      throw new ValidationError('Board move neighbors are invalid for the target status.');
    }

    if (input.afterWorkItemId === null) {
      return before.boardPosition + boardPositionStep;
    }

    const after = input.column[afterIndex];

    if (after === undefined) {
      throw new ValidationError('Board move neighbors are invalid for the target status.');
    }

    const gap = after.boardPosition - before.boardPosition;

    if (gap <= 1) {
      return null;
    }

    return before.boardPosition + Math.floor(gap / 2);
  }

  private async validateLabels(
    projectId: string,
    labelIds: string[],
    repositories: Repositories,
    options: { existingArchivedLabelIds?: Set<string> } = {}
  ): Promise<void> {
    const uniqueLabelIds = [...new Set(labelIds)];
    const labels = await repositories.labels.listByIds(uniqueLabelIds);

    if (
      labels.length !== uniqueLabelIds.length ||
      labels.some(
        (label) =>
          label.workspaceId !== this.context.actor.workspaceId ||
          (label.projectId !== null && label.projectId !== projectId) ||
          (label.archivedAt !== null && !options.existingArchivedLabelIds?.has(label.id))
      )
    ) {
      throw new ValidationError('One or more labels are invalid for this project.');
    }
  }

  private async validateMilestone(
    projectId: string,
    milestoneId: string | null,
    repositories: Repositories,
    options: { currentMilestoneId?: string | null } = {}
  ): Promise<void> {
    if (milestoneId === null) {
      return;
    }

    const milestone = await repositories.milestones.findById(milestoneId);

    if (
      milestone === null ||
      milestone.workspaceId !== this.context.actor.workspaceId ||
      milestone.projectId !== projectId ||
      (milestone.archivedAt !== null && milestone.id !== options.currentMilestoneId)
    ) {
      throw new ValidationError('Milestone is invalid for this project.');
    }
  }

  private async validateCycle(
    projectId: string,
    cycleId: string | null,
    repositories: Repositories,
    options: { currentCycleId?: string | null } = {}
  ): Promise<void> {
    if (cycleId === null) {
      return;
    }

    const cycle = await repositories.projectCycles.findById(cycleId);

    if (
      cycle === null ||
      cycle.workspaceId !== this.context.actor.workspaceId ||
      cycle.projectId !== projectId ||
      (cycle.archivedAt !== null && cycle.id !== options.currentCycleId)
    ) {
      throw new ValidationError('Cycle is invalid for this project.');
    }
  }

  private async validateAssignee(
    assigneeId: string | null,
    repositories: Repositories,
    options: { currentAssigneeId?: string | null } = {}
  ): Promise<void> {
    if (assigneeId === null || assigneeId === options.currentAssigneeId) {
      return;
    }

    const assignee = await repositories.members.findById(assigneeId);

    if (
      assignee === null ||
      assignee.workspaceId !== this.context.actor.workspaceId ||
      !assignee.isActive
    ) {
      throw new ValidationError('Assignee must be an active workspace member.');
    }
  }

  private async validateReporter(reporterId: string, repositories: Repositories): Promise<void> {
    const reporter = await repositories.members.findById(reporterId);

    if (
      reporter === null ||
      reporter.workspaceId !== this.context.actor.workspaceId ||
      !reporter.isActive
    ) {
      throw new ValidationError('Reporter must be an active workspace member.');
    }
  }

  private async toListDtos(
    workItems: WorkItem[],
    repositories: Repositories
  ): Promise<WorkItemListItemDto[]> {
    const labelsByWorkItem = new Map<string, Label[]>();

    for (const item of await repositories.labels.listByWorkItems(workItems.map((workItem) => workItem.id))) {
      labelsByWorkItem.set(item.workItemId, [...(labelsByWorkItem.get(item.workItemId) ?? []), item.label]);
    }

    const dtos: WorkItemListItemDto[] = [];
    const dependencyCountsById = await repositories.workItemRelationships.listDependencyCounts(
      workItems.map((workItem) => workItem.id)
    );

    for (const workItem of workItems) {
      const bundle = await this.toBundle(workItem, repositories, labelsByWorkItem.get(workItem.id) ?? []);
      dtos.push(toWorkItemListItemDto({
        ...bundle,
        dependencyCounts: this.toDependencyCounts(dependencyCountsById.get(workItem.id))
      }));
    }

    return dtos;
  }

  private async toWorkspaceListDtos(
    records: Awaited<ReturnType<Repositories['workItems']['listByWorkspace']>>,
    repositories: Repositories
  ): Promise<WorkspaceWorkItemListItemDto[]> {
    const labelsByWorkItem = new Map<string, Label[]>();

    for (const item of await repositories.labels.listByWorkItems(
      records.map((record) => record.workItem.id)
    )) {
      labelsByWorkItem.set(item.workItemId, [...(labelsByWorkItem.get(item.workItemId) ?? []), item.label]);
    }

    const dtos: WorkspaceWorkItemListItemDto[] = [];
    const dependencyCountsById = await repositories.workItemRelationships.listDependencyCounts(
      records.map((record) => record.workItem.id)
    );

    for (const record of records) {
      const bundle = await this.toBundle(
        record.workItem,
        repositories,
        labelsByWorkItem.get(record.workItem.id) ?? []
      );
      dtos.push(toWorkspaceWorkItemListItemDto({
        ...bundle,
        project: record.project,
        dependencyCounts: this.toDependencyCounts(dependencyCountsById.get(record.workItem.id))
      }));
    }

    return dtos;
  }

  private async toDetailDto(
    workItem: WorkItem,
    repositories: Repositories
  ): Promise<WorkItemDetailDto> {
    const labels = await repositories.labels.listByWorkItem(workItem.id);
    const comments = await repositories.comments.findByWorkItem(workItem.id);
    const activity = await repositories.activityEvents.findByWorkItem(workItem.id);
    const relationships = await new WorkItemRelationshipService({
      actor: this.context.actor,
      repositories,
      clock: this.clock,
      idGenerator: this.idGenerator
    }).getRelationshipSummaryWithRepositories(workItem.id, repositories);

    return toWorkItemDetailDto({
      ...(await this.toBundle(workItem, repositories, labels)),
      dependencyCounts: relationships,
      relationships,
      comments: await this.toCommentDtos(comments, repositories),
      activity: await this.toActivityDtos(activity, repositories)
    });
  }

  private toDependencyCounts(
    counts:
      | {
          openBlockerCount: number;
          openBlockedWorkCount: number;
        }
      | undefined
  ): WorkItemDependencyCounts {
    return {
      openBlockerCount: counts?.openBlockerCount ?? 0,
      openBlockedWorkCount: counts?.openBlockedWorkCount ?? 0
    };
  }

  private async toBundle(
    workItem: WorkItem,
    repositories: Repositories,
    labels: Label[]
  ): Promise<WorkItemBundle> {
    const reporter = await repositories.members.findById(workItem.reporterId);
    const assignee =
      workItem.assigneeId === null ? null : await repositories.members.findById(workItem.assigneeId);
    const milestone =
      workItem.milestoneId === null ? null : await repositories.milestones.findById(workItem.milestoneId);
    const cycle =
      workItem.cycleId === null ? null : await repositories.projectCycles.findById(workItem.cycleId);

    if (reporter === null) {
      throw new NotFoundError('Work item reporter not found.');
    }

    if (workItem.milestoneId !== null && milestone === null) {
      throw new NotFoundError('Work item milestone not found.');
    }

    if (workItem.cycleId !== null && cycle === null) {
      throw new NotFoundError('Work item cycle not found.');
    }

    return {
      workItem,
      assignee,
      reporter,
      labels,
      milestone,
      cycle
    };
  }

  private async toCommentDtos(comments: Comment[], repositories: Repositories) {
    const dtos: CommentDto[] = [];
    const mentionsByCommentId = await this.getMentionsByCommentId(comments, repositories);

    for (const comment of comments) {
      const author = await this.requireMember(comment.authorId, repositories, 'Comment author not found.');
      const deletedBy =
        comment.deletedById === null
          ? null
          : await this.requireMember(comment.deletedById, repositories, 'Comment deletion actor not found.');
      dtos.push(toCommentDto(comment, author, deletedBy, mentionsByCommentId.get(comment.id) ?? []));
    }

    return dtos;
  }

  private async getMentionsByCommentId(
    comments: Comment[],
    repositories: Repositories
  ): Promise<Map<string, Member[]>> {
    const mentionsByCommentId = new Map<string, Member[]>();
    const mentions = await repositories.commentMentions.listByComments(
      comments.map((comment) => comment.id)
    );

    if (mentions.length === 0) {
      return mentionsByCommentId;
    }

    const membersById = new Map(
      (await repositories.members.listByWorkspace(this.context.actor.workspaceId)).map((member) => [
        member.id,
        member
      ])
    );

    for (const mention of mentions) {
      const member = membersById.get(mention.memberId);

      if (member === undefined) {
        throw new NotFoundError('Mentioned member not found.');
      }

      const existing = mentionsByCommentId.get(mention.commentId) ?? [];
      existing.push(member);
      mentionsByCommentId.set(mention.commentId, existing);
    }

    return mentionsByCommentId;
  }

  private async toActivityDtos(activity: ActivityEvent[], repositories: Repositories) {
    const dtos: ActivityEventDto[] = [];

    for (const event of activity) {
      const actor = await this.requireMember(event.actorId, repositories, 'Activity actor not found.');
      dtos.push(toActivityEventDto(event, actor));
    }

    return dtos;
  }

  private async requireMember(
    memberId: string,
    repositories: Repositories,
    message: string
  ): Promise<Member> {
    const member = await repositories.members.findById(memberId);

    if (member === null || member.workspaceId !== this.context.actor.workspaceId) {
      throw new NotFoundError(message);
    }

    return member;
  }

  private async recordUpdateActivity(input: {
    current: WorkItem;
    updated: WorkItem;
    currentLabels: Label[];
    nextLabels: Label[];
    repositories: Repositories;
    timestamp: Date;
  }): Promise<{ assigneeActivityEventId: string | null }> {
    await this.recordFieldActivity(input, 'title', 'work_item.title_changed');
    await this.recordFieldActivity(input, 'description', 'work_item.description_changed');
    await this.recordFieldActivity(input, 'priority', 'work_item.priority_changed');
    const assigneeActivity = await this.recordFieldActivity(
      input,
      'assigneeId',
      'work_item.assignee_changed'
    );
    await this.recordDueDateActivity(input);
    await this.recordMilestoneActivity(input);
    await this.recordCycleActivity(input);

    const currentLabelIds = new Set(input.currentLabels.map((label) => label.id));
    const nextLabelIds = new Set(input.nextLabels.map((label) => label.id));

    for (const label of input.nextLabels) {
      if (!currentLabelIds.has(label.id)) {
        await input.repositories.activityEvents.create({
          id: this.idGenerator(),
          workspaceId: input.updated.workspaceId,
          projectId: input.updated.projectId,
          workItemId: input.updated.id,
          actorId: this.context.actor.memberId,
          eventType: 'work_item.label_added',
          summary: `Label ${label.name} added.`,
          previousValue: null,
          newValue: { labelId: label.id, labelName: label.name },
          metadata: {},
          createdAt: input.timestamp
        });
      }
    }

    for (const label of input.currentLabels) {
      if (!nextLabelIds.has(label.id)) {
        await input.repositories.activityEvents.create({
          id: this.idGenerator(),
          workspaceId: input.updated.workspaceId,
          projectId: input.updated.projectId,
          workItemId: input.updated.id,
          actorId: this.context.actor.memberId,
          eventType: 'work_item.label_removed',
          summary: `Label ${label.name} removed.`,
          previousValue: { labelId: label.id, labelName: label.name },
          newValue: null,
          metadata: {},
          createdAt: input.timestamp
        });
      }
    }

    return { assigneeActivityEventId: assigneeActivity?.id ?? null };
  }

  private async recordFieldActivity(
    input: {
      current: WorkItem;
      updated: WorkItem;
      repositories: Repositories;
      timestamp: Date;
    },
    field: 'title' | 'description' | 'priority' | 'assigneeId',
    eventType:
      | 'work_item.title_changed'
      | 'work_item.description_changed'
      | 'work_item.priority_changed'
      | 'work_item.assignee_changed'
  ): Promise<ActivityEvent | null> {
    if (input.current[field] === input.updated[field]) {
      return null;
    }

    return input.repositories.activityEvents.create({
      id: this.idGenerator(),
      workspaceId: input.updated.workspaceId,
      projectId: input.updated.projectId,
      workItemId: input.updated.id,
      actorId: this.context.actor.memberId,
      eventType,
      summary: `${field} changed.`,
      previousValue: { [field]: input.current[field] },
      newValue: { [field]: input.updated[field] },
      metadata: {},
      createdAt: input.timestamp
    });
  }

  private async recordDueDateActivity(input: {
    current: WorkItem;
    updated: WorkItem;
    repositories: Repositories;
    timestamp: Date;
  }): Promise<void> {
    if (input.current.dueDate === input.updated.dueDate) {
      return;
    }

    await input.repositories.activityEvents.create({
      id: this.idGenerator(),
      workspaceId: input.updated.workspaceId,
      projectId: input.updated.projectId,
      workItemId: input.updated.id,
      actorId: this.context.actor.memberId,
      eventType: 'work_item.due_date_changed',
      summary: 'Due date changed.',
      previousValue: { dueDate: input.current.dueDate },
      newValue: { dueDate: input.updated.dueDate },
      metadata: {},
      createdAt: input.timestamp
    });
  }

  private async recordMilestoneActivity(input: {
    current: WorkItem;
    updated: WorkItem;
    repositories: Repositories;
    timestamp: Date;
  }): Promise<void> {
    if (input.current.milestoneId === input.updated.milestoneId) {
      return;
    }

    const previousMilestone =
      input.current.milestoneId === null
        ? null
        : await input.repositories.milestones.findById(input.current.milestoneId);
    const nextMilestone =
      input.updated.milestoneId === null
        ? null
        : await input.repositories.milestones.findById(input.updated.milestoneId);

    await input.repositories.activityEvents.create({
      id: this.idGenerator(),
      workspaceId: input.updated.workspaceId,
      projectId: input.updated.projectId,
      workItemId: input.updated.id,
      actorId: this.context.actor.memberId,
      eventType: 'work_item.milestone_changed',
      summary:
        nextMilestone === null
          ? 'Milestone assignment cleared.'
          : `Milestone changed to ${nextMilestone.name}.`,
      previousValue:
        previousMilestone === null
          ? null
          : { milestoneId: previousMilestone.id, milestoneName: previousMilestone.name },
      newValue:
        nextMilestone === null
          ? null
          : { milestoneId: nextMilestone.id, milestoneName: nextMilestone.name },
      metadata: {},
      createdAt: input.timestamp
    });
  }

  private async recordCycleActivity(input: {
    current: WorkItem;
    updated: WorkItem;
    repositories: Repositories;
    timestamp: Date;
  }): Promise<void> {
    if (input.current.cycleId === input.updated.cycleId) {
      return;
    }

    const previousCycle =
      input.current.cycleId === null
        ? null
        : await input.repositories.projectCycles.findById(input.current.cycleId);
    const nextCycle =
      input.updated.cycleId === null
        ? null
        : await input.repositories.projectCycles.findById(input.updated.cycleId);

    await input.repositories.activityEvents.create({
      id: this.idGenerator(),
      workspaceId: input.updated.workspaceId,
      projectId: input.updated.projectId,
      workItemId: input.updated.id,
      actorId: this.context.actor.memberId,
      eventType: 'work_item.cycle_changed',
      summary:
        nextCycle === null
          ? 'Cycle assignment cleared.'
          : `Cycle changed to ${nextCycle.name}.`,
      previousValue:
        previousCycle === null
          ? null
          : { cycleId: previousCycle.id, cycleName: previousCycle.name },
      newValue:
        nextCycle === null
          ? null
          : { cycleId: nextCycle.id, cycleName: nextCycle.name },
      metadata: {},
      createdAt: input.timestamp
    });
  }
}
