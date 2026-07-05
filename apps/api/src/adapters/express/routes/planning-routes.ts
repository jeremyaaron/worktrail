import type { Express } from 'express';

import { getProjectPlanningSummaryHandler } from '../../../endpoints/planning.js';
import { adaptEndpoint } from '../handler-adapter.js';
import { adapterOptions, type ExpressRouteContext } from './context.js';

export function registerPlanningRoutes(app: Express, context: ExpressRouteContext): void {
  const options = adapterOptions(context);

  app.get(
    '/api/projects/:projectId/planning-summary',
    adaptEndpoint(getProjectPlanningSummaryHandler({ repositories: context.repositories }), options)
  );
}
