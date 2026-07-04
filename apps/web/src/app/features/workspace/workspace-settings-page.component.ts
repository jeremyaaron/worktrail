import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import type {
  MemberDto,
  MemberRole,
  WorkspaceActivityEventDto,
  WorkspaceCapabilitiesDto,
  WorkspaceDto
} from '@worktrail/contracts';

import { CurrentUserService } from '../../core/current-user.service';
import { WorktrailApiService } from '../../core/worktrail-api.service';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { ErrorPanelComponent } from '../../shared/ui/error-panel.component';
import { LoadingIndicatorComponent } from '../../shared/ui/loading-indicator.component';

type LifecycleAction = 'deactivate' | 'reactivate';

@Component({
  selector: 'app-workspace-settings-page',
  imports: [EmptyStateComponent, ErrorPanelComponent, LoadingIndicatorComponent, ReactiveFormsModule],
  template: `
    <section class="page-header">
      <div>
        <p class="eyebrow">Workspace</p>
        <h1>{{ workspace()?.name ?? 'Workspace settings' }}</h1>
        @if (capabilities(); as capabilities) {
          <p class="header-copy">{{ capabilities.actor.name }} is acting as {{ capabilities.actor.role }}.</p>
        }
      </div>
    </section>

    @if (isLoading()) {
      <app-loading-indicator label="Loading workspace settings" />
    } @else if (loadError()) {
      <app-error-panel [message]="loadError() ?? ''" (retry)="loadAll()" />
    } @else {
      <section class="settings-grid">
        <section class="panel" aria-labelledby="workspace-name-heading">
          <div>
            <h2 id="workspace-name-heading">Workspace name</h2>
            @if (canManageWorkspace()) {
              <p>Name changes are visible to everyone in this workspace.</p>
            } @else {
              <p>Only workspace owners can rename the workspace.</p>
            }
          </div>

          <form [formGroup]="workspaceForm" (ngSubmit)="saveWorkspace()" novalidate>
            <label for="workspace-name">Name</label>
            <input
              id="workspace-name"
              type="text"
              formControlName="name"
              autocomplete="off"
              [readonly]="!canManageWorkspace()"
              [attr.aria-invalid]="showWorkspaceNameError()"
              aria-describedby="workspace-name-error"
            />
            @if (showWorkspaceNameError()) {
              <p id="workspace-name-error" class="field-error">Workspace name is required.</p>
            }

            @if (workspaceSaveError()) {
              <app-error-panel
                title="Workspace not saved"
                [message]="workspaceSaveError() ?? ''"
                (retry)="saveWorkspace()"
              />
            }

            @if (workspaceSaveSuccess()) {
              <p class="success-message">Workspace saved.</p>
            }

            <button type="submit" [disabled]="!canManageWorkspace() || isSavingWorkspace()">
              {{ isSavingWorkspace() ? 'Saving...' : 'Save workspace' }}
            </button>
          </form>
        </section>

        <section class="panel" aria-labelledby="role-summary-heading">
          <div>
            <h2 id="role-summary-heading">Role summary</h2>
            <p>Workspace permissions are derived from the selected active member.</p>
          </div>

          @if (capabilities(); as capabilities) {
            <dl class="role-list">
              <div>
                <dt>Owner</dt>
                <dd>{{ capabilities.roleSummary.owner }}</dd>
              </div>
              <div>
                <dt>Maintainer</dt>
                <dd>{{ capabilities.roleSummary.maintainer }}</dd>
              </div>
              <div>
                <dt>Contributor</dt>
                <dd>{{ capabilities.roleSummary.contributor }}</dd>
              </div>
            </dl>
          }
        </section>

        <section class="panel member-panel" aria-labelledby="members-heading">
          <div class="panel-heading">
            <div>
              <h2 id="members-heading">Members</h2>
              @if (canManageMembers()) {
                <p>Create members, update roles, and manage active status.</p>
              } @else {
                <p>Only workspace owners can manage members.</p>
              }
            </div>
          </div>

          @if (canManageMembers()) {
            <form class="member-create-form" [formGroup]="memberForm" (ngSubmit)="createMember()" novalidate>
              <label for="member-name">Name</label>
              <input
                id="member-name"
                type="text"
                formControlName="name"
                autocomplete="off"
                [attr.aria-invalid]="showMemberNameError()"
                aria-describedby="member-name-error"
              />
              @if (showMemberNameError()) {
                <p id="member-name-error" class="field-error">Member name is required.</p>
              }

              <label for="member-email">Email</label>
              <input
                id="member-email"
                type="email"
                formControlName="email"
                autocomplete="off"
                [attr.aria-invalid]="showMemberEmailError()"
                aria-describedby="member-email-error"
              />
              @if (showMemberEmailError()) {
                <p id="member-email-error" class="field-error">Use a valid email address.</p>
              }

              <label for="member-role">Role</label>
              <select id="member-role" formControlName="role">
                <option value="contributor">Contributor</option>
                <option value="maintainer">Maintainer</option>
                <option value="owner">Owner</option>
              </select>

              <button type="submit" [disabled]="isMemberMutating()">
                {{ isMemberMutating() ? 'Creating...' : 'Create member' }}
              </button>
            </form>
          }

          @if (memberMutationError()) {
            <app-error-panel
              title="Member change failed"
              [message]="memberMutationError() ?? ''"
              (retry)="loadMembersAndActivity()"
            />
          }

          @if (memberSuccess()) {
            <p class="success-message">{{ memberSuccess() }}</p>
          }

          @if (members().length === 0) {
            <app-empty-state title="No members" message="Members will appear here after they are added." />
          } @else {
            <div class="member-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  @for (member of sortedMembers(); track member.id) {
                    <tr [class.member-row--inactive]="!member.isActive">
                      <td>
                        <input
                          #memberName
                          type="text"
                          [value]="member.name"
                          [readonly]="!canManageMembers()"
                          [disabled]="isMemberMutating()"
                        />
                      </td>
                      <td>
                        <input
                          #memberEmail
                          type="email"
                          [value]="member.email"
                          [readonly]="!canManageMembers()"
                          [disabled]="isMemberMutating()"
                        />
                      </td>
                      <td>
                        <select #memberRole [value]="member.role" [disabled]="!canManageMembers() || isMemberMutating()">
                          <option value="owner">Owner</option>
                          <option value="maintainer">Maintainer</option>
                          <option value="contributor">Contributor</option>
                        </select>
                      </td>
                      <td>
                        <span class="status-chip" [class.status-chip--inactive]="!member.isActive">
                          {{ member.isActive ? 'Active' : 'Inactive' }}
                        </span>
                      </td>
                      <td>
                        @if (canManageMembers()) {
                          <div class="member-actions">
                            <button
                              type="button"
                              [disabled]="isMemberMutating()"
                              (click)="updateMember(member, memberName.value, memberEmail.value, memberRole.value)"
                            >
                              Save
                            </button>

                            @if (confirmMemberId() === member.id) {
                              <button
                                type="button"
                                class="danger-button"
                                [disabled]="isMemberMutating()"
                                (click)="confirmLifecycle(member)"
                              >
                                Confirm
                              </button>
                              <button type="button" [disabled]="isMemberMutating()" (click)="clearConfirmation()">
                                Cancel
                              </button>
                            } @else if (member.isActive) {
                              <button
                                type="button"
                                class="danger-button"
                                [disabled]="isMemberMutating()"
                                (click)="requestLifecycle(member, 'deactivate')"
                              >
                                Deactivate
                              </button>
                            } @else {
                              <button
                                type="button"
                                [disabled]="isMemberMutating()"
                                (click)="requestLifecycle(member, 'reactivate')"
                              >
                                Reactivate
                              </button>
                            }
                          </div>
                        } @else {
                          <span class="readonly-marker">Read only</span>
                        }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </section>

        <section class="panel activity-panel" aria-labelledby="workspace-activity-heading">
          <div>
            <h2 id="workspace-activity-heading">Workspace activity</h2>
            <p>Workspace and member administration changes appear here.</p>
          </div>

          @if (activityLoadError()) {
            <app-error-panel [message]="activityLoadError() ?? ''" (retry)="loadActivity()" />
          } @else if (activity().length === 0) {
            <app-empty-state title="No workspace activity" message="Workspace changes will appear here." />
          } @else {
            <ol class="activity-list">
              @for (event of activity(); track event.id) {
                <li>
                  <strong>{{ event.summary }}</strong>
                  <span>{{ event.actor.name }} - {{ formatEventType(event) }} - {{ formatDateTime(event.createdAt) }}</span>
                </li>
              }
            </ol>
          }
        </section>
      </section>
    }
  `,
  styles: `
    .page-header {
      display: flex;
      justify-content: space-between;
      gap: 20px;
      align-items: flex-start;
      margin-bottom: 22px;
    }

    .eyebrow {
      margin: 0 0 6px;
      color: #64748b;
      font-size: 0.75rem;
      font-weight: 800;
      letter-spacing: 0;
      text-transform: uppercase;
    }

    h1,
    h2,
    p {
      margin: 0;
    }

    h1 {
      color: #111827;
      font-size: 1.75rem;
      line-height: 1.2;
    }

    h2 {
      color: #111827;
      font-size: 1rem;
      line-height: 1.35;
    }

    .header-copy,
    .panel > div p {
      color: #64748b;
      font-size: 0.875rem;
      line-height: 1.5;
    }

    .settings-grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(280px, 360px);
      gap: 18px;
      align-items: start;
    }

    .panel {
      display: grid;
      gap: 16px;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 18px;
      background: #ffffff;
    }

    .member-panel,
    .activity-panel {
      grid-column: 1 / -1;
    }

    form {
      display: grid;
      gap: 10px;
    }

    .member-create-form {
      grid-template-columns: minmax(160px, 1fr) minmax(200px, 1.2fr) 160px auto;
      align-items: end;
    }

    label {
      color: #334155;
      font-size: 0.8125rem;
      font-weight: 800;
    }

    input,
    select {
      width: 100%;
      min-height: 38px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 8px 10px;
      background: #ffffff;
      color: #111827;
      font: inherit;
      font-size: 0.875rem;
    }

    input[readonly] {
      background: #f8fafc;
      color: #64748b;
    }

    input:focus,
    select:focus {
      border-color: #1d4ed8;
      outline: 2px solid #bfdbfe;
      outline-offset: 0;
    }

    button {
      min-height: 36px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 8px 12px;
      background: #ffffff;
      color: #1f2937;
      font: inherit;
      font-size: 0.875rem;
      font-weight: 800;
      cursor: pointer;
    }

    button:hover:not(:disabled) {
      border-color: #94a3b8;
      background: #f8fafc;
    }

    form > button {
      justify-self: start;
      border-color: #1f4f99;
      background: #1f4f99;
      color: #ffffff;
    }

    .member-create-form > button {
      justify-self: stretch;
    }

    button:disabled {
      cursor: not-allowed;
      opacity: 0.64;
    }

    .danger-button {
      border-color: #dc2626;
      color: #991b1b;
    }

    .field-error {
      color: #b91c1c;
      font-size: 0.8125rem;
    }

    .success-message {
      color: #166534;
      font-size: 0.875rem;
      font-weight: 800;
    }

    .role-list {
      display: grid;
      gap: 12px;
      margin: 0;
    }

    .role-list div {
      display: grid;
      gap: 3px;
    }

    dt {
      color: #334155;
      font-size: 0.8125rem;
      font-weight: 900;
      text-transform: uppercase;
    }

    dd {
      margin: 0;
      color: #64748b;
      font-size: 0.875rem;
      line-height: 1.5;
    }

    .member-table-wrap {
      overflow-x: auto;
    }

    table {
      width: 100%;
      min-width: 860px;
      border-collapse: collapse;
    }

    th,
    td {
      border-bottom: 1px solid #e5e7eb;
      padding: 10px;
      text-align: left;
      vertical-align: middle;
    }

    th {
      color: #475569;
      font-size: 0.75rem;
      font-weight: 900;
      text-transform: uppercase;
    }

    td {
      color: #111827;
      font-size: 0.875rem;
    }

    .member-row--inactive {
      background: #f8fafc;
    }

    .member-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .status-chip,
    .role-chip,
    .readonly-marker {
      display: inline-flex;
      align-items: center;
      min-height: 24px;
      border-radius: 999px;
      padding: 3px 9px;
      font-size: 0.75rem;
      font-weight: 900;
      text-transform: capitalize;
    }

    .status-chip {
      border: 1px solid #bbf7d0;
      background: #f0fdf4;
      color: #166534;
    }

    .status-chip--inactive {
      border-color: #e2e8f0;
      background: #f8fafc;
      color: #64748b;
    }

    .role-chip,
    .readonly-marker {
      border: 1px solid #bfdbfe;
      background: #eff6ff;
      color: #1e3a8a;
    }

    .activity-list {
      display: grid;
      gap: 10px;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .activity-list li {
      display: grid;
      gap: 5px;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 12px;
      background: #ffffff;
    }

    .activity-list strong {
      color: #334155;
      font-size: 0.875rem;
      line-height: 1.5;
    }

    .activity-list span {
      color: #64748b;
      font-size: 0.75rem;
      font-weight: 700;
    }

    @media (max-width: 900px) {
      .settings-grid,
      .member-create-form {
        grid-template-columns: 1fr;
      }

      .page-header {
        display: grid;
      }

      .member-create-form > button {
        justify-self: start;
      }
    }
  `
})
export class WorkspaceSettingsPageComponent implements OnInit {
  private readonly api = inject(WorktrailApiService);
  private readonly currentUser = inject(CurrentUserService);
  private readonly formBuilder = inject(FormBuilder);

  readonly workspace = signal<WorkspaceDto | null>(null);
  readonly capabilities = signal<WorkspaceCapabilitiesDto | null>(null);
  readonly members = signal<MemberDto[]>([]);
  readonly activity = signal<WorkspaceActivityEventDto[]>([]);
  readonly isLoading = signal(false);
  readonly isSavingWorkspace = signal(false);
  readonly isMemberMutating = signal(false);
  readonly hasSubmittedWorkspace = signal(false);
  readonly hasSubmittedMember = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly workspaceSaveError = signal<string | null>(null);
  readonly workspaceSaveSuccess = signal(false);
  readonly memberMutationError = signal<string | null>(null);
  readonly memberSuccess = signal<string | null>(null);
  readonly activityLoadError = signal<string | null>(null);
  readonly confirmMemberId = signal<string | null>(null);
  readonly confirmAction = signal<LifecycleAction | null>(null);

  readonly canManageWorkspace = computed(() => this.capabilities()?.canManageWorkspace === true);
  readonly canManageMembers = computed(() => this.capabilities()?.canManageMembers === true);
  readonly sortedMembers = computed(() => this.sortMembers(this.members()));

  readonly workspaceForm = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required]]
  });

  readonly memberForm = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    role: ['contributor' as MemberRole, [Validators.required]]
  });

  ngOnInit(): void {
    this.loadAll();
  }

  loadAll(): void {
    this.isLoading.set(true);
    this.loadError.set(null);
    this.api.getWorkspace().subscribe({
      next: (workspace) => {
        this.applyWorkspace(workspace);
        this.loadCapabilities();
        this.loadMembers();
        this.loadActivity();
        this.isLoading.set(false);
      },
      error: () => {
        this.loadError.set('Workspace settings could not be loaded from the API.');
        this.isLoading.set(false);
      }
    });
  }

  loadCapabilities(): void {
    this.api.getWorkspaceCapabilities().subscribe({
      next: (capabilities) => {
        this.capabilities.set(capabilities);
      },
      error: () => {
        this.loadError.set('Workspace permissions could not be loaded from the API.');
      }
    });
  }

  loadMembers(): void {
    this.api.listMembers().subscribe({
      next: (members) => {
        this.members.set(members);
        this.currentUser.members.set(members);
      },
      error: () => {
        this.loadError.set('Workspace members could not be loaded from the API.');
      }
    });
  }

  loadActivity(): void {
    this.activityLoadError.set(null);
    this.api.listWorkspaceActivity().subscribe({
      next: (activity) => {
        this.activity.set(activity);
      },
      error: () => {
        this.activityLoadError.set('Workspace activity could not be loaded from the API.');
      }
    });
  }

  loadMembersAndActivity(): void {
    this.loadMembers();
    this.loadActivity();
  }

  saveWorkspace(): void {
    this.hasSubmittedWorkspace.set(true);
    this.workspaceSaveError.set(null);
    this.workspaceSaveSuccess.set(false);

    if (!this.canManageWorkspace()) {
      this.workspaceSaveError.set('Only workspace owners can rename the workspace.');
      return;
    }

    if (this.workspaceForm.invalid) {
      this.workspaceForm.markAllAsTouched();
      return;
    }

    this.isSavingWorkspace.set(true);
    this.api.updateWorkspace({ name: this.workspaceForm.getRawValue().name.trim() }).subscribe({
      next: (workspace) => {
        this.applyWorkspace(workspace);
        this.loadActivity();
        this.isSavingWorkspace.set(false);
        this.hasSubmittedWorkspace.set(false);
        this.workspaceSaveSuccess.set(true);
      },
      error: () => {
        this.workspaceSaveError.set('Workspace could not be saved.');
        this.isSavingWorkspace.set(false);
      }
    });
  }

  createMember(): void {
    this.hasSubmittedMember.set(true);
    this.memberMutationError.set(null);
    this.memberSuccess.set(null);

    if (!this.canManageMembers()) {
      this.memberMutationError.set('Only workspace owners can manage members.');
      return;
    }

    if (this.memberForm.invalid) {
      this.memberForm.markAllAsTouched();
      return;
    }

    const formValue = this.memberForm.getRawValue();
    this.isMemberMutating.set(true);
    this.api
      .createMember({
        name: formValue.name.trim(),
        email: formValue.email.trim(),
        role: formValue.role
      })
      .subscribe({
        next: (member) => {
          this.upsertMember(member);
          this.loadActivity();
          this.memberForm.reset({ name: '', email: '', role: 'contributor' });
          this.hasSubmittedMember.set(false);
          this.isMemberMutating.set(false);
          this.memberSuccess.set('Member created.');
        },
        error: () => {
          this.memberMutationError.set('Member could not be created.');
          this.isMemberMutating.set(false);
        }
      });
  }

  updateMember(member: MemberDto, name: string, email: string, role: string): void {
    this.memberMutationError.set(null);
    this.memberSuccess.set(null);

    if (!this.canManageMembers()) {
      this.memberMutationError.set('Only workspace owners can manage members.');
      return;
    }

    const nextName = name.trim();
    const nextEmail = email.trim();

    if (nextName === '' || nextEmail === '') {
      this.memberMutationError.set('Member name and email are required.');
      return;
    }

    this.isMemberMutating.set(true);
    this.api
      .updateMember(member.id, {
        name: nextName,
        email: nextEmail,
        role: role as MemberRole
      })
      .subscribe({
        next: (updated) => {
          this.upsertMember(updated);
          this.loadActivity();
          this.isMemberMutating.set(false);
          this.memberSuccess.set('Member saved.');
        },
        error: () => {
          this.memberMutationError.set('Member could not be saved.');
          this.isMemberMutating.set(false);
        }
      });
  }

  requestLifecycle(member: MemberDto, action: LifecycleAction): void {
    this.confirmMemberId.set(member.id);
    this.confirmAction.set(action);
  }

  confirmLifecycle(member: MemberDto): void {
    const action = this.confirmAction();

    if (action === null) {
      return;
    }

    this.memberMutationError.set(null);
    this.memberSuccess.set(null);
    this.isMemberMutating.set(true);
    const request =
      action === 'deactivate'
        ? this.api.deactivateMember(member.id)
        : this.api.reactivateMember(member.id);

    request.subscribe({
      next: (updated) => {
        this.upsertMember(updated);
        this.loadActivity();
        this.clearConfirmation();
        this.isMemberMutating.set(false);
        this.memberSuccess.set(action === 'deactivate' ? 'Member deactivated.' : 'Member reactivated.');
      },
      error: () => {
        this.memberMutationError.set(
          action === 'deactivate' ? 'Member could not be deactivated.' : 'Member could not be reactivated.'
        );
        this.isMemberMutating.set(false);
      }
    });
  }

  clearConfirmation(): void {
    this.confirmMemberId.set(null);
    this.confirmAction.set(null);
  }

  showWorkspaceNameError(): boolean {
    const control = this.workspaceForm.controls.name;
    return control.invalid && (control.touched || this.hasSubmittedWorkspace());
  }

  showMemberNameError(): boolean {
    const control = this.memberForm.controls.name;
    return control.invalid && (control.touched || this.hasSubmittedMember());
  }

  showMemberEmailError(): boolean {
    const control = this.memberForm.controls.email;
    return control.invalid && (control.touched || this.hasSubmittedMember());
  }

  formatEventType(event: WorkspaceActivityEventDto): string {
    return event.eventType.replaceAll('.', ' ').replaceAll('_', ' ');
  }

  formatDateTime(value: string): string {
    return new Intl.DateTimeFormat('en', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    }).format(new Date(value));
  }

  private applyWorkspace(workspace: WorkspaceDto): void {
    this.workspace.set(workspace);
    this.workspaceForm.setValue({ name: workspace.name });
  }

  private upsertMember(member: MemberDto): void {
    const membersById = new Map(this.members().map((item) => [item.id, item]));
    membersById.set(member.id, member);
    const members = [...membersById.values()];
    this.members.set(members);
    this.currentUser.members.set(members);
  }

  private sortMembers(members: MemberDto[]): MemberDto[] {
    return [...members].sort((left, right) => {
      if (left.isActive !== right.isActive) {
        return left.isActive ? -1 : 1;
      }

      return left.name.localeCompare(right.name);
    });
  }
}
