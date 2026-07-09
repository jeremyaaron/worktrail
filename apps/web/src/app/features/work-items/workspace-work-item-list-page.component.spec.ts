import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed, fakeAsync, flushMicrotasks, tick } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import type {
  LabelDto,
  MemberDto,
  MilestoneDto,
  ProjectNavigationSummaryDto,
  SavedWorkViewDto,
  WorkspaceWorkItemListItemDto
} from '@worktrail/contracts';
import { BehaviorSubject } from 'rxjs';

import { CurrentUserService } from '../../core/current-user.service';
import { ClipboardService } from '../../shared/clipboard.service';
import { WorkspaceWorkItemListPageComponent } from './workspace-work-item-list-page.component';

const workspaceId = '10000000-0000-4000-8000-000000000001';
const projectId = '10000000-0000-4000-8000-000000000201';
const archivedProjectId = '10000000-0000-4000-8000-000000000202';
const workItemId = '10000000-0000-4000-8000-000000000401';

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

const designLabel: LabelDto = {
  id: '10000000-0000-4000-8000-000000000301',
  name: 'design',
  color: '#7c3aed',
  isArchived: false,
  archivedAt: null
};

const milestone: MilestoneDto = {
  id: '10000000-0000-4000-8000-000000000501',
  workspaceId,
  projectId,
  name: 'v0.0.5',
  description: 'Daily operating surface.',
  status: 'active',
  targetDate: '2026-07-18',
  isArchived: false,
  archivedAt: null,
  createdAt: '2026-07-03T12:00:00.000Z',
  updatedAt: '2026-07-04T12:00:00.000Z'
};

const projectSummary: ProjectNavigationSummaryDto = {
  project: {
    id: projectId,
    workspaceId,
    key: 'WT',
    name: 'Worktrail App',
    description: 'Project management reference app.',
    status: 'active',
    createdAt: '2026-07-02T12:00:00.000Z',
    updatedAt: '2026-07-04T12:00:00.000Z'
  },
  openWorkItemCount: 4,
  blockedWorkItemCount: 1,
  overdueWorkItemCount: 0,
  updatedAt: '2026-07-04T12:00:00.000Z'
};

const archivedProjectSummary: ProjectNavigationSummaryDto = {
  project: {
    id: archivedProjectId,
    workspaceId,
    key: 'LEG',
    name: 'Legacy Migration',
    description: 'Archived work.',
    status: 'archived',
    createdAt: '2026-06-02T12:00:00.000Z',
    updatedAt: '2026-06-04T12:00:00.000Z'
  },
  openWorkItemCount: 0,
  blockedWorkItemCount: 0,
  overdueWorkItemCount: 0,
  updatedAt: '2026-06-04T12:00:00.000Z'
};

const workItem: WorkspaceWorkItemListItemDto = {
  id: workItemId,
  workspaceId,
  projectId,
  itemNumber: 12,
  displayKey: 'WT-12',
  title: 'Design workspace discovery',
  type: 'story',
  status: 'in_progress',
  priority: 'high',
  assignee: owner,
  reporter: contributor,
  labels: [designLabel],
  milestone,
  boardPosition: 1024,
  dueDate: '2026-07-08',
  estimatePoints: 5,
  dependencyBlocked: false,
  openBlockerCount: 0,
  openBlockedWorkCount: 0,
  createdAt: '2026-07-02T12:00:00.000Z',
  updatedAt: '2026-07-04T12:00:00.000Z',
  project: {
    id: projectId,
    key: 'WT',
    name: 'Worktrail App',
    status: 'active'
  }
};

const savedView: SavedWorkViewDto = {
  id: '10000000-0000-4000-8000-000000000701',
  workspaceId,
  projectId: null,
  owner,
  name: 'Open owner work',
  scope: 'workspace',
  visibility: 'personal',
  isPinned: false,
  query: {
    assigneeId: owner.id,
    workState: 'open',
    sort: 'priority_desc'
  },
  createdAt: '2026-07-04T12:00:00.000Z',
  updatedAt: '2026-07-04T12:00:00.000Z'
};

const sharedSavedView: SavedWorkViewDto = {
  ...savedView,
  id: '10000000-0000-4000-8000-000000000702',
  owner,
  name: 'Dependency risks',
  visibility: 'workspace',
  query: {
    dependency: 'dependency_blocked',
    sort: 'priority_desc'
  }
};

const pinnedPersonalSavedView: SavedWorkViewDto = {
  ...savedView,
  id: '10000000-0000-4000-8000-000000000704',
  name: 'Pinned owner work',
  isPinned: true
};

const pinnedSharedSavedView: SavedWorkViewDto = {
  ...sharedSavedView,
  id: '10000000-0000-4000-8000-000000000705',
  name: 'Pinned dependency risks',
  isPinned: true
};

const projectScopedSavedView: SavedWorkViewDto = {
  ...savedView,
  id: '10000000-0000-4000-8000-000000000703',
  projectId,
  name: 'Project-only view',
  scope: 'project',
  visibility: 'workspace',
  query: {
    status: 'ready',
    sort: 'board_order'
  }
};

class ActivatedRouteStub {
  private readonly queryParamMapSubject = new BehaviorSubject(convertToParamMap({}));
  readonly queryParamMap = this.queryParamMapSubject.asObservable();
  readonly snapshot = {
    paramMap: convertToParamMap({})
  };

  setQuery(query: Record<string, string>): void {
    this.queryParamMapSubject.next(convertToParamMap(query));
  }
}

let route: ActivatedRouteStub;
let clipboard: jasmine.SpyObj<ClipboardService>;

function seedCurrentUser(member: MemberDto = owner): void {
  const currentUser = TestBed.inject(CurrentUserService);
  currentUser.members.set([owner, contributor]);
  currentUser.selectMember(member.id);
}

function spyOnCsvDownload(): void {
  spyOn(URL, 'createObjectURL').and.returnValue('blob:worktrail-workspace-export');
  spyOn(URL, 'revokeObjectURL');
}

function setup(
  query: Record<string, string> = {},
  actor: MemberDto = owner
): {
  fixture: ComponentFixture<WorkspaceWorkItemListPageComponent>;
  http: HttpTestingController;
} {
  seedCurrentUser(actor);
  route.setQuery(query);
  const fixture = TestBed.createComponent(WorkspaceWorkItemListPageComponent);
  const http = TestBed.inject(HttpTestingController);
  fixture.detectChanges();
  return { fixture, http };
}

function flushProjectSummaries(http: HttpTestingController): void {
  http.expectOne('/api/projects/navigation-summary').flush([
    projectSummary,
    archivedProjectSummary
  ]);
}

function flushSavedViews(http: HttpTestingController, views: SavedWorkViewDto[] = []): void {
  const request = http.expectOne((candidate) => candidate.url === '/api/saved-work-views');
  expect(request.request.method).toBe('GET');
  expect(request.request.params.get('scope')).toBe('workspace');
  expect(request.request.params.has('projectId')).toBeFalse();
  request.flush(views);
}

describe('WorkspaceWorkItemListPageComponent', () => {
  beforeEach(async () => {
    localStorage.clear();
    route = new ActivatedRouteStub();
    clipboard = jasmine.createSpyObj<ClipboardService>('ClipboardService', ['copyText']);
    clipboard.copyText.and.resolveTo();

    await TestBed.configureTestingModule({
      imports: [WorkspaceWorkItemListPageComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: route
        },
        {
          provide: ClipboardService,
          useValue: clipboard
        }
      ]
    }).compileComponents();
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  it('loads workspace work from URL query state and renders result links', () => {
    const { fixture, http } = setup({
      projectId,
      status: 'in_progress',
      assigneeId: owner.id,
      labelId: designLabel.id,
      milestoneId: milestone.id,
      dueDateState: 'due_soon',
      dependency: 'dependency_blocked',
      archivedProjects: 'include',
      search: 'workspace',
      sort: 'due_date_asc'
    });

    flushProjectSummaries(http);
    flushSavedViews(http);
    http.expectOne(`/api/projects/${projectId}/labels?includeArchived=true`).flush([designLabel]);
    http.expectOne(`/api/projects/${projectId}/milestones?includeArchived=true`).flush([milestone]);
    const request = http.expectOne((candidate) => {
      return (
        candidate.url === '/api/work-items' &&
        candidate.params.get('projectId') === projectId &&
        candidate.params.get('status') === 'in_progress' &&
        candidate.params.get('assigneeId') === owner.id &&
        candidate.params.get('labelId') === designLabel.id &&
        candidate.params.get('milestoneId') === milestone.id &&
        candidate.params.get('dueDateState') === 'due_soon' &&
        candidate.params.get('dependency') === 'dependency_blocked' &&
        candidate.params.get('archivedProjects') === 'include' &&
        candidate.params.get('search') === 'workspace' &&
        candidate.params.get('sort') === 'due_date_asc'
      );
    });
    request.flush([{ ...workItem, dependencyBlocked: true, openBlockerCount: 2, openBlockedWorkCount: 1 }]);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const filtersZone = compiled.querySelector<HTMLElement>('.work-list-filters');
    const chipsElement = filtersZone?.querySelector('app-active-filter-chips');
    const filterPanelElement = filtersZone?.querySelector('app-work-item-filter-panel');
    const activeFilters = Array.from(compiled.querySelectorAll('.active-filters span')).map(
      (item) => item.textContent?.trim()
    );
    const rowLink = compiled.querySelector<HTMLAnchorElement>('.work-item-title-link');

    expect(compiled.querySelector('.work-list-views')).not.toBeNull();
    expect(filtersZone).not.toBeNull();
    expect(compiled.querySelector('.work-list-results')).not.toBeNull();
    expect(chipsElement).not.toBeNull();
    expect(filterPanelElement).not.toBeNull();
    expect(
      Boolean(chipsElement!.compareDocumentPosition(filterPanelElement!) & Node.DOCUMENT_POSITION_FOLLOWING)
    ).toBeTrue();
    expect(compiled.textContent).toContain('Design workspace discovery');
    expect(compiled.textContent).toContain('Export CSV');
    expect(
      compiled
        .querySelector<HTMLButtonElement>('button[aria-label="Export applied workspace filters as CSV"]')
        ?.getAttribute('title')
    ).toBe('Export the applied workspace filters as CSV');
    expect(compiled.textContent).toContain('WT-12');
    expect(compiled.textContent).toContain('Worktrail App');
    expect(compiled.textContent).toContain('Story · In progress · High');
    expect(compiled.textContent).toContain('Avery Owner');
    expect(compiled.textContent).toContain('Due Jul 8');
    expect(compiled.textContent).toContain('Blocked by 2');
    expect(compiled.textContent).toContain('Blocks 1');
    expect(rowLink?.getAttribute('href')).toContain(`/work-items/${workItemId}`);
    expect(rowLink?.getAttribute('href')).toContain('returnUrl=');
    expect(activeFilters).toContain('Search: workspace');
    expect(activeFilters).toContain('Project: WT · Worktrail App');
    expect(activeFilters).toContain('Status: In progress');
    expect(activeFilters).toContain('Assignee: Avery Owner');
    expect(activeFilters).toContain('Label: design');
    expect(activeFilters).toContain('Milestone: v0.0.5');
    expect(activeFilters).toContain('Due date: Due soon');
    expect(activeFilters).toContain('Dependency: Blocked by open work');
    expect(activeFilters).toContain('Projects: Active and archived');
    expect(activeFilters).toContain('Sort: Due date');
  });

  it('exports workspace CSV with applied filters instead of pending draft form values', () => {
    spyOnCsvDownload();
    const { fixture, http } = setup({
      status: 'in_progress',
      dependency: 'blocking_open_work',
      archivedProjects: 'include',
      search: 'workspace',
      sort: 'due_date_asc'
    });
    flushProjectSummaries(http);
    flushSavedViews(http);
    http.expectOne((candidate) => candidate.url === '/api/work-items').flush([workItem]);
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
        candidate.url === '/api/work-items/export' &&
        candidate.params.get('search') === 'workspace' &&
        candidate.params.get('status') === 'in_progress' &&
        candidate.params.get('dependency') === 'blocking_open_work' &&
        candidate.params.get('priority') === null &&
        candidate.params.get('archivedProjects') === 'include' &&
        candidate.params.get('sort') === 'due_date_asc'
      );
    });
    expect(exportRequest.request.method).toBe('GET');
    exportRequest.flush(
      new Blob(['displayKey,title\nWT-12,Design workspace discovery\n'], {
        type: 'text/csv'
      }),
      {
      headers: {
        'Content-Disposition': 'attachment; filename="workspace-work-items.csv"'
      }
      }
    );

    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:worktrail-workspace-export');
    expect(fixture.componentInstance.isExporting()).toBeFalse();
  });

  it('copies the applied workspace filtered view link', fakeAsync(() => {
    const { fixture, http } = setup({
      status: 'in_progress',
      dependency: 'blocking_open_work',
      archivedProjects: 'include',
      search: 'workspace',
      sort: 'due_date_asc'
    });
    flushProjectSummaries(http);
    flushSavedViews(http);
    http.expectOne((candidate) => candidate.url === '/api/work-items').flush([workItem]);
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
    expect(copiedUrl.pathname).toBe('/work-items');
    expect(copiedUrl.searchParams.get('search')).toBe('workspace');
    expect(copiedUrl.searchParams.get('status')).toBe('in_progress');
    expect(copiedUrl.searchParams.get('dependency')).toBe('blocking_open_work');
    expect(copiedUrl.searchParams.get('archivedProjects')).toBe('include');
    expect(copiedUrl.searchParams.get('sort')).toBe('due_date_asc');
    expect(copiedUrl.searchParams.get('priority')).toBeNull();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Link copied');

    tick(2500);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('Link copied');
  }));

  it('shows workspace export failures inline', () => {
    const { fixture, http } = setup();
    flushProjectSummaries(http);
    flushSavedViews(http);
    http.expectOne('/api/work-items').flush([workItem]);

    fixture.componentInstance.exportCsv();
    http.expectOne('/api/work-items/export').flush(
      new Blob(['Workspace export failed.'], { type: 'text/plain' }),
      { status: 500, statusText: 'Server Error' }
    );
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'CSV export could not be downloaded.'
    );
    expect(fixture.componentInstance.isExporting()).toBeFalse();
  });

  it('applies dropdown filters immediately without showing pending filter pills', () => {
    const { fixture, http } = setup();
    flushProjectSummaries(http);
    flushSavedViews(http);
    http.expectOne('/api/work-items').flush([]);
    fixture.detectChanges();

    const router = TestBed.inject(Router);
    const navigate = spyOn(router, 'navigate').and.resolveTo(true);

    fixture.componentInstance.filterForm.controls.status.setValue('ready');
    fixture.detectChanges();

    expect(navigate).toHaveBeenCalled();
    expect(navigate.calls.mostRecent().args[1]?.queryParams).toEqual(
      jasmine.objectContaining({
        status: 'ready',
        workState: null
      })
    );
    expect(fixture.nativeElement.querySelector('.active-filters')).toBeNull();

    route.setQuery({ status: 'ready' });
    const request = http.expectOne((candidate) => {
      return candidate.url === '/api/work-items' && candidate.params.get('status') === 'ready';
    });
    request.flush([]);
    fixture.detectChanges();

    const activeFilters = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.active-filters span')
    ).map((item) => item.textContent?.trim());
    expect(activeFilters).toEqual(['Status: Ready']);
  });

  it('debounces search before updating URL query params', fakeAsync(() => {
    const { fixture, http } = setup();
    flushProjectSummaries(http);
    flushSavedViews(http);
    http.expectOne('/api/work-items').flush([]);
    fixture.detectChanges();

    const router = TestBed.inject(Router);
    const navigate = spyOn(router, 'navigate').and.resolveTo(true);

    fixture.componentInstance.filterForm.controls.search.setValue('api');
    tick(399);
    expect(navigate).not.toHaveBeenCalled();

    tick(1);
    expect(navigate).toHaveBeenCalledOnceWith(
      [],
      jasmine.objectContaining({
        queryParams: jasmine.objectContaining({
          search: 'api'
        })
      })
    );
  }));

  it('resets all filters with a single URL update', () => {
    const { fixture, http } = setup({
      status: 'blocked',
      search: 'risk',
      dependency: 'dependency_blocked',
      archivedProjects: 'only',
      sort: 'priority_desc'
    });
    flushProjectSummaries(http);
    flushSavedViews(http);
    http.expectOne((candidate) => candidate.url === '/api/work-items').flush([]);
    fixture.detectChanges();

    const router = TestBed.inject(Router);
    const navigate = spyOn(router, 'navigate').and.resolveTo(true);

    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('.filter-actions .secondary-action')
      ?.click();
    fixture.detectChanges();

    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate.calls.mostRecent().args[1]?.queryParams).toEqual(
      jasmine.objectContaining({
        search: null,
        status: null,
        dependency: null,
        archivedProjects: null,
        sort: null
      })
    );
  });

  it('saves, opens, renames, updates, and deletes personal saved views', () => {
    const { fixture, http } = setup({
      status: 'blocked',
      search: 'risk',
      dependency: 'blocking_open_work',
      archivedProjects: 'include'
    });
    flushProjectSummaries(http);
    flushSavedViews(http, [savedView]);
    http.expectOne((candidate) => candidate.url === '/api/work-items').flush([]);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Open owner work');

    fixture.componentInstance.savedViewForm.controls.name.setValue('Blocked risks');
    fixture.componentInstance.saveCurrentView();

    const create = http.expectOne('/api/saved-work-views');
    expect(create.request.method).toBe('POST');
    expect(create.request.body).toEqual({
      name: 'Blocked risks',
      scope: 'workspace',
      query: {
        search: 'risk',
        status: 'blocked',
        archivedProjects: 'include',
        dependency: 'blocking_open_work'
      }
    });
    const createdView: SavedWorkViewDto = {
      ...savedView,
      id: '10000000-0000-4000-8000-000000000702',
      name: 'Blocked risks',
      query: {
        search: 'risk',
        status: 'blocked',
        dependency: 'blocking_open_work',
        archivedProjects: 'include'
      }
    };
    create.flush(createdView);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Blocked risks');

    const router = TestBed.inject(Router);
    const navigate = spyOn(router, 'navigate').and.resolveTo(true);
    fixture.componentInstance.openSavedView(savedView);
    expect(navigate).toHaveBeenCalledWith(
      [],
      jasmine.objectContaining({
        queryParams: jasmine.objectContaining({
          assigneeId: owner.id,
          workState: 'open',
          sort: 'priority_desc'
        })
      })
    );

    fixture.componentInstance.setSavedViewDraftName(savedView.id, 'My open owner work');
    fixture.componentInstance.renameSavedView(savedView);
    const rename = http.expectOne(`/api/saved-work-views/${savedView.id}`);
    expect(rename.request.method).toBe('PATCH');
    expect(rename.request.body).toEqual({ name: 'My open owner work' });
    const renamedView: SavedWorkViewDto = { ...savedView, name: 'My open owner work' };
    rename.flush(renamedView);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('My open owner work');

    fixture.componentInstance.updateSavedViewQuery(renamedView);
    const update = http.expectOne(`/api/saved-work-views/${savedView.id}`);
    expect(update.request.method).toBe('PATCH');
    expect(update.request.body.query).toEqual(
      jasmine.objectContaining({
        search: 'risk',
        status: 'blocked',
        dependency: 'blocking_open_work',
        archivedProjects: 'include'
      })
    );
    update.flush({ ...renamedView, query: update.request.body.query });

    fixture.componentInstance.deleteSavedView(renamedView);
    const remove = http.expectOne(`/api/saved-work-views/${savedView.id}`);
    expect(remove.request.method).toBe('DELETE');
    remove.flush(null);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('My open owner work');
  });

  it('separates shared and personal views and manages shared views for owners', () => {
    const { fixture, http } = setup({
      status: 'blocked',
      search: 'risk',
      dependency: 'blocking_open_work',
      archivedProjects: 'include'
    });
    flushProjectSummaries(http);
    flushSavedViews(http, [savedView, sharedSavedView]);
    http.expectOne((candidate) => candidate.url === '/api/work-items').flush([]);
    fixture.detectChanges();

    expect(fixture.componentInstance.personalSavedViews().map((view) => view.id)).toEqual([
      savedView.id
    ]);
    expect(fixture.componentInstance.workspaceSavedViews().map((view) => view.id)).toEqual([
      sharedSavedView.id
    ]);
    expect(fixture.componentInstance.canManageWorkspaceSavedViews()).toBeTrue();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('1 shared · 1 personal');
    expect(text.indexOf('Dependency risks')).toBeLessThan(text.indexOf('Open owner work'));

    fixture.componentInstance.saveWorkspaceViewName('Shared blocked risks');
    const create = http.expectOne('/api/saved-work-views');
    expect(create.request.method).toBe('POST');
    expect(create.request.body).toEqual({
      name: 'Shared blocked risks',
      scope: 'workspace',
      visibility: 'workspace',
      query: {
        search: 'risk',
        status: 'blocked',
        archivedProjects: 'include',
        dependency: 'blocking_open_work'
      }
    });
    const createdView: SavedWorkViewDto = {
      ...sharedSavedView,
      id: '10000000-0000-4000-8000-000000000703',
      name: 'Shared blocked risks',
      query: create.request.body.query
    };
    create.flush(createdView);
    fixture.detectChanges();
    expect(fixture.componentInstance.workspaceSavedViews().map((view) => view.name)).toEqual([
      'Dependency risks',
      'Shared blocked risks'
    ]);

    fixture.componentInstance.setSavedViewDraftName(sharedSavedView.id, 'Shared dependency risks');
    fixture.componentInstance.renameSavedView(sharedSavedView);
    const rename = http.expectOne(`/api/saved-work-views/${sharedSavedView.id}`);
    expect(rename.request.method).toBe('PATCH');
    expect(rename.request.body).toEqual({ name: 'Shared dependency risks' });
    const renamedView: SavedWorkViewDto = {
      ...sharedSavedView,
      name: 'Shared dependency risks'
    };
    rename.flush(renamedView);

    fixture.componentInstance.updateSavedViewQuery(renamedView);
    const update = http.expectOne(`/api/saved-work-views/${sharedSavedView.id}`);
    expect(update.request.method).toBe('PATCH');
    expect(update.request.body.query).toEqual(
      jasmine.objectContaining({
        search: 'risk',
        status: 'blocked',
        dependency: 'blocking_open_work',
        archivedProjects: 'include'
      })
    );
    update.flush({ ...renamedView, query: update.request.body.query });

    fixture.componentInstance.deleteSavedView(renamedView);
    const remove = http.expectOne(`/api/saved-work-views/${sharedSavedView.id}`);
    expect(remove.request.method).toBe('DELETE');
    remove.flush(null);
  });

  it('renders pinned workspace shortcuts and opens them through canonical query params', () => {
    const { fixture, http } = setup();
    flushProjectSummaries(http);
    flushSavedViews(http, [pinnedPersonalSavedView, pinnedSharedSavedView, savedView, sharedSavedView]);
    http.expectOne('/api/work-items').flush([]);
    fixture.detectChanges();

    expect(fixture.componentInstance.pinnedPersonalSavedViews().map((view) => view.id)).toEqual([
      pinnedPersonalSavedView.id
    ]);
    expect(fixture.componentInstance.pinnedWorkspaceSavedViews().map((view) => view.id)).toEqual([
      pinnedSharedSavedView.id
    ]);

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Pinned views');
    expect(compiled.textContent).toContain('Pinned dependency risks');
    expect(compiled.textContent).toContain('Pinned owner work');
    expect(compiled.textContent).toContain('1 shared · 1 personal');

    const router = TestBed.inject(Router);
    const navigate = spyOn(router, 'navigate').and.resolveTo(true);
    compiled
      .querySelector<HTMLButtonElement>('button[aria-label="Open pinned shared view Pinned dependency risks"]')
      ?.click();

    expect(navigate).toHaveBeenCalledWith(
      [],
      jasmine.objectContaining({
        queryParams: jasmine.objectContaining({
          dependency: 'dependency_blocked',
          sort: 'priority_desc'
        })
      })
    );
  });

  it('updates workspace saved-view pinned state for mutable saved views', () => {
    const { fixture, http } = setup();
    flushProjectSummaries(http);
    flushSavedViews(http, [savedView, sharedSavedView]);
    http.expectOne('/api/work-items').flush([]);
    fixture.detectChanges();

    fixture.componentInstance.setSavedViewPinned(sharedSavedView, true);
    const pin = http.expectOne(`/api/saved-work-views/${sharedSavedView.id}`);
    expect(pin.request.method).toBe('PATCH');
    expect(pin.request.body).toEqual({ isPinned: true });
    const pinnedView: SavedWorkViewDto = { ...sharedSavedView, isPinned: true };
    pin.flush(pinnedView);
    fixture.detectChanges();

    expect(fixture.componentInstance.pinnedWorkspaceSavedViews().map((view) => view.id)).toEqual([
      sharedSavedView.id
    ]);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Dependency risks');

    fixture.componentInstance.setSavedViewPinned(pinnedView, false);
    const unpin = http.expectOne(`/api/saved-work-views/${sharedSavedView.id}`);
    expect(unpin.request.method).toBe('PATCH');
    expect(unpin.request.body).toEqual({ isPinned: false });
    unpin.flush({ ...pinnedView, isPinned: false });

    expect(fixture.componentInstance.pinnedWorkspaceSavedViews()).toEqual([]);
  });

  it('shows pin mutation errors without corrupting saved-view state', () => {
    const { fixture, http } = setup();
    flushProjectSummaries(http);
    flushSavedViews(http, [sharedSavedView]);
    http.expectOne('/api/work-items').flush([]);
    fixture.detectChanges();

    fixture.componentInstance.setSavedViewPinned(sharedSavedView, true);
    const pin = http.expectOne(`/api/saved-work-views/${sharedSavedView.id}`);
    pin.flush(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Pin update failed.'
        }
      },
      { status: 500, statusText: 'Server Error' }
    );
    fixture.detectChanges();

    expect(fixture.componentInstance.pinnedWorkspaceSavedViews()).toEqual([]);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Pin update failed.');
  });

  it('excludes project-scoped saved views from workspace saved view groups', () => {
    const { fixture, http } = setup();
    flushProjectSummaries(http);
    flushSavedViews(http, [savedView, sharedSavedView, projectScopedSavedView]);
    http.expectOne('/api/work-items').flush([]);
    fixture.detectChanges();

    expect(fixture.componentInstance.personalSavedViews().map((view) => view.id)).toEqual([
      savedView.id
    ]);
    expect(fixture.componentInstance.workspaceSavedViews().map((view) => view.id)).toEqual([
      sharedSavedView.id
    ]);

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Open owner work');
    expect(text).toContain('Dependency risks');
    expect(text).not.toContain('Project-only view');
  });

  it('lets contributors open shared views without sending shared mutation requests', () => {
    const { fixture, http } = setup({}, contributor);
    flushProjectSummaries(http);
    flushSavedViews(http, [sharedSavedView]);
    http.expectOne('/api/work-items').flush([]);
    fixture.detectChanges();

    expect(fixture.componentInstance.workspaceSavedViews().map((view) => view.id)).toEqual([
      sharedSavedView.id
    ]);
    expect(fixture.componentInstance.canManageWorkspaceSavedViews()).toBeFalse();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Owners and maintainers manage shared saved views.'
    );

    const router = TestBed.inject(Router);
    const navigate = spyOn(router, 'navigate').and.resolveTo(true);
    fixture.componentInstance.openSavedView(sharedSavedView);
    expect(navigate).toHaveBeenCalledWith(
      [],
      jasmine.objectContaining({
        queryParams: jasmine.objectContaining({
          dependency: 'dependency_blocked',
          sort: 'priority_desc'
        })
      })
    );

    fixture.componentInstance.saveWorkspaceViewName('Contributor shared view');
    fixture.componentInstance.renameSavedView(sharedSavedView);
    fixture.componentInstance.updateSavedViewQuery(sharedSavedView);
    fixture.componentInstance.setSavedViewPinned(sharedSavedView, true);
    fixture.componentInstance.deleteSavedView(sharedSavedView);

    http.expectNone('/api/saved-work-views');
    http.expectNone(`/api/saved-work-views/${sharedSavedView.id}`);
    expect(fixture.componentInstance.savedViewMutationError()).toBe(
      'Only owners and maintainers can manage shared saved views.'
    );
  });

  it('shows saved view validation and duplicate-name errors inline', () => {
    const { fixture, http } = setup();
    flushProjectSummaries(http);
    flushSavedViews(http);
    http.expectOne('/api/work-items').flush([]);
    fixture.detectChanges();

    fixture.componentInstance.saveCurrentView();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Saved view name is required.'
    );
    http.expectNone('/api/saved-work-views');

    fixture.componentInstance.savedViewForm.controls.name.setValue('Open owner work');
    fixture.componentInstance.saveCurrentView();
    const create = http.expectOne('/api/saved-work-views');
    create.flush(
      {
        error: {
          code: 'CONFLICT',
          message: 'A saved view with this name already exists.'
        }
      },
      { status: 409, statusText: 'Conflict' }
    );
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'A saved view with this name already exists.'
    );
  });

  it('opens stale saved views without breaking empty results', () => {
    const staleView: SavedWorkViewDto = {
      ...savedView,
      name: 'Stale design work',
      query: {
        projectId,
        labelId: designLabel.id
      }
    };
    const { fixture, http } = setup();
    flushProjectSummaries(http);
    flushSavedViews(http, [staleView]);
    http.expectOne('/api/work-items').flush([workItem]);
    fixture.detectChanges();

    route.setQuery({ projectId, labelId: designLabel.id });
    http.expectOne(`/api/projects/${projectId}/labels?includeArchived=true`).flush([designLabel]);
    http.expectOne(`/api/projects/${projectId}/milestones?includeArchived=true`).flush([milestone]);
    http.expectOne((candidate) => {
      return (
        candidate.url === '/api/work-items' &&
        candidate.params.get('projectId') === projectId &&
        candidate.params.get('labelId') === designLabel.id
      );
    }).flush([]);
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('No work items match these filters');
    expect(text).toContain('Label: design');
  });
});
