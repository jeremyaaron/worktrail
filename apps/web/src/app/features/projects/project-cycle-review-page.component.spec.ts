import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import type {
  MemberDto,
  PlanningRiskItemDto,
  ProjectCycleDto,
  ProjectCycleReviewDto,
  ProjectDto
} from '@worktrail/contracts';
import { BehaviorSubject } from 'rxjs';

import { CurrentUserService } from '../../core/current-user.service';
import { ProjectCycleReviewPageComponent } from './project-cycle-review-page.component';

const workspaceId = '10000000-0000-4000-8000-000000000001';
const projectId = '10000000-0000-4000-8000-000000000201';
const cycleId = '10000000-0000-4000-8000-000000000701';

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

const activeProject: ProjectDto = {
  id: projectId,
  workspaceId,
  key: 'WT',
  name: 'Worktrail App',
  description: 'Project management reference application.',
  status: 'active',
  createdAt: '2026-07-02T12:00:00.000Z',
  updatedAt: '2026-07-03T12:00:00.000Z'
};

const activeCycle: ProjectCycleDto = {
  id: cycleId,
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

const blockedWorkItem: PlanningRiskItemDto = {
  id: '10000000-0000-4000-8000-000000000401',
  displayKey: 'WT-1',
  title: 'Resolve active cycle blocker',
  status: 'blocked',
  priority: 'urgent',
  assignee: owner,
  dueDate: '2026-07-19',
  milestone: null,
  updatedAt: '2026-07-04T10:30:00.000Z'
};

function cycleReview(input: Partial<ProjectCycleReviewDto> = {}): ProjectCycleReviewDto {
  return {
    project: input.project ?? activeProject,
    cycle: input.cycle ?? activeCycle,
    progress: input.progress ?? {
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
    health: input.health ?? {
      health: 'at_risk',
      reasons: [
        {
          key: 'cycle_over_target',
          severity: 'warning',
          message: 'Cycle estimate is 3 points over target.',
          count: 3,
          query: { cycleId, sort: 'priority_desc' }
        }
      ]
    },
    scopedWorkQuery: input.scopedWorkQuery ?? {
      cycleId,
      sort: 'priority_desc'
    },
    scopeBreakdown: input.scopeBreakdown ?? {
      statusCounts: {
        backlog: 1,
        ready: 1,
        in_progress: 2,
        blocked: 1,
        done: 1,
        canceled: 0
      },
      priorityCounts: {
        low: 0,
        medium: 2,
        high: 3,
        urgent: 1
      },
      assignedCount: 5,
      unassignedCount: 1,
      dueDate: {
        overdueCount: 1,
        dueSoonCount: 2,
        laterCount: 1,
        noneCount: 2
      },
      dependency: {
        dependencyBlockedCount: 1,
        blockingOpenWorkCount: 1
      }
    },
    riskSections: input.riskSections ?? [
      {
        type: 'blocked',
        title: 'Blocked work',
        description: 'Work items currently blocked inside this cycle.',
        count: 1,
        query: { cycleId, status: 'blocked', sort: 'priority_desc' },
        items: [blockedWorkItem]
      }
    ],
    recentlyChangedWork: input.recentlyChangedWork ?? [blockedWorkItem]
  };
}

describe('ProjectCycleReviewPageComponent', () => {
  let paramMapSubject: BehaviorSubject<ReturnType<typeof convertToParamMap>>;

  beforeEach(async () => {
    paramMapSubject = new BehaviorSubject(convertToParamMap({ projectId, cycleId }));

    await TestBed.configureTestingModule({
      imports: [ProjectCycleReviewPageComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ projectId, cycleId })
            },
            paramMap: paramMapSubject.asObservable()
          }
        }
      ]
    }).compileComponents();

    const currentUser = TestBed.inject(CurrentUserService);
    currentUser.members.set([owner]);
    currentUser.selectMember(owner.id);
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  it('loads and renders the cycle review shell', () => {
    const fixture = TestBed.createComponent(ProjectCycleReviewPageComponent);
    const http = TestBed.inject(HttpTestingController);

    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Loading cycle review');

    const request = http.expectOne(`/api/projects/${projectId}/cycles/${cycleId}/review`);
    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('x-worktrail-member-id')).toBe(owner.id);
    request.flush(cycleReview());
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Cycle review · Live view');
    expect(compiled.textContent).toContain('v0.2.1 Cycle Planning');
    expect(compiled.textContent).toContain('Active');
    expect(compiled.textContent).toContain('Jul 13, 2026 - Jul 24, 2026');
    expect(compiled.textContent).toContain('At risk');
    expect(compiled.textContent).toContain('33%');
    expect(compiled.textContent).toContain('Target progress');
    expect(compiled.textContent).toContain('3 over target');
    expect(compiled.textContent).toContain('Committed');
    expect(compiled.textContent).toContain('Unestimated');
    expect(compiled.textContent).toContain('Scope');
    expect(compiled.textContent).toContain('Urgent');
    expect(compiled.textContent).toContain('Ownership, dates, and dependencies');
    expect(compiled.textContent).toContain('Needs attention');
    expect(compiled.textContent).toContain('Blocked work');
    expect(compiled.textContent).toContain('Resolve active cycle blocker');
    expect(compiled.textContent).toContain('Recently changed work');
    expect(compiled.textContent).toContain('Cycle estimate is 3 points over target.');

    const scopedWorkLink = Array.from(compiled.querySelectorAll<HTMLAnchorElement>('a')).find(
      (link) => link.textContent?.trim() === 'Open cycle work'
    );
    expect(scopedWorkLink?.getAttribute('href')).toBe(
      `/projects/${projectId}/work-items?cycleId=${cycleId}&sort=priority_desc`
    );

    const riskLink = Array.from(compiled.querySelectorAll<HTMLAnchorElement>('.risk-section a')).find(
      (link) => link.textContent?.trim() === 'Open work'
    );
    expect(riskLink?.getAttribute('href')).toContain(`/projects/${projectId}/work-items`);
    expect(riskLink?.getAttribute('href')).toContain('status=blocked');

    const workLink = compiled.querySelector<HTMLAnchorElement>('.work-row');
    expect(workLink?.getAttribute('href')).toContain(`/work-items/${blockedWorkItem.id}`);
    expect(decodeURIComponent(workLink?.getAttribute('href') ?? '')).toContain(
      `/projects/${projectId}/cycles/${cycleId}`
    );
  });

  it('shows the read-only notice for archived cycle reviews', () => {
    const fixture = TestBed.createComponent(ProjectCycleReviewPageComponent);
    const http = TestBed.inject(HttpTestingController);

    fixture.detectChanges();
    http.expectOne(`/api/projects/${projectId}/cycles/${cycleId}/review`).flush(
      cycleReview({
        cycle: {
          ...activeCycle,
          isArchived: true,
          archivedAt: '2026-07-25T12:00:00.000Z'
        }
      })
    );
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Archived');
    expect(compiled.textContent).toContain('Read-only review');
  });

  it('surfaces load errors and retries the review request', () => {
    const fixture = TestBed.createComponent(ProjectCycleReviewPageComponent);
    const http = TestBed.inject(HttpTestingController);

    fixture.detectChanges();
    http
      .expectOne(`/api/projects/${projectId}/cycles/${cycleId}/review`)
      .flush({ error: 'failed' }, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Cycle review could not be loaded.');

    compiled.querySelector<HTMLButtonElement>('button')?.click();
    fixture.detectChanges();

    const retry = http.expectOne(`/api/projects/${projectId}/cycles/${cycleId}/review`);
    expect(retry.request.method).toBe('GET');
    retry.flush(cycleReview());
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'v0.2.1 Cycle Planning'
    );
  });

  it('keeps empty risk and recent movement states compact', () => {
    const fixture = TestBed.createComponent(ProjectCycleReviewPageComponent);
    const http = TestBed.inject(HttpTestingController);

    fixture.detectChanges();
    http.expectOne(`/api/projects/${projectId}/cycles/${cycleId}/review`).flush(
      cycleReview({
        riskSections: [
          {
            type: 'unestimated',
            title: 'Unestimated work',
            description: 'Open cycle work without an estimate.',
            count: 0,
            query: { cycleId, sort: 'priority_desc' },
            items: []
          }
        ],
        recentlyChangedWork: []
      })
    );
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Unestimated work');
    expect(compiled.textContent).toContain('No matching work');
    expect(compiled.textContent).toContain('No recent movement');
  });

  it('shows a specific not-found state', () => {
    const fixture = TestBed.createComponent(ProjectCycleReviewPageComponent);
    const http = TestBed.inject(HttpTestingController);

    fixture.detectChanges();
    http
      .expectOne(`/api/projects/${projectId}/cycles/${cycleId}/review`)
      .flush({ error: { message: 'Project cycle not found.' } }, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Cycle review not found');
    expect(compiled.textContent).toContain('The selected cycle could not be found.');
  });

  it('shows a specific permission state', () => {
    const fixture = TestBed.createComponent(ProjectCycleReviewPageComponent);
    const http = TestBed.inject(HttpTestingController);

    fixture.detectChanges();
    http
      .expectOne(`/api/projects/${projectId}/cycles/${cycleId}/review`)
      .flush({ error: { message: 'Forbidden.' } }, { status: 403, statusText: 'Forbidden' });
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Cycle review restricted');
    expect(compiled.textContent).toContain('You do not have permission to view this cycle review.');
  });
});
