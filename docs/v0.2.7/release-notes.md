# Worktrail v0.2.7 Release Notes

## Summary

Worktrail v0.2.7 adds Files in Context: bounded attachments on work items. Project members can upload,
download, review, retry, and remove supporting files without moving evidence into a separate system.
The release keeps attachment metadata in PostgreSQL while isolating file bytes behind an object-store
port, with a safe local-filesystem implementation for the current deployment model.

This is an intentionally narrow attachment baseline. It emphasizes predictable limits, verified file
identity, exact downloads, explicit authorization, failure recovery, and operator-visible persistence.
It does not claim malware scanning, content preview, text indexing, versioning, or production-ready
shared object storage.

## User-Facing Changes

- Added an independently loaded Files section to work-item detail.
- Added multi-file selection with sequential upload progress, per-file outcomes, retry, and queue
  removal.
- Added attachment metadata showing filename, media type, size, uploader, and upload time.
- Added remaining per-work-item file-count and byte capacity before upload.
- Added exact authenticated downloads with safe attachment disposition and original filenames.
- Added authorized attachment removal with confirmation and activity-history retention.
- Preserved attachment access on archived work items while preventing new uploads there.
- Added deterministic seeded Markdown and JSON attachments to `WT-3` for local evaluation.

## Attachment Policy

- Accepted types are PNG, JPEG, GIF, WebP, PDF, plain text, Markdown, CSV, JSON, DOCX, XLSX, and PPTX.
- Each file is limited to 4 MiB.
- Each work item is limited to 20 active attachments and 50 MiB of aggregate attachment bytes.
- Filenames are normalized, must remain meaningful, and are limited to 180 Unicode code points.
- Extension, declared media type, file signature, and bounded ZIP container evidence must agree.
- An unsupported or invalid file is rejected without consuming attachment capacity.

## Product Semantics

- Active workspace members may read attachments they are authorized to read through the work item.
- Active project members may upload to an active work item in an active project.
- The uploader, project owner, and project maintainers may remove an attachment.
- Attachment metadata is loaded separately from the primary work-item detail response and list
  projections.
- Upload and removal create activity events. Attachment operations do not change the work item's
  `updatedAt`, create notifications, or alter list ordering.
- Removing an attachment deletes the active metadata and file bytes but retains the historical
  activity event.
- Files remain downloadable from archived work items; archived projects and work items reject uploads.

## Technical Changes

- Added `work_item_attachments` through migration `0017_safe_pandemic.sql`, including bounded metadata
  constraints, deterministic ordering, unique opaque storage keys, and attachment activity types.
- Added explicit list, upload, download, and remove API contracts and OpenAPI documentation.
- Added a bounded raw-binary upload route rather than multipart parsing for the current one-file request
  contract.
- Added an `AttachmentObjectStore` port with local-filesystem and in-memory implementations.
- Added extension, media-type, signature, checksum, and bounded Office ZIP validation.
- Added object-first upload with database compensation, and metadata-first removal with restoration
  compensation when file deletion fails.
- Added per-work-item mutation coordination so concurrent uploads cannot bypass count or aggregate-byte
  limits.
- Added download-time checksum and byte-size integrity checks before returning file content.
- Added runtime storage configuration, storage-root ownership markers, and guarded reset behavior.
- Added deterministic, idempotent attachment seeding that repairs missing or altered seed objects.
- Added isolated temporary attachment storage for browser tests and cleanup at global teardown.
- Added lazy web loading for the Files section so attachment behavior does not increase the initial
  work-item detail route bundle unnecessarily.

## Operator Notes

Development defaults to `.worktrail/attachments` in the repository. Production mode requires an
absolute `WORKTRAIL_ATTACHMENT_STORAGE_PATH` in addition to `DATABASE_URL`. The configured directory
must be writable by the API process.

PostgreSQL metadata and attachment bytes form one logical backup unit. Back up and restore both from a
coordinated maintenance window; restoring only one side can leave missing objects or unreferenced
files. The reset command removes only storage roots carrying Worktrail's ownership marker.

The local driver is intended for one API process with durable local storage. It is not suitable for
ephemeral instances, horizontal API scaling, or independent serverless functions. A shared managed
object-store adapter remains future work.

## Compatibility Notes

- Migration `0017_safe_pandemic.sql` is required.
- Existing work-item URLs and primary work-item response shapes remain valid.
- The attachment routes and contracts are additive.
- Existing installations must configure and back up attachment storage before accepting uploads.
- All workspace package versions are `0.2.7`.

## Verification

Phase-level implementation and verification evidence is recorded in
`docs/v0.2.7/implementation-plan.md`.

Recommended release checks:

```sh
npm install --package-lock-only
npm run db:reset
npm run db:migrate
npm run db:seed
npm run db:seed
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
npm audit --omit=dev --audit-level=low
git diff --check
```

## Residual Risks And Deferred Work

- Authentication remains represented by local actor headers and the top-bar actor selector.
- File content is not scanned for malware, converted, previewed, indexed, or rendered inline.
- Attachment versions, comments, report embedding, bulk download, export inclusion, and content search
  remain outside this release.
- The local-filesystem store does not provide shared durability, object versioning, lifecycle policies,
  or multi-instance coordination.
- Database and object-store operations cannot share one atomic transaction; compensating actions reduce
  inconsistency but cannot eliminate every process-crash window.
- Hosted infrastructure, managed identity, managed object storage, metrics, tracing, and internet-safe
  deployment remain outside this release.
