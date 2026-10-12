# Worktrail v0.2.9 Implementation Plan

## Status

Implementation in progress. Phases 0-2 are complete; Phases 3-11 have not started.

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
- Current CI runs install, lint, typecheck, database preparation, package tests, and build using
  PostgreSQL 16 and Node 20. Browser and dependency-audit commands are separate local release gates;
  they are not currently included in the workflow.

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

Status: Not started.

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

Status: Not started.

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

Status: Not started.

## Phase 6: Markdown Projection And Safe Angular Viewer

Goal: establish the complete presentation/security boundary before exposing Markdown authoring.

Dependencies: Phase 5.

Scope:

- Add exact `markdown-it@15.0.2` to the web workspace and update the lockfile without release-version
  churn. Verify its declarations, ESM import, license, dependency audit, and production build.
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

Status: Not started.

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
npm run build:web
git diff --check
```

Status: Not started.

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

Status: Not started.

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

Status: Not started.

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
npm audit --omit=dev --audit-level=low
git diff --check
```

Use the disposable database and isolated storage for every database/browser command above. The
production-preview command and nondefault ports should be recorded with their actual runtime setup
rather than assumed to be free.

Status: Not started.

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
