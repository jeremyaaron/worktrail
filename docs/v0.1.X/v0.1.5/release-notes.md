# Worktrail v0.1.5 Release Notes

## Summary

Worktrail v0.1.5 adds Pinned Operating Views: compact shortcuts for important saved work views on workspace and project Work pages.

The release builds on the v0.1.2 reliable query-state model, the v0.1.3 workspace shared-view model, and the v0.1.4 project saved-view model. A saved view can now be promoted into the page where it is used most often without changing its query, scope, visibility, permission rules, or route behavior.

Pinned views are intentionally small. They make recurring team lenses easier to open, while leaving saved-view management inside the existing manager.

## Product Highlights

- Added pinned saved-view shortcuts to the top-level Work Items page.
- Added pinned saved-view shortcuts to project Work pages.
- Supported pinned personal views for the selected actor.
- Supported pinned shared workspace views for team operating lenses.
- Supported pinned shared project views for project operating lenses.
- Kept shared pinned views visible and openable for contributors.
- Kept shared pin/unpin controls limited to owners and maintainers.
- Kept personal pin/unpin controls limited to the personal view owner.
- Kept archived project saved views openable while blocking archived project pin/unpin mutations.
- Rendered shared pinned views before personal pinned views.
- Sorted pinned shortcuts alphabetically within each group.
- Seeded pinned shared workspace views such as `Dependency risks` and `Ready for pickup`.
- Seeded pinned shared project views such as `Release blockers` and `Ready for QA`.

## Technical Highlights

- Added `isPinned` to saved work view contracts, DTO mapping, OpenAPI, API client behavior, and tests.
- Added `saved_work_views.is_pinned boolean not null default false`.
- Kept create requests unpinned by default; pinning remains an explicit update action.
- Extended saved-view update handling so `{ isPinned }` can be patched independently from name and query changes.
- Recorded shared saved-view pin/unpin activity in the workspace or project where the shared view belongs.
- Added a reusable Angular pinned-shortcuts component used by workspace and project Work pages.
- Wired workspace and project pages to compute pinned shared and personal groups from existing saved-view list responses.
- Avoided a separate pinned-list endpoint and avoided extra API calls for pinned shortcuts.
- Preserved canonical URL projection when opening pinned shortcuts.
- Repaired deterministic seed upserts so seeded saved views refresh `ownerMemberId` on reruns as well as name, scope, visibility, pinned state, and query.
- Added focused contract, API, OpenAPI, web component, workspace page, project page, and Playwright coverage for pinned views.

## Documentation And Site

- Updated the README to describe pinned saved views, personal versus shared pins, workspace versus project pins, contributor behavior, and archived project behavior.
- Updated the static product site to present v0.1.5 as the current baseline.
- Added destination-neutral pattern extraction notes for promoted saved query artifacts.
- Confirmed the OpenAPI reference documents `isPinned`, pin/unpin update behavior, and pinned/unpinned activity examples.

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

The Playwright suite includes browser coverage for seeded shared workspace pins, seeded shared project pins, contributor open-only shared pins, seeded personal pinning, and a newly created personal pinned view opened from the shortcuts area.

## Known Limitations

- Pinned views are shortcuts only; they do not add saved-view ordering, folders, icons, colors, or descriptions.
- Newly created saved views are unpinned by default.
- Pinned ordering is alphabetical within shared and personal groups.
- There is no pin limit, quota, analytics, or short-link model.
- Pinned views are available only on workspace and project Work pages.
- Saved views are not available on boards, planning tabs, My Work, or Inbox.
- Shared saved-view permissions still use workspace roles; project-specific membership is deferred.
- Authentication remains local actor selection and request-header scaffolding.
- The local Express adapter remains the only runtime adapter.
