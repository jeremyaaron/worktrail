# Worktrail v0.1.0 Technical Debt Audit

## Summary

Worktrail is in a healthy place for a fast-moving reference app: strict TypeScript is enabled, the API has clear endpoint/service/repository layering, DTOs are shared through `@worktrail/contracts`, and there is meaningful backend, frontend, and E2E coverage.

The main technical debt is not a lack of structure. It is that several structures have reached their first scaling limit. New sprint features have often been added to the nearest page, service, repository, or contract file. That has produced a handful of large coordination points that will slow down v0.1.x feature work unless v0.1.0 creates cleaner module seams.

Recommended v0.1.0 technical theme:

> Keep the current architecture, but split the growing seams before they become hard boundaries.

## Audit Basis

This audit reviewed:

- API source under `apps/api/src`.
- Angular source under `apps/web/src/app`.
- Shared contracts under `packages/contracts/src`.
- Unit, integration, and E2E tests.
- Build, typecheck, test, Docker, and Playwright configuration.

Verification run during this audit:

- `npm run typecheck` passed.
- `npm test` passed: API 176 tests, web 110 tests.

No product code was modified for this audit.

## Highest-Impact Findings

### 1. Frontend Feature Components Are Too Large

Several Angular standalone components now contain route loading, state orchestration, form setup, URL synchronization, mutation handling, templates, and styles in one file.

Largest examples:

- `project-planning-page.component.ts`: 1,686 lines.
- `work-item-detail-page.component.ts`: 1,648 lines.
- `workspace-work-item-list-page.component.ts`: 1,587 lines.
- `work-item-list-page.component.ts`: 1,105 lines.
- `project-settings-page.component.ts`: 1,036 lines.

This is the clearest frontend refactoring opportunity. The issue is not line count by itself; it is mixed responsibilities. These files are hard for a development agent to modify safely because any small feature touches page state, template, styling, and API coordination together.

Recommendation:

- Split large route components into page containers plus focused child components.
- Move repeated filter, list-row, saved-view, milestone, relationship, comment, and activity UI into shared or feature-local components.
- Move page-specific orchestration into small services or signal stores where state transitions are non-trivial.
- Keep route components responsible for route params, page-level loading/error state, and composition.

Suggested first targets:

- Extract `WorkItemFiltersComponent` shared by project and workspace work item lists.
- Extract `WorkItemTable` / `WorkItemCards` shared by project and workspace work item results.
- Extract `SavedViewsPanel` from workspace work item discovery.
- Extract `MilestoneManager` and `PlanningReview` from project planning.
- Extract `RelationshipPanel`, `CommentThread`, and `ActivityTimeline` from work item detail.

Acceptance target:

- No route component should remain above roughly 600-800 lines unless it is mostly declarative composition.

### 2. Work Item Query Logic Is Duplicated Across Stack Layers

Work item filtering is now central product behavior. It appears in:

- API repository SQL query construction.
- API request parsing and validation.
- API service-specific query defaults.
- frontend query serialization.
- project list filter form.
- workspace list filter form.
- delivery-health reason links.
- My Work summary links.
- CSV export filters.

Current duplication hotspots:

- `work-item-repository.ts` has separate project and workspace query builders with repeated status, assignee, reporter, type, priority, label, milestone, due date, dependency, search, and sort handling.
- `work-items.ts` has project-scoped filter parsing separate from `validation/work-item-query.ts`.
- `work-item-query-params.ts` serializes frontend filters independently of backend parsing.
- `work-item-list-page.component.ts` and `workspace-work-item-list-page.component.ts` duplicate filter constants, form state, active filter labels, and URL synchronization patterns.

Recommendation:

- Create a single API-side query normalization module for both project and workspace work item list routes.
- Extract repository query helpers for shared predicates and ordering.
- Treat `WorkItemQuery` as the canonical query model, with project-scoped lists using a narrowed version rather than a separate structure.
- Add contract-level tests for query serialization/parsing expectations.
- Share frontend filter metadata, labels, default values, and active-pill formatting.

Why this matters:

- Every new filter currently risks implementation drift between project list, workspace list, saved views, health links, and export.
- Query behavior is now a product contract, not a page detail.

### 3. Planning, Delivery Health, and My Work Reimplement Similar Risk Rules

Risk concepts are repeated in multiple services:

- `dueSoonWindowDays = 7` appears in planning, delivery health, and My Work.
- `staleInProgressDays = 7` appears in planning and delivery health.
- active unassigned statuses are recreated in planning and delivery health.
- open/terminal status checks are local wrappers in multiple modules.
- due-soon/overdue/stale predicates are duplicated in service code and SQL query filters.

Recommendation:

- Create a small domain module for delivery/work risk predicates:
  - open/terminal status checks;
  - due soon and overdue calculation;
  - stale in-progress calculation;
  - active-unassigned status set;
  - shared risk windows.
- Let `DeliveryHealthService`, `PlanningService`, `MyWorkService`, and repository query builders consume shared named policy constants.
- Keep SQL-specific implementations close to the repository, but drive their windows and status sets from the same domain constants where practical.

Why this matters:

- Today the repeated values are consistent. Future changes to risk windows or status semantics will be easy to miss.
- Shared predicates make delivery-health behavior easier to explain and test.

### 4. Shared Contracts Are a Single Growing Barrel

`packages/contracts/src/index.ts` is 626 lines and contains all public DTOs, query types, request shapes, health types, activity types, CSV types, relationship types, and saved-view types.

This has worked so far, but the file is now a merge hotspot and weakly communicates ownership. It also lacks contract-specific tests.

Recommendation:

- Split contracts by domain while preserving the current package export:
  - `health.ts`;
  - `members.ts`;
  - `workspace.ts`;
  - `projects.ts`;
  - `work-items.ts`;
  - `planning.ts`;
  - `activity.ts`;
  - `csv.ts`;
  - `saved-work-views.ts`.
- Keep `index.ts` as a barrel export only.
- Add contract tests for:
  - work item query normalization examples;
  - saved-view query tolerance;
  - DTO shape snapshots for important API responses if useful.

Why this matters:

- Contracts are the bridge between API, web, OpenAPI, seed data, and tests. They should be easy to navigate by domain before the next feature slate expands them.

### 5. API Route Registration Is Becoming a Routing Monolith

`apps/api/src/adapters/express/server.ts` centralizes every route registration. This keeps the adapter explicit, but the file is already 477 lines and mixes server middleware, health routes, workspace routes, member routes, project routes, work item routes, comments, relationships, labels, milestones, CSV, static asset serving, and test route wiring.

Recommendation:

- Keep the transport-neutral endpoint handler pattern.
- Split Express route registration into route modules:
  - `registerWorkspaceRoutes`;
  - `registerProjectRoutes`;
  - `registerWorkItemRoutes`;
  - `registerPlanningRoutes`;
  - `registerHealthRoutes`.
- Keep `createExpressApp` responsible for middleware, adapter options, health/static wiring, and invoking route registrars.

Why this matters:

- Endpoint handlers are already nicely separated. The adapter should preserve that clarity as route count grows.
- Route modules will reduce conflict risk and make future features easier for agents to place.

## Backend Refactoring Opportunities

### Work Item Service Responsibilities

`WorkItemService` handles listing, workspace listing, creation, update, transition, board movement, validation, activity recording, DTO assembly, comments/activity hydration, and relationship summary hydration.

Recommended split:

- `WorkItemCommandService`: create, update, transition, board move.
- `WorkItemQueryService`: project list, workspace list, detail hydration.
- `BoardPositionService`: board position computation and compaction.
- `WorkItemDtoAssembler`: list/detail DTO hydration.
- Keep validation helpers either in command service or a small `WorkItemPolicy` module.

This does not need to be a large rewrite. Start by extracting board positioning and DTO assembly because they are mechanically separable and high-churn.

### DTO Assembly Can Produce N+1 Query Patterns

`WorkItemService.toListDtos` preloads labels and dependency counts, but still resolves reporter, assignee, and milestone one item at a time through `toBundle`. Detail DTO assembly similarly fetches related records through several repository calls.

This is fine for seeded/demo scale, but it will not age well if list sizes grow.

Recommendation:

- Add repository methods or an assembler that can batch load members and milestones for list records.
- Keep detail hydration explicit, but batch where the data is already a known set.
- Add performance-oriented tests for query count only if the repository layer exposes a simple way to observe it; otherwise document expected loading behavior.

### Repository Query Composition Should Be Extracted

`work-item-repository.ts` mixes data access methods with substantial predicate construction. The repeated project/workspace query blocks are the first candidate.

Recommendation:

- Extract helpers:
  - `buildWorkItemFilterConditions`;
  - `buildWorkItemOrderBy`;
  - `dependencyCondition`;
  - `labelCondition`;
  - `dueDateCondition`.
- Keep Drizzle-specific SQL in the repository layer.
- Use a shared input shape for project and workspace queries.

### Transaction Wiring Is Slightly Leaky

Services that mutate state optionally receive `db` and use `withRepositoriesTransaction`. Some handlers pass `db`, some do not, and the distinction is scattered through route wiring.

Recommendation:

- Introduce an application service factory or request-scoped context that always includes both repositories and a transaction runner.
- Services should ask for `runInTransaction(callback)` rather than testing whether `db` exists.
- This would also make tests more explicit: in-memory/fake repository tests can provide a no-op transaction runner.

This is not urgent, but it will matter as multi-entity write flows increase.

### Delivery Health Is Well Tested But Dense

`delivery-health-service.ts` is appropriately domain-heavy and has tests, but it combines policy constants, milestone derivation, project derivation, planning review derivation, reason text, query construction, ranking, and date helpers.

Recommendation:

- Split into pure modules:
  - `delivery-health-policy.ts`;
  - `milestone-health.ts`;
  - `project-health.ts`;
  - `planning-review.ts`;
  - `delivery-health-reasons.ts`.
- Preserve the current `DeliveryHealthService.derive` facade.

This keeps tests stable while making the health model easier to evolve.

## Frontend Refactoring Opportunities

### Extract Form/View Models From Components

Many components define constant arrays, form value interfaces, default values, label formatters, query conversion, loading flags, and mutation handlers inline.

Recommendation:

- Move work item filter constants/defaults/labels into a shared feature module.
- Move saved-view draft state and mutations into a small service or component.
- Move repeated API error extraction into a shared helper.
- Use component inputs/outputs for presentational pieces instead of exposing full page state.

High-value repeated utility:

- `extractApiErrorMessage(error, fallback)`.
- `memberDisplayName(member)`.
- `formatToken(value)`.
- filter option metadata for status/type/priority/due/dependency/sort.

### Introduce Feature-Local Component Folders

Current feature folders mostly contain route components. As a result, the route component becomes the only natural place to add UI.

Recommendation:

- Use feature-local subfolders, for example:
  - `features/work-items/components/filter-panel`;
  - `features/work-items/components/work-item-result-list`;
  - `features/work-items/components/relationship-panel`;
  - `features/projects/components/project-shell`;
  - `features/projects/components/planning-review`;
  - `features/projects/components/milestone-manager`.
- Promote only genuinely cross-feature UI to `shared`.

This gives agents a clear destination for incremental UI work.

### API Client Should Be Split By Domain

`WorktrailApiService` is 452 lines and exposes every backend operation. It is still manageable, but it is becoming a frontend equivalent of the Express routing monolith.

Recommendation:

- Keep a shared low-level `ApiClient` for URL/options/actor headers.
- Split domain clients:
  - `WorkspaceApi`;
  - `ProjectsApi`;
  - `WorkItemsApi`;
  - `PlanningApi`;
  - `SavedViewsApi`.
- Re-export or compose them where convenient for tests.

Why this matters:

- Domain clients make route components easier to test and reduce one-service churn.

### Inline Styles Are Becoming Hard To Share

Standalone components keep templates and styles close, which was useful early. The cost now is that button, panel, table, pill, notice, and form styles are copied across many components with minor variations.

Recommendation:

- Create shared style utilities for:
  - page headers;
  - panels;
  - notices;
  - action buttons;
  - status/priority/dependency pills;
  - form grids;
  - table/list rows.
- Keep component-specific layout local.
- Avoid a large design-system rewrite; extract only repeated patterns already present in multiple pages.

## Testing And Tooling Findings

### Test Coverage Is Strong, But Test Files Are Also Growing

The API has 176 tests and the web has 110 tests. That is a good baseline. The largest test files mirror the largest implementation files:

- `apps/api/tests/work-items.test.ts`: 2,007 lines.
- `work-items-page.component.spec.ts`: 988 lines.
- `work-item-detail-page.component.spec.ts`: 962 lines.

Recommendation:

- Split tests by behavior area as implementation modules split.
- Add focused unit tests for extracted pure modules: query normalization, risk predicates, board positioning, DTO assembly.
- Keep E2E as smoke/workflow coverage, not exhaustive behavior coverage.

### There Is No First-Party Lint Configuration

The root script has `npm run lint --workspaces --if-present`, but no workspace currently exposes a first-party lint script or repo-level ESLint config.

Recommendation:

- Add ESLint for TypeScript API and Angular web.
- Start with low-churn rules:
  - no unused imports/vars;
  - consistent type imports;
  - no floating promises;
  - no explicit `any`;
  - import ordering if desired.
- Do not block v0.1.0 on aggressive stylistic rules.

### CI Appears To Publish Pages But Not Verify The App

The repository has a Pages workflow, but no visible CI workflow for typecheck, unit tests, build, or E2E.

Recommendation:

- Add a CI workflow for:
  - `npm ci`;
  - `npm run typecheck`;
  - `npm test`;
  - `npm run build`;
  - optionally `npm run test:e2e` with Postgres service.
- Keep E2E optional or nightly if runtime cost is high, but at least run typecheck/unit/build on PRs.

### Contract Package Has No Real Tests

`@worktrail/contracts` currently prints `No contract tests yet`.

Recommendation:

- Add lightweight tests when query helpers or schemas move into the contract package.
- If contracts remain type-only, add API/OpenAPI consistency checks that exercise representative DTO/query examples.

## Documentation And Generated Artifacts

### OpenAPI Is Checked In Manually

The README points to `docs/api/openapi.yaml`, and API tests include an OpenAPI test file. The checked-in OpenAPI reference is useful, but it can drift unless updates are enforced.

Recommendation:

- Add a small route/contract checklist for PRs touching endpoints.
- Consider generating parts of OpenAPI from shared route schemas later, but do not take on a full generator unless endpoint churn makes manual maintenance painful.
- Add tests that assert newly added routes have OpenAPI path coverage.

### Built Web Artifacts Are Present In The Workspace

`apps/web/dist` exists in the tree. It did not change during this audit, but generated artifacts in app folders can create noise if tracked or accidentally edited.

Recommendation:

- Confirm whether `apps/web/dist` is intentionally tracked.
- If it is not a product artifact, keep it ignored.
- If it is intentionally tracked for preview/static serving, document when it should be regenerated.

## Suggested v0.1.0 Refactor Plan

### Phase 1: Guardrails

- Add CI for typecheck, tests, and build.
- Add initial ESLint scripts.
- Add contract/query tests around work item filters.

### Phase 2: Query Consolidation

- Normalize project and workspace work item query parsing.
- Extract shared repository query helpers.
- Share frontend filter metadata and active filter labeling.
- Keep behavior identical and verify with existing tests.

### Phase 3: Frontend Component Decomposition

- Extract work item filter/list components.
- Extract saved views panel.
- Extract planning review and milestone manager.
- Extract relationship/comments/activity panels from detail.

### Phase 4: Domain Policy Extraction

- Extract risk/date/status predicates.
- Extract board positioning logic.
- Split delivery-health internals behind the current service facade.

### Phase 5: Routing And Client Boundaries

- Split Express route registration by domain.
- Split frontend API client by domain.
- Keep public behavior and route paths unchanged.

## Non-Recommendations

These are not worth doing for v0.1.0:

- Rewriting the backend framework.
- Replacing Drizzle.
- Introducing NgRx or a heavy frontend state framework.
- Building a full internal design system from scratch.
- Generating all API code from OpenAPI.
- Reorganizing every file by abstract architecture layers.

The current stack is sound. The goal is to reduce obvious feature-growth friction, not restart the app.

## Success Criteria

v0.1.0 technical cleanup should be considered successful if:

- New work item filters can be added in one canonical query path.
- Planning or health rule changes require edits in one policy module, not several services.
- The largest route components are decomposed into named, testable pieces.
- API route registration and frontend API calls have domain-level ownership.
- CI catches type, unit, and build regressions before merge.
- Future agents have obvious places to add UI, query logic, and domain policy without stapling code onto the largest files.

## Bottom Line

Worktrail has a solid technical baseline, but the next feature slate will amplify the current accumulation points. The most valuable v0.1.0 refactors are query consolidation, frontend component decomposition, shared risk policy extraction, contract modularization, and basic CI/lint guardrails. These are incremental changes that preserve the existing architecture while making it much easier to build the next releases cleanly.
