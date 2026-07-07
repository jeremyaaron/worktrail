import { HttpParams } from '@angular/common/http';
import type { WorkItemQuery } from '@worktrail/contracts';

export type QueryParamValue = boolean | number | string | null | undefined;

export function queryToHttpParams<T extends object>(query: T): HttpParams {
  let params = new HttpParams();

  for (const [key, value] of Object.entries(query) as Array<[string, QueryParamValue]>) {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      params = params.set(key, String(value));
    }
  }

  return params;
}

export function workItemQueryToHttpParams(query: WorkItemQuery): HttpParams {
  return queryToHttpParams({
    projectId: query.projectId,
    status: query.status,
    workState: query.workState,
    assigneeId: query.assigneeId,
    assigneeState: query.assigneeState,
    reporterId: query.reporterId,
    type: query.type,
    priority: query.priority,
    labelId: query.labelId,
    milestoneId: query.milestoneId,
    dueDateState: query.dueDateState,
    blocked: query.blocked,
    dependency: query.dependency,
    workRisk: query.workRisk,
    archivedProjects: query.archivedProjects,
    search: query.search,
    sort: query.sort
  });
}
