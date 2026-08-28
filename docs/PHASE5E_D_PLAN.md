# Phase 5E-D — US-series maturity closeout

## Goal

Phase 5E-D closes the remaining US-series maturity work before any non-US geographic expansion. The gate is deliberately product-facing: **Phase 6 must not begin merely because the data pipeline is healthy; the current US-series UI/UX must also be judged sufficiently polished and resilient on real mobile use.**

## Scope

Phase 5E-D is split into four bounded slices:

### 5E-D1 — UI resilience and navigation foundation

- make loading visually explicit instead of leaving an apparently empty panel;
- distinguish API/network failure from a legitimate empty result;
- provide an in-place retry action;
- impose a bounded frontend request timeout so `載入中…` cannot remain indefinitely;
- make the existing notification deep-link `/?view=my-shows` actually open My Shows safely;
- improve touch-target, focus-visible and horizontal-filter behavior on mobile;
- refresh stale Phase labels/copy so the visible product matches the live notification and hardening baseline.

### 5E-D2 — lifecycle consistency audit

- audit the enlarged active catalog against accepted official lifecycle evidence;
- identify contradictions between base lifecycle classification and attributed official evidence without overwriting either source silently;
- repair only deterministic projection/display inconsistencies; do not rebuild Phase 4 evidence.

### 5E-D3 — operational observability

- surface enough source freshness/degradation information that normal operation can be assessed without manual D1 inspection;
- preserve source separation between TMDB, TVmaze and Push delivery;
- remove/rotate any unsafe internal derived-key logging pattern before adding new production probes.

### 5E-D4 — mobile/product acceptance gate

Real-device acceptance must cover at least:

- 360–430 px phone width and normal desktop layout;
- Today, This Week, Airing, Upcoming, Planned and My Shows navigation;
- search and regional-title switching;
- tracked-only schedule filtering;
- tracking/untracking and four viewing states;
- loading, empty, failure and retry states;
- notification deep-link into My Shows;
- no persistent horizontal viewport overflow or UI freeze;
- core interactive controls remain comfortably tappable and keyboard-focus visible;
- no regression in catalog/schedule data quality or Push delivery.

## Phase 6 gate

**Non-US expansion remains blocked until Phase 5E-D4 is explicitly accepted.**

Passing backend sync checks alone is not sufficient. Phase 6 starts only after the current US-series experience is both operationally healthy and sufficiently polished for routine mobile use.

## Acceptance status

**Accepted on 2026-08-28 (Asia/Hong_Kong).** The final production real-device review was explicitly confirmed as `驗收正常` after the content-first landing flow, grouped multi-episode schedule cards, Airing next-schedule display, and the 390 px mobile filter regression fix were deployed and verified.

The Phase 6 gate above is therefore satisfied. Phase 6 non-US expansion is no longer blocked by Phase 5E-D4 acceptance.

See `docs/PHASE5E_D_ACCEPTANCE.md` for the production evidence and final closeout record.
