# Worktrail v0.0.7 Implementation Plan

## Purpose

This plan turns the v0.0.7 PRD and technical design into sequential implementation phases. v0.0.7 should make Worktrail easier to adopt with real team data by adding CSV work item import, import dry-run validation, transactional apply, filtered CSV export, and user/operator documentation.

The release remains local-first. It should preserve the Angular static-hosting path, transport-neutral API handlers, local Express adapter, Postgres migration discipline, deterministic seed data, production preview, checked-in OpenAPI reference, and clean verification from a fresh checkout.

## Design Decisions

Use these decisions while implementing v0.0.7:

- Add project-scoped CSV work item import only.
- Support file selection in Angular, read file text in the browser, and send JSON `{ csv }` to the API.
- Keep CSV parsing and validation authoritative on the server.
- Reject unknown CSV columns as file-level validation errors.
- Require referenced labels and milestones to already exist.
- Resolve `assignee_email` and `reporter_email` case-insensitively against active workspace members.
- Default omitted `reporter_email` to the acting member.
- Default omitted `status` to `backlog`.
- Rerun validation during apply instead of persisting preview state.
- Apply valid imports transactionally with no partial writes.
- Reuse normal work item creation semantics for display keys, board positions, labels, milestone assignment, reporter, and activity.
- Add synchronous project and workspace CSV export endpoints.
- Export current applied filters, not unsaved draft filter form state.
- Use `csv-parse` and `csv-stringify` instead of hand-rolled CSV parsing or escaping.
- Update the Express adapter to send string or `Buffer` endpoint bodies without JSON serialization.
- Add no database schema changes unless implementation discovers a correctness issue.
- Keep import/export small-scale with 1 MiB and 250 data-row limits.
- Defer persisted import batches, background jobs, cloud storage, third-party tracker adapters, custom mappings, import history, workspace import, and production auth.

## Phase Sizing

Each phase should leave the repository in a coherent working state. Prefer narrow backend slices first because import correctness depends on parser behavior, validation, transactions, and existing work item semantics. Add frontend UI only after endpoint contracts are stable.

Because v0.0.7 introduces bulk writes and downloadable non-JSON responses, run backend tests after API phases, frontend tests after UI phases, and full verification during finalization. Keep E2E import data deterministic by relying on the existing reset/seed flow.

## Phase 0: Baseline Planning

Goal: confirm v0.0.7 planning inputs and resolve implementation choices before code changes.

Scope:

- Confirm `docs/v0.0.7/prd.md` exists.
- Confirm `docs/v0.0.7/technical-design.md` exists.
- Confirm `docs/v0.0.7/implementation-plan.md` exists.
- Confirm design decisions listed above.
- Check repository status before implementation starts.
- Confirm the active branch and any staged changes.

Out of scope:

- Dependency changes.
- Runtime implementation.
- API documentation implementation.

Acceptance criteria:

- The three v0.0.7 planning documents exist.
- No unresolved open decision blocks Phase 1.
- The worktree/index state is understood before implementation starts.

Suggested commands:

```sh
find docs/v0.0.7 -maxdepth 1 -type f | sort
git status --short --branch
```

Status:

- Completed on 2026-07-05.
- Confirmed `docs/v0.0.7/prd.md`, `docs/v0.0.7/technical-design.md`, and `docs/v0.0.7/implementation-plan.md` exist.
- Confirmed implementation decisions:
  - project-scoped CSV work item import only;
  - Angular file selection with browser-side text reading and JSON `{ csv }` API payloads;
  - server-authoritative CSV parsing and validation;
  - unknown CSV columns rejected as file-level validation errors;
  - labels and milestones must already exist;
  - assignee and reporter emails resolved case-insensitively against active workspace members;
  - omitted `reporter_email` defaults to the acting member;
  - omitted `status` defaults to `backlog`;
  - apply reruns validation from submitted CSV instead of persisting preview state;
  - valid imports apply transactionally with no partial writes;
  - import reuses normal work item creation semantics;
  - project and workspace CSV export endpoints are synchronous;
  - exports use current applied filters;
  - API uses `csv-parse` and `csv-stringify`;
  - Express adapter sends string or `Buffer` endpoint bodies without JSON serialization;
  - no database schema changes are planned;
  - import/export limits start at 1 MiB and 250 data rows;
  - persisted import batches, background jobs, cloud storage, third-party adapters, custom mappings, import history, workspace import, and production auth stay out of scope.
- Confirmed current branch is `v0.0.7`.
- Confirmed current change state: `docs/v0.0.7/` is untracked and contains the three planning documents; no code changes are present yet.
- No unresolved open decision blocks Phase 1.

## Phase 1: Contracts, Dependencies, And CSV Utilities

Goal: establish shared DTOs, CSV library dependencies, and reusable parse/stringify utilities without wiring endpoints yet.

Scope:

- Add shared contracts:
  - `WorkItemCsvImportPreviewRequest`;
  - `WorkItemCsvImportApplyRequest`;
  - `WorkItemCsvImportErrorDto`;
  - `WorkItemCsvImportWarningDto`;
  - `WorkItemCsvImportPreviewRowDto`;
  - `WorkItemCsvImportPreviewDto`;
  - `WorkItemCsvImportApplyDto`.
- Add API dependencies:
  - `csv-parse`;
  - `csv-stringify`.
- Add service-level CSV helpers under `apps/api/src/services/csv/`.
- Configure parser behavior for headers, empty rows, quoted commas, and stable row numbers.
- Configure stringifier behavior for stable header order and safe escaping.
- Add focused CSV utility tests for:
  - quoted commas;
  - empty lines;
  - missing headers;
  - unknown headers;
  - stable export column order.

Out of scope:

- Work item reference resolution.
- Import endpoint handlers.
- Export endpoint handlers.
- Frontend work.

Acceptance criteria:

- Contracts compile for all workspaces.
- CSV helpers produce stable parsed records and formatted output.
- Parser errors are converted into safe structured errors or safe exceptions for later service handling.
- No application behavior changes yet.

Suggested commands:

```sh
npm install --workspace @worktrail/api csv-parse csv-stringify
npm run typecheck --workspace @worktrail/contracts
npm test --workspace @worktrail/api -- csv
npm run typecheck --workspace @worktrail/api
git diff --check
```

Status:

- Completed on 2026-07-05.
- Added shared import/export contracts:
  - `WorkItemCsvImportPreviewRequest`;
  - `WorkItemCsvImportApplyRequest`;
  - `WorkItemCsvImportErrorDto`;
  - `WorkItemCsvImportWarningDto`;
  - `WorkItemCsvImportPreviewRowDto`;
  - `WorkItemCsvImportPreviewDto`;
  - `WorkItemCsvImportApplyDto`.
- Added API dependencies:
  - `csv-parse`;
  - `csv-stringify`.
- Added `apps/api/src/services/csv/parse-csv-records.ts` with:
  - BOM-aware parsing;
  - header row capture;
  - empty-line skipping;
  - trimming;
  - quoted comma support through `csv-parse`;
  - 1-based physical row numbers from parser metadata;
  - required header validation;
  - unknown header validation;
  - duplicate header validation;
  - safe parser failure errors.
- Added `apps/api/src/services/csv/stringify-csv-records.ts` with:
  - stable column order;
  - required header row output;
  - CSV escaping through `csv-stringify`.
- Added focused CSV utility tests for:
  - quoted commas;
  - empty lines;
  - physical row numbers;
  - missing required headers;
  - unknown and duplicate headers;
  - safe parser failures;
  - stable export column order;
  - empty export header rows.
- Verified `npm test --workspace @worktrail/api -- csv`.
- Verified `npm run typecheck --workspace @worktrail/contracts`.
- Verified `npm run typecheck --workspace @worktrail/api`.
- Verified `npm test --workspace @worktrail/api`.

## Phase 2: Import Validation Service

Goal: implement dry-run import validation and normalization without writing work items.

Scope:

- Add `apps/api/src/services/work-item-csv-import-service.ts`.
- Enforce hard limits:
  - 1 MiB CSV text size;
  - 250 data rows;
  - 20 labels per row;
  - 10,000 characters per cell before semantic validation where no stricter validation exists.
- Validate required and allowed headers.
- Normalize row values:
  - trim string fields;
  - default `description` to empty string;
  - default `status` to `backlog`;
  - default `reporter_email` to actor email;
  - normalize empty optional fields to `null` or `[]`.
- Validate work item fields using existing enum/domain rules.
- Load scoped lookup data for:
  - project;
  - active workspace members;
  - active project labels;
  - active project milestones.
- Resolve emails, label names, and milestone names case-insensitively.
- Detect ambiguous duplicate catalog names defensively.
- Reject archived project import.
- Return structured preview DTOs with row numbers and field names.
- Add service tests for valid previews, defaults, invalid enum values, unknown references, missing required headers, unknown headers, hard limits, and archived project rejection.

Out of scope:

- Creating work items.
- Endpoint route registration.
- Frontend UI.

Acceptance criteria:

- A valid seeded-project CSV returns a preview with normalized rows and no errors.
- Invalid rows return row-specific errors without writes.
- File-level errors use `rowNumber: null`.
- Archived projects cannot be previewed for import.
- Validation does not expose raw parser, driver, or stack details.

Suggested commands:

```sh
npm test --workspace @worktrail/api -- work-item-csv-import
npm run typecheck --workspace @worktrail/api
npm test --workspace @worktrail/api
git diff --check
```

Status:

- Completed on 2026-07-05.
- Added `apps/api/src/services/work-item-csv-import-service.ts`.
- Implemented dry-run import validation with:
  - 1 MiB CSV payload limit;
  - 250 data-row limit;
  - 20-label-per-row limit;
  - 10,000-character cell limit;
  - required and allowed header validation;
  - safe parser failure handling;
  - string trimming;
  - default empty description;
  - default `status` of `backlog`;
  - default omitted `reporter_email` to the acting member;
  - empty optional field normalization;
  - work item type, status, and priority validation;
  - valid `YYYY-MM-DD` due date validation;
  - non-negative integer estimate validation;
  - active workspace member resolution by email;
  - active project label resolution by name;
  - active project milestone resolution by name;
  - case-insensitive lookup matching;
  - duplicate label names in a row collapsed by normalized name;
  - defensive ambiguity handling for duplicate lookup matches;
  - archived project rejection.
- Kept validation side-effect-free; preview validation does not create work items.
- Added `apps/api/tests/work-item-csv-import.test.ts` covering:
  - valid previews with defaults;
  - case-insensitive member, label, and milestone lookup;
  - duplicate label collapse;
  - invalid enum values;
  - inactive or missing member references;
  - archived or missing labels and milestones;
  - invalid dates and estimates;
  - header errors;
  - parser errors;
  - hard limits;
  - archived project conflicts;
  - no writes during preview.
- Verified `npm test --workspace @worktrail/api -- work-item-csv-import`.
- Verified `npm run typecheck --workspace @worktrail/api`.
- Verified `npm test --workspace @worktrail/api`.

## Phase 3: Import Preview API

Goal: expose import dry-run validation through transport-neutral endpoint handlers and Express routes.

Scope:

- Add import request body schema validation.
- Add `previewWorkItemCsvImportHandler` in `apps/api/src/endpoints/work-items.ts`.
- Register `POST /api/projects/:projectId/work-items/imports/preview`.
- Map malformed request bodies and hard payload limit failures to `400`.
- Preserve existing actor resolution and workspace scoping.
- Add endpoint/server tests for:
  - valid preview response;
  - validation-error preview response;
  - malformed request body;
  - archived project conflict;
  - missing project;
  - permission behavior aligned with normal creation.

Out of scope:

- Apply endpoint.
- Export endpoint.
- OpenAPI updates.
- Frontend UI.

Acceptance criteria:

- Preview endpoint returns `200` for parseable CSV with row validation errors.
- Preview endpoint returns `400` for malformed request bodies or hard limits.
- Preview endpoint returns existing project/actor error statuses consistently.
- Endpoint handler remains transport-neutral.

Suggested commands:

```sh
npm test --workspace @worktrail/api -- work-items
npm test --workspace @worktrail/api -- work-item-csv-import
npm run typecheck --workspace @worktrail/api
git diff --check
```

Status:

- Completed on 2026-07-05.
- Added `WorkItemCsvImportPreviewRequest` request schema validation in `apps/api/src/endpoints/work-items.ts`.
- Added `previewWorkItemCsvImportHandler`.
- Registered `POST /api/projects/:projectId/work-items/imports/preview` in the Express adapter.
- Preserved transport-neutral endpoint behavior by delegating CSV parsing and validation to `WorkItemCsvImportService`.
- Preserved preview semantics:
  - valid preview requests return `200`;
  - parseable CSV with row validation errors returns `200` with structured row errors;
  - malformed request bodies return `400`;
  - missing projects return `404`;
  - archived projects return `409`;
  - preview does not create work items.
- Added HTTP-level tests in `apps/api/tests/work-items.test.ts` for:
  - valid preview response;
  - validation-error preview response;
  - malformed request body;
  - missing project;
  - archived project conflict;
  - no writes during preview.
- Verified `npm test --workspace @worktrail/api -- work-items`.
- Verified `npm test --workspace @worktrail/api -- work-item-csv-import`.
- Verified `npm run typecheck --workspace @worktrail/api`.
- Verified `npm test --workspace @worktrail/api`.

## Phase 4: Transactional Import Apply

Goal: create work items from valid CSV rows in one transaction using normal work item creation behavior.

Scope:

- Refactor existing work item creation code to share creation semantics with import:
  - prefer a small internal helper if that keeps the change local;
  - use a separate creation service only if the helper becomes awkward.
- Add `apply` behavior to `WorkItemCsvImportService`.
- Rerun validation from submitted CSV during apply.
- Write all imported work items in one transaction.
- Create normal display keys, board positions, labels, milestone assignments, and activity events.
- Add `applyWorkItemCsvImportHandler`.
- Register `POST /api/projects/:projectId/work-items/imports`.
- Return `WorkItemCsvImportApplyDto` with created count and created work item list items.
- Add tests for:
  - successful multi-row import;
  - sequential display keys;
  - board positions by status;
  - label and milestone assignment;
  - activity event creation;
  - apply-time validation failure with no partial writes;
  - archived project conflict.

Out of scope:

- Import history.
- Partial success.
- Background processing.
- Frontend UI.

Acceptance criteria:

- Valid CSV creates all rows transactionally.
- Invalid apply creates no work items.
- Imported work appears in existing project list, board, workspace discovery, and activity surfaces.
- Public single-item creation behavior is unchanged.

Suggested commands:

```sh
npm test --workspace @worktrail/api -- work-item-csv-import
npm test --workspace @worktrail/api -- work-items
npm run typecheck --workspace @worktrail/api
npm test --workspace @worktrail/api
git diff --check
```

Status:

- Completed on 2026-07-05.
- Refactored `WorkItemService.createWorkItem` to delegate to `createWorkItemWithRepositories`.
- Added `WorkItemCreationInput` with optional `reporterId` support for import-created work items.
- Preserved normal single-item creation behavior:
  - default reporter remains the acting member;
  - creation activity actor remains the acting member;
  - display keys, board positions, label assignment, milestone assignment, and activity creation are unchanged.
- Added reporter validation so import-provided reporters must be active members of the actor workspace.
- Added `WorkItemCsvImportService.apply`.
- Apply now:
  - reruns CSV validation from submitted CSV;
  - rejects validation errors with structured `VALIDATION_ERROR` details;
  - rejects header-only/no-row imports;
  - creates imported work items through `WorkItemService.createWorkItemWithRepositories`;
  - writes all rows in one transaction when a database handle is available;
  - returns `WorkItemCsvImportApplyDto` with created count and created work item DTOs.
- Added `applyWorkItemCsvImportHandler`.
- Registered `POST /api/projects/:projectId/work-items/imports`.
- Added service tests for:
  - successful multi-row apply;
  - sequential display keys;
  - board positions;
  - imported reporter support;
  - label and milestone assignment;
  - creation activity;
  - apply-time validation failure with no partial writes;
  - forced write failure rollback inside the transaction.
- Added HTTP tests for:
  - successful apply;
  - validation failure response details;
  - no partial writes through the API;
  - archived project conflict.
- Verified `npm test --workspace @worktrail/api -- work-item-csv-import`.
- Verified `npm test --workspace @worktrail/api -- work-items`.
- Verified `npm run typecheck --workspace @worktrail/api`.
- Verified `npm test --workspace @worktrail/api`.

## Phase 5: CSV Export Backend

Goal: add filtered project and workspace CSV export using existing list query semantics.

Scope:

- Add `apps/api/src/services/work-item-csv-export-service.ts`.
- Convert project and workspace list DTOs into stable flat export rows.
- Include documented export columns:
  - `project_key`;
  - `display_key`;
  - `title`;
  - `type`;
  - `status`;
  - `priority`;
  - `assignee_name`;
  - `assignee_email`;
  - `reporter_name`;
  - `reporter_email`;
  - `label_names`;
  - `milestone_name`;
  - `due_date`;
  - `estimate_points`;
  - `created_at`;
  - `updated_at`.
- Reuse `parseFilters` for project export.
- Reuse `parseWorkItemQuery` for workspace export.
- Add endpoint handlers:
  - `exportProjectWorkItemsHandler`;
  - `exportWorkspaceWorkItemsHandler`.
- Register routes:
  - `GET /api/projects/:projectId/work-items/export`;
  - `GET /api/work-items/export`.
- Update the Express handler adapter so string and `Buffer` response bodies are sent with `send`, while JSON bodies still use `json`.
- Set `Content-Type` and `Content-Disposition` headers.
- Add tests for:
  - CSV headers;
  - proper escaping;
  - empty result header-only exports;
  - project filter behavior;
  - workspace filter behavior;
  - archived project modes;
  - adapter non-JSON response behavior.

Out of scope:

- Streaming exports.
- Export job persistence.
- Frontend download controls.

Acceptance criteria:

- Project export returns CSV matching project list filters.
- Workspace export returns CSV matching workspace discovery filters.
- CSV export does not JSON-encode the response body.
- Empty exports remain valid CSV files with headers.

Suggested commands:

```sh
npm test --workspace @worktrail/api -- work-item-csv-export
npm test --workspace @worktrail/api -- server
npm run typecheck --workspace @worktrail/api
npm test --workspace @worktrail/api
git diff --check
```

Status: Not started.

## Phase 6: Frontend API Client And Download Helper

Goal: expose import/export API operations to Angular while preserving actor headers.

Scope:

- Add import/export DTO imports to the frontend.
- Extend `WorktrailApiService` with:
  - `previewWorkItemCsvImport`;
  - `applyWorkItemCsvImport`;
  - `exportProjectWorkItems`;
  - `exportWorkspaceWorkItems`.
- Ensure export requests use `HttpClient` with `responseType: 'blob'` and existing actor headers.
- Add a small blob download helper that:
  - reads filename from `Content-Disposition` when present;
  - falls back to a deterministic filename;
  - revokes object URLs after use.
- Add focused tests for request paths, query params, actor headers, and filename handling where existing frontend test setup supports it.

Out of scope:

- Import page UI.
- List page buttons.
- E2E tests.

Acceptance criteria:

- Frontend code can call preview/apply endpoints.
- Export calls preserve current actor header behavior.
- Export helper can download returned CSV blobs without direct browser navigation.

Suggested commands:

```sh
npm test --workspace @worktrail/web -- worktrail-api
npm run typecheck --workspace @worktrail/web
npm test --workspace @worktrail/web
git diff --check
```

Status: Not started.

## Phase 7: Import Page UI

Goal: add a focused project-scoped import experience.

Scope:

- Add lazy route `projects/:projectId/work-items/import`.
- Add `WorkItemImportPageComponent`.
- Load project context and show archived read-only state.
- Add `.csv` file input.
- Read selected file with `File.text()`.
- Call preview endpoint and render:
  - summary counts;
  - file-level and row-level errors;
  - warnings section when warnings exist;
  - normalized preview rows.
- Disable apply when:
  - no file is selected;
  - preview is loading;
  - preview has errors;
  - preview has zero valid rows;
  - project is archived.
- Call apply endpoint with the same CSV text.
- Render success state with created count and links to created work items, project list, and board.
- Add project list/action entry point for import on active projects.
- Add component tests for initial state, preview loading, error rendering, apply disabled/enabled rules, archived project state, and success links.

Out of scope:

- Paste-based CSV entry.
- Column mapping UI.
- Import history.
- Project settings import link unless implementation reveals it is needed.

Acceptance criteria:

- User can select a CSV, preview it, and apply it from an active project.
- Validation errors are scannable and include row and field context.
- Archived projects do not allow import.
- Page remains usable at desktop, tablet, and mobile widths without text overlap.

Suggested commands:

```sh
npm test --workspace @worktrail/web -- work-item-import
npm run typecheck --workspace @worktrail/web
npm test --workspace @worktrail/web
npm run build --workspace @worktrail/web
git diff --check
```

Status: Not started.

## Phase 8: Export UI Controls

Goal: add CSV export actions to project and workspace work item list surfaces.

Scope:

- Add `Export CSV` action to project work item list.
- Add `Export CSV` action to workspace work item discovery.
- Use current applied project filters for project export.
- Use current applied workspace query for workspace export.
- Avoid exporting draft filter values that have not been applied.
- Add loading/error state for export actions.
- Keep export available for archived projects when the list is visible.
- Add tests for:
  - export button visibility;
  - applied-filter serialization;
  - draft filter changes not affecting export before apply;
  - export failure messaging.

Out of scope:

- Download history.
- Export format chooser.
- CSV preview modal.

Acceptance criteria:

- Project export downloads CSV for the currently visible filtered data set.
- Workspace export downloads CSV for the currently applied discovery filters.
- Export controls do not crowd primary list actions or regress responsive layouts.

Suggested commands:

```sh
npm test --workspace @worktrail/web -- work-item-list
npm test --workspace @worktrail/web -- work-items-page
npm run typecheck --workspace @worktrail/web
npm test --workspace @worktrail/web
npm run build
git diff --check
```

Status: Not started.

## Phase 9: E2E Coverage

Goal: verify the main import workflow in the running application and cover export where stable.

Scope:

- Add Playwright coverage for importing a small valid CSV into a seeded active project.
- Confirm imported work appears in a project work item list or board.
- Confirm normal deterministic reset/seed behavior supports repeatable import tests.
- Add export smoke coverage only if browser download handling is stable in the existing test harness.
- If browser download assertions are brittle, verify export through API tests and document that choice in phase notes.

Out of scope:

- Exhaustive CSV validation through E2E.
- Large-file browser tests.
- Third-party tracker import scenarios.

Acceptance criteria:

- E2E demonstrates that a user can import valid CSV through the UI and see created work.
- Export is covered either by stable E2E download smoke or explicit API-level tests.
- E2E leaves the application in a deterministic state through existing reset/seed setup.

Suggested commands:

```sh
npm run test:e2e
npm run typecheck
npm test
git diff --check
```

Status: Not started.

## Phase 10: OpenAPI And CSV Documentation

Goal: document the new API surface and user-facing CSV format.

Scope:

- Update `docs/api/openapi.yaml` with:
  - import preview endpoint;
  - import apply endpoint;
  - project export endpoint;
  - workspace export endpoint;
  - import request/response schemas;
  - `text/csv` export responses.
- Update the OpenAPI guard test with required path keys.
- Add `docs/v0.0.7/csv-import-export.md`.
- Include:
  - supported columns;
  - required columns;
  - sample CSV;
  - limits;
  - validation behavior;
  - apply behavior;
  - export columns;
  - common troubleshooting cases.

Out of scope:

- Swagger UI.
- Generated OpenAPI.
- Third-party migration guides.

Acceptance criteria:

- API reference includes all import/export endpoints.
- CSV documentation is sufficient for a new evaluator to prepare a valid file.
- Documentation matches implemented limits and behavior.

Suggested commands:

```sh
npm test --workspace @worktrail/api -- openapi
sed -n '1,260p' docs/v0.0.7/csv-import-export.md
npm run typecheck
git diff --check
```

Status: Not started.

## Phase 11: Product Documentation, Site, Extraction Notes, And Version Finalization

Goal: prepare v0.0.7 release-facing materials.

Scope:

- Update `README.md` for:
  - CSV import;
  - dry-run validation;
  - transactional apply;
  - CSV export;
  - limitations.
- Update the static product site for data portability and CSV adoption flows.
- Add `docs/v0.0.7/jawstack-extraction-notes.md`.
- Capture reusable patterns for:
  - file ingestion;
  - dry-run validation;
  - transactional bulk commands;
  - CSV export;
  - endpoint handlers with non-JSON responses;
  - future cloud upload evolution.
- Update root, app, and package versions to `0.0.7` if release/tagging is in scope.
- Update lockfile if versions change.
- Record final verification in this implementation plan.

Out of scope:

- Creating a release tag unless explicitly requested.
- Publishing packages.
- Adding hosted deployment infrastructure.

Acceptance criteria:

- README and product site reflect v0.0.7 capabilities.
- Extraction notes capture reusable patterns without prematurely abstracting them.
- Versions are consistent if bumped.
- Final verification passes or residual issues are documented.

Suggested commands:

```sh
npm run typecheck
npm test
npm run test:e2e
npm run build
npm audit --omit=dev --audit-level=low
npm run db:reset
npm run db:migrate
npm run db:seed
git diff --check
git status --short --branch
```

Status: Not started.

## Release Verification

Expected final verification:

```sh
npm run typecheck
npm test
npm run test:e2e
npm run build
npm audit --omit=dev --audit-level=low
git diff --check
```

Finalization should restore deterministic seed data:

```sh
npm run db:reset
npm run db:migrate
npm run db:seed
```

## Risks And Watchpoints

- Import apply can accidentally drift from single-item creation behavior if creation logic is duplicated.
- Transaction boundaries need careful handling so one bad row never creates partial work.
- CSV validation errors should be user-readable without leaking raw parser details.
- Export can drift from visible filters if query serialization is duplicated on the frontend.
- Direct browser downloads cannot include local actor headers, so frontend export must use `HttpClient`.
- E2E browser download assertions may be brittle; API tests should carry export correctness if needed.
- Adding CSV dependencies should not create a meaningful production bundle issue because they are API-only.
- Import UI can become too wizard-like; keep it compact and operational.
