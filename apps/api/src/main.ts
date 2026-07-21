import 'dotenv/config';

import type { Express } from 'express';
import type { Server } from 'node:http';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type pg from 'pg';

import { createExpressApp, type CreateExpressAppOptions } from './adapters/express/server.js';
import {
  formatRuntimeConfigError,
  loadRuntimeConfig,
  RuntimeConfigError,
  type RuntimeConfig
} from './config/runtime-config.js';
import { createDb, createPool, type WorktrailDb } from './db/client.js';
import { createRepositories, type Repositories } from './repositories/index.js';
import {
  AttachmentObjectStoreError,
  type AttachmentObjectStore
} from './storage/attachment-object-store.js';
import { LocalAttachmentObjectStore } from './storage/local-attachment-object-store.js';

export interface StartDependencies {
  loadRuntimeConfig: () => RuntimeConfig;
  createPool: (connectionString: string) => pg.Pool;
  createDb: (pool: pg.Pool) => WorktrailDb;
  createRepositories: (db: WorktrailDb) => Repositories;
  createAttachmentObjectStore: (config: RuntimeConfig) => AttachmentObjectStore;
  createExpressApp: (options: CreateExpressAppOptions) => Express;
  log: (message: string) => void;
}

const defaultStartDependencies: StartDependencies = {
  loadRuntimeConfig,
  createPool,
  createDb,
  createRepositories,
  createAttachmentObjectStore: (config) =>
    new LocalAttachmentObjectStore(config.attachmentStoragePath),
  createExpressApp,
  log: console.log
};

export async function start(
  overrides: Partial<StartDependencies> = {}
): Promise<{ server: Server; pool: pg.Pool }> {
  const dependencies = { ...defaultStartDependencies, ...overrides };
  const config = dependencies.loadRuntimeConfig();
  const pool = dependencies.createPool(config.databaseUrl);

  try {
    const db = dependencies.createDb(pool);
    const repositories = dependencies.createRepositories(db);
    const attachmentObjectStore = dependencies.createAttachmentObjectStore(config);

    await attachmentObjectStore.initialize();

    const staticAssets = config.serveStaticAssets
      ? { directory: config.staticAssetsPath }
      : undefined;
    const app = dependencies.createExpressApp({
      repositories,
      db,
      healthCheckPool: pool,
      attachmentObjectStore,
      corsOrigin: config.corsOrigin,
      staticAssets
    });
    const server = await listen(app, config.apiPort);
    logStartup(config, dependencies.log);
    return { server, pool };
  } catch (error) {
    await pool.end();
    throw error;
  }
}

export async function run(): Promise<void> {
  try {
    await start();
  } catch (error) {
    if (error instanceof RuntimeConfigError) {
      console.error(formatRuntimeConfigError(error));
    } else if (error instanceof AttachmentObjectStoreError && error.operation === 'initialize') {
      console.error(
        'Worktrail attachment storage could not be initialized. Verify WORKTRAIL_ATTACHMENT_STORAGE_PATH points to a writable directory.'
      );
    } else {
      console.error(error);
    }

    process.exitCode = 1;
  }
}

function listen(app: Express, port: number): Promise<Server> {
  return new Promise((resolveServer, reject) => {
    const server = app.listen(port, () => {
      server.off('error', reject);
      resolveServer(server);
    });
    server.once('error', reject);
  });
}

function logStartup(config: RuntimeConfig, log: (message: string) => void): void {
  const baseUrl = `http://localhost:${config.apiPort}`;

  log(`Worktrail API listening on ${baseUrl}`);
  log(`Runtime mode: ${config.nodeEnv}`);
  log(
    config.serveStaticAssets
      ? `Static assets: enabled (${config.staticAssetsPath})`
      : 'Static assets: disabled'
  );
  log(`Attachment storage: ${config.attachmentStorageDriver} (${config.attachmentStoragePath})`);
  log(`Liveness: ${baseUrl}/api/health/live`);
  log(`Readiness: ${baseUrl}/api/health/ready`);
}

function isDirectExecution(): boolean {
  return (
    process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  );
}

if (isDirectExecution()) {
  void run();
}
