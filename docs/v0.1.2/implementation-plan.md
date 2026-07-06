# Worktrail v0.1.2 Implementation Plan

## Purpose

This plan turns the v0.1.2 PRD and technical design into sequential implementation phases. v0.1.2 should make Worktrail's filtered work views more reliable, shareable, and trustworthy by consolidating app-local work item query behavior around the existing `WorkItemQuery` contract.

The release remains local-first. It should preserve Angular static-hosting compatibility, transport-neutral API handlers, the local Express adapter, Postgres persistence, deterministic seed data, checked-in OpenAPI docs, CI verification with a disposable Postgres service, and clean local setup from a fresh checkout.

## Design Decisions

Use these decisions while implementing v0.1.2:

- Keep `WorkItemQuery` as the canonical shared contract.
- Keep runtime query helpers app-local in the web and API apps.
- Do not add a `jawstack` query abstraction.
- Do not add a new package, dependency, database table, or migration.
- Do not add team-shared saved views in v0.1.2.
- Add copy-link actions to both workspace and project work item list pages.
- Copy links from applied query state only, not pending form edits.
- Keep saved views personal and store normalized server-side `WorkItemQuery` JSON.
- Keep saved-view summaries compact by counting meaningful query fields.
- Keep default sort (`updated_desc`) and default archived-project mode (`exclude`) omitted from router query params.
- Preserve compatibility with existing URLs.
- Prefer pure helper functions and round-trip tests over broad component snapshots.
- Hide browser clipboard behavior behind a tiny app-local service.
- Keep Playwright E2E out of required CI.

## Phase Sizing

Each phase should leave the repository in a coherent working state. This release touches API query validation, frontend list query helpers, saved views, dashboard/planning links, export requests, and list page UX, so implementation is split around behavior seams:

1. baseline planning;
2. backend query normalization review;
3. frontend query helper expansion and round-trip tests;
4. workspace list integration;
5. project list integration;
6. dashboard, health, planning, and return-url links;
7. copy filtered view link UX;
8. export trust and saved-view reliability polish;
9. E2E smoke and QA pass;
10. docs, site, release notes, extraction notes, and final verification.

Run focused API tests after backend work, focused web tests after frontend helper/list phases, and full verification during finalization.

## Phase 0: Baseline Planning

Goal: confirm v0.1.2 planning inputs and repository state before runtime changes.

Scope:

- Confirm `docs/v0.1.2/0006-query-contracts-url-state.md` exists.
- Confirm `docs/v0.1.2/prd.md` exists.
- Confirm `docs/v0.1.2/technical-design.md` exists.
- Confirm `docs/v0.1.2/implementation-plan.md` exists.
- Check repository status before implementation starts.
- Confirm active branch.
- Confirm no unresolved technical choice blocks Phase 1.

Out of scope:

- Runtime implementation.
- Database migration.
- Contract changes.
- UI changes.

Acceptance criteria:

- The v0.1.2 opportunity, PRD, technical design, and implementation plan exist.
- Design decisions are recorded.
- Worktree/index state is understood before implementation starts.
- No open decision blocks Phase 1.

Suggested commands:

```sh
find docs/v0.1.2 -maxdepth 1 -type f | sort
git status --short --branch
git diff --check
```

Status:

- Completed on 2026-07-05.
- Confirmed v0.1.2 planning inputs exist:
  - `docs/v0.1.2/0006-query-contracts-url-state.md`;
  - `docs/v0.1.2/prd.md`;
  - `docs/v0.1.2/technical-design.md`;
  - `docs/v0.1.2/implementation-plan.md`.
- Confirmed implementation decisions:
  - keep `WorkItemQuery` as the canonical shared contract;
  - keep runtime query helpers app-local in the web and API apps;
  - do not add a `jawstack` query abstraction;
  - do not add a new package, dependency, database table, or migration;
  - do not add team-shared saved views in v0.1.2;
  - add copy-link actions to both workspace and project work item list pages;
  - copy links from applied query state only, not pending form edits;
  - keep saved views personal and store normalized server-side `WorkItemQuery` JSON;
  - keep saved-view summaries compact by counting meaningful query fields;
  - omit default sort and default archived-project mode from router query params;
  - preserve compatibility with existing URLs;
  - prefer pure helper functions and round-trip tests;
  - hide browser clipboard behavior behind a small app-local service;
  - keep Playwright E2E out of required CI.
- Confirmed active branch is `main`.
- Confirmed current change state:
  - only `docs/v0.1.2/` is untracked;
  - no runtime files have been changed yet.
- Verified `git diff --check`.
- No unresolved technical choice blocks Phase 1.

## Phase 1: Backend Query Normalization Review

Goal: strengthen server-side query normalization and saved-view validation without changing API shape.

Scope:

- Review `apps/api/src/validation/work-item-query.ts`.
- Preserve `parseWorkspaceWorkItemQuery`, `parseProjectWorkItemQuery`, `parseWorkItemQuery`, and `normalizeWorkItemQuery` as the server-side query authority.
- Add or adjust tests in `apps/api/tests/work-item-query.test.ts` for:
  - unknown field stripping;
  - empty string normalization;
  - default sort behavior;
  - default archived-project behavior;
  - project-scoped stripping of workspace-only fields;
  - contradictory status/work-state behavior;
  - contradictory assignee/unassigned behavior.
- Add or adjust tests in `apps/api/tests/saved-work-views.test.ts` for:
  - saved-view create normalizes query JSON;
  - saved-view update normalizes query JSON;
  - invalid query combinations fail consistently;
  - unknown fields are not persisted;
  - actor scoping still holds.
- Review OpenAPI query parameter docs and update only if stale.

Out of scope:

- New endpoints.
- New contracts.
- Database migration.
- Frontend changes.

Acceptance criteria:

- API-side query normalization behavior is explicitly covered.
- Saved views store normalized `WorkItemQuery` JSON.
- No API route shape changes are introduced.
- Existing work item list/export tests still pass.

Suggested commands:

```sh
npm test --workspace @worktrail/api -- work-item-query saved-work-views
npm run typecheck --workspace @worktrail/api
git diff --check
```

## Phase 2: Frontend Query Helpers And Round-Trip Tests

Goal: consolidate frontend query conversion behind pure helper functions with broad round-trip tests.

Scope:

- Update `apps/web/src/app/features/work-items/query/work-item-query-serialization.ts`.
- Keep form-value types in `work-item-filter-state.ts`.
- Add or refine helper functions for:
  - project form value to `WorkItemQuery`;
  - workspace form value to `WorkItemQuery`;
  - project query to router query params;
  - workspace query to router query params;
  - project route query params to form values;
  - workspace route query params to form values;
  - project query to form values;
  - workspace query to form values;
  - router-link query params from `WorkItemQuery`;
  - return URL construction from applied query;
  - meaningful query field count.
- Preserve existing helper names where that reduces churn, but prefer clearer names if necessary.
- Expand `work-item-query-serialization.spec.ts` with round-trip fixtures for:
  - empty/default project query;
  - full project query;
  - empty/default workspace query;
  - full workspace query;
  - unassigned workspace query;
  - blocked false;
  - status versus work-state precedence;
  - default omission;
  - saved-view hydration;
  - delivery-health link conversion.

Out of scope:

- Component template changes.
- Copy-link UI.
- API changes.

Acceptance criteria:

- Query helper tests fail if supported filters are dropped or serialized inconsistently.
- Defaults are omitted from router params.
- Existing public helper behavior remains compatible with current list pages until integration phases replace private component logic.

Suggested commands:

```sh
npm test --workspace @worktrail/web -- --watch=false --include 'src/app/features/work-items/query/*.spec.ts'
npm run typecheck --workspace @worktrail/web
git diff --check
```

## Phase 3: Workspace List Integration

Goal: make the workspace work item list use canonical query helpers for applied list state.

Scope:

- Refactor `WorkspaceWorkItemListPageComponent` to delegate:
  - form-to-query conversion;
  - query-to-form conversion;
  - query-to-router params;
  - return URL construction;
  - meaningful saved-view filter count.
- Ensure `appliedFilterValues` and `appliedQuery()` remain the source for:
  - active chips;
  - saved-view creation;
  - saved-view query updates;
  - CSV export;
  - detail return URLs.
- Ensure pending form edits do not affect active chips, saved views, export, or return URLs until applied.
- Update workspace list tests for:
  - URL hydration;
  - active filter chips from applied state;
  - saved-view open through canonical params;
  - saved-view summary count;
  - export with applied filters only.

Out of scope:

- Project list refactor.
- Copy-link UI.
- Dashboard/planning links.

Acceptance criteria:

- Workspace list behavior remains user-compatible.
- Component-owned duplicate query serialization is removed or materially reduced.
- Workspace saved-view and export tests pass with canonical helpers.

Suggested commands:

```sh
npm test --workspace @worktrail/web -- --watch=false --include 'src/app/features/work-items/workspace-work-item-list-page.component.spec.ts'
npm test --workspace @worktrail/web -- --watch=false --include 'src/app/features/work-items/query/*.spec.ts'
npm run typecheck --workspace @worktrail/web
git diff --check
```

## Phase 4: Project List Integration

Goal: make the project work item list use canonical query helpers for applied list state.

Scope:

- Refactor `WorkItemListPageComponent` to delegate:
  - form-to-query conversion;
  - query-to-router params;
  - route query params to form values;
  - return URL construction.
- Ensure project-scoped helpers omit workspace-only fields.
- Ensure active chips, export, and detail return URLs use applied state only.
- Update project list tests for:
  - URL hydration;
  - applied filter chips;
  - pending filter edits not affecting export;
  - canonical return URL query params;
  - default sort omission.

Out of scope:

- Workspace list changes beyond shared helper fixes.
- Copy-link UI.
- Dashboard/planning links.

Acceptance criteria:

- Project list behavior remains user-compatible.
- Project list no longer hand-rolls canonical query param conversion.
- Project and workspace helper tests remain green together.

Suggested commands:

```sh
npm test --workspace @worktrail/web -- --watch=false --include 'src/app/features/work-items/work-items-page.component.spec.ts'
npm test --workspace @worktrail/web -- --watch=false --include 'src/app/features/work-items/query/*.spec.ts'
npm run typecheck --workspace @worktrail/web
git diff --check
```

## Phase 5: Dashboard, Health, Planning, And Return URLs

Goal: route dashboard, delivery-health, planning, and detail return links through canonical query helpers.

Scope:

- Refactor delivery-health query param helpers to use the work item query serialization module.
- Update project home delivery-health links.
- Update project planning delivery-health links.
- Update project planning review links where `query` is present.
- Verify list/detail return URLs use applied query state.
- Update tests for:
  - delivery-health query conversion;
  - project home metric links if covered;
  - project planning metric/review links if covered;
  - return URL behavior from result list/detail links.

Out of scope:

- New dashboard metrics.
- New planning data.
- Copy-link UI.

Acceptance criteria:

- Metric and planning links produce clean canonical params.
- Project-scoped links do not include workspace-only query fields.
- Existing dashboard/planning behavior remains compatible.

Suggested commands:

```sh
npm test --workspace @worktrail/web -- --watch=false --include 'src/app/shared/delivery-health/*.spec.ts'
npm test --workspace @worktrail/web -- --watch=false --include 'src/app/features/projects/*.spec.ts'
npm test --workspace @worktrail/web -- --watch=false --include 'src/app/features/work-items/components/*.spec.ts'
npm run typecheck --workspace @worktrail/web
git diff --check
```

## Phase 6: Copy Filtered View Link UX

Goal: add copy-link actions for project and workspace filtered views using applied query state.

Scope:

- Add a small app-local clipboard service.
- Implement `copyText` with:
  - `navigator.clipboard.writeText` when available;
  - temporary textarea fallback where possible;
  - rejected promise when copying is unavailable.
- Add "Copy link" actions to:
  - workspace work item list;
  - project work item list.
- Build copied URLs from:
  - current origin;
  - current list path;
  - canonical router params from applied query.
- Add success and failure states that are visible but compact.
- Ensure pending form edits are not copied until applied.
- Add tests for:
  - clipboard service success/fallback/failure where practical;
  - workspace copy link uses applied query;
  - project copy link uses applied query;
  - success/failure UI state.

Out of scope:

- Native share sheet.
- Short links.
- Permission prompts beyond browser defaults.

Acceptance criteria:

- A user can copy a filtered workspace list link.
- A user can copy a filtered project list link.
- Copied links reopen equivalent applied views.
- Pending filter edits do not alter copied links.

Suggested commands:

```sh
npm test --workspace @worktrail/web -- --watch=false --include 'src/app/**/*.spec.ts' --testNamePattern='copy|clipboard|work item list|workspace work item'
npm run typecheck --workspace @worktrail/web
git diff --check
```

## Phase 7: Export Trust And Saved-View Reliability Polish

Goal: finish product-facing reliability around exports and saved views after helper integration.

Scope:

- Review workspace and project export actions after refactors.
- Ensure export requests use applied query and canonical HTTP params.
- Add concise export affordance copy or button title/ARIA text if it improves clarity without clutter.
- Review saved-view create/open/update/delete after query helper integration.
- Ensure saved-view summaries count meaningful filters only.
- Add or adjust tests for:
  - export pending edits not applied;
  - saved-view query summary count;
  - saved-view open URL params;
  - stale query references remaining readable where existing display data allows.

Out of scope:

- Team-shared saved views.
- Rich saved-view label breakdown.
- Export preview modal.

Acceptance criteria:

- Export behavior matches active chips and current applied URL.
- Saved-view behavior remains stable after helper refactor.
- Visible copy around export does not crowd list actions.

Suggested commands:

```sh
npm test --workspace @worktrail/web -- --watch=false --include 'src/app/features/work-items/*.spec.ts'
npm test --workspace @worktrail/web -- --watch=false --include 'src/app/features/work-items/components/*.spec.ts'
npm run typecheck --workspace @worktrail/web
git diff --check
```

## Phase 8: E2E Smoke And QA Pass

Goal: verify the core filtered-view workflow through the running app.

Scope:

- Add or adjust one low-cost Playwright smoke if appropriate:
  - open workspace work item list;
  - apply filters;
  - confirm URL/chips/results;
  - reload filtered URL;
  - confirm chips/results survive reload.
- Consider a manual QA note for copy-link behavior if clipboard APIs are awkward in Playwright.
- Run existing E2E smoke.
- Fix regressions found during smoke testing.

Out of scope:

- Making E2E required in CI.
- Exhaustive browser matrix.
- Deep clipboard permission testing.

Acceptance criteria:

- Existing E2E smoke passes.
- Filtered URL reload behavior is covered by automated or clearly documented manual QA.
- No obvious user-facing query-state regression remains.

Suggested commands:

```sh
npm run db:reset
npm run db:migrate
npm run db:seed
npm run test:e2e
git diff --check
```

## Phase 9: Documentation, Site, Release Notes, And Final Verification

Goal: finish v0.1.2 with complete docs, public-site updates as appropriate, release notes, extraction notes, and full verification.

Scope:

- Update `README.md` with:
  - reliable filtered URLs;
  - copy filtered view links;
  - saved views;
  - export-current-filters behavior.
- Update `site/index.html` if copy-link/shareable-view behavior should be public-facing.
- Add `docs/v0.1.2/release-notes.md`.
- Add `docs/v0.1.2/jawstack-extraction-notes.md`.
- Preserve `docs/v0.1.2/0006-query-contracts-url-state.md` as source material.
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
- Release notes summarize v0.1.2 capabilities and verification.
- Extraction notes capture the query contract and URL state pattern without claiming it is framework-ready.
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
- Backend-only phase: API typecheck and focused API tests.
- Frontend helper phase: helper tests and web typecheck.
- Frontend list phase: focused list component tests, helper tests, and web typecheck.
- Cross-surface link/export phase: focused web tests for affected pages/components.
- Final phase: lint, typecheck, reset/migrate/seed, tests, build, and E2E.

Prefer focused checks while iterating, then broaden before closing each phase.

## Deferred Items

Defer these unless the user explicitly changes scope:

- `jawstack` query abstraction;
- standalone query-contract package;
- moving runtime validators into `@worktrail/contracts`;
- team-shared saved views;
- rich saved-view query labels;
- server-side pagination;
- full-text search infrastructure;
- advanced query-builder UI;
- native share sheet;
- short links;
- new database schema;
- new third-party dependencies.
