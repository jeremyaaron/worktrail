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

export interface AppBinaryBody {
  kind: 'binary';
  bytes: Uint8Array;
}

export type AppResponseBody<T> = T | AppBinaryBody;

export interface AppResponse<T = unknown> {
  status: number;
  body?: AppResponseBody<T>;
  headers?: Record<string, string>;
}

export function isAppBinaryBody(value: unknown): value is AppBinaryBody {
  return (
    typeof value === 'object' &&
    value !== null &&
    'kind' in value &&
    value.kind === 'binary' &&
    'bytes' in value &&
    value.bytes instanceof Uint8Array
  );
}

export type EndpointHandler<TResponse = unknown> = (
  request: AppRequest
) => Promise<AppResponse<TResponse>> | AppResponse<TResponse>;
