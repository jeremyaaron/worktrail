import type { CreateLabelRequest, LabelDto, UpdateLabelRequest } from '@worktrail/contracts';
import { z } from 'zod';

import type { WorktrailDb } from '../db/client.js';
import type { EndpointHandler } from '../http/app-request.js';
import type { Repositories } from '../repositories/index.js';
import { LabelService } from '../services/label-service.js';
import { parseWithSchema } from '../validation/parse.js';

const projectIdParamSchema = z.object({
  projectId: z.string().uuid()
});

const labelIdParamSchema = z.object({
  labelId: z.string().uuid()
});

const createLabelSchema = z.object({
  name: z.string().trim().min(1),
  color: z.string().trim().min(1).nullable().optional()
}) satisfies z.ZodType<CreateLabelRequest>;

const updateLabelSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    color: z.string().trim().min(1).nullable().optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one label field must be provided.'
  }) satisfies z.ZodType<UpdateLabelRequest>;

function firstQueryValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseIncludeArchived(query: Record<string, string | string[] | undefined>): boolean {
  return firstQueryValue(query.includeArchived) === 'true';
}

export function listProjectLabelsHandler(input: {
  repositories: Repositories;
  db?: WorktrailDb;
}): EndpointHandler<LabelDto[]> {
  return async (request) => {
    const { projectId } = parseWithSchema(projectIdParamSchema, request.params);
    const service = new LabelService({
      actor: request.actor,
      repositories: input.repositories,
      db: input.db
    });

    return {
      status: 200,
      body: await service.listProjectLabels(projectId, {
        includeArchived: parseIncludeArchived(request.query)
      })
    };
  };
}

export function createLabelHandler(input: {
  repositories: Repositories;
  db?: WorktrailDb;
}): EndpointHandler<LabelDto> {
  return async (request) => {
    const { projectId } = parseWithSchema(projectIdParamSchema, request.params);
    const body = parseWithSchema(createLabelSchema, request.body);
    const service = new LabelService({
      actor: request.actor,
      repositories: input.repositories,
      db: input.db
    });

    return {
      status: 201,
      body: await service.createLabel(projectId, body)
    };
  };
}

export function updateLabelHandler(input: {
  repositories: Repositories;
  db?: WorktrailDb;
}): EndpointHandler<LabelDto> {
  return async (request) => {
    const { labelId } = parseWithSchema(labelIdParamSchema, request.params);
    const body = parseWithSchema(updateLabelSchema, request.body);
    const service = new LabelService({
      actor: request.actor,
      repositories: input.repositories,
      db: input.db
    });

    return {
      status: 200,
      body: await service.updateLabel(labelId, body)
    };
  };
}

export function archiveLabelHandler(input: {
  repositories: Repositories;
  db?: WorktrailDb;
}): EndpointHandler<LabelDto> {
  return async (request) => {
    const { labelId } = parseWithSchema(labelIdParamSchema, request.params);
    const service = new LabelService({
      actor: request.actor,
      repositories: input.repositories,
      db: input.db
    });

    return {
      status: 200,
      body: await service.archiveLabel(labelId)
    };
  };
}

export function reactivateLabelHandler(input: {
  repositories: Repositories;
  db?: WorktrailDb;
}): EndpointHandler<LabelDto> {
  return async (request) => {
    const { labelId } = parseWithSchema(labelIdParamSchema, request.params);
    const service = new LabelService({
      actor: request.actor,
      repositories: input.repositories,
      db: input.db
    });

    return {
      status: 200,
      body: await service.reactivateLabel(labelId)
    };
  };
}
