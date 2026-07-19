# Worktrail v0.1.7 PRD

## Summary

Worktrail v0.1.7 should make milestone planning easier to review, share, and act on.

The last several releases made work discovery reliable and operational:

- v0.1.2 made filtered work views trustworthy.
- v0.1.3 and v0.1.4 made saved workspace and project views reusable.
- v0.1.5 made important saved views visible as pinned operating lenses.
- v0.1.6 made project views actionable through project-scoped batch triage.

The next product gap is milestone review. Worktrail has project milestones, delivery health, planning review, filtered project work, pinned views, and batch updates, but milestone-level planning is still spread across several surfaces. A project maintainer can see milestone progress in Planning and can filter Work by milestone, but there is no focused place to answer:

- What is the current state of this milestone?
- What work is in scope?
- What is putting this milestone at risk?
- What changed recently?
- Where should the team go next to triage the risk?

The product theme is Milestone Review. The release should add a focused, shareable milestone review surface that turns each milestone into a lightweight operating page: progress, health, scope, risk, recent movement, and links into filtered/batch-triage workflows.

This sprint should improve planning utility without becoming a forecasting product. It should reuse current deterministic health rules, query contracts, and batch triage rather than adding custom formulas, background jobs, or saved review snapshots.

## Context

Worktrail now supports:

- project work pages with reliable URL-backed filters;
- project saved views and pinned project operating lenses;
- project batch triage for selected visible work items;
- project milestones with due dates and lifecycle state;
- project delivery health derived from milestones, work item state, due dates, assignment, stale work, and dependencies;
- planning review sections for needs attention, upcoming work, and recently changed work;
- milestone progress rows with health labels and reason chips;
- dependency-aware project work and planning links;
- comments, watchers, activity, notifications, CSV import/export, and OpenAPI documentation.

The foundations are strong, but the milestone experience still behaves like a summary embedded in a broader planning page. That works for scanning an entire project. It is weaker when a team is discussing one milestone in a standup, release review, QA handoff, or stakeholder update.

Milestones are a natural planning unit for project management software. They need a dedicated review surface before Worktrail adds heavier planning concepts such as forecasts, snapshots, roadmaps, or release sign-off workflows.

## Problem

Milestone context is currently fragmented.

Current friction:

- milestone progress rows summarize risk but do not provide enough detail in place;
- users must jump from Planning to filtered Work and mentally reconstruct milestone scope;
- health reason links are useful but narrow, and they do not provide a complete milestone operating picture;
- recent work movement is project-level, not milestone-centered;
- milestone review links are not first-class shareable destinations;
- batch triage can update milestone-scoped work, but the Planning page does not clearly hand users into that workflow;
- a contributor can see milestone health but does not have a clean read-only review page for stakeholder context;
- future pattern extraction lacks evidence for derived detail pages that aggregate multiple existing query and health contracts.

For project teams, milestone review is a repeated ritual. A reference app should make that ritual feel intentional: open the milestone, inspect the scope, understand the risks, and act through the existing Work surface.

## Goals

- Add a focused milestone review surface for each project milestone.
- Make milestone progress rows and milestone-related planning items link into that surface.
- Show milestone identity, lifecycle state, target date, progress, health, and explainable reasons.
- Show scoped work composition by status, priority, assignment, due date, and dependency state.
- Show milestone-specific risk sections:
  - blocked work;
  - dependency-blocked work;
  - overdue work;
  - due-soon work;
  - unassigned active work;
  - stale in-progress work;
  - blocking open work.
- Show milestone-specific recently changed work.
- Provide clear links into filtered project Work for the full milestone scope and each risk section.
- Preserve the ability to use v0.1.6 project batch triage after following those filtered Work links.
- Support copyable/shareable milestone review URLs.
- Keep archived projects and archived milestones readable while preserving current write restrictions.
- Add deterministic seed and Playwright coverage for a milestone review workflow.
- Update release docs and destination-neutral pattern notes around derived review surfaces.

## Non-Goals

- Do not add forecasting, velocity, capacity planning, critical path, burndown, burnup, or confidence scoring.
- Do not add saved milestone review snapshots.
- Do not add milestone approvals, sign-off, release gates, or stakeholder comment workflows.
- Do not add timeline or roadmap visualizations.
- Do not add custom health formulas.
- Do not add notification rules for milestone health changes.
- Do not add project-specific membership or custom planning permissions.
- Do not add automatic workflow transitions or automation rules.
- Do not add milestone-level attachments.
- Do not add cross-project milestone rollups.
- Do not add new charting libraries unless the technical design finds a very small, justified use.
- Do not change CSV import/export formats.
- Do not extract a generic planning framework.

## Target Users

### Project Maintainer

Wants to open a milestone during planning or release review, understand the current risk, and move quickly into filtered project Work to triage assignments, labels, due dates, priority, or status.

### Contributor

Wants a readable milestone page that explains what is in scope, what is risky, and which work items need attention without exposing controls they cannot use.

### Workspace Owner

Wants projects to use consistent planning rituals and share milestone review links in status conversations.

### Individual Power User

Wants a fast way to jump from a milestone to the exact filtered work list needed for cleanup or batch triage.

### Reference-App Developer

Wants product evidence for derived review pages that aggregate existing domain rules, query contracts, and action links without inventing new persistence too early.

## Product Principles

- **Milestones deserve a place:** a milestone is more than a filter value; it is a planning object users discuss and review.
- **Explain risk before adding prediction:** deterministic, explainable health is more useful than premature forecasting.
- **Action should stay in Work:** milestone review should summarize and route to filtered project Work, where existing selection and batch triage already live.
- **Shareable context matters:** a milestone review URL should be useful in a chat, meeting agenda, or status note.
- **Read-only should still be valuable:** contributors and archived-project readers should get full review context without misleading mutation controls.
- **Reuse derived rules:** health, risk, and query behavior should come from existing policy paths unless a gap is explicitly identified.
- **Keep review compact:** the page should support fast scanning, not become a dashboard of charts.

## Scope

### 1. Milestone Review Surface

Add a focused review surface for a single milestone.

Candidate route:

```text
/projects/:projectId/milestones/:milestoneId
```

The technical design may choose a route under Planning if that better matches the current Angular shell, but the user-facing result should be a shareable milestone review destination.

Requirements:

- Show milestone identity:
  - name;
  - description;
  - status;
  - target date;
  - archived state;
  - project key/name.
- Show milestone progress:
  - total scoped work;
  - open work;
  - done work;
  - blocked work;
  - dependency-blocked work;
  - completion percentage.
- Show milestone delivery health:
  - health state;
  - reason chips;
  - clear empty state when no work is in scope.
- Include navigation back to:
  - project Overview;
  - project Planning;
  - project Work filtered to the milestone.
- Preserve project shell context and responsive layout.

Acceptance criteria:

- A user can open a milestone review page from a direct URL.
- A user can reach milestone review from the project Planning milestone progress list.
- Milestone review clearly identifies the milestone and project.
- The page is useful for read-only users and archived projects.
- Missing, cross-workspace, or invalid milestone ids produce the existing not-found/error behavior.

### 2. Milestone Scope And Risk Breakdown

Show a practical breakdown of milestone-scoped work.

Requirements:

- Show compact counts by:
  - status;
  - priority;
  - assignee state;
  - due-date state;
  - dependency state.
- Show risk sections for milestone-scoped work:
  - blocked;
  - dependency blocked;
  - overdue;
  - due soon;
  - unassigned active;
  - stale in progress;
  - blocking open work.
- Use the same risk windows and definitions currently used by My Work, Planning, and delivery health.
- Sort risk items predictably:
  - urgent/high priority first where priority matters;
  - earlier due dates first where due date matters;
  - oldest stale work first for stale sections.
- Keep section item previews capped so the page remains scannable.
- Provide a clear empty state for healthy or empty sections.

Acceptance criteria:

- Risk counts match filtered project Work results for the same milestone and risk condition.
- Risk sections do not include work from another milestone or project.
- Archived and completed/canceled milestone states remain readable.
- Empty milestones do not render misleading health or risk copy.

### 3. Filtered Work And Batch Triage Entry Points

Make milestone review actionable by linking into existing project Work workflows.

Requirements:

- Provide an `Open scoped work` action that routes to project Work filtered by the milestone.
- Provide risk-specific links that route to project Work filtered by:
  - milestone plus blocked status;
  - milestone plus dependency-blocked state;
  - milestone plus overdue due-date state;
  - milestone plus due-soon due-date state;
  - milestone plus unassigned active work where query support allows;
  - milestone plus stale in-progress work where query support allows.
- Prefer existing `WorkItemQuery` fields. If a risk cannot be represented exactly by current query params, use the closest honest query and make the PRD/design gap explicit.
- Preserve copy-link, active filter chips, CSV export, saved/pinned view behavior, and batch triage on the destination Work page.
- Do not preselect rows from the milestone review page. Selection remains temporary Work-page interaction state.

Acceptance criteria:

- Following a milestone action opens project Work with visible active filter chips.
- Existing project Work batch triage remains available for owner/maintainer users after following a milestone link.
- Contributor users can follow the same links but do not see batch mutation controls.
- Link behavior is deterministic enough for Playwright coverage.

### 4. Recently Changed Milestone Work

Add milestone-specific recent movement.

Requirements:

- Show recently changed milestone-scoped work items.
- Include enough metadata for scanning:
  - display key;
  - title;
  - status;
  - priority;
  - assignee;
  - due date;
  - updated timestamp.
- Link each item to its work item detail page with a return URL back to milestone review.
- Keep the list capped and sorted by most recently updated first.
- Do not add a new activity feed endpoint unless the technical design finds the existing work item data insufficient.

Acceptance criteria:

- A recently updated milestone work item appears in the recent movement section.
- Opening and returning from a work item detail preserves milestone review context.
- Empty recent movement renders a concise empty state.

### 5. Planning Integration

Connect the existing Planning page to milestone review.

Requirements:

- Make milestone progress rows or row actions link to the milestone review surface.
- Planning review items that reference a milestone should link to milestone review when appropriate.
- Reason chips that already route to filtered Work should keep doing so where that is the clearest action.
- Add compact copy that distinguishes:
  - reviewing the milestone;
  - opening filtered work;
  - managing milestone metadata.
- Preserve the existing Planning `Review` and `Milestones` tabs.

Acceptance criteria:

- A project maintainer can move from Planning to a milestone review in one click.
- Existing milestone create/edit/archive/reactivate behavior still works.
- Planning remains review-first and does not become visually dominated by the new surface.

### 6. API And Contracts

Add or extend API support for milestone review.

Candidate route:

```text
GET /api/projects/:projectId/milestones/:milestoneId/review
```

The endpoint should return a derived review DTO. It should not introduce persisted snapshot data in v0.1.7.

Requirements:

- Validate that the project belongs to the actor workspace.
- Validate that the milestone belongs to the route project.
- Return milestone identity and project identity.
- Return progress, health, reason chips, scoped counts, risk sections, and recent movement.
- Reuse delivery-health and planning risk policy where possible.
- Include work item query payloads or query hints for actionable links where useful.
- Keep response shape stable enough for OpenAPI documentation and web tests.

Acceptance criteria:

- API tests cover active, archived, empty, at-risk, and not-found milestone review cases.
- Contract types are exported from `@worktrail/contracts`.
- OpenAPI documents the milestone review endpoint and response schemas.
- The endpoint remains transport-neutral and compatible with the local Express adapter.

### 7. Seed Data And Browser Coverage

Add deterministic evidence for milestone review.

Requirements:

- Ensure seeded data includes at least one active milestone with:
  - open work;
  - blocked or dependency-blocked work;
  - due-soon or overdue work;
  - recently changed work.
- Ensure seeded data includes at least one healthier milestone for contrast if current seed data does not already provide it.
- Add Playwright coverage for:
  - opening a seeded milestone review from Planning;
  - verifying progress/health/risk content;
  - following a risk link to filtered project Work;
  - confirming owner/maintainer batch triage remains available on the destination Work page;
  - confirming contributor/read-only review remains usable without mutation controls where practical.

Acceptance criteria:

- `npm run db:reset && npm run db:migrate && npm run db:seed` produces deterministic milestone review data.
- The Playwright smoke test passes from a fresh seed.
- Existing browser smoke workflows remain stable.

### 8. Documentation, Release Notes, And Pattern Notes

Document the milestone review release.

Requirements:

- Update README capability, walkthrough, limitation, and local verification sections.
- Update the public static site if milestone review should be promoted in product copy.
- Add `docs/v0.1.7/release-notes.md` during finalization.
- Add destination-neutral pattern notes covering:
  - derived review surfaces;
  - query-backed action links;
  - read-only operating pages;
  - aggregation of existing health/risk rules;
  - when not to persist snapshots.
- Avoid references to discontinued extraction destinations.

Acceptance criteria:

- Documentation matches implemented behavior.
- Pattern notes are product-evidence focused and destination-neutral.
- Public site does not overstate forecasting, deployment, auth, or production readiness.

## User Stories

### Maintainer Reviews A Risky Milestone

As a project maintainer, I open Planning, select an at-risk milestone, review the work putting it at risk, then open the filtered Work page for blocked or overdue work so I can batch triage the relevant items.

Acceptance criteria:

- Planning links to milestone review.
- Milestone review shows risk and progress.
- Risk links open filtered project Work.
- Batch triage remains available on the filtered Work page for a maintainer.

### Contributor Checks Milestone Context

As a contributor, I open a milestone review link shared by the team and understand what is in scope, what is blocked, and which items changed recently without seeing controls that imply I can manage the milestone or bulk mutate project work.

Acceptance criteria:

- Contributor can open milestone review.
- Contributor can open scoped work and individual work items.
- Contributor does not see owner/maintainer-only mutation controls.

### Owner Shares Milestone Status

As a workspace owner, I copy a milestone review URL into a meeting note so team members can return to the same planning context later.

Acceptance criteria:

- Direct milestone review URL reloads correctly.
- Work item detail links preserve a return path back to milestone review.
- The page includes stable project and milestone identity.

### Developer Validates Derived Review Contracts

As a developer, I can test milestone review derivation through contract, API, UI, and browser tests without adding persistence that is not yet justified.

Acceptance criteria:

- Milestone review DTOs are contract-owned.
- API tests cover derived risk sections.
- Web tests cover rendering and links.
- No new snapshot table is added in v0.1.7.

## UX Requirements

- Keep the milestone review page dense but readable.
- Use compact summary rows and restrained panels rather than marketing-style cards.
- Use badges/chips only where they clarify status, priority, health, or reason.
- Use familiar links and buttons for actions:
  - review milestone;
  - open scoped work;
  - open risk work;
  - copy link if implemented through existing copy-link affordances.
- Do not introduce large illustrations, decorative gradients, or oversized hero sections.
- Ensure long milestone names, work item titles, member names, and labels do not overflow.
- Ensure mobile layout stacks sections clearly and preserves work item scanability.
- Keep keyboard focus order predictable from summary to risk sections to action links.

## Permissions And Lifecycle

- Any active workspace member who can read the project can read milestone review.
- Owners and maintainers keep existing milestone management and project batch mutation capabilities.
- Contributors can review milestone data and open work, but do not gain new mutation rights.
- Archived projects remain readable and block existing write paths.
- Archived milestones remain readable.
- Completed and canceled milestones remain readable.
- Not-found behavior should avoid leaking cross-workspace or cross-project ids.

## Data And Migration Expectations

v0.1.7 should not require a schema migration unless the technical design identifies a small metadata gap that cannot be avoided.

Expected data approach:

- derive milestone review from existing projects, milestones, work items, members, relationships, and delivery-health rules;
- use existing work item updated timestamps for recent movement;
- use existing query serialization for action links;
- keep snapshots, manual review notes, and historical milestone status records out of scope.

## API Expectations

Candidate additions:

- `GET /api/projects/:projectId/milestones/:milestoneId/review`

Possible response areas:

- `project`;
- `milestone`;
- `progress`;
- `health`;
- `scopeBreakdown`;
- `riskSections`;
- `recentlyChangedWork`;
- `links` or query payloads for filtered project Work destinations.

OpenAPI should document all new DTOs and error behavior.

## Test Strategy

Required coverage:

- Contract tests for milestone review DTO shape if helpers are added.
- API tests for:
  - active milestone review;
  - empty milestone review;
  - risky milestone review;
  - archived project readability;
  - archived milestone readability;
  - invalid project/milestone combinations;
  - query payloads for risk links.
- Web tests for:
  - milestone review rendering;
  - Planning link integration;
  - risk link generation;
  - return URL behavior from work item detail links;
  - read-only/contributor affordances;
  - responsive-safe long text where practical.
- Playwright smoke coverage for the seeded milestone review workflow.
- Regression coverage for existing Planning, project Work, batch triage, saved/pinned views, and delivery-health flows touched by this sprint.

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

Because Worktrail is still a local reference app, success is measured through implementation quality and workflow coverage:

- A seeded milestone review can be opened from Planning and by direct URL.
- The page answers progress, health, scope, risk, and recent movement without requiring manual filter reconstruction.
- Risk links route into filtered project Work using existing query behavior.
- Maintainers can continue from milestone review into project batch triage.
- Contributors get useful read-only context.
- Existing project Planning and Work workflows remain intact.
- The implementation produces reusable evidence for derived review surfaces without adding unnecessary persistence.

## Risks And Mitigations

### Risk: Milestone Review Duplicates Planning

Mitigation: keep Planning as the project-wide review surface and milestone review as the single-milestone drill-in. Link between them clearly.

### Risk: Scope Creep Toward Forecasting

Mitigation: explicitly defer prediction, capacity, roadmap, and critical path features. Use deterministic health and risk rules only.

### Risk: Risk Links Cannot Express Every Section Exactly

Mitigation: prefer exact existing query fields. Where not possible, use honest closest-match links and document the query gap for future work.

### Risk: The Page Becomes Too Dense

Mitigation: cap preview lists, use compact summaries, and route deep work back to filtered project Work.

### Risk: Derived DTO Logic Diverges From Delivery Health

Mitigation: reuse existing health/risk helpers where practical and add tests that compare review counts to known seeded work.

## Open Decisions

- Should the milestone review URL be `/projects/:projectId/milestones/:milestoneId` or a Planning child route such as `/projects/:projectId/planning/milestones/:milestoneId`?
- Should milestone review render as a full page, a route-backed drawer, or a Planning sub-view?
- What is the exact recent-movement cap and time window?
- Which risk sections can be represented exactly by current `WorkItemQuery`, and which require query model additions?
- Should copy-link be a dedicated milestone review action in v0.1.7, or is browser URL copying sufficient for the first version?
- Should completed/canceled milestones show the same risk sections or a reduced historical summary?

## Recommendation

Proceed with v0.1.7 as Milestone Review.

This is the highest-leverage next step because it strengthens an existing product area rather than adding a disconnected feature. It ties together planning, delivery health, query contracts, filtered Work, return URLs, and batch triage into a coherent workflow that teams would actually use during project execution.

It also gives the reference app better architectural evidence: derived read models, route-backed review pages, query-backed action links, and clear boundaries between review, mutation, and future snapshot persistence.
