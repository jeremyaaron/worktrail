import type { MemberDto } from '@worktrail/contracts';

import type { EndpointHandler } from '../http/app-request.js';
import type { Repositories } from '../repositories/index.js';
import { MemberService } from '../services/member-service.js';

export function listMembersHandler(repositories: Repositories): EndpointHandler<MemberDto[]> {
  return async (request) => {
    const service = new MemberService({ actor: request.actor, repositories });
    return {
      status: 200,
      body: await service.listMembers()
    };
  };
}

