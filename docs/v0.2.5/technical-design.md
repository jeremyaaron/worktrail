# Worktrail v0.2.5 Technical Design

## Status

Implemented

## Summary

v0.2.5 adds Work Breakdown through a bounded, two-level parent/child model.

Each work item gains one optional parent reference. A top-level work item may contain child work, but a
child may not contain children. Parent and child must belong to the same workspace and project. Every
item keeps its own type, workflow status, assignee, priority, estimate, milestone, cycle, due date,
labels, dependencies, comments, watchers, and activity.

The implementation adds:

- a nullable indexed self-reference on `work_items`;
- transactional hierarchy validation and stable row locking;
- a focused parent replacement command;
- bounded child and parent-candidate reads;
- shallow parent identity and derived child summaries in work item DTOs;
- canonical hierarchy and exact-parent query parameters;
- hierarchy context in detail, list, board, My Work, and live planning/review rows;
- child creation through the existing work item form;
- CSV export columns and activity coverage;
- deterministic seed, browser, OpenAPI, and release documentation updates.

The design does not add recursive trees, epics, new work item types, nested lists or boards, automatic
status changes, estimate rollups, hierarchy-derived dependencies, bulk reparenting, or snapshot
rewrites.

## Resolved Decisions

### Hierarchy Depth

Use exactly two structural levels:

```text
top-level work item
└── child work item
```

A work item may be:

- top-level with no children;
- top-level with one or more children; or
- a child with exactly one parent.

An item may not be both a parent and a child.

Rationale:

- deliverable-to-task decomposition covers the immediate product need;
- all validation can be performed with bounded reads and locks;
- list and detail DTOs remain shallow;
- status and estimate semantics do not require recursive aggregation;
- a deeper hierarchy would need separate UX, query, ordering, and performance decisions.

### Persistence Model

Add `parent_work_item_id` directly to `work_items` rather than introducing a new relationship type.

Rationale:

- containment has one-parent cardinality that a generic edge table does not express naturally;
- parent assignment is not symmetric and is not dependency state;
- the nullable foreign key makes top-level and child queries direct;
- a project/parent index supports child reads and parent summaries;
- the existing `work_item_relationships` table remains specific to `blocks` and `relates_to`.

### Parent Mutation API

Use a focused idempotent command:

```text
PUT /api/work-items/:workItemId/parent
```

Request:

```json
{ "parentWorkItemId": "uuid-or-null" }
```

Do not add `parentWorkItemId` to `UpdateWorkItemRequest`. Accept it on `CreateWorkItemRequest` so a
child can be created atomically.

Rationale:

- a required property distinguishes clear (`null`) from omission;
- parent replacement has locking and validation rules unlike ordinary scalar edits;
- the command can be retried safely;
- activity and conflict responses stay focused;
- the general update service does not acquire hierarchy locks for unrelated edits.

### Child Read API

Use a bounded child collection endpoint:

```text
GET /api/work-items/:workItemId/children?limit=25
```

Return a collection envelope with `items`, `totalCount`, and `hasMore`. Default to 25 rows and cap
`limit` at 100.

Rationale:

- full child rows do not inflate every detail response;
- parent detail can load its child section independently;
- large parents remain bounded;
- `View all child work` uses the canonical Work query instead of pagination inside detail.

### Parent Candidate API

Use a focused candidate endpoint:

```text
GET /api/work-items/:workItemId/parent-candidates?search=term
```

Return at most 20 structurally eligible same-project items. Open work sorts before terminal work.

Rationale:

- the server can exclude children and enforce workspace/project scope;
- the UI does not load an unbounded project list;
- server validation still runs again during mutation;
- terminal parents remain available for historical or organizational containment.

### Exact-Parent Query Identity

Use the immutable display key in read URLs:

```text
parentKey=WT-42
```

Use UUIDs for writes and relational persistence.

Rationale:

- display keys are workspace-unique and immutable;
- copied URLs and active chips stay readable;
- an empty result can still identify the selected parent;
- users do not see opaque UUIDs in filtered-view state.

### Query Shape

Add:

```ts
export type WorkItemHierarchyFilter = 'top_level' | 'children' | 'parents';

export interface WorkItemQuery {
  // existing fields
  hierarchy?: WorkItemHierarchyFilter;
  parentKey?: string;
}
```

`hierarchy` and `parentKey` are mutually exclusive. `parentKey` means direct children of that exact
parent and therefore does not need `hierarchy=children` in the same URL.

The general hierarchy mode appears in filter forms. `parentKey` is primarily created by detail
drill-downs, preserved as hidden query state, shown as an active chip, and clearable from that chip.

### Estimate And Progress Semantics

Allow direct estimates on both parents and children. Do not calculate or persist a parent estimate from
children.

Derived child summaries show:

- total child count;
- open count;
- done count;
- canceled count;
- estimated count;
- unestimated count;
- sum of direct child estimates.

Existing project, milestone, cycle, portfolio, report, and closeout calculations continue counting each
work item record exactly as they do today. Parent and child estimates are independent inputs.

Rationale:

- changing established totals would be a hidden behavioral regression;
- teams may use parent estimates as direct coordination effort or leave them empty;
- configurable rollup policy requires more product evidence;
- explicit counts are more trustworthy than an implied completion percentage.

### Planning Independence

Do not inherit or synchronize milestone, cycle, status, assignee, priority, due date, labels, or estimate.

The child-create form may display the parent's current planning context, but fields remain normal user
choices and are not silently copied. Parent and child may be scheduled differently.

Cycle closeout continues acting only on direct cycle assignment. Parentage neither adds work to a cycle
nor moves work during closeout.

### Live Review And Snapshot Compatibility

Add compact parent context to normal list DTOs and live `PlanningRiskItemDto` rows.

`PlanningRiskItemDto.parent` is optional and nullable:

- live v0.2.5 responses provide it;
- old immutable status report snapshots may omit it;
- the status-report snapshot parser accepts omission;
- newly published snapshots retain it on applicable work rows;
- old closeout and report payloads are never backfilled or rewritten.

Do not change `ProjectCycleCloseoutItemSnapshotDto` in v0.2.5.

Rationale:

- current planning and review rows gain useful context;
- existing versioned JSONB remains valid;
- a future snapshot version can add hierarchy only when historical containment is a demonstrated need.

### Activity And Notifications

Add one activity type:

```ts
'work_item.parent_changed'
```

Record it on the child whose parent changed. Include stable previous and next parent identity in activity
values.

Do not add a hierarchy notification type. Current watcher notifications cover status, assignee,
comments, and relationships rather than every work item edit. Child creation still uses existing
assignment notifications and automatic reporter/assignee watching.

Rationale:

- activity makes the mutation auditable;
- a new generic watcher category would broaden notification policy beyond this feature;
- mirrored parent activity and watcher fan-out would create duplicate noise;
- parent-level digests can be designed later with notification preferences.

### CSV Behavior

Add `parent_key` and `parent_title` to project and workspace CSV exports. Leave CSV import unchanged.

Rationale:

- both columns make exported data understandable without another lookup;
- import needs ordering, unresolved-reference, duplicate-key, and cross-row validation that warrants a
  separate scope;
- export-only support is backward compatible for current import templates.

## Current Implementation Context

Relevant shared contracts:

```text
packages/contracts/src/work-items.ts
packages/contracts/src/planning.ts
packages/contracts/src/my-work.ts
packages/contracts/src/activity.ts
```

Relevant backend files:

```text
apps/api/src/db/schema.ts
apps/api/src/repositories/work-item-repository.ts
apps/api/src/repositories/work-item-query-builder.ts
apps/api/src/services/work-item-service.ts
apps/api/src/services/dto.ts
apps/api/src/services/work-item-csv-export-service.ts
apps/api/src/validation/work-item-query.ts
apps/api/src/endpoints/work-items.ts
apps/api/src/adapters/express/routes/work-item-routes.ts
apps/api/src/domain/constants.ts
```

Relevant frontend files:

```text
apps/web/src/app/core/api/work-items-api.ts
apps/web/src/app/features/work-items/work-item-create-page.component.ts
apps/web/src/app/features/work-items/work-item-detail-page.component.ts
apps/web/src/app/features/work-items/work-item-board-page.component.ts
apps/web/src/app/features/work-items/components/work-item-result-list.component.ts
apps/web/src/app/features/work-items/components/work-item-filter-panel.component.ts
apps/web/src/app/features/work-items/query/work-item-filter-state.ts
apps/web/src/app/features/work-items/query/work-item-query-serialization.ts
apps/web/src/app/features/work-items/query/work-item-filter-labels.ts
apps/web/src/app/features/work-items/state/work-list-query.store.ts
```

Existing reusable behavior:

- `withRepositoriesTransaction` creates transaction-scoped repositories;
- work item creation already runs transactionally when `db` is present;
- work item detail reloads when `:workItemId` changes on the reused route component;
- list and workspace reads already batch label and dependency enrichment;
- canonical work query helpers own URL, form, saved-view, return-URL, and export state;
- display keys are immutable and workspace-unique;
- project writes are blocked after archive;
- all active members can perform ordinary work item edits under current capability rules;
- activity values support structured previous/new payloads;
- child creation can reuse the existing project-scoped create route and form.

## Contract Design

### Parent Reference

Add a shallow reusable reference:

```ts
export interface WorkItemParentDto {
  id: string;
  projectId: string;
  displayKey: string;
  title: string;
  type: WorkItemType;
  status: WorkItemStatus;
}
```

Do not include parent labels, relationships, comments, activity, milestone, cycle, or another parent.

### Child Summary

```ts
export interface WorkItemChildSummaryDto {
  totalCount: number;
  openCount: number;
  doneCount: number;
  canceledCount: number;
  estimatedCount: number;
  unestimatedCount: number;
  estimatePoints: number;
}
```

Semantics:

- `openCount` includes `backlog`, `ready`, `in_progress`, and `blocked`;
- `doneCount` includes only `done`;
- `canceledCount` includes only `canceled`;
- `totalCount = openCount + doneCount + canceledCount`;
- `estimatedCount` counts non-null estimates, including zero;
- `unestimatedCount` counts null estimates;
- `estimatePoints` sums non-null direct child estimates with null treated as zero.

### List And Detail DTOs

Extend `WorkItemListItemDto`:

```ts
export interface WorkItemListItemDto {
  // existing fields
  parent: WorkItemParentDto | null;
  childSummary: WorkItemChildSummaryDto | null;
}
```

`childSummary` is `null` when the item has no children. `WorkItemDetailDto` and
`WorkspaceWorkItemListItemDto` inherit the same fields.

Making both fields required but nullable keeps API behavior explicit. Existing fixtures and consumers
must update rather than interpreting omission differently.

### Child Collection

```ts
export interface WorkItemChildrenDto {
  items: WorkItemListItemDto[];
  totalCount: number;
  hasMore: boolean;
}
```

Each returned child has `parent` populated and `childSummary: null` under the two-level invariant.

### Parent Candidate

```ts
export interface WorkItemParentCandidateDto extends WorkItemParentDto {
  priority: WorkItemPriority;
  updatedAt: string;
}
```

Candidates are top-level items. A candidate may already have children and remain eligible as a parent.

### Parent Command

```ts
export interface SetWorkItemParentRequest {
  parentWorkItemId: string | null;
}
```

The property is required. `null` clears the parent.

### Create Request

Extend only creation:

```ts
export interface CreateWorkItemRequest {
  // existing fields
  parentWorkItemId?: string | null;
}
```

Omitted and `null` both create top-level work. A UUID creates child work after validation.

### Planning Risk Rows

Extend:

```ts
export interface PlanningRiskItemDto {
  // existing fields
  parent?: WorkItemParentDto | null;
}
```

The optional property exists only for compatibility with stored v1 report snapshots. Live service
mappers always emit `parent`, including `null` for top-level work.

### Query Contract

```ts
export type WorkItemHierarchyFilter = 'top_level' | 'children' | 'parents';

export interface WorkItemQuery {
  // existing fields
  hierarchy?: WorkItemHierarchyFilter;
  parentKey?: string;
}
```

Normalize `parentKey` by trimming and uppercasing because display keys are stored canonically. Limit it
to 80 characters and validate the existing display-key shape where practical.

Reject a query containing both `hierarchy` and `parentKey` with the established validation error
response.

## Persistence Design

### Schema

Add a nullable self-reference to `workItems`:

```ts
parentWorkItemId: uuid('parent_work_item_id').references(
  (): AnyPgColumn => workItems.id,
  { onDelete: 'restrict' }
),
```

The explicit `AnyPgColumn` return avoids Drizzle's self-reference type cycle.

Add:

```text
check work_items_no_self_parent_check
  (parent_work_item_id is null or parent_work_item_id <> id)

index work_items_project_id_parent_work_item_id_idx
  (project_id, parent_work_item_id)
```

The existing workspace/display-key unique index supports resolving `parentKey`.

PostgreSQL foreign keys and checks do not enforce same-project ownership or two-level depth. Those
rules require inspecting other rows and remain transactional domain invariants. Do not add a database
trigger for v0.2.5; all public and seed paths must use validated service behavior or deterministic
fixtures.

### Migration

Generate migration `0015_*` through the existing Drizzle workflow and commit:

- SQL migration;
- metadata snapshot;
- journal update.

The migration is additive and nullable. Existing rows require no backfill and remain top-level.

Rollback guidance:

- application rollback before hierarchy data exists may drop the index, check, foreign key, and column;
- after hierarchy data exists, export parent keys before removing the column;
- production migrations remain forward-only in normal operation.

### Repository Read Shapes

Extend `createWorkItemRepository` with:

```ts
findManyByIdsForUpdate(ids: string[]): Promise<WorkItem[]>;
listChildren(parentWorkItemId: string, limit: number): Promise<WorkItem[]>;
hasChildren(parentWorkItemId: string): Promise<boolean>;
listEligibleParentCandidates(input: {
  workItem: WorkItem;
  search?: string;
  limit: number;
}): Promise<WorkItem[]>;
listParentsForChildren(workItemIds: string[]): Promise<Array<{
  childWorkItemId: string;
  parent: WorkItem;
}>>;
summarizeChildren(parentWorkItemIds: string[]): Promise<Array<{
  parentWorkItemId: string;
  summary: WorkItemChildSummaryRecord;
}>>;
```

`findManyByIdsForUpdate` sorts unique IDs before `SELECT ... FOR UPDATE`. Its return order is also
stable by ID.

`listParentsForChildren` uses one aliased self-join for all requested child IDs.

`summarizeChildren` uses one grouped query with filtered counts and `coalesce(sum(...), 0)`. It runs
only for IDs in the current response, not for every project item.

`listChildren` sorts:

1. open before terminal;
2. priority descending;
3. board position ascending;
4. item number ascending;
5. ID ascending.

Candidate search:

- requires same project through the current work item context;
- excludes the current item;
- excludes rows whose `parent_work_item_id` is non-null;
- allows candidates that already have children;
- matches display key and title case-insensitively;
- ranks open before terminal, then exact/prefix key matches, then updated time and item number;
- returns no more than 20 rows.

### Repository Mutation

Extend `UpdateWorkItemInput` with:

```ts
parentWorkItemId?: string | null;
```

Only the hierarchy command and create path set this field. General update mapping does not accept it.

## Hierarchy Integrity And Concurrency

### Invariants

For every non-null `child.parentWorkItemId = parent.id`:

- child and parent IDs differ;
- workspace IDs match;
- project IDs match;
- parent has no parent;
- child has no children.

The last two rules establish the two-level model.

### Locking Rule

Every command that creates or changes a parent reference must lock each involved existing work item in
ascending UUID order before validating hierarchy.

Operations follow this rule:

- create child: lock the proposed parent;
- set parent: lock the current item and proposed parent;
- replace parent: lock the current item and proposed parent; the old parent need not be locked because
  removing a child cannot violate depth;
- clear parent: lock the current item;
- make an item a parent through child creation/reparenting: lock that item as the proposed parent.

After locks are held, query current child existence for the item being assigned a parent.

This prevents:

- concurrent `A -> B` and `B -> A` assignments;
- assigning `A -> B` while another transaction creates a child under `A`;
- creating a child under `A` while another transaction makes `A` a child;
- validating against stale parent depth.

### No-Op Behavior

If the requested parent equals the current parent:

- return the current detail DTO;
- do not update `updatedAt`;
- do not create activity;
- do not create notifications.

Clearing an already-null parent is also a no-op.

### Error Mapping

Use established structured errors:

- `404 Not Found`: current or proposed parent is outside the actor workspace or absent;
- `409 Conflict`: archived project, current item has children, or proposed parent is already a child;
- `400 Validation Error`: self-parenting or project mismatch;
- controlled generic conflict on an unexpected database constraint race.

Messages should be stable and specific enough for Angular to present:

```text
A work item cannot be its own parent.
Parent work must belong to the same project.
A child work item cannot contain child work.
Work with children cannot be assigned a parent.
Archived projects are read-only.
```

## Backend Service Design

### Service Boundary

Keep hierarchy behavior in `WorkItemService`. The feature is part of the work item aggregate and uses
existing project, activity, DTO, and transaction behavior.

Add public methods:

```ts
listChildren(workItemId: string, limit: number): Promise<WorkItemChildrenDto>;
listParentCandidates(
  workItemId: string,
  search?: string
): Promise<WorkItemParentCandidateDto[]>;
setParent(
  workItemId: string,
  input: SetWorkItemParentRequest
): Promise<WorkItemDetailDto>;
```

Add focused private helpers for locking, hierarchy validation, hierarchy enrichment, parent mapping,
and child-summary mapping. Do not add a generic tree service.

### Child Creation Algorithm

Inside `createWorkItemWithRepositories`:

1. Load and validate the project and ordinary references.
2. If `parentWorkItemId` is present:
   - reject self only after the new ID exists if necessary, though client-supplied self is impossible
     for generated IDs;
   - lock the parent row;
   - require same workspace and project;
   - require `parent.parentWorkItemId === null`;
   - allow the parent to have existing children;
   - allow open or terminal parent status.
3. Allocate the project item number.
4. Insert the work item with the parent reference.
5. Create labels and normal `work_item.created` activity.
6. Include `parent: { id, displayKey, title }` in created activity `newValue` and metadata when present.
7. Run existing reporter/assignee watch and assignment notification behavior.
8. Return enriched detail.

The parent lock must occur before insertion so concurrent reparenting cannot make the proposed parent a
child between validation and write.

### Parent Command Algorithm

Inside one repository transaction:

1. Reject `parentWorkItemId === workItemId` before database work.
2. Lock the current item and proposed parent, when non-null, in sorted order.
3. Require the current item and project in the actor workspace.
4. Require the project writable.
5. Return a no-op result when current and requested parent match.
6. When setting/replacing:
   - require proposed parent exists in the same workspace and project;
   - require proposed parent has no parent;
   - require the current item has no children;
   - recheck self identity.
7. Update only `parentWorkItemId` and `updatedAt`.
8. Create one `work_item.parent_changed` event on the current item.
9. Return enriched detail after commit-scoped writes.

Activity values:

```ts
previousValue: {
  parent: oldParent === null ? null : {
    id: oldParent.id,
    displayKey: oldParent.displayKey,
    title: oldParent.title
  }
}
newValue: {
  parent: newParent === null ? null : {
    id: newParent.id,
    displayKey: newParent.displayKey,
    title: newParent.title
  }
}
metadata: {}
```

Store titles in activity values so history remains readable after a later rename. The IDs and display
keys preserve stable identity.

### Child Read Algorithm

1. Require the parent item in the actor workspace.
2. Read its current derived child summary.
3. Read at most `limit` child rows.
4. Enrich those rows through the existing list DTO path plus batched hierarchy enrichment.
5. Return:
   - `items`;
   - `totalCount` from the summary;
   - `hasMore = totalCount > items.length`.

Calling the endpoint for a child returns an empty collection under valid data. It does not fail merely
because the requested item has a parent.

### Candidate Read Algorithm

1. Require the current item in the actor workspace.
2. If the current item already has children, return an empty list; the detail UI uses its child summary
   to explain why parent assignment is unavailable.
3. Query same-project eligible top-level candidates with the bounded search.
4. Map shallow candidate DTOs.

Archived project reads remain allowed, although Angular does not expose mutation controls there.

### Hierarchy Enrichment

Add a helper that accepts the work items already selected for a response:

```ts
loadHierarchyContext(
  workItems: WorkItem[],
  repositories: Repositories
): Promise<{
  parentsByChildId: Map<string, WorkItemParentDto>;
  childSummariesByParentId: Map<string, WorkItemChildSummaryDto>;
}>;
```

It performs at most two hierarchy-specific queries regardless of result count:

- parent self-join for rows with a parent;
- grouped child summary for returned item IDs.

Pass the maps into `toWorkItemListItemDto`. Do not perform parent or child queries from inside the
per-item mapper loop.

Existing member, milestone, and cycle enrichment may remain as-is in this sprint. Hierarchy must not
add new per-row reads.

### Planning Risk Enrichment

Planning, milestone review, and cycle review currently build `PlanningRiskItemDto` from work records.
Add a shared batch helper that resolves parent references for the bounded risk item set and populates
`parent` on live DTOs.

Do not add child summaries to risk rows. Parent context is sufficient and avoids widening every review
payload.

Status report draft generation carries the optional parent reference into newly published snapshot
rows. Existing stored snapshots continue parsing without it. Markdown and historical detail rendering
show compact parent keys when present, while omission remains valid.

## Query Design

### Repository Conditions

Extend `ProjectWorkItemQuery` with `hierarchy` and `parentKey`.

Conditions:

```text
hierarchy=top_level
  parent_work_item_id is null

hierarchy=children
  parent_work_item_id is not null

hierarchy=parents
  exists child where child.parent_work_item_id = work_items.id

parentKey=WT-42
  parent_work_item_id = id of workspace-local parent whose display_key = 'WT-42'
```

Use an aliased self-subquery for `parentKey`. Project queries already constrain the child project;
workspace queries already constrain the child workspace and archived-project mode. Same-project
integrity means no separate parent-project condition is needed for valid data, but the subquery must
still constrain workspace identity defensively.

### Query Validation

Update backend and shared normalization:

- accept only the three hierarchy values;
- trim and uppercase `parentKey`;
- reject `hierarchy` with `parentKey`;
- preserve existing status/work-state and assignee validation;
- tolerate a well-formed key that no longer resolves by returning an empty list;
- reject malformed or overlong keys.

### Frontend Serialization

Extend:

- project and workspace filter form values;
- form-to-query conversion;
- query-to-form conversion;
- route parsing and serialization;
- API `HttpParams` helpers;
- query compaction/default suppression;
- active labels and filter counts;
- saved-view runtime validation;
- copy-link and return-URL helpers.

`parentKey` remains in form state even though it has no general form control. This lets users change a
status, assignee, or sort while retaining an exact-parent drill-down.

When a user selects a visible `hierarchy` value, form conversion omits `parentKey`. Clearing the
hierarchy control does not recreate a previously removed exact-parent filter.

Active chip labels:

```text
Work breakdown: Top-level
Work breakdown: Child work
Work breakdown: Parents with children
Parent: WT-42
```

Clearing `Parent: WT-42` removes only `parentKey`.

### Saved Views

No persistence migration is needed because saved queries are JSONB.

Update saved-view query validation and summaries so:

- hierarchy values survive save/open/update/pin;
- `parentKey` survives exact-child saved views;
- meaningful filter counts include either hierarchy field once;
- stale parent keys remain visible and yield zero results rather than corrupting the view.

## Endpoint Design

### Create Work Item

Continue:

```text
POST /api/projects/:projectId/work-items
```

Extend request validation with optional nullable UUID `parentWorkItemId`.

### Set Or Clear Parent

Add:

```text
PUT /api/work-items/:workItemId/parent
```

Body schema requires exactly one nullable UUID field. Return `200` with `WorkItemDetailDto` for apply
and no-op replay.

### List Children

Add:

```text
GET /api/work-items/:workItemId/children?limit=25
```

Validate integer `limit` from 1 through 100. Return `200` with `WorkItemChildrenDto`.

### List Parent Candidates

Add:

```text
GET /api/work-items/:workItemId/parent-candidates?search=term
```

Validate optional trimmed search up to 120 characters. Return `200` with at most 20
`WorkItemParentCandidateDto` rows.

### Existing List And Export Endpoints

Extend existing project/workspace list and export endpoints with:

- `hierarchy`;
- `parentKey`.

No response envelope change is needed for list endpoints.

### Express Adapter

Register specific child, candidate, and parent routes before generic `/api/work-items/:workItemId` where
method/path matching could otherwise become ambiguous. Continue using `adaptEndpoint`; do not place
domain logic in Express registration.

## Frontend Design

### API Client

Extend `WorkItemsApi`:

```ts
listWorkItemChildren(workItemId: string, limit = 25): Observable<WorkItemChildrenDto>;
listParentCandidates(
  workItemId: string,
  search?: string
): Observable<WorkItemParentCandidateDto[]>;
setWorkItemParent(
  workItemId: string,
  input: SetWorkItemParentRequest
): Observable<WorkItemDetailDto>;
```

Extend create and query calls through shared contracts; do not add route-specific raw HTTP code.

### Detail Page Composition

The detail route component is already large. Add focused standalone children:

```text
components/work-item-parent-context.component.ts
components/work-item-parent-picker.component.ts
components/work-item-child-work.component.ts
```

Responsibilities:

- `parent-context`: compact linked parent identity and status;
- `parent-picker`: current selection, search results, select/clear/save events, loading and error state;
- `child-work`: child counts, bounded child rows, empty/loading/error states, add/view-all actions.

The route component owns API orchestration, route/query construction, permission state, and refresh.
Presentational children do not inject APIs.

Placement:

- parent context near the detail summary identity;
- parent management in the editable Summary area;
- child work after Summary and before independent action/collaboration/dependency sections;
- Dependencies remains dedicated to `blocks` and `relates to`.

On each `:workItemId` change:

- clear child/candidate state;
- load the new detail;
- load children only when `childSummary` is non-null;
- preserve the existing stale-response work item ID guards;
- close any parent picker state from the previous route.

After parent mutation, replace the detail DTO and refresh child state only when its new summary requires
it. After child creation, returning to the parent triggers normal route reload or an explicit refresh.

### Parent Picker Interaction

Use a labeled search input and keyboard-operable option list. Do not render every project item in a
native select.

Behavior:

- current parent appears as the selected value;
- search begins after a short debounce and two non-space characters;
- exact display-key paste may search immediately;
- open candidates appear before terminal candidates;
- terminal status is visible;
- Save sends the focused command;
- Clear sends `{ parentWorkItemId: null }`;
- no-op selection keeps Save disabled;
- archived projects disable mutation and do not issue candidate requests;
- a parent item with children shows no parent picker and concise reason text.

The API still permits an empty candidate search for deterministic tests and future use, but the UI does
not request it by default.

### Child Creation

From eligible parent detail, link to:

```text
/projects/:projectId/work-items/new?parentWorkItemId=:parentId&returnUrl=:parentDetailUrl
```

The existing create page:

1. reads `parentWorkItemId` after project identity is known;
2. loads the parent through the existing detail API for reloadable validation and display;
3. requires parent project equality;
4. shows a compact parent key/title/status context;
5. adds `parentWorkItemId` to the create request;
6. surfaces server conflicts without losing entered form state;
7. includes return-to-parent among success navigation.

Do not automatically copy parent milestone or cycle. The normal form remains authoritative.

### Work Lists

Extend `work-item-result-list`:

- child rows show `Child of WT-42` near identity metadata;
- parent rows with children show a compact `N child items` summary;
- no hierarchy metadata renders for plain top-level items;
- workspace rows retain project identity as the first cross-project context;
- parent links navigate to detail with the current result URL as `returnUrl` where practical.

Selection, bulk triage, status, priority, due date, assignee, milestone, cycle, and dependency signals
retain their existing prominence.

### Board

Keep columns and cards flat.

- child cards show the parent key;
- parent cards may show child total and done count when the card has room;
- dragging a card changes only that work item's status/order;
- no nesting, indentation, or drag-to-reparent behavior;
- hierarchy metadata has stable space and cannot resize the column during hover/drag.

### My Work And Review Rows

My Work uses workspace list DTOs and receives parent context automatically. Add compact rendering to its
shared row/card presentation.

For Planning, Milestone Review, and Cycle Review risk rows, show parent key only when present. Keep
risk reason, status, due date, and dependency state visually primary.

New status report snapshots retain optional parent context. Historical report rendering must work when
it is absent.

### Filter UI

Add a `Work breakdown` menu with:

- All work;
- Top-level work;
- Child work;
- Parents with children.

Use an empty value for All work. The control participates in draft state and only changes results/chips
after Apply, matching the corrected filter lifecycle.

Exact-parent state does not add an unbounded parent picker to the standard filter panel. It appears as
an active chip and is preserved while other filters are edited. Selecting another hierarchy mode
replaces it on Apply.

### Responsive And Accessibility Behavior

- parent links are normal keyboard-reachable links with descriptive names;
- candidate results use radio/listbox semantics with visible focus;
- result count and no-match states are announced without announcing on every keystroke;
- Clear and Save have distinct labels and disabled states;
- child counts include text, not color-only indicators;
- hierarchy icons, if used, are decorative beside accessible text;
- mobile rows wrap parent metadata below identity without obscuring actions;
- board cards retain stable dimensions;
- long keys and titles wrap or truncate with accessible full text;
- focus returns to the parent control after apply/error and to the page heading after route changes.

## CSV Design

Append columns without changing existing names:

```text
parent_key
parent_title
```

For top-level work both values are empty. For child work, values come from the enriched parent DTO.

Project and workspace exports use the same mapping. Existing filtered export URLs accept `hierarchy`
and `parentKey`, ensuring the file matches the applied list.

Do not add these columns to the accepted import schema. The import guide should state that they are
export context only in v0.2.5.

## OpenAPI Design

Update `docs/api/openapi.yaml` with:

- `WorkItemParent`;
- `WorkItemChildSummary`;
- `WorkItemChildren`;
- `WorkItemParentCandidate`;
- `SetWorkItemParentRequest`;
- `parentWorkItemId` on create;
- nullable parent/child summary fields on work item responses;
- optional parent on planning risk rows;
- `WorkItemHierarchyQuery` and `WorkItemParentKeyQuery` parameters;
- parent command, child list, and candidate routes;
- validation/conflict examples;
- CSV parent columns in endpoint descriptions.

Document that containment is same-project, two-level, independent from dependencies, and non-cascading.

## Seed Design

Add a deterministic active-project scenario with:

- one top-level story with at least four children;
- open, in-progress, done, and canceled child states;
- mixed assignees and priorities;
- direct parent and child estimates;
- one unestimated child;
- one dependency-blocked child;
- children split across current cycle, planned cycle, and unplanned work;
- children split across milestone contexts;
- one terminal parent candidate;
- one plain top-level item with no children.

Keep the scenario separate from the destructive Closeout Lab source cycle so hierarchy E2E and closeout
E2E do not invalidate each other's assumptions.

Seed through service methods where practical. If bulk fixture insertion is used, assert the two-level
invariants in seed tests.

## Testing Strategy

### Contract Tests

Cover:

- parent and child summary shapes;
- required nullable parent command field;
- create parent input;
- hierarchy query values;
- `hierarchy`/`parentKey` mutual exclusion;
- optional planning-risk parent compatibility;
- old status report snapshot payloads without parent context.

### Migration And Repository Tests

Cover:

- existing rows migrate with null parent;
- self-parent check;
- restrictive foreign key;
- project/parent index presence through migration expectations;
- child listing order and limit;
- parent candidate eligibility and sorting;
- parent batch self-join;
- child aggregate counts and estimate semantics;
- top-level, child, parents-with-children, and exact-parent queries;
- project/workspace and archived-project query composition;
- stable `FOR UPDATE` ID ordering.

### Service Tests

Cover create:

- top-level default;
- valid child;
- same-project enforcement;
- proposed parent already a child;
- archived project;
- created activity parent metadata;
- assignment notification behavior remains unchanged.

Cover mutation:

- set, replace, clear;
- matching no-op;
- self-parent rejection;
- cross-project/workspace rejection;
- item-with-children rejection;
- child-as-parent rejection;
- terminal parent accepted;
- archived project rejected;
- activity previous/new values;
- no hierarchy notifications;
- transaction rollback after injected failure;
- concurrent inverse assignment;
- concurrent child creation versus making the parent a child.

Cover reads:

- shallow parent identity;
- null versus populated child summary;
- bounded children envelope;
- eligible candidates;
- list enrichment uses batch repository methods;
- live planning risk parent context.

### Endpoint Tests

Cover:

- create request parent validation;
- set/clear parent response and structured errors;
- child limit parsing;
- candidate search parsing;
- actor/workspace boundaries;
- project archive behavior;
- project and workspace hierarchy query parsing;
- exact-parent stale key returns empty results;
- CSV headers and rows;
- OpenAPI route/schema alignment where current tests support it.

### Angular Unit Tests

Cover:

- query parse/serialize/normalize round trips;
- hidden `parentKey` preservation;
- visible hierarchy replacement of exact-parent state;
- active labels and clearing;
- saved/pinned view round trips;
- filter Apply behavior;
- parent context rendering;
- candidate search, selection, no-op, clear, save, error, and archived states;
- child summary/list loading and errors;
- create route parent preselection and request;
- parent/child same-route navigation reload;
- list, board, My Work, and review compact context;
- top-level no-noise rendering;
- long key/title and mobile template states.

### Browser Tests

Add a focused serial workflow:

1. reset or use deterministic hierarchy seed state;
2. open a seeded parent and verify child counts;
3. create a child from the parent;
4. return to the parent and verify the child appears;
5. navigate to the child and back without stale detail;
6. replace or clear a parent and verify activity;
7. open `View all child work` and verify URL, chip, and result set;
8. save or copy a hierarchy-filtered view where practical;
9. verify parent context on board/list;
10. restore deterministic state if the workflow mutates shared seed data.

Run representative desktop and mobile screenshots. Verify there is no text overlap, card resizing,
unexpected horizontal scrolling, or hidden primary action.

### Full Verification

Expected release gate:

```sh
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

## Performance And Scale

- Parent identity is one nullable UUID per work item.
- Child lookup uses `(project_id, parent_work_item_id)`.
- Exact-parent lookup uses the existing workspace/display-key uniqueness plus parent ID filtering.
- List hierarchy enrichment adds at most two set-based queries per response.
- Child detail reads default to 25 and cap at 100.
- Candidate reads cap at 20 and use same-project filtering.
- DTOs never recursively embed parents or children.
- Child summary is derived rather than updated on every child mutation, avoiding counter drift.
- Existing work list endpoints remain unpaginated; hierarchy does not worsen that contract with
  unbounded nested arrays.
- A future large-scale deployment can move list enrichment into joined/read-model queries without
  changing transport contracts.

## Security And Permissions

- Actor identity remains the local header/selector model; v0.2.5 does not claim production auth.
- All hierarchy reads require the current item or result workspace to match the actor workspace.
- Parent writes require an active actor through existing request context and a writable project.
- Parent and child project/workspace identity is validated from stored rows, never trusted from the
  request.
- Candidate search cannot query another workspace or project.
- Archived projects remain readable and mutation-protected.
- UUID write identity and immutable display-key read identity are not interchangeable in mutation
  endpoints.
- Error responses should not disclose titles or keys for inaccessible items.

## Delivery Sequence Guidance

Recommended implementation order:

1. shared contracts and activity/query vocabulary;
2. schema and migration;
3. repository hierarchy reads, aggregates, queries, and locks;
4. service enrichment and hierarchy validation;
5. create, parent command, child, candidate, Express, and OpenAPI endpoints;
6. canonical frontend query/filter/saved-view integration;
7. API client, create-child workflow, and parent management;
8. detail child section and route-refresh behavior;
9. list, board, My Work, planning/review, and CSV integration;
10. seed, browser, responsive, accessibility, documentation, metadata, and final verification.

Keep phase boundaries independently verifiable. Do not defer migration or contract tests until the UI
phase.

## Risks And Mitigations

### Service Validation Is The Primary Depth Guard

Risk: direct database writes can bypass same-project and two-level rules.

Mitigation: keep all application writes in the service, cover migration/seed paths, use a database self
check and foreign key for basic integrity, and defer triggers until multiple writers actually exist.

### Row Locks Become Inconsistent

Risk: different commands lock current/parent rows in different orders and deadlock.

Mitigation: centralize sorted unique-ID locking in one repository method and require every hierarchy
write to use it.

### DTO Changes Cause Broad Fixture Churn

Risk: required nullable fields touch many tests and consumers.

Mitigation: update shared fixture builders early, keep DTO fields shallow, and use optionality only where
stored snapshot compatibility requires it.

### Exact-Parent State Is Hidden From The Form

Risk: applying another filter accidentally drops or silently retains `parentKey`.

Mitigation: represent it in form state, preserve it by default, show an active chip, and explicitly let a
selected hierarchy mode replace it.

### Estimate Totals Are Misread As Rollups

Risk: users add parent and child estimates and assume one replaces the other.

Mitigation: label `Parent estimate` and `Child estimates` distinctly, show no synthetic total, and keep
documentation explicit.

### Review Snapshot Compatibility Regresses

Risk: adding required parent context invalidates old report JSONB.

Mitigation: make the planning-risk snapshot field optional, test old payloads, and leave closeout v1
unchanged.

### Detail Page Accumulates More Complexity

Risk: parent controls and child lists make the large route component harder to maintain and exceed style
budgets.

Mitigation: extract focused standalone components before adding markup and keep API orchestration in the
route container.

### Flat Lists Become Noisy

Risk: hierarchy metadata competes with operational signals.

Mitigation: render it conditionally, use compact keys, omit empty summaries, and verify dense/mobile
states with real seed data.

## Deferred

- Recursive hierarchy and more than two levels.
- Epic, initiative, theme, program, and roadmap entities.
- Dedicated subtask type.
- Cross-project parentage.
- Tree-grid, nested board, and hierarchy graph views.
- Drag/drop reparenting and child ordering.
- Automatic status, milestone, cycle, due-date, assignee, label, or priority cascades.
- Automatic completion and configurable rollups.
- Parent-aware dependency, critical path, forecasting, and capacity logic.
- Parent-aware closeout snapshot version.
- Batch hierarchy mutation.
- CSV hierarchy import and third-party hierarchy mapping.
- Parent watcher fan-out, subscriptions, and digests.
- Child templates and repeated breakdown structures.
- Work item delete, reparent-on-delete, and cascade policy.
- Production authentication and AWS deployment assets.

## Open Questions

No blocking technical choices remain for the implementation plan.

The implementation may adjust component filenames or split a phase when existing style budgets require
it, but it should preserve the contracts, invariants, endpoint semantics, and two-level product boundary
defined here.
