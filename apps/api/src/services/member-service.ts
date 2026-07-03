import type { MemberDto } from '@worktrail/contracts';

import type { ActorContext } from '../domain/actor.js';
import type { Repositories } from '../repositories/index.js';
import { toMemberDto } from './dto.js';

export interface MemberServiceContext {
  actor: ActorContext;
  repositories: Repositories;
}

export class MemberService {
  constructor(private readonly context: MemberServiceContext) {}

  async listMembers(): Promise<MemberDto[]> {
    const members = await this.context.repositories.members.listByWorkspace(
      this.context.actor.workspaceId
    );
    return members.map(toMemberDto);
  }
}

