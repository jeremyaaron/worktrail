# Shared Saved Views And Work Lists

Implemented for v0.3.0 Phase 15 on October 17, 2026. This describes working-branch capability,
not a release or deployment. See the [design](technical-design.md#work-lists-and-saved-views) and
[verification notes](verification-notes.md#phase-15-shared-saved-views-and-work-lists).

## Production Ownership

Both project Work and workspace Work Items use a page-local `SavedViewsStore`; their former saved-view
API subscriptions, collection mutation helpers and duplicate filter-label alternatives are removed.
Pages supply the actual committed actor, project/context and applied query. The store checks active
membership, workspace/scope identity, personal ownership and shared manager roles. Project capabilities
also require a loaded, active project. Read-only shared/archived views remain openable.

Superseded reads are cancelled. Reset/destruction invalidate loads and all CRUD/pin callbacks, including
A -> B -> A identity changes. Only one mutation is pending per store. Pending/error state is explicit;
failed create/rename retains its name, unrelated pin/query writes retain other rename drafts, and
load failure exposes Retry without pretending the collection is empty. Cancellation of a subscription
does not imply cancellation of a submitted server transaction.

## Applied Identity And Feedback

An explicitly opened accessible view supplies an ID and canonical accepted definition. Named means
the applied filters/sort equal that definition; Modified means they differ; Custom means no accessible
opened view. Equal definitions do not implicitly select a different view. Pending form edits and
page/page-size changes are not definition changes. Rename/pin preserve identity, explicit Update query
accepts a new baseline, and deletion/context loss clears selection. Applying filters never writes a
saved definition automatically. Pinned and chooser opening use the same committed navigation path,
including reopening an already-current URL.

`WorkListQueryStore` owns the latest matching successful result summary. Beginning a new load clears
old confirmation; failed or obsolete loads cannot announce updated results. The toolbar displays
applied identity separately, so a named query can be selected while its results are still loading.
Keyed chip descriptors preserve/removably represent every applicable query field, including estimate,
work risk, hierarchy and exact parent, without English-label parsing. Existing URL/copy/export codecs
remain authoritative.

## Result Interaction

The compact top range/total, page-size and previous/next controls and bottom numbered pager use the
same page metadata and commands. Page-size options reflect accepted state even when a pager mounts
after loading or empty results. The top control remains available for an empty result.

Project bulk selection is still explicit visible IDs, never all matching work. Page/query/context
changes announce selection clearing; pending bulk writes disable selection and reject non-visible IDs.
Desktop results expose table/row/header/cell semantics and selected state; mobile cards expose their
own select-all and item controls. Pinned shortcuts expose their opened state.

## Verification

The affected Angular selection covers both real production pages, shared stores, toolbar/pins,
pagination/results/chips and all query codecs/parity fixtures. It includes delayed loads and each
mutation after context reset/destruction, permission denial/loss, rename drafts, canonical state,
latest successful feedback, every-field view/pin/chip round trips and pending/mobile selection.
The clean acceptance run passed 250 cases, frontend lint, production build and initial-graph checks.
Initial size is 397.75 kB (109.92 kB estimated transfer), 155 initial inputs and 20 lazy page entries;
no heavy detail/Planning/Markdown/editor/CDK inputs or budget warnings entered the initial graph.

Five distinct browser journeys passed across focused runs: both-scope 105-row fixtures through
explicit Update/pin/rename/delete and latest-load failure/retry, owner/contributor shared/project views,
and existing query/page/return/export/board behavior. Top/bottom 100-row controls and visible-page bulk
clearing were exercised; mobile selection and screenshots cover 1280px and 320px without page overflow.
The existing workspace table can scroll internally at narrower desktop widths; mobile uses cards.
This is not a full screen-reader or assistive-device audit.

Browser acceptance and cleanup details are recorded in the verification notes. Backend regression,
unrelated editors, Planning and public-site suites are outside this frontend-only change; the release
gate remains separate. Dependencies, budgets, package versions and ordinary working data are unchanged.
