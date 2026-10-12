import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { asc, sql } from 'drizzle-orm';

import { createDb, createPool } from '../src/db/client.js';
import {
  buildQuickFindMatchSql,
  createQuickFindSearchTerms,
  quickFindExcerptMaxCodePoints,
  quickFindExcerptSql,
  quickFindLifecycleRankSql
} from '../src/repositories/quick-find-sql.js';

const quickFindIndexNames = [
  'projects_name_trgm_idx',
  'projects_description_trgm_idx',
  'milestones_workspace_id_idx',
  'milestones_name_trgm_idx',
  'milestones_description_trgm_idx',
  'project_cycles_name_trgm_idx',
  'project_status_reports_title_trgm_idx',
  'project_status_reports_summary_trgm_idx',
  'work_item_attachments_file_name_trgm_idx'
] as const;

let pool: ReturnType<typeof createPool>;
let db: ReturnType<typeof createDb>;

beforeAll(() => {
  pool = createPool();
  db = createDb(pool);
});

afterAll(async () => {
  await pool.end();
});

describe('Quick Find migration indexes', () => {
  it('creates only the approved searchable-field and milestone tenant indexes', async () => {
    const result = await pool.query<{ indexdef: string; indexname: string }>(
      `select indexname, indexdef
       from pg_indexes
       where schemaname = 'public'
         and indexname = any($1::text[])
       order by indexname`,
      [[...quickFindIndexNames]]
    );

    expect(result.rows.map((row) => row.indexname)).toEqual([...quickFindIndexNames].sort());

    const definitions = new Map(result.rows.map((row) => [row.indexname, row.indexdef]));
    expect(definitions.get('milestones_workspace_id_idx')).toContain(
      'USING btree (workspace_id)'
    );

    for (const indexName of quickFindIndexNames.filter((name) => name.endsWith('_trgm_idx'))) {
      expect(definitions.get(indexName)).toContain('USING gin');
      expect(definitions.get(indexName)).toContain('gin_trgm_ops');
    }
  });
});

describe('Quick Find SQL matching', () => {
  it('applies all relevance tiers, metadata precedence, lifecycle ordering, and bounded excerpts', async () => {
    const terms = createQuickFindSearchTerms('WT');
    const candidateId = sql.identifier('candidate_id');
    const candidateKey = sql.identifier('candidate_key');
    const primaryText = sql.identifier('primary_text');
    const narrativeText = sql.identifier('narrative_text');
    const isArchived = sql.identifier('is_archived');
    const match = buildQuickFindMatchSql({
      terms,
      key: { column: candidateKey, matchField: 'work_item_key' },
      primary: { column: primaryText, matchField: 'work_item_title' },
      narrative: { column: narrativeText, matchField: 'work_item_description' }
    });
    const lifecycleRank = quickFindLifecycleRankSql(isArchived);
    const query = db
      .select({
        id: sql<string>`${candidateId}`,
        relevanceRank: match.relevanceRank,
        lifecycleRank,
        matchField: match.matchField,
        matchMode: match.matchMode,
        excerpt: match.excerpt
      })
      .from(sql`(
        values
          ('key-exact', 'WT', 'WT also matches title', '', false),
          ('key-prefix', 'WTX', 'Unrelated title', '', false),
          ('primary-exact-active', 'ZZ', 'WT', '', false),
          ('primary-exact-archived', 'ZA', 'WT', '', true),
          ('primary-prefix', 'ZY', 'WT launch', '', false),
          ('primary-substring', 'ZX', 'New WT launch', '', false),
          (
            'narrative-substring',
            'ZQ',
            'Unrelated title',
            'Context before the match has irregular    spacing and a newline
             before WT appears in the narrative.',
            false
          ),
          ('no-match', 'AA', 'Another title', 'Another narrative', false)
      ) as candidates(candidate_id, candidate_key, primary_text, narrative_text, is_archived)`)
      .where(match.condition)
      .orderBy(
        asc(match.relevanceRank),
        asc(lifecycleRank),
        asc(sql`${candidateId}`)
      );

    const generated = query.toSQL();
    expect(generated.sql).not.toContain(`ilike '${terms.query}`);
    expect(generated.sql).toMatch(/ilike \$\d+ escape '\\'/);
    expect(generated.params).toContain(terms.exactPattern);
    expect(generated.params).toContain(terms.prefixPattern);
    expect(generated.params).toContain(terms.substringPattern);

    const rows = await query;

    expect(rows.map((row) => row.id)).toEqual([
      'key-exact',
      'key-prefix',
      'primary-exact-active',
      'primary-exact-archived',
      'primary-prefix',
      'primary-substring',
      'narrative-substring'
    ]);
    expect(
      rows.map(({ relevanceRank, lifecycleRank, matchField, matchMode }) => ({
        relevanceRank,
        lifecycleRank,
        matchField,
        matchMode
      }))
    ).toEqual([
      {
        relevanceRank: 0,
        lifecycleRank: 0,
        matchField: 'work_item_key',
        matchMode: 'exact'
      },
      {
        relevanceRank: 1,
        lifecycleRank: 0,
        matchField: 'work_item_key',
        matchMode: 'prefix'
      },
      {
        relevanceRank: 2,
        lifecycleRank: 0,
        matchField: 'work_item_title',
        matchMode: 'exact'
      },
      {
        relevanceRank: 2,
        lifecycleRank: 1,
        matchField: 'work_item_title',
        matchMode: 'exact'
      },
      {
        relevanceRank: 3,
        lifecycleRank: 0,
        matchField: 'work_item_title',
        matchMode: 'prefix'
      },
      {
        relevanceRank: 4,
        lifecycleRank: 0,
        matchField: 'work_item_title',
        matchMode: 'substring'
      },
      {
        relevanceRank: 5,
        lifecycleRank: 0,
        matchField: 'work_item_description',
        matchMode: 'substring'
      }
    ]);
    expect(rows.slice(0, 6).every((row) => row.excerpt === null)).toBe(true);
    expect(rows[6]?.excerpt).toBe(
      '...before the match has irregular spacing and a newline before WT appears in the narrative.'
    );
    expect(rows[6]?.excerpt).not.toContain('  ');
  });

  it('starts non-key entities at primary-field rank two', async () => {
    const terms = createQuickFindSearchTerms('Cloud');
    const primaryText = sql.identifier('primary_text');
    const match = buildQuickFindMatchSql({
      terms,
      primary: { column: primaryText, matchField: 'milestone_name' }
    });
    const rows = await db
      .select({
        relevanceRank: match.relevanceRank,
        matchField: match.matchField,
        matchMode: match.matchMode,
        excerpt: match.excerpt
      })
      .from(sql`(values ('Cloud')) as candidates(primary_text)`)
      .where(match.condition);

    expect(rows).toEqual([
      {
        relevanceRank: 2,
        matchField: 'milestone_name',
        matchMode: 'exact',
        excerpt: null
      }
    ]);
  });

  it('treats percent, underscore, and backslash as literal query characters', async () => {
    const terms = createQuickFindSearchTerms('100%_ready\\later');
    const primaryText = sql.identifier('primary_text');
    const match = buildQuickFindMatchSql({
      terms,
      primary: { column: primaryText, matchField: 'attachment_file_name' }
    });
    const rows = await db
      .select({
        value: sql<string>`${primaryText}`,
        relevanceRank: match.relevanceRank
      })
      .from(sql`(
        values
          ('100%_ready\\later'),
          ('100XXready\\later'),
          ('100%Xready\\later'),
          ('100%_readyXlater')
      ) as candidates(primary_text)`)
      .where(match.condition);

    expect(rows).toEqual([
      {
        value: '100%_ready\\later',
        relevanceRank: 2
      }
    ]);
  });

  it('centers narrative excerpts on the match and counts omission markers inside the limit', async () => {
    const query = 'needle';
    const narrative = `${'before '.repeat(30)}${query} ${'after '.repeat(40)}`;
    const narrativeText = sql.identifier('narrative_text');
    const rows = await db
      .select({
        excerpt: quickFindExcerptSql(narrativeText, query)
      })
      .from(sql`(values (${narrative})) as candidates(narrative_text)`);
    const excerpt = rows[0]?.excerpt;

    expect(excerpt).not.toBeNull();
    expect(excerpt).toContain(query);
    expect(excerpt?.startsWith('...')).toBe(true);
    expect(excerpt?.endsWith('...')).toBe(true);
    expect(Array.from(excerpt ?? '')).toHaveLength(quickFindExcerptMaxCodePoints);
  });
});
