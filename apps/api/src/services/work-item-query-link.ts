import { workItemQueryEntries, type WorkItemQuery } from '@worktrail/contracts';

export function projectWorkItemPathFromQuery(projectId: string, query: WorkItemQuery = {}): string {
  const searchParams = new URLSearchParams(workItemQueryEntries(query, 'project'));
  const queryString = searchParams.toString();
  const path = `/projects/${encodeURIComponent(projectId)}/work-items`;
  return queryString ? `${path}?${queryString}` : path;
}
