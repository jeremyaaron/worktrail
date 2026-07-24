import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, ParamMap, convertToParamMap, provideRouter } from '@angular/router';
import type {
  MemberDto,
  MilestoneDto,
  ProjectCycleDto,
  ProjectDto,
  WorkItemAttachmentListDto,
  WorkItemDetailDto,
  WorkItemRelationshipItemDto,
  WorkItemWatchStateDto,
  WorkspaceWorkItemListItemDto
} from '@worktrail/contracts';
import { BehaviorSubject } from 'rxjs';

import { CurrentUserService } from '../../core/current-user.service';
import { WorkItemAttachmentsComponent } from './components/work-item-attachments.component';
import { WorkItemDetailPageComponent } from './work-item-detail-page.component';

const projectId = '10000000-0000-4000-8000-000000000201';
const workItemId = '10000000-0000-4000-8000-000000000403';
const ownerId = '10000000-0000-4000-8000-000000000101';
const contributorId = '10000000-0000-4000-8000-000000000103';
const inactiveMemberId = '10000000-0000-4000-8000-000000000104';
const labelId = '10000000-0000-4000-8000-000000000302';
const frontendLabelId = '10000000-0000-4000-8000-000000000301';
const archivedLabelId = '10000000-0000-4000-8000-000000000399';
const milestoneId = '10000000-0000-4000-8000-000000000501';
const nextMilestoneId = '10000000-0000-4000-8000-000000000502';
const blockerWorkItemId = '10000000-0000-4000-8000-000000000404';
const blockedWorkItemId = '10000000-0000-4000-8000-000000000405';
const relatedWorkItemId = '10000000-0000-4000-8000-000000000406';
let routeQueryParams: Record<string, string>;
let routeParamMap: BehaviorSubject<ParamMap>;
let routeFragment: BehaviorSubject<string | null>;

const owner: MemberDto = {
  id: ownerId,
  workspaceId: '10000000-0000-4000-8000-000000000001',
  name: 'Avery Owner',
  email: 'avery.owner@example.com',
  role: 'owner',
  isActive: true,
  deactivatedAt: null,
  createdAt: '2026-07-02T12:00:00.000Z',
  updatedAt: '2026-07-03T12:00:00.000Z'
};

const contributor: MemberDto = {
  id: contributorId,
  workspaceId: owner.workspaceId,
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
  workspaceId: owner.workspaceId,
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
  workspaceId: owner.workspaceId,
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
  id: milestoneId,
  workspaceId: owner.workspaceId,
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

const nextMilestone: MilestoneDto = {
  ...activeMilestone,
  id: nextMilestoneId,
  name: 'v0.0.4',
  status: 'planned',
  targetDate: '2026-08-01'
};

const activeCycle: ProjectCycleDto = {
  id: '10000000-0000-4000-8000-000000000701',
  workspaceId: owner.workspaceId,
  projectId,
  name: 'Cycle 1',
  goal: 'Integrate detail cycle assignment.',
  status: 'active',
  startDate: '2026-07-06',
  endDate: '2026-07-20',
  targetPoints: 24,
  isArchived: false,
  archivedAt: null,
  createdAt: '2026-07-03T12:00:00.000Z',
  updatedAt: '2026-07-04T12:00:00.000Z'
};

function relationshipItem(input: {
  id: string;
  workItemId: string;
  displayKey: string;
  title: string;
  direction: 'inbound' | 'outbound' | 'related';
}): WorkItemRelationshipItemDto {
  return {
    id: input.id,
    relationshipType: input.direction === 'related' ? 'relates_to' : 'blocks',
    direction: input.direction,
    workItem: {
      id: input.workItemId,
      workspaceId: owner.workspaceId,
      projectId,
      project: {
        id: projectId,
        key: activeProject.key,
        name: activeProject.name,
        status: activeProject.status
      },
      displayKey: input.displayKey,
      title: input.title,
      status: 'ready',
      priority: 'medium',
      assignee: contributor
    },
    createdBy: owner,
    createdAt: '2026-07-04T12:00:00.000Z'
  };
}

function candidate(input: {
  id: string;
  displayKey: string;
  title: string;
}): WorkspaceWorkItemListItemDto {
  return {
    id: input.id,
    workspaceId: owner.workspaceId,
    projectId,
    itemNumber: Number(input.displayKey.split('-')[1]),
    displayKey: input.displayKey,
    title: input.title,
    type: 'task',
    status: 'ready',
    priority: 'medium',
    assignee: contributor,
    reporter: owner,
    labels: [],
    milestone: null,
    cycle: null,
    boardPosition: 1024,
    dueDate: null,
    estimatePoints: null,
    parent: null,
    childSummary: null,
    dependencyBlocked: false,
    openBlockerCount: 0,
    openBlockedWorkCount: 0,
    createdAt: '2026-07-03T12:00:00.000Z',
    updatedAt: '2026-07-04T12:00:00.000Z',
    project: {
      id: projectId,
      key: activeProject.key,
      name: activeProject.name,
      status: activeProject.status
    }
  };
}

const detail: WorkItemDetailDto = {
  id: workItemId,
  workspaceId: owner.workspaceId,
  projectId,
  itemNumber: 3,
  displayKey: 'WT-3',
  title: 'Implement detail surface',
  description: 'Build comments and activity UI.',
  type: 'task',
  status: 'in_progress',
  priority: 'high',
  assignee: contributor,
  reporter: owner,
  labels: [{ id: labelId, name: 'backend', color: '#059669', isArchived: false, archivedAt: null }],
  milestone: activeMilestone,
  cycle: activeCycle,
  boardPosition: 1024,
  dueDate: '2026-07-20',
  estimatePoints: 5,
  parent: null,
  childSummary: null,
  dependencyBlocked: false,
  openBlockerCount: 0,
  openBlockedWorkCount: 0,
  createdAt: '2026-07-02T12:00:00.000Z',
  updatedAt: '2026-07-03T12:00:00.000Z',
  relationships: {
    blockedBy: [],
    blocks: [],
    related: [],
    dependencyBlocked: false,
    openBlockerCount: 0,
    openBlockedWorkCount: 0
  },
  comments: [
    {
      id: '10000000-0000-4000-8000-000000000501',
      workspaceId: owner.workspaceId,
      projectId,
      workItemId,
      author: owner,
      body: 'Initial implementation note.',
      mentions: [],
      isEdited: false,
      isDeleted: false,
      editedAt: null,
      deletedAt: null,
      deletedBy: null,
      createdAt: '2026-07-03T12:00:00.000Z',
      updatedAt: '2026-07-03T12:00:00.000Z'
    }
  ],
  activity: [
    {
      id: '10000000-0000-4000-8000-000000000601',
      workspaceId: owner.workspaceId,
      projectId,
      workItemId,
      actor: owner,
      eventType: 'work_item.created',
      summary: 'Avery Owner created this work item.',
      previousValue: null,
      newValue: { status: 'backlog' },
      metadata: {},
      createdAt: '2026-07-02T12:00:00.000Z'
    }
  ]
};

const unwatchedState: WorkItemWatchStateDto = {
  isWatchedByCurrentActor: false,
  watcherCount: 1,
  watchers: [
    {
      id: '10000000-0000-4000-8000-000000000701',
      member: contributor,
      watchedAt: '2026-07-03T14:00:00.000Z'
    }
  ]
};

const emptyAttachmentList: WorkItemAttachmentListDto = {
  items: [],
  policy: {
    maxFileBytes: 4 * 1024 * 1024,
    maxAttachmentsPerWorkItem: 20,
    maxAggregateBytesPerWorkItem: 50 * 1024 * 1024,
    maxFileNameCodePoints: 180,
    acceptedTypes: []
  },
  usage: {
    attachmentCount: 0,
    aggregateBytes: 0,
    remainingAttachmentSlots: 20,
    remainingBytes: 50 * 1024 * 1024
  },
  permissions: { canUpload: true }
};

const watchedState: WorkItemWatchStateDto = {
  isWatchedByCurrentActor: true,
  watcherCount: 2,
  watchers: [
    ...unwatchedState.watchers,
    {
      id: '10000000-0000-4000-8000-000000000702',
      member: owner,
      watchedAt: '2026-07-03T15:00:00.000Z'
    }
  ]
};

function seedCurrentUser() {
  const currentUser = TestBed.inject(CurrentUserService);
  currentUser.members.set([owner, contributor, inactiveMember]);
  currentUser.selectMember(owner.id);
}

function setup(
  input: {
    workItem?: WorkItemDetailDto;
    project?: ProjectDto;
    watchState?: WorkItemWatchStateDto;
  } = {}
) {
  const fixture = TestBed.createComponent(WorkItemDetailPageComponent);
  const http = TestBed.inject(HttpTestingController);
  const workItem = input.workItem ?? detail;
  const project = input.project ?? activeProject;
  fixture.detectChanges();
  http.expectOne(`/api/work-items/${workItemId}`).flush(workItem);
  http.expectOne(`/api/work-items/${workItemId}/watchers`).flush(input.watchState ?? unwatchedState);
  http.expectOne(`/api/projects/${projectId}`).flush(project);
  http.expectOne(`/api/projects/${projectId}/labels`).flush([
    { id: frontendLabelId, name: 'frontend', color: '#2563eb', isArchived: false, archivedAt: null },
    { id: labelId, name: 'backend', color: '#059669', isArchived: false, archivedAt: null }
  ]);
  http.expectOne(`/api/projects/${projectId}/milestones?includeArchived=true`).flush([
    activeMilestone,
    nextMilestone
  ]);
  http.expectOne(`/api/projects/${projectId}/cycles?includeArchived=true`).flush([activeCycle]);
  fixture.detectChanges();
  http.expectOne(`/api/work-items/${workItem.id}/attachments`).flush(emptyAttachmentList);
  fixture.detectChanges();
  return { fixture, http };
}

describe('WorkItemDetailPageComponent', () => {
  beforeEach(async () => {
    routeQueryParams = {};
    routeParamMap = new BehaviorSubject(convertToParamMap({ workItemId }));
    routeFragment = new BehaviorSubject<string | null>(null);

    await TestBed.configureTestingModule({
      imports: [WorkItemDetailPageComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: routeParamMap.asObservable(),
            fragment: routeFragment.asObservable(),
            snapshot: {
              get paramMap() {
                return routeParamMap.value;
              },
              get queryParamMap() {
                return convertToParamMap(routeQueryParams);
              },
              get fragment() {
                return routeFragment.value;
              }
            }
          }
        }
      ]
    }).compileComponents();

    seedCurrentUser();
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  it('renders work item detail, comments, and activity', () => {
    const { fixture } = setup();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.textContent).toContain('WT-3');
    expect(compiled.textContent).toContain('Implement detail surface');
    expect(compiled.textContent).toContain('Summary');
    expect(compiled.textContent).toContain('Act');
    expect(compiled.textContent).toContain('Collaborate');
    expect(compiled.textContent).toContain('Dependencies');
    expect(compiled.textContent).toContain('Attachments');
    expect(compiled.textContent).toContain('History');
    expect(compiled.textContent).toContain('frontend');
    expect(compiled.textContent).toContain('backend');
    expect(compiled.textContent).toContain('v0.0.3');
    expect(compiled.textContent).toContain('Initial implementation note.');
    expect(compiled.textContent).toContain('Avery Owner created this work item.');
  });

  it('refreshes only activity when the attachment child reports a mutation', () => {
    const { fixture, http } = setup();
    const original = fixture.componentInstance.workItem();
    const originalWatchState = fixture.componentInstance.watchState();
    const attachmentComponent = fixture.debugElement.query(
      By.directive(WorkItemAttachmentsComponent)
    ).componentInstance as WorkItemAttachmentsComponent;

    attachmentComponent.activityChanged.emit();
    const activityRequest = http.expectOne(`/api/work-items/${workItemId}/activity`);
    expect(activityRequest.request.method).toBe('GET');
    http.expectNone(`/api/work-items/${workItemId}`);
    http.expectNone(`/api/work-items/${workItemId}/watchers`);
    http.expectNone('/api/notifications/unread-count');
    activityRequest.flush([
      {
        id: '10000000-0000-4000-8000-000000000699',
        workspaceId: owner.workspaceId,
        projectId,
        workItemId,
        actor: owner,
        eventType: 'work_item.attachment_uploaded',
        summary: 'Uploaded attachment "design-review.png".',
        previousValue: null,
        newValue: {
          attachment: {
            id: '10000000-0000-4000-8000-000000000801',
            fileName: 'design-review.png',
            mediaType: 'image/png',
            byteSize: 2048
          }
        },
        metadata: { attachmentId: '10000000-0000-4000-8000-000000000801' },
        createdAt: '2026-07-21T18:00:00.000Z'
      },
      ...(original?.activity ?? [])
    ]);
    fixture.detectChanges();

    const refreshed = fixture.componentInstance.workItem();
    expect(refreshed?.updatedAt).toBe(original?.updatedAt);
    expect(refreshed?.comments).toBe(original?.comments);
    expect(fixture.componentInstance.watchState()).toBe(originalWatchState);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Uploaded attachment "design-review.png".'
    );
  });

  it('retains activity when its attachment refresh fails and supports scoped retry', () => {
    const { fixture, http } = setup();
    const attachmentComponent = fixture.debugElement.query(
      By.directive(WorkItemAttachmentsComponent)
    ).componentInstance as WorkItemAttachmentsComponent;

    attachmentComponent.activityChanged.emit();
    http
      .expectOne(`/api/work-items/${workItemId}/activity`)
      .flush(
        { error: { code: 'INTERNAL_ERROR', message: 'Failed.' } },
        { status: 500, statusText: 'Server Error' }
      );
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Activity not refreshed');
    expect(compiled.textContent).toContain('Avery Owner created this work item.');

    compiled
      .querySelector<HTMLButtonElement>('.history-section app-error-panel button')
      ?.click();
    http.expectOne(`/api/work-items/${workItemId}/activity`).flush(detail.activity);
    fixture.detectChanges();

    expect(compiled.textContent).not.toContain('Activity not refreshed');
    http.expectNone(`/api/work-items/${workItemId}`);
    http.expectNone(`/api/work-items/${workItemId}/watchers`);
  });

  it('renders watcher state with count and watcher list', () => {
    const { fixture } = setup({ watchState: watchedState });
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.textContent).toContain('Watchers');
    expect(compiled.textContent).toContain('2 watching');
    expect(compiled.textContent).toContain('Case Contributor');
    expect(compiled.textContent).toContain('Avery Owner');
    expect(
      compiled.querySelector<HTMLButtonElement>('.watch-panel button')?.textContent?.trim()
    ).toBe('Unwatch');
  });

  it('watches and unwatches the work item from detail', () => {
    const { fixture, http } = setup({ watchState: unwatchedState });

    fixture.componentInstance.toggleWatch();
    const watchRequest = http.expectOne(`/api/work-items/${workItemId}/watch`);
    expect(watchRequest.request.method).toBe('PUT');
    watchRequest.flush(watchedState);
    fixture.detectChanges();

    expect(fixture.componentInstance.watchState()?.isWatchedByCurrentActor).toBeTrue();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('2 watching');

    fixture.componentInstance.toggleWatch();
    const unwatchRequest = http.expectOne(`/api/work-items/${workItemId}/watch`);
    expect(unwatchRequest.request.method).toBe('DELETE');
    unwatchRequest.flush(unwatchedState);
    fixture.detectChanges();

    expect(fixture.componentInstance.watchState()?.isWatchedByCurrentActor).toBeFalse();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.watch-panel button')
        ?.textContent
        ?.trim()
    ).toBe('Watch');
  });

  it('selects and removes comment mention members', () => {
    const { fixture } = setup();

    fixture.componentInstance.addMentionMember(contributor.id);
    fixture.componentInstance.addMentionMember(inactiveMember.id);
    fixture.detectChanges();

    expect(fixture.componentInstance.selectedMentionMemberIds()).toEqual([contributor.id]);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Case Contributor');

    fixture.componentInstance.removeMentionMember(contributor.id);
    fixture.detectChanges();

    expect(fixture.componentInstance.selectedMentionMemberIds()).toEqual([]);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('No mentions selected.');
  });

  it('uses safe return context and rejects external return URLs', () => {
    routeQueryParams = {
      returnUrl: `/projects/${projectId}/work-items?status=blocked&sort=priority_desc`
    };
    const { fixture } = setup();
    const backLink = (fixture.nativeElement as HTMLElement).querySelector<HTMLAnchorElement>(
      '.detail-header a'
    );

    expect(backLink?.getAttribute('href')).toBe(
      `/projects/${projectId}/work-items?status=blocked&sort=priority_desc`
    );

    routeQueryParams = { returnUrl: 'https://example.com/phish' };
    const unsafeFixture = TestBed.createComponent(WorkItemDetailPageComponent);
    const http = TestBed.inject(HttpTestingController);
    unsafeFixture.detectChanges();
    http.expectOne(`/api/work-items/${workItemId}`).flush(detail);
    http.expectOne(`/api/work-items/${workItemId}/watchers`).flush(unwatchedState);
    http.expectOne(`/api/projects/${projectId}`).flush(activeProject);
    http.expectOne(`/api/projects/${projectId}/labels`).flush([]);
    http.expectOne(`/api/projects/${projectId}/milestones?includeArchived=true`).flush([]);
    http.expectOne(`/api/projects/${projectId}/cycles?includeArchived=true`).flush([]);
    unsafeFixture.detectChanges();
    http.expectOne(`/api/work-items/${workItemId}/attachments`).flush(emptyAttachmentList);
    unsafeFixture.detectChanges();

    const fallbackLink = (unsafeFixture.nativeElement as HTMLElement).querySelector<HTMLAnchorElement>(
      '.detail-header a'
    );
    expect(fallbackLink?.getAttribute('href')).toBe(`/projects/${projectId}/work-items`);
  });

  it('renders relationship sections with linked work item metadata', () => {
    const relationshipDetail: WorkItemDetailDto = {
      ...detail,
      relationships: {
        blockedBy: [
          relationshipItem({
            id: '10000000-0000-4000-8000-000000000801',
            workItemId: blockerWorkItemId,
            displayKey: 'WT-4',
            title: 'Finish API contract',
            direction: 'inbound'
          })
        ],
        blocks: [
          relationshipItem({
            id: '10000000-0000-4000-8000-000000000802',
            workItemId: blockedWorkItemId,
            displayKey: 'WT-5',
            title: 'Build detail controls',
            direction: 'outbound'
          })
        ],
        related: [
          relationshipItem({
            id: '10000000-0000-4000-8000-000000000803',
            workItemId: relatedWorkItemId,
            displayKey: 'WT-6',
            title: 'Update product docs',
            direction: 'related'
          })
        ],
        dependencyBlocked: true,
        openBlockerCount: 1,
        openBlockedWorkCount: 1
      }
    };
    const { fixture } = setup({ workItem: relationshipDetail });
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.textContent).toContain('Blocked by');
    expect(compiled.textContent).toContain('WT-4 Finish API contract');
    expect(compiled.textContent).toContain('Blocks');
    expect(compiled.textContent).toContain('WT-5 Build detail controls');
    expect(compiled.textContent).toContain('Related work');
    expect(compiled.textContent).toContain('WT-6 Update product docs');
    expect(compiled.textContent).toContain('Worktrail App');
    expect(compiled.textContent).toContain('Case Contributor');
  });

  it('searches relationship candidates while excluding the current work item', () => {
    const { fixture, http } = setup();
    fixture.componentInstance.relationshipForm.patchValue({ search: 'api' });
    fixture.componentInstance.searchRelationshipCandidates();

    const request = http.expectOne((candidateRequest) => candidateRequest.url === '/api/work-items');
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('search')).toBe('api');
    expect(request.request.params.get('archivedProjects')).toBe('exclude');
    expect(request.request.params.get('page')).toBe('1');
    expect(request.request.params.get('pageSize')).toBe('25');
    request.flush({
      items: [
        candidate({ id: workItemId, displayKey: 'WT-3', title: 'Implement detail surface' }),
        candidate({ id: blockerWorkItemId, displayKey: 'WT-4', title: 'Finish API contract' })
      ],
      page: 1,
      pageSize: 25,
      totalCount: 30,
      totalPages: 2,
      hasPreviousPage: false,
      hasNextPage: true
    });
    fixture.detectChanges();

    expect(fixture.componentInstance.relationshipCandidates().map((item) => item.id)).toEqual([
      blockerWorkItemId
    ]);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('WT-4 Finish API contract');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'More matches are available. Refine the search to narrow the results.'
    );
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain(
      'WT-3 Implement detail surface'
    );
  });

  it('preserves relationship candidate loading, error, retry, and empty states', () => {
    const { fixture, http } = setup();
    fixture.componentInstance.relationshipForm.patchValue({ search: 'missing work' });
    fixture.componentInstance.searchRelationshipCandidates();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const searchButton = compiled.querySelector<HTMLButtonElement>(
      '.relationship-form-grid button'
    );
    expect(searchButton?.disabled).toBeTrue();
    expect(searchButton?.textContent?.trim()).toBe('Searching...');

    http
      .expectOne((candidateRequest) => candidateRequest.url === '/api/work-items')
      .flush('failed', { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect(compiled.textContent).toContain('Search failed');
    expect(compiled.textContent).toContain('Work item candidates could not be loaded.');
    compiled.querySelector<HTMLButtonElement>('.relationship-form app-error-panel button')?.click();

    const retry = http.expectOne((candidateRequest) => candidateRequest.url === '/api/work-items');
    expect(retry.request.params.get('search')).toBe('missing work');
    expect(retry.request.params.get('page')).toBe('1');
    expect(retry.request.params.get('pageSize')).toBe('25');
    retry.flush({
      items: [],
      page: 1,
      pageSize: 25,
      totalCount: 0,
      totalPages: 0,
      hasPreviousPage: false,
      hasNextPage: false
    });
    fixture.detectChanges();

    expect(compiled.textContent).toContain('No matching work items found.');
    expect(compiled.textContent).not.toContain('More matches are available.');
  });

  it('reloads detail when navigating to another work item on the same route component', () => {
    const { fixture, http } = setup();
    const nextDetail: WorkItemDetailDto = {
      ...detail,
      id: blockedWorkItemId,
      displayKey: 'WT-5',
      title: 'Build detail controls',
      description: 'The downstream work item detail.',
      comments: [],
      labels: [],
      relationships: {
        ...detail.relationships,
        blockedBy: [],
        blocks: [],
        related: [],
        dependencyBlocked: false,
        openBlockerCount: 0,
        openBlockedWorkCount: 0
      }
    };

    routeParamMap.next(convertToParamMap({ workItemId: blockedWorkItemId }));
    fixture.detectChanges();

    http.expectOne(`/api/work-items/${blockedWorkItemId}`).flush(nextDetail);
    http.expectOne(`/api/work-items/${blockedWorkItemId}/watchers`).flush(unwatchedState);
    http.expectOne(`/api/projects/${projectId}`).flush(activeProject);
    http.expectOne(`/api/projects/${projectId}/labels`).flush([]);
    http.expectOne(`/api/projects/${projectId}/milestones?includeArchived=true`).flush([]);
    http.expectOne(`/api/projects/${projectId}/cycles?includeArchived=true`).flush([]);
    fixture.detectChanges();
    http.expectOne(`/api/work-items/${blockedWorkItemId}/attachments`).flush(emptyAttachmentList);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('WT-5');
    expect(compiled.textContent).toContain('Build detail controls');
    expect(compiled.textContent).not.toContain('WT-3');
    expect(fixture.componentInstance.workItemId()).toBe(blockedWorkItemId);
  });

  it('issues one Files target generation for each same-item fragment request', () => {
    const { fixture } = setup();
    const attachmentComponent = fixture.debugElement.query(
      By.directive(WorkItemAttachmentsComponent)
    ).componentInstance as WorkItemAttachmentsComponent;
    const target = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('#files')!;
    const focus = spyOn(target, 'focus');
    const scrollIntoView = spyOn(target, 'scrollIntoView');

    expect(fixture.componentInstance.filesTargetGeneration()).toBeNull();
    expect(attachmentComponent.focusWhenSettled()).toBeNull();

    routeFragment.next('files');
    fixture.detectChanges();
    const firstGeneration = fixture.componentInstance.filesTargetGeneration();

    expect(firstGeneration).toBe(1);
    expect(attachmentComponent.focusWhenSettled()).toBe(firstGeneration);
    expect(focus).toHaveBeenCalledOnceWith({ preventScroll: true });
    expect(scrollIntoView).toHaveBeenCalledOnceWith({ block: 'start' });

    routeFragment.next('files');
    fixture.detectChanges();
    expect(fixture.componentInstance.filesTargetGeneration()).toBe(firstGeneration);
    expect(focus).toHaveBeenCalledTimes(1);

    routeFragment.next(null);
    fixture.detectChanges();
    expect(fixture.componentInstance.filesTargetGeneration()).toBeNull();

    routeFragment.next('files');
    fixture.detectChanges();
    expect(fixture.componentInstance.filesTargetGeneration()).toBe(2);
    expect(focus).toHaveBeenCalledTimes(2);
  });

  it('renews the Files target when route reuse changes the work item id', () => {
    routeFragment.next('files');
    const { fixture, http } = setup();
    const firstGeneration = fixture.componentInstance.filesTargetGeneration();
    const nextDetail: WorkItemDetailDto = {
      ...detail,
      id: blockedWorkItemId,
      displayKey: 'WT-5',
      title: 'Build detail controls',
      comments: [],
      labels: []
    };

    routeParamMap.next(convertToParamMap({ workItemId: blockedWorkItemId }));
    fixture.detectChanges();

    expect(fixture.componentInstance.filesTargetGeneration()).toBe(2);
    expect(fixture.componentInstance.filesTargetGeneration()).not.toBe(firstGeneration);
    expect((fixture.nativeElement as HTMLElement).querySelector('#files')).toBeNull();

    http.expectOne(`/api/work-items/${blockedWorkItemId}`).flush(nextDetail);
    http.expectOne(`/api/work-items/${blockedWorkItemId}/watchers`).flush(unwatchedState);
    http.expectOne(`/api/projects/${projectId}`).flush(activeProject);
    http.expectOne(`/api/projects/${projectId}/labels`).flush([]);
    http.expectOne(`/api/projects/${projectId}/milestones?includeArchived=true`).flush([]);
    http.expectOne(`/api/projects/${projectId}/cycles?includeArchived=true`).flush([]);
    fixture.detectChanges();
    http.expectOne(`/api/work-items/${blockedWorkItemId}/attachments`).flush(emptyAttachmentList);
    fixture.detectChanges();

    const attachmentComponent = fixture.debugElement.query(
      By.directive(WorkItemAttachmentsComponent)
    ).componentInstance as WorkItemAttachmentsComponent;
    expect(attachmentComponent.workItemId()).toBe(blockedWorkItemId);
    expect(attachmentComponent.focusWhenSettled()).toBe(2);
    expect((fixture.nativeElement as HTMLElement).querySelector('#files')).not.toBeNull();
  });

  it('keeps parent and child navigation current across same-route transitions', () => {
    const { fixture, http } = setup();
    const compiled = fixture.nativeElement as HTMLElement;
    const addChildLink = [...compiled.querySelectorAll<HTMLAnchorElement>('a')].find(
      (link) => link.textContent?.trim() === 'Add child work item'
    );

    expect(addChildLink?.getAttribute('href')).toBe(
      `/projects/${projectId}/work-items/new?parentWorkItemId=${workItemId}&returnUrl=%2Fwork-items%2F${workItemId}`
    );

    const childDetail: WorkItemDetailDto = {
      ...detail,
      id: blockedWorkItemId,
      itemNumber: 5,
      displayKey: 'WT-5',
      title: 'Build detail controls',
      parent: {
        id: detail.id,
        projectId,
        displayKey: detail.displayKey,
        title: detail.title,
        type: detail.type,
        status: detail.status
      },
      comments: [],
      labels: []
    };

    routeParamMap.next(convertToParamMap({ workItemId: blockedWorkItemId }));
    fixture.detectChanges();
    http.expectOne(`/api/work-items/${blockedWorkItemId}`).flush(childDetail);
    http.expectOne(`/api/work-items/${blockedWorkItemId}/watchers`).flush(unwatchedState);
    http.expectOne(`/api/projects/${projectId}`).flush(activeProject);
    http.expectOne(`/api/projects/${projectId}/labels`).flush([]);
    http.expectOne(`/api/projects/${projectId}/milestones?includeArchived=true`).flush([]);
    http.expectOne(`/api/projects/${projectId}/cycles?includeArchived=true`).flush([]);
    fixture.detectChanges();
    http.expectOne(`/api/work-items/${blockedWorkItemId}/attachments`).flush(emptyAttachmentList);
    fixture.detectChanges();

    const parentLink = compiled.querySelector<HTMLAnchorElement>('app-work-item-parent-context a');
    expect(parentLink?.textContent?.trim()).toBe('WT-3 Implement detail surface');
    expect(parentLink?.getAttribute('href')).toBe(
      `/work-items/${workItemId}?returnUrl=%2Fwork-items%2F${blockedWorkItemId}`
    );
    expect(compiled.textContent).not.toContain('Add child work item');

    routeParamMap.next(convertToParamMap({ workItemId }));
    fixture.detectChanges();
    http.expectOne(`/api/work-items/${workItemId}`).flush(detail);
    http.expectOne(`/api/work-items/${workItemId}/watchers`).flush(unwatchedState);
    http.expectOne(`/api/projects/${projectId}`).flush(activeProject);
    http.expectOne(`/api/projects/${projectId}/labels`).flush([]);
    http.expectOne(`/api/projects/${projectId}/milestones?includeArchived=true`).flush([]);
    http.expectOne(`/api/projects/${projectId}/cycles?includeArchived=true`).flush([]);
    fixture.detectChanges();
    http.expectOne(`/api/work-items/${workItemId}/attachments`).flush(emptyAttachmentList);
    fixture.detectChanges();

    expect(compiled.textContent).toContain('Add child work item');
    expect(compiled.querySelector('app-work-item-parent-context')).toBeNull();
  });

  it('adds a blocker by posting from the selected blocker to the current work item', () => {
    const { fixture, http } = setup();
    const blocker = candidate({
      id: blockerWorkItemId,
      displayKey: 'WT-4',
      title: 'Finish API contract'
    });
    fixture.componentInstance.relationshipCandidates.set([blocker]);
    fixture.componentInstance.relationshipForm.patchValue({ kind: 'blocked_by' });
    fixture.componentInstance.selectRelationshipCandidate(blocker);
    fixture.componentInstance.addRelationship();

    const request = http.expectOne(`/api/work-items/${blockerWorkItemId}/relationships`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      relationshipType: 'blocks',
      targetWorkItemId: workItemId
    });
    request.flush({});

    const refresh = http.expectOne(`/api/work-items/${workItemId}`);
    refresh.flush({
      ...detail,
      relationships: {
        ...detail.relationships,
        blockedBy: [
          relationshipItem({
            id: '10000000-0000-4000-8000-000000000801',
            workItemId: blockerWorkItemId,
            displayKey: 'WT-4',
            title: 'Finish API contract',
            direction: 'inbound'
          })
        ],
        dependencyBlocked: true,
        openBlockerCount: 1
      }
    } satisfies WorkItemDetailDto);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('WT-4 Finish API contract');
    expect(fixture.componentInstance.isAddingRelationship()).toBeFalse();
  });

  it('adds blocked work by posting from the current work item to the selected target', () => {
    const { fixture, http } = setup();
    fixture.componentInstance.relationshipForm.patchValue({
      kind: 'blocks',
      targetWorkItemId: blockedWorkItemId
    });
    fixture.componentInstance.addRelationship();

    const request = http.expectOne(`/api/work-items/${workItemId}/relationships`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      relationshipType: 'blocks',
      targetWorkItemId: blockedWorkItemId
    });
    request.flush({});

    const refresh = http.expectOne(`/api/work-items/${workItemId}`);
    refresh.flush(detail);
  });

  it('adds related work with the symmetric relationship type', () => {
    const { fixture, http } = setup();
    fixture.componentInstance.relationshipForm.patchValue({
      kind: 'related',
      targetWorkItemId: relatedWorkItemId
    });
    fixture.componentInstance.addRelationship();

    const request = http.expectOne(`/api/work-items/${workItemId}/relationships`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      relationshipType: 'relates_to',
      targetWorkItemId: relatedWorkItemId
    });
    request.flush({});

    const refresh = http.expectOne(`/api/work-items/${workItemId}`);
    refresh.flush(detail);
  });

  it('removes a relationship and refreshes detail', () => {
    const relationship = relationshipItem({
      id: '10000000-0000-4000-8000-000000000801',
      workItemId: blockerWorkItemId,
      displayKey: 'WT-4',
      title: 'Finish API contract',
      direction: 'inbound'
    });
    const { fixture, http } = setup({
      workItem: {
        ...detail,
        relationships: {
          ...detail.relationships,
          blockedBy: [relationship],
          dependencyBlocked: true,
          openBlockerCount: 1
        }
      }
    });

    fixture.componentInstance.removeRelationship(relationship);

    const request = http.expectOne(`/api/work-items/${workItemId}/relationships/${relationship.id}`);
    expect(request.request.method).toBe('DELETE');
    request.flush(null);

    const refresh = http.expectOne(`/api/work-items/${workItemId}`);
    refresh.flush(detail);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('No blockers linked.');
  });

  it('prevents already-linked relationship candidates from being selected', () => {
    const linked = candidate({
      id: blockerWorkItemId,
      displayKey: 'WT-4',
      title: 'Finish API contract'
    });
    const { fixture } = setup({
      workItem: {
        ...detail,
        relationships: {
          ...detail.relationships,
          blockedBy: [
            relationshipItem({
              id: '10000000-0000-4000-8000-000000000801',
              workItemId: blockerWorkItemId,
              displayKey: 'WT-4',
              title: 'Finish API contract',
              direction: 'inbound'
            })
          ]
        }
      }
    });

    fixture.componentInstance.relationshipCandidates.set([linked]);
    fixture.componentInstance.selectRelationshipCandidate(linked);
    fixture.detectChanges();

    expect(fixture.componentInstance.relationshipForm.getRawValue().targetWorkItemId).toBe('');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Linked');
  });

  it('edits a comment inline and refreshes activity', () => {
    const { fixture, http } = setup();
    const comment = detail.comments[0];

    fixture.componentInstance.startEditComment(comment);
    fixture.detectChanges();
    fixture.componentInstance.editCommentForm.setValue({ body: 'Updated implementation note.' });
    fixture.componentInstance.saveComment(comment);

    const update = http.expectOne(`/api/comments/${comment.id}`);
    expect(update.request.method).toBe('PATCH');
    expect(update.request.body).toEqual({ body: 'Updated implementation note.' });
    update.flush({
      ...comment,
      body: 'Updated implementation note.',
      isEdited: true,
      editedAt: '2026-07-03T13:00:00.000Z',
      updatedAt: '2026-07-03T13:00:00.000Z'
    });

    const refresh = http.expectOne(`/api/work-items/${workItemId}`);
    refresh.flush({
      ...detail,
      comments: [
        {
          ...comment,
          body: 'Updated implementation note.',
          isEdited: true,
          editedAt: '2026-07-03T13:00:00.000Z',
          updatedAt: '2026-07-03T13:00:00.000Z'
        }
      ],
      activity: [
        {
          id: '10000000-0000-4000-8000-000000000603',
          workspaceId: owner.workspaceId,
          projectId,
          workItemId,
          actor: owner,
          eventType: 'comment.edited',
          summary: 'Comment edited.',
          previousValue: null,
          newValue: null,
          metadata: { commentId: comment.id },
          createdAt: '2026-07-03T13:00:00.000Z'
        },
        ...detail.activity
      ]
    } satisfies WorkItemDetailDto);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Updated implementation note.');
    expect(compiled.textContent).toContain('Edited');
    expect(compiled.textContent).toContain('Comment edited.');
    expect(fixture.componentInstance.editingCommentId()).toBeNull();
  });

  it('deletes a comment after confirmation and renders the tombstone', () => {
    const { fixture, http } = setup();
    const comment = detail.comments[0];

    fixture.componentInstance.confirmDeleteComment(comment);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Delete this comment?');

    fixture.componentInstance.deleteComment(comment);

    const request = http.expectOne(`/api/comments/${comment.id}`);
    expect(request.request.method).toBe('DELETE');
    request.flush({
      ...comment,
      body: '',
      isDeleted: true,
      deletedAt: '2026-07-03T13:15:00.000Z',
      deletedBy: owner,
      updatedAt: '2026-07-03T13:15:00.000Z'
    });

    const refresh = http.expectOne(`/api/work-items/${workItemId}`);
    refresh.flush({
      ...detail,
      comments: [
        {
          ...comment,
          body: '',
          isDeleted: true,
          deletedAt: '2026-07-03T13:15:00.000Z',
          deletedBy: owner,
          updatedAt: '2026-07-03T13:15:00.000Z'
        }
      ],
      activity: [
        {
          id: '10000000-0000-4000-8000-000000000604',
          workspaceId: owner.workspaceId,
          projectId,
          workItemId,
          actor: owner,
          eventType: 'comment.deleted',
          summary: 'Comment deleted.',
          previousValue: null,
          newValue: null,
          metadata: { commentId: comment.id },
          createdAt: '2026-07-03T13:15:00.000Z'
        },
        ...detail.activity
      ]
    } satisfies WorkItemDetailDto);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Comment deleted by Avery Owner');
    expect(compiled.textContent).toContain('Comment deleted.');
    expect(fixture.componentInstance.confirmingDeleteCommentId()).toBeNull();
  });

  it('renders deleted comment tombstones from loaded detail', () => {
    const deletedDetail: WorkItemDetailDto = {
      ...detail,
      comments: [
        {
          ...detail.comments[0],
          body: '',
          isDeleted: true,
          deletedAt: '2026-07-03T13:15:00.000Z',
          deletedBy: contributor,
          updatedAt: '2026-07-03T13:15:00.000Z'
        }
      ]
    };
    const { fixture } = setup({ workItem: deletedDetail });
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.textContent).toContain('Comment deleted by Case Contributor');
    expect(compiled.textContent).not.toContain('Initial implementation note.');
    expect(fixture.componentInstance.canModifyComment(deletedDetail.comments[0])).toBeFalse();
  });

  it('hides comment edit and delete actions when the local actor cannot modify the comment', () => {
    TestBed.inject(CurrentUserService).selectMember(contributor.id);
    const { fixture } = setup();
    const compiled = fixture.nativeElement as HTMLElement;
    const buttonLabels = Array.from(compiled.querySelectorAll('button')).map((button) =>
      button.textContent?.trim()
    );

    expect(fixture.componentInstance.canModifyComment(detail.comments[0])).toBeFalse();
    expect(buttonLabels).not.toContain('Edit');
    expect(buttonLabels).not.toContain('Delete');
  });

  it('prevents contributors from reopening terminal work items', () => {
    TestBed.inject(CurrentUserService).selectMember(contributor.id);
    const terminalDetail: WorkItemDetailDto = {
      ...detail,
      status: 'done'
    };
    const { fixture, http } = setup({ workItem: terminalDetail });

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain(
      'Only owners and maintainers can reopen done or canceled work items.'
    );
    expect(compiled.querySelector<HTMLSelectElement>('.status-form select')?.disabled).toBeTrue();

    fixture.componentInstance.statusForm.setValue({ status: 'ready' });
    fixture.componentInstance.transitionStatus();
    fixture.detectChanges();

    expect(compiled.textContent).toContain(
      'Only owners and maintainers can reopen done or canceled work items.'
    );
    http.expectNone(`/api/work-items/${workItemId}/transitions`);
  });

  it('shows a recoverable error when comment edit is rejected', () => {
    const { fixture, http } = setup();
    const comment = detail.comments[0];

    fixture.componentInstance.startEditComment(comment);
    fixture.componentInstance.editCommentForm.setValue({ body: 'Rejected update.' });
    fixture.componentInstance.saveComment(comment);

    const update = http.expectOne(`/api/comments/${comment.id}`);
    update.flush(
      { error: { code: 'FORBIDDEN', message: 'Rejected.' } },
      { status: 403, statusText: 'Forbidden' }
    );
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('The comment could not be updated.');

    fixture.componentInstance.clearCommentMutationError();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain(
      'The comment could not be updated.'
    );
  });

  it('updates editable fields and project labels through the patch endpoint', () => {
    const { fixture, http } = setup();
    fixture.componentInstance.detailForm.patchValue({
      title: 'Updated detail surface',
      description: 'Updated description.',
      type: 'story',
      priority: 'urgent',
      assigneeId: owner.id,
      milestoneId: nextMilestone.id
    });
    fixture.componentInstance.toggleLabel(frontendLabelId, {
      target: { checked: true }
    } as unknown as Event);
    fixture.componentInstance.updateWorkItem();

    const request = http.expectOne(`/api/work-items/${workItemId}`);
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({
      title: 'Updated detail surface',
      description: 'Updated description.',
      type: 'story',
      priority: 'urgent',
      assigneeId: owner.id,
      milestoneId: nextMilestone.id,
      cycleId: activeCycle.id,
      labelIds: [labelId, frontendLabelId]
    });
    request.flush({
      ...detail,
      title: 'Updated detail surface',
      description: 'Updated description.',
      type: 'story',
      priority: 'urgent',
      assignee: owner
    } satisfies WorkItemDetailDto);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Updated detail surface');
  });

  it('keeps the current inactive assignee selectable and marks inactive references', () => {
    const inactiveDetail: WorkItemDetailDto = {
      ...detail,
      assignee: inactiveMember,
      reporter: inactiveMember,
      comments: [
        {
          ...detail.comments[0],
          author: inactiveMember,
          deletedBy: inactiveMember
        }
      ],
      activity: [
        {
          ...detail.activity[0],
          actor: inactiveMember
        }
      ]
    };
    const { fixture, http } = setup({ workItem: inactiveDetail });

    const compiled = fixture.nativeElement as HTMLElement;
    const assigneeOptions = [
      ...compiled.querySelectorAll<HTMLSelectElement>('select[formcontrolname="assigneeId"] option')
    ].map((option) => option.textContent?.trim());
    expect(assigneeOptions).toContain('Avery Owner');
    expect(assigneeOptions).toContain('Case Contributor');
    expect(assigneeOptions).toContain('Riley Former (inactive)');
    expect(compiled.textContent).toContain('Reporter');
    expect(compiled.textContent).toContain('Riley Former (inactive)');
    expect(compiled.textContent).toContain('Inactive');

    fixture.componentInstance.updateWorkItem();
    const request = http.expectOne(`/api/work-items/${workItemId}`);
    expect(request.request.body.assigneeId).toBe(inactiveMember.id);
    request.flush(inactiveDetail);
  });

  it('shows archived attached labels without offering them as active assignments', () => {
    const archivedDetail: WorkItemDetailDto = {
      ...detail,
      labels: [
        ...detail.labels,
        {
          id: archivedLabelId,
          name: 'legacy',
          color: '#64748b',
          isArchived: true,
          archivedAt: '2026-07-03T12:00:00.000Z'
        }
      ]
    };
    const fixture = TestBed.createComponent(WorkItemDetailPageComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne(`/api/work-items/${workItemId}`).flush(archivedDetail);
    http.expectOne(`/api/work-items/${workItemId}/watchers`).flush(unwatchedState);
    http.expectOne(`/api/projects/${projectId}`).flush(activeProject);
    http.expectOne(`/api/projects/${projectId}/labels`).flush([
      { id: frontendLabelId, name: 'frontend', color: '#2563eb', isArchived: false, archivedAt: null },
      { id: labelId, name: 'backend', color: '#059669', isArchived: false, archivedAt: null }
    ]);
    http.expectOne(`/api/projects/${projectId}/milestones?includeArchived=true`).flush([activeMilestone]);
    http.expectOne(`/api/projects/${projectId}/cycles?includeArchived=true`).flush([activeCycle]);
    fixture.detectChanges();
    http.expectOne(`/api/work-items/${workItemId}/attachments`).flush(emptyAttachmentList);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('legacy');
    expect(fixture.componentInstance.assignableLabels().map((label) => label.id)).not.toContain(
      archivedLabelId
    );

    fixture.componentInstance.updateWorkItem();
    const request = http.expectOne(`/api/work-items/${workItemId}`);
    expect(request.request.body.labelIds).toEqual([labelId, archivedLabelId]);
    expect(request.request.body.milestoneId).toEqual(activeMilestone.id);
    request.flush(archivedDetail);
  });

  it('disables write controls and skips write calls when the project is archived', () => {
    const fixture = TestBed.createComponent(WorkItemDetailPageComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne(`/api/work-items/${workItemId}`).flush(detail);
    http.expectOne(`/api/work-items/${workItemId}/watchers`).flush(watchedState);
    http.expectOne(`/api/projects/${projectId}`).flush(archivedProject);
    http.expectOne(`/api/projects/${projectId}/labels`).flush([
      { id: frontendLabelId, name: 'frontend', color: '#2563eb', isArchived: false, archivedAt: null },
      { id: labelId, name: 'backend', color: '#059669', isArchived: false, archivedAt: null }
    ]);
    http.expectOne(`/api/projects/${projectId}/milestones?includeArchived=true`).flush([activeMilestone]);
    http.expectOne(`/api/projects/${projectId}/cycles?includeArchived=true`).flush([activeCycle]);
    fixture.detectChanges();
    http.expectOne(`/api/work-items/${workItemId}/attachments`).flush({
      ...emptyAttachmentList,
      permissions: { canUpload: false }
    });
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Archived project');
    expect(compiled.textContent).toContain(
      'Parent changes are unavailable while this project is archived.'
    );
    expect(compiled.textContent).not.toContain('Add child work item');
    expect(compiled.querySelector('button[type="submit"]')?.hasAttribute('disabled')).toBeTrue();
    expect(compiled.querySelector('input[type="checkbox"]')?.hasAttribute('disabled')).toBeTrue();
    expect(fixture.componentInstance.relationshipForm.disabled).toBeTrue();

    fixture.componentInstance.detailForm.patchValue({ title: 'Archived edit attempt' });
    fixture.componentInstance.updateWorkItem();
    fixture.componentInstance.statusForm.setValue({ status: 'done' });
    fixture.componentInstance.transitionStatus();
    fixture.componentInstance.commentForm.setValue({ body: 'Archived comment attempt.' });
    fixture.componentInstance.addComment();
    fixture.componentInstance.relationshipForm.patchValue({ targetWorkItemId: blockedWorkItemId });
    fixture.componentInstance.addRelationship();

    http.expectNone(`/api/work-items/${workItemId}`);
    http.expectNone(`/api/work-items/${workItemId}/transitions`);
    http.expectNone(`/api/work-items/${workItemId}/comments`);
    http.expectNone(`/api/work-items/${workItemId}/relationships`);
  });

  it('shows workflow errors when a status transition is rejected', () => {
    const { fixture, http } = setup();
    fixture.componentInstance.statusForm.setValue({ status: 'done' });
    fixture.componentInstance.transitionStatus();

    const request = http.expectOne(`/api/work-items/${workItemId}/transitions`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ status: 'done' });
    request.flush(
      { error: { code: 'WORKFLOW_TRANSITION_ERROR', message: 'Rejected.' } },
      { status: 409, statusText: 'Conflict' }
    );
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'The requested status transition was rejected.'
    );
  });

  it('adds a comment and refreshes comments and activity', () => {
    const { fixture, http } = setup();
    fixture.componentInstance.commentForm.setValue({ body: 'New detail comment.' });
    fixture.componentInstance.addComment();

    const commentRequest = http.expectOne(`/api/work-items/${workItemId}/comments`);
    expect(commentRequest.request.method).toBe('POST');
    expect(commentRequest.request.body).toEqual({ body: 'New detail comment.' });
    commentRequest.flush({
      id: '10000000-0000-4000-8000-000000000502',
      workspaceId: owner.workspaceId,
      projectId,
      workItemId,
      author: owner,
      body: 'New detail comment.',
      mentions: [],
      isEdited: false,
      isDeleted: false,
      editedAt: null,
      deletedAt: null,
      deletedBy: null,
      createdAt: '2026-07-03T13:00:00.000Z',
      updatedAt: '2026-07-03T13:00:00.000Z'
    });

    const refreshRequest = http.expectOne(`/api/work-items/${workItemId}`);
    refreshRequest.flush({
      ...detail,
      comments: [
        ...detail.comments,
        {
          id: '10000000-0000-4000-8000-000000000502',
          workspaceId: owner.workspaceId,
          projectId,
          workItemId,
          author: owner,
          body: 'New detail comment.',
          mentions: [],
          isEdited: false,
          isDeleted: false,
          editedAt: null,
          deletedAt: null,
          deletedBy: null,
          createdAt: '2026-07-03T13:00:00.000Z',
          updatedAt: '2026-07-03T13:00:00.000Z'
        }
      ],
      activity: [
        {
          id: '10000000-0000-4000-8000-000000000602',
          workspaceId: owner.workspaceId,
          projectId,
          workItemId,
          actor: owner,
          eventType: 'comment.added',
          summary: 'Comment added.',
          previousValue: null,
          newValue: null,
          metadata: { commentId: '10000000-0000-4000-8000-000000000502' },
          createdAt: '2026-07-03T13:00:00.000Z'
        },
        ...detail.activity
      ]
    } satisfies WorkItemDetailDto);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('New detail comment.');
    expect(compiled.textContent).toContain('Comment added.');
  });

  it('creates a comment with selected mention member ids and renders returned mentions', () => {
    const { fixture, http } = setup();
    fixture.componentInstance.commentForm.setValue({ body: 'Mentioning a collaborator.' });
    fixture.componentInstance.addMentionMember(contributor.id);
    fixture.componentInstance.addComment();

    const commentRequest = http.expectOne(`/api/work-items/${workItemId}/comments`);
    expect(commentRequest.request.method).toBe('POST');
    expect(commentRequest.request.body).toEqual({
      body: 'Mentioning a collaborator.',
      mentionMemberIds: [contributor.id]
    });
    commentRequest.flush({
      id: '10000000-0000-4000-8000-000000000503',
      workspaceId: owner.workspaceId,
      projectId,
      workItemId,
      author: owner,
      body: 'Mentioning a collaborator.',
      mentions: [contributor],
      isEdited: false,
      isDeleted: false,
      editedAt: null,
      deletedAt: null,
      deletedBy: null,
      createdAt: '2026-07-03T13:10:00.000Z',
      updatedAt: '2026-07-03T13:10:00.000Z'
    });

    const refreshRequest = http.expectOne(`/api/work-items/${workItemId}`);
    refreshRequest.flush({
      ...detail,
      comments: [
        ...detail.comments,
        {
          id: '10000000-0000-4000-8000-000000000503',
          workspaceId: owner.workspaceId,
          projectId,
          workItemId,
          author: owner,
          body: 'Mentioning a collaborator.',
          mentions: [contributor],
          isEdited: false,
          isDeleted: false,
          editedAt: null,
          deletedAt: null,
          deletedBy: null,
          createdAt: '2026-07-03T13:10:00.000Z',
          updatedAt: '2026-07-03T13:10:00.000Z'
        }
      ]
    } satisfies WorkItemDetailDto);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(fixture.componentInstance.selectedMentionMemberIds()).toEqual([]);
    expect(compiled.textContent).toContain('Mentioning a collaborator.');
    expect(compiled.textContent).toContain('@Case Contributor');
  });
});
