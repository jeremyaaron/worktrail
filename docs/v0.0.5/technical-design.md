# Worktrail v0.0.5 Technical Design

## Overview

Worktrail v0.0.5 makes the app useful as a daily operating surface instead of only a project-by-project tracker. The release adds:

- a personal work dashboard for the currently selected active member;
- cross-project work item discovery;
- personal saved work views backed by validated query state;
- route-based quick work capture;
- project navigation polish for larger workspaces;
- seed, documentation, and product-site updates after implementation.

The design preserves the current architecture:

- Angular standalone route components served as a static SPA;
- lazy-loaded feature routes;
- shared TypeScript contracts in `packages/contracts`;
- transport-neutral endpoint handlers;
- local Express adapter;
- service/repository backend layering;
- Drizzle-managed Postgres schema and migrations;
- deterministic local seed data and Playwright smoke coverage.

v0.0.5 should not add production authentication, notifications, imports, custom fields, custom workflows, AWS infrastructure, or a Lambda/API Gateway adapter.

## Design Decisions

- Add `/my-work` as the default app route. Keep `/projects` one click away in primary navigation.
- Add `/work-items` as a workspace-level cross-project discovery route.
- Keep project-scoped work item list routes unchanged, except for shared utility extraction where it reduces duplication.
- Implement saved views for cross-project discovery only in v0.0.5.
- Implement personal saved views only. Prepare the data model for future workspace-visible views with a `visibility` column, but only expose `personal` in the UI/API for this release.
- Store saved view query state in PostgreSQL `jsonb`, but validate it strictly at the API boundary and service boundary.
- Use a route-based quick create flow at `/work-items/new`. Reuse the existing project-scoped create component or shared form logic where practical.
- Keep existing project-scoped create route `/projects/:projectId/work-items/new`; it should route into the same create experience with the project preselected.
- Add a workspace dashboard service rather than overloading project planning endpoints.
- Extend the work item repository with workspace-scoped query methods instead of duplicating query logic in dashboard and saved-view services.
- Do not add pinned projects in v0.0.5. Improve project list search and summary signals first.

## Data Model Changes

### Saved Work Views

Add `saved_work_views`:

```text
id uuid primary key
workspace_id uuid not null references workspaces(id)
owner_member_id uuid not null references members(id)
name text not null
visibility text not null
query jsonb not null
created_at timestamptz not null
updated_at timestamptz not null
```

Constraints and indexes:

```text
saved_work_views_visibility_check visibility in ('personal')
saved_work_views_workspace_owner_updated_idx (workspace_id, owner_member_id, updated_at desc)
saved_work_views_workspace_owner_name_unique unique (workspace_id, owner_member_id, lower(name))
```

Rationale:

- `jsonb` keeps saved views flexible while the filter model evolves.
- The API still owns validation so persisted query state is not an untyped dumping ground.
- The `visibility` column avoids a future migration when workspace-visible views are introduced.
- Duplicate names are scoped to the active actor's personal saved views.

Repository additions:

```ts
savedWorkViews.create(input)
savedWorkViews.findById(id)
savedWorkViews.listPersonal(workspaceId, ownerMemberId)
savedWorkViews.findByOwnerAndName(workspaceId, ownerMemberId, normalizedName)
savedWorkViews.update(id, patch)
savedWorkViews.delete(id)
```

### Work Item Query Indexes

The existing project-scoped indexes remain useful. Add workspace-level indexes for cross-project discovery:

```text
work_items_workspace_id_status_idx (workspace_id, status)
work_items_workspace_id_assignee_id_idx (workspace_id, assignee_id)
work_items_workspace_id_reporter_id_idx (workspace_id, reporter_id)
work_items_workspace_id_priority_idx (workspace_id, priority)
work_items_workspace_id_due_date_idx (workspace_id, due_date)
work_items_workspace_id_updated_at_idx (workspace_id, updated_at desc)
```

Do not add a full-text search index in v0.0.5. Continue using `ilike` across display key, title, and description for the local reference app. If query performance becomes a real issue later, add PostgreSQL full-text search deliberately.

### Projects

No project table change is required. Project navigation polish can be computed from existing projects, work items, and activity timestamps.

## Contract Changes

### Work Item Query Types

Promote the current project list filter shape into shared contracts and extend it for workspace discovery.

```ts
export type ArchivedProjectMode = 'exclude' | 'include' | 'only';
export type AssigneeState = 'assigned' | 'unassigned';
export type WorkItemState = 'open' | 'terminal';

export interface WorkItemQuery {
  projectId?: string;
  status?: WorkItemStatus;
  workState?: WorkItemState;
  assigneeId?: string;
  assigneeState?: AssigneeState;
  reporterId?: string;
  type?: WorkItemType;
  priority?: WorkItemPriority;
  labelId?: string;
  milestoneId?: string;
  dueDateState?: DueDateState;
  blocked?: boolean;
  archivedProjects?: ArchivedProjectMode;
  search?: string;
  sort?: WorkItemSort;
}
```

Rules:

- Project-scoped list routes continue to accept the subset that makes sense for one project.
- Workspace discovery accepts the full query.
- `archivedProjects` defaults to `exclude`.
- `blocked=true` is equivalent to `status=blocked` for v0.0.5, but it keeps dashboard links readable and leaves room for future explicit blocker state.
- `assigneeState=unassigned` represents work with no assignee; it must not be combined with `assigneeId`.
- `workState=open` represents non-terminal work and `workState=terminal` represents done/canceled work; `workState` must not be combined with a specific `status`.
- `milestoneId` is only valid when the milestone belongs to the selected project or when the backend can resolve it unambiguously in the workspace. The initial UI should only expose milestone filtering after a project is selected.

### Cross-Project Work Item DTO

Reuse `WorkItemListItemDto` and add project identity. Keeping project identity explicit avoids forcing every consumer to join project data separately.

```ts
export interface WorkspaceWorkItemListItemDto extends WorkItemListItemDto {
  project: Pick<ProjectDto, 'id' | 'key' | 'name' | 'status'>;
}
```

### My Work Dashboard DTOs

```ts
export interface MyWorkSummaryCountDto {
  key:
    | 'assigned_open'
    | 'due_soon'
    | 'overdue'
    | 'blocked'
    | 'stale_assigned'
    | 'reported_open';
  label: string;
  count: number;
  query: WorkItemQuery;
}

export interface MyWorkDashboardDto {
  actor: MemberDto;
  summaryCounts: MyWorkSummaryCountDto[];
  assignedToMe: WorkspaceWorkItemListItemDto[];
  dueSoonOrOverdue: WorkspaceWorkItemListItemDto[];
  blockedRelevant: WorkspaceWorkItemListItemDto[];
  recentlyUpdated: WorkspaceWorkItemListItemDto[];
}
```

Dashboard limits:

- `assignedToMe`: 8 items
- `dueSoonOrOverdue`: 8 items
- `blockedRelevant`: 8 items
- `recentlyUpdated`: 8 items

The endpoint returns counts for all matching work but limits sections for scanning.

### Saved View DTOs

```ts
export type SavedWorkViewVisibility = 'personal';

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
}

export interface UpdateSavedWorkViewRequest {
  name?: string;
  query?: WorkItemQuery;
}
```

### Project Navigation DTO

The existing `ProjectDto` remains unchanged. Add a summary DTO for the project list.

```ts
export interface ProjectNavigationSummaryDto {
  project: ProjectDto;
  openWorkItemCount: number;
  blockedWorkItemCount: number;
  overdueWorkItemCount: number;
  updatedAt: string;
}
```

The existing `GET /projects` can keep returning `ProjectDto[]`. Add a separate summary endpoint rather than breaking current callers.

## API Design

### Dashboard

```text
GET /my-work
```

Behavior:

- Requires an active actor.
- Uses the actor from server-derived local actor context.
- Returns `MyWorkDashboardDto`.
- Excludes archived project work by default.
- Excludes terminal statuses from open/relevant counts unless a section explicitly needs recent historical context.
- Uses a stale threshold of 7 days for assigned active work in `in_progress` or `blocked`.

Implementation:

- Add `my-work.ts` endpoint module.
- Add `MyWorkService`.
- Reuse workspace work item query methods and DTO mapping.
- Keep dashboard-specific grouping in the service, not the repository.

### Cross-Project Work Items

```text
GET /work-items
```

Behavior:

- Requires an active actor.
- Accepts `WorkItemQuery` as query params.
- Defaults to active projects only.
- Returns `WorkspaceWorkItemListItemDto[]`.
- Includes inactive assignees/reporters historically.
- Includes archived labels/milestones only when already attached to returned items.

Implementation:

- Extend `work-items.ts` endpoint module or add a separate workspace work items handler.
- Add `WorkItemService.listWorkspaceWorkItems(filters)`.
- Add `workItems.listByWorkspace(workspaceId, filters)`.
- Join projects for filtering archived project state and for result project identity.
- Reuse existing DTO mapping helpers with a project map.

### Saved Views

```text
GET /saved-work-views
POST /saved-work-views
PATCH /saved-work-views/:savedViewId
DELETE /saved-work-views/:savedViewId
```

Behavior:

- Requires an active actor.
- Lists only the actor's personal saved views.
- Creates personal saved views only.
- Updates/deletes only views owned by the actor.
- Rejects duplicate names for the same actor.
- Rejects blank names and invalid query payloads.
- Does not delete or mutate work items.

Implementation:

- Add `saved-work-views.ts` endpoint module.
- Add `SavedWorkViewService`.
- Add `saved-work-view-repository.ts`.
- Use a query validation helper shared by the cross-project endpoint and saved view service.

### Quick Create

Use the existing API shape:

```text
POST /projects/:projectId/work-items
```

No new create endpoint is required. The global quick-create route selects a project in the UI, then calls the existing project-scoped create endpoint.

Supporting reads:

- `GET /projects` or project summary endpoint for active project choices.
- `GET /projects/:projectId/labels`
- `GET /projects/:projectId/milestones`
- `GET /members`

### Project Navigation Summary

```text
GET /projects/navigation-summary
```

Behavior:

- Requires an active actor.
- Returns `ProjectNavigationSummaryDto[]`.
- Includes active and archived projects.
- Computes open, blocked, and overdue counts.
- Sorts active projects first, then recently updated projects.

This avoids changing `GET /projects` while giving the frontend richer data for the project list.

## Query Validation

Add a shared backend parser for `WorkItemQuery`.

Validation rules:

- Enum fields must match known contract values.
- UUID fields must be valid UUIDs.
- `search` is trimmed and capped at 120 characters.
- Empty strings become `undefined`.
- `blocked=true` and `status=blocked` can coexist, but conflicting `blocked=true` with another status is rejected.
- `archivedProjects` defaults to `exclude`.
- `sort` defaults to `updated_desc`.
- `milestoneId` with no selected project is accepted by the API only if the milestone belongs to the actor workspace; the UI should avoid offering that state in v0.0.5.
- Unknown query keys are ignored for URL compatibility rather than rejected.

Saved views store the normalized query, not raw URL params.

## Service And Repository Design

### Work Item Repository

Add:

```ts
listByWorkspace(workspaceId: string, filters: WorkItemQuery): Promise<WorkspaceWorkItemRecord[]>
countByWorkspace(workspaceId: string, filters: WorkItemQuery): Promise<number>
countWorkspaceGroups(workspaceId: string, groupFilters): Promise<...>
```

`WorkspaceWorkItemRecord` can include `{ workItem, project }` or a flattened select. Keep mapping to contract DTOs in services.

`listByProject` should either:

- continue as-is for project pages; or
- delegate to a shared condition builder with `projectId` supplied.

Choose the shared builder only if it stays readable. Avoid over-abstracting for one sprint.

### My Work Service

Responsibilities:

- Build dashboard queries for the active actor.
- Compute summary counts.
- Fetch limited item sections.
- Map results to DTOs.

Dashboard query definitions:

- assigned open: `assigneeId=actor.memberId`, non-terminal statuses.
- due soon: `assigneeId=actor.memberId`, `dueDateState=due_soon`, non-terminal statuses.
- overdue: `assigneeId=actor.memberId`, `dueDateState=overdue`, non-terminal statuses.
- blocked: `status=blocked`, assigned to or reported by actor.
- stale assigned: assigned to actor, `in_progress` or `blocked`, updated more than 7 days ago.
- reported open: `reporterId=actor.memberId`, non-terminal statuses.

Because `WorkItemQuery` does not include every dashboard-specific predicate, the service can use repository helper methods for dashboard sections where necessary. Do not force awkward query fields into saved views solely for dashboard internals.

### Saved Work View Service

Responsibilities:

- Normalize names.
- Enforce ownership.
- Validate and normalize query payloads.
- Enforce duplicate-name rule.
- Map persisted `jsonb` to `SavedWorkViewDto`.

The service must not assume that saved queries still point to active labels, active members, or active projects. Stale references are allowed to persist; discovery can show no results or inactive labels/members where records are still attached to work.

## Frontend Design

### Routing

Update routes:

```ts
{ path: '', pathMatch: 'full', redirectTo: 'my-work' }
{ path: 'my-work', loadComponent: ... }
{ path: 'work-items', loadComponent: ... }
{ path: 'work-items/new', loadComponent: ... }
```

Keep:

```ts
{ path: 'projects/:projectId/work-items/new', loadComponent: ... }
```

The project-scoped create route can pass `projectId` from route params into the shared create component.

### Navigation

Primary navigation should include:

- My Work
- Projects
- Workspace
- Create work item

The create action may be a button styled as a command rather than a nav tab, but it should be globally reachable.

### My Work Page

Component:

```text
apps/web/src/app/features/my-work/my-work-page.component.ts
```

Behavior:

- Loads dashboard DTO.
- Refreshes when `CurrentUserService` actor changes.
- Renders summary counts as compact buttons/links to `/work-items` with query params.
- Renders dense work item rows using a shared presentational helper if useful.
- Shows empty states per section.

Avoid nested cards. Use full-width sections and compact list rows.

### Workspace Work Items Page

Component:

```text
apps/web/src/app/features/work-items/workspace-work-item-list-page.component.ts
```

Behavior:

- Reads applied filters from URL query params.
- Maintains draft search/filter state separately from applied URL state where needed.
- Applies dropdown filters immediately, consistent with the v0.0.3/v0.0.4 UX correction.
- Shows active pills only for applied filters.
- Loads saved views.
- Can save current applied query as a new view.
- Can open, rename, update, and delete a saved view.

The page can share constants and small helper functions with the project-scoped work item list. Do not create a generic form framework.

### Quick Create Page

Reuse or refactor:

```text
apps/web/src/app/features/work-items/work-item-create-page.component.ts
```

Required behavior:

- If `projectId` exists in route params, preselect and lock or strongly default that project.
- If launched from `/work-items/new`, show project selection first.
- After project selection, load labels and milestones for that project.
- Keep the existing validation and inline error style.
- On success, show actions:
  - Open created work item.
  - Create another.
  - Return to My Work or previous context.

If refactoring the existing component becomes risky, create a small shared form model/helper and keep two route wrappers.

### Project List

Enhance the existing project list page:

- Add search by project name/key.
- Use `GET /projects/navigation-summary`.
- Show active first, archived later.
- Show open, blocked, overdue, and recently updated signals.
- Keep project creation behavior from v0.0.4.

## Seed Data

Update deterministic seed data to support:

- dashboard sections for owner, maintainer, and contributor;
- at least one overdue assigned item;
- at least one due-soon assigned item;
- at least one blocked item relevant to each seeded active role path where practical;
- enough cross-project data to make workspace discovery meaningful;
- personal saved views for seeded members:
  - My open work;
  - Blocked work;
  - Due soon;
  - Unassigned work.

Seed saved views should use real seeded member IDs and normalized query payloads.

## Permissions

- Active members can read My Work and cross-project discovery.
- Active members can create, update, and delete their own personal saved views.
- No actor can manage another actor's saved views in v0.0.5.
- Work item creation continues to follow existing project write rules.
- Archived projects remain readable but not writable.
- Inactive actors are rejected by existing actor resolution.
- Inactive members remain displayable historically.

## Error Handling

Use existing error conventions:

- `400` for invalid query or saved view payload.
- `403` for inactive actors or unauthorized saved view access.
- `404` for missing saved views not owned by the actor, to avoid exposing existence.
- `409` for duplicate saved view names.

Frontend copy should be direct:

- "A saved view with this name already exists."
- "Choose a project before selecting labels or milestones."
- "Archived projects cannot receive new work."
- "This saved view no longer matches any work items."

## Testing Strategy

### Backend

Add unit/service tests for:

- workspace work item query filters and sorts;
- archived project inclusion modes;
- dashboard count and section computation;
- stale assigned work threshold;
- saved view create/list/update/delete;
- duplicate saved view names;
- saved view ownership enforcement;
- invalid saved query rejection;
- quick create through existing work item service remains unchanged for project-scoped validation.

### Frontend

Add component tests for:

- My Work dashboard rendering;
- actor-change refresh behavior;
- workspace work item list URL filter state;
- applied filter pills;
- saved view create/open/update/delete UI;
- quick create project selection and project-dependent fields;
- project list search and summary signals.

### E2E

Extend Playwright smoke coverage:

- open My Work as seeded contributor or maintainer;
- follow a dashboard count to `/work-items` with filters applied;
- save a filtered view;
- reload and reopen the saved view;
- create a work item from `/work-items/new`;
- confirm the new item appears in cross-project discovery;
- verify core v0.0.4 governance and project planning paths still pass.

## Build And Performance

- Keep all new pages lazy-loaded.
- Avoid importing CDK drag/drop or heavy board code into My Work or workspace discovery.
- Keep production initial bundle under the existing warning budget.
- Watch for duplicated table/filter helper code, but prefer small shared helpers over broad abstractions.
- Do not add a frontend state management library.

## Migration And Local Setup

Add one Drizzle migration for:

- `saved_work_views`;
- workspace-level work item indexes.

Update `db:seed` to upsert saved views after members and work items exist.

`db:reset`, `db:migrate`, `db:seed`, e2e setup, and local Postgres behavior remain unchanged.

## Documentation And Extraction Notes

Phase finalization should update:

- `README.md` with v0.0.5 walkthrough and capabilities;
- `site/index.html` with daily dashboard, cross-project discovery, saved views, and quick capture;
- `docs/v0.0.5/jawstack-extraction-notes.md`.

Extraction topics:

- personal dashboard summary endpoints;
- URL-backed saved query state;
- validated `jsonb` view persistence;
- cross-resource discovery endpoints;
- route-based quick create;
- project navigation summary DTOs.

## Open Questions

No blocking open questions remain for implementation planning. The following are intentionally deferred:

- workspace-visible saved views;
- pinned or recent projects;
- full-text search indexes;
- configurable dashboards;
- notifications or digests;
- production authentication.
