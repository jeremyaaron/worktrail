import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import type { MemberDto, ProjectDto, WorkItemDetailDto, WorkItemListItemDto } from '@worktrail/contracts';

import { WorkItemBoardPageComponent } from './work-item-board-page.component';

const projectId = '10000000-0000-4000-8000-000000000201';
const owner: MemberDto = {
  id: '10000000-0000-4000-8000-000000000101',
  workspaceId: '10000000-0000-4000-8000-000000000001',
  name: 'Avery Owner',
  email: 'avery.owner@example.com',
  role: 'owner',
  isActive: true
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

const readyItem: WorkItemListItemDto = {
  id: '10000000-0000-4000-8000-000000000402',
  workspaceId: owner.workspaceId,
  projectId,
  itemNumber: 2,
  displayKey: 'WT-2',
  title: 'Ready board item',
  type: 'story',
  status: 'ready',
  priority: 'high',
  assignee: owner,
  reporter: owner,
  labels: [
    {
      id: '10000000-0000-4000-8000-000000000301',
      name: 'frontend',
      color: '#2563eb',
      isArchived: false,
      archivedAt: null
    }
  ],
  milestone: null,
  boardPosition: 1024,
  dueDate: null,
  estimatePoints: 3,
  createdAt: '2026-07-02T12:00:00.000Z',
  updatedAt: '2026-07-03T12:00:00.000Z'
};

const movedItem: WorkItemListItemDto = {
  ...readyItem,
  status: 'in_progress'
};

function dropEvent(input: {
  item: WorkItemListItemDto;
  previousStatus: WorkItemListItemDto['status'];
  status: WorkItemListItemDto['status'];
  previousIndex?: number;
  currentIndex?: number;
}) {
  const previousContainer = { data: input.previousStatus };
  const container =
    input.previousStatus === input.status ? previousContainer : { data: input.status };

  return {
    item: { data: input.item },
    previousContainer,
    container,
    previousIndex: input.previousIndex ?? 0,
    currentIndex: input.currentIndex ?? 0
  };
}

function setup() {
  const fixture = TestBed.createComponent(WorkItemBoardPageComponent);
  const http = TestBed.inject(HttpTestingController);
  fixture.detectChanges();
  return { fixture, http };
}

describe('WorkItemBoardPageComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WorkItemBoardPageComponent],
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

  it('renders all board columns and groups cards by status', () => {
    const { fixture, http } = setup();
    http.expectOne(`/api/projects/${projectId}`).flush(activeProject);
    const request = http.expectOne((candidate) => {
      return (
        candidate.url === `/api/projects/${projectId}/work-items` &&
        candidate.params.get('sort') === 'board_order'
      );
    });
    request.flush([readyItem]);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('backlog');
    expect(compiled.textContent).toContain('ready');
    expect(compiled.textContent).toContain('in progress');
    expect(compiled.textContent).toContain('WT-2');
    expect(compiled.textContent).toContain('Ready board item');
    expect(compiled.textContent).toContain('No cards');
    expect(compiled.querySelector('select')?.value).toBe('ready');
  });

  it('moves a card through the status menu and refreshes board state', () => {
    const { fixture, http } = setup();
    http.expectOne(`/api/projects/${projectId}`).flush(activeProject);
    http.expectOne((candidate) => candidate.url === `/api/projects/${projectId}/work-items`).flush([
      readyItem
    ]);
    fixture.detectChanges();

    fixture.componentInstance.transitionCard(readyItem, {
      target: { value: 'in_progress' }
    } as unknown as Event);

    expect(fixture.componentInstance.itemsByStatus().get('in_progress')).toEqual([
      { ...readyItem, status: 'in_progress' }
    ]);

    const transition = http.expectOne(`/api/work-items/${readyItem.id}/board-move`);
    expect(transition.request.method).toBe('POST');
    expect(transition.request.body).toEqual({
      status: 'in_progress',
      beforeWorkItemId: null,
      afterWorkItemId: null
    });
    transition.flush({
      ...readyItem,
      status: 'in_progress',
      description: '',
      comments: [],
      activity: []
    } satisfies WorkItemDetailDto);

    const refresh = http.expectOne((candidate) => candidate.url === `/api/projects/${projectId}/work-items`);
    refresh.flush([movedItem]);
    fixture.detectChanges();

    expect(fixture.componentInstance.itemsByStatus().get('in_progress')).toEqual([movedItem]);
  });

  it('moves a card through drag and drop with neighbor hints and refreshes board state', () => {
    const { fixture, http } = setup();
    const inProgressItem: WorkItemListItemDto = {
      ...readyItem,
      id: '10000000-0000-4000-8000-000000000404',
      displayKey: 'WT-4',
      title: 'Existing in-progress board item',
      status: 'in_progress',
      boardPosition: 1024
    };
    http.expectOne(`/api/projects/${projectId}`).flush(activeProject);
    http.expectOne((candidate) => candidate.url === `/api/projects/${projectId}/work-items`).flush([
      readyItem,
      inProgressItem
    ]);
    fixture.detectChanges();

    fixture.componentInstance.dropCard(
      dropEvent({
        item: readyItem,
        previousStatus: 'ready',
        status: 'in_progress',
        previousIndex: 0,
        currentIndex: 1
      }) as never
    );

    expect(fixture.componentInstance.itemsByStatus().get('in_progress')).toEqual([
      inProgressItem,
      { ...readyItem, status: 'in_progress' }
    ]);

    const transition = http.expectOne(`/api/work-items/${readyItem.id}/board-move`);
    expect(transition.request.method).toBe('POST');
    expect(transition.request.body).toEqual({
      status: 'in_progress',
      beforeWorkItemId: inProgressItem.id,
      afterWorkItemId: null
    });
    transition.flush({
      ...readyItem,
      status: 'in_progress',
      description: '',
      comments: [],
      activity: []
    } satisfies WorkItemDetailDto);

    const refresh = http.expectOne((candidate) => candidate.url === `/api/projects/${projectId}/work-items`);
    refresh.flush([inProgressItem, movedItem]);
    fixture.detectChanges();

    expect(fixture.componentInstance.itemsByStatus().get('in_progress')).toEqual([
      inProgressItem,
      movedItem
    ]);
  });

  it('reorders cards within the same column with neighbor hints', () => {
    const firstItem: WorkItemListItemDto = { ...readyItem, boardPosition: 1024 };
    const secondItem: WorkItemListItemDto = {
      ...readyItem,
      id: '10000000-0000-4000-8000-000000000405',
      displayKey: 'WT-5',
      title: 'Second ready board item',
      boardPosition: 2048
    };
    const thirdItem: WorkItemListItemDto = {
      ...readyItem,
      id: '10000000-0000-4000-8000-000000000406',
      displayKey: 'WT-6',
      title: 'Third ready board item',
      boardPosition: 3072
    };
    const { fixture, http } = setup();
    http.expectOne(`/api/projects/${projectId}`).flush(activeProject);
    http.expectOne((candidate) => candidate.url === `/api/projects/${projectId}/work-items`).flush([
      firstItem,
      secondItem,
      thirdItem
    ]);
    fixture.detectChanges();

    fixture.componentInstance.dropCard(
      dropEvent({
        item: thirdItem,
        previousStatus: 'ready',
        status: 'ready',
        previousIndex: 2,
        currentIndex: 1
      }) as never
    );

    expect(fixture.componentInstance.itemsByStatus().get('ready')).toEqual([
      firstItem,
      thirdItem,
      secondItem
    ]);

    const request = http.expectOne(`/api/work-items/${thirdItem.id}/board-move`);
    expect(request.request.body).toEqual({
      status: 'ready',
      beforeWorkItemId: firstItem.id,
      afterWorkItemId: secondItem.id
    });
    request.flush({ ...thirdItem, description: '', comments: [], activity: [] } satisfies WorkItemDetailDto);

    const refresh = http.expectOne((candidate) => candidate.url === `/api/projects/${projectId}/work-items`);
    refresh.flush([firstItem, thirdItem, secondItem]);
  });

  it('ignores same-index same-column drops without calling the move API', () => {
    const { fixture, http } = setup();
    http.expectOne(`/api/projects/${projectId}`).flush(activeProject);
    http.expectOne((candidate) => candidate.url === `/api/projects/${projectId}/work-items`).flush([
      readyItem
    ]);
    fixture.detectChanges();

    fixture.componentInstance.dropCard(
      dropEvent({
        item: readyItem,
        previousStatus: 'ready',
        status: 'ready',
        previousIndex: 0,
        currentIndex: 0
      }) as never
    );

    expect(fixture.componentInstance.itemsByStatus().get('ready')).toEqual([readyItem]);
    http.expectNone(`/api/work-items/${readyItem.id}/board-move`);
  });

  it('shows a clear error and resets the select when a status menu move is rejected', () => {
    const { fixture, http } = setup();
    http.expectOne(`/api/projects/${projectId}`).flush(activeProject);
    http.expectOne((candidate) => candidate.url === `/api/projects/${projectId}/work-items`).flush([
      readyItem
    ]);
    fixture.detectChanges();

    fixture.componentInstance.transitionCard(readyItem, {
      target: { value: 'done' }
    } as unknown as Event);

    const transition = http.expectOne(`/api/work-items/${readyItem.id}/board-move`);
    expect(transition.request.body).toEqual({
      status: 'done',
      beforeWorkItemId: null,
      afterWorkItemId: null
    });
    transition.flush(
      { error: { code: 'WORKFLOW_TRANSITION_ERROR', message: 'Rejected.' } },
      { status: 409, statusText: 'Conflict' }
    );
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'The board move was rejected.'
    );
    expect(fixture.componentInstance.itemsByStatus().get('ready')).toEqual([readyItem]);
  });

  it('rolls back optimistic drag moves when the board move is rejected', () => {
    const { fixture, http } = setup();
    http.expectOne(`/api/projects/${projectId}`).flush(activeProject);
    http.expectOne((candidate) => candidate.url === `/api/projects/${projectId}/work-items`).flush([
      readyItem
    ]);
    fixture.detectChanges();

    fixture.componentInstance.dropCard(
      dropEvent({
        item: readyItem,
        previousStatus: 'ready',
        status: 'done',
        previousIndex: 0,
        currentIndex: 0
      }) as never
    );

    expect(fixture.componentInstance.itemsByStatus().get('done')).toEqual([
      { ...readyItem, status: 'done' }
    ]);

    const transition = http.expectOne(`/api/work-items/${readyItem.id}/board-move`);
    expect(transition.request.body).toEqual({
      status: 'done',
      beforeWorkItemId: null,
      afterWorkItemId: null
    });
    transition.flush(
      { error: { code: 'WORKFLOW_TRANSITION_ERROR', message: 'Rejected.' } },
      { status: 409, statusText: 'Conflict' }
    );
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'The board move was rejected.'
    );
    expect(fixture.componentInstance.itemsByStatus().get('ready')).toEqual([readyItem]);
    expect(fixture.componentInstance.itemsByStatus().get('done')).toEqual([]);
  });

  it('renders archived projects as read-only and skips transition requests', () => {
    const { fixture, http } = setup();
    http.expectOne(`/api/projects/${projectId}`).flush(archivedProject);
    http.expectOne((candidate) => candidate.url === `/api/projects/${projectId}/work-items`).flush([
      readyItem
    ]);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Archived project');
    expect(compiled.textContent).not.toContain('Create work item');
    expect(compiled.querySelector('select')?.hasAttribute('disabled')).toBeTrue();

    fixture.componentInstance.transitionCard(readyItem, {
      target: { value: 'in_progress' }
    } as unknown as Event);

    http.expectNone(`/api/work-items/${readyItem.id}/board-move`);
  });
});
