import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { createManifest } from './ownership.mjs';
import { cleanupRun } from './resources.mjs';
import {
  assertAttachmentReferences, assertFullTestReport, assertLedgerAdopted, assertPopulatedBaseline, assertPreserved,
  assertReapplicationNoOp, captureApplicationState, fileInventory, sha256
} from './upgrade.mjs';

function fixture() {
  const data = Object.fromEntries(['workspaces', 'members', 'projects', 'project_cycles',
    'work_item_labels', 'work_item_relationships', 'comment_mentions'].map(table => [table, [{ id: table }]]));
  data.work_items = ['plain_text', 'markdown_v1'].map(description_format => ({ description_format, description: '# Literal\r\n' }));
  data.comments = ['plain_text', 'markdown_v1'].map(body_format => ({ body_format, body: '**Source**\r\n' }));
  data.saved_work_views = [{ is_pinned: true, query: { blocked: false, estimateState: 'unestimated' } }];
  data.project_cycle_closeouts = [{ snapshot: { snapshotVersion: 1, title: 'Immutable closeout' } }];
  data.project_status_reports = [{ snapshot: { snapshotVersion: 2, title: 'Immutable report' } }];
  const bytes = Buffer.from('exact bytes\r\n');
  const key = sha256(bytes);
  data.work_item_attachments = [{ storage_key: key, checksum_sha256: key, byte_size: bytes.length }];
  return { data, schema: { constraints: ['original'], indexes: ['original'], extensions: [{ extname: 'pg_trgm', extversion: '1.6' }] },
    storage: [{ path: join('objects', key.slice(0, 2), key), bytes: bytes.length, sha256: key }],
    ledger: [{ id: 1, hash: 'original-sql', created_at: '1791775775513' }] };
}

test('preservation compares all rows, authored formats, history, schema, extensions and file bytes', () => {
  const before = fixture();
  assertPopulatedBaseline(before);
  assertPreserved(before, structuredClone(before));
  for (const mutate of [
    state => { state.data.work_items[0].description = 'rewritten'; },
    state => { state.data.comments[0].body_format = 'markdown_v1'; },
    state => { state.data.project_status_reports[0].snapshot.title = 'reconstructed'; },
    state => { state.data.project_cycle_closeouts[0].snapshot.snapshotVersion = 2; },
    state => { state.data.saved_work_views[0].query.blocked = true; },
    state => { state.data.work_item_relationships = []; },
    state => { state.schema.constraints = []; },
    state => { state.schema.indexes = []; },
    state => { state.schema.extensions = []; },
    state => { state.storage[0].sha256 = 'different'; },
    state => { state.storage = []; }
  ]) {
    const after = structuredClone(before); mutate(after);
    assert.throws(() => assertPreserved(before, after), /changed/);
  }
});

test('empty or incomplete preservation fixtures cannot pass as upgrade evidence', () => {
  for (const table of Object.keys(fixture().data)) {
    const state = fixture(); state.data[table] = [];
    assert.throws(() => assertPopulatedBaseline(state), /fixture/);
  }
  const missingFormat = fixture(); missingFormat.data.comments.splice(1);
  assert.throws(() => assertPopulatedBaseline(missingFormat), /markdown_v1/);
  const unpinned = fixture(); unpinned.data.saved_work_views[0].is_pinned = false;
  assert.throws(() => assertPopulatedBaseline(unpinned), /pinned/);
});

test('ledger adoption permits only mapped names and unknown historic application times', () => {
  const before = fixture().ledger;
  const migrations = [{ name: '20261012032935_nosy_junta', hash: before[0].hash }];
  const after = [{ ...before[0], name: migrations[0].name, applied_at: null }];
  assertLedgerAdopted(before, after, migrations);
  for (const change of [
    rows => { rows.push({ ...rows[0], id: 2 }); },
    rows => { rows.pop(); },
    rows => { rows[0].id = 2; },
    rows => { rows[0].hash = 'changed-sql'; },
    rows => { rows[0].created_at = '1791775775000'; },
    rows => { rows[0].name = 'different-name'; },
    rows => { rows[0].applied_at = '2026-10-18T00:00:00Z'; }
  ]) {
    const changed = structuredClone(after); change(changed);
    assert.throws(() => assertLedgerAdopted(before, changed, migrations));
  }
});

test('reapplication requires a byte-for-value unchanged complete ledger as well as data', () => {
  const before = fixture();
  assertReapplicationNoOp(before, structuredClone(before));
  const changed = structuredClone(before); changed.ledger[0].name = 'unexpected';
  assert.throws(() => assertReapplicationNoOp(before, changed), /ledger/);
});

test('attachment references require present bytes, exact lengths/checksums and safe keys', () => {
  const { data, storage } = fixture();
  assertAttachmentReferences(data.work_item_attachments, storage);
  assert.throws(() => assertAttachmentReferences(data.work_item_attachments, []), /missing/);
  for (const [field, value] of [['byte_size', 1000], ['checksum_sha256', 'changed'], ['storage_key', '../escape']]) {
    const rows = structuredClone(data.work_item_attachments); rows[0][field] = value;
    assert.throws(() => assertAttachmentReferences(rows, storage), /Attachment|Unsafe/);
  }
});

test('file inventories include nested objects/markers and reject linked roots or entries', async () => {
  const root = await mkdtemp(join(tmpdir(), 'worktrail-upgrade-test-'));
  try {
    const store = join(root, 'store');
    await mkdir(join(store, 'objects', 'aa'), { recursive: true });
    await writeFile(join(store, '.marker'), 'marker');
    await writeFile(join(store, 'objects', 'aa', 'object'), 'bytes');
    const files = await fileInventory(store);
    assert.deepEqual(files.map(file => file.path), ['.marker', join('objects', 'aa', 'object')]);
    assert.equal(files[1].sha256, sha256('bytes'));
    await symlink(store, join(root, 'linked-store'));
    await assert.rejects(fileInventory(join(root, 'linked-store')), /real directory/);
    await symlink(join(root, 'not-owned'), join(store, 'linked-entry'));
    await assert.rejects(fileInventory(store), /non-file/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('capture refuses a target without established owned database identity', async () => {
  const manifest = await createManifest('none');
  try { await assert.rejects(captureApplicationState(manifest), /target|ownership|owned/); }
  finally { await cleanupRun(manifest); }
});

test('full test acceptance rejects empty, missing, duplicated, skipped and inconsistent reports', () => {
  const report = { numTotalTests: 1, numPassedTests: 1, numFailedTests: 0,
    testResults: [{ name: '/checkout/example.test.ts', status: 'passed', assertionResults: [{ status: 'passed' }] }] };
  const files = ['/checkout/example.test.ts'];
  assertFullTestReport(report, files);
  for (const mutate of [
    value => { value.numTotalTests = 0; },
    value => { value.numPassedTests = 0; },
    value => { value.numFailedTests = 1; },
    value => { value.testResults = []; },
    value => { value.testResults.push(structuredClone(value.testResults[0])); },
    value => { value.testResults[0].name = '/checkout/other.test.ts'; },
    value => { value.testResults[0].status = 'failed'; },
    value => { value.testResults[0].assertionResults[0].status = 'skipped'; },
    value => { value.testResults[0].assertionResults = []; },
    value => { value.testResults[0].assertionResults.push({ status: 'passed' }); }
  ]) {
    const changed = structuredClone(report); mutate(changed);
    assert.throws(() => assertFullTestReport(changed, files));
  }
});
