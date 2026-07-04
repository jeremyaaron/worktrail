import { describe, expect, it } from 'vitest';

import type { ActorContext } from '../src/domain/actor.js';
import { canArchiveProject, canReopenTerminalWorkItem, canUpdateAssignedWorkItem } from '../src/domain/permissions.js';
import { canTransitionWorkItem } from '../src/domain/workflow.js';

const owner: ActorContext = {
  memberId: 'owner-id',
  workspaceId: 'workspace-id',
  role: 'owner'
};

const maintainer: ActorContext = {
  memberId: 'maintainer-id',
  workspaceId: 'workspace-id',
  role: 'maintainer'
};

const contributor: ActorContext = {
  memberId: 'contributor-id',
  workspaceId: 'workspace-id',
  role: 'contributor'
};

describe('work item workflow rules', () => {
  it('allows no-op transitions', () => {
    expect(
      canTransitionWorkItem({ from: 'in_progress', to: 'in_progress', actorRole: 'contributor' })
    ).toBe(true);
  });

  it('allows normal forward movement and blocking', () => {
    expect(canTransitionWorkItem({ from: 'backlog', to: 'ready', actorRole: 'contributor' })).toBe(
      true
    );
    expect(
      canTransitionWorkItem({ from: 'ready', to: 'in_progress', actorRole: 'contributor' })
    ).toBe(true);
    expect(canTransitionWorkItem({ from: 'in_progress', to: 'done', actorRole: 'contributor' })).toBe(
      true
    );
    expect(canTransitionWorkItem({ from: 'ready', to: 'blocked', actorRole: 'contributor' })).toBe(
      true
    );
  });

  it('allows blocked work to return to ready or in progress', () => {
    expect(canTransitionWorkItem({ from: 'blocked', to: 'ready', actorRole: 'contributor' })).toBe(
      true
    );
    expect(
      canTransitionWorkItem({ from: 'blocked', to: 'in_progress', actorRole: 'contributor' })
    ).toBe(true);
  });

  it('rejects unsupported backward transitions for contributors', () => {
    expect(canTransitionWorkItem({ from: 'in_progress', to: 'backlog', actorRole: 'contributor' })).toBe(
      false
    );
  });

  it('allows maintainers and owners to reopen terminal work items', () => {
    expect(canTransitionWorkItem({ from: 'done', to: 'ready', actorRole: 'maintainer' })).toBe(true);
    expect(canTransitionWorkItem({ from: 'canceled', to: 'in_progress', actorRole: 'owner' })).toBe(
      true
    );
  });

  it('rejects contributor reopen from terminal statuses', () => {
    expect(canTransitionWorkItem({ from: 'done', to: 'ready', actorRole: 'contributor' })).toBe(
      false
    );
    expect(canTransitionWorkItem({ from: 'canceled', to: 'in_progress', actorRole: 'contributor' })).toBe(
      false
    );
  });
});

describe('permission helpers', () => {
  it('limits project archive behavior to owners and maintainers', () => {
    expect(canArchiveProject(owner)).toBe(true);
    expect(canArchiveProject(maintainer)).toBe(true);
    expect(canArchiveProject(contributor)).toBe(false);
  });

  it('limits terminal reopen behavior to owners and maintainers', () => {
    expect(canReopenTerminalWorkItem(owner)).toBe(true);
    expect(canReopenTerminalWorkItem(maintainer)).toBe(true);
    expect(canReopenTerminalWorkItem(contributor)).toBe(false);
  });

  it('allows contributors to update assigned non-terminal work only', () => {
    expect(
      canUpdateAssignedWorkItem({
        actor: contributor,
        assigneeId: contributor.memberId,
        isTerminal: false
      })
    ).toBe(true);
    expect(
      canUpdateAssignedWorkItem({
        actor: contributor,
        assigneeId: maintainer.memberId,
        isTerminal: false
      })
    ).toBe(false);
    expect(
      canUpdateAssignedWorkItem({
        actor: contributor,
        assigneeId: contributor.memberId,
        isTerminal: true
      })
    ).toBe(false);
  });
});

