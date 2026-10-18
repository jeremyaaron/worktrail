import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { test } from 'node:test';

import { createManifest } from './ownership.mjs';
import { cleanupRun } from './resources.mjs';

const require = createRequire(import.meta.url);
const { load } = require('js-yaml');
const workflow = load(await readFile(new URL('../../.github/workflows/ci.yml', import.meta.url), 'utf8'));
const action = load(await readFile(new URL('../../.github/actions/verify/action.yml', import.meta.url), 'utf8'));

test('comprehensive CI runs only for pull requests while Pages retains main deployment', async () => {
  assert.deepEqual(workflow.on, { pull_request: null });
  const pages = load(await readFile(new URL('../../.github/workflows/pages.yml', import.meta.url), 'utf8'));
  assert.deepEqual(pages.on.push.branches, ['main']);
  assert.ok(Object.hasOwn(pages.on, 'workflow_dispatch'));
});

test('CI retains every verification scope with isolated serial browser shards and no matrix fail-fast', async () => {
  const { jobs } = workflow;
  const input = name => jobs[name].steps.find(step => step.uses === './.github/actions/verify').with;
  assert.equal(input('checks').mode, 'checks');
  assert.equal(input('web').mode, 'web');
  assert.equal(input('preview').mode, 'preview');
  assert.equal(input('e2e').mode, 'e2e');
  assert.equal(input('e2e').shard, '${{ matrix.shard }}/3');
  assert.deepEqual(jobs.e2e.strategy.matrix.shard, [1, 2, 3]);
  assert.deepEqual(jobs.interfaces.strategy.matrix.mode, ['editor', 'site']);
  assert.equal(jobs.e2e.strategy['fail-fast'], false);
  assert.equal(jobs.interfaces.strategy['fail-fast'], false);
  for (const name of ['checks', 'preview', 'e2e']) {
    assert.equal(jobs[name].services.postgres.image, 'postgres:16-alpine');
    assert.equal(input(name).database, 'service');
  }
  assert.equal(jobs.web.services, undefined);
  assert.equal(jobs.interfaces.services, undefined);
  const config = await readFile(new URL('../../playwright.config.ts', import.meta.url), 'utf8');
  assert.match(config, /workers: 1/);
  assert.match(config, /retries: 0/);
  assert.doesNotMatch(config, /maxFailures/);
});

test('the existing required Verify status rejects failed, skipped and canceled child jobs', () => {
  const gate = workflow.jobs.verify;
  assert.equal(gate.name, 'Verify');
  assert.equal(gate.if, 'always()');
  assert.deepEqual([...gate.needs].sort(), ['checks', 'e2e', 'interfaces', 'preview', 'web']);
  const results = Object.fromEntries(gate.needs.map(name => [name, { result: 'success' }]));
  const run = data => execFileSync('bash', ['-e', '-c', gate.steps[0].run], {
    env: { ...process.env, RESULTS: JSON.stringify(data) }, stdio: 'pipe'
  });
  assert.doesNotThrow(() => run(results));
  for (const result of ['failure', 'skipped', 'cancelled']) {
    assert.throws(() => run({ ...results, e2e: { result } }));
  }
});

test('all scopes retain summaries and failure evidence with literal argument forwarding', () => {
  const evidence = action.runs.steps.find(step => step.uses === 'actions/upload-artifact@v4');
  assert.equal(evidence.if, 'always()');
  assert.equal(evidence.with.path, 'test-results/verification');
  const command = action.runs.steps.find(step => step.name === 'Verify owned scope');
  assert.match(command.run, /args=\("--mode=\$VERIFY_MODE" "--database=\$VERIFY_DATABASE"\)/);
  assert.match(command.run, /args\+=\("--shard=\$VERIFY_SHARD"\)/);
  assert.match(command.run, /npm run verify -- "\$\{args\[@\]\}"/);
  assert.doesNotMatch(command.run, /eval|max-failures|retries|sleep/);
});

test('full/local and CI checks keep the strict audit gate and cannot mask a child failure', async () => {
  const root = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8'));
  assert.equal(root.scripts['audit:dependencies'], 'node scripts/audit-dependencies.mjs');
  assert.equal(root.scripts.verify, 'node scripts/verify.mjs');
  const require = createRequire(import.meta.url);
  const ts = require('typescript');
  const source = ts.createSourceFile('verify.mjs', await readFile(new URL('../verify.mjs', import.meta.url), 'utf8'), ts.ScriptTarget.Latest);
  const audited = new Set();
  const literal = (node, value) => node && ts.isStringLiteral(node) && node.text === value;
  const hasAwaitedAudit = node => {
    if (ts.isAwaitExpression(node) && ts.isCallExpression(node.expression)) {
      const call = node.expression;
      const [name, args] = call.arguments;
      if (ts.isIdentifier(call.expression) && call.expression.text === 'npmGate' &&
          literal(name, 'audit:dependencies') && args && ts.isArrayLiteralExpression(args) &&
          args.elements.length === 2 && literal(args.elements[0], 'run') && literal(args.elements[1], 'audit:dependencies')) return true;
    }
    let found = false;
    ts.forEachChild(node, child => { if (hasAwaitedAudit(child)) found = true; });
    return found;
  };
  const visit = node => {
    if (ts.isIfStatement(node) && ts.isBinaryExpression(node.expression)) {
      const { left, right, operatorToken } = node.expression;
      if (operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken && ts.isPropertyAccessExpression(left) &&
          ts.isIdentifier(left.expression) && left.expression.text === 'options' && left.name.text === 'mode' &&
          (literal(right, 'full') || literal(right, 'checks')) && hasAwaitedAudit(node.thenStatement)) {
        audited.add(right.text);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  assert.deepEqual([...audited].sort(), ['checks', 'full']);
  const manifest = await createManifest('none');
  try {
    const bin = join(manifest.root, 'bin');
    await mkdir(bin);
    await writeFile(join(bin, 'npm'), '#!/bin/sh\nprintf "%s\\n" "$@"\nexit 42\n', { mode: 0o700 });
    const command = action.runs.steps.find(step => step.name === 'Verify owned scope');
    assert.throws(() => execFileSync('bash', ['-e', '-o', 'pipefail', '-c', command.run], {
      env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, VERIFY_MODE: 'checks', VERIFY_DATABASE: 'service', VERIFY_SHARD: '' },
      stdio: 'pipe'
    }), error => {
      assert.equal(error.status, 42);
      assert.equal(error.stdout.toString(), 'run\nverify\n--\n--mode=checks\n--database=service\n');
      return true;
    });
  } finally { await cleanupRun(manifest); }
});
