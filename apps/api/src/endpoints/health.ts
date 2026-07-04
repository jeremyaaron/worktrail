import type {
  ApiHealthResponse,
  ApiReadinessFailureResponse,
  ApiReadinessResponse
} from '@worktrail/contracts';

import type { AppResponse, EndpointHandler } from '../http/app-request.js';
import type { HealthCheckService } from '../services/health-check-service.js';

export function livenessHandler(): AppResponse<ApiHealthResponse> {
  return {
    status: 200,
    body: {
      status: 'ok',
      service: 'worktrail-api',
      checkedAt: new Date().toISOString()
    }
  };
}

export function readinessHandler(input: {
  healthChecks: HealthCheckService;
}): EndpointHandler<ApiReadinessResponse | ApiReadinessFailureResponse> {
  return async () => {
    try {
      return {
        status: 200,
        body: await input.healthChecks.checkReadiness()
      };
    } catch {
      return {
        status: 503,
        body: {
          error: {
            code: 'READINESS_FAILED',
            message: 'Worktrail API is not ready.',
            checks: {
              database: 'failed'
            }
          }
        }
      };
    }
  };
}

export const healthHandler = livenessHandler;
