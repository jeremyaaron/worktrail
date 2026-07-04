import type { CreateMemberRequest, MemberDto, UpdateMemberRequest } from '@worktrail/contracts';
import { z } from 'zod';

import type { EndpointHandler } from '../http/app-request.js';
import type { WorktrailDb } from '../db/client.js';
import type { Repositories } from '../repositories/index.js';
import { MemberService } from '../services/member-service.js';
import { parseWithSchema } from '../validation/parse.js';

export interface MemberHandlerOptions {
  repositories: Repositories;
  db?: WorktrailDb;
}

const uuidParamSchema = z.object({
  memberId: z.string().uuid()
});

const createMemberSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().email(),
  role: z.enum(['owner', 'maintainer', 'contributor'])
}) satisfies z.ZodType<CreateMemberRequest>;

const updateMemberSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    email: z.string().trim().email().optional(),
    role: z.enum(['owner', 'maintainer', 'contributor']).optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one member field must be provided.'
  }) satisfies z.ZodType<UpdateMemberRequest>;

export function listMembersHandler(repositories: Repositories): EndpointHandler<MemberDto[]> {
  return async (request) => {
    const service = new MemberService({ actor: request.actor, repositories });
    return {
      status: 200,
      body: await service.listMembers()
    };
  };
}

export function createMemberHandler(options: MemberHandlerOptions): EndpointHandler<MemberDto> {
  return async (request) => {
    const input = parseWithSchema(createMemberSchema, request.body);
    const service = new MemberService({
      actor: request.actor,
      repositories: options.repositories,
      db: options.db
    });
    return {
      status: 201,
      body: await service.createMember(input)
    };
  };
}

export function updateMemberHandler(options: MemberHandlerOptions): EndpointHandler<MemberDto> {
  return async (request) => {
    const { memberId } = parseWithSchema(uuidParamSchema, request.params);
    const input = parseWithSchema(updateMemberSchema, request.body);
    const service = new MemberService({
      actor: request.actor,
      repositories: options.repositories,
      db: options.db
    });
    return {
      status: 200,
      body: await service.updateMember(memberId, input)
    };
  };
}

export function deactivateMemberHandler(options: MemberHandlerOptions): EndpointHandler<MemberDto> {
  return async (request) => {
    const { memberId } = parseWithSchema(uuidParamSchema, request.params);
    const service = new MemberService({
      actor: request.actor,
      repositories: options.repositories,
      db: options.db
    });
    return {
      status: 200,
      body: await service.deactivateMember(memberId)
    };
  };
}

export function reactivateMemberHandler(options: MemberHandlerOptions): EndpointHandler<MemberDto> {
  return async (request) => {
    const { memberId } = parseWithSchema(uuidParamSchema, request.params);
    const service = new MemberService({
      actor: request.actor,
      repositories: options.repositories,
      db: options.db
    });
    return {
      status: 200,
      body: await service.reactivateMember(memberId)
    };
  };
}
