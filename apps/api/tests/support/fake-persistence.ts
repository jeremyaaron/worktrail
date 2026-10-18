import type { Repositories } from '../../src/repositories/index.js';
import type { Persistence, PersistenceScope } from '../../src/repositories/persistence.js';

// Explicit repository-only test execution. This does not simulate rollback or MVCC isolation.
export function fakePersistence(repositories: Repositories): Persistence {
  const unsupported = async () => { throw new Error('Fake persistence does not acquire database locks.'); };
  const persistence: Persistence = {
    async write(callback) { return callback(scope); },
    async readConsistent(callback) { return callback(scope); }
  };
  const scope: PersistenceScope = { repositories, persistence, locks: { projects: unsupported, operation: unsupported } };
  return persistence;
}

export function fakeRepositoryContext(repositories: Repositories) {
  return { repositories, persistence: fakePersistence(repositories) };
}
