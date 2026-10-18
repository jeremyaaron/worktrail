# Bounded Navigation Evidence

Implemented for v0.3.0 Phase 14 on October 17, 2026. This is working-branch capability, not a release
or deployment claim. The [design](technical-design.md#navigation-context-and-section-targets) and
[verification notes](verification-notes.md#phase-14-bounded-returns-and-section-targeting) govern the
policy and recorded checks.

## Production Ownership

- `shared/navigation/work-navigation.ts` owns allowlisted UrlTree parsing and bounded builders. It
  imports pure query/page codecs, not page components, editors or CDK. The two obsolete detail/create
  return parsers were removed.
- `returnUrl` retains the durable origin. Optional `returnTo` retains one bare record/recognized
  fragment. Record inspection replaces that immediate target; returning to it consumes it. Legacy
  record-valued origins fall back to project Work while retaining that immediate destination.
- Project/workspace list creation, project-shell creation, detail parent/child/dependency links,
  create preview/success, board/My Work/result/daily queues, planning/reviews, closeout/result/report,
  Inbox and Quick Find use the shared policy. Existing query/page codecs preserve applied predicates,
  sort, page and page size; form drafts are never serialized as navigation context.
- Labels derive from destination type. A current authorized parent can supply its display key; an
  arbitrary search string or unavailable record name cannot become return copy.

## Local URL Policy

Targets are limited to 4 KiB after the outer query value has been decoded once by Angular; complete
constructed relative navigation is limited to 12 KiB. URL components are parsed once, not repeatedly
decoded. Reject schemes/protocol-relative paths, backslashes/control characters, malformed escapes,
matrix/auxiliary routes, unknown route/query/fragment shapes, duplicate query values, nested return
metadata and self returns. Ambiguous outer return values are retained by `PageContext.queryValues()`
so callers can reject them rather than choose an arbitrary value. Invalid pairs fall back together.

Known Planning subviews and review/report headings survive. Work predicates use the existing scope
policy and enum options. The parser is not an authorization boundary: current actor/workspace resource
loads remain authoritative, including a rejected detail load with an otherwise valid return URL.

## Post-Commit Targets

`WorkItemSectionTarget` observes the accepted record and committed actor/route/fragment after render.
It never selects another record's DOM during loading or Stay. Discussion, Dependencies and History
are stable section targets; live comments have `comment-<id>` container IDs. Deleted/missing comments
fall back to Discussion, and tombstones contain no authored viewer/source. Ordinary refresh does not
refocus; explicit same-section activation can repeat. Browser back/forward and reload work too.

Files keeps its established settled-load generation owner and byte/metadata authorization. Quick Find
only performs direct repeat focus for the current record after dialog close; changed-record Files
focus belongs to that record's readiness owner. Closed-dialog completion cannot queue an obsolete
focus operation.

Review/report/planning pages use `NavigationSectionTargetDirective`, with accepted data readiness and
committed identity. `focusSectionTarget()` scopes lookup to the page owner, opens relevant native
disclosures, supplies programmatic focus and an 88px sticky offset, and scrolls without animation.
This remains valid with reduced motion, absent headings and ordinary refresh.

## Verification Surface

Pure policy tests cover unsafe URLs, legacy links, query/page continuation, create context, recognized
fragments, self/recursive destinations, bounds and 100 repeated traversals without URL-stack growth.
Affected Angular integration tests cover actual link consumers, committed query multiplicity, delayed
render readiness, comment fallback, refresh focus, disclosure opening and stale Quick Find Files nodes.

Browser journeys exercise filtered page 3 -> parent -> child -> reload -> parent -> origin, a
cross-project dependency return to Dependencies, child creation/success/parent context, notification
comment focus and reload, deleted/missing comments, Stay/Discard, fragment back/forward, repeated
Files, attachment downloads, cycle snapshot returns, project/workspace paging and responsive hierarchy.
The 403 browser case intentionally intercepts a rejected resource response; it proves frontend cleanup,
not a new backend authorization test. Existing backend authorization code is unchanged.

The compiled preview verifies deep links/reload into History and return to Planning's Cycles subview,
including heading focus. Initial production size is 397.81 kB (109.93 kB estimated transfer), with
20 lazy page entries and no detail/Planning/editor/Markdown/CDK inputs in the initial static graph.
Budget thresholds, dependencies and package versions are unchanged. Desktop/mobile section screenshots
were inspected at 1280px and 320px with no horizontal overflow or overlapping target text.

Exact run IDs, diagnostic failures, focused reruns, cleanup and omitted suites are recorded in the
[verification notes](verification-notes.md#phase-14-bounded-returns-and-section-targeting). Full API,
contracts, editor, site and release-wide suites are not claimed by these frontend-only checks.
