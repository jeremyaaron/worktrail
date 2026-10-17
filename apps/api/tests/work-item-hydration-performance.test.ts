import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { WorkItemListPageDto } from '@worktrail/contracts';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { assertOwnedDatabase } from '../../../scripts/verification/ownership.mjs';
import { createExpressApp } from '../src/adapters/express/server.js';
import { createDb, createPool } from '../src/db/client.js';
import { createRepositories } from '../src/repositories/index.js';
import { createPersistence } from '../src/repositories/persistence.js';
import { WorkItemService } from '../src/services/work-item-service.js';
import { createHydrationFixture } from './support/hydration-fixture.js';
import request from './support/local-http.js';
import { cleanupWorkspace } from './support/workspace-fixtures.js';

let pool: ReturnType<typeof createPool>;
let db: ReturnType<typeof createDb>;
const statements: string[] = [];
const workspaceIds = new Set<string>();
const results: Array<{
  scope: string; transport: string; rows: number; referenceMode: string;
  statements: number; payloadBytes: number; elapsedMs: number
}> = [];

describe('complete hydrated page SQL budgets', () => {
  beforeAll(() => {
    pool = createPool();
    db = createDb(pool, { logger: { logQuery: (query) => { statements.push(query); } } });
  });
  afterEach(async () => {
    for (const id of workspaceIds) await cleanupWorkspace(pool, id);
    workspaceIds.clear();
  });
  afterAll(async () => {
    try {
      const manifest = await assertOwnedDatabase(process.env, pool);
      await mkdir(manifest.resultsRoot, { recursive: true });
      await writeFile(join(manifest.resultsRoot, 'hydration-evidence.json'), JSON.stringify(results, null, 2) + '\n');
    } finally {
      await pool.end();
    }
  });

  it.each([
    { size: 10, referenceMode: 'mixed' }, { size: 25, referenceMode: 'mixed' }, { size: 100, referenceMode: 'mixed' },
    { size: 100, referenceMode: 'repeated' }, { size: 100, referenceMode: 'distinct' }
  ] as const)('bounds complete pages at $size rows with $referenceMode references', async ({ size, referenceMode }) => {
    const workspaceId = randomUUID();
    workspaceIds.add(workspaceId);
    const fixture = await createHydrationFixture(db, size, workspaceId, referenceMode);
    const context = { actor: fixture.actor, repositories: createRepositories(db), persistence: createPersistence(db) };
    const service = new WorkItemService(context);
    const app = createExpressApp(context);
    const evidence = [];
    for (const scope of ['project', 'workspace'] as const) {
      let servicePage: WorkItemListPageDto | undefined;
      for (const transport of ['service', 'http'] as const) {
        statements.length = 0;
        const start = performance.now();
        const page: WorkItemListPageDto = transport === 'service'
          ? scope === 'project'
            ? await service.listWorkItemPage(fixture.projects[0]!.id, {}, { page: 1, pageSize: size })
            : await service.listWorkspaceWorkItemPage({ archivedProjects: 'include' }, { page: 1, pageSize: size })
          : (await request(app).get(scope === 'project'
            ? `/api/projects/${fixture.projects[0]!.id}/work-items` : '/api/work-items')
            .set({ 'x-worktrail-workspace-id': workspaceId, 'x-worktrail-member-id': fixture.actor.memberId })
            .query({ page: 1, pageSize: size, archivedProjects: 'include' }).expect(200)).body;
        const measured = {
          scope, transport, rows: page.items.length, referenceMode, statements: statements.length,
          payloadBytes: Buffer.byteLength(JSON.stringify(page)), elapsedMs: Number((performance.now() - start).toFixed(2))
        };
        evidence.push(measured);
        results.push(measured);
        if (transport === 'service') servicePage = page;
        else expect(page).toEqual(servicePage);
        expect(page.items).toHaveLength(size);
        if (referenceMode === 'distinct') {
          expect(new Set(page.items.map((item) => item.reporter.id)).size).toBe(size);
          expect(new Set(page.items.map((item) => item.milestone?.id)).size).toBe(size);
          expect(new Set(page.items.map((item) => item.cycle?.id)).size).toBe(size);
        }
        for (const item of page.items) {
          const raw = fixture.workItems.find((row) => row.id === item.id)!;
          expect(item.reporter.id).toBe(raw.reporterId);
          expect(item.assignee?.id).toBe(raw.assigneeId);
          expect(item.milestone?.id).toBe(raw.milestoneId);
          expect(item.cycle?.id).toBe(raw.cycleId);
          expect(item.parent?.id ?? null).toBe(raw.parentWorkItemId);
          expect(item.labels).toHaveLength(2);
          expect(item.labels.some((label) => label.isArchived)).toBe(true);
          expect(item.openBlockerCount).toBe(raw.itemNumber === 1 ? 0 : 1);
          if (raw.itemNumber === 1) expect(item.childSummary?.totalCount).toBe(size - 1);
        }
        expect(statements.filter((query) => /^begin /i.test(query))).toHaveLength(1);
        expect(statements.filter((query) => /^commit$/i.test(query))).toHaveLength(1);
        expect(JSON.stringify(page)).not.toContain('Private authored source');
      }
    }
    console.log('HYDRATION_EVIDENCE', JSON.stringify(evidence));
    for (const result of evidence) expect(result.statements, `${result.scope}/${result.transport}`).toBeLessThanOrEqual(20);
  });
});
