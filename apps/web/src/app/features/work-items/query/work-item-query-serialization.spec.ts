import type { WorkItemQuery } from '@worktrail/contracts';

import { unassignedAssigneeValue } from './work-item-filter-options';
import type {
  ProjectWorkItemFilterFormValue,
  WorkspaceWorkItemFilterFormValue
} from './work-item-filter-state';
import {
  meaningfulWorkItemQueryFieldCount,
  projectFiltersFromFormValue,
  projectFormValueFromQuery,
  projectFormValueFromQueryParams,
  projectQueryFromFormValue,
  projectQueryParamsFromFilters,
  projectRouterQueryParamsFromQuery,
  returnUrlFromWorkItemQuery,
  routerLinkQueryParamsFromWorkItemQuery,
  workspaceFormValueFromQuery,
  workspaceFormValueFromQueryParams,
  workspaceQueryFromFormValue,
  workspaceQueryParamsFromFormValue,
  workspaceRouterQueryParamsFromQuery
} from './work-item-query-serialization';

describe('work item query serialization', () => {
  const projectFormValue: ProjectWorkItemFilterFormValue = {
    search: '  api  ',
    status: 'ready',
    assigneeId: 'member-1',
    reporterId: 'reporter-1',
    type: 'bug',
    labelId: 'label-1',
    milestoneId: 'milestone-1',
    priority: 'urgent',
    dueDateState: 'overdue',
    dependency: 'dependency_blocked',
    sort: 'priority_desc'
  };

  const workspaceFormValue: WorkspaceWorkItemFilterFormValue = {
    ...projectFormValue,
    projectId: 'project-1',
    workState: 'open',
    blocked: 'false',
    archivedProjects: 'include'
  };

  it('converts project list form values into compact canonical queries', () => {
    expect(projectQueryFromFormValue(projectFormValue)).toEqual({
      search: 'api',
      status: 'ready',
      assigneeId: 'member-1',
      reporterId: 'reporter-1',
      type: 'bug',
      labelId: 'label-1',
      milestoneId: 'milestone-1',
      priority: 'urgent',
      dueDateState: 'overdue',
      dependency: 'dependency_blocked',
      sort: 'priority_desc'
    });
    expect(projectFiltersFromFormValue(projectFormValue)).toEqual(projectQueryFromFormValue(projectFormValue));
  });

  it('omits default project query params while preserving non-default values', () => {
    expect(projectQueryParamsFromFilters({ search: 'api', sort: 'updated_desc' })).toEqual({
      search: 'api',
      status: null,
      assigneeId: null,
      reporterId: null,
      type: null,
      labelId: null,
      milestoneId: null,
      priority: null,
      dueDateState: null,
      dependency: null,
      sort: null
    });
  });

  it('round-trips project form values through canonical query and route params', () => {
    const query = projectQueryFromFormValue(projectFormValue);
    const params = projectRouterQueryParamsFromQuery(query);
    const rehydratedForm = projectFormValueFromQueryParams(toSearchParams(params));

    expect(projectQueryFromFormValue(rehydratedForm)).toEqual(query);
  });

  it('builds project form values from saved view queries', () => {
    expect(
      projectFormValueFromQuery({
        priority: 'high',
        search: 'client',
        sort: 'created_desc'
      })
    ).toEqual({
      search: 'client',
      status: '',
      assigneeId: '',
      reporterId: '',
      type: '',
      labelId: '',
      milestoneId: '',
      priority: 'high',
      dueDateState: '',
      dependency: '',
      sort: 'created_desc'
    });
  });

  it('strips workspace-only fields from project router params', () => {
    expect(
      routerLinkQueryParamsFromWorkItemQuery(
        {
          archivedProjects: 'include',
          blocked: true,
          projectId: 'project-1',
          search: 'api',
          sort: 'priority_desc',
          workState: 'open'
        },
        'project'
      )
    ).toEqual({
      search: 'api',
      sort: 'priority_desc'
    });
  });

  it('converts workspace list form values into compact canonical queries', () => {
    expect(
      workspaceQueryFromFormValue({
        ...workspaceFormValue,
        assigneeId: unassignedAssigneeValue,
        sort: 'updated_desc'
      })
    ).toEqual({
      search: 'api',
      projectId: 'project-1',
      status: 'ready',
      assigneeState: 'unassigned',
      reporterId: 'reporter-1',
      type: 'bug',
      labelId: 'label-1',
      milestoneId: 'milestone-1',
      priority: 'urgent',
      dueDateState: 'overdue',
      blocked: false,
      dependency: 'dependency_blocked',
      archivedProjects: 'include'
    });
  });

  it('round-trips workspace form values through canonical query and route params', () => {
    const query = workspaceQueryFromFormValue({
      ...workspaceFormValue,
      status: '',
      assigneeId: unassignedAssigneeValue,
      sort: 'due_date_asc'
    });
    const params = workspaceRouterQueryParamsFromQuery(query);
    const rehydratedForm = workspaceFormValueFromQueryParams(toSearchParams(params));

    expect(workspaceQueryFromFormValue(rehydratedForm)).toEqual(query);
  });

  it('serializes workspace route params from canonical query state', () => {
    expect(
      workspaceQueryParamsFromFormValue({
        ...workspaceFormValue,
        status: 'ready',
        workState: 'open',
        assigneeId: unassignedAssigneeValue,
        blocked: '',
        archivedProjects: 'exclude',
        sort: 'updated_desc'
      })
    ).toEqual({
      search: 'api',
      projectId: 'project-1',
      status: 'ready',
      workState: null,
      assigneeId: null,
      assigneeState: 'unassigned',
      reporterId: 'reporter-1',
      type: 'bug',
      labelId: 'label-1',
      milestoneId: 'milestone-1',
      priority: 'urgent',
      dueDateState: 'overdue',
      blocked: null,
      dependency: 'dependency_blocked',
      archivedProjects: null,
      sort: null
    });
  });

  it('preserves explicit blocked false and non-default workspace defaults in link params', () => {
    expect(
      routerLinkQueryParamsFromWorkItemQuery(
        {
          blocked: false,
          archivedProjects: 'only',
          sort: 'updated_desc'
        },
        'workspace'
      )
    ).toEqual({
      blocked: 'false',
      archivedProjects: 'only'
    });
  });

  it('builds workspace form values from saved view queries and route query params', () => {
    expect(
      workspaceFormValueFromQuery({
        assigneeState: 'unassigned',
        blocked: true,
        workState: 'open'
      })
    ).toEqual({
      search: '',
      projectId: '',
      status: '',
      workState: 'open',
      assigneeId: unassignedAssigneeValue,
      reporterId: '',
      type: '',
      labelId: '',
      milestoneId: '',
      priority: '',
      dueDateState: '',
      blocked: 'true',
      dependency: '',
      archivedProjects: 'exclude',
      sort: 'updated_desc'
    });

    const params = new URLSearchParams({
      status: 'done',
      workState: 'open',
      assigneeState: 'unassigned'
    });

    expect(workspaceFormValueFromQueryParams(params).status).toBe('done');
    expect(workspaceFormValueFromQueryParams(params).workState).toBe('');
    expect(workspaceFormValueFromQueryParams(params).assigneeId).toBe(unassignedAssigneeValue);
  });

  it('returns null router link params for empty or default-only queries', () => {
    expect(routerLinkQueryParamsFromWorkItemQuery(null, 'workspace')).toBeNull();
    expect(routerLinkQueryParamsFromWorkItemQuery({}, 'workspace')).toBeNull();
    expect(
      routerLinkQueryParamsFromWorkItemQuery(
        { archivedProjects: 'exclude', search: '', sort: 'updated_desc' },
        'workspace'
      )
    ).toBeNull();
  });

  it('builds return URLs from applied query state', () => {
    const query: WorkItemQuery = {
      dependency: 'blocking_open_work',
      search: 'api gateway',
      sort: 'priority_desc'
    };

    expect(returnUrlFromWorkItemQuery('/work-items', query, 'workspace')).toBe(
      '/work-items?search=api+gateway&dependency=blocking_open_work&sort=priority_desc'
    );
    expect(returnUrlFromWorkItemQuery('/projects/project-1/work-items', {}, 'project')).toBe(
      '/projects/project-1/work-items'
    );
  });

  it('counts meaningful query fields without default noise', () => {
    expect(
      meaningfulWorkItemQueryFieldCount(
        {
          archivedProjects: 'exclude',
          blocked: false,
          search: 'api',
          sort: 'updated_desc'
        },
        'workspace'
      )
    ).toBe(2);
    expect(
      meaningfulWorkItemQueryFieldCount(
        {
          archivedProjects: 'include',
          projectId: 'project-1',
          sort: 'priority_desc'
        },
        'project'
      )
    ).toBe(1);
  });
});

function toSearchParams(params: Record<string, string | null>): URLSearchParams {
  return new URLSearchParams(
    Object.entries(params).filter((entry): entry is [string, string] => entry[1] !== null)
  );
}
