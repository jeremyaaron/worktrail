import type { ErrorRequestHandler } from 'express';

import { AppError, PayloadTooLargeError, toApiErrorResponse, ValidationError } from '../../errors/app-error.js';
import { jsonBodyLimits } from './body-parsing.js';
import { markRequestFailure } from './request-logging.js';

export const middlewareErrorBoundary: ErrorRequestHandler = (error: unknown, _request, response, _next) => {
  const type = typeof error === 'object' && error !== null && 'type' in error ? error.type : undefined;
  let safeError: unknown;
  switch (type) {
    case 'entity.too.large':
      markRequestFailure(response, 'body_too_large');
      safeError = new PayloadTooLargeError(
        response.locals.jsonBodyLimitBytes === jsonBodyLimits.csvImport ? jsonBodyLimits.csvImport : jsonBodyLimits.ordinary
      );
      break;
    case 'entity.parse.failed':
      markRequestFailure(response, 'invalid_json');
      safeError = new ValidationError('The request body must contain valid JSON.', { reason: 'invalid_json' });
      break;
    case 'encoding.unsupported':
    case 'charset.unsupported':
      markRequestFailure(response, 'unsupported_encoding');
      safeError = new AppError({
        code: 'VALIDATION_ERROR', status: 415,
        message: 'The request body encoding is not supported.',
        details: { reason: 'unsupported_encoding' }
      });
      break;
    case 'request.aborted':
    case 'request.size.invalid':
      markRequestFailure(response, 'invalid_body');
      safeError = new ValidationError('The request body was incomplete.', { reason: 'invalid_body' });
      break;
    default:
      markRequestFailure(response, 'internal_error');
      console.error('Request middleware failed.');
  }

  if (response.destroyed) return;
  if (response.headersSent) {
    response.destroy();
    return;
  }
  const apiError = toApiErrorResponse(safeError);
  response.status(apiError.status).json(apiError.body);
};
