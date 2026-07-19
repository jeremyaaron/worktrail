# Worktrail v0.2.6 Implementation Plan

## Purpose

This plan turns the v0.2.6 PRD and technical design into sequential implementation phases.

v0.2.6 should add Scalable Work Discovery. Project Work and workspace Work Items will load bounded,
server-backed pages with exact totals, deterministic ordering, readable URL state, accessible page
navigation, page-scoped project bulk selection, and guarded full-result CSV exports.

The release should preserve:

- current work item filter, sort, search, hierarchy, dependency, risk, and archive semantics;
- draft-versus-applied filter behavior and active filter chips;
- personal/shared saved views and pinned shortcuts;
- copy links, browser history, detail return URLs, and filtered exports;
- explicit-ID project batch triage and current permission behavior;
- complete project board columns and persisted drag/drop ordering;
- bounded parent candidate and child-work reads;
- My Work, Planning, Cycle Review, Milestone Review, Portfolio, reports, and closeout behavior;
- work breakdown, dependency, cycle, milestone, notification, comment, watcher, and activity behavior;
- immutable report and cycle closeout snapshots;
- transport-neutral endpoint handlers and local PostgreSQL operation;
- deterministic seed and browser workflows;
- full local and CI verification.

## Design Decisions

Use these decisions while implementing v0.2.6:

- Use one-based page/offset pagination.
- Support page sizes `10`, `25`, `50`, and `100`.
- Default to page `1` and page size `25`.
- Keep `WorkItemQuery` limited to durable filters and sort.
- Add separate `WorkItemPageQuery` and resolved page-window contracts.
- Return concrete project/workspace page envelopes with exact totals and navigation booleans.
- Change the existing interactive list endpoints to page envelopes:
  - `GET /api/projects/:projectId/work-items`;
  - `GET /api/work-items`.
- Add `GET /api/projects/:projectId/board/work-items` as an explicit complete board projection.
- Count, clamp, read, and enrich one page inside a read-only repeatable-read transaction.
- Normalize stale high pages to the final valid page; use page 1 for empty results.
- Add ascending UUID as the final tie-breaker for every work item sort.
- Enrich only returned interactive-page rows.
- Omit default page and page size from browser URLs.
- Include non-default page state in copied links and detail return URLs.
- Keep page state out of saved views, active chips, query-summary counts, and export meaning.
- Reset to page 1 and size 25 when filters, sort, saved view, project, or actor changes.
- Keep bulk selection limited to explicit visible-page IDs and clear it across page/query changes.
- Export all matching rows under a fixed 10,000-row synchronous limit.
- Detect export overflow with a `10_001` raw-row read and return `422 EXPORT_LIMIT_EXCEEDED`.
- Add `pg_trgm` plus GIN trigram indexes for display key, title, and description search.
- Use one shared presentational Angular pager without introducing a generic data-grid framework.
- Use text Previous/Next controls and bounded numeric page buttons; do not add an icon dependency.
- Keep internal complete reads purpose-specific and document their remaining scale risk.
- Do not add cursors, infinite scroll, query-wide selection, background jobs, or board pagination.

## Phase Sizing

Each phase should leave the repository in a coherent, compiling state.

Implementation phases:

0. baseline planning;
1. paging contracts, validation, and error vocabulary;
2. search migration and repository paging primitives;
3. read transactions, page services, and complete board service;
4. bounded full-result CSV export;
5. frontend paging serialization and shared presentation primitives;
6. coordinated list endpoint and Angular consumer cutover;
7. project Work pagination and batch-triage hardening;
8. workspace Work Items and cross-surface compatibility;
9. performance evidence, seeded browser coverage, and responsive/accessibility verification;
10. documentation, metadata, and final verification.

Run focused contract/validation checks after Phase 1, fresh migration and repository checks after Phase
2, service tests after Phases 3-4, Angular primitive tests after Phase 5, API and web integration tests
after Phase 6, focused route tests after Phases 7-8, browser/performance checks after Phase 9, and full
verification during Phase 10.

## Phase 0: Baseline Planning

Goal: confirm v0.2.6 planning inputs, repository state, migration order, and implementation choices
before runtime changes.

Scope:

- Confirm these planning documents exist:
  - `docs/v0.2.6/prd.md`;
  - `docs/v0.2.6/technical-design.md`;
  - `docs/v0.2.6/implementation-plan.md`.
- Confirm active branch, commit baseline, worktree state, and index state.
- Confirm no runtime files have been changed for v0.2.6.
- Confirm current package and OpenAPI baseline is `0.2.5`.
- Confirm current latest migration is `0015_silky_tyger_tiger.sql` and the next migration is expected as
  `0016_*`.
- Confirm local and CI PostgreSQL can install `pg_trgm` through the migration role.
- Confirm the technical design records no blocking product or architecture choices.
- Confirm current consumers of interactive work-list endpoints:
  - project Work;
  - workspace Work Items;
  - project board;
  - relationship candidate search.
- Confirm internal complete work-item reads used by My Work, planning, review, reports, portfolio, and
  project health will not be changed mechanically.
- Confirm current project bulk selection is explicit-ID and visible-row based.
- Confirm no later user request changes sprint scope.

Out of scope:

- Runtime implementation.
- Contract edits.
- Migration generation.
- Performance fixture creation.
- Tests beyond planning and diff hygiene.

Acceptance criteria:

- All three planning documents exist.
- Repository state is understood before implementation.
- No unresolved decision blocks Phase 1.
- Migration and endpoint sequencing preserve a compiling repository.
- The list endpoint cutover has a documented update path for every Angular consumer.
- Scope remains bounded to scalable project/workspace work discovery and its direct compatibility
  requirements.

Suggested commands:

```sh
find docs/v0.2.6 -maxdepth 1 -type f | sort
git status --short --branch
git diff --cached --name-only
git log -1 --oneline --decorate
git diff --check
ls apps/api/drizzle | sort | tail
rg -n "listWorkItems|listWorkspaceWorkItems" apps/api/src apps/web/src/app
rg -n "No product or architecture decision remains open|0016_|pg_trgm|repeatable read" docs/v0.2.6/*.md
```

Status:

- Completed on 2026-07-19.
- Confirmed all v0.2.6 planning inputs exist:
  - `docs/v0.2.6/prd.md`;
  - `docs/v0.2.6/technical-design.md`;
  - `docs/v0.2.6/implementation-plan.md`.
- Confirmed the active branch is `v0.2.6` at `d9a677a` (`Doc cleanup`) and matches
  `origin/v0.2.6`.
- Confirmed the change boundary before runtime implementation:
  - only the untracked `docs/v0.2.6/` planning directory is present;
  - the index is clean;
  - there is no tracked runtime, migration, package, OpenAPI, README, site, test, or generated-output
    diff for v0.2.6.
- Confirmed the release baseline remains `0.2.5` in root, API, web, contracts, lockfile workspace
  metadata, and OpenAPI. Version updates remain reserved for Phase 10.
- Confirmed migration ordering:
  - `0015_silky_tyger_tiger.sql` is the latest committed migration;
  - v0.2.6 will add the next migration as `0016_*`;
  - no work-item row backfill is required because the planned database change is extension/index only.
- Confirmed local PostgreSQL extension readiness without leaving database state behind:
  - local server is PostgreSQL 14.5;
  - `pg_trgm` 1.6 is available and initially uninstalled;
  - the `worktrail` role successfully executed `CREATE EXTENSION IF NOT EXISTS pg_trgm` inside a
    transaction;
  - the transaction was rolled back and a follow-up query confirmed the extension remains uninstalled.
- Confirmed CI database readiness from `.github/workflows/ci.yml`:
  - CI uses the official `postgres:16-alpine` service image;
  - `POSTGRES_USER=worktrail` initializes the migration connection as the service database superuser;
  - the [official image documentation](https://github.com/docker-library/docs/blob/master/postgres/README.md)
    states that Alpine variants include extensions from `postgres-contrib`, which includes
    [`pg_trgm`](https://www.postgresql.org/docs/16/pgtrgm.html);
  - CI runs reset, migrate, and seed through the same `DATABASE_URL` before tests;
  - the local Docker daemon was not running, so no redundant live `postgres:16-alpine` container check
    was started during this planning-only phase. Fresh CI migration remains the final image-level proof
    when Phase 2 adds `pg_trgm`.
- Confirmed the interactive HTTP list contract has four concrete Angular consumers that must move in
  the coordinated cutover:
  - project Work;
  - workspace Work Items;
  - project board;
  - relationship candidate search on work item detail.
- Confirmed the API wrappers and both list endpoint handlers currently use array response contracts.
- Confirmed complete repository reads are also used deliberately by My Work, project summary, Planning,
  Cycle Review/Closeout, Milestone Review, Status Reports, and Portfolio. These internal derivation
  paths remain outside the mechanical endpoint cutover.
- Confirmed project batch triage already:
  - stores explicit work item IDs;
  - selects from the provided visible rows;
  - prunes selection to visible rows;
  - sends `workItemIds` in the request;
  - remains owner/maintainer-only on the server.
- Confirmed the technical design resolves all blocking choices, including offset/page semantics,
  page/query separation, exact repeatable-read counts, stale-page clamping, the explicit board endpoint,
  the `10_001` export guard, trigram indexes, and the coordinated Angular cutover.
- Confirmed no later request has changed the v0.2.6 Scalable Work Discovery scope.
- Verified planning and repository state with focused file, git, package/OpenAPI version, migration,
  endpoint-consumer, internal-read, bulk-selection, CI/database, and decision searches plus
  `git diff --check` and trailing-whitespace checks.
- No unresolved technical choice blocks Phase 1.

## Phase 1: Paging Contracts, Validation, And Error Vocabulary

Goal: define typed page input/output and strict backend validation without changing current list runtime
behavior.

Scope:

- Extend `packages/contracts/src/work-items.ts` with:
  - `workItemPageSizes`;
  - `WorkItemPageSize`;
  - `WorkItemPageQuery`;
  - `ResolvedWorkItemPageQuery`;
  - `WorkItemPageMetadataDto`;
  - `WorkItemListPageDto`;
  - `WorkspaceWorkItemListPageDto`.
- Keep `WorkItemQuery` unchanged.
- Keep saved-view query request/response contracts unchanged.
- Add focused contract tests for:
  - allowed page sizes;
  - optional input versus resolved input;
  - project and workspace page item types;
  - exact empty-result metadata;
  - page metadata fields and booleans;
  - absence of paging fields from `WorkItemQuery` and saved-view query types.
- Add `apps/api/src/validation/work-item-page-query.ts`.
- Extract a small shared first-query-value/empty-value helper only if it removes direct duplication with
  `work-item-query.ts`.
- Parse and default:
  - absent page to `1`;
  - absent page size to `25`.
- Reject:
  - zero and negative page;
  - fractional page;
  - nonnumeric page;
  - page sizes outside `10 | 25 | 50 | 100`;
  - malformed repeated values according to existing first-value behavior.
- Add focused validation tests for project/workspace filter composition and parser separation.
- Add `EXPORT_LIMIT_EXCEEDED` to backend `AppErrorCode` and define
  `ExportLimitExceededError`, but do not wire export behavior yet.
- Test error response mapping for status `422`, message, and `{ limit }` details.

Out of scope:

- Endpoint response changes.
- Repository limit/offset queries.
- Database migration.
- Export service changes.
- Angular integration.

Acceptance criteria:

- Contracts express bounded page input and concrete response envelopes.
- `WorkItemQuery` remains a durable saved-view-compatible result definition.
- Backend page parsing is strict and fully defaulted.
- Export overflow has a typed internal API error vocabulary.
- Existing runtime responses remain arrays in this phase.
- Contracts and API compile with focused tests green.

Suggested commands:

```sh
npm run build --workspace @worktrail/contracts
npm run typecheck --workspace @worktrail/contracts
npm run test --workspace @worktrail/contracts
npm run typecheck --workspace @worktrail/api
npm run test --workspace @worktrail/api -- work-item-query
npm run lint --workspace @worktrail/contracts
npm run lint --workspace @worktrail/api
git diff --check
```

Status:

- Completed on 2026-07-19.
- Added shared paging contracts in `packages/contracts/src/work-items.ts`:
  - the supported `10 | 25 | 50 | 100` page-size set;
  - optional request and resolved page-query shapes;
  - shared metadata plus concrete project and workspace page envelopes.
- Kept `WorkItemQuery` and saved-view query contracts unchanged so paging remains transient window state.
- Added `packages/contracts/src/work-item-page.contract.test.ts` covering the allowed sizes, optional and
  resolved inputs, concrete item arrays, exact empty metadata, metadata types, and compile-time absence
  of paging keys from durable queries.
- Extracted `firstQueryValue` and empty-value normalization to
  `apps/api/src/validation/query-value.ts` without broadening the validation abstraction.
- Added `apps/api/src/validation/work-item-page-query.ts` with defaults of page `1` and page size `25`,
  strict positive-integer and supported-size validation, first-value handling for repeated parameters,
  and separation from project/workspace filter parsing.
- Added `EXPORT_LIMIT_EXCEEDED` and `ExportLimitExceededError` with status `422`, the bounded-export
  message, and `{ limit }` details; export behavior remains unwired until Phase 4.
- Added focused API tests for page defaults and supported sizes, malformed values, repeated values,
  parser composition/separation, and API error response mapping.
- Preserved current list endpoint and service array responses; no runtime endpoint, repository,
  migration, export, or Angular behavior changed.
- Verification completed:
  - `npm run typecheck --workspace @worktrail/contracts`;
  - `npm run build --workspace @worktrail/contracts`;
  - `npm run test --workspace @worktrail/contracts` (9 files, 34 tests);
  - `npm run typecheck --workspace @worktrail/api`;
  - `npm run test --workspace @worktrail/api -- work-item-page-query.test.ts app-error.test.ts work-item-query.test.ts`
    (3 files, 29 tests);
  - `npm run test --workspace @worktrail/api` (31 files, 337 tests);
  - `npm run lint --workspace @worktrail/contracts`;
  - `npm run lint --workspace @worktrail/api`;
  - `git diff --check`.

## Phase 2: Search Migration And Repository Paging Primitives

Goal: add the database and repository capabilities needed for deterministic bounded pages and guarded
exports without changing service or endpoint behavior.

Scope:

- Add ascending `workItems.id` as the final tie-breaker to every project/workspace sort sequence in
  `work-item-query-builder.ts`.
- Preserve all existing semantic sort keys and null handling.
- Add repository count methods:
  - `countByProjectQuery(projectId, filters)`;
  - `countByWorkspaceQuery(workspaceId, filters)`.
- Build count and row methods from the existing canonical project/workspace condition builders.
- Confirm label, dependency, hierarchy, and parent predicates remain `exists`-based and do not require
  `count(distinct ...)`.
- Add repository page methods:
  - `listPageByProject(projectId, filters, { limit, offset })`;
  - `listPageByWorkspace(workspaceId, filters, { limit, offset })`.
- Add explicit complete board repository method:
  - `listByProjectForBoard(projectId)`.
- Keep `listByProjectAndStatusForBoard` unchanged for board move calculations.
- Add bounded export repository methods requiring a finite limit:
  - `listByProjectForExport(projectId, filters, limit)`;
  - `listByWorkspaceForExport(workspaceId, filters, limit)`.
- Keep existing complete `listByProject` and `listByWorkspace` methods for internal domain reads and
  document that they are not interactive endpoint methods.
- Add `pg_trgm` schema/index declarations where practical.
- Generate and inspect migration `0016_*` containing:
  - `CREATE EXTENSION IF NOT EXISTS pg_trgm`;
  - GIN trigram index for `display_key`;
  - GIN trigram index for `title`;
  - GIN trigram index for `description`.
- If Drizzle cannot represent operator classes cleanly:
  - use explicit migration SQL;
  - keep migration metadata consistent;
  - verify later schema generation does not remove the indexes.
- Add repository tests for:
  - first, middle, partial final, and empty windows;
  - page sizes 10, 25, 50, and 100;
  - exact project/workspace counts;
  - active/include/archived workspace scope;
  - all representative filter families;
  - deterministic UUID tie-breaking;
  - complete board results above page maximum;
  - export finite-limit behavior;
  - no duplicate counts.
- Run fresh and incremental migration verification.

Out of scope:

- Page metadata calculation.
- Read-only transaction helper.
- Endpoint changes.
- CSV limit enforcement.
- Angular code.
- Final 10,000-row query-plan benchmark.

Acceptance criteria:

- Repository page reads always apply finite limit and nonnegative offset.
- Every sort is deterministic.
- Counts and rows use identical canonical predicates.
- Workspace archive scope affects count and rows identically.
- Board repository reads remain complete and fixed-order.
- Export methods cannot be called without a finite limit.
- Fresh migration enables all trigram indexes without rewriting work-item rows.
- Repository and migration tests pass.

Suggested commands:

```sh
npm run db:generate
npm run db:reset
npm run db:migrate
npm run db:seed
npm run typecheck --workspace @worktrail/api
npm run test --workspace @worktrail/api -- work-item-repository
npm run lint --workspace @worktrail/api
npm run db:generate
git diff --check
```

Status:

- Completed on 2026-07-19.
- Appended ascending `work_items.id` to all seven project and workspace sort sequences while preserving
  every existing semantic key, project-key tie-breaker, direction, and null-order rule.
- Added repository paging primitives with runtime guards:
  - `WorkItemPageWindow` with a contract-supported `10 | 25 | 50 | 100` limit;
  - `listPageByProject` and `listPageByWorkspace` with mandatory finite limits and nonnegative integer
    offsets;
  - invalid, fractional, infinite, and unsupported windows fail before database execution.
- Added exact `countByProjectQuery` and `countByWorkspaceQuery` methods using the same canonical
  condition builders as row reads. Workspace counts retain the project join for archive scope.
- Confirmed labels, dependency relationships, hierarchy parents, and parent-key filters remain
  `exists`/scalar-subquery predicates, so exact `count(*)` does not multiply matching rows.
- Added explicit complete and bounded exceptional reads:
  - `listByProjectForBoard` uses complete fixed `board_order` results;
  - existing status-scoped board move reads remain unchanged;
  - project/workspace export methods require a positive safe-integer limit and preserve canonical
    filters and deterministic ordering.
- Kept complete `listByProject` and `listByWorkspace` methods for internal derivations and documented
  that interactive HTTP collections must use the page methods. No current caller was cut over in this
  phase.
- Added Drizzle schema declarations for GIN `gin_trgm_ops` indexes on `display_key`, `title`, and
  `description`.
- Generated `apps/api/drizzle/0016_scalable_search.sql` and its snapshot/journal metadata, then added
  `CREATE EXTENSION IF NOT EXISTS pg_trgm` before the generated indexes. No work-item row rewrite or
  backfill is present.
- Added repository coverage for first, middle, partial-final, and empty windows; all four supported
  sizes; exact project/workspace counts; active/include/only archive scopes; canonical filter families;
  duplicate-proof label/dependency/hierarchy counts; complete 113-item board reads; bounded exports;
  and malformed runtime windows.
- Added focused SQL-rendering tests proving every project/workspace sort ends in the ascending UUID
  tie-breaker.
- Migration verification completed without resetting user data:
  - incremental `npm run db:migrate --workspace @worktrail/api` applied `0016` successfully;
  - repository tests confirmed `pg_trgm` and all three public GIN indexes;
  - all 17 migrations applied successfully in order to an isolated temporary schema and produced all
    three indexes; the schema was removed afterward;
  - the local role does not have `CREATEDB`, so a temporary database was not used;
  - a subsequent `npm run db:generate --workspace @worktrail/api` reported no schema changes.
- Verification completed:
  - `npm run test --workspace @worktrail/api -- repositories.test.ts work-item-query-builder.test.ts`
    (2 files, 37 tests);
  - `npm run typecheck --workspace @worktrail/api`;
  - `npm run lint --workspace @worktrail/api`;
  - `npm run test --workspace @worktrail/api` (32 files, 356 tests);
  - `npm run build --workspace @worktrail/api`;
  - `git diff --check`.

## Phase 3: Read Transactions, Page Services, And Complete Board Service

Goal: implement coherent page and board domain reads while leaving current HTTP list contracts
unchanged.

Scope:

- Add `withRepositoriesReadTransaction` beside the existing write transaction helper.
- Configure production read transactions as:
  - `repeatable read`;
  - `read only`.
- Keep existing write transaction behavior unchanged.
- Add a focused page metadata resolver that:
  - computes exact total pages;
  - uses page 1 for empty results;
  - clamps high requested pages;
  - derives previous/next booleans;
  - calculates safe offset.
- Add `WorkItemService.listWorkItemPage`.
- Add `WorkItemService.listWorkspaceWorkItemPage`.
- Ensure project authorization occurs before count metadata is returned.
- Run authorization, count, page selection, and DTO enrichment through transaction repositories when
  `db` is available.
- Preserve repository-only fallback for focused unit tests.
- Pass only returned page rows to existing set-based DTO enrichment.
- Add `WorkItemService.listProjectBoardWorkItems` using the explicit complete board repository method.
- Ensure the board service accepts no public filters or page window.
- Keep existing complete list service methods for My Work and other internal consumers.
- Add service tests for:
  - default and explicit windows;
  - exact metadata;
  - empty results;
  - stale-page clamping;
  - partial final pages;
  - project authorization;
  - workspace and archive scope;
  - page-only enrichment IDs;
  - hierarchy, label, planning, project, and dependency context;
  - transaction and repository-only paths;
  - complete board result and order beyond 100 rows.
- Add an integration test proving count and page selection share one repeatable-read transaction where
  practical without timing-sensitive concurrency assertions.

Out of scope:

- HTTP endpoint cutover.
- Angular API client changes.
- Export behavior.
- Pagination UI.
- Changes to internal planning/health read models.

Acceptance criteria:

- Page services return exact coherent metadata and at most the requested allowed page size.
- Stale pages normalize deterministically.
- DTO enrichment is set-based and restricted to page rows.
- Project/workspace scope is enforced before totals are exposed.
- Board service remains complete and ordered.
- Internal complete read behavior remains unchanged.
- Focused service and transaction tests pass.

Suggested commands:

```sh
npm run typecheck --workspace @worktrail/api
npm run test --workspace @worktrail/api -- work-item-service
npm run test --workspace @worktrail/api -- work-items
npm run lint --workspace @worktrail/api
git diff --check
```

Status:

- Completed on 2026-07-19.
- Added `withRepositoriesReadTransaction` beside the unchanged write helper with explicit PostgreSQL
  `repeatable read` isolation and `read only` access mode.
- Added `resolveWorkItemPage` as a focused metadata/window resolver:
  - exact total-page calculation;
  - page `1` for empty results;
  - deterministic high-page clamping;
  - previous/next booleans;
  - nonnegative safe-integer offset calculation;
  - rejection of invalid repository totals.
- Added `WorkItemService.listWorkItemPage` and `listWorkspaceWorkItemPage` with default and explicit
  resolved windows, exact metadata, canonical count/page repositories, and enrichment restricted to
  the returned raw rows.
- Project page reads authorize actor workspace scope before running the count, preventing totals from
  being disclosed for missing or cross-workspace projects.
- Authorization, count, clamped page selection, and DTO enrichment share one read-only repeatable-read
  transaction whenever `db` is available. Repository-only construction remains supported for focused
  unit tests and non-production test contexts.
- Added `WorkItemService.listProjectBoardWorkItems` with project authorization, the explicit complete
  board repository method, fixed repository ordering, and existing DTO enrichment. It accepts no
  filters or page window.
- Preserved existing complete `listWorkItems` and `listWorkspaceWorkItems` behavior for current HTTP,
  export, My Work, planning, health, and other internal consumers. No endpoint contract changed.
- Added focused tests for:
  - exact, default, explicit, partial-final, stale, and empty page metadata;
  - transaction configuration and repository binding;
  - PostgreSQL enforcement of read-only transactions (`25006` on attempted writes);
  - one configured read transaction around each count/page/enrichment service read;
  - repository-only fallback and page-only label, dependency, parent, and child-summary IDs;
  - project authorization before count;
  - actor-workspace isolation and active/archived workspace project context;
  - labels, milestone, cycle, hierarchy, project, and dependency DTO context;
  - complete fixed-order board enrichment for 101 work items.
- Verification completed:
  - `npm run test --workspace @worktrail/api -- work-item-page.test.ts repository-read-transaction.test.ts work-items.test.ts`
    (3 files, 86 tests);
  - `npm run test --workspace @worktrail/api -- repositories.test.ts work-items.test.ts`
    (2 files, 104 tests);
  - `npm run typecheck --workspace @worktrail/api`;
  - `npm run lint --workspace @worktrail/api`;
  - `npm run test --workspace @worktrail/api` (34 files, 368 tests);
  - `npm run build --workspace @worktrail/api`;
  - `git diff --check`.

## Phase 4: Bounded Full-Result CSV Export

Goal: preserve all-matching filtered exports while preventing unbounded synchronous reads and partial
files.

Scope:

- Add `db?: WorktrailDb` to `WorkItemCsvExportServiceContext`.
- Pass `db` through project/workspace export endpoint construction and Express route context.
- Add `synchronousExportLimit = 10_000` in one authoritative backend module.
- Replace export calls to complete `WorkItemService` list methods with export-specific repository reads.
- Read at most `10_001` raw matching rows.
- Reject overflow before DTO enrichment or CSV stringification.
- Throw `ExportLimitExceededError` with:
  - status `422`;
  - code `EXPORT_LIMIT_EXCEEDED`;
  - actionable narrow-filters message;
  - details `{ limit: 10000 }`.
- Run authorization, raw read, cap check, and accepted-row enrichment in a read-only repeatable-read
  transaction when `db` is available.
- Stringify accepted DTOs after the read transaction commits.
- Preserve all current CSV columns and deterministic applied sort.
- Keep page and page size out of export service input.
- Ignore direct paging query parameters on export routes.
- Update project and workspace export OpenAPI responses with the new `422` behavior, without updating
  the release version yet.
- Keep current Angular inline error presentation, adding focused error-code/message assertions where
  useful.
- Add tests for:
  - all matching rows below the limit;
  - exactly 10,000 rows accepted through fakes;
  - 10,001 rows rejected before enrichment/stringification;
  - project/workspace authorization;
  - sort and columns unchanged;
  - no partial response body;
  - direct page parameters having no effect.

Out of scope:

- Background exports.
- Streaming CSV.
- Export history or storage.
- User-configurable limits.
- Interactive list endpoint changes.

Acceptance criteria:

- Export contains every applied-filter match under the limit, independent of visible page.
- Overflow returns one controlled JSON error and no CSV.
- Export reads are finite and race-safe at the boundary.
- Existing column and filename behavior remains intact.
- Focused API, service, and web error tests pass.

Suggested commands:

```sh
npm run typecheck --workspace @worktrail/api
npm run test --workspace @worktrail/api -- work-item-csv-export
npm run test --workspace @worktrail/api -- work-items
npm run typecheck --workspace @worktrail/web
npm run test --workspace @worktrail/web -- --include='**/work-item-list-page.component.spec.ts' --include='**/workspace-work-item-list-page.component.spec.ts'
npm run lint --workspace @worktrail/api
git diff --check
```

Status:

- Completed on 2026-07-19.
- Added one authoritative `synchronousExportLimit` of 10,000 rows and changed project/workspace CSV
  exports to use the export-specific repository reads with a maximum `10_001`-row probe.
- Export overflow is rejected with `422 EXPORT_LIMIT_EXCEEDED`, `{ limit: 10000 }`, and an actionable
  narrow-filters message before DTO enrichment or CSV stringification begins.
- Passed the database context through the transport-neutral export handlers and Express adapter so
  authorization, bounded reads, the cap check, and accepted-row enrichment share a read-only
  repeatable-read transaction. CSV serialization remains outside the transaction.
- Preserved existing CSV columns, filenames, filters, and deterministic sort behavior. Direct `page`
  and `pageSize` parameters remain outside export input and do not affect the full matching result.
- Added focused service and Express coverage for the exact 10,000-row boundary, 10,001-row project and
  workspace overflow, authorization-before-read, actor workspace scope, bounded repository arguments,
  and the absence of partial CSV headers or content on failure.
- Added structured JSON Blob error decoding to the Angular project and workspace export paths so the
  existing inline error regions display the server's export-limit guidance while retaining the generic
  fallback for malformed or non-JSON failures.
- Documented both export endpoints' 10,000-row boundary, paging independence, and `422` response in
  OpenAPI without changing release metadata.
- Verified Phase 4 with:
  - focused API tests: 86 passed;
  - focused Angular export tests: 69 passed;
  - full API tests: 373 passed;
  - full Angular tests: 326 passed;
  - full contract tests: 34 passed;
  - repository-wide typecheck, lint, production build, and diff checks.

## Phase 5: Frontend Paging Serialization And Shared Presentation Primitives

Goal: build and test reusable frontend paging state and presentation primitives before changing the
live list API contract.

Scope:

- Add `work-item-page-query-serialization.ts` with:
  - default resolved page state;
  - tolerant browser query parsing;
  - supported page-size normalization;
  - default omission from router params;
  - durable-query/page-param merging.
- Keep current `work-item-query-serialization.ts` durable-only helpers intact until coordinated
  integration.
- Add pure tests for:
  - default omission;
  - non-default page and page size;
  - invalid page normalization;
  - invalid page-size normalization;
  - filter-param composition without mutation;
  - page 1 with non-default size;
  - page change preserving size;
  - size change resetting page.
- Add `WorkItemPaginationComponent` as a presentational component with:
  - required page metadata input;
  - disabled input;
  - page-change output;
  - page-size-change output.
- Implement bounded numeric page tokens:
  - first page;
  - last page;
  - current page;
  - one neighbor on either side;
  - ellipses for gaps.
- Implement Previous/Next text controls and a native page-size select.
- Hide false page text for zero results.
- Provide a compact mobile mode retaining Previous, current-page text, Next, and page size.
- Add stable styles without placing the pager in a card.
- Add accessibility semantics:
  - navigation label;
  - native disabled state;
  - `aria-current="page"`;
  - visible page-size label;
  - stable keyboard order.
- Add component tests for start/middle/end token windows, events, disabled states, empty results,
  accessible names, and mobile rendering contract.
- Do not import or render the new component from live list routes yet.

Out of scope:

- Endpoint/client response changes.
- `WorkListQueryStore` integration.
- Result heading changes.
- Page loading.
- Bulk selection behavior.

Acceptance criteria:

- Paging URL helpers are pure and keep transient state separate from durable queries.
- Shared pager behavior is bounded, accessible, responsive, and fully unit tested.
- No live route behavior changes before API cutover.
- Web lint, typecheck, and focused tests pass.

Suggested commands:

```sh
npm run typecheck --workspace @worktrail/web
npm run test --workspace @worktrail/web -- --include='**/work-item-page-query-serialization.spec.ts' --include='**/work-item-pagination.component.spec.ts'
npm run lint --workspace @worktrail/web
npm run build --workspace @worktrail/web
git diff --check
```

Status:

- Completed on 2026-07-19.
- Added pure work-item page query serialization with:
  - default page `1` and page size `25`;
  - tolerant normalization of invalid browser values;
  - canonical omission of default paging values;
  - immutable composition with durable filter params;
  - page transitions that preserve size;
  - size transitions that reset to page 1.
- Kept the existing durable-only work-item query helpers unchanged so saved views, filter summaries,
  and exports cannot acquire transient page state before the coordinated integration phase.
- Added the presentational `WorkItemPaginationComponent` with:
  - first, last, current, and neighboring numeric page buttons plus bounded gap tokens;
  - Previous and Next text controls;
  - a native `Items per page` selector for `10`, `25`, `50`, and `100`;
  - native loading and boundary disabled states;
  - labeled navigation and numeric control groups, `aria-current`, and a polite page-status region;
  - responsive layouts that retain direction controls, current page, status, and page size while
    removing optional numeric neighbors on narrow screens.
- Added focused serialization tests for defaults, non-defaults, invalid values, immutable filter
  composition, and page/size transitions.
- Added component tests for start, middle, and end token windows, ellipses, direct and directional
  events, page-size events, disabled states, empty results, control order, accessible names, and the
  compact mobile rendering contract.
- Confirmed the component is not imported or rendered by a live route; Phase 6 retains the atomic API
  and Angular consumer cutover boundary.
- Verified Phase 5 with:
  - focused Angular tests: 16 passed;
  - full Angular tests: 342 passed;
  - web typecheck, lint, production build, diff, and trailing-whitespace checks.

## Phase 6: Coordinated List Endpoint And Angular Consumer Cutover

Goal: atomically switch interactive list endpoints to page envelopes and update every Angular consumer
so the application remains complete and usable.

Scope:

### Backend endpoints

- Change `listWorkItemsHandler` to:
  - parse durable project filters;
  - parse page state;
  - call `listWorkItemPage`;
  - return `WorkItemListPageDto`.
- Change `listWorkspaceWorkItemsHandler` similarly for `WorkspaceWorkItemListPageDto`.
- Add `listProjectBoardWorkItemsHandler`.
- Register `GET /api/projects/:projectId/board/work-items`.
- Preserve route ordering around static export/import/bulk routes.
- Update endpoint tests for default/explicit page responses, malformed input, stale normalization,
  authorization, and empty metadata.

### OpenAPI

- Add reusable page and page-size parameters.
- Add page metadata and concrete project/workspace page schemas.
- Replace array success responses on interactive list endpoints.
- Add the complete board endpoint and limitation description.
- Document current-data rather than cross-request snapshot semantics.
- Keep OpenAPI info version at the current release baseline until Phase 10.

### Angular API client

- Change project/workspace list methods to accept resolved page state and return page DTOs.
- Add page-aware HTTP param composition without altering durable-only export params.
- Add `listProjectBoardWorkItems`.
- Update `WorktrailApiService` delegation.

### Query store and URL lifecycle

- Extend `WorkListQueryStore` with active resolved page state.
- Parse filter and page state from each route update.
- Make filter Apply, Clear/Reset, chip removal, and saved-view open return default paging.
- Add page/page-size router param builders.
- Include active paging in copy and detail return URLs.
- Keep meaningful field count and saved-view query data durable-only.
- Add invalid browser paging canonicalization and stale-page replacement behavior.

### Consumer cutover

- Update project Work to:
  - request active page state;
  - consume `response.items` and metadata;
  - render the shared pager;
  - expose page/size navigation;
  - use total/range heading.
- Update workspace Work Items with the same base behavior.
- Update board to call only the dedicated complete board endpoint.
- Update relationship candidate search to request page 1/size 25 and consume `.items`.
- Show a refine-search hint when more relationship candidates exist.
- Update `WorkItemResultListComponent` to render range/total from metadata rather than local array length.
- Cancel previous in-flight list loads before new route requests.
- On server-normalized stale page:
  - replace the route URL;
  - avoid rendering rows under stale URL state;
  - let canonical route loading complete.
- Keep list error/retry behavior tied to current route state.

Out of scope:

- Project-specific bulk polish beyond keeping it functional.
- Workspace-specific responsive polish beyond coherent base behavior.
- Browser E2E expansion.
- Query-plan benchmarking.
- Documentation finalization.

Acceptance criteria:

- Both interactive endpoints return typed page envelopes.
- Every Angular consumer compiles against the new contract.
- Project and workspace users can reach every page.
- Board still receives all project cards and drag/drop remains functional.
- Relationship search remains bounded and honest about additional matches.
- Saved views and exports contain no page fields.
- Copy and detail return URLs preserve current paging.
- No temporary array/envelope union or unbounded page-size escape hatch remains.
- API, contracts, and web focused suites pass together.

Suggested commands:

```sh
npm run typecheck
npm run test --workspace @worktrail/contracts
npm run test --workspace @worktrail/api -- work-items
npm run test --workspace @worktrail/web -- --include='**/work-list-query.store.spec.ts' --include='**/work-item-list-page.component.spec.ts' --include='**/workspace-work-item-list-page.component.spec.ts' --include='**/work-item-board-page.component.spec.ts' --include='**/work-item-detail-page.component.spec.ts'
npm run lint
npm run build
git diff --check
```

Status:

- Not started.

## Phase 7: Project Work Pagination And Batch-Triage Hardening

Goal: complete the project Work experience, including focus, route history, selection, and post-mutation
edge cases.

Scope:

- Refine project result summary wording:
  - `0 work items`;
  - `1 work item`;
  - `1-25 of 63 work items`;
  - partial final range.
- Keep one result summary above the list and one pager below.
- Keep page-size control available when total count exceeds 10.
- Disable pager while page load or bulk mutation is active.
- Add programmatic result-heading focus after user-initiated page/page-size navigation.
- Do not steal focus on initial load.
- Ensure browser Back/Forward restores rows, range, page controls, filter state, and selection-free bulk
  state.
- Confirm Apply, Clear, chip removal, saved/pinned view open, project change, and actor change reset to
  page 1/size 25.
- Confirm sort changes reset page only after Apply.
- Ensure pending draft filters remain untouched by page navigation.
- Preserve active non-default page state through:
  - Copy link;
  - work item detail links;
  - parent/child links rendered in rows;
  - return navigation.
- Keep select-all label `Select all visible work items`.
- Clarify selected count as `selected on this page` where needed.
- Clear selection and bulk action draft/feedback on page, page-size, filter, sort, saved-view, project,
  and actor boundaries.
- After bulk apply:
  - reload current count and rows;
  - clear successful/unchanged selection;
  - retain failed IDs only if still visible;
  - normalize to the final valid page if result count shrinks.
- Prevent paging during an in-flight bulk command.
- Add project route tests for:
  - first/middle/final pages;
  - page-size changes;
  - draft filter independence;
  - saved-view resets;
  - copy/reload/back/return semantics;
  - selection boundaries;
  - partial failures;
  - stale-page recovery;
  - loading/error/retry/focus behavior.
- Inspect project Work at desktop, narrow desktop, mobile, and 200 percent zoom.

Out of scope:

- Query-wide selection.
- Cross-project bulk edit.
- Background mutations.
- Workspace route behavior except shared primitives.
- E2E finalization.

Acceptance criteria:

- Project Work paging is predictable through all query and history transitions.
- Bulk actions can affect only explicit visible-page IDs.
- No hidden prior-page selection survives.
- Post-mutation counts and page bounds recover correctly.
- Focus and live status behavior are useful without becoming noisy.
- Project route focused tests and responsive inspection pass.

Suggested commands:

```sh
npm run typecheck --workspace @worktrail/web
npm run test --workspace @worktrail/web -- --include='**/work-item-list-page.component.spec.ts' --include='**/project-bulk-triage.store.spec.ts' --include='**/work-item-result-list.component.spec.ts' --include='**/work-item-pagination.component.spec.ts'
npm run lint --workspace @worktrail/web
npm run build --workspace @worktrail/web
git diff --check
```

Status:

- Not started.

## Phase 8: Workspace Work Items And Cross-Surface Compatibility

Goal: complete workspace paging parity and verify that the list contract change does not regress board,
relationship, saved-view, export, or focused operating surfaces.

Scope:

### Workspace Work Items

- Match project Work result summary, pager placement, page sizes, and stale-page behavior.
- Preserve workspace-specific query composition:
  - project;
  - active/include/archived project mode;
  - work state;
  - unassigned state;
  - blocked state;
  - hierarchy and exact parent;
  - dependency and planning filters.
- Confirm project identity remains visible on every workspace row/card.
- Preserve non-default paging through copy, detail, parent/child, and return URLs.
- Reset paging through saved/pinned view, filter, sort, project, archive mode, and actor changes.
- Add workspace route tests for first/middle/final/empty/stale pages and all archive modes.

### Relationship candidate search

- Consume the first 25 paged workspace matches.
- Continue excluding the current work item and preserving linked-item disabled state.
- Show a concise refine-search message when `hasNextPage` is true.
- Preserve current search action, loading, empty, error, keyboard, and relationship-write validation.
- Add tests for bounded results and additional-match messaging.

### Board

- Confirm board loading uses only the dedicated complete endpoint.
- Verify more than 100 service-level cards remain present.
- Preserve six columns, counts, empty states, hierarchy context, status menus, and CDK drag/drop.
- Preserve same-column and cross-column neighbor IDs and server validation.
- Confirm list page-size state has no effect on board calls.

### Saved views, exports, and focused reads

- Confirm saved-view create/update payloads never contain page fields.
- Confirm workspace/project CSV requests never contain page fields.
- Confirm My Work, Planning, Cycle Review, Milestone Review, Portfolio, reports, closeout, parent
  candidates, and child-work endpoints retain existing DTOs and behavior.
- Add a focused search that fails if new paging types leak into immutable snapshot contracts.
- Record remaining complete internal-read and board scalability limits for Phase 10 documentation.

Out of scope:

- Pagination of board or focused surfaces.
- Aggregate read-model refactors.
- Global quick search.
- Saved-view page-size preferences.

Acceptance criteria:

- Workspace paging matches project behavior while preserving workspace-only filters.
- Relationship search is bounded and understandable.
- Board data remains complete and draggable.
- Saved views, exports, and immutable snapshots remain paging-free.
- Existing focused operating surfaces have no pagination-related regression.
- Focused API/web regression tests pass.

Suggested commands:

```sh
npm run typecheck
npm run test --workspace @worktrail/api -- work-items
npm run test --workspace @worktrail/api -- planning milestone-review cycles project-status-reports project-cycle-closeout
npm run test --workspace @worktrail/web -- --include='**/workspace-work-item-list-page.component.spec.ts' --include='**/work-item-detail-page.component.spec.ts' --include='**/work-item-board-page.component.spec.ts' --include='**/saved-views.store.spec.ts'
npm run lint
npm run build
git diff --check
```

Status:

- Not started.

## Phase 9: Performance Evidence, Seeded Browser Coverage, And Responsive/Accessibility Verification

Goal: prove bounded data access and complete the user-level pagination workflow without bloating default
seed data.

Scope:

### PostgreSQL evidence

- Generate temporary representative local data with at least:
  - 10,000 work items in one workspace;
  - multiple active and archived projects;
  - representative labels, dependencies, hierarchy, assignees, cycles, milestones, and dates.
- Do not commit the large fixture to default seed.
- Capture `EXPLAIN (ANALYZE, BUFFERS)` before/after or with indexes for:
  - common project updated sort page;
  - workspace updated sort page;
  - title/description/display-key substring search;
  - broad exact count;
  - label, dependency, hierarchy, and archived-project examples;
  - a deeper offset page.
- Confirm page-row plans contain finite `Limit`.
- Confirm useful search terms can use trigram bitmap index paths.
- Record representative plan shape and timing in this phase status.
- Remove temporary performance data and restore deterministic seed.

### Seed

- Preserve credible existing seed records rather than adding filler.
- Add seed assertions that the main project and active workspace each exceed 10 items.
- Confirm page size 10 demonstrates project and workspace paging after fresh seed.
- Keep seeded work breakdown, cycle, dependency, report, portfolio, and closeout scenarios intact.

### Browser coverage

- Add or extend Playwright workflow to cover:
  - project page size 10;
  - exact first and final ranges;
  - next/previous/direct numeric navigation;
  - URL reload and Back/Forward;
  - filter Apply reset;
  - saved/pinned view reset;
  - copy link paging state;
  - work item detail return to page;
  - visible-page bulk selection clearing;
  - export from page 2 containing all filtered rows;
  - workspace page size 10 and project identity;
  - relationship candidate additional-match hint where deterministic;
  - complete board load and one drag/drop move.
- Keep export-limit overflow in service/endpoint tests, not E2E.

### Responsive and accessibility verification

- Verify project and workspace work lists at:
  - wide desktop;
  - common desktop/laptop widths;
  - mobile portrait;
  - 200 percent zoom.
- Verify:
  - no horizontal page overflow from pager;
  - mobile numeric-token reduction;
  - stable Previous/Next/page-size controls;
  - result range wrapping;
  - long title/project metadata behavior;
  - keyboard navigation and focus movement;
  - `aria-current`, disabled state, navigation label, and page-size label;
  - concise live result updates;
  - bulk visible-page language;
  - loading, empty, stale, error, and retry states.
- Use Playwright screenshots and DOM assertions; retain artifacts only where the repository convention
  requires them.

Out of scope:

- Production load testing.
- Hard hardware-specific latency SLOs.
- Committed 10,000-row demo data.
- Cursor implementation.
- Final release metadata.

Acceptance criteria:

- Interactive page reads are demonstrably bounded.
- Trigram indexes support representative current search semantics.
- Fresh seed can demonstrate paging at page size 10.
- Browser workflow covers project/workspace paging and compatibility paths.
- Existing browser scenarios remain green.
- Desktop/mobile/zoom layouts have no overlap or clipping.
- Keyboard and screen-reader semantics are verified.

Suggested commands:

```sh
npm run db:reset
npm run db:migrate
npm run db:seed
npm run test --workspace @worktrail/api -- work-item-repository work-items
npm run test:e2e
npm run build --workspace @worktrail/web
git diff --check
```

Status:

- Not started.

## Phase 10: Documentation, Metadata, And Final Verification

Goal: complete v0.2.6 with accurate product/operator documentation, release artifacts, metadata, and a
green verification baseline.

Scope:

- Update README:
  - current baseline and repository layout;
  - Scalable Work Discovery capability section;
  - project/workspace page sizes and URL behavior;
  - saved-view versus page-state semantics;
  - page-scoped bulk selection;
  - all-matching export behavior and 10,000-row limit;
  - complete-board and internal-read residual limitations;
  - `pg_trgm` migration requirement;
  - seeded page-size-10 walkthrough.
- Add `docs/v0.2.6/release-notes.md`.
- Add destination-neutral `docs/v0.2.6/pattern-notes.md` covering evidence such as:
  - durable query definition versus transient page window;
  - server-owned exact page metadata;
  - repeatable-read count/page consistency;
  - deterministic ordering;
  - bounded enrichment;
  - explicit complete-read exceptions;
  - page-scoped explicit-ID selection;
  - `limit + 1` synchronous export guards;
  - deliberate non-abstraction.
- Mark PRD and technical design implemented only after runtime work is complete.
- Update OpenAPI version to `0.2.6` and recheck every new/changed route and schema.
- Update static product site with accurate scalable discovery capability and limitations.
- Keep or update site imagery only when it improves current product representation.
- Update package versions to `0.2.6`:
  - root;
  - API;
  - web;
  - contracts;
  - local workspace dependency metadata;
  - lockfile workspace metadata.
- Review all Phase 0-10 status records for accuracy.
- Check for stale v0.2.5 baseline claims, unpaginated-list claims, unsupported scale claims, and
  discontinued pattern-destination references.
- Document residual risks honestly:
  - offset drift across separate page requests;
  - exact count cost;
  - complete board reads;
  - complete internal aggregate reads;
  - synchronous in-memory exports under the cap;
  - local-header actor identity;
  - no hosted infrastructure or observability.
- Run lockfile verification.
- Run fresh database setup and full verification.
- Review production dependency audit and build budgets.
- Confirm no Worktrail dev/test server remains after verification.

Out of scope:

- Creating a tag, GitHub release, or deployment unless separately requested.
- Production authentication or AWS infrastructure.
- v0.2.7 planning.

Acceptance criteria:

- README, OpenAPI, release notes, pattern notes, metadata, and public site match implemented behavior.
- All Phase 0-10 statuses are accurate.
- Fresh migration/seed and full tests pass.
- No stale baseline, unbounded interactive-list claim, or unsupported scale claim remains.
- Production dependency audit passes or unavoidable findings are documented concretely.
- Production build has no unexplained budget warning.
- No Worktrail application/test server process remains.

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
- Implement only the current phase unless compilation requires a tightly coupled compatibility change.
- Run the phase's focused verification.
- Update the phase `Status` with:
  - completion date;
  - concrete files and behaviors delivered;
  - exact verification performed;
  - any intentional deviation from the draft plan.
- Keep later phases marked `Not started` until their work is actually complete.
- Do not defer failures in count/filter agreement, deterministic ordering, page bounds, tenant scope,
  saved-view separation, export completeness, board completeness, or explicit-ID selection to finalization.
- If implementation evidence requires a contract change, update the technical design before silently
  diverging.
- Never commit large temporary performance fixtures or generated test artifacts.

## Release Completion Criteria

v0.2.6 is complete when:

- project Work and workspace Work Items fetch no more than the validated requested page size;
- users can see exact totals and navigate first, middle, final, and empty results;
- every sort has deterministic final ordering;
- count and page rows share canonical filter and authorization semantics;
- one response's count, normalized page, rows, and enrichment use one repeatable-read snapshot;
- filters, sorting, reload, Back/Forward, copy links, and detail return URLs preserve correct page
  behavior;
- saved and pinned views reopen on default first-page state and store no paging fields;
- page navigation leaves unapplied draft filters unchanged;
- project batch selection never includes hidden-page IDs;
- post-mutation stale pages recover to the final valid page;
- CSV export includes all filtered rows under 10,000 independent of current page;
- oversized exports fail without a partial file and explain how to recover;
- relationship search is bounded and signals additional matches;
- the project board remains complete and draggable through its explicit endpoint;
- My Work, planning, review, portfolio, report, closeout, hierarchy, dependency, and snapshot behavior
  remains correct;
- PostgreSQL trigram migration and representative query plans are verified;
- fresh seed demonstrates project and workspace paging at page size 10;
- desktop, mobile, zoom, keyboard, and accessible-state checks pass;
- README, OpenAPI, release notes, pattern notes, package metadata, and public site are current;
- full verification is green.
