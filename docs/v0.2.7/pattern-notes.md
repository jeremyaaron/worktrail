# Worktrail v0.2.7 Pattern Notes

## Purpose

These notes record reusable implementation evidence from Files in Context without assuming a
destination framework, cloud, package, or repository. The evidence comes from one bounded attachment
workflow and should not yet be treated as a general document-management architecture.

## Separate Metadata Ownership From Byte Ownership

An attachment is represented by relational metadata and opaque file bytes with different storage
responsibilities.

Useful rules:

- keep authorization, domain relationships, limits, checksums, and audit identity in the transactional
  database;
- keep binary persistence behind a narrow object-store port;
- store an opaque generated key rather than a user filename as the physical object identity;
- do not expose storage paths or keys through public contracts;
- treat metadata and bytes as one logical operational unit for backup and restore;
- make missing or corrupt bytes an explicit integrity failure rather than returning partial content.

This split permits a later storage adapter without forcing domain services or HTTP contracts to know
whether bytes live on local disk or in managed object storage.

## Bound Binary Transport Before Parsing

The transport boundary rejects oversized bodies before domain validation or persistence.

Useful rules:

- set a hard byte limit in the HTTP body parser;
- accept one file per request when retry, progress, and failure semantics are per file;
- use a simple raw-binary request when multipart metadata adds no product value;
- carry required filename and declared media type through explicit validated headers;
- process a multi-file browser selection as a bounded sequence of independent requests;
- return stable typed errors for transport, policy, capacity, and storage failures.

Sequential uploads reduce race pressure and make progress and retry concrete, while server-side
coordination still protects against concurrent clients.

## Validate Multiple Forms Of File Evidence

A filename or browser-provided media type is not sufficient evidence of file identity.

Useful rules:

- require an allowlisted extension and media type;
- inspect known signatures or bounded textual evidence;
- validate container-based formats by reading only bounded archive metadata;
- reject extension, declaration, signature, or container disagreements;
- calculate checksum and exact byte size from the accepted bytes;
- never interpret accepted content as safe merely because its format is recognized.

Format validation narrows mistakes and spoofing. It is not malware scanning, content sanitization, or
permission to render untrusted content inline.

## Coordinate External Resources With Compensation

Database rows and object-store operations cannot participate in one ordinary atomic transaction.

Useful rules:

- choose operation ordering based on which intermediate state is easier to detect and repair;
- upload and verify bytes before committing metadata, then delete the object if the database write
  fails;
- remove metadata transactionally before deleting bytes, then restore metadata if deletion fails;
- log or surface compensation failure distinctly from the initiating failure;
- perform download-time size and checksum verification;
- retain immutable audit facts even when active attachment metadata is removed;
- document the remaining process-crash windows rather than claiming atomicity.

Compensation improves normal failure recovery. Stronger reconciliation may eventually require an
outbox, object lifecycle state, or scheduled integrity process.

## Make Capacity A Server-Owned Capability

The UI displays remaining count and byte capacity, but the server remains authoritative.

Useful rules:

- return policy and remaining capacity with the attachment collection;
- use that response to guide file selection and explain rejected queue entries early;
- recheck count and aggregate bytes while holding mutation coordination at write time;
- never rely on a previously rendered capacity value for acceptance;
- distinguish per-file limits from per-parent aggregate limits;
- keep limits centralized so API validation, contracts, UI copy, and tests agree.

Capabilities make the client easier to use without turning optimistic client state into an
authorization or consistency boundary.

## Protect Local Storage As Operator Data

A development-friendly filesystem adapter still needs explicit ownership and deletion safeguards.

Useful rules:

- resolve and log the effective storage root at startup;
- require an absolute path outside development defaults;
- initialize a recognizable ownership marker in managed roots;
- refuse destructive reset when the marker is absent or invalid;
- keep test storage in a unique operating-system temporary directory;
- restore process environment and remove temporary storage during teardown;
- document database-plus-object backup and restore as one procedure.

These controls reduce accidental deletion. They do not turn local storage into shared, replicated, or
ephemeral-compute-safe infrastructure.

## Make Binary Seeds Exact And Repairable

Seeded metadata is insufficient when examples depend on corresponding bytes.

Useful rules:

- define deterministic IDs, object keys, bytes, checksums, and metadata together;
- ensure the exact object before upserting its metadata;
- replace a missing or altered deterministic object on repeat seed;
- keep seeded examples small, inspectable, and representative;
- verify repeat seeding and exact download bytes in release checks;
- remove seeded objects through the same guarded reset boundary as runtime objects.

Object-aware idempotence makes local onboarding and browser tests reproducible across database and
filesystem state.

## Load Secondary Evidence Independently

Attachments are useful on detail pages but are not part of every work-item projection.

Useful rules:

- keep attachment metadata out of list, board, planning, report, and export responses until those
  surfaces require it;
- load the section independently after primary detail is usable;
- isolate section-level loading, empty, error, retry, and mutation states;
- lazy-load a substantial secondary UI composition when the route can remain useful without it;
- refresh attachment state without forcing an unrelated detail-page reload;
- preserve URL and primary-detail behavior when the secondary request fails.

This keeps a focused detail enhancement from becoming a cross-application payload and coupling cost.

## Deliberate Non-Abstractions

v0.2.7 does not introduce a generic media service, multipart framework, document model, upload-job
system, scanning pipeline, preview renderer, object-store SDK wrapper, reconciliation worker, or
cross-resource attachment package.

The current evidence supports focused reusable pieces:

- a small object-store port;
- centralized attachment policy and file-evidence validation;
- server-owned capacity reporting;
- explicit compensation around metadata and bytes;
- guarded local-storage ownership and reset;
- deterministic object-aware seed fixtures;
- independently loaded secondary detail sections.

A broader abstraction should wait for another feature with materially similar binary lifecycle,
authorization, capacity, audit, and recovery requirements. The boundaries above are intentional; the
implementation remains specific enough to expose where future use cases differ.
