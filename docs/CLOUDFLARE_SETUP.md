# Cloudflare Setup — Browser-Only

This document describes the Phase 0 dashboard workflow. It intentionally assumes no local CLI.

## 1. Import the GitHub repository

In Cloudflare Dashboard:

1. Open **Workers & Pages**.
2. Choose **Create application**.
3. Choose the option to import a repository.
4. Select GitHub and repository `MaxYu725/Series-Hub`.
5. Ensure the Cloudflare Worker/project name is exactly `series-hub` so it matches `wrangler.jsonc`.
6. Production branch: `main`.
7. Build command: leave empty; this project has no compile step.
8. Deploy command: use the Workers Builds default `npx wrangler deploy`.
9. Non-production branch deploy command: use the default `npx wrangler versions upload`.
10. Save and deploy.

The first production deployment should succeed without D1 because the initial `wrangler.jsonc` intentionally has no D1 binding yet.

## 2. Verify foundation endpoints

Open the generated `workers.dev` hostname.

Expected:

- `/` loads the Series Hub Phase 0 shell.
- `/health` returns `ok: true` and `databaseConfigured: false`.
- `/api/shows` returns an empty `data` array.

## 3. Create D1

In the Cloudflare Dashboard, create a D1 database named:

```text
series-hub-db
```

Record the real database UUID shown by Cloudflare.

## 4. Apply the initial migration

Open the database SQL console in the browser and execute the contents of:

```text
migrations/0001_initial.sql
```

This creates the Phase 0 tables and indexes.

## 5. Add the D1 binding to source control

Update `wrangler.jsonc` on a GitHub branch by replacing the commented example with:

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

The database UUID is an identifier, not an API secret. API credentials/tokens must still never be committed.

## 6. Post-binding verification

After Cloudflare deploys the change:

- `/health` should report `databaseConfigured: true`.
- `/health` should report `databaseReachable: true`.
- `/api/shows` should return HTTP 200 with an empty array until Phase 1 inserts data.

## Preview workflow

Cloudflare Workers Builds can create preview versions for non-production branches. Phase 0 uses the following workflow:

```text
branch → preview build → browser check → PR → main → production
```

Do not bypass preview verification for schema, routing or deployment-configuration changes.
