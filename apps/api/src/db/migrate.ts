import 'dotenv/config';

import { migrate } from 'drizzle-orm/node-postgres/migrator';

import { createDb, createPool } from './client.js';

const pool = createPool();
const db = createDb(pool);

try {
  await migrate(db, { migrationsFolder: 'drizzle' });
  console.log('Database migrations applied.');
} finally {
  await pool.end();
}
