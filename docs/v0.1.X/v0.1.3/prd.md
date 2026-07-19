# Worktrail v0.1.3 PRD

## Summary

Worktrail v0.1.3 should make reliable filtered work views collaborative.

v0.1.2 made work item query state trustworthy across URLs, chips, saved views, copied links, dashboard links, delivery-health links, return URLs, and exports. v0.1.3 should build on that foundation by introducing team-shared work views: named filtered views that maintainers and owners can publish for the workspace so recurring project operations are not trapped in one person's local saved views.

The product theme is Team Work Views. The release should help a team establish common operating lenses such as "Blocked work", "Due soon", "Unassigned work", "Ready for pickup", "Dependency risks", or "Release planning review" without requiring every contributor to recreate the same filters.

This sprint should remain focused. It should not introduce production authentication, multi-workspace membership, advanced query-builder UI, or a generic `jawstack` saved-view package. It should improve Worktrail directly while capturing extraction signals around shareable query artifacts, visibility, ownership, and permissions.

## Context

Worktrail now has a credible set of daily operating surfaces:

- My Work and Action Inbox;
- top-level workspace Work Items discovery;
- project work item lists;
- personal saved work views;
- reliable filtered URLs and copyable view links;
- CSV import/export;
- planning, delivery health, milestones, boards, dependencies, comments, mentions, watchers, and activity;
- local-first Postgres setup with transport-neutral API handlers;
- static Angular frontend suitable for eventual S3 hosting.

The remaining gap is that saved views are still personal. A maintainer can create a useful query, copy the URL, and send it to someone, but there is no durable team-facing view library. This limits adoption because teams often align around shared lenses, not just individual filters.

The v0.1.2 query-contract work makes this a good moment to add shared views. The app now has the canonical query behavior needed for team views to be reliable rather than another serialization path.

## Problem

Personal saved views solve individual recall, but they do not solve team alignment.

Current friction:

- recurring team filters have to be recreated by each person;
- copied links are useful but transient and hard to rediscover;
- project owners cannot publish common lenses for contributors;
- saved views do not distinguish personal views from workspace-endorsed views;
- there is no lightweight governance around who can create, update, or remove shared views;
- reference-app extraction notes do not yet cover saved query artifacts with visibility and permission rules.

For project management software, this matters because the team often needs shared definitions of "the work we are reviewing" or "the queue we use every morning." If every actor creates their own version, small differences in filters can erode trust.

## Goals

- Add workspace-shared saved work views.
- Preserve existing personal saved view behavior.
- Let owners and maintainers create, update, rename, and delete shared views.
- Let contributors open shared views without requiring management permissions.
- Clearly separate personal and shared views in the UI.
- Store shared views using the same normalized `WorkItemQuery` contract as personal views.
- Keep shared views URL-backed, reloadable, copyable, and export-consistent through the v0.1.2 query model.
- Add tests for visibility, permissions, query normalization, UI grouping, and core saved-view workflows.
- Update docs, release notes, and extraction notes around shared query artifacts.

## Non-Goals

- Do not add production authentication.
- Do not add invitations, multi-workspace switching, custom roles, or project-specific membership.
- Do not add team comments, discussions, or approval flows on saved views.
- Do not add pinning, ordering, folders, icons, colors, or rich saved-view metadata unless implementation proves trivial.
- Do not add a public URL shortener or native share sheet.
- Do not add advanced query-builder UI.
- Do not add server-side pagination or full-text search.
- Do not extract a generic `jawstack` saved-view framework.
- Do not add saved views to project-scoped work item lists unless it is clearly small after the technical design.

## Target Users

### Workspace Owner

Wants to publish common operating views for the workspace and keep stale shared views under control.

### Project Maintainer

Wants to create shared lenses for planning, triage, release follow-up, dependency risk, and unassigned work.

### Contributor

Wants to open team-endorsed views without understanding every filter or recreating saved views manually.

### Reference-App Developer

Wants a concrete example of saved query artifacts with visibility, ownership, permissions, and normalized query state.

## Product Principles

- **Shared views are team contracts:** a shared view should represent a common operational lens, not just a personal convenience.
- **Personal views stay personal:** existing user-owned saved views should continue to work without permission surprises.
- **Query reliability carries forward:** shared views must use the same canonical query behavior as v0.1.2.
- **Permissions should be simple and visible:** owners and maintainers manage shared views; contributors consume them.
- **Defaults stay quiet:** shared-view summaries should not count default query noise.
- **Avoid view management bloat:** the first shared-view UI should be practical, compact, and easy to test.

## Scope

### 1. Shared Saved View Data Model

Extend saved work views to support visibility.

Requirements:

- Support at least:
  - `personal`;
  - `workspace`.
- Preserve existing personal saved views.
- Record the owner/creator for all saved views.
- Enforce unique names predictably:
  - personal names should be unique per owner/workspace/visibility;
  - workspace-shared names should be unique per workspace/visibility.
- Keep query data normalized through the existing server-side `WorkItemQuery` normalization path.
- Add a migration and update deterministic seed data with representative shared views.

Acceptance criteria:

- Existing personal saved views survive migration.
- Shared saved views can be listed and opened by active members.
- Name conflicts return clear structured errors.

### 2. Saved View API Behavior

Update saved view API behavior for shared visibility and permissions.

Requirements:

- List endpoint returns:
  - current actor's personal saved views;
  - workspace-shared saved views.
- Create endpoint accepts visibility where allowed.
- Update endpoint allows:
  - personal view owner to update their own personal views;
  - owners/maintainers to update workspace-shared views.
- Delete endpoint allows:
  - personal view owner to delete their own personal views;
  - owners/maintainers to delete workspace-shared views.
- Contributors must not create, update, or delete workspace-shared views.
- Inactive members must not manage saved views.
- Keep API responses compatible enough for existing clients where possible.

Acceptance criteria:

- Contributors can open shared views but cannot mutate them.
- Owners and maintainers can manage shared views.
- Cross-actor personal view isolation remains intact.
- API tests cover visibility and permission boundaries.

### 3. Workspace Work Items UI

Update the workspace Work Items saved-view UI to show personal and shared views clearly.

Requirements:

- Group or label saved views by visibility:
  - personal views;
  - shared workspace views.
- Keep the UI compact and compatible with the existing saved-view toolbar.
- Allow users to save a personal view as they do today.
- Allow owners and maintainers to create workspace-shared views.
- Hide or disable shared-view management controls for contributors with clear copy.
- Let every active member open workspace-shared views.
- Preserve copy-link, active chips, reload, and export behavior after opening a shared view.

Acceptance criteria:

- A contributor sees shared views and can open them.
- A contributor does not see misleading controls for managing shared views.
- An owner or maintainer can create, rename, update-query, and delete a shared view.
- Personal saved-view workflows still pass.

### 4. Seeded Team Operating Views

Add deterministic shared views that demonstrate the feature.

Candidate seeded shared views:

- `Blocked work`;
- `Dependency risks`;
- `Due soon`;
- `Unassigned open work`;
- `Ready for pickup`.

Requirements:

- Seed views should use meaningful canonical `WorkItemQuery` values.
- Seed views should be visible to all active actors.
- Seed views should be useful in the demo walkthrough and Playwright smoke.

Acceptance criteria:

- Seeded shared views appear in workspace Work Items.
- Opening seeded views produces matching active chips and result sets.

### 5. Activity And Audit Signal

Add lightweight activity coverage for shared-view management if it fits existing patterns.

Requirements:

- Prefer workspace activity events for shared-view create, rename, update-query, and delete.
- Do not add activity events for personal saved-view changes unless there is already a clear product reason.
- Keep event summaries concise.

Acceptance criteria:

- Workspace activity can show shared-view management by owners/maintainers.
- Activity does not become noisy for ordinary personal view usage.

### 6. Tests And Smoke Coverage

Add focused coverage across backend, frontend, and E2E.

Requirements:

- API tests for:
  - list visibility;
  - personal isolation;
  - workspace-shared creation/update/delete;
  - contributor forbidden mutations;
  - unique name conflicts;
  - normalized query persistence.
- Frontend tests for:
  - personal/shared grouping;
  - permission-sensitive controls;
  - opening shared views through canonical params;
  - preserving existing personal saved-view workflows.
- Add a low-cost Playwright smoke if practical:
  - open workspace Work Items;
  - open a seeded shared view;
  - confirm active chips and results;
  - switch actor to contributor;
  - confirm shared view remains openable but management is unavailable.

Acceptance criteria:

- Existing saved-view behavior remains covered.
- Shared-view permissions are tested at the API and UI boundary.
- E2E smoke covers at least one user-visible shared-view path or the gap is documented.

### 7. Documentation And Extraction Notes

Document the feature and extraction signal.

Requirements:

- Update README with:
  - personal versus shared saved views;
  - permissions;
  - relationship to filtered URLs and export.
- Update the public site if the feature is product-facing enough to mention.
- Add v0.1.3 release notes.
- Add v0.1.3 jawstack extraction notes around saved query artifacts.
- Preserve v0.1.2 query-contract notes as source material.

Acceptance criteria:

- Documentation explains who can create shared views and who can open them.
- Extraction notes distinguish app-local implementation from future framework ideas.

## UX Requirements

- Shared views must be visibly distinct from personal views.
- Users should not need to understand query parameters to use a shared view.
- Shared-view management controls should not crowd the primary filter workflow.
- Permission limits should be clear without creating modal-heavy flows.
- Copy-link and export affordances should still communicate applied-query behavior.
- Mobile layout should remain usable.

## Technical Requirements

- Use the existing `SavedWorkViewDto` family where reasonable, extending contracts without breaking current consumers unnecessarily.
- Keep saved-view query persistence backed by normalized `WorkItemQuery`.
- Keep endpoint handlers transport-neutral.
- Add a migration through the existing Drizzle flow.
- Preserve local seed determinism.
- Keep tests focused on permission and query-state contracts.
- Avoid new frontend dependencies.
- Avoid new infrastructure dependencies.

## Metrics And Validation

The sprint is successful if:

- owners/maintainers can create and manage workspace-shared views;
- contributors can open shared views but cannot manage them;
- existing personal saved views continue to work;
- shared views reopen through canonical filtered URLs;
- exports from shared views match the applied filter chips;
- tests cover permission boundaries and query normalization;
- the Playwright smoke includes or documents a shared-view user path.

## Risks

- **Permission ambiguity:** shared view ownership and workspace management rights can be confusing if not modeled simply.
- **UI crowding:** saved-view controls may become too busy if personal and shared management are mixed without grouping.
- **Migration compatibility:** existing personal saved views must be preserved exactly.
- **Activity noise:** logging every personal view change could clutter workspace activity.
- **Scope creep:** pinning, ordering, folders, rich labels, and project-scoped saved views are attractive but should not expand this sprint unless trivial.

## Open Decisions

- Should shared view visibility be named `workspace`, `shared`, or `team` in the API contract?
- Should shared views have an explicit owner after creation, or should they be treated as workspace-owned after publish?
- Should maintainers manage all workspace-shared views, or only views they created?
- Should project-scoped saved views be deferred fully, or included if the shared-view model makes them cheap?
- Should shared-view create/update/delete emit workspace activity in v0.1.3?

## Recommended Decisions

- Use `workspace` as the visibility value because it maps to the current product boundary.
- Keep `owner` on shared views for audit/display, but authorize shared-view management by current role, not only creator.
- Allow owners and maintainers to manage all workspace-shared views.
- Defer project-scoped saved views.
- Add workspace activity only for shared-view create, rename, update-query, and delete.

## Expected Deliverables

- `docs/v0.1.3/prd.md`
- `docs/v0.1.3/technical-design.md`
- `docs/v0.1.3/implementation-plan.md`
- Shared saved-view contract/API/schema updates
- Workspace Work Items saved-view UI updates
- Seeded shared operating views
- Focused backend/frontend tests
- Optional Playwright smoke for shared views
- README/site updates as appropriate
- `docs/v0.1.3/release-notes.md`
- `docs/v0.1.3/jawstack-extraction-notes.md`
