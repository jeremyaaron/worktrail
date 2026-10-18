import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const { load } = require('js-yaml');
const workflow = load(await readFile(new URL('../../.github/workflows/ci.yml', import.meta.url), 'utf8'));
const action = load(await readFile(new URL('../../.github/actions/verify/action.yml', import.meta.url), 'utf8'));

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
