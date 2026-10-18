import { Injectable, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CurrentUserService } from '../current-user.service';

// Only the mounted, authorized detail owner can publish context for a parameterless project route.
@Injectable({ providedIn: 'root' })
export class AuthorizedProjectContext {
  private readonly actor = inject(CurrentUserService);
  private readonly current = signal<{ recordId: string; projectId: string; identity: string } | null>(null);

  constructor() {
    const clearObsolete = () => { if (this.current()?.identity !== this.identity()) this.current.set(null); };
    this.actor.committedActorChanges$?.pipe(takeUntilDestroyed()).subscribe(clearObsolete);
    effect(clearObsolete);
  }

  private identity(): string {
    const member = this.actor.selectedMember();
    return JSON.stringify([member?.workspaceId ?? '', member?.id ?? '']);
  }

  publish(recordId: string, projectId: string): () => void {
    const value = { recordId, projectId, identity: this.identity() };
    this.current.set(value);
    return () => { if (this.current() === value) this.current.set(null); };
  }

  projectIdFor(recordId: string | null): string | null {
    const value = this.current();
    return value?.recordId === recordId && value.identity === this.identity() ? value.projectId : null;
  }
}
