# Worktrail v0.1.1 Implementation Plan

## Purpose

This plan turns the v0.1.1 PRD and technical design into sequential implementation phases. v0.1.1 should add an Action Inbox for user-specific collaboration updates, with persisted in-app notifications, work item watching, comment mentions, unread/read state, My Work integration, and clear backend seams for future notification delivery patterns.

The release remains local-first. It should preserve Angular static-hosting compatibility, transport-neutral API handlers, the local Express adapter, Postgres persistence, deterministic seed data, checked-in OpenAPI docs, CI verification with a disposable Postgres service, and clean local setup from a fresh checkout.

## Design Decisions

Use these decisions while implementing v0.1.1:

- Use `Inbox` as the primary navigation label.
- Add `/inbox` as a lazy Angular route.
- Keep notifications in-app only.
- Add `notifications`, `work_item_watchers`, and `comment_mentions` tables.
- Keep activity events separate from notifications.
- Store structured notification render metadata directly on notifications.
- Add optional activity-event references to notifications where convenient.
- Keep notification fan-out synchronous in domain-service transactions.
- Use retained watcher rows with `unwatchedAt`.
- Enforce one active watcher row per work item/member with a partial unique index.
- Use a dedicated unread-count endpoint for the app-shell badge.
- Use notification read-state mutation endpoints.
- Implement mentions through a member picker that sends `mentionMemberIds`; keep comment body plain text.
- Do not parse arbitrary free-text mentions in v0.1.1.
- Notify mentions only on comment creation.
- Fire dependency notifications for blocking relationship add/remove only.
- Do not add notification preferences, email, push, queues, or realtime transport.
- Keep Playwright E2E out of required CI.

## Phase Sizing

Each phase should leave the repository in a coherent working state. This release touches database schema, contracts, API services, app shell state, and work item detail UX, so implementation is split around durable seams:

1. baseline planning;
2. contracts and schema migration;
3. notification and watcher repositories;
4. notification and watcher services/endpoints;
5. comment mentions backend;
6. domain fan-out integration;
7. seed data and backend verification;
8. frontend API clients and inbox state;
9. inbox route, navigation badge, and My Work integration;
10. work item detail watch and mention UI;
11. E2E smoke, docs, site, release notes, and final verification.

Run focused API tests after backend phases, focused web tests after frontend phases, and full verification during finalization. Prefer service-level tests for fan-out logic before broad browser coverage.

## Phase 0: Baseline Planning

Goal: confirm v0.1.1 planning inputs and repository state before runtime changes.

Scope:

- Confirm `docs/v0.1.1/prd.md` exists.
- Confirm `docs/v0.1.1/technical-design.md` exists.
- Confirm `docs/v0.1.1/implementation-plan.md` exists.
- Confirm v0.0.x archive movement is understood and not accidentally reverted.
- Check repository status before implementation starts.
- Confirm active branch.
- Confirm no unresolved technical choice blocks Phase 1.

Out of scope:

- Runtime implementation.
- Database migration.
- Contract changes.
- UI changes.

Acceptance criteria:

- The three v0.1.1 planning documents exist.
- Design decisions are recorded.
- Worktree/index state is understood before implementation starts.
- No open decision blocks Phase 1.

Suggested commands:

```sh
find docs/v0.1.1 -maxdepth 1 -type f | sort
git status --short --branch
git diff --check
```

Status:

- Completed on 2026-07-05.
- Confirmed v0.1.1 planning documents exist:
  - `docs/v0.1.1/prd.md`;
  - `docs/v0.1.1/technical-design.md`;
  - `docs/v0.1.1/implementation-plan.md`.
- Confirmed implementation decisions:
  - use `Inbox` as the primary navigation label;
  - add `/inbox` as a lazy Angular route;
  - keep notifications in-app only;
  - add `notifications`, `work_item_watchers`, and `comment_mentions` tables;
  - keep activity events separate from notifications;
  - store structured notification render metadata directly on notifications;
  - add optional activity-event references to notifications where convenient;
  - keep notification fan-out synchronous in domain-service transactions;
  - use retained watcher rows with `unwatchedAt`;
  - enforce one active watcher row per work item/member with a partial unique index;
  - use a dedicated unread-count endpoint for the app-shell badge;
  - use notification read-state mutation endpoints;
  - implement mentions through a member picker that sends `mentionMemberIds`;
  - do not parse arbitrary free-text mentions in v0.1.1;
  - notify mentions only on comment creation;
  - fire dependency notifications for blocking relationship add/remove only;
  - do not add notification preferences, email, push, queues, or realtime transport;
  - keep Playwright E2E out of required CI.
- Confirmed active branch is `v0.1.1`.
- Confirmed current change state:
  - v0.0.x sprint documents have been moved under `docs/v0.0.X/`;
  - `docs/v0.1.1/` is untracked and contains the three planning documents.
- Verified `git diff --check`.
- No unresolved technical choice blocks Phase 1.

## Phase 1: Contracts And Schema Migration

Goal: create the shared type and database foundations for notifications, watchers, and mentions.

Scope:

- Add notification and watcher contract types in `packages/contracts/src/notifications.ts`.
- Export notification contracts from `packages/contracts/src/index.ts`.
- Update comment contracts:
  - `CreateCommentRequest.mentionMemberIds?: string[]`;
  - `CommentDto.mentions: MemberDto[]`.
- Add API domain constants for notification types.
- Update Drizzle schema with:
  - `notifications`;
  - `work_item_watchers`;
  - `comment_mentions`.
- Generate and review the migration.
- Ensure reset/migrate handles the new schema.
- Add lightweight contract tests for notification DTO shapes and optional comment mentions.

Out of scope:

- Runtime endpoints.
- Notification fan-out.
- Frontend rendering.
- Seed data for new tables.

Acceptance criteria:

- Contracts compile and remain exported through `@worktrail/contracts`.
- Migration applies from a reset local database.
- Existing comment request callers remain valid because mentions are optional.
- No behavior changes are required to existing API tests beyond DTO compile updates.

Suggested commands:

```sh
npm run db:generate
npm run db:reset
npm run db:migrate
npm run typecheck --workspace @worktrail/contracts
npm test --workspace @worktrail/contracts
npm run typecheck --workspace @worktrail/api
git diff --check
```

Status:

- Completed on 2026-07-05.
- Added `packages/contracts/src/notifications.ts` with:
  - notification type/state contracts;
  - notification list/count/read-state DTOs;
  - work item watcher state DTOs.
- Exported notification contracts through `@worktrail/contracts`.
- Updated comment contracts:
  - `CreateCommentRequest.mentionMemberIds?: string[]`;
  - `CommentDto.mentions: MemberDto[]`.
- Added contract tests covering notification list responses, watcher state, and optional comment mention create requests.
- Added API notification type constants.
- Updated Drizzle schema with:
  - `notifications`;
  - `work_item_watchers`;
  - `comment_mentions`.
- Generated migration `apps/api/drizzle/0006_odd_valeria_richards.sql`.
- Updated Drizzle metadata snapshot and journal.
- Added API repository select/insert type aliases for the new tables.
- Updated comment response mapping to return an empty `mentions` array until Phase 4 adds mention persistence.
- Updated create-comment endpoint validation to accept optional `mentionMemberIds` without requiring existing callers to send it.
- Updated work item detail web test fixtures for the new `CommentDto.mentions` field.
- Verified:
  - `npm run db:generate`
  - `npm run db:reset`
  - `npm run db:migrate`
  - `npm run db:seed`
  - `npm run typecheck --workspace @worktrail/contracts`
  - `npm test --workspace @worktrail/contracts`
  - `npm run typecheck --workspace @worktrail/api`
  - `npm test --workspace @worktrail/api`
  - `npm run typecheck --workspace @worktrail/web`
  - `git diff --check`

## Phase 2: Notification And Watcher Repositories

Goal: add persistence APIs with focused tests before adding service behavior.

Scope:

- Add `apps/api/src/repositories/notification-repository.ts`.
- Add `apps/api/src/repositories/work-item-watcher-repository.ts`.
- Add `apps/api/src/repositories/comment-mention-repository.ts`.
- Register the repositories in `apps/api/src/repositories/index.ts`.
- Add repository type exports as needed.
- Implement notification persistence:
  - create;
  - list by actor/state;
  - unread count;
  - set read state;
  - mark all read.
- Implement watcher persistence:
  - watch idempotently;
  - unwatch by setting `unwatchedAt`;
  - list active watchers;
  - find active watcher member IDs.
- Implement comment mention persistence:
  - create many;
  - list by comment or comment IDs.
- Add repository tests for actor scoping, read state, watcher idempotency, and mention persistence.

Out of scope:

- Endpoint handlers.
- Domain fan-out.
- Frontend changes.

Acceptance criteria:

- Repository methods work against Postgres.
- Active watcher uniqueness is enforced.
- Read-state updates cannot leak across recipients when used correctly by service methods.
- Existing repository tests still pass.

Suggested commands:

```sh
npm run db:reset
npm run db:migrate
npm test --workspace @worktrail/api -- repositories
npm test --workspace @worktrail/api -- notifications watchers mentions
npm run typecheck --workspace @worktrail/api
git diff --check
```

Status:

- Completed on 2026-07-05.
- Added `apps/api/src/repositories/notification-repository.ts` with:
  - `create`;
  - `createMany`;
  - actor-scoped list by unread/all state;
  - actor-scoped unread count;
  - actor-scoped read-state update;
  - actor-scoped mark-all-read.
- Added `apps/api/src/repositories/work-item-watcher-repository.ts` with:
  - idempotent active watch creation;
  - active watcher lookup;
  - active watcher list by work item;
  - active watcher member ID lookup filtered to active members;
  - unwatch via `unwatchedAt`.
- Added `apps/api/src/repositories/comment-mention-repository.ts` with:
  - bulk create;
  - list by comment;
  - list by comment IDs.
- Registered the new repositories in normal and transactional repository contexts.
- Updated repository integration-test cleanup so notification, mention, and watcher rows do not block workspace cleanup.
- Added repository tests for:
  - actor-scoped notification list/count;
  - read-state isolation across recipients;
  - mark-all-read;
  - idempotent watcher creation;
  - unwatch/deactivation behavior;
  - active watcher member ID lookup;
  - comment mention create/list behavior.
- Verified:
  - `npm run typecheck --workspace @worktrail/api`
  - `npm test --workspace @worktrail/api -- repositories`
  - `npm test --workspace @worktrail/api`
  - `git diff --check`

## Phase 3: Notification And Watcher Services/Endpoints

Goal: expose actor-scoped notification and watcher behavior without domain fan-out yet.

Scope:

- Add `NotificationService`.
- Add `WorkItemWatcherService`.
- Add notification endpoint handlers:
  - list notifications;
  - unread count;
  - set read/unread;
  - mark all read.
- Add watcher endpoint handlers:
  - get work item watch state;
  - watch current actor;
  - unwatch current actor.
- Add Express route registration for notification routes.
- Add watcher routes under the work item route group.
- Add DTO conversion for notification and watcher responses.
- Enforce actor scoping and active-member rules.
- Enforce work item visibility and archived-project rules for watch/unwatch.
- Add API tests for:
  - actor-scoped inbox list/count;
  - read/unread mutations;
  - mark all read;
  - watch/unwatch through endpoint layer;
  - cross-actor/cross-workspace rejection.

Out of scope:

- Automatic notifications from work item/comment/relationship mutations.
- Mention support.
- Frontend pages.

Acceptance criteria:

- A seeded or test-created notification can be listed only by its recipient.
- Unread count reflects read-state mutations.
- Watch/unwatch endpoint behavior is idempotent and actor-scoped.
- Existing API route tests still pass.

Suggested commands:

```sh
npm test --workspace @worktrail/api -- notifications
npm test --workspace @worktrail/api -- watchers
npm test --workspace @worktrail/api
npm run typecheck --workspace @worktrail/api
git diff --check
```

Status:

- Completed on 2026-07-05.
- Added `apps/api/src/services/notification-service.ts` with actor-scoped notification list/count, read-state mutation, mark-all-read, and DTO conversion.
- Added `apps/api/src/services/work-item-watcher-service.ts` with watch-state lookup, idempotent watch creation, unwatch support, active-member scoping, and archived-project write protection.
- Added `apps/api/src/endpoints/notifications.ts` and registered Express routes for:
  - `GET /api/notifications`;
  - `GET /api/notifications/unread-count`;
  - `PATCH /api/notifications/:notificationId`;
  - `POST /api/notifications/mark-all-read`.
- Added work item watcher endpoint handlers and routes for:
  - `GET /api/work-items/:workItemId/watchers`;
  - `PUT /api/work-items/:workItemId/watch`;
  - `DELETE /api/work-items/:workItemId/watch`.
- Updated Express route registration tests for the new notification and watcher routes.
- Added API coverage in `apps/api/tests/notifications-watchers.test.ts` for:
  - recipient-scoped notification listing;
  - unread-count isolation;
  - read/unread updates;
  - mark-all-read behavior;
  - idempotent watch/unwatch behavior;
  - archived-project watch write rejection.
- Verified:
  - `npm run typecheck --workspace @worktrail/api`
  - `npm test --workspace @worktrail/api -- notifications-watchers`
  - `npm test --workspace @worktrail/api -- server`
  - `npm test --workspace @worktrail/api`
  - `git diff --check`

## Phase 4: Comment Mentions Backend

Goal: support deterministic comment mentions and mention metadata before wiring the full UI.

Scope:

- Update comment endpoint validation to accept `mentionMemberIds`.
- Update `CommentService.createComment` to:
  - dedupe mention IDs;
  - validate active same-workspace members;
  - persist `comment_mentions`;
  - return mentions in comment DTOs.
- Update comment listing/detail DTO conversion to include mentions.
- Ensure old `{ body }` comment requests still work.
- Add API tests for:
  - comment with mentions;
  - duplicate mention IDs;
  - inactive member rejection;
  - cross-workspace member rejection;
  - self mention stores metadata but does not imply notification yet.

Out of scope:

- Mention notification creation.
- Frontend mention picker.
- Rich text parsing.

Acceptance criteria:

- Comments can store and return mention metadata.
- Existing comment tests still pass.
- Invalid mention member IDs are rejected predictably.

Suggested commands:

```sh
npm test --workspace @worktrail/api -- comments
npm test --workspace @worktrail/api
npm run typecheck --workspace @worktrail/api
git diff --check
```

## Phase 5: Domain Notification Fan-Out

Goal: create notifications from collaboration events with centralized dedupe and actor/inactive-member exclusion.

Scope:

- Add notification fan-out helpers in `NotificationService`.
- Integrate work item creation:
  - auto-watch reporter;
  - auto-watch assignee;
  - create assignment notification for assignee when appropriate.
- Integrate work item update:
  - auto-watch newly assigned member;
  - notify new assignee;
  - notify watchers for status changes;
  - notify watchers for assignee changes.
- Integrate comment creation:
  - create mention notifications;
  - create watched-comment notifications;
  - prioritize mention over watched-comment for the same recipient.
- Integrate relationship create/delete:
  - notify watchers for relationship changes;
  - notify downstream assignee/watchers for blocking relationship add/remove.
- Keep fan-out in the same transaction as the mutation.
- Add idempotency/source-event keys where stable IDs exist.
- Add API/service tests for expected recipients, dedupe, actor exclusion, inactive exclusion, and transaction behavior.

Out of scope:

- Frontend inbox rendering.
- Notification preferences.
- Status-driven dependency resolution notifications.

Acceptance criteria:

- Each supported domain command creates deterministic notifications.
- A recipient receives at most one notification per domain command.
- Actors do not notify themselves.
- Inactive members do not receive notifications.
- Existing mutation behavior remains unchanged except for new watcher/notification side effects.

Suggested commands:

```sh
npm test --workspace @worktrail/api -- notifications
npm test --workspace @worktrail/api -- work-items
npm test --workspace @worktrail/api -- comments
npm test --workspace @worktrail/api -- relationships
npm test --workspace @worktrail/api
npm run typecheck --workspace @worktrail/api
git diff --check
```

## Phase 6: Seed Data And Backend Verification

Goal: make the new collaboration loop visible in deterministic local data and stabilize backend verification.

Scope:

- Update seed data with:
  - representative active watchers;
  - comment mention metadata;
  - unread notifications for at least two active members;
  - at least one read notification;
  - one work item with watcher count greater than one.
- Preserve deterministic seed timestamps.
- Verify reset/migrate/seed from scratch.
- Update backend tests if seed assumptions changed.
- Confirm CI database prep still works with new migration and seed data.

Out of scope:

- Frontend implementation.
- Public site updates.

Acceptance criteria:

- Fresh local database shows useful inbox/watch/mention examples.
- Seed is deterministic.
- API tests pass after reset/migrate/seed.

Suggested commands:

```sh
npm run db:reset
npm run db:migrate
npm run db:seed
npm test --workspace @worktrail/api
npm run typecheck --workspace @worktrail/api
git diff --check
```

## Phase 7: Frontend API Clients And Inbox State

Goal: add frontend API access and app-shell unread count state before rendering the inbox page.

Scope:

- Add `apps/web/src/app/core/api/notifications-api.ts`.
- Add notification methods to `WorktrailApiService` only where needed for existing patterns.
- Add watcher methods to `work-items-api.ts`.
- Update comment API request typing for `mentionMemberIds`.
- Add `InboxStateService` or equivalent small service for:
  - unread count signal;
  - loading unread count;
  - refreshing on actor changes;
  - updating count after read mutations.
- Add focused web tests for API URL/method behavior and inbox state.

Out of scope:

- Inbox page UI.
- Navigation badge rendering.
- Work item detail controls.

Acceptance criteria:

- Web app compiles against new contracts.
- Unread-count service can refresh and expose count.
- Actor switch has a clear refresh path.

Suggested commands:

```sh
npm run typecheck --workspace @worktrail/web
npm test --workspace @worktrail/web -- --watch=false --include 'src/app/core/**/*.spec.ts'
npm test --workspace @worktrail/web -- --watch=false --include 'src/app/features/inbox/**/*.spec.ts'
git diff --check
```

## Phase 8: Inbox Route, Navigation Badge, And My Work Integration

Goal: add the primary user-facing inbox and connect unread state to navigation and My Work.

Scope:

- Add lazy `/inbox` route.
- Add `InboxPageComponent`.
- Add notification list/card components if helpful.
- Add unread/all views.
- Add single read/unread actions.
- Add mark-all-read action.
- Add empty/loading/error states.
- Add `Inbox` to primary navigation with unread badge.
- Refresh unread count on actor selection changes.
- Add compact Inbox summary/link to My Work.
- Add responsive styling for inbox cards.
- Add web tests for:
  - route registration;
  - badge rendering;
  - inbox unread/all switching;
  - read/unread actions;
  - mark all read;
  - My Work inbox summary.

Out of scope:

- Watch controls.
- Mention picker.
- E2E smoke.

Acceptance criteria:

- Current actor can view unread/all inbox notifications.
- Badge count is visible and updates after read-state mutations.
- My Work links to Inbox without duplicating the feed.
- Mobile inbox remains readable.

Suggested commands:

```sh
npm run typecheck --workspace @worktrail/web
npm test --workspace @worktrail/web -- --watch=false --include 'src/app/features/inbox/**/*.spec.ts'
npm test --workspace @worktrail/web -- --watch=false --include 'src/app/app*.spec.ts'
npm test --workspace @worktrail/web -- --watch=false --include 'src/app/features/my-work/**/*.spec.ts'
git diff --check
```

## Phase 9: Work Item Detail Watch And Mention UI

Goal: complete the collaboration loop on work item detail.

Scope:

- Add watch/unwatch control to work item detail.
- Display watcher count and compact watcher list/disclosure.
- Load watch state from detail DTO or watcher endpoint.
- Update state after watch/unwatch.
- Add comment mention picker/insert control.
- Track selected mentioned members separately from textarea body.
- Send `mentionMemberIds` when creating a comment.
- Render returned comment mentions readably.
- Add focused web tests for:
  - watch state rendering;
  - watch/unwatch actions;
  - mention picker member selection/removal;
  - create comment request including `mentionMemberIds`.

Out of scope:

- Rich text editor.
- Manual free-text mention parsing.
- Notification preferences.

Acceptance criteria:

- A user can watch/unwatch a work item from detail.
- A user can mention active members in a comment.
- Comment creation still works without mentions.
- Watch and mention UI works at common desktop/mobile widths.

Suggested commands:

```sh
npm run typecheck --workspace @worktrail/web
npm test --workspace @worktrail/web -- --watch=false --include 'src/app/features/work-items/*detail*.spec.ts'
npm test --workspace @worktrail/web -- --watch=false
git diff --check
```

## Phase 10: E2E Smoke And OpenAPI

Goal: cover the end-to-end collaboration workflow and document the API surface.

Scope:

- Update Playwright smoke test for:
  - seeded inbox unread count;
  - comment mention workflow;
  - actor switch to mentioned member;
  - unread inbox notification;
  - mark notification read;
  - optional watch/unwatch smoke if stable.
- Update `docs/api/openapi.yaml` for:
  - notification DTOs;
  - notification endpoints;
  - watcher endpoints;
  - updated comment request/response.
- Verify smoke tests reset, migrate, seed, and restore deterministic data.
- Keep Playwright out of required CI unless explicitly changed.

Out of scope:

- Public site.
- Release notes.
- Hosted deployment.

Acceptance criteria:

- E2E smoke covers the primary inbox/mention path.
- OpenAPI documents new and changed endpoints.
- Existing smoke flows still pass.

Suggested commands:

```sh
npm run test:e2e
npm run typecheck
npm test
git diff --check
```

## Phase 11: Documentation, Site, Release Notes, And Final Verification

Goal: finish v0.1.1 with complete docs, public site updates, and full verification.

Scope:

- Update `README.md` with:
  - Inbox;
  - watchers;
  - mentions;
  - in-app-only notification limitation.
- Add `docs/v0.1.1/jawstack-extraction-notes.md`.
- Add `docs/v0.1.1/release-notes.md`.
- Refresh `site/index.html` and `site/styles.css` as needed.
- Confirm GitHub Pages workflow remains compatible.
- Run full verification:
  - lint;
  - typecheck;
  - unit tests;
  - production build;
  - Playwright smoke.
- Confirm no generated artifacts are unintentionally included.
- Confirm repository status before handoff.

Out of scope:

- Creating the release tag unless explicitly requested.
- Publishing/deploying beyond existing workflows unless explicitly requested.

Acceptance criteria:

- README and public site describe the current product accurately.
- Extraction notes capture reusable notification/watch/mention patterns.
- Release notes summarize v0.1.1 capabilities and verification.
- Full verification passes or failures are documented with specific residual risk.
- Worktree status is understood.

Suggested commands:

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

## Verification Cadence

Use this cadence unless a phase requires broader checks:

- Schema/contract phases: contracts and API typecheck, migration apply.
- Backend-only phases: API typecheck and API tests.
- Frontend-only phases: web typecheck and focused web tests.
- Cross-stack phases: root typecheck and tests.
- Final phase: lint, typecheck, reset/migrate/seed, tests, build, and E2E.

Prefer focused checks while iterating, then broaden before closing each phase.

## Deferred Items

Defer these unless the user explicitly changes scope:

- email, Slack, webhook, browser push, or mobile push delivery;
- realtime updates and WebSockets;
- notification preferences;
- notification deletion/archive;
- project-level watching;
- workspace/team announcements;
- due-date reminder jobs;
- status-driven dependency-resolution notifications;
- rich-text mention editor;
- manual free-text mention parsing;
- generated API/client pipeline;
- cloud queue/event-bus infrastructure;
- mandatory E2E in CI.
