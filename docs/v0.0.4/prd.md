# Worktrail v0.0.4 PRD

## Summary

Worktrail v0.0.4 should make the application feel less like a seeded demo and more like a team workspace that can be administered over time. v0.0.3 made planning credible through milestones, persisted board ordering, richer discovery, and a planning dashboard. The next release should focus on the people and governance layer that every useful project tracker needs:

- Who belongs to the workspace?
- What role do they have?
- Can inactive members still be shown historically without remaining assignable?
- Can owners safely manage roles without locking themselves out?
- Can the UI explain why an action is available, disabled, or rejected?
- Can workspace-level administrative changes be reviewed later?

The v0.0.4 theme is:

> Make Worktrail governable by a small team.

This sprint should add workspace member administration, permission transparency, active/inactive member handling, workspace-level activity, and light project onboarding polish. It should not introduce production authentication yet. The local actor selector remains a development affordance, but the underlying product model should move closer to something that can later be backed by real auth, invitations, and cloud deployment.

## Context

Worktrail is both a product and a reference application. It should continue to become a useful project tracker while revealing implementation patterns that may later inform `jawstack` and deployable reference solutions.

The current product has:

- Angular SPA frontend;
- TypeScript API with local Express adapter and transport-neutral handler structure;
- Postgres persistence through Drizzle migrations;
- project creation, settings, archive/reactivate, and label administration;
- stable work item display keys;
- milestones, planning dashboard, and persisted board ordering;
- work item list, board, detail, comments, and activity;
- archived-project write protection;
- local actor selector backed by seeded members;
- static GitHub Pages product site.

The current people model is useful for testing role paths, but it is still mostly static. Members are seeded, listed by the API, and selected locally in the top bar. There is no workspace administration surface for adding, editing, deactivating, or reactivating members. Permission behavior exists in backend services and scattered UI affordances, but the product does not yet make those rules easy to inspect or verify.

## Problem

Worktrail can now track and plan work, but a real team cannot adopt it cleanly because workspace administration is incomplete:

- Workspace members cannot be created or edited from the UI.
- Roles cannot be changed without editing seed data or the database.
- Inactive member behavior is not a first-class product concept across assignment controls and local actor selection.
- The app does not protect against unsafe administrative changes such as removing the last active owner.
- Permission rules are enforced by the server, but the UI does not consistently explain why actions are unavailable.
- Administrative actions are not visible in a workspace-level audit trail.
- Project creation exists, but the UI does not expose project key control or a polished onboarding path.

These gaps limit adoptability and leave important reference-app patterns unexplored: member lifecycle, role governance, permission capability modeling, historical identity display, workspace-scoped audit, and first-run/team setup flows.

## Goals

- Let owners manage workspace members from the application.
- Support creating, editing, deactivating, and reactivating members.
- Let owners change member roles while preserving at least one active owner.
- Treat inactive members consistently across actor selection, assignment controls, historical display, and server authorization.
- Make permission rules easier to understand in the UI.
- Keep the server authoritative for every role and lifecycle rule.
- Add workspace-level activity for member and workspace administration events.
- Polish project creation so a team can create a meaningful project without relying on seed data.
- Preserve the local development actor selector as a placeholder, not production authentication.
- Add tests around member lifecycle, role safety, inactive-member behavior, and permission affordances.
- Capture extraction notes for role administration, capability modeling, historical identity display, and workspace audit patterns.

## Non-Goals

- Production authentication.
- Passwords, sessions, OAuth, SSO, or MFA.
- Email invitations.
- SCIM provisioning.
- Multi-workspace switching.
- Billing or subscription management.
- Project-specific membership.
- Teams, groups, or permission sets.
- Custom roles.
- Field-level permissions.
- Real-time presence.
- Notifications.
- Full compliance-grade audit logging.
- User profile avatars.
- Replacing the local actor selector with login.
- AWS infrastructure deployment.
- Lambda/API Gateway adapter implementation.

## Target Users

Primary:

- Small teams setting up Worktrail for one workspace.
- Workspace owners who need to add teammates and manage roles.
- Maintainers who need to understand why a given action is allowed or blocked.
- Developers evaluating how a serious business app models roles, member lifecycle, and administrative audit.

Secondary:

- Future `jawstack` contributors looking for patterns in member administration, permission checks, and capability-aware UI.
- Teams interested in a local-first tracker that can later become cloud deployable.
- Developers evaluating Worktrail as a future AWS-style reference solution.

## Positioning

Worktrail should continue to be focused and calm. v0.0.4 should not pretend to be an enterprise identity platform. It should make the current local workspace model credible enough for a small team and structured enough that real authentication can be added later without rewriting product concepts.

Suggested v0.0.4 positioning:

> A focused project tracker where teams can plan work, manage contributors, and understand who can change what.

## Product Principles

- Administrative actions should be explicit and reversible where practical.
- Historical identity should remain readable even when a member is inactive.
- Assignment controls should prefer active members without hiding past context.
- Role safety rules should prevent obvious lockouts.
- Permission affordances should explain constraints without becoming noisy.
- The server owns authorization; the client mirrors permissions only to improve usability.
- Workspace-level concepts should not be forced into project-level activity.
- Keep the auth boundary honest: local actor selection is a development substitute, not a security feature.
- Prefer simple role governance before custom permissions.

## Scope

### 1. Workspace Member Administration

Add a workspace administration surface where owners can manage members.

Required behavior:

- Add a workspace settings or team page reachable from the global navigation.
- List workspace members with:
  - name;
  - email;
  - role;
  - active/inactive state;
  - created/updated timestamps if available and useful.
- Create a member with name, email, and role.
- Edit member name and email.
- Change member role.
- Deactivate a member.
- Reactivate a member.
- Show inline validation errors for duplicate email, invalid email, missing name, and unsafe role changes.
- Keep inactive members visible in the administration list.

Role options:

- `owner`
- `maintainer`
- `contributor`

Safety rules:

- Only active owners can manage members.
- The workspace must always have at least one active owner.
- An owner cannot deactivate the last active owner.
- An owner cannot demote the last active owner.
- Inactive members cannot be selected as the current local actor.
- Inactive members cannot perform write operations if their actor headers are sent manually.
- Duplicate active or inactive emails in the same workspace are rejected.

Acceptance criteria:

- An owner can add a contributor and that member appears in the actor selector and assignment controls.
- An owner can promote a member to maintainer and the member receives maintainer-level UI affordances after being selected.
- An owner cannot deactivate or demote the last active owner.
- A deactivated member remains visible in historical comments, activity, assignee fields, and reporter fields.
- A deactivated member is excluded from new assignment controls unless already assigned to the current work item.
- A deactivated member cannot be used as the current actor through the standard UI.

### 2. Active And Historical Member Behavior

Inactive members should behave consistently across product surfaces.

Required behavior:

- Actor selector shows active members only.
- If the selected local actor becomes inactive, the app selects the first active owner if available, then the first active member.
- Work item assignee filters and assignment controls show active members by default.
- Existing inactive assignees and reporters remain displayed on work item list, board, detail, comments, and activity.
- Filtering by inactive assignee remains possible when a work item is currently assigned to that inactive member or when using a direct URL query parameter.
- Create/edit controls prevent assigning inactive members unless the work item is already assigned to that member and the user is preserving the current assignment.
- Server validation rejects assigning inactive members to new work unless a technical design decision explicitly allows historical preservation on edit.

Acceptance criteria:

- Deactivating an assignee does not corrupt existing work item display.
- New work item create controls do not offer inactive assignees.
- Existing work item detail remains understandable when assignee, reporter, commenter, or actor is inactive.
- Direct API attempts to act as an inactive member are rejected with a clear authorization error.

### 3. Permission Transparency

Permission rules should be easier to understand without turning the app into an admin manual.

Required behavior:

- Add a concise role summary to the workspace/team administration surface.
- Show current actor role in the global actor selector.
- Disable or hide owner-only actions for maintainers and contributors consistently.
- Where a disabled action remains visible, provide short helper text or a tooltip-equivalent reason.
- Use consistent copy for common permission failures:
  - owner required;
  - owner or maintainer required;
  - archived project is read-only;
  - inactive member cannot act;
  - terminal work item cannot be changed by contributor.
- Keep backend error messages aligned with visible UI language.

Candidate role summary:

- Owners manage workspace members, project settings, labels, milestones, and all work.
- Maintainers manage project settings, labels, milestones, and all project work, but not workspace members.
- Contributors create work, comment, and update assigned active work within existing workflow limits.

Acceptance criteria:

- A contributor can see why member administration is unavailable.
- A maintainer can see why member administration is unavailable but project administration remains available.
- Server rejection messages are specific enough for UI display.
- Frontend tests cover at least one disabled/hidden action per role.

### 4. Workspace Activity

Workspace-level administrative changes should be reviewable without forcing them into project activity.

Required behavior:

- Add a workspace activity model or equivalent architecture for non-project events.
- Record activity for:
  - member created;
  - member profile changed;
  - member role changed;
  - member deactivated;
  - member reactivated;
  - workspace name changed if workspace settings are included;
  - project created if low effort.
- Show recent workspace activity on the workspace/team administration surface.
- Include actor, event type, summary, previous value, new value where appropriate, and timestamp.
- Avoid storing sensitive data beyond the existing member name/email fields.

Acceptance criteria:

- Creating, changing, deactivating, and reactivating a member writes workspace activity.
- Workspace activity is visible after page reload.
- Workspace activity does not require a project ID.
- Existing project activity continues to work unchanged.

### 5. Workspace Settings And Project Onboarding Polish

Project creation exists, but v0.0.4 should make first setup and ongoing administration feel more intentional.

Required behavior:

- Add or update a workspace settings surface for workspace name and team administration.
- Let owners edit the workspace name if the technical design confirms this is low risk.
- Update project creation UI to expose optional project key input.
- Preserve automatic project key generation when no key is supplied.
- Show project key validation guidance before submit.
- Show clear duplicate-key errors.
- Navigate or offer a clear next action after successful project creation.
- Keep project creation available only to owners and maintainers.

Acceptance criteria:

- A maintainer can create a project with an explicit key.
- A maintainer can create a project without a key and receive a generated key.
- A contributor cannot create a project and sees a clear reason.
- Project creation failures are shown inline.
- New projects appear immediately in the project list.

### 6. Documentation And Public Site Updates

The release should keep the repository and public face current.

Required behavior:

- Update README capabilities, setup notes if needed, and demo walkthrough.
- Update the static site to mention v0.0.4 workspace/team governance capabilities.
- Add v0.0.4 extraction notes after implementation.
- Keep planning documents under `docs/v0.0.4/`.

Acceptance criteria:

- README reflects v0.0.4 behavior.
- Product site highlights team administration, permissions, and workspace audit.
- Extraction notes identify reusable patterns and rejected abstractions.

## User Journeys

### Add A Teammate

1. An owner opens workspace team settings.
2. They create a new contributor with name and email.
3. The member appears in the team list.
4. The member appears in the local actor selector.
5. The owner assigns a work item to the new contributor.
6. Workspace activity records the member creation.

### Promote A Maintainer

1. An owner opens the team list.
2. They change a contributor role to maintainer.
3. The role summary explains what the maintainer can do.
4. The owner switches the local actor to that maintainer.
5. The maintainer can manage project settings but cannot manage workspace members.
6. Workspace activity records the role change.

### Deactivate A Former Member

1. An owner deactivates a member.
2. The member disappears from new assignment controls and the actor selector.
3. Existing work items, comments, and activity still show the member identity.
4. Attempts to act as that member are rejected by the API.
5. The owner can reactivate the member later.

### Avoid Owner Lockout

1. A workspace has one active owner.
2. That owner tries to demote themselves to maintainer.
3. The app blocks the change and explains that at least one active owner is required.
4. The owner adds or promotes another owner.
5. Demotion becomes possible only after another active owner exists.

### Create A Real Project

1. A maintainer opens Projects.
2. They create a project with name, description, and explicit key.
3. Validation explains key format before submission.
4. The project appears in the list immediately.
5. The maintainer opens the project and begins adding milestones/work items.

## Functional Requirements

- Members are workspace-scoped.
- Member email is required and unique within the workspace.
- Member name is required.
- Member role must be one of the existing role values.
- Member active state must be server-enforced for write operations.
- Member deactivation is reversible.
- Historical member references must remain readable.
- Owners can manage members.
- Maintainers cannot manage members.
- Contributors cannot manage members.
- Project creation is restricted to owners and maintainers.
- Workspace activity must support events without a project ID.
- All member administration endpoints must validate actor workspace scope.
- All new write endpoints must return specific validation, authorization, or conflict errors.

## UX Requirements

- Workspace/team administration should feel like an operational settings surface, not a marketing page.
- Member tables should be dense, scannable, and responsive.
- Role changes and deactivation controls should require deliberate action but not excessive ceremony.
- Last-owner safety failures should be explained inline.
- Inactive members should have a visible but subdued state marker.
- Role summary copy should be short and concrete.
- The actor selector should stay compact.
- Text must not overflow controls at laptop and mobile widths.
- Empty states should explain what is missing and offer the next relevant action.
- Do not introduce Angular Material visual styling.

## Data And Reporting Requirements

- Member administration should preserve `createdAt` and `updatedAt` timestamps if the technical design exposes them in DTOs.
- Workspace activity should support event ordering by newest first.
- Workspace activity should retain previous and new values for role/status/name/email changes where useful.
- Seed data should include enough members and activity to demonstrate:
  - owner;
  - maintainer;
  - contributor;
  - inactive historical member.
- Tests should be deterministic around timestamps and ordering.

## Quality Requirements

- Add backend tests for:
  - member create/update/deactivate/reactivate;
  - role change safety;
  - last active owner protection;
  - inactive actor rejection;
  - active/inactive assignment validation;
  - project creation permission and key validation;
  - workspace activity recording.
- Add frontend unit tests for:
  - workspace/team administration rendering;
  - member create/edit/deactivate/reactivate flows;
  - role-specific disabled/hidden actions;
  - actor selector active-member behavior;
  - project creation key validation.
- Extend e2e smoke coverage for:
  - creating a member;
  - promoting/demoting a member where safe;
  - deactivating/reactivating a member;
  - confirming inactive member assignment/actor behavior;
  - creating a project with an explicit key.
- Run full verification before release:

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
```

## Success Metrics

For v0.0.4, success is qualitative and verification-focused:

- A seeded workspace can be administered without direct database edits.
- A new member can be added, assigned work, promoted, deactivated, and reactivated through the app.
- Role and inactive-member rules are enforced by the server and reflected clearly in the UI.
- Workspace-level administrative activity is reviewable after reload.
- A team can create a new project with a useful key from the UI.
- Existing v0.0.3 planning and work tracking workflows continue to work.
- The implementation reveals reusable patterns worth documenting for `jawstack`.

## Risks

- Member administration can drift into production auth if scope is not controlled.
- Workspace activity may duplicate project activity if boundaries are not chosen carefully.
- Inactive-member handling can become inconsistent across filters, assignment controls, actor selection, and historical display.
- Role summaries can become stale if permission rules are duplicated in too many places.
- Last-owner protection needs transactional enforcement to avoid race conditions.
- The local actor selector may become misleading if not clearly positioned as a development substitute.

## Open Decisions For Technical Design

The technical design should resolve these before implementation:

- Whether to add a new `workspace_activity_events` table or generalize the existing activity table to allow `project_id` to be nullable.
- Whether member `isActive` should be represented as a boolean only or as `deactivatedAt`/`deactivatedById` for better audit.
- Whether inactive members can remain assigned on edit when preserving an existing assignment.
- Whether the API should expose explicit capability DTOs or keep permission affordances client-derived for v0.0.4.
- Whether workspace settings and team administration should be one page or separate routes.
- Whether project creation belongs only on the project list page or also in a first-run/onboarding view.
- Whether owner-only member actions need confirmation dialogs, inline confirmation, or immediate command buttons.

## Recommended Scope Cut If Needed

If v0.0.4 needs to shrink, keep:

1. Member create/edit/deactivate/reactivate.
2. Last active owner protection.
3. Inactive-member assignment and actor behavior.
4. Workspace activity for member lifecycle.
5. Project creation key polish.

Defer:

- workspace name editing;
- project-created workspace activity;
- explicit capability DTOs;
- direct URL filtering by inactive assignee;
- richer first-run onboarding;
- extensive role summary UI beyond concise copy.
