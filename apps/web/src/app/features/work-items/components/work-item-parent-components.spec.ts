import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type {
  MemberDto,
  WorkItemDetailDto,
  WorkItemParentCandidateDto,
  WorkItemParentDto
} from '@worktrail/contracts';

import { WorkItemParentContextComponent } from './work-item-parent-context.component';
import { WorkItemParentManagerComponent } from './work-item-parent-manager.component';

const projectId = '10000000-0000-4000-8000-000000000201';
const workItemId = '10000000-0000-4000-8000-000000000403';
const parentWorkItemId = '10000000-0000-4000-8000-000000000404';

const reporter: MemberDto = {
  id: '10000000-0000-4000-8000-000000000101',
  workspaceId: '10000000-0000-4000-8000-000000000001',
  name: 'Avery Owner',
  email: 'avery@example.com',
  role: 'owner',
  isActive: true,
  deactivatedAt: null,
  createdAt: '2026-07-01T12:00:00.000Z',
  updatedAt: '2026-07-01T12:00:00.000Z'
};

const parent: WorkItemParentDto = {
  id: parentWorkItemId,
  projectId,
  displayKey: 'WT-4',
  title: 'Coordinate launch work',
  type: 'story',
  status: 'in_progress'
};

const terminalCandidate: WorkItemParentCandidateDto = {
  ...parent,
  status: 'done',
  priority: 'high',
  updatedAt: '2026-07-14T12:00:00.000Z'
};

const replacementCandidate: WorkItemParentCandidateDto = {
  ...terminalCandidate,
  id: '10000000-0000-4000-8000-000000000405',
  displayKey: 'WT-5',
  title: 'Replace current parent',
  status: 'ready'
};

const detail: WorkItemDetailDto = {
  id: workItemId,
  workspaceId: reporter.workspaceId,
  projectId,
  itemNumber: 3,
  displayKey: 'WT-3',
  title: 'Implement child workflow',
  description: 'Build parent controls.',
  type: 'task',
  status: 'ready',
  priority: 'medium',
  assignee: null,
  reporter,
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
  createdAt: '2026-07-14T12:00:00.000Z',
  updatedAt: '2026-07-14T12:00:00.000Z',
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

function buttonByText(root: HTMLElement, text: string): HTMLButtonElement | undefined {
  return [...root.querySelectorAll<HTMLButtonElement>('button')].find(
    (button) => button.textContent?.trim() === text
  );
}

describe('WorkItemParentContextComponent', () => {
  it('links compact parent identity back through the current child detail', async () => {
    await TestBed.configureTestingModule({
      imports: [WorkItemParentContextComponent],
      providers: [provideRouter([])]
    }).compileComponents();
    const fixture = TestBed.createComponent(WorkItemParentContextComponent);
    fixture.componentRef.setInput('parent', parent);
    fixture.componentRef.setInput('returnUrl', `/work-items/${workItemId}`);
    fixture.detectChanges();

    const link = fixture.nativeElement.querySelector('a') as HTMLAnchorElement;
    expect(fixture.nativeElement.textContent).toContain('Child of');
    expect(fixture.nativeElement.textContent).toContain('WT-4 Coordinate launch work');
    expect(link.getAttribute('href')).toBe(
      `/work-items/${parentWorkItemId}?returnUrl=%2Fwork-items%2F${workItemId}`
    );
  });
});

describe('WorkItemParentManagerComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WorkItemParentManagerComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()]
    }).compileComponents();
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  it('debounces two-character search, labels terminal results, and saves a selection', fakeAsync(() => {
    const fixture = TestBed.createComponent(WorkItemParentManagerComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.componentRef.setInput('item', detail);
    fixture.detectChanges();

    fixture.componentInstance.searchControl.setValue('W');
    tick(300);
    http.expectNone((request) => request.url.includes('parent-candidates'));

    fixture.componentInstance.searchControl.setValue('WT-4');
    tick(299);
    http.expectNone((request) => request.url.includes('parent-candidates'));
    tick(1);
    const search = http.expectOne(
      (request) => request.url === `/api/work-items/${workItemId}/parent-candidates`
    );
    expect(search.request.params.get('search')).toBe('WT-4');
    search.flush([terminalCandidate]);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('WT-4 Coordinate launch work');
    expect(root.textContent).toContain('Done');
    root.querySelector<HTMLButtonElement>('.candidate')?.click();
    fixture.detectChanges();
    expect(buttonByText(root, 'Save parent')?.disabled).toBeFalse();

    const changed = jasmine.createSpy('parentChanged');
    fixture.componentInstance.parentChanged.subscribe(changed);
    buttonByText(root, 'Save parent')?.click();
    const save = http.expectOne(`/api/work-items/${workItemId}/parent`);
    expect(save.request.method).toBe('PUT');
    expect(save.request.body).toEqual({ parentWorkItemId });
    save.flush({ ...detail, parent: terminalCandidate });
    fixture.detectChanges();

    expect(changed).toHaveBeenCalledWith(jasmine.objectContaining({ parent: terminalCandidate }));
  }));

  it('disables no-op save, replaces the current parent, and clears it', () => {
    const child = { ...detail, parent };
    const fixture = TestBed.createComponent(WorkItemParentManagerComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.componentRef.setInput('item', child);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    expect(buttonByText(root, 'Save parent')?.disabled).toBeTrue();
    fixture.componentInstance.selectCandidate(replacementCandidate);
    fixture.componentInstance.saveParent();
    const replace = http.expectOne(`/api/work-items/${workItemId}/parent`);
    expect(replace.request.body).toEqual({ parentWorkItemId: replacementCandidate.id });
    const replacedChild = { ...child, parent: replacementCandidate };
    replace.flush(replacedChild);
    fixture.componentRef.setInput('item', replacedChild);
    fixture.detectChanges();

    buttonByText(root, 'Clear parent')?.click();
    const clear = http.expectOne(`/api/work-items/${workItemId}/parent`);
    expect(clear.request.body).toEqual({ parentWorkItemId: null });
    clear.flush(detail);
  });

  it('preserves a rejected selection and identifies a stale conflict', fakeAsync(() => {
    const fixture = TestBed.createComponent(WorkItemParentManagerComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.componentRef.setInput('item', detail);
    fixture.detectChanges();
    fixture.componentInstance.searchControl.setValue('launch');
    tick(300);
    http.expectOne(`/api/work-items/${workItemId}/parent-candidates?search=launch`).flush([
      terminalCandidate
    ]);
    fixture.detectChanges();
    fixture.componentInstance.selectCandidate(terminalCandidate);
    fixture.componentInstance.saveParent();
    http.expectOne(`/api/work-items/${workItemId}/parent`).flush(
      {
        error: {
          code: 'CONFLICT',
          message: 'The selected work item is no longer eligible as a parent.'
        }
      },
      { status: 409, statusText: 'Conflict' }
    );
    fixture.detectChanges();

    expect(fixture.componentInstance.selectedParent()).toEqual(terminalCandidate);
    expect(fixture.componentInstance.isSelectionStale()).toBeTrue();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'The selected work item is no longer eligible as a parent.'
    );
  }));

  it('renders search errors and empty results as distinct recoverable states', fakeAsync(() => {
    const fixture = TestBed.createComponent(WorkItemParentManagerComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.componentRef.setInput('item', detail);
    fixture.detectChanges();
    fixture.componentInstance.searchControl.setValue('api');
    tick(300);
    http.expectOne(`/api/work-items/${workItemId}/parent-candidates?search=api`).flush(
      { error: { code: 'INTERNAL_ERROR' } },
      { status: 500, statusText: 'Server Error' }
    );
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Eligible parent work could not be loaded.'
    );

    fixture.componentInstance.searchControl.setValue('none');
    tick(300);
    http.expectOne(`/api/work-items/${workItemId}/parent-candidates?search=none`).flush([]);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'No eligible parent work found.'
    );
  }));

  it('does not present mutation controls for archived or parent items', () => {
    const archivedFixture = TestBed.createComponent(WorkItemParentManagerComponent);
    archivedFixture.componentRef.setInput('item', detail);
    archivedFixture.componentRef.setInput('readOnly', true);
    archivedFixture.detectChanges();
    expect((archivedFixture.nativeElement as HTMLElement).textContent).toContain(
      'Parent changes are unavailable while this project is archived.'
    );
    expect(archivedFixture.nativeElement.querySelector('input')).toBeNull();

    const parentFixture = TestBed.createComponent(WorkItemParentManagerComponent);
    parentFixture.componentRef.setInput('item', {
      ...detail,
      childSummary: {
        totalCount: 2,
        openCount: 2,
        doneCount: 0,
        canceledCount: 0,
        estimatedCount: 1,
        unestimatedCount: 1,
        estimatePoints: 3
      }
    });
    parentFixture.detectChanges();
    expect((parentFixture.nativeElement as HTMLElement).textContent).toContain(
      'Work with children cannot be assigned to another parent.'
    );
    expect(parentFixture.nativeElement.querySelector('input')).toBeNull();
  });
});
