# Worktrail v0.2.3 Pattern Notes

## Purpose

These notes capture reusable product and architecture signals from the v0.2.3 Workspace Portfolio Review release. They are destination-neutral: the patterns may inform future application infrastructure, project conventions, documentation templates, or no extraction at all.

The bar for extraction remains evidence. A pattern should be generalized only after it appears in multiple concrete workflows and the abstraction would make those workflows simpler to build, test, or operate.

## Derived Operating Read Models

Portfolio is a derived read model over existing project, work, planning, dependency, and report state. It does not introduce stored portfolio snapshots or a new planning hierarchy.

Useful implementation rules:

- derive from canonical domain services where semantics already exist;
- keep aggregation services read-only until a mutation workflow has a clear product owner;
- use a service clock for freshness and time-window tests;
- bound attention lists so summary pages stay scannable;
- add seeded contrast cases so the read model demonstrates value in a fresh local setup.

This pattern is useful when a workspace-level view should coordinate existing surfaces without becoming a second system of record.

## Health Versus Freshness

Portfolio separates delivery health from report freshness. A project can be healthy but missing communication, or blocked with a fresh report.

Useful product rules:

- avoid overloading delivery health with every operational concern;
- label communication freshness separately from execution state;
- let attention sections explain why a signal matters;
- preserve links into the current source-of-truth surface for action.

This pattern helps prevent dashboards from collapsing unrelated operating signals into one ambiguous score.

## Actionable Summary Links

Portfolio rows and attention items are useful because they route to existing Worktrail surfaces. Risk-specific links use the same `WorkItemQuery` serialization as saved views, delivery-health links, reports, and CSV exports.

Useful implementation rules:

- emit route paths and typed query contracts from the read model;
- keep URLs relative to the app, not deployment-specific;
- include query scope when a query can target either workspace or project Work lists;
- reuse canonical query conversion in the frontend instead of hand-building route params;
- cover one representative drill-down in browser smoke tests.

This pattern is useful for summary pages whose value depends on reducing the distance from signal to action.

## Seed Data As Product Evidence

The first seeded Portfolio response had risk-heavy projects but no healthy active comparison. v0.2.3 added a small healthy project rather than weakening existing risk data.

Useful seed rules:

- preserve existing scenarios that older smoke tests depend on;
- add the smallest scenario that proves the new contrast;
- keep seed data deterministic and readable;
- verify derived API output after seed changes, not only inserted rows;
- make browser smoke resilient to earlier e2e tests that create additional records.

This pattern keeps local demos useful while reducing seed churn across incremental product releases.

## Component Splitting For Operating Surfaces

The Portfolio page needed summary, attention, and comparison areas. Splitting those into focused child components kept the route component readable and avoided component style budget pressure.

Useful frontend rules:

- split by product region when a page has distinct scanning tasks;
- keep route components responsible for loading and high-level state;
- put pure labels, tones, date formatting, and link conversion in a small display helper;
- keep child components presentational until local state or mutations justify more;
- run production builds during the phase that expands a page's layout.

This pattern is useful for dense operational pages where one large component would obscure the workflow.
