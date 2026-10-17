import { workItemQueryEntries, workItemQueryFieldPolicy, type WorkItemQuery, type WorkItemQueryScope, type LabelDto, type MemberDto, type MilestoneDto, type ProjectCycleDto, type ProjectNavigationSummaryDto } from '@worktrail/contracts';
import { memberDisplayName } from '../../../shared/display/member-display';
import { formatToken } from '../../../shared/display/token-format';
import { projectTitle, workItemPriorityLabel, workItemStatusLabel } from '../../../shared/work-items/work-item-display';
import { archivedProjectModeOptions, blockedFilterOptions, dependencyFilterOptions, dueDateStateOptions, workItemHierarchyOptions, workItemSortOptions, workItemStateOptions } from './work-item-filter-options';
import type { ProjectWorkItemFilterFormValue, WorkspaceWorkItemFilterFormValue } from './work-item-filter-state';
import { projectQueryFromFormValue, workspaceQueryFromFormValue } from './work-item-query-serialization';

export interface ProjectFilterLabelLookups { members: MemberDto[]; labels: LabelDto[]; milestones: MilestoneDto[]; cycles: ProjectCycleDto[]; }
export interface WorkspaceFilterLabelLookups extends ProjectFilterLabelLookups { projectSummaries: ProjectNavigationSummaryDto[]; }
export interface WorkItemFilterChip { key: keyof WorkItemQuery; label: string; }

export function workItemFilterChips(query: WorkItemQuery, scope: WorkItemQueryScope, lookups: ProjectFilterLabelLookups & Partial<WorkspaceFilterLabelLookups>): WorkItemFilterChip[] {
  const entries = workItemQueryEntries(query, scope);
  const search = entries.find(entry => entry[0] === 'search');
  const ordered = search ? [search, ...entries.filter(entry => entry[0] !== 'search')] : entries;
  return ordered.map(([key, value]) => {
    let text = value;
    let title: string = workItemQueryFieldPolicy[key].displayKey;
    switch (key) {
      case 'projectId': { const project = lookups.projectSummaries?.find(item => item.project.id === value)?.project; text = project ? projectTitle(project) : value; break; }
      case 'status': text = workItemStatusLabel(value as NonNullable<WorkItemQuery['status']>); break;
      case 'workState': text = optionLabel(workItemStateOptions, value); break;
      case 'assigneeId':
      case 'reporterId': { const member = lookups.members.find(item => item.id === value); text = member ? memberDisplayName(member) : value; break; }
      case 'assigneeState': text = value === 'unassigned' ? 'Unassigned' : 'Assigned'; title = value === 'unassigned' ? 'Assignee' : 'Assignment'; break;
      case 'labelId': text = lookups.labels.find(item => item.id === value)?.name ?? value; break;
      case 'milestoneId': text = lookups.milestones.find(item => item.id === value)?.name ?? value; break;
      case 'cycleId': text = lookups.cycles.find(item => item.id === value)?.name ?? value; break;
      case 'priority': text = workItemPriorityLabel(value as NonNullable<WorkItemQuery['priority']>); break;
      case 'dueDateState': text = optionLabel(dueDateStateOptions, value); break;
      case 'estimateState': text = value === 'estimated' ? 'Estimated' : 'Unestimated'; break;
      case 'blocked': text = optionLabel(blockedFilterOptions, value); break;
      case 'dependency': text = optionLabel(dependencyFilterOptions, value); break;
      case 'hierarchy': text = optionLabel(workItemHierarchyOptions, value); break;
      case 'sort': text = optionLabel(workItemSortOptions, value); break;
      case 'archivedProjects': text = optionLabel(archivedProjectModeOptions, value); break;
      case 'workRisk': text = value === 'stale_in_progress' ? 'Stale in progress' : 'Unassigned active'; break;
      case 'type': text = formatToken(value); break;
    }
    return { key, label: `${title}: ${text}` };
  });
}
export function projectWorkItemFilterLabels(form: ProjectWorkItemFilterFormValue, lookups: ProjectFilterLabelLookups): string[] {
  return workItemFilterChips(projectQueryFromFormValue(form), 'project', lookups).map(chip => chip.label);
}
export function workspaceWorkItemFilterLabels(form: WorkspaceWorkItemFilterFormValue, lookups: WorkspaceFilterLabelLookups): string[] {
  return workItemFilterChips(workspaceQueryFromFormValue(form), 'workspace', lookups).map(chip => chip.label);
}
function optionLabel(options: ReadonlyArray<{ label: string; value: string }>, value: string): string {
  return options.find(option => option.value === value)?.label ?? value;
}
