# Worktrail v0.0.3 Implementation Plan

## Purpose

This plan turns the v0.0.3 PRD and technical design into sequential implementation phases. v0.0.3 should make Worktrail a more useful planning tool by adding project milestones, persisted board ordering, richer work item discovery, and a planning dashboard.

The release remains local-first. It should preserve the Angular static-hosting path, transport-neutral API handlers, Postgres migration discipline, deterministic seed data, and clean verification from a fresh checkout.

## Design Decisions

Use these decisions while implementing v0.0.3:

- Add project-scoped milestones with dedicated backend and frontend surfaces.
- Add `/projects/:projectId/planning` as the main planning dashboard and milestone management route.
- Add `milestone_id` and `board_position` to work items.
- Use sparse integer board positions with transactional compaction when needed.
- Add `POST /api/work-items/:workItemId/board-move` for persisted board moves.
- Do not record activity for pure same-column reorders.
- Continue recording `work_item.status_changed` for cross-status board moves.
- Record milestone lifecycle events and `work_item.milestone_changed`.
- Use `ILIKE` search across display key, title, and description for v0.0.3.
- Add a dedicated project planning summary endpoint.
- Keep milestone completion manual.
- Keep Angular CDK DragDrop and do not introduce Angular Material visual components.
- Keep production auth, AWS infrastructure, custom workflows, custom fields, and imports out of scope.

## Phase Sizing

Each phase should leave the repository in a coherent working state. Prefer narrow vertical changes with targeted tests. If a phase starts combining schema changes, service behavior, endpoint changes, and a large UI surface, split it before continuing.

## Phase 0: Baseline Planning

Goal: confirm v0.0.3 planning inputs and resolve open technical choices before code changes.

Scope:

- Confirm `docs/v0.0.3/prd.md` exists.
- Confirm `docs/v0.0.3/technical-design.md` exists.
- Confirm `docs/v0.0.3/implementation-plan.md` exists.
- Confirm design decisions listed above.
- Check repository status before implementation starts.

Out of scope:

- Dependency changes.
- Schema changes.
- Feature implementation.

Acceptance criteria:

- The three v0.0.3 planning documents exist.
- No unresolved open decision blocks Phase 1.
- The worktree state is understood before implementation starts.

Suggested commands:

```sh
find docs/v0.0.3 -maxdepth 1 -type f | sort
git status --short --branch
```

Status:

- Completed on 2026-07-04.
- Confirmed `docs/v0.0.3/prd.md`, `docs/v0.0.3/technical-design.md`, and `docs/v0.0.3/implementation-plan.md` exist.
- Confirmed implementation decisions:
  - milestones are project-scoped resources with dedicated backend and frontend surfaces;
  - planning lives at `/projects/:projectId/planning`;
  - work items gain `milestone_id` and `board_position`;
  - board ordering uses sparse integer positions with transactional compaction when needed;
  - persisted board moves use `POST /api/work-items/:workItemId/board-move`;
  - pure same-column reorders do not create activity events in v0.0.3;
  - cross-status board moves continue recording `work_item.status_changed`;
  - milestone lifecycle and milestone assignment changes are recorded in activity;
  - work item search starts with `ILIKE` across display key, title, and description;
  - planning dashboard data is served by a dedicated summary endpoint;
  - milestone completion is manual;
  - Angular CDK DragDrop remains the board interaction primitive, without Angular Material visual components;
  - production auth, AWS infrastructure, custom workflows, custom fields, and imports stay out of scope.
- Confirmed current worktree state: only the untracked `docs/v0.0.3/` planning directory is pending.
- No unresolved open decision blocks Phase 1.

## Phase 1: Schema, Migration, Seed, And Contracts

Goal: establish the v0.0.3 data model and shared API shape.

Scope:

- Add milestone constants and contract types:
  - `MilestoneStatus`;
  - `MilestoneDto`;
  - `CreateMilestoneRequest`;
  - `UpdateMilestoneRequest`.
- Add due date state and extended work item sort contract values.
- Extend work item DTOs and requests:
  - `milestone`;
  - `milestoneId`;
  - `boardPosition`.
- Add board move and planning summary contracts.
- Add backend domain constants for milestone statuses and new activity event types.
- Add Drizzle schema for `milestones`.
- Add work item fields:
  - `milestone_id`;
  - `board_position`.
- Add indexes and constraints from the technical design.
- Generate and review a Drizzle migration.
- Hand-edit migration SQL where needed for:
  - partial unique milestone name index;
  - activity event check constraint changes;
  - deterministic board position backfill.
- Update repository type definitions.
- Update deterministic seed data with:
  - planned/active milestones;
  - a completed or canceled milestone;
  - milestone assignments;
  - due dates and stale/blocked/unassigned examples;
  - deterministic board positions.

Out of scope:

- Milestone services/endpoints.
- Board move behavior.
- Frontend UI changes.

Acceptance criteria:

- Migration applies after local reset.
- Seed data demonstrates v0.0.3 planning states.
- Contracts compile with temporary DTO mapping updates as needed.
- Existing tests either pass or fail only for expected not-yet-implemented service behavior identified in this phase.

Suggested commands:

```sh
npm run db:generate
npm run db:reset
npm run db:migrate
npm run db:seed
npm run typecheck
npm test --workspace @worktrail/api
```

Status:

- Completed on 2026-07-04.
- Added v0.0.3 shared contract types for milestones, due date state filters, expanded work item sorts, board move requests, planning summary DTOs, milestone assignment, and board position.
- Added backend milestone statuses and new activity event types for milestone lifecycle and work item milestone changes.
- Added Drizzle schema for `milestones` with project-scoped lifecycle fields, status checks, indexes, and active-name uniqueness.
- Added `milestone_id` and `board_position` to `work_items` with query indexes for milestone, status/order, due date, and reporter.
- Generated migration `0002_wide_nicolaos.sql` and hand-edited it to backfill board positions deterministically by `(project_id, status)` using `updated_at desc, item_number asc`.
- Updated repository inferred types for milestones.
- Updated DTO mapping to expose milestone DTOs and board positions, with existing work item service paths returning `milestone: null` until repository joins are implemented in Phase 3.
- Updated seed data with deterministic milestones, milestone assignments, board positions, due dates, stale work, and a seeded `work_item.milestone_changed` activity event.
- Updated frontend test fixtures for the expanded work item DTO shape.
- Verified `npm run db:reset && npm run db:migrate && npm run db:seed`.
- Verified seeded milestone rows, work item board positions, and the new activity event type with a direct Postgres query through the project `pg` dependency because `psql` is not installed locally.
- Verified `npm run typecheck`.
- Verified `npm test --workspace @worktrail/api`.
- Verified `npm test`.
- Verified `npm run build`.
- Verified `git diff --check`.

## Phase 2: Milestone Backend

Goal: implement milestone lifecycle behavior and API endpoints.

Scope:

- Add `MilestoneRepository`.
- Add milestone DTO mapping.
- Add `MilestoneService`.
- Implement role rules:
  - owners and maintainers can create/update/archive/reactivate;
  - contributors can read.
- Enforce archived-project write blocking.
- Enforce active milestone name uniqueness per project.
- Implement milestone activity events:
  - `milestone.created`;
  - `milestone.name_changed`;
  - `milestone.description_changed`;
  - `milestone.status_changed`;
  - `milestone.target_date_changed`;
  - `milestone.archived`;
  - `milestone.reactivated`.
- Add endpoint handlers and Express routes:
  - `GET /api/projects/:projectId/milestones`;
  - `POST /api/projects/:projectId/milestones`;
  - `PATCH /api/milestones/:milestoneId`;
  - `POST /api/milestones/:milestoneId/archive`;
  - `POST /api/milestones/:milestoneId/reactivate`.
- Add backend tests for milestone lifecycle, permissions, uniqueness, activity, and archived-project behavior.

Out of scope:

- Work item milestone assignment.
- Planning summary endpoint.
- Frontend milestone UI.

Acceptance criteria:

- Milestones can be created, listed, updated, archived, and reactivated through API tests.
- Duplicate active milestone names are rejected.
- Archived projects reject milestone writes.
- Milestone lifecycle activity is recorded.

Suggested commands:

```sh
npm test --workspace @worktrail/api -- milestones
npm run typecheck --workspace @worktrail/api
```

Status:

- Completed on 2026-07-04.
- Added `MilestoneRepository` with create, find, list, active-name lookup, update, archive, and reactivate helpers.
- Added milestone repository wiring to the shared repository factory and transaction helper path.
- Added milestone management permission helper, currently mapped to owner/maintainer project management rights.
- Added `MilestoneService` with:
  - project/workspace validation;
  - owner/maintainer write enforcement;
  - contributor read support through list behavior;
  - archived-project write blocking;
  - active milestone name uniqueness;
  - lifecycle activity for create, name/description/status/target-date changes, archive, and reactivate.
- Added milestone endpoint handlers and validation for:
  - `GET /api/projects/:projectId/milestones`;
  - `POST /api/projects/:projectId/milestones`;
  - `PATCH /api/milestones/:milestoneId`;
  - `POST /api/milestones/:milestoneId/archive`;
  - `POST /api/milestones/:milestoneId/reactivate`.
- Added Express route wiring for milestone project routes and milestone command routes.
- Added milestone API tests for listing, filters, create/update/archive/reactivate, activity, duplicate-name conflicts, contributor write rejection, and archived-project write rejection.
- Updated API test cleanup paths to delete `milestones` before deleting projects.
- Removed transaction-time parallel DTO lookups that triggered the `pg` client deprecation warning during API tests.
- Verified `npm run typecheck --workspace @worktrail/api`.
- Verified `npm test --workspace @worktrail/api -- milestones`.
- Verified `npm test --workspace @worktrail/api`.
- Verified `NODE_OPTIONS=--trace-deprecation npm test --workspace @worktrail/api` runs without the previous `pg` deprecation warning.
- Verified `npm run typecheck`.
- Verified `npm test`.
- Verified `npm run build`.
- Verified `git diff --check`.

## Phase 3: Work Item Milestone Assignment And Discovery Backend

Goal: connect milestones to work items and extend list query behavior.

Scope:

- Extend work item repository create/update inputs for `milestoneId`.
- Include milestone records in list/detail DTO assembly.
- Add milestone validation to work item create/update.
- Allow clearing milestone assignment.
- Reject assignment to archived milestones unless unchanged.
- Record `work_item.milestone_changed` activity.
- Extend work item list filters:
  - `reporterId`;
  - `milestoneId`;
  - `dueDateState`.
- Extend text search across:
  - display key;
  - title;
  - description.
- Extend sort behavior:
  - `due_date_asc`;
  - `created_desc`;
  - `board_order`.
- Update endpoint query validation.
- Add backend tests for assignment, validation, activity, search, filters, and sorts.

Out of scope:

- Board move command.
- Planning summary endpoint.
- Frontend filter UI.

Acceptance criteria:

- Work item create/update supports milestone assignment.
- Work item list/detail DTOs include milestone data.
- Work item filtering and search work through API requests.
- Archived milestone and archived project write rules are enforced.

Suggested commands:

```sh
npm test --workspace @worktrail/api -- work-items
npm run typecheck
```

Status:

- Completed on 2026-07-04.
- Extended work item repository filters for reporter, milestone, due date state, display key/title/description search, and expanded sorts.
- Added `due_date_asc`, `created_desc`, and `board_order` sort behavior.
- Added `milestoneId` to work item repository update inputs.
- Added work item service milestone validation for create/update:
  - milestone must belong to the same workspace and project;
  - archived milestones cannot be newly assigned;
  - existing archived assignments can remain unchanged;
  - assignments can be cleared with `null`.
- Added milestone DTO loading for work item list/detail responses.
- Added `work_item.milestone_changed` activity when milestone assignment changes.
- Extended work item endpoint validation for `milestoneId`, `reporterId`, `milestoneId` filter, `dueDateState`, and expanded sort values.
- Added API tests for milestone assignment on create, milestone assignment update/clear, archived milestone validation, milestone DTO responses, search across description/display key, reporter/milestone/due-date filters, and board order sorting.
- Verified `npm test --workspace @worktrail/api -- work-items`.
- Verified `npm run typecheck --workspace @worktrail/api`.
- Verified `NODE_OPTIONS=--trace-deprecation npm test --workspace @worktrail/api`.
- Verified `npm run typecheck`.
- Verified `npm test`.
- Verified `npm run build`.
- Verified `git diff --check`.

## Phase 4: Board Ordering Backend

Goal: persist board ordering and add the board move command.

Scope:

- Implement board position helpers:
  - get top/bottom positions;
  - validate neighbor hints;
  - compute sparse rank;
  - compact a status column when no gap exists.
- Assign initial `boardPosition` on work item creation.
- Update the status transition fallback to assign a top position when status changes.
- Add `moveWorkItemOnBoard` to `WorkItemService`.
- Add `POST /api/work-items/:workItemId/board-move`.
- Preserve workflow validation for cross-status moves.
- Reject archived-project board moves.
- Record `work_item.status_changed` only for status changes.
- Add backend tests for:
  - same-column reorder;
  - cross-column move;
  - invalid transition rejection;
  - stale neighbor rejection;
  - compaction path;
  - status dropdown transition positioning.

Out of scope:

- Frontend drag/drop changes.
- Planning dashboard.

Acceptance criteria:

- Board order persists in API results with `sort=board_order`.
- Reordering a column survives reload.
- Cross-status board moves validate workflow and preserve target position.
- Same-column reorder does not create activity.

Suggested commands:

```sh
npm test --workspace @worktrail/api -- work-items
npm run typecheck
```

Status:

- Completed on 2026-07-04.
- Added repository helpers for:
  - ordered board-column reads;
  - top-position lookup;
  - status/board position moves;
  - board-column compaction.
- Added initial top-position assignment for newly created work items.
- Updated status-menu transitions to move changed-status cards to the top of the destination column.
- Added `moveWorkItemOnBoard` service command with:
  - archived-project write blocking;
  - workflow transition validation;
  - neighbor validation;
  - sparse integer rank calculation;
  - compaction retry when no rank gap exists;
  - status activity only for cross-status moves.
- Added `POST /api/work-items/:workItemId/board-move`.
- Added API tests for:
  - initial create positions;
  - status-menu transition positioning;
  - same-column reorder without activity;
  - cross-column move with one status activity;
  - stale neighbor rejection;
  - compaction path;
  - invalid board transition rejection;
  - archived-project board move rejection.
- Verified `npm test --workspace @worktrail/api -- work-items`.
- Verified `npm run typecheck --workspace @worktrail/api`.
- Verified `NODE_OPTIONS=--trace-deprecation npm test --workspace @worktrail/api`.
- Verified `npm run typecheck`.
- Verified `npm test`.
- Verified `npm run build`.
- Verified `git diff --check`.

## Phase 5: Planning Summary Backend

Goal: add the project planning summary endpoint for dashboard data.

Scope:

- Add a planning repository or summary-specific repository helpers.
- Add `PlanningService`.
- Implement summary lists:
  - milestone progress;
  - blocked work;
  - overdue work;
  - due soon work;
  - unassigned ready/in-progress work;
  - stale in-progress work.
- Centralize threshold rules:
  - due soon = today through today + 7 days;
  - stale in progress = no update for 7 days.
- Add `GET /api/projects/:projectId/planning-summary`.
- Add backend tests for deterministic seeded-style summary cases.

Out of scope:

- Planning page UI.
- Milestone management UI.

Acceptance criteria:

- Planning summary returns milestone progress and risk lists.
- Archived projects remain readable.
- Counts exclude done/canceled where required.
- Service clock can be controlled in tests.

Suggested commands:

```sh
npm test --workspace @worktrail/api -- planning
npm run typecheck
```

Status:

- Completed on 2026-07-04.
- Added `PlanningService` with centralized planning thresholds:
  - due soon = today through today + 7 days;
  - stale in progress = no update for 7 days.
- Implemented project planning summary assembly from existing repository boundaries, keeping the service boundary ready for a future query-optimized repository if summary volume requires it.
- Added milestone progress for active, non-archived planned/active milestones, including total, done, blocked, and overdue counts.
- Added risk lists for:
  - blocked work;
  - overdue open work;
  - due-soon open work;
  - unassigned ready/in-progress work;
  - stale in-progress work.
- Excluded done/canceled work from overdue and due-soon risk classification.
- Preserved archived-project readability for planning summaries.
- Added `GET /api/projects/:projectId/planning-summary`.
- Added deterministic API tests for planning summaries, archived-project reads, milestone progress, risk lists, and fake service clock behavior.
- Verified `npm test --workspace @worktrail/api -- planning`.
- Verified `npm run typecheck --workspace @worktrail/api`.
- Verified `npm test --workspace @worktrail/api`.
- Verified `npm run typecheck`.
- Verified `npm test`.
- Verified `npm run build`.
- Verified `git diff --check`.

## Phase 6: Frontend API Client, Routing, And Shared Model Updates

Goal: make v0.0.3 backend capabilities available to Angular components.

Scope:

- Extend `WorktrailApiService` with:
  - milestone methods;
  - planning summary method;
  - board move method;
  - extended work item filters.
- Add route for `/projects/:projectId/planning`.
- Add planning navigation links across relevant project pages.
- Update existing frontend fixtures/spec helpers for milestone and board position fields.
- Add minimal placeholder planning component if needed to keep route wiring compiling.

Out of scope:

- Full planning page UI.
- Work item form controls.
- Board drag/drop behavior changes.

Acceptance criteria:

- Angular typecheck/build works with new contract fields.
- Navigation exposes the planning route without broken links.
- Existing pages render with milestone fields absent or null.

Suggested commands:

```sh
npm run typecheck --workspace @worktrail/web
npm test --workspace @worktrail/web
```

## Phase 7: Milestone Management UI

Goal: let users manage project milestones from the planning surface.

Scope:

- Build milestone management on the planning page or a focused child component.
- List active, planned, completed, canceled, and archived milestones clearly.
- Create milestones with name, description, status, and target date.
- Edit milestone name, description, status, and target date.
- Archive and reactivate milestones.
- Show inline validation errors.
- Disable controls for archived projects and contributor-only actors where appropriate.
- Refresh project activity or planning state after milestone changes.
- Add frontend tests for core milestone interactions and empty states.

Out of scope:

- Planning dashboard risk lists.
- Work item milestone assignment UI.

Acceptance criteria:

- A maintainer can create, edit, archive, and reactivate a milestone in the UI.
- Duplicate-name and validation errors are shown inline.
- Archived projects render milestone management read-only.

Suggested commands:

```sh
npm test --workspace @worktrail/web -- --include '*planning*'
npm run typecheck --workspace @worktrail/web
```

## Phase 8: Work Item Planning UI And List Discovery

Goal: expose milestone assignment and richer discovery in work item views.

Scope:

- Add milestone selection to work item create page.
- Add milestone selection to work item detail page.
- Show milestone on list rows.
- Show milestone on board cards where present.
- Extend work item list filters:
  - search by key/title/description;
  - milestone;
  - reporter;
  - due date state;
  - new sort options.
- Initialize filters from URL query params.
- Update URL query params on apply.
- Add active filter indicators and clear behavior.
- Improve empty states for filtered vs genuinely empty lists.
- Add frontend tests for URL filter state and milestone controls.

Out of scope:

- Board persisted ordering UI.
- Planning dashboard summary rendering.

Acceptance criteria:

- Users can assign, change, and clear milestones from create/detail flows.
- Users can filter by milestone and due date state.
- Filter state survives refresh.
- List rows remain scannable with the added planning fields.

Suggested commands:

```sh
npm test --workspace @worktrail/web -- --include '*work-item*'
npm run typecheck --workspace @worktrail/web
```

## Phase 9: Persisted Board Ordering UI

Goal: wire Angular CDK board interactions to the persisted board move command.

Scope:

- Load board with `sort=board_order`.
- Update drag/drop handling to send neighbor hints.
- Support same-column reorder.
- Support cross-column move with selected destination position.
- Optimistically update local board state while a move is pending.
- Reload board after successful moves.
- Roll back and show an error after failed moves.
- Keep status dropdown fallback and update it to use server-confirmed ordering behavior.
- Add frontend tests for payload generation and rollback.

Out of scope:

- New dashboard UI.
- Reorder activity events.

Acceptance criteria:

- Reordering within a column persists after refresh.
- Cross-column moves land at the intended position.
- Failed moves restore previous UI state.
- Archived projects keep drag/drop disabled.

Suggested commands:

```sh
npm test --workspace @worktrail/web -- --include '*board*'
npm run typecheck --workspace @worktrail/web
```

## Phase 10: Planning Dashboard UI

Goal: render project planning summary as a useful review surface.

Scope:

- Build planning dashboard sections:
  - milestone progress;
  - blocked work;
  - overdue work;
  - due soon work;
  - unassigned active work;
  - stale in-progress work.
- Link milestone progress to filtered work item lists.
- Link risk items to work item detail pages.
- Keep dashboard useful when there are no milestones.
- Add compact empty states.
- Add project home entry point or compact planning snapshot.
- Add frontend tests for dashboard rendering states.

Out of scope:

- Charts.
- Cross-project reporting.
- Custom thresholds in UI.

Acceptance criteria:

- A reviewer can identify blocked, overdue, unassigned, and stale work from the planning route.
- Milestone progress links to filtered list views.
- Empty states are compact and specific.
- Archived projects show read-only planning information.

Suggested commands:

```sh
npm test --workspace @worktrail/web -- --include '*planning*'
npm run typecheck --workspace @worktrail/web
```

## Phase 11: E2E Coverage And UX Pass

Goal: validate the v0.0.3 workflow through the browser and tighten UI quality.

Scope:

- Extend Playwright smoke coverage:
  - open planning page;
  - create a milestone;
  - assign a work item to the milestone;
  - filter list by milestone;
  - reorder a board column;
  - reload and confirm order persists;
  - verify planning dashboard seeded risk data.
- Run targeted responsive checks for:
  - planning page;
  - work item list filters;
  - board;
  - create/detail milestone controls.
- Fix obvious text overflow, layout compression, and control sizing issues.
- Confirm pages use available desktop width appropriately.

Out of scope:

- New product scope.
- Broad visual redesign.

Acceptance criteria:

- E2E smoke test covers the main v0.0.3 happy path.
- Core pages remain usable at common laptop and desktop widths.
- No visible Angular placeholder behavior or broken route states are introduced.

Suggested commands:

```sh
npm run test:e2e
npm run build
```

## Phase 12: Documentation, Site, Extraction Notes, And Release Finalization

Goal: prepare v0.0.3 for merge and release.

Scope:

- Update `README.md`:
  - repository layout if needed;
  - capabilities;
  - limitations;
  - demo walkthrough;
  - verification notes.
- Update static product site for:
  - milestones;
  - persisted board ordering;
  - richer search/filtering;
  - planning dashboard.
- Add `docs/v0.0.3/jawstack-extraction-notes.md`.
- Update package versions to `0.0.3` if release/tagging is in scope at execution time.
- Run final verification.
- Document known warnings if any remain.

Out of scope:

- Publishing npm packages unless explicitly requested.
- Creating a release tag unless explicitly requested.

Acceptance criteria:

- Documentation and public site reflect v0.0.3 capabilities.
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
