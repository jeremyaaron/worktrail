import type { ActivityEventDto } from '@worktrail/contracts';

import type { ActorContext } from '../domain/actor.js';
import { NotFoundError } from '../errors/app-error.js';
import type { Repositories } from '../repositories/index.js';
import type { ActivityEvent, Member } from '../repositories/types.js';
import { toActivityEventDto } from './dto.js';

export interface ActivityServiceContext {
  actor: ActorContext;
  repositories: Repositories;
}

export class ActivityService {
  constructor(private readonly context: ActivityServiceContext) {}

  async listWorkItemActivity(workItemId: string): Promise<ActivityEventDto[]> {
    const workItem = await this.context.repositories.workItems.findById(workItemId);

    if (workItem === null || workItem.workspaceId !== this.context.actor.workspaceId) {
      throw new NotFoundError('Work item not found.');
    }

    const events = await this.context.repositories.activityEvents.findByWorkItem(workItemId);
    return this.toActivityDtos(events);
  }

  async listProjectActivity(projectId: string): Promise<ActivityEventDto[]> {
    const project = await this.context.repositories.projects.findById(projectId);

    if (project === null || project.workspaceId !== this.context.actor.workspaceId) {
      throw new NotFoundError('Project not found.');
    }

    const events = await this.context.repositories.activityEvents.findByProject(projectId);
    return this.toActivityDtos(events);
  }

  private async toActivityDtos(events: ActivityEvent[]): Promise<ActivityEventDto[]> {
    return Promise.all(
      events.map(async (event) => {
        const actor = await this.requireMember(event.actorId, 'Activity actor not found.');
        return toActivityEventDto(event, actor);
      })
    );
  }

  private async requireMember(memberId: string, message: string): Promise<Member> {
    const member = await this.context.repositories.members.findById(memberId);

    if (member === null || member.workspaceId !== this.context.actor.workspaceId) {
      throw new NotFoundError(message);
    }

    return member;
  }
}
