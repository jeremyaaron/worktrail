# Worktrail v0.0.8 PRD

## Summary

Worktrail v0.0.8 should make execution risk easier to see and manage. v0.0.7 made Worktrail easier to adopt with real team data by adding CSV import/export and transactional validation. The next release should improve the product's value once that work is inside the system.

The v0.0.8 theme is:

> Make dependencies and blockers visible before they surprise the team.

This sprint should add a focused work item relationship and dependency-management slice: users can link related work, mark blocking relationships, see when a work item is blocked by unfinished upstream work, and filter for dependency risk across project and workspace views. It should not become a broad roadmap, graph visualization, automation, or notification sprint. The goal is to make Worktrail better at real execution management while exposing reusable patterns for relational graph edges, directional validation, derived state, and cross-project reference lookup.

## Context

Worktrail is both a product and a reference application. Each sprint should make the product more useful while revealing implementation patterns that may later inform `jawstack` and one-click deployable reference solutions.

The current product has:

- Angular SPA frontend with lazy-loaded route components;
- TypeScript API with a local Express adapter and transport-neutral endpoint handler structure;
- production-like local preview from built artifacts;
- runtime configuration validation;
- liveness and database readiness endpoints;
- checked-in OpenAPI reference;
- operator runbook;
- Postgres persistence through Drizzle migrations;
- deterministic seed data;
- My Work dashboard;
- cross-project work discovery;
- personal saved views;
- route-based quick work capture;
- project navigation summaries;
- workspace settings and member lifecycle administration;
- server-derived local actor roles backed by active workspace members;
- project settings, labels, milestones, planning dashboard, board, comments, and activity;
- archived-project write protection;
- CSV import/export;
- Playwright smoke coverage across daily workflow, governance, planning, preview, import/export, and responsiveness;
- static GitHub Pages product site.

The product can now hold meaningful work and move that work through a project lifecycle. The next missing project-management primitive is dependency awareness. Teams need to know not only what is blocked, but why it is blocked, what it depends on, and which downstream work will be affected by a delay.

## Problem

Worktrail currently supports a `blocked` status, comments, labels, milestones, board movement, and discovery filters. Those tools can represent execution risk informally, but they do not model dependencies directly.

Current gaps:

- A blocked item cannot point to the specific work item that is blocking it.
- A work item cannot show which downstream items it blocks.
- Cross-project dependency risk is invisible unless users encode it manually in titles, labels, or comments.
- Project and workspace discovery cannot answer "which items are blocked by unfinished work?"
- Planning dashboards cannot distinguish manually blocked work from dependency-blocked work.
- Activity does not capture dependency changes.
- The product has not exercised graph-like relationships, directional validation, or derived state from related records.

These gaps reduce utility for realistic teams. Project management tools become more valuable when they reveal the chain of work, not just individual task state.

## Goals

- Add work item relationships with a small, useful initial relationship set.
- Support directional blocking relationships between work items.
- Support non-directional related-work links where users need lightweight context.
- Show inbound and outbound relationships on work item detail pages.
- Derive and display dependency-blocked signals when a work item is blocked by unfinished upstream work.
- Add filters for dependency-blocked work in project and workspace discovery.
- Add dependency signals to My Work and planning surfaces where they improve daily decision-making.
- Record relationship lifecycle changes in project/work item activity.
- Preserve archived-project write protection and existing permission behavior.
- Keep the relationship model constrained enough to validate and test thoroughly.
- Update OpenAPI, README, product site, and sprint extraction notes.
- Capture reusable patterns for graph-edge constraints, directional relationships, derived state, and cross-project lookup.

## Non-Goals

- Full graph visualization.
- Gantt charts or critical path planning.
- Automatic scheduling.
- Notifications, email, Slack, webhooks, or subscriptions.
- Custom relationship types.
- User-defined workflows.
- Dependency templates.
- Bulk relationship import/export.
- Relationship comments or annotations.
- Work item hierarchy, epics, initiatives, or parent/child trees.
- Duplicate detection or merge workflows.
- Automation rules such as "move to blocked when dependency is added."
- Production authentication.
- Hosted cloud infrastructure.

## Target Users

Primary:

- Project owners managing sequencing risk across active work.
- Maintainers triaging blocked work during planning.
- Contributors who need to understand what is blocking their assigned items.
- Teams evaluating whether Worktrail can model real execution dependencies.
- The project owner evaluating reusable relationship patterns for `jawstack`.

Secondary:

- Developers evaluating Worktrail as a serious reference app.
- Future maintainers who need a concrete local graph-edge pattern before adding richer planning features.
- Teams importing a backlog and then connecting the important dependencies manually.

## Positioning

Worktrail should remain a focused project tracker. v0.0.8 should not pretend to be a portfolio-planning system. It should make dependency risk concrete, searchable, and understandable.

Suggested v0.0.8 positioning:

> A focused project tracker that shows what work depends on, what it blocks, and where execution risk is building.

## Product Principles

- Relationships should clarify work, not create a second workflow system.
- Blocking relationships are directional and should read naturally.
- Related-work links should be lightweight and low ceremony.
- Dependency-blocked state should be derived and explainable.
- Users should be able to find dependency risk from existing list and dashboard surfaces.
- Server validation remains authoritative.
- Archived projects remain readable and protected from writes.
- Cross-project linking should be allowed inside the same workspace.
- The first relationship model should be intentionally small.
- Implementation should reveal reusable relationship patterns without abstracting them prematurely.

## Scope

### 1. Work Item Relationship Model

Add a persisted relationship model for work items in the same workspace.

Initial relationship types:

- `blocks`: directional. Source work item blocks target work item.
- `relates_to`: symmetric in product behavior, stored in a canonical form to avoid duplicate mirror rows.

Required behavior:

- Relationships can connect work items across projects in the same workspace.
- Relationships cannot connect a work item to itself.
- Duplicate relationships are rejected.
- For `blocks`, inverse duplicate rows are allowed only when they represent a genuinely different meaning; the technical design should decide whether to prevent two-way blocking cycles entirely.
- For `relates_to`, `A relates_to B` and `B relates_to A` are the same relationship.
- Relationships involving archived projects are readable.
- Creating or deleting relationships on archived-project work items is blocked.
- Relationship changes create activity events.

Acceptance criteria:

- A work item can block another work item in the same workspace.
- A work item can be related to another work item in the same workspace.
- Duplicate and self relationships return clear validation errors.
- Relationship data survives reloads and appears consistently from either side.
- Archived work item relationship writes are rejected.

### 2. Relationship Display On Work Item Detail

Add a relationships section to the work item detail route.

Required behavior:

- Show work items this item blocks.
- Show work items blocking this item.
- Show related work items.
- Include enough context for each linked work item:
  - display key;
  - project key;
  - title;
  - status;
  - priority;
  - assignee when present.
- Link each related work item to its detail route.
- Allow users with normal edit permission to add and remove relationships.
- Use a searchable work item picker or search input scoped to the workspace.
- Prevent selecting the current work item.
- Show clear empty states.

Acceptance criteria:

- Users can add a blocking relationship from a work item detail page.
- Users can add a related-work relationship from a work item detail page.
- Users can remove relationships when permitted.
- Inbound and outbound blocking relationships are displayed with clear language.
- Read-only states are clear for archived projects and users without write permission.

### 3. Dependency-Blocked Signals

Add derived dependency signals without replacing the existing status workflow.

Definitions:

- A work item is dependency-blocked when it has at least one inbound open blocker.
- An open blocker is a blocking source work item whose status is not terminal.
- Terminal statuses are the existing workflow terminal states, such as `done` and `canceled`.

Required behavior:

- Work item detail shows whether the item is dependency-blocked and lists the open blockers.
- Project work item list shows a compact dependency-blocked signal.
- Workspace discovery shows a compact dependency-blocked signal.
- My Work includes dependency-blocked assigned work in a way that is visible but not noisy.
- Planning surfaces identify dependency-blocked work where they currently surface blocked or risky work.
- The existing `blocked` status remains manual workflow state; dependency-blocked does not automatically change status.

Acceptance criteria:

- An item blocked by an in-progress upstream item shows as dependency-blocked.
- When the upstream blocker moves to `done` or `canceled`, the downstream dependency-blocked signal clears.
- Manual `blocked` status and dependency-blocked signal can coexist.
- Users can distinguish "status is blocked" from "blocked by unfinished dependency."

### 4. Dependency Filters

Extend project and workspace discovery filters to include dependency state.

Required filters:

- `dependencyBlocked`: items with at least one open blocker.
- `blockingOpenWork`: items that block at least one open downstream item.

Required behavior:

- Project work item list supports dependency filters.
- Cross-project work item discovery supports dependency filters.
- Filter state is URL-backed where the current page already uses URL-backed filters.
- Saved views preserve dependency filters.
- CSV export respects applied dependency filters.

Acceptance criteria:

- Users can filter a project to dependency-blocked work.
- Users can filter workspace discovery to items blocking open downstream work.
- Saved views reopen with dependency filters intact.
- CSV exports match the currently applied dependency filters.

### 5. Activity Coverage

Record meaningful activity for relationship changes.

Required behavior:

- Creating a relationship records activity for the affected work item.
- Deleting a relationship records activity for the affected work item.
- Activity copy identifies the related work item display key and relationship type.
- Project activity includes relationship events for work items in that project.
- Workspace activity can include relationship events if the existing activity model supports it without disproportionate churn; otherwise document the decision.

Acceptance criteria:

- Adding a blocker appears in activity.
- Removing a blocker appears in activity.
- Adding and removing related-work links appears in activity.
- Activity copy remains understandable when relationships cross project boundaries.

### 6. API And Contract Documentation

Update contracts and API documentation for relationship operations and dependency filters.

Required behavior:

- Add shared DTOs for relationship summaries, create requests, delete responses if needed, and dependency signal fields.
- Add API endpoints for listing, creating, and deleting work item relationships.
- Add query contract support for dependency filters.
- Update OpenAPI for new endpoints and query parameters.
- Preserve the endpoint-handler shape that can later map to Lambda/API Gateway.

Acceptance criteria:

- Contracts compile across API and web.
- OpenAPI documents relationship endpoints and dependency filter query params.
- API errors follow the existing structured error shape.
- Endpoint handlers remain transport-neutral.

### 7. Documentation And Extraction Notes

Update release-facing documentation.

Required behavior:

- Update README capabilities and walkthrough for dependency management.
- Update the static product site to mention dependency visibility.
- Add `docs/v0.0.8/jawstack-extraction-notes.md`.
- Capture reusable patterns for:
  - graph-edge modeling;
  - symmetric vs directional relationship semantics;
  - duplicate/self/cycle validation;
  - derived state from related records;
  - cross-project lookup and permission checks;
  - URL-backed filters with relationship-derived criteria.

Acceptance criteria:

- README and product site reflect v0.0.8 capabilities.
- Extraction notes capture reusable patterns without prematurely abstracting them.
- Final verification commands are recorded in the implementation plan when Phase 0 and later documents are created.

## User Experience Notes

Relationship language should be explicit:

- "This work is blocked by..."
- "This work blocks..."
- "Related work"

Avoid vague labels like "Dependencies" alone when direction matters.

The work item detail page should remain the primary editing surface. Lists and dashboards should surface dependency signals and filters, but relationship creation can remain detail-only for this sprint.

The dependency-blocked signal should be compact and readable. It should not visually dominate status, priority, assignee, or due-date information.

## Permissions

Use existing work item edit permissions for relationship writes.

Expected behavior:

- Owners and maintainers can create and delete relationships on active projects.
- Contributors can create and delete relationships only where existing work item edit policy allows similar edits.
- Users without write permission can read relationships.
- Archived projects block relationship writes.
- Inactive actor behavior follows existing actor validation.

The technical design should confirm exact contributor permissions based on the current work item edit policy.

## Data And Migration Expectations

Expected schema changes:

- Add a work item relationship table.
- Store relationship type.
- Store source and target work item IDs.
- Store created metadata if it fits the existing activity/audit conventions.
- Add constraints for same-workspace integrity where practical.
- Add uniqueness constraints for duplicate prevention.

No destructive migration should be required.

Seed data should include:

- at least one same-project blocking relationship;
- at least one cross-project blocking relationship;
- at least one related-work relationship;
- at least one downstream item that is dependency-blocked by an open blocker;
- at least one downstream item whose blocker is terminal and therefore not dependency-blocked.

## Reporting And Metrics

No external analytics are in scope.

Product-facing counts may include:

- dependency-blocked assigned work on My Work;
- dependency-blocked work in planning;
- count of open blockers on a work item;
- count of open downstream items blocked by a work item.

These should be implemented only where they fit existing surfaces without turning this into a reporting sprint.

## Accessibility And Responsiveness

The relationship UI should preserve current accessibility and responsiveness standards:

- Relationship controls are keyboard reachable.
- Search results and remove actions have clear labels.
- Empty and error states are readable at common desktop widths.
- Mobile layouts should avoid horizontal overflow.
- Compact dependency badges should not rely on color alone.

## Test Coverage Expectations

Backend:

- relationship creation, duplicate rejection, self rejection, same-workspace enforcement, archived write rejection, and deletion;
- derived dependency-blocked calculations;
- dependency query filters;
- activity events for relationship lifecycle;
- OpenAPI route coverage where existing tests support it.

Frontend:

- work item detail relationship rendering;
- add/remove relationship flows;
- read-only states;
- dependency filter serialization;
- saved view persistence for dependency filters;
- CSV export query construction with dependency filters.

E2E:

- create a blocker relationship;
- verify downstream dependency signal;
- filter for dependency-blocked work;
- move the blocker to a terminal status and verify the dependency signal clears;
- verify a saved dependency view can be reopened.

## Release Criteria

v0.0.8 is complete when:

- users can add and remove blocking and related-work relationships;
- work item detail pages explain inbound and outbound relationships;
- dependency-blocked signals update from current upstream statuses;
- project and workspace filters can find dependency-blocked work and work blocking downstream items;
- saved views and CSV export respect dependency filters;
- relationship activity is recorded;
- OpenAPI, README, product site, and extraction notes are updated;
- final verification passes:
  - `npm run typecheck`;
  - `npm test`;
  - `npm run test:e2e`;
  - `npm run build`;
  - `npm audit --omit=dev --audit-level=low`;
  - `npm run db:reset`;
  - `npm run db:migrate`;
  - `npm run db:seed`;
  - `git diff --check`.

## Open Questions

1. Should `blocks` relationships prevent all cycles, or only direct two-way blocking?
2. Should contributors be allowed to edit relationships using the same policy as work item field edits, or should relationship writes be maintainer-only?
3. Should `relates_to` be included in v0.0.8, or should the sprint focus exclusively on blocking dependencies?
4. Should My Work get a new dependency-blocked card, or should dependency-blocked work appear as a subsection within existing assigned/blocked work?
5. Should cross-project blocking relationships show project-level warnings when one project is archived after relationships already exist?

## Recommended Defaults For Open Questions

Unless later design work finds a strong reason to change course:

- Prevent all blocking cycles within the reachable blocking graph.
- Use the existing work item edit policy for relationship writes.
- Include `relates_to`; it is a low-cost complement if the relationship model is already being added.
- Add a small My Work dependency-blocked summary count linked to workspace discovery.
- Keep archived relationship warnings local to relationship displays rather than adding project-level warnings in this sprint.

