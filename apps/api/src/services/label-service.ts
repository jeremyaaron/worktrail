import type { CreateLabelRequest, LabelDto, UpdateLabelRequest } from '@worktrail/contracts';
import { randomUUID } from 'node:crypto';

import type { WorktrailDb } from '../db/client.js';
import type { ActorContext } from '../domain/actor.js';
import { canManageProject } from '../domain/permissions.js';
import { ConflictError, ForbiddenError, NotFoundError } from '../errors/app-error.js';
import {
  type Repositories,
  withRepositoriesTransaction
} from '../repositories/index.js';
import type { Label, Project } from '../repositories/types.js';
import { toLabelDto } from './dto.js';

type ProjectLabel = Label & { projectId: string };

export interface LabelListOptions {
  includeArchived?: boolean;
}

export interface LabelServiceContext {
  actor: ActorContext;
  repositories: Repositories;
  db?: WorktrailDb;
  clock?: () => Date;
  idGenerator?: () => string;
}

export class LabelService {
  private readonly clock: () => Date;
  private readonly idGenerator: () => string;

  constructor(private readonly context: LabelServiceContext) {
    this.clock = context.clock ?? (() => new Date());
    this.idGenerator = context.idGenerator ?? randomUUID;
  }

  async listProjectLabels(projectId: string, options: LabelListOptions = {}): Promise<LabelDto[]> {
    await this.requireProject(projectId, this.context.repositories);
    const labels = await this.context.repositories.labels.listByProject(projectId, options);
    return labels.map(toLabelDto);
  }

  async createLabel(projectId: string, input: CreateLabelRequest): Promise<LabelDto> {
    return this.withWriteRepositories(async (repositories) => {
      const project = await this.requireProject(projectId, repositories);
      this.assertCanManageLabels();
      this.assertProjectWritable(project);
      await this.requireAvailableActiveName(projectId, input.name, undefined, repositories);

      const timestamp = this.clock();
      const label = await repositories.labels.create({
        id: this.idGenerator(),
        workspaceId: this.context.actor.workspaceId,
        projectId,
        name: input.name,
        color: input.color ?? null,
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
        eventType: 'label.created',
        summary: `Label ${label.name} created.`,
        previousValue: null,
        newValue: { labelId: label.id, name: label.name, color: label.color },
        metadata: { labelId: label.id },
        createdAt: timestamp
      });

      return toLabelDto(label);
    });
  }

  async updateLabel(labelId: string, input: UpdateLabelRequest): Promise<LabelDto> {
    return this.withWriteRepositories(async (repositories) => {
      const current = await this.requireProjectLabel(labelId, repositories);
      const project = await this.requireProject(current.projectId, repositories);
      this.assertCanManageLabels();
      this.assertProjectWritable(project);

      if (input.name !== undefined && current.archivedAt === null && input.name !== current.name) {
        await this.requireAvailableActiveName(current.projectId, input.name, current.id, repositories);
      }

      const timestamp = this.clock();
      const updated = await repositories.labels.update(labelId, {
        ...(input.name === undefined ? {} : { name: input.name }),
        ...(input.color === undefined ? {} : { color: input.color }),
        updatedAt: timestamp
      });

      if (updated === null) {
        throw new NotFoundError('Label not found.');
      }

      await this.recordLabelUpdateActivity(current, updated, project, timestamp, repositories);
      return toLabelDto(updated);
    });
  }

  async archiveLabel(labelId: string): Promise<LabelDto> {
    return this.withWriteRepositories(async (repositories) => {
      const current = await this.requireProjectLabel(labelId, repositories);
      const project = await this.requireProject(current.projectId, repositories);
      this.assertCanManageLabels();
      this.assertProjectWritable(project);

      if (current.archivedAt !== null) {
        return toLabelDto(current);
      }

      const timestamp = this.clock();
      const archived = await repositories.labels.archive(labelId, timestamp, this.context.actor.memberId);

      if (archived === null) {
        throw new NotFoundError('Label not found.');
      }

      await repositories.activityEvents.create({
        id: this.idGenerator(),
        workspaceId: project.workspaceId,
        projectId: project.id,
        workItemId: null,
        actorId: this.context.actor.memberId,
        eventType: 'label.archived',
        summary: `Label ${current.name} archived.`,
        previousValue: { archivedAt: current.archivedAt },
        newValue: { archivedAt: archived.archivedAt?.toISOString() ?? null },
        metadata: { labelId: current.id },
        createdAt: timestamp
      });

      return toLabelDto(archived);
    });
  }

  async reactivateLabel(labelId: string): Promise<LabelDto> {
    return this.withWriteRepositories(async (repositories) => {
      const current = await this.requireProjectLabel(labelId, repositories);
      const project = await this.requireProject(current.projectId, repositories);
      this.assertCanManageLabels();
      this.assertProjectWritable(project);

      if (current.archivedAt === null) {
        return toLabelDto(current);
      }

      await this.requireAvailableActiveName(current.projectId, current.name, current.id, repositories);

      const timestamp = this.clock();
      const reactivated = await repositories.labels.reactivate(labelId, timestamp);

      if (reactivated === null) {
        throw new NotFoundError('Label not found.');
      }

      await repositories.activityEvents.create({
        id: this.idGenerator(),
        workspaceId: project.workspaceId,
        projectId: project.id,
        workItemId: null,
        actorId: this.context.actor.memberId,
        eventType: 'label.reactivated',
        summary: `Label ${current.name} reactivated.`,
        previousValue: { archivedAt: current.archivedAt?.toISOString() ?? null },
        newValue: { archivedAt: null },
        metadata: { labelId: current.id },
        createdAt: timestamp
      });

      return toLabelDto(reactivated);
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

  private async requireProject(projectId: string, repositories: Repositories): Promise<Project> {
    const project = await repositories.projects.findById(projectId);

    if (project === null || project.workspaceId !== this.context.actor.workspaceId) {
      throw new NotFoundError('Project not found.');
    }

    return project;
  }

  private async requireProjectLabel(
    labelId: string,
    repositories: Repositories
  ): Promise<ProjectLabel> {
    const label = await repositories.labels.findById(labelId);

    if (
      label === null ||
      label.workspaceId !== this.context.actor.workspaceId ||
      label.projectId === null
    ) {
      throw new NotFoundError('Label not found.');
    }

    return label as ProjectLabel;
  }

  private assertProjectWritable(project: Project): void {
    if (project.status === 'archived') {
      throw new ConflictError('Archived projects are read-only.');
    }
  }

  private assertCanManageLabels(): void {
    if (!canManageProject(this.context.actor)) {
      throw new ForbiddenError('Only owners and maintainers can manage labels.');
    }
  }

  private async requireAvailableActiveName(
    projectId: string,
    name: string,
    currentLabelId: string | undefined,
    repositories: Repositories
  ): Promise<void> {
    const existing = await repositories.labels.findActiveByProjectName(projectId, name);

    if (existing !== null && existing.id !== currentLabelId) {
      throw new ConflictError('An active label with this name already exists.');
    }
  }

  private async recordLabelUpdateActivity(
    current: Label,
    updated: Label,
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
        eventType: 'label.name_changed',
        summary: `Label ${current.name} renamed to ${updated.name}.`,
        previousValue: { name: current.name },
        newValue: { name: updated.name },
        metadata: { labelId: current.id },
        createdAt: timestamp
      });
    }

    if (current.color !== updated.color) {
      await repositories.activityEvents.create({
        id: this.idGenerator(),
        workspaceId: project.workspaceId,
        projectId: project.id,
        workItemId: null,
        actorId: this.context.actor.memberId,
        eventType: 'label.color_changed',
        summary: `Label ${updated.name} color changed.`,
        previousValue: { color: current.color },
        newValue: { color: updated.color },
        metadata: { labelId: current.id },
        createdAt: timestamp
      });
    }
  }
}
