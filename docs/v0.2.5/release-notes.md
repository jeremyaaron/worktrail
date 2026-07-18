# Worktrail v0.2.5 Release Notes

## Summary

Worktrail v0.2.5 adds Work Breakdown. Teams can decompose one top-level project work item into direct
child work while each item retains independent workflow, planning, assignment, estimate, dependency,
and collaboration state.

The model is deliberately bounded to two levels. It adds useful containment without turning project
Work, boards, My Work, planning, or reports into recursive tree interfaces.

## User-Facing Changes

- Added `Add child work item` actions on eligible parent detail pages.
- Reused the existing create form with project and parent context preselected.
- Added focused parent management on eligible child detail pages:
  - search same-project parent candidates by immutable key or title;
  - select and save a parent;
  - replace or clear the current parent;
  - distinguish terminal candidates and recover from stale conflicts.
- Added parent detail summaries for direct child totals, open, done, canceled, estimated,
  unestimated, and child estimate points.
- Added bounded direct-child rows with status, assignee, estimate, and return-aware navigation.
- Preserved current detail content when navigating between parent and child routes that reuse the
  same Angular component.
- Added compact `Child of` and child-summary context to:
  - project and workspace work lists;
  - project board cards;
  - My Work;
  - Planning, Milestone Review, and Cycle Review;
  - generated report drafts, published report detail, and Markdown exports.
- Added Work Breakdown filters for top-level work, child work, and parents with children.
- Added exact-parent drill-downs using readable parent keys.
- Preserved hierarchy query state through active chips, copy links, reloads, saved views, pinned
  views, return URLs, and project/workspace CSV export.
- Added `parent_key` and `parent_title` to work item CSV exports.
- Added a pinned shared `Child work` project view.
- Added a deterministic local walkthrough with parent `WT-12`, five mixed-state children, a
  dependency-blocked child, and terminal replacement-parent candidate `WT-18`.

## Product Semantics

- A work item may be top-level, a top-level parent, or a direct child.
- A work item cannot be both a parent and a child.
- Parent and child must belong to the same workspace and project.
- Containment does not create or imply a blocking relationship.
- Parent and child status, priority, assignee, estimate, milestone, cycle, due date, labels,
  dependencies, comments, watchers, and activity remain independent.
- Parent direct estimate and derived child estimate total are intentionally separate values.
- Done and canceled work may remain parents or be selected as parents; terminal state does not erase
  containment.
- Real parent changes create activity. No-op retries create no update, activity, or notification
  noise.

## Technical Changes

- Added migration `0015_silky_tyger_tiger.sql` with:
  - nullable `work_items.parent_work_item_id` self-reference;
  - indexed `(project_id, parent_work_item_id)` child lookup;
  - self-parent prevention at the database level.
- Added shared parent identity, parent candidate, child summary, child collection, hierarchy filter,
  and parent mutation contracts.
- Added transactional create and reparent validation with deterministic row-lock ordering.
- Added `GET /api/work-items/{workItemId}/children`.
- Added `GET /api/work-items/{workItemId}/parent-candidates`.
- Added idempotent `PUT /api/work-items/{workItemId}/parent` for set, replace, and clear behavior.
- Added `hierarchy` and `parentKey` to canonical project/workspace work item query handling.
- Added set-based parent and child-summary enrichment to flat list DTOs.
- Added set-based parent enrichment to bounded live planning and review rows.
- Extended status report snapshot parsing with optional parent context so older stored reports remain
  readable and newly published reports retain hierarchy context.
- Left cycle closeout snapshot v1 unchanged.
- Added seed-time same-project and two-level integrity assertions.
- Added a focused serial Playwright workflow covering create, navigation, parent replacement and
  restoration, activity, exact-parent filters, saved views, list/board/My Work context, responsive
  layouts, keyboard focus, and accessible names.

## Compatibility Notes

- Migration `0015_silky_tyger_tiger.sql` is required.
- Existing work items migrate as top-level work with `parent_work_item_id = null`.
- Existing project and workspace work URLs remain valid when hierarchy parameters are absent.
- Existing saved views remain valid and continue to omit hierarchy state unless explicitly saved.
- Older status report snapshots may omit parent context and remain readable.
- Cycle closeout snapshots are not rewritten and retain their v1 contract.
- CSV import remains unchanged and does not assign cycles or parent relationships. The new hierarchy
  fields are export-only.
- Existing dependency relationships retain their `blocks` and `relates_to` semantics.
- Archived projects remain readable but reject hierarchy mutations.

## Verification

Phase-level verification is recorded in `docs/v0.2.5/implementation-plan.md`.

Recommended release checks:

```sh
npm install --package-lock-only
npm run db:reset
npm run db:migrate
npm run db:seed
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build
npm audit --omit=dev --audit-level=low
git diff --check
```

## Residual Risks And Deferred Work

- Work Breakdown is exactly two levels; recursive trees and arbitrary-depth navigation are deferred.
- Child ordering is deterministic but not user-managed.
- Parent status, estimates, milestones, cycles, and dependencies do not roll up or automate child
  state.
- Bulk reparenting and hierarchy-aware bulk commands are deferred.
- CSV import and third-party migration mapping do not create hierarchy.
- Hierarchy-specific notifications, subscriptions, and automation are deferred.
- Flat work list endpoints remain unpaginated; hierarchy enrichment is set-based but does not remove
  the existing large-list scalability limit.
- Production authentication, hosted infrastructure, observability, and internet-safe deployment
  remain outside this release.
