import type {
  CreateProjectRequest,
  ProjectDto,
  ProjectSummaryDto,
  UpdateProjectRequest
} from '@worktrail/contracts';
import { z } from 'zod';

import { parseWithSchema } from '../validation/parse.js';
import type { EndpointHandler } from '../http/app-request.js';
import type { Repositories } from '../repositories/index.js';
import { ProjectService } from '../services/project-service.js';

const uuidParamSchema = z.object({
  projectId: z.string().uuid()
});

const createProjectSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().optional()
}) satisfies z.ZodType<CreateProjectRequest>;

const updateProjectSchema = z
  .object({
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

export function createProjectHandler(repositories: Repositories): EndpointHandler<ProjectDto> {
  return async (request) => {
    const input = parseWithSchema(createProjectSchema, request.body);
    const service = new ProjectService({ actor: request.actor, repositories });
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

