# Worktrail v0.2.2 Release Notes

## Summary

Worktrail v0.2.2 improves Saved Views ergonomics on the workspace Work Items page and project Work pages.

Saved views now have a compact opener for the common "open this view" action, while rename/update/pin/delete controls move into a selected-view management panel. The release keeps existing saved-view APIs, persistence, permissions, pinned shortcuts, URL-backed query behavior, CSV export behavior, and saved-view summaries intact.

## User-Facing Changes

- Added a compact `Open saved view` selector with shared and personal groups.
- Added local confirmation after opening a saved view: `Opened "<name>". Results updated below.`
- Reworked `Manage views` so users select one saved view before seeing management controls.
- Removed always-visible rename inputs and mutation controls from every saved-view row.
- Preserved pinned saved-view shortcuts as the fastest path for promoted workspace and project operating lenses.
- Preserved contributor read-only access to shared workspace and project saved views.
- Preserved archived-project saved-view read/open behavior while keeping mutation controls unavailable.
- Kept saved-view open, rename, update-query, pin/unpin, and delete behaviors on their existing routes and contracts.

## Technical Changes

- Reworked `SavedViewsToolbarComponent` around component-local opener and selected-management state.
- Added grouped option helpers for shared and personal saved views.
- Preserved existing parent page output events so workspace and project pages did not need API-facing changes.
- Updated saved-view component tests for compact opening, selected management, read-only rendering, and permission-sensitive controls.
- Updated parent page specs and Playwright smoke coverage for the compact opener and selected management panel.
- Scoped one existing E2E filter selector to avoid ambiguity with the new native saved-view selects.
- Updated first-party package metadata to `0.2.2`.

## Compatibility Notes

- No database migration is required.
- No saved-view API, DTO, OpenAPI, or persistence change is required.
- Existing personal, shared, project-scoped, workspace-scoped, and pinned saved views continue to load.
- Existing saved-view URLs, copy links, return URLs, and CSV export semantics are unchanged.
- The compact opener and selected manager use native form controls, so browser accessibility and keyboard behavior stay predictable.

## Verification

Phase-level verification is recorded in `docs/v0.2.2/implementation-plan.md`.

Recommended release checks:

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
```

## Deferred

- Durable active-view state.
- Last-opened saved-view metadata.
- Saved-view usage analytics.
- Unsaved-change detection between current filters and an opened saved view.
- Auto-scroll or auto-focus to the result list after opening a saved view.
- Modal or command-palette saved-view management.
- Saved-view folders, icons, colors, descriptions, ownership transfer, and custom permissions.
