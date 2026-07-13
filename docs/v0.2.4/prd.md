# Worktrail v0.2.4 PRD

## Status

Implemented

## Summary

Worktrail v0.2.4 should add Cycle Closeout and Carryover.

Cycle Planning gives teams a clear execution window: maintainers can create cycles, commit work, review progress and risk, filter by cycle, bulk-triage scope, and publish status reports with active-cycle context. The lifecycle is incomplete, however. When an active cycle ends, a maintainer can mark it completed, but Worktrail does not help answer the operational questions that come with that decision:

- What did the team finish?
- What remains unfinished?
- Which unfinished items should move into the next cycle?
- Which items should return to the backlog?
- What was the cycle's actual state when it closed?
- Can another maintainer understand the closeout later without reconstructing history from current work?

Today those decisions require several disconnected edits. Moving unfinished work also changes the live contents of the completed cycle, so its review no longer represents the scope that existed at closeout.

The product theme is Complete the Cycle. v0.2.4 should introduce a guided closeout workflow that previews the outcome, lets an owner or maintainer choose a destination for unfinished work, completes the cycle and carries work forward as one coherent operation, and preserves an immutable closeout summary for later review.

This is a focused extension of the existing cycle model. It should not become a velocity, forecasting, retrospective, or automation release.

## Context

Worktrail currently supports:

- project cycles with `planned`, `active`, `completed`, and `canceled` states;
- one active cycle per project;
- cycle goals, date ranges, and optional target points;
- work item cycle assignment through create, edit, and project bulk triage;
- cycle filters across project Work and workspace Work Items;
- cycle-backed saved views, pinned views, copy links, return URLs, and CSV exports;
- Planning summaries for active, upcoming, and recently completed cycles;
- cycle review with progress, estimates, health, risk sections, and recent movement;
- active-cycle snapshots in published project status reports;
- work item activity when cycle assignment changes;
- owner/maintainer cycle mutation and contributor read access;
- archived-project read-only behavior;
- deterministic active, planned, completed, and at-risk seeded cycle examples.

The current cycle status editor can represent that a cycle is completed, but completion is only a field update. It does not coordinate unfinished scope or retain the cycle's closing state.

## Problem

Worktrail can start and operate a cycle, but cannot finish one cleanly.

Current friction:

- maintainers must identify unfinished cycle work manually;
- moving unfinished work requires repeated item edits or a separate filtered bulk-edit workflow;
- there is no guided choice between carrying work forward and returning it to the backlog;
- completing a cycle and reassigning its work are separate operations that can leave partial or contradictory state;
- moving unfinished work out of a completed cycle changes what cycle review shows later;
- target versus completed points at closeout are not preserved;
- another maintainer cannot tell whether remaining work was intentionally deferred or simply overlooked;
- users can complete a cycle without understanding how many items will remain attached to it;
- the product has no clear end-of-cycle operating ritual despite having the underlying planning data.

This gap limits everyday utility. Timeboxed planning is most useful when commitment, execution, and closeout form one dependable loop.

It also creates a useful reference-app opportunity: a previewed, transactional domain command that coordinates a lifecycle transition, related-record mutations, immutable evidence, activity, and a role-aware Angular workflow while preserving transport-neutral endpoint handlers.

## Goals

- Add a guided closeout workflow for active project cycles.
- Preview closeout effects before any state changes are made.
- Clearly separate completed work from unfinished work.
- Let maintainers move unfinished work to one planned cycle or return it to no cycle.
- Complete the cycle and apply carryover as one coherent operation.
- Preserve an immutable closeout summary representing the cycle at completion time.
- Keep completed and canceled work attached to the closing cycle.
- Preserve work item status, milestone, assignee, labels, estimate, and due date during carryover.
- Record understandable cycle and work item activity for real changes.
- Keep contributor and archived-project paths read-only.
- Integrate closeout results into Planning and Cycle Review without adding a new top-level surface.
- Seed and test a realistic closeout walkthrough.
- Keep local setup straightforward and endpoint boundaries suitable for future cloud adapters.

## Non-Goals

- Do not add velocity charts, throughput trends, burndown, burnup, or cumulative-flow charts.
- Do not add forecasting, capacity calendars, or commitment recommendations.
- Do not add recurring or automatically generated cycles.
- Do not add scheduled or date-triggered automatic closeout.
- Do not automatically transition work item workflow status during closeout.
- Do not automatically alter due dates, milestones, assignees, labels, priorities, or estimates.
- Do not split unfinished work across multiple destination cycles in one closeout.
- Do not add retrospective notes, votes, action items, approvals, or sign-off workflows.
- Do not add cycle-specific comments, watchers, subscriptions, or notification preferences.
- Do not add reopen/undo as a casual UI action unless technical design proves it can preserve history safely.
- Do not add cross-project cycle closeout.
- Do not add portfolio-level cycle mutation.
- Do not add a general workflow engine, command framework, or snapshot framework.
- Do not add production authentication, background workers, queues, or deployment automation.

## Target Users

### Project Maintainer

Needs to end the current execution window, understand unfinished commitments, carry selected scope forward consistently, and leave an accurate record for the team.

### Workspace Owner

Needs project cycle history to be credible and wants closeout decisions to be deliberate rather than a collection of unrelated edits.

### Contributor

Needs to understand what the completed cycle delivered, what moved forward, and where unfinished assigned work now lives without receiving cycle-management controls.

### Reference-App Developer

Needs an example of a preview-and-apply workflow that spans derived state, transactional writes, immutable evidence, activity side effects, API contracts, Angular interaction, and failure recovery without premature platform abstraction.

## Product Principles

- **Preview before commitment:** closing a cycle changes both lifecycle and work assignment, so users should see the result first.
- **One closeout, one outcome:** cycle completion and carryover should not leave partially applied state.
- **History should stay truthful:** completed-cycle review should describe the state at closeout even after unfinished work moves elsewhere.
- **Carryover is not completion:** moving work forward must not change its workflow status.
- **Current work stays current:** carried items should continue to behave like normal work in the destination cycle or backlog.
- **Preserve existing ownership:** closeout should reuse cycle permissions, project writability, work activity, and query behavior.
- **Make the common decision simple:** one destination for all unfinished work keeps the first workflow understandable and recoverable.
- **Evidence before analytics:** capture a useful closeout record now; derive trends only after multiple snapshots prove the need.
- **No forced cadence:** projects that do not use cycles remain unaffected.

## Scope

### 1. Closeout Eligibility And Entry Point

Add a clear closeout action for an active cycle.

Requirements:

- Show `Close cycle` to owners and maintainers on an active, non-archived project's cycle review page.
- The action should also be reachable from the cycle management area in Planning when that can be done without duplicating the workflow.
- Contributors must not see mutation controls.
- Archived projects must not allow closeout.
- Planned, completed, canceled, and archived cycles must not be closeable through this workflow.
- Keep ordinary editing of planned-cycle metadata available under existing rules.
- Distinguish `Close cycle` from `Cancel cycle`; cancellation remains a separate lifecycle outcome and must not create a successful closeout summary.

Acceptance criteria:

- An owner or maintainer can identify how to close the active cycle from the normal review workflow.
- A contributor can review the same cycle without seeing the action.
- Invalid direct-route or API attempts return the established structured errors.
- The UI does not imply that canceling and completing are equivalent.

### 2. Closeout Preview

Show a fresh preview before applying closeout.

Requirements:

- Derive the preview from current cycle and work item state.
- Show cycle identity, goal, date range, target points, and current health.
- Show closing scope totals:
  - total scoped items;
  - completed items;
  - canceled items;
  - unfinished items;
  - committed estimate points;
  - completed estimate points;
  - unfinished estimate points;
  - unestimated unfinished items.
- Show unfinished work grouped or ordered for quick scanning, including:
  - display key and title;
  - current status;
  - priority;
  - assignee;
  - estimate points;
  - dependency-blocked signal where available.
- Define unfinished work as non-terminal work. For the current workflow, `done` and `canceled` are terminal.
- Show eligible destination choices:
  - one non-archived planned cycle in the same project;
  - `No cycle (return to backlog)`.
- Exclude active, completed, canceled, archived, cross-project, and cross-workspace cycles from destination choices.
- If no planned destination exists, the no-cycle option must remain available.
- Loading the preview must not mutate cycle or work item state.
- Refresh or revalidate the preview when the user applies closeout so stale browser state cannot silently determine the result.

Acceptance criteria:

- A maintainer can understand exactly how much work finished and how much will move.
- Destination choices are valid for the current project only.
- A cycle with no unfinished work can still be closed without requiring a destination.
- Preview totals use the same estimate and terminal-status semantics as Cycle Review.
- Opening and abandoning preview causes no writes.

### 3. Carryover Decision

Let the maintainer decide where unfinished work goes.

Requirements:

- Apply one destination to all unfinished work in the first release.
- Destination options:
  - a selected planned cycle;
  - no cycle.
- Keep `No cycle` wording explicit that this clears cycle assignment; it does not change work status to the `backlog` workflow state.
- Show the number of affected items beside the decision.
- Require a deliberate confirmation before applying closeout.
- When there is no unfinished work, present closeout as a simple completion confirmation.
- Do not require a narrative or retrospective note.

Acceptance criteria:

- A maintainer cannot confuse clearing cycle assignment with changing workflow status.
- A maintainer can move all unfinished items into the next planned cycle with one command.
- A maintainer can return all unfinished items to unplanned work with one command.
- Finished and canceled items are not included in carryover.

### 4. Atomic Closeout Command

Complete the cycle and apply carryover as one coherent operation.

Requirements:

- Revalidate at command time:
  - actor membership and role;
  - active project state;
  - active cycle state;
  - cycle/project/workspace ownership;
  - destination eligibility;
  - current unfinished scope.
- In one transaction:
  - capture the immutable closeout summary;
  - mark the source cycle completed;
  - move unfinished work to the chosen destination or clear its cycle assignment;
  - record required cycle/project/work item activity.
- Do not partially complete the cycle if any required write fails.
- Do not modify completed or canceled work item cycle assignment.
- Do not modify work item workflow status.
- Preserve all unrelated work item fields.
- Return a structured result that includes:
  - completed cycle;
  - closeout summary;
  - moved item count;
  - retained item count;
  - destination summary.
- Protect against duplicate application. Repeating the same request after success must not create another closeout record or repeat activity.
- Reject closeout when the source cycle changed out of active state before command execution.

Acceptance criteria:

- Successful closeout leaves the source cycle completed and every unfinished item at the chosen destination.
- Failed closeout leaves cycle state, cycle assignments, closeout records, and activity unchanged.
- A duplicate submission cannot close or move work twice.
- Existing one-active-cycle constraints remain valid after closeout.

### 5. Immutable Closeout Summary

Preserve what the cycle looked like when it closed.

Requirements:

- Store one immutable closeout summary for each successfully closed cycle.
- Preserve at least:
  - snapshot version;
  - source cycle identity, goal, dates, target points, and status at closeout;
  - project identity;
  - closed timestamp and closing actor;
  - scope and estimate totals;
  - completed and canceled item summaries;
  - unfinished item summaries;
  - destination decision;
  - moved and retained counts;
  - health state and top health reasons at closeout where existing semantics can be reused safely.
- Snapshot item summaries should contain enough identity and state to explain the closeout without pretending to be live work item records.
- Links from snapshot items may open current work item detail, but the UI must label snapshot values as historical.
- Validate persisted snapshot data at runtime before returning it through API responses.
- Existing completed cycles without a closeout summary remain readable and show honest legacy absence copy.
- Do not permit post-closeout editing of the summary.

Acceptance criteria:

- Moving carried work does not erase the completed cycle's closing scope.
- A user can distinguish snapshot values from current linked work item state.
- Existing seeded completed cycles continue to load without fabricated closeout data.
- Corrupt or unsupported snapshot data fails through a controlled application error rather than unsafe rendering.

### 6. Completed Cycle Review

Make Cycle Review useful after closeout.

Requirements:

- For a cycle with a closeout summary, lead with a clear completed-cycle result section.
- Show:
  - closed date and actor;
  - target, committed, and completed points;
  - completed, canceled, and carried item counts;
  - destination cycle or no-cycle outcome;
  - closing health/reasons where captured.
- Keep snapshot framing explicit.
- Provide links to:
  - current detail for snapshotted work items;
  - the destination cycle review when a destination cycle was selected;
  - current project Work filtered to the destination cycle where useful.
- Do not replace the live review behavior for planned or active cycles.
- Completed legacy cycles without closeout summaries should retain the current live-derived review with a concise note that no closeout snapshot exists.
- Keep the page useful on mobile and avoid rendering every item when a bounded summary plus drill-down is clearer.

Acceptance criteria:

- A user opening a closed cycle can understand its outcome without reconstructing current assignments.
- Snapshot and live links are visibly distinct.
- Destination links use existing canonical cycle query behavior.
- Active-cycle review does not regress.

### 7. Planning Integration

Reflect closeout in the existing project planning workflow.

Requirements:

- Show the most recently closed cycle and its closeout outcome in the existing recent-cycle area.
- Show the destination planned cycle and carried count when applicable.
- After successful closeout, return the user to a stable completed-cycle result or Planning state with visible confirmation.
- Refresh Planning cycle summaries after closeout without requiring a full browser reload.
- A selected planned destination remains planned; closeout must not activate it automatically.
- Do not add historical trend charts or a separate cycle history page in this release.

Acceptance criteria:

- Planning immediately reflects that the source cycle is complete.
- Carried work appears in the selected destination cycle's current scope.
- The user receives visible confirmation of the result.
- The destination cycle is not silently activated.

### 8. Activity And Notification Behavior

Record closeout without creating avoidable noise.

Requirements:

- Record one project-level or cycle-level closeout activity event with a concise summary.
- Record normal work item cycle-change activity for each item whose cycle assignment changes.
- Do not record work item activity for retained completed/canceled items.
- Reuse existing watcher notification policy for real cycle-assignment changes if cycle changes already notify watchers.
- Avoid a second notification solely because the source cycle itself was completed.
- Do not add cycle-level subscriptions, reminders, or broadcast notifications.
- Activity metadata should retain identifiers and structured previous/next values where current conventions support them.

Acceptance criteria:

- Carried work item histories explain the previous and next cycle.
- Unchanged items do not receive activity churn.
- One closeout does not create duplicate recipient notifications for the same work item change.
- The cycle/project activity record identifies who closed the cycle and where unfinished work went.

### 9. API, Contracts, And Documentation Surface

Expose closeout through production-shaped boundaries.

Requirements:

- Add shared contract types for:
  - closeout preview;
  - destination choice;
  - closeout command;
  - closeout result;
  - versioned closeout snapshot/read model.
- Keep endpoint handlers transport-neutral.
- Expose the workflow through the Express adapter and document it in OpenAPI.
- Keep preview read-only and closeout mutation explicit.
- Use structured validation and error responses consistent with existing routes.
- Avoid frontend fan-out that attempts to reconstruct closeout rules independently.
- Keep the command bounded for predictable local and future Lambda-style execution.

Acceptance criteria:

- API consumers can preview and apply closeout without parsing UI state.
- OpenAPI describes request, result, authorization, and conflict behavior.
- The Angular app consumes shared DTOs rather than duplicate closeout models.
- Route inventory and endpoint tests cover all new routes.

### 10. Seed Data And Walkthrough

Provide a deterministic closeout example.

Requirements:

- Preserve the existing active-cycle walkthrough used by earlier tests.
- Add or adapt the smallest seed scenario needed to demonstrate:
  - an active source cycle;
  - a planned destination cycle;
  - completed work;
  - canceled work;
  - unfinished estimated work;
  - unfinished unestimated work;
  - at least one dependency-blocked unfinished item.
- If a pre-closed snapshot is seeded, keep it separate from the cycle intended for interactive closeout.
- Update README walkthrough instructions.
- Add focused browser coverage for preview, destination selection, confirmation, and result review without making unrelated smoke tests order-dependent.

Acceptance criteria:

- A fresh local database supports a meaningful closeout walkthrough.
- Seed state remains deterministic.
- Browser tests can close a dedicated cycle without breaking Portfolio, Planning, report, or work-list tests.

### 11. Release Documentation And Pattern Notes

Document the implemented behavior and reusable lessons.

Requirements:

- Update README current baseline and limitations.
- Add v0.2.4 release notes during finalization.
- Add v0.2.4 pattern notes during finalization.
- Update the static product site if closeout materially improves the public cycle-planning story.
- Capture destination-neutral observations around:
  - preview-and-apply commands;
  - atomic lifecycle transitions with related-record updates;
  - immutable evidence beside live entities;
  - idempotency and stale-preview handling;
  - bounded activity fan-out.
- Do not reference a presumed extraction destination.

Acceptance criteria:

- Documentation explains closeout, carryover, and snapshot semantics accurately.
- Public copy does not imply velocity analytics, forecasting, automation, or retrospective tooling.
- Deferred scope remains explicit.

## User Stories

### Maintainer Closes A Cycle Into The Next Cycle

As a project maintainer, I review the current cycle's result, move unfinished work into a planned cycle, and complete the source cycle in one operation.

Acceptance criteria:

- Preview shows finished and unfinished scope.
- The planned destination is selectable.
- Confirmation completes the source cycle and moves all unfinished work.
- The destination remains planned.
- The result shows what moved.

### Maintainer Returns Unfinished Work To Unplanned Scope

As a project maintainer, I close a cycle without committing its unfinished work to another cycle so the team can re-triage it.

Acceptance criteria:

- `No cycle` is an explicit destination choice.
- Unfinished items have cycle assignment cleared.
- Their workflow statuses and other fields do not change.
- The closeout summary records the decision.

### Contributor Reviews A Completed Cycle

As a contributor, I open a completed cycle and understand what was delivered and what carried forward without needing mutation access.

Acceptance criteria:

- Completed-cycle review shows immutable closing results.
- Current work item and destination-cycle links remain available.
- Snapshot framing prevents confusion with current work state.

### Maintainer Closes An Already-Finished Cycle

As a project maintainer, I close a cycle with no unfinished work through a concise confirmation flow.

Acceptance criteria:

- No destination is required.
- The cycle completes and a closeout summary is stored.
- No work item cycle assignments or activities are changed.

### Developer Handles Concurrent Change Safely

As a developer, I can rely on closeout validation and transaction boundaries when work changes after preview but before confirmation.

Acceptance criteria:

- The command re-derives current scope.
- Invalid destination or lifecycle changes reject cleanly.
- The result reflects command-time state.
- No partial closeout is committed.

## UX Requirements

- Keep closeout inside Cycle Review/Planning rather than creating a top-level destination.
- Use a focused dialog or dedicated route based on content fit; do not compress a detailed scope review into a cramped modal.
- Make the destructive/irreversible nature of closeout clear without using alarmist copy.
- Show outcome totals before the confirmation control.
- Keep destination selection near the unfinished-work summary.
- Explain `No cycle` in plain language.
- Disable repeat submission while closeout is in progress.
- On success, show a durable result state rather than only a transient toast.
- On conflict, explain that cycle or work state changed and offer a refreshed preview.
- Long cycle names, work titles, member names, and destination labels must wrap without overlap.
- Mobile should preserve preview totals, destination choice, and confirmation order without horizontal scrolling.
- Do not expose raw snapshot JSON, internal event names, or implementation terminology.

## Accessibility Requirements

- Closeout controls must be keyboard reachable and have clear accessible names.
- Preview metrics and status distinctions must not rely on color alone.
- Destination choices should use a native select, radio group, or equivalent accessible single-choice control.
- Confirmation should identify the cycle and number of affected work items.
- Loading, validation, conflict, success, and error states should be announced appropriately.
- Unfinished-work rows should use meaningful headings or table semantics.
- Focus should move predictably when preview loads, closeout fails, or closeout succeeds.

## Permissions And Lifecycle Rules

- Owners and maintainers may close an active cycle on an active project.
- Contributors may read previews only if the product needs shareable preview routes; otherwise they read ordinary Cycle Review and completed closeout results.
- Contributors cannot apply closeout.
- Archived projects cannot close cycles or move work.
- Only active, non-archived cycles may be closed.
- Carryover destinations must be planned, non-archived cycles in the same project and workspace.
- Closeout marks the source cycle `completed`, never `canceled`.
- Completing a cycle does not activate its destination.
- Work item project/workspace ownership is revalidated at command time.
- Existing completed cycles without closeout summaries remain supported.

## Data Integrity Expectations

- At most one closeout summary exists per source cycle.
- The closeout summary is immutable after creation.
- Source cycle completion, destination assignment, snapshot creation, and required activity commit atomically.
- Snapshot data is versioned and runtime validated.
- Destination choices are checked again inside the command transaction.
- Duplicate submissions are idempotent or reject with a stable conflict that cannot repeat writes.
- Carried work retains all fields except `cycleId` and normal mutation timestamps.
- Retained terminal work receives no mutation timestamp churn.
- Closeout timestamps use the service clock for deterministic tests.

## Technical Expectations

- Prefer a dedicated cycle-closeout service boundary rather than expanding general cycle CRUD with orchestration logic.
- Reuse existing Cycle Review progress, health, estimate, terminal-status, and display-key semantics.
- Reuse existing work item cycle-change activity/notification behavior without issuing one API call per item from Angular.
- Use a database transaction for the command.
- Prefer one server-derived preview response over frontend aggregation.
- Keep HTTP adaptation separate from closeout policy.
- Add focused indexes only if the technical design identifies a real query need.
- Keep snapshot parsing explicit and version-aware, following the established status-report safety pattern where it fits.
- Keep Angular route/component style budgets clear by splitting the workflow into focused presentational regions if needed.
- Add API tests for permissions, stale state, destination validation, atomic rollback, idempotency, snapshot fidelity, and activity.
- Add Angular tests for loading, preview, no-unfinished state, destination choice, confirmation, conflict refresh, and success.
- Add one focused E2E closeout journey.

## Success Criteria

Qualitative:

- A maintainer can close a cycle without manually finding and editing every unfinished item.
- Before confirming, the maintainer understands what finished and what will move.
- After closeout, the completed cycle still tells the truth about its closing scope.
- Contributors can understand the outcome without mutation access.
- Planning and destination-cycle views reflect the result immediately and consistently.

Verification:

- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run test:e2e`
- `npm run build`
- `npm audit --omit=dev --audit-level=low`
- `git diff --check`

## Risks And Mitigations

### Snapshot And Live State Become Confusing

Risk: users may interpret historical item status as current state.

Mitigation: label the closeout summary as a snapshot, display the close timestamp, and label links as opening current work.

### Concurrent Edits Make Preview Stale

Risk: an item changes status or cycle after preview and before confirmation.

Mitigation: revalidate and re-derive command-time scope, return the actual result, and provide a clear refresh path for lifecycle/destination conflicts.

### Activity And Notifications Become Noisy

Risk: moving many items creates excessive duplicate signals.

Mitigation: record only real cycle assignment changes, retain one concise closeout-level event, and reuse recipient deduplication in existing notification policy.

### Closeout Becomes A Generic Automation System

Risk: per-item routing, status transitions, due-date shifting, and rule configuration expand the sprint beyond a coherent workflow.

Mitigation: support one destination and only change cycle assignment; defer configurable closeout policies.

### Snapshot Scope Expands Into Analytics

Risk: preserving closeout evidence encourages velocity and forecast features before the model is proven.

Mitigation: store the evidence needed to explain one closeout, expose no trend API, and defer cross-cycle analytics.

### Legacy Completed Cycles Lack Snapshots

Risk: old completed cycles cannot provide the new historical fidelity.

Mitigation: preserve current review behavior and show honest legacy absence copy rather than backfilling fabricated history.

## Deferred Opportunities

- Per-item carryover selection or multiple destinations.
- Activating the destination cycle as part of closeout.
- Cycle reopen or closeout correction workflow.
- Retrospective notes and follow-up actions.
- Velocity, throughput, carryover-rate, and trend reporting.
- Burndown, burnup, and cumulative-flow charts.
- Capacity planning and commitment recommendations.
- Recurring cycle templates and automatic generation.
- Scheduled reminders and automatic closeout.
- Due-date shifting policies.
- Automatic workflow transitions.
- Cycle subscriptions and team broadcasts.
- Portfolio-level historical cycle comparison.
- Status report sections based on completed closeout summaries.
- CSV import cycle assignment.

## Open Questions

- Should closeout use a dedicated route or an expanded panel on Cycle Review?
- Should preview be a public read endpoint for any project member or be limited to actors who can close the cycle?
- Should command-time work changes always proceed using fresh state, or should any preview drift require explicit reconfirmation?
- Should the immutable closeout summary live in a dedicated record or as versioned closeout data owned by the cycle?
- Should one project-level closeout activity event be added, or is cycle state history sufficient alongside item-level activity?
- Should watcher notifications fire for every carried item under existing cycle-change policy, or should closeout suppress them to avoid burst noise?
- How much item-level snapshot detail should the completed-cycle page render before linking to a bounded/full view?
- Should existing direct status editing still allow `active` to `completed`, or should completion be routed exclusively through closeout?

## Proposed Defaults For Technical Design

Unless technical design identifies a stronger fit:

- Use a dedicated closeout route under Cycle Review so preview and confirmation have enough space and a reloadable URL.
- Allow all project readers to read completed closeout results, but limit preview/apply endpoints to owners and maintainers because preview exists to support a mutation.
- Re-derive at command time and proceed when only item scope changed; require a refreshed preview when source lifecycle or destination eligibility changed.
- Store one dedicated immutable, versioned closeout record per cycle.
- Add one project/cycle closeout activity plus normal item-level cycle-change activity.
- Preserve existing cycle-change watcher notification behavior, relying on recipient deduplication; revisit burst suppression only if tests or UAT show harmful noise.
- Render bounded item groups in the completed summary and link to current filtered Work for full current lists.
- Route active-to-completed transitions through closeout so a completed cycle cannot bypass snapshot and carryover decisions; retain direct `canceled` transitions as a separate action.
