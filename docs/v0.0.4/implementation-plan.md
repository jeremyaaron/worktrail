# Worktrail v0.0.4 Implementation Plan

## Purpose

This plan turns the v0.0.4 PRD and technical design into sequential implementation phases. v0.0.4 should make Worktrail governable by a small team by adding workspace settings, member administration, server-derived actor roles, inactive-member handling, workspace activity, permission transparency, and project creation polish.

The release remains local-first. It should preserve the Angular static-hosting path, transport-neutral API handlers, Postgres migration discipline, deterministic seed data, and clean verification from a fresh checkout.

## Design Decisions

Use these decisions while implementing v0.0.4:

- Add one workspace settings route at `/workspace/settings`.
- Add a dedicated `workspace_activity_events` table.
- Keep `members.is_active` and add `deactivated_at` / `deactivated_by_id`.
- Keep member deactivation reversible.
- Enforce last-active-owner safety transactionally.
- Derive actor role server-side from the selected member record.
- Ignore or remove client-supplied `x-worktrail-role`.
- Reject inactive actors at the API boundary.
- Add a small `WorkspaceCapabilitiesDto`.
- Preserve existing inactive assignees on edit, but block new inactive assignments.
- Keep project creation on the Projects page and add explicit key polish there.
- Use inline confirmation for member deactivation/reactivation.
- Add workspace name editing.
- Keep production auth, invitations, custom roles, project-specific membership, AWS infrastructure, and generic permission frameworks out of scope.

## Phase Sizing

Each phase should leave the repository in a coherent working state. Prefer narrow vertical changes with targeted tests. If a phase starts combining schema changes, service behavior, endpoint changes, and a large UI surface, split it before continuing.

Because v0.0.4 touches actor resolution, member lifecycle, work item assignment, and multiple frontend surfaces, regression checks should be run more often than in a purely additive feature sprint.

## Phase 0: Baseline Planning

Goal: confirm v0.0.4 planning inputs and resolve implementation choices before code changes.

Scope:

- Confirm `docs/v0.0.4/prd.md` exists.
- Confirm `docs/v0.0.4/technical-design.md` exists.
- Confirm `docs/v0.0.4/implementation-plan.md` exists.
- Confirm design decisions listed above.
- Check repository status before implementation starts.
- Confirm the active branch and any staged changes.

Out of scope:

- Dependency changes.
- Schema changes.
- Feature implementation.

Acceptance criteria:

- The three v0.0.4 planning documents exist.
- No unresolved open decision blocks Phase 1.
- The worktree/index state is understood before implementation starts.

Suggested commands:

```sh
find docs/v0.0.4 -maxdepth 1 -type f | sort
git status --short --branch
```

Status:

- Completed on 2026-07-04.
- Confirmed `docs/v0.0.4/prd.md`, `docs/v0.0.4/technical-design.md`, and `docs/v0.0.4/implementation-plan.md` exist.
- Confirmed implementation decisions:
  - workspace settings use one route at `/workspace/settings`;
  - workspace audit uses a dedicated `workspace_activity_events` table;
  - members keep `is_active` and gain `deactivated_at` / `deactivated_by_id`;
  - member deactivation is reversible;
  - last-active-owner safety is enforced transactionally;
  - actor role is derived server-side from the selected member record;
  - client-supplied `x-worktrail-role` is ignored or removed;
  - inactive actors are rejected at the API boundary;
  - the API exposes a small `WorkspaceCapabilitiesDto`;
  - existing inactive assignees can be preserved on edit, while new inactive assignments are blocked;
  - project creation remains on the Projects page with explicit key polish;
  - member deactivate/reactivate uses inline confirmation;
  - workspace name editing is included;
  - production auth, invitations, custom roles, project-specific membership, AWS infrastructure, and generic permission frameworks stay out of scope.
- Confirmed current branch is `v0.0.4`.
- Confirmed current change state: `docs/v0.0.4/prd.md` and `docs/v0.0.4/technical-design.md` are staged; `docs/v0.0.4/implementation-plan.md` is unstaged.
- No unresolved open decision blocks Phase 1.

## Phase 1: Contracts, Schema, Migration, And Seed

Goal: establish the v0.0.4 data model and shared API shape.

Scope:

- Extend shared contracts:
  - `MemberDto` with `deactivatedAt`, `createdAt`, and `updatedAt`;
  - `CreateMemberRequest`;
  - `UpdateMemberRequest`;
  - `WorkspaceDto`;
  - `UpdateWorkspaceRequest`;
  - `WorkspaceCapabilitiesDto`;
  - `WorkspaceActivityEventType`;
  - `WorkspaceActivityEventDto`.
- Add backend domain constants for workspace activity event types.
- Extend Drizzle schema:
  - `members.deactivated_at`;
  - `members.deactivated_by_id`;
  - `workspace_activity_events`.
- Add workspace activity indexes and event-type check constraint.
- Update repository inferred types.
- Generate and review a Drizzle migration.
- Hand-edit migration SQL where needed for constraints, indexes, and deterministic inactive-member backfill.
- Update DTO mapping for extended member DTOs and workspace activity DTOs.
- Update seed data with:
  - one inactive historical member;
  - deactivation metadata;
  - at least one historical reference to inactive member if practical;
  - representative workspace activity rows.

Out of scope:

- Member mutation endpoints.
- Workspace settings UI.
- Server-side actor-role resolution.
- Assignment validation changes.

Acceptance criteria:

- Migration applies after local reset.
- Seed data demonstrates active and inactive members.
- Workspace activity seed rows are queryable.
- Contracts compile after temporary call-site updates as needed.

Suggested commands:

```sh
npm run db:generate
npm run db:reset
npm run db:migrate
npm run db:seed
npm run typecheck
npm test --workspace @worktrail/api
git diff --check
```

Status:

- Completed on 2026-07-04.
- Extended shared contracts with:
  - `MemberDto.deactivatedAt`, `MemberDto.createdAt`, and `MemberDto.updatedAt`;
  - `CreateMemberRequest`;
  - `UpdateMemberRequest`;
  - `WorkspaceDto`;
  - `UpdateWorkspaceRequest`;
  - `WorkspaceCapabilitiesDto`;
  - `WorkspaceActivityEventType`;
  - `WorkspaceActivityEventDto`.
- Added backend workspace activity event constants.
- Extended the Drizzle schema with:
  - `members.deactivated_at`;
  - `members.deactivated_by_id`;
  - `workspace_activity_events`;
  - workspace activity event type check constraint;
  - workspace activity workspace/timestamp and actor indexes.
- Generated migration `0003_overrated_hercules.sql` and hand-edited it to backfill `deactivated_at` for existing inactive members.
- Updated repository inferred types for workspace activity events.
- Updated DTO mapping for extended member DTOs, workspace DTOs, and workspace activity DTOs.
- Updated deterministic seed data with:
  - inactive historical member `Riley Former`;
  - deactivation metadata;
  - inactive member references on a seeded blocked work item and comment;
  - five representative workspace activity rows.
- Updated Angular test fixtures for the expanded `MemberDto` shape.
- Verified `npm run db:reset && npm run db:migrate && npm run db:seed`.
- Verified seeded inactive member and workspace activity counts with a direct database query.
- Verified `npm test --workspace @worktrail/api`.
- Verified `npm test`.
- Verified `npm run typecheck`.
- Verified `npm run build`.
- Verified `git diff --check`.

## Phase 2: Server-Derived Actor Resolution

Goal: make the local actor model less misleading by deriving role from the database and rejecting inactive actors.

Scope:

- Update actor resolution so protected API requests load the selected member by ID.
- Derive `ActorContext.role` from the member record.
- Ignore or remove `x-worktrail-role`.
- Verify selected member belongs to the selected workspace.
- Reject inactive selected members with `ForbiddenError`.
- Keep `GET /api/health` unauthenticated.
- Keep `GET /api/members` local-bootstrap friendly:
  - no actor header uses default seed actor;
  - inactive actor header is rejected.
- Update endpoint adapter or Express adapter signatures as needed to access repositories.
- Update API tests and test helpers that construct actor contexts.

Out of scope:

- Real authentication.
- Sessions, tokens, or identity provider claims.
- Frontend actor fallback behavior.

Acceptance criteria:

- API role spoofing through `x-worktrail-role` no longer works.
- Inactive actors cannot perform protected API actions.
- Existing API tests pass after test helper updates.
- Local app can still bootstrap member loading.

Suggested commands:

```sh
npm test --workspace @worktrail/api -- actor
npm test --workspace @worktrail/api
npm run typecheck --workspace @worktrail/api
```

## Phase 3: Workspace Backend

Goal: add workspace settings, capabilities, and workspace activity query support.

Scope:

- Add or expand `WorkspaceRepository`:
  - `findById`;
  - `update`;
  - row lock helper for future member safety checks if appropriate.
- Add `WorkspaceActivityEventRepository`:
  - `create`;
  - `findByWorkspace`.
- Add `WorkspaceService`:
  - `getWorkspace`;
  - `updateWorkspace`;
  - `getCapabilities`;
  - `listWorkspaceActivity`.
- Implement owner-only workspace name updates.
- Implement workspace activity DTO mapping and actor resolution.
- Add endpoint handlers:
  - `GET /api/workspace`;
  - `PATCH /api/workspace`;
  - `GET /api/workspace/capabilities`;
  - `GET /api/workspace/activity`.
- Wire Express routes.
- Add backend tests for workspace read/update, capabilities, activity ordering, activity actor mapping, and permissions.

Out of scope:

- Member lifecycle commands.
- Workspace settings Angular page.
- Project creation activity.

Acceptance criteria:

- Workspace name can be read and updated by owner.
- Maintainer/contributor cannot update workspace name.
- Capabilities reflect owner, maintainer, and contributor roles.
- Workspace activity returns newest first.

Suggested commands:

```sh
npm test --workspace @worktrail/api -- workspace
npm run typecheck --workspace @worktrail/api
```

## Phase 4: Member Administration Backend

Goal: implement member create/edit/deactivate/reactivate behavior and role safety.

Scope:

- Expand `MemberRepository`:
  - update;
  - find by workspace email;
  - count active owners;
  - list active by workspace if needed;
  - transactional helpers for last-owner checks.
- Expand `MemberService`:
  - `createMember`;
  - `updateMember`;
  - `deactivateMember`;
  - `reactivateMember`.
- Add owner-only member management permission helper.
- Normalize emails by trimming and lowercasing.
- Validate names, emails, and roles.
- Enforce duplicate email conflict case-insensitively.
- Enforce last-active-owner protection transactionally.
- Record workspace activity:
  - `member.created`;
  - `member.name_changed`;
  - `member.email_changed`;
  - `member.role_changed`;
  - `member.deactivated`;
  - `member.reactivated`.
- Add endpoint handlers:
  - `POST /api/members`;
  - `PATCH /api/members/:memberId`;
  - `POST /api/members/:memberId/deactivate`;
  - `POST /api/members/:memberId/reactivate`.
- Wire Express routes.
- Add backend tests for lifecycle, permissions, duplicate email, last-owner safety, and activity.

Out of scope:

- Frontend member management UI.
- Work item inactive-assignee policy.
- Real invitations or login.

Acceptance criteria:

- Owner can create, edit, deactivate, and reactivate members.
- Maintainer/contributor cannot manage members.
- Duplicate emails are rejected.
- Last active owner cannot be demoted or deactivated.
- Member lifecycle events are recorded in workspace activity.

Suggested commands:

```sh
npm test --workspace @worktrail/api -- members
npm run typecheck --workspace @worktrail/api
```

## Phase 5: Project Creation Governance

Goal: enforce project creation permissions and record workspace activity for project creation.

Scope:

- Add `canCreateProject(actor)` domain helper.
- Update `ProjectService.createProject` to require owner or maintainer.
- Record `project.created` workspace activity on successful project creation.
- Preserve explicit/generated key behavior.
- Add backend tests for:
  - owner project creation;
  - maintainer project creation;
  - contributor rejection;
  - invalid key validation;
  - duplicate key conflict;
  - workspace activity recording.

Out of scope:

- Project creation UI polish.
- First-run wizard.
- Project-specific membership.

Acceptance criteria:

- Contributors cannot create projects through the API.
- Owners and maintainers can create projects.
- Project creation writes workspace activity.
- Existing project metadata update behavior is unchanged.

Suggested commands:

```sh
npm test --workspace @worktrail/api -- projects
npm run typecheck --workspace @worktrail/api
```

## Phase 6: Inactive Member Assignment Policy

Goal: apply active/inactive member rules to work item assignment and display behavior.

Scope:

- Add backend helper for assignable members.
- Update work item create:
  - reject inactive `assigneeId`;
  - keep unassigned allowed.
- Update work item edit:
  - reject changing assignment to inactive member;
  - allow preserving current inactive assignee by omitting `assigneeId` or sending the same current inactive ID.
- Ensure reporter and historical actor display continues to work with inactive members.
- Update work item list/filter behavior only if backend filtering rejects inactive member IDs today.
- Add backend tests for:
  - create with inactive assignee rejected;
  - edit to inactive assignee rejected;
  - preserving current inactive assignee allowed;
  - historical DTOs include inactive member state.

Out of scope:

- Frontend assignment controls.
- Member administration UI.

Acceptance criteria:

- New inactive assignments are blocked by the API.
- Existing inactive assignments remain readable.
- Work item detail/list DTOs expose `isActive` on embedded members.
- Existing v0.0.3 planning and board behavior still passes backend tests.

Suggested commands:

```sh
npm test --workspace @worktrail/api -- work-items
npm run typecheck --workspace @worktrail/api
```

## Phase 7: Frontend API Client, Actor Selector, And Capabilities

Goal: update shared frontend services for workspace governance behavior before adding new screens.

Scope:

- Extend `WorktrailApiService` with:
  - workspace get/update;
  - workspace capabilities;
  - workspace activity;
  - member create/update/deactivate/reactivate.
- Remove `x-worktrail-role` from actor headers if safe; otherwise leave but rely on server ignoring it.
- Update `CurrentUserService`:
  - `activeMembers` computed signal;
  - selected active member fallback;
  - first active owner fallback;
  - stale inactive selection clearing.
- Update `app.html` actor selector to show active members only.
- Add global `Workspace` navigation link.
- Add or extend frontend tests for actor selector fallback and active-member filtering.

Out of scope:

- Workspace settings page implementation.
- Project creation UI updates.
- Work item assignment control updates.

Acceptance criteria:

- Inactive members are excluded from the actor selector.
- Stored inactive selections fall back to an active owner/member.
- API client exposes all v0.0.4 workspace/member methods.
- Existing frontend tests pass after DTO fixture updates.

Suggested commands:

```sh
npm test --workspace @worktrail/web -- --include 'src/app/app.spec.ts'
npm run typecheck --workspace @worktrail/web
```

## Phase 8: Workspace Settings Frontend

Goal: add the workspace administration surface.

Scope:

- Add `WorkspaceSettingsPageComponent`.
- Add route `/workspace/settings`.
- Load workspace, capabilities, members, and workspace activity.
- Add workspace name edit panel:
  - owner save;
  - non-owner helper text.
- Add role summary panel using capability/role copy.
- Add member creation form.
- Add member list/table with:
  - name;
  - email;
  - role;
  - active/inactive marker;
  - edit controls;
  - deactivate/reactivate controls with inline confirmation.
- Refresh members/current user state after member mutations.
- Refresh workspace activity after relevant mutations.
- Add loading, empty, validation, and error states.
- Add responsive styles with no nested cards and no text overflow at common widths.
- Add frontend tests for rendering, owner controls, non-owner restrictions, form validation, and member lifecycle interactions.

Out of scope:

- E2E smoke coverage.
- Work item assignment UI updates.
- Project creation UI updates.

Acceptance criteria:

- Owners can manage workspace name and members from `/workspace/settings`.
- Maintainers/contributors can view role summary and member state but cannot manage members.
- Workspace activity is visible after mutations.
- The page remains usable at laptop and desktop widths.

Suggested commands:

```sh
npm test --workspace @worktrail/web -- --include 'src/app/features/workspace/*.spec.ts'
npm run typecheck --workspace @worktrail/web
```

## Phase 9: Project Creation UI Polish

Goal: make project creation permission-aware and support explicit project keys.

Scope:

- Update `ProjectListPageComponent` create form:
  - optional key input;
  - key helper text;
  - key validation feedback;
  - contributor disabled state using capabilities;
  - owner/maintainer create allowed;
  - clear success state or direct next action after creation.
- Load workspace capabilities for the Projects page.
- Surface backend duplicate-key and invalid-key errors inline.
- Add frontend tests for:
  - key input;
  - generated key path;
  - explicit key submission;
  - contributor disabled state;
  - error display.

Out of scope:

- Separate onboarding wizard.
- Workspace/team management UI.

Acceptance criteria:

- Owners and maintainers can create projects with or without an explicit key.
- Contributors see a clear reason they cannot create projects.
- New projects appear immediately in the list.
- Project creation errors are shown inline.

Suggested commands:

```sh
npm test --workspace @worktrail/web -- --include 'src/app/features/projects/projects-page.component.spec.ts'
npm run typecheck --workspace @worktrail/web
```

## Phase 10: Inactive Member Frontend Integration

Goal: make active/inactive member behavior consistent across existing work item surfaces.

Scope:

- Update work item create assignee control to show active members only.
- Update work item detail assignee control to show active members plus current inactive assignee.
- Update list filters to show active members by default while still resolving inactive member labels from URL query state.
- Add inactive member marker in compact display helpers where useful:
  - assignee;
  - reporter;
  - comment author;
  - activity actor.
- Ensure existing inactive assignee/reporters remain readable.
- Add frontend tests for:
  - create excludes inactive assignees;
  - detail includes current inactive assignee;
  - filter chip resolves inactive member name from URL;
  - inactive markers render without layout issues.

Out of scope:

- Backend inactive assignment policy.
- Workspace settings page.

Acceptance criteria:

- New assignment controls do not offer inactive members.
- Historical inactive member references remain clear.
- Direct URL filters for inactive members can still be understood.
- Work item list, board, detail, comments, and activity do not regress.

Suggested commands:

```sh
npm test --workspace @worktrail/web -- --include 'src/app/features/work-items/*.spec.ts'
npm run typecheck --workspace @worktrail/web
```

## Phase 11: Permission Copy And UI Consistency Pass

Goal: align role/permission affordances and visible messages across the app.

Scope:

- Audit owner-only and owner/maintainer-only actions:
  - workspace settings;
  - member management;
  - project creation;
  - project settings;
  - labels;
  - milestones;
  - archived project writes;
  - terminal work item contributor behavior.
- Align helper/error copy with backend messages:
  - owner required;
  - owner or maintainer required;
  - archived project read-only;
  - inactive member cannot act;
  - inactive member cannot be assigned;
  - terminal work item restrictions.
- Prefer disabled controls with concise helper text where seeing the action helps comprehension.
- Hide actions only when they create clutter or cannot be explained locally.
- Add targeted tests for at least one permission affordance per role.

Out of scope:

- New permission model.
- Custom roles.
- Full capability matrix UI.

Acceptance criteria:

- Users can understand why key actions are unavailable.
- Backend and frontend permission language is consistent.
- Existing role behavior remains server-enforced.

Suggested commands:

```sh
npm test --workspace @worktrail/web
npm test --workspace @worktrail/api
npm run typecheck
```

## Phase 12: E2E Coverage And UX Pass

Goal: validate the v0.0.4 governance workflow through the browser and tighten UI quality.

Scope:

- Extend Playwright smoke coverage:
  - open workspace settings;
  - create a contributor;
  - confirm the member appears in the actor selector;
  - promote the member to maintainer;
  - switch to the maintainer;
  - confirm project creation is available;
  - switch back to owner;
  - deactivate and reactivate the member;
  - confirm workspace activity entries;
  - create a project with an explicit key;
  - run a representative v0.0.3 planning path.
- Add responsive checks for:
  - workspace settings;
  - member table/list;
  - actor selector;
  - Projects create form;
  - work item create/detail assignment controls.
- Fix obvious text overflow, layout compression, and control sizing issues.

Out of scope:

- New product scope.
- Broad visual redesign.

Acceptance criteria:

- E2E smoke test covers the main v0.0.4 governance path.
- Core pages remain usable at common laptop and desktop widths.
- Existing v0.0.3 planning workflow remains covered.

Suggested commands:

```sh
npm run test:e2e
npm run build
git diff --check
```

## Phase 13: Documentation, Site, Extraction Notes, And Release Finalization

Goal: prepare v0.0.4 for merge and release.

Scope:

- Update `README.md`:
  - repository layout if needed;
  - capabilities;
  - limitations;
  - local actor caveats;
  - demo walkthrough;
  - verification notes.
- Update static product site for:
  - workspace/team governance;
  - member administration;
  - permission transparency;
  - workspace activity;
  - project creation polish.
- Add `docs/v0.0.4/jawstack-extraction-notes.md`.
- Update package versions to `0.0.4` if release/tagging is in scope at execution time.
- Run final verification.
- Document known warnings if any remain.

Out of scope:

- Publishing npm packages unless explicitly requested.
- Creating a release tag unless explicitly requested.

Acceptance criteria:

- Documentation and public site reflect v0.0.4 capabilities.
- Extraction notes capture reusable patterns and deferred abstractions.
- Full verification passes or known residual issues are documented.
- Worktree changes are ready for review.

Suggested commands:

```sh
npm run db:reset
npm run db:migrate
npm run db:seed
npm run typecheck
npm test
npm run test:e2e
npm run build
npm audit --omit=dev --audit-level=low
git diff --check
git status --short --branch
```
