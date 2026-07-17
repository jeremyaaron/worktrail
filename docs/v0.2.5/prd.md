# Worktrail v0.2.5 PRD

## Status

Implemented

## Summary

Worktrail v0.2.5 should add Work Breakdown.

Worktrail can now carry a project from discovery through daily execution, dependency-aware planning,
status reporting, cycle operation, and closeout. The remaining gap appears whenever a useful outcome
is larger than one independently actionable work item. Teams can relate work and mark blockers, but
they cannot express that a deliverable contains smaller pieces of work.

That forces users toward one of two weak workarounds:

- keep a broad story or task whose execution details live only in prose or comments; or
- create several independent work items and rely on naming conventions to remember that they belong
  together.

The product theme is **Work Breakdown**. v0.2.5 should introduce a focused, two-level parent/child
model that lets a team decompose one project work item into independently assignable, trackable child
items. The hierarchy should be visible where work is created, reviewed, filtered, exported, and moved,
while preserving Worktrail's existing workflow, cycle, milestone, dependency, activity, and permission
semantics.

This release should not become an epic system, roadmap hierarchy, recursive work tree, or automatic
rollup engine. The goal is to make common decomposition useful and trustworthy before adding deeper
planning structure.

## Context

Worktrail currently supports:

- project-scoped stories, tasks, bugs, and chores;
- stable work item display keys and shareable detail routes;
- create, edit, assignment, estimation, due date, milestone, cycle, label, and workflow controls;
- project and workspace work lists with canonical URL-backed queries;
- personal and shared saved views with pinned shortcuts;
- board movement and persisted ordering;
- directional blocking and symmetric related-work links;
- dependency-aware My Work, Planning, Cycle Review, Milestone Review, reports, and Portfolio signals;
- project batch triage;
- active-cycle planning and transactional cycle closeout;
- comments, mentions, watchers, notifications, and activity history;
- CSV import and filtered CSV export;
- archived-project read behavior and role-aware mutation controls.

Relationships answer whether one item blocks or relates to another. They do not answer whether one
item is part of another. A `relates to` edge is intentionally symmetric and carries no containment or
progress meaning. A `blocks` edge describes execution order, not decomposition. Reusing either would
make both concepts less reliable.

The original MVP left room for a parent or epic link, but Worktrail now has enough real planning and
execution behavior to define a narrower model from evidence. A bounded hierarchy can add substantial
utility without requiring a new work item type or a portfolio taxonomy.

## Problem

Worktrail treats every work item as structurally independent.

Current friction:

- a maintainer cannot break a broad deliverable into smaller assignable work while retaining visible
  ownership of the whole;
- contributors opening a child-sized task cannot see the larger outcome it supports;
- a parent work item cannot show whether its constituent work is open, done, or canceled;
- planning and review pages cannot preserve containment context when they surface a child item;
- work lists and board cards may show several similarly named items with no concise grouping signal;
- teams use titles, descriptions, labels, or `relates to` links as informal hierarchy, but none provides
  enforceable containment;
- creating several children requires repetitive project selection and later manual linking;
- filtered views cannot ask for top-level deliverables, child work, parents with children, or the
  children of one specific item;
- CSV exports cannot retain parent identity for downstream review;
- there is no clear policy for cycles, milestones, estimates, status, or dependencies when work is
  decomposed.

The absence is increasingly visible because Worktrail's other operating surfaces are now coherent.
Teams can commit work to a cycle and close it accurately, but they cannot represent the ordinary
relationship between a user-facing outcome and the tasks needed to deliver it.

This also creates a useful reference-app problem: self-referential data integrity, bounded hierarchy
validation, derived child summaries, canonical hierarchy queries, compact cross-surface context, and
audited mutations without prematurely building a generic tree framework.

## Goals

- Let a project work item have one optional parent in the same project.
- Keep the first hierarchy intentionally limited to two levels.
- Let users create a child directly from a parent detail page.
- Let users assign, replace, or clear a parent on an existing eligible work item.
- Make parent identity and child progress understandable on work item detail pages.
- Show concise hierarchy context on work lists, workspace discovery, the board, and focused review
  surfaces without turning every view into a tree.
- Add canonical hierarchy filters that work with URLs, saved views, pinned views, copy links, return
  URLs, and filtered exports.
- Preserve independent status, assignee, priority, estimate, due date, label, milestone, and cycle
  behavior for every work item.
- Prevent self-parenting, cross-project parenting, recursive depth, and invalid mixed parent/child
  roles.
- Record understandable activity when containment changes.
- Keep archived projects readable and mutation-protected.
- Seed and document a realistic decomposed-deliverable workflow.
- Preserve transport-neutral endpoint handlers and straightforward local setup.

## Non-Goals

- Do not add epics, initiatives, themes, programs, portfolios, or a new work item type.
- Do not allow arbitrary-depth or recursive work item trees.
- Do not let a child contain children in this release.
- Do not let an item with children become a child until its children are removed or reassigned.
- Do not add cross-project or cross-workspace parentage.
- Do not render nested list tables, collapsible tree grids, nested board columns, or hierarchy graph
  visualizations.
- Do not add drag-and-drop parent assignment.
- Do not automatically update parent status when children change.
- Do not automatically update child status when the parent changes.
- Do not cascade assignee, priority, labels, due dates, estimates, milestones, or cycles between parent
  and children.
- Do not store denormalized progress or estimate rollups on the parent.
- Do not treat parent/child containment as a dependency or alter dependency-blocked state.
- Do not add parent-aware critical path, forecasting, capacity planning, or roadmap calculations.
- Do not add query-wide hierarchy mutation or hierarchy changes to project batch triage.
- Do not add parent assignment to CSV import in this release.
- Do not rewrite existing cycle closeout snapshots or published status report snapshots.
- Do not add work item delete/cascade behavior.
- Do not add production authentication, cloud infrastructure, background jobs, or event streaming.

## Target Users

### Project Maintainer

Needs to decompose a deliverable into actionable work, see whether its parts are progressing, and keep
the project backlog understandable without creating a heavyweight planning taxonomy.

### Contributor

Needs to understand the larger outcome behind an assigned task and move between a child and its
parent without searching or relying on title conventions.

### Workspace Owner

Needs containment rules to remain consistent across projects and wants planning totals, activity, and
history to stay explainable when teams begin using hierarchy.

### Individual Power User

Needs reusable filters for top-level outcomes and child work, including personal saved views and
pinned operating shortcuts.

### Reference-App Developer

Needs a production-shaped example of bounded self-referential modeling, domain validation, derived
read data, query integration, activity side effects, and cross-surface Angular presentation without a
generic hierarchy abstraction.

## Product Principles

- **Containment is not dependency:** parent/child explains composition; `blocks` explains execution
  risk; `relates to` explains association.
- **Start with the common depth:** two levels cover deliverable-to-task decomposition while avoiding
  ambiguous recursive rollups and difficult tree interaction.
- **Children remain real work:** a child keeps its own workflow, ownership, planning, collaboration,
  and history.
- **Parents remain real work:** a parent is not a separate container entity and does not require a new
  type.
- **No hidden cascades:** changing one item must not silently rewrite planning or workflow fields on
  another.
- **Derived progress, stored identity:** persist only the parent reference; derive child counts and
  summaries from current work.
- **Context before trees:** show compact parent and child signals in existing surfaces rather than
  replacing reliable lists and boards with nested controls.
- **One canonical query lifecycle:** hierarchy filters must follow the same draft/apply/URL/saved-view
  contract as existing work filters.
- **History stays honest:** current hierarchy may evolve; immutable reports and closeout snapshots
  continue to represent the data their snapshot versions actually captured.
- **No forced methodology:** teams may use a story, task, bug, or chore as either a top-level item or a
  child when valid.

## Scope

### 1. Bounded Parent/Child Model

Add one optional parent reference to a work item.

Requirements:

- A work item may have zero or one parent.
- Parent and child must belong to the same workspace and project.
- A work item cannot parent itself.
- A child cannot have children.
- An item with children cannot be assigned a parent.
- Existing work items begin as top-level items with no parent.
- Existing work item types remain unchanged.
- Parent deletion semantics are out of scope because Worktrail does not currently delete work items.
- The API must reject invalid hierarchy writes even when the client omits or bypasses UI guards.
- Validation errors should identify whether the failure is self-parenting, project mismatch, excessive
  depth, or conflicting child ownership.
- Concurrent writes must not be able to produce a third level or turn both items into children of each
  other.

Acceptance criteria:

- Existing data migrates without behavioral changes.
- A valid same-project top-level item can become another item's parent.
- Self, cross-project, cross-workspace, cyclic, and third-level structures are rejected.
- One item cannot simultaneously be both a child and a parent.
- Reads remain bounded and do not require unrestricted recursive traversal.

### 2. Create Child Workflow

Make decomposition a direct action from parent detail.

Requirements:

- Show `Add child work item` on eligible work item detail pages when creation is allowed.
- Open the existing create workflow with the project and parent preselected.
- Clearly identify the selected parent by display key and title.
- Reuse the existing work item form for title, description, type, status, priority, assignee, reporter,
  labels, milestone, cycle, due date, and estimate.
- Keep normal project, archived-project, actor, and lifecycle capability checks.
- Prevent child creation from an item that is already a child.
- After successful creation, offer established next actions while preserving a clear route back to the
  parent.
- A direct create request may include a valid parent even when it did not originate from the parent
  detail page.

Acceptance criteria:

- A user can create an assigned, estimated child without later linking it manually.
- The child appears on the parent's detail page after creation.
- The child detail page links back to its parent.
- Invalid or stale parent input produces a controlled form/API error.
- Archived projects and actors without create capability cannot create children.

### 3. Manage Parent Assignment

Let users correct or reorganize existing work.

Requirements:

- Add a parent selector to the work item detail editing workflow.
- Search eligible candidates within the current project by display key and title.
- Exclude the current item, existing children, children of another parent, and any other invalid
  candidate from selectable results.
- Permit replacing one valid parent with another valid parent.
- Permit clearing parent assignment.
- Confirm hierarchy changes through the same save/error state quality as other work item edits.
- Revalidate candidate eligibility on the server at save time.
- Do not include parent mutation in the v0.2.5 bulk edit form.

Acceptance criteria:

- A user can assign, replace, and clear an eligible parent.
- Candidate search does not invite invalid structures.
- Stale or crafted requests cannot bypass server validation.
- Clearing a parent does not alter any other work item field.
- An item with children explains why it cannot itself be assigned a parent.

### 4. Work Item Detail Hierarchy

Make containment clear from either side.

Requirements:

- A child detail page should show a compact parent context near its identity or summary.
- Parent context should include display key, title, status, and a link to current parent detail.
- A parent detail page should show a focused `Child work` section.
- The section should show current counts for:
  - total children;
  - open children;
  - done children;
  - canceled children;
  - estimated and unestimated children where useful.
- Child rows should show display key, title, status, priority, assignee, estimate, and dependency risk
  in a scannable layout.
- Provide an `Add child work item` action and a query-backed `View all child work` action.
- Empty parent state should explain the absence concisely without dominating the page.
- A child item must not render a child-work management surface.
- Parent and child navigation must reload route data correctly when both items use the same detail
  route component.

Acceptance criteria:

- Users can move parent-to-child and child-to-parent without stale detail content.
- A parent explains current child execution state without opening every child.
- Child counts change after hierarchy or workflow mutations.
- Detail remains usable on mobile and does not bury primary item actions.

### 5. List, Board, And Review Context

Keep hierarchy visible when work appears outside detail.

Requirements:

- Project and workspace work rows should show a compact parent key for child items.
- Parent items with children should expose a compact child summary without turning the list into an
  expanded tree.
- Board cards should show parent identity for child items.
- Board cards may show a bounded child count for parents when it remains legible.
- Cycle Review, Milestone Review, Planning risk sections, and My Work should retain parent context on
  child rows where their shared DTOs can support it consistently.
- Links should open current work item detail and preserve established return URLs where applicable.
- Hierarchy context must not replace project identity on cross-project surfaces.
- Existing status, priority, assignee, milestone, cycle, due-date, and dependency signals remain more
  prominent when space is constrained.
- Lists and boards remain flat; sorting and board position do not inherit from the parent.

Acceptance criteria:

- A child can be recognized as part of a larger deliverable without opening detail.
- A top-level item without children receives no hierarchy noise.
- Existing list density and mobile card readability do not regress.
- Dragging or transitioning a child does not move or transition its parent.

### 6. Hierarchy Queries And Saved Views

Extend the canonical work query contract.

Requirements:

- Add a visible hierarchy filter with options equivalent to:
  - all work;
  - top-level work;
  - child work;
  - parents with children.
- Add an exact parent filter for query-backed child drill-downs.
- Exact-parent links should identify the selected parent in active filter chips and summaries.
- Support hierarchy query state across:
  - project Work;
  - workspace Work Items;
  - canonical URL serialization and parsing;
  - draft versus applied filter state;
  - active filter chips;
  - saved personal and shared views;
  - pinned views;
  - copy links;
  - return URLs;
  - filtered CSV export.
- Unknown or inaccessible exact parent identifiers should follow established stale-query tolerance and
  controlled error behavior.
- Query combinations should compose with existing status, project, milestone, cycle, assignee,
  dependency, due-date, and sort filters.

Acceptance criteria:

- A saved `Top-level active deliverables` view reloads the same result set and visible filter state.
- `View all child work` opens an applied exact-parent query.
- Hierarchy chips do not appear before the user applies draft filters.
- Copy links and exports describe the applied result set.
- Workspace filtering cannot leak work through a parent outside the current workspace.

### 7. Progress And Planning Semantics

Define hierarchy behavior without hidden rollups.

Requirements:

- Child status counts are derived from current child records.
- `done` counts as done, `canceled` counts separately, and every other status counts as open.
- Show direct child estimate totals only as a labeled child summary.
- Do not overwrite or reinterpret the parent's own estimate.
- Existing project, milestone, cycle, portfolio, and status-report totals continue counting each work
  item record according to current rules.
- The UI and documentation must not imply that a parent estimate is automatically the sum of child
  estimates.
- Parent and child may have different assignees, milestones, cycles, due dates, priorities, and
  statuses.
- Closing a cycle acts on each scoped work item independently through existing cycle assignment. It
  does not infer scope from parentage.
- Completing every child does not complete the parent.
- Completing or canceling the parent does not transition children.
- Dependency health remains based only on `blocks` relationships.

Acceptance criteria:

- Users can distinguish the parent's direct estimate from child estimate totals.
- No existing health or closeout metric silently changes because an item gains children.
- A child in a different cycle or milestone remains visible in the parent's current child summary.
- Existing reports and closeout snapshots remain valid under their current snapshot versions.

### 8. Activity And Notification Behavior

Make hierarchy changes auditable without creating noisy fan-out.

Requirements:

- Record activity when a work item gains, changes, or clears a parent.
- Activity should identify the previous and new parent by stable work item identity where applicable.
- Child creation should retain normal work-created activity and enough metadata to identify its initial
  parent.
- Use existing watched-work-change notification behavior when the command work item's activity is a
  notifiable change.
- Do not automatically watch a parent or child because hierarchy was assigned.
- Do not generate mirrored activity and notifications on every ancestor because the model has only one
  parent level and the command context should remain clear.
- Existing assignment, mention, comment, dependency, and watcher behavior remains unchanged.

Acceptance criteria:

- A work item's History explains when and how its parent changed.
- Hierarchy mutations do not create duplicate notification bursts.
- A hierarchy-only edit does not fabricate dependency activity.
- Activity values remain readable after titles or statuses change later.

### 9. API, Contracts, Persistence, And Documentation Surface

Make the feature explicit and production-shaped.

Requirements:

- Extend shared work item contracts with bounded parent and child summary shapes.
- Include parent identity in list/detail responses where needed without embedding recursive work item
  objects.
- Include a bounded child collection or dedicated child read in detail behavior.
- Add parent input to create and eligible update behavior with explicit `undefined` versus `null`
  semantics.
- Add hierarchy query parameters to the canonical `WorkItemQuery` contract.
- Persist parent identity as a nullable indexed self-reference on work items.
- Keep domain validation in a transport-neutral service boundary.
- Avoid request-per-child enrichment and unbounded list fan-out.
- Document request fields, response shapes, query parameters, validation errors, and examples in
  OpenAPI.
- Add migration, repository, service, endpoint, contract, Angular, and browser coverage proportional
  to the cross-surface change.
- Keep local PostgreSQL reset, migrate, and seed flows deterministic.

Acceptance criteria:

- API consumers can distinguish no parent, parent summary, and child summary without recursion.
- Parent clearing is not confused with an omitted partial-update field.
- List queries remain bounded as child counts are added.
- OpenAPI matches runtime behavior.
- Production build and existing verification remain green.

### 10. Seed Data, Walkthrough, And Release Communication

Demonstrate the hierarchy with credible examples.

Requirements:

- Seed at least one active top-level deliverable with children in mixed workflow states.
- Include varied assignees, estimates, dependency signals, milestone/cycle placement, and at least one
  unestimated child.
- Include one top-level item with no children and one child whose parent is outside the child's current
  cycle or milestone to exercise independent planning semantics.
- Keep seeded hierarchy separate from destructive closeout browser scenarios where necessary.
- Add focused browser smoke for create child, navigate parent/child, filter child work, and clear or
  replace parent.
- Update README capabilities, limitations, demo walkthrough, OpenAPI, package metadata, release notes,
  public site copy, and destination-neutral pattern notes during finalization.
- Do not imply arbitrary hierarchy, epic roadmaps, estimate rollup, or automatic completion.

Acceptance criteria:

- A fresh seed lets a reviewer understand Work Breakdown without constructing data manually.
- The public product description matches the released depth and behavior.
- Documentation clearly separates containment, dependency, and planning assignment.
- Release verification covers desktop and mobile hierarchy presentation.

## User Stories

### Maintainer Decomposes A Deliverable

1. A maintainer opens a broad story.
2. They choose `Add child work item`.
3. Worktrail opens the familiar create form with project and parent already selected.
4. The maintainer assigns and estimates the child and creates it.
5. The parent detail now shows the new child and refreshed current counts.
6. The child detail links back to the parent.

### Contributor Understands Assigned Context

1. A contributor opens My Work.
2. An assigned task shows a compact parent key.
3. They open the task and see the parent title and current status.
4. They can inspect the parent outcome, then return to their task through normal navigation.

### Maintainer Reorganizes Existing Work

1. A maintainer opens an existing top-level task with no children.
2. They search for and select an eligible parent in the same project.
3. Saving records the parent assignment without changing status, cycle, milestone, or ownership.
4. Later, they clear the parent and the item returns to top-level work.

### Team Reviews Top-Level Outcomes

1. A user opens project Work.
2. They select `Top-level work` and apply the filter.
3. The result list contains only parentless items, with child summaries where present.
4. They save and pin the filtered view.
5. Reopening the view restores the URL, chip, and result set.

### Invalid Depth Is Rejected

1. A crafted request tries to assign a parent to an item that already has children.
2. The API revalidates current hierarchy in the transaction.
3. The write is rejected with a specific conflict or validation response.
4. Existing parent references and activity remain unchanged.

## UX Requirements

- Use `Parent` and `Child work` as the primary product language; avoid requiring users to understand
  graph terminology.
- Use display keys as the compact hierarchy signal and titles where enough space exists.
- Keep the parent context near work item identity, not buried in Dependencies.
- Keep `Child work` separate from `Dependencies` so containment and blockers are not conflated.
- Use the existing create form rather than introducing a reduced modal that omits important fields.
- Use searchable candidate selection for parent assignment; do not render an unbounded project-wide
  select.
- Show why parent assignment is unavailable for a child or an item that already has children.
- Keep list and board presentation flat and scannable.
- Do not add a hierarchy symbol without an accessible label or tooltip.
- Preserve stable dimensions for board cards and compact list metadata as hierarchy signals appear.
- Keep active filter pills aligned with applied, not draft, hierarchy state.
- Provide explicit loading, empty, saving, conflict, stale-parent, and retry states.
- On narrow screens, allow hierarchy metadata to wrap below identity without clipping actions or
  replacing higher-priority status information.

## Accessibility Requirements

- Parent and child links must be keyboard reachable and have descriptive accessible names.
- Candidate search must have an associated label, clear result state, and keyboard-operable options.
- Child counts must not rely on color alone.
- Status and dependency signals in child rows must retain text or accessible labels.
- Disabled hierarchy actions must expose understandable nearby reason text.
- Focus should move predictably after create, save, clear, error, and route navigation outcomes.
- Dynamic child-summary updates should use restrained status messaging where needed without repeatedly
  announcing an entire section.
- Hierarchy indentation, icons, or connector styling must not be the only indication of containment.
- Desktop and mobile browser verification should include zoom and long display-key/title behavior.

## Permissions And Lifecycle Rules

- Reading hierarchy follows existing work item and project read access.
- Creating child work follows existing work item creation capability.
- Assigning, replacing, and clearing a parent follows existing work item edit capability.
- Owners and maintainers retain existing broader workflow and bulk-management capabilities; hierarchy
  does not create a new role.
- Contributors do not gain hierarchy mutation where current server capabilities prohibit the
  corresponding work item mutation.
- Inactive actors cannot perform hierarchy writes.
- Archived projects remain readable and block create or hierarchy mutation.
- Candidate lookup must not expose inaccessible workspace or project data.
- Terminal parent or child status does not by itself freeze hierarchy, but existing terminal-work edit
  and reopen rules remain authoritative.
- A hierarchy change must not bypass project, member, milestone, cycle, or workflow validation on the
  same request.

## Data Integrity Expectations

- `parent_work_item_id` is nullable and references a current work item.
- Parent and child workspace/project ownership is validated server-side.
- Self-parenting is rejected at both practical database and domain boundaries where feasible.
- Two-level depth is enforced against current parent and child state in the same transaction as the
  write.
- Concurrent inverse assignments cannot create a cycle.
- Parent changes update the child work item's normal update timestamp.
- Hierarchy activity is created only for committed changes.
- A no-op request does not create duplicate activity or notifications.
- Derived child counts do not become authoritative persisted state.
- Query counts and child summaries must agree on terminal status semantics.
- Existing rows, snapshots, and exports remain readable after migration.

## Technical Expectations

- Keep endpoint handlers adapter-neutral and domain validation in services.
- Prefer a nullable self-reference over a generic relationship edge because containment has stricter
  cardinality and integrity semantics.
- Use set-based or aggregated reads for parent summaries on lists; avoid N+1 child-count queries.
- Keep DTOs shallow: compact parent identity and child summary shapes, not recursive full work items.
- Extend the existing query contract and serialization helpers rather than adding page-local hierarchy
  query parsing.
- Reuse existing work item candidate-search behavior where practical, but enforce same-project and
  eligibility rules explicitly.
- Preserve route reuse safeguards so parent/child navigation reloads detail state.
- Keep hierarchy-specific Angular rendering in focused components if detail/list/board component style
  budgets or readability warrant extraction.
- Add indexes that support parent lookup and project-scoped candidate/query paths.
- Keep migration rollback considerations documented even if production migrations remain forward-only.
- Treat immutable status-report and closeout payloads as versioned historical data; do not silently
  reinterpret them with live hierarchy.

## Success Criteria

The release is successful when:

- a user can create a child from parent detail without manual relinking;
- a user can assign, replace, and clear a valid parent on existing work;
- invalid self, cross-project, cyclic, and third-level hierarchy writes are rejected safely;
- parent and child context is clear on detail pages;
- hierarchy remains recognizable but compact on lists, boards, My Work, and review rows;
- top-level, child, parents-with-children, and exact-parent filters survive apply, reload, save, pin,
  copy, and export workflows;
- parent status, estimate, cycle, milestone, ownership, and dependency state do not change implicitly;
- existing planning, reports, cycle review, and closeout behavior remain correct;
- activity records meaningful hierarchy changes without duplicate noise;
- seeded data demonstrates the feature on a clean local setup;
- focused browser checks pass on desktop and mobile;
- lint, typecheck, API tests, web tests, contract tests, E2E tests, production build, migration/reset/seed,
  and production dependency audit pass.

## Risks And Mitigations

### Hierarchy Expands Into A Planning Taxonomy

Risk: parent/child support quickly accumulates epics, initiatives, levels, custom types, and roadmap
expectations.

Mitigation: ship one generic two-level containment relation with existing work item types. Defer deeper
hierarchy until actual usage demonstrates a specific need.

### Estimates And Progress Become Misleading

Risk: users assume parent estimates are automatic child rollups or that parent completion follows child
completion.

Mitigation: label direct and child estimates separately, show explicit open/done/canceled child counts,
store no rollup fields, and perform no status automation.

### Hierarchy And Dependencies Are Confused

Risk: users expect a child to block its parent or treat `blocks` as containment.

Mitigation: separate detail sections and language, preserve dependency derivation unchanged, and avoid
graph-style hierarchy presentation.

### Cross-Surface DTO Growth Hurts List Performance

Risk: adding parent and child summaries to widely reused rows causes N+1 queries or oversized payloads.

Mitigation: use shallow DTOs and set-based aggregate reads, omit full child collections from list
responses, and verify query counts with representative seed data.

### Concurrent Writes Break The Two-Level Rule

Risk: simultaneous parent assignments create a cycle or third level after each request validates stale
state.

Mitigation: validate within the write transaction, lock the involved rows in stable order where needed,
and add concurrency-focused service/repository tests.

### Flat Surfaces Become Visually Noisy

Risk: parent keys and child counts compete with status, assignee, project, and dependency signals.

Mitigation: use compact conditional metadata, omit empty hierarchy chrome, prioritize existing critical
signals, and verify representative desktop/mobile layouts.

### Snapshot History Appears Incomplete

Risk: old status reports or closeout snapshots do not contain hierarchy context added later.

Mitigation: keep historical payloads versioned and honest. Current links may show current hierarchy, but
the stored snapshot must not claim evidence it did not capture.

### Create Form Becomes More Complex

Risk: another optional field adds cognitive load to global quick capture.

Mitigation: make parent prominent when create is launched from a parent, optional and compact otherwise,
and avoid loading candidate controls until a project is known.

## Deferred Opportunities

- Arbitrary-depth work trees.
- Epics, initiatives, themes, programs, and roadmap hierarchy.
- A dedicated subtask work item type.
- Cross-project parentage.
- Tree-grid work lists and collapsible hierarchy navigation.
- Nested board rendering and hierarchy drag/drop.
- Drag-to-reparent interactions.
- Automatic parent completion or workflow policies.
- Parent-to-child or child-to-parent field synchronization.
- Configurable estimate and progress rollup policies.
- Parent-aware milestone, cycle, portfolio, and report aggregation.
- Parent-aware closeout snapshot versions.
- Hierarchy mutation in batch triage.
- CSV import parent assignment.
- Hierarchy-aware import mapping from third-party trackers.
- Parent watchers, child-change digests, and hierarchy subscriptions.
- Child templates and repeated work breakdown structures.
- Child ordering independent of normal list and board order.
- Dependency inference from hierarchy.
- Hierarchy graph visualization and critical-path analysis.
- Work item deletion and child reparent/cascade policy.

## Open Questions

1. Should a top-level work item be allowed to have its own estimate when it also has estimated children?
2. Should exact-parent filtering be exposed in the standard filter form or only through parent-detail
   drill-down links and active chips?
3. Should child rows on parent detail be returned inside `WorkItemDetailDto` or through a dedicated
   endpoint with independent loading?
4. Should parent changes use the general work item update endpoint or a focused hierarchy command?
5. Which shared review-row DTOs can gain parent context without creating payload or query fan-out?
6. Should creating a child automatically copy milestone or cycle as an explicit form default, while
   still requiring the user to review it?
7. Should hierarchy changes notify only watchers of the changed child, or also watchers of the parent?
8. Should completed or canceled parents remain eligible parents for new children?
9. Should a parent candidate be limited to non-terminal work by default while still allowing an
   explicit terminal selection path?
10. Should CSV export include only `Parent key`, or both parent key and parent title?

## Proposed Defaults For Technical Design

- Allow direct estimates on parents and children; never auto-sum or replace either value. Present child
  estimate totals as a separate derived summary and document that planning totals continue counting
  individual work item records.
- Put the general hierarchy mode in the standard filter form. Keep exact-parent selection primarily a
  drill-down/query capability so the filter form does not need an unbounded parent picker.
- Keep `WorkItemDetailDto` shallow and use a dedicated project-scoped children read if child collections
  would otherwise make every detail load or mapper substantially heavier.
- Accept parent identity on create. Use a focused parent mutation command for existing work if that
  makes null/omitted semantics, locking, activity, and error handling clearer than the general update
  path.
- Add compact parent identity to shared list/review rows through set-based enrichment. Add child summary
  only where a parent-focused surface needs it.
- Do not silently inherit milestone or cycle when creating a child. Pre-fill them only if the create
  form clearly presents the values for review and technical design can preserve normal validation.
- Notify through the changed child's existing watcher path only. Defer parent watcher fan-out until a
  notification preference or digest model exists.
- Permit terminal parents because containment can remain historically valid after delivery. Candidate
  search should rank open work first and label terminal status clearly.
- Export both `Parent key` and `Parent title` so the file remains useful without another lookup. Leave
  CSV import parent assignment deferred.
- Use a nullable indexed `parent_work_item_id` self-reference plus transactional service validation.
  Do not encode containment as a `work_item_relationships` type.
- Keep lists and boards flat. Treat a true hierarchy browser as a later feature requiring its own UX
  and performance design.
