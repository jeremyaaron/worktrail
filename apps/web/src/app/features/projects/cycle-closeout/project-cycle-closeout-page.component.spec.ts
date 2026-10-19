import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import type { ProjectCycleCloseoutPreviewDto } from '@worktrail/contracts';
import { BehaviorSubject } from 'rxjs';

import { ProjectCycleCloseoutPageComponent } from './project-cycle-closeout-page.component';

const workspaceId = '10000000-0000-4000-8000-000000000001';
const projectId = '10000000-0000-4000-8000-000000000201';
const cycleId = '10000000-0000-4000-8000-000000000701';
const destinationId = '10000000-0000-4000-8000-000000000702';
const laterDestinationId = '10000000-0000-4000-8000-000000000703';
const itemId = '10000000-0000-4000-8000-000000000401';

function closeoutPreview(
  input: Partial<ProjectCycleCloseoutPreviewDto> = {}
): ProjectCycleCloseoutPreviewDto {
  return {
    project: input.project ?? {
      id: projectId,
      workspaceId,
      key: 'WT',
      name: 'Worktrail App',
      description: '',
      status: 'active',
      createdAt: '2026-07-01T12:00:00.000Z',
      updatedAt: '2026-07-10T12:00:00.000Z'
    },
    cycle: input.cycle ?? {
      id: cycleId,
      workspaceId,
      projectId,
      name: 'July delivery cycle',
      goal: 'Finish the committed delivery scope.',
      status: 'active',
      startDate: '2026-07-01',
      endDate: '2026-07-14',
      targetPoints: 20,
      isArchived: false,
      archivedAt: null,
      createdAt: '2026-06-25T12:00:00.000Z',
      updatedAt: '2026-07-10T12:00:00.000Z'
    },
    generatedAt: input.generatedAt ?? '2026-07-14T12:00:00.000Z',
    health: input.health ?? {
      health: 'at_risk',
      reasons: [
        {
          key: 'dependency_blocked',
          severity: 'warning',
          message: '1 open work item is dependency blocked.',
          count: 1,
          countUnit: 'work_items' as const,
          query: { cycleId, dependency: 'dependency_blocked' }
        }
      ]
    },
    counts: input.counts ?? {
      totalCount: 4,
      completedCount: 2,
      canceledCount: 1,
      unfinishedCount: 1,
      retainedCount: 3,
      committedEstimatePoints: 13,
      completedEstimatePoints: 8,
      unfinishedEstimatePoints: 5,
      unestimatedUnfinishedCount: 0
    },
    unfinishedItems: input.unfinishedItems ?? [
      {
        id: itemId,
        displayKey: 'WT-42',
        title: 'Resolve closeout dependency',
        status: 'blocked',
        priority: 'urgent',
        assignee: { id: '10000000-0000-4000-8000-000000000101', name: 'Avery Owner' },
        estimatePoints: 5,
        dependencyBlocked: true
      }
    ],
    eligibleDestinations: input.eligibleDestinations ?? [
      {
        cycle: {
          id: destinationId,
          workspaceId,
          projectId,
          name: 'Next delivery cycle',
          goal: '',
          status: 'planned',
          startDate: '2026-07-15',
          endDate: '2026-07-28',
          targetPoints: 20,
          isArchived: false,
          archivedAt: null,
          createdAt: '2026-07-01T12:00:00.000Z',
          updatedAt: '2026-07-01T12:00:00.000Z'
        }
      },
      {
        cycle: {
          id: laterDestinationId,
          workspaceId,
          projectId,
          name: 'Later delivery cycle',
          goal: '',
          status: 'planned',
          startDate: '2026-07-29',
          endDate: '2026-08-11',
          targetPoints: null,
          isArchived: false,
          archivedAt: null,
          createdAt: '2026-07-01T12:00:00.000Z',
          updatedAt: '2026-07-01T12:00:00.000Z'
        }
      }
    ]
  };
}

describe('ProjectCycleCloseoutPageComponent', () => {
  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let http: HttpTestingController;
  let router: Router;

  beforeEach(async () => {
    params = new BehaviorSubject(convertToParamMap({ projectId, cycleId }));
    await TestBed.configureTestingModule({
      imports: [ProjectCycleCloseoutPageComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { paramMap: params.asObservable() } }
      ]
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    http.verify();
  });

  it('renders metrics and unfinished scope without silently selecting a destination', () => {
    const fixture = TestBed.createComponent(ProjectCycleCloseoutPageComponent);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Loading cycle closeout preview'
    );

    http.expectOne(`/api/projects/${projectId}/cycles/${cycleId}/closeout-preview`).flush(
      closeoutPreview()
    );
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('July delivery cycle');
    expect(text).toContain('Completed2');
    expect(text).toContain('Canceled1');
    expect(text).toContain('Unfinished1');
    expect(text).toContain('Resolve closeout dependency');
    expect(text).toContain('Dependency blocked');
    expect(text).toContain('1 open work item is dependency blocked.');
    expect(fixture.componentInstance.form.controls.destinationCycleId.value).toBe('');
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('input:checked').length).toBe(0);
    fixture.componentInstance.submit();
    http.expectNone(`/api/projects/${projectId}/cycles/${cycleId}/closeout`);
    expect(
      (fixture.nativeElement as HTMLElement)
        .querySelector<HTMLAnchorElement>(`.work-row__identity a`)
        ?.getAttribute('href')
    ).toBe(`/work-items/${itemId}?returnUrl=${encodeURIComponent(`/projects/${projectId}/cycles/${cycleId}/closeout#unfinished-heading`)}`);
  });

  it('shows load errors, retries, and reloads when route parameters change', () => {
    const fixture = TestBed.createComponent(ProjectCycleCloseoutPageComponent);
    fixture.detectChanges();
    http
      .expectOne(`/api/projects/${projectId}/cycles/${cycleId}/closeout-preview`)
      .flush(
        { error: { message: 'Preview is temporarily unavailable.' } },
        { status: 500, statusText: 'Server Error' }
      );
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Preview is temporarily unavailable.'
    );

    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.error-panel button')?.click();
    http
      .expectOne(`/api/projects/${projectId}/cycles/${cycleId}/closeout-preview`)
      .flush(closeoutPreview());

    const nextProjectId = '10000000-0000-4000-8000-000000000202';
    const nextCycleId = '10000000-0000-4000-8000-000000000704';
    params.next(convertToParamMap({ projectId: nextProjectId, cycleId: nextCycleId }));
    http
      .expectOne(`/api/projects/${nextProjectId}/cycles/${nextCycleId}/closeout-preview`)
      .flush(
        closeoutPreview({
          project: { ...closeoutPreview().project, id: nextProjectId },
          cycle: { ...closeoutPreview().cycle, id: nextCycleId, projectId: nextProjectId }
        })
      );
    fixture.detectChanges();

    expect(fixture.componentInstance.projectId()).toBe(nextProjectId);
    expect(fixture.componentInstance.cycleId()).toBe(nextCycleId);
  });

  it('submits null carryover once and navigates to cycle review after success', () => {
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(ProjectCycleCloseoutPageComponent);
    fixture.detectChanges();
    http
      .expectOne(`/api/projects/${projectId}/cycles/${cycleId}/closeout-preview`)
      .flush(closeoutPreview({ eligibleDestinations: [] }));
    fixture.detectChanges();

    expect(fixture.componentInstance.form.controls.destinationCycleId.value).toBe('');
    fixture.componentInstance.submit();
    http.expectNone(`/api/projects/${projectId}/cycles/${cycleId}/closeout`);
    (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>('input[type=radio]')!.click();
    expect(fixture.componentInstance.form.controls.destinationCycleId.value).toBeNull();
    fixture.componentInstance.submit();
    fixture.componentInstance.submit();

    const closeout = http.expectOne(`/api/projects/${projectId}/cycles/${cycleId}/closeout`);
    expect(closeout.request.method).toBe('POST');
    expect(closeout.request.body).toEqual({ destinationCycleId: null });
    expect(Object.keys(closeout.request.body)).toEqual(['destinationCycleId']);
    closeout.flush({});

    expect(navigate).toHaveBeenCalledWith(['/projects', projectId, 'cycles', cycleId], { fragment: 'cycle-result-heading' });
  });

  it('keeps the submit button sized for both labels with wider font metrics and after failure', () => {
    const fixture = TestBed.createComponent(ProjectCycleCloseoutPageComponent);
    fixture.detectChanges();
    http.expectOne(`/api/projects/${projectId}/cycles/${cycleId}/closeout-preview`).flush(
      closeoutPreview()
    );
    fixture.detectChanges();

    const button = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      '.form-actions button'
    )!;
    button.style.fontFamily = 'monospace';
    button.style.fontSize = '24px';
    fixture.componentInstance.form.controls.destinationCycleId.setValue(destinationId);
    const resting = button.getBoundingClientRect();
    expect(resting.width).toBeGreaterThan(112);

    fixture.componentInstance.submit();
    fixture.detectChanges();
    expect(button.disabled).toBe(true);
    expect(button.getBoundingClientRect().width).toBeCloseTo(resting.width, 0);
    expect(button.getBoundingClientRect().height).toBeCloseTo(resting.height, 0);
    expect(button.querySelector('[aria-hidden="true"]')?.textContent?.trim()).toBe('Close cycle');
    expect(button.querySelector('span:not([aria-hidden])')?.textContent?.trim()).toBe('Closing...');
    expect(getComputedStyle(button.querySelector<HTMLElement>('[aria-hidden="true"]')!).visibility)
      .toBe('hidden');

    http.expectOne(`/api/projects/${projectId}/cycles/${cycleId}/closeout`).flush(
      { error: { message: 'Please retry.' } },
      { status: 500, statusText: 'Internal Server Error' }
    );
    fixture.detectChanges();
    expect(button.disabled).toBe(false);
    expect(button.getBoundingClientRect().width).toBeCloseTo(resting.width, 0);
    expect(button.getBoundingClientRect().height).toBeCloseTo(resting.height, 0);
    expect(button.querySelector('[aria-hidden="true"]')?.textContent?.trim()).toBe('Closing...');
    expect(button.querySelector('span:not([aria-hidden])')?.textContent?.trim()).toBe('Close cycle');
    expect(getComputedStyle(button.querySelector<HTMLElement>('span:not([aria-hidden])')!).visibility)
      .toBe('visible');
  });

  it('disables destination selection when no unfinished work exists', () => {
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(ProjectCycleCloseoutPageComponent);
    fixture.detectChanges();
    http
      .expectOne(`/api/projects/${projectId}/cycles/${cycleId}/closeout-preview`)
      .flush(
        closeoutPreview({
          counts: {
            totalCount: 3,
            completedCount: 2,
            canceledCount: 1,
            unfinishedCount: 0,
            retainedCount: 3,
            committedEstimatePoints: 8,
            completedEstimatePoints: 8,
            unfinishedEstimatePoints: 0,
            unestimatedUnfinishedCount: 0
          },
          unfinishedItems: []
        })
      );
    fixture.detectChanges();

    expect(fixture.componentInstance.form.controls.destinationCycleId.disabled).toBe(true);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'No work item assignments will move.'
    );
    expect((fixture.nativeElement as HTMLElement).querySelector('fieldset')).toBeNull();

    fixture.componentInstance.submit();
    const closeout = http.expectOne(`/api/projects/${projectId}/cycles/${cycleId}/closeout`);
    expect(closeout.request.body).toEqual({ destinationCycleId: null });
    closeout.flush({});
    expect(navigate).toHaveBeenCalledExactlyOnceWith(
      ['/projects', projectId, 'cycles', cycleId], { fragment: 'cycle-result-heading' }
    );
  });

  it('shows conflicts and refreshes the preview before another submission', () => {
    const fixture = TestBed.createComponent(ProjectCycleCloseoutPageComponent);
    fixture.detectChanges();
    http
      .expectOne(`/api/projects/${projectId}/cycles/${cycleId}/closeout-preview`)
      .flush(closeoutPreview());
    fixture.componentInstance.form.controls.destinationCycleId.setValue(destinationId);
    fixture.componentInstance.submit();
    http
      .expectOne(`/api/projects/${projectId}/cycles/${cycleId}/closeout`)
      .flush(
        { error: { message: 'Destination cycle must be planned and not archived.' } },
        { status: 409, statusText: 'Conflict' }
      );
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Closeout scope changed');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Destination cycle must be planned and not archived.'
    );

    fixture.componentInstance.submit();
    http.expectNone(`/api/projects/${projectId}/cycles/${cycleId}/closeout`);
    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.conflict button')?.click();
    http
      .expectOne(`/api/projects/${projectId}/cycles/${cycleId}/closeout-preview`)
      .flush(closeoutPreview({ eligibleDestinations: [] }));
    fixture.detectChanges();
    expect(fixture.componentInstance.form.controls.destinationCycleId.value).toBe('');
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('input:checked').length).toBe(0);
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('Closeout scope changed');
  });
  it('rejects an unknown destination, preserves choices after ordinary failures, and cannot refresh away a pending write', () => {
    const fixture = TestBed.createComponent(ProjectCycleCloseoutPageComponent);
    fixture.detectChanges();
    http.expectOne(`/api/projects/${projectId}/cycles/${cycleId}/closeout-preview`).flush(closeoutPreview());
    fixture.componentInstance.form.controls.destinationCycleId.setValue(itemId);
    fixture.componentInstance.submit();
    http.expectNone(`/api/projects/${projectId}/cycles/${cycleId}/closeout`);
    fixture.componentInstance.form.controls.destinationCycleId.setValue(laterDestinationId);
    fixture.componentInstance.submit();
    const request = http.expectOne(`/api/projects/${projectId}/cycles/${cycleId}/closeout`);
    expect(request.request.body).toEqual({ destinationCycleId: laterDestinationId });
    fixture.componentInstance.loadPreview();
    expect(request.cancelled).toBe(false);
    http.expectNone(`/api/projects/${projectId}/cycles/${cycleId}/closeout-preview`);
    request.flush({ error: { message: 'Retry later.' } }, { status: 503, statusText: 'Unavailable' });
    expect(fixture.componentInstance.form.controls.destinationCycleId.value).toBe(laterDestinationId);
    expect(fixture.componentInstance.isSubmitting()).toBe(false);
  });

  it('ignores an old closeout response after the route identity changes', () => {
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(ProjectCycleCloseoutPageComponent);
    fixture.detectChanges();
    http.expectOne(`/api/projects/${projectId}/cycles/${cycleId}/closeout-preview`).flush(closeoutPreview());
    fixture.componentInstance.form.controls.destinationCycleId.setValue(destinationId);
    fixture.componentInstance.submit();
    const pending = http.expectOne(`/api/projects/${projectId}/cycles/${cycleId}/closeout`);
    params.next(convertToParamMap({ projectId, cycleId: laterDestinationId }));
    http.expectOne(`/api/projects/${projectId}/cycles/${laterDestinationId}/closeout-preview`).flush(closeoutPreview());
    expect(pending.cancelled).toBe(false);
    pending.flush({});
    expect(navigate).not.toHaveBeenCalled();
    expect(fixture.componentInstance.form.controls.destinationCycleId.value).toBe('');
    expect(fixture.componentInstance.isSubmitting()).toBe(false);
  });

});

afterEach(() => {
  try {
    TestBed.resetTestingModule();
  } finally {
    vi.restoreAllMocks();
    localStorage.removeItem('worktrail.selectedMemberId');
  }
});
