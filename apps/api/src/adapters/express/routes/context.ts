import type { Repositories } from '../../../repositories/index.js';
import type { WorktrailDb } from '../../../db/client.js';

export interface ExpressRouteContext {
  repositories: Repositories;
  db?: WorktrailDb;
}

export function adapterOptions(context: ExpressRouteContext): { repositories: Repositories } {
  return { repositories: context.repositories };
}
