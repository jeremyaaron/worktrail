import cors from 'cors';
import express, { type Express } from 'express';

import type { EndpointHandler } from '../../http/app-request.js';
import { healthHandler } from '../../endpoints/health.js';
import { adaptEndpoint } from './handler-adapter.js';
import { requestLogger } from './request-logging.js';

export interface CreateExpressAppOptions {
  testRoutes?: Record<string, EndpointHandler>;
}

export function createExpressApp(options: CreateExpressAppOptions = {}): Express {
  const app = express();

  app.use(
    cors({
      origin: process.env.CORS_ORIGIN ?? 'http://localhost:4200'
    })
  );
  app.use(express.json());
  app.use(requestLogger);

  app.get('/api/health', adaptEndpoint(healthHandler));

  for (const [path, handler] of Object.entries(options.testRoutes ?? {})) {
    app.all(path, adaptEndpoint(handler));
  }

  return app;
}
