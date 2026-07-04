import type { ActorContext } from './actor.js';

export function canManageProject(actor: ActorContext): boolean {
  return actor.role === 'owner' || actor.role === 'maintainer';
}

export function canArchiveProject(actor: ActorContext): boolean {
  return canManageProject(actor);
}

export function canReactivateProject(actor: ActorContext): boolean {
  return canManageProject(actor);
}

export function canManageMilestones(actor: ActorContext): boolean {
  return canManageProject(actor);
}

export function canReopenTerminalWorkItem(actor: ActorContext): boolean {
  return actor.role === 'owner' || actor.role === 'maintainer';
}

export function canUpdateAssignedWorkItem(input: {
  actor: ActorContext;
  assigneeId: string | null;
  isTerminal: boolean;
}): boolean {
  if (input.actor.role === 'owner' || input.actor.role === 'maintainer') {
    return true;
  }

  return input.assigneeId === input.actor.memberId && !input.isTerminal;
}
