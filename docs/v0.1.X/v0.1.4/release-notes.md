# Worktrail v0.1.4 Release Notes

## Summary

Worktrail v0.1.4 adds Project Work Views: saved work views scoped to an individual project Work page.

The release extends the v0.1.2 reliable query-state model and the v0.1.3 workspace-shared saved-view model into project workspaces. Owners and maintainers can publish shared project lenses such as `Ready for QA`, `Release blockers`, and `Open dependency risks`. Contributors can open those shared project views without receiving shared-view management controls. Every actor can continue to use personal views where the current project state allows it.

This remains Worktrail-local. The release captures stronger extraction evidence around scoped saved query artifacts, but it does not introduce a generic `jawstack` saved-view abstraction.

## Product Highlights

- Added saved views to project Work pages.
- Added explicit saved-view scopes: `workspace` and `project`.
- Added personal project saved views for individual project workflows.
- Added shared project saved views for reusable project operating lenses.
- Kept workspace saved views isolated from project saved views.
- Kept project saved views isolated by project.
- Allowed owners and maintainers to create, rename, update-query, and delete shared project views on active projects.
- Kept contributors read-only for shared project views while allowing them to open shared project lenses.
- Preserved contributor ability to create and manage personal project views on active projects.
- Kept project saved views openable for archived projects while blocking project-scoped create, update, and delete operations.
- Added deterministic shared project views to seeded active projects.
- Preserved project Work page URL state, active filter chips, copy links, detail return URLs, and CSV export alignment after opening saved project views.

## Technical Highlights

- Added `SavedWorkViewScope = 'workspace' | 'project'` to shared contracts.
- Added `scope` and nullable `projectId` to `SavedWorkViewDto`.
- Added `ListSavedWorkViewsQuery` so callers can request workspace or project saved views explicitly.
- Added `scope` and `projectId` to saved-view create requests while keeping omitted values backward-compatible.
- Added `scope` and `project_id` columns, constraints, read indexes, and scope-aware partial unique indexes to `saved_work_views`.
- Updated saved-view repository and service logic to list visible views by scope and project.
- Normalized saved-view query data with scope-aware workspace/project rules.
- Blocked archived project-scoped saved-view mutations at the service layer.
- Added project activity events for shared project-view create, rename, query update, combined update, and delete operations.
- Extended the saved-views toolbar with project-specific copy, labels, query summaries, and read-only behavior.
- Added project Work page integration for shared and personal project views.
- Updated workspace list integration to request/create workspace views explicitly and ignore project-scoped views defensively.
- Updated OpenAPI to document saved-view scope, `projectId`, project list behavior, create behavior, and archived-project mutation restrictions.
- Added focused API, contract, web, and Playwright coverage for scoped saved views.

## Documentation And Site

- Updated the README for workspace versus project saved-view scope.
- Updated the README for personal versus shared visibility and owner/maintainer/contributor behavior.
- Updated the README for archived project saved-view behavior.
- Updated the README for saved project views, project URLs, copy links, return URLs, and CSV export alignment.
- Updated the static product site to present v0.1.4 as the current baseline.
- Added v0.1.4 jawstack extraction notes for scoped saved query artifacts.
- Preserved v0.1.2 and v0.1.3 query-artifact notes as source material.

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

The Playwright suite includes browser coverage for opening seeded shared project views, saving/reloading/reopening a personal project view, switching to a contributor, and confirming shared project views remain openable without shared management controls. The suite also preserves workspace shared-view smoke coverage.

## Known Limitations

- Saved views support workspace and project scopes only.
- Shared project views use workspace-level roles; there is no project-specific membership or custom permission model.
- Saved views do not support ordering, pinning, folders, icons, colors, descriptions, ownership transfer, comments, approvals, short links, or analytics.
- Contributors can open shared views and manage their own personal views, but cannot request shared-view changes inside the product.
- Saved-view summaries remain compact filter counts rather than rich domain-aware descriptions.
- Query helpers and scoped saved-view behavior remain Worktrail-local and are not a `jawstack` package.
- Authentication remains local actor selection and request-header scaffolding.
- The local Express adapter remains the only runtime adapter.
