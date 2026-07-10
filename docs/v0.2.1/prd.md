# Worktrail v0.2.1 PRD

## Summary

Worktrail v0.2.1 should add project cycle planning.

The v0.2.0 release consolidated Worktrail into a cleaner operating baseline. Project teams can now scan My Work, process Inbox updates, use reliable workspace and project work views, review milestones, inspect dependencies, run project bulk triage, and publish report snapshots. The next product gap is timeboxed execution.

Milestones answer "what delivery target are we working toward?" Reports answer "what did we communicate at a point in time?" Work lists answer "what work exists?" Worktrail still lacks a focused way to answer:

- What are we committing to in the current operating cycle?
- Is the cycle overloaded, blocked, or missing ownership?
- What changed inside the cycle since the team last reviewed it?
- Which work should roll forward when the cycle closes?

The product theme is Cycle Planning. A cycle is a project-scoped, methodology-neutral timebox. It may represent a sprint, iteration, weekly execution window, release stabilization period, or team-defined planning cadence, but Worktrail should not force Scrum ceremony language.

v0.2.1 should add enough cycle support to make Worktrail more useful for real team operation:

- create and manage project cycles;
- assign work items to one cycle;
- filter, save, pin, export, and bulk-edit by cycle;
- review current and upcoming cycle scope from Planning;
- open a focused cycle review surface;
- include current cycle context in generated project reports;
- seed deterministic cycle examples;
- update documentation and tests.

The release may also include the already-identified work item detail route-refresh bugfix, where navigating between related tickets on `/work-items/:id` should reload the selected ticket instead of leaving stale detail content on screen.

## Context

Worktrail already supports:

- project milestones with due dates and lifecycle state;
- milestone review pages with derived health, scope, risk, and recent movement;
- project Planning with live delivery health;
- project Reports with immutable published snapshots;
- work item estimates;
- due dates, priorities, assignees, labels, statuses, comments, watchers, notifications, relationships, and activity;
- project bulk triage;
- reliable query-backed Work views with saved views, pinned shortcuts, copy links, return URLs, and CSV export.

Cycles should reuse those foundations. The feature should not introduce a parallel planning universe. A cycle should be another operating lens over project work: timeboxed, reviewable, queryable, and actionable through the existing Work surface.

## Problem

Worktrail has delivery targets and work discovery, but not execution cadence.

Current friction:

- teams cannot represent the current short-term planning window except by labels, due dates, or ad hoc saved views;
- milestones are too broad for day-to-day cycle commitments;
- due dates show urgency but do not represent scope commitment;
- project bulk triage can update many fields, but there is no first-class "commit this work to the current cycle" workflow;
- Planning has milestone progress, risk, and recent movement, but no cycle progress or carryover context;
- Reports can preserve project and milestone state, but not the team's current operating cycle;
- saved views can approximate cycle-like queues, but they are not durable planning objects with dates, goals, or lifecycle.

For teams evaluating Worktrail as a product, cycle planning is a high-utility feature. For Worktrail as a reference app, it provides useful evidence for adding a real relational feature that cuts across persistence, contracts, API handlers, query state, forms, bulk mutations, derived review surfaces, report snapshots, seed data, and tests.

## Goals

- Add project-scoped cycles with a clear lifecycle.
- Let owners and maintainers create, update, complete, cancel, and archive cycles.
- Let contributors read cycles and cycle review data.
- Let one work item belong to at most one cycle.
- Let work items keep milestone assignment independently from cycle assignment.
- Let users assign cycle on work item create/edit.
- Add project bulk actions to set and clear cycle.
- Add cycle filtering to workspace and project work lists.
- Preserve query-backed behavior for cycle filters:
  - active chips;
  - copy links;
  - return URLs;
  - saved views;
  - pinned views;
  - CSV export.
- Add current/upcoming cycle summaries to project Planning.
- Add a focused cycle review page with scope, progress, risk, and recent movement.
- Include active cycle context in generated project report drafts and published snapshots.
- Seed realistic active, upcoming, completed, and at-risk cycle examples.
- Cover the feature through API, web, and E2E tests.
- Document the release and capture destination-neutral pattern notes.

## Non-Goals

- Do not add Scrum ceremony management, standup workflows, retrospectives, planning poker, or velocity charts.
- Do not add automatic sprint/cycle generation.
- Do not add member-level capacity calendars.
- Do not add cross-project cycles or workspace-wide program increments.
- Do not add roadmap, Gantt, timeline, critical path, or forecasting views.
- Do not add hierarchy/epic/initiative modeling in this release.
- Do not add custom workflow states.
- Do not add automation rules for moving work between cycles.
- Do not add background jobs for cycle rollover.
- Do not force every project to use cycles.
- Do not require a cycle for work item creation.
- Do not replace milestones; cycles and milestones serve different jobs.
- Do not add cycle-specific comments or approvals.
- Do not add production authentication or deployment automation.

## Target Users

### Project Maintainer

Plans and adjusts the current operating window. Needs to create cycles, commit work, inspect overload/risk, move incomplete work forward, and publish reports with current cycle context.

### Contributor

Needs to understand what is in the current cycle, which assigned work matters now, and what is blocking the team, without seeing mutation controls they cannot use.

### Workspace Owner

Wants projects to run consistent execution cadences and wants reports to communicate whether current commitments are healthy.

### Individual Power User

Uses saved views, pinned views, filters, and My Work to focus on current commitments. Needs cycle filters to behave like every other reliable work query dimension.

### Reference-App Developer

Studies Worktrail as a full-stack reference. Needs a feature that demonstrates adding a relational planning object across database schema, contracts, API services, Angular forms, query state, bulk mutation, reporting, seed data, and tests without over-abstracting.

## Product Principles

- **Cycles are execution windows:** they should help teams decide what is committed now, not replace long-term milestones.
- **Methodology-neutral language:** use `Cycle`, not `Sprint`, unless user-entered names choose otherwise.
- **Commitment is explicit:** adding work to a cycle should be a clear assignment, not inferred only from due dates.
- **Review routes to action:** cycle review should summarize and link into filtered project Work for triage.
- **Queries remain contracts:** cycle filters must participate in the same URL/query/saved-view/export contract as existing filters.
- **No forced process:** projects can operate without cycles.
- **Small capacity first:** target points and actual estimates are enough for v0.2.1; individual capacity calendars are deferred.
- **Keep milestones distinct:** milestones express delivery targets; cycles express timeboxed execution.

## Scope

### 1. Project Cycle Model And Lifecycle

Add project-scoped cycles.

Requirements:

- Cycle fields:
  - id;
  - workspace id;
  - project id;
  - name;
  - goal;
  - status;
  - start date;
  - end date;
  - target points;
  - archived timestamp;
  - created/updated timestamps.
- Supported statuses:
  - `planned`;
  - `active`;
  - `completed`;
  - `canceled`.
- Owners and maintainers can create, update, complete, cancel, archive, and reactivate cycles on active projects.
- Contributors can read cycles but cannot mutate them.
- Archived projects expose cycles as read-only.
- A project may have at most one active cycle at a time.
- Non-archived cycle date ranges in the same project should not overlap unless the technical design identifies a strong reason to allow it.
- Target points are optional and represent rough cycle-level capacity, not a member-level schedule.

Acceptance criteria:

- A project maintainer can create an upcoming cycle with a goal, start date, end date, and optional target points.
- A project maintainer can activate one cycle and is blocked from activating a second overlapping/current active cycle.
- Contributors can open cycle lists/review pages without mutation controls.
- Archived projects and archived cycles are readable.
- Invalid cross-project or cross-workspace cycle references do not leak data.

### 2. Assign Work To Cycles

Let work items belong to one cycle.

Requirements:

- Add optional `cycleId` to work item create and update flows.
- Add cycle assignment on:
  - global work item create after project selection;
  - project-scoped work item create;
  - work item detail edit form.
- Show cycle metadata on:
  - work item detail summary/metadata;
  - work item result rows/cards;
  - project board cards where space allows.
- Preserve milestone assignment independently from cycle assignment.
- Prevent assigning work to an archived cycle, except retaining an already-assigned archived cycle when editing unrelated fields.
- Prevent assigning work to a cycle from another project or workspace.
- Record activity when a work item's cycle changes.
- Include cycle changes in watcher/work item update notifications if existing notification policy covers planning-field changes.

Acceptance criteria:

- A maintainer can create a work item directly in an active cycle.
- A maintainer can move an existing work item into or out of a cycle.
- A work item can have both a milestone and a cycle.
- Detail, list, and board surfaces display the assigned cycle consistently.
- Activity records previous and next cycle when cycle assignment changes.

### 3. Cycle Filters, Saved Views, And Export

Add cycle as a first-class work query dimension.

Requirements:

- Add `cycleId` to workspace and project work item query contracts.
- Add cycle filter controls to:
  - top-level Work Items;
  - project Work.
- Add active filter chips such as `Cycle: v0.2.1 Build`.
- Preserve cycle query state across:
  - reload;
  - copy link;
  - saved view open;
  - pinned view open;
  - return URL;
  - CSV export.
- Include cycle information in CSV export.
- CSV import should not be required to assign cycles in v0.2.1 unless the technical design finds it very low risk. If deferred, documentation should state that cycle assignment through CSV is not yet supported.
- Saved-view summaries should count cycle as a meaningful filter.
- Existing saved views without cycle filters should continue to load.

Acceptance criteria:

- Opening a cycle-filtered URL reloads the same result set and active chip.
- Saving and pinning a cycle-filtered view preserves the cycle filter.
- CSV export from a cycle-filtered view matches the visible results.
- Existing query tests cover cycle serialization.

### 4. Project Bulk Cycle Triage

Extend project bulk triage with cycle assignment.

Requirements:

- Add bulk actions:
  - set cycle;
  - clear cycle.
- Scope cycle options to the current project.
- Exclude archived cycles from assignable options unless the item is already assigned and the action is not changing cycle.
- Preserve existing bulk edit mode:
  - explicit `Bulk edit`;
  - hidden selection until mode entry;
  - result counts;
  - partial-success behavior.
- Preserve permission and archived-project restrictions.

Acceptance criteria:

- A maintainer can filter project work, enter bulk edit, select visible rows, set a cycle, and see updated result counts.
- Clearing cycle removes cycle assignment from selected work.
- Contributor and archived-project paths remain read-only.

### 5. Planning Cycle Overview

Add cycle awareness to project Planning.

Requirements:

- Add a `Cycles` planning view or a cycle section inside the existing Planning Review, depending on technical design.
- Show current cycle summary when one exists:
  - name;
  - goal;
  - date range;
  - days remaining;
  - target points;
  - committed estimate points;
  - completed estimate points;
  - open work count;
  - blocked/dependency-blocked count;
  - unassigned active count.
- Show upcoming cycle summary when one exists.
- Show recently completed cycle summary if useful and compact.
- Link cycle names to cycle review.
- Link cycle risk counts into filtered project Work with `cycleId` plus the relevant risk query where possible.
- Provide empty state copy for projects without cycles.

Acceptance criteria:

- Planning communicates current cycle health without requiring a separate work-list filter.
- A maintainer can move from Planning to cycle review or filtered cycle work in one click.
- Contributor read paths are useful and mutation-free.

### 6. Cycle Review Surface

Add a focused review page for one cycle.

Candidate route:

```text
/projects/:projectId/cycles/:cycleId
```

Requirements:

- Show cycle identity:
  - name;
  - goal;
  - status;
  - date range;
  - target points;
  - archived state;
  - project key/name.
- Show progress:
  - total scoped work;
  - open work;
  - done work;
  - blocked work;
  - dependency-blocked work;
  - committed estimate points;
  - completed estimate points;
  - unestimated work count.
- Show cycle risk sections:
  - blocked work;
  - dependency-blocked work;
  - overdue work;
  - due soon;
  - unassigned active work;
  - stale in-progress work;
  - blocking open work.
- Show recently changed cycle work.
- Link to filtered project Work for:
  - all cycle work;
  - each representable risk section.
- Link work item rows to detail with a return URL back to cycle review.
- Preserve project shell context and responsive layout.

Acceptance criteria:

- A direct cycle review URL reloads.
- Cycle review shows scope, progress, risk, and recent movement for only that cycle.
- Risk links open project Work with visible active chips.
- Work item detail return links preserve cycle review context.
- The page remains valuable for contributors and archived projects.

### 7. Report Integration

Include cycle context in generated project reports.

Requirements:

- Add active cycle snapshot data to generated report drafts when a project has an active cycle.
- Snapshot fields should include:
  - cycle identity;
  - date range;
  - goal;
  - status;
  - target points;
  - committed/completed estimate points;
  - open/blocked/dependency-blocked counts;
  - top cycle risks or a compact cycle risk summary.
- Published reports should preserve cycle snapshot data immutably.
- Markdown export should include cycle snapshot content when present.
- Existing reports without cycle snapshot data remain readable.
- Runtime snapshot validation should version or tolerate optional cycle data as defined by technical design.

Acceptance criteria:

- New report drafts include active cycle context.
- Published report detail and Markdown export show the cycle snapshot.
- Existing seeded/pre-v0.2.1 report snapshots continue to parse and render.

### 8. Seed Data And Demo Walkthrough

Add deterministic cycle examples.

Requirements:

- Seed Worktrail App with:
  - one active cycle;
  - one upcoming cycle;
  - one completed cycle;
  - at least one cycle with blocked/dependency-blocked work;
  - at least one cycle with unestimated or unassigned work;
  - a mix of cycle work also assigned to milestones.
- Seed at least one saved or pinned view that demonstrates cycle filtering if useful.
- Keep seed data deterministic and stable for E2E.
- Update README walkthrough to include cycle planning and review.

Acceptance criteria:

- Fresh seed data supports a full cycle planning demo.
- Browser smoke tests can rely on deterministic cycle names and work item assignments.

### 9. Documentation, Release Notes, And Pattern Notes

Document the release.

Requirements:

- Add or update:
  - v0.2.1 technical design;
  - v0.2.1 implementation plan;
  - v0.2.1 release notes during finalization;
  - v0.2.1 pattern notes during finalization;
  - README;
  - public site if cycle planning should be promoted in current product copy;
  - OpenAPI for changed routes/contracts.
- Pattern notes should remain destination-neutral and may cover:
  - timeboxed planning objects;
  - query-backed planning dimensions;
  - derived cycle review surfaces;
  - lifecycle constraints such as one active cycle;
  - optional report snapshot sections;
  - cross-surface feature introduction.
- Mention the work item detail route-refresh bugfix in release notes as a reliability fix if it remains part of v0.2.1.

Acceptance criteria:

- Documentation matches implemented behavior.
- Public copy does not imply forecasting, velocity, or production deployment capabilities that do not exist.
- OpenAPI remains accurate.

## User Stories

### Maintainer Plans The Current Cycle

As a project maintainer, I create an active cycle, assign ready work into it, and review committed scope so the team has a clear execution window.

Acceptance criteria:

- Maintainer can create and activate a cycle.
- Maintainer can assign work through create/edit and bulk edit.
- Planning shows the active cycle summary.
- Cycle review shows committed scope and risk.

### Contributor Finds Current-Cycle Work

As a contributor, I filter Work Items to the active cycle and save or open a shared cycle view so I can focus on what matters now.

Acceptance criteria:

- Contributor can use cycle filters.
- Cycle filter survives reload and copy-link.
- Contributor can open shared/pinned cycle views but cannot manage shared views.

### Maintainer Reviews Cycle Risk

As a project maintainer, I open cycle review, inspect blocked or unassigned work, and follow a risk link into project Work to bulk triage the issue.

Acceptance criteria:

- Cycle review shows risk sections.
- Risk link opens filtered project Work.
- Bulk edit remains available for owners/maintainers on the destination Work page.

### Owner Publishes Status With Cycle Context

As a workspace owner, I publish a project report that includes current cycle context so stakeholders understand whether current commitments are healthy.

Acceptance criteria:

- Report draft includes active cycle snapshot data.
- Published report preserves the cycle snapshot.
- Markdown export includes cycle context.

### Developer Adds A Cross-Surface Planning Object

As a developer, I can trace cycle support from schema through contracts, API, Angular forms, query state, report snapshots, seed data, and tests without guessing ownership boundaries.

Acceptance criteria:

- New cycle contracts are typed and documented.
- API handlers remain transport-neutral.
- Feature tests cover query, mutation, review, and report integration.
- Existing milestone behavior remains intact.

## UX Requirements

- Keep cycle language plain and methodology-neutral.
- Avoid a separate top-level navigation item for cycles unless the technical design proves Planning cannot house the workflow cleanly.
- Use compact, work-focused layouts:
  - summary metrics;
  - risk sections;
  - work previews;
  - clear action links.
- Keep Planning dense but readable.
- Do not create a marketing-style cycle dashboard.
- Ensure long cycle names, goals, work item titles, member names, and labels wrap without overlap.
- Make active/published/current wording clear:
  - cycle review is live current state;
  - report cycle sections are published snapshots.
- Keep mobile layouts usable without hiding primary cycle actions behind unclear controls.

## Permissions And Lifecycle

- Owners and maintainers can mutate cycles and cycle assignment on active projects.
- Contributors can read cycles, cycle review, cycle-filtered work, and report cycle snapshots.
- Archived projects block cycle mutation and cycle assignment changes.
- Archived cycles remain visible but are not assignable to new work.
- Completed and canceled cycles remain reviewable.
- One active cycle per project should be enforced.
- Date overlap validation should protect normal planning use without blocking read access to historical data.

## Data And Migration Expectations

v0.2.1 is expected to require a database migration.

Expected schema additions:

- `project_cycles` table or equivalent;
- optional `cycle_id` foreign key on work items;
- relevant indexes for project cycle listing and work item cycle filtering.

Expected data behavior:

- deleting cycles is not required; archive/reactivate is sufficient;
- work item cycle assignment should use nullable foreign keys;
- existing work items should migrate with no cycle assignment;
- existing reports should remain readable without cycle snapshot sections.

## API Expectations

Candidate additions:

```text
GET    /api/projects/:projectId/cycles
POST   /api/projects/:projectId/cycles
GET    /api/projects/:projectId/cycles/:cycleId
PATCH  /api/projects/:projectId/cycles/:cycleId
POST   /api/projects/:projectId/cycles/:cycleId/archive
POST   /api/projects/:projectId/cycles/:cycleId/reactivate
GET    /api/projects/:projectId/cycles/:cycleId/review
```

Existing routes likely need extension:

- work item create/update request/response DTOs;
- work item list query DTOs;
- project bulk update action DTOs;
- project planning summary DTOs;
- project report draft/detail snapshot DTOs;
- Markdown export rendering.

OpenAPI should document all new routes, query parameters, request bodies, response bodies, and relevant error cases.

## Test Strategy

Required coverage:

- Contract tests for:
  - cycle DTOs;
  - cycle query serialization;
  - bulk cycle actions;
  - report snapshot compatibility.
- API tests for:
  - cycle CRUD and lifecycle;
  - one-active-cycle validation;
  - date overlap validation;
  - permissions and archived-project behavior;
  - work item create/update cycle assignment;
  - cycle filter query;
  - project bulk set/clear cycle;
  - cycle review derivation;
  - report draft/detail/Markdown cycle snapshot behavior;
  - invalid cross-project/cross-workspace ids.
- Web tests for:
  - cycle forms and lists;
  - Planning cycle summary;
  - cycle review rendering and links;
  - work item create/detail cycle fields;
  - work-list cycle filters, chips, saved views, pinned views, and export links;
  - project bulk cycle actions;
  - report cycle snapshot display.
- E2E smoke coverage for:
  - creating or opening a seeded cycle;
  - assigning work into a cycle;
  - filtering/saving a cycle view;
  - opening cycle review;
  - following a cycle risk link into project Work;
  - publishing or reading a report with cycle context.
- Regression coverage for:
  - milestone assignment still works;
  - milestone review remains intact;
  - work item detail route-refresh bugfix remains covered.

Suggested final verification:

```sh
npm run lint
npm run typecheck
npm run db:reset
npm run db:migrate
npm run db:seed
npm test
npm run build
npm run test:e2e
git diff --check
git status --short --branch
```

## Success Metrics

Worktrail is still a local reference app, so success is measured through workflow completeness and implementation quality:

- A seeded active cycle can be reviewed from Planning and by direct URL.
- A maintainer can assign multiple work items into a cycle through bulk edit.
- Cycle filters are reloadable, shareable, savable, pinnable, and exportable.
- Cycle review explains progress, committed estimate points, risk, and recent movement without manual filter reconstruction.
- Report drafts and published snapshots include active cycle context.
- Contributors can understand cycle scope without mutation controls.
- Existing milestones, reports, saved views, bulk triage, and work item detail behavior remain intact.

## Risks And Mitigations

### Risk: Cycles Duplicate Milestones

Mitigation: keep milestones as delivery targets and cycles as execution timeboxes. UI copy should explicitly distinguish the two.

### Risk: Scope Creep Toward Agile Tooling

Mitigation: avoid Scrum ceremony features, velocity charts, capacity calendars, and automatic cycle generation. Use target points and committed estimates only.

### Risk: Query Model Expansion Breaks Existing Views

Mitigation: add cycle as an optional query field, keep defaults quiet, and cover serialization with tests.

### Risk: Report Snapshot Compatibility Breaks Existing Reports

Mitigation: make cycle snapshot data optional and version/tolerate absent cycle sections in the parser.

### Risk: Planning Page Becomes Too Dense Again

Mitigation: keep cycle summary compact, route detail into cycle review, and preserve v0.2.0's operating-surface hierarchy.

### Risk: Database Migration Adds Cross-Surface Complexity

Mitigation: introduce minimal relational schema, avoid deletes, keep work item assignment nullable, and seed deterministic examples.

## Open Questions

- Should the user-facing Planning tab be named `Cycles`, `Current cycle`, or `Iterations`?
- Should date overlap validation block all non-archived overlap or only active/planned overlap?
- Should cycle assignment be included in CSV import in v0.2.1 or deferred while CSV export includes cycle names?
- Should report snapshots include only active cycle summary or also upcoming cycle summary?
- Should cycle target points be integer-only, or should they reuse the existing estimate point numeric behavior exactly?

## Recommendation

Proceed with project cycles as the v0.2.1 feature.

This is the right next step after v0.2.0 because it adds real product utility while exercising many of Worktrail's established patterns:

- relational planning objects;
- lifecycle management;
- query-backed work views;
- saved operating lenses;
- explicit bulk mutation;
- derived review surfaces;
- immutable report snapshots;
- deterministic seed data;
- full-stack verification.

The scope should stay disciplined: cycles should make current execution commitments visible and actionable, not turn Worktrail into a forecasting, scheduling, or agile ceremony platform.
