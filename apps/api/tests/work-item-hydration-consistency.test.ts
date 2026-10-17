import { randomUUID } from 'node:crypto';

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { createDb, createPool } from '../src/db/client.js';
import { workItems } from '../src/db/schema.js';
import { createRepositories } from '../src/repositories/index.js';
import { createPersistence } from '../src/repositories/persistence.js';
import { WorkItemQueryService } from '../src/services/work-item-query-service.js';
import { WorkItemCsvExportService } from '../src/services/work-item-csv-export-service.js';
import { parseCsvRecords } from '../src/services/csv/parse-csv-records.js';
import { createHydrationFixture } from './support/hydration-fixture.js';
import { cleanupWorkspace } from './support/workspace-fixtures.js';

let pool: ReturnType<typeof createPool>;
let db: ReturnType<typeof createDb>;
const workspaceIds = new Set<string>();

async function fixture() {
  const id = randomUUID();
  workspaceIds.add(id);
  return createHydrationFixture(db, 10, id);
}

describe('batched read consistency and export parity', () => {
  beforeAll(() => { pool = createPool(); db = createDb(pool); });
  afterEach(async () => {
    for (const id of workspaceIds) await cleanupWorkspace(pool, id);
    workspaceIds.clear();
  });
  afterAll(async () => { await pool.end(); });

  it.each(['project', 'workspace'] as const)('keeps %s window, references and graph evidence on the enclosing snapshot', async (scopeKind) => {
    const f = await fixture();
    const repositories = createRepositories(db);
    const persistence = createPersistence(db);
    const projectId = f.projects[0]!.id;
    const parent = f.workItems[0]!;
    const child = f.workItems[2]!;
    const labels = await repositories.labels.listByWorkItem(parent.id);
    await persistence.readConsistent(async (scope) => {
      expect(await scope.repositories.workItems.countByProjectQuery(projectId, {})).toBe(10);
      await persistence.write(async ({ repositories: current }) => {
        const updatedAt = new Date();
        await current.members.update(f.actor.memberId, { name: 'New member name', updatedAt });
        await current.milestones.update(parent.milestoneId!, { name: 'New milestone', updatedAt });
        await current.projectCycles.update(parent.cycleId!, { name: 'New cycle', updatedAt });
        await current.labels.update(labels[0]!.id, { name: 'New label', updatedAt });
        await current.workItems.update(parent.id, { title: 'New parent title', status: 'done', updatedAt });
        const edge = await current.workItemRelationships.findBetween({
          workspaceId: f.workspaceId,
          relationshipType: 'blocks', sourceWorkItemId: f.workItems[1]!.id, targetWorkItemId: child.id
        });
        await current.workItemRelationships.delete(edge!.id);
      });
      const query = new WorkItemQueryService({ actor: f.actor, persistence: scope.persistence });
      const page = scopeKind === 'project' ? await query.listWorkItemPage(projectId)
        : await query.listWorkspaceWorkItemPage({ archivedProjects: 'include' });
      const row = page.items.find((item) => item.id === child.id)!;
      expect(row).toMatchObject({
        reporter: { name: 'Person 0' }, assignee: { name: 'Person 0' },
        milestone: { name: 'Milestone 0' }, cycle: { name: 'Cycle 0' },
        parent: { title: 'Hydrated item 1' }, openBlockerCount: 1
      });
      expect(row.labels.map((label) => label.name)).not.toContain('New label');
    });
    const current = await new WorkItemQueryService({ actor: f.actor, persistence }).listWorkItemPage(projectId);
    expect(current.items.find((item) => item.id === child.id)).toMatchObject({
      reporter: { name: 'New member name' },
      milestone: { name: 'New milestone' }, cycle: { name: 'New cycle' }, parent: { title: 'New parent title' }, openBlockerCount: 0
    });
  });

  it('keeps interactive and export projections narrow while full detail rows retain authored source', async () => {
    const f = await fixture();
    const repositories = createRepositories(db);
    const projectId = f.projects[0]!.id;
    const [pageRow] = await repositories.workItems.listPageByProject(projectId, {}, { limit: 10, offset: 0 });
    const [exportRow] = await repositories.workItems.listByProjectForExport(projectId, {}, 11);
    const [workspacePage] = await repositories.workItems.listPageByWorkspace(f.workspaceId, {}, { limit: 10, offset: 0 });
    const [workspaceExport] = await repositories.workItems.listByWorkspaceForExport(f.workspaceId, {}, 11);
    for (const row of [pageRow, exportRow, workspacePage?.workItem, workspaceExport?.workItem]) {
      expect(row).toBeDefined();
      expect(row).not.toHaveProperty('description');
      expect(row).not.toHaveProperty('descriptionFormat');
    }
    const full = await repositories.workItems.findById(pageRow!.id);
    expect(full?.description).toContain('Private authored source');
  });

  it('does not hydrate a foreign project summary even for an inconsistent stored project reference', async () => {
    const f = await fixture();
    const foreign = await fixture();
    await db.insert(workItems).values({
      ...f.workItems[0]!, id: randomUUID(), projectId: foreign.projects[0]!.id,
      itemNumber: 99, displayKey: 'CORRUPT-99'
    });
    const page = await new WorkItemQueryService({ actor: f.actor, persistence: createPersistence(db) })
      .listWorkspaceWorkItemPage({ archivedProjects: 'include' });
    expect(page.totalCount).toBe(20);
    expect(page.items).toHaveLength(20);
    expect(page.items.some((row) => row.project.id === foreign.projects[0]!.id)).toBe(false);
  });

  it.each(['project', 'workspace'] as const)('exports the full filtered %s result in identical order, not only a page', async (scopeKind) => {
    const f = await fixture();
    const context = { actor: f.actor, persistence: createPersistence(db), repositories: createRepositories(db) };
    const projectId = f.projects[0]!.id;
    const query = {
      projectId, status: 'ready' as const, dependency: 'dependency_blocked' as const,
      archivedProjects: 'include' as const, sort: 'created_desc' as const
    };
    const service = new WorkItemQueryService(context);
    const expected = scopeKind === 'project' ? await service.listWorkItems(projectId, query)
      : await service.listWorkspaceWorkItems(query);
    const exporter = new WorkItemCsvExportService(context);
    const result = scopeKind === 'project' ? await exporter.exportProjectWorkItems(projectId, query)
      : await exporter.exportWorkspaceWorkItems(query);
    const headers = result.csv.split('\n')[0]!.split(',');
    expect(headers).toHaveLength(19);
    const parsed = parseCsvRecords(result.csv, { requiredHeaders: headers, allowedHeaders: headers });
    expect(parsed.records.map((row) => row.values['display_key'])).toEqual(expected.map((row) => row.displayKey));
    expect(parsed.records).toHaveLength(9);
    expect(parsed.records.map((row) => row.values['reporter_name'])).toEqual(expected.map((row) => row.reporter.name));
    expect(parsed.records.map((row) => row.values['cycle_name'])).toEqual(expected.map((row) => row.cycle?.name));
    expect(result.csv).not.toContain('Private authored source');
  });

  it('hydrates a real export across the 500-row chunk boundary inside one read-only transaction', async () => {
    const f = await fixture();
    const parent = f.workItems[0]!;
    await db.insert(workItems).values(Array.from({ length: 491 }, (_, index) => ({
      ...parent, id: randomUUID(), itemNumber: index + 11, displayKey: `HYD0-${index + 11}`, type: 'task' as const,
      parentWorkItemId: parent.id, updatedAt: new Date(new Date('2026-10-17T12:00:10Z').getTime() + index * 1000)
    })));
    const queries: string[] = [];
    const measuredDb = createDb(pool, { logger: { logQuery: (query) => { queries.push(query); } } });
    const context = { actor: f.actor, repositories: createRepositories(measuredDb), persistence: createPersistence(measuredDb) };
    const result = await new WorkItemCsvExportService(context).exportProjectWorkItems(f.projects[0]!.id, { sort: 'updated_asc' });
    const headers = result.csv.split('\n')[0]!.split(',');
    const parsed = parseCsvRecords(result.csv, { requiredHeaders: headers, allowedHeaders: headers });
    expect(parsed.records.map((row) => row.values['display_key'])).toEqual(Array.from({ length: 501 }, (_, index) => `HYD0-${index + 1}`));
    expect(parsed.records[500]?.values['parent_key']).toBe('HYD0-1');
    expect(queries.filter((query) => /^begin /i.test(query))).toHaveLength(1);
    expect(queries.filter((query) => /^commit$/i.test(query))).toHaveLength(1);
    expect(queries.filter((query) => /from "members"/.test(query))).toHaveLength(2);
    expect(queries.length).toBeLessThanOrEqual(18);
  });
});
