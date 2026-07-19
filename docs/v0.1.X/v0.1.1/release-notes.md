# Worktrail v0.1.1 Release Notes

## Summary

Worktrail v0.1.1 adds the app's first attention layer: an actor-scoped Inbox, persisted in-app notifications, work item watching, and deterministic comment mentions.

The release keeps delivery intentionally modest. Notifications are in-app only, synchronous, and backed by Postgres. There is no email, push delivery, WebSocket stream, queue, worker, or notification preference system yet.

## Product Highlights

- Added a top-level `Inbox` route with unread and all notification views.
- Added unread-count badges in primary navigation and a compact Inbox summary on My Work.
- Added read, unread, and mark-all-read notification actions.
- Added work item watch/unwatch controls on detail pages.
- Displayed watcher count and a compact watcher list on work item detail.
- Added automatic watching for reporters, assignees, and newly assigned members.
- Added a comment mention picker for active workspace members.
- Persisted comment mention metadata and rendered returned mentions as readable chips.
- Created notifications for assignments, mentions, watched comments, watched work changes, and dependency blocker changes.
- Seeded representative watchers, comment mentions, unread notifications, and read notifications for local evaluation.

## Technical Highlights

- Added notification, watcher, and comment-mention contract types.
- Added Postgres tables for `notifications`, `work_item_watchers`, and `comment_mentions`.
- Added repositories and services for notification persistence, watcher state, and mention metadata.
- Centralized notification fan-out with actor exclusion, inactive-member exclusion, recipient dedupe, and mention-over-watched-comment priority.
- Kept activity events and notifications separate:
  - activity records what happened;
  - notifications route relevant events to specific actors.
- Exposed notification endpoints for list, unread count, read-state update, and mark-all-read.
- Exposed watcher endpoints for get watch state, watch, and unwatch.
- Updated comment creation to accept optional `mentionMemberIds` while preserving body-only compatibility.
- Updated OpenAPI coverage for notifications, watchers, and comment mentions.
- Extended Playwright smoke coverage for the Inbox mention workflow and watch/unwatch behavior.

## Documentation And Site

- Updated the README around the v0.1.1 baseline.
- Added v0.1.1 jawstack extraction notes.
- Refreshed the static product site to include the Action Inbox, watchers, mentions, and in-app notification limitation.
- Updated the OpenAPI reference at `docs/api/openapi.yaml`.

## Verification

Final local verification for this release candidate:

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

The Playwright suite resets, migrates, seeds, and restores deterministic local Postgres data.

## Known Limitations

- Notifications are in-app only.
- Notification preferences, digests, deletion/archive controls, and background delivery are deferred.
- Comment mentions use an active-member picker; rich text and free-text `@name` parsing are deferred.
- Watchers are scoped to work items only; project-level and workspace-level watching are deferred.
- Status-driven dependency-resolution notifications are deferred.
- Authentication remains local actor selection and request-header scaffolding.
- The local Express adapter remains the only runtime adapter.
