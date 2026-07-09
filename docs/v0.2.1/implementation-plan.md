# Worktrail v0.2.1 Implementation Plan

## Purpose

This plan turns the v0.2.1 PRD and technical design into sequential implementation phases.

v0.2.1 should add Cycle Planning: project-scoped, methodology-neutral execution windows that can be created, reviewed, assigned to work items, used in query-backed Work views, included in project report snapshots, and represented in seed data.

The release should preserve:

- local-first development;
- Angular static-hosting compatibility;
- transport-neutral API endpoint handlers;
- the local Express adapter;
- Postgres persistence;
- deterministic seed data;
- checked-in OpenAPI docs;
- GitHub Pages public site deployment;
- full local verification.

## Design Decisions

Use these decisions while implementing v0.2.1:

- Use `Cycle` as the user-facing object name.
- Add a project-shell review route at `/projects/:projectId/cycles/:cycleId`.
- Add cycle API routes under `/api/projects/:projectId/cycles`.
- Add one persisted table: `project_cycles`.
- Add nullable `work_items.cycle_id`.
- Keep cycles project-scoped; do not add workspace-wide or cross-project cycles.
- Allow one work item to belong to at most one cycle.
- Keep milestone assignment independent from cycle assignment.
- Enforce at most one active non-archived cycle per project at the database level.
- Enforce no overlapping non-archived `planned` or `active` cycle ranges at the service level.
- Keep completed and canceled cycles readable.
- Add optional `targetPoints` to cycles, backed by existing work item `estimatePoints`.
- Defer velocity, forecasting, member capacity, rollover automation, and ceremony management.
- Keep cycle lifecycle mutations owner/maintainer-only.
- Keep cycle list/review readable by contributors and on archived projects.
- Keep archived projects read-only.
- Add cycle assignment to work item create, detail edit, project bulk triage, and query filters.
- Include cycle filters in URLs, active chips, copy links, saved views, pinned views, and return URLs.
- Include cycle information in CSV export.
- Do not add CSV import cycle assignment in v0.2.1.
- Add active-cycle context to generated project status reports as an optional snapshot section.
- Keep project status report `snapshotVersion` at `1` because the cycle section is additive and optional.
- Add deterministic active, upcoming, completed, and risk-bearing seed cycles.
- Carry the already-committed `/work-items/:id` same-route navigation bugfix as part of the release notes.
- Keep pattern notes destination-neutral.

## Phase Sizing

Each phase should leave the repository in a coherent working state.

Implementation phases:

1. baseline planning;
2. contracts, constants, and activity type;
3. schema, migration, and repository;
4. cycle service lifecycle;
5. cycle review read model;
6. endpoint handlers, Express routes, and API tests;
7. work item assignment, filtering, and bulk behavior;
8. Planning, Reports, and CSV backend integration;
9. OpenAPI and seed data;
10. Angular API client, routes, and shared cycle UI plumbing;
11. Planning cycle manager and summaries;
12. Work item create/detail/list/board/bulk integration;
13. cycle review page, report rendering, and browser smoke;
14. documentation, public site, release notes, pattern notes, and final verification.

Run focused contract/API tests after backend phases, focused web tests after frontend phases, and full verification during finalization. Prefer small reusable helpers where cycle behavior mirrors milestone/report behavior, but avoid a generic planning-object abstraction in this release.

## Phase 0: Baseline Planning

Goal: confirm v0.2.1 planning inputs and repository state before runtime changes.

Scope:

- Confirm `docs/v0.2.1/prd.md` exists.
- Confirm `docs/v0.2.1/technical-design.md` exists.
- Confirm `docs/v0.2.1/implementation-plan.md` exists.
- Confirm active branch and repository status.
- Confirm no unresolved technical choice blocks Phase 1.
- Confirm no runtime files have been changed for v0.2.1 yet.
- Confirm sprint docs use destination-neutral pattern extraction language.
- Confirm whether a `v0.2.1` branch should be checked out before runtime work begins.

Out of scope:

- Runtime implementation.
- Database migration.
- Contract changes.
- UI changes.

Acceptance criteria:

- v0.2.1 planning inputs exist.
- Design decisions are recorded.
- Worktree/index state is understood before implementation starts.
- No open decision blocks Phase 1.
- Sprint docs use destination-neutral pattern extraction language.

Suggested commands:

```sh
find docs/v0.2.1 -maxdepth 1 -type f | sort
git status --short --branch
git diff --check
```

Status:

- Completed on 2026-07-09.
- Confirmed v0.2.1 planning inputs exist:
  - `docs/v0.2.1/prd.md`;
  - `docs/v0.2.1/technical-design.md`;
  - `docs/v0.2.1/implementation-plan.md`.
- Confirmed active branch is `v0.2.1` tracking `origin/v0.2.1`; no branch checkout is needed before runtime work begins.
- Confirmed current change state:
  - `docs/v0.2.1/` is untracked and contains only v0.2.1 planning documents;
  - no runtime files have been changed for v0.2.1 yet.
- Confirmed implementation decisions:
  - use `Cycle` as the product term;
  - add cycle review route `/projects/:projectId/cycles/:cycleId`;
  - add cycle API routes under `/api/projects/:projectId/cycles`;
  - persist cycles in `project_cycles`;
  - add nullable `work_items.cycle_id`;
  - keep cycles project-scoped and optional;
  - enforce one active non-archived cycle per project;
  - enforce no overlapping non-archived planned/active cycle ranges;
  - keep completed/canceled cycles readable;
  - defer CSV import cycle assignment, velocity, forecasting, member capacity, rollover automation, and ceremony management.
- Confirmed PRD open questions are resolved by the technical design and implementation plan:
  - Planning placement uses Planning with a `Cycles` management section, not a top-level nav item;
  - overlap validation applies to non-archived `planned` and `active` cycles;
  - CSV export includes cycle data while CSV import defers cycle assignment;
  - report snapshots include optional active-cycle context;
  - cycle target points are optional positive integers.
- Confirmed remaining technical-design questions are later UI implementation choices and do not block Phase 1.
- Confirmed sprint docs use destination-neutral pattern extraction language.
- Verified:
  - `find docs/v0.2.1 -maxdepth 1 -type f | sort`;
  - `git status --short --branch`;
  - `git branch --show-current`;
  - `git diff --check`.
- No unresolved technical choice blocks Phase 1.

## Phase 1: Contracts, Constants, And Activity Type

Goal: add shared cycle contracts and domain constants without database or runtime behavior changes.

Scope:

- Add `packages/contracts/src/cycles.ts` with:
  - `ProjectCycleStatus`;
  - `ProjectCycleDto`;
  - `CreateProjectCycleRequest`;
  - `UpdateProjectCycleRequest`;
  - `CycleReviewRiskType`;
  - `CycleReviewProgressDto`;
  - `CycleReviewScopeBreakdownDto`;
  - `CycleReviewRiskSectionDto`;
  - `ProjectCycleReviewDto`.
- Export cycle contracts from `packages/contracts/src/index.ts`.
- Update `packages/contracts/src/work-items.ts`:
  - add `cycleId?: string` to `WorkItemQuery`;
  - add `cycleId?: string | null` to create/update requests;
  - add `cycle: ProjectCycleDto | null` to relevant list/detail DTOs;
  - add bulk actions for `set_cycle` and `clear_cycle`.
- Update `packages/contracts/src/planning.ts`:
  - add `ProjectPlanningCycleSummaryDto`;
  - add `activeCycle`, `upcomingCycle`, and `recentlyCompletedCycle` to planning summary.
- Update `packages/contracts/src/projects.ts`:
  - add optional `ProjectStatusReportCycleSnapshotDto`;
  - add optional `cycle?: ProjectStatusReportCycleSnapshotDto | null` to report snapshots.
- Update `packages/contracts/src/activity.ts` with `work_item.cycle_changed` if activity types are contract-owned there.
- Update `apps/api/src/domain/constants.ts`:
  - add `projectCycleStatuses`;
  - add `ProjectCycleStatus` type;
  - add `work_item.cycle_changed` to API activity event constants if needed.
- Add or update contract tests for:
  - cycle DTO shape;
  - cycle review DTO shape;
  - work item query and bulk action compatibility;
  - planning cycle summary fields;
  - optional report snapshot cycle section;
  - cycle activity event type.

Out of scope:

- Database schema.
- API service behavior.
- Angular pages.
- OpenAPI.

Acceptance criteria:

- Shared contracts compile.
- Cycle DTOs are exported from `@worktrail/contracts`.
- Work item, Planning, and report contracts can carry cycle data.
- Existing contract consumers continue to compile.

Suggested commands:

```sh
npm test --workspace @worktrail/contracts
npm run typecheck --workspace @worktrail/contracts
npm run lint --workspace @worktrail/contracts
git diff --check
```

Status:

- Completed on 2026-07-09.
- Added `packages/contracts/src/cycles.ts` with:
  - `ProjectCycleStatus`;
  - `ProjectCycleDto`;
  - `CreateProjectCycleRequest`;
  - `UpdateProjectCycleRequest`;
  - `CycleReviewRiskType`;
  - `CycleReviewProgressDto`;
  - `CycleReviewScopeBreakdownDto`;
  - `CycleReviewRiskSectionDto`;
  - `ProjectCycleReviewDto`.
- Exported cycle contracts from `packages/contracts/src/index.ts`.
- Updated `packages/contracts/src/work-items.ts` with:
  - `cycleId?: string` on `WorkItemQuery`;
  - `cycleId?: string | null` on create/update requests;
  - required `cycle: ProjectCycleDto | null` on work item list/detail DTOs;
  - bulk `set_cycle` and `clear_cycle` actions.
- Updated `packages/contracts/src/planning.ts` with:
  - `ProjectPlanningCycleSummaryDto`;
  - nullable `activeCycle`, `upcomingCycle`, and `recentlyCompletedCycle` fields on `ProjectPlanningSummaryDto`.
- Updated `packages/contracts/src/projects.ts` with:
  - `ProjectStatusReportCycleSnapshotDto`;
  - optional nullable `cycle` on `ProjectStatusReportSnapshotDto`;
  - `cycle_review` report link type and optional `cycleId` link field.
- Added `work_item.cycle_changed` to:
  - `packages/contracts/src/activity.ts`;
  - `apps/api/src/domain/constants.ts`.
- Added `projectCycleStatuses` and `ProjectCycleStatus` to `apps/api/src/domain/constants.ts`.
- Added `packages/contracts/src/cycles.contract.test.ts` covering cycle DTOs, requests, cycle review DTOs, planning cycle summaries, risk types, query links, and cycle activity events.
- Updated existing contract tests for:
  - work item `cycleId` query support;
  - work item DTO `cycle` field;
  - bulk cycle actions;
  - optional report cycle snapshots;
  - cycle review report links.
- Added temporary API compatibility placeholders so existing API and web consumers continue to compile before schema/service hydration phases:
  - work item DTO mapping returns `cycle: null`;
  - Planning summaries return null cycle summaries;
  - project bulk cycle actions currently fail with a validation error until Phase 6 implements real behavior.
- Verified:
  - `npm test --workspace @worktrail/contracts`;
  - `npm run typecheck --workspace @worktrail/contracts`;
  - `npm run lint --workspace @worktrail/contracts`;
  - `npm run typecheck --workspace @worktrail/api`;
  - `npm run lint --workspace @worktrail/api`;
  - `npm test --workspace @worktrail/api`;
  - `npm run typecheck --workspace @worktrail/web`;
  - `git diff --check`.

## Phase 2: Schema, Migration, And Repository

Goal: add persisted project cycles and repository access.

Scope:

- Update `apps/api/src/db/schema.ts`:
  - add `projectCycles`;
  - add nullable `workItems.cycleId`;
  - add cycle check constraints;
  - add cycle indexes;
  - add partial unique index for one active non-archived cycle per project;
  - add active name uniqueness for non-archived cycles.
- Generate and review a Drizzle migration.
- Update Drizzle metadata.
- Update repository types:
  - `ProjectCycle`;
  - `NewProjectCycle`;
  - cycle update input shape.
- Add `apps/api/src/repositories/project-cycle-repository.ts` with:
  - `listByProject`;
  - `findById`;
  - `create`;
  - `update`;
  - `findActiveByProject`;
  - `findUpcomingByProject`;
  - `findRecentlyCompletedByProject`;
  - `findOverlappingPlannedOrActive`.
- Register the repository.
- Update any schema inventory or enum check tests.

Out of scope:

- Lifecycle service rules.
- Endpoint handlers.
- Work item assignment behavior.
- Seed cycles.

Acceptance criteria:

- Migrations apply from a clean reset.
- Existing work items remain valid with `cycle_id = null`.
- Repository methods compile and follow existing repository patterns.
- API workspace compiles.

Suggested commands:

```sh
npm run db:generate
npm run db:reset
npm run db:migrate
npm run typecheck --workspace @worktrail/api
npm run lint --workspace @worktrail/api
git diff --check
```

Status:

- Completed on 2026-07-09.
- Updated `apps/api/src/db/schema.ts`:
  - added `projectCycles`;
  - added nullable `workItems.cycleId`;
  - added cycle status, date range, and target point checks;
  - added cycle workspace, project/status, project/start date, and project/archived indexes;
  - added partial unique index for one active non-archived cycle per project;
  - added non-archived cycle name uniqueness per project;
  - added project/workspace cycle indexes on work items.
- Generated and reviewed Drizzle migration artifacts:
  - `apps/api/drizzle/0013_cuddly_dreadnoughts.sql`;
  - `apps/api/drizzle/meta/0013_snapshot.json`;
  - updated `apps/api/drizzle/meta/_journal.json`.
- Updated repository types:
  - `ProjectCycle`;
  - `NewProjectCycle`.
- Added `apps/api/src/repositories/project-cycle-repository.ts` with:
  - `create`;
  - `findById`;
  - `findActiveByProject`;
  - `findUpcomingByProject`;
  - `findRecentlyCompletedByProject`;
  - `findOverlappingPlannedOrActive`;
  - `listByProject`;
  - `update`;
  - `archive`;
  - `reactivate`.
- Registered `projectCycles` in the central repository factory.
- Updated typed API test fixtures to include `cycleId: null`, matching existing work item migration behavior.
- Verified generated SQL includes:
  - `project_cycles`;
  - nullable `work_items.cycle_id`;
  - project cycle foreign keys;
  - work item cycle foreign key;
  - partial active-cycle unique index;
  - cycle name unique index;
  - updated `activity_events_event_type_check` including `work_item.cycle_changed`.
- Verified:
  - `npm run db:generate --workspace @worktrail/api`;
  - `npm run db:migrate`;
  - `npm run typecheck --workspace @worktrail/api`;
  - `npm run lint --workspace @worktrail/api`;
  - `npm test --workspace @worktrail/api`;
  - `npm test --workspace @worktrail/contracts`;
  - `npm run typecheck --workspace @worktrail/web`;
  - `git diff --check`.
- Did not run `npm run db:reset` because it drops all tables in the current local database. A disposable clean database could not be created because the local `worktrail` Postgres role does not have `CREATE DATABASE` permission. The migration was applied successfully to the current local database instead.

## Phase 3: Cycle Service Lifecycle

Goal: implement cycle management behavior with permissions and validation.

Scope:

- Add `apps/api/src/validation/project-cycle.ts`.
- Add `apps/api/src/services/project-cycle-service.ts`.
- Implement:
  - `listCycles`;
  - `getCycle`;
  - `createCycle`;
  - `updateCycle`;
  - `archiveCycle`;
  - `reactivateCycle`.
- Validate request fields:
  - name;
  - goal;
  - status;
  - start/end dates;
  - target points.
- Enforce:
  - project exists in actor workspace;
  - cycle belongs to route project;
  - cycle belongs to actor workspace;
  - contributors cannot mutate cycles;
  - archived projects block mutations;
  - archived cycles cannot be mutated except reactivation;
  - one active cycle per project;
  - no overlapping non-archived planned/active cycles;
  - completed/canceled cycles remain readable.
- Add service helpers for downstream phases:
  - `validateAssignableCycle`;
  - `getActiveCycleSummaryForProject`;
  - `getPlanningCycleSummaries`.
- Map repository rows to `ProjectCycleDto`.
- Add focused service/API-level tests for lifecycle validation if endpoint tests do not cover enough behavior.

Out of scope:

- Cycle review risk sections.
- Express route registration.
- Work item assignment.
- Angular UI.

Acceptance criteria:

- Owners/maintainers can create, update, archive, and reactivate cycles.
- Contributors can read but not mutate cycles.
- Active-cycle and overlap conflicts are deterministic.
- Cross-project and cross-workspace ids do not leak data.

Suggested commands:

```sh
npm test --workspace @worktrail/api -- project-cycles.test.ts
npm run typecheck --workspace @worktrail/api
npm run lint --workspace @worktrail/api
git diff --check
```

## Phase 4: Cycle Review Read Model

Goal: build the derived cycle review DTO behind the service layer.

Scope:

- Implement `ProjectCycleService.getCycleReview`.
- Reuse existing risk-section and planning item helpers where practical.
- Add cycle-specific health derivation:
  - `complete` for completed cycles;
  - `inactive` for canceled or archived cycles;
  - `blocked` for active cycles with blocked or dependency-blocked work;
  - `at_risk` for overdue, stale, unassigned active, unestimated, or over-target scope;
  - `on_track` otherwise.
- Build review data:
  - project;
  - cycle;
  - progress;
  - health;
  - scoped work query;
  - status/priority/assignment/due/dependency breakdowns;
  - deterministic risk sections;
  - recently changed work capped at 8.
- Ensure risk section links include `cycleId`.
- Add tests for:
  - empty cycle review;
  - active healthy cycle;
  - over-target cycle;
  - blocked cycle;
  - stale/unassigned risk sections;
  - completed/canceled cycle health;
  - archived cycle readability.

Out of scope:

- HTTP endpoint registration.
- Angular review page.
- Planning page rendering.

Acceptance criteria:

- Review DTOs are deterministic.
- Risk links are valid work item queries.
- Review remains readable for contributors and archived/canceled/completed cycles.

Suggested commands:

```sh
npm test --workspace @worktrail/api -- project-cycle-review.test.ts
npm run typecheck --workspace @worktrail/api
npm run lint --workspace @worktrail/api
git diff --check
```

## Phase 5: Endpoint Handlers, Express Routes, And API Tests

Goal: expose cycle management and review through transport-neutral handlers and the local Express adapter.

Scope:

- Add `apps/api/src/endpoints/cycles.ts`.
- Add Express route registration in:
  - `apps/api/src/adapters/express/routes/cycle-routes.ts`; or
  - the existing planning routes if the resulting file stays simple.
- Register routes:
  - `GET /api/projects/:projectId/cycles`;
  - `POST /api/projects/:projectId/cycles`;
  - `GET /api/projects/:projectId/cycles/:cycleId`;
  - `PATCH /api/projects/:projectId/cycles/:cycleId`;
  - `POST /api/projects/:projectId/cycles/:cycleId/archive`;
  - `POST /api/projects/:projectId/cycles/:cycleId/reactivate`;
  - `GET /api/projects/:projectId/cycles/:cycleId/review`.
- Add integration tests for:
  - list/create/get/update;
  - archive/reactivate;
  - contributor mutation rejection;
  - archived project mutation rejection;
  - active conflict;
  - overlap conflict;
  - review response;
  - cross-project/cross-workspace behavior.
- Confirm endpoint handlers stay independent of Express request/response types.

Out of scope:

- Work item cycle assignment.
- OpenAPI.
- Angular client.

Acceptance criteria:

- Cycle API routes work through the Express adapter.
- Endpoint handlers follow existing handler patterns.
- API tests cover expected happy paths and permission failures.

Suggested commands:

```sh
npm test --workspace @worktrail/api -- project-cycles.test.ts project-cycle-review.test.ts
npm run typecheck --workspace @worktrail/api
npm run lint --workspace @worktrail/api
git diff --check
```

## Phase 6: Work Item Assignment, Filtering, And Bulk Behavior

Goal: make cycle assignment first-class in backend work item behavior.

Scope:

- Update work item create/update service behavior:
  - accept `cycleId`;
  - validate same-project assignment;
  - reject archived cycle assignment;
  - retain already-assigned archived cycle when unrelated fields change;
  - record `work_item.cycle_changed` activity when assignment changes.
- Hydrate `cycle` in work item list/detail DTOs.
- Update work item query parsing:
  - parse `cycleId`;
  - validate malformed ids consistently.
- Update repository query builder:
  - filter by `cycle_id`;
  - keep `cycleId` composable with status, priority, label, assignee, milestone, risk, dependency, due date, search, and sort filters.
- Update project bulk update:
  - `set_cycle`;
  - `clear_cycle`;
  - item-level failures for invalid assignments.
- Update notification behavior only if current planning-field watcher notifications cover similar assignment changes.
- Add tests for:
  - create with cycle;
  - update cycle;
  - clear cycle;
  - archived cycle assignment rejection;
  - cross-project cycle rejection;
  - activity event payload;
  - list/detail hydration;
  - project and workspace list filtering by `cycleId`;
  - bulk set/clear cycle;
  - cycle filter with saved query-shaped payloads.

Out of scope:

- Angular forms and filters.
- Planning summaries.
- Report snapshots.

Acceptance criteria:

- Work items can be assigned to cycles through backend contracts.
- Work item list/detail DTOs include cycle metadata.
- `cycleId` is a reliable query dimension.
- Bulk assignment works with existing project bulk result semantics.

Suggested commands:

```sh
npm test --workspace @worktrail/api -- work-items.test.ts work-item-query.test.ts project-bulk-work-items.test.ts
npm run typecheck --workspace @worktrail/api
npm run lint --workspace @worktrail/api
git diff --check
```

## Phase 7: Planning, Reports, And CSV Backend Integration

Goal: thread cycle data through Planning summaries, report snapshots, and CSV export.

Scope:

- Update `PlanningService`:
  - include `activeCycle`;
  - include `upcomingCycle`;
  - include `recentlyCompletedCycle`.
- Ensure Planning cycle summaries reuse the same progress/health derivation as cycle review.
- Update project status report generation:
  - include active-cycle snapshot when an active cycle exists;
  - set cycle snapshot to `null` when no active cycle exists;
  - keep old snapshots valid through optional runtime parsing.
- Update `apps/api/src/validation/project-status-report-snapshot.ts` for optional cycle snapshot validation.
- Update report Markdown rendering with a cycle section when present.
- Update CSV export:
  - include cycle name and/or id in an appropriate planning column position;
  - keep CSV import unchanged.
- Add tests for:
  - planning summary cycle fields;
  - report draft with active cycle;
  - report draft without active cycle;
  - published report detail with cycle snapshot;
  - legacy report snapshot without cycle;
  - Markdown rendering;
  - CSV export cycle column.

Out of scope:

- Angular Planning rendering.
- Angular report rendering.
- OpenAPI.

Acceptance criteria:

- Planning API exposes cycle summaries.
- Status reports preserve active cycle context without breaking existing reports.
- CSV export reflects visible cycle assignments.

Suggested commands:

```sh
npm test --workspace @worktrail/api -- planning.test.ts project-status-reports.test.ts project-status-report-markdown.test.ts work-item-export.test.ts
npm run typecheck --workspace @worktrail/api
npm run lint --workspace @worktrail/api
git diff --check
```

## Phase 8: OpenAPI And Seed Data

Goal: document cycle API behavior and provide deterministic cycle examples.

Scope:

- Update checked-in OpenAPI docs for:
  - cycle schemas;
  - cycle list/create/get/update/archive/reactivate/review routes;
  - work item `cycleId` request/query fields;
  - work item `cycle` response fields;
  - bulk cycle actions;
  - planning cycle summary fields;
  - report snapshot optional cycle section;
  - CSV export column if documented.
- Update seed data:
  - add active cycle `v0.2.1 Cycle Planning`;
  - add upcoming cycle `v0.2.2 Adoption Polish`;
  - add completed cycle `v0.2.0 Consolidation`;
  - assign representative work items;
  - include at least one blocked/risk-bearing cycle work item;
  - seed a cycle-focused saved view such as `Current cycle risks` if it strengthens QA.
- Ensure seed upserts are idempotent.
- Ensure reset/migrate/seed works from a clean database.

Out of scope:

- Angular UI.
- Public site docs.
- Release notes.

Acceptance criteria:

- OpenAPI matches implemented API and contracts.
- Seeded cycles are deterministic and useful for manual QA.
- Re-running seed does not duplicate cycles or assignments.

Suggested commands:

```sh
npm run db:reset
npm run db:migrate
npm run db:seed
npm test --workspace @worktrail/api
npm run typecheck --workspace @worktrail/api
npm run lint --workspace @worktrail/api
git diff --check
```

## Phase 9: Angular API Client, Routes, And Shared Cycle UI Plumbing

Goal: add frontend access to cycle APIs and route scaffolding before feature surfaces are wired in.

Scope:

- Add `apps/web/src/app/core/api/cycles-api.ts`.
- Add client methods:
  - `listCycles`;
  - `createCycle`;
  - `getCycle`;
  - `updateCycle`;
  - `archiveCycle`;
  - `reactivateCycle`;
  - `getCycleReview`.
- Add project-shell child route:
  - `/projects/:projectId/cycles/:cycleId`.
- Add a lazy `project-cycle-review-page.component`.
- Add feature-local cycle option helpers or a small store if repeated loading appears in several components.
- Add shared formatting helpers for:
  - cycle status labels;
  - date range labels;
  - cycle health labels.
- Add lightweight loading/error/empty states for the new route shell.
- Add or update web tests for API client URL construction and route presence where current test seams allow it.

Out of scope:

- Full cycle manager UI.
- Work item form fields.
- Review page content.

Acceptance criteria:

- Angular builds with a lazy cycle review route.
- Cycle API client follows existing domain client conventions.
- No old `WorktrailApiService` expansion is required unless compatibility demands it.

Suggested commands:

```sh
npm run typecheck --workspace @worktrail/web
npm run lint --workspace @worktrail/web
npm test --workspace @worktrail/web
git diff --check
```

## Phase 10: Planning Cycle Manager And Summaries

Goal: let users manage cycles and see current/upcoming/recent cycle context from Planning.

Scope:

- Update `project-planning-page.component.ts` or extracted Planning components to render:
  - active cycle summary;
  - upcoming cycle summary;
  - recently completed cycle summary;
  - links to cycle review and filtered Work.
- Add a `Cycles` management section near Milestones.
- Support owners/maintainers:
  - create cycle;
  - edit cycle fields;
  - status changes;
  - archive;
  - reactivate.
- Keep contributors read-only:
  - visible cycle list;
  - visible review links;
  - hidden/disabled mutation controls.
- Handle archived project read-only state.
- Decide during implementation whether completed/canceled cycles are shown collapsed by default; prefer collapsed if the list gets visually heavy.
- Add web tests for:
  - cycle summaries rendering;
  - cycle create validation;
  - cycle update/archive/reactivate;
  - contributor read-only behavior;
  - review and Work query links.

Out of scope:

- Work item form cycle assignment.
- Full cycle review content.
- Report pages.

Acceptance criteria:

- A maintainer can manage cycles from Planning.
- Contributors can inspect cycles without mutation controls.
- Planning summaries link users into actionable cycle review and Work views.

Suggested commands:

```sh
npm test --workspace @worktrail/web -- project-planning-page.component.spec.ts
npm run typecheck --workspace @worktrail/web
npm run lint --workspace @worktrail/web
git diff --check
```

## Phase 11: Work Item Create, Detail, List, Board, And Bulk Integration

Goal: expose cycle assignment and filtering across existing Work surfaces.

Scope:

- Update work item create page:
  - load cycle options after project selection;
  - include cycle dropdown;
  - default to no cycle unless a route/query context clearly supplies one.
- Update work item detail page:
  - show assigned cycle in metadata;
  - allow editing cycle assignment for permitted users;
  - include current assigned cycle even if archived/completed/canceled.
- Update project Work page:
  - add cycle filter control;
  - show active chip;
  - show cycle metadata in rows/cards;
  - support bulk set/clear cycle.
- Update workspace Work Items page:
  - support `cycleId` in query state;
  - show cycle filter only when project context is available, or clearly disable it until a project is selected.
- Update board cards where space allows:
  - show compact cycle metadata;
  - preserve existing status dropdown behavior.
- Update query serialization:
  - URL state;
  - active chips;
  - copy link;
  - return URL;
  - saved views;
  - pinned views;
  - stale cycle ids should be tolerated.
- Add web tests for:
  - create with cycle;
  - detail cycle edit;
  - list filter chip behavior;
  - copy link/query round trip;
  - saved view with cycle filter;
  - pinned view with cycle filter;
  - bulk set/clear cycle;
  - board card cycle display if implemented.

Out of scope:

- Cycle manager UI.
- Cycle review page content.
- Backend behavior already completed in earlier phases.

Acceptance criteria:

- Cycle assignment is available from normal work item workflows.
- Cycle filters behave like other query-backed filters.
- Bulk triage can commit or remove work from a cycle.
- Workspace and project Work views remain usable on narrow and wide screens.

Suggested commands:

```sh
npm test --workspace @worktrail/web -- work-item-create-page.component.spec.ts work-item-detail-page.component.spec.ts work-item-list-page.component.spec.ts workspace-work-item-list-page.component.spec.ts
npm run typecheck --workspace @worktrail/web
npm run lint --workspace @worktrail/web
git diff --check
```

## Phase 12: Cycle Review Page, Report Rendering, And Browser Smoke

Goal: complete the user-facing cycle review experience and prove it works against seeded data.

Scope:

- Implement `project-cycle-review-page.component`.
- Render:
  - cycle identity, goal, dates, and status;
  - progress counts and estimate progress;
  - target point comparison when present;
  - health state and reasons;
  - scope breakdown;
  - risk sections with links to filtered Work;
  - recently changed work.
- Keep zero-count risk sections readable without overwhelming the page.
- Add loading, not-found, permission, and archived states.
- Update project report detail/draft rendering to show cycle snapshot section when present.
- Add Playwright or existing browser smoke coverage for:
  - Planning cycle creation;
  - cycle review navigation;
  - filtered Work link from cycle review;
  - work item assignment to cycle;
  - report draft showing active cycle context.
- Do responsive QA on:
  - Planning cycle manager;
  - Work list filters;
  - cycle review page;
  - report pages.

Out of scope:

- Public site content.
- Release notes.
- New product features beyond cycle planning.

Acceptance criteria:

- Seeded cycle review pages are useful and actionable.
- Review links land on correctly filtered Work views.
- Report pages render optional cycle sections without breaking old reports.
- Browser smoke coverage exercises the main cycle workflow.

Suggested commands:

```sh
npm test --workspace @worktrail/web
npm run typecheck --workspace @worktrail/web
npm run lint --workspace @worktrail/web
npm run build
npm run test:e2e
git diff --check
```

## Phase 13: Documentation, Public Site, Release Notes, Pattern Notes, And Final Verification

Goal: finish v0.2.1 with accurate documentation and full verification.

Scope:

- Update README:
  - feature list;
  - local workflow notes if cycle seed data changes manual QA;
  - screenshots/capability descriptions where helpful.
- Update public static site:
  - capability copy for Cycle Planning;
  - product screenshots if the current screenshots no longer represent core workflow;
  - keep GitHub Pages workflow unchanged unless necessary.
- Add `docs/v0.2.1/release-notes.md`.
- Add `docs/v0.2.1/pattern-notes.md`.
- Mention the `/work-items/:id` same-route navigation bugfix in release notes.
- Update package versions to `0.2.1` if the release process continues mirroring product tags in package metadata.
- Run final verification:
  - lint;
  - typecheck;
  - unit/API/web tests;
  - E2E tests;
  - production build;
  - migration reset/migrate/seed;
  - diff hygiene.
- Record any known limitation or deferred follow-up in release notes.

Out of scope:

- Additional v0.2.2 feature planning.
- Dependency audit remediation unless a cycle-related dependency introduces a new issue.

Acceptance criteria:

- User-facing docs and public site match v0.2.1 capabilities.
- Release notes describe what changed, how to verify it, and what remains out of scope.
- Pattern notes capture reusable lessons without assuming a destination framework.
- Full verification is green or any residual issue is documented with a clear rationale.

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
git diff --check
git status --short --branch
```

## Rollback Notes

If a late cycle-planning issue appears before release:

- Backend-only failures can usually be contained by withholding route registration while keeping schema changes if migrations already landed.
- Frontend-only failures can be contained by hiding cycle controls while retaining API and seed data.
- Report snapshot issues should be rolled back by omitting the optional cycle section from new draft generation; existing reports remain compatible because the field is optional.
- CSV export issues can be contained by removing the new cycle column before release.

Do not ship partially wired cycle assignment where work items can store `cycle_id` but users cannot reliably see or clear that assignment.

## Final Release Gate

v0.2.1 is ready when:

- cycles can be created, updated, archived, reactivated, and reviewed;
- work items can be assigned to and filtered by cycles;
- project bulk triage can set and clear cycles;
- Planning summarizes current/upcoming/recent cycles;
- Reports include active cycle context;
- seeded data demonstrates the workflow;
- docs, public site, release notes, and pattern notes are current;
- full local verification passes.
