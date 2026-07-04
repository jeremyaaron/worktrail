import type { LabelDto } from '@worktrail/contracts';
import { z } from 'zod';

import { NotFoundError } from '../errors/app-error.js';
import type { EndpointHandler } from '../http/app-request.js';
import type { Repositories } from '../repositories/index.js';
import { toLabelDto } from '../services/dto.js';
import { parseWithSchema } from '../validation/parse.js';

const projectIdParamSchema = z.object({
  projectId: z.string().uuid()
});

export function listProjectLabelsHandler(repositories: Repositories): EndpointHandler<LabelDto[]> {
  return async (request) => {
    const { projectId } = parseWithSchema(projectIdParamSchema, request.params);
    const project = await repositories.projects.findById(projectId);

    if (project === null || project.workspaceId !== request.actor.workspaceId) {
      throw new NotFoundError('Project not found.');
    }

    const labels = await repositories.labels.listByProject(projectId);

    return {
      status: 200,
      body: labels.map(toLabelDto)
    };
  };
}
