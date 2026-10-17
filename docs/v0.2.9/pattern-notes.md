# Worktrail v0.2.9 Pattern Notes

## Purpose

These notes record evidence from structured descriptions and discussion without assigning it to a
framework, package, or destination. Two authoring workflows now share a source model and presentation
path, while preserving their distinct lifecycle and notification rules.

## Persist Source And Versioned Format Together

Source plus a format identifier is the durable record. Punctuation is not format detection, and
generated HTML is not persistence. A plain-text database default makes additive migrations safe for
older records and API clients; a new UI can explicitly select Markdown without changing that default.

Treat source and format as one atomic pair. Omitted update fields resolve against the current stored
pair after authorization and locking, not against request-time assumptions. This keeps conversion,
no-op detection, activity, and concurrent writes coherent. A versioned profile leaves room for future
interpretations without silently changing the meaning of existing content.

## Render An Allowlisted Presentation Tree

A proven parser should own grammar interpretation; the application should own what it can present.
Worktrail projects parser tokens into finite block/inline unions and uses static Angular templates
with text interpolation. No parser-generated HTML, security bypass, arbitrary attributes, dynamic
components, or runtime templates cross the boundary.

URL policy is shared by projection and link insertion. Images become alternative text, unsafe links
lose their destination, and raw HTML remains literal. Source, token, node, depth, and projected-text
bounds protect different costs. Parser shape failures and bound failures fall back to the complete
literal source rather than a partial result that could conceal important context.

This is evidence for an application-owned presentation boundary, not a universal HTML sanitizer or
proof of a hard CPU bound. Security tests must inspect both DOM and network behavior.

## Share Preview And Read Rendering

Preview should consume the exact source/format pair through the same viewer as persisted content.
Keeping parsing out of the editor prevents divergent semantics and makes preview/read equality
directly testable. Parsing code stays behind the features that need it rather than entering the shell.

The editor owns temporary interaction state: edit/preview mode, selection, link input, composition,
and native typing history. Its compound form value is just source and format. Parent-owned reset
identity handles same-value resets and context changes that value equality alone cannot represent.

Native textarea behavior is a useful foundation, but programmatic toolbar operations still need
explicit selection and focus rules, non-submitting buttons, composition guards, and trusted browser
undo/redo tests. Synthetic composition is not evidence of every real OS input method.

## Validate Changed State Without Rewriting History

A new policy can govern changed values without forcing historical data through destructive cleanup.
Worktrail normalizes changed line endings and bounds changed pairs in explicit UTF-16 units while
allowing unchanged oversized or historically blank records. Equivalent normalized source retains the
historical stored bytes. A format-only conversion is still a changed pair and must meet current rules.

Resolve and compare after authorization against locked records. A no-op must preserve timestamps,
activity, and notifications, but must not bypass archived/deleted lifecycle restrictions. Keep error
details bounded and source-free. This approach is useful where compatibility requires retaining old
data; it is not a reason to exempt genuinely changed invalid state.

## Keep Recipient Identity Separate From Presentation

Readable names and `@name` source text are not durable identity or notification intent. Explicit
mention records remain outside Markdown, and comment edits preserve those records rather than
reinterpreting text or resending creation notifications. Deleted-comment tombstones suppress source
before rendering, not merely through CSS.

The same separation protects reports and historical snapshots: improving a live authored-content
surface does not authorize migrating every narrative field or reinterpreting published evidence.

## Give Drafts Context And Operation Identity

Route reuse, actor changes, and delayed mutations can invalidate a callback even when the current
item id happens to match again. Capture a context generation and operation identity, and gate both
success and failure callbacks before they can reset or replace drafts. Disable relevant controls
during submission, preserve failed drafts, and keep independent description/comment drafts separate.

This is narrower than a global draft framework. The shared authoring control owns input behavior;
the page owns permission, route, mutation, and notification context.

## Prove The Boundaries Independently

Migration, source policy, rendering, editor behavior, page integration, and transport need different
evidence. Fresh/repeated seed comparisons prove deterministic demo state; migration upgrade tests
prove historical preservation. DOM assertions prove inert nodes, while request interception proves
that viewing/previewing does not fetch remote assets or call unexpected privileged endpoints.

Use local measurements for parser/projection performance, separately from Angular rendering and
without fragile shared-runner timing assertions. Inspect the production dependency graph, not just
the aggregate bundle total. Test compiled deep links as well as development routes. Keep viewport
reflow, synthetic composition, real OS IME, actual browser zoom, and screen-reader validation clearly
distinguished in evidence.

## Deliberate Non-Abstractions

The release adds no document registry, generic rich-text engine, plugin system, WYSIWYG model,
universal narrative migration, mention parser, generic notification router, or framework package.
The supported patterns are source/format pairs, finite presentation trees, a shared read/preview path,
state-aware compatibility validation, explicit identity metadata, and context-safe draft ownership.
Future reuse should preserve the differences that these two concrete workflows exposed.
