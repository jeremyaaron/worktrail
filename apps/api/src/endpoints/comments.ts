import type { CommentDto, CreateCommentRequest, UpdateCommentRequest } from '@worktrail/contracts';
import { z } from 'zod';

import type { WorktrailDb } from '../db/client.js';
import type { EndpointHandler } from '../http/app-request.js';
import type { Repositories } from '../repositories/index.js';
import { CommentService } from '../services/comment-service.js';
import { parseWithSchema } from '../validation/parse.js';

const workItemIdParamSchema = z.object({
  workItemId: z.string().uuid()
});

const commentIdParamSchema = z.object({
  commentId: z.string().uuid()
});

const createCommentSchema = z.object({
  body: z.string().trim().min(1)
}) satisfies z.ZodType<CreateCommentRequest>;

const updateCommentSchema = z.object({
  body: z.string().trim().min(1)
}) satisfies z.ZodType<UpdateCommentRequest>;

export function listCommentsHandler(input: {
  repositories: Repositories;
  db?: WorktrailDb;
}): EndpointHandler<CommentDto[]> {
  return async (request) => {
    const { workItemId } = parseWithSchema(workItemIdParamSchema, request.params);
    const service = new CommentService({
      actor: request.actor,
      repositories: input.repositories,
      db: input.db
    });

    return {
      status: 200,
      body: await service.listComments(workItemId)
    };
  };
}

export function createCommentHandler(input: {
  repositories: Repositories;
  db?: WorktrailDb;
}): EndpointHandler<CommentDto> {
  return async (request) => {
    const { workItemId } = parseWithSchema(workItemIdParamSchema, request.params);
    const body = parseWithSchema(createCommentSchema, request.body);
    const service = new CommentService({
      actor: request.actor,
      repositories: input.repositories,
      db: input.db
    });

    return {
      status: 201,
      body: await service.addComment(workItemId, body)
    };
  };
}

export function updateCommentHandler(input: {
  repositories: Repositories;
  db?: WorktrailDb;
}): EndpointHandler<CommentDto> {
  return async (request) => {
    const { commentId } = parseWithSchema(commentIdParamSchema, request.params);
    const body = parseWithSchema(updateCommentSchema, request.body);
    const service = new CommentService({
      actor: request.actor,
      repositories: input.repositories,
      db: input.db
    });

    return {
      status: 200,
      body: await service.updateComment(commentId, body)
    };
  };
}

export function deleteCommentHandler(input: {
  repositories: Repositories;
  db?: WorktrailDb;
}): EndpointHandler<CommentDto> {
  return async (request) => {
    const { commentId } = parseWithSchema(commentIdParamSchema, request.params);
    const service = new CommentService({
      actor: request.actor,
      repositories: input.repositories,
      db: input.db
    });

    return {
      status: 200,
      body: await service.deleteComment(commentId)
    };
  };
}
