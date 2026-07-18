import type {
  LabelDto,
  MemberDto,
  MilestoneDto,
  ProjectCycleDto,
  ProjectNavigationSummaryDto,
  WorkItemPriority,
  WorkItemStatus
} from '@worktrail/contracts';

import { memberDisplayName } from '../../../shared/display/member-display';
import { formatToken } from '../../../shared/display/token-format';
import {
  filterPillLabel,
  projectTitle,
  workItemPriorityLabel,
  workItemStatusLabel
} from '../../../shared/work-items/work-item-display';
import {
  archivedProjectModeOptions,
  blockedFilterOptions,
  dependencyFilterOptions,
  dueDateStateOptions,
  workItemHierarchyOptions,
  workItemSortOptions,
  workItemStateOptions
} from './work-item-filter-options';
import type {
  ProjectWorkItemFilterFormValue,
  WorkspaceWorkItemFilterFormValue
} from './work-item-filter-state';

const workRiskLabels: Record<string, string> = {
  unassigned_active: 'Unassigned active',
  stale_in_progress: 'Stale in progress'
};

export interface ProjectFilterLabelLookups {
  members: MemberDto[];
  labels: LabelDto[];
  milestones: MilestoneDto[];
  cycles: ProjectCycleDto[];
}

export interface WorkspaceFilterLabelLookups extends ProjectFilterLabelLookups {
  projectSummaries: ProjectNavigationSummaryDto[];
}

export function projectWorkItemFilterLabels(
  formValue: ProjectWorkItemFilterFormValue,
  lookups: ProjectFilterLabelLookups
): string[] {
  const labels: string[] = [];

  pushFilterLabel(labels, 'Search', formValue.search.trim());
  pushFilterLabel(
    labels,
    'Status',
    formValue.status === '' ? '' : workItemStatusLabel(formValue.status as WorkItemStatus)
  );
  pushFilterLabel(labels, 'Assignee', memberName(formValue.assigneeId, lookups.members));
  pushFilterLabel(labels, 'Reporter', memberName(formValue.reporterId, lookups.members));
  pushFilterLabel(labels, 'Type', formatToken(formValue.type));
  pushFilterLabel(labels, 'Label', labelName(formValue.labelId, lookups.labels));
  pushFilterLabel(labels, 'Milestone', milestoneName(formValue.milestoneId, lookups.milestones));
  pushFilterLabel(labels, 'Cycle', cycleName(formValue.cycleId, lookups.cycles));
  pushFilterLabel(
    labels,
    'Priority',
    formValue.priority === '' ? '' : workItemPriorityLabel(formValue.priority as WorkItemPriority)
  );
  pushFilterLabel(labels, 'Due date', optionLabel(dueDateStateOptions, formValue.dueDateState));
  pushFilterLabel(labels, 'Dependency', optionLabel(dependencyFilterOptions, formValue.dependency));
  pushFilterLabel(labels, 'Risk', workRiskLabels[formValue.workRisk] ?? formValue.workRisk);
  pushFilterLabel(
    labels,
    'Work breakdown',
    formValue.hierarchy === '' ? '' : optionLabel(workItemHierarchyOptions, formValue.hierarchy)
  );
  pushFilterLabel(labels, 'Parent', formValue.parentKey);
  pushFilterLabel(
    labels,
    'Sort',
    formValue.sort === 'updated_desc' ? '' : optionLabel(workItemSortOptions, formValue.sort)
  );

  return labels;
}

export function workspaceWorkItemFilterLabels(
  formValue: WorkspaceWorkItemFilterFormValue,
  lookups: WorkspaceFilterLabelLookups
): string[] {
  const labels = projectWorkItemFilterLabels(formValue, lookups);

  const projectIndex = labels[0]?.startsWith('Search:') === true ? 1 : 0;
  insertFilterLabel(
    labels,
    projectIndex,
    'Project',
    projectName(formValue.projectId, lookups.projectSummaries)
  );
  const statusIndex = labels.findIndex((label) => label.startsWith('Status:'));
  const stateIndex = statusIndex === -1 ? projectIndex + 1 : statusIndex + 1;
  insertFilterLabel(labels, stateIndex, 'State', optionLabel(workItemStateOptions, formValue.workState));
  pushFilterLabel(labels, 'Blocked', optionLabel(blockedFilterOptions, formValue.blocked));
  pushFilterLabel(
    labels,
    'Projects',
    formValue.archivedProjects === 'exclude'
      ? ''
      : optionLabel(archivedProjectModeOptions, formValue.archivedProjects)
  );

  return labels;
}

function pushFilterLabel(labels: string[], label: string, value: string): void {
  if (value.trim() !== '') {
    labels.push(filterPillLabel(label, value));
  }
}

function insertFilterLabel(labels: string[], index: number, label: string, value: string): void {
  if (value.trim() !== '') {
    labels.splice(index, 0, filterPillLabel(label, value));
  }
}

function optionLabel<TValue extends string>(
  options: Array<{ label: string; value: TValue }>,
  value: string
): string {
  return options.find((option) => option.value === value)?.label ?? value;
}

function memberName(memberId: string, members: MemberDto[]): string {
  if (memberId === '') {
    return '';
  }

  const member = members.find((item) => item.id === memberId);
  return member === undefined ? memberId : memberDisplayName(member);
}

function labelName(labelId: string, labels: LabelDto[]): string {
  return labelId === '' ? '' : labels.find((label) => label.id === labelId)?.name ?? labelId;
}

function milestoneName(milestoneId: string, milestones: MilestoneDto[]): string {
  return milestoneId === ''
    ? ''
    : milestones.find((milestone) => milestone.id === milestoneId)?.name ?? milestoneId;
}

function cycleName(cycleId: string, cycles: ProjectCycleDto[]): string {
  return cycleId === '' ? '' : cycles.find((cycle) => cycle.id === cycleId)?.name ?? cycleId;
}

function projectName(projectId: string, summaries: ProjectNavigationSummaryDto[]): string {
  if (projectId === '') {
    return '';
  }

  const summary = summaries.find((item) => item.project.id === projectId);
  return summary === undefined ? projectId : projectTitle(summary.project);
}
