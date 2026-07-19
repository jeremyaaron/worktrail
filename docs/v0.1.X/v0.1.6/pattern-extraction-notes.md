# Worktrail v0.1.6 Pattern Extraction Notes

## Purpose

v0.1.6 adds project batch triage to Worktrail.

These notes capture reusable product and engineering signals without naming a destination framework or assuming the pattern is ready to extract. They should be read as evidence from a reference app, not as a package design.

The relevant pattern is not just "bulk edit." It is the combination of temporary selection state, explicit command contracts, partial-success result envelopes, and side-effect boundaries.

## Temporary Selection State

Selection is local interaction state owned by the project Work page.

It is cleared when:

- filters change;
- query parameters change;
- saved or pinned views open;
- the project result set reloads and selected ids are no longer visible;
- the actor or project lifecycle no longer allows bulk mutation.

Extraction signal:

- Selection should start as page-local state, not a durable business object.
- Durable selection sets are a separate product feature and should not be implied by a checkbox list.
- Selection should be scoped to the loaded result set unless the product explicitly supports query-wide selection.
- Page owners should decide when selection invalidates because they understand route, query, permission, and lifecycle context.

## Explicit Batch Commands

The bulk endpoint accepts one discriminated action:

- `set_assignee`;
- `clear_assignee`;
- `set_priority`;
- `set_milestone`;
- `clear_milestone`;
- `set_due_date`;
- `clear_due_date`;
- `add_labels`;
- `remove_labels`;
- `transition_status`.

It does not accept a generic patch object.

Extraction signal:

- Batch commands are easier to validate, audit, and explain when each request carries one intent.
- Explicit action types keep client controls aligned with server validation.
- Command contracts can cap request size, reject duplicates, and validate action references before item processing.
- A command envelope is a better fit than a flexible patch object when side effects vary by field.

## Partial-Success Result Envelopes

The response reports aggregate counts and per-item result rows:

- `updated`;
- `unchanged`;
- `failed`.

`unchanged` is successful. It means the row was valid and writable, but the command did not change stored state.

Extraction signal:

- Multi-row commands need user-facing recovery paths.
- Per-item results should preserve request order.
- Failed rows should include stable labels such as display keys when available.
- Unchanged rows should not be treated as errors.
- Successful and unchanged rows can clear from selection, while failed rows remain selected when still visible.

## Side-Effect Boundary

Bulk commands reuse single-item side effects:

- activity for changed fields;
- notifications for changed assignee/status/comment/watch/dependency paths where applicable;
- no timestamp, activity, or notification churn for unchanged rows.

v0.1.6 also adds due-date activity parity through `work_item.due_date_changed`.

Extraction signal:

- Batch commands should not bypass existing write policy or side-effect services.
- "No change" must be detected before emitting activity or notifications.
- Side effects should describe the actual field-level change, not merely the fact that a bulk command ran.
- New bulk pathways can reveal audit gaps in single-item behavior; due-date activity was one such gap.

## Permission And Lifecycle Gates

Bulk mutation is owner/maintainer-only in v0.1.6.

Archived projects reject bulk updates. Contributors can read shared project operating views and open work, but do not see misleading batch mutation controls.

Extraction signal:

- Batch mutation often deserves stricter permission than single-row editing.
- UI absence paths are useful, but server enforcement remains mandatory.
- Parent lifecycle restrictions apply before per-item processing.
- Read-only users should retain navigation and review value where possible.

## Option Scope

The first batch workflow is project-scoped because labels and milestones are project-local.

Extraction signal:

- Batch action scope should match the scope of referenced option sets.
- Cross-project batch edit is not just a UI expansion; it needs a strategy for incompatible labels, milestones, workflows, and permissions.
- Starting with one project can produce stronger command evidence than prematurely generalizing across scopes.

## Browser Evidence

The Playwright smoke test uses seeded project rows and a seeded label:

- select `WT-2` and `WT-3`;
- apply the `design` label;
- verify result counts;
- verify updated rows;
- switch to contributor and verify bulk controls are absent.

Extraction signal:

- Seeded data should prove the workflow from a fresh reset/migrate/seed.
- Browser coverage should test one happy path and one absence path for permission-sensitive batch controls.
- Deterministic seed rows make batch workflows less brittle than creating all data during the test.

## Deferred Extraction Pressure

v0.1.6 deliberately avoids:

- cross-project bulk edit;
- board bulk actions;
- bulk delete;
- bulk comments;
- bulk relationship editing;
- query-wide durable selection sets;
- background jobs;
- custom bulk permissions;
- a generic batch-command package.

The pattern is useful, but still product-local. Better extraction evidence would come from another bounded context with different option scopes, different side effects, or long-running/background batch execution.
