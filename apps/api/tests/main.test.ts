import express from 'express';
import type { Server } from 'node:http';
import type pg from 'pg';

import { describe, expect, it, vi } from 'vitest';

import type { RuntimeConfig } from '../src/config/runtime-config.js';
import type { WorktrailDb } from '../src/db/client.js';
import { start, type StartDependencies } from '../src/main.js';
import type { Repositories } from '../src/repositories/index.js';
import {
  AttachmentObjectStoreError,
  type AttachmentObjectStore
} from '../src/storage/attachment-object-store.js';

const runtimeConfig: RuntimeConfig = {
  nodeEnv: 'test',
  apiPort: 0,
  databaseUrl: 'postgres://test:test@localhost:5432/test',
  corsOrigin: false,
  serveStaticAssets: false,
  staticAssetsPath: '/unused/static',
  attachmentStorageDriver: 'local',
  attachmentStoragePath: '/unused/attachments',
  localActorMode: 'enabled'
};

function createStartupDependencies(objectStore: AttachmentObjectStore) {
  const pool = {
    end: vi.fn(async () => undefined)
  } as unknown as pg.Pool;
  const db = {} as WorktrailDb;
  const repositories = {} as Repositories;
  const dependencies: Partial<StartDependencies> = {
    loadRuntimeConfig: vi.fn(() => runtimeConfig),
    createPool: vi.fn(() => pool),
    createDb: vi.fn(() => db),
    createRepositories: vi.fn(() => repositories),
    createAttachmentObjectStore: vi.fn(() => objectStore),
    createExpressApp: vi.fn(() => express()),
    log: vi.fn()
  };

  return { dependencies, pool, db, repositories };
}

async function closeServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error === undefined) {
        resolve();
      } else {
        reject(error);
      }
    });
  });
}

describe('API startup', () => {
  it('initializes attachment storage before constructing and listening to the app', async () => {
    const order: string[] = [];
    const objectStore: AttachmentObjectStore = {
      initialize: vi.fn(async () => {
        order.push('initialize');
      }),
      put: vi.fn(),
      get: vi.fn(),
      remove: vi.fn()
    };
    const fixture = createStartupDependencies(objectStore);
    fixture.dependencies.createExpressApp = vi.fn((options) => {
      order.push('create-app');
      expect(options).toMatchObject({
        repositories: fixture.repositories,
        db: fixture.db,
        healthCheckPool: fixture.pool,
        attachmentObjectStore: objectStore,
        corsOrigin: false
      });
      return express();
    });

    const { server } = await start(fixture.dependencies);

    expect(order).toEqual(['initialize', 'create-app']);
    expect(objectStore.initialize).toHaveBeenCalledOnce();
    expect(fixture.pool.end).not.toHaveBeenCalled();
    await closeServer(server);
    await fixture.pool.end();
  });

  it('closes the database pool and never constructs the app when storage initialization fails', async () => {
    const objectStore: AttachmentObjectStore = {
      initialize: vi.fn(async () => {
        throw new AttachmentObjectStoreError('initialize', 'unavailable');
      }),
      put: vi.fn(),
      get: vi.fn(),
      remove: vi.fn()
    };
    const fixture = createStartupDependencies(objectStore);

    await expect(start(fixture.dependencies)).rejects.toMatchObject({
      name: 'AttachmentObjectStoreError',
      operation: 'initialize',
      reason: 'unavailable'
    });
    expect(fixture.dependencies.createExpressApp).not.toHaveBeenCalled();
    expect(fixture.pool.end).toHaveBeenCalledOnce();
  });

  it('closes the database pool when app construction fails after storage initialization', async () => {
    const objectStore: AttachmentObjectStore = {
      initialize: vi.fn(async () => undefined),
      put: vi.fn(),
      get: vi.fn(),
      remove: vi.fn()
    };
    const fixture = createStartupDependencies(objectStore);
    fixture.dependencies.createExpressApp = vi.fn(() => {
      throw new Error('app construction failed');
    });

    await expect(start(fixture.dependencies)).rejects.toThrow('app construction failed');
    expect(fixture.pool.end).toHaveBeenCalledOnce();
  });
});
