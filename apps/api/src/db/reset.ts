import 'dotenv/config';

import { createPool, getDatabaseUrl } from './client.js';

function assertLocalDatabase(url: string): void {
  const parsed = new URL(url);
  const host = parsed.hostname.toLowerCase();
  const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '::1';

  if (!isLocal && process.env.WORKTRAIL_ALLOW_DATABASE_RESET !== 'true') {
    throw new Error(
      `Refusing to reset non-local database host "${parsed.hostname}". Set WORKTRAIL_ALLOW_DATABASE_RESET=true to override.`
    );
  }
}

const databaseUrl = getDatabaseUrl();
assertLocalDatabase(databaseUrl);

const pool = createPool(databaseUrl);

try {
  await pool.query('drop schema if exists public cascade');
  await pool.query('create schema public');
  await pool.query('grant all on schema public to public');
  console.log('Database schema reset.');
} finally {
  await pool.end();
}
