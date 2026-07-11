# Worktrail v0.2.2 Implementation Plan

## Purpose

This plan turns the v0.2.2 PRD and technical design into sequential implementation phases.

v0.2.2 should improve Saved View ergonomics on Workspace Work Items and Project Work pages. Saved views should become faster to open, clearer after application, and less visually dominant when users need to manage them.

The release should preserve:

- existing saved-view API contracts;
- existing saved-view persistence;
- existing workspace/project saved-view permissions;
- pinned saved-view shortcut behavior;
- canonical work item query semantics;
- active filter chips, copy links, return URLs, CSV export, and saved-view query summaries;
- local-first development and full verification.

## Design Decisions

Use these decisions while implementing v0.2.2:

- Keep v0.2.2 frontend-only unless implementation reveals a hard blocker.
- Do not add a database migration.
- Do not change saved-view API routes, DTOs, OpenAPI, or persistence.
- Keep `SavedViewsToolbarComponent` as the primary implementation boundary.
- Use a native grouped `<select>` plus `Open` button as the compact saved-view opener.
- Keep pinned saved-view shortcuts unchanged.
- Keep `Save view` as a secondary disclosure.
- Keep `Manage views` inline, but manage one selected saved view at a time.
- Do not use a modal/dialog for saved-view management in this release.
- Show local confirmation after opening a saved view: `Opened "<name>". Results updated below.`
- Use `aria-live="polite"` for open confirmation.
- Do not auto-scroll or auto-focus results after opening a saved view in v0.2.2.
- Do not add durable active-view state, last-opened metadata, usage analytics, or unsaved-change detection.
- Preserve existing parent page event contracts for open, rename, update query, pin/unpin, delete, and draft-name changes.
- Keep contributors' shared-view experience open/read-only and uncluttered.
- Keep archived project saved views openable but read-only.

## Phase Sizing

Each phase should leave the repository in a coherent working state.

Implementation phases:

1. baseline planning;
2. saved-view toolbar view model and compact opener;
3. selected-view management panel;
4. saved-view toolbar styling, responsive behavior, and accessibility pass;
5. parent page and page-spec alignment;
6. browser smoke updates;
7. README, release notes, pattern notes, and final verification.

Run focused web component tests after component phases, parent page tests after integration phases, and full verification during finalization.

## Phase 0: Baseline Planning

Goal: confirm v0.2.2 planning inputs and repository state before runtime changes.

Scope:

- Confirm `docs/v0.2.2/prd.md` exists.
- Confirm `docs/v0.2.2/technical-design.md` exists.
- Confirm `docs/v0.2.2/implementation-plan.md` exists.
- Confirm active branch and repository status.
- Confirm no unresolved technical choice blocks Phase 1.
- Confirm no runtime files have been changed for v0.2.2 yet.
- Confirm v0.2.2 does not require backend, contract, migration, or OpenAPI changes.

Out of scope:

- Runtime implementation.
- Saved-view component edits.
- Test changes.
- Documentation finalization.

Acceptance criteria:

- v0.2.2 planning inputs exist.
- Design decisions are recorded.
- Worktree/index state is understood before implementation starts.
- No open decision blocks Phase 1.
- The release remains scoped to saved-view ergonomics unless later implementation evidence requires otherwise.

Suggested commands:

```sh
find docs/v0.2.2 -maxdepth 1 -type f | sort
git status --short --branch
git diff --check
```

Status:

- Completed on 2026-07-10.
- Confirmed v0.2.2 planning inputs exist:
  - `docs/v0.2.2/prd.md`;
  - `docs/v0.2.2/technical-design.md`;
  - `docs/v0.2.2/implementation-plan.md`.
- Confirmed active branch is `v0.2.2`.
- Confirmed current change state:
  - `docs/v0.2.2/` is untracked and contains only v0.2.2 planning documents;
  - no runtime files have been changed for v0.2.2 yet.
- Confirmed implementation decisions:
  - keep v0.2.2 frontend-only unless implementation reveals a hard blocker;
  - no database migration;
  - no saved-view API, contract, persistence, or OpenAPI changes;
  - use `SavedViewsToolbarComponent` as the primary implementation boundary;
  - use a native grouped select plus `Open` button for compact saved-view opening;
  - keep selected saved-view management inline under `Manage views`;
  - show local `aria-live` confirmation after opening a saved view;
  - defer durable active-view state and unsaved-change detection.
- Confirmed the PRD open questions are resolved by the technical design.
- Verified:
  - `find docs/v0.2.2 -maxdepth 1 -type f | sort`;
  - `git status --short --branch`;
  - `git diff --check`;
  - `rg -n "No blocking technical questions|Do not change API|Do not add a database migration|frontend-only|Phase 0|Phase 1" docs/v0.2.2/*.md`.
- No unresolved technical choice blocks Phase 1.

## Phase 1: Saved-View Toolbar View Model And Compact Opener

Goal: add the compact saved-view opener while keeping existing management behavior temporarily available.

Scope:

- Update `apps/web/src/app/features/work-items/components/saved-views-toolbar.component.ts`.
- Add local option helpers for shared, personal, and combined saved-view options.
- Add component-local state:
  - selected open view id;
  - opened-view confirmation message.
- Add compact `Open saved view` control:
  - native `<select>`;
  - shared and personal `<optgroup>` sections;
  - placeholder option;
  - adjacent `Open` button.
- Emit existing `open` event when the selected view is opened.
- Show local confirmation after open with `aria-live="polite"`.
- Show selected saved-view summary near the opener.
- Preserve loading, load-error, empty-state, save-view, and existing manager behavior during this phase.
- Add focused component tests for:
  - open select groups;
  - disabled open state with no selection;
  - opening shared view;
  - opening personal view;
  - open confirmation message;
  - query summary display.

Out of scope:

- Removing old per-row manager controls.
- Parent page changes.
- E2E changes.

Acceptance criteria:

- Users can open shared and personal saved views from a compact control.
- Opening a saved view emits the same event as before.
- Opening a saved view shows local confirmation.
- Existing saved-view manager still works while Phase 2 has not replaced it.

Suggested commands:

```sh
npm test --workspace @worktrail/web -- --include 'src/app/features/work-items/components/saved-views-toolbar.component.spec.ts'
npm run typecheck --workspace @worktrail/web
git diff --check
```

Status:

- Completed on 2026-07-10.
- Added compact saved-view opening to `SavedViewsToolbarComponent`:
  - native saved-view select;
  - shared and personal option groups;
  - placeholder option;
  - adjacent disabled-until-selected `Open` action.
- Added component-local opener state:
  - selected open view id;
  - opened-view confirmation message.
- Added local option helpers for shared, personal, and combined saved-view options.
- Routed compact opener and existing row-level `Open` buttons through the same `openSavedView` path.
- Preserved existing save-view, loading, load-error, empty-state, helper, and row-manager behavior for Phase 2.
- Added focused component coverage for:
  - grouped compact open select options;
  - query summary display;
  - disabled open action with no selection;
  - opening shared saved views;
  - opening personal saved views;
  - `aria-live="polite"` open confirmation.
- Verified:
  - `npm test --workspace @worktrail/web -- --include 'src/app/features/work-items/components/saved-views-toolbar.component.spec.ts'`;
  - `npm run typecheck --workspace @worktrail/web`;
  - `git diff --check`.

## Phase 2: Selected-View Management Panel

Goal: replace all-row saved-view management with a selected-view management flow.

Scope:

- Replace the current `Manage views` row list in `SavedViewsToolbarComponent`.
- Add selected management view id state.
- Add a management select with shared and personal saved-view groups.
- Render one selected-view management panel at a time.
- In the selected panel, show:
  - saved-view name;
  - shared/personal visibility;
  - owner label when useful;
  - query summary;
  - pinned state;
  - updated timestamp if included cleanly.
- For mutable selected views, show:
  - scoped rename input;
  - `Rename`;
  - `Update query`;
  - `Pin`/`Unpin`;
  - `Delete`.
- For read-only selected views, show read-only helper copy and an `Open` action only.
- Preserve existing event outputs:
  - `draftNameChange`;
  - `rename`;
  - `updateQuery`;
  - `pinChange`;
  - `delete`;
  - `open`.
- Remove old always-visible per-row rename inputs.
- Remove or update component tests that depend on row-level controls.
- Add tests for:
  - selected view panel renders only after selection;
  - no rename inputs render for every saved view;
  - selected mutable shared view emits management actions;
  - selected mutable personal view emits management actions;
  - contributor shared view panel is read-only;
  - all-read-only state has no mutation controls;
  - personal management remains available when shared management is read-only.

Out of scope:

- Parent page behavior changes unless test failures reveal assumptions about old markup.
- Visual polish beyond usable scoped styles.

Acceptance criteria:

- `Manage views` no longer renders edit controls for every saved view.
- Management actions are scoped to a selected saved view.
- Existing saved-view mutation events still reach parent pages unchanged.
- Permission-sensitive rendering remains correct.

Suggested commands:

```sh
npm test --workspace @worktrail/web -- --include 'src/app/features/work-items/components/saved-views-toolbar.component.spec.ts'
npm run typecheck --workspace @worktrail/web
npm run lint --workspace @worktrail/web
git diff --check
```

Status:

- Completed on 2026-07-10.
- Replaced the old all-row `Manage views` list in `SavedViewsToolbarComponent` with a selected-view management flow.
- Added component-local selected management state and selected management option lookup.
- Added a management select with shared and personal saved-view option groups.
- Added a selected saved-view management panel showing:
  - saved-view name;
  - shared/personal visibility;
  - owner/readability metadata;
  - query summary;
  - pinned state;
  - updated date.
- Scoped mutation controls to only the selected saved view:
  - rename input;
  - `Rename`;
  - `Update query`;
  - `Pin`/`Unpin`;
  - `Delete`.
- Kept read-only selected views openable without disabled mutation button clutter.
- Preserved existing toolbar output events for open, rename, query update, pin change, delete, and draft-name changes.
- Removed row-oriented manager markup and styles from the component.
- Updated component tests around selected-view management behavior and permissions.
- Updated affected project work-items page tests that asserted old saved-view row markup.
- Verified:
  - `npm test --workspace @worktrail/web -- --include 'src/app/features/work-items/components/saved-views-toolbar.component.spec.ts'`;
  - `npm test --workspace @worktrail/web -- --include 'src/app/features/work-items/work-items-page.component.spec.ts'`;
  - `npm run typecheck --workspace @worktrail/web`;
  - `npm run lint --workspace @worktrail/web`;
  - `git diff --check`.

## Phase 3: Toolbar Styling, Responsive Behavior, And Accessibility Pass

Goal: make the refactored toolbar compact, responsive, and accessible.

Scope:

- Update scoped CSS in `SavedViewsToolbarComponent`.
- Replace row-oriented classes with opener and selected-management classes.
- Ensure desktop layout remains compact:
  - heading;
  - opener row;
  - selected summary/confirmation;
  - collapsed save/manage disclosures.
- Ensure mobile layout stacks cleanly without overflowing text or buttons.
- Ensure long saved-view names and summaries wrap cleanly.
- Keep delete/destructive action visually separated from primary open action.
- Confirm labels and button names are clear for keyboard and screen-reader users.
- Ensure open confirmation uses `aria-live="polite"`.
- Add/adjust component tests for accessible labels where practical.

Out of scope:

- Redesigning the whole Work Items page.
- New iconography or custom menu/listbox behavior.

Acceptance criteria:

- Saved-view toolbar is materially more compact than the old expanded all-row manager.
- Text and controls do not overlap on mobile or desktop.
- Keyboard users can select, open, select-to-manage, and trigger permitted management actions.
- Destructive actions remain visually distinct.

Suggested commands:

```sh
npm test --workspace @worktrail/web -- --include 'src/app/features/work-items/components/saved-views-toolbar.component.spec.ts'
npm run typecheck --workspace @worktrail/web
npm run lint --workspace @worktrail/web
git diff --check
```

Status:

- Completed on 2026-07-10.
- Tightened `SavedViewsToolbarComponent` scoped styles for the refactored saved-view toolbar.
- Converted opener and save form rows to stable grid layouts with mobile stacking.
- Added wrapping safeguards for long saved-view names, summaries, and helper text.
- Added mobile full-width action buttons for compact touch targets.
- Added explicit separation between general management actions and destructive delete actions.
- Added visually hidden help text for the open and manage selects.
- Added `aria-describedby` links from both saved-view selects to their help text.
- Added explicit accessible names for compact open and selected-view management action buttons.
- Preserved visible text and the native select/button interaction model.
- Added focused component coverage for:
  - visually hidden select help;
  - `aria-describedby` wiring;
  - compact open button accessible name;
  - selected management action accessible names.
- Verified:
  - `npm test --workspace @worktrail/web -- --include 'src/app/features/work-items/components/saved-views-toolbar.component.spec.ts'`;
  - `npm run typecheck --workspace @worktrail/web`;
  - `npm run lint --workspace @worktrail/web`;
  - `git diff --check`.

## Phase 4: Parent Page And Page-Spec Alignment

Goal: update workspace and project Work page tests and any integration assumptions around the new toolbar markup.

Scope:

- Update tests in:
  - `apps/web/src/app/features/work-items/workspace-work-item-list-page.component.spec.ts`;
  - `apps/web/src/app/features/work-items/work-items-page.component.spec.ts`.
- Preserve parent page component logic unless necessary.
- Keep existing parent handlers unchanged:
  - `openSavedView`;
  - `renameSavedView`;
  - `updateSavedViewQuery`;
  - `setSavedViewPinned`;
  - `deleteSavedView`;
  - `setSavedViewDraftName`.
- Update tests that assert old `.saved-view-row` or per-row action markup.
- Keep assertions for:
  - opening saved views updates query params;
  - shared project/workspace permissions;
  - archived project read-only saved views;
  - pin/unpin calls;
  - rename/update/delete calls;
  - pinned shortcut behavior.

Out of scope:

- E2E browser selector updates.
- Full docs.

Acceptance criteria:

- Workspace Work Items page tests pass with the new toolbar markup.
- Project Work page tests pass with the new toolbar markup.
- Existing saved-view store and parent navigation behavior remain intact.

Suggested commands:

```sh
npm test --workspace @worktrail/web -- --include 'src/app/features/work-items/workspace-work-item-list-page.component.spec.ts' --include 'src/app/features/work-items/work-items-page.component.spec.ts'
npm test --workspace @worktrail/web -- --include 'src/app/features/work-items/components/saved-views-toolbar.component.spec.ts'
npm run typecheck --workspace @worktrail/web
npm run lint --workspace @worktrail/web
git diff --check
```

Status:

- Completed on 2026-07-10.
- Confirmed no remaining positive assertions depend on the old saved-view row/action markup outside targeted negative checks that verify the old row markup is gone.
- Updated workspace Work Items page tests to exercise the refactored toolbar through DOM interactions:
  - opening a personal saved view from the compact opener;
  - confirming the open feedback text is shown;
  - selecting a shared saved view in the manager;
  - renaming, updating, and deleting the selected shared view through management panel buttons.
- Updated project Work page tests to open a shared project saved view from the compact opener and assert the confirmation text.
- Preserved parent page handler contracts and did not change runtime parent component logic.
- Verified workspace and project parent suites pass with the new toolbar markup.
- Verified:
  - `npm test --workspace @worktrail/web -- --include 'src/app/features/work-items/workspace-work-item-list-page.component.spec.ts' --include 'src/app/features/work-items/work-items-page.component.spec.ts'`;
  - `npm test --workspace @worktrail/web -- --include 'src/app/features/work-items/components/saved-views-toolbar.component.spec.ts'`;
  - `npm run typecheck --workspace @worktrail/web`;
  - `npm run lint --workspace @worktrail/web`;
  - `git diff --check`.

## Phase 5: Browser Smoke Updates

Goal: update browser coverage for the saved-view open flow and confirm user-visible feedback.

Scope:

- Update `e2e/worktrail-smoke.spec.ts` selectors for saved-view opening/management.
- Cover at least:
  - opening a shared workspace saved view from the compact opener;
  - opening a shared project saved view from the compact opener;
  - visible confirmation after open;
  - active chips after open;
  - expected filtered rows after open.
- Preserve pinned saved-view smoke behavior.
- Avoid relying on animation or automatic scroll.
- Keep seeded data assumptions unchanged.

Out of scope:

- New seed data.
- New backend behavior.

Acceptance criteria:

- Browser smoke demonstrates that a user can open saved views without the old large manager.
- Confirmation text is visible after saved-view open.
- Result list behavior remains correct.

Suggested commands:

```sh
npx playwright test -g "shared views|project saved views|pinned"
npm run test:e2e
git diff --check
```

Status:

- Completed on 2026-07-10.
- Updated `e2e/worktrail-smoke.spec.ts` saved-view selectors for the compact opener and selected management panel.
- Added smoke helpers for:
  - selecting native saved-view options by visible saved-view name;
  - waiting for dynamically-created saved-view options before selecting them;
  - opening saved views from the compact `Open saved view` control;
  - selecting a saved view in the `Manage views` selected-management panel.
- Updated workspace shared-view smoke coverage to:
  - verify owner management actions in the selected panel;
  - open `Dependency risks` from the compact opener;
  - verify confirmation, active dependency chip, and expected filtered row;
  - verify contributor read-only management panel behavior;
  - open the same shared view from the compact opener as contributor.
- Updated project saved-view smoke coverage to:
  - verify owner management actions for `Ready for QA`;
  - open `Ready for QA` from the compact opener;
  - verify confirmation, active status chip, and expected filtered row;
  - create, locate, reload, and open a personal project saved view through the selected/compact controls;
  - verify contributor read-only management panel behavior.
- Preserved pinned saved-view shortcut coverage while updating management assertions to use selected panels.
- Updated older saved-view creation smoke flows to stop relying on removed `article.saved-view-row` markup.
- Scoped one project work filter selector to `form.filters` after native saved-view selects made a broad `getByLabel('Milestone')` ambiguous.
- Verified:
  - `npx playwright test -g "shared views|project saved views|pinned"`;
  - `npm run test:e2e`;
  - `git diff --check`.

## Phase 6: README, Release Notes, Pattern Notes, And Final Verification

Goal: finish v0.2.2 with accurate docs and full verification.

Scope:

- Update README saved-view documentation:
  - compact opener;
  - selected-view management;
  - pinned shortcuts remain the fastest path for promoted views.
- Add `docs/v0.2.2/release-notes.md`.
- Add `docs/v0.2.2/pattern-notes.md`.
- Update package versions to `0.2.2` if the project continues mirroring product tags in package metadata.
- Run final verification:
  - db reset/migrate/seed;
  - lint;
  - typecheck;
  - unit/API/web tests;
  - E2E tests;
  - production build;
  - production dependency audit;
  - diff hygiene.
- Record known limitations and deferred follow-ups.

Out of scope:

- Public site update unless the final implementation materially changes product positioning.
- Any v0.2.3 planning.

Acceptance criteria:

- README reflects the saved-view ergonomics update.
- Release notes describe what changed, how to verify it, and what remains out of scope.
- Pattern notes capture reusable lessons without assuming a destination framework.
- Full verification is green or any residual issue is documented with a clear rationale.

Suggested commands:

```sh
npm install --package-lock-only
npm run db:reset
npm run db:migrate
npm run db:seed
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build
npm audit --omit=dev --audit-level=low
git diff --check
git status --short --branch
```

## Rollback Notes

If a saved-view ergonomics issue appears before release:

- Revert the toolbar template/CSS to the previous row manager while keeping docs unmerged.
- If only the compact opener is problematic, keep selected management only if the old open path still works.
- If selected management breaks mutation flows, restore the previous manager until tests cover the replacement.
- Do not ship a state where saved views can be opened only from pinned shortcuts.
- Do not ship a state where contributors can see shared mutation controls.

## Final Release Gate

v0.2.2 is ready when:

- saved views can be opened from a compact control;
- opening a saved view provides local visible feedback;
- all existing saved-view mutation flows work from selected-view management;
- contributors get a lean read/open shared-view experience;
- archived project saved views remain open-only;
- pinned shortcuts remain unchanged;
- workspace and project Work pages behave consistently;
- docs, release notes, and pattern notes are current;
- full local verification passes.
