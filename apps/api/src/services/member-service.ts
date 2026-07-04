import type { CreateMemberRequest, MemberDto, UpdateMemberRequest } from '@worktrail/contracts';
import { randomUUID } from 'node:crypto';

import type { WorktrailDb } from '../db/client.js';
import type { ActorContext } from '../domain/actor.js';
import { canManageMembers } from '../domain/permissions.js';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../errors/app-error.js';
import {
  type Repositories,
  withRepositoriesTransaction
} from '../repositories/index.js';
import type { Member } from '../repositories/types.js';
import { toMemberDto } from './dto.js';

export interface MemberServiceContext {
  actor: ActorContext;
  repositories: Repositories;
  db?: WorktrailDb;
  clock?: () => Date;
  idGenerator?: () => string;
}

export class MemberService {
  private readonly clock: () => Date;
  private readonly idGenerator: () => string;

  constructor(private readonly context: MemberServiceContext) {
    this.clock = context.clock ?? (() => new Date());
    this.idGenerator = context.idGenerator ?? randomUUID;
  }

  async listMembers(): Promise<MemberDto[]> {
    const members = await this.context.repositories.members.listByWorkspace(
      this.context.actor.workspaceId
    );
    return members.map(toMemberDto);
  }

  async createMember(input: CreateMemberRequest): Promise<MemberDto> {
    return this.withWriteRepositories(async (repositories) => {
      this.assertCanManageMembers();

      const name = this.normalizeName(input.name);
      const email = this.normalizeEmail(input.email);
      await this.requireAvailableEmail(email, undefined, repositories);

      const timestamp = this.clock();
      const member = await repositories.members.create({
        id: this.idGenerator(),
        workspaceId: this.context.actor.workspaceId,
        name,
        email,
        role: input.role,
        isActive: true,
        deactivatedAt: null,
        deactivatedById: null,
        createdAt: timestamp,
        updatedAt: timestamp
      });

      await repositories.workspaceActivityEvents.create({
        id: this.idGenerator(),
        workspaceId: this.context.actor.workspaceId,
        actorId: this.context.actor.memberId,
        eventType: 'member.created',
        summary: `${member.name} added to the workspace as ${member.role}.`,
        previousValue: null,
        newValue: { memberId: member.id, name: member.name, email: member.email, role: member.role },
        metadata: { memberId: member.id },
        createdAt: timestamp
      });

      return toMemberDto(member);
    });
  }

  async updateMember(memberId: string, input: UpdateMemberRequest): Promise<MemberDto> {
    return this.withWriteRepositories(async (repositories) => {
      this.assertCanManageMembers();
      const current = await this.requireMember(memberId, repositories);

      const nextName = input.name === undefined ? undefined : this.normalizeName(input.name);
      const nextEmail = input.email === undefined ? undefined : this.normalizeEmail(input.email);
      const nextRole = input.role;

      if (nextEmail !== undefined && nextEmail !== current.email) {
        await this.requireAvailableEmail(nextEmail, current.id, repositories);
      }

      if (nextRole !== undefined && nextRole !== current.role) {
        await this.assertCanChangeRole(current, nextRole, repositories);
      }

      const timestamp = this.clock();
      const updated = await repositories.members.update(memberId, {
        ...(nextName === undefined ? {} : { name: nextName }),
        ...(nextEmail === undefined ? {} : { email: nextEmail }),
        ...(nextRole === undefined ? {} : { role: nextRole }),
        updatedAt: timestamp
      });

      if (updated === null) {
        throw new NotFoundError('Member not found.');
      }

      await this.recordMemberUpdateActivity(current, updated, timestamp, repositories);
      return toMemberDto(updated);
    });
  }

  async deactivateMember(memberId: string): Promise<MemberDto> {
    return this.withWriteRepositories(async (repositories) => {
      this.assertCanManageMembers();
      const current = await this.requireMember(memberId, repositories);

      if (!current.isActive) {
        return toMemberDto(current);
      }

      await this.assertCanDeactivate(current, repositories);

      const timestamp = this.clock();
      const deactivated = await repositories.members.update(memberId, {
        isActive: false,
        deactivatedAt: timestamp,
        deactivatedById: this.context.actor.memberId,
        updatedAt: timestamp
      });

      if (deactivated === null) {
        throw new NotFoundError('Member not found.');
      }

      await repositories.workspaceActivityEvents.create({
        id: this.idGenerator(),
        workspaceId: this.context.actor.workspaceId,
        actorId: this.context.actor.memberId,
        eventType: 'member.deactivated',
        summary: `${current.name} deactivated.`,
        previousValue: { isActive: current.isActive },
        newValue: {
          isActive: deactivated.isActive,
          deactivatedAt: deactivated.deactivatedAt?.toISOString() ?? null
        },
        metadata: { memberId: current.id },
        createdAt: timestamp
      });

      return toMemberDto(deactivated);
    });
  }

  async reactivateMember(memberId: string): Promise<MemberDto> {
    return this.withWriteRepositories(async (repositories) => {
      this.assertCanManageMembers();
      const current = await this.requireMember(memberId, repositories);

      if (current.isActive) {
        return toMemberDto(current);
      }

      const timestamp = this.clock();
      const reactivated = await repositories.members.update(memberId, {
        isActive: true,
        deactivatedAt: null,
        deactivatedById: null,
        updatedAt: timestamp
      });

      if (reactivated === null) {
        throw new NotFoundError('Member not found.');
      }

      await repositories.workspaceActivityEvents.create({
        id: this.idGenerator(),
        workspaceId: this.context.actor.workspaceId,
        actorId: this.context.actor.memberId,
        eventType: 'member.reactivated',
        summary: `${current.name} reactivated.`,
        previousValue: {
          isActive: current.isActive,
          deactivatedAt: current.deactivatedAt?.toISOString() ?? null
        },
        newValue: { isActive: reactivated.isActive, deactivatedAt: null },
        metadata: { memberId: current.id },
        createdAt: timestamp
      });

      return toMemberDto(reactivated);
    });
  }

  private async withWriteRepositories<T>(
    callback: (repositories: Repositories) => Promise<T>
  ): Promise<T> {
    if (this.context.db === undefined) {
      return callback(this.context.repositories);
    }

    return withRepositoriesTransaction(this.context.db, callback);
  }

  private assertCanManageMembers(): void {
    if (!canManageMembers(this.context.actor)) {
      throw new ForbiddenError('Only owners can manage workspace members.');
    }
  }

  private async requireMember(memberId: string, repositories: Repositories): Promise<Member> {
    const member = await repositories.members.findById(memberId);

    if (member === null || member.workspaceId !== this.context.actor.workspaceId) {
      throw new NotFoundError('Member not found.');
    }

    return member;
  }

  private normalizeName(name: string): string {
    const normalized = name.trim();

    if (normalized.length === 0) {
      throw new ValidationError('Member name is required.');
    }

    return normalized;
  }

  private normalizeEmail(email: string): string {
    const normalized = email.trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      throw new ValidationError('Member email must be a valid email address.');
    }

    return normalized;
  }

  private async requireAvailableEmail(
    email: string,
    currentMemberId: string | undefined,
    repositories: Repositories
  ): Promise<void> {
    const existing = await repositories.members.findByWorkspaceEmail(
      this.context.actor.workspaceId,
      email
    );

    if (existing !== null && existing.id !== currentMemberId) {
      throw new ConflictError('Member email is already in use.');
    }
  }

  private async assertCanChangeRole(
    current: Member,
    nextRole: Member['role'],
    repositories: Repositories
  ): Promise<void> {
    if (current.role === 'owner' && current.isActive && nextRole !== 'owner') {
      await this.assertAnotherActiveOwnerExists(repositories);
    }
  }

  private async assertCanDeactivate(current: Member, repositories: Repositories): Promise<void> {
    if (current.role === 'owner') {
      await this.assertAnotherActiveOwnerExists(repositories);
    }
  }

  private async assertAnotherActiveOwnerExists(repositories: Repositories): Promise<void> {
    const activeOwnerCount = await repositories.members.countActiveOwners(
      this.context.actor.workspaceId
    );

    if (activeOwnerCount <= 1) {
      throw new ConflictError('At least one active owner is required.');
    }
  }

  private async recordMemberUpdateActivity(
    current: Member,
    updated: Member,
    timestamp: Date,
    repositories: Repositories
  ): Promise<void> {
    if (current.name !== updated.name) {
      await repositories.workspaceActivityEvents.create({
        id: this.idGenerator(),
        workspaceId: this.context.actor.workspaceId,
        actorId: this.context.actor.memberId,
        eventType: 'member.name_changed',
        summary: `${current.name} renamed to ${updated.name}.`,
        previousValue: { name: current.name },
        newValue: { name: updated.name },
        metadata: { memberId: current.id },
        createdAt: timestamp
      });
    }

    if (current.email !== updated.email) {
      await repositories.workspaceActivityEvents.create({
        id: this.idGenerator(),
        workspaceId: this.context.actor.workspaceId,
        actorId: this.context.actor.memberId,
        eventType: 'member.email_changed',
        summary: `${updated.name} email changed.`,
        previousValue: { email: current.email },
        newValue: { email: updated.email },
        metadata: { memberId: current.id },
        createdAt: timestamp
      });
    }

    if (current.role !== updated.role) {
      await repositories.workspaceActivityEvents.create({
        id: this.idGenerator(),
        workspaceId: this.context.actor.workspaceId,
        actorId: this.context.actor.memberId,
        eventType: 'member.role_changed',
        summary: `${updated.name} role changed from ${current.role} to ${updated.role}.`,
        previousValue: { role: current.role },
        newValue: { role: updated.role },
        metadata: { memberId: current.id },
        createdAt: timestamp
      });
    }
  }
}
