import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import type {
  MemberDto,
  PortfolioDto,
  ProjectDeliveryHealthDto,
  ProjectDto
} from '@worktrail/contracts';
import { PortfolioProjectComparisonComponent } from './portfolio-project-comparison.component';

import { CurrentUserService } from '../../core/current-user.service';
import { PortfolioPageComponent } from './portfolio-page.component';

const workspaceId = '10000000-0000-4000-8000-000000000001';
const owner: MemberDto = {
  id: '10000000-0000-4000-8000-000000000101',
  workspaceId,
  name: 'Avery Owner',
  email: 'avery.owner@example.com',
  role: 'owner',
  isActive: true,
  deactivatedAt: null,
  createdAt: '2026-07-02T12:00:00.000Z',
  updatedAt: '2026-07-03T12:00:00.000Z'
};

const project: ProjectDto = {
  id: '10000000-0000-4000-8000-000000000201',
  workspaceId,
  key: 'WT',
  name: 'Worktrail App',
  description: 'Project management reference app.',
  status: 'active',
  createdAt: '2026-07-02T12:00:00.000Z',
  updatedAt: '2026-07-03T12:00:00.000Z'
};

const deliveryHealth: ProjectDeliveryHealthDto = {
  health: 'at_risk',
  activeMilestoneCount: 1,
  healthyMilestoneCount: 0,
  atRiskMilestoneCount: 1,
  blockedMilestoneCount: 0,
  completeMilestoneCount: 0,
  inactiveMilestoneCount: 0,
  openWorkCount: 4,
  blockedWorkCount: 1,
  dependencyBlockedWorkCount: 1,
  blockingOpenWorkCount: 0,
  overdueWorkCount: 1,
  dueSoonWorkCount: 1,
  unassignedActiveWorkCount: 0,
  staleInProgressWorkCount: 0,
  unmilestonedActiveRiskCount: 0,
  reasons: [
    {
      key: 'blocked_work',
      severity: 'critical',
      message: '1 blocked work item',
      count: 1,
      countUnit: 'work_items' as const,
      query: { status: 'blocked', sort: 'priority_desc' }
    }
  ]
};

function portfolioFixture(overrides: Partial<PortfolioDto> = {}): PortfolioDto {
  const projectWorkRoute = `/projects/${project.id}/work-items`;

  return {
    generatedAt: '2026-07-11T14:30:00.000Z',
    reportFreshnessThresholdDays: 14,
    summary: {
      activeProjectCount: 1,
      blockedProjectCount: 0,
      atRiskProjectCount: 1,
      onTrackProjectCount: 0,
      overdueProjectCount: 1,
      dependencyPressureProjectCount: 1,
      missingOrStaleReportProjectCount: 1
    },
    attention: {
      needsAttention: [
        {
          type: 'delivery_risk',
          project,
          title: 'WT delivery at risk',
          message: '1 blocked work item',
          severity: 'critical',
          link: {
            label: '1 blocked work item',
            route: projectWorkRoute,
            query: { status: 'blocked', sort: 'priority_desc' },
            queryScope: 'project'
          }
        }
      ],
      communicationFreshness: [
        {
          type: 'communication_freshness',
          project,
          title: 'WT report is stale',
          message: 'Latest report is 20 days old.',
          severity: 'info',
          link: { label: 'Reports', route: `/projects/${project.id}/status` }
        }
      ],
      currentExecution: [
        {
          type: 'current_execution',
          project,
          title: 'WT active cycle',
          message: 'Sprint 12 has 4 open work items.',
          severity: 'warning',
          link: { label: 'Review cycle', route: `/projects/${project.id}/cycles/cycle-1` }
        }
      ],
      dependencyPressure: [
        {
          type: 'dependency_pressure',
          project,
          title: 'WT dependency pressure',
          message: '1 blocked by dependencies, 0 blocking downstream work.',
          severity: 'critical',
          link: {
            label: 'Dependency-blocked work',
            route: projectWorkRoute,
            query: { dependency: 'dependency_blocked', sort: 'priority_desc' },
            queryScope: 'project'
          }
        }
      ]
    },
    projects: [
      {
        project,
        deliveryHealth,
        openWorkItemCount: 4,
        blockedWorkItemCount: 1,
        dependencyBlockedWorkItemCount: 1,
        blockingOpenWorkItemCount: 0,
        overdueWorkItemCount: 1,
        staleInProgressWorkItemCount: 0,
        updatedAt: '2026-07-11T14:00:00.000Z',
        report: {
          freshness: 'stale',
          thresholdDays: 14,
          latestReport: {
            id: '10000000-0000-4000-8000-000000000701',
            workspaceId,
            projectId: project.id,
            title: 'Worktrail App status',
            statusDate: '2026-06-21',
            health: 'at_risk',
            author: owner,
            publishedAt: '2026-06-21T12:00:00.000Z',
            createdAt: '2026-06-21T12:00:00.000Z'
          },
          daysSincePublished: 20
        },
        planning: {
          activeMilestone: {
            id: '10000000-0000-4000-8000-000000000301',
            name: 'MVP Portfolio',
            status: 'active',
            health: 'at_risk',
            openCount: 4,
            targetDate: '2026-07-31'
          },
          activeCycle: {
            id: 'cycle-1',
            name: 'Sprint 12',
            health: 'at_risk',
            openWorkCount: 4,
            endDate: '2026-07-14',
            targetPoints: 8
          }
        },
        links: {
          overview: { label: 'Overview', route: `/projects/${project.id}` },
          work: { label: 'Work', route: projectWorkRoute },
          planning: { label: 'Planning', route: `/projects/${project.id}/planning` },
          reports: { label: 'Reports', route: `/projects/${project.id}/status` },
          latestReport: {
            label: 'Latest report',
            route: `/projects/${project.id}/status/10000000-0000-4000-8000-000000000701`
          },
          activeMilestone: {
            label: 'Review milestone',
            route: `/projects/${project.id}/milestones/10000000-0000-4000-8000-000000000301`
          },
          activeCycle: { label: 'Review cycle', route: `/projects/${project.id}/cycles/cycle-1` },
          blockedWork: {
            label: 'Blocked work',
            route: projectWorkRoute,
            query: { status: 'blocked', sort: 'priority_desc' },
            queryScope: 'project'
          },
          dependencyBlockedWork: {
            label: 'Dependency-blocked work',
            route: projectWorkRoute,
            query: { dependency: 'dependency_blocked', sort: 'priority_desc' },
            queryScope: 'project'
          },
          overdueWork: {
            label: 'Overdue work',
            route: projectWorkRoute,
            query: { dueDateState: 'overdue', workState: 'open', sort: 'due_date_asc' },
            queryScope: 'project'
          }
        }
      }
    ],
    ...overrides
  };
}

function seedCurrentUser(): void {
  const currentUser = TestBed.inject(CurrentUserService);
  currentUser.members.set([owner]);
  currentUser.selectMember(owner.id);
}

function setup(): {
  fixture: ComponentFixture<PortfolioPageComponent>;
  http: HttpTestingController;
} {
  seedCurrentUser();
  const fixture = TestBed.createComponent(PortfolioPageComponent);
  const http = TestBed.inject(HttpTestingController);
  fixture.detectChanges();
  return { fixture, http };
}

describe('PortfolioPageComponent', () => {
  beforeEach(async () => {
    localStorage.clear();

    await TestBed.configureTestingModule({
      imports: [PortfolioPageComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])]
    }).compileComponents();
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  it('requests the workspace portfolio for the active actor', () => {
    const { fixture, http } = setup();
    const request = http.expectOne('/api/portfolio');

    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('x-worktrail-workspace-id')).toBe(workspaceId);
    expect(request.request.headers.get('x-worktrail-member-id')).toBe(owner.id);

    request.flush(portfolioFixture());
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Portfolio review');
    expect(text).toContain('Worktrail App');
    expect(text).toContain('At risk');
    expect(text).toContain('Report stale');
  });

  it('shows a loading state while the portfolio request is pending', () => {
    const { fixture, http } = setup();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).toContain('Loading portfolio');

    http.expectOne('/api/portfolio').flush(portfolioFixture());
  });

  it('shows an empty state when there are no active project rows', () => {
    const { fixture, http } = setup();
    http.expectOne('/api/portfolio').flush(
      portfolioFixture({
        summary: {
          activeProjectCount: 0,
          blockedProjectCount: 0,
          atRiskProjectCount: 0,
          onTrackProjectCount: 0,
          overdueProjectCount: 0,
          dependencyPressureProjectCount: 0,
          missingOrStaleReportProjectCount: 0
        },
        projects: []
      })
    );
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('No active projects');
    expect(text).toContain('Portfolio review appears here once the workspace has active projects.');
  });

  it('shows an error state and can retry loading', () => {
    const { fixture, http } = setup();
    http.expectOne('/api/portfolio').flush(
      { error: { message: 'Portfolio unavailable.' } },
      { status: 500, statusText: 'Server Error' }
    );
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Portfolio unavailable');
    expect(compiled.textContent).toContain('Portfolio review could not be loaded from the API.');

    compiled.querySelector<HTMLButtonElement>('app-error-panel button')?.click();
    fixture.detectChanges();

    http.expectOne('/api/portfolio').flush(portfolioFixture());
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Worktrail App');
  });

  it('renders summary counts and bounded attention sections', () => {
    const { fixture, http } = setup();
    http.expectOne('/api/portfolio').flush(portfolioFixture());
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).toContain('Generated');
    expect(text).toContain('Report freshness threshold: 14 days');
    expect(text).toContain('Active');
    expect(text).toContain('On track');
    expect(text).toContain('Dependency pressure');
    expect(text).toContain('Needs attention');
    expect(text).toContain('WT delivery at risk');
    expect(text).toContain('Communication freshness');
    expect(text).toContain('WT report is stale');
    expect(text).toContain('Current execution');
    expect(text).toContain('WT active cycle');
  });

  it('renders project comparison context and all expected action links', () => {
    const { fixture, http } = setup();
    http.expectOne('/api/portfolio').flush(portfolioFixture());
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const text = compiled.textContent ?? '';

    expect(text).toContain('Project comparison');
    expect(text).toContain('1 blocked work item');
    expect(text).toContain('4 open');
    expect(text).toContain('1 dependency');
    expect(text).toContain('Worktrail App status');
    expect(text).toContain('20 days old · Avery Owner');
    expect(text).toContain('Milestone: MVP Portfolio · At risk');
    expect(text).toContain('Cycle: Sprint 12 · At risk');

    expect(linkHref(compiled, 'Overview')).toBe(`/projects/${project.id}`);
    expect(linkHref(compiled, 'Latest report')).toBe(
      `/projects/${project.id}/status/10000000-0000-4000-8000-000000000701`
    );
    expect(linkHref(compiled, 'Review milestone')).toBe(
      `/projects/${project.id}/milestones/10000000-0000-4000-8000-000000000301`
    );
    expect(linkHref(compiled, 'Review cycle')).toBe(`/projects/${project.id}/cycles/cycle-1`);
  });

  it('converts portfolio work queries into router query params', () => {
    const { fixture, http } = setup();
    http.expectOne('/api/portfolio').flush(portfolioFixture());
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;

    expect(linkHref(compiled, 'Blocked work')).toBe(
      `/projects/${project.id}/work-items?status=blocked&sort=priority_desc`
    );
    expect(linkHref(compiled, 'Dependency-blocked work')).toBe(
      `/projects/${project.id}/work-items?dependency=dependency_blocked&sort=priority_desc`
    );
    expect(linkHref(compiled, 'Overdue work')).toBe(
      `/projects/${project.id}/work-items?workState=open&dueDateState=overdue&sort=due_date_asc`
    );
  });
  it('refines the complete fifteen-row comparison independently of bounded attention and summary totals', () => {
    const { fixture, http } = setup();
    const base = portfolioFixture().projects[0]!;
    const projects = Array.from({ length: 15 }, (_, index) => ({
      ...structuredClone(base),
      project: { ...base.project, id: 'project-' + index, key: 'P' + (index + 1), name: 'Comparison project ' + (index + 1) },
      deliveryHealth: { ...base.deliveryHealth, health: (['blocked', 'at_risk', 'healthy'] as const)[index % 3]! },
      report: { ...base.report, freshness: (['missing', 'stale', 'fresh'] as const)[index % 3]! }
    }));
    http.expectOne('/api/portfolio').flush(portfolioFixture({ projects }));
    fixture.detectChanges();
    const comparison = fixture.debugElement.query(By.directive(PortfolioProjectComparisonComponent)).componentInstance as PortfolioProjectComparisonComponent;
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelectorAll('.project-row').length).toBe(15);
    expect(root.querySelector('[aria-label="Project comparison results"]')?.textContent).toContain('15 of 15');
    comparison.health.set('healthy');
    comparison.freshness.set('fresh');
    fixture.detectChanges();
    expect(root.querySelectorAll('.project-row').length).toBe(5);
    comparison.search.set('p15');
    fixture.detectChanges();
    expect(root.querySelectorAll('.project-row').length).toBe(1);
    expect(root.querySelector('.project-row')?.textContent).toContain('Comparison project 15');
    expect(root.querySelector('[aria-label="Project comparison results"]')?.textContent).toContain('1 of 15');
    comparison.search.set('no match');
    fixture.detectChanges();
    expect(root.textContent).toContain('No projects match these filters.');
    comparison.clearFilters();
    fixture.detectChanges();
    expect(root.querySelectorAll('.project-row').length).toBe(15);
    expect(root.querySelectorAll('details.secondary-details[open]').length).toBe(0);
    expect(root.querySelector('.attention-disclosure')?.hasAttribute('open')).toBe(false);
    expect(root.querySelector('.preview-note')?.textContent).toContain('Bounded project previews');
    http.expectNone('/api/portfolio');
  });

  it('cancels an earlier actor read and loads the newly committed workspace portfolio', () => {
    const { fixture, http } = setup();
    const pending = http.expectOne('/api/portfolio');
    const actor = TestBed.inject(CurrentUserService);
    const next = { ...owner, id: 'next-member', workspaceId: 'next-workspace' };
    actor.members.set([owner, next]);
    actor.selectMember(next.id);
    fixture.detectChanges();
    expect(pending.cancelled).toBe(true);
    const current = http.expectOne('/api/portfolio');
    expect(current.request.headers.get('x-worktrail-workspace-id')).toBe(next.workspaceId);
    current.flush(portfolioFixture({ projects: [] }));
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('Worktrail App');
  });

});

function linkHref(compiled: HTMLElement, label: string): string | null {
  const link = Array.from(compiled.querySelectorAll<HTMLAnchorElement>('a')).find(
    (candidate) => candidate.textContent?.trim() === label
  );

  return link?.getAttribute('href') ?? null;
}
