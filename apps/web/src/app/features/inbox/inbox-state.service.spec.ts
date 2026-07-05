import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { MemberDto } from '@worktrail/contracts';

import { CurrentUserService } from '../../core/current-user.service';
import { InboxStateService } from './inbox-state.service';

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

describe('InboxStateService', () => {
  let currentUser: CurrentUserService;
  let http: HttpTestingController;
  let state: InboxStateService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });

    currentUser = TestBed.inject(CurrentUserService);
    http = TestBed.inject(HttpTestingController);
    state = TestBed.inject(InboxStateService);
  });

  afterEach(() => {
    state.ngOnDestroy();
    http.verify();
  });

  it('refreshes unread count for the selected actor', () => {
    currentUser.members.set([owner]);
    currentUser.selectMember(owner.id);

    state.refreshUnreadCount();

    const request = http.expectOne('/api/notifications/unread-count');
    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('x-worktrail-member-id')).toBe(owner.id);
    expect(state.isLoadingUnreadCount()).toBeTrue();

    request.flush({ unreadCount: 3 });

    expect(state.unreadCount()).toBe(3);
    expect(state.isLoadingUnreadCount()).toBeFalse();
    expect(state.unreadCountError()).toBeNull();
  });

  it('refreshes unread count when the selected actor changes', () => {
    currentUser.members.set([owner, contributor]);
    currentUser.selectMember(owner.id);
    TestBed.tick();

    const ownerRequest = http.expectOne('/api/notifications/unread-count');
    expect(ownerRequest.request.headers.get('x-worktrail-member-id')).toBe(owner.id);
    ownerRequest.flush({ unreadCount: 2 });
    expect(state.unreadCount()).toBe(2);

    currentUser.selectMember(contributor.id);
    TestBed.tick();

    const contributorRequest = http.expectOne('/api/notifications/unread-count');
    expect(contributorRequest.request.headers.get('x-worktrail-member-id')).toBe(contributor.id);
    contributorRequest.flush({ unreadCount: 1 });
    expect(state.unreadCount()).toBe(1);
  });

  it('supports local unread count updates after list and read mutations', () => {
    state.syncFromNotificationList({ items: [], unreadCount: 4 });
    expect(state.unreadCount()).toBe(4);

    state.applyReadStateChange(null, '2026-07-05T12:00:00.000Z');
    expect(state.unreadCount()).toBe(3);

    state.applyReadStateChange('2026-07-05T12:00:00.000Z', null);
    expect(state.unreadCount()).toBe(4);

    state.markAllReadLocally();
    expect(state.unreadCount()).toBe(0);
  });

  it('reports unread count load failures', () => {
    currentUser.members.set([owner]);
    currentUser.selectMember(owner.id);

    state.refreshUnreadCount();

    const request = http.expectOne('/api/notifications/unread-count');
    request.flush({ error: { code: 'INTERNAL_ERROR', message: 'Failed.' } }, { status: 500, statusText: 'Server Error' });

    expect(state.isLoadingUnreadCount()).toBeFalse();
    expect(state.unreadCountError()).toBe('Unread notification count could not be loaded.');
  });
});
