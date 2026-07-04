import type {
  CreateProjectRequest,
  ProjectDto,
  ProjectNavigationSummaryDto,
  ProjectSummaryDto,
  UpdateProjectRequest
} from '@worktrail/contracts';
import { z } from 'zod';

import type { WorktrailDb } from '../db/client.js';
import { parseWithSchema } from '../validation/parse.js';
import type { EndpointHandler } from '../http/app-request.js';
import type { Repositories } from '../repositories/index.js';
import { ProjectService } from '../services/project-service.js';

export interface ProjectHandlerOptions {
  repositories: Repositories;
  db?: WorktrailDb;
}

const uuidParamSchema = z.object({
  projectId: z.string().uuid()
});

const createProjectSchema = z.object({
  key: z.string().trim().optional(),
  name: z.string().trim().min(1),
  description: z.string().trim().optional()
}) satisfies z.ZodType<CreateProjectRequest>;

const updateProjectSchema = z
  .object({
    key: z.string().trim().optional(),
    name: z.string().trim().min(1).optional(),
    description: z.string().trim().optional(),
    status: z.enum(['active', 'archived']).optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one project field must be provided.'
  }) satisfies z.ZodType<UpdateProjectRequest>;

export function listProjectsHandler(repositories: Repositories): EndpointHandler<ProjectDto[]> {
  return async (request) => {
    const service = new ProjectService({ actor: request.actor, repositories });
    return {
      status: 200,
      body: await service.listProjects()
    };
  };
}

export function listProjectNavigationSummariesHandler(
  repositories: Repositories
): EndpointHandler<ProjectNavigationSummaryDto[]> {
  return async (request) => {
    const service = new ProjectService({ actor: request.actor, repositories });
    return {
      status: 200,
      body: await service.listProjectNavigationSummaries()
    };
  };
}

export function createProjectHandler(options: ProjectHandlerOptions): EndpointHandler<ProjectDto> {
  return async (request) => {
    const input = parseWithSchema(createProjectSchema, request.body);
    const service = new ProjectService({
      actor: request.actor,
      repositories: options.repositories,
      db: options.db
    });
    return {
      status: 201,
      body: await service.createProject(input)
    };
  };
}

export function getProjectHandler(repositories: Repositories): EndpointHandler<ProjectDto> {
  return async (request) => {
    const { projectId } = parseWithSchema(uuidParamSchema, request.params);
    const service = new ProjectService({ actor: request.actor, repositories });
    return {
      status: 200,
      body: await service.getProject(projectId)
    };
  };
}

export function updateProjectHandler(repositories: Repositories): EndpointHandler<ProjectDto> {
  return async (request) => {
    const { projectId } = parseWithSchema(uuidParamSchema, request.params);
    const input = parseWithSchema(updateProjectSchema, request.body);
    const service = new ProjectService({ actor: request.actor, repositories });
    return {
      status: 200,
      body: await service.updateProject(projectId, input)
    };
  };
}

export function archiveProjectHandler(repositories: Repositories): EndpointHandler<ProjectDto> {
  return async (request) => {
    const { projectId } = parseWithSchema(uuidParamSchema, request.params);
    const service = new ProjectService({ actor: request.actor, repositories });
    return {
      status: 200,
      body: await service.archiveProject(projectId)
    };
  };
}

export function reactivateProjectHandler(repositories: Repositories): EndpointHandler<ProjectDto> {
  return async (request) => {
    const { projectId } = parseWithSchema(uuidParamSchema, request.params);
    const service = new ProjectService({ actor: request.actor, repositories });
    return {
      status: 200,
      body: await service.reactivateProject(projectId)
    };
  };
}

export function getProjectSummaryHandler(
  repositories: Repositories
): EndpointHandler<ProjectSummaryDto> {
  return async (request) => {
    const { projectId } = parseWithSchema(uuidParamSchema, request.params);
    const service = new ProjectService({ actor: request.actor, repositories });
    return {
      status: 200,
      body: await service.getProjectSummary(projectId)
    };
  };
}
