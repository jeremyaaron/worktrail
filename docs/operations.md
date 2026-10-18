# Worktrail Local Operations

Worktrail is a local reference application, not an internet-safe hosted service. This current guide
complements the independent [development](../README.md#local-setup) and
[compiled-preview](../README.md#production-preview) paths. Local actor headers are demonstration
identity. The current attachment adapter supports one API instance with persistent local disk;
neither signature checks nor integrity checks replace malware scanning.

## Runtime And Health

Use Node 24/npm 11 and PostgreSQL 16. Production requires an explicit `DATABASE_URL` and absolute
`WORKTRAIL_ATTACHMENT_STORAGE_PATH`. Set the attachment root before seed and keep it unchanged at
runtime. Preview also sets `WORKTRAIL_SERVE_STATIC=true`, an absolute `WORKTRAIL_STATIC_ASSETS_PATH`
and `CORS_ORIGIN=false`; a development `.env` override must not silently disable compiled assets.

`npm run preview` builds then starts compiled code; `npm run build` followed by `npm run start:prod`
is equivalent. Stop a conflicting local API before starting another. Readiness and liveness differ:

```sh
curl --fail http://localhost:3000/api/health/live
curl --fail http://localhost:3000/api/health/ready
curl --fail http://localhost:3000/work-items/10000000-0000-4000-8000-000000000403
```

The deep link must serve the SPA, while unknown `/api/*` routes retain JSON errors. In the browser,
open seeded WT-3's Files and download `attachment-requirements.md` and `verification-evidence.json`.
A readiness pass does not establish that their bytes are present. File metadata and the marked
object store are one operational data set. See [OpenAPI](api/openapi.yaml) for the actual API surface.

## Upgrade Preserved Data

Back up first. Stop writes and retain the existing database URL and absolute attachment root.
After checking out the intended release, use its Node version and install its lockfile dependencies:

```sh
nvm use
npm ci
npm run db:migrate
npm run build
npm run start:prod
```

Export the original runtime configuration before these commands, as in the README preview path;
do not adopt a fresh-demo storage path. Migrations are the upgrade mechanism. `db:seed`, `db:reset`
and `storage:reset` are not upgrades or repair tools. Seed scripts may replace demo records/reports;
do not seed a working installation. Review migration/release guidance before accepting production use.

### v0.3.1 Toolchain Boundary

The implemented v0.3.1 candidate pins Drizzle Kit and ORM to `1.0.0-rc.4`. This is an explicit
prerelease maintenance choice, not a new domain schema migration. Historical SQL is byte-identical;
the committed migration folders/snapshots use the owner's new layout. Do not run folder conversion
again, generate replacement historical SQL, or edit migration ledger rows on an installation.

The ordinary `db:migrate` command adopts the prior ledger: it retains IDs, SQL hashes and original
millisecond timestamps, adds mapped migration names, and leaves historical application times unknown
(`applied_at = null`). Fresh ledgers use the new folder timestamps at UTC-second precision. Repeated
migration is a no-op. The populated v0.3.0-to-candidate proof compares all public rows, stored authored
source/formats, relationships, saved views, historical JSON, application constraints/indexes and
extensions, plus each referenced attachment's length/checksum and the complete file inventory.

Run the reproducible proof with `npm run verify:upgrade`. It requires the local `v0.3.0` tag, Docker,
Node 24/npm 11 and registry access/cached packages. It independently installs an archive of that
release and a snapshot of the current source/lock, provisions separate owned fresh/upgrade databases
inside a disposable PostgreSQL 16 server, and seeds only the prior-version target before capture.
It then performs the comparisons, full API/contracts checks, and compiled API read/write/download
acceptance. Runtime writes occur only after preservation comparison. It does not use the configured
working database, Compose service, or ordinary attachment directory. Reports remain in
`test-results/verification/<run-id>/`; owned installations, databases, server processes and storage
are removed on success, command failure or handled interruption. It is an explicit backend acceptance
command, not an additional default CI job or a check to repeat after every small edit.

### Rollback Posture

Before upgrading real data, stop all writes and capture a coordinated PostgreSQL/storage backup,
the prior release/lockfile, and the original runtime configuration. Validate the backup's restore
procedure before treating it as recovery protection. Keep the backup until the upgraded application
and representative authorized file downloads have been checked.

There is no supported down-migration or automatic RC-to-stable downgrade. Do not attempt recovery
by deleting ledger names/columns, reseeding, or checking out old code against an arbitrarily changed
database. Restore the database and complete attachment root from the same pre-upgrade capture, then
install/run the matching prior release and configuration. Writes made after that capture require
separate recovery/reconciliation; this app does not replay them automatically. The Phase 0 observation
that the old ORM accepted the augmented ledger with unchanged domain history is not a general
rollback guarantee for future migrations or a replacement for a backup.

## Coordinated Backup And Restore

Quiesce attachment mutations and other writes, take a PostgreSQL backup, and copy the complete marked
attachment storage directory during the same quiescent interval. Preserve the runtime configuration
and release identity separately without exposing secrets. Resume writes only after both captures
finish. A live uncoordinated filesystem copy plus a later database dump is not a consistent backup.

Restore database metadata and file bytes together into the intended environment, keep the same
logical store configuration, and verify representative authorized downloads byte-for-byte before
resuming writes. Missing bytes or unreferenced objects require investigation; changing roots or
reseeding can conceal damage. There is no automatic distributed backup or recovery implementation.

## Disposable Demo Reset

Only after confirming the selected demo database/storage are disposable, stop the API and export
that demo's original explicit configuration. Then:

```sh
npm run storage:reset
WORKTRAIL_ALLOW_DATABASE_RESET=true npm run db:reset
npm run db:migrate
npm run db:seed
```

`storage:reset` requires an initialized Worktrail marker and does not delete database rows.
`db:reset` requires explicit opt-in outside verification and never deletes attachment bytes.
Neither command repairs working data. `db:down` removes the Compose container/network, not its
named data volume; deleting volumes is a separate destructive action, not part of an upgrade.

## Isolated Verification

```sh
npx playwright install chromium
npm run verify:setup -- development
npm run verify:setup -- preview
npm run verify -- --mode=site
```

Each setup command installs from the lockfile into a separate private source snapshot with a fresh
owned PostgreSQL container and absolute attachment root. It migrates/seeds, launches the corresponding
source or compiled runtime, reloads a deep link and checks both seeded downloads exactly. Random ports,
cache-disabled builds and identity-proving startup wrappers replace ordinary local port/Compose
defaults; these checks do not clone or deploy remote main. They reuse the app's real startup and
adapters, not a mocked file server. Both paths need Docker and installed Chromium.

Site mode needs no database; it validates links/assets/release metadata and renders the actual Pages
subpath. All automated verification owns its processes, resources and cleanup. It never resets the
working database. See [verification](../README.md#verification) for abandoned-run cleanup and broader
release gates, and [cycle diagnostics](cycle-diagnostics.md) for read-only schedule investigation.
