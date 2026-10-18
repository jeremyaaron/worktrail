import { defineConfig, type ViteUserConfig } from 'vitest/config';

// The normal and verification commands both supply a validated, isolated run context.
export default defineConfig(async (): Promise<ViteUserConfig> => {
  const { readWebTestContext } = await import('../../scripts/verification/web.mjs');
  const { port, cacheDir, reportPath, screenshotDirectory } = await readWebTestContext();
  return {
    cacheDir,
    server: { host: '127.0.0.1', port, strictPort: true },
    test: {
      globals: false,
      fileParallelism: false,
      retry: 0,
      passWithNoTests: false,
      reporters: ['default', ['json', { outputFile: reportPath }]],
      browser: { api: { host: '127.0.0.1', port, strictPort: true }, screenshotDirectory }
    }
  };
});
