import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import type { MemberDto, MilestoneDto, MilestoneReviewDto, ProjectDto } from '@worktrail/contracts';
import { BehaviorSubject } from 'rxjs';

import { CurrentUserService } from '../../core/current-user.service';
import { ProjectMilestoneReviewPageComponent } from './project-milestone-review-page.component';

const workspaceId = '10000000-0000-4000-8000-000000000001';
const projectId = '10000000-0000-4000-8000-000000000201';
const milestoneId = '10000000-0000-4000-8000-000000000501';

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

const activeMilestone: MilestoneDto = {
  id: milestoneId,
  workspaceId,
  projectId,
  name: 'v0.1.7',
  description: 'Milestone review release.',
  status: 'active',
  targetDate: '2026-07-22',
  isArchived: false,
  archivedAt: null,
  createdAt: '2026-07-03T12:00:00.000Z',
  updatedAt: '2026-07-04T12:00:00.000Z'
};

function milestoneReview(input: Partial<MilestoneReviewDto> = {}): MilestoneReviewDto {
  const milestone = input.milestone ?? activeMilestone;

  return {
    project: input.project ?? activeProject,
    milestone,
    progress: input.progress ?? {
      milestone,
      totalCount: 6,
      doneCount: 2,
      openCount: 4,
      blockedCount: 1,
      dependencyBlockedCount: 1,
      overdueCount: 1,
      dueSoonCount: 2,
      unassignedActiveCount: 1,
      staleInProgressCount: 0,
      health: 'at_risk',
      reasons: [
        {
          key: 'dependency_blocked',
          severity: 'warning',
          message: '1 dependency-blocked work item',
          count: 1,
          query: { dependency: 'dependency_blocked', sort: 'priority_desc' }
        }
      ]
    },
    scopedWorkQuery: input.scopedWorkQuery ?? {
      milestoneId,
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
    riskSections: input.riskSections ?? [],
    recentlyChangedWork: input.recentlyChangedWork ?? []
  };
}

describe('ProjectMilestoneReviewPageComponent', () => {
  let paramMapSubject: BehaviorSubject<ReturnType<typeof convertToParamMap>>;

  beforeEach(async () => {
    paramMapSubject = new BehaviorSubject(convertToParamMap({ projectId, milestoneId }));

    await TestBed.configureTestingModule({
      imports: [ProjectMilestoneReviewPageComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ projectId, milestoneId })
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

  it('loads and renders the milestone review shell', () => {
    const fixture = TestBed.createComponent(ProjectMilestoneReviewPageComponent);
    const http = TestBed.inject(HttpTestingController);

    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Loading milestone review');

    const request = http.expectOne(`/api/projects/${projectId}/milestones/${milestoneId}/review`);
    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('x-worktrail-member-id')).toBe(owner.id);
    request.flush(milestoneReview());
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('v0.1.7');
    expect(compiled.textContent).toContain('Milestone review release.');
    expect(compiled.textContent).toContain('WT');
    expect(compiled.textContent).toContain('at risk');
    expect(compiled.textContent).toContain('6');
    expect(compiled.textContent).toContain('4');
    expect(compiled.textContent).toContain('1 reason surfaced for this milestone.');

    const scopedWorkLink = Array.from(compiled.querySelectorAll<HTMLAnchorElement>('a')).find(
      (link) => link.textContent?.trim() === 'Open scoped work'
    );
    expect(scopedWorkLink?.getAttribute('href')).toBe(
      `/projects/${projectId}/work-items?milestoneId=${milestoneId}&sort=priority_desc`
    );
  });

  it('shows the read-only notice for archived milestone reviews', () => {
    const fixture = TestBed.createComponent(ProjectMilestoneReviewPageComponent);
    const http = TestBed.inject(HttpTestingController);
    const archivedMilestone: MilestoneDto = {
      ...activeMilestone,
      isArchived: true,
      archivedAt: '2026-07-05T12:00:00.000Z'
    };

    fixture.detectChanges();
    http.expectOne(`/api/projects/${projectId}/milestones/${milestoneId}/review`).flush(
      milestoneReview({
        milestone: archivedMilestone,
        progress: {
          ...milestoneReview().progress,
          milestone: archivedMilestone
        }
      })
    );
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Archived');
    expect(compiled.textContent).toContain('Read-only review');
  });

  it('surfaces load errors and retries the review request', () => {
    const fixture = TestBed.createComponent(ProjectMilestoneReviewPageComponent);
    const http = TestBed.inject(HttpTestingController);

    fixture.detectChanges();
    http
      .expectOne(`/api/projects/${projectId}/milestones/${milestoneId}/review`)
      .flush({ error: 'failed' }, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Milestone review could not be loaded.');

    compiled.querySelector<HTMLButtonElement>('button')?.click();
    fixture.detectChanges();

    const retry = http.expectOne(`/api/projects/${projectId}/milestones/${milestoneId}/review`);
    expect(retry.request.method).toBe('GET');
    retry.flush(milestoneReview());
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('v0.1.7');
  });
});
