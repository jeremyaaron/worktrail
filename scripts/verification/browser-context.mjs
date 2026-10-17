import { basename, dirname, isAbsolute, join } from 'node:path';

import { readManifest } from './ownership.mjs';

export async function readBrowserContext(kind, env = process.env) {
  const manifest = await readManifest(env.WORKTRAIL_VERIFY_MANIFEST, env.WORKTRAIL_VERIFY_NONCE);
  const browser = manifest.browser;
  if (!browser || browser.kind !== kind || browser.checkout !== join(manifest.root, 'checkout') ||
      !Number.isInteger(browser.port) || browser.port < 1 || browser.port > 65535 ||
      browser.baseURL !== `http://127.0.0.1:${browser.port}` ||
      !/^[0-9a-f]{64}$/.test(browser.token) ||
      !isAbsolute(manifest.resultsRoot ?? '') ||
      basename(manifest.resultsRoot ?? '') !== manifest.runId ||
      basename(dirname(manifest.resultsRoot ?? '')) !== 'verification' ||
      basename(dirname(dirname(manifest.resultsRoot ?? ''))) !== 'test-results' ||
      env.WORKTRAIL_VERIFY_STAGE !== kind) {
    throw new Error('Internal browser invocation requires a matching owned runner stage. Use npm run verify.');
  }
  if ((kind === 'e2e' && (!Number.isInteger(browser.apiPort) || browser.apiPort < 1 || browser.apiPort > 65535 ||
      browser.apiPort === browser.port || env.API_PORT !== String(browser.apiPort) ||
      env.WORKTRAIL_E2E_HOST !== '127.0.0.1' || env.WORKTRAIL_E2E_WEB_PORT !== String(browser.port))) ||
      (kind === 'preview' && env.API_PORT !== String(browser.port)) ||
      (kind === 'editor' && env.WORKTRAIL_EDITOR_TEST_PORT !== String(browser.port))) {
    throw new Error('Internal browser ports/host differ from the owned stage; refusing HTTP target fallback.');
  }
  if (['e2e', 'preview'].includes(kind) && (!manifest.prepared || manifest.databaseState !== 'owned' ||
      env.DATABASE_URL !== manifest.databaseUrl || env.WORKTRAIL_ATTACHMENT_STORAGE_PATH !== manifest.storageRoot)) {
    throw new Error('Internal browser invocation requires prepared owned data.');
  }
  return { ...browser, runId: manifest.runId, outputDir: join(manifest.resultsRoot, kind) };
}
