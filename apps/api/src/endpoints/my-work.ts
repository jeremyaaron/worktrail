import type { MyWorkDashboardDto } from '@worktrail/contracts';

import type { Persistence } from '../repositories/persistence.js';
import type { EndpointHandler } from '../http/app-request.js';
import type { Repositories } from '../repositories/index.js';
import { MyWorkService } from '../services/my-work-service.js';

export interface MyWorkHandlerOptions {
  repositories: Repositories;
  persistence: Persistence;
  clock?: () => Date;
}

export function getMyWorkDashboardHandler(
  options: MyWorkHandlerOptions
): EndpointHandler<MyWorkDashboardDto> {
  return async (request) => {
    const service = new MyWorkService({
      persistence: options.persistence,
      actor: request.actor,
      repositories: options.repositories,
      clock: options.clock
    });

    return {
      status: 200,
      body: await service.getDashboard()
    };
  };
}
