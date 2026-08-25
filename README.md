# Series Hub

Series Hub is a browser-first US TV series aggregation and tracking project deployed through GitHub Actions to Cloudflare Workers + D1. It is an information/tracking hub, not a streaming playback service.

The core model is **series → seasons → episodes**. Season is first-class because premiere dates, release cadence, episode counts and lifecycle evidence belong to a specific season rather than only to the parent show.

## Current status

**Phase 5A — browser-local My Shows tracking: COMPLETE and production-accepted.**

Completed:

- Phase 0 — Cloudflare Worker/D1/GitHub browser-only foundation;
- Phase 1A — TMDB catalog core;
- Phase 1B — US scripted catalog quality, lifecycle classification and network balancing;
- Phase 2A — exact TVmaze mapping + normalized episode/schedule API;
- Phase 2B — Today / This Week schedule UI with browser-local timezone handling;
- Phase 3A — HK/TW/CN preferred-title resolution, provenance, fallback and controlled manual override;
- Phase 3B — title-quality production audit and proof that editorial overrides survive TMDB refreshes;
- Phase 4A–4F — attributed official renewal/cancellation/production evidence, visible UI projection, verified official source registry and production acceptance across Apple, Amazon, WBD/HBO, Netflix and FOX;
- Phase 5A — local-only show tracking and the **我的劇集 / My Shows** view without accounts or server-side user data.

**Next planned phase: Phase 5B — deepen local tracking usefulness before considering notification infrastructure or accounts.**

A likely 5B direction is tracked-only schedule filtering and/or local per-show states such as watching / waiting / completed. True background notifications should remain a separate phase because they require service-worker/push subscription design rather than only browser `localStorage`.

## Product views

Catalog:

- **播映中 / Airing** — a current season is actively releasing episodes;
- **即將播映 / Upcoming** — a show/season has a confirmed future date;
- **計劃播出 / Planned** — returning / in-production series with no confirmed date yet;
- **我的劇集 / My Shows** — shows selected by the user in this browser, with current catalog metadata re-fetched from the normal API.

Schedule:

- **今日 / Today** — episodes that fall on the browser's local calendar day when a TVmaze airstamp is available;
- **本週 / This Week** — seven local calendar days starting today.

When TVmaze provides an `air_timestamp`, Series Hub converts it to the browser's local timezone for date grouping and time display. If only source `air_date` / `air_time` exists, the UI labels it as source timing rather than inventing a local time.

## Phase 5A tracking policy

Phase 5A intentionally does **not** create an account system.

- local storage key: `series-hub-tracked-shows-v1`;
- only stable Series Hub show IDs are persisted;
- metadata is not copied into local storage;
- My Shows reuses the existing `airing`, `upcoming` and `planned` catalog APIs;
- no `/api/tracking` or `/api/favorites` endpoint exists;
- no D1 user/profile/favorites table exists;
- no new cron job exists;
- no user data is sent to the backend by the tracking feature.

This keeps personalization reversible and low-risk while the product UX is still being validated.

## Data-source responsibilities

### TMDB — canonical catalog metadata

TMDB supplies/anchors:

- series and season records;
- original and English titles;
- `zh-HK`, `zh-TW`, `zh-CN` aliases;
- posters/backdrops;
- genres;
- original networks/services;
- base Series Hub lifecycle classification;
- external IDs used for exact cross-source mapping.

The US scripted catalog discovery budget remains bounded. FOX uses a rolling recent first-air window so its current slate is not crowded out by historical popularity results; already-selected TMDB detail responses are allowed to persist up to the detail limit instead of being discarded by a lower unrelated cap.

### TVmaze — episode and schedule facts

TVmaze supplements:

- exact show mapping via IMDb first, TheTVDB fallback;
- season/episode numbers;
- episode names and summaries;
- air date/time/airstamp;
- runtime;
- episode images and TVmaze source URLs.

**No title fuzzy matching is used for production TVmaze linking.** TVmaze schedule facts do not replace TMDB canonical identity or lifecycle classification.

### Official lifecycle sources — attributed evidence

Phase 4 adds a separate event-sourced evidence layer. Official evidence does **not** overwrite `shows.status`, `shows.tmdb_status` or the normal catalog lifecycle.

Verified official publishing surfaces through Phase 4F:

| Source key | Publisher / surface |
| --- | --- |
| `apple_tv_press` | Apple TV Press |
| `wbd_pressroom` | Warner Bros. Discovery / HBO Pressroom |
| `amazon_entertainment` | Amazon Entertainment |
| `netflix_media_center` | Netflix Media Center |
| `netflix_tudum` | Netflix Tudum |
| `fox_flash` | FOXFLASH |

See [`docs/PHASE4_LIFECYCLE.md`](docs/PHASE4_LIFECYCLE.md) for the complete evidence contract, normalization rules and collector gate.

## Phase 4 production acceptance

Production acceptance through Phase 4F includes:

1. **Silo** — season 3 renewed; season 4 renewed/final via Apple TV Press.
2. **For All Mankind** — season 6 final-season decision plus conservative production-state evidence via Apple TV Press.
3. **Reacher** — season 5 renewed via Amazon Entertainment while the catalog remained independently `airing`.
4. **House of the Dragon** — season 4 renewed via WBD/HBO Pressroom.
5. **Wednesday** — season 3 renewed plus independent `filming` evidence via Netflix Tudum.
6. **Murder in a Small Town** — naturally ingested after FOX catalog-coverage repairs; season 3 renewal anchored to FOXFLASH.

The FOX work also exposed and repaired two general catalog issues instead of bypassing them with orphan evidence: current FOX discovery was hidden by historical popularity results, and selected TMDB detail records were previously capped below the already-paid detail request limit.

## Phase 5A production acceptance

Production audit after merging Phase 5A confirmed:

- homepage serves the `Phase 5A` marker and **我的劇集** control;
- `phase5.css`, `phase5-ui.js` and `tracking.js` are live;
- versioned local tracking storage is present;
- My Shows continues to use `/api/shows` rather than a new user-data endpoint;
- `/health` remains healthy;
- the existing catalog API remains readable;
- standard isolated Cloudflare validation also passed unit tests, fresh D1 migrations, Worker build, preview runtime and production regression.

Production-network probes remain explicit audit workflows and are never placed in the default `npm test` suite.

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
                           │       ├── Lifecycle evidence projection
                           │       └── Cron / sync
                           ▼
                    D1: series-hub-db

Browser localStorage
      │
      └── tracked Series Hub show IDs only
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

The two source pipelines have separate `sync_runs` records so one source cannot hide the operational state of the other.

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

Every normal repository PR receives an isolated preview Worker/D1, no production TMDB secret and no cron triggers. Preview resources are deleted when the PR closes. Unmerged application code therefore cannot write production D1.

Dedicated production-audit PRs may read public production endpoints only; audit-only files are closed without merge.

## Repository layout

```text
Series-Hub/
├── README.md
├── docs/
│   └── PHASE4_LIFECYCLE.md
├── package.json
├── wrangler.jsonc
├── .github/workflows/
├── migrations/
│   ├── 0001_initial.sql
│   ├── 0002_phase1_tmdb.sql
│   ├── 0003_phase1b_catalog_scope.sql
│   ├── 0004_phase1b_excluded_genres.sql
│   ├── 0005_phase2_tvmaze.sql
│   ├── 0006_phase3_title_aliases.sql
│   ├── 0007_phase4_lifecycle_evidence.sql
│   ├── 0008_phase4a_initial_official_evidence.sql
│   ├── 0009_phase4c_official_sources.sql
│   ├── 0010_phase4d_amazon_reacher_evidence.sql
│   ├── 0011_phase4e_netflix_tudum_source.sql
│   ├── 0012_phase4e_wbd_netflix_evidence.sql
│   └── 0013_phase4f_fox_murder_small_town_evidence.sql
├── src/
│   ├── index.js
│   ├── phase4-worker.js
│   ├── lifecycle.js
│   ├── lifecycle-admin.js
│   ├── tmdb.js
│   ├── tvmaze.js
│   ├── title-aliases.js
│   └── title-admin.js
├── public/
│   ├── index.html
│   ├── app.js
│   ├── phase4-ui.js
│   ├── phase5-ui.js
│   ├── tracking.js
│   ├── schedule-utils.js
│   ├── styles.css
│   ├── phase3.css
│   ├── phase4.css
│   └── phase5.css
└── test/
```

## Public API

### `GET /health`

Reports service health, D1 reachability and source configuration. The historical internal phase identifier may remain `3-regional-titles`; user-facing feature phase is tracked separately and must not be inferred solely from this legacy identifier.

### `GET /api/shows`

Query parameters:

- `status=airing|upcoming|planned|completed|unknown`
- `q=<English or Chinese title>`
- `limit=1..100`
- `region=HK|TW|CN` (default `HK`)

Returns normalized TMDB catalog data plus TVmaze-derived last/next episode dates when available.

### `GET /api/schedule`

Query parameters:

- `from=YYYY-MM-DD`
- `days=1..14`
- `region=HK|TW|CN` (default `HK`)

Returns normalized TVmaze episode facts joined to Series Hub show/season/title/network data.

### `GET /api/lifecycle`

Returns the active official lifecycle projection for catalog shows. It exists so the frontend can decorate cards without one lifecycle request per show.

### `GET /api/shows/:id/lifecycle`

Returns attributed active lifecycle evidence and decision/production/schedule summaries for one show.

### `GET /api/title-audit`

Reports HK/TW/CN title coverage, missing regional titles and manual preferred-title usage.

### `GET /api/shows/:id/aliases`

Returns attributed aliases plus the resolved regional preferred title.

### `GET /api/shows/:id/episodes`

Returns retained normalized TVmaze episode records for one Series Hub show.

### `GET /api/sync-status?source=tmdb|tvmaze`

Returns the latest sync run for the requested source.

### Protected internal routes

- `POST /api/internal/tmdb-sync`
- `POST /api/internal/tvmaze-sync`
- `POST /api/internal/title-override`
- `POST /api/internal/lifecycle-evidence`

Internal writes are protected by the existing derived authorization-key contract. Preview Workers do not receive the production TMDB token.

## Catalog scope

The initial catalog remains US scripted/miniseries, live-action focused. Broad discovery excludes Animation, Documentary, Kids, News, Reality and Talk, and detail-level filtering repeats the protection before persistence.

Target networks/services include major US broadcast, cable and streaming sources such as Apple TV, HBO, Prime Video, Netflix, FX/FXX, FOX, ABC, NBC, CBS, Paramount+, Hulu and Peacock.

## Timezone rules

1. **TVmaze has `air_timestamp`:** convert it into the browser local timezone and group the episode under that local calendar date.
2. **Only source date/time exists:** preserve `air_date` / `air_time`, label it as source timing and do not fabricate a local timestamp.

The frontend requests a one-day buffer around the local schedule window so a US evening broadcast that becomes the following date in a UTC+ timezone is not dropped from Today / This Week.

## Core data principles

1. Season is first-class.
2. Original network/service and regional availability are separate concepts.
3. Chinese titles remain separate HK/TW/CN aliases with provenance.
4. Source-specific facts retain attribution.
5. TMDB, TVmaze and official lifecycle evidence have separate responsibilities.
6. Official lifecycle evidence is non-destructive and event-sourced.
7. No secrets in source control or frontend assets.
8. Applied D1 migrations are immutable; changes use new numbered migrations.
9. Unmerged application PR code never uses production D1 or application secrets.
10. Production migrations run before the Worker version that requires them.
11. R2 is not introduced until image storage has a demonstrated need.
12. No production TVmaze title fuzzy matching.
13. Local-time conversion is performed only when a real timestamp exists.
14. Deployment success alone is not acceptance; production contracts are audited at phase boundaries.
15. Production-network probes must stay outside the default unit-test suite.
16. Personalization should remain local-first until server-side identity provides a demonstrated product benefit.

## Roadmap

- **Phase 0 — Complete:** Worker/D1 foundation and browser-only CI/deployment.
- **Phase 1A — Complete:** TMDB US scripted catalog core.
- **Phase 1B — Complete:** catalog scope, quality, lifecycle classification and network balancing.
- **Phase 2A — Complete:** exact TVmaze mapping and episode/schedule normalization.
- **Phase 2B — Complete:** Today / This Week schedule UI and timezone-safe display.
- **Phase 3 — Complete:** regional Chinese title policy, fallback, provenance, live audit and protected manual override.
- **Phase 4 — Complete through 4F:** official renewal/cancellation/production evidence, source registry, UI projection and Apple/Amazon/WBD/Netflix/FOX production acceptance.
- **Phase 5A — Complete:** browser-local My Shows tracking.
- **Phase 5B — Next:** increase local tracking utility, preferably tracked-only schedule and/or local viewing states before adding infrastructure.
- **Later Phase 5:** evaluate opt-in notification architecture only after notification triggers and service-worker/push requirements are explicitly designed.
- **Phase 6:** expansion beyond US series.

## Handoff checkpoint

As of the Phase 5A production acceptance, the safest continuation point is **Phase 5B**. Do not rebuild Phase 4 or reseed already accepted official evidence. Preserve the browser-only GitHub → isolated preview → Cloudflare workflow, keep production probes in dedicated audit workflows, and prefer reversible local personalization before introducing accounts or server-side user data.
