import type { WorkItemWatchStateDto } from '@worktrail/contracts';
import { randomUUID } from 'node:crypto';

import type { ActorContext } from '../domain/actor.js';
import { ConflictError, NotFoundError } from '../errors/app-error.js';
import type { Repositories } from '../repositories/index.js';
import type { Member, Project, WorkItem, WorkItemWatcher } from '../repositories/types.js';
import { toMemberDto } from './dto.js';

export interface WorkItemWatcherServiceContext {
  actor: ActorContext;
  repositories: Repositories;
  clock?: () => Date;
  idGenerator?: () => string;
}

export class WorkItemWatcherService {
  private readonly clock: () => Date;
  private readonly idGenerator: () => string;

  constructor(private readonly context: WorkItemWatcherServiceContext) {
    this.clock = context.clock ?? (() => new Date());
    this.idGenerator = context.idGenerator ?? randomUUID;
  }

  async getWatchState(workItemId: string): Promise<WorkItemWatchStateDto> {
    const workItem = await this.requireWorkItem(workItemId);
    return this.toWatchStateDto(workItem.id);
  }

  async watch(workItemId: string): Promise<WorkItemWatchStateDto> {
    const workItem = await this.requireWorkItem(workItemId);
    const project = await this.requireProject(workItem.projectId);
    this.assertProjectWritable(project);
    const timestamp = this.clock();

    await this.context.repositories.workItemWatchers.watch({
      id: this.idGenerator(),
      workspaceId: workItem.workspaceId,
      workItemId: workItem.id,
      memberId: this.context.actor.memberId,
      watchedAt: timestamp,
      unwatchedAt: null,
      createdAt: timestamp,
      updatedAt: timestamp
    });

    return this.toWatchStateDto(workItem.id);
  }

  async unwatch(workItemId: string): Promise<WorkItemWatchStateDto> {
    const workItem = await this.requireWorkItem(workItemId);
    const project = await this.requireProject(workItem.projectId);
    this.assertProjectWritable(project);
    const timestamp = this.clock();

    await this.context.repositories.workItemWatchers.unwatch({
      workItemId: workItem.id,
      memberId: this.context.actor.memberId,
      unwatchedAt: timestamp,
      updatedAt: timestamp
    });

    return this.toWatchStateDto(workItem.id);
  }

  private async toWatchStateDto(workItemId: string): Promise<WorkItemWatchStateDto> {
    const watchers = await this.context.repositories.workItemWatchers.listActiveByWorkItem(workItemId);
    const watcherDtos: WorkItemWatchStateDto['watchers'] = [];

    for (const watcher of watchers) {
      const member = await this.requireMember(watcher.memberId);
      watcherDtos.push(this.toWatcherDto(watcher, member));
    }

    return {
      isWatchedByCurrentActor: watchers.some((watcher) => watcher.memberId === this.context.actor.memberId),
      watcherCount: watcherDtos.length,
      watchers: watcherDtos
    };
  }

  private toWatcherDto(watcher: WorkItemWatcher, member: Member): WorkItemWatchStateDto['watchers'][number] {
    return {
      id: watcher.id,
      member: toMemberDto(member),
      watchedAt: watcher.watchedAt.toISOString()
    };
  }

  private async requireWorkItem(workItemId: string): Promise<WorkItem> {
    const workItem = await this.context.repositories.workItems.findById(workItemId);

    if (workItem === null || workItem.workspaceId !== this.context.actor.workspaceId) {
      throw new NotFoundError('Work item not found.');
    }

    return workItem;
  }

  private async requireProject(projectId: string): Promise<Project> {
    const project = await this.context.repositories.projects.findById(projectId);

    if (project === null || project.workspaceId !== this.context.actor.workspaceId) {
      throw new NotFoundError('Project not found.');
    }

    return project;
  }

  private async requireMember(memberId: string): Promise<Member> {
    const member = await this.context.repositories.members.findById(memberId);

    if (member === null || member.workspaceId !== this.context.actor.workspaceId) {
      throw new NotFoundError('Watcher member not found.');
    }

    return member;
  }

  private assertProjectWritable(project: Project): void {
    if (project.status === 'archived') {
      throw new ConflictError('Archived projects are read-only.');
    }
  }
}
