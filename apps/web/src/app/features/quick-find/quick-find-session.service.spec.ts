import { describe, expect, it } from 'vitest';

import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { CurrentUserService } from '../../core/current-user.service';
import { QuickFindSessionService } from './quick-find-session.service';

describe('QuickFindSessionService', () => {
  it('retains only query/refinement in memory and erases it on every committed identity change', () => {
    const selectedMember = signal({ id: 'member', workspaceId: 'workspace' });
    const changes = new Subject<void>();
    TestBed.configureTestingModule({ providers: [{ provide: CurrentUserService, useValue: { selectedMember, committedActorChanges$: changes } }] });
    const session = TestBed.inject(QuickFindSessionService);
    const identity = session.identity();
    const state = { query: 'release', type: 'cycles' as const, projectId: 'project' };
    session.update(state, identity);
    expect(session.read()).toEqual(state);
    expect(Object.keys(session.read())).toEqual(['query', 'type', 'projectId']);
    selectedMember.set({ id: 'member', workspaceId: 'different-workspace' });
    changes.next();
    selectedMember.set({ id: 'member', workspaceId: 'workspace' });
    changes.next();
    expect(session.read()).toEqual({ query: '', type: 'all', projectId: '' });
    selectedMember.set({ id: 'other-member', workspaceId: 'workspace' });
    changes.next();
    session.update(state, identity);
    expect(session.read()).toEqual({ query: '', type: 'all', projectId: '' });
  });
});
