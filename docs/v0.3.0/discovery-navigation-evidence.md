# Portfolio And Navigation Ergonomics

Working-branch capability for v0.3.0 Phase 18, not a release or deployment. See the
[implementation plan](implementation-plan.md#phase-18-portfolio-and-navigation-ergonomics)
and [verification notes](verification-notes.md#phase-18-portfolio-and-navigation-ergonomics).

## Comparison Before Previews

Portfolio leads with exact workspace summaries followed by the complete active-project comparison.
Each row prioritizes identity, health/top reason, active planning, report freshness and one useful
next action. Details and links discloses secondary counts, remaining reasons and existing destinations.
Risk actions retain the canonical work-query semantics. Calendar-only target/end dates do not shift
when the browser is west of UTC; timestamps retain local presentation.

Name/key, health and freshness filters apply immediately across every returned project row. The
visible/total count identifies their scope; workspace summary counts are not recomputed from the
filtered subset. The separate, initially closed Attention previews disclosure labels bounded rows
as shown counts, not exact category totals. No new endpoint, saved Portfolio query or dashboard was
introduced. Comparison, summary and attention reflow by their actual container width rather than
hiding overflow or relying on a wide viewport.

## Predictable Project Destinations

Projects opens a searchable directory rather than an expanded creation form. New project opens the
form and focuses Name. Pending submission blocks duplicates; failure retains editable values;
accepted creation closes the disclosure, clears directory filters and focuses the created link.
Contributors retain the directory without creation controls. Context guards cancel replaced reads
and prevent obsolete actor responses or write callbacks from replacing the current surface.

Project route metadata selects Planning for milestone, cycle and closeout pages. Compact project
identity does not compete with the page's main heading. Active project/global destinations expose
`aria-current`; Workspace Settings is a named gear utility with contributor-readable access.
The static gear uses installed Lucide artwork and its license without importing the icon runtime
into the initial bundle.

Authorized work-item detail owners publish project context after successful existing reads. The
shell requires the current record and actor/workspace identity. Reloading/replacing/unavailable
details, failed project reads, identity changes and owner destruction clear that context. An old
owner's release callback cannot clear a newer publication. Return URLs are not authorization input.

## Successive Quick Find Inspections

The current actor/workspace retains only query, result type and project-in-preview selection in
memory. Reopening performs a fresh authorized search, not a cached-result read, and resets active
selection. Committed actor/workspace changes and reload erase the session, including rapid identity
round trips. Captured identity prevents an old dialog from restoring another actor's query.

Type and project selectors refine only returned bounded groups. A more specific query can find a
milestone beyond the initial five-row preview; there is no invented non-work View all destination.
Real Work Items continuation carries the query and chosen project. Filenames remain distinct from
file contents and excerpts remain inert text. Existing keyboard activation, repeat Files targeting,
bounded inspection returns and guarded draft departure are retained.

The shell prevents opening during initial actor bootstrap or pending route navigation. Committed
navigation closes the dialog; cancellation/error restores launch availability without dismissing
the current dialog. Lazy launches and search callbacks check generation and identity before applying
their results. A controlled delayed-response browser fixture releases a superseded request only
after the newer result set is visible.

## Verification Boundaries

Focused Angular checks cover the changed Portfolio/directory/shell/Quick Find owners, route metadata,
authorized context, session identity and calendar-date behavior. Browser acceptance creates fifteen
real active projects, checks local filters against the complete API projection, inspects primary and
disclosed controls at a 1600px viewport with a deliberately constrained 760px content container,
and checks 390px reflow. Separate journeys cover deliberate creation/focus, Planning ownership,
contributor Settings, repeated inspection with changed server data, obsolete responses, actor/reload
reset and unavailable detail context. Existing Quick Find/draft/Portfolio journeys remain included.

Checks use owned disposable data/storage/ports, one browser worker and no retries. No backend/schema,
dependency, deadline or budget change is required. Full regression, wider accessibility/UAT and
public-site/setup acceptance remain Phases 19-21; package versions stay 0.2.9 until release finalization.

Acceptance passed 77 selected Angular cases and ten distinct browser journeys. The production build
is warning-free at 401.95 kB initial (112.13 kB estimated transfer), with 157 initial inputs and 20
lazy page entries. The initial graph excludes the Lucide runtime, CDK/dialog and heavy feature/editor
inputs. Desktop, constrained-container, mobile comparison/secondary-links, mobile Planning and
Quick Find screenshots were inspected without text/control overlap. All twelve phase-owned runs
report cleanup, with no owned temporary root, process or container remaining.
