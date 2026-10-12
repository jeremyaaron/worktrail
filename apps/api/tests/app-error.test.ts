import { describe, expect, it } from 'vitest';

import {
  AttachmentLimitExceededError,
  AttachmentStorageUnavailableError,
  ExportLimitExceededError,
  PayloadTooLargeError,
  QuickFindUnavailableError,
  toApiErrorResponse
} from '../src/errors/app-error.js';

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

  it('maps an oversized binary request to a typed 413 response', () => {
    expect(toApiErrorResponse(new PayloadTooLargeError(4 * 1024 * 1024))).toEqual({
      status: 413,
      body: {
        error: {
          code: 'PAYLOAD_TOO_LARGE',
          message: 'The request body exceeds the 4 MiB limit.',
          details: { limitBytes: 4 * 1024 * 1024 }
        }
      }
    });
  });

  it('maps attachment count and aggregate limits to typed 422 responses', () => {
    expect(
      toApiErrorResponse(
        new AttachmentLimitExceededError({
          limit: 'attachment_count',
          maximum: 20
        })
      )
    ).toEqual({
      status: 422,
      body: {
        error: {
          code: 'ATTACHMENT_LIMIT_EXCEEDED',
          message: 'This work item already has the maximum of 20 attachments.',
          details: { limit: 'attachment_count', maximum: 20 }
        }
      }
    });
    expect(
      toApiErrorResponse(
        new AttachmentLimitExceededError({
          limit: 'aggregate_bytes',
          maximum: 50 * 1024 * 1024
        })
      )
    ).toEqual({
      status: 422,
      body: {
        error: {
          code: 'ATTACHMENT_LIMIT_EXCEEDED',
          message: 'This upload would exceed the 50 MiB attachment limit for this work item.',
          details: { limit: 'aggregate_bytes', maximum: 50 * 1024 * 1024 }
        }
      }
    });
  });

  it('maps storage failures without exposing adapter details', () => {
    expect(toApiErrorResponse(new AttachmentStorageUnavailableError())).toEqual({
      status: 503,
      body: {
        error: {
          code: 'ATTACHMENT_STORAGE_UNAVAILABLE',
          message: 'Attachment storage is temporarily unavailable.'
        }
      }
    });
  });

  it('maps Quick Find failures without exposing query or persistence details', () => {
    const error = new QuickFindUnavailableError();

    expect(toApiErrorResponse(error)).toEqual({
      status: 503,
      body: {
        error: {
          code: 'QUICK_FIND_UNAVAILABLE',
          message: 'Quick Find is temporarily unavailable.'
        }
      }
    });
    expect(error.details).toBeUndefined();
    expect(error.cause).toBeUndefined();
  });
});
