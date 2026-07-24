# Worktrail v0.2.8 Implementation Plan

## Purpose

This plan turns the v0.2.8 PRD and technical design into sequential implementation phases.

v0.2.8 should add Quick Find as a bounded, keyboard-accessible workspace navigation and search surface.
An active workspace member will be able to open one lazy shell dialog, use fixed navigation without a
query, search six approved record types, understand grouped and lifecycle-aware results, and navigate to
the canonical destination without losing tenant isolation or creating unbounded reads.

The release should preserve:

- current project, work-item, board, bulk-triage, hierarchy, dependency, and archive behavior;
- canonical work-list query state, paging, saved views, copied links, and CSV export;
- comments, mentions, watchers, notifications, activity, and attachment workflows;
- milestone, cycle, Planning, Review, Portfolio, report, and closeout behavior;
- immutable report and cycle closeout snapshots;
- current role, active-member, and archived-project read/mutation semantics;
- transport-neutral endpoint handlers and the eventual API Gateway/Lambda path;
- Angular lazy-route and production bundle boundaries;
- deterministic PostgreSQL setup, seeds, local attachment storage, and production preview;
- full local and CI verification.

Quick Find must remain a focused read model. It must not become a generic command framework, a global
paged-results feature, a hosted-search integration, or an excuse to duplicate existing work-list
contracts.

## Design Decisions

Use these decisions while implementing v0.2.8:

- Present Quick Find as an Angular CDK modal dialog owned visually by Worktrail.
- Expose a visible shell icon button and `Command/Ctrl+K`; do not add a slash shortcut.
- Dynamically import the launcher and dialog so search UI remains outside the initial application chunk.
- Use tree-shaken Lucide Search and X icons rather than custom SVGs or Angular Material.
- Show fixed global and current-project navigation while the normalized query is shorter than two code
  points.
- Send one strict `POST /api/quick-find` JSON request after a 220 ms debounce.
- Normalize Unicode, trim/collapse whitespace, and accept 2-120 Unicode code points.
- Treat `%`, `_`, and `\` literally in parameterized `ILIKE` predicates.
- Search work items, projects, milestones, cycles, published reports, and attachment filenames for every
  valid query.
- Search only the fields approved in the PRD and technical design.
- Return all six concrete groups with at most five items each and `hasMore`, without exact totals.
- Execute six bounded repository queries sequentially under one coherent all-or-error response.
- Rank exact key, key prefix, exact primary field, primary prefix, primary substring, and supported
  narrative substring in that order.
- Prefer active lifecycle only as a tie-breaker inside the same relevance tier.
- Include archived and completed readable records by default and label their context.
- Project plain-text excerpts in PostgreSQL without loading entire narratives into Node.
- Keep attachment results separate and route them to the owning work item's `#files` section.
- Reuse canonical workspace Work Items query serialization for work-item overflow.
- Use one dedicated cross-domain Quick Find repository rather than extending six write repositories.
- Add only the trigram and tenant indexes exercised by the approved predicates and evidence queries.
- Keep query text out of URLs, ordinary request logs, public errors, and operational error details.
- Do not add fuzzy, semantic, tokenized, content, comment, activity, member, or label search.

## Phase Sizing

Each phase should leave the repository in a coherent, compiling state.

Implementation phases:

0. baseline planning;
1. Quick Find contracts, query validation, and safe error vocabulary;
2. search indexes, migration, and SQL ranking primitives;
3. cross-domain repository, deterministic ranking, and performance evidence;
4. service, endpoint, Express route, request-log privacy, and OpenAPI;
5. Angular API, destination mapping, and overflow serialization;
6. lazy dialog launcher, root-shell trigger, shortcut, and navigation mode;
7. reactive search state, grouped result rendering, and lifecycle context;
8. keyboard interaction, accessibility, and canonical result navigation;
9. Files fragment targeting and route-reuse integration;
10. seed, browser, responsive, operational, and regression verification;
11. documentation, public site, metadata, and final verification.

Run focused contract and validation checks after Phase 1, fresh migration checks after Phase 2,
repository integration and evidence checks after Phase 3, API/OpenAPI checks after Phase 4, Angular
client checks after Phase 5, shell/dialog tests after Phases 6-8, work-item route tests after Phase 9,
browser and bundle checks after Phase 10, and full verification during Phase 11.

## Phase 0: Baseline Planning

Goal: confirm v0.2.8 planning inputs, repository state, migration order, dependency assumptions, and
implementation boundaries before runtime changes.

Scope:

- Confirm `prd.md`, `technical-design.md`, and `implementation-plan.md` exist under `docs/v0.2.8`.
- Confirm active branch, commit baseline, worktree state, index state, and any user-authored changes.
- Confirm no runtime files have been changed for v0.2.8.
- Confirm current package and OpenAPI baseline is `0.2.7`.
- Confirm `0017_safe_pandemic.sql` is latest and `0018_*` is next.
- Confirm `pg_trgm` is already installed by migration and available in local/CI PostgreSQL.
- Confirm the six source tables, current workspace indexes, and existing work-item trigram indexes.
- Confirm root-shell topbar, actor selection, router configuration, and lazy-route behavior.
- Confirm CDK is already installed and `lucide-angular` is the only planned dependency addition.
- Confirm current request logging uses `originalUrl` and requires the privacy correction.
- Confirm attachment detail loading and same-component work-item route reuse behavior.
- Confirm existing seed rows cover ordinary result and lifecycle cases.
- Confirm no product or technical decision remains open and no later request changes scope.

Out of scope:

- Runtime implementation, dependency installation, schema edits, migrations, or runtime tests.

Acceptance criteria:

- All planning documents exist and repository state is understood.
- No unresolved decision blocks Phase 1.
- Migration, dependency, backend, and Angular sequencing preserve a compiling repository.
- Scope remains bounded to Quick Find and its direct navigation, privacy, evidence, and documentation
  requirements.

Suggested commands:

```sh
find docs/v0.2.8 -maxdepth 1 -type f | sort
git status --short --branch
git diff --cached --name-only
git log -1 --oneline --decorate
git diff --check
ls apps/api/drizzle | sort | tail
rg -n '"version": "0.2.7"|version: 0.2.7' package.json package-lock.json apps packages docs/api/openapi.yaml
rg -n "pg_trgm|gin_trgm_ops|originalUrl|@angular/cdk|lucide" apps packages package*.json
rg -n "No product or technical decision blocks|0018_|POST /api/quick-find" docs/v0.2.8/*.md
```

Status:

- Completed on July 22, 2026.
- Confirmed all v0.2.8 planning inputs exist:
  - `docs/v0.2.8/prd.md`;
  - `docs/v0.2.8/technical-design.md`;
  - `docs/v0.2.8/implementation-plan.md`.
- Confirmed the active branch is `v0.2.8` at `aeafa7e`, the v0.2.7 merge baseline tagged `v0.2.7`
  and matching `main`/`origin/main`.
- Confirmed the pre-implementation change boundary:
  - the three v0.2.8 planning documents are the only untracked files;
  - the index is empty;
  - no tracked runtime, migration, dependency, OpenAPI, README, site, test, or generated file has an
    unstaged change.
- Confirmed the release baseline is `0.2.7` in the root, API, web, contracts, package-lock workspace
  metadata, API contracts dependency, OpenAPI document, and OpenAPI test. Version changes remain
  reserved for Phase 11.
- Confirmed migration ordering and PostgreSQL support:
  - `0017_safe_pandemic.sql` is the latest migration and journal entry;
  - `0018_*` is available for the additive Quick Find indexes;
  - `0016_scalable_search.sql` already installs `pg_trgm`;
  - local Docker and CI both use PostgreSQL 16, and CI applies all committed migrations as the
    `worktrail` application role.
- Confirmed current search/index coverage:
  - work-item display key, title, and description already have GIN `gin_trgm_ops` indexes;
  - projects have workspace/status and workspace/key indexes but no name/description trigram indexes;
  - milestones have project-scoped status/date/archive indexes but no direct workspace or text-search
    index;
  - cycles, reports, and attachments have workspace-supporting indexes but no approved-field trigram
    indexes;
  - the Phase 2 index list therefore adds no known duplicate and includes no deferred search field.
- Confirmed the existing rollback-only performance evidence tool already provides the expected
  `EXPLAIN (ANALYZE, BUFFERS)` plan traversal, finite `Limit` assertion, honest normal-plan reporting,
  and separately labeled forced index-eligibility pattern for the Phase 3 Quick Find evidence tool.
- Confirmed backend composition seams:
  - `createRepositories` is the single repository factory and transaction entry point;
  - Express registers focused route modules against repository-backed context;
  - Quick Find can register after workspace routes without requiring direct DB or attachment object
    storage options;
  - transport-neutral endpoint handlers already receive resolved path/body/header context through
    `adaptEndpoint`.
- Confirmed `requestLogger` currently records `request.originalUrl`, so GET query values can appear in
  normal request logs. The Phase 4 change to `request.path` is required in addition to Quick Find's POST
  body transport.
- Confirmed frontend shell/routing seams:
  - every feature route uses `loadComponent`;
  - project route parameters inherit through `paramsInheritanceStrategy: 'always'`;
  - the root shell currently owns member loading/selection but has no Router, dialog, shortcut, or
    current-project state;
  - the three-column topbar and existing tablet/mobile rules establish the exact Phase 6 tools-wrapper
    integration point;
  - `CurrentUserService.selectedMemberId` is a signal and actor headers are derived centrally.
- Confirmed dependency assumptions:
  - `@angular/cdk@20.2.14` is already installed and exports `@angular/cdk/dialog`;
  - `lucide-angular` is not installed;
  - current `lucide-angular@1.0.0` declares Angular 13-21 peer compatibility, so it is the sole planned
    dependency addition in Phase 6.
- Confirmed canonical overflow support already exists through
  `workspaceRouterQueryParamsFromQuery`; it can serialize `{ search, archivedProjects: 'include' }`
  without hand-building URL strings.
- Confirmed work-item detail and Files integration assumptions:
  - detail observes distinct `:workItemId` changes, resets navigation state, reloads in place, and
    rejects late detail/activity responses;
  - the attachment child independently reacts to `workItemId`, cancels old work, and generation-checks
    list/mutation callbacks;
  - neither parent nor attachment section currently observes a fragment or exposes `id="files"`, so
    Phase 9 is an additive one-shot targeting change rather than a route-reuse repair.
- Confirmed deterministic seed coverage already includes:
  - active `WT`, `CLOUD`, and `OPS` projects plus archived `LEGACY`;
  - a `Cloud Readiness` project and same-named milestone;
  - varied active, completed, canceled, and archived work/planning records;
  - two published status reports;
  - `attachment-requirements.md` and `verification-evidence.json` on `WT-3`.
    Normal seed expansion is unnecessary unless a later focused test identifies one missing ranking or
    truncation case.
- Confirmed the PRD's proposed choices are fully resolved by the technical design, whose Open Questions
  section states that no product or technical decision blocks implementation planning.
- Verified planning state with focused git/index, release-version, migration/journal, schema/index,
  package-peer, shell/router, actor, request-logging, endpoint composition, query-serialization,
  attachment route-reuse, seed, CI/PostgreSQL, and performance-tool inspections plus Markdown formatting
  and diff hygiene.
- No runtime implementation, dependency installation, database mutation, generated artifact, or scope
  expansion was introduced. No unresolved choice blocks Phase 1.

## Phase 1: Quick Find Contracts, Query Validation, And Safe Error Vocabulary

Goal: establish the complete shared response vocabulary and authoritative query boundary before
persistence or UI implementation.

Scope:

- Add `packages/contracts/src/quick-find.ts`.
- Define the strict request, normalized response query, match field/mode, project/work-item context,
  six concrete result types, generic group shape, and concrete aggregate response.
- Keep SQL rank values, navigation URLs, full domain DTOs, report snapshots, attachment storage fields,
  checksums, and bytes out of public contracts.
- Export Quick Find contracts through the package barrel.
- Add compile-time and runtime-shape contract tests, including all match-field enum values.
- Add `apps/api/src/validation/quick-find-query.ts`.
- Normalize NFC, trim, collapse Unicode whitespace, and enforce the 2-120 code-point boundary.
- Require a strict JSON object containing only `query`.
- Preserve normalized casing for the response while deriving internal comparison terms separately.
- Add one LIKE-literal escaping helper with tests for `%`, `_`, and `\`.
- Add `QuickFindUnavailableError` with safe `503 QUICK_FIND_UNAVAILABLE` mapping.
- Verify no error detail or contract member accepts query text or raw persistence errors.

Out of scope:

- Schema, repository queries, endpoints, OpenAPI, Angular, and dependency installation.

Acceptance criteria:

- Shared contracts represent every approved group and no deferred search type.
- Every response group is required and bounded semantics are documented in types/tests.
- Query validation is deterministic for Unicode, whitespace, boundary, extra-field, and malformed
  inputs.
- LIKE metacharacters remain literal and no helper uses SQL interpolation.
- The unavailable error maps to a stable safe response.
- Contracts and API compile with focused tests green.

Suggested commands:

```sh
npm run typecheck --workspace @worktrail/contracts
npm run test --workspace @worktrail/contracts
npm run typecheck --workspace @worktrail/api
npm run test --workspace @worktrail/api -- quick-find validation app-error
npm run lint --workspace @worktrail/contracts
npm run lint --workspace @worktrail/api
git diff --check
```

Status:

- Completed on July 22, 2026.
- Added `packages/contracts/src/quick-find.ts` with:
  - strict request and normalized response query vocabulary;
  - finite match mode and approved searchable-field unions;
  - compact project and work-item navigation contexts;
  - concrete project, work-item, milestone, cycle, report, and attachment results;
  - one exhaustive result union;
  - generic group envelopes and a response requiring all six groups.
- Kept workspace ownership, full domain records, descriptions outside bounded excerpts, SQL ranks,
  navigation URLs, report snapshots, attachment media/storage/checksum/byte content, and persistence
  details out of the shared response contract.
- Exported Quick Find through the contracts barrel and added four contract tests proving:
  - all 12 approved match fields and three match modes;
  - compact context/storage isolation;
  - exhaustive six-kind result compatibility;
  - required six-group response envelopes and `hasMore` semantics.
- Added authoritative API query validation in `validation/quick-find-query.ts`:
  - strict object input with only `query`;
  - NFC normalization;
  - leading/trailing trim and Unicode whitespace collapse;
  - 2-120 Unicode code-point bounds rather than UTF-16 code-unit bounds;
  - normalized casing preserved for the response/internal term derivation boundary.
- Added the pure repository-local `escapeLikeLiteral` helper. It escapes PostgreSQL LIKE `%`, `_`, and
  `\` metacharacters without SQL construction or interpolation and leaves ordinary Unicode and
  punctuation unchanged.
- Added six focused query/escaping tests covering decomposed Unicode, Unicode whitespace, casing,
  surrogate-pair boundaries, exact maximum length, short/long/missing/malformed/extra-field rejection,
  validation-detail privacy, wildcard escaping, and ordinary text preservation.
- Added `QUICK_FIND_UNAVAILABLE` to the finite application error union and
  `QuickFindUnavailableError` as a constructor with no query, cause, details, or persistence-error
  input.
- Added safe error-mapping coverage proving the stable 503 response contains only the designed code and
  message.
- Verification passed:
  - contracts: 11 test files and 42 tests;
  - API: 44 test files and 461 tests, including 11 focused validation/error tests;
  - contracts and API typechecks;
  - contracts and API zero-warning lint;
  - contracts and API builds;
  - `git diff --check`.
- Confirmed build output remains ignored and no generated artifact is tracked.
- No schema, migration, complete repository query, service, endpoint, Express route, OpenAPI, Angular,
  dependency, database, or seed change was introduced. No Phase 1 acceptance criterion remains open.

## Phase 2: Search Indexes, Migration, And SQL Ranking Primitives

Goal: add the minimum database support and reusable repository-local SQL vocabulary needed for bounded,
literal, deterministically ranked searches.

Scope:

- Update Drizzle schema definitions for approved Quick Find indexes.
- Generate and review additive migration `0018_*`.
- Add GIN trigram indexes for:
  - project name and description;
  - milestone name and description;
  - cycle name;
  - published report title and summary;
  - attachment filename.
- Add the milestone workspace B-tree index.
- Reuse existing work-item key/title/description trigram indexes.
- Do not duplicate existing workspace or unique-key indexes.
- Add repository-local helpers for:
  - escaped exact, prefix, and substring terms;
  - parameterized `ILIKE ... ESCAPE '\'` predicates;
  - finite relevance `CASE` expressions;
  - deterministic match-field/mode projection;
  - active-versus-archived lifecycle ordering;
  - bounded plain-text narrative excerpts.
- Ensure excerpt projection collapses whitespace and limits output to 180 Unicode code points including
  omission markers.
- Add focused helper/query-generation tests without exposing raw rank values publicly.
- Apply the migration to a fresh database and verify repeat migration behavior.

Out of scope:

- Complete six-group repository reads, service, HTTP, Angular, and large performance fixtures.

Acceptance criteria:

- Fresh migration creates only intended additive indexes and migration metadata is coherent.
- Existing databases migrate without data backfill or destructive changes.
- Every new index corresponds to an approved predicate.
- Literal wildcard behavior, rank tiers, lifecycle tie-breaks, and excerpts are parameterized and
  deterministic.
- No deferred fields receive indexes.
- Fresh migration, schema, API typecheck, and focused tests pass.

Suggested commands:

```sh
npm run db:generate
npm run db:reset
npm run db:migrate
npm run db:migrate
npm run typecheck --workspace @worktrail/api
npm run test --workspace @worktrail/api -- quick-find-repository
npm run lint --workspace @worktrail/api
git diff --check
```

Status:

- Completed on July 22, 2026.
- Updated the Drizzle schema with exactly the approved Quick Find indexes:
  - GIN trigram indexes for project name/description;
  - a milestone workspace B-tree index plus name/description trigram indexes;
  - a cycle-name trigram index;
  - published-report title/summary trigram indexes;
  - an attachment-filename trigram index.
- Reused the existing work-item display-key/title/description trigram indexes and existing workspace
  indexes. No duplicate index or index for cycle goal, report body/snapshot fields, attachment internal
  metadata, comments, activity, notifications, members, or labels was added.
- Generated and reviewed additive migration `0018_sweet_apocalypse.sql` plus its Drizzle snapshot and
  journal entry. The migration contains nine `CREATE INDEX` statements and no table, constraint, data,
  backfill, drop, or destructive operation.
- Expanded the repository-local `quick-find-sql.ts` boundary with:
  - escaped exact, prefix, and substring pattern terms;
  - parameterized `ILIKE ... ESCAPE '\'` predicates;
  - one finite match builder returning condition, relevance rank, match field, match mode, and excerpt;
  - exact key, key prefix, exact primary, primary prefix, primary substring, and narrative substring
    tiers `0-5`;
  - keyless entities beginning at primary rank `2`;
  - first-match metadata precedence;
  - active/archived lifecycle rank;
  - SQL-projected, whitespace-collapsed, match-centered excerpts capped at 180 PostgreSQL characters
    including ASCII omission markers.
- Kept caller text in bound parameters. The helper composes only trusted Drizzle column/expression
  values and does not use `sql.raw`, string interpolation, or public SQL-rank fields.
- Added five PostgreSQL-backed tests using a bounded `VALUES` relation rather than persistent fixtures.
  They prove:
  - all nine migration indexes and their B-tree/GIN operator classes;
  - all six relevance tiers and stable lifecycle tie behavior;
  - key-over-primary metadata precedence;
  - keyless primary ranking;
  - literal `%`, `_`, and backslash behavior;
  - narrative-only excerpts, whitespace collapse, match centering, both omission markers, and the exact
    180-character ceiling;
  - query patterns are carried as SQL parameters.
- The first database execution identified and resolved two implementation defects before completion:
  - the SQL tagged-template escape literal required a second source-level backslash to emit the designed
    PostgreSQL escape character;
  - parameterized excerpt body-length branches required explicit integer casts for PostgreSQL substring
    inference.
- Reset the local database, applied all migrations through `0018` successfully, reapplied migrations
  successfully as an idempotency check, and restored deterministic seed data after verification.
- Verification passed:
  - 16 focused Quick Find/query/error tests across three files;
  - full API suite: 45 test files and 466 tests;
  - API typecheck;
  - API zero-warning lint;
  - API build;
  - generated migration/index inspection;
  - `git diff --check`.
- Build output remains ignored and no temporary database fixture or generated test artifact remains.
- No complete group repository, service, endpoint, Express route, OpenAPI, Angular, dependency, or seed
  definition change was introduced. No Phase 2 acceptance criterion remains open.

## Phase 3: Cross-Domain Repository, Deterministic Ranking, And Performance Evidence

Goal: implement one workspace-isolated read model that returns bounded, correctly ranked rows from all
six approved groups and prove its query behavior.

Scope:

- Add `apps/api/src/repositories/quick-find-repository.ts`.
- Register `repositories.quickFind` through the existing repository factory.
- Implement sequential group queries in stable order:
  - work items;
  - projects;
  - milestones;
  - cycles;
  - reports;
  - attachments.
- Apply explicit workspace ownership predicates to every source and joined project/work-item table.
- Select `groupLimit + 1` rows per group and derive `hasMore` without `count(*)`.
- Project only the fields required by the Quick Find repository result.
- Extract finite report health from JSON without loading the complete immutable snapshot.
- Keep attachment storage key, checksum, bytes, and uploader details out of internal search rows.
- Apply exact key, key prefix, exact primary, primary prefix, primary substring, and narrative substring
  tiers as applicable to each group.
- Apply lifecycle ordering only within equal relevance.
- End every group order with deterministic identity tie-breakers.
- Return one coherent failure when any group read fails.
- Add integration tests for:
  - each searchable field and match mode;
  - rank tier ordering and stable tie-breakers;
  - active/archived ordering within a tier;
  - exact archived identities;
  - group truncation and `hasMore`;
  - literal wildcard characters;
  - report health projection;
  - attachment metadata isolation;
  - cross-workspace isolation on every group;
  - no per-row follow-up queries.
- Add `quick-find-performance-evidence.ts` and root/API scripts.
- Use rollback-only representative fixtures and JSON `EXPLAIN (ANALYZE, BUFFERS)` evidence.
- Record normal planner behavior, finite limits, selective trigram eligibility, broad two-character
  behavior, and warm aggregate timing.
- Restore statistics after rollback.

Out of scope:

- Service, HTTP endpoint, Angular, production latency SLAs, or hosted-search infrastructure.

Acceptance criteria:

- One repository call returns all six bounded groups with deterministic ordering.
- No query can cross the actor workspace.
- No full narrative, report snapshot, attachment secret, exact total, or unbounded row set is loaded.
- Failures do not produce partial successful groups.
- Evidence demonstrates finite limits and index eligibility without misrepresenting planner choices.
- Warm aggregate execution meets the local evidence target or the design is revisited before Phase 4.
- Focused integration, evidence, lint, and typecheck checks pass.

Suggested commands:

```sh
npm run db:reset
npm run db:migrate
npm run db:seed
npm run test --workspace @worktrail/api -- quick-find-repository
npm run db:quick-find-performance-evidence
npm run typecheck --workspace @worktrail/api
npm run lint --workspace @worktrail/api
git diff --check
```

Status:

- Completed on July 23, 2026.
- Added and registered one dedicated `quick-find-repository.ts` cross-domain read model through
  `createRepositories`.
- Implemented `searchWorkspace` as six sequential statements in stable work-item, project, milestone,
  cycle, report, and attachment order.
- Enforced a repository group limit of 1-25 and selected exactly `groupLimit + 1` rows per statement.
  Each returned group contains at most the requested limit plus `hasMore`; no exact count query is
  issued.
- Applied explicit workspace ownership to every source and join:
  - work items and projects;
  - milestones and projects;
  - cycles and projects;
  - reports and projects;
  - attachments, work items, and projects.
    Attachment joins additionally require workspace/project identity to agree across all three records.
- Used the Phase 2 SQL matcher for the designed exact-key, key-prefix, exact-primary, primary-prefix,
  primary-substring, and narrative-substring tiers.
- Added deterministic order within each group:
  - relevance;
  - active before archived lifecycle within the same tier;
  - case-insensitive primary identity;
  - project key and work-item number where relevant;
  - entity UUID as the final tie-breaker.
- Projected only direct navigation/disambiguation fields and bounded match metadata:
  - no full project/work-item/milestone descriptions or report summaries;
  - no report snapshot beyond a finite `health.health` expression;
  - no attachment media type, uploader, checksum, storage key, or bytes;
  - no labels, assignees, hierarchy, dependencies, or per-row enrichment.
- Validated report health against the finite delivery-health vocabulary before returning the aggregate.
  Malformed historical health rejects the repository promise rather than emitting an invalid or partial
  result.
- Derived milestone/cycle archive context from record archival or archived project ownership while
  retaining completed/canceled status as separate readable lifecycle context.
- Added four database-backed repository integration tests covering:
  - all 12 approved searchable fields;
  - exact, prefix, and substring match metadata;
  - key-over-primary precedence;
  - all six relevance tiers;
  - active/archived ties and UUID stability;
  - exact archived identity;
  - limit-plus-one truncation;
  - six SQL statements with no per-row follow-up reads;
  - every-group cross-workspace isolation;
  - attachment secret/uploader omission;
  - invalid limits rejected before I/O;
  - coherent malformed-report failure.
- Added root/API `db:quick-find-performance-evidence` scripts and a rollback-only evidence tool.
- The evidence fixture:
  - requires the deterministic workspace and active owner;
  - creates 2,000 temporary projects, work items, milestones, cycles, published reports, and
    attachments;
  - includes selective title/name/description/summary/filename needles plus active and archived
    lifecycle variety;
  - runs `ANALYZE`, captures JSON `EXPLAIN (ANALYZE, BUFFERS)`, rolls back all rows, and restores
    statistics.
- Captured six normal tenant-scoped plans without planner overrides. At local 2,000-row scale PostgreSQL
  honestly selected sequential scans for the selective text sources, with 0.791-2.144 ms execution
  times.
- Captured six separately labeled bitmap-index eligibility proofs. Only those proof statements disable
  sequential and plain index scans, and together they exercised every approved project, work-item,
  milestone, cycle, report, and attachment trigram index.
- Captured the broad two-character work-item case under normal planner settings without asserting
  trigram use; it retained a finite `Limit` and executed in 1.673 ms.
- Every normal/proof/broad plan contained a finite `Limit` node.
- Measured the actual sequential six-group repository after warm-up at 17.395 ms, 24.353 ms, and
  19.828 ms, comfortably below the 300 ms local evidence target.
- Verified rollback cleanup through the installed PostgreSQL driver: zero temporary Quick Find projects
  and work items remained. Deterministic seed data remains available.
- Verification passed:
  - focused repository tests;
  - Quick Find performance evidence and all plan assertions;
  - full API suite: 46 test files and 470 tests;
  - API typecheck;
  - API zero-warning lint;
  - API build;
  - `git diff --check`.
- No service, endpoint, Express route, request-logging, OpenAPI, Angular, dependency, persistent fixture,
  or hosted-search change was introduced. No Phase 3 acceptance criterion remains open.

## Phase 4: Service, Endpoint, Express Route, Request-Log Privacy, And OpenAPI

Goal: expose the repository as one authenticated, transport-neutral, documented aggregate API while
keeping search text and persistence failures private.

Scope:

- Add `QuickFindService` using actor context and `Pick<Repositories, 'quickFind'>`.
- Map repository rows to public DTOs without follow-up reads.
- Validate stored report health before emitting its finite contract value.
- Add the transport-neutral Quick Find endpoint handler.
- Add `POST /api/quick-find` through a focused Express route module.
- Register the route in repository-backed local and test server composition.
- Return all six groups, the normalized query, and private/no-store cache semantics.
- Map validation, inactive/missing actor, and repository failures to 400, 403, and safe 503 responses.
- Update request logging to use `request.path` rather than `request.originalUrl`.
- Verify request bodies and search values are never logged.
- Document request, groups, concrete result schemas, examples, limits, no-total behavior, actor headers,
  caching, and 400/403/503 responses in OpenAPI.
- Keep endpoint registration independent of attachment object storage and direct database handles.
- Add service, endpoint, route, privacy, and OpenAPI tests.

Out of scope:

- Angular, query analytics, partial response semantics, and generic search endpoint abstractions.

Acceptance criteria:

- Active members receive a complete bounded response from one POST request.
- Missing/inactive actors are denied before search data is returned.
- Repository failure yields only the stable unavailable error.
- Search text is absent from URLs, request logs, and public error details.
- OpenAPI matches concrete runtime contracts and contains no internal rank/storage fields.
- Existing GET routes still work after request-log sanitization.
- Focused API and OpenAPI tests, lint, and typecheck pass.

Suggested commands:

```sh
npm run test --workspace @worktrail/api -- quick-find endpoint request-logger openapi
npm run typecheck --workspace @worktrail/api
npm run lint --workspace @worktrail/api
npm run build --workspace @worktrail/api
git diff --check
```

Status:

- Completed on July 23, 2026.
- Added `QuickFindService` with actor context and the narrow
  `Pick<Repositories, 'quickFind'>` dependency.
- The service performs one workspace-scoped repository aggregate read with the fixed public
  five-result group limit and maps all six groups explicitly:
  - project and work-item context;
  - milestone and cycle lifecycle/archive context;
  - finite report health plus ISO publication timestamps;
  - attachment identity, size, ISO creation timestamp, and owning work item;
  - match field, mode, and bounded excerpt.
- Revalidated report health at the service boundary and translated repository, malformed-data, and
  timestamp mapping failures to `QUICK_FIND_UNAVAILABLE` without exposing a cause or query.
- Added the transport-neutral Quick Find endpoint and focused Express route module for
  `POST /api/quick-find`.
- Registered Quick Find in repository-backed server composition without requiring a direct database
  handle or attachment object store.
- Reused the existing persistence-backed local actor adapter, which rejects unresolved,
  cross-workspace, and inactive actors before invoking Quick Find.
- The endpoint strictly parses and normalizes the JSON request body, returns the normalized query and
  all six groups, and sets `Cache-Control: private, no-store`.
- Changed request logging from `request.originalUrl` to `request.path`. Regression tests prove query
  strings and JSON bodies are absent from emitted request log lines while existing GET routing remains
  intact.
- Expanded OpenAPI with:
  - the POST operation and local actor headers;
  - strict request validation and examples;
  - concrete context, match, result, group, and aggregate response schemas;
  - the five-item per-group bound, `hasMore` without totals, private/no-store caching, and omission of
    rank/storage internals;
  - explicit 400, 403, and safe 503 responses.
- Added focused service, endpoint, actor, route-composition, log-privacy, and OpenAPI tests.
- Corrected the Phase 3 project-order integration assertion to follow the implemented deterministic
  name-then-key ordering rather than random UUID order for records with distinct keys.
- Verification passed:
  - focused Phase 4 suite: 5 test files and 31 tests;
  - full API suite: 49 test files and 477 tests;
  - API typecheck;
  - API zero-warning lint;
  - API build;
  - OpenAPI YAML parse;
  - `git diff --check`.
- No Angular, analytics, partial-response, generic search-abstraction, direct database, or object-store
  endpoint dependency was introduced. No Phase 4 acceptance criterion remains open.

## Phase 5: Angular API, Destination Mapping, And Overflow Serialization

Goal: establish a typed frontend boundary and exhaustive canonical navigation rules before constructing
the dialog.

Scope:

- Add a focused root-provided `QuickFindApi`.
- Send the request as a POST body through the existing actor-aware `ApiClient`.
- Add client-only result and selectable-option view models where shared contracts are insufficient.
- Add one exhaustive destination mapper for all six result kinds.
- Map attachment results to the owning work item's `#files` fragment.
- Define fixed global and current-project navigation entries as client-owned data.
- Reuse the existing canonical workspace Work Items query serializer for work-item overflow.
- Include `archivedProjects=include` in the overflow destination.
- Do not create local paged overflow routes for projects, milestones, cycles, reports, or attachments.
- Add tests for request transport, actor headers, every destination, fragment behavior, exhaustiveness,
  fixed navigation, and canonical overflow serialization.

Out of scope:

- Dialog dependency/launcher, shell changes, rendering, keyboard behavior, and Files fragment handling.

Acceptance criteria:

- Angular has one typed API operation with no URL query leakage or client cache.
- Every result kind has one canonical destination and new kinds cannot compile without mapping.
- Work-item overflow uses established query-contract behavior rather than hand-built strings.
- Attachment destination carries a stable `files` fragment.
- Focused Angular tests, lint, and typecheck pass.

Suggested commands:

```sh
npm run test --workspace @worktrail/web -- quick-find-api quick-find-navigation
npm run typecheck --workspace @worktrail/web
npm run lint --workspace @worktrail/web
git diff --check
```

Status:

- Completed on July 23, 2026.
- Added the root-provided `QuickFindApi` as a focused wrapper around the existing actor-aware
  `ApiClient`.
- Quick Find sends the typed `QuickFindRequest` only in the `POST /api/quick-find` JSON body and
  returns the shared `QuickFindResponseDto`.
- The API wrapper adds no query parameters, local result cache, memoization, or compatibility methods
  to `WorktrailApiService`.
- Added client-only route-target, navigation-entry, and selectable-option models for navigation,
  heterogeneous results, and work-item overflow.
- Defined fixed global entries in product order:
  - My Work;
  - Inbox;
  - Work Items;
  - Projects;
  - Portfolio;
  - Create work item.
- Defined current-project entries only when a project id is available:
  - Project overview;
  - Work;
  - Board;
  - Planning;
  - Reports;
  - Project settings.
- Added one exhaustive discriminated-union destination mapper for all six result kinds:
  - projects open project overview;
  - work items open global work-item detail;
  - milestones and cycles open their project review routes;
  - reports open immutable project report detail;
  - attachments open the owning work item with the stable `files` fragment.
- Added exhaustive stable result-option ids derived from result kind and entity UUID rather than array
  position.
- Added the sole local overflow destination for work items. It delegates to the existing canonical
  workspace Work Items query serializer with the normalized response query and
  `archivedProjects: 'include'`, while omitting default page, page-size, and sort state.
- Added focused tests covering:
  - exact POST transport, actor headers, body shape, response typing, and absence of URL query text;
  - independent requests without client memoization;
  - every result destination and stable result id;
  - attachment-only fragment behavior;
  - fixed global/current-project labels, ordering, and commands;
  - selectable-option variants;
  - canonical work-item overflow serialization.
- Verification passed:
  - focused Quick Find frontend suite: 2 test files and 9 tests;
  - full Angular suite: 399 tests;
  - Angular development typecheck/build;
  - frontend zero-warning lint;
  - frontend production build without budget warnings;
  - `git diff --check`.
- No dialog dependency, launcher, root-shell trigger, rendering, keyboard behavior, Files-section
  handling, generic command framework, or non-work-item overflow route was introduced. No Phase 5
  acceptance criterion remains open.

## Phase 6: Lazy Dialog Launcher, Root-Shell Trigger, Shortcut, And Navigation Mode

Goal: add a lightweight, discoverable shell entry point and useful no-query navigation without pulling
the dialog into the initial bundle.

Scope:

- Install compatible `lucide-angular` in the web workspace.
- Add a standalone Quick Find dialog component with separate template and stylesheet.
- Add `open-quick-find-dialog.ts` as the lazy launcher using Angular CDK Dialog.
- Dynamically import the launcher from the root shell.
- Configure focus restoration, Escape/backdrop dismissal, body scroll blocking, close-on-navigation, and
  accessible dialog labeling.
- Add an opening guard and retained dialog reference to prevent duplicate overlays during lazy import.
- Add the shell Search icon button with a concise accessible name and tooltip.
- Add exact `Command/Ctrl+K` handling, excluding Alt and repeated key events.
- Close Quick Find before actor selection changes and reset state on launcher failure.
- Derive current project id by traversing router state after `NavigationEnd`.
- Render fixed Global and optional Current project groups for empty/short queries.
- Navigate fixed entries through Angular Router and close before routing.
- Preserve topbar behavior across existing desktop and mobile breakpoints.
- Add root-shell, launcher, dialog-open, shortcut, duplicate-open, actor-change, project-context, and
  navigation-mode tests.
- Inspect production chunks to confirm the dialog/CDK/Lucide feature remains lazy.

Out of scope:

- Search requests/results, active-descendant keyboard traversal, and final dialog visual polish.

Acceptance criteria:

- A visible shell control and `Command/Ctrl+K` open exactly one accessible dialog.
- Opening Quick Find does not change browser history.
- Empty mode offers fixed global destinations and project destinations only when project context exists.
- Actor changes and route navigation cannot leave stale overlays.
- Search UI code remains outside the initial production chunk.
- Existing shell navigation and actor selection remain usable at supported widths.
- Focused tests and production build pass without bundle/style budget warnings.

Suggested commands:

```sh
npm install lucide-angular --workspace @worktrail/web
npm run test --workspace @worktrail/web -- app quick-find-dialog
npm run typecheck --workspace @worktrail/web
npm run lint --workspace @worktrail/web
npm run build --workspace @worktrail/web
git diff --check
```

Status:

- Completed on July 23, 2026.
- Added maintained `@lucide/angular` instead of the deprecated `lucide-angular` package. The shell
  trigger uses the matching Lucide Search SVG asset so the Angular icon runtime remains part of the
  lazy dialog feature.
- Added a standalone Quick Find dialog with separate template and stylesheet, accessible labeling,
  input autofocus, focus restoration, Escape/backdrop dismissal, blocked background scrolling, and
  close-on-navigation behavior.
- Added a two-stage lazy boundary:
  - the root shell dynamically imports the small dialog launcher;
  - the launcher dynamically imports the dialog component before opening it through CDK Dialog.
- Added a retained dialog reference, in-flight opening guard, and generation check so repeated trigger
  clicks or shortcuts cannot create duplicate or late overlays.
- Added the visible shell Search icon button with an accessible name and native tooltip.
- Added exact `Command/Ctrl+K` handling. Alt, Shift, key-repeat, and ambiguous Ctrl+Command
  combinations do not open the dialog.
- Quick Find closes before actor changes and on route navigation. Launcher failure resets the opening
  guard so a later attempt can retry.
- Current project context is derived from the deepest active route snapshot after each
  `NavigationEnd`, including routes whose project id is inherited from a parent.
- Empty and normalized one-code-point queries render fixed Global navigation plus Current project
  navigation only when project context is available.
- Fixed navigation entries close the dialog before routing and do not write temporary state to browser
  history.
- Preserved the existing desktop and mobile topbar layouts while adding a stable 36 px icon control.
- Added focused tests covering:
  - shell-trigger rendering and accessible naming;
  - duplicate-open and launcher-failure behavior;
  - exact shortcut acceptance and rejection;
  - actor-change and route-change closure;
  - project-context refresh;
  - dialog accessibility, focus, scroll strategy, and history preservation;
  - global/project navigation groups and short-query mode;
  - close-before-route ordering.
- Verification passed:
  - focused root-shell and Quick Find suite: 19 tests;
  - full Angular suite: 407 tests;
  - Angular development typecheck/build;
  - frontend zero-warning lint;
  - frontend production build without bundle or style budget warnings;
  - `git diff --check`.
- Production inspection confirmed that the initial bundle remains 379.29 kB raw and that the Quick Find
  component plus tree-shaken Lucide runtime is isolated in an approximately 15 kB lazy chunk. CDK
  dialog/overlay runtime is also loaded through the lazy path.
- No search request, result rendering, active-descendant keyboard traversal, Files-section behavior,
  or final visual polish was introduced. No Phase 6 acceptance criterion remains open.

## Phase 7: Reactive Search State, Grouped Result Rendering, And Lifecycle Context

Goal: turn the dialog into a bounded, stale-safe search experience with understandable grouped results
and honest truncation.

Scope:

- Add one reactive form control for query input.
- Implement client normalization only for request suppression; retain server normalization as
  authoritative.
- Switch immediately to navigation mode below two normalized code points.
- Add 220 ms debounce, distinct normalized queries, `switchMap`, destruction cancellation, and request
  generation checks.
- Clear stale selectable results when the normalized query changes.
- Keep input text available for retry after errors.
- Close if selected actor changes unexpectedly outside normal root handling.
- Render non-empty groups in the fixed designed order.
- Render stable primary identity, project context, readable status/type/date metadata, lifecycle labels,
  and plain-text excerpts.
- Never bind server or query text through `innerHTML`.
- Render loading, no-results, safe-error/retry, clear, and all-empty states.
- Show per-group `hasMore` honestly without exact totals.
- Render the canonical work-item overflow option only for truncated work-item results.
- Keep result rows read-only and free of previews, downloads, mutations, or nested menus.
- Add tests for debounce/cancellation, stale success/error suppression, actor change, group ordering,
  lifecycle context, excerpts, truncation, overflow presence, safe text, and retry.

Out of scope:

- Arrow-key active-descendant behavior, final route integration, Files targeting, and browser polish.

Acceptance criteria:

- Each settled valid query creates at most one aggregate request generation.
- Late responses cannot replace newer query or actor state.
- Results are grouped, bounded, readable, and free of unsafe markup.
- Archived/completed context is visible without demoting exact matches across relevance tiers.
- Empty/error/loading behavior preserves a clear next action.
- Focused Angular tests, lint, and typecheck pass.

Suggested commands:

```sh
npm run test --workspace @worktrail/web -- quick-find-dialog
npm run typecheck --workspace @worktrail/web
npm run lint --workspace @worktrail/web
git diff --check
```

Status:

- Completed on July 23, 2026.
- Extended the dialog's single non-nullable reactive form control into a stale-safe search pipeline:
  - NFC normalization, trimming, and Unicode whitespace collapsing are client-side request-suppression
    concerns only;
  - normalized queries below two code points return to navigation mode immediately;
  - valid queries debounce for 220 ms and deduplicate by normalized value;
  - every normalized change cancels the complete debounce/request chain through `switchMap`;
  - generation and normalized-query checks protect state even when a transport cannot be canceled;
  - component destruction cancels the pipeline through `takeUntilDestroyed`.
- New normalized queries clear prior response, error, selectable-option, and truncation state
  synchronously. Equivalent normalized input retains the current request/response.
- Added a retry trigger that preserves visible query text, invalidates the prior generation, and
  retries the same normalized query without another debounce.
- Captured the initial selected actor and invalidate/close the dialog if actor context changes outside
  the root shell's normal close-first path.
- Added a pure, exhaustive Quick Find display-model layer that:
  - emits non-empty groups in Work items, Projects, Milestones, Cycles, Reports, and Attachments order;
  - derives stable result ids from the existing result-option mapper;
  - formats readable status/type/health tokens, local-safe dates, date ranges, and attachment sizes;
  - includes project and owning-work-item context;
  - labels archived projects/records and completed or canceled work;
  - carries only plain-text match excerpts.
- Added loading, no-results, safe error/retry, clear, and settled grouped-result states. The input and
  clear action remain available during loading and recovery.
- Rendered result rows as read-only content without mutation, preview, download, nested-menu, or route
  behavior. Angular text bindings are used exclusively; neither query nor server text uses
  `innerHTML`.
- Added per-group `More matches exist` disclosure without totals. Only truncated Work items produce the
  canonical overflow selectable model, using the server-normalized response query; activation remains
  assigned to Phase 8.
- Added focused tests covering:
  - 220 ms debounce, normalization, immediate cancellation, and stale success/error suppression;
  - synchronous stale-state clearing and settled loading state;
  - safe errors, retained query text, immediate retry, no-results, and clear recovery;
  - actor-change closure and pending-response invalidation;
  - fixed six-group ordering and omitted empty groups;
  - project/work-item context, readable metadata, lifecycle labels, excerpts, and text escaping;
  - honest per-group truncation and work-item-only overflow state.
- Verification passed:
  - focused Quick Find suite: 15 tests;
  - full Angular suite: 412 tests;
  - Angular development typecheck/build;
  - frontend zero-warning lint;
  - frontend production build without bundle or style budget warnings;
  - `git diff --check`.
- Production inspection confirmed the initial bundle remains effectively unchanged at 379.21 kB raw
  and the complete dialog/search/display feature remains isolated in a 27.21 kB lazy chunk.
- No active-descendant keyboard movement, result/overflow route activation, Files targeting, or browser
  polish was introduced. No Phase 7 acceptance criterion remains open.

## Phase 8: Keyboard Interaction, Accessibility, And Canonical Result Navigation

Goal: complete the dialog as a fast keyboard and pointer navigation surface with coherent focus,
selection, and routing behavior.

Scope:

- Flatten visible navigation/results/overflow into stable selectable options while retaining visual
  groups.
- Keep DOM focus in the query input and implement ARIA active-descendant behavior.
- Add ArrowDown/ArrowUp, Home/End, Enter, pointer hover, and pointer click behavior.
- Keep Escape owned by CDK Dialog and preserve normal Tab order.
- Keep active option id, visible active styling, and `aria-activedescendant` synchronized.
- Reset active selection predictably across navigation mode, loading, success, empty, and error states.
- Open all six result destinations through the exhaustive mapper.
- Close the dialog before route navigation.
- Open work-item overflow with canonical workspace list query state.
- Add accessible group names, result identity/context announcements, loading status, error alert, and
  clear/close labels.
- Complete responsive dialog dimensions, row density, overflow behavior, high-zoom layout, focus
  indicators, contrast, reduced-motion behavior, and text containment.
- Keep cards, nested cards, oversized headings, and decorative visual elements out of the tool surface.
- Add focused keyboard, pointer, ARIA, focus-restoration, route, and responsive-state tests.

Out of scope:

- Files-section fragment settlement, end-to-end browser suite, or new result actions.

Acceptance criteria:

- Keyboard users can open, search, traverse, select, close, and recover focus without leaving the input.
- Pointer and keyboard activation produce identical canonical destinations.
- Active-descendant semantics match visible state at every transition.
- Result text and controls remain contained from mobile width through 200% zoom.
- Existing page focus and browser history behavior remain coherent.
- Focused Angular tests, lint, typecheck, and production build pass without warnings.

Suggested commands:

```sh
npm run test --workspace @worktrail/web -- quick-find-dialog quick-find-navigation
npm run typecheck --workspace @worktrail/web
npm run lint --workspace @worktrail/web
npm run build --workspace @worktrail/web
git diff --check
```

Status:

- Completed on July 23, 2026.
- Unified fixed navigation entries, grouped search results, and work-item overflow into one flattened
  `QuickFindSelectableOption` sequence while retaining their visual groups and stable ids.
- Added a feature-local active-option manager that:
  - keeps DOM focus in the query input;
  - selects the first available option after navigation-mode entry or settled search success;
  - clears selection during loading, error, and empty states;
  - retains a still-visible active id when the option sequence is unchanged;
  - scrolls newly active options into the nearest visible region without animated movement.
- Completed combobox/listbox active-descendant semantics:
  - the input exposes list ownership, expansion, autocomplete, and the exact active option id;
  - Global, Current project, and result groups have programmatic labels;
  - every option exposes synchronized `aria-selected`;
  - result accessible names include stable identity, title, project/owner context, metadata, and
    lifecycle context;
  - one polite live region announces destination/result availability and loading;
  - safe failures retain alert behavior;
  - the dialog is named by its visible heading.
- Added ArrowDown, ArrowUp, Home, End, and Enter behavior with no boundary wrapping. Composition, Tab,
  Escape, and unrelated keys remain untouched so CDK owns dismissal and normal focus traversal.
- Added pointer hover selection and pointer activation without moving focus out of the query input.
  Programmatically focusable options also support Enter/Space as an assistive-technology fallback
  without entering ordinary Tab order.
- Routed every activation through one close-first path:
  - fixed destinations use their existing typed entries;
  - all six result kinds use the exhaustive result destination mapper;
  - work-item overflow uses the canonical workspace serializer with the server-normalized query and
    archived-project inclusion;
  - attachment destinations retain the stable `files` fragment for Phase 9 settlement.
- Preserved normal Angular Router history behavior; no temporary Quick Find route or history state is
  introduced.
- Completed responsive interaction styling with fixed header/query rows, one bounded internal scroller,
  `dvh` viewport containment, wrapping metadata and titles, mobile stacking, visible active indicators
  that do not change geometry, forced-colors support, and reduced-motion-safe scrolling.
- Kept the component stylesheet at 6,243 bytes, below the 8 kB warning threshold.
- Added focused tests covering:
  - synchronized combobox/listbox/active-descendant state;
  - bounded arrow movement, Home/End, Enter, untouched Tab/Escape, and input focus retention;
  - loading/result/navigation active-state resets;
  - pointer hover and pointer/keyboard destination parity;
  - accessible option identity/context;
  - all six canonical result destinations, attachment fragment, and work-item overflow query;
  - close-before-route ordering;
  - real CDK Escape dismissal and trigger focus restoration.
- Verification passed:
  - focused Quick Find interaction suite: 19 tests;
  - full Angular suite: 416 tests;
  - Angular development typecheck/build;
  - frontend zero-warning lint;
  - frontend production build without bundle or style budget warnings;
  - `git diff --check`.
- Production inspection confirmed the initial bundle remains 379.21 kB raw and the complete interactive
  Quick Find dialog remains isolated in a 34.73 kB lazy chunk.
- Files-section fragment settlement, end-to-end browser coverage, and new result actions remain assigned
  to later phases. No Phase 8 acceptance criterion remains open.

## Phase 9: Files Fragment Targeting And Route-Reuse Integration

Goal: make attachment filename results reliably reach and focus the owning work item's Files section on
initial navigation and reused work-item detail routes.

Scope:

- Add stable `id="files"` to the attachment section.
- Make the target heading/container programmatically focusable.
- Observe `ActivatedRoute.fragment` in work-item detail.
- Reset target generation when work-item id changes.
- Coordinate one-shot focus/scroll with attachment load success or error settlement.
- Prevent ordinary attachment refreshes from repeatedly stealing focus.
- Avoid forced smooth scrolling and respect reduced-motion expectations.
- Support:
  - navigation from another route;
  - navigation between work items while the detail component is reused;
  - direct navigation to the same work item and fragment;
  - empty, loading, success, and error attachment states.
- Preserve the existing fix that reloads detail data when only `:workItemId` changes.
- Add parent/child component tests and focused router tests.

Out of scope:

- Attachment content search, preview, download changes, or a generic fragment-scrolling framework.

Acceptance criteria:

- Every attachment Quick Find destination settles on the correct work item and Files section.
- Route reuse cannot leave the previous item or previous fragment target visible.
- The Files target receives meaningful focus exactly once per requested navigation.
- Normal attachment operations do not cause surprise scrolling/focus.
- Existing work-item detail and attachment tests remain green.

Suggested commands:

```sh
npm run test --workspace @worktrail/web -- work-item-detail work-item-attachments
npm run typecheck --workspace @worktrail/web
npm run lint --workspace @worktrail/web
git diff --check
```

Status:

- Not started.

## Phase 10: Seed, Browser, Responsive, Operational, And Regression Verification

Goal: prove Quick Find against deterministic data and real browser behavior while protecting bundle,
privacy, performance, and established workflows.

Scope:

- Reuse existing deterministic records for keys, same-name cross-group results, lifecycle context,
  reports, and attachment filenames.
- Add or adjust only the smallest seed data needed for deterministic rank/truncation/browser assertions.
- Verify fresh and repeated seed behavior.
- Add browser coverage for:
  - visible trigger and `Command/Ctrl+K`;
  - focus entry, Escape close, and focus restoration;
  - global/current-project navigation mode;
  - exact key and broad grouped searches;
  - same-name entities in separate groups;
  - archived/completed lifecycle context;
  - loading/no-results/error/retry behavior;
  - keyboard and pointer selection;
  - work-item overflow;
  - attachment result to `#files`;
  - work-item route reuse;
  - actor switch isolation.
- Exercise desktop, compact/mobile, and 200% zoom viewports.
- Check screenshots and DOM geometry for clipping, overlap, hidden controls, horizontal page scroll, and
  dialog overflow.
- Verify initial and lazy production chunk sizes and component style budgets.
- Rerun Quick Find performance evidence after final query code.
- Verify request logs contain method/path/status but no Quick Find text.
- Verify no orphaned API/web/browser process remains after checks.
- Run targeted regression coverage for work lists, board, saved views, planning, reports, notifications,
  and attachments.

Out of scope:

- Documentation/version finalization, hosted load testing, analytics, and new feature work.

Acceptance criteria:

- Deterministic seed/browser cases prove every primary Quick Find workflow.
- Tenant/actor isolation, request privacy, performance limits, and fragment navigation hold end to end.
- Mobile/high-zoom layouts have no incoherent overlap or inaccessible content.
- Initial bundle and component styles pass existing budgets without threshold increases.
- Established high-value workflows remain green.
- No generated screenshots, traces, results, servers, or evidence fixtures remain unintentionally.

Suggested commands:

```sh
npm run db:reset
npm run db:migrate
npm run db:seed
npm run db:seed
npm run db:quick-find-performance-evidence
npm run build
npm run test:e2e
npm run test:e2e -- --project=chromium
git status --short
git diff --check
```

Status:

- Not started.

## Phase 11: Documentation, Public Site, Metadata, And Final Verification

Goal: finalize v0.2.8 as a coherent, accurately documented release after implementation and
user-facing verification.

Scope:

- Update root/API/web/contracts/lockfile/OpenAPI/displayed versions to `0.2.8`.
- Mark PRD, technical design, implementation plan, and phase statuses consistently with actual
  completion.
- Update README capability, shortcut, searchable-field, result-limit, setup, and limitation guidance.
- Update public site copy to present bounded workspace navigation/search without overstating full-text,
  semantic, attachment-content, hosted, authentication, or production readiness.
- Finalize OpenAPI version and representative examples.
- Add release notes covering user behavior, operator impact, indexes, limits, privacy, and deferred
  capabilities.
- Add destination-neutral extraction notes for heterogeneous bounded reads, deterministic rank tiers,
  limit-plus-one groups, privacy-preserving transport/logging, lazy shell tools, and stale-response
  handling.
- Search current docs/site for stale navigation and search capability claims.
- Run fresh database reset, migration, seed, repeat seed, and focused API smoke.
- Run full formatting hygiene, lint, typecheck, tests, build, browser suite, and dependency audit.
- Confirm migration metadata, lockfile, OpenAPI, docs, site, and package metadata are intentional.
- Confirm no logs, local database/storage data, test results, screenshots, traces, or build output are
  tracked.
- Review the final diff for query text, credentials, internal fields, unrelated changes, and accidental
  budget increases.
- Leave commit, push, tag, publication, merge, and GitHub release to explicit user instruction.

Out of scope:

- New features, production infrastructure, automatic release actions, and deferred search types.

Acceptance criteria:

- Product/API/package/docs/site identify v0.2.8 consistently.
- Documentation states searchable fields, shortcuts, limits, privacy, and exclusions accurately.
- Public copy describes Quick Find without claiming enterprise full-text or semantic search.
- Fresh/repeated setup works and all configured verification passes without warnings.
- Planning records match actual implementation and the diff remains release-scoped.
- No unresolved decision, failed required check, generated artifact, or active development server
  remains.

Suggested commands:

```sh
npm run storage:reset
npm run db:reset
npm run db:migrate
npm run db:seed
npm run db:seed
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
npm audit --omit=dev --audit-level=low
git status --short --branch
git diff --check
git diff --stat
rg -n '0\.2\.7|no global search|cannot search|search is limited' README.md docs site apps packages package*.json
```

Status:

- Not started.

## Phase Completion Protocol

For every implementation phase:

1. Re-read the phase scope and latest user request before editing.
2. Inspect current repository/user changes and preserve unrelated work.
3. Implement only the phase and prerequisites needed to keep the repository coherent.
4. Add or update focused tests with behavior.
5. Run suggested checks plus directly affected package lint/typecheck.
6. Run `git diff --check` and review changed/untracked files.
7. Update the phase `Status` with completion date, delivered behavior, verification, and deviations.
8. Do not mark a phase complete while required checks fail.
9. Do not broaden into deferred search, command, analytics, or hosted infrastructure without explicit
   direction.
10. Do not commit, push, tag, publish, or merge unless explicitly requested.

If a phase invalidates a design assumption, update the design and plan before continuing. Preserve
bounded reads, explicit tenant ownership, deterministic ranking, query privacy, lazy shell loading, and
canonical navigation.

## Release Completion Criteria

v0.2.8 is complete when:

- active workspace members can open Quick Find visibly and with `Command/Ctrl+K`;
- empty mode provides correct global and current-project navigation without a network request;
- valid queries search all six approved groups through one bounded POST response;
- exact keys, prefixes, primary fields, narratives, and lifecycle tie-breaks rank deterministically;
- every group returns at most five rows plus honest `hasMore`, without exact totals;
- archived/completed readable records remain discoverable and clearly labeled;
- all results navigate to canonical destinations;
- attachment filename results settle on the owning work item's Files section across route reuse;
- work-item overflow uses canonical workspace query state;
- query text remains absent from URLs, normal request logs, public errors, and operational failure
  details;
- every search query is workspace-isolated and attachment internal fields remain private;
- database predicates are indexed where designed and evidence records bounded normal planner behavior;
- stale requests and actor changes cannot display incorrect results;
- modal focus, active-descendant behavior, Escape, pointer, mobile, and zoom workflows pass;
- initial bundle and component styles pass current budgets without threshold increases;
- existing product workflows and local setup remain operational;
- OpenAPI, README, release docs, pattern notes, and public site are accurate;
- package/application metadata is `0.2.8`;
- lint, typecheck, tests, build, browser suite, audit, and diff hygiene pass without warnings;
- no generated artifacts, evidence fixtures, runtime data, or active development servers remain;
- no unresolved decision or failed required check remains.
