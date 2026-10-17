# Phase 13: Read-First Work-Item Detail

## Production Ownership

The route now composes page-scoped production owners instead of retaining the former monolithic
orchestration beside extracted templates:

| Owner | Responsibility |
| --- | --- |
| `WorkItemDetailStore` | One committed `PageContext`, persisted record, field/source/label draft, project options, status, return target and existing Files generation |
| `WorkItemDiscussionStore` | Independent new/inline comment baselines, source/format, explicit mentions, edit/delete permissions and operation generations |
| `WorkItemRelationshipsStore` | Candidate search, selection, dependency commands, errors and administration disclosure |
| `WorkItemWatchHistoryStore` | Watch state/commands and generation-protected attachment-activity refresh |
| Existing `WorkItemAttachmentsComponent` | File list, upload progress/retry, removal, capacity, integrity and bytes; unchanged ownership |

The page starts the context coordinator once, resets all owners on committed context changes and
disposes registrations with the page. Focused editor/discussion/dependency/watch/history components
consume these owners directly. Persisted facts remain separate from form drafts. Field saves merge
only editable fields and cannot replace newer comments, status or parent context. Comment, dependency
and attachment refreshes do not accept or reset the field draft. The attachment component stays
mounted across opening, saving and cancelling fields.

## Read And Act

Detail opens with its key/title, named project link, readable description, planning facts, status
transition and compact watch state. Edit explicitly reveals authoring; Cancel uses the existing scoped
Stay/Discard decision and restores Edit focus only while its context/owner is current. Successful saves
retain the open editor with an accessible saved status; failures retain values and release busy state.

Estimate uses a number/null control, preserves zero and accepts nonnegative integers within the
PostgreSQL integer field. Empty estimates/dates send null; dates are validated as actual date-only
calendar values without timezone conversion. Incomplete native inputs remain invalid rather than
clearing persisted values. Existing source/format omission, grandfathered legacy content, no-op
timestamps, server authorization and archived restrictions remain unchanged.

Set/Change parent, dependency administration, watchers and history are disclosures. Children expand
from compact totals with Closed = Done + Canceled, an independent Parent estimate and Child total,
and the existing exact `parentKey` list continuation. Discussion, Files, Dependencies and History have
stable IDs and local router links with immediate section scroll/focus. Incoming comment/section
targeting, bounded return parsing and related historical navigation remain Phase 14 work.

## Verification

- Focused frontend acceptance passed 164 Angular cases, source lint, production template/type
  compilation, unchanged style budgets and the static lazy-graph check. Earlier development builds
  also passed. The final run omitted repeating the separate development build: the affected test
  compile and production build both compile the changed owners/templates.
- Final visual inspection caught an extraction artifact in two watcher loading/empty literals. Both
  were corrected and covered by a new regression; the affected detail file then passed 106/106 tests
  and lint. A structured Angular-template check found no remaining implementation-name text in the
  six composed templates. Other suites/build/browser flows were not repeated for that copy-only edit.
- Across targeted runs, all 15 distinct affected application browser flows passed. Runs overlap and
  are not a single full-suite result. They cover the two new read-first/planning/hierarchy journeys,
  descriptions, both comment journeys, archived content, native/actor/Quick Find departure protection,
  exact Files targets, both attachment lifecycles, dependencies, mentions, hierarchy management,
  pagination continuation and the adoption workflow.
- Compiled production preview passed its separate browser check, including deep-link reload, source
  editing/preview, explicit draft discard, archived read-only content, static assets and API 404s.
- Populated 1440px/390px/320px read-first and 1440px/320px expanded-child screenshots were inspected.
  Narrow description editing/preview and production preview were also inspected. Page overflow
  assertions remain at one pixel; no deadline, retry, worker or budget was increased.
- Production initial size remains 397.79 kB (109.95 kB estimated transfer): 155 initial inputs, no
  CDK/dialog/heavy feature/Markdown/editor inputs, and 20 lazy page entry points.

Commands, selected files, diagnostics, run summaries and cleanup are in
[verification notes](verification-notes.md). Backend/domain/contracts/resource/editor-only/site suites
were not repeated for unchanged code. Broader release/remote CI/UAT remain separate. All verification
used owned disposable data, storage, servers and browser resources; ordinary PostgreSQL/storage,
dependencies, package versions and release actions were untouched.
