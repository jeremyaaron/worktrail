import { describe, expect, it } from 'vitest';
import { workItemQueryEntries } from '@worktrail/contracts';
import { queryParityFixtures } from '../../../packages/contracts/src/fixtures/work-query-fixtures.js';
import { parseProjectWorkItemQuery, parseWorkspaceWorkItemQuery, normalizeWorkItemQuery } from '../src/validation/work-item-query.js';
import { projectWorkItemPathFromQuery } from '../src/services/work-item-query-link.js';
import { ValidationError } from '../src/errors/app-error.js';

describe('live query HTTP/normalization/link parity', () => {
  it.each(queryParityFixtures)('preserves $name through both supported scopes', ({ query }) => {
    const http = Object.fromEntries(Object.entries(query).map(([key, value]) => [key, String(value)]));
    const workspace = parseWorkspaceWorkItemQuery(http);
    const project = parseProjectWorkItemQuery(http);
    expect(Object.fromEntries(workItemQueryEntries(workspace, 'workspace'))).toEqual(Object.fromEntries(workItemQueryEntries(query, 'workspace')));
    expect(Object.fromEntries(workItemQueryEntries(project, 'project'))).toEqual(Object.fromEntries(workItemQueryEntries(query, 'project')));
    expect(Object.fromEntries(workItemQueryEntries(normalizeWorkItemQuery(query), 'workspace')))
      .toEqual(Object.fromEntries(workItemQueryEntries(query, 'workspace')));
    const link = new URL(projectWorkItemPathFromQuery('project-id', query), 'http://worktrail.test');
    expect(Object.fromEntries(link.searchParams)).toEqual(Object.fromEntries(workItemQueryEntries(project, 'project')));
  });
  it('rejects invalid predicates without changing tolerant URL behavior into server tolerance', () => {
    for (const input of [
      { estimateState: 'none' }, { status: 'ready', workState: 'open' }, { hierarchy: 'children', parentKey: 'WT-42' },
      { assigneeState: 'unassigned', assigneeId: '10000000-0000-4000-8000-000000000101' }
    ]) expect(() => parseWorkspaceWorkItemQuery(input)).toThrow(ValidationError);
  });
});
