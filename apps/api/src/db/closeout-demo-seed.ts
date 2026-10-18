import type { ProjectCycleCloseoutItemSnapshotDto, ProjectCycleCloseoutSnapshotDto } from '@worktrail/contracts';

import { parseStoredProjectCycleCloseoutSnapshot } from '../validation/project-cycle-closeout-snapshot.js';
import type { WorktrailDb } from './client.js';
import { projectCycleCloseouts, projectCycles, workItems } from './schema.js';

// Product walkthrough data; deterministic tests construct their own independent records.
export async function seedHistoricalCloseoutDemo(input: {
  db: WorktrailDb; workspaceId: string; projectId: string; maintainerId: string; contributorId: string;
}): Promise<void> {
  const id = (suffix: number): string => '10000000-0000-4000-8000-' + String(suffix).padStart(12, '0');
  const createdAt = new Date('2026-05-01T12:00:00.000Z');
  const definitions = [
    { id: id(376), name: 'Historical carryover: 12 unfinished (v1)', startDate: '2026-05-01', endDate: '2026-05-14' },
    { id: id(377), name: 'Historical carryover: 12 unfinished (v2)', startDate: '2026-05-15', endDate: '2026-05-28' },
    { id: id(378), name: 'Carryover follow-through', startDate: '2026-06-01', endDate: '2026-06-14' }
  ];
  const unfinished: ProjectCycleCloseoutItemSnapshotDto[] = Array.from({ length: 12 }, (_, index) => ({
    id: id(1100 + index), displayKey: 'LAB-' + (index + 6),
    title: 'Original carryover commitment ' + (index + 1), status: 'ready', priority: 'medium',
    assignee: { id: input.maintainerId, name: 'Morgan Maintainer' }, estimatePoints: 2, dependencyBlocked: false
  }));
  await input.db.transaction(async tx => {
    await tx.insert(projectCycles).values(definitions.map((cycle, index) => ({
      ...cycle, workspaceId: input.workspaceId, projectId: input.projectId,
      name: index === 2 ? 'Renamed follow-through' : cycle.name,
      goal: 'Inspect all twelve frozen commitments after current work changes.', status: 'completed' as const,
      targetPoints: 24, createdAt, updatedAt: new Date('2026-06-15T12:00:00.000Z')
    }))).onConflictDoNothing();
    await tx.insert(workItems).values(unfinished.map((item, index) => ({
      id: item.id, workspaceId: input.workspaceId, projectId: input.projectId,
      itemNumber: index + 6, displayKey: item.displayKey, type: 'task' as const,
      title: 'Revised follow-through ' + (index + 1), description: 'Changed after both closeout snapshots were captured.',
      status: index === 0 ? 'done' as const : 'in_progress' as const, priority: 'high' as const,
      assigneeId: input.contributorId, reporterId: input.maintainerId,
      cycleId: index < 4 ? null : id(378), estimatePoints: index === 0 ? 8 : 3,
      boardPosition: index + 1, createdAt, updatedAt: new Date('2026-06-15T12:00:00.000Z')
    }))).onConflictDoNothing();
    for (const [index, cycle] of definitions.slice(0, 2).entries()) {
      const destination = definitions[index + 1]!;
      const closedAt = cycle.endDate + 'T16:00:00.000Z';
      const snapshot: ProjectCycleCloseoutSnapshotDto = {
        snapshotVersion: index === 0 ? 1 : 2,
        project: { id: input.projectId, key: 'LAB', name: 'Cycle Closeout Lab' },
        cycle: { ...cycle, goal: 'Preserve twelve original commitments.', status: 'active', targetPoints: 24 },
        closedAt, closedBy: { id: input.maintainerId, name: 'Morgan Maintainer' },
        health: { health: 'healthy', reasons: [] },
        counts: {
          totalCount: 12, completedCount: 0, canceledCount: 0, unfinishedCount: 12,
          retainedCount: 0, movedCount: 12, committedEstimatePoints: 24, completedEstimatePoints: 0,
          unfinishedEstimatePoints: 24, unestimatedUnfinishedCount: 0
        },
        destination: { kind: 'cycle', cycle: destination },
        items: { completed: [], canceled: [], unfinished }
      };
      await tx.insert(projectCycleCloseouts).values({
        id: id(1200 + index), workspaceId: input.workspaceId, projectId: input.projectId,
        cycleId: cycle.id, closedByMemberId: input.maintainerId, destinationCycleId: destination.id,
        snapshot: parseStoredProjectCycleCloseoutSnapshot(snapshot), closedAt: new Date(closedAt), createdAt: new Date(closedAt)
      }).onConflictDoNothing();
    }
  });
}
