# Worktrail v0.1.3 Release Notes

## Summary

Worktrail v0.1.3 adds Team Work Views: workspace-shared saved work views built on the v0.1.2 query-state contract.

The release keeps personal saved views intact while giving owners and maintainers a way to publish common workspace lenses such as blocked work, dependency risks, due soon work, unassigned open work, and ready-for-pickup queues. Contributors can open shared views but cannot manage them.

This remains app-local. The release captures extraction signals around shared query artifacts, visibility, ownership, and permissions, but it does not introduce a generic `jawstack` saved-view package.

## Product Highlights

- Added workspace-shared saved work views to the top-level Work Items page.
- Preserved existing personal saved-view behavior and owner-only personal management.
- Split saved views into shared and personal sections with counts and compact summaries.
- Added separate save actions for personal and shared views.
- Allowed owners and maintainers to create, rename, update-query, and delete workspace-shared views.
- Kept contributors read-only for shared saved views while allowing them to open shared operating lenses.
- Added deterministic shared seed views for common team workflows.
- Preserved canonical filtered URLs, active chips, copy links, and applied-filter CSV export after opening shared views.

## Technical Highlights

- Extended `SavedWorkViewVisibility` from `personal` to `personal | workspace`.
- Added optional `visibility` to saved-view creation requests.
- Added partial unique indexes for personal saved-view names and workspace-shared saved-view names.
- Updated saved-view repository queries so list responses include the actor's personal views plus workspace-shared views.
- Hydrated distinct saved-view owners for mixed personal/shared list responses.
- Enforced owner/maintainer management rules for workspace-shared views.
- Preserved not-found behavior for cross-actor personal saved views and forbidden behavior for visible shared views the actor cannot mutate.
- Added workspace activity events for shared-view create, rename, query update, combined update, and delete operations.
- Updated OpenAPI docs for visibility, list behavior, and shared-view permission rules.
- Added focused API, web component, page, API-client, and Playwright coverage for shared saved views.

## Documentation And Site

- Updated the README to describe personal versus workspace saved views, contributor read behavior, owner/maintainer management, and the relationship to reliable filtered URLs, copy links, and CSV export.
- Updated the static product site to present v0.1.3 as the current baseline.
- Added v0.1.3 jawstack extraction notes for shared query artifacts.
- Preserved `docs/v0.1.2/0006-query-contracts-url-state.md` and `docs/v0.1.2/jawstack-extraction-notes.md` as the query-contract source material.

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

The Playwright suite resets, migrates, seeds, and restores deterministic local Postgres data. v0.1.3 adds smoke coverage that opens a shared view as an owner, validates canonical query behavior, switches to a contributor, and confirms shared views remain readable without management controls.

## Known Limitations

- Shared saved views are workspace-wide only; project-scoped saved views are deferred.
- Shared saved views do not support ordering, pinning, folders, icons, colors, descriptions, ownership transfer, or custom permissions.
- Contributors can open shared views but cannot request changes or comment on shared-view definitions.
- Saved-view summaries remain compact filter counts rather than rich domain-aware descriptions.
- Query helpers and shared-view behavior remain Worktrail-local and are not a `jawstack` package.
- Authentication remains local actor selection and request-header scaffolding.
- The local Express adapter remains the only runtime adapter.
