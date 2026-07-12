import type { Express } from 'express';

import {
  archiveProjectCycleHandler,
  createProjectCycleHandler,
  getProjectCycleCloseoutPreviewHandler,
  getProjectCycleHandler,
  getProjectCycleReviewHandler,
  listProjectCyclesHandler,
  reactivateProjectCycleHandler,
  updateProjectCycleHandler
} from '../../../endpoints/cycles.js';
import { adaptEndpoint } from '../handler-adapter.js';
import { adapterOptions, type ExpressRouteContext } from './context.js';

export function registerCycleRoutes(app: Express, context: ExpressRouteContext): void {
  const options = adapterOptions(context);

  app.get(
    '/api/projects/:projectId/cycles',
    adaptEndpoint(
      listProjectCyclesHandler({ repositories: context.repositories, db: context.db }),
      options
    )
  );
  app.post(
    '/api/projects/:projectId/cycles',
    adaptEndpoint(
      createProjectCycleHandler({ repositories: context.repositories, db: context.db }),
      options
    )
  );
  app.get(
    '/api/projects/:projectId/cycles/:cycleId',
    adaptEndpoint(
      getProjectCycleHandler({ repositories: context.repositories, db: context.db }),
      options
    )
  );
  app.patch(
    '/api/projects/:projectId/cycles/:cycleId',
    adaptEndpoint(
      updateProjectCycleHandler({ repositories: context.repositories, db: context.db }),
      options
    )
  );
  app.post(
    '/api/projects/:projectId/cycles/:cycleId/archive',
    adaptEndpoint(
      archiveProjectCycleHandler({ repositories: context.repositories, db: context.db }),
      options
    )
  );
  app.post(
    '/api/projects/:projectId/cycles/:cycleId/reactivate',
    adaptEndpoint(
      reactivateProjectCycleHandler({ repositories: context.repositories, db: context.db }),
      options
    )
  );
  app.get(
    '/api/projects/:projectId/cycles/:cycleId/closeout-preview',
    adaptEndpoint(
      getProjectCycleCloseoutPreviewHandler({
        repositories: context.repositories,
        db: context.db
      }),
      options
    )
  );
  app.get(
    '/api/projects/:projectId/cycles/:cycleId/review',
    adaptEndpoint(
      getProjectCycleReviewHandler({ repositories: context.repositories, db: context.db }),
      options
    )
  );
}
