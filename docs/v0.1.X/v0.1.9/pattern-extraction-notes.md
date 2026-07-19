# Worktrail v0.1.9 Pattern Notes

## Purpose

v0.1.9 adds Status Report Sharing by turning immutable project status reports into portable Markdown artifacts. The patterns below are extraction candidates for future application infrastructure, but they should remain destination-neutral until repeated use proves they are worth standardizing.

## Immutable-Record Text Exports

The export is generated from a published report DTO and its stored snapshot. It does not recompute project health, milestones, risks, or recent work.

Useful criteria for this pattern:

- the source record is intentionally immutable;
- readers need to move the record into external tools;
- the exported artifact must preserve what was published;
- the output can be deterministic for tests and automation;
- the format can stand alone without requiring app chrome.

Markdown is a good first export format when the artifact is human-readable, structured, and likely to be pasted into documents, tickets, chat, or meeting notes.

## Server-Side Rendering For Non-JSON Responses

The API owns Markdown rendering rather than duplicating report formatting in the Angular client.

Benefits:

- one export representation for copy, download, direct endpoint use, and future adapters;
- endpoint tests can assert exact body content and headers;
- the export route is automation-friendly;
- client code stays focused on user actions instead of document construction;
- future runtime adapters can serve the same handler contract.

This is intentionally smaller than a generic document rendering framework. A pure renderer function and a narrow endpoint are enough for the first use case.

## Relative Links In Portable Artifacts

Exported reports use relative app links:

- project links;
- milestone review links;
- risk-filtered project Work links;
- work item detail links.

The reusable rule is:

- snapshot text answers "what was reported?";
- links answer "where do I inspect or act now?";
- query links should reuse canonical app query semantics;
- relative paths avoid environment-specific base URL configuration while the app is still local-first and single-origin shaped.

Absolute public URLs can be added later if deployed domains or unauthenticated sharing become product scope.

## Copy, Download, And Print Before Delivery Infrastructure

v0.1.9 deliberately supports user-directed sharing before automated distribution.

This proves value without committing to delivery infrastructure:

- `Copy Markdown` supports chat, docs, ticket, and meeting-note workflows;
- `Download Markdown` creates a durable local artifact;
- `Print` supports review meetings and browser-managed PDF output;
- direct endpoint access supports simple automation.

The pattern is useful when a workflow needs portability but does not yet justify subscriptions, recipients, background jobs, notification preferences, or delivery logs.

## Deferring Templates, Subscriptions, And PDF

Do not add generic reporting infrastructure until the product has concrete pressure for it.

Good triggers for later investment:

- multiple report types need shared rendering lifecycle;
- users need branded or role-specific templates;
- recipients and delivery schedules become core workflow;
- PDF fidelity matters more than browser print;
- public links or external stakeholder access become necessary;
- export history, analytics, or audit requirements appear;
- approval or sign-off creates report state transitions.

Until those needs are real, Markdown exports plus print-friendly pages keep the reporting system understandable, testable, and adaptable.
