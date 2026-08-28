# Phase 5E — US-series maturity / hardening

## Purpose

Phase 5E hardens the accepted US-series product before any geographic expansion or broader notification scope. It does not introduce accounts and it does not change the accepted local-first personalization boundary.

## Phase 5E-A — maturity baseline

The first production audit measured the end-to-end catalog, mapping, episode, title and notification state. The important finding was that episode timestamp quality and Push delivery were already strong, while TMDB catalog breadth was constrained by repeatedly starting the fixed detail budget from the same front portion of discovery feeds.

Baseline highlights before the breadth repair:

- active US scripted shows: 34;
- exact TVmaze mapping: 34/34;
- retained numbered episodes: 164;
- precise episode timestamps: 164/164;
- HK preferred titles: 32/34;
- the TMDB sync saw roughly 131 candidates but could detail only 40 per invocation under the accepted request budget.

## Phase 5E-B — fixed-budget catalog rotation

The TMDB discovery/detail ceiling remains unchanged at 48 requests per sync: 8 discovery requests plus at most 40 detail requests. Instead of always starting from the front of each discovery feed, six-hour sync slots rotate the page-one candidate slice while preserving round-robin feed representation, de-duplication, scripted-US filtering and network policy.

Production acceptance showed the active catalog expand from 34 to 67 shows without increasing the request ceiling. This exposed TVmaze downstream convergence as the next bottleneck.

## Phase 5E-C — hourly bounded TVmaze convergence

The TVmaze synchronizer still processes at most 10 shows per invocation. Phase 5E-C changes only its cadence: from minute 47 every six hours to minute 47 every hour. TMDB remains minute 17 every six hours and the `episode_24h` reminder runner remains minute 7 every hour.

This means a roughly 70-show active catalog can converge in about seven to eight hourly passes while preserving the existing per-run outbound-request safety bound.

Phase 5E-C also hardened GitHub Actions validation after catalog growth exposed an operating-system environment-size failure. Production and PR smoke tests now save large API payloads to temporary files and let Node read those files, rather than copying full `/api/shows` and schedule payloads into process environment variables.

## Regional-title decision

Phase 5E-C did not silently promote TW/CN translations into HK-specific aliases. The existing resolver keeps HK/TW/CN provenance separate and uses regional fallback when an HK-specific preferred title is absent. Manual HK overrides still require HK-specific evidence.

## Final production acceptance

The final read-only production audit ran after sustained hourly convergence and passed every gate:

| Metric | Final result | Gate |
| --- | ---: | --- |
| Active catalog | 71 | no regression from Phase 5E-B |
| Exact TVmaze mapping | 71/71 | 100% |
| Active shows never TVmaze-synced | 0 | 0 |
| Oldest active TVmaze sync age | 7.49h | approximately <= 8h |
| Average active TVmaze sync age | 3.55h | informational |
| Retained numbered TVmaze episodes | 279 | > 0 |
| Precise `air_timestamp` coverage | 279/279 | 100% |
| TVmaze runs in preceding 8h | 8 | >= 7 |
| Failed TVmaze runs in preceding 8h | 0 | 0 |
| Warning TVmaze runs in preceding 8h | 0 | 0 |
| Latest TVmaze run age | 0.49h | <= 1.5h |
| Notification deliveries since Phase 5E-C boundary | 1 sent | informational |
| New transient notification failures | 0 | 0 |
| New terminal notification failures | 0 | 0 |
| Stuck `sending` deliveries | 0 | 0 |
| HK-specific preferred titles | 67/71 | provenance-preserving |
| HK gaps with TW/CN fallback | 4/4 | complete fallback |
| Active shows with no Chinese preferred title | 0 | 0 |

The production runtime health endpoint and latest TVmaze sync status were also healthy, and the deployed cron contract was confirmed as:

```text
7 * * * *       episode_24h reminder
17 */6 * * *   TMDB catalog sync
47 * * * *      TVmaze episode/schedule convergence
```

## Acceptance decision

**Phase 5E-C is COMPLETE and production-accepted.**

The hourly convergence model is keeping up with the enlarged catalog without raising the per-invocation TVmaze cap, episode timing remains fully precise for retained numbered TVmaze episodes, notification delivery has not regressed, and regional Chinese-title fallback remains complete without falsifying HK provenance.

## Next recommended slice

**Phase 5E-D — lifecycle consistency, mobile UX and observability closeout.**

Before Phase 6 geographic expansion, review the enlarged active catalog for official lifecycle-evidence consistency, exercise mobile loading/interaction resilience against the larger result set, and ensure operational signals make source-sync or notification degradation visible without relying on manual D1 audits.
