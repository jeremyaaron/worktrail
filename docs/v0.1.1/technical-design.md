# Worktrail v0.1.1 Technical Design

## Overview

Worktrail v0.1.1 adds an Action Inbox for user-specific collaboration updates. The product already records activity and shows assigned work, but it does not route relevant changes to the people who need to see them. This release introduces persisted in-app notifications, work item watching, comment mentions, unread state, and deep links back into work.

The implementation remains local-first and synchronous. There is no queue, worker, email delivery, WebSocket transport, or hosted account model in this release. The design should still leave clear seams for those capabilities later by isolating notification fan-out behind service boundaries and by storing structured notification metadata instead of deriving UI from summary text.

The release preserves the existing architecture:

- Angular standalone components and lazy routes;
- shared contracts in `@worktrail/contracts`;
- transport-neutral API endpoint handlers;
- local Express adapter;
- service/repository layering;
- Drizzle-managed Postgres persistence;
- deterministic seed data;
- CI with a disposable Postgres service;
- static Angular hosting path for the eventual cloud version.

## Design Decisions

- Use `Inbox` as the primary navigation label.
- Add the inbox route at `/inbox`.
- Keep notifications in-app only.
- Keep notification fan-out synchronous inside the same transaction as the domain mutation when the mutation and notifications should commit together.
- Add separate `notifications`, `work_item_watchers`, and `comment_mentions` tables.
- Keep activity events and notifications separate:
  - activity is the audit/history stream;
  - notifications are actor-scoped attention records.
- Store notification render metadata directly on the notification.
- Add nullable activity-event references where a notification came from a recorded activity event, but do not require the UI to join through activity to render a notification.
- Use retained watcher rows with `unwatchedAt` rather than hard delete.
- Use a partial unique index to allow only one active watcher row per work item/member.
- Use a dedicated lightweight unread-count endpoint for the navigation badge.
- Include read-state mutation endpoints on notifications rather than overloading list endpoints.
- Mention support uses a member picker/insert control that sends `mentionMemberIds` with the comment request while keeping comment body plain text.
- Manual free-text `@name` parsing is out of scope for v0.1.1.
- New comment mentions notify only on comment creation, not on comment edit.
- Dependency notifications fire for blocking relationship add/remove in v0.1.1.
- Status changes on upstream blockers do not create `dependency_blocker_removed` or `dependency_blocker_added` notifications in v0.1.1; they can be added later with a richer derived-state event model.
- Do not add notification preferences in this release.
- Do not add project-level or workspace-level watching in this release.

## Domain Model

### Notification Types

Add notification type constants to the contracts and API domain layer:

```ts
export type NotificationType =
  | 'assignment'
  | 'mention'
  | 'watched_comment'
  | 'watched_status_change'
  | 'watched_assignee_change'
  | 'watched_relationship_change'
  | 'dependency_blocker_added'
  | 'dependency_blocker_removed';
```

Type semantics:

- `assignment`: recipient was assigned to a work item.
- `mention`: recipient was explicitly mentioned in a new comment.
- `watched_comment`: a non-mention comment was added to watched work.
- `watched_status_change`: watched work changed status.
- `watched_assignee_change`: watched work changed assignee.
- `watched_relationship_change`: a relationship on watched work changed.
- `dependency_blocker_added`: an open upstream blocker was added to downstream work relevant to the recipient.
- `dependency_blocker_removed`: an upstream blocker relationship was removed from downstream work relevant to the recipient.

Recipient fan-out should enforce one notification per recipient per domain command. If a recipient qualifies for multiple notification types from a single command, use this priority:

1. `mention`;
2. `assignment`;
3. `dependency_blocker_added` / `dependency_blocker_removed`;
4. watched-work notifications.

This keeps the inbox useful and avoids duplicate rows from one user action.

### Work Item Watching

A watcher is an active subscription by a member to a work item.

Watchers are created through three paths:

- explicit watch control on work item detail;
- automatic reporter watch on work item creation;
- automatic assignee watch on work item creation or assignee change.

Unwatching sets `unwatchedAt` and keeps the historical row.

Only active watcher rows receive future notifications:

```ts
unwatchedAt === null
```

Inactive members must never receive new notifications even if they still have active watcher rows from before deactivation.

### Comment Mentions

Comment mentions are explicit member references selected in the comment composer.

The API accepts:

```ts
interface CreateCommentRequest {
  body: string;
  mentionMemberIds?: string[];
}
```

Rules:

- `mentionMemberIds` defaults to an empty list.
- IDs are deduplicated.
- Every mentioned member must be active and in the actor's workspace.
- The comment author may mention themselves, but no self-notification is created.
- The comment body remains plain text.
- The frontend inserts readable `@Member Name` text into the textarea when the picker is used.
- Rendering uses `CommentDto.mentions` metadata to style or identify mentions, not brittle text parsing.

This avoids the ambiguity of display-name parsing while still giving users a simple mention workflow.

## Database Design

Add one Drizzle migration for the v0.1.1 schema changes.

### `work_item_watchers`

Columns:

- `id uuid primary key`;
- `workspace_id uuid not null references workspaces(id)`;
- `work_item_id uuid not null references work_items(id) on delete cascade`;
- `member_id uuid not null references members(id)`;
- `watched_at timestamptz not null`;
- `unwatched_at timestamptz`;
- `created_at timestamptz not null`;
- `updated_at timestamptz not null`.

Indexes:

- `(workspace_id, member_id, unwatched_at)`;
- `(work_item_id, unwatched_at)`;
- partial unique index on `(work_item_id, member_id)` where `unwatched_at is null`.

Repository behavior:

- `watch(workItemId, memberId)`:
  - if an active row exists, return it;
  - otherwise create a new row;
  - do not reactivate old rows unless implementation discovers this is materially simpler.
- `unwatch(workItemId, memberId)`:
  - set `unwatchedAt` on the active row;
  - no-op if none exists.

### `notifications`

Columns:

- `id uuid primary key`;
- `workspace_id uuid not null references workspaces(id)`;
- `recipient_member_id uuid not null references members(id)`;
- `actor_member_id uuid references members(id)`;
- `project_id uuid references projects(id)`;
- `work_item_id uuid references work_items(id) on delete cascade`;
- `activity_event_id uuid`;
- `notification_type text not null`;
- `summary text not null`;
- `metadata jsonb not null`;
- `source_event_key text`;
- `read_at timestamptz`;
- `created_at timestamptz not null`.

Indexes:

- `(workspace_id, recipient_member_id, read_at, created_at desc)`;
- `(workspace_id, recipient_member_id, created_at desc)`;
- `(work_item_id, created_at desc)`;
- partial unique index on `(recipient_member_id, source_event_key)` where `source_event_key is not null`.

The `source_event_key` is an idempotency/dedupe key for domain commands. It should be set for notifications created from a single known mutation, such as:

```text
comment:<commentId>:mention
work-item:<workItemId>:assignee:<activityEventId>
relationship:<relationshipId>:created
relationship:<relationshipId>:deleted:<timestamp-or-command-id>
```

If a clean source key is not available, recipient dedupe within the service call is still required.

### `comment_mentions`

Columns:

- `comment_id uuid not null references comments(id) on delete cascade`;
- `member_id uuid not null references members(id)`;
- `workspace_id uuid not null references workspaces(id)`;
- `work_item_id uuid not null references work_items(id) on delete cascade`;
- `created_at timestamptz not null`.

Primary key:

- `(comment_id, member_id)`.

Indexes:

- `(workspace_id, member_id, created_at desc)`;
- `(work_item_id, created_at desc)`.

The denormalized workspace/work item columns keep mention queries simple and avoid extra joins for common read paths.

## Contracts

Add `packages/contracts/src/notifications.ts` and export it from the package barrel.

Recommended DTOs:

```ts
export type NotificationStateFilter = 'unread' | 'all';

export interface NotificationWorkItemRefDto {
  id: string;
  displayKey: string;
  title: string;
  status: WorkItemStatus;
}

export interface NotificationProjectRefDto {
  id: string;
  key: string;
  name: string;
}

export interface NotificationDto {
  id: string;
  type: NotificationType;
  summary: string;
  actor: MemberDto | null;
  project: NotificationProjectRefDto | null;
  workItem: NotificationWorkItemRefDto | null;
  metadata: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationListResponse {
  items: NotificationDto[];
  unreadCount: number;
}

export interface NotificationUnreadCountResponse {
  unreadCount: number;
}

export interface UpdateNotificationReadStateRequest {
  read: boolean;
}

export interface WorkItemWatcherDto {
  id: string;
  member: MemberDto;
  watchedAt: string;
}

export interface WorkItemWatchStateDto {
  isWatchedByCurrentActor: boolean;
  watcherCount: number;
  watchers: WorkItemWatcherDto[];
}
```

Update `CommentDto`:

```ts
mentions: MemberDto[];
```

Update `CreateCommentRequest`:

```ts
mentionMemberIds?: string[];
```

If implementation risk is lower, `WorkItemWatchStateDto` can be embedded in `WorkItemDetailDto` and also exposed through a dedicated watcher endpoint.

## API Design

### Notification Endpoints

Add `apps/api/src/endpoints/notifications.ts`.

Routes:

- `GET /api/notifications?state=unread|all`
  - returns `NotificationListResponse`;
  - defaults to `state=unread`;
  - newest first;
  - initial hard limit of 100 is acceptable for v0.1.1.
- `GET /api/notifications/unread-count`
  - returns `NotificationUnreadCountResponse`.
- `PATCH /api/notifications/:notificationId`
  - body: `UpdateNotificationReadStateRequest`;
  - sets `readAt` to now when `read=true`;
  - clears `readAt` when `read=false`.
- `POST /api/notifications/mark-all-read`
  - marks all current actor unread notifications read;
  - returns `NotificationUnreadCountResponse`.

All routes are actor-scoped:

- use `workspaceId` and `memberId` from actor context;
- never accept recipient member IDs from the client for reads or read-state mutations;
- return 404 for notification IDs outside the current actor's notification set.

### Watcher Endpoints

Add watcher routes under work items:

- `GET /api/work-items/:workItemId/watchers`
  - returns `WorkItemWatchStateDto`.
- `PUT /api/work-items/:workItemId/watch`
  - watches as the current actor;
  - returns `WorkItemWatchStateDto`.
- `DELETE /api/work-items/:workItemId/watch`
  - unwatches as the current actor;
  - returns `WorkItemWatchStateDto`.

Watch endpoints should reuse existing work item visibility and archived project checks where appropriate. Watching archived project work should be read-only blocked unless implementation confirms existing archived work detail actions allow similar personal state updates. Default decision: archived project work is not watchable/unwatchable.

### Comment Endpoint Update

Update the existing create-comment endpoint body schema:

```ts
{
  body: string;
  mentionMemberIds?: string[];
}
```

Mention validation belongs in `CommentService`, not the endpoint.

## Backend Services

### `NotificationService`

Responsibilities:

- list current actor notifications;
- get current actor unread count;
- update current actor read state;
- mark all current actor notifications read;
- create notification records for recipient commands;
- dedupe recipients inside one fan-out command;
- exclude the actor and inactive members;
- convert notification rows to DTOs.

Suggested command shape:

```ts
interface CreateNotificationInput {
  recipientMemberId: string;
  actorMemberId: string | null;
  type: NotificationType;
  summary: string;
  projectId?: string | null;
  workItemId?: string | null;
  activityEventId?: string | null;
  metadata: Record<string, unknown>;
  sourceEventKey?: string | null;
}
```

This service should not know the full semantics of assignment or relationship changes. Domain services should decide why a notification exists; `NotificationService` should enforce common persistence, actor exclusion, inactive-member exclusion, and DTO conversion.

### `WorkItemWatcherService`

Responsibilities:

- list watcher state for a work item;
- watch/unwatch as current actor;
- auto-watch reporter/assignee from domain services;
- find active watcher member IDs for notification fan-out;
- filter inactive members before returning recipient IDs.

The service may share a repository with notification fan-out, but it should remain conceptually separate from read-state behavior.

### `CommentMentionService` Or Helpers

Mention behavior can live inside `CommentService` initially if the code remains small. Extract a helper if validation/parsing grows.

Responsibilities:

- dedupe `mentionMemberIds`;
- validate active same-workspace members;
- persist `comment_mentions`;
- return mentioned members for DTO conversion;
- produce mention notification recipients.

### Domain Service Integration

Integrate notification fan-out at the point where the domain mutation already has context.

#### Work Item Creation

In `WorkItemService.createWorkItem`:

- create the work item;
- auto-watch reporter;
- auto-watch assignee when present;
- create `assignment` notification for assignee when assignee is not the actor.

#### Work Item Update

In `WorkItemService.updateWorkItem`:

- detect status changes;
- detect assignee changes;
- preserve existing activity behavior;
- auto-watch newly assigned active member;
- create `assignment` notification for new assignee when new assignee is not actor;
- create `watched_status_change` notifications for active watchers when status changed;
- create `watched_assignee_change` notifications for active watchers when assignee changed;
- apply type-priority dedupe if the new assignee is also a watcher.

#### Comment Creation

In `CommentService.createComment`:

- create the comment;
- persist mention rows;
- notify mentioned members with `mention`;
- notify active watchers with `watched_comment`;
- prioritize `mention` over `watched_comment` for recipients who are both mentioned and watching.

Comment edit/delete should not create notifications in v0.1.1.

#### Relationship Changes

In `WorkItemRelationshipService.createRelationship` and `deleteRelationship`:

- preserve current relationship and activity behavior;
- for any watched work item involved, notify active watchers with `watched_relationship_change`;
- for `blocks` relationships:
  - treat `sourceWorkItemId` as upstream blocker;
  - treat `targetWorkItemId` as downstream blocked work;
  - on create, notify downstream assignee and downstream watchers with `dependency_blocker_added`;
  - on delete, notify downstream assignee and downstream watchers with `dependency_blocker_removed`;
  - exclude actor and inactive members;
  - dedupe against watcher notifications from the same command.

### Transaction Boundaries

Use the existing repository transaction helper for mutations that now write domain records, activity, watchers, mentions, and notifications.

For v0.1.1:

- work item create/update, comment create, and relationship create/delete should commit notification fan-out with the triggering mutation;
- inbox read-state updates can be independent transactions;
- watch/unwatch can be independent transactions.

If a notification insert fails, the associated domain mutation should fail. This is acceptable for the local synchronous model and keeps state consistent. A future queue-based design can relax this.

## Repository Changes

Add repositories:

```text
apps/api/src/repositories/notification-repository.ts
apps/api/src/repositories/work-item-watcher-repository.ts
apps/api/src/repositories/comment-mention-repository.ts
```

Update `apps/api/src/repositories/index.ts` to include them in normal and transactional repository contexts.

Repository capabilities:

- notification list/count/update/mark-all-read/create;
- watcher list active, watch, unwatch, find active member IDs by work item;
- comment mention create many and list by comment IDs.

Keep joins in repositories where they materially reduce service loops. Prefer simple repository methods over a broad generic query builder.

## Frontend Architecture

### Routes And Navigation

Add lazy route:

```ts
{
  path: 'inbox',
  loadComponent: () =>
    import('./features/inbox/inbox-page.component').then((module) => module.InboxPageComponent),
  title: 'Inbox | Worktrail'
}
```

Primary navigation order:

1. `My Work`;
2. `Inbox`;
3. `Work Items`;
4. `Projects`;
5. `Workspace Settings`;
6. `Create`.

The `Inbox` nav item should display an unread badge when count is greater than zero.

### API Client

Add:

```text
apps/web/src/app/core/api/notifications-api.ts
```

Methods:

- `listNotifications(state: NotificationStateFilter)`;
- `getUnreadCount()`;
- `updateNotificationReadState(id, request)`;
- `markAllRead()`;

Watcher methods can live in `work-items-api.ts` because watcher state is scoped under work item routes:

- `getWatchState(workItemId)`;
- `watchWorkItem(workItemId)`;
- `unwatchWorkItem(workItemId)`.

Add compatibility passthroughs to `WorktrailApiService` only where existing components still use it.

### Inbox State

Add a small app-level service:

```text
apps/web/src/app/features/inbox/inbox-state.service.ts
```

Responsibilities:

- load unread count;
- expose `unreadCount` as a signal;
- refresh when current actor changes;
- update count after mark-read/mark-unread/mark-all-read actions.

This is intentionally not a global state framework. It is a narrow app-shell concern like the current actor selector.

### Inbox Page

Add:

```text
apps/web/src/app/features/inbox/inbox-page.component.ts
apps/web/src/app/features/inbox/components/notification-list.component.ts
apps/web/src/app/features/inbox/components/notification-card.component.ts
```

Page behavior:

- default tab/filter: `Unread`;
- secondary tab/filter: `All`;
- show compact empty states;
- show notification cards with type label, summary, actor, project/work key, timestamp, and read controls;
- link each actionable notification to `/work-items/:workItemId` when `workItem` exists;
- link project-only notifications to `/projects/:projectId` if future notification types use project-only context.

Use normal buttons, not checkbox controls, for read/unread actions because read state is a command, not a persistent setting in a form.

### Work Item Detail Watch Control

Add a compact watch panel/control near the work item summary metadata.

Behavior:

- load watch state with the work item detail data or immediately after detail load;
- show `Watch` or `Watching` state for current actor;
- show watcher count;
- show watcher list in a compact details/disclosure region if more than a few watchers;
- disable watch/unwatch while mutation is in flight;
- reload watch state and inbox unread count after mutations only if needed.

If embedding watch state into `WorkItemDetailDto` is straightforward, prefer that to avoid an extra request on detail load. Keep dedicated watch endpoints either way for mutation responses and focused tests.

### Comment Mention UI

Update the comment composer on work item detail:

- add a compact member picker beside or below the textarea;
- selecting a member:
  - appends `@Member Name` to the textarea at the cursor when feasible, or at the end otherwise;
  - adds the member ID to a local selected mentions set;
  - displays selected mentioned members as removable chips;
- send `mentionMemberIds` with the create-comment request;
- reset selected mentions after successful create.

Do not attempt rich text, autocompletion, or manual text parsing in v0.1.1. The picker gives deterministic mention metadata with low implementation risk.

### My Work Integration

Add a small inbox summary near the top of My Work:

- unread count;
- link to `/inbox`;
- no full notification list.

This keeps My Work focused on assigned work while making collaboration updates visible.

## Endpoint Registration

Add:

```text
apps/api/src/adapters/express/routes/notification-routes.ts
```

Register it from the existing Express route setup with the same route context pattern introduced in v0.1.0.

Add watcher routes to the existing work item route module unless the module becomes too noisy. If it does, split a small `watcher-routes.ts` under the work item route group.

## Seed Data

Update seed data to demonstrate:

- Avery has unread assignment or watched-work notifications;
- Blake has at least one read notification and one unread notification;
- Casey watches a work item they do not own;
- at least one seeded comment has mention metadata;
- work item detail shows a watcher count greater than one for one seeded item.

Use deterministic timestamps based on existing seed timestamp helpers. Do not rely on `new Date()` in seed data where order matters.

## Testing Strategy

### API Tests

Add focused tests for:

- notification list is actor-scoped;
- unread count is actor-scoped;
- read/unread mutation cannot affect another actor's notification;
- mark-all-read affects only current actor;
- watch/unwatch creates and deactivates watcher rows;
- watch is idempotent for active watcher rows;
- work item creation auto-watches reporter and assignee;
- assignment creates expected notification;
- comment creation persists mentions and creates mention notifications;
- watcher comment notifications do not duplicate mention notifications;
- status/assignee changes notify watchers;
- blocking relationship create/delete notifies downstream assignee/watchers;
- inactive members do not receive notifications.

### Web Tests

Add focused Angular tests for:

- primary nav displays unread badge;
- actor switch refreshes inbox count;
- inbox page loads unread/all notifications;
- read/unread and mark-all-read actions update visible state;
- work item detail watch control calls watch/unwatch APIs;
- comment mention picker sends `mentionMemberIds`;
- My Work shows inbox summary link/count.

### E2E Smoke

Update Playwright smoke after unit coverage is in place:

- seed database;
- switch actors if needed;
- verify inbox unread count;
- create a comment with a mention;
- verify mentioned actor sees an unread inbox notification;
- mark it read.

Keep E2E out of CI unless the existing workflow changes.

### Verification Commands

Expected final verification:

```sh
npm run db:generate
npm run db:reset
npm run db:migrate
npm run db:seed
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
git diff --check
```

CI should continue to run:

```sh
npm ci
npm run lint
npm run typecheck
npm run db:reset && npm run db:migrate && npm run db:seed
npm test
npm run build
```

## OpenAPI And Documentation

Update `docs/api/openapi.yaml` for:

- notification DTOs;
- notification list/count/read-state endpoints;
- watcher state DTOs;
- watcher endpoints;
- updated create-comment request and comment response mention metadata.

Update README:

- current capabilities include Inbox, watchers, and mentions;
- local setup and verification remain unchanged except for new migration;
- mention that notifications are in-app only.

Add `docs/v0.1.1/jawstack-extraction-notes.md` during finalization with patterns for:

- domain event fan-out;
- actor-scoped read models;
- idempotent notification writes;
- watcher/subscription persistence;
- synchronous local implementation with queue-compatible seams.

Refresh `site/index.html` and `site/styles.css` only as needed to mention the Action Inbox and collaboration loop without turning the site into release notes.

## Migration And Compatibility

This release requires a database migration.

Compatibility notes:

- Existing comments remain valid with an empty `mentions` list.
- Existing work items gain watcher rows only through seed data or future user actions; do not backfill watchers for all historical work items in migration.
- Seed data should create representative watcher and notification rows after migrations.
- Existing API clients that send only `{ body }` for comments continue to work because `mentionMemberIds` is optional.
- Existing work item detail rendering should tolerate missing watcher state until frontend integration is complete.

## Future Cloud Path

The synchronous local design should map cleanly to cloud deployment later:

- domain services can later publish notification events to an event bus or queue;
- notification persistence can move behind an asynchronous consumer;
- unread count can be cached per member if needed;
- email/push delivery can consume the same notification records;
- API Gateway/Lambda handlers can reuse the transport-neutral endpoint functions;
- Angular remains statically deployable to S3/CloudFront.

Do not add cloud infrastructure in v0.1.1. The design goal is to avoid blocking that path.

## Deferred Items

- email and push notification delivery;
- notification preferences;
- notification delete/archive;
- realtime badge updates;
- project-level watching;
- workspace/team announcements;
- due-date reminders;
- status-driven dependency-resolution notifications;
- rich-text mention editor;
- generated client from OpenAPI;
- queue/event-bus infrastructure.
