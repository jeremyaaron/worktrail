import type {
  ActivityEventType,
  CreateSavedWorkViewRequest,
  ListSavedWorkViewsQuery,
  SavedWorkViewDto,
  SavedWorkViewScope,
  SavedWorkViewVisibility,
  UpdateSavedWorkViewRequest,
  WorkItemQuery,
  WorkspaceActivityEventType
} from '@worktrail/contracts';
import { randomUUID } from 'node:crypto';

import type { ActorContext } from '../domain/actor.js';
import { canManageProject } from '../domain/permissions.js';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../errors/app-error.js';
import type { Repositories } from '../repositories/index.js';
import type { Member, Project, SavedWorkView } from '../repositories/types.js';
import { normalizeWorkItemQuery } from '../validation/work-item-query.js';
import { toSavedWorkViewDto } from './dto.js';

export interface SavedWorkViewServiceContext {
  actor: ActorContext;
  repositories: Repositories;
  clock?: () => Date;
  idGenerator?: () => string;
}

interface ResolvedSavedViewScope {
  scope: SavedWorkViewScope;
  project: Project | null;
}

export class SavedWorkViewService {
  private readonly clock: () => Date;
  private readonly idGenerator: () => string;

  constructor(private readonly context: SavedWorkViewServiceContext) {
    this.clock = context.clock ?? (() => new Date());
    this.idGenerator = context.idGenerator ?? randomUUID;
  }

  async listSavedViews(input: ListSavedWorkViewsQuery = {}): Promise<SavedWorkViewDto[]> {
    const actor = await this.requireActorMember();
    const scope = await this.resolveScope(input);
    const savedViews = await this.context.repositories.savedWorkViews.listVisible({
      workspaceId: this.context.actor.workspaceId,
      ownerMemberId: this.context.actor.memberId,
      scope: scope.scope,
      ...(scope.project === null ? {} : { projectId: scope.project.id })
    });
    const owners = await this.hydrateOwners(savedViews, actor);

    return savedViews.map((savedView) => {
      const owner = owners.get(savedView.ownerMemberId);

      if (owner === undefined) {
        throw new NotFoundError('Saved view owner not found.');
      }

      return toSavedWorkViewDto(savedView, owner);
    });
  }

  async createSavedView(input: CreateSavedWorkViewRequest): Promise<SavedWorkViewDto> {
    const owner = await this.requireActorMember();
    const name = this.normalizeName(input.name);
    const visibility = input.visibility ?? 'personal';
    const scope = await this.resolveScope({
      scope: input.scope,
      projectId: input.projectId,
      requireMutableProject: input.scope === 'project'
    });

    this.assertCanCreateVisibility(visibility);
    await this.assertNameAvailable({
      name,
      visibility,
      scope: scope.scope,
      ...(scope.project === null ? {} : { projectId: scope.project.id })
    });

    const timestamp = this.clock();
    const query = this.normalizeSavedViewQueryForScope(input.query, scope.scope);
    const savedView = await this.context.repositories.savedWorkViews.create({
      id: this.idGenerator(),
      workspaceId: this.context.actor.workspaceId,
      ownerMemberId: this.context.actor.memberId,
      projectId: scope.project?.id ?? null,
      name,
      scope: scope.scope,
      visibility,
      query: query as Record<string, unknown>,
      createdAt: timestamp,
      updatedAt: timestamp
    });

    if (savedView.visibility === 'workspace') {
      await this.recordSharedSavedViewActivity({
        eventType: 'saved_view.created',
        savedView,
        actor: owner,
        summary: this.sharedSavedViewCreateSummary(owner, savedView),
        previousValue: null,
        newValue: this.savedViewActivityValue(savedView),
        timestamp
      });
    }

    return toSavedWorkViewDto(savedView, owner);
  }

  async updateSavedView(
    savedViewId: string,
    input: UpdateSavedWorkViewRequest
  ): Promise<SavedWorkViewDto> {
    const [actor, current] = await Promise.all([
      this.requireActorMember(),
      this.requireMutableSavedView(savedViewId)
    ]);
    const patch: { name?: string; query?: WorkItemQuery; updatedAt: Date } = {
      updatedAt: this.clock()
    };
    let normalizedQuery: WorkItemQuery | undefined;

    if (input.name !== undefined) {
      const name = this.normalizeName(input.name);

      if (name.toLowerCase() !== current.name.toLowerCase()) {
        await this.assertNameAvailable({
          name,
          visibility: current.visibility,
          scope: current.scope,
          ...(current.projectId === null ? {} : { projectId: current.projectId }),
          currentSavedViewId: current.id
        });
      }

      patch.name = name;
    }

    if (input.query !== undefined) {
      normalizedQuery = this.normalizeSavedViewQueryForScope(input.query, current.scope);
      patch.query = normalizedQuery;
    }

    const updated = await this.context.repositories.savedWorkViews.update(current.id, {
      ...(patch.name === undefined ? {} : { name: patch.name }),
      ...(patch.query === undefined ? {} : { query: patch.query as Record<string, unknown> }),
      updatedAt: patch.updatedAt
    });

    if (updated === null) {
      throw new NotFoundError('Saved view not found.');
    }

    if (updated.visibility === 'workspace') {
      await this.recordSharedSavedViewUpdateActivity({
        current,
        updated,
        actor,
        normalizedQuery,
        timestamp: patch.updatedAt
      });
    }

    const owner = await this.requireSavedViewOwner(updated);

    return toSavedWorkViewDto(updated, owner);
  }

  async deleteSavedView(savedViewId: string): Promise<void> {
    const [actor, current] = await Promise.all([
      this.requireActorMember(),
      this.requireMutableSavedView(savedViewId)
    ]);
    const deleted = await this.context.repositories.savedWorkViews.delete(current.id);

    if (deleted === null) {
      throw new NotFoundError('Saved view not found.');
    }

    if (deleted.visibility === 'workspace') {
      await this.recordSharedSavedViewActivity({
        eventType: 'saved_view.deleted',
        savedView: deleted,
        actor,
        summary: this.sharedSavedViewDeleteSummary(actor, deleted),
        previousValue: this.savedViewActivityValue(deleted),
        newValue: null,
        timestamp: this.clock()
      });
    }
  }

  private async requireActorMember(): Promise<Member> {
    const owner = await this.context.repositories.members.findById(this.context.actor.memberId);

    if (owner === null || owner.workspaceId !== this.context.actor.workspaceId || !owner.isActive) {
      throw new NotFoundError('Saved view owner not found.');
    }

    return owner;
  }

  private async requireMutableSavedView(savedViewId: string): Promise<SavedWorkView> {
    const savedView = await this.context.repositories.savedWorkViews.findById(savedViewId);

    if (savedView === null || savedView.workspaceId !== this.context.actor.workspaceId) {
      throw new NotFoundError('Saved view not found.');
    }

    if (savedView.visibility === 'personal' && savedView.ownerMemberId !== this.context.actor.memberId) {
      throw new NotFoundError('Saved view not found.');
    }

    if (savedView.visibility === 'workspace' && !canManageProject(this.context.actor)) {
      throw new ForbiddenError('Only owners and maintainers can manage shared saved views.');
    }

    if (savedView.scope === 'project') {
      if (savedView.projectId === null) {
        throw new NotFoundError('Project not found.');
      }

      const project = await this.context.repositories.projects.findById(savedView.projectId);

      if (project === null || project.workspaceId !== this.context.actor.workspaceId) {
        throw new NotFoundError('Project not found.');
      }

      if (project.status === 'archived') {
        throw new ForbiddenError('Archived projects do not allow saved view changes.');
      }
    }

    return savedView;
  }

  private normalizeName(name: string): string {
    const normalized = name.trim();

    if (normalized === '') {
      throw new ValidationError('Saved view name is required.');
    }

    return normalized;
  }

  private assertCanCreateVisibility(visibility: SavedWorkViewVisibility): void {
    if (visibility === 'workspace' && !canManageProject(this.context.actor)) {
      throw new ForbiddenError('Only owners and maintainers can create shared saved views.');
    }
  }

  private async assertNameAvailable(input: {
    name: string;
    visibility: SavedWorkViewVisibility;
    scope: SavedWorkViewScope;
    projectId?: string;
    currentSavedViewId?: string;
  }): Promise<void> {
    const existing =
      input.visibility === 'workspace'
        ? await this.context.repositories.savedWorkViews.findSharedByName({
            workspaceId: this.context.actor.workspaceId,
            scope: input.scope,
            projectId: input.projectId,
            name: input.name
          })
        : await this.context.repositories.savedWorkViews.findPersonalByOwnerAndName({
            workspaceId: this.context.actor.workspaceId,
            ownerMemberId: this.context.actor.memberId,
            scope: input.scope,
            projectId: input.projectId,
            name: input.name
          });

    if (existing !== null && existing.id !== input.currentSavedViewId) {
      throw new ConflictError('A saved view with this name already exists.');
    }
  }

  private async hydrateOwners(savedViews: SavedWorkView[], actor: Member): Promise<Map<string, Member>> {
    const owners = new Map<string, Member>([[actor.id, actor]]);
    const ownerIds = new Set(savedViews.map((savedView) => savedView.ownerMemberId));

    await Promise.all(
      [...ownerIds]
        .filter((ownerId) => !owners.has(ownerId))
        .map(async (ownerId) => {
          const owner = await this.context.repositories.members.findById(ownerId);

          if (owner !== null && owner.workspaceId === this.context.actor.workspaceId) {
            owners.set(owner.id, owner);
          }
        })
    );

    return owners;
  }

  private async requireSavedViewOwner(savedView: SavedWorkView): Promise<Member> {
    const owner = await this.context.repositories.members.findById(savedView.ownerMemberId);

    if (owner === null || owner.workspaceId !== savedView.workspaceId) {
      throw new NotFoundError('Saved view owner not found.');
    }

    return owner;
  }

  private async resolveScope(input: ListSavedWorkViewsQuery & { requireMutableProject?: boolean }): Promise<ResolvedSavedViewScope> {
    const scope = input.scope ?? 'workspace';

    if (scope === 'workspace') {
      if (input.projectId !== undefined) {
        throw new ValidationError('Workspace saved views do not accept a project id.');
      }

      return { scope, project: null };
    }

    if (input.projectId === undefined) {
      throw new ValidationError('Project saved views require a project id.');
    }

    const project = await this.context.repositories.projects.findById(input.projectId);

    if (project === null || project.workspaceId !== this.context.actor.workspaceId) {
      throw new NotFoundError('Project not found.');
    }

    if (input.requireMutableProject === true && project.status === 'archived') {
      throw new ForbiddenError('Archived projects do not allow saved view changes.');
    }

    return { scope, project };
  }

  private normalizeSavedViewQueryForScope(
    query: WorkItemQuery,
    scope: SavedWorkViewScope
  ): WorkItemQuery {
    const normalized = normalizeWorkItemQuery(query);

    if (scope === 'workspace') {
      return normalized;
    }

    const { projectId: _projectId, archivedProjects: _archivedProjects, ...projectQuery } = normalized;

    return projectQuery;
  }

  private async recordSharedSavedViewUpdateActivity(input: {
    current: SavedWorkView;
    updated: SavedWorkView;
    actor: Member;
    normalizedQuery?: WorkItemQuery;
    timestamp: Date;
  }): Promise<void> {
    const nameChanged = input.current.name !== input.updated.name;
    const queryChanged =
      input.normalizedQuery !== undefined &&
      this.stringifyComparableJson(input.current.query) !==
        this.stringifyComparableJson(input.normalizedQuery);

    if (!nameChanged && !queryChanged) {
      return;
    }

    const eventType =
      nameChanged && queryChanged
        ? 'saved_view.updated'
        : nameChanged
          ? 'saved_view.name_changed'
          : 'saved_view.query_changed';

    await this.recordSharedSavedViewActivity({
      eventType,
      savedView: input.updated,
      actor: input.actor,
      summary: this.sharedSavedViewUpdateSummary({
        actor: input.actor,
        current: input.current,
        updated: input.updated,
        nameChanged,
        queryChanged
      }),
      previousValue: this.savedViewActivityValue(input.current),
      newValue: this.savedViewActivityValue(input.updated),
      timestamp: input.timestamp
    });
  }

  private sharedSavedViewUpdateSummary(input: {
    actor: Member;
    current: SavedWorkView;
    updated: SavedWorkView;
    nameChanged: boolean;
    queryChanged: boolean;
  }): string {
    const label = input.updated.scope === 'project' ? 'shared project view' : 'shared view';

    if (input.nameChanged && input.queryChanged) {
      return `${input.actor.name} updated ${label} ${input.updated.name}.`;
    }

    if (input.nameChanged) {
      return `${input.actor.name} renamed ${label} ${input.current.name} to ${input.updated.name}.`;
    }

    return `${input.actor.name} updated ${label} ${input.updated.name} filters.`;
  }

  private sharedSavedViewCreateSummary(actor: Member, savedView: SavedWorkView): string {
    const label = savedView.scope === 'project' ? 'shared project view' : 'shared view';

    return `${actor.name} created ${label} ${savedView.name}.`;
  }

  private sharedSavedViewDeleteSummary(actor: Member, savedView: SavedWorkView): string {
    const label = savedView.scope === 'project' ? 'shared project view' : 'shared view';

    return `${actor.name} deleted ${label} ${savedView.name}.`;
  }

  private async recordSharedSavedViewActivity(input: {
    eventType: WorkspaceActivityEventType | ActivityEventType;
    savedView: SavedWorkView;
    actor: Member;
    summary: string;
    previousValue: Record<string, unknown> | null;
    newValue: Record<string, unknown> | null;
    timestamp: Date;
  }): Promise<void> {
    if (input.savedView.scope === 'project') {
      await this.recordProjectSavedViewActivity({
        ...input,
        eventType: input.eventType as ActivityEventType
      });
      return;
    }

    await this.context.repositories.workspaceActivityEvents.create({
      id: this.idGenerator(),
      workspaceId: input.savedView.workspaceId,
      actorId: input.actor.id,
      eventType: input.eventType as WorkspaceActivityEventType,
      summary: input.summary,
      previousValue: input.previousValue,
      newValue: input.newValue,
      metadata: { savedViewId: input.savedView.id },
      createdAt: input.timestamp
    });
  }

  private async recordProjectSavedViewActivity(input: {
    eventType: ActivityEventType;
    savedView: SavedWorkView;
    actor: Member;
    summary: string;
    previousValue: Record<string, unknown> | null;
    newValue: Record<string, unknown> | null;
    timestamp: Date;
  }): Promise<void> {
    if (input.savedView.projectId === null) {
      throw new NotFoundError('Project not found.');
    }

    await this.context.repositories.activityEvents.create({
      id: this.idGenerator(),
      workspaceId: input.savedView.workspaceId,
      projectId: input.savedView.projectId,
      workItemId: null,
      actorId: input.actor.id,
      eventType: input.eventType,
      summary: input.summary,
      previousValue: input.previousValue,
      newValue: input.newValue,
      metadata: {
        savedViewId: input.savedView.id,
        scope: input.savedView.scope,
        visibility: input.savedView.visibility
      },
      createdAt: input.timestamp
    });
  }

  private savedViewActivityValue(savedView: SavedWorkView): Record<string, unknown> {
    return {
      savedViewId: savedView.id,
      name: savedView.name,
      scope: savedView.scope,
      projectId: savedView.projectId,
      visibility: savedView.visibility,
      query: savedView.query
    };
  }

  private stringifyComparableJson(value: unknown): string {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      return JSON.stringify(value);
    }

    const record = value as Record<string, unknown>;
    const normalized = Object.keys(record)
      .sort()
      .reduce<Record<string, unknown>>((result, key) => {
        result[key] = record[key];
        return result;
      }, {});

    return JSON.stringify(normalized);
  }
}
