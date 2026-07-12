import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type {
  ProjectCycleDto,
  ProjectPlanningCycleSummaryDto,
  ProjectPlanningSummaryDto
} from '@worktrail/contracts';

import { CycleSummaryPanelComponent } from './cycle-summary-panel.component';

const workspaceId = '10000000-0000-4000-8000-000000000001';
const projectId = '10000000-0000-4000-8000-000000000201';

const activeCycle: ProjectCycleDto = {
  id: '10000000-0000-4000-8000-000000000701',
  workspaceId,
  projectId,
  name: 'v0.2.1 Cycle Planning',
  goal: 'Prove cycle planning across assignment, reviews, reports, and exports.',
  status: 'active',
  startDate: '2026-07-13',
  endDate: '2026-07-24',
  targetPoints: 20,
  isArchived: false,
  archivedAt: null,
  createdAt: '2026-07-02T12:00:00.000Z',
  updatedAt: '2026-07-03T12:00:00.000Z'
};

function cycleSummary(cycle: ProjectCycleDto): ProjectPlanningCycleSummaryDto {
  return {
    cycle,
    progress: {
      totalCount: 6,
      openCount: 4,
      doneCount: 2,
      blockedCount: 1,
      dependencyBlockedCount: 1,
      committedEstimatePoints: 23,
      completedEstimatePoints: 8,
      unestimatedCount: 1,
      targetPoints: 20
    },
    health: {
      health: 'at_risk',
      reasons: []
    },
    scopedWorkQuery: { cycleId: cycle.id, sort: 'priority_desc' },
    closeout: null
  };
}

function planningSummary(input: Partial<ProjectPlanningSummaryDto> = {}): ProjectPlanningSummaryDto {
  return {
    project: {
      id: projectId,
      workspaceId,
      key: 'WT',
      name: 'Worktrail App',
      description: 'Reference app.',
      status: 'active',
      createdAt: '2026-07-02T12:00:00.000Z',
      updatedAt: '2026-07-03T12:00:00.000Z'
    },
    deliveryHealth: {
      health: 'healthy',
      activeMilestoneCount: 0,
      healthyMilestoneCount: 0,
      atRiskMilestoneCount: 0,
      blockedMilestoneCount: 0,
      completeMilestoneCount: 0,
      inactiveMilestoneCount: 0,
      openWorkCount: 0,
      blockedWorkCount: 0,
      dependencyBlockedWorkCount: 0,
      blockingOpenWorkCount: 0,
      overdueWorkCount: 0,
      dueSoonWorkCount: 0,
      unassignedActiveWorkCount: 0,
      staleInProgressWorkCount: 0,
      unmilestonedActiveRiskCount: 0,
      reasons: []
    },
    milestoneProgress: [],
    activeCycle: 'activeCycle' in input ? (input.activeCycle ?? null) : cycleSummary(activeCycle),
    upcomingCycle: input.upcomingCycle ?? null,
    recentlyCompletedCycle: input.recentlyCompletedCycle ?? null,
    planningReview: {
      needsAttention: [],
      upcoming: [],
      recentlyChanged: []
    },
    blockedWork: [],
    overdueWork: [],
    dueSoonWork: [],
    unassignedActiveWork: [],
    staleInProgressWork: [],
    dependencyBlockedWork: [],
    blockingOpenWork: []
  };
}

describe('CycleSummaryPanelComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CycleSummaryPanelComponent],
      providers: [provideRouter([])]
    }).compileComponents();
  });

  it('renders cycle summary cards and action links', () => {
    const fixture = TestBed.createComponent(CycleSummaryPanelComponent);
    fixture.componentInstance.projectId = projectId;
    fixture.componentInstance.summary = planningSummary();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Cycle planning');
    expect(compiled.textContent).toContain('1 visible');
    expect(compiled.textContent).toContain('v0.2.1 Cycle Planning');
    expect(compiled.textContent).toContain('At risk');
    expect(compiled.textContent).toContain('2 of 6 done');

    const reviewLink = compiled.querySelector<HTMLAnchorElement>('.cycle-summary-card__actions a');
    const workLink = [...compiled.querySelectorAll<HTMLAnchorElement>('.cycle-summary-card__actions a')]
      .find((link) => link.textContent?.includes('Open work'));

    expect(reviewLink?.getAttribute('href')).toBe(
      `/projects/${projectId}/cycles/${activeCycle.id}`
    );
    expect(workLink?.getAttribute('href')).toContain(`/projects/${projectId}/work-items`);
    expect(workLink?.getAttribute('href')).toContain(`cycleId=${activeCycle.id}`);
  });

  it('renders compact empty copy when there is no cycle context', () => {
    const fixture = TestBed.createComponent(CycleSummaryPanelComponent);
    fixture.componentInstance.projectId = projectId;
    fixture.componentInstance.summary = planningSummary({ activeCycle: null });
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('0 visible');
    expect(compiled.textContent).toContain('No active cycle context');
  });
});
