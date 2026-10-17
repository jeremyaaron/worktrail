import type {
  UpdateWorkspaceRequest,
  WorkspaceActivityEventDto,
  WorkspaceCapabilitiesDto,
  WorkspaceDto
} from '@worktrail/contracts';
import { z } from 'zod';

import type { Persistence } from '../repositories/persistence.js';
import type { EndpointHandler } from '../http/app-request.js';
import type { Repositories } from '../repositories/index.js';
import { WorkspaceService } from '../services/workspace-service.js';
import { parseWithSchema } from '../validation/parse.js';

const updateWorkspaceSchema = z.object({
  name: z.string().trim().min(1)
}) satisfies z.ZodType<UpdateWorkspaceRequest>;

export function getWorkspaceHandler(options: { repositories: Repositories; persistence: Persistence }): EndpointHandler<WorkspaceDto> {
  const { repositories, persistence } = options;
  return async (request) => {
    const service = new WorkspaceService({ persistence, actor: request.actor, repositories });
    return {
      status: 200,
      body: await service.getWorkspace()
    };
  };
}

export function updateWorkspaceHandler(options: { repositories: Repositories; persistence: Persistence }): EndpointHandler<WorkspaceDto> {
  const { repositories, persistence } = options;
  return async (request) => {
    const input = parseWithSchema(updateWorkspaceSchema, request.body);
    const service = new WorkspaceService({ persistence, actor: request.actor, repositories });
    return {
      status: 200,
      body: await service.updateWorkspace(input)
    };
  };
}

export function getWorkspaceCapabilitiesHandler(
  options: { repositories: Repositories; persistence: Persistence }
): EndpointHandler<WorkspaceCapabilitiesDto> {
  const { repositories, persistence } = options;
  return async (request) => {
    const service = new WorkspaceService({ persistence, actor: request.actor, repositories });
    return {
      status: 200,
      body: await service.getCapabilities()
    };
  };
}

export function listWorkspaceActivityHandler(
  options: { repositories: Repositories; persistence: Persistence }
): EndpointHandler<WorkspaceActivityEventDto[]> {
  const { repositories, persistence } = options;
  return async (request) => {
    const service = new WorkspaceService({ persistence, actor: request.actor, repositories });
    return {
      status: 200,
      body: await service.listWorkspaceActivity()
    };
  };
}
