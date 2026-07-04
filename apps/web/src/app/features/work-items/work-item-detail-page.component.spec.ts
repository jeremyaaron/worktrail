import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import type { MemberDto, WorkItemDetailDto } from '@worktrail/contracts';

import { CurrentUserService } from '../../core/current-user.service';
import { WorkItemDetailPageComponent } from './work-item-detail-page.component';

const projectId = '10000000-0000-4000-8000-000000000201';
const workItemId = '10000000-0000-4000-8000-000000000403';
const ownerId = '10000000-0000-4000-8000-000000000101';
const contributorId = '10000000-0000-4000-8000-000000000103';
const labelId = '10000000-0000-4000-8000-000000000302';
const frontendLabelId = '10000000-0000-4000-8000-000000000301';
const archivedLabelId = '10000000-0000-4000-8000-000000000399';

const owner: MemberDto = {
  id: ownerId,
  workspaceId: '10000000-0000-4000-8000-000000000001',
  name: 'Avery Owner',
  email: 'avery.owner@example.com',
  role: 'owner',
  isActive: true
};

const contributor: MemberDto = {
  id: contributorId,
  workspaceId: owner.workspaceId,
  name: 'Case Contributor',
  email: 'case.contributor@example.com',
  role: 'contributor',
  isActive: true
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
  currentUser.members.set([owner, contributor]);
  currentUser.selectMember(owner.id);
}

function setup() {
  const fixture = TestBed.createComponent(WorkItemDetailPageComponent);
  const http = TestBed.inject(HttpTestingController);
  fixture.detectChanges();
  http.expectOne(`/api/work-items/${workItemId}`).flush(detail);
  http.expectOne(`/api/projects/${projectId}/labels`).flush([
    { id: frontendLabelId, name: 'frontend', color: '#2563eb', isArchived: false, archivedAt: null },
    { id: labelId, name: 'backend', color: '#059669', isArchived: false, archivedAt: null }
  ]);
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

    expect(compiled.textContent).toContain('Implement detail surface');
    expect(compiled.textContent).toContain('frontend');
    expect(compiled.textContent).toContain('backend');
    expect(compiled.textContent).toContain('Initial implementation note.');
    expect(compiled.textContent).toContain('Avery Owner created this work item.');
  });

  it('updates editable fields and project labels through the patch endpoint', () => {
    const { fixture, http } = setup();
    fixture.componentInstance.detailForm.patchValue({
      title: 'Updated detail surface',
      description: 'Updated description.',
      type: 'story',
      priority: 'urgent',
      assigneeId: owner.id
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
    http.expectOne(`/api/projects/${projectId}/labels`).flush([
      { id: frontendLabelId, name: 'frontend', color: '#2563eb', isArchived: false, archivedAt: null },
      { id: labelId, name: 'backend', color: '#059669', isArchived: false, archivedAt: null }
    ]);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('legacy');
    expect(fixture.componentInstance.assignableLabels().map((label) => label.id)).not.toContain(
      archivedLabelId
    );

    fixture.componentInstance.updateWorkItem();
    const request = http.expectOne(`/api/work-items/${workItemId}`);
    expect(request.request.body.labelIds).toEqual([labelId, archivedLabelId]);
    request.flush(archivedDetail);
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
