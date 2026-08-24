# Architecture

## Phase 0 target

Series Hub uses a single Cloudflare Worker as its deployment boundary. Static assets are served through Workers Static Assets and application APIs execute in the Worker runtime.

```text
Browser
   │
   ▼
Cloudflare Worker: series-hub
   ├── /, /styles.css, /app.js → Static Assets
   ├── /health                 → Worker
   └── /api/*                  → Worker
                                  │
                                  ▼
                              D1: DB
```

## Why one Worker

The first implementation deliberately avoids separate Pages and API projects. One Worker provides:

- one GitHub integration;
- one preview/deployment lifecycle;
- one origin/domain boundary;
- no API CORS requirement for the first-party frontend;
- direct D1 bindings;
- a clear path to Cron Triggers later.

The frontend and API are still kept in separate directories so they can evolve independently without requiring separate infrastructure.

## Request routing

`wrangler.jsonc` routes `/api/*` and `/health` through the Worker before static asset resolution. Other requests fall through to `env.ASSETS.fetch(request)`.

## D1 bootstrap strategy

The initial commit does not contain a fake `database_id`. This is intentional.

1. Deploy the Worker foundation first.
2. Create `series-hub-db` in the Cloudflare dashboard.
3. Copy its real UUID.
4. Add the D1 binding as `DB` in `wrangler.jsonc`.
5. Apply `migrations/0001_initial.sql` through the Cloudflare dashboard SQL console or an approved browser-accessible workflow.
6. Re-deploy and confirm `/health` reports D1 as configured and reachable.

The Worker is tolerant of a missing DB binding only during this bootstrap stage. Once D1 is established, the binding becomes part of the normal production contract.

## External data boundary

Future collectors will access TMDB, TVmaze and official sources only inside the Worker/backend layer. The browser must not receive source API secrets.

```text
External APIs
    │
    ▼
Collector / normalizer
    │
    ▼
D1 canonical model
    │
    ▼
Series Hub API
    │
    ▼
Frontend
```

The frontend should consume Series Hub's stable schema, not raw third-party payloads.

## Environments

- `main` is the production branch.
- Other branches are preview candidates.
- Cloudflare Workers Builds is the deployment mechanism.
- GitHub pull requests are the review and merge boundary.

No local development environment is required by the project workflow.

## Deferred infrastructure

The following are explicitly out of Phase 0:

- R2 image mirroring
- user accounts
- authentication
- queues
- Durable Objects
- AI-generated metadata
- notification delivery
- external data collection

They should only be added when an actual requirement justifies the additional operational surface.
