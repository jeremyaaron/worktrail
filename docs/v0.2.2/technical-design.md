# Worktrail v0.2.2 Technical Design

## Summary

v0.2.2 improves Saved View ergonomics on Workspace Work Items and Project Work pages.

The release should refactor the saved-view toolbar from an all-rows management surface into a compact operating control:

- use a compact saved-view opener for the common `Open` workflow;
- show local confirmation after a saved view is opened;
- keep `Save view` as a secondary disclosure;
- move rename/update/pin/delete controls into a selected-view management panel;
- preserve existing saved-view APIs, stores, permissions, query contracts, pinned shortcuts, and route behavior.

The implementation is expected to be frontend-only, plus documentation and tests. No database migration, API route, OpenAPI, or shared contract change is required.

## Resolved Decisions

### Open Control

Use a native `<select>` with grouped options and an adjacent `Open` button.

Rationale:

- it is accessible without adding a custom listbox implementation;
- it is compact with many views;
- it supports keyboard selection immediately;
- it avoids a new dependency or behavior primitive;
- it keeps saved-view opening visibly separate from saved-view management.

The select should group options into:

- shared views;
- personal views.

Option text should prefer a compact readable format:

```text
Dependency risks - 2 applied filters
My app work - 1 applied filter
```

The selected view's fuller metadata can be shown below the control in regular text, where wrapping is reliable.

### Management Surface

Keep management inline in `SavedViewsToolbarComponent`, behind `Manage views`.

Do not use a modal/dialog in v0.2.2.

Rationale:

- current Work pages already use inline controls;
- the saved-view manager is still part of the Work page context;
- a dialog would add focus-trap and escape behavior that is not otherwise needed;
- selected-view inline management is enough to remove the current vertical bloat.

The manager should render:

- a select for choosing one saved view to manage;
- a selected-view summary panel;
- mutation controls only for the selected saved view when the current actor can mutate it;
- read-only details plus `Open` when the current actor can only read it.

### Feedback After Open

Show local confirmation in the saved-view toolbar:

```text
Opened "Release blockers". Results updated below.
```

Use `aria-live="polite"` for the confirmation.

Do not automatically scroll to results in v0.2.2.

Rationale:

- local feedback directly addresses the user's uncertainty;
- preserving scroll avoids surprising jumps;
- active filter chips remain the applied-query source of truth;
- automatic focus/scroll can be revisited later if UAT still shows confusion.

### Active View Awareness

Do not add durable active-view state or unsaved-change detection in v0.2.2.

Rationale:

- the saved-view query contract already projects the opened view into URL params;
- detecting divergence between current filters and a saved view adds complexity across workspace/project query semantics;
- a temporary/opened confirmation solves the reported problem without implying that the current filters still match the saved record after later edits.

### API And Persistence

Do not change API, persistence, shared contracts, or OpenAPI.

Rationale:

- all needed saved-view data is already available in `SavedWorkViewDto`;
- current mutation commands already support rename, update-query, pin/unpin, and delete;
- v0.2.2 changes the interaction model, not the saved-view data model.

## Current Implementation

### Component Boundary

Saved views are currently rendered by:

```text
apps/web/src/app/features/work-items/components/saved-views-toolbar.component.ts
```

The component is standalone and mostly presentational. It receives:

- personal saved views;
- shared saved views;
- permission flags;
- draft names;
- loading/saving/error state;
- copy labels and helper copy;
- query summary scope.

It emits:

- save personal/shared;
- open;
- rename;
- update query;
- pin/unpin;
- delete;
- draft-name changes.

The parent pages are:

```text
apps/web/src/app/features/work-items/workspace-work-item-list-page.component.ts
apps/web/src/app/features/work-items/work-item-list-page.component.ts
```

They keep saved-view state in the existing saved-view store and route/query helpers. They should remain responsible for API and navigation orchestration.

### Current UX Issue

The existing `Manage views` disclosure renders every saved view as a full row. Mutable rows include an always-visible rename input and five action buttons. This means a manager with several shared and personal views sees many controls before they can reach the actual work item list.

## Proposed Component Model

Keep `SavedViewsToolbarComponent` as the only component that needs structural UI changes.

No new component is required unless implementation becomes difficult to test. If extraction becomes useful, prefer small presentational children:

```text
saved-view-open-control.component.ts
saved-view-management-panel.component.ts
```

Do not extract a generic saved-view framework in v0.2.2.

### Internal View Model

Add a small local view model in `SavedViewsToolbarComponent`:

```ts
interface SavedViewOption {
  id: string;
  view: SavedWorkViewDto;
  group: 'shared' | 'personal';
  label: string;
  summary: string;
  canManage: boolean;
}
```

Computed helpers:

- `sharedOptions()`;
- `personalOptions()`;
- `allOptions()`;
- `selectedOpenOption()`;
- `selectedManageOption()`;
- `canManageView(view)`;
- `savedViewQueryLabel(view)`, reusing the current meaningful-filter count helper.

Because this is an Angular component class, plain methods are acceptable. Signals are not required unless the implementation already introduces them locally.

### Local State

Add component-local state:

```ts
selectedOpenViewId = '';
selectedManageViewId = '';
openedViewMessage: string | null = null;
```

Behavior:

- initialize no explicit selection;
- when options exist and the user has not selected one, the native select can render a placeholder option;
- `Open` is disabled until a saved view is selected;
- when a selected view is opened:
  - emit `open`;
  - set `openedViewMessage` to `Opened "<name>". Results updated below.`;
  - keep controls in place;
  - do not mutate `selectedManageViewId`;
  - do not scroll.

Input changes should not throw if a selected saved view disappears. If `selectedOpenViewId` or `selectedManageViewId` no longer matches an available option, the selected helper should return `null` and the UI should ask the user to choose a saved view.

### Template Shape

Recommended structure:

```html
<section class="saved-views" aria-labelledby="saved-views-heading">
  <header class="saved-views__heading">...</header>

  <div class="saved-view-open">
    <label>
      <span>Open saved view</span>
      <select ...>
        <option value="">Choose a saved view</option>
        <optgroup label="Shared views">...</optgroup>
        <optgroup label="Personal views">...</optgroup>
      </select>
    </label>
    <button type="button" (click)="openSelectedView()">Open</button>
  </div>

  @if (selectedOpenOption()) {
    <p class="saved-view-selected-summary">...</p>
  }

  @if (openedViewMessage) {
    <p class="saved-view-opened" aria-live="polite">...</p>
  }

  <details class="saved-view-save">...</details>

  <details class="saved-view-manager">
    <summary>Manage views</summary>
    <div class="saved-view-manage">
      <label>
        <span>Saved view</span>
        <select ...>...</select>
      </label>

      @if (selectedManageOption()) {
        <article class="saved-view-management-panel">...</article>
      } @else {
        <p>Choose a saved view to inspect or manage it.</p>
      }
    </div>
  </details>
</section>
```

Do not render per-view rows with rename inputs for every view.

### Management Panel

For the selected view, render:

- name;
- visibility label:
  - `Shared view`;
  - `Personal view`;
- owner label when shared;
- query summary;
- pinned state;
- last updated timestamp if useful and already present;
- `Open` button.

If the view is mutable:

- rename input;
- `Rename`;
- `Update query`;
- `Pin` or `Unpin`;
- `Delete`.

If read-only:

- helper copy explaining why management controls are unavailable;
- no disabled mutation button clutter.

Use existing events:

- `draftNameChange`;
- `rename`;
- `updateQuery`;
- `pinChange`;
- `delete`;
- `open`.

No parent page event contract has to change.

## Permissions

Use existing inputs:

- `canManagePersonalViews`;
- `canManageSharedViews`.

Management rules in the component:

```ts
canManageView(view: SavedWorkViewDto): boolean {
  return view.visibility === 'personal'
    ? this.canManagePersonalViews
    : this.canManageSharedViews;
}
```

The parent pages already pass archived-project behavior by setting management flags and helper copy appropriately. Keep that approach.

Contributor behavior:

- shared views appear in open select;
- shared views appear in manage select;
- selected shared view panel is read-only;
- personal views remain manageable if current policy allows personal management.

Archived project behavior:

- existing project saved views remain openable;
- management panel is read-only;
- save controls remain hidden where they are currently hidden.

## Styling

Keep styles scoped to `SavedViewsToolbarComponent`.

Design constraints:

- keep the toolbar as a compact framed section;
- avoid card-in-card composition;
- keep controls dense but readable;
- use stable grid/flex dimensions so labels and buttons do not cause layout shifts;
- ensure mobile stacks cleanly;
- keep destructive action separated from `Open`;
- preserve existing button vocabulary:
  - primary action for `Open`;
  - secondary actions for rename/update/pin;
  - danger action for delete.

Recommended CSS areas:

- `.saved-view-open`;
- `.saved-view-selected-summary`;
- `.saved-view-opened`;
- `.saved-view-manage`;
- `.saved-view-management-panel`;
- `.saved-view-management-actions`;
- `.saved-view-management-danger`.

Remove or repurpose row-oriented styles:

- `.saved-view-list`;
- `.saved-view-section`;
- `.saved-view-row`;
- `.saved-view-actions` where the name implies row-level controls.

## Parent Page Integration

Expected parent changes are minimal.

Keep existing markup:

```html
<app-saved-views-toolbar
  ...
  (open)="openSavedView($event)"
  (rename)="renameSavedView($event)"
  (updateQuery)="updateSavedViewQuery($event)"
  (pinChange)="setSavedViewPinned($event.savedView, $event.isPinned)"
  (delete)="deleteSavedView($event)"
  (draftNameChange)="setSavedViewDraftName($event.savedViewId, $event.name)"
/>
```

Parent pages should not need new state for v0.2.2.

Existing `openSavedView` behavior remains the source of query projection:

- workspace Work Items projects the saved query into `/work-items` query params;
- project Work projects the saved query into `/projects/:projectId/work-items` query params;
- active chips and result rows update through existing query store behavior.

Pinned saved views remain separate:

```text
apps/web/src/app/features/work-items/components/pinned-saved-views.component.ts
```

No pinned shortcut behavior change is required.

## Testing Plan

### Component Tests

Update:

```text
apps/web/src/app/features/work-items/components/saved-views-toolbar.component.spec.ts
```

Replace row-manager expectations with:

- renders compact open select with shared and personal groups;
- disables `Open` until a saved view is selected;
- emits `open` for selected shared view;
- emits `open` for selected personal view;
- shows `Opened "<name>". Results updated below.` with `aria-live="polite"`;
- renders selected-view management panel only after a view is selected;
- does not render rename inputs for every saved view;
- emits rename/update/pin/delete only for selected mutable view;
- renders read-only selected shared view for contributors;
- keeps personal view management available when shared management is read-only;
- keeps all mutation controls hidden when all views are read-only;
- preserves query summary counts for workspace and project scopes;
- preserves cycle/dependency/risk query summary behavior.

### Page Tests

Update page specs where they assert old row-level controls:

```text
apps/web/src/app/features/work-items/workspace-work-item-list-page.component.spec.ts
apps/web/src/app/features/work-items/work-items-page.component.spec.ts
```

Keep existing service/store interaction assertions:

- opening a saved view navigates with expected query params;
- rename sends current draft name;
- update query uses current applied query;
- pin/unpin sends `isPinned`;
- delete removes the selected view;
- contributors cannot mutate shared views;
- archived project views are open-only.

The page specs may not need to test all UI details if the toolbar component covers them.

### E2E Tests

Update existing Playwright tests that open or manage saved views:

```text
e2e/worktrail-smoke.spec.ts
```

At minimum:

- open a shared workspace saved view from the compact opener and verify:
  - confirmation text appears;
  - active chips update;
  - rows match the saved query.
- open a shared project saved view from the compact opener and verify:
  - confirmation text appears;
  - project URL/query params update;
  - rows match the saved query.
- keep pinned-view smoke tests unchanged unless selectors need updating.

Do not rely on animation.

## Documentation

Update README after implementation:

- describe saved views as compact opener plus selected management;
- clarify pinned shortcuts remain the fastest path for promoted views;
- mention that mutation controls appear only after selecting a view to manage.

Release notes and pattern notes should be added during finalization:

```text
docs/v0.2.2/release-notes.md
docs/v0.2.2/pattern-notes.md
```

Likely pattern note:

- daily-use action versus selected-object management for query-backed artifacts.

The public site likely does not require an update unless final implementation changes product copy materially.

## Verification

Recommended phase-level commands:

```sh
npm test --workspace @worktrail/web -- --include 'src/app/features/work-items/components/saved-views-toolbar.component.spec.ts'
npm test --workspace @worktrail/web -- --include 'src/app/features/work-items/workspace-work-item-list-page.component.spec.ts' --include 'src/app/features/work-items/work-items-page.component.spec.ts'
npm run typecheck --workspace @worktrail/web
npm run lint --workspace @worktrail/web
npm run test:e2e
npm run build
git diff --check
```

Final release verification should use the normal full suite:

```sh
npm run db:reset
npm run db:migrate
npm run db:seed
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build
git diff --check
```

## Risks

### Select Option Text Is Too Dense

Native select options cannot contain rich markup. If query summaries make options too long, keep option text to view name plus scope and render the selected view's summary below the select.

### Management Becomes Harder For Power Users

The selected-view manager adds a selection step for mutation. This is acceptable because opening is more common than mutation. Keep the manager compact and make the selected view summary clear.

### Confirmation Becomes Stale

The local opened message may remain after the user edits filters. Phrase the message as an event, not persistent state:

```text
Opened "Release blockers". Results updated below.
```

Do not use persistent wording such as `Viewing "Release blockers"` in v0.2.2 unless unsaved-change detection is implemented.

### Permission Regression

The UI refactor could accidentally expose shared mutation controls to contributors. Keep permission tests focused and preserve parent-store permission checks.

## Open Questions

No blocking technical questions remain.

The PRD open questions are resolved as follows:

- Opening a saved view keeps controls in place and shows local confirmation; no automatic scroll.
- The compact opener uses a native grouped select plus `Open`.
- The selected management surface stays inline under `Manage views`.
- Active-view awareness stops at an opened-view confirmation; unsaved-change detection is deferred.
