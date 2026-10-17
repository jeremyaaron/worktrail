# Worktrail v0.3.0 PRD

## Status

Approved implementation scope. Phase 0 planning and decision closure completed on October 17, 2026.
Phases 1-3 verification and toolchain foundations are complete; implementation is in progress and release verification
remains pending. See the
[implementation plan](implementation-plan.md).

## Summary

Worktrail v0.3.0 should consolidate v0.2.1-v0.2.9 into **Connected Work: A Coherent Operating Baseline**.

The release should make one operating journey reliable: find relevant work, understand its context,
take the necessary action, and return to the review that prompted it. Users should keep their place,
retain control of unsaved work, and understand whether a number describes current work, a risk signal,
or historical evidence.

This is a consolidation release, not another major feature area. It combines workflow repairs,
review-first presentation, measured backend improvements, safer verification, and a shorter public
product story. The only planned extension to work discovery is an estimate-state filter needed to
make existing unestimated-work signals actionable.

## Audit Inputs

This scope draws on the [UX audit](ux-audit.md), [technical debt audit](tech-debt-audit.md), and
[public site audit](site-audit.md), all reviewing the v0.2.9 baseline at commit `4e508cc`.

The audits distinguish reproduced failures from source-identified risks and recommendations. Their
measurements are planning inputs, not evidence that v0.3.0 changes have already been verified.

| Audit Finding | Release Response |
| --- | --- |
| A contributor can reach unestimated work but cannot edit its estimate on detail | Complete single-record planning edits and exact estimate-state drill-downs |
| Navigation loses drafts, review origins, or the relevant discussion target | Protect meaningful drafts and provide bounded, safe return and section context |
| Closeout hides historical rows beyond eight and competes with a full live dashboard | Make complete historical outcome primary; disclose current context separately |
| Risk counts, progress labels, and saved-view feedback imply the wrong meaning | Align identity, counts, labels, and links with the underlying state |
| Portfolio grid constraints exceed its actual container | Repair containment and simplify project comparison |
| Reused routes and delayed actor/options responses can retain stale context | Make route identity and asynchronous ownership consistent |
| Eight synchronized planned-cycle creations all stored overlapping ranges | Enforce schedule and lifecycle invariants against authoritative concurrent state |
| A 100-row project page issued 409 SQL statements in the audit fixture | Batch reference hydration and verify complete read-path query budgets |
| A valid 108,669-byte CSV preview returned an HTML 413 at the HTTP boundary | Align import transport budgets with domain policy and structured errors |
| Tested saved-view/filter helpers have no production consumers | Adopt shared production ownership and remove superseded implementations |
| Verification setup is destructive unless callers assemble isolation correctly | Make disposable verification an executable default, not just a warning |
| The site repeats inventories and its preview example changes storage roots after seeding | Present four workflows and independently working setup paths |

The audit's green suite and zero production dependency findings are worth preserving. They do not
negate the reproduced gaps or the separately reported development-toolchain vulnerabilities.

## Goals

- Complete the review-to-correction loop for estimates, due dates, and existing planning assignments.
- Prevent avoidable loss of unsaved authored work during route, record, and actor changes.
- Preserve useful origin, query, page, subview, and section context through record inspection.
- Make live work, historical outcome, delivery progress, and lifecycle state distinguishable.
- Reduce default administrative controls on detail, Planning, project management, and Portfolio.
- Make current filters, named saved views, and result position understandable and consistent.
- Repair concurrent-write, transport-limit, route-context, and measured hydration defects.
- Give shared behavior real production owners and keep future changes out of unrelated state machines.
- Make verification safe to run from a fresh checkout and keep dependency risk actively managed.
- Present the complete product through four public workflows and a working local trial path.

## Non-Goals

- No new dashboard, planning methodology, forecasting, capacity calendar, or automation system.
- No production identity, invitations, tenant provisioning, hosted application, one-click AWS
  deployment, managed object storage, or new runtime infrastructure.
- No custom workflows/roles, recursive hierarchy, automatic parent rollups, or query-wide bulk edits.
- No WYSIWYG/coauthoring platform, automatic `@name` mentions, report narrative format migration,
  attachment previews, inline embeds, malware scanning, or file-content search.
- No persistent local draft store, server autosave, cross-device drafts, or revision history.
- No historical snapshot rewrite, fabricated historical values, or expansion of snapshot evidence
  from current records. New schema versions are allowed only if compatibility requires them.
- No fuzzy/semantic search, dedicated result pages for every Quick Find group, search analytics,
  persistent search history, or personalization.
- No stack replacement, general workflow/state framework, command bus, or extraction into a package.
- No wholesale repository reorganization or file splitting solely to reduce line counts.
- No forced dependency fixes or blanket build-budget increases to make release gates green.

## Users And Primary Journeys

| User | Journey This Release Must Improve |
| --- | --- |
| Contributor | Find a scoped risk, correct the record, return, and see the live signal change |
| Maintainer | Review execution, deliberately close scope, and inspect complete outcome later |
| Team member | Open a mention or file result at the right section without losing their prior context |
| Reviewer | Compare projects and distinguish delivery pressure, communication freshness, and historical evidence |
| Author | Edit a description, comment, work-creation form, or report narrative without accidental navigation loss |
| Reference-app developer | Locate the production owner of query, command, client, draft, snapshot, and verification behavior |
| Public visitor/operator | Understand the product, inspect representative screens, and run a working local example |

## Product Principles

- **Complete the loop:** a signal should lead to the right action and a useful return destination.
- **Read first, edit deliberately:** common reading and collaboration should not require traversing
  permanent administrative forms.
- **Name the evidence:** distinguish unique work, category occurrences, scope conditions, preview
  lengths, and historical versus live values.
- **Protect intent before changing context:** cancellation and stale-response checks do not replace
  a user's decision about unsaved work.
- **Preserve established boundaries:** containment is not dependency; mentions are identity records;
  snapshots are not live queries; pagination is not board truncation.
- **Share actual behavior:** a tested scaffold with no production consumer is unfinished extraction.
- **Measure complete paths:** endpoint enrichment, transport handling, and real concurrent writes
  matter as much as isolated helpers or representative SQL.
- **Present one product:** the public site should explain workflows, not the order features shipped.

## Required Scope

All areas below are part of the release commitment. The implementation plan should stage them into
reviewable phases; it should not bury correctness repairs inside large file moves. If sizing reveals
a conflict, bring back an explicit scope change rather than silently demoting acceptance criteria.

### 1. Complete Record Actions And Rebalance Detail

Work-item detail should be the place to understand, correct, and discuss one record.

Requirements:

- Show identity, named project context, readable description, status, assignee, milestone, cycle,
  due date, estimate, urgent dependency signals, and a compact watch action without opening an editor.
- Add due-date and estimate editing/clearing through the existing authorized update capability.
  Retain calendar validation and non-negative integer points; zero is an estimate, not missing data.
- Open the description/details form through an explicit Edit action. Keep status transition available
  near the summary as its existing separate command, with unchanged permission rules.
- Show the current parent as context; disclose candidate search through Set parent or Change parent.
  Keep child progress compact, expandable, and linked to the exact direct-child list.
- Provide reachable local navigation to discussion, files, dependencies, and history. Disclose
  relationship creation, watcher lists, and history rather than making them mandatory reading steps.
- Preserve file progress, retry, capacity, removal confirmation, archive restrictions, and Files links.
- Preserve source/format baselines, preview fidelity, explicit mentions, no-ops, and independent
  description/comment drafts when introducing disclosure or extracting feature state.

Acceptance:

- A contributor follows an unestimated-cycle signal, enters an estimate on detail, returns to the
  same review, and sees the item leave that group when the live review reloads.
- An authorized user can change or clear one due date without using bulk mode.
- Reading or replying does not require passing through open parent search and a duplicate source
  editor; status, discussion, and files remain directly reachable on desktop and mobile.

### 2. Protect Unsaved Work And Context Changes

Use a consistent stay/discard confirmation rather than introducing draft persistence in this release.

Requirements:

- Protect changed detail fields/descriptions, new comments and explicit recipients, comment edits,
  work-creation forms, and report narrative drafts against meaningful departure from their baseline.
- Cover global navigation, parent/child/dependency links, Quick Find jumps, same-component record
  changes, browser back/forward, and actor changes. A route-destruction guard alone is insufficient.
- Obtain the decision before resetting forms, changing actor context, or allowing earlier-context
  requests to populate the next screen. Stay retains source, format, selections, and the current actor.
- Clean forms and preview-only changes do not prompt. Reverting values to their baseline clears the
  warning; explicit cancellation/discard has one predictable outcome, not repeated confirmations.
- Protect report narrative independently of generated evidence. A refreshed evidence panel must not
  silently replace authored text or imply it was server-saved.
- Do not treat discard as cancellation of a submitted server mutation. Prevent affected in-app
  context changes while submission is unresolved; preserve failed drafts and existing stale guards.
- Use the browser's native unload warning where available for changed unsaved work on reload/close.
  Do not promise recovery from crashes, forced termination, or browsers that suppress that warning.
- Keep temporary state actor/workspace/record scoped; do not store authored content in URLs or logs.

Acceptance:

- A changed description and a separate comment survive each attempted departure when Stay is chosen.
  Discard switches context without carrying either draft into another actor or record.
- Creation and report narrative use the same decision semantics. Successful saves establish a clean
  baseline, while failures retain the draft and remain protected.

### 3. Preserve Origin And Relevant Landing Context

Requirements:

- Extend safe local-return behavior to closeout/results, dependencies, parent/child inspection,
  Quick Find, and creation success. Preserve originating work filters, sort, page, and page size.
- Carry a bounded original origin plus immediate record context, not recursively nested return URLs
  or an indefinitely growing navigation stack. Existing valid return links remain usable.
- Preserve recognized section fragments and Planning subviews. Use destination-specific return
  labels where known, with a safe fallback for invalid, unavailable, or unauthorized destinations.
- Reject external/protocol-relative return targets and malformed or recursive payloads. Return
  metadata never substitutes for destination authorization.
- Land mention/comment notifications at the identified comment when available, otherwise discussion.
  Resolve deleted or missing comments to the readable discussion area without exposing deleted source.
- Keep Files targeting, same-record fragment activation, focus restoration, and lazy-section loading
  reliable. New section targets must also work on reused detail routes.
- Distinguish the application's return action from browser history; neither should require repeated
  reconstruction of the user's applied query.

Acceptance:

- Filtered Work page 3 -> parent -> child -> parent -> Work returns to the original query and page.
- Closeout/result -> work item -> return reaches the originating review/result, not a generic list.
- A mention opens relevant discussion, and a Quick Find attachment opens Files while retaining origin.
- Invalid return parameters cannot navigate outside the application or create a self-return loop.

### 4. Make Planning And Historical Outcomes Clear

Requirements:

- Lead Planning Review with compact health and current execution: active cycle, relevant dates,
  unfinished scope, populated risks, and closeout access. Separate milestone targets from cycles.
- Replace the large report-promotion block with a contextual Draft report command and Reports link.
  Retain live/snapshot labeling wherever the evidence changes meaning.
- Lead cycle/milestone management with existing records. Disclose creation and per-record editing;
  contributors should not face a dominant disabled administrative form.
- Replace stacks of empty risk categories with one quiet state or an optional category disclosure.
  Offer a useful next step when no active cycle exists.
- Make Outcome at close the primary completed-cycle view. Put current assignments/risks behind an
  explicit Current context disclosure or secondary view, not another full default dashboard.
- Make every stored historical group inspectable through expansion or local pagination, including
  groups larger than eight. Never substitute a current filtered list for missing historical rows.
- Separate historical values from links into current records. Retain historical evidence when a
  record changes or a current destination becomes unavailable.
- For unfinished scope, require an explicit destination choice, including confirmation of unplanned
  work when no eligible cycle exists. Show destination and affected count before submission. Do not
  invent a destination decision when there is no unfinished work to move.
- Provide useful destination-cycle/unplanned-work continuation without calling a broad live query
  the exact historical carryover set.

Acceptance:

- A maintainer closes a cycle with 12 unfinished records and can inspect all 12 afterward, including
  their frozen values after later reassignment or edits.
- Cycle completed, work done at close, canceled work, and current assignments are distinguishable.
- An active-cycle risk and its corrective path are visible before creation forms or report explanation.

### 5. Align Risk Meaning And Query Semantics

Requirements:

- If a count is labeled items/work items, count distinct records. Category membership totals may be
  labeled risk signals, but must not masquerade as unique work. Keep scope-level Over target separate.
- Use cycle, milestone, or neutral copy appropriately. Identify bounded Portfolio attention previews
  as highlighted subsets, with exact totals only where a complete count exists.
- Add estimate state to project/workspace work discovery: Any, Unestimated, and Estimated. Missing
  means `estimatePoints === null`; zero belongs to Estimated. Unestimated-risk links also retain the
  applicable project/cycle/milestone and open-work predicates.
- Carry that query field through validation, persistence predicates, forms, URL reload/history,
  stable-key chips, saved/pinned views, copy/return links, and full-filter CSV export. Page state remains
  separate from a saved query. Do not add estimate mutation to bulk triage as incidental scope.
- Publish a current-query compatibility policy covering every supported field, including risk,
  hierarchy, and exact-parent fields; make deliberate current/snapshot differences reviewable.
- Keep risk evaluation and date windows consistent across My Work, Planning, and scoped reviews,
  including an explicit clock/UTC-day policy and DST boundary tests. Do not change health thresholds
  merely to make old demo dates appear healthy.
- Call done-plus-canceled child work Closed, with Done and Canceled distinguishable. Label parent
  estimate and child estimate total separately; both records may contribute independently to cycle
  scope. Containment neither changes status nor creates a dependency or automatic scheduling rollup.

Acceptance:

- One record matching three categories is not presented as three distinct work items.
- With unchanged data and the same evaluation date, unestimated drill-down matches its live group;
  zero-point work is excluded and all applied criteria are visible/removable.
- A parent with one done and one canceled child does not imply two delivered children.
- Old saved queries and historical snapshots retain their documented interpretation.

### 6. Consolidate Discovery, Portfolio, And Navigation

Requirements:

- Derive saved-view feedback from the applied canonical filter/sort query and the explicitly opened
  view, not just an opener selection or an old success message. Show named, Modified, or Custom state.
  Page/page-size changes alone do not modify a saved query; opening a view retains default page rules.
- Give pinned shortcuts and the opener one production feedback path. Confirm successful result loading
  before announcing updated results. Do not imply a shared saved definition changed without Update.
- Put range, total, page size, and compact navigation near results; retain bottom navigation for long
  pages. Keep visible-page bulk selection explicit and clearing understandable/reachable on mobile.
- Repair Portfolio at its actual container width, including child/control clipping. Prioritize project,
  health/top reason, current planning context, report freshness, and one useful next action per row.
  Disclose secondary metrics/actions instead of hiding them accidentally or expanding everything.
- Support a compact project-name lookup and client-side health/freshness filtering over the complete
  returned project comparison. Do not introduce a new saved-portfolio-query system or dashboard.
- Give cycle, milestone review, and closeout routes visible Planning ownership without changing URLs.
  Use the shell as primary project identity and compact repeated mobile introductions.
- Keep Workspace Settings in a predictable utility location, preserve readable contributor access,
  and make Projects a searchable directory with creation behind an explicit command.
- Make known work-item project context available to Quick Find's project destinations.
- Keep Quick Find a bounded jump surface. Offer useful refinement when a group overflows; provide
  View all only where the destination implements equivalent search semantics. Distinguish filenames
  from file-content search and keep snippets escaped, not a second Markdown renderer.
- Retain the Quick Find query in memory for successive inspection within the same actor/workspace,
  with a clear reset and refreshed results when reopened. Clear it on identity changes and reload;
  do not introduce persistent search history or silently reopen the dialog after navigation.

Acceptance:

- Opening then modifying a saved view never implies that its stored query changed; project and
  workspace views behave consistently and still obey personal/shared permissions.
- A 100-row page can be navigated without first scrolling to its bottom.
- Portfolio actions fit a constrained desktop container and remain reachable at 390px.
- Quick Find can inspect two candidates without retyping, while actor changes erase prior search state.

### 7. Repair Authoritative State And Concurrent Commands

Requirements:

- Derive reused project/record route identities reactively, including inherited parameters. Cover
  shell, home, Planning, milestone/cycle review, and affected auxiliary data, not just work-item detail.
- Give loads and mutations explicit workspace/actor/project/record ownership. Earlier-context primary
  or auxiliary responses cannot replace current content, options, views, messages, or drafts.
- Enforce nonoverlapping planned/active cycle schedules under concurrent create, update, and
  reactivation, preserving existing inclusive date and lifecycle exceptions.
- Validate status/board changes and generic cycle edits against authoritative locked or conditionally
  updated state. Align generic cycle mutations with closeout so competing operations cannot bypass
  lifecycle rules or record an invented previous state.
- Define and test lock order across affected project, cycle, work, hierarchy, and attachment paths.
  Preserve atomic command state/activity/notifications and closeout evidence, with controlled conflict
  errors and no accidental nested transactions.
- Make required transaction/consistent-read capabilities explicit for the command/read paths being
  consolidated. Production construction must not silently choose a weaker nontransactional fallback.
- If enforcement requires a database constraint, detect existing violations and provide controlled
  remediation guidance; never silently reschedule/delete working cycles to make an upgrade pass.

Acceptance:

- Real router tests reuse project A -> B and milestone A -> B; delayed old responses have no effects.
- Synchronized conflicting schedule mutations cannot both persist. Competing closeout/cycle and
  status/board operations preserve valid lifecycle, order, previous-state activity, and side effects.
- Existing parent, comment, attachment, no-op, archived, and duplicate-closeout guarantees remain green.

### 8. Align Transport Policy And Reduce Measured Read Costs

Requirements:

- Give CSV preview/apply a bounded transport allowance that accounts for JSON envelope/escaping and
  permits valid CSV up to the existing 1 MiB domain limit. Do not broadly raise every JSON route limit.
- Return the established safe JSON error envelope for malformed JSON and oversized transport requests.
  Retain domain row/cell/byte validation and separate attachment raw-binary limits.
- Log rejected requests with safe route/status/timing evidence, never bodies, authored source,
  search text, credentials, or bytes.
- Batch distinct reporter/assignee, milestone, and cycle references for selected work rows. Preserve
  DTOs, stable order, missing/inactive/archived references, ownership, hierarchy, and dependency data.
- Keep page count/window/enrichment inside the existing consistent read context. Export must preserve
  all-filter semantics and the 10,000-row guard without per-record reference lookup fan-out.
- Target at most 20 SQL statements, including transaction control, for the representative 100-row
  project and workspace page fixtures with populated references. Query count must not grow by four
  lookups per row across 10/25/100-row pages. Record actual counts, not just elapsed time.
- Select bounded My Work/Planning/Portfolio previews before full DTO enrichment; use narrow shared
  evaluation context for exact aggregate facts and avoid repeated complete review hydration.
  Batch Portfolio reference reads rather than issuing metadata requests separately for every project.
- Measure complete page/export/aggregate paths for queries, enriched rows, payload size, and local
  latency. Complete boards and immutable evidence remain intentionally complete; no silent caps.

Acceptance:

- A valid CSV above the current default parser limit and near the domain byte bound reaches validation.
  Escaping-heavy, oversized, and malformed HTTP inputs produce deliberate JSON errors.
- Project/workspace page query budgets pass without weakening exact counts or transaction coherence.
- An eight-row dashboard preview does not fully enrich thousands of rows; aggregate totals remain
  exact and endpoint evidence identifies remaining scaling limits without claiming hosted SLAs.

### 9. Give Production Behavior Clear Owners

Requirements:

- Harden and adopt shared saved-view orchestration in both list pages, plus shared stable-key filter
  presentation. Remove the superseded live duplicates and orphan alternatives, not just their tests.
- Give detail read/edit, discussion, relationships, watcher/history refresh, and Planning management
  focused feature-local owners. Keep one context coordinator and separate persisted state from drafts.
- Extract batch hydration/query ownership first, then work/hierarchy/board/bulk/activity responsibilities
  as correctness changes touch them. A compatibility facade may remain; unrelated implementations
  must no longer be interleaved merely because callers use the same facade.
- Use focused domain API clients for touched/new feature state; keep legacy forwarding explicit until
  its consumers migrate. Do not grow a second facade or introduce a global state framework.
- Centralize safe test resource ownership/cleanup and split fixtures or named seed scenarios needed
  for the release journeys. Keep stable IDs import-safe and demo seeding separate from test setup.
- Add a current developer/contribution guide, linked from README, naming real ownership paths,
  transaction/snapshot/query invariants, API placement, and safe verification. Correct archived-doc
  directory labels. Pattern notes remain destination-neutral.

Acceptance:

- A saved-view change reaches both production pages through one owner. Integration tests prove actual
  use, including permissions, pinning, query updates, errors, and actor/project changes.
- A discussion, planning-field, or lifecycle change has a focused owner and cannot clobber unrelated
  drafts or start another transaction inside an existing one.
- No extraction is called complete while only an unused scaffold has been tested.

### 10. Make Verification Safe And Toolchain Risk Actionable

Requirements:

- Provide one documented complete verification entry point and focused variants that provision or
  require an explicitly identified disposable database, allocate compatible ports/proxy settings,
  own temporary marked storage, and clean up on success, failure, and interruption.
- Destructive browser setup must refuse an ordinary configured database without explicit disposable
  identity. Localhost and skip-reset flags are not proof of safety. Preserve intentional prepared-test
  and CI-service modes with explicit ownership; never migrate/reset/reseed working data by default.
- Prove two isolated invocations can use nondefault ports consistently and never remove each other's
  resources. Keep editor-only verification independent of PostgreSQL.
- Deliberately cover API test/support and E2E code in lint/typecheck gates. Retain clean-checkout test
  resolution, native editor checks, font-sensitive layout regression, and compiled-preview coverage.
- Investigate compatible development-toolchain remediation as separately reviewable work. Preserve
  production auditing and report full auditing independently; do not use force fixes or broad overrides.
- Any remaining development advisory needs an affected dependency path/command, exposure assessment,
  mitigation, accountable repository-maintainer owner, and expiry no later than v0.3.1 or 30 days after
  v0.3.0, whichever comes first. Review exceptions as a gate; no indefinite blanket acceptance.
- Verify migration/schema tooling, historical preservation, editor typing/undo/composition, lazy
  loading, all runners, and production preview after any toolchain change.

Acceptance:

- Fresh-checkout verification requires no ad hoc environment assembly and cannot silently reset the
  user's normal local database or attachment store. Cleanup removes only resources owned by that run.
- The release either remediates development findings or records individually bounded exceptions;
  a clean production-only audit is never described as a clean whole-repository audit.

### 11. Present One Product And Working Local Setup

Requirements:

- Consolidate the public site into four workflows: Find the next action; Shape and deliver work;
  Plan and review delivery; Explain decisions and share status. Use one outcome and two or three
  supporting points per group, not one card per feature.
- Keep Worktrail as the H1, durable product/reference positioning, source/local-run actions, one
  compact audience explanation, and a compact current-release link. Remove duplicated Baseline and
  Operations inventories; keep five concise architecture responsibilities with direct resource links.
- Retain three prominent boundaries: local reference identity, single-instance local operating model,
  and bounded capabilities including no malware scanning. Link detailed limitations rather than
  reproducing a roadmap of omissions. Production-shaped must not imply production-ready.
- Show at most two complementary product proof points captured after application consolidation.
  Provide legible phone evidence and full-size originals, truthful captions, stable dimensions, and
  descriptive alternatives. Do not rely on an obscured board background as the only demonstration.
- Publish a complete development trial: prerequisites, clone/directory, install, database startup,
  migrate/seed, startup, application URL, and setup guidance. Keep production preview a separate path
  with the same explicit absolute attachment root during seeding and runtime.
- Validate both fresh setup paths independently through deep links and seeded attachment download.
  Keep upgrade/backup instructions separate from disposable demo initialization.
- Add reliable anchor offsets, skip navigation, visible keyboard focus, reduced-motion behavior, and
  responsive containment without using clipped overflow to conceal layout defects.
- Keep the static Pages deployment approach. Add lightweight asset, fragment, local repository-link,
  and release-identity checks. Use verified deployed URLs for canonical/share metadata; do not publish
  speculative release links or equate repository-target checks with remote availability.
- Update README, OpenAPI/CSV guidance where behavior changes, release/pattern notes, current developer
  guidance, and root/workspace/lockfile/API release identity consistently to `0.3.0` at finalization.

Acceptance:

- A visitor understands the four workflows, local availability, reference value, and trial path
  without reading sprint history. A new feature normally fits an existing workflow group.
- Fresh development and preview instructions each produce a usable app with downloadable seeded files.
- Site screenshots, release identity, claims, resources, and share metadata agree with the delivered
  baseline. Publication/deployed checks remain distinct from local implementation readiness.

## Compatibility And Safety

- Preserve established routes and recognized query parameters; additions must not silently drop
  current filters or reinterpret old saved views. Saved queries remain independent of page position.
- Preserve personal/shared view ownership, contributor capabilities, workspace isolation, and archived
  read-only behavior at the API as well as in disclosed UI controls.
- Preserve complete board ordering and explicit visible-ID bulk semantics; do not broaden selection
  to all matching pages or truncate board columns during performance work.
- Preserve two-level hierarchy and independent status, estimates, cycle/milestone assignment, and
  dependency rules. UI terminology changes do not change stored lifecycle values.
- Preserve authored source/format, normalization and grandfathering, complete literal fallback,
  allowlisted rendering, explicit mentions, no-op timestamps, and deletion tombstones.
- Keep stored report/closeout parsers explicitly versioned. Current live query evolution must not
  silently expand or normalize v1 schemas. If new snapshot production needs a richer query shape,
  design an additive version with v1 readers/tests; do not rewrite existing evidence or fabricate
  fields. Existing published sharing and closeout records remain readable and complete.
- Use additive, preservation-tested migrations where required. Backups coordinate PostgreSQL metadata
  and attachment bytes. Never use reset/reseed as an upgrade or automatic data-repair strategy.
- Local actor headers and local attachment storage remain demonstrations, not production identity or
  managed deployment. Attachment compensation is not a cross-store atomicity guarantee.

## Release Walkthroughs And Verification

Use fixtures that exercise the gaps, not only the smallest deterministic demo.

| Walkthrough | Required Evidence |
| --- | --- |
| Contributor resolves a cycle risk | Exact unestimated list, estimate/due-date edit and clearing, return to same review, refreshed live evidence |
| Author changes context | Stay/discard for independent description/comment/create/report drafts across route reuse, history, Quick Find, and actor changes |
| User follows linked work | Page/query preserved through parent-child-parent; dependencies and result links retain bounded origins |
| Member responds to a notification | Relevant comment/discussion landing, deleted-target fallback, useful return and focus |
| Maintainer closes 12 unfinished records | Deliberate destination, every frozen row inspectable after later changes, current context distinct |
| Reviewer interprets risk/progress | Overlapping categories, scope-level conditions, zero estimates, done/canceled children, independent estimates |
| User modifies a named view | Named/Modified/Custom feedback, stable-key chips, pinned parity, explicit shared update, top navigation on 100-row pages |
| Reviewer compares 15 active projects | Container fit, reachable actions, preview bounds, name/health/freshness refinement, mobile scan hierarchy |
| Reused route or actor receives delayed data | Real router reuse plus delayed primary/options/saved-view responses cannot affect current state |
| Concurrent writers compete | Synchronized schedule create/update/reactivate, cycle edit versus closeout, status/board races and side-effect consistency |
| Import crosses the HTTP boundary | Valid input above 100 kB, near 1 MiB CSV with escaping, malformed JSON, oversized transport, unchanged binary limits |
| Discovery grows | 10/25/100-row query counts, export parity, representative aggregate endpoint queries/rows/payload/timing |
| Developer verifies a fresh checkout | No prebuilt contracts needed for tests, owned data/ports/proxy, interruption cleanup, no working-data changes |
| Visitor tries the product | Independent documented setup paths, deep links, byte-correct seeded download, site asset/link/share checks |

Run lint, typecheck, package tests, production build, the full application browser suite, standalone
editor suite, compiled preview, migration/preservation tests, concurrency/query-budget evidence,
dependency checks, and static-site checks on the final versioned tree. Retries must not conceal
reproducible failures. Keep existing initial/style budgets unchanged and without warnings; inspect
the lazy dependency graph after state/client extraction, not just the total bundle size.

Check 320px/390px phones, 768px/1024px compact widths, 1440px/wider desktops, and short landscape
viewports. Test actual container/control clipping as well as document overflow, long names, enlarged
font metrics, focus order, active/selected announcements, and work-list header/row/cell semantics.
Include actual browser zoom and a screen-reader walkthrough. Synthetic composition and CSS-width
reflow remain useful but do not establish real OS IME, screen-reader, or browser-chrome zoom passes.
Record manual results or gaps explicitly; do not infer user UAT from automated checks.

Remote CI and post-publication Pages/share checks should be recorded separately. No merge, tag,
publication, or deployment is authorized merely by completing local implementation phases.

## Scope Boundaries And Deferred Work

The audits contain more opportunities than this release should turn into standalone projects.

| Opportunity | v0.3.0 Disposition |
| --- | --- |
| Whole-service or whole-repository rewrite | Extract touched ownership boundaries; retain honest compatibility facades |
| Complete fixture/seed framework or every large spec split | Centralize ownership and split release-relevant scenarios; defer unrelated migrations |
| New notification grouping/filter system | Prioritize relevant discussion landing and return behavior |
| Dedicated result pages for every search group | Provide refinement; preserve real work-item continuation only |
| Persistent/local/server draft recovery | Stay/discard and native unload warning only |
| Attachment reconciliation and automated repair | Deferred; preserve integrity, compensation, backup, and local-storage constraints |
| Wholesale test-runner/framework migration | Not a prerequisite; compatible updates or bounded advisory-specific exceptions |
| New charts, roadmaps, deployment infrastructure, or cloud auth | Deferred feature/platform decisions |

## Success And Release Criteria

v0.3.0 is ready for release when:

- the principal find/read/act/return journeys work without avoidable draft loss or context rebuilding;
- a contributor can correct the planning facts surfaced by existing risk reviews;
- complete closeout evidence remains independently inspectable after current work changes;
- risk counts, completion language, applied queries, saved-view identity, and drill-downs agree;
- detail, Planning, Portfolio, and the shell prioritize the user's task over administration;
- reused routes, delayed responses, and concurrent writes cannot produce the audited invalid states;
- documented import policy works at the HTTP boundary with safe structured errors;
- reference hydration meets the stated query budget and aggregate previews avoid unnecessary full
  enrichment, with measured evidence and preserved exact/complete semantics;
- shared helpers own real production behavior and touched commands have explicit transaction context;
- a fresh-checkout verification command isolates resources and cannot silently reset normal local data;
- dependencies have a clean production result plus remediated or individually bounded development risk;
- documentation and the shorter public site describe one accurate `0.3.0` baseline and usable local paths;
- final automated gates pass, accessibility/manual evidence is explicit, and phase-owned resources are
  cleaned up without altering working data or unrelated processes.

No new analytics system is needed. Judge utility through these completed journeys, query/ownership
evidence, and release walkthroughs rather than the number of controls or abstractions introduced.

## Resolved Design Decisions

The [technical design](technical-design.md) and Phase 0 inventory close the implementation choices:

- One baseline-aware departure coordinator covers route exit/reuse, actor changes, pending writes,
  and independently registered editors. Navigation approval is not an immediate draft reset.
- Safe `returnUrl` origin plus one `returnTo` record survives reload without recursively nesting
  context. Recognized query/page/subview/section state remains explicit and bounded.
- Transaction-scoped project advisory coordination and ordered authoritative row locks protect
  affected lifecycle commands. Required transaction capabilities replace silent production fallbacks.
- Freeze existing v1 query/health schemas. New v2 report/closeout production is necessary because
  precise unestimated queries occur in the cycle health evidence both snapshot producers capture.
  Old versions remain readable and are never rewritten from current state.
- Investigate compatible same-line toolchain fixes against actual paths and maintainer metadata in
  Phase 3; larger migrations require a separate decision. Remaining development risk must be owned,
  advisory-specific, mitigated, and expiring, not inferred harmless from production-only auditing.
- The verification runner provisions its own Docker or explicit service-mode database, validates
  run/database/storage markers before mutation, generates the selected-port proxy, and cleans up
  only resources it owns. Editor/site modes remain database-independent.

Deliberate unfinished-work destination selection, complete local snapshot inspection, actual shared
saved-view adoption, and identity-scoped in-memory Quick Find query retention remain the product
defaults. No additional product decision blocks Phase 1.
