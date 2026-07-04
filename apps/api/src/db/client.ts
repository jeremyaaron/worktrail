import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';

import * as schema from './schema.js';

const { Pool } = pg;

export function getDatabaseUrl(): string {
  return process.env.DATABASE_URL ?? 'postgres://worktrail:worktrail@localhost:5432/worktrail';
}

export function createPool(connectionString = getDatabaseUrl()): pg.Pool {
  return new Pool({ connectionString });
}

export function createDb(pool: pg.Pool) {
  return drizzle(pool, { schema });
}

export type WorktrailDb = ReturnType<typeof createDb>;
