# Worktrail v0.0.7 Technical Design

## Overview

Worktrail v0.0.7 adds data portability without turning the product into a full migration platform. The release adds:

- project-scoped CSV work item import;
- import dry-run validation;
- transactional import apply;
- project and workspace work item CSV export;
- a focused import UI;
- export actions on existing list pages;
- CSV documentation and OpenAPI updates;
- extraction notes for ingestion and bulk command patterns.

The design preserves current architectural boundaries:

- Angular standalone lazy route components;
- shared contracts in `packages/contracts`;
- transport-neutral endpoint handlers;
- local Express adapter;
- backend service/repository layering;
- Drizzle-managed Postgres schema;
- deterministic seed data;
- production preview from built artifacts.

v0.0.7 should not add persistent import jobs, background workers, multipart infrastructure, third-party tracker adapters, cloud storage, production auth, or schema changes unless implementation reveals a hard need.

## Design Decisions

- Use CSV work item import/export as the data portability MVP.
- Keep import project-scoped. Workspace-wide import is deferred.
- Use a normal frontend file input, but read the file as text in Angular and send JSON to the API. This avoids multipart parsing and keeps endpoint handlers transport-neutral.
- Reject unknown CSV columns instead of warning. This keeps user expectations clear and prevents silent data loss.
- Require referenced labels and milestones to already exist. Import does not create catalog data.
- Resolve `assignee_email` and `reporter_email` against active workspace members.
- Default omitted `reporter_email` to the acting member.
- Rerun validation from the submitted CSV during apply. Do not persist preview state or issue preview tokens in v0.0.7.
- Keep apply transactional. Any apply-time validation or write failure creates no work items.
- Use existing work item creation semantics for display keys, board positions, reporter, labels, milestone validation, and creation activity.
- Add CSV export endpoints as `GET` routes using the same query params as existing list endpoints.
- Keep export synchronous and small-scale.
- Add a mature CSV parser/stringifier dependency rather than hand-rolling CSV escaping/parsing.
- Add no database schema changes for v0.0.7.

## User Flows

### Import Dry Run

1. User opens a project work item context.
2. User opens "Import CSV".
3. User selects a `.csv` file.
4. Angular reads the file text and posts it to the preview endpoint.
5. API validates file size, row count, headers, field values, and references.
6. UI shows summary counts, row errors, and normalized preview rows.
7. Apply is enabled only when there are no errors and at least one valid row.

### Import Apply

1. User reviews a successful dry run.
2. User clicks "Import work items".
3. Angular posts the same CSV text to the apply endpoint.
4. API reruns validation.
5. API writes all rows in one transaction.
6. UI shows created count and links to created work items, project list, and board.

### Export

1. User applies filters on a project work item list or workspace work item discovery page.
2. User clicks "Export CSV".
3. Browser downloads a CSV generated from the same query params.
4. Empty result sets still produce header-only CSV.

## CSV Format

Supported columns:

| Column | Required | Behavior |
| --- | --- | --- |
| `title` | Yes | Existing work item title validation. |
| `type` | Yes | One of `task`, `bug`, `story`, `chore`. |
| `priority` | Yes | One of `low`, `medium`, `high`, `urgent`. |
| `description` | No | Defaults to empty string. |
| `status` | No | Defaults to `backlog`; must be a known status if present. |
| `assignee_email` | No | Must match an active workspace member if present. |
| `reporter_email` | No | Must match an active workspace member if present; defaults to actor. |
| `label_names` | No | Comma-separated active project label names. |
| `milestone_name` | No | Must match an active project milestone. |
| `due_date` | No | `YYYY-MM-DD` or empty. |
| `estimate_points` | No | Non-negative integer or empty. |

Required header set:

```text
title,type,priority
```

Allowed header set:

```text
title,description,type,status,priority,assignee_email,reporter_email,label_names,milestone_name,due_date,estimate_points
```

Unknown headers are file-level validation errors. Missing required headers are file-level validation errors.

### Sample

```csv
title,description,type,status,priority,assignee_email,reporter_email,label_names,milestone_name,due_date,estimate_points
Draft onboarding checklist,Prepare first-week tasks,task,backlog,medium,morgan.maintainer@example.com,avery.owner@example.com,"backend,design",v0.0.3 Planning,2026-07-16,3
Fix board overflow,Column layout needs polish,bug,ready,high,casey.contributor@example.com,avery.owner@example.com,frontend,,2026-07-12,2
Review deployment runbook,,story,in_progress,medium,,avery.owner@example.com,reliability,v0.0.3 Planning,,5
```

## Shared Contracts

Add DTOs to `packages/contracts/src/index.ts`.

```ts
export interface WorkItemCsvImportPreviewRequest {
  csv: string;
}

export interface WorkItemCsvImportApplyRequest {
  csv: string;
}

export interface WorkItemCsvImportErrorDto {
  rowNumber: number | null;
  field: string | null;
  message: string;
}

export interface WorkItemCsvImportWarningDto {
  rowNumber: number | null;
  field: string | null;
  message: string;
}

export interface WorkItemCsvImportPreviewRowDto {
  rowNumber: number;
  title: string;
  type: WorkItemType;
  status: WorkItemStatus;
  priority: WorkItemPriority;
  assigneeEmail: string | null;
  reporterEmail: string;
  labelNames: string[];
  milestoneName: string | null;
  dueDate: string | null;
  estimatePoints: number | null;
}

export interface WorkItemCsvImportPreviewDto {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  errors: WorkItemCsvImportErrorDto[];
  warnings: WorkItemCsvImportWarningDto[];
  rows: WorkItemCsvImportPreviewRowDto[];
}

export interface WorkItemCsvImportApplyDto {
  createdCount: number;
  workItems: WorkItemListItemDto[];
}
```

Notes:

- `rowNumber` is 1-based and includes the header row, so the first data row is `2`.
- File-level errors use `rowNumber: null`.
- v0.0.7 does not need persisted import IDs.

## API Design

Add routes:

```text
POST /api/projects/:projectId/work-items/imports/preview
POST /api/projects/:projectId/work-items/imports
GET  /api/projects/:projectId/work-items/export
GET  /api/work-items/export
```

### Import Preview

Request:

```json
{
  "csv": "title,type,priority\nExample task,task,medium\n"
}
```

Response:

```json
{
  "totalRows": 1,
  "validRows": 1,
  "invalidRows": 0,
  "errors": [],
  "warnings": [],
  "rows": [
    {
      "rowNumber": 2,
      "title": "Example task",
      "type": "task",
      "status": "backlog",
      "priority": "medium",
      "assigneeEmail": null,
      "reporterEmail": "avery.owner@example.com",
      "labelNames": [],
      "milestoneName": null,
      "dueDate": null,
      "estimatePoints": null
    }
  ]
}
```

Status codes:

- `200` for parsed preview, even when row/file validation errors are present.
- `400` for malformed request body or over hard payload limits.
- `403` for actor permission failure.
- `404` for project not found.
- `409` for archived project.

### Import Apply

Request shape is the same as preview. The service reruns validation. If there are any validation errors, return `400` with structured validation details and do not write rows.

Response:

```json
{
  "createdCount": 2,
  "workItems": []
}
```

Implementation may return full `WorkItemListItemDto[]` for created work items to support success links. If the list is too expensive, return a compact created-item DTO. The initial recommendation is to return `WorkItemListItemDto[]` for consistency with list pages.

### Export

Project export:

```text
GET /api/projects/:projectId/work-items/export?status=ready&sort=updated_desc
```

Workspace export:

```text
GET /api/work-items/export?projectId=...&assigneeId=...&archivedProjects=exclude
```

Response:

- `Content-Type: text/csv; charset=utf-8`
- `Content-Disposition: attachment; filename="worktrail-work-items.csv"`

Export should use the same query parsing helpers as list endpoints:

- `parseFilters` for project lists;
- `parseWorkItemQuery` for workspace discovery.

## Endpoint Adapter Change

The current Express adapter always serializes endpoint responses through `response.json`. Export requires a non-JSON body.

Extend `AppResponse` minimally:

```ts
export interface AppResponse<T = unknown> {
  status: number;
  body?: T;
  headers?: Record<string, string>;
}
```

Keep the interface shape, but update the Express adapter:

- if `body` is a string or `Buffer`, send it with `response.status(...).send(body)`;
- otherwise continue using `response.status(...).json(body ?? {})`.

Endpoint handlers remain transport-neutral.

## Backend Service Design

Add `apps/api/src/services/work-item-csv-import-service.ts`.

Responsibilities:

- enforce file size and row limits;
- parse CSV into raw records;
- validate headers;
- normalize row values;
- resolve references;
- produce preview DTOs;
- apply valid imports transactionally;
- delegate actual work item creation semantics to shared helper logic.

Suggested shape:

```ts
export interface WorkItemCsvImportServiceContext {
  actor: ActorContext;
  repositories: Repositories;
  db?: WorktrailDb;
  clock?: () => Date;
  idGenerator?: () => string;
}

export class WorkItemCsvImportService {
  preview(projectId: string, csv: string): Promise<WorkItemCsvImportPreviewDto>;
  apply(projectId: string, csv: string): Promise<WorkItemCsvImportApplyDto>;
}
```

### Shared Creation Helper

Current `WorkItemService.createWorkItem` performs all single-item creation behavior inside a transaction. Bulk import needs the same behavior inside one outer transaction.

Refactor `WorkItemService` carefully:

- extract an internal `createWorkItemWithRepositories(projectId, input, repositories)` helper;
- keep public `createWorkItem` behavior unchanged;
- import service calls the helper repeatedly inside one transaction.

If exposing that helper publicly makes `WorkItemService` too broad, create a small `WorkItemCreationService` used by both `WorkItemService` and import service. Prefer the smaller refactor that changes less code.

### Validation Lookups

Before row-level validation, load scoped lookup data:

- project by ID;
- active workspace members;
- project labels, excluding archived labels;
- project milestones, excluding archived milestones.

Matching rules:

- emails are case-insensitive;
- label names are case-insensitive and trimmed;
- milestone names are case-insensitive and trimmed;
- duplicate label names in one row collapse to one label ID;
- ambiguous duplicates in project catalogs should return a validation error if they exist.

Existing UI prevents duplicate active labels in normal use, but import should still handle ambiguity defensively.

### Limits

Initial hard limits:

- max CSV string size: 1 MiB using UTF-8 byte length;
- max rows: 250 data rows;
- max labels per row: 20;
- max field length: reuse existing validation where possible, otherwise cap individual cells at 10,000 characters before semantic validation.

Return `400` for file size and row-count limit violations.

## CSV Parser And Formatter

Add API dependencies:

- `csv-parse`;
- `csv-stringify`.

Use them in service-level utilities:

```text
apps/api/src/services/csv/
  parse-csv-records.ts
  stringify-csv-records.ts
```

Parser settings:

- `columns: true`;
- `skip_empty_lines: true`;
- trim unquoted field whitespace where safe;
- preserve quoted comma values for `label_names`.

Formatter settings:

- stable column order;
- header row always included;
- values escaped by the library.

Do not parse CSV in the frontend as the authoritative path. The frontend reads file text only.

## Export Service Design

Add `apps/api/src/services/work-item-csv-export-service.ts`.

Responsibilities:

- get project or workspace work items using existing list filters;
- convert DTOs to flat export rows;
- stringify rows to CSV;
- generate deterministic file names.

Suggested export columns:

```text
project_key
display_key
title
type
status
priority
assignee_name
assignee_email
reporter_name
reporter_email
label_names
milestone_name
due_date
estimate_points
created_at
updated_at
```

For project export, `project_key` can be included by fetching the project once and joining it into each row. For workspace export, use `WorkspaceWorkItemListItemDto.project.key`.

## Permission Model

Use existing permissions as much as possible.

Import:

- same permission as normal work item creation;
- active project only;
- actor must be an active member because the adapter already resolves active actors;
- archived project returns `409`.

Export:

- same visibility as current list endpoints;
- no additional write permission required;
- workspace scoping enforced by repositories and service checks.

If there is no explicit role helper for work item creation, preserve current behavior in `WorkItemService.createWorkItem`. v0.0.7 should not invent a different import-only policy.

## Frontend Design

### Route

Add lazy route:

```ts
{
  path: 'projects/:projectId/work-items/import',
  loadComponent: () =>
    import('./features/work-items/work-item-import-page.component').then(
      (module) => module.WorkItemImportPageComponent
    ),
  title: 'Import Work Items | Worktrail'
}
```

Place it before generic project routes.

### Project Work Item List

Add actions:

- `Import CSV` link to `/projects/:projectId/work-items/import` when project is active;
- `Export CSV` button/link for current filters.

For archived projects:

- hide or disable import;
- keep export available.

### Workspace Work Item List

Add `Export CSV` for the current applied filters. Reuse `appliedQuery` rather than draft form state.

### Import Page

New component:

```text
apps/web/src/app/features/work-items/work-item-import-page.component.ts
```

Responsibilities:

- load project summary/details;
- show archived read-only notice if archived;
- file input for `.csv`;
- read selected file text with `File.text()`;
- call preview endpoint;
- render summary counts, errors, warnings, and normalized preview rows;
- enable apply only when preview has no errors and valid rows > 0;
- call apply endpoint with the same CSV text;
- render success summary and created item links.

UI states:

- no file selected;
- preview loading;
- preview errors;
- preview valid;
- apply loading;
- apply success;
- API error.

Do not add a multi-step wizard. Keep the page dense and operational.

### Frontend API Service

Add methods:

```ts
previewWorkItemCsvImport(projectId: string, csv: string): Observable<WorkItemCsvImportPreviewDto>;
applyWorkItemCsvImport(projectId: string, csv: string): Observable<WorkItemCsvImportApplyDto>;
projectWorkItemsExportUrl(projectId: string, filters: WorkItemListFilters): string;
workspaceWorkItemsExportUrl(filters: WorkItemQuery): string;
```

Export can use browser navigation to the URL, because the endpoint returns a file. Actor headers are currently required by API calls. Direct navigation cannot include custom actor headers.

Therefore implement export through `HttpClient` with `responseType: 'blob'` and save it client-side:

```ts
exportProjectWorkItems(projectId, filters): Observable<HttpResponse<Blob>>;
exportWorkspaceWorkItems(filters): Observable<HttpResponse<Blob>>;
```

Use current actor headers through existing `options`.

Add a small frontend helper for downloading a Blob using an object URL.

## Backend Endpoint Design

Add to `apps/api/src/endpoints/work-items.ts`:

- `previewWorkItemCsvImportHandler`;
- `applyWorkItemCsvImportHandler`;
- `exportProjectWorkItemsHandler`;
- `exportWorkspaceWorkItemsHandler`.

Request schemas:

```ts
const csvImportRequestSchema = z.object({
  csv: z.string()
});
```

For export handlers:

- parse query params with existing filter helpers;
- return CSV string body and headers.

Register routes in `apps/api/src/adapters/express/server.ts` near existing work item routes.

## OpenAPI Updates

Update `docs/api/openapi.yaml` with:

- import preview endpoint;
- import apply endpoint;
- project export endpoint;
- workspace export endpoint;
- import request/response schemas;
- `text/csv` response content for export.

Update the OpenAPI guard test to include the new paths.

## Documentation

Add:

```text
docs/v0.0.7/csv-import-export.md
```

Cover:

- supported columns;
- template;
- sample CSV;
- dry-run behavior;
- apply behavior;
- export columns;
- limits;
- troubleshooting common validation errors.

Finalization updates:

- README;
- product site;
- operations runbook only if import/export operational caveats need to be linked from there;
- `docs/v0.0.7/jawstack-extraction-notes.md`.

## Testing Strategy

### API Unit And Integration

Add focused tests for:

- CSV parsing with quoted commas;
- missing required headers;
- unknown headers;
- row count and file size limits;
- valid preview defaults;
- invalid enum values;
- unknown assignee/reporter emails;
- unknown label and milestone names;
- archived project rejection;
- apply success;
- apply validation failure with no partial writes;
- display keys and board positions after import;
- activity event creation after import;
- project export CSV headers and escaping;
- workspace export filters and archived-project modes.

### Frontend Unit

Add tests for:

- import page initial state;
- selected file preview call;
- validation errors table;
- apply disabled when errors exist;
- apply success links;
- export calls include applied filters;
- archived project import disabled state.

### E2E

Extend Playwright smoke coverage:

- import a two-row CSV into the active seeded project;
- confirm imported work appears in project work item list or board;
- export a filtered project or workspace list and verify CSV headers if stable in Playwright;
- rely on existing E2E reset/restore to return to deterministic seed data.

If browser download assertions are brittle, cover export via API tests and keep E2E focused on import.

## Performance And Scale

v0.0.7 intentionally targets small files:

- 1 MiB CSV max;
- 250 data rows max;
- synchronous validation and apply;
- no background jobs;
- no streaming.

This is adequate for local adoption trials and keeps failure handling simple. Larger imports can be introduced later with persisted import batches and background workers.

## Security And Safety

- Enforce actor workspace scoping on every lookup.
- Enforce existing project write rules for import.
- Reject archived project import.
- Reject oversized input before parsing.
- Avoid raw parser errors in user-facing responses.
- Use structured validation errors.
- Escape CSV exports through a CSV library.
- Do not expose data outside the current actor workspace.
- Local actor headers remain development scaffolding.

## Cloud Implications

The local JSON-with-CSV-text API is intentionally simple. A future cloud version can evolve in stages:

1. Keep the same endpoints behind API Gateway/Lambda for small imports.
2. Add S3 pre-signed upload for larger files.
3. Persist import batches and run background validation/apply jobs.
4. Add import history and audit UI.
5. Add third-party adapter-specific column mapping.

The v0.0.7 local implementation should keep parsing and validation in services so these future transports can reuse the core behavior.

## Migration Plan

No database migration is expected.

If implementation discovers a need for persisted import batches, that should be deferred unless required for correctness. v0.0.7 can satisfy the PRD with stateless preview/apply.

## Release Verification

Expected commands:

```sh
npm run typecheck
npm test
npm run test:e2e
npm run build
npm audit --omit=dev --audit-level=low
git diff --check
```

Finalization should also restore deterministic seed data:

```sh
npm run db:reset
npm run db:migrate
npm run db:seed
```

## Open Decisions

1. Should export file names include project key/date or stay generic?
2. Should import success return full created `WorkItemListItemDto[]` or a compact created DTO?
3. Should row-level warnings exist in v0.0.7 if unknown columns are rejected?
4. Should import entry live on the project work item list only, or also project settings?
5. Should E2E assert browser download behavior or leave export verification to API tests?

## Initial Resolutions

- Export file names should include project key when project-scoped and `worktrail-work-items` when workspace-scoped.
- Import apply should return created `WorkItemListItemDto[]`.
- Keep warnings in the DTO for forward compatibility, but v0.0.7 can return an empty warnings array because unknown columns are rejected.
- Put import entry on the project work item list; project settings can link later if users look for it there.
- Verify export thoroughly in API tests; only add E2E download checks if implementation remains stable.
