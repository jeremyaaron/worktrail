import { describe, expect, it } from 'vitest';

import type { ActorContext } from '../src/domain/actor.js';
import { canArchiveProject, canReopenTerminalWorkItem, canUpdateAssignedWorkItem } from '../src/domain/permissions.js';
import {
  addDays,
  dueSoonWindowDays,
  isActiveUnassignedWorkItemStatus,
  isDueSoonDueDate,
  isOpenWorkItemStatus,
  isOverdueDueDate,
  isStaleInProgressStatus,
  isTerminalWorkItemStatus,
  staleInProgressDays,
  toDateString
} from '../src/domain/work-risk-policy.js';
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

describe('work risk policy helpers', () => {
  it('classifies open and terminal statuses', () => {
    expect(isOpenWorkItemStatus('backlog')).toBe(true);
    expect(isOpenWorkItemStatus('in_progress')).toBe(true);
    expect(isOpenWorkItemStatus('done')).toBe(false);
    expect(isTerminalWorkItemStatus('done')).toBe(true);
    expect(isTerminalWorkItemStatus('canceled')).toBe(true);
    expect(isTerminalWorkItemStatus('blocked')).toBe(false);
  });

  it('classifies active unassigned statuses', () => {
    expect(isActiveUnassignedWorkItemStatus('ready')).toBe(true);
    expect(isActiveUnassignedWorkItemStatus('in_progress')).toBe(true);
    expect(isActiveUnassignedWorkItemStatus('backlog')).toBe(false);
    expect(isActiveUnassignedWorkItemStatus('blocked')).toBe(false);
  });

  it('uses shared risk windows and UTC date helpers', () => {
    const now = new Date('2026-07-05T16:30:00.000Z');
    const dueSoonEnd = toDateString(addDays(now, dueSoonWindowDays));
    const staleCutoff = addDays(now, -staleInProgressDays);

    expect(toDateString(now)).toBe('2026-07-05');
    expect(dueSoonEnd).toBe('2026-07-12');
    expect(isOverdueDueDate('2026-07-04', '2026-07-05')).toBe(true);
    expect(isDueSoonDueDate('2026-07-12', '2026-07-05', dueSoonEnd)).toBe(true);
    expect(isDueSoonDueDate('2026-07-13', '2026-07-05', dueSoonEnd)).toBe(false);
    expect(isStaleInProgressStatus('in_progress', new Date('2026-06-27T00:00:00.000Z'), staleCutoff)).toBe(
      true
    );
    expect(isStaleInProgressStatus('blocked', new Date('2026-06-27T00:00:00.000Z'), staleCutoff)).toBe(
      false
    );
  });
});
