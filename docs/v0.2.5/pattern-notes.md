# Worktrail v0.2.5 Pattern Notes

## Purpose

These notes record reusable implementation evidence from Work Breakdown without assuming a
destination framework, package, or repository. The evidence is intentionally narrower than a generic
tree or graph abstraction.

## Bound A Self-Reference With Domain Invariants

Work Breakdown uses one nullable self-reference on `work_items`, but the product supports exactly two
levels rather than arbitrary recursion.

Useful rules:

- represent one-parent cardinality with a nullable foreign key when containment is not a general
  graph edge;
- enforce cheap local invariants, such as self-parent prevention, in the database;
- enforce cross-row domain invariants, such as same-project ownership and maximum depth, inside the
  transactional service;
- keep the hierarchy contract bounded in reads and DTOs even though the persistence mechanism could
  technically represent deeper nesting;
- test both proposed directions: a child cannot become a parent, and a parent cannot become a child.

The reusable pattern is bounded self-reference plus explicit invariants, not a generic tree model.

## Lock Graph-Like Mutations In Stable Order

Reparenting touches the current item, its current parent, and a proposed parent. Concurrent commands
can otherwise observe different partial states and create a forbidden third level.

Useful rules:

- begin the transaction before validating mutable hierarchy state;
- collect every row that can affect the decision;
- deduplicate and sort row IDs before `FOR UPDATE` locking;
- re-read parent/child facts through transaction-bound repositories;
- validate, update, and write activity in the same transaction;
- treat an already-persisted target as a no-op after locking.

Stable lock ordering is a small local discipline that prevents deadlock-prone ad hoc acquisition and
makes concurrent invariant enforcement defensible.

## Derive Summaries Instead Of Maintaining Counters

Parent progress is derived from child rows at read time. Worktrail does not update mutable child
counts or estimate totals whenever a child changes.

Useful rules:

- derive total, terminal, estimated, unestimated, and estimate-point values from authoritative rows;
- keep workflow classification in one shared function;
- load summaries for a result set with grouped queries rather than one query per parent;
- return `null` for items without children so top-level rows stay visually quiet;
- distinguish a parent's direct estimate from the sum of direct child estimates in naming and UI.

Derived summaries avoid counter drift and simplify transactional writes. Persisted counters would
need evidence of a read-volume problem before adding their consistency burden.

## Enrich Flat DTOs Shallowly And Set-Wise

List, board, My Work, and review rows need enough hierarchy context to be understood without embedding
nested work item graphs.

Useful rules:

- embed only compact parent identity on a child row;
- embed only a derived summary on a parent row;
- never recursively embed a parent's parent or full children in list DTOs;
- collect result IDs, issue bounded set-based enrichment queries, and map by child/parent ID;
- preserve the flat operational collection as the primary API shape.

This keeps transport payloads bounded and lets existing flat interfaces gain context without being
redesigned as tree controls.

## Use Readable Keys For URL State And UUIDs For Writes

Exact-parent filters use immutable display keys such as `WT-12`, while parent mutation commands use
UUIDs.

Useful rules:

- prefer readable immutable identifiers in copied URLs, chips, exports, and support conversations;
- resolve readable keys server-side within the actor's workspace or project boundary;
- use opaque primary IDs for mutation references and lock acquisition;
- normalize key casing at the query boundary;
- return an empty result for a stale exact-parent key rather than broadening the query silently.

The split improves human-facing state without weakening write precision.

## Let One Canonical Query Contract Carry New Dimensions

Hierarchy filters participate in the same applied query model as status, assignee, cycle, dependency,
and other work filters.

Useful rules:

- define visible hierarchy modes and hidden exact-parent state in one query contract;
- make mutually exclusive fields replace one another during normalization;
- apply the query before rendering chips or enabling export;
- preserve canonical state through reload, copy link, saved view, pinned view, return URL, and export;
- keep project and workspace scopes explicit while sharing serialization helpers;
- test malformed, stale, saved, copied, and round-tripped state.

Adding a query dimension should extend one product contract rather than create route-specific filter
logic.

## Keep Containment Separate From Dependency

A child belongs to a parent; a blocker controls execution readiness. Combining those concepts would
make both ambiguous.

Useful rules:

- model containment and dependency with separate persistence and service paths;
- never infer `blocked`, `blocks`, or workflow transition behavior from parent assignment;
- keep dependency filters and hierarchy filters independently composable;
- explain both signals when they coexist on one row;
- record parent-change activity without generating dependency notifications.

This separation protects domain language and leaves room for either relationship to evolve without
silently changing the other.

## Add Snapshot Context Compatibly

Published status report snapshots existed before Work Breakdown. New reports benefit from parent
context, but historical payloads cannot be rewritten safely.

Useful rules:

- add shallow context as an optional nullable snapshot field;
- let old payloads omit the field;
- have new snapshot writers populate the field consistently;
- render defensively when context is absent;
- do not revise an unrelated snapshot contract merely because the live DTO gained a field.

Worktrail applies this to report snapshots and deliberately leaves cycle closeout snapshot v1
unchanged.

## Make Seed Data An Executable Product Scenario

The hierarchy seed is not only sample content. It demonstrates mixed workflow, planning, assignment,
estimate, dependency, and candidate states and checks structural integrity while seeding.

Useful rules:

- use stable IDs and readable keys for browser workflows;
- include both hierarchy and plain top-level work;
- isolate the scenario from destructive lifecycle fixtures;
- assert same-project parentage and maximum depth after insertion;
- advance project numbering beyond explicit seeded keys;
- restore mutable seed relationships in browser-test cleanup.

Executable seed scenarios expose integration errors that isolated service tests cannot, including the
item-number collision discovered when child creation first ran against the expanded seed.

## Deliberate Non-Abstractions

v0.2.5 does not introduce a generic tree component, graph repository, hierarchy engine, recursive DTO,
rollup framework, workflow automation layer, or universal lock coordinator.

The current evidence supports small reusable techniques:

- sorted multi-row locking;
- grouped derived summaries;
- shallow identity enrichment;
- canonical query normalization;
- optional snapshot evolution.

A broader abstraction would need another implemented domain with materially similar invariants and a
clear reduction in complexity. Until then, explicit Work Breakdown services and components are easier
to audit and change.

