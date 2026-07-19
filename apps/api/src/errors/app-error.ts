export type AppErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'WORKFLOW_TRANSITION_ERROR'
  | 'EXPORT_LIMIT_EXCEEDED'
  | 'INTERNAL_ERROR';

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(input: { code: AppErrorCode; status: number; message: string; details?: unknown }) {
    super(input.message);
    this.name = new.target.name;
    this.code = input.code;
    this.status = input.status;
    this.details = input.details;
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super({ code: 'VALIDATION_ERROR', status: 400, message, details });
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication is required.') {
    super({ code: 'UNAUTHORIZED', status: 401, message });
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'You do not have permission to perform this action.') {
    super({ code: 'FORBIDDEN', status: 403, message });
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found.') {
    super({ code: 'NOT_FOUND', status: 404, message });
  }
}

export class ConflictError extends AppError {
  constructor(message = 'The request conflicts with the current resource state.', details?: unknown) {
    super({ code: 'CONFLICT', status: 409, message, details });
  }
}

export class WorkflowTransitionError extends AppError {
  constructor(message = 'The requested workflow transition is not allowed.', details?: unknown) {
    super({ code: 'WORKFLOW_TRANSITION_ERROR', status: 409, message, details });
  }
}

export class ExportLimitExceededError extends AppError {
  constructor(limit: number) {
    const formattedLimit = String(limit).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    super({
      code: 'EXPORT_LIMIT_EXCEEDED',
      status: 422,
      message: `More than ${formattedLimit} work items match. Narrow the applied filters and retry.`,
      details: { limit }
    });
  }
}

export interface ApiErrorResponse {
  error: {
    code: AppErrorCode;
    message: string;
    details?: unknown;
  };
}

export function toApiErrorResponse(error: unknown): { status: number; body: ApiErrorResponse } {
  if (error instanceof AppError) {
    return {
      status: error.status,
      body: {
        error: {
          code: error.code,
          message: error.message,
          ...(error.details === undefined ? {} : { details: error.details })
        }
      }
    };
  }

  return {
    status: 500,
    body: {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred.'
      }
    }
  };
}
