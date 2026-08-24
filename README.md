# Series Hub

Series Hub is a browser-first US TV series aggregation project deployed through GitHub Actions to Cloudflare Workers + D1. It is an information and tracking hub, not a streaming playback service.

The core model is **series → seasons → episodes**. Season is first-class because premiere dates, release cadence, episode counts and lifecycle state belong to a specific season rather than only to the parent show.

## Current status

**Phase 3 — Chinese regional titles and manual override: COMPLETE**

Completed:

- Phase 0 — Cloudflare Worker/D1/GitHub browser-only foundation;
- Phase 1A — TMDB catalog core;
- Phase 1B — US scripted catalog quality, lifecycle and network balancing;
- Phase 2A — exact TVmaze mapping + normalized episode/schedule API;
- Phase 2B — Today / This Week schedule UI with browser-local timezone handling and production live acceptance;
- Phase 3A — HK/TW/CN preferred-title resolution, provenance, fallback and controlled manual override;
- Phase 3B — production title-quality audit and proof that editorial overrides survive a real TMDB refresh.

**Next planned phase: Phase 4 — official renewal / cancellation / production lifecycle engine.**

## Product views

Lifecycle catalog:

- **播映中 / Airing** — a current season is actively releasing episodes;
- **即將播映 / Upcoming** — a show/season has a confirmed future date;
- **計劃播出 / Planned** — returning / in-production series with no confirmed date yet.

Schedule views:

- **今日 / Today** — episodes that fall on the browser's local calendar day when a TVmaze airstamp is available;
- **本週 / This Week** — seven local calendar days starting today.

When TVmaze provides an `air_timestamp`, Series Hub converts it to the browser's local timezone for date grouping and time display. If only a source `air_date` / `air_time` exists, the UI explicitly labels it as TVmaze source timing instead of inventing a local time.

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

## Phase 2 live acceptance — 2026-08-24

### Phase 2A mapping acceptance

Production audit after the first TVmaze bootstrap:

- active catalog: **28 series**;
- exact TVmaze mappings: **28/28 (100%)**;
- shows with a retained latest TVmaze episode: **28/28**;
- shows with a future TVmaze episode: **17**;
- upcoming 14-day schedule at audit time: **15 episodes**;
- TVmaze sync status: `success`;
- representative exact mappings verified for Reacher, Lioness, Silo, Ted Lasso, Grey's Anatomy, The Rookie and Fargo.

### Phase 2B production UI acceptance

Final production live audit after merging the Today / This Week interface:

- production Phase 2B assets detected successfully;
- active catalog remained **28 series**;
- 14-day schedule: **15 episodes**;
- Chinese-title coverage in the 14-day schedule: **15/15**;
- schedule rows with usable TVmaze airstamps in this snapshot: **15/15**;
- source-date-only rows in this snapshot: **0**; fallback behavior remains covered by unit tests;
- latest TVmaze sync status: `success`;
- latest audited TVmaze run: **10 shows seen / 46 episode rows changed**;
- all **28 tests passed** including timezone/day-boundary behavior;
- fresh isolated D1 rebuild `0001 → 0005` passed;
- isolated preview Worker runtime passed;
- production regression passed.

The first Phase 2B audit sampled the sync endpoint while the post-deploy TVmaze bootstrap was still `running`. The audit was corrected to wait for a terminal sync state while still accepting only `success` / `success_with_warnings`; the repeated audit passed. No production product defect was involved.

Acceptance counts are snapshots, not permanent catalog targets.

## Phase 3 live acceptance — 2026-08-24

- active catalog: **28 series**;
- any Chinese title: **28/28 (100%)**;
- HK-specific titles: **28/28 (100%)**;
- TW-specific titles: **28/28 (100%)**;
- CN-specific titles: **24/28 (85.7%)**;
- manual preferred-title shows: **1**;
- verified editorial case: **The Shards → 青春碎片 (HK)**, `manual / official`;
- real post-override TMDB refresh: `success`, **137 candidates seen / 23 shows changed**;
- the manual HK preferred alias survived that refresh;
- Chinese alias search, fallback metadata and unauthenticated-write rejection were live-verified;
- **36/36 tests**, isolated D1/Worker preview and production regression passed.

The four CN-specific gaps (`Ted Lasso`, `Wednesday`, `For All Mankind`, `Severance`) intentionally use fallback until reliable mainland-China-specific evidence exists. Coverage is not a reason to invent a regional title.

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

Production Worker:

```text
https://series-hub.max-yu-jp.workers.dev
```

Production D1:

```text
series-hub-db
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

Every repository PR receives:

- Worker: `series-hub-pr-N`;
- D1: `series-hub-pr-N`;
- no production TMDB secret;
- no cron triggers;
- automatic Worker/D1 deletion when the PR closes.

Unmerged code therefore cannot read/write production D1 or inherit the production application secret.

## Repository layout

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
│   ├── 0005_phase2_tvmaze.sql
│   └── 0006_phase3_title_aliases.sql
├── src/
│   ├── index.js
│   ├── tmdb.js
│   ├── tvmaze.js
│   ├── title-aliases.js
│   └── title-admin.js
├── public/
│   ├── index.html
│   ├── styles.css
│   ├── phase3.css
│   ├── app.js
│   └── schedule-utils.js
└── test/
    ├── tmdb.test.js
    ├── tvmaze.test.js
    └── schedule-ui.test.js
```

Temporary production-audit test files are intentionally kept only on audit branches and are closed without merge.

## Public API

### `GET /health`

Reports current service phase, D1 reachability, TMDB configuration and whether TVmaze scheduling is enabled.

Current production phase identifier:

```text
3-regional-titles
```

### `GET /api/shows`

Query parameters:

- `status=airing|upcoming|planned|completed|unknown`
- `q=<English or Chinese title>`
- `limit=1..100`
- `region=HK|TW|CN` (default `HK`)

The response includes normalized TMDB catalog data plus TVmaze-derived last/next episode dates when available.

### `GET /api/schedule`

Query parameters:

- `from=YYYY-MM-DD`
- `days=1..14`
- `region=HK|TW|CN` (default `HK`)

Returns normalized TVmaze episode facts joined to Series Hub show/season/title/network data.

### `GET /api/title-audit`

Reports HK/TW/CN coverage, missing regional titles and manual preferred-title usage.

### `GET /api/shows/:id/aliases`

Returns all attributed aliases plus the resolved regional preferred title.

### `GET /api/shows/:id/episodes`

Returns retained normalized TVmaze episode records for one Series Hub show.

### `GET /api/sync-status?source=tmdb|tvmaze`

Returns the latest sync run for the requested source.

### Internal sync routes

- `POST /api/internal/tmdb-sync`
- `POST /api/internal/tvmaze-sync`
- `POST /api/internal/title-override`

Both are protected by a one-way key derived from the production TMDB token. Preview Workers do not receive the token and cannot invoke production-style ingestion.

## Catalog scope

The initial catalog remains US scripted/miniseries, live-action focused. Broad discovery excludes non-target genres such as Animation, Documentary, Kids, News, Reality and Talk, and detail-level filtering repeats the protection before persistence.

Target networks/services include major US broadcast, cable and streaming sources represented in Phase 1B, including Apple TV, HBO, Prime Video, Netflix, FX/FXX, FOX, ABC, NBC, CBS, Paramount+, Hulu, Peacock and other selected scripted outlets.

## Timezone rules

Phase 2B deliberately distinguishes two cases:

1. **TVmaze has `air_timestamp`:** convert the timestamp into the browser's local timezone and group the episode under that local calendar date.
2. **TVmaze has only source date/time:** preserve `air_date` / `air_time` and label it as source timing; do not fabricate a local time.

The frontend requests a one-day buffer around the local schedule window so a US evening broadcast that becomes the following date in an UTC+ timezone is not dropped from Today / This Week.

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
13. A successful deployment is not sufficient acceptance by itself; production API/UI contracts are live-audited at phase boundaries.

## Roadmap

- **Phase 0 — Complete:** deployable Worker/D1 foundation and browser-only CI/deployment.
- **Phase 1A — Complete:** TMDB US scripted catalog core.
- **Phase 1B — Complete:** catalog scope, quality, lifecycle and network balancing.
- **Phase 2A — Complete:** exact TVmaze mapping and episode/schedule normalization.
- **Phase 2B — Complete:** Today / This Week schedule UI and timezone-safe display.
- **Phase 3 — Complete:** regional Chinese title policy, fallback, provenance, live audit and protected manual override.
- **Phase 4 — Next:** official renewal / cancellation / production lifecycle engine.
- **Phase 5:** personal tracking and optional notifications.
- **Phase 6:** expansion beyond US series.

## Phase 4 handoff

Phase 4 adds attributed official renewal / cancellation / production-state evidence without weakening the Phase 3 title contract. Retain source URL/date/confidence and affected season where possible; do not infer cancellation or production state merely to fill a gap. Start with a small set of high-value official sources and keep the browser-only GitHub → isolated preview → Cloudflare production workflow.
