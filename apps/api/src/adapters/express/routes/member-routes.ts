import type { Express } from 'express';

import {
  createMemberHandler,
  deactivateMemberHandler,
  listMembersHandler,
  reactivateMemberHandler,
  updateMemberHandler
} from '../../../endpoints/members.js';
import { adaptEndpoint } from '../handler-adapter.js';
import { adapterOptions, type ExpressRouteContext } from './context.js';

export function registerMemberRoutes(app: Express, context: ExpressRouteContext): void {
  const options = adapterOptions(context);

  app.get('/api/members', adaptEndpoint(listMembersHandler(context.repositories), options));
  app.post(
    '/api/members',
    adaptEndpoint(createMemberHandler({ repositories: context.repositories, db: context.db }), options)
  );
  app.patch(
    '/api/members/:memberId',
    adaptEndpoint(updateMemberHandler({ repositories: context.repositories, db: context.db }), options)
  );
  app.post(
    '/api/members/:memberId/deactivate',
    adaptEndpoint(deactivateMemberHandler({ repositories: context.repositories, db: context.db }), options)
  );
  app.post(
    '/api/members/:memberId/reactivate',
    adaptEndpoint(reactivateMemberHandler({ repositories: context.repositories, db: context.db }), options)
  );
}
