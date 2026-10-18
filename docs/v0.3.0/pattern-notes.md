# Worktrail v0.3.0 Pattern Notes

## Purpose

These are observations from adopted production owners, not a framework/package proposal or a
commitment to an extraction destination. Consolidation exposed where apparently similar flows need
shared semantics and where their lifecycle differences must remain explicit.

## Separate Draft, Applied Query And Historical Evidence

A filter form is tentative intent. Applied query plus page position describes visible results.
Saved-view identity compares canonical query state, not an arbitrary form or label. Page position is
not part of saved-query identity. Exact predicate descriptors can drive chips and correction links
without inventing a generic UI schema.

Live query evolution must not reinterpret immutable evidence. Freeze old snapshot types/parsers;
produce a new version where current predicates or count units differ. Share/print all historical
commitments, and disclose live context separately. See [query policy](query-policy.md) and
[historical evidence](historical-closeout-evidence.md).

## Commit Context Before Accepting Responses

Route parameters can emit before navigation commits; reused components do not necessarily remount.
Own route, workspace and actor context together, accept committed navigation, and attach generations
to every success, error and finalizer. Transport cancellation alone cannot prevent an obsolete
callback from changing current state. Focused clients and feature stores preserve actual ownership;
they do not require a universal application state machine.

An unresolved startup actor is not a deliberate identity switch. Preserve deep-linked query/page
state through initial member loading while still invalidating and reloading actor-sensitive requests;
reserve paging resets for later meaningful actor/project changes. Force delayed bootstrap in tests
instead of relying on ordinary network timing to expose this distinction.

Draft departure is a different decision boundary. Compare meaningful source/format/recipient state
with its baseline before context reset. Stay retains independent drafts; Discard is explicit; pending
server writes cannot be canceled by discarding a form. See [context](reactive-context-evidence.md)
and [departure](draft-departure-evidence.md) evidence.

## Bound Inspection Context, Not User Intent

Carry a validated original origin and at most one immediate work item instead of recursively nesting
return URLs. Section/comment targeting is a loaded-content concern; URL validation is not record
authorization. A return path must refresh the review that prompted correction, not restore stale
counts. Read-first detail and disclosed administration keep common actions visible without removing
less frequent capabilities. See [navigation](bounded-navigation-evidence.md).

## Give Commands Authoritative Transaction Owners

Persist through an explicit context, coordinate project/cycle lifecycle before row locks, and read
the current state after the necessary locks. Side effects use the real previous state and commit
with the mutation. Do not emulate a transaction with optional repository fallbacks. Lock order and
participation are contracts across commands, including archive, hierarchy, board and closeout paths.
Real synchronized connections reveal races that mocked repository calls cannot prove absent.

## Measure The Complete Read Path

Batched IDs remove repeated reference lookups; aggregate projections should select useful preview
IDs before enriching records. Query counts alone can hide materialized rows or payload growth, so
record counts, enriched rows, bytes and cold/warm context together. Domain input bounds must also
survive transport parsing. See [hydration](hydration-evidence.md),
[aggregates](aggregate-evidence.md) and the API integration evidence in
[verification notes](verification-notes.md).

## Make Verification An Owned Operation

A disposable default is stronger than a warning next to destructive commands. Private snapshots,
nonce-marked resources, explicit database identity, random ports and tracked process groups make
isolation executable. Cleanup must attempt every verified group, retain unresolved ownership and
preserve original errors. Test interruption, failure, concurrent runs and abandoned cleanup with
real children/resources as well as deterministic fixtures.

Evidence should match risk: focused affected consumers during implementation, one complete final-tree
run at release, and no repeated functional suites for documentation-only closure. Native zoom is not
CSS scaling; synthetic composition is not real IME; automated accessibility checks are not a
screen-reader walkthrough. Preserve diagnostic failures and state exact manual limits.

## Deliberate Non-Abstractions

No general command bus, query registry, workflow engine, universal draft store, generic lock manager,
or extracted package was introduced. Shared owners have real consumers and narrow responsibilities.
Readability, data integrity, compatible history and usable repeated workflows are the criteria for
future reuse, not reduced line counts or a predetermined framework destination.
