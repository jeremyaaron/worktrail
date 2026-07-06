import type {
  CreateSavedWorkViewRequest,
  SavedWorkViewDto,
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
import type { Member, SavedWorkView } from '../repositories/types.js';
import { normalizeWorkItemQuery } from '../validation/work-item-query.js';
import { toSavedWorkViewDto } from './dto.js';

export interface SavedWorkViewServiceContext {
  actor: ActorContext;
  repositories: Repositories;
  clock?: () => Date;
  idGenerator?: () => string;
}

export class SavedWorkViewService {
  private readonly clock: () => Date;
  private readonly idGenerator: () => string;

  constructor(private readonly context: SavedWorkViewServiceContext) {
    this.clock = context.clock ?? (() => new Date());
    this.idGenerator = context.idGenerator ?? randomUUID;
  }

  async listSavedViews(): Promise<SavedWorkViewDto[]> {
    const [actor, savedViews] = await Promise.all([
      this.requireActorMember(),
      this.context.repositories.savedWorkViews.listVisible(
        this.context.actor.workspaceId,
        this.context.actor.memberId
      )
    ]);
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

    this.assertCanCreateVisibility(visibility);
    await this.assertNameAvailable(name, visibility);

    const timestamp = this.clock();
    const query = normalizeWorkItemQuery(input.query);
    const savedView = await this.context.repositories.savedWorkViews.create({
      id: this.idGenerator(),
      workspaceId: this.context.actor.workspaceId,
      ownerMemberId: this.context.actor.memberId,
      name,
      visibility,
      query: query as Record<string, unknown>,
      createdAt: timestamp,
      updatedAt: timestamp
    });

    if (savedView.visibility === 'workspace') {
      await this.recordWorkspaceSavedViewActivity({
        eventType: 'saved_view.created',
        savedView,
        actor: owner,
        summary: `${owner.name} created shared view ${savedView.name}.`,
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
        await this.assertNameAvailable(name, current.visibility, current.id);
      }

      patch.name = name;
    }

    if (input.query !== undefined) {
      normalizedQuery = normalizeWorkItemQuery(input.query);
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
      await this.recordWorkspaceSavedViewUpdateActivity({
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
      await this.recordWorkspaceSavedViewActivity({
        eventType: 'saved_view.deleted',
        savedView: deleted,
        actor,
        summary: `${actor.name} deleted shared view ${deleted.name}.`,
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

  private async assertNameAvailable(
    name: string,
    visibility: SavedWorkViewVisibility,
    currentSavedViewId?: string
  ): Promise<void> {
    const existing =
      visibility === 'workspace'
        ? await this.context.repositories.savedWorkViews.findWorkspaceByName(
            this.context.actor.workspaceId,
            name
          )
        : await this.context.repositories.savedWorkViews.findPersonalByOwnerAndName(
            this.context.actor.workspaceId,
            this.context.actor.memberId,
            name
          );

    if (existing !== null && existing.id !== currentSavedViewId) {
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

  private async recordWorkspaceSavedViewUpdateActivity(input: {
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

    const eventType: WorkspaceActivityEventType =
      nameChanged && queryChanged
        ? 'saved_view.updated'
        : nameChanged
          ? 'saved_view.name_changed'
          : 'saved_view.query_changed';

    await this.recordWorkspaceSavedViewActivity({
      eventType,
      savedView: input.updated,
      actor: input.actor,
      summary: this.workspaceSavedViewUpdateSummary({
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

  private workspaceSavedViewUpdateSummary(input: {
    actor: Member;
    current: SavedWorkView;
    updated: SavedWorkView;
    nameChanged: boolean;
    queryChanged: boolean;
  }): string {
    if (input.nameChanged && input.queryChanged) {
      return `${input.actor.name} updated shared view ${input.updated.name}.`;
    }

    if (input.nameChanged) {
      return `${input.actor.name} renamed shared view ${input.current.name} to ${input.updated.name}.`;
    }

    return `${input.actor.name} updated shared view ${input.updated.name} filters.`;
  }

  private async recordWorkspaceSavedViewActivity(input: {
    eventType: WorkspaceActivityEventType;
    savedView: SavedWorkView;
    actor: Member;
    summary: string;
    previousValue: Record<string, unknown> | null;
    newValue: Record<string, unknown> | null;
    timestamp: Date;
  }): Promise<void> {
    await this.context.repositories.workspaceActivityEvents.create({
      id: this.idGenerator(),
      workspaceId: input.savedView.workspaceId,
      actorId: input.actor.id,
      eventType: input.eventType,
      summary: input.summary,
      previousValue: input.previousValue,
      newValue: input.newValue,
      metadata: { savedViewId: input.savedView.id },
      createdAt: input.timestamp
    });
  }

  private savedViewActivityValue(savedView: SavedWorkView): Record<string, unknown> {
    return {
      savedViewId: savedView.id,
      name: savedView.name,
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
