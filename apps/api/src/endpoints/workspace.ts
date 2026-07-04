import type {
  UpdateWorkspaceRequest,
  WorkspaceActivityEventDto,
  WorkspaceCapabilitiesDto,
  WorkspaceDto
} from '@worktrail/contracts';
import { z } from 'zod';

import type { EndpointHandler } from '../http/app-request.js';
import type { Repositories } from '../repositories/index.js';
import { WorkspaceService } from '../services/workspace-service.js';
import { parseWithSchema } from '../validation/parse.js';

const updateWorkspaceSchema = z.object({
  name: z.string().trim().min(1)
}) satisfies z.ZodType<UpdateWorkspaceRequest>;

export function getWorkspaceHandler(repositories: Repositories): EndpointHandler<WorkspaceDto> {
  return async (request) => {
    const service = new WorkspaceService({ actor: request.actor, repositories });
    return {
      status: 200,
      body: await service.getWorkspace()
    };
  };
}

export function updateWorkspaceHandler(repositories: Repositories): EndpointHandler<WorkspaceDto> {
  return async (request) => {
    const input = parseWithSchema(updateWorkspaceSchema, request.body);
    const service = new WorkspaceService({ actor: request.actor, repositories });
    return {
      status: 200,
      body: await service.updateWorkspace(input)
    };
  };
}

export function getWorkspaceCapabilitiesHandler(
  repositories: Repositories
): EndpointHandler<WorkspaceCapabilitiesDto> {
  return async (request) => {
    const service = new WorkspaceService({ actor: request.actor, repositories });
    return {
      status: 200,
      body: await service.getCapabilities()
    };
  };
}

export function listWorkspaceActivityHandler(
  repositories: Repositories
): EndpointHandler<WorkspaceActivityEventDto[]> {
  return async (request) => {
    const service = new WorkspaceService({ actor: request.actor, repositories });
    return {
      status: 200,
      body: await service.listWorkspaceActivity()
    };
  };
}
