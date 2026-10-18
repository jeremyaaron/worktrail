import type { CreateWorkItemRequest } from '@worktrail/contracts';
import type { ActorContext } from '../domain/actor.js';
import type { Repositories } from '../repositories/index.js';
import type { Persistence } from '../repositories/persistence.js';

export interface WorkItemServiceContext {
  actor: ActorContext;
  repositories: Repositories;
  persistence: Persistence;
  clock?: () => Date;
  idGenerator?: () => string;
}

export interface WorkItemCreationInput extends CreateWorkItemRequest {
  reporterId?: string;
}
