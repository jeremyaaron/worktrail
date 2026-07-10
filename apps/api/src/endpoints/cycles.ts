import type {
  CreateProjectCycleRequest,
  ProjectCycleDto,
  ProjectCycleReviewDto,
  UpdateProjectCycleRequest
} from '@worktrail/contracts';
import { z } from 'zod';

import type { WorktrailDb } from '../db/client.js';
import type { EndpointHandler } from '../http/app-request.js';
import type { Repositories } from '../repositories/index.js';
import { ProjectCycleService } from '../services/project-cycle-service.js';
import {
  createProjectCycleSchema,
  projectCycleListQuerySchema,
  updateProjectCycleSchema
} from '../validation/project-cycle.js';
import { parseWithSchema } from '../validation/parse.js';

const projectIdParamSchema = z.object({
  projectId: z.string().uuid()
});

const projectCycleParamSchema = z.object({
  projectId: z.string().uuid(),
  cycleId: z.string().uuid()
});

function firstQueryValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseCycleListQuery(query: Record<string, string | string[] | undefined>) {
  return parseWithSchema(projectCycleListQuerySchema, {
    includeArchived:
      firstQueryValue(query.includeArchived) === undefined
        ? undefined
        : firstQueryValue(query.includeArchived) === 'true',
    status: firstQueryValue(query.status)
  });
}

export function listProjectCyclesHandler(input: {
  repositories: Repositories;
  db?: WorktrailDb;
}): EndpointHandler<ProjectCycleDto[]> {
  return async (request) => {
    const { projectId } = parseWithSchema(projectIdParamSchema, request.params);
    const service = new ProjectCycleService({
      actor: request.actor,
      repositories: input.repositories,
      db: input.db
    });

    return {
      status: 200,
      body: await service.listProjectCycles(projectId, parseCycleListQuery(request.query))
    };
  };
}

export function createProjectCycleHandler(input: {
  repositories: Repositories;
  db?: WorktrailDb;
}): EndpointHandler<ProjectCycleDto> {
  return async (request) => {
    const { projectId } = parseWithSchema(projectIdParamSchema, request.params);
    const body = parseWithSchema(createProjectCycleSchema, request.body) as CreateProjectCycleRequest;
    const service = new ProjectCycleService({
      actor: request.actor,
      repositories: input.repositories,
      db: input.db
    });

    return {
      status: 201,
      body: await service.createProjectCycle(projectId, body)
    };
  };
}

export function getProjectCycleHandler(input: {
  repositories: Repositories;
  db?: WorktrailDb;
}): EndpointHandler<ProjectCycleDto> {
  return async (request) => {
    const { projectId, cycleId } = parseWithSchema(projectCycleParamSchema, request.params);
    const service = new ProjectCycleService({
      actor: request.actor,
      repositories: input.repositories,
      db: input.db
    });

    return {
      status: 200,
      body: await service.getProjectCycle(projectId, cycleId)
    };
  };
}

export function updateProjectCycleHandler(input: {
  repositories: Repositories;
  db?: WorktrailDb;
}): EndpointHandler<ProjectCycleDto> {
  return async (request) => {
    const { projectId, cycleId } = parseWithSchema(projectCycleParamSchema, request.params);
    const body = parseWithSchema(updateProjectCycleSchema, request.body) as UpdateProjectCycleRequest;
    const service = new ProjectCycleService({
      actor: request.actor,
      repositories: input.repositories,
      db: input.db
    });

    return {
      status: 200,
      body: await service.updateProjectCycle(projectId, cycleId, body)
    };
  };
}

export function archiveProjectCycleHandler(input: {
  repositories: Repositories;
  db?: WorktrailDb;
}): EndpointHandler<ProjectCycleDto> {
  return async (request) => {
    const { projectId, cycleId } = parseWithSchema(projectCycleParamSchema, request.params);
    const service = new ProjectCycleService({
      actor: request.actor,
      repositories: input.repositories,
      db: input.db
    });

    return {
      status: 200,
      body: await service.archiveProjectCycle(projectId, cycleId)
    };
  };
}

export function reactivateProjectCycleHandler(input: {
  repositories: Repositories;
  db?: WorktrailDb;
}): EndpointHandler<ProjectCycleDto> {
  return async (request) => {
    const { projectId, cycleId } = parseWithSchema(projectCycleParamSchema, request.params);
    const service = new ProjectCycleService({
      actor: request.actor,
      repositories: input.repositories,
      db: input.db
    });

    return {
      status: 200,
      body: await service.reactivateProjectCycle(projectId, cycleId)
    };
  };
}

export function getProjectCycleReviewHandler(input: {
  repositories: Repositories;
  db?: WorktrailDb;
}): EndpointHandler<ProjectCycleReviewDto> {
  return async (request) => {
    const { projectId, cycleId } = parseWithSchema(projectCycleParamSchema, request.params);
    const service = new ProjectCycleService({
      actor: request.actor,
      repositories: input.repositories,
      db: input.db
    });

    return {
      status: 200,
      body: await service.getCycleReview(projectId, cycleId)
    };
  };
}
