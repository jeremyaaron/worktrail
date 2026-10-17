import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseArguments } from './arguments.mjs';

test('selects full by default and supports focused modes with explicit database provisioning', () => {
  assert.equal(parseArguments(['--mode=api']).database, 'docker');
  assert.equal(parseArguments(['--mode=api', '--database=service']).database, 'service');
  assert.equal(parseArguments([]).mode, 'full');
  for (const mode of ['full', 'web', 'e2e', 'editor', 'preview', 'site']) assert.equal(parseArguments([`--mode=${mode}`]).mode, mode);
});

test('validates focused selection, UI, and explicit port requests without command passthrough', () => {
  const options = parseArguments(['--mode=e2e', '--web-port=48765', '--api-port=48766', '--grep=smoke', '--ui']);
  assert.deepEqual(options.ports, { web: 48765, api: 48766 });
  assert.equal(options.grep, 'smoke');
  assert.equal(options.ui, true);
  for (const args of [['--ui'], ['--grep=x'], ['--mode=e2e', '--grep=['], ['--api-port=0'], ['--api-port=65536'], ['--web-port=1x']]) assert.throws(() => parseArguments(args));
});

test('rejects unknown arguments and invalid cleanup without accepting arbitrary commands', () => {
  for (const args of [['--mode=nope'], ['--database=nope'], ['--cleanup'], ['--cleanup', '--help'], ['--command=rm']]) {
    assert.throws(() => parseArguments(args));
  }
  assert.equal(parseArguments(['--cleanup', '/tmp/manifest.json']).cleanup, '/tmp/manifest.json');
  assert.equal(parseArguments(['--help']).help, true);
});

test('selects explicit API files only in API mode without paths, options, or empty selections', () => {
  assert.equal(parseArguments(['--mode=api']).apiTests, null);
  assert.deepEqual(parseArguments(['--mode=api', '--api-tests=server,work-item-csv-http,server']).apiTests,
    ['server', 'work-item-csv-http']);
  for (const args of [
    ['--api-tests=server'], ['--mode=e2e', '--api-tests=server'],
    ...['', 'server,', '../server', '--help', 'server.test.ts', 'server;id', 'server,*'].map((names) => ['--mode=api', `--api-tests=${names}`])
  ]) assert.throws(() => parseArguments(args));
});
