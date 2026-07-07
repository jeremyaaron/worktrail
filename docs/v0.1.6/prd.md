# Worktrail v0.1.6 PRD

## Summary

Worktrail v0.1.6 should make project backlog triage faster.

v0.1.2 made filtered work views reliable. v0.1.3 through v0.1.5 made saved and pinned operating views easier to reuse. The next product gap is acting on those views efficiently. A project maintainer can now open `Ready for QA`, `Release blockers`, `Unassigned project work`, or a personal pinned triage lens, but then must open work items one at a time to assign, prioritize, label, milestone, or move them.

The product theme is Batch Triage. The release should add a focused multi-select workflow to the project Work page so project teams can select visible work items and apply common updates in a controlled, auditable way.

This sprint should prioritize project-level utility and a production-shaped command pattern. It should not attempt a full spreadsheet editor, cross-project bulk administration, custom automation, or a generic workflow engine.

## Context

Worktrail now has a credible project operating surface:

- project Work pages with filters, URL state, copy links, CSV export, saved views, and pinned shortcuts;
- deterministic project lenses such as `Ready for QA`, `Release blockers`, and `Unassigned project work`;
- project labels and milestones;
- board ordering and status transitions;
- delivery health and planning review links into filtered project work;
- comments, watchers, notifications, relationships, and activity;
- role-aware owner, maintainer, contributor, and archived project behavior.

The app is useful for finding and reviewing work. It is still slower than it should be for repeated triage. Real teams often need to select a set of work items and perform one intent:

- assign unowned items to a member;
- move selected items into a milestone;
- add a label for a review queue;
- raise priority on risk items;
- set a due date for an agreed batch;
- move eligible ready work into progress or blocked.

Today those actions require item-by-item detail edits or board/status interactions. That is acceptable for a tiny demo backlog, but not for a reference app trying to model adoptable project management workflows.

## Problem

Worktrail has strong discovery but weak batch action.

Current friction:

- pinned and saved views can surface the right set of work, but users cannot act on the set;
- maintainers must open work item details repeatedly for simple field updates;
- project planning work such as milestone assignment or triage labeling is too click-heavy;
- the list page has no selected-item state, action bar, or batch result feedback;
- there is no server command boundary for validating and reporting multi-item edits;
- future pattern extraction lacks evidence for selection state, batch command validation, and partial failure reporting.

For project management software, batch triage is basic product utility. It also creates useful architectural evidence: a command can touch many rows, needs strong permission checks, must protect archived/terminal states, and should report exactly what changed.

## Goals

- Add multi-select support to the project Work page result list.
- Add a compact bulk action surface for selected project work items.
- Support high-value project-scoped bulk updates:
  - assignee;
  - priority;
  - milestone;
  - due date;
  - add labels;
  - remove labels;
  - status transition where workflow rules allow it.
- Apply the same server-side permission, archived-project, inactive-reference, and workflow validation used by single-item edits.
- Return structured per-item results so users can understand successes and failures.
- Record activity for successful field changes.
- Preserve existing filters, saved views, pinned views, copy links, CSV export, and detail return URLs.
- Keep batch triage project-scoped for v0.1.6 to avoid cross-project label and milestone ambiguity.
- Add deterministic seed and Playwright coverage that demonstrate bulk triage from a useful project lens.
- Capture destination-neutral pattern notes around selection state and batch commands during finalization.

## Non-Goals

- Do not add cross-project bulk edit on the top-level Work Items page.
- Do not add bulk edit to boards, planning tabs, My Work, or Inbox.
- Do not add inline spreadsheet editing.
- Do not add drag-select, shift-range select, keyboard-only range selection, or saved selections in this sprint.
- Do not persist selected item sets across page reloads, route changes, filter changes, or saved-view opens.
- Do not add bulk create, bulk delete, bulk archive, bulk relationship editing, bulk comments, or bulk imports beyond existing CSV import.
- Do not add automation rules, approvals, scheduled jobs, or background workers.
- Do not add project-specific membership or custom permissions.
- Do not add WebSocket progress updates.
- Do not introduce a generic batch-command package.
- Do not change CSV import/export formats.

## Target Users

### Project Maintainer

Wants to triage a filtered or pinned project view by assigning work, setting a milestone, adding labels, or adjusting priority without opening every item.

### Workspace Owner

Wants project teams to use consistent operating lenses and then act on them efficiently while preserving auditability and role policy.

### Contributor

Wants to understand what changed and avoid seeing controls that imply unauthorized bulk management. Contributors should keep the ability to open work and use existing allowed single-item paths.

### Individual Power User

Wants to use a personal or pinned project view as a working queue, then quickly apply repetitive cleanup to selected items.

### Reference-App Developer

Wants product evidence for selection state, batch command APIs, per-item validation results, and reusable UI patterns without prematurely extracting a generalized abstraction.

## Product Principles

- **Act on the lens:** saved and pinned views should not only help users find work; they should be useful starting points for action.
- **Project scope first:** labels and milestones are project-local, so batch triage should start where those fields are unambiguous.
- **No silent partials:** if some selected items cannot be updated, the UI must say which ones failed and why.
- **Reuse single-item rules:** bulk commands must not bypass workflow, permissions, archived-state, terminal-state, inactive-reference, or relationship-derived constraints.
- **Selection is temporary:** selected rows are page interaction state, not a durable business object.
- **Keep the list scannable:** triage controls should be compact and disappear when nothing is selected.
- **Prefer explicit commands:** batch action requests should carry one clear intent rather than arbitrary object patches.

## Scope

### 1. Project Work Page Selection

Add multi-select behavior to project Work page result rows.

Requirements:

- Add a checkbox to each project work item row.
- Add a select-all-visible checkbox for the current loaded result set.
- Show selected count in a compact bulk action bar.
- Support clearing the current selection.
- Clear selection when:
  - filters change;
  - a saved view or pinned view is opened;
  - the user navigates away;
  - the underlying result set reloads and selected ids are no longer visible.
- Keep selected state local to the project Work page component.
- Preserve mobile card readability with selection controls on narrow screens.
- Do not add row selection to workspace Work Items in v0.1.6.

Acceptance criteria:

- A user can select one, many, or all visible project work items.
- Selection count updates as rows are selected or cleared.
- Selection does not survive route/query changes that produce a different result set.
- Existing row links, detail return URLs, filter controls, saved views, pinned views, copy links, and CSV export keep working.

### 2. Bulk Action Surface

Add a compact action surface for selected project work items.

Requirements:

- Show the bulk action bar only when one or more visible items are selected.
- Let the user choose one bulk action at a time:
  - assign to member;
  - clear assignee;
  - set priority;
  - set milestone;
  - clear milestone;
  - set due date;
  - clear due date;
  - add labels;
  - remove labels;
  - transition status.
- Use project-local member, milestone, and label option sets already available to the page.
- Disable or hide the action bar for archived projects.
- Disable shared mutation controls for actors who cannot perform project work mutations.
- Confirm high-impact status transitions if the selected set includes more than one item.
- Keep labels additive/removal explicit; do not replace the full label set in v0.1.6.

Acceptance criteria:

- A maintainer can select filtered project rows and apply an available bulk action.
- Archived project Work pages do not expose bulk mutation controls.
- Contributors do not see misleading bulk mutation controls when they cannot perform the operation.
- The UI makes the intended action clear before sending a request.

### 3. Bulk Update API

Add a project-scoped API command for batch triage.

Candidate route:

```text
POST /api/projects/:projectId/work-items/bulk-update
```

Candidate request shape:

```json
{
  "workItemIds": ["..."],
  "action": {
    "type": "set_assignee",
    "assigneeId": "..."
  }
}
```

Supported action types:

- `set_assignee`;
- `clear_assignee`;
- `set_priority`;
- `set_milestone`;
- `clear_milestone`;
- `set_due_date`;
- `clear_due_date`;
- `add_labels`;
- `remove_labels`;
- `transition_status`.

Requirements:

- Require `workItemIds` to contain at least one id.
- Cap one request at a conservative maximum, recommended 50 selected items.
- Validate that every requested work item belongs to the route project and actor workspace.
- Validate referenced assignee, milestone, and label ids.
- Reject archived project writes.
- Reuse existing role and project mutation policy.
- Reuse existing workflow transition validation for status changes.
- Apply the command in one transaction.
- Return structured per-item results.

Recommended response shape:

```json
{
  "requestedCount": 3,
  "succeededCount": 2,
  "failedCount": 1,
  "results": [
    {
      "workItemId": "...",
      "displayKey": "WT-7",
      "status": "updated",
      "workItem": { "...": "updated list item dto" }
    },
    {
      "workItemId": "...",
      "displayKey": "WT-8",
      "status": "failed",
      "error": {
        "code": "WORKFLOW_TRANSITION_ERROR",
        "message": "Cannot move done work back to ready."
      }
    }
  ]
}
```

Open technical decision:

- Decide whether the transaction should be all-or-nothing or allow partial success with per-item savepoints.

Product preference:

- Prefer partial success with explicit per-item results if implementation complexity stays reasonable. This avoids a single stale or terminal item blocking a useful batch.
- If partial success materially complicates the service, choose all-or-nothing for v0.1.6 but report the first failure clearly and keep the response shape compatible with future per-item results.

Acceptance criteria:

- API tests cover each supported action type.
- Invalid references return structured errors.
- Archived project requests are blocked.
- Cross-project item ids are rejected or reported as failures without leaking unauthorized data.
- Status transitions use the same workflow rules as single-item status changes.

### 4. Activity, Notifications, And Watchers

Record audit and notification side effects for successful bulk changes.

Requirements:

- Create normal work item activity entries for each successful field change.
- Reuse existing activity event types where possible:
  - assignee changed;
  - priority changed;
  - milestone changed;
  - label added;
  - label removed;
  - status changed;
  - due date changed if an event already exists or is added for v0.1.6.
- Keep activity attached to each affected work item, not to an abstract batch object.
- Preserve assignment and watcher notification behavior for successful changes where equivalent single-item changes already notify.
- Do not notify for failed items.
- Do not add a separate batch activity feed event unless the technical design identifies a clear need.

Acceptance criteria:

- Successful bulk changes are visible in affected work item activity.
- Failed item attempts do not create activity or notifications.
- Existing watcher and assignment notification tests still pass.

### 5. Result Feedback And Recovery

Show clear feedback after a bulk action.

Requirements:

- Show a summary after each request:
  - total selected;
  - updated count;
  - failed count.
- Keep updated items in the visible list when they still match the applied filter.
- Remove items from the visible list if the update means they no longer match the applied filter, after the result summary is shown.
- Show failed items with display key and message.
- Preserve enough context for users to open a failed item if it remains visible.
- Clear successful selections after completion.
- Keep failed selections selected only if they remain visible and the user may want to retry.

Acceptance criteria:

- Users can tell whether all, some, or none of the selected items changed.
- Users can identify failed items by display key.
- The list state after a successful action matches the applied filters.

### 6. Deterministic Seeds And Browser Smoke

Add or reuse seed data that demonstrates batch triage from a real project lens.

Suggested seeded scenario:

- Open Worktrail App project.
- Open pinned or shared `Unassigned project work` or `Ready for QA`.
- Select two visible eligible rows.
- Add a label or set a milestone.
- Verify the list updates and item detail/activity reflects the change.

Requirements:

- Avoid making Playwright depend on fragile item ordering beyond explicit seeded display keys or titles.
- Keep the smoke test short enough to remain part of the local suite.
- Restore deterministic seed behavior after the suite.

Acceptance criteria:

- Browser smoke covers one successful bulk action from the project Work page.
- Browser smoke covers at least one permission or archived read-only absence path.
- Full Playwright suite remains deterministic.

### 7. Documentation And Pattern Notes

Update documentation during finalization.

Requirements:

- Update README with:
  - project batch triage;
  - supported bulk action types;
  - project-only scope;
  - permission and archived-project behavior.
- Update public site if the workflow is polished enough to mention.
- Add v0.1.6 release notes.
- Add v0.1.6 destination-neutral pattern notes for:
  - temporary selection state;
  - batch command request/response contracts;
  - partial failure reporting;
  - activity side effects.
- Keep pattern notes destination-neutral and avoid naming a specific future extraction target.

Acceptance criteria:

- Documentation clearly distinguishes project batch triage from CSV import/export.
- Documentation does not imply cross-project bulk edit support.
- Sprint docs avoid discontinued extraction-target references.

## UX Requirements

- Selection controls must be visible but not dominate row scanning.
- Bulk action controls must fit desktop and mobile widths without text overlap.
- Destructive or high-impact actions require clear labels and, where appropriate, confirmation.
- Bulk status transition copy must explain that workflow rules may reject some items.
- Error messages must be specific enough to guide recovery.
- Keyboard users must be able to select rows, clear selection, choose an action, and submit the action.
- The action bar should not appear as an empty page section when nothing is selected.

## API And Data Requirements

- Add shared contract types for bulk update requests and responses.
- Prefer explicit discriminated action types over a loosely typed patch object.
- Validate request size and referenced ids.
- Keep work item display keys stable in result payloads.
- Return updated list-item DTOs for successful rows so the web app can update state without full reload where practical.
- Do not add new database tables unless the technical design identifies a concrete need.
- Use existing activity and notification tables for side effects.

## Security And Permissions

- Actor identity remains the local selected-member scaffolding.
- Server must derive member role and active state from the database.
- Contributors should not gain bulk access to operations they cannot perform individually.
- Archived projects must reject bulk mutation requests.
- Cross-workspace and cross-project ids must not leak data.
- Inactive assignees may remain historical references but should not be assignable unless existing single-item behavior allows it.

## Performance And Scalability

- Cap batch size to keep local and future Lambda-style execution predictable.
- Avoid N+1 owner/member/project lookups where simple batching is available.
- Keep the request synchronous for v0.1.6; no background worker is required.
- The command should be structured so a future queue-backed implementation could reuse validation and execution logic.
- The project list should avoid full page reloads after successful small batches if local state replacement is straightforward.

## Testing Requirements

- Contract tests for request and response shape.
- API tests for:
  - each supported action type;
  - archived project rejection;
  - contributor/permission rejection;
  - invalid references;
  - cross-project ids;
  - workflow transition failures;
  - activity and notification side effects.
- Web component/page tests for:
  - selection and select-all-visible behavior;
  - action bar visibility;
  - submitting bulk actions;
  - result summaries and failed rows;
  - clearing selection on query/saved-view changes;
  - archived and contributor read-only behavior.
- Playwright smoke for one successful project bulk action.
- Full verification before final handoff:
  - lint;
  - typecheck;
  - reset/migrate/seed;
  - unit tests;
  - build;
  - Playwright.

## Success Metrics

This remains a local reference app, so metrics are qualitative and verification-based:

- A maintainer can update multiple project work items from a filtered or pinned project view without opening item details.
- The feature reduces repeated triage clicks while preserving audit and validation behavior.
- Failed batch rows are understandable and recoverable.
- Existing saved-view, pinned-view, filter, CSV, board, planning, and detail workflows remain intact.
- The implementation yields reusable evidence around selection state and batch command contracts.

## Risks

- **Scope creep:** adding every possible field or cross-project behavior could consume the sprint. Mitigation: project Work page only, explicit action list.
- **Partial failure complexity:** per-item results may complicate transaction handling. Mitigation: decide early in technical design and keep response shape future-compatible.
- **Permission ambiguity:** contributors and assignees may have nuanced single-item permissions. Mitigation: reuse existing policy functions and tests.
- **Activity noise:** many item-level activity entries can feel busy. Mitigation: record only real successful changes and avoid a separate batch event in v0.1.6.
- **Filter disappearance confusion:** updated items may leave the current filtered result set. Mitigation: show a result summary before/while refreshing visible rows.
- **Mobile density:** checkboxes and action bars can crowd cards. Mitigation: keep controls compact and verify responsive layouts.

## Open Decisions

1. Should the bulk command allow partial success with per-item failures, or should it be all-or-nothing for v0.1.6?
2. Which single-item permission rules should contributors retain for batch actions, if any?
3. Should bulk status transition support every workflow transition or only a conservative subset?
4. Should successful bulk updates patch local list state, trigger a full list reload, or use a hybrid approach?
5. Should due-date bulk updates add a new explicit activity event if one does not already exist?

## Recommendation

Proceed with Project Batch Triage as the v0.1.6 scope.

Recommended defaults for open decisions:

- Use partial success if it can be implemented cleanly with item-level execution inside one request; otherwise use all-or-nothing with a future-compatible response envelope.
- Limit bulk actions to actors who can perform the equivalent project work mutation under existing rules.
- Support all valid workflow transitions through existing validation, but rely on per-item failure reporting for invalid selections.
- Reload the current project list after successful bulk actions unless local state replacement proves straightforward.
- Add due-date activity only if the current work item activity model has or needs a matching single-item event; do not invent broad audit infrastructure just for batches.
