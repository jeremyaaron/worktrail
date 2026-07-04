import type { ActorContext } from '../domain/actor.js';

export interface AppRequest {
  method: string;
  path: string;
  params: Record<string, string>;
  query: Record<string, string | string[] | undefined>;
  headers: Record<string, string | undefined>;
  body: unknown;
  actor: ActorContext;
}

export interface AppResponse<T = unknown> {
  status: number;
  body?: T;
  headers?: Record<string, string>;
}

export type EndpointHandler<TResponse = unknown> = (
  request: AppRequest
) => Promise<AppResponse<TResponse>> | AppResponse<TResponse>;

