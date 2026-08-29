# Phase 6 — Production acceptance

**Accepted:** 2026-08-29 (Asia/Hong_Kong)  
**Status:** Accepted for production

## Decision

Phase 6 is complete and production-accepted.

Phase 6 was intentionally redefined from the earlier non-US expansion idea into the first-class **series detail experience** for the existing US-series catalog. The completed surface now covers `series → seasons → episodes` plus trailers, images, official lifecycle evidence and local viewing-state controls.

## Accepted scope

### Phase 6A / 6A.1 — Detail core

Accepted on production and real device:

- dedicated stable `/show.html?id=<show_id>` detail page;
- navigation from catalog and Today / This Week cards;
- HK / TW / CN preferred title handling;
- poster, backdrop, Chinese/English titles, localized overview/tagline, platform/network, genres, rating and content rating;
- show facts, recent/upcoming episode summary, season metadata and official lifecycle evidence;
- on-demand TMDB images and YouTube trailer metadata with server-side credentials;
- click-to-load privacy-enhanced YouTube embeds;
- D1-backed graceful fallback when live TMDB media is unavailable;
- mobile UI polish: localized labels, upcoming/recent episode grouping, condensed season cards, promoted lifecycle evidence, trailer de-duplication and curated first-view gallery.

### Phase 6B — Media browser

Accepted on production and real device:

- full-screen image lightbox;
- touch/pen swipe navigation;
- keyboard Left/Right, Home/End and Escape navigation;
- `全部 / 劇照 / 海報` filtering with counts;
- preview-first rendering and original-resolution loading only after opening the viewer;
- adjacent preview preloading;
- current-position / total count and thumbnail navigation;
- mobile safe-area handling and focus restoration.

Custom pinch-to-zoom remains intentionally deferred because it is not required for the accepted core media workflow and adds mobile regression risk.

### Phase 6C — Season and episode explorer

Accepted on production and real device:

- selectable season cards plus compact season selector;
- read-only `/api/shows/<show_id>/seasons/<season_number>/episodes` route so old seasons are not hidden by the recent-100-episode endpoint;
- per-season episode image, title, overview, runtime, TVmaze source and schedule state;
- browser-local presentation of precise `air_timestamp` values;
- explicit `已播出 / 今日播出 / 即將播出 / 時間待定` states;
- graceful loading, empty and retry behavior;
- reuse of existing local My Shows tracking and viewing-state storage;
- no accounts or server-side viewing profile.

### Phase 6C.1 — Long-list horizontal rails

Real-device review found that vertically stacking many seasons or many episodes could make detail pages excessively long. The accepted correction converts potentially unbounded repetitive card lists into horizontal scroll-snap rails:

- seasons → one-row horizontal rail;
- selected-season episodes → horizontal image-first card rail;
- secondary trailer/video options → horizontal rail;
- mobile cards intentionally expose part of the next card as a swipe affordance.

Long-form reading surfaces remain vertical: show facts, synopsis, official lifecycle evidence and other text-heavy content are not forced into horizontal rails.

## Production checkpoint

Final Phase 6C.1 production checkpoint:

`da9c90a0c9fa187ddab857265b7036d881d685bc`

PR #87 passed the full isolated preview gate and the main deployment completed successfully, including unit tests, D1 migration gate, Worker deployment, TMDB sync, TVmaze bootstrap/runtime verification and Push/VAPID regression checks.

The project owner then explicitly confirmed real-device acceptance: **「驗收正常」**.

## Boundaries retained

Phase 6 did not:

- add accounts or cloud viewing profiles;
- add episode-level watched persistence;
- move TMDB credentials to the browser;
- change the existing TMDB catalog-sync budget/cadence as part of the detail feature;
- change hourly TVmaze convergence semantics;
- change Push delivery semantics;
- replace official lifecycle evidence with TMDB status;
- expand the catalog outside US series.

## Phase gate

Phase 6 is closed. Later regressions should be handled as normal maintenance and should not silently reopen the completed phase unless a core acceptance contract is invalidated.

The next product phase should be chosen deliberately from the now-mature US-series baseline rather than automatically resuming the old non-US-expansion plan.
