export interface HealthResponse {
  status: 'ok';
  service: 'worktrail-api';
}

export function healthResponse(): HealthResponse {
  return {
    status: 'ok',
    service: 'worktrail-api'
  };
}
