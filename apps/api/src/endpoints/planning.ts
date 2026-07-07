import type { MilestoneReviewDto, ProjectPlanningSummaryDto } from '@worktrail/contracts';
import { z } from 'zod';

import type { EndpointHandler } from '../http/app-request.js';
import type { Repositories } from '../repositories/index.js';
import { MilestoneReviewService } from '../services/milestone-review-service.js';
import { PlanningService } from '../services/planning-service.js';
import { parseWithSchema } from '../validation/parse.js';

const uuidParamSchema = z.object({
  projectId: z.string().uuid()
});

const milestoneReviewParamSchema = z.object({
  projectId: z.string().uuid(),
  milestoneId: z.string().uuid()
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

export function getMilestoneReviewHandler(
  options: PlanningHandlerOptions
): EndpointHandler<MilestoneReviewDto> {
  return async (request) => {
    const { projectId, milestoneId } = parseWithSchema(
      milestoneReviewParamSchema,
      request.params
    );
    const service = new MilestoneReviewService({
      actor: request.actor,
      repositories: options.repositories,
      clock: options.clock
    });

    return {
      status: 200,
      body: await service.getMilestoneReview(projectId, milestoneId)
    };
  };
}
