import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { MemberDto } from '@worktrail/contracts';

import { App } from './app';
import { CurrentUserService } from './core/current-user.service';

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
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])]
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
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
    expect([...compiled.querySelectorAll('nav a')].map((link) => link.textContent?.trim())).toEqual([
      'My Work',
      'Inbox 2',
      'Projects',
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
});
