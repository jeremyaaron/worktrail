import { describe, expect, it } from 'vitest';

import type { WorkItemQuery } from '@worktrail/contracts';
import { ValidationError } from '../src/errors/app-error.js';
import {
  normalizeWorkItemQuery,
  parseProjectWorkItemQuery,
  parseWorkItemQuery,
  parseWorkspaceWorkItemQuery
} from '../src/validation/work-item-query.js';

describe('work item query validation', () => {
  const memberId = '0f8fad5b-d9cb-469f-a165-70867728950e';
  const projectId = '1f8fad5b-d9cb-469f-a165-70867728950e';
  const cycleId = '2f8fad5b-d9cb-469f-a165-70867728950e';

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

  it('parses project-scoped work item queries with the canonical query model', () => {
    expect(
      parseProjectWorkItemQuery({
        archivedProjects: 'only',
        projectId,
        cycleId,
        blocked: 'true',
        assigneeState: 'assigned',
        workRisk: 'stale_in_progress',
        workState: 'open',
        sort: 'priority_desc'
      })
    ).toEqual({
      assigneeState: 'assigned',
      blocked: true,
      cycleId,
      sort: 'priority_desc',
      workRisk: 'stale_in_progress',
      workState: 'open'
    });
  });

  it('parses workspace work item queries with workspace scope fields', () => {
    expect(
      parseWorkspaceWorkItemQuery({
        projectId,
        cycleId,
        archivedProjects: 'only',
        workRisk: 'unassigned_active',
        workState: 'terminal'
      })
    ).toEqual({
      archivedProjects: 'only',
      cycleId,
      projectId,
      sort: 'updated_desc',
      workRisk: 'unassigned_active',
      workState: 'terminal'
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
        assigneeId: memberId,
        cycleId,
        milestoneId: '',
        projectId: '',
        search: '  api gateway  ',
        unexpected: 'ignored',
        workState: 'open'
      } as unknown as WorkItemQuery)
    ).toEqual({
      assigneeId: memberId,
      archivedProjects: 'exclude',
      cycleId,
      search: 'api gateway',
      sort: 'updated_desc',
      workState: 'open'
    });
  });

  it('parses hierarchy modes and canonical parent keys', () => {
    expect(parseProjectWorkItemQuery({ hierarchy: 'parents' })).toMatchObject({
      hierarchy: 'parents'
    });
    expect(parseWorkspaceWorkItemQuery({ parentKey: '  wt-42  ' })).toMatchObject({
      parentKey: 'WT-42'
    });
    expect(normalizeWorkItemQuery({ parentKey: 'plan-7' })).toMatchObject({
      parentKey: 'PLAN-7'
    });
  });

  it('normalizes unknown and empty saved-view query fields without preserving them', () => {
    expect(
      normalizeWorkItemQuery({
        archivedProjects: '',
        assigneeId: '',
        blocked: false,
        cycleId: '',
        search: '',
        sort: '',
        status: '',
        unknownFilter: 'not persisted'
      } as unknown as WorkItemQuery)
    ).toEqual({
      archivedProjects: 'exclude',
      blocked: false,
      sort: 'updated_desc'
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
        assigneeId: memberId,
        assigneeState: 'unassigned'
      })
    ).toThrow(ValidationError);
  });

  it('rejects unsupported work risk filters', () => {
    expect(() => parseWorkItemQuery({ workRisk: 'unowned' })).toThrow(ValidationError);
  });

  it('rejects invalid or contradictory hierarchy queries', () => {
    expect(() => parseWorkItemQuery({ hierarchy: 'recursive' })).toThrow(ValidationError);
    expect(() => parseWorkItemQuery({ parentKey: 'not a key' })).toThrow(ValidationError);
    expect(() => parseWorkItemQuery({ parentKey: `WT-${'1'.repeat(79)}` })).toThrow(
      ValidationError
    );
    expect(() => parseWorkItemQuery({ hierarchy: 'children', parentKey: 'WT-42' })).toThrow(
      'Work item queries cannot specify both hierarchy and parent key.'
    );
  });
});
