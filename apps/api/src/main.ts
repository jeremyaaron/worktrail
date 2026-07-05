import 'dotenv/config';

import { createExpressApp } from './adapters/express/server.js';
import {
  formatRuntimeConfigError,
  loadRuntimeConfig,
  RuntimeConfigError
} from './config/runtime-config.js';
import { createDb, createPool } from './db/client.js';
import { createRepositories } from './repositories/index.js';

try {
  const config = loadRuntimeConfig();
  const pool = createPool(config.databaseUrl);
  const db = createDb(pool);
  const staticAssets = config.serveStaticAssets
    ? { directory: config.staticAssetsPath }
    : undefined;
  const app = createExpressApp({
    repositories: createRepositories(db),
    db,
    healthCheckPool: pool,
    corsOrigin: config.corsOrigin,
    staticAssets
  });

  app.listen(config.apiPort, () => {
    const baseUrl = `http://localhost:${config.apiPort}`;

    console.log(`Worktrail API listening on ${baseUrl}`);
    console.log(`Runtime mode: ${config.nodeEnv}`);
    console.log(
      config.serveStaticAssets
        ? `Static assets: enabled (${config.staticAssetsPath})`
        : 'Static assets: disabled'
    );
    console.log(`Liveness: ${baseUrl}/api/health/live`);
    console.log(`Readiness: ${baseUrl}/api/health/ready`);
  });
} catch (error) {
  if (error instanceof RuntimeConfigError) {
    console.error(formatRuntimeConfigError(error));
  } else {
    console.error(error);
  }

  process.exit(1);
}
