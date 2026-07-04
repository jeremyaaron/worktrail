import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import type { MemberDto } from '@worktrail/contracts';

import { environment } from '../../environments/environment';

const selectedMemberStorageKey = 'worktrail.selectedMemberId';

@Injectable({ providedIn: 'root' })
export class CurrentUserService {
  private readonly http = inject(HttpClient);

  readonly members = signal<MemberDto[]>([]);
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);
  readonly selectedMemberId = signal<string | null>(localStorage.getItem(selectedMemberStorageKey));

  readonly selectedMember = computed<MemberDto | null>(() => {
    const selectedId = this.selectedMemberId();
    const members = this.members();
    const selectedMember = members.find((member) => member.id === selectedId);

    if (selectedMember !== undefined) {
      return selectedMember;
    }

    return members.length === 0 ? null : members[0];
  });

  loadMembers(): void {
    this.isLoading.set(true);
    this.error.set(null);

    this.http.get<MemberDto[]>(`${environment.apiBaseUrl}/members`).subscribe({
      next: (members) => {
        this.members.set(members);
        const currentSelection = this.selectedMemberId();

        if (members.length > 0 && !members.some((member) => member.id === currentSelection)) {
          this.selectMember(members[0].id);
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
    this.selectedMemberId.set(memberId);
    localStorage.setItem(selectedMemberStorageKey, memberId);
  }

  actorHeaders(): Record<string, string> {
    const member = this.selectedMember();

    if (member === null) {
      return {};
    }

    return {
      'x-worktrail-workspace-id': member.workspaceId,
      'x-worktrail-member-id': member.id,
      'x-worktrail-role': member.role
    };
  }
}
