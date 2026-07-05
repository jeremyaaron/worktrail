# Worktrail v0.0.4 Technical Design

## Overview

Worktrail v0.0.4 adds the team governance layer needed to make the app feel like an administrable workspace rather than a fixed seeded demo:

- workspace settings;
- member create/edit/deactivate/reactivate;
- role changes with last-active-owner protection;
- inactive-member handling across actor selection, assignments, and historical display;
- server-derived local actor role resolution;
- workspace activity for administrative events;
- permission transparency through a small capabilities DTO and consistent UI copy;
- project creation polish, including optional explicit project keys.

The release should preserve the current architecture:

- Angular standalone components served locally and buildable as a static SPA;
- shared TypeScript contracts in `packages/contracts`;
- transport-neutral API endpoint handlers;
- local Express adapter;
- service/repository backend layering;
- Drizzle-managed Postgres schema and migrations;
- deterministic local seed data and e2e smoke coverage.

v0.0.4 should not add production authentication, invitations, custom roles, AWS infrastructure, or a generic permission framework.

## Design Decisions

- Add one workspace settings route at `/workspace/settings` for workspace details, member administration, role summary, and workspace activity.
- Add a new `workspace_activity_events` table instead of making existing project activity nullable. This avoids broad changes to project/work item activity queries and keeps workspace audit semantics explicit.
- Keep `members.is_active` for query simplicity and add `deactivated_at` / `deactivated_by_id` for current lifecycle state.
- Keep member deactivation reversible. Reactivation clears `deactivated_at` and `deactivated_by_id`.
- Enforce last-active-owner protection server-side inside a transaction that locks the workspace row before owner-sensitive changes.
- Preserve existing inactive assignees/reporters historically, but block assigning inactive members to new work or changing assignment to an inactive member.
- Allow work item updates to preserve the current inactive assignee by omitting `assigneeId` or sending the same current inactive member ID.
- Add a small server-derived `WorkspaceCapabilitiesDto` rather than relying entirely on duplicated frontend role logic.
- Keep local actor selection, but derive the actor role from the member record on the server. The API should ignore `x-worktrail-role` for protected routes after v0.0.4.
- Reject inactive local actors at the API boundary with a clear `403` error.
- Keep project creation on the Projects page. Add optional project key input and permission-aware UI there rather than building a separate first-run wizard.
- Use inline confirmation for member deactivation/reactivation. Role and profile edits use explicit save buttons.
- Add workspace name editing because the existing `workspaces` table already supports it and it improves the settings surface with low product risk.

## Data Model Changes

### Members

Extend `members`:

```text
deactivated_at timestamptz null
deactivated_by_id uuid null references members(id)
```

Keep existing:

```text
is_active boolean not null default true
```

Semantics:

- `is_active = true` means the member can be selected as a local actor and can be assigned to new work.
- `is_active = false` means the member is historical/readable but cannot act or receive new assignments.
- `deactivated_at` and `deactivated_by_id` describe the current inactive state only.
- Reactivation sets `is_active = true`, `deactivated_at = null`, and `deactivated_by_id = null`.
- Existing seed data should set deactivation metadata for the inactive historical member.

Repository additions:

```ts
members.update(memberId, patch)
members.findByWorkspaceEmail(workspaceId, email)
members.countActiveOwners(workspaceId)
members.listActiveByWorkspace(workspaceId)
members.lockWorkspaceForMemberMutation(workspaceId)
```

`lockWorkspaceForMemberMutation` can live on the workspace repository instead if that better matches the implementation. The important detail is that last-owner checks run in a transaction while the workspace row is locked.

### Workspace Activity Events

Add `workspace_activity_events`:

```text
id uuid primary key
workspace_id uuid not null references workspaces(id)
actor_id uuid not null references members(id)
event_type text not null
summary text not null
previous_value jsonb null
new_value jsonb null
metadata jsonb not null default '{}'
created_at timestamptz not null
```

Constraints and indexes:

```text
workspace_activity_events_event_type_check event_type in (...)
workspace_activity_events_workspace_id_created_at_idx (workspace_id, created_at desc)
workspace_activity_events_actor_id_idx (actor_id)
```

Workspace activity event types:

```text
member.created
member.name_changed
member.email_changed
member.role_changed
member.deactivated
member.reactivated
workspace.name_changed
project.created
```

Rules:

- Member profile updates can create separate activity events for name and email changes.
- Role changes create one `member.role_changed` event.
- Deactivation/reactivation create lifecycle events.
- Workspace name changes create `workspace.name_changed`.
- Project creation records `project.created` in workspace activity and keeps any existing project-level behavior unchanged.

### Workspaces

No table change is required for workspace name editing. Add repository methods:

```ts
workspaces.findById(workspaceId)
workspaces.update(workspaceId, patch)
```

## Contract Changes

Extend `MemberDto`:

```ts
export interface MemberDto {
  id: string;
  workspaceId: string;
  name: string;
  email: string;
  role: MemberRole;
  isActive: boolean;
  deactivatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
```

Add member administration requests:

```ts
export interface CreateMemberRequest {
  name: string;
  email: string;
  role: MemberRole;
}

export interface UpdateMemberRequest {
  name?: string;
  email?: string;
  role?: MemberRole;
}
```

Add workspace contracts:

```ts
export interface WorkspaceDto {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateWorkspaceRequest {
  name: string;
}
```

Add workspace capabilities:

```ts
export interface WorkspaceCapabilitiesDto {
  actor: MemberDto;
  canManageWorkspace: boolean;
  canManageMembers: boolean;
  canCreateProjects: boolean;
  canManageProjects: boolean;
  canManageMilestones: boolean;
  canManageLabels: boolean;
  canCreateWorkItems: boolean;
  roleSummary: {
    owner: string;
    maintainer: string;
    contributor: string;
  };
}
```

The capabilities DTO is intentionally small. It should not become a field-level authorization map in v0.0.4.

Add workspace activity DTO:

```ts
export type WorkspaceActivityEventType =
  | 'member.created'
  | 'member.name_changed'
  | 'member.email_changed'
  | 'member.role_changed'
  | 'member.deactivated'
  | 'member.reactivated'
  | 'workspace.name_changed'
  | 'project.created';

export interface WorkspaceActivityEventDto {
  id: string;
  workspaceId: string;
  actor: MemberDto;
  eventType: WorkspaceActivityEventType;
  summary: string;
  previousValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}
```

Existing work item and activity DTOs continue to embed inactive members as normal `MemberDto` objects. UI can render inactive state from `isActive`.

## API Design

### Actor Resolution

Current behavior accepts `x-worktrail-role` from the frontend. v0.0.4 should replace that for protected routes.

New behavior:

- The frontend sends `x-worktrail-workspace-id` and `x-worktrail-member-id`.
- The Express adapter or endpoint adapter loads the member by ID.
- The adapter verifies:
  - member exists;
  - member belongs to the requested workspace;
  - member is active.
- The adapter builds `ActorContext` from the database member:

```ts
{
  workspaceId: member.workspaceId,
  memberId: member.id,
  role: member.role
}
```

- `x-worktrail-role` may be removed from the frontend request headers. If left temporarily for compatibility, the server ignores it.
- Health remains unauthenticated.
- `GET /members` remains protected by default actor resolution, but returns enough active members for local actor selection. If the selected stored actor becomes inactive, the frontend should call this endpoint with the current/fallback seed actor or a new bootstrap path may be used as described below.

Bootstrap concern:

- Because local actor selection needs members before choosing a member, `GET /api/members` can remain local-bootstrap friendly in v0.0.4 by resolving the default seed actor when no member header is present.
- If a header is present and that member is inactive, reject the request. The frontend should clear the stale selection and retry without member headers.

### Workspace Endpoints

```text
GET   /api/workspace
PATCH /api/workspace
GET   /api/workspace/capabilities
GET   /api/workspace/activity
```

Behavior:

- `GET /workspace` returns the current actor workspace.
- `PATCH /workspace` updates workspace name. Owner only.
- `GET /workspace/capabilities` returns the current actor capabilities.
- `GET /workspace/activity` returns recent workspace activity newest first.

### Member Endpoints

Extend `apps/api/src/endpoints/members.ts`:

```text
GET  /api/members
POST /api/members
PATCH /api/members/:memberId
POST /api/members/:memberId/deactivate
POST /api/members/:memberId/reactivate
```

Behavior:

- `GET /members` returns all members in the workspace by default, including inactive members, because historical assignment/filter UI needs them.
- The frontend can derive active choices from `isActive`.
- `POST /members` is owner-only.
- `PATCH /members/:memberId` is owner-only.
- Deactivate/reactivate are owner-only.
- Duplicate email checks are case-insensitive within the workspace.
- The service normalizes emails by trimming and lowercasing before storage.
- Member names are trimmed and required.
- Last-active-owner protection applies to:
  - changing the only active owner to another role;
  - deactivating the only active owner.

Suggested error messages:

```text
Only owners can manage workspace members.
At least one active owner is required.
Member email is already in use.
Inactive members cannot act in this workspace.
Member not found.
```

### Project Endpoints

Existing project creation already supports optional `key`. v0.0.4 should enforce role checks:

- `POST /api/projects` owner or maintainer only.
- `PATCH /api/projects/:projectId` existing owner/maintainer behavior remains.

When a project is created, record `project.created` in workspace activity:

```json
{
  "projectId": "uuid",
  "projectKey": "WT"
}
```

## Backend Service Design

### MemberService

Expand `MemberService`:

```ts
listMembers(): Promise<MemberDto[]>
createMember(input: CreateMemberRequest): Promise<MemberDto>
updateMember(memberId: string, input: UpdateMemberRequest): Promise<MemberDto>
deactivateMember(memberId: string): Promise<MemberDto>
reactivateMember(memberId: string): Promise<MemberDto>
```

Validation:

- `canManageMembers(actor)` must require active owner.
- The actor is already active if adapter resolution succeeded.
- Name is required after trim.
- Email is required, normalized, and simple validated.
- Role must be a known `MemberRole`.
- Target member must belong to actor workspace.
- Role demotion and deactivation perform last-owner checks transactionally.

Activity:

- Member creation records `member.created`.
- Name/email update records one event per changed field.
- Role update records `member.role_changed`.
- Deactivation records `member.deactivated`.
- Reactivation records `member.reactivated`.

### WorkspaceService

Add `WorkspaceService`:

```ts
getWorkspace(): Promise<WorkspaceDto>
updateWorkspace(input: UpdateWorkspaceRequest): Promise<WorkspaceDto>
getCapabilities(): Promise<WorkspaceCapabilitiesDto>
listWorkspaceActivity(): Promise<WorkspaceActivityEventDto[]>
```

Rules:

- Workspace name update is owner-only.
- Workspace name must be non-empty after trim.
- Capabilities are derived from the server-side actor role.
- Activity list resolves actor members using the member repository.

### ProjectService

Update `createProject`:

- Require `canCreateProject(actor)` where owner and maintainer pass.
- Keep explicit/generated key behavior.
- Record workspace activity `project.created`.

## Permission Model

Add domain helpers:

```ts
canManageWorkspace(actor): boolean // owner
canManageMembers(actor): boolean // owner
canCreateProject(actor): boolean // owner or maintainer
canManageProject(actor): boolean // existing owner or maintainer
canAssignMemberToWork(member): boolean // active only
```

`ActorContext` does not need an `isActive` flag if inactive actors are rejected at the adapter boundary. For unit tests that instantiate services directly, test helpers should create active actors explicitly.

The frontend should use `WorkspaceCapabilitiesDto` for global affordances:

- Workspace settings form enabled only for owners.
- Member create/edit/deactivate/reactivate controls enabled only for owners.
- Project create form enabled for owners and maintainers.

Project-specific archived/read-only logic remains local to project/work item pages because it depends on loaded project state, not only actor capabilities.

## Inactive Member Rules

### Actor Selection

`CurrentUserService` should maintain:

```ts
readonly members = signal<MemberDto[]>([]);
readonly activeMembers = computed(() => members().filter((member) => member.isActive));
readonly selectedMember = computed(() => selected active member fallback)
```

Selection fallback order:

1. Stored selected member if active.
2. First active owner.
3. First active member.
4. `null`.

If an API request returns inactive actor authorization failure, the UI should clear the selected member, reload members, and show a concise error.

### Assignment Controls

Create work item:

- Assignee dropdown shows active members only.
- API rejects inactive `assigneeId`.

Edit work item:

- Assignee dropdown shows active members plus current inactive assignee if one exists.
- Preserving current inactive assignee is allowed.
- Changing to any other inactive assignee is rejected.

Filters:

- Assignee and reporter filters show active members by default.
- If URL query contains an inactive member ID, display it as an active filter label using the full member list.

Historical display:

- List, board, detail, comments, and activity display inactive member names normally with a subtle `Inactive` marker where space allows.

## Frontend Design

### Navigation

Update `app.html`:

- Add global link to `/workspace/settings` labeled `Workspace`.
- Actor selector options use `currentUser.activeMembers()`.
- Option text remains compact: `Name · role`.
- Current role remains visible in the selector text.

### Workspace Settings Page

Add `WorkspaceSettingsPageComponent` at `/workspace/settings`.

Layout:

- Page header: `Workspace settings`.
- Workspace details panel:
  - name input;
  - owner-only save button;
  - disabled/helper text for non-owners.
- Role summary panel:
  - three concise role descriptions.
- Members panel:
  - create member form;
  - member table/list;
  - inline edit state per member or one selected edit row;
  - deactivate/reactivate inline confirmation.
- Workspace activity panel:
  - recent activity rows.

Responsive behavior:

- Desktop: details/role summary in a narrow side column, members/activity in the main column.
- Narrow widths: stack panels; member row actions wrap without overflow.

Do not use nested cards. Panels can use the same border/background style as existing settings pages.

### Projects Page

Update `ProjectListPageComponent`:

- Add optional project key input.
- Show key format helper: `2-8 uppercase letters or numbers. Leave blank to generate.`
- Normalize display client-side as the user types if straightforward, but keep server authoritative.
- Disable create form for contributors using `WorkspaceCapabilitiesDto`.
- Show helper text: `Owners and maintainers can create projects.`
- After creation, reset form and keep the project visible in the list. Navigation to the new project can be a clear link or automatic route; prefer a clear success state plus immediate list update for v0.0.4.

### Existing Work Item Pages

Update member option helpers in create/detail/list pages:

- `assignableMembers = active members`.
- Detail page includes current inactive assignee in assignment options.
- Filter label lookup uses all members.
- Add subtle inactive marker in display helpers where useful, for example `Avery Owner (inactive)`.

## Routing

Add Angular route:

```ts
{
  path: 'workspace/settings',
  component: WorkspaceSettingsPageComponent,
  title: 'Workspace Settings | Worktrail'
}
```

Add Express routes:

```ts
app.get('/api/workspace', ...)
app.patch('/api/workspace', ...)
app.get('/api/workspace/capabilities', ...)
app.get('/api/workspace/activity', ...)
app.post('/api/members', ...)
app.patch('/api/members/:memberId', ...)
app.post('/api/members/:memberId/deactivate', ...)
app.post('/api/members/:memberId/reactivate', ...)
```

## Migration And Seed Data

Migration steps:

1. Add `members.deactivated_at`.
2. Add `members.deactivated_by_id`.
3. Create `workspace_activity_events`.
4. Add indexes/check constraints.
5. Preserve existing `is_active` values.
6. Backfill `deactivated_at` for any existing inactive members if needed. Local seed can own deterministic values.

Seed updates:

- Keep owner, maintainer, contributor.
- Add one inactive historical member.
- Assign at least one seeded work item or comment/activity reference to inactive member if useful for UI demonstration.
- Add workspace activity rows for representative member lifecycle events and project creation.
- Keep deterministic IDs and timestamps.

## Testing Strategy

### Backend Tests

Add or expand tests for:

- member creation by owner;
- member creation rejected for maintainer/contributor;
- duplicate email conflict;
- member name/email update;
- role update;
- deactivation/reactivation;
- last active owner demotion blocked;
- last active owner deactivation blocked;
- inactive actor rejected by adapter or service boundary;
- project creation rejected for contributor;
- project creation records workspace activity;
- workspace name update owner-only;
- workspace activity list resolves actors and orders newest first;
- inactive assignee rejected for new work;
- current inactive assignee can be preserved on edit.

### Frontend Unit Tests

Add tests for:

- workspace settings page loading workspace, members, capabilities, and activity;
- owner can see member create/edit controls;
- maintainer/contributor see owner-required helper instead of controls;
- create member form validation;
- deactivate/reactivate confirmation state;
- actor selector excludes inactive members;
- selected inactive member fallback;
- project creation key field and contributor disabled state;
- work item assignment controls exclude inactive members except current inactive assignee on detail.

### E2E Smoke

Extend Playwright:

- open workspace settings;
- create a contributor;
- confirm the member appears in actor selector;
- promote the member to maintainer;
- switch to the maintainer and confirm project creation is available;
- switch back to owner;
- deactivate and reactivate the member;
- confirm workspace activity entries;
- create a project with explicit key;
- run one existing v0.0.3 planning path to ensure no regression.

## Error Handling

Use existing `AppError` types:

- `ValidationError` for malformed input.
- `ForbiddenError` for insufficient role, inactive actor, or project creation by contributor.
- `ConflictError` for duplicate email and last-owner violations.
- `NotFoundError` for missing workspace/member or cross-workspace access.

Preferred user-facing messages:

```text
Only owners can manage workspace members.
Only owners can update workspace settings.
Owners and maintainers can create projects.
At least one active owner is required.
Member email is already in use.
Inactive members cannot act in this workspace.
Inactive members cannot be assigned to new work.
Project key must be 2-8 uppercase letters or numbers.
```

## Cloud Readiness

v0.0.4 remains local-first. The design still supports later cloud deployment:

- endpoint handlers stay transport-neutral;
- role/capability logic lives in backend services and domain helpers;
- workspace activity uses a normal repository/service boundary;
- server-side actor resolution can later be replaced by auth claims mapped to members;
- Angular remains a static-build SPA.

Future auth can replace local member headers with identity-provider claims without changing member lifecycle, role governance, workspace activity, or permission-aware UI concepts.

## Documentation Updates

Phase 12 should update:

- `README.md` for workspace/team governance, local actor caveats, and demo walkthrough;
- `site/index.html` for v0.0.4 team administration and permission transparency;
- `docs/v0.0.4/jawstack-extraction-notes.md` for:
  - local actor to real auth seam;
  - role governance;
  - last-owner safety;
  - inactive historical identity display;
  - workspace-scoped activity;
  - server-derived capabilities.

## Resolved Open Decisions

- Workspace activity uses a new `workspace_activity_events` table.
- Members keep `isActive` and gain `deactivatedAt` / `deactivatedById`.
- Existing inactive assignments can be preserved on edit; new inactive assignments are blocked.
- The API exposes a small `WorkspaceCapabilitiesDto`.
- Workspace settings and team administration use one route: `/workspace/settings`.
- Project creation remains on the Projects page.
- Member lifecycle commands use inline confirmation for deactivate/reactivate and explicit save for profile/role edits.
