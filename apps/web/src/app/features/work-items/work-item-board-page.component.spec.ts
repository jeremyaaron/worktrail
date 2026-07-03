import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import type { MemberDto, WorkItemDetailDto, WorkItemListItemDto } from '@worktrail/contracts';

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

const readyItem: WorkItemListItemDto = {
  id: '10000000-0000-4000-8000-000000000402',
  workspaceId: owner.workspaceId,
  projectId,
  title: 'Ready board item',
  type: 'story',
  status: 'ready',
  priority: 'high',
  assignee: owner,
  reporter: owner,
  labels: [{ id: '10000000-0000-4000-8000-000000000301', name: 'frontend', color: '#2563eb' }],
  dueDate: null,
  estimatePoints: 3,
  createdAt: '2026-07-02T12:00:00.000Z',
  updatedAt: '2026-07-03T12:00:00.000Z'
};

const movedItem: WorkItemListItemDto = {
  ...readyItem,
  status: 'in_progress'
};

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
    const request = http.expectOne((candidate) => {
      return (
        candidate.url === `/api/projects/${projectId}/work-items` &&
        candidate.params.get('sort') === 'priority_desc'
      );
    });
    request.flush([readyItem]);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('backlog');
    expect(compiled.textContent).toContain('ready');
    expect(compiled.textContent).toContain('in progress');
    expect(compiled.textContent).toContain('Ready board item');
    expect(compiled.textContent).toContain('No cards');
  });

  it('moves a card through the status menu and refreshes board state', () => {
    const { fixture, http } = setup();
    http.expectOne((candidate) => candidate.url === `/api/projects/${projectId}/work-items`).flush([
      readyItem
    ]);
    fixture.detectChanges();

    fixture.componentInstance.transitionCard(readyItem, {
      target: { value: 'in_progress' }
    } as unknown as Event);

    const transition = http.expectOne(`/api/work-items/${readyItem.id}/transitions`);
    expect(transition.request.method).toBe('POST');
    expect(transition.request.body).toEqual({ status: 'in_progress' });
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

  it('shows a clear error when a transition is rejected', () => {
    const { fixture, http } = setup();
    http.expectOne((candidate) => candidate.url === `/api/projects/${projectId}/work-items`).flush([
      readyItem
    ]);
    fixture.detectChanges();

    fixture.componentInstance.transitionCard(readyItem, {
      target: { value: 'done' }
    } as unknown as Event);

    const transition = http.expectOne(`/api/work-items/${readyItem.id}/transitions`);
    transition.flush(
      { error: { code: 'WORKFLOW_TRANSITION_ERROR', message: 'Rejected.' } },
      { status: 409, statusText: 'Conflict' }
    );
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'The requested status transition was rejected.'
    );
  });
});
