# Worktrail v0.3.0 Release Notes

## Summary

**Connected Work: A Coherent Operating Baseline** consolidates the existing product around finding
work, understanding it, acting, and returning to the review that prompted the action. This release
improves existing workflows rather than adding another feature area.

This is a locally prepared release. Merge, tag, remote CI and GitHub Pages publication are separate,
user-controlled actions; no cloud application deployment is included.

## Product Changes

- Read-first work-item detail puts facts, description, status/watch actions and discussion before
  disclosed administration. Authorized field editing now includes setting and clearing estimates
  and due dates. Zero is an estimate, not missing data.
- Stay/Discard protection covers independent work-item, discussion, creation and report drafts,
  reused routes and actor changes. Pending writes prevent affected departure. Drafts are not autosaved.
- Linked inspection retains a safe original query/page and one immediate record. Discussion, Files,
  Dependencies, History and identifiable Inbox comments support relevant landing context.
- Project and workspace lists share applied-query, saved-view and pagination behavior. Named,
  Modified and Custom identify the results actually shown; unapplied edits do not become active chips.
- Deep-linked pagination survives initial member loading as well as reload; deliberate actor/project
  switches still reset paging and clear actor-sensitive state.
- Unestimated review links carry exact open/null semantics through URL, saved view, API and export.
  Correcting an item leads back to the refreshed review without changing historical evidence.
- Planning prioritizes current execution and bounded risk previews. Count labels distinguish unique
  work, category occurrences and scope conditions instead of implying interchangeable totals.
- Closeout requires a deliberate unfinished-work destination. Historical outcome shows all frozen
  commitments with pagination/Show all and complete Markdown/print; current context is separate.
- Portfolio refinement fits its actual container and retains workspace totals. Quick Find preserves
  the query during repeated inspection, refreshes results and resets on identity change.
- The public site now explains four connected workflows with current screenshots, independent
  development/compiled-preview setup and clear local/demo limits.

## Integrity And Performance

Production persistence and command owners now make transaction context, authoritative reads, lock
participation and side effects explicit. Real concurrent PostgreSQL schedules cover cycle overlap,
lifecycle/status/board/hierarchy and closeout races. Reference hydration is batched and aggregate
reads enrich their useful previews rather than the whole workspace.

CSV's HTTP boundary accepts valid input through the existing 1 MiB domain limit, with controlled
malformed/oversized errors. The project-scoped 250-row import, 10,000-row synchronous export and
attachment limits have not been increased. Summary export is not a round-trip import.

Verification provisions private source snapshots, owned disposable PostgreSQL, attachment roots,
browser profiles and random ports. Cleanup verifies resource identity. Interruption, abandoned runs,
failed commands and parallel execution have real lifecycle coverage. Ordinary working data is not a
verification target.

## Compatibility And Upgrade

Use Node 24 LTS/npm 11 and the committed lockfile. Back up PostgreSQL and the marked attachment store
together while writes are quiescent, retain the original runtime configuration, and follow
[Upgrade preserved data](../operations.md#upgrade-preserved-data):

```sh
nvm use
npm ci
npm run db:migrate
npm run build
npm run start:prod
```

Do not reset, seed, change attachment roots or delete volumes to upgrade. This release adds no schema
migration beyond v0.2.9's committed `0019_nosy_junta.sql`; generation must remain byte-identical.
Legacy source/format pairs, attachment bytes, personal/shared views and established routes remain
compatible. V1 report/closeout evidence stays frozen; new V2 producers carry precise current risk
queries, and readers/sharing/replay accept both versions without rewriting historical records.
See the [query/snapshot matrix](query-policy.md) and existing
[multiline CSV example](../v0.2.9/authored-work-items.csv).

All four package manifests, the internal contracts dependency, lockfile workspace identities and
OpenAPI identify `0.3.0`. No new runtime service or environment variable is required. The static
Pages workflow publishes only the product site after merge to `main`, not the Angular/API application.

## Readiness

The [final verification record](verification-notes.md#phase-21-final-release-verification) records
actual gates, measurements, diagnostics and cleanup. The [acceptance handoff](acceptance-handoff.md)
separates user approval from unperformed manual checks. [Known limits](known-limits.md) records
production boundaries, temporary development advisories and the publication checklist.

This remains a local reference app, not an internet-safe service or an accessibility-certified
product. Local identity headers, local file storage, bounded synchronous discovery/export and missing
managed cloud infrastructure are deliberate limits. No build budget or test deadline was raised.
