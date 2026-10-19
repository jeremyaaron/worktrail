import { describe, expect, it } from 'vitest';

import { apiErrorMessageFromBody } from './http-error-message';

describe('API error messages', () => {
  it('reads structured JSON error blobs', async () => {
    const body = new Blob(
      [
        JSON.stringify({
          error: {
            code: 'EXPORT_LIMIT_EXCEEDED',
            message: 'More than 10,000 work items match. Narrow the applied filters and retry.'
          }
        })
      ],
      { type: 'application/json' }
    );

    await expect(apiErrorMessageFromBody(body, 'Fallback')).resolves.toEqual(
      'More than 10,000 work items match. Narrow the applied filters and retry.'
    );
  });

  it('uses the fallback for malformed blobs and empty messages', async () => {
    await expect(
      apiErrorMessageFromBody(new Blob(['not JSON'], { type: 'text/plain' }), 'Fallback')
    ).resolves.toEqual('Fallback');
    await expect(
      apiErrorMessageFromBody({ error: { message: '  ' } }, 'Fallback')
    ).resolves.toEqual('Fallback');
  });
});
