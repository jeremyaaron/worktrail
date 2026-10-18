import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstat, readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { assertOwnedDatabase, childEnvironment, createVerificationPool } from './ownership.mjs';

export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

export async function fileInventory(root, prefix = '') {
  assert.ok((await lstat(root)).isDirectory(), 'Inventory requires a real directory, not a link.');
  const files = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = join(root, entry.name), relative = join(prefix, entry.name);
    if (entry.isDirectory()) files.push(...await fileInventory(path, relative));
    else {
      assert.ok(entry.isFile(), 'Inventory refuses links and other non-file entries.');
      const bytes = await readFile(path);
      files.push({ path: relative, bytes: bytes.length, sha256: sha256(bytes) });
    }
  }
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

export async function captureApplicationState(manifest) {
  const env = childEnvironment(manifest);
  await assertOwnedDatabase(env);
  const pool = createVerificationPool(manifest.databaseUrl);
  let client;
  try {
    client = await pool.connect();
    await client.query('begin isolation level repeatable read read only');
    const tables = (await client.query("select tablename from pg_tables where schemaname = 'public' order by tablename")).rows;
    const data = {};
    for (const { tablename } of tables) {
      const name = `"${tablename.replaceAll('"', '""')}"`;
      data[tablename] = (await client.query(`select to_jsonb(r) as record from public.${name} r order by to_jsonb(r)::text`)).rows.map(row => row.record);
    }
    const schema = {
      tables: tables.map(row => row.tablename),
      columns: (await client.query(`select table_name, column_name, ordinal_position, data_type, udt_schema,
        udt_name, is_nullable, column_default, collation_name, is_generated, generation_expression
        from information_schema.columns where table_schema = 'public' order by table_name, ordinal_position`)).rows,
      indexes: (await client.query("select tablename,indexname,indexdef from pg_indexes where schemaname='public' order by tablename,indexname")).rows,
      constraints: (await client.query(`select c.relname, con.conname, con.contype, con.convalidated,
        con.condeferrable, con.condeferred, pg_get_constraintdef(con.oid) as definition
        from pg_constraint con join pg_class c on c.oid=con.conrelid join pg_namespace n on n.oid=c.relnamespace
        where n.nspname='public' order by c.relname,con.conname`)).rows,
      extensions: (await client.query(`select e.extname, e.extversion, n.nspname as schema
        from pg_extension e join pg_namespace n on n.oid=e.extnamespace order by e.extname`)).rows
    };
    const ledger = (await client.query('select * from drizzle.__drizzle_migrations order by id')).rows;
    await client.query('commit');
    const storage = await fileInventory(manifest.storageRoot);
    assertAttachmentReferences(data.work_item_attachments ?? [], storage);
    return { data, schema, ledger, storage };
  } finally { client?.release(); await pool.end(); }
}

export function assertAttachmentReferences(attachments, files) {
  for (const attachment of attachments) {
    assert.match(attachment.storage_key, /^[a-f0-9]{64}$/, 'Unsafe attachment object key.');
    const path = join('objects', attachment.storage_key.slice(0, 2), attachment.storage_key);
    const object = files.find(file => file.path === path);
    assert.ok(object, 'Referenced attachment bytes are missing.');
    assert.equal(object.bytes, attachment.byte_size, 'Attachment size differs from its record.');
    assert.equal(object.sha256, attachment.checksum_sha256, 'Attachment checksum differs from its record.');
  }
}

export function assertPopulatedBaseline(state) {
  for (const table of ['workspaces', 'members', 'projects', 'project_cycles', 'work_items', 'work_item_labels',
    'work_item_relationships', 'saved_work_views', 'comments', 'comment_mentions',
    'project_cycle_closeouts', 'project_status_reports', 'work_item_attachments']) {
    assert.ok(state.data[table]?.length > 0, `Preservation fixture must populate ${table}.`);
  }
  assert.ok(state.data.saved_work_views.some(row => row.is_pinned), 'Preservation fixture needs a pinned saved view.');
  for (const [table, field] of [['work_items', 'description_format'], ['comments', 'body_format']]) {
    for (const format of ['plain_text', 'markdown_v1']) {
      assert.ok(state.data[table].some(row => row[field] === format), `Preservation fixture needs ${table}.${field}=${format}.`);
    }
  }
  assert.ok(state.schema.extensions.some(row => row.extname === 'pg_trgm'), 'Required search extension is missing.');
}

export function assertPreserved(before, after) {
  assert.deepEqual(after.data, before.data, 'Application rows or stored historical JSON changed.');
  assert.deepEqual(after.schema, before.schema, 'Application schema or extensions changed.');
  assert.deepEqual(after.storage, before.storage, 'Attachment bytes or storage inventory changed.');
}

export function assertLedgerAdopted(before, after, migrations) {
  assert.equal(after.length, before.length, 'Migration history was replayed or truncated.');
  assert.equal(after.length, migrations.length, 'Migration history is incomplete.');
  assert.deepEqual(after.map(({ id, hash, created_at }) => ({ id, hash, created_at })),
    before.map(({ id, hash, created_at }) => ({ id, hash, created_at })), 'Original migration identities changed.');
  for (const row of after) {
    assert.equal(row.name, migrations.find(migration => migration.hash === row.hash)?.name, 'Owner ledger mapping differs from SQL history.');
    assert.equal(typeof row.name, 'string', 'Migration name is missing.');
    assert.equal(row.applied_at, null, 'Historical application time must remain unknown.');
  }
}

export function assertReapplicationNoOp(before, after) {
  assertPreserved(before, after);
  assert.deepEqual(after.ledger, before.ledger, 'Repeated migration changed the ledger.');
}

export function assertFullTestReport(report, files) {
  assert.ok(files.length > 0 && report.numTotalTests > 0, 'A full test report must not be empty.');
  assert.equal(report.numFailedTests, 0, 'Test report contains failures.');
  assert.equal(report.numPassedTests, report.numTotalTests, 'Test report contains skipped or incomplete cases.');
  assert.deepEqual(report.testResults.map(file => file.name).sort(), [...files].sort(), 'Test report file discovery differs from the source inventory.');
  let cases = 0;
  for (const file of report.testResults) {
    assert.equal(file.status, 'passed', 'Test file did not pass.');
    assert.ok(file.assertionResults.length > 0, 'Test file contains no cases.');
    for (const assertion of file.assertionResults) assert.equal(assertion.status, 'passed', 'Test case did not pass.');
    cases += file.assertionResults.length;
  }
  assert.equal(cases, report.numTotalTests, 'Test report case accounting is inconsistent.');
}

export async function convertedMigrations(checkout) {
  const root = join(checkout, 'apps/api/drizzle');
  const folders = (await readdir(root)).sort();
  return await Promise.all(folders.map(async name => {
    assert.match(name, /^\d{14}_[a-z0-9_]+$/, 'Unexpected converted migration folder.');
    return { name, hash: sha256(await readFile(join(root, name, 'migration.sql'))) };
  }));
}
