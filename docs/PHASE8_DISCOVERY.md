# Phase 8 — Discovery & Search Experience

Phase 8 moves Series Hub from a primarily status/schedule-driven tracker toward a stronger **find something worth watching** experience while preserving the mature US-series data model established through Phase 7.

## Starting point

Phase 8 does **not** rebuild search from zero. The production baseline already has global search through `GET /api/search`, covering:

- English/original show titles;
- HK/TW/CN Chinese preferred titles and aliases;
- TVmaze episode titles mapped back to their parent show.

Phase 8 therefore treats search as an existing capability to improve and combine with discovery, rather than as a missing backend.

## Phase 8A — Discovery Home

Production-accepted on 2026-09-09.

- added an **探索 / Discover** view without changing the default Today view;
- discovery is built entirely from the already-synced D1 catalog;
- `GET /api/discover?region=HK|TW|CN&limit=N` returns four bounded rails:
  - **熱門追看** — active catalog ordered by TMDB popularity;
  - **近一年新劇** — active shows first aired within the last 12 months;
  - **即將開播** — upcoming shows with a confirmed future date;
  - **高評分** — active shows with at least 100 TMDB votes, ordered by rating;
- HK/TW/CN Chinese-title resolution and Phase 6 show-detail navigation are preserved;
- rails remain horizontal so discovery does not become a long vertical wall.

Production acceptance included the normal TMDB immediate sync, TVmaze bootstrap/convergence, final runtime smoke and VAPID readiness checks.

## Phase 8B — Faceted Browse

Production-accepted on 2026-09-09.

- keeps the Phase 8A **精選** rails unchanged;
- adds a separate **全部劇集** mode inside Explore;
- extends the existing endpoint rather than creating another catalog authority:
  - `GET /api/discover?mode=browse&region=HK|TW|CN`;
- supports bounded, server-validated facets:
  - `network` — exact canonical original network/service name from D1;
  - `genre` — exact canonical TMDB genre name from D1;
  - `status` — allowlisted Series Hub lifecycle status (`airing`, `upcoming`, `planned`, `completed`);
  - `year` — validated four-digit first-air year;
  - `sort` — allowlisted `popular`, `rating`, `newest`, `oldest`, or `title`;
- facet values use bound SQL parameters; sort expressions are selected only from a fixed server allowlist;
- returns data-driven platform, genre, status and year options with catalog counts;
- returns total filtered count separately from the bounded item result so the UI can indicate truncation;
- keeps original network/service distinct from Phase 7C regional watch-provider availability;
- keeps mobile browse as a compact two-column card grid while Phase 8A remains horizontal rails.

Production acceptance included isolated preview validation, production deploy, immediate TMDB sync, TVmaze bootstrap/convergence, final runtime smoke, VAPID readiness and preview-resource cleanup.

## Phase 8C — Search Quality

Implementation slice:

- preserve the existing Phase 6 global-search universe and query behavior;
- do **not** add another search provider or a second catalog query path;
- intercept the successful `/api/search` payload only at the outer Phase 8 wrapper and deterministically rerank the already-found shows;
- use normalized NFKC, case-insensitive comparison;
- relevance precedence:
  1. exact primary title — English, original or the requested region's resolved Chinese display title;
  2. exact other Chinese preferred title / alias;
  3. primary-title prefix;
  4. alias prefix;
  5. primary-title substring;
  6. alias substring;
  7. episode title match;
- only after relevance ties, use existing popularity / vote-count signals;
- annotate results with `search_match_type` and `search_match_label` so ranking remains inspectable;
- retain the existing visible episode-hit presentation;
- add zero external requests and no D1 migration.

The goal is relevance, not fuzzy identity resolution. A less-popular exact match must outrank a more-popular partial match, while the existing catalog, regional aliases and TVmaze episode matches remain searchable.

### Phase 8A / 8B / 8C data and budget boundary

Phase 8 discovery/browse adds **zero external requests**. Search Quality only reorders the existing `/api/search` result in memory and therefore also adds zero external requests. The existing Phase 7 TMDB sync ceiling remains unchanged at 48 external requests per catalog sync.

No D1 migration is required for Phase 8A–8C.

## Planned Phase 8 follow-ups

### Phase 8D — Local-first Personal Discovery

Use existing browser-local My Shows and viewing states to improve discovery without creating an account or server profile. Any recommendation logic should remain explainable and should not silently upload viewing-state data.

### Phase 8E — Acceptance and Product Polish

Validate mobile horizontal behavior, loading/error states, discovery/search transitions and real production usefulness before closing Phase 8.

## Principles retained from earlier phases

1. TMDB remains canonical catalog metadata.
2. TVmaze remains exact episode/schedule supplementation.
3. Official lifecycle evidence remains separately attributed and non-destructive.
4. Original network/service and regional watch availability remain separate concepts.
5. No synthetic show identities are inserted to satisfy discovery UI.
6. Discovery should primarily exploit the catalog already being maintained before increasing upstream request volume.
