# Phase 6 — Series detail experience

**Decision:** Phase 6 is no longer the non-US geographic-expansion phase.

The current US-series catalog remains the product scope while Phase 6 adds a first-class detail experience for every Series Hub show.

## Product goal

A user should be able to open any show from the catalog or Today / This Week schedule and reach one stable detail page containing the information and media needed to understand that series without leaving Series Hub.

The Phase 6 detail model keeps the existing source responsibilities:

- **D1 / TMDB catalog sync** remains canonical for show identity, titles, overview, poster/backdrop, network, genres, rating and season metadata.
- **TVmaze** remains the source for numbered episode schedule facts and episode timing.
- **Official lifecycle evidence** remains attributed, event-sourced evidence and is not replaced by TMDB status.
- **TMDB live detail media** supplements the stored catalog with image collections, content rating, creators and video indexes only when a detail page is opened.

TMDB credentials remain server-side. The browser never receives `TMDB_API_TOKEN`.

## Phase 6A — Detail core

Phase 6A introduces:

1. a dedicated `/show.html?id=<show_id>` page using the stable Series Hub `show_id`;
2. navigation from catalog cards and grouped Today / This Week show cards;
3. HK / TW / CN preferred-title resolution using the existing regional-title policy;
4. hero backdrop, poster, Chinese and English titles, overview, platform/network, genres, rating and lifecycle status;
5. stored season metadata and recent TVmaze episode facts;
6. current official lifecycle evidence where available;
7. an on-demand TMDB image gallery;
8. TMDB-indexed YouTube trailers, preferring official trailers and using privacy-enhanced `youtube-nocookie.com` embedding;
9. click-to-load trailer iframes so opening a detail page does not immediately load YouTube;
10. graceful degradation: if live TMDB media is unavailable, the D1-backed detail page still renders.

### 6A non-goals

Phase 6A deliberately does **not**:

- add a new D1 migration;
- persist fetched image/video lists to D1;
- change the 48-request TMDB catalog-sync budget;
- change hourly TVmaze convergence;
- alter Push subscription or delivery behavior;
- change lifecycle evidence semantics;
- expand the catalog outside US series;
- introduce accounts or server-side viewing-state profiles.

## Phase 6B — Media browser

After 6A production acceptance, Phase 6B should improve media consumption without changing source semantics:

- full-screen image viewer / lightbox;
- swipe and keyboard navigation;
- poster versus backdrop grouping;
- higher-resolution loading on demand;
- image count / position and resilient mobile gestures;
- optional richer video selection when multiple official trailers/teasers exist.

This should remain on-demand and should not turn TMDB image/video data into a new scheduled synchronization workload unless production measurements justify caching.

## Phase 6C — Season and episode detail

After the media experience is stable, Phase 6C should turn `series → seasons → episodes` into visible navigation:

- season selector and season summaries;
- episode list grouped by season;
- episode image, overview, runtime and local schedule presentation where TVmaze provides precise timestamps;
- clear distinction between past episodes, next confirmed episodes and unknown future schedules;
- reuse of My Shows / viewing-state behavior without introducing accounts.

## Acceptance boundary for Phase 6A

Phase 6A is ready for production acceptance when all of the following are true:

- catalog and Today / This Week cards open the correct show by stable `show_id`;
- the page works on desktop and a narrow phone viewport without horizontal overflow;
- HK / TW / CN title switching does not lose the selected show;
- stored D1 detail renders even when live TMDB media fails;
- image URLs and trailer metadata are supplied by the Worker without exposing the TMDB secret;
- trailers load only after explicit user interaction;
- existing Phase 5 tracking, schedule, lifecycle, Push and operational-health regression tests remain green;
- deployment retains the existing cron contract and D1 bindings.

Non-US expansion can be reconsidered only after the Phase 6 detail experience is mature enough that adding more regions will not multiply an incomplete product surface.
