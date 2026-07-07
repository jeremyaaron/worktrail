# Worktrail v0.1.5 Implementation Plan

## Purpose

This plan turns the v0.1.5 PRD and technical design into sequential implementation phases. v0.1.5 should add pinned saved views so important workspace and project operating views become compact, one-click shortcuts on the relevant Work Items page.

The release should preserve the local-first development experience, Angular static-hosting compatibility, transport-neutral API handler structure, Express local adapter, Postgres persistence, deterministic seed data, checked-in OpenAPI docs, CI verification, and clean setup from a fresh checkout.

## Design Decisions

Use these decisions while implementing v0.1.5:

- Add `isPinned: boolean` to saved work view DTOs and persistence.
- Add `isPinned?: boolean` to saved work view update requests.
- Do not allow create requests to set pinned state; new saved views start unpinned.
- Use the existing `PATCH /api/saved-work-views/:savedViewId` route for pin and unpin.
- Keep saved view `scope`, `projectId`, and `visibility` immutable.
- Keep pinned state independent from the saved query payload.
- Keep pinned state independent from saved-view visibility and mutation permissions.
- Allow personal view owners to pin and unpin their own personal saved views.
- Allow owners and maintainers to pin and unpin shared workspace and project views.
- Keep contributors able to open shared pinned views but unable to pin or unpin shared views.
- Emit activity only for shared pin state changes.
- Emit workspace activity for workspace-scoped shared saved views.
- Emit project activity for project-scoped shared saved views.
- Do not emit activity for personal pin state changes.
- Render pinned shared views before pinned personal views.
- Sort pinned views alphabetically by saved view name within each group.
- Do not persist custom pin ordering in this release.
- Seed a small number of pinned shared workspace and project views.
- Avoid new backend or infrastructure dependencies.

## Phase Sizing

Each phase should leave the repository in a coherent working state. This release touches shared contracts, Drizzle schema and migrations, saved-view repository/service behavior, endpoint validation, activity events, OpenAPI, seed data, Angular API clients, saved-view UI components, workspace and project Work pages, Playwright smoke, public docs, release notes, and pattern extraction notes.

Implementation phases:

1. baseline planning;
2. contracts, migration, DTO, and seed plumbing;
3. API pin and unpin service behavior;
4. API regression and OpenAPI;
5. pinned shortcuts component;
6. saved-view toolbar pin controls;
7. workspace Work Items integration;
8. project Work page integration;
9. seeded browser smoke;
10. documentation, site, release notes, pattern extraction notes, and final verification.

Run focused contract/API tests after backend phases, focused web tests after frontend phases, and full verification during finalization.

## Phase 0: Baseline Planning

Goal: confirm v0.1.5 planning inputs and repository state before runtime changes.

Scope:

- Confirm `docs/v0.1.5/prd.md` exists.
- Confirm `docs/v0.1.5/technical-design.md` exists.
- Confirm `docs/v0.1.5/implementation-plan.md` exists.
- Confirm active branch and repository status.
- Confirm no unresolved technical choice blocks Phase 1.
- Confirm v0.1.5 docs use destination-neutral pattern extraction language.

Out of scope:

- Runtime implementation.
- Database migration.
- Contract changes.
- UI changes.

Acceptance criteria:

- v0.1.5 planning inputs exist.
- Design decisions are recorded.
- Worktree/index state is understood before implementation starts.
- No open decision blocks Phase 1.
- Sprint docs use destination-neutral pattern extraction language.

Suggested commands:

```sh
find docs/v0.1.5 -maxdepth 1 -type f | sort
git status --short --branch
git diff --check
```

Status:

- Completed on 2026-07-06.
- Confirmed v0.1.5 planning inputs exist:
  - `docs/v0.1.5/prd.md`;
  - `docs/v0.1.5/technical-design.md`;
  - `docs/v0.1.5/implementation-plan.md`.
- Confirmed implementation decisions:
  - add `isPinned` to saved work view DTOs, persistence, and update requests;
  - keep create requests unpinned by default;
  - use the existing saved-view update route for pin/unpin;
  - keep saved-view scope, project id, visibility, and query semantics unchanged;
  - allow owners and maintainers to manage shared pins;
  - allow personal view owners to manage personal pins;
  - keep contributors read-only for shared pins;
  - emit activity only for shared pin state changes;
  - render shared pins before personal pins, sorted alphabetically;
  - defer custom ordering, folders, rich metadata, analytics, and generic saved-view framework extraction.
- Confirmed active branch is `v0.1.5`.
- Confirmed current change state:
  - only `docs/v0.1.5/` is untracked;
  - no runtime files have been changed yet.
- Confirmed v0.1.5 docs use destination-neutral pattern extraction language.
- Verified `git diff --check`.
- No unresolved technical choice blocks Phase 1.

## Phase 1: Contracts, Migration, DTO, And Seed Plumbing

Goal: add pinned state to saved-view contracts and persistence while keeping existing saved-view behavior compatible.

Scope:

- Update `packages/contracts/src/saved-work-views.ts`:
  - add `isPinned: boolean` to `SavedWorkViewDto`;
  - add optional `isPinned` to `UpdateSavedWorkViewRequest`;
  - keep `CreateSavedWorkViewRequest` unchanged for pinned state.
- Update contract tests for:
  - saved-view DTOs that include `isPinned`;
  - update requests with `isPinned`;
  - create requests that do not accept or require `isPinned`.
- Update Drizzle schema:
  - add `saved_work_views.is_pinned boolean not null default false`.
- Generate and review a Drizzle migration.
- Update saved-view DTO mapping to include `isPinned`.
- Update seed saved-view rows to set pinned state where the technical design calls for seeded shortcuts.
- Update seed upsert behavior so `isPinned` is stable and idempotent.
- Update TypeScript fixtures that construct `SavedWorkViewDto`.

Out of scope:

- API permission behavior for pin/unpin.
- Activity emission.
- Angular pinned-view UI.
- OpenAPI docs.

Acceptance criteria:

- Contracts compile with `isPinned`.
- Existing saved views migrate to `isPinned=false`.
- Seeded pinned saved views are deterministic.
- DTO mapping returns pinned state to callers.
- Existing saved-view create behavior remains backward compatible.

Suggested commands:

```sh
npm test --workspace @worktrail/contracts
npm run typecheck --workspace @worktrail/contracts
npm run db:reset
npm run db:migrate
npm run db:seed
npm run typecheck --workspace @worktrail/api
git diff --check
```

Status:

- Completed on 2026-07-06.
- Updated shared saved-view contracts:
  - added `isPinned: boolean` to `SavedWorkViewDto`;
  - added optional `isPinned` to `UpdateSavedWorkViewRequest`;
  - kept `CreateSavedWorkViewRequest` unchanged for pinned state.
- Updated contract coverage for pinned saved-view DTOs and update requests.
- Updated Drizzle schema:
  - added `saved_work_views.is_pinned boolean not null default false`.
- Generated migration and snapshot:
  - `apps/api/drizzle/0009_smart_tana_nile.sql`;
  - `apps/api/drizzle/meta/0009_snapshot.json`.
- Updated saved-view DTO mapping to include `isPinned`.
- Updated seeded saved views:
  - workspace `Dependency risks`: `isPinned: true`;
  - workspace `Ready for pickup`: `isPinned: true`;
  - app project `Release blockers`: `isPinned: true`;
  - app project `Ready for QA`: `isPinned: true`.
- Updated saved-view seed upsert behavior so `isPinned` is refreshed idempotently.
- Updated current web test fixtures for the required DTO field.
- Verified seeded data after reset/migrate/seed:
  - 4 pinned shared saved views;
  - 21 unpinned saved views.
- Verified repeated seed execution keeps the same pinned counts.
- Verified:
  - `npm test --workspace @worktrail/contracts`;
  - `npm run typecheck --workspace @worktrail/contracts`;
  - `npm run typecheck --workspace @worktrail/api`;
  - `npm run db:reset`;
  - `npm run db:migrate`;
  - `npm run db:seed`;
  - `npm run typecheck --workspace @worktrail/web`;
  - `npm test --workspace @worktrail/api -- saved-work-views.test.ts`;
  - `git diff --check`.

## Phase 2: API Pin And Unpin Service Behavior

Goal: implement pin and unpin mutations through the saved-view service with correct permissions and activity behavior.

Scope:

- Update endpoint validation for saved-view update requests:
  - accept optional `isPinned`;
  - require at least one of `name`, `query`, or `isPinned`;
  - keep `scope`, `projectId`, and `visibility` immutable.
- Extend saved-view repository update input with optional `isPinned`.
- Update `SavedWorkViewService` to:
  - detect requested pin state;
  - update pinned state only when provided;
  - preserve existing name/query update behavior;
  - allow personal saved-view owners to pin/unpin their own views;
  - allow owners and maintainers to pin/unpin shared workspace and project views;
  - reject contributor pin/unpin attempts for shared views;
  - preserve archived project mutation rejection for project-scoped views.
- Add activity event constants:
  - `saved_view.pinned`;
  - `saved_view.unpinned`.
- Emit workspace activity for shared workspace pin changes.
- Emit project activity for shared project pin changes.
- Avoid activity for personal pin changes.
- Avoid activity for no-op pin updates where state does not change.

Out of scope:

- OpenAPI.
- Seed data beyond Phase 1 plumbing.
- Angular UI.
- Browser smoke.

Acceptance criteria:

- Pin/unpin uses the same authorization model as other saved-view mutations.
- Personal pin changes do not create workspace or project activity.
- Shared pin changes create the correct activity type in the correct activity stream.
- No-op pin updates do not create noisy activity.
- Existing name/query update tests continue to pass.

Suggested commands:

```sh
npm test --workspace @worktrail/api -- saved-work-views.test.ts
npm test --workspace @worktrail/api -- comments-activity.test.ts
npm run typecheck --workspace @worktrail/api
npm run lint --workspace @worktrail/api
git diff --check
```

Status:

- Completed on 2026-07-06.
- Updated saved-view update endpoint validation:
  - accepts optional `isPinned`;
  - still requires at least one update field;
  - passes `isPinned` into `UpdateSavedWorkViewRequest`.
- Extended saved-view repository update input with optional `isPinned`.
- Updated `SavedWorkViewService.updateSavedView` to:
  - persist pin state only when provided;
  - preserve existing name/query update behavior;
  - reuse existing personal/shared mutation authorization;
  - preserve archived project mutation rejection;
  - suppress activity for no-op pin updates.
- Added shared activity event types:
  - `saved_view.pinned`;
  - `saved_view.unpinned`.
- Updated database activity event check constraints through:
  - `apps/api/drizzle/0010_free_quasar.sql`;
  - `apps/api/drizzle/meta/0010_snapshot.json`.
- Updated shared activity value payloads to include `isPinned`.
- Added shared workspace and project activity summaries for pin/unpin events.
- Updated workspace and project activity UI labels for new event types.
- Added API coverage for:
  - personal pin/unpin without activity;
  - shared workspace pin/unpin activity;
  - shared project pin activity;
  - mixed rename/unpin event precedence as `saved_view.updated`;
  - contributor rejection for shared pin mutation;
  - archived project rejection for pin mutation;
  - no-op pin activity suppression.
- Verified activity constraints include both new event types after migration.
- Verified:
  - `npm test --workspace @worktrail/contracts`;
  - `npm run typecheck --workspace @worktrail/contracts`;
  - `npm run typecheck --workspace @worktrail/api`;
  - `npm run lint --workspace @worktrail/api`;
  - `npm run typecheck --workspace @worktrail/web`;
  - `npm run lint --workspace @worktrail/web`;
  - `npm run db:reset`;
  - `npm run db:migrate`;
  - `npm run db:seed`;
  - `npm test --workspace @worktrail/api -- saved-work-views.test.ts comments-activity.test.ts`;
  - `git diff --check`.

## Phase 3: API Regression And OpenAPI

Goal: harden the public API contract for pinned saved views and document the implemented route surface.

Scope:

- Expand API tests for:
  - list response includes `isPinned`;
  - update can pin and unpin personal workspace views;
  - update can pin and unpin personal project views;
  - owner/maintainer can pin and unpin shared workspace views;
  - owner/maintainer can pin and unpin shared project views;
  - contributor cannot pin/unpin shared workspace views;
  - contributor cannot pin/unpin shared project views;
  - archived project rejects project saved-view pin/unpin;
  - duplicate names and query updates remain unaffected;
  - project/workspace scope isolation remains unaffected.
- Update `docs/api/openapi.yaml`:
  - `SavedWorkView.required` includes `isPinned`;
  - `SavedWorkView.properties.isPinned` is boolean;
  - `UpdateSavedWorkViewRequest.properties.isPinned` is boolean;
  - update route notes mention pin/unpin permission behavior.
- Verify OpenAPI tests and existing API compatibility.

Out of scope:

- Frontend implementation.
- E2E browser smoke.
- Public site copy.

Acceptance criteria:

- API tests cover successful and rejected pin/unpin flows.
- OpenAPI describes pinned saved-view fields.
- Existing workspace and project saved-view endpoint behavior remains compatible.

Suggested commands:

```sh
npm test --workspace @worktrail/api -- saved-work-views.test.ts
npm test --workspace @worktrail/api -- openapi.test.ts
npm run typecheck --workspace @worktrail/api
npm run lint --workspace @worktrail/api
git diff --check
```

Status:

- Completed on 2026-07-06.
- Expanded API regression coverage for pinned saved views:
  - workspace list responses include `isPinned`;
  - project list responses include `isPinned`;
  - update can pin and unpin personal workspace views;
  - update can pin and unpin personal project views;
  - shared workspace/project pin permissions remain covered;
  - contributor and archived-project rejection paths remain covered.
- Updated `docs/api/openapi.yaml`:
  - `SavedWorkView.required` includes `isPinned`;
  - `SavedWorkView.properties.isPinned` is boolean;
  - `UpdateSavedWorkViewRequest.properties.isPinned` is boolean;
  - create route notes state new saved views are created unpinned;
  - update route notes state the route handles rename, query update, pin, and unpin;
  - workspace and project activity examples include `saved_view.pinned` and `saved_view.unpinned`.
- Updated OpenAPI reference test assertions for pinned saved-view fields and activity examples.
- Verified:
  - `npm test --workspace @worktrail/api -- saved-work-views.test.ts openapi.test.ts`;
  - `npm run typecheck --workspace @worktrail/api`;
  - `npm run lint --workspace @worktrail/api`;
  - `git diff --check`.

## Phase 4: Pinned Shortcuts Component

Goal: add a reusable Angular component for rendering pinned saved-view shortcuts without coupling it to route state.

Scope:

- Add `PinnedSavedViewsComponent`.
- Accept grouped pinned views as inputs:
  - shared pinned views;
  - personal pinned views.
- Render shared shortcuts before personal shortcuts.
- Sort views alphabetically before render or document page-level sorting if the component receives pre-sorted lists.
- Show compact shortcut buttons that open saved views through an output event.
- Include a small label or badge that distinguishes shared and personal pins.
- Hide the component when there are no pinned views.
- Keep the component presentational:
  - no API calls;
  - no route updates;
  - no permission decisions;
  - no saved-view mutation logic.
- Add component tests for:
  - empty hidden state;
  - shared and personal rendering;
  - ordering policy;
  - open event emission;
  - accessible names for shortcut buttons.

Out of scope:

- Saved-view manager pin controls.
- Workspace/project page wiring.
- API client changes.

Acceptance criteria:

- Pinned shortcuts can be tested independently.
- The component is compact enough for the Work Items page filter area.
- Opening a shortcut is entirely delegated to the parent page.

Suggested commands:

```sh
npm test --workspace @worktrail/web -- --include "**/pinned-saved-views.component.spec.ts"
npm run typecheck --workspace @worktrail/web
npm run lint --workspace @worktrail/web
git diff --check
```

Status:

- Completed on 2026-07-06.
- Added `PinnedSavedViewsComponent`:
  - accepts shared and personal pinned saved-view inputs;
  - renders shared shortcuts before personal shortcuts;
  - sorts each group alphabetically by saved-view name;
  - hides itself when both groups are empty;
  - emits the selected saved view through an `open` output;
  - keeps routing, API calls, permission decisions, and mutation behavior in parent pages;
  - supports custom heading copy for workspace/project contexts.
- Added compact shortcut styling:
  - wrapping button layout;
  - stable badge labels for `Shared` and `Personal`;
  - keyboard focus styling;
  - accessible button names that distinguish shared and personal shortcuts.
- Added focused component coverage for:
  - empty hidden state;
  - shared-before-personal rendering;
  - alphabetical ordering inside each group;
  - open event emission;
  - accessible names;
  - heading customization without route context.
- Verified:
  - `npm test --workspace @worktrail/web -- --include "**/pinned-saved-views.component.spec.ts"`;
  - `npm run typecheck --workspace @worktrail/web`;
  - `npm run lint --workspace @worktrail/web`;
  - `git diff --check`.

## Phase 5: Saved-View Toolbar Pin Controls

Goal: add pin and unpin controls to the saved-view manager while preserving existing save, open, rename, update, and delete behavior.

Scope:

- Update `SavedViewsToolbarComponent` to display pin controls for saved views.
- Add a `pinChange` output with:
  - saved view;
  - requested pinned state.
- Show `Pin` for mutable unpinned views.
- Show `Unpin` for mutable pinned views.
- Keep shared saved-view pin controls unavailable when shared management is read-only.
- Keep personal saved-view pin controls available only when personal mutation controls are available.
- Preserve existing archived project read-only behavior.
- Keep manager controls visually secondary to opening saved views.
- Add component tests for:
  - personal pin action emits `true`;
  - personal unpin action emits `false`;
  - shared owner/maintainer pin controls render;
  - shared contributor pin controls do not render;
  - archived project pin controls do not render;
  - existing save/open/rename/update/delete behavior remains intact.

Out of scope:

- Parent page API mutation handling.
- Pinned shortcut rendering.
- Backend changes.

Acceptance criteria:

- Saved-view manager exposes pin/unpin intent without performing API calls itself.
- Read-only shared views remain openable but not pinnable.
- Existing toolbar tests still pass.

Suggested commands:

```sh
npm test --workspace @worktrail/web -- --include "**/saved-views-toolbar.component.spec.ts"
npm run typecheck --workspace @worktrail/web
npm run lint --workspace @worktrail/web
git diff --check
```

## Phase 6: Workspace Work Items Integration

Goal: wire pinned saved views into the workspace Work Items page.

Scope:

- Compute workspace pinned shared views from workspace-scoped shared saved views.
- Compute workspace pinned personal views from workspace-scoped personal saved views.
- Render `PinnedSavedViewsComponent` near the saved-view/filter controls.
- Open pinned workspace shortcuts through the same canonical URL behavior as saved-view manager open.
- Implement `setSavedViewPinned` for workspace saved views:
  - call saved-view update API with `{ isPinned }`;
  - update local saved-view state on success;
  - surface mutation errors consistently with existing saved-view errors.
- Wire toolbar `pinChange` to workspace page mutation handling.
- Preserve workspace filter chips, apply behavior, copy links, CSV export, pagination, and detail return URLs.
- Add or update page tests for:
  - pinned shared workspace shortcuts render;
  - pinned personal workspace shortcuts render;
  - opening a pinned shortcut updates canonical query params;
  - owner can pin/unpin shared workspace views;
  - contributor can open shared pins but cannot pin/unpin shared views;
  - personal owner can pin/unpin personal views;
  - API errors are shown without corrupting local saved-view state.

Out of scope:

- Project Work page wiring.
- Playwright smoke.
- Public documentation.

Acceptance criteria:

- Workspace users can open pinned saved views without opening the manager.
- Pin/unpin changes are persisted through the API.
- Existing workspace saved-view workflows remain compatible.

Suggested commands:

```sh
npm test --workspace @worktrail/web -- --include "**/workspace-work-item-list-page.component.spec.ts"
npm test --workspace @worktrail/web -- --include "**/saved-views-toolbar.component.spec.ts"
npm test --workspace @worktrail/web -- --include "**/worktrail-api.service.spec.ts"
npm run typecheck --workspace @worktrail/web
npm run lint --workspace @worktrail/web
git diff --check
```

## Phase 7: Project Work Page Integration

Goal: wire pinned saved views into project Work pages with project-specific permission and archived-state behavior.

Scope:

- Compute project pinned shared views from project-scoped shared saved views.
- Compute project pinned personal views from project-scoped personal saved views.
- Render `PinnedSavedViewsComponent` on active and archived project Work pages when pins exist.
- Open pinned project shortcuts through the same canonical project URL behavior as saved-view manager open.
- Implement `setSavedViewPinned` for project saved views:
  - call saved-view update API with `{ isPinned }`;
  - update local saved-view state on success;
  - surface mutation errors consistently with existing saved-view errors.
- Wire toolbar `pinChange` to project page mutation handling.
- Keep project saved-view mutations disabled for archived projects.
- Preserve project filters, copy links, CSV export, pagination, and detail return URLs.
- Add or update page tests for:
  - pinned shared project shortcuts render;
  - pinned personal project shortcuts render;
  - opening a pinned project shortcut updates canonical project query params;
  - owner/maintainer can pin/unpin shared project views;
  - contributor can open shared project pins but cannot pin/unpin them;
  - personal owner can pin/unpin personal project views;
  - archived project shows existing pins but exposes no pin/unpin controls;
  - API errors are shown without corrupting local saved-view state.

Out of scope:

- Workspace page changes beyond shared utilities.
- Playwright smoke.
- Public documentation.

Acceptance criteria:

- Project users can open pinned project saved views without opening the manager.
- Active project pin/unpin changes persist through the API.
- Archived projects remain read-only for saved-view mutation.
- Existing project saved-view workflows remain compatible.

Suggested commands:

```sh
npm test --workspace @worktrail/web -- --include "**/work-item-list-page.component.spec.ts"
npm test --workspace @worktrail/web -- --include "**/saved-views-toolbar.component.spec.ts"
npm test --workspace @worktrail/web -- --include "**/worktrail-api.service.spec.ts"
npm run typecheck --workspace @worktrail/web
npm run lint --workspace @worktrail/web
git diff --check
```

## Phase 8: Seeded Browser Smoke

Goal: verify the user-visible pinned saved-view workflow in a browser using deterministic local data.

Scope:

- Ensure seeded shared workspace pins exist and produce useful results.
- Ensure seeded shared project pins exist and produce useful results.
- Extend Playwright smoke coverage for:
  - workspace Work Items page shows pinned shared shortcuts;
  - opening a workspace pinned shortcut applies the saved query;
  - project Work page shows pinned shared shortcuts;
  - opening a project pinned shortcut applies the saved query;
  - creating or using a personal saved view can be pinned and then opened from the shortcuts area;
  - contributor can open shared pins but does not see shared pin/unpin controls.
- Preserve existing saved-view smoke coverage.
- Record manual QA observations when executing the phase.

Out of scope:

- Exhaustive browser coverage for every permission path.
- Visual snapshot testing.
- Release docs.

Acceptance criteria:

- Browser smoke covers seeded shared pins and at least one personal pin path.
- Full Playwright suite passes.
- Database restore behavior remains deterministic.

Suggested commands:

```sh
npm run db:reset
npm run db:migrate
npm run db:seed
npx playwright test -g "pinned"
npm run test:e2e
git diff --check
```

## Phase 9: Documentation, Site, Release Notes, Pattern Notes, And Final Verification

Goal: finish v0.1.5 with complete docs, public-site updates as appropriate, release notes, destination-neutral pattern notes, and full verification.

Scope:

- Update `README.md` with:
  - pinned saved views;
  - personal versus shared pinned views;
  - workspace versus project pinned views;
  - owner/maintainer/contributor behavior;
  - archived project read-only behavior.
- Update `site/index.html` if pinned operating views are polished enough to mention publicly.
- Add `docs/v0.1.5/release-notes.md`.
- Add `docs/v0.1.5/pattern-extraction-notes.md`.
- Keep pattern notes destination-neutral and avoid naming a future extraction target.
- Confirm `docs/api/openapi.yaml` is updated.
- Run full verification:
  - lint;
  - typecheck;
  - reset/migrate/seed;
  - unit tests;
  - production build;
  - Playwright smoke.
- Confirm no generated artifacts are unintentionally included.
- Confirm repository status before handoff.

Out of scope:

- Creating the release tag unless explicitly requested.
- Publishing/deploying beyond existing workflows unless explicitly requested.

Acceptance criteria:

- README and public site accurately describe shipped pinned operating views.
- Release notes summarize v0.1.5 capabilities and verification.
- Pattern extraction notes capture reusable saved-query shortcut lessons without claiming a framework abstraction is ready.
- Full verification passes or failures are documented with specific residual risk.
- Sprint docs do not reintroduce framework-specific extraction references.
- Worktree status is understood.

Suggested commands:

```sh
npm run lint
npm run typecheck
npm run db:reset
npm run db:migrate
npm run db:seed
npm test
npm run build
npm run test:e2e
git status --short --branch
git diff --check
```

## Verification Cadence

Use focused verification during implementation and full verification during finalization:

- Run contract tests immediately after shared contract changes.
- Run reset/migrate/seed after schema and seed changes.
- Run focused API tests after service and endpoint changes.
- Run focused web tests after component and page changes.
- Run Playwright after seeded data and UI wiring are in place.
- Run full lint, typecheck, tests, build, and e2e before final handoff.

## Deferred Items

Do not include these in v0.1.5 unless the implementation exposes a small, necessary prerequisite:

- Custom pinned-view ordering.
- Saved-view folders.
- Saved-view icons, colors, or descriptions.
- Pin limits or quotas.
- Pin analytics.
- Short links for pinned views.
- Generic saved-view framework extraction.
- Saved views for boards, planning, My Work, or Inbox.
- Custom saved-view permission grants.
- Ownership transfer.
