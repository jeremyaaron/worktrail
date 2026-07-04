import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type {
  MemberDto,
  WorkspaceActivityEventDto,
  WorkspaceCapabilitiesDto,
  WorkspaceDto
} from '@worktrail/contracts';

import { CurrentUserService } from '../../core/current-user.service';
import { WorkspaceSettingsPageComponent } from './workspace-settings-page.component';

const workspaceId = '10000000-0000-4000-8000-000000000001';

const workspace: WorkspaceDto = {
  id: workspaceId,
  name: 'Worktrail Studio',
  createdAt: '2026-07-02T12:00:00.000Z',
  updatedAt: '2026-07-03T12:00:00.000Z'
};

const owner: MemberDto = {
  id: '10000000-0000-4000-8000-000000000101',
  workspaceId,
  name: 'Avery Owner',
  email: 'avery.owner@example.com',
  role: 'owner',
  isActive: true,
  deactivatedAt: null,
  createdAt: '2026-07-02T12:00:00.000Z',
  updatedAt: '2026-07-03T12:00:00.000Z'
};

const maintainer: MemberDto = {
  id: '10000000-0000-4000-8000-000000000102',
  workspaceId,
  name: 'Morgan Maintainer',
  email: 'morgan.maintainer@example.com',
  role: 'maintainer',
  isActive: true,
  deactivatedAt: null,
  createdAt: '2026-07-02T12:00:00.000Z',
  updatedAt: '2026-07-03T12:00:00.000Z'
};

const contributor: MemberDto = {
  id: '10000000-0000-4000-8000-000000000103',
  workspaceId,
  name: 'Casey Contributor',
  email: 'casey.contributor@example.com',
  role: 'contributor',
  isActive: true,
  deactivatedAt: null,
  createdAt: '2026-07-02T12:00:00.000Z',
  updatedAt: '2026-07-03T12:00:00.000Z'
};

const inactiveMember: MemberDto = {
  id: '10000000-0000-4000-8000-000000000104',
  workspaceId,
  name: 'Riley Former',
  email: 'riley.former@example.com',
  role: 'contributor',
  isActive: false,
  deactivatedAt: '2026-06-28T12:00:00.000Z',
  createdAt: '2026-07-02T12:00:00.000Z',
  updatedAt: '2026-07-03T12:00:00.000Z'
};

const ownerCapabilities: WorkspaceCapabilitiesDto = {
  actor: owner,
  canManageWorkspace: true,
  canManageMembers: true,
  canCreateProjects: true,
  canManageProjects: true,
  canManageMilestones: true,
  canManageLabels: true,
  canCreateWorkItems: true,
  roleSummary: {
    owner: 'Owners manage workspace settings and members.',
    maintainer: 'Maintainers manage projects and delivery artifacts.',
    contributor: 'Contributors manage assigned work.'
  }
};

const contributorCapabilities: WorkspaceCapabilitiesDto = {
  ...ownerCapabilities,
  actor: contributor,
  canManageWorkspace: false,
  canManageMembers: false,
  canCreateProjects: false,
  canManageProjects: false,
  canManageMilestones: false,
  canManageLabels: false
};

const workspaceActivity: WorkspaceActivityEventDto = {
  id: '10000000-0000-4000-8000-000000000701',
  workspaceId,
  actor: owner,
  eventType: 'workspace.name_changed',
  summary: 'Workspace renamed.',
  previousValue: { name: 'Old Workspace' },
  newValue: { name: workspace.name },
  metadata: {},
  createdAt: '2026-07-03T12:00:00.000Z'
};

function seedCurrentUser(member: MemberDto = owner) {
  const currentUser = TestBed.inject(CurrentUserService);
  currentUser.members.set([owner, maintainer, contributor]);
  currentUser.selectMember(member.id);
}

function setupWorkspacePage(input: {
  capabilities?: WorkspaceCapabilitiesDto;
  members?: MemberDto[];
  activity?: WorkspaceActivityEventDto[];
  actor?: MemberDto;
} = {}) {
  seedCurrentUser(input.actor ?? input.capabilities?.actor ?? owner);
  const fixture = TestBed.createComponent(WorkspaceSettingsPageComponent);
  const http = TestBed.inject(HttpTestingController);
  fixture.detectChanges();

  http.expectOne('/api/workspace').flush(workspace);
  http.expectOne('/api/workspace/capabilities').flush(input.capabilities ?? ownerCapabilities);
  http.expectOne('/api/members').flush(input.members ?? [owner, maintainer, inactiveMember]);
  http.expectOne('/api/workspace/activity').flush(input.activity ?? [workspaceActivity]);
  fixture.detectChanges();

  return { fixture, http };
}

describe('WorkspaceSettingsPageComponent', () => {
  beforeEach(async () => {
    localStorage.clear();

    await TestBed.configureTestingModule({
      imports: [WorkspaceSettingsPageComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])]
    }).compileComponents();
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  it('renders workspace settings, role summary, members, and activity', () => {
    const { fixture } = setupWorkspacePage();

    const compiled = fixture.nativeElement as HTMLElement;
    const rowInputValues = [...compiled.querySelectorAll<HTMLInputElement>('tbody input')].map(
      (input) => input.value
    );
    expect(compiled.textContent).toContain('Worktrail Studio');
    expect(compiled.textContent).toContain('Owners manage workspace settings and members.');
    expect(rowInputValues).toContain('Morgan Maintainer');
    expect(rowInputValues).toContain('Riley Former');
    expect(compiled.textContent).toContain('Inactive');
    expect(compiled.textContent).toContain('Workspace renamed.');
  });

  it('saves workspace name changes for owners', () => {
    const { fixture, http } = setupWorkspacePage();

    fixture.componentInstance.workspaceForm.setValue({ name: 'Renamed Workspace' });
    fixture.componentInstance.saveWorkspace();

    const patch = http.expectOne('/api/workspace');
    expect(patch.request.method).toBe('PATCH');
    expect(patch.request.body).toEqual({ name: 'Renamed Workspace' });
    patch.flush({
      ...workspace,
      name: 'Renamed Workspace',
      updatedAt: '2026-07-04T12:00:00.000Z'
    });
    http.expectOne('/api/workspace/activity').flush([workspaceActivity]);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Renamed Workspace');
    expect(compiled.textContent).toContain('Workspace saved.');
  });

  it('renders non-owner restrictions without member management controls', () => {
    const { fixture } = setupWorkspacePage({
      actor: contributor,
      capabilities: contributorCapabilities,
      members: [owner, contributor]
    });

    fixture.componentInstance.workspaceForm.setValue({ name: 'Blocked Rename' });
    fixture.componentInstance.saveWorkspace();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Only workspace owners can rename the workspace.');
    expect(compiled.textContent).toContain('Only workspace owners can manage members.');
    expect(compiled.textContent).toContain('Read only');
    expect(compiled.textContent).not.toContain('Create member');
  });

  it('shows member creation validation before posting', () => {
    const { fixture, http } = setupWorkspacePage();

    fixture.componentInstance.createMember();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Member name is required.');
    expect(compiled.textContent).toContain('Use a valid email address.');
    http.expectNone((request) => request.method === 'POST' && request.url === '/api/members');
  });

  it('creates, updates, deactivates, and reactivates members', () => {
    const { fixture, http } = setupWorkspacePage();

    fixture.componentInstance.memberForm.setValue({
      name: 'New Contributor',
      email: 'new.contributor@example.com',
      role: 'contributor'
    });
    fixture.componentInstance.createMember();

    const create = http.expectOne('/api/members');
    expect(create.request.method).toBe('POST');
    expect(create.request.body).toEqual({
      name: 'New Contributor',
      email: 'new.contributor@example.com',
      role: 'contributor'
    });
    const createdMember = {
      ...contributor,
      id: '10000000-0000-4000-8000-000000000105',
      name: 'New Contributor',
      email: 'new.contributor@example.com'
    };
    create.flush(createdMember);
    http.expectOne('/api/workspace/activity').flush([workspaceActivity]);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Member created.');

    fixture.componentInstance.updateMember(maintainer, 'Morgan Lead', 'morgan.lead@example.com', 'owner');
    const update = http.expectOne(`/api/members/${maintainer.id}`);
    expect(update.request.method).toBe('PATCH');
    expect(update.request.body).toEqual({
      name: 'Morgan Lead',
      email: 'morgan.lead@example.com',
      role: 'owner'
    });
    update.flush({ ...maintainer, name: 'Morgan Lead', email: 'morgan.lead@example.com', role: 'owner' });
    http.expectOne('/api/workspace/activity').flush([workspaceActivity]);

    fixture.componentInstance.requestLifecycle(maintainer, 'deactivate');
    fixture.componentInstance.confirmLifecycle(maintainer);
    const deactivate = http.expectOne(`/api/members/${maintainer.id}/deactivate`);
    expect(deactivate.request.method).toBe('POST');
    deactivate.flush({
      ...maintainer,
      isActive: false,
      deactivatedAt: '2026-07-04T12:00:00.000Z'
    });
    http.expectOne('/api/workspace/activity').flush([workspaceActivity]);

    fixture.componentInstance.requestLifecycle(inactiveMember, 'reactivate');
    fixture.componentInstance.confirmLifecycle(inactiveMember);
    const reactivate = http.expectOne(`/api/members/${inactiveMember.id}/reactivate`);
    expect(reactivate.request.method).toBe('POST');
    reactivate.flush({ ...inactiveMember, isActive: true, deactivatedAt: null });
    http.expectOne('/api/workspace/activity').flush([workspaceActivity]);
  });
});
