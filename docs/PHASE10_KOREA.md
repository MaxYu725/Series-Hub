# Phase 10 — Korea Expansion

## Phase 10A — Korean Catalog Foundation

Status: **production-accepted through Phase 10A.1 catalog-quality hardening.**

### Scope

Phase 10 starts non-US expansion with South Korean scripted television only. The Korean catalog is defined by TMDB `origin_country` containing `KR`, not by Korean language alone. This preserves Korean co-productions while rejecting unrelated shows that merely contain Korean-language material.

Included TMDB types:
- Scripted
- Miniseries

Excluded genres remain aligned with the accepted US catalog policy:
- Animation
- Documentary
- Kids
- News
- Reality
- Talk

Phase 10A.1 adds a second, conservative admission condition: a candidate must carry at least one TMDB fiction genre. This prevents sparse Korean variety/lifestyle records that TMDB labels `Scripted` from entering the catalog merely because their type is misclassified.

Accepted fiction genres are:
- Drama
- Comedy
- Western
- Crime
- Mystery
- Family
- Action & Adventure
- Sci-Fi & Fantasy
- Soap
- War & Politics

This is not a title blacklist. A sparse record with no fiction genre is simply deferred until TMDB metadata becomes sufficiently specific.

### Source authority

TMDB remains the catalog metadata authority. Korean records use the same normalized `shows`, `seasons`, `networks`, `genres`, and `title_aliases` tables as US records. No Korea-specific content tables are introduced.

The Korean catalog has a separate operational source identity:
- source key: `tmdb_kr`
- display name: `TMDB · Korea`
- sync run type: `catalog_kr`

This prevents Korean ingestion from replacing the accepted US `tmdb` sync freshness and health record.

### Bounded request budget

The accepted US TMDB sync remains unchanged at 48 external requests per run.

The Korean sync has its own maximum of 24 external requests:
- 1 broad Korean discovery request
- 1 upcoming / schedule discovery request
- 4 rotating Korean network discovery requests
- 18 detail requests

The two budgets are independent. Phase 10A does not steal US discovery slots or increase the US 48-request ceiling.

### Initial Korean network seeds

The first verified TMDB network seeds are:
- KBS2 — 342
- MBC — 97
- SBS — 156
- tvN — 866
- JTBC — 885
- ENA — 5841
- TVING — 3897
- Netflix — 213
- Disney+ — 2739

Only four network seeds are queried in one Korean run. The deterministic six-hour rotation reaches all nine seeds without changing the US seed rotation.

Network seeds improve coverage but are not an admission whitelist. A Korean scripted/miniseries candidate discovered through the KR broad or upcoming feed may still enter the catalog even when its original network is not in the seed list.

### First production benchmark — 2026-09-14

The first real production KR sync completed successfully with:
- 103 unique candidates seen
- 18 detail records selected
- 7 records initially persisted
- 6 discovery requests
- 24 total external requests
- 0 warnings
- independent `tmdb_kr=success` and `tmdb=success` health

The run proved the Phase 10A ingestion architecture and budget isolation, but also exposed a data-quality edge case: four of the seven initially persisted rows were sparse Korean variety/lifestyle programs that TMDB currently labels `Scripted` while providing no genres. The three clearly fictional rows all carried fiction genres.

A read-only follow-up diagnostic compared the production rows with Queen of Tears, Crash Landing on You, Moving, The Glory, Lovely Runner and Hospital Playlist. The useful invariant was not episode count, runtime, network or a particular title keyword; it was the presence of at least one fiction genre. This preserves long daily dramas and genre series while rejecting the observed sparse false positives.

Migration `0020_phase10a1_korea_catalog_quality.sql` performs the one-time cleanup of already-ingested rows that fail the same metadata rule. The cleanup is based only on country and genre relationships and contains no show-title or TMDB-ID blacklist.

The first post-migration production acceptance run confirmed that only three fiction-qualified rows remained, but also exposed avoidable write/delete churn in the initial quality wrapper: sparse detail records were persisted before being pruned. Phase 10A.1 therefore moves the fiction-genre admission check into the KR detail loop before `persistSeries()`. The base KR sync retains its accepted discovery/budget behavior and exposes an optional admission predicate; the Phase 10 quality wrapper supplies the stricter fiction policy. Runtime syncs no longer use delete-after-write cleanup.

### Final Phase 10A.1 production acceptance — 2026-09-14

Production main checkpoint:

```text
163f705f672e2307fc20398174bc464ba37c7ad0
```

The merged production deployment completed successfully through unit tests, D1 migrations, Worker deployment, immediate US TMDB sync, TVmaze bootstrap/convergence, final runtime smoke and VAPID readiness.

A real Korean production re-sync then returned:
- `recordsSeen = 103`
- `recordsSelected = 18`
- `recordsChanged = 3`
- `recordsAccepted = 3`
- `recordsRejected = 4`
- `recordsPruned = 0`
- `discoveryRequests = 6`
- `externalRequestBudget = 24`
- `warnings = 0`
- `qualityPolicy = kr_scripted_with_fiction_genre_prewrite`

The pre-sync production D1 baseline contained exactly three Korean rows and all three carried two accepted fiction genres:
- Family Register
- Take Charge of My Heart
- Good Partner

The zero-prune result is the key Phase 10A.1 acceptance signal: sparse records are rejected before D1 persistence rather than being written and deleted afterward. The three accepted records are the only records persisted by that run, while rejected sparse records do not enter the catalog.

The legacy diagnostic runner used for the final probe reports a failed assertion because it still expected the retired policy name `kr_scripted_with_fiction_genre`; the production sync itself completed successfully and returned the new `kr_scripted_with_fiction_genre_prewrite` contract above. This diagnostic runner is not part of production code.

### Product behavior

The existing title model is reused:
- `original_title` may contain the Korean title
- `english_title` uses TMDB English metadata
- HK / TW / CN Chinese names continue through the existing title alias pipeline

The homepage and PWA branding are region-neutral (`SERIES TRACKER`, `劇集追蹤`) because the catalog is no longer US-only.

Phase 10A deliberately does not add a market selector yet. Region filtering belongs to Phase 10C after Korean ingestion and schedule coverage are production-validated.

### Scheduling

The accepted US TMDB catalog sync remains unchanged on `17 */6 * * *`, and the accepted TVmaze convergence remains unchanged on `47 * * * *`.

The Korean catalog has its own six-hour trigger at `37 */6 * * *`. This separation is deliberate: the US 48-request budget and Korean 24-request budget run in different Worker invocations instead of being combined into one scheduled execution.

Internal manual endpoint:
- `POST /api/internal/tmdb-sync-kr`

Operational status:
- `GET /api/sync-status?source=tmdb_kr`

Both retain the existing internal sync-key authorization model.

### Acceptance gates

Phase 10A / 10A.1 is accepted because:
1. all existing US / Phase 1–8 regression tests remain green;
2. Korean eligibility rejects non-KR, reality, animation and sparse no-fiction-genre cases;
3. US request budget remains exactly 48;
4. Korean request budget remains at or below 24 and runs on an isolated cron invocation;
5. the Phase 10 wrapper delegates all non-Korean fetch and scheduled behavior to Phase 8;
6. production D1 records `tmdb_kr` separately from `tmdb`;
7. production Korean syncs use real TMDB identities without synthetic IDs or manual show seeds;
8. migration 0020 removed the observed historical false positives without title/TMDB-ID blacklists;
9. normal KR sync applies fiction admission before D1 persistence and no longer relies on runtime delete-after-write pruning;
10. the final production re-run returned accepted/rejected metrics with `recordsPruned = 0`, while the US production pipeline remained healthy.

### Deferred

Not part of 10A:
- Korean-specific TV schedule fallback source
- Korean official renewal / production evidence registry
- US / Korea catalog UI selector
- Japan / Taiwan / Europe expansion

Those are evaluated only after the Korean catalog foundation is proven in production.
