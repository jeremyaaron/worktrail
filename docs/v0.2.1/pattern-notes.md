# Worktrail v0.2.1 Pattern Notes

## Purpose

These notes capture reusable product and architecture signals from the v0.2.1 Cycle Planning release. They are destination-neutral: the patterns may inform future application infrastructure, project conventions, documentation templates, or no extraction at all.

The bar for extraction remains evidence. A pattern should be generalized only after it appears in multiple concrete workflows and the abstraction would make those workflows simpler to build, test, or operate.

## Parallel Planning Objects

Cycles and milestones are both planning objects, but they answer different questions.

- Milestones answer "what delivery target are we aiming at?"
- Cycles answer "what timeboxed execution window are we working in?"

Useful product rules:

- keep names plain and methodology-neutral;
- do not force users into a ceremony model;
- allow one work item to belong to both objects;
- make each object independently filterable and reviewable;
- avoid combining lifecycle rules unless the domain really requires it.

This pattern is useful when a product has multiple planning dimensions that overlap without forming a strict hierarchy.

## Review Surfaces From Current State

Cycle Review follows the Milestone Review pattern: derive a focused page from current normalized data rather than storing a separate review record.

Useful implementation rules:

- give each review object a reloadable route;
- keep review pages read-oriented and action-linked;
- build risk sections from shared definitions;
- link every risk section into filtered work lists where possible;
- preserve return URLs from work item detail back to the review context.

The same shape now supports milestone review and cycle review without requiring a generic "review object" abstraction.

## Query Contracts For New Dimensions

Adding `cycleId` proved that a work-list query field has to join the whole applied-query contract, not just the API filter.

Useful implementation rules:

- add the field to contract types, API query parsing, repository filtering, Angular route parsing, filter labels, active chips, saved views, pinned views, copy links, return URLs, and exports together;
- treat active chips as applied state, not pending form state;
- keep default values quiet in saved-view summaries;
- test reloadable URLs and saved-view reopening for every new query dimension.

This is the same pattern identified in v0.2.0, now exercised with a larger cross-surface feature.

## Optional Snapshot Sections

Status reports include active-cycle context as an optional snapshot section.

Useful implementation rules:

- keep existing snapshot versions stable for additive optional data;
- parse stored JSON at every read boundary;
- distinguish live review links from stored snapshot values;
- render optional sections consistently in detail pages and Markdown export;
- keep old snapshots readable without migration.

This pattern applies whenever a durable communication artifact grows without breaking older records.

## Lifecycle Constraints At The Right Layer

Cycle lifecycle uses both database and service constraints.

Useful implementation rules:

- enforce simple uniqueness invariants at the database level;
- enforce contextual rules, such as overlapping date ranges, in services where error messages and permissions are available;
- keep archive/reactivate explicit instead of hard deleting planning objects;
- preserve read access to completed, canceled, and archived objects.

This split keeps data integrity strong while avoiding migration-heavy constraints for rules that may evolve.

## Component Extraction As Budget Hygiene

The Planning page style budget warning was a symptom of a component with too many responsibilities.

Useful implementation rules:

- extract by product sub-surface, not by arbitrary CSS chunks;
- keep the route component responsible for context, loading, permissions, and command orchestration;
- move focused template and scoped styles with the extracted component;
- add component-level specs where behavior moves;
- clear budgets by reducing component scope before raising thresholds.

This pattern is worth reusing when a warning points at real maintainability pressure.

## Transaction-Safe Read Composition

The pg deprecation warning exposed a hidden assumption: `Promise.all` over repository reads is not safe when those repositories share one transaction client.

Useful implementation rules:

- avoid concurrent queries inside transaction-scoped repository contexts;
- prefer sequential reads when correctness and future driver compatibility matter more than small local latency gains;
- keep broader fan-out only for non-transactional read paths or independent connections;
- use warnings as compatibility signals, not just console noise.

This matters for service methods that can run both as standalone reads and as subroutines inside write transactions.
