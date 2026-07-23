import type {
  AttachmentCategory,
  AttachmentPolicyDto,
  AttachmentTypePolicyDto
} from '@worktrail/contracts';
import { fromBufferPromise } from 'yauzl';

import { ValidationError } from '../errors/app-error.js';

const MEBIBYTE = 1024 * 1024;
const MAX_OPEN_XML_ENTRIES = 2_000;
const HORIZONTAL_WHITESPACE = /[\p{Zs}\t]+/gu;
const TRAILING_PERIODS = /\.+$/u;

type ContentKind =
  'png' | 'jpeg' | 'gif' | 'webp' | 'pdf' | 'text' | 'json' | 'docx' | 'xlsx' | 'pptx';

interface AttachmentTypePolicy extends AttachmentTypePolicyDto {
  contentKind: ContentKind;
}

const acceptedTypes = [
  {
    extensions: ['.png'],
    mediaTypes: ['image/png'],
    canonicalMediaType: 'image/png',
    category: 'image',
    contentKind: 'png'
  },
  {
    extensions: ['.jpg', '.jpeg'],
    mediaTypes: ['image/jpeg'],
    canonicalMediaType: 'image/jpeg',
    category: 'image',
    contentKind: 'jpeg'
  },
  {
    extensions: ['.gif'],
    mediaTypes: ['image/gif'],
    canonicalMediaType: 'image/gif',
    category: 'image',
    contentKind: 'gif'
  },
  {
    extensions: ['.webp'],
    mediaTypes: ['image/webp'],
    canonicalMediaType: 'image/webp',
    category: 'image',
    contentKind: 'webp'
  },
  {
    extensions: ['.pdf'],
    mediaTypes: ['application/pdf'],
    canonicalMediaType: 'application/pdf',
    category: 'pdf',
    contentKind: 'pdf'
  },
  {
    extensions: ['.txt'],
    mediaTypes: ['text/plain'],
    canonicalMediaType: 'text/plain',
    category: 'text',
    contentKind: 'text'
  },
  {
    extensions: ['.md'],
    mediaTypes: ['text/markdown', 'text/plain'],
    canonicalMediaType: 'text/markdown',
    category: 'text',
    contentKind: 'text'
  },
  {
    extensions: ['.csv'],
    mediaTypes: ['text/csv'],
    canonicalMediaType: 'text/csv',
    category: 'data',
    contentKind: 'text'
  },
  {
    extensions: ['.json'],
    mediaTypes: ['application/json'],
    canonicalMediaType: 'application/json',
    category: 'data',
    contentKind: 'json'
  },
  {
    extensions: ['.docx'],
    mediaTypes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    canonicalMediaType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    category: 'document',
    contentKind: 'docx'
  },
  {
    extensions: ['.xlsx'],
    mediaTypes: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    canonicalMediaType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    category: 'document',
    contentKind: 'xlsx'
  },
  {
    extensions: ['.pptx'],
    mediaTypes: ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
    canonicalMediaType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    category: 'document',
    contentKind: 'pptx'
  }
] as const satisfies readonly AttachmentTypePolicy[];

const policyByExtension = new Map<string, AttachmentTypePolicy>(
  acceptedTypes.flatMap((policy) => policy.extensions.map((extension) => [extension, policy]))
);

export const attachmentPolicy = {
  maxFileBytes: 4 * MEBIBYTE,
  maxAttachmentsPerWorkItem: 20,
  maxAggregateBytesPerWorkItem: 50 * MEBIBYTE,
  maxFileNameCodePoints: 180
} as const;

export interface ValidatedAttachmentFile {
  fileName: string;
  extension: string;
  mediaType: string;
  category: AttachmentCategory;
  byteSize: number;
}

export function attachmentPolicyDto(): AttachmentPolicyDto {
  return {
    ...attachmentPolicy,
    acceptedTypes: acceptedTypes.map(({ contentKind: _contentKind, ...policy }) => ({
      ...policy,
      extensions: [...policy.extensions],
      mediaTypes: [...policy.mediaTypes]
    }))
  };
}

export function normalizeAttachmentFileName(input: string): string {
  const normalized = input
    .normalize('NFC')
    .replaceAll('/', '_')
    .replaceAll('\\', '_')
    .split('')
    .filter((character) => !isUnsafeControlCharacter(character))
    .join('')
    .replace(HORIZONTAL_WHITESPACE, ' ')
    .trim()
    .replace(TRAILING_PERIODS, '');

  if (normalized === '' || normalized === '.' || normalized === '..') {
    throw attachmentValidationError(
      'Attachment filename must contain a usable name and extension.',
      'invalid_file_name'
    );
  }

  if ([...normalized].length > attachmentPolicy.maxFileNameCodePoints) {
    throw attachmentValidationError(
      `Attachment filename must be ${attachmentPolicy.maxFileNameCodePoints} characters or fewer.`,
      'file_name_too_long',
      { maximumCodePoints: attachmentPolicy.maxFileNameCodePoints }
    );
  }

  return normalized;
}

function isUnsafeControlCharacter(character: string): boolean {
  const codePoint = character.codePointAt(0) ?? 0;

  return (
    codePoint <= 0x1f ||
    (codePoint >= 0x7f && codePoint <= 0x9f) ||
    codePoint === 0x2028 ||
    codePoint === 0x2029
  );
}

export async function validateAttachmentFile(input: {
  fileName: string;
  declaredMediaType: string;
  bytes: Uint8Array;
}): Promise<ValidatedAttachmentFile> {
  if (input.bytes.byteLength === 0) {
    throw attachmentValidationError('Attachment files cannot be empty.', 'empty_file');
  }

  if (input.bytes.byteLength > attachmentPolicy.maxFileBytes) {
    throw attachmentValidationError(
      `Attachment files must be ${attachmentPolicy.maxFileBytes / MEBIBYTE} MiB or smaller.`,
      'file_too_large',
      { maximumBytes: attachmentPolicy.maxFileBytes }
    );
  }

  const fileName = normalizeAttachmentFileName(input.fileName);
  const extension = attachmentFileExtension(fileName);
  const typePolicy = policyByExtension.get(extension);

  if (typePolicy === undefined) {
    throw attachmentValidationError(
      'This attachment file type is not supported.',
      'unsupported_type',
      { fileName }
    );
  }

  const declaredMediaType = input.declaredMediaType.trim().toLowerCase();

  if (!typePolicy.mediaTypes.includes(declaredMediaType)) {
    throw attachmentValidationError(
      'The attachment media type does not match its filename extension.',
      'media_type_mismatch',
      { fileName }
    );
  }

  if (!(await contentMatches(typePolicy.contentKind, input.bytes))) {
    throw attachmentValidationError(
      'The attachment contents do not match the supported file type.',
      'content_type_mismatch',
      { fileName }
    );
  }

  return {
    fileName,
    extension,
    mediaType: typePolicy.canonicalMediaType,
    category: typePolicy.category,
    byteSize: input.bytes.byteLength
  };
}

function attachmentFileExtension(fileName: string): string {
  const finalPeriod = fileName.lastIndexOf('.');

  if (finalPeriod <= 0 || finalPeriod === fileName.length - 1) {
    return '';
  }

  return fileName.slice(finalPeriod).toLowerCase();
}

async function contentMatches(contentKind: ContentKind, bytes: Uint8Array): Promise<boolean> {
  switch (contentKind) {
    case 'png':
      return hasPrefix(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case 'jpeg':
      return hasPrefix(bytes, [0xff, 0xd8, 0xff]);
    case 'gif':
      return hasAsciiPrefix(bytes, 'GIF87a') || hasAsciiPrefix(bytes, 'GIF89a');
    case 'webp':
      return hasAsciiAt(bytes, 0, 'RIFF') && hasAsciiAt(bytes, 8, 'WEBP');
    case 'pdf':
      return hasAsciiPrefix(bytes, '%PDF-');
    case 'text':
      return validUtf8Text(bytes) !== null;
    case 'json': {
      const text = validUtf8Text(bytes);

      if (text === null) {
        return false;
      }

      try {
        JSON.parse(text);
        return true;
      } catch {
        return false;
      }
    }
    case 'docx':
      return openXmlPackageMatches(bytes, 'word/');
    case 'xlsx':
      return openXmlPackageMatches(bytes, 'xl/');
    case 'pptx':
      return openXmlPackageMatches(bytes, 'ppt/');
  }
}

function hasPrefix(bytes: Uint8Array, prefix: readonly number[]): boolean {
  return prefix.every((value, index) => bytes[index] === value);
}

function hasAsciiPrefix(bytes: Uint8Array, value: string): boolean {
  return hasAsciiAt(bytes, 0, value);
}

function hasAsciiAt(bytes: Uint8Array, offset: number, value: string): boolean {
  if (bytes.byteLength < offset + value.length) {
    return false;
  }

  return [...value].every((character, index) => bytes[offset + index] === character.charCodeAt(0));
}

function validUtf8Text(bytes: Uint8Array): string | null {
  if (bytes.includes(0)) {
    return null;
  }

  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

async function openXmlPackageMatches(bytes: Uint8Array, expectedRoot: string): Promise<boolean> {
  if (!isZipSignature(bytes)) {
    return false;
  }

  try {
    const zipFile = await fromBufferPromise(Buffer.from(bytes), {
      autoClose: true,
      decodeStrings: true,
      lazyEntries: true,
      strictFileNames: true,
      validateEntrySizes: true
    });

    if (zipFile.entryCount === 0 || zipFile.entryCount > MAX_OPEN_XML_ENTRIES) {
      zipFile.close();
      return false;
    }

    let hasContentTypes = false;
    let hasExpectedRoot = false;

    for await (const entry of zipFile.eachEntry()) {
      if (entry.isEncrypted()) {
        return false;
      }

      hasContentTypes ||= entry.fileName === '[Content_Types].xml';
      hasExpectedRoot ||=
        entry.fileName.startsWith(expectedRoot) && entry.fileName.length > expectedRoot.length;
    }

    return hasContentTypes && hasExpectedRoot;
  } catch {
    return false;
  }
}

function isZipSignature(bytes: Uint8Array): boolean {
  return (
    bytes.byteLength >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    ((bytes[2] === 0x03 && bytes[3] === 0x04) ||
      (bytes[2] === 0x05 && bytes[3] === 0x06) ||
      (bytes[2] === 0x07 && bytes[3] === 0x08))
  );
}

function attachmentValidationError(
  message: string,
  reason: string,
  details: Record<string, unknown> = {}
): ValidationError {
  return new ValidationError(message, {
    field: 'file',
    reason,
    ...details
  });
}
