import { describe, expect, it, vi } from 'vitest';

import type { WorktrailDb } from '../src/db/client.js';
import { withRepositoriesReadTransaction } from '../src/repositories/index.js';

describe('repository read transactions', () => {
  it('binds repositories with repeatable-read and read-only configuration', async () => {
    const transaction = vi.fn(async (callback: (tx: unknown) => Promise<string>, config: unknown) => {
      expect(config).toEqual({
        isolationLevel: 'repeatable read',
        accessMode: 'read only'
      });
      return callback({});
    });
    const db = { transaction } as unknown as WorktrailDb;

    const result = await withRepositoriesReadTransaction(db, async (repositories) => {
      expect(repositories.workItems).toBeDefined();
      expect(repositories.projects).toBeDefined();
      return 'complete';
    });

    expect(result).toBe('complete');
    expect(transaction).toHaveBeenCalledOnce();
  });
});
