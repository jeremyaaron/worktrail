import { randomUUID } from 'node:crypto';
import type { WorkItemServiceContext } from './work-item-context.js';
import type { Repositories } from '../repositories/index.js';
import type { ActivityEvent, Label, WorkItem } from '../repositories/types.js';
import { createWorkItemCycleChangedActivity } from './work-item-cycle-activity.js';

export class WorkItemActivity {
  private readonly idGenerator: () => string;
  constructor(private readonly context: WorkItemServiceContext) {
    this.idGenerator = context.idGenerator ?? randomUUID;
  }
  async recordUpdateActivity(input: {
    current: WorkItem;
    updated: WorkItem;
    currentLabels: Label[];
    nextLabels: Label[];
    repositories: Repositories;
    timestamp: Date;
  }): Promise<{ assigneeActivityEventId: string | null }> {
    await this.recordFieldActivity(input, 'title', 'work_item.title_changed');
    await this.recordDescriptionActivity(input);
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
    field: 'title' | 'priority' | 'assigneeId',
    eventType:
      | 'work_item.title_changed'
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

  private async recordDescriptionActivity(input: {
    current: WorkItem;
    updated: WorkItem;
    repositories: Repositories;
    timestamp: Date;
  }): Promise<void> {
    const { current, updated } = input;

    if (
      current.description === updated.description &&
      current.descriptionFormat === updated.descriptionFormat
    ) {
      return;
    }

    await input.repositories.activityEvents.create({
      id: this.idGenerator(),
      workspaceId: updated.workspaceId,
      projectId: updated.projectId,
      workItemId: updated.id,
      actorId: this.context.actor.memberId,
      eventType: 'work_item.description_changed',
      summary:
        current.description === updated.description
          ? 'Description format changed.'
          : 'description changed.',
      previousValue: {
        description: current.description,
        descriptionFormat: current.descriptionFormat
      },
      newValue: {
        description: updated.description,
        descriptionFormat: updated.descriptionFormat
      },
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

    await input.repositories.activityEvents.create(
      createWorkItemCycleChangedActivity({
        id: this.idGenerator(),
        workItem: input.updated,
        previousCycle,
        nextCycle,
        actorId: this.context.actor.memberId,
        createdAt: input.timestamp
      })
    );
  }
}
