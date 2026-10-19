import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

import { assertOwnedDatabase } from './ownership.mjs';
import { sha256 } from './upgrade.mjs';

// This child runs only after preservation capture and comparison. Its writes are intentional
// runtime acceptance, not part of (or a way to repair) the preserved baseline.
const manifest = await assertOwnedDatabase();
const checkout = fileURLToPath(new URL('../../', import.meta.url));
assert.equal(checkout, `${join(manifest.root, 'checkout')}/`);
assert.equal(process.env.API_PORT, String(manifest.ports.api));
assert.equal(process.env.NODE_ENV, 'production');
assert.equal(process.env.WORKTRAIL_SERVE_STATIC, 'false');
const baseline = JSON.parse(await readFile(join(manifest.resultsRoot, 'before.json')));
const { start } = await import(pathToFileURL(join(checkout, 'apps/api/dist/main.js')));
await assertOwnedDatabase();
const controller = new AbortController();
const abort = () => controller.abort();
process.on('SIGINT', abort);
process.on('SIGTERM', abort);
let runtime;
const checks = [];
try {
  controller.signal.throwIfAborted();
  runtime = await start();
  controller.signal.throwIfAborted();
  assert.equal(runtime.server.address().port, manifest.ports.api);
  const base = `http://127.0.0.1:${manifest.ports.api}`;
  const owner = baseline.data.members.find(row => row.role === 'owner' && row.is_active);
  assert.ok(owner);
  const headers = { 'x-worktrail-workspace-id': owner.workspace_id, 'x-worktrail-member-id': owner.id };
  async function request(path, status = 200, init = {}) {
    const response = await fetch(`${base}/api${path}`, {
      ...init, headers: { ...headers, ...init.headers },
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)])
    });
    assert.equal(response.status, status, `Compiled API failed ${init.method ?? 'GET'} ${path}.`);
    checks.push({ method: init.method ?? 'GET', path, status });
    return response;
  }
  await (await request('/health/ready')).json();
  const project = baseline.data.projects.find(row => row.workspace_id === owner.workspace_id && row.status === 'active');
  assert.ok(project);
  const original = baseline.data.work_items.find(row => row.project_id === project.id);
  assert.ok(original);
  const detail = await (await request(`/work-items/${original.id}`)).json();
  assert.equal(detail.description, original.description);
  assert.equal(detail.descriptionFormat, original.description_format);
  const views = await (await request('/saved-work-views')).json();
  assert.ok(views.length > 0);
  for (const attachment of baseline.data.work_item_attachments) {
    const bytes = new Uint8Array(await (await request(`/attachments/${attachment.id}/content`)).arrayBuffer());
    assert.equal(bytes.length, attachment.byte_size);
    assert.equal(sha256(bytes), attachment.checksum_sha256);
  }
  for (const report of baseline.data.project_status_reports) {
    const result = await (await request(`/projects/${report.project_id}/status-reports/${report.id}`)).json();
    assert.deepEqual(result.snapshot, report.snapshot);
  }
  for (const closeout of baseline.data.project_cycle_closeouts) {
    const result = await (await request(`/projects/${closeout.project_id}/cycles/${closeout.cycle_id}/review`)).json();
    assert.deepEqual(result.closeout.snapshot, closeout.snapshot);
  }
  const title = 'Compiled upgrade acceptance';
  const created = await (await request(`/projects/${project.id}/work-items`, 201, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title, type: 'task', priority: 'medium', description: '# Preserved source\n', descriptionFormat: 'markdown_v1' })
  })).json();
  assert.equal(created.title, title);
  const changed = await (await request(`/work-items/${created.id}`, 200, {
    method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: `${title} updated` })
  })).json();
  assert.equal(changed.title, `${title} updated`);
  const read = await (await request(`/work-items/${created.id}`)).json();
  assert.equal(read.title, changed.title);
  assert.equal(read.description, '# Preserved source\n');
  const comment = await (await request(`/work-items/${created.id}/comments`, 201, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ body: '**Compiled comment**', bodyFormat: 'markdown_v1' })
  })).json();
  assert.equal(comment.body, '**Compiled comment**');
  const comments = await (await request(`/work-items/${created.id}/comments`)).json();
  assert.ok(comments.some(row => row.id === comment.id && row.bodyFormat === 'markdown_v1'));
  const csv = await (await request(`/projects/${project.id}/work-items/export`)).text();
  assert.ok(csv.includes(`${title} updated`));
  await writeFile(join(manifest.resultsRoot, 'compiled-runtime.json'), JSON.stringify({ passed: true, checks }, null, 2) + '\n');
} finally {
  if (runtime) {
    await new Promise((resolve, reject) => {
      runtime.server.close(error => error ? reject(error) : resolve());
      runtime.server.closeIdleConnections();
    });
    await runtime.pool.end();
  }
  process.removeListener('SIGINT', abort);
  process.removeListener('SIGTERM', abort);
}
