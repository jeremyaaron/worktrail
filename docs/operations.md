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
