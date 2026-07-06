import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, fakeAsync, flushMicrotasks, tick } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import type {
  LabelDto,
  MemberDto,
  MilestoneDto,
  ProjectDto,
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
  dependencyBlocked: false,
  openBlockerCount: 0,
  openBlockedWorkCount: 0,
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
  return {
    snapshot: {
      paramMap: convertToParamMap(inputProjectId === '' ? {} : { projectId: inputProjectId })
    },
    queryParamMap: new BehaviorSubject(convertToParamMap(query)).asObservable()
  };
}

function seedCurrentUser() {
  const currentUser = TestBed.inject(CurrentUserService);
  currentUser.members.set([member, inactiveMember]);
  currentUser.selectMember(member.id);
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
    capabilities?: WorkspaceCapabilitiesDto;
  } = {}
) {
  http.expectOne('/api/workspace/capabilities').flush(input.capabilities ?? ownerCapabilities);
  http.expectOne(`/api/projects/${projectId}`).flush(input.project ?? activeProject);
  http.expectOne(`/api/projects/${projectId}/milestones`).flush(input.milestones ?? [activeMilestone]);
  http.expectOne(`/api/projects/${projectId}/labels`).flush(input.labels ?? [backendLabel]);
}

describe('WorkItemListPageComponent', () => {
  beforeEach(async () => {
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
          useValue: routeStub({
            status: 'in_progress',
            assigneeId: contributorId,
            reporterId: contributorId,
            milestoneId: activeMilestone.id,
            dueDateState: 'due_soon',
            dependency: 'dependency_blocked',
            search: 'api',
            sort: 'due_date_asc'
          })
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
        candidate.params.get('dependency') === 'dependency_blocked' &&
        candidate.params.get('search') === 'api' &&
        candidate.params.get('sort') === 'due_date_asc'
      );
    });
    request.flush([{ ...workItem, dependencyBlocked: true, openBlockerCount: 2, openBlockedWorkCount: 1 }]);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
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
        .querySelector<HTMLButtonElement>('button[aria-label="Export applied project filters as CSV"]')
        ?.getAttribute('title')
    ).toBe('Export the applied project filters as CSV');
    expect(compiled.querySelector<HTMLAnchorElement>(`a[href="/projects/${projectId}/work-items/import"]`)).not.toBeNull();
  });

  it('exports CSV with applied filters instead of pending draft form values', () => {
    spyOnCsvDownload();
    const fixture = TestBed.createComponent(WorkItemListPageComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    http.expectOne(`/api/projects/${projectId}`).flush(activeProject);
    http.expectOne(`/api/projects/${projectId}/milestones?includeArchived=true`).flush([activeMilestone]);
    http.expectOne((candidate) => candidate.url === `/api/projects/${projectId}/work-items`).flush([workItem]);
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
    http.expectOne(`/api/projects/${projectId}/milestones?includeArchived=true`).flush([activeMilestone]);
    http.expectOne((candidate) => candidate.url === `/api/projects/${projectId}/work-items`).flush([workItem]);

    fixture.componentInstance.exportCsv();
    http.expectOne((candidate) => candidate.url === `/api/projects/${projectId}/work-items/export`).flush(
      new Blob(['Export is temporarily unavailable.'], { type: 'text/plain' }),
      { status: 500, statusText: 'Server Error' }
    );
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'CSV export could not be downloaded.'
    );
    expect(fixture.componentInstance.isExporting()).toBeFalse();
  });

  it('copies the applied project filtered view link', fakeAsync(() => {
    const fixture = TestBed.createComponent(WorkItemListPageComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    http.expectOne(`/api/projects/${projectId}`).flush(activeProject);
    http.expectOne(`/api/projects/${projectId}/milestones?includeArchived=true`).flush([activeMilestone]);
    http.expectOne((candidate) => candidate.url === `/api/projects/${projectId}/work-items`).flush([workItem]);
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
    expect(copiedUrl.searchParams.get('priority')).toBeNull();
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
    http.expectOne(`/api/projects/${projectId}/milestones?includeArchived=true`).flush([activeMilestone]);
    http.expectOne((candidate) => candidate.url === `/api/projects/${projectId}/work-items`).flush([workItem]);
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
        priority: 'high',
        dueDateState: 'overdue',
        dependency: 'blocking_open_work',
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
    TestBed.inject(HttpTestingController).verify();
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
    expect(compiled.querySelector<HTMLAnchorElement>('a[href="/work-items/10000000-0000-4000-8000-000000000490"]')).not.toBeNull();
    expect(compiled.querySelector<HTMLAnchorElement>(`a[href="/projects/${projectId}/work-items"]`)).not.toBeNull();
    expect(compiled.querySelector<HTMLAnchorElement>(`a[href="/projects/${projectId}/board"]`)).not.toBeNull();
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
    TestBed.inject(HttpTestingController).verify();
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
    expect(compiled.querySelector<HTMLAnchorElement>('a[href="/work-items/10000000-0000-4000-8000-000000000499"]')).not.toBeNull();
    expect(compiled.textContent).toContain('Create another');
  });

  it('excludes inactive members from the create assignee control', () => {
    const fixture = TestBed.createComponent(WorkItemCreatePageComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    flushCreateContext(http);
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
    TestBed.inject(HttpTestingController).verify();
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
    expect(compiled.querySelector<HTMLAnchorElement>('a[href="/work-items/10000000-0000-4000-8000-000000000497"]')).not.toBeNull();

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
