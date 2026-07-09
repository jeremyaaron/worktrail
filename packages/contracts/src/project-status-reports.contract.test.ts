import { describe, expect, expectTypeOf, it } from 'vitest';

import type {
  ActivityEventType,
  CreateProjectStatusReportRequest,
  DeliveryHealthReasonDto,
  MemberDto,
  MilestoneDto,
  PlanningRiskItemDto,
  ProjectDto,
  ProjectStatusReportCycleSnapshotDto,
  ProjectStatusReportDetailDto,
  ProjectStatusReportDraftDto,
  ProjectStatusReportLinkDto,
  ProjectStatusReportLinkType,
  ProjectStatusReportRiskSnapshotDto,
  ProjectStatusReportRiskType,
  ProjectStatusReportSnapshotDto,
  ProjectStatusReportSummaryDto,
  WorkItemQuery
} from './index.js';

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
  milestoneId: milestone.id,
  workRisk: 'stale_in_progress',
  sort: 'priority_desc'
} satisfies WorkItemQuery;

const healthReason = {
  key: 'stale_in_progress',
  severity: 'warning',
  message: '1 work item is stale in progress.',
  count: 1,
  query: riskQuery
} satisfies DeliveryHealthReasonDto;

const cycleLink = {
  type: 'cycle_review',
  label: 'Open cycle review',
  projectId: project.id,
  cycleId: 'cycle-id'
} satisfies ProjectStatusReportLinkDto;

const cycleSnapshot = {
  id: 'cycle-id',
  name: 'v0.2.1 Cycle Planning',
  goal: 'Commit and review cycle planning scope.',
  status: 'active',
  startDate: '2026-07-06',
  endDate: '2026-07-17',
  targetPoints: 24,
  committedEstimatePoints: 21,
  completedEstimatePoints: 8,
  openWorkCount: 4,
  blockedWorkCount: 1,
  dependencyBlockedWorkCount: 1,
  unestimatedWorkCount: 1,
  health: 'at_risk',
  reasons: [healthReason],
  links: [cycleLink]
} satisfies ProjectStatusReportCycleSnapshotDto;

const riskItem = {
  id: 'work-item-id',
  displayKey: 'WT-42',
  title: 'Stabilize status report publish flow',
  status: 'in_progress',
  priority: 'high',
  assignee: author,
  dueDate: '2026-07-20',
  milestone,
  updatedAt: '2026-07-06T00:00:00.000Z'
} satisfies PlanningRiskItemDto;

const snapshot = {
  snapshotVersion: 1,
  generatedAt: '2026-07-07T00:00:00.000Z',
  project: {
    id: project.id,
    key: project.key,
    name: project.name,
    status: project.status
  },
  health: {
    health: 'at_risk',
    activeMilestoneCount: 1,
    healthyMilestoneCount: 0,
    atRiskMilestoneCount: 1,
    blockedMilestoneCount: 0,
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
      health: 'at_risk',
      reasons: [healthReason]
    }
  ],
  cycle: cycleSnapshot,
  risks: [
    {
      type: 'stale_in_progress',
      title: 'Stale in-progress work',
      count: 1,
      query: riskQuery,
      items: [riskItem]
    } satisfies ProjectStatusReportRiskSnapshotDto
  ],
  recentWork: [riskItem]
} satisfies ProjectStatusReportSnapshotDto;

describe('project status report contracts', () => {
  it('supports immutable report snapshots with health, risk, and work-risk links', () => {
    expect(snapshot.snapshotVersion).toBe(1);
    expect(snapshot.health.health).toBe('at_risk');
    expect(snapshot.counts.staleInProgressWorkCount).toBe(1);
    expect(snapshot.milestones[0]?.name).toBe('July release');
    expect(snapshot.cycle?.links[0]?.type).toBe('cycle_review');
    expect(snapshot.risks[0]?.query.workRisk).toBe('stale_in_progress');
    expect(snapshot.recentWork[0]?.displayKey).toBe('WT-42');
    expectTypeOf(snapshot).toMatchTypeOf<ProjectStatusReportSnapshotDto>();
  });

  it('supports report draft, create request, summary, and detail shapes', () => {
    const draft = {
      project,
      title: 'Status update - 2026-07-07',
      statusDate: '2026-07-07',
      summary: 'Project is at risk with one stale in-progress item.',
      highlights: '',
      risks: 'Stale in-progress work needs attention.',
      nextSteps: 'Review the publish flow.',
      snapshot
    } satisfies ProjectStatusReportDraftDto;
    const createRequest = {
      title: draft.title,
      statusDate: draft.statusDate,
      summary: draft.summary,
      highlights: draft.highlights,
      risks: draft.risks,
      nextSteps: draft.nextSteps,
      snapshot: draft.snapshot
    } satisfies CreateProjectStatusReportRequest;
    const summary = {
      id: 'report-id',
      workspaceId: project.workspaceId,
      projectId: project.id,
      title: draft.title,
      statusDate: draft.statusDate,
      health: 'at_risk',
      author,
      publishedAt: '2026-07-07T00:05:00.000Z',
      createdAt: '2026-07-07T00:05:00.000Z'
    } satisfies ProjectStatusReportSummaryDto;
    const detail = {
      ...summary,
      project,
      summary: draft.summary,
      highlights: draft.highlights,
      risks: draft.risks,
      nextSteps: draft.nextSteps,
      snapshot
    } satisfies ProjectStatusReportDetailDto;

    expect(createRequest.snapshot?.snapshotVersion).toBe(1);
    expect(summary.author.role).toBe('owner');
    expect(detail.project.key).toBe('WT');
    expect(detail.snapshot.risks[0]?.items[0]?.title).toContain('publish flow');
    expectTypeOf(draft).toMatchTypeOf<ProjectStatusReportDraftDto>();
    expectTypeOf(createRequest).toMatchTypeOf<CreateProjectStatusReportRequest>();
    expectTypeOf(summary).toMatchTypeOf<ProjectStatusReportSummaryDto>();
    expectTypeOf(detail).toMatchTypeOf<ProjectStatusReportDetailDto>();
  });

  it('supports semantic report link contracts and published activity events', () => {
    const linkTypes = [
      'project_work',
      'milestone_review',
      'cycle_review',
      'work_item'
    ] satisfies ProjectStatusReportLinkType[];
    const links: ProjectStatusReportLinkDto[] = [
      {
        type: 'project_work',
        label: 'Open stale work',
        projectId: project.id,
        query: riskQuery
      },
      {
        type: 'milestone_review',
        label: 'Open milestone review',
        projectId: project.id,
        milestoneId: milestone.id
      },
      cycleLink,
      {
        type: 'work_item',
        label: 'Open WT-42',
        projectId: project.id,
        workItemId: riskItem.id
      }
    ];
    const riskTypes = [
      'blocked',
      'dependency_blocked',
      'overdue',
      'due_soon',
      'unassigned_active',
      'stale_in_progress',
      'blocking_open_work'
    ] satisfies ProjectStatusReportRiskType[];
    const eventType = 'status_report.published' satisfies ActivityEventType;

    expect(linkTypes).toEqual(['project_work', 'milestone_review', 'cycle_review', 'work_item']);
    expect(links[0]?.query?.workRisk).toBe('stale_in_progress');
    expect(links[2]?.cycleId).toBe('cycle-id');
    expect(riskTypes).toContain('blocking_open_work');
    expect(eventType).toBe('status_report.published');
  });
});
