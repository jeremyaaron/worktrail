import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';

import { assertOwnedDatabase } from './ownership.mjs';
import { readBrowserContext } from './browser-context.mjs';

const context = await readBrowserContext(process.env.WORKTRAIL_VERIFY_STAGE);
await assertOwnedDatabase();
const require = createRequire(import.meta.url);
const express = require('express');
const directory = context.kind === 'preview' ? 'dist' : 'src';
const suffix = context.kind === 'preview' ? 'js' : 'ts';
const { start } = await import(pathToFileURL(join(context.checkout, `apps/api/${directory}/main.${suffix}`)).href);
const { createExpressApp } = await import(pathToFileURL(join(context.checkout, `apps/api/${directory}/adapters/express/server.${suffix}`)).href);
// Recheck after runtime imports load dotenv, before the application can open its configured pool.
await assertOwnedDatabase();
const { server, pool } = await start({ createExpressApp: (options) => {
  const app = express();
  app.get('/__worktrail_verification', (_request, response) => response.json({ runId: context.runId, token: context.token }));
  app.use(createExpressApp(options));
  return app;
} });
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => {
  server.close(async () => { await pool.end(); process.exit(0); });
  server.closeIdleConnections();
});
