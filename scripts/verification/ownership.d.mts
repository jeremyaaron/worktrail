import type pg from 'pg';

export interface VerificationManifest {
  version: 1;
  runId: string;
  nonce: string;
  root: string;
  databaseMode: 'docker' | 'service' | 'none';
  databaseName: string;
  databaseUrl: string | null;
  adminUrl: string | null;
  databaseState: 'none' | 'pending' | 'owned' | 'removed';
  containerName: string | null;
  storageRoot: string;
  prepared: boolean;
}
export function assertOwnedDatabase(env?: NodeJS.ProcessEnv, queryable?: pg.Pool | pg.PoolClient): Promise<VerificationManifest>;
export function readEnvironmentManifest(env?: NodeJS.ProcessEnv): Promise<VerificationManifest>;
