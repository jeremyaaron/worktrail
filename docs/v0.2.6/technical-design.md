# Worktrail v0.2.6 Technical Design

## Status

Implemented

## Summary

v0.2.6 adds Scalable Work Discovery through bounded, server-backed pagination for project Work and
workspace Work Items.

The implementation will:

- add focused page-window and page-response contracts;
- keep durable work filters in `WorkItemQuery` and transient page state in a separate contract;
- change the two interactive work-list endpoints from arrays to page envelopes;
- add an explicit complete project-board read so board cards are never silently truncated;
- count and read each interactive page inside one read-only repeatable-read transaction;
- clamp stale page numbers to the final current page;
- apply deterministic UUID tie-breakers to every sort;
- enrich only the work items returned on the requested page;
- preserve page state through URLs, browser history, copied links, and detail return URLs;
- strip page state from saved views, active filter chips, and CSV export meaning;
- keep project bulk selection limited to concrete IDs on the visible page;
- cap synchronous CSV exports at 10,000 rows without partial files;
- add PostgreSQL trigram indexes for current case-insensitive substring search;
- add a shared Angular pagination component used by both work-list routes.

The design does not add cursor pagination, snapshot-consistent browsing across separate requests,
infinite scroll, query-wide selection, background exports, board pagination, or a generic pagination
framework.

## Resolved Decisions

### Pagination Model

Use one-based page and offset pagination.

```text
page=1&pageSize=25
offset = (page - 1) * pageSize
```

Supported page sizes are `10`, `25`, `50`, and `100`. The defaults are page `1` and page size `25`.
The server rejects other interactive values.

Rationale:

- users can understand and directly navigate readable page numbers;
- exact totals and total pages are explicit product requirements;
- page state composes naturally with the existing canonical URL model;
- the current sort set can be made deterministic without defining one cursor shape per sort;
- the maximum page size bounds transfer, mapping, enrichment, and rendering work;
- offset cost is acceptable for the expected project-sized result sets in this release;
- cursor pagination remains available when measured deep-page usage justifies its contract complexity.

### Durable Query Versus Transient Window

Keep `WorkItemQuery` unchanged. Add a separate `WorkItemPageQuery`.

```ts
export type WorkItemPageSize = 10 | 25 | 50 | 100;

export interface WorkItemPageQuery {
  page?: number;
  pageSize?: WorkItemPageSize;
}
```

`WorkItemQuery` continues to define the matching result set and sort. `WorkItemPageQuery` defines the
current window over that result.

Rationale:

- saved views should store reusable result intent, not a stale page position;
- filter chips and query-summary counts should not include navigation state;
- exports should use the complete applied filter regardless of current page;
- planning, portfolio, My Work, report, and other links can keep carrying `WorkItemQuery` without
  accidentally becoming paged;
- the separation documents a reusable product distinction without creating a generic query framework.

### HTTP Endpoint Compatibility

Change the existing interactive list endpoints to return page envelopes:

```text
GET /api/projects/:projectId/work-items
GET /api/work-items
```

Add one explicit complete board endpoint:

```text
GET /api/projects/:projectId/board/work-items
```

The board endpoint returns `WorkItemListItemDto[]`, accepts no list filters or paging controls, and
always orders by board order. The work-list endpoints return concrete project or workspace page DTOs.

Rationale:

- list responses should use normal collection URLs rather than `/page` suffixes;
- Worktrail has no supported external API compatibility promise at v0.x;
- all in-repository consumers can move atomically with the contract;
- a dedicated board read makes intentional complete loading visible in code and OpenAPI;
- no caller can bypass page limits by requesting a special large page size;
- internal repository reads used by planning and health remain purpose-specific and do not become HTTP
  escape hatches.

### Page Response Shape

Use a shared metadata interface and concrete collection DTOs.

```ts
export interface WorkItemPageMetadataDto {
  page: number;
  pageSize: WorkItemPageSize;
  totalCount: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

export interface WorkItemListPageDto extends WorkItemPageMetadataDto {
  items: WorkItemListItemDto[];
}

export interface WorkspaceWorkItemListPageDto extends WorkItemPageMetadataDto {
  items: WorkspaceWorkItemListItemDto[];
}
```

Use concrete DTOs instead of exposing a generic `PageDto<T>` in OpenAPI. The metadata interface can
still remove TypeScript duplication without claiming a cross-domain abstraction.

An empty result returns:

```json
{
  "items": [],
  "page": 1,
  "pageSize": 25,
  "totalCount": 0,
  "totalPages": 0,
  "hasPreviousPage": false,
  "hasNextPage": false
}
```

### Count And Row Consistency

Run authorization, exact count, normalized-page calculation, bounded row selection, and DTO
enrichment inside one PostgreSQL transaction configured as:

```ts
{
  isolationLevel: 'repeatable read',
  accessMode: 'read only'
}
```

Rationale:

- the count and page rows observe one database snapshot;
- stale-page clamping cannot race with a write between count and row selection;
- label, hierarchy, member, planning, and dependency enrichment describes the same snapshot as the
  selected rows;
- the transaction is bounded to at most 100 rows and set-based enrichment queries;
- no locks are acquired beyond PostgreSQL's normal MVCC behavior.

Separate page requests remain separate snapshots. Work updated between page requests may move according
to the active sort. v0.2.6 does not promise a frozen multi-page result set.

Service tests that inject repositories without a database continue using sequential repository calls.
Production endpoint paths provide `db` and use the repeatable-read transaction.

### Stale Page Normalization

Clamp a requested page above the final current page.

```ts
const totalPages = Math.ceil(totalCount / pageSize);
const page = totalPages === 0 ? 1 : Math.min(requestedPage, totalPages);
```

The API returns items for the normalized page. If the returned page differs from URL state, Angular
replaces the current history entry with the canonical normalized URL. The normalized response is not
rendered under the stale URL; the route reload confirms the canonical request.

Rationale:

- deletions, filtering, bulk edits, and actor changes can invalidate a previously valid page;
- a controlled final-page recovery is more useful than an unexplained empty list;
- `replaceUrl` prevents the browser Back button from returning immediately to the invalid page;
- the rare second bounded request keeps router state and rendered state unambiguous.

### URL And Saved View Semantics

Canonical URL rules:

- omit `page` when it is `1`;
- omit `pageSize` when it is `25`;
- include non-default paging state in copied links and detail return URLs;
- create browser history entries for user page navigation;
- use `replaceUrl` for canonicalization and stale-page correction;
- reset to page 1 when filters, sort, saved view, page size, project, or actor changes.

Saved view rules:

- saved views continue storing only `WorkItemQuery`;
- create and update requests never receive paging state;
- opening a saved or pinned view starts at page 1 and page size 25;
- active filter chips and meaningful query-field counts ignore paging;
- existing saved view JSON requires no migration.

### Bulk Selection Semantics

Keep explicit-ID, visible-page selection.

- `Select all visible work items` selects only the current response items.
- Any route query change clears selection before the next page is usable.
- Page and page-size changes therefore clear selection through the existing route subscription.
- Bulk requests continue carrying at most the selected visible IDs.
- Successful and unchanged rows clear after apply.
- Failed IDs may remain selected only when they are still present on the reloaded current page, matching
  the existing retry behavior.
- If a mutation invalidates the page, stale-page normalization clears all hidden selection.

No query-wide token or `allMatching` request shape is added.

### CSV Export Boundary

Export ignores paging and reads up to `10_001` raw matching records in applied sort order.

```ts
const synchronousExportLimit = 10_000;
const rows = await repository.listForExport(filters, synchronousExportLimit + 1);

if (rows.length > synchronousExportLimit) {
  throw new ExportLimitExceededError(synchronousExportLimit);
}
```

Only accepted rows are enriched and serialized. This is preferable to a separate preflight count:

- the same bounded query proves whether the limit is exceeded;
- a concurrent insert cannot make an already-approved unbounded read cross the cap;
- no partial CSV is constructed;
- the operation already needs the accepted raw rows;
- the error can state `More than 10,000 work items match. Narrow the applied filters and retry.`

Add `EXPORT_LIMIT_EXCEEDED` to `AppErrorCode` with HTTP `422` and details `{ limit: 10000 }`.
The UI displays the server message in the existing inline export error region.

Exports run through an explicit export repository path and never call the interactive page service in a
loop. Background export is deferred.

### Search Indexing

Preserve current search behavior:

```text
display_key ILIKE %term%
OR title ILIKE %term%
OR description ILIKE %term%
```

Add PostgreSQL `pg_trgm` and GIN trigram indexes for the three searched columns.

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX work_items_display_key_trgm_idx
  ON work_items USING gin (display_key gin_trgm_ops);
CREATE INDEX work_items_title_trgm_idx
  ON work_items USING gin (title gin_trgm_ops);
CREATE INDEX work_items_description_trgm_idx
  ON work_items USING gin (description gin_trgm_ops);
```

Rationale:

- B-tree indexes cannot generally serve a leading-wildcard substring search;
- PostgreSQL can combine trigram indexes for the current `OR` predicate with bitmap operations;
- result semantics remain unchanged;
- local PostgreSQL includes `pg_trgm`, and [Amazon RDS documents it as a supported trusted PostgreSQL
  extension](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/PostgreSQL.Concepts.General.FeatureSupport.Extensions.html);
- write and storage overhead is acceptable for the current work-item mutation rate.

Very short search terms may still scan broadly. The API page cap bounds response and enrichment cost,
while exact count still reflects all matches. Search ranking and minimum-term rules are deferred.

## Current Implementation Context

### Shared Contracts

`packages/contracts/src/work-items.ts` currently defines:

- `WorkItemQuery` for durable filter and sort state;
- project and workspace work item row DTOs;
- hierarchy, dependency, risk, cycle, milestone, and saved-view-compatible fields;
- no page input or response metadata.

Saved view request and response types embed `WorkItemQuery`. Keeping pagination outside this interface
avoids a saved-view migration and prevents page fields from reaching backend normalization.

### HTTP Endpoints

The current endpoints return arrays:

```text
GET /api/projects/:projectId/work-items -> WorkItemListItemDto[]
GET /api/work-items                     -> WorkspaceWorkItemListItemDto[]
```

The Angular project list, workspace list, project board, and relationship-candidate search use these
two HTTP reads. The board requests `sort=board_order`; relationship search requests workspace search
sorted by updated time.

### Backend Services

`WorkItemService.listWorkItems` and `listWorkspaceWorkItems` currently perform complete repository
reads and then set-based DTO enrichment. Backend services such as My Work use these methods directly,
while planning, portfolio, reports, cycle review, and project summary use repository reads for their
own purpose-specific derivation.

v0.2.6 must not turn those internal calls into paged data accidentally. New page service methods will
be added alongside existing complete internal reads. Complete methods remain non-HTTP implementation
details unless explicitly exposed by the board endpoint.

### Repository Queries

`work-item-query-builder.ts` already centralizes:

- project and workspace conditions;
- current search behavior;
- hierarchy `exists` and exact-parent filters;
- label and dependency `exists` filters;
- work-risk and due-date conditions;
- sort expressions.

Repository list methods currently add ordering but no `limit` or `offset`. Existing conditions avoid
row-multiplying joins except for the workspace's one-to-one project join, so `count(*)` remains exact.

### Angular Query State

`WorkListQueryStore` currently owns:

- active and pending filter form values;
- derived `WorkItemQuery` values;
- route query parsing and serialization;
- copy and return URL generation;
- saved-view query summaries.

Both list route components subscribe to `queryParamMap`, synchronize the filter form, clear relevant
selection, and load work. This is the correct route-driven lifecycle to extend with a separate active
page signal.

### Result Rendering And Bulk Triage

`WorkItemResultListComponent` renders one shared desktop table/mobile card collection. Its heading uses
`items.length`, which becomes the visible count rather than the result total after paging.

`ProjectBulkTriageStore` already works with explicit IDs and has visible-row helpers. The route
subscription clears selection. The design requires terminology and regression coverage, not a new
selection architecture.

### CSV Export

`WorkItemCsvExportService` currently calls complete `WorkItemService` list methods and builds the CSV in
memory. v0.2.6 keeps direct in-memory file generation but replaces the unbounded read with a guarded
export-specific path.

## Contract Design

### Page Input

Add to `packages/contracts/src/work-items.ts`:

```ts
export const workItemPageSizes = [10, 25, 50, 100] as const;
export type WorkItemPageSize = (typeof workItemPageSizes)[number];

export interface WorkItemPageQuery {
  page?: number;
  pageSize?: WorkItemPageSize;
}

export interface ResolvedWorkItemPageQuery {
  page: number;
  pageSize: WorkItemPageSize;
}
```

`ResolvedWorkItemPageQuery` is useful at validated backend and frontend state boundaries. It is not a
saved-view field.

### Page Metadata And Collections

```ts
export interface WorkItemPageMetadataDto extends ResolvedWorkItemPageQuery {
  totalCount: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

export interface WorkItemListPageDto extends WorkItemPageMetadataDto {
  items: WorkItemListItemDto[];
}

export interface WorkspaceWorkItemListPageDto extends WorkItemPageMetadataDto {
  items: WorkspaceWorkItemListItemDto[];
}
```

Do not add a generic serialized `PageDto<T>` yet. If another domain later needs the identical metadata
and semantics, extraction can follow evidence.

### Export Error

`EXPORT_LIMIT_EXCEEDED` remains an API error code rather than a work-item response DTO. OpenAPI should
show:

```json
{
  "error": {
    "code": "EXPORT_LIMIT_EXCEEDED",
    "message": "More than 10,000 work items match. Narrow the applied filters and retry.",
    "details": {
      "limit": 10000
    }
  }
}
```

No partial-content response or downloadable error body is returned.

## Query Validation Design

### Endpoint Parsing

Add `apps/api/src/validation/work-item-page-query.ts` with:

```ts
const workItemPageQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number()
    .pipe(z.union([z.literal(10), z.literal(25), z.literal(50), z.literal(100)]))
    .default(25)
});
```

The exact Zod composition may change to preserve inferred types, but behavior must remain strict.

`firstQueryValue` and empty-string normalization should move to a small shared query-value helper if
both work-item parsers need them. Do not build a generic HTTP parameter package.

`parseWorkItemPageQuery(request.query)` returns a required resolved shape. It ignores unrelated filter
keys because filter parsing remains separate.

### Validation Outcomes

Examples:

| Input | Outcome |
| --- | --- |
| absent | `{ page: 1, pageSize: 25 }` |
| `page=3&pageSize=50` | `{ page: 3, pageSize: 50 }` |
| `page=0` | `400 VALIDATION_ERROR` |
| `page=-1` | `400 VALIDATION_ERROR` |
| `page=1.5` | `400 VALIDATION_ERROR` |
| `page=abc` | `400 VALIDATION_ERROR` |
| `pageSize=20` | `400 VALIDATION_ERROR` |
| repeated value | first value, matching existing query behavior |

The frontend tolerantly removes invalid paging URL values before making the request, but direct API
requests remain strict.

### Work Query Compatibility

Do not add `page` or `pageSize` to `workItemQuerySchema`, `normalizeWorkItemQuery`, saved-view schemas,
query chip labels, or planning link contracts.

Export endpoint parsing continues selecting only durable filter keys. Direct `page` and `pageSize`
parameters on export URLs are ignored and have no effect on the file.

## Repository Design

### Canonical Conditions

Retain:

```ts
buildProjectWorkItemConditions(projectId, filters)
buildWorkspaceWorkItemConditions(workspaceId, filters)
```

Use these exact arrays in both count and page-row methods. Do not duplicate filter branches inside
count code.

### Deterministic Ordering

Append `asc(workItems.id)` to every order sequence after current semantic keys.

Representative orders become:

```text
updated_desc:
  updated_at desc, [project_key asc], item_number asc, id asc

priority_desc:
  priority_rank desc, updated_at desc, [project_key asc], item_number asc, id asc

due_date_asc:
  due_date asc nulls last, [project_key asc], item_number asc, id asc

board_order:
  [project_key asc], status asc, board_position asc, item_number asc, id asc
```

`item_number` is project-unique and project key is workspace-unique, but the UUID remains the explicit
final guarantee and keeps future schema changes from weakening order stability.

### Count Methods

Add:

```ts
countByProjectQuery(projectId, filters): Promise<number>
countByWorkspaceQuery(workspaceId, filters): Promise<number>
```

Project count:

```sql
select count(*)
from work_items
where <project and canonical common conditions>;
```

Workspace count retains the project join because archived-project conditions reference project status:

```sql
select count(*)
from work_items
join projects on projects.id = work_items.project_id
where <workspace, archive, and canonical common conditions>;
```

Current label, dependency, and parent filters use `exists`, so no `distinct` is needed. Repository tests
must guard this assumption.

### Page Methods

Add:

```ts
listPageByProject(projectId, filters, window): Promise<WorkItem[]>
listPageByWorkspace(workspaceId, filters, window): Promise<WorkspaceWorkItemRecord[]>
```

where:

```ts
interface WorkItemPageWindow {
  limit: WorkItemPageSize;
  offset: number;
}
```

Each method applies canonical conditions, deterministic ordering, `.limit(limit)`, and `.offset(offset)`.
No enrichment joins are added to the page query.

### Complete Board Method

Add or name explicitly:

```ts
listByProjectForBoard(projectId): Promise<WorkItem[]>
```

It uses project scope and fixed `board_order`, with no public filters or page window. Existing
`listByProjectAndStatusForBoard` remains available for transactional move calculations.

The general existing `listByProject` and `listByWorkspace` methods remain for internal planning and
health derivation in v0.2.6. Their names should receive comments documenting that they are not for
interactive HTTP collection endpoints. A broad rename across all services is unnecessary churn.

### Export Methods

Add:

```ts
listByProjectForExport(projectId, filters, limit): Promise<WorkItem[]>
listByWorkspaceForExport(workspaceId, filters, limit): Promise<WorkspaceWorkItemRecord[]>
```

They use canonical filters and sort, apply the deterministic tie-breaker, and always require a finite
positive limit supplied by the service. The service supplies only `10_001`.

### Search Migration

Generate migration `0016_*` after adding schema index declarations where Drizzle supports the trigram
operator class. If Drizzle cannot represent `gin_trgm_ops` without unsafe type workarounds, commit the
extension and indexes as explicit SQL and update migration metadata consistently.

Migration requirements:

- use `CREATE EXTENSION IF NOT EXISTS pg_trgm`;
- create three named GIN indexes;
- avoid rewriting work-item rows;
- verify subsequent `npm run db:generate` does not attempt to remove the indexes;
- test against a fresh local database and the CI PostgreSQL service;
- document that the migration role needs extension-creation permission.

Do not remove the existing project title B-tree index without measured evidence; it may serve exact or
prefix uses outside the substring predicate.

## Read Transaction Design

### Repository Helper

Add a focused helper beside `withRepositoriesTransaction`:

```ts
export async function withRepositoriesReadTransaction<T>(
  db: WorktrailDb,
  callback: (repositories: Repositories) => Promise<T>
): Promise<T> {
  return db.transaction(
    (tx) => callback(createRepositories(tx as unknown as WorktrailDb)),
    {
      isolationLevel: 'repeatable read',
      accessMode: 'read only'
    }
  );
}
```

Keep the existing write helper unchanged. Do not make every read transactional.

### Page Algorithm

Project page:

```text
1. Start read-only repeatable-read transaction when db is available.
2. Load the project through transaction repositories.
3. Reject a missing or cross-workspace project as 404.
4. Count matching rows with canonical filters.
5. Calculate total pages and clamp the requested page.
6. Calculate offset from the normalized page.
7. Read at most pageSize raw rows.
8. Enrich only those rows through transaction repositories.
9. Return items and derived metadata.
10. Commit the read transaction.
```

Workspace page omits project lookup and always scopes count and rows to `actor.workspaceId` plus archive
mode.

Metadata helper:

```ts
function resolvePageMetadata(
  requested: ResolvedWorkItemPageQuery,
  totalCount: number
): WorkItemPageMetadataDto {
  const totalPages = Math.ceil(totalCount / requested.pageSize);
  const page = totalPages === 0 ? 1 : Math.min(requested.page, totalPages);

  return {
    page,
    pageSize: requested.pageSize,
    totalCount,
    totalPages,
    hasPreviousPage: totalPages > 0 && page > 1,
    hasNextPage: totalPages > 0 && page < totalPages
  };
}
```

Use normal safe JavaScript number handling. PostgreSQL counts are converted to numbers in the
repository as existing count methods do. A single Worktrail workspace cannot approach JavaScript's
safe integer limit under this product contract.

### Export Algorithm

Run project authorization, bounded raw export read, limit check, DTO enrichment, and serialization
inputs inside a read-only repeatable-read transaction. CSV stringification may occur after the
transaction from fully materialized DTOs.

```text
1. Start read transaction.
2. Authorize project/workspace scope.
3. Read at most 10,001 raw matching rows.
4. If 10,001 rows returned, throw ExportLimitExceededError.
5. Enrich accepted rows in sets.
6. Commit transaction.
7. Convert DTOs to records and stringify CSV.
```

This keeps the transaction free of file-formatting work while preserving coherent row context.

## Backend Service Design

### WorkItemService Methods

Add:

```ts
listWorkItemPage(
  projectId: string,
  filters: WorkItemListFilters,
  pageQuery: ResolvedWorkItemPageQuery
): Promise<WorkItemListPageDto>

listWorkspaceWorkItemPage(
  filters: WorkItemQuery,
  pageQuery: ResolvedWorkItemPageQuery
): Promise<WorkspaceWorkItemListPageDto>

listProjectBoardWorkItems(projectId: string): Promise<WorkItemListItemDto[]>
```

Keep existing complete list methods for internal domain services during this release. The new HTTP list
handlers call only page methods. The board handler calls only the board method.

`listProjectBoardWorkItems`:

- requires the project through actor workspace scope;
- calls the fixed board repository read;
- reuses current set-based DTO mapping;
- accepts no caller-selected filters or page size.

### DTO Enrichment

The existing `toListDtos` and `toWorkspaceListDtos` methods already batch by the IDs passed to them.
Page methods pass only returned page rows, so:

- label reads cover at most 100 work IDs;
- dependency counts cover at most 100 work IDs;
- parent identities cover only page children;
- child summaries cover only page parents;
- members, milestones, cycles, and projects remain set-based;
- no N+1 query is introduced.

Board and internal complete reads keep current enrichment behavior.

### Relationship Candidate Adaptation

The relationship candidate UI currently uses the workspace list endpoint as a search endpoint. Keep it
bounded by requesting:

```ts
{ page: 1, pageSize: 25 }
```

and consume `response.items` before excluding the current item. Do not add another relationship
candidate endpoint in this release. Parent candidate search keeps its existing focused 20-row endpoint.

The UI should continue requiring a deliberate search action and should explain when only the first 25
matches are shown if the response has another page. A user can refine the search; pagination controls
are not added inside the relationship picker.

### My Work And Other Internal Reads

Do not replace internal complete reads mechanically. My Work derives exact summary counts and bounded
sections from purpose-specific query results. Planning and reporting derive aggregate health from
project reads. Those paths require separate aggregate/read-model work before they can stop reading all
matching records safely.

Document this residual scale risk rather than pretending interactive list pagination solves every
read. v0.2.6 establishes a contract that later aggregate work may inform, but does not broaden scope.

## Endpoint Design

### Project Work Page

```text
GET /api/projects/:projectId/work-items
```

Query:

- existing project `WorkItemQuery` fields;
- `page` optional positive integer;
- `pageSize` optional `10 | 25 | 50 | 100`.

Response: `200 WorkItemListPageDto`.

Errors:

- `400 VALIDATION_ERROR` for malformed filters or paging;
- `404 NOT_FOUND` for missing or cross-workspace project.

### Workspace Work Page

```text
GET /api/work-items
```

Query:

- existing workspace `WorkItemQuery` fields;
- `page` and `pageSize` as above.

Response: `200 WorkspaceWorkItemListPageDto`.

Errors:

- `400 VALIDATION_ERROR` for malformed or contradictory query state.

### Project Board Work

```text
GET /api/projects/:projectId/board/work-items
```

Response: `200 WorkItemListItemDto[]` in fixed board order.

Errors:

- `404 NOT_FOUND` for missing or cross-workspace project.

The endpoint ignores no public paging escape hatch because none is accepted. OpenAPI should state that
it is a complete operational board projection and remains a documented large-project limitation.

### CSV Export

Existing routes remain:

```text
GET /api/projects/:projectId/work-items/export
GET /api/work-items/export
```

They accept durable filters and sort only. Add `422 EXPORT_LIMIT_EXCEEDED` to both.

### Route Ordering

Register the static board and export routes before any future parameterized project work-item routes.
Current global detail routes do not conflict, but explicit ordering keeps Express behavior obvious.

## Frontend API Design

### WorkItemsApi

Change:

```ts
listWorkItems(
  projectId: string,
  filters: WorkItemQuery,
  page: ResolvedWorkItemPageQuery
): Observable<WorkItemListPageDto>

listWorkspaceWorkItems(
  filters: WorkItemQuery,
  page: ResolvedWorkItemPageQuery
): Observable<WorkspaceWorkItemListPageDto>
```

Add:

```ts
listProjectBoardWorkItems(projectId: string): Observable<WorkItemListItemDto[]>
```

Update `WorktrailApiService` delegation with the same types. The relationship candidate search consumes
`.items`. The board switches to the dedicated method.

Keep export methods accepting only `WorkItemQuery`.

### HTTP Parameters

Add a focused composer:

```ts
function workItemPageRequestToHttpParams(
  query: WorkItemQuery,
  page: ResolvedWorkItemPageQuery
): HttpParams
```

It starts from durable work-item params, then includes resolved `page` and `pageSize`. API requests may
send defaults explicitly even though router URLs omit them. Explicit API defaults simplify request logs
and tests.

Do not change `workItemQueryToHttpParams`, because exports and non-page callers rely on durable-only
behavior.

## Angular State Design

### Page Serialization Helpers

Add `work-item-page-query-serialization.ts` with pure functions:

```ts
export const defaultWorkItemPageQuery = {
  page: 1,
  pageSize: 25
} as const;

export function workItemPageQueryFromParams(
  params: QueryParamReader
): ResolvedWorkItemPageQuery;

export function routerQueryParamsFromWorkItemPage(
  page: ResolvedWorkItemPageQuery
): RouterQueryParams;

export function mergeWorkItemRouteParams(
  queryParams: RouterQueryParams,
  page: ResolvedWorkItemPageQuery
): RouterQueryParams;
```

Parsing accepts only positive integer pages and supported sizes. Invalid browser values normalize to
defaults and are removed through canonical URL replacement. This tolerant browser behavior does not
weaken direct API validation.

### WorkListQueryStore Extension

Extend the existing store with:

```ts
readonly activePageQuery: WritableSignal<ResolvedWorkItemPageQuery>;

applyRouteQueryParams(params): TFormValue;
routerQueryParamsForPage(page: number): RouterQueryParams;
routerQueryParamsForPageSize(pageSize: WorkItemPageSize): RouterQueryParams;
returnUrl(path: string): string;
filteredViewUrl(path: string, origin: string): string;
```

Behavior:

- `applyRouteQueryParams` updates active filters, pending filters, and active page window;
- `pendingRouterQueryParams` contains pending durable filters with default paging, so Apply resets page;
- `routerQueryParamsFromQuery(savedView.query)` contains default paging, so opening a view resets page;
- `routerQueryParamsForPage` combines the active durable query with the requested page and current size;
- `routerQueryParamsForPageSize` combines the active query with page 1 and the new size;
- `returnUrl` and `filteredViewUrl` include current active page state;
- `meaningfulFieldCount` continues examining durable query state only.

Do not add page controls to the filter form. Page navigation is immediate applied state, not draft
filter state.

### Response State

Each list route owns:

```ts
readonly pageMetadata = signal<WorkItemPageMetadataDto>({
  page: 1,
  pageSize: 25,
  totalCount: 0,
  totalPages: 0,
  hasPreviousPage: false,
  hasNextPage: false
});
```

On response:

1. Compare response page and size with active route state.
2. If normalized values differ, navigate with merged canonical params and `replaceUrl: true`; do not
   commit stale-URL rows.
3. Otherwise set items and metadata together.
4. Prune project selection to returned rows.
5. Merge labels from returned rows into filter option state.
6. Complete loading state and focus the result heading if navigation requested it.

Cancel an in-flight list HTTP subscription before starting another. Rapid page or history navigation
must not allow an older response to overwrite newer route state.

### User Navigation Methods

Both list routes add:

```ts
goToPage(page: number): void
changePageSize(pageSize: WorkItemPageSize): void
```

`goToPage` clamps only against currently known metadata for UI controls, sets a focus-after-load flag,
clears project selection, and uses normal router navigation. The server remains authoritative if data
changes before the request.

`changePageSize` always requests page 1, clears selection, and uses normal history navigation.

Filter Apply, Reset/Clear, chip removal, saved-view open, pinned-view open, and project changes already
construct durable query params without page state and therefore reset to defaults.

### Actor Changes

Track selected actor identity in the list route. When it changes after initial load:

- clear selection and mutation feedback;
- navigate to page 1 with current durable filters and default page size;
- reload project/workspace metadata already tied to actor capability where necessary.

Current seeded actors share one workspace, but the state rule prevents a future workspace switch from
retaining an invalid page position.

## Pagination Component Design

### Component Boundary

Add:

```text
apps/web/src/app/features/work-items/components/work-item-pagination.component.ts
```

Inputs:

```ts
@Input({ required: true }) metadata!: WorkItemPageMetadataDto;
@Input() disabled = false;
```

Outputs:

```ts
@Output() pageChange = new EventEmitter<number>();
@Output() pageSizeChange = new EventEmitter<WorkItemPageSize>();
```

The component is presentational. It does not inject Router, ActivatedRoute, API services, or saved-view
state.

### Page Number Window

Render a bounded set of page buttons:

- always first page;
- always last page when different;
- current page;
- one page on each side of current;
- ellipsis tokens where a gap exists.

Examples:

```text
1 2 3 ... 12
1 ... 5 6 7 ... 12
1 ... 10 11 12
```

Previous and Next remain clear text commands consistent with existing Worktrail controls. Do not add an
icon dependency for two controls. Numeric page buttons provide direct navigation and use
`aria-current="page"` on the current page.

The component shows:

- `Page X of Y` when results exist;
- Previous and Next;
- bounded numeric buttons on widths that support them;
- a labeled `Items per page` native select;
- no false `Page 1 of 0` text for an empty result.

At mobile widths, hide non-current numeric buttons and retain Previous, `Page X of Y`, Next, and page
size. Controls may wrap but cannot overflow horizontally.

### Result Summary

Update `WorkItemResultListComponent` to accept page metadata or explicit `totalCount`, `rangeStart`, and
`rangeEnd`. Prefer one metadata input to prevent contradictory parent calculations.

Heading examples:

```text
1-25 of 63 work items
51-63 of 63 work items
1 work item
0 work items
```

Use the response page and item count to calculate the end range so a concurrent or normalized final
page cannot display an impossible value.

The heading receives `tabindex="-1"` and a component method for programmatic focus after page
navigation. Initial load does not steal focus.

### Placement

- Keep the result summary in the existing list heading above rows.
- Place one pagination component below the result table/cards.
- Do not duplicate interactive controls above and below the list.
- Hide the paging component when `totalCount` is `0`.
- Keep the page-size selector visible whenever `totalCount > 10`, even if all rows fit the current page
  size, so seeded projects can demonstrate the 10-row window.
- Disable paging controls while a new page is loading.

### Loading And Error Behavior

- Preserve the current loading and error panels inside `WorkItemResultListComponent`.
- Keep the prior metadata out of the live result heading once a new route request begins; mark the
  results region `aria-busy="true"`.
- Disable page controls during load to prevent duplicate requests.
- Retry uses the current route page and filters.
- A failed request keeps URL state and shows a retry path; it does not silently move pages.
- A normalized stale page uses replacement navigation before rendering the final result.

## Saved View Design

No saved-view contract or persistence migration is required.

Create and update continue sending:

```ts
query: this.queryState.activeQuery()
```

`activeQuery()` remains `WorkItemQuery`, not an intersection with page state.

Opening a saved view continues using `routerQueryParamsFromQuery(savedView.query)`. The updated helper
omits page and page size, producing page 1 at default size.

Tests must prove:

- save on page 3 stores no paging keys;
- update query on page 3 stores no paging keys;
- open from page 3 resets page and size;
- pinned open behaves identically;
- meaningful filter counts and summaries do not include page state;
- old saved views open unchanged.

## Bulk Triage Design

The store already exposes `toggleAllVisible`, `selectedVisibleCount`, and `pruneSelectionToVisible`.
Retain these methods.

Changes:

- ensure route changes caused only by page or page size still call `clearSelection`;
- keep list checkbox accessible name `Select all visible work items`;
- change supporting copy to `selected on this page` where a count could be ambiguous;
- cancel/disable an in-flight bulk request before paging controls can be used;
- after apply, reload the current route window;
- preserve only failed IDs that remain on that page;
- normalize to the final current page when results shrink.

No endpoint or bulk request contract change is needed.

## CSV Design

### Service Context

Add optional `db` to `WorkItemCsvExportServiceContext` and pass `context.db` from both export handlers
and Express route registration.

Use `withRepositoriesReadTransaction` when available. Tests can continue injecting repositories only.

### Limit Error

Add:

```ts
export class ExportLimitExceededError extends AppError {
  constructor(limit: number) {
    super({
      code: 'EXPORT_LIMIT_EXCEEDED',
      status: 422,
      message: `More than ${limit.toLocaleString('en-US')} work items match. Narrow the applied filters and retry.`,
      details: { limit }
    });
  }
}
```

Avoid locale-dependent server output if tests or runtimes make `toLocaleString` inconsistent; a fixed
formatter or literal for the configured constant is acceptable.

### Ordering And Contents

Exports retain the applied `WorkItemQuery.sort`, canonical deterministic tie-breaker, and all current
columns. Page and page size never reach the export repository method.

The existing direct `text/csv` response and content-disposition behavior remain unchanged under the
limit.

## PostgreSQL Performance Design

### Representative Measurement

Before and after trigram indexes, capture `EXPLAIN (ANALYZE, BUFFERS)` for generated local data with at
least:

- 10,000 work items in one workspace;
- multiple active and archived projects;
- labels and dependencies on representative subsets;
- common updated, priority, due-date, and search queries;
- first and deeper page offsets;
- count and page-row variants.

Do not commit 10,000 rows to the default seed. Use a temporary script, SQL fixture, or repository test
setup that is not part of normal product data.

Expected evidence:

- page-row queries include `Limit` and do not enrich non-page rows;
- common project/workspace updated sorts can use existing scope/order indexes where selective;
- search terms of three or more useful characters can use trigram bitmap index scans;
- count queries do not multiply rows;
- deeper offset cost is documented rather than hidden.

Do not set a hardware-specific latency acceptance threshold in CI. Record plan shape and representative
local timing in the implementation plan phase status.

### Index Tradeoffs

GIN trigram indexes increase storage and work-item title/description write cost. Worktrail reads and
searches work more frequently than it rewrites descriptions, making the tradeoff appropriate.

Do not add speculative compound indexes for every filter/sort combination. Existing project/workspace
scope indexes plus measured trigram support are sufficient for v0.2.6.

### Payload Bound

Interactive responses contain no more than 100 shallow work-list DTOs. Exact byte size varies with
titles, labels, member names, and hierarchy context, but it no longer grows linearly with all matching
workspace history.

The board, internal aggregate reads, and accepted 10,000-row exports remain documented exceptions.

## OpenAPI Design

Update `docs/api/openapi.yaml` with:

- API version `0.2.6` during release finalization;
- reusable `page` query parameter;
- reusable `workItemPageSize` query parameter with enum and default;
- `WorkItemPageMetadata` schema fields and bounds;
- concrete `WorkItemListPage` and `WorkspaceWorkItemListPage` schemas;
- changed success responses for project and workspace list routes;
- normalized stale-page behavior descriptions;
- empty-page example;
- `GET /projects/{projectId}/board/work-items`;
- complete-board response and limitation description;
- `422 EXPORT_LIMIT_EXCEEDED` response and example for both CSV endpoints;
- deterministic current-data, not snapshot, semantics;
- export paging-independence and 10,000-row limit.

Do not describe page fields as members of saved view query schemas.

## Seed Design

Do not add synthetic filler projects or dozens of low-quality work items.

The current deterministic seed already provides:

- 18 `WT-*` work items in the main project;
- more than 10 active-workspace items across projects;
- multiple statuses, priorities, assignees, due dates, dependencies, cycles, milestones, and hierarchy
  states.

Using page size 10 demonstrates:

- a two-page project list;
- a multi-page workspace list;
- a partial final page;
- filtering that reduces page count;
- current hierarchy and dependency row context.

Add seed assertions for expected minimum project and workspace counts rather than coupling tests to an
exact total where later credible seed examples may grow.

Large repository and export-limit scenarios use generated test fixtures, not default seed data.

## Testing Strategy

### Contract Tests

Cover:

- page-size literal union;
- resolved page input;
- project and workspace page DTOs;
- all existing row fields inside page items;
- durable `WorkItemQuery` remaining free of page keys;
- saved view requests remaining `WorkItemQuery` only;
- API client return types;
- exact zero-result metadata shape.

### Query Validation Tests

Cover:

- absent defaults;
- each allowed page size;
- positive page numbers;
- zero, negative, fractional, nonnumeric, repeated, and unsupported values;
- project and workspace composition with every representative filter family;
- page parser separation from work query parser;
- export parser ignoring page inputs.

### Repository Tests

Use generated records to cover:

- 63 matches over page sizes 10, 25, 50, and 100;
- first, middle, and partial final pages;
- exact counts for project and workspace scope;
- active, included, and archived-only project totals;
- label, dependency, hierarchy, search, state, and planning filters;
- no duplicate counts from `exists` predicates;
- deterministic order where all primary sort values match;
- UUID final tie-breaker;
- finite export `limit + 1` behavior;
- fixed complete board ordering;
- search migration availability on a fresh database.

### Service Tests

Cover project and workspace page methods:

- authorization before data exposure;
- correct count, total pages, and booleans;
- empty result metadata;
- stale page clamping;
- exact final-page item count;
- enrichment limited to returned IDs;
- project identity on workspace rows;
- current hierarchy and dependency DTOs;
- fallback behavior when only repositories are injected;
- repeatable-read helper use in integration coverage.

Cover board:

- complete result beyond 100 records;
- board-order sorting;
- actor project scope;
- no paging/filter inputs.

Cover export:

- 10,000 accepted rows;
- 10,001 rejected before enrichment/stringification;
- controlled code, status, message, and details;
- no partial body;
- all-filtered ordering independent of current page;
- project and workspace authorization.

Use fakes for the 10,001 boundary where possible; do not make routine tests insert 10,001 fully enriched
database records.

### Endpoint Tests

Cover:

- default and explicit paging responses;
- invalid paging mapped to `400`;
- normalized stale page response;
- workspace archive modes and scope;
- project not-found behavior;
- board endpoint complete response;
- changed list response envelopes;
- relationship candidate adaptation through first-page items;
- export `422` mapping;
- OpenAPI route agreement.

### Angular Serialization And Store Tests

Cover:

- default omission;
- non-default page and size serialization;
- invalid route value normalization;
- filter Apply resetting paging;
- page navigation preserving active filter and pending draft state;
- page-size change resetting page;
- copy links and return URLs including paging;
- saved-view serialization excluding paging;
- filter chip counts excluding paging;
- project versus workspace supported-key stripping;
- browser history navigation input;
- stale-page replacement params.

### Angular Component Tests

Pagination component:

- range of page number tokens near start, middle, and end;
- ellipsis behavior;
- current page `aria-current`;
- previous/next disabled states;
- direct page output;
- page-size output;
- empty result behavior;
- mobile class/layout contract;
- accessible names and labels.

List routes:

- API page request and response mapping;
- total result heading rather than `items.length` alone;
- in-flight request cancellation;
- stale-page replacement navigation;
- focus after page navigation but not initial load;
- retry on the same window;
- saved and pinned view reset;
- detail return URL;
- copy link;
- visible-page selection clearing;
- bulk reload and page normalization;
- relationship candidate `.items` handling and `hasNextPage` hint;
- board use of the dedicated API method.

### Browser Tests

Using deterministic seed and page size 10:

1. Open project Work and switch to 10 items per page.
2. Verify exact range, page controls, and second-page rows.
3. Reload and use Back/Forward to verify URL restoration.
4. Open a work item and return to the same page.
5. Apply a filter from page 2 and verify page 1.
6. Open a saved and pinned view and verify default paging.
7. Enter project bulk mode, select all visible rows, change page, and verify selection clears.
8. Export from page 2 and verify CSV row count covers the complete filtered set.
9. Repeat representative paging on workspace Work Items.
10. Verify board card counts and drag/drop remain complete.
11. Verify desktop, narrow desktop, mobile, keyboard, and 200 percent zoom behavior.

Do not make the browser suite create 10,001 items. Export-limit behavior belongs in service/endpoint
tests.

### Full Verification

Run:

```sh
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
```

Also inspect the production build for unexplained budget warnings and the public site at desktop/mobile
widths during finalization.

## Accessibility And Responsive Design

- Use native buttons and select controls.
- Use visible `Items per page` labeling.
- Apply `aria-current="page"` to the current numeric control.
- Keep disabled state native on unavailable Previous and Next controls.
- Use a concise polite live region for completed range changes.
- Set the result region `aria-busy` during requests.
- Move focus to the result heading only after user-initiated page navigation.
- Keep initial load, background retry, and ordinary filter Apply from stealing focus unexpectedly.
- Keep numeric controls stable in width for one through three digits.
- At mobile widths, remove optional numeric neighbors rather than shrinking text.
- Ensure controls wrap without horizontal page overflow.
- Verify 200 percent zoom, long titles, keyboard-only operation, and screen-reader naming.
- Keep page selection semantics in visible copy near bulk controls.

## Security And Permissions

- Page parsing occurs before service execution but does not replace authorization.
- Project authorization happens before count metadata is returned.
- Workspace count and rows always scope to `actor.workspaceId`.
- Archived-project filters are applied identically to count and rows.
- Exact totals cannot reveal cross-workspace records.
- The board endpoint performs the same project scope check as project Work.
- Export limit errors occur only after actor/project scope is established, so they do not reveal an
  unauthorized result size.
- Page offsets are calculated only from validated positive bounded values.
- No user-controlled SQL fragment, sort expression, limit above 100, or unbounded flag is accepted.
- Trigram indexes do not change tenant predicates or search visibility.
- Current local-header actor identity remains a documented non-production authentication model.

## Deployment And Operations

- The page contracts are transport-neutral and return JSON bodies suitable for Express or Lambda/API
  Gateway adapters.
- A 100-row maximum reduces API Gateway response-size risk but is not a formal byte guarantee.
- Repeatable-read transactions require one PostgreSQL connection for the bounded request duration.
- `pg_trgm` must be available to the migration role. Amazon RDS for PostgreSQL supports the extension,
  but deployment runbooks must enable it through the normal migration path.
- The 10,000-row CSV remains synchronous and memory-resident; Lambda timeout/memory validation is
  deferred until an adapter exists.
- No environment variable is added for page size or export limit in this release. Product behavior
  remains deterministic across local and future hosted deployments.
- Readiness behavior is unchanged.

## Delivery Sequence Guidance

Implement in vertical dependencies:

1. contracts and page validation;
2. deterministic ordering, count/page/export repositories, and trigram migration;
3. read transaction helper and page service algorithms;
4. endpoint response changes and dedicated board endpoint;
5. guarded CSV export;
6. frontend API and route/page serialization;
7. shared pagination/result summary presentation;
8. project Work integration and bulk behavior;
9. workspace Work Items, relationship search, and board integration;
10. seed/E2E, OpenAPI, docs, metadata, and full release verification.

Each phase should keep contracts and consumers compiling. The endpoint response change and Angular API
change should land in the same coherent phase or behind a short-lived compile-safe adaptation.

## Risks And Mitigations

### Exact Count And Page Rows Diverge

Risk: a concurrent write changes the count between count and row selection.

Mitigation: run authorization, count, normalized page, row selection, and enrichment in one read-only
repeatable-read transaction.

### Old Responses Overwrite New Page State

Risk: rapid navigation lets a slower earlier HTTP response render after a newer request.

Mitigation: cancel the previous list subscription before each load and compare returned page metadata
to active route state before committing.

### Existing Internal Reads Become Accidentally Paged

Risk: changing `WorkItemService.listWorkItems` globally corrupts My Work, health, planning, reports, or
closeout derivation.

Mitigation: add explicit page methods, preserve internal complete reads, and change only list HTTP
handlers plus the board's explicit endpoint.

### Board Is Truncated

Risk: the board reuses the now-paged list endpoint and sees only 25 cards.

Mitigation: add `GET /projects/:projectId/board/work-items`, update the board API call atomically, and
test more than 100 board items at service level.

### Page State Leaks Into Saved Views

Risk: a saved view reopens on an obsolete page or reports paging as a filter.

Mitigation: keep page types outside `WorkItemQuery`, leave saved-view service normalization unchanged,
and add route/store tests for save, update, open, pin, chips, and summaries.

### Offset Navigation Shifts Under Mutation

Risk: separate requests can duplicate or skip a row after data changes.

Mitigation: deterministic ordering, current-data documentation, authoritative reload after mutation,
and eventual cursor evaluation based on measured usage.

### Count Queries Dominate Response Time

Risk: exact totals over broad search or dependency filters remain expensive.

Mitigation: canonical `exists` predicates, current scope indexes, trigram GIN indexes, representative
query-plan inspection, and no speculative denormalized counters. Approximate counts remain deferred.

### Trigram Migration Fails In A Managed Environment

Risk: the database migration role cannot create `pg_trgm`.

Mitigation: document the privilege requirement, verify Amazon RDS support, apply through the normal
operator migration path, and fail migration visibly rather than silently running unindexed search.

### Export Limit Check Is Racy

Risk: a count-based preflight approves 10,000 rows and a concurrent insert produces 10,001.

Mitigation: read at most 10,001 records inside one repeatable-read transaction and reject before
enrichment or serialization.

### Pagination Adds Too Much UI

Risk: controls compete with saved views, filters, and result rows.

Mitigation: keep one result summary above and one compact pager below, bound numeric controls, reduce
them on mobile, and avoid another card or management panel.

### Relationship Candidate Search Appears Complete

Risk: consuming only the first workspace page hides additional candidates without explanation.

Mitigation: request 25 results, expose a refine-search hint when `hasNextPage` is true, and keep server
relationship validation authoritative.

## Deferred

- Cursor or keyset pagination.
- Snapshot tokens across page requests.
- Approximate, cached, or asynchronously maintained counts.
- Infinite scroll and virtual scrolling.
- Query-wide durable selection.
- `Select all matching` and background bulk commands.
- Cross-project bulk mutation.
- Board filtering, virtualization, or pagination.
- Aggregate/read-model refactors for My Work, planning, health, portfolio, and reports.
- Background CSV generation and object-storage delivery.
- Export history, scheduling, and notifications.
- User-specific page-size preferences.
- Full-text ranking, fuzzy matching, autocomplete, and global quick find.
- Minimum search-term policy.
- Generic pagination infrastructure across unrelated domains.
- Production authentication, hosted infrastructure, observability, and AWS deployment assets.

## Open Questions

No product or architecture decision remains open for the implementation plan.

Implementation should record measured PostgreSQL plan evidence and the exact generated migration name.
If the installed Drizzle version cannot represent trigram index operator classes cleanly, use an
explicit SQL migration and document the metadata handling rather than changing search semantics or
dropping the indexes.
