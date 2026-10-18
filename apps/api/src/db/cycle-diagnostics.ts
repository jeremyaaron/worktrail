import 'dotenv/config';

import { pathToFileURL } from 'node:url';
import { z } from 'zod';

import { createDb, createPool } from './client.js';
import { createPersistence } from '../repositories/persistence.js';

export async function runCycleDiagnostics(args: readonly string[] = process.argv.slice(2)): Promise<void> {
  if (args.length > 1 || (args[0] !== undefined && !args[0].startsWith('--workspace-id='))) {
    throw new Error('Usage: npm run db:cycle-diagnostics -- --workspace-id=<UUID> (optional)');
  }
  const workspaceId = args[0] === undefined ? undefined : z.string().uuid().parse(args[0].slice('--workspace-id='.length));
  const pool = createPool();
  try {
    const conflicts = await createPersistence(createDb(pool)).readConsistent(({ repositories }) =>
      repositories.projectCycles.findScheduleConflicts(workspaceId)
    );
    console.log(JSON.stringify({ readOnly: true, conflictCount: conflicts.length, conflicts }, null, 2));
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCycleDiagnostics().catch(() => {
    console.error('Cycle diagnostics failed. Check arguments and database connectivity; no repairs were attempted.');
    process.exitCode = 1;
  });
}
