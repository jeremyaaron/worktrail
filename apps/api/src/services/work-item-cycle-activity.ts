import type { NewActivityEvent, ProjectCycle, WorkItem } from '../repositories/types.js';

export function createWorkItemCycleChangedActivity(input: {
  id: string;
  workItem: WorkItem;
  previousCycle: ProjectCycle | null;
  nextCycle: ProjectCycle | null;
  actorId: string;
  createdAt: Date;
}): NewActivityEvent {
  return {
    id: input.id,
    workspaceId: input.workItem.workspaceId,
    projectId: input.workItem.projectId,
    workItemId: input.workItem.id,
    actorId: input.actorId,
    eventType: 'work_item.cycle_changed',
    summary:
      input.nextCycle === null
        ? 'Cycle assignment cleared.'
        : `Cycle changed to ${input.nextCycle.name}.`,
    previousValue:
      input.previousCycle === null
        ? null
        : { cycleId: input.previousCycle.id, cycleName: input.previousCycle.name },
    newValue:
      input.nextCycle === null
        ? null
        : { cycleId: input.nextCycle.id, cycleName: input.nextCycle.name },
    metadata: {},
    createdAt: input.createdAt
  };
}
