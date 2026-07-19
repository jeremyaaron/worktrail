# Worktrail v0.2.6 Pattern Notes

## Purpose

These notes record reusable implementation evidence from Scalable Work Discovery without assuming a
destination framework, package, or repository. The evidence comes from two related work-list surfaces,
not from a general-purpose table or pagination system.

## Separate Result Meaning From Result Position

Worktrail keeps durable filters and sort in `WorkItemQuery` and transient navigation in
`WorkItemPageQuery`.

Useful rules:

- let one contract define which records match and another define the current window;
- store only durable intent in saved views;
- keep transient page fields out of active filter chips and meaningful-filter counts;
- include page state in URLs when it describes the current screen;
- reset position when the matching set or page size changes;
- omit default paging values from canonical URLs to keep common links compact.

This separation allows saved views, exports, copy links, and detail return URLs to share query
semantics without pretending that an old page number remains meaningful forever.

## Let The Server Own Page Truth

The API returns normalized page, page size, exact total count, total pages, and directional
availability with each result window.

Useful rules:

- validate page values at the transport boundary;
- enforce a small enumerated page-size set and a strict maximum;
- represent an empty result as page 1 of zero total pages;
- clamp a stale page to the final valid page when rows remain;
- render controls from response metadata rather than recomputing server facts in the client;
- canonicalize a corrected URL with history replacement before treating it as the current screen.

The page envelope is concrete for each collection. A generic transport type was not required to share
the metadata vocabulary in TypeScript.

## Keep Count, Window, And Enrichment Coherent

One list response performs authorization, exact count, page normalization, row selection, and shallow
enrichment in a read-only repeatable-read transaction.

Useful rules:

- build row and count predicates from the same canonical condition builder;
- count distinct domain rows rather than enrichment join combinations;
- calculate the final offset only after count-based page normalization;
- run set-based enrichment against the bounded page IDs;
- ensure labels, dependencies, hierarchy, members, milestones, and cycles describe the same snapshot
  as the selected rows;
- state clearly that separate HTTP requests still observe separate snapshots.

This provides internal consistency for one response without claiming snapshot-consistent browsing
across a mutable multi-page result set.

## Add A Unique Final Sort Tie-Breaker

Offset pages require deterministic ordering. A human-facing sort key is rarely unique.

Useful rules:

- preserve the product meaning of the primary sort;
- append explicit secondary ordering already implied by the domain where useful;
- end every paged order with a stable unique key;
- apply the same deterministic order to export when export promises the list's applied sort;
- test tied values rather than assuming fixture timestamps are unique.

A unique final key prevents unchanged rows from moving nondeterministically between adjacent windows.
It does not prevent movement caused by real edits to sort fields.

## Bound Work At Every Interactive Layer

Client-only pagination would reduce DOM nodes but leave database, mapping, enrichment, payload, and
browser-memory costs unbounded.

Useful rules:

- apply limit and offset before DTO enrichment;
- enrich only the selected IDs with grouped queries;
- cap the API page size independently of UI controls;
- return only the metadata needed to navigate and explain the current result;
- keep responsive card and table rendering based on the same bounded response;
- measure representative query paths with realistic rows and filters.

The implementation benchmark uses temporary transactional fixtures and removes them after evidence is
collected, keeping deterministic seed data small and useful.

## Make Complete Reads Explicit Exceptions

Not every collection can be paged without changing its interaction model. The Worktrail board needs
complete columns and neighboring positions for drag/drop.

Useful rules:

- give a complete operational projection a purpose-specific service and endpoint name;
- accept no public paging or general list-filter escape hatch on that path;
- preserve its fixed ordering contract;
- test above the interactive page maximum to prove it is not accidentally truncated;
- document its scale risk instead of presenting it as solved by list pagination;
- keep internal aggregate reads purpose-specific and revisit them only with measured pressure.

An explicit exception is easier to audit than a magic oversized page request.

## Keep Bulk Selection Concrete And Page-Scoped

Once rows are paged, `select all` becomes ambiguous unless selection scope is named and modeled.

Useful rules:

- label selection as visible-page selection;
- submit explicit row IDs rather than an implicit query token;
- clear selection before page, page-size, filter, sort, actor, or project changes become usable;
- retain failed IDs only when they are still visible after reload;
- do not imply cross-page selection without a durable server-side selection contract.

This preserves predictable partial-success recovery without introducing query-wide mutation semantics.

## Guard Synchronous Full-Result Export With Limit Plus One

Export represents the complete applied filter, not the current viewport, but synchronous export still
needs a hard boundary.

Useful rules:

- use an export-specific repository path rather than looping through interactive pages;
- request `limit + 1` raw rows to prove overflow with one bounded read;
- reject overflow before enrichment or serialization;
- return a typed error with the limit and a concrete recovery action;
- never return a partial file under the requested filename;
- remove page fields before applying the durable export query.

This is suitable for a bounded synchronous export. Larger exports require a separate asynchronous job
and artifact-delivery design.

## Preserve Search Semantics While Adding Index Support

Worktrail retained its existing case-insensitive substring search and added PostgreSQL trigram indexes.

Useful rules:

- optimize the existing predicate before changing user-visible matching behavior;
- include extension installation in the committed migration path;
- verify extension and index definitions after a fresh migration;
- inspect plans with representative data and selective as well as broad terms;
- document that the planner may correctly choose a sequential scan for small tables or broad matches;
- treat extension privileges as an operator requirement, not an application fallback.

Index presence alone is not performance evidence. Data volume, selectivity, count cost, and deep-offset
behavior still need measurement.

## Deliberate Non-Abstractions

v0.2.6 does not introduce a generic data grid, repository framework, pagination service, infinite
scroll controller, query language, cross-page selection system, or export-job framework.

The current evidence supports focused reusable pieces:

- a page metadata vocabulary;
- durable-query and transient-window serialization helpers;
- one shared Angular pager for two closely related list pages;
- canonical row/count predicates;
- bounded set-based enrichment;
- purpose-specific complete-read exceptions;
- a typed synchronous export overflow policy.

A broader abstraction should wait for another domain with materially similar paging, selection,
consistency, and export requirements. Until then, explicit work-list services and concrete response
contracts keep behavior easier to inspect and evolve.
