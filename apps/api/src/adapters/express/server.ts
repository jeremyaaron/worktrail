import cors from 'cors';
import express, { type Express } from 'express';
import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

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
import { healthHandler, livenessHandler, readinessHandler } from '../../endpoints/health.js';
import {
  archiveLabelHandler,
  createLabelHandler,
  listProjectLabelsHandler,
  reactivateLabelHandler,
  updateLabelHandler
} from '../../endpoints/labels.js';
import {
  createMemberHandler,
  deactivateMemberHandler,
  listMembersHandler,
  reactivateMemberHandler,
  updateMemberHandler
} from '../../endpoints/members.js';
import {
  archiveMilestoneHandler,
  createMilestoneHandler,
  listProjectMilestonesHandler,
  reactivateMilestoneHandler,
  updateMilestoneHandler
} from '../../endpoints/milestones.js';
import { getMyWorkDashboardHandler } from '../../endpoints/my-work.js';
import { getProjectPlanningSummaryHandler } from '../../endpoints/planning.js';
import {
  archiveProjectHandler,
  createProjectHandler,
  getProjectHandler,
  getProjectSummaryHandler,
  listProjectNavigationSummariesHandler,
  listProjectsHandler,
  reactivateProjectHandler,
  updateProjectHandler
} from '../../endpoints/projects.js';
import {
  createSavedWorkViewHandler,
  deleteSavedWorkViewHandler,
  listSavedWorkViewsHandler,
  updateSavedWorkViewHandler
} from '../../endpoints/saved-work-views.js';
import {
  applyWorkItemCsvImportHandler,
  createWorkItemHandler,
  getWorkItemHandler,
  listWorkspaceWorkItemsHandler,
  listWorkItemsHandler,
  moveWorkItemOnBoardHandler,
  previewWorkItemCsvImportHandler,
  transitionWorkItemHandler,
  updateWorkItemHandler
} from '../../endpoints/work-items.js';
import {
  getWorkspaceCapabilitiesHandler,
  getWorkspaceHandler,
  listWorkspaceActivityHandler,
  updateWorkspaceHandler
} from '../../endpoints/workspace.js';
import type { WorktrailDb } from '../../db/client.js';
import type { EndpointHandler } from '../../http/app-request.js';
import type { Repositories } from '../../repositories/index.js';
import { HealthCheckService, type HealthCheckPool } from '../../services/health-check-service.js';
import { adaptEndpoint } from './handler-adapter.js';
import { requestLogger } from './request-logging.js';

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

  app.get('/api/health', adaptEndpoint(healthHandler));
  app.get('/api/health/live', adaptEndpoint(livenessHandler));

  if (options.healthCheckPool !== undefined) {
    app.get(
      '/api/health/ready',
      adaptEndpoint(readinessHandler({ healthChecks: new HealthCheckService(options.healthCheckPool) }))
    );
  }

  if (options.repositories !== undefined) {
    const adapterOptions = { repositories: options.repositories };

    app.get('/api/workspace', adaptEndpoint(getWorkspaceHandler(options.repositories), adapterOptions));
    app.patch('/api/workspace', adaptEndpoint(updateWorkspaceHandler(options.repositories), adapterOptions));
    app.get(
      '/api/workspace/capabilities',
      adaptEndpoint(getWorkspaceCapabilitiesHandler(options.repositories), adapterOptions)
    );
    app.get(
      '/api/workspace/activity',
      adaptEndpoint(listWorkspaceActivityHandler(options.repositories), adapterOptions)
    );
    app.get('/api/members', adaptEndpoint(listMembersHandler(options.repositories), adapterOptions));
    app.post(
      '/api/members',
      adaptEndpoint(
        createMemberHandler({ repositories: options.repositories, db: options.db }),
        adapterOptions
      )
    );
    app.patch(
      '/api/members/:memberId',
      adaptEndpoint(
        updateMemberHandler({ repositories: options.repositories, db: options.db }),
        adapterOptions
      )
    );
    app.post(
      '/api/members/:memberId/deactivate',
      adaptEndpoint(
        deactivateMemberHandler({ repositories: options.repositories, db: options.db }),
        adapterOptions
      )
    );
    app.post(
      '/api/members/:memberId/reactivate',
      adaptEndpoint(
        reactivateMemberHandler({ repositories: options.repositories, db: options.db }),
        adapterOptions
      )
    );
    app.get('/api/projects', adaptEndpoint(listProjectsHandler(options.repositories), adapterOptions));
    app.get(
      '/api/projects/navigation-summary',
      adaptEndpoint(listProjectNavigationSummariesHandler(options.repositories), adapterOptions)
    );
    app.get(
      '/api/my-work',
      adaptEndpoint(getMyWorkDashboardHandler({ repositories: options.repositories }), adapterOptions)
    );
    app.get(
      '/api/saved-work-views',
      adaptEndpoint(listSavedWorkViewsHandler({ repositories: options.repositories }), adapterOptions)
    );
    app.post(
      '/api/saved-work-views',
      adaptEndpoint(createSavedWorkViewHandler({ repositories: options.repositories }), adapterOptions)
    );
    app.patch(
      '/api/saved-work-views/:savedViewId',
      adaptEndpoint(updateSavedWorkViewHandler({ repositories: options.repositories }), adapterOptions)
    );
    app.delete(
      '/api/saved-work-views/:savedViewId',
      adaptEndpoint(deleteSavedWorkViewHandler({ repositories: options.repositories }), adapterOptions)
    );
    app.get(
      '/api/work-items',
      adaptEndpoint(
        listWorkspaceWorkItemsHandler({ repositories: options.repositories, db: options.db }),
        adapterOptions
      )
    );
    app.post(
      '/api/projects',
      adaptEndpoint(
        createProjectHandler({ repositories: options.repositories, db: options.db }),
        adapterOptions
      )
    );
    app.get(
      '/api/projects/:projectId/work-items',
      adaptEndpoint(
        listWorkItemsHandler({ repositories: options.repositories, db: options.db }),
        adapterOptions
      )
    );
    app.post(
      '/api/projects/:projectId/work-items/imports/preview',
      adaptEndpoint(
        previewWorkItemCsvImportHandler({ repositories: options.repositories, db: options.db }),
        adapterOptions
      )
    );
    app.post(
      '/api/projects/:projectId/work-items/imports',
      adaptEndpoint(
        applyWorkItemCsvImportHandler({ repositories: options.repositories, db: options.db }),
        adapterOptions
      )
    );
    app.post(
      '/api/projects/:projectId/work-items',
      adaptEndpoint(
        createWorkItemHandler({ repositories: options.repositories, db: options.db }),
        adapterOptions
      )
    );
    app.get(
      '/api/projects/:projectId/summary',
      adaptEndpoint(getProjectSummaryHandler(options.repositories), adapterOptions)
    );
    app.get(
      '/api/projects/:projectId/planning-summary',
      adaptEndpoint(
        getProjectPlanningSummaryHandler({ repositories: options.repositories }),
        adapterOptions
      )
    );
    app.get(
      '/api/projects/:projectId/activity',
      adaptEndpoint(listProjectActivityHandler(options.repositories), adapterOptions)
    );
    app.get(
      '/api/projects/:projectId/labels',
      adaptEndpoint(
        listProjectLabelsHandler({ repositories: options.repositories, db: options.db }),
        adapterOptions
      )
    );
    app.post(
      '/api/projects/:projectId/labels',
      adaptEndpoint(
        createLabelHandler({ repositories: options.repositories, db: options.db }),
        adapterOptions
      )
    );
    app.get(
      '/api/projects/:projectId/milestones',
      adaptEndpoint(
        listProjectMilestonesHandler({ repositories: options.repositories, db: options.db }),
        adapterOptions
      )
    );
    app.post(
      '/api/projects/:projectId/milestones',
      adaptEndpoint(
        createMilestoneHandler({ repositories: options.repositories, db: options.db }),
        adapterOptions
      )
    );
    app.post(
      '/api/projects/:projectId/archive',
      adaptEndpoint(archiveProjectHandler(options.repositories), adapterOptions)
    );
    app.post(
      '/api/projects/:projectId/reactivate',
      adaptEndpoint(reactivateProjectHandler(options.repositories), adapterOptions)
    );
    app.get(
      '/api/projects/:projectId',
      adaptEndpoint(getProjectHandler(options.repositories), adapterOptions)
    );
    app.patch(
      '/api/projects/:projectId',
      adaptEndpoint(updateProjectHandler(options.repositories), adapterOptions)
    );
    app.get(
      '/api/work-items/:workItemId/comments',
      adaptEndpoint(
        listCommentsHandler({ repositories: options.repositories, db: options.db }),
        adapterOptions
      )
    );
    app.post(
      '/api/work-items/:workItemId/comments',
      adaptEndpoint(
        createCommentHandler({ repositories: options.repositories, db: options.db }),
        adapterOptions
      )
    );
    app.patch(
      '/api/comments/:commentId',
      adaptEndpoint(
        updateCommentHandler({ repositories: options.repositories, db: options.db }),
        adapterOptions
      )
    );
    app.delete(
      '/api/comments/:commentId',
      adaptEndpoint(
        deleteCommentHandler({ repositories: options.repositories, db: options.db }),
        adapterOptions
      )
    );
    app.get(
      '/api/work-items/:workItemId/activity',
      adaptEndpoint(listWorkItemActivityHandler(options.repositories), adapterOptions)
    );
    app.get(
      '/api/work-items/:workItemId',
      adaptEndpoint(
        getWorkItemHandler({ repositories: options.repositories, db: options.db }),
        adapterOptions
      )
    );
    app.patch(
      '/api/work-items/:workItemId',
      adaptEndpoint(
        updateWorkItemHandler({ repositories: options.repositories, db: options.db }),
        adapterOptions
      )
    );
    app.post(
      '/api/work-items/:workItemId/transitions',
      adaptEndpoint(
        transitionWorkItemHandler({ repositories: options.repositories, db: options.db }),
        adapterOptions
      )
    );
    app.post(
      '/api/work-items/:workItemId/board-move',
      adaptEndpoint(
        moveWorkItemOnBoardHandler({ repositories: options.repositories, db: options.db }),
        adapterOptions
      )
    );
    app.patch(
      '/api/labels/:labelId',
      adaptEndpoint(
        updateLabelHandler({ repositories: options.repositories, db: options.db }),
        adapterOptions
      )
    );
    app.patch(
      '/api/milestones/:milestoneId',
      adaptEndpoint(
        updateMilestoneHandler({ repositories: options.repositories, db: options.db }),
        adapterOptions
      )
    );
    app.post(
      '/api/labels/:labelId/archive',
      adaptEndpoint(
        archiveLabelHandler({ repositories: options.repositories, db: options.db }),
        adapterOptions
      )
    );
    app.post(
      '/api/milestones/:milestoneId/archive',
      adaptEndpoint(
        archiveMilestoneHandler({ repositories: options.repositories, db: options.db }),
        adapterOptions
      )
    );
    app.post(
      '/api/labels/:labelId/reactivate',
      adaptEndpoint(
        reactivateLabelHandler({ repositories: options.repositories, db: options.db }),
        adapterOptions
      )
    );
    app.post(
      '/api/milestones/:milestoneId/reactivate',
      adaptEndpoint(
        reactivateMilestoneHandler({ repositories: options.repositories, db: options.db }),
        adapterOptions
      )
    );
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
    if (request.method !== 'GET' || request.path === '/api' || request.path.startsWith('/api/')) {
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
