# Series Hub

Series Hub is a browser-first TV series aggregation project. The initial product scope is US scripted television and streaming series, organized around **series → seasons → episodes** rather than around streaming playback.

The product will surface three primary lifecycle views:

- **播映中 / Airing** — seasons currently releasing episodes.
- **即將播映 / Upcoming** — announced seasons with a confirmed premiere date.
- **計劃播出 / Planned** — renewed, ordered or in production seasons without a confirmed premiere date.

Chinese naming is a first-class data layer. A show may have different preferred titles and aliases for Hong Kong, Taiwan and Mainland China; these are stored separately instead of collapsing them into one `chinese_title` field.

## Current phase

**Phase 0 — Complete**

Phase 0 contains no TMDB, TVmaze or official-network ingestion. It establishes the deployable and database-backed baseline before external series data is introduced.

**Next: Phase 1 — TMDB US scripted-series MVP.**

### Phase 0 deliverables

- Cloudflare Worker with Static Assets
- `/health` API endpoint
- `/api/shows` baseline endpoint
- Vanilla HTML/CSS/JavaScript frontend
- Cloudflare D1 database bound as `DB`
- Initial D1 schema and migration
- Architecture and data-model documentation
- Browser-only GitHub Actions → Cloudflare deployment workflow
- Pull-request dry-run, isolated preview, and runtime smoke validation
- `main` production deploy plus live post-deploy validation

## Architecture

```text
GitHub branch / PR
  │
  ▼
GitHub Actions
  ├── PR: dry-run + Cloudflare preview + smoke tests
  └── main: wrangler deploy + production smoke test
                         │
                         ▼
                 Cloudflare Worker
                 ├── Static Assets (public/)
                 └── /api/*
                       │
                       └── D1 binding: DB → series-hub-db
```

Static files and API routes are intentionally deployed as one Cloudflare Worker. This reduces moving parts while keeping the frontend and backend logically separated.

## Browser-only development rule

The normal project workflow does **not** require a local clone, PowerShell, a local Node.js installation, Docker or Wrangler on the user's machine.

```text
GitHub branch
   ↓
Pull request
   ↓
Cloudflare preview + runtime validation
   ↓
Review / merge
   ↓
main
   ↓
GitHub Actions production deployment
```

`package.json` pins Wrangler for CI/Cloudflare operations; it is not a requirement for local development.

## Repository layout

```text
Series-Hub/
├── README.md
├── package.json
├── wrangler.jsonc
├── .github/
│   └── workflows/
├── src/
│   └── index.js
├── public/
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── migrations/
│   └── 0001_initial.sql
└── docs/
    ├── ARCHITECTURE.md
    ├── CLOUDFLARE_SETUP.md
    └── DATA_MODEL.md
```

## API baseline

### `GET /health`

Returns service health plus D1 binding/reachability state. A healthy Phase 0 deployment reports the database as configured and reachable.

### `GET /api/shows`

Reads the `shows` table and returns a JSON `data` array. It remains empty until Phase 1 begins ingesting series metadata.

## Planned data sources

These are deliberately deferred beyond Phase 0:

1. **TMDB** — canonical show/season metadata, artwork, translations and provider metadata.
2. **TVmaze** — episode-level air schedules and web-channel schedules.
3. **Official network/streamer sources** — renewal, production and announcement verification.

External APIs must be normalized into Series Hub's own schema. Source-specific payload shapes must not leak into the frontend contract.

## Core data principles

1. **Season is a first-class entity.** Renewal and release state belong primarily to a season, not only to a series.
2. **Original network/service and regional availability are separate concepts.**
3. **Chinese titles are aliases with locale/region/source metadata.**
4. **Every externally derived fact should remain attributable to a source.**
5. **No secrets in source control or frontend assets.** Runtime/API credentials remain secret-bound.
6. **No R2 in the initial architecture.** Image URLs can be referenced from upstream metadata until image storage has a demonstrated need.
7. **Applied migrations are immutable.** Future schema changes use new numbered migration files.
8. **PR validation never silently mutates production schema.** Schema migration is a separately controlled operation.

## Roadmap

- **Phase 0 — Complete:** deployable foundation, D1 model, empty API, browser-only CI/deployment path.
- **Phase 1 — Next:** TMDB US scripted-series MVP.
- **Phase 2:** TVmaze episode/schedule normalization.
- **Phase 3:** Chinese title and regional alias refinement.
- **Phase 4:** renewal / production / official-announcement lifecycle engine.
- **Phase 5:** personal tracking and optional notifications.
- **Phase 6:** expansion beyond US series.

## Phase 0 acceptance record

Completed and validated:

- static Worker assets and API routing;
- `/health` HTTP runtime endpoint;
- `/api/shows` JSON runtime endpoint;
- D1 database `series-hub-db` bound as `DB`;
- `0001_initial.sql` applied;
- eight core schema tables remotely verified;
- Worker dry-run with `env.DB` and `env.ASSETS` bindings;
- isolated Cloudflare Worker preview deployment;
- preview `/health` and `/api/shows` runtime validation;
- production `/health` and `/api/shows` runtime validation;
- browser-only GitHub Actions credential path using repository secrets;
- PR validation no longer provisions databases or mutates production schema;
- merges to `main` have an explicit GitHub Actions → Wrangler production deployment path.

## Project status

Phase 0 foundation is complete. External series data ingestion has not started. Phase 1 will introduce TMDB behind the existing normalization and API boundary.
