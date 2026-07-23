import type { WorkItemAttachmentDto, WorkItemAttachmentListDto } from '@worktrail/contracts';
import { z } from 'zod';

import type { WorktrailDb } from '../db/client.js';
import { ValidationError } from '../errors/app-error.js';
import type { AppBinaryBody, EndpointHandler } from '../http/app-request.js';
import type { Repositories } from '../repositories/index.js';
import { AttachmentService } from '../services/attachment-service.js';
import type { AttachmentObjectStore } from '../storage/attachment-object-store.js';
import { parseWithSchema } from '../validation/parse.js';

const workItemParamSchema = z.object({
  workItemId: z.string().uuid()
});

const attachmentParamSchema = z.object({
  attachmentId: z.string().uuid()
});

const uploadContentType = 'application/octet-stream';
const filenameHeader = 'x-worktrail-filename';
const mediaTypeHeader = 'x-worktrail-media-type';

export interface AttachmentHandlerOptions {
  repositories: Repositories;
  db: WorktrailDb;
  objectStore: AttachmentObjectStore;
}

export function listWorkItemAttachmentsHandler(
  options: AttachmentHandlerOptions
): EndpointHandler<WorkItemAttachmentListDto> {
  return async (request) => {
    const { workItemId } = parseWithSchema(workItemParamSchema, request.params);

    return {
      status: 200,
      body: await createService(options).listForWorkItem(request.actor, workItemId)
    };
  };
}

export function uploadWorkItemAttachmentHandler(
  options: AttachmentHandlerOptions
): EndpointHandler<WorkItemAttachmentDto> {
  return async (request) => {
    const { workItemId } = parseWithSchema(workItemParamSchema, request.params);
    requireUploadContentType(request.headers['content-type']);
    const fileName = decodeFileName(requireHeader(request.headers[filenameHeader], filenameHeader));
    const declaredMediaType = requireHeader(request.headers[mediaTypeHeader], mediaTypeHeader);

    if (!(request.body instanceof Uint8Array)) {
      throw new ValidationError('Attachment upload body must contain raw binary bytes.', {
        field: 'file',
        reason: 'invalid_body'
      });
    }

    return {
      status: 201,
      body: await createService(options).upload(request.actor, workItemId, {
        fileName,
        declaredMediaType,
        bytes: request.body
      })
    };
  };
}

export function downloadAttachmentHandler(
  options: AttachmentHandlerOptions
): EndpointHandler<AppBinaryBody> {
  return async (request) => {
    const { attachmentId } = parseWithSchema(attachmentParamSchema, request.params);
    const download = await createService(options).download(request.actor, attachmentId);

    return {
      status: 200,
      body: {
        kind: 'binary',
        bytes: download.bytes
      },
      headers: attachmentDownloadHeaders(download)
    };
  };
}

export function removeAttachmentHandler(options: AttachmentHandlerOptions): EndpointHandler<void> {
  return async (request) => {
    const { attachmentId } = parseWithSchema(attachmentParamSchema, request.params);
    await createService(options).remove(request.actor, attachmentId);

    return { status: 204 };
  };
}

function createService(options: AttachmentHandlerOptions): AttachmentService {
  return new AttachmentService({
    repositories: options.repositories,
    db: options.db,
    objectStore: options.objectStore
  });
}

function requireUploadContentType(value: string | undefined): void {
  if (value?.split(';', 1)[0]?.trim().toLowerCase() !== uploadContentType) {
    throw new ValidationError('Attachment uploads require application/octet-stream.', {
      field: 'content-type',
      reason: 'invalid_content_type'
    });
  }
}

function requireHeader(value: string | undefined, field: string): string {
  if (value === undefined || value.trim() === '') {
    throw new ValidationError(`The ${field} header is required.`, {
      field,
      reason: 'required'
    });
  }

  return value.trim();
}

function decodeFileName(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    throw new ValidationError(
      'The x-worktrail-filename header is not valid percent-encoded UTF-8.',
      {
        field: filenameHeader,
        reason: 'malformed_encoding'
      }
    );
  }
}

function attachmentDownloadHeaders(download: {
  fileName: string;
  mediaType: string;
  byteSize: number;
}): Record<string, string> {
  const fallbackName = asciiFileNameFallback(download.fileName);

  return {
    'Content-Type': download.mediaType,
    'Content-Disposition': `attachment; filename="${fallbackName}"; filename*=UTF-8''${encodeRfc5987(download.fileName)}`,
    'Content-Length': String(download.byteSize),
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff'
  };
}

function asciiFileNameFallback(fileName: string): string {
  const fallback = fileName
    .normalize('NFKD')
    .replace(/\p{Mark}/gu, '')
    .replace(/[^\x20-\x7e]/g, '_')
    .replace(/[^A-Za-z0-9._ -]/g, '_')
    .trim();

  return fallback === '' ? 'attachment' : fallback;
}

function encodeRfc5987(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  );
}
