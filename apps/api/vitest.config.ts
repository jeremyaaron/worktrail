import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      // Match TypeScript's development mapping without requiring compiled workspace artifacts.
      '@worktrail/contracts': fileURLToPath(
        new URL('../../packages/contracts/src/index.ts', import.meta.url)
      )
    }
  }
});
