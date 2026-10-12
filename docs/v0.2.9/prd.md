# Worktrail v0.2.9 PRD

## Status

Approved for implementation. Phase 0 completed on October 11, 2026.

## Summary

Worktrail v0.2.9 should add **Readable Work: Structured Descriptions and Discussion**.

Worktrail can organize, plan, find, and review work, and it now retains supporting files alongside
that work. The next improvement should make the explanation inside a work item as useful as its
surrounding structure. Descriptions and comments currently use plain text, rendered as interpolated
paragraphs. Acceptance criteria, reproduction steps, technical examples, and decisions are difficult
to scan, and authors cannot distinguish prose from code or present descriptive links reliably.

This release should introduce a small, explicit Markdown profile for work-item descriptions and
comments, supported by a shared source editor, formatting actions, and a faithful preview. Existing
content should remain plain text unless a user deliberately changes its format. Saved source and a
format identifier should remain authoritative; rendered HTML should never become stored content.

The product theme is **Readable Work**. A contributor should be able to describe a task with headings
and lists, report a defect with reproduction steps and a code example, or leave a clear review comment
without turning Worktrail into a document editor. Readers should see that structure immediately on
work-item detail, including in archived projects.

This is a focused collaboration sprint, not a rich-text platform, checklist workflow, attachment
preview system, report-format migration, or cloud deployment release.

## Release Thesis

Finding the right work item should lead to context that is easy to understand and act on.

The release succeeds when a user can:

1. write a structured description or comment without memorizing formatting syntax;
2. preview the result before saving;
3. read steps, requirements, code, and links in a clear hierarchy;
4. edit the original source without losing whitespace or formatting;
5. trust that existing text, permissions, mentions, and historical records have not changed meaning.

## Context

Worktrail currently provides:

- read-first work-item detail with explicit editing;
- global creation, project creation, and child-work creation;
- comments with editing, deletion, explicit member mentions, and watcher notifications;
- durable activity, dependency relationships, parent/child context, and attachments;
- project and workspace work lists with canonical filters, saved views, and pagination;
- Quick Find across work items, projects, milestones, cycles, reports, and attachment filenames;
- live planning and review, immutable published status reports, and cycle closeout snapshots;
- CSV import with descriptions, and summary-oriented CSV exports without descriptions;
- workspace authorization and archived-project read-only rules;
- an Angular SPA, PostgreSQL persistence, and transport-neutral API handlers.

Work-item descriptions and comment bodies currently have no persisted format identifier. Existing
clients submit strings, endpoints trim them, and detail rendering treats them as plain text. A
universal switch to Markdown would reinterpret existing punctuation, indentation, angle brackets,
and link-like text. The release must introduce formatting without making that silent change.

## Problem

### Important context has little visual structure

A description may contain the objective, acceptance criteria, and implementation notes, but readers
must infer those sections from an undifferentiated paragraph. Comments have the same limitation for
review findings and decisions.

### Technical examples lose clarity

Commands, paths, JSON, and error messages need code treatment that preserves spacing and keeps syntax
separate from surrounding prose. Files can hold long evidence, but a short example should not require
an attachment.

### Authors cannot verify presentation before saving

The current textareas provide no formatting actions or preview. Merely adding a Markdown parser
would move the burden onto users and make edit/save cycles necessary to discover the result.

### Formatting introduces trust and compatibility risks

Unsafe links, raw HTML, remote images, and embedded content would create new execution or privacy
paths. Reinterpreting old content or storing rendered HTML would make compatibility and future
renderer changes harder to control.

## Why This Sprint

Readable work context complements the last two releases directly. Attachments retain evidence and
Quick Find reaches it; structured descriptions and discussion explain what that evidence means.

This has broad daily utility without adding another operating center or planning concept. It also
exercises a useful application boundary: versioned user-authored source, safe presentation, and
backward-compatible editing. A WYSIWYG editor, file preview pipeline, or full document system would
consume more effort and introduce additional models before this basic workflow is established.

## Goals

### Product Goals

- Make work-item descriptions and comments easier to scan and understand.
- Support headings, lists, emphasis, quotations, code, and descriptive links.
- Offer discoverable formatting actions and a preview that matches saved rendering.
- Preserve existing plain text and make format conversion deliberate and reversible before save.
- Keep authoring efficient on desktop and usable on mobile and with a keyboard.
- Preserve explicit mention selection and existing collaboration permissions.
- Keep the work item read-first rather than expanding permanent editing controls.

### Architecture And Reference Goals

- Persist source and an explicit, versioned format rather than HTML or editor-specific documents.
- Establish one focused rendering policy shared by preview and saved content.
- Use a proven parser instead of implementing Markdown with regular expressions.
- Bound new source input and exercise pathological rendering cases.
- Preserve API adapter separation, local setup, and eventual static frontend deployment.
- Keep rendering dependencies away from the initial shell and unrelated routes where practical.
- Document reusable patterns without committing them to a particular framework or destination.

## Non-Goals

v0.2.9 will not add:

- WYSIWYG, `contenteditable`, collaborative editing, or editor-specific JSON documents;
- project, milestone, cycle, or status-report narrative formatting;
- migration or reinterpretation of published reports or cycle closeout snapshots;
- interactive checklists, checkbox persistence, progress rollups, or acceptance-criteria workflows;
- tables, diagrams, mathematical notation, custom extensions, or syntax highlighting;
- raw HTML, embedded iframes, inline images, remote image loading, or attachment embedding;
- attachment previews, file-content rendering, OCR, or content indexing;
- automatic work-item-key linking, member-name parsing, or inferred mention notifications;
- a new comment mention-editing policy, comment threads, reactions, or resolution workflows;
- full comment search or changes to Quick Find ranking and work-list search semantics;
- description columns in CSV export or a full-fidelity backup/import round trip;
- automatic saving, cross-device drafts, revision history, or concurrent edit merging;
- cloud infrastructure, production identity, new runtime services, or external rendering APIs;
- a generic rich-content framework spanning every text field in the product.

## Primary Users And Jobs

### Contributor

- Describe expected behavior and acceptance criteria as readable sections and lists.
- Report a defect with ordered reproduction steps and a short error or code example.
- Preview a comment before notifying colleagues.

### Maintainer

- Review requirements and discussion without deciphering a block of text.
- Edit a description while retaining its original source and selected format.
- Read historical discussion without changing its meaning or notification recipients.

### Workspace Owner

- Preserve existing records during an upgrade.
- Keep user-authored content within current authorization and lifecycle rules.
- Evaluate safe rendering without enabling arbitrary active content.

## Product Principles

- **Source is the record:** source text and format determine presentation; generated HTML is not data.
- **Existing text keeps its meaning:** punctuation in an old record is not consent to reinterpret it.
- **Preview is a promise:** preview and saved content use the same profile and security policy.
- **Formatting explains work:** it does not create status, assignment, progress, or notification rules.
- **No implicit remote content:** reading a description must not fetch an author's external assets.
- **Read first, edit deliberately:** formatting tools appear when authoring, not as permanent page noise.
- **Use one concrete profile:** a small predictable feature set is preferable to plugin extensibility.

## Scope

### 1. Explicit Content Formats

Add a format identifier alongside each work-item description and comment body.

Requirements:

- Support plain text and one versioned Markdown profile.
- Backfill all existing descriptions and comments as plain text without changing their source.
- Existing API create requests that omit format continue to create plain text.
- Existing API update requests that omit format preserve the current format.
- New Angular descriptions and comments default to the Markdown profile and submit it explicitly.
- Editing existing content starts in its persisted format; it must not silently convert on save.
- Changing format is an explicit authoring action and does not rewrite source.
- Preview allows the author to inspect a conversion before saving it.
- Source and format changes save atomically under existing write authorization.
- Unknown format values are rejected on writes. An unexpected read value must never enable permissive
  rendering; safe plain-text fallback is the defensive client behavior.
- Titles and other metadata remain plain text.

The technical design should settle public field names and storage details. Proposed identifiers are
`plain_text` and `markdown_v1`.

### 2. A Small Markdown Profile

Support a documented subset suitable for operational work context:

- paragraphs and visible line breaks;
- headings, rendered below the page's primary heading;
- bold and italic emphasis;
- unordered and ordered lists;
- block quotations;
- inline code;
- fenced code blocks with preserved whitespace;
- descriptive links and explicit URL autolinks using approved schemes.

Requirements:

- Single source line breaks remain visible in prose; paragraph breaks remain distinct.
- Code content is always literal text. A fence's language label must not load a highlighter or plugin.
- Code blocks scroll locally when needed rather than widening the page.
- Raw HTML remains inert, visible text rather than becoming live markup.
- Image syntax must not create a network request or an embedded image. Preserve readable literal or
  alternative text under one documented policy.
- Unsupported task-list syntax must not create interactive controls or imply tracked completion.
- Unsupported or incomplete syntax remains readable and editable; ordinary authoring must not fail
  because a fence or emphasis delimiter is unfinished.
- Markdown source is not normalized by rendering and is not replaced with generated output.

The profile should be implemented with established parsing primitives and a narrow allowlist, not a
custom Markdown parser. Its version identifies Worktrail's rendering contract, not a promise to
support every CommonMark or GitHub-flavored Markdown extension.

### 3. Shared Authoring And Preview

Introduce a focused authoring component for descriptions and comment bodies.

Requirements:

- Use a normal labeled textarea with source editing, not a WYSIWYG surface.
- Provide a compact format selector and Edit/Preview controls where applicable.
- Offer icon-based actions for common formatting: bold, italic, heading, bulleted list, numbered list,
  quote, inline code, code block, and link.
- Actions operate on the selection or insertion point, preserve surrounding source, and restore a
  useful caret or selection.
- Buttons have accessible names and tooltips; they must not submit the surrounding form accidentally.
- Preview uses the same renderer and options as saved content.
- Switching tabs or formats does not discard source, reset the form, or persist a change by itself.
- Preview does not make API calls or fetch link targets.
- Plain-text preview preserves line breaks and spacing without applying Markdown.
- Preserve draft source after validation or network failure; clear it only under the existing
  successful-submit or explicit-cancel behavior.
- Preserve the existing explicit Save/Create/Post actions and pending states.
- Keep the toolbar compact and responsive without placing large help panels above the work.

A link action may use a small dialog or inline prompt. The exact interaction belongs in technical
design, but it must validate the destination without losing the selected label or draft.

### 4. Structured Work-Item Descriptions

Apply the authoring component to every entry point that accepts a work-item description:

- global and project creation;
- child-work creation through the existing create workflow;
- work-item detail editing.

Requirements:

- Read mode renders the persisted description with its recorded format.
- Description structure remains visually subordinate to the work-item title and current-state facts.
- Editing loads the original source, not text extracted from rendered DOM.
- Existing plain-text records remain visibly plain text, including literal Markdown-like characters.
- Empty descriptions retain the existing empty-state treatment.
- Cancel does not persist source or format changes.
- Saving another field must not convert or normalize an unchanged description.
- Archived projects render both formats but remain read-only.
- Detail route reuse clears prior item editor and preview state before showing another item.

Do not move formatting controls into lists, board cards, My Work, Planning, or Quick Find.

### 5. Structured Comments

Apply the same editor and renderer to comment creation, editing, and display.

Requirements:

- Newly posted Angular comments use the explicit selected format.
- Existing plain-text comments remain plain text until deliberately converted by an authorized editor.
- Edited comments retain the established edited state and timestamp behavior.
- Deleted comments keep their tombstone; retained source must not reappear through rendering or preview.
- Comment author and owner/maintainer modification rules remain unchanged.
- Archived-project comments remain readable but cannot be created, edited, or deleted.
- Preview and toolbar actions never post a comment or create activity.
- An unchanged source-and-format edit is a no-op rather than a new edit event.

Mentions remain explicit structured data:

- The current member picker controls creation-time mention recipients.
- Typing `@name`, a Markdown link, or a work-item key does not add a recipient.
- Existing mention chips remain separate from rendered body text.
- Editing or converting a comment retains its existing mention set and does not resend mention or
  watcher notifications.
- Comment creation continues to use the existing mention/watcher deduplication policy.

This release should not couple Markdown token parsing to identity or notification delivery.

### 6. Safe Links And Rendering

Requirements:

- Treat all persisted source, language labels, link labels, and destinations as untrusted input.
- Permit only explicit `http` and `https` link destinations in the initial profile.
- Do not activate `javascript:`, `data:`, `vbscript:`, `file:`, protocol-relative URLs, or encoded forms
  that evade the same policy.
- Unsafe destinations retain readable text without a live unsafe anchor.
- External links use defensive new-tab behavior with `noopener` and `noreferrer`.
- Same-origin links may use normal application navigation, but must not gain privileged API access or
  trigger background record lookup.
- Never render author-provided styles, classes, handlers, scripts, forms, arbitrary attributes, or
  editor/plugin markup.
- Do not bypass Angular security merely because a Markdown parser produced the HTML.
- Keep sanitizer/allowlist policy explicit and identical between preview and display.
- Reading content makes no requests to third-party assets, preview services, or rendering services.
- A renderer failure falls back to escaped source without losing the record or editor.
- Do not add raw source or rendered content to ordinary request/error logs.

Link validation is a content safety measure, not an authorization mechanism. Every destination still
enforces its own access rules.

### 7. Input Bounds And Existing Long Records

Introduce consistent server-side and client-side source limits for new or changed descriptions and
comments. The proposed default is 10,000 UTF-16 code units per field, matching browser textarea length
counting and the current CSV cell limit.

Requirements:

- Comments still require non-whitespace source; descriptions may be empty.
- Validation must not remove leading indentation, code whitespace, or intentional line breaks from
  accepted Markdown source.
- Define line-ending normalization once and apply it consistently across API, editor, and import.
- Existing oversized records remain readable and must not be truncated by migration or rendering.
- Updating unrelated fields, or submitting an unchanged legacy source, must not fail because that
  source predates the new limit.
- Changing an oversized source or converting it to Markdown requires compliance with the new limit
  and actionable validation feedback.
- Pathological nesting, long unbroken strings, and delimiter-heavy input must not freeze the UI.
- Technical design should define parser/output bounds and a safe fallback for inputs that exceed them.

The change should not introduce a new global request-body limit that interferes with attachment or
CSV upload boundaries.

### 8. CSV, Search, And Historical Compatibility

CSV import requirements:

- Add an optional `description_format` column accepting the supported format identifiers.
- Existing CSV files without that column retain plain-text descriptions.
- Validate unsupported formats during preview; apply must use the same normalized source and format.
- Preserve multiline Markdown source, quotes, and code indentation within existing CSV byte/row limits.
- Import preview displays source as escaped text, not rendered HTML.
- Imports do not infer Markdown from punctuation or create comment mentions.

Existing project and workspace CSV export columns remain unchanged. They currently omit descriptions;
this sprint must not claim an export/import round trip for formatted content.

Search and history requirements:

- Work-list search and Quick Find continue matching stored description source under current semantics.
- Quick Find excerpts remain bounded plain text, even when they contain Markdown delimiters.
- Do not parse every matching description, add a rendered-text index, or change relevance tiers.
- List, board, review, and notification surfaces must not begin rendering arbitrary descriptions.
- Existing activity remains historical data; it is not reinterpreted as Markdown.
- Format changes are auditable through the established work-item/comment activity model without a new
  content revision-history feature or duplicate notifications.
- Source-and-format no-ops create no new activity.
- Published report and closeout snapshot schemas and rendering remain unchanged.

## UX And Accessibility Requirements

- Keep read mode primary; show editing tools only when creating or editing content.
- Provide visible format state so an existing plain-text record is not mistaken for a broken preview.
- Use familiar icons, tooltips, labeled tabs or segmented controls, and a compact option control for
  format selection.
- Maintain keyboard access to every formatting command and preview control.
- Preserve textarea focus and selection after toolbar actions; close link prompts with predictable
  focus restoration.
- Render semantic lists, quotations, links, and code without introducing a second page-level heading.
- Ensure source and rendered text remain readable at mobile widths and 200 percent zoom.
- Wrap long prose and link labels; constrain code overflow to its own region.
- Do not require horizontal page scrolling, hover, or color alone to understand the editor.
- Clearly associate validation with its field and retain the draft when an error occurs.
- Use the application's existing error, pending, permission, and archived-state conventions.

## Permissions And Lifecycle Rules

Formatting must not introduce a new permission model.

- Existing workspace membership and tenant isolation apply to every read and write.
- Work-item description changes use current work-item mutation permissions.
- Comment creation and modification use current comment permissions.
- Inactive actors cannot read or write content through a new rendering or preview endpoint.
- Preview is local presentation and requires no new endpoint.
- Archived projects retain readable descriptions and discussion while blocking mutation.
- Actor and item changes clear drafts and pending presentation state under the existing page lifecycle;
  late responses must not repopulate the previous actor's or item's content.

## Technical Expectations

- Add narrowly scoped PostgreSQL format columns with defaults and constraints; migrate existing rows
  without rewriting source or historic activity.
- Extend shared DTOs and write contracts additively, with explicit omission semantics.
- Carry format through repositories, services, detail reads, comment reads, imports, and seed fixtures.
- Keep content policy separate from domain authorization and transport adapters.
- Use a maintained parser with an explicit supported profile and a reviewed sanitization strategy.
- Do not use regex substitution as a Markdown implementation or trust a parser as a sanitizer.
- Share one renderer between descriptions, comments, and preview, plus one authoring component where
  existing forms allow it without a broad detail-page refactor.
- Keep content dependencies in route-level/lazy features rather than the root shell where possible.
- Avoid adding server rendering, object storage, workers, caches, or external services.
- Keep existing initial bundle and component style budgets; composition should resolve pressure before
  budget increases are considered.
- Document the rendering contract so later profile changes are deliberate and testable.

Parser choice, sanitization mechanics, form integration, precise format field names, and migration
implementation belong in the technical design rather than this PRD.

## Data And Seed Requirements

- Migration preserves all existing source, ownership, mention records, deleted-comment state, and
  immutable snapshots.
- Existing plain-text fixtures continue to exercise compatibility.
- Add a structured requirement description, reproduction steps, a code-bearing comment, safe links,
  and literal unsafe/unsupported syntax examples.
- Include plain text with Markdown-looking characters so silent conversion is detectable.
- Include archived-project formatted content and edited/deleted comment cases.
- Seed behavior remains deterministic and repeatable.
- No manual content conversion is required after upgrade.

## Documentation Requirements

At release finalization, update:

- README capabilities, supported formatting, limits, and existing plain-text behavior;
- OpenAPI format fields, defaults, omission semantics, validation, and examples;
- CSV import guidance and sample data for the optional format column;
- public site copy and a relevant screenshot showing structured work context;
- release notes with migration behavior, supported syntax, security limits, and deferred scope;
- destination-neutral pattern notes covering source/format persistence, shared preview policy,
  legacy compatibility, and structured mention separation;
- implementation verification evidence and dependency/security review results.

Do not advertise rich-text coauthoring, interactive checklists, inline attachment previews, full
Markdown compatibility, or production hosting.

## Testing Requirements

### Contracts, Persistence, And API

- Existing requests without formats retain the specified create/update behavior.
- Source and format persist and return together through all supported entry points.
- Unknown formats, oversized changed source, and empty comments fail safely.
- Unchanged oversized legacy content and unrelated edits remain valid.
- Leading whitespace, line endings, code indentation, and multiline CSV content follow one policy.
- Migration backfills plain text without altering existing content or snapshots.
- Tenant isolation, inactive-member denial, modification permissions, and archived rules remain intact.
- No-op edits create no new activity; real format changes are recorded appropriately.
- Comment edit/conversion does not change mentions or resend notifications.
- CSV import preview/apply agree; existing summary exports remain unchanged.

### Rendering And Angular

- Every supported construct renders consistently in preview and saved display.
- Plain-text Markdown-like syntax remains literal before explicit conversion.
- Toolbar actions preserve source, selection, form state, and submission behavior.
- Edit/Preview switching, conversion, cancellation, and failed saves retain the correct draft.
- Raw HTML, dangerous and obfuscated URLs, image syntax, event attributes, and code payloads remain
  inert; reading and preview make no third-party requests.
- Deleted comments never expose retained source.
- Long words, long code, malformed syntax, deep nesting, and delimiter-heavy input have safe layouts
  and bounded rendering behavior.
- Renderer failure has a readable escaped-source fallback.
- Actor changes and detail route reuse cannot leak prior drafts or stale rendered content.

### Browser And Regression

- Create a structured work item, preview it, save it, reload it, and edit its original source.
- Create child work with a formatted description using the existing workflow.
- Convert a plain-text description deliberately; cancel a conversion without changing persistence.
- Post and edit a formatted comment with explicit mentions; verify recipients remain correct.
- Read formatted content in an archived project and verify mutation remains blocked.
- Import plain-text and Markdown descriptions with multiline source.
- Verify keyboard-only editing, mobile layout, zoom, focus restoration, and no page overflow.
- Verify no new external network requests from authored content.
- Regress attachments, Quick Find, canonical list state, saved views, boards, reports, and closeout.
- Run lint, typecheck, unit/integration tests, production build, browser coverage, dependency audit,
  and diff hygiene checks.

## Acceptance Criteria

v0.2.9 is complete when:

- all work-item description entry points and comment create/edit support explicit plain text and the
  versioned Markdown profile;
- new Angular content defaults to Markdown while legacy and omitted-format API behavior remain safe;
- users can apply common formatting and preview the saved presentation without losing source;
- descriptions and comments render supported structure clearly on desktop and mobile;
- unsafe links, raw HTML, images, and unsupported active content cannot execute or fetch resources;
- legacy text is not silently reinterpreted, truncated, or blocked by unrelated edits;
- format/source writes are atomic and auditable without duplicate activity or notifications;
- mention recipients remain explicit and deleted comments retain their tombstones;
- CSV import understands optional format metadata while existing exports and historical snapshots
  remain compatible;
- search remains bounded source-text search without rendering every result;
- permissions, archived behavior, stale-response protection, and route reuse remain correct;
- source limits, pathological-input handling, bundle budgets, and accessibility checks pass;
- documentation, public site, release metadata, and verification evidence accurately describe scope;
- no required check fails and no unresolved release-blocking decision remains.

## Success Signals

This release adds no product analytics. Evaluate success through concrete scenarios:

- A reader can distinguish objective, acceptance criteria, and technical evidence at a glance.
- An author can format a list, insert a code example, and verify it before saving.
- A comment can link to a resource without exposing a long URL as its only label.
- Existing descriptions and comments retain their literal presentation after migration.
- Reading user-authored content creates no remote asset traffic.
- The feature adds no permanent control stack to work lists or the application shell.

## Risks And Mitigations

### Silent reinterpretation of existing text

Mitigation: explicit persisted format, plain-text migration, omission-preserving updates, and deliberate
conversion with preview.

### A parser is mistaken for a security boundary

Mitigation: disable active constructs, enforce link and output allowlists, retain Angular security,
and test adversarial source independently of normal formatting tests.

### A source editor feels too technical

Mitigation: compact formatting actions, faithful preview, useful selection behavior, and a small
profile. Defer a heavyweight editor until actual authoring feedback justifies it.

### Renderer or editor dependencies regress load time

Mitigation: route-level loading, no syntax highlighter or extension system, bundle inspection, and
existing budgets as release gates.

### Input limits break old records or whitespace-sensitive examples

Mitigation: grandfather unchanged source, preserve accepted indentation, validate changed content
consistently, and never truncate migration data.

### Markdown is confused with structured workflow data

Mitigation: exclude interactive checklists, inferred mentions, and automatic work-item linking;
keep formatting separate from identity, completion, and notification policies.

## Deferred Opportunities

- Inline work-item references and canonical internal-link assistance.
- Accessible task checklists with a separate persistence and activity model.
- Markdown tables, syntax highlighting, and a broader documented extension profile.
- Project, milestone, and report narrative formatting with explicit snapshot versioning.
- Attachment thumbnails and safe previews behind their own content/security design.
- Inline attachment references without public file URLs.
- Rich-text editing, collaborative drafts, revision history, and conflict resolution.
- Full-fidelity description export and richer import mapping.
- Rendered-text search, comment search, and content indexing if raw-source search proves insufficient.
- Production identity, managed storage, hosted deployment, and operational hardening.

## Open Questions

No blocking questions remain. The [technical design](technical-design.md) resolves the initial
questions as follows:

- Use `markdown-it` tokens projected into application-owned nodes and static Angular templates;
  do not insert generated HTML or add a separate HTML sanitizer.
- Use compact Lucide toolbar buttons that wrap on narrow screens, with no custom overflow menu.
- Insert links through an inline form that retains the textarea selection, not a modal or prompt.
- Use `descriptionFormat` and `bodyFormat`; extend existing description/comment activity events
  without adding full comment-body history or changing notification recipients.
- Apply bounded parsing/projection and preserve complete escaped source on fallback, including
  oversized legacy records. The design defines the initial limits and verification requirements.

## Implementation Defaults

- Use `plain_text` and `markdown_v1`, persisted alongside existing string fields.
- Backfill existing rows as plain text; keep omitted create formats plain text and omitted update
  formats unchanged.
- Default newly authored Angular descriptions/comments to Markdown, but preserve the persisted format
  when editing existing content.
- Use a textarea-based shared editor with compact formatting icons and Edit/Preview controls.
- Support the enumerated prose/code/link subset with visible single line breaks; omit tables, images,
  task-list controls, and syntax highlighting.
- Use one maintained parser and one explicit security policy for preview and read mode.
- Permit only explicit HTTP(S) links, with defensive external-link behavior and no background lookup.
- Preserve source whitespace except consistent CRLF-to-LF normalization; validate comments using a
  non-whitespace check without trimming the stored source.
- Limit new or changed source to 10,000 UTF-16 code units; retain unchanged oversized legacy records.
- Add optional `description_format` to CSV import; leave current export columns unchanged.
- Keep explicit mention records, notifications, source-text search, reports, and snapshots on their
  established contracts.
- Introduce no new runtime infrastructure and keep content dependencies out of the shell where
  practical.
