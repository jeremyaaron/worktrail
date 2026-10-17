import type { Repositories } from '../../../repositories/index.js';
import type { Persistence } from '../../../repositories/persistence.js';

export interface ExpressRouteContext {
  repositories: Repositories;
  persistence: Persistence;
}

export function adapterOptions(context: ExpressRouteContext): { repositories: Repositories } {
  return { repositories: context.repositories };
}
