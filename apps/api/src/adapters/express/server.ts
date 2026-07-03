import cors from 'cors';
import express, { type Express } from 'express';

import { healthHandler } from '../../endpoints/health.js';
import { listMembersHandler } from '../../endpoints/members.js';
import {
  createProjectHandler,
  getProjectHandler,
  getProjectSummaryHandler,
  listProjectsHandler,
  updateProjectHandler
} from '../../endpoints/projects.js';
import type { EndpointHandler } from '../../http/app-request.js';
import type { Repositories } from '../../repositories/index.js';
import { adaptEndpoint } from './handler-adapter.js';
import { requestLogger } from './request-logging.js';

export interface CreateExpressAppOptions {
  repositories?: Repositories;
  testRoutes?: Record<string, EndpointHandler>;
}

export function createExpressApp(options: CreateExpressAppOptions = {}): Express {
  const app = express();

  app.use(
    cors({
      origin: process.env.CORS_ORIGIN ?? 'http://localhost:4200'
    })
  );
  app.use(express.json());
  app.use(requestLogger);

  app.get('/api/health', adaptEndpoint(healthHandler));

  if (options.repositories !== undefined) {
    app.get('/api/members', adaptEndpoint(listMembersHandler(options.repositories)));
    app.get('/api/projects', adaptEndpoint(listProjectsHandler(options.repositories)));
    app.post('/api/projects', adaptEndpoint(createProjectHandler(options.repositories)));
    app.get(
      '/api/projects/:projectId/summary',
      adaptEndpoint(getProjectSummaryHandler(options.repositories))
    );
    app.get('/api/projects/:projectId', adaptEndpoint(getProjectHandler(options.repositories)));
    app.patch('/api/projects/:projectId', adaptEndpoint(updateProjectHandler(options.repositories)));
  }

  for (const [path, handler] of Object.entries(options.testRoutes ?? {})) {
    app.all(path, adaptEndpoint(handler));
  }

  return app;
}
