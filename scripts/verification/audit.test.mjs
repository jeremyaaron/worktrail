import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';

import { auditFindings, collectAudit, evaluateAudits, installedDependencyRoot, parseAudit, verifyDependencyGraph } from './audit.mjs';
import { createManifest, repositoryRoot } from './ownership.mjs';
import { cleanupRun } from './resources.mjs';
import { prepareWorkspace } from './workspace.mjs';

const advisory = 'GHSA-aaaa-bbbb-cccc';
const url = `https://github.com/advisories/${advisory}`;
const lock = { lockfileVersion: 3, packages: {
  'node_modules/tool': { version: '1.0.0', dev: true },
  'node_modules/owner': { version: '2.0.0', dev: true }
} };

function report(vulnerabilities = {}) {
  const counts = { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: Object.keys(vulnerabilities).length };
  for (const row of Object.values(vulnerabilities)) counts[row.severity]++;
  return parseAudit({ code: counts.total ? 1 : 0, stdout: JSON.stringify({
    auditReportVersion: 2, vulnerabilities, metadata: { vulnerabilities: counts }
  }) });
}

function fixture() {
  const full = report({
    tool: { name: 'tool', severity: 'high', nodes: ['node_modules/tool'], via: [
      { name: 'tool', url, severity: 'high', range: '<1.1.0' }
    ] },
    owner: { name: 'owner', severity: 'high', nodes: ['node_modules/owner'], via: ['tool'] }
  });
  const policy = { schemaVersion: 1, createdOn: '2026-10-17', maxExpiresOn: '2026-11-16',
    releaseVersion: '0.3.0', reviewBeforeVersion: '0.3.1', releaseDate: null, exceptions: [{
      advisory, owner: 'jeremyaaron', expiresOn: '2026-11-16', commands: ['npm test'],
      dependencyPaths: ['owner > tool'], trustBoundary: 'Development test configuration',
      preconditions: 'Untrusted test configuration', mitigation: 'Use reviewed configuration',
      followUp: 'Upgrade owner before expiry',
      affected: auditFindings(full, lock).map(({ advisory: _advisory, ...rest }) => rest)
    }] };
  return { production: report(), full, lock: structuredClone(lock), policy, currentVersion: '0.2.9', now: new Date('2026-10-17T15:00:00Z') };
}

test('clean production and explicitly accounted full audit stay distinct', () => {
  const result = evaluateAudits(fixture());
  assert.equal(result.production, 0);
  assert.equal(result.full.total, 2);
  assert.equal(result.accountedPaths, 2);
  assert.equal(result.advisories, 1);
  const clean = fixture();
  clean.full = report(); clean.policy.exceptions = [];
  assert.equal(evaluateAudits(clean).full.total, 0);
});

test('production findings fail even when covered by a development exception', () => {
  const input = fixture(); input.production = input.full;
  assert.throws(() => evaluateAudits(input), /Production audit failed/);
});

test('new advisory and new physical dependency paths fail closed', () => {
  const input = fixture();
  input.full.vulnerabilities.tool.via[0].url = 'https://github.com/advisories/GHSA-dddd-eeee-ffff';
  assert.throws(() => evaluateAudits(input), /Stale|Unaccounted/);
  const added = fixture();
  added.full.vulnerabilities.tool.nodes.push('node_modules/owner/node_modules/tool');
  added.lock.packages['node_modules/owner/node_modules/tool'] = { version: '1.0.0', dev: true };
  assert.throws(() => evaluateAudits(added), /Unaccounted/);
});

test('version, severity, and inherited owner drift require a new review', () => {
  for (const change of [
    (input) => { input.lock.packages['node_modules/tool'].version = '1.0.1'; },
    (input) => { input.full.vulnerabilities.tool.severity = 'critical'; },
    (input) => { input.full.vulnerabilities.other = { name: 'other', severity: 'high', nodes: ['node_modules/other'], via: ['tool'] };
      input.lock.packages['node_modules/other'] = { version: '1.0.0', dev: true }; }
  ]) {
    const input = fixture(); change(input);
    assert.throws(() => evaluateAudits(input), /Stale|Unaccounted/);
  }
});

test('date expiry fails at UTC midnight and cannot be extended past the policy limit', () => {
  const input = fixture();
  input.now = new Date('2026-11-15T23:59:59Z');
  evaluateAudits(input);
  input.now = new Date('2026-11-16T00:00:00Z');
  assert.throws(() => evaluateAudits(input), /Expired/);
  input.now = new Date('2026-10-17'); input.policy.exceptions[0].expiresOn = '2026-11-17';
  assert.throws(() => evaluateAudits(input), /overlong/);
  input.policy.maxExpiresOn = '2026-12-17';
  assert.throws(() => evaluateAudits(input), /30 days/);
});

test('release and next-release boundaries are enforced numerically', () => {
  const input = fixture(); input.currentVersion = '0.3.0';
  assert.throws(() => evaluateAudits(input), /actual release date/);
  input.policy.releaseDate = '2026-10-17';
  evaluateAudits(input);
  input.policy.releaseDate = '2026-10-01';
  assert.throws(() => evaluateAudits(input), /overlong/);
  for (const currentVersion of ['0.3.1', '0.3.10', '0.4.0', '1.0.0']) {
    assert.throws(() => evaluateAudits({ ...input, currentVersion }), /release boundary/);
  }
});

test('stale and duplicate exceptions must be removed, not silently retained', () => {
  const input = fixture(); input.full = report();
  assert.throws(() => evaluateAudits(input), /Stale/);
  const duplicate = fixture(); duplicate.policy.exceptions.push(structuredClone(duplicate.policy.exceptions[0]));
  assert.throws(() => evaluateAudits(duplicate), /Duplicate/);
});

test('exceptions require owner, mitigation, exposure, paths, and development-only lock nodes', () => {
  for (const field of ['owner', 'mitigation', 'preconditions', 'followUp', 'trustBoundary', 'commands', 'dependencyPaths']) {
    const input = fixture(); delete input.policy.exceptions[0][field];
    assert.throws(() => evaluateAudits(input), /Every development exception/);
  }
  const input = fixture(); delete input.lock.packages['node_modules/tool'].dev;
  assert.throws(() => evaluateAudits(input), /not development-only/);
});

test('malformed, empty, error, truncated, and inconsistent responses are never clean', () => {
  for (const response of [
    { code: 0, stdout: '' }, { code: 1, stdout: '{}' },
    { code: 0, stdout: '{"auditReportVersion":2}' },
    { code: 1, stdout: '{"error":{"code":"ECONNRESET"}}' },
    { code: 1, stdout: JSON.stringify(report()) },
    { code: 'ETIMEDOUT', stdout: JSON.stringify(report()) },
    { code: 0, stdout: JSON.stringify({ ...report(), metadata: { vulnerabilities: { ...report().metadata.vulnerabilities, total: 1 } } }) }
  ]) assert.throws(() => parseAudit(response), /Audit unavailable/);
  const missing = fixture().full; missing.vulnerabilities.tool.nodes = [];
  assert.throws(() => parseAudit({ code: 1, stdout: JSON.stringify(missing) }), /malformed/);
  const badCounts = fixture().full; badCounts.metadata.vulnerabilities.high = 0; badCounts.metadata.vulnerabilities.critical = 2;
  assert.throws(() => parseAudit({ code: 1, stdout: JSON.stringify(badCounts) }), /severity counts/);
});

test('unresolved, cyclic, and unsupported advisory metadata fail rather than disappearing', () => {
  for (const change of [
    (input) => { input.full.vulnerabilities.owner.via = ['missing']; },
    (input) => { input.full.vulnerabilities.tool.via = ['owner']; },
    (input) => { input.full.vulnerabilities.tool.via[0].url = 'https://example.com'; },
    (input) => { delete input.lock.packages['node_modules/tool']; }
  ]) { const input = fixture(); change(input); assert.throws(() => evaluateAudits(input), /Audit unavailable|absent from lockfile/); }
});

test('audit collector explicitly includes development peers and rejects network/timeout failures', async () => {
  const calls = [];
  const run = async (command, args, options) => {
    calls.push({ command, args, options }); return { stdout: JSON.stringify(report()) };
  };
  await collectAudit('/scratch', true, run);
  await collectAudit('/scratch', false, run);
  assert.ok(calls[0].args.includes('--omit=dev'));
  assert.ok(calls[0].args.includes('--audit-level=info'));
  assert.ok(calls[1].args.includes('--include=dev'));
  assert.ok(calls[1].args.includes('--include=optional'));
  assert.ok(calls[1].args.includes('--workspaces'));
  assert.equal(calls[0].options.timeout, 60_000);
  await assert.rejects(collectAudit('/scratch', false, async () => { throw Object.assign(new Error(), { code: 'ENOTFOUND' }); }), /Audit unavailable/);
  const input = fixture();
  const observed = await collectAudit('/scratch', false, async () => {
    throw Object.assign(new Error(), { code: 1, stdout: JSON.stringify(input.full) });
  });
  assert.equal(observed.metadata.vulnerabilities.total, 2);
});

test('committed policy covers the lock graph, not production nodes, and is wired into full verification', async () => {
  const policy = JSON.parse(await readFile(new URL('../../docs/security/development-audit-exceptions.json', import.meta.url), 'utf8'));
  const actualLock = JSON.parse(await readFile(new URL('../../package-lock.json', import.meta.url), 'utf8'));
  for (const exception of policy.exceptions) for (const affected of exception.affected) {
    assert.equal(actualLock.packages[affected.path]?.version, affected.version);
    assert.equal(actualLock.packages[affected.path]?.dev, true);
  }
  const runner = await readFile(new URL('../verify.mjs', import.meta.url), 'utf8');
  assert.match(runner, /npmGate\('audit:dependencies', \['run', 'audit:dependencies'\]\)/);
});

test('supported local/CI runtime and separate Vitest peers retain the active Karma builder', async () => {
  const json = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
  const root = await json('../../package.json');
  const actualLock = await json('../../package-lock.json');
  const web = await json('../../apps/web/angular.json');
  assert.deepEqual(actualLock.packages[''].engines, root.engines);
  assert.equal(root.engines.node, '^24.0.0');
  assert.equal(root.engines.npm, '^11.0.0');
  assert.equal((await readFile(new URL('../../.nvmrc', import.meta.url), 'utf8')).trim(), '24');
  assert.match(await readFile(new URL('../../.github/workflows/ci.yml', import.meta.url), 'utf8'), /node-version: 24/);
  assert.equal(web.projects['worktrail-web'].architect.test.builder, '@angular/build:karma');
  assert.match(actualLock.packages['apps/web/node_modules/vitest'].version, /^3\.2\./);
  assert.match(actualLock.packages['node_modules/tinypool'].version, /^1\./);
  assert.match(actualLock.packages['node_modules/vitest'].version, /^4\./);
});

test('graph validation refuses incompatible peers even if pruning lowered the audit count', async () => {
  await verifyDependencyGraph('/scratch', async () => ({ stdout: '{"dependencies":{}}' }));
  for (const stdout of ['', '{}', '{"dependencies":{},"problems":["invalid: vitest@4 for Angular peer ^3"]}']) {
    await assert.rejects(verifyDependencyGraph('/scratch', async () => ({ stdout })), /Dependency graph check failed/);
  }
  await assert.rejects(verifyDependencyGraph('/scratch', async () => { throw Object.assign(new Error('invalid peer'), { code: 1 }); }), /Dependency graph check failed/);
});

test('private snapshots validate their real installation owner and reject lockfile mismatch', async () => {
  const manifest = await createManifest('none');
  try {
    const checkout = await prepareWorkspace(manifest);
    assert.equal(await installedDependencyRoot(checkout), await installedDependencyRoot(repositoryRoot));
    await writeFile(join(checkout, 'package-lock.json'), '{}');
    await assert.rejects(installedDependencyRoot(checkout), /different lockfiles/);
  } finally { await cleanupRun(manifest); }
});
