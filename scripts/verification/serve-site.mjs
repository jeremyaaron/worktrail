import { createRequire } from 'node:module';
import { join } from 'node:path';
import { readBrowserContext } from './browser-context.mjs';

const context = await readBrowserContext('site');
const require = createRequire(new URL('../../apps/api/package.json', import.meta.url));
const express = require('express');
const app = express();
app.get('/__worktrail_verification', (_request, response) => response.json({ runId: context.runId, token: context.token }));
app.use('/worktrail', express.static(join(context.checkout, 'site'), { dotfiles: 'deny' }));
const server = app.listen(context.port, '127.0.0.1');
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => {
  server.close(() => process.exit(0));
  server.closeIdleConnections();
});
