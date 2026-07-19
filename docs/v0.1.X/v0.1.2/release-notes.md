# Worktrail v0.1.2 Release Notes

## Summary

Worktrail v0.1.2 hardens filtered work views by treating work item query state as a product contract.

The release does not add a broad new product area. Instead, it makes existing list, saved-view, dashboard, delivery-health, export, return-link, and share-link behavior more trustworthy. The core result is that visible active filters, route query parameters, saved views, copied links, and CSV exports all describe the same applied work item set.

This remains app-local. The query-contract pattern is documented for `jawstack`, but no framework package or generic abstraction was extracted.

## Product Highlights

- Added canonical filtered URL behavior for workspace and project work item lists.
- Added "Copy link" actions for workspace and project filtered views.
- Ensured copied links use current origin, current list path, and canonical applied query params.
- Kept pending filter edits out of copied links, saved views, exports, active chips, and return URLs until applied.
- Preserved reloadable filtered URLs for cross-project workspace discovery.
- Improved saved-view summaries so default-only query noise stays quiet.
- Preserved stale saved-view readability where existing project, label, milestone, or member data allows.
- Clarified CSV export actions with applied-filter button labels and titles.
- Kept CSV export aligned with the currently applied list view.
- Added browser smoke coverage for filtered URL reload behavior.

## Technical Highlights

- Consolidated frontend work item query behavior in app-local query helpers.
- Added typed helper coverage for:
  - project form values to `WorkItemQuery`;
  - workspace form values to `WorkItemQuery`;
  - router query params to form values;
  - query state to router params;
  - router-link params;
  - return URL construction;
  - meaningful query-field counts.
- Refactored workspace and project work item lists to use applied query state for loaded results, active chips, saved views, export, copied links, and return URLs.
- Refactored delivery-health query links to use canonical query conversion with explicit project/workspace scope.
- Aligned project CSV export with the canonical work item HTTP query serializer used by workspace exports.
- Added an app-local clipboard service with native Clipboard API support, textarea fallback, and explicit failure behavior.
- Added focused unit coverage for query round trips, copy-link behavior, clipboard fallback, saved-view summaries, export affordance labels, and delivery-health query conversion.
- Added Playwright coverage for workspace filter application, URL params, active chips, filtered results, and reload persistence.

## Documentation And Site

- Updated the README around reliable filtered views, copyable filtered links, saved views, and applied-filter export behavior.
- Updated the static product site to describe v0.1.2 as the current baseline.
- Added v0.1.2 jawstack extraction notes for query contracts and URL state.
- Preserved `docs/v0.1.2/0006-query-contracts-url-state.md` as the source opportunity note.

## Verification

Final local verification for this release candidate:

```sh
npm run lint
npm run typecheck
npm run db:reset
npm run db:migrate
npm run db:seed
npm test
npm run build
npm run test:e2e
git status --short --branch
git diff --check
```

The Playwright suite resets, migrates, seeds, and restores deterministic local Postgres data. v0.1.2 adds a smoke test that confirms filtered workspace URLs survive reload with the expected chips and result set.

## Known Limitations

- Query helpers remain Worktrail-local and are not a `jawstack` package.
- Saved views remain personal only.
- Saved-view summaries count meaningful fields but do not render a rich breakdown of every filter.
- Copy-link support depends on browser clipboard support or the local textarea fallback.
- Native share sheets, short links, permission customization, and link analytics are deferred.
- Server-side pagination, full-text search infrastructure, and advanced query-builder UI are deferred.
- Authentication remains local actor selection and request-header scaffolding.
- The local Express adapter remains the only runtime adapter.
