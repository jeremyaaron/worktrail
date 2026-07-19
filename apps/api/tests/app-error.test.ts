import { describe, expect, it } from 'vitest';

import { ExportLimitExceededError, toApiErrorResponse } from '../src/errors/app-error.js';

describe('app errors', () => {
  it('maps export limit overflow to a typed 422 response', () => {
    const response = toApiErrorResponse(new ExportLimitExceededError(10_000));

    expect(response).toEqual({
      status: 422,
      body: {
        error: {
          code: 'EXPORT_LIMIT_EXCEEDED',
          message: 'More than 10,000 work items match. Narrow the applied filters and retry.',
          details: { limit: 10_000 }
        }
      }
    });
  });
});
