# Series Hub

Series Hub is a browser-first TV series aggregation project. The initial product scope is US scripted television and streaming series, organized around **series → seasons → episodes** rather than around streaming playback.

The product will surface three primary lifecycle views:

- **播映中 / Airing** — seasons currently releasing episodes.
- **即將播映 / Upcoming** — announced seasons with a confirmed premiere date.
- **計劃播出 / Planned** — renewed, ordered or in production seasons without a confirmed premiere date.

Chinese naming is a first-class data layer. A show may have different preferred titles and aliases for Hong Kong, Taiwan and Mainland China; these are stored separately instead of collapsing them into one `chinese_title` field.

## Current phase

**Phase 0 — Foundation**

Phase 0 intentionally contains no TMDB, TVmaze or official-network ingestion. It establishes a deployable baseline before external data is introduced.

### Phase 0 deliverables

- Cloudflare Worker with Static Assets
- `/health` API endpoint
- `/api/shows` empty baseline endpoint
- Vanilla HTML/CSS/JavaScript frontend
- Initial D1 schema and migration
- Architecture and data-model documentation
- GitHub → Cloudflare browser-only deployment workflow

## Architecture

```text
GitHub
  │
  │ push / PR
  ▼
Cloudflare Workers Builds
  │
  ▼
series-hub Worker
  ├── Static Assets (public/)
  └── /api/*
        │
        └── D1 binding: DB   (enabled after database creation)
```

Static files and API routes are intentionally deployed as one Cloudflare Worker. This reduces moving parts while keeping the frontend and backend logically separated.

## Browser-only development rule

The normal project workflow does **not** require a local clone, PowerShell, a local Node.js installation, Docker or Wrangler on the user's machine.

```text
GitHub branch
   ↓
Cloudflare preview build
   ↓
Review / browser testing
   ↓
Pull request
   ↓
main
   ↓
Production deployment
```

`package.json` pins Wrangler for Cloudflare Workers Builds; it is not a requirement for local development.

## Repository layout

```text
Series-Hub/
├── README.md
├── package.json
├── wrangler.jsonc
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

Returns service health and whether a D1 binding is currently configured.

### `GET /api/shows`

Before D1 is connected, returns an empty list and `databaseConfigured: false`. After D1 is connected and migrated, it reads the `shows` table.

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
5. **No secrets in GitHub or frontend assets.** API tokens belong in Cloudflare secrets/environment bindings.
6. **No R2 in the initial architecture.** Image URLs can be referenced from upstream metadata until image storage has a demonstrated need.

## Roadmap

- **Phase 0:** deployable foundation, D1 model, empty API.
- **Phase 1:** TMDB US scripted-series MVP.
- **Phase 2:** TVmaze episode/schedule normalization.
- **Phase 3:** Chinese title and regional alias refinement.
- **Phase 4:** renewal / production / official-announcement lifecycle engine.
- **Phase 5:** personal tracking and optional notifications.
- **Phase 6:** expansion beyond US series.

## Phase 0 acceptance criteria

Phase 0 is complete when:

- the Worker deploys from GitHub through Cloudflare Workers Builds;
- the static application loads successfully;
- `/health` returns HTTP 200;
- `/api/shows` returns a valid JSON response;
- a D1 database is created and bound as `DB`;
- migration `0001_initial.sql` has been applied successfully;
- a post-migration `/health` response reports the database binding as available.

## Project status

Foundation in progress. External series data ingestion has not started.
