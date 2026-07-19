# Worktrail v0.1.4 Jawstack Extraction Notes

## Purpose

v0.1.4 extends saved query artifacts from workspace discovery into project workspaces.

These notes capture extraction signals for `jawstack`. They build on v0.1.2 query-contract notes and v0.1.3 shared saved-view notes. They should be read as product evidence, not a commitment to extract a framework package yet.

Source material:

- `docs/v0.1.2/0006-query-contracts-url-state.md`
- `docs/v0.1.2/jawstack-extraction-notes.md`
- `docs/v0.1.3/jawstack-extraction-notes.md`

## Scoped Saved Query Artifacts

v0.1.3 proved that saved query artifacts need visibility, ownership, permission rules, and audit behavior. v0.1.4 adds scope.

Worktrail now has two saved-view scopes:

- `workspace`: top-level cross-project Work Items discovery;
- `project`: one project Work page.

The same visibility values apply inside both scopes:

- `personal`: visible and mutable only by the owner;
- `workspace`: shared with active workspace members and mutable by owners and maintainers.

Extraction signal:

- Durable query artifacts need both audience and location.
- Visibility alone is not enough once the same artifact type appears on multiple product surfaces.
- A future abstraction should treat scope as part of the saved artifact identity, uniqueness policy, query normalization, and route projection.

## Scope-Aware Query Normalization

Workspace and project Work pages share `WorkItemQuery`, but they do not support identical fields.

Workspace saved views can include workspace-only fields such as `projectId` and `archivedProjects`. Project saved views are attached to a project and strip workspace-only fields before persistence and route projection.

Extraction signal:

- A shared query model does not remove the need for surface-aware normalization.
- Scope-specific stripping is product behavior, not an implementation detail.
- Saved artifacts should persist normalized query state for their scope, not whatever a caller submitted.

## Scoped Uniqueness

The saved-view database now uses partial unique indexes by scope and visibility:

- workspace personal names are unique by workspace, owner, and lowercased name;
- workspace shared names are unique by workspace and lowercased name;
- project personal names are unique by workspace, project, owner, and lowercased name;
- project shared names are unique by workspace, project, and lowercased name.

Extraction signal:

- User-facing names need uniqueness rules that match where users encounter the artifact.
- Case-insensitive uniqueness remains a product quality concern.
- Partial unique indexes are a strong Postgres pattern for scoped artifact names.

## Authorization And Read-Only State

Project saved views reuse the v0.1.3 visibility rules with an added project lifecycle rule:

- personal views remain owner-only for mutation;
- shared views require owner or maintainer role for mutation;
- contributors can open shared project views;
- active contributors can still create and manage personal project views;
- archived projects keep saved project views readable/openable but block project-scoped create, update, and delete.

Extraction signal:

- Artifact authorization may depend on both artifact visibility and the lifecycle state of the parent scope.
- Read-only parent states should be represented consistently across create, update, and delete.
- UI tests should assert that read-only shared artifacts stay useful, not merely hidden.

## Activity Boundary

Workspace shared-view management emits workspace activity. Shared project-view management emits project activity.

Personal saved-view changes remain private and do not add shared activity noise.

Extraction signal:

- Shared artifact changes deserve audit activity in the same scope where the artifact is used.
- Activity routing is part of scoped artifact design.
- Audit summaries can stay compact while still identifying create, rename, query update, combined update, and delete operations.

## Reusable Toolbar, Product-Owned Capability

The saved-views toolbar now supports workspace and project copy, section labels, query summary scope, shared-helper text, read-only helper text, and compatibility inputs.

The product pages still own capability decisions:

- actor role;
- project archived state;
- API list scope;
- create scope;
- route/query projection;
- mutation permission checks.

Extraction signal:

- Presentational reuse is useful, but a framework primitive should not absorb page-specific capability derivation too early.
- The repeatable pattern is "page owns scope and permissions; component renders artifact collections and emits intents."
- Compatibility inputs can reduce churn while a reference app explores the right component boundary.

## Seeded Operating Lenses

v0.1.4 seeds shared project views such as:

- `Release blockers`;
- `Ready for QA`;
- `Unassigned project work`;
- `Current milestone risk`;
- `Open dependency risks`.

These views demonstrate that project saved views are not only persistence. They make the project Work page a stronger operating surface.

Extraction signal:

- Reference apps should seed scoped examples that prove the artifact's purpose.
- Seeded artifacts stabilize browser smoke tests for URL, chip, row, and permission behavior.
- The value of saved query artifacts becomes clearer when examples match real team rituals.

## Relationship To Query Contracts

Project saved views reopen through canonical project URL parameters. The active chips, copy-link action, detail return URLs, and CSV export then reuse the same applied project query.

This keeps the v0.1.2 principle intact: one applied query, many projections.

Extraction signal:

- A saved artifact should reopen through public route contracts where possible.
- The route remains the source of visible applied state after opening a saved view.
- Browser smoke coverage is valuable because it verifies persistence, routing, chips, rows, and permission-specific controls together.

## Deferred Extraction Pressure

The release deliberately avoids:

- a standalone saved-view package;
- a generic `jawstack` query-artifact abstraction;
- saved views outside workspace and project Work pages;
- project-specific membership;
- pinned or ordered saved views;
- folders, icons, colors, descriptions, ownership transfer, comments, approvals, or custom saved-view permissions;
- short links, analytics, or native share sheets;
- advanced query-builder UI.

Extraction signal:

- The pattern is stronger after repeating across workspace and project scopes, but it is still one product.
- The next useful evidence would come from another reference app or another Worktrail artifact with different query semantics.
- A future abstraction should likely start as conventions and test fixtures: canonical query, scope-aware normalization, scoped saved artifact, visibility-aware authorization, parent lifecycle checks, quiet defaults, route projection, and activity routing.
