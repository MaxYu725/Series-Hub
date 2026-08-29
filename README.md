# Series Hub

Series Hub is a browser-first US TV series aggregation and tracking project deployed through GitHub Actions to Cloudflare Workers + D1. It is an information/tracking hub, not a streaming playback service.

The core model is **series → seasons → episodes**. Season is first-class because premiere dates, release cadence, episode counts and lifecycle evidence belong to a specific season rather than only to the parent show.

## Current status

**Phase 6 — Series detail experience: COMPLETE and production-accepted.**

Current production checkpoint:

```text
da9c90a0c9fa187ddab857265b7036d881d685bc
```

Production Worker:

```text
https://series-hub.max-yu-jp.workers.dev
```

Phase 5E US-series maturity closeout is also complete and production-accepted. The project is no longer blocked by the earlier Phase 5E-D acceptance gate.

Phase 6 was deliberately redefined from the old non-US-expansion idea into a first-class detail experience for the existing US-series catalog. It now includes:

- dedicated detail page for every show;
- HK / TW / CN preferred-title handling;
- poster, backdrop, localized overview/tagline, network/platform, genres, rating and content rating;
- recent/upcoming episode summary;
- official lifecycle evidence;
- trailers and media browser;
- season selector and per-season episode explorer;
- local My Shows and viewing-state controls;
- horizontal rails for potentially long season, episode and secondary-video lists.

See [`docs/PHASE6_ACCEPTANCE.md`](docs/PHASE6_ACCEPTANCE.md) and [`docs/PHASE6_DETAILS.md`](docs/PHASE6_DETAILS.md).

## Completed roadmap

- **Phase 0 — Complete:** Cloudflare Worker/D1/GitHub browser-only foundation.
- **Phase 1A — Complete:** TMDB catalog core.
- **Phase 1B — Complete:** US scripted catalog quality, lifecycle classification and network balancing.
- **Phase 2A — Complete:** exact TVmaze mapping + normalized episode/schedule API.
- **Phase 2B — Complete:** Today / This Week schedule UI with browser-local timezone handling.
- **Phase 3 — Complete:** HK/TW/CN preferred-title policy, provenance, fallback, audit and controlled manual override.
- **Phase 4 — Complete through 4F:** attributed official renewal/cancellation/production evidence and verified source registry.
- **Phase 5A — Complete:** browser-local My Shows tracking.
- **Phase 5B — Complete:** tracked-only Today / This Week filtering.
- **Phase 5C — Complete:** browser-local per-show viewing states.
- **Phase 5D-A — Complete:** isolated Web Push feasibility proof.
- **Phase 5D-B — Complete:** accountless Push subscription persistence and full revoke/delete.
- **Phase 5D-C — Complete:** production `episode_24h` reminders with real-device acceptance.
- **Phase 5D-D — Deferred/optional:** extra notification classes only if later justified.
- **Phase 5E-A — Complete:** production maturity baseline and bottleneck identification.
- **Phase 5E-B — Complete:** rotating TMDB discovery slices within the fixed request budget.
- **Phase 5E-C — Complete:** bounded hourly TVmaze convergence and production acceptance.
- **Phase 5E-D — Complete:** lifecycle consistency, mobile UX and observability closeout; real-device acceptance recorded in `docs/PHASE5E_D_ACCEPTANCE.md`.
- **Phase 6A / 6A.1 — Complete:** detail core and real-device UI polish.
- **Phase 6B — Complete:** full-screen media browser with touch/keyboard navigation and on-demand high-resolution images.
- **Phase 6C — Complete:** season → episode explorer with TVmaze episode metadata and local viewing-state reuse.
- **Phase 6C.1 — Complete:** long-list horizontal rails for seasons, selected-season episodes and secondary videos.

## Next-phase rule

**Do not automatically resume the old “Phase 6 = non-US expansion” plan.** That roadmap meaning was explicitly retired.

The next product phase should be selected deliberately from the mature US-series baseline. Candidate directions may include broader discovery/search, additional product polish, stronger data coverage, new tracking capabilities or geographic expansion, but none is considered started until a new phase is explicitly chosen.

## Product views

### Catalog

- **播映中 / Airing** — a current season is actively releasing episodes;
- **即將播映 / Upcoming** — a show/season has a confirmed future date;
- **計劃播出 / Planned** — returning / in-production series with no confirmed date yet;
- **我的劇集 / My Shows** — shows selected in this browser, with current metadata re-fetched from the normal catalog API.

### Schedule

- **今日 / Today** — episodes falling on the browser's local calendar day when a real timestamp exists;
- **本週 / This Week** — seven local calendar days starting today;
- **只看追蹤 / Tracked only** — optional local filter using stable Series Hub `show_id` membership.

When TVmaze provides an `air_timestamp`, Series Hub converts it to the browser's local timezone for date grouping and time display. If only source `air_date` / `air_time` exists, the UI preserves it as source timing rather than inventing a local timestamp.

### Detail page

A show detail page can surface:

- Chinese preferred title and English title;
- poster and backdrop;
- localized overview/tagline;
- network/platform, genres, TMDB rating and US content rating;
- first/last/next air information;
- season and episode counts;
- creators, type and official homepage;
- recent/upcoming episode summary;
- official lifecycle evidence;
- YouTube trailers;
- TMDB image gallery + full-screen lightbox;
- season selector and per-season TVmaze episode cards;
- local My Shows tracking and viewing state.

Potentially unbounded repetitive card lists should prefer **horizontal scrolling**; long-form reading surfaces should remain vertical.

## Local-first personalization

### My Shows

Storage key:

```text
series-hub-tracked-shows-v1
```

Only stable Series Hub show IDs are persisted locally. Metadata is not copied into the tracking store.

### Viewing states

Storage key:

```text
series-hub-viewing-states-v1
```

Supported values:

- `watching` — 追看中
- `waiting` — 等下一季
- `completed` — 已看完
- `paused` — 暫停

Viewing-state data remains browser-local and is not uploaded to the backend.

## Accountless Push boundary

The only intentional server-side personalization exception is optional Web Push routing after explicit user opt-in.

Production stores only the minimum required subscription/routing data, including the browser Push endpoint/encryption material, a hashed management capability, timezone/title-region preference, stable tracked `show_id` mappings and compact delivery/deduplication facts.

It does **not** create a user account or store server-authoritative viewing state, search history or a cloud profile.

Accepted notification kind:

```text
episode_24h
```

Reminder cadence:

```text
7 * * * *
```

See [`docs/PHASE5D_NOTIFICATIONS.md`](docs/PHASE5D_NOTIFICATIONS.md).

## Data-source responsibilities

### TMDB — canonical catalog metadata

TMDB anchors:

- series and season records;
- original and English titles;
- `zh-HK`, `zh-TW`, `zh-CN` aliases;
- posters/backdrops;
- genres;
- original networks/services;
- base catalog lifecycle classification;
- external IDs used for exact cross-source mapping.

On the detail page, live TMDB requests may additionally supply localized overview/tagline, content rating, creators, image indexes and video indexes. `TMDB_API_TOKEN` remains server-side.

### TVmaze — episode and schedule facts

TVmaze supplements:

- exact show mapping via IMDb first, TheTVDB fallback;
- season/episode numbers;
- episode names and summaries;
- air date/time/airstamp;
- runtime;
- episode images and TVmaze source URLs.

**No title fuzzy matching is used for production TVmaze linking.** TVmaze schedule facts do not replace TMDB canonical identity or lifecycle classification.

### Official lifecycle sources — attributed evidence

Official lifecycle evidence is event-sourced and does **not** overwrite the normal TMDB-derived catalog status.

Verified publishing surfaces include Apple TV Press, Warner Bros. Discovery / HBO Pressroom, Amazon Entertainment, Netflix Media Center, Netflix Tudum and FOXFLASH.

See [`docs/PHASE4_LIFECYCLE.md`](docs/PHASE4_LIFECYCLE.md).

## Production architecture

```text
TMDB ───────────────┐
                    ▼
GitHub main → Actions → Cloudflare Worker ← TVmaze
                         │
                         ├── Static assets
                         ├── Public API
                         ├── Detail/media API
                         ├── Lifecycle evidence projection
                         ├── TMDB catalog sync
                         ├── hourly TVmaze convergence
                         └── hourly episode reminder runner
                         │
                         ▼
                    D1: series-hub-db

Browser
  ├── localStorage: tracked show IDs
  ├── localStorage: viewing states
  ├── optional Push management capability
  └── Service Worker: /push-sw.js
```

Production sync cadence:

- TMDB: minute 17 every six hours;
- TVmaze: minute 47 every hour;
- `episode_24h` reminders: minute 7 every hour.

TMDB and TVmaze retain separate sync runs. Notification delivery is operationally isolated from both.

## Browser-only development rule

Normal project work does **not** require the user to run a local clone, PowerShell, local Node.js, Docker or user-installed Wrangler.

```text
GitHub branch
   ↓
Pull request
   ↓
Isolated Worker + isolated D1
   ↓
Migrations + unit tests + runtime smoke tests
   ↓
Review / merge
   ↓
main
   ↓
Production migration → deployment → live validation
```

Normal application PRs use isolated preview Worker/D1 resources. Unmerged application code therefore does not write production D1.

## Main public/device APIs

- `GET /health`
- `GET /api/shows`
- `GET /api/schedule`
- `GET /api/lifecycle`
- `GET /api/shows/:id/lifecycle`
- `GET /api/shows/:id/aliases`
- `GET /api/shows/:id/episodes`
- `GET /api/shows/:id/details?region=HK|TW|CN`
- `GET /api/shows/:id/seasons/:season_number/episodes`
- `GET /api/sync-status?source=tmdb|tvmaze`
- `GET /api/push/public-key`
- `POST /api/push/subscriptions`
- `PUT /api/push/subscription`
- `DELETE /api/push/subscription`

Protected internal write routes retain the existing derived authorization-key contract.

## Core data and engineering principles

1. Season is first-class.
2. Original network/service and regional availability are separate concepts.
3. Chinese titles remain separate HK/TW/CN aliases with provenance.
4. Source-specific facts retain attribution.
5. TMDB, TVmaze and official lifecycle evidence have separate responsibilities.
6. Official lifecycle evidence is non-destructive and event-sourced.
7. No secrets in source control or frontend assets.
8. Applied D1 migrations are immutable; changes use new numbered migrations.
9. Unmerged application PR code must not use production D1 or production application secrets.
10. Production migrations run before the Worker version that requires them.
11. No production TVmaze title fuzzy matching.
12. Local-time conversion is performed only when a real timestamp exists.
13. Deployment success alone is not acceptance; real production/device behavior matters at phase boundaries.
14. My Shows and viewing states remain local-first.
15. Accounts/server identity are not introduced without a demonstrated product requirement.
16. Notification scope does not expand silently; new alert classes require explicit design and acceptance.
17. Potentially unbounded repetitive card lists prefer horizontal rails; long-form reading content remains vertical.

## Handoff checkpoint

As of 2026-08-29, the accepted production baseline is:

- mature US scripted catalog via TMDB;
- exact TVmaze episode/schedule linkage with bounded hourly convergence;
- HK/TW/CN regional title handling;
- attributed official lifecycle evidence;
- local My Shows + viewing states;
- optional accountless `episode_24h` Push reminders;
- first-class show detail pages;
- full-screen media browser;
- season → episode exploration;
- mobile-tested horizontal handling for long repetitive lists.

**Phase 6 is closed.** Do not rebuild completed phases or infer that international expansion is automatically next. Start the next development conversation by reading this README plus `docs/PHASE6_ACCEPTANCE.md`, then explicitly choose the next product phase.
