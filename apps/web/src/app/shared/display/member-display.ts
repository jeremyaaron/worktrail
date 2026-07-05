import type { MemberDto } from '@worktrail/contracts';

export function memberDisplayName(member: Pick<MemberDto, 'isActive' | 'name'>): string {
  return member.isActive ? member.name : `${member.name} (inactive)`;
}
