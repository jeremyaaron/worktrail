import cors from 'cors';
import express, { type Express } from 'express';

import { healthResponse } from '../../endpoints/health.js';

export function createExpressApp(): Express {
  const app = express();

  app.use(
    cors({
      origin: process.env.CORS_ORIGIN ?? 'http://localhost:4200'
    })
  );
  app.use(express.json());

  app.get('/api/health', (_request, response) => {
    response.status(200).json(healthResponse());
  });

  return app;
}
