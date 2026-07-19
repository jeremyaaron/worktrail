# Worktrail v0.1.1 Jawstack Extraction Notes

## Purpose

v0.1.1 adds an attention model to Worktrail: actor-scoped notifications, work item watching, comment mentions, unread state, and deep links back into work.

These notes capture patterns worth remembering for jawstack. They are observations from a concrete product slice, not framework commitments.

## Activity Versus Attention

Worktrail keeps activity and notifications separate.

Activity answers:

- what happened;
- who did it;
- when it happened;
- how the domain object changed.

Notifications answer:

- who needs to know;
- whether they have read it;
- where they should go next;
- which event type should be rendered to that actor.

Extraction signal:

- Do not overload audit/activity logs with user-specific read state.
- Treat notifications as attention records, not as the canonical history of the domain.
- Keep enough render metadata on the notification so the UI does not parse human summary text.

## Synchronous Fan-Out Before Queues

This release creates notification records inside the same command path as work item, comment, and relationship mutations.

That is the right fit for the current local app:

- tests stay deterministic;
- mutations and notifications commit together;
- no delivery infrastructure is required;
- failure behavior is obvious.

Extraction signal:

- A synchronous notification service is a good first abstraction for reference apps.
- Queue, worker, and retry abstractions should wait until there is real asynchronous delivery pressure.
- Keep the service boundary shaped so a future outbox or queue producer can replace direct inserts without rewriting domain services.

## Recipient Filtering

Notification creation applies shared recipient rules:

- exclude the actor who caused the change;
- exclude inactive members;
- dedupe recipients;
- choose one notification type per recipient per command when multiple reasons apply.

The most concrete priority rule in v0.1.1 is that an explicit mention wins over a watched-comment notification for the same recipient.

Extraction signal:

- Recipient filtering is cross-cutting enough to deserve one service boundary.
- Domain services should decide why a notification exists.
- Notification services should decide who actually receives it and prevent noisy duplicates.

## Watchers As Subscriptions

Work item watching is modeled as a subscription:

- an active row means the member is watching;
- unwatching sets `unwatchedAt`;
- retained rows preserve history;
- a partial unique index allows only one active watcher per work item/member.

Extraction signal:

- Subscription-style state benefits from retained rows when auditability matters.
- The active subscription predicate should be explicit and index-backed.
- Watcher lookup should return active member IDs, not raw subscription rows, when used for fan-out.

## Explicit Mentions

Mentions use a member picker and `mentionMemberIds`.

The app intentionally does not parse free text. Comment body remains plain text, while mention metadata is persisted separately and returned on comment DTOs.

Extraction signal:

- Explicit mention IDs are safer than display-name parsing in early product slices.
- Free-text parsing should wait until the UX needs rich text or autocomplete.
- Persisted mention metadata makes notification fan-out and comment rendering deterministic.

## Actor-Scoped Reads

Notification list, count, and read-state mutations are scoped to the selected actor.

The API rejects attempts to update notifications outside the current actor's workspace/member scope. Owners and maintainers do not automatically see every notification.

Extraction signal:

- Actor-scoped resources should enforce ownership in repositories or services, not only in UI filters.
- Elevated roles should not bypass personal-resource boundaries unless the product explicitly requires administration of those records.
- Tests should include cross-actor isolation for read-state mutations.

## Frontend State Shape

The frontend has a small `InboxStateService` for unread count state. The Inbox page owns full notification lists and mutating-card state.

That keeps the navigation badge and My Work summary synchronized without turning notifications into a broad client cache.

Extraction signal:

- Shared state should match the shared product surface.
- A badge count is global enough for a small service.
- The full list view can remain page-local until multiple surfaces need the same collection.

## Deep Links And Return Context

Notifications link to relevant work items and preserve Inbox return context.

Extraction signal:

- Attention records are only useful if they close the loop.
- Notification DTOs should include enough compact target references to render useful cards and links without another request.
- Return context matters when moving from inbox triage into detailed work.

## Deferred Extraction Pressure

The release deliberately avoids:

- email or push delivery;
- WebSockets;
- background jobs;
- notification preferences;
- notification deletion/archive;
- project-level watching;
- rich text mentions;
- free-text mention parsing.

Extraction signal:

- The durable pattern is not "notifications"; it is "domain event to actor-scoped attention record."
- Delivery adapters, preference policies, and realtime transports should be extracted only after more than one app demonstrates matching needs.
