import { and, eq, inArray, sql } from 'drizzle-orm';

import type { WorktrailDb } from '../db/client.js';
import { members } from '../db/schema.js';
import type { Member, NewMember } from './types.js';

export interface UpdateMemberInput {
  name?: string;
  email?: string;
  role?: Member['role'];
  isActive?: boolean;
  deactivatedAt?: Date | null;
  deactivatedById?: string | null;
  updatedAt: Date;
}

export function createMemberRepository(db: WorktrailDb) {
  return {
    async create(input: NewMember) {
      const [member] = await db.insert(members).values(input).returning();
      return member;
    },

    async findById(id: string) {
      const [member] = await db.select().from(members).where(eq(members.id, id)).limit(1);
      return member ?? null;
    },

    async findByWorkspaceEmail(workspaceId: string, email: string) {
      const [member] = await db
        .select()
        .from(members)
        .where(
          and(eq(members.workspaceId, workspaceId), sql`lower(${members.email}) = lower(${email})`)
        )
        .limit(1);
      return member ?? null;
    },

    async countActiveOwners(workspaceId: string) {
      const [row] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(members)
        .where(
          and(
            eq(members.workspaceId, workspaceId),
            eq(members.role, 'owner'),
            eq(members.isActive, true)
          )
        );
      return row?.count ?? 0;
    },

    async listByWorkspace(workspaceId: string) {
      return db.select().from(members).where(eq(members.workspaceId, workspaceId));
    },

    async listByIds(ids: string[]) {
      if (ids.length === 0) {
        return [];
      }

      return db.select().from(members).where(inArray(members.id, ids));
    },

    async update(id: string, input: UpdateMemberInput) {
      const [member] = await db.update(members).set(input).where(eq(members.id, id)).returning();
      return member ?? null;
    }
  };
}
