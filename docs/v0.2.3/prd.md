# Worktrail v0.2.3 PRD

## Summary

Worktrail v0.2.3 should add a workspace-level portfolio review surface.

Worktrail now has credible project-level operating views: project Work, Board, Planning, Milestone Review, Cycle Review, Reports, saved views, pinned views, dependency signals, and bulk triage. The remaining visibility gap is above the project. A workspace owner or maintainer can inspect one project well, but there is no single place to answer:

- Which projects need attention today?
- Which projects are blocked, at risk, stale, or drifting?
- Which active cycles and milestones are carrying the most risk?
- Which projects have not published a recent status report?
- Where should a maintainer click next to act?

The product theme is Workspace Portfolio Review. v0.2.3 should introduce a read-oriented cross-project operating page that summarizes project health and routes users into the existing action surfaces. It should reuse current derived health, query-backed work links, reports, cycles, milestones, and saved-view patterns rather than creating a new planning model.

The release should be valuable on its own, but it should also prepare Worktrail for later enterprise-readiness work: executive/manager read paths, deployment demos, and scalable read models that can be served locally or behind cloud API adapters.

## Context

Worktrail currently supports:

- workspace-level My Work, Inbox, Work Items discovery, Projects, and Workspace Settings;
- project-level Overview, Work, Board, Planning, Reports, and Settings;
- project delivery health derived from milestones, cycles, work status, due dates, dependencies, assignments, estimates, and stale in-progress work;
- milestone and cycle review pages with risk sections and links into filtered project Work;
- project status reports with immutable snapshots and Markdown export;
- workspace and project saved views with pinned shortcuts;
- cross-project Work Items discovery with URL-backed filters, active chips, copy links, and CSV export;
- deterministic seed data for active, archived, healthy, blocked, at-risk, current-cycle, stale, dependency-blocked, and reporting examples.

The current Projects page is useful for finding a project and seeing lightweight summary counts. It is not yet a portfolio review page. It does not group projects by operational urgency, compare active cycle and milestone signals, show report freshness, or provide a clear "next action" route for each risk.

## Problem

Worktrail has strong project detail, but weak workspace-level operational awareness.

Current friction:

- workspace owners must open projects one at a time to understand portfolio risk;
- maintainers cannot quickly compare active projects by blocked work, overdue work, dependency risk, stale work, or delivery health;
- report freshness is visible only after entering a project's Reports page;
- active cycle and milestone risk is fragmented across project Planning, Cycle Review, Milestone Review, Work lists, and Reports;
- the top-level Projects page is primarily navigational and does not behave like an operating review;
- cross-project Work Items discovery can answer specific filter questions, but users need to know which question to ask;
- there is no workspace-level "start here" surface for team leads reviewing overall execution health.

This matters for product utility because teams adopt project management tools around trust and visibility. A user should not need to know every project context before identifying where attention is needed.

This also matters for Worktrail as a reference app. A portfolio review surface exercises a useful architecture pattern: derived, read-oriented aggregation across existing bounded features without adding premature persistence or a new domain hierarchy.

## Goals

- Add a workspace-level portfolio review page.
- Summarize active project health in one cross-project surface.
- Highlight projects needing attention by clear risk reasons.
- Surface active cycle and milestone context without replacing project Planning.
- Surface latest published report freshness without replacing project Reports.
- Route every actionable signal into an existing focused surface:
  - project Overview;
  - project Work with canonical filters;
  - project Planning;
  - Milestone Review;
  - Cycle Review;
  - Reports;
  - workspace Work Items discovery where cross-project review is appropriate.
- Preserve existing project permissions and archived-project read behavior.
- Keep the first release read-only except for existing linked actions.
- Reuse existing health/risk rules rather than creating conflicting portfolio-only formulas.
- Seed deterministic examples that demonstrate healthy, at-risk, blocked, stale, unreported, and current-cycle portfolio states.
- Cover the surface through API, Angular, and E2E tests.
- Update README, release notes, pattern notes, and product site if the implemented surface changes the public baseline.

## Non-Goals

- Do not add new project hierarchy such as programs, portfolios, initiatives, epics, or themes.
- Do not add cross-project cycles or workspace-wide planning increments.
- Do not add roadmap, Gantt, timeline, critical path, capacity planning, or forecasting.
- Do not add custom health formulas.
- Do not add portfolio-specific comments, approvals, sign-off, subscriptions, or notifications.
- Do not add report scheduling, report recipients, public report links, PDF generation, or analytics.
- Do not add cross-project bulk edit.
- Do not add query-wide durable selection sets.
- Do not add production authentication, invitations, custom roles, project-specific membership, or deployment automation.
- Do not duplicate project Planning inside the portfolio page.
- Do not turn the Projects page into an overloaded dashboard if a separate route is cleaner.
- Do not add persistent portfolio snapshots unless technical design identifies a hard need.

## Target Users

### Workspace Owner

Needs to review all active projects, identify risk, inspect report freshness, and decide where leadership attention is needed.

### Project Maintainer

Works across one or more projects and needs a fast way to find blocked, overdue, stale, unassigned, or unreported project areas before drilling into project Work or Planning.

### Contributor

May need read-only awareness of project health and published reports, but should not see mutation controls beyond the actions already available in project-level surfaces.

### Individual Power User

Uses pinned views and filtered discovery to manage work. Needs portfolio signals to link into the same reliable Work list and review routes already used elsewhere.

### Reference-App Developer

Needs a concrete example of a derived read model that composes existing repositories, services, contracts, endpoint handlers, Angular pages, routing, seed data, and smoke tests without adding avoidable schema.

## Product Principles

- **Portfolio review routes to action:** every risk should have a next click into an existing action surface.
- **Do not invent a second health model:** reuse project delivery health, cycle risk, milestone risk, report state, and work-query semantics.
- **Read first, mutate elsewhere:** portfolio review should help users decide where to act, then route them to the right existing page.
- **Compare before drilling:** the page should make projects easy to scan against each other.
- **Freshness matters:** a project can look operationally healthy but still have stale communication.
- **Respect scope:** archived projects should remain visible where useful, but active execution review should lead with active projects.
- **Derived until proven otherwise:** compute from current state before adding stored snapshots or materialized tables.
- **Cloud-shaped but local-first:** endpoint boundaries should remain suitable for local Express and future API Gateway/Lambda-style adapters.

## Scope

### 1. Workspace Portfolio Route And Navigation

Add a workspace-level portfolio destination.

Requirements:

- Add a top-level route for portfolio review.
- Add primary navigation entry copy that clearly distinguishes portfolio review from Projects navigation.
- Keep Projects focused on finding/opening project records.
- Keep Portfolio focused on cross-project operational review.
- The route should load for all active members who can currently read workspace projects.
- Archived projects should either be excluded by default or placed in a clearly secondary section, depending on technical design.
- The page should have resilient loading, empty, and error states.

Possible route names for technical design:

- `/portfolio`;
- `/projects/portfolio`;
- `/workspace/portfolio`.

Acceptance criteria:

- A user can open Portfolio from primary navigation.
- The page has a clear heading and purpose.
- Users can still access the existing Projects page without behavior loss.
- Empty workspaces show useful empty-state copy and a link to create/open projects when permitted.

### 2. Portfolio Summary

Provide a top-level summary of project health.

Requirements:

- Show counts for:
  - active projects;
  - blocked projects;
  - at-risk projects;
  - projects on track;
  - projects with overdue open work;
  - projects with dependency-blocked work;
  - projects missing recent published reports.
- Use current derived project health where possible.
- Avoid introducing health labels that conflict with project Overview/Planning.
- Link summary counts into filtered sections on the same page or existing project/work routes where useful.
- Make the summary compact enough that project comparison remains visible on common desktop screens.

Acceptance criteria:

- Workspace owner can understand overall portfolio state without opening a project.
- Summary counts match the project rows shown below.
- Summary labels use the same terminology as project-level health and risk surfaces.

### 3. Project Portfolio Rows

Show active projects in a comparison-friendly table or dense card list.

Requirements:

- For each active project, show:
  - project name and key;
  - project status;
  - delivery health;
  - top health reasons;
  - open work count;
  - blocked/dependency-blocked work count;
  - overdue count;
  - stale in-progress count where available;
  - active milestone summary when available;
  - active cycle summary when available;
  - latest published report date/status when available;
  - last updated timestamp.
- Provide row actions/links to:
  - project Overview;
  - project Work;
  - project Planning;
  - latest Report or Reports list;
  - active Milestone Review when useful;
  - active Cycle Review when useful.
- Rows should be sorted by operational urgency by default:
  - blocked;
  - at risk;
  - overdue/dependency risk;
  - stale report;
  - on track;
  - inactive/low-signal projects.
- Let users change sorting if technical design can fit it without turning the release into a full data-grid sprint.

Acceptance criteria:

- A project needing attention appears above healthy projects by default.
- Each row makes the next best drill-down path obvious.
- Users can distinguish work execution risk from report freshness risk.
- Contributors see read links without owner/maintainer-only mutation affordances.

### 4. Cross-Project Attention Sections

Add focused portfolio attention sections that answer common review questions.

Requirements:

- Include a `Needs attention` section with the highest-risk active projects.
- Include a `Communication freshness` section for projects without a recent published report.
- Include a `Current execution` section for projects with active cycles and active milestones.
- Include a `Dependency pressure` section for projects with dependency-blocked work or work blocking downstream items.
- Each section should be compact and link to the relevant existing page/query.
- Use a bounded number of rows per section to keep the page scannable.

Acceptance criteria:

- A workspace owner can identify the top few projects requiring review in under one screenful on desktop.
- Each attention item explains why it appears.
- Each attention item links to the most useful existing Worktrail surface.

### 5. Query-Backed Drill-Down Links

Use existing query contracts for work drill-down.

Requirements:

- Links to workspace Work Items and project Work should use canonical `WorkItemQuery` parameters.
- Risk links should produce active chips consistent with the linked query.
- Dependency, due-date, status, milestone, cycle, and risk filters should behave exactly as they do from Planning, Milestone Review, and Cycle Review.
- Copy-link and CSV export behavior after following a portfolio drill-down link should remain aligned with the applied query.
- Return URLs from work item detail should return users to the portfolio context when practical.

Acceptance criteria:

- Opening a portfolio risk link shows the expected Work list results and active chips.
- Reloading the linked Work URL preserves the applied query.
- Opening and returning from a work item detail page preserves portfolio context where supported.

### 6. Report Freshness

Surface whether projects have recently published status reports.

Requirements:

- Show latest published report date for each active project when one exists.
- Mark projects with no published reports.
- Mark projects whose latest published report is stale according to a simple threshold.
- Default threshold should be simple and product-readable, such as 14 days, unless technical design chooses another value.
- Link to the latest report when present.
- Link to Reports list when no report exists or the user needs to publish one.
- Do not add scheduled reports or report reminders in this release.

Acceptance criteria:

- Users can quickly identify which projects have stale or missing communications.
- Report freshness does not alter delivery health; it appears as a separate communication signal.
- Contributors can read published report links where existing report permissions allow it.

### 7. Seed Data And Walkthrough

Update deterministic seed data if needed to make portfolio review meaningful.

Requirements:

- Ensure seeded projects demonstrate at least:
  - one blocked/at-risk active project;
  - one healthier active project;
  - one archived project;
  - one project with a recent report;
  - one project with stale or missing report freshness;
  - active cycle/milestone context;
  - dependency pressure.
- Avoid excessive new seed records if existing data can support the page.
- Update README walkthrough to include Portfolio.
- Update static site only if the implemented feature materially changes the product story.

Acceptance criteria:

- A fresh seeded database makes the Portfolio page useful immediately.
- E2E smoke can assert the seeded portfolio signals without brittle date assumptions.

### 8. Documentation And Pattern Notes

Document the release and capture reusable observations.

Requirements:

- Update README current baseline and walkthrough.
- Add v0.2.3 release notes.
- Add v0.2.3 pattern notes.
- Capture lessons around derived portfolio read models, freshness signals, and drill-down links.
- Avoid references to any specific extraction destination.

Acceptance criteria:

- Documentation explains what Portfolio is for and how it relates to Projects, Planning, Work, and Reports.
- Pattern notes are destination-neutral.
- Deferred items are explicit.

## Out Of Scope Details

These are intentionally deferred even if implementation makes them tempting:

- portfolio snapshots;
- workspace rollup reports;
- report freshness notifications;
- report scheduling;
- portfolio-level saved views;
- custom portfolio filters;
- project tags/groups;
- program/initiative hierarchy;
- portfolio export;
- portfolio comments;
- portfolio permissions beyond existing workspace membership rules;
- cross-project bulk mutation;
- materialized read-model tables;
- charts beyond compact status/health indicators.

## UX Requirements

- The page should feel operational, not promotional.
- Use dense but readable comparison layouts.
- Keep cards restrained; repeated project rows may be table-like or compact cards depending on responsive design.
- Avoid burying the project list under large hero or explanatory copy.
- Use clear status chips and reason links.
- Use icon buttons only where existing app conventions already support them.
- Mobile should prioritize:
  - summary;
  - needs-attention items;
  - project rows as compact stacked records.
- Text should not overflow chips, buttons, or rows at common desktop and mobile widths.

## Accessibility Requirements

- Portfolio summary counts should have text labels, not color-only meaning.
- Health and freshness states should be screen-reader readable.
- Project row links should have distinct accessible names.
- Attention sections should use meaningful headings.
- Loading, empty, and error states should match existing app accessibility patterns.
- Keyboard users should be able to reach every drill-down link in a predictable order.

## Technical Expectations

- Prefer a derived read model assembled by API services from existing repositories.
- Avoid database migrations unless technical design proves a missing indexed field or relation is necessary.
- Keep endpoint handler logic transport-neutral.
- Add contract DTOs for portfolio summary, project rows, attention sections, freshness state, and drill-down links.
- Reuse existing delivery-health, work-risk, report snapshot parsing, and work-query link helpers where possible.
- Keep Angular route component scope controlled; extract presentational components if the page becomes large.
- Add API tests for aggregation, permissions, archived-project behavior, report freshness, and drill-down query payloads.
- Add Angular tests for loading, empty, risk, report freshness, row links, and responsive-friendly rendering.
- Add E2E smoke coverage for seeded portfolio review.

## Success Metrics

Qualitative:

- A user can identify the riskiest active project without opening each project.
- A user can tell whether project risk is execution risk, dependency pressure, or communication freshness.
- A user can drill from a portfolio signal into the right existing Worktrail surface without guessing.
- The Projects page remains understandable as project navigation.

Verification:

- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run test:e2e`
- `npm run build`
- `npm audit --omit=dev --audit-level=low`
- `git diff --check`

## Open Questions

- Should the primary route be `/portfolio`, `/projects/portfolio`, or `/workspace/portfolio`?
- Should archived projects be hidden by default, placed in a secondary section, or included with a filter?
- What should the report freshness threshold be for v0.2.3: 7, 14, or 30 days?
- Should Portfolio use a table-first desktop layout or compact project cards?
- Should the first release include user-adjustable sorting, or is urgency-first ordering enough?
- Should portfolio attention links prefer project Work or workspace Work Items when both can represent the same risk?
- Should return URLs from linked work item detail point back to Portfolio for every drill-down, or only for portfolio-specific links?

## Proposed Defaults For Technical Design

Unless later technical design finds a better fit:

- Use `/portfolio` as the route.
- Lead with active projects and place archived projects out of scope for the first page, except where existing links can still reach archived project records.
- Use 14 days as the stale report threshold.
- Use a compact table on desktop and stacked project records on mobile.
- Use urgency-first ordering without custom sorting in v0.2.3.
- Link project-specific risk to project Work when the risk belongs to one project.
- Link cross-project summary counts to workspace Work Items only when the user is reviewing a workspace-wide query.
- Preserve return URL context for links that open work item detail.
