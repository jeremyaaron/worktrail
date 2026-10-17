import type { PortfolioDto } from '@worktrail/contracts';

import type { Persistence } from '../repositories/persistence.js';
import type { EndpointHandler } from '../http/app-request.js';
import type { Repositories } from '../repositories/index.js';
import { PortfolioService } from '../services/portfolio-service.js';

export function getPortfolioHandler(options: { repositories: Repositories; persistence: Persistence }): EndpointHandler<PortfolioDto> {
  const { repositories, persistence } = options;
  return async (request) => {
    const service = new PortfolioService({
      persistence,
      actor: request.actor,
      repositories
    });

    return {
      status: 200,
      body: await service.getPortfolio()
    };
  };
}
