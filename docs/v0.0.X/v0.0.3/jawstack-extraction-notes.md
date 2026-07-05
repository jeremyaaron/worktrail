# Worktrail v0.0.3 Jawstack Extraction Notes

## Purpose

These notes capture implementation patterns that emerged while building v0.0.3. They are observations, not framework commitments. The useful extraction point is where the same pressure appears across multiple concrete applications.

## Project-Scoped Planning Entities

Milestones are scoped to a project, have their own lifecycle, and can be assigned to work items. Archived milestones stay readable and remain visible on already-assigned work, while assignment controls prefer active milestones.

Potential extraction:

- scoped planning entity conventions;
- active/archive/reactivate lifecycle commands;
- assignment controls that separate active choices from historical display;
- read-only guards that cascade from parent project state.

Do not extract yet:

- cross-project milestones;
- portfolio or release train models;
- milestone dependency graphs.

## Planning Summary Endpoints

The planning dashboard uses a purpose-built summary endpoint instead of asking the client to derive risk buckets from raw work item lists. The server owns overdue, due-soon, blocked, unassigned, stale, and milestone progress calculations.

Potential extraction:

- summary endpoint response shape;
- deterministic date-window helpers;
- risk bucket link contracts back into filtered list views;
- query tests that pin time-sensitive calculations.

Do not extract yet:

- generic analytics builders;
- customizable risk formulas;
- background materialized summary jobs.

## Durable Board Ordering

Board order became a product signal in v0.0.3. Work items now store status-scoped positions, and board movement uses explicit command semantics for same-column reorder and cross-status moves.

Potential extraction:

- ordered collection repository helper;
- neighbor-based reorder command contract;
- status-scoped order normalization;
- optimistic UI reconciliation pattern for ordered lists.

Do not extract yet:

- arbitrary nested ordering;
- multi-select moves;
- custom workflow column definitions.

## Applied Filter State

The work item list now treats route query parameters as the applied filter source. Dropdown changes apply immediately, search applies after a debounce, and active filter pills reflect only the applied route state.

Potential extraction:

- route-backed filter state helper;
- debounced text filter convention;
- active filter chip derivation from applied state;
- clear/reset behavior for reusable list pages.

Do not extract yet:

- full saved-view management;
- arbitrary query builders;
- server-driven filter UI schemas.

## Planning Dashboard UI

The planning dashboard combines dense operational information with direct links into the underlying work list. Empty states are compact, progress indicators are data-backed, and each risk card preserves a clear workflow path.

Potential extraction:

- dashboard card layout primitives for operational tools;
- progress summary component;
- compact empty state conventions;
- summary-to-list navigation helpers.

Do not extract yet:

- generic dashboard composition;
- charting abstractions;
- drag-configurable dashboard layouts.

## Activity Around Planning Commands

Milestone creation, lifecycle changes, assignment changes, board reorders, and status moves all record activity. This kept planning state observable without adding a separate audit subsystem.

Potential extraction:

- activity recording helper around command handlers;
- event naming conventions for lifecycle and movement commands;
- actor-context propagation through service and repository layers.

Do not extract yet:

- event sourcing;
- activity subscription feeds;
- notification delivery.

## Cloud Deployment Implications

The v0.0.3 features preserved the Angular static deployment path and transport-neutral API handlers. The new planning summary and board reorder commands are still ordinary request/response handlers, which keeps a Lambda/API Gateway adapter plausible.

Potential future work:

- Lambda adapter for existing endpoint handlers;
- managed migration runner;
- RDS Proxy or pooled connection strategy for serverless runtimes;
- S3/CloudFront deployment template for the Angular build;
- environment-specific seed and demo-data controls.
