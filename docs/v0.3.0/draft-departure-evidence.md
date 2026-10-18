# Phase 12: Draft Departure Protection

## Ownership And Decisions

`DraftDepartureCoordinator` owns registrations, primitive context keys, integer revisions, pending
predicates and reset callbacks. It does not retain authored values. Each editor's `DraftTracker` owns
its normalized value baseline locally. Equality follows existing persistence behavior: title/report
narrative trimming, authored line-ending normalization without trimming source, source/format pairs,
sorted label/recipient sets and nullable integer estimates (including zero). Invalid numeric values
are not canonicalized into a blank baseline; native cleared number controls safely produce null.

| Production Participant | Local Baseline / Pending State |
| --- | --- |
| Detail fields/description/labels | Accepted server fields; field save |
| New comment and explicit recipients | Empty default-format source and empty recipients; comment post |
| Inline comment edit | Original source/format; edit/delete command |
| Other detail commands | No authored draft; transition/watch/relationship command |
| Creation | Initialized project/parent/cycle defaults and fields; create command |
| Report narrative | First generated narrative or accepted publication; publication command |

Saving a participant updates only its baseline. Comment/detail background refreshes do not mark another
draft saved. Report evidence refresh does not reset authored narrative. Preview/disclosure/selection
alone is not meaningful; restoring persisted values is clean even when `form.dirty` remains true.

Editable route declarations install deactivation and reused-editor activation guards with an explicit
`always` rerun policy. The destination's inherited project/record identity is compared with registered
owners. Creation parent/cycle seeds matter; fragments and safe return-context changes do not depart.
Guards share one navigation-ID/revision decision. Discard authorizes departure, but old reset callbacks
run only after `NavigationEnd`, never on a proposed parameter emission. Later guard/resolver/lazy-load
failure expires approval without clearing the source. Owner disposal/context/revision changes prevent
captured callbacks from resetting a new editor. Approved commits temporarily make editor hosts inert.
Still-mounted revisions are revalidated on form changes, signal updates and router progress, including
after initial approval. Angular 20.3.33's public `Navigation.abort()` rejects stale consent before
activation, without replaying a URL. Real guards cover a new revision during a later asynchronous guard.

`App.selectMember()` asks before the user-service/storage commit and keeps the selector at its committed
value. Stay restores selector focus. Creation project selection similarly restores the old value before
asking, including repeated attempts after Stay. Explicit detail discard, inline cancel/switch/delete,
and Create another use scoped participant tokens. Accepted local resets have one outcome, not a second
prompt. Bootstrap member reconciliation remains an unprompted low-level commit before editing.

While affected writes are unresolved, departures and actor/local resets are rejected with an operational
status; Discard does not imply server mutation cancellation. Creation/publication authoring controls
are disabled while submitted. Failed writes retain drafts and release busy state. Successful publication
establishes its baseline before navigating to the published report.

## Interaction And Loading

The confirmation service dynamically imports the plain CDK Stay/Discard dialog. Stay is the default
focus; Escape/backdrop means Stay. Captured focus and text selection are restored on rejected attempts
and later navigation failure. Dialog copy names categories, never authored text. Simultaneous requests
are rejected rather than queued, and no `NavigationStart` cancellation/replay loop exists.

Quick Find no longer closes through history navigation or before a routing result. It awaits successful
navigation, preserving query, active option and focus on Stay. The shell also ignores its launcher while
a departure decision/commit is active. Source/format, mentions and previews survive a nested decision.

The native `beforeunload` listener is conditional on meaningful drafts or pending writes and is disposed
with the last owner. It supplies no custom warning text or save promise. Chromium browser checks verify
dismissing a native close warning keeps the page/draft; automated CDP reload cancellation is not claimed
as reliable evidence. Mobile shutdown, crashes and recovery are not guaranteed. No draft autosave or
browser/server persistence was introduced.

Final production initial size is 397.79 kB (109.94 kB estimated transfer), under unchanged warning/error
thresholds. The static initial graph has 155 inputs and no CDK, confirmation UI, heavy detail/Planning/
report/creation, Markdown or editor inputs. All 20 page entry points remain lazy. Desktop 1280px and
320px confirmation screenshots were inspected; text/actions fit without horizontal overflow.

## Verification

Coordinator tests use real activation/deactivation/history transitions, rejected guards, resolver
errors, revision changes, disposed/reused owners, pending submissions and a native-listener harness.
Existing production page specs additionally verify independent comment/detail baselines, explicit
Stay/reset behavior, reverted inline edits, report evidence preservation and post-creation reset safety.

Final focused frontend acceptance passed 263 cases, lint, development template/type checking and
production build. All three new departure browser flows passed together. Additional selected coverage includes
description creation/reuse, comment edit/delete/failure, Quick Find, actor/storage and native unload
decisions, in-form project changes, pending create and failed/successful report publication. Commands,
overlapping counts, diagnostic failures, reuse of unchanged evidence and cleanup are recorded under
Phase 12 in [verification notes](verification-notes.md).

API/domain/contract/resource/editor-only/site suites and remote/release-wide verification were not
rerun for this frontend phase. Source protection is not authentication, authorization, autosave, crash
recovery or cancellation of a submitted server transaction. Phase 13 remains separate presentation work.
