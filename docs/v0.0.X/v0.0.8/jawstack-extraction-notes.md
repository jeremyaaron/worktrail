# Worktrail v0.0.8 Jawstack Extraction Notes

## Purpose

v0.0.8 added relationship-aware execution visibility to Worktrail. The sprint is useful for jawstack pattern discovery because it introduced graph-like domain state without adding graph infrastructure, workflow automation, or a generalized relationship framework.

These notes capture implementation patterns worth remembering. They are not yet abstractions.

## Product Pattern

The useful product unit was not "a graph." It was a focused workflow:

- connect related pieces of work;
- identify work blocked by open upstream work;
- find work that is blocking downstream work;
- carry that derived state into daily, planning, discovery, saved-view, export, and activity surfaces.

The product value came from putting dependency state where users already make decisions, not from introducing a separate dependency dashboard.

## Edge Table Modeling

Worktrail stores relationships in one `work_item_relationships` table.

The table captures:

- workspace scope;
- relationship type;
- source work item;
- target work item;
- creator;
- created timestamp.

This was enough for two relationship semantics:

- `blocks`, a directional edge from upstream/source to downstream/target;
- `relates_to`, a symmetric edge.

The table intentionally avoided type-specific columns, denormalized titles, or relationship metadata. Those may become necessary later, but v0.0.8 did not need them.

Extraction signal:

- A small edge table with source/target/type is a durable baseline for relationship features.
- Keep workspace or tenant scope on the edge row, even when both related records also carry the same scope. It makes query predicates, cleanup, and future partitioning clearer.
- Use database constraints for invariants that are purely local to a row or pair, such as no self-links and duplicate edge prevention.

## Directional Versus Symmetric Semantics

`blocks` and `relates_to` share storage but not behavior.

For `blocks`:

- source means the upstream blocker;
- target means the downstream blocked item;
- inbound relationships render as `Blocked by`;
- outbound relationships render as `Blocks`;
- dependency-blocked state is calculated from inbound open blockers.

For `relates_to`:

- source and target are storage details;
- UI renders both directions as `Related work`;
- no dependency state is derived.

Extraction signal:

- Store relationships generically, but map semantics explicitly at the service boundary.
- UI labels should reflect the user's perspective on the current record, not the database column names.
- Direction is not a universal property. Some edge types use it, some intentionally hide it.

## Canonicalization

For symmetric `relates_to` edges, Worktrail canonicalizes source and target IDs before duplicate checks and persistence.

This keeps both of these attempts equivalent:

```text
A relates_to B
B relates_to A
```

Extraction signal:

- Symmetric relationships need canonicalization before duplicate detection.
- Put canonicalization in the service that owns relationship creation, not in UI code.
- Keep API request shape simple. The caller can submit the current context and a target; the service can normalize storage shape.

## Cycle Validation

Blocking relationships reject cycles. Worktrail uses a recursive Postgres query to test whether a proposed `blocks` edge would create a downstream path back to the proposed source.

Extraction signal:

- Cycle checks belong near relationship creation because they enforce domain integrity.
- Recursive SQL is acceptable for small and moderate relationship graphs when it is isolated behind a repository method and tested.
- Do not try to enforce graph cycles with application-only row-by-row traversal when the database can answer the reachability question in one query.
- Keep cycle checks type-specific. `relates_to` does not need cycle validation.

## Derived Relationship State

Worktrail does not persist `dependencyBlocked`.

It derives dependency state from:

- an inbound `blocks` relationship;
- the upstream blocker status;
- terminal status semantics.

The list DTOs carry compact derived fields:

- `dependencyBlocked`;
- `openBlockerCount`;
- `openBlockedWorkCount`.

The detail DTO carries the full relationship summary.

Extraction signal:

- Persist facts, derive status when the derivation is cheap and the state changes with related records.
- Keep list DTO enrichment compact; avoid loading full relationship detail for every row.
- Batch-load relationship counts for list result IDs to avoid N+1 behavior.
- Use detail-specific DTOs for the richer relationship graph around one record.

## URL-Backed Relationship Filters

Worktrail uses one query parameter:

```text
dependency=dependency_blocked
dependency=blocking_open_work
```

This appears in:

- project work item lists;
- workspace discovery;
- My Work summary links;
- Planning links;
- saved work views;
- CSV export.

Extraction signal:

- Prefer one enum query parameter over multiple booleans when states are mutually exclusive.
- Keep query DTOs, URL serialization, saved-view validation, API parsing, repository filters, and export query construction aligned.
- Summary/dashboard links should deep-link to the same canonical list view users already understand.
- Saved views should store the same query object the list uses; avoid a separate saved-view filter model.

## Relationship-Aware Export Reuse

CSV export did not get a relationship-specific export path. It reused the existing list/filter flow and inherited dependency filters through the same query object.

Extraction signal:

- Exports should consume applied list filters, not reconstruct parallel query logic.
- If a new filter matters on screen, it probably matters in export.
- Tests should cover both project-scoped export and workspace discovery export when a filter is shared across both surfaces.

## Activity Strategy

Relationship changes create work item activity events. v0.0.8 records activity on the command context item only.

That choice reduces cross-project noise. It also avoids the complexity of mirrored activity events while relationships are still early.

Extraction signal:

- Relationship activity should include enough metadata to reconstruct source, target, type, and related work identity.
- Single-sided activity is acceptable when the product surface is still small.
- Mirrored activity should be a deliberate future decision, not an accidental side effect of relationship creation.

## Cloud-Readiness Implications

The v0.0.8 implementation remains compatible with the current cloud-shaped direction:

- relationship writes live in services and repositories, not database triggers;
- endpoint handlers remain transport-neutral;
- recursive graph checks are isolated in the Postgres repository;
- derived list counts are batched;
- Angular routes remain lazy-loaded;
- the public API reference documents relationship endpoints and dependency filters.

Future cloud work should revisit:

- indexing strategy for larger relationship graphs;
- query plans for dependency filters on large work item tables;
- materialized read models for dependency counts if list latency grows;
- transactional behavior if relationship activity expands to mirrored events;
- tenant partitioning or row-level security once production auth exists;
- API Gateway/Lambda timeout budgets for recursive graph checks.

## What Not To Extract Yet

Do not extract a generalized relationship engine yet.

Current evidence supports smaller reusable ideas:

- edge table conventions;
- relationship type normalization;
- cycle validation repository methods;
- list-count enrichment;
- URL-backed derived-state filters;
- export reuse of applied query DTOs.

The product has not yet proven a need for:

- arbitrary relationship metadata;
- custom relationship types;
- hierarchical work item trees;
- graph visualization;
- dependency automation;
- notifications;
- critical path analysis;
- cross-workspace relationships.

## Candidate Future Abstractions

If the same pattern appears in another reference app, possible jawstack candidates are:

- a tenant-scoped edge-table recipe;
- a directional/symmetric edge normalization helper;
- a recursive cycle-check repository helper for Postgres;
- a DTO enrichment pattern for compact list relationship counts;
- a query-filter preservation pattern shared by list pages, saved views, and exports;
- endpoint handler examples for nested relationship resources.

Each should wait for at least one more real application shape before becoming framework code.
