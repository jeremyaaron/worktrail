import type {
  CreateProjectRequest,
  ProjectDto,
  ProjectStatusCountDto,
  ProjectSummaryDto,
  UpdateProjectRequest
} from '@worktrail/contracts';
import { randomUUID } from 'node:crypto';

import type { ActorContext } from '../domain/actor.js';
import { workItemStatuses } from '../domain/constants.js';
import { canArchiveProject, canReactivateProject } from '../domain/permissions.js';
import { ForbiddenError, NotFoundError } from '../errors/app-error.js';
import type { Repositories } from '../repositories/index.js';
import { toProjectDto, toRecentWorkItemDto } from './dto.js';

export interface ProjectServiceContext {
  actor: ActorContext;
  repositories: Repositories;
  clock?: () => Date;
  idGenerator?: () => string;
}

export class ProjectService {
  private readonly clock: () => Date;
  private readonly idGenerator: () => string;

  constructor(private readonly context: ProjectServiceContext) {
    this.clock = context.clock ?? (() => new Date());
    this.idGenerator = context.idGenerator ?? randomUUID;
  }

  async listProjects(): Promise<ProjectDto[]> {
    const projects = await this.context.repositories.projects.listByWorkspace(
      this.context.actor.workspaceId
    );
    return projects.map(toProjectDto);
  }

  async createProject(input: CreateProjectRequest): Promise<ProjectDto> {
    const timestamp = this.clock();
    const project = await this.context.repositories.projects.create({
      id: this.idGenerator(),
      workspaceId: this.context.actor.workspaceId,
      name: input.name,
      description: input.description ?? '',
      status: 'active',
      createdAt: timestamp,
      updatedAt: timestamp
    });

    return toProjectDto(project);
  }

  async getProject(projectId: string): Promise<ProjectDto> {
    const project = await this.context.repositories.projects.findById(projectId);

    if (project === null || project.workspaceId !== this.context.actor.workspaceId) {
      throw new NotFoundError('Project not found.');
    }

    return toProjectDto(project);
  }

  async updateProject(projectId: string, input: UpdateProjectRequest): Promise<ProjectDto> {
    const current = await this.context.repositories.projects.findById(projectId);

    if (current === null || current.workspaceId !== this.context.actor.workspaceId) {
      throw new NotFoundError('Project not found.');
    }

    if (input.status === 'archived' && current.status !== 'archived' && !canArchiveProject(this.context.actor)) {
      throw new ForbiddenError('Only owners and maintainers can archive projects.');
    }

    if (input.status === 'active' && current.status === 'archived' && !canReactivateProject(this.context.actor)) {
      throw new ForbiddenError('Only owners and maintainers can reactivate projects.');
    }

    const updated = await this.context.repositories.projects.update(projectId, {
      ...(input.name === undefined ? {} : { name: input.name }),
      ...(input.description === undefined ? {} : { description: input.description }),
      ...(input.status === undefined ? {} : { status: input.status }),
      updatedAt: this.clock()
    });

    if (updated === null) {
      throw new NotFoundError('Project not found.');
    }

    return toProjectDto(updated);
  }

  async getProjectSummary(projectId: string): Promise<ProjectSummaryDto> {
    const project = await this.getProject(projectId);
    const counts = await this.context.repositories.workItems.countByStatus(projectId);
    const recentWorkItems = await this.context.repositories.workItems.listRecentByProject(projectId);
    const countByStatus = new Map(counts.map((item) => [item.status, item.count]));

    return {
      project,
      countsByStatus: workItemStatuses.map(
        (status): ProjectStatusCountDto => ({
          status,
          count: countByStatus.get(status) ?? 0
        })
      ),
      recentWorkItems: recentWorkItems.map(toRecentWorkItemDto)
    };
  }
}

