# Worktrail v0.0.3 Technical Design

## Overview

Worktrail v0.0.3 adds a lightweight planning layer to the existing local-first Angular/API/Postgres application:

- project milestones;
- milestone assignment on work items;
- persisted board ordering;
- richer work item search, filters, and sorts;
- a project planning dashboard;
- release documentation and product site updates.

The release should preserve the current architecture:

- Angular standalone components served locally and buildable as a static SPA;
- shared TypeScript contracts in `packages/contracts`;
- transport-neutral API endpoint handlers;
- local Express adapter;
- service/repository backend layering;
- Drizzle-managed Postgres schema and migrations;
- deterministic local seed data and e2e smoke coverage.

v0.0.3 should not add AWS infrastructure, production auth, custom workflows, or a generic framework abstraction.

## Design Decisions

- Add milestones as project-scoped resources with their own table, service, endpoints, and UI surface.
- Add a dedicated project planning page at `/projects/:projectId/planning`; keep project home as the summary entry point.
- Manage milestones primarily from the planning page, with a navigation link from settings.
- Add nullable `milestone_id` to work items.
- Add integer `board_position` to work items for persisted status-column ordering.
- Use sparse integer board positions with transactional compaction when no gap exists.
- Add a command endpoint for board moves instead of overloading the status transition endpoint.
- Do not record activity for pure same-column reorders in v0.0.3.
- Continue recording `work_item.status_changed` for cross-status board moves.
- Record `work_item.milestone_changed` for milestone assignment changes.
- Add milestone lifecycle activity events.
- Start text search with case-insensitive `ILIKE` across display key, title, and description.
- Add a dedicated planning summary endpoint instead of composing the dashboard from several client calls.
- Keep milestone completion manual. The dashboard can reveal completion readiness, but it should not auto-complete milestones.
- Keep Angular CDK DragDrop for board movement; do not introduce Angular Material visual components.

## Data Model Changes

### Constants

Add milestone statuses:

```ts
export const milestoneStatuses = ['planned', 'active', 'completed', 'canceled'] as const;
export type MilestoneStatus = (typeof milestoneStatuses)[number];
```

Add due date filter states in contracts and endpoint validation:

```ts
export type DueDateState = 'overdue' | 'due_soon' | 'none';
```

Extend work item sorts:

```ts
export type WorkItemSort =
  | 'updated_desc'
  | 'updated_asc'
  | 'priority_desc'
  | 'priority_asc'
  | 'due_date_asc'
  | 'created_desc'
  | 'board_order';
```

### Milestones Table

Add `milestones`:

```text
id uuid primary key
workspace_id uuid not null references workspaces(id)
project_id uuid not null references projects(id)
name text not null
description text not null default ''
status text not null
target_date date null
archived_at timestamptz null
archived_by_id uuid null references members(id)
created_at timestamptz not null
updated_at timestamptz not null
```

Constraints and indexes:

```text
milestones_status_check status in ('planned', 'active', 'completed', 'canceled')
milestones_project_id_status_idx (project_id, status)
milestones_project_id_target_date_idx (project_id, target_date)
milestones_project_id_archived_at_idx (project_id, archived_at)
milestones_project_id_active_name_unique unique (project_id, lower(name)) where archived_at is null
```

Semantics:

- `archived_at is null` means the milestone is available in normal project planning.
- Archived milestones remain readable and remain attached to historical work items.
- Completed and canceled milestones are not archived automatically.
- Assignment controls show active, planned, and already-assigned milestones by default.
- Planning dashboards include non-archived planned/active milestones by default and can show completed/canceled milestones in management lists.

### Work Items

Add:

```text
milestone_id uuid null references milestones(id)
board_position integer not null default 0
```

Indexes:

```text
work_items_project_id_milestone_id_idx (project_id, milestone_id)
work_items_project_id_status_board_position_idx (project_id, status, board_position)
work_items_project_id_due_date_idx (project_id, due_date)
work_items_project_id_reporter_id_idx (project_id, reporter_id)
```

Backfill:

- `milestone_id` is `null` for existing work items.
- `board_position` is backfilled per `(project_id, status)`.
- Backfill order should use `updated_at desc, item_number asc`.
- Positions should be assigned as `1024, 2048, 3072...`.

New work item behavior:

- New work items are inserted at the top of their initial status column.
- The repository should compute a new top position as `min(board_position) - 1024`.
- If the status column is empty, use `1024`.

Negative positions are allowed. They keep top insertion cheap without rewriting a column.

### Activity Events

Extend activity event types:

```text
milestone.created
milestone.name_changed
milestone.description_changed
milestone.status_changed
milestone.target_date_changed
milestone.archived
milestone.reactivated
work_item.milestone_changed
```

Do not add a pure reorder activity event in v0.0.3. Same-column reorder history is low signal and can create noise. Cross-status board moves continue to record `work_item.status_changed`; metadata may include previous and new board positions.

## Contract Changes

Add milestone contracts:

```ts
export type MilestoneStatus = 'planned' | 'active' | 'completed' | 'canceled';

export interface MilestoneDto {
  id: string;
  workspaceId: string;
  projectId: string;
  name: string;
  description: string;
  status: MilestoneStatus;
  targetDate: string | null;
  isArchived: boolean;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMilestoneRequest {
  name: string;
  description?: string;
  status?: MilestoneStatus;
  targetDate?: string | null;
}

export interface UpdateMilestoneRequest {
  name?: string;
  description?: string;
  status?: MilestoneStatus;
  targetDate?: string | null;
}
```

Extend work item DTOs:

```ts
export interface WorkItemListItemDto {
  // existing fields...
  milestone: MilestoneDto | null;
  boardPosition: number;
}
```

Extend create/update work item requests:

```ts
export interface CreateWorkItemRequest {
  // existing fields...
  milestoneId?: string | null;
}

export interface UpdateWorkItemRequest {
  // existing fields...
  milestoneId?: string | null;
}
```

Add board move request:

```ts
export interface MoveWorkItemOnBoardRequest {
  status: WorkItemStatus;
  beforeWorkItemId?: string | null;
  afterWorkItemId?: string | null;
}
```

Rules:

- `beforeWorkItemId` and `afterWorkItemId` are optional neighbor hints in the target column.
- Both cannot refer to the moving work item.
- If both are present, they must belong to the same project and target status and be adjacent after excluding the moving item.
- If neither is present, the item moves to the top of the target status.

Extend filters:

```ts
export interface WorkItemListFilters {
  status?: WorkItemStatus;
  assigneeId?: string;
  reporterId?: string;
  type?: WorkItemType;
  labelId?: string;
  milestoneId?: string;
  priority?: WorkItemPriority;
  dueDateState?: DueDateState;
  search?: string;
  sort?: WorkItemSort;
}
```

Add planning summary contracts:

```ts
export interface MilestoneProgressDto {
  milestone: MilestoneDto;
  totalCount: number;
  doneCount: number;
  blockedCount: number;
  overdueCount: number;
}

export interface PlanningRiskItemDto {
  id: string;
  displayKey: string;
  title: string;
  status: WorkItemStatus;
  priority: WorkItemPriority;
  assignee: MemberDto | null;
  dueDate: string | null;
  milestone: MilestoneDto | null;
  updatedAt: string;
}

export interface ProjectPlanningSummaryDto {
  project: ProjectDto;
  milestoneProgress: MilestoneProgressDto[];
  blockedWork: PlanningRiskItemDto[];
  overdueWork: PlanningRiskItemDto[];
  dueSoonWork: PlanningRiskItemDto[];
  unassignedActiveWork: PlanningRiskItemDto[];
  staleInProgressWork: PlanningRiskItemDto[];
}
```

## Backend Design

### Repository Layer

Add `MilestoneRepository`:

- `create(input)`;
- `findById(id)`;
- `listByProject(projectId, options)`;
- `findActiveByProjectAndName(projectId, name)`;
- `update(id, input)`;
- `archive(id, archivedById, timestamp)`;
- `reactivate(id, timestamp)`.

Extend `WorkItemRepository`:

- include `milestoneId` and `boardPosition` in create/update inputs;
- support filters for `reporterId`, `milestoneId`, and `dueDateState`;
- search `display_key`, `title`, and `description` with `ILIKE`;
- support `due_date_asc`, `created_desc`, and `board_order` sorts;
- add `findBoardNeighbors(projectId, status, beforeId, afterId, movingId)`;
- add `listByProjectAndStatusForBoard(projectId, status)`;
- add `getTopBoardPosition(projectId, status)`;
- add `compactBoardPositions(projectId, status)`;
- add `moveOnBoard(id, status, boardPosition, updatedAt)`.

Add planning summary repository helpers either to `WorkItemRepository` or a small `PlanningRepository`:

- milestone progress counts grouped by milestone and status;
- risk lists for blocked, overdue, due soon, unassigned active, and stale in-progress work.

Prefer a `PlanningRepository` if the SQL becomes summary-specific. Avoid pushing dashboard query assembly into endpoint handlers.

### Board Position Algorithm

Use sparse integer ranks:

- Default spacing is `1024`.
- Top insertion uses `min(position) - 1024`.
- Bottom insertion uses `max(position) + 1024`.
- Between two neighbors, use `floor((before.position + after.position) / 2)` when the gap is greater than `1`.
- If there is no integer gap, compact the target status column to `1024, 2048, 3072...` inside the same transaction, reload neighbor positions, then compute the new position.

Board move transaction:

1. Load the moving work item.
2. Load and validate the project.
3. Reject archived projects.
4. Validate workflow transition if target status differs from current status.
5. Lock the moving row and target status rows needed for neighbor validation.
6. Validate neighbor ids belong to the same project and target status.
7. Compute or compact `board_position`.
8. Update status, board position, and `updated_at`.
9. Record `work_item.status_changed` only when status changes.
10. Return the updated work item detail DTO.

Concurrency behavior:

- The command is deterministic for the committed database state at execution time.
- Stale neighbor hints fail with a validation error if they no longer describe a valid target column placement.
- The client should reload the board after a failed move.

### Milestone Service

Add `MilestoneService`.

Responsibilities:

- require project membership through workspace id;
- reject writes for archived projects;
- validate role permissions;
- normalize and validate names;
- enforce active-name uniqueness;
- create, update, archive, and reactivate milestones;
- record milestone activity events;
- return milestone DTOs.

Permission rules:

- Owners and maintainers can create, update, archive, and reactivate milestones.
- Contributors can read milestones.
- Contributors can assign active milestones to work items if the existing work item edit rules allow the edit.

The existing app has placeholder auth only. These rules are still valuable because they exercise role-aware service paths.

### Work Item Service

Extend `WorkItemService`:

- validate `milestoneId` on create/update;
- allow clearing `milestoneId` with `null`;
- reject assignment to archived milestones unless the work item is already assigned to that milestone and the assignment is unchanged;
- include milestone data in DTO mapping;
- compute initial `boardPosition` during create;
- record `work_item.milestone_changed` when assignment changes;
- add `moveWorkItemOnBoard`.

`transitionWorkItem` should remain as the status-menu fallback. For v0.0.3 it should assign an appropriate top position in the destination status when status changes through the dropdown.

### Planning Service

Add `PlanningService`.

Responsibilities:

- require readable project;
- compute active planning summary;
- centralize due-soon and stale thresholds;
- return `ProjectPlanningSummaryDto`.

Thresholds:

```text
due soon: due date from today through today + 7 days, excluding done/canceled
stale in progress: status = in_progress and updated_at before now - 7 days
```

Use the service clock for tests.

### Endpoint Design

Add milestone endpoints:

```text
GET    /api/projects/:projectId/milestones
POST   /api/projects/:projectId/milestones
PATCH  /api/milestones/:milestoneId
POST   /api/milestones/:milestoneId/archive
POST   /api/milestones/:milestoneId/reactivate
```

Milestone list query:

```text
includeArchived=true|false
status=planned|active|completed|canceled
```

Add planning endpoint:

```text
GET /api/projects/:projectId/planning-summary
```

Add board move endpoint:

```text
POST /api/work-items/:workItemId/board-move
```

Extend existing work item endpoints:

- `GET /api/projects/:projectId/work-items` accepts new filters and sorts.
- `POST /api/projects/:projectId/work-items` accepts `milestoneId`.
- `PATCH /api/work-items/:workItemId` accepts `milestoneId`.
- `POST /api/work-items/:workItemId/transitions` updates board position when status changes.

All new endpoints should follow the existing endpoint handler pattern so they can be adapted to Express now and API Gateway/Lambda later.

## Frontend Design

### API Client

Extend `WorktrailApiService`:

- `listProjectMilestones(projectId, filters?)`;
- `createMilestone(projectId, input)`;
- `updateMilestone(milestoneId, input)`;
- `archiveMilestone(milestoneId)`;
- `reactivateMilestone(milestoneId)`;
- `getProjectPlanningSummary(projectId)`;
- `moveWorkItemOnBoard(workItemId, input)`.

Extend `WorkItemListFilters` to include `reporterId`, `milestoneId`, `dueDateState`, and new sorts.

### Routing

Add:

```text
/projects/:projectId/planning
```

Update project navigation across home, list, board, settings, and planning:

- Planning
- List
- Board
- Settings
- Create work item where writable

### Planning Page

Create `ProjectPlanningPageComponent`.

Responsibilities:

- load project planning summary;
- render milestone progress;
- render blocked, overdue, due soon, unassigned active, and stale in-progress lists;
- link summary rows to filtered work item list URLs;
- provide milestone management controls for owners/maintainers;
- show compact empty states.

Milestone management can be in-page, using a small form and editable table/list. Do not use nested card layouts. Keep sections as full-width bands or simple panels.

### Project Home

Keep the current project home lightweight:

- link to planning;
- show a compact snapshot of active milestone progress if the data is already available cheaply;
- do not duplicate the full planning dashboard.

### Work Item List

Extend filters:

- search placeholder should mention key, title, or description;
- milestone select;
- reporter select if backend support lands in the same phase;
- due date state select;
- new sort options.

Keep filter state in URL query params:

- initialize form from `ActivatedRoute.queryParamMap`;
- update URL on apply;
- preserve route reload behavior;
- clear filters by navigating to the same route without query params.

Show active filter indicators compactly above the result list. Empty state should distinguish "no work items" from "no filtered results".

### Board

Update board drag/drop:

- same-column drop calls `moveWorkItemOnBoard`;
- cross-column drop calls `moveWorkItemOnBoard`;
- send neighbor ids based on the post-drop client order;
- optimistically update the UI while the command is pending;
- reload board after success to use server-confirmed ordering;
- restore previous column state and show an error after failure;
- keep status dropdown fallback.

Board query should request `sort=board_order`. Board cards should show milestone only when present and without making cards tall.

### Work Item Create And Detail

Add milestone controls:

- create page loads active milestones;
- detail page loads active milestones plus the currently assigned milestone if archived/completed/canceled;
- saved work item DTO updates list/detail state;
- archived projects keep controls disabled.

Keep due date and estimate controls visible in the existing form layout.

## Migration And Seed Design

Add one v0.0.3 migration:

- create `milestones`;
- add `work_items.milestone_id`;
- add `work_items.board_position`;
- add indexes and constraints;
- extend activity event check constraint;
- backfill board positions.

Seed updates:

- create deterministic milestones for the active Worktrail project, such as `v0.0.3 Planning` and `Cloud Readiness`;
- assign a mix of work items to milestones;
- include one completed or canceled milestone for historical display;
- set due dates so dashboard shows blocked, overdue, due soon, unassigned, and stale examples;
- seed board positions that demonstrate ordering.

## Testing Strategy

### Backend

Add or extend tests for:

- milestone create/update/archive/reactivate;
- milestone name uniqueness;
- archived-project write blocking for milestones and board moves;
- milestone assignment on create/update;
- assignment rejection for archived milestones;
- milestone assignment activity;
- board move same-column reorder;
- board move cross-status transition and ordering;
- stale neighbor validation;
- transition endpoint board-position behavior;
- search across display key, title, and description;
- combined filters and new sorts;
- planning summary counts and risk lists.

### Frontend

Add or extend tests for:

- planning page loading and empty states;
- milestone create/update interactions;
- work item list URL filter state;
- milestone and due-date filters;
- board move request payload generation;
- failed board move rollback;
- create/detail milestone controls.

### E2E

Extend the smoke test:

1. Reset, migrate, and seed.
2. Open planning page.
3. Create a milestone.
4. Assign a work item to it.
5. Filter the work item list by milestone.
6. Reorder a board column and reload to verify persistence.
7. Confirm planning dashboard shows seeded risk data.

## Verification

Before release, run:

```sh
npm run db:reset
npm run db:migrate
npm run db:seed
npm run typecheck
npm test
npm run test:e2e
npm run build
git diff --check
```

Expected known warnings should be documented if they still exist, but new TypeScript, Angular, migration, or test warnings should be resolved.

## Documentation And Site

Update:

- `README.md` repository layout and demo walkthrough for v0.0.3;
- v0.0.3 capabilities and limitations;
- static site hero/body copy for planning, milestones, ordering, and dashboard visibility;
- `docs/v0.0.3/jawstack-extraction-notes.md` after implementation.

## Cloud Readiness Notes

The v0.0.3 work should preserve future AWS deployment paths:

- endpoint handlers remain independent from Express request/response objects;
- board move and milestone mutations are command-style service methods that can map cleanly to Lambda handlers;
- planning summary endpoint keeps dashboard aggregation server-side and cacheable later;
- Postgres transactions are explicit where ordering and workflow validity require them;
- no browser-only persistence is used for planning or ordering state.

## Deferred Work

Defer these unless implementation proves unusually small:

- Postgres full-text search or trigram indexes;
- custom milestone fields;
- cross-project planning;
- milestone burndown charts;
- automatic milestone completion;
- reorder activity feed events;
- optimistic conflict resolution beyond rollback/reload;
- real-time board updates.

