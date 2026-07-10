import { HttpResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import type {
  MemberDto,
  MilestoneDto,
  PlanningRiskItemDto,
  ProjectStatusReportDetailDto,
  ProjectStatusReportSnapshotDto
} from '@worktrail/contracts';

import { ClipboardService } from '../../../shared/clipboard.service';
import { ProjectStatusReportDetailPageComponent } from './project-status-report-detail-page.component';

const projectId = '10000000-0000-4000-8000-000000000201';
const reportId = '10000000-0000-4000-8000-000000000901';
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

const contributor: MemberDto = {
  ...owner,
  id: '10000000-0000-4000-8000-000000000103',
  name: 'Case Contributor',
  email: 'case.contributor@example.com',
  role: 'contributor'
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
  title: 'Publish report detail renderer',
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
        },
        {
          key: 'due_soon',
          severity: 'warning',
          message: '2 due-soon work items',
          count: 2,
          query: { dueDateState: 'due_soon', sort: 'due_date_asc' }
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
    cycle: {
      id: '10000000-0000-4000-8000-000000000701',
      name: 'v0.2.1 Cycle Planning',
      goal: 'Prove cycle planning across reports.',
      status: 'active',
      startDate: '2026-07-13',
      endDate: '2026-07-24',
      targetPoints: 20,
      committedEstimatePoints: 23,
      completedEstimatePoints: 8,
      openWorkCount: 4,
      blockedWorkCount: 1,
      dependencyBlockedWorkCount: 1,
      unestimatedWorkCount: 1,
      health: 'at_risk',
      reasons: [
        {
          key: 'cycle_over_target',
          severity: 'warning',
          message: 'Cycle estimate is 3 points over target.',
          count: 3,
          query: { cycleId: '10000000-0000-4000-8000-000000000701', sort: 'priority_desc' }
        }
      ],
      links: [
        {
          type: 'cycle_review',
          label: 'Review cycle',
          projectId,
          cycleId: '10000000-0000-4000-8000-000000000701'
        }
      ]
    },
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
        items: []
      }
    ],
    recentWork: [recentWorkItem]
  };
}

function report(input: {
  author?: MemberDto;
  projectStatus?: ProjectStatusReportDetailDto['project']['status'];
} = {}): ProjectStatusReportDetailDto {
  const currentSnapshot = snapshot();

  return {
    id: reportId,
    workspaceId,
    projectId,
    title: 'Weekly delivery status with a deliberately long report title',
    statusDate: '2026-07-10',
    health: currentSnapshot.health.health,
    author: input.author ?? owner,
    publishedAt: '2026-07-10T13:00:00.000Z',
    createdAt: '2026-07-10T13:00:00.000Z',
    project: {
      id: projectId,
      workspaceId,
      key: 'WT',
      name: 'Worktrail',
      description: 'Reference app.',
      status: input.projectStatus ?? 'active',
      createdAt: '2026-07-01T12:00:00.000Z',
      updatedAt: '2026-07-10T12:00:00.000Z'
    },
    summary: 'Project is at risk with five open work items.',
    highlights: 'Planning review is complete.',
    risks: 'One blocker remains.',
    nextSteps: 'Clear the blocker and publish the next report.',
    snapshot: {
      ...currentSnapshot,
      project: {
        ...currentSnapshot.project,
        status: input.projectStatus ?? 'active'
      }
    }
  };
}

describe('ProjectStatusReportDetailPageComponent', () => {
  let fixture: ComponentFixture<ProjectStatusReportDetailPageComponent>;
  let http: HttpTestingController;
  let clipboard: jasmine.SpyObj<ClipboardService>;

  beforeEach(async () => {
    clipboard = jasmine.createSpyObj<ClipboardService>('ClipboardService', ['copyText']);
    clipboard.copyText.and.resolveTo();

    await TestBed.configureTestingModule({
      imports: [ProjectStatusReportDetailPageComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ClipboardService,
          useValue: clipboard
        },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ projectId, reportId })
            }
          }
        }
      ]
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  function createComponent(): void {
    fixture = TestBed.createComponent(ProjectStatusReportDetailPageComponent);
    fixture.detectChanges();
  }

  function flushReport(input: ProjectStatusReportDetailDto = report()): ProjectStatusReportDetailDto {
    http.expectOne(`/api/projects/${projectId}/status-reports/${reportId}`).flush(input);
    fixture.detectChanges();
    return input;
  }

  function markdownBlob(markdown: string): Blob {
    return {
      text: () => Promise.resolve(markdown)
    } as Blob;
  }

  async function settleBlobText(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await fixture.whenStable();
  }

  it('renders metadata, narrative, and snapshot notice from the published report', () => {
    createComponent();
    flushReport();

    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.textContent).toContain('Published snapshot');
    expect(compiled.textContent).toContain('Weekly delivery status');
    expect(compiled.textContent).toContain('Avery Owner');
    expect(compiled.textContent).toContain('Project is at risk with five open work items.');
    expect(compiled.textContent).toContain('Planning review is complete.');
    expect(compiled.textContent).toContain('One blocker remains.');
    expect(compiled.textContent).toContain('Clear the blocker');
  });

  it('renders health reasons, counts, milestones, risk sections, and recent work', () => {
    createComponent();
    flushReport();

    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.textContent).toContain('At risk');
    expect(compiled.textContent).toContain('1 blocked work item');
    expect(compiled.textContent).toContain('2 due-soon work items');
    expect(compiled.textContent).toContain('Open');
    expect(compiled.textContent).toContain('5');
    expect(compiled.textContent).toContain('Dependency blocked');
    expect(compiled.textContent).toContain('Active cycle snapshot');
    expect(compiled.textContent).toContain('v0.2.1 Cycle Planning');
    expect(compiled.textContent).toContain('8/23 points, 20 target');
    expect(compiled.textContent).toContain('Cycle estimate is 3 points over target.');
    expect(compiled.textContent).toContain('v0.1.8');
    expect(compiled.textContent).toContain('3 open');
    expect(compiled.textContent).toContain('Blocked work');
    expect(compiled.textContent).toContain('Due soon');
    expect(compiled.textContent).toContain('WT-1');
    expect(compiled.textContent).toContain('Publish report detail renderer');
  });

  it('builds milestone, risk query, and work item return links', () => {
    createComponent();
    flushReport();

    const compiled = fixture.nativeElement as HTMLElement;
    const milestoneLink = compiled.querySelector<HTMLAnchorElement>('.milestone-row');
    const cycleReviewLink = [...compiled.querySelectorAll<HTMLAnchorElement>('.report-links a')]
      .find((link) => link.textContent?.includes('Review cycle'));
    const cycleWorkLink = [...compiled.querySelectorAll<HTMLAnchorElement>('.report-links a')]
      .find((link) => link.textContent?.includes('Open current cycle work'));
    const riskLink = [...compiled.querySelectorAll<HTMLAnchorElement>('.risk-section > a')]
      .find((link) => link.textContent?.includes('Open current work'));
    const workLink = compiled.querySelector<HTMLAnchorElement>('.work-row');

    expect(milestoneLink?.getAttribute('href')).toBe(
      `/projects/${projectId}/milestones/${milestone.id}`
    );
    expect(cycleReviewLink?.getAttribute('href')).toBe(
      `/projects/${projectId}/cycles/10000000-0000-4000-8000-000000000701`
    );
    expect(cycleWorkLink?.getAttribute('href')).toContain(`/projects/${projectId}/work-items`);
    expect(cycleWorkLink?.getAttribute('href')).toContain(
      'cycleId=10000000-0000-4000-8000-000000000701'
    );
    expect(riskLink?.getAttribute('href')).toContain(`/projects/${projectId}/work-items`);
    expect(riskLink?.getAttribute('href')).toContain('status=blocked');
    expect(riskLink?.getAttribute('href')).toContain('sort=priority_desc');
    expect(workLink?.getAttribute('href')).toContain(`/work-items/${recentWorkItem.id}`);
    expect(workLink?.getAttribute('href')).toContain('returnUrl=');
    expect(decodeURIComponent(workLink?.getAttribute('href') ?? '')).toContain(
      `/projects/${projectId}/status/${reportId}`
    );
  });

  it('supports contributor-authored published reports', () => {
    createComponent();
    flushReport(report({ author: contributor }));

    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.textContent).toContain('Case Contributor');
    expect(compiled.textContent).toContain('Weekly delivery status');
    expect(compiled.textContent).toContain('Copy Markdown');
    expect(compiled.textContent).toContain('Download Markdown');
    expect(compiled.textContent).toContain('Print');
  });

  it('copies exported Markdown to the clipboard', async () => {
    createComponent();
    flushReport();

    const compiled = fixture.nativeElement as HTMLElement;
    const copyButton = [...compiled.querySelectorAll<HTMLButtonElement>('button')].find((button) =>
      button.textContent?.includes('Copy Markdown')
    );

    copyButton?.click();
    fixture.detectChanges();

    const exportRequest = http.expectOne(
      `/api/projects/${projectId}/status-reports/${reportId}/export.md`
    );
    expect(exportRequest.request.method).toBe('GET');
    expect(exportRequest.request.responseType).toBe('blob');
    exportRequest.event(new HttpResponse({ body: markdownBlob('# Weekly status\n') }));

    await settleBlobText();
    fixture.detectChanges();

    expect(clipboard.copyText).toHaveBeenCalledWith('# Weekly status\n');
    expect(fixture.componentInstance.isCopyingMarkdown()).toBeFalse();
    expect(compiled.textContent).toContain('Markdown copied.');
  });

  it('shows copy failures when the clipboard write fails', async () => {
    clipboard.copyText.and.rejectWith(new Error('copy failed'));
    createComponent();
    flushReport();

    const compiled = fixture.nativeElement as HTMLElement;
    const copyButton = [...compiled.querySelectorAll<HTMLButtonElement>('button')].find((button) =>
      button.textContent?.includes('Copy Markdown')
    );

    copyButton?.click();
    http
      .expectOne(`/api/projects/${projectId}/status-reports/${reportId}/export.md`)
      .event(new HttpResponse({ body: markdownBlob('# Weekly status\n') }));

    await settleBlobText();
    fixture.detectChanges();

    expect(compiled.textContent).toContain('Markdown could not be copied.');
    expect(fixture.componentInstance.isCopyingMarkdown()).toBeFalse();
  });

  it('downloads exported Markdown using the attachment filename', () => {
    const createObjectUrl = spyOn(URL, 'createObjectURL').and.returnValue('blob:status-report');
    const revokeObjectUrl = spyOn(URL, 'revokeObjectURL').and.stub();
    const linkClick = spyOn(HTMLAnchorElement.prototype, 'click').and.stub();
    const appendChild = document.body.appendChild.bind(document.body);
    let downloadedFileName = '';

    spyOn(document.body, 'appendChild').and.callFake(<T extends Node>(node: T): T => {
      if (node instanceof HTMLAnchorElement) {
        downloadedFileName = node.download;
      }

      return appendChild(node) as T;
    });

    createComponent();
    flushReport();

    const compiled = fixture.nativeElement as HTMLElement;
    const downloadButton = [...compiled.querySelectorAll<HTMLButtonElement>('button')].find(
      (button) => button.textContent?.includes('Download Markdown')
    );

    downloadButton?.click();
    const exportRequest = http.expectOne(
      `/api/projects/${projectId}/status-reports/${reportId}/export.md`
    );
    expect(exportRequest.request.method).toBe('GET');
    expect(exportRequest.request.responseType).toBe('blob');
    exportRequest.flush(new Blob(['# Weekly status\n'], { type: 'text/markdown' }), {
      headers: {
        'Content-Disposition': 'attachment; filename="weekly-status.md"'
      }
    });
    fixture.detectChanges();

    expect(createObjectUrl).toHaveBeenCalled();
    expect(linkClick).toHaveBeenCalled();
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:status-report');
    expect(downloadedFileName).toBe('weekly-status.md');
    expect(fixture.componentInstance.isDownloadingMarkdown()).toBeFalse();
    expect(compiled.textContent).toContain('Markdown download started.');
  });

  it('prints the report detail page', () => {
    const print = spyOn(window, 'print').and.stub();
    createComponent();
    flushReport();

    const compiled = fixture.nativeElement as HTMLElement;
    const printButton = [...compiled.querySelectorAll<HTMLButtonElement>('button')].find((button) =>
      button.textContent?.includes('Print')
    );

    printButton?.click();

    expect(print).toHaveBeenCalled();
  });

  it('keeps sharing actions grouped for wrapping and print hiding', () => {
    createComponent();
    flushReport();

    const compiled = fixture.nativeElement as HTMLElement;
    const actions = compiled.querySelector<HTMLElement>('.report-actions');
    const actionButtons = compiled.querySelectorAll<HTMLButtonElement>('.report-actions button');

    expect(actions).not.toBeNull();
    expect(actions?.getAttribute('aria-label')).toBe('Report sharing actions');
    expect(compiled.textContent).toContain('Reports · Published snapshots');
    expect(compiled.textContent).toContain('Share and export');
    expect(compiled.textContent).toContain('Report actions');
    expect(actionButtons.length).toBe(3);
    expect([...actionButtons].every((button) => button.type === 'button')).toBeTrue();
  });

  it('renders archived project reports from their stored snapshot', () => {
    createComponent();
    flushReport(report({ projectStatus: 'archived' }));

    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.textContent).toContain('WT · Worktrail');
    expect(compiled.textContent).toContain('Published snapshot');
    expect(compiled.textContent).toContain('Weekly delivery status');
  });

  it('shows an error state when the report cannot be loaded', () => {
    createComponent();
    http.expectOne(`/api/projects/${projectId}/status-reports/${reportId}`).flush(
      { error: { code: 'NOT_FOUND', message: 'Status report not found.' } },
      { status: 404, statusText: 'Not Found' }
    );
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.textContent).toContain('Report could not be loaded from the API.');
    expect(compiled.querySelector('.report-hero')).toBeNull();
  });
});
