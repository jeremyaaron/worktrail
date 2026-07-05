import type {
  CreateWorkItemRelationshipRequest,
  WorkItemRelationshipDto,
  WorkItemRelationshipItemDto,
  WorkItemRelationshipSummaryDto,
  WorkItemRelationshipWorkItemDto
} from '@worktrail/contracts';
import { randomUUID } from 'node:crypto';

import type { WorktrailDb } from '../db/client.js';
import type { ActorContext } from '../domain/actor.js';
import { canUpdateAssignedWorkItem } from '../domain/permissions.js';
import { isTerminalWorkItemStatus } from '../domain/work-risk-policy.js';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../errors/app-error.js';
import {
  type Repositories,
  withRepositoriesTransaction
} from '../repositories/index.js';
import type {
  Member,
  Project,
  WorkItem,
  WorkItemRelationship
} from '../repositories/types.js';
import { emptyRelationshipSummary, toMemberDto } from './dto.js';

export interface WorkItemRelationshipServiceContext {
  actor: ActorContext;
  repositories: Repositories;
  db?: WorktrailDb;
  clock?: () => Date;
  idGenerator?: () => string;
}

interface RelationshipWorkItemBundle {
  workItem: WorkItem;
  project: Project;
  assignee: Member | null;
}

export class WorkItemRelationshipService {
  private readonly clock: () => Date;
  private readonly idGenerator: () => string;

  constructor(private readonly context: WorkItemRelationshipServiceContext) {
    this.clock = context.clock ?? (() => new Date());
    this.idGenerator = context.idGenerator ?? randomUUID;
  }

  async getRelationshipSummary(workItemId: string): Promise<WorkItemRelationshipSummaryDto> {
    return this.getRelationshipSummaryWithRepositories(workItemId, this.context.repositories);
  }

  async getRelationshipSummaryWithRepositories(
    workItemId: string,
    repositories: Repositories
  ): Promise<WorkItemRelationshipSummaryDto> {
    const workItem = await this.requireWorkItem(workItemId, repositories);
    const [relationships, dependencyCountsById] = await Promise.all([
      repositories.workItemRelationships.listForWorkItem(workItem.id),
      repositories.workItemRelationships.listDependencyCounts([workItem.id])
    ]);
    const summary = emptyRelationshipSummary();
    const dependencyCounts = dependencyCountsById.get(workItem.id);

    if (dependencyCounts !== undefined) {
      summary.openBlockerCount = dependencyCounts.openBlockerCount;
      summary.openBlockedWorkCount = dependencyCounts.openBlockedWorkCount;
      summary.dependencyBlocked = dependencyCounts.openBlockerCount > 0;
    }

    for (const relationship of relationships) {
      const item = await this.toRelationshipItemDto(workItem.id, relationship, repositories);

      if (item.direction === 'inbound') {
        summary.blockedBy.push(item);
      } else if (item.direction === 'outbound') {
        summary.blocks.push(item);
      } else {
        summary.related.push(item);
      }
    }

    return summary;
  }

  async createRelationship(
    sourceWorkItemId: string,
    input: CreateWorkItemRelationshipRequest
  ): Promise<WorkItemRelationshipDto> {
    return this.withWriteRepositories(async (repositories) => {
      const timestamp = this.clock();
      const source = await this.requireWorkItem(sourceWorkItemId, repositories);
      const target = await this.requireWorkItem(input.targetWorkItemId, repositories);

      if (source.id === target.id) {
        throw new ValidationError('Cannot relate a work item to itself.');
      }

      const sourceProject = await this.requireProject(source.projectId, repositories);
      const targetProject = await this.requireProject(target.projectId, repositories);
      this.assertWritableProjects(sourceProject, targetProject);
      this.assertCanUpdateWorkItem(source);

      const normalized = this.normalizeRelationshipInput({
        relationshipType: input.relationshipType,
        sourceWorkItemId: source.id,
        targetWorkItemId: target.id
      });
      const duplicate = await repositories.workItemRelationships.findBetween({
        workspaceId: this.context.actor.workspaceId,
        relationshipType: normalized.relationshipType,
        sourceWorkItemId: normalized.sourceWorkItemId,
        targetWorkItemId: normalized.targetWorkItemId
      });

      if (duplicate !== null) {
        throw new ConflictError('That relationship already exists.');
      }

      if (
        normalized.relationshipType === 'blocks' &&
        await repositories.workItemRelationships.wouldCreateBlockingCycle({
          workspaceId: this.context.actor.workspaceId,
          sourceWorkItemId: normalized.sourceWorkItemId,
          targetWorkItemId: normalized.targetWorkItemId
        })
      ) {
        throw new ValidationError('This relationship would create a blocking cycle.');
      }

      const relationship = await repositories.workItemRelationships.create({
        id: this.idGenerator(),
        workspaceId: this.context.actor.workspaceId,
        relationshipType: normalized.relationshipType,
        sourceWorkItemId: normalized.sourceWorkItemId,
        targetWorkItemId: normalized.targetWorkItemId,
        createdById: this.context.actor.memberId,
        createdAt: timestamp
      });

      await this.recordRelationshipActivity({
        contextWorkItem: source,
        relationship,
        action: 'added',
        repositories,
        timestamp
      });

      return this.toRelationshipDto(relationship, repositories);
    });
  }

  async deleteRelationship(workItemId: string, relationshipId: string): Promise<void> {
    await this.withWriteRepositories(async (repositories) => {
      const contextWorkItem = await this.requireWorkItem(workItemId, repositories);
      const relationship = await repositories.workItemRelationships.findById(relationshipId);

      if (
        relationship === null ||
        relationship.workspaceId !== this.context.actor.workspaceId ||
        (
          relationship.sourceWorkItemId !== contextWorkItem.id &&
          relationship.targetWorkItemId !== contextWorkItem.id
        )
      ) {
        throw new NotFoundError('Relationship not found.');
      }

      const source = await this.requireWorkItem(relationship.sourceWorkItemId, repositories);
      const target = await this.requireWorkItem(relationship.targetWorkItemId, repositories);
      const sourceProject = await this.requireProject(source.projectId, repositories);
      const targetProject = await this.requireProject(target.projectId, repositories);
      this.assertWritableProjects(sourceProject, targetProject);
      this.assertCanUpdateWorkItem(contextWorkItem);

      const timestamp = this.clock();
      await this.recordRelationshipActivity({
        contextWorkItem,
        relationship,
        action: 'removed',
        repositories,
        timestamp
      });
      await repositories.workItemRelationships.delete(relationship.id);
    });
  }

  private normalizeRelationshipInput(input: {
    relationshipType: WorkItemRelationship['relationshipType'];
    sourceWorkItemId: string;
    targetWorkItemId: string;
  }): {
    relationshipType: WorkItemRelationship['relationshipType'];
    sourceWorkItemId: string;
    targetWorkItemId: string;
  } {
    if (input.relationshipType === 'blocks') {
      return input;
    }

    const [sourceWorkItemId, targetWorkItemId] = [
      input.sourceWorkItemId,
      input.targetWorkItemId
    ].sort();

    return {
      relationshipType: input.relationshipType,
      sourceWorkItemId,
      targetWorkItemId
    };
  }

  private async withWriteRepositories<T>(
    callback: (repositories: Repositories) => Promise<T>
  ): Promise<T> {
    if (this.context.db === undefined) {
      return callback(this.context.repositories);
    }

    return withRepositoriesTransaction(this.context.db, callback);
  }

  private async toRelationshipDto(
    relationship: WorkItemRelationship,
    repositories: Repositories
  ): Promise<WorkItemRelationshipDto> {
    const sourceWorkItem = await this.toRelationshipWorkItemDto(
      relationship.sourceWorkItemId,
      repositories
    );
    const targetWorkItem = await this.toRelationshipWorkItemDto(
      relationship.targetWorkItemId,
      repositories
    );
    const createdBy = await this.requireMember(
      relationship.createdById,
      repositories,
      'Relationship creator not found.'
    );

    return {
      id: relationship.id,
      relationshipType: relationship.relationshipType,
      sourceWorkItemId: relationship.sourceWorkItemId,
      targetWorkItemId: relationship.targetWorkItemId,
      sourceWorkItem,
      targetWorkItem,
      createdBy: toMemberDto(createdBy),
      createdAt: relationship.createdAt.toISOString()
    };
  }

  private async toRelationshipItemDto(
    contextWorkItemId: string,
    relationship: WorkItemRelationship,
    repositories: Repositories
  ): Promise<WorkItemRelationshipItemDto> {
    const direction = this.relationshipDirection(contextWorkItemId, relationship);
    const relatedWorkItemId =
      relationship.relationshipType === 'relates_to'
        ? relationship.sourceWorkItemId === contextWorkItemId
          ? relationship.targetWorkItemId
          : relationship.sourceWorkItemId
        : direction === 'inbound'
          ? relationship.sourceWorkItemId
          : relationship.targetWorkItemId;
    const workItem = await this.toRelationshipWorkItemDto(relatedWorkItemId, repositories);
    const createdBy = await this.requireMember(
      relationship.createdById,
      repositories,
      'Relationship creator not found.'
    );

    return {
      id: relationship.id,
      relationshipType: relationship.relationshipType,
      direction,
      workItem,
      createdBy: toMemberDto(createdBy),
      createdAt: relationship.createdAt.toISOString()
    };
  }

  private relationshipDirection(
    contextWorkItemId: string,
    relationship: WorkItemRelationship
  ): WorkItemRelationshipItemDto['direction'] {
    if (relationship.relationshipType === 'relates_to') {
      return 'related';
    }

    return relationship.targetWorkItemId === contextWorkItemId ? 'inbound' : 'outbound';
  }

  private async toRelationshipWorkItemDto(
    workItemId: string,
    repositories: Repositories
  ): Promise<WorkItemRelationshipWorkItemDto> {
    const bundle = await this.requireRelationshipWorkItemBundle(workItemId, repositories);

    return {
      id: bundle.workItem.id,
      workspaceId: bundle.workItem.workspaceId,
      projectId: bundle.workItem.projectId,
      project: {
        id: bundle.project.id,
        key: bundle.project.key,
        name: bundle.project.name,
        status: bundle.project.status
      },
      displayKey: bundle.workItem.displayKey,
      title: bundle.workItem.title,
      status: bundle.workItem.status,
      priority: bundle.workItem.priority,
      assignee: bundle.assignee === null ? null : toMemberDto(bundle.assignee)
    };
  }

  private async requireRelationshipWorkItemBundle(
    workItemId: string,
    repositories: Repositories
  ): Promise<RelationshipWorkItemBundle> {
    const workItem = await this.requireWorkItem(workItemId, repositories);
    const project = await this.requireProject(workItem.projectId, repositories);
    const assignee =
      workItem.assigneeId === null ? null : await repositories.members.findById(workItem.assigneeId);

    return { workItem, project, assignee };
  }

  private async recordRelationshipActivity(input: {
    contextWorkItem: WorkItem;
    relationship: WorkItemRelationship;
    action: 'added' | 'removed';
    repositories: Repositories;
    timestamp: Date;
  }): Promise<void> {
    const relatedWorkItemId =
      input.relationship.relationshipType === 'relates_to'
        ? input.relationship.sourceWorkItemId === input.contextWorkItem.id
          ? input.relationship.targetWorkItemId
          : input.relationship.sourceWorkItemId
        : input.relationship.sourceWorkItemId === input.contextWorkItem.id
          ? input.relationship.targetWorkItemId
          : input.relationship.sourceWorkItemId;
    const related = await this.requireRelationshipWorkItemBundle(relatedWorkItemId, input.repositories);
    const summary = this.relationshipActivitySummary({
      contextWorkItemId: input.contextWorkItem.id,
      relationship: input.relationship,
      relatedDisplayKey: related.workItem.displayKey,
      relatedProjectKey: related.project.key,
      action: input.action
    });

    await input.repositories.activityEvents.create({
      id: this.idGenerator(),
      workspaceId: input.contextWorkItem.workspaceId,
      projectId: input.contextWorkItem.projectId,
      workItemId: input.contextWorkItem.id,
      actorId: this.context.actor.memberId,
      eventType:
        input.action === 'added'
          ? 'work_item.relationship_added'
          : 'work_item.relationship_removed',
      summary,
      previousValue:
        input.action === 'removed'
          ? this.relationshipActivityValue(input.relationship, related)
          : null,
      newValue:
        input.action === 'added'
          ? this.relationshipActivityValue(input.relationship, related)
          : null,
      metadata: {
        relationshipId: input.relationship.id,
        relationshipType: input.relationship.relationshipType,
        sourceWorkItemId: input.relationship.sourceWorkItemId,
        targetWorkItemId: input.relationship.targetWorkItemId,
        relatedWorkItemId: related.workItem.id,
        relatedDisplayKey: related.workItem.displayKey,
        relatedProjectKey: related.project.key
      },
      createdAt: input.timestamp
    });
  }

  private relationshipActivityValue(
    relationship: WorkItemRelationship,
    related: RelationshipWorkItemBundle
  ): Record<string, unknown> {
    return {
      relationshipId: relationship.id,
      relationshipType: relationship.relationshipType,
      relatedWorkItemId: related.workItem.id,
      relatedDisplayKey: related.workItem.displayKey,
      relatedProjectKey: related.project.key
    };
  }

  private relationshipActivitySummary(input: {
    contextWorkItemId: string;
    relationship: WorkItemRelationship;
    relatedDisplayKey: string;
    relatedProjectKey: string;
    action: 'added' | 'removed';
  }): string {
    const relatedKey = `${input.relatedProjectKey}-${input.relatedDisplayKey}`.includes('-')
      ? input.relatedDisplayKey
      : `${input.relatedProjectKey}-${input.relatedDisplayKey}`;

    if (input.relationship.relationshipType === 'relates_to') {
      return input.action === 'added'
        ? `Related this work to ${relatedKey}.`
        : `Removed related-work link to ${relatedKey}.`;
    }

    const contextIsSource = input.relationship.sourceWorkItemId === input.contextWorkItemId;

    if (input.action === 'added') {
      return contextIsSource
        ? `Marked this work as blocking ${relatedKey}.`
        : `Added blocker ${relatedKey}.`;
    }

    return contextIsSource
      ? `Removed blocked-work link to ${relatedKey}.`
      : `Removed blocker ${relatedKey}.`;
  }

  private assertWritableProjects(...projects: Project[]): void {
    if (projects.some((project) => project.status === 'archived')) {
      throw new ConflictError('Relationships cannot be changed for archived projects.');
    }
  }

  private assertCanUpdateWorkItem(workItem: WorkItem): void {
    if (
      !canUpdateAssignedWorkItem({
        actor: this.context.actor,
        assigneeId: workItem.assigneeId,
        isTerminal: isTerminalWorkItemStatus(workItem.status)
      })
    ) {
      throw new ForbiddenError('You do not have permission to update this work item.');
    }
  }

  private async requireWorkItem(
    workItemId: string,
    repositories: Repositories
  ): Promise<WorkItem> {
    const workItem = await repositories.workItems.findById(workItemId);

    if (workItem === null || workItem.workspaceId !== this.context.actor.workspaceId) {
      throw new NotFoundError('Work item not found.');
    }

    return workItem;
  }

  private async requireProject(
    projectId: string,
    repositories: Repositories
  ): Promise<Project> {
    const project = await repositories.projects.findById(projectId);

    if (project === null || project.workspaceId !== this.context.actor.workspaceId) {
      throw new NotFoundError('Project not found.');
    }

    return project;
  }

  private async requireMember(
    memberId: string,
    repositories: Repositories,
    message: string
  ): Promise<Member> {
    const member = await repositories.members.findById(memberId);

    if (member === null || member.workspaceId !== this.context.actor.workspaceId) {
      throw new NotFoundError(message);
    }

    return member;
  }
}
