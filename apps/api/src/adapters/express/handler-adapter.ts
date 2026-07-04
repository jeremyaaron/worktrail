import type { Request, Response } from 'express';

import { toApiErrorResponse } from '../../errors/app-error.js';
import type { AppRequest, EndpointHandler } from '../../http/app-request.js';
import type { Repositories } from '../../repositories/index.js';
import { resolveLocalActor } from './actor.js';

function normalizeHeaders(request: Request): Record<string, string | undefined> {
  const headers: Record<string, string | undefined> = {};

  for (const [key, value] of Object.entries(request.headers)) {
    headers[key] = Array.isArray(value) ? value.join(', ') : value;
  }

  return headers;
}

function normalizeQuery(request: Request): Record<string, string | string[] | undefined> {
  const query: Record<string, string | string[] | undefined> = {};

  for (const [key, value] of Object.entries(request.query)) {
    if (typeof value === 'string' || Array.isArray(value)) {
      query[key] = value as string | string[];
    }
  }

  return query;
}

function normalizeParams(request: Request): Record<string, string> {
  const params: Record<string, string> = {};

  for (const [key, value] of Object.entries(request.params)) {
    params[key] = Array.isArray(value) ? value.join(',') : value;
  }

  return params;
}

export interface AdaptEndpointOptions {
  repositories?: Pick<Repositories, 'members'>;
}

export async function toAppRequest(
  request: Request,
  options: AdaptEndpointOptions = {}
): Promise<AppRequest> {
  return {
    method: request.method,
    path: request.path,
    params: normalizeParams(request),
    query: normalizeQuery(request),
    headers: normalizeHeaders(request),
    body: request.body,
    actor: await resolveLocalActor(request, options.repositories)
  };
}

export function adaptEndpoint(handler: EndpointHandler, options: AdaptEndpointOptions = {}) {
  return async (request: Request, response: Response): Promise<void> => {
    try {
      const appResponse = await handler(await toAppRequest(request, options));

      for (const [key, value] of Object.entries(appResponse.headers ?? {})) {
        response.setHeader(key, value);
      }

      response.status(appResponse.status).json(appResponse.body ?? {});
    } catch (error) {
      const apiError = toApiErrorResponse(error);

      if (apiError.status >= 500) {
        console.error(error);
      }

      response.status(apiError.status).json(apiError.body);
    }
  };
}
