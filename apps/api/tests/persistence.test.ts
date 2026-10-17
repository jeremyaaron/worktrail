import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it, vi } from 'vitest';

import { createExpressApp } from '../src/adapters/express/server.js';
import { createDb, createPool, type WorktrailTransaction } from '../src/db/client.js';
import { createRepositories } from '../src/repositories/index.js';
import { mapSequential } from '../src/repositories/map-sequential.js';
import { createPersistence, type PersistenceScope } from '../src/repositories/persistence.js';
import { ProjectService } from '../src/services/project-service.js';
import { fakeRepositoryContext } from './support/fake-persistence.js';

function fixture() {
  // No connection is opened: the transaction boundary is explicitly replaced for these unit tests.
  const db = createDb(createPool('postgres://unused:unused@localhost/unused'));
  const execute = vi.fn();
  const tx = { execute } as unknown as WorktrailTransaction;
  const transaction = vi.spyOn(db, 'transaction').mockImplementation(async (callback) => callback(tx));
  return { db, execute, transaction, persistence: createPersistence(db) };
}

describe('explicit persistence capabilities', () => {
  it('starts writes with explicit read-committed/read-write configuration', async () => {
    const { persistence, transaction } = fixture();
    expect(await persistence.write(async () => 'done')).toBe('done');
    expect(transaction).toHaveBeenCalledExactlyOnceWith(expect.any(Function), {
      isolationLevel: 'read committed', accessMode: 'read write'
    });
  });

  it('participates in the enclosing write scope without transactions or savepoints', async () => {
    const { persistence, transaction } = fixture();
    await persistence.write(async (scope) => {
      await scope.persistence.write(async (inner) => expect(inner).toBe(scope));
      await scope.persistence.readConsistent(async (inner) => {
        expect(inner.repositories).toBe(scope.repositories);
        expect(inner.locks).toBe(scope.locks);
      });
    });
    expect(transaction).toHaveBeenCalledOnce();
  });

  it('starts independent consistent reads as repeatable-read/read-only and rejects writes/locks', async () => {
    const { persistence, transaction, execute } = fixture();
    await persistence.readConsistent(async (scope) => {
      await scope.persistence.readConsistent(async (inner) => expect(inner).toBe(scope));
      await expect(scope.persistence.write(async () => undefined)).rejects.toThrow('read-only');
      await expect(scope.locks.projects([])).rejects.toThrow('read-only');
      await expect(scope.locks.operation({ namespace: 'board', workspaceId: 'w', resourceId: 'p' }))
        .rejects.toThrow('read-only');
    });
    expect(transaction).toHaveBeenCalledExactlyOnceWith(expect.any(Function), {
      isolationLevel: 'repeatable read', accessMode: 'read only'
    });
    expect(execute).not.toHaveBeenCalled();
  });

  it.each(['success', 'failure'])('invalidates escaped capabilities after callback %s', async (outcome) => {
    const { persistence } = fixture();
    let escaped!: PersistenceScope;
    const result = persistence.write(async (scope) => {
      escaped = scope;
      if (outcome === 'failure') throw new Error('failed');
    });
    if (outcome === 'failure') await expect(result).rejects.toThrow('failed');
    else await result;
    await expect(escaped.persistence.write(async () => undefined)).rejects.toThrow('scope has ended');
    await expect(escaped.persistence.readConsistent(async () => undefined)).rejects.toThrow('scope has ended');
    await expect(escaped.locks.projects([])).rejects.toThrow('scope has ended');
  });

  it('requires capabilities for production composition while allowing health-only and explicit fakes', () => {
    const { db } = fixture();
    const repositories = createRepositories(db);
    // @ts-expect-error Domain routes require explicit persistence, not silent root writes.
    expect(() => createExpressApp({ repositories })).toThrow('Explicit persistence');
    const actor = { workspaceId: 'w', memberId: 'm', role: 'owner' as const };
    // @ts-expect-error Services also require explicit persistence.
    expect(() => new ProjectService({ repositories, actor })).toThrow('Explicit persistence');
    expect(() => createExpressApp()).not.toThrow();
    expect(() => new ProjectService({ ...fakeRepositoryContext(repositories), actor })).not.toThrow();
  });

  it('acquires namespaced project locks in sorted order, with idempotent reentry and no upgrades', async () => {
    const { persistence, execute } = fixture();
    await persistence.write(async ({ locks }) => {
      await locks.projects([
        { workspaceId: 'w', projectId: 'b', mode: 'exclusive' },
        { workspaceId: 'w', projectId: 'a', mode: 'shared' }
      ]);
      await locks.projects([{ workspaceId: 'w', projectId: 'b', mode: 'shared' }]);
      await expect(locks.projects([{ workspaceId: 'w', projectId: 'a', mode: 'exclusive' }]))
        .rejects.toThrow('upgrades');
      await expect(locks.projects([{ workspaceId: 'w', projectId: '0', mode: 'shared' }]))
        .rejects.toThrow('stable project-ID order');
    });
    const dialect = new PgDialect();
    const queries = execute.mock.calls.map(([query]) => dialect.sqlToQuery(query));
    expect(queries.map((query) => query.params)).toEqual([
      [JSON.stringify(['worktrail', 'project', 'w', 'a'])],
      [JSON.stringify(['worktrail', 'project', 'w', 'b'])]
    ]);
    expect(queries[0]?.sql).toContain('pg_advisory_xact_lock_shared');
    expect(queries[1]?.sql).toContain('pg_advisory_xact_lock(');
  });

  it('orders operation locks and refuses late project acquisition', async () => {
    const { persistence, execute } = fixture();
    await persistence.write(async ({ locks }) => {
      await locks.projects([{ workspaceId: 'w', projectId: 'a', mode: 'shared' }]);
      const request = { workspaceId: 'w', resourceId: 'a', namespace: 'dependency' as const };
      await locks.operation(request);
      await locks.operation(request);
      await expect(locks.operation({ ...request, namespace: 'hierarchy' })).rejects.toThrow('Operation locks');
      await expect(locks.projects([{ workspaceId: 'w', projectId: 'b', mode: 'shared' }]))
        .rejects.toThrow('precede operation locks');
      await locks.operation({ ...request, namespace: 'board' });
    });
    expect(execute).toHaveBeenCalledTimes(3);
  });

  it('canonicalizes UUID spelling before project deduplication, mode checks, and operation reentry', async () => {
    const { persistence, execute } = fixture();
    const workspaceId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const projectId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    await persistence.write(async ({ locks }) => {
      await locks.projects([{ workspaceId: workspaceId.toUpperCase(), projectId: projectId.toUpperCase(), mode: 'shared' }]);
      await locks.projects([{ workspaceId, projectId, mode: 'shared' }]);
      await expect(locks.projects([{ workspaceId, projectId, mode: 'exclusive' }])).rejects.toThrow('upgrades');
      await locks.operation({ workspaceId: workspaceId.toUpperCase(), resourceId: projectId.toUpperCase(), namespace: 'board' });
      await locks.operation({ workspaceId, resourceId: projectId, namespace: 'board' });
    });
    expect(execute).toHaveBeenCalledTimes(2);
    const dialect = new PgDialect();
    expect(execute.mock.calls.map(([query]) => dialect.sqlToQuery(query).params)).toEqual([
      [JSON.stringify(['worktrail', 'project', workspaceId, projectId])],
      [JSON.stringify(['worktrail', 'operation', 'board', workspaceId, projectId])]
    ]);
  });

  it('resolves duplicate requested modes before acquisition and validates the entire batch', async () => {
    const { persistence, execute } = fixture();
    await persistence.write(async ({ locks }) => {
      await locks.projects([
        { workspaceId: 'w', projectId: 'a', mode: 'shared' },
        { workspaceId: 'w', projectId: 'a', mode: 'exclusive' }
      ]);
      expect(execute).toHaveBeenCalledOnce();
      const query = new PgDialect().sqlToQuery(execute.mock.calls[0]![0]);
      expect(query.sql).toContain('pg_advisory_xact_lock(');
      await locks.projects([{ workspaceId: 'w', projectId: 'b', mode: 'shared' }]);
      await expect(locks.projects([
        { workspaceId: 'w', projectId: 'c', mode: 'exclusive' },
        { workspaceId: 'w', projectId: 'b', mode: 'exclusive' }
      ])).rejects.toThrow('upgrades');
      expect(execute).toHaveBeenCalledTimes(2);
    });
  });

  it('sequences collection work and stops without starting later operations after failure', async () => {
    let active = 0;
    const operation = vi.fn(async (value: number) => {
      expect(active).toBe(0);
      active++;
      await Promise.resolve();
      active--;
      return value * 2;
    });
    expect(await mapSequential([2, 1], operation)).toEqual([4, 2]);
    const failure = vi.fn(async () => { throw new Error('query failure'); });
    await expect(mapSequential([1, 2], failure)).rejects.toThrow('query failure');
    expect(failure).toHaveBeenCalledOnce();
  });
});
