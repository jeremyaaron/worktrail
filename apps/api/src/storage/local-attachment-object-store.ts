import { randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { access, link, lstat, mkdir, open, readdir, unlink } from 'node:fs/promises';
import { isAbsolute, join, parse, resolve } from 'node:path';

import { attachmentPolicy } from '../domain/attachment-policy.js';
import {
  assertAttachmentObjectKey,
  AttachmentObjectStoreError,
  type AttachmentObjectRemovalOutcome,
  type AttachmentObjectStore,
  type AttachmentObjectStoreOperation
} from './attachment-object-store.js';
import {
  attachmentStoreMarkerContents,
  attachmentStoreMarkerFileName,
  attachmentStoreObjectsDirectoryName
} from './local-attachment-store-layout.js';

export class LocalAttachmentObjectStore implements AttachmentObjectStore {
  private readonly root: string;

  constructor(root: string) {
    const resolvedRoot = resolve(root);

    if (!isAbsolute(root) || resolvedRoot === parse(resolvedRoot).root) {
      throw new AttachmentObjectStoreError('initialize', 'invalid_object');
    }

    this.root = resolvedRoot;
  }

  async initialize(): Promise<void> {
    try {
      await mkdir(this.root, { recursive: true, mode: 0o700 });
      const rootStats = await lstat(this.root);

      if (!rootStats.isDirectory()) {
        throw new AttachmentObjectStoreError('initialize', 'invalid_object');
      }

      await access(this.root, constants.W_OK | constants.X_OK);
      await this.ensureStoreMarker();
      const objectsDirectory = this.objectsDirectory();
      await mkdir(objectsDirectory, { recursive: true, mode: 0o700 });
      const objectDirectoryStats = await lstat(objectsDirectory);

      if (!objectDirectoryStats.isDirectory()) {
        throw new AttachmentObjectStoreError('initialize', 'invalid_object');
      }

      await access(objectsDirectory, constants.W_OK | constants.X_OK);
    } catch (error) {
      throw normalizeStorageError('initialize', error);
    }
  }

  async put(key: string, bytes: Uint8Array): Promise<void> {
    assertAttachmentObjectKey(key, 'put');
    const shardDirectory = this.shardDirectory(key);
    const finalPath = this.objectPath(key);
    const temporaryPath = join(shardDirectory, `.${randomUUID()}.tmp`);
    let temporaryCreated = false;

    try {
      await mkdir(shardDirectory, { recursive: true, mode: 0o700 });
      const temporaryFile = await open(temporaryPath, 'wx', 0o600);
      temporaryCreated = true;

      try {
        await temporaryFile.writeFile(bytes);
        await temporaryFile.sync();
      } finally {
        await temporaryFile.close();
      }

      try {
        await link(temporaryPath, finalPath);
      } catch (error) {
        if (isNodeError(error, 'EEXIST')) {
          throw new AttachmentObjectStoreError('put', 'object_exists');
        }

        throw error;
      }
    } catch (error) {
      throw normalizeStorageError('put', error);
    } finally {
      if (temporaryCreated) {
        await removeTemporaryFile(temporaryPath);
      }
    }
  }

  async get(key: string): Promise<Uint8Array | null> {
    assertAttachmentObjectKey(key, 'get');
    let objectFile;

    try {
      objectFile = await open(this.objectPath(key), constants.O_RDONLY | constants.O_NOFOLLOW);
    } catch (error) {
      if (isNodeError(error, 'ENOENT')) {
        return null;
      }

      throw normalizeStorageError('get', error);
    }

    try {
      const stats = await objectFile.stat();

      if (!stats.isFile()) {
        throw new AttachmentObjectStoreError('get', 'invalid_object');
      }

      if (stats.size > attachmentPolicy.maxFileBytes) {
        throw new AttachmentObjectStoreError('get', 'object_too_large');
      }

      const bytes = await objectFile.readFile();

      if (bytes.byteLength > attachmentPolicy.maxFileBytes) {
        throw new AttachmentObjectStoreError('get', 'object_too_large');
      }

      await objectFile.close();
      return new Uint8Array(bytes);
    } catch (error) {
      try {
        await objectFile.close();
      } catch {
        // Preserve the first failure while still making a best-effort close.
      }

      throw normalizeStorageError('get', error);
    }
  }

  async remove(key: string): Promise<AttachmentObjectRemovalOutcome> {
    assertAttachmentObjectKey(key, 'remove');
    const objectPath = this.objectPath(key);

    try {
      const stats = await lstat(objectPath);

      if (!stats.isFile()) {
        throw new AttachmentObjectStoreError('remove', 'invalid_object');
      }

      await unlink(objectPath);
      return 'removed';
    } catch (error) {
      if (isNodeError(error, 'ENOENT')) {
        return 'missing';
      }

      throw normalizeStorageError('remove', error);
    }
  }

  private objectsDirectory(): string {
    return join(this.root, attachmentStoreObjectsDirectoryName);
  }

  private async ensureStoreMarker(): Promise<void> {
    const markerPath = join(this.root, attachmentStoreMarkerFileName);

    try {
      const marker = await open(markerPath, constants.O_RDONLY | constants.O_NOFOLLOW);

      try {
        const stats = await marker.stat();
        const contents = await marker.readFile('utf8');

        if (!stats.isFile() || contents !== attachmentStoreMarkerContents) {
          throw new AttachmentObjectStoreError('initialize', 'invalid_object');
        }
      } finally {
        await marker.close();
      }

      return;
    } catch (error) {
      if (!isNodeError(error, 'ENOENT')) {
        throw error;
      }
    }

    const existingEntries = await readdir(this.root);

    if (existingEntries.some((entry) => entry !== attachmentStoreObjectsDirectoryName)) {
      throw new AttachmentObjectStoreError('initialize', 'invalid_object');
    }

    const marker = await open(markerPath, 'wx', 0o600);

    try {
      await marker.writeFile(attachmentStoreMarkerContents);
      await marker.sync();
    } finally {
      await marker.close();
    }
  }

  private shardDirectory(key: string): string {
    return join(this.objectsDirectory(), key.slice(0, 2));
  }

  private objectPath(key: string): string {
    return join(this.shardDirectory(key), key);
  }
}

async function removeTemporaryFile(path: string): Promise<void> {
  try {
    await unlink(path);
  } catch (error) {
    if (!isNodeError(error, 'ENOENT')) {
      throw normalizeStorageError('put', error);
    }
  }
}

function normalizeStorageError(
  operation: AttachmentObjectStoreOperation,
  error: unknown
): AttachmentObjectStoreError {
  return error instanceof AttachmentObjectStoreError
    ? error
    : new AttachmentObjectStoreError(operation, 'unavailable');
}

function isNodeError(error: unknown, code: string): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error && error.code === code;
}
