# Worktrail v0.2.7 PRD

## Status

Implemented

## Summary

Worktrail v0.2.7 should add **Files in Context: Work Item Attachments**.

Worktrail can now represent, organize, operate, and review a substantial amount of project context.
Teams can decompose work, assign it, plan it into milestones and cycles, track dependencies, discuss it
through comments, preserve activity, publish reports, and find it through scalable filtered lists. One
basic collaboration gap remains conspicuous: users cannot attach the artifacts that explain or prove
the work.

Specifications, screenshots, exported logs, test evidence, design references, data samples, and review
documents must currently live outside Worktrail. A user can mention an external file in a comment, but
the file is not retained with the work item, governed by the same workspace boundary, or discoverable
by the next person who opens the item. That weakens the work item as the durable source of operational
context.

The product theme is **Files in Context**. v0.2.7 should let active workspace members upload bounded,
supported files to writable work items, inspect attachment metadata, download files through an
authorized API path, and remove files under explicit ownership rules. Attachment activity should remain
understandable after the file is removed. Archived projects should preserve download access while
remaining read-only.

The release should also establish a production-shaped storage boundary. Attachment metadata belongs in
PostgreSQL, while file bytes belong behind a storage interface with a local filesystem implementation.
Neither contracts nor domain services should expose local paths. A future S3 implementation should be
able to replace the byte store without changing attachment identity, permissions, activity, or the
Angular workflow.

This release should not become a general document-management system, cloud deployment sprint, media
preview platform, malware-scanning service, or background-processing framework. It should deliver one
credible file workflow on work item detail and learn from the boundary before broader reuse.

## Context

Worktrail currently supports:

- persistent work items with immutable display keys and project/workspace ownership;
- work item create, edit, status transition, board movement, and project batch triage;
- comments, mentions, watchers, notifications, and item/workspace activity;
- dependency relationships and bounded two-level work breakdown;
- milestones, cycles, closeout snapshots, status reports, and Markdown report downloads;
- project and workspace work discovery with server-backed pages and exact totals;
- canonical filters, copied links, saved views, pinned views, and full-filter CSV export;
- owner, maintainer, and contributor roles represented by the current local actor model;
- archived-project read-only behavior across established mutation paths;
- PostgreSQL transactions and transport-neutral endpoint handlers with an Express adapter;
- local development, deterministic seed data, production preview, OpenAPI, CI, and browser smoke tests;
- an Angular static build suitable for eventual S3/CloudFront hosting;
- API boundaries intended to remain adaptable to API Gateway/Lambda-style transports.

Worktrail does not currently have:

- attachment metadata or file-byte persistence;
- an upload request boundary;
- a storage adapter or storage lifecycle configuration;
- attachment permission rules;
- file-size, file-count, file-type, or aggregate-storage limits;
- file download headers and filename handling;
- upload or delete activity;
- local seed assets or attachment cleanup behavior.

The absence of storage infrastructure is useful. v0.2.7 can introduce the boundary from one concrete
product need instead of guessing at a generic asset system.

## Problem

Work items cannot retain the files needed to understand or verify the work.

Current friction and risk:

- users must rely on external file systems and informal links for supporting artifacts;
- links in comments can expire, move, require unrelated permissions, or lose their meaning;
- screenshots and evidence cannot be found from the work item that motivated them;
- a later contributor cannot distinguish durable project evidence from transient discussion;
- there is no governed workspace/project relationship for uploaded files;
- the product cannot enforce file size, type, count, or access boundaries;
- storing future files directly in PostgreSQL would couple database growth, backup, transfer, and query
  concerns to large opaque byte payloads;
- exposing local filesystem paths would make a future object-storage transition expensive and unsafe;
- a naive upload endpoint could buffer unbounded input, trust user filenames as paths, or return files
  without rechecking authorization;
- deleting metadata and deleting bytes are not one database transaction, so consistency and recovery
  rules must be explicit;
- local development must remain simple even after the application gains non-database state;
- a future Lambda/API Gateway deployment has stricter request, response, memory, and execution limits
  than the local Express process.

The gap is both product-facing and architectural. Users need files where work happens. The application
needs a bounded, authorized, storage-neutral attachment model that does not pretend local disk and
cloud object storage have identical failure modes.

## Goals

- Let active workspace members attach supported files to work items in active projects.
- Show attachment name, type, size, uploader, and upload time on work item detail.
- Support reliable, authorized file download without exposing storage implementation details.
- Let uploaders remove their own attachments and let owners/maintainers remove any attachment in their
  workspace.
- Preserve attachment download and metadata visibility for archived projects.
- Block attachment upload and deletion when a project is archived.
- Keep attachment bytes outside PostgreSQL while storing authoritative attachment metadata in
  PostgreSQL.
- Enforce explicit per-file, per-item, file-count, filename, and media-type boundaries on the server.
- Treat user-provided filenames as display metadata, never as storage paths.
- Record concise work item activity for successful upload and removal.
- Keep attachments out of list DTOs, paging enrichment, boards, reports, and CSV files unless a compact
  count proves necessary during technical design.
- Provide useful loading, upload-progress, partial-failure, empty, download, and removal states.
- Keep local setup deterministic with a configurable local storage root and seeded attachment examples.
- Define cleanup and consistency behavior for failed uploads, failed metadata writes, missing objects,
  and failed deletion.
- Preserve transport-neutral domain and endpoint responsibilities.
- Create a storage port that can support a future S3 adapter without committing this sprint to AWS
  infrastructure.
- Update OpenAPI, README, public site, release documentation, and destination-neutral pattern notes
  when implementation is finalized.

## Non-Goals

- Do not add attachments to comments, reports, projects, milestones, cycles, or workspace records.
- Do not add rich-text embedding or inline image insertion into descriptions or comments.
- Do not add image, PDF, Office document, audio, video, or archive previews.
- Do not render user-provided HTML, SVG, Markdown, or other active content inline.
- Do not add file versioning, checkout, approval, annotation, coauthoring, or document locking.
- Do not add folders, tags, full-text file search, OCR, media transcription, or content indexing.
- Do not add external cloud-drive links, Google Drive, OneDrive, Dropbox, or Box integrations.
- Do not add antivirus, malware scanning, data-loss prevention, quarantine, or content moderation
  services in this release.
- Do not claim that the local attachment implementation is safe for an untrusted internet deployment
  without those controls.
- Do not implement S3 buckets, presigned URLs, multipart object uploads, CloudFront delivery, or AWS
  CDK resources in this release.
- Do not store file bytes in PostgreSQL or encode them into JSON contracts.
- Do not add background upload processing, thumbnails, queues, workers, or attachment notifications.
- Do not add attachment count, type, or filename filters to work-list query contracts.
- Do not add attachment columns to project/workspace CSV export or CSV import.
- Do not add attachment content to cycle closeout snapshots or published report snapshots.
- Do not add permanent public file links or bypass work item authorization on download.
- Do not add configurable workspace storage quotas or billing metering.
- Do not add work item deletion or cascade policy as part of this release.
- Do not add production authentication or replace the current local actor model.
- Do not create a generic blob, asset, media, or document framework before a second domain proves the
  abstraction.

## Target Users

### Contributor

Needs to attach screenshots, logs, examples, and completion evidence to assigned work so maintainers can
review it without searching another system.

### Project Maintainer

Needs specifications and review artifacts to remain with the work item, and needs authority to remove
incorrect, obsolete, or unsafe attachments.

### Workspace Owner

Needs files to respect workspace boundaries, archived-project rules, and explicit storage limits rather
than becoming an unmanaged shared directory.

### Individual Power User

Needs to download or add a supporting artifact from the same detail page used for comments,
relationships, hierarchy, and activity.

### Reference-App Developer

Needs a concrete example of metadata-versus-byte ownership, bounded uploads, adapter-normalized binary
input, authorized downloads, external-resource consistency, and a local implementation that preserves
a path toward object storage.

## Product Principles

- **Files belong to work context:** the attachment is useful because it is governed by and visible from
  a specific work item.
- **Metadata is not the object:** PostgreSQL owns identity, authorization context, and audit metadata;
  the storage adapter owns bytes.
- **Bound every byte path:** file size, item totals, accepted types, request handling, and response
  behavior must have explicit limits.
- **Authorize every operation:** an opaque attachment URL is not an access-control mechanism.
- **Never trust a filename as a path:** preserve a useful display name while generating independent
  storage keys.
- **Download safely by default:** files should be delivered as attachments with defensive headers, not
  executed inside Worktrail.
- **Archived means read-only, not erased:** attachment evidence remains available when project mutation
  stops.
- **Activity records decisions, not storage internals:** users should see who added or removed which
  file without seeing object keys or paths.
- **Local first, storage ready:** the initial adapter should be easy to run locally, while the service
  contract avoids assumptions that only local disk can satisfy.
- **Consistency must be honest:** database transactions cannot atomically commit filesystem or object
  storage changes, so compensating behavior and repairable states matter.
- **No hidden list cost:** attachment bytes and collections must not inflate paged work-list responses.
- **Learn before generalizing:** build a focused attachment service and storage port; defer a universal
  asset model.

## Scope

### 1. Attachment Metadata And Ownership

Add a durable attachment record associated with one work item.

Required metadata:

- attachment id;
- workspace id;
- project id;
- work item id;
- uploader member id;
- original display filename;
- normalized media type;
- byte size;
- content checksum;
- opaque storage key;
- created timestamp.

Requirements:

- An attachment must belong to exactly one existing work item.
- Workspace and project identity must agree with the owning work item.
- Uploader identity must reference the active actor who completed the upload.
- The original filename must be retained for display and download headers after safe normalization.
- The storage key must be generated by the application and must not be accepted from API callers.
- The storage key must not be exposed in public DTOs, activity metadata, URLs, or logs.
- Attachment content is immutable. Replacing a file means uploading a new attachment and optionally
  removing the old one.
- Duplicate display filenames on one work item are allowed because files have independent attachment
  identity.
- Removing an attachment removes the live attachment record after storage cleanup succeeds under the
  defined consistency policy.
- Historical upload/removal activity must retain safe filename and size context without depending on
  the live attachment row.
- Add indexes that support listing a work item's attachments and enforcing workspace/project joins.

Acceptance criteria:

- A stored attachment cannot reference a work item in another workspace or project.
- Two files with the same display name remain independently downloadable and removable.
- No API response reveals a local path or storage key.
- Attachment metadata can be listed without reading file bytes.
- Removing a live record does not erase the associated activity history.

### 2. Bounded Upload Workflow

Add a focused upload operation from work item detail.

Requirements:

- Show an `Add files` action in the work item attachment section for permitted actors.
- Use the platform file picker and allow selecting more than one supported file when capacity remains.
- Treat each selected file as an independent attachment operation so one invalid or failed file does not
  falsely mark the full selection successful.
- Show selected filename and size before or during upload.
- Show per-file uploading, success, and failure state.
- Show upload progress when the active browser/transport can report it reliably.
- Prevent a second submission of an item that is already uploading.
- Allow a failed file to be retried without reselecting successful files where practical.
- Refresh the attachment list and activity after successful uploads without reloading the route.
- Keep the work item readable while uploads are in progress.
- Enforce limits on the server even when the client performs earlier validation.
- Reject empty files.
- Reject filenames that are empty after normalization or exceed the supported length.
- Reject unsupported file types using one authoritative server policy.
- Reject a file that exceeds the per-file size limit before retaining metadata.
- Reject uploads that would exceed the per-item attachment count or aggregate byte limit.
- Do not silently truncate, recompress, rename content, or convert media types.
- Return established structured errors with actionable messages for size, count, type, permission,
  archived-project, missing-work-item, and storage failures.

Acceptance criteria:

- A contributor can upload a supported file to a writable work item and see it immediately.
- Selecting one valid and one invalid file preserves the valid upload and explains the invalid file.
- Client validation improves responsiveness but bypassing it cannot bypass server limits.
- Uploading to a missing, cross-workspace, or archived-project work item fails without retained bytes or
  metadata.
- A failed metadata write does not leave a permanently unreferenced object under normal operation.
- Refreshing the page after success shows the same attachment metadata.

### 3. Attachment List On Work Item Detail

Add a compact attachment section to the work item detail workflow.

Requirements:

- Show the attachment section near comments/activity without displacing the work item summary and edit
  workflow.
- Show an attachment count in the section heading.
- Order attachments newest first, with a deterministic id tie-breaker.
- Show for each attachment:
  - filename;
  - human-readable size;
  - recognized file category or media type;
  - uploader name;
  - upload timestamp;
  - download action;
  - remove action when permitted.
- Use familiar file/download/trash icons where the existing icon system provides them, with tooltips and
  accessible names.
- Keep attachment rows compact and scannable; do not use nested cards.
- Provide explicit loading, empty, retryable error, and stale-record states.
- Long filenames must wrap or truncate with access to the full name and must not push actions outside the
  container.
- The section must remain usable on narrow mobile layouts and at browser zoom.
- Do not request file bytes while rendering the list.
- Do not add attachment metadata to every work-list or board DTO.

Acceptance criteria:

- A user can distinguish files with duplicate names by uploader/time and independent actions.
- Long filenames and large formatted sizes do not overlap controls.
- An empty item shows a concise attachment empty state rather than a large decorative panel.
- Loading attachment metadata does not delay initial display of the primary work item detail.
- Existing comments, relationships, hierarchy, watchers, and activity remain usable.

### 4. Authorized Download

Provide a safe download path for attachment bytes.

Requirements:

- Resolve downloads by attachment identity, never by a caller-provided storage key or local path.
- Revalidate actor workspace access and attachment/work-item ownership for every download.
- Return `404` for missing or cross-workspace attachment identity according to established resource
  concealment behavior.
- Retrieve bytes only after authorization succeeds.
- Return the stored normalized media type where safe, plus:
  - `Content-Disposition: attachment` with standards-compatible UTF-8 filename handling;
  - `Content-Length` when known;
  - `X-Content-Type-Options: nosniff`;
  - a private/no-store or otherwise explicit cache policy appropriate to the current actor model.
- Do not render files inline inside Worktrail.
- Detect a missing storage object and return a controlled server error rather than an empty or corrupt
  file.
- Preserve checksum and byte-size evidence for validation and future storage migration.
- Keep the endpoint contract compatible with a future redirect or short-lived signed-object response,
  while returning bytes through the application in this release.

Acceptance criteria:

- An authorized user downloads the original bytes under the safe display filename.
- A user from another workspace cannot infer or retrieve the attachment.
- A guessed attachment id does not bypass work item access rules.
- A missing storage object does not produce a successful zero-byte download.
- The browser treats supported content as a download rather than active Worktrail content.

### 5. Removal And Retained Activity

Allow controlled attachment removal.

Requirements:

- The uploader may remove their own attachment while the project is active and they remain an active
  workspace member.
- Owners and maintainers may remove any attachment in their workspace while the project is active.
- Other contributors may not remove attachments they did not upload.
- Archived projects allow list/download but block removal.
- Require a focused confirmation that includes the attachment filename before removal.
- Disable repeated removal while a request is active.
- On success, remove the attachment from the live list without a full route reload.
- Record removal activity with attachment id, safe filename, media type, and byte size before the live
  metadata is removed.
- Do not generate watcher or mention notifications for attachment upload/removal in this release.
- Treat an already-missing storage object as a repairable removal case rather than permanently trapping
  stale metadata, provided authorization and metadata identity remain valid.
- Return controlled errors for metadata/storage failures and preserve a retryable UI state.

Acceptance criteria:

- An uploader can remove their own file but not another contributor's file.
- A maintainer can remove any project attachment.
- A contributor never receives a remove control they cannot use, and direct API attempts are rejected.
- Archived project attachments remain downloadable and cannot be removed.
- Activity still explains the removed file after the attachment row no longer exists.

### 6. File Policy And Defensive Handling

Add one explicit attachment policy shared by validation, UI guidance, tests, and documentation.

Requirements:

- Define fixed initial limits for:
  - maximum bytes per file;
  - maximum attachments per work item;
  - maximum aggregate attachment bytes per work item;
  - maximum normalized filename length;
  - supported media types and filename extensions.
- Keep limits in one backend policy module rather than duplicating literals across endpoints and
  services.
- Expose enough policy data to the Angular client to present accurate picker guidance without making the
  client authoritative.
- Support a conservative first set of common project artifacts:
  - PNG, JPEG, GIF, and WebP images;
  - PDF;
  - plain text, Markdown, CSV, and JSON;
  - DOCX, XLSX, and PPTX Open XML documents.
- Reject executable, script, HTML, SVG, archive, audio, video, and unknown binary formats in this
  release.
- Validate normalized filename extension and declared media type consistently.
- Sanitize control characters, path separators, reserved path segments, and unsafe download header
  characters from display filenames.
- Generate object keys from trusted identifiers and random values, not filenames.
- Avoid logging byte bodies or sensitive object locations.
- Document that type checks and forced downloads are defensive boundaries, not malware scanning.

Acceptance criteria:

- The same policy drives API errors, Angular helper text, and tests.
- Renaming an executable to a supported-looking filename does not trivially bypass both type checks.
- Filenames containing paths or header-control characters cannot escape storage or corrupt response
  headers.
- Unsupported files fail before durable metadata is committed.
- Policy changes have focused tests and do not require edits across unrelated feature code.

### 7. Storage Port And Local Filesystem Adapter

Introduce a focused byte-storage boundary with one local implementation.

Requirements:

- Define a storage port owned by the attachment feature with operations equivalent to:
  - write a new immutable object;
  - read an object and its known metadata;
  - remove an object;
  - determine whether an object exists when needed for repair behavior.
- Use opaque keys generated above the adapter.
- Provide a local filesystem adapter for development, tests, and production preview.
- Configure the local storage root through runtime configuration with a repository-local default that is
  ignored by Git.
- Create required local directories safely on startup or first use.
- Prevent key traversal even if an internal caller supplies malformed input.
- Write new bytes through a temporary file and atomic rename where the platform permits, so interrupted
  writes do not appear complete.
- Do not overwrite an existing object key.
- Provide an isolated temporary-directory adapter setup for integration tests.
- Keep test doubles in memory where they make service failure paths deterministic.
- Map storage failures into controlled application errors without leaking filesystem details.
- Keep storage configuration separate from database configuration.
- Do not make the storage interface assume that files are seekable local paths; a future S3 adapter may
  use streams or byte ranges instead.

Acceptance criteria:

- Local development works without installing an additional object-storage service.
- Tests do not write attachment bytes into the repository or a user's normal storage directory.
- Restarting the local API preserves uploaded files when the configured directory remains.
- Storage keys cannot escape the configured root.
- Domain and endpoint code does not import filesystem APIs directly.
- Replacing the adapter does not require changing attachment DTOs or permission rules.

### 8. Activity, Detail Refresh, And Cross-Feature Isolation

Integrate attachments without widening unrelated work-item contracts.

Requirements:

- Add work item activity for:
  - attachment uploaded;
  - attachment removed.
- Activity summaries should identify the safe filename and actor without exposing storage details.
- Preserve activity ordering and existing timeline behavior.
- Do not notify watchers for attachment activity in this release.
- Do not include attachment bytes or attachment arrays in:
  - project/workspace list pages;
  - board cards;
  - My Work;
  - Planning;
  - Cycle Review;
  - Milestone Review;
  - Portfolio;
  - report drafts or published snapshots;
  - cycle closeout snapshots;
  - CSV import/export.
- The attachment section may use a dedicated endpoint and load independently from the primary detail DTO.
- Work item hierarchy and dependency navigation must continue to refresh correctly when the route id
  changes in place.
- Attachment upload/removal must not rewrite the work item's `updatedAt` unless technical design proves
  that behavior is necessary and documents its effect on list sorting and stale-work risk.

Acceptance criteria:

- Upload/removal appears once in work item activity.
- Watchers do not receive new attachment notifications.
- Paged list payload sizes and queries are unchanged by attachment count.
- Existing report and closeout snapshots remain schema-compatible.
- Navigating between related work items loads the selected item's attachments rather than retaining the
  previous list.

### 9. API, Contracts, Configuration, And Documentation Surface

Make the feature explicit and operable.

Requirements:

- Add attachment DTOs and request/response vocabulary to the shared contracts package.
- Keep byte payload types out of JSON DTOs.
- Add focused endpoints for list, upload, download, and removal.
- Keep endpoint handlers transport-neutral by receiving adapter-normalized upload input and returning a
  binary response description that the Express adapter can serve.
- Add Express upload parsing/body limits at the adapter boundary.
- Reject an oversized request before buffering beyond the configured policy where practical.
- Add runtime configuration validation for storage driver and local root.
- Fail startup with actionable configuration errors when the selected storage driver is invalid.
- Add common structured errors for attachment policy and storage failures without exposing internals.
- Document attachment routes, headers, limits, DTOs, permission outcomes, and representative errors in
  OpenAPI.
- Document local storage location, cleanup, backup limitations, and production-preview behavior.
- Keep local actor headers and role behavior consistent with existing API examples.
- Avoid requiring generated clients or a generic multipart framework unless technical design shows a
  clear repository-wide benefit.

Acceptance criteria:

- Contract tests cover attachment DTO vocabulary.
- Endpoint tests cover JSON metadata and binary response behavior separately.
- OpenAPI accurately describes upload encoding and download headers.
- Invalid storage configuration fails clearly before requests are accepted.
- A future Lambda adapter can normalize the same upload/download domain input without importing Express.

### 10. Seed Data, Verification, And Release Communication

Make the workflow visible and repeatable from a fresh checkout.

Requirements:

- Seed a small number of deterministic, safe attachment examples tied to existing work items.
- Generate or copy tiny seed file bytes into the configured local development storage root without
  committing generated runtime storage.
- Include examples with:
  - an image-like artifact or safe textual stand-in where binary fixture maintenance is undesirable;
  - a requirements or evidence document;
  - distinct uploaders and timestamps.
- Keep seed attachment totals far below policy limits.
- Make repeated seed runs idempotent for metadata and file objects.
- Define local reset behavior so stale seed objects do not create confusing demo state.
- Add browser coverage for upload, metadata display, download, permission visibility, and removal.
- Verify desktop and mobile attachment layouts, long filenames, loading states, and progress messaging.
- Run fresh reset/migrate/seed verification plus lint, typecheck, unit/integration tests, production build,
  and the existing end-to-end suite.
- Update package/application version metadata to `0.2.7` during finalization.
- Update README capability and limitation sections.
- Update the public product site so attachments are no longer listed as an absent baseline capability.
- Add release notes and destination-neutral pattern notes.

Acceptance criteria:

- A fresh local setup shows downloadable seeded attachments without manual file placement.
- A user can upload, download, and remove an attachment in the documented walkthrough.
- Seed reruns do not duplicate rows or fail on existing objects.
- Existing scalable discovery, hierarchy, comments, activity, board, planning, review, report, and closeout
  browser workflows remain green.
- Documentation distinguishes local storage support from production-ready untrusted file handling.

## User Stories

### Contributor Adds Review Evidence

As a contributor, I want to attach a screenshot or log to my work item so the maintainer can review the
evidence in the same context as status, comments, and activity.

Acceptance path:

1. Open a work item in an active project.
2. Choose one or more supported files within the stated limits.
3. See upload progress and an independent outcome for each file.
4. See successful files in the attachment list without reloading.
5. See upload activity in the timeline.

### Maintainer Downloads A Specification

As a maintainer, I want to download the specification attached to a work item so I do not need to search
another system or trust an expired comment link.

Acceptance path:

1. Open the work item.
2. Inspect filename, size, uploader, and timestamp.
3. Activate Download.
4. Receive the original bytes under a safe, recognizable filename.

### Uploader Corrects A Mistake

As an uploader, I want to remove a file I attached by mistake so the work item does not retain misleading
evidence.

Acceptance path:

1. Find the attachment on the work item.
2. Choose Remove and confirm the named file.
3. See the row removed and a success state.
4. See retained activity explaining the removal.

### Maintainer Moderates Project Files

As a maintainer, I want to remove any attachment in an active project so obsolete or inappropriate files
do not remain attached to team work.

Acceptance path:

1. Open a file uploaded by another member.
2. Remove it with confirmation.
3. Confirm contributors who did not upload the file do not receive the same action.

### Team Reviews Archived Evidence

As a workspace member, I want to download attachments from an archived project so historical work remains
understandable even though it is read-only.

Acceptance path:

1. Open a work item in an archived project.
2. See and download its attachments.
3. Do not see upload or removal controls.
4. Receive a structured conflict if attempting the mutation directly.

### Developer Changes Storage Implementation

As a reference-app developer, I want attachment services to depend on an opaque storage interface so a
future S3 adapter does not require rewriting permissions, metadata, activity, or frontend contracts.

## UX Requirements

- Keep the attachment section subordinate to work item identity and primary workflow controls.
- Use a compact section heading with count and a clear `Add files` action.
- Use native file selection rather than a custom file-browser control.
- Do not make drag/drop the only upload path. It may be added as an enhancement only if the native picker
  remains first-class and implementation cost stays bounded.
- Show accepted types and size limits near selection without a long instructional block.
- Show selected filename and formatted size before upload begins when practical.
- Provide per-file status for multi-selection rather than one ambiguous global message.
- Keep successful rows stable while another file uploads or fails.
- Confirm removal with the exact filename.
- Avoid full-page blocking states for attachment-only operations.
- Preserve stable row/action dimensions as progress and errors appear.
- Show the full filename through wrapping, title text, or accessible description when compact display is
  truncated.
- Use restrained success feedback; do not add a toast framework solely for this feature.
- Use existing inline status and error patterns where they remain visible near the attachment section.
- Display file sizes in understandable binary units with consistent rounding.
- Do not rely on file-type color alone.
- Keep empty and error states concise so comments and activity remain visible on common laptop screens.

## Accessibility Requirements

- The file input must have a persistent programmatic label.
- The `Add files` action must remain keyboard operable and activate the native picker.
- Accepted formats and limits must be associated with the input where practical.
- Per-file progress must expose a programmatic name and numeric or indeterminate progress state.
- Success and failure updates should use restrained live-region messaging without repeatedly announcing
  the entire attachment list.
- Download and remove actions must include the filename in their accessible name.
- Icon-only actions require tooltips and screen-reader labels.
- Removal confirmation must trap and restore focus correctly if implemented as a dialog; a native or
  existing confirmation pattern is preferred over a new dialog framework.
- Errors must identify the affected filename and cannot rely on color alone.
- Attachment rows must preserve logical reading and tab order on desktop and mobile.
- Long unbroken filenames must not cause horizontal page scrolling at 200% zoom.
- Loading indicators and disabled controls must communicate state programmatically.

## Permissions And Lifecycle Rules

- Any active workspace member who can read a work item may list and download its attachments.
- Any active workspace member may upload to a work item in an active project.
- An uploader may remove their own attachment in an active project.
- Owners and maintainers may remove any attachment in their workspace's active projects.
- Contributors may not remove another member's attachments.
- Inactive members cannot upload or remove files, but existing metadata must preserve their uploader
  identity for display/history.
- Archived projects permit attachment list and download only.
- Missing or cross-workspace attachment/work-item identity follows existing `NOT_FOUND` concealment.
- Invalid role or ownership removal returns the established forbidden response.
- Archived-project mutation returns the established conflict response.
- File policy violations return validation errors with safe, actionable details.
- Storage failures return controlled server errors and must not expose paths, keys, credentials, or raw
  adapter exceptions.
- Attachment permissions are evaluated at request time and are not embedded into durable attachment
  records.

## Data Integrity And Consistency Expectations

- Attachment metadata and work item ownership must be validated in one write transaction where database
  operations are involved.
- File bytes must never be committed under a caller-controlled path.
- Content checksum and recorded byte size must describe the accepted stored bytes.
- Metadata must not become visible before the object write is complete.
- If object write succeeds and metadata persistence fails, the service must attempt compensating object
  removal and report any residual cleanup risk through safe operational logging.
- If object removal fails during an authorized delete, live metadata should remain retryable unless the
  technical design introduces an explicit deletion state.
- If metadata exists but the object is missing, download returns a controlled error and authorized
  removal can clean up the stale metadata while preserving removal activity.
- Duplicate upload requests may create distinct attachments unless an explicit request-id mechanism is
  introduced; they must never overwrite an existing object.
- Concurrent uploads must enforce attachment count and aggregate-byte limits without allowing both
  requests to pass a stale precheck.
- Concurrent removal requests must produce one successful outcome and one controlled stale/not-found
  outcome without duplicate activity.
- Attachment upload/removal activity and metadata changes should commit together where possible.
- Work item/project archive changes racing with upload/removal must be resolved under transaction/locking
  rules so a successful mutation cannot commit after the project becomes read-only.
- Local seed and reset behavior must not delete arbitrary user-selected directories.

## Technical Expectations

- Use PostgreSQL for authoritative attachment metadata.
- Store bytes outside PostgreSQL.
- Add one focused attachment repository and service rather than expanding `WorkItemService` with byte
  lifecycle concerns.
- Reuse existing work item/project/member authorization and writability rules.
- Keep policy constants and validation in a feature-local domain module.
- Keep DTO assembly separate from storage objects and streams.
- Keep upload parsing in transport adapters; endpoint/domain services should receive normalized metadata
  plus a bounded byte source.
- Keep download response modeling transport-neutral enough for Express now and a future Lambda adapter.
- Prefer streaming or bounded byte handling over unbounded whole-body buffering where the current request
  abstraction permits it.
- Generate opaque attachment ids and object keys independently from filenames.
- Use SHA-256 or an equivalent stable checksum available in the standard runtime.
- Keep storage driver/runtime configuration validated and explicit.
- Ensure local filesystem resources are closed and temporary files are cleaned on success and failure.
- Do not return adapter-specific exceptions to endpoint callers.
- Add focused failure-injection tests for storage write, metadata write, object read, and object remove.
- Keep schema migration additive; existing work items require no backfill.
- Keep existing work item page, board, report, and snapshot contracts backward compatible.
- Preserve Angular lazy-route boundaries and production bundle budgets.
- Do not add a broad state-management or upload library unless the technical design demonstrates that
  native browser/Angular behavior cannot meet the scoped workflow safely.

## Success Criteria

The release is successful when:

- users can upload supported files to active-project work items;
- attachment metadata remains visible and understandable after reload;
- authorized users can download the exact stored bytes under a safe filename;
- uploaders and maintainers can remove files under documented rules;
- archived-project attachments remain readable and immutable;
- server-side limits reject oversized, unsupported, excessive, and unsafe uploads;
- attachment storage paths/keys never appear in public contracts or UI;
- upload/removal activity is durable and does not create watcher notification noise;
- local setup requires no new external service;
- seeded attachments work from a fresh reset/migrate/seed flow;
- paged work-list, board, report, review, and snapshot payloads do not grow with attachment collections;
- concurrency tests cover quota and removal races;
- storage failure tests prove compensating and retryable behavior;
- lint, typecheck, API, contract, Angular, build, and browser verification pass;
- OpenAPI and operator documentation describe the local storage boundary and its limitations honestly;
- the public site presents attachments as a current capability without implying production-grade file
  scanning or S3 deployment.

## Risks And Mitigations

### Local Storage Is Mistaken For Production Object Storage

Risk: users may infer that a filesystem-backed preview is suitable for horizontally scaled or ephemeral
compute.

Mitigation: isolate storage behind a port, document single-node persistence and backup requirements,
avoid path leakage, and keep S3/CDK work explicitly deferred.

### Uploads Create An Unbounded Resource Path

Risk: large or numerous files can consume memory, disk, request time, and future Lambda payload limits.

Mitigation: enforce conservative per-file, count, aggregate-byte, and request-body limits on the server;
prefer bounded streaming; test rejection before persistence.

### File Type Checks Imply Malware Safety

Risk: extension and media-type validation may be mistaken for content security.

Mitigation: use an allowlist and forced downloads, reject active content, document that malware scanning
is absent, and do not claim internet-safe file handling.

### Database And Storage Diverge

Risk: object operations cannot participate in PostgreSQL transactions, producing orphaned bytes or stale
metadata.

Mitigation: order operations deliberately, use temporary writes, compensate on metadata failure, retain
metadata on removal failure, support cleanup of missing objects, and test every failure boundary.

### Attachment UI Overwhelms Work Item Detail

Risk: another full workflow section makes the already capable detail page harder to scan.

Mitigation: load independently, use compact rows and one primary add action, keep empty states small, and
avoid previews or always-visible upload forms.

### Duplicate Or Unsafe Filenames Cause Confusion

Risk: filenames can collide, contain paths/control characters, or make download behavior ambiguous.

Mitigation: treat names as normalized display metadata, generate opaque keys, permit duplicate identity,
use standards-compatible headers, and show uploader/time context.

### Concurrency Bypasses Limits

Risk: simultaneous uploads both pass count/byte checks and exceed item policy.

Mitigation: enforce quota checks inside an appropriate transaction and lock scope, then cover the losing
path with deterministic concurrency tests.

### Removal Erases Audit Context

Risk: deleting the attachment row also removes the only meaningful record of the file.

Mitigation: write upload/removal activity with safe immutable metadata and do not make activity rendering
depend on the live row.

### Cloud Transition Requires A New Upload Flow

Risk: proxying bytes through Express works locally but may not be ideal for API Gateway/Lambda and S3.

Mitigation: keep attachment identity and lifecycle independent from transfer mechanics, model storage as
opaque operations, and allow a future signed-upload/download design to replace transport behavior without
changing product semantics.

## Deferred Opportunities

- S3 storage adapter and AWS CDK storage resources.
- Presigned direct-to-object-store upload and download.
- Multipart/resumable uploads and large-file support.
- Antivirus scanning, quarantine, and asynchronous attachment readiness.
- Image/PDF previews and generated thumbnails.
- File versioning and replacement history.
- Comment, report, project, milestone, and cycle attachments.
- Inline rich-text image embedding.
- Workspace quotas, usage reporting, retention policy, and billing controls.
- Attachment search, OCR, indexing, and extracted text.
- Attachment filters, counts, and indicators on work lists or boards.
- Attachment references in reports, exports, closeout snapshots, and notifications.
- External drive integrations and linked-document synchronization.
- Public or guest attachment links.
- Data-loss prevention, legal hold, e-discovery, and compliance audit exports.
- Storage repair/reconciliation jobs and orphan-object dashboards.
- Content-addressed deduplication.
- Attachment migration/import from third-party project tools.
- Production authentication and project-specific access controls.
- Horizontally scaled hosted deployment and observability.

## Open Questions

1. What initial per-file, per-item count, and aggregate byte limits best balance local utility with a
   credible future Lambda transport path?
2. Should the initial client support multi-file selection or intentionally ship one file per action?
3. Should supported type policy require both extension and media type, and how should
   `application/octet-stream` from unreliable clients be handled?
4. Should attachment upload update the work item's `updatedAt`, affecting recent-work sorting and stale
   risk, or remain collaboration activity only?
5. Should a missing storage object during removal be treated as successful cleanup with warning-level
   operational evidence?
6. Should the local filesystem adapter be the only runtime adapter in v0.2.7, or is a disabled/example
   S3 adapter valuable enough to justify AWS SDK surface before deployable infrastructure exists?
7. Should upload be multipart form data, one raw binary request with normalized headers, or an
   adapter-specific request transformed into one endpoint input contract?
8. Should download proxy bytes through the application or use an internal redirect abstraction that is
   initially fulfilled by Express?
9. Where should the compact attachment section sit relative to comments, relationships, hierarchy, and
   activity on work item detail?
10. Should upload/removal activity include checksum metadata, or keep checksum strictly operational?

## Proposed Defaults For Technical Design

- Use a 4 MiB maximum per file, 20 live attachments per work item, and 50 MiB aggregate live bytes per
  work item for the first release.
- Support multi-file selection, but upload each file as an independent request with independent result
  state.
- Use an explicit extension/media-type allowlist. Reject unknown binary input and do not accept
  `application/octet-stream` as a bypass.
- Do not update work item `updatedAt` for attachment activity. Preserve list sorting and stale-work
  semantics; activity has its own timestamp.
- Treat a missing object during authorized removal as stale-storage cleanup: preserve removal activity,
  delete metadata, and emit safe operational logging.
- Implement only local filesystem and in-memory test storage adapters in v0.2.7. Do not add the AWS SDK
  until an S3 adapter is exercised by an actual deployment path.
- Use multipart parsing in the Express adapter if it can enforce limits before buffering and normalize
  into a transport-neutral attachment upload input. Do not expose multipart types to services.
- Proxy authorized downloads through the application in this release, but keep endpoint/service output
  independent from local file paths so a future signed response is possible.
- Place Attachments after the primary detail/edit summary and relationship/hierarchy context, before the
  longer Comments and Activity sections, subject to browser verification on common laptop height.
- Keep checksum operational and out of ordinary user-facing activity/DTOs unless needed for diagnostics.
- Use uploader-or-maintainer removal permissions and active-project writability exactly as described in
  this PRD.
- Record activity but do not add attachment notifications.
- Keep attachment list/read contracts dedicated and independently loaded; do not expand paged work-list
  DTOs or immutable snapshot schemas.
