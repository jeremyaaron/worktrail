import type { PortfolioDto } from '@worktrail/contracts';

import type { EndpointHandler } from '../http/app-request.js';
import type { Repositories } from '../repositories/index.js';
import { PortfolioService } from '../services/portfolio-service.js';

export function getPortfolioHandler(repositories: Repositories): EndpointHandler<PortfolioDto> {
  return async (request) => {
    const service = new PortfolioService({
      actor: request.actor,
      repositories
    });

    return {
      status: 200,
      body: await service.getPortfolio()
    };
  };
}
