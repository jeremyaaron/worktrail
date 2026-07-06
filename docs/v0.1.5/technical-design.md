# Worktrail v0.1.5 Technical Design

## Overview

Worktrail v0.1.5 adds pinned operating views to the existing saved work view model.

The saved-view model already supports:

- workspace and project scopes;
- personal and shared visibility;
- canonical query persistence;
- owner attribution;
- owner/maintainer shared-view management;
- contributor read access to shared views;
- archived-project read-only behavior for project-scoped saved views;
- workspace and project activity for shared saved-view management.

v0.1.5 should extend that model with one new durable boolean: `isPinned`.

Pinned views are shortcuts. They do not change query behavior, saved-view ownership, visibility, sorting policy, permissions, or URL contracts. A pinned saved view remains the same saved query artifact; it is simply promoted into an always-visible shortcut area on the relevant Work Items page.

## Resolved Decisions

- Add `isPinned: boolean` to `SavedWorkViewDto`.
- Add `isPinned?: boolean` to `UpdateSavedWorkViewRequest`.
- Do not add `isPinned` to `CreateSavedWorkViewRequest`; new views are unpinned by default.
- Use existing `PATCH /api/saved-work-views/:savedViewId` for pin and unpin.
- Keep `scope`, `projectId`, and `visibility` immutable.
- Emit activity for shared pin changes:
  - workspace activity for workspace-scoped shared views;
  - project activity for project-scoped shared views.
- Do not emit activity for personal pin changes.
- Add shared activity event types:
  - `saved_view.pinned`;
  - `saved_view.unpinned`.
- Add `is_pinned boolean not null default false` to `saved_work_views`.
- Do not add manual position/order.
- Sort pinned shared views alphabetically by name.
- Sort pinned personal views alphabetically by name.
- Render shared pins before personal pins.
- Keep newly created views unpinned by default.
- Add a small presentational pinned-shortcuts component shared by workspace and project Work pages.
- Keep saved-view manager responsible for pin/unpin controls.
- Keep saved-view page components responsible for capability decisions and API mutations.
- Keep pattern-extraction notes generic; do not name a destination framework.

## Current Architecture

Saved views are implemented through a single subsystem:

- `packages/contracts/src/saved-work-views.ts` defines DTO and request types.
- `apps/api/src/db/schema.ts` defines `saved_work_views`.
- `apps/api/src/repositories/saved-work-view-repository.ts` handles CRUD and visible list queries.
- `apps/api/src/services/saved-work-view-service.ts` owns normalization, permissions, and activity.
- `apps/api/src/endpoints/saved-work-views.ts` exposes list/create/update/delete endpoint handlers.
- `apps/web/src/app/core/api/saved-views-api.ts` and `WorktrailApiService` expose saved-view HTTP calls.
- `SavedViewsToolbarComponent` renders the saved-view form and manager.
- `WorkspaceWorkItemListPageComponent` and `WorkItemListPageComponent` own saved-view loading, grouping, mutation, and canonical route navigation.

This design extends those seams instead of adding a separate pinned-view subsystem.

## Contract Design

Update `packages/contracts/src/saved-work-views.ts`.

```ts
export interface SavedWorkViewDto {
  id: string;
  workspaceId: string;
  projectId: string | null;
  owner: MemberDto;
  name: string;
  scope: SavedWorkViewScope;
  visibility: SavedWorkViewVisibility;
  isPinned: boolean;
  query: WorkItemQuery;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateSavedWorkViewRequest {
  name?: string;
  query?: WorkItemQuery;
  isPinned?: boolean;
}
```

Compatibility:

- Existing callers that do not send `isPinned` continue to update only name/query.
- Existing create callers keep creating unpinned views.
- Existing list consumers must tolerate the new required DTO field after type updates.
- `isPinned` does not affect `WorkItemQuery`.

Do not add:

- `position`;
- `icon`;
- `color`;
- `description`;
- `folderId`;
- `lastOpenedAt`;
- `usageCount`.

## Database Design

### Schema

Add `isPinned` to `saved_work_views`:

```ts
isPinned: boolean('is_pinned').notNull().default(false)
```

The migration should add:

```sql
alter table "saved_work_views"
  add column "is_pinned" boolean default false not null;
```

Existing rows backfill to `false` through the default.

### Indexes

No new index is required for v0.1.5.

Reasoning:

- pinned shortcuts are rendered from the existing visible saved-view list response;
- the list is already scoped and small in the reference app;
- there is no separate pinned-list API.

If saved-view counts grow later, a scoped pinned read index can be revisited:

```sql
create index saved_work_views_pinned_scope_name_idx
  on saved_work_views (workspace_id, scope, project_id, is_pinned, lower(name));
```

Do not add this in v0.1.5 unless tests reveal a concrete need.

## API Endpoint Design

Keep the existing route surface:

- `GET /api/saved-work-views`
- `POST /api/saved-work-views`
- `PATCH /api/saved-work-views/:savedViewId`
- `DELETE /api/saved-work-views/:savedViewId`

### List

No route change.

List responses include `isPinned`.

### Create

No request contract change.

All newly created saved views default to unpinned.

Rationale:

- pinning should remain an explicit promotion action;
- create form stays compact;
- this avoids turning v0.1.5 into a larger create-flow redesign.

### Update

Extend update body:

```json
{
  "isPinned": true
}
```

Rules:

- at least one of `name`, `query`, or `isPinned` must be present;
- `isPinned` must be boolean when present;
- name/query/isPinned can be updated together;
- existing mutability rules apply through `requireMutableSavedView`;
- personal saved views require owner;
- shared saved views require owner or maintainer;
- archived project-scoped saved views reject pin changes because all project-scoped saved-view mutations are already blocked;
- no activity is emitted if `isPinned` is set to the current value and name/query are unchanged.

### Delete

No route change.

Pinned state does not affect deletion permissions.

## Endpoint Validation

Update `apps/api/src/endpoints/saved-work-views.ts`.

Current update schema:

```ts
const updateSavedWorkViewSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    query: queryPayloadSchema.optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one saved view field must be provided.'
  });
```

Add:

```ts
isPinned: z.boolean().optional()
```

Update `toUpdateRequest` to pass `isPinned`.

The existing non-empty refine still works.

## Service Design

Update `SavedWorkViewService.updateSavedView`.

Recommended patch shape:

```ts
const patch: {
  name?: string;
  query?: WorkItemQuery;
  isPinned?: boolean;
  updatedAt: Date;
} = {
  updatedAt: this.clock()
};
```

Handle pin state:

```ts
if (input.isPinned !== undefined) {
  patch.isPinned = input.isPinned;
}
```

Pass `isPinned` to repository update only when provided.

### Activity Detection

Extend shared-view update activity detection to include pin changes.

Recommended local variables:

```ts
const pinChanged =
  input.requestedIsPinned !== undefined &&
  input.current.isPinned !== input.updated.isPinned;
```

Event precedence:

- if name/query changed and pin changed in the same request, use `saved_view.updated`;
- if only name changed, use `saved_view.name_changed`;
- if only query changed, use `saved_view.query_changed`;
- if only pin changed to true, use `saved_view.pinned`;
- if only pin changed to false, use `saved_view.unpinned`.

Summary examples:

- `Avery Owner pinned shared view Dependency risks.`
- `Avery Owner unpinned shared view Dependency risks.`
- `Avery Owner pinned shared project view Ready for QA.`
- `Avery Owner unpinned shared project view Ready for QA.`
- `Avery Owner updated shared project view Ready for QA.`

`savedViewActivityValue` should include `isPinned`.

### Personal Pin Activity

Do not emit activity for personal saved-view pin changes.

The same `updateSavedView` code path can simply guard activity behind `updated.visibility === 'workspace'`, as it does today.

## Repository Design

Update `UpdateSavedWorkViewInput`:

```ts
export interface UpdateSavedWorkViewInput {
  name?: string;
  query?: Record<string, unknown>;
  isPinned?: boolean;
  updatedAt: Date;
}
```

No additional repository methods are needed.

The existing `listVisible` response includes `isPinned` automatically after schema changes.

## DTO Mapping

Update `toSavedWorkViewDto`:

```ts
isPinned: savedView.isPinned,
```

## Domain Constants

Add activity event values to both shared event type arrays:

```ts
'saved_view.pinned',
'saved_view.unpinned'
```

Add to:

- `activityEventTypes`;
- `workspaceActivityEventTypes`.

## OpenAPI Design

Update `docs/api/openapi.yaml`.

Required updates:

- `SavedWorkView.required` includes `isPinned`.
- `SavedWorkView.properties.isPinned` is boolean.
- `UpdateSavedWorkViewRequest.properties.isPinned` is boolean.
- PATCH description mentions pin/unpin follows existing saved-view mutation rules.
- Activity event enum/docs include saved-view pinned/unpinned events if the relevant schemas enumerate event types.

No route changes.

## Seed Design

Update `apps/api/src/db/seed.ts`.

Recommended pinned shared workspace views:

- `Dependency risks`: `isPinned: true`;
- `Ready for pickup`: `isPinned: true`.

Recommended pinned shared project views for Worktrail App:

- `Ready for QA`: `isPinned: true`;
- `Release blockers`: `isPinned: true`.

All other saved views can rely on default `false` or set `isPinned: false` where explicitness improves fixture clarity.

Seed upsert should update `isPinned`:

```ts
isPinned: sql`excluded.is_pinned`
```

## Web API Client Design

The API client can keep the same methods:

- `listSavedWorkViews`
- `createSavedWorkView`
- `updateSavedWorkView`
- `deleteSavedWorkView`

Only type updates are required after `UpdateSavedWorkViewRequest` includes `isPinned`.

No new service method is necessary.

## UI Component Design

### Pinned Saved Views Component

Add a small presentational component:

`apps/web/src/app/features/work-items/components/pinned-saved-views.component.ts`

Inputs:

```ts
@Input() sharedViews: SavedWorkViewDto[] = [];
@Input() personalViews: SavedWorkViewDto[] = [];
@Input() querySummaryScope: WorkItemQueryScope = 'workspace';
@Input() emptyLabel = '';
@Output() readonly open = new EventEmitter<SavedWorkViewDto>();
```

Behavior:

- render nothing when both arrays are empty;
- render one compact region when there are pins;
- shared pins render first;
- personal pins render second;
- each shortcut is a button;
- button text includes saved-view name;
- visible badge indicates `Shared` or `Personal`;
- compact summary uses existing `meaningfulWorkItemQueryFieldCount`.

Suggested DOM:

```html
<section class="pinned-views" aria-labelledby="pinned-views-heading">
  <div class="pinned-views__heading">
    <h2 id="pinned-views-heading">Pinned views</h2>
  </div>
  <div class="pinned-views__list">
    <!-- buttons -->
  </div>
</section>
```

Use restrained styling:

- no nested cards;
- no oversized hero-like elements;
- stable button dimensions;
- wrap on narrow screens;
- no one-hue decorative palette changes.

### Saved Views Toolbar

Extend `SavedViewsToolbarComponent`.

New input:

```ts
@Input() canManagePersonalViews = true; // already exists
@Input() canManageSharedViews = false;  // already exists
```

New output:

```ts
@Output() readonly pinChange = new EventEmitter<{
  savedView: SavedWorkViewDto;
  isPinned: boolean;
}>();
```

For each visible row:

- show `Pin` when `view.isPinned === false` and the user can mutate that row;
- show `Unpin` when `view.isPinned === true` and the user can mutate that row;
- do not show pin controls for read-only shared rows;
- do not show pin controls on archived project pages because existing page capability should set management inputs false.

Pin controls should sit with other row actions.

Do not add a separate form or modal.

### Page Integration

Both `WorkspaceWorkItemListPageComponent` and `WorkItemListPageComponent` should compute pinned groups.

Workspace:

```ts
readonly pinnedSharedSavedViews = computed(() =>
  this.workspaceSavedViews().filter((view) => view.isPinned)
);

readonly pinnedPersonalSavedViews = computed(() =>
  this.personalSavedViews().filter((view) => view.isPinned)
);
```

Project:

```ts
readonly pinnedSharedSavedViews = computed(() =>
  this.sharedSavedViews().filter((view) => view.isPinned)
);

readonly pinnedPersonalSavedViews = computed(() =>
  this.personalSavedViews().filter((view) => view.isPinned)
);
```

Render pinned shortcuts above filters and below the saved-view toolbar, or directly above the saved-view toolbar.

Recommended order:

1. header;
2. saved views toolbar;
3. pinned views shortcuts;
4. filters;
5. active chips/results.

Reasoning:

- keeps saved-view creation/management close to pinned view behavior;
- keeps pins above filters as fast entry points;
- avoids moving filters too far down when there are no pins because the component renders nothing.

Add page handlers:

```ts
setSavedViewPinned(savedView: SavedWorkViewDto, isPinned: boolean): void {
  if (!this.canMutateSavedView(savedView)) {
    return;
  }

  this.savedViewMutationError.set(null);

  this.api.updateSavedWorkView(savedView.id, { isPinned }).subscribe({
    next: (updated) => this.replaceSavedView(updated),
    error: ...
  });
}
```

This can reuse existing `replaceSavedView` and error handling.

## Ordering

Reuse existing `sortSavedViews` alphabetical ordering.

Because pinned groups are filtered from sorted saved-view groups:

- shared pins remain alphabetical;
- personal pins remain alphabetical;
- shared pins render before personal pins.

No persisted position field.

## Permissions

API is authoritative:

- owner can pin/unpin own personal views;
- maintainer/contributor can pin/unpin own personal views;
- owner and maintainer can pin/unpin shared workspace/project views;
- contributor cannot pin/unpin shared views;
- archived project-scoped saved views reject all mutation, including pin changes.

UI mirrors API:

- personal rows show pin controls only when `canManagePersonalViews` is true;
- shared rows show pin controls only when `canManageSharedViews` is true;
- archived project page passes false for both management flags, preserving read-only behavior.

## Activity Design

Implement shared pin/unpin activity in v0.1.5.

Rationale:

- shared view pinning changes the team's operating surface;
- the existing shared saved-view management activity path already routes workspace/project activity by scope;
- adding two event types is low complexity and avoids an audit gap.

Personal pin changes remain private and do not emit activity.

Activity value payloads should include:

```ts
{
  savedViewId,
  name,
  scope,
  projectId,
  visibility,
  isPinned,
  query
}
```

## Test Strategy

### Contracts

Update `packages/contracts/src/work-item-query.contract.test.ts`:

- `SavedWorkViewDto` fixture includes `isPinned`;
- `UpdateSavedWorkViewRequest` accepts `isPinned`.

### Migration And Seed

Run:

```sh
npm run db:reset
npm run db:migrate
npm run db:seed
```

Add or update seed assertions in existing API tests if available.

### API

Extend `apps/api/tests/saved-work-views.test.ts`.

Coverage:

- list response includes `isPinned`;
- existing rows default to unpinned;
- personal owner can pin/unpin;
- shared workspace view can be pinned/unpinned by owner/maintainer;
- contributor cannot pin/unpin shared workspace view;
- shared project view can be pinned/unpinned by owner/maintainer;
- contributor cannot pin/unpin shared project view;
- archived project saved view pin/unpin is forbidden;
- pin-only no-op does not emit activity;
- shared pin/unpin emits workspace or project activity;
- personal pin/unpin does not emit shared activity.

### Web Unit

Extend:

- `saved-views-toolbar.component.spec.ts`;
- `workspace-work-item-list-page.component.spec.ts`;
- `work-items-page.component.spec.ts`.

Add tests for:

- pin/unpin buttons render by permission;
- read-only shared rows hide pin controls;
- pinned shortcut groups render shared before personal;
- opening pinned shortcut emits/open navigates through existing open path;
- pin/unpin mutation updates local saved-view state;
- errors surface inline;
- archived project hides pin controls.

Add a focused spec for `PinnedSavedViewsComponent`.

### API Client

Extend `worktrail-api.service.spec.ts` if current request body assertions need `isPinned`.

### Playwright

Extend `e2e/worktrail-smoke.spec.ts`.

Suggested smoke:

- top-level Work Items shows seeded pinned `Dependency risks`;
- opening it applies `dependency=dependency_blocked`, active chip, and expected row;
- Worktrail App project Work page shows seeded pinned `Ready for QA`;
- opening it applies `status=ready`, active chip, and expected row;
- contributor sees shared pinned project view but no shared pin mutation controls.

Avoid making Playwright depend on creating many new saved views; use deterministic seed pins.

## Documentation

Finalization should update:

- `README.md`;
- `site/index.html` if the UI is polished enough to mention publicly;
- `docs/v0.1.5/release-notes.md`;
- `docs/v0.1.5/pattern-extraction-notes.md`.

Pattern extraction notes should remain destination-neutral.

## Rollout And Compatibility

- Migration backfills existing saved views to `isPinned=false`.
- No feature flag.
- No route changes.
- No create request changes.
- Existing saved-view behavior remains compatible.
- Existing saved-view list consumers need type updates for the new DTO field.

## Verification

Recommended final commands:

```sh
npm run lint
npm run typecheck
npm run db:reset
npm run db:migrate
npm run db:seed
npm test
npm run build
npm run test:e2e
git diff --check
```

## Risks And Mitigations

- **Crowded saved-view rows:** keep pin controls as simple text buttons and avoid adding metadata columns.
- **Pinned section competes with filters:** render only when pins exist and use compact wrapping buttons.
- **User confusion between pinning and ordering:** do not add manual ordering; document alphabetical ordering.
- **Activity noise:** emit only for shared pin changes, not personal pin changes.
- **Premature abstraction:** keep code app-local and extract only small presentational reuse where it reduces duplication.

## Deferred Items

- manual pinned ordering;
- folders;
- icons, colors, descriptions, and rich metadata;
- "save and pin" create affordance;
- default saved views;
- saved-view analytics;
- saved-view usage timestamps;
- saved-view comments, approvals, or change requests;
- project-specific saved-view permissions;
- saved views on boards, planning, My Work, or Inbox.
