import { defineConfig, devices } from '@playwright/test';

const webPort = Number.parseInt(process.env.WORKTRAIL_E2E_WEB_PORT ?? '4200', 10);
const apiPort = Number.parseInt(process.env.API_PORT ?? '3000', 10);
const host = process.env.WORKTRAIL_E2E_HOST ?? '127.0.0.1';
const baseURL = process.env.WORKTRAIL_E2E_BASE_URL ?? `http://${host}:${webPort}`;
const cleanColorEnv = 'env -u NO_COLOR -u FORCE_COLOR';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list']],
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL,
    trace: 'on-first-retry'
  },
  webServer: [
    {
      command: `${cleanColorEnv} API_PORT=${apiPort} npm run dev:api`,
      url: `http://${host}:${apiPort}/api/health/ready`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000
    },
    {
      command: `${cleanColorEnv} npm run ng --workspace @worktrail/web -- serve --host ${host} --proxy-config proxy.conf.json --port ${webPort}`,
      url: baseURL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000
    }
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ]
});
