import { ConflictError, NotFoundError, ValidationError } from '../errors/app-error.js';
import type { Repositories } from '../repositories/index.js';
import type { Project } from '../repositories/types.js';
import type { WorkItemServiceContext } from './work-item-context.js';

export class WorkItemWritePolicy {
  constructor(private readonly context: Pick<WorkItemServiceContext, 'actor' | 'repositories'>) {}
  haveSameIds(left: string[], right: string[]): boolean {
    if (left.length !== right.length) {
      return false;
    }

    const rightIds = new Set(right);
    return left.every((value) => rightIds.has(value));
  }

  async requireProject(projectId: string): Promise<Project> {
    return this.requireProjectFromRepositories(projectId, this.context.repositories);
  }

  async requireProjectFromRepositories(
    projectId: string,
    repositories: Repositories
  ): Promise<Project> {
    const project = await repositories.projects.findById(projectId);

    if (project === null || project.workspaceId !== this.context.actor.workspaceId) {
      throw new NotFoundError('Project not found.');
    }

    return project;
  }

  assertProjectWritable(project: Project): void {
    if (project.status === 'archived') {
      throw new ConflictError('Archived projects are read-only.');
    }
  }

  async validateLabels(
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

  async validateMilestone(
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

  async validateCycle(
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

  async validateAssignee(
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

  async validateReporter(reporterId: string, repositories: Repositories): Promise<void> {
    const reporter = await repositories.members.findById(reporterId);

    if (
      reporter === null ||
      reporter.workspaceId !== this.context.actor.workspaceId ||
      !reporter.isActive
    ) {
      throw new ValidationError('Reporter must be an active workspace member.');
    }
  }
}
