import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const unitTests = [
  'app-error', 'attachment-object-store', 'attachment-policy', 'authored-content-policy',
  'csv', 'cycle-review-model', 'delivery-health-service', 'domain', 'local-http', 'main', 'openapi',
  'persistence', 'project-cycle-closeout-snapshot', 'quick-find-endpoint', 'quick-find-query',
  'quick-find-service', 'repository-read-transaction', 'request-logging', 'runtime-config',
  'server', 'status-report-markdown-renderer', 'storage-reset', 'work-item-csv-export',
  'work-item-hydrator', 'work-item-page', 'work-item-page-query', 'work-item-query', 'work-item-query-builder',
  'work-risk-sections'
].map((name) => `tests/${name}.test.ts`);

export default defineConfig({
  resolve: {
    alias: {
      // Match TypeScript's development mapping without requiring compiled workspace artifacts.
      '@worktrail/contracts': fileURLToPath(
        new URL('../../packages/contracts/src/index.ts', import.meta.url)
      )
    }
  },
  test: {
    projects: [
      { extends: true, test: { name: 'unit', include: unitTests } },
      {
        extends: true,
        test: {
          name: 'integration',
          include: ['tests/**/*.test.ts'],
          exclude: unitTests,
          globalSetup: ['./tests/support/integration-setup.ts']
        }
      }
    ]
  }
});
