import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseArguments } from './arguments.mjs';

test('selects explicit API/docker or service mode without silently running unfinished modes', () => {
  assert.equal(parseArguments(['--mode=api']).database, 'docker');
  assert.equal(parseArguments(['--mode=api', '--database=service']).database, 'service');
  assert.equal(parseArguments([]).mode, 'api');
  for (const mode of ['full', 'e2e', 'editor', 'preview', 'site']) assert.throws(() => parseArguments([`--mode=${mode}`]), /Phase 1/);
});

test('rejects unknown arguments and invalid cleanup without accepting arbitrary commands', () => {
  for (const args of [['--mode=nope'], ['--database=nope'], ['--cleanup'], ['--cleanup', '--help'], ['--command=rm']]) {
    assert.throws(() => parseArguments(args));
  }
  assert.equal(parseArguments(['--cleanup', '/tmp/manifest.json']).cleanup, '/tmp/manifest.json');
  assert.equal(parseArguments(['--help']).help, true);
});
