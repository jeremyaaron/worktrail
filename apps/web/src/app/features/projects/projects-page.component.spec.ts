import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import type { ActivityEventDto, ProjectDto, ProjectSummaryDto } from '@worktrail/contracts';

import { ProjectHomePageComponent } from './project-home-page.component';
import { ProjectListPageComponent } from './project-list-page.component';
import { ProjectPlanningPageComponent } from './project-planning-page.component';
import { ProjectSettingsPageComponent } from './project-settings-page.component';

const projectId = '10000000-0000-4000-8000-000000000201';
const archivedProjectId = '10000000-0000-4000-8000-000000000203';

const activeProject: ProjectDto = {
  id: projectId,
  workspaceId: '10000000-0000-4000-8000-000000000001',
  key: 'WT',
  name: 'Worktrail App',
  description: 'MVP project management reference application.',
  status: 'active',
  createdAt: '2026-07-02T12:00:00.000Z',
  updatedAt: '2026-07-03T12:00:00.000Z'
};

const archivedProject: ProjectDto = {
  id: archivedProjectId,
  workspaceId: '10000000-0000-4000-8000-000000000001',
  key: 'ARCH',
  name: 'Archived Project',
  description: 'Archived project used to verify archived states.',
  status: 'archived',
  createdAt: '2026-07-02T12:00:00.000Z',
  updatedAt: '2026-07-03T12:00:00.000Z'
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
  ]
};

const archivedProjectSummary: ProjectSummaryDto = {
  ...projectSummary,
  project: archivedProject,
  recentWorkItems: []
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
    isActive: true
  },
  eventType: 'label.created',
  summary: 'Label created.',
  previousValue: null,
  newValue: null,
  metadata: { labelId: backendLabel.id },
  createdAt: '2026-07-03T12:00:00.000Z'
};

function setupProjectList() {
  const fixture = TestBed.createComponent(ProjectListPageComponent);
  const http = TestBed.inject(HttpTestingController);
  fixture.detectChanges();
  return { fixture, http };
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

  it('renders projects loaded from the API and filters archived projects', () => {
    const { fixture, http } = setupProjectList();

    http.expectOne('/api/projects').flush([activeProject, archivedProject]);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('WT');
    expect(compiled.textContent).toContain('ARCH');
    expect(compiled.textContent).toContain('Worktrail App');
    expect(compiled.textContent).toContain('Archived Project');

    const archivedButton = Array.from(compiled.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Archived'
    );
    archivedButton?.click();
    fixture.detectChanges();

    expect(compiled.textContent).not.toContain('Worktrail App');
    expect(compiled.textContent).toContain('Archived Project');
  });

  it('shows project creation validation before posting', () => {
    const { fixture, http } = setupProjectList();

    http.expectOne('/api/projects').flush([]);
    fixture.detectChanges();

    fixture.componentInstance.createProject();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Project name is required.');
    http.expectNone((request) => request.method === 'POST' && request.url === '/api/projects');
  });

  it('creates a project and adds it to the active list', () => {
    const { fixture, http } = setupProjectList();

    http.expectOne('/api/projects').flush([]);
    fixture.detectChanges();

    fixture.componentInstance.createProjectForm.setValue({
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
    expect(compiled.textContent).toContain('Create work item');
    expect(compiled.textContent).toContain('Settings');
  });

  it('renders archived project state without the create action', () => {
    fixture.detectChanges();

    http.expectOne(`/api/projects/${projectId}/summary`).flush(archivedProjectSummary);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Archived project');
    expect(compiled.textContent).toContain('ARCH');
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
});

describe('ProjectPlanningPageComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProjectPlanningPageComponent],
      providers: [
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

  it('renders the planning route shell with project navigation links', () => {
    const fixture = TestBed.createComponent(ProjectPlanningPageComponent);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const links = Array.from(compiled.querySelectorAll<HTMLAnchorElement>('nav a')).map((link) => ({
      text: link.textContent?.trim(),
      href: link.getAttribute('href')
    }));

    expect(compiled.textContent).toContain('Project planning');
    expect(links).toEqual([
      { text: 'Overview', href: `/projects/${projectId}` },
      { text: 'Work items', href: `/projects/${projectId}/work-items` },
      { text: 'Board', href: `/projects/${projectId}/board` },
      { text: 'Settings', href: `/projects/${projectId}/settings` }
    ]);
  });
});
