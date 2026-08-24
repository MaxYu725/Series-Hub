# Cloudflare Setup — Browser-Only

Series Hub is operated without a local development requirement. Production deployment is connected directly from GitHub to Cloudflare Workers Builds.

## 1. GitHub → Cloudflare deployment

Cloudflare Worker/project name: `series-hub`

Production branch: `main`

The repository contains `wrangler.jsonc`, so deployment configuration is treated as source-controlled infrastructure. Production changes should flow through a branch and pull request before reaching `main`.

## 2. Foundation endpoints

The deployed Worker exposes:

- `/` — Series Hub frontend shell
- `/health` — service and D1 binding health
- `/api/shows` — baseline shows API

Phase 0 requires `/health` to report both `databaseConfigured: true` and `databaseReachable: true`.

## 3. Cloudflare credentials for automation

The GitHub repository contains two Actions secrets:

- `CF_API` — Cloudflare API token
- `CF_ID` — Cloudflare account ID

The workflow maps them at runtime to Wrangler's expected environment variables:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Neither credential is committed to the repository, Worker source, frontend assets, or `wrangler.jsonc`.

## 4. Phase 0 D1 bootstrap — completed

The one-time Phase 0 bootstrap has been completed.

Production D1:

```text
name: series-hub-db
binding: DB
region: APAC
```

The initial migration in `migrations/0001_initial.sql` has been applied and the following core tables were verified remotely:

- `shows`
- `seasons`
- `episodes`
- `title_aliases`
- `providers`
- `availability`
- `sources`
- `sync_runs`

The real D1 UUID is stored in `wrangler.jsonc` as infrastructure configuration. It is an identifier, not an API credential.

## 5. Normal PR validation

The repository workflow `.github/workflows/phase0-cloudflare-bootstrap.yml` no longer provisions D1 or applies production migrations on every pull request.

For each same-repository PR it now:

1. validates that the GitHub Actions Cloudflare credentials are present;
2. runs a Wrangler production-equivalent dry-run;
3. uploads an isolated non-production Worker version with a PR preview alias;
4. requests the preview `/health` and `/api/shows` endpoints;
5. requires the preview D1 binding to be configured and reachable;
6. requests the production `/health` and `/api/shows` endpoints as a regression smoke test.

This keeps PR validation read-only with respect to the production D1 schema.

## 6. D1 migrations after Phase 0

New schema changes must be added as new numbered files under `migrations/`. Existing applied migrations must not be edited retroactively.

A future schema-change workflow may apply migrations as a separately controlled deployment step. Ordinary feature PR validation must not create databases or mutate the production schema.

## 7. Runtime acceptance

A healthy deployment must satisfy:

- `/health` returns HTTP 200;
- `ok` is `true`;
- `databaseConfigured` is `true`;
- `databaseReachable` is `true`;
- `/api/shows` returns HTTP 200 with a JSON `data` array.

Until Phase 1 inserts series records, the `data` array is expected to be empty.

## Development path

```text
GitHub branch
   ↓
Pull request
   ↓
Wrangler dry-run + isolated Cloudflare preview
   ↓
Preview runtime smoke test
   ↓
Production regression smoke test
   ↓
Review / merge
   ↓
main → Cloudflare production deployment
```

## Dashboard fallback

Cloudflare Dashboard remains a recovery/fallback path. Normal Series Hub development should not require manual D1 creation, binding edits, local Wrangler, PowerShell, Docker, or a local Node.js environment.
