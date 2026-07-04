import type { CreateMilestoneRequest, MilestoneDto, UpdateMilestoneRequest } from '@worktrail/contracts';
import { randomUUID } from 'node:crypto';

import type { WorktrailDb } from '../db/client.js';
import type { ActorContext } from '../domain/actor.js';
import { canManageMilestones } from '../domain/permissions.js';
import { ConflictError, ForbiddenError, NotFoundError } from '../errors/app-error.js';
import {
  type Repositories,
  withRepositoriesTransaction
} from '../repositories/index.js';
import type { Milestone, Project } from '../repositories/types.js';
import { toMilestoneDto } from './dto.js';

export interface MilestoneListOptions {
  includeArchived?: boolean;
  status?: Milestone['status'];
}

export interface MilestoneServiceContext {
  actor: ActorContext;
  repositories: Repositories;
  db?: WorktrailDb;
  clock?: () => Date;
  idGenerator?: () => string;
}

export class MilestoneService {
  private readonly clock: () => Date;
  private readonly idGenerator: () => string;

  constructor(private readonly context: MilestoneServiceContext) {
    this.clock = context.clock ?? (() => new Date());
    this.idGenerator = context.idGenerator ?? randomUUID;
  }

  async listProjectMilestones(
    projectId: string,
    options: MilestoneListOptions = {}
  ): Promise<MilestoneDto[]> {
    await this.requireProject(projectId, this.context.repositories);
    const milestones = await this.context.repositories.milestones.listByProject(projectId, options);
    return milestones.map(toMilestoneDto);
  }

  async createMilestone(projectId: string, input: CreateMilestoneRequest): Promise<MilestoneDto> {
    return this.withWriteRepositories(async (repositories) => {
      this.assertCanManageMilestones();
      const project = await this.requireProject(projectId, repositories);
      this.assertProjectWritable(project);
      await this.requireAvailableActiveName(projectId, input.name, undefined, repositories);

      const timestamp = this.clock();
      const milestone = await repositories.milestones.create({
        id: this.idGenerator(),
        workspaceId: this.context.actor.workspaceId,
        projectId,
        name: input.name,
        description: input.description ?? '',
        status: input.status ?? 'planned',
        targetDate: input.targetDate ?? null,
        archivedAt: null,
        archivedById: null,
        createdAt: timestamp,
        updatedAt: timestamp
      });

      await repositories.activityEvents.create({
        id: this.idGenerator(),
        workspaceId: project.workspaceId,
        projectId: project.id,
        workItemId: null,
        actorId: this.context.actor.memberId,
        eventType: 'milestone.created',
        summary: `Milestone ${milestone.name} created.`,
        previousValue: null,
        newValue: {
          milestoneId: milestone.id,
          name: milestone.name,
          status: milestone.status,
          targetDate: milestone.targetDate
        },
        metadata: { milestoneId: milestone.id },
        createdAt: timestamp
      });

      return toMilestoneDto(milestone);
    });
  }

  async updateMilestone(
    milestoneId: string,
    input: UpdateMilestoneRequest
  ): Promise<MilestoneDto> {
    return this.withWriteRepositories(async (repositories) => {
      this.assertCanManageMilestones();
      const current = await this.requireMilestone(milestoneId, repositories);
      const project = await this.requireProject(current.projectId, repositories);
      this.assertProjectWritable(project);

      if (
        input.name !== undefined &&
        current.archivedAt === null &&
        input.name.toLowerCase() !== current.name.toLowerCase()
      ) {
        await this.requireAvailableActiveName(current.projectId, input.name, current.id, repositories);
      }

      const timestamp = this.clock();
      const updated = await repositories.milestones.update(milestoneId, {
        ...(input.name === undefined ? {} : { name: input.name }),
        ...(input.description === undefined ? {} : { description: input.description }),
        ...(input.status === undefined ? {} : { status: input.status }),
        ...(input.targetDate === undefined ? {} : { targetDate: input.targetDate }),
        updatedAt: timestamp
      });

      if (updated === null) {
        throw new NotFoundError('Milestone not found.');
      }

      await this.recordMilestoneUpdateActivity(current, updated, project, timestamp, repositories);
      return toMilestoneDto(updated);
    });
  }

  async archiveMilestone(milestoneId: string): Promise<MilestoneDto> {
    return this.withWriteRepositories(async (repositories) => {
      this.assertCanManageMilestones();
      const current = await this.requireMilestone(milestoneId, repositories);
      const project = await this.requireProject(current.projectId, repositories);
      this.assertProjectWritable(project);

      if (current.archivedAt !== null) {
        return toMilestoneDto(current);
      }

      const timestamp = this.clock();
      const archived = await repositories.milestones.archive(
        milestoneId,
        timestamp,
        this.context.actor.memberId
      );

      if (archived === null) {
        throw new NotFoundError('Milestone not found.');
      }

      await repositories.activityEvents.create({
        id: this.idGenerator(),
        workspaceId: project.workspaceId,
        projectId: project.id,
        workItemId: null,
        actorId: this.context.actor.memberId,
        eventType: 'milestone.archived',
        summary: `Milestone ${current.name} archived.`,
        previousValue: { archivedAt: current.archivedAt },
        newValue: { archivedAt: archived.archivedAt?.toISOString() ?? null },
        metadata: { milestoneId: current.id },
        createdAt: timestamp
      });

      return toMilestoneDto(archived);
    });
  }

  async reactivateMilestone(milestoneId: string): Promise<MilestoneDto> {
    return this.withWriteRepositories(async (repositories) => {
      this.assertCanManageMilestones();
      const current = await this.requireMilestone(milestoneId, repositories);
      const project = await this.requireProject(current.projectId, repositories);
      this.assertProjectWritable(project);

      if (current.archivedAt === null) {
        return toMilestoneDto(current);
      }

      await this.requireAvailableActiveName(current.projectId, current.name, current.id, repositories);

      const timestamp = this.clock();
      const reactivated = await repositories.milestones.reactivate(milestoneId, timestamp);

      if (reactivated === null) {
        throw new NotFoundError('Milestone not found.');
      }

      await repositories.activityEvents.create({
        id: this.idGenerator(),
        workspaceId: project.workspaceId,
        projectId: project.id,
        workItemId: null,
        actorId: this.context.actor.memberId,
        eventType: 'milestone.reactivated',
        summary: `Milestone ${current.name} reactivated.`,
        previousValue: { archivedAt: current.archivedAt?.toISOString() ?? null },
        newValue: { archivedAt: null },
        metadata: { milestoneId: current.id },
        createdAt: timestamp
      });

      return toMilestoneDto(reactivated);
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

  private assertCanManageMilestones(): void {
    if (!canManageMilestones(this.context.actor)) {
      throw new ForbiddenError('Only owners and maintainers can manage milestones.');
    }
  }

  private async requireProject(projectId: string, repositories: Repositories): Promise<Project> {
    const project = await repositories.projects.findById(projectId);

    if (project === null || project.workspaceId !== this.context.actor.workspaceId) {
      throw new NotFoundError('Project not found.');
    }

    return project;
  }

  private async requireMilestone(
    milestoneId: string,
    repositories: Repositories
  ): Promise<Milestone> {
    const milestone = await repositories.milestones.findById(milestoneId);

    if (milestone === null || milestone.workspaceId !== this.context.actor.workspaceId) {
      throw new NotFoundError('Milestone not found.');
    }

    return milestone;
  }

  private assertProjectWritable(project: Project): void {
    if (project.status === 'archived') {
      throw new ConflictError('Archived projects are read-only.');
    }
  }

  private async requireAvailableActiveName(
    projectId: string,
    name: string,
    currentMilestoneId: string | undefined,
    repositories: Repositories
  ): Promise<void> {
    const existing = await repositories.milestones.findActiveByProjectName(projectId, name);

    if (existing !== null && existing.id !== currentMilestoneId) {
      throw new ConflictError('An active milestone with this name already exists.');
    }
  }

  private async recordMilestoneUpdateActivity(
    current: Milestone,
    updated: Milestone,
    project: Project,
    timestamp: Date,
    repositories: Repositories
  ): Promise<void> {
    if (current.name !== updated.name) {
      await repositories.activityEvents.create({
        id: this.idGenerator(),
        workspaceId: project.workspaceId,
        projectId: project.id,
        workItemId: null,
        actorId: this.context.actor.memberId,
        eventType: 'milestone.name_changed',
        summary: `Milestone ${current.name} renamed to ${updated.name}.`,
        previousValue: { name: current.name },
        newValue: { name: updated.name },
        metadata: { milestoneId: current.id },
        createdAt: timestamp
      });
    }

    if (current.description !== updated.description) {
      await repositories.activityEvents.create({
        id: this.idGenerator(),
        workspaceId: project.workspaceId,
        projectId: project.id,
        workItemId: null,
        actorId: this.context.actor.memberId,
        eventType: 'milestone.description_changed',
        summary: `Milestone ${updated.name} description changed.`,
        previousValue: { description: current.description },
        newValue: { description: updated.description },
        metadata: { milestoneId: current.id },
        createdAt: timestamp
      });
    }

    if (current.status !== updated.status) {
      await repositories.activityEvents.create({
        id: this.idGenerator(),
        workspaceId: project.workspaceId,
        projectId: project.id,
        workItemId: null,
        actorId: this.context.actor.memberId,
        eventType: 'milestone.status_changed',
        summary: `Milestone ${updated.name} status changed from ${current.status} to ${updated.status}.`,
        previousValue: { status: current.status },
        newValue: { status: updated.status },
        metadata: { milestoneId: current.id },
        createdAt: timestamp
      });
    }

    if (current.targetDate !== updated.targetDate) {
      await repositories.activityEvents.create({
        id: this.idGenerator(),
        workspaceId: project.workspaceId,
        projectId: project.id,
        workItemId: null,
        actorId: this.context.actor.memberId,
        eventType: 'milestone.target_date_changed',
        summary: `Milestone ${updated.name} target date changed.`,
        previousValue: { targetDate: current.targetDate },
        newValue: { targetDate: updated.targetDate },
        metadata: { milestoneId: current.id },
        createdAt: timestamp
      });
    }
  }
}
