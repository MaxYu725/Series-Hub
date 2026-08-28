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

## Phase 6A — Detail core ✅ production accepted

Phase 6A introduced:

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

Phase 6A.1 completed the real-device UI polish gate on 2026-08-28: localized detail text, grouped upcoming/recent episodes, condensed season cards, promoted official lifecycle evidence, trailer deduplication and a curated six-image first view were accepted on a narrow Android phone viewport.

### 6A non-goals retained

Phase 6A deliberately did **not**:

- add a new D1 migration;
- persist fetched image/video lists to D1;
- change the 48-request TMDB catalog-sync budget;
- change hourly TVmaze convergence;
- alter Push subscription or delivery behavior;
- change lifecycle evidence semantics;
- expand the catalog outside US series;
- introduce accounts or server-side viewing-state profiles.

## Phase 6B — Media browser 🚧

After 6A production acceptance, Phase 6B improves media consumption without changing source semantics.

The Phase 6B core implementation adds:

- full-screen image viewer / lightbox;
- swipe navigation on touch/pen input;
- keyboard navigation with Left/Right, Home/End and Escape;
- `全部 / 劇照 / 海報` gallery filtering with per-group counts;
- original-resolution TMDB image loading only after the viewer opens;
- preview-first rendering so the existing gallery remains lightweight;
- adjacent preview preloading for smoother navigation without preloading every original image;
- image category plus current position / total count;
- horizontal thumbnail navigation inside the viewer;
- mobile safe-area handling and focus restoration when the viewer closes;
- modifier-click preservation so users can still open the original image directly in a new tab.

Phase 6B remains frontend-only. It does not add a scheduled media-sync workload or alter TMDB / TVmaze / lifecycle / Push semantics.

### 6B production acceptance boundary

Phase 6B is ready for production acceptance when all of the following are true:

- selecting a gallery image opens the correct full-screen item without navigating away from the detail page;
- Left/Right keyboard navigation and mobile horizontal swipe both change images reliably;
- closing the viewer returns focus to the image that opened it;
- filtering between all images, backdrops and posters updates counts and navigation scope correctly;
- detail-page initial load still uses preview-sized images only;
- original-resolution images are requested only after explicit viewer interaction;
- opening, browsing and closing the viewer does not create horizontal page overflow or leave body scrolling locked;
- changing HK/TW/CN title region and rerendering detail media rebuilds the gallery browser correctly;
- existing Phase 5 and Phase 6A regression tests, Worker build, preview runtime and production smoke remain green.

Custom pinch-to-zoom is intentionally deferred until the core 6B viewer passes real-device acceptance. This avoids reintroducing the historical mobile zoom flicker / rebound class of issues before the base viewer is stable.

## Phase 6C — Season and episode detail

After the media experience is stable, Phase 6C should turn `series → seasons → episodes` into visible navigation:

- season selector and season summaries;
- episode list grouped by season;
- episode image, overview, runtime and local schedule presentation where TVmaze provides precise timestamps;
- clear distinction between past episodes, next confirmed episodes and unknown future schedules;
- reuse of My Shows / viewing-state behavior without introducing accounts.

## Phase 6A accepted boundary

Phase 6A production acceptance confirmed that:

- catalog and Today / This Week cards open the correct show by stable `show_id`;
- the page works on desktop and a narrow phone viewport without horizontal overflow;
- HK / TW / CN title switching does not lose the selected show;
- stored D1 detail renders even when live TMDB media fails;
- image URLs and trailer metadata are supplied by the Worker without exposing the TMDB secret;
- trailers load only after explicit user interaction;
- existing Phase 5 tracking, schedule, lifecycle, Push and operational-health regression tests remain green;
- deployment retains the existing cron contract and D1 bindings.

Non-US expansion can be reconsidered only after the Phase 6 detail experience is mature enough that adding more regions will not multiply an incomplete product surface.
