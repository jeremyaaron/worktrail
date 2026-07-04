# Worktrail v0.0.3 PRD

## Summary

Worktrail v0.0.3 should turn the existing tracker into a more credible planning tool for small teams. v0.0.2 made projects configurable and made everyday collaboration more complete through labels, stable work item keys, comments, activity, and drag/drop status movement. The next release should help a team answer higher-level planning questions:

- What are we trying to finish next?
- What work belongs to that target?
- What is blocked, late, stale, or unassigned?
- Can the board preserve the order the team agrees on?
- Can users quickly find the work they need without scanning every card?

The v0.0.3 theme is:

> Make project planning visible, ordered, and reviewable.

This sprint should add a lightweight planning layer without turning Worktrail into a portfolio management system. The core product additions are milestones, persisted board ordering, stronger work item discovery, and a project planning dashboard. These features also exercise reusable application patterns: scoped planning entities, many-to-one work assignment, ordered collections, richer query APIs, and summary endpoints.

## Context

Worktrail is both a product and a reference application. It should continue to become a useful project tracker while revealing patterns that may later inform `jawstack` and deployable reference solutions.

The current product has:

- Angular SPA frontend;
- TypeScript API with local Express adapter and transport-neutral handler structure;
- Postgres persistence through Drizzle migrations;
- project settings and label administration;
- stable work item display keys;
- work item list, board, detail, comments, and activity;
- archived-project write protection;
- local actor selector for development-only role paths;
- static GitHub Pages product site.

The next sprint should keep the local development setup first-class. It should not introduce cloud infrastructure yet. The product still needs more depth before one-click deployment becomes the highest-leverage investment.

## Problem

Worktrail can now track work items, but it does not yet support the planning rituals that make a tracker useful to a real team:

- Work items are flat within a project; there is no release, milestone, iteration, or target date grouping.
- The board supports moving work between statuses, but it does not preserve deliberate ordering within a column.
- The work item list has basic filtering, but discovery will degrade as projects accumulate more work.
- Project home summarizes recent work and status counts, but it does not give a planning review surface.
- Due dates, blocked states, unassigned work, stale work, and milestone progress are not surfaced together.
- The app has not yet exercised ordered-list persistence, richer query endpoints, or planning summary patterns.

These gaps limit utility for real teams and leave important reference-app patterns unexplored.

## Goals

- Let teams define project milestones as planning targets.
- Let users assign work items to milestones during create and edit flows.
- Show milestone progress clearly enough for project review.
- Persist board card ordering within status columns.
- Support drag/drop reordering within a status and moving between statuses in one interaction.
- Improve work item discovery through search, filters, and sort options.
- Add a project planning dashboard focused on milestone progress, risks, and triage.
- Keep the UI calm, dense, and operational rather than marketing-like.
- Preserve accessibility fallbacks for drag/drop behavior.
- Maintain server-owned validation for workflow, archived-project rules, and write permissions.
- Add tests around ordering, planning queries, and milestone lifecycle behavior.
- Capture extraction notes for ordered collections, planning summaries, and richer query APIs.

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
- Epics, initiatives, portfolios, or cross-project roadmaps.
- Sprint capacity planning.
- Time tracking.
- Calendar integrations.
- Imports from Jira, Asana, Linear, GitHub Projects, or CSV.
- Full mobile-specific redesign.
- Replacing the local actor selector.

## Target Users

Primary:

- Small teams using Worktrail to plan and review one active project.
- Maintainers using Worktrail to manage Worktrail or another reference project.
- Developers evaluating how a serious business app structures planning workflows.

Secondary:

- Future `jawstack` contributors looking for repeated patterns in scoped resources, ordered lists, summary endpoints, and query state.
- Teams interested in a local-first tracker that can later become cloud deployable.
- Developers evaluating Worktrail as a future AWS-style reference solution.

## Positioning

Worktrail should remain focused and calm. v0.0.3 should not compete with enterprise portfolio suites. It should make one project easier to plan and review.

Suggested v0.0.3 positioning:

> A focused project tracker where teams can organize work around milestones, keep boards intentionally ordered, and review project risk at a glance.

## Product Principles

- Planning should emerge from work items, not require a heavyweight hierarchy.
- Ordering should be deliberate and persistent.
- Search and filters should make large projects feel manageable.
- Summary views should answer operational questions, not decorate the page.
- The server owns mutation validity; the client can make interactions efficient but not authoritative.
- Every new planning concept should have a clear lifecycle.
- Prefer simple, project-scoped features before cross-project abstractions.
- Keep cloud-readiness in the boundaries, not in premature infrastructure.

## Scope

### 1. Project Milestones

Milestones provide lightweight planning targets within a project. They should represent releases, iterations, launch targets, or other bounded goals without introducing a larger hierarchy.

Required behavior:

- Create a milestone within a project.
- Edit milestone name, description, target date, and status.
- Archive or close milestones without deleting historical assignment data.
- Assign a work item to zero or one milestone.
- Assign or change a milestone during work item create and edit flows.
- Show milestone on work item list rows, board cards where space allows, and work item detail.
- Filter work items by milestone.
- Include milestone activity for create, update, status change, archive, and work item assignment changes.

Milestone statuses:

- `planned`
- `active`
- `completed`
- `canceled`

Milestone rules:

- Milestone names are required and unique among active milestones in a project.
- Archived or completed milestones remain visible in historical contexts.
- Archived or completed milestones are excluded from default assignment controls unless already assigned.
- Archived projects remain read-only for milestone writes.

Acceptance criteria:

- A maintainer can create a milestone, assign work to it, and see progress without a full page refresh.
- A user can filter a project work item list to one milestone.
- A completed milestone still displays assigned work items.
- Duplicate active milestone names are rejected with a clear inline error.
- Milestone lifecycle changes appear in project activity.

### 2. Persisted Board Ordering

The project board should preserve the order users choose. v0.0.2 drag/drop changes status but does not make order a durable planning signal.

Required behavior:

- Persist card order within each status column.
- Drag a card within the same status to reorder it.
- Drag a card to another status and place it at a specific position in that destination column.
- Continue using server-side workflow validation for status transitions.
- Revert UI state and show a clear error if the server rejects a move.
- Keep the existing status dropdown as an accessibility and precision fallback.
- Define deterministic ordering for newly created work items.
- Ensure list and board refreshes preserve board order.

Ordering expectations:

- Board order is project-scoped and status-scoped.
- New work items appear at the top of their initial status unless the technical design identifies a better default.
- Moving a card to another status records one status/order activity event or a clearly defined pair of events.
- Reordering within the same status records activity only if the event adds useful audit value. The technical design should decide whether pure reorders are activity-worthy.

Acceptance criteria:

- Reordering a column survives page refresh.
- Moving a card between columns preserves the selected destination position.
- Invalid status transitions are rejected and restored cleanly.
- Keyboard/status-menu movement remains available.
- Concurrent or stale-order updates produce deterministic server behavior.

### 3. Work Item Search, Filters, And Sorts

Work item discovery needs to scale beyond the seeded demo set.

Required behavior:

- Add text search across display key, title, and description.
- Filter by:
  - status;
  - type;
  - priority;
  - assignee;
  - reporter if low effort;
  - label;
  - milestone;
  - due date state.
- Add due date states:
  - overdue;
  - due soon;
  - no due date.
- Add sort options:
  - updated newest;
  - updated oldest;
  - priority high to low;
  - priority low to high;
  - due date soonest;
  - created newest;
  - board order where applicable.
- Keep filter state in the URL so views can be shared or reloaded.
- Show active filter chips or equivalent compact indicators.
- Provide a clear reset action.

Acceptance criteria:

- A user can find a work item by display key or title.
- A user can combine milestone, label, assignee, and due-date filters.
- Refreshing the page preserves list filter state.
- Empty results explain that filters are active and provide a reset path.
- API query behavior is covered by backend tests.

### 4. Planning Dashboard

The project home should become a more useful review surface without becoming a separate reporting product.

Required behavior:

- Add a planning section to project home or a dedicated project planning page.
- Show active milestone progress:
  - total work items;
  - done count;
  - blocked count;
  - overdue count;
  - target date.
- Show risk-focused lists:
  - blocked work;
  - overdue work;
  - due soon work;
  - unassigned ready/in-progress work;
  - stale in-progress work.
- Link every dashboard item to the relevant filtered list or work item detail.
- Keep the dashboard useful with no milestones by showing triage cards/lists.
- Ensure archived projects render read-only planning information.

Acceptance criteria:

- A project reviewer can identify blocked, overdue, and unassigned work from one page.
- Milestone progress links to a filtered list for that milestone.
- Empty states are specific and compact.
- Dashboard data is served by a dedicated summary endpoint or a clearly justified reuse of existing endpoints.

### 5. Work Item Detail Planning Fields

The work item detail page should expose the planning data added in v0.0.3 in a consistent editing model.

Required behavior:

- Show and edit milestone assignment.
- Keep due date and estimate fields prominent enough to support planning.
- Display board order/status context where useful without adding noise.
- Record activity when milestone assignment changes.
- Preserve archived-project read-only behavior.

Acceptance criteria:

- A user can assign, change, and clear a milestone from detail.
- Milestone changes are visible in activity.
- Detail, list, board, and dashboard stay consistent after updates.

### 6. Documentation And Public Site Updates

The release should keep the repository and public face current.

Required behavior:

- Update README capabilities, setup notes if needed, and demo walkthrough.
- Update the static site to mention v0.0.3 planning capabilities.
- Add v0.0.3 extraction notes after implementation.
- Keep planning documents under `docs/v0.0.3/`.

Acceptance criteria:

- README reflects v0.0.3 behavior.
- Product site highlights milestones, board ordering, search/filtering, and planning dashboard.
- Extraction notes identify reusable patterns and rejected abstractions.

## User Journeys

### Plan A Milestone

1. A maintainer opens a project.
2. They create an active milestone called `v0.0.3`.
3. They assign existing backlog and ready work to the milestone.
4. They open the planning dashboard and see progress, blocked work, and overdue work.
5. They share or reload a filtered list showing only that milestone.

### Run A Board Review

1. A contributor opens the project board.
2. They move a card from ready to in progress and place it below another in-progress card.
3. They reorder blocked items by urgency.
4. They refresh the page and see the same order.
5. They use the status dropdown for a precise move when drag/drop is inconvenient.

### Triage A Large List

1. A maintainer opens the work item list.
2. They search for `WT-12`.
3. They filter to active milestone, high priority, unassigned, and due soon.
4. They clear filters with one action.
5. They follow dashboard links back to filtered list views.

## Functional Requirements

- Milestones are project-scoped.
- A work item can belong to at most one milestone.
- Milestone assignment is optional.
- Milestone data appears in work item DTOs where needed for list, board, detail, and dashboard surfaces.
- Board order is persisted in the database.
- Board move commands must be idempotent enough to handle retry or stale UI scenarios predictably.
- Work item list query parameters must be validated server-side.
- Search should be case-insensitive.
- Due-date state filters must use server time consistently.
- Archived projects block milestone, order, and work item writes.
- Role behavior should follow existing placeholder permissions:
  - owners and maintainers can manage milestones;
  - contributors can assign existing active milestones to work items they can edit if current permissions allow the work item edit;
  - existing work item edit permission rules remain in force.

## UX Requirements

- Milestone management should live close to project settings or planning, not as a global admin screen.
- The board should use the available viewport width and avoid unnecessary horizontal scrolling at common desktop widths.
- Drag handles, placeholders, and moved-card states should be visually clear but restrained.
- Filters should be compact and scannable.
- Dashboard sections should prioritize dense operational information over large decorative cards.
- Text must not overflow controls at laptop and mobile widths.
- Empty states should explain what is missing and offer the next relevant action.
- Do not introduce Angular Material visual styling.

## Data And Reporting Requirements

- Milestone progress should count work items by status.
- Blocked counts should use `status = blocked`.
- Done counts should use `status = done`.
- Overdue work should mean due date before the current date and status not done or canceled.
- Due soon should be configurable in code for v0.0.3, with a default of the next 7 days.
- Stale in-progress should be configurable in code for v0.0.3, with a default of no update in 7 days.
- Summary counts should be deterministic in seed data and tests.

## Quality Requirements

- Add backend tests for:
  - milestone CRUD/lifecycle;
  - milestone assignment;
  - board order mutation;
  - work item query filtering/search/sort;
  - planning summary counts.
- Add frontend unit tests for:
  - milestone controls;
  - filter URL state;
  - board reorder handling;
  - dashboard rendering states.
- Extend e2e smoke coverage for:
  - creating a milestone;
  - assigning a work item to it;
  - filtering by milestone;
  - reordering a board column;
  - checking planning dashboard output.
- Run full verification before release:

```sh
npm run db:reset
npm run db:migrate
npm run db:seed
npm run typecheck
npm test
npm run test:e2e
npm run build
```

## Success Metrics

For v0.0.3, success is qualitative and verification-focused:

- A seeded project can demonstrate milestone planning end to end.
- Board order survives refresh and feels reliable.
- A project with many work items remains navigable through search and filters.
- The planning dashboard identifies useful risks without manual database inspection.
- The implementation reveals reusable patterns worth documenting for `jawstack`.
- Existing v0.0.2 workflows continue to work.

## Risks

- Persisted ordering can become complex if rank updates rewrite many rows or handle stale clients poorly.
- Milestones can drift toward a larger roadmap/portfolio model if scope is not controlled.
- Search/filter UI can become too dense if every filter is always visible.
- Dashboard endpoints can duplicate query logic unless service boundaries are chosen carefully.
- Activity noise can increase if pure reorder events are recorded too aggressively.
- Adding planning fields to every surface can clutter the UI.

## Open Decisions For Technical Design

The technical design should resolve these before implementation:

- Use integer positions with transactional compaction, fractional ranking, or lexicographic ranks for board order.
- Decide whether pure same-column reorders create activity events.
- Decide whether milestone management belongs in project settings, project planning, or both.
- Decide whether milestone completion is manual only or can be suggested from all assigned work being done.
- Decide whether text search should start with `ILIKE` or use Postgres full-text search in v0.0.3.
- Decide whether dashboard data should be one summary endpoint or composed from smaller resource endpoints.

## Recommended Scope Cut If Needed

If v0.0.3 needs to shrink, keep:

1. Milestones.
2. Persisted board ordering.
3. Milestone filter/search basics.
4. Minimal planning dashboard with milestone progress and blocked/overdue lists.

Defer:

- reporter filter;
- stale-work section;
- created-date sort;
- pure reorder activity;
- advanced dashboard cards;
- milestone archive/reactivate polish beyond the core lifecycle.

