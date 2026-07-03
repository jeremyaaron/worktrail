import 'dotenv/config';

import { createExpressApp } from './adapters/express/server.js';
import { createDb, createPool } from './db/client.js';
import { createRepositories } from './repositories/index.js';

const port = Number.parseInt(process.env.API_PORT ?? '3000', 10);
const pool = createPool();
const db = createDb(pool);
const app = createExpressApp({ repositories: createRepositories(db), db });

app.listen(port, () => {
  console.log(`Worktrail API listening on http://localhost:${port}`);
});
