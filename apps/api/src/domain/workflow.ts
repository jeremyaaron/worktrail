import {
  type MemberRole,
  type WorkItemStatus
} from './constants.js';
import { isOpenWorkItemStatus, isTerminalWorkItemStatus } from './work-risk-policy.js';

const forwardTransitions: Partial<Record<WorkItemStatus, readonly WorkItemStatus[]>> = {
  backlog: ['ready', 'blocked', 'canceled'],
  ready: ['in_progress', 'blocked', 'canceled'],
  in_progress: ['blocked', 'done', 'canceled'],
  blocked: ['ready', 'in_progress', 'canceled']
};

function canReopen(role: MemberRole): boolean {
  return role === 'owner' || role === 'maintainer';
}

export function canTransitionWorkItem(input: {
  from: WorkItemStatus;
  to: WorkItemStatus;
  actorRole: MemberRole;
}): boolean {
  if (input.from === input.to) {
    return true;
  }

  if (isTerminalWorkItemStatus(input.from)) {
    return canReopen(input.actorRole) && (input.to === 'ready' || input.to === 'in_progress');
  }

  if (input.to === 'blocked' && isOpenWorkItemStatus(input.from)) {
    return true;
  }

  return forwardTransitions[input.from]?.includes(input.to) ?? false;
}
