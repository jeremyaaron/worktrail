# Worktrail v0.2.0 UX Audit

## Summary

Worktrail is in a much stronger UX position than it was at v0.1.0. The persistent project shell, top-level Work Items area, responsive work item cards, saved and pinned views, My Work queue, Inbox, milestone review, and status report workflow have turned the app into a credible project operating surface.

The new v0.2.0 UX problem is different from the old one. The app no longer feels like disconnected pages. It now feels like a product with several overlapping operating centers:

- My Work and Inbox both surface personal attention.
- Workspace Work Items and project Work both have saved views, pinned views, filters, copy links, export, and list scanning.
- Project Planning, Milestone Review, and Status Reports all explain delivery health from different time perspectives.
- Work item detail has become an edit surface, collaboration thread, relationship manager, watcher control, and activity log.

The highest-leverage v0.2.0 theme should be:

> Keep the new power, but make each surface declare its job and let secondary controls recede until needed.

The product does not need a broad redesign. It needs consolidation of repeated navigation, progressive disclosure for administrative controls, clearer workflow language, and stronger distinctions between daily attention, live project operation, and published reporting.

## Audit Basis

This audit reviewed:

- `README.md` and sprint docs from `docs/v0.1.1` through `docs/v0.1.9`.
- The previous v0.1.0 UX audit in `docs/v0.1.0/ux-audit.md`.
- Angular routes and major page components under `apps/web/src/app`.
- Seed data and workflow coverage cues under `apps/api/src/db/seed.ts` and `e2e`.
- A seeded local run of the API and web app across desktop and mobile widths.

No product files were modified. This document is the only intended repository change.

## What Improved Since v0.1.0

The v0.1.0 audit's biggest recommendations were largely acted on.

- The project shell gives project pages a stable workspace identity with consistent project status, health, and section navigation.
- `Work Items` is now a top-level cross-project discovery hub instead of being hidden behind My Work or workspace settings.
- My Work has become a stronger daily surface with summary counts, an attention queue, and an Inbox bridge.
- Work item lists have shared components, active filter chips, saved views, pinned shortcuts, and mobile card layouts.
- Planning is now review-first by default, with milestone administration separated behind a `Review` / `Milestones` control.
- Milestone Review and Status Reports extend planning into useful focused and shareable workflows.
- Status report detail pages clearly distinguish published snapshots from links into current project data.
- Inbox, watchers, mentions, comments, and notifications give collaboration a visible product shape.

That progress changes the v0.2.0 goal. The main risk is no longer missing structure. The risk is that every new feature brought its own local control surface, and those surfaces now compete for attention.

## Highest-Impact Recommendations

### 1. Remove Page-Local Project Navigation That Duplicates The Project Shell

The persistent project shell is the right model, but several child pages still carry older local project navigation. For example, project Work repeats `Board`, `Planning`, and `Settings` in the page header even though those are already in the shell subnav. Planning similarly repeats `Overview`, `Work items`, `Board`, and `Settings`.

Recommendation:

- Treat the project shell as the only project section navigation.
- Remove page-local links that duplicate shell sections.
- Keep only page-specific commands in child page headers:
  - Project Work: `Copy link`, `Export CSV`, `Import CSV`, `Create work item`.
  - Planning: view switcher and planning-specific actions.
  - Status: `Create report`, `Back to status`, share/export controls.
- Consider moving common project actions into the shell action area or a consistent project command row.

Why this matters:

- Users should not have to parse two project nav systems in the same viewport.
- Mobile project pages currently stack global nav, project shell nav, and page-local nav before the primary content.
- Removing duplicate links will immediately reduce visual load without removing capability.

Suggested v0.2.0 acceptance check:

- On any `/projects/:projectId/*` page, there is exactly one project section nav, and page headers contain only commands unique to that page.

### 2. Consolidate Work List Controls Into A Clear Operating Toolbar

Workspace Work Items and project Work are the most mature surfaces in the app, but they also have the densest control stack. Above the result list, users can encounter pinned views, saved view creation, saved view management, filters, active chips, copy link, CSV export, import, create, and bulk actions.

The individual controls are useful. The problem is that the default page asks users to absorb saved-view management before they reach the work list.

Recommendation:

- Split the work list header into three clear zones:
  - `View`: pinned views and a compact saved view picker.
  - `Filter`: current filter chips plus a filter button/drawer or collapsible panel.
  - `Actions`: copy link, export, import, create, and bulk mode.
- Keep pinned views visible, because they are fast operating shortcuts.
- Replace the default saved-view form with a compact `Save view` action.
- Keep rename, update query, pin, unpin, and delete inside `Manage views`.
- Preserve the current full management functionality, but keep it out of the default scanning path.

Why this matters:

- Saved views are operational shortcuts most of the time, not the main work.
- Project Work should get users to the result list quickly.
- Workspace Work Items should feel like search and discovery first, view administration second.

Suggested v0.2.0 acceptance check:

- On desktop, the first visible result row should appear without requiring users to scan through a full saved-view management form.
- On mobile, users should be able to open a pinned/saved view or filter without scrolling past multiple unrelated control panels.

### 3. Make Bulk Triage An Explicit Mode

Project batch triage is valuable, but it currently appears as selection checkboxes in the work list and a bulk action bar once selection exists. That is functional, but it makes a high-impact mutation workflow feel like an add-on to normal scanning.

Recommendation:

- Introduce an explicit `Bulk edit` or `Triage` mode on project Work.
- Hide selection checkboxes until bulk mode is active, unless the user has already selected items.
- Use a sticky bulk footer or compact toolbar once selections exist.
- Keep the selection count, selected item names, action selector, and result summary in one place.
- Add a clear `Exit bulk edit` action.
- After applying an action, show updated, unchanged, and failed counts with a direct path to failed items.

Why this matters:

- Normal scanning and batch mutation have different mental modes.
- Bulk edits should feel deliberate and recoverable.
- Explicit mode will reduce visual noise for contributors and maintainers who are just reading the list.

Suggested v0.2.0 acceptance check:

- A maintainer can enter bulk mode, select items, apply one update, understand the outcome, and exit without losing the current filtered view.

### 4. Clarify The Relationship Between Planning, Milestone Review, And Status Reports

Planning, Milestone Review, and Status Reports are all strong individually. Together, they need clearer framing.

Recommended mental model:

- `Planning`: live project operating review. It answers, "What needs attention now?"
- `Milestone Review`: live scoped drill-down. It answers, "What is happening inside this delivery target?"
- `Status Reports`: published snapshot and sharing. It answers, "What did we say about project state at a point in time?"

Recommendation:

- Add small, consistent labels to distinguish `Live view` from `Published snapshot`.
- Rename project nav `Status` to `Reports` or `Status Reports` if space allows. `Status` can be confused with work item status and project status.
- On Planning, add a clear path to create a status report from the current state.
- On Status report draft, make it obvious that the right column is generated evidence and the left column is editable narrative.
- On Status report detail, keep the snapshot notice, but group `Copy Markdown`, `Download Markdown`, and `Print` into a single share/export action area.
- On Milestone Review, provide consistent links back to Planning and to creating/opening reports that include that milestone, even if report generation remains project-level.

Why this matters:

- Users need to understand why similar health, risk, milestone, and work lists appear in multiple places.
- Status report links to current work are useful, but users must not confuse current linked data with immutable snapshot data.
- Planning should feel like the source of truth for live operation; reports should feel like a published artifact.

Suggested v0.2.0 acceptance check:

- A user can explain which page to use for live triage, milestone drill-down, and shareable status without reading documentation.

### 5. Rebalance Work Item Detail Around Read, Act, Collaborate

The work item detail page is now comprehensive: summary, details form, status transition, watchers, metadata, relationships, comments, mentions, and activity. It is useful, but it still leads with edit forms, which makes the page feel more like an admin editor than a collaborative work record.

Recommendation:

- Keep the current summary header; it is doing important scan work.
- Convert the details panel from always-editable to read-first with an `Edit details` mode, or visually separate editable fields from the primary status/ownership facts.
- Group page sections by user intent:
  - `Act`: status, assignee, priority, milestone, due date.
  - `Collaborate`: comments, mentions, watchers.
  - `Dependencies`: blocked by, blocks, related work.
  - `History`: activity.
- Move watchers closer to comments or the page header, because watching is a collaboration preference rather than metadata.
- Keep activity visible, but avoid making it compete with comments for the main collaboration column.

Why this matters:

- The detail page is where users land from Inbox, My Work, Planning, Reports, and filtered lists.
- Different entry points imply different immediate jobs: resolve, comment, inspect dependency, or update fields.
- A read-first layout reduces cognitive cost while preserving edit power.

Suggested v0.2.0 acceptance check:

- From any work item detail page, the user can identify current state, next likely action, discussion state, and dependency state without first parsing a full edit form.

### 6. Refine My Work And Inbox So They Do Not Compete

My Work now has an Inbox summary, and Inbox has its own top-level nav with unread count. That is a good bridge, but the two surfaces need crisp roles as notification volume grows.

Recommendation:

- Keep My Work focused on work that needs action, not notification management.
- Keep Inbox focused on events, mentions, watcher updates, and read/unread state.
- In My Work, show only the Inbox count plus the top one or two urgent notification summaries if needed.
- In Inbox, add grouping once volume grows:
  - by project;
  - by work item;
  - by notification type;
  - by unread vs read.
- Add notification settings or watcher explanations near the watcher controls, not in Inbox itself.

Why this matters:

- My Work should answer, "What should I do today?"
- Inbox should answer, "What changed that I should know about?"
- Without that distinction, both pages will gradually collect the same attention signals.

Suggested v0.2.0 acceptance check:

- A user opens My Work to act on assigned/reported work and opens Inbox to process collaboration events.

### 7. Reduce Mobile Stacking And Preserve The Primary Action

The mobile layouts are technically responsive and the work item cards are much better than the old narrow table. The remaining issue is stacking. On project pages, the user often sees global nav, actor selector, project header, project nav, page-local nav, pinned views, saved views, and filters before reaching primary content.

Recommendation:

- Removing duplicate project local nav should be the first mobile improvement.
- Collapse saved-view management by default on mobile.
- Make filters a drawer or compact expandable panel with active chips visible outside the drawer.
- Keep primary page actions near the top, but move secondary actions into a menu or action group.
- For project Work mobile cards, reduce repeated uppercase fact labels and make the first two lines carry title, key, status, priority, assignee, and due date.
- For Planning mobile, consider collapsing lower-priority risk sections by default after the first few lists.

Why this matters:

- Mobile users can technically access every feature, but scan cost is high.
- The mobile version should preserve the workflow spine, not simply stack the desktop control hierarchy.

Suggested v0.2.0 acceptance check:

- On a 390px-wide viewport, a user can reach the first meaningful work item, planning risk, or report content after only the controls required for that workflow.

### 8. Tighten Terminology Around Views, Status, And Work

Worktrail now has several concepts with overlapping names:

- `Work Items` globally and `Work` inside projects.
- `Status` as project nav for reports, work item status, project status, and delivery health status.
- `Saved views`, `Pinned views`, personal views, shared views, workspace views, and project views.
- `Blocked` as a work item status and dependency-blocked as a derived relationship signal.

Recommendation:

- Rename project nav `Status` to `Reports` or `Status Reports`.
- Keep global `Work Items` and project `Work`, but make page headings align:
  - Global: `Workspace work items`.
  - Project: `Project work`.
- In saved-view UI, foreground the user-facing idea:
  - `Pinned shortcuts`
  - `Saved views`
  - `Manage views`
- In filter labels and chips, distinguish:
  - `Status: Blocked`
  - `Dependency: Blocked by open work`
  - `Dependency: Blocking open work`
- Use `shared` carefully in project scope. "Shared project view" is clearer than "workspace" visibility when the user is inside a project.

Why this matters:

- The app is now broad enough that terminology drift can become a real UX bug.
- Clear labels reduce the amount of product knowledge users must carry between pages.

## Page-Level Recommendations

### My Work

What works:

- Summary cards give the actor a fast overview.
- The attention queue is a strong default first workflow.
- The Inbox bridge is useful without dominating the page.
- Secondary sections such as `Reported by me` are now below the action queue.

Recommended changes:

- Make the active summary filter feel more like a view switcher than a temporary page state.
- Add a clearer distinction between "needs attention" reasons and ordinary assigned/reported work.
- Consider moving `Reported by me` behind a tab or saved My Work view if the page grows.
- Keep the `Workspace work items` link, but consider naming it `Open workspace search` or `Open all work` for clearer intent.

### Inbox

What works:

- The page is simple and readable.
- Unread and all tabs are easy to understand.
- Per-notification links into work item detail preserve actionability.

Recommended changes:

- Group notifications by work item or project once there are more than a handful.
- Add a filter for mentions, watched status changes, and dependency changes when notification types expand.
- Consider "Mark all read" plus per-group mark read instead of only per-item action.
- Improve notification type labels for scanning; `Watched Status Change` is technically accurate but reads like an internal event name.

### Workspace Work Items

What works:

- This is now a credible cross-project discovery hub.
- Pinned views make common lenses fast.
- The mobile card layout is intentionally designed and readable.
- Active query, saved views, copy links, and CSV export all align around the same query model.

Recommended changes:

- Make results the visual anchor and move saved-view creation/management behind compact controls.
- Keep pinned views visible, but rename the section to `Pinned shortcuts` if that better matches user intent.
- Treat filters as a panel the user opens when needed; keep active chips visible.
- On mobile, reduce repeated labels inside cards and make the first screen less control-heavy.

### Project Work

What works:

- Project-scoped saved and pinned views are valuable operating lenses.
- The result list supports scanning, selection, and bulk triage.
- Export/import/create are correctly scoped to project work.
- Archived project handling is clear.

Recommended changes:

- Remove page-local links to `Board`, `Planning`, and `Settings`; the project shell already owns those.
- Make bulk triage an explicit mode.
- Separate default scanning from saved-view management.
- Keep project-specific commands in a consistent action group: copy, export, import, create, bulk edit.
- Consider changing the heading from `Project work items` to `Project work` to match the shell nav.

### Project Planning

What works:

- Planning is now review-first by default.
- Delivery health, milestone progress, risk metrics, and risk lists are all actionable.
- The `Review` / `Milestones` switch is the right high-level split.
- Milestone names and reason chips link into focused work lists.

Recommended changes:

- Remove duplicate local project nav from the page header.
- Add a clearer workflow bridge from Planning to Status Reports.
- Collapse lower-priority risk sections once top risks have been shown.
- Reduce repeated delivery-health labels where the same state appears in header, pill, and reason list.
- Keep milestone management behind the `Milestones` view, but consider making milestone rows read-first there as well.

### Milestone Review

What works:

- The page has a clear scoped purpose.
- Summary metrics, health reasons, scope breakdowns, risks, and recent movement are useful.
- `Open scoped work` is a strong action.

Recommended changes:

- Keep the page framed as a drill-down from Planning, not a second planning dashboard.
- Add a small "live milestone view" label to distinguish it from report snapshots.
- Make risk sections more compact when there are many categories.
- Add a consistent link back to the exact planning context where possible.

### Status Reports

What works:

- The list page clearly highlights the latest report.
- Draft generation separates narrative editing from generated evidence.
- Published reports clearly show snapshot metadata and immutable values.
- Markdown copy/download and print are useful v0.1.9 additions.

Recommended changes:

- Rename the project nav from `Status` to `Reports` or `Status Reports`.
- On the list page, explain the difference between latest report and live project state through a compact label, not body copy.
- On draft, label the right column as generated evidence and the left column as editable narrative.
- On detail, group share/export actions into one area so the header stays focused on the report.
- Consider making report detail more print-like by default, with operational links still available but visually secondary.

### Work Item Detail

What works:

- The summary header gives strong immediate context.
- Relationships, comments, mentions, watchers, and activity form a credible collaboration record.
- Return links preserve context from project work and other entry points.

Recommended changes:

- Shift details from edit-first to read-first or edit-on-demand.
- Move watchers closer to collaboration or header context.
- Make relationship state more prominent when the item is blocked or blocking others.
- Consider tabs or accordions if comments, relationships, and activity continue to grow.
- Keep status update highly visible, but avoid making it feel disconnected from other primary fields such as assignee and due date.

### Board

What works:

- The board remains an understandable project work view.
- It benefits from the project shell and the shared work item status vocabulary.

Recommended changes:

- Revisit board controls after project Work consolidation so the board does not become the next place where filters, saved views, bulk actions, and status menus are all added independently.
- Keep board-specific interactions board-specific: lane scan, status movement, and lightweight card inspection.
- Link back to filtered project Work for heavier triage and bulk edits.

### Project And Workspace Settings

What works:

- Settings are no longer overloaded into the main workspace nav as the only workspace destination.
- Governance, members, roles, labels, and lifecycle controls are appropriately administrative.

Recommended changes:

- Keep settings pages quiet and administrative.
- Do not use settings pages as the home for operating features.
- If member, label, and activity management grow, add internal anchors or tabs.

## Recommended v0.2.0 Work Plan

### Must Do

These changes would most improve perceived polish for v0.2.0.

- Remove duplicate page-local project navigation from project child pages.
- Compact saved-view creation and management on workspace and project work lists.
- Make project bulk triage an explicit mode.
- Rename or clarify project `Status` as reports/status reports.
- Add consistent `Live view` vs `Published snapshot` framing across Planning, Milestone Review, and Status Reports.

### Should Do

These are important, but can follow the structural cleanup.

- Rebalance work item detail into read/act/collaborate/history sections.
- Reduce mobile stacking on project Work and Planning.
- Improve Inbox notification grouping and event labels.
- Tighten saved-view terminology across workspace and project scopes.

### Could Do

These are useful polish items if there is room.

- Add a Planning-to-Status-Report bridge.
- Make report detail more print/report-like while keeping links available.
- Add collapsible risk sections to long planning and milestone review pages.
- Add grouped notification actions in Inbox.

## Success Criteria For v0.2.0

Worktrail should feel ready for another feature cycle when:

- Project pages have one clear project navigation model.
- Work list pages lead with operating views, filters, and results, not saved-view administration.
- Bulk triage feels deliberate and recoverable.
- Users can distinguish daily attention, collaboration notifications, live planning, milestone drill-down, and published reporting.
- Mobile pages preserve workflow priority instead of stacking every desktop control in order.
- Terminology is consistent enough that users can predict where new capabilities belong.

## Bottom Line

The app has outgrown the "stapled-on feature" problem in the broad navigation sense. The new consolidation work is subtler: remove duplicate controls, reduce default management UI, clarify adjacent workflows, and make dense pages declare one primary job at a time.

For v0.2.0, prioritize UX cleanup that makes existing features feel intentionally placed. That will make the next nine sprints easier to add without returning to the same drift.
