# Worktrail v0.0.1 PRD

## Summary

`Worktrail` is a compact project management reference app for small teams. The v0.0.1 MVP should let a team create projects, manage work items through a simple workflow, collaborate through comments, and inspect meaningful activity history.

The repository remains `pm-reference`; `Worktrail` is the product-facing name used in this PRD. The product should feel like a real application in miniature: smaller than Jira, Linear, or Asana, but coherent enough for a maintainer team to track a demo project locally.

The v0.0.1 theme should be:

> A production-shaped project tracker that starts local and can grow cloud-native.

## Context

This project exists partly to inform future `jawstack` abstractions. It should not start by building on `jawstack` or extracting a framework prematurely. Instead, it should expose which project management patterns are genuinely reusable across applications:

- resource metadata for projects, members, work items, comments, and activity;
- generated list, board, detail, and form opportunities;
- command/action handling boundaries;
- workflow transition rules;
- authorization checks;
- user-visible event history;
- local-first development paths that can later map to cloud services.

The MVP scope is intentionally small, but the implementation should avoid choices that make enterprise production hard later. In particular, endpoint handlers should be structured so they can run behind a local HTTP server first and later be adapted to serverless functions behind API Gateway or equivalent cloud routing.

## Problem

Small teams need a clear place to track project work, but most production project management tools are too broad to serve as a focused reference application. A useful archetype needs enough domain depth to reveal real implementation pressure without becoming a full enterprise clone.

The app must answer practical product and architecture questions:

- Is a work item a flexible enough primitive for tasks, bugs, stories, chores, and future work requests?
- Which screens and data-loading patterns recur across ordinary workflow apps?
- Which workflow rules can be represented as metadata, and which need hand-written business logic?
- What level of activity history is valuable to users?
- Where do permissions and actor identity appear even before full authentication exists?
- Which local development choices make a future cloud deployment harder?

## Goals

- Deliver a local MVP that can manage multiple projects in one workspace.
- Make work items the central resource with list, board, detail, create, update, comment, and activity flows.
- Provide a simple but useful workflow from backlog through completion or cancellation.
- Preserve user-visible activity for meaningful work item changes.
- Include lightweight member and role concepts even if authentication starts as a local placeholder.
- Use real persistence instead of in-memory-only state.
- Keep setup clear enough that a new developer can run the app and demo data locally.
- Structure server-side use cases and endpoint handlers so they are not tied tightly to Express.
- Establish a codebase shape that can later support hosted deployment, real auth, API Gateway/Lambda-style handlers, and managed databases.
- Capture implementation notes that can inform future `jawstack` abstractions without extracting them during v0.0.1.

## Non-Goals

- Building on `jawstack` by default.
- Creating a generic application framework.
- Shipping a full enterprise project management suite.
- Real-time collaboration.
- Billing, plans, or organization administration.
- External integrations such as GitHub, Jira, Slack, or email.
- Imports from other project management tools.
- Advanced roadmaps, dependency graphs, milestones, or epics as first-class MVP resources.
- Notifications beyond obvious placeholders.
- AI features.
- Mobile-specific product design beyond responsive layout.
- Multi-tenant production hosting in v0.0.1.
- A complete authentication and identity provider integration.

## Target Users

Primary:

- A small maintainer team tracking work for a demo project.
- The project owner using Worktrail as a reference implementation for future application patterns.
- Developers evaluating how resource-centric workflow apps should be structured.

Secondary:

- Future `jawstack` contributors looking for concrete extraction evidence.
- Teams interested in a minimal internal project tracker that can be extended.
- Developers studying cloud-ready local app architecture.

## Positioning

Worktrail should be positioned as a focused project tracker, not an all-purpose work operating system.

Suggested tagline:

> Track project work from backlog to done, with the history that explains how it got there.

Product personality:

- calm, dense, and work-focused;
- clear over flashy;
- fast to scan;
- opinionated enough to guide small teams;
- simple enough that the domain model remains understandable.

## Product Principles

- Make the main work item flows complete before adding secondary surfaces.
- Prefer explicit state and clear validation over magical behavior.
- Treat activity history as a product feature, not only an audit log.
- Keep local development first-class.
- Keep cloud deployment paths visible in the architecture even before hosting exists.
- Make placeholder auth honest: users are distinct actors, but not yet securely authenticated.
- Use abstractions only when they reduce real implementation friction.
- Record extraction candidates, but do not generalize from one app too early.

## MVP Scope

The MVP includes:

- one workspace context;
- multiple projects;
- lightweight members and roles;
- work item creation, viewing, editing, filtering, and status movement;
- comments on work items;
- user-visible activity on work item detail pages;
- project summary/home views;
- list and board views for work items;
- local persistence;
- stable seed data;
- tests for core workflows;
- documented local setup.

## Core Concepts

### Workspace

The MVP should assume a single workspace or team context. The data model should still make future multi-workspace support plausible by keeping workspace ownership explicit where it is cheap to do so.

Workspace behavior:

- provide the top-level context for projects and members;
- seed one default workspace for local development;
- avoid hard-coding product logic that would make future multi-workspace support impossible.

### Projects

Projects organize work items.

Required project fields:

- name;
- description;
- status: `active` or `archived`;
- created timestamp;
- updated timestamp.

Required project behavior:

- list projects;
- create projects;
- view a project home;
- archive or reactivate projects if the implementation cost is small;
- scope work item list, board, create, and activity views by project.

### Members

Members represent actors in the app.

Required member fields:

- name;
- email;
- role: `owner`, `maintainer`, or `contributor`;
- active status.

MVP auth behavior:

- support a local current-user placeholder;
- show authorship on work items, comments, and activity;
- design service/use-case functions as if the actor is supplied by an auth layer;
- avoid relying on anonymous writes internally.

Role assumptions:

- owners can manage projects and future workspace settings;
- maintainers can create, edit, assign, transition, reopen, and archive project work;
- contributors can create work items, comment, and update work assigned to them.

Precise enforcement can be modest in v0.0.1, but the boundaries should be visible in the code.

### Work Items

Work items are the central resource.

Required fields:

- title;
- description;
- type: `task`, `bug`, `story`, or `chore`;
- status: `backlog`, `ready`, `in_progress`, `blocked`, `done`, or `canceled`;
- priority: `low`, `medium`, `high`, or `urgent`;
- assignee;
- reporter or creator;
- labels;
- project;
- created timestamp;
- updated timestamp.

Optional fields for v0.0.1 if they remain low-cost:

- due date;
- estimate;
- parent or epic link.

Work item behavior:

- create from a project context;
- validate required fields;
- view full detail;
- edit title, description, type, status, priority, assignee, and labels;
- filter by status, assignee, type, label, and priority;
- search by title text;
- sort by updated date and priority;
- move between board columns by a status menu or drag-and-drop if inexpensive.

### Comments

Comments support collaboration on work items.

Required behavior:

- add a comment to a work item;
- show author and timestamp;
- list comments on the work item detail page;
- record comment creation in the activity timeline.

Editing and deleting comments are not required for v0.0.1.

### Activity

Activity records meaningful user-visible events.

Required work item events:

- work item created;
- title changed;
- description changed;
- status changed;
- assignee changed;
- priority changed;
- label added;
- label removed;
- comment added.

Required behavior:

- show work item activity on the detail page;
- include actor, timestamp, event type, and human-readable summary;
- store enough structured metadata to support future event feeds or audit use cases.

A project-level activity feed is optional for v0.0.1 if it is cheap after work item activity exists.

## Product Behavior

### Project List

The project list should show active projects by default and make archived projects visible through a simple filter or secondary state.

Each project row or item should show:

- project name;
- status;
- short description;
- open work count;
- recently updated timestamp.

Empty state:

- when no projects exist, offer project creation.

### Project Home

The project home is the default project landing page.

It should show:

- project summary;
- counts by work item status;
- recently updated work items or recent activity;
- navigation to list and board views;
- create work item action.

### Work Item List

The list should be the dense scanning surface.

Required capabilities:

- show title, type, status, priority, assignee, labels, and updated timestamp;
- filter by status, assignee, type, label, and priority;
- search by title text;
- sort by updated date and priority;
- navigate to work item detail;
- create a work item from the current project.

### Board View

The board should group work items by status.

Required columns:

- backlog;
- ready;
- in progress;
- blocked;
- done;
- canceled.

Cards should show:

- title;
- type;
- priority;
- assignee;
- labels.

Moving cards by drag-and-drop is optional. A status menu on each card is sufficient for v0.0.1 and may be preferable if it keeps implementation focused.

### Work Item Detail

The detail page is the main collaboration surface.

It should show:

- full title and description;
- editable status, assignee, priority, type, and labels;
- reporter or creator;
- timestamps;
- comments;
- activity timeline.

The page should support adding comments and updating editable fields without losing the user's place.

### Create Work Item

Work item creation should start from a project context.

Required behavior:

- validate title, type, status, priority, and project;
- default status to `backlog` or `ready`;
- default reporter to the current local user;
- allow assignee to be empty or selected from members;
- return to detail or the list after successful creation;
- show clear validation errors on failure.

## Workflow Rules

The MVP workflow is flexible but structured:

```text
backlog -> ready -> in_progress -> blocked -> done
```

Rules:

- open statuses can move to `blocked`;
- `blocked` can move back to `ready` or `in_progress`;
- `done` and `canceled` are terminal by default;
- maintainers and owners can reopen terminal items;
- contributors should not be able to reopen terminal items unless they are granted maintainer-like behavior later.

The implementation should centralize workflow rules so list, board, detail, tests, and API handlers do not each invent their own transition logic.

## Architecture Expectations

### Local App First

v0.0.1 should be easy to run locally.

Required local capabilities:

- install dependencies;
- initialize or migrate the local database;
- seed demo data;
- start the web app;
- run tests.

The README or release docs should document this clearly.

### Cloud-Ready Server Boundary

Server-side code should separate transport concerns from application behavior.

Preferred shape:

- route or endpoint adapters parse HTTP requests and serialize HTTP responses;
- use-case or service functions handle validation, authorization checks, workflow rules, persistence calls, and activity recording;
- repository/data-access functions isolate database details;
- an explicit actor context is passed into write operations;
- endpoint handlers can be wrapped by Express locally and later adapted to Lambda/API Gateway without rewriting business logic.

The MVP does not need to deploy to AWS, but the architecture should avoid direct dependence on long-lived local process state.

### Persistence

Use real persistence. Acceptable v0.0.1 options:

- SQLite;
- local file database;
- Postgres if the chosen stack makes local setup simple.

The persistence model should support:

- projects;
- members;
- work items;
- labels;
- comments;
- activity events;
- timestamps;
- future auth/user identity integration.

SQLite is likely the best MVP default if no stack decision says otherwise: it is real, local-friendly, easy to seed, and can map cleanly to a managed relational database later.

### API Expectations

The app should expose a coherent internal or external API for the main resources, even if the UI consumes it through framework-native server actions or loaders.

Expected operations:

- list projects;
- create project;
- get project summary;
- list work items for a project;
- create work item;
- get work item detail;
- update work item fields;
- transition work item status;
- add comment;
- list members;
- list activity for a work item.

The technical design should decide whether these are REST routes, framework actions, RPC-style handlers, or a hybrid. The key requirement is keeping application use cases independent of the transport.

## Functional Requirements

- Users can view projects in the workspace.
- Users can create a project.
- Users can open a project home page.
- Users can view work items in a dense list.
- Users can filter work items by status, assignee, type, label, and priority.
- Users can search work items by title.
- Users can sort work items by updated date and priority.
- Users can view work items on a status board.
- Users can update a work item's status from the board.
- Users can create a work item within a project.
- Users can view work item detail.
- Users can update work item title, description, type, status, priority, assignee, and labels.
- Users can add comments to a work item.
- Users can see comment author and timestamp.
- Users can see activity history for meaningful work item changes.
- The system records activity when work items are created or meaningfully changed.
- The system records activity when comments are added.
- The app includes stable seed data for demos.
- The app validates required fields and returns useful errors.
- The app persists data across local restarts.

## UX Requirements

- Navigation should make projects, list view, board view, and work item creation easy to reach.
- The UI should favor dense, scannable project management screens over marketing-style presentation.
- Empty states should be present for projects, work item lists, board columns, comments, and activity where applicable.
- Loading and failure states should exist where data is fetched asynchronously.
- Forms should keep validation errors close to the relevant inputs.
- Responsive layout should work acceptably on common laptop and tablet widths.
- Mobile should not be a product-specific focus, but screens should not break on narrow viewports.
- Labels, priority, type, status, and assignee should be visually distinguishable in lists and cards.

## Data And Activity Requirements

Activity should be stored as structured records, not only rendered text.

Minimum activity fields:

- id;
- workspace id;
- project id;
- work item id;
- actor id;
- event type;
- summary;
- previous value when relevant;
- new value when relevant;
- metadata JSON when relevant;
- created timestamp.

The activity model should not require every event to have previous and new scalar values. Comment events and creation events may use metadata.

## Permissions Requirements

v0.0.1 may implement lightweight authorization, but the code should make future enforcement straightforward.

Minimum expectations:

- write operations receive an actor;
- actor role is available to use-case functions;
- terminal reopen behavior checks maintainer or owner role;
- project archive/reactivate, if implemented, is limited to owner or maintainer;
- tests cover at least one role-sensitive workflow rule.

Full enterprise RBAC is out of scope.

## Testing Expectations

Cover the core workflows:

- create project;
- create work item;
- update work item status;
- reject an invalid status transition if workflow enforcement is implemented;
- reopen terminal item as a maintainer or owner;
- assign work item;
- add comment;
- record activity;
- filter list by status and assignee.

Recommended additional coverage:

- use-case/service tests for workflow and activity behavior;
- repository tests against the local persistence layer;
- component or end-to-end tests for the project list, work item list, create, and detail loop if the selected stack supports them without heavy setup.

## Release Criteria

v0.0.1 is complete when:

- documented local setup works from a clean checkout;
- seed data can be loaded;
- the app starts locally;
- project list and project home are usable;
- work item list, board, create, and detail views are usable;
- comments and activity are visible on work item detail;
- data persists across restarts;
- tests cover the required core workflows;
- server-side code has a clear transport-independent use-case boundary;
- README or docs explain what is intentionally local-only in v0.0.1;
- notes are captured for likely future `jawstack` extraction candidates.

## Future Considerations

Likely post-MVP directions:

- real authentication;
- multi-workspace support;
- hosted deployment;
- Postgres or managed relational database support;
- API Gateway/Lambda deployment adapter;
- organization administration;
- richer project activity feeds;
- saved filters;
- notifications;
- external integrations;
- import/export;
- epics, milestones, or parent-child planning;
- audit/event outbox;
- more complete role-based access control;
- app-level observability;
- extracted `jawstack` resource, workflow, activity, and action patterns.

## Open Questions

- Which frontend/backend stack should v0.0.1 use?
- Should API routes be designed as explicit REST endpoints from the start, or should the first implementation use framework-native loaders/actions with a transport-independent service layer?
- Should SQLite be the default persistence choice, or should the project start with Postgres to mirror cloud production more closely?
- How strict should role enforcement be in the MVP beyond terminal reopen and project archive behavior?
- Should labels be workspace-global, project-local, or free-form strings in v0.0.1?
- Should work item identifiers be human-friendly project keys such as `APP-123`, or opaque IDs for the first version?
- Should the optional due date and estimate fields be included in v0.0.1 or deferred?
