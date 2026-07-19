import 'dotenv/config';

import type { PoolClient, QueryResultRow } from 'pg';

import { createPool } from './client.js';

const workspaceId = '10000000-0000-4000-8000-000000000001';
const ownerId = '10000000-0000-4000-8000-000000000101';
const maintainerId = '10000000-0000-4000-8000-000000000102';
const reliabilityLabelId = '10000000-0000-4000-8000-000000000304';
const performanceProjectId = 'f0000000-0000-4000-8000-000000000001';
const archivedProjectId = 'f0000000-0000-4000-8000-000000000002';
const milestoneId = 'f0000000-0000-4000-8000-000000000003';
const cycleId = 'f0000000-0000-4000-8000-000000000004';

interface ExplainPlan {
  'Node Type': string;
  'Index Name'?: string;
  'Actual Rows'?: number;
  'Actual Total Time'?: number;
  Plans?: ExplainPlan[];
}

interface ExplainDocument {
  Plan: ExplainPlan;
  'Planning Time': number;
  'Execution Time': number;
}

interface EvidenceQuery {
  id: string;
  description: string;
  sql: string;
  params?: unknown[];
  requiresLimit?: boolean;
  requiresTrigram?: boolean;
  demonstrateIndexSupport?: boolean;
}

interface EvidenceResult {
  query: EvidenceQuery;
  document: ExplainDocument;
  nodeTypes: string[];
  indexNames: string[];
}

const evidenceQueries: EvidenceQuery[] = [
  {
    id: 'project-updated-page',
    description: 'Common project updated sort, first page',
    sql: `
      select id, display_key, title, status, updated_at
      from work_items
      where project_id = $1
      order by updated_at desc, item_number asc, id asc
      limit 25
    `,
    params: [performanceProjectId],
    requiresLimit: true
  },
  {
    id: 'workspace-updated-page',
    description: 'Active workspace updated sort, first page',
    sql: `
      select wi.id, wi.display_key, wi.title, p.key, wi.updated_at
      from work_items wi
      inner join projects p on p.id = wi.project_id
      where wi.workspace_id = $1 and p.status = 'active'
      order by wi.updated_at desc, p.key asc, wi.item_number asc, wi.id asc
      limit 25
    `,
    params: [workspaceId],
    requiresLimit: true
  },
  {
    id: 'substring-search',
    description: 'Title, description, and display-key substring search',
    sql: `
      select id, display_key, title
      from work_items
      where display_key ilike '%indexable-needle-unique%'
        or title ilike '%indexable-needle-unique%'
        or description ilike '%indexable-needle-unique%'
      order by updated_at desc, item_number asc, id asc
      limit 25
    `,
    requiresLimit: true,
    requiresTrigram: true,
    demonstrateIndexSupport: true
  },
  {
    id: 'broad-exact-count',
    description: 'Exact count across active workspace projects',
    sql: `
      select count(*)
      from work_items wi
      inner join projects p on p.id = wi.project_id
      where wi.workspace_id = $1 and p.status = 'active'
    `,
    params: [workspaceId]
  },
  {
    id: 'label-filter',
    description: 'Label filter using a correlated existence check',
    sql: `
      select wi.id, wi.display_key
      from work_items wi
      where wi.project_id = $1
        and exists (
          select 1
          from work_item_labels wil
          where wil.work_item_id = wi.id and wil.label_id = $2
        )
      order by wi.updated_at desc, wi.item_number asc, wi.id asc
      limit 25
    `,
    params: [performanceProjectId, reliabilityLabelId],
    requiresLimit: true
  },
  {
    id: 'dependency-filter',
    description: 'Open dependency-blocked work',
    sql: `
      select wi.id, wi.display_key
      from work_items wi
      where wi.project_id = $1
        and exists (
          select 1
          from work_item_relationships wir
          inner join work_items blocker on blocker.id = wir.source_work_item_id
          where wir.relationship_type = 'blocks'
            and wir.target_work_item_id = wi.id
            and blocker.status not in ('done', 'canceled')
        )
      order by wi.updated_at desc, wi.item_number asc, wi.id asc
      limit 25
    `,
    params: [performanceProjectId],
    requiresLimit: true
  },
  {
    id: 'hierarchy-filter',
    description: 'Direct children for a known parent',
    sql: `
      select id, display_key
      from work_items
      where project_id = $1 and parent_work_item_id = md5('worktrail-perf-work-1')::uuid
      order by updated_at desc, item_number asc, id asc
      limit 25
    `,
    params: [performanceProjectId],
    requiresLimit: true
  },
  {
    id: 'archived-project-filter',
    description: 'Workspace work from archived projects only',
    sql: `
      select wi.id, wi.display_key, p.key
      from work_items wi
      inner join projects p on p.id = wi.project_id
      where wi.workspace_id = $1 and p.status = 'archived'
      order by wi.updated_at desc, p.key asc, wi.item_number asc, wi.id asc
      limit 25
    `,
    params: [workspaceId],
    requiresLimit: true
  },
  {
    id: 'deep-offset-page',
    description: 'Project updated sort at offset 7,500',
    sql: `
      select id, display_key, title, updated_at
      from work_items
      where project_id = $1
      order by updated_at desc, item_number asc, id asc
      limit 25 offset 7500
    `,
    params: [performanceProjectId],
    requiresLimit: true
  }
];

function flattenPlans(plan: ExplainPlan): ExplainPlan[] {
  return [plan, ...(plan.Plans ?? []).flatMap(flattenPlans)];
}

function explainDocument(row: QueryResultRow | undefined): ExplainDocument {
  const value = row?.['QUERY PLAN'] as ExplainDocument[] | string | undefined;
  const parsed = typeof value === 'string' ? (JSON.parse(value) as ExplainDocument[]) : value;
  const document = parsed?.[0];

  if (document === undefined) {
    throw new Error('PostgreSQL did not return an EXPLAIN document.');
  }

  return document;
}

async function createRepresentativeFixture(client: PoolClient): Promise<void> {
  const seed = await client.query<{ workspace_exists: boolean }>(
    'select exists(select 1 from workspaces where id = $1) as workspace_exists',
    [workspaceId]
  );

  if (seed.rows[0]?.workspace_exists !== true) {
    throw new Error('Deterministic seed is required. Run npm run db:seed first.');
  }

  await client.query(
    `
      insert into projects (
        id, workspace_id, key, next_work_item_number, name, description, status, created_at, updated_at
      ) values
        ($1, $3, 'PERF', 10001, 'Temporary Performance Evidence',
         'Rolled-back representative project data.', 'active', now(), now()),
        ($2, $3, 'PARC', 101, 'Temporary Archived Performance Evidence',
         'Rolled-back archived project data.', 'archived', now(), now())
    `,
    [performanceProjectId, archivedProjectId, workspaceId]
  );

  await client.query(
    `
      insert into milestones (
        id, workspace_id, project_id, name, description, status, target_date, created_at, updated_at
      ) values ($1, $2, $3, 'Performance milestone', 'Temporary benchmark milestone.',
        'active', current_date + 30, now(), now())
    `,
    [milestoneId, workspaceId, performanceProjectId]
  );

  await client.query(
    `
      insert into project_cycles (
        id, workspace_id, project_id, name, goal, status, start_date, end_date,
        target_points, created_at, updated_at
      ) values ($1, $2, $3, 'Performance cycle', 'Temporary benchmark cycle.', 'active',
        current_date, current_date + 14, 100, now(), now())
    `,
    [cycleId, workspaceId, performanceProjectId]
  );

  await client.query(
    `
      insert into work_items (
        id, workspace_id, project_id, item_number, display_key, title, description,
        type, status, priority, assignee_id, reporter_id, milestone_id, cycle_id,
        board_position, due_date, estimate_points, created_at, updated_at
      )
      select
        md5('worktrail-perf-work-' || generated)::uuid,
        $1,
        $2,
        generated,
        'PERF-' || generated,
        case when generated = 10000
          then 'Indexable-needle-unique representative work'
          when generated % 250 = 0
          then 'Indexable-needle representative work ' || generated
          else 'Generated performance work item ' || generated end,
        case when generated = 9999
          then 'Description containing indexable-needle-unique for search evidence.'
          when generated % 333 = 0
          then 'Description containing indexable-needle for search evidence.'
          else 'Representative generated description for bounded query evidence.' end,
        (array['task', 'bug', 'story', 'chore'])[(generated % 4) + 1],
        (array['backlog', 'ready', 'in_progress', 'blocked', 'done', 'canceled'])[(generated % 6) + 1],
        (array['low', 'medium', 'high', 'urgent'])[(generated % 4) + 1],
        case when generated % 5 = 0 then null when generated % 2 = 0 then $3::uuid else $4::uuid end,
        $3,
        case when generated % 3 = 0 then $5::uuid else null end,
        case when generated % 2 = 0 then $6::uuid else null end,
        generated * 1024,
        case when generated % 4 = 0 then current_date + ((generated % 45) - 15) else null end,
        case when generated % 6 = 0 then null else (array[1, 2, 3, 5, 8])[(generated % 5) + 1] end,
        now() - (generated * interval '2 seconds'),
        now() - (generated * interval '1 second')
      from generate_series(1, 10000) generated
    `,
    [workspaceId, performanceProjectId, ownerId, maintainerId, milestoneId, cycleId]
  );

  await client.query(
    `
      update work_items
      set parent_work_item_id = md5('worktrail-perf-work-1')::uuid
      where project_id = $1 and item_number between 2 and 101
    `,
    [performanceProjectId]
  );

  await client.query(
    `
      insert into work_item_labels (work_item_id, label_id)
      select md5('worktrail-perf-work-' || generated)::uuid, $1
      from generate_series(20, 10000, 20) generated
    `,
    [reliabilityLabelId]
  );

  await client.query(
    `
      insert into work_item_relationships (
        id, workspace_id, relationship_type, source_work_item_id, target_work_item_id,
        created_by_id, created_at
      )
      select
        md5('worktrail-perf-relationship-' || generated)::uuid,
        $1,
        'blocks',
        md5('worktrail-perf-work-' || (generated * 2))::uuid,
        md5('worktrail-perf-work-' || ((generated * 2) + 1))::uuid,
        $2,
        now()
      from generate_series(1, 100) generated
    `,
    [workspaceId, ownerId]
  );

  await client.query(
    `
      insert into work_items (
        id, workspace_id, project_id, item_number, display_key, title, description,
        type, status, priority, reporter_id, board_position, created_at, updated_at
      )
      select
        md5('worktrail-perf-archived-' || generated)::uuid,
        $1,
        $2,
        generated,
        'PARC-' || generated,
        'Archived representative work ' || generated,
        'Temporary archived-project query evidence.',
        'task',
        'done',
        'medium',
        $3,
        generated * 1024,
        now() - (generated * interval '2 seconds'),
        now() - (generated * interval '1 second')
      from generate_series(1, 100) generated
    `,
    [workspaceId, archivedProjectId, ownerId]
  );

  await client.query(
    'analyze projects, work_items, work_item_labels, work_item_relationships'
  );
}

async function captureEvidence(client: PoolClient): Promise<EvidenceResult[]> {
  const results: EvidenceResult[] = [];

  for (const query of evidenceQueries) {
    if (query.demonstrateIndexSupport === true) {
      await client.query('set local enable_seqscan = off');
      await client.query('set local enable_indexscan = off');
    }

    const explained = await client.query(
      `explain (analyze, buffers, format json) ${query.sql}`,
      query.params
    );

    if (query.demonstrateIndexSupport === true) {
      await client.query('set local enable_seqscan = on');
      await client.query('set local enable_indexscan = on');
    }
    const document = explainDocument(explained.rows[0]);
    const plans = flattenPlans(document.Plan);
    const nodeTypes = [...new Set(plans.map((plan) => plan['Node Type']))];
    const indexNames = [
      ...new Set(
        plans
          .map((plan) => plan['Index Name'])
          .filter((indexName): indexName is string => indexName !== undefined)
      )
    ];

    if (query.requiresLimit === true && !nodeTypes.includes('Limit')) {
      throw new Error(`${query.id} did not contain a finite Limit plan node.`);
    }

    if (
      query.requiresTrigram === true &&
      !indexNames.some((indexName) => indexName.endsWith('_trgm_idx'))
    ) {
      throw new Error(
        `${query.id} did not use a work-item trigram index. Nodes: ${nodeTypes.join(', ')}. Indexes: ${indexNames.join(', ') || 'none'}.`
      );
    }

    results.push({ query, document, nodeTypes, indexNames });
  }

  return results;
}

function printEvidence(results: EvidenceResult[]): void {
  console.log('# Worktrail PostgreSQL performance evidence');
  console.log('');
  console.log('Temporary rows: 10,000 active-project items plus 100 archived-project items.');
  console.log('All fixture writes are rolled back after measurement.');
  console.log(
    'The search plan disables sequential and plain index scans only for that EXPLAIN to prove the current OR/ILIKE semantics are supported by trigram bitmap indexes at local-fixture scale.'
  );
  console.log('');
  console.log('| Query | Planning | Execution | Root rows | Plan nodes | Indexes |');
  console.log('| --- | ---: | ---: | ---: | --- | --- |');

  for (const result of results) {
    const rootRows = result.document.Plan['Actual Rows'] ?? 0;
    const indexes = result.indexNames.length > 0 ? result.indexNames.join(', ') : 'none';
    console.log(
      `| ${result.query.id}: ${result.query.description} | ${result.document['Planning Time'].toFixed(3)} ms | ${result.document['Execution Time'].toFixed(3)} ms | ${rootRows} | ${result.nodeTypes.join(', ')} | ${indexes} |`
    );
  }
}

const pool = createPool();
const client = await pool.connect();

try {
  await client.query('begin');
  await createRepresentativeFixture(client);
  const results = await captureEvidence(client);
  printEvidence(results);
} finally {
  await client.query('rollback').catch(() => undefined);
  await client
    .query('analyze projects, work_items, work_item_labels, work_item_relationships')
    .catch(() => undefined);
  client.release();
  await pool.end();
}
