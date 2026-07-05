# Worktrail v0.0.8 Technical Design

## Overview

Worktrail v0.0.8 adds dependency visibility through work item relationships. The release adds:

- persisted work item relationship edges;
- directional `blocks` relationships;
- symmetric `relates_to` relationships;
- work item detail relationship management;
- derived dependency-blocked signals;
- project and workspace dependency filters;
- My Work and planning dependency-risk summaries;
- relationship activity events;
- OpenAPI, README, product site, and extraction-note updates.

The design preserves current architectural boundaries:

- Angular standalone lazy route components;
- shared contracts in `packages/contracts`;
- transport-neutral endpoint handlers;
- local Express adapter;
- backend service/repository layering;
- Drizzle-managed Postgres schema and migrations;
- deterministic seed data;
- production preview from built artifacts.

v0.0.8 should not add a graph visualization, critical path engine, automation rules, notification system, custom relationship types, work hierarchy, or cloud infrastructure.

## Design Decisions

- Add two relationship types: `blocks` and `relates_to`.
- Store both types in one `work_item_relationships` table.
- Treat `blocks` as directional from `source_work_item_id` to `target_work_item_id`.
- Treat `relates_to` as symmetric in product behavior by storing it in canonical ID order.
- Allow cross-project relationships inside the same workspace.
- Reject cross-workspace relationships.
- Reject self relationships.
- Reject duplicate relationships.
- Prevent all `blocks` cycles, not only direct two-way blocking.
- Use the existing work item edit policy for relationship writes.
- Keep relationship creation/deletion on the work item detail route for this sprint.
- Do not automatically transition downstream work items when blockers are added or resolved.
- Derive dependency-blocked state from open upstream blockers at read time.
- Treat `done` and `canceled` as terminal blocker statuses.
- Add dependency filters to the same query paths used by list pages, saved views, and CSV export.
- Add a small My Work summary count for dependency-blocked assigned work.
- Add planning dependency-risk cards by extending the existing planning summary model.
- Record project activity for relationship changes. Do not add workspace activity events for relationship changes in v0.0.8 unless implementation discovers a very low-churn path.
- Keep archived-project relationship warnings local to relationship displays and write errors.

## Domain Model

### Relationship Types

```ts
export type WorkItemRelationshipType = 'blocks' | 'relates_to';
```

Relationship language:

- `A blocks B`: A is upstream; B is downstream.
- `B is blocked by A`: inverse display of the same `blocks` row.
- `A relates to B`: symmetric contextual link.

### Dependency State

A work item is dependency-blocked when:

- it has at least one inbound `blocks` relationship; and
- at least one source blocker has a non-terminal status.

Terminal statuses:

```ts
['done', 'canceled']
```

Open blocker statuses:

```ts
['backlog', 'ready', 'in_progress', 'blocked']
```

Dependency-blocked is a derived signal, not a stored work item status. It can coexist with manual `status = 'blocked'`.

## Database Design

Add `work_item_relationships`.

Suggested Drizzle shape:

```ts
export const workItemRelationships = pgTable(
  'work_item_relationships',
  {
    id: uuid('id').primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    relationshipType: text('relationship_type').$type<WorkItemRelationshipType>().notNull(),
    sourceWorkItemId: uuid('source_work_item_id')
      .notNull()
      .references(() => workItems.id, { onDelete: 'cascade' }),
    targetWorkItemId: uuid('target_work_item_id')
      .notNull()
      .references(() => workItems.id, { onDelete: 'cascade' }),
    createdById: uuid('created_by_id')
      .notNull()
      .references(() => members.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull()
  },
  (table) => [
    check('work_item_relationships_type_check', enumCheckSql('relationship_type', workItemRelationshipTypes)),
    check('work_item_relationships_no_self_check', sql`${table.sourceWorkItemId} <> ${table.targetWorkItemId}`),
    index('work_item_relationships_workspace_id_idx').on(table.workspaceId),
    index('work_item_relationships_source_idx').on(table.sourceWorkItemId),
    index('work_item_relationships_target_idx').on(table.targetWorkItemId),
    uniqueIndex('work_item_relationships_unique').on(
      table.workspaceId,
      table.relationshipType,
      table.sourceWorkItemId,
      table.targetWorkItemId
    )
  ]
);
```

Notes:

- The application service should verify both work items belong to `actor.workspaceId` before insert.
- PostgreSQL cannot express cross-row same-workspace integrity with a simple check constraint. Service validation is authoritative.
- `relates_to` canonicalization happens before insert by sorting the two work item IDs lexicographically and using the lower ID as source.
- `blocks` preserves user-selected direction.
- For future cloud portability, keep relationship writes in service methods with repository calls rather than database triggers.

### Cycle Prevention

Before inserting `A blocks B`, reject the insert if B already reaches A through existing `blocks` edges.

Implementation options:

- Repository method using a recursive CTE.
- Service-level traversal after loading existing workspace `blocks` edges.

Recommendation:

- Use a repository method backed by a recursive CTE so validation remains database-efficient as data grows.
- Keep the service responsible for deciding when to call it and for returning the product error.

Conceptual SQL:

```sql
with recursive downstream(id) as (
  select target_work_item_id
  from work_item_relationships
  where workspace_id = $1
    and relationship_type = 'blocks'
    and source_work_item_id = $2
  union
  select r.target_work_item_id
  from work_item_relationships r
  inner join downstream d on d.id = r.source_work_item_id
  where r.workspace_id = $1
    and r.relationship_type = 'blocks'
)
select 1 from downstream where id = $3 limit 1;
```

For proposed `A blocks B`, call this with `source = B` and `target = A`.

## Shared Contracts

Add to `packages/contracts/src/index.ts`:

```ts
export type WorkItemRelationshipType = 'blocks' | 'relates_to';
export type DependencyFilter = 'dependency_blocked' | 'blocking_open_work';

export interface WorkItemRelationshipItemDto {
  id: string;
  relationshipType: WorkItemRelationshipType;
  direction: 'inbound' | 'outbound' | 'related';
  workItem: WorkItemRelationshipWorkItemDto;
  createdBy: MemberDto;
  createdAt: string;
}

export interface WorkItemRelationshipWorkItemDto {
  id: string;
  workspaceId: string;
  projectId: string;
  project: Pick<ProjectDto, 'id' | 'key' | 'name' | 'status'>;
  displayKey: string;
  title: string;
  status: WorkItemStatus;
  priority: WorkItemPriority;
  assignee: MemberDto | null;
}

export interface WorkItemRelationshipSummaryDto {
  blockedBy: WorkItemRelationshipItemDto[];
  blocks: WorkItemRelationshipItemDto[];
  related: WorkItemRelationshipItemDto[];
  dependencyBlocked: boolean;
  openBlockerCount: number;
  openBlockedWorkCount: number;
}

export interface CreateWorkItemRelationshipRequest {
  relationshipType: WorkItemRelationshipType;
  targetWorkItemId: string;
}

export interface WorkItemRelationshipDto {
  id: string;
  relationshipType: WorkItemRelationshipType;
  sourceWorkItemId: string;
  targetWorkItemId: string;
  sourceWorkItem: WorkItemRelationshipWorkItemDto;
  targetWorkItem: WorkItemRelationshipWorkItemDto;
  createdBy: MemberDto;
  createdAt: string;
}
```

Extend existing DTOs:

```ts
export interface WorkItemListItemDto {
  // existing fields...
  dependencyBlocked: boolean;
  openBlockerCount: number;
  openBlockedWorkCount: number;
}

export interface WorkItemDetailDto extends WorkItemListItemDto {
  // existing fields...
  relationships: WorkItemRelationshipSummaryDto;
}

export interface WorkItemQuery {
  // existing fields...
  dependency?: DependencyFilter;
}

export interface MyWorkSummaryCountDto {
  key:
    | 'assigned_open'
    | 'due_soon'
    | 'overdue'
    | 'blocked'
    | 'dependency_blocked'
    | 'stale_assigned'
    | 'reported_open';
  // existing fields...
}
```

Notes:

- Use one `dependency` query param instead of two booleans so saved view and URL state remain unambiguous.
- `dependency=dependency_blocked` means items with open inbound blockers.
- `dependency=blocking_open_work` means items that block at least one open downstream item.
- Keep counts on list DTOs compact. Full relationship detail belongs on the detail route.

## API Design

Add routes:

```text
GET    /api/work-items/:workItemId/relationships
POST   /api/work-items/:workItemId/relationships
DELETE /api/work-items/:workItemId/relationships/:relationshipId
```

Existing list routes gain the optional query param:

```text
GET /api/projects/:projectId/work-items?dependency=dependency_blocked
GET /api/projects/:projectId/work-items?dependency=blocking_open_work
GET /api/work-items?dependency=dependency_blocked
GET /api/work-items?dependency=blocking_open_work
GET /api/projects/:projectId/work-items/export?dependency=dependency_blocked
GET /api/work-items/export?dependency=blocking_open_work
```

### List Relationships

`GET /api/work-items/:workItemId/relationships`

Returns `WorkItemRelationshipSummaryDto`.

This endpoint is useful for refreshing the relationship section independently. `GET /api/work-items/:workItemId` should also include the same relationship summary so initial detail render does not require a second request.

### Create Relationship

`POST /api/work-items/:workItemId/relationships`

Request:

```json
{
  "relationshipType": "blocks",
  "targetWorkItemId": "..."
}
```

For `blocks`, `workItemId` is the source and `targetWorkItemId` is the target. The UI should offer direction-specific actions:

- "This work blocks..." sends source = current item.
- "This work is blocked by..." can call the same endpoint from the blocker item after UI translation, or use a direction field if the technical implementation finds that cleaner.

Recommendation:

- Keep the API simple with source in the URL and target in the body.
- In the UI, when adding "blocked by", call `POST /api/work-items/:blockerId/relationships` with `targetWorkItemId = currentWorkItemId`.

Response:

```json
{
  "id": "...",
  "relationshipType": "blocks",
  "sourceWorkItemId": "...",
  "targetWorkItemId": "...",
  "sourceWorkItem": {},
  "targetWorkItem": {},
  "createdBy": {},
  "createdAt": "..."
}
```

Status codes:

- `201` for created.
- `400` for malformed request, self relationship, or cycle.
- `403` for permission failure.
- `404` for either work item not found in the actor workspace.
- `409` for duplicate relationship or archived-project write protection.

### Delete Relationship

`DELETE /api/work-items/:workItemId/relationships/:relationshipId`

Behavior:

- `workItemId` must be either source or target of the relationship.
- Actor must have write permission on the current work item context.
- Relationship involving archived-project work items cannot be deleted.
- Return `204` or a small deletion DTO. Recommendation: use `204` to match a simple command endpoint.

## Backend Services

### Repository Layer

Add `work-item-relationship-repository.ts`.

Expected methods:

```ts
create(input: NewWorkItemRelationship): Promise<WorkItemRelationship>;
findById(id: string): Promise<WorkItemRelationship | null>;
findBetween(input): Promise<WorkItemRelationship | null>;
listForWorkItem(workItemId: string): Promise<WorkItemRelationship[]>;
listForWorkItems(workItemIds: string[]): Promise<WorkItemRelationship[]>;
delete(id: string): Promise<WorkItemRelationship | null>;
wouldCreateBlockingCycle(input: {
  workspaceId: string;
  sourceWorkItemId: string;
  targetWorkItemId: string;
}): Promise<boolean>;
listDependencyCounts(workItemIds: string[]): Promise<Map<string, DependencyCounts>>;
```

`listDependencyCounts` should return:

- `openBlockerCount`: inbound open blockers;
- `openBlockedWorkCount`: outbound open downstream items.

Use SQL aggregation with joins to `work_items` so list pages do not perform one query per row.

### Service Layer

Add `WorkItemRelationshipService`.

Responsibilities:

- require actor workspace scope;
- load source/current work item;
- load target work item;
- validate same workspace;
- validate no self relationship;
- canonicalize `relates_to`;
- reject duplicates;
- reject blocking cycles;
- enforce archived-project write protection for source and target projects;
- enforce existing work item edit policy;
- create/delete relationships;
- record activity;
- map relationship DTOs.

Write permission should mirror `WorkItemService.updateWorkItem`:

- owner and maintainer can write;
- contributor can write when assigned to the current work item and it is not terminal;
- terminal reopen restrictions remain separate from relationship writes, but terminal assigned items should not be editable by contributors.

For cross-project relationships, require the actor to have write permission on the current work item route context and reject if either source or target project is archived. Do not require separate permission on the other active project in v0.0.8 because current permissions are workspace-role based rather than project-membership based.

### Activity

Add activity event types:

```ts
'work_item.relationship_added'
'work_item.relationship_removed'
```

Activity event strategy:

- Record on the route-context work item's project and work item.
- Include relationship details in `metadata`.
- Include related work item display key and project key in `summary`.
- For `blocks`, use direction-aware summaries:
  - `Added blocker WT-12.`
  - `Marked this work as blocking APP-4.`
  - `Removed blocker WT-12.`
  - `Removed blocked-work link to APP-4.`
- For `relates_to`, use:
  - `Related this work to APP-4.`
  - `Removed related-work link to APP-4.`

Recommendation:

- Do not create duplicate activity on both sides in v0.0.8. Single-sided activity avoids cross-project noise and keeps the implementation small.
- Include enough metadata to add mirrored activity later.

## Query And Derived State Design

### Project List Filters

Extend `WorkItemFilters`:

```ts
dependency?: DependencyFilter;
```

For `dependency_blocked`, add an `exists` condition:

```sql
exists (
  select 1
  from work_item_relationships r
  inner join work_items blocker on blocker.id = r.source_work_item_id
  where r.relationship_type = 'blocks'
    and r.target_work_item_id = work_items.id
    and blocker.status not in ('done', 'canceled')
)
```

For `blocking_open_work`, reverse the edge:

```sql
exists (
  select 1
  from work_item_relationships r
  inner join work_items blocked on blocked.id = r.target_work_item_id
  where r.relationship_type = 'blocks'
    and r.source_work_item_id = work_items.id
    and blocked.status not in ('done', 'canceled')
)
```

Workspace filters use the same criteria plus existing archived-project filtering.

### DTO Enrichment

`WorkItemService.toListDtos` and `toWorkspaceListDtos` should batch-load dependency counts for the result IDs and include:

- `dependencyBlocked = openBlockerCount > 0`;
- `openBlockerCount`;
- `openBlockedWorkCount`.

Avoid loading full relationship detail for list pages.

### My Work

Add a summary count:

```ts
{
  key: 'dependency_blocked',
  label: 'Dependency blocked',
  count,
  query: {
    assigneeId: actor.memberId,
    workState: 'open',
    dependency: 'dependency_blocked'
  }
}
```

Add or reuse a dashboard section:

- If current dashboard density can support it, add `dependencyBlockedAssigned`.
- If not, include dependency-blocked items in `blockedRelevant` and rely on the summary count link.

Recommendation:

- Add `dependencyBlockedAssigned` to keep dependency-blocked distinct from manual `blocked` status.

### Planning

Extend planning summary with:

```ts
dependencyBlockedWork: PlanningRiskItemDto[];
blockingOpenWork: PlanningRiskItemDto[];
```

Keep result limits similar to existing planning risk lists. Show cards/sections near blocked work because the mental model is execution risk.

## Frontend Design

### API Client

Extend `WorktrailApiService`:

```ts
listWorkItemRelationships(workItemId: string): Observable<WorkItemRelationshipSummaryDto>;
createWorkItemRelationship(
  workItemId: string,
  request: CreateWorkItemRelationshipRequest
): Observable<WorkItemRelationshipDto>;
deleteWorkItemRelationship(workItemId: string, relationshipId: string): Observable<void>;
```

Extend filter serializers:

- project list `WorkItemListFilters`;
- workspace `WorkItemQuery`;
- shared `work-item-query-params.ts`;
- saved view open/update flow;
- CSV export query construction.

### Work Item Detail

Add a relationship section below core fields and before or near comments/activity.

Suggested sections:

- Blocked by
- Blocks
- Related work

Each item row:

- project key and display key;
- title link;
- status pill;
- priority;
- assignee name or `Unassigned`;
- remove button when writable.

Add controls:

- `Add blocker`;
- `Add blocked work`;
- `Add related work`.

Picker behavior:

- Use a compact search input backed by workspace work item discovery.
- Debounce search.
- Require at least two characters before search, or show recent open work if implementation can do that cheaply.
- Exclude current work item.
- Disable already-linked candidates with short helper copy.
- For `relates_to`, hide either direction duplicates.
- For `blocks`, disable candidates that would create a duplicate. Server still enforces cycle validation.

No new component library is needed. Use existing Angular forms and local styling.

### List Pages

Project work item list:

- Add dependency filter select:
  - Any dependency state;
  - Dependency blocked;
  - Blocking open work.
- Add compact dependency indicator in each result row:
  - `Blocked by 2`;
  - `Blocks 3`;
  - both if applicable.

Workspace work item discovery:

- Add the same dependency filter.
- Preserve active filter pill behavior.
- Saved views preserve the dependency filter.

CSV export:

- Existing export buttons use applied filters. Include dependency filter in the applied query.

### My Work

Add a summary tile or count for dependency-blocked assigned work. Link it to workspace discovery with:

```text
assigneeId=<actor>&workState=open&dependency=dependency_blocked
```

Add a section for dependency-blocked assigned work if the dashboard remains readable. Use the same compact item rendering as other My Work sections.

### Planning

Add dependency risk sections near existing blocked work:

- Dependency blocked;
- Blocking open work.

Each item should link to the detail route and show project/display key, status, priority, assignee, and due date if available.

## Validation And Errors

Expected user-facing errors:

- `Cannot relate a work item to itself.`
- `That relationship already exists.`
- `This relationship would create a blocking cycle.`
- `Work item not found.`
- `Relationships cannot be changed for archived projects.`
- `You do not have permission to update this work item.`

Cycle errors should be `400 ValidationError`. Duplicate and archived write protection should be `409 ConflictError`. Missing work items should be `404 NotFoundError`.

## Seed Data

Extend seed data with:

- same-project `blocks` relationship;
- cross-project `blocks` relationship;
- `relates_to` relationship;
- downstream item dependency-blocked by an open blocker;
- downstream item blocked by a terminal item so the signal is clear;
- activity events for relationship seed data only if existing seed conventions include lifecycle activity for related seeded records.

Seed data should keep e2e flows deterministic and avoid changing existing test assumptions about counts unless tests are updated in the same phase.

## OpenAPI

Update `docs/api/openapi.yaml`:

- add `WorkItemRelationshipType`;
- add relationship DTO schemas;
- extend `WorkItemListItem` and `WorkItemDetail`;
- add relationship endpoints;
- add `dependency` query parameter to project list, workspace list, project export, and workspace export;
- document error responses for duplicate, self, cycle, archived, and permission cases.

## Testing Strategy

### Backend Unit And Service Tests

Add coverage for:

- create `blocks`;
- create `relates_to`;
- reject self relationship;
- reject duplicate `blocks`;
- reject duplicate `relates_to` regardless of direction;
- reject blocking cycle;
- allow cross-project relationship inside workspace;
- reject cross-workspace relationship;
- reject archived-project relationship create/delete;
- enforce contributor edit policy;
- delete relationship;
- relationship summary grouping;
- dependency count enrichment;
- project dependency filters;
- workspace dependency filters;
- CSV export with dependency filters;
- activity creation.

### Frontend Unit Tests

Add coverage for:

- relationship section renders inbound, outbound, and related lists;
- add blocker flow calls expected API;
- add blocked-work flow translates direction correctly;
- add related-work flow;
- remove relationship;
- archived/read-only states;
- dependency filter URL serialization;
- saved view dependency query preservation;
- dependency indicators on list rows;
- My Work dependency summary link.

### E2E Smoke

Extend the smoke suite with one dependency workflow:

1. Open a work item detail page.
2. Add a blocker relationship to another open item.
3. Confirm the downstream item shows dependency-blocked.
4. Filter workspace discovery by dependency-blocked.
5. Save and reopen a dependency-blocked view.
6. Move the blocker to `done`.
7. Confirm the downstream dependency-blocked signal clears.

Keep this path short so e2e remains smoke coverage rather than exhaustive graph testing.

## Migration And Rollback

Migration:

- create `work_item_relationships`;
- add indexes and uniqueness constraints;
- add activity event type check values if event type checks require migration changes.

Rollback:

- drop `work_item_relationships`;
- remove relationship event type values from check constraints;
- remove contract/API/UI references.

No data backfill is required.

## Performance Notes

Expected v0.0.8 data sizes are small, but design should avoid obvious scaling traps:

- batch dependency counts for list result IDs;
- use `exists` filters for dependency query criteria;
- index `source_work_item_id` and `target_work_item_id`;
- use recursive CTE only during `blocks` creation, not during every list read;
- keep relationship detail loading scoped to one work item.

For future larger deployments, dependency counts may move to materialized read models, but that is out of scope for v0.0.8.

## Security And Permission Notes

- Relationship endpoints derive actor context from existing local actor headers.
- Server validates all permissions and project/archive state.
- Frontend disabled states are advisory only.
- Cross-project relationships stay within the actor workspace.
- No relationship endpoint accepts project or workspace IDs from the body.
- Error messages should not leak whether a work item exists outside the actor workspace.

## Documentation Updates

Update:

- `README.md` capability list and walkthrough;
- `site/index.html` public product site;
- `docs/api/openapi.yaml`;
- `docs/v0.0.8/jawstack-extraction-notes.md`.

Extraction notes should cover:

- graph-edge table modeling;
- directional versus symmetric edge semantics;
- canonicalization;
- cycle validation;
- derived relationship state;
- URL-backed relationship filters;
- relationship-aware export reuse;
- cloud-readiness implications for graph queries.

## Risks And Mitigations

- Cycle prevention can be implemented incorrectly.
  - Mitigation: use dedicated backend tests with multi-hop cycles.
- List DTO enrichment can become N+1.
  - Mitigation: batch dependency counts by result IDs.
- Relationship direction can confuse users.
  - Mitigation: use explicit copy: "blocked by", "blocks", and "related work".
- Saved views can drop new filters if serializers are not updated everywhere.
  - Mitigation: centralize dependency query parsing and add tests around saved views.
- Activity can become noisy if mirrored to both projects.
  - Mitigation: record single-sided activity in v0.0.8 and keep metadata for future expansion.
- Cross-project links can surprise users.
  - Mitigation: always display project key and project name in relationship rows.

## Deferred Work

- Graph visualization.
- Critical path and schedule impact analysis.
- Relationship import/export.
- Custom relationship types.
- Work item hierarchy.
- Automation rules.
- Notifications.
- Project-level dependency dashboards.
- Materialized dependency read models.
- Workspace activity for relationship changes.
- Cloud infrastructure changes.

