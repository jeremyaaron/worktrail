import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type {
  MemberDto,
  PortfolioDto,
  ProjectDeliveryHealthDto,
  ProjectDto
} from '@worktrail/contracts';

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
      query: { status: 'blocked', sort: 'priority_desc' }
    }
  ]
};

function portfolioFixture(overrides: Partial<PortfolioDto> = {}): PortfolioDto {
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
      needsAttention: [],
      communicationFreshness: [],
      currentExecution: [],
      dependencyPressure: []
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
          latestReport: null,
          daysSincePublished: 20
        },
        planning: {
          activeMilestone: null,
          activeCycle: null
        },
        links: {
          overview: { label: 'Overview', route: `/projects/${project.id}` },
          work: { label: 'Work', route: `/projects/${project.id}/work-items` },
          planning: { label: 'Planning', route: `/projects/${project.id}/planning` },
          reports: { label: 'Reports', route: `/projects/${project.id}/status` }
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
    expect(text).toContain('At Risk');
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
});
