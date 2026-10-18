# Worktrail v0.3.0 Known Limits And Handoff

## Local Readiness Is Not Production Certification

User approval to finalize was received on October 18, 2026. No detailed manual walkthrough results,
screen-reader session, real OS IME/clipboard or cross-browser/device signoff were supplied. Native
200% Chromium zoom, keyboard/editor behavior, synthetic composition and responsive checks provide
automated evidence only. These unperformed checks are explicit limits of local release readiness;
they are not passed tests or an accessibility conformance claim.

Identity uses demonstration headers and local members. The app is not safe to expose publicly as an
authenticated service. Attachments require one API instance and a persistent marked local disk;
signature/integrity checks are not malware scanning. There is no production identity, managed object
store, multi-instance coordination, cloud deployment or managed backup implementation.

Drafts are transient, not recoverable autosaves. Native unload warnings depend on browser policy.
Board/aggregate projections remain complete; exact counts, deep offsets and separate page reads
have scaling/consistency limits. CSV export is synchronous and capped at 10,000 rows; import is
1 MiB/250 rows. See the [full capability limits](../../README.md#current-limitations) and
[coordinated backup guide](../operations.md#coordinated-backup-and-restore).

## Bounded Development Advisories

This section records the v0.3.0 baseline. For the current v0.3.1 working tree, see
[dependency disposition](../v0.3.1/dependency-remediation.md): Phase 5 retires all four Angular-related
advisories; only the unchanged Drizzle advisory remains for Phase 6. The machine policy is authoritative.

Production auditing must have zero findings. The v0.3.0 full graph was not clean: its disposition
contains 13 findings (5 moderate, 6 high, 2 critical), five advisory IDs and 19 exact affected records.
Owner: `jeremyaaron`. The [machine policy](../security/development-audit-exceptions.json) and
[reviewed chains and mitigations](dependency-remediation.md#remaining-development-risk) are
authoritative; a package count is not an advisory count.

Remaining exposure is Karma/braces untrusted globs, Drizzle Kit's legacy esbuild serve API, and the
unused web Vitest 3 redirect/Tinypool subtree. Use reviewed configurations and isolated loopback
verification; do not run Studio/serve or the unused Vitest 3 browser/UI/server/pool. API/contracts use
patched Vitest 4. There is no blanket override or exception for production dependencies.
Clean installation also reports retained transitive tooling deprecations; a successful install is
not a claim that every development dependency is supported or warning-free.

The intended release date is **October 18, 2026**, not an assertion that a tag was published that day.
All five exceptions expire at **00:00 UTC November 16, 2026**, **v0.3.1**, or 30 days after the actual
release date, whichever is earliest. The gate rejects unknown/changed/stale findings and expired
records. Before publication, recheck the actual date and audits; a delayed tag must not extend expiry.
Remediate through compatible owner updates/backports, or separately scope the supported test/build
migration before that boundary. Do not suppress a failing gate by renewing dates without review.

## User-Controlled Publication Checklist

1. Commit/review the final tree and require a green remote PR verification run. Local macOS passes
   do not attest remote Linux CI. Investigate any failure rather than increasing retries/deadlines.
2. Merge to `main`, pull it locally, confirm release identities and tag the intended commit `v0.3.0`.
   No npm package publication is needed for these private workspaces.
3. Confirm the existing Pages workflow completed for that merge and the deployed base-path page,
   favicon, screenshots and metadata match the intended tree.
4. Check the fixed `v0.3.0` release-note link after the tag is available, plus README/setup/operator
   links. The staged footer names the release; it is not evidence of current public availability.
5. Inspect a deployed page/share preview and representative assets on mobile and desktop. Record any
   real screen-reader/device walkthrough separately with browser/OS/input conditions and outcomes.

Remote CI, tag resolution, Pages deployment and external share previews remain pending until these
actions occur. Publishing the site does not deploy the application or change its local/demo limits.
