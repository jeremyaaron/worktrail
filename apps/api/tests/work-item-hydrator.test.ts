import { randomUUID } from 'node:crypto';

import { describe, expect, it, vi } from 'vitest';

import type { RepositoryExecutor } from '../src/db/client.js';
import { createRepositories } from '../src/repositories/index.js';
import type { Member, Milestone, ProjectCycle, WorkItem } from '../src/repositories/types.js';
import { WorkItemHydrator, workItemHydrationChunkSize } from '../src/services/work-item-hydrator.js';

function fixture() {
  const timestamp = new Date('2026-10-17T00:00:00Z');
  const workspaceId = randomUUID();
  const projectId = randomUUID();
  const member: Member = {
    id: randomUUID(), workspaceId, name: 'Inactive historical member', email: 'member@example.test',
    role: 'owner', isActive: false, deactivatedAt: timestamp, deactivatedById: null, createdAt: timestamp, updatedAt: timestamp
  };
  const milestone: Milestone = {
    id: randomUUID(), workspaceId, projectId, name: 'Archived milestone', description: '',
    status: 'completed', targetDate: null, archivedAt: timestamp, archivedById: member.id, createdAt: timestamp, updatedAt: timestamp
  };
  const cycle: ProjectCycle = {
    id: randomUUID(), workspaceId, projectId, name: 'Archived cycle', goal: '', status: 'completed',
    startDate: '2026-10-01', endDate: '2026-10-07', targetPoints: null, archivedAt: timestamp, archivedById: member.id,
    createdAt: timestamp, updatedAt: timestamp
  };
  const item: WorkItem = {
    id: randomUUID(), workspaceId, projectId, title: 'Item', description: 'Not in a summary',
    descriptionFormat: 'markdown_v1', itemNumber: 1, displayKey: 'HYD-1', type: 'task', status: 'ready', priority: 'medium',
    reporterId: member.id, assigneeId: member.id, milestoneId: milestone.id, cycleId: cycle.id, parentWorkItemId: null,
    boardPosition: 1024, dueDate: null, estimatePoints: 0, createdAt: timestamp, updatedAt: timestamp
  };
  // Explicit repository-only fake. Every query this owner can issue is replaced below.
  const repositories = createRepositories({} as RepositoryExecutor);
  vi.spyOn(repositories.members, 'listByIds').mockResolvedValue([member]);
  vi.spyOn(repositories.milestones, 'listByIds').mockResolvedValue([milestone]);
  vi.spyOn(repositories.projectCycles, 'listByIds').mockResolvedValue([cycle]);
  vi.spyOn(repositories.labels, 'listByWorkItems').mockResolvedValue([]);
  vi.spyOn(repositories.workItemRelationships, 'listDependencyCounts').mockResolvedValue(new Map());
  vi.spyOn(repositories.workItems, 'listParentsForChildren').mockResolvedValue([]);
  vi.spyOn(repositories.workItems, 'summarizeChildren').mockResolvedValue([]);
  return { repositories, member, milestone, cycle, item, hydrator: new WorkItemHydrator(repositories) };
}

describe('batched work-item hydration', () => {
  it('deduplicates repeated references, preserves input order and historical flags, and omits authored source', async () => {
    const { hydrator, repositories, item, member, milestone, cycle } = fixture();
    const second = { ...item, id: randomUUID(), itemNumber: 2, displayKey: 'HYD-2' };
    const result = await hydrator.list([second, item]);
    expect(result.map((row) => row.id)).toEqual([second.id, item.id]);
    expect(result[0]).toMatchObject({
      assignee: { id: member.id, isActive: false }, reporter: { isActive: false },
      milestone: { id: milestone.id, isArchived: true }, cycle: { id: cycle.id, isArchived: true },
      estimatePoints: 0, parent: null, childSummary: null, openBlockerCount: 0, openBlockedWorkCount: 0
    });
    expect(repositories.members.listByIds).toHaveBeenCalledExactlyOnceWith([member.id]);
    expect(repositories.milestones.listByIds).toHaveBeenCalledExactlyOnceWith([milestone.id]);
    expect(repositories.projectCycles.listByIds).toHaveBeenCalledExactlyOnceWith([cycle.id]);
    expect(result[0]).not.toHaveProperty('description');
    expect(result[0]).not.toHaveProperty('descriptionFormat');
  });

  it('keeps missing optional assignees and absent milestone/cycle references null', async () => {
    const { hydrator, item } = fixture();
    const [result] = await hydrator.list([{ ...item, assigneeId: randomUUID(), milestoneId: null, cycleId: null }]);
    expect(result).toMatchObject({ assignee: null, milestone: null, cycle: null });
  });

  it('maps distinct reporter and assignee references by ID, regardless of database row order', async () => {
    const { hydrator, repositories, item, member } = fixture();
    const assignee = { ...member, id: randomUUID(), name: 'Different assignee' };
    vi.mocked(repositories.members.listByIds).mockResolvedValue([assignee, member]);
    const rows = await hydrator.list([{ ...item, assigneeId: assignee.id },
    { ...item, id: randomUUID(), reporterId: assignee.id }]);
    expect(rows[0]).toMatchObject({ reporter: { id: member.id }, assignee: { id: assignee.id } });
    expect(rows[1]).toMatchObject({ reporter: { id: assignee.id }, assignee: { id: member.id } });
    expect(repositories.members.listByIds).toHaveBeenCalledExactlyOnceWith([member.id, assignee.id]);
  });

  it.each(['reporter', 'milestone', 'cycle'] as const)('preserves missing mandatory %s errors', async (reference) => {
    const { hydrator, repositories, item } = fixture();
    if (reference === 'reporter') vi.mocked(repositories.members.listByIds).mockResolvedValue([]);
    if (reference === 'milestone') vi.mocked(repositories.milestones.listByIds).mockResolvedValue([]);
    if (reference === 'cycle') vi.mocked(repositories.projectCycles.listByIds).mockResolvedValue([]);
    await expect(hydrator.list([item])).rejects.toMatchObject({ code: 'NOT_FOUND', message: `Work item ${reference} not found.` });
  });

  it('does not issue any query for empty results', async () => {
    const { hydrator, repositories } = fixture();
    expect(await hydrator.list([])).toEqual([]);
    expect(await hydrator.workspace([])).toEqual([]);
    expect(repositories.members.listByIds).not.toHaveBeenCalled();
    expect(repositories.labels.listByWorkItems).not.toHaveBeenCalled();
    expect(repositories.workItemRelationships.listDependencyCounts).not.toHaveBeenCalled();
  });

  it.each(['reporter', 'milestone', 'cycle'] as const)('does not expose a foreign-workspace %s reference', async (reference) => {
    const { hydrator, repositories, item, member, milestone, cycle } = fixture();
    const workspaceId = randomUUID();
    if (reference === 'reporter') vi.mocked(repositories.members.listByIds).mockResolvedValue([{ ...member, workspaceId }]);
    if (reference === 'milestone') vi.mocked(repositories.milestones.listByIds).mockResolvedValue([{ ...milestone, workspaceId }]);
    if (reference === 'cycle') vi.mocked(repositories.projectCycles.listByIds).mockResolvedValue([{ ...cycle, workspaceId }]);
    await expect(hydrator.list([item])).rejects.toMatchObject({ code: 'NOT_FOUND', message: `Work item ${reference} not found.` });
  });

  it('does not expose foreign optional assignee, parent, or label data', async () => {
    const { hydrator, repositories, item, member } = fixture();
    const workspaceId = randomUUID();
    const foreignMember = { ...member, id: randomUUID(), workspaceId };
    vi.mocked(repositories.members.listByIds).mockResolvedValue([member, foreignMember]);
    vi.mocked(repositories.workItems.listParentsForChildren).mockResolvedValue([
      { childWorkItemId: item.id, parent: { ...item, id: randomUUID(), workspaceId } }
    ]);
    vi.mocked(repositories.labels.listByWorkItems).mockResolvedValue([{
      workItemId: item.id,
      label: {
        id: randomUUID(), workspaceId, projectId: null, name: 'Foreign label', color: '#112233',
        archivedAt: null, archivedById: null, createdAt: new Date(), updatedAt: new Date()
      }
    }]);
    const [result] = await hydrator.list([{ ...item, assigneeId: foreignMember.id }]);
    expect(result).toMatchObject({ assignee: null, parent: null, labels: [] });
  });

  it('uses joined project summaries in record order without project lookups', async () => {
    const { hydrator, repositories, item } = fixture();
    const projectRead = vi.spyOn(repositories.projects, 'findById');
    const project = { id: item.projectId, key: 'HYD', name: 'Historical project', status: 'archived' as const };
    const [result] = await hydrator.workspace([{ workItem: item, project }]);
    expect(result?.project).toEqual(project);
    expect(result?.cycle).not.toBeNull();
    expect(projectRead).not.toHaveBeenCalled();
  });

  it('bounds large exports into ordered chunks, including reference and related-row queries', async () => {
    const { hydrator, repositories, item } = fixture();
    const rows = Array.from({ length: workItemHydrationChunkSize + 1 }, (_, index) => ({
      ...item,
      id: randomUUID(), itemNumber: index + 1, displayKey: `HYD-${index + 1}`
    }));
    const result = await hydrator.list(rows);
    expect(result.map((row) => row.id)).toEqual(rows.map((row) => row.id));
    for (const query of [repositories.labels.listByWorkItems, repositories.workItemRelationships.listDependencyCounts,
    repositories.workItems.listParentsForChildren, repositories.workItems.summarizeChildren]) {
      expect(query).toHaveBeenCalledTimes(2);
      expect(vi.mocked(query).mock.calls.map(([ids]) => ids.length)).toEqual([workItemHydrationChunkSize, 1]);
    }
    expect(repositories.members.listByIds).toHaveBeenCalledTimes(2);
  });
});
