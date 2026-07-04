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
  await pool.query('drop schema if exists drizzle cascade');
  await pool.query(`
    do $$
    declare
      item record;
    begin
      for item in
        select schemaname, matviewname as object_name
        from pg_matviews
        where schemaname = 'public'
      loop
        execute format('drop materialized view if exists %I.%I cascade', item.schemaname, item.object_name);
      end loop;

      for item in
        select schemaname, viewname as object_name
        from pg_views
        where schemaname = 'public'
      loop
        execute format('drop view if exists %I.%I cascade', item.schemaname, item.object_name);
      end loop;

      for item in
        select schemaname, tablename as object_name
        from pg_tables
        where schemaname = 'public'
      loop
        execute format('drop table if exists %I.%I cascade', item.schemaname, item.object_name);
      end loop;

      for item in
        select n.nspname as schemaname, t.typname as object_name
        from pg_type t
        join pg_namespace n on n.oid = t.typnamespace
        where n.nspname = 'public'
          and t.typtype = 'e'
      loop
        execute format('drop type if exists %I.%I cascade', item.schemaname, item.object_name);
      end loop;
    end $$;
  `);
  console.log('Database schema reset.');
} finally {
  await pool.end();
}
