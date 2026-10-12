import type { QuickFindResultDto } from '@worktrail/contracts';

import { workItemFilesFragment } from '../work-items/work-item-files-target';
import { routerLinkQueryParamsFromWorkItemQuery } from '../work-items/query/work-item-query-serialization';
import type {
  QuickFindNavigationEntry,
  QuickFindRouteTarget
} from './quick-find-model';

export const quickFindGlobalNavigationEntries = [
  {
    id: 'global-my-work',
    label: 'My Work',
    commands: ['/my-work']
  },
  {
    id: 'global-inbox',
    label: 'Inbox',
    commands: ['/inbox']
  },
  {
    id: 'global-work-items',
    label: 'Work Items',
    commands: ['/work-items']
  },
  {
    id: 'global-projects',
    label: 'Projects',
    commands: ['/projects']
  },
  {
    id: 'global-portfolio',
    label: 'Portfolio',
    commands: ['/portfolio']
  },
  {
    id: 'global-create-work-item',
    label: 'Create work item',
    commands: ['/work-items/new']
  }
] as const satisfies readonly QuickFindNavigationEntry[];

export function quickFindCurrentProjectNavigationEntries(
  projectId: string | null
): readonly QuickFindNavigationEntry[] {
  if (projectId === null) {
    return [];
  }

  return [
    {
      id: 'project-overview',
      label: 'Project overview',
      commands: ['/projects', projectId]
    },
    {
      id: 'project-work',
      label: 'Work',
      commands: ['/projects', projectId, 'work-items']
    },
    {
      id: 'project-board',
      label: 'Board',
      commands: ['/projects', projectId, 'board']
    },
    {
      id: 'project-planning',
      label: 'Planning',
      commands: ['/projects', projectId, 'planning']
    },
    {
      id: 'project-reports',
      label: 'Reports',
      commands: ['/projects', projectId, 'status']
    },
    {
      id: 'project-settings',
      label: 'Project settings',
      commands: ['/projects', projectId, 'settings']
    }
  ];
}

export function quickFindResultDestination(result: QuickFindResultDto): QuickFindRouteTarget {
  switch (result.kind) {
    case 'project':
      return {
        commands: ['/projects', result.project.id]
      };
    case 'work_item':
      return {
        commands: ['/work-items', result.workItem.id]
      };
    case 'milestone':
      return {
        commands: ['/projects', result.project.id, 'milestones', result.milestone.id]
      };
    case 'cycle':
      return {
        commands: ['/projects', result.project.id, 'cycles', result.cycle.id]
      };
    case 'report':
      return {
        commands: ['/projects', result.project.id, 'status', result.report.id]
      };
    case 'attachment':
      return {
        commands: ['/work-items', result.workItem.id],
        fragment: workItemFilesFragment
      };
    default:
      return assertNever(result);
  }
}

export function quickFindResultOptionId(result: QuickFindResultDto): string {
  switch (result.kind) {
    case 'project':
      return `quick-find-project-${result.project.id}`;
    case 'work_item':
      return `quick-find-work-item-${result.workItem.id}`;
    case 'milestone':
      return `quick-find-milestone-${result.milestone.id}`;
    case 'cycle':
      return `quick-find-cycle-${result.cycle.id}`;
    case 'report':
      return `quick-find-report-${result.report.id}`;
    case 'attachment':
      return `quick-find-attachment-${result.attachment.id}`;
    default:
      return assertNever(result);
  }
}

export function quickFindWorkItemOverflowDestination(
  normalizedQuery: string
): QuickFindRouteTarget {
  const queryParams = routerLinkQueryParamsFromWorkItemQuery(
    {
      search: normalizedQuery,
      archivedProjects: 'include'
    },
    'workspace'
  );

  if (queryParams === null) {
    throw new Error('Quick Find overflow requires canonical workspace query parameters.');
  }

  return {
    commands: ['/work-items'],
    queryParams
  };
}

function assertNever(value: never): never {
  throw new Error(`Unsupported Quick Find result kind: ${String(value)}`);
}
