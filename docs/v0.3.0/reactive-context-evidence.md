# Phase 11: Committed Route And Actor Context

## Implementation

The component-local `PageContext` in `apps/web/src/app/core/navigation/page-context.ts` owns inherited
route parameters and workspace/member identity. Constructor snapshots only establish initial state;
ancestor/leaf `paramMap`, query and fragment observables supply subsequent proposed state. Mounted
owners adopt it at `NavigationEnd`, not at an early parameter emission. Cancellation/error does not
clear a draft. Initial activation and committed actor changes need no second navigation.

`CurrentUserService` publishes synchronous committed-actor events after selection/storage changes.
Generation ownership therefore survives actor A -> B -> A even without an intervening effect turn.
A signal effect retains bootstrap reconciliation. Identity does not change for evidence refresh,
fragment-only navigation, or return-URL updates. The owner's component lifetime supplies page kind.

| Owner | Accepted Context Behavior |
| --- | --- |
| Project shell/home | Clear authorized summary; reload inherited project; update section links |
| Planning/settings | Clear project, options, messages, mutation flags and management forms; reload |
| Milestone/cycle review and closeout | Replace inherited project and leaf identity together; clear old review/destination/error |
| Report list/detail/draft | Replace project/report identity; reject old export/publish effects; initialize narrative once per context |
| Project/workspace work lists | Clear results, option/view data, feedback, selection/bulk state; preserve pagination reset semantics |
| Board/import | Clear cards/import source/results and errors before loading the new project/actor |
| Work creation/detail | Reset authorized data and editor defaults on actor/project/item changes; retain existing operation-generation guards |

All 16 touched page owners inject existing focused clients directly, without extending the facade.
The context owner imports no page, Markdown/editor, CDK dialog or Planning feature module. Existing
lazy route declarations and production budgets are unchanged.

## Request And Draft Semantics

- Read/option `guard()` subscriptions are disposed on context changes and owner destruction.
- Submitted writes use `guardMutation()` to reject obsolete success/error effects without implying
  that a server transaction was cancelled. Existing explicit bulk/closeout cancellation remains local
  subscription disposal, not server cancellation.
- `capture()` predicates protect promise success/error/finalization, including report clipboard,
  work-list clipboard/export error bodies, file reads and delayed navigation/focus callbacks.
- In-form creation project changes and workspace project-filter changes dispose their option request
  groups. Rapid A -> B -> A cannot revive the first group's data.
- Parent-query changes replace parent validation without clearing an entered child title/description;
  creation commands additionally retain project/parent operation generations.
- Same-context report evidence generation replaces evidence without resetting narrative values.
- Fragment-only work-list navigation does not reapply the query or clear visible-ID selection.

No new departure guard, Stay/Discard dialog, autosave, unload warning or pending-write departure block
is claimed here. Those remain Phase 12. An accepted navigation can still reset an unsaved editor in
Phase 11; the correctness guarantee is that an unaccepted navigation cannot do so.

## Regression Boundaries

`core/navigation/page-context.spec.ts` exercises real Worktrail lazy routes and real router component
reuse. Parent project changes are distinct from leaf changes. Presentation is overridden in these
owner tests; existing page tests and selected browser flows cover actual templates and permissions.

The suite covers project shell/home links and summary replacement, milestone/cycle/report IDs, report
draft and closeout reuse, detail rejection/commit, delayed ancestor/option/view reads, actor-sensitive
Planning mutations, actor A -> B -> A without effect turns, clipboard completion/finalization, rapid
project option changes, pending pagination normalization and fragment-only navigation. A separate
early-emission harness simulates both navigation cancellation and activation error. Existing detail
tests still deliver obsolete mutation successes/errors and check that current drafts/spinners survive;
obsolete read expectations now verify actual cancellation instead of flushing cancelled HTTP requests.

The report draft page spec also checks that edited title/date/summary/highlights/risks/next steps survive
an evidence refresh while the generated snapshot timestamp changes.

Commands, result counts, diagnostics, resource cleanup and verification limits are recorded under
Phase 11 in [verification notes](verification-notes.md). API/domain tests and release-wide checks are
not repeated for this frontend-only phase.
