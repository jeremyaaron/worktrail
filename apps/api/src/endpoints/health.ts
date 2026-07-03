import type { AppResponse } from '../http/app-request.js';

export interface HealthResponse {
  status: 'ok';
  service: 'worktrail-api';
}

export function healthHandler(): AppResponse<HealthResponse> {
  return {
    status: 200,
    body: {
      status: 'ok',
      service: 'worktrail-api'
    }
  };
}
