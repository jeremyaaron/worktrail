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
  const app = createExpressApp({ repositories: createRepositories(db), db, healthCheckPool: pool });

  app.listen(config.apiPort, () => {
    console.log(`Worktrail API listening on http://localhost:${config.apiPort}`);
  });
} catch (error) {
  if (error instanceof RuntimeConfigError) {
    console.error(formatRuntimeConfigError(error));
  } else {
    console.error(error);
  }

  process.exit(1);
}
