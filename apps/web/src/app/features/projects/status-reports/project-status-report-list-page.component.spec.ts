import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import type {
  MemberDto,
  ProjectStatusReportSummaryDto,
  ProjectSummaryDto
} from '@worktrail/contracts';

import { CurrentUserService } from '../../../core/current-user.service';
import { ProjectStatusReportListPageComponent } from './project-status-report-list-page.component';

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

const maintainer: MemberDto = {
  ...owner,
  id: '10000000-0000-4000-8000-000000000102',
  name: 'Morgan Maintainer',
  email: 'morgan.maintainer@example.com',
  role: 'maintainer'
};

const contributor: MemberDto = {
  ...owner,
  id: '10000000-0000-4000-8000-000000000103',
  name: 'Case Contributor',
  email: 'case.contributor@example.com',
  role: 'contributor'
};

function projectSummary(status: ProjectSummaryDto['project']['status'] = 'active'): ProjectSummaryDto {
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
      inactiveMilestoneCount: status === 'archived' ? 1 : 0,
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

function reportSummary(input: {
  id: string;
  title: string;
  health?: ProjectStatusReportSummaryDto['health'];
  author?: MemberDto;
  statusDate?: string;
  publishedAt?: string;
}): ProjectStatusReportSummaryDto {
  return {
    id: input.id,
    workspaceId,
    projectId,
    title: input.title,
    statusDate: input.statusDate ?? '2026-07-10',
    health: input.health ?? 'healthy',
    author: input.author ?? owner,
    publishedAt: input.publishedAt ?? '2026-07-10T12:00:00.000Z',
    createdAt: input.publishedAt ?? '2026-07-10T12:00:00.000Z'
  };
}

describe('ProjectStatusReportListPageComponent', () => {
  let fixture: ComponentFixture<ProjectStatusReportListPageComponent>;
  let http: HttpTestingController;
  let currentUser: CurrentUserService;

  beforeEach(async () => {
    localStorage.clear();

    await TestBed.configureTestingModule({
      imports: [ProjectStatusReportListPageComponent],
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
    currentUser.members.set([owner, maintainer, contributor]);
    currentUser.selectMember(owner.id);
  });

  afterEach(() => {
    http.verify();
  });

  function createComponent(): void {
    fixture = TestBed.createComponent(ProjectStatusReportListPageComponent);
    fixture.detectChanges();
  }

  function flushStatusReports(input: {
    summary?: ProjectSummaryDto;
    reports?: ProjectStatusReportSummaryDto[];
  } = {}): void {
    http.expectOne(`/api/projects/${projectId}/summary`).flush(input.summary ?? projectSummary());
    http
      .expectOne(`/api/projects/${projectId}/status-reports`)
      .flush(input.reports ?? []);
    fixture.detectChanges();
  }

  it('shows loading state while report data is requested', () => {
    createComponent();

    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.textContent).toContain('Loading reports');
    http.expectOne(`/api/projects/${projectId}/summary`);
    http.expectOne(`/api/projects/${projectId}/status-reports`);
  });

  it('shows an error state and retries both requests', () => {
    createComponent();

    const summaryRequest = http.expectOne(`/api/projects/${projectId}/summary`);
    http.expectOne(`/api/projects/${projectId}/status-reports`).flush([]);
    summaryRequest.flush(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed' } },
      { status: 500, statusText: 'Server Error' }
    );
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Reports could not be loaded from the API.');

    compiled.querySelector<HTMLButtonElement>('button')?.click();
    fixture.detectChanges();

    flushStatusReports();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('No reports');
  });

  it('renders empty state and create action for active owners', () => {
    createComponent();
    flushStatusReports();

    const compiled = fixture.nativeElement as HTMLElement;
    const createLink = compiled.querySelector<HTMLAnchorElement>('.status-page__primary');

    expect(compiled.textContent).toContain('Reports · Published snapshots');
    expect(compiled.textContent).toContain('Reports preserve point-in-time project evidence.');
    expect(compiled.textContent).toContain('No reports');
    expect(createLink?.textContent?.trim()).toBe('Create report');
    expect(createLink?.getAttribute('href')).toBe('/projects/10000000-0000-4000-8000-000000000201/status/new');
  });

  it('renders latest report prominently and previous reports newest-first', () => {
    createComponent();
    flushStatusReports({
      reports: [
        reportSummary({
          id: '10000000-0000-4000-8000-000000000901',
          title: 'Current executive summary with a deliberately long title that still wraps',
          health: 'at_risk',
          author: maintainer,
          statusDate: '2026-07-12',
          publishedAt: '2026-07-12T15:30:00.000Z'
        }),
        reportSummary({
          id: '10000000-0000-4000-8000-000000000902',
          title: 'Previous delivery update',
          health: 'blocked',
          statusDate: '2026-07-05',
          publishedAt: '2026-07-05T15:30:00.000Z'
        }),
        reportSummary({
          id: '10000000-0000-4000-8000-000000000903',
          title: 'Initial status baseline',
          health: 'healthy',
          statusDate: '2026-06-28',
          publishedAt: '2026-06-28T15:30:00.000Z'
        })
      ]
    });

    const compiled = fixture.nativeElement as HTMLElement;
    const latest = compiled.querySelector('.latest-report');
    const rows = [...compiled.querySelectorAll<HTMLAnchorElement>('.report-row')];

    expect(latest?.textContent).toContain('Latest report');
    expect(latest?.textContent).toContain('Current executive summary');
    expect(latest?.textContent).toContain('At risk');
    expect(latest?.textContent).toContain('Morgan Maintainer');
    expect(rows.map((row) => row.textContent?.trim())).toEqual([
      jasmine.stringContaining('Previous delivery update'),
      jasmine.stringContaining('Initial status baseline')
    ]);
    expect(rows[0]?.getAttribute('href')).toBe(
      '/projects/10000000-0000-4000-8000-000000000201/status/10000000-0000-4000-8000-000000000902'
    );
  });

  it('allows active maintainers to create reports', () => {
    currentUser.selectMember(maintainer.id);
    createComponent();
    flushStatusReports();

    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.status-page__primary')?.textContent).toContain('Create report');
  });

  it('hides create action for contributors', () => {
    currentUser.selectMember(contributor.id);
    createComponent();
    flushStatusReports();

    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.status-page__primary')).toBeNull();
    expect(compiled.textContent).toContain('Only owners and maintainers can publish reports.');
  });

  it('hides create action for archived projects', () => {
    createComponent();
    flushStatusReports({
      summary: projectSummary('archived')
    });

    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.status-page__primary')).toBeNull();
    expect(compiled.textContent).toContain('Archived projects cannot publish new reports.');
  });
});
