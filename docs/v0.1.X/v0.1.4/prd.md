# Worktrail v0.1.4 PRD

## Summary

Worktrail v0.1.4 should bring saved operating views into project workspaces.

v0.1.2 made filtered work views reliable. v0.1.3 made workspace-level saved views collaborative. The next gap is project-level repetition: a project maintainer can define common workspace-wide lenses, but a project team still cannot save and share project-specific views such as "Current sprint bugs", "Release blockers", "Unassigned design tasks", "Milestone ready for QA", or "Dependency risks for this project" directly on the project Work page.

The product theme is Project Work Views. The release should let teams capture reusable project-specific filters with the same query reliability, visibility rules, and compact management model that now exists for workspace discovery.

This sprint should stay focused. It should extend Worktrail's product utility and query-artifact evidence without introducing production authentication, complex saved-view organization, custom permissions, or a generic `jawstack` package.

## Context

Worktrail now has strong foundations for daily execution:

- My Work and Action Inbox for actor-centered attention;
- top-level Work Items for cross-project discovery;
- project Work pages with filters, URL state, copy links, and CSV export;
- personal and workspace-shared saved views on top-level Work Items;
- planning, delivery health, milestones, boards, dependencies, comments, mentions, watchers, and activity;
- a local-first Angular + TypeScript API + Postgres stack with transport-neutral endpoint handlers.

The saved-view model is now credible, but incomplete. Workspace-shared views are useful for cross-project team rituals. Project teams also need recurring lenses scoped to a single project. Today they can copy a project filtered URL, but that URL is not discoverable later inside the project and cannot be maintained as part of the project operating surface.

This is a good moment to extend the pattern because the app already has:

- canonical project query serialization;
- project work list filter forms;
- project copy-link and CSV export behavior;
- personal/workspace visibility and authorization rules;
- a reusable saved-view toolbar component that can be adapted or generalized carefully.

## Problem

Project work management still loses repeatable local context.

Current friction:

- project-specific filters must be rebuilt or recovered from copied links;
- project maintainers cannot publish common project review lenses;
- contributors cannot discover the project's intended triage views from the project Work page;
- workspace-shared views are too broad for project-specific planning rituals;
- the existing saved-view data model has visibility, but not an explicit project scope;
- extraction notes have not yet tested whether saved query artifacts generalize cleanly across workspace and project scopes.

For project management software, this matters because project work is often reviewed through stable local lenses: release readiness, current milestone risk, handoff queues, triage buckets, or blocked work for a specific project. The project page should remember those lenses as part of the team workspace.

## Goals

- Add saved views to project-scoped Work pages.
- Preserve existing workspace saved-view behavior.
- Support personal project saved views for individual project workflows.
- Support shared project saved views for team operating lenses.
- Let owners and maintainers manage shared project views.
- Let contributors open shared project views without managing them.
- Keep saved project views backed by normalized `WorkItemQuery` data and canonical project URL parameters.
- Keep copy-link and CSV export behavior aligned with the applied project query after opening a saved view.
- Add deterministic seed data that demonstrates useful project-specific views.
- Add tests for scope, visibility, permissions, stale-query behavior, and UI integration.
- Update release docs and extraction notes around scoped saved query artifacts.

## Non-Goals

- Do not add production authentication.
- Do not add invitations, multi-workspace switching, custom roles, or project-specific membership.
- Do not add saved-view folders, icons, colors, descriptions, ownership transfer, custom permissions, comments, or approval flows.
- Do not add pinned views unless the technical design finds a very small, low-risk path.
- Do not add manual saved-view ordering.
- Do not add saved views to boards, planning tabs, My Work, or Inbox.
- Do not add advanced query-builder UI.
- Do not add server-side pagination or full-text search.
- Do not add short links, native share sheets, or link analytics.
- Do not extract a generic `jawstack` saved-view framework.
- Do not change CSV import/export file formats except where existing project export behavior must stay aligned with saved project views.

## Target Users

### Project Maintainer

Wants to publish project-specific lenses for triage, release review, dependency follow-up, milestone review, unassigned work, or ready-for-pickup queues.

### Contributor

Wants to open the views the project team already uses without reconstructing filters or asking for links.

### Workspace Owner

Wants project teams to standardize operating views without making every view workspace-wide.

### Individual Power User

Wants personal saved views inside a project for repeated local workflows that should not be shared.

### Reference-App Developer

Wants evidence about whether saved query artifacts can support multiple scopes before any `jawstack` extraction.

## Product Principles

- **Project views should feel local:** a project saved view belongs in the project Work page, not in a global management screen.
- **Scope must be explicit:** workspace and project views should not leak into each other or produce ambiguous names.
- **Shared views are team operating contracts:** shared project views should represent lenses the project team expects people to use.
- **Personal views remain private:** personal project views should be convenient without becoming team policy.
- **Query reliability carries forward:** saved project views must use the same applied-query contract as URL state, active chips, copy links, return URLs, and CSV export.
- **Keep the UI compact:** project Work already has filters and results; saved views should help scanning, not dominate the page.

## Scope

### 1. Scoped Saved View Model

Extend saved work views so a saved view can be scoped to either workspace discovery or a single project.

Requirements:

- Support saved-view scopes:
  - `workspace`;
  - `project`.
- Preserve existing workspace-level saved views.
- Associate project-scoped saved views with exactly one project.
- Support visibility within each scope:
  - `personal`;
  - shared, likely represented by the existing `workspace` visibility unless the technical design chooses a clearer contract name.
- Preserve owner attribution for all saved views.
- Enforce name uniqueness predictably:
  - personal project names should be unique per workspace, project, owner, and visibility;
  - shared project names should be unique per workspace, project, and visibility;
  - existing workspace saved-view uniqueness should continue to work.
- Keep query data normalized through the existing `WorkItemQuery` normalization path.
- Ensure project-scoped saved views cannot store or reopen workspace-only query fields in a confusing way.

Acceptance criteria:

- Existing workspace saved views survive migration.
- Existing saved-view API consumers remain compatible or have a documented migration path.
- Project-scoped saved views are isolated from workspace-level saved views.
- Duplicate names produce clear structured errors in the correct scope.

### 2. Saved View API Behavior

Extend the saved-view API to support scope-aware list and mutation behavior.

Requirements:

- Workspace Work Items should continue to list:
  - current actor's personal workspace views;
  - workspace-shared workspace views.
- Project Work pages should list:
  - current actor's personal saved views for that project;
  - shared saved views for that project.
- Create endpoint should support project scope where allowed.
- Update endpoint should preserve scope and visibility.
- Delete endpoint should respect scope and visibility rules.
- Personal views should remain owner-only for update/delete.
- Shared project views should be manageable by owners and maintainers.
- Contributors should list/open shared project views but not create/update/delete shared project views.
- Archived projects should remain read-only: project saved views can be opened, but shared project-view mutations should be blocked.

Acceptance criteria:

- Project saved-view list responses never include another actor's personal project views.
- Project saved-view list responses do not include workspace-level saved views.
- Workspace saved-view list responses do not include project-level saved views.
- Owner/maintainer/contributor rules are enforced by API tests.
- Archived-project write attempts return a clear structured error.

### 3. Project Work Page UI

Add saved views to the project Work page using a compact, consistent interaction model.

Requirements:

- Show saved views near the project filters/results area.
- Separate shared project views from personal project views.
- Let users save the current applied project query as a personal project view.
- Let owners and maintainers save the current applied project query as a shared project view when the project is active.
- Let every active member open shared project views.
- Hide or disable shared management controls for contributors with clear helper copy.
- Keep the project saved-view manager compact and keyboard usable.
- Preserve existing project filter, active-chip, copy-link, return-URL, and CSV export behavior.

Acceptance criteria:

- A project contributor can open a shared project view.
- A project contributor does not see misleading management controls.
- A project owner or maintainer can create, rename, update-query, and delete a shared project view.
- A user can create, open, rename, update-query, and delete a personal project view.
- Opening a project saved view updates the project Work URL with canonical project query params.

### 4. Seeded Project Operating Views

Add deterministic project-scoped saved views that demonstrate real project rituals.

Candidate seeded views:

- `Release blockers`;
- `Ready for QA`;
- `Unassigned project work`;
- `Current milestone risk`;
- `Open dependency risks`.

Requirements:

- Seed views should be tied to active seeded projects.
- Seed views should use meaningful project-supported `WorkItemQuery` values.
- At least one seeded shared project view should produce a visible result set.
- At least one seeded personal project view should prove per-actor isolation.

Acceptance criteria:

- Seeded shared project views appear on the relevant project Work page.
- Opening seeded project views produces matching active chips and results.
- Seed data remains deterministic after repeated `db:seed` runs.

### 5. Activity And Audit Signal

Add lightweight activity for shared project-view management if it fits existing patterns.

Requirements:

- Prefer project activity for shared project-view create, rename, query update, and delete.
- Do not add workspace activity for project-view management unless there is a clear workspace-level reason.
- Do not add project activity for personal project saved-view changes.
- Keep summaries concise and readable.

Acceptance criteria:

- Project activity can show shared project-view management by owners/maintainers.
- Personal saved-view changes do not create noisy activity events.
- Activity entries identify the saved view and actor.

### 6. Reusable Saved-View UI And Query Artifact Pressure

Use this sprint to improve code shape only where the second saved-view surface justifies it.

Requirements:

- Reuse the existing saved-view toolbar where practical.
- If workspace and project pages need different behavior, extract only small feature-local helpers or inputs rather than creating a broad framework.
- Keep query serialization scope-aware.
- Keep saved-view summary behavior quiet for defaults.
- Add tests for both workspace and project saved-view grouping after any component changes.

Acceptance criteria:

- Workspace saved-view UI still passes existing tests.
- Project saved-view UI does not duplicate large blocks of brittle component logic.
- Extraction notes can clearly describe what generalized and what stayed app-specific.

### 7. Documentation And Public Surface

Document the release as an extension of Team Work Views into project workspaces.

Requirements:

- Update README with:
  - project saved views;
  - personal versus shared project views;
  - owner/maintainer/contributor behavior;
  - relation to project URLs, copy links, and CSV export.
- Update the public site if the feature is polished enough to mention.
- Add v0.1.4 release notes.
- Add v0.1.4 jawstack extraction notes.
- Preserve v0.1.2 and v0.1.3 query-artifact notes as source material.

Acceptance criteria:

- Documentation explains where workspace views end and project views begin.
- Extraction notes distinguish concrete Worktrail implementation from future framework candidates.

## UX Requirements

- Use familiar controls: buttons for save actions, disclosure for management, inputs for names, and menus only where option sets justify them.
- Avoid burying the project Work results under saved-view management.
- Keep long saved-view names, project names, labels, and milestone names from overflowing controls.
- On mobile, saved views should stack cleanly above filters/results without forcing horizontal scrolling.
- Management controls should have visible labels or accessible names that make destructive actions clear.
- Empty states should explain whether no shared views exist or whether the actor cannot manage them.

## Technical Requirements

- Preserve Angular static build suitability.
- Preserve transport-neutral endpoint handlers.
- Use Postgres migrations through Drizzle.
- Keep saved view queries validated and normalized at API boundaries.
- Keep route query params canonical and scope-aware.
- Keep API responses compatible where reasonable.
- Update OpenAPI for any request/response shape changes.
- Keep generated build artifacts out of git.
- Maintain lint, typecheck, unit, build, and Playwright smoke coverage.

## Permission Requirements

- Active owners and maintainers can manage shared project views for active projects.
- Active contributors can open shared project views but cannot manage them.
- Personal project views can only be managed by their owner.
- Inactive members cannot act.
- Archived projects should allow opening existing saved views but block shared project-view creation, update, and delete.
- Existing local actor selection remains a development-only stand-in and is not production authentication.

## Data And Migration Requirements

- Add any new saved-view scope/project columns through a migration.
- Preserve existing v0.1.3 saved views as workspace-scoped views.
- Maintain case-insensitive uniqueness by saved-view scope.
- Ensure seed upserts are idempotent.
- Avoid storing project-only state in a workspace-ambiguous way.
- Keep stale saved views readable where practical, especially if labels, milestones, members, or projects later become archived or inactive.

## Testing Requirements

- Contract tests for any saved-view scope additions.
- API tests for:
  - workspace saved views remain compatible;
  - project saved-view list isolation;
  - personal project view CRUD;
  - shared project view CRUD by owner/maintainer;
  - contributor forbidden mutations;
  - archived-project mutation rejection;
  - duplicate names by scope;
  - query normalization and workspace-only field stripping.
- Frontend tests for:
  - project saved-view grouping;
  - role-aware controls;
  - canonical URL update on open;
  - applied-query save/update behavior;
  - existing workspace saved-view behavior after component reuse.
- Playwright smoke for:
  - opening a seeded shared project view;
  - confirming active chips and result set;
  - creating or opening a personal project view;
  - switching to contributor and confirming shared view read-only behavior.

## Documentation Requirements

- Add `docs/v0.1.4/technical-design.md`.
- Add `docs/v0.1.4/implementation-plan.md`.
- Add `docs/v0.1.4/release-notes.md` during finalization.
- Add `docs/v0.1.4/jawstack-extraction-notes.md` during finalization.
- Update README and public site during finalization if the implementation ships the planned capability.

## Success Metrics

- Project teams can save and reopen project-specific operating views.
- Contributors can discover shared project views without reconstructing filters.
- Opening saved project views preserves trustworthy URL, chip, copy-link, and export behavior.
- Existing workspace saved views continue to work without regression.
- The codebase has clearer evidence for or against a future scoped query-artifact abstraction.

## Risks

- **Data model churn:** adding project scope to existing saved views could complicate uniqueness and compatibility.
- **UI crowding:** adding saved views to project Work may make the page feel heavier if management controls are too prominent.
- **Scope confusion:** users may not immediately understand workspace views versus project views.
- **Permission ambiguity:** project-specific views may imply project-specific membership, which Worktrail does not yet support.
- **Over-abstraction:** a second saved-view surface may tempt premature generic framework extraction.
- **Test complexity:** scope, visibility, and role combinations need focused tests to avoid fragile broad coverage.

## Mitigations

- Keep the first project saved-view UI compact and close to the existing toolbar pattern.
- Use explicit copy such as "Shared project views" and "Personal project views".
- Keep authorization aligned with existing workspace roles until project-specific membership exists.
- Add compatibility tests for existing workspace saved views before changing repository behavior.
- Extract only small app-local helpers justified by actual duplication.
- Prefer deterministic seed examples for smoke coverage.

## Open Decisions

The technical design should resolve:

1. Whether to represent shared project views with existing `visibility: 'workspace'` plus `scope: 'project'`, or introduce a clearer visibility term.
2. Whether saved-view list endpoints should be filtered by query parameters, separate routes, or a backward-compatible default plus optional scope fields.
3. Whether project activity should include shared project saved-view events in v0.1.4 or be deferred.
4. Whether to add pinned project saved views if the data model change makes it trivial, or keep pinning out of scope.
5. Whether stale project saved views should remain visible if their project is archived, and exactly which mutations remain blocked.
6. Whether to share one saved-view toolbar component across workspace and project pages or create a thin wrapper per surface.

## Recommended Direction

Proceed with project-scoped saved views as the core v0.1.4 feature.

Default to a conservative model:

- add explicit saved-view scope;
- keep visibility as `personal | workspace` unless the technical design finds that name too confusing for project scope;
- use existing owner/maintainer/contributor workspace roles for shared project-view permissions;
- add project activity only for shared project-view management if the implementation is straightforward;
- defer pinning, ordering, folders, descriptions, and custom permissions.

This is the highest-ROI next step because it improves real project usability while testing whether the query-artifact pattern holds across a second scope.
