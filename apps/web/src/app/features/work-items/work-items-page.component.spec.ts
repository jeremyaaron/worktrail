import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import type {
  MemberDto,
  MilestoneDto,
  ProjectDto,
  WorkItemDetailDto,
  WorkItemListItemDto
} from '@worktrail/contracts';
import { BehaviorSubject } from 'rxjs';

import { CurrentUserService } from '../../core/current-user.service';
import { WorkItemCreatePageComponent } from './work-item-create-page.component';
import { WorkItemListPageComponent } from './work-item-list-page.component';

const projectId = '10000000-0000-4000-8000-000000000201';
const workItemId = '10000000-0000-4000-8000-000000000403';
const contributorId = '10000000-0000-4000-8000-000000000103';
const inactiveMemberId = '10000000-0000-4000-8000-000000000104';

const member: MemberDto = {
  id: contributorId,
  workspaceId: '10000000-0000-4000-8000-000000000001',
  name: 'Case Contributor',
  email: 'case.contributor@example.com',
  role: 'contributor',
  isActive: true,
  deactivatedAt: null,
  createdAt: '2026-07-02T12:00:00.000Z',
  updatedAt: '2026-07-03T12:00:00.000Z'
};

const inactiveMember: MemberDto = {
  id: inactiveMemberId,
  workspaceId: member.workspaceId,
  name: 'Riley Former',
  email: 'riley.former@example.com',
  role: 'contributor',
  isActive: false,
  deactivatedAt: '2026-06-28T12:00:00.000Z',
  createdAt: '2026-07-02T12:00:00.000Z',
  updatedAt: '2026-07-03T12:00:00.000Z'
};

const activeProject: ProjectDto = {
  id: projectId,
  workspaceId: member.workspaceId,
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
  workspaceId: member.workspaceId,
  projectId,
  name: 'v0.0.3',
  description: 'Planning release.',
  status: 'active',
  targetDate: '2026-07-18',
  isArchived: false,
  archivedAt: null,
  createdAt: '2026-07-03T12:00:00.000Z',
  updatedAt: '2026-07-04T12:00:00.000Z'
};

const workItem: WorkItemListItemDto = {
  id: workItemId,
  workspaceId: member.workspaceId,
  projectId,
  itemNumber: 3,
  displayKey: 'WT-3',
  title: 'Implement work item API client',
  type: 'task',
  status: 'in_progress',
  priority: 'high',
  assignee: member,
  reporter: member,
  labels: [
    {
      id: '10000000-0000-4000-8000-000000000302',
      name: 'backend',
      color: '#059669',
      isArchived: false,
      archivedAt: null
    }
  ],
  milestone: activeMilestone,
  boardPosition: 1024,
  dueDate: null,
  estimatePoints: 5,
  createdAt: '2026-07-02T12:00:00.000Z',
  updatedAt: '2026-07-03T12:00:00.000Z'
};

const backendLabel = workItem.labels[0];

const archivedLabel = {
  id: '10000000-0000-4000-8000-000000000399',
  name: 'legacy',
  color: '#64748b',
  isArchived: true,
  archivedAt: '2026-07-03T12:00:00.000Z'
};

function routeStub(query: Record<string, string> = {}) {
  return {
    snapshot: {
      paramMap: convertToParamMap({ projectId })
    },
    queryParamMap: new BehaviorSubject(convertToParamMap(query)).asObservable()
  };
}

function seedCurrentUser() {
  const currentUser = TestBed.inject(CurrentUserService);
  currentUser.members.set([member, inactiveMember]);
  currentUser.selectMember(member.id);
}

describe('WorkItemListPageComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WorkItemListPageComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: routeStub({
            status: 'in_progress',
            assigneeId: contributorId,
            reporterId: contributorId,
            milestoneId: activeMilestone.id,
            dueDateState: 'due_soon',
            search: 'api',
            sort: 'due_date_asc'
          })
        }
      ]
    }).compileComponents();

    seedCurrentUser();
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  it('loads work items with query parameter filters and renders dense rows', () => {
    const fixture = TestBed.createComponent(WorkItemListPageComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne(`/api/projects/${projectId}`).flush(activeProject);
    http.expectOne(`/api/projects/${projectId}/milestones?includeArchived=true`).flush([activeMilestone]);

    const request = http.expectOne((candidate) => {
      return (
        candidate.url === `/api/projects/${projectId}/work-items` &&
        candidate.params.get('status') === 'in_progress' &&
        candidate.params.get('assigneeId') === contributorId &&
        candidate.params.get('reporterId') === contributorId &&
        candidate.params.get('milestoneId') === activeMilestone.id &&
        candidate.params.get('dueDateState') === 'due_soon' &&
        candidate.params.get('search') === 'api' &&
        candidate.params.get('sort') === 'due_date_asc'
      );
    });
    request.flush([workItem]);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('WT-3');
    expect(compiled.textContent).toContain('Implement work item API client');
    expect(compiled.textContent).toContain('Case Contributor');
    expect(compiled.textContent).toContain('backend');
    expect(compiled.textContent).toContain('v0.0.3');
    expect(compiled.textContent).toContain('Due date: Due soon');
  });

  it('resolves inactive member names from filter state without making them default choices', () => {
    const fixture = TestBed.createComponent(WorkItemListPageComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne(`/api/projects/${projectId}`).flush(activeProject);
    http.expectOne(`/api/projects/${projectId}/milestones?includeArchived=true`).flush([activeMilestone]);
    http.expectOne((candidate) => candidate.url === `/api/projects/${projectId}/work-items`).flush([
      {
        ...workItem,
        assignee: inactiveMember
      }
    ]);
    fixture.componentInstance.appliedFilterValues.set({
      ...fixture.componentInstance.appliedFilterValues(),
      assigneeId: inactiveMember.id
    });
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Assignee: Riley Former (inactive)');
    expect(compiled.textContent).toContain('Riley Former (inactive)');
    expect(fixture.componentInstance.assigneeFilterMembers().map((item) => item.id)).toContain(
      inactiveMember.id
    );
    expect(fixture.componentInstance.reporterFilterMembers().map((item) => item.id)).not.toContain(
      inactiveMember.id
    );
  });

  it('keeps applied filters in route query parameters', () => {
    const fixture = TestBed.createComponent(WorkItemListPageComponent);
    const http = TestBed.inject(HttpTestingController);
    const router = TestBed.inject(Router);
    const navigate = spyOn(router, 'navigate').and.resolveTo(true);
    fixture.detectChanges();

    http.expectOne(`/api/projects/${projectId}`).flush(activeProject);
    http.expectOne(`/api/projects/${projectId}/milestones?includeArchived=true`).flush([activeMilestone]);
    http.expectOne((candidate) => candidate.url === `/api/projects/${projectId}/work-items`).flush([]);

    fixture.componentInstance.filterForm.patchValue({
      search: 'client',
      status: 'ready',
      assigneeId: contributorId,
      reporterId: contributorId,
      type: 'task',
      labelId: workItem.labels[0].id,
      milestoneId: activeMilestone.id,
      priority: 'high',
      dueDateState: 'overdue',
      sort: 'created_desc'
    });
    fixture.componentInstance.applyFilters();

    expect(navigate).toHaveBeenCalledWith([], {
      relativeTo: TestBed.inject(ActivatedRoute),
      queryParams: {
        search: 'client',
        status: 'ready',
        assigneeId: contributorId,
        reporterId: contributorId,
        type: 'task',
        labelId: workItem.labels[0].id,
        milestoneId: activeMilestone.id,
        priority: 'high',
        dueDateState: 'overdue',
        sort: 'created_desc'
      }
    });
  });

  it('does not show active filter pills for unapplied pending form values', () => {
    const fixture = TestBed.createComponent(WorkItemListPageComponent);
    const http = TestBed.inject(HttpTestingController);
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
    fixture.detectChanges();

    http.expectOne(`/api/projects/${projectId}`).flush(activeProject);
    http.expectOne(`/api/projects/${projectId}/milestones?includeArchived=true`).flush([activeMilestone]);
    http.expectOne((candidate) => candidate.url === `/api/projects/${projectId}/work-items`).flush([workItem]);
    fixture.detectChanges();

    fixture.componentInstance.filterForm.controls.labelId.setValue(backendLabel.id);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('Label: backend');
  });

  it('applies dropdown filters immediately', () => {
    const fixture = TestBed.createComponent(WorkItemListPageComponent);
    const http = TestBed.inject(HttpTestingController);
    const router = TestBed.inject(Router);
    const navigate = spyOn(router, 'navigate').and.resolveTo(true);
    fixture.detectChanges();

    http.expectOne(`/api/projects/${projectId}`).flush(activeProject);
    http.expectOne(`/api/projects/${projectId}/milestones?includeArchived=true`).flush([activeMilestone]);
    http.expectOne((candidate) => candidate.url === `/api/projects/${projectId}/work-items`).flush([workItem]);

    fixture.componentInstance.filterForm.controls.priority.setValue('urgent');

    expect(navigate).toHaveBeenCalledWith([], {
      relativeTo: TestBed.inject(ActivatedRoute),
      queryParams: jasmine.objectContaining({
        priority: 'urgent'
      })
    });
  });

  it('debounces search before applying filters', fakeAsync(() => {
    const fixture = TestBed.createComponent(WorkItemListPageComponent);
    const http = TestBed.inject(HttpTestingController);
    const router = TestBed.inject(Router);
    const navigate = spyOn(router, 'navigate').and.resolveTo(true);
    fixture.detectChanges();

    http.expectOne(`/api/projects/${projectId}`).flush(activeProject);
    http.expectOne(`/api/projects/${projectId}/milestones?includeArchived=true`).flush([activeMilestone]);
    http.expectOne((candidate) => candidate.url === `/api/projects/${projectId}/work-items`).flush([workItem]);

    fixture.componentInstance.filterForm.controls.search.setValue('client query');
    tick(399);
    expect(navigate).not.toHaveBeenCalledWith([], jasmine.objectContaining({
      queryParams: jasmine.objectContaining({ search: 'client query' })
    }));

    tick(1);
    expect(navigate).toHaveBeenCalledWith([], {
      relativeTo: TestBed.inject(ActivatedRoute),
      queryParams: jasmine.objectContaining({
        search: 'client query'
      })
    });
  }));
});

describe('WorkItemCreatePageComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WorkItemCreatePageComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: routeStub()
        }
      ]
    }).compileComponents();

    seedCurrentUser();
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  it('shows required title validation before posting', () => {
    const fixture = TestBed.createComponent(WorkItemCreatePageComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne(`/api/projects/${projectId}`).flush(activeProject);
    http.expectOne(`/api/projects/${projectId}/milestones`).flush([activeMilestone]);
    http.expectOne(`/api/projects/${projectId}/labels`).flush([backendLabel]);

    fixture.componentInstance.createWorkItem();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Title is required.');
    http.expectNone((request) => request.method === 'POST');
  });

  it('creates a work item and navigates to detail', () => {
    const fixture = TestBed.createComponent(WorkItemCreatePageComponent);
    const http = TestBed.inject(HttpTestingController);
    const router = TestBed.inject(Router);
    const navigate = spyOn(router, 'navigate').and.resolveTo(true);
    fixture.detectChanges();
    http.expectOne(`/api/projects/${projectId}`).flush(activeProject);
    http.expectOne(`/api/projects/${projectId}/milestones`).flush([activeMilestone]);
    http.expectOne(`/api/projects/${projectId}/labels`).flush([backendLabel, archivedLabel]);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('backend');
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('legacy');

    fixture.componentInstance.workItemForm.setValue({
      title: 'Create filtering UI',
      description: 'Build the Phase 10 list filters.',
      type: 'story',
      priority: 'urgent',
      assigneeId: contributorId,
      milestoneId: activeMilestone.id,
      dueDate: '2026-07-20',
      estimatePoints: '8'
    });
    fixture.componentInstance.toggleLabel(backendLabel.id, {
      target: { checked: true }
    } as unknown as Event);
    fixture.componentInstance.createWorkItem();

    const request = http.expectOne(`/api/projects/${projectId}/work-items`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      title: 'Create filtering UI',
      description: 'Build the Phase 10 list filters.',
      type: 'story',
      priority: 'urgent',
      assigneeId: contributorId,
      labelIds: [backendLabel.id],
      milestoneId: activeMilestone.id,
      dueDate: '2026-07-20',
      estimatePoints: 8
    });
    request.flush({
      ...workItem,
      id: '10000000-0000-4000-8000-000000000499',
      title: 'Create filtering UI',
      description: 'Build the Phase 10 list filters.',
      comments: [],
      activity: []
    } satisfies WorkItemDetailDto);

    expect(navigate).toHaveBeenCalledWith([
      '/work-items',
      '10000000-0000-4000-8000-000000000499'
    ]);
  });

  it('excludes inactive members from the create assignee control', () => {
    const fixture = TestBed.createComponent(WorkItemCreatePageComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne(`/api/projects/${projectId}`).flush(activeProject);
    http.expectOne(`/api/projects/${projectId}/milestones`).flush([activeMilestone]);
    http.expectOne(`/api/projects/${projectId}/labels`).flush([backendLabel]);
    fixture.detectChanges();

    const assigneeOptions = [...fixture.nativeElement.querySelectorAll('select[formcontrolname="assigneeId"] option')]
      .map((option: HTMLOptionElement) => option.textContent?.trim());
    expect(assigneeOptions).toContain('Case Contributor');
    expect(assigneeOptions).not.toContain('Riley Former');
  });

  it('normalizes numeric estimate values before posting', () => {
    const fixture = TestBed.createComponent(WorkItemCreatePageComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne(`/api/projects/${projectId}`).flush(activeProject);
    http.expectOne(`/api/projects/${projectId}/milestones`).flush([]);
    http.expectOne(`/api/projects/${projectId}/labels`).flush([]);

    fixture.componentInstance.workItemForm.patchValue({
      title: 'Create estimate normalization',
      type: 'task',
      priority: 'medium'
    });
    fixture.componentInstance.workItemForm.controls.estimatePoints.setValue(8 as unknown as string);
    fixture.componentInstance.createWorkItem();

    const request = http.expectOne(`/api/projects/${projectId}/work-items`);
    expect(request.request.body.estimatePoints).toBe(8);
    expect(request.request.body.labelIds).toEqual([]);
    expect(request.request.body.milestoneId).toBeNull();
    request.flush({
      ...workItem,
      id: '10000000-0000-4000-8000-000000000498',
      title: 'Create estimate normalization',
      description: '',
      comments: [],
      activity: []
    } satisfies WorkItemDetailDto);
  });

  it('shows archived project notice and prevents create requests', () => {
    const fixture = TestBed.createComponent(WorkItemCreatePageComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne(`/api/projects/${projectId}`).flush(archivedProject);
    http.expectOne(`/api/projects/${projectId}/milestones`).flush([activeMilestone]);
    http.expectOne(`/api/projects/${projectId}/labels`).flush([backendLabel]);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Archived project');
    expect(compiled.querySelector('button[type="submit"]')?.hasAttribute('disabled')).toBeTrue();

    fixture.componentInstance.workItemForm.patchValue({
      title: 'Blocked archived create',
      type: 'task',
      priority: 'medium'
    });
    fixture.componentInstance.createWorkItem();

    http.expectNone(`/api/projects/${projectId}/work-items`);
  });
});
