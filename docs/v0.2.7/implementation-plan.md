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

- Not started.

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

- Not started.

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

- Not started.

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

- Not started.

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

- Not started.

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

- Not started.

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

- Not started.

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

- Not started.

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

- Not started.

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
