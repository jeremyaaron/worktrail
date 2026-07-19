# Worktrail v0.1.2 Jawstack Extraction Notes

## Purpose

v0.1.2 hardens Worktrail's filtered work views by making query state consistent across route URLs, filter controls, active chips, saved views, dashboard links, delivery-health links, CSV exports, copied links, and detail return URLs.

These notes capture extraction signals for `jawstack`. They are observations from a concrete product slice, not framework commitments.

The source opportunity note remains at `docs/v0.1.2/0006-query-contracts-url-state.md`.

## Query State As Product Contract

The release treats `WorkItemQuery` as a product contract rather than an incidental request object.

The same query shape now drives:

- list API requests;
- route query parameters;
- filter form hydration;
- active filter chips;
- saved-view create, open, and update;
- dashboard and delivery-health links;
- detail return URLs;
- copied filtered-view links;
- CSV export requests.

Extraction signal:

- Dense operational apps should identify when query state has become user-facing product state.
- Once a query shape powers URLs, saved views, exports, and dashboard links, drift becomes a trust problem, not just code duplication.
- The durable pattern is "one applied query, many projections."

## Applied Versus Pending State

Worktrail distinguishes pending form state from applied query state.

Pending state is what the user is editing in filter controls. Applied state is what backs loaded results, visible chips, saved views, copied links, return URLs, and export.

Extraction signal:

- Query abstractions should name state phases explicitly.
- "Applied query" is a useful product concept for search-heavy apps.
- Tests should assert that pending edits do not leak into claims about current results.

## Canonical Projections

The app-local query helpers project `WorkItemQuery` into several target formats:

- Angular router query params;
- router-link params;
- form values;
- return URLs;
- meaningful field counts;
- HTTP query params.

Not every projection belongs in the same layer. Frontend router serialization lives in the Angular app. API HTTP parsing and normalization live in the API validation layer. Shared DTO shape lives in contracts.

Extraction signal:

- A future `jawstack` pattern should separate the canonical query shape from environment-specific projections.
- The generic shape may be a convention and test harness before it becomes a package.
- Router, HTTP, database, and label/display concerns should not be prematurely fused.

## Defaults Should Be Quiet

v0.1.2 keeps default sort and default archived-project behavior out of URLs and saved-view summaries.

It preserves intentional non-default values such as:

- `blocked: false`;
- unassigned assignee state;
- non-default archived-project mode;
- non-default sort;
- dependency filters.

Extraction signal:

- Query contracts need default-omission policy, not only type definitions.
- "Empty" and "default" are not always the same thing.
- Round-trip tests should prove which values are quiet and which values are meaningful.

## Scope Matters

Project work item lists and workspace work item lists share `WorkItemQuery`, but they do not support every field identically.

Project-scoped route params strip workspace-only fields. Workspace-scoped links preserve workspace-only fields such as archived-project mode and workspace project filtering.

Extraction signal:

- Query contracts often need scope-aware projections.
- Shared query shape does not imply every surface supports every field.
- Tests should include scope-specific stripping or preservation behavior.

## Saved Views Are Query Snapshots

Saved views store normalized query JSON and reopen through canonical route params.

The app deliberately keeps saved-view summaries compact. They count meaningful filters without expanding into rich labels, because the list page owns the display context for members, projects, labels, and milestones.

Extraction signal:

- Saved views should snapshot canonical query state, not component form state.
- Display summaries are product-specific and may need richer app context than the raw query contract has.
- A generic saved-view primitive should avoid owning domain label rendering too early.

## Copy Links Share Applied URLs

Copy-link actions use the current origin, current list path, and canonical applied query params.

They do not copy pending draft filter edits.

Extraction signal:

- Shareable views are a natural extension once URL state is trustworthy.
- Copy-link behavior should reuse canonical URL generation rather than reserialize state in the component.
- Clipboard integration is an adapter concern; query generation is the product contract.

## Exports Should Match The Visible View

CSV export now follows applied query state and canonical HTTP params for both project and workspace lists.

Extraction signal:

- Export is a high-trust surface. Users expect exports to match visible results.
- Export requests should be treated as another projection of the applied query.
- Tests should cover pending-filter edits explicitly because export drift is easy to miss manually.

## Round-Trip Tests Are The Guardrail

The useful test shape in this sprint is not broad snapshots. It is round-trip and projection coverage:

- form value to query;
- query to router params;
- router params back to form value;
- query to return URL;
- query to router link params;
- query to meaningful count;
- applied query to export params.

Extraction signal:

- Query-contract patterns should come with reusable fixture styles.
- Tests should fail when a filter is silently dropped, renamed incorrectly, or serialized inconsistently.
- Repeated round-trip pressure in another reference app would be strong evidence for `jawstack` extraction.

## Deferred Extraction Pressure

The release deliberately avoids:

- a standalone query-contract package;
- a generic `jawstack` query abstraction;
- runtime validators in `@worktrail/contracts`;
- advanced query-builder UI;
- full-text search infrastructure;
- server-side pagination;
- team-shared saved views;
- short links or native share-sheet integration.

Extraction signal:

- The pattern is promising but not framework-ready from one app.
- The next reference app with dense list/filter behavior should dogfood the same vocabulary before extraction.
- A future abstraction should start with conventions, naming, and tests before introducing a dependency.
