import { defineConfig, devices } from '@playwright/test';

import { readBrowserContext } from './scripts/verification/browser-context.mjs';

const context = await readBrowserContext('preview');

export default defineConfig({
  testDir: './e2e',
  testMatch: ['**/production-preview.check.ts', '**/local-setup-proof.spec.ts'],
  workers: 1,
  retries: 0,
  reporter: [['list'], ['json', { outputFile: `${context.outputDir}/report.json` }]],
  outputDir: `${context.outputDir}/artifacts`,
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  use: { baseURL: context.baseURL, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }]
});
