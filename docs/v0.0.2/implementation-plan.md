# Worktrail v0.0.2 Implementation Plan

## Purpose

This plan turns the v0.0.2 PRD and technical design into sequential implementation phases. v0.0.2 should make Worktrail more adoptable for a real small team by adding project configuration, stable work item references, label administration, comment lifecycle controls, board drag and drop, and broader activity coverage.

The release remains local-first. It should preserve the Angular static-hosting path, the transport-neutral API handler shape, Postgres migration discipline, deterministic seed data, and the ability to verify the app from a clean checkout.

## Design Decisions

Use these decisions while implementing v0.0.2:

- Use Angular CDK DragDrop for board card movement.
- Do not introduce Angular Material visual components.
- Add immutable work item display keys such as `WT-1`.
- Add project keys and block project key edits after a project has work items.
- Allocate work item numbers transactionally in Postgres.
- Archive labels instead of hard-deleting them.
- Treat archived projects as read-only for work item, label, comment, and transition writes.
- Represent deleted comments as visible tombstones.
- Record activity for project, label, and comment lifecycle changes.
- Keep production auth, AWS deployment, custom workflows, custom fields, and imports out of scope.

## Phase Sizing

Each phase should leave the repository in a coherent working state. Prefer narrow diffs with targeted tests over broad multi-surface changes. If a phase starts combining schema changes, service refactors, and large UI work, split it before continuing.

## Phase 0: Baseline Planning

Goal: confirm v0.0.2 planning inputs and resolve open technical choices before code changes.

Scope:

- Confirm `docs/v0.0.2/prd.md` exists.
- Confirm `docs/v0.0.2/technical-design.md` exists.
- Confirm `docs/v0.0.2/implementation-plan.md` exists.
- Confirm the selected design decisions:
  - Angular CDK DragDrop;
  - immutable work item display keys;
  - archived labels;
  - archived projects are read-only;
  - comment tombstones.
- Check repository status before implementation starts.

Out of scope:

- Dependency installation.
- Schema changes.
- Feature implementation.

Acceptance criteria:

- The three v0.0.2 planning documents exist.
- No unresolved open question blocks Phase 1.
- The worktree state is understood before edits begin.

Suggested commands:

```sh
find docs/v0.0.2 -maxdepth 1 -type f | sort
git status --short --branch
```

Status:

- Completed on 2026-07-04.
- Confirmed `docs/v0.0.2/prd.md`, `docs/v0.0.2/technical-design.md`, and `docs/v0.0.2/implementation-plan.md` exist.
- Resolved remaining technical choices:
  - work item display keys are immutable after creation;
  - project keys can be edited only before work items exist;
  - labels are archived/reactivated rather than hard-deleted;
  - archived projects are read-only for work item, label, comment, and transition writes;
  - deleted comments render as visible tombstones;
  - board drag/drop uses Angular CDK DragDrop without Angular Material visual components;
  - project activity is recorded for project and label lifecycle events and appears first on project settings;
  - archived labels appear in label administration and on already-labeled work items, while assignment and list filter controls show active labels only;
  - project work item counters use an atomic Postgres update helper;
  - board drag/drop reloads the full board after successful transitions in v0.0.2.
- Confirmed current worktree state: only the untracked `docs/v0.0.2/` planning directory is pending.
- No unresolved open question blocks Phase 1.

## Phase 1: Schema, Migrations, Seed, And Contracts

Goal: establish the v0.0.2 data model and API contracts before service/UI work.

Scope:

- Add project fields:
  - `key`;
  - `next_work_item_number`.
- Add work item fields:
  - `item_number`;
  - `display_key`.
- Add label archive fields:
  - `archived_at`;
  - `archived_by_id`.
- Add comment lifecycle fields:
  - `edited_at`;
  - `deleted_at`;
  - `deleted_by_id`.
- Extend activity event check constraints for project, label, and comment lifecycle events.
- Add unique/check indexes and constraints for:
  - project key format;
  - project key uniqueness per workspace;
  - work item number uniqueness per project;
  - work item display key uniqueness per workspace;
  - active label name uniqueness per project.
- Generate and commit a Drizzle migration, with hand-written SQL where Drizzle cannot express partial indexes or backfills clearly.
- Backfill existing projects and work items deterministically.
- Update seed data with project keys, work item keys, an archived label if useful, and any comment lifecycle demo state chosen during implementation.
- Update shared contract types for:
  - project key fields;
  - work item display keys;
  - archived label fields;
  - edited/deleted comment fields;
  - create/update label requests;
  - update comment request;
  - new activity event types.

Out of scope:

- Service behavior beyond what migration/seed scripts require.
- UI changes.
- CDK dependency installation.

Acceptance criteria:

- Migration applies to a reset local database.
- Seed creates deterministic v0.0.2 data.
- Existing DTO compile errors are resolved or temporarily adapted in the same phase.
- Contracts represent the v0.0.2 API shape.

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
- Added the v0.0.2 schema fields and indexes for project keys, work item display keys, label archive state, and comment lifecycle state.
- Generated Drizzle migration `0001_easy_blade.sql` and rewrote the SQL to expand, backfill, and then constrain existing data.
- Backfilled project keys, work item numbers/display keys, project counters, and active label uniqueness.
- Updated seed data with deterministic project keys, work item keys, an archived label, and comment lifecycle fields.
- Updated shared contracts and DTO mapping for project keys, work item keys, archived labels, comment lifecycle fields, new label/comment requests, and expanded activity event types.
- Added atomic work item number allocation in the project repository because the new uniqueness constraints make counter increments part of the create path.
- Updated API and Angular test fixtures for the expanded DTO shape.
- Verified `npm run db:reset && npm run db:migrate && npm run db:seed`.
- Verified `npm run typecheck`.
- Verified `npm test`.

## Phase 2: Project Keys And Project Settings Backend

Goal: implement project key behavior, project settings updates, archive/reactivate commands, and project activity.

Scope:

- Add project repository support for:
  - finding by workspace/key;
  - checking whether a project has work items;
  - archiving/reactivating;
  - row updates for key/name/description.
- Add or extend project service behavior:
  - key normalization and validation;
  - default key generation from project name;
  - workspace key uniqueness;
  - key update blocked after work items exist;
  - archived/reactivated lifecycle commands;
  - project metadata activity events.
- Add endpoint handlers/routes:
  - `POST /api/projects/:projectId/archive`;
  - `POST /api/projects/:projectId/reactivate`;
  - update existing `PATCH /api/projects/:projectId` to handle key/name/description.
- Ensure archived projects remain readable.
- Update project DTO mapping.
- Add backend tests for project settings, keys, archive/reactivate, and activity.

Out of scope:

- Project settings UI.
- Work item key allocation.
- Archived-project write blocking outside project service.

Acceptance criteria:

- Creating a project without a key assigns a valid generated key.
- Creating/updating duplicate project keys fails.
- Updating a project key after work items exist fails.
- Archive/reactivate commands update state and record activity.
- Existing project list/detail/summary behavior still works with key fields.

Suggested commands:

```sh
npm test --workspace @worktrail/api -- projects
npm run typecheck --workspace @worktrail/api
```

Status:

- Completed on 2026-07-04.
- Added project repository helpers for workspace/key lookup, work item existence checks, key/name/description updates, and archive/reactivate state changes through the existing update path.
- Implemented project key normalization, validation, generated keys from project names, generated-key suffixing, workspace uniqueness checks, and key update blocking after work item creation.
- Added explicit `POST /api/projects/:projectId/archive` and `POST /api/projects/:projectId/reactivate` endpoints while preserving backward-compatible `PATCH` status handling.
- Recorded project activity for name changes, description changes, archive, and reactivate events.
- Added API tests for generated keys, explicit keys, duplicate key conflicts, key update blocking, settings activity, and archive/reactivate command activity.
- Verified `npm run typecheck --workspace @worktrail/api && npm test --workspace @worktrail/api -- projects`.
- Verified `npm run typecheck`.
- Verified `npm test`.

## Phase 3: Work Item Key Allocation And Archived Project Write Guards

Goal: assign stable display keys to work items and enforce archived-project write restrictions.

Scope:

- Add repository support for atomic project counter allocation.
- Update `WorkItemService.createWorkItem` to:
  - allocate `item_number`;
  - create immutable `display_key`;
  - run allocation, insert, labels, and activity in one transaction.
- Update all work item DTO mappings to include `itemNumber` and `displayKey`.
- Reject writes against archived projects for:
  - work item create;
  - work item update;
  - work item transition;
  - label assignment through work item update.
- Keep existing transition rules unchanged for active projects.
- Add backend tests for key allocation, display key uniqueness, archived-project write rejection, and existing transition behavior.

Out of scope:

- UI display of work item keys.
- Label administration.
- Comment lifecycle.

Acceptance criteria:

- New work items receive the next project-scoped number.
- Display keys remain stable after project metadata changes.
- Archived projects reject work item writes with a clear API error.
- Existing list/detail/board APIs include display keys.

Suggested commands:

```sh
npm test --workspace @worktrail/api -- work-items
npm run typecheck
```

Status:

- Completed on 2026-07-04.
- Confirmed work item number allocation and DTO display key mapping were already in place from Phase 1.
- Moved work item creation project validation into the write transaction and reject archived projects before counter allocation.
- Added archived-project write guards for work item create, work item update, label assignment through work item update, and work item transition.
- Preserved existing workflow transition rules for active projects.
- Added backend tests for sequential key allocation, stable display keys after project metadata changes, archived-project write rejection, and unchanged transition behavior.
- Verified `npm test --workspace @worktrail/api -- work-items`.
- Verified `npm run typecheck`.
- Verified `npm test`.

## Phase 4: Label Administration Backend

Goal: make labels a manageable project taxonomy through API and service behavior.

Scope:

- Add `LabelService`.
- Add repository support for:
  - active and archived label listing;
  - create;
  - update name/color;
  - archive;
  - reactivate;
  - active-name conflict checks.
- Update label list endpoint to support `includeArchived=true`.
- Add endpoint handlers/routes:
  - `POST /api/projects/:projectId/labels`;
  - `PATCH /api/labels/:labelId`;
  - `POST /api/labels/:labelId/archive`;
  - `POST /api/labels/:labelId/reactivate`.
- Reject label writes under archived projects.
- Reject assigning archived labels to work items.
- Record label lifecycle activity events.
- Add backend tests for label create/update/archive/reactivate, conflict handling, archived-project write rejection, archived-label assignment rejection, and activity.

Out of scope:

- Label administration UI.
- Work item create label UI.

Acceptance criteria:

- A project label can be created, renamed, recolored, archived, and reactivated through the API.
- Archived labels remain visible when requested and attached to existing work items.
- Archived labels are not assignable to new or updated work items.
- Label lifecycle activity is recorded.

Suggested commands:

```sh
npm test --workspace @worktrail/api -- labels
npm run typecheck --workspace @worktrail/api
```

Status:

- Completed on 2026-07-04.
- Added `LabelService` for project-scoped label listing, creation, update, archive, and reactivation.
- Added label repository support for active/default listing, archived-inclusive listing, active name conflict checks, updates, archive, and reactivation.
- Added `includeArchived=true` support to `GET /api/projects/:projectId/labels`.
- Added `POST /api/projects/:projectId/labels`, `PATCH /api/labels/:labelId`, `POST /api/labels/:labelId/archive`, and `POST /api/labels/:labelId/reactivate`.
- Enforced active-project write guards for label lifecycle commands.
- Enforced active-label assignment in work item create/update validation while preserving archived labels already attached to existing work items.
- Recorded label lifecycle activity events for create, name change, color change, archive, and reactivate.
- Added backend tests for label lifecycle, active-name conflicts, reactivation conflicts, archived-project write rejection, archived-label visibility, and archived-label assignment rejection.
- Verified `npm test --workspace @worktrail/api -- labels`.
- Verified `npm run typecheck --workspace @worktrail/api`.
- Verified `npm run typecheck`.
- Verified `npm test`.

## Phase 5: Comment Lifecycle Backend

Goal: support comment edit/delete with permission checks, tombstones, archived-project guards, and activity.

Scope:

- Add comment repository support for:
  - find by id;
  - update body;
  - soft-delete/tombstone.
- Extend `CommentService` with:
  - update comment;
  - delete comment;
  - owner/maintainer any-comment permission;
  - contributor own-comment permission;
  - deleted-comment operation rejection;
  - archived-project write rejection.
- Add endpoint handlers/routes:
  - `PATCH /api/comments/:commentId`;
  - `DELETE /api/comments/:commentId`.
- Update comment DTO mapping for edited/deleted fields and deleted-body hiding.
- Record `comment.edited` and `comment.deleted` events.
- Add backend tests for comment edit/delete, permissions, tombstone DTOs, archived-project write rejection, and activity.

Out of scope:

- Comment edit/delete UI.
- Rich text.
- Comment hard delete.

Acceptance criteria:

- Owners/maintainers can edit/delete any comment.
- Contributors can edit/delete their own comments only.
- Deleted comments render as tombstone DTOs and cannot be edited.
- Comment lifecycle activity is recorded without exposing deleted body text.

Suggested commands:

```sh
npm test --workspace @worktrail/api -- comments
npm run typecheck --workspace @worktrail/api
```

Status:

- Completed on 2026-07-04.
- Added comment repository support for finding by id, updating body with `edited_at`, and soft-deleting with `deleted_at`/`deleted_by_id`.
- Added `CommentService` update and delete behavior with owner/maintainer any-comment permissions and contributor own-comment permissions.
- Rejected edit/delete operations for deleted comments and all comment writes under archived projects.
- Added `PATCH /api/comments/:commentId` and `DELETE /api/comments/:commentId` endpoint handlers and routes.
- Returned tombstone DTOs for deleted comments, including `deletedBy`, while hiding deleted comment body text.
- Recorded `comment.edited` and `comment.deleted` activity without storing comment body text in activity values.
- Updated work item detail comment mapping to include deleted-by actors.
- Added backend tests for edit/delete permissions, tombstone DTOs, deleted-comment conflicts, archived-project write rejection, and lifecycle activity.
- Verified `npm test --workspace @worktrail/api -- comments`.
- Verified `npm run typecheck --workspace @worktrail/api`.
- Verified `npm run typecheck`.
- Verified `npm test`.

## Phase 6: Frontend Contracts And Project Settings UI

Goal: expose project keys and settings in the Angular app.

Scope:

- Update `WorktrailApiService` for project settings and archive/reactivate commands.
- Add `/projects/:projectId/settings` route.
- Add settings navigation from project home and relevant project work views.
- Build project settings page with:
  - project key/name/description form;
  - archive/reactivate controls;
  - clear archived-state messaging;
  - inline loading/error/success states.
- Display project keys in project list and project home.
- Disable or explain work actions when a project is archived where the project context is available.
- Add Angular tests for settings load/save/archive/reactivate and project key display.

Out of scope:

- Label administration UI.
- Work item key display, unless naturally touched by shared DTO updates.
- Project activity UI unless it is low-cost after settings data is available.

Acceptance criteria:

- Users can edit project metadata from the UI.
- Users can archive and reactivate a project from the UI.
- Project keys are visible in project list/home.
- Archived project state is visible and understandable.
- No full page refresh is required.

Suggested commands:

```sh
npm test --workspace @worktrail/web -- --include src/app/features/projects/**/*.spec.ts
npm run typecheck --workspace @worktrail/web
```

## Phase 7: Label Administration UI And Work Item Create Labels

Goal: let users manage labels and assign them during work item creation.

Scope:

- Update frontend API service with label create/update/archive/reactivate methods.
- Add label management section to project settings.
- Support active/archived label display.
- Use native color input for label color.
- Add create, edit, archive, and reactivate controls.
- Update work item create page to load active project labels.
- Allow label assignment during work item creation.
- Ensure work item detail assignment excludes archived labels but still shows already attached archived labels.
- Update list filter label options after label changes where local state is involved.
- Add Angular tests for label management and create-with-label flow.

Out of scope:

- Drag/drop.
- Label hard delete.
- Workspace-global labels.

Acceptance criteria:

- A user can create a label, assign it to a new work item, edit it, archive it, and reactivate it from the UI.
- Archived labels are not offered for new assignments.
- Existing work items can still show archived attached labels.
- Label form errors are visible and recoverable.

Suggested commands:

```sh
npm test --workspace @worktrail/web -- --include src/app/features/projects/**/*.spec.ts --include src/app/features/work-items/**/*.spec.ts
npm run typecheck --workspace @worktrail/web
```

## Phase 8: Work Item Key Display And Archived Project UX

Goal: make stable work item keys visible across the product and make archived-project behavior coherent.

Scope:

- Display `displayKey` in:
  - work item list rows;
  - board cards;
  - work item detail header;
  - project recent work;
  - page title or nearby metadata where useful.
- Update route-facing link text to include display keys where it improves scanning.
- Disable or hide write controls on archived projects:
  - create work item;
  - detail save;
  - status update;
  - comment add/edit/delete;
  - label assignment.
- Show a compact archived-project notice on relevant pages.
- Add Angular tests for key display and archived-project write-control behavior.

Out of scope:

- Searching by display key, unless it is trivial after backend search changes.
- Key-based routing.

Acceptance criteria:

- Users can visually identify and reference work items by key across list, board, detail, and project home.
- Archived projects read clearly as read-only.
- Disabled actions have understandable UI treatment.

Suggested commands:

```sh
npm test --workspace @worktrail/web -- --include src/app/features/**/*.spec.ts
npm run typecheck --workspace @worktrail/web
```

## Phase 9: Comment Edit/Delete UI

Goal: expose comment correction and deletion workflows on work item detail pages.

Scope:

- Add API service methods for update/delete comment.
- Add inline edit form with Save/Cancel.
- Add delete confirmation.
- Render edited marker/timestamp.
- Render deleted comment tombstones.
- Hide or disable controls based on local actor permissions where feasible.
- Still handle API permission rejections clearly.
- Refresh detail or comment/activity data after comment mutations.
- Add Angular tests for edit, delete, tombstone rendering, permission-like states, and failure handling.

Out of scope:

- Rich text editing.
- Comment hard delete.
- Threading/replies.

Acceptance criteria:

- A user can edit their comment and see the updated text.
- A user can delete a comment and see a tombstone.
- Activity updates after edit/delete.
- Rejected operations show clear errors.

Suggested commands:

```sh
npm test --workspace @worktrail/web -- --include src/app/features/work-items/work-item-detail-page.component.spec.ts
npm run typecheck --workspace @worktrail/web
```

## Phase 10: Board Drag And Drop

Goal: add direct board movement with Angular CDK while preserving server-side workflow validation and status menu fallback.

Scope:

- Install `@angular/cdk` in `apps/web`.
- Import CDK DragDrop primitives in the board component.
- Convert board columns to connected drop lists.
- Convert cards to draggable items.
- Keep status menus on cards.
- On cross-column drop:
  - ignore no-op same-status drops;
  - call existing transition endpoint;
  - use pessimistic state update;
  - refresh or regroup after success;
  - show error and keep original state on rejection.
- Avoid persisted card ordering.
- Add accessible drag handles or clear draggable affordance if needed.
- Add Angular tests for drop success, rejected transition, and status-menu fallback.

Out of scope:

- Persisted rank/order within a column.
- Custom workflow columns.
- Replacing status menus.

Acceptance criteria:

- A user can drag a card from backlog to ready and ready to in progress.
- Invalid drops are rejected and visibly restored.
- Status menu movement still works.
- Successful drag/drop records one status-change activity event.

Suggested commands:

```sh
npm test --workspace @worktrail/web -- --include src/app/features/work-items/work-item-board-page.component.spec.ts
npm run typecheck --workspace @worktrail/web
```

## Phase 11: Activity Surfaces, Documentation, And Extraction Notes

Goal: finish the user-visible activity/documentation layer for v0.0.2.

Scope:

- Surface project-level activity on project home or settings if the data is already available.
- Ensure work item detail activity displays new comment lifecycle events clearly.
- Ensure label/project activity summaries are readable.
- Update README:
  - setup remains accurate;
  - demo walkthrough includes v0.0.2 flows;
  - limitations are updated.
- Add or update jawstack extraction notes for:
  - scoped sequence allocation;
  - settings screens;
  - taxonomy administration;
  - lifecycle command routes;
  - soft-delete/tombstones;
  - CDK drag/drop command integration.
- Update static site copy or screenshot only if the visible product changes materially.

Out of scope:

- AWS deployment docs.
- Release notes beyond what is useful for v0.0.2.

Acceptance criteria:

- New activity event summaries are understandable in the UI.
- README reflects v0.0.2 behavior.
- Extraction notes capture concrete implementation evidence.
- Known limitations remain honest.

Suggested commands:

```sh
npm run typecheck
npm test
npm run build
```

## Phase 12: End-To-End Smoke And Release Readiness

Goal: verify v0.0.2 as a complete local app.

Scope:

- Extend or add a Playwright smoke path covering:
  1. reset/migrate/seed;
  2. create or open a project;
  3. create a label;
  4. create a work item with that label;
  5. verify display key;
  6. drag from backlog to ready and ready to in progress;
  7. add and edit a comment;
  8. delete the comment;
  9. verify activity.
- Run full verification:
  - database reset/migrate/seed;
  - API tests;
  - Angular tests;
  - Playwright e2e;
  - typecheck;
  - production build;
  - runtime dependency audit.
- Do final product QA for:
  - desktop layout;
  - narrow viewport layout;
  - labels;
  - archived projects;
  - drag/drop;
  - comment lifecycle.
- Update implementation plan status.
- Decide whether to tag v0.0.2 after user review.

Out of scope:

- npm package release.
- AWS deployment.
- Large e2e suite.

Acceptance criteria:

- `npm run db:reset && npm run db:migrate && npm run db:seed` passes.
- `npm test` passes.
- `npm run test:e2e` passes.
- `npm run typecheck` passes.
- `npm run build` passes.
- Runtime dependency audit has zero vulnerabilities.
- README and docs match actual commands and behavior.
- The local database is restored to deterministic seed state after e2e if the test mutates it.

Suggested commands:

```sh
npm run db:reset
npm run db:migrate
npm run db:seed
npm test
npm run test:e2e
npm run typecheck
npm run build
npm audit --omit=dev --audit-level=low
git diff --check
```

## Dependency Discipline

New dependencies should be directly justified by v0.0.2 scope. `@angular/cdk` is approved for drag/drop. Avoid adding:

- Angular Material visual components;
- global state libraries;
- color picker packages;
- modal/dialog frameworks;
- AWS deployment frameworks;
- auth providers;
- rich text editors.

## Definition Of Done

Each implementation phase should end with:

- targeted tests passing;
- typecheck passing for touched workspace when code changed;
- migration/seed verification when schema changed;
- clear status notes added to this plan;
- no unrelated refactors or metadata churn.

v0.0.2 as a whole is done when:

- a user can configure a project, manage labels, create keyed work items, move work by drag/drop, and manage comments without direct database edits;
- activity history explains the new lifecycle changes;
- local setup remains straightforward;
- the code still preserves the future cloud deployment path;
- docs accurately describe behavior and limitations.
