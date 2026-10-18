import { coordinateProjects } from './project-write-coordination.js';
import type {
  CreateWorkItemRequest,
  MoveWorkItemOnBoardRequest,
  SetWorkItemParentRequest,
  TransitionWorkItemRequest,
  UpdateWorkItemRequest,
  WorkItemDetailDto
} from '@worktrail/contracts';
import { randomUUID } from 'node:crypto';
import { assertPersistence, type PersistenceScope } from '../repositories/persistence.js';
import {
  resolveNewAuthoredContent,
  resolveUpdatedAuthoredContent
} from '../domain/authored-content-policy.js';
import { canTransitionWorkItem } from '../domain/workflow.js';
import {
  ConflictError,
  NotFoundError,
  ValidationError,
  WorkflowTransitionError
} from '../errors/app-error.js';
import type { Repositories } from '../repositories/index.js';
import type { WorkItem } from '../repositories/types.js';
import { NotificationService } from './notification-service.js';
import type { WorkItemServiceContext, WorkItemCreationInput } from './work-item-context.js';
import { WorkItemReadService } from './work-item-read-service.js';
import { WorkItemActivity } from './work-item-activity.js';
import { WorkItemBoardPositions } from './work-item-board-positions.js';
import { lockWorkCommand, prepareWorkCreation } from './work-item-command-locks.js';
import { WorkItemWritePolicy } from './work-item-write-policy.js';

interface WorkItemActivityParent {
  id: string;
  displayKey: string;
  title: string;
}
export class WorkItemCommandService {
  private readonly clock: () => Date;
  private readonly idGenerator: () => string;
  private readonly policy: WorkItemWritePolicy;
  constructor(private readonly context: WorkItemServiceContext) {
    assertPersistence(context.persistence);
    this.policy = new WorkItemWritePolicy(context);
    this.clock = context.clock ?? (() => new Date());
    this.idGenerator = context.idGenerator ?? randomUUID;
  }
  async createWorkItem(projectId: string, input: CreateWorkItemRequest): Promise<WorkItemDetailDto> {
    return this.context.persistence.write(async (scope) => {
      await coordinateProjects(scope, this.context.actor.workspaceId, [projectId], 'shared');
      return new WorkItemCommandService({ ...this.context, ...scope }).createWorkItemInScope(projectId, input);
    });
  }

  private async createWorkItemInScope(projectId: string, input: CreateWorkItemRequest): Promise<WorkItemDetailDto> {
    return this.context.persistence.write(async (scope) => {
      return this.createWorkItemWithScope(projectId, input, scope);
    });
  }

  async createWorkItemWithScope(
    projectId: string,
    input: WorkItemCreationInput,
    scope: PersistenceScope
  ): Promise<WorkItemDetailDto> {
    return scope.persistence.write(async (current) => {
      await prepareWorkCreation(current, this.context.actor, projectId);
      return new WorkItemCommandService({ ...this.context, ...current }).insertWorkItem(projectId, input, current.repositories);
    });
  }

  private async insertWorkItem(
    projectId: string,
    input: WorkItemCreationInput,
    repositories: Repositories
  ): Promise<WorkItemDetailDto> {
    const timestamp = this.clock();
    const labelIds = input.labelIds ?? [];
    const reporterId = input.reporterId ?? this.context.actor.memberId;
    const project = await this.policy.requireProjectFromRepositories(projectId, repositories);
    this.policy.assertProjectWritable(project);
    const description = resolveNewAuthoredContent(
      { source: input.description, format: input.descriptionFormat },
      { sourceField: 'description', requireNonWhitespace: false }
    );
    await this.policy.validateLabels(projectId, labelIds, repositories);
    await this.policy.validateMilestone(projectId, input.milestoneId ?? null, repositories);
    await this.policy.validateCycle(projectId, input.cycleId ?? null, repositories);
    await this.policy.validateAssignee(input.assigneeId ?? null, repositories);
    await this.policy.validateReporter(reporterId, repositories);
    const numberedProject = await repositories.projects.allocateWorkItemNumber(projectId, timestamp);
    if (numberedProject === null || numberedProject.workspaceId !== this.context.actor.workspaceId) {
      throw new NotFoundError('Project not found.');
    }
    this.policy.assertProjectWritable(numberedProject);
    if (input.cycleId != null) await repositories.projectCycles.findManyByIdsForUpdate([input.cycleId]);
    const workItemId = this.idGenerator();
    const parent = await this.lockAndValidateParentForCreate({
      workItemId,
      projectId,
      parentWorkItemId: input.parentWorkItemId ?? null,
      repositories
    });
    const status = input.status ?? 'backlog';
    const boardPosition = await new WorkItemBoardPositions().getTopInsertionPosition(projectId, status, repositories);
    const itemNumber = numberedProject.nextWorkItemNumber - 1;

    const workItem = await repositories.workItems.create({
      id: workItemId,
      workspaceId: this.context.actor.workspaceId,
      projectId,
      title: input.title,
      description: description.source,
      descriptionFormat: description.format,
      itemNumber,
      displayKey: `${numberedProject.key}-${itemNumber}`,
      type: input.type,
      status,
      priority: input.priority,
      assigneeId: input.assigneeId ?? null,
      reporterId,
      milestoneId: input.milestoneId ?? null,
      cycleId: input.cycleId ?? null,
      parentWorkItemId: parent?.id ?? null,
      boardPosition,
      dueDate: input.dueDate ?? null,
      estimatePoints: input.estimatePoints ?? null,
      createdAt: timestamp,
      updatedAt: timestamp
    });

    await repositories.labels.replaceForWorkItem(workItem.id, labelIds);
    const activityParent = parent === null ? null : this.toActivityParent(parent);
    const activityEvent = await repositories.activityEvents.create({
      id: this.idGenerator(),
      workspaceId: workItem.workspaceId,
      projectId: workItem.projectId,
      workItemId: workItem.id,
      actorId: this.context.actor.memberId,
      eventType: 'work_item.created',
      summary: 'Work item created.',
      previousValue: null,
      newValue: {
        status: workItem.status,
        ...(activityParent === null ? {} : { parent: activityParent })
      },
      metadata: activityParent === null ? {} : { parent: activityParent },
      createdAt: timestamp
    });

    await this.notificationService(repositories).recordWorkItemCreated({
      repositories,
      workItem,
      activityEventId: activityEvent.id,
      timestamp
    });

    return new WorkItemReadService(this.context).toDetailDto(workItem, repositories);
  }

  async setParent(
    workItemId: string,
    input: SetWorkItemParentRequest
  ): Promise<WorkItemDetailDto> {
    return this.context.persistence.write(async (scope) => {
      await lockWorkCommand(scope, this.context.actor, workItemId, { hierarchy: true, parentWorkItemId: input.parentWorkItemId });
      return new WorkItemCommandService({ ...this.context, ...scope }).setParentInScope(workItemId, input);
    });
  }

  private async setParentInScope(
    workItemId: string,
    input: SetWorkItemParentRequest
  ): Promise<WorkItemDetailDto> {
    if (input.parentWorkItemId === workItemId) {
      throw new ValidationError('A work item cannot be its own parent.');
    }

    return this.withWriteRepositories(async (repositories) => {
      const lockIds = [workItemId];

      if (input.parentWorkItemId !== null) {
        lockIds.push(input.parentWorkItemId);
      }

      const lockedById = new Map(
        (await repositories.workItems.findManyByIdsForUpdate(lockIds)).map((item) => [item.id, item])
      );
      const current = lockedById.get(workItemId);

      if (current === undefined || current.workspaceId !== this.context.actor.workspaceId) {
        throw new NotFoundError('Work item not found.');
      }

      const project = await this.policy.requireProjectFromRepositories(current.projectId, repositories);
      this.policy.assertProjectWritable(project);

      if (current.parentWorkItemId === input.parentWorkItemId) {
        return new WorkItemReadService(this.context).toDetailDto(current, repositories);
      }

      const previousParent =
        current.parentWorkItemId === null
          ? null
          : await repositories.workItems.findById(current.parentWorkItemId);
      let nextParent: WorkItem | null = null;

      if (input.parentWorkItemId !== null) {
        nextParent = lockedById.get(input.parentWorkItemId) ?? null;
        this.validateProposedParent(current, nextParent);

        if (await repositories.workItems.hasChildren(current.id)) {
          throw new ConflictError('Work with children cannot be assigned a parent.');
        }
      }

      const timestamp = this.clock();
      const updated = await repositories.workItems.update(current.id, {
        parentWorkItemId: input.parentWorkItemId,
        updatedAt: timestamp
      });

      if (updated === null) {
        throw new NotFoundError('Work item not found.');
      }

      const previousActivityParent =
        previousParent === null ? null : this.toActivityParent(previousParent);
      const nextActivityParent = nextParent === null ? null : this.toActivityParent(nextParent);
      await repositories.activityEvents.create({
        id: this.idGenerator(),
        workspaceId: updated.workspaceId,
        projectId: updated.projectId,
        workItemId: updated.id,
        actorId: this.context.actor.memberId,
        eventType: 'work_item.parent_changed',
        summary: this.parentChangeSummary(previousActivityParent, nextActivityParent),
        previousValue: { parent: previousActivityParent },
        newValue: { parent: nextActivityParent },
        metadata: {},
        createdAt: timestamp
      });

      return new WorkItemReadService(this.context).toDetailDto(updated, repositories);
    });
  }

  async updateWorkItem(
    workItemId: string,
    input: UpdateWorkItemRequest
  ): Promise<WorkItemDetailDto> {
    return this.context.persistence.write(async (scope) => {
      await lockWorkCommand(scope, this.context.actor, workItemId, { hierarchy: input.type !== undefined, cycleId: input.cycleId });
      return new WorkItemCommandService({ ...this.context, ...scope }).updateWorkItemInScope(workItemId, input);
    });
  }

  private async updateWorkItemInScope(
    workItemId: string,
    input: UpdateWorkItemRequest
  ): Promise<WorkItemDetailDto> {
    return this.withWriteRepositories(async (repositories) => {
      const current = await this.requireLockedWorkItem(workItemId, repositories);

      const project = await this.policy.requireProjectFromRepositories(current.projectId, repositories);
      this.policy.assertProjectWritable(project);
      const description = resolveUpdatedAuthoredContent(
        { source: current.description, format: current.descriptionFormat },
        { source: input.description, format: input.descriptionFormat },
        { sourceField: 'description', requireNonWhitespace: false }
      );
      const currentLabels = await repositories.labels.listByWorkItem(workItemId);
      const nextLabelIds = input.labelIds === undefined ? undefined : [...new Set(input.labelIds)];

      if (nextLabelIds !== undefined) {
        await this.policy.validateLabels(current.projectId, nextLabelIds, repositories, {
          existingArchivedLabelIds: new Set(
            currentLabels.filter((label) => label.archivedAt !== null).map((label) => label.id)
          )
        });
      }

      if (input.milestoneId !== undefined) {
        await this.policy.validateMilestone(current.projectId, input.milestoneId, repositories, {
          currentMilestoneId: current.milestoneId
        });
      }

      if (input.cycleId !== undefined) {
        await this.policy.validateCycle(current.projectId, input.cycleId, repositories, {
          currentCycleId: current.cycleId
        });
      }

      if (input.assigneeId !== undefined) {
        await this.policy.validateAssignee(input.assigneeId, repositories, {
          currentAssigneeId: current.assigneeId
        });
      }

      const scalarFields = [
        'title',
        'type',
        'priority',
        'assigneeId',
        'milestoneId',
        'cycleId',
        'dueDate',
        'estimatePoints'
      ] as const;
      const scalarChanged = scalarFields.some(
        (field) => input[field] !== undefined && input[field] !== current[field]
      );
      const labelsChanged =
        nextLabelIds !== undefined &&
        !this.policy.haveSameIds(currentLabels.map((label) => label.id), nextLabelIds);

      if (!description.changed && !scalarChanged && !labelsChanged) {
        return new WorkItemReadService(this.context).toDetailDto(current, repositories);
      }

      const timestamp = this.clock();
      const updated = await repositories.workItems.update(workItemId, {
        ...(input.title === undefined ? {} : { title: input.title }),
        ...(description.changed
          ? { description: description.source, descriptionFormat: description.format }
          : {}),
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

      if (labelsChanged) {
        await repositories.labels.replaceForWorkItem(workItemId, nextLabelIds);
      }

      const updateActivity = await new WorkItemActivity(this.context).recordUpdateActivity({
        current,
        updated,
        currentLabels,
        nextLabels:
          labelsChanged ? await repositories.labels.listByWorkItem(workItemId) : currentLabels,
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

      return new WorkItemReadService(this.context).toDetailDto(updated, repositories);
    });
  }

  async transitionWorkItem(
    workItemId: string,
    input: TransitionWorkItemRequest
  ): Promise<WorkItemDetailDto> {
    return this.context.persistence.write(async (scope) => {
      await lockWorkCommand(scope, this.context.actor, workItemId, { board: true });
      return new WorkItemCommandService({ ...this.context, ...scope }).transitionWorkItemInScope(workItemId, input);
    });
  }

  private async transitionWorkItemInScope(
    workItemId: string,
    input: TransitionWorkItemRequest
  ): Promise<WorkItemDetailDto> {
    return this.withWriteRepositories(async (repositories) => {
      const current = await this.requireLockedWorkItem(workItemId, repositories);
      const project = await this.policy.requireProjectFromRepositories(current.projectId, repositories);
      this.policy.assertProjectWritable(project);

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

      if (current.status === input.status) return new WorkItemReadService(this.context).toDetailDto(current, repositories);
      const timestamp = this.clock();
      const boardPosition =
        current.status === input.status
          ? undefined
          : await new WorkItemBoardPositions().getTopInsertionPosition(current.projectId, input.status, repositories);
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

      return new WorkItemReadService(this.context).toDetailDto(updated, repositories);
    });
  }

  async moveWorkItemOnBoard(
    workItemId: string,
    input: MoveWorkItemOnBoardRequest
  ): Promise<WorkItemDetailDto> {
    return this.context.persistence.write(async (scope) => {
      await lockWorkCommand(scope, this.context.actor, workItemId, { board: true, completeColumn: input.status });
      return new WorkItemCommandService({ ...this.context, ...scope }).moveWorkItemOnBoardInScope(workItemId, input);
    });
  }

  private async moveWorkItemOnBoardInScope(
    workItemId: string,
    input: MoveWorkItemOnBoardRequest
  ): Promise<WorkItemDetailDto> {
    return this.withWriteRepositories(async (repositories) => {
      const current = await this.requireLockedWorkItem(workItemId, repositories);
      const project = await this.policy.requireProjectFromRepositories(current.projectId, repositories);
      this.policy.assertProjectWritable(project);

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
      const boardPosition = await new WorkItemBoardPositions().computeBoardPosition({
        projectId: current.projectId,
        status: input.status,
        movingWorkItemId: current.id,
        beforeWorkItemId: input.beforeWorkItemId ?? null,
        afterWorkItemId: input.afterWorkItemId ?? null,
        repositories
      });
      if (current.status === input.status && current.boardPosition === boardPosition) {
        return new WorkItemReadService(this.context).toDetailDto(current, repositories);
      }
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

      return new WorkItemReadService(this.context).toDetailDto(updated, repositories);
    });
  }

  private async lockAndValidateParentForCreate(input: {
    workItemId: string;
    projectId: string;
    parentWorkItemId: string | null;
    repositories: Repositories;
  }): Promise<WorkItem | null> {
    if (input.parentWorkItemId === null) {
      return null;
    }

    if (input.parentWorkItemId === input.workItemId) {
      throw new ValidationError('A work item cannot be its own parent.');
    }

    const [parent] = await input.repositories.workItems.findManyByIdsForUpdate([
      input.parentWorkItemId
    ]);

    if (parent === undefined || parent.workspaceId !== this.context.actor.workspaceId) {
      throw new NotFoundError('Parent work item not found.');
    }

    if (parent.projectId !== input.projectId) {
      throw new ValidationError('Parent work must belong to the same project.');
    }

    if (parent.parentWorkItemId !== null) {
      throw new ConflictError('A child work item cannot contain child work.');
    }

    return parent;
  }

  private validateProposedParent(current: WorkItem, parent: WorkItem | null): asserts parent is WorkItem {
    if (parent === null || parent.workspaceId !== this.context.actor.workspaceId) {
      throw new NotFoundError('Parent work item not found.');
    }

    if (parent.id === current.id) {
      throw new ValidationError('A work item cannot be its own parent.');
    }

    if (parent.projectId !== current.projectId) {
      throw new ValidationError('Parent work must belong to the same project.');
    }

    if (parent.parentWorkItemId !== null) {
      throw new ConflictError('A child work item cannot contain child work.');
    }
  }

  private toActivityParent(workItem: WorkItem): WorkItemActivityParent {
    return {
      id: workItem.id,
      displayKey: workItem.displayKey,
      title: workItem.title
    };
  }

  private parentChangeSummary(
    previousParent: WorkItemActivityParent | null,
    nextParent: WorkItemActivityParent | null
  ): string {
    if (previousParent === null && nextParent !== null) {
      return `Parent set to ${nextParent.displayKey}.`;
    }

    if (previousParent !== null && nextParent === null) {
      return `Parent ${previousParent.displayKey} cleared.`;
    }

    return `Parent changed from ${previousParent?.displayKey} to ${nextParent?.displayKey}.`;
  }

  private async withWriteRepositories<T>(
    callback: (repositories: Repositories) => Promise<T>
  ): Promise<T> {
    return this.context.persistence.write(({ repositories }) => callback(repositories));
  }

  private notificationService(repositories: Repositories): NotificationService {
    return new NotificationService({
      persistence: this.context.persistence,
      actor: this.context.actor,
      repositories,
      clock: this.clock,
      idGenerator: this.idGenerator
    });
  }

  private async requireLockedWorkItem(workItemId: string, repositories: Repositories): Promise<WorkItem> {
    const [workItem] = await repositories.workItems.findManyByIdsForUpdate([workItemId]);

    if (workItem === undefined || workItem.workspaceId !== this.context.actor.workspaceId) {
      throw new NotFoundError('Work item not found.');
    }

    return workItem;
  }
}
