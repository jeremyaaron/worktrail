import { sql } from 'drizzle-orm';

import type { RepositoryExecutor } from '../db/client.js';

export type ProjectLockMode = 'shared' | 'exclusive';

export interface ProjectLockRequest {
  workspaceId: string;
  projectId: string;
  mode: ProjectLockMode;
}

export interface OperationLockRequest {
  workspaceId: string;
  resourceId: string;
  namespace: 'hierarchy' | 'dependency' | 'board';
}

export interface RepositoryLocks {
  projects(requests: readonly ProjectLockRequest[]): Promise<void>;
  operation(request: OperationLockRequest): Promise<void>;
}

const namespaceOrder = { hierarchy: 0, dependency: 1, board: 2 } as const;
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;

export function createRepositoryLocks(executor: RepositoryExecutor, assertWritable: () => void): RepositoryLocks {
  const heldProjects = new Map<string, ProjectLockMode>();
  const heldOperations = new Set<string>();
  let lastProject = '';
  let lastOperation = '';
  return {
    async projects(requests) {
      assertWritable();
      const ordered = [...requests].sort((a, b) =>
        compare(a.projectId, b.projectId) || compare(a.workspaceId, b.workspaceId)
      );
      // Validate the complete requested set before taking any lock. Never upgrade a shared lock.
      const requested = new Map<string, ProjectLockRequest>();
      for (const request of ordered) {
        const key = JSON.stringify([request.projectId, request.workspaceId]);
        const held = heldProjects.get(key);
        if (held === 'shared' && request.mode === 'exclusive') {
          throw new Error('Project lock upgrades are not allowed.');
        }
        if (!held && (lastOperation || (lastProject && compare(key, lastProject) < 0))) {
          throw new Error('Project locks must precede operation locks in stable project-ID order.');
        }
        const mode = request.mode === 'exclusive' || requested.get(key)?.mode === 'exclusive'
          ? 'exclusive' : 'shared';
        requested.set(key, { ...request, mode });
      }
      for (const [key, { projectId, workspaceId, mode }] of requested) {
        if (heldProjects.has(key)) continue;
        const identity = JSON.stringify(['worktrail', 'project', workspaceId, projectId]);
        await executor.execute(mode === 'exclusive'
          ? sql`select pg_advisory_xact_lock(hashtextextended(${identity}, 0))`
          : sql`select pg_advisory_xact_lock_shared(hashtextextended(${identity}, 0))`);
        heldProjects.set(key, mode);
        lastProject = key;
      }
    },
    async operation(request) {
      assertWritable();
      const key = JSON.stringify([namespaceOrder[request.namespace], request.workspaceId, request.resourceId]);
      if (heldOperations.has(key)) return;
      if (lastOperation && compare(key, lastOperation) < 0) {
        throw new Error('Operation locks must follow hierarchy, dependency, board order with sorted keys.');
      }
      const identity = JSON.stringify(['worktrail', 'operation', request.namespace, request.workspaceId, request.resourceId]);
      await executor.execute(sql`select pg_advisory_xact_lock(hashtextextended(${identity}, 0))`);
      heldOperations.add(key);
      lastOperation = key;
    }
  };
}
