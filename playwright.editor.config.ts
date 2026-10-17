import { defineConfig, devices } from '@playwright/test';

const port = Number.parseInt(process.env.WORKTRAIL_EDITOR_TEST_PORT ?? '4317', 10);
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './apps/web/browser-tests/authored-content-editor',
  testMatch: '**/*.spec.ts',
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  outputDir: 'test-results/editor',
  use: { baseURL, trace: 'on-first-retry' },
  webServer: {
    command: 'env -u NO_COLOR -u FORCE_COLOR node scripts/serve-authored-content-editor.mjs',
    url: baseURL,
    reuseExistingServer: false,
    gracefulShutdown: { signal: 'SIGTERM', timeout: 5000 },
    timeout: 120_000
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }]
});
