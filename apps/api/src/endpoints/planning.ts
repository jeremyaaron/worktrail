import type { ProjectPlanningSummaryDto } from '@worktrail/contracts';
import { z } from 'zod';

import type { EndpointHandler } from '../http/app-request.js';
import type { Repositories } from '../repositories/index.js';
import { PlanningService } from '../services/planning-service.js';
import { parseWithSchema } from '../validation/parse.js';

const uuidParamSchema = z.object({
  projectId: z.string().uuid()
});

export interface PlanningHandlerOptions {
  repositories: Repositories;
  clock?: () => Date;
}

export function getProjectPlanningSummaryHandler(
  options: PlanningHandlerOptions
): EndpointHandler<ProjectPlanningSummaryDto> {
  return async (request) => {
    const { projectId } = parseWithSchema(uuidParamSchema, request.params);
    const service = new PlanningService({
      actor: request.actor,
      repositories: options.repositories,
      clock: options.clock
    });

    return {
      status: 200,
      body: await service.getProjectPlanningSummary(projectId)
    };
  };
}
