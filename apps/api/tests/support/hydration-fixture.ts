import { randomUUID } from 'node:crypto';

import type { RepositoryExecutor } from '../../src/db/client.js';
import * as schema from '../../src/db/schema.js';
import type { NewWorkItem } from '../../src/repositories/types.js';

// Import-safe fixture: no connection, mutation, or executable seed runs on module import.
export async function createHydrationFixture(
  db: RepositoryExecutor, size: 10 | 25 | 100, workspaceId: string,
  referenceMode: 'mixed' | 'repeated' | 'distinct' = 'mixed'
) {
  const timestamp = new Date('2026-10-17T12:00:00Z');
  const timestamps = { createdAt: timestamp, updatedAt: timestamp };
  await db.insert(schema.workspaces).values({ id: workspaceId, name: `Hydration ${size}`, ...timestamps });
  const members = Array.from({ length: referenceMode === 'distinct' ? size * 2 : size }, (_, index) => ({
    id: randomUUID(), workspaceId, name: `Person ${index}`, email: `person-${index}@example.test`, ...timestamps,
    role: 'owner' as const, isActive: index % 10 !== 9,
    deactivatedAt: index % 10 === 9 ? timestamp : null
  }));
  await db.insert(schema.members).values(members);
  const projects = [0, 1].map((index) => ({
    id: randomUUID(), workspaceId, key: `HYD${index}`, name: `Hydration project ${index}`, ...timestamps,
    status: index === 0 ? 'active' as const : 'archived' as const
  }));
  await db.insert(schema.projects).values(projects);
  const workItems: NewWorkItem[] = [];
  const labelLinks: Array<typeof schema.workItemLabels.$inferInsert> = [];
  const edges: Array<typeof schema.workItemRelationships.$inferInsert> = [];
  for (const [projectIndex, project] of projects.entries()) {
    const milestones = Array.from({ length: size }, (_, index) => ({
      id: randomUUID(), workspaceId, projectId: project.id, name: `Milestone ${index}`, ...timestamps,
      status: 'planned' as const, archivedAt: index % 7 === 0 ? timestamp : null,
      archivedById: index % 7 === 0 ? members[0]!.id : null
    }));
    const cycles = milestones.map((_, index) => ({
      id: randomUUID(), workspaceId, projectId: project.id, name: `Cycle ${index}`, ...timestamps,
      status: 'completed' as const, startDate: '2026-09-01', endDate: '2026-09-30',
      archivedAt: index % 7 === 0 ? timestamp : null, archivedById: index % 7 === 0 ? members[0]!.id : null
    }));
    const labels = [0, 1].map((index) => ({
      id: randomUUID(), workspaceId, projectId: project.id, name: `Label ${index}`, color: '#117744', ...timestamps,
      archivedAt: index === 1 ? timestamp : null, archivedById: index === 1 ? members[0]!.id : null
    }));
    await db.insert(schema.milestones).values(milestones);
    await db.insert(schema.projectCycles).values(cycles);
    await db.insert(schema.labels).values(labels);
    const ids = Array.from({ length: size }, () => randomUUID());
    for (let index = 0;index < size;index++) {
      const reference = referenceMode === 'repeated' || (referenceMode === 'mixed' && index % 2 === 0) ? 0 : index;
      const memberReference = referenceMode === 'distinct' ? projectIndex * size + reference : reference;
      workItems.push({
        id: ids[index]!, workspaceId, projectId: project.id, itemNumber: index + 1,
        displayKey: `${project.key}-${index + 1}`, title: `Hydrated item ${index + 1}`,
        description: 'Private authored source, deliberately absent from summary payloads.',
        type: index === 0 ? 'story' : 'task', status: 'ready', priority: 'medium',
        reporterId: members[memberReference]!.id, assigneeId: members[memberReference]!.id,
        milestoneId: milestones[reference]!.id, cycleId: cycles[reference]!.id,
        parentWorkItemId: index === 0 ? null : ids[0]!, estimatePoints: index % 3 === 0 ? 0 : 3,
        boardPosition: (index + 1) * 1024, createdAt: timestamp,
        updatedAt: new Date(timestamp.getTime() + index * 1000)
      });
      for (const label of labels) labelLinks.push({ workItemId: ids[index]!, labelId: label.id });
      if (index > 0) edges.push({
        id: randomUUID(), workspaceId, sourceWorkItemId: ids[index - 1]!, targetWorkItemId: ids[index]!,
        relationshipType: 'blocks', createdById: members[0]!.id, createdAt: timestamp
      });
    }
  }
  await db.insert(schema.workItems).values(workItems);
  await db.insert(schema.workItemLabels).values(labelLinks);
  await db.insert(schema.workItemRelationships).values(edges);
  return {
    workspaceId, projects, workItems, members,
    actor: { workspaceId, memberId: members[0]!.id, role: 'owner' as const }
  };
}
