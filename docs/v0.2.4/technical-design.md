# Worktrail v0.2.4 Technical Design

## Status

Draft

## Summary

v0.2.4 adds Cycle Closeout and Carryover.

The implementation introduces a guided, server-owned workflow for ending an active cycle:

1. An owner or maintainer opens a closeout page and loads a current preview.
2. The preview separates terminal and unfinished scope and lists valid carryover destinations.
3. The maintainer chooses one planned destination cycle or clears cycle assignment.
4. The API locks and re-derives current state inside a transaction.
5. The API stores one immutable closeout snapshot, completes the source cycle, moves unfinished work, and records activity atomically.
6. Cycle Review and Planning show the completed result while current work continues in its destination.

The design extends existing cycle, work item, activity, transaction, snapshot-validation, and Angular route patterns. It does not introduce a generic command framework, event bus, background worker, analytics model, or workflow engine.

## Resolved Decisions

### Product Route

Use a dedicated project-shell route:

```text
/projects/:projectId/cycles/:cycleId/closeout
```

Rationale:

- preview metrics, unfinished scope, destination choice, conflict handling, and confirmation need more room than a compact modal;
- a route is reloadable and can recover from API errors without preserving dialog state;
- the page remains inside the project shell and cycle context;
- Cycle Review remains focused on review rather than carrying a large mutation form inline.

Cycle Review should expose `Close cycle` for eligible actors. The active-cycle card in Planning may expose the same route as a secondary action. Both links open one workflow; they do not duplicate closeout logic.

### API Surface

Add:

```text
GET  /api/projects/:projectId/cycles/:cycleId/closeout-preview
POST /api/projects/:projectId/cycles/:cycleId/closeout
```

Continue using:

```text
GET /api/projects/:projectId/cycles/:cycleId/review
GET /api/projects/:projectId/planning
```

The review and planning responses gain optional closeout summaries for completed cycles.

Rationale:

- preview is explicitly read-only;
- closeout is an explicit domain command, not a broad cycle patch;
- Angular does not reconstruct closeout policy through multiple API calls;
- the same transport-neutral handlers can later sit behind API Gateway/Lambda adapters.

### Preview Authorization

Limit closeout preview and apply endpoints to owners and maintainers.

All active workspace members may continue to read Cycle Review and its completed closeout result.

Rationale:

- preview exists to support a privileged mutation;
- contributor Cycle Review already provides the useful read path;
- this avoids exposing an additional near-duplicate read model with different permission expectations.

### Destination Policy

Apply one destination to all unfinished source-cycle work:

- a non-archived `planned` cycle in the same project; or
- `null`, meaning clear cycle assignment.

Do not activate the destination cycle. Do not change work item status or any field other than `cycleId` and `updatedAt`.

`done` and `canceled` are terminal. Terminal work remains assigned to the source cycle. Every other status is unfinished and moves to the selected destination.

Rationale:

- one destination covers the common rollover decision;
- per-item routing is already possible later through Work and bulk edit;
- preserving status prevents closeout from becoming an implicit workflow transition;
- retaining terminal work keeps current links and basic live queries useful.

### Immutable Persistence

Add one dedicated `project_cycle_closeouts` row per closed cycle. Store stable ownership/lookup columns plus a versioned JSONB snapshot.

Rationale:

- moving unfinished work makes a live completed-cycle query historically incomplete;
- a dedicated row gives closeout its own creation identity and uniqueness invariant;
- JSONB fits the immutable, versioned evidence pattern already proven by status reports;
- relational columns support ownership, joins, uniqueness, and ordering without querying snapshot JSON.

Do not add closeout columns directly to `project_cycles`. A distinct immutable record makes it harder for ordinary cycle updates to rewrite historical evidence.

### Concurrency And Preview Drift

Treat the preview as advisory. Re-derive source scope inside the closeout transaction and apply the command to that current state.

Do not reject only because work item scope changed after preview. Reject when:

- the source project became archived;
- the source cycle is no longer active and has no matching closeout;
- the destination is no longer eligible;
- ownership no longer matches;
- persisted snapshot validation fails on an idempotent replay.

Rationale:

- normal work updates should not make closeout impractically fragile;
- the confirmation copy can state that Worktrail uses current scope at close time;
- the returned result and stored snapshot represent command-time truth;
- lifecycle and destination changes materially alter the user's decision and therefore require a refreshed preview.

### Idempotency

Make closeout naturally idempotent through the unique source-cycle closeout record.

Inside the transaction:

- lock the source cycle;
- load an existing closeout, if any;
- if one exists and its destination matches the request, return the stored result without writes;
- if one exists with a different destination, return `409 Conflict`;
- if no closeout exists, require the source cycle to be active and proceed.

`POST /closeout` returns `200 OK` for both first application and a matching replay. The result includes `applied: true` for the first application and `applied: false` for an idempotent replay.

Rationale:

- double clicks and transport retries cannot repeat work or activity;
- no client-generated idempotency key is needed for this one-time domain transition;
- a different replay request cannot rewrite the immutable outcome.

### Completion Is Closeout-Only

After v0.2.4, API clients must not create a cycle in `completed` state or transition a cycle to `completed` through the generic patch endpoint.

Rules:

- cycle creation permits `planned` or `active`;
- generic cycle update permits `planned`, `active`, or `canceled` according to existing overlap and project rules;
- a cycle already completed may receive non-lifecycle metadata corrections only if existing edit behavior remains useful, but its status cannot change;
- only `POST /closeout` transitions `active` to `completed`;
- seed code and tests that need a legacy completed cycle may insert it through repository/fixture setup rather than the public command API.

Rationale:

- leaving generic completion available would allow new completed cycles without closeout evidence;
- this release intentionally establishes closeout as the lifecycle invariant;
- pre-v0.2.4 completed cycles remain valid legacy records and show no-snapshot copy.

### Activity And Notifications

Add one project activity event type:

```ts
'cycle.closed'
```

Also record one existing `work_item.cycle_changed` activity event for each moved unfinished item.

Do not create notifications for closeout in v0.2.4.

Rationale:

- current cycle assignment changes create activity but do not notify watchers;
- adding watcher notifications only for closeout would create inconsistent policy and potentially large bursts;
- activity provides an auditable explanation without introducing a new notification reason;
- notification policy can be revisited separately if user evidence supports cycle-change alerts.

### Completed Review Behavior

Extend `ProjectCycleReviewDto` with `closeout: ProjectCycleCloseoutDto | null`.

- active and planned cycles continue to render the existing live review;
- completed cycles with closeout data lead with the immutable outcome and bounded snapshot item groups;
- current live progress may remain available as secondary context, clearly labeled;
- legacy completed cycles keep the current live-derived page and show that no closeout snapshot exists.

Rationale:

- users should not need a second history route;
- existing cycle links remain stable;
- one review DTO can describe live state and optional historical evidence without replacing either.

## Current Implementation Context

Relevant backend files:

```text
packages/contracts/src/cycles.ts
packages/contracts/src/planning.ts
packages/contracts/src/activity.ts
apps/api/src/db/schema.ts
apps/api/src/repositories/project-cycle-repository.ts
apps/api/src/repositories/work-item-repository.ts
apps/api/src/repositories/activity-event-repository.ts
apps/api/src/services/project-cycle-service.ts
apps/api/src/services/planning-service.ts
apps/api/src/services/work-item-service.ts
apps/api/src/services/work-risk-sections.ts
apps/api/src/validation/project-cycle.ts
apps/api/src/validation/project-status-report-snapshot.ts
apps/api/src/endpoints/cycles.ts
apps/api/src/adapters/express/routes/cycle-routes.ts
```

Relevant frontend files:

```text
apps/web/src/app/app.routes.ts
apps/web/src/app/core/api/cycles-api.ts
apps/web/src/app/core/current-user.service.ts
apps/web/src/app/features/projects/project-cycle-review-page.component.ts
apps/web/src/app/features/projects/project-planning-page.component.ts
apps/web/src/app/features/projects/planning/cycle-manager.component.ts
apps/web/src/app/features/projects/planning/cycle-summary-panel.component.ts
apps/web/src/app/shared/cycles/cycle-display.ts
```

Existing reusable behavior:

- `withRepositoriesTransaction` creates transaction-scoped repositories;
- `ProjectCycleService.getCycleReview` derives progress, health, risks, and recent movement;
- work risk policy defines open/terminal behavior and dependency evaluation;
- `work_item.cycle_changed` activity already stores previous and next cycle identity;
- status reports demonstrate versioned JSONB runtime validation;
- project route components are lazy loaded;
- `CurrentUserService` exposes the selected actor and role for affordance control;
- project Work already serializes `cycleId` through canonical query contracts.

## Contract Design

### Cycle Lifecycle Request Types

Narrow public mutation request status types while preserving the full DTO status union:

```ts
export type ProjectCycleStatus = 'planned' | 'active' | 'completed' | 'canceled';
export type CreatableProjectCycleStatus = 'planned' | 'active';
export type MutableProjectCycleStatus = 'planned' | 'active' | 'canceled';

export interface CreateProjectCycleRequest {
  name: string;
  goal?: string;
  status?: CreatableProjectCycleStatus;
  startDate: string;
  endDate: string;
  targetPoints?: number | null;
}

export interface UpdateProjectCycleRequest {
  name?: string;
  goal?: string;
  status?: MutableProjectCycleStatus;
  startDate?: string;
  endDate?: string;
  targetPoints?: number | null;
}
```

Runtime schemas must enforce the same narrowed unions.

### Snapshot Item

Use compact immutable item summaries:

```ts
export interface ProjectCycleCloseoutItemSnapshotDto {
  id: string;
  displayKey: string;
  title: string;
  status: WorkItemStatus;
  priority: WorkItemPriority;
  assignee: Pick<MemberDto, 'id' | 'name'> | null;
  estimatePoints: number | null;
  dependencyBlocked: boolean;
}
```

Do not snapshot descriptions, comments, labels, milestones, relationships, or full member records. Those fields are not required to explain completion/carryover and would inflate immutable data.

### Counts

```ts
export interface ProjectCycleCloseoutCountsDto {
  totalCount: number;
  completedCount: number;
  canceledCount: number;
  unfinishedCount: number;
  retainedCount: number;
  movedCount: number;
  committedEstimatePoints: number;
  completedEstimatePoints: number;
  unfinishedEstimatePoints: number;
  unestimatedUnfinishedCount: number;
}
```

Semantics:

- `completedCount` counts `done` only;
- `canceledCount` counts `canceled` only;
- `retainedCount = completedCount + canceledCount`;
- `unfinishedCount` counts every other status;
- `movedCount = unfinishedCount` at successful closeout;
- estimate totals treat `null` as zero and expose the unestimated count separately.

### Destination

```ts
export type ProjectCycleCloseoutDestinationDto =
  | { kind: 'cycle'; cycle: Pick<ProjectCycleDto, 'id' | 'name' | 'startDate' | 'endDate'> }
  | { kind: 'unplanned'; cycle: null }
  | { kind: 'none'; cycle: null };
```

`none` is used only when there was no unfinished work. `unplanned` means unfinished work had its cycle assignment cleared.

### Snapshot

```ts
export interface ProjectCycleCloseoutSnapshotDto {
  snapshotVersion: 1;
  project: Pick<ProjectDto, 'id' | 'key' | 'name'>;
  cycle: Pick<
    ProjectCycleDto,
    'id' | 'name' | 'goal' | 'startDate' | 'endDate' | 'targetPoints'
  > & { status: 'active' };
  closedAt: string;
  closedBy: Pick<MemberDto, 'id' | 'name'>;
  health: {
    health: DeliveryHealthState;
    reasons: DeliveryHealthReasonDto[];
  };
  counts: ProjectCycleCloseoutCountsDto;
  destination: ProjectCycleCloseoutDestinationDto;
  items: {
    completed: ProjectCycleCloseoutItemSnapshotDto[];
    canceled: ProjectCycleCloseoutItemSnapshotDto[];
    unfinished: ProjectCycleCloseoutItemSnapshotDto[];
  };
}
```

The source cycle status is captured as `active`, its state immediately before the command transitions it to `completed`.

### Persisted Closeout DTO

```ts
export interface ProjectCycleCloseoutDto {
  id: string;
  workspaceId: string;
  projectId: string;
  cycleId: string;
  closedAt: string;
  closedBy: MemberDto;
  destinationCycleId: string | null;
  snapshot: ProjectCycleCloseoutSnapshotDto;
}
```

The full current member DTO is returned for display consistency, while the snapshot retains only historical id/name.

### Preview

```ts
export interface ProjectCycleCloseoutDestinationOptionDto {
  cycle: ProjectCycleDto;
}

export interface ProjectCycleCloseoutPreviewDto {
  project: ProjectDto;
  cycle: ProjectCycleDto;
  generatedAt: string;
  health: ProjectCycleReviewDto['health'];
  counts: Omit<ProjectCycleCloseoutCountsDto, 'movedCount'>;
  unfinishedItems: ProjectCycleCloseoutItemSnapshotDto[];
  eligibleDestinations: ProjectCycleCloseoutDestinationOptionDto[];
}
```

Preview returns all unfinished item summaries for the initial release. The service should sort by status urgency, priority, display key, then id for deterministic rendering.

### Command And Result

```ts
export interface CloseProjectCycleRequest {
  destinationCycleId: string | null;
}

export interface CloseProjectCycleResultDto {
  applied: boolean;
  cycle: ProjectCycleDto;
  closeout: ProjectCycleCloseoutDto;
  movedItemCount: number;
  retainedItemCount: number;
}
```

`destinationCycleId` is required even when `null`, preventing omission from being mistaken for an accidental client payload.

### Review And Planning Extensions

```ts
export interface ProjectCycleReviewDto {
  // existing fields
  closeout: ProjectCycleCloseoutDto | null;
}

export interface ProjectPlanningCycleSummaryDto {
  // existing fields
  closeout: {
    closedAt: string;
    closedBy: Pick<MemberDto, 'id' | 'name'>;
    counts: ProjectCycleCloseoutCountsDto;
    destination: ProjectCycleCloseoutDestinationDto;
  } | null;
}
```

Planning receives a compact summary rather than the full snapshot item arrays.

## Persistence Design

### Table

Add `project_cycle_closeouts`:

```text
id                    uuid primary key
workspace_id          uuid not null references workspaces(id)
project_id            uuid not null references projects(id)
cycle_id              uuid not null references project_cycles(id)
closed_by_member_id   uuid not null references members(id)
destination_cycle_id  uuid null references project_cycles(id)
snapshot              jsonb not null
closed_at             timestamptz not null
created_at            timestamptz not null
```

Constraints and indexes:

```text
unique (cycle_id)
index (workspace_id, project_id, closed_at desc)
index (project_id, closed_at desc)
index (destination_cycle_id)
```

Do not cascade-delete closeouts. Worktrail does not currently delete projects or cycles; archival preserves records. Foreign keys should use the default restrictive behavior so future deletion work cannot silently erase history.

The application validates that source cycle, destination cycle, project, and workspace ownership match. PostgreSQL foreign keys cannot express all four ownership relationships without broader composite constraints that are not justified for this release.

### Migration

Generate the next Drizzle migration, expected as `0014_*`, from the schema change. Commit:

- SQL migration;
- Drizzle metadata snapshot;
- migration journal update.

The migration is additive. Existing completed cycles are not backfilled because current data cannot reconstruct historical closeout scope truthfully.

### Repository

Add `createProjectCycleCloseoutRepository` with:

```ts
create(input: NewProjectCycleCloseout): Promise<ProjectCycleCloseout>;
findByCycleId(cycleId: string): Promise<ProjectCycleCloseout | null>;
findByCycleIdForUpdate(cycleId: string): Promise<ProjectCycleCloseout | null>;
```

Add repository typing and registration in:

```text
apps/api/src/repositories/types.ts
apps/api/src/repositories/index.ts
```

### Locking And Bulk Mutation Helpers

Extend cycle and work item repositories with transaction-only helpers:

```ts
projectCycles.findByIdForUpdate(cycleId)
workItems.listByCycleForUpdate(projectId, cycleId)
workItems.updateCycleAssignments(workItemIds, destinationCycleId, updatedAt)
activityEvents.createMany(events)
```

Implementation notes:

- use PostgreSQL `FOR UPDATE` for source cycle, destination cycle, and scoped work rows;
- order work rows by `id` before locking and activity generation for deterministic behavior;
- update moved rows with one set-based `UPDATE ... WHERE id IN (...) RETURNING` statement;
- return immediately without a work update when there are no unfinished ids;
- insert item activity with one multi-row insert;
- keep the single closeout event in the same transaction.

The general repository interfaces remain transport-agnostic. Locking is a persistence concern contained within repository methods.

## Snapshot Validation

Add:

```text
apps/api/src/validation/project-cycle-closeout-snapshot.ts
```

Define a strict Zod schema for snapshot version `1` and expose:

```ts
parseStoredProjectCycleCloseoutSnapshot(value: unknown): ProjectCycleCloseoutSnapshotDto
parseRequestedProjectCycleCloseoutSnapshot(value: unknown): ProjectCycleCloseoutSnapshotDto
```

Only stored parsing is expected in normal v0.2.4 paths; requested parsing is useful for focused tests and symmetry with status reports but should not expose client-supplied snapshots in the closeout command.

Validation requirements:

- exact `snapshotVersion: 1`;
- UUID identifiers;
- ISO timestamp/date values;
- source status exactly `active`;
- valid health, reason, work status, and priority enums;
- nonnegative counts and estimate totals;
- destination discriminated-union consistency;
- item array status/category consistency;
- `retainedCount = completedCount + canceledCount`;
- `movedCount = unfinishedCount`;
- item array lengths equal their category counts;
- project/cycle ids match relational row ownership after parsing;
- snapshot destination id matches `destination_cycle_id` when kind is `cycle`.

Stored invalid data should raise `ConflictError('Stored cycle closeout snapshot is invalid.')` with structured validation details. Do not silently omit malformed closeouts.

## Backend Service Design

### Service Boundary

Add:

```text
apps/api/src/services/project-cycle-closeout-service.ts
```

Context:

```ts
export interface ProjectCycleCloseoutServiceContext {
  actor: ActorContext;
  repositories: Repositories;
  db?: WorktrailDb;
  clock?: () => Date;
  idGenerator?: () => string;
}
```

Responsibilities:

- authorize preview and closeout;
- require project/cycle ownership;
- derive preview and snapshot inputs;
- validate destination policy;
- coordinate transaction locks and writes;
- handle idempotent replay;
- map persisted closeout records to validated DTOs.

Keep ordinary cycle CRUD and review in `ProjectCycleService`. Do not turn that service into a generic command dispatcher.

### Shared Cycle Evaluation

Closeout and Cycle Review must not duplicate progress/health semantics.

Extract the pure calculation portion of `ProjectCycleService.getCycleReview` into a focused module, for example:

```text
apps/api/src/services/cycle-review-model.ts
```

Recommended functions:

```ts
createCycleEvaluation(input): CycleEvaluation;
createCycleProgress(...): CycleReviewProgressDto;
createCycleHealth(...): ProjectCycleReviewDto['health'];
createCycleScopeBreakdown(...): CycleReviewScopeBreakdownDto;
```

`ProjectCycleService.getCycleReview` remains responsible for repository reads and DTO assembly. `ProjectCycleCloseoutService` supplies its transaction-scoped rows to the same pure evaluation functions.

Do not make closeout call `getCycleReview` inside its write transaction because that method uses broad repository reads without row locks and assembles fields closeout does not need.

### Preview Algorithm

`preview(projectId, cycleId)`:

1. Require owner/maintainer permission.
2. Load project and cycle within the actor workspace.
3. Require active project, active non-archived cycle.
4. Load source-cycle work, dependency-blocked source work, members, and eligible planned cycles.
5. Build the shared cycle evaluation using one service clock timestamp.
6. Categorize work as completed, canceled, and unfinished.
7. Build counts and deterministic unfinished item summaries.
8. Return eligible destinations ordered by start date, name, then id.

Preview does not create a transaction or lock records. It is advisory and may be refreshed cheaply.

### Closeout Algorithm

`close(projectId, cycleId, request)`:

1. Parse `CloseProjectCycleRequest` before opening the transaction.
2. Require owner/maintainer permission.
3. Start `withRepositoriesTransaction`.
4. Load and lock the source cycle.
5. Require source workspace/project ownership.
6. Load existing closeout by source cycle.
7. If a closeout exists:
   - validate and map its snapshot;
   - compare the stored destination with the request;
   - return `applied: false` when they match;
   - otherwise throw `409 Conflict`.
8. Load the project and require active state.
9. Require source cycle active and non-archived.
10. If `destinationCycleId` is non-null:
    - reject self-destination;
    - load and lock the destination;
    - require same workspace/project;
    - require `planned` and non-archived.
11. Load and lock all source-cycle work rows in deterministic order.
12. Load members and dependency-blocked ids needed for snapshot summaries.
13. Build progress, health, categories, counts, destination, and snapshot at one `closedAt` timestamp.
14. Insert the closeout row.
15. Update the source cycle to `completed` with `updatedAt = closedAt`.
16. Set the unfinished rows' `cycleId` to destination id or `null`, with `updatedAt = closedAt`.
17. Insert one `work_item.cycle_changed` activity row per moved item.
18. Insert one `cycle.closed` project activity row with `workItemId = null`.
19. Return the completed cycle and validated closeout DTO with `applied: true`.

The unique closeout constraint protects against races not prevented by application checks. Convert its violation to the same idempotent/conflict resolution path where practical; source-cycle row locking should make that path rare.

### Destination Comparison For Replay

Compare the relational `destinationCycleId` column to the request:

```ts
existing.destinationCycleId === request.destinationCycleId
```

When there was no unfinished work, the stored column remains `null` and the snapshot destination is `none`; a replay with `null` matches.

Do not compare current destination-cycle status during replay. The immutable command already succeeded, and later destination lifecycle changes must not make retries fail.

### Activity Assembly

Extract the existing cycle-assignment activity payload creation from the private `WorkItemService.recordCycleActivity` into a shared helper, for example:

```text
apps/api/src/services/work-item-cycle-activity.ts
```

The helper should create `NewActivityEvent` input from:

- current item;
- previous cycle identity;
- next cycle identity or null;
- actor id;
- timestamp;
- generated event id.

Both single-item update and closeout use the helper so summary, previous/new values, and metadata stay consistent.

Closeout-level event:

```ts
{
  eventType: 'cycle.closed',
  workItemId: null,
  summary: movedCount === 0
    ? `Cycle ${cycle.name} closed with no unfinished work.`
    : destination.kind === 'cycle'
      ? `Cycle ${cycle.name} closed; ${movedCount} item(s) moved to ${destination.cycle.name}.`
      : `Cycle ${cycle.name} closed; ${movedCount} item(s) returned to unplanned work.`,
  previousValue: { cycleId, status: 'active' },
  newValue: { cycleId, status: 'completed' },
  metadata: {
    closeoutId,
    destinationCycleId,
    movedItemCount,
    retainedItemCount
  }
}
```

Use grammatically correct singular/plural copy in the implementation.

### Generic Cycle Mutation Changes

Update cycle validation and service rules:

- create schema accepts only `planned | active` status;
- update schema accepts only `planned | active | canceled` status;
- `updateProjectCycle` rejects any status change when the current cycle is `completed`;
- completed cycles may retain metadata edits if the body does not include status;
- generic update cannot produce `completed`;
- cycle management status menus do not offer `completed` as an editable option;
- active-cycle UI replaces direct completion with the closeout route.

The full `ProjectCycleStatus` union remains unchanged for DTOs, filters, persisted rows, review, and legacy records.

## Endpoint Design

### Preview Handler

Add to `apps/api/src/endpoints/cycles.ts`:

```ts
getProjectCycleCloseoutPreviewHandler(input):
  EndpointHandler<ProjectCycleCloseoutPreviewDto>
```

Response:

```text
200 preview
403 insufficient role
404 project/cycle outside actor workspace or missing
409 archived project, archived cycle, or non-active source
```

### Closeout Handler

```ts
closeProjectCycleHandler(input):
  EndpointHandler<CloseProjectCycleResultDto>
```

Response:

```text
200 applied result or idempotent replay
400 invalid request shape
403 insufficient role
404 source/destination outside actor workspace or missing
409 archived project, ineligible lifecycle, changed destination eligibility,
    different replay destination, or invalid stored snapshot
```

Parse route params with the existing UUID schema. Add a Zod command schema:

```ts
z.object({
  destinationCycleId: z.string().uuid().nullable()
}).strict()
```

### Route Registration

Register static suffix routes before any future generic nested route that could consume them:

```ts
app.get('/api/projects/:projectId/cycles/:cycleId/closeout-preview', ...);
app.post('/api/projects/:projectId/cycles/:cycleId/closeout', ...);
```

Update the route inventory assertion in `apps/api/tests/server.test.ts` in the same phase as route registration.

## Cycle Review And Planning Integration

### Cycle Review Service

`ProjectCycleService.getCycleReview` should load closeout by cycle id in parallel with its existing reads. If present:

- parse the stored snapshot;
- verify row/snapshot project and cycle identity;
- load closing actor for the current `MemberDto`;
- return `closeout` on the review DTO.

Do not derive a snapshot for legacy completed cycles.

The live progress and risk fields remain populated for compatibility and current links. The Angular page decides which region leads based on `closeout !== null`.

### Planning Service

`PlanningService.toCycleSummary` copies a compact closeout summary from `review.closeout` when present.

The recently completed cycle card should show:

- close date;
- completed/total count;
- moved count;
- destination name or `Returned to unplanned work`;
- Review link.

Do not add snapshot arrays to Planning responses.

## Frontend Design

### Routes And Lazy Loading

Add before the existing cycle review sibling route:

```ts
{
  path: 'cycles/:cycleId/closeout',
  loadComponent: () =>
    import('./features/projects/cycle-closeout/project-cycle-closeout-page.component')
      .then((module) => module.ProjectCycleCloseoutPageComponent),
  title: 'Close Cycle | Worktrail'
}
```

Angular route matching is segment based, so either sibling order is workable, but keeping the more specific route first is easier to inspect.

### API Client

Extend `CyclesApi`:

```ts
getCloseoutPreview(projectId, cycleId):
  Observable<ProjectCycleCloseoutPreviewDto>

closeCycle(projectId, cycleId, request):
  Observable<CloseProjectCycleResultDto>
```

No frontend facade or global store is needed.

### Closeout Page Composition

Use a route component for loading, mutation, and navigation state, with focused presentational children if style or readability warrants:

```text
cycle-closeout/
  project-cycle-closeout-page.component.ts
  cycle-closeout-summary.component.ts
  cycle-closeout-work-list.component.ts
  cycle-closeout-destination.component.ts
```

Responsibilities:

- route page:
  - subscribe to `projectId` and `cycleId` params;
  - load preview;
  - own destination form control;
  - submit once;
  - handle conflict refresh and success navigation;
- summary:
  - cycle identity, dates, health, count/estimate metrics;
- work list:
  - deterministic unfinished scope with accessible row semantics;
- destination:
  - radio/select choice, affected count, and confirmation copy.

Avoid cards inside cards. Use unframed sections or one level of panels consistent with Cycle Review.

### Form And Submission State

Use a typed reactive form:

```ts
form = formBuilder.group({
  destinationCycleId: formBuilder.control<string | null>(null)
});
```

Behavior:

- default to the earliest eligible planned cycle when unfinished work exists;
- default to `null` when no planned destination exists;
- hide/disable destination choice when unfinished count is zero;
- show explicit `Return to unplanned work` copy for `null`;
- submit `{ destinationCycleId }` exactly;
- disable controls and button while submitting;
- button copy changes from `Close cycle` to `Closing...` without changing dimensions;
- prevent a second local submission while one is active.

On success:

- navigate to `/projects/:projectId/cycles/:cycleId`;
- the completed-cycle result returned by Cycle Review is the durable success state;
- optional navigation state may request focus on the closeout heading, but correctness must not depend on transient state.

On `409`:

- if the response indicates source or destination lifecycle change, show concise conflict copy and a `Refresh preview` action;
- reload preview rather than preserving an invalid destination silently;
- if the API returned an idempotent success, it is a normal `200`, not a conflict.

### Permission Affordances

Cycle Review injects `CurrentUserService` and computes:

```ts
canClose =
  selectedMember.role in ['owner', 'maintainer'] &&
  review.project.status === 'active' &&
  review.cycle.status === 'active' &&
  !review.cycle.isArchived;
```

The API remains authoritative. Actor changes should recompute the affordance because `selectedMember` is a signal.

Planning passes `canManageCycles` into `CycleSummaryPanelComponent` so its active-cycle card can show a `Close` route link. Contributor and archived-project paths omit it.

### Completed Cycle Review UI

When `review.closeout !== null`:

- change eyebrow to `Cycle result · Snapshot`;
- show closed timestamp and actor;
- lead with target, committed, completed, retained, and moved metrics;
- show destination result and link when kind is `cycle`;
- render bounded completed, canceled, and unfinished-at-close groups from the snapshot;
- label item links `Open current {displayKey}` through accessible names;
- preserve a compact `Current state` section or existing live risk links below the snapshot where useful;
- do not describe snapshot item statuses as current.

Use a visible limit such as 8 items per category and show a count summary for additional snapshot rows. Because the immutable snapshot is not queryable through existing live Work filters, do not offer a misleading `View all snapshot items` link. Current destination-cycle links may use canonical Work query parameters.

When the cycle is completed but `closeout === null`:

- show `Completed before closeout history was available`;
- retain existing live review rendering;
- do not fabricate counts or a destination.

### Cycle Management UI

Replace the single global `cycleStatuses` menu with status choices valid for mutation:

- create: `planned`, `active`;
- planned edit: `planned`, `active`, `canceled`;
- active edit: `active`, `canceled`; completion uses `Close`;
- canceled edit: `canceled`, `planned`, `active` subject to overlap rules;
- completed edit: status shown read-only.

Metadata fields may remain editable for completed cycles if current product behavior supports corrections. The closeout snapshot never changes when cycle metadata changes afterward, and completed review must make that distinction clear.

## Error Handling

Use existing structured application errors.

Recommended messages:

```text
403 Only owners and maintainers can close cycles.
404 Project cycle not found.
404 Destination cycle not found.
409 Archived projects are read-only.
409 Archived cycles cannot be closed.
409 Only active cycles can be closed.
409 Destination cycle must be a planned, non-archived cycle in the same project.
409 Cycle was already closed with a different destination.
409 Completed cycle status must be set through cycle closeout.
409 Stored cycle closeout snapshot is invalid.
```

Cross-workspace and cross-project ids should generally return `404`, matching existing anti-enumeration behavior. A destination in the same project with an invalid status may return `409` because the actor can already read it.

## OpenAPI

Update `docs/api/openapi.yaml` with:

```text
GET  /api/projects/{projectId}/cycles/{cycleId}/closeout-preview
POST /api/projects/{projectId}/cycles/{cycleId}/closeout
```

Add or update schemas:

- `ProjectCycleCloseoutPreview`;
- `ProjectCycleCloseoutDestinationOption`;
- `CloseProjectCycleRequest`;
- `CloseProjectCycleResult`;
- `ProjectCycleCloseout`;
- `ProjectCycleCloseoutSnapshot`;
- `ProjectCycleCloseoutItemSnapshot`;
- `ProjectCycleCloseoutCounts`;
- `ProjectCycleReview` optional closeout;
- narrowed create/update cycle status enums.

Document:

- owner/maintainer authorization;
- `destinationCycleId: null` semantics;
- command-time scope re-derivation;
- idempotent matching replay;
- conflict behavior;
- snapshot versus current work links.

## Testing Strategy

### Contract Tests

Add focused fixtures for:

- preview DTO;
- all destination discriminants;
- snapshot version `1`;
- command request/result;
- review and planning optional closeout fields;
- narrowed cycle creation/update status requests.

### Repository And Migration Tests

Cover:

- closeout create/find;
- unique source cycle constraint;
- project/closed ordering;
- source and destination foreign keys;
- row-lock helpers where integration behavior is material;
- set-based cycle assignment update;
- multi-row activity insert;
- migration from the v0.2.3 schema and fresh migration setup.

### Snapshot Validation Tests

Cover:

- valid version `1` snapshot;
- unsupported version;
- invalid enum/date/UUID;
- count/category mismatch;
- destination discriminant mismatch;
- relational row identity mismatch;
- malformed persisted JSON returning controlled conflict.

### Service Tests

Preview:

- owner and maintainer success;
- contributor rejection;
- archived project/cycle rejection;
- planned/completed/canceled source rejection;
- no unfinished work;
- no destination cycles;
- destination ordering;
- done/canceled/unfinished categorization;
- estimate and unestimated totals;
- dependency-blocked item flag;
- deterministic sorting.

Closeout:

- planned destination success;
- null destination success;
- no-unfinished success;
- same-project ownership;
- cross-project/workspace destination rejection;
- active/completed/canceled/archived destination rejection;
- source status and archive conflict;
- project archived conflict;
- source completed and unfinished moved atomically;
- terminal items retained without timestamp churn;
- unrelated work item fields preserved;
- snapshot fidelity;
- one closeout activity;
- one item activity per moved item;
- no notification creation;
- matching replay returns `applied: false` with no writes;
- different-destination replay conflicts;
- forced repository failure rolls back every write;
- command uses work state changed after preview;
- concurrent closeout attempts resolve to one stored result.

### API Tests

Cover:

- route parameter and request validation;
- actor headers and permissions;
- response status/body;
- structured 404/409 errors;
- idempotent response;
- review includes closeout;
- legacy completed review returns `closeout: null`;
- planning includes compact closeout summary;
- route inventory;
- OpenAPI route/schema assertions.

### Angular Tests

Closeout page:

- loading, error, and retry;
- summary/count rendering;
- unfinished work rendering;
- destination default and null choice;
- no-unfinished state;
- submit request shape;
- disabled/submitting state;
- success navigation;
- conflict and refreshed preview;
- route parameter changes;
- long-content wrapping structure.

Cycle Review and Planning:

- role-aware close link;
- archived/contributor suppression;
- closeout snapshot result;
- destination links;
- legacy completed copy;
- live active review unchanged;
- recently completed Planning summary.

### E2E

Add one dedicated closeout cycle seed that no other smoke test mutates.

Browser journey:

1. Select Morgan Maintainer.
2. Open the dedicated active Cycle Review.
3. Open Close cycle.
4. Verify completed, canceled, unfinished, and estimate totals.
5. Choose the dedicated planned destination.
6. Confirm closeout.
7. Verify completed snapshot result and destination link.
8. Open destination cycle work and verify carried display keys.
9. Open one carried item and verify cycle-change activity.

Add a contributor assertion at component/API level rather than consuming the one-time E2E cycle twice.

## Seed Data

Preserve current v0.2.1-v0.2.3 cycle and Portfolio scenarios. Add the smallest isolated closeout scenario, preferably to `Reference Operations` so the primary Worktrail App active cycle remains available for existing walkthroughs.

Recommended seed shape:

```text
Project: Reference Operations
Active cycle: Operations Cycle 1
Planned cycle: Operations Cycle 2
Work:
  OPS-1 done, estimated
  OPS-2 canceled, estimated or unestimated
  OPS-3 in progress, estimated
  OPS-4 blocked/dependency-blocked, unestimated
```

If existing `OPS-*` records conflict with this shape, adapt names/ids without weakening the existing healthy Portfolio scenario. E2E should identify the cycle by deterministic name and should not rely on global row counts after closeout.

Do not seed a closeout for the interactive source cycle. A separate historical closeout may be seeded only if needed to demonstrate completed-cycle display before E2E runs.

## Performance And Scale

Closeout is synchronous in v0.2.4.

Efficiency requirements:

- one source-cycle lock;
- at most one destination-cycle lock;
- one locked source-work query;
- one set-based work update;
- one multi-row item-activity insert;
- one closeout insert;
- one source-cycle update;
- bounded supporting reads for members/dependency state.

Avoid one work update or insert round trip per item.

The snapshot stores all source-cycle item summaries so history remains complete. The closeout result and Cycle Review may render bounded groups, but the API DTO still contains the full snapshot in v0.2.4. If real cycles make payload size material, a later release can split snapshot summary and paged snapshot-item endpoints without changing stored version `1` data.

Do not impose an arbitrary item cap in this release. The service should remain practical for hundreds of cycle items through set-based writes. Very large cycle closeout, asynchronous execution, or payload pagination should be driven by measured deployment needs.

For a future Lambda/API Gateway adapter:

- the handler performs one bounded domain command;
- no in-memory process state is required;
- retries are idempotent;
- transaction ownership remains in the service/repository layer;
- response data is serializable without Express-specific types.

## Security And Permissions

- Derive workspace from `request.actor`; never accept workspace id in command input.
- Require owner/maintainer role for preview and apply.
- Return `404` for source or destination ownership mismatch.
- Require active project for mutation.
- Require active, non-archived source cycle.
- Require planned, non-archived destination cycle in the same project.
- Never accept snapshot, counts, item ids, actor, or timestamps from the client.
- Build all immutable evidence from locked server-side state.
- Validate stored JSON before returning it.
- Continue using parameterized Drizzle queries.
- Do not add contributor mutation affordances even though API permission remains authoritative.

## Accessibility And Responsive Verification

Verify at minimum:

- desktop closeout route at 1440x900;
- compact desktop/tablet at 1024x768;
- mobile at 390x844;
- keyboard-only destination selection and confirmation;
- focus after load, conflict, and success navigation;
- screen-reader names for current-work links;
- no horizontal scrolling caused by work titles or cycle names;
- no button resizing between idle/submitting text;
- status and dependency signals remain understandable without color.

Use Playwright screenshots during the UI phase for both a populated preview and completed result. Canvas checks are not relevant because the page contains no canvas/3D content.

## Documentation

Update during implementation/finalization:

- README feature baseline, cycle workflow, walkthrough, and limitations;
- OpenAPI;
- `docs/v0.2.4/implementation-plan.md`;
- `docs/v0.2.4/release-notes.md`;
- `docs/v0.2.4/pattern-notes.md`;
- static site only if closeout is included in concise current-product copy.

Pattern notes should remain destination-neutral and capture evidence around:

- preview-and-apply commands;
- naturally idempotent one-time transitions;
- relational ownership plus JSONB evidence;
- shared derivation between live review and immutable snapshot;
- set-based side effects;
- snapshot/live-state framing.

## Delivery Sequence Guidance

The implementation plan should separate the work into independently verifiable layers:

1. Contract and lifecycle-rule changes.
2. Migration, closeout repository, and runtime snapshot validation.
3. Shared cycle evaluation extraction.
4. Closeout preview service and endpoint.
5. Transactional closeout command, activity, and idempotency.
6. Cycle Review and Planning API integration.
7. Angular closeout route and workflow.
8. Completed review and Planning UI integration.
9. Seed data and E2E.
10. OpenAPI, docs, public site, and final verification.

Do not defer transaction rollback, idempotency, or snapshot validation tests to finalization; they belong with the backend command phase.

## Risks And Mitigations

### Closeout Duplicates Cycle Review Logic

Risk: progress and health semantics drift between preview, snapshot, reports, and live review.

Mitigation: extract pure cycle evaluation functions and cover parity in unit tests.

### Long Transactions

Risk: per-item writes and activity inserts hold locks too long.

Mitigation: lock deterministically, use one set-based work update and one multi-row activity insert, and perform request parsing before the transaction.

### Snapshot Payload Growth

Risk: cycles with large scope create large JSON/API payloads.

Mitigation: snapshot compact item fields only, render bounded groups, measure before adding pagination, and avoid descriptions/comments/labels in snapshot data.

### Post-Preview Changes Surprise The User

Risk: command-time scope differs from the displayed preview.

Mitigation: state that current scope is used, return the actual stored result, and treat lifecycle/destination changes as conflicts. A later release may add a preview fingerprint if UAT shows stricter reconfirmation is needed.

### Generic Completion Bypasses History

Risk: cycle CRUD continues producing completed cycles without closeout records.

Mitigation: narrow create/update status contracts and remove completed from generic UI controls.

### Legacy Completed Cycles Look Broken

Risk: pre-release cycles have no snapshot.

Mitigation: keep live review compatible and show explicit legacy absence copy; do not fabricate backfill data.

### Activity Volume

Risk: moving many items creates a large activity insert and noisy histories.

Mitigation: emit only one event per genuinely moved item, insert in bulk, emit one closeout-level event, and create no notifications.

### Metadata Edits After Closeout

Risk: current cycle name/goal differs from snapshot identity after correction.

Mitigation: label snapshot data with its close timestamp and keep current cycle metadata separate. Consider making completed cycles fully immutable later if corrections create confusion.

## Deferred

- per-item destination selection;
- multiple destination cycles in one closeout;
- destination activation in the closeout command;
- closeout notes, retrospective, approval, or sign-off;
- closeout undo, correction, or cycle reopen;
- preview fingerprints and strict item-drift reconfirmation;
- cycle-change notifications;
- due-date shifting and workflow-status automation;
- recurring cycle generation;
- scheduled reminders or closeout;
- velocity, throughput, carryover-rate, and trend APIs;
- burndown, burnup, cumulative-flow, forecasting, and capacity planning;
- paged snapshot-item APIs;
- portfolio historical cycle comparison;
- status report sections derived from completed closeouts;
- generic snapshot or command infrastructure.

## Open Questions

No blocking technical decisions remain for implementation planning.

Implementation may adjust exact component boundaries, helper names, and bounded visible item limits to fit the existing code, provided the contracts, lifecycle invariant, transaction semantics, snapshot fidelity, and user-visible behavior above remain intact.
