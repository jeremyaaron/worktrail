import {
  projectFiltersFromFormValue,
  projectFormValueFromQueryParams,
  projectQueryParamsFromFilters,
  workspaceFormValueFromQuery,
  workspaceFormValueFromQueryParams,
  workspaceQueryFromFormValue,
  workspaceQueryParamsFromFormValue
} from './work-item-query-serialization';
import { unassignedAssigneeValue } from './work-item-filter-options';
import type {
  ProjectWorkItemFilterFormValue,
  WorkspaceWorkItemFilterFormValue
} from './work-item-filter-state';

describe('work item query serialization', () => {
  const projectFormValue: ProjectWorkItemFilterFormValue = {
    search: '  api  ',
    status: 'ready',
    assigneeId: 'member-1',
    reporterId: '',
    type: 'bug',
    labelId: 'label-1',
    milestoneId: '',
    priority: 'urgent',
    dueDateState: 'overdue',
    dependency: 'dependency_blocked',
    sort: 'priority_desc'
  };

  it('converts project list form values into API filters', () => {
    expect(projectFiltersFromFormValue(projectFormValue)).toEqual({
      search: 'api',
      status: 'ready',
      assigneeId: 'member-1',
      reporterId: undefined,
      type: 'bug',
      labelId: 'label-1',
      milestoneId: undefined,
      priority: 'urgent',
      dueDateState: 'overdue',
      dependency: 'dependency_blocked',
      sort: 'priority_desc'
    });
  });

  it('omits default project query params', () => {
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

  it('builds project form values from route query params', () => {
    const params = new URLSearchParams({
      search: 'client',
      priority: 'high',
      sort: 'created_desc'
    });

    expect(projectFormValueFromQueryParams(params)).toEqual({
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

  it('converts workspace list form values into API queries', () => {
    const workspaceFormValue: WorkspaceWorkItemFilterFormValue = {
      ...projectFormValue,
      projectId: 'project-1',
      workState: 'open',
      assigneeId: unassignedAssigneeValue,
      blocked: 'false',
      archivedProjects: 'include',
      sort: 'updated_desc'
    };

    expect(workspaceQueryFromFormValue(workspaceFormValue)).toEqual({
      search: 'api',
      projectId: 'project-1',
      status: 'ready',
      workState: undefined,
      assigneeId: undefined,
      assigneeState: 'unassigned',
      reporterId: undefined,
      type: 'bug',
      labelId: 'label-1',
      milestoneId: undefined,
      priority: 'urgent',
      dueDateState: 'overdue',
      blocked: false,
      dependency: 'dependency_blocked',
      archivedProjects: 'include',
      sort: undefined
    });
  });

  it('serializes workspace form values for route query params', () => {
    expect(
      workspaceQueryParamsFromFormValue({
        ...projectFormValue,
        projectId: '',
        workState: 'open',
        assigneeId: unassignedAssigneeValue,
        blocked: '',
        archivedProjects: 'exclude',
        sort: 'updated_desc'
      })
    ).toEqual({
      search: 'api',
      projectId: null,
      status: 'ready',
      workState: 'open',
      assigneeId: null,
      assigneeState: 'unassigned',
      reporterId: null,
      type: 'bug',
      labelId: 'label-1',
      milestoneId: null,
      priority: 'urgent',
      dueDateState: 'overdue',
      blocked: null,
      dependency: 'dependency_blocked',
      archivedProjects: null,
      sort: null
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
});
