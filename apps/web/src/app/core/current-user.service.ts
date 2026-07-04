import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import type { MemberDto } from '@worktrail/contracts';

import { environment } from '../../environments/environment';

const selectedMemberStorageKey = 'worktrail.selectedMemberId';

@Injectable({ providedIn: 'root' })
export class CurrentUserService {
  private readonly http = inject(HttpClient);

  readonly members = signal<MemberDto[]>([]);
  readonly activeMembers = computed<MemberDto[]>(() => this.members().filter((member) => member.isActive));
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);
  readonly selectedMemberId = signal<string | null>(localStorage.getItem(selectedMemberStorageKey));

  readonly selectedMember = computed<MemberDto | null>(() => {
    const selectedId = this.selectedMemberId();
    const members = this.activeMembers();
    const selectedMember = members.find((member) => member.id === selectedId);

    if (selectedMember !== undefined) {
      return selectedMember;
    }

    return this.fallbackActiveMember(members);
  });

  loadMembers(): void {
    this.isLoading.set(true);
    this.error.set(null);

    this.http.get<MemberDto[]>(`${environment.apiBaseUrl}/members`).subscribe({
      next: (members) => {
        this.members.set(members);
        const currentSelection = this.selectedMemberId();
        const selectedMember = members.find((member) => member.id === currentSelection);
        const fallbackMember = this.fallbackActiveMember(members.filter((member) => member.isActive));

        if (selectedMember?.isActive === true) {
          this.selectMember(selectedMember.id);
        } else if (fallbackMember !== null) {
          this.selectMember(fallbackMember.id);
        } else {
          this.clearSelectedMember();
        }

        this.isLoading.set(false);
      },
      error: () => {
        this.error.set('Members could not be loaded from the API.');
        this.isLoading.set(false);
      }
    });
  }

  selectMember(memberId: string): void {
    const member = this.activeMembers().find((item) => item.id === memberId);

    if (member === undefined) {
      return;
    }

    this.selectedMemberId.set(member.id);
    localStorage.setItem(selectedMemberStorageKey, member.id);
  }

  actorHeaders(): Record<string, string> {
    const member = this.selectedMember();

    if (member === null) {
      return {};
    }

    return {
      'x-worktrail-workspace-id': member.workspaceId,
      'x-worktrail-member-id': member.id
    };
  }

  private fallbackActiveMember(members: MemberDto[]): MemberDto | null {
    return members.find((member) => member.role === 'owner') ?? members[0] ?? null;
  }

  private clearSelectedMember(): void {
    this.selectedMemberId.set(null);
    localStorage.removeItem(selectedMemberStorageKey);
  }
}
