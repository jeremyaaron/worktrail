# Worktrail v0.1.5 Pattern Extraction Notes

## Purpose

v0.1.5 promotes selected saved query artifacts into pinned operating shortcuts.

These notes capture reusable product and engineering signals without naming a destination framework or assuming the pattern is ready to extract. They should be read as evidence from a reference app, not as a package design.

Relevant source material includes the v0.1.2 query-contract notes and the earlier saved-view pattern notes from v0.1.3 and v0.1.4.

## Promoted Query Artifacts

Pinned views are not a new artifact type. They are saved work views with one additional promotion flag.

The important distinction:

- saved view: durable named query artifact;
- pinned view: promoted access path to the same artifact.

Extraction signal:

- Promotion should not fork query semantics.
- A promoted artifact should reopen through the same canonical route projection as its unpinned form.
- The durable artifact remains the source of ownership, visibility, query normalization, and permission behavior.

## Scope Matters

Pinned shortcuts appear where the saved view belongs:

- workspace scoped saved views appear on top-level Work Items;
- project scoped saved views appear on the owning project Work page.

Extraction signal:

- Promotion belongs to a product surface, not a global shortcut list by default.
- Scope should be part of shortcut eligibility, rendering, URL projection, and archived/read-only behavior.
- A shortcut component can stay simple when page owners compute scoped groups.

## Visibility And Mutability Stay Separate

Pinned state is independent from saved-view visibility:

- personal views can be pinned by their owner;
- shared views can be pinned by owners and maintainers;
- contributors can open shared pins but cannot change shared pinned state.

Extraction signal:

- Read access and promotion mutability are separate capability checks.
- Shared promoted artifacts should remain useful to read-only users.
- UI tests should assert both visibility and absent mutation controls.

## Parent Lifecycle Rules Still Apply

Archived projects show existing project saved views and pinned shortcuts, but reject project-scoped saved-view mutations, including pin and unpin.

Extraction signal:

- Promotion does not bypass parent lifecycle restrictions.
- Parent lifecycle should be enforced server-side, not just hidden in the UI.
- Read-only states should preserve navigation value wherever possible.

## Activity Boundary

Pinning a shared saved view changes a team operating surface, so shared pin/unpin emits activity:

- workspace scoped shared pin changes emit workspace activity;
- project scoped shared pin changes emit project activity;
- personal pin changes stay private and do not emit shared activity.

Extraction signal:

- Promotion changes may deserve audit treatment when they alter a shared surface.
- Activity should be routed to the same scope where the promoted artifact appears.
- Private preference changes should avoid shared activity noise.

## Rendering Boundary

The pinned-shortcuts component accepts already-filtered shared and personal groups and emits an open intent. It does not fetch data, compute permissions, mutate state, or know route details.

Page owners handle:

- saved-view list loading;
- scope filtering;
- capability derivation;
- open behavior;
- pin/unpin mutation;
- error handling.

Extraction signal:

- Product pages should own scope, permissions, and route behavior.
- Shared components should render collections and emit intents until repeated product evidence justifies a heavier abstraction.
- A small component boundary can provide reuse without obscuring policy.

## Deterministic Seeds As Product Proof

Seeded pinned views such as `Dependency risks`, `Ready for pickup`, `Release blockers`, and `Ready for QA` prove the feature with realistic operating lenses.

Extraction signal:

- Seed data should demonstrate why the promoted artifact exists.
- Browser smoke tests become stronger when they open seeded shortcuts and verify URL, chips, and rows.
- Seed upserts should repair all deterministic artifact fields, including ownership, so long-lived local databases remain stable across sprint changes.

## Deferred Extraction Pressure

v0.1.5 deliberately avoids:

- generic promoted-artifact infrastructure;
- pinned saved-view ordering;
- folders, icons, colors, descriptions, or ownership transfer;
- saved-view comments, approvals, or change requests;
- custom shared-view permissions;
- short links, analytics, or native sharing;
- saved views outside workspace and project Work pages.

The pattern is useful, but still product-local. Better extraction evidence would come from another promoted artifact type or another reference app with different query semantics.
