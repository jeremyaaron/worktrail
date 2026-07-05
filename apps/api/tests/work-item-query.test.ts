import { describe, expect, it } from 'vitest';

import { ValidationError } from '../src/errors/app-error.js';
import { normalizeWorkItemQuery, parseWorkItemQuery } from '../src/validation/work-item-query.js';

describe('work item query validation', () => {
  it('normalizes empty values and applies defaults', () => {
    expect(
      parseWorkItemQuery({
        search: '  dependency  ',
        status: '',
        sort: undefined,
        archivedProjects: undefined
      })
    ).toEqual({
      archivedProjects: 'exclude',
      search: 'dependency',
      sort: 'updated_desc'
    });
  });

  it('uses the first repeated query value', () => {
    expect(
      parseWorkItemQuery({
        status: ['blocked', 'done'],
        sort: ['priority_desc', 'updated_desc']
      })
    ).toEqual({
      archivedProjects: 'exclude',
      status: 'blocked',
      sort: 'priority_desc'
    });
  });

  it('normalizes saved-view query input', () => {
    expect(
      normalizeWorkItemQuery({
        search: '  api gateway  ',
        workState: 'open'
      })
    ).toEqual({
      archivedProjects: 'exclude',
      search: 'api gateway',
      sort: 'updated_desc',
      workState: 'open'
    });
  });

  it('rejects contradictory blocked and status filters', () => {
    expect(() => parseWorkItemQuery({ blocked: 'true', status: 'ready' })).toThrow(ValidationError);
  });

  it('rejects contradictory status and work state filters', () => {
    expect(() => parseWorkItemQuery({ status: 'ready', workState: 'open' })).toThrow(
      ValidationError
    );
  });

  it('rejects unassigned queries with an assignee id', () => {
    expect(() =>
      parseWorkItemQuery({
        assigneeId: '0f8fad5b-d9cb-469f-a165-70867728950e',
        assigneeState: 'unassigned'
      })
    ).toThrow(ValidationError);
  });
});
