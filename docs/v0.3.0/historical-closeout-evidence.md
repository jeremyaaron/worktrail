# Historical Outcome And Deliberate Closeout

Working-branch capability for v0.3.0 Phase 17, not a release or deployment. See the
[implementation plan](implementation-plan.md#phase-17-historical-outcome-and-deliberate-closeout)
and [verification notes](verification-notes.md#phase-17-historical-outcome-and-deliberate-closeout).

## Frozen Evidence First

Completed cycles with closeout records lead with frozen project/cycle name, goal/date range,
closing actor/time, snapshot version, health/reasons, all counts/estimate totals and destination.
The closing actor's name comes from the snapshot, not today's member DTO. Done at close and
Canceled at close are distinct from the completed cycle lifecycle and unfinished carried work.

Each full stored group has independent ten-row pagination, a visible range/total, and Show all.
Rows beyond eight/ten remain inspectable without live-list requests. Current record links and the
Current destination cycle link are explicit, not a claim that today's assignments equal the frozen
carryover set. Record returns target Outcome at close; destination-cycle returns are constrained to
a different same-project cycle outcome. A missing current record shows the existing controlled
detail error plus a safe outcome return, leaving the historical row intact.

Current context is collapsed initially and mounts its live component tree on request. It contains
today's identity, assignments, progress and risk facts. The existing authorized aggregate endpoint
still supplies both current data and closeout evidence in one read; no deferred database endpoint
was introduced. Legacy completed cycles without closeout records retain honest current-only copy.

## Decisions And Sharing

Unfinished work starts with an unselected sentinel, not an automatically selected planned cycle or
null/Unplanned. The affected count and chosen destination appear before submission. A destination
must be explicitly selected even if Unplanned is the sole option. Empty/terminal-only cycles omit
the choice and preserve the existing null request/none result. Duplicate pending submissions and
pending refresh are blocked; failures retain choices, while conflicts require a new preview and
choice. Existing server authorization, locked eligibility, immutable replay and conflicts are unchanged.

Copy/download Markdown includes every stored group and a complete literal JSON evidence block,
with arbitrary authored punctuation/HTML kept inert. It does not fetch current records or export
only a visible page. Print expands full groups before rendering and hides live context/actions,
then restores screen pagination. Project shell navigation/current identity is also omitted from print,
so today's renamed project cannot precede the frozen identity. Version 1 and 2 remain supported
without upgrading/replacing history.
Sharing is client-side over an already authorized review response, not a new public export endpoint.

## Named Product Walkthrough

After a clean supported local seed, open Closeout Lab's Cycles view:

- `Historical carryover: 12 unfinished (v1)`:
  `/projects/10000000-0000-4000-8000-000000000205/cycles/10000000-0000-4000-8000-000000000376`.
- `Historical carryover: 12 unfinished (v2)`:
  `/projects/10000000-0000-4000-8000-000000000205/cycles/10000000-0000-4000-8000-000000000377`.

Both outcomes record twelve original ready commitments (LAB-6 through LAB-17), two points each,
assigned to Morgan Maintainer. Today's records have revised titles, changed statuses/estimates,
Casey Contributor as assignee, and either no cycle or a later cycle. The v2 destination's frozen
name is Carryover follow-through; its current name is Renamed follow-through. Seed history is
insert-only on conflict rather than rewritten on rerun. The original five-item active Closeout
Demonstration and its planned Follow-up Validation destination remain separate.

Deterministic tests do not depend on this walkthrough's records. Parser/component fixtures construct
complete independent v1/v2 groups. Browser acceptance creates its own twelve-item cycle, executes
the real v2 closeout, changes current records through authorized APIs, compares persisted snapshots,
and uses explicit read-boundary fixtures for legacy presentation and an unavailable current record.
Those two browser fixtures are not evidence of a v1-producing command or an actual database deletion.

## Verification Boundaries

Focused checks cover affected closeout/review owners, missing-record returns, immutable v1/v2 parsing,
real command authorization/conflict/replay, demo insertion, complete exports/print, native selection,
pending/failure/context ownership, desktop/mobile containment and outcome return focus. Browser checks
use one worker, no retries, unchanged deadlines and disposable owned resources. This is not a full
assistive-device audit, historical migration, one-click cloud deployment or release-wide verification.
Package versions remain 0.2.9 until Phase 21.

Acceptance passed 29 focused Angular cases, 25 selected API cases and three distinct browser journeys
across the recorded clean runs. The final production build is warning-free: 397.84 kB initial size
(109.93 kB estimated transfer), 155 initial inputs and 20 lazy page entries, with no heavy
detail/Planning/editor/Markdown/CDK input in the initial graph. Desktop/compact/mobile screenshots
and the final print screenshot were inspected. Broader regression and release gates remain later work.
