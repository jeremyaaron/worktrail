# Work Query And Risk Policy

Phase 9 reference. `packages/contracts/src/work-item-query-policy.ts` exhaustively owns live field
scope, encoding, display key and defaults. A new `WorkItemQuery` field without a policy fails typechecking.
This is an internal product contract, not an extracted framework.

## Field Matrix

All omitted filters mean unrestricted except the defaults below. Predicates combine with AND.
Reference IDs are UUIDs at HTTP boundaries; text is trimmed, parent keys uppercase-normalized.
Chip removal uses field keys, never translated text. Paging is separate and never saved.

| Field / Chip Key | Scope | Encoding | Display | Default |
| --- | --- | --- | --- | --- |
| search | Both | Text | Search | Omitted |
| projectId | Workspace | Reference | Project | Omitted |
| status | Both | Enum | Status | Omitted |
| workState | Both | Enum | State | Omitted |
| assigneeId | Both | Reference | Assignee | Omitted |
| assigneeState | Both | Enum | Assignment | Omitted |
| reporterId | Both | Reference | Reporter | Omitted |
| type | Both | Enum | Type | Omitted |
| labelId | Both | Reference | Label | Omitted |
| milestoneId | Both | Reference | Milestone | Omitted |
| cycleId | Both | Reference | Cycle | Omitted |
| priority | Both | Enum | Priority | Omitted |
| dueDateState | Both | Enum | Due date | Omitted |
| estimateState | Both | Enum | Estimate | Omitted |
| blocked | Both | Boolean | Blocked | Omitted |
| dependency | Both | Enum | Dependency | Omitted |
| workRisk | Both | Enum | Risk | Omitted |
| hierarchy | Both | Enum | Work breakdown | Omitted |
| parentKey | Both | Display key | Parent | Omitted |
| archivedProjects | Workspace | Enum | Projects | exclude |
| sort | Both | Enum | Sort | updated_desc |

`estimateState=estimated` selects non-null points, including zero; `unestimated` selects null only.
Neither implies open work. Unestimated-risk links also specify `workState=open` and cycle scope.
`blocked=true` restricts status to blocked. Historical `blocked=false` is retained explicitly but imposes
no status restriction, not exclude-blocked semantics; its chip says Any status. Forms clear conflicting
status/state, hierarchy/parent and member/unassigned choices; HTTP rejects contradictions. Tolerant
URL/form decoding ignores unsupported estimate/hierarchy values and malformed parent keys. Existing
saved-view normalization, stale-reference and authorization policies remain authoritative.

## Round-Trip Matrix

Named fixtures cover every field, true/false, assigned/unassigned, hierarchy/parent, defaults and exact
combined risk queries. Contracts, API and Angular tests cover both workspace and project scopes:

| Path | Evidence |
| --- | --- |
| Form to query and back | Shared serialization; Angular field matrix |
| URL/reload/history and scope stripping | Query store/codecs; Angular and browser workflows |
| Applied chips/remove by key | Shared chip descriptors; draft remains pending until Apply |
| HTTP params/backend links | Shared entries policy; API field matrix |
| SQL count/page/CSV export | Real zero/null/label/parent/cycle fixture |
| Personal/shared/project saved and pinned query | Saved-view API/persistence/browser tests |
| Copy URL and detail return URL | Same codecs; Angular matrix and browser workflow |
| Frozen evidence continuation links | Versioned schemas, Markdown golden, browser workflow |

Default values may be omitted from links without changing meaning. False must survive truthiness checks.
Removing an applied chip never applies unrelated drafts. Apply replaces the query and resets pagination;
opening a saved view immediately applies its stored query.

## Risk Units And Clock

Work categories count distinct IDs within each category before selecting five preview rows. One item
can belong to multiple categories: sums are **risk signals**, not unique tickets. Over target risk
section is zero or one `scope_conditions`; its preview is related open scope. The health reason retains
points-over-target as `estimate_points`. Project milestone reasons use `milestones`.

Pure UTC primitives are shared across runtimes; each evaluation captures one clock. Due soon includes
UTC today through today plus seven days, both inclusive. Stale in-progress means updatedAt strictly
before now minus seven 24-hour days; equality is not stale. SQL uses UTC date and 24-hour intervals,
independent of session timezone. Tests cover DST, midnight, equality and opposite-side UTC sessions.
Links open current data, which can change after capture. Five-row risk and eight-row recent/My Work
preview meanings remain unchanged; aggregate hydration optimization belongs to Phase 10.

## Frozen Evidence

Explicit v1 query/health/nested facts do not inherit future live DTO additions. V1 report parsing still
strips unknown fields and retains optional cycle/parent; v1 closeouts remain strict with original
cross-field refinements. V1 Markdown keeps historical link serialization and byte-for-byte golden
output. Missing v1 units are never invented.

New drafts/closeouts use version 2. V2 supports estimate/hierarchy/parent and rejects unknown/conflicting
query fields. Reasons require units; unestimated reasons require exact open/null predicates. Readers
accept only versions 1 and 2. Valid v1 drafts remain publishable; closeout replay returns original stored
evidence/version. Bindings check IDs, not names/keys that may legitimately change. JSONB has no
version-constraining DDL; no migration is needed. Preservation tests rerun migrations over stored v1,
compare JSONB text, and verify publication/read/replay without rewriting historical records.
