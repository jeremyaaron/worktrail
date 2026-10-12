# Worktrail v0.2.9 Technical Design

## Status

Implementation in progress. Phases 0-3 completed on October 11, 2026. Persistence, format-aware reads,
and work-item description writes, locking, no-ops, and activity are implemented. Comment writes,
CSV format support, and UI integration remain pending. See the
[implementation plan](implementation-plan.md) for evidence.

## Summary

v0.2.9 adds structured work-item descriptions and comments while retaining plain-text compatibility.
The approved scope is defined in [the PRD](prd.md).

The implementation will:

- persist `descriptionFormat` and `bodyFormat` alongside the existing source strings;
- support `plain_text` and `markdown_v1`, with plain-text database and omitted-create defaults;
- preserve stored format when an update omits it;
- normalize new or changed source line endings without trimming indentation or prose;
- limit new or changed source to 10,000 UTF-16 code units while preserving unchanged legacy content;
- parse Markdown with `markdown-it` and project its tokens into a finite presentation tree;
- render that tree with static Angular templates, text interpolation, and validated URL bindings;
- use no generated HTML insertion, security bypass, HTML sanitizer dependency, or runtime template
  compilation;
- share one content viewer and one textarea-based editor across descriptions, comments, and preview;
- offer formatting actions and a small inline link form without introducing Material components;
- retain explicit mention records, archived rules, source-text search, exports, and snapshots;
- add optional format metadata and whitespace-preserving descriptions to CSV import;
- treat source-and-format no-ops as unchanged records rather than new activity;
- keep content code behind the existing lazy create/detail routes.

No new endpoint, runtime service, environment variable, cloud resource, or background job is needed.

## Resolved Decisions

### Store Source And Format Separately

Keep the existing `description` and `body` string fields. Add adjacent format fields rather than
replacing strings with an editor document object.

This preserves existing consumers, keeps PostgreSQL search on authoritative source, and makes format
conversion an explicit data change. HTML, parsed tokens, and presentation trees remain transient.

### Use A Versioned Markdown Profile

Use exactly two identifiers:

```ts
type AuthoredContentFormat = 'plain_text' | 'markdown_v1';
```

`markdown_v1` identifies Worktrail's supported behavior, not a particular parser release. Dependency
patches must pass profile fixtures; deliberately changing interpretation requires a compatibility
decision rather than silently changing existing content.

### Parse With markdown-it

Use `markdown-it` as a web-only dependency, initially pinned to `15.0.2`. The current package provides
ES module exports and its own TypeScript declarations, so no Angular wrapper or `@types` package is
needed. Its public parser API exposes tokens and configurable rules. [Package exports](https://github.com/markdown-it/markdown-it/blob/15.0.2/package.json),
[parser API](https://github.com/markdown-it/markdown-it/blob/15.0.2/src/markdownit.ts).

Use the CommonMark preset with explicit overrides and a narrow token projection. Do not install
plugins, syntax highlighting, link preview code, or an editor framework. Recheck dependency audit and
Angular production build compatibility when the dependency is introduced.

### Render A Typed Tree Rather Than HTML

Call the parser's token API, not `render()`. Translate supported tokens into application-owned nodes
and render those nodes through static Angular templates.

The presentation tree is the allowlist. It has no arbitrary element name, attribute map, HTML string,
style, class, or event handler. Text always uses interpolation. Links alone receive a validated URL
through normal Angular binding. This follows Angular's guidance to prefer templates and escaped text
over direct DOM insertion; no `bypassSecurityTrust*` call is required.
[Angular security guidance](https://angular.dev/best-practices/security).

This avoids maintaining a second HTML sanitizer policy and eliminates disagreement between parser
HTML, sanitizer output, and Angular's HTML handling. The small token adapter is a renderer boundary,
not a second Markdown parser.

### Use One Compound Form Control

The editor implements `ControlValueAccessor` for a UI-local value:

```ts
interface AuthoredContentValue {
  source: string;
  format: AuthoredContentFormat;
}
```

Source and format belong to one authoring interaction and should become dirty together. The API still
receives separate source/format fields. Parent forms own validation, submission, permissions, and
baseline values; the editor owns selection, formatting commands, preview, and its link insertion form.

### Use An Inline Link Form

Opening the link action captures the textarea selection and shows a small labeled URL input with
Insert and Cancel actions. The selected source is the link label; an empty selection gets a selected
placeholder label after insertion.

Use this instead of browser `prompt()` or another modal dependency. Escape cancels this local form
without dismissing the surrounding workflow. Focus returns to the textarea and the captured selection.

### Preserve Existing Detail Composition

The current detail page combines a read summary with an edit panel and collaboration sections. Replace
its source fields and comment body rendering without redesigning that whole page or adding a new
global edit mode.

New styles and rendering logic live in focused components. The summary stays first; formatting tools
stay inside existing authoring forms. Do not add controls to lists, boards, the project shell, or
Quick Find.

## Current Implementation Context

Relevant boundaries are:

- `packages/contracts/src/work-items.ts`: detail DTO, comment DTO, and create/update requests;
- `packages/contracts/src/csv.ts`: import preview and apply contracts;
- `apps/api/src/db/schema.ts`: Drizzle work-item and comment tables;
- `apps/api/src/repositories/work-item-repository.ts`: work-item writes and row-lock support;
- `apps/api/src/repositories/comment-repository.ts`: comment body updates and soft deletion;
- `apps/api/src/services/work-item-service.ts`: description writes and description activity;
- `apps/api/src/services/comment-service.ts`: comment permissions, writes, mentions, and notifications;
- `apps/api/src/services/dto.ts`: detail and comment projection, including deleted-body suppression;
- `apps/api/src/endpoints/work-items.ts` and `comments.ts`: currently trim source in Zod schemas;
- `apps/api/src/services/work-item-csv-import-service.ts`: currently trims descriptions through
  `optionalString`;
- `apps/api/src/services/csv/parse-csv-records.ts`: uses `csv-parse/sync` with parser-level trimming;
- `apps/web/src/app/features/work-items/work-item-create-page.component.ts`: description authoring;
- `apps/web/src/app/features/work-items/work-item-detail-page.component.ts`: description and comment
  forms, request builders, reset behavior, and route reuse;
- `apps/web/src/app/features/work-items/components/work-item-detail-summary.component.ts`: plain-text
  description display.

Work-item detail alone exposes `description`; paged list DTOs do not. Keep the new description format
on detail DTOs rather than adding source or format to every list row. Comment DTOs are also returned
through existing detail/comment reads, so both projection paths must agree.

Current comment edits always update timestamps and record `comment.edited`. Description activity
currently compares only the source string. Both require explicit pair-aware change handling.

## Shared Contracts

Add `packages/contracts/src/authored-content.ts` and export it through `index.ts`.

```ts
export const authoredContentFormats = ['plain_text', 'markdown_v1'] as const;
export type AuthoredContentFormat = (typeof authoredContentFormats)[number];
export const authoredContentSourceLimit = 10_000;

export function normalizeAuthoredContentSource(source: string): string {
  return source.replace(/\r\n?/g, '\n');
}
```

This is a small shared data policy, not a rendering package. It imports neither Angular nor the
Markdown parser. Services retain authorization, current-record comparisons, and error construction.

Extend contracts as follows:

| Contract | Addition | Required On Read Or Write |
| --- | --- | --- |
| `WorkItemDetailDto` | `descriptionFormat: AuthoredContentFormat` | Required response field |
| `CreateWorkItemRequest` | `descriptionFormat?: AuthoredContentFormat` | Optional request field |
| `UpdateWorkItemRequest` | `descriptionFormat?: AuthoredContentFormat` | Optional request field |
| `CommentDto` | `bodyFormat: AuthoredContentFormat` | Required response field |
| `CreateCommentRequest` | `bodyFormat?: AuthoredContentFormat` | Optional request field |
| `UpdateCommentRequest` | `bodyFormat?: AuthoredContentFormat` | Optional request field |
| `WorkItemCsvImportPreviewRowDto` | `descriptionFormat: AuthoredContentFormat` | Required response field |

Also add a bounded `descriptionExcerpt: string` to import preview rows. Return at most 240 UTF-16 code
units of normalized source, with a truncation indicator that does not split a surrogate pair. This is
escaped source for verification, not a rendered Markdown preview or a complete description response.

Keep `UpdateCommentRequest.body` required. A format-only comment conversion submits the unchanged body
plus the new format. Work-item PATCH may submit only `descriptionFormat`, applying it to current source.

Do not add format fields to unrelated project/milestone descriptions, notification DTOs, published
snapshots, or work-list query contracts.

### Omission Semantics

| Operation | Source Omitted | Format Omitted |
| --- | --- | --- |
| Work-item create | Empty description | `plain_text` |
| Work-item update | Keep current description | Keep current format |
| Comment create | Invalid; body required | `plain_text` |
| Comment update | Invalid; body required | Keep current format |
| CSV import | Empty description | `plain_text` for missing or blank column |

An explicit `null`, unknown value, or invalid type is not omission and fails validation. An explicit
format with an empty description is valid and remains persisted for subsequent edits.

New Angular create/comment forms send `markdown_v1` explicitly. Existing API clients remain valid,
but clients that intentionally treat changed text as plain must send `plain_text` when updating a
Markdown record. Omission never guesses a format from punctuation.

## Persistence And Migration

Add:

```sql
ALTER TABLE work_items
  ADD COLUMN description_format text NOT NULL DEFAULT 'plain_text';

ALTER TABLE work_items
  ADD CONSTRAINT work_items_description_format_check
  CHECK (description_format IN ('plain_text', 'markdown_v1'));

ALTER TABLE comments
  ADD COLUMN body_format text NOT NULL DEFAULT 'plain_text';

ALTER TABLE comments
  ADD CONSTRAINT comments_body_format_check
  CHECK (body_format IN ('plain_text', 'markdown_v1'));
```

Represent columns with Drizzle's typed text and check-constraint conventions. Generate the next
forward migration and metadata through the existing workflow; do not rename older migrations.

Migration requirements:

- Existing rows, including soft-deleted comments, acquire `plain_text` semantics.
- Do not rewrite source, normalize historical line endings, alter timestamps, or create activity.
- Do not add a source-length database constraint; it would invalidate grandfathered content.
- No indexes are needed for format because this release adds no format filters or search predicates.
- No report or closeout JSON migration is required.

The default supports older insert callers. Repository input types should allow database defaults
where existing fixtures omit the field, while production services resolve and supply format explicitly.

Deploy migration before the new API/frontend as one local release. This is backward-compatible schema
expansion, not a promise that an older frontend can faithfully edit newly authored Markdown. After
new content exists, roll back the application only with that presentation limitation understood;
do not drop columns and erase format identity as a rollback shortcut.

## Source Normalization And Validation

### Preserve Source Whitespace

For new and changed content, convert CRLF and lone CR to LF. Do not trim either end, collapse spaces,
modify indentation, or serialize parsed Markdown back to source. Both formats use the same policy.

Comments must contain at least one non-whitespace character. Use a separate check such as
`source.trim().length > 0`; never use its trimmed result as stored source. Empty descriptions are valid.

This deliberately changes the old trimming behavior for newly accepted plain-text content as well.
Previously stored strings remain untouched.

### Resolve Updates Against Current State

After authorization and inside the write transaction:

1. Read the current source and format under the record's write lock.
2. Resolve omitted format to the current value, not the database default.
3. Resolve omitted source to the current string.
4. Compare supplied source with current source after line-ending normalization only.
5. If those normalized strings match, preserve the exact stored string, including legacy CRLF.
6. If they differ, use the normalized incoming string as next source.
7. Treat the pair as changed if source meaning under that normalization or format differs.
8. Validate normalized length and non-whitespace requirements for a changed pair.
9. Persist a changed pair together, or leave it untouched when unchanged.

If neither content field is supplied, do not normalize or revalidate stored content. If unchanged
legacy source is resubmitted, return it unchanged even when its size exceeds the new limit. Converting
an oversized record requires shortening it to comply; conversion is not a grandfathering escape hatch.

The 10,000 limit applies to normalized source's JavaScript `length`, not bytes or Unicode code points.
Use the same calculation in API services, Angular validators, and CSV descriptions.

### Validation Placement

Place API pair-resolution helpers in `apps/api/src/domain/authored-content-policy.ts`, following the
existing domain policy modules. Use `resolveNewAuthoredContent` and `resolveUpdatedAuthoredContent`
to return `{ source, format, changed }`; a new pair has `changed: true`. Pass the source field name and
whether non-whitespace content is required so validation errors retain description/body context.
Keep authorization and locked-record acquisition in the calling services.

- Endpoint Zod schemas validate string/enum shape and field presence. Remove `.trim()` from source
  fields and do not put an unconditional update `.max(10_000)` ahead of current-record resolution.
- Domain service helpers enforce normalized length, non-whitespace comments, and legacy exceptions.
- Work-item creation through `createWorkItemWithRepositories` also enforces the policy so CSV cannot
  bypass validation by calling the service directly.
- API validation errors use existing `400 VALIDATION_ERROR` behavior with safe field/limit details;
  do not include submitted source in errors or logs.
- Angular mirrors validation against its loaded baseline but is not authoritative.
- Do not change global JSON, attachment, or CSV request-body limits in this sprint.

## Service And Repository Changes

### Work Items

Add `descriptionFormat` to creation and update persistence inputs. Detail mapping returns it with
source. Existing list mapping remains unchanged.

For content-bearing updates, reuse the repository's single-item use of
`findManyByIdsForUpdate([workItemId])` within the existing write transaction, then recheck workspace
ownership before resolving the pair. Do not calculate a next format from a stale pre-transaction read.
No browser revision token or merge algorithm is introduced; an explicit concurrent edit remains
last-writer-wins after serialized database writes.

When a complete PATCH would change no scalar field or attached label set, return current detail
without updating `updatedAt`, replacing labels, creating activity, or notifying anyone. Compare label
sets independently of order. A description no-op must not suppress a real assignee or other update.

Replace description's generic `recordFieldActivity` call with one focused pair-aware comparison:

- Continue using `work_item.description_changed`.
- Record one event when source, format, or both change.
- Include `{ description, descriptionFormat }` in previous/new values, following the existing
  description activity model.
- For format-only changes, use a clear summary such as `Description format changed.`
- Do not add another event type or a duplicate format event.
- Do not reinterpret older activity values that lack format metadata.

Description changes currently have no dedicated watcher-notification path. Keep that behavior;
assignment changes in the same request continue to use their existing notification policy.

### Comments

Add `bodyFormat` to create/update inputs. Rename repository `updateBody` to `updateContent` if useful
to make its source-plus-format atomicity clear; update its callers without a broader repository refactor.

Add a locked comment read for edit/delete and use it in their existing transactions. Recheck current
deletion state, workspace ownership, author/role permission, and project writability before applying
the change. This prevents a queued edit from treating a concurrently deleted comment as writable.

For an unchanged pair:

- Return the existing comment DTO.
- Preserve `updatedAt`, `editedAt`, and the existing `isEdited` state.
- Create no event and no notifications.

For a changed pair:

- Write body, format, `editedAt`, and `updatedAt` together.
- Record one `comment.edited` event.
- Retain the existing absence of full comment bodies in activity history.
- Add only previous/new format identifiers to event metadata when needed for conversion evidence.
- Do not replace mention rows or invoke creation-time notification delivery.

Creation still validates explicit `mentionMemberIds` and invokes the current mention/watcher
deduplication flow. Parser tokens never affect recipients.

Deleted comment DTOs continue to return an empty body. Return `bodyFormat: 'plain_text'` for the
tombstone presentation; the retained database format is not a path to recovering deleted source.
Both detail-embedded comments and the standalone comment list use the same mapper.

## Endpoint And OpenAPI Changes

Keep existing routes:

```text
POST  /api/projects/:projectId/work-items
PATCH /api/work-items/:workItemId
POST  /api/work-items/:workItemId/comments
PATCH /api/comments/:commentId
POST  /api/projects/:projectId/work-items/imports/preview
POST  /api/projects/:projectId/work-items/imports
```

No replacement route is introduced. Existing GET/detail/comment endpoints return the new format
fields.

Example create:

```json
{
  "title": "Verify deployment configuration",
  "type": "task",
  "priority": "medium",
  "description": "## Acceptance criteria\n\n- Preview starts successfully.\n- Health checks pass.",
  "descriptionFormat": "markdown_v1"
}
```

Example comment conversion:

```json
{
  "body": "Review **before** publishing.",
  "bodyFormat": "markdown_v1"
}
```

Update the existing OpenAPI document with:

- a reusable format enum schema;
- optional request and required response properties;
- create defaults versus update omission semantics;
- normalized length rules and unchanged legacy exceptions in prose;
- whitespace-preserving examples, format-only updates, and invalid-format errors;
- CSV optional format metadata and bounded escaped preview excerpts.

Do not use a universal response `maxLength` that falsely rejects oversized historical records. Do not
claim preview rendering is a server operation. Express remains an adapter to existing endpoint handlers.

## Markdown Profile And Token Projection

### Parser Configuration

Create one module-local parser with fixed configuration. Do not mutate parser options per record or
register caller-supplied plugins.

```ts
const parser = new MarkdownIt('commonmark', {
  html: false,
  breaks: true,
  linkify: false,
  typographer: false,
  maxNesting: 16
});

parser.disable(['hr']);
```

The CommonMark preset includes HTML support unless explicitly overridden; `html: false` is mandatory.
Its rule set includes headings, lists, code, links, and image tokens, but not the default preset's
table/strikethrough extensions. [Pinned preset source](https://github.com/markdown-it/markdown-it/blob/15.0.2/src/presets/commonmark.ts).

Use `parser.parse(source, freshEnvironment)` to obtain tokens. Keep parser reference/link environment
local to that one parse. Replace link validation with the narrow URL policy below and validate again
when creating a presentation link node.

### Supported Presentation Nodes

Use separate block and inline unions in `shared/authored-content/authored-content-document.ts`.

Block kinds:

- paragraph containing inline nodes;
- heading containing inline nodes and a bounded numeric level;
- quotation containing block nodes;
- unordered or ordered list containing list items and a validated ordered-list start;
- list item containing block nodes;
- code block containing literal text.

Inline kinds:

- text;
- line break;
- emphasis;
- strong emphasis;
- inline code;
- link containing validated URL and inline label nodes.

Do not create a generic `{ tag, attributes, children }` node. The Angular templates contain explicit
cases for every allowed kind. Unexpected tokens or malformed nesting produce whole-source plain-text
fallback, not partial rendering that might hide important content.

Projection rules:

- Map `softbreak` and `hardbreak` to visible line breaks.
- Honor tight-list paragraph suppression without introducing invalid `<p>` nesting.
- Support ATX and Setext headings, fenced code, and indented code through the same allowed nodes.
- Map source heading levels to `h3` through `h6`, clamping deeper levels. Provide a Description `h2`
  in summary presentation; comment headings remain subordinate to the existing Comments `h2`.
- Ignore fence language info rather than turning it into a CSS class or HTML.
- Convert an image token to plain alternative text by flattening its label children to text; use
  literal `Image` if empty. Discard its destination, title, and attributes.
- Leave raw HTML as parser-produced literal text with HTML parsing disabled.
- Leave unsupported table, task-list, and strikethrough syntax readable without active controls.
- Preserve link-label emphasis, but never create nested anchors.
- Discard arbitrary token attributes; only validated href and ordered-list start enter the tree.

The node tree exists only in the Angular feature. It is not a public API contract or a new persisted
content model.

### Safe URL Policy

Implement `authored-content-link.ts` once for token projection and link insertion:

1. Reject control characters, backslashes, and values longer than 2,048 UTF-16 code units.
2. Require an explicit case-insensitive `http://` or `https://` prefix.
3. Parse with `new URL(value)` without a base URL.
4. Require `http:` or `https:`, a nonempty host, and no embedded username/password.
5. Return the serialized URL as ordinary data, never `SafeUrl`.

Use parser-normalized destinations for projection so entity/escape handling cannot be bypassed by
validating an unrelated raw string. Do not repeatedly percent-decode a URL or repair an unsafe scheme
into an accepted one. Test obfuscated schemes, controls, malformed authorities, and encoded input.

Relative, fragment-only, protocol-relative, `mailto:`, `data:`, `file:`, and script URLs remain unlinked
text in this first profile. For rejected parser links, literal syntax is an acceptable readable result;
for rejected projected links, retain the label without an anchor.

Render valid same-origin URLs as ordinary same-tab anchors. Render external URLs with `target="_blank"`.
All generated anchors have application-owned `rel="noopener noreferrer"` and a no-referrer policy.
Use no router interception, prefetch, metadata lookup, tracking redirect, or privileged API invocation.
Native keyboard activation and modified-click behavior remain available.

This is not destination reputation checking: a valid HTTP(S) link can still lead to an untrusted site.
Reading the record never follows it automatically.

### Rendering Bounds And Fallback

Apply these fixed presentation limits independently of API write validation:

- Normalize line endings for parsing only; skip Markdown parsing above 10,000 UTF-16 code units.
- Set parser `maxNesting` to 16.
- Inspect at most 8,000 tokens, including inline children, during projection.
- Build at most 4,000 presentation nodes with a maximum tree depth of 32.
- Bound aggregate projected text and URL data to 64,000 UTF-16 code units.

Exceeding a projection limit, encountering an unexpected structure, or catching a parser error returns
`{ kind: 'plain_text_fallback', source }`. Render the complete escaped source with wrapping. Do not
truncate it, partially save it, or silently discard blocks. Unknown formats use the same safe path.

Parser nesting limits may cause excessively nested syntax to remain literal. That is acceptable and
must not alter stored source. Projection limits run after parsing; they are not a timeout mechanism.
Input size, parser configuration, and adversarial timing evidence govern parser cost.

For very large legacy plain text, keep a single wrapped text surface rather than generating thousands
of block nodes. No parser runs for plain text. Existing unbounded legacy reads and comment collection
size remain residual limits, not claims of infinite-scale rendering.

## Angular Component Design

Place focused implementation under:

```text
apps/web/src/app/shared/authored-content/
  authored-content-value.ts
  authored-content-document.ts
  authored-content-parser.ts
  authored-content-link.ts
  authored-content-validation.ts
  authored-content-edit-commands.ts
  authored-content-viewer.component.ts
  authored-content-viewer.component.html
  authored-content-viewer.component.scss
  authored-content-editor.component.ts
  authored-content-editor.component.html
  authored-content-editor.component.scss
```

Colocate focused tests. Avoid a barrel imported by the root shell or general display helpers.

### Content Viewer

`AuthoredContentViewerComponent` accepts `source` and `format`. It computes the presentation only when
those inputs change and uses OnPush change detection.

- Plain text uses text interpolation with `white-space: pre-wrap` and `overflow-wrap: anywhere`.
- Markdown uses the pure parser/projection function and static recursive templates for block/inline
  nodes. Do not create one component instance per character or token.
- Use component-owned styles for paragraphs, lists, quotations, headings, and code.
- Code blocks have bounded width, `overflow-x: auto`, and an accessible keyboard focus target only
  when their scroll region needs it.
- No `innerHTML`, `outerHTML`, dynamic tag construction, DOM parser insertion, or security bypass is
  allowed in this feature.
- Fallback renders source safely in the same content region; do not replace the whole page with an
  error or add source-bearing diagnostics.
- Empty-state copy belongs to the parent, not a universal renderer.

Recursive Angular templates are a bounded rendering technique, not a custom component registration
system. Use exhaustive TypeScript switches in the projection and finite template cases in the viewer.

### Content Editor

`AuthoredContentEditorComponent` is a standalone CVA with inputs for stable field id, label, row count,
error description ids, and editor reset identity.

Behavior:

- `writeValue` sets source/format without emitting a change; never infer format from source.
- `registerOnChange` receives both fields when source or format changes.
- `registerOnTouched` is triggered when focus leaves the whole editor, not on every toolbar click.
- `setDisabledState` disables textarea, format selection, formatting actions, and link insertion.
- Parent controls supply validation and safe server error feedback.
- Edit/Preview uses a labeled segmented choice; switching only changes local presentation.
- Preview mounts the same viewer as persisted content. Do not parse on every keystroke while Edit is
  selected; parse when Preview is entered or its visible inputs change.
- The format selector has Plain text and Markdown options. Plain text hides Markdown-only tools.
- Switching format changes only the pair's format. Preview is available before committing conversion.
- Show the normalized source count near validation, without a permanent syntax tutorial.
- Do not set unconditional native `maxlength` on legacy edit controls: it would prevent safe handling
  of oversized existing records. Parent validation enforces changed-content limits.
- A reset identity change closes Preview/link insertion and discards selection snapshots even if the
  next source happens to be identical.

New controls default to `{ source: '', format: 'markdown_v1' }`. Existing edits use the exact loaded
source and format. Baseline-aware validators accept unchanged historical pairs, reject oversized
conversions/changes, and check non-whitespace source for comments.

### Formatting Commands

Keep source manipulation in pure functions returning `{ source, selectionStart, selectionEnd }`.
Use established parsing for Markdown itself; these functions only insert authoring syntax.

- Bold and italic wrap selected text, or insert a selected placeholder when empty.
- Heading inserts/replaces an ATX marker at selected line starts, using `##` as the default command.
- Bullet, ordered-list, and quote actions prefix selected lines; number ordered lines sequentially.
- Inline code chooses a backtick delimiter longer than any run in the selection and handles boundary
  spaces according to the profile's parser behavior.
- Code block uses a fence longer than existing backtick runs, with newlines at block boundaries.
- Link insertion escapes the selected label and uses a validated URL serialization that cannot break
  Markdown destination delimiters.
- Preserve all source outside the affected selection/lines, including leading and trailing whitespace.
- Capture selection before opening the link form; do not overwrite it with the URL input's selection.
- Use textarea selection/range APIs for editing only, never DOM HTML insertion or `execCommand`.
- Suppress command activation during IME composition and restore textarea focus after completion.
- Every toolbar control is `type="button"`, has a Lucide icon and accessible name, and uses the
  established tooltip convention.

At narrow widths, wrap the fixed-size icon buttons into a second row rather than add a new action menu.
Keep format selection and Edit/Preview controls in a stable responsive row. No new keyboard shortcut
map is introduced; native text editing and the existing Quick Find shortcut suppression remain intact.

Programmatic source edits must update Angular control state. Verify native typing undo behavior;
do not claim a custom cross-command undo history or introduce an editor engine in this release.

## Page Integration And Lifecycle

### Creation

Replace the description string control with `descriptionContent: FormControl<AuthoredContentValue>`.
Keep title/type/priority and all other fields unchanged.

Request builders map the pair to `description` and `descriptionFormat` without `.trim()`. Project and
child defaults do not copy or infer a parent description/format; they use the existing create defaults
and a new empty Markdown description. Failed creation retains both fields and pending-state handling.

### Work-Item Detail

The summary viewer consumes `item.description` and `item.descriptionFormat`. The edit form has its own
compound description control initialized from the loaded item. Do not derive form source from DOM.

When building a PATCH, omit both description fields if the pair matches its baseline. If source or
format changed, send the pair explicitly. Other submitted field behavior remains intact. The server
still handles old clients that resubmit unchanged strings.

Changing item/actor increments an editor/request generation and clears the prior form baseline. A
matching response applies only when generation, actor, and item still match. Apply the same guards
to comment create/edit callbacks that can otherwise reset a newer draft or trigger a wrong-item refresh.
Use existing subscriptions and reset hooks; do not create another global state store.

Unrelated attachment/activity refreshes must not reset active description or comment drafts. Existing
successful mutation refresh behavior stays explicit and tested. Archived state disables content
controls under the page's existing read-only rules.

### Comments

Use compound `bodyContent` controls for new and edited comments. Opening edit loads that comment's
source/format and sets a comment-specific reset identity. Only the currently edited comment has an
editor. Deleted rows branch to the existing tombstone before mounting a viewer or editor.

After successful creation, reset to empty Markdown and clear selected mentions under current behavior.
After a failed creation/edit, retain source, format, and selected mentions. Cancel closes edit and
restores the persisted viewer. Actor/item changes close local link insertion and clear all drafts.

Preserve author, timestamps, edited marker, delete confirmation, and independent mention chips. Do
not run member resolution or notification logic inside the shared editor.

## CSV Import Design

Add `description_format` to the import allowed-header list. Trim this metadata token and validate
against the shared format tuple. Missing or blank values resolve to `plain_text`; invalid values
produce row-specific preview errors and block apply under current all-or-nothing behavior.

Description handling requires two changes:

- Read the raw description cell directly rather than through the general `optionalString` trimmer.
- Extend `parseCsvRecords` with an opt-in whitespace-preserving option for this import. Disable parser
  trimming for this mode; retain existing defaults for other callers. Explicit normalization of
  title, email, enum, label, and date fields remains in their existing service helpers.

Use the shared line-ending policy for description, then apply its normalized length limit. Keep the
existing 10,000 raw-cell limit for other fields, 1 MiB CSV limit, and 250-row limit. Quote multiline
descriptions using normal CSV rules; do not preprocess or split CSV with string operations.

Carry normalized source and format through `NormalizedImportRow` into
`createWorkItemWithRepositories`. Preview and apply both run the same validation pipeline. Preview
adds a compact format column and optional expandable escaped excerpt, not a Markdown viewer. Limit
excerpt rendering to the existing row set and avoid another permanent panel above the table.

Import still revalidates at apply time; this release adds neither preview tokens nor durable import
sessions. Preserve identity allocation, transactional apply, reporter handling, and existing warnings.

Project and workspace exports retain their exact current columns and limits. Do not add descriptions
or format columns to summary exports and do not claim that exported rows can be imported unchanged.

## Search, History, And Other Compatibility

- Keep description source in PostgreSQL search predicates and existing trigram indexes.
- Do not index rendered text, parse search results, or strip Markdown before matching.
- Quick Find excerpts remain bounded plain text and can show Markdown delimiters honestly.
- Lists, board cards, My Work, planning/review rows, and notifications retain their current projections.
- No format metadata is copied into published report or cycle closeout schemas.
- Report Markdown export remains its own existing renderer, not a consumer of work-item content code.
- No attachment byte, metadata, URL, or preview behavior changes.
- Existing route/query/saved-view contracts remain valid.
- Local actor headers remain the identity mechanism; formatting does not make the app internet-ready.

## Accessibility, Styling, And Load Behavior

- Use labeled textareas and format controls, accessible segmented modes, tooltip-named icon buttons,
  and inline errors connected with stable ids.
- Do not steal focus when Preview renders. Focus restoration after link insertion targets the source
  control and selection, not the parent form's submit button.
- Plain text and prose wrap within `min-width: 0` containers. Only code regions scroll horizontally.
- Keep headings compact, lists indented within the content width, and quotations distinguishable
  without relying on color alone.
- Test mobile at 390 px and 320 px, laptop/desktop, and 200 percent zoom. No toolbar, long URL, or code
  sample may create page-level horizontal overflow.
- Use separate component stylesheets and avoid adding the entire content style set to the large
  detail-page inline styles.
- Import viewer/editor from existing lazy create/detail routes. Do not expose parser imports through
  root providers, shell components, general display utilities, or list-query modules.
- Static route-level imports are sufficient initially; do not add per-comment network chunks or
  dynamic loading for each viewer.
- Keep current 550 kB initial warning / 1 MB error and 8 kB component-style warning / 12 kB error
  thresholds. Inspect build output to prove the parser is outside the initial shell graph.

## Security And Privacy

The safety boundary has several independent controls:

1. The API authorizes records and stores data, never trusted HTML.
2. The parser has HTML disabled and no extension/plugin registration.
3. Projection permits finite node kinds and selected validated scalar values only.
4. Static Angular templates escape all text and retain normal URL security checks.
5. Images, styles, HTML, scripts, arbitrary attributes, and remote resources have no representation.
6. Preview and saved content share this same path.

Do not use bypass APIs, a markdown pipe that returns `SafeHtml`, content-bearing exception messages,
or raw source logging. Operational diagnostics may identify a rendering failure category without
source, URL, title, or comment body. Do not add rendering analytics.

Browser tests must prove absence of unwanted DOM elements and unwanted network requests, not merely
absence of an `alert()`. Link safety does not imply malware scanning, safe external destinations, or
production authentication. Existing deployment limitations remain documented.

## Testing Strategy

Use `packages/contracts/src/authored-content.contract.test.ts` for the shared primitives and
`apps/api/tests/authored-content-policy.test.ts` for pair-resolution rules. Add PostgreSQL locking
coverage in `apps/api/tests/authored-content-concurrency.test.ts`, following the existing attachment
concurrency suite's temporary workspace and cleanup pattern. Extend existing work-item, comment,
activity, and CSV suites rather than duplicating their harnesses. Migration preservation fixtures
must originate before the format-column migration; they must not depend on the new seed state.

### Contracts And Migration

- Compile existing requests without formats and new explicit-format examples.
- Require response formats on detail/comments and preview metadata without growing list DTOs.
- Verify PostgreSQL defaults/checks and exact preservation of pre-migration source and timestamps.
- Cover both plain-text and Markdown records, oversized legacy content, and deleted comments.
- Ensure snapshot fixtures/schema versions remain unchanged.

### API And Services

- Test create defaults, omitted-update preservation, format-only updates, invalid/null formats, and
  atomic source-plus-format writes.
- Test normalization, whitespace retention, empty comments, exact normalized limits, surrogate pairs,
  oversized changes, unchanged grandfathered input, and unrelated updates.
- Verify full-request no-ops preserve timestamps/events and do not suppress real field changes.
- Verify one description event per pair change and comment conversion metadata without body history.
- Verify mention/watcher creation deduplication and no edit/conversion re-notification.
- Regress tenant isolation, inactive actors, comment modification roles, and archived rules.
- Exercise locked edit/delete behavior and current-state format resolution against PostgreSQL, not
  only in-memory fixtures.
- Test both comment DTO paths and deleted-body/format presentation.

### Parser And Viewer

- Fixture every supported syntax form, mixed/nested structures, visible line breaks, tight/loose
  lists, heading remapping, code delimiters, and image alternative text.
- Compare preview and persisted display from identical source/format inputs.
- Test raw HTML, SVG, iframes, handlers, styles, HTML entities, escaped delimiters, malformed fences,
  rejected link schemes, protocol-relative URLs, credentials, controls, and obfuscated input.
- Assert finite DOM elements, absence of images/active content, and no unsafe anchors.
- Test all projection bounds, unknown formats, parser exceptions, and complete-source fallback.
- Benchmark representative maximum-length prose plus nesting/delimiter/reference-heavy adversarial
  fixtures. Record parse/projection timing separately from Angular rendering.
- Target ordinary 10,000-unit content parsing/projection under 50 ms and the adversarial fixture set
  under 100 ms per case on the recorded local browser. These are local evidence targets, not a hard
  runtime timeout or flaky shared-runner timing assertion.

### Editor And Page Integration

- Test CVA write/change/touched/disabled behavior, preview-only changes, and baseline validators.
- Test each formatting command with empty/partial/multiline selections, embedded backticks, escaped
  link labels/destinations, leading spaces, and surrogate pairs.
- Verify toolbar actions cannot submit forms and preserve selection/focus.
- Verify IME handling, link cancellation, reset identity, and failed-submit draft retention.
- Test create/detail/comment mappings, explicit new defaults, preserved edit formats, and no `.trim()`
  source loss.
- Test actor/item changes and delayed mutation responses so old callbacks cannot reset new drafts.
- Test attachment/activity refreshes, deleted rows, archived controls, and explicit mention separation.

### CSV And Browser Coverage

- Import legacy files without a format column and new Markdown files with multiline code source.
- Test missing/blank/invalid format values, whitespace around metadata, raw-cell versus normalized
  source limits, quoted newlines/commas, preview excerpts, and apply revalidation.
- Assert export headers and existing export limits remain unchanged.
- Create, preview, save, reload, edit, and cancel formatted descriptions through global/project/child
  entry points.
- Convert existing plain text deliberately and verify cancellation does not persist conversion.
- Post/edit comments with explicit mentions and verify notification counts.
- Read archived formatted content and prove writes remain denied.
- Capture desktop/mobile/zoom layouts and verify keyboard focus and no page overflow.
- Intercept requests while opening/viewing malicious authored content and prove no third-party asset
  request occurs before deliberate link activation.
- Regress Quick Find, Files targeting, list/saved-query state, boards, reports, and cycle closeout.

Do not replace the existing suite with content-only tests. Final verification uses the repository's
lint, typecheck, unit/integration, production build, browser, dependency-audit, and diff checks.

## Seed And Documentation

Retain plain-text seed records as compatibility examples. Add a structured requirement description,
reproduction steps, a code-bearing comment, safe links, image/HTML literal examples, and formatted
archived context. Include a comment with explicit mentions to demonstrate that formatting and
recipients are separate. Preserve deterministic ids and repeatable seed behavior.

At release finalization update README, OpenAPI, CSV examples, release notes, public site copy and a
current detail screenshot. Document supported syntax, image-alt fallback, HTTP(S)-only links,
10,000-unit normalized input limits, unchanged legacy exceptions, and omitted-format behavior.

Record destination-neutral patterns for versioned authored source, presentation-tree allowlisting,
shared preview/read rendering, explicit identity metadata, and state-aware compatibility validation.
Do not advertise full CommonMark/GFM, interactive checklists, WYSIWYG editing, inline attachments, or
internet-safe hosted deployment.

## Delivery Sequence Guidance

The implementation plan should sequence work approximately as follows:

1. Lock contract/profile fixtures, dependency choice, and normalization/legacy rules.
2. Add format contracts, schema migration, repository fields, and DTO propagation.
3. Implement state-aware API/service writes, no-ops, activity, and mention compatibility.
4. Update CSV validation/apply/preview without changing summary exports.
5. Implement and adversarially test the token projection, URL policy, and Angular viewer.
6. Implement and test shared authoring, selection commands, preview, and link insertion.
7. Integrate creation/detail/comments and stale-response/draft lifecycle behavior.
8. Complete browser/security/accessibility/performance evidence and regressions.
9. Finalize documentation, public site, release metadata, and full verification.

These are design dependencies, not an executable phase checklist; the implementation plan will define
phase boundaries and exit evidence.

## Risks And Mitigations

### Projection Becomes A Second Parser

Keep grammar interpretation in `markdown-it`. Projection accepts parser tokens and maps finite nodes;
it must not reinterpret source with regex or implement a Markdown grammar. Fail safely on unsupported
token shapes and pin behavior with fixtures.

### Legacy Validation Is Applied Too Early

Keep state-independent shape checks at endpoints and pair-aware length checks after authorization in
services. Mirror baseline-aware rules in Angular and avoid unconditional textarea/update maximums.

### A Conversion Resets Recipients Or Creates Noise

Keep mentions in their existing table/picker flow, use one pair-aware activity event, and never invoke
comment creation notification logic from edit or format conversion.

### A Large Detail Component Grows Again

Move viewer/editor behavior and styles into focused shared components; add only page integration and
lifecycle guards to the detail page. Do not expand scope into a whole-page composition refactor.

### Rendering Bounds Hide Required Context

Fall back to complete escaped source instead of truncation or partial output. Keep that fallback
readable and prove bounds with adversarial fixtures before release.

### Old Clients And Rollbacks Misread Markdown

Keep API defaults explicit and schema additive, but document that older presentation clients may show
source syntax. Do not claim format-aware editing works in code that predates format fields.

## Deferred

- Rich-text engines, collaborative editing, autosave, revision history, and merge/conflict UI.
- Interactive checklists, tables, syntax highlighting, diagrams, and plugin registration.
- Relative/internal-link assistance, automatic display-key links, and inferred mentions.
- Project/milestone/report content formatting and immutable snapshot version changes.
- Inline images, attachment references/previews, file rendering, and content indexing.
- Rendered-text or comment search and full-fidelity formatted-content export.
- Comment pagination and general large-legacy-record read scalability.
- Production identity, hosted infrastructure, CSP deployment policy, and managed storage.

## Open Questions

No blocking decisions remain. Parser version, format identifiers, rendering approach, URL policy,
source limits, editor integration, CSV behavior, and legacy semantics are resolved above. Parser
installation, Angular integration, and bundle compatibility remain Phase 6 verification gates.
Implementation may
adjust internal file decomposition or presentation guardrail numbers only with recorded evidence and
without weakening source preservation, safety, or approved product scope.
