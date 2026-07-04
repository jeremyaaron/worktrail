import { eq } from 'drizzle-orm';

import type { WorktrailDb } from '../db/client.js';
import { members } from '../db/schema.js';
import type { NewMember } from './types.js';

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

    async listByWorkspace(workspaceId: string) {
      return db.select().from(members).where(eq(members.workspaceId, workspaceId));
    }
  };
}

