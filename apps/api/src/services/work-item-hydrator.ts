import type { WorkItemListItemDto, WorkspaceWorkItemListItemDto } from '@worktrail/contracts';

import { NotFoundError } from '../errors/app-error.js';
import type { Repositories } from '../repositories/index.js';
import type { Label, WorkItemSummary } from '../repositories/types.js';
import type { WorkspaceWorkItemSummaryRecord } from '../repositories/work-item-repository.js';
import { toWorkItemListItemDto } from './dto.js';

export const workItemHydrationChunkSize = 500;

// Receives only the enclosing scope's repositories; it cannot create a transaction or root read.
export class WorkItemHydrator {
  constructor(private readonly repositories: Repositories) { }

  async list(workItems: readonly WorkItemSummary[]): Promise<WorkItemListItemDto[]> {
    const result: WorkItemListItemDto[] = [];
    for (let offset = 0;offset < workItems.length;offset += workItemHydrationChunkSize) {
      result.push(...await this.chunk(workItems.slice(offset, offset + workItemHydrationChunkSize)));
    }
    return result;
  }

  async workspace(records: readonly WorkspaceWorkItemSummaryRecord[]): Promise<WorkspaceWorkItemListItemDto[]> {
    const items = await this.list(records.map((record) => record.workItem));
    // Project summaries are already batched by the repository's single joined window/export read.
    return items.map((item, index) => ({ ...item, project: records[index]!.project }));
  }

  private async chunk(workItems: readonly WorkItemSummary[]): Promise<WorkItemListItemDto[]> {
    const repositories = this.repositories;
    const ids = workItems.map((item) => item.id);
    const memberIds = [...new Set(workItems.flatMap((item) =>
      item.assigneeId === null ? [item.reporterId] : [item.reporterId, item.assigneeId]
    ))];
    const milestoneIds = [...new Set(workItems.flatMap((item) =>
      item.milestoneId === null ? [] : [item.milestoneId]
    ))];
    const cycleIds = [...new Set(workItems.flatMap((item) =>
      item.cycleId === null ? [] : [item.cycleId]
    ))];
    const members = new Map(
      (await repositories.members.listByIds(memberIds)).map((member) => [member.id, member])
    );
    const milestones = new Map(
      (await repositories.milestones.listByIds(milestoneIds)).map((milestone) => [milestone.id, milestone])
    );
    const cycles = new Map(
      (await repositories.projectCycles.listByIds(cycleIds)).map((cycle) => [cycle.id, cycle])
    );
    const labels = new Map<string, Label[]>();
    for (const row of await repositories.labels.listByWorkItems(ids)) {
      const current = labels.get(row.workItemId) ?? [];
      current.push(row.label);
      labels.set(row.workItemId, current);
    }
    const dependencies = await repositories.workItemRelationships.listDependencyCounts(ids);
    const parents = new Map((await repositories.workItems.listParentsForChildren(ids)).map(({ childWorkItemId, parent }) =>
      [childWorkItemId, parent]
    ));
    const children = new Map((await repositories.workItems.summarizeChildren(ids)).map(({ parentWorkItemId, summary }) =>
      [parentWorkItemId, summary]
    ));
    return workItems.map((workItem) => {
      const reporter = members.get(workItem.reporterId);
      const assignedMember = workItem.assigneeId === null ? null : members.get(workItem.assigneeId) ?? null;
      const assignee = assignedMember?.workspaceId === workItem.workspaceId ? assignedMember : null;
      const milestone = workItem.milestoneId === null ? null : milestones.get(workItem.milestoneId) ?? null;
      const cycle = workItem.cycleId === null ? null : cycles.get(workItem.cycleId) ?? null;
      if (reporter === undefined || reporter.workspaceId !== workItem.workspaceId) {
        throw new NotFoundError('Work item reporter not found.');
      }
      if (workItem.milestoneId !== null && (
        milestone === null || milestone.workspaceId !== workItem.workspaceId || milestone.projectId !== workItem.projectId
      )) {
        throw new NotFoundError('Work item milestone not found.');
      }
      if (workItem.cycleId !== null && (
        cycle === null || cycle.workspaceId !== workItem.workspaceId || cycle.projectId !== workItem.projectId
      )) {
        throw new NotFoundError('Work item cycle not found.');
      }
      const parent = parents.get(workItem.id);
      const parentDto = parent?.workspaceId === workItem.workspaceId && parent.projectId === workItem.projectId
        ? {
          id: parent.id, projectId: parent.projectId, displayKey: parent.displayKey,
          title: parent.title, type: parent.type, status: parent.status
        } : null;
      return toWorkItemListItemDto({
        workItem, reporter, assignee, milestone, cycle,
        labels: (labels.get(workItem.id) ?? []).filter((label) => label.workspaceId === workItem.workspaceId &&
          (label.projectId === null || label.projectId === workItem.projectId)), parent: parentDto,
        childSummary: children.get(workItem.id) ?? null,
        dependencyCounts: dependencies.get(workItem.id) ?? { openBlockerCount: 0, openBlockedWorkCount: 0 }
      });
    });
  }
}
