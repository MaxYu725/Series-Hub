# Phase 6 — Series detail experience

**Status:** ✅ Production accepted

**Decision:** Phase 6 is no longer the non-US geographic-expansion phase.

The US-series catalog remains the product scope while Phase 6 adds a first-class detail experience for every Series Hub show.

## Product goal

A user should be able to open any show from the catalog or Today / This Week schedule and reach one stable detail page containing the information, media, season structure and episode facts needed to understand that series without leaving Series Hub.

The source responsibilities remain unchanged:

- **D1 / TMDB catalog sync** remains canonical for show identity, titles, overview, poster/backdrop, network, genres, rating and season metadata.
- **TVmaze** remains the source for numbered episode schedule facts and timing.
- **Official lifecycle evidence** remains attributed, event-sourced evidence and is not replaced by TMDB status.
- **TMDB live detail media** supplements the stored catalog with images, content rating, creators and video indexes only when a detail page is opened.

TMDB credentials remain server-side. The browser never receives `TMDB_API_TOKEN`.

## Phase 6A — Detail core ✅ production accepted

Phase 6A introduced:

1. a dedicated `/show.html?id=<show_id>` page using stable Series Hub `show_id`;
2. navigation from catalog cards and grouped Today / This Week show cards;
3. HK / TW / CN preferred-title resolution using the existing regional-title policy;
4. hero backdrop, poster, Chinese and English titles, overview, platform/network, genres, rating and lifecycle status;
5. stored season metadata and recent TVmaze episode facts;
6. current official lifecycle evidence where available;
7. an on-demand TMDB image gallery;
8. TMDB-indexed YouTube trailers, preferring official trailers and using privacy-enhanced `youtube-nocookie.com` embedding;
9. click-to-load trailer iframes so opening a detail page does not immediately load YouTube;
10. graceful degradation: if live TMDB media is unavailable, the D1-backed detail page still renders.

Phase 6A.1 completed the real-device polish gate: localized detail text, grouped upcoming/recent episodes, condensed season cards, promoted official lifecycle evidence, trailer de-duplication and a curated six-image first view were accepted on a narrow Android phone viewport.

## Phase 6B — Media browser ✅ production accepted

Phase 6B added:

- full-screen image viewer / lightbox;
- swipe navigation on touch/pen input;
- keyboard navigation with Left/Right, Home/End and Escape;
- `全部 / 劇照 / 海報` gallery filtering with counts;
- original-resolution TMDB image loading only after the viewer opens;
- preview-first rendering and adjacent preview preloading;
- image category plus current position / total count;
- horizontal thumbnail navigation inside the viewer;
- mobile safe-area handling and focus restoration when the viewer closes;
- modifier-click preservation so users can still open the original image directly in a new tab.

Custom pinch-to-zoom remains intentionally deferred because the accepted browser already covers the core media use case and custom mobile zoom has a higher regression risk.

## Phase 6C — Season and episode detail ✅ production accepted

Phase 6C turns `series → seasons → episodes` into visible navigation while reusing the existing D1 and TVmaze data model.

Accepted behavior:

- selectable season cards plus compact season selector;
- read-only `/api/shows/<show_id>/seasons/<season_number>/episodes` route so older seasons are not hidden by the recent-100-episodes endpoint;
- per-season episodes ordered by episode number;
- episode image, title, overview, runtime and TVmaze source link where available;
- local presentation of precise `air_timestamp` values with timezone information;
- explicit `已播出 / 今日播出 / 即將播出 / 時間待定` states;
- graceful loading, empty and retry states for seasons without TVmaze rows;
- reuse of existing local **My Shows** tracking;
- reuse of existing local viewing states (`追看中 / 等下一季 / 已看完 / 暫停`) without accounts or server-side profiles;
- title-region changes do not lose the selected show or break the season explorer.

## Phase 6C.1 — Long-list horizontal rails ✅ production accepted

Real-device review identified a remaining UX problem: shows with many seasons or many episodes could make the detail page excessively long.

The accepted correction changes potentially unbounded repetitive card lists into horizontal scroll-snap rails:

- seasons → one-row horizontal rail;
- selected-season episodes → horizontal image-first card rail;
- secondary trailer/video options → horizontal rail;
- mobile cards intentionally reveal part of the next card as a swipe affordance.

Text-heavy reading surfaces remain vertical, including synopsis, show facts and official lifecycle evidence.

## Phase 6 boundaries

Phase 6 deliberately did **not**:

- add a new account/login/profile system;
- add episode-level watched/unwatched persistence;
- persist fetched image/video lists to D1;
- expose TMDB credentials to the browser;
- change Push subscription or delivery semantics;
- replace lifecycle evidence semantics with TMDB status;
- expand the catalog outside US series.

## Final acceptance

Final Phase 6C.1 production checkpoint:

`da9c90a0c9fa187ddab857265b7036d881d685bc`

The final implementation passed the full isolated preview and production deployment gates, including unit tests, D1 migration validation, Worker build/deploy, TMDB sync, TVmaze bootstrap/runtime verification and Push/VAPID regression checks.

Real-device acceptance on 2026-08-29 confirmed the horizontal long-list layout behaved normally.

See [`PHASE6_ACCEPTANCE.md`](PHASE6_ACCEPTANCE.md) for the closeout record.

## Phase gate

**Phase 6 is closed.** Later regressions should be handled as maintenance unless they invalidate a core acceptance contract.

Non-US expansion remains a separate future product decision. It should not be treated as the automatic next step simply because the original pre-Phase-6 roadmap once assigned that meaning to Phase 6.
