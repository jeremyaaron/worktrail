import type {
  CreateMilestoneRequest,
  MilestoneDto,
  UpdateMilestoneRequest
} from '@worktrail/contracts';
import { z } from 'zod';

import type { WorktrailDb } from '../db/client.js';
import { milestoneStatuses } from '../domain/constants.js';
import type { EndpointHandler } from '../http/app-request.js';
import type { Repositories } from '../repositories/index.js';
import { MilestoneService } from '../services/milestone-service.js';
import { parseWithSchema } from '../validation/parse.js';

const projectIdParamSchema = z.object({
  projectId: z.string().uuid()
});

const milestoneIdParamSchema = z.object({
  milestoneId: z.string().uuid()
});

const nullableDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable();

const createMilestoneSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().optional(),
  status: z.enum(milestoneStatuses).optional(),
  targetDate: nullableDateSchema.optional()
}) satisfies z.ZodType<CreateMilestoneRequest>;

const updateMilestoneSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    description: z.string().trim().optional(),
    status: z.enum(milestoneStatuses).optional(),
    targetDate: nullableDateSchema.optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one milestone field must be provided.'
  }) satisfies z.ZodType<UpdateMilestoneRequest>;

const milestoneListQuerySchema = z.object({
  includeArchived: z.boolean().optional(),
  status: z.enum(milestoneStatuses).optional()
});

function firstQueryValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseMilestoneListQuery(query: Record<string, string | string[] | undefined>) {
  return parseWithSchema(milestoneListQuerySchema, {
    includeArchived:
      firstQueryValue(query.includeArchived) === undefined
        ? undefined
        : firstQueryValue(query.includeArchived) === 'true',
    status: firstQueryValue(query.status)
  });
}

export function listProjectMilestonesHandler(input: {
  repositories: Repositories;
  db?: WorktrailDb;
}): EndpointHandler<MilestoneDto[]> {
  return async (request) => {
    const { projectId } = parseWithSchema(projectIdParamSchema, request.params);
    const service = new MilestoneService({
      actor: request.actor,
      repositories: input.repositories,
      db: input.db
    });

    return {
      status: 200,
      body: await service.listProjectMilestones(projectId, parseMilestoneListQuery(request.query))
    };
  };
}

export function createMilestoneHandler(input: {
  repositories: Repositories;
  db?: WorktrailDb;
}): EndpointHandler<MilestoneDto> {
  return async (request) => {
    const { projectId } = parseWithSchema(projectIdParamSchema, request.params);
    const body = parseWithSchema(createMilestoneSchema, request.body);
    const service = new MilestoneService({
      actor: request.actor,
      repositories: input.repositories,
      db: input.db
    });

    return {
      status: 201,
      body: await service.createMilestone(projectId, body)
    };
  };
}

export function updateMilestoneHandler(input: {
  repositories: Repositories;
  db?: WorktrailDb;
}): EndpointHandler<MilestoneDto> {
  return async (request) => {
    const { milestoneId } = parseWithSchema(milestoneIdParamSchema, request.params);
    const body = parseWithSchema(updateMilestoneSchema, request.body);
    const service = new MilestoneService({
      actor: request.actor,
      repositories: input.repositories,
      db: input.db
    });

    return {
      status: 200,
      body: await service.updateMilestone(milestoneId, body)
    };
  };
}

export function archiveMilestoneHandler(input: {
  repositories: Repositories;
  db?: WorktrailDb;
}): EndpointHandler<MilestoneDto> {
  return async (request) => {
    const { milestoneId } = parseWithSchema(milestoneIdParamSchema, request.params);
    const service = new MilestoneService({
      actor: request.actor,
      repositories: input.repositories,
      db: input.db
    });

    return {
      status: 200,
      body: await service.archiveMilestone(milestoneId)
    };
  };
}

export function reactivateMilestoneHandler(input: {
  repositories: Repositories;
  db?: WorktrailDb;
}): EndpointHandler<MilestoneDto> {
  return async (request) => {
    const { milestoneId } = parseWithSchema(milestoneIdParamSchema, request.params);
    const service = new MilestoneService({
      actor: request.actor,
      repositories: input.repositories,
      db: input.db
    });

    return {
      status: 200,
      body: await service.reactivateMilestone(milestoneId)
    };
  };
}
