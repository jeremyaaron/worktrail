import { sql } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';

import type { WorkItemSort } from '@worktrail/contracts';
import {
  buildProjectWorkItemOrderBy,
  buildWorkspaceWorkItemConditions,
  buildWorkspaceWorkItemOrderBy
} from '../src/repositories/work-item-query-builder.js';

const workItemSorts: WorkItemSort[] = [
  'updated_desc',
  'updated_asc',
  'priority_desc',
  'priority_asc',
  'due_date_asc',
  'created_desc',
  'board_order'
];

function renderOrderBy(orderBy: ReturnType<typeof buildProjectWorkItemOrderBy>): string {
  const dialect = new PgDialect();
  return dialect.sqlToQuery(sql`select 1 order by ${sql.join(orderBy, sql`, `)}`).sql;
}

describe('work item query ordering', () => {
  it('scopes both workspace rows and joined project summaries to the authorized workspace', () => {
    const conditions = buildWorkspaceWorkItemConditions('workspace', { archivedProjects: 'include' });
    const query = new PgDialect().sqlToQuery(sql`select 1 where ${sql.join(conditions, sql` and `)}`);
    expect(query.sql).toContain('"work_items"."workspace_id"');
    expect(query.sql).toContain('"projects"."workspace_id"');
    expect(query.params).toEqual(['workspace', 'workspace']);
  });
  it.each(workItemSorts)('ends project %s ordering with the UUID tie-breaker', (sort) => {
    expect(renderOrderBy(buildProjectWorkItemOrderBy(sort))).toMatch(/"work_items"\."id" asc$/);
  });

  it.each(workItemSorts)('ends workspace %s ordering with the UUID tie-breaker', (sort) => {
    expect(renderOrderBy(buildWorkspaceWorkItemOrderBy(sort))).toMatch(/"work_items"\."id" asc$/);
  });
});
