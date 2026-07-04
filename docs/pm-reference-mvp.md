# pm-reference MVP Scope

## Status

Active development.

Repository: `../pm-reference`

## Purpose

`pm-reference` is the first production-shaped reference app. Its job is to explore the project management archetype deeply enough to inform future `jawstack` abstractions, without requiring the app to be built with `jawstack`.

The MVP should feel like a real project management tool in miniature, not a toy CRUD demo and not a full Jira/Linear clone.

## Learning Target

Learn which project management patterns are generic workflow/resource patterns and which are app-specific product decisions.

Specific questions:

- Are issues, stories, tasks, and work requests the same core resource with different product language?
- Which views are common enough to generate later: list, board, detail, activity, create/edit forms?
- Which workflow rules belong in resource metadata versus hand-written application logic?
- What permissions are needed for ordinary team project workflows?
- What activity/events are useful to users versus useful only internally?
- Which pieces create repeated implementation pain that could justify `jawstack` extraction?

## MVP Product Definition

A small team can create a project, define a simple workflow, create and manage work items, collaborate through comments, and inspect activity across the project.

## Core Domain

### Workspace And Project

- One workspace or team context.
- Multiple projects inside the workspace.
- Project list and project detail.
- Project status such as active or archived.

### Members

- Lightweight member model with name and email.
- Role assumptions for owner, maintainer, and contributor.
- Auth can be a clear local placeholder in the first build, but the app should be designed as if users are distinct actors.

### Work Items

Work items are the central resource.

Required fields:

- title
- description
- type: task, bug, story, chore
- status: backlog, ready, in progress, blocked, done, canceled
- priority: low, medium, high, urgent
- assignee
- reporter or creator
- labels
- project
- created and updated timestamps

Useful but optional for MVP:

- due date
- estimate
- parent or epic link

### Comments

- Add comments to work items.
- Show comment author and timestamp.
- Preserve comments as part of the work item detail view.

### Activity

Record user-visible activity for meaningful changes:

- work item created
- title or description changed
- status changed
- assignee changed
- priority changed
- label added or removed
- comment added

Activity should be visible on the work item detail page. A project-level activity feed is useful if it is cheap, but not required for the first slice.

## Core Views

### Project Home

- Project summary.
- Counts by status.
- Recent activity or recently updated work items.
- Links to list and board views.

### Work Item List

- Table or dense list of work items.
- Filter by status, assignee, type, label, and priority.
- Search by title text.
- Sort by updated date and priority.

### Board View

- Columns by status.
- Cards show title, type, priority, assignee, and labels.
- Moving cards between columns should update status.

Drag and drop is not required for the MVP if it slows implementation. A status menu on each card is acceptable.

### Work Item Detail

- Full title and description.
- Editable status, assignee, priority, type, and labels.
- Comments.
- Activity timeline.

### Create Work Item

- Create a work item from project context.
- Validate required fields.
- Return to detail or list after creation.

## Workflow Rules

Start with a simple flexible workflow:

```text
backlog -> ready -> in progress -> blocked -> done
```

Rules should allow practical transitions:

- any open status can move to blocked
- blocked can move back to ready or in progress
- done and canceled are terminal by default, but maintainers can reopen

These rules are intentionally simple. The point is to expose where workflow metadata would help, not to design a comprehensive project management engine.

## Persistence

Use real persistence, not in-memory-only state, unless the first implementation sprint explicitly needs a temporary local fixture.

Acceptable MVP persistence options:

- SQLite
- local file database
- Postgres if the chosen stack makes it easy

The data model should make activity/history and future auth integration straightforward.

## Testing Expectations

Cover the core workflows:

- create project
- create work item
- update work item status
- assign work item
- add comment
- record activity
- filter list by status and assignee

End-to-end or component tests are useful for the list/detail/create loop if the stack supports them without heavy setup.

## Out Of Scope For MVP

- billing
- external integrations
- real-time collaboration
- GitHub/Jira import
- advanced roadmaps
- dependency graphs
- epics/milestones as first-class objects
- notifications beyond placeholders
- full organization administration
- mobile-specific design
- AI features
- building on `jawstack` by default

## Product Quality Bar

The MVP should be useful enough that a small maintainer team could track work in it for a demo project, even if it lacks integrations and polish.

It should have:

- coherent navigation
- responsive layout
- empty states
- validation errors
- loading and failure states where data is fetched
- stable seed data for demos
- clear local setup

## JawStack Extraction Notes

Track these during implementation:

- repeated resource metadata shapes
- command/action patterns
- status workflow definitions
- generated list/detail/form opportunities
- activity timeline conventions
- authorization checks
- event/outbox needs
- places where app-specific UX resists generic generation

Do not extract into `jawstack` from this app alone unless the pattern is both painful and clearly reusable.
