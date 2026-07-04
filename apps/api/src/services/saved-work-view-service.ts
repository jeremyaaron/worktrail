import type {
  CreateSavedWorkViewRequest,
  SavedWorkViewDto,
  UpdateSavedWorkViewRequest,
  WorkItemQuery
} from '@worktrail/contracts';
import { randomUUID } from 'node:crypto';

import type { ActorContext } from '../domain/actor.js';
import { ConflictError, NotFoundError, ValidationError } from '../errors/app-error.js';
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
    const [owner, savedViews] = await Promise.all([
      this.requireOwner(),
      this.context.repositories.savedWorkViews.listPersonal(
        this.context.actor.workspaceId,
        this.context.actor.memberId
      )
    ]);

    return savedViews.map((savedView) => toSavedWorkViewDto(savedView, owner));
  }

  async createSavedView(input: CreateSavedWorkViewRequest): Promise<SavedWorkViewDto> {
    const owner = await this.requireOwner();
    const name = this.normalizeName(input.name);
    await this.assertNameAvailable(name);
    const timestamp = this.clock();
    const query = normalizeWorkItemQuery(input.query);
    const savedView = await this.context.repositories.savedWorkViews.create({
      id: this.idGenerator(),
      workspaceId: this.context.actor.workspaceId,
      ownerMemberId: this.context.actor.memberId,
      name,
      visibility: 'personal',
      query: query as Record<string, unknown>,
      createdAt: timestamp,
      updatedAt: timestamp
    });

    return toSavedWorkViewDto(savedView, owner);
  }

  async updateSavedView(
    savedViewId: string,
    input: UpdateSavedWorkViewRequest
  ): Promise<SavedWorkViewDto> {
    const [owner, current] = await Promise.all([
      this.requireOwner(),
      this.requireOwnedSavedView(savedViewId)
    ]);
    const patch: { name?: string; query?: WorkItemQuery; updatedAt: Date } = {
      updatedAt: this.clock()
    };

    if (input.name !== undefined) {
      const name = this.normalizeName(input.name);

      if (name.toLowerCase() !== current.name.toLowerCase()) {
        await this.assertNameAvailable(name, current.id);
      }

      patch.name = name;
    }

    if (input.query !== undefined) {
      patch.query = normalizeWorkItemQuery(input.query);
    }

    const updated = await this.context.repositories.savedWorkViews.update(current.id, {
      ...(patch.name === undefined ? {} : { name: patch.name }),
      ...(patch.query === undefined ? {} : { query: patch.query as Record<string, unknown> }),
      updatedAt: patch.updatedAt
    });

    if (updated === null) {
      throw new NotFoundError('Saved view not found.');
    }

    return toSavedWorkViewDto(updated, owner);
  }

  async deleteSavedView(savedViewId: string): Promise<void> {
    const current = await this.requireOwnedSavedView(savedViewId);
    const deleted = await this.context.repositories.savedWorkViews.delete(current.id);

    if (deleted === null) {
      throw new NotFoundError('Saved view not found.');
    }
  }

  private async requireOwner(): Promise<Member> {
    const owner = await this.context.repositories.members.findById(this.context.actor.memberId);

    if (owner === null || owner.workspaceId !== this.context.actor.workspaceId) {
      throw new NotFoundError('Saved view owner not found.');
    }

    return owner;
  }

  private async requireOwnedSavedView(savedViewId: string): Promise<SavedWorkView> {
    const savedView = await this.context.repositories.savedWorkViews.findById(savedViewId);

    if (
      savedView === null ||
      savedView.workspaceId !== this.context.actor.workspaceId ||
      savedView.ownerMemberId !== this.context.actor.memberId
    ) {
      throw new NotFoundError('Saved view not found.');
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

  private async assertNameAvailable(name: string, currentSavedViewId?: string): Promise<void> {
    const existing = await this.context.repositories.savedWorkViews.findByOwnerAndName(
      this.context.actor.workspaceId,
      this.context.actor.memberId,
      name
    );

    if (existing !== null && existing.id !== currentSavedViewId) {
      throw new ConflictError('A saved view with this name already exists.');
    }
  }
}
