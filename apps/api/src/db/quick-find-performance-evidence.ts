import 'dotenv/config';

import { performance } from 'node:perf_hooks';

import type { PoolClient, QueryResultRow } from 'pg';

import { createQuickFindRepository } from '../repositories/quick-find-repository.js';
import { createDb, createPool } from './client.js';

const workspaceId = '10000000-0000-4000-8000-000000000001';
const ownerId = '10000000-0000-4000-8000-000000000101';
const fixtureRowCount = 2_000;
const aggregateTargetMs = 300;
const aggregateQuery = 'qf-index-needle-unique';
const aggregateExactPattern = aggregateQuery;
const aggregatePrefixPattern = `${aggregateQuery}%`;
const aggregateSubstringPattern = `%${aggregateQuery}%`;

interface ExplainPlan {
  'Node Type': string;
  'Index Name'?: string;
  'Actual Rows'?: number;
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
  params: unknown[];
  expectedTrigramIndexes?: string[];
  trigramProofSql?: string;
  forceBitmapProof?: boolean;
}

interface EvidenceResult {
  query: EvidenceQuery;
  document: ExplainDocument;
  nodeTypes: string[];
  indexNames: string[];
}

const groupQueries: EvidenceQuery[] = [
  {
    id: 'projects-normal',
    description: 'Projects grouped search with key, name, and description tiers',
    sql: `
      select id, key, name, status
      from projects
      where workspace_id = $1
        and (
          key ilike $3 escape '\\'
          or name ilike $4 escape '\\'
          or description ilike $4 escape '\\'
        )
      order by
        case
          when key ilike $2 escape '\\' then 0
          when key ilike $3 escape '\\' then 1
          when name ilike $2 escape '\\' then 2
          when name ilike $3 escape '\\' then 3
          when name ilike $4 escape '\\' then 4
          when description ilike $4 escape '\\' then 5
          else 6
        end,
        case when status = 'archived' then 1 else 0 end,
        lower(name),
        lower(key),
        id
      limit 6
    `,
    params: [
      workspaceId,
      aggregateExactPattern,
      aggregatePrefixPattern,
      aggregateSubstringPattern
    ],
    expectedTrigramIndexes: [
      'projects_name_trgm_idx',
      'projects_description_trgm_idx'
    ],
    trigramProofSql: `
      select id
      from projects
      where name ilike $1 escape '\\'
        or description ilike $1 escape '\\'
      limit 6
    `
  },
  {
    id: 'work-items-normal',
    description: 'Work items grouped search with explicit work-item/project ownership',
    sql: `
      select wi.id, wi.display_key, wi.title, p.key
      from work_items wi
      inner join projects p
        on p.id = wi.project_id and p.workspace_id = wi.workspace_id
      where wi.workspace_id = $1
        and p.workspace_id = $1
        and (
          wi.display_key ilike $3 escape '\\'
          or wi.title ilike $4 escape '\\'
          or wi.description ilike $4 escape '\\'
        )
      order by
        case
          when wi.display_key ilike $2 escape '\\' then 0
          when wi.display_key ilike $3 escape '\\' then 1
          when wi.title ilike $2 escape '\\' then 2
          when wi.title ilike $3 escape '\\' then 3
          when wi.title ilike $4 escape '\\' then 4
          when wi.description ilike $4 escape '\\' then 5
          else 6
        end,
        case when p.status = 'archived' then 1 else 0 end,
        lower(wi.title),
        lower(p.key),
        wi.item_number,
        wi.id
      limit 6
    `,
    params: [
      workspaceId,
      aggregateExactPattern,
      aggregatePrefixPattern,
      aggregateSubstringPattern
    ],
    expectedTrigramIndexes: [
      'work_items_display_key_trgm_idx',
      'work_items_title_trgm_idx',
      'work_items_description_trgm_idx'
    ],
    trigramProofSql: `
      select id
      from work_items
      where display_key ilike $1 escape '\\'
        or title ilike $1 escape '\\'
        or description ilike $1 escape '\\'
      limit 6
    `
  },
  {
    id: 'milestones-normal',
    description: 'Milestones grouped search with project ownership and archive context',
    sql: `
      select m.id, m.name, m.status, p.key
      from milestones m
      inner join projects p
        on p.id = m.project_id and p.workspace_id = m.workspace_id
      where m.workspace_id = $1
        and p.workspace_id = $1
        and (
          m.name ilike $4 escape '\\'
          or m.description ilike $4 escape '\\'
        )
      order by
        case
          when m.name ilike $2 escape '\\' then 2
          when m.name ilike $3 escape '\\' then 3
          when m.name ilike $4 escape '\\' then 4
          when m.description ilike $4 escape '\\' then 5
          else 6
        end,
        case when m.archived_at is not null or p.status = 'archived' then 1 else 0 end,
        lower(m.name),
        lower(p.key),
        m.id
      limit 6
    `,
    params: [
      workspaceId,
      aggregateExactPattern,
      aggregatePrefixPattern,
      aggregateSubstringPattern
    ],
    expectedTrigramIndexes: [
      'milestones_name_trgm_idx',
      'milestones_description_trgm_idx'
    ],
    trigramProofSql: `
      select id
      from milestones
      where name ilike $1 escape '\\'
        or description ilike $1 escape '\\'
      limit 6
    `
  },
  {
    id: 'cycles-normal',
    description: 'Cycles grouped name search with project ownership',
    sql: `
      select c.id, c.name, c.status, p.key
      from project_cycles c
      inner join projects p
        on p.id = c.project_id and p.workspace_id = c.workspace_id
      where c.workspace_id = $1
        and p.workspace_id = $1
        and c.name ilike $4 escape '\\'
      order by
        case
          when c.name ilike $2 escape '\\' then 2
          when c.name ilike $3 escape '\\' then 3
          when c.name ilike $4 escape '\\' then 4
          else 6
        end,
        case when c.archived_at is not null or p.status = 'archived' then 1 else 0 end,
        lower(c.name),
        lower(p.key),
        c.id
      limit 6
    `,
    params: [
      workspaceId,
      aggregateExactPattern,
      aggregatePrefixPattern,
      aggregateSubstringPattern
    ],
    expectedTrigramIndexes: ['project_cycles_name_trgm_idx'],
    trigramProofSql: `
      select id
      from project_cycles
      where name ilike $1 escape '\\'
      limit 6
    `
  },
  {
    id: 'reports-normal',
    description: 'Published reports grouped title/summary search',
    sql: `
      select r.id, r.title, r.status_date, p.key,
        case
          when r.snapshot -> 'health' ->> 'health'
            in ('healthy', 'at_risk', 'blocked', 'complete', 'inactive')
            then r.snapshot -> 'health' ->> 'health'
          else null
        end as health
      from project_status_reports r
      inner join projects p
        on p.id = r.project_id and p.workspace_id = r.workspace_id
      where r.workspace_id = $1
        and p.workspace_id = $1
        and (
          r.title ilike $4 escape '\\'
          or r.summary ilike $4 escape '\\'
        )
      order by
        case
          when r.title ilike $2 escape '\\' then 2
          when r.title ilike $3 escape '\\' then 3
          when r.title ilike $4 escape '\\' then 4
          when r.summary ilike $4 escape '\\' then 5
          else 6
        end,
        case when p.status = 'archived' then 1 else 0 end,
        lower(r.title),
        lower(p.key),
        r.id
      limit 6
    `,
    params: [
      workspaceId,
      aggregateExactPattern,
      aggregatePrefixPattern,
      aggregateSubstringPattern
    ],
    expectedTrigramIndexes: [
      'project_status_reports_title_trgm_idx',
      'project_status_reports_summary_trgm_idx'
    ],
    trigramProofSql: `
      select id
      from project_status_reports
      where title ilike $1 escape '\\'
        or summary ilike $1 escape '\\'
      limit 6
    `
  },
  {
    id: 'attachments-normal',
    description: 'Attachment filename search with owning work-item/project context',
    sql: `
      select a.id, a.file_name, a.byte_size, wi.display_key, p.key
      from work_item_attachments a
      inner join work_items wi
        on wi.id = a.work_item_id
        and wi.project_id = a.project_id
        and wi.workspace_id = a.workspace_id
      inner join projects p
        on p.id = wi.project_id and p.workspace_id = wi.workspace_id
      where a.workspace_id = $1
        and wi.workspace_id = $1
        and p.workspace_id = $1
        and a.file_name ilike $4 escape '\\'
      order by
        case
          when a.file_name ilike $2 escape '\\' then 2
          when a.file_name ilike $3 escape '\\' then 3
          when a.file_name ilike $4 escape '\\' then 4
          else 6
        end,
        case when p.status = 'archived' then 1 else 0 end,
        lower(a.file_name),
        lower(p.key),
        wi.item_number,
        a.id
      limit 6
    `,
    params: [
      workspaceId,
      aggregateExactPattern,
      aggregatePrefixPattern,
      aggregateSubstringPattern
    ],
    expectedTrigramIndexes: ['work_item_attachments_file_name_trgm_idx'],
    trigramProofSql: `
      select id
      from work_item_attachments
      where file_name ilike $1 escape '\\'
      limit 6
    `
  }
];

const evidenceQueries: EvidenceQuery[] = [
  ...groupQueries,
  ...groupQueries.map((query) => ({
    ...query,
    id: query.id.replace('-normal', '-trigram-proof'),
    description: `${query.description} (forced bitmap index eligibility)`,
    sql: query.trigramProofSql!,
    params: [aggregateSubstringPattern],
    forceBitmapProof: true
  })),
  {
    ...groupQueries[1]!,
    id: 'work-items-two-character-normal',
    description: 'Broad two-character work-item search under normal planner settings',
    params: [workspaceId, 'qf', 'qf%', '%qf%'],
    expectedTrigramIndexes: undefined
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
    throw new Error('PostgreSQL did not return a Quick Find EXPLAIN document.');
  }

  return document;
}

async function createRepresentativeFixture(client: PoolClient): Promise<void> {
  const seed = await client.query<{ owner_exists: boolean; workspace_exists: boolean }>(
    `select
       exists(select 1 from workspaces where id = $1) as workspace_exists,
       exists(
         select 1 from members where id = $2 and workspace_id = $1 and is_active = true
       ) as owner_exists`,
    [workspaceId, ownerId]
  );

  if (seed.rows[0]?.workspace_exists !== true || seed.rows[0]?.owner_exists !== true) {
    throw new Error('Deterministic seed is required. Run npm run db:seed first.');
  }

  await client.query(
    `
      insert into projects (
        id, workspace_id, key, next_work_item_number, name, description,
        status, created_at, updated_at
      )
      select
        md5('quick-find-project-' || generated)::uuid,
        $1,
        'Q' || lpad(generated::text, 7, '0'),
        2,
        case when generated = $2
          then 'Project qf-index-needle-unique'
          else 'Generated Quick Find project ' || generated end,
        case when generated = $2 - 1
          then 'Project narrative qf-index-needle-unique'
          else 'Representative project search description.' end,
        case when generated % 20 = 0 then 'archived' else 'active' end,
        now(),
        now()
      from generate_series(1, $2) generated
    `,
    [workspaceId, fixtureRowCount]
  );

  await client.query(
    `
      insert into work_items (
        id, workspace_id, project_id, item_number, display_key, title, description,
        type, status, priority, reporter_id, board_position, created_at, updated_at
      )
      select
        md5('quick-find-work-' || generated)::uuid,
        $1,
        md5('quick-find-project-' || generated)::uuid,
        1,
        'Q' || lpad(generated::text, 7, '0') || '-1',
        case when generated = $3
          then 'Work qf-index-needle-unique'
          else 'Generated Quick Find work ' || generated end,
        case when generated = $3 - 1
          then 'Work narrative qf-index-needle-unique'
          else 'Representative work search description.' end,
        'story',
        case when generated % 6 = 0 then 'done' else 'in_progress' end,
        'medium',
        $2,
        generated,
        now(),
        now()
      from generate_series(1, $3) generated
    `,
    [workspaceId, ownerId, fixtureRowCount]
  );

  await client.query(
    `
      insert into milestones (
        id, workspace_id, project_id, name, description, status, target_date,
        archived_at, created_at, updated_at
      )
      select
        md5('quick-find-milestone-' || generated)::uuid,
        $1,
        md5('quick-find-project-' || generated)::uuid,
        case when generated = $2
          then 'Milestone qf-index-needle-unique'
          else 'Generated Quick Find milestone ' || generated end,
        case when generated = $2 - 1
          then 'Milestone narrative qf-index-needle-unique'
          else 'Representative milestone search description.' end,
        case when generated % 5 = 0 then 'completed' else 'active' end,
        current_date + (generated % 60),
        case when generated % 25 = 0 then now() else null end,
        now(),
        now()
      from generate_series(1, $2) generated
    `,
    [workspaceId, fixtureRowCount]
  );

  await client.query(
    `
      insert into project_cycles (
        id, workspace_id, project_id, name, goal, status, start_date, end_date,
        target_points, archived_at, created_at, updated_at
      )
      select
        md5('quick-find-cycle-' || generated)::uuid,
        $1,
        md5('quick-find-project-' || generated)::uuid,
        case when generated = $2
          then 'Cycle qf-index-needle-unique'
          else 'Generated Quick Find cycle ' || generated end,
        'Cycle goals are deliberately not searched.',
        'planned',
        current_date + (generated % 30),
        current_date + (generated % 30) + 14,
        20,
        case when generated % 25 = 0 then now() else null end,
        now(),
        now()
      from generate_series(1, $2) generated
    `,
    [workspaceId, fixtureRowCount]
  );

  await client.query(
    `
      insert into project_status_reports (
        id, workspace_id, project_id, author_member_id, title, status_date,
        summary, highlights, risks, next_steps, snapshot, published_at, created_at
      )
      select
        md5('quick-find-report-' || generated)::uuid,
        $1,
        md5('quick-find-project-' || generated)::uuid,
        $2,
        case when generated = $3
          then 'Report qf-index-needle-unique'
          else 'Generated Quick Find report ' || generated end,
        current_date - (generated % 30),
        case when generated = $3 - 1
          then 'Report summary qf-index-needle-unique'
          else 'Representative published report summary.' end,
        '',
        '',
        '',
        jsonb_build_object(
          'health',
          jsonb_build_object(
            'health',
            case when generated % 10 = 0 then 'at_risk' else 'healthy' end
          )
        ),
        now(),
        now()
      from generate_series(1, $3) generated
    `,
    [workspaceId, ownerId, fixtureRowCount]
  );

  await client.query(
    `
      insert into work_item_attachments (
        id, workspace_id, project_id, work_item_id, uploader_member_id,
        file_name, media_type, byte_size, checksum_sha256, storage_key, created_at
      )
      select
        md5('quick-find-attachment-' || generated)::uuid,
        $1,
        md5('quick-find-project-' || generated)::uuid,
        md5('quick-find-work-' || generated)::uuid,
        $2,
        case when generated = $3
          then 'qf-index-needle-unique.txt'
          else 'generated-evidence-' || generated || '.txt' end,
        'text/plain',
        128,
        md5('quick-find-checksum-a-' || generated) ||
          md5('quick-find-checksum-b-' || generated),
        md5('quick-find-storage-a-' || generated) ||
          md5('quick-find-storage-b-' || generated),
        now()
      from generate_series(1, $3) generated
    `,
    [workspaceId, ownerId, fixtureRowCount]
  );

  await client.query(
    `analyze projects, work_items, milestones, project_cycles,
      project_status_reports, work_item_attachments`
  );
}

async function captureEvidence(client: PoolClient): Promise<EvidenceResult[]> {
  const results: EvidenceResult[] = [];

  for (const query of evidenceQueries) {
    if (query.forceBitmapProof === true) {
      await client.query('set local enable_seqscan = off');
      await client.query('set local enable_indexscan = off');
    }

    const explained = await client.query(
      `explain (analyze, buffers, format json) ${query.sql}`,
      query.params
    );

    if (query.forceBitmapProof === true) {
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

    if (!nodeTypes.includes('Limit')) {
      throw new Error(`${query.id} did not contain a finite Limit plan node.`);
    }

    if (
      query.forceBitmapProof === true &&
      query.expectedTrigramIndexes !== undefined &&
      !query.expectedTrigramIndexes.some((indexName) => indexNames.includes(indexName))
    ) {
      throw new Error(
        `${query.id} did not prove an expected trigram index. Nodes: ${nodeTypes.join(', ')}. Indexes: ${indexNames.join(', ') || 'none'}.`
      );
    }

    results.push({ query, document, nodeTypes, indexNames });
  }

  return results;
}

async function measureAggregate(client: PoolClient): Promise<number[]> {
  const db = createDb(client as unknown as ReturnType<typeof createPool>);
  const repository = createQuickFindRepository(db);
  const run = async () => {
    const startedAt = performance.now();
    const result = await repository.searchWorkspace({
      workspaceId,
      query: aggregateQuery,
      groupLimit: 5
    });
    const durationMs = performance.now() - startedAt;

    if (Object.values(result).some((group) => group.items.length === 0)) {
      throw new Error('Quick Find aggregate evidence did not return every group.');
    }

    return durationMs;
  };

  await run();
  const warmDurations = [await run(), await run(), await run()];
  const slowestWarmDuration = Math.max(...warmDurations);

  if (slowestWarmDuration >= aggregateTargetMs) {
    throw new Error(
      `Quick Find warm aggregate took ${slowestWarmDuration.toFixed(3)} ms; target is under ${aggregateTargetMs} ms.`
    );
  }

  return warmDurations;
}

function printEvidence(results: EvidenceResult[], warmDurations: number[]): void {
  console.log('# Worktrail Quick Find PostgreSQL performance evidence');
  console.log('');
  console.log(
    `Temporary rows: ${fixtureRowCount.toLocaleString()} per searchable domain under the deterministic workspace.`
  );
  console.log('All fixture writes are rolled back after measurement.');
  console.log(
    'Normal plans are reported unchanged. Trigram-proof plans separately disable sequential and plain index scans only to demonstrate bitmap index eligibility at local-fixture scale.'
  );
  console.log(
    `Warm six-group aggregate target: under ${aggregateTargetMs} ms; runs: ${warmDurations.map((duration) => `${duration.toFixed(3)} ms`).join(', ')}.`
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
  const warmDurations = await measureAggregate(client);
  printEvidence(results, warmDurations);
} finally {
  await client.query('rollback').catch(() => undefined);
  await client
    .query(
      `analyze projects, work_items, milestones, project_cycles,
        project_status_reports, work_item_attachments`
    )
    .catch(() => undefined);
  client.release();
  await pool.end();
}
