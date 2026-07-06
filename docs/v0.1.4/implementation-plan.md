# Worktrail v0.1.4 Implementation Plan

## Purpose

This plan turns the v0.1.4 PRD and technical design into sequential implementation phases. v0.1.4 should add project-scoped saved work views while preserving existing workspace saved views, personal saved views, canonical query behavior, copy links, CSV export alignment, and role-aware shared-view management.

The release remains local-first. It should preserve Angular static-hosting compatibility, transport-neutral API handlers, the local Express adapter, Postgres persistence, deterministic seed data, checked-in OpenAPI docs, CI verification with a disposable Postgres service, and clean local setup from a fresh checkout.

## Design Decisions

Use these decisions while implementing v0.1.4:

- Add explicit saved-view `scope: 'workspace' | 'project'`.
- Keep saved-view `visibility: 'personal' | 'workspace'`.
- Interpret `visibility: 'workspace'` as "shared" inside either workspace or project scope.
- Default omitted `scope` to `workspace`.
- Default omitted `visibility` to `personal`.
- Use the existing saved-view route surface with optional list query params.
- Add `scope` and `projectId` to create requests.
- Do not allow update requests to change `scope`, `projectId`, or `visibility`.
- Block project-scoped saved-view create/update/delete when the project is archived.
- Keep existing workspace activity for workspace-scoped shared views.
- Add project activity for project-scoped shared views.
- Keep contributors able to create personal project views but unable to manage shared project views.
- Reuse the saved-view toolbar with scope-aware inputs.
- Defer pinned views, ordering, folders, rich metadata, ownership transfer, custom permissions, and generic `jawstack` extraction.
- Avoid new frontend, backend, or infrastructure dependencies.

## Phase Sizing

Each phase should leave the repository in a coherent working state. This release touches shared contracts, Drizzle schema and migrations, saved-view repository/service behavior, endpoint query parsing, project activity events, OpenAPI, seed data, Angular API client shape, reusable saved-view UI, project Work page integration, Playwright smoke, and release documentation.

Implementation phases:

1. baseline planning;
2. contracts and migration;
3. repository and service scope behavior;
4. endpoint validation, API tests, and OpenAPI;
5. seed data and project activity display;
6. saved-view toolbar scope-aware UI;
7. project Work page integration;
8. workspace compatibility and regression hardening;
9. Playwright smoke and manual QA pass;
10. documentation, site, release notes, extraction notes, and final verification.

Run focused contract/API tests after backend work, focused web tests after frontend phases, and full verification during finalization.

## Phase 0: Baseline Planning

Goal: confirm v0.1.4 planning inputs and repository state before runtime changes.

Scope:

- Confirm `docs/v0.1.4/prd.md` exists.
- Confirm `docs/v0.1.4/technical-design.md` exists.
- Confirm `docs/v0.1.4/implementation-plan.md` exists.
- Confirm active branch and repository status.
- Confirm no unresolved technical choice blocks Phase 1.
- Confirm v0.1.2 and v0.1.3 query-artifact notes remain available as source material.

Out of scope:

- Runtime implementation.
- Database migration.
- Contract changes.
- UI changes.

Acceptance criteria:

- v0.1.4 planning inputs exist.
- Design decisions are recorded.
- Worktree/index state is understood before implementation starts.
- No open decision blocks Phase 1.

Suggested commands:

```sh
find docs/v0.1.4 -maxdepth 1 -type f | sort
test -f docs/v0.1.2/jawstack-extraction-notes.md
test -f docs/v0.1.3/jawstack-extraction-notes.md
git status --short --branch
git diff --check
```

Status:

- Completed on 2026-07-06.
- Confirmed v0.1.4 planning inputs exist:
  - `docs/v0.1.4/prd.md`;
  - `docs/v0.1.4/technical-design.md`;
  - `docs/v0.1.4/implementation-plan.md`.
- Confirmed v0.1.2 and v0.1.3 query-artifact extraction notes remain available as source material.
- Confirmed implementation decisions:
  - add explicit saved-view `scope: 'workspace' | 'project'`;
  - keep `visibility: 'personal' | 'workspace'`;
  - use the existing saved-view route surface with optional list query params;
  - default omitted scope to workspace and omitted visibility to personal;
  - add project activity for project-scoped shared-view management;
  - block project-scoped saved-view mutations when the project is archived;
  - reuse the saved-view toolbar with scope-aware inputs;
  - defer pinning, ordering, folders, rich metadata, custom permissions, and generic `jawstack` extraction.
- Confirmed active branch is `v0.1.4`.
- Confirmed current change state:
  - only `docs/v0.1.4/` is untracked;
  - no runtime files have been changed yet.
- Verified `git diff --check`.
- No unresolved technical choice blocks Phase 1.

## Phase 1: Contracts And Database Migration

Goal: add saved-view scope to contracts and persistence while preserving v0.1.3 workspace-view behavior.

Scope:

- Update `packages/contracts/src/saved-work-views.ts`:
  - add `SavedWorkViewScope = 'workspace' | 'project'`;
  - add `scope` and nullable `projectId` to `SavedWorkViewDto`;
  - add `ListSavedWorkViewsQuery`;
  - add optional `scope` and `projectId` to `CreateSavedWorkViewRequest`.
- Update contract tests for:
  - workspace-scoped DTO;
  - project-scoped DTO;
  - create request with project scope;
  - backward-compatible create request without scope.
- Add API domain constants for saved-view scopes.
- Add project activity event types for saved-view management:
  - `saved_view.created`;
  - `saved_view.name_changed`;
  - `saved_view.query_changed`;
  - `saved_view.updated`;
  - `saved_view.deleted`.
- Update Drizzle schema:
  - `scope` column with default `workspace`;
  - nullable `projectId`;
  - scope enum check;
  - scope/project consistency check;
  - scope-aware unique indexes;
  - read indexes.
- Generate and review a Drizzle migration.
- Confirm existing workspace saved views survive reset/migrate/seed.

Out of scope:

- API endpoint behavior changes.
- Project saved-view seed data.
- Angular UI.
- OpenAPI.

Acceptance criteria:

- Contracts compile with `SavedWorkViewScope`.
- Migration applies cleanly from reset.
- Existing saved views become workspace-scoped with `projectId = null`.
- Workspace personal/shared uniqueness is preserved.
- Project personal/shared uniqueness can be represented by the schema.

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
- Updated shared contracts:
  - added `SavedWorkViewScope = 'workspace' | 'project'`;
  - added `projectId` and `scope` to `SavedWorkViewDto`;
  - added `ListSavedWorkViewsQuery`;
  - added optional `scope` and `projectId` to `CreateSavedWorkViewRequest`.
- Updated contract tests for workspace-scoped and project-scoped saved-view request/DTO shapes.
- Updated existing web saved-view test fixtures for the new required DTO fields.
- Added saved-view management event types to project activity contracts/constants.
- Added API domain constants for saved-view scopes.
- Updated Drizzle schema:
  - added `saved_work_views.scope` with default `workspace`;
  - added nullable `saved_work_views.project_id`;
  - added scope and scope/project consistency checks;
  - replaced v0.1.3 saved-view unique indexes with scope-aware personal/shared indexes;
  - added workspace/project scope read indexes.
- Generated `apps/api/drizzle/0008_careless_silver_fox.sql` and snapshot metadata.
- Updated API saved-view DTO mapping for `scope` and `projectId`.
- Verified existing seeded saved views remain workspace-scoped after reset/migrate/seed:
  - 12 personal workspace-scoped views;
  - 5 shared workspace-scoped views;
  - all with `project_id` null.
- Verified:
  - `npm test --workspace @worktrail/contracts`
  - `npm run typecheck --workspace @worktrail/contracts`
  - `npm run db:reset`
  - `npm run db:migrate`
  - `npm run db:seed`
  - `npm run typecheck --workspace @worktrail/api`
  - `npm test --workspace @worktrail/api -- saved-work-views.test.ts`
  - `npm run typecheck --workspace @worktrail/web`
  - `git diff --check`

## Phase 2: Repository And Service Scope Behavior

Goal: implement saved-view scope, project authorization, query shaping, and activity behavior behind the service layer.

Scope:

- Extend saved-view repository methods to accept:
  - `scope`;
  - optional `projectId`.
- Ensure repository list/find methods never mix workspace and project scopes.
- Add name lookup methods that enforce scope-aware personal/shared uniqueness.
- Update DTO mapping to include `scope` and `projectId`.
- Update `SavedWorkViewService`:
  - list visible views by scope;
  - resolve workspace/project scope;
  - validate project ownership by workspace;
  - block project mutations for archived projects;
  - preserve personal owner-only update/delete behavior;
  - preserve owner/maintainer shared-view management behavior;
  - allow contributors to manage their own personal project views;
  - reject contributor shared project-view mutations;
  - normalize saved-view query by scope.
- Add a scope-aware query helper:
  - workspace scope preserves workspace-supported fields;
  - project scope strips `projectId` and `archivedProjects`.
- Emit workspace activity for workspace-scoped shared views.
- Emit project activity for project-scoped shared views.
- Avoid activity for personal saved-view changes.

Out of scope:

- Endpoint query parsing.
- OpenAPI docs.
- Frontend integration.
- Seeded project saved views.

Acceptance criteria:

- Service supports workspace and project scopes.
- Existing workspace saved-view workflows remain compatible.
- Project saved-view permission rules match the technical design.
- Project-scoped saved-view mutations on archived projects are rejected.
- Shared project-view management emits project activity only.

Suggested commands:

```sh
npm test --workspace @worktrail/api -- saved-work-views.test.ts
npm test --workspace @worktrail/api -- activity.test.ts
npm run typecheck --workspace @worktrail/api
git diff --check
```

Status:

- Completed on 2026-07-06.
- Extended the saved-view repository with scope-aware methods:
  - visible list queries by workspace/project scope;
  - personal name lookup by scope;
  - shared name lookup by scope.
- Preserved compatibility wrappers for existing workspace saved-view repository call sites.
- Updated `SavedWorkViewService` to:
  - default list/create behavior to workspace scope;
  - resolve workspace/project saved-view scope;
  - validate project ownership by workspace;
  - reject project-scoped saved-view create/update/delete on archived projects;
  - preserve personal owner-only mutation behavior;
  - preserve owner/maintainer shared-view management behavior;
  - allow contributors to manage their own personal project views;
  - reject contributor shared project-view mutations;
  - normalize saved-view queries by scope.
- Added scope-aware query shaping:
  - workspace saved views preserve workspace-supported query fields;
  - project saved views strip `projectId` and `archivedProjects`.
- Added shared project-view activity emission through project activity events.
- Preserved workspace activity emission for workspace-scoped shared views.
- Added focused service-level coverage in `apps/api/tests/saved-work-views.test.ts` for:
  - project-scoped shared and personal saved views;
  - workspace/project scope isolation;
  - contributor permissions;
  - project activity for shared project-view changes;
  - archived-project mutation rejection.
- Verified:
  - `npm test --workspace @worktrail/api -- saved-work-views.test.ts`
  - `npm test --workspace @worktrail/api -- comments-activity.test.ts`
  - `npm run typecheck --workspace @worktrail/api`
  - `npm run lint --workspace @worktrail/api`
  - `git diff --check`

## Phase 3: Endpoint Validation, API Tests, And OpenAPI

Goal: expose scope-aware saved-view behavior through the existing endpoint surface and document it.

Scope:

- Update saved-view endpoint list query parsing:
  - optional `scope`;
  - optional `projectId`.
- Validate:
  - omitted scope defaults to workspace;
  - workspace scope rejects project id;
  - project scope requires project id.
- Update create schema for optional `scope` and `projectId`.
- Keep update schema limited to `name` and `query`.
- Expand `apps/api/tests/saved-work-views.test.ts` for:
  - existing workspace list/create/update/delete compatibility;
  - workspace list excludes project-scoped views;
  - project list returns actor personal plus shared project views;
  - project list excludes other actors' personal project views;
  - project list rejects missing, unknown, and cross-workspace project ids;
  - owner and maintainer can create shared project views;
  - contributor cannot create shared project views;
  - contributor can create personal project views;
  - owner/maintainer can rename/update/delete shared project views;
  - contributor cannot update/delete shared project views;
  - personal project view owner can mutate own view;
  - non-owner personal project view access is not found;
  - duplicate names are scoped correctly;
  - project-scope query strips workspace-only fields;
  - archived projects allow list and reject mutations;
  - shared project-view mutations create project activity.
- Update `docs/api/openapi.yaml`:
  - `SavedWorkViewScope`;
  - list query params;
  - DTO `scope` and `projectId`;
  - create request `scope` and `projectId`;
  - permission and archived-project notes.

Out of scope:

- Angular UI.
- Seed data.
- Playwright smoke.

Acceptance criteria:

- Existing clients can still list workspace saved views without query params.
- Scope-aware endpoint behavior is covered by API tests.
- OpenAPI describes the implemented route surface.

Suggested commands:

```sh
npm test --workspace @worktrail/api -- saved-work-views.test.ts
npm run typecheck --workspace @worktrail/api
git diff --check
```

Status:

- Completed.
- Implemented scope-aware saved-view endpoint parsing for list and create requests.
- Preserved update requests as `name`/`query` only.
- Added HTTP coverage for workspace default listing, project listing, project query validation, project create/update/delete permissions, duplicate scoping, project-query normalization, archived-project behavior, and project activity logging.
- Updated OpenAPI with saved-view scope, list query parameters, DTO fields, create fields, and project mutation notes.
- Verified:
  - `npm test --workspace @worktrail/api -- saved-work-views.test.ts`
  - `npm test --workspace @worktrail/api -- openapi.test.ts`
  - `npm run typecheck --workspace @worktrail/api`
  - `npm run lint --workspace @worktrail/api`
  - `git diff --check`

## Phase 4: Seed Data And Project Activity Display

Goal: make project saved views visible in deterministic local data and readable in activity surfaces.

Scope:

- Add deterministic saved-view ids for project-scoped views.
- Seed shared project views for active projects, such as:
  - `Release blockers`;
  - `Ready for QA`;
  - `Unassigned project work`;
  - `Current milestone risk`;
  - `Open dependency risks`.
- Seed at least one personal project view for active seeded members.
- Ensure seed views:
  - use `scope: 'project'`;
  - include the matching `projectId`;
  - use normalized project-supported query fields;
  - produce at least one visible shared-view result.
- Keep seed upsert idempotent.
- Add readable project activity labels for saved-view event types where activity is rendered.
- Add tests or extend existing project activity display tests for shared project-view activity labels.

Out of scope:

- Project page saved-view UI.
- E2E smoke.
- Public docs.

Acceptance criteria:

- `npm run db:seed` inserts deterministic project saved views.
- Re-running seed is stable.
- Project activity can render shared saved-view events clearly.
- No workspace activity is created for seeded project views unless seed intentionally inserts historical activity.

Suggested commands:

```sh
npm run db:reset
npm run db:migrate
npm run db:seed
npm test --workspace @worktrail/api -- saved-work-views.test.ts
npm test --workspace @worktrail/web -- --include "**/project*.spec.ts"
npm run typecheck
git diff --check
```

Status:

- Completed.
- Added deterministic project-scoped saved-view ids and seed rows for active projects.
- Seeded shared project views for:
  - `Release blockers`;
  - `Ready for QA`;
  - `Unassigned project work`;
  - `Current milestone risk`;
  - `Open dependency risks`.
- Seeded a personal project view for the owner in the app project.
- Kept seeded project saved-view queries limited to project-supported fields.
- Updated saved-view seed upserts to persist `projectId`, `scope`, `visibility`, `query`, and timestamps idempotently.
- Added readable project activity labels for shared project saved-view events.
- Added a project settings component test for shared project saved-view activity labels.
- Verified:
  - `npm run db:seed`
  - `npm run db:seed`
  - `npm test --workspace @worktrail/api -- saved-work-views.test.ts`
  - `npm test --workspace @worktrail/web -- --include "**/projects-page.component.spec.ts"`
  - `npm run typecheck`
  - `npm run lint`
  - project saved-view seed readback returned 8 project-scoped views and 0 workspace saved-view activity rows
  - app project shared-view result readback returned visible work items for all five seeded shared project views
  - `git diff --check`

## Phase 5: Saved-View Toolbar Scope-Aware UI

Goal: make the existing saved-view toolbar reusable for workspace and project saved-view surfaces.

Scope:

- Update `SavedViewsToolbarComponent` with scope-aware inputs:
  - query summary scope;
  - empty message;
  - shared helper copy;
  - shared/personal section labels if needed;
  - shared-management capability input.
- Rename `workspaceViews`/`canManageWorkspaceViews` to shared-view language if low churn.
- Preserve compatibility aliases if that keeps the phase smaller.
- Ensure saved-view summary counts use:
  - `meaningfulWorkItemQueryFieldCount(query, 'workspace')` for workspace;
  - `meaningfulWorkItemQueryFieldCount(query, 'project')` for project.
- Add/adjust component tests for:
  - existing workspace copy and behavior;
  - project-specific empty/helper copy;
  - project summary count behavior;
  - contributor read-only shared controls;
  - personal view controls remain available.

Out of scope:

- API client changes.
- Project page integration.
- Backend changes.

Acceptance criteria:

- Workspace saved-view toolbar tests still pass.
- Project-scoped toolbar rendering can be tested without route context.
- The component does not know project id or route behavior.

Suggested commands:

```sh
npm test --workspace @worktrail/web -- --include "**/saved-views-toolbar.component.spec.ts"
npm run typecheck --workspace @worktrail/web
git diff --check
```

Status:

- Completed.
- Added scope-aware toolbar inputs for:
  - query summary scope;
  - empty state title/message;
  - shared helper copy;
  - shared/personal section labels and empty messages;
  - shared-management capability;
  - save button labels and placeholder copy.
- Renamed the primary toolbar inputs to shared-view language:
  - `sharedViews`;
  - `canManageSharedViews`.
- Preserved compatibility aliases for:
  - `workspaceViews`;
  - `canManageWorkspaceViews`.
- Added a neutral `saveShared` output while preserving `saveWorkspace`.
- Updated workspace Work Items toolbar binding to the shared-view input names.
- Updated query summaries to call `meaningfulWorkItemQueryFieldCount` with the configured `workspace` or `project` scope.
- Added component coverage for:
  - existing workspace behavior;
  - project-specific helper/empty/section copy;
  - project summary count behavior;
  - read-only shared controls for contributors;
  - personal controls remaining available.
- Verified:
  - `npm test --workspace @worktrail/web -- --include "**/saved-views-toolbar.component.spec.ts"`
  - `npm run typecheck --workspace @worktrail/web`
  - `npm run lint --workspace @worktrail/web`
  - `git diff --check`

## Phase 6: Project Work Page Integration

Goal: add saved-view loading, saving, opening, mutation, and permission-aware UI to project Work pages.

Scope:

- Update web API client:
  - `listSavedWorkViews(query?: ListSavedWorkViewsQuery)`;
  - serialize non-empty list params.
- Update `WorktrailApiService` saved-view forwarding methods.
- Add saved-view state to `WorkItemListPageComponent`:
  - `savedViews`;
  - personal/shared computed groups;
  - draft names;
  - load/mutation errors;
  - saving state.
- Load project saved views with:
  - `scope=project`;
  - current `projectId`.
- Render `SavedViewsToolbarComponent` on the project Work page.
- Create personal project views from applied project query.
- Create shared project views from applied project query for owners/maintainers on active projects.
- Open project saved views through canonical project route query params.
- Rename, update-query, and delete project saved views.
- Prevent shared project-view mutation controls for contributors.
- Prevent project saved-view create/update/delete controls on archived projects.
- Keep existing project filters, active chips, copy links, detail return URLs, and CSV export behavior unchanged.
- Add page/API-client tests for:
  - list request query params;
  - personal project view create/open/update/delete;
  - shared project view create/open/update/delete;
  - contributor read-only shared project views;
  - archived project mutation controls unavailable;
  - applied query used for save/update.

Out of scope:

- Workspace page refactor beyond shared API/client updates.
- Playwright smoke.
- Public docs.

Acceptance criteria:

- Project Work page shows shared and personal saved views.
- Opening a project saved view updates canonical project URL params.
- Project saved-view mutations call the API with `scope: 'project'` and `projectId`.
- Existing project list behavior remains intact.

Suggested commands:

```sh
npm test --workspace @worktrail/web -- --include "**/work-items-page.component.spec.ts"
npm test --workspace @worktrail/web -- --include "**/worktrail-api.service.spec.ts"
npm run typecheck --workspace @worktrail/web
git diff --check
```

Status:

- Completed.
- Updated the web saved-view API client and `WorktrailApiService` forwarding method to accept `ListSavedWorkViewsQuery` and serialize non-empty `scope`/`projectId` params.
- Added project-scoped saved-view state to `WorkItemListPageComponent`:
  - saved views;
  - personal/shared computed groups;
  - draft names;
  - loading and mutation errors;
  - saving state.
- Loaded project saved views with `scope=project` and the current project id.
- Rendered `SavedViewsToolbarComponent` on the project Work page with project-specific copy and project query summaries.
- Created personal and shared project saved views from the applied project query.
- Opened saved views through canonical project route params.
- Added rename, update-query, and delete behavior for project saved views.
- Blocked shared project-view mutation controls for contributors.
- Blocked saved-view create/update/delete controls on archived projects while preserving open-only access.
- Extended the toolbar with `canManagePersonalViews` and read-only rendering so archived project saved views can remain visible without mutation controls.
- Added tests for:
  - scoped saved-view list query params;
  - personal project saved-view create/open behavior;
  - shared project saved-view create/rename/update/delete behavior;
  - contributor read-only shared project saved views;
  - archived project open-only saved views;
  - applied query usage for save/update.
- Verified:
  - `npm test --workspace @worktrail/web -- --include "**/work-items-page.component.spec.ts"`
  - `npm test --workspace @worktrail/web -- --include "**/worktrail-api.service.spec.ts"`
  - `npm test --workspace @worktrail/web -- --include "**/saved-views-toolbar.component.spec.ts"`
  - `npm run typecheck --workspace @worktrail/web`
  - `npm run lint --workspace @worktrail/web`
  - `git diff --check`

## Phase 7: Workspace Compatibility And Regression Hardening

Goal: ensure workspace saved views still behave exactly as v0.1.3 after scope-aware changes.

Scope:

- Update `WorkspaceWorkItemListPageComponent` as needed:
  - explicitly list `scope=workspace` or rely on default intentionally;
  - create with explicit `scope: 'workspace'` if clearer;
  - pass workspace summary scope and copy into the toolbar.
- Update workspace saved-view tests for any renamed toolbar inputs or API list params.
- Verify:
  - workspace list excludes project views;
  - workspace personal saved views still create/open/rename/update/delete;
  - workspace shared saved views still create/open/rename/update/delete;
  - contributor can still open shared workspace views but cannot manage them;
  - dependency filters still survive saved views and export.
- Add low-cost regression tests if gaps appear during implementation.

Out of scope:

- New product behavior.
- E2E smoke.
- Documentation.

Acceptance criteria:

- v0.1.3 workspace saved-view behavior remains compatible.
- Workspace and project saved-view tests can run together without state leakage.

Suggested commands:

```sh
npm test --workspace @worktrail/web -- --include "**/workspace-work-item-list-page.component.spec.ts"
npm test --workspace @worktrail/web -- --include "**/saved-views-toolbar.component.spec.ts"
npm test --workspace @worktrail/api -- saved-work-views.test.ts
npm run typecheck
git diff --check
```

## Phase 8: Playwright Smoke And Manual QA Pass

Goal: verify the user-visible project saved-view workflow in a browser and preserve existing smoke coverage.

Scope:

- Add or extend Playwright smoke coverage:
  - open an active project Work page;
  - open a seeded shared project view;
  - confirm active chips and result row;
  - save a personal project view;
  - reload and reopen it;
  - switch to contributor;
  - confirm shared project view remains visible/openable;
  - confirm shared management controls are unavailable.
- Preserve existing workspace shared-view smoke.
- Run focused Playwright test for project saved views.
- Run full Playwright smoke suite.
- Document any manual QA observations in the phase status when executing.

Out of scope:

- Exhaustive browser coverage for all API permission paths.
- Release docs.

Acceptance criteria:

- Browser smoke covers one useful project saved-view path.
- Full Playwright suite passes.
- Seed restore behavior still leaves local data deterministic.

Suggested commands:

```sh
npm run db:reset
npm run db:migrate
npm run db:seed
npx playwright test -g "project saved view"
npm run test:e2e
git diff --check
```

## Phase 9: Documentation, Site, Release Notes, Extraction Notes, And Final Verification

Goal: finish v0.1.4 with complete docs, public-site updates as appropriate, release notes, extraction notes, and full verification.

Scope:

- Update `README.md` with:
  - project saved views;
  - workspace versus project saved-view scope;
  - personal versus shared project views;
  - owner/maintainer/contributor behavior;
  - archived-project behavior;
  - relationship to project URLs, copy links, and CSV export.
- Update `site/index.html` if project saved views are polished enough to mention publicly.
- Add `docs/v0.1.4/release-notes.md`.
- Add `docs/v0.1.4/jawstack-extraction-notes.md`.
- Preserve v0.1.2 and v0.1.3 query-artifact notes as source material.
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

- README and public site accurately describe the shipped capability.
- Release notes summarize v0.1.4 capabilities and verification.
- Extraction notes capture scoped saved query artifacts without claiming a framework abstraction is ready.
- Full verification passes or failures are documented with specific residual risk.
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

Use this cadence unless a phase requires broader checks:

- Planning phase: file existence, branch/status, whitespace check.
- Contract/migration phase: contracts tests, migration reset/migrate/seed, API typecheck.
- Backend phase: focused saved-view API tests and API typecheck.
- Frontend component phase: focused component tests and web typecheck.
- Frontend page phase: focused page/API-client tests and web typecheck.
- E2E phase: reset/migrate/seed, focused Playwright smoke, full Playwright smoke.
- Final phase: lint, typecheck, reset/migrate/seed, tests, build, and E2E.

Prefer focused checks while iterating, then broaden before closing each phase.

## Deferred Items

Defer these unless the user explicitly changes scope:

- pinned saved views;
- manual saved-view ordering;
- saved-view folders;
- saved-view icons, colors, descriptions, and rich metadata;
- saved-view ownership transfer;
- custom saved-view permissions;
- project-specific membership;
- saved views on Board, Planning, My Work, and Inbox;
- short links;
- native share sheets;
- saved-view analytics;
- advanced query-builder UI;
- server-side pagination;
- full-text search infrastructure;
- production authentication;
- multi-workspace membership;
- generic `jawstack` saved-view abstraction;
- new third-party dependencies.
