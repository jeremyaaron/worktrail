# Worktrail v0.0.5 Jawstack Extraction Notes

## Purpose

These notes capture implementation patterns that emerged while building v0.0.5. They are observations, not framework commitments. The useful extraction point is where the same pressure appears across multiple concrete applications.

## Actor-Centered Dashboard

v0.0.5 added My Work as the default app route. The dashboard is derived from existing work item data rather than creating a separate task list, and every summary count links to a filtered cross-project discovery URL.

Potential extraction:

- actor-centered dashboard service convention;
- summary-count DTOs that include both label/count and query intent;
- dashboard sections with scan limits but count totals from complete result sets;
- route links from summary metrics to reusable discovery query state;
- actor-change refresh behavior for local development and future authenticated sessions.

Do not extract yet:

- configurable dashboards;
- widget layouts;
- notification digests;
- analytics or telemetry dashboards.

## URL-Backed Cross-Resource Discovery

The workspace work item discovery page made query state the center of the workflow. Filters are represented in shared contracts, encoded in URL query params, and converted consistently between forms, links, saved views, and API requests.

Potential extraction:

- typed query contract shared across frontend and backend;
- query-to-URL and URL-to-query helper conventions;
- active filter pills derived from applied state only;
- lookup label resolution for related resources;
- archived-resource inclusion modes for discovery surfaces.

Do not extract yet:

- generic query builders;
- server-driven filter schemas;
- full-text search abstractions;
- shared filter components across unrelated domains.

## Personal Saved Views

Saved work views store validated query payloads as Postgres `jsonb` and scope ownership to the acting member. The UI keeps saved views close to the discovery surface instead of adding a separate management screen.

Potential extraction:

- saved-query table shape with owner, visibility, name, query, and timestamps;
- strict query validation before persistence;
- duplicate-name validation by owner and visibility;
- saved view CRUD endpoint conventions;
- stale-reference tolerance when saved query targets change or disappear.

Do not extract yet:

- shared workspace views;
- foldering, pinning, favorites, or ordering;
- saved views across arbitrary resource types;
- access-control matrices for shared views.

## Route-Based Quick Capture

The quick create route reused the project-scoped work item create experience while allowing the project to be selected first. The route returns a success panel with explicit next actions instead of forcing immediate navigation.

Potential extraction:

- dual-mode create page pattern for context-scoped and global routes;
- project-dependent secondary option loading after primary selection;
- success action panel with open/create-another/return choices;
- preserve-input-on-failure behavior for command forms;
- route-level create affordance from global navigation.

Do not extract yet:

- modal command palette;
- generic form generation;
- bulk create workflows;
- keyboard-first command launcher.

## Navigation Summaries

The project list moved from bare project records to navigation summaries with active/archived grouping, local search, work counts, risk counts, and updated timestamps. Newly created projects are wrapped locally with zero-count summaries until the next authoritative reload.

Potential extraction:

- navigation summary DTOs that combine resource identity with operational signals;
- local search by stable key and display name;
- active/archived grouping convention;
- local optimistic summary wrapper after create commands;
- list rows designed for repeated operational scanning.

Do not extract yet:

- pinned projects;
- recent projects persistence;
- portfolio rollups;
- generalized resource navigation framework.

## Deterministic Browser Workflow Restore

The Playwright suite now covers the daily workflow, the governance workflow, and the planning/adoption workflow. It resets and seeds before execution, and it restores deterministic seed data after mutation-heavy browser tests.

Potential extraction:

- e2e database lifecycle with pre-run reset and post-run restore;
- smoke tests organized by release capability rather than component ownership;
- focus and overflow checks embedded in smoke coverage;
- stable local seed data as browser-test fixture source;
- opt-out environment variables for intentional mutation inspection.

Do not extract yet:

- screenshot baselines;
- visual regression infrastructure;
- synthetic data factory framework;
- distributed browser test orchestration.

## Lazy Daily Workflow Frontend

The v0.0.5 frontend added several route-heavy screens while keeping Angular route components lazy-loaded and production bundle warnings clear.

Potential extraction:

- default standalone route generation with `loadComponent`;
- release verification that records production bundle output;
- keeping large feature CSS inside lazy components until shared styles become clearly reusable;
- moving genuinely shared utility styles to global CSS only after duplication appears.

Do not extract yet:

- route preloading strategy;
- microfrontend boundaries;
- automatic bundle budget tuning;
- generalized design token system.

## Cloud Deployment Implications

The daily workflow sprint kept the static Angular frontend path and transport-neutral backend handlers intact. Dashboard, saved-view, and discovery logic live in services behind endpoint handlers, which keeps a future Lambda/API Gateway adapter plausible.

Potential future work:

- Lambda/API Gateway adapter for the existing endpoint handler contract;
- managed Postgres migration runner;
- connection pooling strategy for serverless runtimes;
- identity-provider adapter that resolves authenticated users to workspace members;
- S3/CloudFront deployment template for the lazy-loaded Angular build.
