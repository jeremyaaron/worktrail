import { createHash } from 'node:crypto';

interface SeedAttachmentDefinition {
  id: string;
  activityEventId: string;
  uploader: 'owner' | 'maintainer';
  fileName: string;
  mediaType: string;
  contents: string;
  createdAt: Date;
}

export interface DeterministicSeedAttachment extends SeedAttachmentDefinition {
  bytes: Uint8Array;
  byteSize: number;
  checksumSha256: string;
  storageKey: string;
}

const definitions: readonly SeedAttachmentDefinition[] = [
  {
    id: '10000000-0000-4000-8000-000000001001',
    activityEventId: '10000000-0000-4000-8000-000000000610',
    uploader: 'maintainer',
    fileName: 'attachment-requirements.md',
    mediaType: 'text/markdown',
    contents: [
      '# Attachment requirements',
      '',
      '- Preserve exact file bytes.',
      '- Keep object storage and metadata consistent.',
      ''
    ].join('\n'),
    createdAt: new Date('2026-07-03T12:05:00.000Z')
  },
  {
    id: '10000000-0000-4000-8000-000000001002',
    activityEventId: '10000000-0000-4000-8000-000000000611',
    uploader: 'owner',
    fileName: 'verification-evidence.json',
    mediaType: 'application/json',
    contents: [
      '{',
      '  "check": "attachment download",',
      '  "result": "passed",',
      '  "workItem": "WT-3"',
      '}',
      ''
    ].join('\n'),
    createdAt: new Date('2026-07-03T12:10:00.000Z')
  }
] as const;

export const deterministicSeedAttachments: readonly DeterministicSeedAttachment[] =
  definitions.map((definition) => {
    const bytes = new TextEncoder().encode(definition.contents);
    const checksumSha256 = createHash('sha256').update(bytes).digest('hex');

    return {
      ...definition,
      bytes,
      byteSize: bytes.byteLength,
      checksumSha256,
      storageKey: checksumSha256
    };
  });
