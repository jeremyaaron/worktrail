import type {
  UpdateWorkspaceRequest,
  WorkspaceActivityEventDto,
  WorkspaceCapabilitiesDto,
  WorkspaceDto
} from '@worktrail/contracts';
import { randomUUID } from 'node:crypto';

import type { ActorContext } from '../domain/actor.js';
import {
  canCreateProject,
  canManageMembers,
  canManageMilestones,
  canManageProject,
  canManageWorkspace
} from '../domain/permissions.js';
import { ForbiddenError, NotFoundError, ValidationError } from '../errors/app-error.js';
import type { Repositories } from '../repositories/index.js';
import type { Member, WorkspaceActivityEvent } from '../repositories/types.js';
import { toMemberDto, toWorkspaceActivityEventDto, toWorkspaceDto } from './dto.js';

const roleSummary = {
  owner: 'Owners manage workspace members, project settings, labels, milestones, and all work.',
  maintainer:
    'Maintainers manage project settings, labels, milestones, and all project work, but not workspace members.',
  contributor:
    'Contributors create work, comment, and update assigned active work within existing workflow limits.'
} as const;

export interface WorkspaceServiceContext {
  actor: ActorContext;
  repositories: Repositories;
  clock?: () => Date;
  idGenerator?: () => string;
}

export class WorkspaceService {
  private readonly clock: () => Date;
  private readonly idGenerator: () => string;

  constructor(private readonly context: WorkspaceServiceContext) {
    this.clock = context.clock ?? (() => new Date());
    this.idGenerator = context.idGenerator ?? randomUUID;
  }

  async getWorkspace(): Promise<WorkspaceDto> {
    const workspace = await this.context.repositories.workspaces.findById(this.context.actor.workspaceId);

    if (workspace === null) {
      throw new NotFoundError('Workspace not found.');
    }

    return toWorkspaceDto(workspace);
  }

  async updateWorkspace(input: UpdateWorkspaceRequest): Promise<WorkspaceDto> {
    if (!canManageWorkspace(this.context.actor)) {
      throw new ForbiddenError('Only owners can update workspace settings.');
    }

    const current = await this.context.repositories.workspaces.findById(this.context.actor.workspaceId);

    if (current === null) {
      throw new NotFoundError('Workspace not found.');
    }

    const name = input.name.trim();

    if (name.length === 0) {
      throw new ValidationError('Workspace name is required.');
    }

    if (name === current.name) {
      return toWorkspaceDto(current);
    }

    const timestamp = this.clock();
    const updated = await this.context.repositories.workspaces.update(current.id, {
      name,
      updatedAt: timestamp
    });

    if (updated === null) {
      throw new NotFoundError('Workspace not found.');
    }

    await this.context.repositories.workspaceActivityEvents.create({
      id: this.idGenerator(),
      workspaceId: current.id,
      actorId: this.context.actor.memberId,
      eventType: 'workspace.name_changed',
      summary: `Workspace renamed from ${current.name} to ${updated.name}.`,
      previousValue: { name: current.name },
      newValue: { name: updated.name },
      metadata: {},
      createdAt: timestamp
    });

    return toWorkspaceDto(updated);
  }

  async getCapabilities(): Promise<WorkspaceCapabilitiesDto> {
    const actor = await this.requireMember(this.context.actor.memberId, 'Actor not found.');

    return {
      actor: toMemberDto(actor),
      canManageWorkspace: canManageWorkspace(this.context.actor),
      canManageMembers: canManageMembers(this.context.actor),
      canCreateProjects: canCreateProject(this.context.actor),
      canManageProjects: canManageProject(this.context.actor),
      canManageMilestones: canManageMilestones(this.context.actor),
      canManageLabels: canManageProject(this.context.actor),
      canCreateWorkItems: true,
      roleSummary
    };
  }

  async listWorkspaceActivity(): Promise<WorkspaceActivityEventDto[]> {
    const workspace = await this.context.repositories.workspaces.findById(this.context.actor.workspaceId);

    if (workspace === null) {
      throw new NotFoundError('Workspace not found.');
    }

    const events = await this.context.repositories.workspaceActivityEvents.findByWorkspace(workspace.id);
    return this.toWorkspaceActivityDtos(events);
  }

  private async toWorkspaceActivityDtos(
    events: WorkspaceActivityEvent[]
  ): Promise<WorkspaceActivityEventDto[]> {
    return Promise.all(
      events.map(async (event) => {
        const actor = await this.requireMember(event.actorId, 'Workspace activity actor not found.');
        return toWorkspaceActivityEventDto(event, actor);
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
