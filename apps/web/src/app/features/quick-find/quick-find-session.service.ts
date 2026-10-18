import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { QuickFindResponseDto } from '@worktrail/contracts';
import { CurrentUserService } from '../../core/current-user.service';

export interface QuickFindSession {
  query: string;
  type: 'all' | keyof QuickFindResponseDto['groups'];
  projectId: string;
}

@Injectable({ providedIn: 'root' })
export class QuickFindSessionService {
  private readonly actor = inject(CurrentUserService);
  private key = '';
  private readonly value = signal<QuickFindSession>({ query: '', type: 'all', projectId: '' });

  constructor() {
    this.actor.committedActorChanges$?.pipe(takeUntilDestroyed()).subscribe(() => this.reconcile());
    effect(() => { this.actor.selectedMember(); untracked(() => this.reconcile()); });
  }

  identity(): string {
    const member = this.actor.selectedMember();
    return JSON.stringify([member?.workspaceId ?? '', member?.id ?? '']);
  }

  read(): QuickFindSession { this.reconcile(); return { ...this.value() }; }

  update(value: QuickFindSession, identity: string): void {
    this.reconcile();
    if (identity === this.key) this.value.set({ ...value });
  }

  private reconcile(): void {
    const identity = this.identity();
    if (identity !== this.key) {
      this.key = identity;
      this.value.set({ query: '', type: 'all', projectId: '' });
    }
  }
}
