# Worktrail v0.0.8 Implementation Plan

## Purpose

This plan turns the v0.0.8 PRD and technical design into sequential implementation phases. v0.0.8 should make execution risk visible by adding work item relationships, dependency-blocked signals, dependency filters, relationship activity, and release documentation.

The release remains local-first. It should preserve the Angular static-hosting path, transport-neutral API handlers, local Express adapter, Postgres migration discipline, deterministic seed data, production preview, checked-in OpenAPI reference, and clean verification from a fresh checkout.

## Design Decisions

Use these decisions while implementing v0.0.8:

- Add two relationship types: `blocks` and `relates_to`.
- Store both types in a single `work_item_relationships` table.
- Treat `blocks` as directional from source work item to target work item.
- Treat `relates_to` as symmetric by storing canonical source/target ID order.
- Allow cross-project relationships inside the same workspace.
- Reject cross-workspace, self, and duplicate relationships.
- Prevent all blocking cycles.
- Use the existing work item edit policy for relationship writes.
- Keep relationship creation/deletion on the work item detail route.
- Do not automatically transition work item status based on relationships.
- Derive dependency-blocked state from open upstream blockers at read time.
- Treat `done` and `canceled` as terminal statuses.
- Add one dependency query param with values `dependency_blocked` and `blocking_open_work`.
- Ensure project list, workspace discovery, saved views, and CSV export all use the same dependency filter semantics.
- Add a small My Work dependency-blocked summary.
- Extend planning with dependency-risk sections.
- Record project/work item activity for relationship changes.
- Defer graph visualization, automation, notifications, custom relationship types, hierarchy, materialized dependency read models, and cloud infrastructure.

## Phase Sizing

Each phase should leave the repository in a coherent working state. Build from durable backend primitives outward:

1. contracts and schema;
2. repositories and services;
3. endpoint wiring;
4. derived dependency state on existing reads;
5. frontend relationship management;
6. filters, saved views, and export;
7. dashboard/planning signals;
8. OpenAPI, e2e, docs, and final verification.

Run backend tests after backend phases, frontend tests after UI phases, and full verification during finalization. Keep seed data deterministic because relationship state affects dashboard/list counts.

## Phase 0: Baseline Planning

Goal: confirm v0.0.8 planning inputs and resolve implementation choices before code changes.

Scope:

- Confirm `docs/v0.0.8/prd.md` exists.
- Confirm `docs/v0.0.8/technical-design.md` exists.
- Confirm `docs/v0.0.8/implementation-plan.md` exists.
- Confirm design decisions listed above.
- Check repository status before implementation starts.
- Confirm the active branch and any staged changes.

Out of scope:

- Dependency changes.
- Runtime implementation.
- Database migrations.
- API documentation implementation.

Acceptance criteria:

- The three v0.0.8 planning documents exist.
- No unresolved open decision blocks Phase 1.
- The worktree/index state is understood before implementation starts.

Suggested commands:

```sh
find docs/v0.0.8 -maxdepth 1 -type f | sort
git status --short --branch
```

Status:

- Completed on 2026-07-05.
- Confirmed `docs/v0.0.8/prd.md`, `docs/v0.0.8/technical-design.md`, and `docs/v0.0.8/implementation-plan.md` exist.
- Confirmed implementation decisions:
  - add `blocks` and `relates_to` relationship types;
  - store both in one `work_item_relationships` table;
  - keep `blocks` directional;
  - canonicalize symmetric `relates_to` source/target order;
  - allow cross-project relationships inside the same workspace;
  - reject cross-workspace, self, duplicate, and cyclic blocking relationships;
  - use existing work item edit policy for relationship writes;
  - keep relationship management on work item detail;
  - derive dependency-blocked state at read time;
  - use `done` and `canceled` as terminal statuses;
  - use one dependency query param with `dependency_blocked` and `blocking_open_work`;
  - preserve dependency filter semantics across project lists, workspace discovery, saved views, and CSV export;
  - add My Work and planning dependency-risk signals;
  - record project/work item relationship activity;
  - defer graph visualization, automation, notifications, custom relationship types, hierarchy, materialized dependency read models, and cloud infrastructure.
- Confirmed current branch is `v0.0.8`.
- Confirmed current change state: `docs/v0.0.8/` is untracked and contains the three planning documents; no code changes are present yet.
- Verified `git diff --check`.
- No unresolved open decision blocks Phase 1.

## Phase 1: Contracts, Domain Constants, And Schema

Goal: establish relationship contracts, domain constants, database schema, migration, and deterministic seed data.

Scope:

- Add shared contract types:
  - `WorkItemRelationshipType`;
  - `DependencyFilter`;
  - `WorkItemRelationshipWorkItemDto`;
  - `WorkItemRelationshipItemDto`;
  - `WorkItemRelationshipSummaryDto`;
  - `CreateWorkItemRelationshipRequest`;
  - `WorkItemRelationshipDto`.
- Extend list/detail/query contracts:
  - dependency counts on `WorkItemListItemDto`;
  - relationships on `WorkItemDetailDto`;
  - dependency query filter on `WorkItemQuery`;
  - dependency-blocked My Work summary key;
  - planning dependency-risk DTOs if needed by current planning model.
- Add API domain constants for relationship types and relationship activity event types.
- Add `work_item_relationships` to Drizzle schema.
- Generate and review a migration.
- Add seed relationships:
  - same-project `blocks`;
  - cross-project `blocks`;
  - `relates_to`;
  - one active dependency-blocked downstream item;
  - one downstream item blocked only by a terminal item.
- Update seed assumptions in tests if deterministic counts change.

Out of scope:

- Relationship service behavior.
- Endpoint handlers.
- Frontend UI.
- Query filter implementation.

Acceptance criteria:

- Contracts compile.
- Migration creates relationship table, constraints, and indexes.
- Seed runs from a clean reset.
- No relationship behavior is exposed through API yet.

Suggested commands:

```sh
npm run db:generate --workspace @worktrail/api
npm run typecheck --workspace @worktrail/contracts
npm run typecheck --workspace @worktrail/api
npm run db:reset
npm run db:migrate
npm run db:seed
git diff --check
```

Status:

- Completed on 2026-07-05.
- Added shared contracts:
  - `WorkItemRelationshipType`;
  - `DependencyFilter`;
  - `WorkItemRelationshipWorkItemDto`;
  - `WorkItemRelationshipItemDto`;
  - `WorkItemRelationshipSummaryDto`;
  - `CreateWorkItemRelationshipRequest`;
  - `WorkItemRelationshipDto`.
- Extended work item contracts with neutral Phase 1 relationship fields:
  - dependency counts on `WorkItemListItemDto`;
  - relationship summary on `WorkItemDetailDto`;
  - dependency query filter on `WorkItemQuery`;
  - dependency-blocked My Work summary key;
  - `dependencyBlockedAssigned` dashboard list;
  - planning dependency-risk arrays.
- Added API domain constants for relationship types and relationship activity event types.
- Added `work_item_relationships` to the Drizzle schema.
- Generated migration `apps/api/drizzle/0005_hot_post.sql`.
- Added repository inferred types for work item relationships.
- Added neutral DTO defaults so existing API reads compile before Phase 2/3 populate relationship data.
- Added deterministic seed relationships:
  - same-project `blocks`;
  - cross-project `blocks`;
  - `relates_to`;
  - an active dependency-blocked downstream case;
  - a terminal-blocker case that should not count as dependency-blocked later.
- Verified seeded relationship counts through the Node `pg` client:
  - `blocks`: 3;
  - `relates_to`: 1.
- Verified `npm run db:generate --workspace @worktrail/api`.
- Verified `npm run typecheck --workspace @worktrail/contracts`.
- Verified `npm run typecheck --workspace @worktrail/api`.
- Verified `npm run typecheck --workspace @worktrail/web`.
- Verified `npm run db:reset`.
- Verified `npm run db:migrate`.
- Verified `npm run db:seed`.
- Verified `git diff --check`.

## Phase 2: Relationship Repository

Goal: add database access for relationship edges, cycle checks, relationship summaries, and dependency counts.

Scope:

- Add `apps/api/src/repositories/work-item-relationship-repository.ts`.
- Add repository type exports and wire into `createRepositories`.
- Implement:
  - create relationship;
  - find by ID;
  - find duplicate between source/target/type;
  - list relationships for one work item;
  - list relationships for many work items;
  - delete relationship;
  - recursive CTE cycle detection for `blocks`;
  - batch dependency counts for work item IDs.
- Join relationship rows to work item, project, member, assignee data where repository patterns support it, or keep joins in service mapping if cleaner.
- Add repository tests for:
  - create/list/delete;
  - duplicate lookup;
  - symmetric canonical lookup support;
  - multi-hop cycle detection;
  - open blocker and open blocked-work count aggregation.

Out of scope:

- Permission checks.
- Activity creation.
- Endpoint handlers.
- Frontend UI.

Acceptance criteria:

- Repository methods support all service needs without N+1 list count queries.
- Cycle detection catches direct and multi-hop cycles.
- Dependency counts ignore terminal blockers/downstream work.

Suggested commands:

```sh
npm test --workspace @worktrail/api -- work-item-relationship-repository
npm run typecheck --workspace @worktrail/api
git diff --check
```

Status:

- Completed on 2026-07-05.
- Added `apps/api/src/repositories/work-item-relationship-repository.ts`.
- Wired `workItemRelationships` into `createRepositories` and transactional repository binding.
- Implemented relationship repository methods:
  - create relationship;
  - find by ID;
  - find exact source/target/type duplicate;
  - list relationships for one work item;
  - list relationships for many work items;
  - delete relationship;
  - recursive CTE cycle detection for proposed `blocks` relationships;
  - batch open blocker and open blocked-work count aggregation.
- Kept rich work item/project/member DTO joins out of the repository for Phase 2; Phase 3 service mapping will use repository rows plus existing repositories.
- Extended repository integration tests for:
  - create/find/list/delete;
  - duplicate lookup;
  - canonical `relates_to` lookup support;
  - direct and multi-hop cycle detection;
  - open blocker and open blocked-work count aggregation;
  - empty dependency count inputs.
- Verified `npm test --workspace @worktrail/api -- repositories`.
- Verified `npm run typecheck --workspace @worktrail/api`.
- Verified `npm test --workspace @worktrail/api`.

## Phase 3: Relationship Service And DTO Mapping

Goal: implement relationship business rules, DTO mapping, activity events, and detail/list dependency enrichment.

Scope:

- Add `apps/api/src/services/work-item-relationship-service.ts`.
- Add relationship DTO mapping helpers in `apps/api/src/services/dto.ts` or a focused helper module.
- Implement relationship summary grouping:
  - `blockedBy`;
  - `blocks`;
  - `related`;
  - `dependencyBlocked`;
  - `openBlockerCount`;
  - `openBlockedWorkCount`.
- Implement relationship create:
  - require source and target work items in actor workspace;
  - reject self relationship;
  - canonicalize `relates_to`;
  - reject duplicates;
  - reject `blocks` cycles;
  - enforce archived-project write protection for source and target;
  - enforce current work item edit policy;
  - create activity event.
- Implement relationship delete:
  - require context work item to be source or target;
  - enforce archived-project write protection;
  - enforce current work item edit policy;
  - create activity event;
  - delete relationship.
- Extend `WorkItemService` detail/list DTO construction to include relationship summary/counts.
- Add service tests for:
  - create `blocks`;
  - create `relates_to`;
  - inbound/outbound/related grouping;
  - self rejection;
  - duplicate rejection;
  - reverse duplicate rejection for `relates_to`;
  - direct and multi-hop cycle rejection;
  - cross-project relationship inside workspace;
  - cross-workspace rejection;
  - archived-project write rejection;
  - contributor edit policy;
  - delete relationship;
  - dependency count enrichment;
  - relationship activity.

Out of scope:

- HTTP endpoint handlers.
- Frontend UI.
- Query filters.

Acceptance criteria:

- Service enforces all relationship write invariants.
- Work item detail DTO includes relationships.
- List DTOs include dependency counts without full relationship detail.
- Activity copy is understandable and includes related work item identifiers.

Suggested commands:

```sh
npm test --workspace @worktrail/api -- work-item-relationship
npm test --workspace @worktrail/api -- work-item-service
npm run typecheck --workspace @worktrail/api
git diff --check
```

Status:

- Completed on 2026-07-05.
- Added `apps/api/src/services/work-item-relationship-service.ts`.
- Added relationship DTO mapping in the relationship service and extended shared DTO helpers with dependency count inputs.
- Implemented relationship summary grouping:
  - `blockedBy`;
  - `blocks`;
  - `related`;
  - `dependencyBlocked`;
  - `openBlockerCount`;
  - `openBlockedWorkCount`.
- Implemented relationship creation with:
  - actor workspace scoping;
  - self-relationship rejection;
  - `relates_to` canonicalization;
  - duplicate rejection;
  - `blocks` cycle rejection;
  - archived-project write protection for source and target projects;
  - existing work item edit policy enforcement;
  - project/work item activity creation.
- Implemented relationship deletion with:
  - context work item membership validation;
  - archived-project write protection;
  - existing work item edit policy enforcement;
  - context-aware activity creation;
  - relationship deletion.
- Extended `WorkItemService` list DTO construction with batched dependency counts.
- Extended `WorkItemService` detail DTO construction with full relationship summaries.
- Added `apps/api/tests/work-item-relationships.test.ts` covering:
  - create `blocks`;
  - create `relates_to`;
  - inbound/outbound/related grouping;
  - self rejection;
  - duplicate rejection;
  - reverse duplicate rejection for `relates_to`;
  - direct and multi-hop cycle rejection;
  - cross-project relationship inside workspace;
  - cross-workspace rejection;
  - archived-project write rejection;
  - contributor edit policy;
  - delete relationship;
  - dependency count enrichment;
  - relationship activity.
- Verified `npm test --workspace @worktrail/api -- work-item-relationships`.
- Verified `npm test --workspace @worktrail/api -- work-items`.
- Verified `npm run typecheck --workspace @worktrail/api`.
- Verified `npm test --workspace @worktrail/api`.
- Verified `git diff --check`.

## Phase 4: API Endpoints And Route Wiring

Goal: expose relationship behavior through transport-neutral endpoint handlers.

Scope:

- Add relationship request validation schemas.
- Add handlers:
  - `GET /api/work-items/:workItemId/relationships`;
  - `POST /api/work-items/:workItemId/relationships`;
  - `DELETE /api/work-items/:workItemId/relationships/:relationshipId`.
- Register routes in the Express server.
- Ensure `GET /api/work-items/:workItemId` returns relationship summary through the extended detail DTO.
- Add API tests for:
  - list relationships;
  - create relationship;
  - delete relationship;
  - validation errors;
  - duplicate errors;
  - cycle errors;
  - archived write errors;
  - permission errors.

Out of scope:

- Query filters.
- Frontend UI.
- OpenAPI documentation.

Acceptance criteria:

- Endpoints return contract DTOs and existing structured error shapes.
- `DELETE` returns `204`.
- Endpoint handlers remain transport-neutral.
- Existing work item endpoints still pass tests.

Suggested commands:

```sh
npm test --workspace @worktrail/api -- work-items
npm run typecheck --workspace @worktrail/api
npm test --workspace @worktrail/api
git diff --check
```

Status:

- Completed on 2026-07-05.
- Added relationship request validation schemas in `apps/api/src/endpoints/work-items.ts`.
- Added handlers:
  - `GET /api/work-items/:workItemId/relationships`;
  - `POST /api/work-items/:workItemId/relationships`;
  - `DELETE /api/work-items/:workItemId/relationships/:relationshipId`.
- Registered relationship routes in the Express server before the generic work item detail route.
- Confirmed `GET /api/work-items/:workItemId` returns relationship summaries through the Phase 3 detail DTO enrichment.
- Added API coverage in `apps/api/tests/work-items.test.ts` for:
  - creating relationships;
  - listing relationship summaries;
  - relationship data on work item detail;
  - deleting relationships with `204`;
  - malformed relationship payload validation;
  - self relationship validation;
  - duplicate relationship errors;
  - cycle errors;
  - missing relationship deletion errors;
  - archived-project write protection;
  - contributor permission errors.
- Verified `npm test --workspace @worktrail/api -- work-items`.
- Verified `npm run typecheck --workspace @worktrail/api`.
- Verified `npm test --workspace @worktrail/api`.
- Verified `git diff --check`.

## Phase 5: Dependency Filters And Export Integration

Goal: make dependency state searchable through project lists, workspace discovery, saved views, and CSV exports.

Scope:

- Extend backend query parsing for:
  - project work item list dependency filter;
  - workspace work item discovery dependency filter.
- Extend repository list methods with:
  - `dependency_blocked`;
  - `blocking_open_work`.
- Extend CSV export services to preserve dependency filters through existing list methods.
- Extend saved view validation/tolerance if needed for the new `dependency` query field.
- Add tests for:
  - project list dependency filters;
  - workspace dependency filters;
  - saved view query persistence/tolerance;
  - project CSV export with dependency filter;
  - workspace CSV export with dependency filter.

Out of scope:

- Frontend filter controls.
- Relationship management UI.
- My Work and planning changes.

Acceptance criteria:

- API list routes accept and apply dependency filters.
- CSV export output matches filtered API list behavior.
- Saved view query storage accepts dependency filter values.
- Invalid dependency query values return existing validation errors.

Suggested commands:

```sh
npm test --workspace @worktrail/api -- work-item
npm test --workspace @worktrail/api -- saved-work-view
npm test --workspace @worktrail/api -- csv-export
npm run typecheck --workspace @worktrail/api
git diff --check
```

Status:

- Completed on 2026-07-05.
- Added dependency query parsing for project-scoped work item lists and workspace work item discovery.
- Added repository filtering for:
  - `dependency_blocked`, returning work items blocked by at least one open blocker;
  - `blocking_open_work`, returning work items blocking at least one open downstream item.
- Confirmed CSV exports preserve dependency filters through the existing list/export repository flow.
- Extended saved work view query validation to normalize valid dependency filters and reject invalid values with the existing validation error behavior.
- Added API coverage in `apps/api/tests/work-items.test.ts` for:
  - project dependency filters;
  - workspace dependency filters;
  - project CSV export dependency filters;
  - workspace CSV export dependency filters.
- Added saved view coverage in `apps/api/tests/saved-work-views.test.ts` for dependency filter persistence, update, and invalid payload validation.
- Verified `npm test --workspace @worktrail/api -- work-items`.
- Verified `npm test --workspace @worktrail/api -- saved-work-views`.
- Verified `npm run typecheck --workspace @worktrail/api`.
- Verified `npm test --workspace @worktrail/api`.
- Verified `git diff --check`.

## Phase 6: Work Item Detail Relationship UI

Goal: add relationship display and management to the work item detail route.

Scope:

- Extend `WorktrailApiService` with relationship endpoints.
- Add relationship section to work item detail:
  - `Blocked by`;
  - `Blocks`;
  - `Related work`.
- Render relationship rows with:
  - project key/name;
  - display key;
  - title link;
  - status;
  - priority;
  - assignee.
- Add controls:
  - add blocker;
  - add blocked work;
  - add related work;
  - remove relationship.
- Implement searchable workspace work item picker using existing workspace discovery API.
- Exclude current work item from candidate selection.
- Disable or prevent already-linked selections where known locally.
- Handle server validation errors inline.
- Preserve read-only states for archived projects and permission failures.
- Add frontend tests for:
  - relationship section rendering;
  - add blocker direction;
  - add blocked-work direction translation;
  - add related work;
  - remove relationship;
  - archived/read-only states;
  - candidate search behavior.

Out of scope:

- List page dependency filters.
- My Work/planning dependency summaries.
- E2E coverage.

Acceptance criteria:

- Users can add and remove relationships from detail.
- Directional copy is clear.
- Relationship changes refresh the detail view.
- UI remains responsive and accessible at common widths.

Suggested commands:

```sh
npm test --workspace @worktrail/web -- work-item-detail
npm run typecheck --workspace @worktrail/web
npm run build --workspace @worktrail/web
git diff --check
```

Status:

- Completed on 2026-07-05.
- Added relationship client methods to `WorktrailApiService` for:
  - listing relationship summaries;
  - creating relationships;
  - deleting relationships.
- Added a relationship management panel to the work item detail route with grouped `Blocked by`, `Blocks`, and `Related work` sections.
- Rendered linked work item rows with project identity, display key, title link, status, priority, and assignee.
- Added relationship controls for:
  - adding a blocker by posting from the selected blocker to the current work item;
  - adding blocked work by posting from the current work item to the selected target;
  - adding related work with `relates_to`;
  - removing existing relationships.
- Added searchable workspace work item candidate lookup through the existing workspace discovery API.
- Excluded the current work item from candidate results and prevented locally known linked items from being selected again.
- Preserved archived-project read-only behavior for relationship form controls and mutation attempts.
- Moved relationship-specific detail page styles to global styles under `app-work-item-detail-page` to avoid the component style budget warning.
- Updated frontend fixtures for relationship-enabled detail DTOs and dependency-summary list DTOs.
- Added frontend coverage for API client relationship methods and detail-page relationship rendering, search, add, remove, read-only, and direction translation behavior.
- Verified `npm test --workspace @worktrail/web`.
- Verified `npm run typecheck --workspace @worktrail/web`.
- Verified `npm run build --workspace @worktrail/web`.

## Phase 7: Dependency Filter UI, Saved Views, And List Signals

Goal: expose dependency filters and compact dependency indicators on project and workspace list pages.

Scope:

- Extend frontend query/filter types with dependency filter.
- Add dependency filter select to project work item list.
- Add dependency filter select to workspace discovery.
- Add active filter pills for dependency filters.
- Add compact row indicators:
  - `Blocked by N`;
  - `Blocks N`.
- Ensure URL serialization/deserialization handles dependency filters.
- Ensure workspace saved views preserve dependency filters:
  - create;
  - open;
  - update;
  - stale view tolerance.
- Ensure project and workspace CSV export buttons include applied dependency filter state.
- Add frontend tests for:
  - project dependency filter serialization;
  - workspace dependency filter serialization;
  - active filter labels;
  - row indicators;
  - saved view persistence;
  - CSV export query params.

Out of scope:

- Relationship creation UI.
- My Work/planning dependency summaries.
- E2E coverage.

Acceptance criteria:

- Users can filter project and workspace lists by dependency state.
- Filter state is URL-backed and reload-safe.
- Saved views reopen with dependency filters.
- CSV export uses applied dependency filters.

Suggested commands:

```sh
npm test --workspace @worktrail/web -- work-items
npm test --workspace @worktrail/web -- workspace-work-item-list
npm run typecheck --workspace @worktrail/web
git diff --check
```

Status:

- Completed on 2026-07-05.
- Extended frontend filter/query types with the `dependency` filter.
- Added dependency filter selects to:
  - project work item list;
  - workspace work item discovery.
- Added active filter pills for dependency filters using user-facing labels:
  - `Blocked by open work`;
  - `Blocking open work`.
- Added compact dependency row indicators on project and workspace lists:
  - `Blocked by N`;
  - `Blocks N`.
- Extended project URL serialization/deserialization and project CSV export filters with dependency state.
- Extended workspace URL serialization/deserialization, saved view create/open/update, stale saved view tolerance, and workspace CSV export query params with dependency state.
- Extended `workItemQueryToHttpParams` so workspace API calls and exports include `dependency`.
- Moved the shared dependency chip style to global styles to keep component style budgets clean.
- Added frontend coverage for:
  - project dependency filter serialization;
  - workspace dependency filter serialization;
  - dependency active filter labels;
  - dependency row indicators;
  - saved view dependency persistence;
  - project and workspace CSV export dependency params.
- Verified `npm test --workspace @worktrail/web`.
- Verified `npm run typecheck --workspace @worktrail/web`.
- Verified `npm run build --workspace @worktrail/web`.

## Phase 8: My Work And Planning Dependency Signals

Goal: surface dependency risk on daily and planning surfaces without creating dashboard clutter.

Scope:

- Extend My Work service:
  - dependency-blocked assigned summary count;
  - `dependencyBlockedAssigned` list if it fits the current dashboard model.
- Extend My Work contract DTOs as needed.
- Add My Work UI summary/link and optional section.
- Extend planning service with:
  - `dependencyBlockedWork`;
  - `blockingOpenWork`.
- Add planning UI sections near existing blocked/risk work.
- Add tests for:
  - My Work dependency summary count and query;
  - My Work section rendering;
  - planning dependency risk lists;
  - planning links into filtered lists.

Out of scope:

- New analytics/reporting pages.
- Project-level dependency dashboard.
- Notifications.

Acceptance criteria:

- My Work shows dependency-blocked assigned work clearly.
- Planning shows dependency-blocked and blocking-open-work signals.
- Links route into filtered list views.
- Existing dashboard sections remain readable.

Suggested commands:

```sh
npm test --workspace @worktrail/api -- my-work planning
npm test --workspace @worktrail/web -- my-work project-planning
npm run typecheck
git diff --check
```

Status:

- Completed on 2026-07-05.
- Extended My Work service with:
  - dependency-blocked assigned summary count;
  - `dependencyBlockedAssigned` list populated from the existing workspace dependency filter;
  - summary link query params for `dependency=dependency_blocked`.
- Extended My Work UI with:
  - dependency-blocked summary card support;
  - dependency-blocked assigned work section;
  - dependency count pills on dashboard rows.
- Extended planning service with:
  - `dependencyBlockedWork`;
  - `blockingOpenWork`;
  - open-work filtering for both dependency risk lists.
- Extended planning UI with:
  - dependency-blocked and blocking-open-work metric links;
  - dependency risk sections near the existing blocked/due-date risk sections;
  - filtered list links for both dependency states.
- Added API tests for dependency-blocked My Work counts, query params, list content, and planning dependency risk lists.
- Added web tests for My Work dependency rendering, Planning dependency sections, and Planning filtered dependency links.
- Adjusted responsive summary/metric grids so the added cards remain readable.
- Verified `npm test --workspace @worktrail/api -- my-work planning`.
- Verified `npm test --workspace @worktrail/web`.
- Verified `npm run typecheck`.
- Verified `git diff --check`.
- Note: the suggested filtered web test command is not supported by the current Angular CLI script because the extra arguments are forwarded to `ng test`; the full web suite was run instead.

## Phase 9: OpenAPI And E2E Coverage

Goal: document the API surface and add a smoke path for dependency workflow behavior.

Scope:

- Update `docs/api/openapi.yaml`:
  - relationship schemas;
  - relationship endpoints;
  - extended work item DTO fields;
  - dependency query parameter on list/export endpoints;
  - relationship error cases.
- Extend Playwright smoke coverage:
  - create blocker relationship;
  - verify downstream dependency signal;
  - filter workspace discovery by dependency-blocked;
  - save and reopen dependency saved view;
  - move blocker to terminal status;
  - verify dependency signal clears.
- Keep e2e flow concise and deterministic.

Out of scope:

- Full relationship matrix e2e testing.
- API documentation generation automation.

Acceptance criteria:

- OpenAPI matches implemented relationship route surface.
- E2E validates the main dependency workflow.
- Existing smoke tests continue to pass.

Suggested commands:

```sh
npm run test:e2e
npm run typecheck
npm test
git diff --check
```

Status:

- Completed on 2026-07-05.
- Updated `docs/api/openapi.yaml` with:
  - relationship endpoints for list, create, and delete;
  - relationship schemas;
  - dependency filter schema and query parameter;
  - dependency fields on work item list/detail DTOs;
  - relationship summary on work item detail DTOs;
  - My Work dependency-blocked dashboard section;
  - planning dependency risk arrays;
  - relationship activity event examples.
- Extended OpenAPI coverage to assert relationship paths, schemas, dependency filters, and relationship activity event names.
- Added a v0.0.8 Playwright smoke path that:
  - creates a blocker and downstream work item;
  - creates a blocker relationship through the detail UI;
  - verifies dependency-blocked workspace discovery;
  - saves and reopens a dependency-blocked saved view;
  - moves the blocker to `done`;
  - verifies the downstream item leaves the dependency-blocked filtered view.
- Tightened one existing planning e2e heading assertion to avoid ambiguity with the new dependency-blocked heading.
- Verified `npm test --workspace @worktrail/api -- openapi`.
- Verified `npm run test:e2e`.
- Verified `npm run typecheck`.
- Verified `npm test`.
- Verified `git diff --check`.

## Phase 10: Product Documentation, Site, Extraction Notes, And Version Finalization

Goal: prepare v0.0.8 release-facing materials.

Scope:

- Update `README.md` for:
  - relationship capabilities;
  - dependency-blocked signals;
  - dependency filters;
  - My Work/planning dependency risk;
  - limitations.
- Update the static product site for dependency visibility.
- Add `docs/v0.0.8/jawstack-extraction-notes.md`.
- Capture reusable patterns for:
  - graph-edge table modeling;
  - directional versus symmetric edge semantics;
  - canonicalization;
  - cycle validation;
  - derived relationship state;
  - URL-backed relationship filters;
  - relationship-aware export reuse;
  - cloud-readiness implications for graph queries.
- Update root, app, and package versions to `0.0.8` if release/tagging is in scope.
- Update lockfile if versions change.
- Record final verification in this implementation plan.

Out of scope:

- Creating a release tag unless explicitly requested.
- Publishing packages.
- Adding hosted deployment infrastructure.

Acceptance criteria:

- README and product site reflect v0.0.8 capabilities.
- Extraction notes capture reusable patterns without prematurely abstracting them.
- Versions are consistent if bumped.
- Final verification passes or residual issues are documented.

Suggested commands:

```sh
npm run typecheck
npm test
npm run test:e2e
npm run build
npm audit --omit=dev --audit-level=low
npm run db:reset
npm run db:migrate
npm run db:seed
git diff --check
git status --short --branch
```

Status: Not started.

## Release Verification

Expected final verification:

```sh
npm run typecheck
npm test
npm run test:e2e
npm run build
npm audit --omit=dev --audit-level=low
git diff --check
```

Finalization should restore deterministic seed data:

```sh
npm run db:reset
npm run db:migrate
npm run db:seed
```

## Risks And Watchpoints

- Cycle prevention can be subtly wrong.
- Relationship direction can confuse users if UI copy is vague.
- List dependency counts can become N+1 if enrichment is implemented row by row.
- Saved views and CSV export can drift from visible filters if query serialization is duplicated.
- Seed relationship data may change existing dashboard/list test counts.
- Activity can become noisy if relationship events are mirrored too broadly.
- Cross-project relationships must always show project identity to avoid ambiguity.
