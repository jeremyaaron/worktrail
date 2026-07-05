# Worktrail v0.1.0 PRD

## Summary

Worktrail v0.1.0 is a consolidation release. The product has accumulated enough useful capability that the next release should make the existing workflows feel intentional, coherent, and durable rather than simply adding another feature layer.

The release should improve the experience around five product places:

- daily execution in `My Work`;
- cross-project discovery in `Work Items`;
- project operation through a persistent project workspace;
- planning review and delivery confidence;
- administration and governance.

It should also reduce the main technical scaling friction identified in the v0.1.0 audits and refresh the public site so Worktrail reads as a consolidated reference app baseline instead of a release-history inventory.

## Audit Inputs

This PRD is informed by three v0.1.0 audit documents:

- `docs/v0.1.0/ux-audit.md`;
- `docs/v0.1.0/tech-debt-audit.md`;
- `docs/v0.1.0/site-audit.md`.

The audits agree on the release theme: Worktrail does not need a reset. It needs hierarchy, shared patterns, clearer product places, and cleaner code seams before the next feature slate expands the app again.

## Context

Through v0.0.9, Worktrail added a credible project-management surface:

- projects and workspace members;
- project work item lists and board views;
- cross-project work discovery and saved views;
- labels, milestones, comments, relationships, and activity;
- My Work, quick capture, CSV import/export, OpenAPI, readiness, and production preview;
- dependency-aware planning and delivery-health signals.

Those features work, but the app still shows the order in which they were added. Some workflows are hidden behind weaker navigation labels, some pages give administrative controls the same visual priority as daily review content, and several implementation files have become large coordination points.

v0.1.0 should turn the accumulated feature set into a clearer product baseline.

## Problem

Users can complete important tasks in Worktrail, but the product structure makes them do extra interpretation:

- project pages feel like separate destinations rather than views inside one project workspace;
- planning surfaces milestone administration before planning review;
- cross-project work discovery is under-positioned;
- My Work duplicates categories instead of presenting a prioritized daily queue;
- work item lists are dense on mobile;
- terminology around blocked work, dependency-blocked work, and blocking work is inconsistent enough to slow comprehension;
- the public site lists too many features at equal weight.

Maintainers also face increasing friction:

- route components have grown large and mix orchestration, templates, forms, and styles;
- work item query behavior is duplicated across API parsing, SQL composition, frontend serialization, saved views, export, and health links;
- planning, delivery health, and My Work repeat similar risk-window and status-policy rules;
- contracts, Express route registration, and the frontend API client are becoming broad files with weak domain ownership;
- CI and lint guardrails should catch common regressions before merge.

## Goals

- Make the app easier to understand by organizing it around daily work, work discovery, project operation, planning, and administration.
- Make project pages feel like one project workspace with persistent project identity and section navigation.
- Make planning review-first, with milestone management available but no longer dominating the default decision surface.
- Make cross-project work discovery a first-class workspace destination.
- Make My Work a prioritized daily queue with lower scan cost.
- Improve work item list readability on smaller screens.
- Normalize terminology and visual hierarchy for blocked, dependency-blocked, and blocking work.
- Extract the highest-value shared frontend components and backend policy/query modules.
- Add lightweight CI/lint guardrails appropriate for a growing reference app.
- Refresh the public site around a v0.1.0 baseline story.

## Non-Goals

- Do not replace Angular, Express, Drizzle, or Postgres.
- Do not introduce a heavy frontend state framework.
- Do not build a complete design system.
- Do not add hosted SaaS authentication, billing, tenancy, notifications, or integrations.
- Do not redesign the public site from scratch.
- Do not attempt to generate all API code from OpenAPI.
- Do not make large speculative abstractions for jawstack.

## Target Users

### Project Contributor

Uses Worktrail to understand assigned work, blockers, due dates, recent updates, comments, and next actions.

### Project Owner

Uses Worktrail to monitor project delivery, identify risks, manage milestones, review dependency blockers, and keep project work moving.

### Workspace Maintainer

Uses Worktrail to find work across projects, manage saved views, inspect workspace activity, administer members, and maintain project hygiene.

### Reference-App Developer

Uses Worktrail as a production-shaped TypeScript application example with Angular, a transport-neutral API boundary, Postgres persistence, OpenAPI documentation, and deployable static frontend patterns.

## Product Principles

- **Review before administration:** default screens should surface what needs attention before exposing management controls.
- **One workflow, one home:** daily execution, discovery, project operation, planning, and settings should each have an obvious place.
- **Keep context visible:** users should know the project, section, active filters, and return path without reconstructing state.
- **Make power progressive:** advanced filters, saved-view management, and bulk-like controls should be available without dominating the default view.
- **Use consistent language:** the same risk condition should have the same name everywhere.
- **Refactor with product intent:** code extraction should follow real product concepts, not abstract layering for its own sake.

## Scope

### 1. Information Architecture And Navigation

Create a clearer navigation model for the current product.

Requirements:

- Promote cross-project work discovery as `Work Items` in the primary navigation.
- Rename or reposition the current global `Workspace` destination so administration is not confused with cross-project work.
- Keep `My Work`, `Work Items`, `Projects`, workspace administration, and `Create` as distinct primary concepts.
- Add a shared project shell for project-scoped routes.
- Show persistent project identity in the shell:
  - project name;
  - project key;
  - project status;
  - delivery-health state when available.
- Add consistent project subnavigation:
  - `Overview`;
  - `Work`;
  - `Board`;
  - `Planning`;
  - `Settings`.
- Keep project-scoped primary actions in a predictable area.
- Preserve archived/read-only notices across project views.

Acceptance criteria:

- From any project page, a user can identify the current project, current project section, project status, and primary available action.
- The cross-project work item hub is reachable from top-level navigation without knowing a direct URL.
- Project section labels and active state are consistent across project routes.

### 2. Planning Review Consolidation

Rework planning so the default experience answers "what needs attention?" before asking users to manage milestone records.

Requirements:

- Make planning review the primary page surface.
- Put delivery health, top reasons, needs-attention work, upcoming work, recently changed work, and milestone progress in the main scanning path.
- Move milestone creation and editing into a secondary management surface:
  - tab;
  - drawer;
  - below-the-review management section;
  - or another implementation that clearly separates review from administration.
- Render milestones in compact read-only form for contributors and archived/read-only projects.
- Collapse detailed risk lists after a small number of items while preserving access to the full lists.
- Make health reason links and risk sections use consistent terminology and destinations.

Acceptance criteria:

- A project owner can open Planning and identify the top delivery risks before interacting with milestone edit controls.
- Milestone management remains complete but no longer dominates the first planning viewport.
- Long risk sections are scannable and expandable.

### 3. Work Discovery Streamlining

Make cross-project and project-scoped work item discovery feel like one product pattern.

Requirements:

- Compact saved views into a picker-first control:
  - view picker;
  - save/update action;
  - manage action for rename/delete.
- Move saved-view management out of the default result-scanning path.
- Group filters into core and advanced controls.
- Keep active filters visible above results.
- Add removable active filter chips where appropriate.
- Share filter metadata, labels, serialization, and active-chip formatting between project and workspace work item lists.
- Preserve current filter capabilities unless explicitly replaced by a clearer equivalent.
- Use consistent terminology:
  - `Status: Blocked`;
  - `Blocked by dependency`;
  - `Blocking other work`.

Acceptance criteria:

- A user can open `Work Items`, apply a common filter, see matching results, and save or update a view without passing through a large management table.
- Active filter chips represent filters that are actually applied.
- Project and workspace filter labels do not drift for the same concept.

### 4. My Work Daily Queue

Turn My Work into a clearer prioritized daily work queue.

Requirements:

- Make the default first section `Needs attention`.
- Include overdue, due soon, blocked, blocked-by-dependency, stale assigned work, and similar urgent assigned signals.
- Reduce duplicate display of the same item across default sections.
- Keep summary cards, but use them as queue filters or section controls rather than duplicating full categories.
- Hide or collapse empty low-signal sections.
- Keep reported-by-me visible as a secondary view or section without overwhelming assigned work.
- Apply section-appropriate sort intent:
  - due date for due work;
  - priority/risk for blocked work;
  - updated date for recent work.

Acceptance criteria:

- A contributor can open My Work and quickly identify the next few items that need action.
- The same item is not repeatedly presented across several default sections unless there is a strong reason.
- Empty states support scanning instead of consuming page space.

### 5. Mobile And Responsive Work Item Lists

Improve readability for core work item scanning at narrow widths.

Requirements:

- Keep table-style layouts for desktop work item lists.
- Render card-style result rows for project and workspace work item lists on small screens.
- Mobile cards should include:
  - title;
  - display key;
  - project when cross-project;
  - status;
  - priority;
  - assignee;
  - milestone and due date when available;
  - dependency signal when applicable.
- Put dense filters behind a compact filter control on mobile while keeping active chips visible.
- Avoid horizontal overflow and clipped table-like fragments on common mobile widths.

Acceptance criteria:

- Mobile users can scan work item results without interpreting clipped columns.
- The same filter state remains understandable on desktop and mobile.

### 6. Work Item Detail Context And Readability

Make the work item detail page feel more like a readable record with editing available, rather than a large edit form with supporting panels.

Requirements:

- Surface status, assignee, milestone, due date, priority, labels, and dependency state near the title.
- Preserve return context from filtered lists, boards, and health links when practical.
- Elevate dependency health when the item is blocked by dependency or blocking other open work.
- Keep relationships, comments, and activity available without making the page harder to scan.
- Consider tabs or focused panels if detail content continues to grow.

Acceptance criteria:

- A user can understand a work item's current state before editing fields.
- Returning from detail preserves the user's prior workflow context in common navigation paths.

### 7. Technical Consolidation

Reduce the main implementation seams that would slow v0.1.x development.

Requirements:

- Extract large route components into page containers plus focused child components.
- Prioritize these extraction targets:
  - shared work item filters;
  - shared work item result table/cards;
  - saved views panel/control;
  - planning review;
  - milestone manager;
  - relationship panel;
  - comment thread;
  - activity timeline.
- Consolidate work item query parsing, normalization, serialization, and repository predicates around a canonical query model.
- Extract shared risk/domain policy constants and predicates for:
  - open and terminal status;
  - due soon and overdue;
  - stale in-progress;
  - active-unassigned statuses;
  - shared risk windows.
- Split shared contracts by domain while preserving the current package exports.
- Split Express route registration by domain while preserving transport-neutral handlers.
- Split the frontend API service into domain clients over a shared low-level API client.
- Extract repeated frontend helpers for API error messages, display names, tokens, pills, and filter option metadata.

Acceptance criteria:

- New work item filters have one canonical query path.
- Risk-window changes have one policy home.
- The largest route components are decomposed into named, testable pieces.
- API route registration and frontend API calls have obvious domain ownership.
- Existing behavior remains covered by updated tests.

### 8. Guardrails And Verification

Add lightweight project guardrails suitable for a growing reference app.

Requirements:

- Add CI for at least:
  - install;
  - typecheck;
  - unit tests;
  - production build.
- Add initial ESLint coverage for API, web, and shared TypeScript where practical.
- Start with low-churn rules that catch real defects:
  - unused imports/variables;
  - floating promises;
  - avoid explicit `any` where the current code can support it;
  - consistent type imports where practical.
- Add contract or query tests for representative work item query examples.
- Preserve existing Playwright smoke coverage and expand it only where needed for the v0.1.0 UX changes.
- Keep OpenAPI and operational docs aligned with any endpoint or workflow changes.

Acceptance criteria:

- Pull requests can run typecheck, tests, and build without relying on manual local verification.
- Lint catches common accidental regressions without forcing a broad style rewrite.
- Query behavior is protected by focused tests.

### 9. Public Site v0.1.0 Refresh

Update the static site so it presents Worktrail as a consolidated product/reference-app baseline.

Requirements:

- Shorten hero and metadata copy.
- Present Worktrail as a local-first project-management reference app for daily work, dependency-aware planning, delivery health, and production-shaped TypeScript architecture.
- Replace the flat feature inventory with grouped workflow sections:
  - daily execution;
  - work discovery;
  - project planning;
  - dependency visibility;
  - workspace governance;
  - operational reference.
- Separate product value from developer/reference-app value.
- Replace release-history prose with a compact `v0.1.0 baseline` section.
- Group architecture content into fewer layers.
- Simplify current-scope limitations into concise groups.
- Refresh the primary screenshot after the UX consolidation lands if the current board screenshot no longer represents the center of gravity.
- Keep the site static and deployable through the existing GitHub Pages workflow.

Acceptance criteria:

- A visitor can explain Worktrail in one sentence after reading the hero.
- The first product section communicates workflows, not sprint history.
- Major capabilities are represented without showing a long equal-weight feature-card inventory.
- Product and developer audiences both have clear entry points.

## Complementary Feature Scope

This release should be conservative with net-new capability. The audits identify enough high-value product and technical work to consume a full sprint.

Small complementary additions are acceptable only when they directly support polish:

- preserved return context from detail pages;
- better empty states and result summaries;
- section-level counts for planning and My Work;
- lightweight "showing filtered results" summaries;
- direct links from health reasons and planning sections into filtered work lists.

Larger features should be deferred:

- notifications;
- dashboard charts;
- bulk editing;
- custom workflows;
- integrations;
- cloud infrastructure automation;
- hosted multi-user authentication.

## Documentation Scope

Update project documentation to reflect the v0.1.0 baseline:

- README feature summary and setup notes;
- architecture notes if route/client/contract boundaries change;
- operations runbook if CI, preview, readiness, or OpenAPI guidance changes;
- extraction notes for patterns relevant to jawstack;
- v0.1.0 implementation notes as phases are completed.

## Success Metrics

v0.1.0 should be considered successful if:

- a new user can explain the app structure after visiting three pages;
- a project owner can open Planning and identify top risks without scrolling past milestone edit forms;
- a contributor can open My Work and know what to do next;
- a maintainer can find cross-project work from primary navigation;
- active filters, saved views, and health links behave consistently;
- mobile work item results are intentionally readable;
- the largest frontend and backend coordination points are smaller and easier to modify;
- CI catches type, unit, and build regressions before merge;
- the public site feels like a polished v0.1.0 baseline rather than accumulated release notes.

## Risks

- UX consolidation may touch many routed pages and create regression risk.
- Component extraction can become too broad if it turns into a design-system rewrite.
- Query consolidation can accidentally change saved-view, CSV export, health-link, or project-list behavior.
- Planning layout changes can hide milestone management if the secondary surface is not discoverable.
- CI and lint setup can become noisy if the initial rule set is too aggressive.
- Public-site refresh may need a new screenshot after app changes land.

## Open Decisions

These can be resolved in technical design:

- Whether project shell route composition should use parent Angular routes, wrapper components, or local composition inside each route.
- Whether planning milestone management should be a tab, drawer, or below-review section.
- Whether saved-view management should use a drawer, modal, inline expander, or separate management page.
- Which route components should be decomposed in v0.1.0 versus deferred.
- How strict the first ESLint rule set should be.
- Whether E2E should run on every PR or remain local/manual with CI covering typecheck, unit tests, and build.

## Release Positioning

Worktrail v0.1.0 should be positioned as the first consolidated baseline:

> A local-first project-management reference app for daily execution, cross-project discovery, dependency-aware planning, delivery health, and production-shaped TypeScript architecture.

The release should make Worktrail feel less like a growing demo and more like a coherent, adoptable product foundation.
