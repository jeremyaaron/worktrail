import { randomUUID } from 'node:crypto';
import { addDays, toDateString } from '@worktrail/contracts';
import type { ProjectStatusReportSnapshotDto } from '@worktrail/contracts';
import type { RepositoryExecutor } from '../../src/db/client.js';
import * as schema from '../../src/db/schema.js';
import type { NewWorkItem } from '../../src/repositories/types.js';
import { goldenReportV1, goldenReportV2 } from './snapshot-fixtures.js';

// Import-safe representative aggregate fixture; callers own provisioning and cleanup.
export async function createAggregateFixture(db: RepositoryExecutor, workspaceId: string, projectCount = 15) {
  const now = new Date('2026-10-17T12:00:00Z');
  const times = { createdAt: now, updatedAt: now };
  await db.insert(schema.workspaces).values({ id: workspaceId, name: 'Aggregate evidence', ...times });
  const members = [0, 1, 2].map(index => ({ id: randomUUID(), workspaceId, name: `Aggregate person ${index}`,
    email: `aggregate-${index}@example.test`, role: 'owner' as const, isActive: index !== 2,
    deactivatedAt: index === 2 ? now : null, ...times }));
  await db.insert(schema.members).values(members);
  const projects = Array.from({ length: projectCount }, (_, index) => ({ id: randomUUID(), workspaceId,
    key: `AG${index}`, name: `Aggregate project ${index}`, status: 'active' as const, nextWorkItemNumber: 61, ...times }));
  await db.insert(schema.projects).values(projects);
  const work: NewWorkItem[] = [];
  const cycles: Array<typeof schema.projectCycles.$inferInsert> = [];
  const milestones: Array<typeof schema.milestones.$inferInsert> = [];
  const edges: Array<typeof schema.workItemRelationships.$inferInsert> = [];
  const labels: Array<typeof schema.labels.$inferInsert> = [];
  const labelLinks: Array<typeof schema.workItemLabels.$inferInsert> = [];
  for (const [projectIndex, project] of projects.entries()) {
    const projectCycles = ['active', 'planned', 'completed'].map((status, index) => ({
      id: randomUUID(), workspaceId, projectId: project.id, name: `Cycle ${index}`, status: status as 'active' | 'planned' | 'completed',
      startDate: toDateString(addDays(now, index === 0 ? -5 : index === 1 ? 6 : -20)),
      endDate: toDateString(addDays(now, index === 0 ? 5 : index === 1 ? 20 : -6)), targetPoints: 10, ...times
    }));
    cycles.push(...projectCycles);
    const milestone = { id: randomUUID(), workspaceId, projectId: project.id, name: 'Delivery', status: 'active' as const,
      targetDate: toDateString(addDays(now, 7)), ...times };
    milestones.push(milestone);
    const label = { id: randomUUID(), workspaceId, projectId: project.id, name: 'Aggregate label', color: '#117744', ...times };
    labels.push(label);
    const ids = Array.from({ length: 60 }, () => randomUUID());
    for (let index = 0; index < 60; index++) {
      work.push({ id: ids[index]!, workspaceId, projectId: project.id, itemNumber: index + 1,
        displayKey: `${project.key}-${index + 1}`, title: `Aggregate ${projectIndex}/${index}`,
        description: 'Aggregate private authored source. '.repeat(100), type: index === 0 ? 'story' : 'task',
        status: (['ready', 'in_progress', 'blocked', 'done', 'canceled'] as const)[index % 5]!,
        priority: (['low', 'medium', 'high', 'urgent'] as const)[index % 4]!,
        reporterId: members[index % 2]!.id, assigneeId: index % 7 === 0 ? null : members[index % 3]!.id,
        milestoneId: milestone.id, cycleId: projectCycles[Math.floor(index / 20)]!.id,
        parentWorkItemId: index === 0 ? null : ids[0]!, boardPosition: (index + 1) * 1024,
        estimatePoints: index % 3 === 0 ? null : index % 3 === 1 ? 0 : 3,
        dueDate: toDateString(addDays(now, index % 15 - 3)), createdAt: now,
        updatedAt: new Date(addDays(now, -(index % 12)).getTime() + index * 1000) });
      labelLinks.push({ workItemId: ids[index]!, labelId: label.id });
      if (index > 0) edges.push({ id: randomUUID(), workspaceId, sourceWorkItemId: ids[index - 1]!,
        targetWorkItemId: ids[index]!, relationshipType: 'blocks', createdById: members[0]!.id, createdAt: now });
    }
  }
  await db.insert(schema.milestones).values(milestones);
  await db.insert(schema.projectCycles).values(cycles);
  await db.insert(schema.labels).values(labels);
  for (let offset = 0; offset < work.length; offset += 200) await db.insert(schema.workItems).values(work.slice(offset, offset + 200));
  await db.insert(schema.workItemRelationships).values(edges);
  await db.insert(schema.workItemLabels).values(labelLinks);
  for (const [index, project] of projects.entries()) {
    const snapshot: ProjectStatusReportSnapshotDto = index % 2 === 0 ? structuredClone(goldenReportV1) : goldenReportV2();
    snapshot.project = { ...snapshot.project, id: project.id, key: project.key };
    if (snapshot.cycle) for (const link of snapshot.cycle.links) link.projectId = project.id;
    await db.insert(schema.projectStatusReports).values({ id: randomUUID(), workspaceId, projectId: project.id,
      authorMemberId: members[0]!.id, title: 'Aggregate report', summary: 'Aggregate private report narrative.', statusDate: toDateString(now),
      snapshot, publishedAt: now, createdAt: now });
  }
  return { workspaceId, projects, cycles, milestones, members, work, now,
    actor: { workspaceId, memberId: members[0]!.id, role: 'owner' as const } };
}
