import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Dialog } from '@angular/cdk/dialog';
import { OverlayContainer } from '@angular/cdk/overlay';
import { Component } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, RouterOutlet, provideRouter } from '@angular/router';
import type { MemberDto } from '@worktrail/contracts';

import { App } from './app';
import { CurrentUserService } from './core/current-user.service';

@Component({
  template: ''
})
class TestRouteComponent {}

@Component({
  imports: [RouterOutlet],
  template: '<router-outlet />'
})
class TestProjectRouteComponent {}

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
const contributor: MemberDto = {
  id: '10000000-0000-4000-8000-000000000103',
  workspaceId,
  name: 'Casey Contributor',
  email: 'casey.contributor@example.com',
  role: 'contributor',
  isActive: true,
  deactivatedAt: null,
  createdAt: '2026-07-02T12:00:00.000Z',
  updatedAt: '2026-07-03T12:00:00.000Z'
};
const inactiveMember: MemberDto = {
  id: '10000000-0000-4000-8000-000000000104',
  workspaceId,
  name: 'Riley Former',
  email: 'riley.former@example.com',
  role: 'contributor',
  isActive: false,
  deactivatedAt: '2026-06-28T12:00:00.000Z',
  createdAt: '2026-07-02T12:00:00.000Z',
  updatedAt: '2026-07-03T12:00:00.000Z'
};

describe('App', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    localStorage.clear();

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'my-work', component: TestRouteComponent },
          {
            path: 'projects/:projectId',
            component: TestProjectRouteComponent,
            children: [{ path: 'board', component: TestRouteComponent }]
          }
        ])
      ]
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    TestBed.inject(Dialog).closeAll();
    http.verify();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render shell navigation and current user selector', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const request = http.expectOne('/api/members');
    request.flush([owner]);
    fixture.detectChanges();
    http.expectOne('/api/notifications/unread-count').flush({ unreadCount: 2 });
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.brand')?.textContent).toContain('Worktrail');
    expect(compiled.querySelector('.quick-find-trigger')?.getAttribute('aria-label')).toBe(
      'Open Quick Find'
    );
    expect([...compiled.querySelectorAll('nav a')].map((link) => link.textContent?.trim())).toEqual([
      'My Work',
      'Inbox 2',
      'Projects',
      'Portfolio',
      'Work Items',
      'Workspace Settings',
      'Create'
    ]);
    expect(compiled.querySelector('select')?.textContent).toContain('Avery Owner');
  });

  it('shows only active members in the actor selector', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    http.expectOne('/api/members').flush([owner, inactiveMember, contributor]);
    fixture.detectChanges();
    http.expectOne('/api/notifications/unread-count').flush({ unreadCount: 0 });
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const optionLabels = [...compiled.querySelectorAll('option')].map((option) => option.textContent);
    expect(optionLabels.join(' ')).toContain('Avery Owner');
    expect(optionLabels.join(' ')).toContain('Casey Contributor');
    expect(optionLabels.join(' ')).not.toContain('Riley Former');
  });

  it('falls back from a stored inactive selection to the active owner', () => {
    localStorage.setItem('worktrail.selectedMemberId', inactiveMember.id);
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    http.expectOne('/api/members').flush([contributor, inactiveMember, owner]);
    fixture.detectChanges();
    http.expectOne('/api/notifications/unread-count').flush({ unreadCount: 0 });
    fixture.detectChanges();

    const currentUser = TestBed.inject(CurrentUserService);
    expect(currentUser.selectedMember()?.id).toBe(owner.id);
    expect(localStorage.getItem('worktrail.selectedMemberId')).toBe(owner.id);
    expect((fixture.nativeElement as HTMLElement).querySelector('select')?.textContent).not.toContain(
      'Riley Former'
    );
  });

  it('opens one dialog while a lazy launch is already in progress', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    flushShellRequests(http, fixture, [owner]);
    fixture.detectChanges();

    const firstOpen = fixture.componentInstance.openQuickFind();
    const secondOpen = fixture.componentInstance.openQuickFind();
    await Promise.all([firstOpen, secondOpen]);
    fixture.detectChanges();

    const overlays = TestBed.inject(OverlayContainer).getContainerElement();
    expect(overlays.querySelectorAll('.quick-find-overlay').length).toBe(1);
    expect(TestBed.inject(Router).url).toBe('/');
  });

  it('accepts only exact Command/Ctrl+K shortcuts', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    const open = spyOn(app, 'openQuickFind').and.resolveTo();
    const acceptedControl = shortcutEvent({ ctrlKey: true });
    const acceptedCommand = shortcutEvent({ metaKey: true });

    app.onGlobalKeydown(acceptedControl);
    app.onGlobalKeydown(acceptedCommand);

    expect(open).toHaveBeenCalledTimes(2);
    expect(acceptedControl.defaultPrevented).toBeTrue();
    expect(acceptedCommand.defaultPrevented).toBeTrue();

    for (const rejected of [
      shortcutEvent({}),
      shortcutEvent({ ctrlKey: true, metaKey: true }),
      shortcutEvent({ altKey: true, ctrlKey: true }),
      shortcutEvent({ ctrlKey: true, shiftKey: true }),
      shortcutEvent({ ctrlKey: true, repeat: true }),
      shortcutEvent({ ctrlKey: true, key: '/' })
    ]) {
      app.onGlobalKeydown(rejected);
      expect(rejected.defaultPrevented).toBeFalse();
    }

    expect(open).toHaveBeenCalledTimes(2);
  });

  it('closes Quick Find before selecting another actor', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    flushShellRequests(http, fixture, [owner, contributor]);
    fixture.detectChanges();

    await fixture.componentInstance.openQuickFind();
    expect(TestBed.inject(OverlayContainer).getContainerElement().children.length).toBeGreaterThan(0);

    fixture.componentInstance.selectMember(contributor.id);

    expect(TestBed.inject(CurrentUserService).selectedMember()?.id).toBe(contributor.id);
    expect(
      TestBed.inject(OverlayContainer).getContainerElement().querySelector('.quick-find-overlay')
    ).toBeNull();
  });

  it('derives project context and closes the dialog on route navigation', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    flushShellRequests(http, fixture, [owner]);
    fixture.detectChanges();
    const router = TestBed.inject(Router);
    const projectId = '20000000-0000-4000-8000-000000000001';

    await router.navigateByUrl(`/projects/${projectId}/board`);
    fixture.detectChanges();
    expect(fixture.componentInstance.currentProjectId()).toBe(projectId);

    await fixture.componentInstance.openQuickFind();
    TestBed.inject(Dialog).openDialogs[0]?.componentRef?.changeDetectorRef.detectChanges();
    const overlays = TestBed.inject(OverlayContainer).getContainerElement();
    expect(overlays.textContent).toContain('Current project');

    await router.navigateByUrl('/my-work');
    fixture.detectChanges();

    expect(fixture.componentInstance.currentProjectId()).toBeNull();
    expect(overlays.querySelector('.quick-find-overlay')).toBeNull();
  });

  it('resets the opening guard when lazy launcher loading fails', async () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    const launcher = jasmine.createSpy('loadQuickFindLauncher').and.rejectWith(
      new Error('chunk unavailable')
    );
    (
      app as unknown as {
        loadQuickFindLauncher: () => Promise<never>;
      }
    ).loadQuickFindLauncher = launcher;

    await app.openQuickFind();
    await app.openQuickFind();

    expect(launcher).toHaveBeenCalledTimes(2);
  });
});

function flushShellRequests(
  http: HttpTestingController,
  fixture: ComponentFixture<App>,
  members: MemberDto[]
): void {
  http.expectOne('/api/members').flush(members);
  fixture.detectChanges();
  http.expectOne('/api/notifications/unread-count').flush({ unreadCount: 0 });
}

function shortcutEvent(
  input: Partial<Pick<KeyboardEvent, 'altKey' | 'ctrlKey' | 'key' | 'metaKey' | 'repeat' | 'shiftKey'>>
): KeyboardEvent {
  return new KeyboardEvent('keydown', {
    altKey: input.altKey ?? false,
    bubbles: true,
    cancelable: true,
    ctrlKey: input.ctrlKey ?? false,
    key: input.key ?? 'k',
    metaKey: input.metaKey ?? false,
    repeat: input.repeat ?? false,
    shiftKey: input.shiftKey ?? false
  });
}
