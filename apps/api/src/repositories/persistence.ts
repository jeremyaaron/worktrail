import type { WorktrailDb, WorktrailTransaction } from '../db/client.js';
import { createRepositories, type Repositories } from './index.js';
import { createRepositoryLocks, type RepositoryLocks } from './locks.js';

export interface PersistenceScope {
  repositories: Repositories;
  locks: RepositoryLocks;
  persistence: Persistence;
}

export interface Persistence {
  write<T>(callback: (scope: PersistenceScope) => Promise<T>): Promise<T>;
  readConsistent<T>(callback: (scope: PersistenceScope) => Promise<T>): Promise<T>;
}

export function assertPersistence(value: Persistence): void {
  if (!value || typeof value.write !== 'function' || typeof value.readConsistent !== 'function') {
    throw new Error('Explicit persistence capabilities are required.');
  }
}

export async function withTransactionScope<T>(
  transaction: WorktrailTransaction,
  mode: 'write' | 'read',
  callback: (scope: PersistenceScope) => Promise<T>
): Promise<T> {
  let active = true;
  const assertActive = () => {
    if (!active) throw new Error('Persistence scope has ended.');
  };
  const assertWritable = () => {
    assertActive();
    if (mode === 'read') throw new Error('Cannot write or acquire write locks in a read-only persistence scope.');
  };
  const persistence: Persistence = {
    async write(operation) {
      assertWritable();
      return operation(scope);
    },
    async readConsistent(operation) {
      assertActive();
      return operation(scope);
    }
  };
  const scope: PersistenceScope = {
    repositories: createRepositories(transaction),
    locks: createRepositoryLocks(transaction, assertWritable),
    persistence
  };
  try {
    return await callback(scope);
  } finally {
    active = false;
  }
}

export function createPersistence(db: WorktrailDb): Persistence {
  return {
    write: (callback) => db.transaction(
      (tx) => withTransactionScope(tx, 'write', callback),
      { isolationLevel: 'read committed', accessMode: 'read write' }
    ),
    readConsistent: (callback) => db.transaction(
      (tx) => withTransactionScope(tx, 'read', callback),
      { isolationLevel: 'repeatable read', accessMode: 'read only' }
    )
  };
}
