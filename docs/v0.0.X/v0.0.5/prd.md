# Worktrail v0.0.5 PRD

## Summary

Worktrail v0.0.5 should make the application more useful as a daily operating surface. v0.0.4 made Worktrail governable by adding workspace member administration, server-derived actor roles, active/inactive member handling, workspace activity, and permission transparency. The next release should help each active member answer the practical questions that determine whether a tracker becomes part of the team routine:

- What work needs my attention today?
- What is blocked, overdue, stale, or unassigned across projects?
- Can I save a useful filtered view instead of rebuilding it every time?
- Can I quickly capture work without first navigating to the perfect project screen?
- Can project and personal navigation stay efficient as the workspace grows?

The v0.0.5 theme is:

> Make daily work visible, reusable, and quick to capture.

This sprint should add a personal work dashboard, cross-project work discovery, saved views, quick work capture, and navigation polish. It should keep production authentication, notifications, imports, and hosted infrastructure out of scope. The release should deepen real product utility while exposing reusable patterns for user-centered dashboards, saved query state, cross-resource search, and lightweight command entry.

## Context

Worktrail is both a product and a reference application. It should continue to become a credible project tracker while revealing implementation patterns that may later inform `jawstack` and deployable reference solutions.

The current product has:

- Angular SPA frontend with lazy-loaded route components;
- TypeScript API with local Express adapter and transport-neutral handler structure;
- Postgres persistence through Drizzle migrations;
- workspace settings, member administration, role summaries, and workspace activity;
- server-derived local actor roles backed by active workspace members;
- project creation, project settings, archive/reactivate, and label administration;
- stable project keys and immutable work item display keys;
- milestones, due dates, planning dashboard, and persisted board ordering;
- work item list, board, detail, comments, and activity;
- project-level search and filters;
- archived-project write protection;
- static GitHub Pages product site.

The app can now model team governance and credible project planning, but its main workflow is still project-first. That is useful for administrators and project maintainers, but individual contributors need a daily surface that crosses project boundaries. As work volume grows, they should not need to visit every project board to understand what needs attention.

## Problem

Worktrail has good project-level workflows, but it does not yet provide a strong workspace-level operating loop:

- The default app entry point does not summarize the selected actor's work.
- Assigned work, reported work, overdue work, blocked work, stale work, and unassigned work are scattered across project pages.
- Cross-project search is not available as a first-class workflow.
- Useful filter combinations cannot be saved, named, reused, or shared from the app.
- Creating work requires navigating into a project-specific create flow.
- Project navigation will become inefficient as the number of projects grows.
- The existing query/filter patterns are project-scoped and have not yet exercised saved view persistence or user-centered workspace summaries.

These gaps limit adoptability. A tracker becomes sticky when users can open it and immediately see what matters to them, then quickly capture new work without losing context.

## Goals

- Add a personal work dashboard for the currently selected local actor.
- Add cross-project work discovery for active workspace members.
- Let users save, open, update, and delete reusable work item views.
- Keep saved views shareable through URL-backed query state.
- Add a quick create flow for capturing work from global and dashboard contexts.
- Improve project navigation for larger seeded and real local workspaces.
- Keep server-side query, permission, and archived-project rules authoritative.
- Preserve the local actor selector as a development substitute, not production authentication.
- Add tests for cross-project query behavior, saved views, quick create, and dashboard summaries.
- Capture extraction notes for personal dashboards, saved query state, quick create patterns, and cross-resource discovery.

## Non-Goals

- Production authentication.
- Passwords, sessions, OAuth, SSO, MFA, or invitations.
- Notifications, mentions, subscriptions, or email digests.
- Real-time collaboration.
- Full-text search infrastructure outside Postgres.
- Imports from Jira, Asana, Linear, GitHub Projects, or CSV.
- Custom fields.
- Custom workflows.
- Project-specific membership.
- Multi-workspace switching.
- Time tracking.
- Calendar integrations.
- Attachments.
- Bulk edit.
- Saved dashboard customization beyond the scoped views described here.
- AWS infrastructure deployment.
- Lambda/API Gateway adapter implementation.
- Replacing the local Express runtime.

## Target Users

Primary:

- Contributors who need to know what is assigned to them.
- Maintainers who need to triage blocked, overdue, stale, or unassigned work across projects.
- Owners who need a quick workspace health read without opening each project.
- Small teams using Worktrail as a local-first planning tracker.

Secondary:

- Developers evaluating how a serious business app models cross-project discovery and saved views.
- Future `jawstack` contributors looking for repeated patterns in personal dashboards, query persistence, and command-style creation.
- Teams interested in a reference app that can eventually become one-click deployable.

## Positioning

Worktrail should remain focused and operational. v0.0.5 should not try to become a notification hub or portfolio management suite. It should make the tracker easier to open every day and easier to keep current.

Suggested v0.0.5 positioning:

> A focused project tracker where each team member can see their work, reuse important views, and capture new tasks quickly.

## Product Principles

- The first screen should answer real operational questions.
- Personal views should be derived from workspace data, not separate task lists.
- Saved views should preserve useful query intent without hiding the underlying filters.
- Quick create should reduce navigation cost without bypassing validation.
- Cross-project discovery should stay scannable and dense.
- URL query state remains the source of truth for shareable filtered views.
- The server owns permissions and archived-project rules.
- The UI should explain empty states and disabled actions in product terms.
- Prefer simple workspace-level features before dashboards become configurable.

## Scope

### 1. Personal Work Dashboard

Add a dashboard for the currently selected active member. This should become the default signed-in-like landing surface for local development, while still being honest that actor selection is not production auth.

Required behavior:

- Add a route such as `/my-work` or `/dashboard`.
- Make the dashboard reachable from primary navigation.
- Show the selected actor's name and role.
- Show compact summary counts for:
  - assigned open work;
  - due soon work;
  - overdue work;
  - blocked work;
  - stale assigned work;
  - work reported by the actor;
  - work waiting in review-like terminal-adjacent states if available from existing statuses.
- Show actionable work sections:
  - assigned to me;
  - due soon or overdue;
  - blocked work I own or reported;
  - recently updated work relevant to me.
- Include project key, work item display key, title, status, priority, due date, assignee, milestone where available, and last updated timestamp.
- Link every row/card to the work item detail page.
- Link summary counts to the appropriate cross-project filtered view.
- Handle empty states clearly for contributors with no assigned work.
- Update dashboard data when the local actor changes.

Acceptance criteria:

- A seeded contributor can open the dashboard and see assigned work grouped by urgency.
- A seeded maintainer can use dashboard links to inspect blocked or overdue work across projects.
- Changing the local actor refreshes dashboard summary and sections without a full page reload.
- Inactive members do not appear as selectable dashboard actors through the standard UI.
- Archived project work remains readable if included historically, but dashboard sections do not encourage writes to archived projects.

### 2. Cross-Project Work Discovery

Add a workspace-level work item discovery surface that reuses and extends the project-level list patterns.

Required behavior:

- Add a route such as `/work-items` for cross-project work discovery.
- Search across work item display key, title, and description.
- Filter by:
  - project;
  - status;
  - type;
  - priority;
  - assignee;
  - reporter;
  - label;
  - milestone if a project is selected or if the technical design supports cross-project milestone labels clearly;
  - due date state;
  - blocked state;
  - archived project inclusion.
- Sort by:
  - updated newest;
  - updated oldest;
  - priority high to low;
  - priority low to high;
  - due date soonest;
  - created newest;
  - project key then display key.
- Keep filter state in the URL.
- Show active filter pills only when filters are actually applied.
- Provide a clear reset action.
- Include project identity in every result.
- Link to project-scoped pages where useful.

Acceptance criteria:

- Users can find work across all active projects without choosing a project first.
- Users can filter to "assigned to me" across projects from URL-backed state.
- Users can include archived project work intentionally, but archived work is visually distinguishable.
- Project-level list behavior remains unchanged except where shared filter components are intentionally improved.

### 3. Saved Work Views

Let users save useful work item query states as named views. This should start simple and local to the workspace, with ownership by the acting member.

Required behavior:

- Save the current cross-project work discovery query as a named view.
- Show saved views in a compact list or menu on the cross-project discovery page.
- Open a saved view and apply its filters/sort to the URL.
- Rename a saved view.
- Update a saved view from the current filters.
- Delete a saved view.
- Record creator/owner member where useful.
- Support visibility:
  - personal views visible to the creating member;
  - workspace views visible to all active members if implementation complexity is acceptable.
- Prevent duplicate saved view names for the same owner and visibility scope.
- Validate empty names and invalid query payloads.
- Preserve saved views when labels, milestones, projects, or members become inactive/archived, but display missing or inactive references gracefully.

Initial saved view candidates in seed data:

- My open work.
- Blocked work.
- Due soon.
- Unassigned work.

Acceptance criteria:

- A user can save a filtered cross-project list and reopen it after page refresh.
- Opening a saved view updates the URL query state.
- Updating a saved view does not create a duplicate.
- Deleting a saved view removes it from the menu without affecting work items.
- Invalid or stale references in saved queries do not break the page.

### 4. Quick Work Capture

Add a lower-friction way to create work from global and dashboard contexts.

Required behavior:

- Add a "Create work item" action in primary navigation or dashboard actions.
- Open a focused create page or modal-like route that supports selecting the project first.
- Require project, title, type, and priority.
- Support optional assignee, due date, milestone, labels, and description after project selection.
- Default reporter to the current actor.
- Default project from current context when launched from a project page.
- Respect permissions:
  - active owners and maintainers can create work in active projects;
  - contributors can create work in active projects if current rules allow;
  - archived projects cannot receive new work.
- Reuse existing work item create validation and activity behavior.
- After creation, provide a clear path to open the new work item or create another.

Acceptance criteria:

- A user can create a work item from the dashboard without first opening a project.
- Project-specific create still works.
- Project selection drives available milestones and labels.
- Archived projects are not offered as create targets unless shown read-only with clear disabled copy.
- Create failures surface inline without losing entered values.

### 5. Project Navigation Polish

Improve navigation efficiency as the workspace accumulates projects.

Required behavior:

- Add project search/filtering on the project list if not already sufficient.
- Show project key, archived state, recent activity, open work count, and due/blocked signals on project list rows or cards.
- Add a recent projects or pinned projects concept only if the technical design finds a low-complexity path.
- Keep the layout dense and operational.
- Avoid adding decorative dashboard cards that do not improve scanning.

Acceptance criteria:

- Users can find a project quickly by name or key.
- Archived projects remain discoverable but do not dominate active project navigation.
- Project list remains usable at common desktop widths without horizontal overflow.

### 6. Seed Data, Documentation, And Product Site

Update demo and public-facing materials to reflect v0.0.5 capabilities.

Required behavior:

- Seed data supports personal dashboard, cross-project discovery, and saved view demos.
- README walkthrough includes:
  - personal dashboard;
  - cross-project discovery;
  - saved views;
  - quick create;
  - existing project planning and governance paths.
- Static product site describes v0.0.5 capabilities and current limitations.
- Add extraction notes after implementation.

Acceptance criteria:

- A fresh local setup demonstrates v0.0.5 without manual database edits.
- Documentation clearly distinguishes local actor selection from production authentication.
- Product site remains static and deployable through the existing GitHub Pages workflow.

## Data And API Requirements

Expected additions:

- Workspace-level work item query endpoint or service method.
- Personal dashboard summary endpoint or service method.
- Saved view persistence model.
- Saved view CRUD endpoints.
- Optional recent/pinned project persistence only if included by technical design.

Saved view fields should likely include:

- id;
- workspace id;
- owner member id;
- name;
- visibility;
- query payload;
- created timestamp;
- updated timestamp.

The technical design should decide whether saved view query payloads are stored as structured columns, JSONB, or a hybrid. Because saved views must preserve flexible filters and sort state, PostgreSQL `jsonb` is a reasonable candidate if validation remains strict at API boundaries.

## UX Requirements

- Keep dashboard and discovery pages dense, readable, and work-focused.
- Use standard controls for filters, sort menus, saved view menus, and create actions.
- Do not show active filter pills for pending unapplied filter state.
- Preserve URL-backed query state for shareability.
- Make empty states specific to the current actor/filter.
- Use existing visual language and avoid nested card layouts.
- Ensure long work item titles, project names, saved view names, and member names do not overflow controls.
- Keep dashboard summaries actionable; counts should link to filtered result sets.

## Permissions And Policy

- Dashboard read access is available to active members.
- Cross-project discovery is available to active members.
- Saved personal views can be managed by their owner.
- Workspace saved views, if included, can be created and managed by owners/maintainers unless the technical design chooses a simpler owner-only rule.
- Work item creation follows existing project write rules.
- Archived projects are readable but not writable.
- Inactive actors cannot access API read or write flows through manual headers.
- Inactive members may remain visible in historical assignee/reporter/comment/activity contexts.

## Testing Requirements

Backend tests should cover:

- dashboard summary computation;
- cross-project query filters and sorts;
- saved view CRUD and validation;
- saved view ownership/visibility permissions;
- quick create project selection and archived-project rejection;
- stale saved query reference behavior where practical.

Frontend tests should cover:

- dashboard rendering and actor-change refresh;
- cross-project filter application and URL state;
- saved view create/open/update/delete flows;
- quick create project-dependent fields;
- permission-disabled actions where applicable.

E2E smoke should cover:

- open dashboard as seeded actor;
- navigate from dashboard summary to filtered cross-project results;
- save a filtered view;
- reload and reopen the saved view;
- create a work item from the quick create flow;
- confirm the new item appears in dashboard or cross-project discovery.

## Observability And Operations

v0.0.5 does not need production telemetry, but the implementation should continue to preserve future deployment options:

- Keep endpoint handlers transport-neutral where practical.
- Keep dashboard and saved-view logic in services rather than Express-specific code.
- Validate saved view payloads strictly before persistence.
- Avoid storing frontend-only implementation details that would be hard to support across clients.
- Keep migrations deterministic and compatible with local Postgres and future managed Postgres.

## Success Metrics

Because this is still a local reference app, success is measured through functional readiness rather than production analytics:

- A seeded user can understand their current work from the first screen.
- A seeded user can save and reopen at least one useful cross-project view.
- A seeded user can create work from a global context.
- Cross-project discovery stays URL-shareable and reload-safe.
- Existing project planning, board, comment, governance, and archived-project workflows continue to pass tests.
- Production build remains within configured Angular budgets without raising thresholds.

## Risks

- Saved view flexibility can become an untyped dumping ground if query payload validation is weak.
- Cross-project discovery can duplicate too much project-level list code if shared filter/query abstractions are not chosen carefully.
- Dashboard scope can sprawl into configurable reporting if not kept actor-centered.
- Quick create can become a second divergent work item create implementation if it does not reuse existing validation and DTOs.
- Workspace saved views introduce sharing and permission questions that may be too much for this sprint.
- Dashboard and discovery endpoints may become inefficient without careful query design as seed data grows.

## Open Questions

1. Should the primary landing route become `/my-work`, or should `/projects` remain the initial route with dashboard linked from navigation?
2. Should v0.0.5 include workspace-visible saved views, or start with personal saved views only?
3. Should quick create be implemented as a full route, an overlay, or a reused create page with optional project selection?
4. Should saved views support project-scoped lists in v0.0.5, or only the new cross-project discovery route?
5. Should project pins/recent projects be included, or deferred until there is clearer friction from project volume?

## Recommended Decisions

- Make `/my-work` the default app route while keeping Projects one click away.
- Implement personal saved views first, with the data model prepared for workspace visibility.
- Implement quick create as a route, not an overlay, to keep browser navigation, validation, and testing straightforward.
- Support saved views only on cross-project discovery in v0.0.5; project-level saved views can reuse the pattern later.
- Defer pinned projects unless the implementation is trivial after project list search and richer project summaries.

