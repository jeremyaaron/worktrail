# Worktrail v0.1.0 Jawstack Extraction Notes

## Purpose

v0.1.0 did not add a new product pillar. It consolidated a growing reference app into clearer product places and split several code seams before they became hard to change.

These notes capture patterns worth remembering for jawstack. They are not yet framework abstractions.

## Product Pattern

The useful release unit was "make existing capability feel intentional."

Worktrail already had daily work, projects, planning, saved views, governance, CSV, relationships, dependency signals, and delivery health. The v0.1.0 product value came from reorganizing those capabilities into stable places:

- `My Work` for daily execution;
- `Work Items` for cross-project discovery;
- a persistent project workspace for project operation;
- review-first `Planning`;
- `Workspace Settings` for administration.

Extraction signal:

- A reference app needs periodic consolidation sprints, not only feature sprints.
- Navigation labels should reflect the user's job, not the implementation route where a feature first landed.
- Consolidation is most valuable once the product has enough real workflows for hierarchy decisions to be evidence-based.

## Project Shell

The project shell turned separate project pages into one project workspace.

The shell owns:

- project identity;
- project key and status;
- compact delivery-health signal;
- section navigation;
- archived-project notice placement;
- common loading and error handling for the project summary.

Child pages own their specific workflow content.

Extraction signal:

- Use a shell route when several pages share durable context and section navigation.
- Let the shell fetch the lightest common summary, not every child page's data.
- Keep child route paths stable when introducing a shell; the user-visible improvement should not require API or URL churn.
- Shells are a good place for product identity and high-level operational state, not detailed editing forms.

## Query Consolidation

Work item query behavior became central enough that scattered query logic started to slow changes.

v0.1.0 consolidated around:

- contract-level query tokens;
- API request parsing and normalization;
- repository predicate construction;
- frontend query serialization;
- active filter labels;
- dashboard links;
- saved views;
- CSV export.

Extraction signal:

- Once a query model powers list state, URLs, saved views, exports, and dashboard links, treat it as a product contract.
- Keep parser normalization near the API boundary.
- Keep SQL predicate construction behind a repository query builder.
- Keep frontend serialization and label rendering together so active filters do not drift from actual applied filters.
- Prefer adding query expressiveness to the canonical model over inventing metric-specific URL parameters.

## Risk Policy

Risk windows and status sets are shared by My Work, planning, and delivery health.

The API now centralizes policy such as:

- open status detection;
- active unassigned status detection;
- stale in-progress window;
- due-soon window;
- due date classification.

Extraction signal:

- Repeated "business calendar" and "work risk" rules should become policy helpers before they become configuration systems.
- Policy helpers should be deterministic and easy to unit test.
- UI display labels can be duplicated lightly, but status membership and date-window rules should not be.
- Do not add custom risk formulas until multiple products prove that configurability is needed.

## Route Registration Split

The Express adapter kept transport concerns separate from endpoint handlers, but one broad registration module was becoming a coordination point.

The useful split was domain route registration:

- activity;
- comments;
- health;
- labels;
- members;
- milestones;
- My Work;
- planning;
- projects;
- saved views;
- work items;
- workspace.

Extraction signal:

- Endpoint handlers should remain transport-neutral.
- Adapter registration can be domain-split without changing handler signatures.
- A local Express adapter can coexist with future Lambda/API Gateway or container adapters when request/response adaptation remains at the edge.
- Route registration files are ownership boundaries; they should be boring and easy to scan.

## API Client Split

The Angular app had one broad API service. v0.1.0 split domain clients over one shared request utility, while preserving a facade for existing call sites.

Extraction signal:

- Keep one HTTP request utility for headers, base URLs, parsing, and errors.
- Add domain clients when a facade becomes too broad to navigate.
- Preserve a compatibility facade during refactors so page changes can happen incrementally.
- Domain clients are a good match for route/page ownership: project pages use project/planning clients, work item pages use work item clients, and workspace pages use workspace clients.

## Feature-Local Component Extraction

The most useful frontend extraction was not a global design system. It was feature-local components that reduced route component responsibility:

- `WorkItemFilterPanelComponent`;
- `WorkItemResultListComponent`;
- `SavedViewsToolbarComponent`;
- project shell;
- planning review;
- work item detail summary/activity panels;
- My Work summary and queue components.

Extraction signal:

- Extract components around repeated workflow surfaces before extracting visual primitives.
- A feature-local component is preferable when the abstraction is not yet broadly proven.
- Route components should coordinate route params, loading/error state, and composition; child components should own dense rendering and narrow interactions.
- Responsive alternate renderings, such as work item cards, belong with the result component that owns the data shape.

## CI And Lint Guardrails

v0.1.0 added low-churn ESLint and GitHub Actions CI.

The guardrail set is intentionally small:

- install;
- lint;
- typecheck;
- unit tests;
- production build.

Playwright remains local because it starts the app and resets Postgres.

Extraction signal:

- Add CI when the product surface has enough behavior that regressions are easy to miss locally.
- Start with rules that catch defects and naming hazards rather than style-only churn.
- Include lint in CI only after the baseline can pass with targeted fixes.
- Keep database-backed browser smoke tests outside required CI until infrastructure setup is cheap and stable.

## What Not To Extract Yet

Do not extract a full design system, project-management framework, workflow engine, or deployment platform from v0.1.0.

Current evidence supports smaller reusable ideas:

- shell route pattern;
- canonical query contract pattern;
- risk-policy helper module;
- transport-neutral endpoint handler plus adapter registration;
- domain API clients over a shared request utility;
- feature-local component extraction;
- low-churn CI/lint baseline.

The product has not yet proven a need for:

- custom workflow definitions;
- production authentication and tenancy;
- shared saved views and permissions models beyond local roles;
- notification infrastructure;
- attachment storage;
- critical path analysis;
- AWS deployment templates.

## Candidate Future Abstractions

If these patterns repeat in other reference apps, possible jawstack candidates are:

- `createShellRoute` guidance for persistent entity workspaces;
- query contract and URL serialization conventions;
- policy helper modules for deterministic risk windows;
- route registration modules that target multiple adapters;
- Angular domain-client/facade layering;
- feature-local extraction checklist;
- CI/lint starter profiles for local-first reference apps.
