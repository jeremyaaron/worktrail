import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { MemberDto, WorkItemDetailDto, WorkItemListItemDto } from '@worktrail/contracts';

import { WorkItemChildWorkComponent } from './work-item-child-work.component';

const member: MemberDto = {
  id: 'member-1',
  workspaceId: 'workspace-1',
  name: 'Avery Owner',
  email: 'avery@example.com',
  role: 'owner',
  isActive: true,
  deactivatedAt: null,
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z'
};

const parentItem: WorkItemDetailDto = {
  id: 'work-item-3',
  workspaceId: 'workspace-1',
  projectId: 'project-1',
  itemNumber: 3,
  displayKey: 'WT-3',
  title: 'Coordinate the release work breakdown',
  description: 'Parent work item.',
  type: 'story',
  status: 'in_progress',
  priority: 'high',
  assignee: member,
  reporter: member,
  labels: [],
  milestone: null,
  cycle: null,
  boardPosition: 1024,
  dueDate: null,
  estimatePoints: 8,
  parent: null,
  childSummary: {
    totalCount: 12,
    openCount: 8,
    doneCount: 3,
    canceledCount: 1,
    estimatedCount: 9,
    unestimatedCount: 3,
    estimatePoints: 34
  },
  dependencyBlocked: false,
  openBlockerCount: 0,
  openBlockedWorkCount: 0,
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-02T00:00:00.000Z',
  relationships: {
    blockedBy: [],
    blocks: [],
    related: [],
    dependencyBlocked: false,
    openBlockerCount: 0,
    openBlockedWorkCount: 0
  },
  comments: [],
  activity: []
};

const childItem: WorkItemListItemDto = {
  ...parentItem,
  id: 'work-item-4',
  itemNumber: 4,
  displayKey: 'WT-4',
  title: 'Verify an intentionally long child work item title wraps without widening the detail page',
  status: 'ready',
  estimatePoints: 5,
  parent: {
    id: parentItem.id,
    projectId: parentItem.projectId,
    displayKey: parentItem.displayKey,
    title: parentItem.title,
    type: parentItem.type,
    status: parentItem.status
  },
  childSummary: null
};

describe('WorkItemChildWorkComponent', () => {
  let fixture: ComponentFixture<WorkItemChildWorkComponent>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WorkItemChildWorkComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(WorkItemChildWorkComponent);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads bounded direct children and preserves hierarchy navigation context', () => {
    fixture.componentRef.setInput('item', parentItem);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Loading child work');
    const request = http.expectOne(
      (candidate) => candidate.url === `/api/work-items/${parentItem.id}/children`
    );
    expect(request.request.params.get('limit')).toBe('8');
    request.flush({ items: [childItem], totalCount: 12, hasMore: true });
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const childLink = compiled.querySelector<HTMLAnchorElement>('.child-row');
    const links = Array.from(compiled.querySelectorAll<HTMLAnchorElement>('.child-work__actions a'));
    const addLink = links.find((link) => link.textContent?.includes('Add child'));
    const viewAllLink = links.find((link) => link.textContent?.includes('View all'));

    expect(compiled.textContent).toContain('Total12');
    expect(compiled.textContent).toContain('Open8');
    expect(compiled.textContent).toContain('Done3');
    expect(compiled.textContent).toContain('Canceled1');
    expect(compiled.textContent).toContain('Estimated9');
    expect(compiled.textContent).toContain('Unestimated3');
    expect(compiled.textContent).toContain('Child points34');
    expect(compiled.textContent).toContain(childItem.title);
    expect(compiled.textContent).toContain('Showing 1 of 12 direct children.');
    expect(childLink?.getAttribute('href')).toContain(`/work-items/${childItem.id}`);
    expect(childLink?.getAttribute('href')).toContain('returnUrl=%2Fwork-items%2Fwork-item-3');
    expect(addLink?.getAttribute('href')).toContain('parentWorkItemId=work-item-3');
    expect(addLink?.getAttribute('href')).toContain('returnUrl=%2Fwork-items%2Fwork-item-3');
    expect(viewAllLink?.getAttribute('href')).toContain('parentKey=WT-3');
  });

  it('owns its error, retry, and empty states independently', () => {
    fixture.componentRef.setInput('item', parentItem);
    fixture.detectChanges();
    http.expectOne((candidate) => candidate.url.endsWith('/children')).flush(
      { message: 'unavailable' },
      { status: 500, statusText: 'Server Error' }
    );
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Child work unavailable');
    fixture.componentInstance.loadChildren();
    http.expectOne((candidate) => candidate.url.endsWith('/children')).flush({
      items: [],
      totalCount: 0,
      hasMore: false
    });
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('No child work found');
  });

  it('does not request children for a leaf work item', () => {
    fixture.componentRef.setInput('item', { ...parentItem, childSummary: null });
    fixture.detectChanges();

    http.expectNone((candidate) => candidate.url.endsWith('/children'));
    expect(fixture.componentInstance.children().items).toEqual([]);
  });
});
