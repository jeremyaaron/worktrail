import cors from 'cors';
import express, { type Express } from 'express';
import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

import type { WorktrailDb } from '../../db/client.js';
import type { EndpointHandler } from '../../http/app-request.js';
import type { Repositories } from '../../repositories/index.js';
import type { HealthCheckPool } from '../../services/health-check-service.js';
import { adaptEndpoint } from './handler-adapter.js';
import { requestLogger } from './request-logging.js';
import { registerCycleRoutes } from './routes/cycle-routes.js';
import { registerHealthRoutes } from './routes/health-routes.js';
import { registerMemberRoutes } from './routes/member-routes.js';
import { registerNotificationRoutes } from './routes/notification-routes.js';
import { registerPlanningRoutes } from './routes/planning-routes.js';
import { registerProjectRoutes } from './routes/project-routes.js';
import { registerSavedWorkViewRoutes } from './routes/saved-work-view-routes.js';
import { registerWorkItemRoutes } from './routes/work-item-routes.js';
import { registerWorkspaceRoutes } from './routes/workspace-routes.js';

export interface CreateExpressAppOptions {
  repositories?: Repositories;
  db?: WorktrailDb;
  healthCheckPool?: HealthCheckPool;
  corsOrigin?: string | false;
  staticAssets?: StaticAssetOptions;
  testRoutes?: Record<string, EndpointHandler>;
}

export interface StaticAssetOptions {
  directory: string;
  indexFile?: string;
}

export function createExpressApp(options: CreateExpressAppOptions = {}): Express {
  const app = express();

  app.use(
    cors({
      origin: options.corsOrigin ?? 'http://localhost:4200'
    })
  );
  app.use(express.json());
  app.use(requestLogger);

  registerHealthRoutes(app, { healthCheckPool: options.healthCheckPool });

  if (options.repositories !== undefined) {
    const routeContext = { repositories: options.repositories, db: options.db };

    registerWorkspaceRoutes(app, routeContext);
    registerMemberRoutes(app, routeContext);
    registerProjectRoutes(app, routeContext);
    registerCycleRoutes(app, routeContext);
    registerPlanningRoutes(app, routeContext);
    registerSavedWorkViewRoutes(app, routeContext);
    registerNotificationRoutes(app, routeContext);
    registerWorkItemRoutes(app, routeContext);
  }

  for (const [path, handler] of Object.entries(options.testRoutes ?? {})) {
    app.all(path, adaptEndpoint(handler, { repositories: options.repositories }));
  }

  if (options.staticAssets !== undefined) {
    configureStaticAssets(app, options.staticAssets);
  }

  return app;
}

function configureStaticAssets(app: Express, options: StaticAssetOptions): void {
  const indexFile = options.indexFile ?? 'index.html';
  const indexPath = join(options.directory, indexFile);

  assertStaticAssetPath(options.directory, 'Static assets directory', 'directory');
  assertStaticAssetPath(indexPath, 'Static assets index file', 'file');

  app.use(
    express.static(options.directory, {
      index: false
    })
  );

  app.use((request, response, next) => {
    if (
      (request.method !== 'GET' && request.method !== 'HEAD') ||
      request.path === '/api' ||
      request.path.startsWith('/api/')
    ) {
      next();
      return;
    }

    response.sendFile(indexPath, (error) => {
      if (error !== undefined) {
        next(error);
      }
    });
  });
}

function assertStaticAssetPath(path: string, label: string, expectedType: 'directory' | 'file'): void {
  if (!existsSync(path)) {
    throw new Error(`${label} does not exist: ${path}`);
  }

  const stats = statSync(path);

  if (expectedType === 'directory' && !stats.isDirectory()) {
    throw new Error(`${label} is not a directory: ${path}`);
  }

  if (expectedType === 'file' && !stats.isFile()) {
    throw new Error(`${label} is not a file: ${path}`);
  }
}
