import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import type {
  MemberDto,
  MilestoneDto,
  PlanningRiskItemDto,
  ProjectStatusReportDetailDto,
  ProjectStatusReportDraftDto,
  ProjectStatusReportSnapshotDto
} from '@worktrail/contracts';

import { ProjectStatusReportDraftPageComponent } from './project-status-report-draft-page.component';

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

const milestone: MilestoneDto = {
  id: '10000000-0000-4000-8000-000000000501',
  workspaceId,
  projectId,
  name: 'v0.1.8',
  description: 'Status report release.',
  status: 'active',
  targetDate: '2026-07-18',
  isArchived: false,
  archivedAt: null,
  createdAt: '2026-07-03T12:00:00.000Z',
  updatedAt: '2026-07-04T12:00:00.000Z'
};

const recentWorkItem: PlanningRiskItemDto = {
  id: '10000000-0000-4000-8000-000000000301',
  displayKey: 'WT-1',
  title: 'Publish report draft',
  status: 'blocked',
  priority: 'urgent',
  assignee: owner,
  dueDate: '2026-07-12',
  milestone,
  updatedAt: '2026-07-10T12:00:00.000Z'
};

function snapshot(): ProjectStatusReportSnapshotDto {
  return {
    snapshotVersion: 1,
    generatedAt: '2026-07-10T12:00:00.000Z',
    project: {
      id: projectId,
      key: 'WT',
      name: 'Worktrail',
      status: 'active'
    },
    health: {
      health: 'at_risk',
      activeMilestoneCount: 1,
      healthyMilestoneCount: 0,
      atRiskMilestoneCount: 1,
      blockedMilestoneCount: 0,
      completeMilestoneCount: 0,
      inactiveMilestoneCount: 0,
      openWorkCount: 5,
      blockedWorkCount: 1,
      dependencyBlockedWorkCount: 1,
      blockingOpenWorkCount: 0,
      overdueWorkCount: 1,
      dueSoonWorkCount: 2,
      unassignedActiveWorkCount: 1,
      staleInProgressWorkCount: 0,
      unmilestonedActiveRiskCount: 0,
      reasons: [
        {
          key: 'blocked_work',
          severity: 'critical',
          message: '1 blocked work item',
          count: 1,
          query: { status: 'blocked', sort: 'priority_desc' }
        }
      ]
    },
    counts: {
      openWorkCount: 5,
      blockedWorkCount: 1,
      dependencyBlockedWorkCount: 1,
      blockingOpenWorkCount: 0,
      overdueWorkCount: 1,
      dueSoonWorkCount: 2,
      unassignedActiveWorkCount: 1,
      staleInProgressWorkCount: 0
    },
    milestones: [
      {
        id: milestone.id,
        name: milestone.name,
        status: 'active',
        targetDate: milestone.targetDate,
        totalCount: 4,
        openCount: 3,
        doneCount: 1,
        blockedCount: 1,
        dependencyBlockedCount: 1,
        overdueCount: 1,
        dueSoonCount: 2,
        unassignedActiveCount: 1,
        staleInProgressCount: 0,
        health: 'at_risk',
        reasons: []
      }
    ],
    risks: [
      {
        type: 'blocked',
        title: 'Blocked work',
        count: 1,
        query: { status: 'blocked', sort: 'priority_desc' },
        items: [recentWorkItem]
      },
      {
        type: 'due_soon',
        title: 'Due soon',
        count: 2,
        query: { dueDateState: 'due_soon', sort: 'due_date_asc' },
        items: [recentWorkItem]
      },
      {
        type: 'stale_in_progress',
        title: 'Stale in-progress work',
        count: 0,
        query: { workRisk: 'stale_in_progress', sort: 'updated_asc' },
        items: []
      }
    ],
    recentWork: [recentWorkItem]
  };
}

function draft(): ProjectStatusReportDraftDto {
  return {
    project: {
      id: projectId,
      workspaceId,
      key: 'WT',
      name: 'Worktrail',
      description: 'Reference app.',
      status: 'active',
      createdAt: '2026-07-01T12:00:00.000Z',
      updatedAt: '2026-07-10T12:00:00.000Z'
    },
    title: 'Status update - 2026-07-10',
    statusDate: '2026-07-10',
    summary: 'Project is at risk with five open work items.',
    highlights: '',
    risks: 'Blocked work: 1',
    nextSteps: '',
    snapshot: snapshot()
  };
}

function publishedReport(input: ProjectStatusReportDraftDto): ProjectStatusReportDetailDto {
  return {
    id: '10000000-0000-4000-8000-000000000901',
    workspaceId,
    projectId,
    title: input.title,
    statusDate: input.statusDate,
    health: input.snapshot.health.health,
    author: owner,
    publishedAt: '2026-07-10T13:00:00.000Z',
    createdAt: '2026-07-10T13:00:00.000Z',
    project: input.project,
    summary: input.summary,
    highlights: input.highlights,
    risks: input.risks,
    nextSteps: input.nextSteps,
    snapshot: input.snapshot
  };
}

describe('ProjectStatusReportDraftPageComponent', () => {
  let fixture: ComponentFixture<ProjectStatusReportDraftPageComponent>;
  let http: HttpTestingController;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProjectStatusReportDraftPageComponent],
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
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    http.verify();
  });

  function createComponent(): void {
    fixture = TestBed.createComponent(ProjectStatusReportDraftPageComponent);
    fixture.detectChanges();
  }

  function flushDraft(input: ProjectStatusReportDraftDto = draft()): ProjectStatusReportDraftDto {
    http.expectOne(`/api/projects/${projectId}/status-reports/draft`).flush(input);
    fixture.detectChanges();
    return input;
  }

  function input(selector: string): HTMLInputElement {
    return (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>(selector)!;
  }

  function textarea(selector: string): HTMLTextAreaElement {
    return (fixture.nativeElement as HTMLElement).querySelector<HTMLTextAreaElement>(selector)!;
  }

  it('renders generated draft fields and snapshot context', () => {
    createComponent();
    flushDraft();

    const compiled = fixture.nativeElement as HTMLElement;

    expect(input('#report-title').value).toBe('Status update - 2026-07-10');
    expect(input('#report-status-date').value).toBe('2026-07-10');
    expect(textarea('#report-summary').value).toContain('Project is at risk');
    expect(textarea('#report-risks').value).toBe('Blocked work: 1');
    expect(compiled.textContent).toContain('Reports · Draft report');
    expect(compiled.textContent).toContain('Editable narrative');
    expect(compiled.textContent).toContain('Generated evidence');
    expect(compiled.textContent).toContain('At risk');
    expect(compiled.textContent).toContain('Open');
    expect(compiled.textContent).toContain('5');
    expect(compiled.textContent).toContain('v0.1.8');
    expect(compiled.textContent).toContain('Blocked work');
    expect(compiled.textContent).toContain('WT-1');
  });

  it('does not publish an invalid form', () => {
    createComponent();
    flushDraft();

    fixture.componentInstance.draftForm.controls.title.setValue('');
    fixture.componentInstance.draftForm.controls.title.markAsTouched();
    fixture.detectChanges();

    const button = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      'button[type="submit"]'
    );

    expect(button?.disabled).toBeTrue();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Title is required');
    http.expectNone(`/api/projects/${projectId}/status-reports`);
  });

  it('publishes the edited narrative with the reviewed snapshot and navigates to detail', () => {
    spyOn(router, 'navigate').and.resolveTo(true);
    createComponent();
    const currentDraft = flushDraft();

    input('#report-title').value = 'Edited weekly status';
    input('#report-title').dispatchEvent(new Event('input'));
    textarea('#report-summary').value = 'Edited summary.';
    textarea('#report-summary').dispatchEvent(new Event('input'));
    textarea('#report-highlights').value = 'Edited highlight.';
    textarea('#report-highlights').dispatchEvent(new Event('input'));
    textarea('#report-next-steps').value = 'Edited next step.';
    textarea('#report-next-steps').dispatchEvent(new Event('input'));
    fixture.detectChanges();

    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('button[type="submit"]')?.click();

    const publish = http.expectOne(`/api/projects/${projectId}/status-reports`);
    expect(publish.request.method).toBe('POST');
    expect(publish.request.body).toEqual({
      title: 'Edited weekly status',
      statusDate: '2026-07-10',
      summary: 'Edited summary.',
      highlights: 'Edited highlight.',
      risks: 'Blocked work: 1',
      nextSteps: 'Edited next step.',
      snapshot: currentDraft.snapshot
    });
    publish.flush(publishedReport({ ...currentDraft, title: 'Edited weekly status' }));
    fixture.detectChanges();

    expect(router.navigate).toHaveBeenCalledWith([
      '/projects',
      projectId,
      'status',
      '10000000-0000-4000-8000-000000000901'
    ]);
  });

  it('shows publish API errors without losing the draft', () => {
    createComponent();
    flushDraft();

    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('button[type="submit"]')?.click();
    http.expectOne(`/api/projects/${projectId}/status-reports`).flush(
      { error: { code: 'CONFLICT', message: 'Archived projects cannot publish status reports.' } },
      { status: 409, statusText: 'Conflict' }
    );
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Archived projects cannot publish status reports.');
    expect(input('#report-title').value).toBe('Status update - 2026-07-10');
  });

  it('shows forbidden load copy without rendering a broken form', () => {
    createComponent();
    http.expectOne(`/api/projects/${projectId}/status-reports/draft`).flush(
      { error: { code: 'FORBIDDEN', message: 'Only owners and maintainers can publish project status reports.' } },
      { status: 403, statusText: 'Forbidden' }
    );
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Only owners and maintainers can publish project status reports.');
    expect(compiled.querySelector('form')).toBeNull();
  });

  it('shows archived project load copy without rendering a broken form', () => {
    createComponent();
    http.expectOne(`/api/projects/${projectId}/status-reports/draft`).flush(
      { error: { code: 'CONFLICT', message: 'Archived projects cannot publish status reports.' } },
      { status: 409, statusText: 'Conflict' }
    );
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Archived projects cannot publish status reports.');
    expect(compiled.querySelector('form')).toBeNull();
  });
});
