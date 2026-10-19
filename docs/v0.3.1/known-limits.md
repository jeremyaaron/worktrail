# Worktrail v0.3.1 Maintenance Limits

## Acceptance Status

This is local maintenance release preparation, not a publication announcement. Package and staged
site identity are `0.3.1`. See the [plan](implementation-plan.md),
[dependency disposition](dependency-remediation.md) and [final verification](verification-notes.md#phase-11-final-release-verification)
for completed local acceptance. Remote PR verification, merge, tag and Pages deployment remain
user-controlled publication steps. The
[v0.3.0 handoff](../v0.3.0/known-limits.md) remains historical evidence.

## Dependencies And Migration Risk

All five carried advisory exceptions are retired. Phase 11's independently installed `0.3.1` graph
validates physical peers and reports zero production/full audit findings; the
[machine policy](../security/development-audit-exceptions.json) has no active exceptions. Original
dates and the v0.3.1 review boundary were not extended. This is a point-in-time registry result,
not a guarantee against undisclosed vulnerabilities or production certification. Unknown new
findings, invalid peers, stale policy records and audit transport errors still fail the gate.

Drizzle Kit and ORM are exactly `1.0.0-rc.4`. This deliberate prerelease choice removes the legacy
vulnerable loader, but carries upstream stability/compatibility risk. Generation and populated
upgrade proofs preserve all 20 historical SQL identities, application rows, snapshots and file
bytes. They do not guarantee a future RC/stable downgrade. Before upgrading preserved data, stop
writes and capture a coordinated database/store backup plus the prior release/configuration. Do
not reseed, reset, reconvert historical folders or edit ledger rows. See
[upgrade and rollback guidance](../operations.md#v031-toolchain-boundary).

## Product And Validation Boundaries

This sprint does not expand product scope. Identity remains demonstration headers/local members,
not production authentication. Attachments require one API instance and marked persistent local
disk; integrity/signature checks are not malware scanning. No managed object store, cloud deployment,
multi-instance coordination or automated backup/restore is implemented. Preview is not safe public
hosting. Existing [capability limits](../../README.md#current-limitations) still apply.

Automated Chromium coverage is not screen-reader, real OS IME/clipboard, forced-colors or
non-Chromium/device signoff. No new manual UAT or accessibility-conformance approval is claimed.
Phase 5's initial Quick Find role lookup failed despite a rendered dialog; instrumented and
unmodified follow-ups passed under the original deadlines. The exact cause remains unestablished;
contention is only a hypothesis. No retries/deadline increase or claimed product fix hides that
observation. Preserve traces and diagnose causally if it recurs.

Fresh setup checks use private snapshots, independent lockfile installations, owned PostgreSQL
and marked storage, random ports and identity-proving startup wrappers. They exercise real source
or compiled runtimes, deep-link reloads and exact seeded downloads, not a remote clone, public
deployment, user data or every product journey. Populated upgrade acceptance is separately recorded
in [Phase 7](phase-7-evidence.json). Omitted suites are not passed checks.

## CI And Publication

Comprehensive checks remain PR-only; direct pushes to `main` bypass them. Pages validation/deployment
remains a separate main-push workflow. Use PRs with required checks against the current base branch;
local work does not configure branch protection, prove remote CI or attest Pages deployment.
Optional shard balancing is deferred without a measured speedup claim. Browser retries remain zero
and independent jobs keep reporting failures.

Merge, tag, Pages publication and repository administration remain separate user-controlled actions:

1. Review/commit the intended tree and require a green remote PR run against the current base branch.
   Local macOS evidence is not a remote Linux pass. Investigate failures without retry/deadline tuning.
2. Merge to `main`, pull, confirm the intended commit/version and create `v0.3.1` on that commit.
   These workspaces are private; no npm publication is required.
3. Confirm the independent Pages deployment and inspect the deployed repository-subpath page,
   favicon, screenshots, metadata and release-note link once the intended tag exists. The staged
   footer is not evidence of a live release or a remotely resolvable tag.
4. Record any real screen-reader, OS IME/clipboard, forced-colors or non-Chromium/device checks
   separately with their conditions and outcomes. Publishing the site does not deploy the app or
   change its local/demo limitations.
