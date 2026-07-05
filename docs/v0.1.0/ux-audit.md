# Worktrail v0.1.0 UX Audit

## Summary

Worktrail has reached the point where the individual features are credible, but the product structure still reflects the order the features were added. The main UX opportunity for v0.1.0 is not more capability. It is making the existing capabilities feel like a coherent operating system for project work.

The app already has useful primitives: My Work, cross-project discovery, saved views, project overview, planning health, milestone progress, board, detail editing, relationships, comments, activity, CSV import/export, and workspace governance. The current friction is that users have to learn where each feature was added instead of following a stable mental model.

Recommended v0.1.0 theme:

> Make Worktrail feel organized around daily work, project operation, and administration.

## Audit Basis

This audit reviewed:

- `README.md` and sprint PRDs through `docs/v0.0.9`.
- Angular route structure and page components under `apps/web/src/app`.
- E2E smoke coverage in `e2e/worktrail-smoke.spec.ts`.
- A seeded local run of the API and web app at common desktop, tablet, and mobile widths.

No product files were modified other than this audit document.

## Highest-Impact Recommendations

### 1. Introduce a Persistent Project Shell

Project pages currently repeat local navigation in each route header, with small variations across overview, list, board, planning, import, and settings. This makes every project route feel like a separate page rather than one project workspace.

Recommendation:

- Add a shared project shell for all `/projects/:projectId/*` routes.
- Keep project name, key, status, and health visible in one persistent project header.
- Add a consistent project subnav: `Overview`, `Work`, `Board`, `Planning`, `Settings`.
- Keep active state visible in the subnav.
- Put project-scoped actions in a predictable action area: `Create`, `Import`, `Export`, archive/read-only notices.

Why this matters:

- Users should always know which project they are in.
- Moving from list to board to planning should feel like changing views, not navigating to unrelated pages.
- It reduces the repeated header/action code and clarifies where future project features belong.

Suggested v0.1.0 acceptance check:

- From any project page, a user can tell the project, current section, project status, and primary available action without scanning the whole page.

### 2. Rebalance Planning Around Review First, Administration Second

Planning is the most overloaded page. The left side is dominated by milestone creation and inline milestone editing, while the decision-making content, delivery health, needs attention, upcoming, recently changed, and risk sections, is compressed into a narrow right column.

Recommendation:

- Make `Planning` default to a review-first layout.
- Put delivery health, needs attention, upcoming, recently changed, and milestone progress in the main content column.
- Move milestone create/edit into a secondary `Milestones` tab, drawer, or management section below the review content.
- For contributors and read-only archived projects, render milestones as compact read-only summaries instead of disabled form controls.
- Collapse detailed risk lists behind each review section after showing top reasons and counts.

Why this matters:

- Planning should answer "what needs attention?" before "edit milestone fields."
- Delivery health was added to reduce mental aggregation, but the current layout still asks users to hunt through a long page.
- Milestone administration is important, but it is not the primary weekly planning workflow.

Suggested structure:

- `Planning Review`: health state, top reasons, next actions, upcoming, recently changed.
- `Milestone Progress`: active/planned milestones with progress, health, and reason chips.
- `Risk Lists`: expandable detailed lists for blocked, overdue, dependency-blocked, blocking, unassigned, stale.
- `Milestone Management`: create/edit/archive/reactivate milestones.

### 3. Make Workspace Work Items the Cross-Project Hub

Cross-project work discovery is powerful, but it is under-positioned. The global nav has `Workspace`, which opens settings, while the actual workspace work item hub is reached through `My Work` or direct URL. On the page itself, saved-view management takes the first large panel, pushing filters and results down.

Recommendation:

- Promote cross-project `Work Items` to a top-level destination, or make `Workspace` a section with visible `Work Items` and `Settings` subnav.
- Make the result list and active filters the primary surface.
- Convert saved views from a full management table into a compact control:
  - view picker;
  - `Save view`;
  - `Manage views` drawer or secondary panel.
- Keep rename/update/delete out of the default scanning path.
- Group filters into `Core` and `Advanced`:
  - Core: search, project, status/state, assignee, due date, dependency, sort.
  - Advanced: reporter, type, label, milestone, blocked flag, archived mode.

Why this matters:

- Discovery should feel like the main workspace command center, not a saved-view admin screen.
- Users returning to a saved view want to open it quickly, not see every management control every time.
- Filter density is high enough that progressive disclosure will improve comprehension without removing power.

### 4. Turn My Work Into a Prioritized Daily Queue

My Work has good summary cards and useful sections, but the same item can appear repeatedly across assigned, due soon, blocked, and recently updated sections. This is accurate but increases scan cost.

Recommendation:

- Make the default first section `Needs attention`, combining overdue, blocked, dependency-blocked, due soon, and stale assigned work.
- Keep summary cards as clickable filters, but use them to change the queue view instead of duplicating all categories down the page.
- Hide empty low-signal sections by default, or collapse them into a compact "No dependency blockers" state.
- Add section-level sort intent: due date for due work, priority for blocked work, updated date for recent work.
- Consider a `Reported by me` secondary tab rather than a full default section.

Why this matters:

- Daily users need the next few things to act on, not every valid categorization of the same work.
- My Work should be the fastest path to action in the product.

### 5. Create Responsive Card Layouts for Work Lists

The desktop work item tables are information-rich, but the mobile result list is hard to scan. At narrow widths the table-like layout preserves many concepts but loses the clear column relationships; users see fragments of right-side data rather than a purpose-built compact row.

Recommendation:

- Keep table layout for desktop.
- Switch project and workspace work item lists to card rows on small screens.
- On mobile, each card should show:
  - title and display key;
  - project, when cross-project;
  - status and priority;
  - assignee;
  - milestone and due date;
  - dependency signal, if present.
- Move less common metadata into a secondary line or detail view.

Why this matters:

- The app passes basic overflow checks, but "no overflow" is not the same as mobile readability.
- Work item rows are the core scanning unit; they should be intentionally designed for each width.

## Page-Level Recommendations

### Project Overview

What works:

- The page gives a quick project identity, status counts, delivery health, and recent updates.
- Delivery-health reasons link into filtered work lists, which is the right pattern.

Recommended changes:

- Add a small `Needs attention` preview above or inside the delivery health panel.
- Reduce repeated health labeling, such as `Delivery health / Blocked / Blocked`.
- Add clearer reason destinations: `View dependency-blocked work`, `Open blocked milestone`, `View blocked work`.
- Make `Recently updated` communicate what changed, not only which item changed.

### Planning

What works:

- The page contains the right planning information.
- Health reasons, milestone health, and risk lists are explainable and actionable.

Recommended changes:

- Move review content above milestone editing.
- Make health reasons and review sections the scanning spine of the page.
- Convert risk metric tiles into navigation for the review/risk sections.
- Collapse long lists after a small number of items.
- Separate milestone management from planning review.

### Project Work Items

What works:

- Filtering is comprehensive.
- Active filter pills help users understand current state.
- Import/export are appropriately scoped to project work.

Recommended changes:

- Use a shared filter component with workspace discovery so behavior and labels stay consistent.
- Add saved views to project work items if project-specific filters are expected to recur.
- Put import/export under a compact secondary action group if the header becomes crowded.
- Add a visible "showing N of M" summary if the API can support total counts later.

### Workspace Work Items

What works:

- This is the strongest cross-project discovery surface.
- Saved views are useful and persist across reloads.

Recommended changes:

- Promote this page in navigation.
- Make saved views compact by default.
- Put the result list closer to the top.
- Add removable active filter chips.
- Clarify the difference between `Blocked` and `Dependency` filters in helper text or labels.

### Board

What works:

- Status columns are direct and understandable.
- Drag/drop plus status menus support both pointer and form-based changes.

Recommended changes:

- Add quick filters for assignee, milestone, label, and dependency state.
- Make dependency-blocked and blocking-open-work signals more prominent on cards.
- Consider hiding terminal columns behind a toggle when `done` and `canceled` grow large.
- Replace the `Move` text button with a clearer drag handle affordance while keeping accessible text.
- Add a compact board header summary: open, blocked, dependency-blocked, due soon.

### Work Item Detail

What works:

- The detail page is functionally complete.
- Relationships, comments, and activity are all in one place.
- Archived/read-only and terminal permissions are surfaced.

Recommended changes:

- Shift from edit-first to read-first:
  - show status, assignee, milestone, due date, priority, labels, and dependency state near the title;
  - allow editing inline or through an `Edit details` mode.
- Preserve return context instead of a generic `Back to list`; users should return to the filtered list or board they came from.
- Elevate relationship health in the header when an item is blocked or blocking others.
- Move activity closer to comments or use tabs if the page continues to grow.

### Project Settings

What works:

- Metadata, lifecycle, labels, and project activity are grouped in a conventional admin surface.

Recommended changes:

- Use internal section tabs or anchors if label lists grow.
- Keep destructive lifecycle actions visually separated from routine metadata edits.
- Add stronger confirmation context for archive actions if archived projects become more common in demos.

### Workspace Settings

What works:

- Role summary, member management, and activity are useful for governance walkthroughs.
- Permission messaging is clear.

Recommended changes:

- Rename global `Workspace` nav if it continues to point directly to settings. `Workspace` currently sounds broader than administration.
- If the nav becomes a workspace section, use `Workspace > Work Items` and `Workspace > Settings`.
- Consider splitting member creation from member table editing if the member list grows.

## Navigation Model Recommendation

Current primary navigation:

- `My Work`
- `Projects`
- `Workspace`
- `Create work item`

Recommended primary navigation for v0.1.0:

- `My Work`
- `Work Items`
- `Projects`
- `Workspace Settings`
- `Create`

Alternative if you want to preserve `Workspace`:

- `My Work`
- `Projects`
- `Workspace`
  - `Work Items`
  - `Members`
  - `Settings`
- `Create`

Project-level navigation:

- `Overview`
- `Work`
- `Board`
- `Planning`
- `Settings`

This model gives each feature a clearer home:

- Daily execution: `My Work`.
- Cross-project discovery: `Work Items`.
- Project operation: project shell.
- Administration: workspace/project settings.
- Creation: global `Create`, with project-scoped defaults when inside a project.

## Terminology Recommendations

Several labels are accurate but close enough to create cognitive load:

- `Blocked` can mean a work item status.
- `Blocked by open work` means dependency-blocked.
- `Blocking open work` means this item is upstream of another item.
- `Dependency blocked` appears in some summaries.

Recommendation:

- Use `Status: Blocked` when referring to status.
- Use `Blocked by dependency` for downstream blocked work.
- Use `Blocking other work` for upstream blockers.
- Use those same terms across My Work, filters, planning, board cards, and health reasons.

Also consider simplifying:

- `Workspace work items` -> `Work Items`.
- `Planning dashboard` -> `Planning Review`.
- `Dep blocked` -> `Dependency blocked` or `Blocked by dependency`.

## Visual Hierarchy Recommendations

The UI is consistent and restrained, but many pages rely on the same panel/card treatment for every section. As scope grows, equal visual weight makes users do extra interpretation.

Recommendations:

- Use one primary panel per page for the main job.
- Use smaller secondary panels for supporting metadata and administration.
- Reduce nested controls in default views, especially inline rename/edit forms.
- Reserve strong color for status, priority, and risk.
- Use section spacing and heading size to distinguish page, section, and item hierarchy.
- Prefer compact management controls behind explicit `Manage` actions.

## Responsive UX Recommendations

The sampled pages render without page-level horizontal overflow, but mobile needs more intentional layouts.

Recommendations:

- Convert work item tables to mobile cards.
- Put filters behind a `Filters` button or collapsible panel on mobile.
- Keep active filter chips visible above results.
- Avoid showing full saved-view management controls before results on mobile.
- Keep the actor selector available, but make it less dominant in mobile top navigation.
- Consider a compact project subnav that scrolls horizontally with clear active state.

## Suggested v0.1.0 Work Plan

### Phase 1: Information Architecture

- Promote cross-project work discovery in primary navigation.
- Add a shared project shell and project subnav.
- Normalize naming for workspace settings and work items.

### Phase 2: Planning Consolidation

- Rebuild planning as review-first.
- Move milestone management out of the primary scanning path.
- Collapse detailed risk lists and keep top reasons visible.

### Phase 3: Discovery Streamlining

- Compact saved views.
- Split core and advanced filters.
- Add removable filter chips.
- Share project/workspace filter patterns.

### Phase 4: Daily Workflow Polish

- Rework My Work around a prioritized queue.
- Add mobile card rows for work item lists.
- Improve return-context behavior from detail pages.

## Success Criteria

v0.1.0 should feel successful if:

- A new user can explain the app structure after visiting three pages.
- A project owner can open Planning and identify top risks without scrolling past milestone edit forms.
- A contributor can open My Work and know what to do next.
- A maintainer can find cross-project work without discovering a hidden route.
- A user can move from a health reason to a filtered list and back without losing context.
- Mobile users can read work item results without interpreting clipped table columns.

## Bottom Line

Worktrail does not need a UX reset. It needs consolidation. The strongest move for v0.1.0 is to turn accumulated features into stable product places: daily queue, work discovery, project workspace, planning review, and administration. Most recommendations above reuse existing functionality and data; they mainly change hierarchy, navigation, and default presentation.
