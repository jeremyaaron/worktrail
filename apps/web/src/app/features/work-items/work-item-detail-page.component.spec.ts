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
      expect(component.commentForm.controls.bodyContent.value).toEqual({
        source: '',
        format: 'markdown_v1'
      });
      component.commentForm.controls.bodyContent.setValue({ source, format: 'markdown_v1' });
      component.addComment();
      fixture.detectChanges();
      expect(component.commentForm.invalid).toBeTrue();
      expect(component.isCommenting()).toBeFalse();
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
      component.commentForm.controls.bodyContent.setValue(pair);
      component.commentForm.controls.bodyContent.markAsDirty();
      component.addMentionMember(contributor.id);
      fixture.detectChanges();
      const editorElement = (fixture.nativeElement as HTMLElement).querySelector(
        'form.comment-form app-authored-content-editor'
      )!;
      const preview = [...editorElement.querySelectorAll<HTMLButtonElement>('button')].find(
        (button) => button.textContent?.trim() === 'Preview'
      )!;
      preview.click();
      fixture.detectChanges();
      component.addComment();
      component.addComment();
      expect(component.commentForm.disabled).toBeTrue();
      component.removeMentionMember(contributor.id);
      component.addMentionMember(owner.id);
      const post = http.expectOne(`/api/work-items/${workItemId}/comments`);
      expect(post.request.body).toEqual({
        body: pair.source,
        bodyFormat: format,
        mentionMemberIds: [contributor.id]
      });
      post.flush({}, { status: 500, statusText: 'Failure' });
      fixture.detectChanges();
      expect(component.isCommenting()).toBeFalse();
      expect(component.commentForm.enabled).toBeTrue();
      expect(component.commentForm.dirty).toBeTrue();
      expect(component.commentForm.controls.bodyContent.value).toEqual(pair);
      expect(component.selectedMentionMemberIds()).toEqual([contributor.id]);
      expect(editorElement.querySelector('[aria-label="Add comment preview"]')).not.toBeNull();
      component.addComment();
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
        component.workItem()?.comments.some((comment) => comment.id === created.id)
      ).toBeTrue();
      expect(component.isCommenting()).toBeFalse();
      expect(component.commentForm.controls.bodyContent.value).toEqual({
        source: '',
        format: 'markdown_v1'
      });
      expect(component.selectedMentionMemberIds()).toEqual([]);
      expect(component.commentForm.pristine).toBeTrue();
      refresh.flush({ ...detail, comments: [...detail.comments, created] });
      fixture.detectChanges();
      expect(editorElement.querySelector('[aria-label="Add comment preview"]')).toBeNull();
    });
  }

  it('does not infer recipients from typed names, Markdown links, code, or display keys', () => {
    const { fixture, http } = setup();
    const source = '@Case Contributor [Avery](https://example.com) `@Case` WT-3';
    fixture.componentInstance.commentForm.controls.bodyContent.setValue({
      source,
      format: 'markdown_v1'
    });
    fixture.componentInstance.addComment();
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
    component.startEditComment(comment);
    fixture.detectChanges();
    expect(component.editCommentForm.controls.bodyContent.value).toEqual({
      source,
      format: 'plain_text'
    });
    const format = row.querySelector<HTMLSelectElement>(`#comment-edit-${comment.id}-format`)!;
    format.value = 'markdown_v1';
    format.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(component.editCommentForm.dirty).toBeTrue();
    expect(component.editCommentForm.controls.bodyContent.value).toEqual({
      source,
      format: 'markdown_v1'
    });
    component.cancelEditComment();
    fixture.detectChanges();
    expect(component.editingCommentId()).toBeNull();
    expect(row.querySelector('app-authored-content-editor')).toBeNull();
    expect(row.querySelector('app-authored-content-viewer')?.textContent).toBe(source);
    http.expectNone((request) => request.method === 'PATCH');
  });

  for (const source of ['x'.repeat(10_001), ' \r\n']) {
    it(`grandfathers unchanged legacy comments but validates conversion (${source.length} code units)`, () => {
      const comment = { ...detail.comments[0], body: source };
      const { fixture, http } = setup({ workItem: { ...detail, comments: [comment] } });
      const component = fixture.componentInstance;
      component.startEditComment(comment);
      expect(component.editCommentForm.valid).toBeTrue();
      component.saveComment(comment);
      const update = http.expectOne(`/api/comments/${comment.id}`);
      expect(update.request.body).toEqual({ body: source, bodyFormat: 'plain_text' });
      update.flush(comment);
      http.expectOne(`/api/work-items/${workItemId}`).flush({ ...detail, comments: [comment] });
      component.startEditComment(comment);
      component.editCommentForm.controls.bodyContent.setValue({ source, format: 'markdown_v1' });
      component.saveComment(comment);
      expect(component.editCommentForm.invalid).toBeTrue();
      expect(component.savingCommentId()).toBeNull();
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
    component.startEditComment(comment);
    component.editCommentForm.controls.bodyContent.setValue({
      source: comment.body,
      format: 'markdown_v1'
    });
    component.saveComment(comment);
    const update = http.expectOne(`/api/comments/${comment.id}`);
    expect(update.request.body).toEqual({ body: comment.body, bodyFormat: 'markdown_v1' });
    const updated = {
      ...comment,
      bodyFormat: 'markdown_v1' as const,
      isEdited: true,
      editedAt: comment.updatedAt
    };
    update.flush(updated);
    expect(component.editingCommentId()).toBeNull();
    expect(component.savingCommentId()).toBeNull();
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
    component.startEditComment(comment);
    component.editCommentForm.controls.bodyContent.setValue(pair);
    component.editCommentForm.controls.bodyContent.markAsDirty();
    component.commentForm.controls.bodyContent.setValue({
      source: 'Composer draft',
      format: 'plain_text'
    });
    component.addMentionMember(contributor.id);
    fixture.detectChanges();
    const editElement = (fixture.nativeElement as HTMLElement).querySelector(
      'form.comment-edit-form'
    )!;
    [...editElement.querySelectorAll<HTMLButtonElement>('button')]
      .find((button) => button.textContent?.trim() === 'Preview')!
      .click();
    fixture.detectChanges();
    component.saveComment(comment);
    component.saveComment(comment);
    expect(component.editCommentForm.disabled).toBeTrue();
    http
      .expectOne(`/api/comments/${comment.id}`)
      .flush({}, { status: 403, statusText: 'Forbidden' });
    fixture.detectChanges();
    expect(component.editCommentForm.enabled).toBeTrue();
    expect(component.editCommentForm.dirty).toBeTrue();
    expect(component.editCommentForm.controls.bodyContent.value).toEqual(pair);
    expect(component.commentForm.controls.bodyContent.value.source).toBe('Composer draft');
    expect(component.selectedMentionMemberIds()).toEqual([contributor.id]);
    expect(editElement.querySelector('[aria-label="Edit comment preview"]')).not.toBeNull();
    component.saveComment(comment);
    const retry = http.expectOne(`/api/comments/${comment.id}`);
    expect(retry.request.body).toEqual({ body: pair.source, bodyFormat: pair.format });
    const updated = { ...comment, body: pair.source, bodyFormat: pair.format };
    retry.flush(updated);
    http.expectOne(`/api/work-items/${workItemId}`).flush({ ...detail, comments: [updated] });
    expect(component.editingCommentId()).toBeNull();
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
    fixture.componentInstance.editingCommentId.set(comment.id);
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
    expect(root.querySelector<HTMLTextAreaElement>('#comment-body')?.disabled).toBeTrue();
    expect(root.querySelector<HTMLSelectElement>('#comment-body-format')?.disabled).toBeTrue();
    component.startEditComment(comment);
    component.confirmDeleteComment(comment);
    component.addComment();
    expect(component.editingCommentId()).toBeNull();
    expect(component.confirmingDeleteCommentId()).toBeNull();
    http.expectNone((request) => request.method !== 'GET');
  });

  it('preserves both comment editors and description drafts through activity, relationship and detail-save refreshes', () => {
    const { fixture, http } = setup();
    const component = fixture.componentInstance;
    const comment = detail.comments[0];
    component.startEditComment(comment);
    const edit = { source: '**Edit draft**', format: 'markdown_v1' as const };
    const create = { source: ' New draft ', format: 'plain_text' as const };
    component.editCommentForm.controls.bodyContent.setValue(edit);
    component.commentForm.controls.bodyContent.setValue(create);
    component.addMentionMember(contributor.id);
    component.detailForm.controls.title.setValue('Other title');
    const editIdentity = component.editCommentIdentity();
    const createIdentity = component.newCommentIdentity();
    component.refreshAttachmentActivity();
    http.expectOne(`/api/work-items/${workItemId}/activity`).flush([]);
    component.relationshipForm.patchValue({ kind: 'blocks', targetWorkItemId: blockedWorkItemId });
    component.addRelationship();
    http.expectOne(`/api/work-items/${workItemId}/relationships`).flush({});
    http.expectOne(`/api/work-items/${workItemId}`).flush(detail);
    component.updateWorkItem();
    http.expectOne(`/api/work-items/${workItemId}`).flush({ ...detail, title: 'Other title' });
    expect(component.editCommentForm.controls.bodyContent.value).toEqual(edit);
    expect(component.commentForm.controls.bodyContent.value).toEqual(create);
    expect(component.editingCommentId()).toBe(comment.id);
    expect(component.selectedMentionMemberIds()).toEqual([contributor.id]);
    expect(component.editCommentIdentity()).toBe(editIdentity);
    expect(component.newCommentIdentity()).toBe(createIdentity);
  });

  for (const outcome of ['success', 'error'] as const) {
    it(`ignores a canceled save ${outcome} when the same comment has a newer edit`, () => {
      const { fixture, http } = setup();
      const component = fixture.componentInstance;
      const comment = detail.comments[0];
      component.startEditComment(comment);
      component.editCommentForm.controls.bodyContent.setValue({
        source: 'Old save',
        format: 'markdown_v1'
      });
      component.saveComment(comment);
      const oldSave = http.expectOne(`/api/comments/${comment.id}`);
      component.cancelEditComment();
      component.startEditComment(comment);
      const pair = { source: 'New save', format: 'plain_text' as const };
      component.editCommentForm.controls.bodyContent.setValue(pair);
      component.saveComment(comment);
      const newSave = http.expectOne(`/api/comments/${comment.id}`);
      if (outcome === 'success') oldSave.flush({ ...comment, body: 'Old save' });
      else oldSave.flush({}, { status: 500, statusText: 'Failure' });
      expect(component.savingCommentId()).toBe(comment.id);
      expect(component.editingCommentId()).toBe(comment.id);
      expect(component.editCommentForm.controls.bodyContent.value).toEqual(pair);
      expect(component.commentMutationError()).toBeNull();
      http.expectNone(`/api/work-items/${workItemId}`);
      newSave.flush({ ...comment, body: pair.source, bodyFormat: pair.format });
      http.expectOne(`/api/work-items/${workItemId}`).flush(detail);
      expect(component.editingCommentId()).toBeNull();
    });
  }

  it('ignores an old successful-edit refresh after a newer edit opens on the same route', () => {
    const { fixture, http } = setup();
    const component = fixture.componentInstance;
    const comment = detail.comments[0];
    component.startEditComment(comment);
    component.editCommentForm.controls.bodyContent.setValue({
      source: 'First edit',
      format: 'markdown_v1'
    });
    component.saveComment(comment);
    const updated = { ...comment, body: 'First edit', bodyFormat: 'markdown_v1' as const };
    http.expectOne(`/api/comments/${comment.id}`).flush(updated);
    const oldRefresh = http.expectOne(`/api/work-items/${workItemId}`);
    component.startEditComment(updated);
    component.editCommentForm.controls.bodyContent.setValue({
      source: 'Second draft',
      format: 'plain_text'
    });
    oldRefresh.flush(detail);
    expect(component.editingCommentId()).toBe(comment.id);
    expect(component.editCommentForm.controls.bodyContent.value.source).toBe('Second draft');
    expect(component.workItem()?.comments[0].body).toBe('First edit');
  });

  it('does not let an old delete callback clear a newer edit or refresh its state', () => {
    const { fixture, http } = setup();
    const component = fixture.componentInstance;
    const comment = detail.comments[0];
    component.confirmDeleteComment(comment);
    component.deleteComment(comment);
    const oldDelete = http.expectOne(`/api/comments/${comment.id}`);
    component.cancelDeleteComment();
    component.startEditComment(comment);
    component.editCommentForm.controls.bodyContent.setValue({
      source: 'New edit',
      format: 'markdown_v1'
    });
    oldDelete.flush({ ...comment, isDeleted: true, body: '' });
    expect(component.editingCommentId()).toBe(comment.id);
    expect(component.editCommentForm.controls.bodyContent.value.source).toBe('New edit');
    expect(component.workItem()?.comments[0].isDeleted).toBeFalse();
    http.expectNone(`/api/work-items/${workItemId}`);
  });

  it('recovers from a discussion refresh failure without reposting or clearing a newer composer draft', () => {
    const { fixture, http } = setup();
    const component = fixture.componentInstance;
    component.commentForm.controls.bodyContent.setValue({
      source: 'Created source',
      format: 'markdown_v1'
    });
    component.addComment();
    const created = {
      ...detail.comments[0],
      id: 'new-comment',
      body: 'Created source',
      bodyFormat: 'markdown_v1' as const
    };
    http.expectOne(`/api/work-items/${workItemId}/comments`).flush(created);
    const refresh = http.expectOne(`/api/work-items/${workItemId}`);
    const pair = { source: '  Next draft\n', format: 'plain_text' as const };
    component.commentForm.controls.bodyContent.setValue(pair);
    component.addMentionMember(contributor.id);
    refresh.flush({}, { status: 500, statusText: 'Failure' });
    fixture.detectChanges();
    expect(component.isCommenting()).toBeFalse();
    expect(component.commentError()).toBeNull();
    expect(component.commentForm.controls.bodyContent.value).toEqual(pair);
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
    expect(component.commentForm.controls.bodyContent.value).toEqual(pair);
    expect(component.selectedMentionMemberIds()).toEqual([contributor.id]);
    http.expectNone((request) => request.method === 'POST');
  });

  for (const action of ['create', 'edit', 'delete'] as const) {
    for (const outcome of ['success', 'error'] as const) {
      it(`rejects stale ${action} ${outcome} after item/actor changes`, () => {
        const { fixture, http } = setup();
        const component = fixture.componentInstance;
        const oldComment = detail.comments[0];
        if (action === 'create') {
          component.commentForm.controls.bodyContent.setValue({
            source: 'Old create',
            format: 'markdown_v1'
          });
          component.addComment();
        } else if (action === 'edit') {
          component.startEditComment(oldComment);
          component.editCommentForm.controls.bodyContent.setValue({
            source: 'Old edit',
            format: 'markdown_v1'
          });
          component.saveComment(oldComment);
        } else {
          component.confirmDeleteComment(oldComment);
          component.deleteComment(oldComment);
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
        expect(loads.some((load) => load.cancelled)).toBeTrue();
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
        component.commentForm.controls.bodyContent.setValue({
          source: 'New composer',
          format: 'plain_text'
        });
        component.addMentionMember(owner.id);
        component.startEditComment(newComment);
        component.editCommentForm.controls.bodyContent.setValue({
          source: 'New inline draft',
          format: 'markdown_v1'
        });
        if (outcome === 'success')
          oldRequest.flush(
            action === 'delete' ? { ...oldComment, body: '', isDeleted: true } : oldComment
          );
        else oldRequest.flush({}, { status: 500, statusText: 'Failure' });
        expect(component.commentForm.controls.bodyContent.value.source).toBe('New composer');
        expect(component.editCommentForm.controls.bodyContent.value.source).toBe(
          'New inline draft'
        );
        expect(component.editingCommentId()).toBe(newComment.id);
        expect(component.selectedMentionMemberIds()).toEqual([owner.id]);
        expect(component.commentError()).toBeNull();
        expect(component.commentMutationError()).toBeNull();
        expect(component.isCommenting()).toBeFalse();
        expect(component.savingCommentId()).toBeNull();
        expect(component.deletingCommentId()).toBeNull();
        http.expectNone(`/api/work-items/${blockedWorkItemId}`);
      });
    }
  }

  it('clears all comment draft state when the actor changes without changing the item', () => {
    const { fixture, http } = setup();
    const component = fixture.componentInstance;
    component.commentForm.controls.bodyContent.setValue({
      source: 'Owner create draft',
      format: 'plain_text'
    });
    component.addMentionMember(contributor.id);
    component.startEditComment(detail.comments[0]);
    component.editCommentForm.controls.bodyContent.setValue({
      source: 'Owner edit draft',
      format: 'markdown_v1'
    });
    fixture.detectChanges();
    const oldTextarea = (fixture.nativeElement as HTMLElement).querySelector<HTMLTextAreaElement>(
      '#comment-body'
    )!;
    TestBed.inject(CurrentUserService).selectMember(contributor.id);
    fixture.detectChanges();
    expect(component.commentForm.controls.bodyContent.value).toEqual({
      source: '',
      format: 'markdown_v1'
    });
    expect(component.selectedMentionMemberIds()).toEqual([]);
    expect(component.editingCommentId()).toBeNull();
    finishReload(fixture, http);
    oldTextarea.value = 'Stale input';
    oldTextarea.dispatchEvent(new Event('input'));
    expect(component.commentForm.controls.bodyContent.value.source).toBe('');
  });

  for (const outcome of ['success', 'error'] as const) {
    it(`rejects a discussion refresh ${outcome} after navigation returns to the same item`, () => {
      const { fixture, http } = setup();
      const component = fixture.componentInstance;
      component.refreshDiscussion();
      const oldRefresh = http.expectOne(`/api/work-items/${workItemId}`);
      routeParamMap.next(convertToParamMap({ workItemId: blockedWorkItemId }));
      const intermediate = http.expectOne(`/api/work-items/${blockedWorkItemId}`);
      routeParamMap.next(convertToParamMap({ workItemId }));
      fixture.detectChanges();
      finishReload(fixture, http);
      component.commentForm.controls.bodyContent.setValue({
        source: 'Fresh route draft',
        format: 'markdown_v1'
      });
      component.addMentionMember(contributor.id);
      expect(oldRefresh.cancelled).toBeTrue();
      expect(intermediate.cancelled).toBeTrue();
      expect(component.workItem()?.comments.length).toBe(1);
      expect(component.discussionRefreshError()).toBeNull();
      expect(component.commentForm.controls.bodyContent.value.source).toBe('Fresh route draft');
      expect(component.selectedMentionMemberIds()).toEqual([contributor.id]);
    });
  }

  it('does not let an older discussion read undo a newer successful edit', () => {
    const { fixture, http } = setup();
    const component = fixture.componentInstance;
    component.refreshDiscussion();
    const oldRefresh = http.expectOne(`/api/work-items/${workItemId}`);
    const comment = detail.comments[0];
    component.startEditComment(comment);
    component.editCommentForm.controls.bodyContent.setValue({
      source: 'Current saved body',
      format: 'markdown_v1'
    });
    component.saveComment(comment);
    const updated = { ...comment, body: 'Current saved body', bodyFormat: 'markdown_v1' as const };
    http.expectOne(`/api/comments/${comment.id}`).flush(updated);
    const latestRefresh = http.expectOne(`/api/work-items/${workItemId}`);
    latestRefresh.flush({ ...detail, comments: [updated] });
    oldRefresh.flush(detail);
    expect(component.workItem()?.comments[0].body).toBe('Current saved body');
  });

  it('does not let an older field-save DTO undo a successful comment write', () => {
    const { fixture, http } = setup();
    const component = fixture.componentInstance;
    component.detailForm.controls.title.setValue('Changed title');
    component.updateWorkItem();
    const fieldSave = http.expectOne(`/api/work-items/${workItemId}`);
    const comment = detail.comments[0];
    component.startEditComment(comment);
    component.editCommentForm.controls.bodyContent.setValue({
      source: 'Newest comment', format: 'markdown_v1'
    });
    component.saveComment(comment);
    const updated = { ...comment, body: 'Newest comment', bodyFormat: 'markdown_v1' as const };
    http.expectOne(`/api/comments/${comment.id}`).flush(updated);
    const discussion = http.expectOne(`/api/work-items/${workItemId}`);
    fieldSave.flush({ ...detail, title: 'Changed title' });
    expect(component.workItem()?.comments[0].body).toBe('Newest comment');
    discussion.flush({ ...detail, comments: [updated] });
    expect(component.workItem()?.title).toBe('Changed title');
  });

  it('keeps legacy source literal until conversion, and discards an unsaved conversion', () => {
    const source = '  # Legacy\r\n**literal** <b>text</b>  ';
    const { fixture, http } = setup({ workItem: { ...detail, description: source } });
    const component = fixture.componentInstance;
    const summary = (fixture.nativeElement as HTMLElement).querySelector(
      'app-work-item-detail-summary'
    )!;
    const editor = fixture.debugElement.query(By.directive(AuthoredContentEditorComponent))
      .componentInstance as AuthoredContentEditorComponent;
    expect(summary.querySelector('strong, b, h3')).toBeNull();
    expect(summary.textContent).toContain(source);
    expect(component.detailForm.controls.descriptionContent.value).toEqual({
      source,
      format: 'plain_text'
    });
    const format = (fixture.nativeElement as HTMLElement).querySelector<HTMLSelectElement>(
      '#detail-description-format'
    )!;
    format.value = 'markdown_v1';
    format.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(component.detailForm.dirty).toBeTrue();
    expect(component.detailForm.controls.descriptionContent.value.source).toBe(source);
    expect(editor.value().format).toBe('markdown_v1');
    previewDescription(fixture);
    fixture.detectChanges();
    component.discardDetailChanges();
    fixture.detectChanges();
    expect(editor.mode()).toBe('edit');
    expect(component.detailForm.pristine).toBeTrue();
    expect(component.detailForm.controls.descriptionContent.value).toEqual({
      source,
      format: 'plain_text'
    });
    http.expectNone((request) => request.method === 'PATCH');
  });

  it('omits both unchanged description fields, including normalized line-ending equivalents', () => {
    const { fixture, http } = setup({
      workItem: { ...detail, description: '  old\r\nsource\r  ' }
    });
    fixture.componentInstance.detailForm.patchValue({
      title: 'Only title changed',
      descriptionContent: { source: '  old\nsource\n  ', format: 'plain_text' }
    });
    fixture.componentInstance.updateWorkItem();
    const update = http.expectOne(`/api/work-items/${workItemId}`);
    expect(Object.hasOwn(update.request.body, 'description')).toBeFalse();
    expect(Object.hasOwn(update.request.body, 'descriptionFormat')).toBeFalse();
    update.flush({ ...detail, title: 'Only title changed', description: '  old\r\nsource\r  ' });
    expect(fixture.componentInstance.detailForm.controls.descriptionContent.value.source).toBe(
      '  old\r\nsource\r  '
    );
    expect(fixture.componentInstance.detailForm.pristine).toBeTrue();
  });

  it('sends a format-only conversion once and adopts the successful pair as its new baseline', () => {
    const source = '  **literal until saved**\n';
    const { fixture, http } = setup({ workItem: { ...detail, description: source } });
    fixture.componentInstance.detailForm.controls.descriptionContent.setValue({
      source,
      format: 'markdown_v1'
    });
    fixture.componentInstance.updateWorkItem();
    const update = http.expectOne(`/api/work-items/${workItemId}`);
    expect(update.request.body.description).toBe(source);
    expect(update.request.body.descriptionFormat).toBe('markdown_v1');
    update.flush({ ...detail, description: source, descriptionFormat: 'markdown_v1' });
    fixture.detectChanges();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('app-work-item-detail-summary strong')
        ?.textContent
    ).toBe('literal until saved');
    fixture.componentInstance.updateWorkItem();
    const unchanged = http.expectOne(`/api/work-items/${workItemId}`);
    expect(Object.hasOwn(unchanged.request.body, 'description')).toBeFalse();
    expect(Object.hasOwn(unchanged.request.body, 'descriptionFormat')).toBeFalse();
    unchanged.flush({ ...detail, description: source, descriptionFormat: 'markdown_v1' });
  });

  it('allows unrelated edits to oversized legacy content but rejects conversion until shortened', () => {
    const source = 'x'.repeat(10_001);
    const { fixture, http } = setup({ workItem: { ...detail, description: source } });
    const control = fixture.componentInstance.detailForm.controls.descriptionContent;
    expect(control.valid).toBeTrue();
    fixture.componentInstance.detailForm.controls.title.setValue('Other edit');
    fixture.componentInstance.updateWorkItem();
    const update = http.expectOne(`/api/work-items/${workItemId}`);
    expect(Object.hasOwn(update.request.body, 'description')).toBeFalse();
    update.flush({ ...detail, title: 'Other edit', description: source });
    control.setValue({ source, format: 'markdown_v1' });
    fixture.componentInstance.updateWorkItem();
    fixture.detectChanges();
    expect(control.hasError('authoredContentTooLong')).toBeTrue();
    expect(
      (fixture.nativeElement as HTMLElement)
        .querySelector('#detail-description')
        ?.getAttribute('aria-invalid')
    ).toBe('true');
    http.expectNone((request) => request.method === 'PATCH');
    control.setValue({ source: 'shortened', format: 'markdown_v1' });
    expect(control.valid).toBeTrue();
  });

  it('preserves the entire pair and preview after a failed save, and recovers pending state', () => {
    const { fixture, http } = setup();
    const component = fixture.componentInstance;
    const draft = { source: '  # Keep my draft\n', format: 'markdown_v1' as const };
    component.detailForm.controls.descriptionContent.setValue(draft);
    component.detailForm.controls.descriptionContent.markAsDirty();
    fixture.detectChanges();
    const editor = fixture.debugElement.query(By.directive(AuthoredContentEditorComponent))
      .componentInstance as AuthoredContentEditorComponent;
    previewDescription(fixture);
    component.updateWorkItem();
    component.updateWorkItem();
    fixture.detectChanges();
    expect(component.detailForm.disabled).toBeTrue();
    const update = http.expectOne(`/api/work-items/${workItemId}`);
    update.flush({}, { status: 500, statusText: 'Failure' });
    fixture.detectChanges();
    expect(component.isUpdating()).toBeFalse();
    expect(component.detailForm.enabled).toBeTrue();
    expect(component.detailForm.controls.descriptionContent.value).toEqual(draft);
    expect(component.detailForm.dirty).toBeTrue();
    expect(editor.mode()).toBe('preview');
    component.updateWorkItem();
    const retry = http.expectOne(`/api/work-items/${workItemId}`);
    expect(retry.request.body.description).toBe(draft.source);
    retry.flush({ ...detail, description: draft.source, descriptionFormat: draft.format });
    fixture.detectChanges();
    expect(component.detailForm.pristine).toBeTrue();
    expect(editor.mode()).toBe('edit');
  });

  it('does not reset description source, preview, or dirty state during attachment and discussion refreshes', () => {
    const { fixture, http } = setup();
    const component = fixture.componentInstance;
    const draft = { source: '  **draft**\n', format: 'markdown_v1' as const };
    component.detailForm.controls.descriptionContent.setValue(draft);
    component.detailForm.controls.descriptionContent.markAsDirty();
    fixture.detectChanges();
    const editor = fixture.debugElement.query(By.directive(AuthoredContentEditorComponent))
      .componentInstance as AuthoredContentEditorComponent;
    previewDescription(fixture);
    const identity = component.descriptionEditorIdentity();
    component.refreshAttachmentActivity();
    http.expectOne(`/api/work-items/${workItemId}/activity`).flush([]);
    component.commentForm.setValue({
      bodyContent: { source: 'Unrelated comment', format: 'markdown_v1' }
    });
    component.addComment();
    http.expectOne(`/api/work-items/${workItemId}/comments`).flush(detail.comments[0]);
    http.expectOne(`/api/work-items/${workItemId}`).flush(detail);
    fixture.detectChanges();
    expect(component.detailForm.controls.descriptionContent.value).toEqual(draft);
    expect(component.detailForm.dirty).toBeTrue();
    expect(editor.mode()).toBe('preview');
    expect(component.descriptionEditorIdentity()).toBe(identity);
  });

  it('keeps description and comment drafts while applying parent and status changes', () => {
    const { fixture, http } = setup();
    const component = fixture.componentInstance;
    const draft = { source: '  My source\n', format: 'markdown_v1' as const };
    component.detailForm.controls.descriptionContent.setValue(draft);
    component.commentForm.controls.bodyContent.setValue({
      source: 'Discussion draft',
      format: 'markdown_v1'
    });
    component.applyParentChange(detail);
    component.statusForm.setValue({ status: 'ready' });
    component.transitionStatus();
    http
      .expectOne(`/api/work-items/${workItemId}/transitions`)
      .flush({ ...detail, status: 'ready' });
    expect(component.detailForm.controls.descriptionContent.value).toEqual(draft);
    expect(component.commentForm.controls.bodyContent.value.source).toBe('Discussion draft');
    expect(component.statusForm.controls.status.value).toBe('ready');
  });

  it('does not let an older status response replace a newly saved description or its baseline', () => {
    const { fixture, http } = setup();
    const component = fixture.componentInstance;
    component.statusForm.setValue({ status: 'ready' });
    component.transitionStatus();
    const status = http.expectOne(`/api/work-items/${workItemId}/transitions`);
    component.detailForm.controls.descriptionContent.setValue({
      source: 'New saved source',
      format: 'markdown_v1'
    });
    component.updateWorkItem();
    http
      .expectOne(`/api/work-items/${workItemId}`)
      .flush({ ...detail, description: 'New saved source', descriptionFormat: 'markdown_v1' });
    status.flush({ ...detail, status: 'ready' });
    expect(component.workItem()?.description).toBe('New saved source');
    expect(component.detailForm.controls.descriptionContent.value).toEqual({
      source: 'New saved source',
      format: 'markdown_v1'
    });
    component.updateWorkItem();
    const unchanged = http.expectOne(`/api/work-items/${workItemId}`);
    expect(Object.hasOwn(unchanged.request.body, 'description')).toBeFalse();
    unchanged.flush({
      ...detail,
      status: 'ready',
      description: 'New saved source',
      descriptionFormat: 'markdown_v1'
    });
  });

  it('preserves description and comment drafts through relationship refreshes', () => {
    const { fixture, http } = setup();
    const component = fixture.componentInstance;
    const draft = { source: '  **Relationship draft**\n', format: 'markdown_v1' as const };
    component.detailForm.controls.descriptionContent.setValue(draft);
    component.commentForm.controls.bodyContent.setValue({
      source: 'Comment draft',
      format: 'markdown_v1'
    });
    component.relationshipForm.patchValue({ kind: 'blocks', targetWorkItemId: blockedWorkItemId });
    component.addRelationship();
    http.expectOne(`/api/work-items/${workItemId}/relationships`).flush({});
    http.expectOne(`/api/work-items/${workItemId}`).flush(detail);
    expect(component.detailForm.controls.descriptionContent.value).toEqual(draft);
    expect(component.commentForm.controls.bodyContent.value.source).toBe('Comment draft');
    expect(component.isAddingRelationship()).toBeFalse();
  });

  it('does not let an old save clear the pending state of a new route save', () => {
    const { fixture, http } = setup();
    const component = fixture.componentInstance;
    component.updateWorkItem();
    const oldSave = http.expectOne(`/api/work-items/${workItemId}`);
    routeParamMap.next(convertToParamMap({ workItemId: blockedWorkItemId }));
    fixture.detectChanges();
    const nextDetail = { ...detail, id: blockedWorkItemId };
    finishReload(fixture, http, nextDetail);
    component.detailForm.controls.descriptionContent.setValue({
      source: 'New draft',
      format: 'markdown_v1'
    });
    component.updateWorkItem();
    const newSave = http.expectOne(`/api/work-items/${blockedWorkItemId}`);
    oldSave.flush(detail);
    expect(component.isUpdating()).toBeTrue();
    expect(component.detailForm.disabled).toBeTrue();
    expect(component.detailForm.controls.descriptionContent.value.source).toBe('New draft');
    newSave.flush({}, { status: 500, statusText: 'Failure' });
    expect(component.isUpdating()).toBeFalse();
    expect(component.detailForm.enabled).toBeTrue();
  });

  it('rejects old-actor responses even after returning to the same actor and item', () => {
    const { fixture, http } = setup();
    const component = fixture.componentInstance;
    component.updateWorkItem();
    const oldSave = http.expectOne(`/api/work-items/${workItemId}`);
    const user = TestBed.inject(CurrentUserService);
    user.selectMember(contributor.id);
    fixture.detectChanges();
    finishReload(fixture, http);
    user.selectMember(owner.id);
    fixture.detectChanges();
    finishReload(fixture, http);
    component.detailForm.controls.descriptionContent.setValue({
      source: 'New owner draft',
      format: 'markdown_v1'
    });
    oldSave.flush({ ...detail, description: 'Obsolete owner response' });
    expect(component.workItem()?.description).toBe(detail.description);
    expect(component.detailForm.controls.descriptionContent.value.source).toBe('New owner draft');
  });

  it('ignores stale errors from superseded loads without breaking the current draft', () => {
    const { fixture, http } = setup();
    fixture.componentInstance.loadWorkItem();
    const oldLoad = http.expectOne(`/api/work-items/${workItemId}`);
    fixture.componentInstance.loadWorkItem();
    fixture.detectChanges();
    finishReload(fixture, http);
    fixture.componentInstance.detailForm.controls.descriptionContent.setValue({
      source: 'Retain me',
      format: 'plain_text'
    });
    oldLoad.flush({}, { status: 500, statusText: 'Failure' });
    expect(fixture.componentInstance.loadError()).toBeNull();
    expect(fixture.componentInstance.isLoading()).toBeFalse();
    expect(fixture.componentInstance.detailForm.controls.descriptionContent.value.source).toBe(
      'Retain me'
    );
  });

  for (const outcome of ['success', 'error'] as const) {
    it(`ignores a stale save ${outcome} after route reuse and return to the same item`, () => {
      const { fixture, http } = setup();
      const component = fixture.componentInstance;
      component.detailForm.controls.descriptionContent.setValue({
        source: 'Old save',
        format: 'markdown_v1'
      });
      component.updateWorkItem();
      const oldSave = http.expectOne(`/api/work-items/${workItemId}`);
      routeParamMap.next(convertToParamMap({ workItemId: blockedWorkItemId }));
      const intermediate = http.expectOne(`/api/work-items/${blockedWorkItemId}`);
      routeParamMap.next(convertToParamMap({ workItemId }));
      fixture.detectChanges();
      finishReload(fixture, http);
      expect(intermediate.cancelled).toBeTrue();
      component.detailForm.controls.descriptionContent.setValue({
        source: 'New draft',
        format: 'plain_text'
      });
      if (outcome === 'success') {
        oldSave.flush({ ...detail, description: 'Old save', descriptionFormat: 'markdown_v1' });
      } else {
        oldSave.flush({}, { status: 500, statusText: 'Failure' });
      }
      expect(component.workItem()?.description).toBe(detail.description);
      expect(component.detailForm.controls.descriptionContent.value.source).toBe('New draft');
      expect(component.isUpdating()).toBeFalse();
      expect(component.updateError()).toBeNull();
    });
  }

  it('ignores superseded load responses for the same item', () => {
    const { fixture, http } = setup();
    fixture.componentInstance.loadWorkItem();
    const oldLoad = http.expectOne(`/api/work-items/${workItemId}`);
    fixture.componentInstance.loadWorkItem();
    fixture.detectChanges();
    finishReload(fixture, http, {
      ...detail,
      description: 'Newest source',
      descriptionFormat: 'markdown_v1'
    });
    oldLoad.flush({ ...detail, description: 'Obsolete source' });
    expect(fixture.componentInstance.detailForm.controls.descriptionContent.value).toEqual({
      source: 'Newest source',
      format: 'markdown_v1'
    });
  });

  it('resets the editor on actor change and rejects the old actor save before the reload effect runs', () => {
    const { fixture, http } = setup();
    const component = fixture.componentInstance;
    component.detailForm.controls.descriptionContent.setValue({
      source: 'Owner draft',
      format: 'markdown_v1'
    });
    component.updateWorkItem();
    const oldSave = http.expectOne(`/api/work-items/${workItemId}`);
    TestBed.inject(CurrentUserService).selectMember(contributor.id);
    oldSave.flush({ ...detail, description: 'Owner draft', descriptionFormat: 'markdown_v1' });
    expect(component.workItem()).toBeNull();
    fixture.detectChanges();
    expect(component.workItem()).toBeNull();
    expect(component.isUpdating()).toBeFalse();
    expect(component.detailForm.controls.descriptionContent.value.source).toBe('');
    finishReload(fixture, http);
    expect(component.detailForm.controls.descriptionContent.value).toEqual({
      source: detail.description,
      format: 'plain_text'
    });
  });

  it('ignores late discussion mutations rather than refreshing or clearing another item draft', () => {
    const { fixture, http } = setup();
    const component = fixture.componentInstance;
    component.commentForm.setValue({
      bodyContent: { source: 'Old item comment', format: 'markdown_v1' }
    });
    component.addComment();
    const comment = http.expectOne(`/api/work-items/${workItemId}/comments`);
    routeParamMap.next(convertToParamMap({ workItemId: blockedWorkItemId }));
    fixture.detectChanges();
    finishReload(fixture, http, { ...detail, id: blockedWorkItemId });
    component.commentForm.setValue({
      bodyContent: { source: 'New item draft', format: 'markdown_v1' }
    });
    comment.flush(detail.comments[0]);
    expect(component.commentForm.controls.bodyContent.value.source).toBe('New item draft');
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
    expect(root.querySelector<HTMLTextAreaElement>('#detail-description')?.disabled).toBeTrue();
    expect(
      root.querySelector<HTMLSelectElement>('#detail-description-format')?.disabled
    ).toBeTrue();
    fixture.componentInstance.updateWorkItem();
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

  it('protects independent field and comment drafts and discards only the explicitly selected editor', async () => {
    const { fixture } = setup();
    const component = fixture.componentInstance;
    const confirm = spyOn(TestBed.inject(DraftConfirmationService), 'confirm').and.resolveTo(false);
    const description = { source: '  **My draft**\n', format: 'markdown_v1' as const };
    const comment = { source: 'Comment draft', format: 'plain_text' as const };
    component.detailForm.controls.descriptionContent.setValue(description);
    component.commentForm.controls.bodyContent.setValue(comment);
    component.addMentionMember(contributor.id);
    expect(await component.requestDiscardDetailChanges()).toBeFalse();
    expect(component.detailForm.controls.descriptionContent.value).toEqual(description);
    expect(component.commentForm.controls.bodyContent.value).toEqual(comment);
    expect(component.selectedMentionMemberIds()).toEqual([contributor.id]);
    expect(confirm.calls.mostRecent().args[0]).toEqual(['Work item details']);
    confirm.and.resolveTo(true);
    expect(await component.requestDiscardDetailChanges()).toBeTrue();
    expect(component.detailForm.controls.descriptionContent.value.source).toBe(detail.description);
    expect(component.commentForm.controls.bodyContent.value).toEqual(comment);
    confirm.and.resolveTo(false);
    expect(await TestBed.inject(DraftDepartureCoordinator).change(() => undefined)).toBeFalse();
    expect(confirm.calls.mostRecent().args[0]).toEqual(['New comment']);
  });

  it('does not mark unsaved fields as saved when a new comment succeeds', async () => {
    const { fixture, http } = setup();
    const component = fixture.componentInstance;
    const confirm = spyOn(TestBed.inject(DraftConfirmationService), 'confirm').and.resolveTo(false);
    component.detailForm.controls.title.setValue('Still unsaved');
    component.commentForm.controls.bodyContent.setValue({ source: 'Posted comment', format: 'markdown_v1' });
    component.addComment();
    http.expectOne(`/api/work-items/${workItemId}/comments`).flush(detail.comments[0]);
    http.expectOne(`/api/work-items/${workItemId}`).flush(detail);
    expect(component.detailForm.controls.title.value).toBe('Still unsaved');
    expect(await TestBed.inject(DraftDepartureCoordinator).change(() => undefined)).toBeFalse();
    expect(confirm.calls.mostRecent().args[0]).toEqual(['Work item details']);
  });

  it('preserves inline comment source and format on Stay and treats a reverted editor as clean', async () => {
    const { fixture } = setup();
    const component = fixture.componentInstance;
    const comment = detail.comments[0];
    component.startEditComment(comment);
    const value = { source: 'Inline draft', format: 'markdown_v1' as const };
    component.editCommentForm.controls.bodyContent.setValue(value);
    const confirm = spyOn(TestBed.inject(DraftConfirmationService), 'confirm').and.resolveTo(false);
    expect(await component.requestCancelCommentEdit()).toBeFalse();
    expect(component.editingCommentId()).toBe(comment.id);
    expect(component.editCommentForm.controls.bodyContent.value).toEqual(value);
    component.editCommentForm.controls.bodyContent.setValue({ source: comment.body, format: comment.bodyFormat });
    confirm.calls.reset();
    expect(await component.requestCancelCommentEdit()).toBeTrue();
    expect(confirm).not.toHaveBeenCalled();
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
      (fixture.nativeElement as HTMLElement)
        .querySelector<HTMLButtonElement>('.watch-panel button')
        ?.textContent?.trim()
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

    const fallbackLink = (
      unsafeFixture.nativeElement as HTMLElement
    ).querySelector<HTMLAnchorElement>('.detail-header a');
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

    expect(fixture.componentInstance.relationshipCandidates().map((item) => item.id)).toEqual([
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

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'WT-4 Finish API contract'
    );
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
    fixture.componentInstance.editCommentForm.setValue({
      bodyContent: { source: 'Updated implementation note.', format: 'plain_text' }
    });
    fixture.componentInstance.saveComment(comment);

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
    const buttonLabels = Array.from(compiled.querySelectorAll('article.comment button')).map(
      (button) => button.textContent?.trim()
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
    fixture.componentInstance.editCommentForm.setValue({
      bodyContent: { source: 'Rejected update.', format: 'plain_text' }
    });
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
      descriptionContent: { source: '  Updated description.\n', format: 'markdown_v1' },
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
      description: '  Updated description.\n',
      descriptionFormat: 'markdown_v1',
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
    fixture.componentInstance.commentForm.setValue({
      bodyContent: { source: 'Archived comment attempt.', format: 'markdown_v1' }
    });
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
    fixture.componentInstance.commentForm.setValue({
      bodyContent: { source: 'New detail comment.', format: 'markdown_v1' }
    });
    fixture.componentInstance.addComment();

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
    fixture.componentInstance.commentForm.setValue({
      bodyContent: { source: 'Mentioning a collaborator.', format: 'markdown_v1' }
    });
    fixture.componentInstance.addMentionMember(contributor.id);
    fixture.componentInstance.addComment();

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
    expect(fixture.componentInstance.selectedMentionMemberIds()).toEqual([]);
    expect(compiled.textContent).toContain('Mentioning a collaborator.');
    expect(compiled.textContent).toContain('@Case Contributor');
  });
});
