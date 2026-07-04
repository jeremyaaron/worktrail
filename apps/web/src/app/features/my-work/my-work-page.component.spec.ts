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
  boardPosition: 1024,
  dueDate: '2026-07-08',
  estimatePoints: 5,
  createdAt: '2026-07-02T12:00:00.000Z',
  updatedAt: '2026-07-04T12:00:00.000Z',
  project: {
    id: projectId,
    key: 'WT',
    name: 'Worktrail App',
    status: 'active'
  }
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
      }
    ],
    assignedToMe: [workItem],
    dueSoonOrOverdue: [workItem],
    blockedRelevant: [],
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

describe('MyWorkPageComponent', () => {
  beforeEach(async () => {
    localStorage.clear();

    await TestBed.configureTestingModule({
      imports: [MyWorkPageComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])]
    }).compileComponents();
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  it('renders summary links and dense work rows', () => {
    const { fixture, http } = setup();
    const request = http.expectOne('/api/my-work');
    expect(request.request.headers.get('x-worktrail-member-id')).toBe(owner.id);
    request.flush(dashboard());
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const summaryLinks = Array.from(compiled.querySelectorAll<HTMLAnchorElement>('.summary-card'));
    const workRows = Array.from(compiled.querySelectorAll<HTMLAnchorElement>('.work-row'));

    expect(compiled.textContent).toContain('Avery Owner');
    expect(compiled.textContent).toContain('Owner');
    expect(compiled.textContent).toContain('Assigned open');
    expect(compiled.textContent).toContain('Shape the default dashboard');
    expect(compiled.textContent).toContain('WT-1');
    expect(compiled.textContent).toContain('Story · In progress · High');
    expect(compiled.textContent).toContain('v0.0.5');
    expect(compiled.textContent).toContain('Due Jul 8');
    expect(summaryLinks[0].getAttribute('href')).toContain('/work-items?assigneeId=');
    expect(summaryLinks[0].getAttribute('href')).toContain('workState=open');
    expect(summaryLinks[1].getAttribute('href')).toContain('blocked=true');
    expect(workRows[0].getAttribute('href')).toBe(`/work-items/${workItem.id}`);
  });

  it('renders specific empty states for dashboard sections', () => {
    const { fixture, http } = setup();
    http.expectOne('/api/my-work').flush(
      dashboard({
        summaryCounts: [],
        assignedToMe: [],
        dueSoonOrOverdue: [],
        blockedRelevant: [],
        recentlyUpdated: []
      })
    );
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('No assigned work');
    expect(text).toContain('No urgent due dates');
    expect(text).toContain('No relevant blockers');
    expect(text).toContain('No recent work');
  });

  it('refreshes dashboard data when the selected actor changes', () => {
    const { fixture, http } = setup();
    http.expectOne('/api/my-work').flush(dashboard());
    fixture.detectChanges();

    TestBed.inject(CurrentUserService).selectMember(contributor.id);
    fixture.detectChanges();

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
