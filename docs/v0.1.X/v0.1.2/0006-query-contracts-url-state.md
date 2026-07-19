# Opportunity: Query Contracts And URL State

## Status

Draft

## Problem

Operational TypeScript applications often let query behavior drift across URL state, API parsing, repository filters, saved views, dashboards, exports, and UI labels. Once those surfaces diverge, filters become hard to trust and links stop representing the data users expect.

## Current Signals

Worktrail has a strong first signal. Its work item query model powers:

- URL query parameters
- API request parsing and normalization
- repository predicate construction
- frontend serialization
- active filter labels
- dashboard links
- saved views
- CSV export
- delivery-health reason links

The v0.1.0 extraction notes explicitly say that once a query model powers list state, URLs, saved views, exports, and dashboard links, it should be treated as a product contract.

## Candidate Product Shape

Not a standalone package yet.

Possible future shape:

- typed query contract definitions
- parse/normalize helpers
- URL serialization helpers
- active-label helpers
- saved-view validation helpers
- export/query reuse conventions
- dashboard metric link helpers
- test fixtures for query round-tripping

## Dogfood Targets

- First: Worktrail
- Second: the next reference app with dense list/filter behavior
- Third: `jawstack`, if repeated query-contract patterns become framework-worthy

## Strategic Fit

Medium-high. This is one of the clearest lower-level signals from Worktrail because it ties product UX, API boundaries, persistence, and exports together.

It should remain app-local until another reference app repeats the same pressure. Extracting now risks encoding Worktrail-specific filter semantics too early.

## Open Questions

- Which parts are generic: parsing, serialization, labels, saved-view validation, repository predicates, or all of them?
- Should this be a `jawstack` convention rather than a separate package?
- How much should it assume about frontend router, API framework, or database layer?
- Can this be tested through generated round-trip fixtures?
- Does the next reference app confirm the same pattern?
