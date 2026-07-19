# Worktrail v0.1.4 Technical Design

## Overview

Worktrail v0.1.4 adds project-scoped saved work views to the existing saved-view model.

v0.1.3 proved shared saved views for workspace discovery. v0.1.4 should extend that pattern to project Work pages by adding an explicit saved-view scope:

- `workspace`: the existing top-level Work Items saved views;
- `project`: saved views attached to one project Work page.

Visibility remains `personal | workspace`. In project scope, `visibility: 'workspace'` means "shared with the workspace inside this project context." This preserves the v0.1.3 contract and avoids introducing a third visibility term that would mostly duplicate authorization behavior.

The implementation remains app-local. It should not introduce a generic saved-view framework, new backend dependencies, project-specific membership, saved-view pinning, folders, or custom permissions.

## Resolved Decisions

- Add explicit saved-view `scope: 'workspace' | 'project'`.
- Keep `visibility: 'personal' | 'workspace'`.
- Treat `workspace + workspace` as a workspace-shared discovery view.
- Treat `project + workspace` as a shared project view.
- Preserve owner attribution on every saved view.
- Default omitted `scope` to `workspace` for backward compatibility.
- Default omitted `visibility` to `personal` for backward compatibility.
- Use `GET /api/saved-work-views` with optional query params instead of adding separate routes:
  - no query params returns workspace-scoped visible views;
  - `?scope=workspace` returns workspace-scoped visible views;
  - `?scope=project&projectId=<uuid>` returns project-scoped visible views.
- Add `scope` and `projectId` to create requests.
- Do not allow changing `scope`, `projectId`, or `visibility` through update.
- Block all project-scoped saved-view mutations when the project is archived. Existing project saved views remain readable/openable.
- Add project activity for shared project-view management.
- Keep workspace activity for workspace-scoped shared-view management.
- Defer pinned views, ordering, folders, icons, colors, descriptions, ownership transfer, custom permissions, and saved-view analytics.
- Reuse the existing saved-view toolbar by adding scope-aware labels and query summary mode rather than creating a separate component.

## Current Architecture

Saved views are currently workspace-scoped implicitly:

- `SavedWorkViewDto` has `workspaceId`, `owner`, `name`, `visibility`, `query`, timestamps.
- `saved_work_views` stores workspace id, owner member id, name, visibility, and query JSONB.
- API list returns current actor personal views plus workspace-shared views.
- API create/update/delete enforces personal owner rules and owner/maintainer shared-view rules.
- `WorkspaceWorkItemListPageComponent` owns saved-view loading, mutation, canonical URL navigation, and grouping.
- `SavedViewsToolbarComponent` renders shared and personal sections.
- Project Work pages already have canonical project query params, active chips, copy-link support, and applied-filter CSV export.

v0.1.4 should extend this path. Avoid a parallel "project saved views" subsystem.

## Contract Design

Update `packages/contracts/src/saved-work-views.ts`.

Recommended shape:

```ts
export type SavedWorkViewVisibility = 'personal' | 'workspace';
export type SavedWorkViewScope = 'workspace' | 'project';

export interface SavedWorkViewDto {
  id: string;
  workspaceId: string;
  projectId: string | null;
  owner: MemberDto;
  name: string;
  scope: SavedWorkViewScope;
  visibility: SavedWorkViewVisibility;
  query: WorkItemQuery;
  createdAt: string;
  updatedAt: string;
}

export interface ListSavedWorkViewsQuery {
  scope?: SavedWorkViewScope;
  projectId?: string;
}

export interface CreateSavedWorkViewRequest {
  name: string;
  query: WorkItemQuery;
  scope?: SavedWorkViewScope;
  projectId?: string;
  visibility?: SavedWorkViewVisibility;
}

export interface UpdateSavedWorkViewRequest {
  name?: string;
  query?: WorkItemQuery;
}
```

Compatibility rules:

- Existing clients that omit `scope` create workspace-scoped saved views.
- Existing clients that omit `visibility` create personal saved views.
- Existing DTO consumers must tolerate the new `scope` and `projectId` fields after type updates.

Do not add a separate `project` visibility. The visibility value describes audience, and the new scope describes where the view belongs.

## Database Design

### Schema

Add domain constants:

```ts
export const savedWorkViewScopes = ['workspace', 'project'] as const;
```

Add columns to `saved_work_views`:

- `scope text not null default 'workspace'`;
- `project_id uuid null references projects(id)`.

Add constraints:

- `scope in ('workspace', 'project')`;
- workspace-scoped views must have `project_id is null`;
- project-scoped views must have `project_id is not null`.

Recommended check:

```sql
check (
  (scope = 'workspace' and project_id is null)
  or
  (scope = 'project' and project_id is not null)
)
```

### Indexes

Replace v0.1.3 name unique indexes with scope-aware partial indexes.

Recommended indexes:

```sql
create unique index saved_work_views_workspace_personal_name_unique
  on saved_work_views (workspace_id, owner_member_id, lower(name))
  where scope = 'workspace' and visibility = 'personal';

create unique index saved_work_views_workspace_shared_name_unique
  on saved_work_views (workspace_id, lower(name))
  where scope = 'workspace' and visibility = 'workspace';

create unique index saved_work_views_project_personal_name_unique
  on saved_work_views (workspace_id, project_id, owner_member_id, lower(name))
  where scope = 'project' and visibility = 'personal';

create unique index saved_work_views_project_shared_name_unique
  on saved_work_views (workspace_id, project_id, lower(name))
  where scope = 'project' and visibility = 'workspace';
```

Recommended read indexes:

```sql
create index saved_work_views_workspace_scope_updated_idx
  on saved_work_views (workspace_id, scope, updated_at desc);

create index saved_work_views_project_scope_updated_idx
  on saved_work_views (workspace_id, project_id, scope, updated_at desc)
  where scope = 'project';
```

Existing rows are backfilled by the default `scope = 'workspace'` and `project_id = null`.

## API Endpoint Design

Keep the existing route surface:

- `GET /api/saved-work-views`
- `POST /api/saved-work-views`
- `PATCH /api/saved-work-views/:savedViewId`
- `DELETE /api/saved-work-views/:savedViewId`

### List

Add query parsing:

```http
GET /api/saved-work-views
GET /api/saved-work-views?scope=workspace
GET /api/saved-work-views?scope=project&projectId=<uuid>
```

Rules:

- omitted `scope` means `workspace`;
- `scope=workspace` must not include `projectId`;
- `scope=project` requires `projectId`;
- `projectId` must belong to the current workspace;
- archived projects can still list saved views.

### Create

Payload examples:

```json
{
  "name": "Ready for QA",
  "scope": "project",
  "projectId": "00000000-0000-4000-8000-000000000000",
  "visibility": "workspace",
  "query": { "status": "ready", "type": "bug" }
}
```

Rules:

- omitted `scope` means `workspace`;
- omitted `visibility` means `personal`;
- workspace scope must not include `projectId`;
- project scope requires a valid active project;
- archived projects reject project-scoped create;
- contributors can create personal project views;
- contributors cannot create shared project views;
- query is normalized with scope-aware rules.

### Update

Only `name` and `query` remain mutable.

Rules:

- `scope`, `projectId`, and `visibility` cannot be changed;
- project-scoped views require the associated project to still exist in the workspace;
- archived projects reject project-scoped update;
- personal views require owner;
- shared views require owner/maintainer;
- query is normalized with the saved view's existing scope.

### Delete

Rules:

- archived projects reject project-scoped delete;
- personal views require owner;
- shared views require owner/maintainer;
- deleting a shared workspace view records workspace activity;
- deleting a shared project view records project activity.

## Repository Design

Extend `createSavedWorkViewRepository`.

Recommended methods:

```ts
listVisible(input: {
  workspaceId: string;
  ownerMemberId: string;
  scope: SavedWorkViewScope;
  projectId?: string;
}): Promise<SavedWorkView[]>;

findPersonalByOwnerAndName(input: {
  workspaceId: string;
  ownerMemberId: string;
  scope: SavedWorkViewScope;
  projectId?: string;
  name: string;
}): Promise<SavedWorkView | null>;

findSharedByName(input: {
  workspaceId: string;
  scope: SavedWorkViewScope;
  projectId?: string;
  name: string;
}): Promise<SavedWorkView | null>;
```

`listVisible` should return:

- matching-scope personal views for the current actor;
- matching-scope shared views.

It must not mix workspace and project scopes.

Keep sorting in the repository as `updatedAt desc`. UI can apply alphabetical sorting inside each group if that remains more scannable.

## Service Design

`SavedWorkViewService` remains the owner of authorization, scope validation, query normalization, owner hydration, conflict checks, and activity emission.

### Scope Resolution

Add a helper that resolves scope inputs:

```ts
private async resolveScope(input: {
  scope?: SavedWorkViewScope;
  projectId?: string;
  requireMutableProject?: boolean;
}): Promise<ResolvedSavedViewScope>
```

Recommended resolved shape:

```ts
interface ResolvedSavedViewScope {
  scope: 'workspace' | 'project';
  project: Project | null;
}
```

Rules:

- default scope is `workspace`;
- workspace scope requires `projectId` to be absent;
- project scope requires `projectId`;
- project must belong to actor workspace;
- when `requireMutableProject` is true, archived projects throw `ForbiddenError`.

### Query Normalization

Keep `normalizeWorkItemQuery` as the common validator, then add scope-specific shaping:

- workspace scope preserves workspace-supported fields, including `projectId` and `archivedProjects`;
- project scope strips workspace-only fields:
  - `projectId`;
  - `archivedProjects`.

Recommended helper:

```ts
function normalizeSavedViewQueryForScope(
  query: WorkItemQuery,
  scope: SavedWorkViewScope
): WorkItemQuery
```

For project scope, labels and milestones are project-owned in practice, but do not over-validate every referenced id in v0.1.4 unless existing work item query validation already does so. Stale saved views should remain readable and simply produce empty/no-result states where references no longer match.

### Listing

`listSavedViews(input)`:

- require active actor;
- resolve scope without mutability requirement;
- call repository `listVisible`;
- hydrate distinct owners;
- map to DTO.

### Create

`createSavedView(input)`:

- normalize name;
- default visibility;
- resolve scope with `requireMutableProject: input.scope === 'project'`;
- authorize shared visibility:
  - `visibility='workspace'` requires owner/maintainer;
  - `visibility='personal'` only requires active actor;
- check name uniqueness inside scope/visibility;
- normalize query for scope;
- create row with `scope` and `projectId`;
- emit activity only for shared views.

### Update

`updateSavedView(savedViewId, input)`:

- load saved view by id;
- ensure saved view workspace matches actor workspace;
- resolve the saved view's existing scope with mutability for project scope;
- authorize mutation:
  - personal owner only;
  - shared owner/maintainer;
- check name uniqueness inside existing scope/visibility;
- normalize query for existing scope;
- update row;
- emit one activity event for shared views.

Activity event choice:

- name only: `saved_view.name_changed`;
- query only: `saved_view.query_changed`;
- name and query: `saved_view.updated`.

### Delete

`deleteSavedView(savedViewId)`:

- load, resolve, and authorize like update;
- delete row;
- emit `saved_view.deleted` for shared views.

## Authorization Rules

Use existing workspace roles.

Rules:

- Active owners can manage shared workspace and shared project views.
- Active maintainers can manage shared workspace and shared project views.
- Active contributors can list/open shared workspace and shared project views.
- Active contributors can create and manage their own personal project views.
- Personal views can only be updated/deleted by their owner.
- Inactive members cannot act.
- Archived project saved views can be listed/opened but cannot be created, updated, or deleted.

Error behavior:

- Cross-actor personal views remain `NotFoundError`.
- Visible shared views return `ForbiddenError` when mutation is not allowed.
- Project not found or cross-workspace project returns `NotFoundError`.
- Archived project mutation returns `ForbiddenError`.
- Duplicate names return `ConflictError`.

Suggested messages:

- `A saved view with this name already exists in this scope.`
- `Archived projects do not allow saved view changes.`
- `Only owners and maintainers can manage shared saved views.`

## Activity Design

Workspace-scoped shared views keep v0.1.3 workspace activity.

Project-scoped shared views should create project activity:

- `saved_view.created`;
- `saved_view.name_changed`;
- `saved_view.query_changed`;
- `saved_view.updated`;
- `saved_view.deleted`.

Add these event types to `ActivityEventType` as project activity event types. The string values can match workspace activity event names because activity streams are separated by table/surface.

Suggested summaries:

- `{actor} created shared project view {name}.`
- `{actor} renamed shared project view {oldName} to {newName}.`
- `{actor} updated shared project view {name}.`
- `{actor} deleted shared project view {name}.`

Metadata:

- `savedViewId`;
- `scope: 'project'`;
- `visibility: 'workspace'`.

Avoid storing full query JSON in activity metadata unless implementation tests need it. Keep previous/new value compact:

```json
{
  "savedViewId": "...",
  "name": "Ready for QA",
  "scope": "project",
  "visibility": "workspace"
}
```

## DTO Mapping

Update `toSavedWorkViewDto`:

```ts
export function toSavedWorkViewDto(savedView: SavedWorkView, owner: Member): SavedWorkViewDto {
  return {
    id: savedView.id,
    workspaceId: savedView.workspaceId,
    projectId: savedView.projectId,
    owner: toMemberDto(owner),
    name: savedView.name,
    scope: savedView.scope,
    visibility: savedView.visibility,
    query: savedView.query as WorkItemQuery,
    createdAt: savedView.createdAt.toISOString(),
    updatedAt: savedView.updatedAt.toISOString()
  };
}
```

## Frontend API Design

Update `SavedViewsApi` and `WorktrailApiService`:

```ts
listSavedWorkViews(query?: ListSavedWorkViewsQuery): Observable<SavedWorkViewDto[]>;
createSavedWorkView(input: CreateSavedWorkViewRequest): Observable<SavedWorkViewDto>;
```

For list, serialize only non-empty params:

- no params for workspace default if desired;
- `scope=project&projectId=...` for project pages.

Existing workspace call sites can keep `listSavedWorkViews()` or move to `listSavedWorkViews({ scope: 'workspace' })`.

## Frontend Query Design

The project Work page should use existing helpers:

- `projectQueryFromFormValue`;
- `projectRouterQueryParamsFromQuery`;
- `projectFormValueFromQueryParams`;
- `returnUrlFromWorkItemQuery(..., 'project')`;
- `meaningfulWorkItemQueryFieldCount(query, 'project')`.

Opening a project saved view should navigate to:

```ts
this.router.navigate([], {
  relativeTo: this.route,
  queryParams: projectRouterQueryParamsFromQuery(savedView.query)
});
```

Creating/updating a project saved view should use `this.appliedQuery()`, not draft form values.

## Saved Views Toolbar Design

Reuse `SavedViewsToolbarComponent` with scope-aware copy.

Add inputs:

```ts
@Input() scopeLabel: 'workspace' | 'project' = 'workspace';
@Input() sharedSectionLabel = 'Shared views';
@Input() personalSectionLabel = 'Personal views';
@Input() emptyMessage = 'Save the current filters to reuse this workspace view.';
@Input() sharedHelper = 'Owners and maintainers manage shared saved views.';
@Input() querySummaryScope: 'workspace' | 'project' = 'workspace';
@Input() canCreatePersonalView = true;
@Input() canManageSharedViews = false;
```

Rename internal input names only if useful, but avoid a broad churn:

- `workspaceViews` can become `sharedViews`;
- `canManageWorkspaceViews` can become `canManageSharedViews`.

Keep backwards-compatible aliases if that reduces call-site churn during the sprint.

Save actions should still emit `SavedWorkViewVisibility`, because visibility remains unchanged.

The toolbar should not know project id or route behavior. Pages remain responsible for:

- choosing list scope;
- creating with `scope`/`projectId`;
- opening with scope-specific route params;
- authorization flags.

## Project Work Page Integration

Update `WorkItemListPageComponent`:

- import `SavedViewsToolbarComponent`;
- load project saved views after project id is known;
- store saved views and draft names similarly to `WorkspaceWorkItemListPageComponent`;
- derive:
  - `personalProjectSavedViews`;
  - `sharedProjectSavedViews`;
  - `canManageProjectSavedViews`;
- render toolbar above filter panel or between archived notice and filter panel;
- use project-specific toolbar copy:
  - heading remains `Saved views`;
  - count remains `<shared> shared · <personal> personal`;
  - empty message: `Save the current filters to reuse this project view.`;
  - helper: `Owners and maintainers manage shared project views.`;
- create personal project view with:

```ts
{
  name,
  scope: 'project',
  projectId: this.projectId(),
  visibility: 'personal',
  query: this.appliedQuery()
}
```

- create shared project view with `visibility: 'workspace'`;
- update query with current applied project query;
- open with `projectRouterQueryParamsFromQuery(savedView.query)`.

For archived projects:

- show existing saved views;
- allow `Open`;
- disable/hide save form and mutation actions with helper copy.

## Workspace Work Items Integration

Update `WorkspaceWorkItemListPageComponent` only as needed:

- call `listSavedWorkViews({ scope: 'workspace' })` or rely on default;
- create with `scope: 'workspace'` explicitly if that improves readability;
- pass toolbar `querySummaryScope="workspace"`;
- use renamed toolbar inputs if applicable.

Existing v0.1.3 behavior must remain unchanged.

## Seed Data

Add project-scoped saved view ids to seed data.

Suggested shared project views:

- `Release blockers`;
- `Ready for QA`;
- `Unassigned project work`;
- `Current milestone risk`;
- `Open dependency risks`.

Suggested personal project views:

- owner: `My project work`;
- maintainer: `Implementation follow-up`;
- contributor: `Ready for pickup`.

Seed requirements:

- project views reference active seeded projects;
- at least one shared view has visible seeded results;
- use deterministic ids;
- seed upsert updates name, scope, project id, visibility, query, and timestamps;
- repeated seed runs are idempotent.

Do not seed project views for archived projects in v0.1.4 unless a specific archived-read demo is needed.

## OpenAPI Design

Update `docs/api/openapi.yaml`:

- add `SavedWorkViewScope` schema;
- add `scope` and nullable `projectId` to `SavedWorkView`;
- add `scope` and `projectId` to `CreateSavedWorkViewRequest`;
- document `GET /api/saved-work-views` query params:
  - `scope`;
  - `projectId`;
- update descriptions for:
  - workspace default list behavior;
  - project-scoped list behavior;
  - shared project-view permission behavior;
  - archived-project mutation rejection.

## Testing Strategy

### Contracts

Update contract tests for:

- `SavedWorkViewScope`;
- DTO shape with `scope` and `projectId`;
- create request with `scope: 'project'`;
- backward-compatible create request without scope.

### API

Expand `apps/api/tests/saved-work-views.test.ts` for:

- existing workspace saved-view list/create/update/delete compatibility;
- workspace list excludes project-scoped views;
- project list returns actor personal project views plus shared project views;
- project list excludes other actors' personal project views;
- project list rejects missing `projectId`;
- project list rejects cross-workspace or unknown project;
- owner and maintainer can create shared project views;
- contributor cannot create shared project views;
- contributor can create personal project views;
- owner/maintainer can rename/update/delete shared project views;
- contributor cannot update/delete shared project views;
- personal project view owner can rename/update/delete their own view;
- personal project view non-owner gets not found;
- duplicate names are scoped correctly across workspace/project and personal/shared;
- project-scope query strips `projectId` and `archivedProjects`;
- archived projects allow list but reject create/update/delete;
- shared project-view mutations create project activity;
- personal project-view mutations do not create project activity.

### Web

Update or add component/page tests for:

- toolbar scope-aware labels and project summary count;
- workspace toolbar behavior remains unchanged;
- project page loads saved views with `scope=project&projectId=...`;
- project page creates personal and shared project views;
- project page opens a project view through canonical project query params;
- project page updates saved view query from applied filters, not draft form values;
- contributor helper copy and hidden shared mutation controls;
- archived project hides/disables project saved-view mutation controls.

### E2E

Add a Playwright smoke path:

1. Open the Worktrail App project Work page.
2. Open a seeded shared project view such as `Release blockers` or `Open dependency risks`.
3. Confirm active chips and result row.
4. Save a personal project view, reload, and reopen it.
5. Switch to contributor.
6. Confirm shared project view is visible/openable and shared management controls are unavailable.

Keep this smoke narrow. Do not duplicate every API permission path in Playwright.

## Verification

Expected final verification:

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

Run focused tests after each implementation phase:

- contracts tests after DTO changes;
- API saved-view tests after service/repository work;
- web saved-view/page tests after toolbar/project page work;
- focused Playwright project saved-view smoke before full e2e.

## Migration And Compatibility

Migration plan:

1. Add `scope` with default `workspace`.
2. Add nullable `project_id`.
3. Backfill existing rows implicitly through the default.
4. Add scope/project consistency check.
5. Drop old v0.1.3 unique indexes.
6. Add new scope-aware unique indexes.
7. Add read indexes.

Compatibility:

- Existing saved views become workspace-scoped.
- Existing workspace UI can continue using the list endpoint without query params.
- Existing create requests without scope continue creating workspace-scoped personal views.
- Existing update/delete routes remain unchanged.

## Risks

- **Scope migration risk:** uniqueness and query behavior become more complex.
- **Naming confusion:** `visibility: 'workspace'` inside project scope may read oddly in code.
- **UI crowding:** project Work page already has dense controls.
- **Archived project semantics:** personal saved views are user artifacts, but allowing mutations on archived project pages would weaken the app's read-only model.
- **Over-abstraction:** a second saved-view surface may invite a premature generic component or package.

## Mitigations

- Add explicit `scope` everywhere saved-view behavior branches.
- Keep visible UI copy as "shared project views" rather than exposing `workspace` visibility wording.
- Reuse the toolbar with focused inputs instead of a broad abstraction.
- Block all project-scoped saved-view mutations while archived.
- Add compatibility tests around workspace saved views before refactoring repository methods.
- Keep all extraction notes descriptive until another app repeats the pattern.

## Deferred Items

- Pinned saved views.
- Manual saved-view ordering.
- Saved-view folders.
- Saved-view icons, colors, descriptions, and rich metadata.
- Ownership transfer.
- Custom saved-view permissions.
- Project-specific membership.
- Saved views on Board, Planning, My Work, and Inbox.
- Short links, native share sheets, and link analytics.
- Generic `jawstack` saved-view or query-artifact package.
