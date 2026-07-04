import type {
  CreateWorkItemRequest,
  TransitionWorkItemRequest,
  UpdateWorkItemRequest,
  WorkItemDetailDto,
  WorkItemListItemDto,
  WorkItemSort
} from '@worktrail/contracts';
import { randomUUID } from 'node:crypto';

import type { WorktrailDb } from '../db/client.js';
import type { ActorContext } from '../domain/actor.js';
import type { WorkItemStatus } from '../domain/constants.js';
import { canTransitionWorkItem } from '../domain/workflow.js';
import {
  ConflictError,
  NotFoundError,
  ValidationError,
  WorkflowTransitionError
} from '../errors/app-error.js';
import {
  type Repositories,
  withRepositoriesTransaction
} from '../repositories/index.js';
import type { ActivityEvent, Comment, Label, Member, Project, WorkItem } from '../repositories/types.js';
import {
  toActivityEventDto,
  toCommentDto,
  toWorkItemDetailDto,
  toWorkItemListItemDto
} from './dto.js';

export interface WorkItemListFilters {
  status?: WorkItemStatus;
  assigneeId?: string;
  type?: WorkItem['type'];
  labelId?: string;
  priority?: WorkItem['priority'];
  search?: string;
  sort?: WorkItemSort;
}

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

  async createWorkItem(projectId: string, input: CreateWorkItemRequest): Promise<WorkItemDetailDto> {
    return this.withWriteRepositories(async (repositories) => {
      const timestamp = this.clock();
      const labelIds = input.labelIds ?? [];
      const project = await this.requireProjectFromRepositories(projectId, repositories);
      this.assertProjectWritable(project);
      await this.validateLabels(projectId, labelIds, repositories);
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
        status: input.status ?? 'backlog',
        priority: input.priority,
        assigneeId: input.assigneeId ?? null,
        reporterId: this.context.actor.memberId,
        dueDate: input.dueDate ?? null,
        estimatePoints: input.estimatePoints ?? null,
        createdAt: timestamp,
        updatedAt: timestamp
      });

      await repositories.labels.replaceForWorkItem(workItem.id, labelIds);
      await repositories.activityEvents.create({
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

      return this.toDetailDto(workItem, repositories);
    });
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
        await this.validateLabels(current.projectId, nextLabelIds, repositories);
      }

      const updated = await repositories.workItems.update(workItemId, {
        ...(input.title === undefined ? {} : { title: input.title }),
        ...(input.description === undefined ? {} : { description: input.description }),
        ...(input.type === undefined ? {} : { type: input.type }),
        ...(input.priority === undefined ? {} : { priority: input.priority }),
        ...(input.assigneeId === undefined ? {} : { assigneeId: input.assigneeId }),
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

      await this.recordUpdateActivity({
        current,
        updated,
        currentLabels,
        nextLabels:
          nextLabelIds === undefined ? currentLabels : await repositories.labels.listByWorkItem(workItemId),
        repositories,
        timestamp
      });

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
      const updated = await repositories.workItems.updateStatus(workItemId, input.status, timestamp);

      if (updated === null) {
        throw new NotFoundError('Work item not found.');
      }

      if (current.status !== updated.status) {
        await repositories.activityEvents.create({
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

  private async validateLabels(
    projectId: string,
    labelIds: string[],
    repositories: Repositories
  ): Promise<void> {
    const uniqueLabelIds = [...new Set(labelIds)];
    const labels = await repositories.labels.listByIds(uniqueLabelIds);

    if (
      labels.length !== uniqueLabelIds.length ||
      labels.some(
        (label) =>
          label.workspaceId !== this.context.actor.workspaceId ||
          (label.projectId !== null && label.projectId !== projectId) ||
          label.archivedAt !== null
      )
    ) {
      throw new ValidationError('One or more labels are invalid for this project.');
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

    return Promise.all(
      workItems.map(async (workItem) => {
        const bundle = await this.toBundle(workItem, repositories, labelsByWorkItem.get(workItem.id) ?? []);
        return toWorkItemListItemDto(bundle);
      })
    );
  }

  private async toDetailDto(
    workItem: WorkItem,
    repositories: Repositories
  ): Promise<WorkItemDetailDto> {
    const labels = await repositories.labels.listByWorkItem(workItem.id);
    const comments = await repositories.comments.findByWorkItem(workItem.id);
    const activity = await repositories.activityEvents.findByWorkItem(workItem.id);

    return toWorkItemDetailDto({
      ...(await this.toBundle(workItem, repositories, labels)),
      comments: await this.toCommentDtos(comments, repositories),
      activity: await this.toActivityDtos(activity, repositories)
    });
  }

  private async toBundle(
    workItem: WorkItem,
    repositories: Repositories,
    labels: Label[]
  ): Promise<WorkItemBundle> {
    const reporter = await repositories.members.findById(workItem.reporterId);
    const assignee =
      workItem.assigneeId === null ? null : await repositories.members.findById(workItem.assigneeId);

    if (reporter === null) {
      throw new NotFoundError('Work item reporter not found.');
    }

    return {
      workItem,
      assignee,
      reporter,
      labels
    };
  }

  private async toCommentDtos(comments: Comment[], repositories: Repositories) {
    return Promise.all(
      comments.map(async (comment) => {
        const author = await this.requireMember(comment.authorId, repositories, 'Comment author not found.');
        return toCommentDto(comment, author);
      })
    );
  }

  private async toActivityDtos(activity: ActivityEvent[], repositories: Repositories) {
    return Promise.all(
      activity.map(async (event) => {
        const actor = await this.requireMember(event.actorId, repositories, 'Activity actor not found.');
        return toActivityEventDto(event, actor);
      })
    );
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
  }): Promise<void> {
    await this.recordFieldActivity(input, 'title', 'work_item.title_changed');
    await this.recordFieldActivity(input, 'description', 'work_item.description_changed');
    await this.recordFieldActivity(input, 'priority', 'work_item.priority_changed');
    await this.recordFieldActivity(input, 'assigneeId', 'work_item.assignee_changed');

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
  ): Promise<void> {
    if (input.current[field] === input.updated[field]) {
      return;
    }

    await input.repositories.activityEvents.create({
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
}
