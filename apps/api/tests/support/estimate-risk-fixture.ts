import { randomUUID } from 'node:crypto';
import { addDays, toDateString } from '@worktrail/contracts';
import type { RepositoryExecutor } from '../../src/db/client.js';
import * as schema from '../../src/db/schema.js';

// Import-safe, zero/null and overlapping-risk fixture shared by query and snapshot checks.
export async function createEstimateRiskFixture(db: RepositoryExecutor, workspaceId: string, now = new Date()) {
  const projectId = randomUUID(), memberId = randomUUID(), cycleId = randomUUID(), destinationId = randomUUID(), milestoneId = randomUUID(), labelId = randomUUID();
  const timestamps = { createdAt: now, updatedAt: now };
  await db.insert(schema.workspaces).values({ id: workspaceId, name: 'Estimate and risk parity', ...timestamps });
  await db.insert(schema.members).values({ id: memberId, workspaceId, name: 'Estimate Owner', email: 'estimates@example.test', role: 'owner', isActive: true, ...timestamps });
  await db.insert(schema.projects).values({ id: projectId, workspaceId, key: 'EST', name: 'Estimate parity', status: 'active', nextWorkItemNumber: 8, ...timestamps });
  await db.insert(schema.milestones).values({ id: milestoneId, projectId, workspaceId, name: 'Estimate milestone', status: 'active', targetDate: toDateString(addDays(now, 7)), ...timestamps });
  await db.insert(schema.labels).values({ id: labelId, projectId, workspaceId, name: 'estimate parity', ...timestamps });
  await db.insert(schema.projectCycles).values([
    { id: cycleId, projectId, workspaceId, name: 'Estimate cycle', status: 'active', startDate: toDateString(addDays(now, -5)), endDate: toDateString(addDays(now, 5)), targetPoints: 4, ...timestamps },
    { id: destinationId, projectId, workspaceId, name: 'Next estimate cycle', status: 'planned', startDate: toDateString(addDays(now, 6)), endDate: toDateString(addDays(now, 20)), ...timestamps }
  ]);
  const ids = { parent: randomUUID(), child: randomUUID(), stale: randomUUID(), positive: randomUUID(), done: randomUUID(), canceled: randomUUID(), unplanned: randomUUID() };
  const values = [
    { id: ids.parent, title: 'Zero-point parent', status: 'ready' as const, estimatePoints: 0, type: 'story' as const },
    { id: ids.child, title: 'Unestimated child due today', status: 'ready' as const, estimatePoints: null, parentWorkItemId: ids.parent, dueDate: toDateString(now) },
    { id: ids.stale, title: 'Overlapping stale and dependency risk', status: 'in_progress' as const, estimatePoints: null, assigneeId: null, updatedAt: addDays(now, -8), dueDate: toDateString(addDays(now, -1)) },
    { id: ids.positive, title: 'Positive estimated blocked work', status: 'blocked' as const, estimatePoints: 5, dueDate: toDateString(addDays(now, 1)) },
    { id: ids.done, title: 'Unestimated done work', status: 'done' as const, estimatePoints: null },
    { id: ids.canceled, title: 'Zero-point canceled work', status: 'canceled' as const, estimatePoints: 0 },
    { id: ids.unplanned, title: 'Unplanned unestimated work', status: 'ready' as const, estimatePoints: null, cycleId: null }
  ];
  await db.insert(schema.workItems).values(values.map((value, index) => ({ workspaceId, projectId, reporterId: memberId,
    assigneeId: memberId, milestoneId, cycleId, itemNumber: index + 1, displayKey: `EST-${index + 1}`,
    type: 'task' as const, priority: 'high' as const, ...timestamps, ...value })));
  await db.insert(schema.workItemLabels).values([{ workItemId: ids.child, labelId }, { workItemId: ids.parent, labelId }]);
  await db.insert(schema.workItemRelationships).values({ id: randomUUID(), workspaceId, sourceWorkItemId: ids.parent,
    targetWorkItemId: ids.stale, relationshipType: 'blocks', createdById: memberId, createdAt: now });
  return { workspaceId, projectId, memberId, cycleId, destinationId, milestoneId, labelId, ids, now,
    actor: { workspaceId, memberId, role: 'owner' as const } };
}
