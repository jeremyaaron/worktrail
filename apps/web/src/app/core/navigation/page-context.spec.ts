import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, OnInit, computed, signal } from '@angular/core';
import type { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, NavigationCancel, NavigationEnd, NavigationError, NavigationStart, Router, convertToParamMap, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import type { MemberDto } from '@worktrail/contracts';
import { BehaviorSubject, Subject } from 'rxjs';

import { routes } from '../../app.routes';
import { CurrentUserService } from '../current-user.service';
import { ClipboardService } from '../../shared/clipboard.service';
import { ProjectShellComponent } from '../../features/projects/project-shell/project-shell.component';
import { ProjectHomePageComponent } from '../../features/projects/project-home-page.component';
import { ProjectPlanningPageComponent } from '../../features/projects/project-planning-page.component';
import { ProjectMilestoneReviewPageComponent } from '../../features/projects/project-milestone-review-page.component';
import { ProjectCycleReviewPageComponent } from '../../features/projects/project-cycle-review-page.component';
import { ProjectCycleCloseoutPageComponent } from '../../features/projects/cycle-closeout/project-cycle-closeout-page.component';
import { ProjectStatusReportDraftPageComponent } from '../../features/projects/status-reports/project-status-report-draft-page.component';
import { ProjectStatusReportDetailPageComponent } from '../../features/projects/status-reports/project-status-report-detail-page.component';
import { WorkItemCreatePageComponent } from '../../features/work-items/work-item-create-page.component';
import { WorkItemDetailPageComponent } from '../../features/work-items/work-item-detail-page.component';
import { WorkItemListPageComponent } from '../../features/work-items/work-item-list-page.component';
import { WorkspaceWorkItemListPageComponent } from '../../features/work-items/workspace-work-item-list-page.component';
import { PageContext } from './page-context';

const owner: MemberDto = {
  id: 'owner', workspaceId: 'workspace', name: 'Owner', email: 'owner@example.com',
  role: 'owner', isActive: true, deactivatedAt: null,
  createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z'
};
const contributor: MemberDto = { ...owner, id: 'contributor', role: 'contributor' };

@Component({ template: '' })
class ContextProbe implements OnInit {
  readonly context = new PageContext();
  readonly recordId = computed(() => this.context.param('recordId'));
  readonly draft = signal('');
  readonly resets = signal(0);
  ngOnInit(): void {
    this.context.start(() => { this.draft.set(''); this.resets.update((value) => value + 1); });
  }
}

function selectOwner(): CurrentUserService {
  const user = TestBed.inject(CurrentUserService);
  user.members.set([owner, contributor]);
  user.selectMember(owner.id);
  return user;
}

describe('PageContext committed navigation', () => {
  afterEach(() => localStorage.removeItem('worktrail.selectedMemberId'));

  for (const failure of ['cancel', 'error'] as const) {
  it(`buffers early param emissions and leaves a draft intact after navigation ${failure}`, () => {
    const params = new BehaviorSubject(convertToParamMap({ recordId: 'a' }));
    const events = new Subject<unknown>();
    let navigating = false;
    TestBed.configureTestingModule({
      imports: [ContextProbe], providers: [provideHttpClient(), provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: {
          snapshot: { paramMap: params.value }, paramMap: params,
          queryParamMap: new BehaviorSubject(convertToParamMap({}))
        } },
        { provide: Router, useValue: { events, getCurrentNavigation: () => navigating ? {} : null } }
      ]
    });
    selectOwner();
    const fixture = TestBed.createComponent(ContextProbe);
    fixture.detectChanges();
    const page = fixture.componentInstance;
    page.draft.set('Keep this draft');
    navigating = true;
    events.next(new NavigationStart(2, '/records/b'));
    params.next(convertToParamMap({ recordId: 'b' }));
    expect(page.recordId()).toBe('a');
    expect(page.draft()).toBe('Keep this draft');
    events.next(failure === 'cancel' ? new NavigationCancel(2, '/records/b', 'Rejected')
      : new NavigationError(2, '/records/b', new Error('Activation failed')));
    params.next(convertToParamMap({ recordId: 'a' }));
    navigating = false;
    expect(page.recordId()).toBe('a');
    expect(page.draft()).toBe('Keep this draft');
    navigating = true;
    params.next(convertToParamMap({ recordId: 'b' }));
    events.next(new NavigationEnd(3, '/records/b', '/records/b'));
    navigating = false;
    expect(page.recordId()).toBe('b');
    expect(page.draft()).toBe('');
    expect(page.resets()).toBe(2);
  });
  }

  for (const outcome of ['success', 'error'] as const) {
    it(`rejects an old actor ${outcome} even before the actor effect runs`, () => {
      TestBed.configureTestingModule({ imports: [ContextProbe], providers: [
        provideHttpClient(), provideHttpClientTesting(), provideRouter([])
      ] });
      const user = selectOwner();
      const fixture = TestBed.createComponent(ContextProbe);
      fixture.detectChanges();
      const source = new Subject<string>();
      const next = jasmine.createSpy('next');
      const error = jasmine.createSpy('error');
      source.pipe(fixture.componentInstance.context.guard()).subscribe({ next, error });
      user.selectMember(contributor.id);
      if (outcome === 'success') source.next('obsolete');
      else source.error(new Error('obsolete'));
      expect(next).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
    });
  }

  it('invalidates captured completion/finalization after A to B to A and after destruction', () => {
    TestBed.configureTestingModule({ imports: [ContextProbe], providers: [
      provideHttpClient(), provideHttpClientTesting(), provideRouter([])
    ] });
    const user = selectOwner();
    const fixture = TestBed.createComponent(ContextProbe);
    fixture.detectChanges();
    const context = fixture.componentInstance.context;
    const oldCompletion = context.capture();
    user.selectMember(contributor.id);
    user.selectMember(owner.id);
    expect(oldCompletion()).toBeFalse();
    const currentCompletion = context.capture();
    expect(currentCompletion()).toBeTrue();
    fixture.destroy();
    expect(currentCompletion()).toBeFalse();
  });

  for (const outcome of ['success', 'error'] as const) {
    it(`ignores a submitted mutation's late ${outcome} after a rapid actor A to B to A`, () => {
      TestBed.configureTestingModule({ imports: [ContextProbe], providers: [
        provideHttpClient(), provideHttpClientTesting(), provideRouter([])
      ] });
      const user = selectOwner();
      const fixture = TestBed.createComponent(ContextProbe);
      fixture.detectChanges();
      const source = new Subject<string>();
      const next = jasmine.createSpy('next');
      const error = jasmine.createSpy('error');
      source.pipe(fixture.componentInstance.context.guardMutation()).subscribe({ next, error });
      user.selectMember(contributor.id);
      user.selectMember(owner.id);
      expect(source.observed).toBeTrue();
      if (outcome === 'success') source.next('obsolete');
      else source.error(new Error('obsolete'));
      expect(next).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
    });
  }
});

describe('Page context with real reused Worktrail routes', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(), provideHttpClientTesting(), provideRouter(routes)
    ] });
    TestBed.overrideComponent(ProjectShellComponent, { set: { template: '<router-outlet />' } });
    // Exercise real page owners/clients with real inherited routes, independently of presentation.
    for (const component of [ProjectHomePageComponent, ProjectPlanningPageComponent,
      ProjectMilestoneReviewPageComponent, ProjectCycleReviewPageComponent,
      ProjectCycleCloseoutPageComponent, ProjectStatusReportDraftPageComponent,
      ProjectStatusReportDetailPageComponent, WorkItemDetailPageComponent,
      WorkItemCreatePageComponent, WorkItemListPageComponent, WorkspaceWorkItemListPageComponent]) {
      TestBed.overrideComponent(component, { set: { template: '' } });
    }
    selectOwner();
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
  });

  afterEach(() => {
    harness.fixture.destroy();
    http.verify({ ignoreCancelled: true });
    localStorage.removeItem('worktrail.selectedMemberId');
  });

  function nestedPage<T>(component: Type<T>): T {
    const debug = harness.fixture.debugElement.query((node) => node.componentInstance instanceof component);
    return debug.componentInstance as T;
  }

  it('reuses project shell/home, clears the old summary, and updates inherited links before loading B', async () => {
    await harness.navigateByUrl('/projects/a');
    const shell = nestedPage(ProjectShellComponent);
    const home = nestedPage(ProjectHomePageComponent);
    const initial = http.match('/api/projects/a/summary');
    expect(initial.length).toBe(2);
    initial.forEach((request) => request.flush({ project: { id: 'a', name: 'A' } }));
    expect(home.summary()?.project.id).toBe('a');
    await harness.navigateByUrl('/projects/b');
    expect(nestedPage(ProjectHomePageComponent)).toBe(home);
    expect(nestedPage(ProjectShellComponent)).toBe(shell);
    expect(home.projectId()).toBe('b');
    expect(home.summary()).toBeNull();
    expect(shell.summary()).toBeNull();
    expect(shell.sections().every((section) => section.commands[1] === 'b')).toBeTrue();
    const next = http.match('/api/projects/b/summary');
    expect(next.length).toBe(2);
    next.forEach((request) => request.flush({ project: { id: 'b', name: 'B' } }));
    expect(home.summary()?.project.id).toBe('b');
  });

  it('cancels pending ancestor loads when a project changes', async () => {
    await harness.navigateByUrl('/projects/a');
    const old = http.match('/api/projects/a/summary');
    await harness.navigateByUrl('/projects/b');
    expect(old.length).toBe(2);
    expect(old.every((request) => request.cancelled)).toBeTrue();
    http.match('/api/projects/b/summary');
  });

  it('does not reload a work list or clear its pending read for a fragment-only navigation', async () => {
    await harness.navigateByUrl('/work-items');
    const page = nestedPage(WorkspaceWorkItemListPageComponent);
    const work = http.expectOne((request) => request.url === '/api/work-items');
    http.match(() => true);
    await harness.navigateByUrl('/work-items#results');
    expect(nestedPage(WorkspaceWorkItemListPageComponent)).toBe(page);
    expect(work.cancelled).toBeFalse();
    http.expectNone((request) => request.url === '/api/work-items');
  });

  it('reuses a report draft across inherited project changes without retaining the old narrative', async () => {
    await harness.navigateByUrl('/projects/a/status/new');
    const page = nestedPage(ProjectStatusReportDraftPageComponent);
    http.match('/api/projects/a/summary');
    const old = http.expectOne('/api/projects/a/status-reports/draft');
    page.draftForm.controls.summary.setValue('Project A narrative');
    await harness.navigateByUrl('/projects/b/status/new');
    expect(nestedPage(ProjectStatusReportDraftPageComponent)).toBe(page);
    expect(page.projectId()).toBe('b');
    expect(old.cancelled).toBeTrue();
    expect(page.draftForm.controls.summary.value).toBe('');
    http.match('/api/projects/b/summary');
    http.expectOne('/api/projects/b/status-reports/draft');
  });

  it('reuses closeout across cycle/project changes without a stale destination or submitted command', async () => {
    await harness.navigateByUrl('/projects/a/cycles/one/closeout');
    const page = nestedPage(ProjectCycleCloseoutPageComponent);
    http.match('/api/projects/a/summary');
    const old = http.expectOne('/api/projects/a/cycles/one/closeout-preview');
    page.form.controls.destinationCycleId.setValue('old-destination');
    await harness.navigateByUrl('/projects/b/cycles/two/closeout');
    expect(nestedPage(ProjectCycleCloseoutPageComponent)).toBe(page);
    expect(page.projectId()).toBe('b');
    expect(page.cycleId()).toBe('two');
    expect(old.cancelled).toBeTrue();
    expect(page.form.controls.destinationCycleId.value).toBeNull();
    http.match('/api/projects/b/summary');
    http.expectOne('/api/projects/b/cycles/two/closeout-preview');
  });

  it('cancels creation options during project A to B to A without reviving old selections', async () => {
    await harness.navigateByUrl('/work-items/new');
    const page = nestedPage(WorkItemCreatePageComponent);
    http.expectOne('/api/projects').flush([]);
    http.expectOne('/api/workspace/capabilities').flush({ canCreateWorkItems: true });
    page.workItemForm.controls.projectId.setValue('a');
    const first = http.match((request) => request.url.startsWith('/api/projects/a'));
    page.workItemForm.controls.projectId.setValue('b');
    const second = http.match((request) => request.url.startsWith('/api/projects/b'));
    page.workItemForm.controls.projectId.setValue('a');
    expect(first.length).toBe(4);
    expect(second.length).toBe(4);
    expect([...first, ...second].every((request) => request.cancelled)).toBeTrue();
    expect(page.availableLabels()).toEqual([]);
    expect(page.availableMilestones()).toEqual([]);
    expect(page.availableCycles()).toEqual([]);
    const current = http.match((request) => request.url.startsWith('/api/projects/a'));
    expect(current.length).toBe(4);
    expect(current.every((request) => !request.cancelled)).toBeTrue();
  });

  for (const kind of ['milestones', 'cycles', 'status'] as const) {
    it(`updates reused ${kind} record and inherited project identities together`, async () => {
      await harness.navigateByUrl(`/projects/a/${kind}/one`);
      http.match('/api/projects/a/summary');
      const page = kind === 'milestones' ? nestedPage(ProjectMilestoneReviewPageComponent)
        : kind === 'cycles' ? nestedPage(ProjectCycleReviewPageComponent)
          : nestedPage(ProjectStatusReportDetailPageComponent);
      const path = (project: string, record: string) => kind === 'status'
        ? `/api/projects/${project}/status-reports/${record}`
        : `/api/projects/${project}/${kind}/${record}/review`;
      const old = http.expectOne(path('a', 'one'));
      await harness.navigateByUrl(`/projects/b/${kind}/two`);
      http.match('/api/projects/b/summary');
      expect(old.cancelled).toBeTrue();
      expect(page.projectId()).toBe('b');
      const next = http.expectOne(path('b', 'two'));
      if (kind === 'milestones') {
        expect(page).toBe(nestedPage(ProjectMilestoneReviewPageComponent));
        expect(nestedPage(ProjectMilestoneReviewPageComponent).milestoneId()).toBe('two');
        next.flush({ project: { id: 'b' }, milestone: { id: 'two' } });
      } else if (kind === 'cycles') {
        expect(page).toBe(nestedPage(ProjectCycleReviewPageComponent));
        expect(nestedPage(ProjectCycleReviewPageComponent).cycleId()).toBe('two');
        next.flush({ project: { id: 'b' }, cycle: { id: 'two' } });
      } else {
        expect(page).toBe(nestedPage(ProjectStatusReportDetailPageComponent));
        expect(nestedPage(ProjectStatusReportDetailPageComponent).reportId()).toBe('two');
        next.flush({ id: 'two' });
      }
    });
  }

  it('reuses a detail editor across item IDs, rejects a cancelled departure, and resets only on commit', async () => {
    await harness.navigateByUrl('/work-items/a');
    const page = nestedPage(WorkItemDetailPageComponent);
    const old = http.expectOne('/api/work-items/a');
    page.detailForm.controls.title.setValue('Keep my title');
    const router = TestBed.inject(Router);
    router.config.unshift({ path: 'rejected', component: ContextProbe, canActivate: [() => false] });
    expect(await router.navigateByUrl('/rejected')).toBeFalse();
    expect(page.detailForm.controls.title.value).toBe('Keep my title');
    expect(old.cancelled).toBeFalse();
    await harness.navigateByUrl('/work-items/b');
    expect(nestedPage(WorkItemDetailPageComponent)).toBe(page);
    expect(page.workItemId()).toBe('b');
    expect(page.detailForm.controls.title.value).toBe('');
    expect(old.cancelled).toBeTrue();
    http.expectOne('/api/work-items/b');
  });

  it('clears Planning options and mutation state on actor commit before loading the new authorized context', async () => {
    await harness.navigateByUrl('/projects/a/planning?view=milestones');
    const page = nestedPage(ProjectPlanningPageComponent);
    http.match('/api/projects/a/summary');
    http.expectOne('/api/projects/a').flush({ id: 'a', status: 'active' });
    const options = http.match((request) => /milestones|cycles|planning/.test(request.url));
    expect(options.length).toBe(3);
    page.milestoneForm.controls.name.setValue('Old actor milestone');
    page.createMilestone();
    const mutation = http.expectOne((request) => request.method === 'POST');
    TestBed.inject(CurrentUserService).selectMember(contributor.id);
    harness.detectChanges();
    expect(mutation.cancelled).toBeFalse();
    expect(options.every((request) => request.cancelled)).toBeTrue();
    expect(page.project()).toBeNull();
    expect(page.milestones()).toEqual([]);
    expect(page.cycles()).toEqual([]);
    expect(page.isCreatingMilestone()).toBeFalse();
    expect(page.createError()).toBeNull();
    expect(page.isLoadingProject()).toBeTrue();
    mutation.flush({}, { status: 500, statusText: 'Old actor failure' });
    expect(page.createError()).toBeNull();
    expect(page.isLoadingProject()).toBeTrue();
    const reload = http.expectOne('/api/projects/a');
    expect(reload.request.headers.get('x-worktrail-member-id')).toBe(contributor.id);
    http.match('/api/projects/a/summary');
  });

  it('ignores old report clipboard success and finalization while the new report copy is pending', async () => {
    await harness.navigateByUrl('/projects/a/status/one');
    const page = nestedPage(ProjectStatusReportDetailPageComponent);
    http.match(() => true);
    let finishCopy!: () => void;
    const copy = spyOn(TestBed.inject(ClipboardService), 'copyText').and.returnValue(
      new Promise<void>((resolve) => { finishCopy = resolve; })
    );
    const blob = new Blob(['Old report']);
    spyOn(blob, 'text').and.resolveTo('Old report');
    page.copyMarkdown();
    http.expectOne((request) => request.url.includes('one') && request.url.includes('export')).flush(blob);
    await Promise.resolve();
    await Promise.resolve();
    expect(copy).toHaveBeenCalled();
    await harness.navigateByUrl('/projects/a/status/two');
    http.match(() => true);
    page.copyMarkdown();
    const nextExport = http.expectOne((request) => request.url.includes('two') && request.url.includes('export'));
    finishCopy();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(page.isCopyingMarkdown()).toBeTrue();
    expect(page.shareStatus()).toBeNull();
    expect(nextExport.cancelled).toBeFalse();
  });

  for (const scope of ['project', 'workspace'] as const) {
    it(`invalidates delayed ${scope} saved views and resets their mutation state on actor change`, async () => {
      await harness.navigateByUrl(scope === 'project' ? '/projects/a/work-items' : '/work-items');
      const page = scope === 'project' ? nestedPage(WorkItemListPageComponent)
        : nestedPage(WorkspaceWorkItemListPageComponent);
      const oldViews = http.expectOne((request) => request.url === '/api/saved-work-views');
      page.savedViews.set([]);
      page.isSavingView.set(true);
      page.savedViewMutationError.set('Old message');
      TestBed.inject(CurrentUserService).selectMember(contributor.id);
      harness.detectChanges();
      expect(oldViews.cancelled).toBeTrue();
      expect(page.savedViews()).toEqual([]);
      expect(page.isSavingView()).toBeFalse();
      expect(page.savedViewMutationError()).toBeNull();
      const nextViews = http.expectOne((request) => request.url === '/api/saved-work-views');
      expect(nextViews.request.headers.get('x-worktrail-member-id')).toBe(contributor.id);
      // Each outstanding request is owned by the fixture and torn down below.
      http.match(() => true);
    });
  }

  it('keeps pagination reset pending across rapid actor commits while the URL reset is unresolved', async () => {
    await harness.navigateByUrl('/projects/a/work-items?page=3&pageSize=10');
    const page = nestedPage(WorkItemListPageComponent);
    http.match(() => true);
    const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    const user = TestBed.inject(CurrentUserService);
    user.selectMember(contributor.id);
    user.selectMember(owner.id);
    harness.detectChanges();
    expect(navigate).toHaveBeenCalledTimes(2);
    expect(page.activePageQuery()).toEqual({ page: 1, pageSize: 25 });
    http.expectNone((request) => request.url.endsWith('/work-items'));
    http.match(() => true);
  });
});
