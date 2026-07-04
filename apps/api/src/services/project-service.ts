import type {
  CreateProjectRequest,
  ProjectDto,
  ProjectNavigationSummaryDto,
  ProjectStatusCountDto,
  ProjectSummaryDto,
  UpdateProjectRequest
} from '@worktrail/contracts';
import { randomUUID } from 'node:crypto';

import type { WorktrailDb } from '../db/client.js';
import type { ActorContext } from '../domain/actor.js';
import { workItemStatuses } from '../domain/constants.js';
import {
  canArchiveProject,
  canCreateProject,
  canManageProject,
  canReactivateProject
} from '../domain/permissions.js';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../errors/app-error.js';
import {
  type Repositories,
  withRepositoriesTransaction
} from '../repositories/index.js';
import type { Project, WorkItem } from '../repositories/types.js';
import { toProjectDto, toRecentWorkItemDto } from './dto.js';

function normalizeProjectKeyInput(input: string): string {
  return input
    .trim()
    .toUpperCase()
    .replaceAll(/[^A-Z0-9]/g, '');
}

function validateProjectKey(key: string): void {
  if (!/^[A-Z0-9]{2,8}$/.test(key)) {
    throw new ValidationError('Project key must be 2-8 uppercase letters or numbers.');
  }
}

function getProjectKeyBase(name: string): string {
  const words = name.match(/[A-Za-z0-9]+/g) ?? [];
  const initials = words.map((word) => word[0]?.toUpperCase() ?? '').join('');
  const fallback = normalizeProjectKeyInput(name);
  const base = initials.length >= 2 ? initials : fallback;

  if (base.length < 2) {
    throw new ValidationError('Project key could not be generated from the project name.');
  }

  return base.slice(0, 8);
}

export interface ProjectServiceContext {
  actor: ActorContext;
  repositories: Repositories;
  db?: WorktrailDb;
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

  async listProjectNavigationSummaries(): Promise<ProjectNavigationSummaryDto[]> {
    const [projects, workItemRecords] = await Promise.all([
      this.context.repositories.projects.listByWorkspace(this.context.actor.workspaceId),
      this.context.repositories.workItems.listByWorkspace(this.context.actor.workspaceId, {
        archivedProjects: 'include',
        sort: 'updated_desc'
      })
    ]);
    const today = this.clock().toISOString().slice(0, 10);
    const workItemsByProject = new Map<string, WorkItem[]>();

    for (const record of workItemRecords) {
      workItemsByProject.set(record.workItem.projectId, [
        ...(workItemsByProject.get(record.workItem.projectId) ?? []),
        record.workItem
      ]);
    }

    return projects
      .map((project) => {
        const workItems = workItemsByProject.get(project.id) ?? [];
        const openWorkItems = workItems.filter((workItem) => isOpenWorkItem(workItem));
        const mostRecentWorkItem = workItems.reduce<WorkItem | null>(
          (mostRecent, workItem) =>
            mostRecent === null || workItem.updatedAt.getTime() > mostRecent.updatedAt.getTime()
              ? workItem
              : mostRecent,
          null
        );

        return {
          project: toProjectDto(project),
          openWorkItemCount: openWorkItems.length,
          blockedWorkItemCount: workItems.filter((workItem) => workItem.status === 'blocked').length,
          overdueWorkItemCount: openWorkItems.filter(
            (workItem) => workItem.dueDate !== null && workItem.dueDate < today
          ).length,
          updatedAt: (mostRecentWorkItem?.updatedAt ?? project.updatedAt).toISOString()
        };
      })
      .sort(compareNavigationSummaries);
  }

  async createProject(input: CreateProjectRequest): Promise<ProjectDto> {
    return this.withWriteRepositories(async (repositories) => {
      if (!canCreateProject(this.context.actor)) {
        throw new ForbiddenError('Only owners and maintainers can create projects.');
      }

      const timestamp = this.clock();
      const key =
        input.key === undefined
          ? await this.generateUniqueProjectKey(input.name, repositories)
          : await this.normalizeExplicitProjectKey(input.key, repositories);

      const project = await repositories.projects.create({
        id: this.idGenerator(),
        workspaceId: this.context.actor.workspaceId,
        key,
        nextWorkItemNumber: 1,
        name: input.name,
        description: input.description ?? '',
        status: 'active',
        createdAt: timestamp,
        updatedAt: timestamp
      });

      await repositories.workspaceActivityEvents.create({
        id: this.idGenerator(),
        workspaceId: project.workspaceId,
        actorId: this.context.actor.memberId,
        eventType: 'project.created',
        summary: `${project.name} project created.`,
        previousValue: null,
        newValue: { projectId: project.id, key: project.key, name: project.name },
        metadata: { projectId: project.id },
        createdAt: timestamp
      });

      return toProjectDto(project);
    });
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

    if (input.status === 'archived') {
      return this.archiveProject(projectId);
    }

    if (input.status === 'active') {
      return this.reactivateProject(projectId);
    }

    if (!canManageProject(this.context.actor)) {
      throw new ForbiddenError('Only owners and maintainers can update project settings.');
    }

    const timestamp = this.clock();
    const nextKey =
      input.key === undefined ? undefined : await this.normalizeProjectKeyUpdate(current, input.key);

    const updated = await this.context.repositories.projects.update(projectId, {
      ...(nextKey === undefined ? {} : { key: nextKey }),
      ...(input.name === undefined ? {} : { name: input.name }),
      ...(input.description === undefined ? {} : { description: input.description }),
      updatedAt: timestamp
    });

    if (updated === null) {
      throw new NotFoundError('Project not found.');
    }

    await this.recordProjectMetadataActivity(current, updated, timestamp);

    return toProjectDto(updated);
  }

  async archiveProject(projectId: string): Promise<ProjectDto> {
    const current = await this.requireProject(projectId);

    if (!canArchiveProject(this.context.actor)) {
      throw new ForbiddenError('Only owners and maintainers can archive projects.');
    }

    if (current.status === 'archived') {
      return toProjectDto(current);
    }

    const timestamp = this.clock();
    const updated = await this.context.repositories.projects.update(projectId, {
      status: 'archived',
      updatedAt: timestamp
    });

    if (updated === null) {
      throw new NotFoundError('Project not found.');
    }

    await this.context.repositories.activityEvents.create({
      id: this.idGenerator(),
      workspaceId: current.workspaceId,
      projectId: current.id,
      workItemId: null,
      actorId: this.context.actor.memberId,
      eventType: 'project.archived',
      summary: 'Project archived.',
      previousValue: { status: current.status },
      newValue: { status: updated.status },
      metadata: { projectId: current.id },
      createdAt: timestamp
    });

    return toProjectDto(updated);
  }

  async reactivateProject(projectId: string): Promise<ProjectDto> {
    const current = await this.requireProject(projectId);

    if (!canReactivateProject(this.context.actor)) {
      throw new ForbiddenError('Only owners and maintainers can reactivate projects.');
    }

    if (current.status === 'active') {
      return toProjectDto(current);
    }

    const timestamp = this.clock();
    const updated = await this.context.repositories.projects.update(projectId, {
      status: 'active',
      updatedAt: timestamp
    });

    if (updated === null) {
      throw new NotFoundError('Project not found.');
    }

    await this.context.repositories.activityEvents.create({
      id: this.idGenerator(),
      workspaceId: current.workspaceId,
      projectId: current.id,
      workItemId: null,
      actorId: this.context.actor.memberId,
      eventType: 'project.reactivated',
      summary: 'Project reactivated.',
      previousValue: { status: current.status },
      newValue: { status: updated.status },
      metadata: { projectId: current.id },
      createdAt: timestamp
    });

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

  private async requireProject(projectId: string): Promise<Project> {
    const project = await this.context.repositories.projects.findById(projectId);

    if (project === null || project.workspaceId !== this.context.actor.workspaceId) {
      throw new NotFoundError('Project not found.');
    }

    return project;
  }

  private async withWriteRepositories<T>(
    callback: (repositories: Repositories) => Promise<T>
  ): Promise<T> {
    if (this.context.db === undefined) {
      return callback(this.context.repositories);
    }

    return withRepositoriesTransaction(this.context.db, callback);
  }

  private async normalizeExplicitProjectKey(
    input: string,
    repositories = this.context.repositories
  ): Promise<string> {
    const key = normalizeProjectKeyInput(input);
    validateProjectKey(key);
    await this.requireAvailableProjectKey(key, undefined, repositories);
    return key;
  }

  private async normalizeProjectKeyUpdate(current: Project, input: string): Promise<string> {
    const key = normalizeProjectKeyInput(input);
    validateProjectKey(key);

    if (key === current.key) {
      return key;
    }

    if (await this.context.repositories.projects.hasWorkItems(current.id)) {
      throw new ConflictError('Project key cannot be changed after work items have been created.');
    }

    await this.requireAvailableProjectKey(key, current.id);
    return key;
  }

  private async generateUniqueProjectKey(
    name: string,
    repositories = this.context.repositories
  ): Promise<string> {
    const base = getProjectKeyBase(name);

    for (let index = 0; index < 100; index += 1) {
      const suffix = index === 0 ? '' : String(index + 1);
      const candidate = `${base.slice(0, 8 - suffix.length)}${suffix}`;
      const existing = await repositories.projects.findByWorkspaceKey(
        this.context.actor.workspaceId,
        candidate
      );

      if (existing === null) {
        return candidate;
      }
    }

    throw new ConflictError('A unique project key could not be generated.');
  }

  private async requireAvailableProjectKey(
    key: string,
    currentProjectId?: string,
    repositories = this.context.repositories
  ): Promise<void> {
    const existing = await repositories.projects.findByWorkspaceKey(
      this.context.actor.workspaceId,
      key
    );

    if (existing !== null && existing.id !== currentProjectId) {
      throw new ConflictError('Project key is already in use.');
    }
  }

  private async recordProjectMetadataActivity(
    current: Project,
    updated: Project,
    timestamp: Date
  ): Promise<void> {
    if (current.name !== updated.name) {
      await this.context.repositories.activityEvents.create({
        id: this.idGenerator(),
        workspaceId: current.workspaceId,
        projectId: current.id,
        workItemId: null,
        actorId: this.context.actor.memberId,
        eventType: 'project.name_changed',
        summary: 'Project name changed.',
        previousValue: { name: current.name },
        newValue: { name: updated.name },
        metadata: { projectId: current.id },
        createdAt: timestamp
      });
    }

    if (current.description !== updated.description) {
      await this.context.repositories.activityEvents.create({
        id: this.idGenerator(),
        workspaceId: current.workspaceId,
        projectId: current.id,
        workItemId: null,
        actorId: this.context.actor.memberId,
        eventType: 'project.description_changed',
        summary: 'Project description changed.',
        previousValue: { description: current.description },
        newValue: { description: updated.description },
        metadata: { projectId: current.id },
        createdAt: timestamp
      });
    }
  }
}

function isOpenWorkItem(workItem: WorkItem): boolean {
  return !['done', 'canceled'].includes(workItem.status);
}

function compareNavigationSummaries(
  left: ProjectNavigationSummaryDto,
  right: ProjectNavigationSummaryDto
): number {
  if (left.project.status !== right.project.status) {
    return left.project.status === 'active' ? -1 : 1;
  }

  const updatedCompare = right.updatedAt.localeCompare(left.updatedAt);

  if (updatedCompare !== 0) {
    return updatedCompare;
  }

  return left.project.key.localeCompare(right.project.key);
}
