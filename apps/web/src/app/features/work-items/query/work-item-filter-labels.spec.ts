import type {
  LabelDto,
  MemberDto,
  MilestoneDto,
  ProjectCycleDto,
  ProjectDto,
  ProjectNavigationSummaryDto
} from '@worktrail/contracts';

import {
  projectWorkItemFilterLabels,
  workspaceWorkItemFilterLabels
} from './work-item-filter-labels';

describe('work item filter labels', () => {
  const activeMember: MemberDto = {
    id: 'member-1',
    workspaceId: 'workspace-1',
    name: 'Avery Owner',
    email: 'avery@example.com',
    role: 'owner',
    isActive: true,
    deactivatedAt: null,
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z'
  };
  const inactiveMember: MemberDto = {
    ...activeMember,
    id: 'member-2',
    name: 'Riley Alumni',
    isActive: false
  };
  const label: LabelDto = {
    id: 'label-1',
    name: 'Design',
    color: null,
    isArchived: false,
    archivedAt: null
  };
  const milestone: MilestoneDto = {
    id: 'milestone-1',
    workspaceId: 'workspace-1',
    projectId: 'project-1',
    name: 'Launch',
    description: '',
    status: 'active',
    targetDate: null,
    isArchived: false,
    archivedAt: null,
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z'
  };
  const cycle: ProjectCycleDto = {
    id: 'cycle-1',
    workspaceId: 'workspace-1',
    projectId: 'project-1',
    name: 'Cycle 1',
    goal: 'Stabilize planning.',
    status: 'active',
    startDate: '2026-07-01',
    endDate: '2026-07-15',
    targetPoints: null,
    isArchived: false,
    archivedAt: null,
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z'
  };
  const project: ProjectDto = {
    id: 'project-1',
    workspaceId: 'workspace-1',
    key: 'WT',
    name: 'Worktrail',
    description: '',
    status: 'active',
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z'
  };
  const projectSummary: ProjectNavigationSummaryDto = {
    project,
    openWorkItemCount: 2,
    blockedWorkItemCount: 0,
    overdueWorkItemCount: 0,
    updatedAt: '2026-07-01T00:00:00.000Z'
  };

  it('formats project work item filter labels with lookup names', () => {
    expect(
      projectWorkItemFilterLabels(
        {
          search: 'api',
          status: 'in_progress',
          assigneeId: inactiveMember.id,
          reporterId: activeMember.id,
          type: 'story',
          labelId: label.id,
          milestoneId: milestone.id,
          cycleId: cycle.id,
          priority: 'high',
          dueDateState: 'due_soon',
          dependency: 'blocking_open_work',
          workRisk: 'stale_in_progress',
          sort: 'priority_desc'
        },
        {
          members: [activeMember, inactiveMember],
          labels: [label],
          milestones: [milestone],
          cycles: [cycle]
        }
      )
    ).toEqual([
      'Search: api',
      'Status: In progress',
      'Assignee: Riley Alumni (inactive)',
      'Reporter: Avery Owner',
      'Type: story',
      'Label: Design',
      'Milestone: Launch',
      'Cycle: Cycle 1',
      'Priority: High',
      'Due date: Due soon',
      'Dependency: Blocking open work',
      'Risk: Stale in progress',
      'Sort: Priority high to low'
    ]);
  });

  it('formats workspace-only filter labels', () => {
    expect(
      workspaceWorkItemFilterLabels(
        {
          search: '',
          projectId: project.id,
          status: '',
          workState: 'open',
          assigneeId: '',
          reporterId: '',
          type: '',
          labelId: '',
          milestoneId: '',
          cycleId: '',
          priority: '',
          dueDateState: '',
          blocked: 'true',
          dependency: '',
          workRisk: '',
          archivedProjects: 'only',
          sort: 'updated_desc'
        },
        {
          members: [],
          labels: [],
          milestones: [],
          cycles: [],
          projectSummaries: [projectSummary]
        }
      )
    ).toEqual([
      'Project: WT · Worktrail',
      'State: Open',
      'Blocked: Blocked only',
      'Projects: Archived only'
    ]);
  });
});
