import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import type { MemberDto, MilestoneDto, ProjectDto, WorkItemDetailDto } from '@worktrail/contracts';

import { CurrentUserService } from '../../core/current-user.service';
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
  boardPosition: 1024,
  dueDate: '2026-07-20',
  estimatePoints: 5,
  createdAt: '2026-07-02T12:00:00.000Z',
  updatedAt: '2026-07-03T12:00:00.000Z',
  comments: [
    {
      id: '10000000-0000-4000-8000-000000000501',
      workspaceId: owner.workspaceId,
      projectId,
      workItemId,
      author: owner,
      body: 'Initial implementation note.',
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

function seedCurrentUser() {
  const currentUser = TestBed.inject(CurrentUserService);
  currentUser.members.set([owner, contributor, inactiveMember]);
  currentUser.selectMember(owner.id);
}

function setup(input: { workItem?: WorkItemDetailDto; project?: ProjectDto } = {}) {
  const fixture = TestBed.createComponent(WorkItemDetailPageComponent);
  const http = TestBed.inject(HttpTestingController);
  const workItem = input.workItem ?? detail;
  const project = input.project ?? activeProject;
  fixture.detectChanges();
  http.expectOne(`/api/work-items/${workItemId}`).flush(workItem);
  http.expectOne(`/api/projects/${projectId}`).flush(project);
  http.expectOne(`/api/projects/${projectId}/labels`).flush([
    { id: frontendLabelId, name: 'frontend', color: '#2563eb', isArchived: false, archivedAt: null },
    { id: labelId, name: 'backend', color: '#059669', isArchived: false, archivedAt: null }
  ]);
  http.expectOne(`/api/projects/${projectId}/milestones`).flush([activeMilestone, nextMilestone]);
  fixture.detectChanges();
  return { fixture, http };
}

describe('WorkItemDetailPageComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WorkItemDetailPageComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ workItemId })
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
    expect(compiled.textContent).toContain('frontend');
    expect(compiled.textContent).toContain('backend');
    expect(compiled.textContent).toContain('v0.0.3');
    expect(compiled.textContent).toContain('Initial implementation note.');
    expect(compiled.textContent).toContain('Avery Owner created this work item.');
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
    http.expectOne(`/api/projects/${projectId}`).flush(activeProject);
    http.expectOne(`/api/projects/${projectId}/labels`).flush([
      { id: frontendLabelId, name: 'frontend', color: '#2563eb', isArchived: false, archivedAt: null },
      { id: labelId, name: 'backend', color: '#059669', isArchived: false, archivedAt: null }
    ]);
    http.expectOne(`/api/projects/${projectId}/milestones`).flush([activeMilestone]);
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
    http.expectOne(`/api/projects/${projectId}`).flush(archivedProject);
    http.expectOne(`/api/projects/${projectId}/labels`).flush([
      { id: frontendLabelId, name: 'frontend', color: '#2563eb', isArchived: false, archivedAt: null },
      { id: labelId, name: 'backend', color: '#059669', isArchived: false, archivedAt: null }
    ]);
    http.expectOne(`/api/projects/${projectId}/milestones`).flush([activeMilestone]);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Archived project');
    expect(compiled.querySelector('button[type="submit"]')?.hasAttribute('disabled')).toBeTrue();
    expect(compiled.querySelector('input[type="checkbox"]')?.hasAttribute('disabled')).toBeTrue();

    fixture.componentInstance.detailForm.patchValue({ title: 'Archived edit attempt' });
    fixture.componentInstance.updateWorkItem();
    fixture.componentInstance.statusForm.setValue({ status: 'done' });
    fixture.componentInstance.transitionStatus();
    fixture.componentInstance.commentForm.setValue({ body: 'Archived comment attempt.' });
    fixture.componentInstance.addComment();

    http.expectNone(`/api/work-items/${workItemId}`);
    http.expectNone(`/api/work-items/${workItemId}/transitions`);
    http.expectNone(`/api/work-items/${workItemId}/comments`);
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
});
