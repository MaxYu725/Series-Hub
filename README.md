# Series Hub

Series Hub is a browser-first TV series aggregation project. The initial product scope is US scripted television and streaming series, organized around **series → seasons → episodes** rather than around streaming playback.

The product surfaces three primary lifecycle views:

- **播映中 / Airing** — a current season is actively releasing episodes.
- **即將播映 / Upcoming** — a series or new season has a confirmed future date.
- **計劃播出 / Planned** — returning / in-production series with no confirmed future date yet.

Chinese naming is a first-class data layer. A show may have separate preferred titles and aliases for Hong Kong, Taiwan and Mainland China; these are stored separately rather than collapsed into one `chinese_title` field.

## Current phase

**Phase 1 — TMDB US scripted-series MVP**

### Phase 1A — TMDB catalog core

Current implementation includes:

- TMDB server-side client using a Worker secret;
- US scripted/miniseries filtering;
- live-action focus (animation excluded from the initial catalog);
- Series Hub lifecycle normalization independent from raw TMDB status;
- show, season, network and genre normalization into D1;
- separate `zh-HK`, `zh-TW` and `zh-CN` aliases where TMDB provides them;
- poster/backdrop URLs through TMDB image infrastructure;
- `/api/shows` filtering/search API;
- `/api/sync-status` operational endpoint;
- scheduled catalog refresh every six hours;
- protected on-demand sync for deployment bootstrap;
- TMDB attribution/credits in the frontend;
- unit tests for filtering, lifecycle and title normalization.

Live ingestion remains inactive until the repository secret `TMDB_API` is configured. The secret value is never stored in source control or exposed to PR preview Workers.

## Architecture

```text
                         ┌──────────────┐
                         │     TMDB     │
                         └──────┬───────┘
                                │ Bearer token
                                ▼
GitHub main ── Actions ──► series-hub Worker
                                │
                    ┌───────────┼────────────┐
                    ▼           ▼            ▼
               Static Assets   API      Cron / sync
                                │            │
                                └──────┬─────┘
                                       ▼
                                  D1: series-hub-db
```

PR validation is fully isolated:

```text
PR #N
  │
  ├── Worker: series-hub-pr-N
  ├── D1:     series-hub-pr-N
  ├── no production TMDB secret
  └── deleted automatically when PR closes
```

This prevents unmerged code from accessing production D1 data or production application secrets.

## Browser-only development rule

The normal project workflow does **not** require a local clone, PowerShell, a local Node.js installation, Docker or Wrangler on the user's machine.

```text
GitHub branch
   ↓
Pull request
   ↓
Isolated Worker + isolated D1
   ↓
Migrations + tests + runtime smoke tests
   ↓
Review / merge
   ↓
main
   ↓
Production migration → deployment → live validation
```

## Repository layout

```text
Series-Hub/
├── README.md
├── package.json
├── wrangler.jsonc
├── .github/
│   └── workflows/
├── src/
│   ├── index.js
│   └── tmdb.js
├── test/
│   └── tmdb.test.js
├── public/
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── migrations/
│   ├── 0001_initial.sql
│   └── 0002_phase1_tmdb.sql
└── docs/
    ├── ARCHITECTURE.md
    ├── CLOUDFLARE_SETUP.md
    ├── DATA_MODEL.md
    └── PHASE1_TMDB.md
```

## API

### `GET /health`

Reports service phase, D1 status and whether the production TMDB secret is configured.

### `GET /api/shows`

Supported query parameters:

- `status=airing|upcoming|planned|completed|unknown`
- `q=<English or Chinese title>`
- `limit=1..100`

The public response is built from Series Hub's normalized D1 schema; raw TMDB payloads are never forwarded to the frontend.

### `GET /api/sync-status`

Returns the latest TMDB catalog-sync run from `sync_runs`.

### `POST /api/internal/tmdb-sync`

Internal deployment/bootstrap endpoint protected by a one-way key derived from the production TMDB token. It is not a public administration API and preview Workers do not receive the TMDB secret required to authorize it.

## Data sources

1. **TMDB — Phase 1:** series/season metadata, artwork, translations, networks and genres.
2. **TVmaze — Phase 2:** episode-level dates/times and streaming/broadcast schedules.
3. **Official network/streamer sources — Phase 4:** renewal, production and announcement verification.

Source payloads are normalized before storage/use. A source-specific status or field must not become the application's canonical contract merely because one provider exposes it.

## Core data principles

1. **Season is a first-class entity.** Renewal and release state belong primarily to a season, not only to a series.
2. **Original network/service and regional availability are separate concepts.**
3. **Chinese titles are aliases with locale/region/source metadata.**
4. **Externally derived facts remain attributable to a source.**
5. **No secrets in source control or frontend assets.**
6. **No R2 until image storage has a demonstrated need.**
7. **Applied migrations are immutable.** Schema changes use new numbered migration files.
8. **Unmerged code never uses production D1 or production TMDB credentials.**
9. **Production migrations run before the Worker version that requires them is deployed.**
10. **TMDB raw status is retained separately from Series Hub lifecycle classification.**

## Roadmap

- **Phase 0 — Complete:** deployable Worker/D1 foundation and browser-only CI/deployment.
- **Phase 1A — In progress:** TMDB catalog core and first live US scripted catalog.
- **Phase 1B:** catalog coverage/quality review, network/platform targeting and lifecycle corrections from live data.
- **Phase 2:** TVmaze episode/schedule normalization.
- **Phase 3:** Chinese title and regional alias refinement/manual override layer.
- **Phase 4:** renewal / production / official-announcement lifecycle engine.
- **Phase 5:** personal tracking and optional notifications.
- **Phase 6:** expansion beyond US series.

## Phase 0 acceptance record

Completed and validated:

- Cloudflare Worker Static Assets + API routing;
- production D1 `series-hub-db` bound as `DB`;
- initial eight-table schema;
- PR-specific D1 provisioning/migration validation;
- isolated Worker preview runtime validation;
- production runtime validation;
- automatic preview resource cleanup;
- explicit GitHub Actions → Wrangler production deployment path.

## Project status

Phase 0 is complete. Phase 1A code is being validated before production migration/deployment and live TMDB ingestion.
