# Worktrail v0.2.0 Pattern Notes

## Purpose

These notes capture reusable product and architecture signals from the v0.2.0 consolidation release. They are destination-neutral: the patterns may inform future application infrastructure, project conventions, documentation templates, or no extraction at all.

The bar for extraction remains evidence. A pattern should be generalized only after it appears in multiple concrete workflows and the abstraction would make those workflows simpler to build, test, or operate.

## Live Views Versus Published Snapshots

Planning and Milestone Review answer "what is true right now?" Published Reports answer "what did we say at a point in time?"

Useful product rules:

- label live operating surfaces as live views;
- label immutable report records as published snapshots;
- let links from snapshots open current app state;
- keep snapshot text anchored to stored data;
- validate stored snapshots at runtime before presenting or exporting them.

This pattern is worth reusing when a product mixes operational dashboards with durable communication artifacts.

## Query Contracts And URL State

Work lists depend on one applied query contract across route parameters, active chips, saved views, pinned shortcuts, return URLs, copy links, CSV export, dashboard links, and review-risk links.

Useful implementation rules:

- distinguish pending filter controls from applied query state;
- serialize only canonical query parameters into shareable URLs;
- keep active chips tied to applied state;
- reuse the same query conversion paths for navigation, exports, and saved views;
- treat default query values as quiet so saved-view summaries stay meaningful.

The extracted `WorkListQueryStore` is intentionally feature-local. It proves the boundary without turning the query model into premature platform code.

## Saved Operating Lenses

Saved views and pinned shortcuts work best when they are treated as operating lenses, not merely stored filter forms.

Useful product rules:

- keep pinned shortcuts visible in the default workflow;
- move save/manage actions behind compact entry points;
- separate personal views from shared operating views;
- enforce scope boundaries between workspace discovery and project work;
- preserve canonical URLs when opening any saved view.

The `SavedViewsStore` centralizes orchestration while preserving the existing API contracts and permission model.

## Explicit Bulk Mutation Mode

Bulk triage is safer and clearer when selection is a deliberate mode.

Useful product rules:

- hide selection controls until bulk mode is active;
- keep the selected count, action selector, apply control, and result summary together;
- retain failed rows after partial success;
- exit mode without changing the applied work-list filters;
- avoid exposing mutation controls for read-only actors or archived projects.

The `ProjectBulkTriageStore` keeps this behavior local to project work lists, which matches the current product scope.

## Shared Risk Sections

Planning, Milestone Review, and Reports all need the same risk concepts with different scopes and time semantics.

Useful implementation rules:

- define risk metadata, predicates, sort order, and preview limits once;
- scope the same definitions to project-wide and milestone-specific views;
- use the same query links from all risk sections;
- preserve report snapshot immutability by storing assembled risk data at publish time.

The shared `work-risk-sections` service reduces parallel edits and makes future risk-category changes easier to test.

## Versioned Runtime Parsing For Persisted JSON

Persisted JSON snapshots should be treated as external input, even when the app wrote them.

Useful implementation rules:

- include an explicit snapshot version;
- parse snapshots at every read boundary;
- reject invalid persisted data through controlled application errors;
- reuse schema definitions where practical to avoid divergent write/read validators;
- test list, detail, and export paths against invalid stored payloads.

This pattern is useful for any append-only or immutable record that stores structured JSON outside normalized tables.

## Detail Page Task Hierarchy

Work Item Detail became easier to scan when controls were grouped by the user's likely job:

- Summary: identify the work and current state;
- Act: change the work;
- Collaborate: discuss and watch;
- Dependencies: understand blockers and related work;
- History: inspect activity.

This pattern should be reused cautiously. It is most useful on dense detail pages where editing, collaboration, relationships, and audit history compete for attention.

## Public Site As Product Baseline

The static site is more useful when it describes the current product and reference architecture rather than release chronology.

Useful content rules:

- state the product workflow plainly;
- describe the reference architecture as layers;
- keep non-goals explicit;
- link to current PRD, technical design, audits, OpenAPI, and runbooks;
- avoid implying production readiness where the app is still local-first.

This pattern helps keep public-facing documentation aligned with the app's current usability and adoption story.
