# Worktrail v0.2.9 Release Notes

## Summary

Worktrail v0.2.9 adds **Readable Work**: structured descriptions and discussion with source editing,
formatting actions, and faithful preview. Requirements, reproduction steps, code examples, and review
comments are easier to scan without changing the meaning of existing plain text or explicit mentions.

The release is prepared locally; merging, tagging, and GitHub Pages deployment remain separate actions.

## Product Changes

- Work-item descriptions and comments store source plus an explicit plain-text or Markdown format.
- Global, project, and child work creation share the same authoring control as description editing.
- New Angular descriptions/comments default to Markdown; editing preserves the loaded format.
- A source toolbar supports headings, bold, italic, lists, quotations, code, and validated links.
- Preview and saved content use the same viewer. Preview alone does not persist changes.
- Deliberate format conversion, cancel/reset, failed-save draft retention, native typing undo/redo,
  and selection/focus restoration are covered by tests.
- Context generations prevent late responses from replacing drafts after route, actor, or item changes.
- Archived formatted context stays readable and read-only. Deleted comments remain tombstones with
  no exposed source or authoring controls.
- Long code stays within its own scrollable, keyboard-focusable region on narrow screens.
- Seeds demonstrate requirements, reproduction steps, code, explicit mentions, edited/deleted
  comments, legacy punctuation, unsupported source, and archived decisions.

## Formatting Profile

`markdown_v1` supports paragraphs, visible line breaks, headings, ordered/unordered lists, emphasis,
quotations, inline code, fenced/indented code, and explicit HTTP(S) links. Headings are mapped beneath
the surrounding page hierarchy. Code is literal, without syntax highlighting. Naked URLs are not
automatically linked.

Raw HTML remains readable text. Images show alternative text only, with no asset request. Rejected
links stay readable without an unsafe destination. Tables, strikethrough, interactive checkboxes,
embedded HTML, arbitrary attributes, inline attachments, WYSIWYG editing, and coauthoring are not
included. This is not full CommonMark or GFM.

The web parser is pinned to `markdown-it@15.0.2`, without plugins. Parser tokens are projected into
finite application-owned nodes and rendered through static Angular templates; generated HTML is not
stored or inserted. URLs must be explicit HTTP(S), without credentials; relative destinations such
as `/api/...` are rejected. Valid absolute links may still be same-origin or external: this is not a
trusted destination allowlist. Links use defensive attributes. Unknown formats, parser failures, and projection-bound
failures display the complete source literally rather than dropping or partially rendering it.

## Compatibility And Input Policy

- Detail responses add `descriptionFormat`; comment responses add `bodyFormat`.
- Omitted API creation formats default to `plain_text`. Markdown is never inferred from punctuation.
- Work-item updates preserve omitted description/format fields; format-only conversion is supported.
- Comment updates preserve omitted format but still require `body`, including for conversion.
- New or changed source normalizes CRLF/lone CR to LF without trimming spaces, indentation, or
  surrounding blank lines. This intentionally replaces the previous trimming behavior on writes.
- New/changed pairs must fit 10,000 normalized UTF-16 code units. Descriptions may be empty or blank;
  new/changed comments must contain non-whitespace source. This unit is not bytes or graphemes.
- Unchanged legacy source/format pairs remain valid even if oversized or historically blank.
  Equivalent normalized source keeps historical bytes. To convert an oversized record, shorten its
  source in the same request; converting a blank legacy comment also requires valid nonblank source.
- No-op pairs preserve timestamps and produce no activity/notifications. Full work-item PATCH no-ops
  also compare scalar fields and label sets without order or duplicate sensitivity.
- Real description changes retain auditable source/format values; comment edits record lifecycle and
  format metadata without adding body history. Format-only changes have explicit activity summaries.
- Mention recipients remain explicit identity records. Source text does not create recipients;
  comment edits neither replace mention rows nor resend creation notifications.
- Existing permissions and archived/deleted write conflicts remain enforced, including for no-ops.

Source-text search still searches stored description text, not a derived rendered/plain-text index.
Comments remain outside Quick Find. Summary CSV export columns, published report schemas, report
Markdown sharing, and immutable closeout snapshots are unchanged.

## CSV Import

Optional `description_format` accepts `plain_text` or `markdown_v1` after metadata trimming; missing
or blank cells default to plain text. Invalid values identify the row and block the whole apply.
Quoted descriptions preserve whitespace and multiline code, normalizing line endings to LF.
The description bound is 10,000 normalized UTF-16 code units; other cells retain a 10,000 raw-unit
bound. Existing 1 MiB, 250-row, and 20-labels-per-row limits remain.

Preview exposes the format and an escaped source excerpt of at most 240 UTF-16 units, not rendered
Markdown or full source. Apply revalidates the original CSV transactionally. Summary exports omit
description and format and are not round-trip imports.

The [multiline example](authored-work-items.csv) is covered by an integration test through preview,
apply, and persisted reads. The [CSV guide](../v0.0.X/v0.0.7/csv-import-export.md) documents all columns
and the current plural `/imports/preview` and `/imports` API paths.

## Upgrade And Operations

Back up the current PostgreSQL database and attachment store as a coordinated data set, then apply
the committed migrations with the installation's explicit database configuration:

```sh
npm install
npm run db:migrate
npm run build
```

Migration `0019_nosy_junta.sql` adds non-null text format columns, plain-text defaults, and checks for
the two supported values. Existing source strings are not rewritten. **Do not reset or seed working
data to upgrade.** Seed commands are demo setup and intentionally restore their example records.

No new runtime service, environment variable, queue, object store, or cloud deployment is required.
All workspace package versions, the API contracts dependency, lockfile workspace entries, and OpenAPI
identity are `0.2.9`. The existing static Pages workflow remains responsible for deploying `site/`
after changes land on `main`; it does not deploy the application.

## Verification And Residual Risks

The [implementation plan](implementation-plan.md) and [verification notes](verification-notes.md)
record phase evidence and final-tree checks, including migration preservation, repeated seed,
source-policy and concurrency tests, DOM/network security assertions, editor keyboard behavior,
responsive screenshots, the complete application browser suite, and compiled production preview.

Initial and style budgets remain unchanged. Authored-content parsing/rendering remains behind lazy
create/detail routes. Local parser/projection timing is below the design targets, but is not a
production SLA or a CPU timeout for arbitrary content. Browser clock precision and fixture overhead
are documented with the measurements.

Production dependency auditing is clean at verification time. Development-inclusive auditing still
reports 34 existing toolchain findings (8 moderate, 21 high, 5 critical); these require a separate
verified toolchain upgrade. No unrelated dependency override or major upgrade was introduced here.

Real OS IME behavior, actual browser-chrome zoom, and screen-reader announcements were not manually
validated. Synthetic composition and compact CSS-width reflow tests do not substitute for those
checks. Local actor headers, local file storage, and the absence of production identity, malware
scanning, managed multi-instance infrastructure, and internet-safe hosting are unchanged. Markdown
presentation safety does not make the application safe to expose publicly.
