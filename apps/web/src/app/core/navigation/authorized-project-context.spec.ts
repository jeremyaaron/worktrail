import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { CurrentUserService } from '../current-user.service';
import { AuthorizedProjectContext } from './authorized-project-context';

describe('AuthorizedProjectContext', () => {
  it('requires the loaded record and actor/workspace identity, and an old owner cannot clear a replacement', () => {
    const selectedMember = signal({ id: 'member', workspaceId: 'workspace' });
    const changes = new Subject<void>();
    TestBed.configureTestingModule({ providers: [{ provide: CurrentUserService, useValue: { selectedMember, committedActorChanges$: changes } }] });
    const context = TestBed.inject(AuthorizedProjectContext);
    const oldOwner = context.publish('record-a', 'project-a');
    expect(context.projectIdFor('record-a')).toBe('project-a');
    expect(context.projectIdFor('record-b')).toBeNull();
    const newOwner = context.publish('record-b', 'project-b');
    oldOwner();
    expect(context.projectIdFor('record-b')).toBe('project-b');
    selectedMember.set({ id: 'member', workspaceId: 'another-workspace' });
    changes.next();
    expect(context.projectIdFor('record-b')).toBeNull();
    selectedMember.set({ id: 'member', workspaceId: 'workspace' });
    changes.next();
    expect(context.projectIdFor('record-b')).toBeNull();
    newOwner();
  });
});
