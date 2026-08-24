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
- `/api/shows` — Phase 0 shows API

Before D1 is connected, `/health` can report `databaseConfigured: false`. After the Phase 0 bootstrap completes, it must report both `databaseConfigured: true` and `databaseReachable: true`.

## 3. Cloudflare credentials for automation

The GitHub repository contains two Actions secrets:

- `CF_API` — Cloudflare API token
- `CF_ID` — Cloudflare account ID

The workflow maps them at runtime to Wrangler's expected environment variables:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Neither credential is written into the repository, Worker source, frontend assets, logs intentionally, or `wrangler.jsonc`.

## 4. Automated D1 bootstrap

`.github/workflows/phase0-cloudflare-bootstrap.yml` handles the Phase 0 D1 bootstrap from a pull request.

It performs these operations:

1. validates the GitHub Actions Cloudflare credentials;
2. reuses an existing `series-hub-db`, or creates it with the APAC location hint;
3. resolves the real D1 UUID;
4. adds the `DB` binding to a validation worktree;
5. applies the migrations in `migrations/` remotely;
6. verifies the expected Phase 0 tables;
7. runs `wrangler deploy --dry-run`;
8. uploads a non-production Worker version for validation.

The D1 UUID is an infrastructure identifier, not a secret. Once resolved and validated, it is committed to `wrangler.jsonc` so source control remains the authoritative Worker configuration.

## 5. D1 binding

The final binding has this shape:

```jsonc
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "series-hub-db",
    "database_id": "<REAL_DATABASE_UUID>",
    "migrations_dir": "migrations"
  }
]
```

Application code accesses the database through `env.DB`.

## 6. Post-binding verification

After the binding reaches production:

- `/health` must return HTTP 200;
- `databaseConfigured` must be `true`;
- `databaseReachable` must be `true`;
- `/api/shows` must return HTTP 200 and an empty data set until Phase 1 inserts series records.

## Preview workflow

Infrastructure and application changes follow:

```text
branch → PR validation/preview → review → main → production
```

Production traffic must not be used as the first validation target for schema, routing, or deployment-configuration changes.

## Dashboard fallback

Cloudflare Dashboard remains available as a recovery/fallback path, but normal Series Hub development should not require manually creating D1 resources or editing Worker bindings in the dashboard while the GitHub automation is healthy.
