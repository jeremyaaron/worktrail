import type { Express } from 'express';

import { healthHandler, livenessHandler, readinessHandler } from '../../../endpoints/health.js';
import { HealthCheckService, type HealthCheckPool } from '../../../services/health-check-service.js';
import { adaptEndpoint } from '../handler-adapter.js';

export interface HealthRouteContext {
  healthCheckPool?: HealthCheckPool;
}

export function registerHealthRoutes(app: Express, context: HealthRouteContext): void {
  app.get('/api/health', adaptEndpoint(healthHandler));
  app.get('/api/health/live', adaptEndpoint(livenessHandler));

  if (context.healthCheckPool !== undefined) {
    app.get(
      '/api/health/ready',
      adaptEndpoint(readinessHandler({ healthChecks: new HealthCheckService(context.healthCheckPool) }))
    );
  }
}
