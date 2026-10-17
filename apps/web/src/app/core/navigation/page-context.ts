import { DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router, convertToParamMap } from '@angular/router';
import type { ParamMap } from '@angular/router';
import { EMPTY, ReplaySubject, Subject, catchError, distinctUntilChanged, filter, map, takeUntil, throwError } from 'rxjs';
import type { MonoTypeOperatorFunction } from 'rxjs';

import { CurrentUserService } from '../current-user.service';

interface CommittedRouteState {
  params: ParamMap;
  query: ParamMap;
  fragment: string | null;
}

// Component-local ownership. Proposed params never become an editor's effective context.
export class PageContext {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly actor = inject(CurrentUserService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly invalidated = new Subject<void>();
  private readonly destroyed = new ReplaySubject<void>(1);
  private readonly committed = new ReplaySubject<CommittedRouteState>(1);
  private readonly state = signal(this.readRoute());
  private pending = this.state();
  private generation = 0;
  private key = '';
  private reload: (() => void) | null = null;

  readonly routeState$ = this.committed.asObservable();
  readonly queryParamMap$ = this.routeState$.pipe(
    map((state) => ({ query: state.query, generation: this.generation })),
    distinctUntilChanged((left, right) => left.generation === right.generation &&
      left.query.keys.length === right.query.keys.length &&
      left.query.keys.every((key) => JSON.stringify(left.query.getAll(key)) === JSON.stringify(right.query.getAll(key)))
    ),
    map((state) => state.query)
  );
  readonly fragment = computed(() => this.state().fragment);

  constructor() {
    const subscriptions = this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) this.commitRoute();
    });
    // Also supports standalone route owners outside an in-progress router navigation.
    const ancestors = this.route.pathFromRoot ?? [this.route];
    const inherited = new Map(ancestors.map((route) => [route, route.snapshot?.paramMap ?? convertToParamMap({})]));
    for (const route of ancestors) {
      subscriptions.add(route.paramMap?.subscribe((params) => {
        inherited.set(route, params);
        const values: Record<string, string> = {};
        for (const ancestor of ancestors) {
          const map = inherited.get(ancestor)!;
          for (const key of map.keys) values[key] = map.get(key) ?? '';
        }
        this.pending = { ...this.pending, params: convertToParamMap(values) };
        if (this.router.getCurrentNavigation() === null) this.commitRoute();
      }));
    }
    subscriptions.add(this.route.queryParamMap?.subscribe((query) => {
      this.pending = { ...this.pending, query };
      if (this.router.getCurrentNavigation() === null) this.commitRoute();
    }));
    subscriptions.add(this.route.fragment?.subscribe((fragment) => {
      this.pending = { ...this.pending, fragment };
      if (this.router.getCurrentNavigation() === null) this.commitRoute();
    }));
    subscriptions.add(this.actor.committedActorChanges$.subscribe(() => {
      untracked(() => {
        if (this.acceptIdentity()) this.committed.next(this.state());
      });
    }));
    this.committed.next(this.state());
    effect(() => {
      this.actor.selectedMember();
      untracked(() => {
        if (this.acceptIdentity()) this.committed.next(this.state());
      });
    });
    this.destroyRef.onDestroy(() => {
      this.reload = null;
      this.destroyed.next();
      this.destroyed.complete();
      this.invalidated.complete();
      this.committed.complete();
      subscriptions.unsubscribe();
    });
  }

  param(name: string): string { return this.state().params.get(name) ?? ''; }
  query(name: string): string { return this.state().query.get(name) ?? ''; }
  contextKey(): string { return this.identity(); }

  start(reload: () => void): void {
    this.reload = reload;
    this.key = this.identity();
    untracked(reload);
  }

  capture(): () => boolean {
    const generation = this.generation;
    const key = this.key;
    return () => !this.destroyRef.destroyed && generation === this.generation && key === this.identity();
  }

  guard<T>(isOperationCurrent: () => boolean = () => true, cancelOnChange = true): MonoTypeOperatorFunction<T> {
    const contextCurrent = this.capture();
    const current = () => contextCurrent() && isOperationCurrent();
    return (source) => source.pipe(
      filter(current),
      catchError((error: unknown) => current() ? throwError(() => error) : EMPTY),
      takeUntil(cancelOnChange ? this.invalidated : EMPTY),
      takeUntil(this.destroyed)
    );
  }

  // A submitted write can still commit remotely. Ignore its obsolete result without claiming cancellation.
  guardMutation<T>(isOperationCurrent: () => boolean = () => true): MonoTypeOperatorFunction<T> {
    return this.guard(isOperationCurrent, false);
  }

  private commitRoute(): void {
    this.state.set(this.pending);
    this.acceptIdentity();
    this.committed.next(this.state());
  }

  private acceptIdentity(): boolean {
    if (this.reload === null) return false;
    const key = this.identity();
    if (key === this.key) return false;
    this.key = key;
    this.generation += 1;
    this.invalidated.next();
    untracked(this.reload);
    return true;
  }

  private identity(): string {
    const actor = this.actor.selectedMember();
    const state = this.state();
    return JSON.stringify([
      actor?.workspaceId ?? '', actor?.id ?? '',
      ...state.params.keys.sort().map((name) => [name, state.params.get(name)])
    ]);
  }

  private readRoute(): CommittedRouteState {
    const values: Record<string, string> = {};
    for (const route of this.route.pathFromRoot ?? [this.route]) {
      const params = route.snapshot?.paramMap ?? convertToParamMap({});
      for (const key of params.keys) values[key] = params.get(key) ?? '';
    }
    return {
      params: convertToParamMap(values),
      query: this.route.snapshot?.queryParamMap ?? convertToParamMap({}),
      fragment: this.route.snapshot?.fragment ?? null
    };
  }
}
