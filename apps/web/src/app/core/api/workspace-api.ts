import { Injectable, inject } from '@angular/core';
import type {
  CreateMemberRequest,
  MemberDto,
  UpdateMemberRequest,
  UpdateWorkspaceRequest,
  WorkspaceActivityEventDto,
  WorkspaceCapabilitiesDto,
  WorkspaceDto
} from '@worktrail/contracts';
import type { Observable } from 'rxjs';

import { ApiClient } from './api-client';

@Injectable({ providedIn: 'root' })
export class WorkspaceApi {
  private readonly api = inject(ApiClient);

  getWorkspace(): Observable<WorkspaceDto> {
    return this.api.get<WorkspaceDto>('/workspace');
  }

  updateWorkspace(input: UpdateWorkspaceRequest): Observable<WorkspaceDto> {
    return this.api.patch<WorkspaceDto, UpdateWorkspaceRequest>('/workspace', input);
  }

  getWorkspaceCapabilities(): Observable<WorkspaceCapabilitiesDto> {
    return this.api.get<WorkspaceCapabilitiesDto>('/workspace/capabilities');
  }

  listWorkspaceActivity(): Observable<WorkspaceActivityEventDto[]> {
    return this.api.get<WorkspaceActivityEventDto[]>('/workspace/activity');
  }

  listMembers(): Observable<MemberDto[]> {
    return this.api.get<MemberDto[]>('/members');
  }

  createMember(input: CreateMemberRequest): Observable<MemberDto> {
    return this.api.post<MemberDto, CreateMemberRequest>('/members', input);
  }

  updateMember(memberId: string, input: UpdateMemberRequest): Observable<MemberDto> {
    return this.api.patch<MemberDto, UpdateMemberRequest>(`/members/${memberId}`, input);
  }

  deactivateMember(memberId: string): Observable<MemberDto> {
    return this.api.post<MemberDto>(`/members/${memberId}/deactivate`, {});
  }

  reactivateMember(memberId: string): Observable<MemberDto> {
    return this.api.post<MemberDto>(`/members/${memberId}/reactivate`, {});
  }
}
