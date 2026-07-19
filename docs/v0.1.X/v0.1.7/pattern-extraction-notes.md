# Worktrail v0.1.7 Pattern Notes

## Purpose

v0.1.7 adds Milestone Review by composing existing product rules into a focused read-only operating page. The patterns below are extraction candidates for future reference-app infrastructure, but they should remain destination-neutral until repeated use proves they are worth standardizing.

## Derived Review Surfaces

Milestone Review is a derived read model rather than a stored report. It gathers project, milestone, work item, member, dependency, delivery-health, and risk-policy data at read time, then returns a page-shaped DTO.

Useful boundaries:

- keep the page read model behind its own service;
- reuse domain services for health and policy rules;
- let the review service own presentation-specific grouping, ordering, preview limits, and empty sections;
- include source query objects in the DTO when sections have obvious action destinations;
- avoid writing review state until there is a concrete workflow that needs history, approval, or audit evidence.

This pattern is strongest when users need a trustworthy current operating view, not a historical report.

## Query-Backed Action Links

Milestone Review does not duplicate project Work behavior. Risk sections link to project Work with canonical query state, then the destination page exposes the applied filters as active chips.

The reusable shape is:

- source page derives a focused action query;
- route serialization uses the same query contract as normal list usage;
- destination page renders visible chips for every applied filter, including hidden/action-only filters;
- copy links and exports use the applied query after navigation;
- mutation controls remain owned by the destination operating surface.

This keeps review pages small while preserving deeper inspection and action paths.

## Read-Only Operating Pages

Milestone Review is readable for contributors, archived projects, archived milestones, completed milestones, and canceled milestones. It does not add milestone administration or inline mutation controls.

That separation produced a clean permission model:

- review pages answer "what is the state?";
- existing Work and Planning pages answer "what can I change?";
- contributor paths can still inspect status without receiving disabled controls everywhere;
- archived entities remain explainable without reopening write workflows.

This is a useful default for summary and review pages that aggregate mutable resources.

## Aggregating Existing Health And Risk Rules

The review service reuses delivery-health derivation and work-risk policy constants. It computes only review-specific sections and preview rows itself.

This avoids rule drift between:

- project overview health;
- Planning delivery health;
- Planning risk sections;
- milestone review health;
- project Work risk links.

When a new read model needs similar signals, prefer lifting existing policy into reusable services before creating page-local copies.

## Deferring Persisted Snapshots

Snapshots were intentionally deferred because v0.1.7 has no sign-off, historical comparison, audit export, delivery forecast, or reporting workflow that needs immutable review state.

Criteria that would justify adding snapshots later:

- users need to compare review state across dates;
- a milestone needs approval or sign-off evidence;
- notifications or reports need to refer to the exact state seen at review time;
- forecasts need stored baselines;
- audit or export requirements need immutable review records.

Until one of those workflows exists, current-state derivation is simpler, easier to verify, and less likely to create misleading stale data.
