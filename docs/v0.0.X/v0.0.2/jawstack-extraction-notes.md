# Worktrail v0.0.2 Jawstack Extraction Notes

## Purpose

These notes capture implementation patterns that emerged while building v0.0.2. They are observations, not framework commitments. The useful extraction point is where the same pressure appears across multiple concrete applications.

## Scoped Sequence Allocation

Work item display keys use a project-scoped counter backed by Postgres constraints. The application allocates the next number inside the create transaction, then persists `item_number` and immutable `display_key`.

Potential extraction:

- scoped sequence helper that accepts tenant/resource scope;
- transactional allocation API;
- deterministic backfill strategy for existing rows;
- DTO convention for immutable human-facing keys.

Do not extract yet:

- custom key routing;
- cross-project renumbering;
- pluggable sequence formats.

## Settings Screens

Project settings combine metadata edits, lifecycle commands, taxonomy management, and project activity. This screen works because each panel maps to a clear command/query boundary rather than a generic settings abstraction.

Potential extraction:

- resource settings layout;
- command panel conventions for archive/reactivate;
- success/error state handling for independent panels;
- read-only archived-resource notices.

Do not extract yet:

- generic settings form builders;
- generic lifecycle state machines.

## Taxonomy Administration

Labels are project-scoped, archived instead of deleted, and reactivated when safe. Assignment controls show active labels only, while already-attached archived labels remain visible on work items.

Potential extraction:

- scoped taxonomy service pattern;
- active/archive/reactivate lifecycle commands;
- active-name uniqueness with archived history retained;
- assignment control filtering plus historical display.

Do not extract yet:

- workspace-global taxonomies;
- hierarchical labels;
- bulk taxonomy editing.

## Lifecycle Command Routes

Project archive/reactivate and label archive/reactivate use explicit command endpoints. Work item status transitions use a command endpoint rather than generic patching. This kept service validation and activity recording easy to reason about.

Potential extraction:

- command route naming conventions;
- command handler response shape;
- activity recording decorator or helper around commands;
- archived-resource write guard.

Do not extract yet:

- a generalized command bus;
- async command queues.

## Soft Delete And Tombstones

Deleted comments keep row identity, hide body text in DTOs, record deletion actor/time, and render as tombstones. Edit/delete permissions remain role-aware and the API is authoritative.

Potential extraction:

- soft-delete DTO mapper conventions;
- tombstone rendering contract;
- role/owner local affordance helper backed by server enforcement;
- lifecycle activity for edits/deletes without storing sensitive body text.

Do not extract yet:

- recoverable deletes;
- threaded comments;
- rich text history.

## CDK Drag/Drop Command Integration

The board uses Angular CDK for pointer behavior but keeps server-side transition validation authoritative. Drops call the same transition endpoint as status menus, use pessimistic state updates, and reload the board on success.

Potential extraction:

- connected-list command adapter;
- no-op same-list drop guard;
- rejected-drop error handling;
- fallback select/menu pattern for accessibility and deterministic testing.

Do not extract yet:

- persisted ordering;
- custom workflow columns;
- optimistic drag state reconciliation.

## Cloud Deployment Implications

The v0.0.2 features preserved the Angular static deployment path and transport-neutral API handlers. The main cloud-readiness gap remains operational rather than structural: managed migration execution, secrets management, auth integration, and Postgres connection strategy for Lambda-style runtimes.

Potential future work:

- migration runner for managed environments;
- Lambda adapter for existing endpoint handlers;
- RDS Proxy or pooled connection strategy;
- S3/CloudFront deployment template for the Angular build.
