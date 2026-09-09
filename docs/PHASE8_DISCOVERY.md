# Phase 8 — Discovery & Search Experience

Phase 8 moves Series Hub from a primarily status/schedule-driven tracker toward a stronger **find something worth watching** experience while preserving the mature US-series data model established through Phase 7.

## Starting point

Phase 8 does **not** rebuild search from zero. The production baseline already has global search through `GET /api/search`, covering:

- English/original show titles;
- HK/TW/CN Chinese preferred titles and aliases;
- TVmaze episode titles mapped back to their parent show.

Phase 8 therefore treats search as an existing capability to improve and combine with discovery, rather than as a missing backend.

## Phase 8A — Discovery Home

First implementation slice:

- add an **探索 / Discover** view without changing the current default Today view;
- build discovery entirely from the already-synced D1 catalog;
- expose `GET /api/discover?region=HK|TW|CN&limit=N`;
- return four bounded rails:
  - **熱門追看** — active catalog ordered by TMDB popularity;
  - **近一年新劇** — active shows first aired within the last 12 months;
  - **即將開播** — upcoming shows with a confirmed future date;
  - **高評分** — active shows with at least 100 TMDB votes, ordered by rating;
- preserve HK/TW/CN Chinese-title resolution in discovery cards;
- reuse existing Phase 6 show-detail navigation;
- render rails horizontally so discovery does not turn the homepage into a very long vertical card wall;
- keep search, Today/This Week, status views and My Shows as separate first-class modes.

### Data and budget boundary

Phase 8A makes **zero additional external requests**. It does not call TMDB discover, TVmaze or watch-provider endpoints when building the discovery home. The existing Phase 7 TMDB sync ceiling remains unchanged at 48 external requests per catalog sync.

No D1 migration is required.

## Planned Phase 8 follow-ups

### Phase 8B — Faceted Browse

Add deliberate catalog filters rather than more upstream sources, likely including:

- platform/network;
- genre;
- lifecycle/status;
- release year or recency;
- sensible sort choices such as popularity, rating and premiere date.

These filters should operate on Series Hub's canonical catalog and must not conflate original network/service with regional watch availability.

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
