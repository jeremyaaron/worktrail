import type { ActivityEventDto } from '@worktrail/contracts';
import { z } from 'zod';

import type { EndpointHandler } from '../http/app-request.js';
import type { Repositories } from '../repositories/index.js';
import { ActivityService } from '../services/activity-service.js';
import { parseWithSchema } from '../validation/parse.js';

const workItemIdParamSchema = z.object({
  workItemId: z.string().uuid()
});

const projectIdParamSchema = z.object({
  projectId: z.string().uuid()
});

export function listWorkItemActivityHandler(
  repositories: Repositories
): EndpointHandler<ActivityEventDto[]> {
  return async (request) => {
    const { workItemId } = parseWithSchema(workItemIdParamSchema, request.params);
    const service = new ActivityService({
      actor: request.actor,
      repositories
    });

    return {
      status: 200,
      body: await service.listWorkItemActivity(workItemId)
    };
  };
}

export function listProjectActivityHandler(
  repositories: Repositories
): EndpointHandler<ActivityEventDto[]> {
  return async (request) => {
    const { projectId } = parseWithSchema(projectIdParamSchema, request.params);
    const service = new ActivityService({
      actor: request.actor,
      repositories
    });

    return {
      status: 200,
      body: await service.listProjectActivity(projectId)
    };
  };
}
