# Worktrail v0.1.3 Jawstack Extraction Notes

## Purpose

v0.1.3 extends Worktrail's reliable query-state work into workspace-shared saved views.

These notes capture extraction signals for `jawstack`. They build on the v0.1.2 query-contract notes and should be read as product evidence, not a commitment to extract a framework package yet.

Source material:

- `docs/v0.1.2/0006-query-contracts-url-state.md`
- `docs/v0.1.2/jawstack-extraction-notes.md`

## Shared Query Artifacts

v0.1.2 established "one applied query, many projections." v0.1.3 adds a new product concept on top of that: a saved query artifact with visibility, ownership, and permission rules.

A workspace-shared saved view is not only serialized filter state. It is a team-facing operating lens that can be listed, opened, managed, audited, and trusted by multiple actors.

Extraction signal:

- Query contracts become more valuable when they can back durable artifacts, not only URLs and requests.
- A useful abstraction may need to model the lifecycle of saved query artifacts: create, open, rename, update query, delete, and summarize.
- Visibility and permissions are part of the artifact contract. They should not be bolted onto a generic saved-query blob later.

## Personal Versus Workspace Visibility

Worktrail now supports two saved-view visibility modes:

- `personal`: visible and mutable only by the owner;
- `workspace`: visible to active workspace members and mutable by owners and maintainers.

The data model keeps an owner on both visibility modes. For workspace views, ownership is attribution, while management authorization comes from the current actor role.

Extraction signal:

- Visibility and ownership are related but not identical.
- A generic pattern should avoid assuming creator-only management for shared artifacts.
- Shared artifact APIs should make visibility explicit on create and stable on update until there is a clear conversion workflow.

## Scoped Uniqueness

The database uses partial unique indexes:

- personal names are unique by workspace, owner, and lowercased name;
- workspace names are unique by workspace and lowercased name.

This matches product expectations better than a single uniqueness rule across all views.

Extraction signal:

- Shared artifact uniqueness usually follows the visibility scope.
- Case-insensitive uniqueness is part of user-facing quality, not merely database hygiene.
- Partial indexes are a practical Postgres pattern for visibility-scoped names.

## Authorization Semantics

The API deliberately preserves different error behavior by visibility:

- cross-actor personal saved views remain not found;
- visible workspace views return forbidden when the actor lacks mutation rights.

This avoids leaking personal artifacts while still giving clear policy feedback for shared artifacts.

Extraction signal:

- Authorization should account for artifact visibility.
- Not-found and forbidden semantics are product behavior, not just transport details.
- Tests should assert both visibility and mutation rules.

## UI Boundary

The workspace Work Items page splits API results into shared and personal collections before handing them to the saved-views toolbar.

The toolbar stays presentational:

- shared views are listed first;
- personal views remain available;
- shared management controls are shown only when the actor can manage workspace views;
- contributors see helper copy and can open shared views without misleading controls.

Extraction signal:

- Product pages often own capability derivation because they have actor, route, and API context.
- Presentational components can still encode strong UX vocabulary such as shared versus personal sections.
- Compatibility inputs can help a component evolve without forcing every call site to migrate at once.

## Activity As Audit Signal

Workspace activity is emitted only for workspace-shared saved-view management.

Personal saved-view changes remain private and do not add workspace noise. Shared-view changes are workspace-relevant because they affect common operating lenses.

Extraction signal:

- Shared artifact changes often deserve audit/activity treatment.
- Personal artifact changes usually should not be promoted to workspace activity.
- Audit payloads should identify the artifact and meaningful name changes without storing noisy full query JSON unless a product workflow needs it.

## Seeded Operating Lenses

The deterministic seed data includes shared views such as:

- `Blocked work`;
- `Dependency risks`;
- `Due soon`;
- `Unassigned open work`;
- `Ready for pickup`.

These prove that the feature is not only a management surface. It makes the demo workspace easier to operate.

Extraction signal:

- Reference apps should seed examples that demonstrate why a pattern exists.
- Shared query artifacts are most convincing when they map to real team rituals.
- Seeded artifacts are useful smoke-test anchors because they stabilize expected query behavior.

## Relationship To Query Contracts

Workspace-shared saved views reuse normalized `WorkItemQuery`.

They open through canonical URL parameters, feed active chips, support copy-link behavior, and keep CSV export aligned with the visible applied result set.

Extraction signal:

- Saved query artifacts should reuse the same canonical query model as URLs, exports, and links.
- A saved artifact should reopen through the public route contract where possible, not through private component state.
- The v0.1.2 query-contract pattern remains the foundation. v0.1.3 adds artifact governance around it.

## Deferred Extraction Pressure

The release deliberately avoids:

- a standalone saved-view package;
- a generic `jawstack` query-artifact abstraction;
- project-scoped saved views;
- pinned or ordered saved views;
- folders, icons, colors, descriptions, or ownership transfer;
- custom saved-view permissions;
- short links or analytics;
- advanced query-builder UI.

Extraction signal:

- The shape is stronger than it was in v0.1.2, but one app still is not enough evidence for a framework primitive.
- The next useful step is to repeat the pattern in another reference app or a different Worktrail artifact before extracting code.
- A future abstraction should likely start as a convention: canonical query, scoped saved artifact, visibility-aware authorization, quiet defaults, and projection tests.
