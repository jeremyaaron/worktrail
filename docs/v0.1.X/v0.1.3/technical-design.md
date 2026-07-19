# Worktrail v0.1.3 Technical Design

## Overview

Worktrail v0.1.3 adds workspace-shared saved work views on top of the v0.1.2 query-state foundation.

The release should preserve personal saved views while adding a second visibility, `workspace`, for team-operating views. Workspace views are visible to every active member in the workspace. Owners and maintainers can create, rename, update-query, and delete them. Contributors can open them but cannot manage them.

This design is intentionally app-local. It extends the current saved-view stack rather than introducing a generic saved-view framework, a new package, or a broad query abstraction.

## Resolved Decisions

- Use `workspace` as the shared visibility value.
- Keep the existing `owner` relationship on both personal and workspace views.
- Authorize workspace-view management by current actor role, not creator-only ownership.
- Allow owners and maintainers to manage all workspace views in the workspace.
- Keep contributors read-only for workspace views.
- Preserve personal-view ownership rules: only the owner can update or delete a personal view.
- Defer project-scoped saved views.
- Add workspace activity only for workspace-view create, rename, query update, and delete.
- Do not add saved-view ordering, pinning, folders, icons, colors, descriptions, or rich metadata in v0.1.3.

## Current Architecture

Saved views already have most of the required shape:

- `SavedWorkViewDto` includes `visibility`, currently typed as only `'personal'`.
- `saved_work_views.visibility` exists in Postgres and has a check constraint.
- `SavedWorkViewService` normalizes query JSON through `normalizeWorkItemQuery`.
- `SavedViewsToolbarComponent` owns the current workspace Work Items saved-view UI.
- `WorkspaceWorkItemListPageComponent` owns saved-view mutations and canonical route navigation.

The release should extend these paths rather than create parallel endpoints.

## Contract Design

Update `packages/contracts/src/saved-work-views.ts`:

```ts
export type SavedWorkViewVisibility = 'personal' | 'workspace';

export interface SavedWorkViewDto {
  id: string;
  workspaceId: string;
  owner: MemberDto;
  name: string;
  visibility: SavedWorkViewVisibility;
  query: WorkItemQuery;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSavedWorkViewRequest {
  name: string;
  query: WorkItemQuery;
  visibility?: SavedWorkViewVisibility;
}

export interface UpdateSavedWorkViewRequest {
  name?: string;
  query?: WorkItemQuery;
}
```

`visibility` is optional on create for compatibility. Omitted visibility means `personal`.

Do not support changing visibility on update in v0.1.3. Converting a personal view to workspace or vice versa can be deferred until there is a clear workflow.

## Database Design

### Schema

Update `apps/api/src/domain/constants.ts`:

```ts
export const savedWorkViewVisibilities = ['personal', 'workspace'] as const;
```

Update the Drizzle schema check constraint to use the expanded enum.

### Migration

Add a new Drizzle migration that:

- drops the existing `saved_work_views_visibility_check`;
- recreates it with `visibility in ('personal', 'workspace')`;
- drops the existing `saved_work_views_workspace_owner_name_unique`;
- creates partial unique indexes:
  - personal unique by workspace, owner, lower name;
  - workspace unique by workspace, lower name.

Recommended index shape:

```sql
create unique index saved_work_views_personal_name_unique
  on saved_work_views (workspace_id, owner_member_id, lower(name))
  where visibility = 'personal';

create unique index saved_work_views_workspace_name_unique
  on saved_work_views (workspace_id, lower(name))
  where visibility = 'workspace';
```

Keep the existing workspace/owner/updated index unless implementation shows a better replacement is needed. Add a workspace/visibility/updated index only if query plans or repository code justify it.

Existing rows already have `visibility = 'personal'`, so no data backfill is required.

## API Repository Design

Extend `createSavedWorkViewRepository` with visibility-aware methods.

Recommended methods:

```ts
listVisible(workspaceId: string, ownerMemberId: string): Promise<SavedWorkView[]>;

findPersonalByOwnerAndName(
  workspaceId: string,
  ownerMemberId: string,
  name: string
): Promise<SavedWorkView | null>;

findWorkspaceByName(
  workspaceId: string,
  name: string
): Promise<SavedWorkView | null>;
```

`listVisible` should return:

- personal views where `ownerMemberId` is the current actor;
- workspace views for the current workspace.

Sort order should be stable and easy to scan:

1. `visibility` grouping can be handled in the UI, so repository can sort by `updatedAt desc`.
2. UI can apply secondary alphabetical sorting within groups if that reads better.

Do not return another actor's personal views.

## API Service Design

`SavedWorkViewService` should own authorization and name-conflict behavior.

### Listing

`listSavedViews()`:

- require a valid active actor member;
- call `listVisible(workspaceId, actor.memberId)`;
- hydrate each view's owner.

Current implementation fetches one owner because all listed views are personal. v0.1.3 needs owner hydration per distinct `ownerMemberId`. Use existing member repository calls unless a batch helper already exists or is worth adding.

### Create

`createSavedView(input)`:

- normalize name;
- default `visibility` to `personal`;
- validate visibility is supported;
- if `personal`:
  - actor must be active;
  - name must be unique for actor/workspace personal views.
- if `workspace`:
  - actor must be owner or maintainer;
  - name must be unique for workspace views.
- normalize query through `normalizeWorkItemQuery`;
- create with `ownerMemberId = actor.memberId`;
- emit workspace activity for workspace visibility only.

### Update

`updateSavedView(savedViewId, input)`:

- load saved view by id and workspace;
- if missing, return not found;
- if personal:
  - actor must be the owner;
  - name conflicts check personal scope.
- if workspace:
  - actor must be owner or maintainer;
  - name conflicts check workspace scope.
- normalize query when provided;
- update changed fields;
- emit workspace activity for workspace visibility only:
  - rename emits `saved_view.name_changed`;
  - query update emits `saved_view.query_changed`;
  - if both happen in one request, prefer one `saved_view.updated` event or emit two events only if existing activity conventions support it cleanly.

Recommended v0.1.3 behavior: emit one event per API request, using the most specific type:

- name only: `saved_view.name_changed`;
- query only: `saved_view.query_changed`;
- both: `saved_view.updated`.

### Delete

`deleteSavedView(savedViewId)`:

- load saved view by id and workspace;
- authorize using personal/workspace rules;
- delete;
- emit `saved_view.deleted` for workspace visibility only.

## Authorization Rules

Use the actor context plus member lookup.

Rules:

- Active owners can manage workspace views.
- Active maintainers can manage workspace views.
- Active contributors can list/open workspace views but cannot create/update/delete them.
- Personal views can only be updated/deleted by their owner.
- Inactive members should not be valid current actors through normal actor resolution. Keep service-level validation defensive.

Error behavior:

- Unauthorized workspace-view mutation should return `ForbiddenError`.
- Cross-actor personal view access should remain `NotFoundError` to avoid leaking personal view existence.
- Workspace-view not found should return `NotFoundError`.
- Name conflict should return `ConflictError` with the existing clear message pattern.

Suggested user-facing conflict messages:

- Personal: `A personal saved view with this name already exists.`
- Workspace: `A workspace saved view with this name already exists.`

If keeping the existing generic message reduces churn, it is acceptable as long as tests assert structured conflict behavior.

## Workspace Activity Design

Extend `WorkspaceActivityEventType` in contracts and API constants:

- `saved_view.created`;
- `saved_view.name_changed`;
- `saved_view.query_changed`;
- `saved_view.updated`;
- `saved_view.deleted`.

Only workspace-visible saved views should create workspace activity.

Suggested summaries:

- `{actor} created shared view {name}.`
- `{actor} renamed shared view {oldName} to {newName}.`
- `{actor} updated shared view {name}.`
- `{actor} deleted shared view {name}.`

Follow existing workspace activity event shape:

- `previousValue`: compact old values where applicable;
- `newValue`: compact new values where applicable;
- `metadata`: include `savedViewId`, `visibility: 'workspace'`, and perhaps `query` only if useful and not too noisy.

Prefer not to store full query JSON in activity metadata unless tests or UI need it. Name and saved view id should be enough for v0.1.3.

## Endpoint Design

Keep the existing route surface:

- `GET /api/saved-work-views`
- `POST /api/saved-work-views`
- `PATCH /api/saved-work-views/:savedViewId`
- `DELETE /api/saved-work-views/:savedViewId`

Update create schema:

```ts
const createSavedWorkViewSchema = z.object({
  name: z.string().trim().min(1),
  query: queryPayloadSchema,
  visibility: z.enum(['personal', 'workspace']).optional()
});
```

Do not add a new `visibility` query param to list in v0.1.3. The workspace Work Items page needs the combined visible set.

## Seed Data Design

Add deterministic workspace shared views.

Recommended seed IDs:

- `workspaceBlocked`
- `workspaceDependencyRisks`
- `workspaceDueSoon`
- `workspaceUnassignedOpen`
- `workspaceReadyForPickup`

Use owner as creator for seeded shared views unless a maintainer-authored example is useful.

Recommended queries:

```ts
Blocked work: { status: 'blocked' }
Dependency risks: { dependency: 'dependency_blocked' }
Due soon: { dueDateState: 'due_soon', workState: 'open', sort: 'due_date_asc' }
Unassigned open work: { assigneeState: 'unassigned', workState: 'open' }
Ready for pickup: { status: 'ready', sort: 'priority_desc' }
```

Seed upsert should include `visibility` in the update set.

## Frontend API Design

No new Angular API service is needed.

Update `CreateSavedWorkViewRequest` usage so callers can pass optional `visibility`.

Existing `WorktrailApiService` and `SavedViewsApi` methods remain:

- `listSavedWorkViews()`;
- `createSavedWorkView(input)`;
- `updateSavedWorkView(id, input)`;
- `deleteSavedWorkView(id)`.

## Frontend State Design

`WorkspaceWorkItemListPageComponent` should split saved views into derived groups:

```ts
personalSavedViews(): SavedWorkViewDto[];
workspaceSavedViews(): SavedWorkViewDto[];
canManageWorkspaceSavedViews(): boolean;
```

The component already has access to current actor through `CurrentUserService` patterns elsewhere. If not already injected, use the existing service rather than adding a new permission system.

Create actions:

- existing save form should default to personal.
- add a compact visibility control or two adjacent actions:
  - `Save personal view`;
  - `Save shared view` for owners/maintainers.

Recommended UX: keep one name input and two action buttons:

- `Save personal view`;
- `Save shared view` only when allowed.

This avoids adding another select to the compact toolbar.

Mutation actions:

- personal rows show rename/update/delete for the owner, same as today;
- workspace rows show rename/update/delete only when `canManageWorkspaceSavedViews` is true;
- workspace rows always show `Open`.

Error state can remain one `savedViewMutationError` unless implementation needs per-group messaging.

## SavedViewsToolbar Component Design

The current toolbar takes one `savedViews` array. v0.1.3 should make the grouping explicit.

Recommended inputs:

```ts
@Input({ required: true }) personalViews: SavedWorkViewDto[] = [];
@Input({ required: true }) workspaceViews: SavedWorkViewDto[] = [];
@Input({ required: true }) draftNames: Partial<Record<string, string>> = {};
@Input() canManageWorkspaceViews = false;
@Input() isSavingPersonal = false;
@Input() isSavingWorkspace = false;
```

Recommended outputs:

```ts
@Output() readonly savePersonal = new EventEmitter<string>();
@Output() readonly saveWorkspace = new EventEmitter<string>();
@Output() readonly open = new EventEmitter<SavedWorkViewDto>();
@Output() readonly rename = new EventEmitter<SavedWorkViewDto>();
@Output() readonly updateQuery = new EventEmitter<SavedWorkViewDto>();
@Output() readonly delete = new EventEmitter<SavedWorkViewDto>();
@Output() readonly draftNameChange = new EventEmitter<{ savedViewId: string; name: string }>();
```

The component should:

- show counts for personal and shared views;
- show an empty state only when both groups are empty;
- render shared views above personal views because team lenses are more broadly useful;
- include compact helper copy for contributors such as `Owners and maintainers manage shared views.`;
- keep `<details>` management behavior to avoid crowding the page.

If changing inputs creates too much churn, an alternative is to keep `savedViews` and group internally. Prefer explicit inputs because permission state and tests will be clearer.

## Sorting

Sort saved views deterministically in the component/page layer:

- workspace views alphabetically by name;
- personal views alphabetically by name.

This is better for a view library than updated-desc churn. Existing tests that expect updated-desc should be updated if any exist.

## Query Behavior

Shared views must reuse the v0.1.2 query model:

- create/update uses `this.appliedQuery()`;
- open uses `workspaceRouterQueryParamsFromQuery(savedView.query)`;
- summary uses `meaningfulWorkItemQueryFieldCount(savedView.query, 'workspace')`;
- export after opening a shared view uses applied query state;
- copy link after opening a shared view uses canonical applied query state.

No new query serializer is needed.

## Testing Strategy

### Contracts

Update contract tests for:

- `SavedWorkViewVisibility` accepts `workspace`;
- `CreateSavedWorkViewRequest` can include `visibility: 'workspace'`.

### API Tests

Extend `apps/api/tests/saved-work-views.test.ts`.

Coverage:

- list returns actor personal views plus workspace views;
- list does not return other actors' personal views;
- owner creates workspace view;
- maintainer creates workspace view;
- contributor cannot create workspace view;
- contributor can list workspace view;
- owner/maintainer can rename, update query, and delete workspace view;
- contributor cannot update/delete workspace view;
- personal owner-only update/delete remains intact;
- personal duplicate names are scoped per owner;
- workspace duplicate names are scoped per workspace;
- saved query normalization applies to workspace views;
- workspace activity is emitted for workspace view create/update/delete.

### Frontend Unit Tests

Update:

- `saved-views-toolbar.component.spec.ts`
- `workspace-work-item-list-page.component.spec.ts`

Coverage:

- shared and personal sections render separately;
- shared management actions hide for contributors;
- shared management actions show for owners/maintainers;
- save personal sends `visibility: 'personal'` or omits visibility by explicit design;
- save shared sends `visibility: 'workspace'`;
- open shared view navigates through canonical workspace params;
- update shared view query uses applied query;
- existing personal saved-view workflow still works.

### E2E Smoke

Add one Playwright path if it stays low-cost:

1. Open `/work-items` as Avery Owner.
2. Open seeded `Dependency risks` shared view.
3. Confirm dependency chip and results.
4. Switch actor to Casey Contributor.
5. Confirm shared view is visible/openable.
6. Confirm shared management controls are unavailable.

Do not make Playwright cover every shared-view mutation; API and component tests should carry the permission matrix.

## Documentation

Update:

- `README.md`
- `site/index.html` if the final implementation is polished enough to market publicly;
- `docs/v0.1.3/release-notes.md`;
- `docs/v0.1.3/jawstack-extraction-notes.md`.

Documentation should explain:

- personal versus workspace saved views;
- who can manage workspace views;
- contributors can open shared views;
- shared views still use reliable filtered URLs and applied-filter exports.

Extraction notes should capture:

- saved query artifact visibility;
- role-based management versus owner attribution;
- query snapshots as team contracts;
- why project-scoped views, pinning, ordering, and metadata were deferred.

## OpenAPI

Update `docs/api/openapi.yaml` for:

- `SavedWorkViewVisibility` enum;
- create request optional `visibility`;
- saved view list behavior note;
- permission responses for workspace visibility.

## Rollout And Migration

This is a normal schema migration.

Local upgrade path:

```sh
npm run db:migrate
npm run db:seed
```

Existing personal saved views remain personal. New seeded workspace views are inserted through seed upsert.

No feature flag is needed.

## Risks And Mitigations

- **Unique-index migration risk:** use partial indexes so personal and workspace names have correct independent scopes.
- **UI crowding:** keep shared management inside existing saved-view details and use one name input with two save actions.
- **Permission leakage:** return not found for cross-owner personal views and forbidden for visible workspace views that the actor cannot mutate.
- **Activity noise:** emit workspace activity only for workspace views.
- **Scope creep:** defer project-scoped saved views and view metadata.

## Final Verification

Recommended full release verification:

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
