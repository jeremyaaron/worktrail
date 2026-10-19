import { Location } from '@angular/common';
import { provideLocationMocks } from '@angular/common/testing';
import { provideHttpClient } from '@angular/common/http';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { NavigationCancel, Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Subject, filter, firstValueFrom, take } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DraftConfirmationService } from './draft-confirmation.service';
import { DraftDepartureCoordinator, draftRouteKey } from './draft-departure-coordinator';
import { protectEditorDeparture, protectReusedEditor } from './draft-departure.guards';
import { DraftTracker } from './draft-tracker';
import { PageContext } from './page-context';

@Component({ template: '<input [formControl]="source" />', imports: [ReactiveFormsModule] })
class EditorHost implements OnInit {
  readonly source = new FormControl('Baseline', { nonNullable: true });
  readonly pending = signal(false);
  readonly tracker = new DraftTracker(() => this.source.value);
  readonly context = new PageContext();
  readonly departure = inject(DraftDepartureCoordinator);
  private readonly destroyRef = inject(DestroyRef);
  discarded = 0;
  token!: symbol;
  ngOnInit(): void {
    this.token = this.departure.register({
      category: 'Test draft', context: () => this.context.contextKey(),
      routeKey: () => draftRouteKey('detail', this.context.param('workItemId')),
      revision: () => this.tracker.revision(), meaningful: () => this.tracker.meaningful(),
      pending: () => this.pending(), discard: () => {
        this.discarded += 1;
        this.source.setValue('Baseline');
        this.tracker.accept();
      }
    }, this.destroyRef);
    const subscription = this.source.valueChanges.subscribe(() => this.departure.refresh());
    this.destroyRef.onDestroy(() => subscription.unsubscribe());
    this.context.start(() => { this.source.setValue('Baseline'); this.tracker.accept(); });
  }
}

@Component({ template: 'Destination' })
class Destination {}

describe('DraftDepartureCoordinator with real guards', () => {
  let harness: RouterTestingHarness;
  let router: Router;
  let confirmation: ReturnType<typeof vi.fn<() => Promise<boolean>>>;
  let departure: DraftDepartureCoordinator;
  let editor: EditorHost;

  beforeEach(async () => {
    confirmation = vi.fn<() => Promise<boolean>>().mockResolvedValue(false);
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideLocationMocks(),
      { provide: DraftConfirmationService, useValue: { confirm: confirmation } },
      provideRouter([
        { path: 'work-items/:workItemId', component: EditorHost, data: { draftEditor: 'detail' },
          canActivate: [protectReusedEditor], canDeactivate: [protectEditorDeparture], runGuardsAndResolvers: 'always' },
        { path: 'other/:workItemId', component: EditorHost, data: { draftEditor: 'detail' },
          canActivate: [protectReusedEditor], canDeactivate: [protectEditorDeparture], runGuardsAndResolvers: 'always' },
        { path: 'destination', component: Destination },
        { path: 'rejected', component: Destination, canActivate: [() => false] },
        { path: 'error', component: Destination, resolve: { failure: () => { throw new Error('Activation failure'); } } }
      ])
    ] });
    router = TestBed.inject(Router);
    router.setUpLocationChangeListener();
    departure = TestBed.inject(DraftDepartureCoordinator);
    harness = await RouterTestingHarness.create();
    editor = await harness.navigateByUrl('/work-items/a', EditorHost);
  });

  afterEach(() => { harness.fixture.destroy(); vi.restoreAllMocks(); });

  it('uses value equality, not form dirty; reverted, clean and fragment-only drafts do not prompt', async () => {
    editor.source.setValue('Changed');
    editor.source.setValue('Baseline');
    editor.source.markAsDirty();
    expect(await router.navigateByUrl('/work-items/a#files')).toBe(true);
    editor.source.setValue('A real draft');
    expect(await router.navigateByUrl('/work-items/a?returnUrl=%2Fwork-items')).toBe(true);
    expect(editor.source.value).toBe('A real draft');
    expect(confirmation).not.toHaveBeenCalled();
    editor.source.setValue('Baseline');
    expect(await router.navigateByUrl('/destination')).toBe(true);
    expect(confirmation).not.toHaveBeenCalled();
  });

  it('preserves drafts and reused identity on Stay and discards only after committed navigation', async () => {
    editor.source.setValue('Keep me');
    expect(await router.navigateByUrl('/work-items/b')).toBe(false);
    expect(editor.source.value).toBe('Keep me');
    expect(editor.context.param('workItemId')).toBe('a');
    expect(editor.discarded).toBe(0);
    confirmation.mockResolvedValue(true);
    expect(await router.navigateByUrl('/work-items/b')).toBe(true);
    expect(harness.routeDebugElement?.componentInstance).toBe(editor);
    expect(editor.context.param('workItemId')).toBe('b');
    expect(editor.source.value).toBe('Baseline');
    expect(editor.discarded).toBe(1);
  });

  for (const failure of ['rejected', 'error']) {
    it(`keeps an approved draft when a later ${failure} prevents navigation`, async () => {
      editor.source.setValue('Not discarded');
      confirmation.mockResolvedValue(true);
      await router.navigateByUrl('/' + failure).catch(() => false);
      expect(router.url).toBe('/work-items/a');
      expect(editor.source.value).toBe('Not discarded');
      expect(editor.discarded).toBe(0);
      expect(departure.isDeparting()).toBe(false);
      expect(await router.navigateByUrl('/work-items/b')).toBe(true);
      expect(confirmation).toHaveBeenCalledTimes(2);
    });
  }

  it('shares one decision between deactivation and activation guards', async () => {
    editor.source.setValue('Draft');
    confirmation.mockResolvedValue(true);
    expect(await router.navigateByUrl('/other/b')).toBe(true);
    expect(confirmation).toHaveBeenCalledTimes(1);
    const destination = harness.routeDebugElement?.componentInstance as EditorHost;
    expect(destination.source.value).toBe('Baseline');
    expect(destination.discarded).toBe(0);
  });

  it('aborts stale approval if a mounted draft changes during a later asynchronous guard', async () => {
    let entered!: () => void;
    const guardStarted = new Promise<void>((resolve) => { entered = resolve; });
    const answer = new Subject<boolean>();
    router.config.push({ path: 'delayed', component: Destination, canActivate: [() => {
      entered(); return answer;
    }] });
    editor.source.setValue('Approved draft');
    confirmation.mockResolvedValue(true);
    const navigating = router.navigateByUrl('/delayed');
    await guardStarted;
    editor.source.setValue('Newer draft after approval');
    expect(await navigating).toBe(false);
    expect(router.url).toBe('/work-items/a');
    expect(editor.source.value).toBe('Newer draft after approval');
    expect(editor.discarded).toBe(0);
    expect(departure.status()).toContain('draft changed');
    answer.complete();
  });

  it('blocks route, actor/local and explicit discard attempts while a write is unresolved', async () => {
    editor.pending.set(true);
    const commit = vi.fn();
    expect(await router.navigateByUrl('/destination')).toBe(false);
    expect(await departure.change(commit)).toBe(false);
    expect(await departure.change(commit, [editor.token])).toBe(false);
    expect(commit).not.toHaveBeenCalled();
    expect(confirmation).not.toHaveBeenCalled();
    expect(departure.status()).toContain('save to finish');
    editor.pending.set(false);
    expect(await router.navigateByUrl('/destination')).toBe(true);
  });

  it('does not queue another change or accept a stale revision while confirmation is pending', async () => {
    editor.source.setValue('Draft');
    let answer!: (value: boolean) => void;
    confirmation.mockReturnValue(new Promise<boolean>((resolve) => { answer = resolve; }));
    const firstCommit = vi.fn();
    const secondCommit = vi.fn();
    const first = departure.change(firstCommit);
    expect(await departure.change(secondCommit)).toBe(false);
    editor.source.setValue('A newer draft');
    answer(true);
    expect(await first).toBe(false);
    expect(firstCommit).not.toHaveBeenCalled();
    expect(secondCommit).not.toHaveBeenCalled();
    expect(editor.source.value).toBe('A newer draft');
    expect(confirmation).toHaveBeenCalledTimes(1);
  });

  it('guards browser history without replaying a cancelled departure', async () => {
    await harness.navigateByUrl('/work-items/b', EditorHost);
    editor.source.setValue('History draft');
    const location = TestBed.inject(Location);
    const cancelled = firstValueFrom(router.events.pipe(filter((event) => event instanceof NavigationCancel), take(1)));
    location.back();
    await cancelled;
    expect(router.url).toBe('/work-items/b');
    expect(editor.source.value).toBe('History draft');
    expect(editor.context.param('workItemId')).toBe('b');
    expect(confirmation).toHaveBeenCalledTimes(1);
  });

  it('attaches native unload protection only for meaningful drafts or pending writes', () => {
    let listener: EventListener | null = null;
    vi.spyOn(window, 'addEventListener').mockImplementation((name: string, handler: EventListenerOrEventListenerObject) => {
      if (name === 'beforeunload') listener = handler as EventListener;
    });
    vi.spyOn(window, 'removeEventListener').mockImplementation((name: string) => {
      if (name === 'beforeunload') listener = null;
    });
    const dispatch = () => {
      const event = new Event('beforeunload', { cancelable: true });
      // Invoking our listener avoids Karma's independent page-reload detector.
      if (listener !== null) (listener as EventListener)(event);
      return event.defaultPrevented;
    };
    expect(dispatch()).toBe(false);
    editor.source.setValue('Draft');
    expect(dispatch()).toBe(true);
    editor.source.setValue('Baseline');
    expect(dispatch()).toBe(false);
    editor.pending.set(true);
    departure.refresh();
    expect(dispatch()).toBe(true);
    editor.pending.set(false);
    departure.refresh();
    expect(dispatch()).toBe(false);
    harness.fixture.destroy();
    expect(dispatch()).toBe(false);
  });

  it('updates a successful save baseline before programmatic departure, without prompting', async () => {
    editor.source.setValue('Saved');
    editor.tracker.accept();
    expect(await router.navigateByUrl('/destination')).toBe(true);
    expect(confirmation).not.toHaveBeenCalled();
  });
});
