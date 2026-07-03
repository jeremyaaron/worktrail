import type { MemberRole } from './constants.js';

export interface ActorContext {
  memberId: string;
  workspaceId: string;
  role: MemberRole;
}

export const localSeedActor: ActorContext = {
  memberId: '10000000-0000-4000-8000-000000000101',
  workspaceId: '10000000-0000-4000-8000-000000000001',
  role: 'owner'
};
