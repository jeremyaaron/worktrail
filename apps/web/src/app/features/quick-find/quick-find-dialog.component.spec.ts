import { Dialog } from '@angular/cdk/dialog';
import { OverlayContainer } from '@angular/cdk/overlay';
import { ApplicationRef, Component, Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { openQuickFindDialog, type QuickFindDialogRef } from './open-quick-find-dialog';

@Component({
  template: ''
})
class TestRouteComponent {}

describe('Quick Find dialog launcher and navigation mode', () => {
  const projectId = '20000000-0000-4000-8000-000000000001';
  let applicationRef: ApplicationRef;
  let injector: Injector;
  let overlayContainer: OverlayContainer;
  let router: Router;
  let openRef: QuickFindDialogRef | null;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'my-work', component: TestRouteComponent },
          { path: 'projects/:projectId/board', component: TestRouteComponent }
        ])
      ]
    });

    applicationRef = TestBed.inject(ApplicationRef);
    injector = TestBed.inject(Injector);
    overlayContainer = TestBed.inject(OverlayContainer);
    router = TestBed.inject(Router);
    openRef = null;
  });

  afterEach(() => {
    openRef?.close();
    TestBed.inject(Dialog).closeAll();
  });

  it('opens one accessible, blocking, focus-restoring dialog without changing history', async () => {
    const trigger = document.createElement('button');
    trigger.textContent = 'Trigger';
    document.body.append(trigger);
    trigger.focus();
    const initialUrl = router.url;

    openRef = await openQuickFindDialog(injector, { currentProjectId: null });
    openRef.componentRef?.changeDetectorRef.detectChanges();
    await applicationRef.whenStable();

    expect(openRef.config.ariaLabel).toBe('Quick find');
    expect(openRef.config.ariaModal).toBeTrue();
    expect(openRef.config.closeOnNavigation).toBeTrue();
    expect(openRef.config.disableClose).toBeFalse();
    expect(openRef.config.hasBackdrop).toBeTrue();
    expect(openRef.config.restoreFocus).toBeTrue();
    expect(openRef.config.panelClass).toBe('quick-find-overlay');
    expect(router.url).toBe(initialUrl);

    const container = overlayContainer.getContainerElement();
    expect(container.querySelectorAll('.cdk-overlay-pane.quick-find-overlay').length).toBe(1);
    expect(container.querySelector('.cdk-overlay-backdrop')).not.toBeNull();
    expect(container.querySelector('[role="dialog"]')?.getAttribute('aria-label')).toBe(
      'Quick find'
    );
    expect(
      openRef.overlayRef.getConfig().scrollStrategy?.constructor.name
    ).toBe('BlockScrollStrategy');
    expect(document.activeElement).toBe(
      container.querySelector<HTMLInputElement>('#quick-find-query')
    );

    const closed = firstValueFrom(openRef.closed);
    openRef.close();
    await closed;
    await applicationRef.whenStable();

    expect(document.activeElement).toBe(trigger);
    trigger.remove();
    openRef = null;
  });

  it('renders global entries and project entries only when project context exists', async () => {
    openRef = await openQuickFindDialog(injector, { currentProjectId: projectId });
    openRef.componentRef?.changeDetectorRef.detectChanges();
    await applicationRef.whenStable();

    const container = overlayContainer.getContainerElement();
    const headings = [...container.querySelectorAll('.quick-find__group h3')].map((heading) =>
      heading.textContent?.trim()
    );
    const labels = [...container.querySelectorAll('.quick-find__entries button')].map((button) =>
      button.textContent?.trim()
    );

    expect(headings).toEqual(['Global', 'Current project']);
    expect(labels).toEqual([
      'My Work',
      'Inbox',
      'Work Items',
      'Projects',
      'Portfolio',
      'Create work item',
      'Project overview',
      'Work',
      'Board',
      'Planning',
      'Reports',
      'Project settings'
    ]);

    openRef.close();
    openRef = await openQuickFindDialog(injector, { currentProjectId: null });
    openRef.componentRef?.changeDetectorRef.detectChanges();
    await applicationRef.whenStable();

    expect(
      overlayContainer
        .getContainerElement()
        .querySelector('#quick-find-project-heading')
    ).toBeNull();
  });

  it('keeps navigation visible for short queries and closes before routing an entry', async () => {
    openRef = await openQuickFindDialog(injector, { currentProjectId: projectId });
    openRef.componentRef?.changeDetectorRef.detectChanges();
    await applicationRef.whenStable();

    const container = overlayContainer.getContainerElement();
    const input = container.querySelector<HTMLInputElement>('#quick-find-query')!;

    setInputValue(input, ' x ');
    openRef.componentRef?.changeDetectorRef.detectChanges();
    expect(container.querySelector('#quick-find-global-heading')).not.toBeNull();

    setInputValue(input, 'xy');
    openRef.componentRef?.changeDetectorRef.detectChanges();
    expect(container.querySelector('#quick-find-global-heading')).toBeNull();

    setInputValue(input, '');
    openRef.componentRef?.changeDetectorRef.detectChanges();
    const callOrder: string[] = [];
    const originalClose = openRef.close.bind(openRef);
    const close = spyOn(openRef, 'close').and.callFake(() => {
      callOrder.push('close');
      originalClose();
    });
    const navigate = spyOn(router, 'navigate').and.callFake(async () => {
      callOrder.push('navigate');
      return true;
    });
    const board = [...container.querySelectorAll<HTMLButtonElement>('.quick-find__entries button')]
      .find((button) => button.textContent?.trim() === 'Board')!;

    board.click();

    expect(close).toHaveBeenCalledOnceWith();
    expect(navigate).toHaveBeenCalledOnceWith(['/projects', projectId, 'board'], {});
    expect(callOrder).toEqual(['close', 'navigate']);
    openRef = null;
  });
});

function setInputValue(input: HTMLInputElement, value: string): void {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}
