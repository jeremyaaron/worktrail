# Worktrail v0.0.9 Jawstack Extraction Notes

## Purpose

v0.0.9 added delivery-health visibility to Worktrail. The sprint is useful for jawstack pattern discovery because it turns existing operational facts into explainable dashboard state without adding stored health columns, background jobs, charts, forecasting, or custom formula infrastructure.

These notes capture implementation patterns worth remembering. They are not yet abstractions.

## Product Pattern

The useful product unit was not "analytics." It was a focused planning answer:

- Is this project on track, at risk, blocked, complete, or inactive?
- Which milestone is causing the delivery signal?
- Which work items should be reviewed now?
- Can the user click from a reason into the list that explains it?

The product value came from placing derived confidence signals on existing project overview and planning surfaces, not from creating a separate reporting module.

## Pure Dashboard Derivation Service

Worktrail derives delivery health in `DeliveryHealthService`.

The service accepts already-needed project planning facts:

- project;
- milestones;
- work items;
- dependency-blocked work items;
- blocking-open-work items;
- current time.

It returns:

- project delivery health;
- enriched milestone progress;
- planning review sections.

Extraction signal:

- Put dashboard derivation behind a pure service when the output combines several domain facts.
- Pass the clock explicitly so tests and seed scenarios remain deterministic.
- Keep repository access outside the derivation service; let application services decide which facts to fetch.
- Return the whole derived dashboard shape from one service when outputs share intermediate calculations.

## Persist Facts, Derive Health

v0.0.9 does not store health state in the database.

Health changes when these facts change:

- work item status;
- due date;
- assignee;
- milestone status and target date;
- archived state;
- blocking relationships;
- updated timestamp.

Persisting a separate health state would create synchronization work before the product has enough load or complexity to justify a read model.

Extraction signal:

- Store source-of-truth facts while derivation is cheap and deterministic.
- Add stored read models only when latency, query volume, or historical reporting proves the need.
- Avoid migrations for derived dashboard state unless the stored value is itself a business record.

## Explainable Health Reasons

Health states are paired with reason DTOs.

Each reason includes:

- stable key;
- severity;
- human message;
- count;
- optional work item query.

This keeps the UI honest. A project is not merely "blocked"; it is blocked because specific blocked work, dependency-blocked work, overdue work, or milestone conditions exist.

Extraction signal:

- Derived dashboard status should carry explanation objects, not just a top-level enum.
- Reason keys should be stable contract tokens; UI copy can evolve separately.
- Severity belongs with the reason so compact and detailed surfaces can share the same data.
- A reason without a supported query should still render as text instead of inventing an inaccurate link.

## Query-Linked Metrics

Worktrail reuses `WorkItemQuery` for health reason links.

Examples:

```text
status=blocked
dependency=dependency_blocked
dueDateState=due_soon&sort=due_date_asc
milestoneId=<id>&status=blocked&sort=priority_desc
```

The same query model already powers:

- project work item lists;
- workspace discovery;
- saved views;
- dashboard summary links;
- CSV export.

Extraction signal:

- Dashboard metrics should deep-link to canonical list surfaces whenever possible.
- Reuse the same query DTO across URL state, saved views, APIs, exports, and dashboard links.
- Do not create metric-specific route parameters when an existing list query can explain the metric.
- A metric link should represent the reason faithfully. If the query model cannot express it, render the metric without a link.

## Compact Overview Plus Detailed Planning

v0.0.9 uses two surfaces for the same health model:

- project overview shows a compact delivery-health panel;
- planning shows detailed project health, milestone reasons, review sections, and existing risk lists.

The overview does not fetch the full planning review. It receives compact delivery health through the project summary endpoint. The planning route receives the full planning summary.

Extraction signal:

- Keep overview dashboards concise and action-oriented.
- Put detailed triage on a deeper operational page.
- Share derivation logic while tailoring DTO shape to the consuming surface.
- Avoid forcing lightweight overview routes to fetch detailed review data just because it exists.

## Planning Review Without A Review Entity

The planning review sections are read-time summaries:

- Needs attention;
- Upcoming;
- Recently changed.

They are not stored snapshots. They do not create a new review workflow, assignment model, approval state, or notification flow.

Extraction signal:

- A "review" surface can start as a derived view before becoming a persistent workflow.
- Updated timestamps are sufficient for an early "recently changed" section when activity-event querying would add churn.
- Make review sections deterministic and limited before adding customization or saved dashboard configuration.

## Shared Display Helpers

The Angular app centralizes delivery-health display mapping in a small helper module.

The helper maps:

- health enum to label;
- health enum to visual tone;
- severity to tone;
- reason query to router query parameters.

Extraction signal:

- Keep enum-to-label and enum-to-tone mapping out of individual components.
- Share query serialization helpers anywhere dashboard links use the same query DTO.
- Test display mapping directly because it protects many dashboard components from quiet label drift.

## Cloud-Readiness Implications

The v0.0.9 implementation remains compatible with the current cloud-shaped direction:

- derivation is service-side and transport-neutral;
- endpoint handlers remain independent of Express-specific request objects;
- health state is not stored, so there is no cache invalidation layer yet;
- Postgres remains the source of truth for work facts;
- Angular route lazy loading keeps the frontend deployable as a static app;
- OpenAPI documents the derived response shape.

Future cloud work should revisit:

- read-model caching if project summary latency grows;
- aggregate SQL or materialized views for large workspaces;
- event-driven read model updates if delivery health becomes expensive;
- historical health snapshots if stakeholders need trend reporting;
- tenant partitioning and authorization once production auth exists.

## What Not To Extract Yet

Do not extract a generalized dashboard, health-score engine, or workflow automation system yet.

Current evidence supports smaller reusable ideas:

- pure read-time derivation service;
- explicit clock injection;
- stable reason DTOs;
- query-linked dashboard metrics;
- compact overview plus detailed operational page;
- enum display helper.

The product has not yet proven a need for:

- custom health formulas;
- weighted scores;
- charting;
- saved dashboard layouts;
- review snapshot records;
- notifications;
- critical path analysis;
- cross-project portfolio health.

## Candidate Future Abstractions

If the same pattern appears in another reference app, possible jawstack candidates are:

- a derived dashboard service recipe;
- a reason DTO convention with optional canonical query links;
- a query-linked metric component pattern;
- a compact-summary plus detailed-dashboard route pattern;
- a deterministic review-section builder for read-time planning surfaces.
