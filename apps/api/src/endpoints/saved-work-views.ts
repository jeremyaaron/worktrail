import type {
  CreateSavedWorkViewRequest,
  SavedWorkViewDto,
  UpdateSavedWorkViewRequest,
  WorkItemQuery
} from '@worktrail/contracts';
import { z } from 'zod';

import type { EndpointHandler } from '../http/app-request.js';
import type { Repositories } from '../repositories/index.js';
import { SavedWorkViewService } from '../services/saved-work-view-service.js';
import { parseWithSchema } from '../validation/parse.js';

const savedViewIdParamSchema = z.object({
  savedViewId: z.string().uuid()
});

const queryPayloadSchema = z.record(z.string(), z.unknown());

const createSavedWorkViewSchema = z.object({
  name: z.string().trim().min(1),
  query: queryPayloadSchema
});

const updateSavedWorkViewSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    query: queryPayloadSchema.optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one saved view field must be provided.'
  });

export interface SavedWorkViewHandlerOptions {
  repositories: Repositories;
}

export function listSavedWorkViewsHandler(
  options: SavedWorkViewHandlerOptions
): EndpointHandler<SavedWorkViewDto[]> {
  return async (request) => {
    const service = new SavedWorkViewService({
      actor: request.actor,
      repositories: options.repositories
    });

    return {
      status: 200,
      body: await service.listSavedViews()
    };
  };
}

export function createSavedWorkViewHandler(
  options: SavedWorkViewHandlerOptions
): EndpointHandler<SavedWorkViewDto> {
  return async (request) => {
    const input = toCreateRequest(parseWithSchema(createSavedWorkViewSchema, request.body));
    const service = new SavedWorkViewService({
      actor: request.actor,
      repositories: options.repositories
    });

    return {
      status: 201,
      body: await service.createSavedView(input)
    };
  };
}

export function updateSavedWorkViewHandler(
  options: SavedWorkViewHandlerOptions
): EndpointHandler<SavedWorkViewDto> {
  return async (request) => {
    const { savedViewId } = parseWithSchema(savedViewIdParamSchema, request.params);
    const input = toUpdateRequest(parseWithSchema(updateSavedWorkViewSchema, request.body));
    const service = new SavedWorkViewService({
      actor: request.actor,
      repositories: options.repositories
    });

    return {
      status: 200,
      body: await service.updateSavedView(savedViewId, input)
    };
  };
}

function toCreateRequest(input: { name: string; query: Record<string, unknown> }): CreateSavedWorkViewRequest {
  return {
    name: input.name,
    query: input.query as WorkItemQuery
  };
}

function toUpdateRequest(input: {
  name?: string;
  query?: Record<string, unknown>;
}): UpdateSavedWorkViewRequest {
  return {
    ...(input.name === undefined ? {} : { name: input.name }),
    ...(input.query === undefined ? {} : { query: input.query as WorkItemQuery })
  };
}

export function deleteSavedWorkViewHandler(
  options: SavedWorkViewHandlerOptions
): EndpointHandler<void> {
  return async (request) => {
    const { savedViewId } = parseWithSchema(savedViewIdParamSchema, request.params);
    const service = new SavedWorkViewService({
      actor: request.actor,
      repositories: options.repositories
    });

    await service.deleteSavedView(savedViewId);

    return {
      status: 204
    };
  };
}
