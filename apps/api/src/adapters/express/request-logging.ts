import type { NextFunction, Request, Response } from 'express';

type RequestFailureCategory = 'body_too_large' | 'invalid_json' | 'unsupported_encoding' | 'invalid_body' | 'invalid_attachment_metadata' | 'internal_error';
const failures = new WeakMap<Response, RequestFailureCategory>();
const methods = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS', 'CONNECT', 'TRACE']);

export function markRequestFailure(response: Response, category: RequestFailureCategory): void {
  failures.set(response, category);
}

export function requestLogger(request: Request, response: Response, next: NextFunction): void {
  const startedAt = performance.now();
  let logged = false;

  const log = (complete: boolean) => {
    if (logged) return;
    logged = true;
    const route: unknown = request.route?.path;
    const category = failures.get(response);
    const target = !complete ? '[aborted]' : category ? `[${category}]` : typeof route === 'string' ? route : '[unmatched]';
    const method = methods.has(request.method) ? request.method : 'OTHER';
    const durationMs = Math.round(performance.now() - startedAt);
    console.log(`${method} ${target} ${complete ? response.statusCode : 499} ${durationMs}ms`);
  };
  response.once('finish', () => log(true));
  response.once('close', () => log(response.writableFinished));

  next();
}
