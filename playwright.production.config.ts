import { defineConfig, devices } from '@playwright/test';

const port = Number.parseInt(process.env.API_PORT ?? '4319', 10);
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/production-preview.check.ts',
  workers: 1,
  retries: 0,
  reporter: [['list']],
  outputDir: 'test-results/production',
  use: { baseURL },
  webServer: {
    command: `env -u NO_COLOR -u FORCE_COLOR NODE_ENV=production API_PORT=${port} npm run start --workspace @worktrail/api`,
    url: `${baseURL}/api/health/ready`,
    reuseExistingServer: false,
    timeout: 60_000,
    gracefulShutdown: { signal: 'SIGTERM', timeout: 5_000 }
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }]
});
