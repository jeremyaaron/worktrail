import { constants } from 'node:fs';
import { homedir } from 'node:os';
import { lstat, open, rm } from 'node:fs/promises';
import { dirname, isAbsolute, join, parse, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  attachmentStoreMarkerContents,
  attachmentStoreMarkerFileName
} from './local-attachment-store-layout.js';

export type LocalAttachmentStorageResetOutcome = 'removed' | 'missing';

export class LocalAttachmentStorageResetError extends Error {
  constructor(
    readonly reason: 'dangerous_path' | 'invalid_store' | 'unavailable'
  ) {
    super(`Local attachment storage reset failed: ${reason}.`);
    this.name = 'LocalAttachmentStorageResetError';
  }
}

export async function resetLocalAttachmentStorage(
  root: string,
  repositoryRoot = defaultRepositoryRoot()
): Promise<LocalAttachmentStorageResetOutcome> {
  const resolvedRoot = validateResetRoot(root, repositoryRoot);

  let rootStats;
  try {
    rootStats = await lstat(resolvedRoot);
  } catch (error) {
    if (isNodeError(error, 'ENOENT')) {
      return 'missing';
    }

    throw new LocalAttachmentStorageResetError('unavailable');
  }

  if (!rootStats.isDirectory()) {
    throw new LocalAttachmentStorageResetError('invalid_store');
  }

  await assertValidMarker(resolvedRoot);

  try {
    await rm(resolvedRoot, { recursive: true });
  } catch {
    throw new LocalAttachmentStorageResetError('unavailable');
  }

  return 'removed';
}

function validateResetRoot(root: string, repositoryRoot: string): string {
  const resolvedRoot = resolve(root);
  const dangerousRoots = new Set([
    parse(resolvedRoot).root,
    resolve(homedir()),
    resolve(repositoryRoot)
  ]);

  if (!isAbsolute(root) || dangerousRoots.has(resolvedRoot)) {
    throw new LocalAttachmentStorageResetError('dangerous_path');
  }

  return resolvedRoot;
}

async function assertValidMarker(root: string): Promise<void> {
  let marker;

  try {
    marker = await open(
      join(root, attachmentStoreMarkerFileName),
      constants.O_RDONLY | constants.O_NOFOLLOW
    );
  } catch {
    throw new LocalAttachmentStorageResetError('invalid_store');
  }

  try {
    const stats = await marker.stat();
    const contents = await marker.readFile('utf8');

    if (!stats.isFile() || contents !== attachmentStoreMarkerContents) {
      throw new LocalAttachmentStorageResetError('invalid_store');
    }
  } catch (error) {
    if (error instanceof LocalAttachmentStorageResetError) {
      throw error;
    }

    throw new LocalAttachmentStorageResetError('unavailable');
  } finally {
    await marker.close().catch(() => undefined);
  }
}

function defaultRepositoryRoot(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
}

function isNodeError(error: unknown, code: string): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error && error.code === code;
}
