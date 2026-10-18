import { By } from '@angular/platform-browser';
import { PlanningReviewComponent } from './planning/planning-review.component';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import type {
  MemberDto,
  MilestoneDto,
  PlanningRiskItemDto,
  PlanningReviewDto,
  ProjectCycleDto,
  ProjectDto,
  ProjectDeliveryHealthDto,
  ProjectPlanningCycleSummaryDto,
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
      countUnit: 'work_items' as const,
      query: { status: 'blocked', sort: 'priority_desc' }
    },
    {
      key: 'dependency_blocked',
      severity: 'critical',
      message: '1 dependency-blocked work item',
      count: 1,
      countUnit: 'work_items' as const,
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

const upcomingCycle: ProjectCycleDto = {
  ...activeCycle,
  id: '10000000-0000-4000-8000-000000000702',
  name: 'v0.2.2 Adoption',
  goal: 'Polish adoption paths.',
  status: 'planned',
  startDate: '2026-07-27',
  endDate: '2026-08-07',
  targetPoints: 18
};

const completedCycle: ProjectCycleDto = {
  ...activeCycle,
  id: '10000000-0000-4000-8000-000000000703',
  name: 'v0.2.0 Consolidation',
  goal: 'Consolidate the planning surface.',
  status: 'completed',
  startDate: '2026-06-29',
  endDate: '2026-07-10',
  targetPoints: 16
};

const archivedCycle: ProjectCycleDto = {
  ...completedCycle,
  id: '10000000-0000-4000-8000-000000000704',
  name: 'Archived cycle',
  isArchived: true,
  archivedAt: '2026-07-12T12:00:00.000Z'
};

function cycleSummary(
  cycle: ProjectCycleDto,
  input: Partial<ProjectPlanningCycleSummaryDto> = {}
): ProjectPlanningCycleSummaryDto {
  return {
    cycle,
    progress: input.progress ?? {
      totalCount: 6,
      openCount: 4,
      doneCount: 2,
      blockedCount: 1,
      dependencyBlockedCount: 1,
      committedEstimatePoints: 23,
      completedEstimatePoints: 8,
      unestimatedCount: 1,
      targetPoints: cycle.targetPoints
    },
    health: input.health ?? {
      health: cycle.status === 'completed' ? 'complete' : 'at_risk',
      reasons: []
    },
    scopedWorkQuery: input.scopedWorkQuery ?? {
      cycleId: cycle.id,
      sort: 'priority_desc'
    },
    closeout: input.closeout ?? null
  };
}

const blockedWorkItem: PlanningRiskItemDto = {
  id: '10000000-0000-4000-8000-000000000301',
  displayKey: 'WT-1',
  title: 'Resolve deployment blocker',
  status: 'blocked',
  priority: 'urgent',
  assignee: owner,
  dueDate: '2026-07-06',
  milestone: activeMilestone,
  updatedAt: '2026-07-04T11:00:00.000Z',
  parent: {
    id: '10000000-0000-4000-8000-000000000399',
    projectId,
    displayKey: 'WT-40',
    title: 'Coordinate deployment readiness',
    type: 'story',
    status: 'in_progress'
  }
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
  deliveryHealth: {
    ...blockedDeliveryHealth, overdueWorkCount: 1, blockingOpenWorkCount: 1,
    unassignedActiveWorkCount: 1, staleInProgressWorkCount: 1
  },
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
          countUnit: 'work_items' as const,
          query: {
            milestoneId: activeMilestone.id,
            status: 'blocked',
            sort: 'priority_desc'
          }
        }
      ]
    }
  ],
  activeCycle: cycleSummary(activeCycle),
  upcomingCycle: cycleSummary(upcomingCycle, {
    progress: {
      totalCount: 2,
      openCount: 2,
      doneCount: 0,
      blockedCount: 0,
      dependencyBlockedCount: 0,
      committedEstimatePoints: 5,
      completedEstimatePoints: 0,
      unestimatedCount: 0,
      targetPoints: upcomingCycle.targetPoints
    },
    health: { health: 'healthy', reasons: [] }
  }),
  recentlyCompletedCycle: cycleSummary(completedCycle),
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
  },
  cycles: ProjectCycleDto[] = [activeCycle, upcomingCycle, completedCycle, archivedCycle]
) {
  seedCurrentUser(member);
  const fixture = TestBed.createComponent(ProjectPlanningPageComponent);
  const http = TestBed.inject(HttpTestingController);
  fixture.detectChanges();
  http.expectOne(`/api/projects/${projectId}`).flush(project);
  http.expectOne(`/api/projects/${projectId}/milestones?includeArchived=true`).flush(milestones);
  http.expectOne(`/api/projects/${projectId}/cycles?includeArchived=true`).flush(cycles);
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

  it('puts live health, cycle execution and populated risks before milestone targets and recent disclosures', () => {
    const { fixture } = setupPlanningPage();
    const compiled = fixture.nativeElement as HTMLElement;
    const order = Array.from(compiled.querySelectorAll('h2,h3')).map(node => node.textContent?.trim());
    expect(order.indexOf('Cycle execution')).toBeGreaterThan(order.indexOf('Blocked'));
    expect(order.indexOf('Project risks')).toBeGreaterThan(order.indexOf('Cycle execution'));
    expect(order.indexOf('Milestone targets')).toBeGreaterThan(order.indexOf('Project risks'));
    expect(compiled.querySelectorAll('.review-disclosure:not([open])')).toHaveSize(3);
    expect(compiled.querySelector('[aria-labelledby="risk-due-soon"]')).toBeNull();
    expect(compiled.querySelector('[aria-label="Closeout readiness"]')?.textContent).toContain('unfinished work items');
  });

  it('shows an actionable no-active-cycle state even with upcoming and completed cycles', () => {
    const { fixture } = setupPlanningPage(activeProject, [], contributor, { ...defaultPlanningSummary, activeCycle: null });
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('No active cycle');
    expect(compiled.textContent).toContain('Upcoming cycle');
    const link = compiled.querySelector<HTMLAnchorElement>('.no-active-cycle a');
    expect(link?.getAttribute('href')).toContain('cycleId=none');
    expect(link?.getAttribute('href')).toContain('workState=open');
    expect(compiled.querySelector('form')).toBeNull();
    expect(compiled.textContent).not.toContain('Manage cycles');
  });

  it('cancels superseded same-context planning, milestone and cycle reads', () => {
    const { fixture, http } = setupPlanningPage();
    const page = fixture.componentInstance;
    for (const [load, url, response] of [
      [() => page.loadPlanningSummary(), `/api/projects/${projectId}/planning-summary`, defaultPlanningSummary],
      [() => page.loadMilestones(), `/api/projects/${projectId}/milestones?includeArchived=true`, [activeMilestone]],
      [() => page.loadCycles(), `/api/projects/${projectId}/cycles?includeArchived=true`, [activeCycle]]
    ] as const) {
      load();
      const first = http.expectOne(url);
      load();
      expect(first.cancelled).toBeTrue();
      http.expectOne(url).flush(response);
    }
    fixture.detectChanges();
    expect(page.planningSummary()).toEqual(defaultPlanningSummary);
    expect(page.cycles()).toEqual([activeCycle]);
    expect(page.milestones()).toEqual([activeMilestone]);
  });

  it('keeps record errors and drafts local while serializing milestone writes', () => {
    const { fixture, http } = setupPlanningPage();
    const page = fixture.componentInstance;
    page.setPlanningView('milestones');
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const rows = Array.from(compiled.querySelectorAll<HTMLElement>('.milestone-row'));
    const own = rows.find(row => row.querySelector('h3')?.textContent === activeMilestone.name)!;
    const other = rows.find(row => row.querySelector('h3')?.textContent === archivedMilestone.name)!;
    own.querySelector<HTMLDetailsElement>('details')!.open = true;
    other.querySelector<HTMLDetailsElement>('details')!.open = true;
    const otherName = other.querySelector<HTMLInputElement>('input')!;
    otherName.value = 'Independent rename draft';
    otherName.dispatchEvent(new Event('input'));
    const ownName = own.querySelector<HTMLInputElement>('input')!;
    ownName.value = 'Edited target';
    ownName.dispatchEvent(new Event('input'));
    own.querySelector<HTMLButtonElement>('.milestone-actions button')!.click();
    const write = http.expectOne(`/api/milestones/${activeMilestone.id}`);
    fixture.detectChanges();
    expect(otherName.disabled).toBeTrue();
    page.loadMilestones();
    http.expectNone(`/api/projects/${projectId}/milestones?includeArchived=true`);
    page.archiveMilestone(archivedMilestone);
    http.expectNone(`/api/milestones/${archivedMilestone.id}/archive`);
    write.flush({ error: { message: 'Target name conflict' } }, { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();
    expect(own.querySelector('[role="alert"]')?.textContent).toContain('Target name conflict');
    expect(other.querySelector('[role="alert"]')).toBeNull();
    expect(ownName.value).toBe('Edited target');
    expect(otherName.value).toBe('Independent rename draft');
    own.querySelector<HTMLButtonElement>('.milestone-actions button')!.click();
    http.expectOne(`/api/milestones/${activeMilestone.id}`).flush({ ...activeMilestone, name: 'Edited target' });
    http.expectOne(`/api/projects/${projectId}/planning-summary`).flush(defaultPlanningSummary);
    fixture.detectChanges();
    expect(otherName.value).toBe('Independent rename draft');
    expect(own.querySelector('[role="status"]')?.textContent).toContain('Milestone saved.');
  });

  it('accepts native numeric cycle target points, rejects repeat submits and retains failed creation drafts', () => {
    const { fixture, http } = setupPlanningPage();
    const page = fixture.componentInstance;
    page.milestoneForm.controls.name.setValue('Independent milestone draft');
    page.setPlanningView('cycles');
    page.cycleForm.patchValue({ name: 'Numeric cycle', startDate: '2026-08-01', endDate: '2026-08-05' });
    fixture.detectChanges();
    const points = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>('.cycle-form input[type="number"]')!;
    points.value = '7';
    points.dispatchEvent(new Event('input'));
    page.createCycle();
    const write = http.expectOne(`/api/projects/${projectId}/cycles`);
    expect(write.request.body.targetPoints).toBe(7);
    page.createCycle();
    page.archiveCycle(activeCycle);
    http.expectNone(request => request.method === 'POST');
    write.flush({ error: { message: 'Cycle conflict' } }, { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();
    expect(page.isCreatingCycle()).toBeFalse();
    expect(page.cycleForm.controls.name.value).toBe('Numeric cycle');
    expect(points.value).toBe('7');
    expect(page.milestoneForm.controls.name.value).toBe('Independent milestone draft');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Cycle conflict');
  });

  it('retries a failed summary without displaying stale execution evidence', () => {
    const { fixture, http } = setupPlanningPage();
    fixture.componentInstance.loadPlanningSummary();
    http.expectOne(`/api/projects/${projectId}/planning-summary`).flush({}, { status: 500, statusText: 'Failure' });
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-planning-review')).toBeNull();
    compiled.querySelector<HTMLButtonElement>('app-error-panel button')!.click();
    http.expectOne(`/api/projects/${projectId}/planning-summary`).flush(defaultPlanningSummary);
    fixture.detectChanges();
    expect(compiled.querySelector('app-planning-review')).not.toBeNull();
  });

  it('opens planning review without duplicating project shell navigation', () => {
    const { fixture } = setupPlanningPage();

    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.textContent).toContain('Worktrail App');
    expect(compiled.textContent).toContain('Planning · Live view');
    expect(compiled.querySelector('.planning-report-bridge')).toBeNull();
    expect(compiled.textContent).toContain('Reports');
    expect(compiled.textContent).toContain('Draft report');
    expect(compiled.textContent).toContain('v0.0.3');
    expect(compiled.textContent).toContain('Planning dashboard');
    expect(compiled.textContent).toContain('6 risk signals');
    expect(compiled.textContent).toContain('Delivery health');
    expect(compiled.textContent).toContain('Child of WT-40');
    expect(compiled.textContent).toContain('Cycle execution');
    expect(compiled.textContent).toContain('v0.2.1 Cycle Planning');
    expect(compiled.textContent).toContain('Blocked');
    expect(compiled.querySelector('button[aria-pressed="true"]')?.textContent?.trim()).toBe('Review');
    expect(compiled.querySelector('button[type="submit"]')).toBeNull();
    expect(compiled.querySelector('nav[aria-label="Project navigation"]')).toBeNull();
  });

  it('switches cycle management into a URL-backed planning view', () => {
    const { fixture } = setupPlanningPage();

    fixture.componentInstance.setPlanningView('cycles');
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('button[aria-pressed="true"]')?.textContent?.trim()).toBe(
      'Cycles'
    );
    expect(compiled.querySelector<HTMLDetailsElement>('.create-disclosure')?.open).toBeFalse();
    expect(compiled.querySelector<HTMLDetailsElement>('.record-edit')?.open).toBeFalse();
    expect(compiled.textContent).toContain('v0.2.1 Cycle Planning');
    expect(compiled.textContent).toContain('Archived cycle');
    expect(compiled.textContent).toContain('4 total');
    expect(compiled.querySelector('button[type="submit"]')?.textContent).toContain(
      'Create cycle'
    );

    const reviewLink = Array.from(compiled.querySelectorAll<HTMLAnchorElement>('a')).find(
      (link) => link.textContent?.trim() === 'Review'
    );
    const workLink = Array.from(compiled.querySelectorAll<HTMLAnchorElement>('a')).find(
      (link) => link.textContent?.trim() === 'Work'
    );

    expect(reviewLink?.getAttribute('href')).toBe(`/projects/${projectId}/cycles/${activeCycle.id}`);
    expect(workLink?.getAttribute('href')).toBe(
      `/projects/${projectId}/work-items?cycleId=${activeCycle.id}&sort=priority_desc`
    );
  });

  it('switches milestone management into a URL-backed planning view', () => {
    const { fixture } = setupPlanningPage();

    fixture.componentInstance.setPlanningView('milestones');
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('button[aria-pressed="true"]')?.textContent?.trim()).toBe(
      'Milestones'
    );
    expect(compiled.querySelector<HTMLDetailsElement>('.create-disclosure')?.open).toBeFalse();
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
    const progressWorkLink = compiled.querySelector<HTMLAnchorElement>('.progress-row__work-link');
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
    expect(compiled.textContent).toContain('Active cycle');
    expect(compiled.textContent).toContain('Upcoming cycle');
    expect(compiled.textContent).toContain('Recently completed');
    expect(compiled.textContent).toContain('1 blocked work item');
    expect(compiled.textContent).toContain('1 dependency-blocked work item');
    expect(compiled.textContent).toContain('Milestone targets');
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
      `/projects/${projectId}/milestones/${activeMilestone.id}`
    );
    expect(progressWorkLink?.textContent?.trim()).toBe('Open work');
    expect(progressWorkLink?.getAttribute('href')).toBe(
      `/projects/${projectId}/work-items?milestoneId=${activeMilestone.id}&sort=due_date_asc`
    );
    expect(
      Array.from(compiled.querySelectorAll<HTMLAnchorElement>('.cycle-summary-card__actions a')).map(
        (link) => link.getAttribute('href')
      )
    ).toContain(`/projects/${projectId}/cycles/${activeCycle.id}`);
    expect(
      Array.from(compiled.querySelectorAll<HTMLAnchorElement>('.cycle-summary-card__actions a')).map(
        (link) => link.getAttribute('href')
      )
    ).toContain(`/projects/${projectId}/work-items?cycleId=${activeCycle.id}&sort=priority_desc`);
    expect(riskLinks).toContain(jasmine.objectContaining({
      text: jasmine.stringContaining('WT-1'),
      href: jasmine.stringContaining(`/work-items/${blockedWorkItem.id}?returnUrl=`)
    }));
    expect(riskLinks).toContain(jasmine.objectContaining({
      text: jasmine.stringContaining('WT-2'),
      href: jasmine.stringContaining(`/work-items/${overdueWorkItem.id}?returnUrl=`)
    }));
    expect(riskLinks).toContain(jasmine.objectContaining({
      text: jasmine.stringContaining('WT-3'),
      href: jasmine.stringContaining(`/work-items/${dependencyBlockedWorkItem.id}?returnUrl=`)
    }));
    expect(riskLinks).toContain(jasmine.objectContaining({
      text: jasmine.stringContaining('WT-4'),
      href: jasmine.stringContaining(`/work-items/${blockingOpenWorkItem.id}?returnUrl=`)
    }));
    expect(reviewLinks).toContain(jasmine.objectContaining({
      text: jasmine.stringContaining('WT-1'),
      href: jasmine.stringContaining(`/work-items/${blockedWorkItem.id}?returnUrl=`)
    }));
    expect(reviewLinks).toContain(jasmine.objectContaining({
      text: jasmine.stringContaining('v0.0.3'),
      href: `/projects/${projectId}/milestones/${activeMilestone.id}`
    }));
    expect(reviewLinks).toContain(jasmine.objectContaining({
      text: jasmine.stringContaining('WT-4'),
      href: jasmine.stringContaining(`/work-items/${blockingOpenWorkItem.id}?returnUrl=`)
    }));
    expect(reasonLinks.some((href) => href.includes('status=blocked'))).toBeTrue();
    expect(listLinks.some((href) => href.includes('dependency=dependency_blocked'))).toBeTrue();
    expect(listLinks.some((href) => href.includes('dependency=blocking_open_work'))).toBeTrue();
  });

  it('uses exact counts and continuation links when the API returns only five risk preview rows', () => {
    const summary: ProjectPlanningSummaryDto = {
      ...defaultPlanningSummary,
      deliveryHealth: { ...defaultDeliveryHealth, health: 'blocked', blockedWorkCount: 12 },
      blockedWork: Array.from({ length: 5 }, (_, index) => ({
        ...blockedWorkItem,
        id: 'preview-' + index, displayKey: 'WT-' + (index + 1)
      }))
    };
    const { fixture } = setupPlanningPage(activeProject, [activeMilestone], owner, summary);
    const component = fixture.debugElement.query(By.directive(PlanningReviewComponent)).componentInstance as PlanningReviewComponent;
    const section = component.riskSections().find(section => section.title === 'Blocked work')!;
    expect(component.totalRiskCount(summary)).toBe(12);
    expect(component.visibleRiskItems(section)).toHaveSize(5);
    expect(component.hiddenRiskItemCount(section)).toBe(7);
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[aria-labelledby="risk-blocked-work"]')?.textContent).toContain('12 work items');
    const blocked = compiled.querySelector('[aria-labelledby="risk-blocked-work"]')!;
    expect(blocked.querySelectorAll('.risk-row')).toHaveSize(5);
    expect(blocked.querySelector('.risk-more')?.textContent).toContain('View 7 more');
    expect(compiled.querySelector('[aria-labelledby="risk-stale-in-progress-work"]')).toBeNull();
  });

  it('renders compact empty dashboard states', () => {
    const emptySummary: ProjectPlanningSummaryDto = {
      project: activeProject,
      deliveryHealth: defaultDeliveryHealth,
      milestoneProgress: [],
      activeCycle: null,
      upcomingCycle: null,
      recentlyCompletedCycle: null,
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
    expect(compiled.textContent).toContain('No project delivery risks found');
    expect(compiled.textContent).toContain('No project work risks found.');
    expect(compiled.textContent).toContain('No active cycle');
    expect(compiled.querySelectorAll('.risk-section-list .dashboard-section')).toHaveSize(0);
    expect(compiled.querySelectorAll('.review-disclosure')).toHaveSize(0);

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

  it('creates, edits, archives, and reactivates cycles', () => {
    const { fixture, http } = setupPlanningPage();
    const createdCycle: ProjectCycleDto = {
      ...upcomingCycle,
      id: '10000000-0000-4000-8000-000000000705',
      name: 'v0.2.3',
      goal: 'Next cycle.',
      startDate: '2026-08-10',
      endDate: '2026-08-21',
      targetPoints: 24
    };

    fixture.componentInstance.setPlanningView('cycles');
    fixture.detectChanges();
    fixture.componentInstance.cycleForm.setValue({
      name: 'v0.2.3',
      goal: 'Next cycle.',
      status: 'planned',
      startDate: '2026-08-10',
      endDate: '2026-08-21',
      targetPoints: '24'
    });
    fixture.componentInstance.createCycle();

    const create = http.expectOne(`/api/projects/${projectId}/cycles`);
    expect(create.request.method).toBe('POST');
    expect(create.request.body).toEqual({
      name: 'v0.2.3',
      goal: 'Next cycle.',
      status: 'planned',
      startDate: '2026-08-10',
      endDate: '2026-08-21',
      targetPoints: 24
    });
    create.flush(createdCycle);
    http.expectOne(`/api/projects/${projectId}/planning-summary`).flush(defaultPlanningSummary);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Cycle created.');

    fixture.componentInstance.updateCycle(
      activeCycle,
      'v0.2.1 launch',
      'Ready for launch.',
      'canceled',
      '2026-07-13',
      '2026-07-24',
      ''
    );
    const update = http.expectOne(`/api/projects/${projectId}/cycles/${activeCycle.id}`);
    expect(update.request.method).toBe('PATCH');
    expect(update.request.body).toEqual({
      name: 'v0.2.1 launch',
      goal: 'Ready for launch.',
      status: 'canceled',
      startDate: '2026-07-13',
      endDate: '2026-07-24',
      targetPoints: null
    });
    update.flush({
      ...activeCycle,
      name: 'v0.2.1 launch',
      goal: 'Ready for launch.',
      status: 'canceled',
      targetPoints: null
    });
    http.expectOne(`/api/projects/${projectId}/planning-summary`).flush(defaultPlanningSummary);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Cycle saved.');

    fixture.componentInstance.archiveCycle(activeCycle);
    const archive = http.expectOne(`/api/projects/${projectId}/cycles/${activeCycle.id}/archive`);
    expect(archive.request.method).toBe('POST');
    archive.flush({
      ...activeCycle,
      isArchived: true,
      archivedAt: '2026-07-25T12:30:00.000Z'
    });
    http.expectOne(`/api/projects/${projectId}/planning-summary`).flush(defaultPlanningSummary);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Cycle archived.');

    fixture.componentInstance.reactivateCycle(archivedCycle);
    const reactivate = http.expectOne(
      `/api/projects/${projectId}/cycles/${archivedCycle.id}/reactivate`
    );
    expect(reactivate.request.method).toBe('POST');
    reactivate.flush({
      ...archivedCycle,
      isArchived: false,
      archivedAt: null
    });
    http.expectOne(`/api/projects/${projectId}/planning-summary`).flush(defaultPlanningSummary);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Cycle reactivated.');
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

  it('shows cycle create validation and duplicate-name API errors inline', () => {
    const { fixture, http } = setupPlanningPage(activeProject, []);

    fixture.componentInstance.setPlanningView('cycles');
    fixture.detectChanges();
    fixture.componentInstance.createCycle();
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Cycle name is required.');
    http.expectNone((request) => request.method === 'POST');

    fixture.componentInstance.cycleForm.setValue({
      name: 'v0.2.1 Cycle Planning',
      goal: '',
      status: 'planned',
      startDate: '2026-08-10',
      endDate: '2026-08-21',
      targetPoints: ''
    });
    fixture.componentInstance.createCycle();

    const create = http.expectOne(`/api/projects/${projectId}/cycles`);
    create.flush(
      {
        error: {
          code: 'CONFLICT',
          message: 'A cycle with this name already exists.'
        }
      },
      { status: 409, statusText: 'Conflict' }
    );
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'A cycle with this name already exists.'
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

    fixture.componentInstance.setPlanningView('cycles');
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('v0.2.1 Cycle Planning');
    expect(
      fixture.nativeElement.querySelectorAll('.cycle-row input, .cycle-row select, .cycle-row textarea')
        .length
    ).toBe(0);
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

    fixture.componentInstance.setPlanningView('cycles');
    fixture.detectChanges();
    expect(compiled.textContent).toContain('v0.2.1 Cycle Planning');
    expect(compiled.querySelector('button[type="submit"]')).toBeNull();
    expect(compiled.querySelectorAll('.cycle-row input, .cycle-row select, .cycle-row textarea').length).toBe(0);

    fixture.componentInstance.createCycle();
    fixture.detectChanges();

    expect(compiled.textContent).toContain('Only owners and maintainers can manage cycles.');
  });
});
