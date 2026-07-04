# Worktrail v0.0.2 PRD

## Summary

Worktrail v0.0.2 should move the app from a demoable MVP to a more adoptable small-team project tracker. The v0.0.1 release proved the core resource shape: projects, work items, comments, activity, labels, a list, a board, and a local-first Angular/API/Postgres architecture. v0.0.2 should focus on the product surfaces that make the app usable after the seeded demo data is gone.

The v0.0.2 theme is:

> Make a project workspace configurable enough for a real team to start using it.

This sprint should prioritize utility and pattern discovery through concrete product work. The main product gaps are stable work item references, project configuration, label administration, comment lifecycle controls, and a more natural board interaction. These features also exercise repeatable application patterns: scoped sequence generation, resource settings screens, taxonomy administration, audited edits/deletes, and command-style workflow updates.

## Context

Worktrail is a reference app, but it should be built as a serious product. It may never displace Jira, Asana, Linear, or GitHub Projects, but it should aim to be credible enough that a small team could pilot it locally and understand how it would evolve into a hosted application.

The long-term product direction includes:

- cloud-deployable infrastructure;
- real authentication and authorization;
- managed database deployment;
- maintainable enterprise-grade defaults;
- one-click deployment for reference-solution use cases;
- reusable patterns that may later inform `jawstack`.

v0.0.2 should not attempt to solve the entire hosted deployment story. The better next move is to strengthen the actual project management workflow while preserving cloud-ready boundaries. A deployable reference solution is more useful when the application being deployed has enough product depth to validate the architecture.

## Problem

The v0.0.1 MVP is functionally coherent, but several limitations make it feel like a demo rather than a tool a team could adopt:

- Work items are identified only by UUID-backed routes and titles, which makes discussion and cross-reference awkward.
- Project configuration is incomplete from the UI.
- Labels can be assigned, but users cannot create or manage the project label catalog.
- Comments can be added, but mistakes cannot be corrected or removed.
- Board movement works through status menus, but most users expect direct card movement.
- Activity history exists, but it does not yet cover edit/delete behavior for collaboration resources.
- The app has not yet exercised the kinds of settings and taxonomy screens that many business apps need.

These gaps reduce utility and also leave important reference-app patterns undiscovered.

## Goals

- Make work items easy to reference in conversation and documentation.
- Let users configure a project after creation without direct database edits.
- Let users create and maintain a project-specific label catalog.
- Let users edit and delete comments with clear audit/activity behavior.
- Make board movement feel natural while keeping explicit workflow validation on the server.
- Preserve the existing local-first development experience.
- Keep endpoint handlers, services, repositories, and DTOs cloud-adaptable.
- Add enough tests to protect the new resource-management and workflow behavior.
- Capture new extraction observations after settings, taxonomy, and drag/drop patterns exist.

## Non-Goals

- Production authentication.
- Multi-workspace administration.
- AWS infrastructure deployment.
- Lambda/API Gateway adapter implementation.
- Real-time collaboration.
- Notifications.
- File attachments.
- Rich text editing.
- Custom workflow statuses.
- Custom fields.
- Epics, milestones, roadmaps, or dependency graphs.
- Imports from Jira, Asana, Linear, GitHub Projects, or CSV.
- Full mobile-specific product design beyond responsive layout.
- Replacing the local actor selector.

## Target Users

Primary:

- Small teams evaluating whether Worktrail could track a real project.
- Maintainers using Worktrail to manage Worktrail itself or another small reference project.
- Developers studying how ordinary business-app resource workflows should be structured.

Secondary:

- Future `jawstack` contributors looking for repeated patterns in resource settings, taxonomy management, command validation, and activity recording.
- Teams interested in a local-first tracker they can later deploy or extend.
- Developers evaluating the project as a future AWS-style reference solution.

## Positioning

Worktrail should remain a calm, project-focused tracker. v0.0.2 should not chase breadth. The product should become more useful by making the existing surfaces complete, not by adding many new resource types.

Suggested v0.0.2 positioning:

> A focused project tracker where teams can configure their project, reference work clearly, and trust the history behind changes.

## Product Principles

- Finish the core workflow before expanding the domain model.
- Favor durable project conventions over hidden local-only behavior.
- Make user actions reversible or auditable where practical.
- Keep settings close to the resource they configure.
- Keep board interactions fast, but let the server own workflow validity.
- Prefer simple administration over complex customization.
- Preserve a clear path to hosted deployment without prematurely building cloud infrastructure.
- Record extraction candidates only after implementation pressure appears twice.

## Scope

### 1. Human-Friendly Work Item Keys

Work items need stable, human-readable identifiers such as `WT-1` or `APP-42`.

Required behavior:

- Each project has a short uppercase project key.
- Each work item receives a monotonically increasing project-scoped number.
- The displayed work item key combines project key and number.
- Work item list rows, board cards, detail pages, recent work, comments/activity references where applicable, and page titles display the key.
- Existing seed data includes deterministic work item keys.
- Work item detail remains accessible through the existing UUID route, but user-visible links should display the key.

Project key rules:

- Required for newly created projects.
- 2-8 characters.
- Uppercase letters and numbers only.
- Unique within the workspace.
- Generated from the project name by default when possible.
- Editable before or after project creation only if doing so does not break existing work item keys.

Open product decision for technical design:

- Decide whether work item keys are immutable snapshots of the project key at creation time or computed from the current project key. Prefer immutable display keys if project keys are editable.

Acceptance criteria:

- A newly created work item displays a key without refreshing the page.
- Seeded work items have stable keys.
- Work item keys are unique within a project.
- Users can visually scan keys in list and board views.

### 2. Project Settings

Users need a place to maintain project metadata after creation.

Required behavior:

- Add a project settings screen or settings panel reachable from the project home.
- Edit project name.
- Edit project description.
- View and manage project key behavior according to the technical design decision.
- Archive and reactivate projects from the UI.
- Show project status clearly on project list and project home.
- Prevent accidental archive/reactivate actions with a confirmation step or clearly reversible flow.
- Record project setting changes in project-level activity if project activity support already exists cleanly.

Acceptance criteria:

- A user can create a project, update its metadata, archive it, reactivate it, and continue navigating without a full page refresh.
- Archived projects remain visible through the project list status filter.
- Archived project behavior is explicit: users can tell whether work item edits are still allowed or blocked.

### 3. Label Administration

Labels should become a first-class project taxonomy instead of seed-only metadata.

Required behavior:

- Add a label administration surface under project settings or project work item views.
- Create project labels with name and color.
- Edit project label name and color.
- Delete or archive labels.
- Prevent duplicate label names within a project.
- Continue assigning labels from work item detail.
- Add label assignment to the work item create flow.
- Update list filters when labels are created, renamed, or removed.
- Show clear empty states when a project has no labels.

Deletion/archive behavior:

- Prefer archive/disable over destructive delete if the label is used by work items.
- If destructive delete is implemented, clearly define whether existing work item assignments are removed.
- The implementation plan must choose one behavior and make it visible in the UI.

Acceptance criteria:

- A user can create a new label and assign it to a new or existing work item without direct database edits.
- Renaming a label updates list, board, and detail displays.
- Removing or archiving a label has predictable behavior for existing work items.
- Label management errors are shown inline and do not leave stale UI state.

### 4. Comment Edit And Delete

Comments should support ordinary correction workflows.

Required behavior:

- Edit an existing comment.
- Delete an existing comment.
- Show edited state or updated timestamp where useful.
- Confirm destructive deletes.
- Record activity events for comment edited and comment deleted.
- Preserve enough metadata in activity to understand what happened without exposing unnecessary deleted content.

Permission assumptions for v0.0.2:

- Owners and maintainers can edit or delete any comment.
- Contributors can edit or delete their own comments.
- The local actor selector remains the actor source.

Acceptance criteria:

- A comment author can correct a typo and see the updated comment without a full page refresh.
- An owner can delete a comment and see it removed from the discussion.
- Activity reflects comment edits/deletes.
- Unauthorized edit/delete attempts are rejected by the API and represented clearly in the UI.

### 5. Board Drag And Drop

Board movement should support direct card movement while preserving server-side workflow rules.

Required behavior:

- Allow users to drag a card between board columns.
- Use the existing transition endpoint or equivalent command endpoint for status changes.
- Optimistically or pessimistically update the board in a way that avoids confusing stale state.
- Show a clear error and restore the card if the server rejects the transition.
- Preserve keyboard/accessibility fallback through the existing status menu.
- Keep cards readable at common laptop and desktop widths.

Acceptance criteria:

- A user can move a work item through a valid workflow by dragging cards.
- Invalid transitions are rejected and visibly reverted.
- The status menu still works.
- Board movement records activity exactly once per successful transition.

### 6. Activity Coverage

New v0.0.2 actions should appear in activity where they affect collaboration history.

Required events:

- project metadata changed, if project activity is implemented in scope;
- project archived;
- project reactivated;
- label created;
- label renamed;
- label color changed;
- label archived/deleted;
- comment edited;
- comment deleted.

Acceptance criteria:

- New activity events include actor, timestamp, event type, and human-readable summary.
- Activity events have structured metadata sufficient for future audit/detail displays.
- Event summaries are useful to a non-developer user.

## Out Of Scope Details

### Production Auth

v0.0.2 should continue using the local actor selector. Permission checks should be real enough to exercise role policy paths, but identity is still development scaffolding.

### AWS Deployment

Do not build the AWS deployment in v0.0.2. The sprint should keep the path clear by avoiding local-only coupling. The technical design should record any deployment implications discovered by new features, especially sequence generation, settings updates, and drag/drop command handling.

### Custom Workflow

The workflow statuses remain fixed:

- backlog;
- ready;
- in progress;
- blocked;
- done;
- canceled.

Custom workflows are valuable later, but adding them before project settings and label administration would create too much product and schema churn.

## User Experience Requirements

- Project settings should be discoverable from the project home and project work item surfaces.
- Work item keys should be visible but not visually louder than titles.
- Label management should be compact and utilitarian.
- Destructive or broad-impact actions should be clearly confirmed.
- Forms should keep validation messages near the relevant control.
- Board drag feedback should make it clear which column a card will move into.
- Empty states should suggest the next useful action without lengthy explanation.
- Responsive layouts should remain usable on narrow screens, but v0.0.2 does not need a mobile-first board redesign.

## Data And Migration Requirements

- Add schema support for project keys and work item sequence/display keys.
- Add schema support for label archive/delete semantics chosen in technical design.
- Add schema support for comment edited/deleted state if needed.
- Preserve existing v0.0.1 seed data through migration.
- Keep deterministic seed data after migration.
- Keep database reset/migrate/seed commands working locally.

## API Requirements

New or expanded API behavior should remain transport-neutral and actor-scoped.

Likely API surfaces:

- update project settings;
- archive/reactivate project;
- create/update/archive labels;
- create work item with labels;
- update comment;
- delete comment;
- transition work item from drag/drop interactions through the existing command shape.

The technical design should decide exact endpoint names and request contracts.

## Testing Requirements

Backend tests:

- project key generation and uniqueness;
- work item display key assignment;
- project settings update and archive/reactivate behavior;
- label create/update/archive behavior;
- comment edit/delete permission behavior;
- activity events for new actions;
- workflow transition behavior remains unchanged.

Frontend tests:

- project settings form behavior;
- label administration behavior;
- work item create with label assignment;
- comment edit/delete UI behavior;
- board drag/drop success and rejected-transition behavior where practical.

End-to-end smoke:

- Extend the Playwright smoke test or add one focused second path covering:
  1. create or open a project;
  2. create a label;
  3. create a work item with that label;
  4. drag the work item through a valid status transition;
  5. edit or delete a comment;
  6. verify activity.

## Documentation Requirements

- Update README demo walkthrough for v0.0.2 behavior.
- Update known limitations.
- Add `docs/v0.0.2/technical-design.md`.
- Add `docs/v0.0.2/implementation-plan.md`.
- Update jawstack extraction notes after implementation with observations about:
  - project settings;
  - taxonomy administration;
  - scoped sequence generation;
  - comment lifecycle commands;
  - drag/drop command handling.

## Success Metrics

v0.0.2 is successful when:

- a new user can create a project, configure labels, create keyed work items, move them on the board, and manage comments without touching seed data;
- work items are easy to reference by key;
- the app feels meaningfully more useful as a small-team tracker;
- activity history remains coherent after edits and deletes;
- the new patterns create concrete evidence for future extraction without adding generic framework code;
- local setup and verification remain straightforward.

## Risks

- Human-friendly keys can create migration and uniqueness complexity if project keys are editable.
- Label deletion semantics can confuse users if existing assignments disappear unexpectedly.
- Drag/drop can degrade accessibility if the status menu fallback is not preserved.
- Comment deletion can weaken history if activity metadata is too sparse.
- Expanding project settings could invite broader workspace administration scope creep.
- Adding many product surfaces in one sprint can dilute quality; implementation planning should phase this carefully.

## Resolved Technical Choices

- Work item display keys are immutable after creation.
- Project keys can be edited only before the project has work items.
- Labels are archived and reactivated, not hard-deleted.
- Archived projects are read-only for work item, label, comment, and transition writes.
- Deleted comments remain visible as tombstones in the comment thread.
- Board drag and drop uses Angular CDK DragDrop without Angular Material visual components.
- Project-level activity should be recorded for project and label lifecycle events and surfaced on the project home or settings page when implementation cost remains reasonable.
