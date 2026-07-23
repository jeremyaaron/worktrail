import { defineConfig, devices } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const originalAttachmentStoragePath = process.env.WORKTRAIL_ATTACHMENT_STORAGE_PATH;
const e2eAttachmentStoragePath =
  process.env.WORKTRAIL_E2E_ATTACHMENT_STORAGE_PATH ??
  join(tmpdir(), `worktrail-e2e-attachments-${process.pid}`);

process.env.WORKTRAIL_E2E_RESTORE_ATTACHMENT_STORAGE_PATH = originalAttachmentStoragePath ?? '';
process.env.WORKTRAIL_ATTACHMENT_STORAGE_PATH = e2eAttachmentStoragePath;

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
  globalTeardown: './e2e/global-teardown.ts',
  use: {
    baseURL,
    trace: 'on-first-retry'
  },
  webServer: [
    {
      command: `${cleanColorEnv} API_PORT=${apiPort} npm run dev:api`,
      url: `http://${host}:${apiPort}/api/health/ready`,
      reuseExistingServer: false,
      timeout: 120_000
    },
    {
      command: `${cleanColorEnv} npm run ng --workspace @worktrail/web -- serve --host ${host} --proxy-config proxy.conf.json --port ${webPort}`,
      url: baseURL,
      reuseExistingServer: false,
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
