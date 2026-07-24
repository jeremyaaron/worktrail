import { FormsModule } from '@angular/forms';
import {
  Component,
  DestroyRef,
  HostListener,
  Injector,
  OnInit,
  inject,
  signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  type ActivatedRouteSnapshot,
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet
} from '@angular/router';
import { filter, take } from 'rxjs';

import { CurrentUserService } from './core/current-user.service';
import { InboxStateService } from './features/inbox/inbox-state.service';
import type { QuickFindDialogRef } from './features/quick-find/open-quick-find-dialog';
import { ErrorPanelComponent } from './shared/ui/error-panel.component';
import { LoadingIndicatorComponent } from './shared/ui/loading-indicator.component';

@Component({
  selector: 'app-root',
  imports: [
    ErrorPanelComponent,
    FormsModule,
    LoadingIndicatorComponent,
    RouterLink,
    RouterLinkActive,
    RouterOutlet
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly router = inject(Router);
  private quickFindRef: QuickFindDialogRef | null = null;
  private isQuickFindOpening = false;
  private quickFindGeneration = 0;
  private readonly loadQuickFindLauncher = () =>
    import('./features/quick-find/open-quick-find-dialog');

  readonly currentUser = inject(CurrentUserService);
  readonly inboxState = inject(InboxStateService);
  readonly currentProjectId = signal(
    projectIdFromRouteSnapshot(this.router.routerState.snapshot.root)
  );

  constructor() {
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed()
      )
      .subscribe(() => {
        this.closeQuickFind();
        this.currentProjectId.set(
          projectIdFromRouteSnapshot(this.router.routerState.snapshot.root)
        );
      });

    this.destroyRef.onDestroy(() => {
      this.closeQuickFind();
    });
  }

  ngOnInit(): void {
    this.loadMembers();
  }

  loadMembers(): void {
    this.currentUser.loadMembers();
  }

  selectMember(memberId: string): void {
    this.closeQuickFind();
    this.currentUser.selectMember(memberId);
  }

  async openQuickFind(): Promise<void> {
    if (this.quickFindRef !== null) {
      this.quickFindRef.componentInstance?.focusQueryInput();
      return;
    }

    if (this.isQuickFindOpening) {
      return;
    }

    this.isQuickFindOpening = true;
    const generation = ++this.quickFindGeneration;

    try {
      const { openQuickFindDialog } = await this.loadQuickFindLauncher();
      const ref = await openQuickFindDialog(this.injector, {
        currentProjectId: this.currentProjectId()
      });

      if (generation !== this.quickFindGeneration) {
        ref.close();
        return;
      }

      this.quickFindRef = ref;
      ref.closed
        .pipe(take(1), takeUntilDestroyed(this.destroyRef))
        .subscribe(() => {
          if (this.quickFindRef === ref) {
            this.quickFindRef = null;
          }
        });
    } catch {
      // A failed lazy load must not leave the shell locked against a later retry.
    } finally {
      if (generation === this.quickFindGeneration) {
        this.isQuickFindOpening = false;
      }
    }
  }

  @HostListener('document:keydown', ['$event'])
  onGlobalKeydown(event: KeyboardEvent): void {
    const hasOneCommandModifier = event.metaKey !== event.ctrlKey;

    if (
      event.key.toLowerCase() !== 'k' ||
      !hasOneCommandModifier ||
      event.altKey ||
      event.shiftKey ||
      event.repeat
    ) {
      return;
    }

    event.preventDefault();
    void this.openQuickFind();
  }

  private closeQuickFind(): void {
    this.quickFindGeneration += 1;
    this.isQuickFindOpening = false;
    this.quickFindRef?.close();
    this.quickFindRef = null;
  }
}

function projectIdFromRouteSnapshot(snapshot: ActivatedRouteSnapshot): string | null {
  const ownProjectId = snapshot.paramMap.get('projectId');

  if (ownProjectId !== null) {
    return ownProjectId;
  }

  for (const child of snapshot.children) {
    const projectId = projectIdFromRouteSnapshot(child);

    if (projectId !== null) {
      return projectId;
    }
  }

  return null;
}
