import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import type { ProjectDto, ProjectSummaryDto } from '@worktrail/contracts';

import { ProjectHomePageComponent } from './project-home-page.component';
import { ProjectListPageComponent } from './project-list-page.component';

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
    expect(compiled.textContent).toContain('Backlog');
    expect(compiled.textContent).toContain('In progress');
    expect(compiled.textContent).toContain('Implement API client');
    expect(compiled.textContent).toContain('Create work item');
  });
});
