# Worktrail v0.2.0 PRD

## Summary

Worktrail v0.2.0 should consolidate the v0.1.x product surface into a cleaner, more intentional operating baseline.

The v0.1.x cycle added substantial capability:

- My Work and Inbox for personal attention;
- workspace and project work discovery;
- URL-backed filters, saved views, pinned shortcuts, copy links, and exports;
- project batch triage;
- dependency-aware planning;
- milestone review;
- immutable project status reports with Markdown sharing;
- richer collaboration through comments, mentions, watchers, notifications, relationships, and activity.

The app is no longer a set of disconnected pages. It now has multiple overlapping operating centers. The v0.2.0 challenge is to keep that power while making each surface declare its job, reducing default control noise, and extracting repeated implementation patterns before the next feature cycle compounds them.

The product theme is Consolidated Operating Baseline.

v0.2.0 should not be a broad feature sprint. It should make Worktrail feel more complete by:

- removing duplicated project navigation and terminology drift;
- making work-list controls easier to scan and operate;
- turning project bulk triage into a deliberate mode;
- clarifying live planning, milestone drill-down, and published report workflows;
- improving the public site so it presents Worktrail as a coherent current product;
- reducing route-component and service consolidation debt where it directly supports the UX cleanup;
- restoring and preserving a trusted green verification baseline.

## Context

Worktrail reached v0.1.9 with a large amount of working product surface. The v0.2.0 audits identified a consistent pattern across UX, technical debt, and the static site:

- capability is no longer the main issue;
- accumulated local control surfaces are now the main UX issue;
- accumulated orchestration in large route components and broad services is now the main engineering issue;
- accumulated sprint chronology is now the main public-site issue.

The v0.2.0 release should be a reset point similar to v0.1.0 after v0.0.9, but with a different posture. v0.1.0 made the early MVP feel like a product. v0.2.0 should make the expanded v0.1.x product feel cohesive, intentional, and ready for the next wave of features.

## Problem

Worktrail has outgrown the "missing structure" phase. The current friction comes from overlap and repetition.

Product friction:

- project child pages sometimes duplicate the persistent project shell navigation;
- work list pages expose pinned views, saved-view management, filters, chips, copy links, export, import, create, and bulk controls in dense stacks;
- project bulk triage appears as an always-present list affordance instead of an explicit mutation workflow;
- Planning, Milestone Review, and Status Reports share health/risk concepts but do not consistently label live views versus published snapshots;
- Work Item Detail leads with edit surfaces even though users arrive to read, act, collaborate, inspect dependencies, or review history;
- mobile layouts are technically responsive, but project pages often stack too many controls before primary content;
- terms such as Status, Work Items, Work, Saved views, Pinned views, Blocked, and Dependency blocked need more consistent user-facing framing.

Engineering friction:

- route components still own too much loading, form state, URL synchronization, mutation orchestration, markup, and styling;
- project and workspace work list orchestration is duplicated above shared UI components;
- `WorkItemService` is broad enough that future work item features risk touching query, command, DTO, board, activity, notification, and bulk code together;
- Planning, Milestone Review, and Status Reports duplicate risk-section assembly;
- persisted JSON payloads need clearer runtime parsing/versioning policy;
- transaction wiring and frontend API access patterns are repeated enough to need a placement rule;
- seed data and large tests have become product infrastructure that needs better ownership.

Public-site friction:

- the site presents Worktrail as a sequence of v0.1.x increments rather than as a current product/reference baseline;
- the hero and baseline sections enumerate too much;
- architecture is listed as many equal rows instead of a clear layered model;
- scope caveats are accurate but dense.

## Goals

- Make project pages use one clear project navigation model.
- Make workspace and project work list pages lead with operating views, filters, actions, and results rather than saved-view administration.
- Make project bulk triage a deliberate, recoverable mode.
- Clarify the roles of:
  - My Work as daily action;
  - Inbox as collaboration event processing;
  - Planning as live project operating review;
  - Milestone Review as live scoped drill-down;
  - Reports as published snapshot and sharing.
- Improve terminology around reports, views, work, and dependency state.
- Reduce mobile stacking on the highest-traffic project surfaces.
- Extract shared work-list and saved-view orchestration enough that UX consolidation does not duplicate implementation work.
- Split or isolate the most overloaded work item and risk-section backend responsibilities enough to lower future change risk.
- Establish explicit validation/versioning policy for persisted JSON report/saved-view shapes, with implementation where the risk is highest.
- Update the public site to present v0.2.0 as a coherent baseline, not a sprint chronology.
- Ensure README, release notes, pattern notes, and audits align with the implemented baseline.
- Restore and preserve full local verification confidence.

## Non-Goals

- Do not add a new major project management feature area.
- Do not add production authentication, invitations, hosted infrastructure, or deployment automation.
- Do not add custom roles, project membership, custom workflows, approvals, signoff, or automation rules.
- Do not add PDF generation, scheduled report delivery, subscriptions, public report links, export history, or analytics.
- Do not rewrite the Angular app, API service layer, or database schema wholesale.
- Do not redesign the visual language from scratch.
- Do not replace the current local Express adapter.
- Do not turn the public site into a marketing-style SaaS landing page.
- Do not extract abstractions purely for line-count reduction; extraction should follow repeated ownership or behavior.

## Target Users

### Project Maintainer

Uses project Work, Planning, Milestone Review, Reports, and bulk triage to keep a project moving. Needs fewer duplicate controls, clearer mutation modes, and a stronger live-versus-published mental model.

### Contributor

Uses My Work, Inbox, shared views, project Work, reports, and work item detail to understand what changed and what to do next. Needs clear read paths without mutation controls competing for attention.

### Workspace Owner

Uses settings, shared views, project reports, status surfaces, and activity to inspect team operations. Needs the app to feel coherent enough to evaluate adoption and reference value.

### Reference-App Developer

Studies the codebase for full-stack product patterns. Needs route components, stores, domain services, endpoint handlers, contracts, validation, seed data, tests, and public documentation to show pragmatic, scalable boundaries.

### Public Visitor

Reads the static site to understand what Worktrail is and why the codebase is worth studying. Needs a short, current, credible product story without reading sprint history.

## Product Principles

- **Keep the power, lower the default noise:** preserve capability while moving administrative controls behind explicit actions.
- **One surface, one primary job:** pages should make their purpose obvious before showing secondary controls.
- **Live is different from published:** planning and review pages show current state; reports preserve communicated state.
- **Mutation should feel deliberate:** bulk edits and administrative actions should be easy to find but not visually indistinguishable from scanning.
- **Shared behavior deserves shared ownership:** repeated query, saved-view, risk, validation, and mutation behavior should move into focused helpers/stores/services.
- **Current baseline over release chronology:** docs and site should describe Worktrail as it is now.
- **Refactor in service of product clarity:** technical cleanup should support the UX consolidation and future feature velocity.

## Scope

### 1. Project Navigation And Terminology Consolidation

Remove duplicated page-local project navigation from project child pages where the persistent project shell already owns the section navigation.

Requirements:

- Treat the project shell as the only project section navigation.
- Keep page-specific commands in child page headers.
- Rename or clarify project `Status` navigation as `Reports` or `Status Reports`.
- Align headings and labels:
  - global work discovery should read as workspace-wide work item discovery;
  - project work should read as project work;
  - saved-view UI should distinguish pinned shortcuts, saved views, and manage views;
  - blocked status and dependency-blocked filters should be visibly distinct.
- Keep archived-project and contributor absence copy intact.

Acceptance criteria:

- On `/projects/:projectId/*` pages, users see one project section nav.
- Page headers contain commands unique to that page rather than duplicate links to other project sections.
- Report navigation no longer depends on the overloaded label `Status` alone.
- Existing route compatibility is preserved, even if labels change.

### 2. Work List Control Consolidation

Rework workspace Work Items and project Work controls so the default scanning path is clearer.

Requirements:

- Preserve pinned views, saved views, filters, active chips, copy links, CSV export, import, create, and project bulk triage capability.
- Split the work list header into clearer zones:
  - view shortcuts;
  - filters and active chips;
  - actions.
- Keep pinned shortcuts visible.
- Replace default saved-view creation and management forms with compact actions.
- Move rename, update query, pin/unpin, and delete controls behind `Manage views`.
- Keep active chips visible outside any filter panel.
- Preserve workspace and project saved-view permission rules.
- Preserve canonical query, copy-link, return-URL, and export behavior.

Acceptance criteria:

- On desktop, the first result row appears without users first parsing full saved-view management controls.
- On mobile, users can open pinned/saved views or filters without scrolling past unrelated management panels.
- Existing saved-view functionality remains available and covered by tests.
- Project and workspace work list behavior remains aligned.

### 3. Explicit Project Bulk Triage Mode

Make project batch triage an intentional mode rather than a quiet add-on to normal list scanning.

Requirements:

- Add an explicit `Bulk edit` or `Triage` entry point on project Work for owners and maintainers.
- Hide selection checkboxes until bulk mode is active, except where selected state already needs to be represented.
- Provide a clear `Exit bulk edit` action.
- Keep selection count, selected items, action selector, confirmation/apply action, and result summary together.
- Preserve partial-success behavior:
  - updated rows;
  - unchanged rows;
  - failed rows;
  - failed item recovery path.
- Keep contributor and archived-project absence paths clear.

Acceptance criteria:

- A maintainer can enter bulk mode, select visible work, apply one update, understand the result, and exit without losing the current filtered view.
- A contributor does not see mutation-oriented bulk controls.
- Archived projects remain read-only.

### 4. Planning, Milestone Review, And Report Framing

Clarify the relationship between live planning surfaces and published reports.

Requirements:

- Add consistent `Live view` versus `Published snapshot` framing where appropriate.
- Keep Planning framed as current project operating review.
- Keep Milestone Review framed as current scoped milestone drill-down.
- Keep Reports framed as published snapshots and sharing artifacts.
- On Planning, add a clearer bridge to create or review reports.
- On status report draft, label generated evidence versus editable narrative more clearly.
- On report detail, group copy/download/print into a single share/export area.
- On Milestone Review, add or preserve a clear path back to Planning.

Acceptance criteria:

- A user can distinguish live triage, milestone drill-down, and shareable reporting from page copy and labels alone.
- Report snapshot language remains explicit.
- Existing report export and print behavior remains intact.

### 5. Work Item Detail Read/Act/Collaborate Rebalance

Improve Work Item Detail without removing edit power.

Requirements:

- Preserve the summary header and return-link behavior.
- Reorganize the page around user intent:
  - read current state;
  - act on status/ownership/planning fields;
  - collaborate through comments, mentions, and watchers;
  - inspect dependencies;
  - review history.
- Consider read-first or edit-on-demand behavior for details if implementation scope allows.
- Move watcher affordances closer to collaboration or header context.
- Make dependency state more prominent when the work item is blocked or blocking others.
- Keep comments, relationships, and activity accessible without turning the page into a tab maze unless tabs/accordions clearly reduce scan cost.

Acceptance criteria:

- From a work item detail page, the user can identify current state, next likely action, discussion state, and dependency state without parsing a full edit form first.
- Existing update, comment, watcher, relationship, and activity behavior remains covered.

### 6. Frontend Orchestration Extraction

Extract repeated work-list and saved-view orchestration enough to support the UX consolidation safely.

Requirements:

- Introduce feature-local stores/facades where they remove real ownership overlap.
- Prioritize:
  - shared saved-view load/mutation/pin/delete orchestration;
  - work-list query state, route params, active query, copy link, and export state;
  - project-only bulk triage state;
  - My Work queue ranking if the existing ordering test ambiguity remains.
- Keep route components responsible for route params, composition, and loading/error boundaries.
- Keep presentational components responsible for rendering and events.
- Decide whether new frontend code should inject domain API clients directly or continue using `WorktrailApiService`.

Acceptance criteria:

- A saved-view behavior change can be implemented once and verified through project and workspace paths.
- New or changed route components avoid adding more orchestration to already-large page files.
- Full web tests pass with focused unit coverage for extracted behavior.

### 7. Backend Domain Consolidation

Reduce the most consequential backend duplication and service breadth.

Requirements:

- Split or facade `WorkItemService` responsibilities where practical:
  - query/list/detail hydration;
  - commands;
  - bulk update;
  - DTO assembly;
  - board positioning;
  - activity/notification side effects.
- Extract shared risk-section assembly for Planning, Milestone Review, and Status Reports:
  - risk type metadata;
  - query generation;
  - predicates;
  - sorting;
  - preview limits;
  - `PlanningRiskItemDto` assembly.
- Preserve existing endpoint contracts.
- Prefer compatibility facades where they reduce endpoint churn.

Acceptance criteria:

- Risk sections are defined once and reused by live planning, milestone review, and report snapshots.
- Adding or changing a risk category no longer requires parallel edits across multiple services.
- Work item command/query/bulk/DTO responsibilities are less concentrated in one file.
- Existing API tests continue to pass.

### 8. Runtime Validation, Seeds, And Release Metadata

Harden the product infrastructure that now carries long-lived data and demo behavior.

Requirements:

- Fix any failing baseline tests or ambiguous queue-order assertions before deeper cleanup proceeds.
- Add or improve focused tests for My Work queue ranking if needed.
- Add versioned runtime parsing for status report snapshots or explicitly document a validation policy if implementation is deferred.
- Centralize saved-view query normalization/field stripping if not already covered by the work-list extraction.
- Decide the release metadata policy:
  - align package versions to v0.2.0; or
  - document that git tags/docs are authoritative while package versions are internal.
- Split seed data by domain if feasible:
  - stable IDs;
  - workspace/members;
  - projects;
  - labels/milestones;
  - work items;
  - relationships/watchers/comments;
  - saved views;
  - reports.

Acceptance criteria:

- Persisted JSON payloads have an explicit runtime validation/versioning policy.
- A developer can tell what version identity is authoritative.
- Seed data remains deterministic and easier to extend.

### 9. Public Site Consolidation

Update the static site for the v0.2.0 baseline.

Requirements:

- Remove sprint-by-sprint chronology from the main narrative.
- Tighten the hero around:
  - one product sentence;
  - one developer-reference sentence.
- Reframe the signal band around a consistent audience model.
- Consolidate the App section into fewer workflow pillars:
  - start the day;
  - find and shape work;
  - operate projects;
  - share status.
- Rework the baseline section as `v0.2.0 baseline`.
- Group architecture into fewer layers:
  - frontend;
  - API boundary;
  - domain;
  - persistence;
  - operations.
- Convert the long scope caveat into a small set of non-goal cards.
- Update footer links to v0.2.0 docs, audits, OpenAPI, and relevant run/reference docs.
- Consider refreshing the screenshot to better represent the v0.2.0 center of gravity.

Acceptance criteria:

- Public site visitors can understand Worktrail without reading version history.
- The first two sections do not depend on sprint chronology.
- The site remains grounded as a reference app, not a SaaS marketing page.

### 10. Documentation And Final Verification

Complete the release surface.

Requirements:

- Add v0.2.0 technical design after PRD approval.
- Add v0.2.0 implementation plan after technical design approval.
- Add v0.2.0 release notes.
- Add v0.2.0 pattern notes using destination-neutral language.
- Update README for the v0.2.0 baseline.
- Keep OpenAPI current if any route behavior changes.
- Record final verification in the implementation plan.

Acceptance criteria:

- README, public site, release notes, and pattern notes match implemented behavior.
- Full local verification passes or any failure is documented with cause and next action.

## Suggested Prioritization

### Must Do

- Restore/confirm fully green baseline tests.
- Remove duplicate project page-local navigation.
- Rename or clarify project `Status` as report-oriented navigation.
- Consolidate saved-view and filter management on workspace/project work lists.
- Make project bulk triage an explicit mode.
- Extract shared work-list/saved-view orchestration enough to avoid duplicate UX work.
- Extract shared backend risk-section assembly.
- Update the public site away from release chronology.
- Update README, release notes, pattern notes, and final verification.

### Should Do

- Rebalance Work Item Detail around read/act/collaborate/dependencies/history.
- Add live-versus-published labels across Planning, Milestone Review, and Reports.
- Add a Planning-to-Reports bridge.
- Split `WorkItemService` behind a compatibility facade.
- Add versioned status report snapshot parsing.
- Decide and document package/release version metadata policy.
- Reduce mobile stacking on project Work and Planning.

### Could Do

- Split seed data into domain files with stable ID ownership.
- Extract My Work queue ranking into a pure helper/store.
- Introduce shared frontend mutation-state helpers.
- Improve Inbox notification labels/grouping.
- Collapse lower-priority planning or milestone risk sections.
- Refresh the public site screenshot.

## Success Metrics

Product success:

- project pages present one project navigation model;
- work-list result scanning starts sooner on desktop and mobile;
- bulk triage feels deliberate, reversible, and recoverable;
- live planning and published reporting are visibly distinct;
- users can predict whether they should open My Work, Inbox, project Work, Planning, Milestone Review, or Reports.

Engineering success:

- full verification is green;
- work-list and saved-view orchestration is shared rather than duplicated;
- route components are smaller in responsibility, even if not all are small in line count yet;
- risk sections are policy-defined once and reused;
- work item command/query/DTO/side-effect ownership is clearer;
- persisted JSON validation/versioning policy is explicit.

Public-site success:

- hero explains Worktrail in two short sentences;
- main page copy presents the current product rather than sprint history;
- architecture reads as layers rather than a feature inventory;
- current scope is candid and scannable;
- v0.2.0 docs and audits are easy to reach.

## Open Questions

- Should project navigation label use `Reports` or `Status Reports`?
- Should package versions be updated to `0.2.0`, or should README document tags/docs as the product release identity?
- How much of `WorkItemService` splitting belongs in v0.2.0 versus the next feature sprint?
- Should Work Item Detail read-first behavior be included in v0.2.0, or should v0.2.0 stop at work-list/planning/report consolidation?
- Is the current board screenshot still acceptable for the v0.2.0 site, or should the site wait for a refreshed screenshot after UX cleanup?
- Should frontend route code inject domain API clients directly going forward, or should a renamed facade remain the standard entry point?

## Bottom Line

v0.2.0 should make Worktrail feel less like a successful sequence of feature additions and more like a cohesive operating product and reference implementation.

The right outcome is not more capability for its own sake. The right outcome is a cleaner app, a safer codebase, a sharper public face, and a baseline strong enough to support another long feature cycle without reintroducing the same drift.
