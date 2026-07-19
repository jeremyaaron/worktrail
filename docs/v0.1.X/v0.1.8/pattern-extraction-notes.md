# Worktrail v0.1.8 Pattern Notes

## Purpose

v0.1.8 adds Project Status Reports by turning existing project health, milestone, risk, and work-query behavior into a publishable communication workflow. The patterns below are extraction candidates for future application infrastructure, but they should remain destination-neutral until repeated use proves they are worth standardizing.

## Workflow-Driven Snapshots

Milestone Review in v0.1.7 stayed current-state only. Status Reports add persistence because the workflow requires a durable record of what was communicated at publication time.

Useful criteria for adding snapshots:

- users need to preserve a historical communication;
- readers need a stable reference after source data changes;
- the snapshot is tied to an explicit user action;
- the stored shape can be contract-owned and versioned;
- the product can explain which values are historical and which links open current data.

This is a narrower pattern than generic audit logging. It works best when the workflow has a clear "publish" moment.

## Generated Drafts With Editable Narrative

The draft page generates structured context from current project state, then asks the user to edit the human-facing narrative before publishing.

The reusable shape is:

- service generates a read model from existing domain rules;
- UI shows the generated context as read-only evidence;
- user edits narrative fields separately from generated facts;
- publish request carries both narrative and the reviewed snapshot;
- server validates ownership, project match, snapshot version, and publish permission.

This avoids pretending generated text is final while still reducing the effort required to produce a useful update.

## Immutable Report Records

Published reports are immutable in v0.1.8. The app does not support correction edits, delete/archive, comments, approvals, or delivery state.

That constraint keeps the first reporting model simple:

- there is no report update history to explain;
- links and activity can refer to one stable published object;
- seed data and tests can assert exact snapshot behavior;
- future correction workflows can be designed only after a concrete need appears.

Immutability is not a universal rule. It is appropriate here because the product has not yet introduced approval, compliance, editorial correction, or distribution workflows.

## Live Links From Historical Reports

Published reports store historical values, but their links open current app surfaces. The detail page says this explicitly.

The reusable rule is:

- snapshot values answer "what did the report say?";
- links answer "where can I inspect or act now?";
- route query parameters should use the same canonical query contract as normal app navigation;
- return URLs should bring users back to the historical report after drilling into current work.

This keeps reports useful after publication without duplicating Work, milestone review, or work item detail behavior inside the report page.

## Report Permissions And Archive Behavior

The report permission model follows the existing project management split:

- owners and maintainers can publish reports for active projects;
- contributors can read reports;
- archived projects can read existing reports;
- archived projects cannot publish new reports.

This split keeps reports useful as project history while preventing archived projects from receiving new communication artifacts.

## Deferring Generic Reporting Infrastructure

v0.1.8 intentionally does not introduce a generic report builder, report scheduler, notification delivery system, export pipeline, approval workflow, dashboard, or template engine.

Defer generic reporting until at least one of these needs is concrete:

- multiple report types share the same lifecycle;
- users need scheduled delivery or subscriptions;
- report output must be exported or rendered outside the app;
- approval, correction, or audit workflows require report state transitions;
- workspace-level rollups need cross-project aggregation;
- template customization becomes necessary for user adoption.

Until then, a focused project status report service is easier to verify and less likely to freeze premature abstractions.
