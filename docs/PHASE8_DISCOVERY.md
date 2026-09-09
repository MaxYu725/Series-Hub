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

Production-accepted on 2026-09-09.

- preserves the existing Phase 6 global-search universe and query behavior;
- does **not** add another search provider or a second catalog query path;
- intercepts the successful `/api/search` payload only at the outer Phase 8 wrapper and deterministically reranks the already-found shows;
- uses normalized NFKC, case-insensitive comparison;
- relevance precedence:
  1. exact primary title — English, original or the requested region's resolved Chinese display title;
  2. exact other Chinese preferred title / alias;
  3. primary-title prefix;
  4. alias prefix;
  5. primary-title substring;
  6. alias substring;
  7. episode title match;
- only after relevance ties, uses existing popularity / vote-count signals;
- annotates results with `search_match_type` and `search_match_label` so ranking remains inspectable;
- retains the existing visible episode-hit presentation;
- adds zero external requests and no D1 migration.

Production acceptance included isolated preview validation, production deploy, immediate TMDB sync, TVmaze bootstrap/convergence, final runtime smoke, VAPID readiness and preview-resource cleanup.

## Phase 8D — Local-first Personal Discovery

Production-accepted on 2026-09-09.

- adds a third Explore mode: **為你 / For You**;
- keeps My Shows IDs in the existing `series-hub-tracked-shows-v1` browser storage;
- keeps viewing states in the existing `series-hub-viewing-states-v1` browser storage;
- never serializes tracked IDs, viewing states or derived taste scores into the recommendation request;
- obtains candidates only through a generic existing catalog request:
  - `GET /api/discover?mode=browse&region=HK|TW|CN&limit=100&sort=popular`;
- performs recommendation ranking entirely in browser JavaScript;
- excludes shows that are already tracked;
- weights local viewing states for taste-profile construction:
  - `watching` — strongest positive signal;
  - `waiting` — strong positive signal;
  - `completed` — retained positive preference signal;
  - `paused` — weak signal rather than a hard negative;
  - unset — neutral-positive tracking signal;
- derives explainable genre/network affinity only from metadata already seen in the browser;
- stores a bounded local signal cache under `series-hub-local-catalog-signals-v1` containing only:
  - Series Hub show ID;
  - genre string;
  - original network/service string;
- caps that cache at 300 shows and deliberately omits titles, poster URLs, search terms, timestamps and watch dates;
- adds recommendation reasons such as `同類型偏好：Drama` or `同平台偏好：HBO`;
- when no sufficient local taste signal exists, clearly falls back to popularity/rating instead of claiming personalization;
- keeps the personal grid at the same responsive density as Phase 8B browse.

Production acceptance included 223 passing unit tests, production deployment, immediate TMDB sync, TVmaze bootstrap/convergence, final runtime smoke, VAPID readiness and preview-resource cleanup.

## Phase 8E — Acceptance and Product Polish

Closeout slice:

- preserves the exact originating Explore mode when entering global search and clearing the query;
- adds explicit `aria-pressed` state to the **精選 / 為你 / 全部劇集** mode controls;
- keeps mode controls associated with `show-grid` through `aria-controls`;
- clears pressed state when Explore is no longer active;
- codifies bounded loading, explicit error handling, mobile density and privacy boundaries in regression tests;
- adds `docs/PHASE8_ACCEPTANCE.md` as the final Phase 8 closeout contract.

Phase 8E does not add a new catalog API, recommendation provider, D1 migration or upstream sync request.

### Phase 8A–8E data and budget boundary

Phase 8A/B discovery and browse use only already-synced D1 data. Phase 8C only reorders an existing search response. Phase 8D reuses one generic D1 browse request and ranks locally. Phase 8E only tightens product state transitions and acceptance contracts. None of these phases adds direct TMDB or TVmaze requests while the user discovers content.

The existing Phase 7 TMDB sync ceiling remains unchanged at 48 external requests per catalog sync. No D1 migration is required for Phase 8A–8E.

Phase 8 is considered closed only after the Phase 8E merged production workflow passes the full closeout gates documented in `PHASE8_ACCEPTANCE.md`.

## Principles retained from earlier phases

1. TMDB remains canonical catalog metadata.
2. TVmaze remains exact episode/schedule supplementation.
3. Official lifecycle evidence remains separately attributed and non-destructive.
4. Original network/service and regional watch availability remain separate concepts.
5. No synthetic show identities are inserted to satisfy discovery UI.
6. Discovery should primarily exploit the catalog already being maintained before increasing upstream request volume.
7. Personal discovery must remain browser-local unless a future account/profile phase is explicitly designed and approved.
