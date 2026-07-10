# Worktrail v0.2.2 PRD

## Summary

Worktrail v0.2.2 should make saved views faster, clearer, and less intrusive.

Saved views are one of Worktrail's most important operating patterns. They let a user or team turn a reliable filtered Work list into a reusable lens. Over several releases, saved views gained personal/shared visibility, workspace and project scope, pinned shortcuts, canonical URLs, query summaries, and role-aware management controls.

The feature works, but the management surface now competes with the reason users opened the page: seeing filtered work items. The current `Manage views` section can consume the full visible height of the page, especially for owners and maintainers who can rename, update, pin, and delete shared views. Opening a view updates the result list below the fold, but the user may not see an obvious confirmation that anything happened.

The product theme is Saved View Ergonomics. v0.2.2 should separate common use from uncommon administration:

- opening a saved view should be compact and obvious;
- managing a saved view should happen only after the user selects the view to manage;
- applying a saved view should produce clear feedback;
- the work item list should remain the dominant surface.

If the sprint can fit adjacent polish, it should reinforce this theme rather than introduce a separate feature area.

## Context

Worktrail currently supports:

- canonical workspace and project work item query state;
- reloadable and copyable filtered URLs;
- active filter chips tied to applied query state;
- personal saved views;
- workspace-shared saved views;
- project-scoped personal and shared saved views;
- pinned saved-view shortcuts on workspace and project Work pages;
- owner/maintainer management of shared views;
- contributor read access to shared views;
- archived-project read-only saved-view behavior;
- cycle filters, dependency filters, milestone filters, risk filters, and CSV export through the same query contract.

The current saved-view toolbar renders:

- a compact heading with counts;
- a `Save view` disclosure;
- a `Manage views` disclosure;
- when expanded, one row for every shared view and one row for every personal view;
- for mutable rows, an always-visible rename input plus `Open`, `Rename`, `Update query`, `Pin`/`Unpin`, and `Delete`.

This made sense when saved views were simple and few. It now creates an ergonomics mismatch because the most common action, `Open`, receives less visual priority than the less common rename/update/delete controls.

## Problem

Saved view management takes too much attention and page space.

Current friction:

- opening `Manage views` can push the work item list entirely below the fold;
- opening a view from the manager may update results off-screen with no visible confirmation near the user's focus;
- every mutable view shows a rename input even when the user only wants to open one view;
- every mutable view shows administrative actions, even for views the user is not currently interested in;
- shared and personal views are separated into full row lists, which is useful for management but heavy for opening;
- pinned shortcuts help with promoted views, but unpinned saved views still require the oversized manager;
- new users may not understand that saved-view `Open` projects a query into the Work list below;
- owners and maintainers see the heaviest UI because they have the most permissions, even though they still mostly need to open views.

For a project management app, this matters because Work pages should prioritize scanning and acting on work. Saved views should accelerate that workflow, not obscure it.

For Worktrail as a reference app, this is also a useful product-quality checkpoint. The system has accumulated capability; v0.2.2 should show how mature software separates daily actions from administrative controls.

## Goals

- Make saved-view opening compact and primary.
- Keep the work item list visible sooner on common desktop and laptop screens.
- Replace always-visible per-row edit controls with a selected-view management flow.
- Preserve all existing saved-view capabilities:
  - create personal views;
  - create shared views when permitted;
  - open saved views;
  - rename mutable views;
  - update query for mutable views;
  - pin and unpin mutable views;
  - delete mutable views;
  - read shared views as a contributor;
  - open archived-project saved views read-only.
- Provide clear feedback when a saved view is opened.
- Preserve canonical URL, active chip, saved-view, pinned-view, copy-link, return URL, and CSV export semantics.
- Improve keyboard and screen-reader clarity for opening and managing saved views.
- Cover the revised saved-view UX through component tests and existing page tests.
- Update documentation and pattern notes if the implementation reveals a reusable pattern.

## Non-Goals

- Do not change the saved-view persistence model unless technical design finds an unavoidable reason.
- Do not add saved-view folders.
- Do not add saved-view icons, colors, descriptions, tags, or ownership transfer.
- Do not add saved-view analytics or last-opened tracking.
- Do not add custom saved-view permissions.
- Do not add short links or native share sheets.
- Do not add saved views to My Work, Inbox, Board, Planning, or Reports.
- Do not redesign the whole Work Items page.
- Do not replace pinned saved views.
- Do not add a query-builder language or advanced filter editor.
- Do not introduce a modal-heavy management model unless the technical design proves it is the least disruptive option.
- Do not add production authentication or deployment automation.

## Target Users

### Contributor

Needs to open shared team views quickly and understand that results changed, without seeing controls they cannot use.

### Project Maintainer

Uses shared project views for repeated triage workflows. Needs opening to be fast, while still being able to update, rename, pin, or delete a selected view when maintaining the team's operating lenses.

### Workspace Owner

Maintains shared workspace views and wants contributors to discover them without turning the Work Items page into an administration page.

### Individual Power User

Uses personal saved views and pinned views for recurring personal workflows. Needs a compact way to open any saved view, plus a clear path to manage one selected personal view.

### Reference-App Developer

Needs evidence for a reusable pattern around daily-use actions versus management actions for query-backed artifacts.

## Product Principles

- **Open is primary:** saved views are operating lenses first and records to administer second.
- **Manage one thing at a time:** mutation controls should appear for the selected view, not every view.
- **The list is the point:** saved-view controls should not regularly hide the work results.
- **Feedback should be local:** after opening a view, the user should see a nearby confirmation or active-view state.
- **Keep query contracts intact:** ergonomics can change without changing the saved query semantics.
- **Permissions should simplify UI:** contributors should see a lean open/read experience, not disabled management clutter.
- **Compact does not mean hidden:** users still need an obvious path to save and manage views.

## Scope

### 1. Compact Saved View Opening

Replace the expanded all-rows manager as the primary open path with a compact open control.

Requirements:

- Provide a compact way to open any available saved view from the saved-view toolbar.
- The control should include both shared and personal views.
- The control should distinguish shared and personal views clearly.
- The control should expose enough query summary information to avoid ambiguous names where practical.
- Opening a view should remain a one-step or low-friction action.
- Pinned shortcuts should remain visible and openable as they are today.
- Empty states should remain compact and clear.
- Loading and load-error states should remain understandable.

Possible implementation shapes for technical design:

- a select/menu grouped by shared and personal views with an adjacent `Open` button;
- a compact command-style list inside a disclosure;
- a segmented group for shared/personal plus a select;
- another similarly compact pattern that keeps opening distinct from administration.

Acceptance criteria:

- A user can open a shared saved view without expanding a large management list.
- A user can open a personal saved view without seeing rename inputs for every personal view.
- The saved-view toolbar consumes materially less vertical space than the current expanded manager on desktop.
- Pinned saved views continue to open through their existing shortcuts.
- Saved view opening still updates canonical URL parameters and active filter chips.

### 2. Selected View Management

Move rename, update query, pin/unpin, and delete controls into a selected-view management surface.

Requirements:

- Provide a `Manage views` path that lets the user select one saved view to manage.
- Show mutation controls only for the selected view.
- Show read-only details for views the user can open but cannot mutate.
- Preserve shared and personal permission boundaries.
- Preserve archived-project read-only behavior.
- Keep destructive actions visually distinct.
- Keep rename input scoped to the selected view.
- Avoid rendering rename inputs for every view.
- Make it clear when no view is selected.

Acceptance criteria:

- Owners and maintainers can rename, update query, pin/unpin, and delete a selected shared view.
- Owners, maintainers, and contributors can manage their own personal views where current policy allows.
- Contributors can inspect/open shared views but do not see shared mutation controls.
- Archived project saved views remain openable but mutation controls are unavailable.
- Management controls do not dominate the Work page before a specific view is selected.

### 3. Open Feedback And Result Orientation

Make saved-view application visible.

Requirements:

- After opening a saved view, show a clear nearby indication of which saved view was opened.
- The indication should distinguish view application from pending filter edits.
- If the saved-view controls remain expanded after open, the user should still understand that the list below changed.
- Consider moving focus or providing an accessible live announcement when a saved view opens.
- Avoid surprising page jumps unless user testing or technical design supports a controlled scroll-to-results behavior.
- Preserve existing active filter chips as the source of applied query truth.

Possible feedback patterns:

- compact `Viewing: <saved view name>` status near saved-view controls;
- temporary success message such as `Opened "Release blockers"`;
- focus management to the work result heading;
- a subtle result-count announcement after navigation completes.

Acceptance criteria:

- Opening a saved view from the compact opener produces visible feedback near the saved-view area.
- Screen-reader users receive an appropriate state change or announcement.
- Active filter chips and result rows still reflect the opened query after reload.
- The experience does not depend on animation to communicate success.

### 4. Save View Polish

Keep save behavior compact and aligned with the new saved-view ergonomics.

Requirements:

- Preserve the ability to save the current applied query as a personal view.
- Preserve shared saved-view creation for owners and maintainers.
- Keep save controls secondary to opening existing views.
- Avoid expanding save controls in a way that competes with work results.
- Keep existing duplicate-name and permission error behavior.

Acceptance criteria:

- A user can save the current applied query without disrupting the open/manage flow.
- Owners and maintainers can still save shared views.
- Contributors do not see shared save controls.

### 5. Workspace And Project Parity

Apply the ergonomic model consistently.

Requirements:

- Update top-level Workspace Work Items saved views.
- Update Project Work saved views.
- Preserve differences in helper text, section names, permissions, and archived-project behavior.
- Ensure cycle, milestone, dependency, risk, and due-date saved views remain openable and summarized correctly.

Acceptance criteria:

- Workspace Work Items and Project Work expose the same ergonomic saved-view pattern.
- Existing seeded workspace shared views remain openable.
- Existing seeded project shared views remain openable.
- Existing seeded pinned views remain visible.
- Existing cycle-filtered saved views remain openable and summarized.

### 6. Optional Adjacent Polish: Active View Awareness

If implementation time permits, add an active-view awareness pattern that reinforces saved-view opening.

Requirements:

- Show the name of the most recently opened saved view while its query is applied.
- If the user changes filters after opening a saved view, avoid falsely implying the saved view record itself has changed.
- If feasible, distinguish:
  - opened saved view;
  - current applied query;
  - unsaved changes from the opened saved view.
- Keep this as UI state only unless technical design identifies a low-risk persisted need.

Acceptance criteria:

- Opening a saved view displays a clear active-view label.
- Changing filters after opening a saved view does not mutate the saved view unless the user explicitly updates query.
- If unsaved-change detection is included, it behaves consistently for workspace and project scopes.

This section is optional. It should be included only if it fits after the primary open/manage refactor.

## UX Requirements

- The saved-view toolbar should remain compact with many saved views.
- On common laptop viewports, opening saved-view controls should not routinely consume the entire visible height.
- Text must wrap cleanly for long saved-view names and query summaries.
- Button labels should fit on mobile and desktop.
- Keyboard users must be able to:
  - open the saved-view chooser;
  - select a saved view;
  - open it;
  - select a view to manage;
  - perform permitted management actions.
- Screen-reader labels should make scope and visibility clear.
- Destructive actions should remain visually separated and should not be adjacent to the primary open action unless the technical design includes safeguards.

## Permissions And Lifecycle

Current saved-view permissions should remain intact:

- personal views are visible and mutable only to the owner;
- workspace-shared views are visible to active members;
- project-shared views are visible in their project context;
- owners and maintainers can manage shared views;
- contributors can open shared views but cannot mutate them;
- archived project saved views remain openable but read-only;
- deleted or stale saved views should not corrupt local saved-view state.

The UI should use these permissions to reduce clutter rather than render controls the user cannot use.

## Data And API Considerations

v0.2.2 is expected to be mostly frontend and documentation work.

Expected data/API stance:

- no database migration;
- no saved-view contract change required for the primary scope;
- no route change;
- no OpenAPI change unless technical design introduces a new endpoint or response field;
- existing saved-view APIs should continue to serve as the source of truth.

Potential exception:

- If active-view awareness requires durable "last opened" or usage metadata, defer it rather than adding persistence in v0.2.2.

## Testing Requirements

Add or update tests for:

- compact saved-view opening with shared and personal views;
- selected-view management controls;
- owner/maintainer shared mutation controls;
- contributor read-only shared view experience;
- archived project read-only saved views;
- pinned shortcut preservation;
- visible feedback after opening a saved view;
- workspace and project saved-view parity;
- keyboard-accessible labels and roles where practical;
- existing saved-view query summaries, including cycle and dependency filters.

Browser smoke should cover at least one saved-view open path where the result list changes below the toolbar and the user receives visible feedback.

## Documentation Requirements

- Update README saved-view documentation to reflect the compact open/manage model.
- Update release notes during finalization.
- Add pattern notes if the implementation yields a reusable "daily action versus management action" pattern.
- Update public site only if the saved-view ergonomics change materially affects current product copy.

## Success Criteria

v0.2.2 should be considered successful when:

- opening saved views is visibly faster and requires less page space;
- users no longer see rename inputs for every saved view just to open one;
- owners and maintainers retain all existing management capabilities;
- contributors have a clear open/read experience;
- opening a saved view provides clear local feedback;
- filtered work results remain the dominant page purpose;
- workspace and project saved views behave consistently;
- full local verification passes.

## Risks And Mitigations

### Risk: Compact Controls Hide Useful Views

Mitigation: keep the opener explicit, grouped, searchable or scannable if the technical design supports it, and preserve pinned shortcuts for promoted views.

### Risk: Selected Management Adds Extra Clicks For Maintainers

Mitigation: optimize for the common open path while keeping management actions one selected view away. Management is lower frequency than opening.

### Risk: Active View Label Conflicts With Filter Chips

Mitigation: active filter chips remain the applied query truth. Any active-view label should say which view was opened, not claim the saved record still matches after filter edits.

### Risk: Refactor Breaks Saved-View Permissions

Mitigation: keep the existing saved-view store/API behavior and focus tests on permission-sensitive rendering and mutation events.

### Risk: UI Becomes Too Custom

Mitigation: use ordinary controls where possible: select/menu, buttons, details, focused panel. Avoid a complex command palette or modal framework unless clearly justified.

## Open Questions

- Should opening a saved view immediately collapse the saved-view controls, keep them open with confirmation, or move focus to results?
- Should the compact opener use a native select, a grouped menu/listbox, or another accessible pattern?
- Should the selected management surface live inline, in a compact disclosure, or in a lightweight dialog?
- Should active-view awareness include unsaved-change detection in v0.2.2, or should it stop at an "Opened view" confirmation?

## Recommendation

Proceed with Saved View Ergonomics as the v0.2.2 sprint.

The highest-value scope is:

1. compact open control for all available saved views;
2. selected-view management instead of per-row edit controls;
3. clear local feedback after opening a view;
4. workspace/project parity and tests.

Defer persistence changes, usage analytics, folders, custom metadata, and advanced active-view diffing. The sprint should improve daily usability without expanding the saved-view domain model.
