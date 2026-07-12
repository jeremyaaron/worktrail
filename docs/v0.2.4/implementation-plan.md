# Worktrail v0.2.4 Implementation Plan

## Purpose

This plan turns the v0.2.4 PRD and technical design into sequential implementation phases.

v0.2.4 should add Cycle Closeout and Carryover. Owners and maintainers should be able to preview an active cycle's closing state, choose one destination for unfinished work, complete the source cycle and carry work forward atomically, and review an immutable closeout result afterward.

The release should preserve:

- current cycle planning, review, filtering, saved-view, bulk-edit, and report behavior;
- current work item status, milestone, assignee, label, priority, estimate, and due-date values during carryover;
- contributor and archived-project read-only behavior;
- legacy completed cycles without fabricated snapshots;
- canonical cycle-filtered Work links;
- transport-neutral endpoint handlers and local Postgres operation;
- deterministic seed and browser test behavior;
- full local verification.

## Design Decisions

Use these decisions while implementing v0.2.4:

- Add project-shell route `/projects/:projectId/cycles/:cycleId/closeout`.
- Add:
  - `GET /api/projects/:projectId/cycles/:cycleId/closeout-preview`;
  - `POST /api/projects/:projectId/cycles/:cycleId/closeout`.
- Limit preview and apply endpoints to owners and maintainers.
- Treat preview as advisory and re-derive source scope inside the command transaction.
- Move all unfinished work to one planned same-project cycle or clear its cycle assignment.
- Treat `done` and `canceled` as terminal and retain them in the source cycle.
- Do not change work item workflow status or unrelated fields during closeout.
- Do not activate the destination cycle automatically.
- Persist one immutable, versioned `project_cycle_closeouts` record per source cycle.
- Use relational ownership/lookup columns plus compact JSONB snapshot evidence.
- Make matching closeout retries idempotent and different-destination retries conflict.
- Use PostgreSQL row locks and set-based work/activity writes inside one transaction.
- Add `cycle.closed` project activity and existing `work_item.cycle_changed` item activity.
- Do not create notifications for closeout.
- Make generic cycle creation/update unable to produce `completed` only when the closeout command is available in the same phase.
- Keep completed-cycle results inside existing Cycle Review and Planning surfaces.
- Keep frontend routes lazy loaded and split components before style budgets become a problem.
- Do not add analytics, automation, retrospectives, generic command infrastructure, or generic snapshot infrastructure.

## Phase Sizing

Each phase should leave the repository in a coherent working state.

Implementation phases:

1. baseline planning;
2. closeout contracts and activity vocabulary;
3. schema, migration, and set-based repositories;
4. snapshot validation and shared cycle evaluation;
5. closeout preview service and endpoint;
6. transactional closeout command and lifecycle cutover;
7. Cycle Review, Planning, and OpenAPI backend integration;
8. Angular closeout route and workflow;
9. completed-cycle review, Planning, and cycle-management UI integration;
10. seed data, browser smoke, and responsive/accessibility verification;
11. documentation, metadata, and final verification.

Run focused contract tests after Phase 1, migration/repository tests after Phase 2, pure model and parser tests after Phase 3, API tests after Phases 4-6, focused Angular tests after Phases 7-8, browser smoke after Phase 9, and full verification during Phase 10.

## Phase 0: Baseline Planning

Goal: confirm v0.2.4 planning inputs, repository state, and implementation decisions before runtime changes.

Scope:

- Confirm these planning documents exist:
  - `docs/v0.2.4/prd.md`;
  - `docs/v0.2.4/technical-design.md`;
  - `docs/v0.2.4/implementation-plan.md`.
- Confirm active branch and worktree/index state.
- Confirm no runtime files have been changed for v0.2.4.
- Confirm the technical design resolves all blocking choices.
- Confirm v0.2.4 requires one additive database migration.
- Confirm completion lifecycle cutover is deferred until the closeout command phase so intermediate phases do not remove existing completion behavior prematurely.
- Confirm no later user request has changed sprint scope.

Out of scope:

- Runtime implementation.
- Contract edits.
- Database generation.
- Tests beyond planning/diff hygiene.

Acceptance criteria:

- All three planning inputs exist.
- Repository state is understood before implementation starts.
- No unresolved technical decision blocks Phase 1.
- Phase boundaries preserve a usable cycle lifecycle throughout implementation.
- Scope remains Cycle Closeout and Carryover.

Suggested commands:

```sh
find docs/v0.2.4 -maxdepth 1 -type f | sort
git status --short --branch
git diff --check
rg -n "No blocking technical decisions|project_cycle_closeouts|closeout-preview|Completion Is Closeout-Only" docs/v0.2.4/*.md
```

Status:

- Completed on 2026-07-11.
- Confirmed all v0.2.4 planning inputs exist:
  - `docs/v0.2.4/prd.md`;
  - `docs/v0.2.4/technical-design.md`;
  - `docs/v0.2.4/implementation-plan.md`.
- Confirmed active branch is `v0.2.4` at the v0.2.3 merge baseline `48c4b0e`.
- Confirmed current change state:
  - `docs/v0.2.4/` is untracked and contains only the three planning documents;
  - the index is clean;
  - no runtime, package, migration, test, README, or site files have changed for v0.2.4.
- Confirmed implementation decisions:
  - add one additive `project_cycle_closeouts` migration without backfilling legacy completed cycles;
  - add closeout preview and apply endpoints under the project cycle route;
  - preserve direct completion until Phase 5 introduces the transactional closeout command and performs the lifecycle cutover in the same phase;
  - retain terminal work in the source cycle and move all unfinished work to one planned cycle or no cycle;
  - use an immutable versioned snapshot, transaction locks, set-based writes, idempotent replay, activity without notifications, and existing Cycle Review/Planning integration.
- Confirmed the technical design records no blocking technical decisions and no later request has changed sprint scope.
- Verified:
  - `find docs/v0.2.4 -maxdepth 1 -type f | sort`;
  - `git status --short --branch`;
  - `git diff --name-only`;
  - `git diff --cached --name-only`;
  - `git diff --check`;
  - `git log -1 --oneline --decorate`;
  - `git branch -vv`;
  - `rg -n "No blocking technical decisions|project_cycle_closeouts|closeout-preview|Completion Is Closeout-Only|lifecycle cutover|additive database migration|Phase 1" docs/v0.2.4/*.md`.
- No unresolved technical choice blocks Phase 1.

## Phase 1: Closeout Contracts And Activity Vocabulary

Goal: define the shared closeout data model and activity vocabulary without changing runtime lifecycle behavior yet.

Scope:

- Extend `packages/contracts/src/cycles.ts` with:
  - `ProjectCycleCloseoutItemSnapshotDto`;
  - `ProjectCycleCloseoutCountsDto`;
  - `ProjectCycleCloseoutDestinationDto`;
  - `ProjectCycleCloseoutSnapshotDto`;
  - `ProjectCycleCloseoutDto`;
  - `ProjectCycleCloseoutDestinationOptionDto`;
  - `ProjectCycleCloseoutPreviewDto`;
  - `CloseProjectCycleRequest`;
  - `CloseProjectCycleResultDto`.
- Keep `ProjectCycleReviewDto` and Planning DTO extensions deferred to Phase 6 to avoid forcing incomplete integration into existing consumers.
- Keep existing `CreateProjectCycleRequest` and `UpdateProjectCycleRequest` status types unchanged until Phase 5 lifecycle cutover.
- Add `cycle.closed` to:
  - `ActivityEventType`;
  - backend activity event constants/check vocabulary;
  - representative contract fixtures.
- Add focused contract tests for:
  - all destination discriminants;
  - closeout snapshot version `1` shape;
  - preview shape;
  - request/result shape;
  - activity event vocabulary.
- Export any new contract module if implementation chooses to split closeout types from `cycles.ts`.

Out of scope:

- Database schema and migration.
- Runtime snapshot validation.
- Service behavior.
- Generic cycle lifecycle restriction.
- Angular API methods.

Acceptance criteria:

- Shared closeout contracts compile and are exported.
- `cycle.closed` is recognized by compile-time activity types and backend constants.
- Existing cycle APIs continue to behave exactly as before.
- Contract tests demonstrate versioned snapshot and destination semantics.

Suggested commands:

```sh
npm run typecheck --workspace @worktrail/contracts
npm test --workspace @worktrail/contracts
npm run typecheck --workspace @worktrail/api
git diff --check
```

Status:

- Completed on 2026-07-11.
- Extended `packages/contracts/src/cycles.ts` with:
  - `ProjectCycleCloseoutItemSnapshotDto`;
  - `ProjectCycleCloseoutCountsDto`;
  - `ProjectCycleCloseoutDestinationDto`;
  - `ProjectCycleCloseoutSnapshotDto`;
  - `ProjectCycleCloseoutDto`;
  - `ProjectCycleCloseoutDestinationOptionDto`;
  - `ProjectCycleCloseoutPreviewDto`;
  - `CloseProjectCycleRequest`;
  - `CloseProjectCycleResultDto`;
  - shared `CycleReviewHealthDto` used by live review and closeout contracts.
- Kept closeout contracts in the existing cycle domain; `packages/contracts/src/index.ts` already exports `cycles.ts`, so no additional export module was needed.
- Added `cycle.closed` to:
  - shared `ActivityEventType`;
  - backend `activityEventTypes` vocabulary used by schema checks.
- Added `packages/contracts/src/cycle-closeout.contract.test.ts` covering:
  - `cycle`, `unplanned`, and `none` destination discriminants;
  - version `1` snapshot and persisted closeout shapes;
  - closeout preview, request, and result shapes;
  - `cycle.closed` compile-time activity vocabulary.
- Preserved existing `CreateProjectCycleRequest` and `UpdateProjectCycleRequest` status unions and made no lifecycle, service, endpoint, database, migration, or Angular changes.
- Verified:
  - `npm run typecheck --workspace @worktrail/contracts`;
  - `npm test --workspace @worktrail/contracts` (7 files, 21 tests passed);
  - `npm run typecheck --workspace @worktrail/api`;
  - `npm run typecheck --workspace @worktrail/web`;
  - `npm run lint --workspace @worktrail/contracts`;
  - `npm run lint --workspace @worktrail/api`.

## Phase 2: Schema, Migration, And Set-Based Repositories

Goal: add immutable closeout persistence and transaction-efficient repository operations.

Scope:

- Add `projectCycleCloseouts` to `apps/api/src/db/schema.ts` with:
  - relational workspace, project, cycle, closing-member, and optional destination-cycle columns;
  - versioned JSONB snapshot;
  - closed and created timestamps;
  - unique source-cycle constraint;
  - project/closed and destination indexes.
- Ensure the activity event check constraint accepts `cycle.closed`.
- Generate the next Drizzle migration and metadata.
- Do not backfill existing completed cycles.
- Add repository types:
  - `ProjectCycleCloseout`;
  - `NewProjectCycleCloseout`.
- Add and register `createProjectCycleCloseoutRepository` with:
  - `create`;
  - `findByCycleId`;
  - transaction-safe lookup if needed after source row lock.
- Extend repositories with:
  - `projectCycles.findByIdForUpdate`;
  - `workItems.listByCycleForUpdate`;
  - `workItems.updateCycleAssignments`;
  - `activityEvents.createMany`.
- Keep set-based updates empty-list safe.
- Order locked work rows deterministically.
- Add repository/integration tests for:
  - create/find closeout;
  - source-cycle uniqueness;
  - relational foreign keys;
  - ordering/index-backed lookup behavior where practical;
  - row-lock helper results;
  - bulk cycle assignment update;
  - multi-row activity insert;
  - no-op empty input.
- Verify fresh and incremental migration paths.

Out of scope:

- Snapshot parser.
- Preview or closeout services.
- Endpoint routes.
- Seed closeout data.

Acceptance criteria:

- Fresh migration creates `project_cycle_closeouts` and updated activity constraints.
- Existing databases migrate without fabricated closeout rows.
- One source cycle cannot have multiple closeout records.
- Repository helpers support one set-based work update and one set-based activity insert.
- Existing persistence tests remain green.

Suggested commands:

```sh
npm run db:reset
npm run db:migrate
npm test --workspace @worktrail/api -- tests/repositories.test.ts
npm run typecheck --workspace @worktrail/api
npm run lint --workspace @worktrail/api
git diff --check
```

Status:

- Completed on 2026-07-11.
- Added `project_cycle_closeouts` persistence with:
  - workspace, project, source cycle, closing member, and optional destination cycle foreign keys;
  - versioned JSONB snapshot;
  - closed and created timestamps;
  - unique source-cycle index;
  - workspace/project/closed, project/closed, and destination-cycle indexes;
  - restrictive default foreign-key delete behavior.
- Generated additive Drizzle migration `apps/api/drizzle/0014_dapper_hellfire_club.sql` and matching metadata.
- Confirmed the generated migration:
  - creates the closeout table without backfill statements;
  - replaces `activity_events_event_type_check` with a constraint containing `cycle.closed`.
- Added `ProjectCycleCloseout` and `NewProjectCycleCloseout` repository model types.
- Added and registered `createProjectCycleCloseoutRepository` with create and source-cycle lookup operations.
- Kept closeout lookup unlocked because Phase 5 will first lock the source cycle, which serializes closeout attempts even before a closeout row exists; the unique source-cycle index remains the database race guard.
- Added transaction-oriented repository operations:
  - `projectCycles.findByIdForUpdate`;
  - `workItems.listByCycleForUpdate` with deterministic id ordering;
  - empty-safe, set-based `workItems.updateCycleAssignments`;
  - empty-safe, multi-row `activityEvents.createMany`.
- Extended repository integration coverage for:
  - source-cycle and work-scope locks;
  - set-based cycle assignment updates;
  - empty update and activity inputs;
  - multi-row work item and `cycle.closed` activity insertion;
  - closeout create/find;
  - unique source-cycle enforcement;
  - destination-cycle foreign-key enforcement.
- Updated repository test cleanup to remove closeouts before cycles.
- Verified incremental migration against the existing v0.2.3 database with `npm run db:migrate`.
- Verified fresh migration and repository behavior with:
  - `npm run db:reset`;
  - `npm run db:migrate`;
  - `npm run db:seed`;
  - `npm test --workspace @worktrail/api -- tests/repositories.test.ts` (13 tests passed).
- Verified broader compatibility with:
  - `npm test --workspace @worktrail/api` (26 files, 272 tests passed);
  - `npm run typecheck --workspace @worktrail/api`;
  - `npm run lint --workspace @worktrail/api`;
  - `git diff --check`.

## Phase 3: Snapshot Validation And Shared Cycle Evaluation

Goal: establish safe immutable snapshot parsing and one shared source of cycle progress/health semantics.

Scope:

- Add `apps/api/src/validation/project-cycle-closeout-snapshot.ts`.
- Define strict Zod validation for snapshot version `1`.
- Validate:
  - identity/date/timestamp fields;
  - enum values;
  - source status `active`;
  - destination discriminants;
  - nonnegative counts and estimates;
  - retained/moved count equations;
  - item category/status consistency;
  - item array lengths against category counts.
- Expose stored snapshot parsing that returns a controlled `ConflictError` for malformed persisted data.
- Add service-level relational identity validation for row/snapshot project, cycle, and destination fields.
- Extract pure cycle evaluation behavior from `ProjectCycleService` into a focused module such as `cycle-review-model.ts`.
- Reuse existing:
  - work risk policy;
  - progress semantics;
  - health reasons;
  - scope breakdown;
  - dependency context.
- Keep `ProjectCycleService.getCycleReview()` behavior and output unchanged during this extraction.
- Add tests for:
  - valid and invalid closeout snapshots;
  - unsupported version;
  - category/count mismatch;
  - destination mismatch;
  - existing Cycle Review output parity before/after extraction;
  - deterministic evaluation with a fixed service clock.

Out of scope:

- Closeout preview endpoint.
- Transactional writes.
- Review DTO closeout property.
- UI.

Acceptance criteria:

- Persisted closeout JSON cannot reach rendering without runtime validation.
- Cycle Review tests prove no behavior regression from extraction.
- Preview and closeout phases can reuse pure evaluation functions without calling broad read methods inside a write transaction.

Suggested commands:

```sh
npm test --workspace @worktrail/api -- tests/project-cycle-closeout-snapshot.test.ts
npm test --workspace @worktrail/api -- tests/project-cycle-service.test.ts
npm run typecheck --workspace @worktrail/api
npm run lint --workspace @worktrail/api
git diff --check
```

Status:

- Completed on 2026-07-11.
- Added `apps/api/src/validation/project-cycle-closeout-snapshot.ts` with:
  - strict nested Zod schemas for snapshot version `1`;
  - UUID, ISO date/timestamp, enum, nonnegative count, estimate, and source-status validation;
  - strict unknown-field rejection;
  - completed/canceled/unfinished category-status validation;
  - item-array/count, retained-count, and moved-count equations;
  - committed, completed, unfinished, and unestimated estimate-total validation;
  - `none`, `unplanned`, and cycle destination semantics tied to unfinished scope;
  - controlled `ConflictError` behavior for malformed stored snapshots;
  - `ValidationError` behavior for requested snapshot validation;
  - relational project, cycle, and destination identity matching helper.
- Added `apps/api/src/services/cycle-review-model.ts` as a pure cycle evaluation boundary for:
  - progress;
  - delivery health and ordered reasons;
  - scope breakdown;
  - over-target state.
- Updated `ProjectCycleService.getCycleReview()` to keep repository reads, risk-section hydration, recent movement, and DTO assembly while delegating shared calculations to the pure model.
- Preserved existing Cycle Review response shape and behavior.
- Added `apps/api/tests/project-cycle-closeout-snapshot.test.ts` coverage for:
  - valid version `1` parsing;
  - unsupported version;
  - invalid UUID, source status, date, timestamp, and unknown fields;
  - category and count mismatches;
  - estimate and destination inconsistencies;
  - requested versus stored error classes;
  - relational record identity mismatches.
- Added `apps/api/tests/cycle-review-model.test.ts` with a fixed-clock blocked, dependency-blocked, overdue, stale, unassigned, unestimated, and over-target scenario.
- Verified focused behavior with:
  - `npm test --workspace @worktrail/api -- tests/project-cycle-closeout-snapshot.test.ts tests/cycle-review-model.test.ts tests/project-cycle-service.test.ts` (3 files, 20 tests passed).
- Verified broader compatibility with:
  - `npm test --workspace @worktrail/api` (28 files, 284 tests passed);
  - `npm run typecheck --workspace @worktrail/api`;
  - `npm run lint --workspace @worktrail/api`;
  - `git diff --check`.

## Phase 4: Closeout Preview Service And Endpoint

Goal: provide a permission-aware, read-only closeout preview from current server state.

Scope:

- Add `apps/api/src/services/project-cycle-closeout-service.ts` with preview behavior.
- Require owner or maintainer role.
- Require:
  - source project in actor workspace;
  - active project;
  - active, non-archived source cycle.
- Load and derive:
  - source-cycle work;
  - completed/canceled/unfinished categories;
  - target, committed, completed, unfinished, and unestimated totals;
  - health and reasons;
  - dependency-blocked unfinished signals;
  - eligible planned destination cycles.
- Sort unfinished items deterministically by status urgency, priority, display key, then id.
- Sort destinations by start date, name, then id.
- Exclude source, active, completed, canceled, archived, cross-project, and cross-workspace destinations.
- Add request validation and transport-neutral preview handler.
- Register `GET /api/projects/:projectId/cycles/:cycleId/closeout-preview` in Express.
- Update route inventory immediately.
- Add API/service tests for:
  - owner and maintainer success;
  - contributor rejection;
  - archived/non-active source rejection;
  - empty cycle;
  - no unfinished work;
  - no planned destinations;
  - status categorization;
  - estimate totals;
  - dependency flag;
  - deterministic ordering;
  - cross-workspace anti-enumeration.
- Keep preview read-only and verify no activity, closeout, or work writes occur.

Out of scope:

- POST closeout command.
- Generic completion restriction.
- OpenAPI final schema work.
- Angular page.

Acceptance criteria:

- Authorized maintainers can preview exactly what would close and move.
- Preview performs no writes.
- Preview uses the same progress and health semantics as Cycle Review.
- Invalid source state produces established structured errors.

Suggested commands:

```sh
npm test --workspace @worktrail/api -- tests/project-cycle-closeout.test.ts
npm test --workspace @worktrail/api -- tests/server.test.ts
npm run typecheck --workspace @worktrail/api
npm run lint --workspace @worktrail/api
git diff --check
```

Status:

- Completed on 2026-07-11.
- Added `ProjectCycleCloseoutService.preview()` with:
  - owner/maintainer authorization before entity lookup;
  - actor-workspace project and cycle isolation;
  - active-project and active/non-archived source-cycle enforcement;
  - source-cycle work, dependency-blocked work, blocking-open-work, member, and cycle reads;
  - shared cycle progress/health evaluation using one service-clock timestamp;
  - completed, canceled, and unfinished categorization;
  - committed, completed, unfinished, retained, and unestimated preview counts;
  - compact assignee and dependency-blocked item snapshots;
  - deterministic unfinished ordering by status urgency, priority, display key, and id;
  - deterministic planned destination ordering by start date, name, and id;
  - exclusion of source, non-planned, archived, cross-project, and cross-workspace destinations.
- Added transport-neutral `getProjectCycleCloseoutPreviewHandler`.
- Registered `GET /api/projects/:projectId/cycles/:cycleId/closeout-preview` in the Express cycle routes.
- Updated the exact Express route inventory assertion in `apps/api/tests/server.test.ts`.
- Added `apps/api/tests/project-cycle-closeout.test.ts` coverage for:
  - detailed mixed terminal/unfinished preview derivation;
  - estimate and unestimated totals;
  - blocked health and dependency flags;
  - unfinished and destination ordering;
  - assignee snapshot display;
  - empty cycle and no-destination response;
  - maintainer HTTP access;
  - contributor service and HTTP rejection;
  - archived project/source rejection;
  - planned, completed, and canceled source rejection;
  - cross-workspace project/cycle anti-enumeration;
  - no closeout, activity, or work-item timestamp writes during preview.
- Kept POST closeout, lifecycle restriction, OpenAPI, Angular, and all mutation behavior out of scope.
- Verified focused behavior with:
  - `npm test --workspace @worktrail/api -- tests/project-cycle-closeout.test.ts tests/server.test.ts` (2 files, 24 tests passed).
- Verified broader compatibility with:
  - `npm test --workspace @worktrail/api` (29 files, 289 tests passed);
  - `npm run typecheck --workspace @worktrail/api`;
  - `npm run lint --workspace @worktrail/api`;
  - `git diff --check`.

## Phase 5: Transactional Closeout Command And Lifecycle Cutover

Goal: atomically close an active cycle, carry unfinished work, preserve evidence, and make closeout the only public completion path.

Scope:

- Add `CloseProjectCycleRequest` runtime validation with required nullable destination id.
- Implement the closeout command inside `withRepositoriesTransaction`.
- Inside the transaction:
  - lock and validate source cycle;
  - resolve matching idempotent replay before requiring active status;
  - validate active project state;
  - lock and validate optional destination;
  - lock source-cycle work in deterministic order;
  - derive command-time evaluation and categories;
  - build version `1` snapshot from server state;
  - insert one closeout record;
  - mark source cycle completed;
  - set unfinished work cycle assignment through one bulk update;
  - insert item activity through one multi-row insert;
  - insert one `cycle.closed` project activity event.
- Return `applied: true` on first success and `applied: false` for matching replay.
- Return conflict for a replay with a different destination.
- Extract/reuse a shared cycle-change activity payload helper from `WorkItemService` so single and closeout updates use the same summaries and values.
- Do not create notifications.
- Add the transport-neutral command handler and Express `POST /closeout` route.
- Update route inventory immediately.
- Apply lifecycle cutover in the same phase:
  - add creatable/mutable cycle status unions;
  - restrict create to `planned | active`;
  - restrict generic update to `planned | active | canceled`;
  - reject status changes out of completed cycles;
  - prevent generic transition into completed;
  - retain legacy completed-cycle reads and metadata corrections.
- Update backend tests that previously created historical completed cycles through public service/API calls to use explicit repository fixtures or the new closeout command as appropriate.
- Add service/API tests for:
  - planned destination success;
  - null destination success;
  - no-unfinished success;
  - terminal item retention;
  - unrelated field preservation;
  - snapshot fidelity;
  - activity counts and payloads;
  - no notification creation;
  - same-destination replay;
  - different-destination replay conflict;
  - source/destination lifecycle and ownership conflicts;
  - command-time scope drift;
  - forced rollback after each major write boundary;
  - concurrent attempts producing one closeout.

Out of scope:

- Completed-cycle UI.
- Planning integration.
- Notifications.
- Reopen/undo.

Acceptance criteria:

- Successful closeout commits cycle completion, snapshot, carryover, and activity together.
- Any required write failure rolls back all closeout effects.
- Duplicate retries cannot duplicate work or history.
- Generic API paths can no longer produce new completed cycles without snapshots.
- Existing single-item cycle-change activity remains behaviorally compatible.

Suggested commands:

```sh
npm test --workspace @worktrail/api -- tests/project-cycle-closeout.test.ts
npm test --workspace @worktrail/api -- tests/project-cycles.test.ts
npm test --workspace @worktrail/api -- tests/work-items.test.ts
npm run typecheck --workspace @worktrail/api
npm run lint --workspace @worktrail/api
git diff --check
```

Status:

- Completed on 2026-07-11.

Implementation notes:

- Added strict runtime validation for `CloseProjectCycleRequest` and registered
  `POST /api/projects/:projectId/cycles/:cycleId/closeout` through the transport-neutral
  endpoint and Express route inventory.
- Implemented transactional cycle closeout with:
  - locked source and destination cycle validation;
  - command-time work locking and evaluation;
  - version `1` immutable snapshot creation;
  - source completion, unfinished carryover, and activity writes in one transaction;
  - planned-cycle and unplanned destinations plus empty-cycle completion;
  - matching idempotent replay and conflicting destination rejection;
  - serialized concurrent retries producing one applied closeout;
  - no notification side effects.
- Extracted `createWorkItemCycleChangedActivity` and reused it for individual work-item
  mutations and bulk closeout activity so summaries and previous/new values remain aligned.
- Added `cycle.closed` project activity with closeout, destination, moved, and retained metadata.
- Added creatable and mutable cycle status contracts and runtime enums:
  - create accepts only `planned | active`;
  - generic update accepts only `planned | active | canceled`;
  - completed-cycle status is immutable while metadata remains correctable.
- Updated the planning cycle controls to use separate create and mutation status choices and to
  render completed status as fixed during metadata editing.
- Replaced historical completed/canceled service fixtures with explicit repository fixtures.
- Added closeout and lifecycle coverage for destination, null-destination, empty-cycle, terminal
  retention, unrelated field preservation, snapshot fidelity, activity, notifications, replay,
  permission, ownership, lifecycle, scope drift, rollback, concurrency, HTTP validation, and route
  registration.
- Kept transaction-client queries sequential to avoid the `pg` concurrent-query deprecation path.
- Verified with:
  - `npm test --workspace @worktrail/api` (29 files, 297 tests passed);
  - `npm test --workspace @worktrail/contracts` (7 files, 21 tests passed);
  - `npm test --workspace @worktrail/web` (286 tests passed);
  - `npm run typecheck`;
  - `npm run lint`;
  - `git diff --check`.

## Phase 6: Cycle Review, Planning, And OpenAPI Backend Integration

Goal: expose immutable closeout results through existing review/planning reads and document the complete API.

Scope:

- Extend `ProjectCycleReviewDto` with `closeout: ProjectCycleCloseoutDto | null`.
- Extend `ProjectPlanningCycleSummaryDto` with compact closeout summary data.
- Update every contract fixture and consumer for the required nullable fields.
- Update `ProjectCycleService.getCycleReview()` to:
  - load closeout by cycle id;
  - parse and relationally validate stored snapshot;
  - load current closing-member DTO;
  - return closeout for completed cycles;
  - return `null` for active/planned/canceled and legacy completed cycles.
- Continue returning current live progress/risk fields for compatibility.
- Update `PlanningService` to include only compact closeout fields for the recently completed cycle.
- Ensure malformed persisted closeout data fails through a controlled conflict.
- Update `docs/api/openapi.yaml` with:
  - preview route;
  - closeout route;
  - request/result schemas;
  - closeout/snapshot/item/count/destination schemas;
  - review and planning extensions;
  - narrowed cycle create/update status enums;
  - permission, idempotency, null-destination, and conflict semantics.
- Add or update tests for:
  - completed cycle with closeout;
  - legacy completed cycle with `closeout: null`;
  - planning compact summary;
  - current member hydration;
  - invalid persisted snapshot;
  - route and OpenAPI assertions.

Out of scope:

- Angular closeout page.
- Seed data.
- Public site.

Acceptance criteria:

- Existing review URLs return immutable closeout data when available.
- Legacy completed cycles remain readable.
- Planning does not receive full snapshot item arrays.
- OpenAPI describes every implemented route and contract accurately.

Suggested commands:

```sh
npm test --workspace @worktrail/api -- tests/project-cycle-service.test.ts
npm test --workspace @worktrail/api -- tests/planning.test.ts
npm test --workspace @worktrail/api -- tests/openapi.test.ts
npm test --workspace @worktrail/contracts
npm run typecheck
git diff --check
```

Status:

- Completed on 2026-07-11.

Implementation notes:

- Extended cycle review responses with required nullable full closeout data and planning cycle
  summaries with required nullable compact closeout data.
- Added a shared persisted-closeout mapper that:
  - validates workspace, project, cycle, destination, and snapshot consistency;
  - parses versioned stored snapshots through the controlled conflict path;
  - hydrates the current closing-member DTO while retaining historical member identity in the
    immutable snapshot.
- Reused the mapper for command responses, idempotent replay, and completed-cycle review reads.
- Kept active, planned, canceled, and legacy completed cycle reviews explicit with
  `closeout: null`.
- Added compact planning projection containing only close timestamp, closing member identity,
  counts, and destination; full snapshot item arrays remain excluded.
- Expanded OpenAPI with:
  - preview and closeout command routes;
  - permission, null-destination, carryover, and idempotent retry semantics;
  - closeout preview, command, result, record, snapshot, count, item, destination, health, and
    compact planning schemas;
  - required nullable review/planning closeout fields;
  - distinct creatable and mutable cycle status enums.
- Added service, HTTP, planning, contract, and OpenAPI coverage for completed closeout reads,
  legacy absence, current-member hydration, compact projection, malformed stored data, route
  documentation, and lifecycle enum documentation.
- Verified with:
  - `npm test --workspace @worktrail/api` (29 files, 299 tests passed);
  - `npm test --workspace @worktrail/contracts` (7 files, 22 tests passed);
  - `npm test --workspace @worktrail/web` (286 tests passed);
  - `npx js-yaml docs/api/openapi.yaml`;
  - `npm run typecheck`;
  - `npm run lint`;
  - `git diff --check`.

## Phase 7: Angular Closeout Route And Workflow

Goal: build the guided preview, destination, confirmation, and submission workflow.

Scope:

- Extend `CyclesApi` with:
  - `getCloseoutPreview`;
  - `closeCycle`.
- Add focused API client tests for request method, path, body, and actor headers.
- Add lazy project-shell route:
  - `/projects/:projectId/cycles/:cycleId/closeout`.
- Add route test coverage.
- Add `ProjectCycleCloseoutPageComponent`.
- Split into focused presentational components if needed:
  - closeout summary;
  - unfinished work list;
  - destination/confirmation controls.
- Subscribe to route parameter changes and reload correctly.
- Render:
  - cycle identity and dates;
  - health/reasons;
  - total, completed, canceled, unfinished, and estimate metrics;
  - unfinished item rows;
  - dependency-blocked signals;
  - one destination choice;
  - explicit `Return to unplanned work` option.
- Default to earliest planned cycle when one exists and unfinished work is present.
- Handle no-unfinished and no-destination states.
- Use a typed reactive form and submit `{ destinationCycleId }` exactly.
- Disable stable-size controls while submitting.
- Navigate to Cycle Review after success.
- Handle `409` with clear copy and `Refresh preview` behavior.
- Add component tests for:
  - loading/error/retry;
  - route param changes;
  - metrics and unfinished rows;
  - destination defaults;
  - null destination;
  - no-unfinished state;
  - submit body;
  - duplicate local submission prevention;
  - conflict refresh;
  - success navigation.
- Run production build during the phase and split styles/components if budgets warn.

Out of scope:

- Completed Cycle Review rendering.
- Planning close link.
- E2E.

Acceptance criteria:

- A maintainer can preview and submit closeout from a reloadable route.
- The page makes clearing cycle assignment distinct from workflow backlog status.
- Submission and error states are visible and recoverable.
- Route remains lazy loaded and production build has no new budget warning.

Suggested commands:

```sh
npm test --workspace @worktrail/web -- --include 'src/app/core/api/cycles-api.spec.ts'
npm test --workspace @worktrail/web -- --include 'src/app/app.routes.spec.ts'
npm test --workspace @worktrail/web -- --include 'src/app/features/projects/cycle-closeout/project-cycle-closeout-page.component.spec.ts'
npm run typecheck --workspace @worktrail/web
npm run lint --workspace @worktrail/web
npm run build --workspace @worktrail/web
git diff --check
```

Status:

- Not started.

## Phase 8: Completed Review, Planning, And Cycle Management UI Integration

Goal: complete the lifecycle UI by exposing closeout entry points and durable completed-cycle results.

Scope:

- Update Cycle Review to compute role-aware closeout eligibility from:
  - selected actor role;
  - project active state;
  - source cycle active/non-archived state.
- Add `Close cycle` route action for eligible owners/maintainers.
- Hide closeout controls for contributors and archived state.
- Render completed cycles with closeout data as `Cycle result · Snapshot`.
- Show:
  - closed timestamp and actor;
  - target, committed, and completed points;
  - completed, canceled, retained, and moved counts;
  - destination result and destination-cycle link;
  - bounded completed/canceled/unfinished-at-close item groups;
  - accessible links to current work item detail.
- Label snapshot values and current links distinctly.
- Keep current/live context secondary and clearly labeled.
- Render honest legacy copy for completed cycles without closeout data.
- Update Planning recent-cycle summary with compact closeout result.
- Add a Planning active-cycle `Close` link for eligible actors without duplicating the workflow.
- Update cycle manager status options:
  - create: planned/active;
  - active: active/canceled plus Close route;
  - planned/canceled: valid non-completed transitions;
  - completed: read-only status.
- Preserve allowed completed-cycle metadata correction behavior without mutating snapshots.
- Add focused tests for:
  - role-aware close links;
  - contributor/archive suppression;
  - snapshot result rendering;
  - destination/current-work links;
  - bounded item groups;
  - legacy completed copy;
  - active live review regression;
  - Planning compact result;
  - cycle status menu restrictions.
- Run production build and component style budget checks.

Out of scope:

- Seed/E2E.
- Trends or cycle history page.
- Snapshot item pagination.

Acceptance criteria:

- Cycle Review provides one clear entry into closeout and one durable result afterward.
- Contributors can understand results without mutation affordances.
- Planning immediately communicates the latest closeout outcome.
- Generic cycle controls no longer expose direct completion.
- Snapshot and current state cannot be reasonably confused.

Suggested commands:

```sh
npm test --workspace @worktrail/web -- --include 'src/app/features/projects/project-cycle-review-page.component.spec.ts'
npm test --workspace @worktrail/web -- --include 'src/app/features/projects/project-planning-page.component.spec.ts'
npm test --workspace @worktrail/web -- --include 'src/app/features/projects/planning/cycle-manager.component.spec.ts'
npm test --workspace @worktrail/web -- --include 'src/app/features/projects/planning/cycle-summary-panel.component.spec.ts'
npm run typecheck --workspace @worktrail/web
npm run lint --workspace @worktrail/web
npm run build --workspace @worktrail/web
git diff --check
```

Status:

- Not started.

## Phase 9: Seed Data, Browser Smoke, And Responsive/Accessibility Verification

Goal: make closeout demonstrable in a fresh setup and verify the complete user workflow.

Scope:

- Inspect current Reference Operations and Worktrail App seed dependencies before editing.
- Add the smallest isolated closeout scenario with:
  - one active source cycle;
  - one planned destination cycle;
  - done work;
  - canceled work;
  - unfinished estimated work;
  - unfinished unestimated work;
  - dependency-blocked unfinished work.
- Keep the primary existing active-cycle and Portfolio scenarios intact.
- Do not seed a closeout for the cycle intended for interactive E2E.
- Add focused Playwright closeout coverage:
  - select Morgan Maintainer;
  - open active cycle review;
  - open closeout route;
  - verify preview totals and unfinished work;
  - choose planned destination;
  - confirm closeout;
  - verify durable snapshot result;
  - follow destination/current-work links;
  - verify carried item cycle-change activity.
- Keep the one-time closeout test isolated from other smoke tests and resilient to execution order.
- Verify contributor/archived affordance behavior in unit/API tests rather than attempting to close the same seed cycle twice in E2E.
- Capture and inspect Playwright screenshots for:
  - populated closeout preview;
  - completed result;
  - desktop 1440x900;
  - compact 1024x768;
  - mobile 390x844.
- Verify:
  - no horizontal overflow;
  - long titles/names wrap;
  - focus and keyboard order;
  - destination choice semantics;
  - loading/conflict/success announcement structure;
  - stable button dimensions.
- Run all existing browser smoke after focused closeout smoke.

Out of scope:

- Screenshot regression infrastructure.
- New production assets.
- Exhaustive browser testing of every error response.

Acceptance criteria:

- Fresh seed supports a meaningful closeout walkthrough.
- E2E proves preview, apply, result, carryover, and activity behavior.
- Existing Portfolio, Planning, Cycle Review, Reports, Work, and saved-view smoke remain green.
- Desktop and mobile layouts are non-overlapping and keyboard usable.

Suggested commands:

```sh
npm run db:reset
npm run db:migrate
npm run db:seed
npx playwright test -g "cycle closeout"
npm run test:e2e
npm run build --workspace @worktrail/web
git diff --check
```

Status:

- Not started.

## Phase 10: Documentation, Metadata, And Final Verification

Goal: finish v0.2.4 with accurate product/reference documentation and a fully verified release candidate.

Scope:

- Update README:
  - current capability baseline;
  - cycle closeout workflow;
  - snapshot/live-state distinction;
  - local walkthrough;
  - current limitations.
- Add `docs/v0.2.4/release-notes.md`.
- Add `docs/v0.2.4/pattern-notes.md` covering:
  - preview-and-apply commands;
  - naturally idempotent one-time transitions;
  - relational ownership plus JSONB evidence;
  - shared live/snapshot derivation;
  - set-based side effects;
  - snapshot/current-state framing.
- Keep pattern notes destination-neutral.
- Update static product site if Cycle Closeout materially strengthens concise cycle-planning copy.
- Update first-party package metadata to `0.2.4`:
  - root package;
  - API;
  - web;
  - contracts;
  - lockfile workspace metadata.
- Review all implementation-plan phase statuses and verification records.
- Run fresh database setup and full verification.
- Check dependency audit results and resolve actionable production findings.
- Inspect production build budgets.
- Check docs and code for stale v0.2.3 baseline claims.
- Confirm no references to a presumed pattern extraction destination were introduced.
- Record deferred opportunities and any residual risks honestly.

Out of scope:

- Creating a git tag or GitHub release unless separately requested.
- Production deployment infrastructure.
- v0.2.5 planning.

Acceptance criteria:

- README, OpenAPI, release notes, pattern notes, package metadata, and public site are consistent with implemented behavior.
- Full database, lint, typecheck, unit/API/web, E2E, build, audit, and diff checks pass.
- No new component or initial bundle budget warning remains unexplained.
- All phase statuses accurately reflect completed work.
- Deferred analytics, automation, notifications, and reopen behavior remain explicit.

Suggested commands:

```sh
npm install --package-lock-only
npm run db:reset
npm run db:migrate
npm run db:seed
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build
npm audit --omit=dev --audit-level=low
git diff --check
git status --short --branch
```

Status:

- Not started.

## Phase Completion Protocol

When executing a phase:

- Re-read that phase and the latest user request before editing.
- Inspect overlapping user changes and preserve them.
- Implement only the current phase unless a compile/test dependency requires a tightly coupled adjustment.
- Run the phase's focused verification.
- Update the phase `Status` with:
  - completion date;
  - concrete files/behaviors delivered;
  - exact verification performed;
  - any intentional deviation from the draft plan.
- Keep later phases marked `Not started` until their runtime work is actually complete.
- Do not defer failures in transaction rollback, idempotency, snapshot validation, lifecycle bypass, or permission enforcement to finalization.

## Release Completion Criteria

v0.2.4 is complete when:

- maintainers can preview and close an active cycle through the guided route;
- closeout atomically stores immutable evidence, completes the cycle, and moves unfinished work;
- matching retries are idempotent and conflicting retries cannot rewrite history;
- generic public cycle APIs cannot bypass closeout to produce new completed cycles;
- completed and canceled work remains attached to the source cycle;
- carried work changes only cycle assignment and update timestamp;
- completed Cycle Review and Planning show accurate snapshot outcomes;
- legacy completed cycles remain readable without fabricated history;
- contributor and archived-project paths remain read-only;
- closeout creates expected activity and no notifications;
- fresh seed and E2E demonstrate the workflow;
- README, OpenAPI, release notes, pattern notes, package metadata, and public site are current;
- full verification is green.
