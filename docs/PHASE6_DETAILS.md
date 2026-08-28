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

## Phase 6B — Media browser ✅ production accepted

Phase 6B added:

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

Phase 6B remained frontend-only and did not alter D1 schema, scheduled media sync, TMDB catalog-sync cadence, TVmaze convergence, lifecycle semantics or Push behavior.

Production checkpoint `2a5ba97e3596daa36bea46d5162e1665df670ddf` passed the full deployment workflow on 2026-08-28. Real-device acceptance subsequently confirmed the media browser behaved normally. Custom pinch-to-zoom remains intentionally deferred because the stable browser already covers the core media use case and custom mobile zoom has a higher regression risk.

## Phase 6C — Season and episode detail 🚧

Phase 6C turns `series → seasons → episodes` into visible navigation while continuing to reuse the existing D1 and TVmaze data model.

The Phase 6C core implementation adds:

- selectable season cards plus a compact season selector;
- an on-demand, read-only `/api/shows/<show_id>/seasons/<season_number>/episodes` route so older seasons are not hidden by the existing 100-episode recent-history cap;
- per-season episode lists ordered by episode number;
- episode image, title, overview, runtime and TVmaze source link where available;
- local presentation of precise `air_timestamp` values with timezone information;
- explicit `已播出 / 今日播出 / 即將播出 / 時間待定` states;
- graceful empty/loading/error states for seasons without TVmaze episode rows;
- reuse of the existing local **My Shows** tracking module;
- reuse of the existing local viewing states (`追看中 / 等下一季 / 已看完 / 暫停`) without introducing accounts or server-side profiles;
- responsive mobile layout with season navigation and episode cards collapsing to one column.

### 6C boundaries

Phase 6C does **not**:

- add a D1 migration;
- change TMDB or TVmaze scheduled sync cadence;
- fetch a second TMDB detail payload for the episode explorer;
- introduce episode-level watched/unwatched persistence;
- introduce accounts, login, cloud profile sync or cross-device viewing history;
- change Push subscription or delivery semantics;
- change official lifecycle evidence semantics.

### 6C production acceptance boundary

Phase 6C is ready for production acceptance when:

- selecting any visible season opens the matching season episode list;
- long-running shows can load older seasons independently of the existing recent-100-episodes endpoint;
- episode image, overview and runtime appear when TVmaze supplies them;
- precise episode timestamps render as local time and date-only rows remain clearly labelled rather than falsely converted;
- past, today, upcoming and unknown-time episodes are visibly distinguishable;
- a season with no TVmaze rows fails gracefully without breaking the detail page;
- My Shows and viewing-state changes made on the detail page continue to use the existing local storage keys and behavior;
- changing HK/TW/CN title region does not lose the selected show or break the season explorer;
- desktop and narrow phone layouts do not create horizontal overflow;
- existing Phase 5, Phase 6A and Phase 6B regression tests, Worker build, preview runtime and production smoke remain green.

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
