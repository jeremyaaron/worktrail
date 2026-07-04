import cors from 'cors';
import express, { type Express } from 'express';

import {
  listProjectActivityHandler,
  listWorkItemActivityHandler
} from '../../endpoints/activity.js';
import {
  createCommentHandler,
  deleteCommentHandler,
  listCommentsHandler,
  updateCommentHandler
} from '../../endpoints/comments.js';
import { healthHandler } from '../../endpoints/health.js';
import {
  archiveLabelHandler,
  createLabelHandler,
  listProjectLabelsHandler,
  reactivateLabelHandler,
  updateLabelHandler
} from '../../endpoints/labels.js';
import { listMembersHandler } from '../../endpoints/members.js';
import {
  archiveProjectHandler,
  createProjectHandler,
  getProjectHandler,
  getProjectSummaryHandler,
  listProjectsHandler,
  reactivateProjectHandler,
  updateProjectHandler
} from '../../endpoints/projects.js';
import {
  createWorkItemHandler,
  getWorkItemHandler,
  listWorkItemsHandler,
  transitionWorkItemHandler,
  updateWorkItemHandler
} from '../../endpoints/work-items.js';
import type { WorktrailDb } from '../../db/client.js';
import type { EndpointHandler } from '../../http/app-request.js';
import type { Repositories } from '../../repositories/index.js';
import { adaptEndpoint } from './handler-adapter.js';
import { requestLogger } from './request-logging.js';

export interface CreateExpressAppOptions {
  repositories?: Repositories;
  db?: WorktrailDb;
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
      '/api/projects/:projectId/work-items',
      adaptEndpoint(listWorkItemsHandler({ repositories: options.repositories, db: options.db }))
    );
    app.post(
      '/api/projects/:projectId/work-items',
      adaptEndpoint(createWorkItemHandler({ repositories: options.repositories, db: options.db }))
    );
    app.get(
      '/api/projects/:projectId/summary',
      adaptEndpoint(getProjectSummaryHandler(options.repositories))
    );
    app.get(
      '/api/projects/:projectId/activity',
      adaptEndpoint(listProjectActivityHandler(options.repositories))
    );
    app.get(
      '/api/projects/:projectId/labels',
      adaptEndpoint(listProjectLabelsHandler({ repositories: options.repositories, db: options.db }))
    );
    app.post(
      '/api/projects/:projectId/labels',
      adaptEndpoint(createLabelHandler({ repositories: options.repositories, db: options.db }))
    );
    app.post(
      '/api/projects/:projectId/archive',
      adaptEndpoint(archiveProjectHandler(options.repositories))
    );
    app.post(
      '/api/projects/:projectId/reactivate',
      adaptEndpoint(reactivateProjectHandler(options.repositories))
    );
    app.get('/api/projects/:projectId', adaptEndpoint(getProjectHandler(options.repositories)));
    app.patch('/api/projects/:projectId', adaptEndpoint(updateProjectHandler(options.repositories)));
    app.get(
      '/api/work-items/:workItemId/comments',
      adaptEndpoint(listCommentsHandler({ repositories: options.repositories, db: options.db }))
    );
    app.post(
      '/api/work-items/:workItemId/comments',
      adaptEndpoint(createCommentHandler({ repositories: options.repositories, db: options.db }))
    );
    app.patch(
      '/api/comments/:commentId',
      adaptEndpoint(updateCommentHandler({ repositories: options.repositories, db: options.db }))
    );
    app.delete(
      '/api/comments/:commentId',
      adaptEndpoint(deleteCommentHandler({ repositories: options.repositories, db: options.db }))
    );
    app.get(
      '/api/work-items/:workItemId/activity',
      adaptEndpoint(listWorkItemActivityHandler(options.repositories))
    );
    app.get(
      '/api/work-items/:workItemId',
      adaptEndpoint(getWorkItemHandler({ repositories: options.repositories, db: options.db }))
    );
    app.patch(
      '/api/work-items/:workItemId',
      adaptEndpoint(updateWorkItemHandler({ repositories: options.repositories, db: options.db }))
    );
    app.post(
      '/api/work-items/:workItemId/transitions',
      adaptEndpoint(transitionWorkItemHandler({ repositories: options.repositories, db: options.db }))
    );
    app.patch(
      '/api/labels/:labelId',
      adaptEndpoint(updateLabelHandler({ repositories: options.repositories, db: options.db }))
    );
    app.post(
      '/api/labels/:labelId/archive',
      adaptEndpoint(archiveLabelHandler({ repositories: options.repositories, db: options.db }))
    );
    app.post(
      '/api/labels/:labelId/reactivate',
      adaptEndpoint(reactivateLabelHandler({ repositories: options.repositories, db: options.db }))
    );
  }

  for (const [path, handler] of Object.entries(options.testRoutes ?? {})) {
    app.all(path, adaptEndpoint(handler));
  }

  return app;
}
