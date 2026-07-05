import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import type {
  MemberDto,
  MilestoneDto,
  PlanningRiskItemDto,
  PlanningReviewDto,
  ProjectDto,
  ProjectDeliveryHealthDto,
  ProjectPlanningSummaryDto
} from '@worktrail/contracts';
import { BehaviorSubject } from 'rxjs';

import { CurrentUserService } from '../../core/current-user.service';
import { ProjectPlanningPageComponent } from './project-planning-page.component';

const projectId = '10000000-0000-4000-8000-000000000201';
const workspaceId = '10000000-0000-4000-8000-000000000001';

const defaultDeliveryHealth: ProjectDeliveryHealthDto = {
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
};

const emptyPlanningReview: PlanningReviewDto = {
  needsAttention: [],
  upcoming: [],
  recentlyChanged: []
};

const blockedDeliveryHealth: ProjectDeliveryHealthDto = {
  ...defaultDeliveryHealth,
  health: 'blocked',
  activeMilestoneCount: 1,
  atRiskMilestoneCount: 0,
  blockedMilestoneCount: 1,
  openWorkCount: 6,
  blockedWorkCount: 1,
  dependencyBlockedWorkCount: 1,
  reasons: [
    {
      key: 'blocked_work',
      severity: 'critical',
      message: '1 blocked work item',
      count: 1,
      query: { status: 'blocked', sort: 'priority_desc' }
    },
    {
      key: 'dependency_blocked',
      severity: 'critical',
      message: '1 dependency-blocked work item',
      count: 1,
      query: { dependency: 'dependency_blocked', sort: 'priority_desc' }
    }
  ]
};

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

const contributor: MemberDto = {
  id: '10000000-0000-4000-8000-000000000103',
  workspaceId,
  name: 'Case Contributor',
  email: 'case.contributor@example.com',
  role: 'contributor',
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
  description: 'MVP project management reference application.',
  status: 'active',
  createdAt: '2026-07-02T12:00:00.000Z',
  updatedAt: '2026-07-03T12:00:00.000Z'
};

const archivedProject: ProjectDto = {
  ...activeProject,
  status: 'archived'
};

const activeMilestone: MilestoneDto = {
  id: '10000000-0000-4000-8000-000000000501',
  workspaceId,
  projectId,
  name: 'v0.0.3',
  description: 'Planning and ordering release.',
  status: 'active',
  targetDate: '2026-07-18',
  isArchived: false,
  archivedAt: null,
  createdAt: '2026-07-03T12:00:00.000Z',
  updatedAt: '2026-07-04T12:00:00.000Z'
};

const blockedWorkItem: PlanningRiskItemDto = {
  id: '10000000-0000-4000-8000-000000000301',
  displayKey: 'WT-1',
  title: 'Resolve deployment blocker',
  status: 'blocked',
  priority: 'urgent',
  assignee: owner,
  dueDate: '2026-07-06',
  milestone: activeMilestone,
  updatedAt: '2026-07-04T11:00:00.000Z'
};

const overdueWorkItem: PlanningRiskItemDto = {
  id: '10000000-0000-4000-8000-000000000302',
  displayKey: 'WT-2',
  title: 'Finish stale planning copy',
  status: 'in_progress',
  priority: 'high',
  assignee: null,
  dueDate: '2026-07-01',
  milestone: null,
  updatedAt: '2026-06-25T12:00:00.000Z'
};

const dependencyBlockedWorkItem: PlanningRiskItemDto = {
  id: '10000000-0000-4000-8000-000000000303',
  displayKey: 'WT-3',
  title: 'Wait for upstream schema work',
  status: 'ready',
  priority: 'high',
  assignee: owner,
  dueDate: null,
  milestone: activeMilestone,
  updatedAt: '2026-07-04T10:00:00.000Z'
};

const blockingOpenWorkItem: PlanningRiskItemDto = {
  id: '10000000-0000-4000-8000-000000000304',
  displayKey: 'WT-4',
  title: 'Finish shared dependency package',
  status: 'in_progress',
  priority: 'urgent',
  assignee: contributor,
  dueDate: '2026-07-12',
  milestone: null,
  updatedAt: '2026-07-04T09:00:00.000Z'
};

const populatedPlanningReview: PlanningReviewDto = {
  needsAttention: [
    {
      id: blockedWorkItem.id,
      kind: 'work_item',
      title: blockedWorkItem.title,
      detail: 'blocked · urgent',
      severity: 'critical',
      workItemId: blockedWorkItem.id,
      milestoneId: activeMilestone.id,
      displayKey: blockedWorkItem.displayKey,
      dueDate: blockedWorkItem.dueDate,
      updatedAt: blockedWorkItem.updatedAt,
      query: null
    }
  ],
  upcoming: [
    {
      id: activeMilestone.id,
      kind: 'milestone',
      title: activeMilestone.name,
      detail: 'Target date 2026-07-18.',
      severity: 'info',
      workItemId: null,
      milestoneId: activeMilestone.id,
      displayKey: null,
      dueDate: activeMilestone.targetDate,
      updatedAt: activeMilestone.updatedAt,
      query: { milestoneId: activeMilestone.id, sort: 'due_date_asc' }
    }
  ],
  recentlyChanged: [
    {
      id: blockingOpenWorkItem.id,
      kind: 'work_item',
      title: blockingOpenWorkItem.title,
      detail: 'in_progress · urgent',
      severity: 'info',
      workItemId: blockingOpenWorkItem.id,
      milestoneId: null,
      displayKey: blockingOpenWorkItem.displayKey,
      dueDate: blockingOpenWorkItem.dueDate,
      updatedAt: blockingOpenWorkItem.updatedAt,
      query: null
    }
  ]
};

const defaultPlanningSummary: ProjectPlanningSummaryDto = {
  project: activeProject,
  deliveryHealth: blockedDeliveryHealth,
  milestoneProgress: [
    {
      milestone: activeMilestone,
      totalCount: 4,
      doneCount: 2,
      openCount: 2,
      blockedCount: 1,
      dependencyBlockedCount: 0,
      overdueCount: 1,
      dueSoonCount: 0,
      unassignedActiveCount: 0,
      staleInProgressCount: 0,
      health: 'blocked',
      reasons: [
        {
          key: 'blocked_work',
          severity: 'critical',
          message: '1 blocked work item',
          count: 1,
          query: {
            milestoneId: activeMilestone.id,
            status: 'blocked',
            sort: 'priority_desc'
          }
        }
      ]
    }
  ],
  planningReview: populatedPlanningReview,
  blockedWork: [blockedWorkItem],
  overdueWork: [overdueWorkItem],
  dueSoonWork: [],
  unassignedActiveWork: [overdueWorkItem],
  staleInProgressWork: [overdueWorkItem],
  dependencyBlockedWork: [dependencyBlockedWorkItem],
  blockingOpenWork: [blockingOpenWorkItem]
};

const archivedMilestone: MilestoneDto = {
  id: '10000000-0000-4000-8000-000000000502',
  workspaceId,
  projectId,
  name: 'legacy target',
  description: '',
  status: 'canceled',
  targetDate: null,
  isArchived: true,
  archivedAt: '2026-07-01T12:00:00.000Z',
  createdAt: '2026-06-25T12:00:00.000Z',
  updatedAt: '2026-07-01T12:00:00.000Z'
};

function seedCurrentUser(member: MemberDto = owner) {
  const currentUser = TestBed.inject(CurrentUserService);
  currentUser.members.set([owner, contributor]);
  currentUser.selectMember(member.id);
}

function setupPlanningPage(
  project: ProjectDto = activeProject,
  milestones: MilestoneDto[] = [activeMilestone, archivedMilestone],
  member: MemberDto = owner,
  planningSummary: ProjectPlanningSummaryDto = {
    ...defaultPlanningSummary,
    project
  }
) {
  seedCurrentUser(member);
  const fixture = TestBed.createComponent(ProjectPlanningPageComponent);
  const http = TestBed.inject(HttpTestingController);
  fixture.detectChanges();
  http.expectOne(`/api/projects/${projectId}`).flush(project);
  http.expectOne(`/api/projects/${projectId}/milestones?includeArchived=true`).flush(milestones);
  http.expectOne(`/api/projects/${projectId}/planning-summary`).flush(planningSummary);
  fixture.detectChanges();
  return { fixture, http };
}

describe('ProjectPlanningPageComponent', () => {
  let queryParamMapSubject: BehaviorSubject<ReturnType<typeof convertToParamMap>>;

  beforeEach(async () => {
    queryParamMapSubject = new BehaviorSubject(convertToParamMap({}));

    await TestBed.configureTestingModule({
      imports: [ProjectPlanningPageComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ projectId }),
              queryParamMap: convertToParamMap({})
            },
            queryParamMap: queryParamMapSubject.asObservable()
          }
        }
      ]
    }).compileComponents();
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  it('opens planning review with project navigation links', () => {
    const { fixture } = setupPlanningPage();

    const compiled = fixture.nativeElement as HTMLElement;
    const links = Array.from(compiled.querySelectorAll<HTMLAnchorElement>('nav a')).map((link) => ({
      text: link.textContent?.trim(),
      href: link.getAttribute('href')
    }));

    expect(compiled.textContent).toContain('Worktrail App');
    expect(compiled.textContent).toContain('v0.0.3');
    expect(compiled.textContent).toContain('Planning dashboard');
    expect(compiled.textContent).toContain('6 risks');
    expect(compiled.textContent).toContain('Delivery health');
    expect(compiled.textContent).toContain('Blocked');
    expect(compiled.querySelector('button[aria-pressed="true"]')?.textContent?.trim()).toBe('Review');
    expect(compiled.querySelector('button[type="submit"]')).toBeNull();
    expect(links).toEqual([
      { text: 'Overview', href: `/projects/${projectId}` },
      { text: 'Work items', href: `/projects/${projectId}/work-items` },
      { text: 'Board', href: `/projects/${projectId}/board` },
      { text: 'Settings', href: `/projects/${projectId}/settings` }
    ]);
  });

  it('switches milestone management into a URL-backed planning view', () => {
    const { fixture } = setupPlanningPage();

    fixture.componentInstance.setPlanningView('milestones');
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('button[aria-pressed="true"]')?.textContent?.trim()).toBe(
      'Milestones'
    );
    expect(compiled.textContent).toContain('Plan named delivery targets for this project.');
    expect(compiled.textContent).toContain('legacy target');
    expect(compiled.textContent).toContain('2 total');
    expect(compiled.querySelector('button[type="submit"]')?.textContent).toContain(
      'Create milestone'
    );
  });

  it('renders planning progress and risk links from the summary', () => {
    const { fixture } = setupPlanningPage();

    const compiled = fixture.nativeElement as HTMLElement;
    const progressLink = compiled.querySelector<HTMLAnchorElement>('.progress-row__heading-link');
    const riskLinks = Array.from(compiled.querySelectorAll<HTMLAnchorElement>('.risk-row')).map(
      (link) => ({
        text: link.textContent ?? '',
        href: link.getAttribute('href')
      })
    );
    const listLinks = Array.from(compiled.querySelectorAll<HTMLAnchorElement>('.section-heading a')).map(
      (link) => link.getAttribute('href') ?? ''
    );
    const reasonLinks = Array.from(compiled.querySelectorAll<HTMLAnchorElement>('.reason-chip')).map(
      (link) => link.getAttribute('href') ?? ''
    );
    const reviewLinks = Array.from(compiled.querySelectorAll<HTMLAnchorElement>('.review-row')).map(
      (link) => ({
        text: link.textContent ?? '',
        href: link.getAttribute('href') ?? ''
      })
    );

    expect(compiled.textContent).toContain('Delivery health');
    expect(compiled.textContent).toContain('1 blocked work item');
    expect(compiled.textContent).toContain('1 dependency-blocked work item');
    expect(compiled.textContent).toContain('Milestone progress');
    expect(compiled.textContent).toContain('2 of 4 done');
    expect(compiled.textContent).toContain('1 blocked');
    expect(compiled.textContent).toContain('Needs attention');
    expect(compiled.textContent).toContain('Upcoming');
    expect(compiled.textContent).toContain('Recently changed');
    expect(compiled.textContent).toContain('Resolve deployment blocker');
    expect(compiled.textContent).toContain('Finish stale planning copy');
    expect(compiled.textContent).toContain('Dependency blocked work');
    expect(compiled.textContent).toContain('Wait for upstream schema work');
    expect(compiled.textContent).toContain('Blocking open work');
    expect(compiled.textContent).toContain('Finish shared dependency package');
    expect(progressLink?.getAttribute('href')).toBe(
      `/projects/${projectId}/work-items?milestoneId=${activeMilestone.id}&sort=due_date_asc`
    );
    expect(riskLinks).toContain(jasmine.objectContaining({
      text: jasmine.stringContaining('WT-1'),
      href: `/work-items/${blockedWorkItem.id}`
    }));
    expect(riskLinks).toContain(jasmine.objectContaining({
      text: jasmine.stringContaining('WT-2'),
      href: `/work-items/${overdueWorkItem.id}`
    }));
    expect(riskLinks).toContain(jasmine.objectContaining({
      text: jasmine.stringContaining('WT-3'),
      href: `/work-items/${dependencyBlockedWorkItem.id}`
    }));
    expect(riskLinks).toContain(jasmine.objectContaining({
      text: jasmine.stringContaining('WT-4'),
      href: `/work-items/${blockingOpenWorkItem.id}`
    }));
    expect(reviewLinks).toContain(jasmine.objectContaining({
      text: jasmine.stringContaining('WT-1'),
      href: `/work-items/${blockedWorkItem.id}`
    }));
    expect(reviewLinks).toContain(jasmine.objectContaining({
      text: jasmine.stringContaining('v0.0.3'),
      href: `/projects/${projectId}/work-items?milestoneId=${activeMilestone.id}&sort=due_date_asc`
    }));
    expect(reviewLinks).toContain(jasmine.objectContaining({
      text: jasmine.stringContaining('WT-4'),
      href: `/work-items/${blockingOpenWorkItem.id}`
    }));
    expect(reasonLinks.some((href) => href.includes('status=blocked'))).toBeTrue();
    expect(listLinks.some((href) => href.includes('dependency=dependency_blocked'))).toBeTrue();
    expect(listLinks.some((href) => href.includes('dependency=blocking_open_work'))).toBeTrue();
  });

  it('renders compact empty dashboard states', () => {
    const emptySummary: ProjectPlanningSummaryDto = {
      project: activeProject,
      deliveryHealth: defaultDeliveryHealth,
      milestoneProgress: [],
      planningReview: emptyPlanningReview,
      blockedWork: [],
      overdueWork: [],
      dueSoonWork: [],
      unassignedActiveWork: [],
      staleInProgressWork: [],
      dependencyBlockedWork: [],
      blockingOpenWork: []
    };
    const { fixture } = setupPlanningPage(activeProject, [], owner, emptySummary);

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('No active milestones');
    expect(compiled.textContent).toContain('No delivery risks found');
    expect(compiled.textContent).toContain('Nothing needs attention');
    expect(compiled.textContent).toContain('No upcoming review items');
    expect(compiled.textContent).toContain('No recent changes');
    expect(compiled.textContent).toContain('No blocked work');
    expect(compiled.textContent).toContain('No overdue work');
    expect(compiled.textContent).toContain('Nothing due soon');
    expect(compiled.textContent).toContain('No dependency-blocked work');
    expect(compiled.textContent).toContain('No work blocking dependencies');
    expect(compiled.textContent).toContain('No unassigned active work');
    expect(compiled.textContent).toContain('No stale in-progress work');
  });

  it('creates, edits, archives, and reactivates milestones', () => {
    const { fixture, http } = setupPlanningPage();
    const createdMilestone: MilestoneDto = {
      ...activeMilestone,
      id: '10000000-0000-4000-8000-000000000503',
      name: 'v0.0.4',
      description: 'Next sprint.',
      status: 'planned',
      targetDate: '2026-08-01'
    };

    fixture.componentInstance.setPlanningView('milestones');
    fixture.detectChanges();
    fixture.componentInstance.milestoneForm.setValue({
      name: 'v0.0.4',
      description: 'Next sprint.',
      status: 'planned',
      targetDate: '2026-08-01'
    });
    fixture.componentInstance.createMilestone();

    const create = http.expectOne(`/api/projects/${projectId}/milestones`);
    expect(create.request.method).toBe('POST');
    expect(create.request.body).toEqual({
      name: 'v0.0.4',
      description: 'Next sprint.',
      status: 'planned',
      targetDate: '2026-08-01'
    });
    create.flush(createdMilestone);
    http.expectOne(`/api/projects/${projectId}/planning-summary`).flush(defaultPlanningSummary);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Milestone created.');

    fixture.componentInstance.updateMilestone(
      activeMilestone,
      'v0.0.3 launch',
      'Ready for launch.',
      'completed',
      '2026-07-30'
    );
    const update = http.expectOne(`/api/milestones/${activeMilestone.id}`);
    expect(update.request.method).toBe('PATCH');
    expect(update.request.body).toEqual({
      name: 'v0.0.3 launch',
      description: 'Ready for launch.',
      status: 'completed',
      targetDate: '2026-07-30'
    });
    update.flush({
      ...activeMilestone,
      name: 'v0.0.3 launch',
      description: 'Ready for launch.',
      status: 'completed',
      targetDate: '2026-07-30'
    });
    http.expectOne(`/api/projects/${projectId}/planning-summary`).flush(defaultPlanningSummary);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Milestone saved.');

    fixture.componentInstance.archiveMilestone(activeMilestone);
    const archive = http.expectOne(`/api/milestones/${activeMilestone.id}/archive`);
    expect(archive.request.method).toBe('POST');
    archive.flush({
      ...activeMilestone,
      isArchived: true,
      archivedAt: '2026-07-04T12:30:00.000Z'
    });
    http.expectOne(`/api/projects/${projectId}/planning-summary`).flush(defaultPlanningSummary);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Milestone archived.');

    fixture.componentInstance.reactivateMilestone(archivedMilestone);
    const reactivate = http.expectOne(`/api/milestones/${archivedMilestone.id}/reactivate`);
    expect(reactivate.request.method).toBe('POST');
    reactivate.flush({
      ...archivedMilestone,
      isArchived: false,
      archivedAt: null
    });
    http.expectOne(`/api/projects/${projectId}/planning-summary`).flush(defaultPlanningSummary);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Milestone reactivated.');
  });

  it('shows validation and duplicate-name API errors inline', () => {
    const { fixture, http } = setupPlanningPage(activeProject, []);

    fixture.componentInstance.setPlanningView('milestones');
    fixture.detectChanges();
    fixture.componentInstance.createMilestone();
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Milestone name is required.');
    http.expectNone((request) => request.method === 'POST');

    fixture.componentInstance.milestoneForm.setValue({
      name: 'v0.0.3',
      description: '',
      status: 'planned',
      targetDate: ''
    });
    fixture.componentInstance.createMilestone();

    const create = http.expectOne(`/api/projects/${projectId}/milestones`);
    create.flush(
      {
        error: {
          code: 'CONFLICT',
          message: 'A milestone with this name already exists for the project.'
        }
      },
      { status: 409, statusText: 'Conflict' }
    );
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'A milestone with this name already exists for the project.'
    );
  });

  it('renders archived projects read-only', () => {
    const { fixture, http } = setupPlanningPage(archivedProject);

    fixture.componentInstance.setPlanningView('milestones');
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Archived project');
    expect(compiled.querySelector('button[type="submit"]')).toBeNull();

    const editableFields = Array.from(
      compiled.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
        '.milestone-row input, .milestone-row select, .milestone-row textarea'
      )
    );
    expect(editableFields.length).toBe(0);
    expect(compiled.textContent).toContain('v0.0.3');
    expect(compiled.textContent).toContain('legacy target');

    fixture.componentInstance.createMilestone();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Archived projects are read-only.'
    );
    http.expectNone((request) => request.method === 'POST');
  });

  it('renders contributor access read-only', () => {
    const { fixture } = setupPlanningPage(activeProject, [activeMilestone], contributor);

    fixture.componentInstance.setPlanningView('milestones');
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Read-only planning');
    expect(compiled.querySelector('button[type="submit"]')).toBeNull();
    expect(compiled.textContent).toContain('v0.0.3');
    expect(
      compiled.querySelectorAll('.milestone-row input, .milestone-row select, .milestone-row textarea')
        .length
    ).toBe(0);

    fixture.componentInstance.createMilestone();
    fixture.detectChanges();

    expect(compiled.textContent).toContain('Only owners and maintainers can manage milestones.');
  });
});
