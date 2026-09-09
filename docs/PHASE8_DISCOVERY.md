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

Implementation slice:

- keep the Phase 8A **精選** rails unchanged;
- add a separate **全部劇集** mode inside Explore;
- extend the existing endpoint rather than creating another catalog authority:
  - `GET /api/discover?mode=browse&region=HK|TW|CN`;
- support bounded, server-validated facets:
  - `network` — exact canonical original network/service name from D1;
  - `genre` — exact canonical TMDB genre name from D1;
  - `status` — allowlisted Series Hub lifecycle status (`airing`, `upcoming`, `planned`, `completed`);
  - `year` — validated four-digit first-air year;
  - `sort` — allowlisted `popular`, `rating`, `newest`, `oldest`, or `title`;
- facet values are bound SQL parameters; sort expressions are selected only from a fixed server allowlist;
- return data-driven platform, genre, status and year options with catalog counts;
- return total filtered count separately from the bounded item result so the UI can indicate truncation;
- keep original network/service distinct from Phase 7C regional watch-provider availability;
- keep mobile browse as a compact two-column card grid while Phase 8A remains horizontal rails.

### Phase 8A / 8B data and budget boundary

Both discovery layers make **zero additional external requests**. They do not call TMDB discover, TVmaze or watch-provider endpoints while the user browses. The existing Phase 7 TMDB sync ceiling remains unchanged at 48 external requests per catalog sync.

No D1 migration is required for Phase 8B; it reads the existing `shows`, `networks`, `show_networks`, `genres` and `show_genres` tables.

## Planned Phase 8 follow-ups

### Phase 8C — Search Quality

Improve the existing global search only where production behavior shows value. Candidate work:

- exact/prefix title ranking ahead of generic substring matches;
- alias-aware ranking;
- clearer episode-match presentation;
- optional lightweight recent-search UX stored locally.

Do not add fuzzy cross-source identity matching as part of user search.

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
