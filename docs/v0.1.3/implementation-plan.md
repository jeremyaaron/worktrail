# Worktrail v0.1.3 Implementation Plan

## Purpose

This plan turns the v0.1.3 PRD and technical design into sequential implementation phases. v0.1.3 should make reliable filtered work views collaborative by adding workspace-shared saved views while preserving personal saved views and the v0.1.2 query-state contract.

The release remains local-first. It should preserve Angular static-hosting compatibility, transport-neutral API handlers, the local Express adapter, Postgres persistence, deterministic seed data, checked-in OpenAPI docs, CI verification with a disposable Postgres service, and clean local setup from a fresh checkout.

## Design Decisions

Use these decisions while implementing v0.1.3:

- Use `workspace` as the shared saved-view visibility value.
- Keep existing `owner` attribution for personal and workspace saved views.
- Authorize workspace-view management by current actor role, not creator-only ownership.
- Allow owners and maintainers to manage all workspace-shared views.
- Keep contributors read-only for workspace-shared views.
- Preserve personal-view ownership rules.
- Defer project-scoped saved views.
- Add workspace activity only for workspace-view create, rename, query update, and delete.
- Do not add saved-view ordering, pinning, folders, icons, colors, descriptions, or rich metadata.
- Keep shared views backed by normalized `WorkItemQuery`.
- Reuse the existing saved-view route surface.
- Avoid new frontend, backend, or infrastructure dependencies.

## Phase Sizing

Each phase should leave the repository in a coherent working state. This release touches contracts, database schema, API authorization, seed data, workspace activity, Angular saved-view UI, OpenAPI docs, E2E smoke, and release documentation, so implementation is split around ownership boundaries:

1. baseline planning;
2. contracts and migration;
3. repository and service authorization;
4. saved-view API endpoint tests and OpenAPI shape;
5. deterministic seed data and activity display checks;
6. saved-view toolbar component UI;
7. workspace Work Items integration;
8. Playwright smoke and manual QA pass;
9. documentation, site, release notes, extraction notes, and final verification.

Run focused contract/API tests after backend work, focused web tests after frontend phases, and full verification during finalization.

## Phase 0: Baseline Planning

Goal: confirm v0.1.3 planning inputs and repository state before runtime changes.

Scope:

- Confirm `docs/v0.1.3/prd.md` exists.
- Confirm `docs/v0.1.3/technical-design.md` exists.
- Confirm `docs/v0.1.3/implementation-plan.md` exists.
- Confirm active branch and repository status.
- Confirm no unresolved technical choice blocks Phase 1.
- Confirm v0.1.2 query-contract notes remain available as source material.

Out of scope:

- Runtime implementation.
- Database migration.
- Contract changes.
- UI changes.

Acceptance criteria:

- v0.1.3 planning inputs exist.
- Design decisions are recorded.
- Worktree/index state is understood before implementation starts.
- No open decision blocks Phase 1.

Suggested commands:

```sh
find docs/v0.1.3 -maxdepth 1 -type f | sort
test -f docs/v0.1.2/jawstack-extraction-notes.md
git status --short --branch
git diff --check
```

Status:

- Completed on 2026-07-05.
- Confirmed v0.1.3 planning inputs exist:
  - `docs/v0.1.3/prd.md`;
  - `docs/v0.1.3/technical-design.md`;
  - `docs/v0.1.3/implementation-plan.md`.
- Confirmed `docs/v0.1.2/jawstack-extraction-notes.md` remains available as source material.
- Confirmed implementation decisions:
  - use `workspace` as the shared saved-view visibility value;
  - keep owner attribution while authorizing workspace-view management by current actor role;
  - allow owners and maintainers to manage all workspace-shared views;
  - keep contributors read-only for workspace-shared views;
  - preserve personal saved-view ownership rules;
  - defer project-scoped saved views;
  - add workspace activity only for workspace-view management events;
  - avoid saved-view ordering, pinning, folders, rich metadata, new dependencies, and generic `jawstack` extraction.
- Confirmed active branch is `main`.
- Confirmed current change state:
  - only `docs/v0.1.3/` is untracked;
  - no runtime files have been changed yet.
- Verified `git diff --check`.
- No unresolved technical choice blocks Phase 1.

## Phase 1: Contracts And Database Migration

Goal: add the shared saved-view visibility to contracts and persistence without changing behavior yet.

Scope:

- Update `SavedWorkViewVisibility` to include `workspace`.
- Update `CreateSavedWorkViewRequest` to accept optional `visibility`.
- Update contract tests for workspace visibility.
- Update API domain constants for `savedWorkViewVisibilities`.
- Update workspace activity event type contracts/constants for:
  - `saved_view.created`;
  - `saved_view.name_changed`;
  - `saved_view.query_changed`;
  - `saved_view.updated`;
  - `saved_view.deleted`.
- Update Drizzle schema check constraints.
- Add a Drizzle migration that:
  - expands the saved-view visibility check;
  - replaces the current saved-view unique index with partial unique indexes for personal and workspace scopes.
- Verify existing personal saved views survive migration from a reset/migrate path.

Out of scope:

- API behavior changes.
- Seeded workspace views.
- Frontend UI.
- OpenAPI docs.

Acceptance criteria:

- Contracts compile with `personal | workspace`.
- Migration applies cleanly.
- Existing personal saved-view uniqueness is preserved.
- Workspace saved-view uniqueness can be represented by the schema.

Suggested commands:

```sh
npm test --workspace @worktrail/contracts
npm run typecheck --workspace @worktrail/contracts
npm run db:reset
npm run db:migrate
npm run db:seed
npm run typecheck --workspace @worktrail/api
git diff --check
```

Status:

- Completed on 2026-07-05.
- Updated shared contracts:
  - `SavedWorkViewVisibility` now supports `personal | workspace`;
  - `CreateSavedWorkViewRequest` accepts optional `visibility`;
  - `WorkspaceActivityEventType` includes shared saved-view management events.
- Updated API constants for saved-view visibility and workspace activity event types.
- Updated Drizzle schema to model personal and workspace saved-view uniqueness with partial unique indexes.
- Generated `apps/api/drizzle/0007_panoramic_chimera.sql` and snapshot metadata.
- Verified clean migration path from reset through seed.
- Verified:
  - `npm test --workspace @worktrail/contracts`
  - `npm run typecheck --workspace @worktrail/contracts`
  - `npm run typecheck --workspace @worktrail/api`
  - `npm run db:reset`
  - `npm run db:migrate`
  - `npm run db:seed`
  - `git diff --check`

## Phase 2: Repository And Service Authorization

Goal: implement workspace-shared saved-view API behavior behind the existing route surface.

Scope:

- Extend saved-view repository with:
  - visible-list query for actor personal plus workspace views;
  - personal name lookup;
  - workspace name lookup.
- Update `SavedWorkViewService` list behavior to return actor personal views plus workspace views.
- Hydrate distinct owners for listed saved views.
- Add create support for optional `visibility`.
- Enforce authorization:
  - personal create/update/delete remains actor-owned;
  - workspace create/update/delete requires owner or maintainer;
  - contributors can list/open but cannot mutate workspace views.
- Normalize query JSON for workspace views through `normalizeWorkItemQuery`.
- Add workspace activity events for workspace-view create/update/delete.
- Preserve not-found behavior for cross-owner personal views.
- Use forbidden errors for visible workspace views the actor cannot mutate.

Out of scope:

- Angular UI changes.
- Seeded workspace views.
- OpenAPI docs.
- Playwright smoke.

Acceptance criteria:

- API service supports `personal` and `workspace` visibility.
- Existing personal saved-view workflows remain compatible.
- Permission rules match the technical design.
- Workspace-view mutations create workspace activity only for workspace visibility.

Suggested commands:

```sh
npm test --workspace @worktrail/api -- saved-work-views.test.ts
npm test --workspace @worktrail/api -- workspace.test.ts
npm run typecheck --workspace @worktrail/api
git diff --check
```

Status:

- Completed on 2026-07-06.
- Extended the saved-view repository with actor-visible list queries and separate personal/workspace name lookups.
- Updated `SavedWorkViewService` so list returns actor personal views plus workspace-shared views with distinct owner hydration.
- Added optional `visibility` handling to saved-view creation while preserving personal as the default.
- Enforced shared-view mutation rules:
  - personal saved views remain owner-only and hidden across actors;
  - workspace saved views can be listed by all actors;
  - workspace saved-view create/update/delete requires owner or maintainer role.
- Added workspace activity events for shared-view create, rename/query update, combined update, and delete operations.
- Accepted `visibility` in the existing saved-view API create payload.
- Verified:
  - `npm test --workspace @worktrail/api -- saved-work-views.test.ts`
  - `npm test --workspace @worktrail/api -- workspace.test.ts`
  - `npm run typecheck --workspace @worktrail/api`
  - `git diff --check`

## Phase 3: API Coverage And OpenAPI Shape

Goal: complete backend verification and document the API contract before frontend integration.

Scope:

- Expand `apps/api/tests/saved-work-views.test.ts` for:
  - list returns actor personal plus workspace views;
  - list excludes other actors' personal views;
  - owner creates workspace view;
  - maintainer creates workspace view;
  - contributor cannot create workspace view;
  - contributor can list workspace view;
  - owner/maintainer can rename/update/delete workspace views;
  - contributor cannot update/delete workspace views;
  - personal owner-only update/delete still works;
  - personal duplicate names are scoped per owner;
  - workspace duplicate names are scoped per workspace;
  - query normalization applies to workspace views;
  - workspace activity is emitted for shared-view management.
- Update server route tests only if request/response examples need changes.
- Update `docs/api/openapi.yaml` for:
  - `SavedWorkViewVisibility`;
  - create request `visibility`;
  - list behavior note;
  - permission response notes for workspace visibility.
- Run API and OpenAPI tests.

Out of scope:

- Frontend implementation.
- Seeded shared views unless needed for tests.
- E2E.

Acceptance criteria:

- Backend permission matrix is covered.
- OpenAPI matches implemented saved-view shape.
- Existing API tests remain green.

Suggested commands:

```sh
npm test --workspace @worktrail/api -- saved-work-views.test.ts
npm test --workspace @worktrail/api -- openapi.test.ts server.test.ts
npm run typecheck --workspace @worktrail/api
git diff --check
```

Status:

- Completed on 2026-07-06.
- Expanded `apps/api/tests/saved-work-views.test.ts` to cover:
  - actor personal plus workspace-shared list behavior;
  - exclusion of other actors' personal saved views;
  - owner and maintainer shared-view creation;
  - contributor create/update/delete rejection for shared views;
  - contributor list access for shared views;
  - maintainer update and owner delete of shared views;
  - personal owner-only update/delete compatibility;
  - personal and workspace duplicate-name scoping;
  - workspace-view query normalization;
  - workspace activity events for shared-view management.
- Updated `docs/api/openapi.yaml` with `SavedWorkViewVisibility`, create-request `visibility`, list behavior notes, and shared-view permission notes.
- Updated OpenAPI reference tests to guard the saved-view visibility and shared-view activity contract.
- Verified:
  - `npm test --workspace @worktrail/api -- saved-work-views.test.ts`
  - `npm test --workspace @worktrail/api -- openapi.test.ts server.test.ts`
  - `ruby -e "require 'yaml'; YAML.load_file('docs/api/openapi.yaml'); puts 'YAML parsed'"`
  - `npm run typecheck --workspace @worktrail/api`
  - `git diff --check`

## Phase 4: Seeded Shared Views And Activity Surface

Goal: add deterministic workspace-shared views and ensure existing workspace activity display can render shared-view events.

Scope:

- Add deterministic shared saved-view IDs to seed constants.
- Seed workspace-shared views:
  - `Blocked work`;
  - `Dependency risks`;
  - `Due soon`;
  - `Unassigned open work`;
  - `Ready for pickup`.
- Use meaningful canonical `WorkItemQuery` values.
- Ensure seed upsert handles `visibility: 'workspace'`.
- Confirm seeded shared views are visible to all active members through the API.
- Confirm workspace activity event formatting remains readable for new event types.
- Add or adjust workspace settings tests only if event type formatting needs explicit coverage.

Out of scope:

- Frontend saved-view toolbar changes.
- Playwright smoke.
- Documentation updates.

Acceptance criteria:

- Reset/migrate/seed creates shared views.
- API list returns seeded shared views for owner, maintainer, and contributor actors.
- Workspace activity display handles shared-view event types without placeholder-looking text.

Suggested commands:

```sh
npm run db:reset
npm run db:migrate
npm run db:seed
npm test --workspace @worktrail/api -- saved-work-views.test.ts
npm test --workspace @worktrail/web -- --watch=false --include 'src/app/features/workspace/*.spec.ts'
npm run typecheck
git diff --check
```

## Phase 5: Saved Views Toolbar UI

Goal: update the reusable saved-view toolbar to distinguish personal and workspace views.

Scope:

- Update `SavedViewsToolbarComponent` inputs to receive personal and workspace view arrays explicitly.
- Add outputs for:
  - save personal view;
  - save workspace view.
- Keep one compact name input.
- Show two save actions:
  - `Save personal view`;
  - `Save shared view` only when workspace management is allowed.
- Render shared workspace views above personal views.
- Show shared and personal counts.
- Show shared management actions only when `canManageWorkspaceViews` is true.
- Always allow opening shared views.
- Keep personal view management behavior.
- Add contributor helper copy explaining that owners and maintainers manage shared views.
- Preserve meaningful query summaries and compact `<details>` management behavior.
- Update `saved-views-toolbar.component.spec.ts`.

Out of scope:

- Page-level API integration.
- API work.
- E2E.

Acceptance criteria:

- Toolbar visually separates shared and personal views.
- Contributors can open shared views but do not see shared management actions.
- Owners/maintainers see shared management actions.
- Existing personal saved-view toolbar behavior remains covered.

Suggested commands:

```sh
npm test --workspace @worktrail/web -- --watch=false --include 'src/app/features/work-items/components/saved-views-toolbar.component.spec.ts'
npm run typecheck --workspace @worktrail/web
git diff --check
```

## Phase 6: Workspace Work Items Integration

Goal: wire shared saved views into the workspace Work Items page.

Scope:

- Split loaded saved views into:
  - personal views;
  - workspace shared views.
- Add `canManageWorkspaceSavedViews` derived from the current actor role.
- Wire toolbar save personal action to create a personal saved view.
- Wire toolbar save shared action to create `visibility: 'workspace'`.
- Preserve existing save-current-view behavior where practical.
- Ensure update query, rename, and delete work for shared views when allowed.
- Ensure contributors do not send shared-view mutation requests from the UI.
- Sort personal and workspace view groups alphabetically by name.
- Ensure opening shared views uses canonical workspace router params.
- Ensure export and copy-link behavior after opening shared views still uses applied query state.
- Update `workspace-work-item-list-page.component.spec.ts`.
- Update `worktrail-api.service.spec.ts` for create request visibility if needed.

Out of scope:

- Project-scoped saved views.
- E2E smoke.
- Docs.

Acceptance criteria:

- Owner/maintainer can create, rename, update, and delete shared views from workspace Work Items.
- Contributor can see and open shared views but cannot manage them.
- Personal saved-view workflows still pass.
- Opening a shared view updates URL/chips/results through canonical query params.

Suggested commands:

```sh
npm test --workspace @worktrail/web -- --watch=false --include 'src/app/features/work-items/workspace-work-item-list-page.component.spec.ts'
npm test --workspace @worktrail/web -- --watch=false --include 'src/app/core/worktrail-api.service.spec.ts'
npm run typecheck --workspace @worktrail/web
git diff --check
```

## Phase 7: E2E Smoke And QA Pass

Goal: verify a user-visible shared-view path through the running app.

Scope:

- Add or adjust one Playwright smoke:
  - open workspace Work Items as Avery Owner;
  - open seeded `Dependency risks` shared view;
  - confirm active chips and results;
  - switch actor to Casey Contributor;
  - confirm shared view is visible/openable;
  - confirm shared management controls are unavailable for contributor.
- Run existing E2E smoke.
- Fix regressions found during smoke testing.
- Document any manual QA gap if browser behavior is impractical to automate.

Out of scope:

- Making E2E required in CI.
- Exhaustive permission matrix in Playwright.
- Deep copy-link permission testing.

Acceptance criteria:

- Existing E2E smoke passes.
- Shared-view open path is covered in browser-level smoke.
- No obvious saved-view UI regression remains.

Suggested commands:

```sh
npm run db:reset
npm run db:migrate
npm run db:seed
npx playwright test -g "shared view"
npm run test:e2e
git diff --check
```

## Phase 8: Documentation, Site, Release Notes, Extraction Notes, And Final Verification

Goal: finish v0.1.3 with complete docs, public-site updates as appropriate, release notes, extraction notes, and full verification.

Scope:

- Update `README.md` with:
  - personal versus workspace saved views;
  - owner/maintainer management rules;
  - contributor open/read behavior;
  - relationship to reliable filtered URLs, copy links, and export.
- Update `site/index.html` if shared views are polished enough to mention publicly.
- Add `docs/v0.1.3/release-notes.md`.
- Add `docs/v0.1.3/jawstack-extraction-notes.md`.
- Preserve v0.1.2 query-contract notes as source material.
- Confirm `docs/api/openapi.yaml` is updated.
- Run full verification:
  - lint;
  - typecheck;
  - reset/migrate/seed;
  - unit tests;
  - production build;
  - Playwright smoke.
- Confirm no generated artifacts are unintentionally included.
- Confirm repository status before handoff.

Out of scope:

- Creating the release tag unless explicitly requested.
- Publishing/deploying beyond existing workflows unless explicitly requested.

Acceptance criteria:

- README and public site accurately describe the shipped capability.
- Release notes summarize v0.1.3 capabilities and verification.
- Extraction notes capture shared query artifacts without claiming a framework abstraction is ready.
- Full verification passes or failures are documented with specific residual risk.
- Worktree status is understood.

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
git status --short --branch
git diff --check
```

## Verification Cadence

Use this cadence unless a phase requires broader checks:

- Planning phase: file existence, branch/status, whitespace check.
- Contract/migration phase: contracts tests, migration reset/migrate/seed, API typecheck.
- Backend phase: focused saved-view API tests and API typecheck.
- Frontend component phase: focused component tests and web typecheck.
- Frontend page phase: focused page/API-client tests and web typecheck.
- E2E phase: reset/migrate/seed, focused Playwright smoke, full Playwright smoke.
- Final phase: lint, typecheck, reset/migrate/seed, tests, build, and E2E.

Prefer focused checks while iterating, then broaden before closing each phase.

## Deferred Items

Defer these unless the user explicitly changes scope:

- project-scoped saved views;
- team-shared saved view ordering, pinning, folders, icons, colors, and descriptions;
- converting personal views to workspace views or workspace views to personal views;
- sharing controls outside the workspace Work Items page;
- native share sheets;
- short links;
- saved-view analytics;
- advanced query-builder UI;
- server-side pagination;
- full-text search infrastructure;
- production authentication;
- multi-workspace membership;
- generic `jawstack` saved-view abstraction;
- new third-party dependencies.
