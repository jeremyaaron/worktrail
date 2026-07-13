# Worktrail v0.2.4 Pattern Notes

## Purpose

These notes capture reusable product and architecture signals from the v0.2.4 Cycle Closeout and
Carryover release. They are destination-neutral: the observations may inform future application
infrastructure, local conventions, documentation, or no extraction at all.

The evidence comes from one concrete workflow. Generalization should wait until another workflow
creates the same pressure and a shared abstraction would reduce rather than hide domain policy.

## Preview And Apply Are Separate Contracts

Closeout needs a detailed preview, but the preview is not an authorization token or a command
payload. The apply endpoint accepts only the user's decision and re-derives current scope inside the
transaction.

Useful rules:

- make preview explicitly read-only;
- return enough derived evidence for a human decision;
- keep the command payload small and intention-focused;
- revalidate lifecycle, ownership, permissions, destination, and affected scope at apply time;
- return conflict responses that let the client refresh instead of guessing how to recover.

This pattern fits consequential commands where state can change between review and confirmation.

## Idempotency Can Follow Domain Identity

Cycle closeout has a natural idempotency key: one source cycle can have one closeout. A unique
relational constraint protects that invariant. A repeated request with the same destination returns
the existing result; a repeated request with a different destination conflicts rather than rewriting
history.

Useful rules:

- identify the business operation before inventing a generic request-key mechanism;
- enforce one-time identity in the database, not only in application memory;
- compare the repeated decision with persisted relational fields;
- replay the durable result without repeating activity or related-record writes;
- serialize concurrent attempts through row locking and transaction boundaries.

This is narrower and more explainable than universal idempotency middleware for naturally one-time
transitions.

## Relational Ownership Beside JSONB Evidence

The closeout record stores workspace, project, source cycle, actor, and optional destination as
foreign keys. The historical evidence is stored as a versioned JSONB snapshot. Runtime validation
checks both the snapshot shape and its identity against the relational record.

Useful rules:

- keep ownership, lookup, uniqueness, and referential integrity relational;
- use a snapshot for immutable historical evidence whose nested shape should survive live changes;
- version persisted evidence from its first release;
- parse stored JSON before mapping it to an API response;
- reject identity disagreement between relational columns and embedded evidence.

This pattern avoids treating JSON as the system of record while retaining a truthful point-in-time
artifact.

## Share Derivation Before Snapshotting It

Closeout preview and apply use the same cycle evaluation, estimate totals, terminal-status rules,
dependency context, and item snapshot mapping. Apply computes the snapshot from command-time rows
rather than trusting values returned by preview.

Useful rules:

- centralize domain classification and aggregation functions;
- use the same derivation for live preview and persisted evidence;
- pass an explicit clock into time-sensitive health evaluation;
- sort scope deterministically before display and persistence;
- test parity between preview counts and applied snapshot counts.

Shared derivation reduces semantic drift without coupling the command to stale client data.

## Set-Based Side Effects Keep Transactions Bounded

Closeout may move multiple work items and create one activity event per moved item. The service uses
set-based assignment updates and batched activity insertion inside one transaction.

Useful rules:

- lock the source lifecycle record before deriving command-time scope;
- update affected records as a set when every row receives the same destination;
- generate deterministic per-item activity inputs, then insert them in one repository call;
- create no item activity for retained rows;
- keep notifications outside the workflow unless an established policy explicitly requires them;
- put a product limit on fan-out before the command can grow without bound.

The important boundary is the coherent domain operation, not one database transaction per item.

## Snapshot And Current State Need Separate Language

A closed-cycle page contains both historical evidence and links to live work. Without explicit
framing, users may assume a moved item's current status or cycle was part of the closeout snapshot.

Useful product rules:

- lead completed results with an explicit snapshot label and closing timestamp;
- prefix historical item metadata with point-in-time language such as `At close`;
- label the current derived section as a live view;
- describe links as opening current work;
- keep historical values visually primary and current risk sections secondary;
- show honest absence copy for legacy records instead of fabricating history.

This pattern applies anywhere immutable evidence and live linked entities share one page.

## Seed Isolation For Destructive Browser Workflows

The existing Worktrail App and Reference Operations seeds supported older Planning and Portfolio
tests. Closing either primary cycle would make the browser suite order-dependent. v0.2.4 added a
small Closeout Lab and restores the deterministic seed after the one-time test.

Useful rules:

- preserve established seed scenarios used by prior tests;
- isolate irreversible workflows behind stable records created for that purpose;
- reset after the destructive test file, not only before the whole suite;
- verify the complete suite after the focused workflow;
- use screenshots to inspect responsive behavior that DOM assertions can miss.

Seed data is part of the reference product and deserves compatibility discipline.

## Deliberate Non-Abstractions

v0.2.4 does not introduce a generic command bus, workflow engine, snapshot framework, activity
orchestrator, or idempotency package. The closeout service remains explicit because its transaction,
replay, evidence, and side-effect rules are domain-specific.

Further extraction would need evidence from another implemented workflow with materially similar
pressure and a demonstrably smaller, clearer result.
