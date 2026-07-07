# Worktrail v0.1.5 PRD

## Summary

Worktrail v0.1.5 should make saved operating views faster to use.

v0.1.2 made filtered work views reliable. v0.1.3 made workspace saved views collaborative. v0.1.4 brought saved views into project workspaces. The next gap is discoverability and daily adoption: saved views work, but the most important views still live inside a management surface. A team member must open the saved-view manager, scan a list, and then open the view.

The product theme is Pinned Operating Views. The release should let users and teams promote important workspace and project saved views into a compact, always-visible shortcuts surface on the relevant Work Items page. The intent is not to build a full saved-view organization system. It is to make the views that already matter feel like first-class operating lenses.

This sprint should stay focused. It should improve utility and adoption of the v0.1.3/v0.1.4 saved-view model while adding another useful signal for future pattern extraction around promoted query artifacts.

## Context

Worktrail now supports:

- canonical workspace and project work-item query state;
- shareable and reloadable filtered URLs;
- active filter chips backed by applied query state;
- personal and shared workspace saved views;
- personal and shared project saved views;
- owner/maintainer management of shared views;
- contributor read access to shared views;
- archived-project read-only saved-view behavior;
- copy-link and CSV export alignment with applied query state;
- deterministic seeded workspace and project operating views.

The feature is credible, but the interaction model is still management-heavy. Saved views are useful enough to create and share, but not prominent enough to become a daily starting point. Common operating views such as `Dependency risks`, `Ready for pickup`, `Release blockers`, and `Ready for QA` should be one click away.

## Problem

Saved views are durable but not yet operationally prominent.

Current friction:

- important shared views are hidden behind `Manage saved views`;
- the Work Items pages do not expose a small set of recommended operating lenses;
- users must remember which saved views exist before they can use them;
- new contributors can miss the team's intended triage views;
- owners and maintainers can create shared views but cannot mark which ones should be used most often;
- saved-view lists are alphabetical, which is stable but not always operationally meaningful;
- the query-artifact pattern has not yet tested promoted or default artifact behavior.

For project management software, this matters because teams often operate from a small number of recurring lenses. The app should make those lenses visible without turning saved views into a large administrative subsystem.

## Goals

- Add pinned saved views for workspace and project scopes.
- Show pinned saved views as compact shortcuts on the relevant Work Items page.
- Support pinned personal views for the current actor.
- Support pinned shared workspace views and pinned shared project views.
- Let owners and maintainers pin or unpin shared views.
- Let personal view owners pin or unpin their own personal views.
- Keep contributors read-only for shared pinned state while preserving their ability to open pinned shared views.
- Preserve existing saved-view create, open, rename, update-query, and delete behavior.
- Keep pinned saved views backed by canonical saved-view queries and route projection.
- Add deterministic pinned seed views that demonstrate useful workspace and project operating lenses.
- Add tests for pin visibility, permissions, ordering, URL behavior, and archived-project behavior.
- Update release docs and extraction notes around promoted saved query artifacts.

## Non-Goals

- Do not add saved-view folders.
- Do not add icons, colors, descriptions, or rich metadata.
- Do not add custom permissions.
- Do not add ownership transfer.
- Do not add comments, approval flows, or change requests for saved views.
- Do not add saved-view analytics or usage tracking.
- Do not add short links or native share sheets.
- Do not extract a generic saved-view framework.
- Do not add saved views to boards, planning tabs, My Work, or Inbox in this sprint.
- Do not add project-specific membership.
- Do not add advanced query-builder UI.
- Do not redesign the Work Items pages.

## Target Users

### Contributor

Wants to open the team's most important workspace or project views without learning the saved-view manager first.

### Project Maintainer

Wants to promote the project lenses the team should use during triage, release review, QA handoff, or dependency follow-up.

### Workspace Owner

Wants shared workspace views such as dependency risks, due soon work, and ready-for-pickup queues to be immediately visible.

### Individual Power User

Wants to pin personal views that support repeated individual workflows.

### Reference-App Developer

Wants evidence about whether saved query artifacts need a promoted/default state before any pattern extraction.

## Product Principles

- **Pinned views are shortcuts, not folders:** keep the model simple and visible.
- **Prominence follows scope:** workspace pinned views appear on workspace discovery; project pinned views appear on that project Work page.
- **Personal and shared both matter:** shared pins guide teams, personal pins support individual workflow.
- **Pinned state should be trustworthy:** opening a pin should use the same canonical URL path as opening any saved view.
- **Management should stay compact:** pinning should extend the saved-view manager without making the page feel administrative.
- **Read-only should still be useful:** contributors should see and open shared pins even when they cannot manage shared pinned state.

## Scope

### 1. Pinned Saved View Model

Add a minimal pinned state to saved work views.

Requirements:

- Add `isPinned` to saved work views.
- Persist pinned state for both scopes:
  - workspace;
  - project.
- Persist pinned state for both visibility modes:
  - personal;
  - shared.
- Default existing and newly created saved views to unpinned unless seed data or user action pins them.
- Preserve existing saved-view scope, visibility, ownership, and query behavior.
- Preserve existing uniqueness rules.

Acceptance criteria:

- Existing saved views migrate cleanly as unpinned.
- Saved-view list responses include pinned state.
- Pinned state never changes the saved query.
- Pinned state does not alter visibility or mutation permissions.

### 2. Pin And Unpin API Behavior

Support pinning through the existing saved-view update path unless the technical design finds a clearer low-risk command shape.

Requirements:

- Allow updating `isPinned` for saved views the actor can mutate.
- Personal saved views can only be pinned or unpinned by their owner.
- Shared workspace views can be pinned or unpinned by owners and maintainers.
- Shared project views can be pinned or unpinned by owners and maintainers when the project is active.
- Contributors cannot pin or unpin shared views.
- Archived project-scoped saved views can be opened but cannot have pinned state changed.
- Cross-actor personal saved views remain hidden.
- Clear structured errors should match existing saved-view error semantics.

Acceptance criteria:

- API tests cover personal pin/unpin.
- API tests cover shared workspace pin/unpin.
- API tests cover shared project pin/unpin.
- API tests cover contributor forbidden behavior for shared pin changes.
- API tests cover archived project pin changes being blocked.

### 3. Pinned Views UI

Show pinned views as one-click shortcuts on workspace and project Work Items pages.

Requirements:

- Render a compact pinned views section near saved views and filters on:
  - top-level Work Items;
  - project Work page.
- Show shared pinned views before personal pinned views.
- Keep unpinned views available in the existing saved-view manager.
- Let pinned shortcuts open the saved view through canonical route parameters.
- Show enough metadata to avoid ambiguity:
  - saved-view name;
  - shared/personal affordance;
  - compact applied-filter count.
- Keep the section compact when there are no pins.
- Avoid layout churn or oversized cards.
- Keep keyboard access for opening pinned views.

Acceptance criteria:

- A seeded pinned shared workspace view is visible and openable from top-level Work Items.
- A seeded pinned shared project view is visible and openable from the project Work page.
- A pinned personal view is visible only to its owner.
- Opening a pinned view updates URL params, active chips, visible rows, copy-link behavior, and CSV export behavior through the existing applied query path.

### 4. Saved View Manager Pin Controls

Add pin/unpin controls to the existing saved-view manager.

Requirements:

- Owners of personal views can pin or unpin personal views.
- Owners and maintainers can pin or unpin shared views.
- Contributors do not see shared pin mutation controls.
- Contributors can still open pinned and unpinned shared views.
- Archived project Work pages should show project saved views as read-only and should not expose pin mutation controls.
- Pin controls should use clear button labels or icon+text consistent with the existing manager.
- Pinning should update the visible pinned shortcuts without page reload.
- Unpinning should remove the shortcut without deleting the saved view.

Acceptance criteria:

- Pin/unpin controls are covered by component/page tests.
- Permission-specific UI states are covered for owner, maintainer, contributor, and archived project.
- Pin/unpin errors surface inline consistently with other saved-view mutation errors.

### 5. Ordering Policy

Keep ordering deliberately simple for v0.1.5.

Requirements:

- Do not add manual drag/drop or custom sort order.
- Sort pinned shared views alphabetically by name.
- Sort pinned personal views alphabetically by name.
- Render shared pins before personal pins.
- Keep the saved-view manager sorted as it is today unless implementation finds a low-risk shared helper cleanup.

Acceptance criteria:

- Ordering is deterministic in tests.
- There is no new persisted position field in v0.1.5 unless the technical design identifies a compelling reason.

### 6. Seeded Pinned Views

Update deterministic seed data to demonstrate pinned operating lenses.

Candidate pinned shared workspace views:

- `Dependency risks`;
- `Ready for pickup`.

Candidate pinned shared project views:

- `Ready for QA`;
- `Release blockers`.

Requirements:

- Seed at least one pinned shared workspace view.
- Seed at least one pinned shared project view for Worktrail App.
- Ensure pinned views produce useful visible result sets.
- Preserve deterministic seed behavior on repeated `db:seed` runs.

Acceptance criteria:

- Seeded pinned views appear after `db:reset`, `db:migrate`, and `db:seed`.
- Seeded pinned views are stable Playwright anchors.

### 7. Activity And Audit Signal

Add activity for shared saved-view pin changes if it fits the existing activity model without disproportionate work.

Requirements:

- Record workspace activity when a shared workspace saved view is pinned or unpinned.
- Record project activity when a shared project saved view is pinned or unpinned.
- Do not emit activity for personal saved-view pin changes.
- Keep activity summaries compact.

Acceptance criteria:

- Shared pin/unpin activity is visible in the appropriate settings/activity surface if implemented.
- If deferred during technical design, the PRD should explicitly note why.

### 8. Documentation And Extraction Notes

Update sprint docs and product docs.

Requirements:

- Add technical design and implementation plan after PRD approval.
- Add v0.1.5 release notes during finalization.
- Add v0.1.5 pattern extraction notes during finalization.
- Update README and public site if pinned views are polished enough to mention publicly.
- Preserve v0.1.2, v0.1.3, and v0.1.4 query-artifact notes as source material.

Acceptance criteria:

- Documentation clearly distinguishes pinned shortcuts from saved-view management.
- Extraction notes capture promoted query artifacts without claiming a framework abstraction is ready.

## User Stories

### Workspace Shared Pin

As an owner, I want to pin a shared workspace view so the team can open it from the Work Items page without expanding the manager.

Acceptance criteria:

- Owner opens top-level Work Items.
- Owner pins `Dependency risks`.
- `Dependency risks` appears in pinned shortcuts.
- Contributor opens top-level Work Items and sees the pinned `Dependency risks` shortcut.
- Contributor opens it and sees matching URL params, chips, and rows.
- Contributor cannot unpin it.

### Project Shared Pin

As a maintainer, I want to pin `Ready for QA` on the project Work page so contributors can quickly open the QA handoff queue.

Acceptance criteria:

- Maintainer opens Worktrail App project Work page.
- Maintainer pins `Ready for QA`.
- `Ready for QA` appears in pinned shortcuts.
- Contributor opens Worktrail App project Work page and sees the pinned shortcut.
- Contributor opens it and sees matching URL params, chips, and rows.
- Contributor cannot unpin it.

### Personal Pin

As a contributor, I want to pin my personal project view so I can quickly reopen my project workflow.

Acceptance criteria:

- Contributor saves or opens a personal project view.
- Contributor pins the personal project view.
- The pinned shortcut appears for that contributor.
- Another actor does not see the contributor's personal pin.

### Archived Project Read-Only Pin Behavior

As a contributor or maintainer, I want archived project saved views to remain openable but not editable.

Acceptance criteria:

- Archived project Work page shows existing saved views and pinned shortcuts where applicable.
- Shared pinned project views can be opened.
- Pin/unpin controls are not available.
- API rejects archived project pin mutations.

## UX Requirements

- Pinned shortcuts should be visible without opening `Manage saved views`.
- Pinned shortcuts should be compact enough to sit near filters without dominating the page.
- Buttons or links must have clear accessible names.
- Shared versus personal status should be clear without noisy explanation.
- Empty pinned state should not add a large blank component.
- Pin/unpin controls should not cause row height jumps or page layout shifts.
- The UI should remain usable on common desktop widths and narrow mobile widths.

## Technical Requirements

- Extend shared contracts with pinned state.
- Add database migration for pinned state.
- Keep API handlers transport-neutral.
- Keep saved-view update semantics backward-compatible.
- Preserve existing saved-view scope and visibility compatibility.
- Preserve existing OpenAPI coverage and update it for pinned state.
- Keep query open behavior routed through canonical URL params.
- Add focused unit/API/web tests and Playwright smoke coverage.
- Keep generated artifacts out of version control.

## Data Requirements

Saved view data should include:

- `isPinned: boolean`.

No other saved-view metadata is required for v0.1.5.

Do not add:

- `position`;
- `icon`;
- `color`;
- `description`;
- `folderId`;
- `lastOpenedAt`;
- `usageCount`.

## Security And Permissions

- Existing local actor model remains unchanged.
- Personal saved views remain hidden from other actors.
- Shared saved views remain visible to active members.
- Shared saved-view pin changes require owner or maintainer role.
- Project archived state blocks project-scoped pin mutations.
- API enforcement is required; UI hiding alone is insufficient.

## Analytics And Observability

No analytics are required.

Activity events for shared pin changes are in scope only if they fit the existing workspace/project activity pattern cleanly.

## Accessibility

- Pinned shortcuts must be keyboard reachable.
- Pin/unpin controls must have accessible names.
- Visual state must not be color-only.
- Focus order should remain predictable around saved views and filters.

## Performance

- Pinned views should come from the existing saved-view list response.
- Do not add extra API calls just to render pinned shortcuts.
- Keep list rendering small and deterministic.
- Do not introduce polling or background refresh.

## Rollout

- Existing saved views migrate to `isPinned=false`.
- Seed data pins selected shared views.
- No feature flag is required.
- Existing workspace and project saved-view behavior must remain compatible.

## Success Criteria

- A user can open important workspace/project saved views without expanding the manager.
- Owners and maintainers can promote shared operating lenses.
- Contributors can see and open shared pins without shared mutation controls.
- Personal pins are actor-private.
- URL state, active chips, copy links, detail return URLs, and CSV export remain aligned after opening pins.
- Full local verification passes.

## Risks

- Adding pin controls may crowd the saved-view manager.
- A pinned section may compete with filters if it is too visually heavy.
- Pinning could be confused with manual ordering if ordering rules are not explicit.
- Shared pin changes might need activity events to avoid audit gaps.
- If implemented too generically, the work could drift toward a premature saved-view framework.

## Open Decisions

1. Should pin/unpin use the existing `PATCH /api/saved-work-views/:id` endpoint or dedicated command endpoints?
2. Should shared pin/unpin emit activity in v0.1.5, or should activity be deferred until richer saved-view audit needs appear?
3. Should the pinned shortcuts live inside the saved-view toolbar or as a sibling component owned by the page?
4. Should pinned personal and pinned shared views be visually separated, or grouped in one shortcut row with small badges?
5. Should newly created saved views stay unpinned by default, or should the create flow offer a "Save and pin" affordance?

## Recommendation

Proceed with pinned operating views as the v0.1.5 scope.

Resolve open decisions conservatively in technical design:

- Prefer the existing update endpoint if it stays clear and testable.
- Add shared pin/unpin activity only if it follows the current shared saved-view activity pattern with low complexity.
- Prefer a small reusable pinned-shortcuts component only if it keeps page code simpler.
- Keep newly created views unpinned by default for v0.1.5; pinning should be an explicit management action.
