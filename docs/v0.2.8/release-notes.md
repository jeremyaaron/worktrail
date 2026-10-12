# Worktrail v0.2.8 Release Notes

## Summary

Worktrail v0.2.8 adds Quick Find: a keyboard-friendly workspace navigation and bounded search surface
available throughout the application. Users can open it from the top bar or with `Command/Ctrl+K`,
jump to common global or current-project destinations, and find projects, work items, milestones,
cycles, published reports, and attachment filenames without first choosing a feature page.

Quick Find is intentionally smaller than an enterprise search platform. It uses approved PostgreSQL
fields, deterministic relevance tiers, strict per-group limits, explicit workspace authorization, and
canonical Worktrail destinations. It does not claim fuzzy, semantic, attachment-content, or complete
narrative search.

## User-Facing Changes

- Added a visible Quick Find action to the application shell.
- Added `Command+K` on macOS and `Ctrl+K` elsewhere, while leaving editable-control shortcuts alone.
- Added empty-query navigation for My Work, Inbox, Work Items, Projects, Portfolio, Create work item,
  and the current project's Overview, Work, Board, Planning, Reports, and Settings pages.
- Added grouped search across work items, projects, milestones, cycles, published reports, and
  attachment filenames.
- Added readable project and work-item context, lifecycle labels, bounded excerpts, and deterministic
  active-result highlighting.
- Added keyboard movement with Arrow keys, Home, End, and Enter, plus pointer selection and Escape
  dismissal with focus restoration.
- Added a work-item overflow action that opens the existing workspace Work Items page with canonical
  search state and archived-project inclusion.
- Added attachment results that open the owning work item and focus its Files section, including
  same-route and reused-detail-route cases.
- Added loading, empty, safe-error, and retry states.
- Added compact desktop, mobile, and high-zoom layouts with one internally scrolling result surface.

## Search Scope And Limits

- Queries are NFC-normalized, trimmed, and whitespace-collapsed.
- Queries must contain 2-120 Unicode code points.
- Work items match display key, title, and description.
- Projects match key, name, and description.
- Milestones match name and description.
- Cycles match name.
- Published reports match title and summary.
- Attachments match filename only. File contents are never searched.
- Results use exact, prefix, and substring relevance tiers within each record group.
- Every group returns at most five records plus `hasMore`; Quick Find does not calculate exact totals.
- Readable archived projects and completed or canceled records remain searchable and visibly labeled.
- Search state is ephemeral. Reopening Quick Find starts with an empty query.

## Privacy And Authorization

- Quick Find uses `POST /api/quick-find`, carrying query text in the JSON body rather than the URL.
- Ordinary request logs record method, route, status, and timing without query text or request bodies.
- Responses use `Cache-Control: private, no-store`.
- The API verifies the active workspace actor before searching and scopes every repository query to the
  selected workspace.
- Attachment results expose filename and owning work-item context, but never storage keys, checksums,
  object paths, or file contents.
- Persistence failures map to a stable safe error without raw database or query details.

## Technical Changes

- Added typed shared contracts for six concrete Quick Find groups, match metadata, and bounded result
  projections.
- Added migration `0018_sweet_apocalypse.sql` with the approved workspace and trigram indexes for
  project, milestone, cycle, report, and attachment filename search. Existing work-item trigram indexes
  continue to support work-item matching.
- Added one focused cross-domain repository with deterministic rank tiers, explicit ownership joins,
  narrow projections, literal wildcard escaping, and limit-plus-one group reads.
- Added a transport-neutral endpoint and focused Express route with strict request validation and safe
  error mapping.
- Added a typed Angular API client, exhaustive destination mapping, and a lazy Angular CDK dialog
  loaded from the root shell only when opened.
- Added stale-request generation checks, request cancellation, actor-change closure, and duplicate-open
  guards.
- Added a shared Files fragment target with one-shot focus after attachment loading settles.
- Added deterministic performance evidence that creates representative records in a rolled-back
  transaction and proves bounded normal plans plus trigram index eligibility.

## Operator Notes

- Existing installations must apply migration `0018_sweet_apocalypse.sql`.
- The migration relies on the `pg_trgm` extension introduced by v0.2.6. The migration role must retain
  permission to install or use that extension.
- Quick Find adds bounded database reads but no new runtime service, queue, cache, external search
  engine, environment variable, or persistent search history.
- Local evidence uses 2,000 temporary rows per searchable domain and rolls back all fixture writes.
- Final warm six-group evidence completed in approximately 18 ms per request against the under-300 ms
  local target. This is local reference evidence, not hosted load testing or a production SLA.
- All workspace package versions are `0.2.8`.

## Compatibility Notes

- Existing routes, page URLs, work-list query parameters, saved views, and attachment APIs remain valid.
- `POST /api/quick-find` and its contracts are additive.
- Quick Find work-item overflow reuses existing workspace Work Items query semantics.
- Attachment destinations add the stable `#files` fragment to existing work-item detail URLs.
- No production authentication, deployment, or storage model changes are included.

## Verification

Phase-level implementation and verification evidence is recorded in
`docs/v0.2.8/implementation-plan.md`.

Recommended release checks:

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
git diff --check
```

## Residual Risks And Deferred Work

- Authentication remains represented by local actor headers and the top-bar actor selector.
- Two-character broad substrings can require bounded sequential scans despite trigram indexes.
- Quick Find has no dedicated paged global-results route, per-type filters, exact totals, search
  history, saved global searches, favorites, or personalized ranking.
- Fuzzy matching, typo tolerance, token ranking, stemming, synonyms, semantic/vector search, and
  natural-language answers remain deferred.
- Comments, activity, notifications, complete report bodies, attachment contents, OCR, and extracted
  file text are not searched.
- Result mutations, command registration, analytics, relevance administration, cross-workspace search,
  and external search services remain outside this release.
- Hosted infrastructure, production identity, managed object storage, metrics, tracing, and
  internet-safe deployment remain outside this release.
