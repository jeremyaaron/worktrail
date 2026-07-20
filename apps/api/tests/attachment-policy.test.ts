import { describe, expect, it } from 'vitest';

import {
  attachmentPolicy,
  attachmentPolicyDto,
  normalizeAttachmentFileName,
  validateAttachmentFile
} from '../src/domain/attachment-policy.js';
import { activityEventTypes } from '../src/domain/constants.js';

const encoder = new TextEncoder();

describe('attachment policy', () => {
  it('keeps API activity vocabulary aligned with attachment lifecycle events', () => {
    expect(activityEventTypes).toContain('work_item.attachment_uploaded');
    expect(activityEventTypes).toContain('work_item.attachment_removed');
  });

  it('exposes fixed limits and defensive copies of accepted type guidance', () => {
    const first = attachmentPolicyDto();
    const second = attachmentPolicyDto();

    expect(first).toMatchObject({
      maxFileBytes: 4 * 1024 * 1024,
      maxAttachmentsPerWorkItem: 20,
      maxAggregateBytesPerWorkItem: 50 * 1024 * 1024,
      maxFileNameCodePoints: 180
    });
    expect(first.acceptedTypes.map((type) => type.category)).toEqual([
      'image',
      'image',
      'image',
      'image',
      'pdf',
      'text',
      'text',
      'data',
      'data',
      'document',
      'document',
      'document'
    ]);

    first.acceptedTypes[0]!.extensions.push('.changed');
    expect(second.acceptedTypes[0]?.extensions).toEqual(['.png']);
  });

  it('normalizes safe display names without treating them as paths', () => {
    expect(normalizeAttachmentFileName('folder/  review\\shot\u0000.PNG...')).toBe(
      'folder_ review_shot.PNG'
    );
    expect(normalizeAttachmentFileName('Cafe\u0301 notes.md')).toBe('Café notes.md');
    expect(normalizeAttachmentFileName(`${'a'.repeat(176)}.txt`)).toHaveLength(180);
  });

  it('rejects empty, reserved, and overlong normalized names', () => {
    expectValidation(() => normalizeAttachmentFileName(' . '), 'invalid_file_name');
    expectValidation(() => normalizeAttachmentFileName('..'), 'invalid_file_name');
    expectValidation(
      () => normalizeAttachmentFileName(`${'a'.repeat(177)}.txt`),
      'file_name_too_long'
    );
  });

  it.each([
    ['image.PNG', 'image/png', bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a), 'image/png'],
    ['photo.jpeg', 'image/jpeg', bytes(0xff, 0xd8, 0xff, 0xe0), 'image/jpeg'],
    ['animation.gif', 'image/gif', encoder.encode('GIF89a'), 'image/gif'],
    [
      'capture.webp',
      'image/webp',
      Uint8Array.from([...encoder.encode('RIFF'), 0, 0, 0, 0, ...encoder.encode('WEBP')]),
      'image/webp'
    ],
    ['brief.pdf', 'application/pdf', encoder.encode('%PDF-1.7'), 'application/pdf'],
    ['notes.txt', 'text/plain', encoder.encode('Review evidence'), 'text/plain'],
    ['readme.md', 'text/plain', encoder.encode('# Review'), 'text/markdown'],
    ['evidence.csv', 'text/csv', encoder.encode('name,result\ncheck,pass\n'), 'text/csv'],
    ['result.json', 'application/json', encoder.encode('{"result":"pass"}'), 'application/json']
  ])(
    'accepts supported %s content and returns canonical metadata',
    async (fileName, mediaType, data, canonical) => {
      await expect(
        validateAttachmentFile({
          fileName,
          declaredMediaType: mediaType,
          bytes: data
        })
      ).resolves.toMatchObject({
        fileName,
        extension: `.${fileName.split('.').at(-1)!.toLowerCase()}`,
        mediaType: canonical,
        byteSize: data.byteLength
      });
    }
  );

  it.each([
    [
      'requirements.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'word/document.xml'
    ],
    [
      'evidence.xlsx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'xl/workbook.xml'
    ],
    [
      'review.pptx',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'ppt/presentation.xml'
    ]
  ])(
    'accepts bounded Open XML package metadata for %s',
    async (fileName, mediaType, packageEntry) => {
      const data = storedZip(['[Content_Types].xml', packageEntry]);

      await expect(
        validateAttachmentFile({
          fileName,
          declaredMediaType: mediaType,
          bytes: data
        })
      ).resolves.toMatchObject({
        fileName,
        mediaType,
        byteSize: data.byteLength
      });
    }
  );

  it('rejects empty and oversized byte input', async () => {
    await expectValidationAsync(
      validateAttachmentFile({
        fileName: 'empty.txt',
        declaredMediaType: 'text/plain',
        bytes: bytes()
      }),
      'empty_file'
    );
    await expectValidationAsync(
      validateAttachmentFile({
        fileName: 'large.txt',
        declaredMediaType: 'text/plain',
        bytes: new Uint8Array(attachmentPolicy.maxFileBytes + 1)
      }),
      'file_too_large'
    );
  });

  it('rejects unsupported, unknown-binary, mismatched, and active content types', async () => {
    await expectValidationAsync(
      validateAttachmentFile({
        fileName: 'script.svg',
        declaredMediaType: 'image/svg+xml',
        bytes: encoder.encode('<svg></svg>')
      }),
      'unsupported_type'
    );
    await expectValidationAsync(
      validateAttachmentFile({
        fileName: 'evidence.pdf',
        declaredMediaType: 'application/octet-stream',
        bytes: encoder.encode('%PDF-1.7')
      }),
      'media_type_mismatch'
    );
    await expectValidationAsync(
      validateAttachmentFile({
        fileName: 'evidence.pdf',
        declaredMediaType: 'text/plain',
        bytes: encoder.encode('%PDF-1.7')
      }),
      'media_type_mismatch'
    );
    await expectValidationAsync(
      validateAttachmentFile({
        fileName: 'page.html',
        declaredMediaType: 'text/html',
        bytes: encoder.encode('<html></html>')
      }),
      'unsupported_type'
    );
  });

  it('rejects signature, UTF-8, NUL, and JSON content mismatches', async () => {
    await expectValidationAsync(
      validateAttachmentFile({
        fileName: 'renamed.png',
        declaredMediaType: 'image/png',
        bytes: encoder.encode('MZ executable')
      }),
      'content_type_mismatch'
    );
    await expectValidationAsync(
      validateAttachmentFile({
        fileName: 'invalid.txt',
        declaredMediaType: 'text/plain',
        bytes: bytes(0xc3, 0x28)
      }),
      'content_type_mismatch'
    );
    await expectValidationAsync(
      validateAttachmentFile({
        fileName: 'nul.txt',
        declaredMediaType: 'text/plain',
        bytes: bytes(0x61, 0, 0x62)
      }),
      'content_type_mismatch'
    );
    await expectValidationAsync(
      validateAttachmentFile({
        fileName: 'invalid.json',
        declaredMediaType: 'application/json',
        bytes: encoder.encode('{invalid}')
      }),
      'content_type_mismatch'
    );
  });

  it('rejects malformed, wrong-root, encrypted, and excessive Open XML packages', async () => {
    const mediaType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    await expectValidationAsync(
      validateAttachmentFile({
        fileName: 'malformed.docx',
        declaredMediaType: mediaType,
        bytes: bytes(0x50, 0x4b, 0x03, 0x04, 0, 0)
      }),
      'content_type_mismatch'
    );
    await expectValidationAsync(
      validateAttachmentFile({
        fileName: 'wrong-root.docx',
        declaredMediaType: mediaType,
        bytes: storedZip(['[Content_Types].xml', 'xl/workbook.xml'])
      }),
      'content_type_mismatch'
    );
    await expectValidationAsync(
      validateAttachmentFile({
        fileName: 'encrypted.docx',
        declaredMediaType: mediaType,
        bytes: storedZip(['[Content_Types].xml', 'word/document.xml'], 1)
      }),
      'content_type_mismatch'
    );
    await expectValidationAsync(
      validateAttachmentFile({
        fileName: 'excessive.docx',
        declaredMediaType: mediaType,
        bytes: storedZip([
          '[Content_Types].xml',
          'word/document.xml',
          ...Array.from({ length: 1_999 }, (_, index) => `word/item-${index}.xml`)
        ])
      }),
      'content_type_mismatch'
    );
  });
});

function bytes(...values: number[]): Uint8Array {
  return Uint8Array.from(values);
}

function expectValidation(action: () => unknown, reason: string): void {
  expect(action).toThrowError(
    expect.objectContaining({
      code: 'VALIDATION_ERROR',
      details: expect.objectContaining({ field: 'file', reason })
    })
  );
}

async function expectValidationAsync(action: Promise<unknown>, reason: string): Promise<void> {
  await expect(action).rejects.toMatchObject({
    code: 'VALIDATION_ERROR',
    details: { field: 'file', reason }
  });
}

function storedZip(fileNames: string[], encryptedEntryIndex = -1): Uint8Array {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let localOffset = 0;

  fileNames.forEach((fileName, index) => {
    const name = Buffer.from(fileName, 'utf8');
    const flags = index === encryptedEntryIndex ? 1 : 0;
    const local = Buffer.alloc(30 + name.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(flags, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(name.length, 26);
    name.copy(local, 30);
    localParts.push(local);

    const central = Buffer.alloc(46 + name.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(flags, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(localOffset, 42);
    name.copy(central, 46);
    centralParts.push(central);
    localOffset += local.length;
  });

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(fileNames.length, 8);
  end.writeUInt16LE(fileNames.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(localOffset, 16);

  return Buffer.concat([...localParts, centralDirectory, end]);
}
