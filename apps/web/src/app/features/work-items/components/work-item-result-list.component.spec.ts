import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { MemberDto, MilestoneDto, WorkspaceWorkItemListItemDto } from '@worktrail/contracts';

import { WorkItemResultListComponent } from './work-item-result-list.component';

const owner: MemberDto = {
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

const milestone: MilestoneDto = {
  id: 'milestone-1',
  workspaceId: 'workspace-1',
  projectId: 'project-1',
  name: 'Launch Readiness',
  description: 'Prepare the release.',
  status: 'active',
  targetDate: '2026-07-30',
  isArchived: false,
  archivedAt: null,
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z'
};

const workspaceWorkItem: WorkspaceWorkItemListItemDto = {
  id: 'work-item-1',
  workspaceId: 'workspace-1',
  projectId: 'project-1',
  itemNumber: 42,
  displayKey: 'WT-42',
  title: 'Tighten mobile work item results',
  type: 'story',
  status: 'in_progress',
  priority: 'high',
  assignee: owner,
  reporter: owner,
  labels: [
    {
      id: 'label-1',
      name: 'UX',
      color: '#2563eb',
      isArchived: false,
      archivedAt: null
    }
  ],
  milestone,
  cycle: null,
  boardPosition: 1,
  dueDate: '2026-07-20',
  estimatePoints: 5,
  parent: null,
  childSummary: null,
  dependencyBlocked: true,
  openBlockerCount: 2,
  openBlockedWorkCount: 1,
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-05T12:00:00.000Z',
  project: {
    id: 'project-1',
    key: 'WT',
    name: 'Worktrail',
    status: 'active'
  }
};

describe('WorkItemResultListComponent', () => {
  let fixture: ComponentFixture<WorkItemResultListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WorkItemResultListComponent],
      providers: [provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(WorkItemResultListComponent);
    fixture.componentInstance.items = [workspaceWorkItem];
    fixture.componentInstance.mode = 'workspace';
    fixture.componentInstance.returnUrl = '/work-items?status=ready';
  });

  it('renders mobile cards with the fields needed to scan work items', () => {
    fixture.detectChanges();

    const card = fixture.nativeElement.querySelector('.work-item-card') as HTMLElement | null;
    expect(card).not.toBeNull();
    expect(card?.textContent).toContain('Tighten mobile work item results');
    expect(card?.textContent).toContain('WT-42');
    expect(card?.textContent).toContain('story');
    expect(card?.textContent).toContain('WT');
    expect(card?.textContent).toContain('In progress');
    expect(card?.textContent).toContain('High');
    expect(card?.textContent).toContain('Avery Owner');
    expect(card?.textContent).toContain('Launch Readiness');
    expect(card?.textContent).toContain('Due Jul 20');
    expect(card?.textContent).toContain('Blocked by 2');
    expect(card?.textContent).toContain('UX');
  });

  it('keeps detail links wired with the return URL on table rows and mobile cards', () => {
    fixture.detectChanges();

    const rowLink = fixture.nativeElement.querySelector('.work-item-title-link') as HTMLAnchorElement | null;
    const cardLink = fixture.nativeElement.querySelector('.work-item-card__title-link') as HTMLAnchorElement | null;

    expect(rowLink?.getAttribute('href')).toContain('/work-items/work-item-1');
    expect(rowLink?.getAttribute('href')).toContain('returnUrl=');
    expect(cardLink?.getAttribute('href')).toContain('/work-items/work-item-1');
    expect(cardLink?.getAttribute('href')).toContain('returnUrl=');
  });

  it('renders selection controls and emits item and visible-toggle events', () => {
    const toggleSelection = spyOn(fixture.componentInstance.toggleSelection, 'emit');
    const toggleAllVisibleSelection = spyOn(fixture.componentInstance.toggleAllVisibleSelection, 'emit');
    fixture.componentInstance.selectionEnabled = true;
    fixture.componentInstance.selectedItemIds = [workspaceWorkItem.id];
    fixture.componentInstance.allVisibleSelected = true;
    fixture.detectChanges();

    const selectAll = fixture.nativeElement.querySelector(
      'input[aria-label="Select all visible work items"]'
    ) as HTMLInputElement | null;
    const rowSelection = fixture.nativeElement.querySelector(
      'input[aria-label="Select WT-42"]'
    ) as HTMLInputElement | null;

    expect(selectAll?.checked).toBeTrue();
    expect(rowSelection?.checked).toBeTrue();

    selectAll?.dispatchEvent(new Event('change'));
    rowSelection?.dispatchEvent(new Event('change'));

    expect(toggleAllVisibleSelection).toHaveBeenCalled();
    expect(toggleSelection).toHaveBeenCalledWith(workspaceWorkItem.id);
  });
});
