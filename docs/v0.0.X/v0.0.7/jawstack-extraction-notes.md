# Worktrail v0.0.7 Jawstack Extraction Notes

## Purpose

These notes capture implementation patterns that emerged while building v0.0.7. They are observations from a concrete product sprint, not framework commitments.

v0.0.7 added CSV import and export to Worktrail. The sprint is useful for pattern discovery because it touches file ingestion, dry-run validation, transactional bulk writes, non-JSON API responses, browser downloads, and a plausible future path from local file upload to cloud object storage.

## File Ingestion Boundary

The browser reads a selected CSV file as text and sends the content to the API as JSON. The server owns parsing, header validation, size limits, row limits, lookup resolution, and user-readable errors.

Potential extraction:

- file-input UI state machine for selected file, reading, previewing, applying, and errors;
- server-owned parser boundary so frontend code does not duplicate CSV semantics;
- small payload-first design that keeps early local workflows simple;
- hard limit checks before parse work;
- normalized issue DTOs with `rowNumber`, `field`, and `message`.

Do not extract yet:

- generic file upload component;
- streaming CSV ingestion;
- resumable uploads;
- object storage staging;
- multi-file import orchestration.

## Dry-Run Validation

Preview and apply use the same validation path. Preview returns normalized rows and blocking errors without writing. Apply revalidates the same CSV before mutation. This keeps the UI honest and avoids trusting stale preview state.

Potential extraction:

- command preview endpoint convention;
- shared validator that returns normalized rows plus issues;
- preview DTO shape with totals, invalid counts, warnings, errors, and normalized rows;
- frontend pattern for disabling apply when preview has invalid rows or stale state;
- tests that prove preview has no write side effects.

Do not extract yet:

- generic dry-run framework;
- diff-style previews;
- background validation jobs;
- import sessions stored in the database.

## Transactional Bulk Commands

Import apply is a bulk command, but each row still flows through normal work item creation semantics. That preserves display key allocation, board positioning, labels, milestones, activity, and permission behavior. The transaction boundary ensures one invalid row or write failure does not create partial work.

Potential extraction:

- bulk command service shape that validates all rows before mutation;
- transaction helper usage around batch writes;
- row normalization followed by existing domain command calls;
- tests for apply validation rollback and write-time rollback;
- result DTO with created count and created resource summaries.

Do not extract yet:

- generic batch execution engine;
- partial success modes;
- retry queues;
- compensating transactions.

## CSV Export

Project and workspace export reuse existing list query semantics. The frontend calls export through `HttpClient` so local actor headers are preserved, then downloads the returned blob. The Express adapter supports string responses with `text/csv` headers instead of forcing all endpoint output through JSON.

Potential extraction:

- export service pattern that maps list DTOs to flat CSV records;
- shared CSV stringifier wrapper with explicit column definitions;
- frontend download helper for blob responses and `Content-Disposition` filenames;
- endpoint response shape that supports non-JSON bodies and custom headers;
- tests that ensure exported query params come from applied filter state, not draft form values.

Do not extract yet:

- export format registry;
- scheduled export jobs;
- export history;
- signed download URLs;
- data warehouse or analytics export connectors.

## Endpoint Handlers With Non-JSON Responses

The transport-neutral handler contract now needs to handle JSON and non-JSON bodies. Express adapts the handler result by applying status, headers, and the raw string or buffer body where appropriate.

Potential extraction:

- endpoint result shape with optional headers;
- adapter behavior for string, buffer, and JSON bodies;
- explicit content type responsibility at endpoint boundaries;
- tests for CSV responses and attachment filenames.

Do not extract yet:

- full response abstraction layer;
- content negotiation framework;
- streaming adapters;
- multipart response helpers.

## Future Cloud Upload Evolution

The current JSON-wrapped CSV body is correct for the MVP limits: 1 MiB and 250 rows. A future enterprise deployment may need direct browser-to-object-storage upload, server-side object validation, import sessions, progress polling, and resumable processing. The current workflow still maps cleanly to that future because preview and apply are already separate commands.

Possible evolution:

- browser requests a presigned upload URL;
- browser uploads CSV to object storage;
- preview command references an object key and stores an import session;
- apply command references the validated import session;
- background workers parse larger files and publish progress;
- validation issues remain in the same row/field/message shape.

Keep deferred:

- object storage abstraction;
- worker orchestration;
- import session tables;
- progress event delivery;
- cloud-specific permissions.

## Product Lesson

Data portability became useful only after the product had real work surfaces: projects, labels, milestones, owners, board state, saved filters, and activity. The import/export patterns should be extracted from complete workflows like this rather than from a generic CSV utility in isolation.
