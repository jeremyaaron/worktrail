import express, { type Express, type RequestHandler } from 'express';

import { attachmentPolicy } from '../../../domain/attachment-policy.js';
import {
  downloadAttachmentHandler,
  listWorkItemAttachmentsHandler,
  removeAttachmentHandler,
  uploadWorkItemAttachmentHandler
} from '../../../endpoints/attachments.js';
import {
  PayloadTooLargeError,
  toApiErrorResponse,
  ValidationError
} from '../../../errors/app-error.js';
import type { AttachmentObjectStore } from '../../../storage/attachment-object-store.js';
import { adaptEndpoint } from '../handler-adapter.js';
import { adapterOptions, type ExpressRouteContext } from './context.js';

export interface AttachmentRouteContext extends ExpressRouteContext {
  db: NonNullable<ExpressRouteContext['db']>;
  objectStore: AttachmentObjectStore;
}

export function configureAttachmentUploadBoundary(app: Express): void {
  app.use('/api/work-items/:workItemId/attachments', (request, response, next) => {
    if (request.method !== 'POST') {
      next();
      return;
    }

    if (!request.is('application/octet-stream')) {
      const apiError = toApiErrorResponse(
        new ValidationError('Attachment uploads require application/octet-stream.', {
          field: 'content-type',
          reason: 'invalid_content_type'
        })
      );
      response.status(apiError.status).json(apiError.body);
      return;
    }

    for (const headerName of ['x-worktrail-filename', 'x-worktrail-media-type']) {
      const count = countRawHeaders(request.rawHeaders, headerName);

      if (count !== 1) {
        const apiError = toApiErrorResponse(
          new ValidationError(
            count === 0
              ? `The ${headerName} header is required.`
              : `The ${headerName} header must be provided exactly once.`,
            {
              field: headerName,
              reason: count === 0 ? 'required' : 'duplicate'
            }
          )
        );
        response.status(apiError.status).json(apiError.body);
        return;
      }
    }

    next();
  });
}

export function registerAttachmentRoutes(app: Express, context: AttachmentRouteContext): void {
  const options = adapterOptions(context);
  const handlers = {
    repositories: context.repositories,
    db: context.db,
    objectStore: context.objectStore
  };

  app.get(
    '/api/work-items/:workItemId/attachments',
    adaptEndpoint(listWorkItemAttachmentsHandler(handlers), options)
  );
  app.post(
    '/api/work-items/:workItemId/attachments',
    boundedAttachmentBody(),
    adaptEndpoint(uploadWorkItemAttachmentHandler(handlers), options)
  );
  app.get(
    '/api/attachments/:attachmentId/content',
    adaptEndpoint(downloadAttachmentHandler(handlers), options)
  );
  app.delete(
    '/api/attachments/:attachmentId',
    adaptEndpoint(removeAttachmentHandler(handlers), options)
  );
}

function boundedAttachmentBody(): RequestHandler {
  const rawParser = express.raw({
    type: 'application/octet-stream',
    limit: attachmentPolicy.maxFileBytes
  });

  return (request, response, next) => {
    rawParser(request, response, (error?: unknown) => {
      if (isEntityTooLargeError(error)) {
        const apiError = toApiErrorResponse(
          new PayloadTooLargeError(attachmentPolicy.maxFileBytes)
        );
        response.status(apiError.status).json(apiError.body);
        return;
      }

      if (error !== undefined) {
        next(error);
        return;
      }

      next();
    });
  };
}

function isEntityTooLargeError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'type' in error &&
    error.type === 'entity.too.large'
  );
}

function countRawHeaders(rawHeaders: readonly string[], headerName: string): number {
  let count = 0;

  for (let index = 0; index < rawHeaders.length; index += 2) {
    if (rawHeaders[index]?.toLowerCase() === headerName) {
      count += 1;
    }
  }

  return count;
}
