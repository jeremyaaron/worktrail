import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import type {
  ActivityEventDto,
  MemberDto,
  ProjectDto,
  ProjectDeliveryHealthDto,
  ProjectNavigationSummaryDto,
  ProjectSummaryDto,
  WorkspaceCapabilitiesDto
} from '@worktrail/contracts';

import { CurrentUserService } from '../../core/current-user.service';
import { ProjectHomePageComponent } from './project-home-page.component';
import { ProjectListPageComponent } from './project-list-page.component';
import { ProjectSettingsPageComponent } from './project-settings-page.component';

const projectId = '10000000-0000-4000-8000-000000000201';
const archivedProjectId = '10000000-0000-4000-8000-000000000203';
const workspaceId = '10000000-0000-4000-8000-000000000001';

const defaultDeliveryHealth: ProjectDeliveryHealthDto = {
  health: 'healthy',
  activeMilestoneCount: 0,
  healthyMilestoneCount: 0,
  atRiskMilestoneCount: 0,
  blockedMilestoneCount: 0,
  completeMilestoneCount: 0,
  inactiveMilestoneCount: 0,
  openWorkCount: 0,
  blockedWorkCount: 0,
  dependencyBlockedWorkCount: 0,
  blockingOpenWorkCount: 0,
  overdueWorkCount: 0,
  dueSoonWorkCount: 0,
  unassignedActiveWorkCount: 0,
  staleInProgressWorkCount: 0,
  unmilestonedActiveRiskCount: 0,
  reasons: []
};

const blockedDeliveryHealth: ProjectDeliveryHealthDto = {
  ...defaultDeliveryHealth,
  health: 'blocked',
  activeMilestoneCount: 3,
  healthyMilestoneCount: 1,
  atRiskMilestoneCount: 1,
  blockedMilestoneCount: 1,
  openWorkCount: 7,
  blockedWorkCount: 1,
  dependencyBlockedWorkCount: 1,
  reasons: [
    {
      key: 'blocked_work',
      severity: 'critical',
      message: '1 blocked work item',
      count: 1,
      query: {
        status: 'blocked',
        sort: 'priority_desc'
      }
    },
    {
      key: 'dependency_blocked',
      severity: 'critical',
      message: '1 dependency-blocked work item',
      count: 1,
      query: {
        dependency: 'dependency_blocked',
        sort: 'priority_desc'
      }
    },
    {
      key: 'unmilestoned_risk',
      severity: 'warning',
      message: '1 unmilestoned risk item',
      count: 1,
      query: null
    }
  ]
};

const inactiveDeliveryHealth: ProjectDeliveryHealthDto = {
  ...defaultDeliveryHealth,
  health: 'inactive',
  reasons: [
    {
      key: 'inactive_milestone',
      severity: 'info',
      message: 'Project is archived.',
      count: 1,
      query: null
    }
  ]
};

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
  name: 'Casey Contributor',
  email: 'casey.contributor@example.com',
  role: 'contributor',
  isActive: true,
  deactivatedAt: null,
  createdAt: '2026-07-02T12:00:00.000Z',
  updatedAt: '2026-07-03T12:00:00.000Z'
};

const activeProject: ProjectDto = {
  id: projectId,
  workspaceId,
  key: 'WT',
  name: 'Worktrail App',
  description: 'MVP project management reference application.',
  status: 'active',
  createdAt: '2026-07-02T12:00:00.000Z',
  updatedAt: '2026-07-03T12:00:00.000Z'
};

const archivedProject: ProjectDto = {
  id: archivedProjectId,
  workspaceId,
  key: 'ARCH',
  name: 'Archived Project',
  description: 'Archived project used to verify archived states.',
  status: 'archived',
  createdAt: '2026-07-02T12:00:00.000Z',
  updatedAt: '2026-07-03T12:00:00.000Z'
};

const activeNavigationSummary: ProjectNavigationSummaryDto = {
  project: activeProject,
  openWorkItemCount: 6,
  blockedWorkItemCount: 1,
  overdueWorkItemCount: 2,
  updatedAt: '2026-07-04T12:00:00.000Z'
};

const archivedNavigationSummary: ProjectNavigationSummaryDto = {
  project: archivedProject,
  openWorkItemCount: 0,
  blockedWorkItemCount: 0,
  overdueWorkItemCount: 0,
  updatedAt: '2026-06-28T12:00:00.000Z'
};

const projectSummary: ProjectSummaryDto = {
  project: activeProject,
  countsByStatus: [
    { status: 'backlog', count: 2 },
    { status: 'ready', count: 1 },
    { status: 'in_progress', count: 3 },
    { status: 'blocked', count: 0 },
    { status: 'done', count: 4 },
    { status: 'canceled', count: 0 }
  ],
  recentWorkItems: [
    {
      id: '10000000-0000-4000-8000-000000000403',
      displayKey: 'WT-3',
      title: 'Implement API client',
      status: 'in_progress',
      updatedAt: '2026-07-03T12:00:00.000Z'
    }
  ],
  deliveryHealth: blockedDeliveryHealth
};

const archivedProjectSummary: ProjectSummaryDto = {
  ...projectSummary,
  project: archivedProject,
  recentWorkItems: [],
  deliveryHealth: inactiveDeliveryHealth
};

const backendLabel = {
  id: '10000000-0000-4000-8000-000000000302',
  name: 'backend',
  color: '#059669',
  isArchived: false,
  archivedAt: null
};

const archivedLabel = {
  id: '10000000-0000-4000-8000-000000000399',
  name: 'legacy',
  color: '#64748b',
  isArchived: true,
  archivedAt: '2026-07-03T12:00:00.000Z'
};

const labelActivity: ActivityEventDto = {
  id: '10000000-0000-4000-8000-000000000701',
  workspaceId: activeProject.workspaceId,
  projectId,
  workItemId: null,
  actor: {
    id: '10000000-0000-4000-8000-000000000101',
    workspaceId: activeProject.workspaceId,
    name: 'Avery Owner',
    email: 'avery.owner@example.com',
    role: 'owner',
    isActive: true,
    deactivatedAt: null,
    createdAt: '2026-07-02T12:00:00.000Z',
    updatedAt: '2026-07-03T12:00:00.000Z'
  },
  eventType: 'label.created',
  summary: 'Label created.',
  previousValue: null,
  newValue: null,
  metadata: { labelId: backendLabel.id },
  createdAt: '2026-07-03T12:00:00.000Z'
};

const sharedProjectSavedViewActivity: ActivityEventDto = {
  ...labelActivity,
  id: '10000000-0000-4000-8000-000000000702',
  eventType: 'saved_view.created',
  summary: 'Avery Owner created shared project view Release blockers.',
  metadata: { savedViewId: '10000000-0000-4000-8000-000000000818' }
};

const ownerCapabilities: WorkspaceCapabilitiesDto = {
  actor: owner,
  canManageWorkspace: true,
  canManageMembers: true,
  canCreateProjects: true,
  canManageProjects: true,
  canManageMilestones: true,
  canManageLabels: true,
  canCreateWorkItems: true,
  roleSummary: {
    owner: 'Owners manage workspace settings and members.',
    maintainer: 'Maintainers manage projects and delivery artifacts.',
    contributor: 'Contributors manage assigned work.'
  }
};

const contributorCapabilities: WorkspaceCapabilitiesDto = {
  ...ownerCapabilities,
  actor: contributor,
  canManageWorkspace: false,
  canManageMembers: false,
  canCreateProjects: false,
  canManageProjects: false,
  canManageMilestones: false,
  canManageLabels: false
};

function setupProjectList() {
  const fixture = TestBed.createComponent(ProjectListPageComponent);
  const http = TestBed.inject(HttpTestingController);
  fixture.detectChanges();
  return { fixture, http };
}

function flushProjectListLoad(
  http: HttpTestingController,
  summaries: ProjectNavigationSummaryDto[],
  capabilities: WorkspaceCapabilitiesDto = ownerCapabilities
) {
  http.expectOne('/api/projects/navigation-summary').flush(summaries);
  http.expectOne('/api/workspace/capabilities').flush(capabilities);
}

describe('ProjectListPageComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProjectListPageComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])]
    }).compileComponents();
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  it('renders project navigation summaries and filters archived projects', () => {
    const { fixture, http } = setupProjectList();

    flushProjectListLoad(http, [activeNavigationSummary, archivedNavigationSummary]);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('WT');
    expect(compiled.textContent).toContain('ARCH');
    expect(compiled.textContent).toContain('Worktrail App');
    expect(compiled.textContent).toContain('Archived Project');
    expect(compiled.textContent).toContain('Open');
    expect(compiled.textContent).toContain('6');
    expect(compiled.textContent).toContain('Blocked');
    expect(compiled.textContent).toContain('1');
    expect(compiled.textContent).toContain('Overdue');
    expect(compiled.textContent).toContain('2');
    expect(compiled.textContent).toContain('Updated');
    expect(compiled.textContent).toContain('Jul 4, 2026');
    expect(compiled.textContent).toContain('Archived projects');

    const archivedButton = Array.from(compiled.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Archived'
    );
    archivedButton?.click();
    fixture.detectChanges();

    expect(compiled.textContent).not.toContain('Worktrail App');
    expect(compiled.textContent).toContain('Archived Project');
  });

  it('searches projects by name or key', () => {
    const { fixture, http } = setupProjectList();

    flushProjectListLoad(http, [activeNavigationSummary, archivedNavigationSummary]);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const search = compiled.querySelector<HTMLInputElement>('#project-search');

    expect(search).not.toBeNull();
    search!.value = 'arch';
    search!.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(compiled.textContent).not.toContain('Worktrail App');
    expect(compiled.textContent).toContain('Archived Project');

    search!.value = 'wt';
    search!.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(compiled.textContent).toContain('Worktrail App');
    expect(compiled.textContent).not.toContain('Archived Project');
  });

  it('shows project creation validation before posting', () => {
    const { fixture, http } = setupProjectList();

    flushProjectListLoad(http, []);
    fixture.detectChanges();

    fixture.componentInstance.createProject();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Project name is required.');
    http.expectNone((request) => request.method === 'POST' && request.url === '/api/projects');
  });

  it('creates a project and adds it to the active list', () => {
    const { fixture, http } = setupProjectList();

    flushProjectListLoad(http, []);
    fixture.detectChanges();

    fixture.componentInstance.createProjectForm.setValue({
      key: '',
      name: 'New Product Launch',
      description: 'Coordinate the next launch.'
    });
    fixture.componentInstance.createProject();

    const post = http.expectOne('/api/projects');
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toEqual({
      name: 'New Product Launch',
      description: 'Coordinate the next launch.'
    });
    post.flush({
      ...activeProject,
      id: '10000000-0000-4000-8000-000000000209',
      name: 'New Product Launch',
      description: 'Coordinate the next launch.'
    });
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('New Product Launch');
    expect(compiled.textContent).toContain('Open');
    expect(compiled.textContent).toContain('0');
    expect(compiled.textContent).toContain('Project created.');
  });

  it('submits explicit project keys uppercased', () => {
    const { fixture, http } = setupProjectList();

    flushProjectListLoad(http, []);
    fixture.detectChanges();

    fixture.componentInstance.createProjectForm.setValue({
      key: 'ops',
      name: 'Operations Tracker',
      description: ''
    });
    fixture.componentInstance.createProject();

    const post = http.expectOne('/api/projects');
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toEqual({
      key: 'OPS',
      name: 'Operations Tracker',
      description: ''
    });
    post.flush({
      ...activeProject,
      id: '10000000-0000-4000-8000-000000000210',
      key: 'OPS',
      name: 'Operations Tracker',
      description: ''
    });
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('OPS');
  });

  it('shows explicit key validation before posting', () => {
    const { fixture, http } = setupProjectList();

    flushProjectListLoad(http, []);
    fixture.detectChanges();

    fixture.componentInstance.createProjectForm.setValue({
      key: '!',
      name: 'Invalid Key Project',
      description: ''
    });
    fixture.componentInstance.createProject();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Project key must be 2-8 letters or numbers.'
    );
    http.expectNone((request) => request.method === 'POST' && request.url === '/api/projects');
  });

  it('disables project creation for contributors', () => {
    const { fixture, http } = setupProjectList();

    flushProjectListLoad(http, [activeNavigationSummary], contributorCapabilities);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const createButton = [...compiled.querySelectorAll('button')].find(
      (button) => button.textContent?.trim() === 'Create project'
    );
    expect(compiled.textContent).toContain('Owners and maintainers can create projects.');
    expect(createButton?.disabled).toBeTrue();

    fixture.componentInstance.createProjectForm.setValue({
      key: '',
      name: 'Blocked Project',
      description: ''
    });
    fixture.componentInstance.createProject();
    fixture.detectChanges();

    expect(compiled.textContent).toContain('Only owners and maintainers can create projects.');
    http.expectNone((request) => request.method === 'POST' && request.url === '/api/projects');
  });

  it('shows backend project creation errors inline', () => {
    const { fixture, http } = setupProjectList();

    flushProjectListLoad(http, []);
    fixture.detectChanges();

    fixture.componentInstance.createProjectForm.setValue({
      key: 'OPS',
      name: 'Duplicate Project',
      description: ''
    });
    fixture.componentInstance.createProject();

    const post = http.expectOne('/api/projects');
    post.flush(
      { error: { code: 'CONFLICT', message: 'Project key is already in use.' } },
      { status: 409, statusText: 'Conflict' }
    );
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Project key is already in use.'
    );
  });
});

describe('ProjectHomePageComponent', () => {
  let fixture: ComponentFixture<ProjectHomePageComponent>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProjectHomePageComponent],
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

    fixture = TestBed.createComponent(ProjectHomePageComponent);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('renders project summary counts and recent work items', () => {
    fixture.detectChanges();

    http.expectOne(`/api/projects/${projectId}/summary`).flush(projectSummary);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Worktrail App');
    expect(compiled.textContent).toContain('WT');
    expect(compiled.textContent).toContain('Backlog');
    expect(compiled.textContent).toContain('In progress');
    expect(compiled.textContent).toContain('WT-3');
    expect(compiled.textContent).toContain('Implement API client');
    expect(compiled.textContent).toContain('Delivery health');
    expect(compiled.textContent).toContain('Blocked');
    expect(compiled.textContent).toContain('Active milestones');
    expect(compiled.textContent).toContain('Open work');
    expect(compiled.textContent).toContain('1 blocked work item');
    expect(compiled.textContent).toContain('1 dependency-blocked work item');
    expect(compiled.textContent).toContain('1 unmilestoned risk item');

    const reasonLinks = Array.from(compiled.querySelectorAll<HTMLAnchorElement>('.reason-row'));
    const reasonHrefs = reasonLinks.map((link) => link.getAttribute('href') ?? '');
    expect(reasonHrefs.some((href) => href.includes('/projects/' + projectId + '/work-items'))).toBeTrue();
    expect(reasonHrefs.some((href) => href.includes('status=blocked'))).toBeTrue();
    expect(reasonHrefs.some((href) => href.includes('dependency=dependency_blocked'))).toBeTrue();
    expect(compiled.querySelector<HTMLAnchorElement>('a[href="/projects/10000000-0000-4000-8000-000000000201/planning"]')).not.toBeNull();
    expect(compiled.querySelector('.project-actions')).toBeNull();
  });

  it('renders archived project state without the create action', () => {
    fixture.detectChanges();

    http.expectOne(`/api/projects/${projectId}/summary`).flush(archivedProjectSummary);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Archived project');
    expect(compiled.textContent).toContain('ARCH');
    expect(compiled.textContent).toContain('Inactive');
    expect(compiled.textContent).toContain('Project is archived.');
    expect(compiled.textContent).not.toContain('Create work item');
  });
});

describe('ProjectSettingsPageComponent', () => {
  let fixture: ComponentFixture<ProjectSettingsPageComponent>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProjectSettingsPageComponent],
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

    const currentUser = TestBed.inject(CurrentUserService);
    currentUser.members.set([owner, contributor]);
    currentUser.selectMember(owner.id);

    fixture = TestBed.createComponent(ProjectSettingsPageComponent);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('loads project settings and saves metadata changes', () => {
    fixture.detectChanges();

    http.expectOne(`/api/projects/${projectId}`).flush(activeProject);
    http.expectOne(`/api/projects/${projectId}/labels?includeArchived=true`).flush([]);
    http.expectOne(`/api/projects/${projectId}/activity`).flush([labelActivity]);
    fixture.detectChanges();

    fixture.componentInstance.settingsForm.setValue({
      key: 'next',
      name: 'Renamed Worktrail App',
      description: 'Updated project settings.'
    });
    fixture.componentInstance.saveSettings();

    const patch = http.expectOne(`/api/projects/${projectId}`);
    expect(patch.request.method).toBe('PATCH');
    expect(patch.request.body).toEqual({
      key: 'NEXT',
      name: 'Renamed Worktrail App',
      description: 'Updated project settings.'
    });
    patch.flush({
      ...activeProject,
      key: 'NEXT',
      name: 'Renamed Worktrail App',
      description: 'Updated project settings.'
    });
    http.expectOne(`/api/projects/${projectId}/activity`).flush([labelActivity]);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Renamed Worktrail App');
    expect(compiled.textContent).toContain('Project settings saved.');
    expect(compiled.textContent).toContain('Label created.');
  });

  it('renders shared project saved-view activity with a readable event label', () => {
    fixture.detectChanges();

    http.expectOne(`/api/projects/${projectId}`).flush(activeProject);
    http.expectOne(`/api/projects/${projectId}/labels?includeArchived=true`).flush([]);
    http.expectOne(`/api/projects/${projectId}/activity`).flush([sharedProjectSavedViewActivity]);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Avery Owner created shared project view Release blockers.');
    expect(compiled.textContent).toContain('Shared project view created');
    expect(compiled.textContent).not.toContain('saved_view.created');
  });

  it('archives and reactivates projects without a page refresh', () => {
    fixture.detectChanges();

    http.expectOne(`/api/projects/${projectId}`).flush(activeProject);
    http.expectOne(`/api/projects/${projectId}/labels?includeArchived=true`).flush([]);
    http.expectOne(`/api/projects/${projectId}/activity`).flush([]);
    fixture.detectChanges();

    fixture.componentInstance.archiveProject();
    const archive = http.expectOne(`/api/projects/${projectId}/archive`);
    expect(archive.request.method).toBe('POST');
    archive.flush(archivedProject);
    http.expectOne(`/api/projects/${projectId}/activity`).flush([]);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Archived project');

    fixture.componentInstance.reactivateProject();
    const reactivate = http.expectOne(`/api/projects/${projectId}/reactivate`);
    expect(reactivate.request.method).toBe('POST');
    reactivate.flush(activeProject);
    http.expectOne(`/api/projects/${projectId}/activity`).flush([]);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('Archived project');
  });

  it('manages project labels from settings', () => {
    fixture.detectChanges();

    http.expectOne(`/api/projects/${projectId}`).flush(activeProject);
    http.expectOne(`/api/projects/${projectId}/labels?includeArchived=true`).flush([
      backendLabel,
      archivedLabel
    ]);
    http.expectOne(`/api/projects/${projectId}/activity`).flush([]);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const labelNameInputs = Array.from(
      compiled.querySelectorAll<HTMLInputElement>('.label-row input[type="text"]')
    ).map((input) => input.value);
    expect(labelNameInputs).toEqual(jasmine.arrayContaining(['backend', 'legacy']));
    expect(compiled.textContent).toContain('Archived');

    fixture.componentInstance.labelForm.setValue({ name: 'frontend', color: '#2563eb' });
    fixture.componentInstance.createLabel();

    const create = http.expectOne(`/api/projects/${projectId}/labels`);
    expect(create.request.method).toBe('POST');
    expect(create.request.body).toEqual({ name: 'frontend', color: '#2563eb' });
    create.flush({
      id: '10000000-0000-4000-8000-000000000301',
      name: 'frontend',
      color: '#2563eb',
      isArchived: false,
      archivedAt: null
    });
    http.expectOne(`/api/projects/${projectId}/activity`).flush([labelActivity]);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Label created.');

    fixture.componentInstance.updateLabel(backendLabel, 'api', '#0ea5e9');
    const update = http.expectOne(`/api/labels/${backendLabel.id}`);
    expect(update.request.method).toBe('PATCH');
    expect(update.request.body).toEqual({ name: 'api', color: '#0ea5e9' });
    update.flush({ ...backendLabel, name: 'api', color: '#0ea5e9' });
    http.expectOne(`/api/projects/${projectId}/activity`).flush([labelActivity]);

    fixture.componentInstance.archiveLabel({ ...backendLabel, name: 'api', color: '#0ea5e9' });
    const archive = http.expectOne(`/api/labels/${backendLabel.id}/archive`);
    expect(archive.request.method).toBe('POST');
    archive.flush({
      ...backendLabel,
      name: 'api',
      color: '#0ea5e9',
      isArchived: true,
      archivedAt: '2026-07-03T12:30:00.000Z'
    });
    http.expectOne(`/api/projects/${projectId}/activity`).flush([labelActivity]);

    fixture.componentInstance.reactivateLabel(archivedLabel);
    const reactivate = http.expectOne(`/api/labels/${archivedLabel.id}/reactivate`);
    expect(reactivate.request.method).toBe('POST');
    reactivate.flush({ ...archivedLabel, isArchived: false, archivedAt: null });
    http.expectOne(`/api/projects/${projectId}/activity`).flush([labelActivity]);
  });

  it('renders contributor project settings access as read-only', () => {
    TestBed.inject(CurrentUserService).selectMember(contributor.id);
    fixture.detectChanges();

    http.expectOne(`/api/projects/${projectId}`).flush(activeProject);
    http.expectOne(`/api/projects/${projectId}/labels?includeArchived=true`).flush([
      backendLabel
    ]);
    http.expectOne(`/api/projects/${projectId}/activity`).flush([]);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Only owners and maintainers can update project settings.');
    expect(compiled.textContent).toContain('Only owners and maintainers can manage labels.');
    expect(compiled.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBeTrue();
    expect(compiled.querySelector<HTMLInputElement>('#label-color')?.disabled).toBeTrue();

    fixture.componentInstance.saveSettings();
    fixture.componentInstance.createLabel();
    fixture.componentInstance.archiveProject();
    fixture.detectChanges();

    expect(compiled.textContent).toContain('Only owners and maintainers can update project settings.');
    expect(compiled.textContent).toContain('Only owners and maintainers can manage labels.');
    expect(compiled.textContent).toContain('Only owners and maintainers can archive projects.');
    http.expectNone((request) => request.method !== 'GET');
  });
});
