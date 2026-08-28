# Series Hub

Series Hub is a browser-first US TV series aggregation and tracking project deployed through GitHub Actions to Cloudflare Workers + D1. It is an information/tracking hub, not a streaming playback service.

The core model is **series → seasons → episodes**. Season is first-class because premiere dates, release cadence, episode counts and lifecycle evidence belong to a specific season rather than only to the parent show.

## Current status

**Phase 5E-C — US-series maturity hardening: COMPLETE and production-accepted.**

Completed:

- Phase 0 — Cloudflare Worker/D1/GitHub browser-only foundation;
- Phase 1A — TMDB catalog core;
- Phase 1B — US scripted catalog quality, lifecycle classification and network balancing;
- Phase 2A — exact TVmaze mapping + normalized episode/schedule API;
- Phase 2B — Today / This Week schedule UI with browser-local timezone handling;
- Phase 3A/3B — HK/TW/CN preferred-title resolution, provenance, fallback, audit and controlled manual override;
- Phase 4A–4F — attributed official renewal/cancellation/production evidence, visible UI projection and verified official source registry across Apple, Amazon, WBD/HBO, Netflix and FOX;
- Phase 5A — browser-local **我的劇集 / My Shows** tracking;
- Phase 5B — **只看追蹤 / Tracked only** filtering for Today / This Week;
- Phase 5C — browser-local per-show viewing states: **追看中 / 等下一季 / 已看完 / 暫停**;
- Phase 5D-A — isolated Web Push feasibility proof with a real native browser notification;
- Phase 5D-B — accountless Push subscription persistence, explicit opt-in and full revoke/delete;
- Phase 5D-C — hourly targeted `episode_24h` Web Push reminders with deduplication, stale-subscription cleanup and real production-device acceptance;
- Phase 5E-A — production maturity baseline across catalog, mapping, episodes, regional titles and Push health;
- Phase 5E-B — rotating TMDB discovery slices so the fixed 48-request budget reaches substantially more eligible US-series candidates;
- Phase 5E-C — hourly bounded TVmaze convergence, scaled production smoke validation and regional-title fallback acceptance.

**Next recommended phase: Phase 5E-D — lifecycle consistency, mobile UX and observability closeout.**

Do not broaden notification types, introduce accounts or begin non-US expansion yet. Phase 5E-D should close the remaining US-series maturity items—official lifecycle consistency across the enlarged catalog, mobile interaction/loading resilience and operational observability—before deciding whether the Phase 5 maturity gate is complete enough for Phase 6 geographic expansion.

## Product views

Catalog:

- **播映中 / Airing** — a current season is actively releasing episodes;
- **即將播映 / Upcoming** — a show/season has a confirmed future date;
- **計劃播出 / Planned** — returning / in-production series with no confirmed date yet;
- **我的劇集 / My Shows** — shows selected in this browser, with current metadata re-fetched from the normal catalog API.

Schedule:

- **今日 / Today** — episodes falling on the browser's local calendar day when a real timestamp exists;
- **本週 / This Week** — seven local calendar days starting today;
- **只看追蹤 / Tracked only** — optional local filter using stable Series Hub `show_id` membership.

When TVmaze provides an `air_timestamp`, Series Hub converts it to the browser's local timezone for date grouping and time display. If only source `air_date` / `air_time` exists, the UI preserves it as source timing rather than inventing a local timestamp.

## Local-first personalization and notification boundary

### Browser-local tracking

Tracking storage key:

```text
series-hub-tracked-shows-v1
```

Only stable Series Hub show IDs are persisted. Metadata is not copied into local tracking storage.

### Browser-local viewing states

Viewing-state storage key:

```text
series-hub-viewing-states-v1
```

Supported values:

- `watching` — 追看中
- `waiting` — 等下一季
- `completed` — 已看完
- `paused` — 暫停

Viewing-state data remains browser-local and is not uploaded to the backend.

### Accountless background notifications

Phase 5D intentionally introduced a narrow new server-side privacy boundary without introducing accounts.

Only after the user explicitly enables notifications does production store:

- the browser/device Push endpoint and encryption material;
- a SHA-256 hash of a high-entropy management capability;
- timezone and title-region preference for notification presentation;
- stable Series Hub `show_id` values selected for notification routing;
- compact delivery/deduplication status facts.

It does **not** store an account, profile, viewing state, search history or server-authoritative My Shows metadata.

The user can disable notifications from My Shows; this deletes the server subscription, show mappings and dependent delivery rows and unsubscribes the browser.

See [`docs/PHASE5D_NOTIFICATIONS.md`](docs/PHASE5D_NOTIFICATIONS.md) for the complete notification contract and acceptance history.

## Background reminder behavior

Accepted production notification kind:

```text
episode_24h
```

A device is eligible only when:

1. it explicitly opted in;
2. the show is mapped to that Push subscription;
3. TVmaze supplied a real `air_timestamp`;
4. the episode is numbered and belongs to a numbered season;
5. the episode enters the approximately 23–24 hour reminder window;
6. the same subscription/episode reminder has not already been successfully delivered.

Production reminder cadence:

```text
7 * * * *
```

The runner is isolated from TMDB/TVmaze sync, uses bounded fan-out, retries only transient failures while still eligible, deletes permanent 404/410 Push endpoints and purges stale inactive subscriptions according to the accepted retention policy.

## Data-source responsibilities

### TMDB — canonical catalog metadata

TMDB anchors:

- series and season records;
- original and English titles;
- `zh-HK`, `zh-TW`, `zh-CN` aliases;
- posters/backdrops;
- genres;
- original networks/services;
- base Series Hub lifecycle classification;
- external IDs used for exact cross-source mapping.

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

Verified official publishing surfaces through Phase 4F:

| Source key | Publisher / surface |
| --- | --- |
| `apple_tv_press` | Apple TV Press |
| `wbd_pressroom` | Warner Bros. Discovery / HBO Pressroom |
| `amazon_entertainment` | Amazon Entertainment |
| `netflix_media_center` | Netflix Media Center |
| `netflix_tudum` | Netflix Tudum |
| `fox_flash` | FOXFLASH |

See [`docs/PHASE4_LIFECYCLE.md`](docs/PHASE4_LIFECYCLE.md).

## Production acceptance checkpoints

### Phase 4

Accepted official evidence includes:

- **Silo** — season 3 renewed; season 4 renewed/final via Apple TV Press;
- **For All Mankind** — season 6 final-season decision plus conservative production-state evidence;
- **Reacher** — season 5 renewed via Amazon Entertainment;
- **House of the Dragon** — season 4 renewed via WBD/HBO Pressroom;
- **Wednesday** — season 3 renewed plus independent filming evidence via Netflix Tudum;
- **Murder in a Small Town** — season 3 renewal anchored to FOXFLASH after catalog-coverage repairs.

### Phase 5A–5C

Accepted production behavior:

- browser-local My Shows tracking;
- Today/This Week tracked-only filtering;
- four local viewing states and state filtering;
- no account/user/profile/viewing-state backend was introduced;
- a Phase 5 tracking MutationObserver feedback-loop freeze discovered during mobile testing was fixed and regression-covered.

### Phase 5D-A

An isolated Cloudflare Worker spike proved Web Push compatibility with the existing stack and a real browser received a native test notification. The spike stored no subscription and was closed without merge.

### Phase 5D-B

Isolated and production acceptance proved:

- D1 subscription migration works;
- registration/update/delete works;
- same-origin mutation protection works;
- only the hashed management capability is stored server-side;
- tracked show mappings can be replaced safely;
- stable VAPID production provisioning works;
- a real production browser could enable notifications and fully revoke/delete them again.

### Phase 5D-C

Production acceptance proved:

- the hourly `episode_24h` delivery runner is enabled;
- protected dry-run remains non-sending;
- a real opted-in device subscription and two tracked-show mappings were present;
- production sent a real episode reminder and the device visibly received the native notification;
- the matching D1 delivery record is `sent`;
- final read-only audit recorded 1 successful `episode_24h` delivery, 0 pending transient failures and 0 terminal failures;
- the active accountless subscription and show mappings remained healthy after delivery.

### Phase 5E-A–5E-C

Production maturity hardening proved:

- Phase 5E-A established the production baseline and identified catalog breadth, not episode timestamp quality or Push delivery, as the first systemic bottleneck;
- Phase 5E-B kept the fixed TMDB request ceiling while rotating page-one candidate slices, expanding the active US-series catalog from 34 to 67 and later 71 shows;
- Phase 5E-C changed the bounded 10-show TVmaze enrichment pass from every six hours to every hour without changing the 10-show per-invocation cap;
- final acceptance measured **71/71 active shows with exact TVmaze mapping**, zero unsynced active shows, oldest TVmaze sync age **7.49h** and average age **3.55h**;
- all **279/279 retained numbered TVmaze episodes** had precise `air_timestamp` values;
- the last eight hours contained **8 TVmaze sync runs**, with **0 failed** and **0 warning** runs, and the latest run was approximately **0.49h** old;
- notification delivery remained healthy after the hardening change: **1 sent**, **0 transient failures**, **0 terminal failures**, **0 stuck sending** records since the Phase 5E-C deployment boundary;
- regional title display remained complete for active shows: HK-specific **67/71**, with fallback available for all remaining 4 and **0 active shows without any Chinese preferred title**;
- production/PR smoke validation was changed to use temporary files for large API payloads so catalog growth no longer hits the process environment-size limit.

See [`docs/PHASE5E_HARDENING.md`](docs/PHASE5E_HARDENING.md) for the Phase 5E baseline, implementation decisions and final acceptance gate.

Production-network audits remain separate from the default unit-test suite. Audit-only code is not merged into `main`.

## Architecture

```text
                  ┌──────────────┐
                  │     TMDB     │
                  └──────┬───────┘
                         │ metadata / external IDs
                         ▼
GitHub main ─ Actions ─► Cloudflare Worker ◄──── TVmaze
                         │       │                  episode/schedule
                         │       ├── Static assets
                         │       ├── Public API
                         │       ├── Lifecycle evidence projection
                         │       ├── Catalog sync + hourly TVmaze convergence
                         │       └── Hourly episode reminder runner
                         ▼
                  D1: series-hub-db
                         │
                         ├── catalog / seasons / episodes
                         ├── aliases / lifecycle evidence
                         └── accountless Push routing + delivery dedup

Browser
  ├── localStorage: tracked show IDs
  ├── localStorage: viewing states
  ├── localStorage: Push management capability after opt-in
  └── Service Worker: /push-sw.js
                         │
                         ▼
                 Browser Push service
                         │
                         ▼
                Native device notification
```

Production Worker:

```text
https://series-hub.max-yu-jp.workers.dev
```

Production D1:

```text
series-hub-db
```

Production sync cadence:

- TMDB: minute 17 every six hours;
- TVmaze: minute 47 every hour;
- `episode_24h` reminders: minute 7 every hour.

The TMDB and TVmaze source pipelines retain separate `sync_runs`; the notification runner is operationally isolated from both.

## Browser-only development rule

Normal project work does **not** require a local clone, PowerShell, local Node.js, Docker or user-installed Wrangler.

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

Normal application PRs use isolated preview Worker/D1 resources, no production TMDB secret and no cron triggers. Preview resources are deleted when the PR closes. Unmerged application code therefore cannot write production D1.

Dedicated production audits are read-only or explicitly bounded and are closed without merge when their code is audit-only.

## Repository layout

```text
Series-Hub/
├── README.md
├── docs/
│   ├── PHASE4_LIFECYCLE.md
│   ├── PHASE5D_NOTIFICATIONS.md
│   └── PHASE5E_HARDENING.md
├── package.json
├── wrangler.jsonc
├── .github/workflows/
├── migrations/
│   ├── 0001_initial.sql
│   ├── ...
│   ├── 0013_phase4f_fox_murder_small_town_evidence.sql
│   └── 0014_phase5d_push_subscriptions.sql
├── src/
│   ├── index.js
│   ├── phase4-worker.js
│   ├── phase5e-worker.js
│   ├── lifecycle.js
│   ├── lifecycle-admin.js
│   ├── tmdb.js
│   ├── tvmaze.js
│   ├── title-aliases.js
│   ├── title-admin.js
│   ├── push-subscriptions.js
│   └── push-delivery.js
├── public/
│   ├── index.html
│   ├── app.js
│   ├── phase4-ui.js
│   ├── phase5-ui.js
│   ├── phase5b-ui.js
│   ├── phase5c-ui.js
│   ├── phase5d-ui.js
│   ├── tracking.js
│   ├── viewing-state.js
│   ├── push-client.js
│   ├── push-sw.js
│   ├── schedule-utils.js
│   └── *.css
└── test/
```

## Public and device API

### `GET /health`

Reports service health, D1 reachability and source configuration. The historical internal phase identifier may remain older than the user-facing feature phase and must not be treated as the roadmap source of truth.

### `GET /api/shows`

Query parameters:

- `status=airing|upcoming|planned|completed|unknown`
- `q=<English or Chinese title>`
- `limit=1..100`
- `region=HK|TW|CN`

### `GET /api/schedule`

Query parameters:

- `from=YYYY-MM-DD`
- `days=1..14`
- `region=HK|TW|CN`

### Lifecycle/title routes

- `GET /api/lifecycle`
- `GET /api/shows/:id/lifecycle`
- `GET /api/title-audit`
- `GET /api/shows/:id/aliases`
- `GET /api/shows/:id/episodes`
- `GET /api/sync-status?source=tmdb|tvmaze`

### Push device routes

- `GET /api/push/public-key`
- `POST /api/push/subscriptions`
- `PUT /api/push/subscription`
- `DELETE /api/push/subscription`

Push mutations require the accepted same-origin/device-capability contract; they do not create user accounts.

### Protected internal routes

- `POST /api/internal/tmdb-sync`
- `POST /api/internal/tvmaze-sync`
- `POST /api/internal/title-override`
- `POST /api/internal/lifecycle-evidence`
- `POST /api/internal/episode-reminders`

The reminder route defaults to dry-run; actual send requires the explicit production send path/gate. Internal writes use the existing derived authorization-key contract.

## Core data principles

1. Season is first-class.
2. Original network/service and regional availability are separate concepts.
3. Chinese titles remain separate HK/TW/CN aliases with provenance.
4. Source-specific facts retain attribution.
5. TMDB, TVmaze and official lifecycle evidence have separate responsibilities.
6. Official lifecycle evidence is non-destructive and event-sourced.
7. No secrets in source control or frontend assets.
8. Applied D1 migrations are immutable; changes use new numbered migrations.
9. Unmerged application PR code never uses production D1 or application secrets.
10. Production migrations run before the Worker version that requires them.
11. R2 is not introduced until image storage has a demonstrated need.
12. No production TVmaze title fuzzy matching.
13. Local-time conversion is performed only when a real timestamp exists.
14. Deployment success alone is not acceptance; production contracts are audited at phase boundaries.
15. Production-network probes stay outside the default unit-test suite.
16. My Shows and viewing states remain local-first; server-side notification routing is a deliberately narrow exception with explicit opt-in.
17. No account/server identity system is introduced unless a demonstrated product requirement justifies it.
18. Notification scope must not expand silently; new alert classes require their own acceptance evidence.

## Roadmap

- **Phase 0 — Complete:** Worker/D1 foundation and browser-only CI/deployment.
- **Phase 1A — Complete:** TMDB US scripted catalog core.
- **Phase 1B — Complete:** catalog scope, quality, lifecycle classification and network balancing.
- **Phase 2A — Complete:** exact TVmaze mapping and episode/schedule normalization.
- **Phase 2B — Complete:** Today / This Week schedule UI and timezone-safe display.
- **Phase 3 — Complete:** regional Chinese title policy, fallback, provenance, live audit and protected manual override.
- **Phase 4 — Complete through 4F:** official lifecycle evidence and production acceptance.
- **Phase 5A — Complete:** browser-local My Shows tracking.
- **Phase 5B — Complete:** tracked-only Today / This Week filtering.
- **Phase 5C — Complete:** browser-local viewing states and My Shows state filtering.
- **Phase 5D-A — Complete:** Web Push feasibility proof.
- **Phase 5D-B — Complete:** accountless Push subscription persistence and revoke/delete.
- **Phase 5D-C — Complete:** production `episode_24h` reminders with real-device acceptance.
- **Phase 5D-D — Deferred/optional:** renewal/final-season Push alerts, per-show notification-type controls or queue/batching if later justified.
- **Phase 5E-A — Complete:** production maturity baseline and bottleneck identification.
- **Phase 5E-B — Complete:** rotating TMDB discovery slices within the existing request budget; production catalog breadth acceptance passed.
- **Phase 5E-C — Complete:** hourly bounded TVmaze convergence, regional-title fallback audit, CI/runtime smoke scaling and production acceptance.
- **Phase 5E-D — Recommended next:** lifecycle consistency, mobile UX and observability closeout for the enlarged US catalog.
- **Phase 6 — Later:** expansion beyond US series only after the full Phase 5 maturity gate is closed.

## Handoff checkpoint

As of the Phase 5E-C production acceptance, **do not rebuild Phase 4, replace local tracking/viewing states with accounts, rotate VAPID keys casually, broaden notification types by default, or undo the fixed-budget catalog/convergence controls without new measurements**.

The accepted production baseline is:

- US scripted catalog via TMDB;
- exact TVmaze episode/schedule linkage with bounded hourly convergence;
- HK/TW/CN regional title handling;
- attributed official lifecycle evidence;
- local My Shows + viewing states;
- optional accountless Web Push subscription;
- hourly deduplicated `episode_24h` reminders that have been proven on a real production device.

The safest next step is **Phase 5E-D: close the remaining US-series maturity items**—official lifecycle consistency across the enlarged catalog, mobile stability/interaction resilience and production observability—before deciding whether Phase 6 non-US expansion is justified.