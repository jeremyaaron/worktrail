import type { WorkItemQuery } from './work-items.js';

export type WorkItemQueryScope = 'project' | 'workspace';
export interface WorkItemQueryFieldPolicy {
  scope: 'both' | 'workspace';
  displayKey: string;
  encoding: 'text' | 'enum' | 'boolean';
  default?: string;
}

export const workItemQueryFieldPolicy = {
  search: { scope: 'both', displayKey: 'Search', encoding: 'text' },
  projectId: { scope: 'workspace', displayKey: 'Project', encoding: 'text' },
  status: { scope: 'both', displayKey: 'Status', encoding: 'enum' },
  workState: { scope: 'both', displayKey: 'State', encoding: 'enum' },
  assigneeId: { scope: 'both', displayKey: 'Assignee', encoding: 'text' },
  assigneeState: { scope: 'both', displayKey: 'Assignment', encoding: 'enum' },
  reporterId: { scope: 'both', displayKey: 'Reporter', encoding: 'text' },
  type: { scope: 'both', displayKey: 'Type', encoding: 'enum' },
  labelId: { scope: 'both', displayKey: 'Label', encoding: 'text' },
  milestoneId: { scope: 'both', displayKey: 'Milestone', encoding: 'text' },
  cycleId: { scope: 'both', displayKey: 'Cycle', encoding: 'text' },
  priority: { scope: 'both', displayKey: 'Priority', encoding: 'enum' },
  dueDateState: { scope: 'both', displayKey: 'Due date', encoding: 'enum' },
  estimateState: { scope: 'both', displayKey: 'Estimate', encoding: 'enum' },
  blocked: { scope: 'both', displayKey: 'Blocked', encoding: 'boolean' },
  dependency: { scope: 'both', displayKey: 'Dependency', encoding: 'enum' },
  workRisk: { scope: 'both', displayKey: 'Risk', encoding: 'enum' },
  hierarchy: { scope: 'both', displayKey: 'Work breakdown', encoding: 'enum' },
  parentKey: { scope: 'both', displayKey: 'Parent', encoding: 'text' },
  archivedProjects: { scope: 'workspace', displayKey: 'Projects', encoding: 'enum', default: 'exclude' },
  sort: { scope: 'both', displayKey: 'Sort', encoding: 'enum', default: 'updated_desc' }
} as const satisfies Record<keyof WorkItemQuery, WorkItemQueryFieldPolicy>;

export const workItemQueryFields = Object.keys(workItemQueryFieldPolicy) as Array<keyof WorkItemQuery>;

export function workItemQueryEntries(query: WorkItemQuery, scope: WorkItemQueryScope, omitDefaults = true): Array<[keyof WorkItemQuery, string]> {
  const entries: Array<[keyof WorkItemQuery, string]> = [];
  for (const key of workItemQueryFields) {
    const policy: WorkItemQueryFieldPolicy = workItemQueryFieldPolicy[key];
    const value = query[key];
    if ((scope === 'project' && policy.scope === 'workspace') || value === undefined) continue;
    const encoded = String(value).trim();
    if (!encoded || (omitDefaults && encoded === policy.default)) continue;
    entries.push([key, encoded]);
  }
  return entries;
}
