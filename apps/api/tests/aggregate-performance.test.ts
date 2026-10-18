import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, expect, it } from 'vitest';
import { assertOwnedDatabase } from '../../../scripts/verification/ownership.mjs';
import { createExpressApp } from '../src/adapters/express/server.js';
import { createDb, createPool } from '../src/db/client.js';
import { createRepositories } from '../src/repositories/index.js';
import { createPersistence, type Persistence } from '../src/repositories/persistence.js';
import { createAggregateFixture } from './support/aggregate-fixture.js';
import { cleanupWorkspace } from './support/workspace-fixtures.js';
import request from './support/local-http.js';

let pool: ReturnType<typeof createPool>, db: ReturnType<typeof createDb>;
const queries: string[] = [], workspaceIds = new Set<string>();
const results: Array<Record<string, unknown>> = [];
beforeAll(() => { pool = createPool(); db = createDb(pool, { logger: { logQuery: query => { queries.push(query); } } }); });
afterEach(async () => { for (const id of workspaceIds) await cleanupWorkspace(pool, id); workspaceIds.clear(); });
afterAll(async () => {
  try {
    const manifest = await assertOwnedDatabase(process.env, pool);
    await mkdir(manifest.resultsRoot, { recursive: true });
    await writeFile(join(manifest.resultsRoot, 'aggregate-evidence.json'), JSON.stringify(results, null, 2));
  } finally { await pool.end(); }
});

it.each([1, 15])('bounds complete aggregate HTTP paths on %s projects', async (projectCount) => {
  const workspaceId = randomUUID(); workspaceIds.add(workspaceId);
  const f = await createAggregateFixture(db, workspaceId, projectCount);
  const persistence = createPersistence(db);
  let evaluatedRows = 0, enrichedRows = 0;
  const measured: Persistence = { write: persistence.write, readConsistent: callback => persistence.readConsistent(async scope => {
    for (const [name, method] of Object.entries(scope.repositories.workItems)) {
      if (name.startsWith('listEvaluation') || name === 'listParentsForChildren') {
        Object.assign(scope.repositories.workItems, { [name]: async (...args: unknown[]) => {
          const rows = await (method as (...args: unknown[]) => Promise<unknown[]>)(...args);
          if (name.startsWith('listEvaluation')) evaluatedRows += rows.length; else enrichedRows += (args[0] as string[]).length;
          return rows;
        } });
      }
    }
    return callback(scope);
  }) };
  const app = createExpressApp({ repositories: createRepositories(db), persistence: measured });
  const project = f.projects[0]!, cycle = f.cycles[0]!, milestone = f.milestones[0]!;
  for (const [name, path] of [
    ['my-work', '/api/my-work'], ['portfolio', '/api/portfolio'],
    ['planning', `/api/projects/${project.id}/planning-summary`],
    ['milestone', `/api/projects/${project.id}/milestones/${milestone.id}/review`],
    ['cycle', `/api/projects/${project.id}/cycles/${cycle.id}/review`]
  ]) {
    for (const temperature of ['cold', 'warm']) {
      queries.length = 0; evaluatedRows = 0; enrichedRows = 0;
      const started = performance.now();
      const response = await request(app).get(path!).set({ 'x-worktrail-workspace-id': workspaceId, 'x-worktrail-member-id': f.actor.memberId }).expect(200);
      results.push({ name, temperature, projects: projectCount, workRecords: projectCount * 60, evaluatedRows, enrichedRows,
        statements: queries.length, payloadBytes: Buffer.byteLength(response.text), elapsedMs: Number((performance.now() - started).toFixed(2)) });
      expect(queries.filter(query => /^begin /i.test(query))).toHaveLength(1);
      expect(queries.filter(query => /^commit$/i.test(query))).toHaveLength(1);
      expect(response.text).not.toContain('Aggregate private authored source');
      expect(queries.length).toBeLessThanOrEqual(20);
      expect(queries.some(query => query.includes('"work_items"."description"'))).toBe(false);
      expect(evaluatedRows).toBe(name === 'portfolio' || name === 'my-work' ? projectCount * 60 : 60);
      expect(enrichedRows).toBeLessThanOrEqual(name === 'my-work' ? 48 : name === 'planning' ? 35 : name === 'milestone' ? 43 : name === 'cycle' ? 53 : 0);
      if (name === 'portfolio') {
        expect(response.body.projects).toHaveLength(projectCount);
        for (const table of ['milestones', 'project_cycles', 'project_status_reports']) {
          expect(queries.filter(query => query.includes('from "' + table + '"'))).toHaveLength(1);
        }
        expect(queries.some(query => query.includes('"project_status_reports"."summary"'))).toBe(false);
      }
      const smaller = results.find(row => row.name === name && row.temperature === temperature && row.projects === 1);
      if (smaller) expect(queries.length).toBe(smaller.statements);
    }
  }
  console.log('AGGREGATE_EVIDENCE', JSON.stringify(results));
});
