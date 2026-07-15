import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type {
  MemberDto,
  MilestoneDto,
  MyWorkDashboardDto,
  WorkspaceWorkItemListItemDto
} from '@worktrail/contracts';

import { CurrentUserService } from '../../core/current-user.service';
import { MyWorkPageComponent } from './my-work-page.component';

const workspaceId = '10000000-0000-4000-8000-000000000001';
const projectId = '10000000-0000-4000-8000-000000000201';
const workItemId = '10000000-0000-4000-8000-000000000401';

const owner: MemberDto = {
  id: '10000000-0000-4000-8000-000000000101',
  workspaceId,
  name: 'Avery Owner',
  email: 'avery.owner@example.com',
  role: 'owner',
  isActive: true,
  deactivatedAt: null,
  createdAt: '2026-07-02T12:00:00.000Z',
  updatedAt: '2026-07-03T12:00:00.000Z'
};

const contributor: MemberDto = {
  id: '10000000-0000-4000-8000-000000000103',
  workspaceId,
  name: 'Case Contributor',
  email: 'case.contributor@example.com',
  role: 'contributor',
  isActive: true,
  deactivatedAt: null,
  createdAt: '2026-07-02T12:00:00.000Z',
  updatedAt: '2026-07-03T12:00:00.000Z'
};

const milestone: MilestoneDto = {
  id: '10000000-0000-4000-8000-000000000501',
  workspaceId,
  projectId,
  name: 'v0.0.5',
  description: 'Daily operating surface.',
  status: 'active',
  targetDate: '2026-07-18',
  isArchived: false,
  archivedAt: null,
  createdAt: '2026-07-03T12:00:00.000Z',
  updatedAt: '2026-07-04T12:00:00.000Z'
};

const workItem: WorkspaceWorkItemListItemDto = {
  id: workItemId,
  workspaceId,
  projectId,
  itemNumber: 1,
  displayKey: 'WT-1',
  title: 'Shape the default dashboard',
  type: 'story',
  status: 'in_progress',
  priority: 'high',
  assignee: owner,
  reporter: contributor,
  labels: [],
  milestone,
  cycle: null,
  boardPosition: 1024,
  dueDate: '2026-07-08',
  estimatePoints: 5,
  parent: null,
  childSummary: null,
  dependencyBlocked: false,
  openBlockerCount: 0,
  openBlockedWorkCount: 0,
  createdAt: '2026-07-02T12:00:00.000Z',
  updatedAt: '2026-07-04T12:00:00.000Z',
  project: {
    id: projectId,
    key: 'WT',
    name: 'Worktrail App',
    status: 'active'
  }
};

const dependencyBlockedWorkItem: WorkspaceWorkItemListItemDto = {
  ...workItem,
  id: '10000000-0000-4000-8000-000000000402',
  itemNumber: 2,
  displayKey: 'WT-2',
  title: 'Wait for import adapter',
  status: 'ready',
  dependencyBlocked: true,
  openBlockerCount: 2,
  openBlockedWorkCount: 0
};

const reportedWorkItem: WorkspaceWorkItemListItemDto = {
  ...workItem,
  id: '10000000-0000-4000-8000-000000000403',
  itemNumber: 3,
  displayKey: 'WT-3',
  title: 'Review reported release notes',
  status: 'ready',
  priority: 'medium',
  assignee: contributor,
  reporter: owner,
  dueDate: null,
  dependencyBlocked: false,
  openBlockerCount: 0,
  updatedAt: '2026-07-04T10:00:00.000Z'
};

function dashboard(input: Partial<MyWorkDashboardDto> = {}): MyWorkDashboardDto {
  return {
    actor: owner,
    summaryCounts: [
      {
        key: 'assigned_open',
        label: 'Assigned open',
        count: 3,
        query: { assigneeId: owner.id, workState: 'open' }
      },
      {
        key: 'blocked',
        label: 'Blocked',
        count: 1,
        query: { blocked: true, workState: 'open' }
      },
      {
        key: 'dependency_blocked',
        label: 'Dependency blocked',
        count: 1,
        query: { assigneeId: owner.id, workState: 'open', dependency: 'dependency_blocked' }
      }
    ],
    assignedToMe: [workItem],
    dueSoonOrOverdue: [workItem],
    blockedRelevant: [],
    dependencyBlockedAssigned: [],
    reportedByMe: [],
    recentlyUpdated: [workItem],
    ...input
  };
}

function seedCurrentUser(member: MemberDto = owner): void {
  const currentUser = TestBed.inject(CurrentUserService);
  currentUser.members.set([owner, contributor]);
  currentUser.selectMember(member.id);
}

function setup(member: MemberDto = owner): {
  fixture: ComponentFixture<MyWorkPageComponent>;
  http: HttpTestingController;
} {
  seedCurrentUser(member);
  const fixture = TestBed.createComponent(MyWorkPageComponent);
  const http = TestBed.inject(HttpTestingController);
  fixture.detectChanges();
  return { fixture, http };
}

function flushInboxCount(http: HttpTestingController, unreadCount = 2): void {
  http.expectOne('/api/notifications/unread-count').flush({ unreadCount });
}

describe('MyWorkPageComponent', () => {
  beforeEach(async () => {
    localStorage.clear();
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date('2026-07-08T12:00:00.000Z'));

    await TestBed.configureTestingModule({
      imports: [MyWorkPageComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])]
    }).compileComponents();
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    jasmine.clock().uninstall();
  });

  it('renders a deduped attention queue and secondary reported work', () => {
    const { fixture, http } = setup();
    const request = http.expectOne('/api/my-work');
    expect(request.request.headers.get('x-worktrail-member-id')).toBe(owner.id);
    flushInboxCount(http, 2);
    request.flush(
      dashboard({
        assignedToMe: [workItem, dependencyBlockedWorkItem],
        dueSoonOrOverdue: [workItem],
        dependencyBlockedAssigned: [dependencyBlockedWorkItem],
        reportedByMe: [reportedWorkItem],
        recentlyUpdated: [workItem, dependencyBlockedWorkItem, reportedWorkItem]
      })
    );
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const summaryButtons = Array.from(compiled.querySelectorAll<HTMLButtonElement>('.summary-card'));
    const queueRows = Array.from(compiled.querySelectorAll<HTMLAnchorElement>('.queue-row'));
    const secondaryRows = Array.from(compiled.querySelectorAll<HTMLAnchorElement>('.work-row'));

    expect(compiled.textContent).toContain('Avery Owner');
    expect(compiled.textContent).toContain('Owner');
    expect(compiled.textContent).toContain('Assigned open');
    expect(compiled.textContent).toContain('Dependency blocked');
    expect(compiled.textContent).toContain('Needs attention');
    expect(compiled.textContent).toContain('Next actions');
    expect(compiled.textContent).toContain('Shape the default dashboard');
    expect(compiled.textContent).toContain('Wait for import adapter');
    expect(compiled.textContent).toContain('Reported by me');
    expect(compiled.textContent).toContain('Inbox');
    expect(compiled.textContent).toContain('2 unread notifications.');
    expect(compiled.textContent).toContain('Review reported release notes');
    expect(compiled.textContent).toContain('Blocked by 2');
    expect(compiled.textContent).toContain('WT-1');
    expect(compiled.textContent).toContain('Story · In progress · High');
    expect(compiled.textContent).toContain('v0.0.5');
    expect(compiled.textContent).toContain('Due Jul 8');
    expect(summaryButtons[0].textContent).toContain('Assigned open');
    expect(queueRows.map((row) => row.getAttribute('href'))).toEqual([
      `/work-items/${dependencyBlockedWorkItem.id}?returnUrl=%2Fmy-work`,
      `/work-items/${workItem.id}?returnUrl=%2Fmy-work`
    ]);
    expect(queueRows.filter((row) => row.textContent?.includes('Shape the default dashboard')).length)
      .toBe(1);
    expect(secondaryRows.map((row) => row.getAttribute('href'))).toEqual([
      `/work-items/${reportedWorkItem.id}?returnUrl=%2Fmy-work`
    ]);
  });

  it('uses summary cards as queue filters with full-list links', () => {
    const { fixture, http } = setup();
    flushInboxCount(http, 2);
    http.expectOne('/api/my-work').flush(
      dashboard({
        assignedToMe: [workItem, dependencyBlockedWorkItem],
        dueSoonOrOverdue: [workItem],
        dependencyBlockedAssigned: [dependencyBlockedWorkItem]
      })
    );
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const dependencyButton = Array.from(
      compiled.querySelectorAll<HTMLButtonElement>('.summary-card')
    ).find((button) => button.textContent?.includes('Dependency blocked'));
    dependencyButton?.click();
    fixture.detectChanges();

    const queueRows = Array.from(compiled.querySelectorAll<HTMLAnchorElement>('.queue-row'));
    const fullListLink = Array.from(compiled.querySelectorAll<HTMLAnchorElement>('.active-filter a'))
      .at(0);

    expect(compiled.textContent).toContain('Queue focus: Dependency blocked');
    expect(fullListLink?.getAttribute('href')).toContain('dependency=dependency_blocked');
    expect(queueRows.length).toBe(1);
    expect(queueRows[0].textContent).toContain('Wait for import adapter');
  });

  it('renders compact empty states for low-signal sections', () => {
    const { fixture, http } = setup();
    flushInboxCount(http, 0);
    http.expectOne('/api/my-work').flush(
      dashboard({
        summaryCounts: [],
        assignedToMe: [],
        dueSoonOrOverdue: [],
        blockedRelevant: [],
        dependencyBlockedAssigned: [],
        reportedByMe: [],
        recentlyUpdated: []
      })
    );
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('No attention needed');
    expect(text).toContain('No unread notifications.');
    expect(text).toContain('No reported open work');
    expect(text).not.toContain('No recent work');
  });

  it('refreshes dashboard data when the selected actor changes', () => {
    const { fixture, http } = setup();
    flushInboxCount(http, 2);
    http.expectOne('/api/my-work').flush(dashboard());
    fixture.detectChanges();

    TestBed.inject(CurrentUserService).selectMember(contributor.id);
    fixture.detectChanges();

    const unreadRequest = http.expectOne('/api/notifications/unread-count');
    expect(unreadRequest.request.headers.get('x-worktrail-member-id')).toBe(contributor.id);
    unreadRequest.flush({ unreadCount: 1 });

    const request = http.expectOne('/api/my-work');
    expect(request.request.headers.get('x-worktrail-member-id')).toBe(contributor.id);
    request.flush(
      dashboard({
        actor: contributor,
        assignedToMe: [{ ...workItem, assignee: contributor, title: 'Review workspace discovery' }]
      })
    );
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Case Contributor');
    expect(text).toContain('Review workspace discovery');
  });

  it('shows an error state and retries the request', () => {
    const { fixture, http } = setup();
    flushInboxCount(http, 2);
    http.expectOne('/api/my-work').flush(
      { message: 'unavailable' },
      { status: 500, statusText: 'Server Error' }
    );
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('My Work unavailable');
    expect(compiled.textContent).toContain('My Work could not be loaded from the API.');

    compiled.querySelector<HTMLButtonElement>('button')?.click();
    fixture.detectChanges();

    const retry = http.expectOne('/api/my-work');
    expect(retry.request.method).toBe('GET');
    retry.flush(dashboard());
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Shape the default dashboard');
  });
});
