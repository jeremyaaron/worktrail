# Worktrail v0.2.9 Implementation Plan

## Status

Implementation in progress. Phases 0-10 are complete; Phase 11 has not started.

## Purpose

This plan turns the [v0.2.9 PRD](prd.md) and [technical design](technical-design.md) into sequential
implementation phases for **Readable Work: Structured Descriptions and Discussion**.

The release adds explicit source formats, safe Markdown presentation, a shared source editor and
preview, and formatted descriptions/comments in existing workflows. It preserves legacy plain text,
explicit mentions, current permissions, archived-project behavior, source-text search, summary CSV
exports, and immutable snapshots.

Implementation must remain focused on these workflows. It must not become a general document
framework, WYSIWYG editor, checklist engine, attachment preview system, search redesign, or hosted
deployment sprint.

## Design Decisions

Use the technical design as the source of implementation details. The principal release invariants
are:

- Store source strings plus `plain_text` or `markdown_v1`; never store generated HTML or editor JSON.
- Add `descriptionFormat` to work-item detail and `bodyFormat` to comment responses.
- Omitted create formats mean plain text; omitted update formats preserve the stored format.
- New Angular descriptions/comments explicitly default to Markdown; edits preserve loaded format.
- Normalize new/changed CRLF and lone CR to LF without trimming source whitespace.
- Limit new/changed normalized source to 10,000 UTF-16 code units.
- Preserve unchanged legacy source, including oversized records and historical line endings.
- Validate state-dependent changes after authorization against current locked records.
- Save source and format together; unchanged pairs do not create activity or update timestamps.
- Keep explicit mention selection, creation notification deduplication, and edit notification behavior.
- Parse with web-only `markdown-it`, initially pinned to `15.0.2`, without plugins or an Angular wrapper.
- Project parser tokens into finite application-owned nodes and render static Angular templates.
- Use no HTML insertion, `SafeHtml`, security bypass, dynamic templates, images, or remote previews.
- Permit only validated explicit HTTP(S) links and use defensive external-link attributes.
- Share the viewer between saved content and preview, and use one compound CVA source/format editor.
- Keep parsing/rendering behind existing lazy create/detail routes and current build budgets.
- Add optional `description_format` to CSV import with escaped bounded preview excerpts.
- Do not change summary export columns, search semantics, report rendering, or snapshot schemas.
- Keep migrations additive, seeds repeatable, and endpoint handlers transport-neutral.

## Phase Sizing

Execute one phase at a time. Each phase must leave the repository compiling and its focused tests
passing, even while the full release remains incomplete.

0. Baseline planning and decision closure.
1. Shared format vocabulary and source write-policy primitives.
2. Additive persistence, format-aware reads, and migration compatibility.
3. Work-item description writes, no-ops, activity, and API contracts.
4. Comment writes, locks, no-ops, mentions, and API contracts.
5. Whitespace-preserving CSV import and format-aware preview.
6. Markdown parser, URL policy, bounded projection, and Angular viewer.
7. Shared authoring control, formatting commands, and faithful preview.
8. Description creation/editing and detail presentation integration.
9. Comment authoring/display and draft lifecycle integration.
10. Seed scenarios, browser/security/accessibility evidence, and regressions.
11. Documentation, public site, release metadata, and final verification.

Contract changes are staged with their producers rather than introducing required fields backed by
temporary hardcoded response values. Phase 1 introduces the shared vocabulary; Phase 2 adds required
detail/comment response fields; Phases 3-4 activate corresponding write contracts; Phase 5 adds import
preview fields. Update affected fixtures in the same phase as each contract change.

The API and read-model work precedes UI activation. Parser/viewer safety precedes editor integration.
Descriptions and comments are integrated separately because their reset, submission, and notification
behavior differ.

## Verification Safety

- Preserve the user's current database, attachment files, worktree changes, and running processes.
- Use a clearly identified disposable PostgreSQL database for migration upgrade/reset/seed evidence,
  integration fixtures, and browser suites. Confirm the effective `DATABASE_URL` before destructive
  commands; never print credentials into evidence.
- Playwright global setup invokes storage reset, database reset, migration, and seed. Teardown also
  resets storage and, by default, resets/migrates/seeds the database using the original storage root.
  Do not run either against working data. For disposable verification, explicitly export the test
  `DATABASE_URL`, isolated storage paths, and `WORKTRAIL_E2E_SKIP_DB_RESTORE=true` before invocation.
  Alternatively, use `false` only when the original and test storage roots are both disposable and
  per-file restoration is needed for full-suite isolation, as recorded in Phase 10 evidence.
- Use isolated attachment storage for verification, including production-preview checks. Do not
  remove the user's attachment root while cleaning temporary evidence.
- Before database-backed package checks, apply the currently committed migrations to the disposable
  database. Phase 1 tests need the baseline schema even though that phase adds no migration.
- Prefer existing PostgreSQL fixture/cleanup patterns. Add only the focused harness needed for new
  migration or locking evidence; do not create a second testing framework.
- Record nondefault server ports and process ids. Stop only processes started for the phase unless
  explicitly directed otherwise.
- The checked-in Angular proxy targets API port `3000`. Changing `API_PORT` alone does not retarget
  it. Check port availability before browser runs; an alternate API port requires a matching proxy.
- Keep deterministic correctness/security assertions in CI. Record rendering timing separately as
  local evidence, not a fragile elapsed-time assertion on a shared runner.
- CI runs install, production dependency audit, lint, typecheck, database preparation, package tests,
  build, editor/application browser suites, and compiled production preview using PostgreSQL 16 and
  Node 20. Phase 10 added the audit/application/production browser gates and failure artifacts.

## Phase 0: Baseline Planning And Decision Closure

Goal: confirm planning inputs, repository state, schema/dependency assumptions, and safe verification
boundaries before runtime changes.

Scope:

- Confirm all three planning documents exist and reflect the latest user direction.
- Inspect branch, baseline commit, staged changes, tracked changes, and untracked files.
- Confirm package/OpenAPI baseline is `0.2.8` and defer release metadata changes to Phase 11.
- Confirm `0018_sweet_apocalypse.sql` is the latest migration and the next migration slot is available.
- Confirm existing work-item/comment schema, source-trimming points, DTO paths, and write transactions.
- Confirm current comment deletion/edit permissions and creation-only mention/watcher notifications.
- Confirm work-item locking support and the comment locked-read addition required by the design.
- Confirm CSV parser trimming, preview shape, import routes, and unchanged summary export columns.
- Confirm lazy Angular routes, compound editor integration points, Lucide availability, and budgets.
- Inspect the selected parser's package exports/types and declared Node requirements against the
  local Node/Angular baseline; defer installation/build compatibility evidence to Phase 6.
- Identify the disposable database, isolated storage, browser setup, and CI verification entry points.
- Resolve any remaining internal naming or fixture choices and record the decisions in this plan or
  design before Phase 1.

Out of scope: runtime edits, dependency installation, migrations, database resets, and runtime tests.

Acceptance criteria:

- Planning inputs and repository changes are understood and preserved.
- No product or technical decision blocks Phase 1.
- Migration, API, frontend, and verification sequencing are coherent.
- Phase 0 completion evidence identifies safe test resources without exposing secrets.

Suggested checks:

```sh
git status --short --branch
git diff --cached --name-only
git log -1 --oneline --decorate
rg --files docs/v0.2.9 apps/api/drizzle .github/workflows
rg -n 'descriptionFormat|bodyFormat|\.trim\(|findManyByIdsForUpdate' apps/api/src apps/web/src/app/features/work-items
rg -n 'DATABASE_URL|SKIP_DB_RESET|ATTACHMENT_STORAGE|maximumWarning|maximumError' e2e playwright.config.ts apps/web/angular.json .github/workflows
git diff --check
```

Status: Complete (October 11, 2026).

### Completion Evidence

Baseline:

- Branch `v0.2.9` starts at `4c908b2`, the v0.2.8 merge on `main`/`origin/main`.
- The index and tracked worktree are clean. Only the three `docs/v0.2.9/` planning documents are
  untracked; they are retained for the sprint commit.
- Root/API/web/contracts package versions, lockfile root version, and OpenAPI version are `0.2.8`.
  Release metadata stays unchanged until Phase 11.
- Migration journal and SQL files end at `0018_sweet_apocalypse`; slot `0019` is available.

Implementation boundaries confirmed:

- Work-item descriptions and comment bodies have no format columns. Detail and comment DTO mapping
  is centralized; list DTOs need no source/format expansion.
- Endpoint schemas and Angular request mappings currently trim authored source. Remove trimming
  only at the staged source-handling boundaries, not from unrelated metadata.
- Work-item repositories already support ordered row locks through `findManyByIdsForUpdate`.
  Comment repositories need a locked read for edit/delete; both write services have transaction paths.
- Comment modification remains author or owner/maintainer only, with archived projects read-only.
  Explicit mention records and creation notifications remain independent of source syntax; edits
  currently do not re-notify recipients.
- CSV parsing currently trims cells, import preview lacks description excerpts/formats, and summary
  exports omit description source. Phase 5 changes import only and preserves default parser behavior
  for other callers.
- Angular create/detail routes are lazy; their forms are the compound editor integration points.
  Lucide is already available. Existing production budgets remain 550 kB warning/1 MB error initially
  and 8 kB warning/12 kB error per component stylesheet.

Decisions closed:

- The shared module is `packages/contracts/src/authored-content.ts`; API policy helpers live in
  `apps/api/src/domain/authored-content-policy.ts`. The technical design now fixes helper names,
  result shape, and focused contract/policy/concurrency test locations.
- Use temporary workspace fixtures with cleanup for PostgreSQL locking tests. Use pre-column records
  for migration preservation; do not reuse or modify personal working data or seeded actor records.
- Retain pinned `markdown-it@15.0.2`. Registry metadata supplies ESM/CommonJS exports and bundled
  declarations; no separate `@types` package is planned. Its `entities@8.0.0` dependency declares
  Node `>=20.19.0`, satisfied by local Node `20.19.1` (npm `10.8.2`). Angular is `^20.3.0` with
  TypeScript `~5.9.2` and `module: preserve`. Actual install, typecheck, and bundle evidence belongs
  to Phase 6; metadata inspection is not a successful integration test.

Verification resources:

- Reserve disposable database `worktrail_v029_verify` on local PostgreSQL for this sprint. Before
  database-backed checks, provision it and explicitly export/inspect its effective connection target
  without logging credentials. No database was created, connected to, migrated, or reset in Phase 0.
- No root/API/web `.env` file or shell database/storage override is present in this checkout. The
  default local database must therefore not be assumed disposable.
- Allocate unique temporary storage roots outside `.worktrail/attachments` for
  `WORKTRAIL_ATTACHMENT_STORAGE_PATH` and `WORKTRAIL_E2E_ATTACHMENT_STORAGE_PATH`; set
  `WORKTRAIL_E2E_SKIP_DB_RESTORE=true` for disposable browser runs. Keep the disposable database URL
  in effect for setup, child servers, tests, and teardown. Temporary directories are not yet allocated.
- Use the existing Playwright setup/teardown and CI entry points with the safety rules above. Check
  API port `3000` and the selected web port before starting owned processes; do not stop an unrelated
  server to make room.

Phase 0 used repository/configuration inspection, npm registry metadata, and documentation checks
only. No runtime code, dependency, release version, database, or server process changed. No remaining
product or technical decision blocks Phase 1.

## Phase 1: Shared Format Vocabulary And Source Write Policy

Goal: establish testable source/format rules before changing persistence or public DTO producers.

Dependencies: Phase 0.

Scope:

- Add `packages/contracts/src/authored-content.ts` with the format tuple/type, 10,000-unit source
  limit, and pure line-ending normalization helper; export it through the package entry point.
- Keep the contracts module free of Angular, parser, database, and error-handling dependencies.
- Add focused API write-policy helpers in `apps/api/src/domain/authored-content-policy.ts` for new
  pairs and current-record updates, using the names/result shape fixed in the technical design.
- Resolve omitted create/update fields according to the design without inspecting Markdown syntax.
- Preserve exact stored source when normalized incoming/current strings are equivalent.
- Apply size validation only to new or changed pairs; require non-whitespace comment source without
  using trimmed text as the saved value.
- Return enough pair/change information for services to persist atomically and detect no-ops.
- Use safe field/limit validation details without echoing source.
- Add table-driven tests for normalization, omission, changed format, empty descriptions/comments,
  limits, surrogate pairs, and grandfathered records.

Out of scope: schema changes, endpoint activation, required response fields, rendering, and editor UI.

Acceptance criteria:

- New shared exports compile without changing existing request/response shapes.
- Exact normalized-limit boundaries and unchanged legacy exceptions have tests.
- A format-only conversion of oversized normalized source fails; a legacy no-op remains unchanged.
- The policy does not trim indentation, rewrite old CRLF, or infer a format.

Suggested checks:

```sh
npm run lint --workspace @worktrail/contracts
npm run typecheck --workspace @worktrail/contracts
npm run test --workspace @worktrail/contracts
npm run lint --workspace @worktrail/api
npm run typecheck --workspace @worktrail/api
npm run test --workspace @worktrail/api
git diff --check
```

Status: Complete (October 11, 2026).

### Completion Evidence

- Added the finite `AuthoredContentFormat` vocabulary, 10,000 UTF-16-unit limit, and pure line-ending
  normalizer in `packages/contracts/src/authored-content.ts`, exported through the package entry point.
- Added `resolveNewAuthoredContent` and `resolveUpdatedAuthoredContent` in the API domain policy.
  Results carry source, format, and change status; helpers require explicit description/body validation
  context. Authorization and locking remain the caller's responsibility for Phases 3-4.
- New/changed pairs normalize CRLF/lone CR without trimming. Equivalent updates preserve exact stored
  bytes and bypass new validation, including oversized or blank legacy records. Format conversions
  validate normalized source; a conversion cannot grandfather oversized normalized content.
- Validation errors retain the existing `400 VALIDATION_ERROR` envelope and report safe field/reason/
  limit metadata without submitted content. No parser, persistence, endpoint, or editor dependency
  was introduced, and existing request/response contracts remain unchanged.
- Added 8 contract tests and 42 policy tests covering defaults, omission, both formats, whitespace,
  normalized equivalence, pair changes, legacy exceptions, exact size boundaries, surrogate pairs,
  multibyte characters, input immutability, and safe errors.

Verification passed:

```sh
npm run lint --workspace @worktrail/contracts
npm run typecheck --workspace @worktrail/contracts
npm run test --workspace @worktrail/contracts
npm run build:contracts
npm run lint --workspace @worktrail/api
npm run typecheck --workspace @worktrail/api
npm run test --workspace @worktrail/api -- tests/authored-content-policy.test.ts
npm run build:api
npm run typecheck --workspace @worktrail/web
git diff --check
```

The contracts suite passed all 50 tests across 12 files. Additional API regressions passed all 231
tests across 26 database-independent files, including the new policy and mocked startup suites.
That regression invocation explicitly excluded the 24 PostgreSQL-backed suites and used an
unavailable test-only database target (`127.0.0.1:1/worktrail_v029_verify`) to prevent accidental
connections to working data. Angular's typecheck command completed its development build.

Verification limitation: the full PostgreSQL-backed API suite was not run. Read-only local metadata
checks confirmed that only the working `worktrail` database exists and the `worktrail` role lacks
`CREATEDB`; Docker's daemon is stopped and no local PostgreSQL server tools are available to provision
an independent instance. No database, schema, migration, seed, or working attachment data changed.
Before Phase 2 database checks, provision `worktrail_v029_verify` owned by `worktrail` or make Docker
available, then migrate the isolated target before running the full API suite. The new Phase 1 helpers
are not yet wired into production writes.

The deferred full PostgreSQL regression check was completed against isolated resources in Phase 2;
see the completion evidence below.

## Phase 2: Persistence, Format-Aware Reads, And Migration Compatibility

Goal: retain explicit formats in PostgreSQL and expose authoritative formats on existing read paths.

Dependencies: Phase 1.

Scope:

- Add typed `description_format` and `body_format` columns with `plain_text` defaults and finite
  check constraints using existing Drizzle conventions.
- Generate the next migration and metadata; do not edit older migrations or add source-length checks.
- Extend repository creation/update input types to carry format, retaining database-default support
  for omitted insert fields where current fixtures rely on it.
- Add required `descriptionFormat` to `WorkItemDetailDto` and `bodyFormat` to `CommentDto`.
- Map real database values through detail and standalone comment reads; keep paged list DTOs unchanged.
- Update matching OpenAPI response schemas in this phase; activate write-format schemas only with
  the corresponding service/endpoint behavior in Phases 3-4.
- Keep deleted comment source suppressed and present tombstones with plain-text format.
- Update in-memory fixtures, response builders, API tests, and Angular DTO literals together so all
  packages compile. Preserve format on cloned/updated in-memory records as well as inserted ones.
- Verify upgrade from pre-column records with literal Markdown-looking text, CRLF, oversized source,
  soft-deleted comments, ownership, mention rows, timestamps, and existing snapshots.
- Verify fresh migration application and database enum/default behavior in disposable PostgreSQL.

Out of scope: public format-write activation, CSV preview expansion, authored-content UI, or content
conversion/backfill. Existing source writes still use their current behavior until Phases 3-4.

Acceptance criteria:

- Existing rows acquire plain-text semantics without source/timestamp/activity changes.
- Both comment DTO paths agree, including tombstones.
- New columns and constraints work on fresh and upgraded schemas.
- Read contracts use persisted values, not hardcoded format placeholders.
- All packages compile after fixture propagation; snapshots and list payloads remain unchanged.

Suggested checks:

```sh
npm run db:generate
npm run db:migrate
npm run lint
npm run typecheck
npm test
git diff --check
```

Run migration commands only after selecting the disposable verification database. Record upgrade
fixture comparisons separately from fresh-database migration evidence.

Status: Complete (October 11, 2026).

### Completion Evidence

- Generated `0019_nosy_junta.sql`, its snapshot, and journal entry through Drizzle. The snapshot links
  to `0018` and adds only `comments.body_format`, `work_items.description_format`, and their finite
  checks. Both columns are non-null with `plain_text` defaults; no source-length constraint or backfill
  rewrites historical source.
- Extended inferred insert/select models and repository update inputs. Inserts may omit format and
  use the database default; repository updates can carry explicit formats or preserve omitted ones.
- Added required read-format fields to shared detail/comment DTOs and OpenAPI response schemas.
  Central mappers return persisted formats; deleted comments return empty source with `plain_text`
  without changing their retained database source or format. List payloads remain unchanged.
- Propagated required fields through contract, API model, and Angular fixtures. Fixture factories
  accepting partial records preserve explicitly supplied formats rather than overwriting them.
- Added an API regression covering defaulted and explicit formats, both comment read paths,
  tombstones, repository updates, and absent source/format fields on lists.
- Added PostgreSQL migration tests that replay the real historical chain into unique transactional
  schemas, retargeting generated foreign-key schema qualifiers for isolation. The upgrade case inserts
  records before `0019` and compares every original field after migration: Markdown-looking literals,
  CRLF, oversized text, edited/deleted comments, ownership, mentions, activity, and stored report/
  closeout JSON remain unchanged. The fresh case verifies defaults, both allowed formats, and rejected
  unknown/null values. Rollback removes each isolated schema; no leftover test schemas remained.

Verification passed:

```sh
npm run build:contracts
npm run db:generate
npm run db:migrate
npm run db:seed
npm run lint
npm run typecheck
node_modules/.bin/tsc -p apps/web/tsconfig.spec.json --noEmit
npm run test --workspace @worktrail/api -- tests/authored-content-migration.test.ts tests/comments-activity.test.ts
npm test
npm run build
git diff --check
```

Database commands and the full test suite used explicitly scoped environment variables targeting
PostgreSQL `16.14` in a disposable `postgres:16-alpine` container, database `worktrail_v029_verify`,
published only on `127.0.0.1:58064`. Attachment storage used a unique temporary root outside the working
attachment directory. Fresh migration application, seed, and a repeat migration invocation succeeded;
the migration journal contained all 20 entries through `0019`.

All 994 workspace tests passed: API 522 across 51 files, Angular 421, and contracts 51 across 12 files.
This includes the PostgreSQL suites deferred in Phase 1. The production build completed without budget
warnings (initial bundle 379.41 kB). The disposable container and temporary attachment root were
removed after verification; the user's existing database, attachment root, and server processes were
not modified.

No request-format fields, source-write policy activation, CSV preview changes, or authored-content UI
were added. Phases 3-4 activate the corresponding writes. Before starting this version against the
user's local database, apply the additive migration with `npm run db:migrate` against that target.

## Phase 3: Work-Item Description Writes And Activity

Goal: implement backward-compatible, state-aware description/format updates through existing APIs.

Dependencies: Phase 2.

Scope:

- Add optional `descriptionFormat` to create/update request contracts and endpoint schemas.
- Remove source `.trim()` at work-item endpoints; leave unrelated metadata trimming intact.
- Apply Phase 1 policy in both ordinary creation and `createWorkItemWithRepositories` so direct
  creation paths cannot bypass validation.
- Resolve content-bearing updates against the current authorized row under the existing transaction
  and single-item repository locking support.
- Persist source/format together and preserve omitted-format semantics.
- Add whole-request no-op detection across supplied scalar fields and order-independent label sets.
- Do not update `updatedAt`, replace labels, or emit activity/notifications for full no-ops.
- Record one pair-aware `work_item.description_changed` event, including format in previous/new
  values and a clear format-only summary.
- Keep real assignee updates and their notifications working when description is unchanged.
- Update the corresponding OpenAPI schemas, examples, omission/legacy rules, and safe errors.
- Add endpoint/service tests plus PostgreSQL evidence for serialized format resolution and no-op
  behavior, using existing fixture cleanup patterns and CI PostgreSQL support.

Acceptance criteria:

- Old create/update requests remain valid with the specified plain-text/preserve-current behavior.
- Source whitespace survives API writes and all size/legacy exceptions are enforced server-side.
- Format-only updates work and unknown/null formats fail safely.
- Pair changes produce one event; full no-ops preserve timestamps and side-effect counts.
- A concurrent omitted-format update resolves against the locked current format, not stale state.
- Tenant, inactive-member, archived-project, and real assignment-change regression tests pass.

Suggested checks:

```sh
npm run test --workspace @worktrail/contracts
npm run test --workspace @worktrail/api -- work-items
npm run test --workspace @worktrail/api -- notifications-watchers
npm run test --workspace @worktrail/api -- openapi
npm run lint --workspace @worktrail/api
npm run typecheck --workspace @worktrail/api
npm run typecheck --workspace @worktrail/web
git diff --check
```

Run the newly added PostgreSQL write/concurrency cases as well as these existing suites; do not count
skipped integration cases as passing evidence.

Status: Complete (October 11, 2026).

### Completion Evidence

- Added optional `descriptionFormat` to create/update contracts, endpoint schemas, and OpenAPI.
  Omitted create formats default to plain text; omitted update formats preserve the current stored
  format. Format-only PATCH requests are valid; unknown/null formats and non-string source fail
  validation. Existing title trimming remains unchanged.
- Activated the shared source policy in `createWorkItemWithRepositories`, covering ordinary and
  direct/CSV creation. New source normalizes line endings without trimming and enforces the 10,000
  UTF-16 code-unit limit before numbering or creation side effects.
- PATCH now checks workspace ownership before locking and rechecks the locked record's ownership
  and project writability before resolving or writing content. Source/format changes use one update
  within the existing transaction. Unchanged oversized legacy source and historical bytes survive
  no-ops and unrelated edits; oversized format conversion requires shortening in the same request.
- Complete no-ops compare every supplied scalar field and deduplicated, order-independent label
  sets. They preserve timestamps, work-item and label row versions, activity, and notifications.
  Unchanged label sets also avoid replacement when another field genuinely changes.
- Description pair changes produce one `work_item.description_changed` event with both source and
  format in previous/new values. Format-only changes use `Description format changed.` Genuine
  assignee changes still notify, even alongside unchanged oversized descriptions.
- Added endpoint, direct-service, contract, and OpenAPI regressions. PostgreSQL concurrency tests
  reuse the work-item suite's fixtures and cleanup. They hold the first writer's transaction and
  observe the second writer waiting through `pg_blocking_pids` before releasing it: omitted format
  uses the newly committed pair, and an equivalent queued edit becomes a no-op without a second event
  or timestamp update. Both cases passed again in a separate focused invocation.
- OpenAPI includes plain-text, Markdown, legacy-update, and format-conversion examples, safe size
  error details, normalization and no-op rules, without adding false maximums to historical reads.
  The reference parsed successfully as OpenAPI 3.1.0 using the installed `js-yaml` parser.

Verification passed:

```sh
npm run build:contracts
npm run db:migrate
npm run db:seed
npm run test --workspace @worktrail/api -- work-items notifications-watchers openapi
npm run lint
npm run typecheck
npm test
npm run build
npm run test --workspace @worktrail/api
npm run test --workspace @worktrail/api -- work-items --testNamePattern='queued|locked current row'
npm run lint --workspace @worktrail/api
npm run typecheck --workspace @worktrail/api
npm run build:api
git diff --check
```

Database commands and tests used explicit environment variables selecting disposable PostgreSQL
`16.14`, database `worktrail_v029_verify`, published only on `127.0.0.1:59324`, plus a unique temporary
attachment root. All 1,019 workspace tests passed: API 546 across 51 files, Angular 421, and contracts
52 across 12 files. The final full API rerun includes two additional legacy/empty-source regressions
added after the workspace run. The focused concurrency rerun passed both selected tests; its other
103 filtered tests were covered by the full API run and are not counted as additional passes.

Lint, typecheck, and production builds passed without budget warnings (initial bundle 379.41 kB).
Fixture cleanup left no work-item test workspaces. The phase-owned container and temporary attachment
root were removed; the user's database, attachment root, and existing processes were not modified.
No additional migration, comment-write activation, CSV-format support, UI integration, or release
metadata change was required. Phase 4 remains next.

## Phase 4: Comment Writes, Locks, And Mention Compatibility

Goal: make comment format changes atomic and auditable without altering recipients or deleted records.

Dependencies: Phase 3.

Scope:

- Add optional `bodyFormat` to create/update comment requests while keeping update body required.
- Remove endpoint source trimming and apply shared create/update policy in `CommentService`.
- Extend the repository's body update to write source and format atomically; use a content-oriented
  method name where it clarifies the operation.
- Add a locked current-comment read for edit/delete within existing write transactions.
- Recheck ownership, modification permission, project writability, and deletion state after the lock.
- Preserve timestamps and edited state on no-op edits and create no new activity.
- Record one `comment.edited` event for changed pairs; include format-change metadata without adding
  full comment bodies to history.
- Leave mention rows untouched during edit/conversion and never resend creation notifications.
- Preserve creation-time explicit mention validation and mention/watcher deduplication.
- Update comment OpenAPI schemas and examples without applying false maximums to historical responses.
- Add service/endpoint tests and deterministic PostgreSQL edit/delete and format-resolution evidence.

Acceptance criteria:

- Plain-text defaults and omitted-update preservation match work-item content semantics.
- Edited/deleted DTO state remains correct through both read paths.
- No-op edits preserve `editedAt`, `updatedAt`, activity, mentions, and notification counts.
- A queued edit cannot modify a comment already deleted by a competing transaction.
- Formatting syntax never adds recipients; authorized conversions produce one edit event only.
- Tenant, inactive-member, archived-project, and role permission checks remain enforced.

Suggested checks:

```sh
npm run test --workspace @worktrail/contracts
npm run test --workspace @worktrail/api -- comments-activity
npm run test --workspace @worktrail/api -- notifications-watchers
npm run test --workspace @worktrail/api -- openapi
npm run lint --workspace @worktrail/api
npm run typecheck --workspace @worktrail/api
npm run typecheck --workspace @worktrail/web
git diff --check
```

Run the new PostgreSQL comment-locking cases explicitly and record their cleanup and outcomes.

Status: Complete (October 12, 2026).

### Completion Evidence

- Added optional `bodyFormat` to create/update contracts and endpoint schemas while retaining required
  update body. Omitted create format means plain text; omitted edit format preserves the current
  locked value. Unknown/null formats and missing/non-string body fail endpoint validation.
- Removed comment source trimming and activated the shared write policy in `CommentService` for
  endpoint and direct-service calls. New/changed pairs normalize CRLF/lone CR to LF without trimming,
  require non-whitespace source, and enforce 10,000 normalized UTF-16 code units. Unchanged legacy
  blank/oversized pairs and historical bytes remain valid; conversion requires valid source.
- Added `findByIdForUpdate` and renamed `updateBody` to `updateContent`, updating all callers.
  Edit/delete precheck workspace ownership, lock the current comment within the existing transaction,
  and recheck ownership, deletion state, author/role permission, and project writability. Edits persist
  source, format, and both edit timestamps together.
- Equivalent edits return the existing DTO without updating row versions, timestamps, or edited state,
  and without new activity or notifications. Real pair changes create one `comment.edited` event.
  Conversions add `previousBodyFormat`/`newBodyFormat` metadata; format-only changes use
  `Comment format changed.` Activity still contains no comment source.
- Mention rows stay unchanged through conversion, real edits, and no-ops. Creation still validates
  explicit mentions and deduplicates mention/watcher recipients; Markdown syntax never adds recipients.
  Editing does not rerun creation notifications or accept new mention recipients.
- Added API, direct-service, contract, and OpenAPI regressions for boundaries, legacy exceptions,
  whitespace, permissions, inactive actors, mentions, notification counts, both comment read paths,
  and tombstones. A simulated activity-write failure verifies transactional rollback of the pair and
  edit timestamps.
- Added five PostgreSQL concurrency cases using existing comment fixtures and transaction helpers.
  Each observes a real `pg_blocking_pids` lock wait before releasing the first writer. They verify
  omitted-format resolution, queued equivalent-edit no-ops, rejection of edit and repeat delete after
  a competing deletion, and deletion retaining a competing edit's source/format/edit timestamp.
  Both API read paths suppress deleted source and return plain-text tombstones.
- Updated OpenAPI write schemas, examples, legacy/no-op rules, safe policy errors, lifecycle conflicts,
  and format-change metadata without imposing a false length limit on historical response source.
  The reference parsed successfully as OpenAPI 3.1.0 using the installed `js-yaml` parser.

Verification passed:

```sh
npm run build:contracts
npm run db:migrate
npm run db:seed
npm run test --workspace @worktrail/api -- comments-activity notifications-watchers openapi
npm run lint
npm run typecheck
npm test
npm run build
npm run test --workspace @worktrail/api
npm run test --workspace @worktrail/api -- comments-activity --testNamePattern='queued'
npm run lint --workspace @worktrail/api
npm run typecheck --workspace @worktrail/api
git diff --check
```

Database commands and tests used explicit environment variables selecting disposable PostgreSQL
`16.14`, database `worktrail_v029_verify`, published only on `127.0.0.1:62074`, plus a unique temporary
attachment root. All 1,050 workspace tests passed: API 576 across 51 files, Angular 421, and contracts
53 across 12 files. The final full API rerun includes the rollback regression added after the workspace
run. All five selected concurrency cases passed again separately; the 37 filtered comment cases were
covered by the full API suite and are not counted as additional passes.

Lint, typecheck, and production build passed without budget warnings (initial bundle 379.41 kB).
Fixture cleanup left no comment test workspaces. The phase-owned container and temporary storage were
removed; the user's database, attachments, and existing processes were not modified. No migration,
CSV-format changes, authored-content UI integration, or release metadata changes were needed.
Phase 5 remains next.

## Phase 5: CSV Import And Format-Aware Preview

Goal: import formatted descriptions without losing whitespace or changing existing export contracts.

Dependencies: Phase 4.

Scope:

- Accept optional `description_format`; missing/blank values mean plain text, invalid values produce
  row-specific preview errors and block apply.
- Add an opt-in whitespace-preserving parser mode for work-item import, retaining existing defaults
  for other CSV parser consumers.
- Read description cells without the general metadata trimmer and use shared source normalization.
- Keep normalization of titles, email, enums, labels, dates, and format metadata in existing helpers.
- Apply normalized description length validation, retaining raw-cell limits for other fields and the
  current CSV byte/row bounds.
- Carry source and format through normalized rows into the now format-aware creation service.
- Add required `descriptionFormat` and bounded `descriptionExcerpt` to import preview contracts.
- Return at most 240 UTF-16 units including the truncation marker without splitting surrogate pairs.
- Update the Angular preview with compact format metadata and an expandable escaped source excerpt;
  do not import the Markdown renderer into the import page.
- Keep preview/apply on the same validation pipeline with current apply-time revalidation and
  transactional behavior.
- Update relevant OpenAPI contracts and import tests; assert exact existing export headers and limits.

Acceptance criteria:

- Existing files without format metadata still import as plain text.
- Quoted multiline source, code indentation, commas, and quotes survive preview/apply correctly.
- Blank/invalid formats and normalized source boundaries behave consistently.
- Preview is bounded escaped text, not active content or complete-body enrichment.
- Apply preserves atomicity and existing reporter/identity behavior.
- Project/workspace CSV exports remain unchanged.

Suggested checks:

```sh
npm run test --workspace @worktrail/contracts
npm run test --workspace @worktrail/api -- csv
npm run test --workspace @worktrail/api -- openapi
npm run test --workspace @worktrail/web
npm run lint
npm run typecheck
git diff --check
```

Status: Complete (October 12, 2026).

### Completion Evidence

- Added optional `description_format` import metadata using the shared finite format vocabulary.
  Missing/blank values default to plain text; explicit metadata is trimmed. Unknown values produce
  row-specific preview errors and prevent the entire apply operation.
- Added opt-in whitespace preservation to `parseCsvRecords`; existing callers retain parser trimming.
  Import reads description cells directly, normalizes line endings through the shared helper, and
  validates the normalized 10,000 UTF-16 code-unit limit. Other cells retain their raw limit and
  metadata normalization. Quoted newlines, indentation, commas, and quotes survive preview/apply.
- Carried source and format through normalized rows into `createWorkItemWithRepositories` without
  changing apply-time reference revalidation, identity allocation, reporter selection, or transaction
  boundaries. The rollback regression now includes explicit formatted rows.
- Added required preview `descriptionFormat` and `descriptionExcerpt` contract/OpenAPI fields.
  Excerpts contain at most 240 UTF-16 units, including trailing ASCII `...` when truncated, and never
  split a surrogate pair. Preview rows still omit full descriptions.
- Added a compact format column and native keyboard-accessible source disclosures to the Angular
  preview. Interpolation displays escaped source with preserved whitespace and wrapping; no Markdown
  renderer, HTML insertion, or new dependency was introduced. Empty descriptions have no disclosure.
- Added parser, service, endpoint, contract, OpenAPI, and Angular regressions for format defaults,
  invalid metadata, normalized boundaries, oversized raw metadata, bounded excerpts, and inert source.
  Apply revalidation is verified by deactivating a referenced reporter after a valid preview.
- Asserted exact project/workspace summary export headers and the unchanged 10,000-row export limit.
  Existing bounded-read and overflow tests remain passing; descriptions and formats are not exported.
- Extended the existing Playwright CSV import/export workflow with formatted multiline source,
  blank-format compatibility, keyboard expansion/collapse, literal HTML-looking text, bounded excerpts,
  and exact exported headers. Desktop (1440 x 900) and mobile (390 x 844) screenshots were inspected;
  neither viewport had page-level horizontal overflow. The preview table keeps its existing local
  horizontal scrolling on small screens.

Verification passed:

```sh
npm run build:contracts
npm run db:migrate
npm run db:seed
npm run lint
npm run typecheck
node_modules/.bin/tsc -p apps/web/tsconfig.spec.json --noEmit
npm test
npm run build
npm run test --workspace @worktrail/api -- csv openapi
npm run test:e2e -- --grep 'imports project work items from CSV and exports filtered results'
npm run lint --workspace @worktrail/api
npm run typecheck --workspace @worktrail/api
git diff --check
```

All 1,078 package tests passed: API 600 across 51 files, Angular 424, and contracts 54 across 12 files.
The focused CSV/OpenAPI rerun passed all 46 tests across four files, including the formatted rollback
case. The selected Chromium import/export workflow also passed. OpenAPI parsed successfully with the
installed `js-yaml` parser; required preview fields and the excerpt bound were checked structurally.
Lint, typecheck, and production build passed without budget warnings (initial bundle 379.41 kB).

Database commands and tests explicitly targeted disposable PostgreSQL `16.14`, database
`worktrail_v029_verify`, published only on `127.0.0.1:64906`, and unique temporary attachment storage.
Playwright reset/migrate/seed and teardown used that same isolated target, with a nested E2E storage
root and `WORKTRAIL_E2E_SKIP_DB_RESTORE=true`. Its API/web servers used ports 3000/4315 after confirming
both were free. The harness stopped both servers; fixture cleanup left no CSV test workspaces, and
the phase-owned container and temporary storage were removed. The user's database, attachments, and
existing processes were not modified. Screenshots remain in the ignored `test-results` output.

No additional migration, export schema change, renderer dependency, or release metadata change was
needed. Phase 6 remains next.

## Phase 6: Markdown Projection And Safe Angular Viewer

Goal: establish the complete presentation/security boundary before exposing Markdown authoring.

Dependencies: Phase 5.

Scope:

- Add exact `markdown-it@15.0.2` to the web workspace and update the lockfile without release-version
  churn. Verify its declarations, ESM import, license, dependency audit, and production build.
- Clear pre-existing production audit findings through compatible dependency patches, keeping one
  Angular runtime and validating the installed/locked dependency tree. Avoid unrelated upgrades.
- Add focused authored-content value/document/parser/link modules and a standalone Angular viewer.
- Configure CommonMark explicitly with HTML disabled, visible breaks, no linkify/typographer/plugins,
  nesting 16, and horizontal-rule support disabled.
- Map allowed tokens into finite block/inline nodes; do not call the parser's HTML renderer.
- Implement tight/loose lists, semantic heading remapping, literal code, visible breaks, image-alt
  text fallback, and safe handling of unsupported/incomplete syntax.
- Implement the shared explicit HTTP(S) URL policy, including control/backslash/credential rejection,
  length limits, and defensive external-link attributes.
- Enforce 10,000 normalized parse units, 8,000 tokens, 4,000 nodes, depth 32, and 64,000 aggregate
  projected text/URL units as specified in the design.
- Fall back to complete escaped source on unknown formats, parse errors, unexpected token structure,
  or projection limits; do not truncate or partially hide context.
- Use static recursive Angular templates, interpolation, ordinary URL bindings, and focused styles.
- Test the full supported profile and adversarial HTML/URL/image/malformed-input corpus.
- Add deterministic DOM tests proving forbidden elements/attributes cannot appear, not merely that
  a particular script failed to execute.

Acceptance criteria:

- Preview-ready viewer renders both formats and safe fallback consistently without mutating source.
- No `innerHTML`, `SafeHtml`, bypass API, arbitrary tag/attribute node, or remote asset path exists.
- Plain text is never parsed; long legacy source remains complete and readable.
- Every projection limit and rejected URL category has a focused test.
- Dependency audit and production build pass; parser dependencies have no root-shell import path.

Suggested checks:

```sh
npm run lint --workspace @worktrail/web
npm run typecheck --workspace @worktrail/web
npm run test --workspace @worktrail/web
npm run build:web
npm audit --omit=dev --audit-level=low
git diff --check
```

Status: Complete on October 12, 2026.

Completion evidence:

- Added exact web-only `markdown-it@15.0.2`, using its bundled declarations and ESM entry point with
  MIT package licensing. No wrapper, plugin, separate typings package, or root-shell import was added.
- Added focused value/document/link/parser modules and an OnPush standalone viewer with static
  recursive Angular templates. Finite nodes cover paragraphs, subordinate headings, quotes, tight
  and loose lists, literal code, emphasis, visible breaks, and validated links. Images become plain
  alt text (or `Image`); fence metadata and arbitrary token attributes never enter the rendered DOM.
- Fixed the CommonMark configuration at HTML off, breaks on, linkify/typographer off, nesting 16,
  and horizontal rules disabled. Each parse has a fresh reference environment; neither parser HTML
  rendering API is used. Unsupported syntax stays readable without active controls.
- Applied the shared explicit HTTP(S) policy before parser link acceptance and again during
  projection. Controls, backslashes, missing/malformed authorities, credentials, unsafe/relative
  schemes, and oversized input/serialized URLs are rejected. Same-origin links retain native
  same-tab behavior; external links use `_blank`, `noopener noreferrer`, and no-referrer policy.
- Enforced normalized 10,000-unit input, 8,000 inspected tokens including inline/image children,
  4,000 constructed nodes, depth 32, and 64,000 projected text/URL units. Unknown formats, malformed
  token structure, parse errors, and limit failures render the complete original escaped source.
  Plain text is never parsed, including oversized legacy records.
- Added a conservative nesting-ceiling guard after a real parser fixture demonstrated that extreme
  block nesting could otherwise drop trailing source. The technical design now explicitly records
  whole-source fallback for block openers at level 15 or higher.
- Kept long text/links wrapped and code horizontally contained. Code regions receive a labeled
  keyboard focus target only when overflowing, with resize observation and destruction cleanup.
- Added 92 focused parser/link/viewer cases. Coverage includes all presentation bounds, reference
  expansion, normalized/UTF-16 boundaries, renderer non-use, malformed tokens, parser failures,
  unknown formats, source preservation, forbidden DOM tags/attributes, safe external links, image
  fallback, input-change memoization, and 320 px containment/keyboard focus. The full supported
  profile and hostile HTML, entity, URL, image, and incomplete-syntax fixtures run in ChromeHeadless.
- The production audit initially reported nine pre-existing vulnerable package entries. Updated
  Angular runtime/compiler packages and compiler CLI from `20.3.25` to `20.3.33`, `csv-parse` from
  `7.0.1` to `7.0.3`, `proxy-addr` from `2.0.7` to `2.0.8`, and `qs` from `6.15.3` to `6.16.0`.
  Karma's private `body-parser` moved from `1.20.5` to `1.20.8` to accept the patched `qs` line.
  No major framework upgrade, persistent override, unrelated dependency update, or release-version
  change remains. Clean `npm ci --ignore-scripts` and targeted `npm ls` pass with one Angular runtime.
- Final `npm audit --omit=dev --audit-level=low` passes with zero vulnerabilities. The dev-inclusive
  audit still reports 34 toolchain findings; that broader development-dependency work is not a claim
  of this phase's production audit result.
- Final verification passed: root `npm run lint`, `npm run typecheck`, `npm test` (600 API, 516 Angular,
  54 contracts; 1,170 total), explicit web spec TypeScript checking, root `npm run build`, and
  `git diff --check`. The production initial bundle is 383.01 kB with unchanged budgets and no warnings.
  Production stats and source-import review confirm that parser JavaScript has no application/root
  import path yet. Viewer/editor route wiring remains in Phases 7-9.
- Pure parse/projection measurements used an in-memory bundle, 20 warm-up iterations, and 100
  measured iterations per fixture on Node 20.19.1. The ordinary 10,000-unit fixture had median
  1.633 ms, p95 1.863 ms, and maximum 2.404 ms. Adversarial delimiter/bracket samples stayed below
  3.823 ms; deep-quote/reference-expansion fallback samples stayed below 0.438 ms. These local samples
  measure parsing/projection only, not Angular rendering or a universal timing guarantee.
- Re-ran the existing Chromium CSV import/export workflow after dependency patches: one test passed,
  including its desktop/mobile containment checks. This is regression evidence, not a claim that
  description/comment viewer integration has shipped or that its Phase 10 browser review is done.
- Database regression checks used only a phase-owned PostgreSQL 16 Docker container bound to
  `127.0.0.1:54386`, plus disposable attachment storage for browser setup. Migration/seed/reset
  operations targeted that isolated database. Phase-owned servers, container, and storage were
  removed after verification; the user's database on 5432 was not touched.

## Phase 7: Shared Authoring Control And Formatting Commands

Goal: provide reliable source editing and faithful preview independently of page integration.

Dependencies: Phase 6.

Scope:

- Implement a standalone compound `ControlValueAccessor` for `{ source, format }`.
- Add labeled textarea/format controls, compact Edit/Preview modes, normalized source count, and
  external error associations.
- Respect write/change/touched/disabled semantics; Preview changes never mark source dirty or emit
  content changes.
- Add parent-usable baseline-aware validators for source limits and non-whitespace comments.
- Avoid unconditional native maximums that break oversized legacy editing.
- Add pure selection-edit commands for emphasis, headings, lists, quotes, inline code, fences, and
  descriptive links, preserving source outside the affected region.
- Handle embedded delimiters, escaped labels/destinations, multiline ranges, and surrogate pairs.
- Use Lucide icon buttons with names/tooltips and `type="button"`; wrap controls at narrow widths.
- Implement inline URL insertion with captured selection, shared URL validation, Escape/cancel,
  insertion selection, and focus restoration.
- Use the Phase 6 viewer for Preview; do not parse hidden preview content on every Edit keystroke.
- Implement IME composition guards, reset identity, local state clearing, and disabled controls.
- Test selection/focus and native typing undo behavior; do not add a custom editor history engine.
- Add a database-independent Angular browser fixture and CI check for trusted keyboard input,
  native undo/redo, and responsive layouts. Do not introduce a production test route.

Acceptance criteria:

- A parent reactive form can read/write/reset/disable the compound control correctly.
- Source and format changes are explicit; tab switches preserve data and form state.
- Formatting/link actions cannot accidentally submit the parent form or lose unrelated source.
- Preview matches the standalone viewer, uses no API, and makes no remote request.
- Keyboard, selection, validation, and narrow-layout component tests pass.

Suggested checks:

```sh
npm run lint --workspace @worktrail/web
npm run typecheck --workspace @worktrail/web
npm run test --workspace @worktrail/web
npm run test:editor
npm run build:web
git diff --check
```

The editor browser suite needs Playwright Chromium (`npx playwright install chromium` locally;
CI installs Chromium with its system dependencies). It defaults to loopback port 4317; set
`WORKTRAIL_EDITOR_TEST_PORT` to use another port. Unlike `test:e2e`, it does not reset or connect to a
database or attachment store.

Status: Complete on October 17, 2026.

Completion evidence:

- Added the standalone compound `AuthoredContentEditorComponent` with reactive-form CVA semantics,
  explicit Plain text/Markdown selection, Edit/Preview modes, normalized UTF-16 count, configurable
  label/id/rows/error associations, and disabled-state handling. New/null values use empty Markdown;
  loaded pairs retain exact source/format without inference or feedback emissions.
- Preview conditionally mounts the Phase 6 viewer. It does not parse Edit keystrokes, emit changes,
  mark source dirty, or replace the native textarea. Formatting/URL controls are buttons with Lucide
  icons, accessible names, native title tooltips, and fixed 34 px dimensions that wrap at narrow widths.
- Added `authoredContentEquals` and the parent-usable `authoredContentValidator`. Validation measures
  normalized UTF-16 source without trimming, optionally requires non-whitespace comments, accepts
  unchanged historical pairs (including oversized/blank source), and validates changed/conversion
  pairs against a copied baseline. No unconditional native `maxlength` was introduced.
- Added pure commands for bold/italic, ATX headings, bullet/numbered lists, quotes, inline code,
  fenced code, and descriptive links. Tests cover escaped delimiters, preserved boundary whitespace,
  multiline ranges, CRLF/lone-CR boundaries, safe fence lengths/padding, destination parentheses,
  selection placeholders, clamped/reversed ranges, and intact surrogate pairs.
- Source edits use native range/selection APIs and update both form fields together. Native input
  events are not followed by redundant value assignment, preserving browser typing undo. Parent
  writes and reset identities clear local preview/link/composition state and replace the textarea;
  revision checks prevent stale DOM events or reset-induced blur from changing the next context.
- Link insertion captures the source selection before URL focus, shares the viewer's explicit HTTP(S)
  policy, validates locally, and restores focus/selection on insert or cancel. Enter, Escape, and
  native action-button activation do not submit the parent form. The temporary URL uses text input
  with URL keyboard hints, so unfinished URL syntax does not block parent form submission. IME
  guards cover both source and URL input without disabling the actively composing field.
- Added 83 focused validation/command/editor unit cases; the authored-content suite now has 175
  cases. The full Angular suite passes with 599 tests, including existing page regressions.
- Added `npm run test:editor`, a dedicated Playwright configuration, and an Angular AOT fixture under
  `apps/web/browser-tests/authored-content-editor`. The loopback server reuses the web compiler and
  build-tool dependencies, compiles into an owned temporary directory, and removes outputs on exit.
  No application route, API, database, attachment store, or new dependency is involved.
- All three Chromium browser tests pass. Trusted input verifies native undo/redo across Preview
  and after a formatting command, with parent-model synchronization. Keyboard link cancellation and
  insertion preserve selection; format conversion, reset, disabled state, and zero accidental
  submissions are covered. These are native typing checks, not a custom cross-command history claim.
- Browser layout checks at 1440, 390, and 320 px pass without horizontal page overflow or remote
  requests. Edit/link-entry and Preview screenshots were visually reviewed; evidence is generated
  under ignored `test-results/editor`. CI now installs Chromium and runs this independent suite.
- Final checks passed: root `npm run lint`, root `npm run typecheck`, explicit web-spec TypeScript
  checking, full web tests, `npm run test:editor`, root `npm run build`, and `git diff --check`.
  Production initial size remains 383.01 kB with unchanged budgets and no warnings. Root-shell/page
  imports remain unchanged; feature integration is still reserved for Phases 8-9.
- No API/schema/release-version/dependency changes were made. Verification used no database or
  attachment resets. Phase-owned browser/Karma servers and compiler temporary directories were
  removed; the user's application processes and local data were not modified.

## Phase 8: Description Workflow Integration

Goal: expose structured descriptions through all existing creation and detail entry points.

Dependencies: Phase 7.

Scope:

- Replace description text controls with compound controls on global/project/child creation and
  detail editing; keep unrelated fields and project/parent defaults unchanged.
- Default new descriptions to empty Markdown and initialize existing edits from persisted source/format.
- Map pairs to request fields without source trimming or DOM-to-source conversion.
- Omit both description fields from detail PATCH when unchanged against its normalized baseline.
- Render summary descriptions through the shared viewer with a subordinate Description heading and
  the existing empty-description treatment.
- Add reset identities and generation/actor/item guards for affected detail loading and mutation
  callbacks so late responses cannot reset another item's editor.
- Preserve active drafts during unrelated attachment/activity refreshes and failed saves.
- Disable authoring under existing archived-project rules while keeping formatted read access.
- Keep controls/styles inside shared components and existing edit regions; do not redesign the whole
  detail page or add list/board formatting controls.
- Add Angular tests covering mappings, legacy conversion/cancel, oversized unchanged content, dirty
  baselines, route reuse, stale responses, and pending-state recovery.

Acceptance criteria:

- All creation entry points submit explicit formats and preserve whitespace.
- Existing descriptions remain literal until deliberately converted and saved.
- Unrelated edits do not rewrite source or format; failed saves retain the full draft.
- Description rendering remains subordinate to work-item identity/current-state information.
- Route reuse and actor changes cannot display or apply another context's draft/response.
- Archived mutation remains blocked and existing file/relationship/hierarchy workflows still pass.

Suggested checks:

```sh
npm run lint --workspace @worktrail/web
npm run typecheck --workspace @worktrail/web
npm run test --workspace @worktrail/web
npm run build:web
git diff --check
```

Add a focused browser smoke scenario using the disposable verification database once this workflow
is wired; broader browser evidence belongs to Phase 10.

Status: Complete (October 17, 2026).

Completion notes:

- Global, project, and child creation now use the shared compound editor and a validated empty
  Markdown default. Requests explicitly map source and format without trimming or line-ending
  conversion. Child creation keeps its independent planning defaults; failed creation retains the pair.
- Detail editing initializes from the exact persisted description pair. Baseline-aware validation
  permits unchanged oversized legacy content, rejects oversized conversions, and omits both fields
  from PATCH when their normalized pair is unchanged. A successful save adopts the returned pair as
  the next baseline. Discard changes restores the loaded fields, baseline, and editor presentation.
- Detail summary renders through the shared viewer after identity/current-state facts and labels,
  under a compact Description h2. Existing empty-description copy remains. Archived descriptions
  remain readable while source, format, and mutation controls are disabled.
- Item/actor changes reset the baseline, editor identity, and pending state. Context generations,
  captured item/actor identity, and destruction-bound subscriptions gate both successes and failures,
  including return to an earlier item/actor. A separate load generation rejects superseded same-item
  loads. Description fields and labels are disabled during save; duplicate saves are suppressed, and
  failed saves restore editing without discarding source, format, Preview, or dirty state.
- Attachment activity remains a narrow refresh. Discussion, relationships, parent changes, and
  status changes merge their relevant read state without resetting description/comment drafts or
  rewriting description baselines. An older status response cannot replace a newly saved description.
  Comment-specific editor/session behavior remains Phase 9 work.
- Added 22 Angular cases across creation and detail workflows. The full Angular suite passes with
  621 tests, including archived, attachment, relationship, hierarchy, watcher, and comment regressions.
- Added `e2e/authored-description.spec.ts`. Its real API/browser scenario verifies all creation entry
  points, exact source persistence, preview/saved rendering parity, unchanged PATCH omission,
  failed-save recovery, explicit conversion/discard, and linked-ticket route reuse. It passes with
  existing planning/adoption, dependency, and work-breakdown smoke scenarios (four application tests).
  Updated the existing child-creation selector to target the Description textbox rather than matching
  the editor's labeled groups. The independent shared-editor browser suite also passes (three tests).
- Description source, Preview, and summary screenshots at 1440, 390, and 320 px remain under ignored
  `test-results`; containment checks pass without page-level horizontal overflow.
- Root lint/typecheck/build, explicit web-spec TypeScript checking, and
  `git diff --check` pass. Production initial size is 386.62 kB with unchanged budgets and no warnings.
  Production stats place the parser/viewer/editor in a 131.73 kB lazy chunk, outside the initial graph.
- Browser verification used a phase-owned PostgreSQL 16 container on a random loopback port and
  isolated temporary attachment storage. No API/schema/dependency/release-version changes were made;
  local working data was not reset, migrated, or seeded. The phase-owned container, temporary
  attachment storage, editor compiler outputs, and test servers were removed after verification.
  Comment integration was left to Phase 9.

## Phase 9: Comment Workflow And Draft Lifecycle Integration

Goal: expose structured discussion without changing mention recipients or allowing stale callbacks to
discard newer work.

Dependencies: Phase 8.

Scope:

- Integrate compound controls into new/edit comment forms and the viewer into nondeleted comment rows.
- Default new comments to Markdown; preserve loaded format when editing an existing comment.
- Branch to deleted tombstones before mounting editor/viewer content.
- Preserve author/timestamps/edited markers, mention chips, modification checks, and delete confirmation.
- Keep member selection explicit and outside the shared editor.
- Preserve draft source/format and selected mentions after failed submission; reset them only after
  the matching successful operation or explicit cancellation/context change.
- Add comment-specific editor identities and generation/actor/item guards for mutation callbacks and
  subsequent refreshes; a canceled old edit must not close a new edit on the same route.
- Keep attachment/activity refreshes from resetting pending comment/description drafts.
- Disable archived authoring without affecting historical read access.
- Add Angular tests for conversion/no-ops, mention preservation, deletion, cancellation, resets,
  failed submissions, same-item successive edits, route reuse, and actor changes.

Acceptance criteria:

- Formatted comments can be created, previewed, read, and edited with original source intact.
- Plain-text and deleted comments retain their correct presentations.
- Typed `@name`, links, code, and keys never add recipients.
- Edits/conversions do not resend notifications or create duplicate activity.
- Late callbacks cannot clear a newer draft or refresh the wrong item/actor.
- Existing comments, watchers, mention controls, and archived permissions pass regression tests.

Suggested checks:

```sh
npm run test --workspace @worktrail/api -- comments-activity
npm run test --workspace @worktrail/api -- notifications-watchers
npm run lint --workspace @worktrail/web
npm run typecheck --workspace @worktrail/web
npm run test --workspace @worktrail/web
npm run build:web
git diff --check
```

Status: Complete (October 17, 2026).

Completion notes:

- New and inline-edited comments use compound `bodyContent` controls with the shared editor and
  viewer. New drafts default/reset to empty Markdown; editing loads the exact persisted pair. Write
  requests preserve source whitespace and explicitly send `bodyFormat`. Comment validation requires
  non-whitespace new/changed source, enforces the normalized length limit, and permits unchanged
  blank/oversized legacy pairs. Unchanged edits still reach the API's locked no-op policy.
- Deleted rows branch to tombstones before content/editor rendering, including retained-source
  fixtures. Author, timestamps, edited markers, mention chips, modification permissions, and explicit
  delete confirmation remain. Archived formatted discussion stays readable with authoring disabled.
- Mention selection remains outside the editor. Only selected member ids are sent on creation;
  typed names, links, code, and display keys add no recipients. Edits send source/format only, retaining
  existing mentions without resending notifications.
- Pending creation locks its source/format and mention controls; pending edits lock their own content
  control. Duplicate submissions are suppressed. Failures restore editing without resetting source,
  format, Preview, dirty state, or selected mentions. Matching successful creation resets only its
  composer and mentions; matching successful editing closes only its current edit session.
- Comment editor identities, create/delete generations, and the page's item/actor/context guards
  reject stale successes and failures, including cancellation followed by another edit of the same
  comment. Context changes clear drafts and pending state. Cancel ends the local session; it does
  not promise rollback of a request already accepted by the API.
- Successful writes update the visible comment/tombstone immediately, independently of their
  subsequent discussion/activity read. That read has its own generation and captured comment-session
  guards; it never resets authoring controls or pending flags. A separate read-error panel retries
  GET rather than replaying a successful write. Older field-save DTOs preserve current comment rows.
  Attachment, relationship, status, and detail-save workflows preserve unrelated authoring drafts.
- Added 30 Angular cases for formats, validation/no-ops, legacy conversion/cancel, mentions, failures,
  tombstones, archived access, independent drafts, successive edits, route/actor reuse, stale reads,
  and pending recovery. The full Angular suite passes with 651 tests. The existing PostgreSQL
  comment/activity and notification/watcher suites pass with 45 tests.
- Added two real API/browser comment scenarios in `e2e/authored-comments.spec.ts`. They verify source
  persistence, preview/display parity, CRUD, conversion/cancel, no-op activity/timestamps, mention and
  watcher deduplication, unchanged notification counts after edits, and failed-write recovery.
  Both pass alongside description integration, planning/adoption, and inbox mention smoke tests
  (five application scenarios). Existing selectors now target specific textboxes/editors because
  description and comment editors coexist. The independent editor browser suite also passes (three).
- Saved comment and edit-preview screenshots at 1440, 390, and 320 px were reviewed; containment
  checks pass without page-level horizontal overflow. Generated evidence remains in ignored
  `test-results`. Broader seed/security/accessibility evidence remains Phase 10 work.
- Root lint/typecheck/build, explicit web-spec TypeScript checking, and `git diff --check` pass.
  Production initial size remains 386.62 kB with unchanged budgets and no warnings; authored-content
  code remains lazy-loaded. No API/schema/dependency/release-version changes were needed.
- Database-backed checks used a phase-owned PostgreSQL 16 container on a random loopback port and
  isolated attachment storage. The user's local database and files were not reset, migrated, or
  seeded. Phase-owned services and temporary storage/compiler outputs were removed after checks.
  Phases 10-11 remain unstarted.

## Phase 10: Seed, Browser, Security, And Regression Evidence

Goal: prove the complete feature works safely across real workflows, representative content, and
supported viewports before release documentation is finalized.

Dependencies: Phase 9.

Scope:

- Add deterministic formatted requirement/reproduction/code/link seed examples while retaining plain
  text with Markdown-looking punctuation as a compatibility scenario.
- Include explicit mentions, edited/deleted comments, unsupported/unsafe literal source, and readable
  formatted archived context. Keep existing fixture ids and workflows stable where practical.
- Verify fresh migration plus repeated seed in disposable resources and upgrade preservation evidence.
- Add browser coverage for global/project/child creation, preview, save/reload/edit, conversion/cancel,
  comments with mentions, archived reads/denied writes, and multiline CSV imports.
- Intercept requests while opening/viewing/previewing malicious source and assert no automatic
  third-party asset requests or unexpected privileged API calls occur.
- Assert forbidden DOM nodes/attributes and unsafe links are absent while literal evidence remains
  readable, including fallback cases.
- Test keyboard-only authoring, selection restoration, tooltips, errors, link cancellation, IME-related
  behavior where automation is reliable, and ordinary typing undo; document manual checks honestly.
- Capture 320 px and 390 px mobile, laptop/desktop, and 200 percent zoom evidence. Confirm no page
  overflow; code scrolls only within its own region.
- Record parser/projection timing for ordinary maximum-size and adversarial cases separately from
  Angular rendering, against the design's under-50 ms / under-100 ms local evidence targets.
- Inspect production bundles and styles against unchanged budgets: initial 550 kB warning / 1 MB
  error, component styles 8 kB warning / 12 kB error. Prove parser code is outside the initial shell.
- Run the full existing browser suite and regress Quick Find/Files targeting, attachments, lists,
  saved views, board ordering, dependencies, hierarchy, planning, reports, and closeout snapshots.
- Verify compiled production preview and deep links using isolated resources, then stop phase-owned
  servers and clean only temporary verification data/artifacts.

Acceptance criteria:

- All targeted and existing browser scenarios pass without relying on retries to hide reproducible bugs.
- Security evidence covers both inert DOM and absence of automatic remote requests.
- Desktop/mobile/zoom and keyboard workflows have no unresolved overlap, focus, or overflow issue.
- Migration/seed/legacy/notification/snapshot regressions are covered and pass.
- Local timing evidence is recorded with environment details; misses are investigated, not hidden by
  turning targets into unsupported production claims.
- Initial/style budgets pass without warnings or threshold increases.
- No test fixture data or phase-owned serving process remains in the user's working resources.

Suggested checks:

```sh
npm run db:migrate
npm run db:seed
npm run db:seed
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
npm run test:editor
npm audit --omit=dev --audit-level=low
git diff --check
```

Use the disposable database and isolated storage for database-backed commands, including `test:e2e`;
`test:editor` uses only its standalone fixture. The
production-preview command and nondefault ports should be recorded with their actual runtime setup
rather than assumed to be free.

Status: Complete (October 17, 2026).

Completion notes:

- Added repeatable formatted requirements, reproduction, code, explicit-mention, legacy literal,
  edited/deleted, unsafe-source, and archived-read examples. Fresh migration plus first/repeated seed
  produced identical rows across seven relevant tables in disposable PostgreSQL 16.
- All 1,305 package tests, 34 application browser tests, 5 editor browser tests, and the compiled
  production-preview test passed locally. Full browser regressions used zero retries.
- Added inert DOM/network, complete fallback, archived denied-write, keyboard/composition, responsive
  code-containment, and parser/projection-policy timing evidence. Fixed mobile comment grid overflow
  and a date-sensitive portfolio test assumption found during the full suite.
- Production build passes unchanged budgets without warnings; initial size is 386.62 kB and the
  authored-content parser remains lazy. Production dependency audit reports zero vulnerabilities;
  the existing 34 development-toolchain findings are explicitly recorded, not silently ignored.
- CI now runs production audit, application browser regressions, compiled preview, and failure
  artifact upload. No remote run is claimed. Release/site/version changes remain Phase 11 work.
- See [verification notes](verification-notes.md) for isolation, commands, measurements, screenshots,
  cleanup, and manual validation limitations (real IME, screen reader, actual browser zoom).

## Phase 11: Documentation, Public Site, And Release Finalization

Goal: finish v0.2.9 with accurate public claims, metadata, operational guidance, and a clean full
verification record.

Dependencies: Phase 10.

Scope:

- Update README capabilities, supported syntax, defaults/omission rules, input units, legacy
  exceptions, CSV guidance, and current limitations.
- Reconcile OpenAPI with implemented response/write fields and examples; retain accurate historical
  response constraints and current import route paths.
- Add/update CSV examples showing quoted multiline descriptions and optional `description_format`.
- Update the public site with structured description/discussion capability and a current detail
  screenshot. Retain the existing Pages workflow and truthful local-first deployment statements.
- Add `docs/v0.2.9/release-notes.md` with migration, whitespace changes, compatibility, security scope,
  supported formatting, input bounds, and residual risks.
- Add destination-neutral `docs/v0.2.9/pattern-notes.md` for source/format persistence, allowlisted
  presentation trees, shared preview/read rendering, state-aware validation, and explicit identity data.
- Update root/API/web/contracts versions, lockfile workspace metadata, API contracts dependency,
  OpenAPI version, and version assertions consistently to `0.2.9`.
- Reconcile PRD/design/plan status with delivered behavior and recorded deviations only after their
  requirements are satisfied. Do not retrospectively claim tests or UAT that did not occur.
- Run full verification on the final documented/versioned tree, not merely reuse pre-finalization
  test counts. Check public site assets, links, responsive layout, and Pages configuration.
- Review tracked/untracked/generated files, stop only phase-owned servers, and report remaining
  limitations clearly. Do not commit, push, tag, publish, or merge without an explicit request.

Acceptance criteria:

- Product/docs/site agree on supported syntax, no images/active HTML, explicit mentions, and local
  deployment limits; no full GFM, WYSIWYG, checklist, coauthoring, or hosting claim is added.
- Package/API/OpenAPI versions are consistently `0.2.9`.
- Release and pattern notes exist, and every implementation phase has honest evidence.
- Full lint/typecheck/test/build/browser/audit checks pass with unchanged budgets and no unresolved
  reproducible CI failure.
- Changed files and temporary resources are reviewed; no generated evidence debris is included.

Suggested checks:

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
npm run test:editor
npm audit --omit=dev --audit-level=low
git diff --check
git status --short --branch
```

Run browser checks on disposable resources. Verify site assets and version consistency separately;
do not infer their correctness from Angular application tests.

Status: Not started.

## Coverage Map

| Requirement | Primary Delivery | Final Evidence |
| --- | --- | --- |
| Format identity and legacy migration | Phases 1-2 | Phases 2, 10 |
| Safe defaults, normalization, and grandfathering | Phases 1, 3-4 | Phases 3-4, 10 |
| Atomic writes, no-ops, and activity | Phases 3-4 | Phases 3-4, 10 |
| Explicit mentions and notification compatibility | Phases 4, 9 | Phases 4, 9-10 |
| Whitespace-preserving CSV and unchanged exports | Phase 5 | Phases 5, 10 |
| Bounded parsing, safe URLs, and inert presentation | Phase 6 | Phases 6, 10 |
| Shared source editor and faithful preview | Phase 7 | Phases 7, 10 |
| Description entry points and legacy conversion | Phase 8 | Phases 8, 10 |
| Comment workflows and deleted tombstones | Phase 9 | Phases 9-10 |
| Draft lifecycle, route reuse, and actor isolation | Phases 8-9 | Phases 8-10 |
| Responsive, accessible, and lazy presentation | Phases 6-9 | Phase 10 |
| Source-text search and historical snapshots | Phases 2-9 preserve | Phase 10 |
| Documentation, site, metadata, and final gates | Phase 11 | Phase 11 |

## Phase Completion Protocol

For each phase:

1. Re-read its scope, dependencies, current repository state, and latest user direction.
2. Preserve unrelated user changes and implement only the phase plus necessary compiling prerequisites.
3. Add focused tests with behavior, including fixtures affected by contract changes.
4. Run suggested checks and directly affected package lint/typecheck; report unavailable checks rather
   than counting them as passed.
5. Use disposable verification resources and inspect diffs/untracked files before cleanup.
6. Record completion date, actual behavior, commands/results, evidence locations, and deviations under
   the phase's Status. Distinguish automated, manual, and locally measured evidence.
7. Do not mark a phase complete while its required checks fail or its acceptance criteria remain unmet.
8. Update design/plan first if implementation invalidates an assumption; preserve approved source,
   compatibility, security, and product boundaries.
9. Leave subsequent phases unstarted until requested; a completed prerequisite is not permission to
   execute the remainder of the sprint.
10. Do not commit, push, tag, publish, merge, or delete user data unless explicitly directed.

## Release Completion Criteria

v0.2.9 is complete when:

- descriptions and comments persist source plus explicit formats with additive migration compatibility;
- existing text remains literal, readable, and unchanged unless deliberately edited/converted;
- new/changed input limits and unchanged legacy exceptions hold across API, UI, and import;
- authorized users can format, preview, save, reload, and edit descriptions/comments through all
  approved entry points;
- preview and saved content use the same finite, safe, bounded rendering path;
- unsafe links, active HTML, images, scripts, and arbitrary attributes cannot execute or fetch assets;
- code/prose remain readable on mobile/desktop/zoom without page overflow;
- source-and-format no-ops preserve timestamps and side effects, while real changes are auditable;
- explicit mentions, watcher behavior, permissions, archived rules, and deleted tombstones remain correct;
- stale responses and context changes cannot display the wrong content or discard a newer draft;
- CSV imports retain normalized source and format while exports, search, and snapshots remain stable;
- current bundle/style budgets pass without threshold increases;
- README, OpenAPI, release/pattern notes, public site, and `0.2.9` metadata are accurate;
- full local/CI-compatible verification passes and evidence identifies any residual limits honestly;
- no unresolved release-blocking decision, failed required check, test debris, or phase-owned server
  remains.
