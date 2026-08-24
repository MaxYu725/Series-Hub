# Series Hub

Series Hub is a browser-first US TV series aggregation project deployed through GitHub Actions to Cloudflare Workers + D1. The product is an information and tracking hub, not a streaming playback service.

The core model is **series → seasons → episodes**. Season is first-class because premiere dates, release cadence, episode counts and lifecycle state belong to a specific season rather than only to the parent show.

## Current status

**Phase 2 — TVmaze schedule integration**

Completed:

- Phase 0 — Cloudflare Worker/D1/GitHub browser-only foundation;
- Phase 1A — TMDB catalog core;
- Phase 1B — US scripted catalog quality, lifecycle and network balancing;
- Phase 2A — exact TVmaze mapping + normalized episode/schedule API;
- Phase 2B — Today / This Week schedule UI with browser-local timezone handling.

Next planned phase after Phase 2 acceptance is **Phase 3 — Chinese title and regional alias refinement/manual override layer**.

## Product views

Lifecycle catalog:

- **播映中 / Airing** — a current season is actively releasing episodes;
- **即將播映 / Upcoming** — a show/season has a confirmed future date;
- **計劃播出 / Planned** — returning / in-production series with no confirmed date yet.

Schedule views:

- **今日 / Today** — episodes that fall on the browser's local calendar day when a TVmaze airstamp is available;
- **本週 / This Week** — seven local calendar days starting today.

When TVmaze provides an `air_timestamp`, Series Hub converts it to the browser's local timezone. If only a source `air_date` / `air_time` exists, the UI explicitly labels it as TVmaze source timing instead of inventing a local time.

## Data-source responsibilities

### TMDB — canonical series metadata

TMDB remains authoritative inside Series Hub for normalized show/season metadata:

- series and season records;
- original and English titles;
- `zh-HK`, `zh-TW`, `zh-CN` aliases;
- posters/backdrops;
- genres;
- original networks/services;
- Series Hub lifecycle classification derived from TMDB facts;
- external IDs used for exact cross-source mapping.

### TVmaze — episode and schedule facts

TVmaze supplements:

- exact show mapping via IMDb first, TheTVDB fallback;
- season/episode numbers;
- episode names and summaries;
- air date/time/airstamp;
- runtime;
- episode images and TVmaze source URLs.

**No title fuzzy matching is used for production TVmaze linking.** A TVmaze schedule fact does not replace TMDB's canonical show identity or lifecycle state.

### Future official-source layer

Official network/streamer announcements are reserved for Phase 4 renewal / production / cancellation verification.

## Phase 2A live acceptance — 2026-08-24

Production audit after the first TVmaze bootstrap:

- active catalog: 28 series;
- exact TVmaze mappings: **28/28 (100%)**;
- shows with a retained latest TVmaze episode: **28/28**;
- shows with a future TVmaze episode: **17**;
- upcoming 14-day schedule at audit time: **15 episodes**;
- latest TVmaze sync status: `success`;
- representative exact mappings verified for Reacher, Lioness, Silo, Ted Lasso, Grey's Anatomy, The Rookie and Fargo.

The counts above are an acceptance snapshot, not a permanent catalog target.

## Architecture

```text
                    ┌──────────────┐
                    │     TMDB     │
                    └──────┬───────┘
                           │ metadata / external IDs
                           ▼
GitHub main ── Actions ──► Cloudflare Worker ◄──── TVmaze
                           │       │                   episode/schedule
                           │       ├── Static Assets
                           │       ├── Public API
                           │       └── Cron / sync
                           ▼
                    D1: series-hub-db
```

Production sync cadence:

- TMDB: minute 17 every six hours;
- TVmaze: minute 47 every six hours.

The two sync pipelines have separate `sync_runs` records so one source cannot hide the operational state of the other.

## Browser-only development rule

Normal project work does **not** require a local clone, PowerShell, local Node.js, Docker or a user-installed Wrangler environment.

```text
GitHub branch
   ↓
Pull request
   ↓
Isolated Worker + isolated D1
   ↓
Migrations + unit tests + runtime smoke tests
   ↓
Review / merge
   ↓
main
   ↓
Production migration → deployment → live validation
```

Every PR created from this repository receives:

- Worker: `series-hub-pr-N`;
- D1: `series-hub-pr-N`;
- no production TMDB secret;
- no cron triggers;
- automatic Worker/D1 deletion when the PR closes.

Unmerged code therefore cannot read/write production D1 or inherit the production TMDB credential.

## Current repository layout

```text
Series-Hub/
├── README.md
├── package.json
├── wrangler.jsonc
├── .github/workflows/
├── migrations/
│   ├── 0001_initial.sql
│   ├── 0002_phase1_tmdb.sql
│   ├── 0003_phase1b_catalog_scope.sql
│   ├── 0004_phase1b_excluded_genres.sql
│   └── 0005_phase2_tvmaze.sql
├── src/
│   ├── index.js
│   ├── tmdb.js
│   └── tvmaze.js
├── public/
│   ├── index.html
│   ├── styles.css
│   ├── app.js
│   └── schedule-utils.js
└── test/
    ├── tmdb.test.js
    ├── tvmaze.test.js
    └── schedule-ui.test.js
```

## Public API

### `GET /health`

Reports current service phase, D1 reachability, TMDB configuration and whether TVmaze scheduling is enabled.

### `GET /api/shows`

Query parameters:

- `status=airing|upcoming|planned|completed|unknown`
- `q=<English or Chinese title>`
- `limit=1..100`

The response includes normalized TMDB catalog data plus TVmaze-derived last/next episode dates when available.

### `GET /api/schedule`

Query parameters:

- `from=YYYY-MM-DD`
- `days=1..14`

Returns normalized TVmaze episode facts joined to Series Hub show/season/title/network data.

### `GET /api/shows/:id/episodes`

Returns retained normalized TVmaze episode records for one Series Hub show.

### `GET /api/sync-status?source=tmdb|tvmaze`

Returns the latest sync run for the requested source.

### Internal sync routes

- `POST /api/internal/tmdb-sync`
- `POST /api/internal/tvmaze-sync`

Both are protected by a one-way key derived from the production TMDB token. Preview Workers do not receive the token and cannot invoke production-style ingestion.

## Catalog scope

The initial catalog remains US scripted/miniseries, live-action focused. Broad discovery excludes non-target genres such as Animation, Documentary, Kids, News, Reality and Talk, and detail-level filtering repeats the protection before persistence.

Target networks/services include the major US broadcast, cable and streaming sources already represented in Phase 1B, including Apple TV, HBO, Prime Video, Netflix, FX/FXX, FOX, ABC, NBC, CBS, Paramount+, Hulu, Peacock and other selected scripted outlets.

## Core data principles

1. Season is a first-class entity.
2. Original network/service and regional availability are separate concepts.
3. Chinese titles remain separate HK/TW/CN aliases with provenance.
4. Source-specific facts retain source attribution.
5. TMDB and TVmaze responsibilities stay separated; cross-source data is normalized before use.
6. No secrets in source control or frontend assets.
7. Applied D1 migrations are immutable; schema changes use new numbered migrations.
8. Unmerged PR code never uses production D1 or application secrets.
9. Production migrations run before the Worker version that requires them.
10. R2 is not introduced until image storage has a demonstrated need.
11. No production TVmaze title fuzzy matching.
12. Local-time UI conversion is performed only when an actual timestamp exists.

## Roadmap

- **Phase 0 — Complete:** deployable Worker/D1 foundation and browser-only CI/deployment.
- **Phase 1A — Complete:** TMDB US scripted catalog core.
- **Phase 1B — Complete:** catalog scope, quality, lifecycle and network balancing.
- **Phase 2A — Complete:** exact TVmaze mapping and episode/schedule normalization.
- **Phase 2B — In validation:** Today / This Week schedule UI and timezone-safe display.
- **Phase 3:** Chinese title refinement and manual override layer.
- **Phase 4:** official renewal / cancellation / production lifecycle engine.
- **Phase 5:** personal tracking and optional notifications.
- **Phase 6:** expansion beyond US series.

## Phase 2B acceptance requirements

Phase 2B is complete only when:

- all unit tests pass, including timezone/day-boundary cases;
- isolated PR Worker + D1 validation passes;
- Today and This Week render from `/api/schedule` without changing the lifecycle catalog contract;
- source timing without a timestamp is visibly distinguished from converted local time;
- TMDB and TVmaze attribution are present;
- production deployment retains healthy catalog and schedule APIs;
- final production UI/API contract audit passes.
