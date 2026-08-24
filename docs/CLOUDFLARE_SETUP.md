# Cloudflare Setup — Browser-Only

Series Hub is operated without a local development requirement. GitHub is the source of code and deployment orchestration; Cloudflare Workers is the runtime.

## 1. GitHub → Cloudflare deployment

Cloudflare Worker/project name: `series-hub`

Production branch: `main`

The repository contains `wrangler.jsonc`, so Worker configuration is source-controlled. The GitHub Actions workflow `.github/workflows/phase0-cloudflare-bootstrap.yml` is the authoritative deployment path:

- pull requests run dry-run + isolated Cloudflare preview validation;
- pushes/merges to `main` run `wrangler deploy` to production and then verify the live runtime.

This avoids relying on an out-of-band dashboard deployment state to keep production synchronized with `main`.

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

## 4. Phase 0 production D1 — completed

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

The real production D1 UUID is stored in `wrangler.jsonc` as infrastructure configuration. It is an identifier, not an API credential.

## 5. Isolated PR validation

Every same-repository pull request receives its own D1 database:

```text
series-hub-pr-<PR number>
```

The PR workflow:

1. validates the GitHub Actions Cloudflare credentials;
2. resolves or creates the PR-specific D1 in APAC;
3. rewrites only the ephemeral CI copy of `wrangler.jsonc` so `DB` points at that PR database;
4. applies the PR's migrations to the isolated database;
5. runs a Wrangler dry-run;
6. uploads an isolated Worker preview alias;
7. requests preview `/health` and `/api/shows`;
8. requests production `/health` and `/api/shows` as a read-only regression check.

Unmerged Worker code therefore never executes against the production D1 during automated preview testing.

When a PR is closed or merged, the workflow deletes its `series-hub-pr-<PR number>` D1 database. This keeps preview data isolated without accumulating abandoned databases.

## 6. Production deployment

A push to `main` runs a separate workflow job which:

1. checks out the exact `main` commit;
2. runs `wrangler deploy` using the repository's pinned Wrangler version;
3. requests production `/health` and `/api/shows`;
4. fails the deployment workflow if the live Worker cannot reach D1 or returns an invalid API shape.

The production URL is:

```text
https://series-hub.max-yu-jp.workers.dev
```

## 7. D1 migrations after Phase 0

New schema changes must be added as new numbered files under `migrations/`. Existing applied migrations must not be edited retroactively.

PR migrations are exercised against the isolated PR D1. Applying migrations to production remains a separately controlled deployment operation; ordinary application deployment must not silently mutate the production schema.

## 8. Runtime acceptance

A healthy deployment must satisfy:

- `/health` returns HTTP 200;
- `ok` is `true`;
- `databaseConfigured` is `true`;
- `databaseReachable` is `true`;
- `/api/shows` returns HTTP 200 with a JSON `data` array.

Until Phase 1 inserts series records, the production `data` array is expected to be empty.

## Development path

```text
GitHub branch
   ↓
Pull request
   ↓
PR-specific D1 + migrations
   ↓
Wrangler dry-run + isolated Worker preview
   ↓
Preview runtime smoke test
   ↓
Production read-only regression smoke test
   ↓
Review / merge
   ↓
push main
   ↓
GitHub Actions → wrangler deploy
   ↓
Production runtime verification
   ↓
PR closes → preview D1 cleanup
```

## Dashboard fallback

Cloudflare Dashboard remains a recovery/fallback path. Normal Series Hub development should not require manual D1 creation, binding edits, local Wrangler, PowerShell, Docker, or a local Node.js environment.
