import { coordinateProjects } from './project-write-coordination.js';
import type {
  BulkUpdateWorkItemsAction,
  BulkUpdateWorkItemsErrorCode,
  BulkUpdateWorkItemsRequest,
  BulkUpdateWorkItemsResponseDto,
  BulkUpdateWorkItemsResultDto,
  WorkItemListItemDto
} from '@worktrail/contracts';
import { randomUUID } from 'node:crypto';
import { assertPersistence, type PersistenceScope } from '../repositories/persistence.js';
import type { WorkItemStatus } from '../domain/constants.js';
import { canTransitionWorkItem } from '../domain/workflow.js';
import { AppError, ForbiddenError, NotFoundError, WorkflowTransitionError } from '../errors/app-error.js';
import type { Repositories } from '../repositories/index.js';
import type { Label, WorkItem } from '../repositories/types.js';
import { WorkItemHydrator } from './work-item-hydrator.js';
import type { WorkItemServiceContext } from './work-item-context.js';
import { WorkItemActivity } from './work-item-activity.js';
import { WorkItemBoardPositions } from './work-item-board-positions.js';
import { lockWorkCommand } from './work-item-command-locks.js';
import { WorkItemWritePolicy } from './work-item-write-policy.js';
import { NotificationService } from './notification-service.js';

class BulkWorkItemFailure extends Error {
  constructor(readonly failure: AppError, readonly displayKey: string) { super(failure.message); }
}
export class WorkItemBulkCommandService {
  private readonly clock: () => Date;
  private readonly idGenerator: () => string;
  private readonly policy: WorkItemWritePolicy;
  constructor(private readonly context: WorkItemServiceContext) {
    assertPersistence(context.persistence);
    this.policy = new WorkItemWritePolicy(context);
    this.clock = context.clock ?? (() => new Date());
    this.idGenerator = context.idGenerator ?? randomUUID;
  }
  async bulkUpdateWorkItems(
    projectId: string,
    input: BulkUpdateWorkItemsRequest
  ): Promise<BulkUpdateWorkItemsResponseDto> {
    const project = await this.policy.requireProject(projectId);
    this.policy.assertProjectWritable(project);
    this.assertCanBulkUpdateWorkItems();
    await this.validateBulkActionReferences(projectId, input.action, this.context.repositories);

    const results: BulkUpdateWorkItemsResultDto[] = [];

    for (const workItemId of input.workItemIds) {
      try {
        results.push(
          await this.context.persistence.write(async (scope) => {
            await coordinateProjects(scope, this.context.actor.workspaceId, [projectId], 'shared');
            const service = new WorkItemBulkCommandService({ ...this.context, ...scope });
            service.policy.assertProjectWritable(await service.policy.requireProject(projectId));
            return service.applyBulkActionToWorkItem({
              projectId,
              workItemId,
              action: input.action,
              repositories: scope.repositories,
              scope
            });
          })
        );
      } catch (error) {
        if (error instanceof AppError || error instanceof BulkWorkItemFailure) {
          const failure = error instanceof BulkWorkItemFailure ? error.failure : error;
          results.push({
            workItemId,
            displayKey: error instanceof BulkWorkItemFailure ? error.displayKey : null,
            status: 'failed',
            workItem: null,
            error: {
              code: this.toBulkErrorCode(failure),
              message: failure.message
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
      await this.policy.validateAssignee(action.assigneeId, repositories);
      return;
    }

    if (action.type === 'set_milestone') {
      await this.policy.validateMilestone(projectId, action.milestoneId, repositories);
      return;
    }

    if (action.type === 'set_cycle') {
      await this.policy.validateCycle(projectId, action.cycleId, repositories);
      return;
    }

    if (action.type === 'add_labels' || action.type === 'remove_labels') {
      await this.policy.validateLabels(projectId, action.labelIds, repositories);
    }
  }

  private async applyBulkActionToWorkItem(input: {
    projectId: string;
    workItemId: string;
    action: BulkUpdateWorkItemsAction;
    repositories: Repositories;
    scope: PersistenceScope;
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
      const locked = await lockWorkCommand(input.scope, this.context.actor, input.workItemId, {
        board: input.action.type === 'transition_status',
        cycleId: input.action.type === 'set_cycle' ? input.action.cycleId : input.action.type === 'clear_cycle' ? null : undefined
      });
      if (input.action.type === 'transition_status') {
        return await this.transitionBulkWorkItem(locked, input.action.status, input.repositories);
      }

      return await this.updateBulkWorkItem(locked, input.action, input.repositories);
    } catch (error) {
      if (error instanceof AppError) {
        throw new BulkWorkItemFailure(error, current.displayKey);
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
      await this.policy.validateLabels(current.projectId, nextUpdate.labelIds, repositories, {
        existingArchivedLabelIds: new Set(
          currentLabels.filter((label) => label.archivedAt !== null).map((label) => label.id)
        )
      });
    }

    if (nextUpdate.patch.milestoneId !== undefined) {
      await this.policy.validateMilestone(current.projectId, nextUpdate.patch.milestoneId, repositories, {
        currentMilestoneId: current.milestoneId
      });
    }

    if (nextUpdate.patch.cycleId !== undefined) {
      await this.policy.validateCycle(current.projectId, nextUpdate.patch.cycleId, repositories, {
        currentCycleId: current.cycleId
      });
    }

    if (nextUpdate.patch.assigneeId !== undefined) {
      await this.policy.validateAssignee(nextUpdate.patch.assigneeId, repositories, {
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

    const updateActivity = await new WorkItemActivity(this.context).recordUpdateActivity({
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
      return this.policy.haveSameIds(currentLabelIds, nextLabelIds) ? null : { patch: {}, labelIds: nextLabelIds };
    }

    const removedLabelIds = new Set(action.labelIds);
    const nextLabelIds = currentLabelIds.filter((labelId) => !removedLabelIds.has(labelId));
    return this.policy.haveSameIds(currentLabelIds, nextLabelIds) ? null : { patch: {}, labelIds: nextLabelIds };
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
    const boardPosition = await new WorkItemBoardPositions().getTopInsertionPosition(current.projectId, status, repositories);
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

  private async toListDtos(
    workItems: WorkItem[],
    repositories: Repositories
  ): Promise<WorkItemListItemDto[]> {
    return new WorkItemHydrator(repositories).list(workItems);
  }

  private notificationService(repositories: Repositories): NotificationService {
    return new NotificationService({ ...this.context, repositories, clock: this.clock, idGenerator: this.idGenerator });
  }
}
