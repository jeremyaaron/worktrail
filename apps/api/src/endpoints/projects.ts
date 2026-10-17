import type {
  CreateProjectRequest,
  ProjectDto,
  ProjectNavigationSummaryDto,
  ProjectSummaryDto,
  UpdateProjectRequest
} from '@worktrail/contracts';
import { z } from 'zod';

import type { Persistence } from '../repositories/persistence.js';
import { parseWithSchema } from '../validation/parse.js';
import type { EndpointHandler } from '../http/app-request.js';
import type { Repositories } from '../repositories/index.js';
import { ProjectService } from '../services/project-service.js';

export interface ProjectHandlerOptions {
  repositories: Repositories;
  persistence: Persistence;
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

export function listProjectsHandler(options: { repositories: Repositories; persistence: Persistence }): EndpointHandler<ProjectDto[]> {
  const { repositories, persistence } = options;
  return async (request) => {
    const service = new ProjectService({ persistence, actor: request.actor, repositories });
    return {
      status: 200,
      body: await service.listProjects()
    };
  };
}

export function listProjectNavigationSummariesHandler(
  options: { repositories: Repositories; persistence: Persistence }
): EndpointHandler<ProjectNavigationSummaryDto[]> {
  const { repositories, persistence } = options;
  return async (request) => {
    const service = new ProjectService({ persistence, actor: request.actor, repositories });
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
      persistence: options.persistence
    });
    return {
      status: 201,
      body: await service.createProject(input)
    };
  };
}

export function getProjectHandler(options: { repositories: Repositories; persistence: Persistence }): EndpointHandler<ProjectDto> {
  const { repositories, persistence } = options;
  return async (request) => {
    const { projectId } = parseWithSchema(uuidParamSchema, request.params);
    const service = new ProjectService({ persistence, actor: request.actor, repositories });
    return {
      status: 200,
      body: await service.getProject(projectId)
    };
  };
}

export function updateProjectHandler(options: { repositories: Repositories; persistence: Persistence }): EndpointHandler<ProjectDto> {
  const { repositories, persistence } = options;
  return async (request) => {
    const { projectId } = parseWithSchema(uuidParamSchema, request.params);
    const input = parseWithSchema(updateProjectSchema, request.body);
    const service = new ProjectService({ persistence, actor: request.actor, repositories });
    return {
      status: 200,
      body: await service.updateProject(projectId, input)
    };
  };
}

export function archiveProjectHandler(options: { repositories: Repositories; persistence: Persistence }): EndpointHandler<ProjectDto> {
  const { repositories, persistence } = options;
  return async (request) => {
    const { projectId } = parseWithSchema(uuidParamSchema, request.params);
    const service = new ProjectService({ persistence, actor: request.actor, repositories });
    return {
      status: 200,
      body: await service.archiveProject(projectId)
    };
  };
}

export function reactivateProjectHandler(options: { repositories: Repositories; persistence: Persistence }): EndpointHandler<ProjectDto> {
  const { repositories, persistence } = options;
  return async (request) => {
    const { projectId } = parseWithSchema(uuidParamSchema, request.params);
    const service = new ProjectService({ persistence, actor: request.actor, repositories });
    return {
      status: 200,
      body: await service.reactivateProject(projectId)
    };
  };
}

export function getProjectSummaryHandler(
  options: { repositories: Repositories; persistence: Persistence }
): EndpointHandler<ProjectSummaryDto> {
  const { repositories, persistence } = options;
  return async (request) => {
    const { projectId } = parseWithSchema(uuidParamSchema, request.params);
    const service = new ProjectService({ persistence, actor: request.actor, repositories });
    return {
      status: 200,
      body: await service.getProjectSummary(projectId)
    };
  };
}
