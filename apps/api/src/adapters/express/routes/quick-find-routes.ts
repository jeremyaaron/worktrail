import type { Express } from 'express';

import { quickFindHandler } from '../../../endpoints/quick-find.js';
import { adaptEndpoint } from '../handler-adapter.js';
import { adapterOptions, type ExpressRouteContext } from './context.js';

export function registerQuickFindRoutes(app: Express, context: ExpressRouteContext): void {
  app.post(
    '/api/quick-find',
    adaptEndpoint(quickFindHandler(context.repositories), adapterOptions(context))
  );
}
