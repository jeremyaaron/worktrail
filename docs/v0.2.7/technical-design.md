# Worktrail v0.2.7 Technical Design

## Status

Draft

## Summary

v0.2.7 adds work item attachments through a focused metadata, storage, API, and Angular feature
boundary.

The implementation will:

- store attachment identity, ownership, policy evidence, and audit context in PostgreSQL;
- store immutable file bytes behind an attachment object-store port;
- provide a local filesystem adapter for development and production preview;
- provide an in-memory adapter for isolated service and endpoint tests;
- accept one bounded raw-binary request per file at the Express boundary;
- let the Angular client select multiple files while tracking each request independently;
- enforce extension, declared media type, content signature, size, count, and aggregate-byte policy on
  the server;
- proxy authorized downloads through a transport-neutral binary response description;
- allow uploaders to remove their own files and owners/maintainers to remove any file in an active
  project;
- retain attachment upload and removal activity without retaining deleted attachment rows;
- load a compact attachment section independently on work item detail;
- keep attachment collections out of work-list, board, report, export, and snapshot contracts;
- seed deterministic metadata and matching local objects;
- document the limits of local storage and the future S3/direct-transfer boundary.

The design deliberately does not add a generic asset framework, multipart upload dependency, S3 SDK,
presigned transfer, malware scanning, previews, background jobs, or attachment notification behavior.

## Resolved Decisions

### Initial Attachment Policy

Use these fixed server limits:

```ts
export const attachmentPolicy = {
  maxFileBytes: 4 * 1024 * 1024,
  maxAttachmentsPerWorkItem: 20,
  maxAggregateBytesPerWorkItem: 50 * 1024 * 1024,
  maxFileNameCodePoints: 180,
} as const;
```

The count and per-file limits impose an 80 MiB theoretical ceiling. The lower 50 MiB aggregate limit
therefore remains an independent product constraint rather than a redundant restatement of the other
limits.

Rationale:

- 4 MiB is useful for screenshots, evidence, small office documents, and exported diagnostics;
- one bounded byte array remains reasonable for the current Node process and test suite;
- independent file requests keep request and response payloads conservative for a later function
  transport;
- 20 rows are still compact enough for an independently loaded detail section;
- 50 MiB prevents one item from accumulating the full theoretical per-file allowance;
- a fixed policy is easier to operate and verify than workspace-configurable quotas in this release.

The client receives the active policy from the list endpoint for accurate helper text and preflight
validation. Backend policy remains authoritative.

### One Raw Request Per File

Do not use multipart form data in v0.2.7. Upload each file as one request:

```text
POST /api/work-items/:workItemId/attachments
Content-Type: application/octet-stream
X-Worktrail-Filename: design%20review.png
X-Worktrail-Media-Type: image/png

<raw bytes>
```

`X-Worktrail-Filename` is an RFC 3986 percent-encoded UTF-8 display name. It is decoded once at the
adapter/endpoint boundary and then normalized by attachment policy. `X-Worktrail-Media-Type` describes
the file's declared type. The transport content type remains `application/octet-stream` so the global
JSON parser does not consume the body and the route-specific raw parser can enforce a byte limit.

The Angular picker may select multiple files. The client creates one queue entry and one request per
file, uploads sequentially, and retains independent progress, success, failure, and retry state.

Rationale:

- no multipart parser or multipart-specific type enters endpoint or service code;
- each request has one identity, one policy result, one progress stream, and one transaction outcome;
- one invalid file does not invalidate a valid sibling selection;
- `express.raw()` can reject an oversized body before endpoint execution;
- a future API Gateway adapter can decode one binary body into the same endpoint input;
- a future presigned flow can replace transfer mechanics without changing attachment metadata or
  permissions.

The custom metadata headers are part of the v0.x API contract and will be documented in OpenAPI. They
are not reused as a generic file-transfer convention.

### Bounded Byte Arrays Instead Of Streaming

The storage port and endpoint input use `Uint8Array` for v0.2.7.

```ts
export interface AttachmentUploadInput {
  fileName: string;
  declaredMediaType: string;
  bytes: Uint8Array;
}
```

The 4 MiB parser limit bounds memory before endpoint execution. Service validation does not concatenate
unbounded chunks. Download reads at most the recorded policy-sized object and returns a binary response
body.

Rationale:

- the existing `AppRequest.body` model is value-based rather than stream-based;
- SHA-256 and content checks need access to the complete small object;
- local and in-memory adapters stay simple and deterministic;
- streaming abstractions would add lifecycle and error complexity without supporting large files in
  this release;
- the storage port does not expose local paths, so a later S3 adapter can introduce a signed-transfer or
  stream-specific port revision at the transport boundary.

This decision is safe only because the raw parser and policy share the same hard bound. Raising the
file limit requires revisiting streaming, function payload limits, and direct object-store transfer.

### Metadata And Byte Ownership

PostgreSQL is authoritative for:

- attachment identity;
- workspace, project, work item, and uploader relationships;
- normalized display filename and media type;
- byte size and SHA-256 checksum;
- opaque storage key;
- creation time.

The object store is authoritative only for immutable bytes addressed by the opaque key. A storage
object has no public identity without its PostgreSQL row.

Filename, workspace id, project id, and work item id do not determine a storage path. The application
generates a cryptographically random 64-character lowercase hexadecimal key. Local storage may shard
that key internally, but callers cannot choose or observe the resulting path.

### Storage Adapters

Implement only:

- `LocalAttachmentObjectStore` for local development and production preview;
- `InMemoryAttachmentObjectStore` for focused tests and deterministic fault injection.

Do not install the AWS SDK or provide an unexercised S3 adapter.

The local adapter defaults to `<repository>/.worktrail/attachments` in development. Production mode
requires an explicitly configured absolute path. The directory is ignored by Git.

Rationale:

- a local checkout gains no new infrastructure dependency;
- explicit production configuration avoids silently relying on an ephemeral working directory;
- an interface proven by one real adapter is more useful than a speculative cloud implementation;
- S3 support belongs with deployable bucket, IAM, encryption, CORS, lifecycle, and transfer decisions.

### Upload Consistency

Upload uses a precheck, object write, metadata transaction, and compensation sequence:

1. Validate headers, byte length, normalized filename, media type, and content.
2. Read and authorize the work item and active project before consuming storage capacity.
3. Generate attachment id, storage key, checksum, and timestamp.
4. Write the immutable object.
5. Start a PostgreSQL transaction.
6. lock the project `FOR SHARE`, then the work item `FOR UPDATE`;
7. Revalidate workspace ownership, actor access, and active-project state.
8. Count current attachments and sum current bytes under the work-item lock.
9. Reject a count or aggregate limit breach.
10. Insert attachment metadata and upload activity in the same transaction.
11. Commit.
12. If steps 5-11 fail, attempt to remove the newly written object.

The preliminary authorization check prevents known unauthorized requests from writing objects. The
locked recheck resolves archive and ownership races. The work-item lock serializes quota decisions for
the same item without serializing uploads across all work items in a project. A project `FOR SHARE` lock
allows concurrent attachment mutations but conflicts with project archival updates.

If compensation fails, metadata remains absent and the service emits safe error-level operational
evidence containing the attachment id and error class, never the local path or storage key. Automated
orphan reconciliation is deferred.

### Removal Consistency

Removal keeps the PostgreSQL transaction open while the small local object is removed:

1. Read attachment context and conceal missing or cross-workspace identity.
2. Start a PostgreSQL transaction.
3. Lock the project `FOR SHARE`, work item `FOR UPDATE`, and attachment `FOR UPDATE` in that order.
4. Revalidate active-project state and uploader-or-role permission.
5. Remove the object.
6. If the object is already absent, emit safe warning-level operational evidence and continue.
7. Insert removal activity with copied safe metadata.
8. Delete the live attachment row.
9. Commit.

If object removal fails, the transaction rolls back and metadata remains retryable. If the database
commit fails after object removal, metadata may temporarily point to a missing object. A later download
returns a controlled storage error, and a later authorized removal treats the missing object as repair
and completes metadata cleanup without duplicate committed activity.

Holding a database transaction around local deletion is acceptable for this bounded, single-node
adapter. A network object store should use an explicit deletion state or transactional outbox rather
than holding row locks across a remote call. That design is deferred with the S3 adapter.

### Download Behavior

Proxy bytes through the application in v0.2.7.

The endpoint resolves the attachment row, revalidates actor access, loads bytes by opaque key, verifies
recorded size and SHA-256, and returns a transport-neutral binary body. Express emits:

```text
Content-Type: <normalized safe media type>
Content-Disposition: attachment; filename="fallback.ext"; filename*=UTF-8''<encoded-name>
Content-Length: <recorded bytes>
Cache-Control: private, no-store
X-Content-Type-Options: nosniff
```

The response always uses `attachment`, never `inline`. The endpoint does not return a path, object key,
or permanent object URL.

A missing object, unexpected size, or checksum mismatch returns
`ATTACHMENT_STORAGE_UNAVAILABLE` after authorization succeeds. It is not converted to an empty download
or a resource-level `404` because the authoritative metadata record exists.

### File Type Validation

Require a supported normalized extension, an allowed declared media type for that extension, and a
matching bounded content check.

The policy table includes:

| Extensions      | Canonical media type             | Content check                                  |
| --------------- | -------------------------------- | ---------------------------------------------- |
| `.png`          | `image/png`                      | PNG signature                                  |
| `.jpg`, `.jpeg` | `image/jpeg`                     | JPEG start marker                              |
| `.gif`          | `image/gif`                      | GIF87a or GIF89a signature                     |
| `.webp`         | `image/webp`                     | RIFF/WEBP signature                            |
| `.pdf`          | `application/pdf`                | PDF header                                     |
| `.txt`          | `text/plain`                     | valid UTF-8, no NUL                            |
| `.md`           | `text/markdown`                  | valid UTF-8, no NUL                            |
| `.csv`          | `text/csv`                       | valid UTF-8, no NUL                            |
| `.json`         | `application/json`               | valid UTF-8 JSON                               |
| `.docx`         | Open XML Word media type         | ZIP signature and Word package markers         |
| `.xlsx`         | Open XML Spreadsheet media type  | ZIP signature and Spreadsheet package markers  |
| `.pptx`         | Open XML Presentation media type | ZIP signature and Presentation package markers |

The browser may derive the canonical declared media type from the normalized extension when
`File.type` is empty. The server never accepts `application/octet-stream` as the declared file media
type. The raw HTTP transport still uses that value independently.

Open XML validation uses `yauzl` to inspect bounded ZIP directory metadata for `[Content_Types].xml` and
the expected `word/`, `xl/`, or `ppt/` package root. It does not inflate document contents. Entry
enumeration is lazy, has a maximum entry count, and never extracts to disk. ZIP/package checks are
defensive type evidence, not malware scanning or full Office validation.

### Work Item Timestamp And Notifications

Attachment upload and removal do not update `work_items.updated_at` and do not create notifications.

Rationale:

- activity has its own timestamp and appears in the work item timeline;
- list `updated` sorting should continue to represent work item field mutation;
- uploads should not make unrelated saved views or stale-work calculations change position;
- watcher notification expansion is not part of this release.

### UI Placement

Place Attachments after relationship and hierarchy context and before Comments and Activity on work item
detail.

The section is a compact unframed region with a heading, count, one `Add files` command, and row list.
It does not use previews, nested cards, a permanent drop zone, or always-visible file inputs. It loads
independently after the primary work item is available.

### Checksum Visibility

Store lowercase SHA-256 hexadecimal checksums but do not expose them in ordinary DTOs, activity values,
UI, object keys, or logs. Checksums support integrity verification, migration evidence, and focused
diagnostics; they are not user-facing version identity in this release.

## Current Implementation Context

### Shared Contracts

`packages/contracts/src` owns public DTO vocabulary. `activity.ts` defines the shared activity event
union. Existing work item list/detail contracts do not contain attachment data and should remain
unchanged.

The contracts package exports source modules through its existing barrel. Attachment contracts should
be added as a focused module rather than placed in `work-items.ts`.

### HTTP Boundary

`apps/api/src/http/app-request.ts` defines transport-neutral `AppRequest`, `AppResponse`, and
`EndpointHandler`. `AppRequest.body` is already `unknown`, so an Express raw parser can provide a
`Buffer`, which is a `Uint8Array`, without changing request vocabulary.

`apps/api/src/adapters/express/handler-adapter.ts` currently sends strings and Buffers directly and JSON
serializes other values. The implementation needs an explicit binary response variant rather than
making endpoint handlers depend on Node `Buffer`.

`apps/api/src/adapters/express/server.ts` installs `express.json()` globally before route registration.
A raw attachment route works because its transport content type is not JSON and a route-local
`express.raw()` parser runs afterward.

### Routes And Services

`apps/api/src/adapters/express/routes/work-item-routes.ts` owns work item, comment, relationship,
watcher, and activity routes. Attachments should use a separate `attachment-routes.ts` module so body
parsing and storage dependencies do not enlarge that route file.

Established endpoint handlers construct focused services from repositories, actor context, optional
database transactions, and clocks/id generators. Attachments need one dedicated service because byte
lifecycle and compensation do not belong in `WorkItemService`.

### Persistence

Drizzle schema lives in `apps/api/src/db/schema.ts`; migration `0016_scalable_search.sql` is current.
Repository construction is centralized in `apps/api/src/repositories/index.ts`, and transaction helpers
recreate repository instances over the transaction connection.

The project repository does not yet expose a shared row lock, and the attachment repository does not
exist. The implementation will add only the lock/query methods needed by the consistency algorithms.

### Angular Detail Page

`apps/web/src/app/features/work-items/work-item-detail-page.component.ts` is already a large lazy-route
component with extracted summary, hierarchy, and parent/child components. Attachments should be another
extracted standalone component under `features/work-items/components`.

The detail route can navigate between work item ids without destroying the route component. The
attachment component must react to input id changes, cancel or ignore stale requests, clear old rows,
and load the new item's attachments.

`apps/web/src/app/shared/download-file.ts` already provides safe browser Blob download and
`Content-Disposition` filename parsing for CSV/report downloads. Attachment download should reuse and,
if necessary, harden this helper rather than create a second browser-download path.

### Runtime And Seed

`apps/api/src/config/runtime-config.ts` validates database, CORS, static asset, and runtime settings.
`apps/api/src/main.ts` is currently synchronous. Local object-store initialization requires an async
startup function that validates/creates the configured root before listening.

`apps/api/src/db/seed.ts` writes deterministic database records only. Seeded attachment metadata must be
paired with deterministic byte writes to the configured local store.

## Contract Design

### Attachment DTO

Add `packages/contracts/src/attachments.ts`:

```ts
import type { MemberDto } from "./members.js";

export interface WorkItemAttachmentDto {
  id: string;
  workItemId: string;
  fileName: string;
  mediaType: string;
  byteSize: number;
  uploader: MemberDto;
  createdAt: string;
  permissions: {
    canRemove: boolean;
  };
}
```

Do not expose `workspaceId`, `projectId`, `uploaderMemberId`, checksum, or storage key. Work item identity
is useful to reject stale Angular responses after in-place route navigation; broader ownership fields
remain server concerns.

### Attachment Policy DTO

```ts
export interface AttachmentTypePolicyDto {
  extensions: string[];
  mediaTypes: string[];
  canonicalMediaType: string;
  category: "image" | "pdf" | "text" | "data" | "document";
}

export interface AttachmentPolicyDto {
  maxFileBytes: number;
  maxAttachmentsPerWorkItem: number;
  maxAggregateBytesPerWorkItem: number;
  maxFileNameCodePoints: number;
  acceptedTypes: AttachmentTypePolicyDto[];
}
```

The server maps its immutable policy into this DTO. The UI uses it for the input `accept` value,
guidance, category labels, and preflight errors.

### List Response

```ts
export interface WorkItemAttachmentListDto {
  items: WorkItemAttachmentDto[];
  policy: AttachmentPolicyDto;
  usage: {
    attachmentCount: number;
    aggregateBytes: number;
    remainingAttachmentSlots: number;
    remainingBytes: number;
  };
  permissions: {
    canUpload: boolean;
  };
}
```

Returning capabilities avoids duplicating archived-project and role policy in Angular. The server still
rechecks every mutation. Remaining capacity is advisory because another request can mutate storage
before upload.

### Binary Response

Extend the application response vocabulary:

```ts
export interface AppBinaryBody {
  kind: "binary";
  bytes: Uint8Array;
}

export type AppResponseBody<T> = T | AppBinaryBody;

export interface AppResponse<T = unknown> {
  status: number;
  body?: AppResponseBody<T>;
  headers?: Record<string, string>;
}
```

Add an `isAppBinaryBody()` guard. Express converts `Uint8Array` to `Buffer` only in the adapter. A future
function adapter can base64-encode the same response and mark it binary without changing the endpoint.

JSON DTOs never include byte arrays.

### Activity Types

Add matching values to shared and domain unions:

```ts
"work_item.attachment_uploaded";
"work_item.attachment_removed";
```

Upload activity stores:

```json
{
  "newValue": {
    "attachment": {
      "id": "attachment-id",
      "fileName": "design-review.png",
      "mediaType": "image/png",
      "byteSize": 183402
    }
  }
}
```

Removal activity stores the same object under `previousValue` and `null` under `newValue`. Neither event
stores checksum or storage key. Summaries use the normalized filename.

## PostgreSQL Design

### Attachment Table

Add migration `0017_*` and a Drizzle `workItemAttachments` table:

```text
work_item_attachments
  id                         uuid primary key
  workspace_id               uuid not null references workspaces(id)
  project_id                 uuid not null references projects(id)
  work_item_id               uuid not null references work_items(id) on delete restrict
  uploader_member_id         uuid not null references members(id)
  file_name                  text not null
  media_type                 text not null
  byte_size                  integer not null
  checksum_sha256            text not null
  storage_key                text not null
  created_at                 timestamptz not null
```

Constraints:

- `byte_size > 0 AND byte_size <= 4194304`;
- `char_length(file_name) BETWEEN 1 AND 180`;
- `checksum_sha256` is exactly 64 lowercase hexadecimal characters;
- `storage_key` is exactly 64 lowercase hexadecimal characters;
- unique `storage_key`.

Do not place the media-type allowlist in a database check. Type policy may evolve without requiring a
schema migration for every accepted extension. Service validation owns that mutable product rule.

Use `ON DELETE RESTRICT` for work items. Work item deletion is absent today, and a future delete flow
must remove objects deliberately rather than allowing a database cascade to create orphaned bytes.

### Indexes

Add:

```text
work_item_attachments_work_item_created_id_idx
  (work_item_id, created_at DESC, id DESC)

work_item_attachments_workspace_id_idx
  (workspace_id)

work_item_attachments_storage_key_unique
  UNIQUE (storage_key)
```

The first index supports ordered detail reads and quota aggregation over at most 20 rows. The workspace
index supports ownership diagnostics and future cleanup. No filename or checksum search index is needed.

### Cross-Table Ownership

Foreign keys cannot prove that redundant workspace/project ids match the owning work item. The service
always derives these values from the locked work item and never accepts them from requests. Repository
integration tests prove mismatched direct inserts are not produced by application code.

A future schema revision may add composite ownership keys if direct database writers become a supported
integration boundary. They are unnecessary for the current single application writer.

## Repository Design

### Attachment Repository

Add `createWorkItemAttachmentRepository(db)` with focused methods:

```ts
create(record);
findById(id);
findByIdForUpdate(id);
listByWorkItem(workItemId);
getUsageByWorkItem(workItemId);
deleteById(id);
```

`listByWorkItem` orders by `createdAt DESC, id DESC`. `getUsageByWorkItem` returns count and
`COALESCE(SUM(byte_size), 0)` as numbers. Repository records include internal ownership and storage
fields; DTO mapping does not.

Register `workItemAttachments` in `createRepositories` so transaction helpers automatically bind it to
the active transaction.

### Project Share Lock

Add `projects.findByIdForShare(id)`. It performs a PostgreSQL `FOR SHARE` read.

Attachment transactions lock in this order:

1. project `FOR SHARE`;
2. work item `FOR UPDATE`;
3. attachment `FOR UPDATE`, when removing.

Project archival updates require a row update and therefore wait for the share lock. Concurrent
attachment operations in the same project may both hold the share lock, while operations on one work
item serialize on its row.

All attachment mutation paths use the same order to reduce deadlock risk.

## Attachment Policy Design

### Policy Module

Add `apps/api/src/domain/attachment-policy.ts` containing:

- numeric limits;
- extension/media mappings;
- filename normalization;
- declared media-type validation;
- content checks;
- policy DTO mapping;
- human-readable safe validation details.

The module is deterministic and does not access repositories, storage, Express, or environment state.

### Filename Normalization

Normalize in this order:

1. Decode the percent-encoded header once; reject malformed escapes.
2. Normalize Unicode to NFC.
3. Replace `/` and `\\` path separators with `_`.
4. Remove C0/C1 control characters and line separators.
5. Collapse runs of horizontal whitespace to one space.
6. Trim surrounding whitespace and trailing periods.
7. Reject `.` or `..` and names empty after normalization.
8. Enforce at most 180 Unicode code points.
9. Extract and lowercase the final extension for policy matching.

The normalized name is the persisted display/download name. Duplicate normalized names are allowed.
The implementation never passes this name to a filesystem API.

### Content Checks

Image/PDF checks inspect fixed signatures. Text uses `TextDecoder('utf-8', { fatal: true })`, rejects
NUL, and applies format-specific checks. JSON must parse successfully. CSV need not be imported into
Worktrail's work-item CSV schema; it only needs valid bounded UTF-8 without NUL because arbitrary project
data CSV is legitimate.

Open XML checks enumerate ZIP metadata lazily with these limits:

- no more than 2,000 entries;
- no directory extraction;
- no inflated entry reads for ordinary package classification;
- required `[Content_Types].xml` entry;
- at least one entry under the expected application root;
- reject encrypted or malformed central directories.

The ZIP reader is the only new runtime dependency justified by file validation. It remains local to the
policy/content inspection adapter and is not exposed in service contracts.

### Policy Error Details

Use `VALIDATION_ERROR` for malformed headers, empty bytes, unsafe names, extension/media mismatch, and
content mismatch. Details may include:

```json
{
  "field": "file",
  "reason": "unsupported_type",
  "fileName": "script.svg"
}
```

Never echo raw control characters, bytes, paths, storage keys, or adapter errors.

Use `PAYLOAD_TOO_LARGE` with status 413 when the raw parser exceeds 4 MiB. Use
`ATTACHMENT_LIMIT_EXCEEDED` with status 422 for count or aggregate quota failures.

## Storage Port Design

### Port

Add `apps/api/src/storage/attachment-object-store.ts`:

```ts
export interface AttachmentObjectStore {
  initialize(): Promise<void>;
  put(key: string, bytes: Uint8Array): Promise<void>;
  get(key: string): Promise<Uint8Array | null>;
  remove(key: string): Promise<"removed" | "missing">;
}
```

`put` is create-only and fails if the key already exists. `get` returns a copy/value, not a local path.
`remove` distinguishes repairable absence from a completed deletion. Only valid opaque keys are accepted.

Do not add list-by-prefix, public URL, arbitrary metadata, overwrite, or filesystem-stat methods. Those
would turn the focused port into a speculative object-store wrapper.

### Local Adapter

`LocalAttachmentObjectStore`:

- resolves and retains one configured absolute root;
- validates keys against `/^[a-f0-9]{64}$/`;
- maps keys to `<root>/objects/<first-two-characters>/<key>`;
- creates root and shard directories with restrictive process-appropriate permissions;
- writes to a random sibling temporary file using create-exclusive mode;
- links the completed temporary file to the final path so existing objects cannot be overwritten;
- removes the temporary file on success or failure;
- reads only regular files and rejects objects larger than the server policy bound;
- maps `ENOENT` to `null`/`missing` and wraps other filesystem errors;
- never returns the resolved path to callers.

`initialize()` creates the root and verifies it is a writable directory before the API listens. It does
not delete existing objects.

### In-Memory Adapter

The in-memory adapter stores copied `Uint8Array` values in a private map. It supports injected failures
for the next put, get, or remove operation. Tests use it to prove compensation and retry behavior without
depending on filesystem timing.

Local adapter integration tests use `mkdtemp()` outside the repository and remove the directory in
`afterEach`/`afterAll` cleanup.

### Storage Errors

Adapter errors are internal classes. The service maps unavailable write/read/remove operations to an
`AttachmentStorageUnavailableError` with status 503 and a generic message.

Operational logging may include:

- operation name;
- attachment id;
- error name/class;
- compensation or stale-object outcome.

It must not include byte bodies, configured root, resolved path, storage key, or raw request headers.

## Service Design

### Service Context

Add `AttachmentService` with:

```ts
export interface AttachmentServiceContext {
  repositories: Repositories;
  db: WorktrailDb;
  objectStore: AttachmentObjectStore;
  now?: () => Date;
  createId?: () => string;
  createStorageKey?: () => string;
  logger?: AttachmentOperationalLogger;
}
```

Production attachment mutations require `db`; unlike older fallback service tests, consistency behavior
must not silently degrade to sequential nontransactional calls. Tests provide a database integration
context or test transaction harness where lock behavior matters.

### List Algorithm

`listForWorkItem(actor, workItemId)`:

1. Resolve work item and project under the actor workspace.
2. Return `NOT_FOUND` for absent/cross-workspace identity.
3. Read attachments and current usage without reading objects.
4. Batch-resolve uploader members.
5. Map newest-first DTOs with per-row `canRemove`.
6. Return policy, usage, and `canUpload = project.status === 'active'`.

All current active workspace roles may upload. `canRemove` is false for archived projects; otherwise it
is true for the uploader, owner, or maintainer.

### Upload Algorithm

`upload(actor, workItemId, input)` implements the resolved upload consistency sequence.

Before object write it:

- validates `bytes.byteLength` is positive and within 4 MiB;
- normalizes filename and validates extension/media/content;
- verifies actor/work item/project visibility and active project;
- computes SHA-256 from the exact accepted bytes;
- generates independent attachment id and random storage key.

Inside the metadata transaction it derives workspace/project ids from the locked work item, checks usage,
inserts the attachment, and inserts exactly one upload activity event. It does not update the work item
or notify watchers.

It returns the created DTO with current actor member data and `canRemove: true`.

### Download Algorithm

`download(actor, attachmentId)`:

1. Resolve attachment metadata.
2. Resolve work item/project and conceal cross-workspace identity.
3. Permit active members even when the project is archived.
4. Read bytes by internal key.
5. Reject absence, over-limit bytes, size mismatch, or checksum mismatch as controlled storage failure.
6. Return filename, media type, size, and bytes to the endpoint.

The service does not create HTTP headers. A focused response-header helper maps already normalized data
to safe standards-compatible headers.

### Removal Algorithm

`remove(actor, attachmentId)` implements the resolved transaction and lock sequence. Permission is:

```ts
const canRemove =
  project.status === "active" &&
  (attachment.uploaderMemberId === actor.memberId ||
    actor.role === "owner" ||
    actor.role === "maintainer");
```

Archived project status is evaluated before role/ownership and returns `CONFLICT`. Active contributors
removing another member's file receive `FORBIDDEN`. Missing and cross-workspace identity returns
`NOT_FOUND`.

The activity event is inserted before the live row is deleted in the same transaction. A missing object
still produces one committed removal event because it records the authorized cleanup of stale metadata.

### DTO Mapping

Keep internal records and DTO mapping separate. The mapper requires explicit uploader member and actor
capability context. TypeScript should make it impossible to spread a repository record into a public DTO,
which reduces accidental storage-key or checksum exposure.

## Endpoint Design

### Routes

Register routes in this order:

```text
GET    /api/work-items/:workItemId/attachments
POST   /api/work-items/:workItemId/attachments
GET    /api/attachments/:attachmentId/content
DELETE /api/attachments/:attachmentId
```

The attachment-id routes are not nested under a caller-supplied work item because attachment metadata is
authoritative for ownership. Every operation still resolves its owning work item and project.

Register `/api/attachments/...` before any future generic attachment parameter route. Existing work-item
route ordering remains unchanged.

### List

```text
GET /api/work-items/:workItemId/attachments
200 WorkItemAttachmentListDto
```

No pagination is needed under the hard count limit of 20.

### Upload

The upload route installs:

```ts
express.raw({
  type: "application/octet-stream",
  limit: attachmentPolicy.maxFileBytes,
});
```

A focused wrapper maps body-parser `entity.too.large` to a JSON `PAYLOAD_TOO_LARGE` response instead of
Express HTML or a generic 500. It rejects a missing/wrong transport content type before endpoint
execution.

The endpoint:

- parses and validates work item id;
- requires exactly one filename header and media-type header;
- verifies `request.body` is a `Uint8Array`;
- invokes `AttachmentService.upload`;
- returns `201` and `WorkItemAttachmentDto`.

### Download

```text
GET /api/attachments/:attachmentId/content
200 binary body
```

The endpoint maps service output to `AppBinaryBody` and defensive headers. The Express adapter detects
the discriminant and sends a `Buffer` without JSON serialization.

HEAD and byte-range requests are not supported in v0.2.7. The response uses a known full content length.

### Remove

```text
DELETE /api/attachments/:attachmentId
204 No Content
```

Update `adaptEndpoint` so a response with status 204 and no body calls `response.status(204).end()` rather
than serializing `{}`. This is a general correctness improvement covered by adapter tests.

### Error Vocabulary

Extend `AppErrorCode` with:

```ts
"PAYLOAD_TOO_LARGE";
"ATTACHMENT_LIMIT_EXCEEDED";
"ATTACHMENT_STORAGE_UNAVAILABLE";
```

Statuses:

| Code                             | Status | Use                                           |
| -------------------------------- | -----: | --------------------------------------------- |
| `VALIDATION_ERROR`               |    400 | filename, type, content, or empty-body policy |
| `UNAUTHORIZED`                   |    401 | established actor resolution failure          |
| `FORBIDDEN`                      |    403 | contributor removing another uploader's file  |
| `NOT_FOUND`                      |    404 | missing or concealed attachment/work item     |
| `CONFLICT`                       |    409 | archived-project mutation or stale removal    |
| `PAYLOAD_TOO_LARGE`              |    413 | raw request exceeds per-file parser bound     |
| `ATTACHMENT_LIMIT_EXCEEDED`      |    422 | item count or aggregate bytes exceeded        |
| `ATTACHMENT_STORAGE_UNAVAILABLE` |    503 | object read/write/remove/integrity failure    |

No error response includes path, key, checksum, or adapter message.

## Express And Runtime Design

### App Construction

Extend `CreateExpressAppOptions` with `attachmentObjectStore?: AttachmentObjectStore`. Production startup
always provides it. The optional constructor seam keeps tests that exercise unrelated routes from
needing persistent storage; attachment routes are registered only when repositories, database, and the
store are present.

Add an attachment-enabled API test app helper so endpoint tests cannot accidentally omit the dependency.
OpenAPI remains unconditional because it describes the production API, not test construction options.

### Runtime Configuration

Extend `RuntimeConfig`:

```ts
attachmentStorageDriver: "local";
attachmentStoragePath: string;
```

Environment variables:

```text
WORKTRAIL_ATTACHMENT_STORAGE_DRIVER=local
WORKTRAIL_ATTACHMENT_STORAGE_PATH=/absolute/path/to/worktrail-attachments
```

Rules:

- driver defaults to `local` and rejects every other value;
- development defaults to the repository-local `.worktrail/attachments` path resolved from the runtime
  module location rather than the caller's current working directory;
- test code injects stores/temporary paths and does not depend on the default;
- production requires an explicit absolute path;
- configured path must not be the filesystem root;
- initialization verifies the path is or can become a writable directory;
- startup errors identify the variable and remedy without printing credentials or resolved object paths.

Add `.worktrail/` to `.gitignore`.

### Startup

Refactor `main.ts` to an async `start()`:

1. load configuration;
2. create PostgreSQL pool, database, and repositories;
3. create and initialize the selected object store;
4. create Express app with database and storage dependencies;
5. listen.

If initialization fails, close the pool and exit nonzero. Startup logging may print the configured
storage driver and root at operator level, but request/error logs never print per-object paths or keys.

The readiness endpoint remains database-focused in v0.2.7. Startup proves local root access, while
per-request failures return 503. A periodic storage health probe is deferred until remote storage or
multi-node deployment makes it actionable.

## Angular API Design

### Attachments API

Add `core/api/attachments-api.ts` and expose focused facade methods:

```ts
listWorkItemAttachments(workItemId: string): Observable<WorkItemAttachmentListDto>
uploadWorkItemAttachment(
  workItemId: string,
  file: File,
  declaredMediaType: string
): Observable<HttpEvent<WorkItemAttachmentDto>>
downloadAttachment(attachmentId: string): Observable<HttpResponse<Blob>>
removeAttachment(attachmentId: string): Observable<void>
```

Upload sets:

- transport `Content-Type: application/octet-stream`;
- `X-Worktrail-Filename: encodeURIComponent(file.name)`;
- `X-Worktrail-Media-Type` to the file type or policy-derived canonical type;
- `observe: 'events'` and `reportProgress: true`.

Download uses `observe: 'response'` and `responseType: 'blob'`. It passes the response Blob and parsed
safe filename to the established `downloadBlob` helper.

### Progress Semantics

Map `HttpUploadProgressEvent` to an integer percentage only when `total` is known. Otherwise show an
indeterminate progress element and `Uploading`. A terminal response marks success. Network/API failures
retain the selected `File` object in memory for explicit retry until route change or successful removal
from the queue.

The component uploads queue entries sequentially. This keeps user-visible ordering stable, reduces local
memory/network pressure, and makes remaining-capacity updates understandable. Server locking still
protects concurrent clients.

## Angular Component Design

### Component Boundary

Add `WorkItemAttachmentsComponent` as a standalone child of the lazy work item detail route.

Inputs:

```ts
workItemId = input.required<string>();
```

Outputs:

```ts
activityChanged = output<void>();
```

The component owns attachment list, policy, usage, selection queue, upload progress, download state,
removal state, and retryable errors. The parent reacts to `activityChanged` by refreshing only activity,
not the primary detail DTO.

### Route Identity Changes

An effect observes `workItemId` and starts a new list load. On change it:

- increments a request generation or switches through `switchMap`;
- clears old items, policy, queue, and errors;
- cancels active list subscriptions;
- ignores late upload/download/remove responses for the prior item;
- loads the selected work item's list.

This preserves the established in-place navigation behavior for hierarchy and relationship links.

### Visual Composition

Render:

1. heading `Attachments` and count;
2. compact capacity/helper text when policy is loaded;
3. `Add files` action when `canUpload` and capacity remains;
4. hidden native multi-file input with policy-derived `accept`;
5. selected/upload queue rows while relevant;
6. loading, concise empty, error/retry, or attachment rows.

Each live row shows filename, category, formatted size, uploader, upload time, Download, and conditional
Remove. Long names wrap within a constrained text column; actions remain in a stable trailing area.
Narrow layouts move actions below metadata rather than compressing names into unusable widths.

Do not introduce an icon package solely for this section. Use the app's established text-command style
for `Download` and `Remove`; add familiar icons only if an existing repository icon primitive is
available at implementation time. Every action has a clear accessible name.

### Selection And Client Preflight

The picker permits `multiple`. For each selected file the client checks:

- nonempty bytes;
- size at or below policy;
- normalized/lowercase extension appears in accepted policy;
- declared or derived media type is allowed;
- selected queue plus server usage does not obviously exceed remaining slots/bytes.

Client failures appear immediately per file. They do not prevent valid sibling entries from uploading.
Server errors replace or refine client guidance and remain authoritative.

### Removal Confirmation

Use a focused confirmation that includes the normalized filename. Follow the current browser-confirm
pattern unless implementation reveals an existing reusable dialog primitive. While removal is active,
disable that row's Remove action. On success remove the row locally, update usage/count, emit
`activityChanged`, and announce success through the existing status pattern.

### Download State

Disable only the active row's Download action. A failed download leaves metadata visible and presents a
retryable row-level message. A storage-unavailable response is not treated as a missing list row.

### Styling And Budgets

Keep component styles in the extracted attachment component and reuse existing tokens, typography,
buttons, and status styles. The child is part of the existing lazy work-item chunk. Production build
budgets remain unchanged; implementation must clear rather than raise any component-style warning.

## Activity Integration

Add summaries:

```text
Uploaded attachment "design-review.png".
Removed attachment "design-review.png".
```

Use the existing actor and timestamp rendering. Activity list/read behavior requires no enrichment from
the deleted attachment row because all display context is copied into the event.

The attachment component emits one refresh after each successful upload and removal. Multiple sequential
uploads may coalesce activity refreshes after the queue drains to avoid repeated timeline requests while
still updating attachment rows immediately.

No notification event type, watcher query, source-event key, or unread-count behavior changes.

## Seed And Reset Design

### Seed Records

Add deterministic attachment ids, storage keys, rows, and activity where useful to the current seed:

- a small Markdown requirements note uploaded by Morgan Maintainer;
- a small JSON evidence file uploaded by Avery Owner;
- optionally a tiny generated PNG fixture only if its maintenance remains clear.

Use fixed byte contents and timestamps. Compute checksums from the actual seed bytes rather than hardcode
unchecked values. Keep totals far below policy limits.

### Seed Object Writes

The seed command loads the same storage configuration and initializes the local adapter. For each
deterministic seed object it:

1. reads an existing object if present;
2. accepts it when bytes match exactly;
3. removes and recreates it when bytes differ;
4. inserts/upserts matching metadata only after the object is correct.

This makes repeated seed runs idempotent without adding overwrite to the production storage port.

### Reset Behavior

Add an explicit `storage:reset` command for the local driver. It may delete only a configured path that:

- is absolute after resolution;
- is not `/`, the home directory, or the repository root;
- ends in the expected attachment storage directory or carries a store marker created by initialization.

`db:reset` continues to reset only PostgreSQL. Document the full clean-development sequence as storage
reset, database reset, migrate, and seed. This avoids silently deleting a user-selected directory from a
database command.

## OpenAPI Design

Add schemas for attachment item, policy, usage, list response, and attachment error responses.

Document upload as:

```yaml
requestBody:
  required: true
  content:
    application/octet-stream:
      schema:
        type: string
        format: binary
```

Document both required metadata headers, 4 MiB maximum, one-file-per-request semantics, supported types,
and representative 400/401/404/409/413/422/503 outcomes.

Document download as a binary response with `Content-Disposition`, `Content-Length`, `Cache-Control`,
and `X-Content-Type-Options` headers. Document that the endpoint always forces attachment disposition and
does not support range requests.

OpenAPI must not expose internal storage configuration, key, path, or checksum fields.

## Security And Privacy

- Resolve local actor membership before every operation.
- Conceal cross-workspace work items and attachments with `NOT_FOUND`.
- Derive workspace/project/uploader identity server-side.
- Recheck project state inside mutation transactions.
- Never use filenames as paths or keys.
- Reject control characters and malformed encoded filename headers.
- Apply the hard body parser limit before endpoint/service execution.
- Reject unknown, active-content, executable, archive, audio, and video types.
- Inspect supported content signatures in addition to extension/media claims.
- Force `Content-Disposition: attachment` and `nosniff`.
- Do not render or preview user files in the Worktrail origin.
- Do not log bodies, storage keys, checksums, paths, or unnormalized filenames.
- Use random object keys and create-only writes.
- Verify downloaded bytes against size and SHA-256 metadata.
- Document that these controls do not replace malware scanning, quarantine, authentication, or secure
  internet deployment controls.

The current local actor model remains a reference-app limitation. Attachment authorization is correct
within that model but does not make the application suitable for untrusted public upload.

## Accessibility And Responsive Design

- The hidden file input remains associated with the visible `Add files` control.
- Accepted type/size guidance is available before selection.
- Queue progress uses native progress semantics and adjacent text.
- Success and failure state does not rely on color alone.
- Row actions are keyboard reachable with visible focus.
- Download and Remove include the filename in accessible names when repeated.
- Removal confirmation identifies the exact file.
- Status changes use the established live-region/status pattern without announcing every progress tick.
- Long Unicode filenames wrap and remain available through visible text/title as appropriate.
- Mobile rows stack metadata and actions without horizontal scrolling.
- Controls retain usable target sizes at 200 percent zoom.

## Testing Strategy

### Contract Tests

Cover:

- attachment DTO and list envelope examples;
- policy DTO shape and categories;
- new activity event values;
- no binary/storage/checksum fields in JSON contracts.

### Policy Unit Tests

Cover:

- every accepted extension/media/content combination;
- uppercase extensions and normalized canonical output;
- empty, overlong, path-like, control-character, and malformed encoded names;
- duplicate filenames remaining valid;
- zero-byte and over-limit files;
- media/extension mismatch;
- signature mismatch;
- invalid UTF-8, NUL text, and invalid JSON;
- valid and malformed Open XML package markers;
- `application/octet-stream`, SVG, HTML, ZIP, executable, audio, and video rejection;
- exact boundary values for filename and byte limits.

### Storage Adapter Tests

Local adapter tests cover:

- initialization and restart persistence;
- create/read/remove round trip;
- copied byte semantics;
- create-only collision behavior;
- temporary-file cleanup after failure;
- missing read/remove behavior;
- invalid key and traversal rejection;
- regular-file and maximum-size enforcement;
- isolated temporary root cleanup.

In-memory adapter tests cover deterministic put/get/remove failures and copied values.

### Repository Tests

With PostgreSQL, cover:

- create and find;
- newest-first deterministic list;
- exact count and aggregate usage;
- duplicate filenames;
- unique storage keys;
- constraints and foreign keys;
- row lock methods;
- delete without activity cascade effects.

### Service Tests

Cover list visibility/capabilities for owner, maintainer, uploader, other contributor, and archived project.

Upload tests cover:

- successful object, metadata, and activity creation;
- no work-item timestamp change;
- no notifications;
- preliminary and locked authorization failures;
- archived project;
- object write failure;
- metadata/activity failure with successful compensation;
- compensation failure logging;
- count and aggregate boundaries;
- two concurrent uploads where only one fits remaining capacity;
- same filename creates independent attachments;
- checksum and size describe accepted bytes.

Download tests cover:

- active and archived access;
- cross-workspace concealment before object read;
- exact bytes and metadata;
- missing object, size mismatch, checksum mismatch, and object-store failure.

Removal tests cover:

- uploader, owner, and maintainer success;
- contributor ownership denial;
- archived project conflict;
- storage failure leaves metadata/activity unchanged;
- missing object repairs metadata and records activity;
- concurrent removal commits one event;
- commit failure produces a repairable stale row;
- removed attachment context remains in activity.

### Endpoint And Adapter Tests

Cover:

- list JSON response;
- raw binary upload and required headers;
- malformed encoded filename;
- wrong content type;
- exact 4 MiB acceptance and over-limit 413 JSON response;
- binary download body and every defensive header;
- 204 response with no serialized JSON;
- AppBinaryBody Express conversion;
- no path/key/checksum leakage in success or errors.

### Runtime Tests

Cover:

- local driver default;
- invalid driver;
- development default path;
- explicit development path;
- production missing/relative path;
- production absolute path;
- startup initialization failure formatting.

### Angular API Tests

Cover:

- list endpoint;
- upload transport content type and encoded metadata headers;
- canonical media fallback for empty `File.type`;
- upload event/progress observation;
- Blob download response;
- delete endpoint.

### Angular Component Tests

Cover:

- loading, empty, error, and retry states;
- policy-derived input accept/guidance;
- valid multi-file selection and sequential requests;
- mixed client/server partial failures;
- determinate and indeterminate progress;
- retry retaining only failed file state;
- list/usage update after upload and removal;
- download helper invocation and error state;
- role/uploader/archived capability rendering;
- removal confirmation and duplicate-submit prevention;
- route id change clears old state and ignores stale responses;
- long filename/mobile composition semantics.

### Browser Tests

Add focused browser coverage for:

1. seeded attachment metadata and download;
2. contributor upload with progress/completion state;
3. multi-file partial failure;
4. uploader removal and retained activity;
5. maintainer removal of another uploader's file;
6. other-contributor removal control absence;
7. archived project list/download with no mutation controls;
8. relationship/hierarchy navigation changing attachment lists in place;
9. desktop and mobile screenshots with a long filename.

Browser fixtures write only to an isolated configured test storage root and clean it after the suite.

### Full Verification

Run:

```text
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Also verify:

- clean storage/database reset, migrate, and seed;
- repeated seed idempotency;
- production preview with explicit storage path;
- API restart persistence;
- no generated storage files tracked by Git;
- no component-style or initial-bundle budget warnings.

## Deployment And Operations

The v0.2.7 local driver is suitable for one Node process with persistent local disk and operator-managed
backup. It is not suitable for:

- horizontally scaled API instances without a shared filesystem;
- ephemeral Lambda filesystems;
- untrusted internet uploads without scanning/quarantine;
- durable hosted operation without volume backup and monitoring.

Production preview requires an explicit mounted/persistent directory and should back up PostgreSQL
metadata and object bytes as one operational set. Restoring only one side can produce missing objects or
orphaned files.

The eventual cloud design should add:

- S3 bucket, encryption, lifecycle, access logging, and least-privilege IAM via CDK;
- an S3 object-store adapter for server-side operations;
- presigned or otherwise direct bounded transfer where function limits require it;
- explicit upload readiness and deletion state;
- object scanning/quarantine before user-visible readiness;
- reconciliation and metrics for metadata/object divergence.

Those additions should preserve attachment ids, metadata DTOs, permission rules, activity semantics, and
Angular list composition. Transfer contracts may evolve.

## Documentation And Public Site

Finalization updates:

- README capabilities and limitations;
- local setup and environment variable examples;
- storage reset, persistence, backup, and production preview notes;
- OpenAPI routes and binary examples;
- public product site capability copy and feature inventory;
- release notes and screenshots where appropriate;
- destination-neutral pattern notes for bounded binary transfer, metadata/object consistency, and
  runtime storage adapters.

The site may say Worktrail supports bounded work item attachments. It must not imply S3 deployment,
malware scanning, previews, or production-ready public upload.

## Delivery Sequence Guidance

The implementation plan should preserve these dependencies:

1. contracts, policy vocabulary, and errors;
2. schema/migration and repository methods;
3. object-store port, local adapter, and runtime configuration;
4. service list/upload/download/remove consistency;
5. endpoint binary/raw-body adaptation and OpenAPI;
6. Angular API and extracted attachment component;
7. detail/activity integration and route-id behavior;
8. seed/reset and documentation;
9. browser/full verification and release finalization.

Do not begin UI upload behavior before the server policy and binary request contract are stable. Do not
seed metadata before object-store reset/idempotency behavior is defined.

## Risks And Mitigations

### Local Storage Is Treated As Cloud-Ready

Risk: an operator deploys multiple or ephemeral API instances and loses or inconsistently serves files.

Mitigation: require explicit production path, fail startup on invalid storage, document single-node
limits, and do not provide misleading cloud configuration.

### Raw Upload Buffer Consumes Too Much Memory

Risk: concurrent uploads multiply bounded per-request memory.

Mitigation: enforce 4 MiB in `express.raw`, upload sequentially in the first-party client, reject larger
requests before service execution, and revisit streaming before any limit increase.

### Declared Type Is Trusted Too Much

Risk: a renamed active or executable file passes extension/media checks.

Mitigation: require extension, declared media, and content signature/structure agreement; force download;
reject active types; state clearly that this is not malware scanning.

### Object Write Succeeds But Metadata Fails

Risk: storage accumulates inaccessible objects.

Mitigation: create metadata only after immutable object success, compensate on transaction failure, log
failed compensation safely, and defer a reconciliation job until operational need exists.

### Object Delete Succeeds But Commit Fails

Risk: metadata points at a missing object.

Mitigation: download returns a controlled error; authorized removal accepts missing object as repair and
commits one removal event; future remote storage should use deletion state/outbox.

### Project Archive Races With Upload Or Removal

Risk: a mutation commits after project archival.

Mitigation: lock project `FOR SHARE`, recheck active state in the transaction, and rely on archive's row
update conflict before committing metadata/activity.

### Concurrent Uploads Exceed Quota

Risk: both requests observe stale count/bytes.

Mitigation: serialize quota checks with a work-item `FOR UPDATE` lock and prove the losing path in a real
PostgreSQL concurrency test.

### Route Navigation Shows Previous Attachments

Risk: detail route reuse leaves prior item rows or accepts a late response.

Mitigation: key attachment state by work item id, cancel/switch list reads, reset queue state, and reject
late mutations from prior route generations.

### Seed Metadata And Objects Diverge

Risk: a fresh demo shows rows that cannot download or stale bytes after repeated seed.

Mitigation: derive checksums from seed bytes, make seed object writes idempotent, and verify clean and
repeated seed flows.

### Attachment Section Overloads Detail

Risk: another workflow obscures comments and core work item context.

Mitigation: extract and independently load a compact list, use one primary add action, omit previews/drop
zones, and browser-test laptop/mobile layouts.

### Dependency Added Only For Office Inspection

Risk: ZIP parsing increases supply-chain and malformed-input surface.

Mitigation: use `yauzl` only for lazy central-directory enumeration under strict limits, never extract or
inflate arbitrary content, pin it through the lockfile, and cover malformed packages and excessive entry
counts.

## Deferred

- S3 adapter, bucket, IAM, encryption, and CDK resources.
- Presigned/direct upload and download.
- Multipart, chunked, resumable, and large-file transfer.
- Streams and byte-range responses.
- Upload idempotency keys.
- Malware scanning, quarantine, and readiness states.
- File previews, thumbnails, and inline rendering.
- Attachment notifications and watcher settings.
- Attachments on comments, reports, projects, milestones, or cycles.
- Attachment counts on boards/lists and attachment filters/search.
- File versioning, replacement, folders, and document collaboration.
- Workspace quotas, retention, legal hold, and usage billing.
- Background deletion, transactional outbox, and reconciliation jobs.
- Public links and guest access.
- Cloud-hosted multi-instance deployment.

## Open Questions

No product or technical decisions block implementation planning.
