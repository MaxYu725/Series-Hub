# Phase 4 lifecycle evidence

Phase 4 adds official renewal, cancellation and production-state evidence without replacing the TMDB/TVmaze catalog and schedule layers.

## 4A scope

Phase 4A establishes the evidence model and editorial ingestion path. It does **not** automatically scrape every studio/network and does **not** directly overwrite `shows.status`, `shows.tmdb_status` or `seasons.production_status`.

The evidence layer is event-sourced so facts can coexist over time. A renewal announcement, later filming announcement and eventual final-season announcement are separate attributed records rather than destructive updates.

## Supported normalized events

Decision events:

- `renewed`
- `ordered`
- `cancelled`
- `final_season`
- `ended`

Production events:

- `pre_production`
- `filming`
- `wrapped`
- `post_production`
- `production_paused`

Schedule evidence:

- `premiere_dated`
- `delayed`

Each event retains:

- Series Hub show ID;
- optional existing season ID;
- season number even if the season row does not exist yet;
- normalized event type;
- registered source;
- exact evidence URL;
- official page/article title;
- publication date;
- confidence;
- short editorial note;
- retraction state and reason.

## Source rules

`official` confidence is accepted only from a source registered with `trust_level=official`. The submitted URL must match that source's registered HTTPS host and path prefix.

The first Phase 4A source is `apple_tv_press` (`https://www.apple.com/tv-pr/`). More official sources are added deliberately after their stable canonical URLs and evidence format are verified.

Do not paste long source text into D1. `evidence_note` is a short editorial summary only; the exact official URL remains the evidence anchor.

## Public projection

`GET /api/shows/:id/lifecycle`

returns all active attributed events for one show plus a non-destructive current summary:

- latest decision evidence;
- latest production evidence;
- latest schedule evidence;
- the same projection grouped by season.

A `final_season` decision and `pre_production`/`filming` state can therefore be represented at the same time.

## Editorial mutation

`POST /api/internal/lifecycle-evidence` is protected by the existing internal authorization-key contract. Normal browser-only operation uses the GitHub Actions workflow `Lifecycle evidence editorial`.

Supported actions:

- `upsert`: insert or idempotently refresh one evidence event;
- `retract`: preserve a bad/obsolete evidence record but remove it from the active projection.

The evidence key is deterministic from show, season, event type, source and publication identity, so rerunning the same editorial action is safe.

## First live acceptance targets

Phase 4A should be production-validated with official Apple TV Press evidence already relevant to the active catalog:

1. `Silo` — renewal through seasons 3 and 4, with season 4 identified as final (Apple TV Press, 2024-12-16).
2. `For All Mankind` — season 6 renewed as the final season, with the official release stating it was about to enter production (Apple TV Press, 2026-03-24).

Acceptance requires the public lifecycle API to show decision and production evidence concurrently without changing the existing TMDB lifecycle fields.

## 4B handoff

After 4A is stable, Phase 4B can add a small number of source-specific collectors. Collectors must emit the same evidence events and must not gain permission to bypass provenance, confidence or season rules. Avoid title fuzzy matching when a stable catalog identifier or editorial mapping is available.
