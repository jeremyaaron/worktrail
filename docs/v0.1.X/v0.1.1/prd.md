# Worktrail v0.1.1 PRD

## Summary

Worktrail v0.1.1 should add an Action Inbox: a lightweight in-app notification and watching workflow that helps team members see changes that need their attention.

The v0.1.0 baseline made Worktrail easier to navigate and scan. The next useful product step is not another reporting surface. It is a tighter collaboration loop. Worktrail already has comments, assignment, relationships, dependency signals, activity, My Work, and local actor context, but users still have to poll pages to discover important changes.

v0.1.1 should make important work changes find the right person inside the app while keeping the implementation local-first and production-shaped.

## Context

Worktrail now supports credible daily project execution:

- contributors can review My Work;
- maintainers can discover work across projects;
- project owners can review planning and delivery health;
- teams can comment, edit, relate work, and inspect activity;
- CI, docs, OpenAPI, and local Postgres workflows are in place.

What is missing is an attention model. If Avery is assigned a work item, mentioned in a comment, or watching a blocker, the app has enough data to know that Avery should see the change. Today that signal remains spread across work item detail pages, activity logs, and filtered lists.

The first version of this attention model should be deliberately modest: in-app only, deterministic, backed by Postgres, and easy to test. It should establish the product and architectural pattern without jumping to email, push notifications, WebSockets, background jobs, hosted auth, or user preference complexity.

## Problem

Users can update work in Worktrail, but the app does not actively route important updates to affected people.

This creates several product gaps:

- assignees may not notice they were assigned new work;
- contributors may not see comments addressed to them;
- project owners may miss updates on work they are tracking;
- blocker changes require users to revisit planning or detail pages;
- activity history exists, but it is not personalized by relevance;
- My Work shows assigned work, but not all collaboration events that require attention.

For a reference app, this also leaves a common enterprise application pattern underdeveloped: converting domain events into user-specific notifications while preserving clear service boundaries and local-first operability.

## Goals

- Add a top-level Action Inbox for user-specific in-app notifications.
- Notify members when assignment, mention, comment, watcher, and dependency-related events need their attention.
- Add work item watching so users can intentionally follow work they do not own.
- Auto-watch the reporter and current assignee for a work item.
- Support simple comment mentions of active workspace members.
- Make notification read/unread state explicit and easy to manage.
- Preserve deep links back into the relevant work item and workflow context.
- Keep notification creation synchronous and deterministic for the local MVP.
- Establish reusable backend notification patterns that can later map to queues, email, WebSockets, or hosted delivery systems.

## Non-Goals

- Do not add email, Slack, webhook, browser push, or mobile push delivery.
- Do not add realtime updates or WebSockets.
- Do not add hosted authentication, account settings, or notification preference management.
- Do not add cross-workspace notification behavior.
- Do not add background workers, queues, or scheduled notification jobs.
- Do not build a full mention-rich text editor.
- Do not make activity events and notifications the same table if separate ownership is clearer.
- Do not require Playwright E2E in CI.

## Target Users

### Project Contributor

Needs a focused place to see assignments, mentions, relevant comments, and blocker updates without checking every project page.

### Project Owner

Needs to follow high-risk work, see important updates quickly, and avoid losing context across project planning and work item detail pages.

### Workspace Maintainer

Needs a reference implementation for personal notifications, watcher subscriptions, read state, and domain-event fan-out.

### Reference-App Developer

Needs a production-shaped pattern for turning domain service events into persisted user-facing notifications while preserving testability and future cloud deployment options.

## Product Principles

- **Attention is personal:** notifications should answer "what changed that matters to me?"
- **Inbox is not activity:** activity records what happened; notifications route relevant events to recipients.
- **No duplicate noise:** one domain action should not create several visible notifications for the same recipient.
- **Respect local actors:** notifications should never be sent to inactive members or to the member who performed the action.
- **Deep links matter:** every actionable notification should lead to the relevant work item or project context.
- **Start synchronous:** use direct service-layer writes now, but keep the shape compatible with future event queues.

## Scope

### 1. Action Inbox

Add a top-level in-app inbox for the current actor.

Requirements:

- Add `Inbox` or `Action Inbox` to primary navigation.
- Show an unread count badge in primary navigation when the selected actor has unread notifications.
- Provide inbox views for:
  - unread notifications;
  - all notifications.
- Render each notification with:
  - reason/type;
  - summary;
  - actor who caused the event when available;
  - project name and work item display key when applicable;
  - timestamp;
  - read/unread state;
  - link to the relevant work item or project page.
- Support marking a single notification read.
- Support marking a single notification unread.
- Support marking all current unread notifications read.
- Keep empty states compact and action-oriented.
- Refresh unread counts after read-state mutations and actor changes.

Acceptance criteria:

- A user can open the inbox and identify unread work updates addressed to them.
- A user can clear unread notifications without deleting history.
- Switching the local actor changes the inbox and badge to that actor's notifications.

### 2. Notification Reasons

Create persisted notifications for the first useful set of collaboration events.

Requirements:

- Notify a member when a work item is assigned to them.
- Notify mentioned members when a new comment mentions them.
- Notify watchers when a new comment is added to watched work.
- Notify watchers when a watched work item's status changes.
- Notify watchers when a watched work item's assignee changes.
- Notify watchers when a blocking relationship is added or removed on watched work.
- Notify the downstream assignee and watchers when an upstream open blocker is added or removed.
- Avoid notifying the actor who performed the action.
- Avoid duplicate notifications for the same member from one domain action.
- Do not notify inactive members.
- Preserve enough metadata to render and deep-link notifications without parsing summary strings.

Acceptance criteria:

- Assignment, mention, comment, status, assignee, and blocker relationship changes create deterministic notifications for expected recipients.
- A recipient receives at most one notification per triggering action.
- Notification records can be tested without relying on UI behavior.

### 3. Work Item Watching

Add explicit work item watching so users can follow work that is not assigned to them.

Requirements:

- Add a watch/unwatch control on the work item detail page.
- Show the current actor's watch state.
- Show a compact watcher count.
- Show a compact watcher list where space allows.
- Auto-watch the reporter when a work item is created.
- Auto-watch the assignee when a work item is created with an assignee.
- Auto-watch a newly assigned member when assignment changes.
- Preserve watchers when work item status changes.
- Do not allow inactive members to become watchers.
- Do not remove historical watcher rows unless a user explicitly unwatches.

Acceptance criteria:

- A contributor can watch a work item and later receive comment/status/dependency notifications for it.
- Reporter and assignee notification behavior works without requiring manual watching.
- Watch/unwatch is reflected immediately in the work item detail page.

### 4. Comment Mentions

Support simple member mentions in comments.

Requirements:

- Resolve mentions against active members in the same workspace.
- Use a deterministic mention format, with final syntax decided in technical design.
- Avoid ambiguous matching where two active members could resolve to the same mention token.
- Render comment text readably after mentions are saved.
- Provide lightweight UI assistance:
  - visible member mention help;
  - suggestion list;
  - or member insert controls.
- Store mention metadata with the comment or associated notification metadata so later rendering does not depend only on free-text parsing.
- Notify mentioned members when the comment is created.
- Do not notify the comment author for mentioning themselves.

Acceptance criteria:

- A user can mention another active workspace member in a comment.
- The mentioned member sees an unread inbox notification linking to the work item.
- Ambiguous or inactive-member mention cases are handled predictably.

### 5. My Work Integration

Connect the Action Inbox to the existing daily workflow without overloading My Work.

Requirements:

- Add an inbox summary or unread notification link near the My Work daily queue.
- Do not duplicate the full inbox inside My Work.
- Keep My Work focused on assigned work and execution state.
- Provide a clear path from My Work to the Action Inbox when notifications need attention.

Acceptance criteria:

- A contributor who starts from My Work can see whether collaboration updates are waiting.
- My Work remains scannable and does not become another activity feed.

### 6. Backend And Data Model

Persist notifications and watchers with clear domain ownership.

Requirements:

- Add database tables for:
  - work item watchers;
  - user notifications.
- Use migrations rather than ad hoc schema setup.
- Add contract types for notification DTOs and watch state.
- Add repositories for watcher and notification persistence.
- Add services for:
  - listing current actor notifications;
  - updating notification read state;
  - watching/unwatching work items;
  - creating notifications from domain actions.
- Keep endpoint handlers transport-neutral.
- Expose REST routes through the local Express adapter.
- Use transactions where a domain mutation and notification fan-out must commit together.
- Seed representative notification and watcher examples.

Acceptance criteria:

- Fresh checkout migration and seed produce deterministic watcher and notification examples.
- API tests cover watcher state, notification creation, read-state mutations, and actor isolation.
- Existing work item mutations continue to pass current tests.

### 7. Frontend Experience

Implement the inbox and watch controls in Angular using existing app patterns.

Requirements:

- Add an inbox route and lazy-loaded page component.
- Add a domain API client for notifications/watchers or extend the existing work item client if that is cleaner.
- Add badge state to app-level navigation without introducing global state framework complexity.
- Add watch controls to work item detail.
- Add mention assistance to the comment form.
- Reuse existing loading, error, empty-state, member-display, and work-item-display helpers.
- Keep mobile rendering usable for the inbox and watcher controls.

Acceptance criteria:

- Inbox, unread badge, read actions, watch/unwatch, and mentions work across desktop and mobile widths.
- Frontend tests cover badge/inbox behavior and watch/mention controls at a focused component level.

### 8. Documentation, Site, And Reference Value

Document the new collaboration loop and update the public face of the app.

Requirements:

- Update `README.md` with v0.1.1 capabilities and local verification notes.
- Update OpenAPI for notification and watcher endpoints.
- Add v0.1.1 jawstack extraction notes focused on:
  - domain-event fan-out;
  - notification persistence;
  - actor-scoped read models;
  - synchronous local implementation with future queue compatibility.
- Refresh the public site to mention the Action Inbox and notification pattern.
- Update release notes during finalization.

Acceptance criteria:

- Docs describe the feature from both product and reference-architecture perspectives.
- API documentation reflects all new routes and DTOs.
- Public site copy remains concise and does not become a release changelog.

## Suggested Notification Types

The technical design may refine names, but the product should support these concepts:

- `assignment`;
- `mention`;
- `watched_comment`;
- `watched_status_change`;
- `watched_assignee_change`;
- `watched_relationship_change`;
- `dependency_blocker_added`;
- `dependency_blocker_removed`.

## Permissions And Actor Rules

Initial rules:

- Any active member who can view a work item can watch or unwatch it.
- Any active member can read and update only their own notifications.
- Owners and maintainers do not automatically see every notification.
- Inactive members do not receive new notifications.
- Existing role rules for creating comments, editing work items, and changing relationships remain unchanged.

## Data And Retention

Initial rules:

- Notifications are retained until explicitly deleted by a future release.
- v0.1.1 does not need delete/archive notification controls.
- Read notifications remain visible in the `All` view.
- Watcher rows may remain as historical records if that simplifies auditability, but only active watch subscriptions should receive new notifications.

## Success Metrics

Because this is still local-first, success will be evaluated through functional and qualitative checks:

- Seeded data demonstrates unread inbox state for multiple actors.
- Common collaboration actions create expected notifications in API tests.
- A manual walkthrough can assign work, mention a member, watch work, change a blocker, and observe the correct inbox updates.
- No existing v0.1.0 core flow regresses in unit or smoke tests.

## Risks

- Notification fan-out can create noisy or duplicate results if recipient selection is not centralized.
- Mention parsing can become brittle if it tries to behave like a full rich-text editor.
- Badge state can drift if read mutations and actor switching are not handled consistently.
- Notification logic can leak into unrelated services unless a clear notification service boundary is maintained.
- Tests may become order-dependent if seeded notification timestamps are not deterministic.

## Open Decisions

The technical design should resolve these:

- Final primary navigation label: `Inbox`, `Action Inbox`, or `Updates`.
- Mention syntax:
  - display-name mentions such as `@Avery Owner`;
  - email-local-part mentions such as `@avery`;
  - or an insert-control syntax that stores member IDs while rendering names.
- Whether notification records reference activity event IDs directly, store their own metadata only, or support both.
- Whether watcher subscriptions use hard delete on unwatch or a retained row with `unwatchedAt`.
- Whether unread counts are loaded through a dedicated lightweight endpoint or included in the list response.
- Whether dependency notifications fire only for relationship changes in v0.1.1 or also for status changes that make an upstream blocker terminal/open again.

## Out Of Scope For Later Releases

- Email/push delivery;
- notification preferences;
- digest notifications;
- user profile settings;
- realtime transport;
- notification deletion/archive;
- project-level watching;
- team-level broadcasts;
- scheduled due-date reminders;
- external integrations;
- cloud queue/event-bus infrastructure.
