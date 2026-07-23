import type { QuickFindResponseDto } from '@worktrail/contracts';

import type { EndpointHandler } from '../http/app-request.js';
import type { Repositories } from '../repositories/index.js';
import { QuickFindService } from '../services/quick-find-service.js';
import { parseQuickFindRequest } from '../validation/quick-find-query.js';

export function quickFindHandler(
  repositories: Pick<Repositories, 'quickFind'>
): EndpointHandler<QuickFindResponseDto> {
  return async (request) => {
    const input = parseQuickFindRequest(request.body);
    const service = new QuickFindService({
      actor: request.actor,
      repositories
    });

    return {
      status: 200,
      headers: {
        'Cache-Control': 'private, no-store'
      },
      body: await service.search(input)
    };
  };
}
