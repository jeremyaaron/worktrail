import type { Request } from 'express';

import { type ActorContext, localSeedActor } from '../../domain/actor.js';

function readHeader(request: Request, name: string): string | undefined {
  const value = request.header(name);
  return value === undefined || value.trim() === '' ? undefined : value;
}

export function resolveLocalActor(request: Request): ActorContext {
  return {
    memberId: readHeader(request, 'x-worktrail-member-id') ?? localSeedActor.memberId,
    workspaceId: readHeader(request, 'x-worktrail-workspace-id') ?? localSeedActor.workspaceId,
    role: (readHeader(request, 'x-worktrail-role') as ActorContext['role'] | undefined) ?? localSeedActor.role
  };
}

