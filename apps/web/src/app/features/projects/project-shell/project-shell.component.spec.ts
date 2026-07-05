import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import type { MemberDto, ProjectSummaryDto } from '@worktrail/contracts';

import { CurrentUserService } from '../../../core/current-user.service';
import { ProjectShellComponent } from './project-shell.component';

const projectId = '10000000-0000-4000-8000-000000000201';
const workspaceId = '10000000-0000-4000-8000-000000000001';
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

function projectSummary(status: ProjectSummaryDto['project']['status']): ProjectSummaryDto {
  return {
    project: {
      id: projectId,
      workspaceId,
      key: 'WT',
      name: 'Worktrail',
      description: 'Reference project management app.',
      status,
      createdAt: '2026-07-01T12:00:00.000Z',
      updatedAt: '2026-07-03T12:00:00.000Z'
    },
    countsByStatus: [],
    recentWorkItems: [],
    deliveryHealth: {
      health: status === 'archived' ? 'inactive' : 'healthy',
      activeMilestoneCount: 1,
      healthyMilestoneCount: 1,
      atRiskMilestoneCount: 0,
      blockedMilestoneCount: 0,
      completeMilestoneCount: 0,
      inactiveMilestoneCount: 0,
      openWorkCount: 3,
      blockedWorkCount: 0,
      dependencyBlockedWorkCount: 0,
      blockingOpenWorkCount: 0,
      overdueWorkCount: 0,
      dueSoonWorkCount: 0,
      unassignedActiveWorkCount: 0,
      staleInProgressWorkCount: 0,
      unmilestonedActiveRiskCount: 0,
      reasons: []
    }
  };
}

describe('ProjectShellComponent', () => {
  let fixture: ComponentFixture<ProjectShellComponent>;
  let http: HttpTestingController;
  let currentUser: CurrentUserService;

  beforeEach(async () => {
    localStorage.clear();

    await TestBed.configureTestingModule({
      imports: [ProjectShellComponent],
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

    http = TestBed.inject(HttpTestingController);
    currentUser = TestBed.inject(CurrentUserService);
    currentUser.members.set([owner]);
    currentUser.selectMember(owner.id);
  });

  afterEach(() => {
    http.verify();
  });

  function createComponent(): void {
    fixture = TestBed.createComponent(ProjectShellComponent);
    fixture.detectChanges();
  }

  it('renders project identity, health, actions, and section navigation', () => {
    createComponent();

    const request = http.expectOne(`/api/projects/${projectId}/summary`);
    expect(request.request.headers.get('x-worktrail-member-id')).toBe(owner.id);
    request.flush(projectSummary('active'));
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Worktrail');
    expect(compiled.textContent).toContain('WT');
    expect(compiled.textContent).toContain('Active');
    expect(compiled.textContent).toContain('On track');
    expect(compiled.textContent).toContain('Create');
    expect([...compiled.querySelectorAll('.project-shell__nav a')].map((link) => link.textContent?.trim()))
      .toEqual(['Overview', 'Work', 'Board', 'Planning', 'Settings']);
  });

  it('shows archived read-only notice and hides create action for archived projects', () => {
    createComponent();

    http.expectOne(`/api/projects/${projectId}/summary`).flush(projectSummary('archived'));
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Archived project');
    expect(compiled.textContent).toContain('Work is read-only');
    expect(compiled.querySelector('.project-shell__primary-action')).toBeNull();
  });
});
