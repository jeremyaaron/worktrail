import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
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
import { DraftDepartureCoordinator } from '../../core/navigation/draft-departure-coordinator';
import { DraftConfirmationService } from '../../core/navigation/draft-confirmation.service';
import { WorkItemAttachmentsComponent } from './components/work-item-attachments.component';
import { WorkItemDetailEditorComponent } from './components/work-item-detail-editor.component';
import { WorkItemDetailPageComponent } from './work-item-detail-page.component';
import { AuthoredContentEditorComponent } from '../../shared/authored-content/authored-content-editor.component';

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
  descriptionFormat: 'plain_text',
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
      bodyFormat: 'plain_text',
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
  http
    .expectOne(`/api/work-items/${workItemId}/watchers`)
    .flush(input.watchState ?? unwatchedState);
  http.expectOne(`/api/projects/${projectId}`).flush(project);
  http.expectOne(`/api/projects/${projectId}/labels`).flush([
    {
      id: frontendLabelId,
      name: 'frontend',
      color: '#2563eb',
      isArchived: false,
      archivedAt: null
    },
    { id: labelId, name: 'backend', color: '#059669', isArchived: false, archivedAt: null }
  ]);
  http
    .expectOne(`/api/projects/${projectId}/milestones?includeArchived=true`)
    .flush([activeMilestone, nextMilestone]);
  http.expectOne(`/api/projects/${projectId}/cycles?includeArchived=true`).flush([activeCycle]);
  fixture.detectChanges();
  http.expectOne(`/api/work-items/${workItem.id}/attachments`).flush(emptyAttachmentList);
  fixture.detectChanges();
  return { fixture, http };
}

function finishReload(
  fixture: ComponentFixture<WorkItemDetailPageComponent>,
  http: HttpTestingController,
  workItem = detail
): void {
  http.expectOne(`/api/work-items/${workItem.id}`).flush(workItem);
  http.expectOne(`/api/work-items/${workItem.id}/watchers`).flush(unwatchedState);
  http.expectOne(`/api/projects/${projectId}`).flush(activeProject);
  http.expectOne(`/api/projects/${projectId}/labels`).flush([]);
  http.expectOne(`/api/projects/${projectId}/milestones?includeArchived=true`).flush([]);
  http.expectOne(`/api/projects/${projectId}/cycles?includeArchived=true`).flush([]);
  fixture.detectChanges();
  http.expectOne(`/api/work-items/${workItem.id}/attachments`).flush(emptyAttachmentList);
  fixture.detectChanges();
}

function openDetails(fixture: ComponentFixture<WorkItemDetailPageComponent>): void {
  const button = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('button[aria-controls="edit-work-item"]');
  button?.click();
  fixture.detectChanges();
}

function previewDescription(fixture: ComponentFixture<WorkItemDetailPageComponent>): void {
  const buttons = [
    ...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>(
      'app-authored-content-editor button'
    )
  ];
  buttons.find((button) => button.textContent?.trim() === 'Preview')!.click();
  fixture.detectChanges();
}

describe('WorkItemDetailPageComponent', () => {
  for (const fragment of ['discussion', 'dependencies', 'history']) {
    it('targets a committed loaded section and opens its disclosure: ' + fragment, async () => {
      routeFragment.next(fragment);
      const { fixture } = setup();
      await fixture.whenStable();
      const root = fixture.nativeElement as HTMLElement;
      const target = root.querySelector<HTMLElement>('#' + fragment)!;
      expect(document.activeElement).toBe(target);
      if (fragment === 'history') expect(target.querySelector<HTMLDetailsElement>('details')?.open).toBe(true);
      const focus = vi.spyOn(target, 'focus').mockImplementation(() => undefined);
      fixture.componentInstance.state.workItem.update(item => item ? { ...item, title: 'Refreshed fact' } : item);
      fixture.detectChanges();
      await fixture.whenStable();
      expect(focus).not.toHaveBeenCalled();
    });
  }

  it('targets an identified comment after render and falls back for missing/deleted comments', async () => {
    routeFragment.next('comment-' + detail.comments[0].id);
    const { fixture } = setup();
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    expect(document.activeElement).toBe(root.querySelector('#comment-' + detail.comments[0].id));
    routeFragment.next('comment-missing-id');
    fixture.detectChanges(); await fixture.whenStable();
    expect(document.activeElement).toBe(root.querySelector('#discussion'));
    fixture.componentInstance.state.workItem.update(item => item ? { ...item, comments: item.comments.map(comment => ({ ...comment, isDeleted: true, body: '' })) } : item);
    routeFragment.next('comment-' + detail.comments[0].id);
    fixture.detectChanges(); await fixture.whenStable();
    expect(document.activeElement).toBe(root.querySelector('#discussion'));
    expect(root.querySelector('article.comment app-authored-content-viewer')).toBeNull();
  });

  it('rejects recursive return metadata and keeps the record project fallback', () => {
    routeQueryParams = { returnUrl: '/work-items/a?returnUrl=%2Finbox' };
    const { fixture } = setup();
    expect(fixture.componentInstance.state.returnTarget().path).toBe('/projects/' + projectId + '/work-items');
  });

  it('carries the same bounded origin through all dependency groups', () => {
    routeQueryParams = { returnUrl: '/work-items?status=blocked&page=3&pageSize=10' };
    const item = relationshipItem({ id: 'relationship', workItemId: blockedWorkItemId, displayKey: 'WT-5', title: 'Linked work', direction: 'outbound' });
    const { fixture } = setup({ workItem: { ...detail, relationships: { ...detail.relationships, blockedBy: [item], blocks: [item], related: [item] } } });
    const links = [...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLAnchorElement>('#dependencies a')];
    expect(links.length).toBe(3);
    for (const link of links) {
      const url = new URL(link.href);
      expect(url.searchParams.get('returnUrl')).toBe(routeQueryParams['returnUrl']);
      expect(url.searchParams.get('returnTo')).toBe('/work-items/' + workItemId);
    }
  });

  it('renders plain empty/loading watcher messages without template implementation names', () => {
    const { fixture } = setup({ watchState: { isWatchedByCurrentActor: false, watcherCount: 0, watchers: [] } });
    const panel = (fixture.nativeElement as HTMLElement).querySelector('.watch-panel')!;
    expect(panel.textContent).toContain('No active watchers.');
    expect(panel.textContent).not.toContain('state.');
    fixture.componentInstance.watch.isWatchLoading.set(true);
    fixture.detectChanges();
    expect(panel.textContent).toContain('Loading watchers...');
    expect(panel.textContent).not.toContain('state.');
  });
  for (const departure of ['route', 'destroy']) {
    it('does not emit a late editor-close focus request after ' + departure, async () => {
      const { fixture, http } = setup();
      openDetails(fixture);
      const editor = fixture.debugElement.query(By.directive(WorkItemDetailEditorComponent))
        .componentInstance as WorkItemDetailEditorComponent;
      let resolve!: (value: boolean) => void;
      vi.spyOn(fixture.componentInstance.state, 'requestDiscardDetailChanges').mockReturnValue(new Promise<boolean>(done => { resolve = done; }));
      const closed = vi.fn<() => void>().mockName('closed');
      editor.closed.subscribe(closed);
      const pending = editor.cancel();
      if (departure === 'route') {
        routeParamMap.next(convertToParamMap({ workItemId: blockedWorkItemId }));
        fixture.detectChanges();
        finishReload(fixture, http, { ...detail, id: blockedWorkItemId });
      } else {
        fixture.destroy();
      }
      resolve(true);
      await pending;
      expect(closed).not.toHaveBeenCalled();
    });
  }
  it('starts read-first with a named project, independent status and compact disclosures', () => {
    const { fixture } = setup();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('#detail-title')).toBeNull();
    expect(root.querySelector('#comment-body')).not.toBeNull();
    expect(root.querySelector('.project-link')?.textContent).toContain(activeProject.name);
    expect(root.querySelector<HTMLSelectElement>('.status-form select')?.value).toBe(detail.status);
    expect(root.querySelector<HTMLDetailsElement>('.hierarchy details')?.open).toBe(false);
    expect(root.querySelector<HTMLDetailsElement>('#dependencies details')?.open).toBe(false);
    expect(root.querySelector<HTMLDetailsElement>('#history details')?.open).toBe(false);
    for (const id of ['discussion', 'files', 'dependencies', 'history']) {
      expect(root.querySelector('#' + id)).not.toBeNull();
      expect(root.querySelector('.section-nav a[href$="#' + id + '"]')).not.toBeNull();
    }
    openDetails(fixture);
    expect(root.querySelector<HTMLInputElement>('#detail-estimate')?.value).toBe('5');
    expect(root.querySelector<HTMLInputElement>('#detail-due-date')?.value).toBe(detail.dueDate!);
  });


  it('rejects incomplete native number/date input rather than clearing persisted planning facts', () => {
    const { fixture, http } = setup();
    const state = fixture.componentInstance.state;
    for (const field of ['estimatePoints', 'dueDate'] as const) {
      state.validatePlanningInput(field, true);
      state.updateWorkItem();
      expect(state.showPlanningError(field)).toBe(true);
      http.expectNone(request => request.method === 'PATCH');
      state.validatePlanningInput(field, false);
    }
    expect(state.detailForm.valid).toBe(true);
  });

  for (const estimate of [0, 13, null]) {
    it('saves the numeric/null estimate contract: ' + estimate, () => {
      const { fixture, http } = setup();
      openDetails(fixture);
      const input = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>('#detail-estimate')!;
      input.value = estimate === null ? '' : String(estimate);
      input.dispatchEvent(new Event('input'));
      fixture.componentInstance.state.updateWorkItem();
      const update = http.expectOne('/api/work-items/' + workItemId);
      expect(update.request.body.estimatePoints).toBe(estimate);
      expect(update.request.body.dueDate).toBe(detail.dueDate);
      update.flush({ ...detail, estimatePoints: estimate });
      expect(fixture.componentInstance.state.detailForm.controls.estimatePoints.value).toBe(estimate);
    });
  }

  for (const value of [-1, 1.5, 2147483648, NaN, '3']) {
    it('rejects invalid estimates before PATCH: ' + value, () => {
      const { fixture, http } = setup();
      fixture.componentInstance.state.detailForm.controls.estimatePoints.setValue(value as number);
      fixture.componentInstance.state.updateWorkItem();
      expect(fixture.componentInstance.state.showPlanningError('estimatePoints')).toBe(true);
      expect(fixture.componentInstance.state.isUpdating()).toBe(false);
      http.expectNone(request => request.method === 'PATCH');
    });
  }

  for (const date of ['2027-02-29', '2026-04-31', '0000-01-01', 'not-a-date']) {
    it('rejects invalid calendar dates before PATCH: ' + date, () => {
      const { fixture, http } = setup();
      fixture.componentInstance.state.detailForm.controls.dueDate.setValue(date);
      fixture.componentInstance.state.updateWorkItem();
      expect(fixture.componentInstance.state.showPlanningError('dueDate')).toBe(true);
      http.expectNone(request => request.method === 'PATCH');
    });
  }

  for (const date of ['2028-02-29', '']) {
    it('sets or clears due date without timezone conversion: ' + date, () => {
      const { fixture, http } = setup();
      fixture.componentInstance.state.detailForm.controls.dueDate.setValue(date);
      fixture.componentInstance.state.updateWorkItem();
      const update = http.expectOne('/api/work-items/' + workItemId);
      expect(update.request.body.dueDate).toBe(date === '' ? null : date);
      update.flush({ ...detail, dueDate: date === '' ? null : date });
    });
  }

  it('retains planning fields, comment source and recipients on failure, and accepts an unchanged save', () => {
    const { fixture, http } = setup();
    openDetails(fixture);
    const { state, discussion } = fixture.componentInstance;
    discussion.commentForm.controls.bodyContent.setValue({ source: '  **Keep reply**\n', format: 'markdown_v1' });
    discussion.addMentionMember(contributorId);
    state.detailForm.patchValue({ estimatePoints: 0, dueDate: '' });
    state.updateWorkItem();
    http.expectOne('/api/work-items/' + workItemId).flush({}, { status: 403, statusText: 'Forbidden' });
    expect(state.detailForm.getRawValue()).toEqual(expect.objectContaining({ estimatePoints: 0, dueDate: '' }));
    expect(state.isEditing()).toBe(true);
    expect(state.detailForm.enabled).toBe(true);
    expect(discussion.selectedMentionMemberIds()).toEqual([contributorId]);
    state.updateWorkItem();
    http.expectOne('/api/work-items/' + workItemId).flush({ ...detail, estimatePoints: 0, dueDate: null });
    state.updateWorkItem();
    const unchanged = http.expectOne('/api/work-items/' + workItemId);
    expect(unchanged.request.body.estimatePoints).toBe(0);
    expect(unchanged.request.body.dueDate).toBeNull();
    expect(Object.hasOwn(unchanged.request.body, 'description')).toBe(false);
    unchanged.flush({ ...detail, estimatePoints: 0, dueDate: null });
    expect(discussion.commentForm.controls.bodyContent.value.source).toBe('  **Keep reply**\n');
    expect(discussion.selectedMentionMemberIds()).toEqual([contributorId]);
    expect(state.saveNotice()).toBe('Changes saved.');
  });

  it('keeps attachments mounted and independent discussion drafts when cancelling fields', async () => {
    const { fixture } = setup();
    openDetails(fixture);
    const { state, discussion } = fixture.componentInstance;
    const files = fixture.debugElement.query(By.directive(WorkItemAttachmentsComponent)).componentInstance;
    const confirmation = TestBed.inject(DraftConfirmationService);
    const confirm = vi.spyOn(confirmation, 'confirm').mockResolvedValue(false);
    state.detailForm.controls.estimatePoints.setValue(0);
    discussion.commentForm.controls.bodyContent.setValue({ source: 'Keep reply', format: 'plain_text' });
    await state.requestDiscardDetailChanges();
    expect(state.isEditing()).toBe(true);
    expect(state.detailForm.controls.estimatePoints.value).toBe(0);
    confirm.mockResolvedValue(true);
    await state.requestDiscardDetailChanges();
    fixture.detectChanges();
    expect(state.isEditing()).toBe(false);
    expect(state.detailForm.controls.estimatePoints.value).toBe(detail.estimatePoints);
    expect(discussion.commentForm.controls.bodyContent.value.source).toBe('Keep reply');
    expect(fixture.debugElement.query(By.directive(WorkItemAttachmentsComponent)).componentInstance).toBe(files);
    expect((fixture.nativeElement as HTMLElement).querySelector('#detail-title')).toBeNull();
  });

  it('does not let an older field-save DTO undo a completed status change', () => {
    const { fixture, http } = setup();
    const state = fixture.componentInstance.state;
    state.detailForm.controls.title.setValue('Changed title');
    state.updateWorkItem();
    const fieldSave = http.expectOne('/api/work-items/' + workItemId);
    state.statusForm.setValue({ status: 'blocked' });
    state.transitionStatus();
    http.expectOne('/api/work-items/' + workItemId + '/transitions')
      .flush({ ...detail, status: 'blocked', updatedAt: '2026-07-05T12:00:00.000Z' });
    fieldSave.flush({ ...detail, title: 'Changed title' });
    expect(state.workItem()?.status).toBe('blocked');
    expect(state.statusForm.controls.status.value).toBe('blocked');
    expect(state.workItem()?.title).toBe('Changed title');
  });

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

  for (const source of ['', ' \r\n\t', 'x'.repeat(10_001)]) {
    it(`validates new comment source before POST (${source.length} code units)`, () => {
      const { fixture, http } = setup();
      const component = fixture.componentInstance;
      expect(component.discussion.commentForm.controls.bodyContent.value).toEqual({
        source: '',
        format: 'markdown_v1'
      });
      component.discussion.commentForm.controls.bodyContent.setValue({ source, format: 'markdown_v1' });
      component.discussion.addComment();
      fixture.detectChanges();
      expect(component.discussion.commentForm.invalid).toBe(true);
      expect(component.discussion.isCommenting()).toBe(false);
      const root = fixture.nativeElement as HTMLElement;
      expect(root.querySelector('#comment-body')?.getAttribute('aria-invalid')).toBe('true');
      expect(root.querySelector('#comment-body-error')?.textContent).toContain(
        source.length > 10_000 ? '10,000' : 'required'
      );
      http.expectNone((request) => request.method === 'POST');
    });
  }

  for (const format of ['plain_text', 'markdown_v1'] as const) {
    it(`preserves ${format} creation source and explicit mentions through failure and matching success`, () => {
      const { fixture, http } = setup();
      const component = fixture.componentInstance;
      const pair = { source: '  **Source** @Avery Owner WT-3 `@Case`\r\n', format };
      component.discussion.commentForm.controls.bodyContent.setValue(pair);
      component.discussion.commentForm.controls.bodyContent.markAsDirty();
      component.discussion.addMentionMember(contributor.id);
      fixture.detectChanges();
      const editorElement = (fixture.nativeElement as HTMLElement).querySelector(
        'form.comment-form app-authored-content-editor'
      )!;
      const preview = [...editorElement.querySelectorAll<HTMLButtonElement>('button')].find(
        (button) => button.textContent?.trim() === 'Preview'
      )!;
      preview.click();
      fixture.detectChanges();
      component.discussion.addComment();
      component.discussion.addComment();
      expect(component.discussion.commentForm.disabled).toBe(true);
      component.discussion.removeMentionMember(contributor.id);
      component.discussion.addMentionMember(owner.id);
      const post = http.expectOne(`/api/work-items/${workItemId}/comments`);
      expect(post.request.body).toEqual({
        body: pair.source,
        bodyFormat: format,
        mentionMemberIds: [contributor.id]
      });
      post.flush({}, { status: 500, statusText: 'Failure' });
      fixture.detectChanges();
      expect(component.discussion.isCommenting()).toBe(false);
      expect(component.discussion.commentForm.enabled).toBe(true);
      expect(component.discussion.commentForm.dirty).toBe(true);
      expect(component.discussion.commentForm.controls.bodyContent.value).toEqual(pair);
      expect(component.discussion.selectedMentionMemberIds()).toEqual([contributor.id]);
      expect(editorElement.querySelector('[aria-label="Add comment preview"]')).not.toBeNull();
      component.discussion.addComment();
      const retry = http.expectOne(`/api/work-items/${workItemId}/comments`);
      expect(retry.request.body).toEqual(post.request.body);
      const created = {
        ...detail.comments[0],
        id: 'new-comment',
        body: pair.source,
        bodyFormat: format,
        mentions: [contributor]
      };
      retry.flush(created);
      const refresh = http.expectOne(`/api/work-items/${workItemId}`);
      expect(
        component.state.workItem()?.comments.some((comment) => comment.id === created.id)
      ).toBe(true);
      expect(component.discussion.isCommenting()).toBe(false);
      expect(component.discussion.commentForm.controls.bodyContent.value).toEqual({
        source: '',
        format: 'markdown_v1'
      });
      expect(component.discussion.selectedMentionMemberIds()).toEqual([]);
      expect(component.discussion.commentForm.pristine).toBe(true);
      refresh.flush({ ...detail, comments: [...detail.comments, created] });
      fixture.detectChanges();
      expect(editorElement.querySelector('[aria-label="Add comment preview"]')).toBeNull();
    });
  }

  it('does not infer recipients from typed names, Markdown links, code, or display keys', () => {
    const { fixture, http } = setup();
    const source = '@Case Contributor [Avery](https://example.com) `@Case` WT-3';
    fixture.componentInstance.discussion.commentForm.controls.bodyContent.setValue({
      source,
      format: 'markdown_v1'
    });
    fixture.componentInstance.discussion.addComment();
    const post = http.expectOne(`/api/work-items/${workItemId}/comments`);
    expect(post.request.body).toEqual({ body: source, bodyFormat: 'markdown_v1' });
    post.flush({ ...detail.comments[0], body: source, bodyFormat: 'markdown_v1' });
    http.expectOne(`/api/work-items/${workItemId}`).flush(detail);
  });

  it('loads exact legacy source/format, permits deliberate conversion, and cancels without persisting it', () => {
    const source = '  # Legacy\r\n**not bold** <b>literal</b>  ';
    const comment = { ...detail.comments[0], body: source };
    const { fixture, http } = setup({ workItem: { ...detail, comments: [comment] } });
    const component = fixture.componentInstance;
    const row = (fixture.nativeElement as HTMLElement).querySelector('article.comment')!;
    expect(row.querySelector('strong')?.textContent).toBe(owner.name);
    expect(
      row.querySelector('app-authored-content-viewer strong, app-authored-content-viewer h3')
    ).toBeNull();
    component.discussion.startEditComment(comment);
    fixture.detectChanges();
    expect(component.discussion.editCommentForm.controls.bodyContent.value).toEqual({
      source,
      format: 'plain_text'
    });
    const format = row.querySelector<HTMLSelectElement>(`#comment-edit-${comment.id}-format`)!;
    format.value = 'markdown_v1';
    format.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(component.discussion.editCommentForm.dirty).toBe(true);
    expect(component.discussion.editCommentForm.controls.bodyContent.value).toEqual({
      source,
      format: 'markdown_v1'
    });
    component.discussion.cancelEditComment();
    fixture.detectChanges();
    expect(component.discussion.editingCommentId()).toBeNull();
    expect(row.querySelector('app-authored-content-editor')).toBeNull();
    expect(row.querySelector('app-authored-content-viewer')?.textContent).toBe(source);
    http.expectNone((request) => request.method === 'PATCH');
  });

  for (const source of ['x'.repeat(10_001), ' \r\n']) {
    it(`grandfathers unchanged legacy comments but validates conversion (${source.length} code units)`, () => {
      const comment = { ...detail.comments[0], body: source };
      const { fixture, http } = setup({ workItem: { ...detail, comments: [comment] } });
      const component = fixture.componentInstance;
      component.discussion.startEditComment(comment);
      expect(component.discussion.editCommentForm.valid).toBe(true);
      component.discussion.saveComment(comment);
      const update = http.expectOne(`/api/comments/${comment.id}`);
      expect(update.request.body).toEqual({ body: source, bodyFormat: 'plain_text' });
      update.flush(comment);
      http.expectOne(`/api/work-items/${workItemId}`).flush({ ...detail, comments: [comment] });
      component.discussion.startEditComment(comment);
      component.discussion.editCommentForm.controls.bodyContent.setValue({ source, format: 'markdown_v1' });
      component.discussion.saveComment(comment);
      expect(component.discussion.editCommentForm.invalid).toBe(true);
      expect(component.discussion.savingCommentId()).toBeNull();
      http.expectNone((request) => request.method === 'PATCH');
    });
  }

  it('submits an explicit format-only edit without changing mentions or resending mention ids', () => {
    const comment = {
      ...detail.comments[0],
      body: '  **Now formatted**\r\n',
      mentions: [contributor]
    };
    const { fixture, http } = setup({ workItem: { ...detail, comments: [comment] } });
    const component = fixture.componentInstance;
    component.discussion.startEditComment(comment);
    component.discussion.editCommentForm.controls.bodyContent.setValue({
      source: comment.body,
      format: 'markdown_v1'
    });
    component.discussion.saveComment(comment);
    const update = http.expectOne(`/api/comments/${comment.id}`);
    expect(update.request.body).toEqual({ body: comment.body, bodyFormat: 'markdown_v1' });
    const updated = {
      ...comment,
      bodyFormat: 'markdown_v1' as const,
      isEdited: true,
      editedAt: comment.updatedAt
    };
    update.flush(updated);
    expect(component.discussion.editingCommentId()).toBeNull();
    expect(component.discussion.savingCommentId()).toBeNull();
    http.expectOne(`/api/work-items/${workItemId}`).flush({ ...detail, comments: [updated] });
    fixture.detectChanges();
    const row = (fixture.nativeElement as HTMLElement).querySelector('article.comment')!;
    expect(row.querySelector('app-authored-content-viewer strong')?.textContent).toBe(
      'Now formatted'
    );
    expect(row.textContent).toContain('@Case Contributor');
    expect(row.textContent).toContain('Edited');
  });

  it('preserves failed edit source, format, preview and other drafts, then recovers pending state', () => {
    const { fixture, http } = setup();
    const component = fixture.componentInstance;
    const comment = detail.comments[0];
    const pair = { source: '  ## Keep edit\n', format: 'markdown_v1' as const };
    component.discussion.startEditComment(comment);
    component.discussion.editCommentForm.controls.bodyContent.setValue(pair);
    component.discussion.editCommentForm.controls.bodyContent.markAsDirty();
    component.discussion.commentForm.controls.bodyContent.setValue({
      source: 'Composer draft',
      format: 'plain_text'
    });
    component.discussion.addMentionMember(contributor.id);
    fixture.detectChanges();
    const editElement = (fixture.nativeElement as HTMLElement).querySelector(
      'form.comment-edit-form'
    )!;
    [...editElement.querySelectorAll<HTMLButtonElement>('button')]
      .find((button) => button.textContent?.trim() === 'Preview')!
      .click();
    fixture.detectChanges();
    component.discussion.saveComment(comment);
    component.discussion.saveComment(comment);
    expect(component.discussion.editCommentForm.disabled).toBe(true);
    http
      .expectOne(`/api/comments/${comment.id}`)
      .flush({}, { status: 403, statusText: 'Forbidden' });
    fixture.detectChanges();
    expect(component.discussion.editCommentForm.enabled).toBe(true);
    expect(component.discussion.editCommentForm.dirty).toBe(true);
    expect(component.discussion.editCommentForm.controls.bodyContent.value).toEqual(pair);
    expect(component.discussion.commentForm.controls.bodyContent.value.source).toBe('Composer draft');
    expect(component.discussion.selectedMentionMemberIds()).toEqual([contributor.id]);
    expect(editElement.querySelector('[aria-label="Edit comment preview"]')).not.toBeNull();
    component.discussion.saveComment(comment);
    const retry = http.expectOne(`/api/comments/${comment.id}`);
    expect(retry.request.body).toEqual({ body: pair.source, bodyFormat: pair.format });
    const updated = { ...comment, body: pair.source, bodyFormat: pair.format };
    retry.flush(updated);
    http.expectOne(`/api/work-items/${workItemId}`).flush({ ...detail, comments: [updated] });
    expect(component.discussion.editingCommentId()).toBeNull();
  });

  it('renders deleted rows before content or editors, even with retained source and an edit id', () => {
    const comment = {
      ...detail.comments[0],
      body: '# Retained secret <script>x</script>',
      bodyFormat: 'markdown_v1' as const,
      isDeleted: true,
      deletedAt: detail.updatedAt,
      deletedBy: owner,
      mentions: [contributor]
    };
    const { fixture } = setup({ workItem: { ...detail, comments: [comment] } });
    fixture.componentInstance.discussion.editingCommentId.set(comment.id);
    fixture.detectChanges();
    const row = (fixture.nativeElement as HTMLElement).querySelector('article.comment')!;
    expect(
      row.querySelector(
        'app-authored-content-viewer, app-authored-content-editor, .comment-mentions'
      )
    ).toBeNull();
    expect(row.textContent).toContain('Comment deleted');
    expect(row.textContent).not.toContain('Retained secret');
  });

  it('keeps formatted archived discussion readable while preventing new/edit/delete authoring', () => {
    const comment = {
      ...detail.comments[0],
      body: '# History\n**Readable**',
      bodyFormat: 'markdown_v1' as const
    };
    const { fixture, http } = setup({
      project: archivedProject,
      workItem: { ...detail, comments: [comment] }
    });
    const component = fixture.componentInstance;
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('article.comment app-authored-content-viewer h3')?.textContent).toBe(
      'History'
    );
    expect(root.querySelector<HTMLTextAreaElement>('#comment-body')?.disabled).toBe(true);
    expect(root.querySelector<HTMLSelectElement>('#comment-body-format')?.disabled).toBe(true);
    component.discussion.startEditComment(comment);
    component.discussion.confirmDeleteComment(comment);
    component.discussion.addComment();
    expect(component.discussion.editingCommentId()).toBeNull();
    expect(component.discussion.confirmingDeleteCommentId()).toBeNull();
    http.expectNone((request) => request.method !== 'GET');
  });

  it('preserves both comment editors and description drafts through activity, relationship and detail-save refreshes', () => {
    const { fixture, http } = setup();
    openDetails(fixture);
    const component = fixture.componentInstance;
    const comment = detail.comments[0];
    component.discussion.startEditComment(comment);
    const edit = { source: '**Edit draft**', format: 'markdown_v1' as const };
    const create = { source: ' New draft ', format: 'plain_text' as const };
    component.discussion.editCommentForm.controls.bodyContent.setValue(edit);
    component.discussion.commentForm.controls.bodyContent.setValue(create);
    component.discussion.addMentionMember(contributor.id);
    component.state.detailForm.controls.title.setValue('Other title');
    const editIdentity = component.discussion.editCommentIdentity();
    const createIdentity = component.discussion.newCommentIdentity();
    component.watch.refreshAttachmentActivity();
    http.expectOne(`/api/work-items/${workItemId}/activity`).flush([]);
    component.relationships.relationshipForm.patchValue({ kind: 'blocks', targetWorkItemId: blockedWorkItemId });
    component.relationships.addRelationship();
    http.expectOne(`/api/work-items/${workItemId}/relationships`).flush({});
    http.expectOne(`/api/work-items/${workItemId}`).flush(detail);
    component.state.updateWorkItem();
    http.expectOne(`/api/work-items/${workItemId}`).flush({ ...detail, title: 'Other title' });
    expect(component.discussion.editCommentForm.controls.bodyContent.value).toEqual(edit);
    expect(component.discussion.commentForm.controls.bodyContent.value).toEqual(create);
    expect(component.discussion.editingCommentId()).toBe(comment.id);
    expect(component.discussion.selectedMentionMemberIds()).toEqual([contributor.id]);
    expect(component.discussion.editCommentIdentity()).toBe(editIdentity);
    expect(component.discussion.newCommentIdentity()).toBe(createIdentity);
  });

  for (const outcome of ['success', 'error'] as const) {
    it(`ignores a canceled save ${outcome} when the same comment has a newer edit`, () => {
      const { fixture, http } = setup();
      const component = fixture.componentInstance;
      const comment = detail.comments[0];
      component.discussion.startEditComment(comment);
      component.discussion.editCommentForm.controls.bodyContent.setValue({
        source: 'Old save',
        format: 'markdown_v1'
      });
      component.discussion.saveComment(comment);
      const oldSave = http.expectOne(`/api/comments/${comment.id}`);
      component.discussion.cancelEditComment();
      component.discussion.startEditComment(comment);
      const pair = { source: 'New save', format: 'plain_text' as const };
      component.discussion.editCommentForm.controls.bodyContent.setValue(pair);
      component.discussion.saveComment(comment);
      const newSave = http.expectOne(`/api/comments/${comment.id}`);
      if (outcome === 'success') oldSave.flush({ ...comment, body: 'Old save' });
      else oldSave.flush({}, { status: 500, statusText: 'Failure' });
      expect(component.discussion.savingCommentId()).toBe(comment.id);
      expect(component.discussion.editingCommentId()).toBe(comment.id);
      expect(component.discussion.editCommentForm.controls.bodyContent.value).toEqual(pair);
      expect(component.discussion.commentMutationError()).toBeNull();
      http.expectNone(`/api/work-items/${workItemId}`);
      newSave.flush({ ...comment, body: pair.source, bodyFormat: pair.format });
      http.expectOne(`/api/work-items/${workItemId}`).flush(detail);
      expect(component.discussion.editingCommentId()).toBeNull();
    });
  }

  it('ignores an old successful-edit refresh after a newer edit opens on the same route', () => {
    const { fixture, http } = setup();
    const component = fixture.componentInstance;
    const comment = detail.comments[0];
    component.discussion.startEditComment(comment);
    component.discussion.editCommentForm.controls.bodyContent.setValue({
      source: 'First edit',
      format: 'markdown_v1'
    });
    component.discussion.saveComment(comment);
    const updated = { ...comment, body: 'First edit', bodyFormat: 'markdown_v1' as const };
    http.expectOne(`/api/comments/${comment.id}`).flush(updated);
    const oldRefresh = http.expectOne(`/api/work-items/${workItemId}`);
    component.discussion.startEditComment(updated);
    component.discussion.editCommentForm.controls.bodyContent.setValue({
      source: 'Second draft',
      format: 'plain_text'
    });
    oldRefresh.flush(detail);
    expect(component.discussion.editingCommentId()).toBe(comment.id);
    expect(component.discussion.editCommentForm.controls.bodyContent.value.source).toBe('Second draft');
    expect(component.state.workItem()?.comments[0].body).toBe('First edit');
  });

  it('does not let an old delete callback clear a newer edit or refresh its state', () => {
    const { fixture, http } = setup();
    const component = fixture.componentInstance;
    const comment = detail.comments[0];
    component.discussion.confirmDeleteComment(comment);
    component.discussion.deleteComment(comment);
    const oldDelete = http.expectOne(`/api/comments/${comment.id}`);
    component.discussion.cancelDeleteComment();
    component.discussion.startEditComment(comment);
    component.discussion.editCommentForm.controls.bodyContent.setValue({
      source: 'New edit',
      format: 'markdown_v1'
    });
    oldDelete.flush({ ...comment, isDeleted: true, body: '' });
    expect(component.discussion.editingCommentId()).toBe(comment.id);
    expect(component.discussion.editCommentForm.controls.bodyContent.value.source).toBe('New edit');
    expect(component.state.workItem()?.comments[0].isDeleted).toBe(false);
    http.expectNone(`/api/work-items/${workItemId}`);
  });

  it('recovers from a discussion refresh failure without reposting or clearing a newer composer draft', () => {
    const { fixture, http } = setup();
    const component = fixture.componentInstance;
    component.discussion.commentForm.controls.bodyContent.setValue({
      source: 'Created source',
      format: 'markdown_v1'
    });
    component.discussion.addComment();
    const created = {
      ...detail.comments[0],
      id: 'new-comment',
      body: 'Created source',
      bodyFormat: 'markdown_v1' as const
    };
    http.expectOne(`/api/work-items/${workItemId}/comments`).flush(created);
    const refresh = http.expectOne(`/api/work-items/${workItemId}`);
    const pair = { source: '  Next draft\n', format: 'plain_text' as const };
    component.discussion.commentForm.controls.bodyContent.setValue(pair);
    component.discussion.addMentionMember(contributor.id);
    refresh.flush({}, { status: 500, statusText: 'Failure' });
    fixture.detectChanges();
    expect(component.discussion.isCommenting()).toBe(false);
    expect(component.discussion.commentError()).toBeNull();
    expect(component.discussion.commentForm.controls.bodyContent.value).toEqual(pair);
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('article.comment:last-child')?.textContent).toContain(
      'Created source'
    );
    const panel = [...root.querySelectorAll('app-error-panel')].find((element) =>
      element.textContent?.includes('Discussion not refreshed')
    )!;
    panel.querySelector<HTMLButtonElement>('button')!.click();
    http
      .expectOne(`/api/work-items/${workItemId}`)
      .flush({ ...detail, comments: [...detail.comments, created] });
    expect(component.discussion.commentForm.controls.bodyContent.value).toEqual(pair);
    expect(component.discussion.selectedMentionMemberIds()).toEqual([contributor.id]);
    http.expectNone((request) => request.method === 'POST');
  });

  for (const action of ['create', 'edit', 'delete'] as const) {
    for (const outcome of ['success', 'error'] as const) {
      it(`rejects stale ${action} ${outcome} after item/actor changes`, () => {
        const { fixture, http } = setup();
        const component = fixture.componentInstance;
        const oldComment = detail.comments[0];
        if (action === 'create') {
          component.discussion.commentForm.controls.bodyContent.setValue({
            source: 'Old create',
            format: 'markdown_v1'
          });
          component.discussion.addComment();
        } else if (action === 'edit') {
          component.discussion.startEditComment(oldComment);
          component.discussion.editCommentForm.controls.bodyContent.setValue({
            source: 'Old edit',
            format: 'markdown_v1'
          });
          component.discussion.saveComment(oldComment);
        } else {
          component.discussion.confirmDeleteComment(oldComment);
          component.discussion.deleteComment(oldComment);
        }
        const oldRequest = http.expectOne(
          action === 'create'
            ? `/api/work-items/${workItemId}/comments`
            : `/api/comments/${oldComment.id}`
        );
        // Reuse the item route, changing both the item and actor before the old callback runs.
        routeParamMap.next(convertToParamMap({ workItemId: blockedWorkItemId }));
        TestBed.inject(CurrentUserService).selectMember(contributor.id);
        fixture.detectChanges();
        const loads = http.match(`/api/work-items/${blockedWorkItemId}`);
        const newComment = {
          ...oldComment,
          id: 'new-context-comment',
          workItemId: blockedWorkItemId,
          author: contributor
        };
        const newDetail = { ...detail, id: blockedWorkItemId, comments: [newComment] };
        // The pre-actor read is cancelled; only the current authorized read may initialize.
        expect(loads.some((load) => load.cancelled)).toBe(true);
        for (const load of loads) if (!load.cancelled) load.flush(newDetail);
        http.expectOne(`/api/work-items/${blockedWorkItemId}/watchers`).flush(unwatchedState);
        http.expectOne(`/api/projects/${projectId}`).flush(activeProject);
        http.expectOne(`/api/projects/${projectId}/labels`).flush([]);
        http.expectOne(`/api/projects/${projectId}/milestones?includeArchived=true`).flush([]);
        http.expectOne(`/api/projects/${projectId}/cycles?includeArchived=true`).flush([]);
        fixture.detectChanges();
        http
          .expectOne(`/api/work-items/${blockedWorkItemId}/attachments`)
          .flush(emptyAttachmentList);
        fixture.detectChanges();
        component.discussion.commentForm.controls.bodyContent.setValue({
          source: 'New composer',
          format: 'plain_text'
        });
        component.discussion.addMentionMember(owner.id);
        component.discussion.startEditComment(newComment);
        component.discussion.editCommentForm.controls.bodyContent.setValue({
          source: 'New inline draft',
          format: 'markdown_v1'
        });
        if (outcome === 'success')
          oldRequest.flush(
            action === 'delete' ? { ...oldComment, body: '', isDeleted: true } : oldComment
          );
        else oldRequest.flush({}, { status: 500, statusText: 'Failure' });
        expect(component.discussion.commentForm.controls.bodyContent.value.source).toBe('New composer');
        expect(component.discussion.editCommentForm.controls.bodyContent.value.source).toBe(
          'New inline draft'
        );
        expect(component.discussion.editingCommentId()).toBe(newComment.id);
        expect(component.discussion.selectedMentionMemberIds()).toEqual([owner.id]);
        expect(component.discussion.commentError()).toBeNull();
        expect(component.discussion.commentMutationError()).toBeNull();
        expect(component.discussion.isCommenting()).toBe(false);
        expect(component.discussion.savingCommentId()).toBeNull();
        expect(component.discussion.deletingCommentId()).toBeNull();
        http.expectNone(`/api/work-items/${blockedWorkItemId}`);
      });
    }
  }

  it('clears all comment draft state when the actor changes without changing the item', () => {
    const { fixture, http } = setup();
    const component = fixture.componentInstance;
    component.discussion.commentForm.controls.bodyContent.setValue({
      source: 'Owner create draft',
      format: 'plain_text'
    });
    component.discussion.addMentionMember(contributor.id);
    component.discussion.startEditComment(detail.comments[0]);
    component.discussion.editCommentForm.controls.bodyContent.setValue({
      source: 'Owner edit draft',
      format: 'markdown_v1'
    });
    fixture.detectChanges();
    const oldTextarea = (fixture.nativeElement as HTMLElement).querySelector<HTMLTextAreaElement>(
      '#comment-body'
    )!;
    TestBed.inject(CurrentUserService).selectMember(contributor.id);
    fixture.detectChanges();
    expect(component.discussion.commentForm.controls.bodyContent.value).toEqual({
      source: '',
      format: 'markdown_v1'
    });
    expect(component.discussion.selectedMentionMemberIds()).toEqual([]);
    expect(component.discussion.editingCommentId()).toBeNull();
    finishReload(fixture, http);
    oldTextarea.value = 'Stale input';
    oldTextarea.dispatchEvent(new Event('input'));
    expect(component.discussion.commentForm.controls.bodyContent.value.source).toBe('');
  });

  for (const outcome of ['success', 'error'] as const) {
    it(`rejects a discussion refresh ${outcome} after navigation returns to the same item`, () => {
      const { fixture, http } = setup();
      const component = fixture.componentInstance;
      component.discussion.refreshDiscussion();
      const oldRefresh = http.expectOne(`/api/work-items/${workItemId}`);
      routeParamMap.next(convertToParamMap({ workItemId: blockedWorkItemId }));
      const intermediate = http.expectOne(`/api/work-items/${blockedWorkItemId}`);
      routeParamMap.next(convertToParamMap({ workItemId }));
      fixture.detectChanges();
      finishReload(fixture, http);
      component.discussion.commentForm.controls.bodyContent.setValue({
        source: 'Fresh route draft',
        format: 'markdown_v1'
      });
      component.discussion.addMentionMember(contributor.id);
      expect(oldRefresh.cancelled).toBe(true);
      expect(intermediate.cancelled).toBe(true);
      expect(component.state.workItem()?.comments.length).toBe(1);
      expect(component.discussion.discussionRefreshError()).toBeNull();
      expect(component.discussion.commentForm.controls.bodyContent.value.source).toBe('Fresh route draft');
      expect(component.discussion.selectedMentionMemberIds()).toEqual([contributor.id]);
    });
  }

  it('does not let an older discussion read undo a newer successful edit', () => {
    const { fixture, http } = setup();
    const component = fixture.componentInstance;
    component.discussion.refreshDiscussion();
    const oldRefresh = http.expectOne(`/api/work-items/${workItemId}`);
    const comment = detail.comments[0];
    component.discussion.startEditComment(comment);
    component.discussion.editCommentForm.controls.bodyContent.setValue({
      source: 'Current saved body',
      format: 'markdown_v1'
    });
    component.discussion.saveComment(comment);
    const updated = { ...comment, body: 'Current saved body', bodyFormat: 'markdown_v1' as const };
    http.expectOne(`/api/comments/${comment.id}`).flush(updated);
    const latestRefresh = http.expectOne(`/api/work-items/${workItemId}`);
    latestRefresh.flush({ ...detail, comments: [updated] });
    oldRefresh.flush(detail);
    expect(component.state.workItem()?.comments[0].body).toBe('Current saved body');
  });

  it('does not let an older field-save DTO undo a successful comment write', () => {
    const { fixture, http } = setup();
    openDetails(fixture);
    const component = fixture.componentInstance;
    component.state.detailForm.controls.title.setValue('Changed title');
    component.state.updateWorkItem();
    const fieldSave = http.expectOne(`/api/work-items/${workItemId}`);
    const comment = detail.comments[0];
    component.discussion.startEditComment(comment);
    component.discussion.editCommentForm.controls.bodyContent.setValue({
      source: 'Newest comment', format: 'markdown_v1'
    });
    component.discussion.saveComment(comment);
    const updated = { ...comment, body: 'Newest comment', bodyFormat: 'markdown_v1' as const };
    http.expectOne(`/api/comments/${comment.id}`).flush(updated);
    const discussion = http.expectOne(`/api/work-items/${workItemId}`);
    fieldSave.flush({ ...detail, title: 'Changed title' });
    expect(component.state.workItem()?.comments[0].body).toBe('Newest comment');
    discussion.flush({ ...detail, comments: [updated] });
    expect(component.state.workItem()?.title).toBe('Changed title');
  });

  it('keeps legacy source literal until conversion, and discards an unsaved conversion', () => {
    const source = '  # Legacy\r\n**literal** <b>text</b>  ';
    const { fixture, http } = setup({ workItem: { ...detail, description: source } });
    openDetails(fixture);
    const component = fixture.componentInstance;
    const summary = (fixture.nativeElement as HTMLElement).querySelector(
      'app-work-item-detail-summary'
    )!;
    const editor = fixture.debugElement.query(By.directive(AuthoredContentEditorComponent))
      .componentInstance as AuthoredContentEditorComponent;
    expect(summary.querySelector('strong, b, h3')).toBeNull();
    expect(summary.textContent).toContain(source);
    expect(component.state.detailForm.controls.descriptionContent.value).toEqual({
      source,
      format: 'plain_text'
    });
    const format = (fixture.nativeElement as HTMLElement).querySelector<HTMLSelectElement>(
      '#detail-description-format'
    )!;
    format.value = 'markdown_v1';
    format.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(component.state.detailForm.dirty).toBe(true);
    expect(component.state.detailForm.controls.descriptionContent.value.source).toBe(source);
    expect(editor.value().format).toBe('markdown_v1');
    previewDescription(fixture);
    fixture.detectChanges();
    component.state.discardDetailChanges();
    fixture.detectChanges();
    expect(editor.mode()).toBe('edit');
    expect(component.state.detailForm.pristine).toBe(true);
    expect(component.state.detailForm.controls.descriptionContent.value).toEqual({
      source,
      format: 'plain_text'
    });
    http.expectNone((request) => request.method === 'PATCH');
  });

  it('omits both unchanged description fields, including normalized line-ending equivalents', () => {
    const { fixture, http } = setup({
      workItem: { ...detail, description: '  old\r\nsource\r  ' }
    });
    openDetails(fixture);
    fixture.componentInstance.state.detailForm.patchValue({
      title: 'Only title changed',
      descriptionContent: { source: '  old\nsource\n  ', format: 'plain_text' }
    });
    fixture.componentInstance.state.updateWorkItem();
    const update = http.expectOne(`/api/work-items/${workItemId}`);
    expect(Object.hasOwn(update.request.body, 'description')).toBe(false);
    expect(Object.hasOwn(update.request.body, 'descriptionFormat')).toBe(false);
    update.flush({ ...detail, title: 'Only title changed', description: '  old\r\nsource\r  ' });
    expect(fixture.componentInstance.state.detailForm.controls.descriptionContent.value.source).toBe(
      '  old\r\nsource\r  '
    );
    expect(fixture.componentInstance.state.detailForm.pristine).toBe(true);
  });

  it('sends a format-only conversion once and adopts the successful pair as its new baseline', () => {
    const source = '  **literal until saved**\n';
    const { fixture, http } = setup({ workItem: { ...detail, description: source } });
    openDetails(fixture);
    fixture.componentInstance.state.detailForm.controls.descriptionContent.setValue({
      source,
      format: 'markdown_v1'
    });
    fixture.componentInstance.state.updateWorkItem();
    const update = http.expectOne(`/api/work-items/${workItemId}`);
    expect(update.request.body.description).toBe(source);
    expect(update.request.body.descriptionFormat).toBe('markdown_v1');
    update.flush({ ...detail, description: source, descriptionFormat: 'markdown_v1' });
    fixture.detectChanges();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('app-work-item-detail-summary strong')
        ?.textContent
    ).toBe('literal until saved');
    fixture.componentInstance.state.updateWorkItem();
    const unchanged = http.expectOne(`/api/work-items/${workItemId}`);
    expect(Object.hasOwn(unchanged.request.body, 'description')).toBe(false);
    expect(Object.hasOwn(unchanged.request.body, 'descriptionFormat')).toBe(false);
    unchanged.flush({ ...detail, description: source, descriptionFormat: 'markdown_v1' });
  });

  it('allows unrelated edits to oversized legacy content but rejects conversion until shortened', () => {
    const source = 'x'.repeat(10_001);
    const { fixture, http } = setup({ workItem: { ...detail, description: source } });
    openDetails(fixture);
    const control = fixture.componentInstance.state.detailForm.controls.descriptionContent;
    expect(control.valid).toBe(true);
    fixture.componentInstance.state.detailForm.controls.title.setValue('Other edit');
    fixture.componentInstance.state.updateWorkItem();
    const update = http.expectOne(`/api/work-items/${workItemId}`);
    expect(Object.hasOwn(update.request.body, 'description')).toBe(false);
    update.flush({ ...detail, title: 'Other edit', description: source });
    control.setValue({ source, format: 'markdown_v1' });
    fixture.componentInstance.state.updateWorkItem();
    fixture.detectChanges();
    expect(control.hasError('authoredContentTooLong')).toBe(true);
    expect(
      (fixture.nativeElement as HTMLElement)
        .querySelector('#detail-description')
        ?.getAttribute('aria-invalid')
    ).toBe('true');
    http.expectNone((request) => request.method === 'PATCH');
    control.setValue({ source: 'shortened', format: 'markdown_v1' });
    expect(control.valid).toBe(true);
  });

  it('preserves the entire pair and preview after a failed save, and recovers pending state', () => {
    const { fixture, http } = setup();
    openDetails(fixture);
    const component = fixture.componentInstance;
    const draft = { source: '  # Keep my draft\n', format: 'markdown_v1' as const };
    component.state.detailForm.controls.descriptionContent.setValue(draft);
    component.state.detailForm.controls.descriptionContent.markAsDirty();
    fixture.detectChanges();
    const editor = fixture.debugElement.query(By.directive(AuthoredContentEditorComponent))
      .componentInstance as AuthoredContentEditorComponent;
    previewDescription(fixture);
    component.state.updateWorkItem();
    component.state.updateWorkItem();
    fixture.detectChanges();
    expect(component.state.detailForm.disabled).toBe(true);
    const update = http.expectOne(`/api/work-items/${workItemId}`);
    update.flush({}, { status: 500, statusText: 'Failure' });
    fixture.detectChanges();
    expect(component.state.isUpdating()).toBe(false);
    expect(component.state.detailForm.enabled).toBe(true);
    expect(component.state.detailForm.controls.descriptionContent.value).toEqual(draft);
    expect(component.state.detailForm.dirty).toBe(true);
    expect(editor.mode()).toBe('preview');
    component.state.updateWorkItem();
    const retry = http.expectOne(`/api/work-items/${workItemId}`);
    expect(retry.request.body.description).toBe(draft.source);
    retry.flush({ ...detail, description: draft.source, descriptionFormat: draft.format });
    fixture.detectChanges();
    expect(component.state.detailForm.pristine).toBe(true);
    expect(editor.mode()).toBe('edit');
  });

  it('does not reset description source, preview, or dirty state during attachment and discussion refreshes', () => {
    const { fixture, http } = setup();
    openDetails(fixture);
    const component = fixture.componentInstance;
    const draft = { source: '  **draft**\n', format: 'markdown_v1' as const };
    component.state.detailForm.controls.descriptionContent.setValue(draft);
    component.state.detailForm.controls.descriptionContent.markAsDirty();
    fixture.detectChanges();
    const editor = fixture.debugElement.query(By.directive(AuthoredContentEditorComponent))
      .componentInstance as AuthoredContentEditorComponent;
    previewDescription(fixture);
    const identity = component.state.descriptionEditorIdentity();
    component.watch.refreshAttachmentActivity();
    http.expectOne(`/api/work-items/${workItemId}/activity`).flush([]);
    component.discussion.commentForm.setValue({
      bodyContent: { source: 'Unrelated comment', format: 'markdown_v1' }
    });
    component.discussion.addComment();
    http.expectOne(`/api/work-items/${workItemId}/comments`).flush(detail.comments[0]);
    http.expectOne(`/api/work-items/${workItemId}`).flush(detail);
    fixture.detectChanges();
    expect(component.state.detailForm.controls.descriptionContent.value).toEqual(draft);
    expect(component.state.detailForm.dirty).toBe(true);
    expect(editor.mode()).toBe('preview');
    expect(component.state.descriptionEditorIdentity()).toBe(identity);
  });

  it('keeps description and comment drafts while applying parent and status changes', () => {
    const { fixture, http } = setup();
    openDetails(fixture);
    const component = fixture.componentInstance;
    const draft = { source: '  My source\n', format: 'markdown_v1' as const };
    component.state.detailForm.controls.descriptionContent.setValue(draft);
    component.discussion.commentForm.controls.bodyContent.setValue({
      source: 'Discussion draft',
      format: 'markdown_v1'
    });
    component.state.applyParentChange(detail);
    component.state.statusForm.setValue({ status: 'ready' });
    component.state.transitionStatus();
    http
      .expectOne(`/api/work-items/${workItemId}/transitions`)
      .flush({ ...detail, status: 'ready' });
    expect(component.state.detailForm.controls.descriptionContent.value).toEqual(draft);
    expect(component.discussion.commentForm.controls.bodyContent.value.source).toBe('Discussion draft');
    expect(component.state.statusForm.controls.status.value).toBe('ready');
  });

  it('does not let an older status response replace a newly saved description or its baseline', () => {
    const { fixture, http } = setup();
    openDetails(fixture);
    const component = fixture.componentInstance;
    component.state.statusForm.setValue({ status: 'ready' });
    component.state.transitionStatus();
    const status = http.expectOne(`/api/work-items/${workItemId}/transitions`);
    component.state.detailForm.controls.descriptionContent.setValue({
      source: 'New saved source',
      format: 'markdown_v1'
    });
    component.state.updateWorkItem();
    http
      .expectOne(`/api/work-items/${workItemId}`)
      .flush({ ...detail, description: 'New saved source', descriptionFormat: 'markdown_v1' });
    status.flush({ ...detail, status: 'ready' });
    expect(component.state.workItem()?.description).toBe('New saved source');
    expect(component.state.detailForm.controls.descriptionContent.value).toEqual({
      source: 'New saved source',
      format: 'markdown_v1'
    });
    component.state.updateWorkItem();
    const unchanged = http.expectOne(`/api/work-items/${workItemId}`);
    expect(Object.hasOwn(unchanged.request.body, 'description')).toBe(false);
    unchanged.flush({
      ...detail,
      status: 'ready',
      description: 'New saved source',
      descriptionFormat: 'markdown_v1'
    });
  });

  it('preserves description and comment drafts through relationship refreshes', () => {
    const { fixture, http } = setup();
    openDetails(fixture);
    const component = fixture.componentInstance;
    const draft = { source: '  **Relationship draft**\n', format: 'markdown_v1' as const };
    component.state.detailForm.controls.descriptionContent.setValue(draft);
    component.discussion.commentForm.controls.bodyContent.setValue({
      source: 'Comment draft',
      format: 'markdown_v1'
    });
    component.relationships.relationshipForm.patchValue({ kind: 'blocks', targetWorkItemId: blockedWorkItemId });
    component.relationships.addRelationship();
    http.expectOne(`/api/work-items/${workItemId}/relationships`).flush({});
    http.expectOne(`/api/work-items/${workItemId}`).flush(detail);
    expect(component.state.detailForm.controls.descriptionContent.value).toEqual(draft);
    expect(component.discussion.commentForm.controls.bodyContent.value.source).toBe('Comment draft');
    expect(component.relationships.isAddingRelationship()).toBe(false);
  });

  it('does not let an old save clear the pending state of a new route save', () => {
    const { fixture, http } = setup();
    openDetails(fixture);
    const component = fixture.componentInstance;
    component.state.updateWorkItem();
    const oldSave = http.expectOne(`/api/work-items/${workItemId}`);
    routeParamMap.next(convertToParamMap({ workItemId: blockedWorkItemId }));
    fixture.detectChanges();
    const nextDetail = { ...detail, id: blockedWorkItemId };
    finishReload(fixture, http, nextDetail);
    component.state.detailForm.controls.descriptionContent.setValue({
      source: 'New draft',
      format: 'markdown_v1'
    });
    component.state.updateWorkItem();
    const newSave = http.expectOne(`/api/work-items/${blockedWorkItemId}`);
    oldSave.flush(detail);
    expect(component.state.isUpdating()).toBe(true);
    expect(component.state.detailForm.disabled).toBe(true);
    expect(component.state.detailForm.controls.descriptionContent.value.source).toBe('New draft');
    newSave.flush({}, { status: 500, statusText: 'Failure' });
    expect(component.state.isUpdating()).toBe(false);
    expect(component.state.detailForm.enabled).toBe(true);
  });

  it('rejects old-actor responses even after returning to the same actor and item', () => {
    const { fixture, http } = setup();
    openDetails(fixture);
    const component = fixture.componentInstance;
    component.state.updateWorkItem();
    const oldSave = http.expectOne(`/api/work-items/${workItemId}`);
    const user = TestBed.inject(CurrentUserService);
    user.selectMember(contributor.id);
    fixture.detectChanges();
    finishReload(fixture, http);
    user.selectMember(owner.id);
    fixture.detectChanges();
    finishReload(fixture, http);
    component.state.detailForm.controls.descriptionContent.setValue({
      source: 'New owner draft',
      format: 'markdown_v1'
    });
    oldSave.flush({ ...detail, description: 'Obsolete owner response' });
    expect(component.state.workItem()?.description).toBe(detail.description);
    expect(component.state.detailForm.controls.descriptionContent.value.source).toBe('New owner draft');
  });

  it('ignores stale errors from superseded loads without breaking the current draft', () => {
    const { fixture, http } = setup();
    openDetails(fixture);
    fixture.componentInstance.state.loadWorkItem();
    const oldLoad = http.expectOne(`/api/work-items/${workItemId}`);
    fixture.componentInstance.state.loadWorkItem();
    fixture.detectChanges();
    finishReload(fixture, http);
    fixture.componentInstance.state.detailForm.controls.descriptionContent.setValue({
      source: 'Retain me',
      format: 'plain_text'
    });
    oldLoad.flush({}, { status: 500, statusText: 'Failure' });
    expect(fixture.componentInstance.state.loadError()).toBeNull();
    expect(fixture.componentInstance.state.isLoading()).toBe(false);
    expect(fixture.componentInstance.state.detailForm.controls.descriptionContent.value.source).toBe(
      'Retain me'
    );
  });

  for (const outcome of ['success', 'error'] as const) {
    it(`ignores a stale save ${outcome} after route reuse and return to the same item`, () => {
      const { fixture, http } = setup();
    openDetails(fixture);
      const component = fixture.componentInstance;
      component.state.detailForm.controls.descriptionContent.setValue({
        source: 'Old save',
        format: 'markdown_v1'
      });
      component.state.updateWorkItem();
      const oldSave = http.expectOne(`/api/work-items/${workItemId}`);
      routeParamMap.next(convertToParamMap({ workItemId: blockedWorkItemId }));
      const intermediate = http.expectOne(`/api/work-items/${blockedWorkItemId}`);
      routeParamMap.next(convertToParamMap({ workItemId }));
      fixture.detectChanges();
      finishReload(fixture, http);
      expect(intermediate.cancelled).toBe(true);
      component.state.detailForm.controls.descriptionContent.setValue({
        source: 'New draft',
        format: 'plain_text'
      });
      if (outcome === 'success') {
        oldSave.flush({ ...detail, description: 'Old save', descriptionFormat: 'markdown_v1' });
      } else {
        oldSave.flush({}, { status: 500, statusText: 'Failure' });
      }
      expect(component.state.workItem()?.description).toBe(detail.description);
      expect(component.state.detailForm.controls.descriptionContent.value.source).toBe('New draft');
      expect(component.state.isUpdating()).toBe(false);
      expect(component.state.updateError()).toBeNull();
    });
  }

  it('ignores superseded load responses for the same item', () => {
    const { fixture, http } = setup();
    openDetails(fixture);
    fixture.componentInstance.state.loadWorkItem();
    const oldLoad = http.expectOne(`/api/work-items/${workItemId}`);
    fixture.componentInstance.state.loadWorkItem();
    fixture.detectChanges();
    finishReload(fixture, http, {
      ...detail,
      description: 'Newest source',
      descriptionFormat: 'markdown_v1'
    });
    oldLoad.flush({ ...detail, description: 'Obsolete source' });
    expect(fixture.componentInstance.state.detailForm.controls.descriptionContent.value).toEqual({
      source: 'Newest source',
      format: 'markdown_v1'
    });
  });

  it('resets the editor on actor change and rejects the old actor save before the reload effect runs', () => {
    const { fixture, http } = setup();
    openDetails(fixture);
    const component = fixture.componentInstance;
    component.state.detailForm.controls.descriptionContent.setValue({
      source: 'Owner draft',
      format: 'markdown_v1'
    });
    component.state.updateWorkItem();
    const oldSave = http.expectOne(`/api/work-items/${workItemId}`);
    TestBed.inject(CurrentUserService).selectMember(contributor.id);
    oldSave.flush({ ...detail, description: 'Owner draft', descriptionFormat: 'markdown_v1' });
    expect(component.state.workItem()).toBeNull();
    fixture.detectChanges();
    expect(component.state.workItem()).toBeNull();
    expect(component.state.isUpdating()).toBe(false);
    expect(component.state.detailForm.controls.descriptionContent.value.source).toBe('');
    finishReload(fixture, http);
    expect(component.state.detailForm.controls.descriptionContent.value).toEqual({
      source: detail.description,
      format: 'plain_text'
    });
  });

  it('ignores late discussion mutations rather than refreshing or clearing another item draft', () => {
    const { fixture, http } = setup();
    const component = fixture.componentInstance;
    component.discussion.commentForm.setValue({
      bodyContent: { source: 'Old item comment', format: 'markdown_v1' }
    });
    component.discussion.addComment();
    const comment = http.expectOne(`/api/work-items/${workItemId}/comments`);
    routeParamMap.next(convertToParamMap({ workItemId: blockedWorkItemId }));
    fixture.detectChanges();
    finishReload(fixture, http, { ...detail, id: blockedWorkItemId });
    component.discussion.commentForm.setValue({
      bodyContent: { source: 'New item draft', format: 'markdown_v1' }
    });
    comment.flush(detail.comments[0]);
    expect(component.discussion.commentForm.controls.bodyContent.value.source).toBe('New item draft');
    http.expectNone(`/api/work-items/${blockedWorkItemId}`);
  });

  it('keeps formatted archived descriptions readable while disabling authoring', () => {
    const { fixture, http } = setup({
      project: archivedProject,
      workItem: {
        ...detail,
        description: '# Read only\n**visible**',
        descriptionFormat: 'markdown_v1'
      }
    });
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('app-work-item-detail-summary h2')?.textContent).toBe('Description');
    expect(root.querySelector('app-work-item-detail-summary h3')?.textContent).toBe('Read only');
    expect(root.querySelector('app-work-item-detail-summary strong')?.textContent).toBe('visible');
    expect(root.querySelector('#detail-description')).toBeNull();
    expect(root.querySelector<HTMLButtonElement>('button[aria-controls="edit-work-item"]')?.disabled).toBe(true);
    expect(fixture.componentInstance.state.detailForm.disabled).toBe(true);
    fixture.componentInstance.state.updateWorkItem();
    http.expectNone((request) => request.method === 'PATCH');
  });

  it('preserves the existing empty-description treatment below current-state facts', () => {
    const { fixture } = setup({
      workItem: { ...detail, description: '', descriptionFormat: 'markdown_v1' }
    });
    const summary = (fixture.nativeElement as HTMLElement).querySelector(
      'app-work-item-detail-summary'
    )!;
    expect(summary.textContent).toContain('No description provided.');
    expect(summary.querySelector('app-authored-content-viewer')).toBeNull();
    expect(
      summary
        .querySelector('.summary__facts')!
        .compareDocumentPosition(summary.querySelector('.summary__description')!) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it('renders work item detail, comments, and activity', () => {
    const { fixture } = setup();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.textContent).toContain('WT-3');
    expect(compiled.textContent).toContain('Implement detail surface');
    expect(compiled.textContent).toContain('Summary');
    expect(compiled.textContent).toContain('Act');
    expect(compiled.textContent).toContain('Discussion');
    expect(compiled.textContent).toContain('Dependencies');
    expect(compiled.textContent).toContain('Attachments');
    expect(compiled.textContent).toContain('History');
    expect(compiled.querySelector('#detail-title')).toBeNull();
    expect(compiled.textContent).toContain('backend');
    expect(compiled.textContent).toContain('v0.0.3');
    expect(compiled.textContent).toContain('Initial implementation note.');
    expect(compiled.textContent).toContain('Avery Owner created this work item.');
  });

  it('protects independent field and comment drafts and discards only the explicitly selected editor', async () => {
    const { fixture } = setup();
    openDetails(fixture);
    const component = fixture.componentInstance;
    const confirm = vi.spyOn(TestBed.inject(DraftConfirmationService), 'confirm').mockResolvedValue(false);
    const description = { source: '  **My draft**\n', format: 'markdown_v1' as const };
    const comment = { source: 'Comment draft', format: 'plain_text' as const };
    component.state.detailForm.controls.descriptionContent.setValue(description);
    component.discussion.commentForm.controls.bodyContent.setValue(comment);
    component.discussion.addMentionMember(contributor.id);
    expect(await component.state.requestDiscardDetailChanges()).toBe(false);
    expect(component.state.detailForm.controls.descriptionContent.value).toEqual(description);
    expect(component.discussion.commentForm.controls.bodyContent.value).toEqual(comment);
    expect(component.discussion.selectedMentionMemberIds()).toEqual([contributor.id]);
    expect(confirm.mock.lastCall![0]).toEqual(['Work item details']);
    confirm.mockResolvedValue(true);
    expect(await component.state.requestDiscardDetailChanges()).toBe(true);
    expect(component.state.detailForm.controls.descriptionContent.value.source).toBe(detail.description);
    expect(component.discussion.commentForm.controls.bodyContent.value).toEqual(comment);
    confirm.mockResolvedValue(false);
    expect(await TestBed.inject(DraftDepartureCoordinator).change(() => undefined)).toBe(false);
    expect(confirm.mock.lastCall![0]).toEqual(['New comment']);
  });

  it('does not mark unsaved fields as saved when a new comment succeeds', async () => {
    const { fixture, http } = setup();
    openDetails(fixture);
    const component = fixture.componentInstance;
    const confirm = vi.spyOn(TestBed.inject(DraftConfirmationService), 'confirm').mockResolvedValue(false);
    component.state.detailForm.controls.title.setValue('Still unsaved');
    component.discussion.commentForm.controls.bodyContent.setValue({ source: 'Posted comment', format: 'markdown_v1' });
    component.discussion.addComment();
    http.expectOne(`/api/work-items/${workItemId}/comments`).flush(detail.comments[0]);
    http.expectOne(`/api/work-items/${workItemId}`).flush(detail);
    expect(component.state.detailForm.controls.title.value).toBe('Still unsaved');
    expect(await TestBed.inject(DraftDepartureCoordinator).change(() => undefined)).toBe(false);
    expect(confirm.mock.lastCall![0]).toEqual(['Work item details']);
  });

  it('preserves inline comment source and format on Stay and treats a reverted editor as clean', async () => {
    const { fixture } = setup();
    const component = fixture.componentInstance;
    const comment = detail.comments[0];
    component.discussion.startEditComment(comment);
    const value = { source: 'Inline draft', format: 'markdown_v1' as const };
    component.discussion.editCommentForm.controls.bodyContent.setValue(value);
    const confirm = vi.spyOn(TestBed.inject(DraftConfirmationService), 'confirm').mockResolvedValue(false);
    expect(await component.discussion.requestCancelCommentEdit()).toBe(false);
    expect(component.discussion.editingCommentId()).toBe(comment.id);
    expect(component.discussion.editCommentForm.controls.bodyContent.value).toEqual(value);
    component.discussion.editCommentForm.controls.bodyContent.setValue({ source: comment.body, format: comment.bodyFormat });
    confirm.mockClear();
    expect(await component.discussion.requestCancelCommentEdit()).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
  });

  it('refreshes only activity when the attachment child reports a mutation', () => {
    const { fixture, http } = setup();
    const original = fixture.componentInstance.state.workItem();
    const originalWatchState = fixture.componentInstance.watch.watchState();
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

    const refreshed = fixture.componentInstance.state.workItem();
    expect(refreshed?.updatedAt).toBe(original?.updatedAt);
    expect(refreshed?.comments).toBe(original?.comments);
    expect(fixture.componentInstance.watch.watchState()).toBe(originalWatchState);
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

    compiled.querySelector<HTMLButtonElement>('.history-section app-error-panel button')?.click();
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

    fixture.componentInstance.watch.toggleWatch();
    const watchRequest = http.expectOne(`/api/work-items/${workItemId}/watch`);
    expect(watchRequest.request.method).toBe('PUT');
    watchRequest.flush(watchedState);
    fixture.detectChanges();

    expect(fixture.componentInstance.watch.watchState()?.isWatchedByCurrentActor).toBe(true);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('2 watching');

    fixture.componentInstance.watch.toggleWatch();
    const unwatchRequest = http.expectOne(`/api/work-items/${workItemId}/watch`);
    expect(unwatchRequest.request.method).toBe('DELETE');
    unwatchRequest.flush(unwatchedState);
    fixture.detectChanges();

    expect(fixture.componentInstance.watch.watchState()?.isWatchedByCurrentActor).toBe(false);
    expect(
      (fixture.nativeElement as HTMLElement)
        .querySelector<HTMLButtonElement>('.watch-panel button')
        ?.textContent?.trim()
    ).toBe('Watch');
  });

  it('selects and removes comment mention members', () => {
    const { fixture } = setup();

    fixture.componentInstance.discussion.addMentionMember(contributor.id);
    fixture.componentInstance.discussion.addMentionMember(inactiveMember.id);
    fixture.detectChanges();

    expect(fixture.componentInstance.discussion.selectedMentionMemberIds()).toEqual([contributor.id]);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Case Contributor');

    fixture.componentInstance.discussion.removeMentionMember(contributor.id);
    fixture.detectChanges();

    expect(fixture.componentInstance.discussion.selectedMentionMemberIds()).toEqual([]);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('No mentions selected.');
  });

  it('uses safe return context and rejects external return URLs', () => {
    routeQueryParams = {
      returnUrl: `/projects/${projectId}/work-items?status=blocked&sort=priority_desc`
    };
    const { fixture } = setup();
    const backLink = (fixture.nativeElement as HTMLElement).querySelector<HTMLAnchorElement>(
      '.detail-header__actions > a'
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

    const fallbackLink = (
      unsafeFixture.nativeElement as HTMLElement
    ).querySelector<HTMLAnchorElement>('.detail-header__actions > a');
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
    fixture.componentInstance.relationships.relationshipForm.patchValue({ search: 'api' });
    fixture.componentInstance.relationships.searchRelationshipCandidates();

    const request = http.expectOne(
      (candidateRequest) => candidateRequest.url === '/api/work-items'
    );
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

    expect(fixture.componentInstance.relationships.relationshipCandidates().map((item) => item.id)).toEqual([
      blockerWorkItemId
    ]);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'WT-4 Finish API contract'
    );
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'More matches are available. Refine the search to narrow the results.'
    );
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain(
      'WT-3 Implement detail surface'
    );
  });

  it('preserves relationship candidate loading, error, retry, and empty states', () => {
    const { fixture, http } = setup();
    fixture.componentInstance.relationships.relationshipForm.patchValue({ search: 'missing work' });
    fixture.componentInstance.relationships.searchRelationshipCandidates();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const searchButton = compiled.querySelector<HTMLButtonElement>(
      '.relationship-form-grid button'
    );
    expect(searchButton?.disabled).toBe(true);
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
    expect(fixture.componentInstance.state.workItemId()).toBe(blockedWorkItemId);
  });

  it('issues one Files target generation for each same-item fragment request', () => {
    const { fixture } = setup();
    const attachmentComponent = fixture.debugElement.query(
      By.directive(WorkItemAttachmentsComponent)
    ).componentInstance as WorkItemAttachmentsComponent;
    const target = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('#files')!;
    const focus = vi.spyOn(target, 'focus').mockImplementation(() => undefined);
    const scrollIntoView = vi.spyOn(target, 'scrollIntoView').mockImplementation(() => undefined);

    expect(fixture.componentInstance.state.filesTargetGeneration()).toBeNull();
    expect(attachmentComponent.focusWhenSettled()).toBeNull();

    routeFragment.next('files');
    fixture.detectChanges();
    const firstGeneration = fixture.componentInstance.state.filesTargetGeneration();

    expect(firstGeneration).toBe(1);
    expect(attachmentComponent.focusWhenSettled()).toBe(firstGeneration);
    expect(focus).toHaveBeenCalledExactlyOnceWith({ preventScroll: true });
    expect(scrollIntoView).toHaveBeenCalledExactlyOnceWith({ block: 'start' });

    routeFragment.next('files');
    fixture.detectChanges();
    expect(fixture.componentInstance.state.filesTargetGeneration()).toBe(firstGeneration);
    expect(focus).toHaveBeenCalledTimes(1);

    routeFragment.next(null);
    fixture.detectChanges();
    expect(fixture.componentInstance.state.filesTargetGeneration()).toBeNull();

    routeFragment.next('files');
    fixture.detectChanges();
    expect(fixture.componentInstance.state.filesTargetGeneration()).toBe(2);
    expect(focus).toHaveBeenCalledTimes(2);
  });

  it('renews the Files target when route reuse changes the work item id', () => {
    routeFragment.next('files');
    const { fixture, http } = setup();
    const firstGeneration = fixture.componentInstance.state.filesTargetGeneration();
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

    expect(fixture.componentInstance.state.filesTargetGeneration()).toBe(2);
    expect(fixture.componentInstance.state.filesTargetGeneration()).not.toBe(firstGeneration);
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
      `/projects/${projectId}/work-items/new?returnUrl=%2Fprojects%2F${projectId}%2Fwork-items&returnTo=%2Fwork-items%2F${workItemId}&parentWorkItemId=${workItemId}`
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
      `/work-items/${workItemId}?returnUrl=%2Fprojects%2F${projectId}%2Fwork-items&returnTo=%2Fwork-items%2F${blockedWorkItemId}`
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
    fixture.componentInstance.relationships.relationshipCandidates.set([blocker]);
    fixture.componentInstance.relationships.relationshipForm.patchValue({ kind: 'blocked_by' });
    fixture.componentInstance.relationships.selectRelationshipCandidate(blocker);
    fixture.componentInstance.relationships.addRelationship();

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

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'WT-4 Finish API contract'
    );
    expect(fixture.componentInstance.relationships.isAddingRelationship()).toBe(false);
  });

  it('adds blocked work by posting from the current work item to the selected target', () => {
    const { fixture, http } = setup();
    fixture.componentInstance.relationships.relationshipForm.patchValue({
      kind: 'blocks',
      targetWorkItemId: blockedWorkItemId
    });
    fixture.componentInstance.relationships.addRelationship();

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
    fixture.componentInstance.relationships.relationshipForm.patchValue({
      kind: 'related',
      targetWorkItemId: relatedWorkItemId
    });
    fixture.componentInstance.relationships.addRelationship();

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

    fixture.componentInstance.relationships.removeRelationship(relationship);

    const request = http.expectOne(
      `/api/work-items/${workItemId}/relationships/${relationship.id}`
    );
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

    fixture.componentInstance.relationships.relationshipCandidates.set([linked]);
    fixture.componentInstance.relationships.selectRelationshipCandidate(linked);
    fixture.detectChanges();

    expect(fixture.componentInstance.relationships.relationshipForm.getRawValue().targetWorkItemId).toBe('');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Linked');
  });

  it('edits a comment inline and refreshes activity', () => {
    const { fixture, http } = setup();
    const comment = detail.comments[0];

    fixture.componentInstance.discussion.startEditComment(comment);
    fixture.detectChanges();
    fixture.componentInstance.discussion.editCommentForm.setValue({
      bodyContent: { source: 'Updated implementation note.', format: 'plain_text' }
    });
    fixture.componentInstance.discussion.saveComment(comment);

    const update = http.expectOne(`/api/comments/${comment.id}`);
    expect(update.request.method).toBe('PATCH');
    expect(update.request.body).toEqual({
      body: 'Updated implementation note.',
      bodyFormat: 'plain_text'
    });
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
    expect(fixture.componentInstance.discussion.editingCommentId()).toBeNull();
  });

  it('deletes a comment after confirmation and renders the tombstone', () => {
    const { fixture, http } = setup();
    const comment = detail.comments[0];

    fixture.componentInstance.discussion.confirmDeleteComment(comment);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Delete this comment?');

    fixture.componentInstance.discussion.deleteComment(comment);

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
    expect(fixture.componentInstance.discussion.confirmingDeleteCommentId()).toBeNull();
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
    expect(fixture.componentInstance.discussion.canModifyComment(deletedDetail.comments[0])).toBe(false);
  });

  it('hides comment edit and delete actions when the local actor cannot modify the comment', () => {
    TestBed.inject(CurrentUserService).selectMember(contributor.id);
    const { fixture } = setup();
    const compiled = fixture.nativeElement as HTMLElement;
    const buttonLabels = Array.from(compiled.querySelectorAll('article.comment button')).map(
      (button) => button.textContent?.trim()
    );

    expect(fixture.componentInstance.discussion.canModifyComment(detail.comments[0])).toBe(false);
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
    expect(compiled.querySelector<HTMLSelectElement>('.status-form select')?.disabled).toBe(true);

    fixture.componentInstance.state.statusForm.setValue({ status: 'ready' });
    fixture.componentInstance.state.transitionStatus();
    fixture.detectChanges();

    expect(compiled.textContent).toContain(
      'Only owners and maintainers can reopen done or canceled work items.'
    );
    http.expectNone(`/api/work-items/${workItemId}/transitions`);
  });

  it('shows a recoverable error when comment edit is rejected', () => {
    const { fixture, http } = setup();
    const comment = detail.comments[0];

    fixture.componentInstance.discussion.startEditComment(comment);
    fixture.componentInstance.discussion.editCommentForm.setValue({
      bodyContent: { source: 'Rejected update.', format: 'plain_text' }
    });
    fixture.componentInstance.discussion.saveComment(comment);

    const update = http.expectOne(`/api/comments/${comment.id}`);
    update.flush(
      { error: { code: 'FORBIDDEN', message: 'Rejected.' } },
      { status: 403, statusText: 'Forbidden' }
    );
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('The comment could not be updated.');

    fixture.componentInstance.discussion.clearCommentMutationError();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain(
      'The comment could not be updated.'
    );
  });

  it('updates editable fields and project labels through the patch endpoint', () => {
    const { fixture, http } = setup();
    openDetails(fixture);
    fixture.componentInstance.state.detailForm.patchValue({
      title: 'Updated detail surface',
      descriptionContent: { source: '  Updated description.\n', format: 'markdown_v1' },
      type: 'story',
      priority: 'urgent',
      assigneeId: owner.id,
      milestoneId: nextMilestone.id
    });
    fixture.componentInstance.state.toggleLabel(frontendLabelId, {
      target: { checked: true }
    } as unknown as Event);
    fixture.componentInstance.state.updateWorkItem();

    const request = http.expectOne(`/api/work-items/${workItemId}`);
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({
      title: 'Updated detail surface',
      description: '  Updated description.\n',
      descriptionFormat: 'markdown_v1',
      type: 'story',
      priority: 'urgent',
      assigneeId: owner.id,
      milestoneId: nextMilestone.id,
      cycleId: activeCycle.id,
      labelIds: [labelId, frontendLabelId],
      estimatePoints: detail.estimatePoints,
      dueDate: detail.dueDate
    });
    request.flush({
      ...detail,
      title: 'Updated detail surface',
      description: '  Updated description.\n',
      descriptionFormat: 'markdown_v1',
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

    openDetails(fixture);
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

    fixture.componentInstance.state.updateWorkItem();
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
      {
        id: frontendLabelId,
        name: 'frontend',
        color: '#2563eb',
        isArchived: false,
        archivedAt: null
      },
      { id: labelId, name: 'backend', color: '#059669', isArchived: false, archivedAt: null }
    ]);
    http
      .expectOne(`/api/projects/${projectId}/milestones?includeArchived=true`)
      .flush([activeMilestone]);
    http.expectOne(`/api/projects/${projectId}/cycles?includeArchived=true`).flush([activeCycle]);
    fixture.detectChanges();
    http.expectOne(`/api/work-items/${workItemId}/attachments`).flush(emptyAttachmentList);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('legacy');
    expect(fixture.componentInstance.state.assignableLabels().map((label) => label.id)).not.toContain(
      archivedLabelId
    );

    fixture.componentInstance.state.updateWorkItem();
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
      {
        id: frontendLabelId,
        name: 'frontend',
        color: '#2563eb',
        isArchived: false,
        archivedAt: null
      },
      { id: labelId, name: 'backend', color: '#059669', isArchived: false, archivedAt: null }
    ]);
    http
      .expectOne(`/api/projects/${projectId}/milestones?includeArchived=true`)
      .flush([activeMilestone]);
    http.expectOne(`/api/projects/${projectId}/cycles?includeArchived=true`).flush([activeCycle]);
    fixture.detectChanges();
    http.expectOne(`/api/work-items/${workItemId}/attachments`).flush({
      ...emptyAttachmentList,
      permissions: { canUpload: false }
    });
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Archived project');
    expect(compiled.querySelector('app-work-item-parent-manager')).toBeNull();
    expect(compiled.textContent).not.toContain('Add child work item');
    expect(compiled.querySelector('button[type="submit"]')?.hasAttribute('disabled')).toBe(true);
    expect(fixture.componentInstance.state.detailForm.disabled).toBe(true);
    expect(fixture.componentInstance.relationships.relationshipForm.disabled).toBe(true);

    fixture.componentInstance.state.detailForm.patchValue({ title: 'Archived edit attempt' });
    fixture.componentInstance.state.updateWorkItem();
    fixture.componentInstance.state.statusForm.setValue({ status: 'done' });
    fixture.componentInstance.state.transitionStatus();
    fixture.componentInstance.discussion.commentForm.setValue({
      bodyContent: { source: 'Archived comment attempt.', format: 'markdown_v1' }
    });
    fixture.componentInstance.discussion.addComment();
    fixture.componentInstance.relationships.relationshipForm.patchValue({ targetWorkItemId: blockedWorkItemId });
    fixture.componentInstance.relationships.addRelationship();

    http.expectNone(`/api/work-items/${workItemId}`);
    http.expectNone(`/api/work-items/${workItemId}/transitions`);
    http.expectNone(`/api/work-items/${workItemId}/comments`);
    http.expectNone(`/api/work-items/${workItemId}/relationships`);
  });

  it('shows workflow errors when a status transition is rejected', () => {
    const { fixture, http } = setup();
    fixture.componentInstance.state.statusForm.setValue({ status: 'done' });
    fixture.componentInstance.state.transitionStatus();

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
    fixture.componentInstance.discussion.commentForm.setValue({
      bodyContent: { source: 'New detail comment.', format: 'markdown_v1' }
    });
    fixture.componentInstance.discussion.addComment();

    const commentRequest = http.expectOne(`/api/work-items/${workItemId}/comments`);
    expect(commentRequest.request.method).toBe('POST');
    expect(commentRequest.request.body).toEqual({
      body: 'New detail comment.',
      bodyFormat: 'markdown_v1'
    });
    commentRequest.flush({
      id: '10000000-0000-4000-8000-000000000502',
      workspaceId: owner.workspaceId,
      projectId,
      workItemId,
      author: owner,
      body: 'New detail comment.',
      bodyFormat: 'plain_text',
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
          bodyFormat: 'plain_text',
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
    fixture.componentInstance.discussion.commentForm.setValue({
      bodyContent: { source: 'Mentioning a collaborator.', format: 'markdown_v1' }
    });
    fixture.componentInstance.discussion.addMentionMember(contributor.id);
    fixture.componentInstance.discussion.addComment();

    const commentRequest = http.expectOne(`/api/work-items/${workItemId}/comments`);
    expect(commentRequest.request.method).toBe('POST');
    expect(commentRequest.request.body).toEqual({
      body: 'Mentioning a collaborator.',
      bodyFormat: 'markdown_v1',
      mentionMemberIds: [contributor.id]
    });
    commentRequest.flush({
      id: '10000000-0000-4000-8000-000000000503',
      workspaceId: owner.workspaceId,
      projectId,
      workItemId,
      author: owner,
      body: 'Mentioning a collaborator.',
      bodyFormat: 'plain_text',
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
          bodyFormat: 'plain_text',
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
    expect(fixture.componentInstance.discussion.selectedMentionMemberIds()).toEqual([]);
    expect(compiled.textContent).toContain('Mentioning a collaborator.');
    expect(compiled.textContent).toContain('@Case Contributor');
  });
});

afterEach(() => {
  try {
    TestBed.resetTestingModule();
  } finally {
    vi.restoreAllMocks();
    localStorage.removeItem('worktrail.selectedMemberId');
  }
});
