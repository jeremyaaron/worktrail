import { defineConfig, devices } from '@playwright/test';
import { readBrowserContext } from './scripts/verification/browser-context.mjs';

const context = await readBrowserContext('site');

export default defineConfig({
  testDir: './e2e/site',
  testMatch: '**/*.check.ts',
  workers: 1,
  retries: 0,
  reporter: [['list'], ['json', { outputFile: `${context.outputDir}/report.json` }]],
  outputDir: `${context.outputDir}/artifacts`,
  use: {
    baseURL: `${context.baseURL}/worktrail/`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }]
});
