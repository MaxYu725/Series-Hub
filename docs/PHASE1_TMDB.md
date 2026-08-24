# Phase 1 — TMDB US Scripted-Series MVP

## Goal

Phase 1 establishes the first real Series Hub catalog. TMDB supplies discovery and canonical metadata, while Series Hub owns filtering, lifecycle classification, storage and the frontend contract.

TMDB is not treated as the application's database. Every accepted item is normalized into D1 before the public API reads it.

## Phase 1A scope

Included:

- US-origin scripted series and miniseries;
- live-action catalog only for the initial MVP;
- English/original title;
- HK/TW/CN Chinese titles when present in TMDB translations;
- poster and backdrop URLs;
- networks and genres;
- season metadata;
- raw TMDB status plus independent Series Hub lifecycle;
- popularity/rating metadata;
- scheduled and deployment-triggered refresh;
- searchable/filterable frontend catalog.

Deferred:

- per-episode schedules (Phase 2 / TVmaze);
- watch-provider/JustWatch availability;
- manual Chinese-title overrides (Phase 3);
- official renewal/production verification (Phase 4);
- user tracking/notifications.

## Inclusion rules

A TMDB series is accepted into the initial catalog only when:

1. `origin_country` contains `US`;
2. type is `Scripted` or `Miniseries`;
3. Animation genre is absent.

These rules intentionally optimize for a small, understandable first catalog. They can be widened after live-data quality review.

## Lifecycle normalization

TMDB status is preserved in `shows.tmdb_status`. Series Hub separately writes `shows.status`.

Current order of precedence:

1. first air date is future → `upcoming`;
2. a future `next_episode_to_air` exists → `airing`;
3. a future season air date exists → `upcoming`;
4. a non-terminal series aired within the last 35 days → `airing`;
5. TMDB status `Ended` or `Canceled` → `completed`;
6. TMDB status `Returning Series`, `In Production`, `Planned` or `Pilot` → `planned`;
7. otherwise → `unknown`.

This deliberately avoids exposing TMDB's own status vocabulary as the Series Hub UI contract.

## Chinese titles

The first automated layer reads appended TMDB translations and records only `zh` translations for:

- HK → Hong Kong
- TW → Taiwan
- CN → Mainland China

The frontend display priority is HK → TW → CN. Distinct regional names are shown together; identical names are de-duplicated.

TMDB translations remain `confidence=normal`. Phase 3 will add a manual/preferred override layer rather than editing source-derived records in place.

## Sync model

The catalog refresh is bounded for the MVP:

- discover: first 2 US-TV popularity pages;
- detail requests: batches of 5;
- accepted/upserted shows: default 24, hard cap 30 per run;
- schedule: every 6 hours at minute 17 UTC.

The small first catalog is intentional. Phase 1B will evaluate coverage before increasing discovery breadth.

Each run is recorded in `sync_runs` with source, status, records seen/changed and an error summary when applicable.

## Secret model

Production Worker secret:

```text
TMDB_API_TOKEN
```

GitHub Actions source secret:

```text
TMDB_API
```

On a production deploy, GitHub Actions can send `TMDB_API` to Wrangler through a temporary secrets file. The temporary file is deleted inside the runner and is never committed.

PR previews are separate Workers (`series-hub-pr-N`) with separate D1 databases (`series-hub-pr-N`). They do not receive `TMDB_API_TOKEN` and their health smoke test explicitly requires `tmdbConfigured: false`.

## First live-ingestion path

After Phase 1A is merged:

1. production migration `0002_phase1_tmdb.sql` runs;
2. Phase 1 Worker deploys;
3. if repository secret `TMDB_API` exists, deployment injects it as `TMDB_API_TOKEN`;
4. CI derives a one-way sync key from the token and calls `POST /api/internal/tmdb-sync`;
5. the Worker verifies that key and performs the first bounded TMDB sync;
6. CI requires a non-empty catalog and verifies `/health`, `/api/shows` and `/api/sync-status`.

If `TMDB_API` is absent, the Phase 1 core still deploys safely but live ingestion remains disabled and `/health` reports `tmdbConfigured: false`.

## Phase 1A acceptance criteria

- all unit tests pass;
- fresh PR D1 successfully applies `0001` + `0002`;
- isolated PR Worker deploys without production secrets;
- preview `/health` reports Phase 1 and reachable preview D1;
- preview `/api/shows` and `/api/sync-status` return valid contracts;
- existing production Phase 0 endpoints remain healthy during PR review;
- after merge, production migration precedes Phase 1 Worker deployment;
- with `TMDB_API` configured, first live sync inserts at least one show and production `/api/shows` is non-empty.

## Phase 1B review targets

After live data is visible, review actual examples rather than expanding scope immediately:

- whether important Apple TV+, HBO/Max, Amazon, FX, FOX and major broadcast titles are present;
- false positives from the broad US-origin discovery pool;
- `airing` vs `upcoming` vs `planned` accuracy;
- how often HK/TW/CN translated titles are missing or unsuitable;
- whether platform/network metadata is sufficient before adding regional watch-provider data;
- whether discovery needs curated network/service passes in addition to popularity discovery.
