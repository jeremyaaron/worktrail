import type { ProjectCycleCloseoutDto, ProjectCycleCloseoutItemSnapshotDto } from '@worktrail/contracts';

export function historicalCloseout(version: 1 | 2): ProjectCycleCloseoutDto {
  const id = (value: number): string => '00000000-0000-4000-8000-' + String(value).padStart(12, '0');
  const items = (status: 'done' | 'canceled' | 'ready', start: number, count: number): ProjectCycleCloseoutItemSnapshotDto[] =>
    Array.from({ length: count }, (_, index) => ({
      id: id(start + index), displayKey: 'HIST-' + (start + index), title: 'Frozen commitment ' + (start + index),
      status, priority: 'medium', assignee: { id: id(4), name: 'Original author' }, estimatePoints: 2, dependencyBlocked: false
    }));
  const member = {
    id: id(4), workspaceId: id(1), name: 'Renamed author', email: 'author@example.com', role: 'owner' as const,
    isActive: true, deactivatedAt: null, createdAt: '2026-05-01T12:00:00.000Z', updatedAt: '2026-06-01T12:00:00.000Z'
  };
  return {
    id: id(5), workspaceId: id(1), projectId: id(2), cycleId: id(3), destinationCycleId: id(6),
    closedAt: '2026-05-14T16:00:00.000Z', closedBy: member,
    snapshot: {
      snapshotVersion: version,
      project: { id: id(2), key: 'HIST', name: 'Original project' },
      cycle: {
        id: id(3), name: 'Original cycle', goal: 'Preserve complete evidence.', status: 'active',
        startDate: '2026-05-01', endDate: '2026-05-14', targetPoints: 68
      },
      closedAt: '2026-05-14T16:00:00.000Z', closedBy: { id: id(4), name: 'Original author' },
      health: { health: 'healthy', reasons: [] },
      counts: {
        totalCount: 34, completedCount: 11, canceledCount: 11, unfinishedCount: 12, retainedCount: 22, movedCount: 12,
        committedEstimatePoints: 68, completedEstimatePoints: 22, unfinishedEstimatePoints: 24, unestimatedUnfinishedCount: 0
      },
      destination: { kind: 'cycle', cycle: { id: id(6), name: 'Original destination', startDate: '2026-05-15', endDate: '2026-05-28' } },
      items: { completed: items('done', 100, 11), canceled: items('canceled', 200, 11), unfinished: items('ready', 300, 12) }
    }
  };
}
