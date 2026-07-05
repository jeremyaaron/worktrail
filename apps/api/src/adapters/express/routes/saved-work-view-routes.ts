import type { Express } from 'express';

import {
  createSavedWorkViewHandler,
  deleteSavedWorkViewHandler,
  listSavedWorkViewsHandler,
  updateSavedWorkViewHandler
} from '../../../endpoints/saved-work-views.js';
import { adaptEndpoint } from '../handler-adapter.js';
import { adapterOptions, type ExpressRouteContext } from './context.js';

export function registerSavedWorkViewRoutes(app: Express, context: ExpressRouteContext): void {
  const options = adapterOptions(context);

  app.get(
    '/api/saved-work-views',
    adaptEndpoint(listSavedWorkViewsHandler({ repositories: context.repositories }), options)
  );
  app.post(
    '/api/saved-work-views',
    adaptEndpoint(createSavedWorkViewHandler({ repositories: context.repositories }), options)
  );
  app.patch(
    '/api/saved-work-views/:savedViewId',
    adaptEndpoint(updateSavedWorkViewHandler({ repositories: context.repositories }), options)
  );
  app.delete(
    '/api/saved-work-views/:savedViewId',
    adaptEndpoint(deleteSavedWorkViewHandler({ repositories: context.repositories }), options)
  );
}
