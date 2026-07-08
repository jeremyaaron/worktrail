import { describe, expect, it } from 'vitest';

import type {
  DeliveryHealthReasonDto,
  MemberDto,
  MilestoneDto,
  PlanningRiskItemDto,
  ProjectDto,
  ProjectStatusReportDetailDto,
  ProjectStatusReportSnapshotDto,
  WorkItemQuery
} from '@worktrail/contracts';
import {
  renderStatusReportMarkdown,
  statusReportMarkdownFileName
} from '../src/services/status-report-markdown-renderer.js';
import { projectWorkItemPathFromQuery } from '../src/services/work-item-query-link.js';

const project = {
  id: 'project-id',
  workspaceId: 'workspace-id',
  key: 'WT',
  name: 'Worktrail App',
  description: 'Project management reference app.',
  status: 'active',
  createdAt: '2026-07-05T00:00:00.000Z',
  updatedAt: '2026-07-05T00:00:00.000Z'
} satisfies ProjectDto;

const author = {
  id: 'member-id',
  workspaceId: project.workspaceId,
  name: 'Avery Owner',
  email: 'avery@example.com',
  role: 'owner',
  isActive: true,
  deactivatedAt: null,
  createdAt: '2026-07-05T00:00:00.000Z',
  updatedAt: '2026-07-05T00:00:00.000Z'
} satisfies MemberDto;

const milestone = {
  id: 'milestone-id',
  workspaceId: project.workspaceId,
  projectId: project.id,
  name: 'July release',
  description: 'Release readiness milestone.',
  status: 'active',
  targetDate: '2026-07-31',
  isArchived: false,
  archivedAt: null,
  createdAt: '2026-07-05T00:00:00.000Z',
  updatedAt: '2026-07-06T00:00:00.000Z'
} satisfies MilestoneDto;

const riskQuery = {
  status: 'blocked',
  sort: 'priority_desc'
} satisfies WorkItemQuery;

const healthReason = {
  key: 'blocked_work',
  severity: 'critical',
  message: '1 blocked work item needs attention.',
  count: 1,
  query: riskQuery
} satisfies DeliveryHealthReasonDto;

const riskItem = {
  id: 'work-item-id',
  displayKey: 'WT-42',
  title: 'Stabilize status report publish flow',
  status: 'blocked',
  priority: 'high',
  assignee: author,
  dueDate: '2026-07-20',
  milestone,
  updatedAt: '2026-07-06T00:00:00.000Z'
} satisfies PlanningRiskItemDto;

const snapshot = {
  snapshotVersion: 1,
  generatedAt: '2026-07-07T12:00:00.000Z',
  project: {
    id: project.id,
    key: project.key,
    name: project.name,
    status: project.status
  },
  health: {
    health: 'blocked',
    activeMilestoneCount: 1,
    healthyMilestoneCount: 0,
    atRiskMilestoneCount: 0,
    blockedMilestoneCount: 1,
    completeMilestoneCount: 0,
    inactiveMilestoneCount: 0,
    openWorkCount: 8,
    blockedWorkCount: 1,
    dependencyBlockedWorkCount: 1,
    blockingOpenWorkCount: 1,
    overdueWorkCount: 1,
    dueSoonWorkCount: 2,
    unassignedActiveWorkCount: 1,
    staleInProgressWorkCount: 1,
    unmilestonedActiveRiskCount: 0,
    reasons: [healthReason]
  },
  counts: {
    openWorkCount: 8,
    blockedWorkCount: 1,
    dependencyBlockedWorkCount: 1,
    blockingOpenWorkCount: 1,
    overdueWorkCount: 1,
    dueSoonWorkCount: 2,
    unassignedActiveWorkCount: 1,
    staleInProgressWorkCount: 1
  },
  milestones: [
    {
      id: milestone.id,
      name: milestone.name,
      status: milestone.status,
      targetDate: milestone.targetDate,
      totalCount: 10,
      openCount: 8,
      doneCount: 2,
      blockedCount: 1,
      dependencyBlockedCount: 1,
      overdueCount: 1,
      dueSoonCount: 2,
      unassignedActiveCount: 1,
      staleInProgressCount: 1,
      health: 'blocked',
      reasons: [healthReason]
    }
  ],
  risks: [
    {
      type: 'blocked',
      title: 'Blocked Work',
      count: 1,
      query: riskQuery,
      items: [riskItem]
    }
  ],
  recentWork: [riskItem]
} satisfies ProjectStatusReportSnapshotDto;

function createReport(overrides: Partial<ProjectStatusReportDetailDto> = {}) {
  return {
    id: 'report-id',
    workspaceId: project.workspaceId,
    projectId: project.id,
    title: 'Worktrail App weekly status',
    statusDate: '2026-07-07',
    health: 'blocked',
    author,
    publishedAt: '2026-07-07T12:05:00.000Z',
    createdAt: '2026-07-07T12:05:00.000Z',
    project,
    summary: 'Project is blocked by release readiness work.',
    highlights: 'Report publishing is available.',
    risks: 'The deployment path still needs review.',
    nextSteps: 'Resolve the blocked release work.',
    snapshot,
    ...overrides
  } satisfies ProjectStatusReportDetailDto;
}

describe('projectWorkItemPathFromQuery', () => {
  it('serializes project-scoped work item query fields in a stable order', () => {
    expect(
      projectWorkItemPathFromQuery(project.id, {
        projectId: 'ignored-project',
        archivedProjects: 'include',
        search: 'api gateway',
        status: 'blocked',
        sort: 'priority_desc',
        labelId: 'label-id'
      })
    ).toBe('/projects/project-id/work-items?search=api+gateway&status=blocked&labelId=label-id&sort=priority_desc');
  });

  it('omits the default sort and unsupported workspace-scope fields', () => {
    expect(
      projectWorkItemPathFromQuery(project.id, {
        blocked: true,
        sort: 'updated_desc',
        workState: 'open'
      })
    ).toBe('/projects/project-id/work-items');
  });
});

describe('renderStatusReportMarkdown', () => {
  it('renders metadata, narrative sections, snapshot notice, and count table', () => {
    const markdown = renderStatusReportMarkdown(createReport());

    expect(markdown).toContain('# Worktrail App weekly status');
    expect(markdown).toContain(
      '> Published snapshot. Values reflect the report as published. Links open current Worktrail data.'
    );
    expect(markdown).toContain('- Project: [WT - Worktrail App](/projects/project-id)');
    expect(markdown).toContain('## Summary\n\nProject is blocked by release readiness work.');
    expect(markdown).toContain('| Open work | 8 |');
    expect(markdown).toContain('| Stale in-progress work | 1 |');
  });

  it('renders milestone, risk, and work item links from the snapshot', () => {
    const markdown = renderStatusReportMarkdown(createReport());

    expect(markdown).toContain('[July release](/projects/project-id/milestones/milestone-id)');
    expect(markdown).toContain(
      '[Open current work](/projects/project-id/work-items?status=blocked&sort=priority_desc)'
    );
    expect(markdown).toContain(
      '[WT-42 - Stabilize status report publish flow](/work-items/work-item-id)'
    );
  });

  it('renders deterministic empty states for optional snapshot sections', () => {
    const markdown = renderStatusReportMarkdown(
      createReport({
        highlights: '',
        risks: '',
        nextSteps: '',
        snapshot: {
          ...snapshot,
          health: {
            ...snapshot.health,
            reasons: []
          },
          milestones: [],
          risks: [],
          recentWork: []
        }
      })
    );

    expect(markdown).toContain('No highlights provided.');
    expect(markdown).toContain('No narrative risks provided.');
    expect(markdown).toContain('No next steps provided.');
    expect(markdown).toContain('No delivery-health reasons recorded.');
    expect(markdown).toContain('No active or planned milestones captured.');
    expect(markdown).toContain('No risk sections captured.');
    expect(markdown).toContain('No recent work captured.');
  });

  it('escapes markdown syntax in narrative, table, and link text', () => {
    const markdown = renderStatusReportMarkdown(
      createReport({
        title: 'Weekly [Status](external)',
        summary: 'Line one with [link](https://example.com)\nLine two',
        snapshot: {
          ...snapshot,
          milestones: [
            {
              ...snapshot.milestones[0],
              name: 'Release | [Alpha](beta)'
            }
          ],
          recentWork: [
            {
              ...riskItem,
              title: 'Fix [export](markdown)'
            }
          ]
        }
      })
    );

    expect(markdown).toContain('# Weekly \\[Status\\]\\(external\\)');
    expect(markdown).toContain('Line one with \\[link\\]\\(https://example.com\\)\nLine two');
    expect(markdown).toContain('[Release \\| \\[Alpha\\]\\(beta\\)]');
    expect(markdown).toContain('WT-42 - Fix \\[export\\]\\(markdown\\)');
  });
});

describe('statusReportMarkdownFileName', () => {
  it('creates a stable slugged markdown filename', () => {
    expect(statusReportMarkdownFileName(createReport())).toBe(
      'worktrail-wt-2026-07-07-worktrail-app-weekly-status.md'
    );
  });

  it('falls back when the title does not contain filename-safe content', () => {
    expect(statusReportMarkdownFileName(createReport({ title: '!!!' }))).toBe(
      'worktrail-wt-2026-07-07-status-report.md'
    );
  });
});
