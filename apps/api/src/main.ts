import 'dotenv/config';

import { createExpressApp } from './adapters/express/server.js';

const port = Number.parseInt(process.env.API_PORT ?? '3000', 10);
const app = createExpressApp();

app.listen(port, () => {
  console.log(`Worktrail API listening on http://localhost:${port}`);
});
