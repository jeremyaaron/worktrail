# Worktrail v0.0.2 Technical Design

## Overview

Worktrail v0.0.2 extends the v0.0.1 local-first Angular/API/Postgres app with the product surfaces needed for early team adoption:

- human-friendly work item keys;
- project settings;
- label administration;
- comment edit/delete;
- board drag and drop;
- broader activity coverage.

The release should keep the existing architectural posture: Angular static frontend, TypeScript API with transport-neutral endpoint handlers, local Express adapter, Drizzle migrations, and Postgres persistence. v0.0.2 should not introduce AWS infrastructure, production authentication, or a generic framework layer.

## Design Decisions

- Use Angular CDK DragDrop for board card movement.
- Do not introduce Angular Material components.
- Store immutable work item display keys, such as `APP-42`.
- Allow project key edits only before the project has work items.
- Use project-scoped numeric counters allocated inside a Postgres transaction.
- Archive labels instead of hard-deleting them.
- Treat archived projects as read-only for work item, comment, transition, and label writes.
- Represent deleted comments as visible tombstones in the comment thread.
- Record project, label, and comment lifecycle activity.
- Surface project-level activity on project home or settings if implementation cost stays reasonable.

## Dependency Changes

Add one frontend dependency:

```sh
npm install @angular/cdk --workspace @worktrail/web
```

Use the Angular CDK version compatible with the installed Angular major version. CDK is justified because cross-column drag/drop requires pointer tracking, connected drop lists, placeholders, drag previews, touch behavior, and cleanup semantics that should not be hand-rolled for this sprint.

## Data Model Changes

### Projects

Add:

```text
key text not null
next_work_item_number integer not null default 1
```

Constraints and indexes:

```text
projects_workspace_id_key_unique unique (workspace_id, key)
projects_key_check key ~ '^[A-Z0-9]{2,8}$'
projects_next_work_item_number_check next_work_item_number > 0
```

Migration behavior:

- assign deterministic keys to seeded/existing projects;
- set `next_work_item_number` to the next available number after migrated work items;
- reject duplicate generated keys during migration rather than silently assigning unstable values.

### Work Items

Add:

```text
item_number integer not null
display_key text not null
```

Constraints and indexes:

```text
work_items_project_id_item_number_unique unique (project_id, item_number)
work_items_workspace_id_display_key_unique unique (workspace_id, display_key)
work_items_item_number_check item_number > 0
```

`display_key` is immutable after creation. Existing work items receive deterministic numbers ordered by `created_at, id`. Future work item creation locks the project row, reads `next_work_item_number`, increments it, and stores both `item_number` and `display_key`.

Rationale:

- stable references matter more than retroactive key renames;
- storing `display_key` keeps list/detail DTOs simple;
- project key edits can be safely blocked after the first work item exists;
- Postgres row locking gives correct local and future managed-Postgres behavior.

### Labels

Add:

```text
archived_at timestamptz
archived_by_id uuid references members(id)
```

Semantics:

- active labels have `archived_at is null`;
- archived labels remain attached to existing work items;
- archived labels are shown on existing work items with muted styling;
- archived labels are excluded from normal assignment controls;
- archived labels can be reactivated from label administration.

Indexes:

```text
labels_project_id_active_name_unique unique (project_id, lower(name)) where archived_at is null
labels_project_id_archived_at_idx (project_id, archived_at)
```

If Drizzle migration generation cannot express the partial unique index cleanly, add the index in committed SQL.

### Comments

Add:

```text
edited_at timestamptz
deleted_at timestamptz
deleted_by_id uuid references members(id)
```

Semantics:

- editing updates `body`, `updated_at`, and `edited_at`;
- deleting sets `deleted_at`, `deleted_by_id`, clears or replaces `body` with an empty string, and updates `updated_at`;
- deleted comments remain in the comment list as tombstones;
- deleted comments cannot be edited or deleted again.

The API should not expose deleted comment body text.

### Activity Events

Add event types:

```text
project.name_changed
project.description_changed
project.archived
project.reactivated
label.created
label.name_changed
label.color_changed
label.archived
label.reactivated
comment.edited
comment.deleted
```

Keep activity event values as text plus check constraints, following v0.0.1. Activity metadata should include stable ids such as `projectId`, `labelId`, or `commentId`. Comment edit/delete activity should not store full comment body text.

## Contract Changes

Update `packages/contracts` types.

Project DTO:

```ts
export interface ProjectDto {
  id: string;
  workspaceId: string;
  key: string;
  name: string;
  description: string;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
}
```

Create/update project requests:

```ts
export interface CreateProjectRequest {
  key?: string;
  name: string;
  description?: string;
}

export interface UpdateProjectRequest {
  key?: string;
  name?: string;
  description?: string;
  status?: ProjectStatus;
}
```

Work item DTOs:

```ts
export interface WorkItemListItemDto {
  id: string;
  displayKey: string;
  itemNumber: number;
  // existing fields...
}
```

Label DTO:

```ts
export interface LabelDto {
  id: string;
  name: string;
  color: string | null;
  isArchived: boolean;
  archivedAt: string | null;
}
```

Comment DTO:

```ts
export interface CommentDto {
  id: string;
  workItemId: string;
  author: MemberDto;
  body: string;
  isEdited: boolean;
  isDeleted: boolean;
  editedAt: string | null;
  deletedAt: string | null;
  deletedBy: MemberDto | null;
  createdAt: string;
  updatedAt: string;
}
```

Add requests:

```ts
export interface CreateLabelRequest {
  name: string;
  color?: string | null;
}

export interface UpdateLabelRequest {
  name?: string;
  color?: string | null;
}

export interface UpdateCommentRequest {
  body: string;
}
```

## Backend Design

### Project Service

Add project-key behavior to `ProjectService`.

Responsibilities:

- normalize keys to uppercase;
- generate a key from project name when omitted;
- validate `^[A-Z0-9]{2,8}$`;
- enforce workspace-level uniqueness;
- reject key updates after the project has any work items;
- archive/reactivate projects through explicit service methods;
- record project activity for metadata and status changes.

Project key generation:

- take uppercase alphanumeric initials from the project name where possible;
- fallback to the first 2-8 alphanumeric characters;
- append a short numeric suffix only if needed for uniqueness;
- return a validation error if no key can be generated.

### Work Item Service

Update `createWorkItem` to allocate display keys transactionally.

Algorithm:

1. Begin transaction.
2. Load the project row with a lock.
3. Reject if project is archived.
4. Use `project.nextWorkItemNumber` as the new item number.
5. Increment `nextWorkItemNumber`.
6. Insert the work item with `itemNumber` and `displayKey`.
7. Attach labels.
8. Record `work_item.created`.
9. Return detail DTO.

Drizzle may need a small raw SQL helper for `select ... for update` or an atomic `update projects set next_work_item_number = next_work_item_number + 1 returning key, next_work_item_number - 1 as item_number`.

Other work item write methods should reject writes when the parent project is archived:

- update work item;
- transition work item;
- create comment;
- update comment;
- delete comment;
- label assignment through work item update.

### Label Service

Add a dedicated `LabelService`.

Responsibilities:

- list labels by project, with `includeArchived` support;
- create labels;
- update label name/color;
- archive labels;
- reactivate labels;
- validate project ownership and active project state for writes;
- prevent duplicate active label names within a project;
- record label activity.

Label archive behavior:

- archiving a label does not remove existing work item assignments;
- archived labels cannot be newly assigned;
- reactivation restores normal assignment availability if no active label conflicts with its name.

### Comment Service

Extend `CommentService`.

Responsibilities:

- update comment body;
- soft-delete comment;
- enforce role/ownership permissions;
- reject operations on deleted comments;
- reject writes under archived projects;
- record `comment.edited` and `comment.deleted`.

Permission rules:

- owners can edit/delete any comment in their workspace;
- maintainers can edit/delete any comment in their workspace;
- contributors can edit/delete only their own comments;
- all actors must belong to the comment workspace.

Comment deletion should clear exposed body content and return a tombstone DTO.

### Activity Service

Existing activity repository queries are sufficient for v0.0.2 if they can list by project and work item. Add DTO mapping support for new event types and nullable `workItemId` project-level events.

Project-level activity should include:

- project setting changes;
- project archive/reactivate;
- label lifecycle events;
- work item events already scoped to the project.

## API Design

Keep REST-style routes under `/api`. Use explicit command routes for lifecycle transitions where generic `PATCH` would obscure product rules.

### Projects

Existing:

```text
GET    /api/projects
POST   /api/projects
GET    /api/projects/:projectId
PATCH  /api/projects/:projectId
GET    /api/projects/:projectId/summary
GET    /api/projects/:projectId/activity
```

Add:

```text
POST   /api/projects/:projectId/archive
POST   /api/projects/:projectId/reactivate
```

`PATCH /api/projects/:projectId` handles name, description, and key updates. `status` may remain supported for backward compatibility, but the UI should use archive/reactivate commands.

### Labels

Existing:

```text
GET    /api/projects/:projectId/labels
```

Update:

```text
GET    /api/projects/:projectId/labels?includeArchived=true
POST   /api/projects/:projectId/labels
PATCH  /api/labels/:labelId
POST   /api/labels/:labelId/archive
POST   /api/labels/:labelId/reactivate
```

Do not add hard delete in v0.0.2.

### Work Items

Existing routes remain.

Update behavior:

- `POST /api/projects/:projectId/work-items` accepts `labelIds`;
- work item responses include `displayKey` and `itemNumber`;
- writes reject archived projects with `409 Conflict` or `403 Forbidden`; prefer `409 Conflict` because project state blocks the operation.

Board drag/drop uses:

```text
POST /api/work-items/:workItemId/transitions
```

No ordering endpoint is needed in v0.0.2.

### Comments

Existing:

```text
GET    /api/work-items/:workItemId/comments
POST   /api/work-items/:workItemId/comments
```

Add:

```text
PATCH  /api/comments/:commentId
DELETE /api/comments/:commentId
```

Use `DELETE` for soft-delete because the client intent is deletion, even though the implementation keeps a tombstone.

## Frontend Design

### Routes

Add:

```text
/projects/:projectId/settings
```

Settings can start as one routed page with sections:

- project details;
- project status;
- labels;
- recent project activity if implemented in the UI.

Keep the page dense and operational. Do not make it a marketing-style settings dashboard.

### Project List And Home

Changes:

- display project key next to project name;
- add Settings link from project home actions;
- show archived status prominently;
- show project activity panel if data is already available.

### Work Item List And Detail

Changes:

- display `displayKey` before title;
- include key in detail page header;
- include labels on create form;
- prevent or disable write controls when project is archived;
- show archived labels with muted treatment.

### Label Administration UI

Use a compact table/list under project settings.

Controls:

- create label form with name and color input;
- edit inline or with a small local edit row;
- archive/reactivate action;
- active/archived filter or grouped sections.

Use native color input if acceptable. Avoid adding a color-picker dependency.

### Comment Lifecycle UI

On work item detail:

- show Edit/Delete actions per comment based on actor permissions if easy to infer;
- still handle server rejections;
- edit inline with textarea and Save/Cancel;
- delete with confirmation;
- render deleted comments as tombstones;
- show an edited marker for edited comments.

### Board Drag And Drop

Use `@angular/cdk/drag-drop`.

Implementation shape:

- each status column is a `cdkDropList`;
- columns are connected through `cdkDropListConnectedTo`;
- each card is a `cdkDrag`;
- the drop handler compares source and target status;
- no-op drops do nothing;
- valid-looking drops call the transition endpoint;
- the board reloads or re-groups after success;
- rejected transitions restore the original grouping and show an error.

Use pessimistic updates for v0.0.2:

- do not permanently move the card before the API confirms;
- CDK may visually move during drag, but component state should remain server-backed;
- after success, refresh or update the card status from the response;
- after failure, keep the original board state.

Ordering:

- do not persist card ordering in v0.0.2;
- intra-column drag can snap back or be disabled;
- if CDK makes intra-column visual reordering unavoidable during drag, reload the board from server state after drop.

Accessibility:

- keep the existing status menu on every card;
- ensure card titles and status controls remain keyboard reachable;
- do not rely on drag/drop as the only movement path.

## Validation Rules

Project keys:

- trim;
- uppercase;
- match `^[A-Z0-9]{2,8}$`;
- unique within actor workspace;
- cannot change after project has work items.

Labels:

- name required after trim;
- project-level active names unique case-insensitively;
- color nullable or `#[0-9A-Fa-f]{6}`;
- archived labels cannot be assigned to new work item updates.

Comments:

- body required after trim for create/update;
- cannot update/delete deleted comments;
- cannot update/delete comments in archived projects.

Archived projects:

- allow reads;
- allow project reactivation;
- reject work item writes;
- reject comment writes;
- reject label writes;
- reject status transitions.

## Migration And Seed Plan

Migration:

1. Add nullable project key/counter and work item key fields.
2. Backfill project keys deterministically.
3. Backfill work item numbers by project.
4. Backfill display keys.
5. Set project counters to max number + 1.
6. Add not-null constraints.
7. Add unique/check indexes and constraints.
8. Add label archived fields.
9. Add comment edited/deleted fields.
10. Extend activity event check constraint.

Seed:

- Worktrail App key: `WT`;
- Cloud Readiness key: `CLOUD`;
- Legacy Tracker key: `LEGACY`;
- existing seeded work items receive stable keys in creation order;
- add at least one archived label in seed data;
- add one edited comment and one deleted-comment tombstone only if it helps demo the UI without clutter.

## Testing Strategy

### Backend

Add or extend tests for:

- project key generation;
- project key uniqueness;
- project key update blocked after work items exist;
- work item key allocation under normal creation;
- work item key allocation inside a transaction;
- archived project write rejection;
- label create/update/archive/reactivate;
- archived label assignment rejection;
- comment edit/delete permission rules;
- comment tombstone DTO mapping;
- project, label, and comment activity events;
- transition endpoint behavior remains unchanged.

### Frontend

Add or extend Angular tests for:

- project settings load/save/archive/reactivate;
- label administration create/update/archive/reactivate;
- work item create label assignment;
- display keys in list, board, detail, and recent work;
- comment edit/delete UI states;
- archived project disabled write controls;
- board drop success and rejected transition behavior.

### End-To-End

Extend Playwright with a v0.0.2 adoption path:

1. reset/migrate/seed database;
2. create or open a project;
3. create a label;
4. create a work item with the label;
5. verify display key;
6. drag from backlog to ready and then to in progress;
7. add and edit a comment;
8. delete the comment;
9. verify activity.

Keep the v0.0.1 smoke path or fold its coverage into the new path only if the result remains fast and readable.

## Cloud Readiness Implications

v0.0.2 still does not deploy to AWS, but these choices preserve the path:

- static Angular output remains deployable to S3/CloudFront;
- CDK DragDrop is frontend-only and does not affect hosting;
- endpoint handlers remain transport-neutral;
- project-scoped counters use Postgres transaction semantics compatible with managed Postgres;
- explicit command routes map cleanly to API Gateway routes;
- activity events remain structured enough for future audit/export/event-feed work.

The technical risk to revisit before one-click deployment is database migration execution in managed environments. v0.0.2 should continue using local migration scripts, but the implementation notes should record what would be needed for deployment automation.

## Jawstack Extraction Notes To Capture

After implementation, update extraction notes for:

- scoped sequence allocation;
- settings screen shape;
- taxonomy administration;
- lifecycle command routes;
- soft-delete/tombstone behavior;
- activity event helper patterns;
- Angular CDK board command integration.

Do not extract these patterns into `jawstack` during v0.0.2.

## Resolved Implementation Details

- Atomic project counter allocation should use a small repository helper backed by SQL equivalent to `update projects set next_work_item_number = next_work_item_number + 1 returning key, next_work_item_number - 1 as item_number`. Use raw SQL if Drizzle cannot express this clearly.
- Project activity should appear on the project settings page first. Add it to project home only if the settings implementation leaves the activity component reusable at low cost.
- Archived labels should appear in label administration and on work items where already attached. Normal assignment controls and list filter controls should show active labels only.
- Contributors can edit/delete their own comments only while the parent project is active. Archived projects block comment edits/deletes for every role except project reactivation flows.
- Board drag/drop should reload the full board after each successful transition in v0.0.2. Add per-card loading only if full reload creates obvious UX friction.
