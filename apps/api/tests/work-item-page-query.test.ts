import { describe, expect, it } from 'vitest';

import { ValidationError } from '../src/errors/app-error.js';
import { parseWorkItemPageQuery } from '../src/validation/work-item-page-query.js';
import {
  parseProjectWorkItemQuery,
  parseWorkspaceWorkItemQuery
} from '../src/validation/work-item-query.js';

describe('work item page query validation', () => {
  it('applies the default page window', () => {
    expect(parseWorkItemPageQuery({})).toEqual({ page: 1, pageSize: 25 });
    expect(parseWorkItemPageQuery({ page: '', pageSize: '  ' })).toEqual({
      page: 1,
      pageSize: 25
    });
  });

  it.each(['10', '25', '50', '100'])('accepts page size %s', (pageSize) => {
    expect(parseWorkItemPageQuery({ page: '3', pageSize })).toEqual({
      page: 3,
      pageSize: Number(pageSize)
    });
  });

  it.each(['0', '-1', '1.5', 'abc'])('rejects invalid page %s', (page) => {
    expect(() => parseWorkItemPageQuery({ page })).toThrow(ValidationError);
  });

  it.each(['0', '20', '101', '1.5', 'abc'])('rejects unsupported page size %s', (pageSize) => {
    expect(() => parseWorkItemPageQuery({ pageSize })).toThrow(ValidationError);
  });

  it('uses the first repeated paging value', () => {
    expect(
      parseWorkItemPageQuery({
        page: ['2', 'invalid'],
        pageSize: ['50', '20']
      })
    ).toEqual({ page: 2, pageSize: 50 });
    expect(() => parseWorkItemPageQuery({ page: ['invalid', '2'] })).toThrow(ValidationError);
  });

  it('ignores filter fields while filter parsers ignore paging fields', () => {
    const requestQuery = {
      page: '4',
      pageSize: '100',
      projectId: '1f8fad5b-d9cb-469f-a165-70867728950e',
      status: 'blocked'
    };

    expect(parseWorkItemPageQuery(requestQuery)).toEqual({ page: 4, pageSize: 100 });
    expect(parseWorkspaceWorkItemQuery(requestQuery)).toEqual({
      archivedProjects: 'exclude',
      projectId: requestQuery.projectId,
      sort: 'updated_desc',
      status: 'blocked'
    });
    expect(parseProjectWorkItemQuery(requestQuery)).toEqual({
      sort: 'updated_desc',
      status: 'blocked'
    });
  });
});
