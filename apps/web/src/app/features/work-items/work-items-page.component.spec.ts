import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed, fakeAsync, flushMicrotasks, tick } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import type {
  LabelDto,
  MemberDto,
  MilestoneDto,
  ProjectCycleDto,
  ProjectDto,
  SavedWorkViewDto,
  WorkspaceCapabilitiesDto,
  WorkItemDetailDto,
  WorkItemListItemDto,
  WorkItemRelationshipSummaryDto
} from '@worktrail/contracts';
import { BehaviorSubject } from 'rxjs';

import { CurrentUserService } from '../../core/current-user.service';
import { ClipboardService } from '../../shared/clipboard.service';
import { WorkItemImportPageComponent } from './work-item-import-page.component';
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

const ownerMember: MemberDto = {
  ...member,
  id: '10000000-0000-4000-8000-000000000101',
  name: 'Avery Owner',
  email: 'avery.owner@example.com',
  role: 'owner'
};

const emptyRelationships: WorkItemRelationshipSummaryDto = {
  blockedBy: [],
  blocks: [],
  related: [],
  dependencyBlocked: false,
  openBlockerCount: 0,
  openBlockedWorkCount: 0
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

const activeCycle: ProjectCycleDto = {
  id: '10000000-0000-4000-8000-000000000701',
  workspaceId: member.workspaceId,
  projectId,
  name: 'Cycle 1',
  goal: 'Integrate cycle assignment.',
  status: 'active',
  startDate: '2026-07-06',
  endDate: '2026-07-20',
  targetPoints: 24,
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
  cycle: activeCycle,
  boardPosition: 1024,
  dueDate: null,
  estimatePoints: 5,
  parent: null,
  childSummary: null,
  dependencyBlocked: false,
  openBlockerCount: 0,
  openBlockedWorkCount: 0,
  createdAt: '2026-07-02T12:00:00.000Z',
  updatedAt: '2026-07-03T12:00:00.000Z'
};

const backendLabel = workItem.labels[0];

const readyWorkItem: WorkItemListItemDto = {
  ...workItem,
  id: '10000000-0000-4000-8000-000000000404',
  itemNumber: 4,
  displayKey: 'WT-4',
  title: 'Prepare bulk triage feedback',
  status: 'ready',
  boardPosition: 2048
};

const archivedLabel = {
  id: '10000000-0000-4000-8000-000000000399',
  name: 'legacy',
  color: '#64748b',
  isArchived: true,
  archivedAt: '2026-07-03T12:00:00.000Z'
};

const personalProjectSavedView: SavedWorkViewDto = {
  id: '10000000-0000-4000-8000-000000000801',
  workspaceId: member.workspaceId,
  projectId,
  owner: member,
  name: 'My project work',
  scope: 'project',
  visibility: 'personal',
  isPinned: false,
  query: {
    assigneeId: contributorId,
    sort: 'updated_desc'
  },
  createdAt: '2026-07-03T12:00:00.000Z',
  updatedAt: '2026-07-03T12:00:00.000Z'
};

const sharedProjectSavedView: SavedWorkViewDto = {
  ...personalProjectSavedView,
  id: '10000000-0000-4000-8000-000000000802',
  owner: ownerMember,
  name: 'Ready for QA',
  visibility: 'workspace',
  query: {
    status: 'ready',
    sort: 'board_order'
  }
};

const pinnedPersonalProjectSavedView: SavedWorkViewDto = {
  ...personalProjectSavedView,
  id: '10000000-0000-4000-8000-000000000805',
  name: 'Pinned personal project work',
  isPinned: true
};

const pinnedSharedProjectSavedView: SavedWorkViewDto = {
  ...sharedProjectSavedView,
  id: '10000000-0000-4000-8000-000000000806',
  name: 'Pinned ready for QA',
  isPinned: true
};

const ownerCapabilities: WorkspaceCapabilitiesDto = {
  actor: member,
  canManageWorkspace: true,
  canManageMembers: true,
  canCreateProjects: true,
  canManageProjects: true,
  canManageMilestones: true,
  canManageLabels: true,
  canCreateWorkItems: true,
  roleSummary: {
    owner: 'Owners manage workspace settings and members.',
    maintainer: 'Maintainers manage projects and delivery artifacts.',
    contributor: 'Contributors manage assigned work.'
  }
};

const readOnlyCapabilities: WorkspaceCapabilitiesDto = {
  ...ownerCapabilities,
  canCreateWorkItems: false
};

let clipboard: jasmine.SpyObj<ClipboardService>;

function routeStub(query: Record<string, string> = {}, inputProjectId: string = projectId) {
  const queryParamMap = new BehaviorSubject(convertToParamMap(query));
  const paramMap = new BehaviorSubject(
    convertToParamMap(inputProjectId === '' ? {} : { projectId: inputProjectId })
  );
  const snapshot = {
    paramMap: paramMap.value,
    queryParamMap: queryParamMap.value
  };

  return {
    snapshot,
    paramMap,
    queryParamMap,
    setQuery(nextQuery: Record<string, string>): void {
      snapshot.queryParamMap = convertToParamMap(nextQuery);
      queryParamMap.next(snapshot.queryParamMap);
    },
    setProjectId(nextProjectId: string): void {
      snapshot.paramMap = convertToParamMap(nextProjectId === '' ? {} : { projectId: nextProjectId });
      paramMap.next(snapshot.paramMap);
    }
  };
}

function seedCurrentUser(actor: MemberDto = member) {
  const currentUser = TestBed.inject(CurrentUserService);
  currentUser.members.set(
    [actor, member, ownerMember, inactiveMember].filter(
      (item, index, members) => members.findIndex((member) => member.id === item.id) === index
    )
  );
  currentUser.selectMember(actor.id);
}

function spyOnCsvDownload(): void {
  spyOn(URL, 'createObjectURL').and.returnValue('blob:worktrail-export');
  spyOn(URL, 'revokeObjectURL');
}

function flushCreateContext(
  http: HttpTestingController,
  input: {
    project?: ProjectDto;
    labels?: LabelDto[];
    milestones?: MilestoneDto[];
    cycles?: ProjectCycleDto[];
    capabilities?: WorkspaceCapabilitiesDto;
  } = {}
) {
  http.expectOne('/api/workspace/capabilities').flush(input.capabilities ?? ownerCapabilities);
  http.expectOne(`/api/projects/${projectId}`).flush(input.project ?? activeProject);
  http
    .expectOne(`/api/projects/${projectId}/milestones`)
    .flush(input.milestones ?? [activeMilestone]);
  http.expectOne(`/api/projects/${projectId}/cycles`).flush(input.cycles ?? [activeCycle]);
  http.expectOne(`/api/projects/${projectId}/labels`).flush(input.labels ?? [backendLabel]);
}

function flushProjectSavedViews(
  http: HttpTestingController,
  savedViews: SavedWorkViewDto[] = [],
  inputProjectId = projectId
): void {
  const request = http.expectOne((candidate) => candidate.url === '/api/saved-work-views');
  expect(request.request.method).toBe('GET');
  expect(request.request.params.get('scope')).toBe('project');
  expect(request.request.params.get('projectId')).toBe(inputProjectId);
  request.flush(savedViews);
}

function openSavedViewFromToolbar(
  fixture: ComponentFixture<WorkItemListPageComponent>,
  savedViewId: string
): void {
  const compiled = fixture.nativeElement as HTMLElement;
  const select = compiled.querySelector<HTMLSelectElement>('.saved-view-open select');
  select!.value = savedViewId;
  select!.dispatchEvent(new Event('change'));
  fixture.detectChanges();
  compiled.querySelector<HTMLButtonElement>('.saved-view-open button')?.click();
  fixture.detectChanges();
}

function projectWorkItemPage(
  items: WorkItemListItemDto[],
  overrides: Partial<{
    page: number;
    pageSize: 10 | 25 | 50 | 100;
    totalCount: number;
    totalPages: number;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
  }> = {}
) {
  return {
    items,
    page: 1,
    pageSize: 25 as const,
    totalCount: items.length,
    totalPages: items.length === 0 ? 0 : 1,
    hasPreviousPage: false,
    hasNextPage: false,
    ...overrides
  };
}

function projectPageItems(count: number, startItemNumber = 1): WorkItemListItemDto[] {
  return Array.from({ length: count }, (_, index) => {
    const itemNumber = startItemNumber + index;
    return {
      ...workItem,
      id: `page-work-item-${itemNumber}`,
      itemNumber,
      displayKey: `WT-${itemNumber}`,
      title: `Paged work item ${itemNumber}`
    };
  });
}

function flushProjectWorkContext(http: HttpTestingController): void {
  http.expectOne(`/api/projects/${projectId}`).flush(activeProject);
  http
    .expectOne(`/api/projects/${projectId}/milestones?includeArchived=true`)
    .flush([activeMilestone]);
  http.expectOne(`/api/projects/${projectId}/cycles?includeArchived=true`).flush([activeCycle]);
  flushProjectSavedViews(http);
}

function flushProjectWorkPage(
  http: HttpTestingController,
  workItems: WorkItemListItemDto[] = [workItem]
): void {
  flushProjectWorkContext(http);
  http
    .expectOne((candidate) => candidate.url === `/api/projects/${projectId}/work-items`)
    .flush(projectWorkItemPage(workItems));
}

function flushPendingCycleRequests(http: HttpTestingController): void {
  for (const request of http.match((candidate) => candidate.url.includes('/cycles'))) {
    request.flush([]);
  }
}

function bulkSuccessResponse(inputWorkItem: WorkItemListItemDto = workItem): {
  requestedCount: number;
  succeededCount: number;
  unchangedCount: number;
  failedCount: number;
  results: Array<{
    workItemId: string;
    displayKey: string;
    status: 'updated';
    workItem: WorkItemListItemDto;
    error: null;
  }>;
} {
  return {
    requestedCount: 1,
    succeededCount: 1,
    unchangedCount: 0,
    failedCount: 0,
    results: [
      {
        workItemId: inputWorkItem.id,
        displayKey: inputWorkItem.displayKey,
        status: 'updated',
        workItem: inputWorkItem,
        error: null
      }
    ]
  };
}

function bulkResultCounts(compiled: HTMLElement): string[] {
  return [...compiled.querySelectorAll<HTMLElement>('.bulk-result__stats dd')].map(
    (item) => item.textContent?.trim() ?? ''
  );
}

describe('WorkItemListPageComponent', () => {
  let projectRoute: ReturnType<typeof routeStub>;

  beforeEach(async () => {
    projectRoute = routeStub({
      status: 'in_progress',
      assigneeId: contributorId,
      reporterId: contributorId,
      milestoneId: activeMilestone.id,
      dueDateState: 'due_soon',
      dependency: 'dependency_blocked',
      search: 'api',
      sort: 'due_date_asc'
    });
    clipboard = jasmine.createSpyObj<ClipboardService>('ClipboardService', ['copyText']);
    clipboard.copyText.and.resolveTo();

    await TestBed.configureTestingModule({
      imports: [WorkItemListPageComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: projectRoute
        },
        {
          provide: ClipboardService,
          useValue: clipboard
        }
      ]
    }).compileComponents();

    seedCurrentUser();
  });

  afterEach(() => {
    const http = TestBed.inject(HttpTestingController);
    flushPendingCycleRequests(http);
    http.verify();
  });

  it('loads work items with query parameter filters and renders dense rows', () => {
    const fixture = TestBed.createComponent(WorkItemListPageComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne(`/api/projects/${projectId}`).flush(activeProject);
    http
      .expectOne(`/api/projects/${projectId}/milestones?includeArchived=true`)
      .flush([activeMilestone]);
    http.expectOne(`/api/projects/${projectId}/cycles?includeArchived=true`).flush([activeCycle]);
    flushProjectSavedViews(http);

    const request = http.expectOne((candidate) => {
      return (
        candidate.url === `/api/projects/${projectId}/work-items` &&
        candidate.params.get('status') === 'in_progress' &&
        candidate.params.get('assigneeId') === contributorId &&
        candidate.params.get('reporterId') === contributorId &&
        candidate.params.get('milestoneId') === activeMilestone.id &&
        candidate.params.get('dueDateState') === 'due_soon' &&
        candidate.params.get('dependency') === 'dependency_blocked' &&
        candidate.params.get('search') === 'api' &&
        candidate.params.get('sort') === 'due_date_asc'
      );
    });
    request.flush(
      projectWorkItemPage([
        { ...workItem, dependencyBlocked: true, openBlockerCount: 2, openBlockedWorkCount: 1 }
      ])
    );
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const filtersZone = compiled.querySelector<HTMLElement>('.work-list-filters');
    const chipsElement = filtersZone?.querySelector('app-active-filter-chips');
    const filterPanelElement = filtersZone?.querySelector('app-work-item-filter-panel');
    expect(compiled.querySelector('.work-list-views')).not.toBeNull();
    expect(filtersZone).not.toBeNull();
    expect(compiled.querySelector('.work-list-actions')).not.toBeNull();
    expect(compiled.querySelector('.work-list-results')).not.toBeNull();
    expect(chipsElement).not.toBeNull();
    expect(filterPanelElement).not.toBeNull();
    expect(
      Boolean(
        chipsElement!.compareDocumentPosition(filterPanelElement!) &
        Node.DOCUMENT_POSITION_FOLLOWING
      )
    ).toBeTrue();
    expect(compiled.textContent).toContain('WT-3');
    expect(compiled.textContent).toContain('Implement work item API client');
    expect(compiled.textContent).toContain('Case Contributor');
    expect(compiled.textContent).toContain('backend');
    expect(compiled.textContent).toContain('v0.0.3');
    expect(compiled.textContent).toContain('Due date: Due soon');
    expect(compiled.textContent).toContain('Dependency: Blocked by open work');
    expect(compiled.textContent).toContain('Blocked by 2');
    expect(compiled.textContent).toContain('Blocks 1');
    expect(compiled.textContent).toContain('Export CSV');
    expect(
      compiled
        .querySelector<HTMLButtonElement>(
          'button[aria-label="Export applied project filters as CSV"]'
        )
        ?.getAttribute('title')
    ).toBe('Export the applied project filters as CSV');
    expect(
      compiled.querySelector<HTMLAnchorElement>(
        `a[href="/projects/${projectId}/work-items/import"]`
      )
    ).not.toBeNull();
  });

  it('restores first, middle, and final project pages from route state without stealing focus', () => {
    seedCurrentUser(ownerMember);
    projectRoute.setQuery({ status: 'ready', page: '2', pageSize: '10' });
    const fixture = TestBed.createComponent(WorkItemListPageComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    flushProjectWorkContext(http);

    const middlePage = http.expectOne((candidate) => {
      return (
        candidate.url === `/api/projects/${projectId}/work-items` &&
        candidate.params.get('status') === 'ready' &&
        candidate.params.get('page') === '2' &&
        candidate.params.get('pageSize') === '10'
      );
    });
    middlePage.flush(
      projectWorkItemPage(projectPageItems(10, 11), {
        page: 2,
        pageSize: 10,
        totalCount: 21,
        totalPages: 3,
        hasPreviousPage: true,
        hasNextPage: true
      })
    );
    fixture.detectChanges();

    let compiled = fixture.nativeElement as HTMLElement;
    const resultHeading = compiled.querySelector<HTMLHeadingElement>('.list-heading h2');
    expect(resultHeading?.textContent?.trim()).toBe('11-20 of 21 work items');
    expect(compiled.querySelector('.pagination__status')?.textContent?.trim()).toBe('Page 2 of 3');
    expect(document.activeElement).not.toBe(resultHeading);

    fixture.componentInstance.enterBulkEdit();
    fixture.componentInstance.toggleWorkItemSelection('page-work-item-11');
    fixture.componentInstance.bulkActionForm.patchValue({
      actionType: 'set_priority',
      priority: 'urgent'
    });

    projectRoute.setQuery({ status: 'ready', page: '3', pageSize: '10' });
    http
      .expectOne((candidate) => {
        return (
          candidate.url === `/api/projects/${projectId}/work-items` &&
          candidate.params.get('page') === '3' &&
          candidate.params.get('pageSize') === '10'
        );
      })
      .flush(
        projectWorkItemPage(projectPageItems(1, 21), {
          page: 3,
          pageSize: 10,
          totalCount: 21,
          totalPages: 3,
          hasPreviousPage: true,
          hasNextPage: false
        })
      );
    fixture.detectChanges();

    compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.list-heading h2')?.textContent?.trim()).toBe(
      '21-21 of 21 work items'
    );
    expect(compiled.querySelector('.pagination__status')?.textContent?.trim()).toBe('Page 3 of 3');
    expect(fixture.componentInstance.selectedWorkItemIds()).toEqual([]);
    expect(fixture.componentInstance.bulkActionForm.controls.actionType.value).toBe('');

    projectRoute.setQuery({ status: 'ready', pageSize: '10' });
    http
      .expectOne((candidate) => {
        return (
          candidate.url === `/api/projects/${projectId}/work-items` &&
          candidate.params.get('page') === '1' &&
          candidate.params.get('pageSize') === '10'
        );
      })
      .flush(
        projectWorkItemPage(projectPageItems(10), {
          pageSize: 10,
          totalCount: 21,
          totalPages: 3,
          hasNextPage: true
        })
      );
    fixture.detectChanges();

    compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.list-heading h2')?.textContent?.trim()).toBe(
      '1-10 of 21 work items'
    );
    expect(compiled.querySelector('.pagination__status')?.textContent?.trim()).toBe('Page 1 of 3');
    expect(fixture.componentInstance.appliedFilterValues().status).toBe('ready');
  });

  it('keeps draft filters independent and focuses results after user paging', fakeAsync(() => {
    seedCurrentUser(ownerMember);
    projectRoute.setQuery({ status: 'ready', pageSize: '10' });
    const fixture = TestBed.createComponent(WorkItemListPageComponent);
    const http = TestBed.inject(HttpTestingController);
    const router = TestBed.inject(Router);
    const navigate = spyOn(router, 'navigate').and.resolveTo(true);
    fixture.detectChanges();
    flushProjectWorkContext(http);
    http
      .expectOne((candidate) => candidate.url === `/api/projects/${projectId}/work-items`)
      .flush(
        projectWorkItemPage(projectPageItems(10), {
          pageSize: 10,
          totalCount: 21,
          totalPages: 3,
          hasNextPage: true
        })
      );
    fixture.detectChanges();

    const initialHeading = (fixture.nativeElement as HTMLElement).querySelector<HTMLHeadingElement>(
      '.list-heading h2'
    );
    expect(document.activeElement).not.toBe(initialHeading);

    fixture.componentInstance.filterForm.patchValue(
      { search: 'draft only', sort: 'created_desc' },
      { emitEvent: false }
    );
    fixture.componentInstance.enterBulkEdit();
    fixture.componentInstance.toggleWorkItemSelection('page-work-item-1');
    fixture.componentInstance.bulkActionForm.patchValue({
      actionType: 'set_priority',
      priority: 'urgent'
    });

    fixture.componentInstance.goToPage(2);

    expect(navigate).toHaveBeenCalledWith([], {
      relativeTo: TestBed.inject(ActivatedRoute),
      queryParams: jasmine.objectContaining({ status: 'ready', page: '2', pageSize: '10' })
    });
    const navigationQuery = navigate.calls.mostRecent().args[1]?.queryParams as Record<
      string,
      unknown
    >;
    expect(navigationQuery['search']).toBeNull();
    expect(navigationQuery['sort']).toBeNull();
    expect(fixture.componentInstance.filterForm.controls.search.value).toBe('draft only');
    expect(fixture.componentInstance.filterForm.controls.sort.value).toBe('created_desc');
    expect(fixture.componentInstance.selectedWorkItemIds()).toEqual([]);
    expect(fixture.componentInstance.bulkActionForm.controls.actionType.value).toBe('');

    projectRoute.setQuery({ status: 'ready', page: '2', pageSize: '10' });
    http
      .expectOne((candidate) => {
        return (
          candidate.url === `/api/projects/${projectId}/work-items` &&
          candidate.params.get('page') === '2'
        );
      })
      .flush(
        projectWorkItemPage(projectPageItems(10, 11), {
          page: 2,
          pageSize: 10,
          totalCount: 21,
          totalPages: 3,
          hasPreviousPage: true,
          hasNextPage: true
        })
      );
    fixture.detectChanges();
    tick();

    const focusedHeading = (fixture.nativeElement as HTMLElement).querySelector<HTMLHeadingElement>(
      '.list-heading h2'
    );
    expect(document.activeElement).toBe(focusedHeading);
    expect(focusedHeading?.textContent?.trim()).toBe('11-20 of 21 work items');
    expect(fixture.componentInstance.filterForm.controls.search.value).toBe('draft only');
    expect(fixture.componentInstance.filterForm.controls.sort.value).toBe('created_desc');
    expect(fixture.componentInstance.appliedFilterValues().status).toBe('ready');
    expect(fixture.componentInstance.appliedFilterValues().search).toBe('');

    navigate.calls.reset();
    fixture.componentInstance.enterBulkEdit();
    fixture.componentInstance.toggleWorkItemSelection('page-work-item-11');
    fixture.componentInstance.bulkActionForm.patchValue({
      actionType: 'set_priority',
      priority: 'urgent'
    });
    fixture.componentInstance.changePageSize(25);

    expect(navigate).toHaveBeenCalledWith([], {
      relativeTo: TestBed.inject(ActivatedRoute),
      queryParams: jasmine.objectContaining({
        status: 'ready',
        page: null,
        pageSize: null
      })
    });
    expect(fixture.componentInstance.selectedWorkItemIds()).toEqual([]);
    expect(fixture.componentInstance.bulkActionForm.controls.actionType.value).toBe('');
  }));

  it('retains a paging focus request through an error and retry', fakeAsync(() => {
    projectRoute.setQuery({ pageSize: '10' });
    const fixture = TestBed.createComponent(WorkItemListPageComponent);
    const http = TestBed.inject(HttpTestingController);
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
    fixture.detectChanges();
    flushProjectWorkContext(http);
    http
      .expectOne((candidate) => candidate.url === `/api/projects/${projectId}/work-items`)
      .flush(
        projectWorkItemPage(projectPageItems(10), {
          pageSize: 10,
          totalCount: 12,
          totalPages: 2,
          hasNextPage: true
        })
      );
    fixture.detectChanges();

    fixture.componentInstance.goToPage(2);
    projectRoute.setQuery({ page: '2', pageSize: '10' });
    http
      .expectOne((candidate) => {
        return (
          candidate.url === `/api/projects/${projectId}/work-items` &&
          candidate.params.get('page') === '2'
        );
      })
      .flush('failed', { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();
    tick();

    let heading = (fixture.nativeElement as HTMLElement).querySelector<HTMLHeadingElement>(
      '.list-heading h2'
    );
    expect(document.activeElement).not.toBe(heading);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Work items could not be loaded from the API.'
    );

    fixture.componentInstance.loadWorkItems();
    http
      .expectOne((candidate) => {
        return (
          candidate.url === `/api/projects/${projectId}/work-items` &&
          candidate.params.get('page') === '2'
        );
      })
      .flush(
        projectWorkItemPage(projectPageItems(2, 11), {
          page: 2,
          pageSize: 10,
          totalCount: 12,
          totalPages: 2,
          hasPreviousPage: true
        })
      );
    fixture.detectChanges();
    tick();

    heading = (fixture.nativeElement as HTMLElement).querySelector<HTMLHeadingElement>(
      '.list-heading h2'
    );
    expect(document.activeElement).toBe(heading);
    expect(heading?.textContent?.trim()).toBe('11-12 of 12 work items');
  }));

  it('lets owners select visible project work items locally', () => {
    seedCurrentUser(ownerMember);
    const fixture = TestBed.createComponent(WorkItemListPageComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne(`/api/projects/${projectId}`).flush(activeProject);
    http
      .expectOne(`/api/projects/${projectId}/milestones?includeArchived=true`)
      .flush([activeMilestone]);
    flushProjectSavedViews(http);
    http
      .expectOne((candidate) => candidate.url === `/api/projects/${projectId}/work-items`)
      .flush(projectWorkItemPage([workItem, readyWorkItem]));
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(fixture.componentInstance.canEnterBulkEdit()).toBeTrue();
    expect(fixture.componentInstance.canSelectWorkItems()).toBeFalse();
    expect(compiled.querySelector('button.bulk-edit-entry')?.textContent?.trim()).toBe('Bulk edit');
    expect(compiled.querySelector('input[aria-label="Select all visible work items"]')).toBeNull();
    expect(compiled.querySelector('input[aria-label="Select WT-3"]')).toBeNull();

    fixture.componentInstance.enterBulkEdit();
    fixture.detectChanges();

    expect(fixture.componentInstance.canSelectWorkItems()).toBeTrue();
    expect(
      compiled.querySelector('input[aria-label="Select all visible work items"]')
    ).not.toBeNull();
    expect(compiled.querySelector('input[aria-label="Select WT-3"]')).not.toBeNull();
    expect(compiled.textContent).toContain('Exit bulk edit');

    fixture.componentInstance.toggleWorkItemSelection(workItem.id);
    expect(fixture.componentInstance.selectedWorkItemIds()).toEqual([workItem.id]);
    expect(fixture.componentInstance.selectedVisibleCount()).toBe(1);
    expect(fixture.componentInstance.isAllVisibleSelected()).toBeFalse();

    fixture.componentInstance.toggleAllVisibleSelection();
    expect(fixture.componentInstance.selectedWorkItemIds()).toEqual([
      workItem.id,
      readyWorkItem.id
    ]);
    expect(fixture.componentInstance.selectedVisibleCount()).toBe(2);
    expect(fixture.componentInstance.isAllVisibleSelected()).toBeTrue();

    fixture.componentInstance.toggleAllVisibleSelection();
    expect(fixture.componentInstance.selectedWorkItemIds()).toEqual([]);
  });

  it('hides selection for contributors and archived projects', () => {
    const fixture = TestBed.createComponent(WorkItemListPageComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne(`/api/projects/${projectId}`).flush(archivedProject);
    http
      .expectOne(`/api/projects/${projectId}/milestones?includeArchived=true`)
      .flush([activeMilestone]);
    flushProjectSavedViews(http);
    http
      .expectOne((candidate) => candidate.url === `/api/projects/${projectId}/work-items`)
      .flush(projectWorkItemPage([workItem]));
    fixture.detectChanges();

    expect(fixture.componentInstance.canEnterBulkEdit()).toBeFalse();
    expect(fixture.componentInstance.canSelectWorkItems()).toBeFalse();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('button.bulk-edit-entry')
    ).toBeNull();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('input[aria-label="Select WT-3"]')
    ).toBeNull();

    fixture.componentInstance.toggleWorkItemSelection(workItem.id);
    fixture.componentInstance.enterBulkEdit();
    fixture.componentInstance.toggleAllVisibleSelection();
    expect(fixture.componentInstance.selectedWorkItemIds()).toEqual([]);
  });

  it('prunes selection to visible rows after a project work reload', () => {
    seedCurrentUser(ownerMember);
    const fixture = TestBed.createComponent(WorkItemListPageComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne(`/api/projects/${projectId}`).flush(activeProject);
    http
      .expectOne(`/api/projects/${projectId}/milestones?includeArchived=true`)
      .flush([activeMilestone]);
    flushProjectSavedViews(http);
    http
      .expectOne((candidate) => candidate.url === `/api/projects/${projectId}/work-items`)
      .flush(projectWorkItemPage([workItem, readyWorkItem]));
    fixture.detectChanges();

    fixture.componentInstance.enterBulkEdit();
    fixture.componentInstance.toggleAllVisibleSelection();
    expect(fixture.componentInstance.selectedWorkItemIds()).toEqual([
      workItem.id,
      readyWorkItem.id
    ]);

    fixture.componentInstance.loadWorkItems();
    http
      .expectOne((candidate) => candidate.url === `/api/projects/${projectId}/work-items`)
      .flush(projectWorkItemPage([readyWorkItem]));
    fixture.detectChanges();

    expect(fixture.componentInstance.selectedWorkItemIds()).toEqual([readyWorkItem.id]);
    expect(fixture.componentInstance.selectedVisibleCount()).toBe(1);
    expect(fixture.componentInstance.isAllVisibleSelected()).toBeTrue();
  });

  it('clears selection when opening a saved project view', () => {
    seedCurrentUser(ownerMember);
    const fixture = TestBed.createComponent(WorkItemListPageComponent);
    const http = TestBed.inject(HttpTestingController);
    const router = TestBed.inject(Router);
    const navigate = spyOn(router, 'navigate').and.resolveTo(true);
    fixture.detectChanges();
    http.expectOne(`/api/projects/${projectId}`).flush(activeProject);
    http
      .expectOne(`/api/projects/${projectId}/milestones?includeArchived=true`)
      .flush([activeMilestone]);
    flushProjectSavedViews(http, [sharedProjectSavedView]);
    http
      .expectOne((candidate) => candidate.url === `/api/projects/${projectId}/work-items`)
      .flush(projectWorkItemPage([workItem]));

    fixture.componentInstance.enterBulkEdit();
    fixture.componentInstance.toggleWorkItemSelection(workItem.id);
    expect(fixture.componentInstance.selectedWorkItemIds()).toEqual([workItem.id]);

    fixture.componentInstance.openSavedView(sharedProjectSavedView);

    expect(fixture.componentInstance.selectedWorkItemIds()).toEqual([]);
    expect(fixture.componentInstance.isBulkEditActive()).toBeFalse();
    expect(navigate).toHaveBeenCalledWith([], {
      relativeTo: TestBed.inject(ActivatedRoute),
      queryParams: jasmine.objectContaining({
        status: 'ready',
        sort: 'board_order',
        page: null,
        pageSize: null
      })
    });
  });

  it('resets paging and bulk state when the active project changes', () => {
    const nextProjectId = '10000000-0000-4000-8000-000000000202';
    seedCurrentUser(ownerMember);
    projectRoute.setQuery({ page: '3', pageSize: '10' });
    const fixture = TestBed.createComponent(WorkItemListPageComponent);
    const http = TestBed.inject(HttpTestingController);
    const router = TestBed.inject(Router);
    const navigate = spyOn(router, 'navigate').and.resolveTo(true);
    fixture.detectChanges();
    flushProjectWorkContext(http);
    http
      .expectOne((candidate) => candidate.url === `/api/projects/${projectId}/work-items`)
      .flush(
        projectWorkItemPage([workItem], {
          page: 3,
          pageSize: 10,
          totalCount: 21,
          totalPages: 3,
          hasPreviousPage: true
        })
      );

    fixture.componentInstance.enterBulkEdit();
    fixture.componentInstance.toggleWorkItemSelection(workItem.id);
    fixture.componentInstance.bulkActionForm.patchValue({
      actionType: 'set_priority',
      priority: 'urgent'
    });
    projectRoute.setProjectId(nextProjectId);

    http.expectOne(`/api/projects/${nextProjectId}`).flush({
      ...activeProject,
      id: nextProjectId,
      key: 'NX',
      name: 'Next project'
    });
    http
      .expectOne(`/api/projects/${nextProjectId}/milestones?includeArchived=true`)
      .flush([]);
    http.expectOne(`/api/projects/${nextProjectId}/cycles?includeArchived=true`).flush([]);
    flushProjectSavedViews(http, [], nextProjectId);

    expect(fixture.componentInstance.projectId()).toBe(nextProjectId);
    expect(fixture.componentInstance.activePageQuery()).toEqual({ page: 1, pageSize: 25 });
    expect(fixture.componentInstance.selectedWorkItemIds()).toEqual([]);
    expect(fixture.componentInstance.isBulkEditActive()).toBeFalse();
    expect(fixture.componentInstance.bulkActionForm.controls.actionType.value).toBe('');
    expect(navigate).toHaveBeenCalledWith([], {
      relativeTo: TestBed.inject(ActivatedRoute),
      queryParams: jasmine.objectContaining({ page: null, pageSize: null })
    });
  });

  it('resets paging and bulk state when the active actor changes', () => {
    seedCurrentUser(ownerMember);
    projectRoute.setQuery({ page: '3', pageSize: '10' });
    const fixture = TestBed.createComponent(WorkItemListPageComponent);
    const http = TestBed.inject(HttpTestingController);
    const router = TestBed.inject(Router);
    const navigate = spyOn(router, 'navigate').and.resolveTo(true);
    fixture.detectChanges();
    flushProjectWorkContext(http);
    http
      .expectOne((candidate) => candidate.url === `/api/projects/${projectId}/work-items`)
      .flush(
        projectWorkItemPage([workItem], {
          page: 3,
          pageSize: 10,
          totalCount: 21,
          totalPages: 3,
          hasPreviousPage: true
        })
      );

    fixture.componentInstance.enterBulkEdit();
    fixture.componentInstance.toggleWorkItemSelection(workItem.id);
    fixture.componentInstance.bulkActionForm.patchValue({
      actionType: 'set_priority',
      priority: 'urgent'
    });
    TestBed.inject(CurrentUserService).selectMember(member.id);
    fixture.detectChanges();
    flushProjectWorkContext(http);

    expect(fixture.componentInstance.activePageQuery()).toEqual({ page: 1, pageSize: 25 });
    expect(fixture.componentInstance.selectedWorkItemIds()).toEqual([]);
    expect(fixture.componentInstance.bulkActionForm.controls.actionType.value).toBe('');
    expect(navigate).toHaveBeenCalledWith([], {
      relativeTo: TestBed.inject(ActivatedRoute),
      queryParams: jasmine.objectContaining({ page: null, pageSize: null })
    });
  });

  it('keeps bulk apply disabled until the selected action has required values', () => {
    seedCurrentUser(ownerMember);
    const fixture = TestBed.createComponent(WorkItemListPageComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    flushProjectWorkPage(http, [workItem]);
    fixture.detectChanges();

    fixture.componentInstance.enterBulkEdit();
    fixture.componentInstance.toggleWorkItemSelection(workItem.id);
    fixture.detectChanges();

    const applyButton = () =>
      (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
        '.bulk-action-form button[type="submit"]'
      );

    expect(applyButton()?.disabled).toBeTrue();

    fixture.componentInstance.bulkActionForm.patchValue({ actionType: 'set_priority' });
    fixture.detectChanges();
    expect(applyButton()?.disabled).toBeTrue();

    fixture.componentInstance.bulkActionForm.patchValue({ priority: 'urgent' });
    fixture.detectChanges();
    expect(applyButton()?.disabled).toBeFalse();
  });

  it('gives bulk label controls explicit accessible names', () => {
    seedCurrentUser(ownerMember);
    const fixture = TestBed.createComponent(WorkItemListPageComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    flushProjectWorkPage(http, [workItem]);

    fixture.componentInstance.enterBulkEdit();
    fixture.componentInstance.toggleWorkItemSelection(workItem.id);
    fixture.componentInstance.bulkActionForm.patchValue({ actionType: 'add_labels' });
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(
      compiled.querySelector<HTMLInputElement>('input[aria-label="Add label backend"]')
    ).not.toBeNull();

    fixture.componentInstance.bulkActionForm.patchValue({ actionType: 'remove_labels' });
    fixture.detectChanges();

    expect(
      compiled.querySelector<HTMLInputElement>('input[aria-label="Remove label backend"]')
    ).not.toBeNull();
  });

  it('serializes each supported project bulk action and reloads after success', () => {
    seedCurrentUser(ownerMember);
    const fixture = TestBed.createComponent(WorkItemListPageComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    flushProjectWorkPage(http, [workItem]);

    const cases = [
      {
        form: { actionType: 'set_assignee', assigneeId: ownerMember.id },
        labels: [],
        action: { type: 'set_assignee', assigneeId: ownerMember.id }
      },
      {
        form: { actionType: 'clear_assignee' },
        labels: [],
        action: { type: 'clear_assignee' }
      },
      {
        form: { actionType: 'set_priority', priority: 'urgent' },
        labels: [],
        action: { type: 'set_priority', priority: 'urgent' }
      },
      {
        form: { actionType: 'set_milestone', milestoneId: activeMilestone.id },
        labels: [],
        action: { type: 'set_milestone', milestoneId: activeMilestone.id }
      },
      {
        form: { actionType: 'clear_milestone' },
        labels: [],
        action: { type: 'clear_milestone' }
      },
      {
        form: { actionType: 'set_cycle', cycleId: activeCycle.id },
        labels: [],
        action: { type: 'set_cycle', cycleId: activeCycle.id }
      },
      {
        form: { actionType: 'clear_cycle' },
        labels: [],
        action: { type: 'clear_cycle' }
      },
      {
        form: { actionType: 'set_due_date', dueDate: '2026-07-22' },
        labels: [],
        action: { type: 'set_due_date', dueDate: '2026-07-22' }
      },
      {
        form: { actionType: 'clear_due_date' },
        labels: [],
        action: { type: 'clear_due_date' }
      },
      {
        form: { actionType: 'add_labels' },
        labels: [backendLabel.id],
        action: { type: 'add_labels', labelIds: [backendLabel.id] }
      },
      {
        form: { actionType: 'remove_labels' },
        labels: [backendLabel.id],
        action: { type: 'remove_labels', labelIds: [backendLabel.id] }
      },
      {
        form: { actionType: 'transition_status', status: 'ready' },
        labels: [],
        action: { type: 'transition_status', status: 'ready' }
      }
    ] as const;

    fixture.componentInstance.enterBulkEdit();

    for (const item of cases) {
      fixture.componentInstance.clearSelection();
      fixture.componentInstance.bulkActionForm.setValue({
        actionType: '',
        assigneeId: '',
        priority: '',
        milestoneId: '',
        cycleId: '',
        dueDate: '',
        status: ''
      });
      fixture.componentInstance.toggleWorkItemSelection(workItem.id);
      fixture.componentInstance.bulkActionForm.patchValue(item.form);
      fixture.componentInstance.selectedBulkLabelIds.set([...item.labels]);

      expect(fixture.componentInstance.canApplyBulkAction()).toBeTrue();
      fixture.componentInstance.applyBulkAction();

      const request = http.expectOne(`/api/projects/${projectId}/work-items/bulk-update`);
      expect(request.request.method).toBe('POST');
      expect(request.request.body).toEqual({
        workItemIds: [workItem.id],
        action: item.action
      });
      request.flush(bulkSuccessResponse(workItem));
      http
        .expectOne((candidate) => candidate.url === `/api/projects/${projectId}/work-items`)
        .flush(projectWorkItemPage([workItem]));
      expect(fixture.componentInstance.selectedWorkItemIds()).toEqual([]);
    }
  });

  it('confirms multi-item status transitions before submitting', () => {
    seedCurrentUser(ownerMember);
    const confirm = spyOn(window, 'confirm').and.returnValue(true);
    const fixture = TestBed.createComponent(WorkItemListPageComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    flushProjectWorkPage(http, [workItem, readyWorkItem]);

    fixture.componentInstance.enterBulkEdit();
    fixture.componentInstance.toggleAllVisibleSelection();
    fixture.componentInstance.bulkActionForm.patchValue({
      actionType: 'transition_status',
      status: 'blocked'
    });
    fixture.componentInstance.applyBulkAction();

    expect(confirm).toHaveBeenCalledWith('Transition 2 selected work items?');
    const request = http.expectOne(`/api/projects/${projectId}/work-items/bulk-update`);
    expect(request.request.body).toEqual({
      workItemIds: [workItem.id, readyWorkItem.id],
      action: {
        type: 'transition_status',
        status: 'blocked'
      }
    });
    request.flush({
      requestedCount: 2,
      succeededCount: 2,
      unchangedCount: 0,
      failedCount: 0,
      results: [
        {
          workItemId: workItem.id,
          displayKey: workItem.displayKey,
          status: 'updated',
          workItem,
          error: null
        },
        {
          workItemId: readyWorkItem.id,
          displayKey: readyWorkItem.displayKey,
          status: 'updated',
          workItem: readyWorkItem,
          error: null
        }
      ]
    });
    http
      .expectOne((candidate) => candidate.url === `/api/projects/${projectId}/work-items`)
      .flush(projectWorkItemPage([workItem, readyWorkItem]));
  });

  it('keeps successful bulk result feedback visible after clearing successful selection', () => {
    seedCurrentUser(ownerMember);
    const fixture = TestBed.createComponent(WorkItemListPageComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    flushProjectWorkPage(http, [workItem]);

    fixture.componentInstance.enterBulkEdit();
    fixture.componentInstance.toggleWorkItemSelection(workItem.id);
    fixture.componentInstance.bulkActionForm.patchValue({
      actionType: 'set_priority',
      priority: 'urgent'
    });
    fixture.componentInstance.applyBulkAction();

    const request = http.expectOne(`/api/projects/${projectId}/work-items/bulk-update`);
    request.flush(bulkSuccessResponse(workItem));
    http
      .expectOne((candidate) => candidate.url === `/api/projects/${projectId}/work-items`)
      .flush(projectWorkItemPage([workItem]));
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(fixture.componentInstance.selectedWorkItemIds()).toEqual([]);
    expect(compiled.textContent).toContain('Bulk update complete');
    expect(compiled.querySelector('.bulk-action-form')).toBeNull();
    expect(bulkResultCounts(compiled)).toEqual(['1', '0', '0']);
  });

  it('clears bulk feedback when applying filters', () => {
    seedCurrentUser(ownerMember);
    const fixture = TestBed.createComponent(WorkItemListPageComponent);
    const http = TestBed.inject(HttpTestingController);
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
    fixture.detectChanges();
    flushProjectWorkPage(http, [workItem]);

    fixture.componentInstance.enterBulkEdit();
    fixture.componentInstance.toggleWorkItemSelection(workItem.id);
    fixture.componentInstance.bulkActionForm.patchValue({
      actionType: 'set_priority',
      priority: 'urgent'
    });
    fixture.componentInstance.applyBulkAction();
    http
      .expectOne(`/api/projects/${projectId}/work-items/bulk-update`)
      .flush(bulkSuccessResponse(workItem));
    http
      .expectOne((candidate) => candidate.url === `/api/projects/${projectId}/work-items`)
      .flush(projectWorkItemPage([workItem]));
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Bulk update complete');

    fixture.componentInstance.filterForm.controls.search.setValue('next search');
    fixture.componentInstance.applyFilters();
    fixture.detectChanges();

    expect(fixture.componentInstance.selectedWorkItemIds()).toEqual([]);
    expect(fixture.componentInstance.bulkActionResult()).toBeNull();
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain(
      'Bulk update complete'
    );
  });

  it('keeps failed bulk rows selected and reports failed rows after reload', () => {
    seedCurrentUser(ownerMember);
    const fixture = TestBed.createComponent(WorkItemListPageComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    flushProjectWorkPage(http, [workItem, readyWorkItem]);

    fixture.componentInstance.enterBulkEdit();
    fixture.componentInstance.toggleAllVisibleSelection();
    fixture.componentInstance.bulkActionForm.patchValue({
      actionType: 'set_priority',
      priority: 'urgent'
    });
    fixture.componentInstance.applyBulkAction();

    const request = http.expectOne(`/api/projects/${projectId}/work-items/bulk-update`);
    request.flush({
      requestedCount: 2,
      succeededCount: 1,
      unchangedCount: 0,
      failedCount: 1,
      results: [
        {
          workItemId: workItem.id,
          displayKey: workItem.displayKey,
          status: 'updated',
          workItem,
          error: null
        },
        {
          workItemId: readyWorkItem.id,
          displayKey: readyWorkItem.displayKey,
          status: 'failed',
          workItem: null,
          error: {
            code: 'WORKFLOW_TRANSITION_ERROR',
            message: 'WT-4 cannot be updated while blocked by workflow policy.'
          }
        }
      ]
    });
    http
      .expectOne((candidate) => candidate.url === `/api/projects/${projectId}/work-items`)
      .flush(projectWorkItemPage([workItem, readyWorkItem]));
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(fixture.componentInstance.selectedWorkItemIds()).toEqual([readyWorkItem.id]);
    expect(bulkResultCounts(compiled)).toEqual(['1', '0', '1']);
    expect(compiled.textContent).toContain('Failed work items');
    expect(compiled.textContent).toContain(
      'WT-4 cannot be updated while blocked by workflow policy.'
    );
  });

  it('blocks paging during bulk apply and retains visible failures after stale-page recovery', () => {
    seedCurrentUser(ownerMember);
    projectRoute.setQuery({ page: '3', pageSize: '10' });
    const fixture = TestBed.createComponent(WorkItemListPageComponent);
    const http = TestBed.inject(HttpTestingController);
    const router = TestBed.inject(Router);
    const navigate = spyOn(router, 'navigate').and.resolveTo(true);
    fixture.detectChanges();
    flushProjectWorkContext(http);
    http
      .expectOne((candidate) => candidate.url === `/api/projects/${projectId}/work-items`)
      .flush(
        projectWorkItemPage([workItem, readyWorkItem], {
          page: 3,
          pageSize: 10,
          totalCount: 22,
          totalPages: 3,
          hasPreviousPage: true
        })
      );
    fixture.detectChanges();

    fixture.componentInstance.enterBulkEdit();
    fixture.componentInstance.toggleAllVisibleSelection();
    fixture.componentInstance.bulkActionForm.patchValue({
      actionType: 'set_priority',
      priority: 'urgent'
    });
    fixture.componentInstance.applyBulkAction();
    fixture.detectChanges();

    expect(
      Array.from(
        (fixture.nativeElement as HTMLElement).querySelectorAll<
          HTMLButtonElement | HTMLSelectElement
        >('app-work-item-pagination button, app-work-item-pagination select')
      ).every((control) => control.disabled)
    ).toBeTrue();
    fixture.componentInstance.goToPage(2);
    fixture.componentInstance.changePageSize(25);
    expect(navigate).not.toHaveBeenCalled();

    http.expectOne(`/api/projects/${projectId}/work-items/bulk-update`).flush({
      requestedCount: 2,
      succeededCount: 1,
      unchangedCount: 0,
      failedCount: 1,
      results: [
        {
          workItemId: workItem.id,
          displayKey: workItem.displayKey,
          status: 'updated',
          workItem,
          error: null
        },
        {
          workItemId: readyWorkItem.id,
          displayKey: readyWorkItem.displayKey,
          status: 'failed',
          workItem: null,
          error: {
            code: 'WORKFLOW_TRANSITION_ERROR',
            message: 'WT-4 remains blocked by workflow policy.'
          }
        }
      ]
    });
    http
      .expectOne((candidate) => {
        return (
          candidate.url === `/api/projects/${projectId}/work-items` &&
          candidate.params.get('page') === '3'
        );
      })
      .flush(
        projectWorkItemPage([readyWorkItem], {
          page: 2,
          pageSize: 10,
          totalCount: 11,
          totalPages: 2,
          hasPreviousPage: true
        })
      );

    expect(navigate).toHaveBeenCalledWith([], {
      relativeTo: TestBed.inject(ActivatedRoute),
      queryParams: jasmine.objectContaining({ page: '2', pageSize: '10' }),
      replaceUrl: true
    });

    projectRoute.setQuery({ page: '2', pageSize: '10' });
    http
      .expectOne((candidate) => {
        return (
          candidate.url === `/api/projects/${projectId}/work-items` &&
          candidate.params.get('page') === '2'
        );
      })
      .flush(
        projectWorkItemPage([readyWorkItem], {
          page: 2,
          pageSize: 10,
          totalCount: 11,
          totalPages: 2,
          hasPreviousPage: true
        })
      );
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(fixture.componentInstance.selectedWorkItemIds()).toEqual([readyWorkItem.id]);
    expect(fixture.componentInstance.bulkActionForm.controls.actionType.value).toBe(
      'set_priority'
    );
    expect(bulkResultCounts(compiled)).toEqual(['1', '0', '1']);
    expect(compiled.textContent).toContain('WT-4 remains blocked by workflow policy.');
    expect(compiled.querySelector('.list-heading h2')?.textContent?.trim()).toBe(
      '11-11 of 11 work items'
    );
  });

  it('creates personal project saved views from the applied query and opens canonical params', () => {
    const fixture = TestBed.createComponent(WorkItemListPageComponent);
    const http = TestBed.inject(HttpTestingController);
    const router = TestBed.inject(Router);
    const navigate = spyOn(router, 'navigate').and.resolveTo(true);
    fixture.detectChanges();

    http.expectOne(`/api/projects/${projectId}`).flush(activeProject);
    http
      .expectOne(`/api/projects/${projectId}/milestones?includeArchived=true`)
      .flush([activeMilestone]);
    flushProjectSavedViews(http, [personalProjectSavedView, sharedProjectSavedView]);
    http
      .expectOne((candidate) => candidate.url === `/api/projects/${projectId}/work-items`)
      .flush(projectWorkItemPage([workItem]));
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(
      [...compiled.querySelectorAll<HTMLOptGroupElement>('.saved-view-manage optgroup')].map(
        (group) => group.label
      )
    ).toEqual(['Shared project views', 'Personal project views']);
    expect(compiled.textContent).toContain('Ready for QA');
    expect(compiled.textContent).toContain('My project work');

    fixture.componentInstance.savePersonalProjectView('  My filtered work  ');
    const create = http.expectOne('/api/saved-work-views');
    expect(create.request.method).toBe('POST');
    expect(create.request.body).toEqual({
      name: 'My filtered work',
      scope: 'project',
      projectId,
      query: {
        search: 'api',
        status: 'in_progress',
        assigneeId: contributorId,
        reporterId: contributorId,
        milestoneId: activeMilestone.id,
        dueDateState: 'due_soon',
        dependency: 'dependency_blocked',
        sort: 'due_date_asc'
      }
    });
    create.flush({
      ...personalProjectSavedView,
      id: '10000000-0000-4000-8000-000000000803',
      name: 'My filtered work'
    });

    openSavedViewFromToolbar(fixture, sharedProjectSavedView.id);
    expect(navigate).toHaveBeenCalledWith([], {
      relativeTo: TestBed.inject(ActivatedRoute),
      queryParams: jasmine.objectContaining({
        status: 'ready',
        sort: 'board_order'
      })
    });
    expect(compiled.textContent).toContain('Opened "Ready for QA". Results updated below.');
  });

  it('lets owners create and manage shared project saved views', () => {
    seedCurrentUser(ownerMember);
    const fixture = TestBed.createComponent(WorkItemListPageComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    http.expectOne(`/api/projects/${projectId}`).flush(activeProject);
    http
      .expectOne(`/api/projects/${projectId}/milestones?includeArchived=true`)
      .flush([activeMilestone]);
    flushProjectSavedViews(http, [sharedProjectSavedView]);
    http
      .expectOne((candidate) => candidate.url === `/api/projects/${projectId}/work-items`)
      .flush(projectWorkItemPage([workItem]));
    fixture.detectChanges();

    fixture.componentInstance.saveSharedProjectView('Shared filtered work');
    const create = http.expectOne('/api/saved-work-views');
    expect(create.request.method).toBe('POST');
    expect(create.request.body).toEqual({
      name: 'Shared filtered work',
      scope: 'project',
      projectId,
      visibility: 'workspace',
      query: {
        search: 'api',
        status: 'in_progress',
        assigneeId: contributorId,
        reporterId: contributorId,
        milestoneId: activeMilestone.id,
        dueDateState: 'due_soon',
        dependency: 'dependency_blocked',
        sort: 'due_date_asc'
      }
    });
    create.flush({
      ...sharedProjectSavedView,
      id: '10000000-0000-4000-8000-000000000804',
      name: 'Shared filtered work'
    });

    fixture.componentInstance.setSavedViewDraftName(sharedProjectSavedView.id, 'Ready for review');
    fixture.componentInstance.renameSavedView(sharedProjectSavedView);
    const rename = http.expectOne(`/api/saved-work-views/${sharedProjectSavedView.id}`);
    expect(rename.request.method).toBe('PATCH');
    expect(rename.request.body).toEqual({ name: 'Ready for review' });
    rename.flush({ ...sharedProjectSavedView, name: 'Ready for review' });

    fixture.componentInstance.updateSavedViewQuery(sharedProjectSavedView);
    const updateQuery = http.expectOne(`/api/saved-work-views/${sharedProjectSavedView.id}`);
    expect(updateQuery.request.method).toBe('PATCH');
    expect(updateQuery.request.body).toEqual({
      query: {
        search: 'api',
        status: 'in_progress',
        assigneeId: contributorId,
        reporterId: contributorId,
        milestoneId: activeMilestone.id,
        dueDateState: 'due_soon',
        dependency: 'dependency_blocked',
        sort: 'due_date_asc'
      }
    });
    updateQuery.flush(sharedProjectSavedView);

    fixture.componentInstance.setSavedViewPinned(sharedProjectSavedView, true);
    const pin = http.expectOne(`/api/saved-work-views/${sharedProjectSavedView.id}`);
    expect(pin.request.method).toBe('PATCH');
    expect(pin.request.body).toEqual({ isPinned: true });
    const pinnedView: SavedWorkViewDto = { ...sharedProjectSavedView, isPinned: true };
    pin.flush(pinnedView);
    expect(fixture.componentInstance.pinnedSharedSavedViews().map((view) => view.id)).toEqual([
      sharedProjectSavedView.id
    ]);

    fixture.componentInstance.setSavedViewPinned(pinnedView, false);
    const unpin = http.expectOne(`/api/saved-work-views/${sharedProjectSavedView.id}`);
    expect(unpin.request.method).toBe('PATCH');
    expect(unpin.request.body).toEqual({ isPinned: false });
    unpin.flush({ ...pinnedView, isPinned: false });
    expect(fixture.componentInstance.pinnedSharedSavedViews()).toEqual([]);

    fixture.componentInstance.deleteSavedView(sharedProjectSavedView);
    const remove = http.expectOne(`/api/saved-work-views/${sharedProjectSavedView.id}`);
    expect(remove.request.method).toBe('DELETE');
    remove.flush(null);
  });

  it('keeps shared project saved views read-only for contributors', () => {
    const fixture = TestBed.createComponent(WorkItemListPageComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    http.expectOne(`/api/projects/${projectId}`).flush(activeProject);
    http
      .expectOne(`/api/projects/${projectId}/milestones?includeArchived=true`)
      .flush([activeMilestone]);
    flushProjectSavedViews(http, [sharedProjectSavedView, personalProjectSavedView]);
    http
      .expectOne((candidate) => candidate.url === `/api/projects/${projectId}/work-items`)
      .flush(projectWorkItemPage([workItem]));
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Owners and maintainers manage shared project views.');
    expect(compiled.textContent).not.toContain('Save shared view');

    fixture.componentInstance.renameSavedView(sharedProjectSavedView);
    fixture.componentInstance.setSavedViewPinned(sharedProjectSavedView, true);
    fixture.detectChanges();
    expect(compiled.textContent).toContain(
      'Only owners and maintainers can manage shared saved views.'
    );
    http.expectNone(`/api/saved-work-views/${sharedProjectSavedView.id}`);

    fixture.componentInstance.setSavedViewDraftName(personalProjectSavedView.id, 'My renamed work');
    fixture.componentInstance.renameSavedView(personalProjectSavedView);
    const renamePersonal = http.expectOne(`/api/saved-work-views/${personalProjectSavedView.id}`);
    expect(renamePersonal.request.method).toBe('PATCH');
    expect(renamePersonal.request.body).toEqual({ name: 'My renamed work' });
    renamePersonal.flush({ ...personalProjectSavedView, name: 'My renamed work' });
  });

  it('renders pinned project shortcuts and opens them through canonical query params', () => {
    const fixture = TestBed.createComponent(WorkItemListPageComponent);
    const http = TestBed.inject(HttpTestingController);
    const router = TestBed.inject(Router);
    const navigate = spyOn(router, 'navigate').and.resolveTo(true);
    fixture.detectChanges();

    http.expectOne(`/api/projects/${projectId}`).flush(activeProject);
    http
      .expectOne(`/api/projects/${projectId}/milestones?includeArchived=true`)
      .flush([activeMilestone]);
    flushProjectSavedViews(http, [
      pinnedSharedProjectSavedView,
      pinnedPersonalProjectSavedView,
      sharedProjectSavedView,
      personalProjectSavedView
    ]);
    http
      .expectOne((candidate) => candidate.url === `/api/projects/${projectId}/work-items`)
      .flush(projectWorkItemPage([workItem]));
    fixture.detectChanges();

    expect(fixture.componentInstance.pinnedSharedSavedViews().map((view) => view.id)).toEqual([
      pinnedSharedProjectSavedView.id
    ]);
    expect(fixture.componentInstance.pinnedPersonalSavedViews().map((view) => view.id)).toEqual([
      pinnedPersonalProjectSavedView.id
    ]);

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Project pinned views');
    expect(compiled.textContent).toContain('Pinned ready for QA');
    expect(compiled.textContent).toContain('Pinned personal project work');
    expect(compiled.textContent).toContain('1 shared · 1 personal');

    compiled
      .querySelector<HTMLButtonElement>(
        'button[aria-label="Open pinned shared view Pinned ready for QA"]'
      )
      ?.click();

    expect(navigate).toHaveBeenCalledWith([], {
      relativeTo: TestBed.inject(ActivatedRoute),
      queryParams: jasmine.objectContaining({
        status: 'ready',
        sort: 'board_order'
      })
    });
  });

  it('shows project pin mutation errors without corrupting saved-view state', () => {
    seedCurrentUser(ownerMember);
    const fixture = TestBed.createComponent(WorkItemListPageComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    http.expectOne(`/api/projects/${projectId}`).flush(activeProject);
    http
      .expectOne(`/api/projects/${projectId}/milestones?includeArchived=true`)
      .flush([activeMilestone]);
    flushProjectSavedViews(http, [sharedProjectSavedView]);
    http
      .expectOne((candidate) => candidate.url === `/api/projects/${projectId}/work-items`)
      .flush(projectWorkItemPage([workItem]));
    fixture.detectChanges();

    fixture.componentInstance.setSavedViewPinned(sharedProjectSavedView, true);
    const pin = http.expectOne(`/api/saved-work-views/${sharedProjectSavedView.id}`);
    pin.flush(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Project pin update failed.'
        }
      },
      { status: 500, statusText: 'Server Error' }
    );
    fixture.detectChanges();

    expect(fixture.componentInstance.pinnedSharedSavedViews()).toEqual([]);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Project pin update failed.'
    );
  });

  it('renders archived project saved views as open-only and blocks mutations', () => {
    const fixture = TestBed.createComponent(WorkItemListPageComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    http.expectOne(`/api/projects/${projectId}`).flush(archivedProject);
    http
      .expectOne(`/api/projects/${projectId}/milestones?includeArchived=true`)
      .flush([activeMilestone]);
    flushProjectSavedViews(http, [pinnedSharedProjectSavedView, pinnedPersonalProjectSavedView]);
    http
      .expectOne((candidate) => candidate.url === `/api/projects/${projectId}/work-items`)
      .flush(projectWorkItemPage([workItem]));
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Project pinned views');
    expect(compiled.textContent).toContain('Pinned ready for QA');
    expect(compiled.textContent).toContain('Pinned personal project work');
    expect(compiled.textContent).toContain('Archived project saved views are read-only.');
    expect(compiled.textContent).not.toContain('Save personal view');
    expect(compiled.textContent).not.toContain('Save shared view');
    expect(compiled.textContent).not.toContain('Manage saved views');

    compiled.querySelector<HTMLDetailsElement>('.saved-view-manager')?.setAttribute('open', '');
    fixture.detectChanges();
    const manageSelect = compiled.querySelector<HTMLSelectElement>('.saved-view-manage select');
    manageSelect!.value = pinnedSharedProjectSavedView.id;
    manageSelect!.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(
      [
        ...compiled.querySelectorAll<HTMLButtonElement>('.saved-view-management-actions button')
      ].map((button) => button.textContent?.trim())
    ).toEqual(['Open']);
    expect(compiled.textContent).toContain('This saved view is read-only for your current role.');

    fixture.componentInstance.savePersonalProjectView('Archived view');
    fixture.componentInstance.renameSavedView(pinnedPersonalProjectSavedView);
    fixture.componentInstance.setSavedViewPinned(pinnedPersonalProjectSavedView, false);
    fixture.detectChanges();

    expect(compiled.textContent).toContain('Archived projects are read-only.');
    http.expectNone('/api/saved-work-views');
    http.expectNone(`/api/saved-work-views/${pinnedPersonalProjectSavedView.id}`);
  });

  it('exports CSV with applied filters instead of pending draft form values', () => {
    spyOnCsvDownload();
    const fixture = TestBed.createComponent(WorkItemListPageComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    http.expectOne(`/api/projects/${projectId}`).flush(activeProject);
    http
      .expectOne(`/api/projects/${projectId}/milestones?includeArchived=true`)
      .flush([activeMilestone]);
    flushProjectSavedViews(http);
    http
      .expectOne((candidate) => candidate.url === `/api/projects/${projectId}/work-items`)
      .flush(projectWorkItemPage([workItem]));
    fixture.componentInstance.filterForm.patchValue(
      {
        search: 'draft search',
        priority: 'urgent'
      },
      { emitEvent: false }
    );
    fixture.detectChanges();

    fixture.componentInstance.exportCsv();
    const exportRequest = http.expectOne((candidate) => {
      return (
        candidate.url === `/api/projects/${projectId}/work-items/export` &&
        candidate.params.get('search') === 'api' &&
        candidate.params.get('status') === 'in_progress' &&
        candidate.params.get('assigneeId') === contributorId &&
        candidate.params.get('dependency') === 'dependency_blocked' &&
        candidate.params.get('priority') === null &&
        candidate.params.get('sort') === 'due_date_asc'
      );
    });
    expect(exportRequest.request.method).toBe('GET');
    exportRequest.flush(
      new Blob(['displayKey,title\nWT-3,Implement work item API client\n'], {
        type: 'text/csv'
      }),
      {
        headers: {
          'Content-Disposition': 'attachment; filename="project-work-items.csv"'
        }
      }
    );

    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:worktrail-export');
    expect(fixture.componentInstance.isExporting()).toBeFalse();
  });

  it('shows project export failures inline', () => {
    const fixture = TestBed.createComponent(WorkItemListPageComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    http.expectOne(`/api/projects/${projectId}`).flush(activeProject);
    http
      .expectOne(`/api/projects/${projectId}/milestones?includeArchived=true`)
      .flush([activeMilestone]);
    flushProjectSavedViews(http);
    http
      .expectOne((candidate) => candidate.url === `/api/projects/${projectId}/work-items`)
      .flush(projectWorkItemPage([workItem]));

    fixture.componentInstance.exportCsv();
    http
      .expectOne((candidate) => candidate.url === `/api/projects/${projectId}/work-items/export`)
      .flush(new Blob(['Export is temporarily unavailable.'], { type: 'text/plain' }), {
        status: 500,
        statusText: 'Server Error'
      });
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'CSV export could not be downloaded.'
    );
    expect(fixture.componentInstance.isExporting()).toBeFalse();
  });

  it('shows the project export limit message from a structured error blob', async () => {
    const fixture = TestBed.createComponent(WorkItemListPageComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    http.expectOne(`/api/projects/${projectId}`).flush(activeProject);
    http
      .expectOne(`/api/projects/${projectId}/milestones?includeArchived=true`)
      .flush([activeMilestone]);
    flushProjectSavedViews(http);
    http
      .expectOne((candidate) => candidate.url === `/api/projects/${projectId}/work-items`)
      .flush(projectWorkItemPage([workItem]));

    fixture.componentInstance.exportCsv();
    http
      .expectOne((candidate) => candidate.url === `/api/projects/${projectId}/work-items/export`)
      .flush(
        new Blob(
          [
            JSON.stringify({
              error: {
                code: 'EXPORT_LIMIT_EXCEEDED',
                message: 'More than 10,000 work items match. Narrow the applied filters and retry.'
              }
            })
          ],
          { type: 'application/json' }
        ),
        { status: 422, statusText: 'Unprocessable Entity' }
      );
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 50));
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'More than 10,000 work items match. Narrow the applied filters and retry.'
    );
    expect(fixture.componentInstance.isExporting()).toBeFalse();
  });

  it('copies the applied project filtered view link', fakeAsync(() => {
    const fixture = TestBed.createComponent(WorkItemListPageComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    http.expectOne(`/api/projects/${projectId}`).flush(activeProject);
    http
      .expectOne(`/api/projects/${projectId}/milestones?includeArchived=true`)
      .flush([activeMilestone]);
    flushProjectSavedViews(http);
    http
      .expectOne((candidate) => candidate.url === `/api/projects/${projectId}/work-items`)
      .flush(projectWorkItemPage([workItem]));
    projectRoute.setQuery({
      status: 'in_progress',
      assigneeId: contributorId,
      reporterId: contributorId,
      milestoneId: activeMilestone.id,
      dueDateState: 'due_soon',
      dependency: 'dependency_blocked',
      search: 'api',
      sort: 'due_date_asc',
      page: '3',
      pageSize: '10'
    });
    http
      .expectOne((candidate) => {
        return (
          candidate.url === `/api/projects/${projectId}/work-items` &&
          candidate.params.get('page') === '3' &&
          candidate.params.get('pageSize') === '10'
        );
      })
      .flush(
        projectWorkItemPage([workItem], {
          page: 3,
          pageSize: 10,
          totalCount: 21,
          totalPages: 3,
          hasPreviousPage: true
        })
      );
    fixture.componentInstance.filterForm.patchValue(
      {
        search: 'draft search',
        priority: 'urgent'
      },
      { emitEvent: false }
    );
    fixture.detectChanges();

    fixture.componentInstance.copyViewLink();
    flushMicrotasks();
    fixture.detectChanges();

    const copiedUrl = new URL(clipboard.copyText.calls.mostRecent().args[0]);
    expect(copiedUrl.pathname).toBe(`/projects/${projectId}/work-items`);
    expect(copiedUrl.searchParams.get('search')).toBe('api');
    expect(copiedUrl.searchParams.get('status')).toBe('in_progress');
    expect(copiedUrl.searchParams.get('assigneeId')).toBe(contributorId);
    expect(copiedUrl.searchParams.get('dependency')).toBe('dependency_blocked');
    expect(copiedUrl.searchParams.get('sort')).toBe('due_date_asc');
    expect(copiedUrl.searchParams.get('page')).toBe('3');
    expect(copiedUrl.searchParams.get('pageSize')).toBe('10');
    expect(copiedUrl.searchParams.get('priority')).toBeNull();
    expect(fixture.componentInstance.detailReturnUrl()).toContain('page=3');
    expect(fixture.componentInstance.detailReturnUrl()).toContain('pageSize=10');
    expect(
      (fixture.nativeElement as HTMLElement)
        .querySelector<HTMLAnchorElement>('.work-item-title-link')
        ?.getAttribute('href')
    ).toContain('returnUrl=');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Link copied');

    tick(2500);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('Link copied');
  }));

  it('shows copy link failures inline', fakeAsync(() => {
    clipboard.copyText.and.rejectWith(new Error('denied'));
    const fixture = TestBed.createComponent(WorkItemListPageComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    http.expectOne(`/api/projects/${projectId}`).flush(activeProject);
    http
      .expectOne(`/api/projects/${projectId}/milestones?includeArchived=true`)
      .flush([activeMilestone]);
    flushProjectSavedViews(http);
    http
      .expectOne((candidate) => candidate.url === `/api/projects/${projectId}/work-items`)
      .flush(projectWorkItemPage([workItem]));
    fixture.detectChanges();

    fixture.componentInstance.copyViewLink();
    flushMicrotasks();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Link could not be copied'
    );

    tick(2500);
  }));

  it('resolves inactive member names from filter state without making them default choices', () => {
    const fixture = TestBed.createComponent(WorkItemListPageComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne(`/api/projects/${projectId}`).flush(activeProject);
    http
      .expectOne(`/api/projects/${projectId}/milestones?includeArchived=true`)
      .flush([activeMilestone]);
    flushProjectSavedViews(http);
    http
      .expectOne((candidate) => candidate.url === `/api/projects/${projectId}/work-items`)
      .flush(
        projectWorkItemPage([
          {
            ...workItem,
            assignee: inactiveMember
          }
        ])
      );
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
    http
      .expectOne(`/api/projects/${projectId}/milestones?includeArchived=true`)
      .flush([activeMilestone]);
    flushProjectSavedViews(http);
    http
      .expectOne((candidate) => candidate.url === `/api/projects/${projectId}/work-items`)
      .flush(projectWorkItemPage([]));

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
      dependency: 'blocking_open_work',
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
        cycleId: null,
        priority: 'high',
        dueDateState: 'overdue',
        dependency: 'blocking_open_work',
        workRisk: null,
        hierarchy: null,
        parentKey: null,
        sort: 'created_desc',
        page: null,
        pageSize: null
      }
    });
  });

  it('preserves hidden work risk filters through visible filter changes and chip removal', () => {
    const fixture = TestBed.createComponent(WorkItemListPageComponent);
    const http = TestBed.inject(HttpTestingController);
    const router = TestBed.inject(Router);
    const navigate = spyOn(router, 'navigate').and.resolveTo(true);
    fixture.detectChanges();

    http.expectOne(`/api/projects/${projectId}`).flush(activeProject);
    http
      .expectOne(`/api/projects/${projectId}/milestones?includeArchived=true`)
      .flush([activeMilestone]);
    flushProjectSavedViews(http);
    http
      .expectOne((candidate) => candidate.url === `/api/projects/${projectId}/work-items`)
      .flush(projectWorkItemPage([workItem]));

    fixture.componentInstance.appliedFilterValues.set({
      ...fixture.componentInstance.appliedFilterValues(),
      workRisk: 'stale_in_progress'
    });
    fixture.componentInstance.filterForm.patchValue(
      {
        ...fixture.componentInstance.filterForm.getRawValue(),
        workRisk: 'stale_in_progress'
      },
      { emitEvent: false }
    );
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Risk: Stale in progress');

    fixture.componentInstance.filterForm.controls.priority.setValue('urgent');

    expect(navigate).toHaveBeenCalledWith([], {
      relativeTo: TestBed.inject(ActivatedRoute),
      queryParams: jasmine.objectContaining({
        priority: 'urgent',
        workRisk: 'stale_in_progress'
      })
    });

    fixture.componentInstance.removeActiveFilter('Risk: Stale in progress');

    expect(navigate).toHaveBeenCalledWith([], {
      relativeTo: TestBed.inject(ActivatedRoute),
      queryParams: jasmine.objectContaining({
        workRisk: null
      })
    });
  });

  it('preserves hidden parent state until a visible work-breakdown filter replaces it', () => {
    const fixture = TestBed.createComponent(WorkItemListPageComponent);
    const http = TestBed.inject(HttpTestingController);
    const router = TestBed.inject(Router);
    const navigate = spyOn(router, 'navigate').and.resolveTo(true);
    fixture.detectChanges();

    http.expectOne(`/api/projects/${projectId}`).flush(activeProject);
    http
      .expectOne(`/api/projects/${projectId}/milestones?includeArchived=true`)
      .flush([activeMilestone]);
    flushProjectSavedViews(http);
    http
      .expectOne((candidate) => candidate.url === `/api/projects/${projectId}/work-items`)
      .flush(projectWorkItemPage([workItem]));

    fixture.componentInstance.appliedFilterValues.set({
      ...fixture.componentInstance.appliedFilterValues(),
      parentKey: 'WT-42'
    });
    fixture.componentInstance.filterForm.patchValue({ parentKey: 'WT-42' }, { emitEvent: false });
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Parent: WT-42');

    fixture.componentInstance.filterForm.controls.priority.setValue('urgent');
    expect(navigate.calls.mostRecent().args[1]?.queryParams).toEqual(
      jasmine.objectContaining({ priority: 'urgent', parentKey: 'WT-42', hierarchy: null })
    );

    fixture.componentInstance.filterForm.controls.hierarchy.setValue('parents');
    expect(navigate.calls.mostRecent().args[1]?.queryParams).toEqual(
      jasmine.objectContaining({ hierarchy: 'parents', parentKey: null })
    );
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Parent: WT-42');
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain(
      'Work breakdown: Parents with children'
    );
  });

  it('uses hidden work risk filters for project export and copied links', fakeAsync(() => {
    spyOnCsvDownload();
    const fixture = TestBed.createComponent(WorkItemListPageComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    http.expectOne(`/api/projects/${projectId}`).flush(activeProject);
    http
      .expectOne(`/api/projects/${projectId}/milestones?includeArchived=true`)
      .flush([activeMilestone]);
    flushProjectSavedViews(http);
    http
      .expectOne((candidate) => candidate.url === `/api/projects/${projectId}/work-items`)
      .flush(projectWorkItemPage([workItem]));

    fixture.componentInstance.appliedFilterValues.set({
      ...fixture.componentInstance.appliedFilterValues(),
      workRisk: 'unassigned_active'
    });
    fixture.detectChanges();

    fixture.componentInstance.exportCsv();
    const exportRequest = http.expectOne((candidate) => {
      return (
        candidate.url === `/api/projects/${projectId}/work-items/export` &&
        candidate.params.get('workRisk') === 'unassigned_active' &&
        candidate.params.get('status') === 'in_progress'
      );
    });
    expect(exportRequest.request.method).toBe('GET');
    exportRequest.flush(
      new Blob(['displayKey,title\nWT-3,Implement work item API client\n'], {
        type: 'text/csv'
      })
    );

    fixture.componentInstance.copyViewLink();
    flushMicrotasks();

    const copiedUrl = new URL(clipboard.copyText.calls.mostRecent().args[0]);
    expect(copiedUrl.searchParams.get('workRisk')).toBe('unassigned_active');

    tick(2500);
  }));

  it('does not show active filter pills for unapplied pending form values', () => {
    const fixture = TestBed.createComponent(WorkItemListPageComponent);
    const http = TestBed.inject(HttpTestingController);
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
    fixture.detectChanges();

    http.expectOne(`/api/projects/${projectId}`).flush(activeProject);
    http
      .expectOne(`/api/projects/${projectId}/milestones?includeArchived=true`)
      .flush([activeMilestone]);
    flushProjectSavedViews(http);
    http
      .expectOne((candidate) => candidate.url === `/api/projects/${projectId}/work-items`)
      .flush(projectWorkItemPage([workItem]));
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
    http
      .expectOne(`/api/projects/${projectId}/milestones?includeArchived=true`)
      .flush([activeMilestone]);
    flushProjectSavedViews(http);
    http
      .expectOne((candidate) => candidate.url === `/api/projects/${projectId}/work-items`)
      .flush(projectWorkItemPage([workItem]));

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
    http
      .expectOne(`/api/projects/${projectId}/milestones?includeArchived=true`)
      .flush([activeMilestone]);
    flushProjectSavedViews(http);
    http
      .expectOne((candidate) => candidate.url === `/api/projects/${projectId}/work-items`)
      .flush(projectWorkItemPage([workItem]));

    fixture.componentInstance.filterForm.controls.search.setValue('client query');
    tick(399);
    expect(navigate).not.toHaveBeenCalledWith(
      [],
      jasmine.objectContaining({
        queryParams: jasmine.objectContaining({ search: 'client query' })
      })
    );

    tick(1);
    expect(navigate).toHaveBeenCalledWith([], {
      relativeTo: TestBed.inject(ActivatedRoute),
      queryParams: jasmine.objectContaining({
        search: 'client query'
      })
    });
  }));
});

describe('WorkItemImportPageComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WorkItemImportPageComponent],
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
    const http = TestBed.inject(HttpTestingController);
    flushPendingCycleRequests(http);
    http.verify();
  });

  it('loads project context and starts with apply disabled', () => {
    const fixture = TestBed.createComponent(WorkItemImportPageComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    http.expectOne(`/api/projects/${projectId}`).flush(activeProject);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Import work items');
    expect(compiled.textContent).toContain('CSV file');
    expect(compiled.querySelector('button')?.hasAttribute('disabled')).toBeTrue();
  });

  it('previews a selected CSV file and enables apply when valid', async () => {
    const fixture = TestBed.createComponent(WorkItemImportPageComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    http.expectOne(`/api/projects/${projectId}`).flush(activeProject);
    await fixture.componentInstance.previewFile(
      new File(['title,type,priority\nImported task,task,medium\n'], 'import.csv', {
        type: 'text/csv'
      })
    );

    const preview = http.expectOne(`/api/projects/${projectId}/work-items/imports/preview`);
    expect(preview.request.method).toBe('POST');
    expect(preview.request.body).toEqual({
      csv: 'title,type,priority\nImported task,task,medium\n'
    });
    preview.flush({
      totalRows: 1,
      validRows: 1,
      invalidRows: 0,
      errors: [],
      warnings: [],
      rows: [
        {
          rowNumber: 2,
          title: 'Imported task',
          type: 'task',
          status: 'backlog',
          priority: 'medium',
          assigneeEmail: null,
          reporterEmail: member.email,
          labelNames: [],
          milestoneName: null,
          dueDate: null,
          estimatePoints: null
        }
      ]
    });
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('import.csv');
    expect(compiled.textContent).toContain('Valid rows');
    expect(compiled.textContent).toContain('Imported task');
    expect(fixture.componentInstance.canApply()).toBeTrue();
    expect(compiled.querySelector('button')?.hasAttribute('disabled')).toBeFalse();
  });

  it('renders validation errors and keeps apply disabled', async () => {
    const fixture = TestBed.createComponent(WorkItemImportPageComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    http.expectOne(`/api/projects/${projectId}`).flush(activeProject);
    await fixture.componentInstance.previewFile(
      new File(['title,type,priority\n,feature,extreme\n'], 'invalid.csv', {
        type: 'text/csv'
      })
    );

    http.expectOne(`/api/projects/${projectId}/work-items/imports/preview`).flush({
      totalRows: 1,
      validRows: 0,
      invalidRows: 1,
      warnings: [],
      rows: [],
      errors: [
        {
          rowNumber: 2,
          field: 'title',
          message: 'CSV field "title" is required.'
        }
      ]
    });
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Errors');
    expect(compiled.textContent).toContain('CSV field "title" is required.');
    expect(fixture.componentInstance.canApply()).toBeFalse();
    expect(compiled.querySelector('button')?.hasAttribute('disabled')).toBeTrue();
  });

  it('applies a valid preview and renders created item links', async () => {
    const fixture = TestBed.createComponent(WorkItemImportPageComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    http.expectOne(`/api/projects/${projectId}`).flush(activeProject);
    await fixture.componentInstance.previewFile(
      new File(['title,type,priority\nImported task,task,medium\n'], 'import.csv', {
        type: 'text/csv'
      })
    );
    http.expectOne(`/api/projects/${projectId}/work-items/imports/preview`).flush({
      totalRows: 1,
      validRows: 1,
      invalidRows: 0,
      errors: [],
      warnings: [],
      rows: [
        {
          rowNumber: 2,
          title: 'Imported task',
          type: 'task',
          status: 'backlog',
          priority: 'medium',
          assigneeEmail: null,
          reporterEmail: member.email,
          labelNames: [],
          milestoneName: null,
          dueDate: null,
          estimatePoints: null
        }
      ]
    });

    fixture.componentInstance.applyImport();
    const apply = http.expectOne(`/api/projects/${projectId}/work-items/imports`);
    expect(apply.request.method).toBe('POST');
    expect(apply.request.body).toEqual({
      csv: 'title,type,priority\nImported task,task,medium\n'
    });
    apply.flush({
      createdCount: 1,
      workItems: [
        {
          ...workItem,
          id: '10000000-0000-4000-8000-000000000490',
          displayKey: 'WT-490',
          title: 'Imported task'
        }
      ]
    });
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('1 work items imported');
    expect(
      compiled.querySelector<HTMLAnchorElement>(
        'a[href="/work-items/10000000-0000-4000-8000-000000000490"]'
      )
    ).not.toBeNull();
    expect(
      compiled.querySelector<HTMLAnchorElement>(`a[href="/projects/${projectId}/work-items"]`)
    ).not.toBeNull();
    expect(
      compiled.querySelector<HTMLAnchorElement>(`a[href="/projects/${projectId}/board"]`)
    ).not.toBeNull();
  });

  it('shows archived project state and blocks preview/apply', async () => {
    const fixture = TestBed.createComponent(WorkItemImportPageComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    http.expectOne(`/api/projects/${projectId}`).flush(archivedProject);
    fixture.detectChanges();

    await fixture.componentInstance.previewFile(
      new File(['title,type,priority\nArchived task,task,medium\n'], 'archived.csv', {
        type: 'text/csv'
      })
    );
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Archived project');
    expect(fixture.componentInstance.canApply()).toBeFalse();
    expect(compiled.querySelector<HTMLInputElement>('input[type="file"]')?.disabled).toBeTrue();
    http.expectNone(`/api/projects/${projectId}/work-items/imports/preview`);
  });
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
    const http = TestBed.inject(HttpTestingController);
    flushPendingCycleRequests(http);
    http.verify();
  });

  it('shows required title validation before posting', () => {
    const fixture = TestBed.createComponent(WorkItemCreatePageComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    flushCreateContext(http);

    fixture.componentInstance.createWorkItem();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Title is required.');
    http.expectNone((request) => request.method === 'POST');
  });

  it('creates a work item and renders success actions', () => {
    const fixture = TestBed.createComponent(WorkItemCreatePageComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    flushCreateContext(http, { labels: [backendLabel, archivedLabel] });
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('backend');
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('legacy');

    fixture.componentInstance.workItemForm.setValue({
      projectId,
      title: 'Create filtering UI',
      description: 'Build the Phase 10 list filters.',
      type: 'story',
      priority: 'urgent',
      assigneeId: contributorId,
      milestoneId: activeMilestone.id,
      cycleId: activeCycle.id,
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
      cycleId: activeCycle.id,
      dueDate: '2026-07-20',
      estimatePoints: 8
    });
    request.flush({
      ...workItem,
      id: '10000000-0000-4000-8000-000000000499',
      displayKey: 'WT-499',
      title: 'Create filtering UI',
      description: 'Build the Phase 10 list filters.',
      relationships: emptyRelationships,
      comments: [],
      activity: []
    } satisfies WorkItemDetailDto);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('WT-499 created');
    expect(
      compiled.querySelector<HTMLAnchorElement>(
        'a[href="/work-items/10000000-0000-4000-8000-000000000499"]'
      )
    ).not.toBeNull();
    expect(compiled.textContent).toContain('Create another');
  });

  it('excludes inactive members from the create assignee control', () => {
    const fixture = TestBed.createComponent(WorkItemCreatePageComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    flushCreateContext(http);
    fixture.detectChanges();

    const assigneeOptions = [
      ...fixture.nativeElement.querySelectorAll('select[formcontrolname="assigneeId"] option')
    ].map((option: HTMLOptionElement) => option.textContent?.trim());
    expect(assigneeOptions).toContain('Case Contributor');
    expect(assigneeOptions).not.toContain('Riley Former');
  });

  it('normalizes numeric estimate values before posting', () => {
    const fixture = TestBed.createComponent(WorkItemCreatePageComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    flushCreateContext(http, { milestones: [], labels: [] });

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
      relationships: emptyRelationships,
      comments: [],
      activity: []
    } satisfies WorkItemDetailDto);
  });

  it('shows archived project notice and prevents create requests', () => {
    const fixture = TestBed.createComponent(WorkItemCreatePageComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    flushCreateContext(http, { project: archivedProject });
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

describe('WorkItemCreatePageComponent global route', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WorkItemCreatePageComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: routeStub({}, '')
        }
      ]
    }).compileComponents();

    seedCurrentUser();
  });

  afterEach(() => {
    const http = TestBed.inject(HttpTestingController);
    flushPendingCycleRequests(http);
    http.verify();
  });

  it('loads active projects only and requires project selection', () => {
    const fixture = TestBed.createComponent(WorkItemCreatePageComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne('/api/workspace/capabilities').flush(ownerCapabilities);
    http.expectOne('/api/projects').flush([activeProject, archivedProject]);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const projectOptions = Array.from(
      compiled.querySelectorAll<HTMLSelectElement>('select[formcontrolname="projectId"] option')
    ).map((option) => option.textContent?.trim());
    expect(projectOptions).toContain('WT · Worktrail App');
    expect(projectOptions).not.toContain('LEG · Legacy Migration');

    fixture.componentInstance.workItemForm.patchValue({
      title: 'Unscoped create should validate'
    });
    fixture.componentInstance.createWorkItem();
    fixture.detectChanges();

    expect(compiled.textContent).toContain('Project is required.');
    expect(compiled.textContent).toContain('Select an active project before creating work.');
    http.expectNone((request) => request.method === 'POST');
  });

  it('loads project-dependent fields after selection and creates work', () => {
    const fixture = TestBed.createComponent(WorkItemCreatePageComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne('/api/workspace/capabilities').flush(ownerCapabilities);
    http.expectOne('/api/projects').flush([activeProject, archivedProject]);

    fixture.componentInstance.workItemForm.controls.projectId.setValue(projectId);
    http.expectOne(`/api/projects/${projectId}`).flush(activeProject);
    http.expectOne(`/api/projects/${projectId}/labels`).flush([backendLabel]);
    http.expectOne(`/api/projects/${projectId}/milestones`).flush([activeMilestone]);
    http.expectOne(`/api/projects/${projectId}/cycles`).flush([activeCycle]);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('backend');
    expect(compiled.textContent).toContain('v0.0.3');

    fixture.componentInstance.workItemForm.patchValue({
      title: 'Capture from workspace',
      description: 'Create without entering a project first.',
      type: 'task',
      priority: 'high',
      assigneeId: contributorId,
      milestoneId: activeMilestone.id,
      cycleId: activeCycle.id,
      dueDate: '2026-07-22',
      estimatePoints: '3'
    });
    fixture.componentInstance.toggleLabel(backendLabel.id, {
      target: { checked: true }
    } as unknown as Event);
    fixture.componentInstance.createWorkItem();

    const create = http.expectOne(`/api/projects/${projectId}/work-items`);
    expect(create.request.body).toEqual({
      title: 'Capture from workspace',
      description: 'Create without entering a project first.',
      type: 'task',
      priority: 'high',
      assigneeId: contributorId,
      labelIds: [backendLabel.id],
      milestoneId: activeMilestone.id,
      cycleId: activeCycle.id,
      dueDate: '2026-07-22',
      estimatePoints: 3
    });
    create.flush({
      ...workItem,
      id: '10000000-0000-4000-8000-000000000497',
      displayKey: 'WT-497',
      title: 'Capture from workspace',
      description: 'Create without entering a project first.',
      relationships: emptyRelationships,
      comments: [],
      activity: []
    } satisfies WorkItemDetailDto);
    fixture.detectChanges();

    expect(compiled.textContent).toContain('WT-497 created');
    expect(
      compiled.querySelector<HTMLAnchorElement>(
        'a[href="/work-items/10000000-0000-4000-8000-000000000497"]'
      )
    ).not.toBeNull();

    fixture.componentInstance.createAnother();
    fixture.detectChanges();
    expect(fixture.componentInstance.workItemForm.controls.projectId.value).toBe(projectId);
    expect(fixture.componentInstance.workItemForm.controls.title.value).toBe('');
    expect(fixture.componentInstance.selectedLabelIds()).toEqual([]);
  });

  it('preserves entered values when create fails', () => {
    const fixture = TestBed.createComponent(WorkItemCreatePageComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne('/api/workspace/capabilities').flush(ownerCapabilities);
    http.expectOne('/api/projects').flush([activeProject]);
    fixture.componentInstance.workItemForm.controls.projectId.setValue(projectId);
    http.expectOne(`/api/projects/${projectId}`).flush(activeProject);
    http.expectOne(`/api/projects/${projectId}/labels`).flush([]);
    http.expectOne(`/api/projects/${projectId}/milestones`).flush([]);

    fixture.componentInstance.workItemForm.patchValue({
      title: 'Keep this title',
      description: 'Keep this description.',
      type: 'bug',
      priority: 'urgent'
    });
    fixture.componentInstance.createWorkItem();
    const create = http.expectOne(`/api/projects/${projectId}/work-items`);
    create.flush(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Title must be unique within this project.'
        }
      },
      { status: 400, statusText: 'Bad Request' }
    );
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Title must be unique within this project.');
    expect(fixture.componentInstance.workItemForm.controls.title.value).toBe('Keep this title');
    expect(fixture.componentInstance.workItemForm.controls.description.value).toBe(
      'Keep this description.'
    );
  });

  it('shows create permission copy and disables submission', () => {
    const fixture = TestBed.createComponent(WorkItemCreatePageComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne('/api/workspace/capabilities').flush(readOnlyCapabilities);
    http.expectOne('/api/projects').flush([activeProject]);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Create unavailable');
    expect(compiled.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBeTrue();
  });
});

describe('WorkItemCreatePageComponent child route', () => {
  let childRoute: ReturnType<typeof routeStub>;

  const parentDetail: WorkItemDetailDto = {
    ...workItem,
    description: 'Coordinate the child work.',
    relationships: emptyRelationships,
    comments: [],
    activity: []
  };

  beforeEach(async () => {
    childRoute = routeStub({
      parentWorkItemId: workItemId,
      returnUrl: `/work-items/${workItemId}`
    });

    await TestBed.configureTestingModule({
      imports: [WorkItemCreatePageComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: childRoute
        }
      ]
    }).compileComponents();

    seedCurrentUser();
  });

  afterEach(() => {
    const http = TestBed.inject(HttpTestingController);
    flushPendingCycleRequests(http);
    http.verify();
  });

  it('validates route parent context and creates a child without inheriting planning fields', () => {
    const fixture = TestBed.createComponent(WorkItemCreatePageComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    flushCreateContext(http);
    http.expectOne(`/api/work-items/${workItemId}`).flush(parentDetail);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('WT-3 Implement work item API client');
    expect(compiled.textContent).toContain(
      'Milestone and cycle remain independent for this child.'
    );
    expect(fixture.componentInstance.workItemForm.controls.milestoneId.value).toBe('');
    expect(fixture.componentInstance.workItemForm.controls.cycleId.value).toBe('');

    fixture.componentInstance.workItemForm.patchValue({
      title: 'Implement child creation',
      description: 'Reuse the complete create form.',
      type: 'story',
      priority: 'high'
    });
    fixture.componentInstance.createWorkItem();
    const create = http.expectOne(`/api/projects/${projectId}/work-items`);
    expect(create.request.body).toEqual(
      jasmine.objectContaining({
        title: 'Implement child creation',
        milestoneId: null,
        cycleId: null,
        parentWorkItemId: workItemId
      })
    );
    create.flush({
      ...parentDetail,
      id: readyWorkItem.id,
      displayKey: readyWorkItem.displayKey,
      title: 'Implement child creation',
      parent: {
        id: parentDetail.id,
        projectId,
        displayKey: parentDetail.displayKey,
        title: parentDetail.title,
        type: parentDetail.type,
        status: parentDetail.status
      }
    });
    fixture.detectChanges();

    expect(compiled.textContent).toContain('WT-4 created');
    expect(compiled.textContent).toContain('Back to WT-3');
    expect(
      compiled.querySelector<HTMLAnchorElement>(`a[href="/work-items/${workItemId}"]`)
    ).not.toBeNull();
  });

  it('reloads changed parent route state without clearing entered form values', () => {
    const fixture = TestBed.createComponent(WorkItemCreatePageComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    flushCreateContext(http);
    http.expectOne(`/api/work-items/${workItemId}`).flush(parentDetail);
    fixture.componentInstance.workItemForm.patchValue({ title: 'Keep this child title' });

    childRoute.queryParamMap.next(
      convertToParamMap({
        parentWorkItemId: readyWorkItem.id,
        returnUrl: `/work-items/${readyWorkItem.id}`
      })
    );
    http.expectOne(`/api/work-items/${readyWorkItem.id}`).flush({
      ...parentDetail,
      id: readyWorkItem.id,
      itemNumber: readyWorkItem.itemNumber,
      displayKey: readyWorkItem.displayKey,
      title: readyWorkItem.title
    });
    fixture.detectChanges();

    expect(fixture.componentInstance.parentWorkItem()?.id).toBe(readyWorkItem.id);
    expect(fixture.componentInstance.workItemForm.controls.title.value).toBe(
      'Keep this child title'
    );
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'WT-4 Prepare bulk triage feedback'
    );
  });

  it('preserves the complete child form when parent validation conflicts at create time', () => {
    const fixture = TestBed.createComponent(WorkItemCreatePageComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    flushCreateContext(http);
    http.expectOne(`/api/work-items/${workItemId}`).flush(parentDetail);
    fixture.componentInstance.workItemForm.patchValue({
      title: 'Keep child draft',
      description: 'Keep every entered field.',
      type: 'bug',
      priority: 'urgent',
      estimatePoints: '5'
    });
    fixture.componentInstance.createWorkItem();
    http.expectOne(`/api/projects/${projectId}/work-items`).flush(
      {
        error: {
          code: 'CONFLICT',
          message: 'A child work item cannot contain child work.'
        }
      },
      { status: 409, statusText: 'Conflict' }
    );
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'A child work item cannot contain child work.'
    );
    expect(fixture.componentInstance.workItemForm.getRawValue()).toEqual(
      jasmine.objectContaining({
        title: 'Keep child draft',
        description: 'Keep every entered field.',
        type: 'bug',
        priority: 'urgent',
        estimatePoints: '5'
      })
    );
    expect(fixture.componentInstance.parentWorkItem()?.id).toBe(workItemId);
  });

  it('blocks submission for mismatched or unavailable parent context and preserves form state', () => {
    const fixture = TestBed.createComponent(WorkItemCreatePageComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    flushCreateContext(http);
    http.expectOne(`/api/work-items/${workItemId}`).flush({
      ...parentDetail,
      projectId: '10000000-0000-4000-8000-000000000299'
    });
    fixture.componentInstance.workItemForm.patchValue({ title: 'Do not lose this title' });
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Parent work must belong to this project.'
    );
    expect(fixture.componentInstance.isCreateDisabled()).toBeTrue();
    fixture.componentInstance.createWorkItem();
    http.expectNone(`/api/projects/${projectId}/work-items`);
    expect(fixture.componentInstance.workItemForm.controls.title.value).toBe(
      'Do not lose this title'
    );

    fixture.componentInstance.retryParentLoad();
    http
      .expectOne(`/api/work-items/${workItemId}`)
      .flush(
        { error: { code: 'NOT_FOUND', message: 'Parent work item not found.' } },
        { status: 404, statusText: 'Not Found' }
      );
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Parent work item not found.'
    );
    expect(fixture.componentInstance.workItemForm.controls.title.value).toBe(
      'Do not lose this title'
    );
  });
});
