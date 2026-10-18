# Execution-First Planning Evidence

Implemented for v0.3.0 Phase 16 on October 17, 2026. This describes working-branch capability,
not a release or deployment. See the [design](technical-design.md#planning-and-historical-outcomes)
and [verification notes](verification-notes.md#phase-16-execution-first-planning).

## Composition And Priority

`ProjectPlanningPageComponent` retains committed project/actor ownership, API orchestration and the
URL-backed Review/Cycles/Milestones subview. `PlanningReviewComponent` and `MilestoneManagerComponent`
are now actual production presenters, not projection-only wrappers. Health, cycle execution and
milestone targets own focused components/styles; unrelated projected page CSS was removed.

Review leads with compact project delivery health and explicitly labeled milestone/work counts,
then active-cycle dates, goal, scope, estimate gaps, readiness and Review/Work/Close actions. Active
cycle health reasons retain exact server query predicates. Upcoming/recent cycles are secondary;
an explicit no-active-cycle state remains visible even when either exists, with unplanned-work and
permission-sensitive management continuations. Reports/Draft report are contextual header commands.

Populated project risks precede separate milestone targets. Needs attention/upcoming/recent-change
previews remain available in compact disclosures. The former stack of zero-risk categories is replaced
by a quiet scope-qualified state, not silently confused with active-cycle estimate risks.

## Management And Lifetime

Cycle/milestone records precede closed creation disclosures and per-record edit disclosures. Read links
remain available to contributors and archived projects without presenting disabled administration.
Archived cycles expose Reactivate rather than an unsupported editor. Completed status is immutable;
existing API lifecycle, overlap and project/role authorization rules remain unchanged.

Independent creation forms remain page-local; record input DOM is keyed by record ID. Accepted writes
to one record do not reset another record's unsaved input. Page-local `PlanningMutationState` instances
hold pending IDs and row-specific errors/messages, separate from creation feedback. Native numeric
cycle targets are normalized before validation, so the number value accessor cannot cause a trim
exception. Failed writes retain inputs; affected controls are disabled while pending and duplicate
submits/overlapping collection reads are rejected within that owner.

Project, summary and collection reads cancel their same-context predecessor. `PageContext` still
invalidates old actor/project reads and rejects obsolete mutation callbacks on context change or
destruction; it does not imply rollback of an already submitted transaction. Context change clears
all local forms/feedback. These management drafts are not persistent, autosaved, or newly registered
with authored-content departure protection.

## Risk And Date Policy

`populatedRiskSections` uses authoritative counts rather than five-row preview lengths in Planning,
cycle and milestone reviews. Unit-aware labels distinguish work items from scope conditions. Project
risk links pass typed queries through the canonical scoped codec, and descriptions use shared
due-soon/staleness constants with UTC scope copy. Date-only cycle/Planning labels format in UTC.
No thresholds, counts, backend predicates, DTOs or historical evidence producers changed.

Cycle unestimated links retain cycle ID, open-work and null-estimate predicates; zero remains estimated.
Over-target is a scope condition, explicitly labeled Open cycle scope rather than pretending a broad
cycle list is a matching work-item subset. Existing bounded detail return/navigation policy is retained.

## Verification And Limits

Focused Angular checks cover the actual page/presentation owners, context guards, collection refreshes,
role/archive/empty/error states, record draft/error isolation, pending serialization, native numeric
targets, canonical query/count policy and exact continuation beyond five previews. Browser journeys
exercise unestimated cycle review -> exact list -> estimate zero -> browser return/reload into the same
refreshed review, alongside cycle/milestone creation/edit/archive/reactivation, delayed failure/retry,
independent drafts, contributor/archive behavior and existing adoption/review/assignment workflows.

The final selection passed 76 Angular cases; five distinct browser journeys passed across the
documented focused runs. Production compilation and initial-graph checks passed without warnings:
397.75 kB initial size (109.93 kB estimated transfer), 155 initial inputs and 20 lazy page entries.
No Planning/detail/editor/Markdown/CDK input entered the initial graph. Dependencies and budgets
remain unchanged; unrelated backend/editor/site suites were intentionally omitted for this phase.

Desktop/mobile screenshots cover execution and both management owners at 1280px and 320px with no
page overflow. Existing native disclosure and form keyboard semantics are retained; this is not a
full assistive-device audit. Historical outcome composition remains Phase 17 work. Package versions
remain 0.2.9; full release verification, publication and deployment are separate actions.
