# Worktrail v0.3.0 Acceptance Handoff

Phase 20 verifies the consolidated application and prepares user acceptance. This is a working-branch
handoff, not a released, deployed, or accessibility-certified product. Package identity remains
`0.2.9` until Phase 21. Detailed commands, counts, diagnostic failures, and cleanup evidence belong in
the [Phase 20 verification record](verification-notes.md#phase-20-integrated-acceptance-and-uat-handoff).

## Acceptance Coverage

The [journey matrix](implementation-plan.md#acceptance-journey-matrix) is the release acceptance map.
Accepted audit-derived commitments map to implemented owners and evidence below, with remaining
manual checks listed under Manual Signoff. This phase repeats integrated gates rather than adding
another feature area.

| Boundary | Acceptance Evidence |
| --- | --- |
| Live query and saved views | All-field URL/API round trips, exact open/unestimated semantics with zero excluded, Named/Modified/Custom identity, explicit shared updates, top/bottom pagination and visible-page bulk selection |
| Authored work and route reuse | Independent description/comment/create/report drafts; Stay, discard, actor switch and pending-write protections; real parent/leaf reuse and obsolete-response cancellation |
| Inspection continuity | Filtered page 3 through parent/child/dependency/create returns; bounded safe origins; notification-comment and Files targeting with unavailable-target fallbacks |
| Planning and history | Correct an estimate and return to the refreshed review; deliberate unfinished-work destination; all twelve frozen commitments, v1/v2 compatibility, complete Markdown/print and distinct Current context |
| Discovery and roles | Fifteen-project refinement and actual-container containment; repeated fresh Quick Find inspections, identity reset, contributor restrictions and archived/read-only recovery |
| Backend integrity | Real synchronized PostgreSQL schedules, transaction rollback/context isolation, migration preservation, parser HTTP boundaries, hydration budgets and aggregate projections |
| Setup and visitor experience | Phase 19 independently installed development/compiled-preview paths and exact seeded downloads; integrated preview/site checks repeat against the current tree |
| Input and view conditions | Five populated surfaces at seven viewport sizes, larger control fonts, long unbroken titles, semantic table headers and active navigation; native 200% Chromium zoom and keyboard focus recovery |

The new My Work regression covers secondary rows at tablet width, not just the daily queue above
them. Rows use their available container width and wrap metadata instead of retaining six fixed
minimum-width tracks. Existing fixture journeys continue to cover keyboard actions, selected/active
state, retained native editor undo/selection, paste/security boundaries and synthetic composition.

## Native Zoom Method

The zoom check starts bundled Chromium with an isolated persistent profile inside the verification
run root. A test-only extension with the `tabs` permission calls Chrome's actual `setZoom(2)` API.
It asserts the reported zoom, halved CSS viewport, doubled DPR, unchanged outer window and unchanged
CSS zoom. This is not a narrow-viewport or CSS-transform substitute. My Work, Work Items, Planning,
Portfolio, detail and Quick Find are inspected after populated content is ready.

Native surface captures avoid Playwright's cropped viewport capture at the changed DPR. Quick Find's
complete dialog bounds, keyboard entry, reachable close control and restored launcher focus are
checked independently of screenshots. The profile/extension are never installed in a user's browser.
See [Playwright extension support](https://playwright.dev/docs/chrome-extensions) and
[Chrome tab zoom API](https://developer.chrome.com/docs/extensions/reference/api/tabs#method-setZoom).

## User Walkthrough

Use a disposable local database and an explicitly configured disposable attachment directory. Follow
the [supported setup](../../README.md#local-setup); do not reset an existing working database or file
store for this walkthrough. Automated verification already uses its own isolated resources. Start
as Morgan Maintainer unless a step names another actor. These are instructions, not recorded passes.

1. **Work discovery:** open Work Items and a pinned or saved view. Change a filter without applying;
   the active chips/results must remain unchanged. Apply it, check Modified identity, then reopen the
   named view. An explicit shared Update changes that view; merely inspecting a different query does
   not. Check both pagination locations and visible-page selection in project bulk mode.
2. **Corrective action:** open an active cycle's Unestimated work signal. Confirm it lists only open
   work with a null estimate, not zero. Edit one item to zero or a positive estimate, change/clear its
   due date, and return to the same cycle review. Refresh and confirm the corrected risk disappears.
   If the seeded active cycle has no matching work, create a disposable ready task assigned to it
   with no estimate before starting.
3. **Draft safety:** edit a description and separately start a comment. Try a linked item, Quick Find,
   global navigation and an actor switch. Stay must retain both editors and their current identity;
   discard must be deliberate. Repeat a report narrative or create draft. Do not close a browser tab
   containing text you want to keep; unload protection is not durable draft storage.
4. **Linked inspection:** use a filtered list with enough disposable records for page 3, ten per page.
   Open a parent, a child, the parent again, and the originating list. Query/page must survive without
   recursively growing return URLs. Open an Inbox mention and a Quick Find file result; discussion
   or Files must be reached with an understandable route back.
5. **Historical outcome:** in Closeout Lab, inspect both `Historical carryover: 12 unfinished (v1)`
   and `(v2)`. Show all carried commitments, including the last two, and compare frozen values with
   a current record. Current context must be a separate deliberate disclosure. Download Markdown
   and inspect print preview; all twelve commitments must remain present, not just the visible page.
6. **Deliberate closeout:** preview the active Closeout Demonstration. No unfinished-work destination
   should be preselected. Choose Unplanned or an eligible cycle and check the affected count/name.
   Cancel to preserve the fixture. Complete an actual closeout only on disposable data; automated
   acceptance already exercises the real command and immutable replay.
7. **Repeated discovery:** in Portfolio, refine project/health/freshness, inspect Details and links,
   and confirm workspace totals do not become filtered-row totals. Inspect two Quick Find results
   successively; the query persists but results refresh. Switch actor and confirm that session resets.
   Repeat at 200% browser zoom, checking keyboard focus, reflow and dialog scrolling/close access.
8. **Roles and files:** switch to Casey Contributor and check shared-view/project-management
   restrictions without losing read access. Inspect archived project/read-only behavior. Download
   both seeded WT-3 files and check readable content. Review the public site's mobile proof,
   workflow links, setup and explicit local/demo limitations.

For exact named history IDs and frozen/current differences, see the
[historical walkthrough](historical-closeout-evidence.md#named-product-walkthrough).

## Manual Signoff

| Item | Current Status | Required Disposition Before Phase 21 Closure |
| --- | --- | --- |
| User UAT | Pending; no v0.3.0 user observations or approval recorded | Record actual walkthrough observations and approval, or an explicit decision about any remaining items |
| Screen-reader walkthrough | Not performed in this environment | Check view identity/results announcements, active navigation, detail targets, departure dialog, Quick Find and closeout with a named reader/browser; record defects or explicitly accept the gap |
| Native OS input | Real OS IME, OS clipboard and cross-browser device behavior not attested | Synthetic composition and browser paste/undo checks are narrower evidence; record real-device observations or explicitly accept that limit |
| Remote validation | Local verification only | CI, published Pages and any deployment remain user-controlled post-publication checks, not local passes |

Record date, actor, browser/OS/input conditions, observed outcome and follow-up for manual checks.
Do not replace Pending with Passed based on automated test counts. No human UAT, screen-reader or
real-device signoff is implied by completing the Phase 20 automated acceptance and handoff work.
