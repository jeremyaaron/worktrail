import { mkdir, mkdtemp, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { LocalAttachmentObjectStore } from '../src/storage/local-attachment-object-store.js';
import {
  LocalAttachmentStorageResetError,
  resetLocalAttachmentStorage
} from '../src/storage/reset-local-attachment-storage.js';

const temporaryRoots: string[] = [];

async function createTemporaryRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'worktrail-storage-reset-'));
  temporaryRoots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true }))
  );
});

describe('resetLocalAttachmentStorage', () => {
  it('removes an initialized isolated store and is idempotent when it is absent', async () => {
    const root = await createTemporaryRoot();
    const store = new LocalAttachmentObjectStore(root);
    const key = 'a'.repeat(64);
    await store.initialize();
    await store.put(key, Uint8Array.from([1, 2, 3]));

    await expect(resetLocalAttachmentStorage(root)).resolves.toBe('removed');
    await expect(stat(root)).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(resetLocalAttachmentStorage(root)).resolves.toBe('missing');
  });

  it('refuses filesystem root, home, repository root, and relative paths', async () => {
    const repositoryRoot = '/tmp/worktrail-repository-root';

    for (const root of ['/', homedir(), repositoryRoot, 'relative/attachments']) {
      await expect(resetLocalAttachmentStorage(root, repositoryRoot)).rejects.toMatchObject({
        name: 'LocalAttachmentStorageResetError',
        reason: 'dangerous_path'
      });
    }
  });

  it('preserves an unmarked directory and its contents', async () => {
    const root = await createTemporaryRoot();
    const sentinel = join(root, 'keep.txt');
    await writeFile(sentinel, 'keep me');

    await expect(resetLocalAttachmentStorage(root)).rejects.toBeInstanceOf(
      LocalAttachmentStorageResetError
    );
    await expect(readFile(sentinel, 'utf8')).resolves.toBe('keep me');
  });

  it('refuses malformed and symlinked markers without deleting the root', async () => {
    const malformedRoot = await createTemporaryRoot();
    await writeFile(join(malformedRoot, '.worktrail-attachment-store'), 'not-worktrail');
    await expect(resetLocalAttachmentStorage(malformedRoot)).rejects.toMatchObject({
      reason: 'invalid_store'
    });
    await expect(stat(malformedRoot)).resolves.toMatchObject({});

    const symlinkRoot = await createTemporaryRoot();
    const target = join(symlinkRoot, 'marker-target');
    await writeFile(target, 'worktrail-local-attachment-store:v1\n');
    await symlink(target, join(symlinkRoot, '.worktrail-attachment-store'));
    await expect(resetLocalAttachmentStorage(symlinkRoot)).rejects.toMatchObject({
      reason: 'invalid_store'
    });
    await expect(readFile(target, 'utf8')).resolves.toBe('worktrail-local-attachment-store:v1\n');
  });

  it('refuses a symlinked root even when its target is an initialized store', async () => {
    const parent = await createTemporaryRoot();
    const target = join(parent, 'target');
    const linkedRoot = join(parent, 'linked');
    await mkdir(target);
    await new LocalAttachmentObjectStore(target).initialize();
    await symlink(target, linkedRoot);

    await expect(resetLocalAttachmentStorage(linkedRoot)).rejects.toMatchObject({
      reason: 'invalid_store'
    });
    await expect(stat(target)).resolves.toMatchObject({});
  });
});
