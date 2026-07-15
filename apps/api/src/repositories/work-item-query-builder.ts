import type { WorkItemQuery, WorkItemSort } from '@worktrail/contracts';
import {
  asc,
  desc,
  eq,
  ilike,
  inArray,
  isNotNull,
  isNull,
  or,
  sql,
  type SQL
} from 'drizzle-orm';

import { projects, workItemLabels, workItemRelationships, workItems } from '../db/schema.js';
import {
  activeUnassignedWorkItemStatuses,
  dueSoonWindowDays,
  riskOpenWorkItemStatuses,
  riskTerminalWorkItemStatuses,
  staleInProgressDays
} from '../domain/work-risk-policy.js';

export type ProjectWorkItemQuery = Pick<
  WorkItemQuery,
  | 'status'
  | 'workState'
  | 'assigneeId'
  | 'assigneeState'
  | 'reporterId'
  | 'type'
  | 'priority'
  | 'labelId'
  | 'milestoneId'
  | 'cycleId'
  | 'dueDateState'
  | 'blocked'
  | 'dependency'
  | 'workRisk'
  | 'hierarchy'
  | 'parentKey'
  | 'search'
  | 'sort'
>;

export function buildProjectWorkItemConditions(
  projectId: string,
  filters: ProjectWorkItemQuery = {}
): SQL[] {
  return [eq(workItems.projectId, projectId), ...buildCommonWorkItemConditions(filters)];
}

export function buildWorkspaceWorkItemConditions(
  workspaceId: string,
  filters: WorkItemQuery = {}
): SQL[] {
  const conditions = [eq(workItems.workspaceId, workspaceId)];

  if (filters.projectId !== undefined) {
    conditions.push(eq(workItems.projectId, filters.projectId));
  }

  if (filters.archivedProjects === 'only') {
    conditions.push(eq(projects.status, 'archived'));
  } else if (filters.archivedProjects !== 'include') {
    conditions.push(eq(projects.status, 'active'));
  }

  return [...conditions, ...buildCommonWorkItemConditions(filters)];
}

export function buildProjectWorkItemOrderBy(sort: WorkItemSort | undefined): SQL[] {
  return buildWorkItemOrderBy(sort, { includeProjectKey: false });
}

export function buildWorkspaceWorkItemOrderBy(sort: WorkItemSort | undefined): SQL[] {
  return buildWorkItemOrderBy(sort, { includeProjectKey: true });
}

function buildCommonWorkItemConditions(filters: ProjectWorkItemQuery): SQL[] {
  const conditions: SQL[] = [];

  if (filters.status !== undefined) {
    conditions.push(eq(workItems.status, filters.status));
  }

  if (filters.workState === 'open') {
    conditions.push(inArray(workItems.status, riskOpenWorkItemStatuses));
  }

  if (filters.workState === 'terminal') {
    conditions.push(inArray(workItems.status, riskTerminalWorkItemStatuses));
  }

  if (filters.blocked === true && filters.status === undefined) {
    conditions.push(eq(workItems.status, 'blocked'));
  }

  if (filters.assigneeId !== undefined) {
    conditions.push(eq(workItems.assigneeId, filters.assigneeId));
  }

  if (filters.assigneeState === 'unassigned') {
    conditions.push(sql`${workItems.assigneeId} is null`);
  }

  if (filters.assigneeState === 'assigned') {
    conditions.push(sql`${workItems.assigneeId} is not null`);
  }

  if (filters.reporterId !== undefined) {
    conditions.push(eq(workItems.reporterId, filters.reporterId));
  }

  if (filters.type !== undefined) {
    conditions.push(eq(workItems.type, filters.type));
  }

  if (filters.priority !== undefined) {
    conditions.push(eq(workItems.priority, filters.priority));
  }

  if (filters.labelId !== undefined) {
    conditions.push(labelCondition(filters.labelId));
  }

  if (filters.milestoneId !== undefined) {
    conditions.push(eq(workItems.milestoneId, filters.milestoneId));
  }

  if (filters.cycleId !== undefined) {
    conditions.push(eq(workItems.cycleId, filters.cycleId));
  }

  conditions.push(...dueDateConditions(filters.dueDateState));
  conditions.push(...dependencyConditions(filters.dependency));
  conditions.push(...workRiskConditions(filters.workRisk));
  conditions.push(...hierarchyConditions(filters));

  if (filters.search !== undefined && filters.search.trim() !== '') {
    const search = `%${filters.search.trim()}%`;
    conditions.push(
      or(
        ilike(workItems.displayKey, search),
        ilike(workItems.title, search),
        ilike(workItems.description, search)
      )!
    );
  }

  return conditions;
}

function hierarchyConditions(filters: ProjectWorkItemQuery): SQL[] {
  if (filters.hierarchy === 'top_level') {
    return [isNull(workItems.parentWorkItemId)];
  }

  if (filters.hierarchy === 'children') {
    return [isNotNull(workItems.parentWorkItemId)];
  }

  if (filters.hierarchy === 'parents') {
    return [sql`exists (
      select 1 from ${workItems} as hierarchy_child_work_items
      where hierarchy_child_work_items.parent_work_item_id = ${workItems.id}
    )`];
  }

  if (filters.parentKey !== undefined) {
    return [sql`${workItems.parentWorkItemId} = (
      select hierarchy_parent_work_items.id
      from ${workItems} as hierarchy_parent_work_items
      where hierarchy_parent_work_items.workspace_id = ${workItems.workspaceId}
        and hierarchy_parent_work_items.display_key = ${filters.parentKey}
    )`];
  }

  return [];
}

function workRiskConditions(workRisk: WorkItemQuery['workRisk']): SQL[] {
  if (workRisk === 'unassigned_active') {
    return [
      sql`${workItems.assigneeId} is null`,
      inArray(workItems.status, [...activeUnassignedWorkItemStatuses])
    ];
  }

  if (workRisk === 'stale_in_progress') {
    return [
      eq(workItems.status, 'in_progress'),
      sql`${workItems.updatedAt} < now() - (${staleInProgressDays} * interval '1 day')`
    ];
  }

  return [];
}

function labelCondition(labelId: string): SQL {
  return sql`exists (
    select 1 from ${workItemLabels}
    where ${workItemLabels.workItemId} = ${workItems.id}
    and ${workItemLabels.labelId} = ${labelId}
  )`;
}

function dueDateConditions(dueDateState: WorkItemQuery['dueDateState']): SQL[] {
  if (dueDateState === 'overdue') {
    return [
      sql`${workItems.dueDate} < current_date`,
      sql`${workItems.status} not in ${terminalStatusListSql()}`
    ];
  }

  if (dueDateState === 'due_soon') {
    return [
      sql`${workItems.dueDate} >= current_date`,
      sql`${workItems.dueDate} <= current_date + (${dueSoonWindowDays} * interval '1 day')`,
      sql`${workItems.status} not in ${terminalStatusListSql()}`
    ];
  }

  if (dueDateState === 'none') {
    return [sql`${workItems.dueDate} is null`];
  }

  return [];
}

function dependencyConditions(dependency: WorkItemQuery['dependency']): SQL[] {
  if (dependency === 'dependency_blocked') {
    return [
      sql`exists (
        select 1 from ${workItemRelationships}
        inner join ${workItems} blocker
          on blocker.id = ${workItemRelationships.sourceWorkItemId}
        where ${workItemRelationships.relationshipType} = 'blocks'
          and ${workItemRelationships.targetWorkItemId} = ${workItems.id}
          and blocker.status not in ${terminalStatusListSql()}
      )`
    ];
  }

  if (dependency === 'blocking_open_work') {
    return [
      sql`exists (
        select 1 from ${workItemRelationships}
        inner join ${workItems} blocked
          on blocked.id = ${workItemRelationships.targetWorkItemId}
        where ${workItemRelationships.relationshipType} = 'blocks'
          and ${workItemRelationships.sourceWorkItemId} = ${workItems.id}
          and blocked.status not in ${terminalStatusListSql()}
      )`
    ];
  }

  return [];
}

function buildWorkItemOrderBy(
  sort: WorkItemSort | undefined,
  input: { includeProjectKey: boolean }
): SQL[] {
  const projectTieBreakers = input.includeProjectKey ? [asc(projects.key)] : [];

  if (sort === 'updated_asc') {
    return [asc(workItems.updatedAt), ...projectTieBreakers, asc(workItems.itemNumber)];
  }

  if (sort === 'priority_desc') {
    return [desc(priorityRankSql()), desc(workItems.updatedAt), ...projectTieBreakers, asc(workItems.itemNumber)];
  }

  if (sort === 'priority_asc') {
    return [asc(priorityRankSql()), desc(workItems.updatedAt), ...projectTieBreakers, asc(workItems.itemNumber)];
  }

  if (sort === 'due_date_asc') {
    return [sql`${workItems.dueDate} asc nulls last`, ...projectTieBreakers, asc(workItems.itemNumber)];
  }

  if (sort === 'created_desc') {
    return [desc(workItems.createdAt), ...projectTieBreakers, asc(workItems.itemNumber)];
  }

  if (sort === 'board_order') {
    return [
      ...projectTieBreakers,
      asc(workItems.status),
      asc(workItems.boardPosition),
      asc(workItems.itemNumber)
    ];
  }

  return [desc(workItems.updatedAt), ...projectTieBreakers, asc(workItems.itemNumber)];
}

function priorityRankSql(): SQL {
  return sql`case ${workItems.priority}
    when 'urgent' then 4
    when 'high' then 3
    when 'medium' then 2
    when 'low' then 1
    else 0
  end`;
}

function terminalStatusListSql(): SQL {
  return sql.raw(`(${riskTerminalWorkItemStatuses.map((status) => `'${status}'`).join(', ')})`);
}
