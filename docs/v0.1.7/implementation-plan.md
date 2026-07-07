# Worktrail v0.1.7 Implementation Plan

## Purpose

This plan turns the v0.1.7 PRD and technical design into sequential implementation phases. v0.1.7 should add Milestone Review: a focused, shareable project-shell page for one milestone with progress, health, scoped risk, recent movement, and query-backed action links into project Work.

The release should preserve the local-first development experience, Angular static-hosting compatibility, transport-neutral API handler structure, Express local adapter, Postgres persistence, deterministic seed data, checked-in OpenAPI docs, CI verification, and clean setup from a fresh checkout.

## Design Decisions

Use these decisions while implementing v0.1.7:

- Add a full project-shell child route at `/projects/:projectId/milestones/:milestoneId`.
- Add a derived API endpoint at `GET /api/projects/:projectId/milestones/:milestoneId/review`.
- Do not add a database migration unless implementation reveals an unavoidable gap.
- Do not persist milestone review snapshots.
- Add contract-owned milestone review DTOs in `packages/contracts/src/planning.ts`.
- Add a narrow `workRisk` query field for exact risk links:
  - `unassigned_active`;
  - `stale_in_progress`.
- Keep `workRisk` URL-backed and chip-visible, but do not add a visible advanced filter control in v0.1.7.
- Reuse `DeliveryHealthService` for milestone progress, health labels, and reason chips.
- Build risk sections and recent movement as derived read-model data in a new milestone review service.
- Return all risk sections in a deterministic order, including zero-count sections.
- Cap risk section preview rows at 5.
- Cap recent movement rows at 8.
- Keep milestone review readable for contributors, archived projects, archived milestones, completed milestones, and canceled milestones.
- Keep mutation actions in existing project Work and Planning surfaces.
- Use query-backed links from milestone review into project Work so batch triage remains available after navigation.
- Do not add forecasting, capacity planning, critical path, roadmaps, charts, milestone sign-off, notification rules, or custom health formulas.
- Keep pattern notes destination-neutral.

## Phase Sizing

Each phase should leave the repository in a coherent working state. This release touches shared contracts, work item query parsing, repository query building, planning endpoint routing, a new API service, API tests, OpenAPI, Angular API clients, a new milestone review page, project Work query serialization/chips, Planning page integration, Playwright smoke coverage, README, public site, release notes, and pattern notes.

Implementation phases:

1. baseline planning;
2. contracts and query model;
3. API query parsing and repository filtering;
4. milestone review service and endpoint;
5. API tests and OpenAPI;
6. Angular API client, route, and page shell;
7. milestone review rendering and links;
8. project Work `workRisk` integration;
9. Planning integration and web regression tests;
10. seed review, Playwright smoke, and responsive polish;
11. documentation, site, release notes, pattern notes, and final verification.

Run focused contract/API tests after backend phases, focused web tests after frontend phases, and full verification during finalization.

## Phase 0: Baseline Planning

Goal: confirm v0.1.7 planning inputs and repository state before runtime changes.

Scope:

- Confirm `docs/v0.1.7/prd.md` exists.
- Confirm `docs/v0.1.7/technical-design.md` exists.
- Confirm `docs/v0.1.7/implementation-plan.md` exists.
- Confirm active branch and repository status.
- Confirm no unresolved technical choice blocks Phase 1.
- Confirm sprint docs avoid discontinued extraction-target references.
- Confirm no runtime files have been changed for v0.1.7 yet.
- Confirm whether the branch should be renamed or checked out to `v0.1.7` before runtime work begins.

Out of scope:

- Runtime implementation.
- Contract changes.
- API changes.
- UI changes.

Acceptance criteria:

- v0.1.7 planning inputs exist.
- Design decisions are recorded.
- Worktree/index state is understood before implementation starts.
- No open decision blocks Phase 1.
- Sprint docs use destination-neutral pattern extraction language.

Suggested commands:

```sh
find docs/v0.1.7 -maxdepth 1 -type f | sort
git status --short --branch
git diff --check
```

Status:

- Completed on 2026-07-07.
- Confirmed v0.1.7 planning inputs exist:
  - `docs/v0.1.7/prd.md`;
  - `docs/v0.1.7/technical-design.md`;
  - `docs/v0.1.7/implementation-plan.md`.
- Confirmed active branch is `v0.1.7`; no branch rename or checkout is needed before runtime work begins.
- Confirmed current change state:
  - `docs/v0.1.7/prd.md` is staged;
  - `docs/v0.1.7/technical-design.md` is untracked;
  - `docs/v0.1.7/implementation-plan.md` is untracked;
  - no runtime files have been changed for v0.1.7 yet.
- Confirmed implementation decisions:
  - add a project-shell milestone review route at `/projects/:projectId/milestones/:milestoneId`;
  - add `GET /api/projects/:projectId/milestones/:milestoneId/review`;
  - keep milestone review derived and avoid schema changes unless an unavoidable implementation gap appears;
  - add contract-owned milestone review DTOs;
  - add a narrow `workRisk` query extension for `unassigned_active` and `stale_in_progress`;
  - reuse existing delivery-health and risk-policy rules;
  - defer forecasting, snapshots, roadmaps, charts, milestone sign-off, notification rules, and custom health formulas.
- Confirmed sprint docs avoid discontinued extraction-target references and stale script names.
- Verified `git diff --check`.
- No unresolved technical choice blocks Phase 1.

## Phase 1: Contracts And Query Model

Goal: add shared milestone review and work-risk query contracts without runtime behavior changes.

Scope:

- Update `packages/contracts/src/work-items.ts`:
  - add `WorkItemRiskFilter`;
  - add optional `workRisk?: WorkItemRiskFilter` to `WorkItemQuery`.
- Update `packages/contracts/src/planning.ts`:
  - add `MilestoneReviewRiskType`;
  - add `MilestoneReviewScopeBreakdownDto`;
  - add `MilestoneReviewRiskSectionDto`;
  - add `MilestoneReviewDto`.
- Ensure `MilestoneReviewDto` uses existing `ProjectDto`, `MilestoneDto`, `MilestoneProgressDto`, `PlanningRiskItemDto`, and `WorkItemQuery` contracts.
- Add or update contract tests if helper/runtime contract assertions exist for planning/query types.
- Update imports and fixtures impacted by the expanded `WorkItemQuery`.

Out of scope:

- API endpoint implementation.
- Repository query behavior.
- OpenAPI.
- Angular route/page work.

Acceptance criteria:

- Shared contract package compiles.
- `WorkItemQuery` supports the new `workRisk` field.
- Milestone review DTOs are exported from `@worktrail/contracts`.
- Existing contract consumers continue to compile.

Suggested commands:

```sh
npm test --workspace @worktrail/contracts
npm run typecheck --workspace @worktrail/contracts
git diff --check
```

Status:

- Completed on 2026-07-07.
- Updated `packages/contracts/src/work-items.ts`:
  - added `WorkItemRiskFilter`;
  - added optional `workRisk?: WorkItemRiskFilter` to `WorkItemQuery`.
- Updated `packages/contracts/src/planning.ts`:
  - added `MilestoneReviewRiskType`;
  - added `MilestoneReviewScopeBreakdownDto`;
  - added `MilestoneReviewRiskSectionDto`;
  - added `MilestoneReviewDto`.
- Updated `packages/contracts/src/work-item-query.contract.test.ts` to prove canonical query state can carry `workRisk`.
- Added `packages/contracts/src/milestone-review.contract.test.ts` covering:
  - milestone review response shape;
  - scope breakdown counts;
  - risk section DTOs;
  - recent movement rows;
  - milestone review risk types;
  - `WorkItemRiskFilter` query values.
- Verified:
  - `npm test --workspace @worktrail/contracts`;
  - `npm run typecheck --workspace @worktrail/contracts`;
  - `npm run lint --workspace @worktrail/contracts`;
  - `git diff --check`.

## Phase 2: API Query Parsing And Repository Filtering

Goal: make `workRisk` a real URL/API query field for project Work links.

Scope:

- Update `apps/api/src/validation/work-item-query.ts`:
  - parse `workRisk=unassigned_active`;
  - parse `workRisk=stale_in_progress`;
  - reject unsupported values consistently with existing query parsing.
- Update `apps/api/src/repositories/work-item-query-builder.ts`:
  - include `workRisk` in `ProjectWorkItemQuery`;
  - support `unassigned_active` with existing active-unassigned status policy;
  - support `stale_in_progress` with existing stale-in-progress day policy;
  - keep `workRisk` combinable with milestone, status, due date, dependency, search, and sort filters.
- Import policy constants from `apps/api/src/domain/work-risk-policy.ts` instead of duplicating status lists or stale-day values.
- Add API/repository tests for project list filtering:
  - unassigned active;
  - stale in progress;
  - milestone plus unassigned active;
  - milestone plus stale in progress.

Out of scope:

- Milestone review endpoint.
- Angular hidden query state.
- OpenAPI.

Acceptance criteria:

- Project Work API accepts and applies `workRisk`.
- Existing Work Item query filters still pass.
- Conflicting filters are applied together and can return empty lists without silently dropping user intent.

Suggested commands:

```sh
npm test --workspace @worktrail/api
npm run typecheck --workspace @worktrail/api
git diff --check
```

Status:

- Completed on 2026-07-07.
- Updated `apps/api/src/validation/work-item-query.ts`:
  - parses `workRisk=unassigned_active`;
  - parses `workRisk=stale_in_progress`;
  - rejects unsupported `workRisk` values through existing validation errors;
  - supports `workRisk` in project and workspace query parsing.
- Updated `apps/api/src/repositories/work-item-query-builder.ts`:
  - included `workRisk` in `ProjectWorkItemQuery`;
  - added `unassigned_active` conditions using `activeUnassignedWorkItemStatuses`;
  - added `stale_in_progress` conditions using `staleInProgressDays`;
  - kept `workRisk` composable with milestone, status, due date, dependency, search, and sort filters.
- Updated `apps/api/src/services/work-item-service.ts` so project list filters use the repository-owned `ProjectWorkItemQuery` type.
- Updated `apps/api/tests/work-item-query.test.ts` for `workRisk` parsing and invalid-value validation.
- Updated `apps/api/tests/work-items.test.ts` for milestone-scoped project Work filtering with:
  - `workRisk=unassigned_active`;
  - `workRisk=stale_in_progress`.
- Corrected v0.1.7 API suggested commands to remove the unsupported Vitest `--runInBand` flag.
- Verified:
  - `npm test --workspace @worktrail/api -- tests/work-item-query.test.ts tests/work-items.test.ts`;
  - `npm run typecheck --workspace @worktrail/api`;
  - `npm test --workspace @worktrail/api`;
  - `npm run lint --workspace @worktrail/api`;
  - `git diff --check`.

## Phase 3: Milestone Review Service And Endpoint

Goal: add the derived milestone review read model behind a transport-neutral endpoint.

Scope:

- Add `apps/api/src/services/milestone-review-service.ts`.
- Implement `MilestoneReviewService.getMilestoneReview(projectId, milestoneId)`.
- Load:
  - project;
  - project milestones including archived;
  - project work items;
  - dependency-blocked work;
  - blocking-open work;
  - workspace members.
- Validate:
  - project exists in actor workspace;
  - milestone exists in route project.
- Reuse `DeliveryHealthService.derive` for milestone progress, health, and reasons.
- Derive:
  - `scopedWorkQuery`;
  - `scopeBreakdown`;
  - deterministic `riskSections`;
  - `recentlyChangedWork`.
- Add endpoint handler in `apps/api/src/endpoints/planning.ts`.
- Register Express route in `apps/api/src/adapters/express/routes/planning-routes.ts`.
- Add the route to any API route inventory/snapshot tests.

Out of scope:

- OpenAPI schemas.
- Angular API client/page.
- Seed changes.

Acceptance criteria:

- `GET /api/projects/:projectId/milestones/:milestoneId/review` returns `MilestoneReviewDto`.
- Valid archived projects and archived milestones are readable.
- Invalid or cross-project milestone ids return not found without leaking workspace data.
- Risk sections are deterministic and include query payloads.

Suggested commands:

```sh
npm test --workspace @worktrail/api
npm run typecheck --workspace @worktrail/api
git diff --check
```

Status:

- Completed on 2026-07-07.
- Added `apps/api/src/services/milestone-review-service.ts`.
- Implemented `MilestoneReviewService.getMilestoneReview(projectId, milestoneId)`:
  - validates project membership in the actor workspace;
  - validates the milestone belongs to the route project;
  - loads project work, project milestones including archived milestones, dependency-blocked work, blocking-open work, and workspace members;
  - reuses `DeliveryHealthService.derive` for milestone progress, health, and reasons;
  - derives `scopedWorkQuery`;
  - derives complete status, priority, assignment, due-date, and dependency scope breakdowns;
  - derives deterministic risk sections with capped preview items and query payloads;
  - derives capped recent movement from milestone-scoped work items.
- Added `getMilestoneReviewHandler` in `apps/api/src/endpoints/planning.ts`.
- Registered `GET /api/projects/:projectId/milestones/:milestoneId/review` in `apps/api/src/adapters/express/routes/planning-routes.ts`.
- Updated `apps/api/tests/server.test.ts` route inventory coverage.
- Updated `apps/api/tests/planning.test.ts` for:
  - deterministic milestone review derivation;
  - archived project and archived milestone endpoint readability;
  - cross-project milestone rejection.
- Verified:
  - `npm test --workspace @worktrail/api -- tests/planning.test.ts tests/server.test.ts`;
  - `npm run typecheck --workspace @worktrail/api`;
  - `npm test --workspace @worktrail/api`;
  - `npm run lint --workspace @worktrail/api`;
  - `git diff --check`.

## Phase 4: API Tests And OpenAPI

Goal: harden the milestone review API contract and checked-in API reference.

Scope:

- Add or extend API tests for:
  - active milestone review;
  - empty milestone review;
  - risky milestone review;
  - archived project readability;
  - archived milestone readability;
  - milestone from another project;
  - project from another workspace;
  - risk section queries;
  - recent movement ordering and cap.
- Use injected clocks or deterministic timestamps for date-sensitive tests.
- Update `docs/api/openapi.yaml`:
  - add `/api/projects/{projectId}/milestones/{milestoneId}/review`;
  - add `MilestoneReview`;
  - add `MilestoneReviewScopeBreakdown`;
  - add `MilestoneReviewRiskSection`;
  - add `MilestoneReviewRiskType`;
  - add `WorkItemRiskFilter`;
  - update `WorkItemQuery` with `workRisk`.
- Update OpenAPI tests to assert the new path and schemas.

Out of scope:

- Angular UI.
- Playwright.
- README/site/release notes.

Acceptance criteria:

- API tests cover meaningful milestone review success and failure cases.
- OpenAPI matches the route and DTO surface.
- Checked-in docs do not describe unsupported forecasting or snapshot behavior.

Suggested commands:

```sh
npm test --workspace @worktrail/api
npm run typecheck --workspace @worktrail/api
git diff --check
```

Status:

- Completed on 2026-07-07.
- Extended `apps/api/tests/planning.test.ts` for:
  - empty milestone review with deterministic zero-count scope breakdowns and risk sections;
  - recent movement ordering and the 8-item cap;
  - project-from-other-workspace not-found behavior.
- Confirmed earlier Phase 3 tests already cover:
  - active and risky milestone review derivation;
  - archived project readability;
  - archived milestone readability;
  - milestone from another project rejection;
  - risk section query payloads.
- Updated `docs/api/openapi.yaml`:
  - bumped API reference version to `0.1.7`;
  - added `/api/projects/{projectId}/milestones/{milestoneId}/review`;
  - added `MilestoneReview`;
  - added `MilestoneReviewScopeBreakdown`;
  - added `MilestoneReviewRiskSection`;
  - added `MilestoneReviewRiskType`;
  - added `WorkItemRiskFilter`;
  - added `workRisk` to `WorkItemQuery`.
- Updated `apps/api/tests/openapi.test.ts` to assert the new path and schemas.
- Verified:
  - `npm test --workspace @worktrail/api -- tests/planning.test.ts tests/openapi.test.ts tests/server.test.ts`;
  - `npm run typecheck --workspace @worktrail/api`;
  - `npm run lint --workspace @worktrail/api`;
  - `npm test --workspace @worktrail/api`;
  - `git diff --check`.
- Note: the first full `npm test --workspace @worktrail/api` run hit an unrelated saved-work-views 404; `tests/saved-work-views.test.ts` passed in isolation and the full API suite passed on rerun.

## Phase 5: Angular API Client, Route, And Page Shell

Goal: add a lazy-loaded milestone review route with loading/error/content shell.

Scope:

- Update `apps/web/src/app/core/api/planning-api.ts`:
  - add `getMilestoneReview(projectId, milestoneId)`.
- Update `apps/web/src/app/core/worktrail-api.service.ts`:
  - expose `getMilestoneReview(projectId, milestoneId)`.
- Update `apps/web/src/app/app.routes.ts`:
  - add project-shell child route `milestones/:milestoneId`;
  - lazy-load `ProjectMilestoneReviewPageComponent`.
- Add `apps/web/src/app/features/projects/project-milestone-review-page.component.ts`.
- Add loading and error states using existing shared UI components.
- Load route params and call the API.
- Render a minimal page header and placeholder sections for loaded data.
- Add initial component tests for:
  - loading call;
  - successful content state;
  - error/retry state.

Out of scope:

- Full milestone review layout.
- Work links.
- Planning page integration.
- Project Work `workRisk` parsing.

Acceptance criteria:

- Direct route loads the milestone review component.
- API client method is type-safe.
- The component handles loading, error, and loaded states.
- Existing Angular routes still lazy-load.

Suggested commands:

```sh
npm test --workspace @worktrail/web -- --include src/app/features/projects/project-milestone-review-page.component.spec.ts
npm run typecheck --workspace @worktrail/web
npm run build --workspace @worktrail/web
git diff --check
```

Status:

- Completed:
  - added `PlanningApi.getMilestoneReview(projectId, milestoneId)`;
  - exposed `WorktrailApiService.getMilestoneReview(projectId, milestoneId)`;
  - added the lazy-loaded project child route at `milestones/:milestoneId`;
  - added `ProjectMilestoneReviewPageComponent` with loading, error/retry, loaded summary, scoped work link, and archived read-only states;
  - added focused component tests for successful load, archived read-only rendering, and error retry.
- Verified:
  - `npm test --workspace @worktrail/web -- --include src/app/features/projects/project-milestone-review-page.component.spec.ts`;
  - `npm run typecheck --workspace @worktrail/web`;
  - `npm run lint --workspace @worktrail/web`;
  - `npm run build --workspace @worktrail/web`;
  - `git diff --check`.

## Phase 6: Milestone Review Rendering And Links

Goal: render the full milestone review surface and query-backed navigation.

Scope:

- Render header:
  - milestone name;
  - description;
  - project key/name;
  - status;
  - target date;
  - archived state.
- Render summary metrics:
  - total;
  - open;
  - done;
  - blocked;
  - dependency blocked;
  - completion percentage.
- Render health state and reason chips using existing delivery-health display helpers where practical.
- Render scope breakdown:
  - status counts;
  - priority counts;
  - assigned/unassigned counts;
  - due-date counts;
  - dependency counts.
- Render risk sections in deterministic order with:
  - section count;
  - capped item previews;
  - empty state;
  - `Open ... work` link to project Work.
- Render recently changed work with detail links and return URL back to milestone review.
- Add helper methods for:
  - project Work router link query params;
  - detail return URL;
  - date/status/priority formatting.
- Extend component tests for links, empty sections, archived indicators, and return URLs.

Out of scope:

- Project Work `workRisk` query support.
- Planning page links.
- Playwright.

Acceptance criteria:

- The page answers milestone identity, progress, health, scope, risk, and recent movement.
- Risk action links are generated from API-provided `WorkItemQuery` values.
- Recent movement rows link to detail pages with return URLs.
- Long names/titles do not obviously overflow in component markup/CSS.

Suggested commands:

```sh
npm test --workspace @worktrail/web -- --include src/app/features/projects/project-milestone-review-page.component.spec.ts
npm run typecheck --workspace @worktrail/web
npm run build --workspace @worktrail/web
git diff --check
```

Status:

- Completed:
  - expanded `ProjectMilestoneReviewPageComponent` from shell to full review surface;
  - rendered milestone identity, project name/key, status, target date, archived marker, and read-only notice;
  - added progress summary metrics with completion percentage;
  - rendered milestone health using shared delivery-health labels, tones, and reason chips;
  - rendered scope breakdown for status, priority, ownership, due dates, and dependencies;
  - rendered API-provided risk sections with capped item previews, empty states, and project Work links generated from each section query;
  - rendered recently changed work rows linking to detail pages with return URLs back to the milestone review;
  - added responsive layout rules and overflow handling for long work item titles;
  - extended component tests for scoped work links, risk query links, empty sections, archived indicators, and detail return URLs.
- Verified:
  - `npm test --workspace @worktrail/web -- --include src/app/features/projects/project-milestone-review-page.component.spec.ts`;
  - `npm run typecheck --workspace @worktrail/web`;
  - `npm run lint --workspace @worktrail/web`;
  - `npm run build --workspace @worktrail/web`;
  - `git diff --check`.

## Phase 7: Project Work `workRisk` Integration

Goal: make milestone review risk links land on truthful, visible project Work filter state.

Scope:

- Update `apps/web/src/app/features/work-items/query/work-item-filter-state.ts`:
  - add hidden `workRisk` field to project filter form value.
- Update `apps/web/src/app/features/work-items/query/work-item-query-serialization.ts`:
  - serialize project `workRisk`;
  - parse project `workRisk`;
  - preserve `workRisk` through apply where appropriate;
  - clear `workRisk` on reset or active-chip removal.
- Update active filter label helpers:
  - `Risk: Unassigned active`;
  - `Risk: Stale in progress`.
- Update project Work page behavior so:
  - `workRisk` appears in active chips;
  - opening filters and applying does not accidentally drop hidden risk state;
  - clearing/resetting removes hidden risk state;
  - copy link and CSV export include applied `workRisk`.
- Add focused tests for query serialization, chips, filter apply/reset, copy/export query behavior where existing test seams allow it.

Out of scope:

- Visible advanced filter dropdown for `workRisk`.
- Workspace Work visible filter changes unless required by shared query helpers.
- Milestone review page changes except link verification.

Acceptance criteria:

- Milestone review risk links land on project Work with visible risk chips.
- Copy link and CSV export use the applied risk query.
- Owners/maintainers still see batch triage controls on the filtered result list.
- Contributors still do not see batch mutation controls.

Suggested commands:

```sh
npm test --workspace @worktrail/web -- --include src/app/features/work-items/query/work-item-query-serialization.spec.ts --include src/app/features/work-items/query/work-item-filter-labels.spec.ts --include src/app/features/work-items/work-items-page.component.spec.ts
npm run typecheck --workspace @worktrail/web
npm run build --workspace @worktrail/web
git diff --check
```

Status:

- Completed:
  - added hidden `workRisk` support to project Work filter state and route serialization;
  - preserved `workRisk` through project filter apply, saved-view query opening, copied links, detail return URLs, and CSV export;
  - added visible active chips for `Risk: Unassigned active` and `Risk: Stale in progress`;
  - added active-chip removal behavior that clears hidden risk query state;
  - added `workRisk` to the project Work API filter type and shared WorkItemQuery HTTP params;
  - kept workspace Work from exposing a visible risk filter while aligning its local form state with the shared query helper contract.
- Verified:
  - `npm test --workspace @worktrail/web -- --include src/app/features/work-items/query/work-item-query-serialization.spec.ts --include src/app/features/work-items/query/work-item-filter-labels.spec.ts --include src/app/features/work-items/work-items-page.component.spec.ts`;
  - `npm run typecheck --workspace @worktrail/web`;
  - `npm run lint --workspace @worktrail/web`;
  - `npm run build --workspace @worktrail/web`;
  - `git diff --check`.

## Phase 8: Planning Integration And Web Regression Tests

Goal: connect project Planning to milestone review without disrupting existing planning management.

Scope:

- Update `ProjectPlanningPageComponent`:
  - add `Review milestone` links from milestone progress rows;
  - link planning review milestone items to milestone review where appropriate;
  - keep reason chips that route to filtered Work unchanged;
  - preserve Planning `Review` and `Milestones` tabs.
- Add compact copy or action labels that distinguish:
  - reviewing milestone status;
  - opening filtered work;
  - managing milestone metadata.
- Update web tests for:
  - Planning renders milestone review links;
  - links target `/projects/:projectId/milestones/:milestoneId`;
  - existing milestone create/edit/archive/reactivate tests still pass;
  - existing delivery-health reason links still route to Work where expected.

Out of scope:

- API changes.
- New seed/browser tests.
- Moving milestone management into review pages.

Acceptance criteria:

- A maintainer can navigate from Planning to milestone review in one click.
- Planning remains review-first.
- Existing milestone management workflows remain intact.

Suggested commands:

```sh
npm test --workspace @worktrail/web -- --include src/app/features/projects/project-planning-page.component.spec.ts --include src/app/features/projects/project-milestone-review-page.component.spec.ts
npm run typecheck --workspace @worktrail/web
npm run build --workspace @worktrail/web
git diff --check
```

Status:

- Completed:
  - linked milestone progress names to `/projects/:projectId/milestones/:milestoneId`;
  - added a compact `Open work` action beside milestone progress names to preserve the existing filtered Work path;
  - linked milestone-type planning review rows to milestone review pages;
  - left delivery-health reason chips and risk section list links pointed at filtered Project Work;
  - updated Planning tests to assert the new milestone review links and the retained filtered Work links.
- Verified:
  - `npm test --workspace @worktrail/web -- --include src/app/features/projects/project-planning-page.component.spec.ts --include src/app/features/projects/project-milestone-review-page.component.spec.ts`;
  - `npm run typecheck --workspace @worktrail/web`;
  - `npm run lint --workspace @worktrail/web`;
  - `npm run build --workspace @worktrail/web`;
  - `git diff --check`.

## Phase 9: Seed Review, Playwright Smoke, And Responsive Polish

Goal: prove the milestone review workflow in a browser from deterministic seed data.

Scope:

- Review existing seed data for a deterministic milestone review scenario.
- Update `apps/api/src/db/seed.ts` only if current seed data cannot support:
  - active milestone with scoped work;
  - at least one non-empty risk section;
  - recently changed milestone work;
  - contributor read-only/absence path.
- Add Playwright coverage in `e2e/worktrail-smoke.spec.ts`:
  - open seeded project Planning;
  - click `Review milestone`;
  - verify milestone review identity, health/progress, and risk content;
  - follow one risk link to filtered project Work;
  - verify active chips include milestone and risk/status;
  - verify owner/maintainer batch controls are present on the destination Work page;
  - verify contributor can read review or destination Work without batch mutation controls.
- Check common desktop widths and responsive milestone review layout.
- Fix obvious layout issues:
  - overflowing long milestone names;
  - cramped risk rows;
  - summary metrics wrapping poorly;
  - links/buttons with unstable dimensions.

Out of scope:

- New product scope.
- Visual snapshot infrastructure.

Acceptance criteria:

- Seed data supports milestone review from a fresh reset/migrate/seed.
- Playwright covers the milestone review happy path and permission-sensitive absence path.
- Responsive layout remains usable at common desktop widths and reasonable mobile widths.

Suggested commands:

```sh
npm run db:reset
npm run db:migrate
npm run db:seed
npm run test:e2e
npm run build --workspace @worktrail/web
git diff --check
```

Status:

- Not started.

## Phase 10: Documentation, Site, Release Notes, Pattern Notes, And Final Verification

Goal: complete the release surface and verify the repository end to end.

Scope:

- Update README:
  - v0.1.7 baseline;
  - milestone review capability;
  - query-backed milestone/risk links;
  - current limitations around no forecasts/snapshots/roadmaps.
- Update public static site if milestone review should be mentioned in product copy.
- Add `docs/v0.1.7/release-notes.md`.
- Add `docs/v0.1.7/pattern-extraction-notes.md` covering:
  - derived review surfaces;
  - query-backed action links;
  - read-only operating pages;
  - aggregation of existing health/risk rules;
  - criteria for deferring persisted snapshots.
- Confirm documentation avoids discontinued extraction-target references.
- Confirm OpenAPI is current.
- Run final verification.
- Record final verification results in the implementation plan.

Out of scope:

- New product scope.
- Release tagging unless explicitly requested.

Acceptance criteria:

- README and public site match implemented capabilities.
- Release notes summarize user-facing and technical changes.
- Pattern notes are destination-neutral.
- OpenAPI matches the route surface.
- Full verification passes or any failures are documented with concrete cause.

Suggested commands:

```sh
npm run lint
npm run typecheck
npm run db:reset
npm run db:migrate
npm run db:seed
npm test
npm run build
npm run test:e2e
git diff --check
git status --short --branch
```

Status:

- Not started.
