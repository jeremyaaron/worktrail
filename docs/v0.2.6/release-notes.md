# Worktrail v0.2.6 Release Notes

## Summary

Worktrail v0.2.6 adds Scalable Work Discovery. Project Work and workspace Work Items now use bounded,
server-backed pages with exact totals while preserving the URL-backed filters, saved views, return
navigation, bulk triage, and exports established in earlier releases.

The release deliberately distinguishes an interactive page from the complete matching result. Lists
load and enrich at most 100 rows, project batch actions target explicit visible IDs, and CSV export
continues to cover the full applied filter under a documented 10,000-row synchronous limit.

## User-Facing Changes

- Added exact result counts and visible ranges to project and workspace work lists.
- Added previous, next, and direct page navigation.
- Added page-size choices of 10, 25, 50, and 100 rows, with 25 as the default.
- Preserved non-default page and page-size state in URLs, copied links, browser history, and work-item
  detail return navigation.
- Reset navigation to page 1 when filters, sort, actor, project, saved view, or page size changes.
- Normalized stale page URLs to the current final page when results shrink.
- Kept saved views focused on durable filter and sort intent. Opening a saved or pinned view starts at
  page 1 with the default page size.
- Clarified project batch triage as visible-page selection and clear selection on navigation or query
  changes.
- Kept project and workspace CSV exports aligned with all matching filtered rows, regardless of the
  visible page.
- Added an actionable error when more than 10,000 rows match an export, without returning a partial
  file.
- Added bounded relationship-candidate search guidance when additional matches exist.

## Product Semantics

- Filters and sort define the durable result set; page and page size define a transient window over
  that set.
- Each page response contains exact count and navigation metadata consistent with its returned rows.
- Separate page requests are current-data reads, not one frozen multi-page snapshot. Intervening edits
  may move rows when they affect the active sort or filters.
- Saved views never store page or page size.
- Active filter chips and meaningful filter counts ignore page state.
- Bulk selection includes only loaded work items on the current project page.
- Export ignores page and page size and applies the same durable filters and sort as the list.
- The project board remains complete and unpaged because partial workflow columns would make persisted
  ordering and drag/drop behavior incorrect.

## Technical Changes

- Added `WorkItemPageQuery`, page-size vocabulary, page metadata, and concrete project/workspace page
  response contracts.
- Changed `GET /api/projects/{projectId}/work-items` and `GET /api/work-items` to return page envelopes.
- Added `GET /api/projects/{projectId}/board/work-items` as the explicit complete board projection.
- Added strict endpoint validation for one-based page numbers and supported page sizes.
- Added canonical stale-page clamping and deterministic UUID tie-breakers for every paged sort.
- Reused one canonical condition builder for row and exact-count queries.
- Added repeatable-read, read-only transactions around authorization, count, clamping, page rows, and
  bounded enrichment.
- Limited interactive enrichment to the current page.
- Added export-specific bounded repository reads using a 10,001-row overflow probe.
- Added `422 EXPORT_LIMIT_EXCEEDED` with `{ limit: 10000 }` details.
- Added migration `0016_scalable_search.sql`, which enables `pg_trgm` and creates GIN trigram indexes
  for work-item display key, title, and description search.
- Added a shared Angular pagination component and separate durable-query/page-state serialization.
- Added deterministic performance evidence tooling and seeded browser coverage for project/workspace
  paging, return navigation, page-scoped bulk selection, all-matching export, candidate overflow, and
  complete board behavior.

## Compatibility Notes

- Migration `0016_scalable_search.sql` is required.
- The migration role must be allowed to run `CREATE EXTENSION IF NOT EXISTS pg_trgm`.
- The two interactive work-list HTTP responses changed from arrays to page envelopes. Worktrail is
  still a v0.x application without an external API compatibility promise.
- Existing project/workspace work URLs remain valid when paging parameters are absent.
- Existing saved views require no migration because their stored query contract is unchanged.
- Existing copied links without paging state open page 1 with 25 rows.
- Export routes ignore direct `page` and `pageSize` parameters.
- The board now uses its dedicated route; board behavior and persisted order are unchanged.

## Verification

Phase-level implementation and verification evidence is recorded in
`docs/v0.2.6/implementation-plan.md`.

Recommended release checks:

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
```

## Residual Risks And Deferred Work

- Offset pages can drift across separate requests when current data changes.
- Exact counts and deep offsets may become expensive at substantially larger data volumes.
- The project board intentionally reads and enriches the complete project projection.
- Focused internal aggregate reads for My Work, Planning, reviews, reports, and Portfolio remain
  complete purpose-specific reads.
- Accepted CSV exports are generated synchronously in memory and are limited to 10,000 matching rows.
- Very short substring search terms may still favor broad scans despite trigram indexes.
- Relationship candidate search is bounded and reports when additional matches exist.
- Authentication remains represented by local actor headers and the top-bar actor selector.
- Hosted infrastructure, managed identity, metrics, tracing, background exports, and internet-safe
  deployment remain outside this release.
