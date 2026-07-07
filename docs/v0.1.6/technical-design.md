# Worktrail v0.1.6 Technical Design

## Overview

Worktrail v0.1.6 adds project-scoped batch triage to the project Work page.

The release should let a maintainer select visible project work items and apply one explicit bulk command at a time:

- assign or clear assignee;
- set priority;
- set or clear milestone;
- set or clear due date;
- add labels;
- remove labels;
- transition status.

The feature should build on existing Worktrail seams:

- shared contract types in `packages/contracts/src/work-items.ts`;
- endpoint handlers in `apps/api/src/endpoints/work-items.ts`;
- business rules in `WorkItemService`;
- repository transaction support through `withRepositoriesTransaction`;
- project Work page state in `WorkItemListPageComponent`;
- web API calls through `WorkItemsApi` and `WorktrailApiService`.

No new database tables are required. The durable system of record remains the existing work item, label join, activity, and notification tables.

## Resolved Decisions

- Scope bulk triage to `POST /api/projects/:projectId/work-items/bulk-update`.
- Add contract types for an explicit discriminated action request and per-item response.
- Cap requests at 50 work item ids.
- Require owners and maintainers for all v0.1.6 bulk mutations.
- Reject archived project requests before item-level execution.
- Use partial success with per-item results.
- Execute each successful item mutation in its own short transaction.
- Validate all selected ids as project-local without leaking cross-project or unauthorized item details.
- Support all valid status transitions using the existing `canTransitionWorkItem` rule.
- Insert status-transitioned items at the top of the target board status, matching current detail-page transition behavior.
- Reload the current project Work list after a bulk command completes.
- Clear successful selections after completion.
- Keep failed selections selected only when those rows remain visible after reload.
- Add a `work_item.due_date_changed` activity event type because due-date bulk edits need the same audit behavior as assignee, priority, milestone, labels, and status.
- Do not add batch jobs, durable selection sets, cross-project bulk edit, board bulk edit, spreadsheet editing, or a reusable package in this sprint.

## Current Architecture

Project work listing and mutation are already split across clear layers.

Contracts:

- `WorkItemListItemDto` contains all fields needed for list-row refresh after a successful item update.
- `UpdateWorkItemRequest` supports priority, assignee, labels, milestone, due date, and other detail fields.
- `TransitionWorkItemRequest` supports status transition.

API:

- `GET /api/projects/:projectId/work-items` lists project-local rows.
- `PATCH /api/work-items/:workItemId` updates one item.
- `POST /api/work-items/:workItemId/transitions` transitions one item.
- Existing endpoint handlers parse request bodies with Zod and delegate to `WorkItemService`.
- Express route registration is adapter-local, so a new endpoint handler remains deployable behind either local Express or a future Lambda/API Gateway adapter.

Service:

- `WorkItemService.updateWorkItem` validates project writability, labels, milestone, assignee, records activity, and records assignee notifications.
- `WorkItemService.transitionWorkItem` validates project writability, workflow transition, records status activity, and records status notifications.
- `recordUpdateActivity` already records title, description, priority, assignee, milestone, and label changes.
- Due date changes currently update data without a dedicated activity event.

Web:

- `WorkItemListPageComponent` owns the project Work page query state, saved views, pinned views, CSV export, and loaded `workItems`.
- The component already has project, labels, milestones, members, archived-project, and role signals needed to drive a project-local bulk action bar.
- `WorkItemsApi` and `WorktrailApiService` wrap HTTP calls and are the right place to add one bulk-update client method.

## Contract Design

Update `packages/contracts/src/work-items.ts`.

### Action Types

```ts
export type BulkUpdateWorkItemsAction =
  | { type: 'set_assignee'; assigneeId: string }
  | { type: 'clear_assignee' }
  | { type: 'set_priority'; priority: WorkItemPriority }
  | { type: 'set_milestone'; milestoneId: string }
  | { type: 'clear_milestone' }
  | { type: 'set_due_date'; dueDate: string }
  | { type: 'clear_due_date' }
  | { type: 'add_labels'; labelIds: string[] }
  | { type: 'remove_labels'; labelIds: string[] }
  | { type: 'transition_status'; status: WorkItemStatus };
```

### Request

```ts
export interface BulkUpdateWorkItemsRequest {
  workItemIds: string[];
  action: BulkUpdateWorkItemsAction;
}
```

Rules:

- `workItemIds` must contain 1 to 50 ids.
- Duplicate ids are rejected instead of silently deduplicated.
- Label ids must contain 1 to 20 ids for add/remove actions.
- `dueDate` must be `YYYY-MM-DD`.
- The request carries exactly one action intent.

### Response

```ts
export type BulkUpdateWorkItemsResultStatus = 'updated' | 'unchanged' | 'failed';

export type BulkUpdateWorkItemsErrorCode =
  | 'NOT_FOUND'
  | 'NOT_IN_PROJECT'
  | 'PROJECT_ARCHIVED'
  | 'FORBIDDEN'
  | 'INVALID_REFERENCE'
  | 'WORKFLOW_TRANSITION_ERROR'
  | 'VALIDATION_ERROR';

export interface BulkUpdateWorkItemsErrorDto {
  code: BulkUpdateWorkItemsErrorCode;
  message: string;
}

export interface BulkUpdateWorkItemsResultDto {
  workItemId: string;
  displayKey: string | null;
  status: BulkUpdateWorkItemsResultStatus;
  workItem: WorkItemListItemDto | null;
  error: BulkUpdateWorkItemsErrorDto | null;
}

export interface BulkUpdateWorkItemsResponseDto {
  requestedCount: number;
  succeededCount: number;
  unchangedCount: number;
  failedCount: number;
  results: BulkUpdateWorkItemsResultDto[];
}
```

`displayKey` is nullable because invalid or unauthorized ids must not force a lookup that reveals hidden data. For project-local rows, return the display key.

`unchanged` is a success class. It means the selected item was valid and writable, but the command did not change its stored state. Examples:

- adding a label already present;
- removing a label not present;
- setting priority to the current priority;
- transitioning status to the current status.

## Endpoint Design

Add endpoint:

```text
POST /api/projects/:projectId/work-items/bulk-update
```

Add handler:

```ts
export function bulkUpdateWorkItemsHandler(input: {
  repositories: Repositories;
  db?: WorktrailDb;
}): EndpointHandler<BulkUpdateWorkItemsResponseDto>
```

Add route registration before `POST /api/projects/:projectId/work-items` in `work-item-routes.ts`:

```ts
app.post(
  '/api/projects/:projectId/work-items/bulk-update',
  adaptEndpoint(bulkUpdateWorkItemsHandler({ repositories: context.repositories, db: context.db }), options)
);
```

The route is project-scoped because label and milestone ids are project-local and because the project Work page already supplies the right option sets.

### Zod Schema

Add endpoint schemas near existing work item schemas:

```ts
const bulkUpdateWorkItemsSchema = z.object({
  workItemIds: z.array(z.string().uuid()).min(1).max(50).superRefine(noDuplicateIds),
  action: z.discriminatedUnion('type', [
    z.object({ type: z.literal('set_assignee'), assigneeId: z.string().uuid() }),
    z.object({ type: z.literal('clear_assignee') }),
    z.object({ type: z.literal('set_priority'), priority: z.enum(workItemPriorities) }),
    z.object({ type: z.literal('set_milestone'), milestoneId: z.string().uuid() }),
    z.object({ type: z.literal('clear_milestone') }),
    z.object({ type: z.literal('set_due_date'), dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }),
    z.object({ type: z.literal('clear_due_date') }),
    z.object({ type: z.literal('add_labels'), labelIds: z.array(z.string().uuid()).min(1).max(20).superRefine(noDuplicateIds) }),
    z.object({ type: z.literal('remove_labels'), labelIds: z.array(z.string().uuid()).min(1).max(20).superRefine(noDuplicateIds) }),
    z.object({ type: z.literal('transition_status'), status: z.enum(workItemStatuses) })
  ])
});
```

Use a small local duplicate-id refinement helper. Keep validation at the endpoint boundary so the service receives a trusted request shape.

## Service Design

Add `bulkUpdateWorkItems` to `WorkItemService`:

```ts
async bulkUpdateWorkItems(
  projectId: string,
  input: BulkUpdateWorkItemsRequest
): Promise<BulkUpdateWorkItemsResponseDto>
```

High-level flow:

1. Load and require the route project.
2. Reject archived project writes.
3. Require actor role `owner` or `maintainer`.
4. Validate action-level references once where possible.
5. For each requested id, execute one item command and collect a result.
6. Return aggregate counts and per-item results in request order.

### Role Rule

Use owner/maintainer only for v0.1.6.

Rationale:

- current local auth uses workspace role rather than project membership;
- contributors may have some single-item paths today, but broad batch mutation is a stronger capability;
- this avoids implying fine-grained permissions before the product has project-specific roles.

The web UI should hide the action bar for contributors. The API must still enforce the rule.

### Partial Success

Use partial success across items, not all-or-nothing.

Implementation approach:

- perform global project and actor checks before processing items;
- validate action references before processing items;
- execute each item in its own transaction through `withWriteRepositories`;
- catch known domain errors per item and convert them to result errors;
- let unexpected errors propagate as a 500 because they indicate an implementation fault.

This gives users useful progress when one selected item is stale, terminal, cross-project, or otherwise invalid. It also keeps transaction behavior simple and compatible with local Postgres and future request-scoped cloud execution.

### Item Command Helper

Add a private helper:

```ts
private async applyBulkActionToWorkItem(input: {
  projectId: string;
  workItemId: string;
  action: BulkUpdateWorkItemsAction;
  repositories: Repositories;
}): Promise<BulkUpdateWorkItemsResultDto>
```

Behavior:

- load the work item;
- fail as `NOT_FOUND` with `displayKey: null` if it does not exist in the actor workspace;
- fail as `NOT_IN_PROJECT` without revealing display key if it exists outside the route project;
- validate workflow status transition for `transition_status`;
- compute the next single-item update request for non-status actions;
- use existing validation helpers for assignee, milestone, and labels;
- apply the update only when there is a real change;
- record activity and notifications for successful changes;
- return updated `WorkItemListItemDto` through existing `toListItemDtos`/bundle mapping.

### Mapping Bulk Actions To Existing Mutations

Recommended mapping:

| Bulk action | Service behavior |
| --- | --- |
| `set_assignee` | update `assigneeId` |
| `clear_assignee` | update `assigneeId: null` |
| `set_priority` | update `priority` |
| `set_milestone` | update `milestoneId` |
| `clear_milestone` | update `milestoneId: null` |
| `set_due_date` | update `dueDate` |
| `clear_due_date` | update `dueDate: null` |
| `add_labels` | current label ids union requested active label ids |
| `remove_labels` | current label ids minus requested label ids |
| `transition_status` | status transition with top insertion position |

Do not call public `updateWorkItem` or `transitionWorkItem` recursively from inside the bulk service loop because those methods open their own transactions and return detail DTOs. Instead, extract shared internal helpers where needed:

- project writability;
- label/milestone/assignee validation;
- update persistence;
- activity recording;
- notification recording;
- status transition persistence.

Keep helper extraction local to `WorkItemService` unless implementation pressure proves otherwise.

### Unchanged Results

Before writing, compare the requested change to current state.

Return `unchanged` when no stored state would change. Do not update `updatedAt`, activity, or notifications for unchanged items.

Examples:

- `set_assignee` to the current assignee;
- `clear_milestone` when milestone is already null;
- `add_labels` when all requested labels are already attached;
- `remove_labels` when none of the requested labels are attached;
- `transition_status` to the same status.

### Activity

Reuse existing activity behavior for:

- `work_item.assignee_changed`;
- `work_item.priority_changed`;
- `work_item.milestone_changed`;
- `work_item.label_added`;
- `work_item.label_removed`;
- `work_item.status_changed`.

Add:

```ts
| 'work_item.due_date_changed'
```

to `ActivityEventType` and `recordUpdateActivity`.

Due date activity should use:

- `previousValue: { dueDate: current.dueDate }` or null-equivalent value inside the object;
- `newValue: { dueDate: updated.dueDate }`;
- summary `Due date changed.` or a clearer set/cleared summary if implementation already has formatting helpers nearby.

Do not add a batch-level activity event.

### Notifications

Reuse existing notification calls:

- assignee changes record assignment notifications;
- status changes record watcher status notifications.

Do not add new notification types for priority, milestone, labels, or due date in v0.1.6.

Failed and unchanged items should not notify.

## Repository Design

Prefer existing repository methods first. Add only targeted helpers if implementation becomes awkward.

Likely useful additions:

```ts
workItems.findByIds(ids: string[]): Promise<WorkItem[]>
```

Optional only if needed to avoid repeated lookup for project/id validation. A per-item `findById` is acceptable at the v0.1.6 cap of 50, but action-reference validation should remain batched where practical.

Label repository already supports:

- `listByIds`;
- `listByWorkItem`;
- `listByWorkItems`;
- `replaceForWorkItem`.

Use `replaceForWorkItem` for add/remove actions after computing the next full label id set. This preserves the existing join-table behavior and existing activity diff logic.

No schema migration is required except for the activity event enum/type surface. If the database stores event types as text without a DB enum, no SQL migration is needed for the new due-date event.

## Error Mapping

Convert expected domain errors into per-item failures:

| Source | Result code |
| --- | --- |
| work item missing | `NOT_FOUND` |
| work item outside route project | `NOT_IN_PROJECT` |
| actor lacks bulk capability | request-level `FORBIDDEN` |
| archived project | request-level `PROJECT_ARCHIVED` |
| invalid assignee/milestone/label | request-level or item-level `INVALID_REFERENCE` |
| invalid status transition | `WORKFLOW_TRANSITION_ERROR` |
| request shape/domain validation | `VALIDATION_ERROR` |

Reference validation should be request-level when the action itself names an invalid target, such as a milestone id not in the route project. That prevents returning 50 identical item failures.

Workflow failures are item-level because they depend on each selected item status.

Cross-project ids should be item-level failures using `displayKey: null` unless the item is already known from the route project query.

## Web API Design

Update imports in `WorkItemsApi` and `WorktrailApiService`:

- `BulkUpdateWorkItemsRequest`;
- `BulkUpdateWorkItemsResponseDto`.

Add methods:

```ts
bulkUpdateProjectWorkItems(
  projectId: string,
  input: BulkUpdateWorkItemsRequest
): Observable<BulkUpdateWorkItemsResponseDto>
```

HTTP call:

```ts
return this.api.post<BulkUpdateWorkItemsResponseDto, BulkUpdateWorkItemsRequest>(
  `/projects/${projectId}/work-items/bulk-update`,
  input
);
```

Expose the same method through `WorktrailApiService`.

## Project Work Page Design

Modify only `WorkItemListPageComponent` for page behavior. The top-level workspace Work Items page remains unchanged.

### State

Add signals:

```ts
readonly selectedWorkItemIds = signal<string[]>([]);
readonly selectedWorkItemIdSet = computed(() => new Set(this.selectedWorkItemIds()));
readonly selectedWorkItems = computed(() =>
  this.workItems().filter((item) => this.selectedWorkItemIdSet().has(item.id))
);
readonly hasSelection = computed(() => this.selectedWorkItemIds().length > 0);
readonly selectedVisibleCount = computed(() => this.selectedWorkItems().length);
readonly isAllVisibleSelected = computed(() =>
  this.workItems().length > 0 && this.workItems().every((item) => this.selectedWorkItemIdSet().has(item.id))
);
readonly isBulkUpdating = signal(false);
readonly bulkUpdateError = signal<string | null>(null);
readonly bulkUpdateResult = signal<BulkUpdateWorkItemsResponseDto | null>(null);
```

Add a small form or signal group for the selected bulk action. Keep this local to the page unless the template becomes too large.

### Capability

Add:

```ts
readonly canBulkUpdateProjectWorkItems = computed(() => {
  const role = this.currentUser.selectedMember()?.role;
  return !this.isArchivedProject() && (role === 'owner' || role === 'maintainer');
});
```

The template should render selection checkboxes for maintainers/owners. Contributors can keep the read-only list experience without misleading disabled controls.

### Selection Behavior

Add methods:

- `toggleWorkItemSelection(workItemId: string): void`;
- `toggleAllVisibleSelection(): void`;
- `clearSelection(): void`;
- `pruneSelectionToVisibleRows(): void`;
- `isWorkItemSelected(workItemId: string): boolean`.

Clear selection when:

- query params change;
- filters are applied or cleared;
- saved/pinned view opens;
- project id changes;
- route/component is destroyed.

After `loadWorkItems`, prune selected ids to currently visible ids. This handles reloads after bulk updates.

### Template

Add a first column to the project work table/list rows:

- header checkbox for select all visible;
- row checkbox with `aria-label="Select WT-123"`;
- compact selected-row styling that does not break row links.

For mobile cards, place the checkbox in the row/card header beside the display key and status/priority metadata.

Bulk action bar:

- appears only when `hasSelection()` and `canBulkUpdateProjectWorkItems()`;
- shows selected count;
- has action select;
- shows the relevant value control for the selected action;
- has Apply and Clear buttons;
- disables Apply until the action input is complete;
- disables all controls while `isBulkUpdating()`.

Use native controls and existing button styles. Do not introduce Angular Material.

### Bulk Action Form

Recommended local form shape:

```ts
readonly bulkActionForm = this.formBuilder.nonNullable.group({
  actionType: [''],
  assigneeId: [''],
  priority: [''],
  milestoneId: [''],
  dueDate: [''],
  status: [''],
  labelIds: [[] as string[]]
});
```

Implementation may use signals instead if that better matches existing label-toggle code. The important design point is that only the fields relevant to the selected action are serialized.

Label add/remove should use checkboxes or the existing compact label picker style from create/detail pages, constrained to active labels. Archived labels attached to selected work items are not offered for new add/remove choices.

### Submission

`applyBulkUpdate()` should:

1. return early if no selection, invalid form, archived project, or unauthorized role;
2. optionally confirm `transition_status` when more than one item is selected;
3. serialize `BulkUpdateWorkItemsRequest`;
4. set loading state and clear previous errors;
5. call `api.bulkUpdateProjectWorkItems`;
6. store the result;
7. reload the current list;
8. clear successful/unchanged ids from selection;
9. keep failed ids selected if still visible after reload;
10. show a summary message.

Reloading after completion is simpler and safer than patching local rows because current filters may eject changed rows from the visible list.

### Result Feedback

Show a compact result panel below or inside the bulk action bar:

- `Updated 5, unchanged 2, failed 1.`
- If failures exist, list failed rows by display key when available or `Unknown item` when unavailable.
- Show the error message from the API.

Do not add a modal for v0.1.6. The result should remain visible until the next bulk submission, filter change, saved-view open, or manual clear.

## Styling And Accessibility

Use existing project Work page visual language.

Requirements:

- checkboxes should be normal control size and aligned with row text;
- action bar should be full-width within the list section, not a floating card;
- controls should wrap cleanly on small screens;
- labels must be associated with controls;
- row checkboxes need display-key-based accessible names;
- select-all checkbox should communicate visible-row scope;
- result failures should be reachable by screen readers without relying on color alone;
- no text should overlap in narrow widths.

## Seeds And Browser Smoke

Seed data should include a reliable project triage scenario.

Recommended additions or assertions:

- a project shared/pinned view for unassigned or ready work already exists from earlier sprints;
- at least two visible active work items can be selected by deterministic display key/title;
- at least one active label or milestone can be applied;
- one status transition smoke path has predictable eligibility.

Playwright should cover:

- owner/maintainer opens project Work page;
- opens a project lens if useful;
- selects two visible rows;
- applies one bulk action, recommended add label or set milestone;
- verifies summary and updated row/list state;
- opens one affected detail page and verifies activity;
- contributor or archived project path does not expose bulk action controls.

Keep the smoke focused. API and component tests should carry most edge-case coverage.

## Testing Strategy

### Contract Tests

Add tests for:

- action union assignability;
- response shape;
- unchanged and failed result statuses.

### API Tests

Add or extend work item endpoint/service tests for:

- request validation rejects empty ids, too many ids, duplicate ids, missing action values, duplicate label ids;
- owner/maintainer can bulk update;
- contributor receives request-level forbidden;
- archived project receives request-level rejection;
- set and clear assignee;
- set priority;
- set and clear milestone;
- set and clear due date;
- add and remove labels;
- status transition success;
- status transition item-level failure;
- cross-project item failure;
- invalid action reference rejection;
- unchanged items do not update timestamps or record activity;
- successful assignee/status changes keep notification behavior;
- due-date changes create `work_item.due_date_changed` activity.

### Web Unit Tests

Extend `work-items-page.component.spec.ts` for project page behavior:

- select one row;
- select all visible rows;
- clear selection;
- clear/prune selection on query change;
- hide bulk controls for contributors and archived projects;
- serialize each supported action type at least through focused helper tests;
- submit success and show counts;
- keep visible failed rows selected after result;
- reload list after completion.

### API Client Tests

Extend `worktrail-api.service.spec.ts` or `WorkItemsApi` tests:

- method posts to `/api/projects/:projectId/work-items/bulk-update`;
- body matches `BulkUpdateWorkItemsRequest`.

### Verification

Before final handoff:

```sh
npm run lint
npm run typecheck
npm run db:reset
npm run db:migrate
npm run db:seed
npm test
npm run build
npm run e2e
```

If the repo uses a combined verify script during implementation, run that as the final gate instead of duplicating slower subcommands.

## Documentation Plan

Finalization should update:

- README capabilities list;
- public static site capability copy if batch triage feels polished in-browser;
- `docs/v0.1.6/release-notes.md`;
- `docs/v0.1.6/pattern-extraction-notes.md`.

Pattern notes should stay destination-neutral and focus on:

- temporary page-local selection state;
- explicit batch command contracts;
- per-item result envelopes;
- partial success UX;
- activity and notification side effects.

## Risks And Mitigations

| Risk | Mitigation |
| --- | --- |
| Bulk service duplicates single-item logic | Extract small private helpers inside `WorkItemService` while keeping public route behavior unchanged. |
| Partial success becomes hard to reason about | Use request-level validation for global/action errors and item-level results only for item-specific failures. |
| Status transitions reorder board unexpectedly | Match current detail transition behavior by inserting at top of target status. |
| Filter refresh hides changed rows and confuses users | Store result summary before reload and show counts after reload. |
| Action bar crowds mobile list | Use wrapping controls and keep the surface visible only while selected. |
| Activity feed becomes noisy | Record only real field changes and avoid batch-level activity events. |

## Implementation Order

1. Add contract types and activity event type.
2. Add endpoint schema, handler, and route.
3. Add service-level bulk command with partial result mapping.
4. Add or adjust service helpers for due-date activity and unchanged detection.
5. Add API/client methods.
6. Add project Work page selection state and template checkboxes.
7. Add bulk action form, submission, result feedback, and selection pruning.
8. Add focused tests at contract, API, web API, component, and Playwright levels.
9. Update docs and final verification.
