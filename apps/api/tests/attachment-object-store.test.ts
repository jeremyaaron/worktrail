import { randomBytes } from 'node:crypto';
import { mkdir, mkdtemp, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { attachmentPolicy } from '../src/domain/attachment-policy.js';
import { AttachmentObjectStoreError } from '../src/storage/attachment-object-store.js';
import { InMemoryAttachmentObjectStore } from '../src/storage/in-memory-attachment-object-store.js';
import { LocalAttachmentObjectStore } from '../src/storage/local-attachment-object-store.js';

const temporaryRoots: string[] = [];
const firstKey = 'a'.repeat(64);
const secondKey = 'b'.repeat(64);

async function createTemporaryRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'worktrail-attachments-'));
  temporaryRoots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true }))
  );
});

describe('LocalAttachmentObjectStore', () => {
  it('rejects relative and filesystem-root locations before writing', () => {
    for (const root of ['relative/attachments', '/']) {
      expect(() => new LocalAttachmentObjectStore(root)).toThrowError(
        expect.objectContaining({
          operation: 'initialize',
          reason: 'invalid_object'
        })
      );
    }
  });

  it('initializes an isolated root and preserves immutable bytes across adapter recreation', async () => {
    const root = await createTemporaryRoot();
    const originalBytes = Uint8Array.from([1, 2, 3, 4]);
    const firstStore = new LocalAttachmentObjectStore(root);

    await firstStore.initialize();
    await firstStore.put(firstKey, originalBytes);
    originalBytes[0] = 99;

    const recreatedStore = new LocalAttachmentObjectStore(root);
    await recreatedStore.initialize();

    await expect(recreatedStore.get(firstKey)).resolves.toEqual(Uint8Array.from([1, 2, 3, 4]));
    await expect(stat(join(root, 'objects', 'aa', firstKey))).resolves.toMatchObject({
      size: 4
    });
  });

  it('publishes create-only objects and removes temporary files after a collision', async () => {
    const root = await createTemporaryRoot();
    const store = new LocalAttachmentObjectStore(root);
    await store.initialize();
    await store.put(firstKey, Uint8Array.from([1, 2, 3]));

    await expect(store.put(firstKey, Uint8Array.from([9]))).rejects.toMatchObject({
      name: 'AttachmentObjectStoreError',
      operation: 'put',
      reason: 'object_exists'
    });
    await expect(store.get(firstKey)).resolves.toEqual(Uint8Array.from([1, 2, 3]));
    await expect(readdir(join(root, 'objects', 'aa'))).resolves.toEqual([firstKey]);
  });

  it('returns missing outcomes and removes existing objects idempotently', async () => {
    const root = await createTemporaryRoot();
    const store = new LocalAttachmentObjectStore(root);
    await store.initialize();

    await expect(store.get(secondKey)).resolves.toBeNull();
    await expect(store.remove(secondKey)).resolves.toBe('missing');
    await store.put(secondKey, Uint8Array.from([5, 6]));
    await expect(store.remove(secondKey)).resolves.toBe('removed');
    await expect(store.remove(secondKey)).resolves.toBe('missing');
  });

  it('rejects malformed keys before they can escape the configured root', async () => {
    const root = await createTemporaryRoot();
    const store = new LocalAttachmentObjectStore(root);
    await store.initialize();

    for (const [operation, action] of [
      ['put', () => store.put('../outside', Uint8Array.from([1]))],
      ['get', () => store.get('A'.repeat(64))],
      ['remove', () => store.remove('short')]
    ] as const) {
      await expect(action()).rejects.toMatchObject({
        name: 'AttachmentObjectStoreError',
        operation,
        reason: 'invalid_key'
      });
    }

    await expect(readdir(root)).resolves.toEqual(['.worktrail-attachment-store', 'objects']);
  });

  it('refuses to adopt an unmarked directory containing unrelated files', async () => {
    const root = await createTemporaryRoot();
    await writeFile(join(root, 'unrelated.txt'), 'keep me');

    await expect(new LocalAttachmentObjectStore(root).initialize()).rejects.toMatchObject({
      operation: 'initialize',
      reason: 'invalid_object'
    });
    await expect(readdir(root)).resolves.toEqual(['unrelated.txt']);
  });

  it('rejects oversized and non-regular stored objects', async () => {
    const root = await createTemporaryRoot();
    const store = new LocalAttachmentObjectStore(root);
    await store.initialize();
    const oversizedKey = 'c'.repeat(64);
    const invalidKey = 'd'.repeat(64);
    await mkdir(join(root, 'objects', 'cc'), { recursive: true });
    await writeFile(
      join(root, 'objects', 'cc', oversizedKey),
      randomBytes(attachmentPolicy.maxFileBytes + 1)
    );
    await mkdir(join(root, 'objects', 'dd', invalidKey), { recursive: true });

    await expect(store.get(oversizedKey)).rejects.toMatchObject({
      operation: 'get',
      reason: 'object_too_large'
    });
    await expect(store.get(invalidKey)).rejects.toMatchObject({
      operation: 'get',
      reason: 'invalid_object'
    });
    await expect(store.remove(invalidKey)).rejects.toMatchObject({
      operation: 'remove',
      reason: 'invalid_object'
    });
  });

  it('rejects a configured root that is not a directory without exposing its path', async () => {
    const parent = await createTemporaryRoot();
    const rootFile = join(parent, 'not-a-directory');
    await writeFile(rootFile, 'occupied');
    const store = new LocalAttachmentObjectStore(rootFile);

    let failure: unknown;
    try {
      await store.initialize();
    } catch (error) {
      failure = error;
    }

    expect(failure).toBeInstanceOf(AttachmentObjectStoreError);
    expect(failure).toMatchObject({ operation: 'initialize' });
    expect(String(failure)).not.toContain(rootFile);
  });
});

describe('InMemoryAttachmentObjectStore', () => {
  it('copies values on write and read and keeps create-only semantics', async () => {
    const store = new InMemoryAttachmentObjectStore();
    const input = Uint8Array.from([1, 2, 3]);
    await store.initialize();
    await store.put(firstKey, input);
    input[0] = 9;

    const firstRead = await store.get(firstKey);
    firstRead![1] = 9;

    await expect(store.get(firstKey)).resolves.toEqual(Uint8Array.from([1, 2, 3]));
    await expect(store.put(firstKey, Uint8Array.from([4]))).rejects.toMatchObject({
      operation: 'put',
      reason: 'object_exists'
    });
  });

  it('injects each requested failure once and remains usable afterward', async () => {
    const store = new InMemoryAttachmentObjectStore();

    for (const operation of ['initialize', 'put', 'get', 'remove'] as const) {
      store.failNext(operation);
      const action = {
        initialize: () => store.initialize(),
        put: () => store.put(firstKey, Uint8Array.from([1])),
        get: () => store.get(firstKey),
        remove: () => store.remove(firstKey)
      }[operation];

      await expect(action()).rejects.toMatchObject({ operation, reason: 'unavailable' });
    }

    await expect(store.initialize()).resolves.toBeUndefined();
    await expect(store.put(firstKey, Uint8Array.from([1]))).resolves.toBeUndefined();
    await expect(store.get(firstKey)).resolves.toEqual(Uint8Array.from([1]));
    await expect(store.remove(firstKey)).resolves.toBe('removed');
  });

  it('enforces the same bounded-read contract as local storage', async () => {
    const store = new InMemoryAttachmentObjectStore();
    await store.put(firstKey, randomBytes(attachmentPolicy.maxFileBytes + 1));

    await expect(store.get(firstKey)).rejects.toMatchObject({
      operation: 'get',
      reason: 'object_too_large'
    });
  });
});
