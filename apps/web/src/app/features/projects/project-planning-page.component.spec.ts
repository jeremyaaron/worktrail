import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import type {
  MemberDto,
  MilestoneDto,
  PlanningRiskItemDto,
  ProjectDto,
  ProjectPlanningSummaryDto
} from '@worktrail/contracts';

import { CurrentUserService } from '../../core/current-user.service';
import { ProjectPlanningPageComponent } from './project-planning-page.component';

const projectId = '10000000-0000-4000-8000-000000000201';
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

const defaultPlanningSummary: ProjectPlanningSummaryDto = {
  project: activeProject,
  milestoneProgress: [
    {
      milestone: activeMilestone,
      totalCount: 4,
      doneCount: 2,
      blockedCount: 1,
      overdueCount: 1
    }
  ],
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
  beforeEach(async () => {
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
              paramMap: convertToParamMap({ projectId })
            }
          }
        }
      ]
    }).compileComponents();
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  it('renders milestone management with project navigation links', () => {
    const { fixture } = setupPlanningPage();

    const compiled = fixture.nativeElement as HTMLElement;
    const links = Array.from(compiled.querySelectorAll<HTMLAnchorElement>('nav a')).map((link) => ({
      text: link.textContent?.trim(),
      href: link.getAttribute('href')
    }));

    expect(compiled.textContent).toContain('Worktrail App');
    expect(compiled.textContent).toContain('v0.0.3');
    expect(compiled.textContent).toContain('legacy target');
    expect(compiled.textContent).toContain('archived');
    expect(compiled.textContent).toContain('2 total');
    expect(compiled.textContent).toContain('Planning dashboard');
    expect(compiled.textContent).toContain('6 risks');
    expect(links).toEqual([
      { text: 'Overview', href: `/projects/${projectId}` },
      { text: 'Work items', href: `/projects/${projectId}/work-items` },
      { text: 'Board', href: `/projects/${projectId}/board` },
      { text: 'Settings', href: `/projects/${projectId}/settings` }
    ]);
  });

  it('renders planning progress and risk links from the summary', () => {
    const { fixture } = setupPlanningPage();

    const compiled = fixture.nativeElement as HTMLElement;
    const progressLink = compiled.querySelector<HTMLAnchorElement>('.progress-row');
    const riskLinks = Array.from(compiled.querySelectorAll<HTMLAnchorElement>('.risk-row')).map(
      (link) => ({
        text: link.textContent ?? '',
        href: link.getAttribute('href')
      })
    );
    const listLinks = Array.from(compiled.querySelectorAll<HTMLAnchorElement>('.section-heading a')).map(
      (link) => link.getAttribute('href') ?? ''
    );

    expect(compiled.textContent).toContain('Milestone progress');
    expect(compiled.textContent).toContain('2 of 4 done');
    expect(compiled.textContent).toContain('1 blocked');
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
    expect(listLinks.some((href) => href.includes('dependency=dependency_blocked'))).toBeTrue();
    expect(listLinks.some((href) => href.includes('dependency=blocking_open_work'))).toBeTrue();
  });

  it('renders compact empty dashboard states', () => {
    const emptySummary: ProjectPlanningSummaryDto = {
      project: activeProject,
      milestoneProgress: [],
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

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Archived project');
    expect(compiled.querySelector('button[type="submit"]')).toBeNull();

    const editableFields = Array.from(
      compiled.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
        '.milestone-row input, .milestone-row select, .milestone-row textarea'
      )
    );
    expect(editableFields.length).toBeGreaterThan(0);
    expect(editableFields.every((field) => field.disabled)).toBeTrue();

    fixture.componentInstance.createMilestone();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Archived projects are read-only.'
    );
    http.expectNone((request) => request.method === 'POST');
  });

  it('renders contributor access read-only', () => {
    const { fixture } = setupPlanningPage(activeProject, [activeMilestone], contributor);

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Read-only planning');
    expect(compiled.querySelector('button[type="submit"]')).toBeNull();
    expect(compiled.textContent).toContain('v0.0.3');

    fixture.componentInstance.createMilestone();
    fixture.detectChanges();

    expect(compiled.textContent).toContain('Only owners and maintainers can manage milestones.');
  });
});
