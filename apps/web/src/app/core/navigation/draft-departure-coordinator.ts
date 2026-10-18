import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, effect, inject, signal, untracked } from '@angular/core';
import { NavigationCancel, NavigationEnd, NavigationError, NavigationSkipped, Router } from '@angular/router';
import type { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';

import { DraftConfirmationService } from './draft-confirmation.service';
import { captureDraftFocus } from './draft-focus';

export interface DraftParticipant {
  category: string;
  context: () => string;
  routeKey: () => string;
  revision: () => number;
  meaningful: () => boolean;
  pending: () => boolean;
  discard: () => void;
}

interface CapturedDraft {
  token: symbol;
  participant: DraftParticipant;
  context: string;
  revision: number;
}

interface Decision {
  navigationId: number | null;
  captured: CapturedDraft[];
  controller: AbortController;
  result: Promise<boolean>;
  approved: boolean;
  restoreFocus: () => void;
}

const pendingWriteMessage = 'Wait for the current save to finish before leaving.';

export function draftRouteKey(kind: string, ...identity: string[]): string {
  return JSON.stringify([kind, ...identity]);
}

function destinationKey(state: RouterStateSnapshot): string | null {
  function find(route: ActivatedRouteSnapshot): string | null {
    const kind: unknown = route.data['draftEditor'];
    const params: Record<string, string> = {};
    for (const ancestor of route.pathFromRoot) {
      for (const name of ancestor.paramMap.keys) params[name] = ancestor.paramMap.get(name) ?? '';
    }
    if (kind === 'detail') return draftRouteKey(kind, params['workItemId'] ?? '');
    if (kind === 'report') return draftRouteKey(kind, params['projectId'] ?? '');
    if (kind === 'create') return draftRouteKey(kind, params['projectId'] ?? '',
      route.queryParamMap.get('parentWorkItemId') ?? '', route.queryParamMap.get('cycleId') ?? '');
    for (const child of route.children) { const key = find(child); if (key !== null) return key; }
    return null;
  }
  return find(state.root);
}

@Injectable({ providedIn: 'root' })
export class DraftDepartureCoordinator {
  private readonly router = inject(Router);
  private readonly confirmation = inject(DraftConfirmationService);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly participants = signal(new Map<symbol, DraftParticipant>());
  private readonly pulse = signal(0);
  private decision: Decision | null = null;
  private applyingDiscard = false;
  private unloadAttached = false;
  readonly isConfirming = signal(false);
  readonly isDeparting = signal(false);
  readonly status = signal<string | null>(null);
  private readonly beforeUnload = (event: BeforeUnloadEvent) => {
    if (!this.needsUnloadWarning()) return;
    event.preventDefault();
    event.returnValue = '';
  };

  constructor() {
    effect(() => {
      this.pulse();
      const states = [...this.participants().values()].map((participant) => ({
        pending: participant.pending(), meaningful: participant.meaningful(),
        context: participant.context(), revision: participant.revision()
      }));
      const pending = states.some((state) => state.pending);
      this.syncUnload(states.some((state) => state.pending || state.meaningful));
      this.validateApproval();
      if (!pending && this.status() === pendingWriteMessage) this.status.set(null);
    });
    const subscription = this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        const decision = this.decision;
        if (decision?.navigationId === event.id && decision.approved) this.discardCaptured(decision.captured);
        if (decision?.navigationId === event.id) this.finish(decision);
      } else if (event instanceof NavigationCancel || event instanceof NavigationError || event instanceof NavigationSkipped) {
        if (this.decision?.navigationId === event.id) this.finish(this.decision, true);
      } else this.validateApproval();
    });
    this.destroyRef.onDestroy(() => {
      if (this.decision) this.finish(this.decision);
      subscription.unsubscribe();
      this.syncUnload(false);
    });
  }

  register(participant: DraftParticipant, owner: DestroyRef): symbol {
    const token = Symbol(participant.category);
    this.participants.update((values) => new Map(values).set(token, participant));
    owner.onDestroy(() => {
      this.participants.update((values) => { const next = new Map(values); next.delete(token); return next; });
      this.refresh();
    });
    this.refresh();
    return token;
  }

  refresh(): void {
    this.pulse.update((value) => value + 1);
    untracked(() => this.syncUnload(this.needsUnloadWarning()));
    this.validateApproval();
  }

  async navigation(state: RouterStateSnapshot): Promise<boolean> {
    const navigationId = this.router.getCurrentNavigation()?.id;
    if (navigationId === undefined) return false;
    const target = destinationKey(state);
    const affected = this.capture((participant) => participant.routeKey() !== target);
    if (affected.length === 0) return true;
    if (this.decision?.navigationId === navigationId) {
      const decision = this.decision;
      return (await decision.result) && this.valid(decision.captured);
    }
    const decision = this.begin(affected, navigationId);
    if (decision === null) return false;
    const approved = await decision.result;
    if (!approved && this.decision === decision) this.finish(decision, true);
    return approved;
  }

  async change(commit: () => boolean | void, tokens?: readonly symbol[]): Promise<boolean> {
    const affected = this.capture((_participant, token) => tokens === undefined || tokens.includes(token));
    const decision = this.begin(affected, null);
    if (decision === null) return false;
    try {
      if ((!decision.approved && !await decision.result) || !this.valid(decision.captured)) return false;
      if (commit() === false) return false;
      this.discardCaptured(decision.captured);
      return true;
    } finally { if (this.decision === decision) this.finish(decision, true); }
  }

  private capture(affected: (participant: DraftParticipant, token: symbol) => boolean): CapturedDraft[] {
    return [...this.participants()].filter(([token, participant]) => affected(participant, token))
      .map(([token, participant]) => ({ token, participant, context: participant.context(), revision: participant.revision() }));
  }

  private begin(captured: CapturedDraft[], navigationId: number | null): Decision | null {
    if (this.decision !== null) { this.status.set('Finish the current departure decision first.'); return null; }
    if (captured.some(({ participant }) => participant.pending())) {
      this.status.set(pendingWriteMessage);
      return null;
    }
    this.status.set(null);
    const controller = new AbortController();
    const decision: Decision = { navigationId, captured, controller, approved: false,
      restoreFocus: captureDraftFocus(this.document), result: Promise.resolve(false) };
    this.decision = decision;
    const categories = [...new Set(captured.filter(({ participant }) => participant.meaningful()).map(({ participant }) => participant.category))];
    this.isConfirming.set(categories.length > 0);
    decision.result = (async () => {
      try {
        const allowed = categories.length === 0 || await this.confirmation.confirm(categories, controller.signal);
        if (controller.signal.aborted || !allowed) return false;
        if (!this.valid(captured)) {
          this.status.set('Your draft changed during the decision. Please try again.');
          return false;
        }
        decision.approved = true;
        this.isDeparting.set(true);
        return true;
      } catch {
        this.status.set('The departure decision could not be opened. Your draft is unchanged.');
        return false;
      } finally { if (this.decision === decision) this.isConfirming.set(false); }
    })();
    return decision;
  }

  private valid(captured: CapturedDraft[]): boolean {
    return captured.every(({ token, participant, context, revision }) => this.participants().get(token) === participant &&
      participant.context() === context && participant.revision() === revision && !participant.pending());
  }

  private discardCaptured(captured: CapturedDraft[]): void {
    this.applyingDiscard = true;
    try {
      for (const item of captured) {
        if (this.valid([item]) && item.participant.meaningful()) item.participant.discard();
      }
      this.refresh();
    } finally { this.applyingDiscard = false; }
  }

  private validateApproval(): void {
    const decision = this.decision;
    if (this.applyingDiscard || !decision?.approved || decision.navigationId === null) return;
    const navigation = this.router.getCurrentNavigation();
    if (navigation?.id !== decision.navigationId) return;
    // Disposed owners belong to route activation; only still-mounted revisions can invalidate consent.
    const mounted = decision.captured.filter(({ token, participant }) => this.participants().get(token) === participant);
    if (!this.valid(mounted)) {
      this.status.set('Your draft changed during the decision. Please try again.');
      navigation.abort();
    }
  }

  private finish(decision: Decision, restoreFocus = false): void {
    decision.controller.abort();
    if (this.decision === decision) {
      this.decision = null;
      this.isConfirming.set(false);
      this.isDeparting.set(false);
      if (restoreFocus) decision.restoreFocus();
    }
  }

  private needsUnloadWarning(): boolean {
    return [...this.participants().values()].some((participant) => participant.pending() || participant.meaningful());
  }

  private syncUnload(attach: boolean): void {
    if (attach === this.unloadAttached) return;
    this.unloadAttached = attach;
    const window = this.document.defaultView;
    if (attach) window?.addEventListener('beforeunload', this.beforeUnload);
    else window?.removeEventListener('beforeunload', this.beforeUnload);
  }
}
