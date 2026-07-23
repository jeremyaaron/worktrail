# Worktrail v0.2.7 Implementation Plan

## Purpose

This plan turns the v0.2.7 PRD and technical design into sequential implementation phases.

v0.2.7 should add Files in Context through bounded work item attachments. Active workspace members will
be able to upload supported files to work items in active projects, inspect compact metadata, download
authorized content, and remove files under uploader-or-role permissions. Archived projects will retain
list and download behavior while attachment mutations remain blocked.

The release should preserve:

- current work item create, edit, status, board, bulk-triage, hierarchy, and dependency behavior;
- project/workspace discovery, canonical query state, saved views, copied links, and CSV export;
- comments, mentions, watchers, notifications, and existing activity ordering;
- milestone, cycle, Planning, Review, Portfolio, report, and closeout behavior;
- immutable report and cycle closeout snapshots;
- current role, active-member, and archived-project semantics;
- transport-neutral endpoint handlers and an eventual API Gateway/Lambda path;
- Angular lazy-route and production bundle boundaries;
- deterministic local setup, PostgreSQL seed behavior, and production preview;
- full local and CI verification.

Attachments must remain isolated from paged work-list, board, report, CSV, and snapshot payloads. This
release should prove one metadata-versus-object-storage workflow without becoming a generic document or
asset platform.

## Design Decisions

Use these decisions while implementing v0.2.7:

- Store attachment metadata in PostgreSQL and immutable bytes behind `AttachmentObjectStore`.
- Implement local filesystem and in-memory test adapters only.
- Use a 4 MiB per-file limit, 20 live attachments per work item, and 50 MiB aggregate bytes per item.
- Limit normalized filenames to 180 Unicode code points.
- Let Angular select multiple files, but send one sequential raw request per file.
- Use `application/octet-stream` request bodies with encoded filename and declared media type headers.
- Use bounded `Uint8Array` values at endpoint, service, and storage boundaries.
- Require extension, declared media type, and bounded content evidence to agree.
- Support PNG, JPEG, GIF, WebP, PDF, UTF-8 text/Markdown/CSV/JSON, DOCX, XLSX, and PPTX.
- Use `yauzl` only for bounded lazy Open XML package-directory inspection; never extract entries.
- Normalize filenames for display/download only; generate independent random storage keys.
- Store SHA-256 checksums but keep them out of public DTOs and ordinary activity.
- Load attachment metadata independently from the primary work item detail DTO.
- Proxy authorized downloads with forced attachment disposition and defensive headers.
- Permit active members to upload to active projects.
- Permit uploaders to remove their own files and owners/maintainers to remove any file.
- Permit list/download but block upload/removal in archived projects.
- Do not update `work_items.updated_at` or create notifications for attachment activity.
- Serialize same-item quota decisions with a work-item row lock.
- Coordinate attachment mutations with project archive through a project `FOR SHARE` lock.
- Compensate object writes when metadata transactions fail.
- Keep metadata retryable when object deletion fails and allow cleanup of missing objects.
- Require an explicit absolute local storage path in production mode.
- Do not add S3, presigned transfer, streams, scanning, previews, jobs, or a generic upload framework.

## Phase Sizing

Each phase should leave the repository in a coherent, compiling state.

Implementation phases:

0. baseline planning;
1. attachment contracts, policy, activity, and error vocabulary;
2. attachment schema, migration, and repository locking primitives;
3. object-store adapters and runtime configuration;
4. attachment list and upload service behavior;
5. authorized download and removal service behavior;
6. binary HTTP adaptation, attachment endpoints, and OpenAPI;
7. Angular API, attachment list, and download experience;
8. multi-file upload queue and progress experience;
9. removal, activity refresh, and detail-route integration;
10. deterministic seed objects and local storage reset;
11. browser, responsive, accessibility, and operational verification;
12. documentation, public site, metadata, and final verification.

Run focused contract/policy checks after Phase 1, fresh migration and repository checks after Phase 2,
storage/runtime tests after Phase 3, service/concurrency tests after Phases 4-5, endpoint/OpenAPI checks
after Phase 6, Angular tests after Phases 7-9, seed/reset checks after Phase 10, browser/preview checks
after Phase 11, and full verification during Phase 12.

## Phase 0: Baseline Planning

Goal: confirm planning inputs, repository state, migration order, storage assumptions, and implementation
choices before runtime changes.

Scope:

- Confirm `prd.md`, `technical-design.md`, and `implementation-plan.md` exist under `docs/v0.2.7`.
- Confirm active branch, commit baseline, worktree state, and index state.
- Confirm no runtime files have been changed for v0.2.7.
- Confirm current package/OpenAPI baseline is `0.2.6`.
- Confirm `0016_scalable_search.sql` is latest and `0017_*` is next.
- Confirm current Express parser order and binary response behavior.
- Confirm work item detail can change `:workItemId` without component destruction.
- Confirm attachment activity needs no notification type.
- Confirm local-development and production-preview commands affected by storage configuration.
- Confirm `.worktrail/` will be ignored before any runtime writes.
- Confirm `yauzl` is the only planned new runtime dependency.
- Confirm no product or technical decision remains open and no later request changes scope.

Out of scope:

- Runtime implementation, dependency installation, schema edits, storage creation, or runtime tests.

Acceptance criteria:

- All planning documents exist and repository state is understood.
- No unresolved decision blocks Phase 1.
- Migration, dependency, endpoint, and Angular sequencing preserve a compiling repository.
- Scope remains bounded to work item attachments and direct operating requirements.

Suggested commands:

```sh
find docs/v0.2.7 -maxdepth 1 -type f | sort
git status --short --branch
git diff --cached --name-only
git log -1 --oneline --decorate
git diff --check
ls apps/api/drizzle | sort | tail
rg -n '"version": "0.2.6"|version: 0.2.6' package.json package-lock.json apps packages docs/api/openapi.yaml
rg -n "express.json|Buffer.isBuffer|AppResponse" apps/api/src/adapters apps/api/src/http
rg -n "No product or technical decisions block|0017_|application/octet-stream|yauzl" docs/v0.2.7/*.md
```

Status:

- Completed on 2026-07-19.
- Confirmed all v0.2.7 planning inputs exist:
  - `docs/v0.2.7/prd.md`;
  - `docs/v0.2.7/technical-design.md`;
  - `docs/v0.2.7/implementation-plan.md`.
- Confirmed the active branch is `v0.2.7` at `e0e7816`, the v0.2.6 merge baseline tagged
  `v0.2.6` and matching `main`/`origin/main`.
- Confirmed the change boundary before runtime implementation:
  - the three v0.2.7 planning documents are staged as new files;
  - the index contains no runtime, migration, dependency, OpenAPI, README, site, test, or generated
    output changes;
  - no tracked runtime file has an unstaged change.
- Confirmed the release baseline remains `0.2.6` in root, API, web, contracts, package-lock workspace
  metadata, the API contracts dependency, and `docs/api/openapi.yaml`. Version changes remain reserved
  for Phase 12.
- Confirmed migration ordering:
  - `0016_scalable_search.sql` is the latest committed migration and journal entry;
  - v0.2.7 can add the next additive migration as `0017_*`;
  - existing work items require no attachment backfill.
- Confirmed the current HTTP seams:
  - `AppRequest.body` is `unknown`, so a bounded Express `Buffer` can enter as a `Uint8Array` without
    adding an Express type to endpoint contracts;
  - global `express.json()` runs before route registration but remains content-type selective, so an
    `application/octet-stream` request can reach a route-local raw parser;
  - `adaptEndpoint` currently handles strings and Node `Buffer` specially and JSON-serializes other
    bodies, establishing the exact Phase 6 change needed for `AppBinaryBody`/`Uint8Array`;
  - current no-body handling serializes `{}`, confirming the planned 204 correction is necessary.
- Confirmed work item detail route reuse already provides the parent behavior attachments must follow:
  - it subscribes to distinct `:workItemId` changes;
  - it resets navigation state and reloads detail in place;
  - it rejects late detail success/error callbacks when their captured id no longer matches;
  - the attachment child will still need its own cancellation/generation guard for independent reads
    and mutations.
- Confirmed activity compatibility:
  - the work item timeline renders stored summaries and formats event types generically rather than
    using an exhaustive event-type switch;
  - attachment activity can therefore display after the shared/domain union and database check are
    extended;
  - notification types and watcher fan-out remain independent and need no attachment event addition.
- Confirmed runtime and preview implications:
  - runtime configuration currently has no storage driver/path;
  - `main.ts` currently starts synchronously and will need async object-store initialization;
  - root `npm run preview` enters production mode and currently documents only explicit
    `DATABASE_URL`, so Phase 3 must add storage-path validation and Phase 12 must update preview docs;
  - `.worktrail/` is not currently ignored, so Phase 3 must add the ignore rule before any default
    development storage write.
- Confirmed `yauzl` and `@types/yauzl` are not installed. They remain the only planned new runtime/type
  dependency pair and are reserved for Phase 1 bounded Open XML directory inspection.
- Confirmed the technical design closes all product and architecture choices, including raw one-file
  requests, bounded byte arrays, local/in-memory adapters, transaction ordering, policy limits,
  download proxying, timestamp/notification behavior, and UI placement.
- Confirmed no later request has changed the v0.2.7 Files in Context scope.
- Verified planning and repository state with focused documentation, git/index, version, migration,
  HTTP adapter, route reuse, activity rendering, dependency, runtime/preview, and decision searches plus
  `git diff --check` and `git diff --cached --check`.
- No unresolved technical choice blocks Phase 1.

## Phase 1: Attachment Contracts, Policy, Activity, And Error Vocabulary

Goal: define attachment JSON vocabulary, file policy, content validation, activity types, and structured
errors without exposing runtime routes.

Scope:

- Add `packages/contracts/src/attachments.ts` with attachment, policy, usage, and permission DTOs.
- Export attachment contracts through the existing package barrel.
- Keep bytes, checksum, storage key, and local path out of shared JSON DTOs.
- Add `work_item.attachment_uploaded` and `work_item.attachment_removed` to shared/API activity unions.
- Add backend errors:
  - `PAYLOAD_TOO_LARGE` with 413;
  - `ATTACHMENT_LIMIT_EXCEEDED` with 422;
  - `ATTACHMENT_STORAGE_UNAVAILABLE` with 503.
- Add `domain/attachment-policy.ts` with limits and the accepted type table.
- Add filename normalization for NFC, separators, controls, whitespace, reserved names, code-point
  length, and lowercase final extension.
- Add bounded content inspection for image/PDF signatures, UTF-8 text, JSON, and Open XML markers.
- Add `yauzl` and TypeScript declarations to the API workspace.
- Enforce lazy Open XML directory reads, a 2,000-entry ceiling, and no extraction/inflation.
- Add one backend policy-to-DTO mapper.
- Add focused contract, policy, content, and error tests.

Out of scope:

- Database, storage adapters, service/endpoints, Angular, and runtime wiring beyond policy tests.

Acceptance criteria:

- Contracts describe metadata/policy/capabilities without storage details.
- Every supported type has valid/invalid evidence tests.
- Empty, oversized, unsafe, unsupported, mismatched, and malformed input is deterministic.
- `application/octet-stream` is not accepted as the declared file type.
- Open XML inspection never extracts arbitrary entries.
- Activity unions remain aligned and attachment errors map to safe designed responses.
- Contracts/API compile with focused tests green.

Suggested commands:

```sh
npm install yauzl --workspace @worktrail/api
npm install --save-dev @types/yauzl --workspace @worktrail/api
npm run typecheck --workspace @worktrail/contracts
npm run test --workspace @worktrail/contracts
npm run typecheck --workspace @worktrail/api
npm run test --workspace @worktrail/api -- attachment-policy app-error
npm run lint --workspace @worktrail/contracts
npm run lint --workspace @worktrail/api
git diff --check
```

Status:

- Completed on 2026-07-19.
- Added focused shared attachment contracts in `packages/contracts/src/attachments.ts`:
  - public attachment metadata with uploader and server-returned removal capability;
  - accepted-type policy and category vocabulary;
  - fixed limit policy;
  - work item usage/capacity and upload capability;
  - no byte, checksum, storage-key, path, workspace, or project implementation fields.
- Exported attachment contracts through the package barrel and added contract tests that prove metadata,
  policy, usage, capability, and storage-isolation shapes.
- Added aligned work-item activity values to shared and API domain unions:
  - `work_item.attachment_uploaded`;
  - `work_item.attachment_removed`.
- Added structured API error vocabulary and safe response mapping for:
  - `PAYLOAD_TOO_LARGE` / 413 with byte limit detail;
  - `ATTACHMENT_LIMIT_EXCEEDED` / 422 for count and aggregate-byte policy;
  - `ATTACHMENT_STORAGE_UNAVAILABLE` / 503 without adapter detail.
- Added `apps/api/src/domain/attachment-policy.ts` with the resolved fixed limits:
  - 4 MiB per file;
  - 20 live attachments per work item;
  - 50 MiB aggregate bytes per work item;
  - 180 normalized filename code points.
- Implemented filename normalization with Unicode NFC, separator replacement, C0/C1 and line-separator
  removal, horizontal-whitespace collapse, trailing-period removal, reserved/empty-name rejection, and
  code-point-aware length enforcement.
- Implemented one authoritative extension, declared-media-type, canonical-media-type, and category map
  for PNG, JPEG, GIF, WebP, PDF, text, Markdown, CSV, JSON, DOCX, XLSX, and PPTX.
- Implemented bounded content evidence checks:
  - image and PDF signatures;
  - fatal UTF-8 decoding and NUL rejection for text/data;
  - JSON parsing;
  - Open XML ZIP signature, package marker, expected root, encrypted-entry, malformed-directory, and
    2,000-entry ceiling checks.
- Added `yauzl` 3.4 and its TypeScript declarations as the only Phase 1 dependency pair. Open XML
  inspection uses lazy central-directory enumeration and never opens, inflates, or extracts entries.
- Added defensive policy DTO copies so callers cannot mutate the backend's authoritative policy.
- Added focused tests for:
  - every supported file family and canonical media result;
  - uppercase extensions and Markdown media alias normalization;
  - separator/control/Unicode/whitespace filename normalization;
  - empty, reserved, exact-boundary, and overlong names;
  - empty and oversized bytes;
  - unsupported active content and unknown binary declarations;
  - extension/media/content mismatches;
  - invalid UTF-8, NUL text, and malformed JSON;
  - valid Word/Spreadsheet/Presentation package markers;
  - malformed, wrong-root, encrypted, and excessive Open XML packages;
  - attachment error status/body/details and storage-error concealment.
- Confirmed no schema, migration, storage adapter, service, endpoint, OpenAPI, Angular, seed, or version
  implementation was introduced early. The existing database activity check remains for Phase 2.
- Verification passed:
  - contracts typecheck;
  - contracts lint;
  - contracts build;
  - contracts full suite: 10 files and 38 tests;
  - API typecheck;
  - API lint with zero warnings;
  - API build;
  - focused attachment-policy/app-error suite: 2 files and 24 tests;
  - API full suite: 36 files and 398 tests;
  - production dependency audit: zero production vulnerabilities;
  - `git diff --check` and staged diff hygiene.
- `npm install` continues to report four moderate findings in the broader development dependency graph;
  `npm audit --omit=dev --json` confirms the production graph, including `yauzl`, has zero findings.
- No design deviation or unresolved choice blocks Phase 2.

## Phase 2: Attachment Schema, Migration, And Repository Locking Primitives

Goal: add authoritative metadata persistence, activity check support, ordered reads, quota queries, and
lock methods required by consistency rules.

Scope:

- Add `workItemAttachments` with UUID identity, ownership FKs, normalized metadata, byte size, checksum,
  unique opaque key, and timestamp.
- Use restrictive work item deletion behavior.
- Add constraints for positive/bounded bytes, filename length, checksum shape, and key shape.
- Add indexes for newest-first work item reads, workspace diagnostics, and unique storage key.
- Generate/review migration `0017_*`, including the attachment activity check values.
- Add attachment repository create/find/lock/list/usage/delete methods.
- Register it in `createRepositories` and transaction helpers.
- Add `projects.findByIdForShare(id)` and reuse/add the needed work-item row lock.
- Add PostgreSQL tests for constraints, ordering, duplicate names, usage, unique keys, deletion, and locks.
- Verify clean and incremental migration while existing seed remains attachment-free.

Out of scope:

- Object storage, service/endpoints, seed attachments, and work item deletion.

Acceptance criteria:

- Fresh/incremental migration succeeds without backfill.
- Duplicate display names work while storage keys remain unique.
- Ordered list and usage queries are exact/deterministic.
- Transaction repositories expose the designed locks.
- Existing reset/migrate/seed and API tests remain green.

Suggested commands:

```sh
npm run db:generate
npm run db:reset
npm run db:migrate
npm run db:seed
npm run typecheck --workspace @worktrail/api
npm run test --workspace @worktrail/api -- work-item-attachment-repository project-repository
npm run lint --workspace @worktrail/api
git diff --check
```

Status:

- Completed on 2026-07-19.
- Added the authoritative `work_item_attachments` metadata table with:
  - workspace, project, work item, and uploader ownership references;
  - normalized display name, canonical media type, byte size, SHA-256 checksum, opaque storage key,
    and creation timestamp;
  - restrictive work item deletion;
  - positive/4 MiB-bounded byte size, 1-180 character filename, lowercase SHA-256, and lowercase
    opaque-key checks;
  - deterministic newest-first work item ordering, workspace diagnostics, and unique storage-key
    indexes.
- Generated and reviewed migration `0017_safe_pandemic.sql`, including database acceptance of
  `work_item.attachment_uploaded` and `work_item.attachment_removed` activity values.
- Added inferred attachment repository types and a registered transaction-aware repository with:
  - create, find, row-lock, newest-first list, count/aggregate-byte usage, and delete operations;
  - exact zero-value usage for work items without attachments.
- Added `projects.findByIdForShare(id)` and reused the existing stable work-item update lock so later
  service transactions can serialize attachment quota checks and lifecycle changes in the designed
  order.
- Added PostgreSQL repository coverage for:
  - duplicate display names and unique opaque storage keys;
  - deterministic same-timestamp ordering;
  - exact usage totals and empty usage;
  - every metadata check constraint;
  - restrictive work item deletion;
  - project share, work-item update, and attachment update lock access through transaction-bound
    repositories;
  - both attachment activity event values.
- Verified the incremental path from migration `0016` through `0017`, followed by idempotent seed and
  all 27 repository tests.
- Verified the fresh path with reset, all migrations, and seed.
- Verification passed:
  - API full suite: 36 files and 401 tests;
  - API typecheck;
  - API lint with zero warnings;
  - API build;
  - `git diff --check`.
- Existing seed data remains attachment-free. No object storage, service, endpoint, OpenAPI, Angular,
  deletion-flow, or version implementation was introduced early.
- No design deviation or unresolved choice blocks Phase 3.

## Phase 3: Object-Store Adapters And Runtime Configuration

Goal: establish a tested storage boundary and initialize durable local storage without exposing routes.

Scope:

- Add `AttachmentObjectStore` with initialize, create-only put, bounded get, and remove outcomes.
- Validate opaque keys against the fixed lowercase hexadecimal format.
- Add `LocalAttachmentObjectStore` with safe root resolution, prefix sharding, directory creation,
  temporary create-exclusive writes, no-overwrite link, cleanup, regular-file reads, and missing mapping.
- Add copied-value `InMemoryAttachmentObjectStore` with deterministic failure hooks.
- Add safe internal storage errors and operational logging vocabulary.
- Add storage driver/path runtime configuration.
- Default development to repository-local `.worktrail/attachments` independent of caller cwd.
- Require an explicit absolute path in production and reject dangerous/unusable paths.
- Add `.worktrail/` to `.gitignore` before runtime writes.
- Refactor API startup to initialize storage asynchronously and close the pool on startup failure.
- Extend Express app options with an optional storage dependency without registering routes yet.
- Add local-adapter tests using OS temporary directories plus in-memory/runtime/startup tests.

Out of scope:

- S3, services/routes, storage reset, seed writes, and readiness expansion.

Acceptance criteria:

- Objects survive adapter/API recreation with the same root.
- Existing keys cannot be overwritten and invalid keys cannot escape the root.
- Failed writes leave no visible final or temporary object.
- Tests never write to the repository/normal development root.
- Development defaults safely and production fails clearly without explicit storage.
- Storage is initialized before listening; domain code does not import filesystem APIs.

Suggested commands:

```sh
npm run typecheck --workspace @worktrail/api
npm run test --workspace @worktrail/api -- attachment-object-store runtime-config main
npm run lint --workspace @worktrail/api
git diff --check
```

Status:

- Completed on 2026-07-21.
- Added the narrow `AttachmentObjectStore` port with initialize, create-only put, bounded copied-value
  get, and explicit removed/missing outcomes.
- Added internal storage operation/failure vocabulary and generic `AttachmentObjectStoreError` values
  that do not expose roots, resolved paths, object keys, bytes, or raw filesystem errors.
- Added `LocalAttachmentObjectStore` with:
  - defensive absolute/non-root path validation and a privately retained resolved root;
  - restrictive root, objects, shard, and object creation permissions;
  - writable-directory initialization before API listen;
  - opaque-key validation and `<root>/objects/<prefix>/<key>` sharding;
  - create-exclusive sibling temporary files, file synchronization, atomic hard-link publication, and
    temporary cleanup on success or failure;
  - no-overwrite collision behavior;
  - no-follow, regular-file-only, 4 MiB-bounded copied reads;
  - idempotent missing/removed deletion outcomes.
- Added `InMemoryAttachmentObjectStore` with copied write/read values, create-only semantics, matching
  bounded reads, and deterministic one-shot initialize/put/get/remove failures.
- Extended runtime configuration with the fixed `local` driver and attachment root:
  - development defaults to repository-local `.worktrail/attachments` from module location rather than
    caller cwd;
  - unsupported drivers, relative roots, and filesystem roots are rejected;
  - production requires an explicit absolute root;
  - formatted errors name the relevant variable and remedy without echoing configured values.
- Added `.worktrail/` to `.gitignore` before any normal runtime initialization.
- Extended `CreateExpressAppOptions` with the optional object-store dependency without registering
  attachment routes early.
- Refactored API startup into an injectable asynchronous `start()`:
  - storage initializes before app construction/listening;
  - the initialized store is passed to Express;
  - initialization/app/listen failures close the PostgreSQL pool;
  - direct execution retains nonzero failure behavior and emits a safe storage initialization remedy.
- Added OS-temporary-directory local-adapter tests for durable recreation, sharding, immutable
  collisions, temporary cleanup, missing/removal outcomes, key isolation, oversized/non-regular
  objects, and unusable roots.
- Added in-memory tests for copied values, create-only behavior, bounded reads, and one-shot failures.
- Added runtime/startup tests for defaults, production requirements, driver/path rejection,
  initialization ordering, dependency forwarding, and pool cleanup.
- Verification passed:
  - focused storage/runtime/startup suite: 4 files and 31 tests;
  - API full suite: 38 files and 415 tests;
  - API typecheck;
  - API lint with zero warnings;
  - API build;
  - production direct-entrypoint configuration smoke check;
  - `git diff --check`.
- Tests never initialize the repository-local default and clean all local-adapter fixtures from OS
  temporary directories.
- No S3 adapter, attachment service/route, seed object, storage reset, readiness expansion, or version
  implementation was introduced early.
- No design deviation or unresolved choice blocks Phase 4.

## Phase 4: Attachment List And Upload Service Behavior

Goal: implement metadata listing and authorized upload/object-write/metadata-transaction behavior with
quota concurrency protection.

Scope:

- Add `AttachmentService` with required database/object store plus clock, id, key, and logger seams.
- Keep internal records separate from public DTO mapping.
- Implement metadata-only newest-first list, batched uploader enrichment, exact usage, and capabilities.
- Implement upload policy/auth precheck, SHA-256, generated identity/key, and immutable object write.
- In one transaction:
  - lock project `FOR SHARE`;
  - lock work item `FOR UPDATE`;
  - revalidate ownership/active state;
  - check exact count/bytes;
  - insert metadata and one activity event;
  - leave work item timestamp and notifications unchanged.
- Compensate object writes after transaction failure and log failed compensation safely.
- Add service tests for capabilities, success, policy, activity, isolation, storage/metadata failure,
  compensation, archive races, exact limits, duplicate names, unchanged work item, and no notifications.
- Add PostgreSQL concurrency coverage where two uploads compete for one remaining allowance.

Out of scope:

- Download/removal, routes, Angular, and orphan reconciliation.

Acceptance criteria:

- List reads no object bytes and leaks no internal fields.
- Active members can upload to active-project work items.
- Archived/missing/cross-workspace requests retain no metadata or object.
- Metadata/activity commit together after object success.
- Failed metadata persistence normally removes the object.
- Concurrent uploads cannot exceed count/aggregate limits.
- Upload does not update the work item or create notifications.

Suggested commands:

```sh
npm run db:migrate
npm run typecheck --workspace @worktrail/api
npm run test --workspace @worktrail/api -- attachment-service attachment-concurrency
npm run lint --workspace @worktrail/api
git diff --check
```

Status:

- Completed on 2026-07-21.
- Added batched member lookup support so attachment lists hydrate distinct uploaders in one repository
  query rather than one query per row.
- Added explicit attachment DTO mapping that selects only public metadata and requires the uploader and
  computed removal capability; repository records are never spread into public responses.
- Added exact usage mapping with nonnegative remaining count/byte capacity and defensive policy copies.
- Added constrained attachment operational logging vocabulary for write and compensation outcomes. Log
  entries contain only operation, attachment id, outcome, and error class; logger failures are
  best-effort and cannot replace service/storage/database errors.
- Added `AttachmentService` with required repositories, database, and object store plus injectable clock,
  id, storage-key, and logger seams.
- Implemented metadata-only `listForWorkItem` behavior with:
  - active-actor and workspace/work-item/project visibility checks;
  - newest-first attachment metadata and exact usage reads without object-store access;
  - batched uploader enrichment;
  - uploader/owner/maintainer removal capabilities for active projects;
  - read-only capabilities for archived projects;
  - policy, usage, and upload capability response data with no checksum, storage key, project, or
    workspace implementation fields.
- Implemented upload behavior with:
  - copied input bytes so validation, checksum, storage, and metadata use one immutable snapshot;
  - authoritative filename/media/content validation and SHA-256 calculation;
  - active-actor, work-item, workspace, and active-project prechecks before storage consumption;
  - independent attachment identity and 64-character cryptographic storage-key generation;
  - create-only object write before database mutation;
  - required transaction ordering of project `FOR SHARE`, work item `FOR UPDATE`, actor/ownership/archive
    revalidation, exact usage query, attachment insert, and upload activity insert;
  - attachment ownership derived only from the locked work item and active uploader;
  - exact count and aggregate-byte quota enforcement, including allowed equality at the byte ceiling;
  - one safe `work_item.attachment_uploaded` activity value with normalized filename/media/size context;
  - no work-item update and no watcher notification.
- Added compensation after every post-write transaction failure. Successful compensation removes the
  object; missing/failed compensation emits safe evidence while preserving the original transaction
  error. Object-write failures map to the designed generic storage-unavailable response.
- Added PostgreSQL-backed service coverage for:
  - metadata-only ordered listing, duplicate display names, batched uploaders, exact usage, and role/
    archived capabilities;
  - successful owner, maintainer, and contributor uploads;
  - normalized metadata, immutable input bytes, exact checksum, safe activity, unchanged work item, and
    zero notifications;
  - invalid content, missing/cross-workspace work, inactive actors, and archived projects before writes;
  - storage failure, activity/metadata rollback, successful compensation, failed compensation evidence,
    and an archive race after object write;
  - exact count, aggregate rejection, and exact aggregate-boundary acceptance.
- Added a real PostgreSQL contention test with 19 existing attachments and two simultaneous uploads. The
  work-item lock permits exactly one success and leaves exactly 20 metadata rows, one new activity,
  one new object, an unchanged work item, and zero notifications; the rejected object's bytes are
  compensated.
- Verification passed:
  - idempotent database migration;
  - focused attachment service/concurrency suite: 2 files and 12 tests;
  - API full suite: 40 files and 427 tests;
  - API typecheck;
  - API lint with zero warnings;
  - API build;
  - `git diff --check`.
- No download/removal behavior, endpoint/Express route, OpenAPI, Angular, seed, orphan-reconciliation,
  readiness, or version implementation was introduced early.
- No design deviation or unresolved choice blocks Phase 5.

## Phase 5: Authorized Download And Removal Service Behavior

Goal: complete lifecycle services with integrity-checked reads, uploader-or-role removal, repairable
missing objects, and retained activity.

Scope:

- Implement authorized download:
  - resolve metadata and owning work context before object access;
  - conceal cross-workspace identity;
  - allow active members in active or archived projects;
  - enforce recorded/policy bounds;
  - verify byte size and SHA-256;
  - return metadata plus bytes without HTTP concerns.
- Implement removal with project-share, work-item-update, then attachment-update lock ordering.
- Revalidate active-project state and uploader/owner/maintainer permission inside the transaction.
- Remove the object before metadata/activity commit while locks are held.
- Roll back and retain metadata if object removal fails.
- Treat an absent object as authorized stale-record repair with safe warning evidence.
- Copy safe attachment context into removal activity before deleting the row.
- Add tests for roles, archived behavior, concealment, missing/corrupt objects, storage failure, retry,
  retained activity, and no notifications.
- Add concurrent removal coverage proving one committed event/outcome.

Out of scope:

- HTTP headers/routes, background deletion/outbox, and Angular actions.

Acceptance criteria:

- Authorized active/archived downloads return exact verified bytes.
- Cross-workspace requests cannot trigger object reads.
- Missing/corrupt objects return controlled storage errors.
- Uploader/owner/maintainer rules are authoritative.
- Storage removal failure leaves metadata retryable with no activity.
- Missing-object cleanup removes stale metadata and commits one retained event.

Suggested commands:

```sh
npm run typecheck --workspace @worktrail/api
npm run test --workspace @worktrail/api -- attachment-service attachment-concurrency
npm run lint --workspace @worktrail/api
git diff --check
```

Status:

- Completed on 2026-07-21.
- Added a transport-neutral attachment download result containing only normalized filename, media type,
  recorded byte size, and copied bytes; HTTP headers and response adaptation remain deferred.
- Implemented authorized download behavior with:
  - active-actor validation;
  - attachment, work-item, project, and workspace ownership validation before any object-store read;
  - missing/cross-workspace identity concealment;
  - active and archived project access for every active workspace role;
  - recorded positive/4 MiB policy bounds before storage access;
  - controlled mapping for object-store read failure or missing bytes;
  - exact object byte-size and SHA-256 verification against authoritative metadata;
  - controlled integrity failure for oversized, size-mismatched, or checksum-mismatched bytes;
  - copied return bytes so callers cannot mutate stored adapter values.
- Extended safe operational evidence with download read/integrity and removal/stale-object operations.
  Evidence remains limited to operation, attachment id, outcome, and error class; no bytes, key, path,
  checksum, filename, request data, or raw adapter error is logged. Warning/error logger failures remain
  best-effort and cannot change service outcomes.
- Implemented authorized removal with:
  - missing/cross-workspace attachment concealment and active-actor prechecks;
  - archived-project conflict before uploader/role authorization;
  - uploader, owner, and maintainer permission with denial for unrelated contributors;
  - required transaction lock order: project `FOR SHARE`, work item `FOR UPDATE`, attachment `FOR UPDATE`;
  - locked workspace/project/work-item ownership, active-project, active-actor, and permission
    revalidation;
  - object removal while all three locks are held;
  - safe `work_item.attachment_removed` activity inserted before live metadata deletion in the same
    transaction;
  - retained previous attachment id, normalized filename, media type, and byte size with null new value;
  - no checksum/storage fields, work-item timestamp update, or notification creation.
- Object removal failures map to the generic storage-unavailable error and roll back with metadata and
  activity unchanged for retry.
- Missing objects are treated as authorized stale-record repair: safe warning evidence is emitted,
  removal activity commits, and live metadata is deleted.
- Database/activity failure after successful object removal intentionally rolls back metadata/activity,
  leaving a controlled stale row that a later authorized removal repairs through the missing-object path.
- Added PostgreSQL-backed download coverage for:
  - exact copied bytes and safe metadata in active and archived projects;
  - missing/cross-workspace identity before object reads;
  - missing object, adapter read failure, oversized bytes, size mismatch, and checksum mismatch.
- Added PostgreSQL-backed removal coverage for:
  - uploader, owner, and maintainer success;
  - unrelated contributor denial, inactive actor denial, missing/cross-workspace concealment, and archived
    conflict before object removal;
  - retained safe activity after live-row deletion, unchanged work item, and zero notifications;
  - storage failure with metadata/object/activity retryability and successful retry;
  - missing-object repair with safe warning evidence;
  - post-object activity failure, stale metadata retention, and successful repair retry.
- Added a real PostgreSQL concurrent-removal test. Two requests against one attachment produce exactly
  one success, one controlled `NOT_FOUND`, one object removal, one retained removal event, no live row,
  an unchanged work item, and zero notifications.
- Verification passed:
  - focused attachment service/concurrency suite: 2 files and 21 tests;
  - API full suite: 40 files and 436 tests;
  - API typecheck;
  - API lint with zero warnings;
  - API build;
  - focused formatting checks;
  - `git diff --check`.
- No HTTP response/header helper, endpoint/Express route, OpenAPI, Angular, background deletion/outbox,
  seed, readiness, or version implementation was introduced early.
- No design deviation or unresolved choice blocks Phase 6.

## Phase 6: Binary HTTP Adaptation, Attachment Endpoints, And OpenAPI

Goal: expose the service through bounded raw uploads, transport-neutral binary downloads, structured
errors, and accurate API documentation.

Scope:

- Add `AppBinaryBody` and a discriminant guard to the application response boundary.
- Convert binary `Uint8Array` to `Buffer` only in Express.
- Correct no-body 204 handling so Express does not serialize `{}`.
- Add route-local `express.raw()` for `application/octet-stream` with the 4 MiB limit.
- Map body-parser overflow to structured 413 JSON before endpoint execution.
- Add list, one-file upload, content download, and removal endpoint handlers/routes.
- Parse/validate percent-encoded filename and declared media type headers.
- Register routes only with repositories, database, and object store available.
- Add safe attachment-disposition, UTF-8 filename, content length, no-store, and nosniff headers.
- Verify CORS preflight permits the custom upload headers.
- Add adapter/endpoint tests for exact limits, headers, malformed input, bytes, 204, authorization errors,
  and absence of internal fields.
- Add OpenAPI schemas/routes, binary bodies, limits, permissions, headers, and representative errors.

Out of scope:

- Angular client, range/HEAD, multipart, redirects, and presigned transfer.

Acceptance criteria:

- One valid raw request creates one attachment with 201 metadata.
- Oversized input returns structured 413 before service execution.
- List returns policy/usage/capabilities without bytes.
- Download sends exact bytes and defensive headers, not JSON.
- Remove returns a truly empty 204.
- Endpoint/domain code imports no Express upload type or local path.
- OpenAPI exposes no key, path, or checksum.

Suggested commands:

```sh
npm run typecheck --workspace @worktrail/api
npm run test --workspace @worktrail/api -- attachment-endpoint handler-adapter openapi cors
npm run lint --workspace @worktrail/api
npm run build --workspace @worktrail/api
git diff --check
```

Status:

- Completed on 2026-07-21.
- Added the transport-neutral `AppBinaryBody` response variant and discriminant guard. Endpoint code
  returns `Uint8Array`; only the Express adapter converts binary responses to Node `Buffer` values.
- Corrected the shared Express adapter so a no-body `204` ends the response without serializing `{}` or
  adding JSON content headers.
- Added focused attachment endpoint handlers for:
  - bounded metadata/policy/usage listing;
  - one-file raw upload with UUID parameter validation, required metadata headers, one-time percent
    decoding, and transport-independent byte input;
  - full integrity-checked binary download;
  - authorized removal with a truly empty `204` response.
- Added defensive download response construction with:
  - the normalized safe media type;
  - forced `attachment` disposition;
  - a constrained ASCII filename fallback and RFC 5987 UTF-8 filename;
  - authoritative `Content-Length`;
  - `Cache-Control: private, no-store`;
  - `X-Content-Type-Options: nosniff`.
- Added a dedicated Express attachment route module with the designed four routes. Registration requires
  repositories, the database, and object storage, preserving lightweight unrelated test applications.
- Added an upload boundary ahead of the global JSON parser that rejects missing/wrong transport media
  type and requires each custom metadata header exactly once.
- Added route-local `express.raw()` parsing for `application/octet-stream` at the exact 4 MiB limit.
  Body-parser overflow maps to structured `PAYLOAD_TOO_LARGE` JSON before actor/service/object-store
  execution rather than Express HTML.
- Confirmed CORS preflight reflects `content-type`, `x-worktrail-filename`, and
  `x-worktrail-media-type` for upload requests.
- Added PostgreSQL-backed HTTP integration coverage for:
  - upload, list, exact binary download, and removal as one lifecycle;
  - JSON contract isolation from storage key and checksum fields;
  - exact 4 MiB acceptance and 4 MiB plus one-byte structured rejection before storage;
  - wrong content type, missing filename, and malformed percent-encoded UTF-8;
  - contributor removal denial, archived-project download, and archived-project removal conflict;
  - controlled object-read failure without internal storage evidence.
- Added shared adapter/server coverage for binary conversion, empty `204` responses, dependency-gated
  route registration, and custom-header CORS preflight.
- Expanded OpenAPI with attachment tags, parameters, policy/usage/item/list schemas, all four routes,
  raw binary upload limits and headers, binary download response headers, permissions, lifecycle
  semantics, and representative 400/401/403/404/409/413/422/503 responses.
- OpenAPI contains no attachment key, path, checksum, or storage configuration fields.
- Verification passed:
  - focused endpoint/adapter/OpenAPI suite: 3 files and 30 tests;
  - API full suite: 41 files and 446 tests;
  - API typecheck;
  - API lint with zero warnings;
  - API build;
  - OpenAPI YAML parse;
  - focused formatting checks;
  - `git diff --check`.
- No Angular client, range/HEAD behavior, multipart parsing, redirects, presigned transfer, seed, storage
  reset, readiness, or version implementation was introduced early.
- No design deviation or unresolved choice blocks Phase 7.

## Phase 7: Angular API, Attachment List, And Download Experience

Goal: add an independently loaded, route-safe metadata section and authorized browser download before
introducing mutation queues.

Scope:

- Add focused Angular API/facade methods for list, progress-aware upload, Blob download, and remove.
- Add API tests for routes, encoded Unicode filenames, raw body, progress events, Blob, and delete.
- Reuse/harden `downloadBlob` and `fileNameFromContentDisposition` for attachment cases.
- Add standalone `WorkItemAttachmentsComponent`.
- Load metadata independently from primary work item detail.
- On `workItemId` change, clear old state, switch/cancel reads, reject stale responses, and reload.
- Render compact heading/count, policy capacity, loading, empty, retry error, and newest-first rows.
- Show filename, category/type, size, uploader, timestamp, Download, and row pending/error state.
- Use server capabilities as presentation guidance without replacing server authorization.
- Place Attachments after hierarchy/relationships and before Comments/Activity.
- Keep archived-project list/download behavior.
- Add helper/API/component tests including route reuse and long filenames.

Out of scope:

- Picker/upload queue, removal action, E2E coverage, and previews.

Acceptance criteria:

- Primary detail remains readable while metadata loads.
- Empty/loading/retry/list/download states are explicit and compact.
- Download uses the authorized Blob response and safe server filename.
- Archived files remain visible/downloadable.
- Same-route navigation never retains old attachment rows.
- Long names do not displace actions or cause page scrolling.
- Existing detail behavior and lazy build remain green.

Suggested commands:

```sh
npm run typecheck --workspace @worktrail/web
npm run test --workspace @worktrail/web -- --include='**/*attachments*.spec.ts'
npm run test --workspace @worktrail/web -- --include='**/download-file.spec.ts'
npm run lint --workspace @worktrail/web
npm run build --workspace @worktrail/web
git diff --check
```

Status:

- Completed on 2026-07-21.
- Added a focused Angular attachment API and facade surface for:
  - independently listing work-item attachment metadata;
  - raw one-file upload with encoded filename/media headers and `HttpEvent` progress reporting;
  - authorized Blob download;
  - authorized removal.
- Added API client support for progress-aware binary POST requests while preserving actor headers and
  keeping transport behavior outside feature components.
- Hardened shared download helpers so malformed RFC 5987 values fall back safely and filenames cannot
  retain path separators or control characters.
- Added a standalone `WorkItemAttachmentsComponent` after hierarchy/relationships and before the
  existing comments/activity region.
- Attachment metadata loads independently from the primary detail request and exposes compact loading,
  empty, retryable error, list, count, policy-capacity, archived, and exhausted-capacity states.
- Same-route identity changes immediately clear prior rows, cancel superseded list/download requests,
  and reject stale outcomes with both request-generation and work-item identity checks.
- Rows preserve server newest-first ordering and show safe filename wrapping, category/media type, size,
  uploader, timestamp, and a stable Download action with per-row pending/error state.
- Downloads use the authorized Blob response, hardened `Content-Disposition` parsing, and immediate
  object-URL cleanup. A failed download retains its metadata row and remains retryable.
- Server capabilities and lifecycle state guide presentation without replacing API authorization;
  archived attachments remain visible and downloadable.
- Added focused coverage for list/upload/download/delete transport behavior, Unicode and media-type
  headers, progress events, every metadata state, archived guidance, long filenames, Blob download,
  retry, route reuse, stale-response rejection, and request cancellation.
- Verification passed:
  - attachment API/component suite: 2 files and 10 tests;
  - shared download helper suite: 1 file and 3 tests;
  - work-item detail regression suite: 1 file and 28 tests;
  - web full suite: 379 tests;
  - web typecheck/development build;
  - web lint with zero warnings;
  - production build with no budget warnings, a 371.32 kB initial bundle, and a 90.92 kB lazy
    work-item-detail chunk;
  - `git diff --check`.
- Picker/upload queue, removal UI, previews, and E2E coverage remain deferred as designed.
- No design deviation or unresolved choice blocks Phase 8.

## Phase 8: Multi-File Upload Queue And Progress Experience

Goal: add ergonomic multi-file selection with independent validation, sequential upload, progress,
partial-failure, and retry behavior.

Scope:

- Add `Add files` with an associated hidden native multi-file input when upload is permitted/capable.
- Build `accept` and guidance from server policy.
- Add client preflight for empty bytes, size, extension, declared/derived media type, slots, and aggregate
  capacity while keeping server policy authoritative.
- Create stable queue entries with retained `File`, metadata, state, progress, and safe error.
- Upload sequentially through one raw request per file.
- Prevent repeated submission while an entry is active.
- Preserve valid sibling success when another file fails.
- Retain failed files for explicit retry until route change or success.
- Show determinate progress only with known totals; otherwise show indeterminate upload state.
- Add successful rows and update usage/count without route reload.
- Coalesce activity refresh after a queue run where practical.
- Clear/ignore prior-item queue outcomes on work item changes.
- Add tests for mixed selection, ordering, progress, partial failure, retry, media fallback, capacity, and
  stale route responses.

Out of scope:

- Drag/drop, parallel/resumable transfer, removal, and E2E coverage.

Acceptance criteria:

- Multiple files can be selected once and each has an independent outcome.
- Invalid/failed siblings do not roll back successful uploads.
- First-party queue sends no more than one upload concurrently.
- Failed files can retry without reselecting successful files.
- Successful rows/capacity update immediately while detail remains usable.
- Route changes cannot apply old outcomes to a new item.

Suggested commands:

```sh
npm run typecheck --workspace @worktrail/web
npm run test --workspace @worktrail/web -- --include='**/*attachments*.spec.ts'
npm run lint --workspace @worktrail/web
npm run build --workspace @worktrail/web
git diff --check
```

Status:

- Completed on 2026-07-21.
- Added a policy-derived multi-file picker that is exposed only when uploads are permitted and
  provisional server/queue capacity remains.
- The native picker accepts the server-advertised extensions, clears after each selection so the same
  file can be selected again, and presents concise policy-derived type and per-file-size guidance.
- Added per-file client preflight for:
  - empty files and the server-provided per-file byte limit;
  - normalized filename code-point length;
  - supported lowercase extension;
  - browser-declared media type or canonical policy fallback;
  - remaining attachment slots and aggregate bytes across server usage and retained queue entries.
- Invalid entries remain isolated and dismissible with specific guidance; valid siblings continue into
  the upload queue without being blocked or rolled back.
- Added stable in-memory queue entries retaining each `File`, canonical media type, state, progress,
  retry capability, and safe error until success, dismissal, or route change.
- The queue drains automatically in selection order with no more than one raw upload request active at
  a time. Additional selection is prevented while an entry is active.
- Known upload totals render a rounded integer percentage and determinate native progress element;
  unknown totals remain indeterminate and display `Uploading`.
- Server/API failures retain the original file and authoritative message for explicit retry. A failed
  entry does not prevent later queued siblings from uploading successfully.
- Successful responses immediately prepend the newest metadata row and reconcile count, aggregate
  bytes, remaining slots, and remaining bytes without reloading the route or primary detail DTO.
- Successful uploads are announced accessibly and `activityChanged` is emitted once after each queue
  run containing one or more successes, ready for the Phase 9 parent activity refresh wiring.
- Work-item identity changes cancel the active upload, discard the prior queue and announcement, and
  prevent prior-item outcomes from mutating the new detail state.
- Added focused coverage for policy-derived picker behavior, mixed valid/invalid selection, media-type
  fallback, sequential request ordering, determinate/indeterminate progress, immediate usage updates,
  partial failure, retry without reselection, aggregate/count capacity, and route-change cancellation.
- Verification passed:
  - attachment API/component suite: 2 files and 15 tests;
  - work-item detail regression suite: 1 file and 28 tests;
  - web full suite: 384 tests;
  - web typecheck/development build;
  - web lint with zero warnings;
  - production build with no budget warnings, a 371.33 kB initial bundle, and a 100.71 kB lazy
    work-item-detail chunk;
  - focused formatting checks and `git diff --check`.
- Drag/drop, parallel/resumable transfer, attachment removal, previews, and E2E coverage remain deferred
  as designed.
- No design deviation or unresolved choice blocks Phase 9.

## Phase 9: Removal, Activity Refresh, And Detail-Route Integration

Goal: complete detail lifecycle with permission-aware removal, retained activity refresh, and regression
coverage across existing detail sections.

Scope:

- Render Remove only when the server returns `permissions.canRemove`.
- Confirm removal with the normalized filename using the established confirmation pattern.
- Disable repeated removal for the active row.
- On success, remove locally, update usage/count, clear errors, refresh activity, and announce status.
- On failure, retain the row with a retryable row-level message.
- Ensure archived projects expose neither Add files nor Remove while Download remains.
- Wire upload/removal output to refresh only work item activity.
- Confirm retained activity renders after metadata deletion.
- Confirm no watcher/unread notification refresh occurs.
- Verify work item `updatedAt`, list sorting, return URLs, hierarchy, relationships, comments, watchers,
  and edit state remain unchanged.
- Add Angular tests for every role/lifecycle, confirmation, duplicate submission, failure, activity
  refresh, and same-route relationship/hierarchy navigation.

Out of scope:

- Seed data, full browser suite, custom dialog framework, and notification settings.

Acceptance criteria:

- Uploader/owner/maintainer receive correct removal capability; other contributors/archived users do not.
- Direct API authorization remains authoritative.
- Failed removal preserves metadata; success updates rows/activity without full reload.
- Attachment actions do not move work items in updated sorting or create notifications.
- Existing detail sections remain functional across route-id changes.

Suggested commands:

```sh
npm run test --workspace @worktrail/api -- attachment
npm run typecheck --workspace @worktrail/web
npm run test --workspace @worktrail/web -- --include='**/*work-item-detail*.spec.ts'
npm run test --workspace @worktrail/web -- --include='**/*attachments*.spec.ts'
npm run lint --workspace @worktrail/web
npm run build --workspace @worktrail/web
git diff --check
```

Status:

- Completed on 2026-07-21.
- Added server-capability-driven removal controls: `Remove` renders only when the attachment row returns
  `permissions.canRemove`; the client does not infer authorization from the selected member role.
- Added the established inline confirmation pattern with the server-normalized filename, explicit
  `Remove file` and `Cancel` actions, and stable row layout.
- Download and removal are mutually disabled for the active row, and repeated removal submission is
  rejected while that attachment request is in flight.
- Successful removal immediately:
  - removes only the matching metadata row;
  - decrements attachment count and aggregate bytes;
  - restores remaining slots and bytes within policy bounds;
  - clears row errors and confirmation state;
  - announces the normalized filename;
  - emits one `activityChanged` event.
- Failed removal retains the metadata row and confirmation, displays the authoritative safe API message,
  and permits explicit retry without a list or route reload.
- Removal subscriptions, pending ids, confirmation, errors, and announcements clear on work-item
  identity changes; active prior-item requests are canceled and late outcomes remain generation-guarded.
- Archived/read-only responses expose list and Download while omitting both Add files and Remove.
- Wired the attachment child's coalesced upload and per-removal output to the existing work-item activity
  endpoint rather than reloading the primary detail DTO.
- Activity refreshes cancel a superseded request, reject stale work-item/generation outcomes, and update
  only `workItem.activity`; comments, `updatedAt`, forms, relationships, watchers, and other detail state
  remain untouched.
- Activity refresh failure keeps the prior timeline visible and exposes a scoped retry. Attachment
  activity requests do not refresh watcher or notification/unread state.
- Existing same-route hierarchy and relationship navigation coverage remains green alongside explicit
  attachment upload/removal cancellation coverage.
- Added Angular coverage for capability visibility, archived behavior, filename confirmation/cancel,
  duplicate prevention, success reconciliation, failed-row retry, route cancellation, child-output
  integration, activity-only requests, retained detail/watch state, and activity retry.
- Verification passed:
  - API attachment authorization/lifecycle suite: 5 files and 57 tests;
  - Angular attachment API/component suite: 2 files and 19 tests;
  - work-item detail integration/regression suite: 1 file and 30 tests;
  - web full suite: 390 tests;
  - web typecheck/development build;
  - web lint with zero warnings;
  - production build with no budget warnings, a 371.33 kB initial bundle, and a 106.18 kB lazy
    work-item-detail chunk;
  - focused formatting checks and `git diff --check`.
- No notification behavior, detail timestamp mutation, list sorting, custom dialog framework, seed data,
  or E2E coverage was introduced early.
- No design deviation or unresolved choice blocks Phase 10.

## Phase 10: Deterministic Seed Objects And Local Storage Reset

Goal: make attachments visible/repeatable from a fresh checkout while keeping cleanup explicit and safe.

Scope:

- Add deterministic attachment ids, keys, timestamps, uploaders, and metadata.
- Seed at least a Markdown requirements note and JSON evidence artifact with distinct uploaders/times.
- Keep bytes tiny, safe, reviewable, and far below limits.
- Compute checksum/size from exact fixture bytes.
- Initialize configured local storage during seed.
- Make reruns idempotent: accept matching bytes, repair differing deterministic objects, then upsert
  metadata.
- Add upload activity only if it improves demo history without rerun duplication.
- Add guarded API-workspace/root `storage:reset` scripts.
- Require safe path validation and a store marker before recursive deletion.
- Keep `db:reset` database-only and define the full clean local sequence explicitly.
- Test seed reruns, exact downloads, safe reset, dangerous paths, and isolated local roots.

Out of scope:

- Arbitrary directory deletion, orphan reconciliation, fixture proliferation, and cloud seed behavior.

Acceptance criteria:

- Fresh reset/migrate/seed produces visible, exact downloadable files.
- Repeated seed does not duplicate/fail.
- Storage reset cannot target root, home, repository root, or an unmarked directory.
- Database reset does not silently delete files.
- Runtime storage stays untracked.

Suggested commands:

```sh
npm run storage:reset
npm run db:reset
npm run db:migrate
npm run db:seed
npm run db:seed
npm run test --workspace @worktrail/api -- seed storage-reset
git status --short
git diff --check
```

Status:

- Completed on 2026-07-22.
- Added deterministic seed attachment fixtures for `WT-3`:
  - a small Markdown requirements note uploaded by Morgan Maintainer;
  - a small JSON verification artifact uploaded by Avery Owner;
  - fixed attachment/activity ids, timestamps, filenames, media types, and exact UTF-8 bytes;
  - byte sizes and SHA-256 checksums computed directly from those fixture bytes;
  - checksum-derived deterministic object keys that remain internal to storage/metadata.
- Added object-first attachment seeding. Each deterministic object is read and accepted when exact,
  removed and recreated when its bytes differ, or created when absent. Attachment metadata and matching
  upload activity are upserted in one transaction only after every fixture object is correct.
- Integrated local attachment-store initialization into `db:seed` using the same validated runtime
  configuration and local object-store adapter as API startup. Repeated seed runs repair bytes without
  duplicating attachment or activity rows.
- Added a versioned `.worktrail-attachment-store` marker during local-store initialization. Existing
  stores containing only the established `objects` directory are adopted safely; unrelated unmarked
  directories and non-directory object paths are rejected.
- Added API-workspace and root `storage:reset` commands. Recursive deletion requires:
  - an absolute configured path;
  - a directory rather than a symlink or file;
  - a path distinct from filesystem root, the current home directory, and repository root;
  - an exact regular-file Worktrail store marker opened without following symlinks.
- Kept `db:reset` unchanged and database-only. README local setup now documents the explicit full reset
  order as storage reset, database reset, migrate, then seed, along with each command's guardrails.
- Added focused coverage for:
  - duplicate-free reruns and exact attachment/activity counts;
  - repair of a deliberately corrupted object;
  - exact authorized downloads through `AttachmentService`;
  - no metadata or activity when object initialization fails;
  - initialized-store removal and absent-store idempotency;
  - root/home/repository/relative-path rejection;
  - preservation of unmarked directories and rejection of malformed/symlinked markers and roots;
  - marker adoption and refusal to adopt unrelated directory contents.
- Verification passed:
  - focused attachment seed/object-store/storage-reset suite: 3 files and 18 tests;
  - isolated real `npm run storage:reset` CLI smoke check with a marked temporary store;
  - API full suite: 43 files and 454 tests;
  - API typecheck, lint with zero warnings, and build;
  - `git diff --check`.
- The destructive default-path `storage:reset` and local-development `db:reset` were intentionally not
  run, preserving the developer's current data. Their behavior is covered by isolated tests and the
  temporary-store CLI check; CI can exercise the documented clean sequence in an ephemeral environment.
- Runtime storage remains ignored under `.worktrail/`. No orphan reconciliation, cloud adapter, fixture
  proliferation, production-port overwrite, or database-coupled file deletion was introduced.
- No design deviation or unresolved choice blocks Phase 11.

## Phase 11: Browser, Responsive, Accessibility, And Operational Verification

Goal: prove the complete workflow across permissions, archived state, route reuse, layouts, restart
persistence, and production preview before release metadata changes.

Scope:

- Isolate E2E storage setup/cleanup from normal development storage.
- Add browser coverage for:
  - seeded metadata/download;
  - contributor upload;
  - multi-file partial failure, progress, and retry;
  - uploader removal and retained activity;
  - maintainer removal of another uploader's file;
  - other-contributor control absence;
  - archived list/download without mutations;
  - relationship/hierarchy navigation changing rows in place.
- Verify desktop/mobile empty, populated, long-name, queue, error, and archived states.
- Verify zoom, no incoherent overlap/horizontal page scrolling, keyboard/focus, input labeling, progress
  semantics, accessible action names, and restrained announcements.
- Verify active/unsupported files fail clearly and never render inline.
- Verify API restart persistence with the same root.
- Verify production preview requires/uses explicit storage.
- Verify startup/object failures are actionable without leaking paths/keys.
- Run regression browser paths for detail, comments, hierarchy, relationships, activity, board, lists,
  Planning, Reviews, reports, and closeout.
- Confirm production build has no bundle/style budget warning.

Out of scope:

- Public untrusted deployment, scanner testing, S3/multi-instance operation, and version bump.

Acceptance criteria:

- Lifecycle/permission paths pass end to end.
- UI remains compact at representative viewports and zoom.
- Route reuse never shows stale attachments.
- E2E leaves no repository storage artifacts.
- Restart persists objects; preview configuration behaves clearly.
- Existing high-value workflows remain green and production build has no warning.

Suggested commands:

```sh
npm run build
npm run test:e2e
WORKTRAIL_ATTACHMENT_STORAGE_PATH=/tmp/worktrail-preview-attachments npm run preview
git status --short
git diff --check
```

Status:

- Completed on 2026-07-22.
- Isolated Playwright attachment storage from normal development state:
  - each run receives a unique OS-temporary `WORKTRAIL_ATTACHMENT_STORAGE_PATH`;
  - Playwright no longer reuses an unrelated API or Angular server on the configured ports;
  - global setup clears the guarded test store before resetting, migrating, and seeding PostgreSQL;
  - global teardown always attempts marked-store cleanup, restores the database against the original
    development storage configuration, and preserves the first cleanup/restore failure;
  - storage cleanup still runs when database restoration is explicitly skipped.
- Added Chromium attachment lifecycle coverage proving:
  - both deterministic seeded files render and download with exact expected bytes and filenames;
  - attachment content is never embedded or rendered inline;
  - relationship and hierarchy links update attachment state during same-component detail-route reuse;
  - populated and empty attachment states do not retain stale rows;
  - a contributor cannot remove seed files uploaded by another member;
  - three selected files execute sequentially with visible progress, one successful long filename, one
    forced retryable server failure, and one unsupported active-content extension rejected locally;
  - progress and file-picker controls have stable accessible names and the queue emits restrained run
    summaries rather than progress announcements;
  - the uploader can remove their own file and a maintainer can remove another member's file;
  - removal refreshes and retains the corresponding work-item activity;
  - archived projects retain attachment listing and exact download while hiding all mutation controls;
  - desktop and mobile states, including a long filename and queue/error states, have no page overflow.
- Kept the existing responsive browser regression suite green across project/workspace lists, board,
  planning, milestone and cycle review, cycle closeout, Portfolio, status reports, inbox, CSV, comments,
  saved views, governance, hierarchy, relationships, and common desktop/mobile viewport checks.
- Added an explicit accessible name to the visually hidden multi-file input so automation and assistive
  technology can identify the native chooser independently from the visible Add files command.
- Verified production operation with a warning-free compiled build and an isolated absolute storage
  path:
  - production static assets, readiness, and Angular deep-link fallback served successfully;
  - exact seeded bytes downloaded before and after stopping and restarting the compiled API against the
    same local store;
  - a relative production storage path failed before startup with the expected concise configuration
    issue and no key or object-path disclosure;
  - the temporary preview store was guarded-reset and normal local database/storage seed restored.
- Verification passed:
  - attachment lifecycle E2E: 2 tests;
  - full Chromium E2E regression suite: 24 tests;
  - API tests: 43 files and 454 tests;
  - Angular tests: 390 tests;
  - all workspace typechecks and lints with zero warnings;
  - production build with no budget warning, a 371.33 kB initial bundle, and a 106.22 kB lazy work-item
    detail chunk;
  - E2E TypeScript checks, production restart/preview smoke checks, `git diff --check`, no listening test
    servers, and no remaining Phase 11 or E2E attachment directories under `/tmp`.
- The optional interactive browser surface was unavailable in this session; Chromium Playwright covered
  the required visual, responsive, keyboard/accessibility, download, and interaction evidence.
- No scanner integration, S3/multi-instance behavior, public untrusted deployment, or version change was
  introduced. No design deviation or unresolved choice blocks Phase 12.

## Phase 12: Documentation, Public Site, Metadata, And Final Verification

Goal: finalize v0.2.7 as a coherent documented release after implementation and user-facing
verification.

Scope:

- Update root/API/web/contracts/lockfile/OpenAPI/displayed versions to `0.2.7`.
- Mark planning document and phase statuses consistently with actual completion.
- Update README capabilities, limits, environment variables, reset/setup, persistence/backup, preview,
  and explicit scanning/preview/S3/authentication limitations.
- Update public site capability/limitation copy without overstating cloud/security readiness.
- Finalize OpenAPI version/examples.
- Add release notes with user behavior, operator changes, limits, and deferred work.
- Add destination-neutral extraction notes for metadata/byte ownership, bounded binary transport,
  external-resource compensation, server capabilities, and safe local storage.
- Search active docs/site for stale claims that files cannot be attached.
- Run fresh storage/database reset, migration, seed, rerun, and seeded download verification.
- Run full formatting, lint, typecheck, tests, build, and browser suite.
- Confirm migration metadata, lockfile, OpenAPI, site, and docs are intentional.
- Confirm no runtime storage, temp uploads, test results, screenshots, or builds are tracked.
- Review final diff for paths, keys, checksums, bytes, credentials, and unrelated changes.
- Leave commit, push, tag, publication, merge, and GitHub release to explicit user instruction.

Out of scope:

- S3/CDK, production-public claims, new features, and automatic release actions.

Acceptance criteria:

- Product/API/package/docs/site identify v0.2.7 consistently.
- Documentation explains setup and limitations accurately.
- Public copy includes attachments without implying scanning/previews/cloud storage.
- Fresh/repeated setup works and all verification passes without warnings.
- Git contains no runtime object or temporary data.
- Planning records reflect actual implementation and the diff is release-scoped.

Suggested commands:

```sh
npm run storage:reset
npm run db:reset
npm run db:migrate
npm run db:seed
npm run db:seed
npx prettier --check .
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
git status --short --branch
git diff --check
git diff --stat
rg -n '0\.2\.6|attachments.*not|no attachment|cannot attach' README.md docs site apps packages package*.json
```

Status:

- Completed on July 22, 2026.
- Updated root, API, web, contracts, lockfile, OpenAPI, README, and public-site release identity to
  `0.2.7`; the API workspace now references `@worktrail/contracts@0.2.7` and the lockfile contains only
  the intended workspace-version changes.
- Marked the PRD and technical design implemented. Added release notes and destination-neutral pattern
  notes covering user behavior, bounded policy, metadata/byte ownership, binary transport, object-store
  compensation, server-owned capacity, guarded local storage, deterministic object-aware seeds, and
  deliberate non-abstractions.
- Updated `.env.example` and README setup, preview, persistence, reset, backup/restore, seed, capability,
  and limitation guidance. Production preview now documents both its required database URL and absolute
  attachment-storage path, plus its single-instance/local-disk boundary.
- Updated the public site to present Files in Context as the v0.2.7 baseline while explicitly deferring
  malware scanning, previews, indexing, managed object storage, production authentication, and
  internet-safe hosting.
- Updated OpenAPI to `0.2.7` and added representative attachment metadata, capacity, and permission
  examples without exposing paths, storage keys, checksums, or bytes. The focused OpenAPI contract test
  passed after final example reconciliation.
- Ran a clean marked-storage reset, database reset, all migrations through
  `0017_safe_pandemic.sql`, deterministic seed, and repeat seed successfully. A temporary API smoke test
  listed the two seeded `WT-3` attachments and compared both HTTP downloads byte-for-byte with their
  deterministic Markdown and JSON definitions.
- Full verification passed:
  - `npm run lint` for API, web, and contracts with zero warnings;
  - `npm run typecheck` for all workspaces;
  - `npm test`: 454 API, 390 Angular, and 38 contract tests;
  - `npm run build`: contracts, API, and production Angular build with a 371.33 kB initial bundle and
    no budget warnings;
  - Playwright: 24 Chromium tests, including exact seeded downloads, route reuse, retry, removal roles,
    archived read-only behavior, and established regression workflows;
  - `npm audit --omit=dev --audit-level=low`: zero vulnerabilities;
  - `git diff --check` and final OpenAPI test.
- The suggested ad hoc `npx prettier --check .` is not an established repository gate: the project has
  no Prettier dependency or configuration, and Prettier defaults report 383 pre-existing source,
  generated migration-metadata, archived-document, and site files. Applying those defaults would create
  an unrelated repository-wide rewrite. Formatting evidence therefore uses the configured zero-warning
  ESLint gates, successful compilers, and `git diff --check`; the two new release documents also conform
  to Prettier's Markdown check.
- The stale-claim search found only intentional historical v0.2.6 records, the v0.2.7 problem statement,
  and current archived-project mutation restrictions. Final review found no credentials, local absolute
  paths, public internal attachment fields, tracked runtime storage, generated test output, temporary
  uploads, or active test servers. The existing tracked public-site board image is unchanged.
- No S3/CDK, hosted-infrastructure claim, feature expansion, commit, push, tag, publication, merge, or
  GitHub release was introduced. No design deviation or unresolved product choice blocks release.

## Phase Completion Protocol

For every implementation phase:

1. Re-read the phase scope and latest user request before editing.
2. Inspect current repository/user changes and preserve unrelated work.
3. Implement only the phase and prerequisites needed to keep the repository coherent.
4. Add/update focused tests with the behavior.
5. Run suggested checks plus directly affected package lint/typecheck.
6. Run `git diff --check` and review changed/untracked files.
7. Update the phase `Status` with completion date, delivered behavior, verification, and deviations.
8. Do not mark a phase complete while required checks fail.
9. Do not broaden into deferred document/storage features without explicit direction.
10. Do not commit, push, tag, publish, or merge unless explicitly requested.

If a phase invalidates a design assumption, update the design and plan before continuing. Preserve
bounded transfer, explicit authorization, metadata/object separation, and honest local-storage limits.

## Release Completion Criteria

v0.2.7 is complete when:

- active members can upload supported bounded files to active-project work items;
- metadata survives reload and loads independently from primary detail;
- exact authorized bytes download under a safe normalized filename;
- uploader/owner/maintainer removal and contributor/archived denial work as designed;
- archived projects preserve list/download and block mutation;
- server policy enforces file, filename, type, content, count, and aggregate limits;
- paths, keys, checksums, and bytes never appear in public JSON/activity/logs;
- upload/removal activity remains understandable after deletion;
- work item timestamps and watcher notifications remain unchanged;
- concurrency/storage-failure tests prove deterministic compensation, retention, and repair;
- local setup needs no additional service and preview requires explicit persistent storage;
- fresh/repeated seeds produce matching downloadable objects;
- UI passes desktop/mobile, zoom, keyboard, and route-reuse verification;
- existing list, board, hierarchy, dependency, comment, planning, review, report, and closeout paths pass;
- OpenAPI, README, release docs, extraction notes, and public site are accurate;
- package/application metadata is `0.2.7`;
- formatting, lint, typecheck, tests, build, browser suite, and diff hygiene pass without warnings;
- no runtime storage or generated test artifacts are tracked;
- no unresolved decision or failed required check remains.
