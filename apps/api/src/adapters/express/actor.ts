import type { Request } from 'express';

import { type ActorContext, localSeedActor } from '../../domain/actor.js';
import { ForbiddenError } from '../../errors/app-error.js';
import type { Repositories } from '../../repositories/index.js';

function readHeader(request: Request, name: string): string | undefined {
  const value = request.header(name);
  return value === undefined || value.trim() === '' ? undefined : value;
}

export async function resolveLocalActor(
  request: Request,
  repositories?: Pick<Repositories, 'members'>
): Promise<ActorContext> {
  const memberId = readHeader(request, 'x-worktrail-member-id') ?? localSeedActor.memberId;
  const workspaceId = readHeader(request, 'x-worktrail-workspace-id') ?? localSeedActor.workspaceId;

  if (repositories === undefined) {
    return {
      memberId,
      workspaceId,
      role:
        (readHeader(request, 'x-worktrail-role') as ActorContext['role'] | undefined) ??
        localSeedActor.role
    };
  }

  const member = await repositories.members.findById(memberId);

  if (member === null || member.workspaceId !== workspaceId) {
    throw new ForbiddenError('Local actor could not be resolved for this workspace.');
  }

  if (!member.isActive) {
    throw new ForbiddenError('Inactive members cannot act in this workspace.');
  }

  return {
    memberId: member.id,
    workspaceId: member.workspaceId,
    role: member.role
  };
}
