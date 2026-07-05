import type { Express } from 'express';

import { getMyWorkDashboardHandler } from '../../../endpoints/my-work.js';
import {
  getWorkspaceCapabilitiesHandler,
  getWorkspaceHandler,
  listWorkspaceActivityHandler,
  updateWorkspaceHandler
} from '../../../endpoints/workspace.js';
import { adaptEndpoint } from '../handler-adapter.js';
import { adapterOptions, type ExpressRouteContext } from './context.js';

export function registerWorkspaceRoutes(app: Express, context: ExpressRouteContext): void {
  const options = adapterOptions(context);

  app.get('/api/workspace', adaptEndpoint(getWorkspaceHandler(context.repositories), options));
  app.patch('/api/workspace', adaptEndpoint(updateWorkspaceHandler(context.repositories), options));
  app.get(
    '/api/workspace/capabilities',
    adaptEndpoint(getWorkspaceCapabilitiesHandler(context.repositories), options)
  );
  app.get(
    '/api/workspace/activity',
    adaptEndpoint(listWorkspaceActivityHandler(context.repositories), options)
  );
  app.get(
    '/api/my-work',
    adaptEndpoint(getMyWorkDashboardHandler({ repositories: context.repositories }), options)
  );
}
